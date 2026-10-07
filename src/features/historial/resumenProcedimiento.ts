import { comoHacerDe } from '../../lib/comoHacer'
import type { BloquePaso, PasoAdjunto, PasoProcedimiento, Procedimiento, TipoBloque } from '../../lib/db'
import { normalizarProcedimiento, tareasDe } from '../../lib/procedimiento'
import { resultadoVisualDe } from '../../lib/resultadoVisual'
import { mismoVinculoProtegido } from '../../lib/vinculoProtegido'

// Convierte el cambio de un procedimiento (guardado en el historial
// como el JSON de antes y despues) en un resumen legible: que cambio,
// en que paso y sin volcar toda la estructura interna. El JSON crudo
// se conserva en el historial para depuracion, pero la interfaz
// muestra este resumen. Toda la logica es pura para poder probarla
// sin React ni la base local.

export interface TamanoProcedimiento {
  pasos: number
  instrucciones: number
}

export interface ResumenProcedimiento {
  // Estado del procedimiento antes del cambio, para dar contexto
  // ("Antes: 5 pasos, 10 instrucciones"). Es null si antes no existia
  // (el cambio fue crearlo).
  contexto: TamanoProcedimiento | null
  // Cambios detectados, en lenguaje natural, uno por linea.
  cambios: string[]
}

export function resumenProcedimiento(
  valorAnterior: string,
  valorNuevo: string,
): ResumenProcedimiento {
  const anterior = parsear(valorAnterior)
  const nueva = parsear(valorNuevo)

  if (!anterior && !nueva) {
    return { contexto: null, cambios: ['Se actualizó el procedimiento.'] }
  }
  if (!nueva) {
    return { contexto: tamano(anterior as Procedimiento), cambios: ['Se eliminó el procedimiento.'] }
  }
  if (!anterior) {
    return {
      contexto: null,
      cambios: [`Se agregó el procedimiento (${textoContexto(tamano(nueva))}).`],
    }
  }

  const cambios = diffProcedimiento(anterior, nueva)
  return {
    contexto: tamano(anterior),
    cambios: cambios.length > 0 ? cambios : ['Se actualizó el procedimiento.'],
  }
}

// Texto breve del tamano de un procedimiento, con plural correcto.
export function textoContexto(tamano: TamanoProcedimiento): string {
  const pasos = `${tamano.pasos} ${tamano.pasos === 1 ? 'paso' : 'pasos'}`
  const instrucciones = `${tamano.instrucciones} ${
    tamano.instrucciones === 1 ? 'instrucción' : 'instrucciones'
  }`
  return `${pasos}, ${instrucciones}`
}

// ----------------------------------------------------------------
// Comparacion
// ----------------------------------------------------------------

