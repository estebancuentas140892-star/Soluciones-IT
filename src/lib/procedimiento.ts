import type {
  AlcanceApoyo,
  BloquePaso,
  IntencionGuia,
  NivelDificultad,
  PasoAdjunto,
  PasoProcedimiento,
  Procedimiento,
  TipoBloque,
  TipoTarea,
  TipoVinculoProtegido,
  TonoAviso,
  VinculoProtegido,
} from './db'
import { texto } from './texto'

// Logica pura de los procedimientos paso a paso, separada de los
// componentes para poder probarla sin navegador. El dato viaja como
// JSON por Supabase, asi que aqui se valida y se completa cualquier
// campo faltante antes de usarlo en la interfaz.

export function crearPaso(): PasoProcedimiento {
  return {
    id: crypto.randomUUID(),
    titulo: '',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

// Campos comunes de un bloque nuevo: todo lo que no aplica al tipo
// queda explicitamente en su valor vacio, para que el objeto tenga
// siempre la misma forma venga de donde venga.
export const CAMPOS_BLOQUE_VACIOS = {
  texto: '',
  tono: null,
  adjunto: null,
  tipoTarea: null,
  decisionArticuloId: null,
  decisionArticuloTitulo: '',
  vinculoProtegido: null,
  alcance: null,
  tareaId: null,
  guiaArticuloId: null,
  guiaArticuloTitulo: '',
  intencionGuia: null,
} as const

export function crearBloqueTarea(tipoTarea: TipoTarea = 'accion'): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id: crypto.randomUUID(), tipo: 'tarea', tipoTarea }
}

// Alcance por defecto de un apoyo nuevo: la tarea que el autor tiene
// seleccionada (requisito 4 del editor). Sin tarea a la que colgarlo
// (un paso que todavia no tiene ninguna) nace como apoyo del paso, que
// es lo unico honesto: nunca 'sin-asignar', porque ese valor significa
// "no se sabe" y aqui si se sabe.
function alcanceNuevo(tareaId: string | null): { alcance: AlcanceApoyo; tareaId: string | null } {
  return tareaId ? { alcance: 'tarea', tareaId } : { alcance: 'paso', tareaId: null }
}

// El boton del editor se llama "+ Advertencia", asi que el bloque
// nuevo nace con el tono 'precaucion' (icono y color de advertencia);
// el selector de tono permite suavizarlo a informacion o consejo.
export function crearBloqueAviso(tareaId: string | null = null): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id: crypto.randomUUID(),
    tipo: 'aviso',
    tono: 'precaucion',
    ...alcanceNuevo(tareaId),
  }
}

export function crearBloqueImagen(tareaId: string | null = null): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id: crypto.randomUUID(), tipo: 'imagen', ...alcanceNuevo(tareaId) }
}

export function crearBloqueArchivo(tareaId: string | null = null): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id: crypto.randomUUID(), tipo: 'archivo', ...alcanceNuevo(tareaId) }
}

export function crearBloqueGuia(tareaId: string | null = null): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id: crypto.randomUUID(),
    tipo: 'guia',
    intencionGuia: 'necesario',
    ...alcanceNuevo(tareaId),
  }
}

// Las tareas (bloques con casilla) de un paso, en orden. Son las que
// cuentan para completarlo; avisos, imagenes, archivos y guias
// vinculadas son apoyos.
export function tareasDe(bloques: BloquePaso[]): BloquePaso[] {
  return bloques.filter((b) => b.tipo === 'tarea')
}

// ¿Este bloque es un apoyo (todo lo que no es una tarea)?
export function esApoyo(bloque: BloquePaso): boolean {
  return bloque.tipo !== 'tarea'
}

