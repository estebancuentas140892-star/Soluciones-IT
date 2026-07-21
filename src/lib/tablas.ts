import type { Table } from 'dexie'
import {
  db,
  type AccesoBoveda,
  type Adjunto,
  type Articulo,
  type CampoProtegido,
  type Categoria,
  type Conexion,
  type Credencial,
  type Diagnostico,
  type Dispositivo,
  type EjecucionDiagnostico,
  type HistorialEntrada,
  type Ubicacion,
} from './db'

// Tablas que se sincronizan con Supabase, en el orden en que deben
// descargarse (las categorias primero porque el resto depende de ellas).
// Las mas nuevas van al final a proposito: si su esquema todavia no se
// aplico en el servidor, su fallo no impide descargar las demas.
export const TABLAS_SINCRONIZADAS = [
  'categorias',
  'articulos',
  'dispositivos',
  'credenciales',
  'adjuntos',
  'historial',
  'conexiones',
  'diagnosticos',
  'ejecuciones_diagnostico',
  'accesos_boveda',
  'ubicaciones',
  'campos_protegidos',
] as const

export type TablaSincronizada = (typeof TABLAS_SINCRONIZADAS)[number]

// Tablas que se editan desde la app. El historial, las ejecuciones de
// diagnostico y los accesos a la boveda solo se agregan mediante el
// repositorio (registro inmutable), nunca se editan directamente.
export type TablaEditable = Exclude<
  TablaSincronizada,
  'historial' | 'ejecuciones_diagnostico' | 'accesos_boveda'
>

export interface EntidadPorTabla {
  categorias: Categoria
  articulos: Articulo
  dispositivos: Dispositivo
  conexiones: Conexion
  credenciales: Credencial
  adjuntos: Adjunto
  historial: HistorialEntrada
  diagnosticos: Diagnostico
  ejecuciones_diagnostico: EjecucionDiagnostico
  accesos_boveda: AccesoBoveda
  ubicaciones: Ubicacion
  campos_protegidos: CampoProtegido
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
    campos: {
      ...camposComunes,
      nombre: 'nombre',
      icono: 'icono',
      orden: 'orden',
      esRed: 'es_red',
      color: 'color',
    },
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
      estado: 'estado',
      version: 'version',
      relacionados: 'relacionados',
      ordenRutaInicio: 'orden_ruta_inicio',
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
      ubicacionId: 'ubicacion_id',
      ip: 'ip',
      estado: 'estado',
      observaciones: 'observaciones',
      detalles: 'detalles',
      foto: 'foto',
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
      venceEn: 'vence_en',
      dispositivos: 'dispositivos',
      tipo: 'tipo',
      // Archivo cifrado de un secreto tipo 'archivo' (fase P5): jsonb
      // en claro (referencia, nombre, tipo MIME, tamaño), el contenido
      // real vive cifrado en el bucket archivos_boveda de Storage.
      archivo: 'archivo',
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
  diagnosticos: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      categoriaId: 'categoria_id',
      titulo: 'titulo',
      descripcion: 'descripcion',
      nodos: 'nodos',
    },
  },
  // Registro inmutable de diagnosticos terminados o abandonados, con
  // el mismo patron que el historial: solo insercion y cursor sobre
  // recibido_en (el sello que pone el servidor al recibir la fila).
  ejecuciones_diagnostico: {
    columnaCursor: 'recibido_en',
    soloInsercion: true,
    campos: {
      id: 'id',
      diagnosticoId: 'diagnostico_id',
      diagnosticoTitulo: 'diagnostico_titulo',
      usuario: 'usuario',
      usuarioNombre: 'usuario_nombre',
      camino: 'camino',
      articulosEjecutados: 'articulos_ejecutados',
      resuelto: 'resuelto',
      duracionSegundos: 'duracion_segundos',
      fechaHora: 'fecha_hora',
      motivo: 'motivo',
      solucionPropuesta: 'solucion_propuesta',
    },
  },
  // Auditoria de la boveda: mismo patron que historial y ejecuciones
  // de diagnostico, solo insercion con cursor sobre recibido_en.
  accesos_boveda: {
    columnaCursor: 'recibido_en',
    soloInsercion: true,
    campos: {
      id: 'id',
      // Grupo P1: el objetivo de la auditoria puede ser una credencial
      // o un campo protegido; credencial_id/credencial_titulo se
      // reutilizan como id y titulo del objetivo en ambos casos.
      entidadTipo: 'entidad_tipo',
      credencialId: 'credencial_id',
      credencialTitulo: 'credencial_titulo',
      usuario: 'usuario',
      usuarioNombre: 'usuario_nombre',
      accion: 'accion',
      fechaHora: 'fecha_hora',
    },
  },
  // Ubicacion como entidad (grupo N3). Va al final de la lista de tablas
  // sincronizadas: si el esquema aun no se aplico en el servidor, su
  // fallo no impide descargar las demas.
  ubicaciones: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: { ...camposComunes, nombre: 'nombre', padreId: 'padre_id', notas: 'notas' },
  },
  // Campos protegidos del dispositivo (grupo P1). Va al final de la
  // lista de tablas sincronizadas, como se hizo con `ubicaciones`: si el
  // esquema aun no se aplico en el servidor, su fallo no impide
  // descargar las demas. Solo `valorCifrado` es secreto; `nombre` y
  // `tipo` viajan en claro a proposito (ver CampoProtegido en db.ts).
  campos_protegidos: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: {
      ...camposComunes,
      dispositivoId: 'dispositivo_id',
      nombre: 'nombre',
      tipo: 'tipo',
      valorCifrado: 'valor_cifrado',
      orden: 'orden',
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
