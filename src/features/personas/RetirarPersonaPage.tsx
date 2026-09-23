import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Cargando } from '../../components/Cargando'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import { CaretRight, CheckCircle, Monitor, Warning } from '../../components/iconos'
import { BTN_PRIMARIO_PELIGRO, TituloSeccion } from '../../components/nocturne'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { db, type Dispositivo } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { equiposActuales, esFechaValida, estaActiva, fechaDeHoy, fechaLegible } from './cicloPersona'
import { DecisionSobreEquipo } from './DecisionEquipo'
import { aDecision, eleccionInicial, type Eleccion } from './eleccionEquipo'
import { retirarPersona, type DecisionEquipo } from './operaciones'

// RETIRAR PERSONA (tarea 266, sección 4 del encargo del 2026-09-23).
//
// Es el camino normal cuando alguien renuncia, termina contrato o es
// despedido. No borra nada: la persona pasa a "Retirada" con su fecha y
// su motivo, conserva su ficha y su historial, y cada equipo que tenía
// se resuelve uno por uno (dejarlo sin responsable, pasarlo a otra
// persona o darlo de baja). Nunca se decide por el técnico: cada equipo
// empieza en la opción más prudente y se confirma todo junto.
//
// Motivos sugeridos, sin obligar: son los tres casos del encargo, y el
// campo sigue siendo texto libre. Nada de datos de Recursos Humanos.
const MOTIVOS_SUGERIDOS = ['Renuncia', 'Fin de contrato', 'Despido']

