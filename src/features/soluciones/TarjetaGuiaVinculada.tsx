import { BookOpen, CaretRight } from '../../components/iconos'
import type { EstadoVinculo } from './estadoVinculo'

// LA TARJETA DE UNA GUÍA VINCULADA (encargo del 2026-09-10, tarea 4).
//
// Antes un vínculo era una fila de 44 px que, al abrirla, DESPLEGABA EL
// PROCEDIMIENTO ENTERO debajo de la tarea principal. Dos guías en una
// sola pantalla, con dos zonas de acciones y una página que no acababa:
// el técnico perdía de vista qué estaba haciendo y para qué.
//
// Además la fila truncaba el nombre para hacerle sitio a un ANILLO de
// avance de 22 px, que no dice ni cuántos pasos hay ni en cuál va. Se
// perdía el dato que importa (cuál es la guía) por dibujar uno
// ilegible.
//
// Ahora el vínculo es una tarjeta compacta: qué papel juega, el nombre
// ENTERO, en qué va escrito con palabras y una sola acción que dice qué
// va a pasar al tocarla. Abrirla no despliega nada aquí: sustituye el
// contenido de la tarea por la ejecución de esa guía.
export function TarjetaGuiaVinculada({
  kicker,
  titulo,
  estado,
  onAbrir,
}: {
  kicker: string
  titulo: string
  estado: EstadoVinculo
  onAbrir: () => void
}) {
  const claseEstado =
    estado.clase === 'completada'
      ? 'border-noct-exito/45 bg-noct-exito/10 text-noct-exito'
      : estado.clase === 'en-curso'
        ? 'border-noct-accent/45 bg-noct-accent/10 text-noct-accent-300'
        : 'border-noct-divider text-noct-neutral-300'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-noct-divider bg-noct-surface/60 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
          <BookOpen size={14} className="shrink-0" aria-hidden />
          {kicker}
        </span>
        {/* EL ESTADO, CON PALABRAS. Sustituye al anillo de avance: "Sin
            iniciar", "Paso 3 de 5" o "Completada". */}
        <span
          className={`inline-flex h-[26px] items-center rounded-full border px-2.5 text-[11.5px] font-medium ${claseEstado}`}
        >
          {estado.texto}
        </span>
      </div>

      {/* EL NOMBRE ENTERO, sin recortar: es lo que decide si el técnico
          reconoce la guía. */}
      <p className="text-[16px] font-medium leading-snug text-pretty text-noct-text">{titulo}</p>

      <button
        type="button"
        onClick={onAbrir}
        aria-label={`${estado.accion}: ${titulo}`}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-4 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18] active:bg-noct-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
      >
        <span className="truncate">{estado.accion}</span>
        <CaretRight size={16} className="shrink-0" aria-hidden />
      </button>
    </div>
  )
}
