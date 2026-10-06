import { Link } from 'react-router-dom'
import { Boton } from '../../components/Boton'
import { claseBoton } from '../../components/claseBoton'
import { Hoja } from '../../components/Hoja'
import { ArrowsClockwise, Check, Circle, Crosshair, Eye, Info, PlugsConnected, SealCheck, Warning } from '../../components/iconos'
import { MarcaEstado } from '../../components/MarcaEstado'
import type { ModoEjecucion } from '../../lib/preferenciasEjecucion'
import type { EstadoPaso, ResumenPaso } from './estadoPasos'

// Índice de los pasos del procedimiento en ejecución (handoff "Diseño
// móvil", tablero 6c).
//
// El hueco que cierra: no había forma de SALTAR AL PASO N. El asistente
// solo ofrecía "Atrás", de uno en uno, así que volver del paso 8 al 3
// era retroceder cinco veces, y en la vista de lista era desplazamiento
// a ciegas. El contador "Paso 3 de 7" informaba, pero no llevaba a
// ningún lado.
//
// Lo que aporta sobre una simple lista de títulos: el ESTADO REAL de
// cada paso, incluido el que no se ve desde fuera (los saltados) y el
// que conviene saber ANTES de saltar ahí (que el paso lleva un aviso de
// cuidado). Filas de 60 px, que es lo que se toca de pie frente a un
// rack.
//
// Es la hoja estándar (`Hoja`, tarea 291, auditoría UX F1), como
// `HojaFiltro` y `HojaTipoBloque`.
//
// "RUTA DE LA GUÍA" (propuesta final de Claude Design, 2026-10-01). En el
// teléfono es el único sitio donde se ven todos los pasos: la ruta dejó de
// ocupar la pantalla de la ejecución. Por eso cada nombre se lee hasta en
// DOS líneas (antes se cortaba en una), el paso de trabajo dice "Aquí vas"
// y una nota recuerda lo que hace tocar una fila: abrir un paso solo lo
// muestra, no marca nada. Si el paso es de más adelante, se consulta.

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Con el estado 'actual' en el paso de TRABAJO, que es el que dice "Aquí vas". */
  resumenes: ResumenPaso[]
  subtitulo: string
  /** La guía es un borrador: se dice en la cabecera de la hoja. */
  borrador?: boolean
  /**
   * Nombre COMPLETO de la guía en ejecución (cambio 4 del encargo del
   * 2026-09-09, "contenido cortado").
   *
   * La cabecera de ejecución mide 44 px desde la tarea 218, así que el
   * título va truncado y en 360 px se corta de verdad ("Revisar la caja
   * de ejemplo antes de abrir turn…"). Durante la ejecución ese es el
   * ÚNICO sitio donde aparece el nombre, así que quedaba irrecuperable:
   * en un teléfono no hay `hover` y el `title` de HTML no se abre con
   * el dedo. Aquí se lee entero, en la hoja que ya se abre desde el
   * contador de al lado.
   */
  tituloGuia?: string
  onIrAPaso: (indice: number) => void
  // Tarea 218: el índice es también donde vive el cambio entre Foco y
  // el paso entero. Antes cada vista tenía su propio control para
  // pasar a la otra (el botón "Foco" del pie, luego "Ver el paso
  // entero" dentro de ModoFoco); al reducir la cabecera de ejecución a
  // una línea de 44 px ninguna de las dos tenía ya sitio para el suyo.
  // El índice, que ahora se abre desde el contador duplicado arriba y
  // abajo, es el sitio natural: ya es donde se piensa en pasos, no en
  // tareas sueltas.
  modoEjecucion: ModoEjecucion
  onCambiarModo: (modo: ModoEjecucion) => void
  /**
   * Las comprobaciones finales del procedimiento, para poder LEERLAS en
   * cualquier momento (hallazgo H11, criterio A15).
   *
   * Hasta ahora solo existían al final: la ejecución las mostraba
   * después de marcar el último paso y la ficha las anunciaba sin
   * enseñarlas ("se abren cuando marques el paso 3"). Para un técnico
   * que quiere saber si lo que acaba de arreglar quedó bien, eso obliga
   * a marcar pasos que no hizo solo para leer la lista.
   *
   * Aquí van en SOLO LECTURA a propósito: consultarlas y registrarlas
   * como satisfechas son operaciones distintas, y marcarlas sigue
   * ocurriendo al cerrar el procedimiento.
   */
  verificacionFinal?: string[]
  /**
   * La ficha de la guía (descripción, objetivo, requisitos, versión,
   * historial), que desde el 2026-09-17 ya no es la puerta de entrada:
   * abrir una guía lleva al paso 1, y la ficha queda a un toque desde
   * aquí para quien la necesite.
   */
  rutaDetalles?: string
  estadoDetalles?: unknown
  /** Empezar de nuevo. Solo llega cuando hay avance que borrar. */
  onEmpezarDeNuevo?: () => void
  /**
   * "Conectar un equipo" (tarea 258): el computador que se atiende abre
   * `/asistencia` y el técnico lo conecta para enviarle los pasos. Solo
   * llega cuando no hay ninguno conectado; conectado, la guía enseña su
   * franja en el pie.
   */
  rutaConectar?: string
  estadoConectar?: unknown
}


