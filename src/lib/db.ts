import Dexie, { type EntityTable, type Table } from 'dexie'
import {
  normalizarEntidad,
  TABLAS_SINCRONIZADAS,
  type EntidadPorTabla,
  type TablaSincronizada,
} from './tablas'

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
  // Color de identidad de la categoria (override manual, grupo N3), o
  // null para derivarlo del `orden`. Es una clave de token del sistema
  // (ver src/features/soluciones/coloresCategoria.ts), nunca un hex
  // suelto. Puede llegar null de una base sin la columna todavia.
  color: string | null
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

// Un lugar fisico como entidad (grupo N3): reemplaza el texto libre de
// `Dispositivo.ubicacion`, que se conserva como copia de referencia.
// `padreId` da una jerarquia opcional (Sede > Area > Punto), sin
// obligacion de usarla. Puede llegar null de una base sin la columna.
export interface Ubicacion {
  id: string
  nombre: string
  padreId: string | null
  notas: string
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

// Una persona como entidad (hallazgo T1 de AUDITORIA_FLUJOS_TI.md):
// reemplaza el texto libre que antes solo vivia como una clave suelta
// dentro de `Dispositivo.detalles` (por ejemplo "Usuario asignado").
// Sin jerarquia (no aplica a personas, a diferencia de ubicaciones).
export interface Persona {
  id: string
  nombre: string
  notas: string
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

// A que apunta un vinculo protegido (grupo P2): un secreto INDEPENDIENTE
// de la boveda ('credencial', `Credencial`) o un dato PROPIO de un
// equipo ('campo', `CampoProtegido`). El mismo vinculo sirve para los
// dos porque ambos comparten cifrado, RLS y desbloqueo; solo cambia de
// que tabla se lee el valor al mostrarlo.
export type TipoVinculoProtegido = 'credencial' | 'campo'

// Vinculo de un paso o una tarea a informacion protegida (grupo P2,
// reemplaza a `credencialId`/`credencialTitulo`, que solo podian
// apuntar a una credencial). `titulo` es copia de referencia, mismo
// patron que el resto de vinculos del sistema: permite mostrar "Datos
// protegidos: X" incluso a quien no tiene permiso de boveda (RLS no le
// descarga ni la credencial ni el campo protegido).
export interface VinculoProtegido {
  tipo: TipoVinculoProtegido
  id: string
  titulo: string
}

// Un bloque del contenido de un paso. Reemplaza a las viejas
// `instrucciones: string[]`: ahora el cuerpo del paso es una lista
// ordenada y heterogenea (tareas, avisos e imagenes intercalados).
// Cada bloque tiene un id estable (el progreso local de las tareas se
// lleva por ese id, no por posicion, asi reordenar no desalinea el
// avance). `tono` solo aplica a 'aviso'; `adjunto` solo a 'imagen';
// `texto` es la tarea, el aviso o el pie de la imagen. `tipoTarea`
// solo aplica a 'tarea', y el vinculo de decision (id + copia del
// titulo, mismo patron que los vinculos del paso) solo a las tareas
// de tipo 'decision'. `vinculoProtegido` (tarea 40, 2026-07-09;
// generalizado a campos protegidos en el grupo P2, 2026-07-21) es el
// mismo vinculo que ya existe a nivel de paso completo
// (`PasoProcedimiento.vinculoProtegido`), pero anclado a una tarea
// puntual: solo aplica a bloques 'tarea', para el caso de un paso con
// varias instrucciones donde solo una necesita mostrar el dato (por
// ejemplo "Ingresar usuario y contraseña").
export interface BloquePaso {
  id: string
  tipo: TipoBloque
  texto: string
  tono: TonoAviso | null
  adjunto: PasoAdjunto | null
  tipoTarea: TipoTarea | null
  decisionArticuloId: string | null
  decisionArticuloTitulo: string
  vinculoProtegido: VinculoProtegido | null
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
  // Informacion protegida vinculada al paso (su apartado "Datos"), o
  // null: un secreto independiente de la boveda o un campo protegido
  // de un dispositivo (grupo P2; antes solo podia ser una credencial,
  // via `credencialId`/`credencialTitulo`). El titulo es una copia de
  // referencia: permite mostrar "Datos: SQL Server" incluso a tecnicos
  // sin acceso a la boveda (RLS no les descarga ni las credenciales ni
  // los campos protegidos). El secreto en si nunca viaja aqui.
  vinculoProtegido: VinculoProtegido | null
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

// Vinculo generico a otro articulo (mismo patron de copia de
// referencia: id real + copia del titulo). Se usa tanto para
// "Articulos relacionados" (Articulo.relacionados) como para
// cualquier lista futura del mismo tipo.
export interface ArticuloRelacionado {
  id: string
  titulo: string
}

// Estado del documento (grupo de esquema, 2026-07-09): 'publicado' es
// el estado de todo lo existente antes de este campo (nunca deja algo
// oficial fuera de golpe). Un borrador u obsoleto se excluye del
// buscador global, las rutas de inicio, los vinculables y el
// Diagnostico Inteligente, salvo para quien esta editando ese mismo
// articulo. Se decidieron 3 estados (sin "en revision"): un equipo de
// 5 no tiene hoy un flujo de aprobacion real detras de ese paso.
export type EstadoArticulo = 'borrador' | 'publicado' | 'obsoleto'

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
  estado: EstadoArticulo
  // Version legible ("1.0", "1.1", "2.0"): sube la menor en cada
  // guardado sobre un articulo publicado, o la mayor si se marca
  // "Cambio mayor" (ver src/lib/version.ts). El historial ya conserva
  // el contenido completo de cada version; esto es solo la etiqueta.
  version: string
  // Otros articulos relacionados (punto 11 de la propuesta): mismo
  // patron de copia de referencia que dispositivosAfectados. La ficha
  // tambien muestra el inverso ("aparece como relacionado en..."),
  // calculado localmente sin guardarlo aqui.
  relacionados: ArticuloRelacionado[]
  // Orden dentro de "Para empezar" cuando esRutaInicio es true (grupo
  // N3): entero, menor primero; 0 por defecto y para todo lo existente.
  // Vive en columna (no en el JSON) porque las rutas de inicio pueden
  // ser cualquier articulo, incluidos manuales sin procedimiento.
  ordenRutaInicio: number
  // Id de la ejecucion de diagnostico de la que nacio este articulo
  // (tarea 140, hallazgo K2): cierra el bucle "sugerencia -> borrador".
  // null en todo lo que se escribio a mano, que es la enorme mayoria.
  //
  // Vive aqui y no en la ejecucion a proposito:
  // `ejecuciones_diagnostico` es un registro inmutable (`soloInsercion`
  // en tablas.ts), asi que marcar la ejecucion como atendida obligaria
  // a volverla actualizable. De que sugerencia nacio es ademas un
  // atributo del articulo, no de la ejecucion. La pantalla de
  // sugerencias deriva de aqui cuales ya estan redactadas, sin guardar
  // ningun estado propio.
  origenSugerenciaId: string | null
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
  // Copia de referencia del nombre de la ubicacion (grupo N3): permite
  // mostrar el lugar aunque la fila de `ubicaciones` aun no sincronice.
  // El dato canonico es `ubicacionId`; se resuelve en vivo contra la
  // tabla `ubicaciones` y esta copia es solo el respaldo.
  ubicacion: string
  // Id de la ubicacion (entidad), o null. Dato canonico del lugar.
  ubicacionId: string | null
  // Copia de referencia del nombre del responsable (hallazgo T1): mismo
  // patron que `ubicacion`. El dato canonico es `responsableId`.
  responsable: string
  // Id de la persona responsable (entidad), o null.
  responsableId: string | null
  // Id del equipo que este dispositivo reemplaza (hallazgo L3), o null.
  // Autorreferencia a la propia tabla; el inverso ("reemplazado por") se
  // deriva en el grafo, no se guarda. Se fija una sola vez al crear el
  // equipo desde la accion "Reemplazar equipo" y no se edita despues.
  reemplazaA: string | null
  ip: string
  estado: string
  observaciones: string
  detalles: Record<string, string>
  // Fotografia principal del equipo (fase Dis2), o null: identifica el
  // dispositivo de un vistazo en la ficha, el listado, el buscador y
  // al escanear su codigo QR. Mismo formato que la portada de un
  // procedimiento (solo referencia de Storage, nombre y tipo).
  foto: PasoAdjunto | null
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
// - 'relacionado' (grupo N3): relaciona dos equipos que no son de red
//   (por ejemplo un POS con su impresora), sin puertos ni medio. Aparece
//   en las fichas de ambos, NO en la topologia (no es dependencia de
//   servicio, asi que el arbol de topologia lo ignora).
export type TipoConexion = 'enlace' | 'instalacion' | 'relacionado'

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

// Clase de secreto INDEPENDIENTE de la boveda (grupo P1, se usa en la
// interfaz desde la fase P3). No existe un tipo "equipo" a proposito:
// un equipo es un dispositivo, y sus datos sensibles son campos
// protegidos de su ficha (ver CampoProtegido), no un secreto suelto.
// Puede llegar null de una base que aun no tiene la columna, por eso
// siempre se lee con `?? 'cuenta'`.
export type TipoSecreto = 'cuenta' | 'red' | 'llave' | 'archivo' | 'nota'

// Archivo adjunto de un secreto tipo 'archivo' (fase P5, "Archivo
// seguro"). Metadatos EN CLARO (mismo criterio que
// CampoProtegido.nombre/tipo o Dispositivo.foto): saber que hay un
// archivo llamado "licencia.pdf" de 240 KB no es el secreto, permite
// listarlo sin desbloquear la boveda. El contenido real vive cifrado en
// el bucket privado `archivos_boveda` de Supabase Storage (RLS
// puede_ver_boveda, distinto del bucket `adjuntos` de fotos/manuales,
// que cualquier autenticado puede leer); `referencia` apunta ahi.
export interface ArchivoSeguro {
  referencia: string
  nombre: string
  tipo: string
  // Tamano del archivo ORIGINAL en bytes (no del blob cifrado, un poco
  // mas grande por la cabecera y el tag de GCM): lo que el tecnico
  // espera ver antes de descargar y descifrar.
  tamano: number
}

export interface Credencial {
  id: string
  titulo: string
  categoria: string
  tipo: TipoSecreto
  datosCifrados: string
  // Fecha de vencimiento opcional (fase B2, "YYYY-MM-DD"), o null. A
  // proposito NO viaja cifrada: permite avisar (ambar cerca de vencer,
  // rojo si ya vencio) sin tener que desbloquear la boveda.
  venceEn: string | null
  // Dispositivos a los que da acceso esta credencial (grupo N3): lista
  // {id, nombre} como copia de referencia, mismo patron que
  // dispositivosAfectados. A proposito NO va cifrada (como venceEn): que
  // credencial pertenece a que equipo no es el secreto; el contenido
  // sigue en datosCifrados. Habilita el inverso "credenciales de este
  // equipo" en la ficha del dispositivo sin desbloquear la boveda.
  dispositivos: DispositivoAfectado[]
  // Archivo cifrado de un secreto tipo 'archivo' (fase P5), o null.
  // Puede llegar null de una base que aun no tiene la columna.
  archivo: ArchivoSeguro | null
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

// Que clase de dato protegido es, para elegir su icono y si arranca
// oculto tras el ojo. 'texto' es el comodin y el valor por defecto.
export type TipoCampoProtegido = 'usuario' | 'contrasena' | 'pin' | 'llave' | 'token' | 'texto'

// Un dato sensible que pertenece a UN equipo concreto (grupo P1): el
// usuario administrador de una impresora, su PIN de impresion, la clave
// del panel de una camara. Antes esto se guardaba como una credencial
// suelta en la boveda que ademas repetia la identidad del equipo
// (titulo, categoria, IP), lo que duplicaba datos que ya viven en la
// ficha del dispositivo; ahora cuelga del equipo y no se duplica nada.
//
// Una fila por campo (y no un bloque por equipo) para que cada dato
// tenga su propio historial y pueda vincularse por separado desde un
// paso de procedimiento (fase P2).
//
// `nombre` y `tipo` NO van cifrados a proposito, igual que
// `Credencial.venceEn` y `Credencial.dispositivos`: saber que un equipo
// tiene un "PIN de impresion" no es el secreto, y permite listarlo y
// vincularlo sin desbloquear la boveda. Solo `valorCifrado` es secreto.
// La tabla remota lleva la MISMA RLS que credenciales (permiso
// puede_ver_boveda), asi que un tecnico sin permiso no descarga estas
// filas y la ficha del equipo no le insinua que existan.
export interface CampoProtegido {
  id: string
  // Equipo al que pertenece, o null para un campo protegido sin equipo.
  dispositivoId: string | null
  nombre: string
  tipo: TipoCampoProtegido
  // Bloque AES-256-GCM (mismo formato que Credencial.datosCifrados).
  valorCifrado: string
  orden: number
  // "YYYY-MM-DD" o null, mismo criterio que Credencial.venceEn: sin cifrar,
  // recordatorio de rotacion (hallazgo S2 de AUDITORIA_FLUJOS_TI.md).
  venceEn: string | null
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

// Motivo de la retroalimentacion cuando el diagnostico NO quedo
// resuelto (fase D3): '' cuando resuelto es 'si' o 'abandonado' (la
// pregunta de motivo solo aparece tras responder "No"). Si el motivo
// es 'encontro_otra_solucion', solucionPropuesta trae el texto libre
// del tecnico para que quien mantiene la base lo revise.
export type MotivoNoResuelto =
  | ''
  | 'no_funciono'
  | 'no_encontro_problema'
  | 'faltan_pasos'
  | 'encontro_otra_solucion'
  | 'otro'

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
  motivo: MotivoNoResuelto
  solucionPropuesta: string
}

export type TipoEntidadHistorial =
  | 'categoria'
  | 'articulo'
  | 'dispositivo'
  | 'credencial'
  | 'diagnostico'
  | 'ubicacion'
  // Grupo P1: el historial de un campo protegido se lee con permiso de
  // boveda (misma restriccion que 'credencial' en la RLS). El valor
  // nunca entra al historial, se registra como "(cifrado)".
  | 'campo_protegido'
  // Hallazgo T1: persona/responsable.
  | 'persona'

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

// Que hizo el tecnico con una credencial (fase B3, auditoria de la
// boveda): consulto la ficha, mostro la contrasena oculta, copio el
// usuario o la contrasena, o la modifico/elimino.
// 'descargo' (fase P5): descifrar y descargar un archivo seguro. Es una
// accion propia porque un secreto tipo 'archivo' no tiene contraseña
// que "mostrar"; reusar 'mostro' dejaria una etiqueta falsa en la
// auditoria y no se podria distinguir de revelar una contraseña.
export type AccionBoveda =
  | 'consulto'
  | 'mostro'
  | 'copio_usuario'
  | 'copio_contrasena'
  | 'modifico'
  | 'elimino'
  | 'descargo'

// Registro inmutable de accesos a la boveda, sincronizado con el
// equipo (solo se insertan filas, como el historial). credencialTitulo
// es copia de referencia (se ve aunque la credencial ya se haya
// eliminado). Es trazabilidad de buena fe: se registra desde el
// cliente al momento de la accion, no impide nada por si solo.
//
// Desde el grupo P1 la auditoria cubre dos clases de objetivo
// (`entidadTipo`): las credenciales de la boveda y los campos
// protegidos de un dispositivo. `credencialId`/`credencialTitulo` se
// REUTILIZAN como id y titulo del objetivo en ambos casos, en vez de
// sumar dos columnas nuevas a un registro inmutable: es compatible con
// las filas ya guardadas (que no traen entidadTipo y se leen como
// 'credencial'). El nombre de esos dos campos queda algo impreciso; se
// documenta aqui y se acepta a cambio de no migrar la tabla.
export interface AccesoBoveda {
  id: string
  entidadTipo: 'credencial' | 'campo_protegido'
  credencialId: string
  credencialTitulo: string
  usuario: string | null
  usuarioNombre: string
  accion: AccionBoveda
  fechaHora: string
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
  // Version del servidor (updated_at) sobre la que partio este cambio,
  // capturada al encolarlo por primera vez (ver encolarCambioDeEntidad
  // en repositorio.ts). Permite detectar si un companiero edito la
  // misma ficha mientras este cambio esperaba para subirse. Ausente en
  // las tablas de solo insercion (historial, ejecuciones de diagnostico,
  // accesos a la boveda) y en una creacion nueva: ninguna de las dos
  // tiene una version previa con la que pueda haber conflicto.
  baseActualizadoEn?: string | null
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
  // Bucket de Storage al que subir (fase P5): opcional y leido con
  // `?? 'adjuntos'` para las filas guardadas antes de que existiera
  // este campo, que siempre fueron a ese bucket.
  bucket?: string
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
  // Evidencia fotografica del trabajo (tarea 79, modo asistente): por
  // paso, el id de la entrada de `historial` (campo 'intervencion')
  // donde cuelga su galeria de fotos. Se crea la primera vez que el
  // tecnico adjunta algo para ese paso y se reutiliza despues (nunca
  // una entrada nueva por revisita); dato local como el resto de este
  // avance, pero la entrada de historial y sus fotos SI se sincronizan.
  evidenciasPorPaso?: Record<string, string>
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

// Fichas marcadas como favoritas por el tecnico en este telefono
// (fase J1 de la jornada del tecnico): a diferencia de `recientes`,
// que se desplaza solo con el uso, esto es una lista fija que el
// tecnico arma a mano y que Inicio muestra siempre. Local y no
// sincronizada (decision D1: los favoritos son habitos de trabajo
// personales); solo se guarda la referencia, los datos se resuelven
// en vivo contra su tabla.
export interface Favorito {
  clave: string
  tipo: 'articulo' | 'dispositivo' | 'diagnostico'
  entidadId: string
  marcadoEn: string
}

class SolucionesItDatabase extends Dexie {
  perfiles!: EntityTable<Perfil, 'id'>
  categorias!: EntityTable<Categoria, 'id'>
  articulos!: EntityTable<Articulo, 'id'>
  dispositivos!: EntityTable<Dispositivo, 'id'>
  ubicaciones!: EntityTable<Ubicacion, 'id'>
  personas!: EntityTable<Persona, 'id'>
  conexiones!: EntityTable<Conexion, 'id'>
  credenciales!: EntityTable<Credencial, 'id'>
  // Nombre con guion bajo a proposito, como ejecuciones_diagnostico y
  // accesos_boveda: el motor de sincronizacion usa el MISMO nombre en
  // la tabla local y en la remota (snake_case en Postgres).
  campos_protegidos!: EntityTable<CampoProtegido, 'id'>
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
  // Mismo criterio de nombre que ejecuciones_diagnostico: igual en
  // local y remoto.
  accesos_boveda!: EntityTable<AccesoBoveda, 'id'>
  cambiosPendientes!: EntityTable<CambioPendiente, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'clave'>
  recientes!: EntityTable<Reciente, 'clave'>
  favoritos!: EntityTable<Favorito, 'clave'>
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

