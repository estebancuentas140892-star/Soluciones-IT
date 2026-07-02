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
