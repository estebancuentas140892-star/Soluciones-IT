import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { useOrigen } from '../../app/useOrigen'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { HojaInferior } from '../../components/HojaInferior'
import { CaretRight, DotsThreeOutline, Note, Paperclip, PencilSimple, Pulse, SealCheck, Storefront, TrashSimple } from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_ICONO_SECUNDARIO } from '../../components/nocturne'
import { formatearNumero, textoRango } from '../../lib/autorizaciones'
import { db, type AutorizacionFacturacion } from '../../lib/db'
import { fechaConAnio } from '../../lib/mantenimientos'
import { conOrigen } from '../../lib/origenNavegacion'
import { eliminarRegistro } from '../../lib/repositorio'
import { evidenciaValida, motivoDeRevision, numerosRestantes, tieneConsecutivoLeido } from './autorizacion'
import { PastillaEstadoAutorizacion } from './PresentacionAutorizacion'
import { RegistrarLectura } from './RegistrarLectura'

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
  const [menuAbierto, setMenuAbierto] = useState(false)
  // La hoja de la lectura del consecutivo (RP-2, tarea 335).
  const [leyendo, setLeyendo] = useState(false)
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

  const reemplazada = autorizacion.estado === 'reemplazada'

  return (
    <Chasis
      modo="documento"
      volverA="/facturacion"
      volverEtiqueta="Autorizaciones"
      titulo={autorizacion.prefijo}
      contexto="Autorización de facturación"
      acciones={
        // ELIMINAR, EN EL MENÚ (regla 30): lo destructivo no va junto a Editar.
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Más acciones: eliminar"
          aria-expanded={menuAbierto}
          className={BTN_ICONO_SECUNDARIO}
        >
          <DotsThreeOutline size={17} aria-hidden />
        </button>
      }
      barra={
        menuAbierto && (
          <div className="flex flex-wrap gap-2 border-t border-noct-divider px-4 pb-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false)
                setMostrarEliminar(true)
              }}
              className={`${BTN_GHOST_PELIGRO} min-h-11`}
            >
              <TrashSimple size={14} aria-hidden />
              Eliminar
            </button>
          </div>
        )
      }
    >
      {/* LA AUTORIZACIÓN EN TRES FORMAS (rediseño móvil "1b Pulgar", tarea
          331, AD-081): lo documentado con borde punteado y "según" su
          fuente, lo confirmado en superficie sólida con barra verde, y el
          dato actual como la lectura de un instrumento. Una reemplazada se
          lee atenuada.
          Desde 768 px (tarea 338) se conservan las tres capas y su orden,
          con la letra, los rótulos (TituloSeccion), los radios y los
          botones de antes del rediseño móvil (06be087): cada dato con su
          rótulo arriba y su valor abajo, y Editar delineado al final, sin
          barra pegada. El eje es el de antes, `px-4` también en escritorio. */}
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-4 pt-4 md:gap-5 md:pb-12 md:pt-3">
        <section className="flex flex-col gap-2 md:gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5 md:gap-2">
            <h1 className="m-0 font-mono text-[30px] font-semibold leading-[1.1] tracking-[-.02em] [overflow-wrap:anywhere] md:font-inter md:text-[22px] md:font-medium md:leading-[1.25] md:tracking-normal">
              {autorizacion.prefijo}
            </h1>
            <PastillaEstadoAutorizacion estado={autorizacion.estado} />
          </div>
          {motivo && <p className="text-[14.5px] leading-[1.45] text-noct-neutral-300 md:text-[12.5px] md:text-noct-neutral-400">{motivo}</p>}
        </section>

        <div className={`flex flex-col gap-[22px] md:gap-5 ${reemplazada ? 'opacity-[.62]' : ''}`}>
          <section aria-labelledby="aut-documentado" className="flex flex-col gap-2.5 md:gap-1">
            <EncabezadoCapa
              id="aut-documentado"
              numero={1}
              titulo="Lo documentado"
              icono={
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-noct-neutral-400 text-noct-neutral-300 md:hidden">
                  <Note size={15} aria-hidden />
                </span>
              }
            />
            <div className="rounded-[14px] border-[1.5px] border-dashed border-noct-text/25 px-3.5 pb-1.5 pt-1 md:rounded-lg md:border md:border-noct-divider md:px-3">
              <p className="flex items-center gap-1.5 pb-1 pt-2 text-[13px] font-semibold text-noct-neutral-400 [overflow-wrap:anywhere] md:text-[12.5px] md:font-medium">
                <Paperclip size={13} className="shrink-0" aria-hidden />
                Según {autorizacion.fuente}
              </p>
              <DatoDocumentado etiqueta="Rango">{textoRango(autorizacion) || 'Sin rango documentado'}</DatoDocumentado>
              {autorizacion.formulario && <DatoDocumentado etiqueta="Formulario o documento">{autorizacion.formulario}</DatoDocumentado>}
              {autorizacion.fechaFormalizacion && (
                <DatoDocumentado etiqueta="Formalización">{fechaConAnio(autorizacion.fechaFormalizacion)}</DatoDocumentado>
              )}
              {autorizacion.vigenciaReportada && (
                <DatoDocumentado etiqueta="Vigencia reportada">{autorizacion.vigenciaReportada}</DatoDocumentado>
              )}
              {autorizacion.vencimientoDocumentado && (
                <DatoDocumentado etiqueta="Vence según la fuente (sin confirmar)">
                  {fechaConAnio(autorizacion.vencimientoDocumentado)}
                </DatoDocumentado>
              )}
              {evidenciaVigente && (
                <DatoDocumentado etiqueta="Documento">
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
                </DatoDocumentado>
              )}
            </div>
          </section>

          <section aria-labelledby="aut-confirmado" className="flex flex-col gap-2.5 md:gap-1">
            <EncabezadoCapa
              id="aut-confirmado"
              numero={2}
              titulo="Lo confirmado"
              icono={
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-noct-exito/[.13] text-noct-exito md:hidden">
                  <SealCheck size={16} aria-hidden />
                </span>
              }
            />
            {autorizacion.verificadoEn ? (
              <div className="rounded-[14px] border border-l-4 border-noct-divider border-l-noct-exito bg-noct-surface px-3.5 py-1 md:rounded-lg md:px-3">
                <div className="flex justify-between gap-3 border-b border-noct-divider py-2.5 last:border-b-0 md:flex-col md:justify-start md:gap-0.5 md:py-2">
                  <span className={`text-[13px] text-noct-neutral-400 ${ETIQUETA_MD}`}>Verificada</span>
                  <span className={`text-right text-[14.5px] font-medium ${VALOR_MD}`}>
                    {fechaConAnio(autorizacion.verificadoEn)}
                    {autorizacion.verificacionFuente && (
                      <span className="block text-[12.5px] font-normal text-noct-neutral-400 [overflow-wrap:anywhere]">
                        con {autorizacion.verificacionFuente}
                      </span>
                    )}
                  </span>
                </div>
                {autorizacion.vencimientoConfirmado && (
                  <div className="flex justify-between gap-3 py-2.5 md:flex-col md:justify-start md:gap-0.5 md:py-2">
                    <span className={`text-[13px] text-noct-neutral-400 ${ETIQUETA_MD}`}>Vence</span>
                    {/* El verde se queda desde 768 px: dice "confirmado" (tarea 338). */}
                    <span className="text-[14.5px] font-semibold text-noct-exito md:text-[13.5px] md:font-normal">
                      {fechaConAnio(autorizacion.vencimientoConfirmado)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 rounded-[14px] border border-noct-divider bg-noct-surface p-3.5 md:rounded-lg md:p-3">
                <p className="text-[14.5px] text-noct-neutral-300 md:text-[13px] md:text-noct-neutral-400">Sin verificar con una fuente actual.</p>
                {/* Abre el formulario de siempre, donde se registra la
                    verificación con su día y su fuente. */}
                <Link to={`/facturacion/${autorizacionId}/editar`} className={ACCION_DELINEADA}>
                  <SealCheck size={16} aria-hidden />
                  Registrar verificación
                </Link>
              </div>
            )}
          </section>

          <section aria-labelledby="aut-actual" className="flex flex-col gap-2.5 md:gap-1">
            <EncabezadoCapa
              id="aut-actual"
              numero={3}
              titulo="Dato actual"
              icono={
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-noct-accent/[.14] text-noct-accent-300 md:hidden">
                  <Pulse size={16} aria-hidden />
                </span>
              }
            />
            <Consecutivo
              autorizacion={autorizacion}
              editar={`/facturacion/${autorizacionId}/editar`}
              onRegistrarLectura={() => setLeyendo(true)}
            />
          </section>

          <section aria-labelledby="aut-pos" className="flex flex-col md:gap-1">
            <h2 id="aut-pos" className={`pb-0.5 text-[13.5px] font-semibold text-noct-neutral-400 md:pb-0 ${TITULO_SECCION_MD}`}>
              {pos && pos.length === 1 ? 'POS' : 'POS que la usan'}
            </h2>
            {pos && pos.length > 0 ? (
              <ul className="flex flex-col md:divide-y md:divide-noct-divider">
                {pos.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/dispositivos/${d.id}`}
                      state={aqui}
                      className="flex min-h-[52px] items-center gap-3 border-b border-noct-divider text-noct-text hover:bg-noct-text/[.04] md:min-h-11 md:border-b-0 md:text-noct-accent-300 md:hover:bg-transparent md:hover:text-noct-accent-400"
                    >
                      {/* Desde 768 px, el enlace de texto de antes (tarea 338). */}
                      <Storefront size={18} className="shrink-0 text-noct-neutral-400 md:hidden" aria-hidden />
                      <span className="min-w-0 flex-1 text-[15px] [overflow-wrap:anywhere] md:text-[13.5px]">{d.nombre}</span>
                      <CaretRight size={14} className="shrink-0 text-noct-neutral-500 md:hidden" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2.5 text-[14px] leading-[1.45] text-noct-neutral-400 md:py-0 md:text-[13px] md:leading-[inherit]">
                Sin POS asociado: la fuente no identifica el equipo. No se asigna uno hasta comprobarlo.
              </p>
            )}
          </section>

          {autorizacion.observaciones && (
            <section className="flex flex-col gap-1">
              <h2 className={`text-[13.5px] font-semibold text-noct-neutral-400 ${TITULO_SECCION_MD}`}>Observaciones</h2>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-noct-neutral-200 [overflow-wrap:anywhere] md:text-[13.5px]">
                {autorizacion.observaciones}
              </p>
            </section>
          )}
        </div>

        {/* EDITAR, ABAJO Y DELINEADO: no hace avanzar nada. Sube a esta
            ficha (regla 13): sin origen, su X vuelve aquí. Desde 768 px
            (tarea 338), el Editar de antes: secundario, al final del
            contenido y sin barra pegada. */}
        <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:static md:bottom-0 md:mx-0 md:mt-0 md:flex md:flex-wrap md:gap-2 md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <Link
            to={`/facturacion/${autorizacionId}/editar`}
            className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-noct-text/25 text-[15.5px] font-semibold text-noct-text hover:bg-noct-text/[.05] md:inline-flex md:h-auto md:w-auto md:px-4 ${BOTON_SECUNDARIO_MD}`}
          >
            <PencilSimple size={17} aria-hidden />
            Editar
          </Link>
        </div>
      </main>

      {/* Se monta solo abierta: cada lectura empieza en blanco. */}
      <HojaInferior
        abierta={leyendo}
        onCerrar={() => setLeyendo(false)}
        titulo="Registrar lectura"
        contexto={[autorizacion.prefijo, textoRango(autorizacion)].filter(Boolean).join(' · ')}
      >
        {leyendo && <RegistrarLectura autorizacion={autorizacion} alTerminar={() => setLeyendo(false)} />}
      </HojaInferior>

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

// DESDE 768 PX, EL LENGUAJE DE ANTES DEL REDISEÑO MÓVIL (tarea 338, 06be087):
// el rótulo de sección de TituloSeccion, el rótulo y el valor de un dato
// (CLASE_ETIQUETA arriba, el valor a 13.5 px debajo) y el botón secundario
// (BTN_SECUNDARIO con `min-h-11`), como variantes `md:`.
const TITULO_SECCION_MD = 'md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500'
const ETIQUETA_MD = 'md:text-[12.5px] md:font-medium'
const VALOR_MD = 'md:text-left md:text-[13.5px] md:font-normal md:text-noct-text'
const BOTON_SECUNDARIO_MD =
  'md:min-h-11 md:gap-1.5 md:rounded-lg md:border md:border-noct-divider md:py-[7px] md:text-[13px] md:font-medium md:leading-tight md:hover:bg-noct-text/[.07] md:active:bg-noct-text/15 md:[&>svg]:size-3.5'

const ACCION_DELINEADA = `inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-noct-text/25 px-3.5 text-[14px] font-semibold text-noct-text hover:bg-noct-text/[.05] md:px-4 ${BOTON_SECUNDARIO_MD}`

/** El rótulo de una capa: su número, su forma y su nombre. */
function EncabezadoCapa({ id, numero, titulo, icono }: { id: string; numero: number; titulo: string; icono: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icono}
      <h2 id={id} className={`text-[12.5px] font-bold uppercase tracking-[.06em] text-noct-neutral-300 ${TITULO_SECCION_MD}`}>
        {numero} · {titulo}
      </h2>
    </div>
  )
}

/**
 * Un dato de lo documentado: el nombre a la izquierda y el valor a la derecha, con divisor punteado.
 * Desde 768 px (tarea 338), el rótulo arriba y el valor abajo, como antes; el punteado se queda.
 */
function DatoDocumentado({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-noct-divider py-2 md:flex-col md:items-stretch md:justify-start md:gap-0.5">
      <span className={`min-w-0 flex-1 text-[13px] text-noct-neutral-400 md:flex-none ${ETIQUETA_MD}`}>{etiqueta}</span>
      <span className={`max-w-[62%] text-right text-[14.5px] font-medium text-noct-neutral-200 [overflow-wrap:anywhere] md:max-w-none ${VALOR_MD}`}>{children}</span>
    </div>
  )
}

// EL DATO ACTUAL, COMO LA LECTURA DE UN INSTRUMENTO (tarea 331): el último
// emitido grande y en IBM Plex Mono, la barra del rango gastado, cuántos
// quedan y cuándo y dónde se leyó. Sin lectura, un guion y por qué no se
// estima. Desde la tarea 335 (RP-2), "Registrar lectura" abre una hoja con
// solo los tres campos de la lectura, con o sin una anterior; sin rango no
// se puede registrar ninguna, y entonces lleva al formulario, donde se
// documenta el rango.
function Consecutivo({
  autorizacion,
  editar,
  onRegistrarLectura,
}: {
  autorizacion: AutorizacionFacturacion
  editar: string
  onRegistrarLectura: () => void
}) {
  const conRango = autorizacion.rangoDesde !== null && autorizacion.rangoHasta !== null
  const registrar = conRango ? (
    <button type="button" onClick={onRegistrarLectura} className={ACCION_DELINEADA}>
      <Pulse size={16} aria-hidden />
      Registrar lectura
    </button>
  ) : (
    <Link to={editar} className={ACCION_DELINEADA}>
      <Pulse size={16} aria-hidden />
      Registrar lectura
    </Link>
  )
  if (!tieneConsecutivoLeido(autorizacion)) {
    return (
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-noct-text/25 bg-noct-bg p-3.5 md:rounded-lg md:border-noct-divider md:p-3">
        {/* El guion del instrumento sin lectura: desde 768 px (tarea 338)
            lo dice solo el texto, como antes. */}
        <span aria-hidden className="flex h-[26px] items-center md:hidden">
          <span className="block h-[3px] w-7 rounded-full bg-noct-neutral-500" />
        </span>
        <p className="text-[14px] leading-[1.45] text-noct-neutral-300 md:text-[13px] md:leading-[inherit] md:text-noct-neutral-400">
          Sin lectura. No se estima por fechas ni por consumo.
        </p>
        {registrar}
      </div>
    )
  }
  const restantes = numerosRestantes(autorizacion)
  const actual = autorizacion.consecutivoActual as number
  const { rangoDesde: desde, rangoHasta: hasta } = autorizacion
  const gastado =
    desde !== null && hasta !== null && hasta > desde ? Math.min(100, Math.max(0, ((actual - desde) / (hasta - desde)) * 100)) : null
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-noct-text/25 bg-noct-bg p-3.5 md:rounded-lg md:border-noct-divider md:p-3">
      <p className="text-[12.5px] text-noct-neutral-400 md:font-medium">Último emitido</p>
      {/* Desde 768 px (tarea 338) el número sigue siendo la lectura, en la
          letra monoespaciada del sistema y al tamaño del título de antes. */}
      <p className="font-mono text-[34px] font-semibold leading-none tracking-[-.02em] text-noct-accent-300 md:text-[22px] md:font-medium md:leading-[1.25] md:tracking-normal md:text-noct-text">
        {formatearNumero(actual)}
      </p>
      {gastado !== null && (
        <div aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-noct-text/[.06]">
          <div className={`h-full ${restantes === 0 ? 'bg-noct-error' : 'bg-noct-accent'}`} style={{ width: `${gastado}%` }} />
        </div>
      )}
      {restantes !== null && (
        <p className={`text-[13.5px] md:text-[13px] ${restantes === 0 ? 'text-noct-error' : 'text-noct-neutral-300'}`}>
          {restantes === 0 ? (
            'Rango agotado según esa lectura.'
          ) : (
            <>
              Quedan <span className="font-mono font-semibold md:font-inter md:font-normal">{formatearNumero(restantes)}</span>{' '}
              {restantes === 1 ? 'número' : 'números'} según esa lectura.
            </>
          )}
        </p>
      )}
      <p className="text-[12.5px] text-noct-neutral-400 [overflow-wrap:anywhere]">
        Leído el {fechaConAnio(autorizacion.consecutivoLeidoEn as string)} en {autorizacion.consecutivoFuente}
      </p>
      {registrar}
    </div>
  )
}
