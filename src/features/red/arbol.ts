import type { Conexion, Dispositivo, TipoConexion } from '../../lib/db'
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

// Datos del dispositivo que el arbol necesita mostrar en cada nodo
// (fase R1, 2026-07-09): antes solo se llevaba el nombre; ahora
// tambien el estado (para el indicador de color) y la categoria
// (para agrupar el impacto de una falla por tipo de equipo).
export interface InfoDispositivo {
  nombre: string
  estado: string
  categoriaId: string
}

export interface NodoTopologia {
  dispositivoId: string
  nombre: string
  estado: string
  categoriaId: string
  // Como se llega a este nodo desde su padre: "Puerto 3", el medio del
  // enlace, o "Instalado" para una instalacion. Vacio en la raiz.
  via: string
  // Tipo de conexion con el padre (null en la raiz, que no tiene
  // padre): permite elegir el icono correcto para "via" (fase R1).
  tipoConexion: TipoConexion | null
  // Medio fisico del enlace con el padre (UTP, fibra, inalambrico...),
  // tal cual lo escribio el tecnico; '' si no aplica (instalacion o
  // enlace sin medio especificado).
  medio: string
  hijos: NodoTopologia[]
  // true si la rama se corto porque el dispositivo ya estaba en el
  // camino (ciclo): se muestra como hoja para no repetir el subarbol.
  truncado: boolean
}

interface Hijo {
  dispositivoId: string
  nombreReferencia: string
  via: string
  tipoConexion: TipoConexion
  medio: string
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
        tipoConexion: 'instalacion',
        medio: '',
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
        tipoConexion: 'enlace',
        medio: conexion.medio,
        orden: conexion.origenPuerto || conexion.destinoNombre,
      })
    }
  }
  return hijos
}

// Conexion donde el nodo dado es el HIJO (el que depende de otro):
// simetrico a hijosDirectos, para subir por el arbol en vez de bajar
// (fase R1, "¿de que depende este equipo?").
function padreDirecto(
  nodoId: string,
  conexiones: Conexion[],
): { dispositivoId: string; nombreReferencia: string; via: string; tipoConexion: TipoConexion; medio: string } | null {
  for (const conexion of conexiones) {
    if (conexion.eliminadoEn) continue
    if (conexion.tipo === 'instalacion' && conexion.origenId === nodoId) {
      return {
        dispositivoId: conexion.destinoId,
        nombreReferencia: conexion.destinoNombre,
        via: 'Instalado',
        tipoConexion: 'instalacion',
        medio: '',
      }
    }
    if (conexion.tipo === 'enlace' && conexion.destinoId === nodoId) {
      const via = conexion.origenPuerto ? `Puerto ${conexion.origenPuerto}` : conexion.medio || 'Enlace'
      return {
        dispositivoId: conexion.origenId,
        nombreReferencia: conexion.origenNombre,
        via,
        tipoConexion: 'enlace',
        medio: conexion.medio,
      }
    }
  }
  return null
}

function construirNodo(
  dispositivoId: string,
  nombreReferencia: string,
  via: string,
  tipoConexion: TipoConexion | null,
  medio: string,
  conexiones: Conexion[],
  infoPorId: Map<string, InfoDispositivo>,
  enCamino: Set<string>,
): NodoTopologia {
  const info = infoPorId.get(dispositivoId)
  const nombre = info?.nombre || nombreReferencia || '(dispositivo sin nombre)'
  const estado = info?.estado ?? ''
  const categoriaId = info?.categoriaId ?? ''
  if (enCamino.has(dispositivoId)) {
    return { dispositivoId, nombre, estado, categoriaId, via, tipoConexion, medio, hijos: [], truncado: true }
  }
  // Copia del camino por rama: dos hermanos pueden llevar al mismo
  // subarbol sin bloquearse entre si; solo se corta un ciclo real.
  const siguiente = new Set(enCamino).add(dispositivoId)
  const hijos = hijosDirectos(dispositivoId, conexiones)
    .sort((a, b) => compararNatural(a.orden, b.orden) || compararNatural(a.nombreReferencia, b.nombreReferencia))
    .map((h) =>
      construirNodo(h.dispositivoId, h.nombreReferencia, h.via, h.tipoConexion, h.medio, conexiones, infoPorId, siguiente),
    )
  return { dispositivoId, nombre, estado, categoriaId, via, tipoConexion, medio, hijos, truncado: false }
}

