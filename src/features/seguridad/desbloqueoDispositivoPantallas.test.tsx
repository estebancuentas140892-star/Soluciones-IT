// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cifrarTexto, derivarClave, nuevaSal } from '../../lib/crypto'
import { db, ID_BLOQUEO_APP, type MetodoBloqueoApp } from '../../lib/db'
import { AutenticadorFalso, instalarAutenticador, ORIGEN_PRUEBA } from '../../pruebas/autenticadorFalso'
import {
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  montar,
  pausa,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { AuthContext, type AuthContextValue } from '../autenticacion/authContext'
import { BloqueoAppGuard } from './BloqueoAppGuard'
import {
  bloquearApp,
  bloqueoAppDesbloqueado,
  completarDesbloqueoDispositivo,
  confirmarBloqueoActual,
  crearDesbloqueoDispositivo,
  restablecerBloqueoApp,
  TEXTO_VERIFICADOR_APP,
} from './bloqueoApp'
import { SeguridadPage } from './SeguridadPage'

// LO QUE SE VE DEL DESBLOQUEO DEL DISPOSITIVO (tarea 278): la opción solo
// aparece donde el dispositivo puede; activarla pide el código actual,
// crea la credencial y la comprueba antes de darla por activa; la
// pantalla de bloqueo la ofrece primero y deja el patrón o la contraseña
// a un toque; cancelar no la vuelve a abrir sola ni deja a nadie
// encerrado; y quitar el bloqueo se la lleva. La verificación
// criptográfica se prueba aparte (`desbloqueoDispositivo.test.ts`).
//
// Todo lo que se siembra es INVENTADO.

const CONTRASENA = 'clave-de-prueba'
const PATRON = [0, 1, 2, 5]

async function sembrarBloqueo(metodo: MetodoBloqueoApp, secreto: string) {
  const sal = nuevaSal()
  const clave = await derivarClave(secreto, sal, 1_000)
  await db.seguridadApp.put({
    id: ID_BLOQUEO_APP,
    metodo,
    verificador: await cifrarTexto(clave, sal, 1_000, TEXTO_VERIFICADOR_APP),
    minutosAutobloqueo: 5,
    bloqueadoHasta: null,
    updatedAt: '2026-09-29T12:00:00.000Z',
  })
}

async function activarPorCodigo(secreto: string) {
  expect(await confirmarBloqueoActual(secreto)).toBeNull()
  const creada = await crearDesbloqueoDispositivo()
  if (!creada.ok) throw new Error(creada.motivo)
  expect(await completarDesbloqueoDispositivo(creada.pendiente)).toBe('ok')
}

let autenticador: AutenticadorFalso
let raiz: Root | null = null

beforeEach(async () => {
  await restablecerBloqueoApp()
  await db.seguridadApp.clear()
  autenticador = new AutenticadorFalso({ origen: ORIGEN_PRUEBA })
})

afterEach(async () => {
  if (raiz) await act(async () => raiz!.unmount())
  raiz = null
  await desmontarTodo()
  vi.unstubAllGlobals()
})

/** La app detrás del guard, como en `App.tsx`. */
async function montarApp(cerrarSesion = vi.fn(async () => {})) {
  const contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
  await act(async () =>
    raiz!.render(
      createElement(
        AuthContext.Provider,
        { value: { cerrarSesion } as unknown as AuthContextValue },
        createElement(
          MemoryRouter,
          null,
          createElement(
            Routes,
            null,
            createElement(
              Route,
              { element: createElement(BloqueoAppGuard) },
              createElement(Route, { path: '/', element: createElement('p', null, 'contenido de la app') }),
            ),
          ),
        ),
      ),
    ),
  )
  await pausa()
  return cerrarSesion
}

function hay(texto: string): boolean {
  return textoPantalla().includes(texto)
}

/** Dibuja un patrón en la cuadrícula como lo haría un dedo. */
async function dibujarPatron(nodos: number[]) {
  const svg = await esperar(
    () => document.body.querySelector<SVGSVGElement>('svg[aria-label="Cuadrícula para dibujar el patrón"]'),
    'la cuadrícula del patrón',
  )
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300, x: 0, y: 0, toJSON: () => ({}) })
  const centro = (i: number) => ({ clientX: 50 + (i % 3) * 100, clientY: 50 + Math.floor(i / 3) * 100 })
  const [primero, ...resto] = nodos
  await act(async () => {
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, ...centro(primero) }))
  })
  for (const nodo of resto) {
    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, ...centro(nodo) }))
    })
  }
  await act(async () => {
    svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
  })
  await pausa()
}

