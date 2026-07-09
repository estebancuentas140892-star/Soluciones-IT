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

// Tono visual de un bloque de aviso: cada uno se pinta con su icono y
// color propios para que el tecnico distinga de un vistazo un dato
// util (info, consejo) de un riesgo (precaucion, importante).
export type TonoAviso = 'info' | 'precaucion' | 'importante' | 'consejo' | 'dato'

// Tipo de un bloque dentro de un paso:
// - 'tarea': un elemento del checklist con casilla. Solo los bloques
//   'tarea' cuentan para completar el paso. Se subdivide por
//   `tipoTarea` (accion, verificacion o decision).
// - 'aviso': texto informativo o de advertencia, sin casilla. Va
//   justo donde el autor lo coloca (por ejemplo, una advertencia
//   inmediatamente antes de la tarea peligrosa).
// - 'imagen': una imagen intercalada en el flujo (una captura
//   despues de una tarea concreta), con pie de foto opcional.
export type TipoBloque = 'tarea' | 'aviso' | 'imagen'

// Clasificacion de una tarea del checklist (solo bloques 'tarea'):
// - 'accion': algo que el tecnico ejecuta ("Abrir SQL Server"). Es el
//   tipo por defecto y el de todas las tareas guardadas antes de que
//   existiera esta clasificacion.
// - 'verificacion': una comprobacion antes de continuar ("Verificar
//   que la base de datos aparece correctamente").
// - 'decision': una pregunta de Si/No ("¿La impresora aparece
//   instalada?"). "Si" marca la tarea y continua; "No" despliega en
//   linea la solucion o el procedimiento vinculado (decisionArticuloId)
//   y, al completarlo, la tarea queda hecha y el flujo regresa al
//   punto exacto donde iba. Mismo mecanismo que usa el Diagnostico
//   Inteligente, asi que las decisiones funcionan igual dentro de un
//   procedimiento ejecutado desde un diagnostico.
export type TipoTarea = 'accion' | 'verificacion' | 'decision'

// Un bloque del contenido de un paso. Reemplaza a las viejas
// `instrucciones: string[]`: ahora el cuerpo del paso es una lista
// ordenada y heterogenea (tareas, avisos e imagenes intercalados).
// Cada bloque tiene un id estable (el progreso local de las tareas se
// lleva por ese id, no por posicion, asi reordenar no desalinea el
// avance). `tono` solo aplica a 'aviso'; `adjunto` solo a 'imagen';
// `texto` es la tarea, el aviso o el pie de la imagen. `tipoTarea`
// solo aplica a 'tarea', y el vinculo de decision (id + copia del
// titulo, mismo patron que los vinculos del paso) solo a las tareas
// de tipo 'decision'. `credencialId`/`credencialTitulo` (tarea 40,
// 2026-07-09) es el mismo vinculo con la boveda que ya existe a nivel
// de paso completo (`PasoProcedimiento.credencialId`), pero anclado a
// una tarea puntual: solo aplica a bloques 'tarea', para el caso de
// un paso con varias instrucciones donde solo una necesita mostrar
// una credencial (por ejemplo "Ingresar usuario y contraseña").
export interface BloquePaso {
  id: string
  tipo: TipoBloque
  texto: string
  tono: TonoAviso | null
  adjunto: PasoAdjunto | null
  tipoTarea: TipoTarea | null
  decisionArticuloId: string | null
  decisionArticuloTitulo: string
  credencialId: string | null
  credencialTitulo: string
}

