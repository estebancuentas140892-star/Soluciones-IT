import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Adjuntos } from '../../components/Adjuntos'
import { avisar } from '../../components/avisosFlotantes'
import { Campo, CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import { EsqueletoMantenimiento } from '../../components/Esqueleto'
import { Check, CheckCircle, Paperclip, WarningCircle } from '../../components/iconos'
import { BTN_PRIMARIO_PELIGRO, BTN_PRIMARIO_RELLENO, BTN_SECUNDARIO } from '../../components/nocturne'
import { OpcionRadio } from '../../components/OpcionRadio'
import { PastillaEstado } from '../../components/PastillaEstado'
import { useEsAncho } from '../../components/useEsAncho'
import { db, type Mantenimiento } from '../../lib/db'
import {
  esPorValidar,
  estaAbierto,
  fechaConAnio,
  nombreMantenimiento,
} from '../../lib/mantenimientos'
import { cerrarMantenimiento, guardarRegistro } from '../../lib/repositorio'
import { diasDeCalendario } from '../../lib/vencimiento'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { datosDocumentados, estadoMarcadoDe } from './antecedentes'
import {
  ERROR_QUE_SE_HIZO,
  errorDeCancelacion,
  errorDeCierre,
  errorDePosposicion,
  hoyIso,
  textoProgramado,
} from './mantenimiento'

// UN MANTENIMIENTO: DECIR CÓMO TERMINÓ (tarea 320).
//
// Una pantalla, una acción: registrar el desenlace de un mantenimiento
// abierto. Se llega desde la Agenda o desde la ficha del equipo. Tres
// respuestas a la misma pregunta:
//   - Se hizo: fecha real, quién lo hizo y qué se hizo. "Cerrar y
//     registrar en el equipo" escribe la intervención en el historial del
//     equipo y el mantenimiento sale de la Agenda; después se le puede
//     adjuntar la evidencia (fotos, actas), que cuelga de esa intervención.
//   - Se pospone: fecha nueva; sigue abierto, con esa fecha.
//   - Se cancela: con el motivo, que queda en el historial del equipo.
// Cerrado, la pantalla enseña lo que quedó (y la evidencia). Un
// antecedente sacado de documentación histórica solo se consulta: está
// por validar y no se cierra desde aquí.

type Respuesta = 'realizado' | 'pospuesto' | 'cancelado'

export function MantenimientoPage() {
  const { dispositivoId = '', mantenimientoId = '' } = useParams()
  const dispositivo = useLiveQuery(async () => (await db.dispositivos.get(dispositivoId)) ?? null, [dispositivoId])
  const mantenimiento = useLiveQuery(
    async () => (await db.mantenimientos.get(mantenimientoId)) ?? null,
    [mantenimientoId],
  )
  const ficha = `/dispositivos/${dispositivoId}`

  if (mantenimiento === null || (mantenimiento && (mantenimiento.eliminadoEn || mantenimiento.dispositivoId !== dispositivoId))) {
    return <Navigate to={ficha} replace />
  }
  // Mientras se lee, su forma (tarea 342). Es una tarea: sin chasis todavía,
  // en la columna de la tarea.
  if (mantenimiento === undefined || dispositivo === undefined) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <main className="mx-auto flex w-full max-w-md flex-col px-4 pt-4">
          <EsqueletoMantenimiento />
        </main>
      </div>
    )
  }

  return (
    <Chasis
      modo="tarea"
      rotulo="Mantenimiento"
      titulo={dispositivo?.nombre ?? 'Equipo'}
      // Sube a la pantalla de mantenimiento del equipo (tarea 331), que es
      // de donde se llega y la que lista los demás.
      salidaA={`${ficha}/mantenimientos`}
      vuelta="Mantenimiento"
      salidaEtiqueta="Volver al mantenimiento del equipo"
    >
      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-[18px]">
        <Resumen mantenimiento={mantenimiento} />
        {esPorValidar(mantenimiento) ? (
          <AntecedentePorValidar mantenimiento={mantenimiento} />
        ) : estaAbierto(mantenimiento) ? (
          <RegistrarDesenlace mantenimiento={mantenimiento} />
        ) : (
          <Desenlace mantenimiento={mantenimiento} ficha={ficha} />
        )}
      </main>
    </Chasis>
  )
}

