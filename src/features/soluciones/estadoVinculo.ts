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

export type ClaseEstadoVinculo = 'sin-iniciar' | 'en-curso' | 'completada'

export interface EstadoVinculo {
  /** "Sin iniciar", "Paso 2 de 5" o "Completada". */
  texto: string
  /** "Abrir guía", "Continuar guía" o "Ver guía completada". */
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
    return { texto: 'Completada', accion: 'Ver guía completada', clase: 'completada' }
  }
  // Sin pasos que recorrer no hay "paso X de Y" que decir; y con el
  // avance en cero tampoco se ha empezado.
  if (total <= 0 || hechos <= 0) {
    return { texto: 'Sin iniciar', accion: 'Abrir guía', clase: 'sin-iniciar' }
  }
  // El número que se nombra es el paso al que se VUELVE, no el último
  // cerrado: es lo que el técnico va a ver al tocar el botón.
  const siguiente = Math.min(hechos + 1, total)
  return { texto: `Paso ${siguiente} de ${total}`, accion: 'Continuar guía', clase: 'en-curso' }
}

/** El rótulo que dice qué papel juega el vínculo. */
export function kickerVinculo(obligatoria: boolean): string {
  return obligatoria ? 'Guía necesaria' : 'Consulta opcional'
}
