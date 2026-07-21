import type { ComponentType } from 'react'
import type { TipoArticulo } from '../../lib/db'
import { iconoPorPalabraClave } from '../../lib/iconoPorPalabraClave'
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

// Color de identidad de cada tipo: los tres tipos operativos (instalar,
// configurar, conectar) llevan cada uno su propio color (rosa, cian,
// azul; tokens noct-tipo-* en index.css) para distinguirse entre si;
// antes compartian el acento y todo se veia morado. Una incidencia se
// pinta ambar (precaucion), un mantenimiento verde (exito) y un manual
// neutro, colores que ya los diferenciaban. Devuelve las clases de texto
// y fondo tenue (12 %) del recuadro del icono. Debe seguir en sincronia
// con COLOR_ICONO_POR_TIPO (mismo matiz por tipo, distinta forma de uso).
const TONO_POR_TIPO: Record<TipoArticulo, string> = {
  instalacion: 'text-noct-tipo-instalacion bg-noct-tipo-instalacion/[.12]',
  configuracion: 'text-noct-tipo-configuracion bg-noct-tipo-configuracion/[.12]',
  conexion: 'text-noct-tipo-conexion bg-noct-tipo-conexion/[.12]',
  problema_frecuente: 'text-noct-precaucion bg-noct-precaucion/[.12]',
  mantenimiento: 'text-noct-exito bg-noct-exito/[.12]',
  manual: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]',
}

export function claseTonoDeTipo(tipo: TipoArticulo): string {
  return TONO_POR_TIPO[tipo] ?? TONO_POR_TIPO.manual
}

// Solo el color del icono (sin el fondo tenue), para donde el tipo se
// muestra como icono suelto: la rejilla de tipos del editor. Mismos
// matices que TONO_POR_TIPO. Las clases van completas y literales porque
// Tailwind no detecta nombres de clase construidos dinamicamente.
const COLOR_ICONO_POR_TIPO: Record<TipoArticulo, string> = {
  instalacion: 'text-noct-tipo-instalacion',
  configuracion: 'text-noct-tipo-configuracion',
  conexion: 'text-noct-tipo-conexion',
  problema_frecuente: 'text-noct-precaucion',
  mantenimiento: 'text-noct-exito',
  manual: 'text-noct-neutral-400',
}

export function colorIconoDeTipo(tipo: TipoArticulo): string {
  return COLOR_ICONO_POR_TIPO[tipo] ?? COLOR_ICONO_POR_TIPO.manual
}

// Icono por categoria. Las categorias son dinamicas (las crea el
// equipo) y su columna `icono` llega vacia del seed, asi que se resuelve
// por palabras clave del nombre, con BookOpen como respaldo neutro. El
// orden importa: "Punto de venta" cae en tienda antes que en red por la
// palabra "venta".
const REGLAS_ICONO_CATEGORIA: [RegExp, ComponentType<IconoProps>][] = [
  [/impres/, Printer],
  [/pos|venta|caja/, Storefront],
  [/camara|cctv|video/, VideoCamera],
  [/red|switch|access|rack|punto/, TreeStructure],
  [/comput|servidor|equipo/, Monitor],
  [/software|licencia/, Code],
]

export function iconoDeCategoria(nombre: string): ComponentType<IconoProps> {
  return iconoPorPalabraClave(normalizarTexto(nombre), REGLAS_ICONO_CATEGORIA, BookOpen)
}
