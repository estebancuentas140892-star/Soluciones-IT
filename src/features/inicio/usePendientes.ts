import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { calcularPendientes, type ItemPendiente } from './pendientes'

// Las cinco consultas que alimentan "Pendientes" (antes solo vivían en
// InicioPage), extraídas para que también las use el chasis (tarea 187,
// `AvisoPestana`): el número de la pestaña Más necesita el conteo REAL
// de pendientes, no solo los que Inicio decide mostrar. `limite:
// Infinity` porque `Array.prototype.slice` con `Infinity` devuelve el
// arreglo completo; quien muestre la lista decide su propio tope.
export function usePendientes(): ItemPendiente[] {
  const perfil = usePerfilVivo()
  const borradores = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && a.estado === 'borrador').toArray(),
    [],
    [],
  )
  const credencialesConVencimiento = useLiveQuery(
    () => db.credenciales.filter((c) => !c.eliminadoEn && Boolean(c.venceEn)).toArray(),
    [],
    [],
  )
  const camposProtegidosConVencimiento = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn && Boolean(c.venceEn)).toArray(),
    [],
    [],
  )
  const nombresDispositivosPorId = useLiveQuery(
    async () => new Map((await db.dispositivos.toArray()).map((d) => [d.id, d.nombre])),
    [],
    new Map<string, string>(),
  )
  const ejecucionesConSugerencia = useLiveQuery(
    () => db.ejecuciones_diagnostico.filter((e) => e.motivo === 'encontro_otra_solucion').toArray(),
    [],
    [],
  )
  const articulosDeSugerencia = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && Boolean(a.origenSugerenciaId)).toArray(),
    [],
    [],
  )

  return useMemo(
    () =>
      perfil
        ? calcularPendientes({
            articulos: borradores,
            credenciales: credencialesConVencimiento,
            camposProtegidos: camposProtegidosConVencimiento,
            nombresDispositivosPorId,
            ejecuciones: ejecucionesConSugerencia,
            articulosDeSugerencia,
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
      ejecucionesConSugerencia,
      articulosDeSugerencia,
    ],
  )
}
