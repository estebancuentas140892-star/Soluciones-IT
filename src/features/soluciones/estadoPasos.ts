import type { PasoProcedimiento } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'

// Estado de cada paso para el índice del modo ejecución (handoff
// "Diseño móvil", tablero 6c). Lógica pura, aparte del componente, para
// poder probar la parte delicada: qué cuenta como "saltado".
//
// SALTADO ES AHORA UN ESTADO GUARDADO (2026-09-09, hallazgo H07).
//
// Antes se DEDUCÍA de la posición: "un paso sin hacer que quedó por
// detrás del que se está ejecutando es uno por el que el técnico ya
// pasó de largo". La deducción parecía inofensiva y no lo era: la
// barra de acción tiene flechas de paginación pura, que existen justo
// para mirar hacia adelante sin tocar el avance, así que consultar el
// paso siguiente bastaba para que el índice acusara al anterior de
// saltado. El informe del 8 de septiembre lo describe: la interfaz
// dice que faltan tareas "para poder avanzar", la flecha avanza igual,
// y el índice acaba señalando como saltado un paso que solo se miró.
//
// Ahora saltar es un ACTO: se elige "Saltar el paso y seguir" en la
// hoja de falla y queda anotado en `progresoPasos.pasosSaltados`, que
// es local y no necesita migración de Supabase. Navegar no anota nada.
// Retomar el paso (marcar una de sus tareas o completarlo) retira la
// marca sola.

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
  saltados: ReadonlySet<string> = new Set(),
): ResumenPaso[] {
  return pasos.map((paso, indice) => {
    const tareas = tareasDe(paso.bloques)
    return {
      id: paso.id,
      indice,
      titulo: tituloDePaso(paso, indice),
      estado: estadoDe(paso, indice, hechos, indiceActual, saltados),
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
  saltados: ReadonlySet<string>,
): EstadoPaso {
  // Hecho manda sobre todo: un paso completado sigue completado aunque
  // se vuelva a él para revisarlo.
  if (hechos.has(paso.id)) return 'hecho'
  if (indice === indiceActual) return 'actual'
  // Saltado solo si el técnico lo saltó. Mirar el paso siguiente y
  // volver no convierte nada en saltado.
  if (saltados.has(paso.id)) return 'saltado'
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
