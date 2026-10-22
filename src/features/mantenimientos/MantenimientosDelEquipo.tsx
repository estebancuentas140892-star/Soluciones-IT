import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { EsqueletoMantenimiento } from '../../components/Esqueleto'
import { HojaInferior } from '../../components/HojaInferior'
import { Check, ClockCountdown, ClockCounterClockwise, Note, Paperclip, Plus, SealCheck, User, Wrench } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { PastillaEstado } from '../../components/PastillaEstado'
import { ANCHO_TABLETA_HORIZONTAL, useEsAncho } from '../../components/useEsAncho'
import { db, type Mantenimiento, type TipoMantenimiento } from '../../lib/db'
import { esPorValidar, fechaConAnio, nombreMantenimiento } from '../../lib/mantenimientos'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { diasDeCalendario } from '../../lib/vencimiento'
import { estadoMarcadoDe } from './antecedentes'
import {
  entraEnAgenda,
  errorDeProgramacion,
  hoyIso,
  porFechaProgramada,
  porFechaRealizadaDesc,
  textoProgramado,
} from './mantenimiento'
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
  // Desde 1024 (contenedor de 896): dos columnas y lo hecho en una lista
  // tabular (T8). Cambia la estructura, no solo la forma.
  const tabular = useEsAncho(ANCHO_TABLETA_HORIZONTAL)
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
  // La evidencia de cada realizado (fotos, actas), que cuelga de la
  // intervención que lo cerró: una sola lectura para toda la lista (tarea 343).
  const idsHistorial = (mantenimientos ?? []).flatMap((m) => (m.historialId ? [m.historialId] : []))
  const evidencias = useLiveQuery(
    async () => {
      const porIntervencion = new Map<string, number>()
      if (idsHistorial.length === 0) return porIntervencion
      const adjuntos = await db.adjuntos
        .where('[entidadTipo+entidadId]')
        .anyOf(idsHistorial.map((id) => ['historial', id]))
        .filter((a) => !a.eliminadoEn)
        .toArray()
      for (const adjunto of adjuntos) porIntervencion.set(adjunto.entidadId, (porIntervencion.get(adjunto.entidadId) ?? 0) + 1)
      return porIntervencion
    },
    [idsHistorial.join(',')],
    new Map<string, number>(),
  )

  // Sin leer todavía, la forma de lo que viene (tarea 342): ni "Sin
  // mantenimientos" ni "al día" antes de mirar.
  if (!mantenimientos) return <EsqueletoMantenimiento />
  const abiertos = mantenimientos.filter(entraEnAgenda).sort(porFechaProgramada)
  const realizados = mantenimientos
    .filter((m) => m.estado === 'realizado' && !esPorValidar(m))
    .sort(porFechaRealizadaDesc)
  const antecedentes = mantenimientos.filter(esPorValidar).sort(porFechaProgramada)
  const vacio = abiertos.length === 0 && realizados.length === 0 && antecedentes.length === 0

  const programado = abiertos.length > 0 && (
    <section aria-labelledby="mant-programado" className="flex flex-col gap-2.5">
      <h2 id="mant-programado" className="flex items-center gap-2 text-[15px] font-semibold">
        <ClockCountdown size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
        Programado
      </h2>
      {abiertos.map((m) => (
        <TarjetaProgramado key={m.id} mantenimiento={m} onCerrar={() => setCerrando(m)} />
      ))}
    </section>
  )

  const realizado = realizados.length > 0 && (
    <section aria-labelledby="mant-realizado" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mant-realizado" className="flex items-center gap-2 text-[15px] font-semibold">
          <SealCheck size={17} className="shrink-0 text-noct-exito" aria-hidden />
          Realizado y confirmado
        </h2>
        {tabular && <span className="shrink-0 font-mono text-[13px] text-noct-neutral-500">{realizados.length}</span>}
      </div>
      {tabular ? (
        <TablaRealizados realizados={realizados} />
      ) : (
        realizados.map((m) => (
          <TarjetaRealizado key={m.id} mantenimiento={m} evidencias={m.historialId ? (evidencias.get(m.historialId) ?? 0) : 0} />
        ))
      )}
    </section>
  )

  const porValidar = antecedentes.length > 0 && (
    <section aria-labelledby="mant-antecedentes" className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 id="mant-antecedentes" className="flex items-center gap-2 text-[15px] font-semibold">
          <Note size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
          Documentado, por validar
        </h2>
        <p className="text-[13px] leading-[1.45] text-noct-neutral-400">
          Marcas de una fuente histórica. No dicen técnico, resultado ni evidencia: no son mantenimientos hechos ni
          pendientes.
        </p>
      </div>
      {antecedentes.map((m) => (
        <TarjetaAntecedente key={m.id} mantenimiento={m} />
      ))}
    </section>
  )

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
      ) : tabular && porValidar ? (
        // DESDE 1024 (tarea 339, T8; pizarra Mantenimiento 1280): lo programado
        // y lo hecho a la izquierda; lo documentado por validar en su columna
        // de 340, aparte, porque no es trabajo hecho ni pendiente.
        <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-x-12 pb-4">
          <div className="flex min-w-0 flex-col gap-[30px]">
            {programado}
            {realizado}
          </div>
          {porValidar}
        </div>
      ) : (
        <div className="flex flex-col gap-[26px] pb-4">
          {programado}
          {realizado}
          {porValidar}
        </div>
      )}

      {/* PROGRAMAR, ABAJO Y DELINEADO: no hace avanzar nada. Solo en el
          teléfono; desde 768 px va en la cabecera (tarea 339). */}
      {!ancho && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:hidden">
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
  const ancho = useEsAncho()
  const pospuesto = mantenimiento.estado === 'pospuesto'
  return (
    <div className="overflow-hidden rounded-2xl border border-noct-divider bg-noct-surface shadow-[var(--shadow-noct-elevacion)]">
      <Link to={ruta} className="flex flex-col gap-1.5 p-3.5 text-noct-text hover:bg-noct-text/[.03]">
        <span className="flex items-baseline justify-between gap-2.5">
          <span className="text-[16.5px] font-semibold">{nombreMantenimiento(mantenimiento.tipo)}</span>
          <span className="shrink-0 whitespace-nowrap font-mono text-[13.5px] text-noct-neutral-300">{fechaConAnio(fecha)}</span>
        </span>
        {/* En el teléfono lo atrasado va en error y lo pospuesto lleva su
            pastilla de precaución con su punto (tarea 343). Lo atrasado y lo
            de hoy, también en la pastilla con su punto (tarea 345, DESPUÉS
            de Claude Design): el estado se lee sin depender del color. */}
        {!ancho && restantes <= 0 ? (
          <PastillaEstado tono={restantes < 0 ? 'error' : 'precaucion'} conPunto className="self-start max-md:py-1 max-md:text-[13px]">
            {razon}
          </PastillaEstado>
        ) : (
          <span
            className={`text-[14px] font-semibold ${
              restantes <= 0 ? 'text-noct-precaucion' : 'text-noct-neutral-300'
            }`}
          >
            {razon}
            {pospuesto && ancho && <span className="font-normal text-noct-neutral-400"> · Pospuesto</span>}
          </span>
        )}
        {pospuesto && !ancho && (
          <PastillaEstado tono="precaucion" conPunto className="self-start">
            Pospuesto · sigue pendiente
          </PastillaEstado>
        )}
        {mantenimiento.observaciones && (
          <span className="text-[14px] leading-[1.45] text-noct-neutral-300 [overflow-wrap:anywhere]">{mantenimiento.observaciones}</span>
        )}
      </Link>
      <button
        type="button"
        onClick={onCerrar}
        aria-haspopup="dialog"
        aria-label={`Cerrar mantenimiento: ${nombreMantenimiento(mantenimiento.tipo)}`}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 border-t border-noct-divider bg-noct-accent/[.14] text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.2] xl:min-h-[42px] xl:text-[14px]"
      >
        <Check size={17} aria-hidden />
        Cerrar mantenimiento
      </button>
    </div>
  )
}

