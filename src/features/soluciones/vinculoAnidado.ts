import type { Procedimiento } from '../../lib/db'
import { procedimientoEjecutable } from '../../lib/procedimiento'

// UN COLOR, UN SIGNIFICADO DENTRO DEL PASO (hallazgo M-012, regla
// M-R11; y el turno 12 de la auditoría de Soluciones, que pidió lo
// mismo con estas medidas exactas).
//
// Un paso podía llegar a mostrar CINCO marcos de color anidados y dos
// de ellos del mismo tono con significados distintos: el ámbar era a la
// vez advertencia, pregunta de error y solución vinculada; el acento,
// subprocedimiento y credencial protegida. Con la advertencia real
// compitiendo contra tres marcos de su mismo color, dejaba de destacar.
//
// La corrección es una sola: LA PROFUNDIDAD SE DIBUJA, NO SE COLOREA.
// Línea vertical neutra de 2 px más 13 px de sangría, el patrón de una
// cita. Escala a cualquier tipo de vínculo sin gastar un color nuevo y,
// con un solo nivel de anidamiento permitido, nunca hay más de una
// sangría por documento.
//
// 13 px y no más: en 448 px cada nivel cuesta ancho de lectura, y 13
// bastan para leer la jerarquía sin estrangular el texto.
export const ZONA_ANIDADA = 'border-l-2 border-noct-divider pl-[13px]'

// Un vínculo del paso se despliega aquí mismo o solo se enlaza. La
// decisión ya existía repartida por cuatro componentes con la misma
// condición copiada; aquí se dice una vez.
export type ModoVinculo = 'expandible' | 'enlazado'

export function modoVinculo(nivel: number, procedimiento: Procedimiento | null): ModoVinculo {
  return nivel >= 1 || !procedimientoEjecutable(procedimiento) ? 'enlazado' : 'expandible'
}

// Regla R58 del turno 12: un control que SALE de la pantalla se ve
// distinto de uno que despliega en el sitio, y promete el regreso.
// Hasta ahora la tarjeta enlazada y la desplegable eran idénticas
// (mismo marco, mismo icono), así que el técnico tocaba esperando ver
// los pasos y salía de la pantalla.
export const PROMESA_REGRESO = 'Se abre aparte, vuelves aquí al terminar'

// Regla R57 del turno 12: un indicador de avance por documento, y dice
// A QUÉ DOCUMENTO pertenece. Antes el mismo dato se dibujaba tres
// veces (la barra del principal, el anillo del vínculo y otra barra al
// pie del anidado), midiendo cosas distintas sin decir cuál era cuál.
export function fraseAvanceDocumento(
  hechos: number,
  total: number,
  sustantivo: 'guía' | 'contingencia',
): string {
  if (total <= 0) return `Esta ${sustantivo} no tiene pasos`
  if (hechos >= total) return `Esta ${sustantivo} está completa, ${total} de ${total}`
  return `Paso ${hechos + 1} de ${total} de esta ${sustantivo}`
}