function diffProcedimiento(anterior: Procedimiento, nueva: Procedimiento): string[] {
  const cambios: string[] = []
  const previosPorId = new Map(anterior.pasos.map((paso) => [paso.id, paso]))
  const nuevosPorId = new Map(nueva.pasos.map((paso) => [paso.id, paso]))

  // Pasos agregados, en el orden de la version nueva.
  nueva.pasos.forEach((paso, indice) => {
    if (!previosPorId.has(paso.id)) {
      cambios.push(`Se agregó un nuevo paso ${nombrePasoNuevo(indice, paso)}.`)
    }
  })

  // Pasos eliminados, con su posicion en la version anterior.
  anterior.pasos.forEach((paso, indice) => {
    if (!nuevosPorId.has(paso.id)) {
      cambios.push(`Se eliminó el ${etiquetaPaso(indice, paso)}.`)
    }
  })

  // Reordenamiento: los pasos comunes quedaron en distinto orden.
  if (huboReordenamiento(anterior.pasos, nueva.pasos)) {
    cambios.push('Se cambió el orden de los pasos.')
  }

  // Pasos modificados (mismo id presente en ambas versiones), en orden.
  nueva.pasos.forEach((paso, indice) => {
    const previo = previosPorId.get(paso.id)
    if (previo) cambios.push(...diffPaso(previo, paso, indice))
  })

  // Requisitos previos del procedimiento.
  const requisitos = diffLista(anterior.requisitos, nueva.requisitos)
  agregarLineasRequisitos(cambios, requisitos)

  // Verificación final del procedimiento.
  const verificacion = diffLista(anterior.verificacionFinal, nueva.verificacionFinal)
  agregarLineasVerificacion(cambios, verificacion)

  if (anterior.objetivoGeneral !== nueva.objetivoGeneral) {
    if (!anterior.objetivoGeneral) cambios.push('Se definió el objetivo general del procedimiento.')
    else if (!nueva.objetivoGeneral) cambios.push('Se quitó el objetivo general del procedimiento.')
    else cambios.push('Se actualizó el objetivo general del procedimiento.')
  }

  if (anterior.descripcion !== nueva.descripcion) {
    if (!anterior.descripcion) cambios.push('Se definió la descripción del procedimiento.')
    else if (!nueva.descripcion) cambios.push('Se quitó la descripción del procedimiento.')
    else cambios.push('Se actualizó la descripción del procedimiento.')
  }

  // "¿Cómo buscaría alguien esta guía?" (tarea 288): ausente equivale a
  // ninguna, así que una versión de antes del campo no cuenta como cambio.
  const formasAntes = anterior.formasBusqueda ?? []
  const formasAhora = nueva.formasBusqueda ?? []
  if (formasAntes.join('\n') !== formasAhora.join('\n')) {
    if (formasAntes.length === 0) cambios.push('Se definieron las formas de búsqueda de la guía.')
    else if (formasAhora.length === 0) cambios.push('Se quitaron las formas de búsqueda de la guía.')
    else cambios.push('Se actualizaron las formas de búsqueda de la guía.')
  }

  // La portada se compara por referencia de Storage: cada subida
  // genera una referencia unica, asi que cambiarla es un reemplazo.
  const portadaAnterior = anterior.portada?.referencia ?? null
  const portadaNueva = nueva.portada?.referencia ?? null
  if (portadaAnterior !== portadaNueva) {
    if (!portadaAnterior) cambios.push('Se agregó la imagen de portada del procedimiento.')
    else if (!portadaNueva) cambios.push('Se quitó la imagen de portada del procedimiento.')
    else cambios.push('Se reemplazó la imagen de portada del procedimiento.')
  }

  if (anterior.tiempoEstimadoMin !== nueva.tiempoEstimadoMin) {
    if (nueva.tiempoEstimadoMin === null) cambios.push('Se quitó el tiempo estimado del procedimiento.')
    else cambios.push(`Se actualizó el tiempo estimado a ${nueva.tiempoEstimadoMin} min.`)
  }

  if (anterior.dificultad !== nueva.dificultad) {
    if (nueva.dificultad === null) cambios.push('Se quitó la dificultad del procedimiento.')
    else cambios.push(`Se actualizó la dificultad a "${nueva.dificultad}".`)
  }

  return cambios
}

