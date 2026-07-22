// Este modulo importa de `./db` SOLO tipos (no `db` ni ninguna otra
// referencia en runtime) a proposito: `db.ts` si importa de aqui
// `configTablas` y `normalizarEntidad` para el upgrade de la version
// 14, y si el import fuera mutuo en runtime quedaria un ciclo. Por eso
// `storeDe` vive en `db.ts` y no aqui, pese a mapear nombres de tabla.
import type {
  AccesoBoveda,
  Adjunto,
  Articulo,
  CampoProtegido,
  Categoria,
  Conexion,
  Credencial,
  Diagnostico,
  Dispositivo,
  EjecucionDiagnostico,
  HistorialEntrada,
  Persona,
  Ubicacion,
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
  // Columnas NULLABLE agregadas despues de que la app ya estaba en uso,
  // por nombre de propiedad LOCAL (tarea 140). `aFilaRemota` las OMITE
  // del payload cuando su valor local es nulo, en vez de mandar
  // `columna: null`.
  //
  // Para que sirve: `aFilaRemota` emite siempre todas las columnas
  // configuradas, asi que declarar una columna nueva rompe el push de
  // TODAS las filas de esa tabla mientras el usuario no haya aplicado
  // el `alter table` en Supabase (PostgREST rechaza la clave
  // desconocida y el cambio se queda en la cola, ver sync.ts). Al
  // omitirla, una fila que no usa la columna se sube exactamente igual
  // que antes del cambio, y el despliegue deja de depender de que el
  // SQL se corra a tiempo.
  //
  // Precio, y por que aqui es correcto: como el upsert solo escribe las
  // claves presentes, una columna opcional NUNCA se vuelve a poner en
  // null desde la app una vez que tiene valor. Solo deben declararse
  // aqui columnas cuyo valor no se limpia (el origen de un articulo no
  // cambia). Una columna que el usuario pueda vaciar no va aqui.
  camposOpcionales?: readonly string[]
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
      origenSugerenciaId: 'origen_sugerencia_id',
    },
    // `origenSugerenciaId` no lleva default: es nullable de verdad (no
    // es NOT NULL DEFAULT), y va en `camposOpcionales` para que un
    // articulo normal se siga subiendo sin esa clave mientras el
    // usuario no haya aplicado el schema.sql (tarea 140).
    camposOpcionales: ['origenSugerenciaId'],
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
    // `reemplazaA` no lleva default: es nullable de verdad y va en
    // `camposOpcionales` (tarea 143) para que un equipo normal se siga
    // subiendo sin esa clave mientras el usuario no haya aplicado el
    // schema.sql. Solo se fija UNA VEZ al crear el equipo entrante
    // (`?reemplazaA=<id>` en DispositivoForm.tsx) y no hay forma de
    // limpiarlo desde la app: cumple la condicion de camposOpcionales
    // (un valor que nunca se vuelve a null desde la app).
    camposOpcionales: ['reemplazaA'],
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

// Convierte una entidad local en una fila para Supabase. No envia
// updated_at ni updated_by porque los pone siempre el servidor. Una
// entidad guardada por una version anterior de la app puede traer null
// (o nada) donde el servidor exige NOT NULL: se rellena con el default
// declarado, que es exactamente lo que Postgres habria puesto.
export function aFilaRemota(tabla: TablaSincronizada, entidad: unknown): Record<string, unknown> {
  const origen = entidad as Record<string, unknown>
  const config = configTablas[tabla]
  const fila: Record<string, unknown> = {}
  const opcionales = config.camposOpcionales
  for (const [local, remota] of Object.entries(config.campos)) {
    if (local === 'updatedAt' || local === 'updatedBy') continue
    const valor = origen[local] ?? config.porDefecto[local] ?? null
    // Una columna opcional sin valor no viaja: asi la fila se sube
    // igual que antes de que la columna existiera, y el push no
    // depende de que el esquema ya este aplicado en el servidor (ver
    // `camposOpcionales` en ConfigTabla).
    if (valor === null && opcionales?.includes(local)) continue
    fila[remota] = valor
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

// Copia los valores por defecto que son objetos o arreglos, para que
// dos filas normalizadas en la misma pasada no terminen compartiendo la
// MISMA lista (mutar la de una habria mutado la de la otra). Los
// defaults declarados son planos ('', 0, false, [], {}), asi que una
// copia superficial alcanza.
function copiarValor(valor: unknown): unknown {
  if (Array.isArray(valor)) return [...valor]
  if (valor !== null && typeof valor === 'object') return { ...(valor as Record<string, unknown>) }
  return valor
}

// Repara una fila YA GUARDADA en la base local para que cumpla el mismo
// contrato que `aEntidadLocal` le habria dado si se descargara hoy.
// Muta `entidad` y devuelve true si tuvo que cambiar algo.
//
// Existe porque `aEntidadLocal` solo actua al DESCARGAR una fila, y la
// sincronizacion es incremental por cursor: una fila que ya estaba en
// IndexedDB no se vuelve a bajar mientras su `updated_at` no cambie en
// el servidor, asi que conserva para siempre los huecos que dejo una
// version anterior de la app (una columna que aun no existia cuando se
// descargo). Ese hueco es el que rompio la Boveda en un telefono real:
// una credencial anterior al grupo N3 llegaba sin `dispositivos` y
// `detectarCandidatos` lanzaba un TypeError en pleno render (tarea 136).
//
// Solo rellena lo que falta o esta en null; nunca pisa un valor
// existente, ni siquiera uno "vacio" ('' , 0, false), que es un dato
// legitimo y no un hueco. `updatedAt`/`updatedBy` quedan fuera a
// proposito (los pone siempre el servidor, y escribirles null mentiria
// sobre su tipo), igual que los excluye `aFilaRemota`. Los campos
// secretos (`datosCifrados`, `valorCifrado`) no declaran default, asi
// que esta funcion nunca les inventa un valor: como mucho dejaria en
// null uno que ya viniera ausente, que es lo mismo que haria hoy una
// descarga.
export function normalizarEntidad(tabla: TablaSincronizada, entidad: Record<string, unknown>): boolean {
  const config = configTablas[tabla]
  let cambio = false
  for (const local of Object.keys(config.campos)) {
    if (local === 'updatedAt' || local === 'updatedBy') continue
    const actual = entidad[local]
    if (actual !== undefined && actual !== null) continue
    // `?? null` replica exactamente lo que habria hecho `aEntidadLocal`:
    // el default declarado si existe, y null si la columna admite null.
    const repuesto = config.porDefecto[local] ?? null
    // Un null legitimo (columna sin default, como `venceEn` o
    // `eliminadoEn`) ya esta bien: no cuenta como cambio.
    if (actual === null && repuesto === null) continue
    entidad[local] = copiarValor(repuesto)
    cambio = true
  }
  return cambio
}
