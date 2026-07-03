// Decide que hacer con un codigo leido por el escaner (o escrito a
// mano): puede ser una etiqueta QR generada por la app (la URL de la
// ficha del dispositivo) o un codigo ya pegado en el equipo (placa de
// inventario o serial del fabricante). Logica pura, sin camara ni
// base de datos, para poder probarla de forma aislada.

export interface DispositivoEscaneable {
  id: string
  serial: string
  placaInventario: string
  eliminadoEn: string | null
}

export type ResultadoCodigo =
  | { tipo: 'dispositivo'; dispositivoId: string }
  | { tipo: 'varios'; dispositivoIds: string[] }
  | { tipo: 'no_encontrado' }

const RUTA_FICHA = /^\/dispositivos\/([^/]+)\/?$/

// Extrae el id de la ficha si el codigo es una URL de etiqueta. Se
// ignora el origen a proposito: una etiqueta impresa desde produccion
// debe funcionar igual si el dominio cambia o al probar en local.
export function extraerIdDeEtiqueta(codigo: string): string | null {
  let url: URL
  try {
    url = new URL(codigo)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const match = RUTA_FICHA.exec(url.pathname)
  if (!match) return null
  const id = match[1]
  // Rutas hermanas de la ficha que no son un id de dispositivo.
  if (id === 'nuevo' || id === 'etiquetas') return null
  return id
}

function normalizar(valor: string): string {
  return valor.trim().toUpperCase()
}

export function resolverCodigo(
  codigo: string,
  dispositivos: DispositivoEscaneable[],
): ResultadoCodigo {
  const limpio = codigo.trim()
  if (!limpio) return { tipo: 'no_encontrado' }

  const vivos = dispositivos.filter((d) => !d.eliminadoEn)

  const idEtiqueta = extraerIdDeEtiqueta(limpio)
  if (idEtiqueta) {
    const existe = vivos.some((d) => d.id === idEtiqueta)
    return existe ? { tipo: 'dispositivo', dispositivoId: idEtiqueta } : { tipo: 'no_encontrado' }
  }

  // La placa de inventario tiene prioridad: es la etiqueta propia del
  // equipo y se asume unica, mientras que un serial de fabricante
  // podria coincidir por casualidad con la placa de otro dispositivo.
  const buscado = normalizar(limpio)
  const porPlaca = vivos.filter((d) => normalizar(d.placaInventario) === buscado)
  const coincidencias =
    porPlaca.length > 0 ? porPlaca : vivos.filter((d) => normalizar(d.serial) === buscado)

  if (coincidencias.length === 0) return { tipo: 'no_encontrado' }
  if (coincidencias.length === 1) return { tipo: 'dispositivo', dispositivoId: coincidencias[0].id }
  return { tipo: 'varios', dispositivoIds: coincidencias.map((d) => d.id) }
}
