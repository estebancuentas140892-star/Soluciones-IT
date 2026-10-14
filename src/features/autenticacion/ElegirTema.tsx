import { useId, useSyncExternalStore } from 'react'
import { OpcionRadio } from '../../components/OpcionRadio'
import {
  guardarPreferenciaTema,
  preferenciaTemaActual,
  suscribirPreferenciaTema,
  type PreferenciaTema,
} from '../../lib/tema'

// EL TEMA EN AJUSTES (tarea 333, recomendación RP-3 del rediseño móvil;
// regla 12 desde el 2026-10-13). Oscuro es el de siempre y el de quien no
// elige; claro, para leer a pleno sol; automático, el que tenga el
// teléfono. Se aplica al tocar, sin guardar aparte, y vale solo en este
// teléfono (ver src/lib/tema.ts).

const OPCIONES: { valor: PreferenciaTema; titulo: string; detalle: string }[] = [
  { valor: 'oscuro', titulo: 'Oscuro', detalle: 'El de siempre.' },
  { valor: 'claro', titulo: 'Claro', detalle: 'Para leer a pleno sol.' },
  { valor: 'automatico', titulo: 'Automático', detalle: 'Claro u oscuro, como el teléfono.' },
]

export function ElegirTema() {
  const preferencia = useSyncExternalStore(suscribirPreferenciaTema, preferenciaTemaActual)
  const idTitulo = useId()
  return (
    // Solo con ancho de teléfono (tarea 338, AD-087): el claro nació para
    // leer a pleno sol dentro del rediseño móvil y desde 768 px no pinta,
    // así que ahí no se ofrece. La preferencia guardada no se toca.
    <div className="flex flex-col gap-2.5 p-3.5 md:hidden">
      <div>
        <p id={idTitulo} className="text-[14px] font-semibold text-noct-text">
          Tema
        </p>
        <p className="text-[12.5px] text-noct-neutral-400">Solo en este teléfono.</p>
      </div>
      <div role="radiogroup" aria-labelledby={idTitulo} className="flex flex-col gap-1.5">
        {OPCIONES.map((opcion) => (
          <OpcionRadio key={opcion.valor} activa={preferencia === opcion.valor} onClick={() => guardarPreferenciaTema(opcion.valor)}>
            <span className="block text-[14px] font-medium text-noct-text">{opcion.titulo}</span>
            <span className="block text-[12.5px] text-noct-neutral-400">{opcion.detalle}</span>
          </OpcionRadio>
        ))}
      </div>
    </div>
  )
}
