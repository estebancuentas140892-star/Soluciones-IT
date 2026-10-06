// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvisosBreves } from './AvisoBreve'
import { avisarBreve, DURACION_AVISO_BREVE_MS, retirarAvisoBreve } from './almacenAvisoBreve'
import { CargandoContenido, ESPERA_CARGANDO_MS } from './Cargando'
import { MarcaEstado } from './MarcaEstado'
import { MensajeError } from './MensajeError'
import { SinContenido } from './SinContenido'

// LOS CINCO ESTADOS GLOBALES (tarea 291, auditoría UX, S2 a S6): marca de
// estado, mensaje de error, sin contenido, cargando y aviso breve.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let contenedor: HTMLDivElement
let raiz: Root

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(() => {
  act(() => raiz.unmount())
  contenedor.remove()
  vi.useRealTimers()
  retirarAvisoBreve()
})

describe('MarcaEstado (S5)', () => {
  it('punto y texto: ámbar si requiere atención, gris si solo informa', () => {
    act(() =>
      raiz.render(
        <>
          <MarcaEstado tono="atencion">En mantenimiento</MarcaEstado>
          <MarcaEstado>Operativo</MarcaEstado>
        </>,
      ),
    )
    const [atencion, informacion] = contenedor.querySelectorAll<HTMLElement>(':scope > span')
    expect(atencion.textContent).toBe('En mantenimiento')
    expect(atencion.className).toContain('text-noct-precaucion')
    expect(informacion.className).toContain('text-noct-neutral-300')
    // El punto toma el color del texto: nunca es la única señal.
    expect(informacion.querySelector('span[aria-hidden]')!.className).toContain('bg-current')
  })
})

describe('MensajeError (S2)', () => {
  it('qué pasó, qué se conserva y qué hacer; rojo si bloquea', () => {
    act(() =>
      raiz.render(
        <MensajeError
          tono="bloqueo"
          titulo="No se pudo comprobar la contraseña maestra"
          conserva="No se ha borrado nada. Conéctate a internet e inténtalo de nuevo."
          accion={<button type="button">Reintentar ahora</button>}
        />,
      ),
    )
    const mensaje = contenedor.querySelector('[role="alert"]')!
    expect(mensaje.textContent).toContain('No se pudo comprobar la contraseña maestra')
    expect(mensaje.textContent).toContain('No se ha borrado nada.')
    expect(mensaje.textContent).toContain('Reintentar ahora')
    expect(mensaje.className).toContain('border-noct-error/40')
  })

  it('ámbar cuando el trabajo está a salvo, sin interrumpir al lector', () => {
    act(() =>
      raiz.render(
        <MensajeError
          tono="atencion"
          titulo="No se subieron 2 fotos"
          conserva="Siguen guardadas en este teléfono y se subirán al recuperar conexión."
        />,
      ),
    )
    expect(contenedor.querySelector('[role="alert"]')).toBeNull()
    expect(contenedor.querySelector('[role="status"]')!.className).toContain('border-noct-precaucion/40')
  })
})

describe('SinContenido (S4)', () => {
  it('sin permiso: lo dice y a quién pedirlo, sin botón', () => {
    act(() =>
      raiz.render(
        <SinContenido
          tipo="sin-permiso"
          titulo="No tienes acceso a la Bóveda"
          texto="Pídeselo a un administrador de Soluciones IT."
          accion={<button type="button">Pedir acceso</button>}
        />,
      ),
    )
    expect(contenedor.textContent).toContain('No tienes acceso a la Bóveda')
    expect(contenedor.querySelector('button')).toBeNull()
  })

  it('sin resultados: repite lo buscado y ofrece la salida', () => {
    act(() =>
      raiz.render(
        <SinContenido
          tipo="sin-resultados"
          titulo="Ningún equipo coincide con «ricoh 401»"
          texto="Busca por nombre, IP, lugar o serial."
          accion={<button type="button">Crear «ricoh 401»</button>}
        />,
      ),
    )
    expect(contenedor.querySelector('button')!.textContent).toBe('Crear «ricoh 401»')
    expect(contenedor.querySelector('svg')).not.toBeNull()
  })
})

describe('CargandoContenido (S3)', () => {
  it('nada durante 400 ms; después "Cargando…" en su sitio', () => {
    vi.useFakeTimers()
    act(() => raiz.render(<CargandoContenido />))
    expect(contenedor.textContent).toBe('')
    act(() => vi.advanceTimersByTime(ESPERA_CARGANDO_MS - 1))
    expect(contenedor.textContent).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(contenedor.textContent).toBe('Cargando…')
  })
})

describe('AvisoBreve (S6)', () => {
  it('una línea en una región viva, sin ×, que se va sola a los 4 s', () => {
    vi.useFakeTimers()
    act(() => raiz.render(<AvisosBreves />))
    const region = document.body.querySelector('[aria-live="polite"]')!
    expect(region.textContent).toBe('')

    act(() => avisarBreve({ texto: 'Impresora Bodega guardada · se subirá al recuperar señal' }))
    expect(region.textContent).toBe('Impresora Bodega guardada · se subirá al recuperar señal')
    expect(region.querySelector('button')).toBeNull()

    act(() => vi.advanceTimersByTime(DURACION_AVISO_BREVE_MS))
    expect(region.textContent).toBe('')
  })

  it('"Cambiar" o "Deshacer" solo si existen, y el nuevo sustituye al anterior', () => {
    act(() => raiz.render(<AvisosBreves />))
    const cambiar = vi.fn()
    act(() => avisarBreve({ texto: 'Asignado a Ana Gómez' }))
    act(() => avisarBreve({ texto: 'Asignado a Diana Ríos', accion: { texto: 'Cambiar', onClick: cambiar } }))
    const region = document.body.querySelector('[aria-live="polite"]')!
    expect(region.textContent).toBe('Asignado a Diana RíosCambiar')
    act(() => region.querySelector('button')!.click())
    expect(cambiar).toHaveBeenCalledTimes(1)
    expect(region.textContent).toBe('')
  })
})
