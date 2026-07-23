import type { Diagnostico, EjecucionDiagnostico } from '../../lib/db'
import { textoVivo } from '../../lib/referencia'
import { problemasMasFrecuentes } from '../diagnostico/estadisticas'

// Bloque "Problemas frecuentes" de Inicio (punto 10 de PROPUESTA_MODULOS.md,
// decision D4): reutiliza la agregacion de estadisticas.ts sobre
// `ejecuciones_diagnostico`, la misma tabla que alimenta el tablero
// completo (EstadisticasPage). Vista DERIVADA, cero esquema.

export interface FilaProblemaFrecuente {
  diagnosticoId: string
  titulo: string
  // Cantidad de ejecuciones registradas, o null en modo "recientes"
  // (todavia no hay ninguna ejecucion: un conteo no significaria nada).
  ejecuciones: number | null
}

// Con las ejecuciones que ya tiene el equipo, "mas frecuente" es una
// senal real desde la primera. Sin ninguna, cae al fallback (diagnosticos
// mas recientes) para que el bloque no aparezca vacio desde el primer
// dia de usar el modulo.
export function problemasFrecuentesInicio(
  ejecuciones: EjecucionDiagnostico[],
  diagnosticosVivos: Diagnostico[],
  limite = 4,
): FilaProblemaFrecuente[] {
  if (ejecuciones.length === 0) {
    return [...diagnosticosVivos]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limite)
      .map((d) => ({ diagnosticoId: d.id, titulo: d.titulo, ejecuciones: null }))
  }

  const vivos = new Map(diagnosticosVivos.map((d) => [d.id, d]))
  return problemasMasFrecuentes(ejecuciones, limite)
    // Un diagnostico eliminado no tiene a donde llevar: se omite en vez
    // de enlazar a una ficha que ya no existe (mismo criterio que
    // actividadEquipo.ts).
    .filter((fila) => vivos.has(fila.diagnosticoId))
    .map((fila) => ({
      diagnosticoId: fila.diagnosticoId,
      titulo: textoVivo(vivos.get(fila.diagnosticoId)?.titulo, fila.titulo),
      ejecuciones: fila.ejecuciones,
    }))
}
