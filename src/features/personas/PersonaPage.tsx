import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import {
  BookOpen,
  CaretRight,
  CheckCircle,
  Monitor,
  PencilSimple,
  Plus,
  TrashSimple,
  Warning,
  XCircle,
} from '../../components/iconos'
import {
  BTN_GHOST_PELIGRO,
  BTN_GHOST_TENUE,
  BTN_PRIMARIO,
  BTN_SECUNDARIO,
  TituloSeccion,
} from '../../components/nocturne'
import { PastillaEstado, PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { db, type Dispositivo } from '../../lib/db'
import { anotarBusqueda, conOrigen } from '../../lib/origenNavegacion'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'
import { equiposActuales, estaActiva, estadoDePersona, fechaLegible } from './cicloPersona'
import { BUSQUEDA_GUIA_CONFIGURACION, guiaDeConfiguracion } from './guiaDeConfiguracion'
import { HojaLiberarEquipo } from './HojaLiberarEquipo'
import {
  asignadoDesde,
  CAMPO_ASIGNACION,
  equiposAnteriores,
  periodosDeAsignacion,
  type PeriodoAsignacion,
} from './historialAsignaciones'
import { reactivarPersona } from './operaciones'

// FICHA DE UNA PERSONA (hallazgo T1; ciclo de vida desde la tarea 266,
// sección 6 del encargo del 2026-09-23). Responde, en este orden:
//
//   - ¿Sigue en la organización? Estado Activa / Retirada, con las fechas
//     que alguien anotó (nunca deducidas).
//   - ¿Qué equipo tiene hoy? Uno o varios, con placa y lugar, y desde
//     cuándo si el historial lo dice. De aquí sale "Configurar el
//     computador" (la guía maestra, sin copiarla) y "Liberar".
//   - ¿Qué equipos tuvo? Solo lo que consta en el historial, con sus
//     fechas o "hasta …" cuando el comienzo es anterior a los registros.
//
// "Retirar persona" es el camino normal de una salida; "Eliminar" queda
// para un registro creado por error o duplicado, y lo dice.
export function PersonaPage() {
  const { personaId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Recién asignado desde "Asignar equipo": la ficha lo confirma y
  // ofrece el siguiente paso (configurarlo). Se lee UNA vez al montar,
  // como el "Qué sigue" de la ficha de un equipo.
  const [recienAsignado] = useState(
    () => (location.state as { recienAsignado?: string } | null)?.recienAsignado ?? null,
  )
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [liberando, setLiberando] = useState<Dispositivo | null>(null)
  const [reactivando, setReactivando] = useState(false)

  // `?? null`: undefined es "cargando" y null "no existe" (antes una
  // dirección de una persona que no está se quedaba en "Cargando...").
  const persona = useLiveQuery(async () => (await db.personas.get(personaId)) ?? null, [personaId])
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  const personas = useLiveQuery(() => db.personas.toArray(), [], [])
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  // Solo las entradas de asignación (el id del responsable, tarea 266):
  // de ahí salen el "desde" del equipo actual y los equipos anteriores.
  const entradasAsignacion = useLiveQuery(
    () => db.historial.filter((e) => e.entidadTipo === 'dispositivo' && e.campo === CAMPO_ASIGNACION).toArray(),
    [],
    [],
  )

  const porId = useMemo(() => new Map(dispositivos.map((d) => [d.id, d])), [dispositivos])
  const ubicacionPorId = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u])), [ubicaciones])
  const actuales = useMemo(() => equiposActuales(personaId, dispositivos), [personaId, dispositivos])
  const periodos = useMemo(() => periodosDeAsignacion(entradasAsignacion), [entradasAsignacion])
  const anteriores = useMemo(() => equiposAnteriores(personaId, periodos), [personaId, periodos])
  const otrasActivas = useMemo(
    () =>
      personas
        .filter((p) => p.id !== personaId && !p.eliminadoEn && estaActiva(p))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [personas, personaId],
  )
  const guia = useMemo(() => guiaDeConfiguracion(articulos), [articulos])

  if (persona === null || persona?.eliminadoEn) return <Navigate to="/personas" replace />
  if (!persona) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  const activa = estadoDePersona(persona) === 'activa'
  const origenEstaFicha = conOrigen(`/personas/${personaId}`, persona.nombre)
  const equipoRecienAsignado = recienAsignado ? actuales.find((d) => d.id === recienAsignado) : undefined

  function lugarDe(d: Dispositivo): string {
    const vivo = d.ubicacionId ? ubicacionPorId.get(d.ubicacionId) : undefined
    return vivo && !vivo.eliminadoEn ? vivo.nombre : d.ubicacion
  }

  async function eliminar() {
    await eliminarRegistro('personas', personaId)
    navigate('/personas')
  }

  async function reactivar() {
    setReactivando(true)
    await reactivarPersona(personaId)
    setReactivando(false)
  }

  function buscarGuia() {
    navigate('/', { state: anotarBusqueda(null, { consulta: BUSQUEDA_GUIA_CONFIGURACION, capa: false }) })
  }

  const lineaFechas = [
    persona.fechaIngreso && `Ingresó el ${fechaLegible(persona.fechaIngreso)}`,
    !activa && persona.fechaRetiro && `Se retiró el ${fechaLegible(persona.fechaRetiro)}`,
    !activa && persona.motivoRetiro,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    // Nivel 2 del chasis (tarea 185): documento.
    <Chasis
      modo="documento"
      volverA="/personas"
      volverEtiqueta="Personas"
      // Ancla permanente (M-001, M-R1, mockup `6b`): se llega desde
      // "Responsable" en la ficha de un equipo, así que el nombre se
      // queda arriba en vez de irse con el scroll.
      titulo={persona.nombre}
      contexto="Personas"
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 min-w-0 text-[19px] font-medium leading-[1.25]">{persona.nombre}</p>
            <PastillaEstado tono={activa ? 'exito' : 'neutro'}>{activa ? 'Activa' : 'Retirada'}</PastillaEstado>
          </div>
          {lineaFechas && <p className="mt-1 text-[12.5px] text-noct-neutral-400">{lineaFechas}</p>}
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-12 pt-3.5">
        <div className="flex flex-wrap gap-2">
          {activa ? (
            <Link to={`/personas/${personaId}/asignar`} className={`min-h-11 shrink-0 ${BTN_PRIMARIO}`}>
              <Plus size={14} aria-hidden />
              Asignar equipo
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void reactivar()}
              disabled={reactivando}
              className={`min-h-11 shrink-0 ${BTN_PRIMARIO} disabled:opacity-50`}
            >
              {reactivando ? 'Reactivando…' : 'Reactivar'}
            </button>
          )}
          <Link to={`/personas/${personaId}/editar`} className={`min-h-11 shrink-0 ${BTN_SECUNDARIO}`}>
            <PencilSimple size={14} aria-hidden />
            Editar
          </Link>
          {activa && (
            <Link to={`/personas/${personaId}/retirar`} className={`min-h-11 shrink-0 ${BTN_GHOST_PELIGRO}`}>
              <XCircle size={14} aria-hidden />
              Retirar persona
            </Link>
          )}
        </div>

        {equipoRecienAsignado && (
          <p className="flex items-start gap-2 rounded-md border border-noct-exito/35 bg-noct-exito/[.08] px-3 py-2.5 text-[13px] leading-[1.5] text-noct-exito">
            <CheckCircle size={16} className="mt-px shrink-0" aria-hidden />
            {equipoRecienAsignado.nombre} quedó asignado. Siguiente paso: configurarlo para {persona.nombre}.
          </p>
        )}

        {persona.notas && (
          <section>
            <TituloSeccion className="mb-1.5">Notas</TituloSeccion>
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] text-noct-neutral-300">{persona.notas}</p>
          </section>
        )}

        <section>
          <TituloSeccion className="mb-1.5">{actuales.length > 1 ? 'Equipos actuales' : 'Equipo actual'}</TituloSeccion>
          {!activa && actuales.length > 0 && (
            <p className="mb-2 flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-noct-precaucion">
              <Warning size={14} className="mt-px shrink-0" aria-hidden />
              Está retirada y aún tiene {actuales.length === 1 ? 'un equipo' : `${actuales.length} equipos`} a su
              nombre. Libéralos o pásalos a otra persona.
            </p>
          )}
          {actuales.length === 0 ? (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-3.5 text-center text-[12.5px] text-noct-neutral-500">
              {activa ? 'No tiene ningún equipo asignado.' : 'No tiene equipos a su nombre.'}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-noct-divider overflow-hidden rounded-lg border border-noct-divider bg-noct-surface">
              {actuales.map((d) => {
                const desde = asignadoDesde(personaId, d.id, periodos)
                const detalle = [
                  d.placaInventario && `Placa ${d.placaInventario}`,
                  lugarDe(d),
                  desde && `Desde el ${fechaLegible(desde)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div key={d.id} className="flex items-center gap-1 pr-1.5">
                    <Link
                      to={`/dispositivos/${d.id}`}
                      state={origenEstaFicha}
                      className="flex min-h-[56px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-noct-text hover:bg-noct-text/[.04]"
                    >
                      <Monitor size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{d.nombre}</span>
                        {detalle && <span className="block text-[12px] leading-[1.4] text-noct-neutral-500">{detalle}</span>}
                      </span>
                      {d.estado && <PastillaEstadoDispositivo estado={d.estado} />}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setLiberando(d)}
                      aria-label={`Liberar ${d.nombre}`}
                      className={`shrink-0 ${BTN_GHOST_TENUE} min-h-11`}
                    >
                      Liberar
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* "Configurar el computador para esta persona": abre la guía
              maestra que el equipo ya escribió (no se copia aquí). Solo
              tiene sentido con un equipo a su nombre. */}
          {activa && actuales.length > 0 &&
            (guia ? (
              <Link
                to={`/soluciones/${guia.categoriaId}/${guia.id}`}
                state={origenEstaFicha}
                className="mt-2 flex min-h-12 items-center gap-2.5 rounded-md border border-noct-divider px-3 text-[13.5px] text-noct-accent-300 hover:bg-noct-text/[.04]"
              >
                <BookOpen size={16} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">Configurar el computador para {persona.nombre}</span>
                  <span className="block truncate text-[12px] text-noct-neutral-500">{guia.titulo}</span>
                </span>
                <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
              </Link>
            ) : (
              <button
                type="button"
                onClick={buscarGuia}
                className="mt-2 flex min-h-12 w-full items-center gap-2.5 rounded-md border border-dashed border-noct-neutral-700 px-3 text-left text-[13px] text-noct-neutral-300 hover:bg-noct-text/[.04]"
              >
                <BookOpen size={16} className="shrink-0 text-noct-neutral-500" aria-hidden />
                <span className="min-w-0 flex-1">Buscar la guía de configuración de usuario nuevo</span>
                <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
              </button>
            ))}
        </section>

        {anteriores.length > 0 && (
          <section>
            <TituloSeccion className="mb-1.5">Equipos anteriores</TituloSeccion>
            <div className="flex flex-col">
              {anteriores.map((p) => (
                <FilaEquipoAnterior key={`${p.dispositivoId}:${p.hasta}`} periodo={p} dispositivo={porId.get(p.dispositivoId)} origen={origenEstaFicha} />
              ))}
            </div>
          </section>
        )}

        <Historial entidadTipo="persona" entidadId={personaId} />

        {/* Eliminar, al final y sin peso: la salida normal es "Retirar". */}
        <div className="border-t border-noct-divider pt-3">
          <button type="button" onClick={() => setMostrarEliminar(true)} className={`${BTN_GHOST_TENUE} min-h-11`}>
            <TrashSimple size={14} aria-hidden />
            Eliminar (registro creado por error)
          </button>
        </div>
      </main>

      <HojaLiberarEquipo
        dispositivo={liberando}
        persona={persona}
        otrasPersonas={otrasActivas}
        onCerrar={() => setLiberando(null)}
      />

      <DialogoEliminar
        abierto={mostrarEliminar}
        titulo={`¿Eliminar a "${persona.nombre}"?`}
        descripcion={
          activa
            ? 'Eliminar es solo para un registro creado por error o duplicado. Si la persona dejó la organización, usa "Retirar persona": conserva su ficha y su historial.'
            : 'Eliminar es solo para un registro creado por error o duplicado. Una persona retirada ya conserva su ficha y su historial sin eliminarla.'
        }
        advertencia={
          actuales.length > 0
            ? `${actuales.length} ${actuales.length === 1 ? 'equipo quedará' : 'equipos quedarán'} sin este vínculo.`
            : null
        }
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}

function FilaEquipoAnterior({
  periodo,
  dispositivo,
  origen,
}: {
  periodo: PeriodoAsignacion
  dispositivo: Dispositivo | undefined
  origen: ReturnType<typeof conOrigen>
}) {
  // Las fechas son las del historial, sin completar ninguna: si el
  // comienzo es anterior a los registros, solo se dice cuándo terminó.
  const fechas = periodo.desde
    ? `${fechaLegible(periodo.desde)} → ${fechaLegible(periodo.hasta as string)}`
    : `Hasta el ${fechaLegible(periodo.hasta as string)}`
  const nombre = dispositivo?.nombre ?? 'Equipo sin ficha'
  const contenido = (
    <>
      <Monitor size={16} className="shrink-0 text-noct-neutral-500" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{nombre}</span>
        <span className="block text-[12px] leading-[1.4] text-noct-neutral-500">{fechas}</span>
        {periodo.motivoFin && (
          <span className="block text-[12px] leading-[1.4] text-noct-neutral-500">{periodo.motivoFin}</span>
        )}
      </span>
      {dispositivo?.eliminadoEn ? (
        <PastillaEstado tono="neutro">Eliminado</PastillaEstado>
      ) : (
        dispositivo?.estado && <PastillaEstadoDispositivo estado={dispositivo.estado} />
      )}
    </>
  )
  if (!dispositivo || dispositivo.eliminadoEn) {
    return <div className="flex min-h-[52px] items-center gap-2.5 px-1.5 py-2 text-noct-neutral-300">{contenido}</div>
  }
  return (
    <Link
      to={`/dispositivos/${dispositivo.id}`}
      state={origen}
      className="flex min-h-[52px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
    >
      {contenido}
    </Link>
  )
}
