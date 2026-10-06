import type { Articulo, ProgresoPasos } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { avanceDeLaRuta } from '../../lib/rutaProcedimiento'

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
  // Pasos hechos y pasos de la RUTA de esta ejecución (tarea 302): con
  // decisiones con opciones, los del camino elegido, nunca los de los
  // otros caminos.
  hechos: number
  total: number
  // El total todavía no se sabe: la ruta se detiene en una decisión sin
  // responder cuyos caminos no miden lo mismo, y `total` son los pasos que
  // ya se conocen. Quien lo pinta no dice "de M" (sería afirmar un total
  // que no existe). Si todos los caminos miden lo mismo, el total se sabe.
  totalAbierto: boolean
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

      // Se cuenta sobre la ruta y contra los ids vigentes: el
      // procedimiento pudo editarse después de marcar avance (los pasos
      // eliminados no cuentan) y los caminos no elegidos no existen.
      const { hechos, total, totalAbierto, pasosListos } = avanceDeLaRuta(procedimiento, progreso)
      if (total === 0) return []
      if (hechos === 0 || pasosListos) return []

      // Sin el total no se sabe cuánto falta: no se inventa.
      const estimado = procedimiento.tiempoEstimadoMin
      const minutosRestantes =
        estimado == null || totalAbierto ? null : Math.max(1, Math.round((estimado * (total - hechos)) / total))

      return [{ articulo, hechos, total, totalAbierto, minutosRestantes, actualizadoEn: progreso.actualizadoEn }]
    })
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .map(({ articulo, hechos, total, totalAbierto, minutosRestantes }) => ({
      articulo,
      hechos,
      total,
      totalAbierto,
      minutosRestantes,
    }))
}

/**
 * "paso 3 de 5", o solo "paso 3" cuando el total todavía no se sabe (tarea
 * 302: una decisión sin responder cuyos caminos no miden lo mismo). En
 * minúscula: lo usan frases que lo llevan en medio; quien empieza por él lo
 * capitaliza.
 */
export function pasoDeTotal(numero: number, total: number, totalAbierto: boolean): string {
  return totalAbierto ? `paso ${numero}` : `paso ${numero} de ${total}`
}
