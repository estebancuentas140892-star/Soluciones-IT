import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { CaretDown, CaretRight, CaretUp, Check, Crosshair } from '../../components/iconos'
import { BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { useEsAncho } from '../../components/useEsAncho'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { useAccionesDeGuia } from '../soluciones/useAccionesDeGuia'
import { AccionesDeResultado } from './AccionesResultado'
import { useAnotarBusqueda } from './busquedaEnHistorial'
import { ContextoResultados, idDeEntidad, useContextoResultados } from './contextoResultados'
import { equipoDeLaConsulta, hayQueSepararMejores, leerResultados, sinLosMejores } from './mejores'
import { rutaGuiaConEquipo } from '../soluciones/contextoEjecucion'
import { eventoDeResolucion, registrarResolucion } from './medicion'
import { filaNavega, vistaRapidaDe, type ModoBuscador } from './modoConsulta'
import { PuenteBoveda } from './PuenteBoveda'
import {
  cuentaDeTipo,
  filasConPrefijoComun,
  lecturaParaTelefono,
  partesSubtituloConTipo,
  partirPorPrefijo,
  tipoComun,
} from './presentacionResultados'
import { prominenciaPuenteBoveda } from './reglasPuenteBoveda'
import { agruparResultados, partirTitulo, VISUAL_POR_TIPO } from './resultados'
import type { ResultadoBusqueda } from './useIndiceBusqueda'
import { VistaRapidaResultado } from './VistaRapida'
import { useRanuraVistaRapida } from './ranuraVistaRapida'
import { useDatosDeEquipos } from './useDatosDeEquipos'

// Presentacion compartida de los resultados del buscador global. El
// catalogo y el agrupado viven en resultados.ts; el ranking global, en
// mejores.ts; aqui solo la forma. Lo usan Inicio (que busca en linea,
// sin capa) y BuscadorGlobal (la capa que se abre desde la barra
// superior de cualquier pestaña y desde la ejecucion de una guia).
//
// DOS LECTURAS, NO UNA (encargo del 2026-09-15, tarea 241, seccion 2):
//
//   1. "Mejores resultados", arriba: de 3 a 5 resultados ordenados por
//      relevancia GLOBAL, vengan del modulo que vengan, cada uno con su
//      accion directa y con el tipo escrito en la propia fila (no hay
//      cabecera de grupo que lo diga).
//   2. Los grupos de siempre, debajo, para explorar por modulo.
//
// Un resultado no se pinta dos veces: lo que sube arriba se descuenta de
// su grupo. Y cuando la seleccion se llevaria TODO lo encontrado dentro
// de un mismo grupo, la seccion no se dibuja: seria el mismo contenido
// con otro rotulo (`hayQueSepararMejores`).
//
// SIN FINGIR CERTEZA (tarea 288, fase 8). Cuando una opción es claramente
// superior (la regla de confianza de `mejores.ts`), la sección de arriba
// se parte en "Mejor coincidencia" (esa sola) y "Otras coincidencias" (el
// resto de los mejores). Si las primeras están cerca, sigue siendo
// "Mejores resultados", como siempre. Son los mismos resultados, en el
// mismo orden y con las mismas acciones: solo cambia lo que se afirma.

// ABRIR UN RESULTADO: a dónde lleva, con qué estado y qué se mide al tocarlo.
// Lo comparten la fila y la tarjeta de "La guía que mejor coincide" del
// teléfono (tarea 344): las dos abren lo mismo, de la misma forma.
function useAbrirResultado(resultado: ResultadoBusqueda, desdeMejores: boolean) {
  const {
    accionesGuia,
    onNavegar,
    onResolver,
    consulta: consultaCruda,
    huboDesbloqueo,
    estadoDeSalto,
    alSaltar,
    equipoDeLaConsulta: equipoConsultado,
  } = useContextoResultados()
  return {
    // Una guía se abre con el equipo que la consulta identifica, si
    // es uno solo (tarea 290): "la impresora de mercadeo no imprime".
    to: resultado.tipo === 'articulo' ? rutaGuiaConEquipo(resultado.ruta, equipoConsultado) : resultado.ruta,
    // DE DONDE VENGO, PARA PODER VOLVER (seccion 7 del encargo).
    // Se reutiliza el sistema de origen que ya existe: abrir una
    // credencial desde aqui y volver devuelve a esta pantalla, no a
    // la lista raiz de la Boveda. Desde el 2026-09-16 el origen lleva
    // tambien la busqueda, que el regreso repone (seccion 13).
    state: estadoDeSalto,
    onClick: () => {
      // ABRIR UNA GUIA ES EMPEZARLA O RETOMARLA (encargo del
      // 2026-09-17): la guia se abre en su primer paso pendiente, asi
      // que su antiguo boton "Empezar" repetia este enlace y se retiro.
      // El recorrido cuenta igual, con el verbo que corresponde.
      const accionGuia = resultado.tipo === 'articulo' ? accionesGuia.get(idDeEntidad(resultado.id)) : undefined
      if (accionGuia) {
        onResolver(
          eventoDeResolucion({
            accion: accionGuia.estado === 'continuar' ? 'continuar_guia' : 'empezar_guia',
            tipo: resultado.tipo,
            desdeMejores,
            consulta: consultaCruda,
            huboDesbloqueo,
          }),
        )
      }
      // Abrir una guia con preguntas ES empezarla (arranca en su
      // primera pregunta o la retoma, tarea 263): sin boton propio,
      // como una guia, y el recorrido cuenta con su verbo de siempre.
      if (resultado.tipo === 'diagnostico') {
        onResolver(
          eventoDeResolucion({
            accion: 'iniciar_diagnostico',
            tipo: resultado.tipo,
            desdeMejores,
            consulta: consultaCruda,
            huboDesbloqueo,
          }),
        )
      }
      // Abrir un equipo ES la accion de un equipo: no lleva boton
      // propio (seria repetir este enlace), pero el recorrido cuenta.
      if (resultado.tipo === 'dispositivo') {
        onResolver(
          eventoDeResolucion({
            accion: 'abrir_equipo',
            tipo: resultado.tipo,
            desdeMejores,
            consulta: consultaCruda,
            huboDesbloqueo,
          }),
        )
      }
      alSaltar()
      onNavegar?.()
    },
  }
}

export function FilaResultado({
  resultado,
  consulta,
  conTipo = false,
  prefijoAtenuado = false,
  conAcciones = false,
  desdeMejores = false,
}: {
  resultado: ResultadoBusqueda
  consulta: string
  /**
   * Antepone el tipo al subtitulo ("Guía · ICG Manager", "Bóveda ·
   * Acceso"). Se usa fuera de los grupos, donde nada mas lo dice.
   */
  conTipo?: boolean
  /**
   * La fila es parte de una lista HOMOGÉNEA (propuesta final de Claude
   * Design): su título empieza por lo buscado, igual que otras dos o más
   * de la sección, así que ese comienzo va atenuado y lo que la distingue
   * en claro. Ver `presentacionResultados.ts`.
   */
  prefijoAtenuado?: boolean
  /**
   * Pinta la accion directa (empezar, continuar, iniciar, copiar).
   *
   * SOLO en "Mejores resultados" (seccion 13, "no convertir todo en
   * botones"): con la accion en todas las filas, una busqueda de ocho
   * guias dejaba ocho botones "Empezar" apilados y la pantalla se leia
   * como una botonera, no como una lista de respuestas. Arriba son cinco
   * como mucho, que es justo lo que el tecnico va a tocar; abajo, los
   * grupos se quedan para explorar, con la fila abriendo la ficha como
   * siempre. La excepcion es el resultado unico, donde no hay seccion de
   * mejores y un solo boton no satura nada.
   */
  conAcciones?: boolean
  /** Para la medicion del recorrido (seccion 17). */
  desdeMejores?: boolean
}) {
  const { modo, vistaAbierta, alternarVista, equipos } = useContextoResultados()
  const abrir = useAbrirResultado(resultado, desdeMejores)
  const { Icono, tono } = VISUAL_POR_TIPO[resultado.tipo]
  // En el teléfono, la IP de un equipo va a la derecha en mono (tarea 342).
  const equipo = resultado.tipo === 'dispositivo' ? equipos.get(idDeEntidad(resultado.id)) : undefined
  const { pre, match, post } = partirTitulo(resultado.titulo, consulta)
  const conPrefijo = prefijoAtenuado ? partirPorPrefijo(resultado.titulo, consulta) : null
  const conSuTipo = conTipo ? partesSubtituloConTipo(resultado) : null
  const idPanel = useId()
  const fila = useRef<HTMLElement | null>(null)
  const vista = vistaRapidaDe(resultado, modo)
  const abierta = vista !== null && vistaAbierta === resultado.id
  // Desde 1280, dentro de la paleta, la vista va en su columna (T6).
  const ranuraVista = useRanuraVistaRapida()

  // Recoger la vista devuelve el foco a la fila de la que salió: el
  // técnico sigue en el mismo punto de la lista, no al principio.
  function cerrarVista() {
    alternarVista(resultado.id)
    fila.current?.focus()
  }

  // Esc recoge la vista abierta y NADA MÁS (sección 7: cerrar la vista no
  // cierra el buscador). Se corta aquí, antes de que llegue al oyente de
  // la capa, que cerraría el buscador entero.
  function alTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (!abierta || evento.key !== 'Escape') return
    evento.stopPropagation()
    cerrarVista()
  }

  // El título manda. En una lista homogénea, lo buscado en gris con
  // subrayado punteado (sigue siendo la coincidencia) y lo que distingue a
  // la fila en claro; si no, la coincidencia resaltada en acento. El
  // título real no cambia.
  //
  // EL TÍTULO NUNCA SE RECORTA (regla 23, tarea 288): ocupa las líneas que
  // necesite y la fila crece. Con el tope de dos líneas de la propuesta
  // final, "Agregar una impresora al computador mediante su dirección IP"
  // se quedaba en "…mediante su…" a 390 px, justo sin la parte que dice de
  // qué guía se trata. Misma estrategia que `FilaArticulo`: `min-w-0` y
  // `overflow-wrap:anywhere` (una palabra o una IP sin espacios parte la
  // línea en vez de salirse) y `text-wrap:pretty`. El subtítulo y el tipo
  // sí se recortan: son contexto, no la identidad del resultado.
  const cuerpo = (
    <>
      {/* En el teléfono, la caja de 38 con radio 11 del handoff (tarea 342). */}
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md max-md:h-[38px] max-md:w-[38px] max-md:rounded-[11px] ${tono}`}
      >
        <Icono size={17} className="max-md:h-[19px] max-md:w-[19px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {conPrefijo ? (
          <span
            data-nombre-principal
            className="min-w-0 text-[15px] leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty] max-md:text-[15.5px]"
          >
            <span className="text-noct-neutral-400 underline decoration-noct-accent-600 decoration-dotted underline-offset-4">
              {conPrefijo.prefijo}
            </span>
            <span className="font-medium text-noct-neutral-100">{conPrefijo.resto}</span>
          </span>
        ) : (
          <span
            data-nombre-principal
            className="min-w-0 text-[15px] font-medium leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty] max-md:text-[15.5px] max-md:font-semibold"
          >
            {pre}
            {match && <span className="rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200">{match}</span>}
            {post}
          </span>
        )}
        {conSuTipo ? (
          // LISTA MIXTA: el tipo, más claro, y el resto del contexto.
          <span className="truncate text-[12.5px] leading-[1.4] text-noct-neutral-500 max-md:text-[13px]">
            {conSuTipo.tipo && <span className="font-medium text-noct-neutral-300">{conSuTipo.tipo}</span>}
            {conSuTipo.tipo && conSuTipo.detalle && ' · '}
            {conSuTipo.detalle}
          </span>
        ) : (
          resultado.subtitulo && (
            <span className="truncate text-[12.5px] leading-[1.4] text-noct-neutral-400 max-md:text-[13px]">{resultado.subtitulo}</span>
          )
        )}
      </span>
      {/* LA IP, DATO TÉCNICO, A LA DERECHA (tarea 342): en IBM Plex Mono y
          solo en el teléfono; desde 768 la vista rápida la dice entera. Es
          lo que se compara con la etiqueta del equipo sin abrirlo. */}
      {equipo?.ip && (
        <span data-ip-resultado className="shrink-0 font-mono text-[13.5px] leading-[1.3] text-noct-neutral-300 md:hidden">
          {equipo.ip}
        </span>
      )}
    </>
  )

  let cabecera
  if (filaNavega(modo)) {
    cabecera = (
      <Link
        ref={(nodo) => {
          fila.current = nodo
        }}
        to={abrir.to}
        state={abrir.state}
        onClick={abrir.onClick}
        className={`${CLASE_FILA} hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado`}
      >
        {cuerpo}
        <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
      </Link>
    )
  } else if (vista) {
    // MODO CONSULTA: la fila no lleva a ninguna pantalla, despliega su
    // vista rápida aquí mismo. El galón hacia abajo dice "se abre aquí",
    // no "te lleva a otro sitio".
    cabecera = (
      <button
        ref={(nodo) => {
          fila.current = nodo
        }}
        type="button"
        aria-expanded={abierta}
        aria-controls={abierta ? idPanel : undefined}
        onClick={() => alternarVista(resultado.id)}
        // Abierta, desde 768 la fila queda marcada con el tinte y el filo de
        // acento (T6): en la paleta la vista se ve al lado, no debajo.
        className={`${CLASE_FILA} w-full text-left hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado ${
          abierta ? 'md:bg-noct-accent/[.11] md:shadow-[inset_3px_0_0_var(--color-noct-accent)]' : ''
        }`}
      >
        {cuerpo}
        {abierta ? (
          <CaretUp size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
        ) : (
          <CaretDown size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
        )}
      </button>
    )
  } else {
    // MODO CONSULTA, sin vista rápida (una guía, un diagnóstico, una
    // ubicación): se nombra como referencia y no se puede tocar. Abrirla
    // sacaría al técnico de lo que está haciendo (sección 10).
    cabecera = <div className={CLASE_FILA}>{cuerpo}</div>
  }

  return (
    // La fila NO es un enlace que envuelva a sus acciones: un control
    // dentro de otro control no es HTML valido y el lector de pantalla
    // no sabria cual anuncia (mismo reparto que `FilaArticulo`). El
    // cuerpo es el enlace; las acciones van debajo, en su propia fila.
    // En el teléfono, cada resultado con su divisor y la fila a todo el ancho
    // del contenido, como en el handoff (tarea 342); desde 768, la de siempre.
    <div className="flex min-w-0 flex-col max-md:mx-2 max-md:border-b max-md:border-noct-divider" onKeyDown={alTeclado}>
      {cabecera}

      {/* Las acciones directas. `empty:hidden` deja la fila exactamente
          como estaba cuando el tipo no ofrece ninguna: sin hueco ni
          margen sobrante. Con la vista rápida abierta se recogen: la
          vista trae las suyas y repetirlas encima sería ruido. */}
      {conAcciones && !abierta && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2 empty:hidden max-md:px-0">
          <AccionesDeResultado resultado={resultado} desdeMejores={desdeMejores} />
        </div>
      )}

      {abierta &&
        (ranuraVista
          ? createPortal(
              <VistaRapidaResultado
                resultado={resultado}
                idPanel={idPanel}
                desdeMejores={desdeMejores}
                onCerrar={cerrarVista}
              />,
              ranuraVista,
            )
          : (
            <VistaRapidaResultado
              resultado={resultado}
              idPanel={idPanel}
              desdeMejores={desdeMejores}
              onCerrar={cerrarVista}
            />
          ))}
    </div>
  )
}

// LA GUÍA QUE MEJOR COINCIDE, EN EL TELÉFONO (rediseño móvil, fase 1, tarea
// 344; DESPUÉS de Claude Design). Cuando lo primero del orden global (el de
// `mejores.ts`, que no cambia) es una guía, se destaca sola: qué es, su
// título entero, cuántos pasos y cuánto toma, y "Abrir la guía", que dice
// lo que pasa al tocarla. Es una COINCIDENCIA, no un diagnóstico: si otras
// están cerca (confianza "cercana") se dice que hay otras parecidas debajo.
// Abre exactamente lo que abriría su fila (`useAbrirResultado`).
function GuiaQueMejorCoincide({ resultado, cercana }: { resultado: ResultadoBusqueda; cercana: boolean }) {
  const { accionesGuia } = useContextoResultados()
  const abrir = useAbrirResultado(resultado, true)
  const esGuia = resultado.tipo === 'articulo'
  const id = idDeEntidad(resultado.id)
  const accion = esGuia ? accionesGuia.get(id) : undefined
  const minutos = useLiveQuery(
    async () => (esGuia ? (normalizarProcedimiento((await db.articulos.get(id))?.procedimiento)?.tiempoEstimadoMin ?? null) : null),
    [esGuia, id],
    null,
  )
  const { tipo, detalle } = partesSubtituloConTipo(resultado)
  const medida = [
    accion && accion.total > 0 ? `${accion.total} ${accion.total === 1 ? 'paso' : 'pasos'}${accion.totalAbierto ? ' o más' : ''}` : null,
    minutos ? `unos ${minutos} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const continuar = accion?.estado === 'continuar' && accion.pendiente.tipo === 'paso'
  return (
    <section aria-labelledby="guia-mejor-coincide" className="flex flex-col gap-2">
      <h2 id="guia-mejor-coincide" className={ROTULO_TELEFONO}>
        La guía que mejor coincide
      </h2>
      <div className="flex flex-col gap-3.5 rounded-[18px] border-[1.5px] border-noct-accent bg-noct-surface p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[14px] leading-snug text-noct-neutral-400">{[tipo, detalle].filter(Boolean).join(' · ')}</span>
          <span data-nombre-principal className="min-w-0 text-[21px] font-[650] leading-[1.2] text-pretty [overflow-wrap:anywhere]">
            {resultado.titulo}
          </span>
          {(medida || esGuia) && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-noct-neutral-300">
              {medida && <span>{medida}</span>}
              {continuar && accion.pendiente.tipo === 'paso' ? (
                <span className="font-semibold text-noct-accent-300">Vas en el paso {accion.pendiente.numero}</span>
              ) : (
                esGuia && (
                  <span className="inline-flex items-center gap-1 font-semibold text-noct-exito">
                    <Check size={15} aria-hidden />
                    Publicada
                  </span>
                )
              )}
            </span>
          )}
        </div>
        <Link
          to={abrir.to}
          state={abrir.state}
          onClick={abrir.onClick}
          aria-label={`${continuar ? 'Continuar la guía' : 'Abrir la guía'}: ${resultado.titulo}`}
          className={`${BTN_PRIMARIO_RELLENO} w-full`}
        >
          {continuar ? 'Continuar la guía' : 'Abrir la guía'}
        </Link>
      </div>
      {cercana && <p className="px-0.5 text-[14px] leading-snug text-noct-neutral-400">Hay otras guías parecidas debajo.</p>}
    </section>
  )
}

