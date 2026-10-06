import { ArrowRight, Check, Warning } from '../../components/iconos'
import type { EstadoPaso, ResumenPaso } from './estadoPasos'
import { descripcionDeNodo, etiquetaDeRuta, vecinosDeRuta } from './rutaVisual'

// LA RUTA DEL PROCEDIMIENTO (encargo del 2026-09-22, sección 5).
//
// Orienta: dónde estoy, de dónde vengo y qué viene. No enseña el
// contenido de ningún paso; debajo sigue mandando el paso actual.
//
//   Escritorio y tableta: horizontal, con flechas, partiendo línea si
//   hace falta, y debajo "PASO 3 DE 7" con el título del paso.
//   Teléfono: NADA desde la propuesta final de Claude Design
//   (2026-10-01). La versión vertical (paso anterior, actual y siguiente,
//   con "Ver la ruta completa") ocupaba un tercio de la pantalla y
//   competía con la acción; ahí orientan el contador "3/8" de la
//   cabecera, que abre el índice entero, y los segmentos de
//   `EstadoEjecucion.tsx`.
//
// Los colores dicen ESTADO y nunca van solos (regla R16): hecho lleva su
// marca en verde, el actual va en el azul de la acción y con su número, y
// un paso con un riesgo real lleva el triángulo de aviso en rojo, que se
// lee antes de llegar. El nombre de cada nodo sale del título del paso,
// sin inventar nada (ver `etiquetaDeRuta`).

interface Props {
  resumenes: ResumenPaso[]
  /**
   * Los pasos de la ruta entera (tarea 302): con una pregunta sin responder,
   * más que los nodos que ya se conocen, o null si todavía no se sabe. Lo
   * que falta por conocer se dibuja como un último nodo "…".
   */
  total?: number | null
  indiceActual: number
  /** Mover la vista a un paso. No marca ni completa nada. */
  onIrAPaso: (indice: number) => void
}

function clasesNodo(estado: EstadoPaso): string {
  if (estado === 'actual') return 'border-noct-accion bg-noct-accion/[.16] text-noct-text font-semibold'
  if (estado === 'hecho') return 'border-noct-exito/40 text-noct-neutral-300'
  if (estado === 'saltado') return 'border-dashed border-noct-neutral-600 text-noct-neutral-400'
  return 'border-noct-divider text-noct-neutral-400'
}

function MarcaNodo({ resumen }: { resumen: ResumenPaso }) {
  if (resumen.estado === 'hecho') {
    return <Check size={13} className="shrink-0 text-noct-exito" aria-hidden />
  }
  return (
    <span
      aria-hidden
      className={`shrink-0 font-mono text-[11.5px] ${
        resumen.estado === 'actual' ? 'text-noct-accion' : 'text-noct-neutral-500'
      }`}
    >
      {resumen.indice + 1}
    </span>
  )
}

export function RutaProcedimiento({ resumenes, total: totalRuta = resumenes.length, indiceActual, onIrAPaso }: Props) {
  if (resumenes.length === 0) return null
  const { actual } = vecinosDeRuta(resumenes, indiceActual)
  if (!actual) return null
  // Con una pregunta sin responder, lo que viene después todavía no tiene
  // nombre: se enseña que hay más, sin inventarlo.
  const hayMasPorConocer = totalRuta === null || totalRuta > resumenes.length

  return (
    <nav aria-label="Ruta del procedimiento" className="hidden flex-none md:block">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {resumenes.map((resumen, indice) => (
          <li key={resumen.id} className="flex items-center gap-1">
            {indice > 0 && <ArrowRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />}
            <button
              type="button"
              onClick={() => onIrAPaso(resumen.indice)}
              aria-current={resumen.estado === 'actual' ? 'step' : undefined}
              aria-label={descripcionDeNodo(resumen, totalRuta)}
              title={resumen.titulo}
              // Tope de ancho para que la ruta siga siendo compacta; más
              // holgado desde `lg`, donde sobra sitio. Lo que no quepa se
              // lee entero en `title`, en el nombre accesible y, para el
              // paso actual, justo debajo.
              className={`inline-flex min-h-8 max-w-[24ch] items-center gap-1.5 rounded-full border px-2.5 text-[13px] hover:bg-noct-text/[.06] lg:max-w-[34ch] ${clasesNodo(resumen.estado)}`}
            >
              <MarcaNodo resumen={resumen} />
              <span className="truncate">{etiquetaDeRuta(resumen.titulo)}</span>
              {resumen.tieneCuidado && <Warning size={12} className="shrink-0 text-noct-error" aria-hidden />}
            </button>
          </li>
        ))}
        {hayMasPorConocer && (
          <li aria-hidden className="flex items-center gap-1">
            <ArrowRight size={13} className="shrink-0 text-noct-neutral-600" />
            <span className="inline-flex min-h-8 items-center rounded-full border border-dashed border-noct-divider px-2.5 text-[13px] text-noct-neutral-500">
              …
            </span>
          </li>
        )}
      </ol>
      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2 text-[13.5px] leading-snug">
        <span className="font-semibold uppercase tracking-[.06em] text-noct-accion">
          Paso {actual.indice + 1}
          {totalRuta !== null && ` de ${totalRuta}`}
        </span>
        <span className="text-[17px] font-medium text-noct-text">{actual.titulo}</span>
        {actual.estado === 'hecho' && (
          <span className="inline-flex items-center gap-1 text-noct-exito">
            <Check size={13} aria-hidden />
            hecho
          </span>
        )}
      </p>
    </nav>
  )
}