// Devuelve un procedimiento bien formado o null si no queda ningun
// contenido (ni pasos ni metadata): un articulo asi es un articulo
// normal. OJO: un procedimiento SIN pasos pero con metadata (portada,
// descripcion, objetivo, requisitos o verificacion) no es null: es un
// manual con esa informacion y sin pasos ejecutables. Quien necesite
// saber si hay algo que EJECUTAR debe revisar `pasos.length > 0`
// aparte (ver `procedimientoEjecutable`), no la nulidad de este
// resultado (hallazgo K1 de AUDITORIA_FLUJOS_TI.md: antes cualquier
// articulo sin pasos perdia en silencio toda su metadata al guardar y
// al recargar el editor). Tolera datos incompletos o corruptos que
// lleguen del servidor o de versiones anteriores.
export function normalizarProcedimiento(valor: unknown): Procedimiento | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const origen = valor as Record<string, unknown>

  const descripcion = texto(origen.descripcion)
  const portada = normalizarUnAdjunto(origen.portada)
  const objetivoGeneral = texto(origen.objetivoGeneral)

  const requisitos = Array.isArray(origen.requisitos)
    ? origen.requisitos.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
    : []

  const verificacionFinal = Array.isArray(origen.verificacionFinal)
    ? origen.verificacionFinal.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    : []

  const pasos = Array.isArray(origen.pasos)
    ? origen.pasos
        .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
        .map(normalizarPaso)
    : []

  const tiempoEstimadoMin = numeroPositivo(origen.tiempoEstimadoMin)
  const dificultad = dificultadValida(origen.dificultad)

  const sinContenido =
    descripcion === '' &&
    !portada &&
    objetivoGeneral === '' &&
    requisitos.length === 0 &&
    pasos.length === 0 &&
    verificacionFinal.length === 0 &&
    tiempoEstimadoMin === null &&
    dificultad === null
  if (sinContenido) return null

  return {
    descripcion,
    portada,
    objetivoGeneral,
    requisitos,
    pasos,
    verificacionFinal,
    tiempoEstimadoMin,
    dificultad,
  }
}

// ¿Este procedimiento tiene pasos que ejecutar? Un procedimiento no
// nulo puede existir solo por su metadata (K1): esta es la pregunta
// correcta para decidir si corresponde ofrecer "Ejecutar", el modo
// asistente, vincularlo como subprocedimiento/solucion de otro paso o
// como raiz de un diagnostico. Un `procedimiento` null nunca es
// ejecutable.
export function procedimientoEjecutable(procedimiento: Procedimiento | null): procedimiento is Procedimiento {
  return procedimiento !== null && procedimiento.pasos.length > 0
}

function numeroPositivo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : null
}

const DIFICULTADES_VALIDAS: NivelDificultad[] = ['principiante', 'intermedio', 'avanzado']

function dificultadValida(valor: unknown): NivelDificultad | null {
  return typeof valor === 'string' && (DIFICULTADES_VALIDAS as string[]).includes(valor)
    ? (valor as NivelDificultad)
    : null
}

const TIPOS_VINCULO_PROTEGIDO: TipoVinculoProtegido[] = ['credencial', 'campo']

// Vinculo protegido de un paso o una tarea (grupo P2), tolerando datos
// de dos epocas: si trae el objeto nuevo `vinculoProtegido` se valida
// tal cual; si trae los campos viejos `credencialId`/`credencialTitulo`
// (el unico vinculo protegido que existia antes de P2), se migran a
// `{tipo:'credencial', ...}`, mismo patron con el que ya se migraron
// `instrucciones` a bloques e `imagen` a adjuntos. Comparte logica
// entre paso y bloque porque ambos guardan el vinculo con el mismo par
// de campos.
function normalizarVinculoProtegido(origen: Record<string, unknown>): VinculoProtegido | null {
  if (origen.vinculoProtegido && typeof origen.vinculoProtegido === 'object') {
    const v = origen.vinculoProtegido as Record<string, unknown>
    const tipo = (TIPOS_VINCULO_PROTEGIDO as string[]).includes(v.tipo as string)
      ? (v.tipo as TipoVinculoProtegido)
      : null
    const id = typeof v.id === 'string' && v.id !== '' ? v.id : null
    return tipo && id ? { tipo, id, titulo: texto(v.titulo) } : null
  }
  const credencialId =
    typeof origen.credencialId === 'string' && origen.credencialId !== '' ? origen.credencialId : null
  return credencialId ? { tipo: 'credencial', id: credencialId, titulo: texto(origen.credencialTitulo) } : null
}

