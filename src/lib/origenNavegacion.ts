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

export interface Origen {
  /** Ruta a la que vuelve el regreso. */
  to: string
  /** Cómo se nombra en el regreso y en la línea de contexto ("Escáner"). */
  etiqueta: string
}

/** Forma del `location.state` que transporta el origen. */
export interface EstadoConOrigen {
  origen?: Origen
}

/**
 * Arma el `state` de un `<Link>` o de `navigate()` que salta de lado, no
 * hacia abajo. Se escribe en el sitio que ORIGINA el salto (el escáner,
 * la topología, la ficha del equipo), nunca en el destino: el destino no
 * puede saber de dónde lo abrieron.
 */
export function conOrigen(to: string, etiqueta: string): EstadoConOrigen {
  return { origen: { to, etiqueta } }
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
  return { to, etiqueta }
}
