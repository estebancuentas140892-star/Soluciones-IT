import { useId, type ReactNode } from 'react'
import { CLASE_CAMPO } from '../../components/campos'
import { Check } from '../../components/iconos'
import type { Dispositivo, Persona } from '../../lib/db'
import { sugerirDisponible } from './cicloPersona'
import type { Eleccion } from './eleccionEquipo'

// "¿QUÉ PASA CON ESTE EQUIPO?" (tarea 266, sección 4 del encargo).
//
// La misma pregunta aparece al retirar a una persona (una por equipo) y
// al liberar un equipo desde su ficha, así que vive en un solo control.
// Tres respuestas, las del encargo:
//
//   - Dejar disponible: sin responsable. "Marcar como Disponible" solo
//     viene marcado si el equipo funcionaba; si su estado no lo dice, se
//     ofrece sin marcar, y si está en mantenimiento o fuera de servicio
//     no se ofrece (ver `sugerirDisponible`).
//   - Asignar a otra persona: solo personas activas.
//   - Dar de baja: el flujo de baja existente (el que obliga a resolver
//     conexiones, credenciales y datos protegidos).

const OPCION =
  'flex min-h-11 w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13.5px] transition-colors'
const OPCION_ACTIVA = 'border-noct-accent bg-noct-accent/[.12] text-noct-text'
const OPCION_INACTIVA = 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'

// Fuera del componente a propósito: declarada dentro, cada render
// crearía un tipo nuevo y React remontaría el botón (se pierde el foco).
function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={`${OPCION} ${activa ? OPCION_ACTIVA : OPCION_INACTIVA}`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          activa ? 'border-noct-accent' : 'border-noct-neutral-600'
        }`}
      >
        {activa && <span className="h-2 w-2 rounded-full bg-noct-accent" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

export function DecisionSobreEquipo({
  dispositivo,
  eleccion,
  onCambiar,
  personas,
  permitirBaja = true,
}: {
  dispositivo: Pick<Dispositivo, 'id' | 'nombre' | 'estado'>
  eleccion: Eleccion
  onCambiar: (eleccion: Eleccion) => void
  /** Personas a las que se puede pasar el equipo: activas y sin la que lo suelta. */
  personas: Pick<Persona, 'id' | 'nombre'>[]
  permitirBaja?: boolean
}) {
  const idGrupo = useId()
  const sugerencia = sugerirDisponible(dispositivo.estado)

  return (
    <div role="radiogroup" aria-label={`Qué pasa con ${dispositivo.nombre}`} className="flex flex-col gap-1.5">
      <Opcion
        activa={eleccion.tipo === 'liberar'}
        onClick={() => onCambiar({ tipo: 'liberar', marcarDisponible: sugerencia === 'si' })}
      >
        Dejar sin responsable
      </Opcion>
      {eleccion.tipo === 'liberar' && sugerencia !== 'no' && (
        // Casilla con la misma forma que las de las guías (botón con
        // role="checkbox"): la app no usa la casilla nativa del navegador.
        <button
          type="button"
          role="checkbox"
          aria-checked={eleccion.marcarDisponible}
          onClick={() => onCambiar({ tipo: 'liberar', marcarDisponible: !eleccion.marcarDisponible })}
          className="ml-[26px] flex min-h-11 items-center gap-2.5 text-left text-[13px] text-noct-neutral-300"
        >
          {eleccion.marcarDisponible ? (
            <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-noct-accent">
              <Check size={13} className="text-noct-bg" />
            </span>
          ) : (
            <span aria-hidden className="h-5 w-5 shrink-0 rounded-md border-[1.5px] border-noct-neutral-600" />
          )}
          <span>
            Marcar como <strong className="font-medium text-noct-text">Disponible</strong>
            {sugerencia === 'preguntar' && (
              <span className="block text-[12px] text-noct-neutral-500">
                Su estado no dice si funciona: márcalo solo si se puede entregar.
              </span>
            )}
          </span>
        </button>
      )}
      {eleccion.tipo === 'liberar' && sugerencia === 'no' && (
        <p className="ml-[26px] text-[12px] text-noct-neutral-500">
          Conserva su estado ({dispositivo.estado}): no se puede entregar todavía.
        </p>
      )}

      <Opcion
        activa={eleccion.tipo === 'reasignar'}
        onClick={() => onCambiar({ tipo: 'reasignar', personaId: eleccion.tipo === 'reasignar' ? eleccion.personaId : '' })}
      >
        Asignar a otra persona
      </Opcion>
      {eleccion.tipo === 'reasignar' && (
        <div className="ml-[26px] flex flex-col gap-1">
          <label htmlFor={`${idGrupo}-persona`} className="sr-only">
            Persona que recibe {dispositivo.nombre}
          </label>
          <select
            id={`${idGrupo}-persona`}
            value={eleccion.personaId}
            onChange={(e) => onCambiar({ tipo: 'reasignar', personaId: e.target.value })}
            className={`min-h-11 ${CLASE_CAMPO}`}
          >
            <option value="">Elegir persona…</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {personas.length === 0 && (
            <p className="text-[12px] text-noct-neutral-500">No hay otras personas activas.</p>
          )}
        </div>
      )}

      {permitirBaja && (
        <Opcion activa={eleccion.tipo === 'baja'} onClick={() => onCambiar({ tipo: 'baja' })}>
          Dar de baja
        </Opcion>
      )}
      {eleccion.tipo === 'baja' && (
        <p className="ml-[26px] text-[12px] leading-[1.5] text-noct-neutral-500">
          Queda "De baja" y sin responsable. Si tiene conexiones, credenciales o datos protegidos, la baja se
          completa en su pantalla, donde se resuelve cada uno.
        </p>
      )}
    </div>
  )
}
