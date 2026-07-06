import type { Conexion } from './db'

// Logica pura de las conexiones entre dispositivos, separada de React
// y de la base local para poder probarla sola.

export const MEDIOS_SUGERIDOS = ['UTP', 'Fibra óptica', 'Inalámbrico']

// Orden natural para nombres de puerto: "Puerto 2" antes que
// "Puerto 10" (la comparacion alfabetica pondria el 10 primero).
export function compararNatural(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

function conPuerto(nombre: string, puerto: string): string {
  return puerto ? `${nombre} (puerto ${puerto})` : nombre
}

// Texto corto que identifica la conexion en el historial y en las
// confirmaciones: "Switch D32 (puerto 18) → Punto de red D80".
export function resumenConexion(conexion: Conexion): string {
  if (conexion.tipo === 'instalacion') {
    return `${conexion.origenNombre} instalado en ${conexion.destinoNombre}`
  }
  return `${conPuerto(conexion.origenNombre, conexion.origenPuerto)} → ${conPuerto(
    conexion.destinoNombre,
    conexion.destinoPuerto,
  )}`
}

// Una conexion vista desde uno de sus dos extremos, para pintarla en
// la ficha de ese dispositivo sin repetir la logica de direccion.
export interface ExtremoConexion {
  conexion: Conexion
  // true si el dispositivo consultado es el origen de la conexion.
  esOrigen: boolean
  otroId: string
  otroNombre: string
  puertoLocal: string
  puertoRemoto: string
}

export function desdeExtremo(conexion: Conexion, dispositivoId: string): ExtremoConexion {
  const esOrigen = conexion.origenId === dispositivoId
  return {
    conexion,
    esOrigen,
    otroId: esOrigen ? conexion.destinoId : conexion.origenId,
    otroNombre: esOrigen ? conexion.destinoNombre : conexion.origenNombre,
    puertoLocal: esOrigen ? conexion.origenPuerto : conexion.destinoPuerto,
    puertoRemoto: esOrigen ? conexion.destinoPuerto : conexion.origenPuerto,
  }
}

// Las conexiones de una ficha, agrupadas como las muestra la interfaz.
export interface ConexionesAgrupadas {
  // Donde esta instalado este equipo (normalmente un rack, 0 o 1).
  instaladoEn: ExtremoConexion[]
  // Equipos instalados dentro de este (si es un rack).
  contiene: ExtremoConexion[]
  // Enlaces de red, ordenados por el puerto de este dispositivo.
  enlaces: ExtremoConexion[]
}

export function agruparConexiones(
  conexiones: Conexion[],
  dispositivoId: string,
): ConexionesAgrupadas {
  const grupos: ConexionesAgrupadas = { instaladoEn: [], contiene: [], enlaces: [] }
  for (const conexion of conexiones) {
    if (conexion.eliminadoEn) continue
    if (conexion.origenId !== dispositivoId && conexion.destinoId !== dispositivoId) continue
    const extremo = desdeExtremo(conexion, dispositivoId)
    if (conexion.tipo === 'instalacion') {
      if (extremo.esOrigen) grupos.instaladoEn.push(extremo)
      else grupos.contiene.push(extremo)
    } else {
      grupos.enlaces.push(extremo)
    }
  }
  grupos.contiene.sort((a, b) => compararNatural(a.otroNombre, b.otroNombre))
  grupos.enlaces.sort(
    (a, b) =>
      compararNatural(a.puertoLocal, b.puertoLocal) || compararNatural(a.otroNombre, b.otroNombre),
  )
  return grupos
}