    // Grupo de cambios de esquema (2026-07-09): estado/version/
    // relacionados de articulos, foto de dispositivo y vence_en de
    // credencial son columnas existentes (Dexie no las declara, viven
    // dentro del objeto igual que el resto de campos); lo unico que
    // necesita una tabla nueva es la auditoria de la boveda.
    this.version(9).stores({
      accesos_boveda: 'id, credencialId',
    })

    // Grupo de esquema N3 (2026-07-17): la ubicacion pasa a ser una
    // entidad propia. Las columnas nuevas de tablas existentes
    // (dispositivos.ubicacionId, credenciales.dispositivos,
    // articulos.ordenRutaInicio, categorias.color) no se declaran aqui:
    // Dexie solo necesita los indices, y esos campos viven dentro del
    // objeto igual que el resto. Lo unico que exige tabla nueva es
    // `ubicaciones`.
    this.version(10).stores({
      ubicaciones: 'id, updatedAt',
    })

    // Favoritos del tecnico (fase J1): tabla local no sincronizada,
    // mismo patron que `recientes`.
    this.version(11).stores({
      favoritos: 'clave, marcadoEn',
    })

    // Grupo de esquema P1 (2026-07-21): campos protegidos del
    // dispositivo. Las columnas nuevas de tablas existentes
    // (accesos_boveda.entidadTipo, credenciales.tipo) no se declaran
    // aqui: Dexie solo necesita los indices y esos campos viven dentro
    // del objeto igual que el resto. Lo unico que exige tabla nueva es
    // `campos_protegidos`, indexada por dispositivoId para poder listar
    // los de un equipo sin recorrer la tabla entera.
    this.version(12).stores({
      campos_protegidos: 'id, dispositivoId, updatedAt',
    })

