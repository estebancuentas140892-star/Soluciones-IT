import type { PasoProcedimiento } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'

// Estado de cada paso para el índice del modo ejecución (handoff
// "Diseño móvil", tablero 6c). Lógica pura, aparte del componente, para
// poder probar la parte delicada: qué cuenta como "saltado".
//
// SALTADO NO ES UN ESTADO GUARDADO, y a propósito. `progresoPasos` solo
// almacena qué está hecho; añadir un tercer valor obligaría a migrar
// Dexie y `supabase/schema.sql` para un dato que se deduce sin error:
// un paso sin hacer que quedó POR DETRÁS del que se está ejecutando es
// uno por el que el técnico ya pasó de largo. Lo mismo con distinto
// nombre: "pendiente" es lo que todavía no ha visto.

export type EstadoPaso = 'hecho' | 'actual' | 'saltado' | 'pendiente'

export interface ResumenPaso {
  id: string
  indice: number
  titulo: string
  estado: EstadoPaso
  // Tareas del paso (los bloques de tipo tarea) y cuántas van marcadas.
  // Las marcadas solo se pintan en el paso actual: en los demás el
  // estado ya lo dice todo y el número sobra.
  tareas: number
  tareasHechas: number
  // El paso lleva un aviso de precaución o de importante. Se anuncia en
  // el índice para que el técnico sepa a qué va ANTES de saltar ahí.
  // Los otros tres tonos (información, consejo, dato) no advierten de
  // nada, así que no marcan la fila.
  tieneCuidado: boolean
}

export function tituloDePaso(paso: PasoProcedimiento, indice: number): string {
  return paso.titulo || paso.subArticuloTitulo || `Paso ${indice + 1}`
}

export function resumirPasos(
  pasos: PasoProcedimiento[],
  hechos: ReadonlySet<string>,
  instruccionesHechas: ReadonlySet<string>,
  indiceActual: number | null,
): ResumenPaso[] {
  return pasos.map((paso, indice) => {
    const tareas = tareasDe(paso.bloques)
    return {
      id: paso.id,
      indice,
      titulo: tituloDePaso(paso, indice),
      estado: estadoDe(paso, indice, hechos, indiceActual),
      tareas: tareas.length,
      tareasHechas: tareas.filter((t) => instruccionesHechas.has(t.id)).length,
      tieneCuidado: paso.bloques.some(
        (b) => b.tipo === 'aviso' && (b.tono === 'precaucion' || b.tono === 'importante'),
      ),
    }
  })
}

function estadoDe(
  paso: PasoProcedimiento,
  indice: number,
  hechos: ReadonlySet<string>,
  indiceActual: number | null,
): EstadoPaso {
  // Hecho manda sobre todo: un paso completado sigue completado aunque
  // se vuelva a él para revisarlo.
  if (hechos.has(paso.id)) return 'hecho'
  if (indice === indiceActual) return 'actual'
  // Sin paso actual (el procedimiento terminó o está en la pantalla de
  // cierre) nada quedó "por detrás": lo que falte está pendiente.
  if (indiceActual !== null && indice < indiceActual) return 'saltado'
  return 'pendiente'
}

// Minutos que faltan, repartiendo el tiempo estimado del procedimiento
// entre los pasos que quedan por hacer. Es una regla de tres, no una
// medida: por eso quien lo pinta escribe "~". Devuelve null cuando el
// artículo no declara tiempo estimado, y 0 no se muestra como "quedan
// 0 min" sino que no se muestra.
export function minutosRestantes(
  tiempoEstimadoMin: number | null,
  resumenes: ResumenPaso[],
): number | null {
  if (!tiempoEstimadoMin || tiempoEstimadoMin <= 0 || resumenes.length === 0) return null
  const porHacer = resumenes.filter((r) => r.estado !== 'hecho').length
  if (porHacer === 0) return null
  return Math.max(1, Math.round((tiempoEstimadoMin * porHacer) / resumenes.length))
}

// Línea de resumen del índice: "2 hechos · 1 saltado · quedan ~14 min".
// Solo nombra lo que existe: sin saltados no aparece la palabra, que es
// la que asusta, y sin tiempo estimado no se inventa uno.
export function resumenDeAvance(resumenes: ResumenPaso[], minutos: number | null): string {
  const hechos = resumenes.filter((r) => r.estado === 'hecho').length
  const saltados = resumenes.filter((r) => r.estado === 'saltado').length
  const partes: string[] = [`${hechos} ${hechos === 1 ? 'hecho' : 'hechos'}`]
  if (saltados > 0) partes.push(`${saltados} ${saltados === 1 ? 'saltado' : 'saltados'}`)
  if (minutos !== null) partes.push(`quedan ~${minutos} min`)
  return partes.join(' · ')
}
