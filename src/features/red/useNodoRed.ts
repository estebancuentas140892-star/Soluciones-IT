import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Dispositivo } from '../../lib/db'
import { agruparConexiones } from '../../lib/conexiones'
import { esDeRed } from '../../lib/categorias'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { construirArbol, construirBosque, contarDescendientes, contarImpacto, infoDeDispositivos, type NodoTopologia } from './arbol'

// Los datos de un nodo de la topología, como dato y en un solo sitio.
//
// Sale de la tarea 204 (hallazgo M-018): la pestaña Red pasó a abrir con
// UN NODO, que es lo que hasta entonces solo mostraba la topología de un
// equipo. Sin esto, las dos pantallas tendrían dos copias del mismo
// cálculo ("de qué depende", "qué cae si falla", "qué depende de él"), y
// ya se sabe cómo termina eso: divergen (hallazgo D1 de
// AUDITORIA_FLUJOS_TI.md, y la propia FilaArticulo de Guías).
//
// Está partido en dos: `useRedCargada` lee las tablas una vez y arma el
// bosque, y `useNodoRed` calcula lo de UN nodo dentro de esos datos. La
// razón es un orden de dependencias: la pestaña Red necesita el bosque
// ANTES de saber qué nodo abrir (ver `nodoDeRed.ts`), mientras que la
// topología de un equipo ya trae su id en la ruta.

export interface RedCargada {
  /** Todavía leyendo las tablas: nada de lo demás es concluyente. */
  cargando: boolean
  dispositivos: Dispositivo[]
  bosque: NodoTopologia[]
  nombreCategoria: Map<string, string>
  nombrePorId: Map<string, string>
  /** Categorías marcadas como de red: define qué entra al bosque. */
  idsRed: Set<string>
}

export function useRedCargada(): RedCargada {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [])
  // El nombre vivo tiene que salir de TODOS los dispositivos, no solo de
  // los vigentes: un extremo de conexión puede apuntar a uno eliminado y
  // la copia de referencia es lo único que queda para nombrarlo.
  const nombrePorId = useLiveQuery(
    async () => mapaDeTextos(await db.dispositivos.toArray(), (d) => d.nombre),
    [],
    new Map<string, string>(),
  )

  const idsRed = useMemo(
    () => new Set((categorias ?? []).filter(esDeRed).map((c) => c.id)),
    [categorias],
  )
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )
  const bosque = useMemo(
    () => construirBosque(dispositivos ?? [], conexiones ?? [], (categoriaId) => idsRed.has(categoriaId)),
    [dispositivos, conexiones, idsRed],
  )

  return {
    cargando: !dispositivos || !conexiones || !categorias,
    dispositivos: dispositivos ?? [],
    bosque,
    nombreCategoria,
    nombrePorId,
    idsRed,
  }
}

export interface PadreDeNodo {
  id: string
  nombre: string
  /** Cómo se llega desde ese padre: "Instalado", "Puerto 3 · fibra". */
  via: string
}

export interface ChipImpacto {
  categoriaId: string
  cantidad: number
  categoria: string
  texto: string
}

export interface DatosNodoRed {
  equipo: Dispositivo | undefined
  /** Padres directos: donde está instalado y los enlaces que RECIBE. */
  dependeDe: PadreDeNodo[]
  arbol: NodoTopologia
  totalDependientes: number
  chipsImpacto: ChipImpacto[]
  grupos: ReturnType<typeof agruparConexiones>
}

export function useNodoRed(dispositivoId: string, red: RedCargada): DatosNodoRed {
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])

  const equipo = useMemo(
    () => red.dispositivos.find((d) => d.id === dispositivoId),
    [red.dispositivos, dispositivoId],
  )
  const infoPorId = useMemo(() => infoDeDispositivos(red.dispositivos), [red.dispositivos])

  // Árbol de dependientes con este equipo como raíz: sus hijos son los
  // equipos a los que da servicio (enlaces) o que contiene (rack).
  const arbol = useMemo(
    () => construirArbol(dispositivoId, conexiones, infoPorId),
    [dispositivoId, conexiones, infoPorId],
  )
  const impacto = useMemo(() => contarImpacto(arbol), [arbol])
  const totalDependientes = useMemo(() => contarDescendientes(arbol), [arbol])

  const grupos = useMemo(() => agruparConexiones(conexiones, dispositivoId), [conexiones, dispositivoId])

  const dependeDe = useMemo(() => {
    const padres: PadreDeNodo[] = []
    for (const e of grupos.instaladoEn) {
      padres.push({ id: e.otroId, nombre: nombreVivo(red.nombrePorId, e.otroId, e.otroNombre), via: 'Instalado' })
    }
    for (const e of grupos.enlaces) {
      if (e.esOrigen) continue // los que este equipo SIRVE son hijos, no padres
      const via = e.puertoRemoto ? `Puerto ${e.puertoRemoto}` : e.conexion.medio || 'Enlace'
      padres.push({
        id: e.otroId,
        nombre: nombreVivo(red.nombrePorId, e.otroId, e.otroNombre),
        via: [via, e.conexion.medio && e.conexion.medio !== via ? e.conexion.medio : '']
          .filter(Boolean)
          .join(' · '),
      })
    }
    return padres
  }, [grupos, red.nombrePorId])

  const chipsImpacto = useMemo(
    () =>
      [...impacto.entries()]
        .map(([categoriaId, cantidad]) => {
          const categoria = red.nombreCategoria.get(categoriaId) ?? categoriaId
          return { categoriaId, cantidad, categoria, texto: `${cantidad} ${categoria}` }
        })
        .sort((a, b) => b.cantidad - a.cantidad),
    [impacto, red.nombreCategoria],
  )

  return { equipo, dependeDe, arbol, totalDependientes, chipsImpacto, grupos }
}
