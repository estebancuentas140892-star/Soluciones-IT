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

// Punto de color del estado en el tema claro del rediseño (08_ESTILO:
// operativo verde, mantenimiento ámbar, fuera de servicio rojo, de
// baja gris; cualquier otro texto, gris claro neutro). Mismo criterio
// insensible a mayúsculas que infoDeEstado en dispositivos/estados.ts.
export interface PuntoEstado {
  clase: string
  titulo: string
}

export function puntoDeEstado(estado: string): PuntoEstado {
  const texto = normalizar(estado)
  if (texto === 'operativo') return { clase: 'bg-green-600', titulo: 'Operativo' }
  if (texto === 'en mantenimiento') return { clase: 'bg-amber-600', titulo: 'En mantenimiento' }
  if (texto === 'fuera de servicio') return { clase: 'bg-red-600', titulo: 'Fuera de servicio' }
  if (texto === 'de baja') return { clase: 'bg-zinc-500', titulo: 'De baja' }
  return { clase: 'bg-zinc-300', titulo: estado.trim() || 'Sin estado' }
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
