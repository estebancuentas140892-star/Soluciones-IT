import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { useOrigen } from '../../app/useOrigen'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { EsqueletoAutorizacion } from '../../components/Esqueleto'
import { HojaInferior } from '../../components/HojaInferior'
import {
  ArrowsClockwise,
  CaretRight,
  DotsThreeOutline,
  Note,
  Paperclip,
  PencilSimple,
  Pulse,
  SealCheck,
  Storefront,
  TrashSimple,
} from '../../components/iconos'
import {
  BTN_DELINEADO_CABECERA,
  BTN_GHOST_PELIGRO,
  BTN_ICONO_SECUNDARIO,
  FILA_ACCION_HOJA,
  FILA_ACCION_HOJA_PELIGRO,
} from '../../components/nocturne'
import { IconoCategoria } from '../../components/IconoCategoria'
import { useEsAncho } from '../../components/useEsAncho'
import {
  DELINEADO_EN_TELEFONO,
  FILAS_EN_TARJETA,
  RELIEVE_BORDE_FUERTE,
  RELIEVE_EN_TELEFONO,
  TITULO_GRUPO_EN_TELEFONO,
} from '../../components/ventana/estilos'
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
//
// EN EL TELÉFONO, LAS PIEZAS DE «VENTANA» (tarea 352): los rótulos de capa a
// 800, las tres formas (punteada, barra verde, instrumento) con el radio y el
// relieve del prototipo, la pastilla tintada del estado, cada POS en su fila
// con el icono de su clase (como en Equipos) y «Editar» en el pie con relieve.
// Lo que dice cada capa y en qué orden, igual; desde 768, lo de siempre.