// Marca de estado (dos canales, forma y color, regla R16): el hecho
// lleva check, el de trabajo y los pendientes su número, y el saltado el
// número con borde discontinuo, que se distingue sin depender del color.
// En el acento de la ruta (propuesta final): lo hecho relleno, el paso de
// trabajo con borde, lo pendiente neutro.
function InsigniaPaso({ estado, numero }: { estado: EstadoPaso; numero: number }) {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium'
  if (estado === 'hecho') {
    return (
      <span aria-hidden className={`${base} border-[1.5px] border-noct-accent bg-noct-accent/20 text-noct-accent-200`}>
        <Check size={13} />
      </span>
    )
  }
  if (estado === 'actual') {
    return <span aria-hidden className={`${base} border-[1.5px] border-noct-accent text-noct-accent-200`}>{numero}</span>
  }
  if (estado === 'saltado') {
    return (
      <span aria-hidden className={`${base} border-[1.5px] border-dashed border-noct-neutral-600 text-noct-neutral-400`}>
        {numero}
      </span>
    )
  }
  return <span aria-hidden className={`${base} border-[1.5px] border-noct-neutral-600 text-noct-neutral-400`}>{numero}</span>
}

// Lo que dice la fila a la derecha, solo cuando hay algo que decir: dónde
// va el trabajo, que el paso se saltó o que lleva un riesgo que conviene
// saber ANTES de ir. El número de tareas ya no se repite en cada fila: el
// nombre del paso es lo que se busca aquí (regla 22, no mostrar un dato
// solo porque está disponible).
function NotaFila({ resumen }: { resumen: ResumenPaso }) {
  const nota = resumen.estado === 'actual' ? 'Aquí vas' : resumen.estado === 'saltado' ? 'Saltado' : ''
  if (!nota && !resumen.tieneCuidado) return null
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {resumen.tieneCuidado && resumen.estado !== 'hecho' && (
        <Warning size={14} className="shrink-0 text-noct-error" aria-label="Con un riesgo que atender" />
      )}
      {nota && (
        <span
          className={`text-[12px] ${resumen.estado === 'actual' ? 'text-noct-accent-300' : 'text-noct-neutral-400'}`}
        >
          {nota}
        </span>
      )}
    </span>
  )
}

