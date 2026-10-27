import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { CaretDown, CaretRight, CaretUp, Crosshair, Lightbulb, Question } from '../../components/iconos'
import { avisar } from '../../components/avisosFlotantes'
import { IconoCategoria } from '../../components/IconoCategoria'
import { useEsAncho } from '../../components/useEsAncho'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import {
  BOTON_COPIAR,
  RELLENO_ACCION,
  TITULO_GRUPO,
} from '../../components/ventana/estilos'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { db, type Articulo } from '../../lib/db'
import { inicialesDe } from '../../lib/iniciales'
import { conOrigen } from '../../lib/origenNavegacion'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { lineaAvanceGuia } from '../soluciones/accionGuia'
import { capacidadDeGuia, lineaDeCapacidad } from '../soluciones/capacidadGuia'
import { useAccionesDeGuia } from '../soluciones/useAccionesDeGuia'
import { AccionesDeResultado } from './AccionesResultado'
import { alcanceDelGrupo, conteoPorAlcance, textoVerAlcance, TOPE_EN_TODO, type Alcance } from './alcanceBusqueda'
import { useAnotarBusqueda } from './busquedaEnHistorial'
import { ContextoResultados, idDeEntidad, useContextoResultados } from './contextoResultados'
import { equipoDeLaConsulta, hayQueSepararMejores, leerResultados, sinLosMejores } from './mejores'
import { rutaGuiaConEquipo } from '../soluciones/contextoEjecucion'
import { cuandoUsarParaMostrar } from '../soluciones/preparacionGuia'
import { eventoDeResolucion, registrarResolucion } from './medicion'
import { filaNavega, vistaRapidaDe, type ModoBuscador } from './modoConsulta'
import { PuenteBoveda } from './PuenteBoveda'
import {
  cuentaDeTipo,
  filasConPrefijoComun,
  filasDelGrupo,
  lecturaParaTelefono,
  partesSubtituloConTipo,
  partirPorPrefijo,
  soloLaMenciona,
  textoMencionan,
  tipoComun,
} from './presentacionResultados'
import { prominenciaPuenteBoveda } from './reglasPuenteBoveda'
import { agruparResultados, partirTitulo, VISUAL_POR_TIPO } from './resultados'
import type { ResultadoBusqueda } from './useIndiceBusqueda'
import { VistaRapidaResultado } from './VistaRapida'
import { useRanuraVistaRapida } from './ranuraVistaRapida'
import { useDatosDeEquipos, useDatosDePersonas, type DatosDePersona } from './useDatosDeEquipos'
import { useIdsDeRed } from './useIdsDeRed'
import { useArticulosDeGuias, useCategoriasDeGuias } from './useCategoriasDeGuias'

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
  detalle,
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
  /**
   * Lo que dice la segunda línea en vez del subtítulo: una guía que solo
   * menciona lo buscado lo dice ahí (tarea 362).
   */
  detalle?: string
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
        {/* POSIBLE COINCIDENCIA (tarea 346): coincide con una errata de lo
            escrito, no tal cual. Se dice con su icono y su palabra. */}
        {resultado.aproximado && (
          <span
            data-posible-coincidencia
            className="inline-flex items-center gap-1 text-[12.5px] font-medium leading-[1.4] text-noct-precaucion max-md:text-[13px]"
          >
            <Question size={12} className="shrink-0" aria-hidden />
            Posible coincidencia
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
          (detalle ?? resultado.subtitulo) && (
            <span className="truncate text-[12.5px] leading-[1.4] text-noct-neutral-400 max-md:text-[13px]">
              {detalle ?? resultado.subtitulo}
            </span>
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
    // El divisor, con el trazo fuerte (tarea 347): con el normal, dos guías de
    // título largo se leían como una sola, sobre todo en el tema claro. Y
    // ninguno detrás de la última fila del grupo: ahí ya separa el espacio.
    <div
      className="flex min-w-0 flex-col max-md:mx-2 max-md:border-b max-md:border-noct-divider-fuerte max-md:last:border-b-0"
      onKeyDown={alTeclado}
    >
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
// `mejores.ts`, que no cambia) es una guía, se destaca sola. Es una
// COINCIDENCIA, no un diagnóstico. Abre exactamente lo que abriría su fila
// (`useAbrirResultado`). Desde la tarea 362 ya no dice «Hay otras guías
// parecidas debajo»: el grupo de debajo dice cuántas hay («Ver las N»).
//
// LA TARJETA DEL PROTOTIPO DE CLAUDE DESIGN (tarea 350): borde de 2 px y
// relieve en el acento; el icono de su categoría con qué es («Problema
// frecuente») y de qué («Impresoras»); el título a 20; cuándo usarla, si la
// guía lo dice; y al pie cuántas ventanas y cuánto toma, con «Empezar» (o
// «Continuar») relleno a la derecha, al alcance del pulgar. Toda la tarjeta
// abre la guía; el botón es su nombre para el lector y el teclado.
function GuiaQueMejorCoincide({
  resultado,
  categoriaNombre,
}: {
  resultado: ResultadoBusqueda
  categoriaNombre: string
}) {
  const { accionesGuia } = useContextoResultados()
  const abrir = useAbrirResultado(resultado, true)
  const esGuia = resultado.tipo === 'articulo'
  const id = idDeEntidad(resultado.id)
  const accion = esGuia ? accionesGuia.get(id) : undefined
  const guia = useLiveQuery(
    async () => {
      if (!esGuia) return null
      const procedimiento = normalizarProcedimiento((await db.articulos.get(id))?.procedimiento)
      return {
        minutos: procedimiento?.tiempoEstimadoMin ?? null,
        cuando: procedimiento ? cuandoUsarParaMostrar(procedimiento.descripcion) : '',
      }
    },
    [esGuia, id],
    null,
  )
  const { tipo, detalle } = partesSubtituloConTipo(resultado)
  const medida = [
    accion && accion.total > 0
      ? `${accion.total} ${accion.total === 1 ? 'ventana' : 'ventanas'}${accion.totalAbierto ? ' o más' : ''}`
      : null,
    guia?.minutos ? `unos ${guia.minutos} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const continuar = accion?.estado === 'continuar' && accion.pendiente.tipo === 'paso'
  const verbo = continuar ? 'Continuar' : 'Empezar'
  return (
    <section aria-labelledby="guia-mejor-coincide" className="flex flex-col gap-2.5">
      {/* Una guía que solo coincide con una errata no "mejor coincide":
          se destaca igual (es lo primero del orden), pero dicha como una
          posible coincidencia (tarea 346). */}
      <h2 id="guia-mejor-coincide" className={TITULO_GRUPO}>
        {resultado.aproximado ? 'Posible coincidencia' : 'Mejor coincidencia'}
      </h2>
      <div
        data-mejor-coincidencia
        className="flex flex-col gap-3 rounded-[22px] border-2 border-noct-accent bg-noct-surface p-4 shadow-[0_4px_0_var(--color-noct-accent-700)]"
      >
        <Link
          to={abrir.to}
          state={abrir.state}
          onClick={abrir.onClick}
          tabIndex={-1}
          aria-hidden
          className="flex min-w-0 flex-col gap-2.5 text-noct-text"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <IconoCategoria nombre={categoriaNombre} tam={40} />
            <span className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-extrabold leading-snug text-noct-accent-300">{tipo || 'Guía'}</span>
              {(categoriaNombre || detalle) && (
                <span className="text-[13.5px] font-semibold leading-snug text-noct-neutral-300">{categoriaNombre || detalle}</span>
              )}
            </span>
          </span>
          <span
            data-nombre-principal
            className="min-w-0 text-[20px] font-extrabold leading-[26px] tracking-[-.01em] text-pretty [overflow-wrap:anywhere]"
          >
            {resultado.titulo}
          </span>
          {guia?.cuando && <span className="text-[15px] leading-[21px] text-noct-neutral-300 text-pretty">{guia.cuando}</span>}
        </Link>
        <div data-pie-mejor-coincide className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5 text-[14px] font-semibold leading-snug text-noct-neutral-300">
            {medida && <span>{medida}</span>}
            {continuar && accion.pendiente.tipo === 'paso' && (
              <span className="text-noct-accent-300">Vas en la ventana {accion.pendiente.numero}</span>
            )}
          </span>
          <Link
            to={abrir.to}
            state={abrir.state}
            onClick={abrir.onClick}
            aria-label={`${verbo} la guía: ${resultado.titulo}`}
            className={`${RELLENO_ACCION} inline-flex h-[46px] shrink-0 items-center gap-2 rounded-[14px] px-[18px] text-[16px]`}
          >
            {verbo}
            <IconoVentana nombre="flecha" tam={18} grosor={2.6} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// UN RESULTADO EN EL TELÉFONO (tarea 362, auditoría de Resolver, Equipos y
// Agenda del 2026-10-27; antes, una tarjeta por resultado de las tareas 350 y
// 358). «impresora» daba 18 tarjetas de 80 a 100 px seguidas: tres pantallas.
// Ahora cada grupo es UNA tarjeta y cada resultado una fila de dos líneas con
// su divisor, como el prototipo: el icono de su categoría o de su clase (la
// persona, con sus iniciales), el título entero y, debajo, lo que lo sitúa sin
// repetir lo que el grupo ya dice: de una guía, su categoría y cuánto toma; de
// un equipo, su IP en mono y su contexto; de una persona, su área y sus
// equipos. Un equipo copia su IP desde la fila, sin abrir la ficha.
//
// Abre lo mismo y cuenta lo mismo que la fila de siempre (`useAbrirResultado`),
// con las mismas acciones directas debajo y la misma vista rápida (una
// credencial se ve, se copia y se tapa sin salir de aquí).
function FilaTelefono({
  resultado,
  conAcciones,
  desdeMejores,
  categoriaNombre,
  articulo,
  menciona = false,
  tituloCatalogo,
}: {
  resultado: ResultadoBusqueda
  conAcciones: boolean
  desdeMejores: boolean
  /** La categoría de la guía (`useCategoriasDeGuias`), o ''. */
  categoriaNombre: string
  /** La guía con pasos, para decir cuánto toma; undefined mientras se lee. */
  articulo?: Articulo
  /** Solo menciona lo buscado en su contenido (`soloLaMenciona`): se dice así. */
  menciona?: boolean
  /** Una categoría que coincide se nombra como su catálogo. */
  tituloCatalogo?: string
}) {
  const { equipos, personas, modo, vistaAbierta, alternarVista, accionesGuia } = useContextoResultados()
  const abrir = useAbrirResultado(resultado, desdeMejores)
  const id = idDeEntidad(resultado.id)
  const equipo = resultado.tipo === 'dispositivo' ? equipos.get(id) : undefined
  const ip = equipo?.ip ?? ''
  const idPanel = useId()
  const vista = vistaRapidaDe(resultado, modo)
  const abierta = vista !== null && vistaAbierta === resultado.id
  const avance =
    !menciona && articulo && capacidadDeGuia(articulo).ejecutable ? lineaAvanceGuia(accionesGuia.get(id) ?? null) : null
  const meta = metaDeFilaTelefono(resultado, { categoriaNombre, articulo, menciona, persona: personas.get(id) })
  const { Icono, tono } = VISUAL_POR_TIPO[resultado.tipo]
  const titulo = tituloCatalogo ?? resultado.titulo
  const conCategoria =
    resultado.tipo === 'articulo' ||
    resultado.tipo === 'diagnostico' ||
    resultado.tipo === 'categoria' ||
    resultado.tipo === 'dispositivo'
  return (
    <div
      data-fila-resultado={resultado.tipo}
      className="flex min-w-0 flex-col border-t-[1.5px] border-noct-divider first:border-t-0"
      // Esc recoge la vista abierta y nada más (como en la fila de siempre).
      onKeyDown={(evento) => {
        if (!abierta || evento.key !== 'Escape') return
        evento.stopPropagation()
        alternarVista(resultado.id)
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Link
          to={abrir.to}
          state={abrir.state}
          onClick={abrir.onClick}
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 text-noct-text active:bg-noct-presionado"
        >
          {resultado.tipo === 'persona' ? (
            <span
              aria-hidden
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${tono}`}
            >
              {inicialesDe(resultado.titulo)}
            </span>
          ) : conCategoria ? (
            <IconoCategoria
              nombre={
                resultado.tipo === 'dispositivo'
                  ? equipo?.categoriaNombre
                  : resultado.tipo === 'categoria'
                    ? resultado.titulo
                    : categoriaNombre
              }
              tam={36}
            />
          ) : (
            <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${tono}`}>
              <Icono size={20} />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* EL TÍTULO NUNCA SE RECORTA (regla 23): ocupa las líneas que
                necesite y la fila crece. */}
            <span
              data-nombre-principal
              className={`min-w-0 text-[15.5px] leading-5 [overflow-wrap:anywhere] [text-wrap:pretty] ${
                menciona ? 'font-semibold text-noct-neutral-200' : 'font-bold'
              }`}
            >
              {titulo}
            </span>
            {resultado.aproximado && (
              <span
                data-posible-coincidencia
                className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-noct-precaucion"
              >
                <Question size={13} className="shrink-0" aria-hidden />
                Posible coincidencia
              </span>
            )}
            {(ip || meta || avance) && (
              // Lo que sitúa al resultado parte línea si no cabe: la IP baja
              // de línea antes que cortar el nombre.
              <span className="flex flex-wrap items-baseline gap-x-1.5 text-[13.5px] font-semibold leading-[1.35] text-noct-neutral-300 [overflow-wrap:anywhere]">
                {ip && (
                  <span data-ip-resultado className="font-mono text-[14px] font-semibold text-noct-text">
                    {ip}
                  </span>
                )}
                {avance ? (
                  <span className="text-noct-accent-300">{[categoriaNombre, avance].filter(Boolean).join(' · ')}</span>
                ) : (
                  meta && <span data-meta-resultado>{meta}</span>
                )}
              </span>
            )}
          </span>
          {!ip && <IconoVentana nombre="adelante" tam={16} className="mr-1.5 shrink-0 text-noct-neutral-400" />}
        </Link>
        {ip && (
          <button
            type="button"
            aria-label={`Copiar IP de ${resultado.titulo}`}
            onClick={() => {
              void copiarAlPortapapeles(ip).then((ok) =>
                avisar(ok ? `IP copiada: ${ip}` : 'No se pudo copiar la IP', 'copiado'),
              )
            }}
            className={BOTON_COPIAR}
          >
            <IconoVentana nombre="copiar" tam={19} />
          </button>
        )}
      </div>
      {conAcciones && !abierta && (
        <div className="flex flex-wrap items-center gap-2 pb-3 empty:hidden">
          <AccionesDeResultado resultado={resultado} desdeMejores={desdeMejores} />
        </div>
      )}
      {abierta && (
        <div className="pb-3">
          <VistaRapidaResultado
            resultado={resultado}
            idPanel={idPanel}
            desdeMejores={desdeMejores}
            onCerrar={() => alternarVista(resultado.id)}
          />
        </div>
      )}
    </div>
  )
}

/**
 * La segunda línea de una fila del teléfono (tarea 362): lo que sitúa al
 * resultado sin repetir lo que su grupo ya dice («Guías», «Personas»).
 */
function metaDeFilaTelefono(
  resultado: ResultadoBusqueda,
  {
    categoriaNombre,
    articulo,
    menciona,
    persona,
  }: { categoriaNombre: string; articulo?: Articulo; menciona: boolean; persona?: DatosDePersona },
): string {
  if (menciona) return [categoriaNombre, 'la menciona en su contenido'].filter(Boolean).join(' · ')
  if (resultado.tipo === 'articulo' && articulo) {
    const linea = lineaDeCapacidad(capacidadDeGuia(articulo))
    return [categoriaNombre, linea.aviso ?? [linea.pasos, linea.minutos].filter(Boolean).join(' · ')]
      .filter(Boolean)
      .join(' · ')
  }
  if (resultado.tipo === 'persona' && persona) {
    const retirada = resultado.subtitulo.endsWith('Retirada')
    return [
      persona.area,
      persona.equipos > 0 ? `${persona.equipos} ${persona.equipos === 1 ? 'equipo' : 'equipos'}` : '',
      retirada ? 'Retirada' : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return resultado.subtitulo
}

// LO QUE SOLO MENCIONA LO BUSCADO, PLEGADO (tarea 362). Elegido «Guías», las
// guías que solo lo mencionan en su contenido van al final de su tarjeta,
// recogidas tras una línea que dice cuántas son; abiertas, con su fila de
// siempre y la mención dicha en su segunda línea.
function PliegueMencionan({
  mencionan,
  consultaCruda,
  abierto,
  onAlternar,
  categoriasDeGuias,
}: {
  mencionan: ResultadoBusqueda[]
  consultaCruda: string
  abierto: boolean
  onAlternar: () => void
  categoriasDeGuias: ReadonlyMap<string, string>
}) {
  if (mencionan.length === 0) return null
  return (
    <>
      <button
        type="button"
        aria-expanded={abierto}
        data-pliegue-mencionan
        onClick={onAlternar}
        className="flex min-h-[52px] items-center gap-2.5 border-t-[1.5px] border-noct-divider py-2 pr-2 text-left text-[14px] font-semibold leading-[1.35] text-noct-neutral-300 first:border-t-0 active:bg-noct-presionado"
      >
        <span className="min-w-0 flex-1">{textoMencionan(mencionan.length, consultaCruda)}</span>
        {abierto ? (
          <CaretUp size={16} className="shrink-0" aria-hidden />
        ) : (
          <CaretDown size={16} className="shrink-0" aria-hidden />
        )}
      </button>
      {abierto &&
        mencionan.map((item) => (
          <FilaTelefono
            key={item.id}
            resultado={item}
            conAcciones={false}
            desdeMejores={false}
            categoriaNombre={categoriasDeGuias.get(idDeEntidad(item.id)) ?? ''}
            menciona
          />
        ))}
    </>
  )
}

// "QUIZÁS BUSCABAS…" (tarea 346). Cuando una palabra no existe tal como se
// escribió, la consulta con la palabra más cercana que sí existe. Es una
// propuesta: el campo conserva lo escrito y nada se abre solo; tocarla
// busca eso, y es el técnico quien decide tocarla.
function QuizasBuscabas({ sugerencia, onUsar }: { sugerencia: string; onUsar?: (texto: string) => void }) {
  return (
    <p data-quizas-buscabas className="flex flex-wrap items-center gap-x-1.5 px-0.5 text-[14px] leading-snug text-noct-neutral-300">
      <Lightbulb size={15} className="shrink-0 text-noct-precaucion" aria-hidden />
      <span>Quizás buscabas</span>
      {onUsar ? (
        <button
          type="button"
          onClick={() => onUsar(sugerencia)}
          aria-label={`Buscar «${sugerencia}»`}
          className="inline-flex min-h-11 items-center font-semibold text-noct-accent-300 hover:underline"
        >
          «{sugerencia}»
        </button>
      ) : (
        <span className="font-semibold text-noct-text">«{sugerencia}»</span>
      )}
    </p>
  )
}

// LA TARJETA DE UN GRUPO EN EL TELÉFONO (tarea 362): la de las filas con
// divisor (`FILAS_EN_TARJETA_TELEFONO`) sin recortar lo que contiene: un
// título nunca queda bajo una regla que lo pueda cortar (regla 23).
const TARJETA_DE_GRUPO =
  'flex flex-col rounded-[18px] border-[1.5px] border-noct-divider bg-noct-surface pl-3.5 pr-1.5'

// «VER LAS N» (tarea 362, D1): elige el chip de tipo de ese grupo, lo mismo que
// tocarlo. En el teléfono, a la derecha del título del grupo, con 44 de toque;
// desde 768, al final de la cabecera de la sección.
function BotonVerAlcance({
  ver,
  onElegir,
  ancho = false,
}: {
  ver: { alcance: Alcance; texto: string }
  onElegir: (alcance: Alcance) => void
  ancho?: boolean
}) {
  return (
    <button
      type="button"
      data-ver-alcance={ver.alcance}
      onClick={() => onElegir(ver.alcance)}
      className={
        ancho
          ? 'ml-auto inline-flex min-h-11 shrink-0 items-center gap-0.5 px-1 text-[13.5px] font-semibold text-noct-accent-300 hover:underline xl:min-h-8'
          : 'inline-flex min-h-11 shrink-0 items-center gap-0.5 pl-2 text-[14px] font-bold text-noct-accent-300'
      }
    >
      {ver.texto}
      {ancho ? <CaretRight size={13} aria-hidden /> : <IconoVentana nombre="adelante" tam={15} grosor={2.4} />}
    </button>
  )
}

// En el teléfono, 62 de alto y sin el margen interior: el divisor y la
// respuesta al tocar van a todo el ancho del contenido (tarea 342). Con 12 px
// arriba y abajo (tarea 347; antes 8): un título de dos o tres líneas no queda
// pegado al divisor ni al título de la fila siguiente.
const CLASE_FILA =
  'flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 text-noct-text max-md:min-h-[62px] max-md:rounded-none max-md:px-0 max-md:py-3'

export function ResultadosBusqueda({
  resultados,
  consulta,
  consultaCruda,
  onNavegar,
  onDesbloqueada,
  huboDesbloqueo = false,
  modo = 'normal',
  enCapa = false,
  sugerencia = null,
  onUsarSugerencia,
  alcance = 'todo',
  onElegirAlcance,
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
  /** "Quizás buscabas…" (`sugerirConsulta`), o null si no hay nada que proponer. */
  sugerencia?: string | null
  /** Buscar la sugerencia. Sin esto, se dice pero no se toca. */
  onUsarSugerencia?: (texto: string) => void
  /**
   * El chip de tipo elegido (tarea 330). En «Todo» cada grupo enseña sus
   * primeras filas con «Ver las N» (tarea 362, D1); elegido un tipo, entero.
   */
  alcance?: Alcance
  /** «Ver las N» elige el chip de ese grupo. Sin esto, cada grupo va entero. */
  onElegirAlcance?: (alcance: Alcance) => void
}) {
  const accionesGuia = useAccionesDeGuia()
  const equipos = useDatosDeEquipos()
  const personas = useDatosDePersonas()
  const idsDeRed = useIdsDeRed()
  const lectura = useMemo(() => leerResultados(resultados, consulta), [resultados, consulta])
  // Lo que Resolver ya sabe del equipo de la consulta, leído sin tocar el
  // orden (tarea 290): solo cambia a dónde lleva una guía.
  const equipoConsultado = useMemo(() => equipoDeLaConsulta(consulta, resultados), [consulta, resultados])
  const mejores = lectura.mejores
  const separar = hayQueSepararMejores(resultados, mejores)
  const mejorCoincidencia = separar && lectura.confianza === 'alta'
  const grupos = useMemo(
    () => agruparResultados(separar ? sinLosMejores(resultados, mejores) : resultados, idsDeRed),
    [resultados, mejores, separar, idsDeRed],
  )
  // EN EL TELÉFONO, LA MISMA RESPUESTA LEÍDA DE OTRA FORMA (tarea 344,
  // `lecturaParaTelefono`): la guía que mejor coincide destacada y lo demás
  // por tipo. Solo donde las filas navegan; en modo consulta, encima de una
  // tarea, la lista de siempre. Desde 768, la de siempre.
  const ancho = useEsAncho()
  const enTelefono = !ancho && filaNavega(modo)
  const telefono = useMemo(() => lecturaParaTelefono(resultados, mejores, idsDeRed), [resultados, mejores, idsDeRed])
  const categoriasDeGuias = useCategoriasDeGuias()
  const articulosDeGuias = useArticulosDeGuias(enTelefono)

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

  // LO QUE SOLO MENCIONA LO BUSCADO, PLEGADO (tarea 362): como la vista
  // rápida, atado a la consulta y al alcance que lo abrieron.
  const [pliegue, setPliegue] = useState<string | null>(null)
  const clavePliegue = `${alcance}\u0000${consultaCruda}`
  const pliegueAbierto = pliegue === clavePliegue
  const alternarPliegue = useCallback(
    () => setPliegue((actual) => (actual === clavePliegue ? null : clavePliegue)),
    [clavePliegue],
  )
  // «Ver las N» dice el número del chip: en «Todo», lo que hay de cada tipo.
  const conteo = useMemo(() => conteoPorAlcance(resultados, idsDeRed), [resultados, idsDeRed])
  const enTodo = alcance === 'todo' && onElegirAlcance !== undefined

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
      personas,
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
      personas,
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
        {/* LOS RESULTADOS DEL PROTOTIPO (tarea 350; tarea 362): 18 px entre
            grupos, cada grupo con su título a 15 · 800 en tinta 2 y sus
            resultados en UNA tarjeta, una fila de dos líneas por resultado. */}
        <div className="flex flex-col gap-[18px]">
          {sugerencia && <QuizasBuscabas sugerencia={sugerencia} onUsar={onUsarSugerencia} />}
          {telefono.destacada && (
            <GuiaQueMejorCoincide
              resultado={telefono.destacada}
              categoriaNombre={categoriasDeGuias.get(idDeEntidad(telefono.destacada.id)) ?? ''}
            />
          )}
          {telefono.grupos.map((grupo, indice) => {
            // TRES POR GRUPO EN «TODO» (tarea 362, D1): las primeras filas y
            // «Ver las N», el número del chip de ese tipo. Elegido el tipo,
            // entero: las guías que solo mencionan lo buscado, plegadas al
            // final; las categorías que coinciden, como su catálogo.
            const alcanceGrupo = alcanceDelGrupo(grupo.id)
            const { filas, mencionan, categorias, hayMas } = filasDelGrupo(
              grupo.id,
              grupo.items,
              enTodo && alcanceGrupo !== null,
              TOPE_EN_TODO.telefono,
            )
            const nombreGrupo = grupo.id === 'soluciones' && telefono.destacada ? 'Otras guías' : grupo.nombre
            const ver =
              hayMas && alcanceGrupo !== null
                ? { alcance: alcanceGrupo, texto: textoVerAlcance(alcanceGrupo, conteo[alcanceGrupo]) }
                : null
            return (
              <Fragment key={grupo.id}>
                <section className="flex flex-col gap-1.5" data-grupo-resultados={grupo.id}>
                  <div className="flex min-h-11 items-center justify-between gap-2">
                    <h2 className={TITULO_GRUPO}>{nombreGrupo}</h2>
                    {ver && onElegirAlcance && <BotonVerAlcance ver={ver} onElegir={onElegirAlcance} />}
                  </div>
                  <div className={TARJETA_DE_GRUPO}>
                    {filas.map((item) => {
                      const id = idDeEntidad(item.id)
                      return (
                        <FilaTelefono
                          key={item.id}
                          resultado={item}
                          conAcciones={!separar || entreLosMejores.has(item.id)}
                          desdeMejores={separar && entreLosMejores.has(item.id)}
                          categoriaNombre={categoriasDeGuias.get(id) ?? ''}
                          articulo={item.tipo === 'articulo' ? articulosDeGuias.get(id) : undefined}
                          // En «Todo», si ninguna guía coincide por lo que es,
                          // se ven las que la mencionan: dicho como lo que son.
                          menciona={enTodo && soloLaMenciona(item)}
                        />
                      )
                    })}
                    <PliegueMencionan
                      mencionan={mencionan}
                      consultaCruda={consultaCruda}
                      abierto={pliegueAbierto}
                      onAlternar={alternarPliegue}
                      categoriasDeGuias={categoriasDeGuias}
                    />
                    {categorias.map((item) => (
                      <FilaTelefono
                        key={item.id}
                        resultado={item}
                        conAcciones={false}
                        desdeMejores={separar && entreLosMejores.has(item.id)}
                        categoriaNombre={item.titulo}
                        tituloCatalogo={`Todas las guías de ${item.titulo}`}
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
    ...grupos.map((grupo) => {
      // CUATRO POR GRUPO EN «TODO» (tarea 362, D1): «Mejores resultados»
      // se queda como está; debajo, cada grupo enseña cuatro y «Ver las N».
      // Elegido un tipo, entero, con las categorías que coinciden al final y
      // lo que solo menciona lo buscado plegado.
      const alcanceGrupo = alcanceDelGrupo(grupo.id)
      const { filas, mencionan, categorias, hayMas } = filasDelGrupo(
        grupo.id,
        grupo.items,
        enTodo && alcanceGrupo !== null,
        TOPE_EN_TODO.ancho,
      )
      return {
        clave: grupo.id,
        nombre: grupo.nombre,
        Icono: grupo.Icono,
        tonoIcono: 'text-noct-neutral-400',
        items: [...filas, ...categorias],
        // El número del grupo es lo que tiene, no lo que se ve.
        cantidad: grupo.items.length,
        conTipo: false,
        cuenta: null,
        sinCuenta: false,
        // Un resultado unico no tiene seccion de mejores encima: su fila
        // es la que lleva la accion.
        conAcciones: !separar,
        desdeMejores: false,
        mencionan,
        ver:
          hayMas && alcanceGrupo !== null
            ? { alcance: alcanceGrupo, texto: textoVerAlcance(alcanceGrupo, conteo[alcanceGrupo]) }
            : null,
      }
    }),
  ]
  // El puente va detrás del bloque de arriba ENTERO: con "Mejor
  // coincidencia" y "Otras coincidencias", detrás de las dos, para no
  // partir en dos la misma lectura. Sin ese bloque, detrás del primer grupo.
  const despuesDe = Math.max(0, secciones.findLastIndex((seccion) => seccion.desdeMejores))

  return (
    <ContextoResultados.Provider value={contexto}>
      <div className="@container flex flex-col gap-5">
        {sugerencia && <QuizasBuscabas sugerencia={sugerencia} onUsar={onUsarSugerencia} />}
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
                    {'cantidad' in seccion ? seccion.cantidad : seccion.items.length}
                  </span>
                )}
                {'ver' in seccion && seccion.ver && onElegirAlcance && (
                  <BotonVerAlcance ver={seccion.ver} onElegir={onElegirAlcance} ancho />
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
              {'mencionan' in seccion && seccion.mencionan.length > 0 && (
                <>
                  <button
                    type="button"
                    aria-expanded={pliegueAbierto}
                    data-pliegue-mencionan
                    onClick={alternarPliegue}
                    className="mt-1 inline-flex min-h-11 items-center gap-1.5 px-0.5 text-left text-[13.5px] font-medium text-noct-neutral-300 hover:text-noct-text xl:min-h-10"
                  >
                    {textoMencionan(seccion.mencionan.length, consultaCruda)}
                    {pliegueAbierto ? <CaretUp size={14} aria-hidden /> : <CaretDown size={14} aria-hidden />}
                  </button>
                  {pliegueAbierto && (
                    <div className="-mx-2 grid grid-cols-1 @2xl:grid-cols-2">
                      {seccion.mencionan.map((item) => (
                        <FilaResultado
                          key={item.id}
                          resultado={item}
                          consulta={consulta}
                          detalle={[partesSubtituloConTipo(item).detalle.split(' · ')[0], 'la menciona en su contenido']
                            .filter(Boolean)
                            .join(' · ')}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
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