export function AutorizacionPage() {
  const { autorizacionId = '' } = useParams()
  const navigate = useNavigate()
  const origen = useOrigen()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  // La hoja de la lectura del consecutivo (RP-2, tarea 335).
  const [leyendo, setLeyendo] = useState(false)
  // "Editar" va en la barra fija del teléfono y, desde 768 px, en la
  // cabecera (tarea 339): una sola vez por ventana.
  const ancho = useEsAncho()
  // EL PREFIJO, UNA SOLA VEZ EN EL TELÉFONO (tarea 343, como la ficha de un
  // equipo): mientras el carnet está a la vista, la cabecera dice solo a
  // dónde se vuelve; cuando el prefijo grande sale por arriba, sube a ella.
  // Desde 768, la cabecera de siempre, con el prefijo.
  const [nodoPrefijo, setNodoPrefijo] = useState<HTMLElement | null>(null)
  const [prefijoALaVista, setPrefijoALaVista] = useState(true)
  useEffect(() => {
    if (!nodoPrefijo || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(([entrada]) => setPrefijoALaVista(entrada.isIntersecting), {
      rootMargin: '-56px 0px 0px 0px',
    })
    observador.observe(nodoPrefijo)
    return () => observador.disconnect()
  }, [nodoPrefijo])
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
  // Mientras se lee, su forma: el prefijo, el secuencial y las tres capas
  // del dato (tarea 342). Nada se afirma antes de leer.
  if (!autorizacion) {
    return (
      <Chasis modo="documento">
        <main className="flex flex-1 flex-col px-4 pb-4 pt-2">
          <EsqueletoAutorizacion />
        </main>
      </Chasis>
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
      tituloVisible={ancho ? undefined : !prefijoALaVista}
      // EDITAR, DELINEADO EN LA CABECERA DESDE 768 PX (tarea 339): no hace
      // avanzar nada, así que no es relleno. Detrás del menú, como en la
      // ficha de un equipo.
      accionPrincipal={
        <Link to={`/facturacion/${autorizacionId}/editar`} className={BTN_DELINEADO_CABECERA}>
          <PencilSimple size={16} aria-hidden />
          Editar
        </Link>
      }
      acciones={
        // ELIMINAR, EN EL MENÚ (regla 30): lo destructivo no va junto a Editar.
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label={ancho ? 'Más acciones: eliminar' : 'Acciones de la autorización: editar, marcar como reemplazada o eliminar'}
          aria-expanded={menuAbierto}
          aria-haspopup={ancho ? undefined : 'dialog'}
          className={BTN_ICONO_SECUNDARIO}
        >
          <DotsThreeOutline size={17} aria-hidden />
        </button>
      }
      // En el teléfono el menú es una hoja (tarea 343, ver `MenuAutorizacion`
      // al final); desde 768, la banda de siempre.
      barra={
        menuAbierto && ancho && (
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
          lee atenuada. */}
      <main className="@container flex flex-1 flex-col gap-[22px] px-4 pb-4 pt-4 lg:px-10">
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1
              ref={setNodoPrefijo}
              className="m-0 font-mono text-[30px] font-semibold leading-[1.1] tracking-[-.02em] [overflow-wrap:anywhere]"
            >
              {autorizacion.prefijo}
            </h1>
            {/* En el teléfono, con su punto (tarea 343). */}
            <PastillaEstadoAutorizacion estado={autorizacion.estado} conPunto />
          </div>
          {motivo && <p className="text-[14.5px] leading-[1.45] text-noct-neutral-300">{motivo}</p>}
        </section>

        <div className={`flex flex-col gap-[22px] ${reemplazada ? 'opacity-[.62]' : ''}`}>
          {/* LAS TRES CAPAS EN PARALELO desde 880 px de contenido (tarea 339,
              T8; pizarra Facturación 1280): se comparan de un vistazo, cada
              una con su forma. Por debajo, apiladas, como siempre (la
              envoltura no existe: `contents`). */}
          <div className="contents @[880px]:grid @[880px]:grid-cols-3 @[880px]:items-start @[880px]:gap-6">
            <section aria-labelledby="aut-documentado" className="flex flex-col gap-2.5">
              <EncabezadoCapa
                id="aut-documentado"
                numero={1}
                titulo="Lo documentado"
                descripcion="Lo que dice cada fuente. Nadie lo ha comprobado."
                icono={
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-noct-neutral-400 text-noct-neutral-300">
                    <Note size={15} aria-hidden />
                  </span>
                }
              />
              <div data-documentado className="rounded-[14px] border-[1.5px] border-dashed border-noct-text/25 px-3.5 pb-1.5 pt-1 max-md:rounded-2xl max-md:border-noct-divider-fuerte max-md:px-4">
                <p className="flex items-center gap-1.5 pb-1 pt-2 text-[13px] font-semibold text-noct-neutral-400 [overflow-wrap:anywhere] max-md:pt-2.5 max-md:text-[14px] max-md:font-bold max-md:text-noct-neutral-300">
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

            <section aria-labelledby="aut-confirmado" className="flex flex-col gap-2.5">
              <EncabezadoCapa
                id="aut-confirmado"
                numero={2}
                titulo="Lo confirmado"
                descripcion="Comprobado con una fuente actual."
                icono={
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-noct-exito/(--tinte-estado) text-noct-exito">
                    <SealCheck size={16} aria-hidden />
                  </span>
                }
              />
              {autorizacion.verificadoEn ? (
                <div className={`rounded-[14px] border border-l-4 border-noct-divider border-l-noct-exito bg-noct-surface px-3.5 py-1 shadow-[var(--shadow-noct-elevacion)] max-md:px-4 ${RELIEVE_EN_TELEFONO}`}>
                  <div className="flex justify-between gap-3 border-b border-noct-divider py-2.5 last:border-b-0">
                    <span className="text-[13px] text-noct-neutral-400 max-md:text-[14px] max-md:text-noct-neutral-300">Verificada</span>
                    <span className="text-right text-[14.5px] font-medium max-md:text-[15px] max-md:font-semibold">
                      {fechaConAnio(autorizacion.verificadoEn)}
                      {autorizacion.verificacionFuente && (
                        <span className="block text-[12.5px] font-normal text-noct-neutral-400 [overflow-wrap:anywhere] max-md:text-[13.5px] max-md:text-noct-neutral-300">
                          con {autorizacion.verificacionFuente}
                        </span>
                      )}
                    </span>
                  </div>
                  {autorizacion.vencimientoConfirmado && (
                    <div className="flex justify-between gap-3 py-2.5">
                      <span className="text-[13px] text-noct-neutral-400 max-md:text-[14px] max-md:text-noct-neutral-300">Vence</span>
                      <span className="text-[14.5px] font-semibold text-noct-exito max-md:text-[15px] max-md:font-bold">{fechaConAnio(autorizacion.vencimientoConfirmado)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col gap-2.5 rounded-[14px] border border-noct-divider bg-noct-surface p-3.5 shadow-[var(--shadow-noct-elevacion)] max-md:border-[1.5px] max-md:p-4 ${RELIEVE_EN_TELEFONO}`}>
                  <p className="text-[14.5px] text-noct-neutral-300">Sin verificar con una fuente actual.</p>
                  {/* Abre el formulario de siempre, donde se registra la
                      verificación con su día y su fuente. */}
                  <Link to={`/facturacion/${autorizacionId}/editar`} className={ACCION_DELINEADA}>
                    <SealCheck size={16} aria-hidden />
                    Registrar verificación
                  </Link>
                </div>
              )}
            </section>

            <section aria-labelledby="aut-actual" className="flex flex-col gap-2.5">
              <EncabezadoCapa
                id="aut-actual"
                numero={3}
                titulo="Dato actual"
                descripcion="El consecutivo leído en el POS."
                icono={
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-noct-accent/[.14] text-noct-accent-300">
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
          </div>

          <section aria-labelledby="aut-pos" className="flex flex-col">
            <h2 id="aut-pos" className={`pb-0.5 text-[13.5px] font-semibold text-noct-neutral-400 max-md:px-1 max-md:pb-1.5 ${TITULO_GRUPO_EN_TELEFONO}`}>
              {pos && pos.length === 1 ? 'POS' : 'POS que la usan'}
            </h2>
            {pos && pos.length > 0 ? (
              <ul className={`flex flex-col max-md:divide-y max-md:divide-noct-divider ${FILAS_EN_TARJETA}`}>
                {pos.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/dispositivos/${d.id}`}
                      state={aqui}
                      className="flex min-h-[52px] items-center gap-3 border-b border-noct-divider text-noct-text hover:bg-noct-text/[.04] max-md:min-h-16 max-md:border-b-0 max-md:active:bg-noct-presionado"
                    >
                      {ancho ? (
                        <Storefront size={18} className="shrink-0 text-noct-neutral-400" aria-hidden />
                      ) : (
                        <IconoCategoria clase="pos" tam={40} />
                      )}
                      <span className="min-w-0 flex-1 text-[15px] [overflow-wrap:anywhere] max-md:text-[16px] max-md:font-bold">{d.nombre}</span>
                      <CaretRight size={14} className="shrink-0 text-noct-neutral-500 max-md:text-noct-neutral-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2.5 text-[14px] leading-[1.45] text-noct-neutral-400">
                Sin POS asociado: la fuente no identifica el equipo. No se asigna uno hasta comprobarlo.
              </p>
            )}
          </section>

          {autorizacion.observaciones && (
            <section className="flex flex-col gap-1">
              <h2 className={`text-[13.5px] font-semibold text-noct-neutral-400 max-md:px-1 ${TITULO_GRUPO_EN_TELEFONO}`}>Observaciones</h2>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-noct-neutral-200 [overflow-wrap:anywhere] max-md:px-1 max-md:text-[15px]">
                {autorizacion.observaciones}
              </p>
            </section>
          )}
        </div>

        {/* EDITAR, ABAJO Y DELINEADO: no hace avanzar nada. Sube a esta
            ficha (regla 13): sin origen, su X vuelve aquí. Solo en el
            teléfono; desde 768 px va en la cabecera (tarea 339). */}
        {!ancho && (
          <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-surface px-3 pb-3 pt-3 shadow-[var(--shadow-noct-pie)] md:hidden lg:-mx-10">
            <Link
              to={`/facturacion/${autorizacionId}/editar`}
              className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-noct-divider-fuerte bg-noct-surface text-[16px] font-extrabold text-noct-text ${RELIEVE_BORDE_FUERTE}`}
            >
              <PencilSimple size={18} aria-hidden />
              Editar
            </Link>
          </div>
        )}
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

      {/* EL MENÚ "···" EN EL TELÉFONO (tarea 343, handoff móvil): una hoja con
          editar y marcar como reemplazada y, aparte y en rojo, eliminar.
          "Marcar como reemplazada" no es otra implementación: lleva al
          formulario de siempre, donde ese estado se elige. Desde 768, la
          banda de siempre bajo la cabecera. */}
      {!ancho && (
        <HojaInferior
          abierta={menuAbierto}
          onCerrar={() => setMenuAbierto(false)}
          titulo="Acciones de la autorización"
          contexto={autorizacion.prefijo}
        >
          <div role="group" aria-label="Acciones de la autorización" className="flex flex-col">
            <Link to={`/facturacion/${autorizacionId}/editar`} onClick={() => setMenuAbierto(false)} className={FILA_ACCION_HOJA}>
              <PencilSimple size={19} className="shrink-0 text-noct-neutral-300" aria-hidden />
              Editar autorización
            </Link>
            {!reemplazada && (
              <Link to={`/facturacion/${autorizacionId}/editar`} onClick={() => setMenuAbierto(false)} className={FILA_ACCION_HOJA}>
                <ArrowsClockwise size={19} className="shrink-0 text-noct-neutral-300" aria-hidden />
                <span className="min-w-0 flex-1 py-1.5">
                  <span className="block">Marcar como reemplazada</span>
                  <span className="block text-[13px] text-noct-neutral-400">Se elige en su estado, al editarla</span>
                </span>
              </Link>
            )}
          </div>
          <div role="group" aria-label="Eliminar la autorización" className="mt-[18px] flex flex-col border-t border-noct-divider [&>*:last-child]:border-b-0">
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false)
                setMostrarEliminar(true)
              }}
              className={FILA_ACCION_HOJA_PELIGRO}
            >
              <TrashSimple size={19} className="shrink-0" aria-hidden />
              Eliminar
            </button>
          </div>
        </HojaInferior>
      )}

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

// En el teléfono (tarea 352), el control delineado del prototipo «Ventana».
const ACCION_DELINEADA = `inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-noct-text/25 px-3.5 text-[14px] font-semibold text-noct-text hover:bg-noct-text/[.05] ${DELINEADO_EN_TELEFONO}`

/**
 * El rótulo de una capa: su número, su forma y su nombre. En el teléfono,
 * debajo, qué representa con las palabras del handoff (tarea 343): las tres
 * capas son la misma autorización leída de tres maneras, y así se lee.
 * Desde la tarea 345, en el teléfono el nombre va como frase, a 15, igual
 * que los rótulos de la guía y del mantenimiento: sin mayúsculas sostenidas.
 */
function EncabezadoCapa({
  id,
  numero,
  titulo,
  descripcion,
  icono,
}: {
  id: string
  numero: number
  titulo: string
  descripcion: string
  icono: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {icono}
      <div className="min-w-0">
        <h2
          id={id}
          className="text-[12.5px] font-bold uppercase tracking-[.06em] text-noct-neutral-300 max-md:text-[16px] max-md:font-extrabold max-md:normal-case max-md:tracking-normal max-md:text-noct-text"
        >
          {numero} · {titulo}
        </h2>
        <p className="text-[12.5px] leading-snug text-noct-neutral-400 md:hidden max-md:text-[14px] max-md:text-noct-neutral-300">{descripcion}</p>
      </div>
    </div>
  )
}

/** Un dato de lo documentado: el nombre a la izquierda y el valor a la derecha, con divisor punteado. */
function DatoDocumentado({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-noct-divider py-2 max-md:py-2.5">
      <span className="min-w-0 flex-1 text-[13px] text-noct-neutral-400 max-md:text-[14px] max-md:text-noct-neutral-300">{etiqueta}</span>
      <span className="max-w-[62%] text-right text-[14.5px] font-medium text-noct-neutral-200 [overflow-wrap:anywhere] max-md:text-[15px] max-md:font-semibold max-md:text-noct-text">{children}</span>
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
      <div data-instrumento className="flex flex-col gap-2.5 rounded-[14px] border border-noct-text/25 bg-noct-bg p-3.5 max-md:rounded-2xl max-md:border-[1.5px] max-md:border-noct-divider-fuerte max-md:p-4">
        {/* EL INSTRUMENTO, VACÍO, EN EL TELÉFONO (tarea 343, handoff): la
            misma lectura sin número, su rótulo, el marcador en IBM Plex Mono
            y, si el rango está documentado, su carril sin llenar. Nada se
            estima. Desde 768, la marca de siempre. */}
        <span aria-hidden data-instrumento-vacio className="flex flex-col gap-2.5 md:hidden">
          <span className="text-[12.5px] text-noct-neutral-400">Último emitido</span>
          <span className="font-mono text-[26px] font-medium leading-none text-noct-neutral-500">—</span>
          {conRango && <span className="block h-1.5 rounded-[3px] bg-noct-tinte" />}
        </span>
        <span aria-hidden className="flex h-[26px] items-center max-md:hidden">
          <span className="block h-[3px] w-7 rounded-full bg-noct-neutral-500" />
        </span>
        <p className="text-[14px] leading-[1.45] text-noct-neutral-300">Sin lectura. No se estima por fechas ni por consumo.</p>
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
    <div data-instrumento className="flex flex-col gap-2.5 rounded-[14px] border border-noct-text/25 bg-noct-bg p-3.5 max-md:rounded-2xl max-md:border-[1.5px] max-md:border-noct-divider-fuerte max-md:p-4">
      <p className="text-[12.5px] text-noct-neutral-400">Último emitido</p>
      <p className="font-mono text-[34px] font-semibold leading-none tracking-[-.02em] text-noct-accent-300">
        {formatearNumero(actual)}
      </p>
      {gastado !== null && (
        <div aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-noct-text/[.06]">
          <div className={`h-full ${restantes === 0 ? 'bg-noct-error' : 'bg-noct-accent'}`} style={{ width: `${gastado}%` }} />
        </div>
      )}
      {restantes !== null && (
        <p className={`text-[13.5px] ${restantes === 0 ? 'text-noct-error' : 'text-noct-neutral-300'}`}>
          {restantes === 0 ? (
            'Rango agotado según esa lectura.'
          ) : (
            <>
              Quedan <span className="font-mono font-semibold">{formatearNumero(restantes)}</span>{' '}
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