export function HojaPasos({
  abierto,
  onCerrar,
  resumenes,
  subtitulo,
  borrador = false,
  tituloGuia,
  onIrAPaso,
  modoEjecucion,
  onCambiarModo,
  verificacionFinal = [],
  rutaDetalles,
  estadoDetalles,
  onEmpezarDeNuevo,
  rutaConectar,
  estadoConectar,
}: Props) {
  const enFoco = modoEjecucion === 'foco'

  return (
    <Hoja
      abierta={abierto}
      onCerrar={onCerrar}
      textoCerrar="Cerrar el índice de pasos"
      titulo="Ruta de la guía"
      descripcion={
        <>
          {/* El nombre entero de la guía, sin truncar y con permiso
              para ocupar varias líneas: es lo que la cabecera de 44 px
              recorta y aquí se recupera. */}
          {tituloGuia && <span className="block text-pretty text-noct-neutral-300">{tituloGuia}</span>}
          <span className="block">{subtitulo}</span>
          {/* El borrador, con la marca de estado común (S5): ámbar, hay
              que tener cuidado al usarlo. */}
          {borrador && (
            <span className="mt-1 block">
              <MarcaEstado tono="atencion">Borrador</MarcaEstado>
            </span>
          )}
        </>
      }
    >

      <ol className="flex flex-col">
        {resumenes.map((resumen) => (
          <li key={resumen.id}>
            <button
              type="button"
              aria-current={resumen.estado === 'actual' ? 'step' : undefined}
              onClick={() => {
                onIrAPaso(resumen.indice)
                onCerrar()
              }}
              className={`-mx-2 flex min-h-12 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 text-left ${
                resumen.estado === 'actual'
                  ? 'bg-noct-accent/10'
                  : 'hover:bg-noct-text/[.06] active:bg-noct-text/[.1]'
              }`}
            >
              <InsigniaPaso estado={resumen.estado} numero={resumen.indice + 1} />
              {/* HASTA DOS LÍNEAS: el nombre del paso es lo que se busca
                  aquí, y en una sola se cortaba en 360 px. */}
              <span
                className={`line-clamp-2 min-w-0 flex-1 py-1.5 text-[14px] leading-[1.35] text-pretty ${
                  resumen.estado === 'actual' ? 'font-medium text-noct-text' : 'text-noct-neutral-300'
                }`}
              >
                {resumen.titulo}
              </span>
              <NotaFila resumen={resumen} />
            </button>
          </li>
        ))}
      </ol>

      <p className="pt-2 text-[12.5px] leading-snug text-noct-neutral-400">
        Abrir un paso solo lo muestra. No marca nada como hecho.
      </p>

      {/* Las comprobaciones finales, legibles desde el primer paso
          (H11). No llevan casilla: aquí solo se leen. Sin la nota que lo
          explicaba debajo ("se leen aquí; marcarlas es otra cosa"): el
          título ya dice cuándo se comprueban y la falta de casilla dice
          que aquí no se marcan (segunda pasada del encargo del
          2026-09-17, menos lectura). */}
      {verificacionFinal.length > 0 && (
        <section className="mt-3 rounded-[10px] border border-noct-divider px-3 py-2.5">
          <h3 className="flex items-center gap-2 text-[13px] font-medium text-noct-text">
            <SealCheck size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
            Al terminar se comprueba
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {verificacionFinal.map((item, indice) => (
              <li key={indice} className="flex items-start gap-2 text-[13px] leading-snug text-noct-neutral-300">
                <Circle size={13} className="mt-[3px] shrink-0 text-noct-neutral-600" aria-hidden />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* El cambio entre Foco y el paso entero (tarea 218): ver el
          comentario de `modoEjecucion` en Props. Un solo control de 44
          px cuyo rótulo dice a dónde lleva, no dónde está. */}
      <Boton
        papel="secundario"
        anchoCompleto
        className="mt-2"
        icono={enFoco ? <Eye size={17} aria-hidden /> : <Crosshair size={17} aria-hidden />}
        onClick={() => {
          onCambiarModo(enFoco ? 'pasoEntero' : 'foco')
          onCerrar()
        }}
      >
        {enFoco ? 'Ver el paso entero' : 'Volver a una acción a la vez'}
      </Boton>

      {/* LO QUE SALIÓ DE LA PANTALLA DE LA GUÍA (encargo del 2026-09-17):
          la ficha y empezar de nuevo. Existen, pero no se interponen entre
          abrir la guía y hacer el paso 1. */}
      {(rutaDetalles || onEmpezarDeNuevo || rutaConectar) && (
        // Uno debajo del otro: lado a lado, en 360 px los dos rótulos se
        // recortaban ("Detalles de la g…", "Empezar de nu…"). Y sin
        // recortar: a dos líneas antes que cortados (U3).
        <div className="mt-2 flex flex-col gap-2">
          {rutaDetalles && (
            <Link
              to={rutaDetalles}
              state={estadoDetalles}
              onClick={onCerrar}
              className={claseBoton({ papel: 'secundario', anchoCompleto: true })}
            >
              <Info size={17} className="shrink-0" aria-hidden />
              Detalles de la guía
            </Link>
          )}
          {rutaConectar && (
            <Link
              to={rutaConectar}
              state={estadoConectar}
              onClick={onCerrar}
              className={claseBoton({ papel: 'secundario', anchoCompleto: true })}
            >
              <PlugsConnected size={17} className="shrink-0" aria-hidden />
              Conectar un equipo
            </Link>
          )}
          {onEmpezarDeNuevo && (
            <Boton
              papel="secundario"
              anchoCompleto
              icono={<ArrowsClockwise size={17} className="shrink-0" aria-hidden />}
              onClick={() => {
                onEmpezarDeNuevo()
                onCerrar()
              }}
            >
              Empezar de nuevo
            </Boton>
          )}
        </div>
      )}
    </Hoja>
  )
}
