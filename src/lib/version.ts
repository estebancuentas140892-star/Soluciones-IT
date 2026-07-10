// Version legible de un articulo ("1.0", "1.1", "2.0"): logica pura,
// separada del formulario para poder probarla sin React. Solo se
// calcula una vez por guardado, sobre un articulo que YA estaba
// publicado (ver comentario en ArticuloForm.tsx): editar un borrador
// no mueve la version hasta que se publique.

// Sube la version menor (1.0 -> 1.1) o, si es un cambio mayor, la
// version mayor (1.0 -> 2.0, reiniciando la menor a 0). Tolera un
// texto mal formado (por ejemplo vacio o sin punto): cae a "1.0" como
// version base antes de subir, para no bloquear el guardado por un
// dato viejo o corrupto.
export function siguienteVersion(actual: string, cambioMayor: boolean): string {
  const partes = actual.trim().split('.')
  const mayor = partes[0] ? Number(partes[0]) : NaN
  const menor = partes[1] ? Number(partes[1]) : NaN
  const mayorValido = Number.isInteger(mayor) && mayor >= 0 ? mayor : 1
  const menorValido = Number.isInteger(menor) && menor >= 0 ? menor : 0

  if (cambioMayor) return `${mayorValido + 1}.0`
  return `${mayorValido}.${menorValido + 1}`
}