// Los campos que el editor dejo de ofrecer (detalle, nota,
// advertencia, consejo y decision de ramificacion) se descartan aqui
// a proposito: los articulos guardados antes del rediseño los pierden
// al normalizar, decision tomada por el usuario el 2026-07-03.
function normalizarPaso(origen: Record<string, unknown>): PasoProcedimiento {
  const subArticuloId =
    typeof origen.subArticuloId === 'string' && origen.subArticuloId !== '' ? origen.subArticuloId : null
  const solucionArticuloId =
    typeof origen.solucionArticuloId === 'string' && origen.solucionArticuloId !== ''
      ? origen.solucionArticuloId
      : null
  return {
    id: typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID(),
    titulo: texto(origen.titulo),
    objetivo: texto(origen.objetivo),
    bloques: sanearReferenciasDeTarea(normalizarBloques(origen)),
    adjuntos: normalizarAdjuntos(origen),
    vinculoProtegido: normalizarVinculoProtegido(origen),
    subArticuloId,
    subArticuloTitulo: subArticuloId ? texto(origen.subArticuloTitulo) : '',
    solucionArticuloId,
    solucionArticuloTitulo: solucionArticuloId ? texto(origen.solucionArticuloTitulo) : '',
  }
}

// Bloques del cuerpo del paso, tolerando datos de tres epocas:
// - si trae la lista nueva `bloques`, se valida bloque por bloque;
// - si trae las viejas `instrucciones` (array de texto), cada una se
//   migra a un bloque 'tarea' con id nuevo (mismo patron que la
//   migracion de `imagen` a `adjuntos`);
// - si no trae ninguna, queda vacio.
function normalizarBloques(origen: Record<string, unknown>): BloquePaso[] {
  if (Array.isArray(origen.bloques)) {
    return origen.bloques
      .map(normalizarBloque)
      .filter((b): b is BloquePaso => b !== null)
  }

  if (Array.isArray(origen.instrucciones)) {
    return origen.instrucciones
      .filter((i): i is string => typeof i === 'string' && i.trim() !== '')
      .map((textoTarea) => ({
        ...CAMPOS_BLOQUE_VACIOS,
        id: crypto.randomUUID(),
        tipo: 'tarea' as const,
        texto: textoTarea,
        tipoTarea: 'accion' as const,
      }))
  }

  return []
}

const TIPOS_BLOQUE: TipoBloque[] = ['tarea', 'aviso', 'imagen', 'archivo', 'guia']
const TONOS_AVISO_VALIDOS: TonoAviso[] = ['info', 'precaucion', 'importante', 'consejo', 'dato']
const TIPOS_TAREA_VALIDOS: TipoTarea[] = ['accion', 'verificacion', 'decision']
const ALCANCES_VALIDOS: AlcanceApoyo[] = ['tarea', 'paso', 'sin-asignar']
const INTENCIONES_GUIA: IntencionGuia[] = ['necesario', 'consulta', 'contingencia']

// A que pertenece un apoyo guardado, tolerando las dos epocas.
//
// LA REGLA DE COMPATIBILIDAD, que es la parte delicada: un apoyo SIN
// `alcance` viene de una guia escrita cuando el campo no existia, asi
// que no se sabe a que tarea pertenece. Queda 'sin-asignar': se
// conserva entero, se muestra una sola vez al entrar al paso y el
// editor lo marca para que el autor decida. NO se reparte entre todas
// las tareas (que es el defecto que se esta corrigiendo) ni se adivina
// por la posicion en el array (eso seria inventarle una intencion al
// dato). Ver la seccion 8 del encargo.
function normalizarAlcance(origen: Record<string, unknown>): {
  alcance: AlcanceApoyo
  tareaId: string | null
} {
  const declarado = (ALCANCES_VALIDOS as string[]).includes(origen.alcance as string)
    ? (origen.alcance as AlcanceApoyo)
    : null
  const tareaId = typeof origen.tareaId === 'string' && origen.tareaId !== '' ? origen.tareaId : null
  if (declarado === 'tarea') {
    // Sin tarea a la que apuntar, "pertenece a una tarea" no dice cual:
    // vuelve a ser un destino desconocido, no un apoyo del paso.
    return tareaId ? { alcance: 'tarea', tareaId } : { alcance: 'sin-asignar', tareaId: null }
  }
  if (declarado === 'paso') return { alcance: 'paso', tareaId: null }
  if (declarado === 'sin-asignar') return { alcance: 'sin-asignar', tareaId: null }
  return { alcance: 'sin-asignar', tareaId: null }
}