describe('Seguridad de la aplicación', () => {
  it('sin soporte en el dispositivo no ofrece nada: una línea lo dice', async () => {
    instalarAutenticador(autenticador, { disponible: false })
    await sembrarBloqueo('contrasena', CONTRASENA)
    await montar([{ ruta: '/cuenta/seguridad', elemento: createElement(SeguridadPage) }], '/cuenta/seguridad')
    await esperar(() => hay('No disponible en este dispositivo.'), 'el estado')
    expect(control('Activar')).toBeNull()
    expect(control('Probar')).toBeNull()
    expect(hay('Soluciones IT no recibe datos biométricos')).toBe(false)
  })

  it('con soporte se activa en tres toques: código actual, crear, comprobar', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await montar([{ ruta: '/cuenta/seguridad', elemento: createElement(SeguridadPage) }], '/cuenta/seguridad')
    await esperar(() => hay('Desactivado.'), 'el estado')
    expect(hay('Soluciones IT no recibe datos biométricos')).toBe(true)

    await tocar(await esperarControl('Activar'))
    // Primero, el código actual; sin él no se crea nada.
    expect(autenticador.llamadas.create).toHaveLength(0)
    const campo = await esperar(() => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña"]'), 'el campo')
    await escribir(campo, 'otra-cosa')
    await enviarFormulario(campo)
    await esperar(() => hay('El código actual no es correcto.'), 'el error')
    expect(control('Activar en este dispositivo')).toBeNull()

    const campo2 = await esperar(() => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña"]'), 'el campo')
    await escribir(campo2, CONTRASENA)
    await enviarFormulario(campo2)
    await tocar(await esperarControl('Activar en este dispositivo'))
    expect(autenticador.llamadas.create).toHaveLength(1)
    // Creada pero sin comprobar: todavía no está activa.
    expect((await db.seguridadApp.get(ID_BLOQUEO_APP))?.desbloqueoDispositivo).toBeUndefined()

    await tocar(await esperarControl('Comprobar'))
    await esperar(() => hay('Activo en este dispositivo.'), 'queda activo')
    expect((await db.seguridadApp.get(ID_BLOQUEO_APP))?.desbloqueoDispositivo).toBeDefined()
    // Nada técnico a la vista.
    expect(textoPantalla()).not.toMatch(/credencial|clave pública|rpId|algoritmo|WebAuthn/i)
    expect(control('Probar')).not.toBeNull()
    expect(control('Desactivar')).not.toBeNull()
  })

  it('probar con la credencial borrada del dispositivo lo dice y ofrece registrarlo de nuevo', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    autenticador.olvidarTodo()
    await montar([{ ruta: '/cuenta/seguridad', elemento: createElement(SeguridadPage) }], '/cuenta/seguridad')
    await tocar(await esperarControl('Probar'))
    await esperar(() => hay('No se pudo usar el desbloqueo del dispositivo.'), 'el aviso')
    await tocar(await esperarControl('Registrar de nuevo'))
    await esperar(() => hay('Registrar de nuevo el desbloqueo del dispositivo'), 'el flujo')
    expect(hay('Escribe tu contraseña actual')).toBe(true)
  })

  it('quitar el bloqueo avisa y se lleva el desbloqueo del dispositivo', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    await montar([{ ruta: '/cuenta/seguridad', elemento: createElement(SeguridadPage) }], '/cuenta/seguridad')
    await tocar(await esperarControl('Quitar bloqueo'))
    await esperar(() => hay('También se desactiva el desbloqueo del dispositivo.'), 'el aviso')
    const campo = await esperar(() => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña"]'), 'el campo')
    await escribir(campo, CONTRASENA)
    await enviarFormulario(campo)
    await esperarQue(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) === undefined, 'se quita la fila')
  })

  it('desactivar deja el patrón o la contraseña como estaban', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    await montar([{ ruta: '/cuenta/seguridad', elemento: createElement(SeguridadPage) }], '/cuenta/seguridad')
    await tocar(await esperarControl('Desactivar'))
    await esperar(() => hay('Desactivado.'), 'queda desactivado')
    const fila = await db.seguridadApp.get(ID_BLOQUEO_APP)
    expect(fila?.metodo).toBe('contrasena')
    expect(fila?.desbloqueoDispositivo).toBeUndefined()
  })
})

