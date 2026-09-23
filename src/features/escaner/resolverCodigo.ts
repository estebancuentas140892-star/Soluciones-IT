// Decide que hacer con un codigo leido por el escaner (o escrito a
// mano): puede ser una etiqueta QR generada por la app (la URL de la
// ficha del dispositivo), un codigo ya pegado en el equipo (placa de
// inventario o serial del fabricante) o, desde la tarea 256, el QR del
// portal de asistencia. Logica pura, sin camara ni base de datos, para
// poder probarla de forma aislada.

export interface DispositivoEscaneable {
  id: string
  serial: string
  placaInventario: string
  eliminadoEn: string | null
}

export type ResultadoCodigo =
  | { tipo: 'dispositivo'; dispositivoId: string }
  | { tipo: 'varios'; dispositivoIds: string[] }
  | { tipo: 'asistencia'; codigo: string }
  | { tipo: 'no_encontrado' }

const RUTA_FICHA = /^\/dispositivos\/([^/]+)\/?$/
const RUTA_CONECTAR = /^\/conectar\/?$/

// Un codigo leido como URL web, o null si no lo es.
function comoUrlWeb(codigo: string): URL | null {
  let url: URL
  try {
    url = new URL(codigo)
  } catch {
    return null
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
}

// Extrae el id de la ficha si el codigo es una URL de etiqueta. Se
// ignora el origen a proposito: una etiqueta impresa desde produccion
// debe funcionar igual si el dominio cambia o al probar en local.
export function extraerIdDeEtiqueta(codigo: string): string | null {
  const url = comoUrlWeb(codigo)
  if (!url) return null
  const match = RUTA_FICHA.exec(url.pathname)
  if (!match) return null
  const id = match[1]
  // Rutas hermanas de la ficha que no son un id de dispositivo.
  if (id === 'nuevo' || id === 'etiquetas') return null
  return id
}

// EL QR DEL PORTAL DE ASISTENCIA (encargo del 2026-09-22, secciones 11
// y 18): el computador que pide ayuda enseña un codigo de 6 cifras y un
// QR que lleva a `/conectar?codigo=482731`. Mismo criterio que la
// etiqueta: el origen no importa. Solo cuenta un codigo de 6 cifras; un
// numero de 6 cifras escrito a mano NO, porque puede ser una placa.
export function extraerCodigoAsistencia(codigo: string): string | null {
  const url = comoUrlWeb(codigo)
  if (!url || !RUTA_CONECTAR.test(url.pathname)) return null
  const valor = (url.searchParams.get('codigo') ?? '').replace(/\s+/g, '')
  return /^\d{6}$/.test(valor) ? valor : null
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

  const asistencia = extraerCodigoAsistencia(limpio)
  if (asistencia) return { tipo: 'asistencia', codigo: asistencia }

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
