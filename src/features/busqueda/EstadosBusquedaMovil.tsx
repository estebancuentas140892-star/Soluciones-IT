import type { ReactNode } from 'react'
import { CHIP, CHIP_REPOSO, TITULO_GRUPO } from '../../components/ventana/estilos'
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
    // Chips de 36 del prototipo de Claude Design (tarea 350), con 44 de toque:
    // 8 px entre filas para que dos toques amplios no se pisen.
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ejemplos de búsqueda">
      {conRotulo && <span className="text-[14px] font-semibold text-noct-neutral-300">Prueba con</span>}
      {EJEMPLOS_BUSCADOR.map((ejemplo) => (
        <button
          key={ejemplo}
          type="button"
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={() => onElegir(ejemplo)}
          className={`${CHIP} ${CHIP_REPOSO} font-semibold`}
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
    <section aria-labelledby="busqueda-puedes-escribir" className="flex flex-col gap-2.5">
      <h2 id="busqueda-puedes-escribir" className={TITULO_GRUPO}>
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
    // «Sin coincidencias» del prototipo (tarea 350): el título a 18 y la ayuda
    // a 15 en tinta 2, sin icono; lo buscado, entre comillas, sigue diciendo
    // qué no se encontró.
    <div className="flex flex-col items-center gap-2 px-3 pb-3 pt-8 text-center">
      <p className="text-[18px] font-extrabold leading-snug [overflow-wrap:anywhere]">Nada coincide con «{consulta}»</p>
      <p className="max-w-[300px] text-[15px] leading-[1.45] text-noct-neutral-300">
        Prueba con otra palabra, el nombre del equipo o su IP.
      </p>
      {children && <div className="mt-1.5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}
