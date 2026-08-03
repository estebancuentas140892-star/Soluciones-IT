import { Link } from 'react-router-dom'
import type { Dispositivo } from '../../lib/db'
import { Warning } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import type { PasoAscendente } from './arbol'
import { iconoDeVia } from './medios'
import { useImpactoEquipo } from './useImpactoEquipo'

// Impacto de una falla y cadena de dependencia de un equipo (fase R1,
// puntos 9 y 10 de PROPUESTA_MODULOS.md), en la ficha del dispositivo.
// Solo se muestra si el equipo participa de alguna conexion; el resto
// del tiempo no aporta nada y no ocupa espacio. Se apoya en el mismo
// arbol de topologia que la vista de mapa (src/features/red/arbol.ts):
// nunca duplica la logica de "que depende de que".
export function ImpactoYDependencias({
  dispositivo,
  sinCabecera = false,
}: {
  dispositivo: Dispositivo
  /**
   * La sección va dentro de una `SeccionPlegable` que ya escribe el
   * rótulo y su conteo (ficha de equipo, M-014). Sin esto el título
   * saldría dos veces seguidas.
   */
  sinCabecera?: boolean
}) {
  const { impacto, camino, nombreCategoria } = useImpactoEquipo(dispositivo.id)

  if (impacto.size === 0 && camino.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      {!sinCabecera && <TituloSeccion className="mb-1">Si este equipo falla</TituloSeccion>}
      {impacto.size > 0 && <ImpactoFalla impacto={impacto} nombreCategoria={nombreCategoria} />}
      {camino.length > 0 && <DependeDe camino={camino} />}
    </section>
  )
}

function ImpactoFalla({
  impacto,
  nombreCategoria,
}: {
  impacto: Map<string, number>
  nombreCategoria: Map<string, string>
}) {
  const filas = [...impacto.entries()]
    .map(([categoriaId, cantidad]) => ({ nombre: nombreCategoria.get(categoriaId) ?? categoriaId, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-[13px] py-3">
      <p className="flex items-center gap-2 text-[13px] text-noct-neutral-200">
        <Warning size={15} className="shrink-0 text-noct-precaucion" aria-hidden />
        También quedarían sin servicio:
      </p>
      <ul className="ml-[23px] mt-1.5 flex flex-col gap-0.5">
        {filas.map((fila) => (
          <li key={fila.nombre} className="text-[13px] text-noct-neutral-200">
            • {fila.cantidad} {fila.nombre}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DependeDe({
  camino,
}: {
  camino: PasoAscendente[]
}) {
  return (
    <div className="rounded-lg border border-noct-divider bg-noct-surface px-[13px] py-3">
      <h3 className="text-[13px] font-medium text-noct-neutral-400">Depende de</h3>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {camino.map((paso) => (
          <li key={paso.dispositivoId}>
            <Link
              to={`/dispositivos/${paso.dispositivoId}`}
              className="flex items-center gap-2 text-[13px] text-noct-accent-300 hover:text-noct-accent-400"
            >
              <span className="shrink-0" aria-hidden>
                {iconoDeVia(paso.tipoConexion, paso.medio)}
              </span>
              <span className="shrink-0 text-noct-neutral-500">{paso.via}</span>
              <span className="shrink-0 text-noct-neutral-600">→</span>
              <span className="truncate">{paso.nombre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