// Un bloque valido o null (para descartarlo): una tarea o un aviso sin
// texto no aporta nada, y una imagen o un archivo sin adjunto valido
// tampoco. Una guia vinculada sin id de destino tampoco.
function normalizarBloque(valor: unknown): BloquePaso | null {
  if (!valor || typeof valor !== 'object') return null
  const origen = valor as Record<string, unknown>
  const id = typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID()
  const tipo = (TIPOS_BLOQUE as string[]).includes(origen.tipo as string)
    ? (origen.tipo as TipoBloque)
    : 'tarea'
  const textoBloque = texto(origen.texto)

  if (tipo === 'imagen' || tipo === 'archivo') {
    const adjunto = normalizarUnAdjunto(origen.adjunto)
    if (!adjunto) return null
    return { ...CAMPOS_BLOQUE_VACIOS, id, tipo, texto: textoBloque, adjunto, ...normalizarAlcance(origen) }
  }

  if (tipo === 'guia') {
    const guiaArticuloId =
      typeof origen.guiaArticuloId === 'string' && origen.guiaArticuloId !== ''
        ? origen.guiaArticuloId
        : null
    if (!guiaArticuloId) return null
    const intencionGuia = (INTENCIONES_GUIA as string[]).includes(origen.intencionGuia as string)
      ? (origen.intencionGuia as IntencionGuia)
      : 'necesario'
    return {
      ...CAMPOS_BLOQUE_VACIOS,
      id,
      tipo,
      texto: textoBloque,
      guiaArticuloId,
      guiaArticuloTitulo: texto(origen.guiaArticuloTitulo),
      intencionGuia,
      ...normalizarAlcance(origen),
    }
  }

  if (textoBloque.trim() === '') return null

  if (tipo === 'aviso') {
    const tono = (TONOS_AVISO_VALIDOS as string[]).includes(origen.tono as string)
      ? (origen.tono as TonoAviso)
      : 'info'
    return { ...CAMPOS_BLOQUE_VACIOS, id, tipo, texto: textoBloque, tono, ...normalizarAlcance(origen) }
  }

  // Tareas guardadas antes de la clasificacion (o con un tipo invalido)
  // caen a 'accion'. El vinculo de decision solo tiene sentido en las
  // tareas 'decision' y con un id valido; el titulo, solo junto al id.
  const tipoTarea = (TIPOS_TAREA_VALIDOS as string[]).includes(origen.tipoTarea as string)
    ? (origen.tipoTarea as TipoTarea)
    : 'accion'
  const decisionArticuloId =
    tipoTarea === 'decision' &&
    typeof origen.decisionArticuloId === 'string' &&
    origen.decisionArticuloId !== ''
      ? origen.decisionArticuloId
      : null
  // Vinculo protegido (tarea 40, generalizado en P2): opcional en
  // cualquier tarea, sin depender del tipoTarea.
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id,
    tipo: 'tarea',
    texto: textoBloque,
    tipoTarea,
    decisionArticuloId,
    decisionArticuloTitulo: decisionArticuloId ? texto(origen.decisionArticuloTitulo) : '',
    vinculoProtegido: normalizarVinculoProtegido(origen),
  }
}

// UN APOYO NUNCA SE PIERDE POR UN VINCULO ROTO. Si un apoyo apunta a
// una tarea que ya no esta en el paso (el autor la borro despues de
// colgarle la foto), el bloque se conserva y pasa a 'sin-asignar', que
// es exactamente lo que ocurrio: su destino dejo de saberse. Asi el
// contenido sigue visible al entrar al paso y el editor lo señala para
// que el autor lo reasigne, en vez de desaparecer en silencio.
export function sanearReferenciasDeTarea(bloques: BloquePaso[]): BloquePaso[] {
  const idsTarea = new Set(bloques.filter((b) => b.tipo === 'tarea').map((b) => b.id))
  return bloques.map((bloque) =>
    bloque.alcance === 'tarea' && bloque.tareaId && !idsTarea.has(bloque.tareaId)
      ? { ...bloque, alcance: 'sin-asignar' as const, tareaId: null }
      : bloque,
  )
}

// Adjuntos del paso (galeria), tolerando datos viejos: si el paso trae
// la lista `adjuntos` se valida entrada por entrada; si en cambio trae
// el campo viejo `imagen` (una sola captura, string), se migra a un
// unico adjunto para no perder la imagen de los procedimientos guardados.
function normalizarAdjuntos(origen: Record<string, unknown>): PasoAdjunto[] {
  if (Array.isArray(origen.adjuntos)) {
    return origen.adjuntos
      .map(normalizarUnAdjunto)
      .filter((a): a is PasoAdjunto => a !== null)
  }

  if (typeof origen.imagen === 'string' && origen.imagen !== '') {
    return [
      {
        referencia: origen.imagen,
        nombre: nombreDeReferencia(origen.imagen),
        tipo: tipoDeReferencia(origen.imagen),
      },
    ]
  }

  return []
}

