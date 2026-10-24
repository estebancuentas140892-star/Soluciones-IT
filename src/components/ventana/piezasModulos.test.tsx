// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FILAS_EN_TARJETA as FILAS_DE_MAS } from '../../features/mas/FilasMas'
import { OpcionRadio } from '../OpcionRadio'
import { PastillaEstado } from '../PastillaEstado'
import { DELINEADO_EN_TELEFONO, FILAS_EN_TARJETA, RELIEVE_EN_TELEFONO, TITULO_GRUPO_EN_TELEFONO } from './estilos'

// LAS PIEZAS DE «VENTANA» EN LOS MÓDULOS QUE EL TELÉFONO COMPARTE CON LA
// TABLETA Y EL ESCRITORIO (tarea 352: Agenda, Mantenimiento y Facturación).
//
// Lo que se fija: que cada pieza solo actúe por debajo de 768 px (todas sus
// clases llevan `max-md:`), que el estado tenga la misma forma que en la
// tarjeta de Equipos (tinte, sin borde, con su punto) y que las respuestas del
// cierre de un mantenimiento tengan la forma de las de una ventana.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let contenedor: HTMLDivElement
let raiz: Root

async function pintar(hijo: ReactNode) {
  await act(async () => {
    raiz.render(hijo)
  })
}

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(async () => {
  await act(async () => raiz.unmount())
  contenedor.remove()
})

describe('las piezas compartidas del teléfono', () => {
  it('solo actúan por debajo de 768 px', () => {
    for (const piezas of [FILAS_EN_TARJETA, RELIEVE_EN_TELEFONO, TITULO_GRUPO_EN_TELEFONO, DELINEADO_EN_TELEFONO]) {
      for (const clase of piezas.split(/\s+/)) expect(clase.startsWith('max-md:')).toBe(true)
    }
  })

  it('Más y la Agenda usan la misma tarjeta de filas', () => {
    expect(FILAS_DE_MAS).toBe(FILAS_EN_TARJETA)
  })
})

describe('la pastilla de estado con su punto', () => {
  it('en el teléfono toma el tinte de su estado, sin borde, como la tarjeta de Equipos', async () => {
    await pintar(
      <>
        <PastillaEstado tono="error" conPunto>
          Atrasado 3 días
        </PastillaEstado>
        <PastillaEstado tono="exito" conPunto>
          Confirmado
        </PastillaEstado>
      </>,
    )
    const [atrasado, confirmado] = Array.from(contenedor.children) as HTMLElement[]
    expect(atrasado.className).toContain('max-md:bg-noct-error-tinte')
    expect(atrasado.className).toContain('max-md:border-transparent')
    expect(confirmado.className).toContain('max-md:bg-noct-exito-tinte')
    // El punto sigue: el estado no se lee solo por el color.
    expect(atrasado.querySelector('[data-punto-estado]')).not.toBeNull()
    // Desde 768, el contorno de siempre.
    expect(atrasado.className).toContain('border-noct-error/45')
  })

  it('sin punto no cambia en ningún ancho', async () => {
    await pintar(<PastillaEstado tono="precaucion">Por validar</PastillaEstado>)
    expect((contenedor.firstElementChild as HTMLElement).className).not.toContain('max-md:bg-')
  })
})

describe('el segmento de una respuesta', () => {
  it('tiene la forma de una respuesta de la ventana: relieve sin elegir, acento elegida', async () => {
    await pintar(
      <div role="radiogroup" aria-label="¿Cómo terminó?">
        <OpcionRadio activa onClick={() => {}} segmento>
          Se hizo
        </OpcionRadio>
        <OpcionRadio activa={false} onClick={() => {}} segmento>
          Se pospone
        </OpcionRadio>
      </div>,
    )
    const [elegida, otra] = Array.from(contenedor.querySelectorAll<HTMLElement>('[role="radio"]'))
    expect(elegida.className).toContain('max-md:bg-noct-accent-900')
    expect(elegida.className).toContain('max-md:border-noct-accent')
    expect(otra.className).toContain('max-md:shadow-[0_4px_0_var(--color-noct-divider-fuerte)]')
    expect(otra.className).toContain('max-md:border-noct-divider-fuerte')
    for (const respuesta of [elegida, otra]) expect(respuesta.className).toContain('max-md:min-h-[52px]')
  })
})
