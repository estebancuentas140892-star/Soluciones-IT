// LAS PIEZAS DE «VENTANA» EN EL TELÉFONO (tarea 350, implementación fiel del
// prototipo de Claude Design). Las mismas cadenas para todos los módulos del
// teléfono (Inicio, búsqueda, Equipos, guías, Más), para que una tarjeta o un
// chip no se dibuje distinto en cada pantalla (regla 31 e). Solo se usan por
// debajo de 768 px: o en ramas de `useEsAncho`, o con `max-md:`.
//
// El RELIEVE es la firma del prototipo: un borde inferior de 3 o 4 px del
// color del borde (o del «borde» del relleno) que da cuerpo a lo que se toca.
// Al pulsar, el botón baja 3 px y el relieve se queda en 1: responde al dedo
// en el mismo gesto, sin animación que espere.

/** Superficie de una tarjeta: el fondo de la superficie con su borde de 1.5 px. */
export const TARJETA = 'rounded-2xl border-[1.5px] border-noct-divider bg-noct-surface'

/** Una tarjeta que se toca entera (una fila de resultado, una categoría). */
export const TARJETA_TOCABLE = `${TARJETA} cursor-pointer text-left text-noct-text active:bg-noct-presionado`

/** El relieve de una tarjeta o de un control delineado: 3 px del borde. */
export const RELIEVE_BORDE = 'shadow-[0_3px_0_var(--color-noct-divider)]'

/** El relieve de un control delineado con borde fuerte (el pie, «No, sigue igual»). */
export const RELIEVE_BORDE_FUERTE =
  'shadow-[0_4px_0_var(--color-noct-divider-fuerte)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-noct-divider-fuerte)]'

/** El relleno de la acción que avanza, con su relieve: «Empezar», «Listo». */
export const RELLENO_ACCION =
  'cursor-pointer bg-noct-accent font-extrabold text-noct-on-accent shadow-[0_4px_0_var(--color-noct-accent-borde)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-noct-accent-borde)]'

/** El relleno verde que afirma lo resuelto, con su relieve. */
export const RELLENO_RESUELTO =
  'cursor-pointer bg-noct-exito-solido font-extrabold text-noct-on-exito shadow-[0_4px_0_var(--color-noct-exito-borde)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-noct-exito-borde)]'

/**
 * Un chip de filtro o de ejemplo: 36 de dibujo y 44 de toque (`toque-amplio`).
 * Activo, se rellena con la tinta: el filtro elegido se ve sin leer.
 */
export const CHIP = 'toque-amplio relative inline-flex h-9 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-[14px] font-bold'
export const CHIP_REPOSO = 'border-noct-divider bg-noct-surface text-noct-text active:bg-noct-presionado'
export const CHIP_ACTIVO = 'border-noct-text bg-noct-text text-noct-bg'

/** Copiar un dato desde su fila: 44 x 44, el tinte del acento. */
export const BOTON_COPIAR =
  'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-noct-accent-900 text-noct-accent-300 active:bg-noct-accent-800'

/** El título de una sección de una pantalla raíz (Inicio, Más): 16 · 800. */
export const TITULO_SECCION = 'text-[16px] font-extrabold leading-snug'

/** El título de un grupo de resultados (Mejor coincidencia, Equipos): 15 · 800 en tinta 2. */
export const TITULO_GRUPO = 'text-[15px] font-extrabold leading-snug text-noct-neutral-300'

/** El título de una pantalla raíz del teléfono (Equipos, Bóveda, Más): 26 · 800. */
export const TITULO_PANTALLA = 'text-[26px] font-extrabold leading-[1.15] tracking-[-.02em]'