export function RetirarPersonaPage() {
  const { personaId = '' } = useParams()
  const navigate = useNavigate()

  const persona = useLiveQuery(async () => (await db.personas.get(personaId)) ?? null, [personaId])
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], undefined)
  const personas = useLiveQuery(() => db.personas.toArray(), [], [])

  const [fechaRetiro, setFechaRetiro] = useState(() => fechaDeHoy())
  const [motivoRetiro, setMotivoRetiro] = useState('')
  const [elecciones, setElecciones] = useState<Record<string, Eleccion>>({})
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ bajasPendientes: Dispositivo[] } | null>(null)

  const equipos = useMemo(() => equiposActuales(personaId, dispositivos ?? []), [personaId, dispositivos])
  const otrasActivas = useMemo(
    () =>
      personas
        .filter((p) => p.id !== personaId && !p.eliminadoEn && estaActiva(p))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [personas, personaId],
  )

  if (persona === null || persona?.eliminadoEn) return <Navigate to="/personas" replace />
  if (!persona || dispositivos === undefined) return <Cargando />

  // Ya retirada (por ejemplo, desde otro teléfono): no hay nada que hacer
  // aquí, la ficha lo dice. Mientras se guarda el propio retiro, la
  // persona pasa a retirada ANTES de que llegue el resultado: sin
  // `guardando`, esa pasada intermedia saltaría a la ficha y se perdería
  // la lista de bajas por completar.
  if (!estaActiva(persona) && !resultado && !guardando) return <Navigate to={`/personas/${personaId}`} replace />

  const eleccionDe = (d: Dispositivo) => elecciones[d.id] ?? eleccionInicial(d)
  const decisiones = equipos.map((d) => aDecision(d.id, eleccionDe(d)))
  const faltaElegir = decisiones.some((d) => d === null)
  const fechaValida = esFechaValida(fechaRetiro)
  const listo = fechaValida && !faltaElegir

  async function confirmar() {
    if (!listo || !persona) return
    setGuardando(true)
    const { bajasPendientes } = await retirarPersona(
      personaId,
      { fechaRetiro, motivoRetiro },
      decisiones.filter((d): d is DecisionEquipo => d !== null),
    )
    setGuardando(false)
    if (bajasPendientes.length === 0) {
      navigate(`/personas/${personaId}`, { replace: true })
      return
    }
    setResultado({ bajasPendientes: equipos.filter((d) => bajasPendientes.includes(d.id)) })
  }

  // Tras confirmar, si algún equipo marcado para baja tiene conexiones o
  // datos que resolver, se dice aquí y se ofrece su pantalla de baja.
  if (resultado) {
    const origenFicha = conOrigen(`/personas/${personaId}`, persona.nombre)
    return (
      <Chasis
        modo="tarea"
        rotulo="Retiro registrado"
        titulo={persona.nombre}
        salidaA={`/personas/${personaId}`}
        vuelta="Su ficha"
      >
        <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-[18px]">
          <p className="flex items-start gap-2 rounded-md border border-noct-exito/35 bg-noct-exito/[.08] px-3 py-2.5 text-[13px] leading-[1.5] text-noct-exito">
            <CheckCircle size={16} className="mt-px shrink-0" aria-hidden />
            {persona.nombre} quedó retirada y ya no tiene equipos a su nombre.
          </p>
          <section className="flex flex-col gap-2">
            <TituloSeccion>Falta completar la baja</TituloSeccion>
            <p className="text-[12.5px] leading-[1.5] text-noct-neutral-400">
              Estos equipos tienen conexiones, credenciales o datos protegidos. Quedaron sin responsable; la baja se
              termina en su pantalla, donde se resuelve cada uno.
            </p>
            {resultado.bajasPendientes.map((d) => (
              <Link
                key={d.id}
                to={`/dispositivos/${d.id}/baja`}
                state={origenFicha}
                className="flex min-h-12 items-center gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-3 text-[13.5px] text-noct-text hover:bg-noct-text/[.04]"
              >
                <Monitor size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{d.nombre}</span>
                <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300">Dar de baja</span>
                <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
              </Link>
            ))}
          </section>
        </main>
      </Chasis>
    )
  }

  return (
    // Nivel 3 del chasis (tarea 185): tarea con salida, vuelve a la ficha.
    <Chasis
      modo="tarea"
      rotulo="Retirando"
      titulo={persona.nombre}
      salidaA={`/personas/${personaId}`}
      // "Su ficha" y no el nombre: el nombre ya es el título de la barra.
      vuelta="Su ficha"
      salidaEtiqueta="Salir sin retirar"
      barra={
        <p className="px-4 pb-2.5 text-[12px] leading-[1.5] text-noct-neutral-500">
          La ficha y su historial se conservan. Decide qué pasa con cada equipo que tiene hoy.
        </p>
      }
    >
      <main className="flex flex-1 flex-col gap-5 px-4 pb-12 pt-[18px]">
        <section className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Fecha de retiro</span>
            <input
              type="date"
              value={fechaRetiro}
              onChange={(e) => setFechaRetiro(e.target.value)}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
            {!fechaValida && <span className="text-[12px] text-noct-precaucion">Falta la fecha de retiro.</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Motivo (opcional)</span>
            <input
              type="text"
              value={motivoRetiro}
              onChange={(e) => setMotivoRetiro(e.target.value)}
              placeholder="Renuncia, fin de contrato…"
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_SUGERIDOS.map((motivo) => (
              <button
                key={motivo}
                type="button"
                aria-pressed={motivoRetiro === motivo}
                onClick={() => setMotivoRetiro(motivo)}
                className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] transition-colors ${
                  motivoRetiro === motivo
                    ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                    : 'border-noct-divider text-noct-neutral-400 hover:bg-noct-text/[.05]'
                }`}
              >
                {motivo}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <TituloSeccion>
            {equipos.length === 0 ? 'Equipos' : `Sus equipos (${equipos.length})`}
          </TituloSeccion>
          {equipos.length === 0 ? (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-3.5 text-center text-[12.5px] text-noct-neutral-500">
              No tiene equipos a su nombre. Solo cambia su estado.
            </p>
          ) : (
            equipos.map((d) => (
              <div key={d.id} className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3">
                <div className="flex items-center gap-2.5">
                  <Monitor size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{d.nombre}</span>
                    {d.placaInventario && (
                      <span className="block text-[12px] text-noct-neutral-500">Placa {d.placaInventario}</span>
                    )}
                  </span>
                  {d.estado && <PastillaEstadoDispositivo estado={d.estado} />}
                </div>
                <DecisionSobreEquipo
                  dispositivo={d}
                  eleccion={eleccionDe(d)}
                  onCambiar={(eleccion) => setElecciones((actuales) => ({ ...actuales, [d.id]: eleccion }))}
                  personas={otrasActivas}
                />
              </div>
            ))
          )}
        </section>

        <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
          <p className="text-[13px] leading-[1.5] text-noct-neutral-300">
            <strong className="text-noct-text">{persona.nombre}</strong> quedará retirada
            {fechaValida ? ` el ${fechaLegible(fechaRetiro)}` : ''}. No se elimina: se puede reactivar.
          </p>
          {faltaElegir && (
            <p className="flex items-center gap-1.5 text-[12px] text-noct-precaucion">
              <Warning size={13} className="shrink-0" aria-hidden />
              Falta elegir a quién pasa algún equipo.
            </p>
          )}
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={!listo || guardando}
            className={`${BTN_PRIMARIO_PELIGRO} min-h-11 self-start px-4 disabled:opacity-50`}
          >
            {guardando ? 'Retirando…' : 'Confirmar retiro'}
          </button>
        </div>
      </main>
    </Chasis>
  )
}
