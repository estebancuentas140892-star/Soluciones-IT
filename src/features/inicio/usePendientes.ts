import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'
import { estaAbierto } from '../../lib/mantenimientos'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { DIAS_LIBERADO_RECIENTE } from './asuntosDePersonas'
import { calcularPendientes, type ItemPendiente } from './pendientes'

// Las consultas que alimentan la agenda (antes solo vivían en
// InicioPage), extraídas para que también las use el chasis (tarea 187,
// `AvisoPestana`): el número de la pestaña necesita el conteo REAL de
// pendientes, no solo los que una pantalla decide mostrar. `limite:
// Infinity` porque `Array.prototype.slice` con `Infinity` devuelve el
// arreglo completo; quien muestre la lista decide su propio tope.
//
// SIN VALOR POR DEFECTO, A PROPÓSITO (encargo del 2026-09-20, tarea 3).
// Con `[]` de partida, `useLiveQuery` devuelve una agenda vacía mientras
// Dexie responde, y la pantalla llegaba a decir "Todo al día por hoy" un
// instante antes de pintar tres accesos vencidos: un mensaje tranquilo y
// falso es peor que un hueco. Ahora cada consulta devuelve `undefined`
// hasta que resuelve, y eso es lo que `cargando` reporta.

export interface EstadoPendientes {
  items: ItemPendiente[]
  /** Todavía no se sabe qué hay: ni "hay cosas" ni "no hay nada". */
  cargando: boolean
}

export function usePendientes(): EstadoPendientes {
  const perfil = usePerfilVivo()
  const borradores = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && a.estado === 'borrador').toArray(),
    [],
  )
  const credencialesConVencimiento = useLiveQuery(
    () => db.credenciales.filter((c) => !c.eliminadoEn && Boolean(c.venceEn)).toArray(),
    [],
  )
  const camposProtegidosConVencimiento = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn && Boolean(c.venceEn)).toArray(),
    [],
  )
  // Todos los equipos: dan el nombre vivo de un dato protegido y, desde
  // la tarea 270, quién tiene qué (ingresos, retiros, equipos liberados).
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [])
  const nombresDispositivosPorId = useMemo(
    () => (dispositivos ? new Map(dispositivos.map((d) => [d.id, d.nombre])) : undefined),
    [dispositivos],
  )
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [])
  // Solo las entradas de asignación de los últimos días, por el índice de
  // fecha: el historial entero puede ser largo y esto corre en cada
  // pantalla (el número de la pestaña Resolver).
  const liberaciones = useLiveQuery(() => {
    const desde = new Date(Date.now() - DIAS_LIBERADO_RECIENTE * 24 * 60 * 60 * 1000).toISOString()
    return db.historial
      .where('fechaHora')
      .aboveOrEqual(desde)
      .filter((h) => h.entidadTipo === 'dispositivo' && h.campo === 'responsableId')
      .toArray()
  }, [])
  const ejecucionesConSugerencia = useLiveQuery(
    () => db.ejecuciones_diagnostico.filter((e) => e.motivo === 'encontro_otra_solucion').toArray(),
    [],
  )
  const articulosDeSugerencia = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && Boolean(a.origenSugerenciaId)).toArray(),
    [],
  )
  // Tarea 320: solo los mantenimientos abiertos; `calcularPendientes`
  // decide cuáles se pueden fechar (confirmados, con fecha, de un equipo
  // que existe).
  const mantenimientosAbiertos = useLiveQuery(
    () => db.mantenimientos.filter((m) => !m.eliminadoEn && estaAbierto(m)).toArray(),
    [],
  )
  // Tarea 321: solo las autorizaciones confirmadas pueden avisar;
  // `calcularPendientes` decide cuáles (con un POS que existe y un dato
  // confiable).
  const autorizacionesConfirmadas = useLiveQuery(
    () => db.autorizaciones_facturacion.filter((a) => !a.eliminadoEn && a.estado === 'confirmada').toArray(),
    [],
  )

  // `perfil` es `undefined` mientras carga y `null` sin sesión: solo lo
  // primero es cargar. Sin perfil no hay agenda (no se sabe de quién son
  // los borradores ni si puede ver la bóveda), y eso no es "cargando".
  const cargando =
    perfil === undefined ||
    borradores === undefined ||
    credencialesConVencimiento === undefined ||
    camposProtegidosConVencimiento === undefined ||
    nombresDispositivosPorId === undefined ||
    personas === undefined ||
    liberaciones === undefined ||
    ejecucionesConSugerencia === undefined ||
    articulosDeSugerencia === undefined ||
    mantenimientosAbiertos === undefined ||
    autorizacionesConfirmadas === undefined

  const items = useMemo(
    () =>
      perfil
        ? calcularPendientes({
            articulos: borradores ?? [],
            credenciales: credencialesConVencimiento ?? [],
            camposProtegidos: camposProtegidosConVencimiento ?? [],
            nombresDispositivosPorId: nombresDispositivosPorId ?? new Map<string, string>(),
            ejecuciones: ejecucionesConSugerencia ?? [],
            articulosDeSugerencia: articulosDeSugerencia ?? [],
            personas: personas ?? [],
            dispositivos: dispositivos ?? [],
            liberaciones: liberaciones ?? [],
            mantenimientos: mantenimientosAbiertos ?? [],
            autorizaciones: autorizacionesConfirmadas ?? [],
            usuarioId: perfil.id,
            puedeVerBoveda: perfil.puedeVerBoveda,
            limite: Infinity,
          })
        : [],
    [
      perfil,
      borradores,
      credencialesConVencimiento,
      camposProtegidosConVencimiento,
      nombresDispositivosPorId,
      personas,
      dispositivos,
      liberaciones,
      ejecucionesConSugerencia,
      articulosDeSugerencia,
      mantenimientosAbiertos,
      autorizacionesConfirmadas,
    ],
  )

  return { items, cargando }
}
