import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boton } from '../../components/Boton'
import { Hoja } from '../../components/Hoja'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import type { Dispositivo, Persona } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { DecisionSobreEquipo } from './DecisionEquipo'
import { aDecision, eleccionInicial, type Eleccion } from './eleccionEquipo'
import { asignarEquipo, liberarEquipo } from './operaciones'

// LIBERAR UN EQUIPO DESDE LA FICHA DE LA PERSONA (tarea 266).
//
// La misma decisión que el retiro, para UN equipo y sin retirar a nadie:
// alguien devuelve su portátil, cambia de puesto o se le avería el
// computador. "Dar de baja" no se resuelve aquí: lleva a la pantalla de
// baja de siempre (que obliga a resolver conexiones, credenciales y
// datos protegidos) y, desde la tarea 266, también suelta al responsable.
export function HojaLiberarEquipo({
  dispositivo,
  persona,
  otrasPersonas,
  onCerrar,
  desdeElEquipo = false,
}: {
  dispositivo: Dispositivo | null
  persona: Pick<Persona, 'id' | 'nombre'>
  otrasPersonas: Pick<Persona, 'id' | 'nombre'>[]
  onCerrar: () => void
  /**
   * Abierta desde la ficha del equipo (y no desde la de la persona): la
   * pantalla de baja vuelve a su padre de siempre, el equipo, en vez de
   * a la persona.
   */
  desdeElEquipo?: boolean
}) {
  const navigate = useNavigate()
  const [eleccion, setEleccion] = useState<Eleccion | null>(null)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  if (!dispositivo) return null
  const actual = eleccion ?? eleccionInicial(dispositivo)
  const decision = aDecision(dispositivo.id, actual)

  function cerrar() {
    setEleccion(null)
    setMotivo('')
    onCerrar()
  }

  async function confirmar() {
    if (!dispositivo || !decision) return
    if (decision.tipo === 'baja') {
      cerrar()
      navigate(`/dispositivos/${dispositivo.id}/baja`, {
        state: desdeElEquipo ? undefined : conOrigen(`/personas/${persona.id}`, persona.nombre),
      })
      return
    }
    setGuardando(true)
    const texto = motivo.trim()
    if (decision.tipo === 'liberar') {
      await liberarEquipo(dispositivo.id, { marcarDisponible: decision.marcarDisponible, motivo: texto })
    } else {
      await asignarEquipo(dispositivo.id, decision.personaId, texto)
    }
    setGuardando(false)
    cerrar()
  }

  return (
    <Hoja
      abierta
      onCerrar={cerrar}
      titulo={`¿Qué pasa con ${dispositivo.nombre}?`}
      descripcion={`${persona.nombre} deja de tenerlo. Su paso por este equipo queda en el historial.`}
      pie={
        <Boton
          papel="principal"
          tamano={52}
          anchoCompleto
          onClick={() => void confirmar()}
          disabled={!decision}
          cargando={guardando}
          textoCargando="Guardando…"
        >
          {actual.tipo === 'baja' ? 'Ir a dar de baja' : 'Confirmar'}
        </Boton>
      }
    >
      <div className="flex flex-col gap-3.5">
        <DecisionSobreEquipo dispositivo={dispositivo} eleccion={actual} onCambiar={setEleccion} personas={otrasPersonas} />
        {actual.tipo !== 'baja' && (
          <label className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Motivo (opcional)</span>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Devolución, cambio de puesto…"
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </label>
        )}
      </div>
    </Hoja>
  )
}
