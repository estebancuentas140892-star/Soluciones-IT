import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { db, type Dispositivo } from '../../lib/db'
import { idsDeRed } from '../../lib/categorias'
import { estadoConEtiqueta, tonoEstado } from '../red/topologiaVisual'
import { buscarEquipos } from './busquedaEquipos'
import type { PersonasPorId } from './responsableEnLista'

// LA LISTA DE EQUIPOS AL LADO DE LA FICHA (tarea 339, T10; pizarra Ficha
// 1680). Desde 1680 px la ficha de un equipo se lee entre la lista de su
// sección y su índice (las tres zonas de la tarea 199): se salta de un equipo
// a otro sin volver a Equipos. Es la misma lista y la misma búsqueda que la
// pantalla Equipos (`buscarEquipos`: nombre, persona, IP, lugar o serial), en
// filas compactas: el estado en su punto, el nombre entero, y su IP en IBM
// Plex Mono con su categoría. El equipo abierto queda marcado.
//
// Su campo es el único buscador de la ventana: la ficha (nivel documento) no
// tiene otro.

const PUNTO_POR_TONO = {
  exito: 'bg-noct-exito',
  precaucion: 'bg-noct-precaucion',
  error: 'bg-noct-error',
  neutro: 'bg-noct-neutral-500',
} as const

export function ZonaListaEquipos({ actualId }: { actualId: string }) {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])
  const [texto, setTexto] = useState('')

  const idsRed = useMemo(() => idsDeRed(categorias), [categorias])
  const nombreCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const personaPorId: PersonasPorId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])
  const { generales, deRed, posibles } = useMemo(
    () => buscarEquipos(dispositivos, idsRed, { texto, categoriaId: '' }, personaPorId),
    [dispositivos, idsRed, texto, personaPorId],
  )
  // Sin buscar, los de red no se listan (como en Equipos); buscando, sí,
  // después de los generales.
  // Las posibles coincidencias (tarea 346), detrás de lo exacto.
  const filas = texto.trim() ? [...generales, ...deRed, ...posibles] : generales

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-noct-divider px-4 pb-3.5 pt-[18px]">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[20px] font-[650] tracking-[-.015em]">Equipos</h2>
          <span className="font-mono text-[13px] text-noct-neutral-500">{generales.length}</span>
        </div>
        <CampoBusqueda
          valor={texto}
          onCambiar={setTexto}
          alcance="Equipos"
          textoAlternativo="Nombre, persona, IP, lugar o serial"
        />
      </div>
      <ul className="flex flex-col gap-0.5 p-2" aria-label="Equipos">
        {filas.map((d) => (
          <li key={d.id}>
            <FilaCompacta dispositivo={d} categoria={nombreCategoria.get(d.categoriaId) ?? ''} actual={d.id === actualId} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FilaCompacta({ dispositivo, categoria, actual }: { dispositivo: Dispositivo; categoria: string; actual: boolean }) {
  const { etiqueta } = estadoConEtiqueta(dispositivo.estado)
  const tono = dispositivo.estado ? tonoEstado(etiqueta) : 'neutro'
  return (
    <Link
      to={`/dispositivos/${dispositivo.id}`}
      aria-current={actual ? 'page' : undefined}
      className={`flex min-h-[54px] items-center gap-[11px] rounded-[10px] px-2.5 py-[7px] text-noct-text ${
        actual ? 'bg-noct-accent/[.12] shadow-[inset_3px_0_0_var(--color-noct-accent)]' : 'hover:bg-noct-text/[.045]'
      }`}
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${PUNTO_POR_TONO[tono]}`} />
      <span className="min-w-0 flex-1">
        {/* El nombre entero: es su identidad (regla 23). */}
        <span className="block text-[14.5px] font-semibold leading-[1.3] [overflow-wrap:anywhere]">{dispositivo.nombre}</span>
        <span className="block truncate text-[12.5px] leading-[1.35] text-noct-neutral-400">
          {dispositivo.ip && <span className="font-mono">{dispositivo.ip}</span>}
          {dispositivo.ip && categoria && ' · '}
          {categoria}
        </span>
      </span>
      {dispositivo.estado && <span className="sr-only">{etiqueta}</span>}
    </Link>
  )
}