function diffPaso(previo: PasoProcedimiento, actual: PasoProcedimiento, indice: number): string[] {
  const cambios: string[] = []
  const numero = indice + 1
  const etiqueta = etiquetaPaso(indice, actual)

  if (previo.titulo !== actual.titulo) {
    if (!previo.titulo) cambios.push(`Se definió el título del Paso ${numero} como "${actual.titulo}".`)
    else if (!actual.titulo) cambios.push(`Se quitó el título del Paso ${numero}.`)
    else cambios.push(`Se modificó el título del Paso ${numero}: "${previo.titulo}" → "${actual.titulo}".`)
  }

  // Los textos heredados del paso (objetivo, lugar y resultado; obsoletos
  // desde la tarea 307) ya no se editan en la app, pero siguen en el JSON y
  // quien escribe el contenido puede cambiarlos o quitarlos: el historial
  // lo sigue diciendo. Ausente o vacío es lo mismo: no es un cambio.
  if ((previo.objetivo ?? '') !== (actual.objetivo ?? '')) {
    if (!previo.objetivo) cambios.push(`Se definió el objetivo del ${etiqueta}.`)
    else if (!actual.objetivo) cambios.push(`Se quitó el objetivo del ${etiqueta}.`)
    else cambios.push(`Se actualizó el objetivo del ${etiqueta}.`)
  }
  if ((previo.lugar ?? '') !== (actual.lugar ?? '')) {
    if (!previo.lugar) cambios.push(`Se definió dónde se hace el ${etiqueta}: "${actual.lugar}".`)
    else if (!actual.lugar) cambios.push(`Se quitó dónde se hace el ${etiqueta}.`)
    else cambios.push(`Se cambió dónde se hace el ${etiqueta}: "${previo.lugar}" → "${actual.lugar}".`)
  }
  if ((previo.resultado ?? '') !== (actual.resultado ?? '')) {
    if (!previo.resultado) cambios.push(`Se definió qué debe verse al terminar el ${etiqueta}: "${actual.resultado}".`)
    else if (!actual.resultado) cambios.push(`Se quitó qué debe verse al terminar el ${etiqueta}.`)
    else cambios.push(`Se cambió qué debe verse al terminar el ${etiqueta}: "${previo.resultado}" → "${actual.resultado}".`)
  }

  const tareas = diffLista(textosDeBloque(previo, 'tarea'), textosDeBloque(actual, 'tarea'))
  agregarLineasInstrucciones(cambios, tareas, etiqueta)

  // "Cómo hacerlo" de cada instrucción (tarea 303), con el nombre con que
  // lo lee el técnico. Sin esto, cambiar solo el recorrido de una acción
  // quedaba como "Se actualizó el procedimiento.", sin decir dónde.
  agregarLineasComoHacer(cambios, previo, actual, etiqueta)

  // La imagen de "Debes ver" de cada instrucción (tarea 307).
  agregarLineasDebesVer(cambios, previo, actual, etiqueta)

  const avisos = diffLista(textosDeBloque(previo, 'aviso'), textosDeBloque(actual, 'aviso'))
  agregarLineasAvisos(cambios, avisos, etiqueta)

  // Imagenes: las de la galeria del paso y las intercaladas en el
  // cuerpo se cuentan juntas (para el usuario, todas son "imagenes del
  // paso"; da igual donde vivan en el JSON).
  agregarLineasAdjuntos(cambios, imagenesDe(previo), imagenesDe(actual), etiqueta)

  // El vinculo protegido (grupo P2) puede apuntar a una credencial o a
  // un campo protegido de un equipo, o pedir la credencial del equipo con
  // el que se trabaja (tarea 290); se compara por lo que pide, no por
  // identidad de objeto, y el texto no distingue el tipo (para el
  // historial, todos son "informacion protegida").
  if (!mismoVinculoProtegido(previo.vinculoProtegido, actual.vinculoProtegido)) {
    if (!previo.vinculoProtegido) cambios.push(`Se vinculó información protegida al ${etiqueta}.`)
    else if (!actual.vinculoProtegido) cambios.push(`Se quitó la información protegida del ${etiqueta}.`)
    else cambios.push(`Se cambió la información protegida del ${etiqueta}.`)
  }

  if (previo.subArticuloId !== actual.subArticuloId) {
    if (!previo.subArticuloId) cambios.push(`Se vinculó un subprocedimiento al ${etiqueta}.`)
    else if (!actual.subArticuloId) cambios.push(`Se quitó el subprocedimiento del ${etiqueta}.`)
    else cambios.push(`Se cambió el subprocedimiento del ${etiqueta}.`)
  }

  if (previo.solucionArticuloId !== actual.solucionArticuloId) {
    if (!previo.solucionArticuloId) cambios.push(`Se vinculó una solución de error al ${etiqueta}.`)
    else if (!actual.solucionArticuloId) cambios.push(`Se quitó la solución de error del ${etiqueta}.`)
    else cambios.push(`Se cambió la solución de error del ${etiqueta}.`)
  }

  return cambios
}

interface DiffLista {
  agregadas: number
  eliminadas: number
  editadas: number
}

