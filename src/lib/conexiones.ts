import type { Conexion, Dispositivo, TipoConexion } from './db'

// Logica pura de las conexiones entre dispositivos, separada de React
// y de la base local para poder probarla sola.

export const MEDIOS_SUGERIDOS = ['UTP', 'Fibra óptica', 'Inalámbrico']

// Tipo de relacion del formulario "Agregar conexion", visto desde la
// ficha donde se crea: define quien es origen y quien destino segun lo
// que el tecnico quiere documentar. Compartido entre ConexionesFicha
// (ficha de dispositivo) y TopologiaEquipoPage.
//
// 'enlace' y 'recibeDe' son el mismo TipoConexion ('enlace') en sentido
// opuesto (hallazgo N1 de AUDITORIA_FLUJOS_TI.md): antes solo existia
// 'enlace' con esta ficha siempre como origen/padre, asi que documentar
// "el switch me da servicio" desde la ficha del punto de red invertia
// la topologia (el punto quedaba como padre del switch). 'recibeDe'
// deja el sentido explicito: el OTRO equipo es el origen/padre.
export type ModoConexion = 'enlace' | 'recibeDe' | 'instalado' | 'contiene' | 'relacionado'

export interface DatosSegunModo {
  tipo: TipoConexion
  // true si la ficha donde se crea la conexion es el origen (padre en
  // la topologia, ver arbol.ts); false si lo es el otro equipo.
  origenEsteDispositivo: boolean
  // Solo 'enlace'/'recibeDe' llevan puerto y medio; 'instalado',
  // 'contiene' y 'relacionado' no.
  conPuertos: boolean
}

export function datosSegunModo(modo: ModoConexion): DatosSegunModo {
  const tipo: TipoConexion =
    modo === 'enlace' || modo === 'recibeDe'
      ? 'enlace'
      : modo === 'relacionado'
        ? 'relacionado'
        : 'instalacion'
  return {
    tipo,
    // 'contiene' (esta ficha es el rack: el otro se instala en ella) y
    // 'recibeDe' (el otro da el servicio) invierten el sentido.
    origenEsteDispositivo: modo !== 'contiene' && modo !== 'recibeDe',
    conPuertos: modo === 'enlace' || modo === 'recibeDe',
  }
}

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
  // Relacion entre dos equipos que no son de red (grupo N3): sin puertos
  // ni medio, solo el vinculo entre ambos.
  if (conexion.tipo === 'relacionado') {
    return `${conexion.origenNombre} relacionado con ${conexion.destinoNombre}`
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
  // Equipos relacionados que no son de red (grupo N3): un POS con su
  // impresora, sin puertos ni medio. No entran en la topologia.
  relacionados: ExtremoConexion[]
}

export function agruparConexiones(
  conexiones: Conexion[],
  dispositivoId: string,
): ConexionesAgrupadas {
  const grupos: ConexionesAgrupadas = { instaladoEn: [], contiene: [], enlaces: [], relacionados: [] }
  for (const conexion of conexiones) {
    if (conexion.eliminadoEn) continue
    if (conexion.origenId !== dispositivoId && conexion.destinoId !== dispositivoId) continue
    const extremo = desdeExtremo(conexion, dispositivoId)
    if (conexion.tipo === 'instalacion') {
      if (extremo.esOrigen) grupos.instaladoEn.push(extremo)
      else grupos.contiene.push(extremo)
    } else if (conexion.tipo === 'relacionado') {
      grupos.relacionados.push(extremo)
    } else {
      grupos.enlaces.push(extremo)
    }
  }
  grupos.contiene.sort((a, b) => compararNatural(a.otroNombre, b.otroNombre))
  grupos.relacionados.sort((a, b) => compararNatural(a.otroNombre, b.otroNombre))
  grupos.enlaces.sort(
    (a, b) =>
      compararNatural(a.puertoLocal, b.puertoLocal) || compararNatural(a.otroNombre, b.otroNombre),
  )
  return grupos
}

// Hallazgo N5 de AUDITORIA_FLUJOS_TI.md: la busqueda del otro extremo al
// crear una conexion exigia teclear y filtraba solo por nombre/ubicacion
// (texto)/ip, sin priorizar los candidatos mas probables: equipos de la
// MISMA ubicacion (rack/switch al lado) o categorias `es_red` (lo
// esperable para un uplink). Compartida entre ConexionesFicha.tsx y
// TopologiaEquipoPage.tsx (que hoy duplican este calculo, hallazgo D1).
//
// Con texto: filtra igual que antes (nombre/ubicacion/ip) y solo
// reordena los resultados, sin cambiar que aparece. Sin texto: en vez de
// no mostrar nada, pre-sugiere los candidatos con alguna pista real
// (misma ubicacion o categoria de red); si ninguno la tiene, sigue sin
// mostrar nada (listar "todos" sin ningun criterio no seria sugerencia).
export function candidatosConexion(
  candidatos: Dispositivo[],
  texto: string,
  equipoActual: Dispositivo,
  idsRed: Set<string>,
  limite = 8,
): Dispositivo[] {
  const buscado = texto.trim().toLowerCase()
  const base = buscado
    ? candidatos.filter((d) => [d.nombre, d.ubicacion, d.ip].join(' ').toLowerCase().includes(buscado))
    : candidatos.filter((d) => puntajeCandidato(d, equipoActual, idsRed) > 0)

  return [...base]
    .sort((a, b) => puntajeCandidato(b, equipoActual, idsRed) - puntajeCandidato(a, equipoActual, idsRed))
    .slice(0, limite)
}

function puntajeCandidato(d: Dispositivo, equipoActual: Dispositivo, idsRed: Set<string>): number {
  let puntaje = 0
  if (equipoActual.ubicacionId && d.ubicacionId === equipoActual.ubicacionId) puntaje += 2
  if (idsRed.has(d.categoriaId)) puntaje += 1
  return puntaje
}
