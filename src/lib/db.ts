import Dexie, { type EntityTable } from 'dexie'

export interface Perfil {
  id: string
  nombre: string
  correo: string
  puedeVerBoveda: boolean
}

export interface Categoria {
  id: string
  nombre: string
  icono: string
  orden: number
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

export type TipoArticulo =
  | 'instalacion'
  | 'configuracion'
  | 'conexion'
  | 'problema_frecuente'
  | 'mantenimiento'
  | 'manual'

// Ramificacion opcional de un paso: segun la respuesta se salta a
// otro paso (numero 1 en adelante) o se continua con el siguiente
// (null). Los saltos usan la posicion del paso, no su id, para que
// el autor pueda escribirlos y leerlos tal cual ("ir al paso 6").
export interface DecisionPaso {
  pregunta: string
  pasoSi: number | null
  pasoNo: number | null
}

export interface PasoProcedimiento {
  id: string
  titulo: string
  detalle: string
  // Referencia en Supabase Storage de la captura del paso, o null.
  imagen: string | null
  nota: string
  advertencia: string
  consejo: string
  decision: DecisionPaso | null
}

// Un articulo con procedimiento se muestra como una lista de pasos
// numerados y expandibles, con un bloque "Antes de empezar".
export interface Procedimiento {
  requisitos: string[]
  pasos: PasoProcedimiento[]
}

export interface Articulo {
  id: string
  categoriaId: string
  titulo: string
  tipo: TipoArticulo
  contenido: string
  etiquetas: string[]
  procedimiento: Procedimiento | null
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
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
  updatedBy: string | null
  eliminadoEn: string | null
}

export interface Credencial {
  id: string
  titulo: string
  categoria: string
  datosCifrados: string
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

export type TipoEntidadHistorial = 'categoria' | 'articulo' | 'dispositivo' | 'credencial'

export interface HistorialEntrada {
  id: string
  entidadTipo: TipoEntidadHistorial
  entidadId: string
  usuario: string | null
  usuarioNombre: string
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
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

// Cola de cambios hechos en el telefono que aun no llegan al
// servidor. Se procesa en orden de creacion al recuperar internet.
export interface CambioPendiente {
  id: string
  tabla: string
  entidadId: string
  payload: unknown
  creadoEn: string
  error: string | null
  intentos: number
}

// Datos internos de la sincronizacion, como el cursor de la ultima
// descarga de cada tabla.
export interface SyncMeta {
  clave: string
  valor: string
}

// Pasos marcados como hechos por este tecnico en cada procedimiento.
// Solo vive en el dispositivo: no se sincroniza, cada tecnico lleva
// su propio avance (por ejemplo al retomar tras una interrupcion).
export interface ProgresoPasos {
  articuloId: string
  pasosHechos: string[]
  actualizadoEn: string
}

// Ultimos articulos y dispositivos abiertos en este telefono. Solo
// vive en el dispositivo: no se sincroniza con el resto del equipo.
export interface Reciente {
  clave: string
  tipo: 'articulo' | 'dispositivo'
  entidadId: string
  visitadoEn: string
}

class SolucionesItDatabase extends Dexie {
  perfiles!: EntityTable<Perfil, 'id'>
  categorias!: EntityTable<Categoria, 'id'>
  articulos!: EntityTable<Articulo, 'id'>
  dispositivos!: EntityTable<Dispositivo, 'id'>
  credenciales!: EntityTable<Credencial, 'id'>
  historial!: EntityTable<HistorialEntrada, 'id'>
  adjuntos!: EntityTable<Adjunto, 'id'>
  cambiosPendientes!: EntityTable<CambioPendiente, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'clave'>
  recientes!: EntityTable<Reciente, 'clave'>
  progresoPasos!: EntityTable<ProgresoPasos, 'articuloId'>

  constructor() {
    super('soluciones-it')

    this.version(1).stores({
      perfiles: 'id',
      categorias: 'id, orden',
      articulos: 'id, categoriaId, tipo, updatedAt',
      dispositivos: 'id, categoriaId, ubicacion, estado, updatedAt',
      credenciales: 'id, categoria, updatedAt',
      historial: 'id, [entidadTipo+entidadId], fechaHora',
      adjuntos: 'id, [entidadTipo+entidadId]',
      cambiosPendientes: 'id, tabla, [tabla+entidadId], creadoEn',
      syncMeta: 'clave',
    })

    // La version 1 ya esta instalada en los telefonos del equipo:
    // los cambios de esquema nuevos van siempre en una version nueva.
    this.version(2).stores({
      recientes: 'clave, visitadoEn',
    })

    this.version(3).stores({
      progresoPasos: 'articuloId',
    })
  }
}

export const db = new SolucionesItDatabase()
