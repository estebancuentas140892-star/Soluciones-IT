// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import { empezarEjecucion } from '../../lib/progresoPasos'
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
  pasoPrueba,
  sembrarCredencial,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  sembrarReferencia,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { bloquear, bovedaDesbloqueada } from '../boveda/sesionBoveda'
import { AsistentePage } from '../soluciones/AsistentePage'

// BUSCAR A MITAD DE UNA GUÍA SIN SALIR DE ELLA (encargo del 2026-09-16,
// casos E, F y G de la sección 16).
//
// Se monta la ejecución de verdad (`AsistentePage`) y se mueve el paso a
// mano, que es estado EN MEMORIA de la pantalla: si la ejecución se
// desmontara, volvería al primer paso pendiente. Por eso, además de la
// ruta, se comprueba que el mismo nodo del contador de pasos sigue en el
// documento y que sigue diciendo "Paso 3 de 3".
vi.mock('../../lib/portapapeles', () => ({ copiarAlPortapapeles: vi.fn() }))
const copiarMock = vi.mocked(copiarAlPortapapeles)

const CLAVE = 'Clave-De-Prueba-Para-La-Guia!2026'
const RUTA_EJECUCION = '/soluciones/cat-pruebas/guia-pos/ejecutar'

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId/ejecutar', elemento: <AsistentePage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>FICHA DE OTRA PANTALLA</p> },
  { ruta: '/boveda', elemento: <p>FICHA DE OTRA PANTALLA</p> },
  { ruta: '/boveda/:credencialId', elemento: <p>FICHA DE OTRA PANTALLA</p> },
  { ruta: '/referencia/:referenciaId', elemento: <p>FICHA DE OTRA PANTALLA</p> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DE OTRA PANTALLA</p> },
  { ruta: '/diagnostico/:diagnosticoId', elemento: <p>FICHA DE OTRA PANTALLA</p> },
]

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
  bloquear()
  await sembrarGuia({
    id: 'guia-pos',
    titulo: 'Instalar el POS de prueba',
    pasos: [
      pasoPrueba('pos-p1', 'Preparar la caja de prueba', ['Encender la caja']),
      pasoPrueba('pos-p2', 'Entrar como administrador', ['Escribir el usuario']),
      pasoPrueba('pos-p3', 'Comprobar la venta de prueba', ['Hacer una venta']),
    ],
  })
  await sembrarGuia({
    id: 'guia-impresora',
    titulo: 'Configurar la impresora de prueba',
    pasos: [pasoPrueba('imp-p1', 'Conectar la impresora de prueba', ['Conectar el cable'])],
  })
  // El paso entero, para mover el paso con sus flechas de consulta.
  await guardarModoEjecucion('pasoEntero')
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

/** Abre la ejecución y deja el paso 3 a la vista, en memoria. */
async function ejecucionEnPasoTres(): Promise<HTMLElement> {
  await montar(RUTAS, RUTA_EJECUCION)
  await esperarControl(/^Paso 1 de 3/)
  await tocar(await esperarControl('Ver el paso siguiente. Solo mueve la vista, no lo da por hecho'))
  await tocar(await esperarControl('Ver el paso siguiente. Solo mueve la vista, no lo da por hecho'))
  return esperarControl(/^Paso 3 de 3/)
}

async function abrirBuscadorDeLaGuia(consulta: string): Promise<void> {
  await tocar(await esperarControl('Buscar sin salir de aquí'))
  const campo = await esperar(campoBuscador, 'el campo del buscador en la capa')
  expect(textoPantalla()).toContain('Modo consulta')
  await escribir(campo, consulta)
}

/** La ejecución sigue montada y en el mismo sitio. */
function sigueLaMismaEjecucion(contador: HTMLElement): void {
  expect(ubicacionActual().pathname).toBe(RUTA_EJECUCION)
  expect(contador.isConnected).toBe(true)
  expect(contador.getAttribute('aria-label')).toMatch(/^Paso 3 de 3/)
  expect(textoPantalla()).not.toContain('FICHA DE OTRA PANTALLA')
}

