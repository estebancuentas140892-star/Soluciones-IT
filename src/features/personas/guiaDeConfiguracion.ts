import type { Articulo } from '../../lib/db'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// LA GUÍA MAESTRA DE "USUARIO NUEVO", DESDE LA FICHA DE LA PERSONA
// (tarea 266, sección 7 del encargo del 2026-09-23).
//
// "Configurar el computador para esta persona" abre la guía que el
// equipo ya escribió; no copia sus pasos en Personas. La guía vive en
// Supabase como cualquier otra, así que se encuentra por lo que dice de
// sí misma, en este orden:
//
//   1. una etiqueta explícita ("usuario nuevo", "ingreso"...): es la
//      forma de fijarla sin tocar código si el título cambia;
//   2. su título, cuando habla de un usuario (o empleado) nuevo o de un
//      ingreso.
//
// Solo guías vivas con pasos (se van a ejecutar). Si no aparece ninguna,
// la ficha ofrece buscarla en Resolver: mejor eso que abrir una guía
// equivocada.

const ETIQUETAS = new Set([
  'usuario nuevo',
  'nuevo usuario',
  'usuario-nuevo',
  'ingreso',
  'ingreso de personal',
  'empleado nuevo',
  'configuracion de usuario',
])

export const BUSQUEDA_GUIA_CONFIGURACION = 'usuario nuevo'

function hablaDeUnIngreso(texto: string): boolean {
  const persona = /\b(usuario|usuaria|empleado|empleada|funcionario|funcionaria|colaborador|colaboradora)s?\b/.test(texto)
  const nuevo = /\b(nuevo|nueva|nuevos|nuevas|ingreso)\b/.test(texto)
  return persona && nuevo
}

// Entre dos títulos que hablan de un usuario nuevo, el que habla de
// PREPARAR SU EQUIPO es la guía maestra; "Crear usuario nuevo en el
// dominio" es un paso de ella, no la guía.
function afinidad(texto: string): number {
  let puntos = 0
  if (/\b(configur\w*|alist\w*|prepar\w*|instal\w*|entreg\w*)\b/.test(texto)) puntos += 2
  if (/\b(equipo|equipos|computador|computadores|pc|portatil|portatiles)\b/.test(texto)) puntos += 1
  return puntos
}

type ArticuloCandidato = Pick<Articulo, 'id' | 'titulo' | 'etiquetas' | 'estado' | 'procedimiento' | 'eliminadoEn'>

/**
 * La guía de configuración de un usuario nuevo, o null. Entre varias
 * candidatas gana la etiquetada, luego la que habla de preparar el
 * equipo, luego la publicada, luego la de título más corto (la general
 * antes que una variante: "Configurar equipo para usuario nuevo" antes
 * que "... en Taquillas").
 */
export function guiaDeConfiguracion<T extends ArticuloCandidato>(articulos: T[]): T | null {
  const candidatas = articulos
    .filter((a) => !a.eliminadoEn && a.estado !== 'obsoleto' && (a.procedimiento?.pasos.length ?? 0) > 0)
    .map((a) => {
      const titulo = normalizarTexto(a.titulo)
      const etiquetada = (a.etiquetas ?? []).some((e) => ETIQUETAS.has(normalizarTexto(e).trim()))
      return { articulo: a, etiquetada, porTitulo: hablaDeUnIngreso(titulo), afinidad: afinidad(titulo) }
    })
    .filter((c) => c.etiquetada || c.porTitulo)

  candidatas.sort((a, b) => {
    if (a.etiquetada !== b.etiquetada) return a.etiquetada ? -1 : 1
    if (a.afinidad !== b.afinidad) return b.afinidad - a.afinidad
    const aPublicada = a.articulo.estado === 'publicado'
    const bPublicada = b.articulo.estado === 'publicado'
    if (aPublicada !== bPublicada) return aPublicada ? -1 : 1
    return a.articulo.titulo.length - b.articulo.titulo.length || a.articulo.titulo.localeCompare(b.articulo.titulo, 'es')
  })
  return candidatas[0]?.articulo ?? null
}
