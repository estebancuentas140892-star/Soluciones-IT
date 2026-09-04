import type { ReactNode } from 'react'
import { Modal } from '../../components/Modal'
import { Check, Crosshair, Eye, Warning, X } from '../../components/iconos'
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
// Se apoya en `Modal`, como `HojaFiltro` y `HojaTipoBloque`: portal a
// <body>, Escape, toque fuera y bloqueo del scroll del fondo.

interface Props {
  abierto: boolean
  onCerrar: () => void
  resumenes: ResumenPaso[]
  subtitulo: string
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
}

const ID_TITULO = 'hoja-pasos-titulo'

// Marca de estado (dos canales, forma y color, regla R16): el hecho
// lleva check, el actual y los pendientes su número, y el saltado el
// número con borde discontinuo, que se distingue sin depender del color.
function InsigniaPaso({ estado, numero }: { estado: EstadoPaso; numero: number }) {
  const base = 'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold'
  if (estado === 'hecho') {
    return (
      <span aria-hidden className={`${base} bg-noct-accent/20 text-noct-accent-300`}>
        <Check size={16} />
      </span>
    )
  }
  if (estado === 'actual') {
    return <span aria-hidden className={`${base} border-[1.5px] border-noct-accent text-noct-accent-300`}>{numero}</span>
  }
  if (estado === 'saltado') {
    return (
      <span aria-hidden className={`${base} border-[1.5px] border-dashed border-noct-precaucion/60 text-noct-precaucion`}>
        {numero}
      </span>
    )
  }
  return <span aria-hidden className={`${base} border-[1.5px] border-noct-neutral-700 text-noct-neutral-400`}>{numero}</span>
}

function Pastilla({
  children,
  tono,
}: {
  children: ReactNode
  tono: 'acento' | 'precaucion'
}) {
  const clases =
    tono === 'acento'
      ? 'bg-noct-accent/25 text-noct-accent-300'
      : 'bg-noct-precaucion/[.18] text-noct-precaucion'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.05em] ${clases}`}
    >
      {children}
    </span>
  )
}

// Segunda línea de la fila: las pastillas de estado y el conteo de
// tareas. Un paso hecho no la lleva: su check ya lo dice todo, y
// repetir "3 tareas" en cada fila terminada solo añade ruido.
function DetalleFila({ resumen }: { resumen: ResumenPaso }) {
  // El check ya lo dice todo, y su aviso de cuidado ya pasó: repetir
  // "3 tareas" en cada fila terminada solo estorba a la que importa.
  if (resumen.estado === 'hecho') return null
  const conteo =
    resumen.estado === 'actual' && resumen.tareas > 0
      ? `${resumen.tareasHechas} de ${resumen.tareas} ${resumen.tareas === 1 ? 'tarea' : 'tareas'}`
      : resumen.tareas > 0
        ? `${resumen.tareas} ${resumen.tareas === 1 ? 'tarea' : 'tareas'}`
        : ''
  const pastillas = resumen.estado === 'actual' || resumen.estado === 'saltado' || resumen.tieneCuidado
  if (!pastillas && !conteo) return null

  return (
    <span className="mt-[3px] flex items-center gap-[7px]">
      {resumen.estado === 'actual' && <Pastilla tono="acento">aquí</Pastilla>}
      {resumen.estado === 'saltado' && <Pastilla tono="precaucion">saltado</Pastilla>}
      {resumen.tieneCuidado && (
        <Pastilla tono="precaucion">
          <Warning size={9} aria-hidden />
          cuidado
        </Pastilla>
      )}
      {conteo && <span className="text-[12.5px] text-noct-neutral-300">{conteo}</span>}
    </span>
  )
}

export function HojaPasos({
  abierto,
  onCerrar,
  resumenes,
  subtitulo,
  onIrAPaso,
  modoEjecucion,
  onCambiarModo,
}: Props) {
  const enFoco = modoEjecucion === 'foco'

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span id={ID_TITULO} className="block text-[17px] font-medium leading-tight text-noct-text">
            Los {resumenes.length} pasos
          </span>
          <span className="mt-0.5 block text-[12.5px] text-noct-neutral-300">{subtitulo}</span>
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el índice de pasos"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <ol className="flex flex-col gap-0.5">
        {resumenes.map((resumen) => (
          <li key={resumen.id}>
            <button
              type="button"
              aria-current={resumen.estado === 'actual' ? 'step' : undefined}
              onClick={() => {
                onIrAPaso(resumen.indice)
                onCerrar()
              }}
              className={`flex min-h-[60px] w-full items-center gap-3 rounded-[10px] border px-2.5 py-1.5 text-left ${
                resumen.estado === 'actual'
                  ? 'border-noct-accent bg-noct-accent/[.14]'
                  : 'border-transparent hover:bg-noct-text/[.06] active:bg-noct-text/[.1]'
              }`}
            >
              <InsigniaPaso estado={resumen.estado} numero={resumen.indice + 1} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[15.5px] leading-tight ${
                    resumen.estado === 'hecho'
                      ? 'font-normal text-noct-neutral-400'
                      : 'font-medium text-noct-text'
                  }`}
                >
                  {resumen.titulo}
                </span>
                <DetalleFila resumen={resumen} />
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* El cambio entre Foco y el paso entero (tarea 218): ver el
          comentario de `modoEjecucion` en Props. Un solo control de 44
          px cuyo rótulo dice a dónde lleva, no dónde está. */}
      <button
        type="button"
        onClick={() => {
          onCambiarModo(enFoco ? 'pasoEntero' : 'foco')
          onCerrar()
        }}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-noct-divider text-[13.5px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.06]"
      >
        {enFoco ? <Eye size={17} aria-hidden /> : <Crosshair size={17} aria-hidden />}
        {enFoco ? 'Ver el paso entero' : 'Volver a una tarea a la vez'}
      </button>
    </Modal>
  )
}
