import type {
  AlcanceApoyo,
  BloquePaso,
  DestinoOpcion,
  DestinoPaso,
  IntencionGuia,
  NivelDificultad,
  OpcionDecision,
  PasoAdjunto,
  PasoProcedimiento,
  Procedimiento,
  TipoBloque,
  TipoReferencia,
  TipoTarea,
  TipoVinculoProtegido,
  TonoAviso,
  VinculoProtegido,
} from './db'
import { comoHacerDe, normalizarComoHacer } from './comoHacer'
import { texto } from './texto'
import { vinculoDelEquipo } from './vinculoProtegido'

// Logica pura de los procedimientos paso a paso, separada de los
// componentes para poder probarla sin navegador. El dato viaja como
// JSON por Supabase, asi que aqui se valida y se completa cualquier
// campo faltante antes de usarlo en la interfaz.

export function crearPaso(): PasoProcedimiento {
  return {
    id: crypto.randomUUID(),
    titulo: '',
    objetivo: '',
    lugar: '',
    resultado: '',
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
  referenciaId: null,
  referenciaTitulo: '',
  referenciaTipo: null,
} as const

export function crearBloqueTarea(tipoTarea: TipoTarea = 'accion'): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id: crypto.randomUUID(), tipo: 'tarea', tipoTarea }
}

// Una respuesta nueva de una decisión: sin título todavía y siguiendo la
// ruta de siempre, que es lo único que no inventa un destino.
export function crearOpcion(): OpcionDecision {
  return { id: crypto.randomUUID(), titulo: '', descripcion: '', destino: { tipo: 'continuar' } }
}

// UNA DECISIÓN NUEVA NACE CON DOS OPCIONES VACÍAS (tarea 302): es el
// mínimo que pide una pregunta, y el autor las nombra en el sitio. Las
// decisiones de Sí/No de antes (sin `opciones`) se siguen leyendo y
// ejecutando igual, pero el editor ya no crea más.
export function crearBloqueDecision(): BloquePaso {
  return { ...crearBloqueTarea('decision'), opciones: [crearOpcion(), crearOpcion()] }
}

// ¿Esta tarea es una decisión con opciones (tarea 302)? Las de Sí/No de
// antes no lo son: no cambian la ruta, solo desvían por su "No".
export function esDecisionConOpciones(bloque: BloquePaso): boolean {
  return bloque.tipo === 'tarea' && bloque.tipoTarea === 'decision' && (bloque.opciones?.length ?? 0) > 0
}

// Alcance por defecto de un apoyo nuevo: la tarea que el autor tiene
// seleccionada (requisito 4 del editor). Sin tarea a la que colgarlo
// (un paso que todavia no tiene ninguna) nace como apoyo del paso, que
// es lo unico honesto: nunca 'sin-asignar', porque ese valor significa
// "no se sabe" y aqui si se sabe.
function alcanceNuevo(tareaId: string | null): { alcance: AlcanceApoyo; tareaId: string | null } {
  return tareaId ? { alcance: 'tarea', tareaId } : { alcance: 'paso', tareaId: null }
}

// UN AVISO NUEVO NACE COMO INFORMACIÓN, no como alerta (regla 20c de
// REGLAS.md). Nacía en 'precaucion', de cuando el botón se llamaba
// "+ Advertencia": cualquier nota que el autor no se acordara de
// suavizar salía en la ejecución como alerta de color, y con cinco o
// seis por guía las alertas dejaban de destacar. Ahora la alerta
// (precaución o importante) es una decisión del autor, tomada con el
// selector de tono, para un riesgo real.
export function crearBloqueAviso(tareaId: string | null = null): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id: crypto.randomUUID(),
    tipo: 'aviso',
    tono: 'info',
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

// Un bloque que vincula una entrada de Referencia (un termino del
// glosario, un atajo o un comando) a esta tarea. `referenciaTipo`
// guarda lo que el autor eligio insertar, para poder dibujar el hueco
// correcto mientras la fila central no este en este dispositivo.
export function crearBloqueReferencia(
  referenciaTipo: TipoReferencia,
  tareaId: string | null = null,
): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id: crypto.randomUUID(),
    tipo: 'referencia',
    referenciaTipo,
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
  // Ausentes en todo lo guardado antes de la tarea 288.
  const formasBusqueda = frasesDeBusqueda(origen.formasBusqueda)

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
    formasBusqueda.length === 0 &&
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
    ...conFormasBusqueda(formasBusqueda),
    portada,
    objetivoGeneral,
    requisitos,
    pasos,
    verificacionFinal,
    tiempoEstimadoMin,
    dificultad,
  }
}

