// Iniciales para el avatar de la cuenta en la barra superior (tarea 181,
// mockup 3d: circulo de 30 px con dos letras). Se calcula aparte y con
// pruebas porque los nombres reales del equipo traen de todo: un solo
// nombre, nombre y dos apellidos, espacios de mas, o ningun nombre y
// solo el correo.

/**
 * Devuelve una o dos letras en mayuscula para identificar a la persona.
 * Prefiere el nombre; si no hay, usa la parte local del correo. Si no hay
 * nada utilizable devuelve cadena vacia, y quien la use decide el
 * respaldo (el icono generico de usuario).
 */
export function inicialesDe(nombre?: string | null, correo?: string | null): string {
  const palabras = (nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)

  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase()
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()

  const local = (correo ?? '').trim().split('@')[0]
  if (local.length > 0) return local.slice(0, 2).toUpperCase()

  return ''
}