// Compara dos listas de texto (instrucciones o requisitos) por valor.
// Un elemento que desaparece y otro que aparece se interpretan como
// una edicion (min de ambos); el resto son altas o bajas netas. Asi
// cambiar una palabra de una instruccion se lee "se editó", no "se
// eliminó y se agregó".
function diffLista(anterior: string[], nueva: string[]): DiffLista {
  const restantes = [...nueva]
  let soloAnterior = 0
  for (const item of anterior) {
    const indice = restantes.indexOf(item)
    if (indice >= 0) restantes.splice(indice, 1)
    else soloAnterior++
  }
  const agregadasBrutas = restantes.length
  const editadas = Math.min(agregadasBrutas, soloAnterior)
  return {
    agregadas: agregadasBrutas - editadas,
    eliminadas: soloAnterior - editadas,
    editadas,
  }
}

function agregarLineasInstrucciones(cambios: string[], diff: DiffLista, etiqueta: string): void {
  if (diff.editadas === 1) cambios.push(`Se editó una instrucción del ${etiqueta}.`)
  else if (diff.editadas > 1) cambios.push(`Se editaron ${diff.editadas} instrucciones del ${etiqueta}.`)
  if (diff.agregadas === 1) cambios.push(`Se agregó una nueva instrucción al ${etiqueta}.`)
  else if (diff.agregadas > 1) cambios.push(`Se agregaron ${diff.agregadas} instrucciones al ${etiqueta}.`)
  if (diff.eliminadas === 1) cambios.push(`Se eliminó una instrucción del ${etiqueta}.`)
  else if (diff.eliminadas > 1) cambios.push(`Se eliminaron ${diff.eliminadas} instrucciones del ${etiqueta}.`)
}

// Se compara por el id de la tarea, no por su texto: corregir la
// instrucción no convierte su "Cómo hacerlo" en otro. Una instrucción
// nueva que ya lo trae cuenta como definido (su alta se dice aparte); el de
// una que se eliminó se va con ella. Dentro, cuenta lo que se lee: editar,
// añadir, quitar o reordenar microacciones es cambiarlo; los ids no.
function agregarLineasComoHacer(
  cambios: string[],
  previo: PasoProcedimiento,
  actual: PasoProcedimiento,
  etiqueta: string,
): void {
  const antes = new Map(tareasDe(previo.bloques).map((tarea) => [tarea.id, firmaComoHacer(tarea)]))
  let definidos = 0
  let cambiados = 0
  let quitados = 0
  for (const tarea of tareasDe(actual.bloques)) {
    const ahora = firmaComoHacer(tarea)
    const anterior = antes.get(tarea.id) ?? ''
    if (anterior === ahora) continue
    if (anterior === '') definidos++
    else if (ahora === '') quitados++
    else cambiados++
  }
  if (definidos === 1) cambios.push(`Se definió «Cómo hacerlo» en una instrucción del ${etiqueta}.`)
  else if (definidos > 1) cambios.push(`Se definió «Cómo hacerlo» en ${definidos} instrucciones del ${etiqueta}.`)
  if (cambiados === 1) cambios.push(`Se cambió «Cómo hacerlo» en una instrucción del ${etiqueta}.`)
  else if (cambiados > 1) cambios.push(`Se cambió «Cómo hacerlo» en ${cambiados} instrucciones del ${etiqueta}.`)
  if (quitados === 1) cambios.push(`Se quitó «Cómo hacerlo» de una instrucción del ${etiqueta}.`)
  else if (quitados > 1) cambios.push(`Se quitó «Cómo hacerlo» de ${quitados} instrucciones del ${etiqueta}.`)
}

// Lo que se lee del "Cómo hacerlo" de una tarea, en orden y sin los ids,
// para compararlo: '' si no tiene.
function firmaComoHacer(tarea: BloquePaso): string {
  const microPasos = comoHacerDe(tarea)
  if (microPasos.length === 0) return ''
  return JSON.stringify(microPasos.map((micro) => [micro.accion, micro.elemento, micro.ubicacion ?? '']))
}

