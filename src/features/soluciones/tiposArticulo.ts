import type { TipoArticulo } from '../../lib/db'

export const TIPOS_ARTICULO: { valor: TipoArticulo; etiqueta: string }[] = [
  { valor: 'instalacion', etiqueta: 'Instalación' },
  { valor: 'configuracion', etiqueta: 'Configuración' },
  { valor: 'conexion', etiqueta: 'Conexión' },
  { valor: 'problema_frecuente', etiqueta: 'Problemas frecuentes' },
  { valor: 'mantenimiento', etiqueta: 'Mantenimiento' },
  { valor: 'manual', etiqueta: 'Manuales' },
]

export function etiquetaDeTipo(tipo: TipoArticulo): string {
  return TIPOS_ARTICULO.find((t) => t.valor === tipo)?.etiqueta ?? tipo
}

// Sustantivo singular de cada tipo con su genero, para los titulos
// dinamicos del formulario: el usuario debe saber de inmediato QUE
// esta creando ("Nueva instalación", no un generico "Nuevo artículo").
const SINGULAR_POR_TIPO: Record<TipoArticulo, { nombre: string; genero: 'm' | 'f' }> = {
  instalacion: { nombre: 'instalación', genero: 'f' },
  configuracion: { nombre: 'configuración', genero: 'f' },
  conexion: { nombre: 'conexión', genero: 'f' },
  problema_frecuente: { nombre: 'problema frecuente', genero: 'm' },
  mantenimiento: { nombre: 'mantenimiento', genero: 'm' },
  manual: { nombre: 'manual', genero: 'm' },
}

export function tituloNuevo(tipo: TipoArticulo): string {
  const singular = SINGULAR_POR_TIPO[tipo]
  if (!singular) return 'Nuevo artículo'
  return `${singular.genero === 'f' ? 'Nueva' : 'Nuevo'} ${singular.nombre}`
}

export function tituloEditar(tipo: TipoArticulo): string {
  const singular = SINGULAR_POR_TIPO[tipo]
  return `Editar ${singular?.nombre ?? 'artículo'}`
}
