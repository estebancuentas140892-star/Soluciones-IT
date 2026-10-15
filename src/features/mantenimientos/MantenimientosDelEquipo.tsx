import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { HojaInferior } from '../../components/HojaInferior'
import { Check, ClockCountdown, ClockCounterClockwise, Note, Plus, SealCheck, User, Wrench } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { useEsAncho } from '../../components/useEsAncho'
import { db, type Mantenimiento, type TipoMantenimiento } from '../../lib/db'
import { esPorValidar, fechaConAnio, nombreMantenimiento } from '../../lib/mantenimientos'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { diasDeCalendario } from '../../lib/vencimiento'
import { entraEnAgenda, errorDeProgramacion, hoyIso, textoProgramado } from './mantenimiento'
import { RegistrarDesenlace } from './MantenimientoPage'
import { SelectorTipoMantenimiento } from './SelectorTipoMantenimiento'

// EL MANTENIMIENTO DE UN EQUIPO, EN SU PANTALLA (rediseño móvil "1b
// Pulgar", tarea 331, AD-081; hasta entonces, un pliegue dentro de "Más del
// equipo", tarea 320).
//
// Tres formas que no se confunden aunque no se lea el rótulo:
//
//   Programado         tarjeta sobre superficie, con cuándo toca y
//                      "Cerrar mantenimiento", que abre su hoja.
//   Realizado y confirmado
//                      superficie sólida con barra verde, qué se hizo,
//                      quién y si está en el historial.
//   Documentado, por validar
//                      borde punteado y sin relleno, "Según {fuente}" y
//                      la pastilla "Por validar": no es trabajo pendiente
//                      ni hecho, es lo que dice una fuente histórica.
//
// Sin ninguno, un estado vacío que dice qué aparecerá. Programar va abajo,
// delineado (no hace avanzar nada: la acción rellena es la del cierre); desde
// 768 px, en la cabecera de la pantalla (tarea 339).

function porFechaProgramada(a: Mantenimiento, b: Mantenimiento): number {
  return (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? '')
}

function porFechaRealizadaDesc(a: Mantenimiento, b: Mantenimiento): number {
  return (b.fechaRealizada ?? '').localeCompare(a.fechaRealizada ?? '')
}

