import type { Table } from 'dexie'
import {
  db,
  type Adjunto,
  type Articulo,
  type Categoria,
  type Conexion,
  type Credencial,
  type Dispositivo,
  type HistorialEntrada,
} from './db'

// Tablas que se sincronizan con Supabase, en el orden en que deben
// descargarse (las categorias primero porque el resto depende de ellas).
// conexiones va al final a proposito: es la tabla mas nueva y, si el
// esquema todavia no se aplico en el servidor, su fallo no impide
// descargar las demas.
export const TABLAS_SINCRONIZADAS = [
  'categorias',
  'articulos',
  'dispositivos',
  'credenciales',
  'adjuntos',
  'historial',
  'conexiones',
] as const

export type TablaSincronizada = (typeof TABLAS_SINCRONIZADAS)[number]

// Tablas que se editan desde la app (el historial solo se agrega
// mediante el repositorio, nunca directamente).
export type TablaEditable = Exclude<TablaSincronizada, 'historial'>

export interface EntidadPorTabla {
  categorias: Categoria
  articulos: Articulo
  dispositivos: Dispositivo
  conexiones: Conexion
  credenciales: Credencial
  adjuntos: Adjunto
  historial: HistorialEntrada
}

interface ConfigTabla {
  // Columna remota que usa la sincronizacion para saber que hay de
  // nuevo. La pone siempre el servidor.
  columnaCursor: string
  // true para tablas donde solo se insertan filas (historial).
  soloInsercion: boolean
  // Propiedad local (camelCase) -> columna remota (snake_case).
  campos: Record<string, string>
}

const camposComunes = {
  id: 'id',
  updatedAt: 'updated_at',
  updatedBy: 'updated_by',
  eliminadoEn: 'eliminado_en',
}

export const configTablas: Record<TablaSincronizada, ConfigTabla> = {
  categorias: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: { ...camposComunes, nombre: 'nombre', icono: 'icono', orden: 'orden', esRed: 'es_red' },
  },
  articulos: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      categoriaId: 'categoria_id',
      titulo: 'titulo',
      tipo: 'tipo',
      contenido: 'contenido',
      etiquetas: 'etiquetas',
      procedimiento: 'procedimiento',
      sintomas: 'sintomas',
      causas: 'causas',
      dispositivosAfectados: 'dispositivos_afectados',
      esRutaInicio: 'es_ruta_inicio',
    },
  },
  dispositivos: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      categoriaId: 'categoria_id',
      nombre: 'nombre',
      marca: 'marca',
      modelo: 'modelo',
      serial: 'serial',
      placaInventario: 'placa_inventario',
      ubicacion: 'ubicacion',
      ip: 'ip',
      estado: 'estado',
      observaciones: 'observaciones',
      detalles: 'detalles',
    },
  },
  conexiones: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      tipo: 'tipo',
      origenId: 'origen_id',
      origenNombre: 'origen_nombre',
      origenPuerto: 'origen_puerto',
      destinoId: 'destino_id',
      destinoNombre: 'destino_nombre',
      destinoPuerto: 'destino_puerto',
      medio: 'medio',
      notas: 'notas',
    },
  },
  credenciales: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      titulo: 'titulo',
      categoria: 'categoria',
      datosCifrados: 'datos_cifrados',
    },
  },
  adjuntos: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      entidadTipo: 'entidad_tipo',
      entidadId: 'entidad_id',
      nombre: 'nombre',
      tipo: 'tipo',
      referencia: 'referencia',
    },
  },
  historial: {
    columnaCursor: 'recibido_en',
    soloInsercion: true,
    campos: {
      id: 'id',
      entidadTipo: 'entidad_tipo',
      entidadId: 'entidad_id',
      usuario: 'usuario',
      usuarioNombre: 'usuario_nombre',
      fechaHora: 'fecha_hora',
      campo: 'campo',
      valorAnterior: 'valor_anterior',
      valorNuevo: 'valor_nuevo',
      motivo: 'motivo',
    },
  },
}

export function storeDe<T extends TablaSincronizada>(tabla: T): Table<EntidadPorTabla[T], string> {
  return db.table(tabla)
}

// Convierte una entidad local en una fila para Supabase. No envia
// updated_at ni updated_by porque los pone siempre el servidor.
export function aFilaRemota(tabla: TablaSincronizada, entidad: unknown): Record<string, unknown> {
  const origen = entidad as Record<string, unknown>
  const fila: Record<string, unknown> = {}
  for (const [local, remota] of Object.entries(configTablas[tabla].campos)) {
    if (local === 'updatedAt' || local === 'updatedBy') continue
    fila[remota] = origen[local]
  }
  return fila
}

// Convierte una fila recibida de Supabase en una entidad local.
export function aEntidadLocal<T extends TablaSincronizada>(
  tabla: T,
  fila: Record<string, unknown>,
): EntidadPorTabla[T] {
  const entidad: Record<string, unknown> = {}
  for (const [local, remota] of Object.entries(configTablas[tabla].campos)) {
    entidad[local] = fila[remota] ?? null
  }
  return entidad as unknown as EntidadPorTabla[T]
}
