import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BTN_PRIMARIO, BTN_PRIMARIO_RELLENO } from './nocturne'

// Guarda del sistema visual del rediseño móvil "1b Pulgar" (tarea 327,
// AD-077, regla 30).
//
// Por qué existe: Tailwind no avisa de una utilidad cuyo color no existe.
// Si alguien vuelve a escribir `text-noct-accion` después de retirar el
// token, la clase no genera nada y el texto sale en el color heredado sin
// que falle el build. Y una fuente pedida a Google Fonts compila igual,
// pero rompe el modo sin conexión. Esta prueba lee los archivos como
// texto y lo comprueba.

const css = readFileSync('src/index.css', 'utf8').split('\r\n').join('\n')

function archivosFuente(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta)
    return /\.(ts|tsx|css)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

describe('tokens del rediseño móvil (tarea 327)', () => {
  it('el acento es el cian del icono y el texto sobre el relleno tiene su token', () => {
    expect(css).toMatch(/--color-noct-accent:\s*oklch\(0\.82 0\.11 200\);/)
    expect(css).toMatch(/--color-noct-accent-300:\s*oklch\(0\.87 0\.08 200\);/)
    expect(css).toMatch(/--color-noct-on-accent:\s*#08191e;/)
    expect(css).not.toContain('#9184d9;')
  })

  it('el azul de la acción se retiró y ningún archivo lo sigue usando', () => {
    expect(css).not.toMatch(/--color-noct-accion\s*:/)
    const conAccion = archivosFuente('src').filter((ruta) =>
      /(?:text|bg|border|fill|stroke|ring|outline|decoration)-noct-accion\b/.test(readFileSync(ruta, 'utf8')),
    )
    expect(conAccion).toEqual([])
  })

  it('el tipo "configuración" se aparta del acento', () => {
    expect(css).toMatch(/--color-noct-tipo-configuracion:\s*oklch\(0\.78 0\.1 175\);/)
  })
})

describe('IBM Plex Mono local (tarea 327)', () => {
  it('font-mono es IBM Plex Mono con la pila del sistema de respaldo', () => {
    expect(css).toMatch(/--font-mono:\s*'IBM Plex Mono', ui-monospace, Menlo, monospace;/)
  })

  it('los tres pesos se sirven desde el bundle, nunca desde la red', () => {
    for (const peso of [400, 500, 600]) {
      const archivo = `ibm-plex-mono-latin-${peso}-normal.woff2`
      expect(css).toContain(`url('./assets/${archivo}')`)
      expect(existsSync(join('src/assets', archivo))).toBe(true)
    }
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})

describe('BTN_PRIMARIO_RELLENO (regla 30)', () => {
  it('es un relleno de acento con su texto propio y el alto del pulgar', () => {
    const clases = BTN_PRIMARIO_RELLENO.split(/\s+/)
    expect(clases).toContain('bg-noct-accent')
    expect(clases).toContain('text-noct-on-accent')
    expect(clases).toContain('min-h-[54px]')
    expect(clases).toContain('rounded-[15px]')
  })

  it('el primario de siempre sigue delineado, sin relleno', () => {
    expect(BTN_PRIMARIO.split(/\s+/)).not.toContain('bg-noct-accent')
  })
})
