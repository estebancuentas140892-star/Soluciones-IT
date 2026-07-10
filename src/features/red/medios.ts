import type { TipoConexion } from '../../lib/db'

// Icono del medio de una conexion, para distinguir visualmente el
// tipo de enlace de un vistazo en el arbol de topologia (fase R1,
// punto 6 de PROPUESTA_MODULOS.md). El medio sigue siendo texto libre
// (datalist, no un enum cerrado): un texto que no coincide con ningun
// patron conocido cae al icono generico de enlace, sin romper nada.
export function iconoDeVia(tipoConexion: TipoConexion, medio: string): string {
  if (tipoConexion === 'instalacion') return '🗄'
  const texto = medio.toLowerCase()
  if (texto.includes('fibra')) return '🟣'
  if (texto.includes('inalámbric') || texto.includes('inalambric') || texto.includes('wifi') || texto.includes('wi-fi')) {
    return '📶'
  }
  if (texto.includes('utp') || texto.includes('cable') || texto.includes('ethernet')) return '🔌'
  return '🔗'
}
