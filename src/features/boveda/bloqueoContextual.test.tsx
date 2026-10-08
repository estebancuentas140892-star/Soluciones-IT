// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type PasoProcedimiento, type VinculoProtegido } from '../../lib/db'
import {
  anclarMaestra,
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
  pausa,
  sembrarCredencial,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { ArticuloForm } from '../soluciones/ArticuloForm'
import { GuiaPage } from '../soluciones/GuiaPage'
import { CredencialEnPaso } from './CredencialEnPaso'
import { bloquear, bovedaDesbloqueada, descifrarCredencial, obtenerMinutosAutobloqueo } from './sesionBoveda'

// BLOQUEAR LA BÓVEDA DESDE UNA CREDENCIAL CONTEXTUAL (tarea 312, AD-073,
// RN-071, regla 29), con las pantallas de verdad.
//
// Si se puede desbloquear y consultar la Bóveda desde el punto donde se
// trabaja (la credencial de una acción), también se puede volver a
// bloquear desde ahí: "Bloquear Bóveda", con la Bóveda abierta, llama al
// `bloquear()` central y cierra TODA la sesión del dispositivo. Lo
// descifrado desaparece en el acto, el bloque se queda en la guía, la
// acción no se completa y no se navega a ninguna parte. "Ocultar" solo
// pliega ese dato.
//
// Todo es inventado: ni usuarios, ni contraseñas, ni equipos reales.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>DETALLES DE LA GUÍA</p> },
  { ruta: '/boveda/:credencialId', elemento: <p>FICHA DE LA CREDENCIAL</p> },
  { ruta: '/boveda', elemento: <p>SECCIÓN BÓVEDA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]
const RUTA = '/soluciones/cat-pruebas/guia-boveda'
const ACCION = 'Conéctate al servidor de prueba'
const USUARIO = 'usuario.falso.remoto'
const CLAVE = 'Clave-Falsa-Remota-777'
const USUARIO_2 = 'usuario.falso.segundo'
const CLAVE_2 = 'Clave-Falsa-Segunda-888'
const FIJA: VinculoProtegido = { tipo: 'credencial', id: 'cred-remota', titulo: 'Acceso de prueba a escritorio remoto' }

/** Una guía cuya acción pide la credencial dada; una segunda acción, sin ella. */
function pasoConCredencial(vinculo: VinculoProtegido = FIJA): PasoProcedimiento {
  const paso = pasoPrueba('bv-p1', 'Conectarse al servidor de prueba', [ACCION, 'Abre la carpeta de prueba'])
  paso.bloques[0] = { ...paso.bloques[0], vinculoProtegido: vinculo }
  return paso
}

/** El perfil con permiso, la maestra anclada y la credencial cifrada; la Bóveda queda BLOQUEADA. */
async function sembrarBoveda(): Promise<void> {
  await sembrarPerfil(true)
  await anclarMaestra()
  await sembrarCredencial({ id: 'cred-remota', titulo: 'Acceso de prueba a escritorio remoto', tipo: 'cuenta', usuario: USUARIO, contrasena: CLAVE })
  bloquear()
}

async function sembrarGuiaConCredencial(vinculo: VinculoProtegido = FIJA): Promise<void> {
  await sembrarGuia({ id: 'guia-boveda', titulo: 'Respaldar un servidor de prueba', pasos: [pasoConCredencial(vinculo)] })
}

/** La fila del dato protegido (su "Mostrar" / "Ocultar"). */
function fila(nombre = 'Acceso de prueba a escritorio remoto'): HTMLElement | null {
  return control(`Dato protegido: ${nombre}`)
}

function botonBloquear(): HTMLElement | null {
  return control('Bloquear Bóveda')
}

/** Desbloquea con la contraseña maestra en el formulario en línea de la guía. */
async function desbloquearEnLinea(): Promise<void> {
  const campo = await esperar(
    () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
    'el campo de la contraseña maestra',
  )
  await escribir(campo, MAESTRA_PRUEBA)
  await enviarFormulario(campo)
}

/** Abre la credencial, desbloquea en línea y enseña también la contraseña. */
async function abrirYDesbloquear(nombre?: string): Promise<void> {
  await tocar(await esperar(() => fila(nombre), 'la fila del dato protegido'))
  await desbloquearEnLinea()
  await esperar(() => textoPantalla().includes(USUARIO), 'el usuario descifrado')
  await tocar(await esperarControl('Mostrar Contraseña'))
  await esperar(() => textoPantalla().includes(CLAVE), 'la contraseña descifrada')
}

/** Ningún secreto en el documento: ni en el texto ni en ningún atributo. */
function sinSecretos(...secretos: string[]): void {
  const html = document.body.innerHTML
  for (const secreto of secretos) expect(html).not.toContain(secreto)
}

const accesos = () => db.accesos_boveda.toArray()

beforeEach(async () => {
  await limpiarBase()
  await db.accesos_boveda.clear()
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

describe('cuándo aparece', () => {
  it('con la Bóveda bloqueada no aparece "Bloquear Bóveda": sigue el desbloqueo de siempre', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await esperar(() => fila(), 'la credencial de la acción')
    expect(botonBloquear()).toBeNull()
    expect(textoPantalla()).not.toContain('Bóveda abierta en este dispositivo')
    await tocar(fila() as HTMLElement)
    await esperar(() => textoPantalla().includes('La bóveda está bloqueada'), 'el desbloqueo en línea')
    expect(botonBloquear()).toBeNull()
  })

  it('al desbloquear desde la credencial: aparecen los datos y "Bloquear Bóveda"', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    expect(bovedaDesbloqueada()).toBe(true)
    expect(botonBloquear()).not.toBeNull()
    expect(textoPantalla()).toContain('Bóveda abierta en este dispositivo')
  })

  it('con la Bóveda ya abierta, aparece aunque la credencial esté plegada', async () => {
    await sembrarBoveda()
    await anclarMaestra()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await esperar(() => fila(), 'la credencial')
    expect(fila()?.getAttribute('aria-expanded')).toBe('false')
    expect(botonBloquear()).not.toBeNull()
    sinSecretos(USUARIO, CLAVE)
  })

  it('sin permiso de Bóveda: ni el control ni secretos, aunque la sesión del dispositivo esté abierta', async () => {
    await sembrarBoveda()
    await sembrarPerfil(false)
    await anclarMaestra()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await esperar(() => fila('Acceso de prueba a escritorio remoto'), 'la credencial')
    expect(botonBloquear()).toBeNull()
    await tocar(fila() as HTMLElement)
    await esperar(() => textoPantalla().includes('Solo los usuarios autorizados'), 'el aviso sin permiso')
    expect(botonBloquear()).toBeNull()
    sinSecretos(USUARIO, CLAVE)
  })
})

describe('qué hace "Bloquear Bóveda"', () => {
  it('bloquea de verdad toda la sesión: lo descifrado desaparece del DOM y la guía sigue donde estaba', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    const credencial = await db.credenciales.get('cred-remota')
    const ruta = ubicacionActual().pathname
    const avanceAntes = await db.progresoPasos.get('guia-boveda')

    await tocar(botonBloquear() as HTMLElement)

    // El bloqueo central: la sesión cerrada y las claves fuera de memoria
    // (lo cifrado ya no se puede descifrar).
    expect(bovedaDesbloqueada()).toBe(false)
    expect(await descifrarCredencial(credencial?.datosCifrados ?? '')).toBeNull()
    // Ningún valor descifrado queda en el documento.
    await esperar(() => !document.body.innerHTML.includes(USUARIO), 'los datos fuera de la pantalla')
    sinSecretos(USUARIO, CLAVE)
    // El bloque se queda, plegado; el control se va.
    expect(fila()?.getAttribute('aria-expanded')).toBe('false')
    expect(botonBloquear()).toBeNull()
    // La guía no cambió: misma pantalla, misma acción, sin completar nada.
    expect(ubicacionActual().pathname).toBe(ruta)
    expect(document.body.querySelector('h2[data-foco-lectura]')?.textContent).toBe(ACCION)
    expect(control('Completar y seguir')).not.toBeNull()
    await pausa(100)
    expect(await db.progresoPasos.get('guia-boveda')).toEqual(avanceAntes)
  })

  it('volver a tocar "Mostrar" pide otra vez la contraseña maestra', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    await tocar(botonBloquear() as HTMLElement)
    await tocar(await esperar(() => fila(), 'la fila'))
    await esperar(() => textoPantalla().includes('La bóveda está bloqueada'), 'otra vez el desbloqueo en línea')
    expect(document.body.querySelector('input[placeholder="Contraseña maestra"]')).not.toBeNull()
    sinSecretos(USUARIO, CLAVE)
    // Y desbloquear de nuevo vuelve a funcionar (con su autobloqueo de siempre).
    await desbloquearEnLinea()
    await esperar(() => textoPantalla().includes(USUARIO), 'el usuario otra vez')
    expect(botonBloquear()).not.toBeNull()
  })

  it('no es una consulta: no registra ningún acceso', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    await esperarQue(async () => (await accesos()).length === 2, 'la consulta y el "mostró"')
    // Las filas no salen en un orden fijo: se comparan ordenadas.
    const acciones = async () => (await accesos()).map((a) => a.accion).sort()
    const antes = await acciones()
    await tocar(botonBloquear() as HTMLElement)
    await pausa(150)
    expect(await acciones()).toEqual(antes)
    expect(antes).toEqual(['consulto', 'mostro'])
  })

  it('"Ocultar" solo pliega ese dato: la Bóveda sigue abierta y "Mostrar" no pide nada', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    await tocar(fila() as HTMLElement)
    await esperar(() => !textoPantalla().includes(USUARIO), 'el dato plegado')
    expect(bovedaDesbloqueada()).toBe(true)
    expect(botonBloquear()).not.toBeNull()
    await tocar(fila() as HTMLElement)
    await esperar(() => textoPantalla().includes(USUARIO), 'el dato otra vez, sin contraseña')
    expect(document.body.querySelector('input[placeholder="Contraseña maestra"]')).toBeNull()
  })

  it('dos credenciales abiertas: bloquear desde una cierra las dos', async () => {
    await sembrarBoveda()
    await anclarMaestra()
    await sembrarCredencial({ id: 'cred-segunda', titulo: 'Acceso de prueba al panel', tipo: 'cuenta', usuario: USUARIO_2, contrasena: CLAVE_2 })
    bloquear()
    await montar(
      [
        {
          ruta: '/dos',
          elemento: (
            <>
              <CredencialEnPaso vinculo={FIJA} variante="bloque" />
              <CredencialEnPaso vinculo={{ tipo: 'credencial', id: 'cred-segunda', titulo: 'Acceso de prueba al panel' }} variante="bloque" />
            </>
          ),
        },
      ],
      '/dos',
    )
    await abrirYDesbloquear()
    await tocar(await esperar(() => fila('Acceso de prueba al panel'), 'la segunda credencial'))
    await esperar(() => textoPantalla().includes(USUARIO_2), 'la segunda, abierta sin pedir nada')
    // Un "Bloquear Bóveda" por bloque: cualquiera cierra toda la sesión.
    const botones = Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Bloquear Bóveda')
    expect(botones).toHaveLength(2)
    await tocar(botones[0])
    await esperar(() => !document.body.innerHTML.includes(USUARIO_2), 'la segunda también, sin datos')
    sinSecretos(USUARIO, CLAVE, USUARIO_2, CLAVE_2)
    expect(bovedaDesbloqueada()).toBe(false)
    expect(botonBloquear()).toBeNull()
    // La otra, que seguía abierta, ya solo ofrece desbloquear.
    expect(textoPantalla()).toContain('La bóveda está bloqueada')
  })

  it('sin conexión también bloquea: es una operación local de memoria', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    try {
      await sembrarBoveda()
      await sembrarGuiaConCredencial()
      await montar(RUTAS, RUTA)
      await abrirYDesbloquear()
      vi.stubGlobal('fetch', red)
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await tocar(botonBloquear() as HTMLElement)
      expect(bovedaDesbloqueada()).toBe(false)
      await esperar(() => !document.body.innerHTML.includes(USUARIO), 'los datos fuera, sin red')
      expect(red).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})