// "Debes ver" de cada tarea (tarea 307), por tarea y con lo que cambió:
// la imagen o su descripción.
function agregarLineasDebesVer(
  cambios: string[],
  previo: PasoProcedimiento,
  actual: PasoProcedimiento,
  etiqueta: string,
): void {
  const antes = new Map(tareasDe(previo.bloques).map((tarea) => [tarea.id, firmaDebesVer(tarea)]))
  let anadidas = 0
  let cambiadas = 0
  let quitadas = 0
  for (const tarea of tareasDe(actual.bloques)) {
    const ahora = firmaDebesVer(tarea)
    const anterior = antes.get(tarea.id) ?? ''
    if (anterior === ahora) continue
    if (anterior === '') anadidas++
    else if (ahora === '') quitadas++
    else cambiadas++
  }
  const una = (n: number) => (n === 1 ? 'una instrucción' : `${n} instrucciones`)
  if (anadidas > 0) cambios.push(`Se añadió la imagen de «Debes ver» en ${una(anadidas)} del ${etiqueta}.`)
  if (cambiadas > 0) cambios.push(`Se cambió la imagen de «Debes ver» en ${una(cambiadas)} del ${etiqueta}.`)
  if (quitadas > 0) cambios.push(`Se quitó la imagen de «Debes ver» de ${una(quitadas)} del ${etiqueta}.`)
}

// Lo que se ve de la imagen de "Debes ver" de una tarea, para compararla:
// '' si no tiene.
function firmaDebesVer(tarea: BloquePaso): string {
  const resultado = resultadoVisualDe(tarea)
  return resultado ? JSON.stringify([resultado.adjunto.referencia, resultado.descripcion ?? '']) : ''
}

function agregarLineasAvisos(cambios: string[], diff: DiffLista, etiqueta: string): void {
  if (diff.editadas === 1) cambios.push(`Se editó un aviso del ${etiqueta}.`)
  else if (diff.editadas > 1) cambios.push(`Se editaron ${diff.editadas} avisos del ${etiqueta}.`)
  if (diff.agregadas === 1) cambios.push(`Se agregó un aviso al ${etiqueta}.`)
  else if (diff.agregadas > 1) cambios.push(`Se agregaron ${diff.agregadas} avisos al ${etiqueta}.`)
  if (diff.eliminadas === 1) cambios.push(`Se eliminó un aviso del ${etiqueta}.`)
  else if (diff.eliminadas > 1) cambios.push(`Se eliminaron ${diff.eliminadas} avisos del ${etiqueta}.`)
}

// Textos de los bloques de un tipo dado (tareas o avisos), para
// compararlos por valor como se hacia con las viejas instrucciones.
function textosDeBloque(paso: PasoProcedimiento, tipo: TipoBloque): string[] {
  return paso.bloques.filter((b) => b.tipo === tipo).map((b) => b.texto)
}

// Todas las imagenes del paso: la galeria (`adjuntos`) mas las
// intercaladas en el cuerpo (bloques 'imagen').
function imagenesDe(paso: PasoProcedimiento): PasoAdjunto[] {
  const inline = paso.bloques
    .filter((b) => b.tipo === 'imagen' && b.adjunto !== null)
    .map((b) => b.adjunto as PasoAdjunto)
  return [...paso.adjuntos, ...inline]
}

function agregarLineasRequisitos(cambios: string[], diff: DiffLista): void {
  const donde = 'del procedimiento'
  if (diff.editadas === 1) cambios.push(`Se actualizó un requisito ${donde}.`)
  else if (diff.editadas > 1) cambios.push(`Se actualizaron ${diff.editadas} requisitos ${donde}.`)
  if (diff.agregadas === 1) cambios.push(`Se agregó un requisito ${donde}.`)
  else if (diff.agregadas > 1) cambios.push(`Se agregaron ${diff.agregadas} requisitos ${donde}.`)
  if (diff.eliminadas === 1) cambios.push(`Se eliminó un requisito ${donde}.`)
  else if (diff.eliminadas > 1) cambios.push(`Se eliminaron ${diff.eliminadas} requisitos ${donde}.`)
}

function agregarLineasVerificacion(cambios: string[], diff: DiffLista): void {
  const donde = 'de la verificación final'
  if (diff.editadas === 1) cambios.push(`Se actualizó un ítem ${donde}.`)
  else if (diff.editadas > 1) cambios.push(`Se actualizaron ${diff.editadas} ítems ${donde}.`)
  if (diff.agregadas === 1) cambios.push(`Se agregó un ítem ${donde}.`)
  else if (diff.agregadas > 1) cambios.push(`Se agregaron ${diff.agregadas} ítems ${donde}.`)
  if (diff.eliminadas === 1) cambios.push(`Se eliminó un ítem ${donde}.`)
  else if (diff.eliminadas > 1) cambios.push(`Se eliminaron ${diff.eliminadas} ítems ${donde}.`)
}

