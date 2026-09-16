import { Fragment, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CaretRight, Crosshair } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { conOrigen } from '../../lib/origenNavegacion'
import { useAccionesDeGuia } from '../soluciones/useAccionesDeGuia'
import { AccionesDeResultado } from './AccionesResultado'
import { ContextoResultados, useContextoResultados } from './contextoResultados'
import { hayQueSepararMejores, mejoresResultados, sinLosMejores, subtituloConTipo } from './mejores'
import { eventoDeResolucion, registrarResolucion } from './medicion'
import { PuenteBoveda } from './PuenteBoveda'
import { agruparResultados, partirTitulo, VISUAL_POR_TIPO } from './resultados'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

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
  const { onNavegar, onResolver, consulta: consultaCruda, huboDesbloqueo } = useContextoResultados()
  const { pathname } = useLocation()
  const { Icono, tono } = VISUAL_POR_TIPO[resultado.tipo]
  const { pre, match, post } = partirTitulo(resultado.titulo, consulta)
  const subtitulo = conTipo ? subtituloConTipo(resultado) : resultado.subtitulo

  return (
    // La fila NO es un enlace que envuelva a sus acciones: un control
    // dentro de otro control no es HTML valido y el lector de pantalla
    // no sabria cual anuncia (mismo reparto que `FilaArticulo`). El
    // cuerpo es el enlace; las acciones van debajo, en su propia fila.
    <div className="flex flex-col">
      <Link
        to={resultado.ruta}
        // DE DONDE VENGO, PARA PODER VOLVER (seccion 7 del encargo).
        // Se reutiliza el sistema de origen que ya existe: abrir una
        // credencial desde aqui y volver devuelve a esta pantalla, no a
        // la lista raiz de la Boveda.
        state={conOrigen(pathname, 'la búsqueda')}
        onClick={() => {
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
          onNavegar?.()
        }}
        className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
      >
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
        <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
      </Link>

      {/* Las acciones directas. `empty:hidden` deja la fila exactamente
          como estaba cuando el tipo no ofrece ninguna: sin hueco ni
          margen sobrante. */}
      {conAcciones && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2 empty:hidden">
          <AccionesDeResultado resultado={resultado} desdeMejores={desdeMejores} />
        </div>
      )}
    </div>
  )
}

export function ResultadosBusqueda({
  resultados,
  consulta,
  consultaCruda,
  onNavegar,
  onDesbloqueada,
  huboDesbloqueo = false,
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
}) {
  const accionesGuia = useAccionesDeGuia()
  const mejores = useMemo(() => mejoresResultados(resultados, consulta), [resultados, consulta])
  const separar = hayQueSepararMejores(resultados, mejores)
  const grupos = useMemo(
    () => agruparResultados(separar ? sinLosMejores(resultados, mejores) : resultados),
    [resultados, mejores, separar],
  )

  const contexto = useMemo(
    () => ({
      accionesGuia,
      consulta: consultaCruda,
      onNavegar,
      onResolver: registrarResolucion,
      huboDesbloqueo,
    }),
    [accionesGuia, consultaCruda, onNavegar, huboDesbloqueo],
  )

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
                ESTE es el resultado. Se dibuja solo cuando aplica. */}
            {indice === 0 && (
              <PuenteBoveda consulta={consultaCruda} onDesbloqueada={onDesbloqueada} />
            )}
          </Fragment>
        ))}
      </div>
    </ContextoResultados.Provider>
  )
}
