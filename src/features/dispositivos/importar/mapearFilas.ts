import type { Dispositivo } from '../../../lib/db'

// Convierte la matriz de celdas de un archivo (CSV o Excel) en
// dispositivos listos para guardar. La primera fila son los
// encabezados: cada columna se asigna a un campo fijo por su nombre
// (aceptando sinónimos, mayúsculas y acentos), y las columnas que no
// se reconocen se conservan como "Campos adicionales" para no perder
// información. Las filas que no se pueden importar se reportan con su
// número y el motivo, nunca se descartan en silencio.

export type CampoFijo =
  | 'nombre'
  | 'categoria'
  | 'marca'
  | 'modelo'
  | 'serial'
  | 'placaInventario'
  | 'ubicacion'
  | 'ip'
  | 'estado'
  | 'observaciones'

const ALIAS_POR_CAMPO: Record<CampoFijo, string[]> = {
  nombre: ['nombre', 'equipo', 'dispositivo', 'nombre del equipo', 'nombre del dispositivo'],
  categoria: ['categoria', 'tipo', 'tipo de equipo', 'tipo de dispositivo'],
  marca: ['marca', 'fabricante'],
  modelo: ['modelo', 'referencia'],
  serial: [
    'serial',
    'serie',
    'numero de serie',
    'no de serie',
    'no serie',
    'num serie',
    'nro serie',
    'n de serie',
    'sn',
    's/n',
  ],
  placaInventario: [
    'placa',
    'placa de inventario',
    'placa inventario',
    'activo',
    'activo fijo',
    'inventario',
    'codigo de inventario',
    'codigo inventario',
  ],
  ubicacion: ['ubicacion', 'sede', 'area', 'oficina', 'lugar', 'sitio'],
  ip: ['ip', 'direccion ip'],
  estado: ['estado', 'estatus', 'condicion'],
  observaciones: ['observaciones', 'observacion', 'notas', 'nota', 'comentarios', 'comentario', 'descripcion'],
}

export const ETIQUETA_CAMPO: Record<CampoFijo, string> = {
  nombre: 'Nombre',
  categoria: 'Categoría',
  marca: 'Marca',
  modelo: 'Modelo',
  serial: 'Serial',
  placaInventario: 'Placa de inventario',
  ubicacion: 'Ubicación',
  ip: 'IP',
  estado: 'Estado',
  observaciones: 'Observaciones',
}

export type DestinoColumna =
  | { tipo: 'campo'; campo: CampoFijo }
  | { tipo: 'detalle'; nombre: string }
  | { tipo: 'ignorada' }

export interface ColumnaDetectada {
  encabezado: string
  destino: DestinoColumna
}

export type DatosDispositivo = Omit<Dispositivo, 'id' | 'updatedAt' | 'updatedBy' | 'eliminadoEn'>

export interface FilaImportable {
  numeroFila: number
  datos: DatosDispositivo
}

export interface FilaOmitida {
  numeroFila: number
  motivo: string
}

export interface CategoriaDisponible {
  id: string
  nombre: string
}

export interface OpcionesMapeo {
  categorias: CategoriaDisponible[]
  // Categoría que reciben las filas sin valor en la columna de
  // categoría (o todas, si el archivo no trae esa columna).
  categoriaPredeterminadaId?: string
  // Seriales y placas ya registrados: esas filas se omiten para poder
  // reintentar un archivo importado a medias sin crear duplicados.
  serialesExistentes?: Iterable<string>
  placasExistentes?: Iterable<string>
}

