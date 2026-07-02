import Dexie, { type EntityTable } from 'dexie'

export interface Categoria {
  id: string
  nombre: string
  icono: string
  orden: number
}

export type TipoArticulo =
  | 'instalacion'
  | 'configuracion'
  | 'conexion'
  | 'problema_frecuente'
  | 'mantenimiento'
  | 'manual'

export interface Articulo {
  id: string
  categoriaId: string
  titulo: string
  tipo: TipoArticulo
  contenido: string
  etiquetas: string[]
  updatedAt: string
  updatedBy: string
}

export interface Dispositivo {
  id: string
  categoriaId: string
  nombre: string
  marca: string
  modelo: string
  serial: string
  placaInventario: string
  ubicacion: string
  ip: string
  estado: string
  observaciones: string
  detalles: Record<string, string>
  updatedAt: string
  updatedBy: string
}

export interface Credencial {
  id: string
  titulo: string
  categoria: string
  datosCifrados: string
  updatedAt: string
  updatedBy: string
}

export interface HistorialEntrada {
  id: string
  entidadTipo: 'articulo' | 'dispositivo' | 'credencial'
  entidadId: string
  usuario: string
  fechaHora: string
  campo: string
  valorAnterior: string
  valorNuevo: string
  motivo: string
}

export interface Adjunto {
  id: string
  entidadTipo: 'articulo' | 'dispositivo'
  entidadId: string
  nombre: string
  tipo: string
  referencia: string
}

export interface PendingChange {
  id: string
  entidadTipo: 'articulo' | 'dispositivo' | 'credencial'
  entidadId: string
  operacion: 'crear' | 'actualizar' | 'eliminar'
  payload: unknown
  creadoEn: string
}

class SolucionesItDatabase extends Dexie {
  categorias!: EntityTable<Categoria, 'id'>
  articulos!: EntityTable<Articulo, 'id'>
  dispositivos!: EntityTable<Dispositivo, 'id'>
  credenciales!: EntityTable<Credencial, 'id'>
  historial!: EntityTable<HistorialEntrada, 'id'>
  adjuntos!: EntityTable<Adjunto, 'id'>
  pendingChanges!: EntityTable<PendingChange, 'id'>

  constructor() {
    super('soluciones-it')

    this.version(1).stores({
      categorias: 'id, orden',
      articulos: 'id, categoriaId, tipo, updatedAt',
      dispositivos: 'id, categoriaId, ubicacion, estado, updatedAt',
      credenciales: 'id, categoria, updatedAt',
      historial: 'id, entidadTipo, entidadId, fechaHora',
      adjuntos: 'id, entidadTipo, entidadId',
      pendingChanges: 'id, entidadTipo, creadoEn',
    })
  }
}

export const db = new SolucionesItDatabase()
