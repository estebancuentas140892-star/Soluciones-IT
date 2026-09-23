import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { FloppyDisk } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { esFechaValida, estadoDePersona } from './cicloPersona'

import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'

// Crear o editar una persona (hallazgo T1 de AUDITORIA_FLUJOS_TI.md):
// nombre y notas, sin jerarquía (no aplica a personas, a diferencia de
// ubicaciones). Trae su propio shell Nocturne, por eso sale del Layout
// oscuro.
//
// Desde la tarea 266 suma la fecha de ingreso (opcional: solo la que
// alguien sabe, nunca se rellena sola) y, en una persona retirada, la
// fecha y el motivo del retiro para poder corregirlos. El estado no se
// cambia aquí: retirar y reactivar son acciones de la ficha, porque
// retirar decide además qué pasa con cada equipo. Al editar se conserva
// todo lo que el formulario no toca.
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
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [fechaRetiro, setFechaRetiro] = useState('')
  const [motivoRetiro, setMotivoRetiro] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!persona || cargadoInicial) return
    setNombre(persona.nombre)
    setNotas(persona.notas)
    setFechaIngreso(persona.fechaIngreso ?? '')
    setFechaRetiro(persona.fechaRetiro ?? '')
    setMotivoRetiro(persona.motivoRetiro ?? '')
    setCargadoInicial(true)
  }, [persona, cargadoInicial])

  if (esEdicion && persona === null) return <Navigate to="/personas" replace />

  const retirada = Boolean(persona) && estadoDePersona(persona as NonNullable<typeof persona>) === 'retirada'
  const ingresoInvalido = fechaIngreso !== '' && !esFechaValida(fechaIngreso)
  const retiroInvalido = retirada && fechaRetiro !== '' && !esFechaValida(fechaRetiro)
  const valido = nombre.trim() !== '' && !ingresoInvalido && !retiroInvalido

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (!valido) return
    setGuardando(true)
    const base = persona ?? {
      estado: 'activa' as const,
      fechaRetiro: null,
      motivoRetiro: '',
    }
    await guardarRegistro(
      'personas',
      {
        ...base,
        id,
        nombre: nombre.trim(),
        notas: notas.trim(),
        fechaIngreso: fechaIngreso || null,
        ...(retirada ? { fechaRetiro: fechaRetiro || null, motivoRetiro: motivoRetiro.trim() } : {}),
      },
      motivo.trim(),
    )
    navigate(`/personas/${id}`)
  }

  return (
    // Nivel 3 del chasis (tarea 185): tarea con salida.
    <Chasis
      modo="tarea"
      rotulo={esEdicion ? 'Editando' : 'Creando'}
      titulo={nombre.trim() || (esEdicion ? 'Editar persona' : 'Nueva persona')}
      salidaEtiqueta="Cancelar y volver"
      barra={
        <p className="px-4 pb-2.5 text-[12px] text-noct-neutral-500">
          Quién tiene asignados los equipos
        </p>
      }
    >
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
            <span className={CLASE_ETIQUETA}>Fecha de ingreso (opcional)</span>
            <input
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
            <span className="text-[12px] text-noct-neutral-500">
              Solo si se sabe. Una fecha futura indica que todavía no ha llegado.
            </span>
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

          {retirada && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Fecha de retiro</span>
                <input
                  type="date"
                  value={fechaRetiro}
                  onChange={(e) => setFechaRetiro(e.target.value)}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Motivo del retiro (opcional)</span>
                <input
                  type="text"
                  value={motivoRetiro}
                  onChange={(e) => setMotivoRetiro(e.target.value)}
                  placeholder="Renuncia, fin de contrato…"
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </label>
            </>
          )}

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
            disabled={guardando || !valido}
            className={`mt-1 ${BTN_PRIMARIO} min-h-11 disabled:opacity-50`}
          >
            <FloppyDisk size={15} aria-hidden />
            {guardando ? 'Guardando...' : 'Guardar persona'}
          </button>
        </form>
      )}
    </Chasis>
  )
}
