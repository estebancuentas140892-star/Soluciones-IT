import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useState } from 'react'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { Check, Plus, User } from '../../components/iconos'
import { Modal } from '../../components/Modal'
import { BTN_GHOST, BTN_PRIMARIO } from '../../components/nocturne'
import { db, type Dispositivo } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { estaActiva } from './cicloPersona'
import { asignarEquipo } from './operaciones'

// ASIGNAR UNA PERSONA DESDE LA FICHA DEL EQUIPO (tarea 266).
//
// El camino inverso de "Asignar equipo" en la ficha de la persona: con el
// equipo delante (por ejemplo, tras escanear su QR) se elige a quién se
// entrega. Solo personas activas. Si no existe, se crea aquí mismo, con
// lo mínimo (el nombre); el resto se completa en su ficha. Un
// responsable escrito "por validar" ("Archivo", dos nombres) NO se
// propone como persona: el técnico decide a quién buscar.
export function HojaAsignarPersona({
  dispositivo,
  abierto,
  onCerrar,
}: {
  dispositivo: Pick<Dispositivo, 'id' | 'nombre' | 'responsableId'>
  abierto: boolean
  onCerrar: () => void
}) {
  const idTitulo = useId()
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])
  const [consulta, setConsulta] = useState('')
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const q = normalizarTexto(consulta.trim())
  const activas = useMemo(
    () =>
      personas
        .filter((p) => estaActiva(p) && p.id !== dispositivo.responsableId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [personas, dispositivo.responsableId],
  )
  const visibles = q ? activas.filter((p) => normalizarTexto(p.nombre).includes(q)) : activas
  const nombreNuevo = consulta.trim().replace(/\s+/g, ' ')
  const yaExiste = activas.some((p) => normalizarTexto(p.nombre) === normalizarTexto(nombreNuevo))

  function cerrar() {
    setConsulta('')
    setElegidaId(null)
    onCerrar()
  }

  async function asignar(personaId: string) {
    setGuardando(true)
    await asignarEquipo(dispositivo.id, personaId)
    setGuardando(false)
    cerrar()
  }

  async function crearYAsignar() {
    if (!nombreNuevo) return
    setGuardando(true)
    const id = nuevoId()
    await guardarRegistro('personas', {
      id,
      nombre: nombreNuevo,
      notas: '',
      estado: 'activa',
      fechaIngreso: null,
      fechaRetiro: null,
      motivoRetiro: '',
    })
    await asignarEquipo(dispositivo.id, id)
    setGuardando(false)
    cerrar()
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} tituloId={idTitulo}>
      <div className="flex flex-col gap-3">
        <h2 id={idTitulo} className="text-[16px] font-medium leading-[1.3]">
          ¿A quién se asigna {dispositivo.nombre}?
        </h2>
        <CampoBusqueda valor={consulta} onCambiar={setConsulta} alcance="Personas" />
        <div role="radiogroup" aria-label="Personas activas" className="flex max-h-[45dvh] flex-col overflow-y-auto">
          {visibles.map((p) => {
            const activa = p.id === elegidaId
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => setElegidaId(p.id)}
                className={`flex min-h-11 items-center gap-2.5 rounded-md border px-2.5 text-left text-[14px] transition-colors ${
                  activa ? 'border-noct-accent bg-noct-accent/[.12]' : 'border-transparent hover:bg-noct-text/[.05]'
                }`}
              >
                <User size={16} className="shrink-0 text-noct-neutral-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                {activa && <Check size={15} className="shrink-0 text-noct-accent" aria-hidden />}
              </button>
            )
          })}
          {visibles.length === 0 && (
            <p className="px-1 py-3 text-[13px] text-noct-neutral-500">
              {q ? 'Nadie activo se llama así.' : 'No hay personas activas.'}
            </p>
          )}
        </div>
        {nombreNuevo && !yaExiste && (
          <button
            type="button"
            onClick={() => void crearYAsignar()}
            disabled={guardando}
            className="flex min-h-11 items-center gap-2 rounded-md border border-dashed border-noct-neutral-700 px-3 text-left text-[13px] text-noct-accent-300 hover:bg-noct-text/[.04] disabled:opacity-50"
          >
            <Plus size={14} className="shrink-0" aria-hidden />
            Crear a «{nombreNuevo}» y asignarle el equipo
          </button>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={cerrar} className={`${BTN_GHOST} min-h-11 px-4`}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => elegidaId && void asignar(elegidaId)}
            disabled={!elegidaId || guardando}
            className={`${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-50`}
          >
            {guardando ? 'Asignando…' : 'Asignar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
