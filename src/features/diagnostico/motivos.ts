import type { MotivoNoResuelto } from '../../lib/db'

// Unico dueño del texto de cada motivo de "no resuelto" (fase D3). Las
// etiquetas vivian sueltas dentro de DiagnosticoRunPage.tsx, donde iban
// pegadas a su icono; el tablero de estadisticas necesita las MISMAS
// palabras para desglosar por que fallan los diagnosticos, y dos copias
// del mismo texto se separan en cuanto alguien reformula una.
export type MotivoConcreto = Exclude<MotivoNoResuelto, ''>

// El orden es el de la pregunta al cerrar el diagnostico: de lo mas
// accionable (la solucion existe pero no sirvio) a lo mas vago.
export const MOTIVOS_ORDEN: MotivoConcreto[] = [
  'no_funciono',
  'no_encontro_problema',
  'faltan_pasos',
  'encontro_otra_solucion',
  'otro',
]

export const ETIQUETA_MOTIVO: Record<MotivoConcreto, string> = {
  no_funciono: 'La solución no funcionó',
  no_encontro_problema: 'No encontré mi problema',
  faltan_pasos: 'Faltan pasos',
  encontro_otra_solucion: 'Encontré otra solución',
  otro: 'Otro',
}
