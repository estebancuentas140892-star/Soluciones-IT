import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BTN_PRIMARIO, BTN_PRIMARIO_DOMINANTE, BTN_PRIMARIO_RELLENO } from './nocturne'

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

describe('Figtree en el teléfono (tarea 348)', () => {
  it('se sirve desde el bundle, con licencia y sin pedir nada a la red', () => {
    expect(css).toContain("url('./assets/figtree-latin-wght-normal.woff2')")
    expect(existsSync(join('src/assets', 'figtree-latin-wght-normal.woff2'))).toBe(true)
    expect(existsSync(join('src/assets', 'LICENSE-Figtree.txt'))).toBe(true)
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })

  it('font-inter sigue siendo Inter en tableta y escritorio', () => {
    expect(css).toMatch(/--font-inter:\s*'Inter Variable', system-ui, -apple-system, sans-serif;/)
  })

  it('por debajo de 768 px font-inter es Figtree con Inter de respaldo', () => {
    const bloque = css.match(/@media \(max-width: 47\.999rem\) \{\s*html \{([^}]*)\}/)
    expect(bloque).not.toBeNull()
    expect(bloque![1]).toMatch(/--font-inter:\s*'Figtree Variable', 'Inter Variable', system-ui, -apple-system, sans-serif;/)
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

describe('las sombras del sistema (tarea 339)', () => {
  // Las dos sombras del handoff de tableta y escritorio. Van fuera de @theme
  // porque Tailwind copia el valor de una sombra de @theme dentro de su
  // utilidad: `shadow-noct-panel` llevaría el valor oscuro también en el
  // claro sin que nada fallara. Se usan con `shadow-[var(--shadow-noct-*)]`.
  function sombrasDe(bloque: string): string[] {
    return [...bloque.matchAll(/(--shadow-noct-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort()
  }
  function bloqueDe(inicio: string): string {
    const desde = css.indexOf(inicio)
    expect(desde).toBeGreaterThan(0)
    return css.slice(desde, css.indexOf('\n}', desde))
  }

  // La tercera, la del pie fijo del teléfono (tarea 350).
  it('el oscuro y el claro definen las mismas tres, y @theme ninguna', () => {
    const oscuro = sombrasDe(bloqueDe(':root {'))
    expect(oscuro).toEqual(['--shadow-noct-elevacion', '--shadow-noct-panel', '--shadow-noct-pie'])
    expect(sombrasDe(bloqueDe(":root[data-tema='claro'] {"))).toEqual(oscuro)
    expect(sombrasDe(bloqueDe('@theme {'))).toEqual([])
  })

  it('ningún archivo las pide como utilidad de tema', () => {
    // Solo el código: index.css lo nombra en su comentario para explicarlo.
    const conUtilidad = archivosFuente('src')
      .filter((ruta) => !ruta.endsWith('.css'))
      .filter((ruta) => /(?<![-\w])shadow-noct-/.test(readFileSync(ruta, 'utf8')))
    expect(conUtilidad).toEqual([])
  })

  // EL TINTE DE UN ESTADO (T11): 13 % en el oscuro y 11 % en el claro, en
  // una sola variable. Una pantalla que escribiera el 13 % a mano dejaría ese
  // aviso igual de cargado en los dos temas. (Las cajas de icono tintadas al
  // 12, 14 o 16 % son otra pieza y no cambian.)
  it('el tinte de estado vive en una variable, con su valor en cada tema', () => {
    expect(bloqueDe(':root {')).toMatch(/--tinte-estado:\s*13%/)
    expect(bloqueDe(":root[data-tema='claro'] {")).toMatch(/--tinte-estado:\s*11%/)
    const aMano = archivosFuente('src')
      .filter((ruta) => !ruta.endsWith('.css') && !ruta.includes('.test.'))
      .filter((ruta) => /bg-noct-(error|precaucion|exito)\/\[\.13\]/.test(readFileSync(ruta, 'utf8')))
    expect(aMano).toEqual([])
  })
})

describe('las clases que Tailwind tiene que ver (tarea 339)', () => {
  // Tailwind busca las clases en el texto del código, no en el DOM. Una
  // clase pegada a una interpolación (`shadow-2xl${...}`) se lee como un
  // solo trozo y no genera CSS, aunque en el navegador el atributo `class`
  // salga bien. Le pasó al `Modal` de la tarea 339: la hoja del teléfono
  // perdió su sombra y su centrado desde 640 px sin que nada fallara.
  it('ninguna clase de un className va pegada a una interpolación', () => {
    const pegadas = archivosFuente('src')
      .filter((ruta) => ruta.endsWith('.tsx'))
      .filter((ruta) => /className=\{`[^`]*[a-z0-9\])%]\$\{/.test(readFileSync(ruta, 'utf8')))
    expect(pegadas).toEqual([])
  })
})

describe('BTN_PRIMARIO_RELLENO por banda (tarea 339)', () => {
  it('48 · 15.5 · 14 en tableta y 40 · 14 · 11 en escritorio, sin tocar el teléfono', () => {
    const clases = BTN_PRIMARIO_RELLENO.split(/\s+/)
    for (const clase of [
      'md:min-h-12',
      'md:rounded-[14px]',
      'md:text-[15.5px]',
      'xl:min-h-10',
      'xl:rounded-[11px]',
      'xl:text-[14px]',
      'xl:px-[15px]',
    ]) {
      expect(clases).toContain(clase)
    }
    expect(clases).toContain('text-[16px]')
    expect(clases).toContain('px-4')
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

  it('redefine todos los tokens de color, y ninguno de más', () => {
    expect(inicioClaro).toBeGreaterThan(0)
    expect(tokensDe(tema).length).toBeGreaterThan(30)
    expect(tokensDe(claro)).toEqual(tokensDe(tema))
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

describe('el sistema visual «Ventana» en el teléfono (tarea 349)', () => {
  const inicio = css.indexOf('@media (max-width: 47.999rem) {\n  :root {')
  const bloque = css.slice(inicio, css.indexOf('\n}', inicio))
  const oscuro = bloque.slice(bloque.indexOf(':root {'), bloque.indexOf('\n  }'))
  const claro = bloque.slice(bloque.indexOf(":root[data-tema='claro'] {"))
  const valor = (de: string, token: string) => new RegExp(`${token}:\\s*([^;]+);`).exec(de)?.[1]
  const tokens = (de: string) => [...de.matchAll(/(--color-noct-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort()

  it('solo vive por debajo de 768 px y va después del tema claro general', () => {
    expect(inicio).toBeGreaterThan(css.indexOf(":root[data-tema='claro'] {"))
  })

  it('el oscuro y el claro del teléfono definen los mismos tokens, todos del sistema', () => {
    const delTema = css.slice(css.indexOf('@theme {'), css.indexOf('\n}', css.indexOf('@theme {')))
    expect(tokens(oscuro).length).toBeGreaterThan(25)
    expect(tokens(claro)).toEqual(tokens(oscuro))
    for (const token of tokens(oscuro)) expect(delTema).toContain(`${token}:`)
  })

  it('tiene los valores de la tabla de la pizarra', () => {
    const tabla: Record<string, [string, string]> = {
      '--color-noct-bg': ['#0e131b', '#f2f5f9'],
      '--color-noct-surface': ['#171e29', '#ffffff'],
      '--color-noct-neutral-900': ['#212a37', '#e9eef4'],
      '--color-noct-neutral-300': ['#b4bfce', '#475467'],
      '--color-noct-neutral-400': ['#98a4b6', '#5d6b80'],
      '--color-noct-accent': ['#38bdd0', '#0a7a8c'],
      '--color-noct-accent-900': ['#12343c', '#ddf3f6'],
      '--color-noct-exito': ['#6fd9a0', '#11743f'],
      '--color-noct-precaucion': ['#f3c46a', '#8a5300'],
      '--color-noct-error': ['#ff9b92', '#b42318'],
    }
    for (const [token, [enOscuro, enClaro]] of Object.entries(tabla)) {
      expect(valor(oscuro, token)).toBe(enOscuro)
      expect(valor(claro, token)).toBe(enClaro)
    }
  })

  it('la barra del navegador del teléfono es el fondo de Ventana, en el script y en el módulo', async () => {
    const script = readFileSync('public/tema.js', 'utf8')
    const { COLOR_BARRA_TELEFONO, CONSULTA_TELEFONO, colorBarra } = await import('../lib/tema')
    expect(COLOR_BARRA_TELEFONO).toEqual({ oscuro: '#0e131b', claro: '#f2f5f9' })
    expect(script).toContain(`'${CONSULTA_TELEFONO}'`)
    expect(script).toContain(`'${COLOR_BARRA_TELEFONO.claro}'`)
    expect(script).toContain(`'${COLOR_BARRA_TELEFONO.oscuro}'`)
    expect(colorBarra('oscuro', true)).toBe('#0e131b')
    expect(colorBarra('oscuro', false)).toBe('#161826')
  })
})

describe('el remate móvil "1b Pulgar" (tarea 341)', () => {
  const inicioTema = css.indexOf('@theme {')
  const tema = css.slice(inicioTema, css.indexOf('\n}', inicioTema))

  // Lo que el handoff móvil nombraba y no tenía token: el asa y los bordes
  // fuertes, el tinte de un control, la respuesta al tocar y el velo de la
  // hoja. Valores oscuros del handoff (el claro lo vigila "el tema claro").
  it('los tokens del teléfono tienen los valores oscuros del handoff', () => {
    expect(tema).toMatch(/--color-noct-divider-fuerte:\s*rgb\(233 233 237 \/ 0\.24\);/)
    expect(tema).toMatch(/--color-noct-tinte:\s*rgb\(233 233 237 \/ 0\.06\);/)
    expect(tema).toMatch(/--color-noct-presionado:\s*rgb\(233 233 237 \/ 0\.1\);/)
    expect(tema).toMatch(/--color-noct-velo:\s*rgb\(6 7 12 \/ 0\.62\);/)
  })

  // La hoja que sube, su velo, el aviso y la marca de "Guía completada" se
  // animan solo en el teléfono y solo si nadie pidió reducir el movimiento.
  it('el movimiento es solo del teléfono y respeta "reducir movimiento"', () => {
    const regla = /@media \(width < 48rem\) and \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(css)
    expect(regla).not.toBeNull()
    for (const pieza of ['[data-hoja-movil]', '[data-velo-movil]', '[data-aviso-flotante]', '[data-marca-completada]']) {
      expect(regla?.[1]).toContain(pieza)
      // Ninguna otra regla las anima.
      expect(css.split(`${pieza} {`).length - 1).toBe(1)
    }
  })

  it('los 44 px de objetivo solo existen por debajo de 768', () => {
    const capa = /@layer components \{\s*@media \(width < 48rem\) \{([\s\S]*?)\n {2}\}\n\}/.exec(css)
    expect(capa).not.toBeNull()
    expect(capa?.[1]).toMatch(/\.btn-tactil \{\s*min-height: 2\.75rem;/)
    expect(capa?.[1]).toMatch(/\.toque-amplio::after \{[\s\S]*width: max\(100%, 2\.75rem\);[\s\S]*height: max\(100%, 2\.75rem\);/)
    expect(css.split('.btn-tactil').length - 1).toBe(1)
  })

  // "Guardar" y "Desbloquear" donde mandan: rellenos en el teléfono y, desde
  // 768, exactamente el delineado que esas pantallas tenían.
  it('BTN_PRIMARIO_DOMINANTE es relleno en el teléfono y el primario de siempre desde 768', () => {
    const dominante = BTN_PRIMARIO_DOMINANTE.split(/\s+/)
    const telefono = dominante.filter((c) => c.startsWith('max-md:'))
    for (const clase of ['max-md:bg-noct-accent', 'max-md:text-noct-on-accent', 'max-md:min-h-[54px]', 'max-md:rounded-[15px]', 'max-md:text-[16px]']) {
      expect(telefono).toContain(clase)
    }
    const sinTelefono = (clases: string[]) => clases.filter((c) => !c.startsWith('max-md:') && c !== 'btn-tactil').sort()
    expect(sinTelefono(dominante)).toEqual(sinTelefono(BTN_PRIMARIO.split(/\s+/)))
  })
})

// LOS 44 PX DE TOQUE QUE FALTABAN (tarea 349; pendiente (f) de la tarea 348):
// el «‹ Volver» de las subpantallas medía 36 de alto y la estrella de favorito
// de una fila, 34 x 34. Los dos amplían su zona de toque en el teléfono con
// `toque-amplio`, sin cambiar lo que se ve.
describe('las zonas de toque del teléfono (tarea 349)', () => {
  it('el volver con texto y la estrella de una fila llevan toque-amplio y van posicionados', () => {
    const volver = readFileSync('src/components/BotonVolver.tsx', 'utf8')
    const favorito = readFileSync('src/components/BotonFavorito.tsx', 'utf8')
    expect(volver).toContain('"toque-amplio relative inline-flex min-w-0 items-center gap-1 rounded-lg py-2')
    expect(favorito).toContain("'toque-amplio relative flex h-[34px] w-[34px]")
  })
})
