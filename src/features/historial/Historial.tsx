import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { db, type AccesoBoveda, type EjecucionDiagnostico, type HistorialEntrada, type TipoEntidadHistorial } from '../../lib/db'
import { Adjuntos } from '../../components/Adjuntos'
import { CaretDown, CaretUp } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { combinarEventos, ETIQUETA_ACCION_BOVEDA, etiquetaResuelto, formatearDuracion, type EventoLinea } from './lineaDeTiempo'
import { resumenDetalles } from './resumenDetalles'
import { resumenProcedimiento, textoContexto } from './resumenProcedimiento'
import { descripcionEntrada } from './textoHistorial'

interface Props {
  entidadTipo: TipoEntidadHistorial
  entidadId: string
}

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

// Linea de tiempo unificada (fase N4): ademas de los cambios de campos
// y las intervenciones manuales (ya conviven en `historial`, incluidos
// los cambios de cableado de un dispositivo), un articulo suma las
// ejecuciones de diagnostico que lo usaron y una credencial sus
// accesos de auditoria, cada uno desde su propia tabla inmutable. Se
// combinan aqui mismo (combinarEventos, lineaDeTiempo.ts) para que
// cada ficha siga usando un solo `<Historial>` sin cambiar su firma.
export function Historial({ entidadTipo, entidadId }: Props) {
  const [abierto, setAbierto] = useState(false)

  const entradas = useLiveQuery(
    () =>
      db.historial
        .where('[entidadTipo+entidadId]')
        .equals([entidadTipo, entidadId])
        .sortBy('fechaHora')
        .then((lista) => lista.reverse()),
    [entidadTipo, entidadId],
    [],
  )
  const ejecuciones = useLiveQuery(
    (): Promise<EjecucionDiagnostico[]> =>
      entidadTipo === 'articulo'
        ? db.ejecuciones_diagnostico
            .filter((e) => e.articulosEjecutados.some((a) => a.id === entidadId))
            .toArray()
        : Promise.resolve([]),
    [entidadTipo, entidadId],
    [] as EjecucionDiagnostico[],
  )
  const accesos = useLiveQuery(
    (): Promise<AccesoBoveda[]> =>
      entidadTipo === 'credencial'
        ? db.accesos_boveda.where('credencialId').equals(entidadId).toArray()
        : Promise.resolve([]),
    [entidadTipo, entidadId],
    [] as AccesoBoveda[],
  )

  const eventos = useMemo(() => combinarEventos(entradas, ejecuciones, accesos), [entradas, ejecuciones, accesos])

  return (
    <div className="border-t border-noct-divider">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex min-h-[52px] w-full items-center gap-2.5 px-0.5 py-1.5 text-left"
      >
        <TituloSeccion>Historial</TituloSeccion>
        <span className="text-[11px] text-noct-neutral-600">
          {eventos.length === 0 ? 'Sin cambios' : `${eventos.length} ${eventos.length === 1 ? 'cambio' : 'cambios'}`}
        </span>
        {abierto ? (
          <CaretUp size={14} className="ml-auto text-noct-neutral-500" aria-hidden />
        ) : (
          <CaretDown size={14} className="ml-auto text-noct-neutral-500" aria-hidden />
        )}
      </button>

      {abierto &&
        (eventos.length === 0 ? (
          <p className="pb-2 text-xs text-noct-neutral-500">Sin cambios registrados</p>
        ) : (
          <ul className="flex flex-col gap-2 pb-2 pt-1">
            {eventos.map((evento) => (
              <EventoItem key={`${evento.tipo}:${eventoId(evento)}`} evento={evento} />
            ))}
          </ul>
        ))}
    </div>
  )
}

function eventoId(evento: EventoLinea): string {
  switch (evento.tipo) {
    case 'historial':
      return evento.entrada.id
    case 'ejecucion_diagnostico':
      return evento.ejecucion.id
    case 'acceso_boveda':
      return evento.acceso.id
  }
}

function EventoItem({ evento }: { evento: EventoLinea }) {
  if (evento.tipo === 'ejecucion_diagnostico') return <EjecucionItem ejecucion={evento.ejecucion} />
  if (evento.tipo === 'acceso_boveda') return <AccesoItem acceso={evento.acceso} />
  return <EntradaItem entrada={evento.entrada} />
}

// Ejecucion de diagnostico que uso este articulo (fase N4): de un
// vistazo se ve si quedo resuelto, quien lo corrio y cuanto tardo, sin
// tener que ir a buscarlo en las estadisticas del diagnostico.
function EjecucionItem({ ejecucion }: { ejecucion: EjecucionDiagnostico }) {
  return (
    <li className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-noct-neutral-500">
        <span>{ejecucion.usuarioNombre || 'Usuario desconocido'}</span>
        <span>{formateadorFecha.format(new Date(ejecucion.fechaHora))}</span>
      </div>
      <p className="mt-1 text-sm text-noct-text">
        Ejecutó el diagnóstico{' '}
        <Link
          to={`/diagnostico/${ejecucion.diagnosticoId}`}
          className="text-noct-accent-300 underline decoration-dotted underline-offset-2 hover:text-noct-accent-400"
        >
          {ejecucion.diagnosticoTitulo}
        </Link>
      </p>
      <p className="mt-0.5 text-xs text-noct-neutral-400">
        {etiquetaResuelto(ejecucion.resuelto)} · {formatearDuracion(ejecucion.duracionSegundos)}
      </p>
      {ejecucion.solucionPropuesta && (
        <p className="mt-1 text-xs text-noct-neutral-400">Solución propuesta: {ejecucion.solucionPropuesta}</p>
      )}
    </li>
  )
}

