import { Fragment, useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CaretDown, CaretRight, CaretUp, Crosshair } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { conOrigen } from '../../lib/origenNavegacion'
import { useAccionesDeGuia } from '../soluciones/useAccionesDeGuia'
import { AccionesDeResultado } from './AccionesResultado'
import { useAnotarBusqueda } from './busquedaEnHistorial'
import { ContextoResultados, idDeEntidad, useContextoResultados } from './contextoResultados'
import { hayQueSepararMejores, mejoresResultados, sinLosMejores, subtituloConTipo } from './mejores'
import { eventoDeResolucion, registrarResolucion } from './medicion'
import { filaNavega, vistaRapidaDe, type ModoBuscador } from './modoConsulta'
import { PuenteBoveda } from './PuenteBoveda'
import { prominenciaPuenteBoveda } from './reglasPuenteBoveda'
import { agruparResultados, partirTitulo, VISUAL_POR_TIPO } from './resultados'
import type { ResultadoBusqueda } from './useIndiceBusqueda'
import { VistaRapidaResultado } from './VistaRapida'

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

export function FilaResultado({
  resultado,
  consulta,
  conTipo = false,
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
  const {
    accionesGuia,
    onNavegar,
    onResolver,
    consulta: consultaCruda,
    huboDesbloqueo,
    modo,
    vistaAbierta,
    alternarVista,
    estadoDeSalto,
    alSaltar,
  } = useContextoResultados()
  const { Icono, tono } = VISUAL_POR_TIPO[resultado.tipo]
  const { pre, match, post } = partirTitulo(resultado.titulo, consulta)
  const subtitulo = conTipo ? subtituloConTipo(resultado) : resultado.subtitulo
  const idPanel = useId()
  const fila = useRef<HTMLElement | null>(null)
  const vista = vistaRapidaDe(resultado, modo)
  const abierta = vista !== null && vistaAbierta === resultado.id

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

  const cuerpo = (
    <>
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${tono}`}>
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
          {pre}
          {match && <span className="rounded-[3px] bg-noct-accent/[.18] text-noct-accent-300">{match}</span>}
          {post}
        </span>
        {subtitulo && <span className="block truncate text-[12px] text-noct-neutral-500">{subtitulo}</span>}
      </span>
    </>
  )

  let cabecera
  if (filaNavega(modo)) {
    cabecera = (
      <Link
        ref={(nodo) => {
          fila.current = nodo
        }}
        to={resultado.ruta}
        // DE DONDE VENGO, PARA PODER VOLVER (seccion 7 del encargo).
        // Se reutiliza el sistema de origen que ya existe: abrir una
        // credencial desde aqui y volver devuelve a esta pantalla, no a
        // la lista raiz de la Boveda. Desde el 2026-09-16 el origen lleva
        // tambien la busqueda, que el regreso repone (seccion 13).
        state={estadoDeSalto}
        onClick={() => {
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
        }}
        className={`${CLASE_FILA} hover:bg-noct-text/[.05]`}
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
        className={`${CLASE_FILA} w-full text-left hover:bg-noct-text/[.05]`}
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
    <div className="flex min-w-0 flex-col" onKeyDown={alTeclado}>
      {cabecera}

      {/* Las acciones directas. `empty:hidden` deja la fila exactamente
          como estaba cuando el tipo no ofrece ninguna: sin hueco ni
          margen sobrante. Con la vista rápida abierta se recogen: la
          vista trae las suyas y repetirlas encima sería ruido. */}
      {conAcciones && !abierta && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2 empty:hidden">
          <AccionesDeResultado resultado={resultado} desdeMejores={desdeMejores} />
        </div>
      )}

      {abierta && (
        <VistaRapidaResultado
          resultado={resultado}
          idPanel={idPanel}
          desdeMejores={desdeMejores}
          onCerrar={cerrarVista}
        />
      )}
    </div>
  )
}

const CLASE_FILA = 'flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text'

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
  const mejores = useMemo(() => mejoresResultados(resultados, consulta), [resultados, consulta])
  const separar = hayQueSepararMejores(resultados, mejores)
  const grupos = useMemo(
    () => agruparResultados(separar ? sinLosMejores(resultados, mejores) : resultados),
    [resultados, mejores, separar],
  )

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
    }),
    [accionesGuia, consultaCruda, onNavegar, huboDesbloqueo, modo, vistaAbierta, alternarVista, estadoDeSalto, alSaltar],
  )

  // Cuánto pesa el puente a la Bóveda (sección 14): cede ante una
  // coincidencia pública fuerte. Solo mira lo que ya está en pantalla.
  const prominencia = prominenciaPuenteBoveda(resultados, consultaCruda)

  // Las secciones, en orden: "Mejores resultados" (si aporta algo) y los
  // grupos de siempre. Se arma la lista para poder intercalar el puente
  // de la Bóveda DESPUÉS de la primera, sin repetir el marcado.
  const secciones = [
    ...(separar
      ? [
          {
            clave: 'mejores',
            nombre: 'Mejores resultados',
            Icono: Crosshair,
            tonoIcono: 'text-noct-accent-300',
            items: mejores,
            conTipo: true,
            conAcciones: true,
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
      // Un resultado unico no tiene seccion de mejores encima: su fila
      // es la que lleva la accion.
      conAcciones: !separar,
    })),
  ]

  return (
    <ContextoResultados.Provider value={contexto}>
      <div className="@container flex flex-col gap-5">
        {secciones.map((seccion, indice) => (
          <Fragment key={seccion.clave}>
            <section>
              <div className="mb-1.5 flex items-center gap-2 px-0.5">
                <seccion.Icono size={14} className={seccion.tonoIcono} aria-hidden />
                <TituloSeccion>{seccion.nombre}</TituloSeccion>
                <span className="text-[11px] text-noct-neutral-600">{seccion.items.length}</span>
              </div>
              <div className="grid grid-cols-1 @2xl:grid-cols-2">
                {seccion.items.map((item) => (
                  <FilaResultado
                    key={item.id}
                    resultado={item}
                    consulta={consulta}
                    conTipo={seccion.conTipo}
                    conAcciones={seccion.conAcciones}
                    desdeMejores={seccion.conTipo}
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
            {indice === 0 && (
              <PuenteBoveda
                consulta={consultaCruda}
                onDesbloqueada={onDesbloqueada}
                prominencia={prominencia}
                modo={modo}
              />
            )}
          </Fragment>
        ))}
      </div>
    </ContextoResultados.Provider>
  )
}
