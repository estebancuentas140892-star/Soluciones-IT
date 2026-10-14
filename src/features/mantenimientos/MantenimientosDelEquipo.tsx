import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { HojaInferior } from '../../components/HojaInferior'
import { Check, ClockCountdown, ClockCounterClockwise, Note, Plus, SealCheck, User, Wrench } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
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
// delineado (no hace avanzar nada: la acción rellena es la del cierre).
//
// DESDE 768 PX (tarea 338) se conservan la pantalla, las tres formas y su
// orden, con el lenguaje que tenía este mantenimiento dentro de la ficha
// antes del rediseño móvil (06be087): rótulos de sección de TituloSeccion,
// nombre a 13.5 px de peso medio, la razón y las fechas a 12.5 px en Inter,
// tarjetas `rounded-lg` y Programar como el botón fantasma en acento de
// entonces, al final del contenido y sin barra pegada.

function porFechaProgramada(a: Mantenimiento, b: Mantenimiento): number {
  return (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? '')
}

function porFechaRealizadaDesc(a: Mantenimiento, b: Mantenimiento): number {
  return (b.fechaRealizada ?? '').localeCompare(a.fechaRealizada ?? '')
}

export function MantenimientosDelEquipo({
  dispositivoId,
  nombreEquipo,
}: {
  dispositivoId: string
  /** El nombre del equipo, para el contexto de las hojas. */
  nombreEquipo: string
}) {
  const mantenimientos = useLiveQuery(
    () =>
      db.mantenimientos
        .where('dispositivoId')
        .equals(dispositivoId)
        .filter((m) => !m.eliminadoEn)
        .toArray(),
    [dispositivoId],
  )
  const [programando, setProgramando] = useState(false)
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center md:mb-4 md:flex-none md:rounded-lg md:border md:border-dashed md:border-noct-neutral-700">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-noct-text/[.06] text-noct-neutral-400 md:h-auto md:w-auto md:rounded-none md:bg-transparent md:text-noct-neutral-600">
            <Wrench size={30} aria-hidden />
          </span>
          <h2 className="text-[19px] font-semibold md:text-[14.5px] md:font-medium">Sin mantenimientos</h2>
          <p className="max-w-[280px] text-[14.5px] leading-[1.5] text-noct-neutral-400 md:text-[13px] md:leading-relaxed">
            Ni programados, ni realizados, ni antecedentes por validar. Programa el próximo y aparecerá en Atención
            cuando toque.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[26px] pb-4 md:gap-5">
          {abiertos.length > 0 && (
            <section aria-labelledby="mant-programado" className="flex flex-col gap-2.5 md:gap-2">
              <h2 id="mant-programado" className={`flex items-center gap-2 text-[15px] font-semibold ${TITULO_SECCION_MD}`}>
                <ClockCountdown size={17} className="shrink-0 text-noct-precaucion md:hidden" aria-hidden />
                Programado
              </h2>
              {abiertos.map((m) => (
                <TarjetaProgramado key={m.id} mantenimiento={m} onCerrar={() => setCerrando(m)} />
              ))}
            </section>
          )}

          {realizados.length > 0 && (
            <section aria-labelledby="mant-realizado" className="flex flex-col gap-2.5 md:gap-2">
              <h2 id="mant-realizado" className={`flex items-center gap-2 text-[15px] font-semibold ${TITULO_SECCION_MD}`}>
                <SealCheck size={17} className="shrink-0 text-noct-exito md:hidden" aria-hidden />
                Realizado y confirmado
              </h2>
              {realizados.map((m) => (
                <TarjetaRealizado key={m.id} mantenimiento={m} />
              ))}
            </section>
          )}

          {antecedentes.length > 0 && (
            <section aria-labelledby="mant-antecedentes" className="flex flex-col gap-2.5 md:gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 id="mant-antecedentes" className={`flex items-center gap-2 text-[15px] font-semibold ${TITULO_SECCION_MD}`}>
                  <Note size={17} className="shrink-0 text-noct-precaucion md:hidden" aria-hidden />
                  Documentado, por validar
                </h2>
                <p className="text-[13px] leading-[1.45] text-noct-neutral-400 md:text-[12px] md:text-noct-neutral-500">
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

      {/* PROGRAMAR, ABAJO Y DELINEADO: no hace avanzar nada. Desde 768 px
          (tarea 338), el Programar de antes (BTN_GHOST_ACENTO con
          `min-h-11`), al final del contenido y sin barra pegada. */}
      <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:static md:bottom-0 md:mx-0 md:mt-0 md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <button
          type="button"
          onClick={() => setProgramando(true)}
          aria-haspopup="dialog"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-noct-text/25 text-[15.5px] font-semibold text-noct-text hover:bg-noct-text/[.05] md:inline-flex md:h-auto md:min-h-11 md:w-auto md:gap-1.5 md:rounded-lg md:border md:border-transparent md:px-2.5 md:py-[7px] md:text-[13px] md:font-medium md:leading-tight md:text-noct-accent md:hover:bg-noct-accent/10 md:active:bg-noct-accent/20 md:[&>svg]:size-[13px]"
        >
          <Plus size={17} aria-hidden />
          Programar mantenimiento
        </button>
      </div>

      <HojaInferior abierta={programando} onCerrar={() => setProgramando(false)} titulo="Programar mantenimiento" contexto={nombreEquipo}>
        <FormularioProgramar dispositivoId={dispositivoId} alTerminar={() => setProgramando(false)} />
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
    <div className="overflow-hidden rounded-2xl border border-noct-divider bg-noct-surface md:rounded-lg">
      <Link to={ruta} className={`flex flex-col gap-1.5 p-3.5 text-noct-text hover:bg-noct-text/[.03] ${CUERPO_TARJETA_MD}`}>
        <span className="flex items-baseline justify-between gap-2.5">
          <span className={`text-[16.5px] font-semibold ${NOMBRE_MD}`}>{nombreMantenimiento(mantenimiento.tipo)}</span>
          <span className={`shrink-0 whitespace-nowrap font-mono text-[13.5px] text-noct-neutral-300 ${FECHA_MD}`}>{fechaConAnio(fecha)}</span>
        </span>
        <span
          className={`text-[14px] font-semibold md:text-[12.5px] md:font-normal ${restantes <= 0 ? 'text-noct-precaucion' : 'text-noct-neutral-300 md:text-noct-neutral-400'}`}
        >
          {razon}
          {mantenimiento.estado === 'pospuesto' && <span className="font-normal text-noct-neutral-400 md:text-noct-neutral-500"> · Pospuesto</span>}
        </span>
        {mantenimiento.observaciones && (
          <span className="text-[14px] leading-[1.45] text-noct-neutral-300 [overflow-wrap:anywhere] md:text-[12.5px] md:text-noct-neutral-400">
            {mantenimiento.observaciones}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={onCerrar}
        aria-haspopup="dialog"
        aria-label={`Cerrar mantenimiento: ${nombreMantenimiento(mantenimiento.tipo)}`}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 border-t border-noct-divider bg-noct-accent/[.14] text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.2] md:min-h-11 md:gap-1.5 md:bg-noct-accent/[.12] md:text-[13px] md:font-medium md:hover:bg-noct-accent/[.18] md:active:bg-noct-accent/25 md:[&>svg]:size-3.5"
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
      className={`flex flex-col gap-1.5 rounded-2xl border border-l-4 border-noct-divider border-l-noct-exito bg-noct-surface px-3.5 py-3 text-noct-text hover:bg-noct-text/[.03] md:rounded-lg ${CUERPO_TARJETA_MD}`}
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className={`text-[15.5px] font-semibold ${NOMBRE_MD}`}>{nombreMantenimiento(mantenimiento.tipo)}</span>
        {mantenimiento.fechaRealizada && (
          <span className={`shrink-0 whitespace-nowrap font-mono text-[13px] text-noct-neutral-300 ${FECHA_MD}`}>
            {fechaConAnio(mantenimiento.fechaRealizada)}
          </span>
        )}
      </span>
      {mantenimiento.resultado && (
        <span className="text-[14px] leading-[1.45] [overflow-wrap:anywhere] md:text-[12.5px] md:text-noct-neutral-300">{mantenimiento.resultado}</span>
      )}
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-noct-neutral-400 md:text-[12px] md:text-noct-neutral-500">
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
      className={`flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-noct-text/25 px-3.5 py-3 text-noct-text hover:bg-noct-text/[.03] md:rounded-lg md:border md:border-noct-divider ${CUERPO_TARJETA_MD}`}
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="text-[15px] font-[550] text-noct-neutral-200 md:text-[13.5px] md:font-normal md:leading-[1.35] md:text-noct-neutral-300">
          {nombreMantenimiento(mantenimiento.tipo)}
        </span>
        <span className={`shrink-0 whitespace-nowrap font-mono text-[13px] text-noct-neutral-400 ${FECHA_MD}`}>{cuando}</span>
      </span>
      <span className="text-[13px] text-noct-neutral-400 [overflow-wrap:anywhere] md:text-[12px] md:text-noct-neutral-500">Según {mantenimiento.fuente}</span>
      <span className="flex items-center justify-between gap-2.5">
        {/* Desde 768 px, la pastilla de estado de antes (PastillaEstadoAutorizacion). */}
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-noct-precaucion px-2.5 py-px text-[12px] font-semibold text-noct-precaucion md:px-2 md:text-[11.5px] md:font-medium md:leading-[1.5]">
          Por validar
        </span>
        <span className="text-[14px] font-semibold text-noct-accent-300 md:text-[12.5px] md:font-medium" aria-hidden>
          Ver
        </span>
      </span>
    </Link>
  )
}

// Desde 768 px (tarea 338), lo de las filas de antes: el nombre, la fecha
// (en Inter, ya no monoespaciada) y el cuerpo de cada tarjeta.
const NOMBRE_MD = 'md:text-[13.5px] md:font-medium md:leading-[1.35]'
const FECHA_MD = 'md:font-inter md:text-[12.5px] md:text-noct-neutral-400'
const CUERPO_TARJETA_MD = 'md:gap-0.5 md:px-3 md:py-2.5 md:hover:bg-noct-text/[.05]'
const TITULO_SECCION_MD = 'md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500'

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
        {/* Desde 768 px (tarea 338), el alto, el radio y la letra del primario de antes. */}
        <button
          type="submit"
          disabled={guardando}
          className={`${BTN_PRIMARIO_RELLENO} flex-1 md:min-h-11 md:flex-none md:gap-1.5 md:rounded-lg md:text-[13px] md:font-medium`}
        >
          {guardando ? 'Guardando...' : 'Programar mantenimiento'}
        </button>
        <button type="button" onClick={alTerminar} className={`${BTN_GHOST} min-h-11 px-4`}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

