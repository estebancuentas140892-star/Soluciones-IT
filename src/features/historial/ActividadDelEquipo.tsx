import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { UsersThree } from '../../components/iconos'
import { SeccionPlegable } from '../../components/SeccionPlegable'
import { VISUAL_POR_TIPO } from '../busqueda/resultados'
import {
  ETIQUETA_ACCION_CAMBIO,
  obtenerActividadReciente,
  tiempoRelativo,
  type FilaActividad,
} from './actividadEquipo'
import { etiquetaResuelto } from './lineaDeTiempo'

// ACTIVIDAD DEL EQUIPO, AL FINAL DE LA AGENDA (tarea 257, encargo del
// 2026-09-22, sección 6 de PROPUESTA_REDISENO_RESOLVER.md).
//
// Vivía en Más, en un grupo "Lo mío y lo del equipo" junto a Mis
// favoritos. Pero Más es un índice de DESTINOS, y esto no es un sitio al
// que se va: es lo que pasa en el equipo mientras uno trabaja. Su casa
// natural es la Agenda, que ya responde "qué hay que atender": al final
// y plegada, para que no compita con lo vencido ni con lo de hoy.
//
// Mismos datos, mismos enlaces y misma forma de fila que tenía en Más
// (y antes en Inicio). Si no hay actividad, no se monta nada.
export function ActividadDelEquipo() {
  const actividad = useLiveQuery(() => obtenerActividadReciente(), [], [])
  if (actividad.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-noct-divider">
      <SeccionPlegable titulo="Actividad del equipo" Icono={UsersThree} conteo={actividad.length}>
        <div className="flex flex-col">
          {actividad.map((fila) => (
            <FilaActividadItem key={fila.clave} fila={fila} />
          ))}
        </div>
      </SeccionPlegable>
    </div>
  )
}

// Quién hizo qué, sobre qué ficha, hace cuánto. Es una FRASE, no un par
// título/subtítulo, así que conserva su forma propia.
function FilaActividadItem({ fila }: { fila: FilaActividad }) {
  const { Icono } = VISUAL_POR_TIPO[fila.entidadTipo ?? 'diagnostico']
  const accionTexto =
    fila.tipo === 'ejecucion' ? `ejecutó el diagnóstico` : ETIQUETA_ACCION_CAMBIO[fila.accion ?? 'edito']
  const detalle =
    fila.tipo === 'ejecucion'
      ? `(${etiquetaResuelto(fila.resuelto ?? 'abandonado')})`
      : fila.accion === 'edito' && fila.cantidadCambios > 1
        ? `(${fila.cantidadCambios} cambios)`
        : ''

  return (
    <Link
      to={fila.ruta}
      className="flex min-h-11 items-start gap-2.5 border-t border-noct-divider/60 py-2 text-[13.5px] text-noct-text first:border-t-0 hover:text-noct-accent-300"
    >
      <Icono size={15} className="mt-[3px] shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0 flex-1 leading-[1.35] [text-wrap:pretty]">
        <span className="font-medium">{fila.usuarioNombre}</span> {accionTexto}{' '}
        <span className="font-medium">{fila.titulo}</span> {detalle}
      </span>
      <span className="shrink-0 text-[12px] text-noct-neutral-400">{tiempoRelativo(fila.fechaHora)}</span>
    </Link>
  )
}