function Resumen({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  const fecha = mantenimiento.fechaProgramada
  const restantes = fecha ? diasDeCalendario(fecha, new Date()) : null
  const abierto = estaAbierto(mantenimiento) && !esPorValidar(mantenimiento)
  const ancho = useEsAncho()
  return (
    <section className="flex flex-col gap-1">
      <h1 className="text-[20px] font-semibold leading-[1.3]">{nombreMantenimiento(mantenimiento.tipo)}</h1>
      <p className="text-[13.5px] text-noct-neutral-300">
        {!fecha
          ? 'Sin fecha programada'
          : esPorValidar(mantenimiento)
            ? `Documentado para el ${fechaConAnio(fecha)}`
            : mantenimiento.estado === 'pospuesto'
              ? `Pospuesto al ${fechaConAnio(fecha)}`
              : `Programado para el ${fechaConAnio(fecha)}`}
        {/* Solo lo que la fecha no dice ya: atrasado, hoy o mañana. */}
        {/* En el teléfono lo atrasado va en error, no en precaución (tarea 343). */}
        {abierto && fecha && restantes !== null && restantes <= 1 && (
          <span
            className={
              restantes < 0
                ? 'text-noct-precaucion max-md:font-semibold max-md:text-noct-error'
                : restantes === 0
                  ? 'text-noct-precaucion'
                  : 'text-noct-neutral-400'
            }
          >
            {' · '}
            {textoProgramado(fecha, restantes)}
          </span>
        )}
      </p>
      {/* POSPUESTO, CON SU SEÑAL EN EL TELÉFONO (tarea 343): la pastilla de
          precaución con su punto; sigue pendiente. */}
      {abierto && !ancho && mantenimiento.estado === 'pospuesto' && (
        <PastillaEstado tono="precaucion" conPunto className="mt-1 self-start">
          Pospuesto · sigue pendiente
        </PastillaEstado>
      )}
      {mantenimiento.observaciones && (
        <p className="whitespace-pre-wrap text-[13px] leading-[1.55] text-noct-neutral-300 [overflow-wrap:anywhere]">
          {mantenimiento.observaciones}
        </p>
      )}
    </section>
  )
}

// UN ANTECEDENTE ENSEÑA LO QUE SU FUENTE DICE, SIN CONFIRMARLO (revisión
// del 2026-10-10). Hasta ahora solo enseñaba la fuente, aunque la fila
// guardara fecha real, técnico o resultado sacados de ella. Ahora esos
// datos se ven, pero dentro de un recuadro discontinuo rotulado
// "Documentado en la fuente · por validar" y con etiquetas propias, para
// que nunca se confundan con el desenlace de un mantenimiento cerrado en
// la app (banda verde, "Se hizo el", "Lo hizo"). Solo lo que trae texto:
// un campo vacío no se rellena con nada. Y sigue sin controles: no se
// cierra ni se edita desde aquí.
function AntecedentePorValidar({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  const datos = datosDocumentados(mantenimiento)
  const marca = estadoMarcadoDe(mantenimiento.observaciones)
  const ancho = useEsAncho()
  return (
    <section className="flex flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <p className="text-[13.5px] font-medium">Antecedente por validar</p>
      <p className="text-[12.5px] leading-[1.5] text-noct-neutral-300">
        {datos.length > 0
          ? 'Sale de documentación histórica. Lo que esa fuente dice está abajo, sin confirmar, y no se cierra desde aquí.'
          : 'Sale de documentación histórica. No confirma que siga pendiente ni que se hiciera, y no se cierra desde aquí.'}
      </p>
      {datos.length > 0 && (
        <div
          role="group"
          aria-label="Documentado en la fuente, por validar"
          className="flex flex-col rounded-md border border-dashed border-noct-neutral-700 px-3 py-1.5"
        >
          <p className="pt-1 text-[11px] max-md:text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
            Documentado en la fuente · por validar
          </p>
          <dl className="divide-y divide-noct-divider">
            {datos.map((dato) => (
              <div key={dato.etiqueta} className="flex flex-col gap-0.5 py-2">
                <dt className={CLASE_ETIQUETA}>{dato.etiqueta}</dt>
                <dd className="whitespace-pre-wrap text-[13.5px] text-noct-neutral-200 [overflow-wrap:anywhere]">
                  {dato.valor}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {/* LO QUE DICE LA FUENTE, CON SU NOMBRE REAL (tarea 343): "Según …:
          marca REALIZADO" y, en el teléfono, la pastilla "Por validar".
          Documental: no dice que se confirmara. */}
      <p className="text-[12.5px] text-noct-neutral-400 [overflow-wrap:anywhere] max-md:text-[13px]">
        {ancho ? 'Fuente: ' : 'Según '}
        {mantenimiento.fuente}
        {marca && (
          <>
            : marca <span className="font-mono text-noct-neutral-300">{marca}</span>
          </>
        )}
      </p>
      {!ancho && (
        <PastillaEstado tono="precaucion" className="self-start">
          Por validar
        </PastillaEstado>
      )}
    </section>
  )
}

function FilaDeDato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className={CLASE_ETIQUETA}>{etiqueta}</span>
      <span className="whitespace-pre-wrap text-[13.5px] text-noct-text [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

/** Lo que quedó de un mantenimiento cerrado, y su evidencia. */
function Desenlace({ mantenimiento, ficha }: { mantenimiento: Mantenimiento; ficha: string }) {
  const ancho = useEsAncho()
  // La evidencia que ya tiene (fotos, actas): cuelga de la intervención que
  // lo cerró. Solo se dice si la hay; no se inventa (tarea 343).
  const evidencias = useLiveQuery(
    async () =>
      mantenimiento.historialId
        ? db.adjuntos
            .where('[entidadTipo+entidadId]')
            .equals(['historial', mantenimiento.historialId])
            .filter((a) => !a.eliminadoEn)
            .count()
        : 0,
    [mantenimiento.historialId],
    0,
  )
  const textoEvidencias = evidencias === 1 ? '1 adjunto' : `${evidencias} adjuntos`
  return (
    <section className="flex flex-col gap-3">
      {mantenimiento.estado === 'realizado' && (
        <>
          <p className="flex items-center gap-2 rounded-md border border-noct-exito/35 bg-noct-exito/[.08] px-3 py-2.5 text-[13px] text-noct-exito">
            <CheckCircle size={16} className="shrink-0" aria-hidden />
            Realizado y registrado en el historial del equipo.
          </p>
          {/* EN EL TELÉFONO, LO HECHO EN SU FORMA (tarea 343, "Realizado y
              confirmado" del handoff): superficie sólida con la barra verde,
              los datos y, debajo, su evidencia y que está en el historial. */}
          <div className="flex flex-col max-md:rounded-2xl max-md:border max-md:border-l-4 max-md:border-noct-divider max-md:border-l-noct-exito max-md:bg-noct-surface max-md:px-3.5 max-md:pb-2.5 max-md:pt-0.5 max-md:shadow-[var(--shadow-noct-elevacion)]">
            <div className="divide-y divide-noct-divider">
              {mantenimiento.fechaRealizada && (
                <FilaDeDato etiqueta="Se hizo el">{fechaConAnio(mantenimiento.fechaRealizada)}</FilaDeDato>
              )}
              {mantenimiento.tecnico && <FilaDeDato etiqueta="Lo hizo">{mantenimiento.tecnico}</FilaDeDato>}
              {mantenimiento.resultado && <FilaDeDato etiqueta="Qué se hizo">{mantenimiento.resultado}</FilaDeDato>}
              {mantenimiento.fuente && <FilaDeDato etiqueta="Fuente">{mantenimiento.fuente}</FilaDeDato>}
            </div>
            {!ancho && (evidencias > 0 || mantenimiento.historialId) && (
              <p
                data-meta-realizado
                className="flex flex-wrap gap-x-3 gap-y-1 border-t border-noct-divider pt-2.5 text-[12.5px] text-noct-neutral-400"
              >
                {evidencias > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip size={13} aria-hidden />
                    {textoEvidencias}
                  </span>
                )}
                {mantenimiento.historialId && (
                  <span className="inline-flex items-center gap-1 text-noct-exito">
                    <Check size={13} aria-hidden />
                    En el historial
                  </span>
                )}
              </p>
            )}
          </div>
          {mantenimiento.historialId && (
            <div className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>{evidencias > 0 ? `Evidencia · ${textoEvidencias}` : 'Evidencia (opcional)'}</span>
              <Adjuntos entidadTipo="historial" entidadId={mantenimiento.historialId} sinCabecera />
            </div>
          )}
        </>
      )}
      {mantenimiento.estado === 'cancelado' && (
        <p className="rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-[13px] text-noct-neutral-300">
          Cancelado. El motivo está en el historial del equipo.
        </p>
      )}
      <Link to={ficha} className={`${BTN_SECUNDARIO} min-h-11 self-start px-4`}>
        Volver al equipo
      </Link>
    </section>
  )
}

// Las tres respuestas de siempre. En el teléfono cada una es una tarjeta con
// lo que hace debajo (tarea 343): se lee con una mano antes de elegir.
const RESPUESTAS: { valor: Respuesta; texto: string; detalle: string }[] = [
  { valor: 'realizado', texto: 'Se hizo', detalle: 'Queda en el historial del equipo' },
  { valor: 'pospuesto', texto: 'Se pospone', detalle: 'Sigue pendiente, con otra fecha' },
  { valor: 'cancelado', texto: 'Se cancela', detalle: 'Con su motivo, en el historial del equipo' },
]

// Exportado desde la tarea 330 (rediseño móvil "1b Pulgar", tarea 331): la
// pantalla de mantenimiento del equipo lo abre en una hoja ("Cerrar
// mantenimiento"); `alTerminar` la cierra después de guardar.
export function RegistrarDesenlace({
  mantenimiento,
  alTerminar,
}: {
  mantenimiento: Mantenimiento
  alTerminar?: () => void
}) {
  const perfil = usePerfilVivo()
  const idPregunta = useId()
  const idErrorResultado = useId()
  // En el teléfono, el aviso de "Qué se hizo" va junto a su campo (tarea
  // 343); desde 768, abajo con los demás, como siempre.
  const ancho = useEsAncho()
  const [desenlace, setDesenlace] = useState<Respuesta>('realizado')
  const [fechaRealizada, setFechaRealizada] = useState(hoyIso())
  // null hasta que se escribe: mientras tanto se propone el nombre de quien
  // tiene la sesión, que es quien suele cerrar lo que hizo. Se ve y se
  // puede cambiar antes de guardar.
  const [tecnicoEscrito, setTecnicoEscrito] = useState<string | null>(null)
  const [resultado, setResultado] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const tecnico = tecnicoEscrito ?? perfil?.nombre ?? ''

  const error =
    desenlace === 'realizado'
      ? errorDeCierre({ fechaRealizada, tecnico, resultado })
      : desenlace === 'pospuesto'
        ? errorDePosposicion(nuevaFecha, mantenimiento.fechaProgramada)
        : errorDeCancelacion(motivo)
  const errorEnLinea = !ancho && intentado && desenlace === 'realizado' && error === ERROR_QUE_SE_HIZO

  function elegir(valor: Respuesta) {
    setDesenlace(valor)
    setIntentado(false)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    setGuardando(true)
    if (desenlace === 'realizado') {
      await cerrarMantenimiento(mantenimiento.id, { fechaRealizada, tecnico, resultado })
      // Dice dónde quedó lo que se hizo (tarea 341, handoff móvil).
      avisar('Guardado. Queda en el historial del equipo', 'historial')
    } else if (desenlace === 'pospuesto') {
      await guardarRegistro('mantenimientos', { ...mantenimiento, estado: 'pospuesto', fechaProgramada: nuevaFecha }, motivo.trim())
      setNuevaFecha('')
      setMotivo('')
      setIntentado(false)
    } else {
      await guardarRegistro('mantenimientos', { ...mantenimiento, estado: 'cancelado' }, motivo.trim())
    }
    setGuardando(false)
    alTerminar?.()
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <span id={idPregunta} className={CLASE_ETIQUETA}>
          ¿Cómo terminó?
        </span>
        <div role="radiogroup" aria-labelledby={idPregunta} className="flex flex-col gap-1.5 max-md:gap-2">
          {RESPUESTAS.map((r) => (
            <OpcionRadio key={r.valor} activa={desenlace === r.valor} onClick={() => elegir(r.valor)} tarjeta detalle={r.detalle}>
              {r.texto}
            </OpcionRadio>
          ))}
        </div>
      </div>

      {desenlace === 'realizado' && (
        <>
          <Campo etiqueta="Fecha en que se hizo">
            <input
              type="date"
              required
              max={hoyIso()}
              value={fechaRealizada}
              onChange={(e) => setFechaRealizada(e.target.value)}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>
          <Campo etiqueta="Quién lo hizo">
            <input
              type="text"
              required
              value={tecnico}
              onChange={(e) => setTecnicoEscrito(e.target.value)}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>
          <Campo etiqueta="Qué se hizo y cómo quedó">
            <textarea
              rows={3}
              required
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              placeholder="Ej.: limpieza interna, cambio de cable de red"
              aria-invalid={errorEnLinea || undefined}
              aria-describedby={errorEnLinea ? idErrorResultado : undefined}
              className={`resize-y leading-[1.5] ${CLASE_CAMPO} ${errorEnLinea ? 'max-md:border-noct-error' : ''}`}
            />
          </Campo>
          {/* EL AVISO, EN LÍNEA (tarea 343): junto al campo que falta, con el
              borde del campo en rojo; la misma redacción de siempre. */}
          {errorEnLinea && (
            <p id={idErrorResultado} role="alert" className="-mt-2 flex items-center gap-1.5 text-[13.5px] text-noct-error">
              <WarningCircle size={15} className="shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </>
      )}

      {desenlace === 'pospuesto' && (
        <>
          <Campo etiqueta="Nueva fecha">
            <input
              type="date"
              required
              min={hoyIso()}
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>
          <Campo etiqueta="Motivo (opcional)">
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>
        </>
      )}

      {desenlace === 'cancelado' && (
        <Campo etiqueta="Por qué se cancela">
          <input
            type="text"
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={`min-h-11 ${CLASE_CAMPO}`}
          />
        </Campo>
      )}

      {intentado && error && !errorEnLinea && (
        <p role="alert" className="text-[12.5px] text-noct-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        // Guardar el desenlace hace avanzar: es la acción rellena de la
        // pantalla (regla 30). Cancelar es destructivo y va delineado en rojo.
        className={desenlace === 'cancelado' ? `${BTN_PRIMARIO_PELIGRO} min-h-11 self-start px-4 disabled:opacity-50` : `${BTN_PRIMARIO_RELLENO} w-full`}
      >
        {guardando
          ? 'Guardando...'
          : desenlace === 'realizado'
            ? 'Cerrar y registrar en el equipo'
            : desenlace === 'pospuesto'
              ? 'Posponer'
              : 'Cancelar mantenimiento'}
      </button>
    </form>
  )
}
