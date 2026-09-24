import type { BloquePaso, PasoProcedimiento, Referencia } from '../../lib/db'
import { comandosEnTexto } from '../referencia/comandosEnTexto'
import { tonoInfo } from '../soluciones/tonos'
import {
  MAXIMO_BLOQUES,
  MAXIMO_BYTES,
  MAXIMO_TITULO,
  VERSION_CONTENIDO,
  esUrlWeb,
  maximoTexto,
  pareceSecreto,
  validarContenido,
  type BloqueAsistencia,
  type ContenidoAsistencia,
} from './modelo'

// "ENVIAR A ESTE EQUIPO": QUE SALE DE UN PASO (tarea 258, secciones 11
// y 12 del encargo del 2026-09-23).
//
// Solo campos permitidos, y por tipos: esta funcion recibe el paso y las
// fichas del Centro de consulta, NUNCA la Boveda ni un valor descifrado.
// El vinculo protegido del paso o de una tarea (`vinculoProtegido`) no se
// lee aqui en ningun caso: el computador atendido jamas recibe una clave.
//
// Lo que sale, en el orden del paso:
//   - "Donde" (`lugar`) y "Debes ver" (`resultado`);
//   - cada tarea como accion o comprobacion (verificacion y decision);
//   - las URL escritas en el texto, como enlaces aparte con Copiar;
//   - los comandos y atajos que la tarea escribe o enlaza y tienen ficha
//     en el Centro de consulta (el valor de la ficha, que no es secreto:
//     esa tabla no puede contener secretos, RN de referencias);
//   - los avisos (el dato tecnico como dato; el resto como nota con su
//     tono) y los nombres de archivo.
// Imagenes, guias vinculadas y terminos del glosario no salen: el
// computador no puede abrirlos y no ayudan a hacer el paso alli.
//
// Lo que tiene forma de secreto, lo que no cabe y lo que sobra NO se
// envia y queda anotado en `apartados` para que la vista previa lo diga.

export interface OpcionesContenidoPaso {
  paso: PasoProcedimiento
  /** Posición del paso en la guía, empezando en 1. */
  numeroPaso: number
  tituloGuia: string
  /** Fichas vivas del Centro de consulta por id (ver useReferencias). */
  referencias: Map<string, Referencia>
  /**
   * Solo esta acción (id del bloque 'tarea') con lo que cuelga de ella,
   * o todo el paso si no llega.
   */
  tareaId?: string | null
}

export type MotivoApartado = 'secreto' | 'largo' | 'limite'

export interface Apartado {
  /** Qué era, en palabras ("una nota", "un comando"), sin su contenido. */
  que: string
  motivo: MotivoApartado
}

export interface ResultadoContenido {
  /** null si el paso no tiene nada que se pueda enviar. */
  contenido: ContenidoAsistencia | null
  apartados: Apartado[]
}

const NOMBRE_DE_TIPO: Record<BloqueAsistencia['tipo'], string> = {
  donde: 'el lugar',
  accion: 'una acción',
  comprobacion: 'una comprobación',
  nota: 'una nota',
  dato: 'un dato técnico',
  comando: 'un comando',
  atajo: 'un atajo',
  url: 'un enlace',
  archivo: 'un nombre de archivo',
  debes_ver: 'lo que debe verse',
}

