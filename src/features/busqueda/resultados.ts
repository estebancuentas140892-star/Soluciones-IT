import {
  BookOpen,
  type IconoProps,
  LockSimple,
  MapPin,
  Monitor,
  TreeStructure,
  User,
  Vault,
} from '../../components/iconos'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// Catalogo y helpers del buscador global, sin JSX: la presentacion vive
// en ResultadosBusqueda.tsx. Todo esto estaba dentro de InicioPage,
// que era el unico sitio desde donde se podia buscar; la tarea 181 saco
// el buscador al chasis (regla R14) y lo comparten ahora Inicio y la
// capa global.

// Icono y tono del recuadro por tipo de resultado, con el lenguaje de
// color del sistema: articulos/diagnosticos/categorias en el acento, un
// dispositivo en verde (exito), una credencial y los adjuntos en neutro.
// Las clases van completas y literales porque Tailwind no detecta nombres
// construidos dinamicamente.
export interface Visual {
  Icono: (props: IconoProps) => React.JSX.Element
  tono: string
}

export const VISUAL_POR_TIPO: Record<TipoResultado, Visual> = {
  articulo: { Icono: BookOpen, tono: 'text-noct-accent bg-noct-accent/[.12]' },
  categoria: { Icono: BookOpen, tono: 'text-noct-accent bg-noct-accent/[.12]' },
  diagnostico: { Icono: TreeStructure, tono: 'text-noct-accent bg-noct-accent/[.12]' },
  adjunto: { Icono: BookOpen, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
  dispositivo: { Icono: Monitor, tono: 'text-noct-exito bg-noct-exito/[.12]' },
  credencial: { Icono: LockSimple, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
  ubicacion: { Icono: MapPin, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
  persona: { Icono: User, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
}

// Los resultados se agrupan por fuente (los modulos con contenido
// buscable), no por los tipos internos: el tecnico piensa en "donde
// esta", no en el tipo de dato. Cada tipo cae en su grupo.
export const GRUPOS_BUSQUEDA: {
  id: string
  nombre: string
  Icono: (props: IconoProps) => React.JSX.Element
  tipos: TipoResultado[]
}[] = [
  { id: 'soluciones', nombre: 'Guías', Icono: BookOpen, tipos: ['diagnostico', 'categoria', 'articulo', 'adjunto'] },
  { id: 'dispositivos', nombre: 'Equipos', Icono: Monitor, tipos: ['dispositivo'] },
  { id: 'boveda', nombre: 'Bóveda', Icono: Vault, tipos: ['credencial'] },
  // Ubicaciones en el buscador (fase P3, punto 4 del encargo): hoy
  // faltaban pese a ser entidad propia desde N3.
  { id: 'ubicaciones', nombre: 'Ubicaciones', Icono: MapPin, tipos: ['ubicacion'] },
  // Personas en el buscador (hallazgo T1): mismo criterio que ubicaciones.
  { id: 'personas', nombre: 'Personas', Icono: User, tipos: ['persona'] },
]

/**
 * Parte un titulo en tres tramos segun donde cae el termino buscado
 * (comparando normalizado, devolviendo el original). El resaltado usa
 * `match`; si no hay coincidencia literal (busqueda difusa o por sinonimo)
 * todo el titulo queda en `pre`, sin resaltar.
 */
export function partirTitulo(titulo: string, consulta: string) {
  if (!consulta) return { pre: titulo, match: '', post: '' }
  const i = normalizarTexto(titulo).indexOf(consulta)
  if (i < 0) return { pre: titulo, match: '', post: '' }
  return {
    pre: titulo.slice(0, i),
    match: titulo.slice(i, i + consulta.length),
    post: titulo.slice(i + consulta.length),
  }
}

export type GrupoResultados = (typeof GRUPOS_BUSQUEDA)[number] & { items: ResultadoBusqueda[] }

/**
 * Grupos con al menos un resultado, en el orden fijo de GRUPOS_BUSQUEDA.
 * Se calcula aparte de la presentacion para que quien busque pueda saber
 * si hubo coincidencias ANTES de pintar y decidir su propio estado vacio
 * (Inicio ofrece crear un equipo con el texto buscado; la capa, otra cosa).
 */
export function agruparResultados(resultados: ResultadoBusqueda[]): GrupoResultados[] {
  return GRUPOS_BUSQUEDA.map((grupo) => {
    const items = resultados.filter((r) => grupo.tipos.includes(r.tipo))
    return items.length ? { ...grupo, items } : null
  }).filter((g): g is GrupoResultados => g !== null)
}
