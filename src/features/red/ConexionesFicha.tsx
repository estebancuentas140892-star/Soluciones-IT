import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type Conexion, type Dispositivo } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { agruparConexiones, type ExtremoConexion } from '../../lib/conexiones'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { CaretRight, Plus, X } from '../../components/iconos'
import { BTN_GHOST_ACENTO, TituloSeccion } from '../../components/nocturne'
import { FormularioConexion } from './FormularioConexion'

// Seccion Conexiones de la ficha de un dispositivo: lista sus enlaces
// e instalaciones (navegables a la ficha del otro extremo) y permite
// agregar o quitar conexiones. Re-autorizada al sistema Nocturne
// (handoff "Rediseño de aplicación empresarial", Ficha de
// Dispositivo.dc.html): la logica y los datos no cambian.
export function ConexionesFicha({
  dispositivo,
  sinCabecera = false,
}: {
  dispositivo: Dispositivo
  /**
   * La sección va dentro de una `SeccionPlegable` que ya escribe el
   * rótulo y su conteo (ficha de equipo, M-014). El enlace "Ver en
   * topología" no se pierde: se queda solo, alineado a la derecha.
   */
  sinCabecera?: boolean
}) {
  const conexiones = useLiveQuery(
    () =>
      db.conexiones
        .where('origenId')
        .equals(dispositivo.id)
        .or('destinoId')
        .equals(dispositivo.id)
        .toArray(),
    [dispositivo.id],
    [],
  )

  // Nombres vivos de los demás equipos (fase N1, regla de referencia
  // viva): la conexión guarda el nombre del otro extremo como copia de
  // referencia, pero si el equipo existe local se muestra su nombre
  // actual, así renombrar un switch se refleja en todas sus conexiones
  // sin reescribir nada. La copia solo se usa si el equipo no sincronizó
  // o fue eliminado.
  const nombrePorId = useLiveQuery(
    async () => mapaDeTextos(await db.dispositivos.toArray(), (d) => d.nombre),
    [],
    new Map<string, string>(),
  )

  const grupos = useMemo(() => agruparConexiones(conexiones ?? [], dispositivo.id), [conexiones, dispositivo.id])
  const [agregando, setAgregando] = useState(false)

  const total =
    grupos.instaladoEn.length + grupos.contiene.length + grupos.enlaces.length + grupos.relacionados.length

  async function quitar(conexion: Conexion) {
    await eliminarRegistro('conexiones', conexion.id)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className={`flex items-center ${sinCabecera ? 'justify-end' : 'justify-between'}`}>
        {!sinCabecera && <TituloSeccion>Conexiones</TituloSeccion>}
        <Link
          to={`/red/topologia/${dispositivo.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-noct-accent-300 hover:text-noct-accent-400"
        >
          Ver en topología
          <CaretRight size={12} aria-hidden />
        </Link>
      </div>

      {total === 0 && !agregando && (
        <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4 text-center text-sm text-noct-neutral-500">
          Sin conexiones registradas
        </p>
      )}

      {grupos.instaladoEn.length > 0 && (
        <GrupoConexiones titulo="Instalado en">
          {grupos.instaladoEn.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.contiene.length > 0 && (
        <GrupoConexiones titulo="Contiene">
          {grupos.contiene.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.enlaces.length > 0 && (
        <GrupoConexiones titulo="Enlaces">
          {grupos.enlaces.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.relacionados.length > 0 && (
        <GrupoConexiones titulo="Relacionados">
          {grupos.relacionados.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {agregando ? (
        <FormularioConexion
          dispositivo={dispositivo}
          enlaces={grupos.enlaces}
          variante="ficha"
          onCerrar={() => setAgregando(false)}
        />
      ) : (
        <button type="button" onClick={() => setAgregando(true)} className={`${BTN_GHOST_ACENTO} self-start`}>
          <Plus size={13} aria-hidden />
          Agregar conexión
        </button>
      )}
    </section>
  )
}

function GrupoConexiones({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] text-noct-neutral-500">{titulo}</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function FilaConexion({
  extremo,
  nombrePorId,
  onQuitar,
}: {
  extremo: ExtremoConexion
  nombrePorId: Map<string, string>
  onQuitar: (conexion: Conexion) => Promise<void>
}) {
  const { conexion, otroId, otroNombre, puertoLocal, puertoRemoto } = extremo
  const nombre = nombreVivo(nombrePorId, otroId, otroNombre)
  const detalle = [
    puertoLocal && `Puerto ${puertoLocal}`,
    puertoRemoto && `→ puerto ${puertoRemoto}`,
    conexion.medio,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-center gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <Link to={`/dispositivos/${otroId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-noct-text">{nombre}</p>
        {(detalle || conexion.notas) && (
          <p className="truncate text-xs text-noct-neutral-400">{detalle || conexion.notas}</p>
        )}
      </Link>
      <button
        type="button"
        onClick={() => void onQuitar(conexion)}
        aria-label="Quitar conexión"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-noct-neutral-500 hover:bg-noct-text/[.05] hover:text-noct-text"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  )
}
