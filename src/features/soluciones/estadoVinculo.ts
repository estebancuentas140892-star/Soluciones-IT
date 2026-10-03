// EN QUÉ VA UNA GUÍA VINCULADA, DICHO CON PALABRAS (encargo del
// 2026-09-10, tarea 4).
//
// La fila de un vínculo llevaba un ANILLO de avance de 22 px junto al
// nombre. Un anillo a ese tamaño no dice ni cuántos pasos hay ni en
// cuál va: hay que interpretarlo, y en una guía de tres pasos la
// diferencia entre "uno hecho" y "dos hechos" son unos grados de arco.
// Encima el nombre iba truncado para hacerle sitio, así que el vínculo
// competía consigo mismo: se perdía el dato que sí importa (cuál es la
// guía) para dibujar el que no se puede leer.
//
// Aquí vive la traducción a texto, fuera de los componentes, porque es
// la misma en la tarjeta y en cualquier sitio que la reutilice.

//
// Desde la tarea 289 (fase 3) sin "guía" en las palabras: lo que queda
// como tarjeta es lo opcional (una consulta, una contingencia) o lo que
// una tarea exige, y la tarjeta dice para qué sirve y en qué va, no cómo
// está construido el procedimiento. Tampoco nombra su numeración ("Paso 2
// de 5"): al lado del contador de la guía que se abrió, eran dos
// numeraciones distintas en la misma pantalla.
import { ROTULO_CONSULTA, ROTULO_NECESARIO } from './flujoContinuo'

export type ClaseEstadoVinculo = 'sin-iniciar' | 'en-curso' | 'completada'

export interface EstadoVinculo {
  /** "Sin empezar", "A medias" o "Hecha". */
  texto: string
  /** "Abrir", "Seguir donde ibas" o "Ver de nuevo". */
  accion: string
  clase: ClaseEstadoVinculo
}

/**
 * `completada` la resuelve quien llama con la MISMA regla que usa la
 * ejecución para dar un vínculo por cumplido (`guiaTerminada`): pasos
 * cerrados Y comprobaciones finales hechas. No se deduce de la cuenta
 * de pasos, porque una guía con todos los pasos cerrados y una
 * comprobación pendiente todavía no está terminada.
 */
export function estadoVinculo(hechos: number, total: number, completada: boolean): EstadoVinculo {
  if (completada) {
    return { texto: 'Hecha', accion: 'Ver de nuevo', clase: 'completada' }
  }
  // Sin pasos que recorrer, o con el avance en cero, no se ha empezado.
  if (total <= 0 || hechos <= 0) {
    return { texto: 'Sin empezar', accion: 'Abrir', clase: 'sin-iniciar' }
  }
  return { texto: 'A medias', accion: 'Seguir donde ibas', clase: 'en-curso' }
}

/** El rótulo que dice qué papel juega lo que se ofrece. */
export function kickerVinculo(obligatoria: boolean): string {
  return obligatoria ? ROTULO_NECESARIO : ROTULO_CONSULTA
}
