import type { ComponentType } from 'react'
import type { TipoArticulo } from '../../lib/db'
import {
  BookOpen,
  Code,
  DownloadSimple,
  type IconoProps,
  Monitor,
  PlugsConnected,
  Printer,
  Sliders,
  Storefront,
  TreeStructure,
  VideoCamera,
  WarningCircle,
  Wrench,
} from '../../components/iconos'

// Minusculas sin acentos para comparar nombres de categoria escritos
// por el equipo ("Cámaras", "Cómputo") con las palabras clave del mapa.
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

// Icono por tipo de articulo (los 6 fijos de TipoArticulo). Traslada a
// Nocturne los iconos que el handoff de Soluciones daba por tipo: el
// tipo se reconoce de un vistazo en la lista unificada.
const ICONO_POR_TIPO: Record<TipoArticulo, ComponentType<IconoProps>> = {
  instalacion: DownloadSimple,
  configuracion: Sliders,
  conexion: PlugsConnected,
  problema_frecuente: WarningCircle,
  mantenimiento: Wrench,
  manual: BookOpen,
}

export function iconoDeTipo(tipo: TipoArticulo): ComponentType<IconoProps> {
  return ICONO_POR_TIPO[tipo] ?? BookOpen
}

// Tono (color) del icono de cada tipo en la lista unificada, trasladado
// del handoff: los procedimientos operativos (instalar, configurar,
// conectar) toman el acento; una incidencia se pinta ambar (precaucion),
// un mantenimiento verde (exito) y un manual queda neutro. Devuelve las
// clases de texto y fondo tenue (12 %) del recuadro del icono.
const TONO_POR_TIPO: Record<TipoArticulo, string> = {
  instalacion: 'text-noct-accent bg-noct-accent/[.12]',
  configuracion: 'text-noct-accent bg-noct-accent/[.12]',
  conexion: 'text-noct-accent bg-noct-accent/[.12]',
  problema_frecuente: 'text-noct-precaucion bg-noct-precaucion/[.12]',
  mantenimiento: 'text-noct-exito bg-noct-exito/[.12]',
  manual: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]',
}

export function claseTonoDeTipo(tipo: TipoArticulo): string {
  return TONO_POR_TIPO[tipo] ?? TONO_POR_TIPO.manual
}

// Icono por categoria. Las categorias son dinamicas (las crea el
// equipo) y su columna `icono` llega vacia del seed, asi que se resuelve
// por palabras clave del nombre, con BookOpen como respaldo neutro. El
// orden importa: "Punto de venta" cae en tienda antes que en red por la
// palabra "venta".
export function iconoDeCategoria(nombre: string): ComponentType<IconoProps> {
  const n = normalizarTexto(nombre)
  if (n.includes('impres')) return Printer
  if (n.includes('pos') || n.includes('venta') || n.includes('caja')) return Storefront
  if (n.includes('camara') || n.includes('cctv') || n.includes('video')) return VideoCamera
  if (
    n.includes('red') ||
    n.includes('switch') ||
    n.includes('access') ||
    n.includes('rack') ||
    n.includes('punto')
  )
    return TreeStructure
  if (n.includes('comput') || n.includes('servidor') || n.includes('equipo')) return Monitor
  if (n.includes('software') || n.includes('licencia')) return Code
  return BookOpen
}
