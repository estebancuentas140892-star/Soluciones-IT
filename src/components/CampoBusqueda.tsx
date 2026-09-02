import type { Ref } from 'react'
import { MagnifyingGlass, XCircleFill } from './iconos'

// UN BUSCADOR POR PANTALLA, SIEMPRE EL MISMO (tarea 207, hallazgos
// M-004, M-005 y M-009, regla M-R8).
//
// Había NUEVE copias de este campo repartidas por la app, con cuatro
// alturas (46, 44, 42), dos radios, dos tamaños de icono y alcances
// redactados cada uno a su manera. La auditoría lo midió como una duda
// antes de escribir: "¿esto busca en todo o solo aquí?". Y el botón de
// borrar medía unos 26 px en casi todas (Guías era la excepción, con
// 44), justo el control que más se falla porque se usa con el teclado
// abierto y una mano.
//
// Aquí queda uno solo: **46 px de alto**, el alcance escrito en el
// marcador de posición con la misma fórmula en toda la app ("Buscar en
// X") y el borrar a **44 px reales** con margen negativo, para que el
// objetivo táctil crezca sin ensanchar la fila (regla R6, regla M-R14).
export function CampoBusqueda({
  valor,
  onCambiar,
  alcance,
  textoAlternativo,
  refCampo,
  className = '',
}: {
  valor: string
  onCambiar: (valor: string) => void
  // Dónde busca este campo, tal cual se lee: "Guías", "Equipos", "la
  // Bóveda". Compone el marcador ("Buscar en Guías") y la etiqueta
  // accesible, así que no hace falta repetirlo.
  alcance: string
  // Marcador propio, para el campo que no es una búsqueda por alcance
  // sino una pregunta (Diagnóstico: "Describir el problema: no imprime,
  // sin red..."). La etiqueta accesible sigue diciendo el alcance.
  textoAlternativo?: string
  refCampo?: Ref<HTMLInputElement>
  className?: string
}) {
  const buscando = valor.trim().length > 0

  return (
    <label
      className={`flex h-[46px] items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
        buscando ? 'border-noct-accent' : 'border-noct-divider'
      } ${className}`}
    >
      <MagnifyingGlass
        size={18}
        className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-400'}`}
        aria-hidden
      />
      <input
        ref={refCampo}
        type="search"
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        placeholder={textoAlternativo ?? `Buscar en ${alcance}`}
        aria-label={`Buscar en ${alcance}`}
        // La "x" nativa de WebKit se oculta siempre: duplicaba el botón
        // de borrar y medía la mitad.
        className="min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {buscando && (
        <button
          type="button"
          onClick={() => onCambiar('')}
          aria-label="Borrar la búsqueda"
          className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-noct-neutral-300 hover:text-noct-text"
        >
          <XCircleFill size={18} aria-hidden />
        </button>
      )}
    </label>
  )
}