/**
 * Un mantenimiento realizado y confirmado: superficie sólida y barra verde.
 * Debajo, quién, su evidencia si la tiene (tarea 343: se dice, no se
 * inventa) y "En el historial", que en el teléfono va en éxito con su marca:
 * es una referencia válida, no un dato apagado.
 */
function TarjetaRealizado({ mantenimiento, evidencias }: { mantenimiento: Mantenimiento; evidencias: number }) {
  const ancho = useEsAncho()
  return (
    <Link
      to={`/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`}
      className="flex flex-col gap-1.5 rounded-2xl border border-l-4 border-noct-divider border-l-noct-exito bg-noct-surface px-3.5 py-3 text-noct-text shadow-[var(--shadow-noct-elevacion)] hover:bg-noct-text/[.03]"
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
        {evidencias > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip size={13} aria-hidden />
            {evidencias === 1 ? '1 adjunto' : `${evidencias} adjuntos`}
          </span>
        )}
        {mantenimiento.historialId &&
          (ancho ? (
            <span className="inline-flex items-center gap-1">
              <ClockCounterClockwise size={13} aria-hidden />
              en el historial
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-noct-exito">
              <Check size={13} aria-hidden />
              En el historial
            </span>
          ))}
      </span>
    </Link>
  )
}

