import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, Plus, X } from '../../components/iconos'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { agruparResultados } from './resultados'
import { ResultadosBusqueda } from './ResultadosBusqueda'
import { buscar, useIndiceBusqueda } from './useIndiceBusqueda'

// Buscador global en capa (tarea 181, mockup 3d del handoff). Hasta
// ahora buscar era global pero vivia DENTRO de Inicio: desde cualquier
// otra pestaña habia que volver a Inicio y perder el sitio donde se
// estaba. Ahora la lupa vive en la barra superior de las cinco pestañas
// y abre esta capa sin abandonar la pantalla (regla R14).
//
// Declara su alcance por escrito, que es la otra mitad del problema: la
// app tenia cinco buscadores con la misma forma y cinco alcances
// distintos, y nada decia cual era cual.

export function BuscadorGlobal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [query, setQuery] = useState('')
  const campo = useRef<HTMLInputElement>(null)

  // Mismo criterio que Inicio: el input usa `query` directo y todo lo
  // derivado usa la version diferida, para que escribir se sienta
  // instantaneo aunque la busqueda tarde algo mas en ponerse al dia.
  const queryDiferida = useDeferredValue(query)
  const consultaCruda = queryDiferida.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])
  const grupos = useMemo(() => agruparResultados(resultados), [resultados])

  useEffect(() => {
    if (!abierto) return
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclado)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // El teclado del telefono debe abrirse solo: quien toca la lupa ya
    // decidio que va a escribir.
    campo.current?.focus()
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  // La consulta no sobrevive al cierre: la capa se abre siempre limpia,
  // porque se invoca desde cualquier pestaña y arrastrar la busqueda
  // anterior confundiria mas de lo que ahorra.
  useEffect(() => {
    if (!abierto) setQuery('')
  }, [abierto])

  if (!abierto) return null

  // Portal a <body> por el mismo motivo que Modal: la barra superior
  // desde la que se invoca lleva `backdrop-blur`, que crea bloque
  // contenedor y romperia `fixed inset-0`.
  return createPortal(
    <div className="nocturne fixed inset-0 z-[60] flex flex-col bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="flex items-center gap-2 border-b border-noct-divider px-3 py-2.5">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-noct-accent bg-noct-surface px-3.5">
          <MagnifyingGlass size={18} className="shrink-0 text-noct-accent" aria-hidden />
          <input
            ref={campo}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en todo"
            aria-label="Buscar en todo el conocimiento del equipo"
            className="ini-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
          />
        </label>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el buscador"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-200 hover:bg-noct-text/[.05]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {!buscando ? (
          // Alcance declarado: es lo que distingue a este buscador de los
          // de seccion, que tienen la misma forma y otro limite.
          <p className="px-0.5 text-[13px] leading-relaxed text-noct-neutral-400">
            Busca en todo a la vez: Guías, Equipos, Bóveda, Ubicaciones y Personas. Tolera errores de
            escritura y entiende sinónimos ("backup" encuentra "copia de seguridad").
          </p>
        ) : grupos.length > 0 ? (
          <ResultadosBusqueda grupos={grupos} consulta={consulta} onNavegar={onCerrar} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
            <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
            <div>
              <p className="text-[14.5px] font-medium">Sin coincidencias</p>
              <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                Nada coincide con "{consultaCruda}". Prueba otra palabra o revisa la ortografía.
              </p>
            </div>
            <div className="mt-0.5 flex flex-wrap justify-center gap-2">
              <Link
                to={`/dispositivos/nuevo?nombre=${encodeURIComponent(consultaCruda)}`}
                onClick={onCerrar}
                className={BTN_SECUNDARIO}
              >
                <Plus size={15} aria-hidden />
                Crear equipo
              </Link>
              <button type="button" onClick={() => setQuery('')} className={BTN_SECUNDARIO}>
                Limpiar búsqueda
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