// Un adjunto valido (referencia no vacia) o null. Completa nombre y
// tipo a partir de la referencia cuando faltan (datos viejos).
function normalizarUnAdjunto(valor: unknown): PasoAdjunto | null {
  if (!valor || typeof valor !== 'object') return null
  const origen = valor as Record<string, unknown>
  const referencia = texto(origen.referencia)
  if (referencia === '') return null
  return {
    referencia,
    nombre: texto(origen.nombre) || nombreDeReferencia(referencia),
    tipo: texto(origen.tipo) || tipoDeReferencia(referencia),
  }
}

// Nombre legible a partir de la referencia de Storage. Las referencias
// tienen forma ".../pasos/<timestamp>-<nombre>"; se recupera el nombre
// quitando el prefijo del timestamp.
function nombreDeReferencia(referencia: string): string {
  const ultimo = referencia.split('/').pop() ?? referencia
  const sinTimestamp = ultimo.replace(/^\d+-/, '')
  return sinTimestamp || 'Adjunto'
}

// Tipo MIME aproximado segun la extension, solo para datos viejos que
// no lo guardaban (los adjuntos nuevos traen su tipo real). Sirve para
// decidir si se muestra como imagen o como archivo.
function tipoDeReferencia(referencia: string): string {
  const extension = referencia.split('.').pop()?.toLowerCase() ?? ''
  const porExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
  }
  // Sin extension reconocida se asume imagen: el campo viejo `imagen`
  // solo aceptaba imagenes.
  return porExtension[extension] ?? 'image/*'
}

// Copia profunda de un procedimiento para "Duplicar": regenera los
// ids internos de pasos y bloques (el progreso local y las claves de
// la interfaz asumen ids unicos; compartirlos entre el original y la
// copia seria buscarse problemas). Los adjuntos y la portada CONSERVAN
// su referencia de Storage a proposito: los archivos se comparten sin
// copiarse (nunca se borran de Storage) y los vinculos a otros
// articulos o a informacion protegida (subprocedimiento, solucion,
// decision, vinculoProtegido) siguen apuntando a los mismos, que es lo
// correcto en una copia.
export function duplicarProcedimiento(procedimiento: Procedimiento): Procedimiento {
  return {
    ...procedimiento,
    pasos: procedimiento.pasos.map((paso) => ({
      ...paso,
      id: crypto.randomUUID(),
      adjuntos: paso.adjuntos.map((adjunto) => ({ ...adjunto })),
      bloques: duplicarBloques(paso.bloques),
    })),
    requisitos: [...procedimiento.requisitos],
    verificacionFinal: [...procedimiento.verificacionFinal],
    portada: procedimiento.portada ? { ...procedimiento.portada } : null,
  }
}

// Copia de los bloques de un paso con ids nuevos, TRADUCIENDO ademas
// las referencias `tareaId` a los ids nuevos. Sin esto, duplicar una
// guia dejaba cada apoyo apuntando a la tarea del ORIGINAL: en la
// copia esa tarea no existe, asi que los apoyos habrian quedado todos
// 'sin-asignar' y el autor tendria que reasignarlos uno por uno.
function duplicarBloques(bloques: BloquePaso[]): BloquePaso[] {
  const nuevosIds = new Map(bloques.map((bloque) => [bloque.id, crypto.randomUUID()]))
  return bloques.map((bloque) => ({
    ...bloque,
    id: nuevosIds.get(bloque.id) ?? crypto.randomUUID(),
    tareaId: bloque.tareaId ? (nuevosIds.get(bloque.tareaId) ?? null) : null,
  }))
}