describe('caso E: credencial durante una guía', () => {
  it('buscar, desbloquear, ver, mostrar, copiar y cerrar deja la ejecución exactamente igual', async () => {
    const contador = await ejecucionEnPasoTres()
    await abrirBuscadorDeLaGuia('administrador POS')

    await tocar(await esperarControl('Desbloquear y buscar'))
    const contrasena = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
      'el campo de la contraseña maestra',
    )
    await escribir(contrasena, MAESTRA_PRUEBA)
    await enviarFormulario(contrasena)
    await esperar(() => bovedaDesbloqueada(), 'la bóveda se abre')
    sigueLaMismaEjecucion(contador)

    // En consulta la fila de la credencial no es un enlace a la Bóveda.
    await esperarControl('Ver "Administrador POS"')
    expect(Array.from(document.body.querySelectorAll('a')).some((a) => a.textContent?.includes('Administrador POS'))).toBe(false)

    await tocar(await esperarControl('Ver "Administrador POS"'))
    await esperar(() => textoPantalla().includes('admin.pos.prueba'), 'el usuario descifrado')
    expect(textoPantalla()).not.toContain(CLAVE)
    // Sin "Abrir ficha": abrirla sacaría al técnico de la guía.
    expect(control('Abrir ficha')).toBeNull()

    await tocar(await esperarControl('Mostrar contraseña (queda registrado)'))
    expect(textoPantalla()).toContain(CLAVE)
    await tocar(await esperarControl('Copiar contraseña de "Administrador POS"'))
    await esperar(() => copiarMock.mock.calls.length > 0, 'la copia')
    expect(copiarMock).toHaveBeenCalledWith(CLAVE)
    await esperarQue(async () => (await db.accesos_boveda.count()) === 3, 'consulta, revelado y copia registrados')

    await tocar(await esperarControl('Cerrar la vista rápida de "Administrador POS"'))
    expect(campoBuscador()?.value).toBe('administrador POS')
    await tocar(await esperarControl('Cerrar el buscador'))

    expect(campoBuscador()).toBeNull()
    expect(textoPantalla()).not.toContain(CLAVE)
    sigueLaMismaEjecucion(contador)
  })
})

describe('caso F: desde el buscador de una guía no se inicia otra guía', () => {
  it('otra guía aparece como referencia: sin Empezar, sin enlace y sin salir al tocarla', async () => {
    const contador = await ejecucionEnPasoTres()
    await abrirBuscadorDeLaGuia('impresora')
    await esperar(() => textoPantalla().includes('Configurar la impresora de prueba'), 'la otra guía en resultados')

    expect(control(/^Empezar/)).toBeNull()
    expect(control(/^Continuar/)).toBeNull()
    expect(control(/^Repetir guía/)).toBeNull()
    expect(control(/^Iniciar/)).toBeNull()
    // No es un enlace ni un botón: no hay nada que tocar que la abra.
    const fila = Array.from(document.body.querySelectorAll('a, button')).find((elemento) =>
      elemento.textContent?.includes('Configurar la impresora de prueba'),
    )
    expect(fila).toBeUndefined()
    sigueLaMismaEjecucion(contador)
  })

  it('tampoco ofrece continuar una guía que ya estaba a medias en este teléfono', async () => {
    await empezarEjecucion('guia-impresora')
    const contador = await ejecucionEnPasoTres()
    await abrirBuscadorDeLaGuia('impresora')
    await esperar(() => textoPantalla().includes('Configurar la impresora de prueba'), 'la otra guía en resultados')

    expect(control(/^Continuar/)).toBeNull()
    expect(control(/^Empezar/)).toBeNull()
    sigueLaMismaEjecucion(contador)
  })
})

