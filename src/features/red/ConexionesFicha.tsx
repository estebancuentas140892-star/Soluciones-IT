import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type Conexion, type Dispositivo } from '../../lib/db'
import { eliminarRegistro, guardarRegistro } from '../../lib/repositorio'
import { agruparConexiones, extremosInvertidos, type ExtremoConexion } from '../../lib/conexiones'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { ArrowsLeftRight, CaretRight, Plus, X } from '../../components/iconos'
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

  // Repara un enlace registrado al reves (hallazgo N1). Guarda la misma
  // conexion con los extremos intercambiados en vez de borrarla y
  // recrearla, asi conserva su id y su historial, y el motivo deja
  // escrito quien la corrigio y cuando.
  async function invertir(conexion: Conexion) {
    await guardarRegistro('conexiones', extremosInvertidos(conexion), 'Se invirtió la dirección del enlace')
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
            <FilaConexion
              key={extremo.conexion.id}
              extremo={extremo}
              nombrePorId={nombrePorId}
              onQuitar={quitar}
              onInvertir={invertir}
            />
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

// Acciones de la fila. 44 px es el minimo de toque que ya aplica el
// resto de la app (M-005 de la auditoria movil); el boton de quitar
// media 32 y aqui pasa a tener un vecino, asi que dos objetivos
// pequeños y pegados se volvian un error de puntería.
const BTN_FILA =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-noct-neutral-500 hover:bg-noct-text/[.05] hover:text-noct-text'

function FilaConexion({
  extremo,
  nombrePorId,
  onQuitar,
  onInvertir,
}: {
  extremo: ExtremoConexion
  nombrePorId: Map<string, string>
  onQuitar: (conexion: Conexion) => Promise<void>
  /**
   * Solo lo recibe el grupo "Enlaces": invertir una instalación o una
   * relación no significa nada (hallazgo N1).
   */
  onInvertir?: (conexion: Conexion) => Promise<void>
}) {
  const { conexion, esOrigen, otroId, otroNombre, puertoLocal, puertoRemoto } = extremo
  const nombre = nombreVivo(nombrePorId, otroId, otroNombre)
  const detalle = [
    puertoLocal && `Puerto ${puertoLocal}`,
    puertoRemoto && `→ puerto ${puertoRemoto}`,
    conexion.medio,
  ]
    .filter(Boolean)
    .join(' · ')

  // Hallazgo N1: la fila solo nombraba al otro extremo, asi que un
  // enlace invertido se veia identico a uno correcto y el error solo
  // salia a la luz en el arbol de topologia, ya torcido. Se decide por
  // el tipo de la conexion y no por si llega `onInvertir`, para que la
  // direccion tambien se lea donde la fila se pinte sin acciones. Los
  // rotulos son los mismos del formulario de alta a proposito: el
  // tecnico reconoce lo que eligio al crearla.
  const esEnlace = conexion.tipo === 'enlace'
  const direccion = esOrigen ? 'Da servicio a' : 'Recibe de'
  const trasInvertir = esOrigen
    ? `${nombre} pasa a dar servicio a este equipo`
    : `este equipo pasa a dar servicio a ${nombre}`

  return (
    <li className="flex items-center gap-1 rounded-md border border-noct-divider bg-noct-surface py-1.5 pl-3 pr-1.5">
      <Link to={`/dispositivos/${otroId}`} className="min-w-0 flex-1 py-1">
        {esEnlace && <p className="truncate text-[11px] text-noct-neutral-500">{direccion}</p>}
        <p className="truncate text-sm font-medium text-noct-text">{nombre}</p>
        {(detalle || conexion.notas) && (
          <p className="truncate text-xs text-noct-neutral-400">{detalle || conexion.notas}</p>
        )}
      </Link>
      {esEnlace && onInvertir && (
        <button
          type="button"
          onClick={() => void onInvertir(conexion)}
          aria-label={`Invertir la dirección: ${trasInvertir}`}
          title={`Invertir la dirección: ${trasInvertir}`}
          className={BTN_FILA}
        >
          <ArrowsLeftRight size={15} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => void onQuitar(conexion)}
        aria-label="Quitar conexión"
        className={BTN_FILA}
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  )
}