export function MantenimientosDelEquipo({
  dispositivoId,
  nombreEquipo,
  programando,
  onProgramar,
}: {
  dispositivoId: string
  /** El nombre del equipo, para el contexto de las hojas. */
  nombreEquipo: string
  /**
   * La hoja "Programar mantenimiento" abierta. La guarda la pantalla
   * (tarea 339): desde 768 px su botón va en la cabecera del chasis, fuera
   * de este componente, y abre esta misma hoja.
   */
  programando: boolean
  onProgramar: (abierta: boolean) => void
}) {
  // "Programar mantenimiento" va abajo, en su barra, solo en el teléfono;
  // desde 768 px la pantalla lo pone en la cabecera (tarea 339).
  const ancho = useEsAncho()
  const mantenimientos = useLiveQuery(
    () =>
      db.mantenimientos
        .where('dispositivoId')
        .equals(dispositivoId)
        .filter((m) => !m.eliminadoEn)
        .toArray(),
    [dispositivoId],
  )
  const [cerrando, setCerrando] = useState<Mantenimiento | null>(null)

  if (!mantenimientos) return null
  const abiertos = mantenimientos.filter(entraEnAgenda).sort(porFechaProgramada)
  const realizados = mantenimientos
    .filter((m) => m.estado === 'realizado' && !esPorValidar(m))
    .sort(porFechaRealizadaDesc)
  const antecedentes = mantenimientos.filter(esPorValidar).sort(porFechaProgramada)
  const vacio = abiertos.length === 0 && realizados.length === 0 && antecedentes.length === 0

  return (
    <div className="flex flex-1 flex-col">
      {vacio ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-noct-text/[.06] text-noct-neutral-400">
            <Wrench size={30} aria-hidden />
          </span>
          <h2 className="text-[19px] font-semibold">Sin mantenimientos</h2>
          <p className="max-w-[280px] text-[14.5px] leading-[1.5] text-noct-neutral-400">
            Ni programados, ni realizados, ni antecedentes por validar. Programa el próximo y aparecerá en Atención
            cuando toque.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[26px] pb-4">
          {abiertos.length > 0 && (
            <section aria-labelledby="mant-programado" className="flex flex-col gap-2.5">
              <h2 id="mant-programado" className="flex items-center gap-2 text-[15px] font-semibold">
                <ClockCountdown size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
                Programado
              </h2>
              {abiertos.map((m) => (
                <TarjetaProgramado key={m.id} mantenimiento={m} onCerrar={() => setCerrando(m)} />
              ))}
            </section>
          )}

          {realizados.length > 0 && (
            <section aria-labelledby="mant-realizado" className="flex flex-col gap-2.5">
              <h2 id="mant-realizado" className="flex items-center gap-2 text-[15px] font-semibold">
                <SealCheck size={17} className="shrink-0 text-noct-exito" aria-hidden />
                Realizado y confirmado
              </h2>
              {realizados.map((m) => (
                <TarjetaRealizado key={m.id} mantenimiento={m} />
              ))}
            </section>
          )}

          {antecedentes.length > 0 && (
            <section aria-labelledby="mant-antecedentes" className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-0.5">
                <h2 id="mant-antecedentes" className="flex items-center gap-2 text-[15px] font-semibold">
                  <Note size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
                  Documentado, por validar
                </h2>
                <p className="text-[13px] leading-[1.45] text-noct-neutral-400">
                  Marcas de una fuente histórica. No dicen técnico, resultado ni evidencia: no son mantenimientos
                  hechos ni pendientes.
                </p>
              </div>
              {antecedentes.map((m) => (
                <TarjetaAntecedente key={m.id} mantenimiento={m} />
              ))}
            </section>
          )}
        </div>
      )}

      {/* PROGRAMAR, ABAJO Y DELINEADO: no hace avanzar nada. Solo en el
          teléfono; desde 768 px va en la cabecera (tarea 339). */}
      {!ancho && (
        <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:hidden">
          <button
            type="button"
            onClick={() => onProgramar(true)}
            aria-haspopup="dialog"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-noct-text/25 text-[15.5px] font-semibold text-noct-text hover:bg-noct-text/[.05]"
          >
            <Plus size={17} aria-hidden />
            Programar mantenimiento
          </button>
        </div>
      )}

      <HojaInferior abierta={programando} onCerrar={() => onProgramar(false)} titulo="Programar mantenimiento" contexto={nombreEquipo}>
        <FormularioProgramar dispositivoId={dispositivoId} alTerminar={() => onProgramar(false)} />
      </HojaInferior>

      <HojaInferior
        abierta={cerrando !== null}
        onCerrar={() => setCerrando(null)}
        titulo="Cerrar mantenimiento"
        contexto={cerrando ? `${nombreMantenimiento(cerrando.tipo)} · ${nombreEquipo}` : nombreEquipo}
      >
        {cerrando && <RegistrarDesenlace mantenimiento={cerrando} alTerminar={() => setCerrando(null)} />}
      </HojaInferior>
    </div>
  )
}

/** Un mantenimiento programado (o pospuesto): cuándo toca y su cierre. */
function TarjetaProgramado({ mantenimiento, onCerrar }: { mantenimiento: Mantenimiento; onCerrar: () => void }) {
  const fecha = mantenimiento.fechaProgramada as string
  const restantes = diasDeCalendario(fecha, new Date()) ?? 0
  const razon = textoProgramado(fecha, restantes)
  const ruta = `/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`
  return (
    <div className="overflow-hidden rounded-2xl border border-noct-divider bg-noct-surface">
      <Link to={ruta} className="flex flex-col gap-1.5 p-3.5 text-noct-text hover:bg-noct-text/[.03]">
        <span className="flex items-baseline justify-between gap-2.5">
          <span className="text-[16.5px] font-semibold">{nombreMantenimiento(mantenimiento.tipo)}</span>
          <span className="shrink-0 whitespace-nowrap font-mono text-[13.5px] text-noct-neutral-300">{fechaConAnio(fecha)}</span>
        </span>
        <span className={`text-[14px] font-semibold ${restantes <= 0 ? 'text-noct-precaucion' : 'text-noct-neutral-300'}`}>
          {razon}
          {mantenimiento.estado === 'pospuesto' && <span className="font-normal text-noct-neutral-400"> · Pospuesto</span>}
        </span>
        {mantenimiento.observaciones && (
          <span className="text-[14px] leading-[1.45] text-noct-neutral-300 [overflow-wrap:anywhere]">{mantenimiento.observaciones}</span>
        )}
      </Link>
      <button
        type="button"
        onClick={onCerrar}
        aria-haspopup="dialog"
        aria-label={`Cerrar mantenimiento: ${nombreMantenimiento(mantenimiento.tipo)}`}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 border-t border-noct-divider bg-noct-accent/[.14] text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.2]"
      >
        <Check size={17} aria-hidden />
        Cerrar mantenimiento
      </button>
    </div>
  )
}

