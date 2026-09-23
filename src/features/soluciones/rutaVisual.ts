import type { ResumenPaso } from './estadoPasos'

// LA RUTA DEL PROCEDIMIENTO (encargo del 2026-09-22, sección 5).
//
// Una guía se entiende mejor si se ve el camino antes de recorrerlo:
//
//   Navegador → Intranet → SGC → Documentación → Proceso de apoyo → Gestión TI
//
// La ruta es de ORIENTACIÓN: un nodo por paso, con el nombre corto del
// paso y su estado. No enseña el contenido de nadie; debajo sigue mandando
// el paso actual.
//
// El nombre corto sale del título del paso, sin inventar nada: si el
// título empieza por un verbo de NAVEGACIÓN ("Abrir", "Entrar a",
// "Seleccionar", "Hacer clic en"...), el nodo se queda con el destino
// ("Abrir SGC" → "SGC"), que es lo que se ve en la pantalla del equipo.
// Cualquier otro título se deja entero ("Verificar que imprime" no pasa a
// "Que imprime"). Lógica pura, sin React, para probarla aislada.

// Verbos de navegación, en infinitivo y en imperativo (así se escriben
// los títulos de los apuntes), de la forma más larga a la más corta para
// que "hacer clic en" gane a "hacer". Solo los que llevan a un sitio: los
// que describen trabajo ("instalar", "configurar", "verificar") no se
// quitan, porque sin el verbo el nodo ya no diría qué pasa ahí.
const VERBOS_DE_NAVEGACION = [
  'hacer doble clic en',
  'haz doble clic en',
  'hacer doble clic sobre',
  'haz doble clic sobre',
  'hacer clic en',
  'haz clic en',
  'hacer clic sobre',
  'haz clic sobre',
  'dar clic en',
  'da clic en',
  'pulsar en',
  'pulsa en',
  'clic en',
  'entrar a',
  'entrar al',
  'entrar en',
  'entra a',
  'entra al',
  'entra en',
  'ingresar a',
  'ingresar al',
  'ingresar en',
  'ingresa a',
  'ingresa al',
  'ingresa en',
  'acceder a',
  'acceder al',
  'accede a',
  'accede al',
  'ir a',
  'ir al',
  've a',
  've al',
  'navegar a',
  'navegar hasta',
  'navega a',
  'navega hasta',
  'abrir',
  'abre',
  'seleccionar',
  'selecciona',
  'elegir',
  'elige',
  'escoger',
  'escoge',
  'pulsar',
  'pulsa',
  'presionar',
  'presiona',
  'tocar',
  'toca',
  'buscar',
  'busca',
  'localizar',
  'localiza',
  'ubicar',
  'ubica',
]

// Artículos y preposiciones que quedan delante del destino ("Abrir EL
// navegador", "Ir A LA intranet").
const ENLACES = /^(?:a la|a los|a las|al|a|en el|en la|en los|en las|en|el|la|los|las|un|una|del|de)\s+/i

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * El nombre corto de un paso para su nodo de la ruta. Devuelve el título
 * entero cuando no empieza por un verbo de navegación o cuando, al
 * quitarlo, no queda nada que nombrar.
 */
export function etiquetaDeRuta(titulo: string): string {
  const limpio = titulo.trim().replace(/[.:;]+$/, '').trim()
  if (limpio === '') return ''
  const comparable = sinTildes(limpio).toLowerCase()
  const verbo = VERBOS_DE_NAVEGACION.find(
    (v) => comparable === v || comparable.startsWith(`${v} `),
  )
  if (!verbo) return limpio
  let resto = limpio.slice(verbo.length).trim()
  resto = resto.replace(ENLACES, '').trim()
  if (resto.length < 2) return limpio
  return resto.charAt(0).toUpperCase() + resto.slice(1)
}

/** El paso anterior, el actual y el siguiente, para la ruta recortada del teléfono. */
export function vecinosDeRuta(
  resumenes: ResumenPaso[],
  indiceActual: number,
): { previo: ResumenPaso | null; actual: ResumenPaso | null; siguiente: ResumenPaso | null } {
  return {
    previo: resumenes[indiceActual - 1] ?? null,
    actual: resumenes[indiceActual] ?? null,
    siguiente: resumenes[indiceActual + 1] ?? null,
  }
}

/** Lo que dice el nombre accesible de un nodo: posición, nombre y estado. */
export function descripcionDeNodo(resumen: ResumenPaso, total: number): string {
  const estado =
    resumen.estado === 'hecho'
      ? 'hecho'
      : resumen.estado === 'actual'
        ? 'estás aquí'
        : resumen.estado === 'saltado'
          ? 'saltado'
          : 'pendiente'
  const riesgo = resumen.tieneCuidado ? ', con un riesgo que atender' : ''
  return `Paso ${resumen.indice + 1} de ${total}: ${resumen.titulo} (${estado}${riesgo})`
}
