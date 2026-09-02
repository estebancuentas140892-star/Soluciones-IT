// LA REGLA DE "SE ENCOGE AL BAJAR", COMO FUNCIÓN PURA (tarea 207,
// hallazgo M-033). Vive fuera del componente por dos razones: la
// decisión tiene más matices de los que parece (dirección, umbral y
// zona de arranque) y el entorno de verificación no despacha eventos de
// scroll con el panel oculto, así que sin esto la regla no se podría
// probar de ninguna forma.

// Movimiento mínimo para que un desplazamiento cuente como dirección.
// Sin él, el rebote elástico de iOS y cualquier micromovimiento del dedo
// harían parpadear la barra entre sus dos tamaños.
export const UMBRAL_DIRECCION_PX = 8

// Por debajo de esto la barra siempre va entera: al principio de la
// pantalla no hay nada que ganar encogiéndola.
export const UMBRAL_ARRANQUE_PX = 40

export interface EstadoContraible {
  contraida: boolean
  // Última posición que decidió algo, no la última posición vista: así
  // el umbral se mide contra el punto de la decisión anterior y un
  // arrastre lento acumula hasta cruzarlo, en vez de perderse en
  // movimientos de un píxel.
  ultimo: number
}

export function decidirContraida(estado: EstadoContraible, y: number): EstadoContraible {
  if (y <= UMBRAL_ARRANQUE_PX) return { contraida: false, ultimo: y }
  const delta = y - estado.ultimo
  if (Math.abs(delta) < UMBRAL_DIRECCION_PX) return estado
  return { contraida: delta > 0, ultimo: y }
}
