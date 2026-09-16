// De dónde vino el técnico, cuando no vino de la lista padre (auditoría
// móvil del 2026-08-03, hallazgos M-002, M-020 y M-029, regla M-R2).
//
// `padreDe()` (src/lib/navegacion.ts) resuelve el padre LÓGICO de cada
// ruta, y esa decisión sigue siendo correcta: es determinista, a prueba
// de enlaces profundos y de recargas, y evita que "volver" caiga en un
// formulario recién enviado. Lo que la auditoría mide es que el padre
// lógico no siempre es el sitio del que se vino:
//
//   - escanear un equipo y abrir su ficha deja al técnico en Equipos, no
//     en el escáner con la cámara viva (M-029);
//   - abrir un equipo desde la topología lo devuelve a la lista de Red
//     (M-020);
//   - llegar a una Ubicación o a una Persona desde la ficha de un equipo
//     no dice desde cuál (M-002).
//
// La regla M-R2 pide que volver **deshaga el último salto** y que el
// rótulo nombre el destino real. Esto NO reemplaza a `padreDe`: lo
// matiza. El padre sigue siendo el respaldo, y por eso el origen vive en
// `location.state`:
//
//   - es por ENTRADA DE HISTORIAL, así que expresa exactamente "el
//     último salto" y no sobrevive a saltos que no le corresponden;
//   - al recargar o abrir un enlace compartido llega vacío, y la
//     pantalla cae sola al padre declarado, que es lo que se quiere;
//   - no ensucia la URL, así que un enlace que el equipo comparta sigue
//     siendo el mismo de siempre.
//
// La alternativa de meterlo en la query (`?desde=escaner`) se descartó
// justo por lo último: el equipo guarda y comparte enlaces profundos, y
// arrastrarían de dónde venía quien lo copió.

// LA BÚSQUEDA TAMBIÉN VUELVE (encargo del 2026-09-16, sección 13).
//
// Abrir una ficha desde un resultado y volver devolvía a la pantalla
// correcta, pero con el buscador vacío: el técnico tenía que escribir
// otra vez lo mismo para seguir comparando resultados. El origen de un
// salto que sale del buscador lleva ahora, además, QUÉ estaba escrito y
// si la capa global estaba abierta, y el regreso se lo devuelve a la
// pantalla de la que salió.
//
// Por el mismo canal y con las mismas garantías que el origen: vive en
// `location.state` (por entrada de historial, fuera de la URL, sin
// localStorage) y se pierde al cerrar la pestaña. Nunca viaja un
// secreto: la consulta es lo que el técnico tecleó en el buscador, y el
// contenido descifrado de la Bóveda no pasa jamás por aquí.

/** Lo que el técnico tenía escrito al saltar desde el buscador. */
export interface BusquedaEnCurso {
  /** La consulta tal cual se escribió. */
  consulta: string
  /** true: la capa del buscador global; false: el buscador en línea de Inicio. */
  capa: boolean
}

export interface Origen {
  /** Ruta a la que vuelve el regreso. */
  to: string
  /** Cómo se nombra en el regreso y en la línea de contexto ("Escáner"). */
  etiqueta: string
  /** La búsqueda que hay que reponer al volver, si el salto salió de ella. */
  busqueda?: BusquedaEnCurso
}

/** Forma del `location.state` que transporta el origen. */
export interface EstadoConOrigen {
  origen?: Origen
}

/** Forma del `location.state` con el que una pantalla repone su búsqueda. */
export interface EstadoConBusqueda {
  busqueda?: BusquedaEnCurso
}

/**
 * Arma el `state` de un `<Link>` o de `navigate()` que salta de lado, no
 * hacia abajo. Se escribe en el sitio que ORIGINA el salto (el escáner,
 * la topología, la ficha del equipo), nunca en el destino: el destino no
 * puede saber de dónde lo abrieron.
 */
export function conOrigen(to: string, etiqueta: string, busqueda?: BusquedaEnCurso): EstadoConOrigen {
  return { origen: busqueda ? { to, etiqueta, busqueda } : { to, etiqueta } }
}

/**
 * Lee el origen de un `location.state` cualquiera, validándolo.
 *
 * Es defensivo a propósito: `state` es un canal sin tipo que sobrevive a
 * recargas del historial y puede traer cualquier cosa (otra versión de
 * la app, un estado de otra pantalla). Si no trae un origen con las dos
 * cadenas no vacías, devuelve `null` y quien llama cae al padre
 * declarado, que siempre existe.
 */
export function leerOrigen(state: unknown): Origen | null {
  if (!state || typeof state !== 'object') return null
  const { origen } = state as EstadoConOrigen
  if (!origen || typeof origen !== 'object') return null
  const { to, etiqueta } = origen
  if (typeof to !== 'string' || typeof etiqueta !== 'string') return null
  if (to.trim() === '' || etiqueta.trim() === '') return null
  // Una búsqueda mal formada no invalida el origen: se vuelve igual, solo
  // que sin reponer nada.
  const busqueda = validarBusqueda(origen.busqueda)
  return busqueda ? { to, etiqueta, busqueda } : { to, etiqueta }
}

/**
 * El `state` con el que el regreso devuelve la búsqueda a su pantalla, o
 * undefined si el salto no salió de un buscador.
 */
export function estadoDeRegreso(origen: Origen | null): EstadoConBusqueda | undefined {
  return origen?.busqueda ? { busqueda: origen.busqueda } : undefined
}

/**
 * La búsqueda que una pantalla tiene que reponer al montarse, leída de
 * su `location.state`. Mismo criterio defensivo que `leerOrigen`: ante
 * cualquier cosa que no sea una búsqueda usable, null.
 */
export function leerBusquedaRestaurada(state: unknown): BusquedaEnCurso | null {
  if (!state || typeof state !== 'object') return null
  return validarBusqueda((state as EstadoConBusqueda).busqueda)
}

/**
 * El `state` de la entrada ACTUAL con la búsqueda anotada, conservando lo
 * que ya llevaba (su propio origen, por ejemplo). Es lo que permite que
 * el botón atrás del teléfono, y no solo el regreso de la app, encuentre
 * la búsqueda al volver.
 */
export function anotarBusqueda(state: unknown, busqueda: BusquedaEnCurso): Record<string, unknown> {
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {}
  return { ...base, busqueda }
}

/** El mismo `state` sin la búsqueda: el técnico la dio por terminada. */
export function sinBusqueda(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null
  const resto = { ...(state as Record<string, unknown>) }
  delete resto.busqueda
  return Object.keys(resto).length > 0 ? resto : null
}

function validarBusqueda(valor: unknown): BusquedaEnCurso | null {
  if (!valor || typeof valor !== 'object') return null
  const { consulta, capa } = valor as Partial<BusquedaEnCurso>
  if (typeof consulta !== 'string' || typeof capa !== 'boolean') return null
  // Una consulta en blanco no es nada que reponer.
  if (consulta.trim() === '') return null
  return { consulta, capa }
}