/**
 * LO HECHO, EN UNA LISTA TABULAR (desde 1024, tarea 339, T8): el mismo grupo
 * sólido con su barra verde, una fila por mantenimiento con su fecha en IBM
 * Plex Mono, qué se hizo y quién. Se compara de un vistazo; cada fila abre
 * el mantenimiento, como la tarjeta del teléfono.
 */
function TablaRealizados({ realizados }: { realizados: Mantenimiento[] }) {
  const columnas = 'grid grid-cols-[100px_minmax(0,1fr)_150px] gap-4 px-4'
  return (
    <div
      role="table"
      aria-label="Mantenimientos realizados y confirmados"
      className="overflow-hidden rounded-[14px] border border-l-4 border-noct-divider border-l-noct-exito bg-noct-surface shadow-[var(--shadow-noct-elevacion)]"
    >
      <div
        role="row"
        className={`${columnas} min-h-9 items-center border-b border-noct-divider text-[12px] font-semibold text-noct-neutral-500`}
      >
        <span role="columnheader">Fecha</span>
        <span role="columnheader">Mantenimiento</span>
        <span role="columnheader">Técnico</span>
      </div>
      {realizados.map((m) => (
        <Link
          key={m.id}
          role="row"
          to={`/dispositivos/${m.dispositivoId}/mantenimientos/${m.id}`}
          className={`${columnas} items-start border-b border-noct-divider py-[11px] text-[14px] text-noct-text last:border-b-0 hover:bg-noct-text/[.045]`}
        >
          <span role="cell" className="pt-0.5 font-mono text-[13px] text-noct-neutral-300">
            {m.fechaRealizada ? fechaConAnio(m.fechaRealizada) : ''}
          </span>
          <span role="cell" className="min-w-0">
            <span className="block font-semibold">{nombreMantenimiento(m.tipo)}</span>
            {m.resultado && (
              <span className="block text-[13.5px] leading-[1.45] text-noct-neutral-300 [overflow-wrap:anywhere]">
                {m.resultado}
              </span>
            )}
          </span>
          <span role="cell" className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-noct-neutral-400">
            <span className="min-w-0 [overflow-wrap:anywhere]">{m.tecnico}</span>
            {m.historialId && (
              <>
                <ClockCounterClockwise size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                <span className="sr-only">en el historial</span>
              </>
            )}
          </span>
        </Link>
      ))}
    </div>
  )
}

/**
 * Un antecedente documentado por validar: borde punteado, sin relleno, "según"
 * su fuente real y lo que esa fuente marca ("marca REALIZADO", tarea 343).
 * Documentado no es confirmado: lleva "Por validar" y abre su pantalla, donde
 * se ve la fuente entera.
 */
function TarjetaAntecedente({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  const cuando = mantenimiento.fechaProgramada ? fechaConAnio(mantenimiento.fechaProgramada) : 'Sin fecha'
  const marca = estadoMarcadoDe(mantenimiento.observaciones)
  const ancho = useEsAncho()
  return (
    <Link
      data-documentado
      to={`/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`}
      className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-noct-text/25 px-3.5 py-3 text-noct-text hover:bg-noct-text/[.03]"
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="text-[15px] font-[550] text-noct-neutral-200">{nombreMantenimiento(mantenimiento.tipo)}</span>
        <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-noct-neutral-400">{cuando}</span>
      </span>
      <span className="text-[13px] text-noct-neutral-400 [overflow-wrap:anywhere]">
        Según {mantenimiento.fuente}
        {marca && (
          <>
            : marca <span className="font-mono text-noct-neutral-300">{marca}</span>
          </>
        )}
      </span>
      <span className="flex items-center justify-between gap-2.5">
        {/* En el teléfono, la pastilla compartida con su punto (tarea 345). */}
        {ancho ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-noct-precaucion px-2.5 py-px text-[12px] font-semibold text-noct-precaucion">
            Por validar
          </span>
        ) : (
          <PastillaEstado tono="precaucion" conPunto>
            Por validar
          </PastillaEstado>
        )}
        <span className="flex items-center text-[14px] font-semibold text-noct-accent-300 max-md:min-h-10" aria-hidden>
          {ancho ? 'Ver' : 'Ver fuente'}
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