export interface ResultadoMapeo {
  // Problema que impide importar cualquier fila (sin encabezados
  // reconocibles, archivo vacío); null si se puede continuar.
  errorGeneral: string | null
  columnas: ColumnaDetectada[]
  importables: FilaImportable[]
  omitidas: FilaOmitida[]
  // true si alguna fila depende de la categoría predeterminada.
  hayFilasSinCategoria: boolean
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Para comparar encabezados también se ignora la puntuación: "No. de
// serie" debe encontrar el alias "no de serie". No se usa para los
// valores: un serial "SN-100" no es lo mismo que "SN100".
export function normalizarEncabezado(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function mapearFilas(filas: string[][], opciones: OpcionesMapeo): ResultadoMapeo {
  const sinResultado = (error: string): ResultadoMapeo => ({
    errorGeneral: error,
    columnas: [],
    importables: [],
    omitidas: [],
    hayFilasSinCategoria: false,
  })

  if (filas.length === 0) return sinResultado('El archivo está vacío.')
  if (filas.length === 1) {
    return sinResultado('El archivo solo tiene la fila de encabezados, sin datos.')
  }

  const columnas = detectarColumnas(filas[0])
  const hayColumnaNombre = columnas.some(
    (c) => c.destino.tipo === 'campo' && c.destino.campo === 'nombre',
  )
  if (!hayColumnaNombre) {
    return sinResultado(
      'No se encontró la columna del nombre. La primera fila debe tener encabezados, por ejemplo: Nombre, Categoría, Marca, Serial, Ubicación.',
    )
  }

  const categoriaPorNombre = new Map(opciones.categorias.map((c) => [normalizar(c.nombre), c.id]))
  const serialesVistos = new Map<string, number>()
  const placasVistas = new Map<string, number>()
  const serialesExistentes = new Set([...(opciones.serialesExistentes ?? [])].map(normalizar))
  const placasExistentes = new Set([...(opciones.placasExistentes ?? [])].map(normalizar))

  const importables: FilaImportable[] = []
  const omitidas: FilaOmitida[] = []
  let hayFilasSinCategoria = false

  for (let indice = 1; indice < filas.length; indice += 1) {
    const celdas = filas[indice]
    // Al contar desde 1 y saltar los encabezados, el número coincide
    // con el que muestra Excel.
    const numeroFila = indice + 1
    if (celdas.every((celda) => celda.trim() === '')) continue

    const datos: DatosDispositivo = {
      categoriaId: '',
      nombre: '',
      marca: '',
      modelo: '',
      serial: '',
      placaInventario: '',
      ubicacion: '',
      ip: '',
      estado: '',
      observaciones: '',
      detalles: {},
    }
    let textoCategoria = ''

    columnas.forEach((columna, indiceColumna) => {
      const valor = (celdas[indiceColumna] ?? '').trim()
      if (columna.destino.tipo === 'ignorada' || valor === '') return
      if (columna.destino.tipo === 'detalle') {
        datos.detalles[columna.destino.nombre] = valor
        return
      }
      if (columna.destino.campo === 'categoria') {
        textoCategoria = valor
        return
      }
      datos[columna.destino.campo] = valor
    })

    if (datos.nombre === '') {
      omitidas.push({ numeroFila, motivo: 'No tiene nombre.' })
      continue
    }

    if (textoCategoria !== '') {
      const categoriaId = categoriaPorNombre.get(normalizar(textoCategoria))
      if (!categoriaId) {
        omitidas.push({ numeroFila, motivo: `La categoría "${textoCategoria}" no existe en la app.` })
        continue
      }
      datos.categoriaId = categoriaId
    } else {
      hayFilasSinCategoria = true
      if (!opciones.categoriaPredeterminadaId) {
        omitidas.push({ numeroFila, motivo: 'No tiene categoría.' })
        continue
      }
      datos.categoriaId = opciones.categoriaPredeterminadaId
    }

    const serial = normalizar(datos.serial)
    if (serial !== '') {
      if (serialesExistentes.has(serial)) {
        omitidas.push({ numeroFila, motivo: `Ya hay un dispositivo con el serial "${datos.serial}".` })
        continue
      }
      const filaRepetida = serialesVistos.get(serial)
      if (filaRepetida !== undefined) {
        omitidas.push({ numeroFila, motivo: `Serial repetido en el archivo (igual a la fila ${filaRepetida}).` })
        continue
      }
    }

    const placa = normalizar(datos.placaInventario)
    if (placa !== '') {
      if (placasExistentes.has(placa)) {
        omitidas.push({
          numeroFila,
          motivo: `Ya hay un dispositivo con la placa "${datos.placaInventario}".`,
        })
        continue
      }
      const filaRepetida = placasVistas.get(placa)
      if (filaRepetida !== undefined) {
        omitidas.push({ numeroFila, motivo: `Placa repetida en el archivo (igual a la fila ${filaRepetida}).` })
        continue
      }
    }

    if (serial !== '') serialesVistos.set(serial, numeroFila)
    if (placa !== '') placasVistas.set(placa, numeroFila)
    importables.push({ numeroFila, datos })
  }

  return { errorGeneral: null, columnas, importables, omitidas, hayFilasSinCategoria }
}

function detectarColumnas(encabezados: string[]): ColumnaDetectada[] {
  const aliasNormalizados = new Map<string, CampoFijo>()
  for (const [campo, alias] of Object.entries(ALIAS_POR_CAMPO) as [CampoFijo, string[]][]) {
    for (const nombre of alias) aliasNormalizados.set(normalizarEncabezado(nombre), campo)
  }

  const camposAsignados = new Set<CampoFijo>()
  return encabezados.map((encabezado) => {
    const limpio = encabezado.trim()
    if (limpio === '') return { encabezado: limpio, destino: { tipo: 'ignorada' as const } }
    const campo = aliasNormalizados.get(normalizarEncabezado(limpio))
    // El mismo campo dos veces (por ejemplo "Serial" y "No. de serie"):
    // la primera columna gana y la otra queda como campo adicional.
    if (campo && !camposAsignados.has(campo)) {
      camposAsignados.add(campo)
      return { encabezado: limpio, destino: { tipo: 'campo' as const, campo } }
    }
    return { encabezado: limpio, destino: { tipo: 'detalle' as const, nombre: limpio } }
  })
}

// Plantilla de ejemplo que se ofrece para descargar. Va con punto y
// coma (el separador que Excel espera en la configuración regional en
// español) y con BOM para que Excel la abra como UTF-8.
export function generarPlantillaCsv(): string {
  const filas = [
    [
      'Nombre',
      'Categoría',
      'Marca',
      'Modelo',
      'Serial',
      'Placa de inventario',
      'Ubicación',
      'IP',
      'Estado',
      'Observaciones',
    ],
    ['POS caja 1', 'POS', 'HP', 'Engage One', 'SN-12345', 'INV-001', 'Sede principal', '192.168.1.50', 'Operativo', ''],
    [
      'Impresora recepción',
      'Impresoras',
      'Epson',
      'TM-T20III',
      'SN-67890',
      'INV-002',
      'Recepción',
      '',
      'Operativo',
      'Térmica de 80 mm',
    ],
  ]
  return String.fromCharCode(0xfeff) + filas.map((fila) => fila.join(';')).join('\r\n')
}
