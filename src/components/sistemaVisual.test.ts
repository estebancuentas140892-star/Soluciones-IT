import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BTN_PRIMARIO, BTN_PRIMARIO_RELLENO } from './nocturne'

// Guarda del sistema visual del rediseño móvil "1b Pulgar" (tarea 327,
// AD-077, regla 30).
//
// Por qué existe: Tailwind no avisa de una utilidad cuyo color no existe
// ni de una que pinta en el ancho equivocado. Si alguien escribe
// `text-noct-accion` sin `md:`, el azul de escritorio entra al teléfono sin
// que falle el build; si un token del rediseño vuelve al @theme, cambia el
// escritorio (tarea 338). Y una fuente pedida a Google Fonts compila igual,
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

// Desde la tarea 338 (AD-087) el rediseño es SOLO móvil: el @theme lleva los
// valores de tableta y escritorio (los de antes del rediseño, 06be087) y el
// bloque `@media (width < 48rem) { :root { ... } }` los del teléfono.
function variables(bloque: string): Map<string, string> {
  return new Map([...bloque.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}
const inicioTheme = css.indexOf('@theme {')
const theme = variables(css.slice(inicioTheme, css.indexOf('\n}', inicioTheme)))
const inicioTelefono = css.indexOf('@media (width < 48rem) {\n  :root {')
const telefono = variables(css.slice(inicioTelefono, css.indexOf('\n  }', inicioTelefono)))

describe('el rediseño "1b Pulgar" es solo móvil (tarea 338)', () => {
  it('desde 768 px el acento y su rampa son los de antes del rediseño (06be087)', () => {
    expect(theme.get('--color-noct-accent')).toBe('#9184d9')
    expect(['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((p) => theme.get(`--color-noct-accent-${p}`))).toEqual([
      '#f5f4ff', '#e7e5fe', '#d2cefd', '#b5abfc', '#968ae0', '#796cbf', '#5d5294', '#423a6a', '#2b2741',
    ])
  })

  it('desde 768 px font-mono es la pila del sistema de Tailwind (el @theme no la redefine)', () => {
    expect(theme.has('--font-mono')).toBe(false)
  })

  it('desde 768 px el tipo configuración (195) y la categoría 6 (200) conservan su matiz', () => {
    expect(theme.get('--color-noct-tipo-configuracion')).toBe('oklch(0.78 0.1 195)')
    expect(theme.get('--color-noct-cat-6')).toBe('oklch(0.75 0.11 200)')
  })

  it('el bloque del teléfono solo reescribe variables que existen en el @theme o font-mono', () => {
    expect(inicioTelefono).toBeGreaterThan(inicioTheme)
    for (const nombre of telefono.keys()) expect(nombre === '--font-mono' || theme.has(nombre), nombre).toBe(true)
  })
})

describe('tokens del rediseño móvil (tarea 327), en el teléfono', () => {
  it('el acento es el cian del icono y el texto sobre el relleno tiene su token', () => {
    expect(telefono.get('--color-noct-accent')).toBe('oklch(0.82 0.11 200)')
    expect(telefono.get('--color-noct-accent-300')).toBe('oklch(0.87 0.08 200)')
    expect(theme.get('--color-noct-on-accent')).toBe('#08191e')
  })

  it('el azul de la acción solo existe desde 768 px: cada uso lleva `md:` (tarea 338)', () => {
    expect(theme.get('--color-noct-accion')).toBe('oklch(0.76 0.12 240)')
    expect(telefono.has('--color-noct-accion')).toBe(false)
    const sinMd = archivosFuente('src').filter((ruta) =>
      /(?<![\w:-])(?:text|bg|border|fill|stroke|ring|outline|decoration)-noct-accion\b/.test(readFileSync(ruta, 'utf8')),
    )
    expect(sinMd).toEqual([])
  })

  it('el tipo "configuración" se aparta del acento y la categoría 6 pasa a lima (tarea 334)', () => {
    expect(telefono.get('--color-noct-tipo-configuracion')).toBe('oklch(0.78 0.1 175)')
    expect(telefono.get('--color-noct-cat-6')).toBe('oklch(0.75 0.11 118)')
  })
})

describe('IBM Plex Mono local (tarea 327)', () => {
  it('en el teléfono font-mono es IBM Plex Mono con la pila del sistema de respaldo', () => {
    expect(telefono.get('--font-mono')).toBe("'IBM Plex Mono', ui-monospace, Menlo, monospace")
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

  it('el relleno es solo del teléfono: desde 768 px vuelve delineado en el acento (tarea 338)', () => {
    const clases = BTN_PRIMARIO_RELLENO.split(/\s+/)
    expect(clases).toEqual(
      expect.arrayContaining([
        'md:border-noct-accent',
        'md:bg-noct-accent/[.12]',
        'md:text-noct-accent-300',
        'md:hover:bg-noct-accent/[.18]',
        'md:active:bg-noct-accent/25',
      ]),
    )
    expect(clases.filter((c) => c.startsWith('md:bg-') && !c.includes('/'))).toEqual([])
  })
})

describe('el tema claro (tarea 333)', () => {
  // Cada token de color del tema oscuro (@theme) tiene su valor claro: uno
  // olvidado se vería oscuro sobre fondo claro sin que nada fallara.
  function tokensDe(bloque: string): string[] {
    return [...bloque.matchAll(/(--color-noct-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort()
  }
  const inicioTema = css.indexOf('@theme {')
  const tema = css.slice(inicioTema, css.indexOf('\n}', inicioTema))
  const inicioClaro = css.indexOf(":root[data-tema='claro'] {")
  const claro = css.slice(inicioClaro, css.indexOf('\n}', inicioClaro))

  it('redefine todos los tokens de color, y ninguno de más (salvo noct-accion, que solo vale desde 768)', () => {
    expect(inicioClaro).toBeGreaterThan(0)
    expect(tokensDe(tema).length).toBeGreaterThan(30)
    expect(tokensDe(claro)).toEqual(tokensDe(tema).filter((t) => t !== '--color-noct-accion'))
  })

  it('solo pinta en el teléfono: vive dentro de @media (width < 48rem) (tarea 338)', () => {
    const antes = css.slice(0, inicioClaro)
    expect(antes.trimEnd().endsWith('@media (width < 48rem) {')).toBe(true)
  })

  it('el script que lo pone antes de pintar existe, carga desde el head y usa la misma clave y colores', async () => {
    const html = readFileSync('index.html', 'utf8')
    const script = readFileSync('public/tema.js', 'utf8')
    expect(html.indexOf('<script src="/tema.js"></script>')).toBeGreaterThan(0)
    expect(html.indexOf('<script src="/tema.js"></script>')).toBeLessThan(html.indexOf('</head>'))
    const { CLAVE_TEMA, COLOR_BARRA } = await import('../lib/tema')
    expect(script).toContain(`'${CLAVE_TEMA}'`)
    expect(script).toContain(`'${COLOR_BARRA.claro}'`)
    expect(script).toContain(`'${COLOR_BARRA.oscuro}'`)
    expect(html).toContain(`<meta name="theme-color" content="${COLOR_BARRA.oscuro}" />`)
  })
})