describe('sin regresión del autobloqueo', () => {
  it('bloquear desde la guía quita el temporizador, y desbloquear otra vez lo vuelve a programar con el bloqueo central', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    const programar = vi.spyOn(globalThis, 'setTimeout')
    const cancelar = vi.spyOn(globalThis, 'clearTimeout')
    try {
      await tocar(botonBloquear() as HTMLElement)
      // Al bloquear, el autobloqueo se desinstala (su temporizador, cancelado).
      expect(cancelar).toHaveBeenCalled()
      programar.mockClear()
      await tocar(await esperar(() => fila(), 'la fila'))
      await desbloquearEnLinea()
      await esperar(() => textoPantalla().includes(USUARIO), 'el usuario otra vez')
      // Y al volver a desbloquear se programa el de siempre: el mismo bloqueo, a sus minutos.
      expect(programar).toHaveBeenCalledWith(bloquear, obtenerMinutosAutobloqueo() * 60_000)
    } finally {
      programar.mockRestore()
      cancelar.mockRestore()
    }
  })
})

describe('accesible', () => {
  it('un botón con su nombre, su descripción y 44 px; el foco vuelve al "Mostrar" de su credencial', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await abrirYDesbloquear()
    const boton = botonBloquear() as HTMLButtonElement
    expect(boton.tagName).toBe('BUTTON')
    expect(boton.getAttribute('type')).toBe('button')
    expect(boton.textContent?.trim()).toBe('Bloquear Bóveda')
    // El icono no se lee; el nombre lo dice todo, y la descripción, el alcance.
    expect(Array.from(boton.querySelectorAll('svg')).every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(document.getElementById(boton.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Cierra toda la Bóveda en este dispositivo. Para plegar solo este dato, usa Ocultar.',
    )
    expect(boton.className).toContain('min-h-11')

    boton.focus()
    await tocar(boton)
    await esperar(() => document.activeElement === fila(), 'el foco en el "Mostrar" de la credencial')
  })
})

describe('la credencial del equipo con el que se trabaja', () => {
  it('se bloquea igual: los datos del equipo desaparecen y "Mostrar" pide otra vez la contraseña', async () => {
    await sembrarPerfil(true)
    await anclarMaestra()
    await sembrarEquipo({ id: 'srv-prueba', nombre: 'Servidor de prueba de respaldos', ubicacion: 'Cuarto de prueba' })
    await sembrarCredencial({
      id: 'cred-del-equipo',
      titulo: 'Acceso de prueba del servidor',
      tipo: 'cuenta',
      usuario: USUARIO,
      contrasena: CLAVE,
      dispositivos: [{ id: 'srv-prueba', nombre: 'Servidor de prueba de respaldos' }],
    })
    bloquear()
    await sembrarGuiaConCredencial({ tipo: 'equipo', finalidad: '', titulo: 'Credencial del equipo' })
    await montar(RUTAS, `${RUTA}?equipo=srv-prueba`)
    await abrirYDesbloquear('Acceso de prueba del servidor')
    expect(textoPantalla()).toContain('Equipo: Servidor de prueba de respaldos')

    await tocar(botonBloquear() as HTMLElement)
    expect(bovedaDesbloqueada()).toBe(false)
    await esperar(() => !document.body.innerHTML.includes(USUARIO), 'los datos del equipo fuera')
    sinSecretos(USUARIO, CLAVE)
    // Sigue diciendo de qué equipo es, sin abrir nada.
    expect(textoPantalla()).toContain('Equipo: Servidor de prueba de respaldos')
    await tocar(await esperar(() => fila('Acceso de prueba del servidor'), 'la fila'))
    await esperar(() => textoPantalla().includes('La bóveda está bloqueada'), 'otra vez el desbloqueo')
  })
})

describe('en todas las vistas que la enseñan', () => {
  it('en el paso entero', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, RUTA)
    await esperar(() => fila(), 'la credencial')
    await tocar(await esperarControl(/^Paso 1 de 1\. Abrir el índice de pasos$/))
    await tocar(await esperarControl(/^Ver el paso entero$/))
    await esperar(() => document.body.querySelector('button[role="checkbox"]'), 'la vista de paso entero')
    await abrirYDesbloquear()
    await tocar(botonBloquear() as HTMLElement)
    await esperar(() => !document.body.innerHTML.includes(USUARIO), 'los datos fuera')
    sinSecretos(USUARIO, CLAVE)
    expect(document.body.querySelector('button[role="checkbox"]')).not.toBeNull()
  })

  it('en "Probar" desde el editor', async () => {
    await sembrarBoveda()
    await sembrarGuiaConCredencial()
    await montar(RUTAS, `${RUTA}/editar`)
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(/^Conectarse al servidor de prueba/)
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await tocar(await esperarControl(/^Probar$/))
    await tocar(await esperarControl(/^Ver como técnico$/))
    await esperar(() => textoPantalla().includes('Como lo ve el técnico') && fila() !== null, 'la credencial en "Probar"')
    await abrirYDesbloquear()
    await tocar(botonBloquear() as HTMLElement)
    expect(bovedaDesbloqueada()).toBe(false)
    await esperar(() => !document.body.innerHTML.includes(USUARIO), 'los datos fuera')
    sinSecretos(USUARIO, CLAVE)
    expect(textoPantalla()).toContain('Como lo ve el técnico')
  })

  it('dentro de una guía reutilizada, en el sitio', async () => {
    await sembrarBoveda()
    await sembrarGuia({ id: 'guia-reutilizada', titulo: 'Conectarse al servidor de prueba', pasos: [pasoConCredencial()] })
    await sembrarGuia({
      id: 'guia-boveda',
      titulo: 'Respaldar un servidor de prueba',
      pasos: [
        { ...pasoPrueba('rb-p1', 'Conectarse', []), subArticuloId: 'guia-reutilizada', subArticuloTitulo: 'Conectarse al servidor de prueba' },
        pasoPrueba('rb-p2', 'Copiar', ['Copia el respaldo de prueba']),
      ],
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción reutilizada')
    await abrirYDesbloquear()
    await tocar(botonBloquear() as HTMLElement)
    expect(bovedaDesbloqueada()).toBe(false)
    await esperar(() => !document.body.innerHTML.includes(USUARIO), 'los datos fuera')
    sinSecretos(USUARIO, CLAVE)
    expect(textoPantalla()).toContain(ACCION)
    expect(ubicacionActual().pathname).toBe(RUTA)
  })
})