describe('la pantalla de bloqueo', () => {
  it('con el desbloqueo del dispositivo: "Desbloquear" primero, la contraseña a un toque, y abre', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    bloquearApp()
    // La comprobación al activar ya usó una.
    const antes = autenticador.llamadas.get.length
    await montarApp()
    await esperar(() => hay('Desbloquea con este dispositivo'), 'la vía rápida')
    expect(control('Usar contraseña')).not.toBeNull()
    // El diálogo del sistema no se abre solo.
    await pausa(100)
    expect(autenticador.llamadas.get).toHaveLength(antes)

    await tocar(await esperarControl('Desbloquear'))
    await esperar(() => hay('contenido de la app'), 'la app abre')
    expect(bloqueoAppDesbloqueado()).toBe(true)
  })

  it('cancelar pasa a la contraseña con un aviso, sin volver a abrir el diálogo, y la contraseña entra', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    bloquearApp()
    await montarApp()
    autenticador.errorSiguiente = 'NotAllowedError'
    const antes = autenticador.llamadas.get.length
    await tocar(await esperarControl('Desbloquear'))
    await esperar(() => hay('No se pudo usar el desbloqueo del dispositivo.'), 'el aviso')
    expect(hay('Ingresa tu contraseña de desbloqueo')).toBe(true)
    expect(control('Usar el desbloqueo del dispositivo')).not.toBeNull()
    await pausa(150)
    expect(autenticador.llamadas.get.length - antes).toBe(1)

    const campo = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña de desbloqueo"]'),
      'el campo',
    )
    await escribir(campo, CONTRASENA)
    await enviarFormulario(campo)
    await esperar(() => hay('contenido de la app'), 'la app abre con la contraseña')
  })

  it('con patrón: tras cancelar, el patrón dibujado abre', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('patron', PATRON.join('-'))
    await activarPorCodigo(PATRON.join('-'))
    bloquearApp()
    await montarApp()
    expect(await esperarControl('Usar patrón')).not.toBeNull()
    autenticador.errorSiguiente = 'NotAllowedError'
    await tocar(await esperarControl('Desbloquear'))
    await esperar(() => hay('Dibuja tu patrón para continuar'), 'el patrón')
    await dibujarPatron(PATRON)
    await esperar(() => hay('contenido de la app'), 'la app abre con el patrón')
  })

  it('una respuesta que no verifica no abre: aviso y respaldo', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    bloquearApp()
    await montarApp()
    autenticador.alterarSiguiente = { sinUV: true }
    await tocar(await esperarControl('Desbloquear'))
    await esperar(() => hay('No se pudo usar el desbloqueo del dispositivo.'), 'el aviso')
    expect(hay('contenido de la app')).toBe(false)
    expect(bloqueoAppDesbloqueado()).toBe(false)
  })

  it('en un navegador que ya no lo permite, la pantalla es la de siempre', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    bloquearApp()
    vi.unstubAllGlobals()
    instalarAutenticador(autenticador, { disponible: false })
    await montarApp()
    await esperar(() => hay('Ingresa tu contraseña de desbloqueo'), 'la contraseña')
    expect(hay('Desbloquea con este dispositivo')).toBe(false)
    expect(control('Usar el desbloqueo del dispositivo')).toBeNull()
  })

  it('"Cerrar sesión y quitar el bloqueo" cierra la sesión primero (tarea 284) y se lleva el desbloqueo del dispositivo', async () => {
    instalarAutenticador(autenticador)
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activarPorCodigo(CONTRASENA)
    bloquearApp()
    let filaAlCerrar: unknown = null
    const cerrarSesion = vi.fn(async () => {
      filaAlCerrar = await db.seguridadApp.get(ID_BLOQUEO_APP)
    })
    await montarApp(cerrarSesion)
    await tocar(await esperarControl('¿Olvidaste tu código de desbloqueo?'))
    await tocar(await esperarControl('Cerrar sesión y quitar el bloqueo'))
    await esperarQue(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) === undefined, 'se quita el bloqueo')
    expect(cerrarSesion).toHaveBeenCalledOnce()
    expect(filaAlCerrar).toMatchObject({ desbloqueoDispositivo: expect.any(Object) })
    expect(bloqueoAppDesbloqueado()).toBe(false)
  })
})