describe('caso G: herramienta, glosario, comando y equipo dentro de la capa', () => {
  beforeEach(async () => {
    await sembrarReferencia({
      id: 'ref-zabbix',
      tipo: 'herramienta',
      titulo: 'Zabbix',
      definicion: 'Sistema de monitoreo de prueba.',
      cuandoUsar: 'Para ver si un equipo de prueba responde.',
      usoEnMetroparques: 'Uso de prueba en la sede de ejemplo.',
      estadoUso: 'confirmado',
    })
    await sembrarReferencia({
      id: 'ref-vlan',
      tipo: 'termino',
      titulo: 'VLAN',
      definicion: 'Red virtual de prueba dentro de un mismo switch.',
    })
    await sembrarReferencia({
      id: 'ref-ipconfig',
      tipo: 'comando',
      titulo: 'Ver la configuración de red',
      plataforma: 'Windows',
      valor: 'ipconfig /all',
    })
    await sembrarEquipo({
      id: 'eq-caja',
      nombre: 'Caja 4 de prueba',
      marca: 'Marca de prueba',
      modelo: 'Modelo X',
      ubicacion: 'Taquilla de prueba',
      estado: 'Operativo',
      ip: '10.0.0.44',
    })
  })

  it('una herramienta abre su ficha rápida (qué es, para qué sirve, uso y estado) sin desmontar la guía', async () => {
    const contador = await ejecucionEnPasoTres()
    await abrirBuscadorDeLaGuia('zabbix')

    const fila = await esperar(
      () =>
        Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find((boton) =>
          boton.textContent?.includes('Zabbix'),
        ),
      'la fila de la herramienta',
    )
    await tocar(fila)
    await esperar(() => textoPantalla().includes('Sistema de monitoreo de prueba.'), 'la definición')
    expect(textoPantalla()).toContain('¿Para qué sirve?')
    expect(textoPantalla()).toContain('Para ver si un equipo de prueba responde.')
    expect(textoPantalla()).toContain('Uso de prueba en la sede de ejemplo.')
    expect(textoPantalla()).toContain('Uso actual confirmado en Metroparques.')
    sigueLaMismaEjecucion(contador)

    await tocar(await esperarControl('Cerrar la vista rápida de "Zabbix"'))
    await tocar(await esperarControl('Cerrar el buscador'))
    sigueLaMismaEjecucion(contador)
  })

  it('un término del glosario abre su definición dentro de la capa', async () => {
    const contador = await ejecucionEnPasoTres()
    await abrirBuscadorDeLaGuia('vlan')
    const fila = await esperar(
      () =>
        Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find((boton) =>
          boton.textContent?.includes('VLAN'),
        ),
      'la fila del término',
    )
    await tocar(fila)
    await esperar(() => textoPantalla().includes('Red virtual de prueba dentro de un mismo switch.'), 'la definición')
    sigueLaMismaEjecucion(contador)
  })

  it('un comando se ve y se copia; un equipo se ve en compacto, con su IP', async () => {
    const contador = await ejecucionEnPasoTres()
    await abrirBuscadorDeLaGuia('ipconfig')
    const comando = await esperar(
      () =>
        Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find((boton) =>
          boton.textContent?.includes('Ver la configuración de red'),
        ),
      'la fila del comando',
    )
    await tocar(comando)
    await tocar(await esperarControl('Copiar comando'))
    await esperar(() => copiarMock.mock.calls.length > 0, 'la copia del comando')
    expect(copiarMock).toHaveBeenCalledWith('ipconfig /all')

    const campo = await esperar(campoBuscador, 'el campo del buscador')
    await escribir(campo, 'caja 4')
    const equipo = await esperar(
      () =>
        Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find((boton) =>
          boton.textContent?.includes('Caja 4 de prueba'),
        ),
      'la fila del equipo',
    )
    await tocar(equipo)
    await esperar(() => textoPantalla().includes('10.0.0.44'), 'la IP del equipo')
    expect(textoPantalla()).toContain('Taquilla de prueba')
    expect(textoPantalla()).toContain('Marca de prueba · Modelo X')
    expect(textoPantalla()).toContain('Operativo')
    sigueLaMismaEjecucion(contador)
  })
})
