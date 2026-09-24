import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// EL PORTAL NO ARRASTRA LA APP (tarea 258, sección 9 del encargo).
//
// Se recorren las importaciones REALES del portal desde su entrada
// (`src/asistencia/main.tsx`), siguiendo solo las que llegan al navegador
// (las `import type` se borran al compilar), y se comprueba que ninguna
// alcanza lo que el computador atendido no debe cargar: la base local
// (Dexie), el cliente de Supabase, la sincronización, la Bóveda, el
// buscador, el chasis y las pantallas de la app. Si mañana alguien
// importa en el portal un componente que por dentro abre la base, esta
// prueba lo dice antes de que llegue a producción.

const ENTRADA = 'src/asistencia/main.tsx'

const PROHIBIDOS: [RegExp, string][] = [
  [/^dexie/, 'Dexie'],
  [/^dexie-react-hooks/, 'Dexie'],
  [/^@supabase\//, 'el cliente de Supabase'],
  [/^src\/lib\/db\.ts$/, 'la base local'],
  [/^src\/lib\/supabase\.ts$/, 'el cliente de Supabase'],
  [/^src\/lib\/sync\.ts$/, 'la sincronización'],
  [/^src\/lib\/repositorio\.ts$/, 'la escritura de la app'],
  [/^src\/lib\/crypto\.ts$/, 'el cifrado de la Bóveda'],
  [/^src\/features\/boveda\//, 'la Bóveda'],
  [/^src\/features\/busqueda\//, 'el buscador'],
  [/^src\/features\/autenticacion\//, 'la sesión de la app'],
  [/^src\/app\//, 'el chasis de la app'],
  [/^src\/App\.tsx$/, 'la app'],
  [/^src\/pruebas\//, 'el banco de pruebas'],
  [/^virtual:pwa-register/, 'el service worker'],
]

function resolver(desde: string, especificador: string): string | null {
  if (!especificador.startsWith('.')) return especificador
  const base = normalize(join(dirname(desde), especificador)).split('\\').join('/')
  for (const candidato of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx|css)$/.test(candidato) && existsSync(candidato)) return candidato
  }
  return null
}

function importacionesDe(archivo: string): string[] {
  const codigo = readFileSync(archivo, 'utf8')
  const encontrados: string[] = []
  // import x from '...', import { a } from '...', import '...', export ... from '...'
  const patron = /^\s*(import|export)\s+(?!type\s)(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm
  for (const [, , especificador] of codigo.matchAll(patron)) encontrados.push(especificador)
  // import('...') dinámico
  for (const [, especificador] of codigo.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) encontrados.push(especificador)
  return encontrados
}

function grafoDelPortal(): Set<string> {
  const visitados = new Set<string>()
  const pendientes = [ENTRADA]
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as string
    if (visitados.has(actual)) continue
    visitados.add(actual)
    if (!/\.(ts|tsx)$/.test(actual)) continue
    for (const especificador of importacionesDe(actual)) {
      const destino = resolver(actual, especificador)
      if (destino) pendientes.push(destino)
    }
  }
  return visitados
}

describe('el portal de asistencia está aislado de la app', () => {
  const grafo = grafoDelPortal()

  it('recorre de verdad sus importaciones', () => {
    expect(grafo).toContain('src/asistencia/PortalAsistencia.tsx')
    expect(grafo).toContain('src/features/asistencia/VistaContenidoAsistencia.tsx')
    expect(grafo).toContain('src/features/asistencia/modelo.ts')
    expect(grafo).toContain('qrcode')
  })

  it.each(PROHIBIDOS.map(([patron, que]) => [que, patron] as const))('no carga %s', (_que, patron) => {
    const culpables = [...grafo].filter((modulo) => patron.test(relative('.', modulo).split('\\').join('/')))
    expect(culpables).toEqual([])
  })
})
