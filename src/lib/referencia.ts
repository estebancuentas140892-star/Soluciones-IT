// Regla de referencia viva (fase N1 de PROPUESTA_BASE_CONOCIMIENTO.md).
//
// En toda la app, un vínculo entre dos entidades guarda el id del otro
// extremo MÁS una copia de su título ("copia de referencia"). Esa copia
// existe por el modelo offline primero: permite mostrar el vínculo
// aunque la fila del otro extremo aún no haya sincronizado o ya no
// exista. Pero cuando la fila SÍ vive en la base local, mostrar su copia
// congelada es un error: renombrar un switch dejaría todas sus
// conexiones con el nombre viejo.
//
// La regla, en una línea: si hay un dato vivo (la fila existe local y no
// está eliminada), se muestra; si no, se cae a la copia guardada. Esta
// utilidad la encapsula para que ninguna pantalla la reinvente.
//
// Excepción deliberada: los registros inmutables (historial,
// ejecuciones_diagnostico, accesos_boveda) NO usan esto. Guardan textos
// congelados a propósito porque son fotos del pasado: una ejecución de
// diagnóstico debe mostrar la pregunta tal como era cuando ocurrió, no
// la actual.

// El dato vivo (ya extraído de la fila local, o '' / null / undefined si
// la fila no existe o está eliminada) o, en su defecto, la copia
// guardada. Recorta el vivo para que un texto de solo espacios no gane a
// una copia con contenido real.
export function textoVivo(vivo: string | null | undefined, copia: string): string {
  const limpio = (vivo ?? '').trim()
  return limpio !== '' ? limpio : copia
}

// Fila local mínima para resolver un nombre vivo: se necesita el
// identificador, el texto a mostrar y la marca de eliminación (una fila
// eliminada se trata como ausente, cae a la copia de referencia).
interface FilaConTexto {
  id: string
  eliminadoEn?: string | null
}

// Mapa id -> texto vivo a partir de una lista de filas locales,
// excluyendo las eliminadas. `textoDe` extrae el campo que se muestra
// (nombre en dispositivos, titulo en artículos y credenciales), así la
// misma utilidad sirve para cualquier entidad. Se usa junto a
// `nombreVivo` para resolver una copia de referencia contra la fila viva.
export function mapaDeTextos<T extends FilaConTexto>(
  filas: T[],
  textoDe: (fila: T) => string,
): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const fila of filas) {
    if (fila.eliminadoEn) continue
    mapa.set(fila.id, textoDe(fila))
  }
  return mapa
}

// Resuelve una copia de referencia contra un mapa de textos vivos: el
// texto vivo de la fila si existe, la copia guardada si no (fila sin
// sincronizar o eliminada). Azúcar sobre `textoVivo` para el caso común
// de tener el mapa a mano.
export function nombreVivo(mapa: Map<string, string>, id: string, copia: string): string {
  return textoVivo(mapa.get(id), copia)
}
