import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// BUSCAR SIN SALIR DE LO QUE SE ESTÁ HACIENDO (encargo del 2026-09-16,
// secciones 2, 8, 9 y 10).
//
// El buscador global se abre de dos formas, y cada una promete algo
// distinto:
//
//   - NORMAL, desde una sección (Inicio, Guías, Equipos, Red, Más): el
//     técnico todavía no está haciendo nada, así que un resultado puede
//     llevarlo a su ficha, empezar una guía o iniciar un diagnóstico.
//   - CONSULTA, encima de una tarea (la ejecución de una guía, un
//     editor): debajo hay un trabajo a medias, con su paso, su progreso y
//     su cronómetro vivos en memoria. Aquí NADA navega. Se consulta dentro
//     de la capa y, al cerrarla, la tarea sigue exactamente donde estaba.
//
// Las reglas viven aquí, puras y con pruebas, porque de ellas depende que
// un toque accidental no saque al técnico de un procedimiento. En la capa
// solo se pintan.

export type ModoBuscador = 'normal' | 'consulta'

/**
 * La vista rápida que un resultado despliega DENTRO del buscador:
 *
 *   - credencial: usuario y secreto, tapado hasta que se pide (en los dos
 *     modos: es la consulta que más se repite y la que peor tolera un
 *     viaje a la Bóveda);
 *   - comando y atajo: lo que se teclea, con su copia;
 *   - termino y herramienta: la definición, y en una herramienta para qué
 *     sirve, su uso en Metroparques y su estado de uso;
 *   - equipo: nombre, ubicación, marca y modelo, estado e IP.
 */
export type VistaRapida = 'credencial' | 'comando' | 'referencia' | 'equipo'

/**
 * Qué vista rápida abre un resultado, o null si no tiene.
 *
 * En modo normal solo la credencial la tiene (con su botón "Ver"): el
 * resto de las fichas se abren en su pantalla, que es lo que ya hacía la
 * fila y no saca a nadie de ninguna tarea. En modo consulta la tienen
 * todos los tipos que se pueden resolver sin salir de la capa.
 *
 * Un "dato protegido de un equipo" (`campo:`) se indexa con el tipo
 * `dispositivo` pero NO es un equipo: su vista sería la del dato, que se
 * consulta en la ficha del equipo con su propia auditoría. Queda como
 * referencia.
 */
export function vistaRapidaDe(
  resultado: Pick<ResultadoBusqueda, 'id' | 'tipo'>,
  modo: ModoBuscador,
): VistaRapida | null {
  if (resultado.tipo === 'credencial') return 'credencial'
  if (modo === 'normal') return null
  switch (resultado.tipo) {
    case 'comando':
    case 'atajo':
      return 'comando'
    case 'termino':
    case 'herramienta':
      return 'referencia'
    case 'dispositivo':
      return resultado.id.startsWith('dispositivo:') ? 'equipo' : null
    default:
      return null
  }
}

/**
 * ¿Tocar la fila abre la ficha en su pantalla? Solo en modo normal. En
 * consulta la fila despliega su vista rápida o, si no tiene, se queda
 * como referencia que no lleva a ningún sitio.
 */
export function filaNavega(modo: ModoBuscador): boolean {
  return modo === 'normal'
}

/**
 * ¿Se ofrece la acción directa de este tipo de resultado?
 *
 * En consulta NO se ofrece nada que abra otra ejecución (sección 10): ni
 * "Empezar", "Continuar" o "Repetir guía" en una guía, ni "Iniciar" en un
 * diagnóstico. No existe hoy un mecanismo seguro para "abrir al terminar"
 * sin perder la ejecución en curso, así que la guía encontrada queda como
 * referencia. Copiar (una credencial, un comando, un atajo) sí sigue: no
 * abandona nada.
 */
export function ofreceAccionDirecta(tipo: TipoResultado, modo: ModoBuscador): boolean {
  if (modo === 'normal') return true
  return tipo !== 'articulo' && tipo !== 'diagnostico'
}