// Las frases de "¿Cómo buscaría alguien esta guía?" (tarea 288): texto no
// vacío, recortado y sin repetir la misma frase (sin distinguir
// mayúsculas). Tolera lo que llegue de una versión anterior o corrupta.
function frasesDeBusqueda(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  const vistas = new Set<string>()
  const frases: string[] = []
  for (const frase of valor) {
    if (typeof frase !== 'string') continue
    const limpia = frase.trim()
    const clave = limpia.toLowerCase()
    if (limpia === '' || vistas.has(clave)) continue
    vistas.add(clave)
    frases.push(limpia)
  }
  return frases
}

// La clave solo se escribe cuando hay alguna frase: el JSON de las guías
// que no las usan queda exactamente como antes de la tarea 288.
function conFormasBusqueda(formasBusqueda: string[]): Pick<Procedimiento, 'formasBusqueda'> {
  return formasBusqueda.length > 0 ? { formasBusqueda } : {}
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
//
// Desde la tarea 290 tambien el vinculo DEL EQUIPO: `{ tipo: 'equipo',
// finalidad }`, sin id, que se resuelve en la ejecucion. Su titulo se
// deriva siempre de la finalidad (`vinculoDelEquipo`): una sola verdad.
// Cualquier otra forma se sigue descartando.
function normalizarVinculoProtegido(origen: Record<string, unknown>): VinculoProtegido | null {
  if (origen.vinculoProtegido && typeof origen.vinculoProtegido === 'object') {
    const v = origen.vinculoProtegido as Record<string, unknown>
    if (v.tipo === 'equipo') return vinculoDelEquipo(texto(v.finalidad))
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
    // Opcionales desde el 2026-09-22: lo anterior no los trae y quedan
    // vacíos.
    lugar: texto(origen.lugar),
    resultado: texto(origen.resultado),
    bloques: sanearReferenciasDeTarea(normalizarBloques(origen)),
    adjuntos: normalizarAdjuntos(origen),
    vinculoProtegido: normalizarVinculoProtegido(origen),
    subArticuloId,
    subArticuloTitulo: subArticuloId ? texto(origen.subArticuloTitulo) : '',
    solucionArticuloId,
    solucionArticuloTitulo: solucionArticuloId ? texto(origen.solucionArticuloTitulo) : '',
    ...conAlTerminar(normalizarAlTerminar(origen.alTerminar)),
  }
}

// Un id de verdad (texto no vacío) o null.
function idValido(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null
}

// Dónde sigue la ruta al terminar un paso (tarea 302). Un salto sin paso
// de destino no lleva a ninguna parte: se descarta y el paso sigue en el
// de abajo, como todos. Que el destino exista y sea posterior lo decide la
// ruta al recorrerla (y el editor al guardar), no este normalizador: aquí
// no se conocen los demás pasos.
function normalizarAlTerminar(valor: unknown): DestinoPaso | null {
  if (!valor || typeof valor !== 'object') return null
  const origen = valor as Record<string, unknown>
  if (origen.tipo === 'fin') return { tipo: 'fin' }
  const pasoId = origen.tipo === 'paso' ? idValido(origen.pasoId) : null
  return pasoId ? { tipo: 'paso', pasoId } : null
}

// La clave solo se escribe cuando el paso la usa: el JSON de los pasos que
// siguen en el de abajo (casi todos) queda exactamente como antes.
function conAlTerminar(alTerminar: DestinoPaso | null | undefined): Pick<PasoProcedimiento, 'alTerminar'> {
  return alTerminar ? { alTerminar } : {}
}

// A dónde lleva una respuesta, tolerando datos incompletos: un salto o
// una guía sin destino no llevan a ninguna parte, así que vuelven a
// 'continuar' (la ruta de siempre), nunca a un sitio inventado.
function normalizarDestinoOpcion(valor: unknown): DestinoOpcion {
  if (!valor || typeof valor !== 'object') return { tipo: 'continuar' }
  const origen = valor as Record<string, unknown>
  if (origen.tipo === 'fin') return { tipo: 'fin' }
  if (origen.tipo === 'paso') {
    const pasoId = idValido(origen.pasoId)
    return pasoId ? { tipo: 'paso', pasoId } : { tipo: 'continuar' }
  }
  if (origen.tipo === 'guia') {
    const articuloId = idValido(origen.articuloId)
    return articuloId ? { tipo: 'guia', articuloId, titulo: texto(origen.titulo) } : { tipo: 'continuar' }
  }
  return { tipo: 'continuar' }
}

// Las respuestas de una decisión (tarea 302), en su orden. Una opción sin
// título se conserva (el editor la señala y no deja guardar así): borrarla
// al leer destruiría trabajo del autor. Un id repetido, en cambio, se
// renueva: el avance recuerda la opción elegida por su id, y dos iguales
// harían de dos respuestas una sola.
function normalizarOpciones(valor: unknown): OpcionDecision[] {
  if (!Array.isArray(valor)) return []
  const vistos = new Set<string>()
  return valor.flatMap((elemento): OpcionDecision[] => {
    if (!elemento || typeof elemento !== 'object') return []
    const origen = elemento as Record<string, unknown>
    const declarado = idValido(origen.id)
    const id = declarado && !vistos.has(declarado) ? declarado : crypto.randomUUID()
    vistos.add(id)
    return [
      {
        id,
        titulo: texto(origen.titulo),
        descripcion: texto(origen.descripcion),
        destino: normalizarDestinoOpcion(origen.destino),
      },
    ]
  })
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

const TIPOS_BLOQUE: TipoBloque[] = ['tarea', 'aviso', 'imagen', 'archivo', 'guia', 'referencia']
const TIPOS_REFERENCIA: TipoReferencia[] = ['herramienta', 'termino', 'atajo', 'comando']
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

  // UN BLOQUE DE REFERENCIA SOBREVIVE A SU REFERENCIA. Solo se
  // descarta si nunca llego a tener destino (`referenciaId` vacio): con
  // id, el bloque se conserva SIEMPRE, aunque la fila central se haya
  // eliminado o aun no haya sincronizado. Ahi la vista muestra que la
  // referencia no esta disponible y conserva la copia del titulo; el
  // vinculo NO se rompe solo, porque borrarlo en silencio destruiria
  // trabajo del autor por un estado que puede ser temporal.
  if (tipo === 'referencia') {
    const referenciaId =
      typeof origen.referenciaId === 'string' && origen.referenciaId !== ''
        ? origen.referenciaId
        : null
    if (!referenciaId) return null
    const referenciaTipo = (TIPOS_REFERENCIA as string[]).includes(origen.referenciaTipo as string)
      ? (origen.referenciaTipo as TipoReferencia)
      : null
    return {
      ...CAMPOS_BLOQUE_VACIOS,
      id,
      tipo,
      texto: textoBloque,
      referenciaId,
      referenciaTitulo: texto(origen.referenciaTitulo),
      referenciaTipo,
      ...normalizarAlcance(origen),
    }
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
  // LAS DOS FORMAS DE UNA DECISIÓN (tarea 302). Con `opciones` es una
  // decisión con respuestas propias y su destino va en cada una; sin ellas
  // es la de Sí/No de siempre, con su `decisionArticuloId`. Las dos se
  // leen; ninguna se convierte sola en la otra.
  const opciones = tipoTarea === 'decision' ? normalizarOpciones(origen.opciones) : []
  const decisionArticuloId =
    tipoTarea === 'decision' && opciones.length === 0 ? idValido(origen.decisionArticuloId) : null
  // "CÓMO HACERLO" (tarea 303): las microacciones de una tarea de acción,
  // toleradas (`normalizarComoHacer`). Sin ninguna, o en otro tipo de tarea,
  // la clave no aparece: una guía de antes del campo se lee exactamente
  // igual, y un texto suelto donde iría la lista no se convierte en nada.
  const comoHacer = tipoTarea === 'accion' ? normalizarComoHacer(origen.comoHacer) : []
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
    ...(opciones.length > 0 ? { opciones } : {}),
    ...(comoHacer.length > 0 ? { comoHacer } : {}),
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
//
// Los caminos de las decisiones (tarea 302) apuntan a pasos POR SU ID, así
// que se traducen a los ids nuevos: sin esto, la copia saltaría a pasos
// que solo existen en el original.
export function duplicarProcedimiento(procedimiento: Procedimiento): Procedimiento {
  const nuevosIdsPaso = new Map(procedimiento.pasos.map((paso) => [paso.id, crypto.randomUUID()]))
  const traducirPaso = (pasoId: string) => nuevosIdsPaso.get(pasoId) ?? pasoId
  return {
    ...procedimiento,
    pasos: procedimiento.pasos.map((paso) => ({
      ...paso,
      id: traducirPaso(paso.id),
      adjuntos: paso.adjuntos.map((adjunto) => ({ ...adjunto })),
      bloques: duplicarBloques(paso.bloques, traducirPaso),
      ...conAlTerminar(
        paso.alTerminar?.tipo === 'paso' ? { tipo: 'paso', pasoId: traducirPaso(paso.alTerminar.pasoId) } : paso.alTerminar,
      ),
    })),
    requisitos: [...procedimiento.requisitos],
    verificacionFinal: [...procedimiento.verificacionFinal],
    portada: procedimiento.portada ? { ...procedimiento.portada } : null,
    // Las formas de búsqueda se copian como cualquier otro texto de la
    // guía: la copia nace en borrador y su autor las ajusta.
    ...conFormasBusqueda([...(procedimiento.formasBusqueda ?? [])]),
  }
}

// Copia de los bloques de un paso con ids nuevos, TRADUCIENDO ademas
// las referencias `tareaId` a los ids nuevos. Sin esto, duplicar una
// guia dejaba cada apoyo apuntando a la tarea del ORIGINAL: en la
// copia esa tarea no existe, asi que los apoyos habrian quedado todos
// 'sin-asignar' y el autor tendria que reasignarlos uno por uno.
function duplicarBloques(bloques: BloquePaso[], traducirPaso: (pasoId: string) => string): BloquePaso[] {
  const nuevosIds = new Map(bloques.map((bloque) => [bloque.id, crypto.randomUUID()]))
  return bloques.map((bloque) => ({
    ...bloque,
    id: nuevosIds.get(bloque.id) ?? crypto.randomUUID(),
    tareaId: bloque.tareaId ? (nuevosIds.get(bloque.tareaId) ?? null) : null,
    ...(bloque.opciones
      ? {
          opciones: bloque.opciones.map((opcion) => ({
            ...opcion,
            destino:
              opcion.destino.tipo === 'paso'
                ? { tipo: 'paso' as const, pasoId: traducirPaso(opcion.destino.pasoId) }
                : { ...opcion.destino },
          })),
        }
      : {}),
    // Las microacciones de "Cómo hacerlo" (tarea 303) se copian enteras, con
    // sus ids: solo tienen que ser únicos dentro de su tarea, y la tarea ya
    // es otra. Copiadas, no compartidas: editar la copia no toca el original.
    ...(bloque.comoHacer ? { comoHacer: bloque.comoHacer.map((micro) => ({ ...micro })) } : {}),
  }))
}

// Texto plano de un procedimiento para el indice de busqueda: asi
// "back up" encuentra el articulo aunque solo aparezca en un paso.
// El titulo de la informacion protegida vinculada (credencial o campo
// protegido) queda fuera a proposito: esos titulos solo entran al
// indice cuando la boveda esta desbloqueada (ARQUITECTURA.md, seccion 6).
//
// Es el CONTENIDO GENERAL de la guia (tarea 288). La descripcion ("cuando
// usar este procedimiento") y las formas de busqueda NO van aqui: el
// indice las lleva en sus propios campos (`cuandoUsar` y
// `formasBusqueda`), porque coincidir ahi dice mas que coincidir con una
// palabra suelta de un paso. Siguen encontrandose igual, sin duplicarse.
export function textoDeProcedimiento(procedimiento: Procedimiento | null): string {
  if (!procedimiento) return ''
  const partes = [
    procedimiento.objetivoGeneral,
    ...procedimiento.requisitos,
    ...procedimiento.verificacionFinal,
  ]
  for (const paso of procedimiento.pasos) {
    partes.push(paso.titulo)
    partes.push(paso.objetivo)
    // El lugar y el resultado del paso (2026-09-22): buscar "dispositivos
    // e impresoras" encuentra la guía que se hace ahí, y buscar lo que
    // aparece en la pantalla ("ventana ejecutar"), la que lo enseña.
    partes.push(paso.lugar, paso.resultado)
    // Textos de tareas, avisos y pies de imagen (todo el cuerpo del
    // paso entra al indice para que "back up" encuentre el articulo).
    partes.push(...paso.bloques.map((b) => b.texto))
    // Las microacciones de "Cómo hacerlo" de cada acción (tarea 303), con
    // el mismo criterio: el nombre de una opción de menú, un acceso
    // directo o un comando escrito ahí encuentra la guía que lo usa, como
    // lo encontraba cuando vivía en un dato técnico o en la instrucción.
    for (const bloque of paso.bloques) {
      for (const micro of comoHacerDe(bloque)) partes.push(micro.accion, micro.elemento, micro.ubicacion ?? '')
    }
    // Los titulos del subprocedimiento, de la solucion y de los
    // vinculos de decision si se indexan (no son informacion
    // protegida): buscar "impresora" encuentra tambien los
    // procedimientos que incluyen esa tarea.
    partes.push(paso.subArticuloTitulo, paso.solucionArticuloTitulo)
    partes.push(...paso.bloques.map((b) => b.decisionArticuloTitulo))
    // Las respuestas de una decisión con opciones (tarea 302) y la guía a
    // la que lleva cada una: buscar "nuevo outlook" encuentra la guía que
    // pregunta por la versión.
    for (const bloque of paso.bloques) {
      for (const opcion of bloque.opciones ?? []) {
        partes.push(opcion.titulo, opcion.descripcion)
        if (opcion.destino.tipo === 'guia') partes.push(opcion.destino.titulo)
      }
    }
    // Titulo de las guias vinculadas desde una tarea: mismo criterio
    // que los vinculos del paso, no son informacion protegida.
    partes.push(...paso.bloques.map((b) => b.guiaArticuloTitulo))
    // Copia del titulo de las referencias vinculadas (un termino, un
    // atajo o un comando): buscar "mstsc" encuentra tambien la guia que
    // lo usa. Solo la copia de referencia, nunca el contenido central,
    // que vive en su propia fila y se indexa por separado.
    partes.push(...paso.bloques.map((b) => b.referenciaTitulo))
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

// `pasoSeCompletaSolo` se retiro en la tarea 3 del encargo del
// 2026-09-09. Existia para no cerrar un paso con contingencia vinculada
// antes de responder "¿Ocurrio algun error?", y esa pregunta ya no
// existe: la contingencia es una fila disponible siempre (regla R59).
// Lo unico que hacia era pedir un clic mas en "Paso hecho" despues de
// terminar la guia del paso. Quien decide ahora es `cierreDelPaso`.

export interface DatosProcedimientoParaGuardar {
  descripcion: string
  // "¿Cómo buscaría alguien esta guía?", una frase por línea (tarea 288).
  // Opcional: quien no lo pasa guarda sin formas de búsqueda.
  formasBusquedaTexto?: string
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
  formasBusquedaTexto = '',
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

  const formasBusqueda = frasesDeBusqueda(formasBusquedaTexto.split('\n'))

  const pasosLimpios = pasos
    .map(({ alTerminar, ...paso }) => ({
      ...paso,
      titulo: paso.titulo.trim(),
      objetivo: paso.objetivo.trim(),
      lugar: paso.lugar.trim(),
      resultado: paso.resultado.trim(),
      bloques: limpiarBloques(paso.bloques),
      vinculoProtegido: limpiarVinculoProtegido(paso.vinculoProtegido),
      subArticuloTitulo: paso.subArticuloId ? paso.subArticuloTitulo.trim() : '',
      solucionArticuloTitulo: paso.solucionArticuloId ? paso.solucionArticuloTitulo.trim() : '',
      // A dónde sigue al terminar (tarea 302): un salto a medio elegir no
      // se guarda. Que el destino exista lo exige el editor antes.
      ...conAlTerminar(normalizarAlTerminar(alTerminar)),
    }))
    .filter(pasoTieneContenido)

  const descripcionLimpia = descripcion.trim()
  const objetivoGeneralLimpio = objetivoGeneral.trim()

  const sinContenido =
    descripcionLimpia === '' &&
    formasBusqueda.length === 0 &&
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
    ...conFormasBusqueda(formasBusqueda),
    portada,
    objetivoGeneral: objetivoGeneralLimpio,
    requisitos,
    pasos: pasosLimpios,
    verificacionFinal,
    tiempoEstimadoMin,
    dificultad,
  }
}

// ¿Le queda algo a este paso al guardarlo? Un paso sin título ni nada
// dentro se descarta al guardar (`prepararProcedimientoParaGuardar`), y el
// editor no deja que un camino lleve a uno así (`problemasDeRutas`): las
// dos preguntas tienen que ser la misma, por eso viven aquí una sola vez.
export function pasoTieneContenido(paso: PasoProcedimiento): boolean {
  return (
    paso.titulo.trim() !== '' ||
    limpiarBloques(paso.bloques).length > 0 ||
    paso.adjuntos.length > 0 ||
    paso.vinculoProtegido !== null ||
    paso.subArticuloId !== null ||
    paso.solucionArticuloId !== null
  )
}

// El vinculo protegido al guardar: el fijo con su titulo recortado; el del
// equipo, con su finalidad recortada y el titulo que le corresponde.
function limpiarVinculoProtegido(vinculo: VinculoProtegido | null): VinculoProtegido | null {
  if (!vinculo) return null
  if (vinculo.tipo === 'equipo') return vinculoDelEquipo(vinculo.finalidad)
  return { ...vinculo, titulo: vinculo.titulo.trim() }
}

// Limpia los bloques de un paso al guardar: recorta el texto y descarta
// tareas y avisos vacios (una imagen sin texto es valida, es el pie que
// es opcional). Una imagen sin adjunto no deberia existir, pero se
// descarta por seguridad. Los titulos de referencia de los vinculos de
// decision e informacion protegida (tarea 40) solo se conservan junto
// a su id.
function limpiarBloques(bloques: BloquePaso[]): BloquePaso[] {
  const limpios = bloques
    .map((bloque) => {
      const opciones = opcionesParaGuardar(bloque)
      // "Cómo hacerlo" (tarea 303): las microacciones recortadas, sin las
      // vacías y solo en una tarea de acción (`comoHacerDe`). Quitarlas
      // todas en el editor quita la clave: nunca se guarda una lista vacía.
      const comoHacer = comoHacerDe(bloque)
      const limpio: BloquePaso = {
        ...bloque,
        texto: bloque.texto.trim(),
        // Con opciones, el destino va en cada una: el del "No" de antes ya
        // no se usa y no se guarda.
        decisionArticuloId: opciones ? null : bloque.decisionArticuloId,
        decisionArticuloTitulo: !opciones && bloque.decisionArticuloId ? bloque.decisionArticuloTitulo.trim() : '',
        guiaArticuloTitulo: bloque.guiaArticuloId ? bloque.guiaArticuloTitulo.trim() : '',
        referenciaTitulo: bloque.referenciaId ? bloque.referenciaTitulo.trim() : '',
        vinculoProtegido: limpiarVinculoProtegido(bloque.vinculoProtegido),
      }
      delete limpio.opciones
      delete limpio.comoHacer
      return {
        ...limpio,
        ...(opciones ? { opciones } : {}),
        ...(comoHacer.length > 0 ? { comoHacer } : {}),
      }
    })
    .filter((bloque) => {
      // Una imagen o un archivo a medio subir (sin adjunto) se
      // descartan; una guia vinculada sin destino, tambien. En los dos
      // casos el bloque no llego a tener contenido: no hay nada que
      // perder. Lo que SI se conserva siempre es el apoyo completo,
      // aunque no diga a que tarea pertenece.
      if (bloque.tipo === 'imagen' || bloque.tipo === 'archivo') return bloque.adjunto !== null
      if (bloque.tipo === 'guia') return bloque.guiaArticuloId !== null
      // Una referencia sin destino nunca llego a ser nada; una CON
      // destino se conserva siempre, aunque la fila central ya no este.
      if (bloque.tipo === 'referencia') return bloque.referenciaId !== null
      return bloque.texto !== ''
    })
  // Al guardar se vuelven a revisar las referencias: si el autor borro
  // la tarea a la que colgaba una foto, la foto se queda 'sin-asignar'
  // en vez de guardar un vinculo roto.
  return sanearReferenciasDeTarea(limpios)
}

// Las respuestas de una decisión con opciones, recortadas para guardar, o
// null si el bloque no las lleva (no es una decisión, o es una de Sí/No).
// Que estén completas (título, destino válido) lo exige el editor antes
// de guardar (`problemasDeRutas`); aquí solo se limpia.
function opcionesParaGuardar(bloque: BloquePaso): OpcionDecision[] | null {
  if (bloque.tipo !== 'tarea' || bloque.tipoTarea !== 'decision' || !bloque.opciones?.length) return null
  return bloque.opciones.map((opcion) => ({
    ...opcion,
    titulo: opcion.titulo.trim(),
    descripcion: opcion.descripcion.trim(),
    destino: opcion.destino.tipo === 'guia' ? { ...opcion.destino, titulo: opcion.destino.titulo.trim() } : opcion.destino,
  }))
}
