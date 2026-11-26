import type { Ubicacion } from '../../lib/db'
import { normalizarTexto } from '../../lib/texto'
import { cadenaNombres } from './arbol'

// LO QUE ENCUENTRA EL BUSCADOR DE UBICACIONES (encargo del 2026-11-26,
// optimización integral, sección 8).
//
// Hasta ahora buscaba la consulta entera dentro del nombre y enseñaba el
// resultado con la sangría del árbol pero sin su padre: dos "Caja 3", una en
// cada taquilla, se leían iguales. Ahora:
//
//   - cada palabra escrita tiene que estar en el nombre o en el de alguno de
//     sus padres, y al menos una en el propio nombre: "norte caja" encuentra
//     la "Caja 3" de "Taquilla Norte", y "norte" no trae a todos los hijos de
//     la sede, solo a la sede;
//   - primero las que tienen todas las palabras en su propio nombre;
//   - cada resultado lleva la ruta de sus padres ("Sede Norte > Taquilla
//     Norte"), para distinguirlo sin abrirlo. Una raíz no lleva nada.
//
// Lógica pura, sin React ni base de datos, para probarla sola.

export interface UbicacionEncontrada {
  u: Ubicacion
  /** Los nombres de sus padres, de la raíz hacia ella ('' si es raíz). */
  padres: string
}

export function buscarUbicaciones(
  ubicaciones: readonly Ubicacion[],
  porId: Map<string, Ubicacion>,
  consulta: string,
): UbicacionEncontrada[] {
  const palabras = normalizarTexto(consulta).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return []
  return ubicaciones
    .flatMap((u, indice) => {
      if (u.eliminadoEn) return []
      // Sin ella en el mapa (no debería pasar), al menos su propio nombre.
      const cadena = porId.has(u.id) ? cadenaNombres(u.id, porId) : [u.nombre]
      const padres = cadena.slice(0, -1)
      const nombre = normalizarTexto(u.nombre)
      const todo = normalizarTexto(cadena.join(' '))
      if (!palabras.every((p) => todo.includes(p)) || !palabras.some((p) => nombre.includes(p))) return []
      const enSuNombre = palabras.every((p) => nombre.includes(p))
      return [{ u, padres: padres.join(' > '), indice, nivel: enSuNombre ? 0 : 1 }]
    })
    .sort((a, b) => a.nivel - b.nivel || a.indice - b.indice)
    .map(({ u, padres }) => ({ u, padres }))
}