// Diff de los adjuntos de un paso. Se comparan por referencia (cada
// subida genera una referencia unica), asi que un reemplazo se ve como
// una baja y un alta, no como una edicion. Se dice "imagen" cuando
// todos los afectados son imagenes y "archivo" en caso contrario.
function agregarLineasAdjuntos(
  cambios: string[],
  previos: PasoAdjunto[],
  actuales: PasoAdjunto[],
  etiqueta: string,
): void {
  const refsPrevias = new Set(previos.map((a) => a.referencia))
  const refsActuales = new Set(actuales.map((a) => a.referencia))
  const agregados = actuales.filter((a) => !refsPrevias.has(a.referencia))
  const eliminados = previos.filter((a) => !refsActuales.has(a.referencia))

  if (agregados.length === 1) cambios.push(`Se agregó ${sustantivoAdjunto(agregados)} al ${etiqueta}.`)
  else if (agregados.length > 1)
    cambios.push(`Se agregaron ${agregados.length} ${pluralAdjunto(agregados)} al ${etiqueta}.`)

  if (eliminados.length === 1) cambios.push(`Se eliminó ${sustantivoAdjunto(eliminados)} del ${etiqueta}.`)
  else if (eliminados.length > 1)
    cambios.push(`Se eliminaron ${eliminados.length} ${pluralAdjunto(eliminados)} del ${etiqueta}.`)
}

function sonImagenes(adjuntos: PasoAdjunto[]): boolean {
  return adjuntos.every((a) => a.tipo.startsWith('image/'))
}

function sustantivoAdjunto(adjuntos: PasoAdjunto[]): string {
  return sonImagenes(adjuntos) ? 'una imagen' : 'un archivo'
}

function pluralAdjunto(adjuntos: PasoAdjunto[]): string {
  return sonImagenes(adjuntos) ? 'imágenes' : 'archivos'
}

// Hubo reordenamiento si los pasos comunes a ambas versiones aparecen
// en distinto orden relativo (ignorando altas y bajas, que se
// reportan aparte). Se necesitan al menos dos pasos comunes.
function huboReordenamiento(anterior: PasoProcedimiento[], nueva: PasoProcedimiento[]): boolean {
  const idsNuevos = new Set(nueva.map((paso) => paso.id))
  const idsAnteriores = new Set(anterior.map((paso) => paso.id))
  const secuenciaAnterior = anterior.filter((paso) => idsNuevos.has(paso.id)).map((paso) => paso.id)
  const secuenciaNueva = nueva.filter((paso) => idsAnteriores.has(paso.id)).map((paso) => paso.id)
  return secuenciaAnterior.length > 1 && secuenciaAnterior.some((id, i) => id !== secuenciaNueva[i])
}

// "Paso 3: Databases" o "Paso 3" si el paso no tiene titulo.
function etiquetaPaso(indice: number, paso: PasoProcedimiento): string {
  const numero = indice + 1
  return paso.titulo ? `Paso ${numero}: ${paso.titulo}` : `Paso ${numero}`
}

// Como referirse a un paso recien agregado: por su titulo entre
// comillas o, si no tiene, por su posicion.
function nombrePasoNuevo(indice: number, paso: PasoProcedimiento): string {
  return paso.titulo ? `"${paso.titulo}"` : `(Paso ${indice + 1})`
}

function tamano(procedimiento: Procedimiento): TamanoProcedimiento {
  return {
    pasos: procedimiento.pasos.length,
    instrucciones: procedimiento.pasos.reduce((total, paso) => total + tareasDe(paso.bloques).length, 0),
  }
}

// El valor del historial es el JSON del procedimiento (o "" cuando no
// habia). Se normaliza para tolerar datos viejos o incompletos y
// comparar siempre la misma forma que ve el usuario.
function parsear(valor: string): Procedimiento | null {
  if (!valor) return null
  try {
    return normalizarProcedimiento(JSON.parse(valor))
  } catch {
    return null
  }
}