/** Un mantenimiento realizado y confirmado: superficie sólida y barra verde. */
function TarjetaRealizado({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  return (
    <Link
      to={`/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`}
      className="flex flex-col gap-1.5 rounded-2xl border border-l-4 border-noct-divider border-l-noct-exito bg-noct-surface px-3.5 py-3 text-noct-text hover:bg-noct-text/[.03]"
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="text-[15.5px] font-semibold">{nombreMantenimiento(mantenimiento.tipo)}</span>
        {mantenimiento.fechaRealizada && (
          <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-noct-neutral-300">
            {fechaConAnio(mantenimiento.fechaRealizada)}
          </span>
        )}
      </span>
      {mantenimiento.resultado && (
        <span className="text-[14px] leading-[1.45] [overflow-wrap:anywhere]">{mantenimiento.resultado}</span>
      )}
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-noct-neutral-400">
        {mantenimiento.tecnico && (
          <span className="inline-flex items-center gap-1">
            <User size={13} aria-hidden />
            {mantenimiento.tecnico}
          </span>
        )}
        {mantenimiento.historialId && (
          <span className="inline-flex items-center gap-1">
            <ClockCounterClockwise size={13} aria-hidden />
            en el historial
          </span>
        )}
      </span>
    </Link>
  )
}

/** Un antecedente documentado por validar: borde punteado, sin relleno, "según" su fuente. */
function TarjetaAntecedente({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  const cuando = mantenimiento.fechaProgramada ? fechaConAnio(mantenimiento.fechaProgramada) : 'Sin fecha'
  return (
    <Link
      to={`/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`}
      className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-noct-text/25 px-3.5 py-3 text-noct-text hover:bg-noct-text/[.03]"
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="text-[15px] font-[550] text-noct-neutral-200">{nombreMantenimiento(mantenimiento.tipo)}</span>
        <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-noct-neutral-400">{cuando}</span>
      </span>
      <span className="text-[13px] text-noct-neutral-400 [overflow-wrap:anywhere]">Según {mantenimiento.fuente}</span>
      <span className="flex items-center justify-between gap-2.5">
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-noct-precaucion px-2.5 py-px text-[12px] font-semibold text-noct-precaucion">
          Por validar
        </span>
        <span className="text-[14px] font-semibold text-noct-accent-300" aria-hidden>
          Ver
        </span>
      </span>
    </Link>
  )
}

function FormularioProgramar({ dispositivoId, alTerminar }: { dispositivoId: string; alTerminar: () => void }) {
  const [tipo, setTipo] = useState<TipoMantenimiento>('preventivo')
  const [fecha, setFecha] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const error = errorDeProgramacion(fecha)

  async function programar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    setGuardando(true)
    await guardarRegistro('mantenimientos', {
      id: nuevoId(),
      dispositivoId,
      tipo,
      fechaProgramada: fecha,
      estado: 'programado',
      tecnico: '',
      fechaRealizada: null,
      resultado: '',
      observaciones: observaciones.trim(),
      historialId: null,
      fuente: '',
      validacion: 'confirmado',
    })
    setGuardando(false)
    alTerminar()
  }

  return (
    <form
      onSubmit={programar}
      noValidate
      className="flex flex-col gap-2.5"
    >
      <SelectorTipoMantenimiento valor={tipo} alCambiar={setTipo} />
      <Campo etiqueta="Fecha en que toca">
        <input
          type="date"
          required
          min={hoyIso()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-invalid={intentado && Boolean(error)}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Observaciones (opcional)">
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      {intentado && error && (
        <p role="alert" className="text-[12.5px] text-noct-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={guardando} className={`${BTN_PRIMARIO_RELLENO} flex-1`}>
          {guardando ? 'Guardando...' : 'Programar mantenimiento'}
        </button>
        <button type="button" onClick={alTerminar} className={`${BTN_GHOST} min-h-11 px-4`}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