export interface PasoProcedimiento {
  id: string
  titulo: string
  // Descripcion muy corta (1 linea) de que se logra al terminar el
  // paso. Ayuda a entender el proposito antes de empezar; opcional,
  // no se muestra si esta vacio.
  objetivo: string
  // Cuerpo del paso: tareas con casilla, avisos e imagenes en el orden
  // que definio el autor. Antes era `instrucciones: string[]`; al
  // normalizar, cada instruccion vieja se migra a un bloque 'tarea'.
  bloques: BloquePaso[]
  // Imagenes y archivos del paso como galeria al inicio (varios):
  // fotos tomadas en el sitio, capturas, manuales o PDF. Se conserva
  // junto a las imagenes intercaladas en `bloques`: la galeria es para
  // adjuntos del paso completo (un manual, un PDF), los bloques imagen
  // para capturas ancladas a una tarea concreta. Antes era un solo
  // `imagen`; al normalizar, ese valor viejo se migra al primer adjunto.
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

// Nivel de dificultad del procedimiento completo: ayuda al tecnico a
// saber que esperar antes de empezar. null si no se definio.
export type NivelDificultad = 'principiante' | 'intermedio' | 'avanzado'

// Un articulo con procedimiento se muestra como una lista de pasos
// numerados y expandibles, con un bloque "Antes de empezar".
export interface Procedimiento {
  // ¿En que situaciones usar este procedimiento? (por ejemplo:
  // "Utiliza este procedimiento cuando necesites conectar una
  // impresora de red a un computador con Windows"). Es distinta del
  // objetivo general, que dice que se LOGRA al completarlo; ambos
  // conviven y no se reemplazan. Opcional.
  descripcion: string
  // Imagen de portada opcional para identificar el procedimiento de
  // un vistazo en el listado, el buscador, las rutas de aprendizaje y
  // las recomendaciones. Mismo formato que los adjuntos de paso (solo
  // referencia de Storage mas nombre y tipo). Vive en el JSON del
  // procedimiento, asi que no requiere columna nueva en Supabase.
  portada: PasoAdjunto | null
  // Descripcion muy corta de que se logra al completar TODO el
  // procedimiento (distinto del objetivo de cada paso). Opcional.
  objetivoGeneral: string
  requisitos: string[]
  pasos: PasoProcedimiento[]
  // Checklist final para confirmar que el objetivo general realmente
  // se cumplio, mas alla de haber marcado todos los pasos. Se muestra
  // junto al banner de "Procedimiento completado" y debe marcarse
  // entera antes de darlo por terminado.
  verificacionFinal: string[]
  // Cuanto toma en minutos, para que el tecnico organice su trabajo.
  // null si no se definio.
  tiempoEstimadoMin: number | null
  dificultad: NivelDificultad | null
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

// ----------------------------------------------------------------
// Modo Diagnostico Inteligente
// ----------------------------------------------------------------

// Una respuesta posible de un nodo del diagnostico. Cada opcion puede
// (todo opcional y combinable):
// - continuar en otra pregunta (siguienteNodoId),
// - ejecutar un articulo con procedimiento en modo asistente
//   (articuloId + copia de referencia del titulo, mismo patron que
//   los vinculos de los pasos: el paso a paso nunca se duplica),
// - terminar el diagnostico con un mensaje (mensajeFinal, solo tiene
//   sentido cuando siguienteNodoId es null).
// Una opcion terminal debe tener mensaje o articulo (lo exige la
// validacion al guardar): ninguna rama queda sin salida.
export interface OpcionDiagnostico {
  id: string
  etiqueta: string
  siguienteNodoId: string | null
  articuloId: string | null
  articuloTitulo: string
  mensajeFinal: string
}

// Una pregunta del arbol de decisiones. En esta version las
// respuestas son una lista de opciones (Si/No es una lista de 2);
// texto, numero o codigo QR quedan para versiones futuras sin romper
// el modelo (serian tipos de nodo nuevos).
export interface NodoDiagnostico {
  id: string
  // Nombre corto para organizar y reconocer la pregunta en el editor
  // (fase D1, 2026-07-09): se ve en la tarjeta y en los selectores de
  // destino en vez de recortar la pregunta a 40 caracteres. Opcional;
  // nunca se muestra al tecnico que ejecuta el diagnostico.
  tituloInterno: string
  pregunta: string
  descripcion: string
  opciones: OpcionDiagnostico[]
}

// Un diagnostico guiado: parte de un problema en palabras del tecnico
// ("La impresora no imprime") y llega a la solucion mediante
// preguntas simples, reutilizando los procedimientos existentes como
// bloques. Los nodos viajan como JSON (igual que `procedimiento` en
// articulos) y el PRIMERO de la lista es el nodo inicial.
export interface Diagnostico {
  id: string
  categoriaId: string
  titulo: string
  descripcion: string
  nodos: NodoDiagnostico[]
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

// Un paso ya respondido del diagnostico en curso. Guarda copias del
// texto (pregunta y etiqueta) para que el registro de la ejecucion
// sea legible aunque el diagnostico se edite despues.
export interface PasoCamino {
  nodoId: string
  pregunta: string
  opcionId: string
  etiqueta: string
}

// Donde esta parado el tecnico dentro del diagnostico en curso:
// respondiendo una pregunta, ejecutando un procedimiento vinculado
// (con la informacion para continuar al terminarlo) o en el resultado
// final.
export type EstadoDiagnostico =
  | { tipo: 'pregunta'; nodoId: string }
  | {
      tipo: 'articulo'
      articuloId: string
      articuloTitulo: string
      siguienteNodoId: string | null
      mensajeFinal: string
    }
  | { tipo: 'final'; mensajeFinal: string; articuloId: string | null; articuloTitulo: string }

// Avance local de un diagnostico en curso. Solo vive en el
// dispositivo (como progresoPasos): cerrar la app y volver retoma en
// el punto exacto, y nunca se pierde el progreso al ejecutar un
// procedimiento vinculado.
export interface ProgresoDiagnostico {
  diagnosticoId: string
  camino: PasoCamino[]
  estado: EstadoDiagnostico
  articulosEjecutados: { id: string; titulo: string }[]
  iniciadoEn: string
  actualizadoEn: string
}

// Registro de un diagnostico terminado (o abandonado), sincronizado
// con el equipo. Solo se insertan filas, nunca se editan (como el
// historial): es la base de las estadisticas futuras (problemas mas
// frecuentes, soluciones con mayor tasa de exito).
export interface EjecucionDiagnostico {
  id: string
  diagnosticoId: string
  diagnosticoTitulo: string
  usuario: string | null
  usuarioNombre: string
  camino: PasoCamino[]
  articulosEjecutados: { id: string; titulo: string }[]
  resuelto: 'si' | 'no' | 'abandonado'
  duracionSegundos: number
  fechaHora: string
}

export type TipoEntidadHistorial = 'categoria' | 'articulo' | 'dispositivo' | 'credencial' | 'diagnostico'

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
  // Ids de los bloques 'tarea' marcados como hechos (las tareas con
  // casilla de cualquier paso). El id de cada bloque es unico, asi que
  // no hace falta prefijarlo con el paso. Opcional porque las filas
  // guardadas antes de esta funcion no lo traen; las guardadas con el
  // modelo viejo (claves "pasoId:indice") ya no coinciden y se ignoran
  // (el avance a medias se reinicia una sola vez, dato local y efimero).
  instruccionesHechas?: string[]
  // Casillas marcadas de "Verificacion final" (indice dentro de
  // Procedimiento.verificacionFinal). Opcional por el mismo motivo.
  verificacionHecha?: number[]
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
  diagnosticos!: EntityTable<Diagnostico, 'id'>
  // Nombre con guion bajo a proposito: el motor de sincronizacion usa
  // el MISMO nombre para la tabla local y la remota (snake_case en
  // Postgres), igual que el resto de tablas sincronizadas.
  ejecuciones_diagnostico!: EntityTable<EjecucionDiagnostico, 'id'>
  progresoDiagnostico!: EntityTable<ProgresoDiagnostico, 'diagnosticoId'>
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

    // Modo Diagnostico Inteligente: arboles de decision sincronizados,
    // registro de ejecuciones (solo insercion, como el historial) y
    // avance local del diagnostico en curso (no se sincroniza).
    this.version(8).stores({
      diagnosticos: 'id, categoriaId, updatedAt',
      ejecuciones_diagnostico: 'id, diagnosticoId',
      progresoDiagnostico: 'diagnosticoId',
    })
  }
}

export const db = new SolucionesItDatabase()
