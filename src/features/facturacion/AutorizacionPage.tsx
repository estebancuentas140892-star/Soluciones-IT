import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { useOrigen } from '../../app/useOrigen'
import { CLASE_ETIQUETA } from '../../components/campos'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { PencilSimple, TrashSimple } from '../../components/iconos'
import { BTN_GHOST_TENUE, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { formatearNumero, textoRango } from '../../lib/autorizaciones'
import { db, type AutorizacionFacturacion } from '../../lib/db'
import { fechaConAnio } from '../../lib/mantenimientos'
import { conOrigen } from '../../lib/origenNavegacion'
import { eliminarRegistro } from '../../lib/repositorio'
import { evidenciaValida, motivoDeRevision, numerosRestantes, tieneConsecutivoLeido } from './autorizacion'
import { PastillaEstadoAutorizacion } from './PresentacionAutorizacion'

// UNA AUTORIZACIÓN DE FACTURACIÓN (tarea 321): consultarla. Se llega desde
// la ficha de un POS, desde la Agenda o desde la lista, y vuelve a donde
// se vino. Tres bloques que nunca se mezclan, cada uno con su rótulo:
//   - "Lo documentado": lo que dice la fuente, sin confirmar. El
//     vencimiento de la fuente se lee "según la fuente".
//   - "Lo confirmado": la verificación con una fuente actual y el
//     vencimiento confirmado; si no la hay, lo dice.
//   - "Consecutivo actual": la última lectura real, con su día y su
//     fuente, y cuántos números quedan según ella. Sin lectura no se
//     estima nada.
// Editar es otra pantalla (`AutorizacionForm`).

export function AutorizacionPage() {
  const { autorizacionId = '' } = useParams()
  const navigate = useNavigate()
  const origen = useOrigen()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const autorizacion = useLiveQuery(
    async () => (await db.autorizaciones_facturacion.get(autorizacionId)) ?? null,
    [autorizacionId],
  )
  const pos = useLiveQuery(
    async () => {
      if (!autorizacion) return []
      const encontrados = await db.dispositivos.bulkGet(autorizacion.dispositivoIds ?? [])
      return encontrados.filter((d): d is NonNullable<typeof d> => Boolean(d) && !d?.eliminadoEn)
    },
    [autorizacion],
  )
  const evidencia = useLiveQuery(
    async () => (autorizacion?.evidenciaAdjuntoId ? ((await db.adjuntos.get(autorizacion.evidenciaAdjuntoId)) ?? null) : null),
    [autorizacion],
  )

  if (autorizacion === null || autorizacion?.eliminadoEn) return <Navigate to="/facturacion" replace />
  if (!autorizacion) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  async function eliminar() {
    await eliminarRegistro('autorizaciones_facturacion', autorizacionId)
    navigate(origen?.to ?? '/facturacion')
  }

  const motivo = motivoDeRevision(autorizacion)
  const aqui = conOrigen(`/facturacion/${autorizacionId}`, `Autorización ${autorizacion.prefijo}`)
  // Solo un documento vivo de uno de sus POS: nunca el de un POS que ya no la usa.
  const evidenciaVigente = evidencia && evidenciaValida(evidencia, autorizacion.dispositivoIds ?? []) ? evidencia : null
  const posDeEvidencia = evidenciaVigente ? pos?.find((d) => d.id === evidenciaVigente.entidadId) : undefined

  return (
    <Chasis
      modo="documento"
      volverA="/facturacion"
      volverEtiqueta="Autorizaciones"
      titulo={autorizacion.prefijo}
      contexto="Autorización de facturación"
      barra={
        <div className="flex flex-col gap-1.5 px-4 pb-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25] [overflow-wrap:anywhere]">{autorizacion.prefijo}</h1>
            <PastillaEstadoAutorizacion estado={autorizacion.estado} />
          </div>
          {motivo && <p className="text-[12.5px] leading-[1.45] text-noct-neutral-400">{motivo}</p>}
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-5 px-4 pb-12 pt-3">
        <Bloque titulo="Lo documentado">
          <Dato etiqueta="Rango">{textoRango(autorizacion) || 'Sin rango documentado'}</Dato>
          {autorizacion.formulario && <Dato etiqueta="Formulario o documento">{autorizacion.formulario}</Dato>}
          {autorizacion.fechaFormalizacion && (
            <Dato etiqueta="Formalización">{fechaConAnio(autorizacion.fechaFormalizacion)}</Dato>
          )}
          {autorizacion.vigenciaReportada && <Dato etiqueta="Vigencia reportada">{autorizacion.vigenciaReportada}</Dato>}
          {autorizacion.vencimientoDocumentado && (
            <Dato etiqueta="Vence según la fuente (sin confirmar)">
              {fechaConAnio(autorizacion.vencimientoDocumentado)}
            </Dato>
          )}
          <Dato etiqueta="Fuente">{autorizacion.fuente}</Dato>
          {evidenciaVigente && (
            <Dato etiqueta="Documento">
              {evidenciaVigente.nombre}
              {posDeEvidencia && (
                <>
                  {' '}
                  <Link
                    to={`/dispositivos/${posDeEvidencia.id}#foto`}
                    state={aqui}
                    className="text-noct-accent-300 hover:text-noct-accent-400"
                  >
                    (en los adjuntos de {posDeEvidencia.nombre})
                  </Link>
                </>
              )}
            </Dato>
          )}
        </Bloque>

        <Bloque titulo="Lo confirmado">
          {autorizacion.verificadoEn ? (
            <Dato etiqueta="Última verificación">
              {fechaConAnio(autorizacion.verificadoEn)}
              {autorizacion.verificacionFuente && `, con ${autorizacion.verificacionFuente}`}
            </Dato>
          ) : (
            <p className="text-[13px] text-noct-neutral-400">Sin verificar con una fuente actual.</p>
          )}
          {autorizacion.vencimientoConfirmado && (
            <Dato etiqueta="Vencimiento confirmado">{fechaConAnio(autorizacion.vencimientoConfirmado)}</Dato>
          )}
        </Bloque>

        <Bloque titulo="Consecutivo actual">
          <Consecutivo autorizacion={autorizacion} />
        </Bloque>

        <Bloque titulo={pos && pos.length === 1 ? 'POS' : 'POS que la usan'}>
          {pos && pos.length > 0 ? (
            <ul className="flex flex-col divide-y divide-noct-divider">
              {pos.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/dispositivos/${d.id}`}
                    state={aqui}
                    className="flex min-h-11 items-center text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400 [overflow-wrap:anywhere]"
                  >
                    {d.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-noct-neutral-400">
              Sin POS asociado: la fuente no identifica el equipo. No se asigna uno hasta comprobarlo.
            </p>
          )}
        </Bloque>

        {autorizacion.observaciones && (
          <Bloque titulo="Observaciones">
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] text-noct-neutral-200 [overflow-wrap:anywhere]">
              {autorizacion.observaciones}
            </p>
          </Bloque>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Editar sube a esta ficha (regla 13): sin origen, su X vuelve
              aquí, y al guardar vuelve atrás, a esta ficha con el suyo. */}
          <Link to={`/facturacion/${autorizacionId}/editar`} className={`min-h-11 ${BTN_SECUNDARIO} px-4`}>
            <PencilSimple size={14} aria-hidden />
            Editar
          </Link>
          <button type="button" onClick={() => setMostrarEliminar(true)} className={`${BTN_GHOST_TENUE} min-h-11`}>
            <TrashSimple size={14} aria-hidden />
            Eliminar
          </button>
        </div>
      </main>

      <DialogoEliminar
        abierto={mostrarEliminar}
        titulo={`¿Eliminar la autorización ${autorizacion.prefijo}?`}
        descripcion="Sale de la ficha de sus POS y de la Agenda. Su historial queda en cada POS. Si fue sustituida por otra, márcala como reemplazada en vez de eliminarla."
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <TituloSeccion>{titulo}</TituloSeccion>
      <div className="flex flex-col divide-y divide-noct-divider">{children}</div>
    </section>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className={CLASE_ETIQUETA}>{etiqueta}</span>
      <span className="text-[13.5px] text-noct-text [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

function Consecutivo({ autorizacion }: { autorizacion: AutorizacionFacturacion }) {
  if (!tieneConsecutivoLeido(autorizacion)) {
    return <p className="text-[13px] text-noct-neutral-400">Sin lectura. No se estima por fechas ni por consumo.</p>
  }
  const restantes = numerosRestantes(autorizacion)
  return (
    <>
      <Dato etiqueta="Último emitido">
        {formatearNumero(autorizacion.consecutivoActual as number)}, leído el{' '}
        {fechaConAnio(autorizacion.consecutivoLeidoEn as string)} en {autorizacion.consecutivoFuente}
      </Dato>
      {restantes !== null && (
        <p className={`py-2 text-[13px] ${restantes === 0 ? 'text-noct-error' : 'text-noct-neutral-300'}`}>
          {restantes === 0
            ? 'Rango agotado según esa lectura.'
            : `Quedan ${formatearNumero(restantes)} ${restantes === 1 ? 'número' : 'números'} según esa lectura.`}
        </p>
      )}
    </>
  )
}