// Texto plano de un procedimiento para el indice de busqueda: asi
// "back up" encuentra el articulo aunque solo aparezca en un paso.
// El titulo de la informacion protegida vinculada (credencial o campo
// protegido) queda fuera a proposito: esos titulos solo entran al
// indice cuando la boveda esta desbloqueada (ARQUITECTURA.md, seccion 6).
export function textoDeProcedimiento(procedimiento: Procedimiento | null): string {
  if (!procedimiento) return ''
  // La descripcion ("cuando usar este procedimiento") entra al indice:
  // buscar por la situacion ("impresora de red") encuentra el articulo.
  const partes = [
    procedimiento.descripcion,
    procedimiento.objetivoGeneral,
    ...procedimiento.requisitos,
    ...procedimiento.verificacionFinal,
  ]
  for (const paso of procedimiento.pasos) {
    partes.push(paso.titulo)
    partes.push(paso.objetivo)
    // Textos de tareas, avisos y pies de imagen (todo el cuerpo del
    // paso entra al indice para que "back up" encuentre el articulo).
    partes.push(...paso.bloques.map((b) => b.texto))
    // Los titulos del subprocedimiento, de la solucion y de los
    // vinculos de decision si se indexan (no son informacion
    // protegida): buscar "impresora" encuentra tambien los
    // procedimientos que incluyen esa tarea.
    partes.push(paso.subArticuloTitulo, paso.solucionArticuloTitulo)
    partes.push(...paso.bloques.map((b) => b.decisionArticuloTitulo))
    // Titulo de las guias vinculadas desde una tarea: mismo criterio
    // que los vinculos del paso, no son informacion protegida.
    partes.push(...paso.bloques.map((b) => b.guiaArticuloTitulo))
    // Nombre de los archivos anclados a una tarea: buscar por el
    // nombre del manual encuentra la guia que lo usa, igual que ya
    // pasaba con los adjuntos del paso.
    partes.push(...paso.bloques.map((b) => (b.tipo === 'archivo' ? (b.adjunto?.nombre ?? '') : '')))
  }
  return partes.filter(Boolean).join(' ')
}

// A que paso avanzar automaticamente despues de completar el del
// indice dado: el siguiente pendiente hacia adelante o, si no hay,
// el primero pendiente desde el inicio (por si el tecnico salto
// alguno). Devuelve el indice destino o null si no queda ninguno.
export function siguientePasoPendiente(
  idsEnOrden: string[],
  hechos: ReadonlySet<string>,
  desdeIndice: number,
): number | null {
  for (let i = desdeIndice + 1; i < idsEnOrden.length; i++) {
    if (!hechos.has(idsEnOrden[i])) return i
  }
  for (let i = 0; i < desdeIndice; i++) {
    if (!hechos.has(idsEnOrden[i])) return i
  }
  return null
}

// Un paso es un contenedor de tareas, no una sola instruccion. Su
// "trabajo previo" son las instrucciones propias del paso y su
// subprocedimiento vinculado: ambos deben terminarse antes de dar el
// paso por completado. `subProcedimientoSatisfecho` ya viene resuelto
// por quien llama (es true cuando el paso no tiene subprocedimiento
// que ejecutar aqui, o cuando el vinculado ya quedo completo).
export function pasoTrabajoPrevioCompleto(
  totalInstrucciones: number,
  instruccionesHechas: number,
  subProcedimientoSatisfecho: boolean,
): boolean {
  const instruccionesOk = totalInstrucciones === 0 || instruccionesHechas >= totalInstrucciones
  return instruccionesOk && subProcedimientoSatisfecho
}

// ¿El paso puede completarse y avanzar por si solo? Solo cuando su
// trabajo previo esta completo y NO tiene una solucion de error
// vinculada. Si la tiene, el paso no avanza automaticamente: primero
// aparece la pregunta "¿Ocurrio algun error?" y el paso se completa al
// responderla (asi no se salta la validacion de errores del paso).
export function pasoSeCompletaSolo(
  trabajoPrevioCompleto: boolean,
  tieneSolucionVinculada: boolean,
): boolean {
  return trabajoPrevioCompleto && !tieneSolucionVinculada
}

export interface DatosProcedimientoParaGuardar {
  descripcion: string
  portada: PasoAdjunto | null
  objetivoGeneral: string
  requisitosTexto: string
  pasos: PasoProcedimiento[]
  verificacionFinalTexto: string
  tiempoEstimadoMin: number | null
  dificultad: NivelDificultad | null
}

