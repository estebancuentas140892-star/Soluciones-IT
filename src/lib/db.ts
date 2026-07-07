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
  // true para las categorias de infraestructura de red (racks, puntos
  // de red, switches...): sus dispositivos se muestran en la seccion
  // Red en vez de Dispositivos. Puede llegar null de una base que aun
  // no tiene la columna, por eso siempre se lee con Boolean().
  esRed: boolean
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

// Un archivo o imagen adjunto a un paso del procedimiento (foto de
// la camara, captura, manual, PDF). Vive inline en el JSON del paso,
// no en la tabla `adjuntos`. Solo se guarda la referencia en Storage
// mas su nombre y tipo; el contenido viaja por la cola de subida.
export interface PasoAdjunto {
  referencia: string
  nombre: string
  tipo: string
}

export interface PasoProcedimiento {
  id: string
  titulo: string
  // Instrucciones con casilla de verificacion dentro del paso, una
  // por linea. Al marcar la ultima, el paso se completa solo y la
  // vista avanza al siguiente pendiente.
  instrucciones: string[]
  // Imagenes y archivos del paso (varios): fotos tomadas en el sitio,
  // capturas, manuales o PDF. Antes era un solo `imagen`; al
  // normalizar, ese valor viejo se migra al primer adjunto.
  adjuntos: PasoAdjunto[]
  // Credencial de la boveda vinculada al paso (su apartado "Datos"),
  // o null. El titulo es una copia de referencia: permite mostrar
  // "Datos: SQL Server" incluso a tecnicos sin acceso a la boveda
  // (RLS no les descarga las filas de credenciales). Los secretos
  // nunca viajan aqui.
  credencialId: string | null
  credencialTitulo: string
  // Otro articulo con procedimiento vinculado como subprocedimiento
  // del paso, o null: convierte el paso en una "tarea" cuyo paso a
  // paso vive en su propio articulo, reutilizable desde varios
  // procedimientos y siempre al dia. El titulo es una copia de
  // referencia por si el articulo aun no sincronizo o fue eliminado.
  subArticuloId: string | null
  subArticuloTitulo: string
  // Procedimiento de solucion por si el paso falla, o null. En la
  // vista, el paso pregunta "¿Ocurrio algun error durante este
  // paso?": responder que si despliega la solucion ahi mismo y, al
  // completarla, el flujo principal continua solo desde ese punto.
  // Mismo patron de referencia que subArticuloId.
  solucionArticuloId: string | null
  solucionArticuloTitulo: string
}

// Un articulo con procedimiento se muestra como una lista de pasos
// numerados y expandibles, con un bloque "Antes de empezar".
export interface Procedimiento {
  requisitos: string[]
  pasos: PasoProcedimiento[]
}

// Vinculo de un articulo de tipo 'problema_frecuente' con un
// dispositivo que sufre ese problema. Mismo patron que los vinculos
// de los pasos (credencialId/credencialTitulo, subArticuloId/Titulo):
// id real mas una copia del nombre para poder mostrarlo aunque la
// ficha del dispositivo aun no haya sincronizado.
export interface DispositivoAfectado {
  id: string
  nombre: string
}

