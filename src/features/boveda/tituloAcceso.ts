// Hallazgo S4 de AUDITORIA_FLUJOS_TI.md: la creacion contextual desde
// un equipo (DispositivoPage.tsx) arma el titulo como "Acceso {nombre}",
// congelando el nombre del equipo en un campo de texto libre. Si el
// equipo se renombra despues, el titulo queda desfasado y nada lo
// avisa (a diferencia del resto de la app, que usa referencia viva).
//
// En vez de bakear el nombre en el titulo, se detecta cuando el titulo
// TODAVIA sigue el patron exacto de la creacion contextual (el tecnico
// no lo customizo) y el equipo vinculado ya tiene un nombre distinto:
// ahi se puede sugerir el titulo actualizado en vez de forzarlo.
export const PREFIJO_ACCESO = 'Acceso '

export function tituloAccesoSugerido(
  titulo: string,
  copiaNombre: string,
  nombreVivo: string,
): string | null {
  const vivo = nombreVivo.trim()
  const copia = copiaNombre.trim()
  if (!vivo || vivo === copia) return null
  if (titulo.trim() !== `${PREFIJO_ACCESO}${copia}`) return null
  return `${PREFIJO_ACCESO}${vivo}`
}
