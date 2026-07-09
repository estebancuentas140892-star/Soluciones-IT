import type {
  BloquePaso,
  NivelDificultad,
  PasoAdjunto,
  PasoProcedimiento,
  Procedimiento,
  TipoBloque,
  TonoAviso,
} from './db'

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
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

export function crearBloqueTarea(): BloquePaso {
  return { id: crypto.randomUUID(), tipo: 'tarea', texto: '', tono: null, adjunto: null }
}

// El boton del editor se llama "+ Advertencia", asi que el bloque
// nuevo nace con el tono 'precaucion' (icono y color de advertencia);
// el selector de tono permite suavizarlo a informacion o consejo.
export function crearBloqueAviso(): BloquePaso {
  return { id: crypto.randomUUID(), tipo: 'aviso', texto: '', tono: 'precaucion', adjunto: null }
}

export function crearBloqueImagen(adjunto: PasoAdjunto): BloquePaso {
  return { id: crypto.randomUUID(), tipo: 'imagen', texto: '', tono: null, adjunto }
}

// Las tareas (bloques con casilla) de un paso, en orden. Son las que
// cuentan para completarlo; avisos e imagenes son contenido de lectura.
export function tareasDe(bloques: BloquePaso[]): BloquePaso[] {
  return bloques.filter((b) => b.tipo === 'tarea')
}

// Devuelve un procedimiento bien formado o null si no hay pasos (un
// articulo sin pasos es un articulo normal). Tolera datos incompletos
// o corruptos que lleguen del servidor o de versiones anteriores.
export function normalizarProcedimiento(valor: unknown): Procedimiento | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const origen = valor as Record<string, unknown>

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

  if (pasos.length === 0) return null
  return {
    descripcion: texto(origen.descripcion),
    portada: normalizarUnAdjunto(origen.portada),
    objetivoGeneral: texto(origen.objetivoGeneral),
    requisitos,
    pasos,
    verificacionFinal,
    tiempoEstimadoMin: numeroPositivo(origen.tiempoEstimadoMin),
    dificultad: dificultadValida(origen.dificultad),
  }
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

// Los campos que el editor dejo de ofrecer (detalle, nota,
// advertencia, consejo y decision de ramificacion) se descartan aqui
// a proposito: los articulos guardados antes del rediseño los pierden
// al normalizar, decision tomada por el usuario el 2026-07-03.
function normalizarPaso(origen: Record<string, unknown>): PasoProcedimiento {
  const credencialId =
    typeof origen.credencialId === 'string' && origen.credencialId !== '' ? origen.credencialId : null
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
    bloques: normalizarBloques(origen),
    adjuntos: normalizarAdjuntos(origen),
    credencialId,
    // Los titulos de referencia solo tienen sentido junto a su id.
    credencialTitulo: credencialId ? texto(origen.credencialTitulo) : '',
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
        id: crypto.randomUUID(),
        tipo: 'tarea' as const,
        texto: textoTarea,
        tono: null,
        adjunto: null,
      }))
  }

  return []
}

const TIPOS_BLOQUE: TipoBloque[] = ['tarea', 'aviso', 'imagen']
const TONOS_AVISO_VALIDOS: TonoAviso[] = ['info', 'precaucion', 'importante', 'consejo', 'dato']

// Un bloque valido o null (para descartarlo): una tarea o un aviso sin
// texto no aporta nada, y una imagen sin adjunto valido tampoco.
function normalizarBloque(valor: unknown): BloquePaso | null {
  if (!valor || typeof valor !== 'object') return null
  const origen = valor as Record<string, unknown>
  const id = typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID()
  const tipo = (TIPOS_BLOQUE as string[]).includes(origen.tipo as string)
    ? (origen.tipo as TipoBloque)
    : 'tarea'
  const textoBloque = texto(origen.texto)

  if (tipo === 'imagen') {
    const adjunto = normalizarUnAdjunto(origen.adjunto)
    if (!adjunto) return null
    return { id, tipo, texto: textoBloque, tono: null, adjunto }
  }

  if (textoBloque.trim() === '') return null

  if (tipo === 'aviso') {
    const tono = (TONOS_AVISO_VALIDOS as string[]).includes(origen.tono as string)
      ? (origen.tono as TonoAviso)
      : 'info'
    return { id, tipo, texto: textoBloque, tono, adjunto: null }
  }

  return { id, tipo: 'tarea', texto: textoBloque, tono: null, adjunto: null }
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

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

// Texto plano de un procedimiento para el indice de busqueda: asi
// "back up" encuentra el articulo aunque solo aparezca en un paso.
// El titulo de la credencial vinculada queda fuera a proposito: los
// titulos de la boveda solo aparecen en la busqueda cuando esta
// desbloqueada (ARQUITECTURA.md, seccion 6).
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
    // Los titulos del subprocedimiento y de la solucion vinculados si
    // se indexan (no son informacion protegida): buscar "impresora"
    // encuentra tambien los procedimientos que incluyen esa tarea.
    partes.push(paso.subArticuloTitulo, paso.solucionArticuloTitulo)
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
// descarta pasos totalmente vacios y devuelve null si no queda nada.
// Los requisitos volvieron a editarse (antes del 2026-07-03 no se
// podian); los articulos guardados desde entonces igual los conservan.
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
      credencialTitulo: paso.credencialId ? paso.credencialTitulo.trim() : '',
      subArticuloTitulo: paso.subArticuloId ? paso.subArticuloTitulo.trim() : '',
      solucionArticuloTitulo: paso.solucionArticuloId ? paso.solucionArticuloTitulo.trim() : '',
    }))
    .filter(
      (paso) =>
        paso.titulo !== '' ||
        paso.bloques.length > 0 ||
        paso.adjuntos.length > 0 ||
        paso.credencialId !== null ||
        paso.subArticuloId !== null ||
        paso.solucionArticuloId !== null,
    )

  if (pasosLimpios.length === 0) return null
  return {
    descripcion: descripcion.trim(),
    portada,
    objetivoGeneral: objetivoGeneral.trim(),
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
// descarta por seguridad.
function limpiarBloques(bloques: BloquePaso[]): BloquePaso[] {
  return bloques
    .map((bloque) => ({ ...bloque, texto: bloque.texto.trim() }))
    .filter((bloque) => {
      if (bloque.tipo === 'imagen') return bloque.adjunto !== null
      return bloque.texto !== ''
    })
}