// Prepara el procedimiento que se va a guardar: limpia espacios,
// descarta pasos totalmente vacios y devuelve null solo si no queda
// ningun contenido, ni pasos ni metadata (K1: antes devolvia null en
// cuanto no habia pasos, aunque el autor hubiera escrito descripcion,
// portada, objetivo, requisitos, verificacion, tiempo o dificultad;
// ese null se guardaba tal cual y todo eso se perdia en silencio, y se
// volvia a perder al reabrir el editor porque `normalizarProcedimiento`
// aplicaba la misma regla al leer). Los requisitos volvieron a
// editarse (antes del 2026-07-03 no se podian); los articulos
// guardados desde entonces igual los conservan.
export function prepararProcedimientoParaGuardar({
  descripcion,
  portada,
  objetivoGeneral,
  requisitosTexto,
  pasos,
  verificacionFinalTexto,
  tiempoEstimadoMin,
  dificultad,
}: DatosProcedimientoParaGuardar): Procedimiento | null {
  const requisitos = requisitosTexto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)

  const verificacionFinal = verificacionFinalTexto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)

  const pasosLimpios = pasos
    .map((paso) => ({
      ...paso,
      titulo: paso.titulo.trim(),
      objetivo: paso.objetivo.trim(),
      bloques: limpiarBloques(paso.bloques),
      vinculoProtegido: paso.vinculoProtegido
        ? { ...paso.vinculoProtegido, titulo: paso.vinculoProtegido.titulo.trim() }
        : null,
      subArticuloTitulo: paso.subArticuloId ? paso.subArticuloTitulo.trim() : '',
      solucionArticuloTitulo: paso.solucionArticuloId ? paso.solucionArticuloTitulo.trim() : '',
    }))
    .filter(
      (paso) =>
        paso.titulo !== '' ||
        paso.bloques.length > 0 ||
        paso.adjuntos.length > 0 ||
        paso.vinculoProtegido !== null ||
        paso.subArticuloId !== null ||
        paso.solucionArticuloId !== null,
    )

  const descripcionLimpia = descripcion.trim()
  const objetivoGeneralLimpio = objetivoGeneral.trim()

  const sinContenido =
    descripcionLimpia === '' &&
    !portada &&
    objetivoGeneralLimpio === '' &&
    requisitos.length === 0 &&
    pasosLimpios.length === 0 &&
    verificacionFinal.length === 0 &&
    tiempoEstimadoMin === null &&
    dificultad === null
  if (sinContenido) return null

  return {
    descripcion: descripcionLimpia,
    portada,
    objetivoGeneral: objetivoGeneralLimpio,
    requisitos,
    pasos: pasosLimpios,
    verificacionFinal,
    tiempoEstimadoMin,
    dificultad,
  }
}

// Limpia los bloques de un paso al guardar: recorta el texto y descarta
// tareas y avisos vacios (una imagen sin texto es valida, es el pie que
// es opcional). Una imagen sin adjunto no deberia existir, pero se
// descarta por seguridad. Los titulos de referencia de los vinculos de
// decision e informacion protegida (tarea 40) solo se conservan junto
// a su id.
function limpiarBloques(bloques: BloquePaso[]): BloquePaso[] {
  const limpios = bloques
    .map((bloque) => ({
      ...bloque,
      texto: bloque.texto.trim(),
      decisionArticuloTitulo: bloque.decisionArticuloId ? bloque.decisionArticuloTitulo.trim() : '',
      guiaArticuloTitulo: bloque.guiaArticuloId ? bloque.guiaArticuloTitulo.trim() : '',
      vinculoProtegido: bloque.vinculoProtegido
        ? { ...bloque.vinculoProtegido, titulo: bloque.vinculoProtegido.titulo.trim() }
        : null,
    }))
    .filter((bloque) => {
      // Una imagen o un archivo a medio subir (sin adjunto) se
      // descartan; una guia vinculada sin destino, tambien. En los dos
      // casos el bloque no llego a tener contenido: no hay nada que
      // perder. Lo que SI se conserva siempre es el apoyo completo,
      // aunque no diga a que tarea pertenece.
      if (bloque.tipo === 'imagen' || bloque.tipo === 'archivo') return bloque.adjunto !== null
      if (bloque.tipo === 'guia') return bloque.guiaArticuloId !== null
      return bloque.texto !== ''
    })
  // Al guardar se vuelven a revisar las referencias: si el autor borro
  // la tarea a la que colgaba una foto, la foto se queda 'sin-asignar'
  // en vez de guardar un vinculo roto.
  return sanearReferenciasDeTarea(limpios)
}