export function construirArbol(
  raizId: string,
  conexiones: Conexion[],
  infoPorId: Map<string, InfoDispositivo>,
): NodoTopologia {
  return construirNodo(raizId, infoPorId.get(raizId)?.nombre ?? '', '', null, '', conexiones, infoPorId, new Set())
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
  const infoPorId = infoDeDispositivos(dispositivos)
  const relevantes = idsRelevantes(dispositivos, esCategoriaRed, conexiones)
  const conPadre = tienenPadre(conexiones)
  const raices = [...relevantes].filter((id) => !conPadre.has(id))
  return raices
    .map((id) => construirArbol(id, conexiones, infoPorId))
    .sort((a, b) => compararNatural(a.nombre, b.nombre))
}

// Mapa id -> info (nombre, estado, categoria) a partir de la lista de
// dispositivos, para pasar a construirArbol/construirBosque.
export function infoDeDispositivos(dispositivos: Dispositivo[]): Map<string, InfoDispositivo> {
  return new Map(
    dispositivos
      .filter((d) => !d.eliminadoEn)
      .map((d) => [d.id, { nombre: d.nombre, estado: d.estado, categoriaId: d.categoriaId }]),
  )
}

// Cuantos dispositivos dependen (directa o indirectamente) del nodo
// dado, agrupados por categoria: "si este switch falla, tambien
// quedan sin servicio 12 POS, 4 impresoras..." (fase R1, punto 10).
// Cuenta TODOS los descendientes del arbol ya construido (no vuelve a
// leer conexiones), asi que un nodo truncado por ciclo se cuenta una
// sola vez a si mismo sin expandir su subarbol repetido.
export function contarImpacto(nodo: NodoTopologia): Map<string, number> {
  const conteo = new Map<string, number>()
  function visitar(actual: NodoTopologia) {
    for (const hijo of actual.hijos) {
      if (hijo.categoriaId) conteo.set(hijo.categoriaId, (conteo.get(hijo.categoriaId) ?? 0) + 1)
      visitar(hijo)
    }
  }
  visitar(nodo)
  return conteo
}

export interface PasoAscendente {
  dispositivoId: string
  nombre: string
  via: string
  tipoConexion: TipoConexion
  medio: string
}

// Cadena de dependencia hacia arriba desde un dispositivo hasta la
// raiz: "depende de: Puerto 12 (Switch Oficina) -> Puerto 3 (Switch
// Principal)" (fase R1, punto 9). El primer elemento es el padre
// inmediato; el ultimo, la raiz. Se corta ante un ciclo (no deberia
// existir, pero los datos podrian venir de una version anterior).
export function caminoAscendente(
  dispositivoId: string,
  conexiones: Conexion[],
  infoPorId: Map<string, InfoDispositivo>,
): PasoAscendente[] {
  const camino: PasoAscendente[] = []
  const visitados = new Set([dispositivoId])
  let actual = dispositivoId
  for (let i = 0; i < 100; i++) {
    const padre = padreDirecto(actual, conexiones)
    if (!padre || visitados.has(padre.dispositivoId)) break
    visitados.add(padre.dispositivoId)
    camino.push({
      dispositivoId: padre.dispositivoId,
      nombre: infoPorId.get(padre.dispositivoId)?.nombre || padre.nombreReferencia || '(dispositivo sin nombre)',
      via: padre.via,
      tipoConexion: padre.tipoConexion,
      medio: padre.medio,
    })
    actual = padre.dispositivoId
  }
  return camino
}
