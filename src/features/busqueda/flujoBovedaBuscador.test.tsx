// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import {
  anclarMaestra,
  campoBuscador,
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  MAESTRA_PRUEBA,
  montar,
  sembrarCredencial,
  sembrarPerfil,
  sembrarReferencia,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { bloquear, bovedaDesbloqueada } from '../boveda/sesionBoveda'
import { InicioPage } from '../inicio/InicioPage'

// LA BÓVEDA DESDE EL BUSCADOR, DE PRINCIPIO A FIN (encargo del
// 2026-09-16, casos A, B, C, D y J de la sección 16).
//
// Se monta Inicio de verdad, con su buscador en línea, y se recorre lo que
// hace un técnico: buscar un acceso con la bóveda cerrada, desbloquearla
// ahí mismo, mirar el acceso, destapar la clave, taparla, copiarla y
// cerrar la vista. Lo que se comprueba en cada tramo es que NUNCA se sale
// de Inicio y que la consulta sigue escrita.
//
// El único simulado es el portapapeles, que no existe fuera del navegador.
vi.mock('../../lib/portapapeles', () => ({ copiarAlPortapapeles: vi.fn() }))
const copiarMock = vi.mocked(copiarAlPortapapeles)

// Largo y sin espacios, con la forma de los que se cortaban con "...".
const CLAVE = `Xq7#Lm2$Rt9@Vb4%${'Pr0ceso-De-Prueba_Largo.2026+Sin/Espacios'.repeat(3)}`

const RUTAS = [
  { ruta: '/', elemento: <InicioPage /> },
  { ruta: '/boveda', elemento: <p>PANTALLA DE LA BOVEDA</p> },
  { ruta: '/boveda/:credencialId', elemento: <p>FICHA DE LA BOVEDA</p> },
]

// Las acciones registradas, sin orden: la tabla se lee por id (aleatorio)
// y dos registros del mismo milisegundo no tienen un orden que comparar.
const auditoria = async () => (await db.accesos_boveda.toArray()).map((acceso) => acceso.accion).sort()
const acciones = (...lista: string[]) => [...lista].sort()