export interface Articulo {
  id: string
  categoriaId: string
  titulo: string
  tipo: TipoArticulo
  contenido: string
  etiquetas: string[]
  procedimiento: Procedimiento | null
  // Estructura de una incidencia (solo tiene sentido con tipo
  // 'problema_frecuente', pero cualquier articulo puede tener datos
  // aqui sin que rompa nada): sintomas y posibles causas como listas
  // cortas de texto libre, y los dispositivos que sufren el problema.
  // La solucion en si sigue siendo el procedimiento del articulo (no
  // se duplica).
  sintomas: string[]
  causas: string[]
  dispositivosAfectados: DispositivoAfectado[]
  // Lo destaca en Inicio como puerta de entrada para quien recien
  // llega al equipo ("ruta de inicio"). No crea una seccion nueva: es
  // un articulo normal (tipicamente con procedimiento y
  // subprocedimientos vinculados a lo ya documentado) que el equipo
  // marca a mano desde el editor. Puede haber varios marcados; Inicio
  // los muestra todos.
  esRutaInicio: boolean
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

// Relacion documentada entre dos dispositivos del inventario.
// - 'enlace': cable o señal de origen a destino. El origen es el lado
//   que da el servicio (el switch, el router) y el destino el que lo
//   recibe (AP, camara, punto de red, otro switch). Asi el arbol de
//   topologia puede responder "¿que depende de este equipo?".
// - 'instalacion': el origen esta instalado dentro del destino (un
//   switch dentro de un rack). Sin puertos ni medio.
// Los nombres de ambos extremos se guardan como copia de referencia
// (mismo patron que credencialTitulo en los pasos): permiten mostrar
// la conexion aunque la ficha del otro extremo aun no sincronice.
export type TipoConexion = 'enlace' | 'instalacion'

export interface Conexion {
  id: string
  tipo: TipoConexion
  origenId: string
  origenNombre: string
  origenPuerto: string
  destinoId: string
  destinoNombre: string
  destinoPuerto: string
  // Medio fisico del enlace: UTP, fibra optica, inalambrico...
  medio: string
  notas: string
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

// Id de la unica fila del verificador de la contrasena maestra.
export const ID_VERIFICADOR = 'principal'

// Copia local del verificador de la contrasena maestra (tabla
// boveda_meta en Supabase): un texto fijo cifrado con la clave
// maestra. Permite comprobar la contrasena en cualquier dispositivo
// sin que la contrasena viaje ni se guarde jamas. Mientras exista
// (aqui o en el servidor), la app nunca ofrece crear una contrasena
// maestra nueva: borrar cache o cambiar de telefono no la resetea.
export interface BovedaMeta {
  id: string
  verificador: string
  updatedAt: string
}

// Metodo con el que el tecnico desbloquea la app en su dispositivo:
// un patron de puntos (estilo movil) o una contrasena. Nunca se usa
// biometria (dato personal sensible que no todos quieren entregar).
export type MetodoBloqueoApp = 'patron' | 'contrasena'

// Id de la unica fila de configuracion del bloqueo de la app.
export const ID_BLOQUEO_APP = 'principal'

// Bloqueo de la aplicacion en ESTE dispositivo (capa de acceso que se
// suma a la sesion de inicio y a la contrasena maestra de la boveda).
// Es local y no se sincroniza: cada tecnico lo configura en su propio
// telefono. Nunca guarda el patron ni la contrasena en claro, solo un
// "verificador" (un texto fijo cifrado con la clave derivada del
// secreto): descifrarlo con exito demuestra que el secreto es
// correcto. `bloqueadoHasta` frena los intentos por fuerza bruta desde
// la interfaz tras varios fallos.
export interface ConfigBloqueoApp {
  id: string
  metodo: MetodoBloqueoApp
  verificador: string
  minutosAutobloqueo: number
  bloqueadoHasta: string | null
  updatedAt: string
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
  // 'historial' es la foto opcional de una intervencion manual (ver
  // HistorialEntrada, campo 'intervencion'): entidadId apunta al id
  // de esa entrada, no a un articulo ni a un dispositivo.
  entidadTipo: 'articulo' | 'dispositivo' | 'historial'
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

// Archivos (fotos, manuales) adjuntados sin conexion: el contenido
// queda guardado en el telefono y el motor de sincronizacion lo sube
// a Storage al recuperar internet. La clave es la referencia de
// Storage, que ya quedo escrita en la fila del adjunto o en el paso
// del procedimiento que lo usa.
export interface ArchivoPendiente {
  referencia: string
  contenido: Blob
  tipo: string
  nombre: string
  creadoEn: string
  error: string | null
  intentos: number
}

// Pasos marcados como hechos por este tecnico en cada procedimiento.
// Solo vive en el dispositivo: no se sincroniza, cada tecnico lleva
// su propio avance (por ejemplo al retomar tras una interrupcion).
export interface ProgresoPasos {
  articuloId: string
  pasosHechos: string[]
  // Instrucciones marcadas dentro de cada paso, con clave
  // "<pasoId>:<indice>". Opcional porque las filas guardadas antes
  // de esta funcion no lo traen.
  instruccionesHechas?: string[]
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
  conexiones!: EntityTable<Conexion, 'id'>
  credenciales!: EntityTable<Credencial, 'id'>
  bovedaMeta!: EntityTable<BovedaMeta, 'id'>
  seguridadApp!: EntityTable<ConfigBloqueoApp, 'id'>
  historial!: EntityTable<HistorialEntrada, 'id'>
  adjuntos!: EntityTable<Adjunto, 'id'>
  cambiosPendientes!: EntityTable<CambioPendiente, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'clave'>
  recientes!: EntityTable<Reciente, 'clave'>
  progresoPasos!: EntityTable<ProgresoPasos, 'articuloId'>
  archivosPendientes!: EntityTable<ArchivoPendiente, 'referencia'>

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

    this.version(4).stores({
      archivosPendientes: 'referencia, creadoEn',
    })

    this.version(5).stores({
      conexiones: 'id, origenId, destinoId, updatedAt',
    })

    this.version(6).stores({
      bovedaMeta: 'id',
    })

    // Configuracion del bloqueo de la app (patron o contrasena). Local
    // a cada dispositivo, no se sincroniza.
    this.version(7).stores({
      seguridadApp: 'id',
    })
  }
}

export const db = new SolucionesItDatabase()
