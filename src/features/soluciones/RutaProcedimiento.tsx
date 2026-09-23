import { ArrowRight, CaretDown, Check, Warning } from '../../components/iconos'
import type { EstadoPaso, ResumenPaso } from './estadoPasos'
import { descripcionDeNodo, etiquetaDeRuta, vecinosDeRuta } from './rutaVisual'

// LA RUTA DEL PROCEDIMIENTO (encargo del 2026-09-22, sección 5).
//
// Orienta: dónde estoy, de dónde vengo y qué viene. No enseña el
// contenido de ningún paso; debajo sigue mandando el paso actual.
//
//   Escritorio y tableta: horizontal, con flechas, partiendo línea si
//   hace falta, y debajo "PASO 3 DE 7" con el título del paso.
//   Teléfono: vertical y recortada al paso anterior, el actual y el
//   siguiente, con "Ver la ruta completa" para el índice entero.
//
// Los colores dicen ESTADO y nunca van solos (regla R16): hecho lleva su
// marca en verde, el actual va en el azul de la acción y con su número, y
// un paso con un riesgo real lleva el triángulo de aviso en rojo, que se
// lee antes de llegar. El nombre de cada nodo sale del título del paso,
// sin inventar nada (ver `etiquetaDeRuta`).

interface Props {
  resumenes: ResumenPaso[]
  indiceActual: number
  /** Mover la vista a un paso. No marca ni completa nada. */
  onIrAPaso: (indice: number) => void
  /** Abrir el índice de pasos, que es la ruta completa. */
  onVerRutaCompleta: () => void
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

export function RutaProcedimiento({ resumenes, indiceActual, onIrAPaso, onVerRutaCompleta }: Props) {
  const total = resumenes.length
  if (total === 0) return null
  const { previo, actual, siguiente } = vecinosDeRuta(resumenes, indiceActual)
  if (!actual) return null

  return (
    <nav aria-label="Ruta del procedimiento" className="flex-none">
      {/* TELÉFONO: el paso anterior, este y el siguiente. El nodo actual
          ES la cabecera del paso, así que la vista de debajo no repite
          "Paso N de M". */}
      <ol className="flex flex-col md:hidden">
        {previo && <NodoVecino resumen={previo} total={total} papel="previo" onIr={() => onIrAPaso(previo.indice)} />}
        <li>
          <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] leading-snug">
            <span className="font-semibold uppercase tracking-[.06em] text-noct-accion">
              Paso {actual.indice + 1} de {total}
            </span>
            {actual.estado === 'hecho' && (
              <span className="inline-flex items-center gap-1 text-noct-exito">
                <Check size={13} aria-hidden />
                hecho
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[17px] font-medium leading-snug text-pretty text-noct-text">
            {actual.titulo}
          </p>
        </li>
        {siguiente && (
          <NodoVecino resumen={siguiente} total={total} papel="siguiente" onIr={() => onIrAPaso(siguiente.indice)} />
        )}
        {total > (previo ? 1 : 0) + 1 + (siguiente ? 1 : 0) && (
          <li>
            <button
              type="button"
              onClick={onVerRutaCompleta}
              aria-haspopup="dialog"
              className="-ml-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 text-[12.5px] font-medium text-noct-neutral-400 hover:text-noct-text"
            >
              Ver la ruta completa · {total} pasos
              <CaretDown size={12} aria-hidden />
            </button>
          </li>
        )}
      </ol>

      {/* ESCRITORIO Y TABLETA: la ruta entera, en horizontal. */}
      <div className="hidden md:block">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {resumenes.map((resumen, indice) => (
            <li key={resumen.id} className="flex items-center gap-1">
              {indice > 0 && <ArrowRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />}
              <button
                type="button"
                onClick={() => onIrAPaso(resumen.indice)}
                aria-current={resumen.estado === 'actual' ? 'step' : undefined}
                aria-label={descripcionDeNodo(resumen, total)}
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
        </ol>
        <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2 text-[13.5px] leading-snug">
          <span className="font-semibold uppercase tracking-[.06em] text-noct-accion">
            Paso {actual.indice + 1} de {total}
          </span>
          <span className="text-[17px] font-medium text-noct-text">{actual.titulo}</span>
          {actual.estado === 'hecho' && (
            <span className="inline-flex items-center gap-1 text-noct-exito">
              <Check size={13} aria-hidden />
              hecho
            </span>
          )}
        </p>
      </div>
    </nav>
  )
}

// Un vecino del paso actual en el teléfono: una línea de 44 px que mueve
// la vista a ese paso (consultar, nunca marcar).
function NodoVecino({
  resumen,
  total,
  papel,
  onIr,
}: {
  resumen: ResumenPaso
  total: number
  papel: 'previo' | 'siguiente'
  onIr: () => void
}) {
  return (
    <li className="flex flex-col">
      {papel === 'siguiente' && <LineaConectora />}
      <button
        type="button"
        onClick={onIr}
        aria-label={descripcionDeNodo(resumen, total)}
        className="-ml-1.5 flex min-h-11 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-noct-text/[.05]"
      >
        <MarcaNodo resumen={resumen} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-noct-neutral-400">
          {etiquetaDeRuta(resumen.titulo)}
        </span>
        {resumen.tieneCuidado && <Warning size={13} className="shrink-0 text-noct-error" aria-hidden />}
      </button>
      {papel === 'previo' && <LineaConectora />}
    </li>
  )
}

function LineaConectora() {
  return <span aria-hidden className="ml-[7px] h-2.5 w-px bg-noct-neutral-700" />
}