// Acceso de auditoria a una credencial (fase N4): que hizo cada tecnico
// (consultar, mostrar, copiar, editar, eliminar) y cuando.
function AccesoItem({ acceso }: { acceso: AccesoBoveda }) {
  return (
    <li className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-noct-neutral-500">
        <span>{acceso.usuarioNombre || 'Usuario desconocido'}</span>
        <span>{formateadorFecha.format(new Date(acceso.fechaHora))}</span>
      </div>
      <p className="mt-1 text-sm text-noct-text">{ETIQUETA_ACCION_BOVEDA[acceso.accion]}</p>
    </li>
  )
}

function EntradaItem({ entrada }: { entrada: HistorialEntrada }) {
  return (
    <li className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-noct-neutral-500">
        <span>{entrada.usuarioNombre || 'Usuario desconocido'}</span>
        <span>{formateadorFecha.format(new Date(entrada.fechaHora))}</span>
      </div>
      {entrada.campo === 'procedimiento' ? (
        <CambioProcedimiento entrada={entrada} />
      ) : entrada.campo === 'detalles' ? (
        <CambioDetalles entrada={entrada} />
      ) : (
        <p className="mt-1 text-sm text-noct-text">{descripcionEntrada(entrada)}</p>
      )}
      {entrada.campo === 'intervencion' && (
        <div className="mt-2">
          <Adjuntos entidadTipo="historial" entidadId={entrada.id} />
        </div>
      )}
      {entrada.motivo && <p className="mt-1 text-xs text-noct-neutral-400">Motivo: {entrada.motivo}</p>}
    </li>
  )
}

// Cambio de un procedimiento: en vez del JSON completo, un resumen en
// lenguaje natural de que cambio y en que paso. El JSON crudo queda a
// mano en "Detalle técnico" (plegado) por si un desarrollador lo
// necesita para depurar.
function CambioProcedimiento({ entrada }: { entrada: HistorialEntrada }) {
  const resumen = useMemo(
    () => resumenProcedimiento(entrada.valorAnterior, entrada.valorNuevo),
    [entrada.valorAnterior, entrada.valorNuevo],
  )

  return (
    <ResumenCambios
      titulo="Cambios en el procedimiento"
      contexto={resumen.contexto ? `Antes: ${textoContexto(resumen.contexto)}` : null}
      cambios={resumen.cambios}
      entrada={entrada}
      valorVacio="(sin procedimiento)"
    />
  )
}

// Cambio de los "Campos adicionales" de un dispositivo: mismo patron
// que el procedimiento, pero comparando clave por clave del objeto.
function CambioDetalles({ entrada }: { entrada: HistorialEntrada }) {
  const resumen = useMemo(
    () => resumenDetalles(entrada.valorAnterior, entrada.valorNuevo),
    [entrada.valorAnterior, entrada.valorNuevo],
  )

  return (
    <ResumenCambios
      titulo="Cambios en los campos adicionales"
      contexto={null}
      cambios={resumen.cambios}
      entrada={entrada}
      valorVacio="(sin campos adicionales)"
    />
  )
}

function ResumenCambios({
  titulo,
  contexto,
  cambios,
  entrada,
  valorVacio,
}: {
  titulo: string
  contexto: string | null
  cambios: string[]
  entrada: HistorialEntrada
  valorVacio: string
}) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <p className="text-sm font-medium text-noct-text">{titulo}</p>
      {contexto && <p className="text-xs text-noct-neutral-500">{contexto}</p>}
      <ul className="flex flex-col gap-1">
        {cambios.map((cambio, indice) => (
          <li key={indice} className="flex gap-2 text-sm text-noct-text">
            <span aria-hidden className="text-noct-neutral-500">
              •
            </span>
            <span>{cambio}</span>
          </li>
        ))}
      </ul>
      <details className="text-xs text-noct-neutral-500">
        <summary className="cursor-pointer select-none">Detalle técnico</summary>
        <div className="mt-2 flex flex-col gap-2">
          <BloqueJson titulo="Antes" valor={entrada.valorAnterior} valorVacio={valorVacio} />
          <BloqueJson titulo="Después" valor={entrada.valorNuevo} valorVacio={valorVacio} />
        </div>
      </details>
    </div>
  )
}

function BloqueJson({
  titulo,
  valor,
  valorVacio,
}: {
  titulo: string
  valor: string
  valorVacio: string
}) {
  return (
    <div>
      <p className="mb-1 font-medium text-noct-neutral-400">{titulo}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-noct-divider bg-noct-bg p-2 text-[11px] text-noct-neutral-400">
        {jsonBonito(valor, valorVacio)}
      </pre>
    </div>
  )
}

function jsonBonito(valor: string, valorVacio: string): string {
  if (!valor) return valorVacio
  try {
    return JSON.stringify(JSON.parse(valor), null, 2)
  } catch {
    return valor
  }
}
