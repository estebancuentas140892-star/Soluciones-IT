// Helpers puros de la vista de topología rediseñada (handoff de
// Claude Design, Topologia.dc.html): a partir de los datos reales
// deciden qué icono, qué punto de color y qué línea de detalle lleva
// cada nodo del árbol. Sin React, para poder probarlos solos.

// Tipo visual del nodo: elige el icono de la fila. Se deriva del
// nombre de la categoría del dispositivo (texto libre), con el mismo
// criterio tolerante de medios.ts: lo que no coincide con ningún
// patrón conocido cae al icono genérico, sin romper nada.
export type TipoNodoVisual =
  | 'router'
  | 'switch'
  | 'ap'
  | 'punto'
  | 'pc'
  | 'impresora'
  | 'pos'
  | 'rack'
  | 'camara'
  | 'servidor'
  | 'ups'
  | 'generico'

// Minúsculas y sin acentos (se quitan las marcas diacríticas
// combinantes tras NFD), para que "Cámaras" cuente igual que
// "camaras" y "CÁMARAS".
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function tipoDeNodoVisual(nombreCategoria: string): TipoNodoVisual {
  const texto = normalizar(nombreCategoria)
  if (texto.includes('rack')) return 'rack'
  if (texto.includes('ups') || texto.includes('regulador')) return 'ups'
  if (texto.includes('switch')) return 'switch'
  if (texto.includes('camara') || texto.includes('cctv')) return 'camara'
  if (texto.includes('impresora')) return 'impresora'
  if (texto.includes('servidor')) return 'servidor'
  if (texto.includes('access point') || /\bap\b/.test(texto) || texto.includes('inalambric') || texto.includes('wifi')) {
    return 'ap'
  }
  // "POS" y "venta" van ANTES que "punto": "Punto(s) de venta" debe
  // caer al icono de POS y "Puntos de red" al de punto de red.
  if (/\bpos\b/.test(texto) || texto.includes('venta') || texto.includes('caja')) return 'pos'
  if (texto.includes('punto')) return 'punto'
  if (texto.includes('computador') || /\bpc\b/.test(texto) || texto.includes('portatil') || texto.includes('laptop')) {
    return 'pc'
  }
  if (texto.includes('router') || texto.includes('modem') || texto.includes('fibra') || /\bred(es)?\b/.test(texto)) {
    return 'router'
  }
  return 'generico'
}

// Lista canónica de estados conocidos de un dispositivo (el campo
// sigue siendo texto libre: un valor que no coincida cae a "Sin
// estado" / gris neutro, sin romper nada). Única fuente para toda la
// app: agregar, renombrar o recolorear un estado solo requiere tocar
// esta lista. features/dispositivos/estados.ts reexporta
// ESTADOS_SUGERIDOS desde aquí para el datalist del formulario.
const ESTADOS_CONOCIDOS: { etiqueta: string; clase: string }[] = [
  { etiqueta: 'Operativo', clase: 'text-noct-exito' },
  { etiqueta: 'En mantenimiento', clase: 'text-noct-precaucion' },
  { etiqueta: 'Fuera de servicio', clase: 'text-noct-error' },
  { etiqueta: 'De baja', clase: 'text-noct-neutral-500' },
]

export const ESTADOS_SUGERIDOS = ESTADOS_CONOCIDOS.map((e) => e.etiqueta)

// Etiqueta canónica del estado del dispositivo (una de ESTADOS_CONOCIDOS
// arriba; cualquier otro texto se conserva tal cual, o "Sin estado" si
// viene vacío). Comparación insensible a mayúsculas y acentos. Las
// clases de tema claro que este módulo devolvía antes se retiraron con
// la última pantalla clara (tarea 92).
export interface EstadoConEtiqueta {
  etiqueta: string
}

export function estadoConEtiqueta(estado: string): EstadoConEtiqueta {
  const texto = normalizar(estado)
  const conocido = ESTADOS_CONOCIDOS.find((e) => normalizar(e.etiqueta) === texto)
  return { etiqueta: conocido ? conocido.etiqueta : estado.trim() || 'Sin estado' }
}

// Color Nocturne para la etiqueta canónica de arriba. Compartido por
// Dispositivos, Red, Topología y Topología de Equipo (antes cada
// pantalla lo definía por su cuenta, calcado; unificado aquí).
export function claseEstado(etiqueta: string): string {
  const texto = normalizar(etiqueta)
  const conocido = ESTADOS_CONOCIDOS.find((e) => normalizar(e.etiqueta) === texto)
  return conocido ? conocido.clase : 'text-noct-neutral-500'
}

// Línea de detalle de la fila, estilo "Switch 8 puertos · Puerto 02 ·
// UTP" del diseño: categoría, marca y modelo, cómo se llega desde el
// padre (via) y el medio físico. El medio se omite si ya es lo que
// dice la via (un enlace sin puerto usa el medio como via).
export function detalleDeNodo(partes: {
  categoria?: string
  marcaModelo?: string
  via?: string
  medio?: string
}): string {
  const { categoria = '', marcaModelo = '', via = '', medio = '' } = partes
  const lista = [categoria, marcaModelo, via]
  if (medio && normalizar(medio) !== normalizar(via)) lista.push(medio)
  return lista.filter(Boolean).join(' · ')
}
