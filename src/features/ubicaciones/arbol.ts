import type { Ubicacion } from '../../lib/db'

// Jerarquia de ubicaciones (grupo N3): `padre_id` opcional permite
// "Sede Norte" > "Área caja" > "Taquilla 2", sin obligacion de usarla.
// Logica pura (sin React ni base local) para poder probarla sola.

export function mapaPorId(ubicaciones: Ubicacion[]): Map<string, Ubicacion> {
  return new Map(ubicaciones.filter((u) => !u.eliminadoEn).map((u) => [u.id, u]))
}

// Cadena de ancestros mas la propia ubicacion, de la raiz al final:
// [Sede Norte, Área caja, Taquilla 2]. Corta ante un ciclo (no deberia
// existir, pero los datos podrian venir dañados) para no colgarse.
export function cadenaUbicaciones(id: string, porId: Map<string, Ubicacion>): Ubicacion[] {
  const cadena: Ubicacion[] = []
  const visitados = new Set<string>()
  let actual: string | null = id
  while (actual && !visitados.has(actual)) {
    visitados.add(actual)
    const ubicacion = porId.get(actual)
    if (!ubicacion) break
    cadena.unshift(ubicacion)
    actual = ubicacion.padreId
  }
  return cadena
}

// Solo los nombres de la cadena: ["Sede Norte", "Área caja", "Taquilla 2"].
export function cadenaNombres(id: string, porId: Map<string, Ubicacion>): string[] {
  return cadenaUbicaciones(id, porId).map((u) => u.nombre)
}

// Ruta legible "Sede Norte > Área caja > Taquilla 2" para mostrar la
// ubicacion con su contexto en selectores y fichas.
export function rutaUbicacion(id: string, porId: Map<string, Ubicacion>): string {
  return cadenaNombres(id, porId).join(' > ')
}

// Sub-ubicaciones directas de una ubicacion (sus hijos por padreId),
// ordenadas por nombre. Con padre null devuelve las ubicaciones raiz.
export function hijosDirectos(padreId: string | null, ubicaciones: Ubicacion[]): Ubicacion[] {
  return ubicaciones
    .filter((u) => !u.eliminadoEn && u.padreId === padreId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
}

// Ids de la ubicacion dada y de TODOS sus descendientes (para no
// ofrecerse a si misma ni a un hijo como su propio padre: crearia un
// ciclo). Cortado por `visitados`.
export function idsDescendientes(id: string, ubicaciones: Ubicacion[]): Set<string> {
  const resultado = new Set<string>([id])
  const pendientes = [id]
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as string
    for (const hijo of ubicaciones) {
      if (hijo.eliminadoEn || hijo.padreId !== actual) continue
      if (resultado.has(hijo.id)) continue
      resultado.add(hijo.id)
      pendientes.push(hijo.id)
    }
  }
  return resultado
}

// Ubicaciones ordenadas por su ruta completa, para listas y selectores
// estables ("Sede Norte" aparece antes que "Sede Norte > Taquilla").
export function ordenarPorRuta(ubicaciones: Ubicacion[]): Ubicacion[] {
  const porId = mapaPorId(ubicaciones)
  return [...ubicaciones]
    .filter((u) => !u.eliminadoEn)
    .sort((a, b) =>
      rutaUbicacion(a.id, porId).localeCompare(rutaUbicacion(b.id, porId), 'es', { numeric: true }),
    )
}
