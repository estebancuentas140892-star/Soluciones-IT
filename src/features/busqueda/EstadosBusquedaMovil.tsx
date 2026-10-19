import type { ReactNode } from 'react'
import { MagnifyingGlass } from '../../components/iconos'
import { EJEMPLOS_BUSCADOR } from './resultados'

// LOS ESTADOS DE LA BÚSQUEDA EN EL TELÉFONO (rediseño móvil, fase 1, tarea
// 344; DESPUÉS de Claude Design). Los comparten la búsqueda de Resolver y la
// capa del buscador global, que son el MISMO buscador (el mismo índice y los
// mismos resultados): así los dos dicen lo mismo con las mismas palabras.
// Solo presentación; desde 768 cada pantalla conserva lo suyo.

// Los ejemplos, como botones que escriben la consulta. `onMouseDown` evita
// que el campo pierda el foco al tocarlos: el teclado sigue abierto y la
// consulta cambia en el mismo gesto.
export function EjemplosBusqueda({
  onElegir,
  conRotulo = false,
}: {
  onElegir: (ejemplo: string) => void
  /** "Prueba con:" delante, en la misma línea (Resolver, bajo su campo). */
  conRotulo?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ejemplos de búsqueda">
      {conRotulo && <span className="text-[14px] text-noct-neutral-400">Prueba con:</span>}
      {EJEMPLOS_BUSCADOR.map((ejemplo) => (
        <button
          key={ejemplo}
          type="button"
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={() => onElegir(ejemplo)}
          className="inline-flex min-h-11 items-center rounded-full border border-noct-divider bg-noct-surface px-3.5 text-[15px] font-medium text-noct-text hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado"
        >
          {ejemplo}
        </button>
      ))}
    </div>
  )
}

// SIN NADA ESCRITO: qué se puede escribir y ejemplos para empezar.
export function PuedesEscribir({ onElegir }: { onElegir: (ejemplo: string) => void }) {
  return (
    <section aria-labelledby="busqueda-puedes-escribir" className="flex flex-col gap-2.5 px-0.5">
      <h2 id="busqueda-puedes-escribir" className="text-[17px] font-[650] leading-snug">
        Puedes escribir
      </h2>
      <p className="text-[15px] leading-[1.45] text-noct-neutral-300">
        Lo que pasa, con tus palabras, o el nombre o la IP de un equipo, una persona o un lugar. Entiende sinónimos y
        errores de escritura.
      </p>
      <EjemplosBusqueda onElegir={onElegir} />
    </section>
  )
}

// NADA COINCIDE: qué se buscó, con qué probar y las salidas de quien lo usa
// (crear el equipo, borrar y empezar de nuevo).
export function NadaCoincide({ consulta, children }: { consulta: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-3 pb-3 pt-6 text-center">
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-noct-tinte text-noct-neutral-400">
        <MagnifyingGlass size={24} aria-hidden />
      </span>
      <p className="text-[16px] font-[650] leading-snug [overflow-wrap:anywhere]">Nada coincide con «{consulta}»</p>
      <p className="max-w-[280px] text-[13.5px] leading-[1.45] text-noct-neutral-400">
        Prueba con el código del equipo, parte de la IP o una palabra del problema.
      </p>
      {children && <div className="mt-1.5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}
