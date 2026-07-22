import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { FloppyDisk } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'

import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'

// Crear o editar una persona (hallazgo T1 de AUDITORIA_FLUJOS_TI.md):
// nombre y notas, sin jerarquía (no aplica a personas, a diferencia de
// ubicaciones). Trae su propio shell Nocturne, por eso sale del Layout
// oscuro.
export function PersonaForm() {
  const { personaId } = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(personaId)
  const [id] = useState(() => personaId ?? nuevoId())

  const persona = useLiveQuery(
    async () => (personaId ? ((await db.personas.get(personaId)) ?? null) : undefined),
    [personaId],
  )

  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!persona || cargadoInicial) return
    setNombre(persona.nombre)
    setNotas(persona.notas)
    setCargadoInicial(true)
  }, [persona, cargadoInicial])

  if (esEdicion && persona === null) return <Navigate to="/personas" replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (nombre.trim() === '') return
    setGuardando(true)
    await guardarRegistro('personas', { id, nombre: nombre.trim(), notas: notas.trim() }, motivo.trim())
    navigate(`/personas/${id}`)
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver>Cancelar</BotonVolver>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? 'Editar persona' : 'Nueva persona'}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">Quién tiene asignados los equipos</p>
          </div>
        </div>

        {esEdicion && !cargadoInicial ? (
          <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
        ) : (
          <form onSubmit={manejarEnvio} className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-[18px]">
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Nombre <span className="text-noct-accent-300">*</span>
              </span>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan Pérez"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Notas (opcional)</span>
              <textarea
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Cargo, área, extensión..."
                className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
              />
            </label>

            {esEdicion && (
              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Motivo del cambio (opcional)</span>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por qué se actualizó esta persona"
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </label>
            )}

            <button
              type="submit"
              disabled={guardando || nombre.trim() === ''}
              className={`mt-1 ${BTN_PRIMARIO} min-h-11 disabled:opacity-50`}
            >
              <FloppyDisk size={15} aria-hidden />
              {guardando ? 'Guardando...' : 'Guardar persona'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