// URL escritas dentro de un texto. Se corta la puntuacion final que
// cierra la frase ("…en https://x.test/ayuda.").
const URL_EN_TEXTO = /https?:\/\/[^\s<>"'`)\]]+/gi

export function urlsEnTexto(texto: string): string[] {
  const encontradas = texto.match(URL_EN_TEXTO) ?? []
  return encontradas.map((url) => url.replace(/[.,;:!?]+$/, '')).filter(esUrlWeb)
}

function recortarTitulo(texto: string): string {
  const letras = [...texto.trim()]
  return letras.length <= MAXIMO_TITULO ? letras.join('') : `${letras.slice(0, MAXIMO_TITULO - 1).join('')}…`
}

function perteneceA(bloque: BloquePaso, tareaId: string): boolean {
  if (bloque.tipo === 'tarea') return bloque.id === tareaId
  return bloque.alcance === 'tarea' && bloque.tareaId === tareaId
}

export function construirContenidoDePaso({
  paso,
  numeroPaso,
  tituloGuia,
  referencias,
  tareaId = null,
}: OpcionesContenidoPaso): ResultadoContenido {
  const candidatos: BloqueAsistencia[] = []
  const vistos = new Set<string>()
  const apartados: Apartado[] = []

  function agregar(bloque: BloqueAsistencia) {
    const texto = bloque.texto.trim()
    if (!texto) return
    const clave = `${bloque.tipo}\u0000${texto}`
    if (vistos.has(clave)) return
    vistos.add(clave)
    // Solo las claves con valor: el servidor rechaza cualquier clave que
    // no sea un texto, y una clave `undefined` también cuenta.
    const limpio: BloqueAsistencia = { tipo: bloque.tipo, texto }
    if (bloque.titulo?.trim()) limpio.titulo = bloque.titulo.trim()
    if (bloque.plataforma?.trim()) limpio.plataforma = bloque.plataforma.trim()
    if (bloque.etiqueta?.trim()) limpio.etiqueta = bloque.etiqueta.trim()
    candidatos.push(limpio)
  }

  function agregarDesdeTexto(texto: string) {
    for (const url of urlsEnTexto(texto)) agregar({ tipo: 'url', texto: url })
    for (const ficha of comandosEnTexto(texto, referencias.values())) agregarFicha(ficha)
  }

  function agregarFicha(ficha: Referencia | undefined) {
    if (!ficha || ficha.eliminadoEn || !ficha.valor) return
    if (ficha.tipo !== 'comando' && ficha.tipo !== 'atajo') return
    agregar({
      tipo: ficha.tipo,
      texto: ficha.valor,
      titulo: ficha.titulo || undefined,
      plataforma: ficha.plataforma || undefined,
    })
  }

  if (paso.lugar) agregar({ tipo: 'donde', texto: paso.lugar })

  const bloques = tareaId ? paso.bloques.filter((b) => perteneceA(b, tareaId)) : paso.bloques
  for (const bloque of bloques) {
    switch (bloque.tipo) {
      case 'tarea': {
        const tipo = bloque.tipoTarea === 'verificacion' || bloque.tipoTarea === 'decision' ? 'comprobacion' : 'accion'
        agregar({ tipo, texto: bloque.texto })
        agregarDesdeTexto(bloque.texto)
        break
      }
      case 'aviso': {
        if (bloque.tono === 'dato') agregar({ tipo: 'dato', texto: bloque.texto })
        else agregar({ tipo: 'nota', texto: bloque.texto, etiqueta: tonoInfo(bloque.tono).etiqueta })
        agregarDesdeTexto(bloque.texto)
        break
      }
      case 'referencia':
        agregarFicha(bloque.referenciaId ? referencias.get(bloque.referenciaId) : undefined)
        break
      case 'archivo':
        if (bloque.adjunto?.nombre) agregar({ tipo: 'archivo', texto: bloque.adjunto.nombre })
        break
      // 'imagen' y 'guia' no viajan: el computador no puede abrirlas.
      default:
        break
    }
  }

  if (!tareaId) {
    for (const adjunto of paso.adjuntos) {
      if (adjunto.nombre && !adjunto.tipo.startsWith('image/')) agregar({ tipo: 'archivo', texto: adjunto.nombre })
    }
    if (paso.resultado) agregar({ tipo: 'debes_ver', texto: paso.resultado })
  }

  // Lo que no se envia, con su motivo.
  const aptos: BloqueAsistencia[] = []
  for (const bloque of candidatos) {
    const textos = [bloque.texto, bloque.titulo, bloque.etiqueta, bloque.plataforma].filter(Boolean).join(' ')
    if (pareceSecreto(textos)) {
      apartados.push({ que: NOMBRE_DE_TIPO[bloque.tipo], motivo: 'secreto' })
    } else if ([...bloque.texto].length > maximoTexto(bloque.tipo)) {
      apartados.push({ que: NOMBRE_DE_TIPO[bloque.tipo], motivo: 'largo' })
    } else if (aptos.length >= MAXIMO_BLOQUES) {
      apartados.push({ que: NOMBRE_DE_TIPO[bloque.tipo], motivo: 'limite' })
    } else {
      aptos.push(bloque)
    }
  }

  const tituloPaso = recortarTitulo(`Paso ${numeroPaso} · ${paso.titulo || 'Sin título'}`)
  const contenido: ContenidoAsistencia = {
    v: VERSION_CONTENIDO,
    // Un título con forma de secreto no viaja: queda solo el número.
    titulo: pareceSecreto(tituloPaso) ? `Paso ${numeroPaso}` : tituloPaso,
    bloques: aptos,
  }
  const subtitulo = recortarTitulo(tituloGuia)
  if (subtitulo && !pareceSecreto(subtitulo)) contenido.subtitulo = subtitulo

  // 16 KB en total: se quitan bloques del final hasta que quepa.
  while (contenido.bloques.length > 0 && new TextEncoder().encode(JSON.stringify(contenido)).length > MAXIMO_BYTES) {
    const quitado = contenido.bloques.pop() as BloqueAsistencia
    apartados.push({ que: NOMBRE_DE_TIPO[quitado.tipo], motivo: 'limite' })
  }

  if (contenido.bloques.length === 0 || validarContenido(contenido) !== null) {
    return { contenido: null, apartados }
  }
  return { contenido, apartados }
}
