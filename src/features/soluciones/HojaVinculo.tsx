import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { MagnifyingGlass, X } from '../../components/iconos'
import { normalizarTexto } from './iconosSoluciones'

// Hoja inferior que ELIGE un vínculo del paso, con buscador (tarea 212,
// hallazgo del tablero 6b). Sustituye a los cuatro `<select>` nativos
// del editor de pasos: información protegida, procedimiento
// relacionado, solución si el paso falla, y el "Si responde No" de una
// tarea de decisión.
//
// El problema que cierra: en el teléfono un `<select>` largo abre la
// rueda del sistema, no se puede buscar dentro y el título llega
// cortado. Con la biblioteca de guías creciendo, la lista de
// vinculables ya no cabe en una rueda.
//
// Se apoya en `Modal`, como el resto de hojas del editor.

export interface OpcionVinculo {
  id: string
  titulo: string
}

export interface GrupoVinculo {
  // Sin etiqueta: lista plana, sin encabezado de grupo (procedimiento
  // relacionado, solución, "Si responde No"). Con etiqueta: separa como
  // el `<optgroup>` que reemplaza (información protegida).
  etiqueta?: string
  opciones: OpcionVinculo[]
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  placeholderBuscar: string
  grupos: GrupoVinculo[]
  onElegir: (id: string) => void
}

const ID_TITULO = 'hoja-vinculo-titulo'

export function HojaVinculo({ abierto, onCerrar, titulo, placeholderBuscar, grupos, onElegir }: Props) {
  const [consulta, setConsulta] = useState('')

  // Cada apertura empieza sin filtro: arrastrar la búsqueda anterior
  // confundiría más de lo que ahorra (mismo criterio que BuscadorGlobal).
  useEffect(() => {
    if (!abierto) setConsulta('')
  }, [abierto])

  const filtro = normalizarTexto(consulta.trim())
  const gruposFiltrados = grupos
    .map((grupo) => ({
      ...grupo,
      opciones: filtro ? grupo.opciones.filter((o) => normalizarTexto(o.titulo).includes(filtro)) : grupo.opciones,
    }))
    .filter((grupo) => grupo.opciones.length > 0)
  const sinResultados = filtro !== '' && gruposFiltrados.length === 0

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span id={ID_TITULO} className="min-w-0 truncate text-[17px] font-medium leading-tight text-noct-text">
          {titulo}
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <label className="mb-2 flex h-12 items-center gap-2.5 rounded-[10px] border border-noct-divider bg-noct-bg px-3.5 focus-within:border-noct-accent">
        <MagnifyingGlass size={17} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder={placeholderBuscar}
          aria-label={placeholderBuscar}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
        />
      </label>

      <div className="flex max-h-[50vh] flex-col overflow-y-auto">
        {gruposFiltrados.map((grupo, indice) => (
          <div key={grupo.etiqueta ?? indice}>
            {grupo.etiqueta && (
              <p className="mb-1 mt-3 px-1 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-500 first:mt-0">
                {grupo.etiqueta}
              </p>
            )}
            {grupo.opciones.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => {
                  onElegir(opcion.id)
                  onCerrar()
                }}
                className="flex min-h-14 w-full items-center rounded-[10px] px-3 text-left text-[14.5px] text-noct-text hover:bg-noct-text/[.06] active:bg-noct-text/[.1]"
              >
                <span className="min-w-0 flex-1 truncate">{opcion.titulo}</span>
              </button>
            ))}
          </div>
        ))}
        {sinResultados && (
          <p className="px-1 py-8 text-center text-[13.5px] text-noct-neutral-500">
            Ninguna coincidencia para «{consulta.trim()}»
          </p>
        )}
      </div>
    </Modal>
  )
}
