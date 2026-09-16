// Botones de acción del buscador global: los de cada fila de resultados
// (`AccionesResultado`) y los de sus vistas rápidas (`VistaRapida*`).
// Viven aparte desde el 2026-09-16 para que una copia hecha desde la
// fila y la misma copia hecha desde la vista rápida no puedan tener dos
// tamaños distintos.

// Boton de accion de una fila: 44 px reales de alto (regla R6) sin
// ensanchar la fila. El primario va delineado en el acento, como el
// resto de la familia Nocturne.
const ACCION_BASE =
  'inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border px-3 text-[13.5px] font-medium leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent disabled:opacity-50'

export const ACCION_PRIMARIA = `${ACCION_BASE} border-noct-accent bg-noct-accent/10 text-noct-accent-300 hover:bg-noct-accent/[.22]`

export const ACCION_SECUNDARIA = `${ACCION_BASE} border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.07]`

/** Cuanto dura el "Copiado" antes de volver al rotulo normal. */
export const MS_AVISO = 1400
