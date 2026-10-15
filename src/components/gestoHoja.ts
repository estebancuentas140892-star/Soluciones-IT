// EL GESTO DE DESLIZAR LA HOJA DEL TELÉFONO (tarea 341, handoff móvil
// "1b Pulgar": "cierra con X, velo o deslizar"). Lo que `Modal` decide al
// soltar el dedo, aparte para poder probarlo sin pantalla.

/** Lo que el dedo tiene que bajar, como mucho, para que la hoja se cierre. */
const UMBRAL_MAXIMO = 120
/** Qué parte de la hoja, si es corta, basta con bajar. */
const FRACCION_DEL_ALTO = 0.25
/** Un tirón rápido cierra aunque baje poco: más de medio píxel por ms... */
const VELOCIDAD_DE_TIRON = 0.5
/** ...y al menos esto, para que un toque tembloroso no cierre nada. */
const MINIMO_DEL_TIRON = 40

/**
 * ¿Se cierra la hoja al soltar? Sí si el dedo bajó la cuarta parte de la
 * hoja (120 px como mucho), o si fue un tirón rápido de 40 px o más. Si
 * no, la hoja vuelve a su sitio.
 */
export function cierraAlSoltar(desplazamiento: number, duracionMs: number, altoHoja: number): boolean {
  if (desplazamiento <= 0) return false
  const umbral = Math.min(UMBRAL_MAXIMO, altoHoja * FRACCION_DEL_ALTO)
  if (desplazamiento >= umbral) return true
  const velocidad = desplazamiento / Math.max(duracionMs, 1)
  return velocidad > VELOCIDAD_DE_TIRON && desplazamiento >= MINIMO_DEL_TIRON
}

/**
 * ¿Empieza un arrastre de la hoja? Solo hacia abajo, más vertical que
 * horizontal, pasados 8 px, y con el contenido de la hoja arriba del todo:
 * si se puede desplazar hacia arriba, el dedo desplaza, no cierra.
 */
export function empiezaArrastre(dx: number, dy: number, scrollTop: number): boolean {
  return scrollTop <= 0 && dy >= 8 && dy > Math.abs(dx)
}
