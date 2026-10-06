// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Boton } from './Boton'
import { claseBoton, type PapelBoton, type TamanoBoton } from './claseBoton'

// EL BOTÓN ÚNICO (tarea 291, auditoría UX, T1 a T4 y P1): cuatro papeles,
// tres tamaños, nunca menos de 44 de área y la carga dentro del botón con
// el mismo ancho.

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
})

function clases(texto: string): string[] {
  return texto.split(/\s+/).filter(Boolean)
}

// Las utilidades de alto, ancho, radio y tamaño de letra sin variante: si
// una clase base trajera dos de la misma propiedad, ganaría la que
// Tailwind emite después y no la que se quiso (COMPONENTES_UI.md, 0).
function propiedadesBase(texto: string): string[] {
  return clases(texto)
    .filter((clase) => !clase.includes(':'))
    .map((clase): string | null => {
      if (/^min-h-/.test(clase)) return 'min-height'
      if (/^h-/.test(clase)) return 'height'
      if (/^w-/.test(clase)) return 'width'
      if (/^rounded/.test(clase)) return 'radius'
      if (/^text-(\[\d|xs|sm|base)/.test(clase)) return 'font-size'
      if (/^text-noct-/.test(clase)) return 'color'
      if (/^bg-/.test(clase)) return 'background'
      if (/^border-noct-|^border-transparent/.test(clase)) return 'border-color'
      return null
    })
    .filter((propiedad): propiedad is string => propiedad !== null)
}

describe('claseBoton', () => {
  const papeles: PapelBoton[] = ['principal', 'secundario', 'texto', 'destructivo']
  const tamanos: TamanoBoton[] = [64, 52, 44]

  it('arma cada papel y tamaño sin dos utilidades base de la misma propiedad', () => {
    for (const papel of papeles) {
      for (const tamano of tamanos) {
        for (const soloIcono of [false, true] as const) {
          const propiedades = propiedadesBase(claseBoton({ papel, tamano, soloIcono }))
          expect(new Set(propiedades).size, `${papel} ${tamano} ${soloIcono}`).toBe(propiedades.length)
        }
      }
    }
  })

  it('nunca baja de 44 px de área', () => {
    for (const papel of papeles) {
      expect(clases(claseBoton({ papel }))).toContain('min-h-11')
      expect(clases(claseBoton({ papel, tamano: 52 }))).toContain('min-h-[52px]')
      expect(clases(claseBoton({ papel, tamano: 64 }))).toContain('min-h-16')
      expect(clases(claseBoton({ papel, soloIcono: true }))).toEqual(expect.arrayContaining(['h-11', 'w-11']))
    }
  })

  it('el de 52 pasa a 44 en escritorio y el de 64 lleva peso 600', () => {
    expect(clases(claseBoton({ papel: 'principal', tamano: 52 }))).toEqual(
      expect.arrayContaining(['md:min-h-11', 'md:rounded-lg', 'md:text-sm']),
    )
    expect(clases(claseBoton({ papel: 'principal', tamano: 64 }))).toEqual(
      expect.arrayContaining(['text-[17px]', 'font-semibold', 'rounded-xl']),
    )
  })

  it('el principal va delineado en acento con fondo tenue y el destructivo en rojo', () => {
    expect(clases(claseBoton({ papel: 'principal' }))).toEqual(
      expect.arrayContaining(['border-noct-accent', 'bg-noct-accent/[.12]', 'text-noct-accent-300']),
    )
    expect(clases(claseBoton({ papel: 'destructivo' }))).toEqual(
      expect.arrayContaining(['border-noct-error', 'text-noct-error']),
    )
    expect(clases(claseBoton({ papel: 'texto', tono: 'descarte' }))).toContain('text-noct-neutral-300')
    expect(clases(claseBoton({ papel: 'texto' }))).toContain('text-noct-accent-300')
  })

  it('desactivado al 45 %, y cargando legible al 80 %', () => {
    expect(clases(claseBoton({ papel: 'principal' }))).toContain('disabled:opacity-45')
    const cargando = clases(claseBoton({ papel: 'principal', cargando: true }))
    expect(cargando).toContain('opacity-80')
    expect(cargando).not.toContain('disabled:opacity-45')
  })

  it('junto a un campo, el botón de icono mide lo que el campo', () => {
    expect(clases(claseBoton({ papel: 'secundario', soloIcono: 'campo' }))).toEqual(
      expect.arrayContaining(['h-[46px]', 'w-[46px]']),
    )
  })
})

describe('Boton', () => {
  it('es de tipo button salvo que se diga otro', () => {
    act(() => raiz.render(<Boton papel="principal">Guardar equipo</Boton>))
    const boton = contenedor.querySelector('button')!
    expect(boton.type).toBe('button')
    expect(boton.textContent).toBe('Guardar equipo')
  })

  it('cargando: inactivo, ocupado y con el gerundio, sin cambiar de ancho', () => {
    act(() =>
      raiz.render(
        <Boton papel="principal" tamano={52} textoCargando="Guardando…">
          Guardar equipo
        </Boton>,
      ),
    )
    const boton = contenedor.querySelector('button')!
    // El texto de carga ya ocupa su sitio, sin verse ni leerse: va en un
    // pseudoelemento invisible de la misma celda, no en el texto del botón.
    const rejilla = boton.querySelector<HTMLElement>('[data-reserva]')!
    expect(rejilla.dataset.reserva).toBe('Guardando…')
    expect(rejilla.className).toContain('after:invisible')
    expect(boton.textContent).toBe('Guardar equipo')
    expect(boton.disabled).toBe(false)

    act(() =>
      raiz.render(
        <Boton papel="principal" tamano={52} textoCargando="Guardando…" cargando>
          Guardar equipo
        </Boton>,
      ),
    )
    expect(boton.disabled).toBe(true)
    expect(boton.getAttribute('aria-busy')).toBe('true')
    expect(boton.textContent).toBe('Guardando…')
    // Y ahora el que guarda el sitio es el texto de siempre.
    expect(boton.querySelector<HTMLElement>('[data-reserva]')!.dataset.reserva).toBe('Guardar equipo')
  })

  it('solo icono: el icono es el contenido y el nombre va en aria-label', () => {
    act(() =>
      raiz.render(<Boton papel="texto" soloIcono aria-label="Cerrar" icono={<svg data-icono />} />),
    )
    const boton = contenedor.querySelector('button')!
    expect(boton.getAttribute('aria-label')).toBe('Cerrar')
    expect(boton.querySelector('[data-icono]')).not.toBeNull()
    expect(boton.className).toContain('h-11')
  })
})
