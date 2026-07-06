import type { Conexion, Dispositivo } from '../../lib/db'
import { compararNatural } from '../../lib/conexiones'

// Construccion del arbol de topologia a partir de las conexiones.
// Pura y sin React para poder probarla sola.
//
// Relacion padre -> hijo:
// - instalacion: el destino (rack) es el padre del origen (equipo
//   instalado en el).
// - enlace: el origen (switch, router) es el padre del destino (el
//   equipo que recibe el servicio).
// Asi el arbol responde "¿que depende de este equipo?": al expandir un
// switch se ven los dispositivos que dejarian de funcionar si se apaga.

export interface NodoTopologia {
  dispositivoId: string
  nombre: string
  // Como se llega a este nodo desde su padre: "Puerto 3", el medio del
  // enlace, o "Instalado" para una instalacion. Vacio en la raiz.
  via: string
  hijos: NodoTopologia[]
  // true si la rama se corto porque el dispositivo ya estaba en el
  // camino (ciclo): se muestra como hoja para no repetir el subarbol.
  truncado: boolean
}

interface Hijo {
  dispositivoId: string
  nombreReferencia: string
  via: string
  orden: string
}

function hijosDirectos(nodoId: string, conexiones: Conexion[]): Hijo[] {
  const hijos: Hijo[] = []
  for (const conexion of conexiones) {
    if (conexion.eliminadoEn) continue
    if (conexion.tipo === 'instalacion' && conexion.destinoId === nodoId) {
      hijos.push({
        dispositivoId: conexion.origenId,
        nombreReferencia: conexion.origenNombre,
        via: 'Instalado',
        orden: conexion.origenNombre,
      })
    } else if (conexion.tipo === 'enlace' && conexion.origenId === nodoId) {
      const via = conexion.origenPuerto
        ? `Puerto ${conexion.origenPuerto}`
        : conexion.medio || 'Enlace'
      hijos.push({
        dispositivoId: conexion.destinoId,
        nombreReferencia: conexion.destinoNombre,
        via,
        orden: conexion.origenPuerto || conexion.destinoNombre,
      })
    }
  }
  return hijos
}

function construirNodo(
  dispositivoId: string,
  nombreReferencia: string,
  via: string,
  conexiones: Conexion[],
  nombres: Map<string, string>,
  enCamino: Set<string>,
): NodoTopologia {
  const nombre = nombres.get(dispositivoId) || nombreReferencia || '(dispositivo sin nombre)'
  if (enCamino.has(dispositivoId)) {
    return { dispositivoId, nombre, via, hijos: [], truncado: true }
  }
  // Copia del camino por rama: dos hermanos pueden llevar al mismo
  // subarbol sin bloquearse entre si; solo se corta un ciclo real.
  const siguiente = new Set(enCamino).add(dispositivoId)
  const hijos = hijosDirectos(dispositivoId, conexiones)
    .sort((a, b) => compararNatural(a.orden, b.orden) || compararNatural(a.nombreReferencia, b.nombreReferencia))
    .map((h) => construirNodo(h.dispositivoId, h.nombreReferencia, h.via, conexiones, nombres, siguiente))
  return { dispositivoId, nombre, via, hijos, truncado: false }
}

export function construirArbol(
  raizId: string,
  conexiones: Conexion[],
  nombres: Map<string, string>,
): NodoTopologia {
  return construirNodo(raizId, nombres.get(raizId) ?? '', '', conexiones, nombres, new Set())
}

// Ids de dispositivos que no dependen de ningun otro (no estan
// instalados en nada ni reciben un enlace): son las raices del bosque
// de topologia, normalmente los racks y los switches de nucleo.
function tienenPadre(conexiones: Conexion[]): Set<string> {
  const conPadre = new Set<string>()
  for (const conexion of conexiones) {
    if (conexion.eliminadoEn) continue
    if (conexion.tipo === 'instalacion') conPadre.add(conexion.origenId)
    else if (conexion.tipo === 'enlace') conPadre.add(conexion.destinoId)
  }
  return conPadre
}

// Solo entran a la topologia los dispositivos de red y los que
// participan en alguna conexion: asi un computador o una impresora
// suelta no llena el arbol.
function idsRelevantes(
  dispositivos: Dispositivo[],
  esCategoriaRed: (categoriaId: string) => boolean,
  conexiones: Conexion[],
): Set<string> {
  const relevantes = new Set<string>()
  for (const dispositivo of dispositivos) {
    if (!dispositivo.eliminadoEn && esCategoriaRed(dispositivo.categoriaId)) {
      relevantes.add(dispositivo.id)
    }
  }
  for (const conexion of conexiones) {
    if (conexion.eliminadoEn) continue
    relevantes.add(conexion.origenId)
    relevantes.add(conexion.destinoId)
  }
  return relevantes
}

export function construirBosque(
  dispositivos: Dispositivo[],
  conexiones: Conexion[],
  esCategoriaRed: (categoriaId: string) => boolean,
): NodoTopologia[] {
  const nombres = new Map(dispositivos.filter((d) => !d.eliminadoEn).map((d) => [d.id, d.nombre]))
  const relevantes = idsRelevantes(dispositivos, esCategoriaRed, conexiones)
  const conPadre = tienenPadre(conexiones)
  const raices = [...relevantes].filter((id) => !conPadre.has(id))
  return raices
    .map((id) => construirArbol(id, conexiones, nombres))
    .sort((a, b) => compararNatural(a.nombre, b.nombre))
}
