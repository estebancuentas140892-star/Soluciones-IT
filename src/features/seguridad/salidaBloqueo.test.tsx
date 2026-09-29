// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db, ID_BLOQUEO_APP } from '../../lib/db'
import { AuthContext, type AuthContextValue } from '../autenticacion/authContext'
import { BloqueoAppGuard } from './BloqueoAppGuard'
import { bloquearApp, configurarBloqueoApp } from './bloqueoApp'

// LA SALIDA DEL BLOQUEO OLVIDADO (tarea 284): "Cerrar sesión y quitar el
// bloqueo" cierra la sesión ANTES de quitar el bloqueo. Al revés, mientras
// la sesión se cerraba (unos segundos sin red) la app ya no tenía bloqueo
// y se veía entera sin el código.

let raiz: Root | null = null

afterEach(async () => {
  await act(async () => raiz?.unmount())
  raiz = null
  await db.seguridadApp.clear()
})

async function esperar(condicion: () => boolean | Promise<boolean>, que: string) {
  for (let i = 0; i < 100; i++) {
    if (await condicion()) return
    await act(async () => new Promise((r) => setTimeout(r, 20)))
  }
  throw new Error(`No llegó a pasar: ${que}`)
}

function boton(contenedor: HTMLElement, texto: string): HTMLButtonElement {
  const encontrado = [...contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))
  if (!encontrado) throw new Error(`No hay botón "${texto}"`)
  return encontrado
}

describe('Cerrar sesión y quitar el bloqueo', () => {
  it('cierra la sesión mientras el bloqueo sigue puesto, y después lo quita', async () => {
    await configurarBloqueoApp('contrasena', 'clave-de-prueba')
    bloquearApp()
    let bloqueoAlCerrar: boolean | null = null
    const cerrarSesion = vi.fn(async () => {
      bloqueoAlCerrar = (await db.seguridadApp.get(ID_BLOQUEO_APP)) !== undefined
    })
    const auth = { cerrarSesion } as unknown as AuthContextValue

    const contenedor = document.createElement('div')
    raiz = createRoot(contenedor)
    await act(async () =>
      raiz!.render(
        createElement(
          AuthContext.Provider,
          { value: auth },
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
    await esperar(() => contenedor.textContent?.includes('Ingresa tu contraseña de desbloqueo') ?? false, 'pide el código')

    await act(async () => boton(contenedor, '¿Olvidaste tu código').click())
    await act(async () => boton(contenedor, 'Cerrar sesión y quitar el bloqueo').click())
    await esperar(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) === undefined, 'se quita el bloqueo')

    expect(cerrarSesion).toHaveBeenCalledOnce()
    expect(bloqueoAlCerrar).toBe(true)
  })
})