    // Grupo de esquema T1 (2026-07-22): persona/responsable como
    // entidad, mismo criterio que ubicaciones (grupo N3). La columna
    // nueva de dispositivos (responsableId) no se declara aqui: Dexie
    // solo necesita los indices, y vive dentro del objeto igual que el
    // resto de campos.
    this.version(13).stores({
      personas: 'id, updatedAt',
    })

    // Version 14 (2026-07-22, tarea 137): NO cambia el esquema, solo
    // repara datos ya guardados. Sin `.stores()`, Dexie conserva el
    // esquema de la version anterior y ejecuta el upgrade una sola vez
    // por dispositivo.
    //
    // Causa (destapada por la tarea 136, la Boveda que no abria): el
    // relleno por defecto de `aEntidadLocal` solo actua al DESCARGAR
    // una fila, y la sincronizacion es incremental por cursor, asi que
    // una fila que ya vivia en IndexedDB no se vuelve a bajar mientras
    // su `updated_at` no cambie en el servidor: conserva para siempre
    // los huecos que dejo una version anterior de la app. Ese hueco
    // reventaba el render de la Boveda con un TypeError.
    //
    // Se hace aqui y no al arrancar la app a proposito: el upgrade
    // termina ANTES de que nada pueda leer la base, asi que ninguna
    // pantalla llega a ver una fila a medias. No pasa por el
    // repositorio, de modo que no encola cambios en `cambiosPendientes`
    // ni interfiere con la regla anti pisado (tarea 128); y como solo
    // rellena huecos, jamas pisa un valor existente ni toca los campos
    // cifrados.
    this.version(14).upgrade(async (tx) => {
      for (const tabla of TABLAS_SINCRONIZADAS) {
        await tx
          .table(tabla)
          .toCollection()
          .modify((fila: Record<string, unknown>) => {
            normalizarEntidad(tabla, fila)
          })
      }
    })
  }
}

export const db = new SolucionesItDatabase()

// Mapea el nombre de una tabla sincronizada a su store de Dexie. Vive
// aqui y no en `tablas.ts` para que ese modulo pueda importar de este
// solo tipos: `db.ts` necesita `configTablas`/`normalizarEntidad` en
// runtime para el upgrade de la version 14, y un import mutuo dejaria
// un ciclo.
export function storeDe<T extends TablaSincronizada>(tabla: T): Table<EntidadPorTabla[T], string> {
  return db.table(tabla)
}
