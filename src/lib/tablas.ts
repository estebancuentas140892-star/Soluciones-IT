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
  type Persona,
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
  'personas',
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
  personas: Persona
}

interface ConfigTabla {
  // Columna remota que usa la sincronizacion para saber que hay de
  // nuevo. La pone siempre el servidor.
  columnaCursor: string
  // true para tablas donde solo se insertan filas (historial).
  soloInsercion: boolean
  // Propiedad local (camelCase) -> columna remota (snake_case).
  campos: Record<string, string>
  // Valor de las columnas declaradas NOT NULL DEFAULT en schema.sql,
  // por nombre de propiedad LOCAL. Es el contrato de la tabla remota
  // escrito de este lado, y sirve en las dos direcciones:
  //
  // - Al bajar: una columna agregada despues (todas las de
  //   `alter table ... add column if not exists` de schema.sql) no
  //   viene en las filas descargadas mientras el esquema no se aplica
  //   en el servidor. Sin esto, `aEntidadLocal` la guardaba como null
  //   y mentia sobre el tipo local (por ejemplo `esRutaInicio:
  //   boolean` terminaba en null).
  // - Al subir: ese null viajaba tal cual y el servidor rechazaba la
  //   fila con "null value in column ... violates not-null
  //   constraint". El cambio se quedaba en la cola reintentandose para
  //   siempre (700 intentos en el caso real que destapo esto,
  //   2026-07-21), porque ademas la regla anti pisado deja de
  //   refrescar una ficha con cambios pendientes: el null local nunca
  //   se corregia solo.
  //
  // Solo van las columnas con DEFAULT. Las NOT NULL sin default
  // (titulo, categoria_id, valor_cifrado...) no llevan valor de
  // relleno a proposito: si faltan es un error de verdad y debe verse.
  porDefecto: Record<string, unknown>
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
    porDefecto: { nombre: '', icono: '', orden: 0, esRed: false },
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
    porDefecto: {
      contenido: '',
      etiquetas: [],
      sintomas: [],
      causas: [],
      dispositivosAfectados: [],
      esRutaInicio: false,
      estado: 'publicado',
      version: '1.0',
      relacionados: [],
      ordenRutaInicio: 0,
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
      responsable: 'responsable',
      responsableId: 'responsable_id',
      reemplazaA: 'reemplaza_a',
      ip: 'ip',
      estado: 'estado',
      observaciones: 'observaciones',
      detalles: 'detalles',
      foto: 'foto',
    },
    porDefecto: {
      marca: '',
      modelo: '',
      serial: '',
      placaInventario: '',
      ubicacion: '',
      responsable: '',
      ip: '',
      estado: '',
      observaciones: '',
      detalles: {},
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
    porDefecto: {
      origenNombre: '',
      origenPuerto: '',
      destinoNombre: '',
      destinoPuerto: '',
      medio: '',
      notas: '',
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
    porDefecto: { categoria: '', dispositivos: [], tipo: 'cuenta' },
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
    porDefecto: { tipo: '' },
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
    // fechaHora tambien es NOT NULL, pero su default es now() y no hay
    // constante equivalente de este lado: la pone siempre el
    // repositorio al crear la entrada.
    porDefecto: { usuarioNombre: '', valorAnterior: '', valorNuevo: '', motivo: '' },
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
    porDefecto: { descripcion: '', nodos: [] },
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
    porDefecto: {
      diagnosticoTitulo: '',
      usuarioNombre: '',
      camino: [],
      articulosEjecutados: [],
      duracionSegundos: 0,
      motivo: '',
      solucionPropuesta: '',
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
    porDefecto: { entidadTipo: 'credencial', credencialTitulo: '', usuarioNombre: '' },
  },
  // Ubicacion como entidad (grupo N3). Va al final de la lista de tablas
  // sincronizadas: si el esquema aun no se aplico en el servidor, su
  // fallo no impide descargar las demas.
  ubicaciones: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: { ...camposComunes, nombre: 'nombre', padreId: 'padre_id', notas: 'notas' },
    porDefecto: { notas: '' },
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
    porDefecto: { tipo: 'texto', orden: 0 },
  },
  // Persona/responsable como entidad (hallazgo T1). Va al final de la
  // lista de tablas sincronizadas, mismo criterio que ubicaciones y
  // campos_protegidos: si el esquema aun no se aplico en el servidor, su
  // fallo no impide descargar las demas.
  personas: {
    columnaCursor: 'updated_at',
    soloInsercion: false,
    campos: { ...camposComunes, nombre: 'nombre', notas: 'notas' },
    porDefecto: { notas: '' },
  },
}

export function storeDe<T extends TablaSincronizada>(tabla: T): Table<EntidadPorTabla[T], string> {
  return db.table(tabla)
}

// Convierte una entidad local en una fila para Supabase. No envia
// updated_at ni updated_by porque los pone siempre el servidor. Una
// entidad guardada por una version anterior de la app puede traer null
// (o nada) donde el servidor exige NOT NULL: se rellena con el default
// declarado, que es exactamente lo que Postgres habria puesto.
export function aFilaRemota(tabla: TablaSincronizada, entidad: unknown): Record<string, unknown> {
  const origen = entidad as Record<string, unknown>
  const config = configTablas[tabla]
  const fila: Record<string, unknown> = {}
  for (const [local, remota] of Object.entries(config.campos)) {
    if (local === 'updatedAt' || local === 'updatedBy') continue
    fila[remota] = origen[local] ?? config.porDefecto[local] ?? null
  }
  return fila
}

// Convierte una fila recibida de Supabase en una entidad local. Una
// columna que todavia no exista en el servidor (esquema sin aplicar)
// no viene en la fila: se usa su default declarado antes que null,
// para que la entidad local respete su propio tipo.
export function aEntidadLocal<T extends TablaSincronizada>(
  tabla: T,
  fila: Record<string, unknown>,
): EntidadPorTabla[T] {
  const config = configTablas[tabla]
  const entidad: Record<string, unknown> = {}
  for (const [local, remota] of Object.entries(config.campos)) {
    entidad[local] = fila[remota] ?? config.porDefecto[local] ?? null
  }
  return entidad as unknown as EntidadPorTabla[T]
}
