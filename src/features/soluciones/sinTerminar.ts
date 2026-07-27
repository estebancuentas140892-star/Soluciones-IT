import type { Articulo, ProgresoPasos } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'

// Los procedimientos que este técnico dejó a medias, para el bloque
// "Sin terminar" de la lista de Soluciones.
//
// Sale de la auditoría (problema P1-8, decisión P1-4): el avance a medias
// solo se veía dentro de la ficha de la categoría, así que un
// procedimiento interrumpido a mitad de un mantenimiento se perdía de
// vista. Retomarlo costaba cuatro toques (lista -> categoría -> ficha ->
// ejecutar); con el bloque arriba de la lista cuesta uno.
//
// El avance vive solo en el dispositivo (`db.progresoPasos`, como los
// recientes): cada técnico ve el suyo, no el de sus compañeros.

export interface ArticuloSinTerminar {
  articulo: Articulo
  hechos: number
  total: number
  // Minutos que quedarían según el estimado del procedimiento, repartido
  // por pasos. Es una estimación grosera y se muestra con "~": el dato
  // fino no existe, pero "te quedan ~14 min" decide si vale la pena
  // retomarlo ahora, que es la pregunta real.
  minutosRestantes: number | null
}

// Sólo cuenta como "sin terminar" lo que está EMPEZADO y no acabado:
// con 0 pasos hechos no hay nada que retomar (es un artículo normal de la
// lista) y con todos hechos ya está listo. Se ordena por lo último que se
// tocó, así que el procedimiento que el técnico acaba de interrumpir
// queda primero.
export function articulosSinTerminar(
  articulos: Articulo[],
  progresos: ProgresoPasos[],
): ArticuloSinTerminar[] {
  const porArticulo = new Map(progresos.map((p) => [p.articuloId, p]))

  return articulos
    .flatMap((articulo) => {
      const progreso = porArticulo.get(articulo.id)
      if (!progreso) return []
      const procedimiento = normalizarProcedimiento(articulo.procedimiento)
      if (!procedimiento) return []

      const ids = procedimiento.pasos.map((p) => p.id)
      const total = ids.length
      if (total === 0) return []

      // Se cruza contra los ids vigentes porque el procedimiento pudo
      // editarse después de marcar avance: los pasos eliminados no cuentan.
      const hechos = contarHechos(progreso.pasosHechos, ids)
      if (hechos === 0 || hechos >= total) return []

      const estimado = procedimiento.tiempoEstimadoMin
      const minutosRestantes =
        estimado == null ? null : Math.max(1, Math.round((estimado * (total - hechos)) / total))

      return [{ articulo, hechos, total, minutosRestantes, actualizadoEn: progreso.actualizadoEn }]
    })
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .map(({ articulo, hechos, total, minutosRestantes }) => ({
      articulo,
      hechos,
      total,
      minutosRestantes,
    }))
}
