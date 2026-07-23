// Helper generico de coercion de texto, sin dependencias de dominio.
// Vive aca (y no repetido en cada modulo que lo necesita) para que
// procedimiento.ts, diagnostico.ts y cualquier otro que reciba datos
// sueltos (por ejemplo de un JSON importado o de Supabase) compartan
// la misma regla.

// Valor arbitrario -> texto. Cualquier cosa que no sea string (null,
// undefined, numero, objeto) se trata como ausente y cae a ''.
export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

// Busqueda local por subcadena sobre varios campos de una ficha, la
// regla que repetian calcada los buscadores de Soluciones, Dispositivos
// y Red (Fase 1 de PROPUESTA_REVISION_ARQUITECTURA.md). Une los campos
// con un espacio y compara en minusculas; una consulta vacia acepta
// todo (el buscador en blanco no filtra nada).
//
// NO sustituye al indice global (`features/busqueda`), que es otra cosa:
// aquel puntua, tolera errores de tecleo y expande sinonimos, pero solo
// indexa articulos publicados y devuelve un resultado generico sin los
// campos que estas listas muestran (IP, estado, ubicacion). Estos tres
// buscadores filtran EN EL SITIO la lista que la pantalla ya tiene
// cargada, incluidos los borradores, y por eso siguen siendo de
// subcadena. Lo que se unifica aqui es la regla, no el motor.
export function incluyeTexto(campos: (string | null | undefined)[], consulta: string): boolean {
  const buscado = consulta.trim().toLowerCase()
  if (!buscado) return true
  // `join` ya convierte null/undefined en '', igual que hacian las tres
  // pantallas antes de esta extraccion.
  return campos.join(' ').toLowerCase().includes(buscado)
}