// El rótulo de una sección de resultados en el teléfono (tarea 344): 15 px
// en texto 2, sin mayúsculas, como el DESPUÉS de Claude Design.
const ROTULO_TELEFONO = 'text-[15px] font-[650] leading-snug text-noct-neutral-300'

// En el teléfono, 62 de alto y sin el margen interior: el divisor y la
// respuesta al tocar van a todo el ancho del contenido (tarea 342).
const CLASE_FILA =
  'flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 text-noct-text max-md:min-h-[62px] max-md:rounded-none max-md:px-0'

export function ResultadosBusqueda({
  resultados,
  consulta,
  consultaCruda,
  onNavegar,
  onDesbloqueada,
  huboDesbloqueo = false,
  modo = 'normal',
  enCapa = false,
}: {
  /** Lo que devolvio `buscar`, en su orden. */
  resultados: ResultadoBusqueda[]
  /** La consulta ya normalizada, para resaltar el termino en el titulo. */
  consulta: string
  /** La consulta tal cual se escribio, para citarla y para la medicion. */
  consultaCruda: string
  /** La capa se cierra al elegir un resultado; Inicio no pasa nada. */
  onNavegar?: () => void
  /** La boveda se desbloqueo desde el puente, sin salir de aqui. */
  onDesbloqueada?: () => void
  /** Ya hubo un desbloqueo en este recorrido (cuenta una interaccion mas). */
  huboDesbloqueo?: boolean
  /**
   * Normal, o consulta encima de una tarea: en consulta nada navega (ver
   * `modoConsulta.ts`).
   */
  modo?: ModoBuscador
  /**
   * Los resultados viven en la capa del buscador global (true) o en el
   * buscador en línea de Inicio (false). Es lo que el regreso necesita
   * saber para reponer la búsqueda donde estaba (sección 13).
   */
  enCapa?: boolean
}) {
  const accionesGuia = useAccionesDeGuia()
  const equipos = useDatosDeEquipos()
  const lectura = useMemo(() => leerResultados(resultados, consulta), [resultados, consulta])
  // Lo que Resolver ya sabe del equipo de la consulta, leído sin tocar el
  // orden (tarea 290): solo cambia a dónde lleva una guía.
  const equipoConsultado = useMemo(() => equipoDeLaConsulta(consulta, resultados), [consulta, resultados])
  const mejores = lectura.mejores
  const separar = hayQueSepararMejores(resultados, mejores)
  const mejorCoincidencia = separar && lectura.confianza === 'alta'
  const grupos = useMemo(
    () => agruparResultados(separar ? sinLosMejores(resultados, mejores) : resultados),
    [resultados, mejores, separar],
  )
  // EN EL TELÉFONO, LA MISMA RESPUESTA LEÍDA DE OTRA FORMA (tarea 344,
  // `lecturaParaTelefono`): la guía que mejor coincide destacada y lo demás
  // por tipo. Solo donde las filas navegan; en modo consulta, encima de una
  // tarea, la lista de siempre. Desde 768, la de siempre.
  const ancho = useEsAncho()
  const enTelefono = !ancho && filaNavega(modo)
  const telefono = useMemo(() => lecturaParaTelefono(resultados, mejores), [resultados, mejores])

  // UNA VISTA RÁPIDA A LA VEZ, y atada a la consulta que la abrió: si el
  // técnico cambia lo escrito, la vista se recoge sola (su fila puede ni
  // seguir en la lista) y con ella se descarta lo que hubiera descifrado.
  const [vista, setVista] = useState<{ id: string; consulta: string } | null>(null)
  if (vista && vista.consulta !== consultaCruda) setVista(null)
  const vistaAbierta = vista && vista.consulta === consultaCruda ? vista.id : null
  const alternarVista = useCallback(
    (id: string) => setVista((actual) => (actual?.id === id ? null : { id, consulta: consultaCruda })),
    [consultaCruda],
  )

  // El salto a una ficha lleva la búsqueda para reponerla al volver, y
  // la deja anotada en la entrada actual para el botón atrás del teléfono.
  const { pathname, search } = useLocation()
  const anotar = useAnotarBusqueda()
  const busqueda = useMemo(
    () => (consultaCruda ? { consulta: consultaCruda, capa: enCapa } : undefined),
    [consultaCruda, enCapa],
  )
  const estadoDeSalto = useMemo(
    () => conOrigen(`${pathname}${search}`, 'la búsqueda', busqueda),
    [pathname, search, busqueda],
  )
  const alSaltar = useCallback(() => {
    if (busqueda) anotar(busqueda)
  }, [anotar, busqueda])

  const contexto = useMemo(
    () => ({
      accionesGuia,
      consulta: consultaCruda,
      onNavegar,
      onResolver: registrarResolucion,
      huboDesbloqueo,
      modo,
      vistaAbierta,
      alternarVista,
      estadoDeSalto,
      alSaltar,
      equipoDeLaConsulta: equipoConsultado,
      equipos,
    }),
    [
      accionesGuia,
      consultaCruda,
      onNavegar,
      huboDesbloqueo,
      modo,
      vistaAbierta,
      alternarVista,
      estadoDeSalto,
      alSaltar,
      equipoConsultado,
      equipos,
    ],
  )

  // Cuánto pesa el puente a la Bóveda (sección 14): cede ante una
  // coincidencia pública fuerte. Solo mira lo que ya está en pantalla.
  const prominencia = prominenciaPuenteBoveda(resultados, consultaCruda)

  if (enTelefono) {
    // Los que estaban entre los mejores conservan su acción directa y
    // cuentan como "desde mejores" en la medición, como antes.
    const entreLosMejores = new Set(mejores.map((resultado) => resultado.id))
    const puente = (
      <PuenteBoveda consulta={consultaCruda} onDesbloqueada={onDesbloqueada} prominencia={prominencia} modo={modo} />
    )
    return (
      <ContextoResultados.Provider value={contexto}>
        <div className="flex flex-col gap-5">
          {telefono.destacada && (
            <GuiaQueMejorCoincide resultado={telefono.destacada} cercana={lectura.confianza !== 'alta'} />
          )}
          {telefono.grupos.map((grupo, indice) => {
            const conPrefijo = filasConPrefijoComun(grupo.items, consulta)
            return (
              <Fragment key={grupo.id}>
                <section>
                  <div className="mb-0.5 flex items-center gap-1.5 px-0.5">
                    <grupo.Icono size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
                    <h2 className={ROTULO_TELEFONO}>
                      {grupo.id === 'soluciones' && telefono.destacada ? 'Otras guías' : grupo.nombre}
                    </h2>
                    <span className="font-mono text-[12.5px] text-noct-neutral-500">{grupo.items.length}</span>
                  </div>
                  <div className="-mx-2 grid grid-cols-1">
                    {grupo.items.map((item) => (
                      <FilaResultado
                        key={item.id}
                        resultado={item}
                        consulta={consulta}
                        prefijoAtenuado={conPrefijo.has(item.id)}
                        conAcciones={!separar || entreLosMejores.has(item.id)}
                        desdeMejores={separar && entreLosMejores.has(item.id)}
                      />
                    ))}
                  </div>
                </section>
                {/* El puente, detrás del primer bloque de lo encontrado: ni
                    encima de lo que ya responde ni enterrado al final. */}
                {indice === 0 && puente}
              </Fragment>
            )
          })}
          {telefono.grupos.length === 0 && puente}
        </div>
      </ContextoResultados.Provider>
    )
  }

  // Las secciones, en orden: "Mejores resultados" (si aporta algo) y los
  // grupos de siempre. Se arma la lista para poder intercalar el puente
  // de la Bóveda DESPUÉS de la primera, sin repetir el marcado.
  //
  // Si todos los mejores son del MISMO tipo, el tipo sube al encabezado
  // ("Mejores resultados · 5 equipos") y no se repite en cada fila
  // (propuesta final de Claude Design); si no, cada fila dice el suyo.
  const tipoDeLosMejores = tipoComun(mejores)
  const otras = mejores.slice(1)
  const tipoDeLasOtras = tipoComun(otras)
  const secciones = [
    ...(mejorCoincidencia
      ? [
          // Una sola fila: dice su tipo y no lleva cuenta ("· 1" es ruido).
          {
            clave: 'mejor',
            nombre: 'Mejor coincidencia',
            Icono: Crosshair,
            tonoIcono: 'text-noct-accent-300',
            items: mejores.slice(0, 1),
            conTipo: true,
            cuenta: null,
            sinCuenta: true,
            conAcciones: true,
            desdeMejores: true,
          },
          ...(otras.length > 0
            ? [
                {
                  clave: 'otras',
                  nombre: 'Otras coincidencias',
                  Icono: Crosshair,
                  tonoIcono: 'text-noct-neutral-400',
                  items: otras,
                  conTipo: tipoDeLasOtras === null,
                  cuenta: tipoDeLasOtras ? `· ${cuentaDeTipo(tipoDeLasOtras, otras.length)}` : null,
                  sinCuenta: false,
                  conAcciones: true,
                  desdeMejores: true,
                },
              ]
            : []),
        ]
      : separar
        ? [
            {
              clave: 'mejores',
              nombre: 'Mejores resultados',
              Icono: Crosshair,
              tonoIcono: 'text-noct-accent-300',
              items: mejores,
              conTipo: tipoDeLosMejores === null,
              cuenta: tipoDeLosMejores ? `· ${cuentaDeTipo(tipoDeLosMejores, mejores.length)}` : null,
              sinCuenta: false,
              conAcciones: true,
              desdeMejores: true,
            },
          ]
        : []),
    ...grupos.map((grupo) => ({
      clave: grupo.id,
      nombre: grupo.nombre,
      Icono: grupo.Icono,
      tonoIcono: 'text-noct-neutral-400',
      items: grupo.items,
      conTipo: false,
      cuenta: null,
      sinCuenta: false,
      // Un resultado unico no tiene seccion de mejores encima: su fila
      // es la que lleva la accion.
      conAcciones: !separar,
      desdeMejores: false,
    })),
  ]
  // El puente va detrás del bloque de arriba ENTERO: con "Mejor
  // coincidencia" y "Otras coincidencias", detrás de las dos, para no
  // partir en dos la misma lectura. Sin ese bloque, detrás del primer grupo.
  const despuesDe = Math.max(0, secciones.findLastIndex((seccion) => seccion.desdeMejores))

  return (
    <ContextoResultados.Provider value={contexto}>
      <div className="@container flex flex-col gap-5">
        {secciones.map((seccion, indice) => {
          // LISTA HOMOGÉNEA, sección por sección: 3 o más filas que
          // empiezan por lo buscado llevan ese comienzo atenuado.
          const conPrefijo = filasConPrefijoComun(seccion.items, consulta)
          return (
          <Fragment key={seccion.clave}>
            <section>
              {/* EL RÓTULO DEL GRUPO (tarea 342): en el teléfono, 13/650 en
                  texto 3 y sin mayúsculas, con su número en mono, como en el
                  handoff; desde 768, el rótulo de sección de siempre. */}
              <div className="mb-1 flex items-center gap-2 px-0.5 max-md:mb-0.5 max-md:gap-1.5">
                <seccion.Icono size={14} className={seccion.tonoIcono} aria-hidden />
                <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500 max-md:text-[13px] max-md:font-[650] max-md:normal-case max-md:tracking-normal max-md:text-noct-neutral-400">
                  {seccion.nombre}
                </h2>
                {seccion.sinCuenta ? null : seccion.cuenta ? (
                  <span className="text-[11px] text-noct-neutral-500 max-md:text-[12px]">{seccion.cuenta}</span>
                ) : (
                  <span className="text-[11px] text-noct-neutral-600 max-md:font-mono max-md:text-[12px] max-md:text-noct-neutral-500">
                    {seccion.items.length}
                  </span>
                )}
              </div>
              <div className="-mx-2 grid grid-cols-1 @2xl:grid-cols-2">
                {seccion.items.map((item) => (
                  <FilaResultado
                    key={item.id}
                    resultado={item}
                    consulta={consulta}
                    conTipo={seccion.conTipo}
                    prefijoAtenuado={conPrefijo.has(item.id)}
                    conAcciones={seccion.conAcciones}
                    desdeMejores={seccion.desdeMejores}
                  />
                ))}
              </div>
            </section>

            {/* EL PUENTE VA DETRÁS DE LA PRIMERA SECCIÓN, no delante de
                todo. Lo que ya se encontró resuelve la mayoría de las
                búsquedas y no puede quedar por debajo de una puerta
                cerrada; pero tampoco puede enterrarse al final de una
                lista larga, porque cuando lo que se busca es un acceso
                ESTE es el resultado. Se dibuja solo cuando aplica, y en
                su forma compacta cuando lo público ya responde con
                fuerza (sección 14 del encargo del 2026-09-16). */}
            {indice === despuesDe && (
              <PuenteBoveda
                consulta={consultaCruda}
                onDesbloqueada={onDesbloqueada}
                prominencia={prominencia}
                modo={modo}
              />
            )}
          </Fragment>
          )
        })}
      </div>
    </ContextoResultados.Provider>
  )
}