beforeEach(async () => {
  await limpiarBase()
  copiarMock.mockReset()
  copiarMock.mockResolvedValue(true)
  await sembrarPerfil(true)
  await anclarMaestra()
  await sembrarCredencial({
    id: 'cred-pos',
    titulo: 'Administrador POS',
    tipo: 'cuenta',
    usuario: 'admin.pos.prueba',
    contrasena: CLAVE,
  })
  // La bóveda empieza CERRADA, como la encuentra el técnico.
  bloquear()
  await db.accesos_boveda.clear()
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

async function buscarEnInicio(consulta: string): Promise<void> {
  await montar(RUTAS, '/')
  const campo = await esperar(campoBuscador, 'el buscador de Inicio')
  await escribir(campo, consulta)
}

async function desbloquearDesdeElPuente(): Promise<void> {
  await tocar(await esperarControl('Desbloquear y buscar'))
  const contrasena = await esperar(
    () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
    'el campo de la contraseña maestra',
  )
  await escribir(contrasena, MAESTRA_PRUEBA)
  await enviarFormulario(contrasena)
  await esperar(() => bovedaDesbloqueada(), 'la bóveda se abre')
}

describe('caso A y B: desbloquear desde el buscador de Inicio', () => {
  it('sigue en Inicio, con la misma consulta y la credencial ya en la lista', async () => {
    await buscarEnInicio('administrador POS')
    // Con la bóveda cerrada el acceso no está en el índice.
    expect(textoPantalla()).not.toContain('Administrador POS')

    await desbloquearDesdeElPuente()

    const ver = await esperarControl('Ver "Administrador POS"')
    expect(ver).toBeTruthy()
    // CASO B: no se navegó a /boveda ni a ninguna otra parte.
    expect(ubicacionActual().pathname).toBe('/')
    expect(textoPantalla()).not.toContain('PANTALLA DE LA BOVEDA')
    expect(textoPantalla()).not.toContain('FICHA DE LA BOVEDA')
    // CASO A: la misma búsqueda sigue escrita, y el puente ya no hace falta.
    expect(campoBuscador()?.value).toBe('administrador POS')
    expect(control('Desbloquear y buscar')).toBeNull()
    expect(control('Copiar contraseña de "Administrador POS"')).toBeTruthy()
    // Desbloquear no revela nada por sí solo.
    expect(textoPantalla()).not.toContain(CLAVE)
  })
})

describe('caso C: ver, mostrar, ocultar y copiar sin abrir la ficha', () => {
  it('la clave arranca tapada, se destapa entera, se tapa y se copia, con la auditoría de la ficha', async () => {
    await buscarEnInicio('administrador POS')
    await desbloquearDesdeElPuente()
    await tocar(await esperarControl('Ver "Administrador POS"'))

    // La vista se despliega dentro de Inicio, con el usuario a la vista y
    // la contraseña TAPADA aunque la bóveda esté abierta.
    await esperar(() => textoPantalla().includes('admin.pos.prueba'), 'el usuario descifrado')
    expect(document.body.querySelector('[role="region"][aria-label="Vista rápida: Administrador POS"]')).toBeTruthy()
    expect(textoPantalla()).toContain('••••••••')
    expect(textoPantalla()).not.toContain(CLAVE)
    expect(ubicacionActual().pathname).toBe('/')
    // Abrir la vista queda registrado como abrir la ficha: "consultó".
    await esperarQue(async () => (await auditoria()).length > 0, 'la consulta queda registrada')
    expect(await auditoria()).toEqual(acciones('consulto'))

    // MOSTRAR: el valor completo, sin "..." y partido en líneas.
    await tocar(await esperarControl('Mostrar contraseña (queda registrado)'))
    expect(textoPantalla()).toContain(CLAVE)
    const valor = Array.from(document.body.querySelectorAll('span')).find((span) => span.textContent === CLAVE)
    expect(valor?.className).toContain('break-all')
    expect(valor?.className).not.toContain('truncate')
    expect(textoPantalla()).not.toContain(`${CLAVE.slice(0, 20)}...`)
    await esperarQue(async () => (await auditoria()).length === 2, 'el revelado queda registrado')
    expect(await auditoria()).toEqual(acciones('consulto', 'mostro'))

    // OCULTAR: el valor sale de la pantalla y no se registra nada más.
    await tocar(await esperarControl('Ocultar contraseña'))
    expect(textoPantalla()).not.toContain(CLAVE)
    expect(await auditoria()).toEqual(acciones('consulto', 'mostro'))

    // COPIAR: el valor descifrado va al portapapeles y a la auditoría.
    await tocar(await esperarControl('Copiar contraseña de "Administrador POS"'))
    await esperar(() => copiarMock.mock.calls.length > 0, 'la copia')
    expect(copiarMock).toHaveBeenCalledWith(CLAVE)
    await esperar(() => textoPantalla().includes('Copiado'), 'el aviso de copiado')
    expect(await auditoria()).toEqual(acciones('consulto', 'mostro', 'copio_contrasena'))
    expect(ubicacionActual().pathname).toBe('/')
  })

  it('copiar el usuario desde la vista registra su propia acción', async () => {
    await buscarEnInicio('administrador POS')
    await desbloquearDesdeElPuente()
    await tocar(await esperarControl('Ver "Administrador POS"'))
    await esperar(() => textoPantalla().includes('admin.pos.prueba'), 'el usuario descifrado')

    await tocar(await esperarControl('Copiar usuario de "Administrador POS"'))
    await esperar(() => copiarMock.mock.calls.length > 0, 'la copia')

    expect(copiarMock).toHaveBeenCalledWith('admin.pos.prueba')
    await esperarQue(async () => (await auditoria()).length === 2, 'la copia queda registrada')
    expect(await auditoria()).toEqual(acciones('consulto', 'copio_usuario'))
  })
})

describe('caso D: cerrar la vista rápida conserva la búsqueda', () => {
  it('vuelve a los mismos resultados, con la consulta escrita y sin el secreto en pantalla', async () => {
    await buscarEnInicio('administrador POS')
    await desbloquearDesdeElPuente()
    await tocar(await esperarControl('Ver "Administrador POS"'))
    await tocar(await esperarControl('Mostrar contraseña (queda registrado)'))
    expect(textoPantalla()).toContain(CLAVE)

    await tocar(await esperarControl('Cerrar la vista rápida de "Administrador POS"'))

    expect(document.body.querySelector('[role="region"][aria-label^="Vista rápida"]')).toBeNull()
    expect(textoPantalla()).not.toContain(CLAVE)
    expect(textoPantalla()).not.toContain('admin.pos.prueba')
    expect(campoBuscador()?.value).toBe('administrador POS')
    expect(control('Ver "Administrador POS"')).toBeTruthy()
    expect(ubicacionActual().pathname).toBe('/')

    // Volver a abrirla empieza otra vez TAPADA: nada quedó revelado.
    await tocar(await esperarControl('Ver "Administrador POS"'))
    await esperar(() => textoPantalla().includes('admin.pos.prueba'), 'el usuario descifrado')
    expect(textoPantalla()).not.toContain(CLAVE)
  })

  it('si la bóveda se bloquea con la vista abierta, el secreto desaparece de la pantalla', async () => {
    await buscarEnInicio('administrador POS')
    await desbloquearDesdeElPuente()
    await tocar(await esperarControl('Ver "Administrador POS"'))
    await tocar(await esperarControl('Mostrar contraseña (queda registrado)'))
    expect(textoPantalla()).toContain(CLAVE)

    bloquear()
    await esperar(() => !textoPantalla().includes(CLAVE), 'el secreto sale de la pantalla')
    expect(textoPantalla()).not.toContain('admin.pos.prueba')
  })
})

describe('tipos de acceso en la vista rápida', () => {
  it('una clave o PIN y un token se ven tapados con su propio rótulo; una nota se lee; un archivo no se abre', async () => {
    await anclarMaestra()
    await sembrarCredencial({ id: 'cred-wifi', titulo: 'Wifi de prueba', tipo: 'red', contrasena: 'PIN-DE-PRUEBA-1234' })
    await sembrarCredencial({ id: 'cred-token', titulo: 'Token de prueba', tipo: 'llave', contrasena: 'tok.PRUEBA.123' })
    await sembrarCredencial({ id: 'cred-nota', titulo: 'Nota de prueba', tipo: 'nota', notas: 'Texto de la nota de prueba' })
    await sembrarCredencial({ id: 'cred-archivo', titulo: 'Archivo de prueba', tipo: 'archivo' })

    await buscarEnInicio('prueba')

    await tocar(await esperarControl('Ver "Wifi de prueba"'))
    await esperar(() => textoPantalla().includes('Clave o PIN'), 'el rótulo de la clave')
    expect(textoPantalla()).not.toContain('PIN-DE-PRUEBA-1234')
    await tocar(await esperarControl('Mostrar clave o PIN (queda registrado)'))
    expect(textoPantalla()).toContain('PIN-DE-PRUEBA-1234')
    await tocar(await esperarControl('Cerrar la vista rápida de "Wifi de prueba"'))

    await tocar(await esperarControl('Ver "Token de prueba"'))
    await esperar(() => textoPantalla().includes('Valor'), 'el rótulo del token')
    expect(textoPantalla()).not.toContain('tok.PRUEBA.123')
    await tocar(await esperarControl('Cerrar la vista rápida de "Token de prueba"'))

    await tocar(await esperarControl('Ver "Nota de prueba"'))
    await esperar(() => textoPantalla().includes('Texto de la nota de prueba'), 'la nota')
    await tocar(await esperarControl('Cerrar la vista rápida de "Nota de prueba"'))

    // El archivo seguro no tiene "Ver": su acción es abrir la ficha.
    expect(control('Ver "Archivo de prueba"')).toBeNull()
    expect(control('Abrir la ficha de "Archivo de prueba"')).toBeTruthy()
    expect(ubicacionActual().pathname).toBe('/')
  })
})

describe('caso J: Bóveda sin permiso', () => {
  it('no hay puente, ni credenciales, ni ninguna pista de lo protegido', async () => {
    await sembrarPerfil(false)
    await buscarEnInicio('administrador POS')
    await esperar(() => textoPantalla().includes('Sin coincidencias'), 'el estado vacío')

    expect(control('Desbloquear y buscar')).toBeNull()
    expect(textoPantalla()).not.toMatch(/b[oó]veda/i)
    expect(textoPantalla()).not.toContain('Administrador POS')
    expect(document.body.querySelector('input[placeholder="Contraseña maestra"]')).toBeNull()
  })

  it('aunque la bóveda quedara abierta en el teléfono, sin permiso no aparece ningún acceso', async () => {
    await sembrarPerfil(false)
    await anclarMaestra()
    await buscarEnInicio('administrador POS')
    await esperar(() => textoPantalla().includes('Sin coincidencias'), 'el estado vacío')

    expect(textoPantalla()).not.toContain('Administrador POS')
    expect(control(/^Ver /)).toBeNull()
    expect(control(/^Copiar /)).toBeNull()
  })
})

describe('sección 14: el puente no compite con una coincidencia pública fuerte', () => {
  it('con "Zabbix" encontrado, el puente es la línea compacta y va debajo de los resultados', async () => {
    await sembrarReferencia({ id: 'ref-zabbix', tipo: 'herramienta', titulo: 'Zabbix', definicion: 'Monitoreo de prueba' })
    await buscarEnInicio('zabbix')
    const puente = await esperarControl('Desbloquear y buscar')

    // Forma compacta: sin la frase larga ni el botón de ancho completo.
    expect(textoPantalla()).not.toContain('La bóveda está bloqueada: sus accesos no aparecen en esta búsqueda.')
    expect(puente.className).not.toContain('w-full')
    // Debajo del resultado público.
    const fila = Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent?.includes('Zabbix'))
    expect(fila).toBeTruthy()
    expect(fila!.compareDocumentPosition(puente) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin resultados públicos el puente conserva su forma destacada', async () => {
    await buscarEnInicio('administrador POS')
    const puente = await esperarControl('Desbloquear y buscar')
    expect(textoPantalla()).toContain('La bóveda está bloqueada: sus accesos no aparecen en esta búsqueda.')
    expect(puente.className).toContain('w-full')
  })
})
