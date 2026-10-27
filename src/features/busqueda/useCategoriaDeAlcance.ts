import { useCallback, useMemo, useState } from 'react'
import type { Alcance } from './alcanceBusqueda'
import {
  categoriaEfectiva,
  categoriasDelAlcance,
  filtrarPorCategoria,
  idDeGuiaDe,
  type CategoriaDe,
} from './categoriasDeAlcance'
import { useCategoriasDeGuias } from './useCategoriasDeGuias'
import { useDatosDeEquipos } from './useDatosDeEquipos'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

/**
 * LA CATEGORÍA DENTRO DEL ALCANCE (tarea 362, D2): qué categorías ofrece la
 * fila, cuál está elegida y lo encontrado ya acotado por ella. Elegir otro
 * alcance vuelve a «Todas», como en el prototipo. Lo comparten Resolver y la
 * capa del buscador global, que tienen cada uno sus chips de tipo.
 */
export function useCategoriaDeAlcance(visibles: ResultadoBusqueda[], alcance: Alcance) {
  const categoriasDeGuias = useCategoriasDeGuias()
  const equipos = useDatosDeEquipos()
  const categoriaDe = useCallback<CategoriaDe>(
    (resultado) =>
      resultado.tipo === 'dispositivo'
        ? (equipos.get(idDeGuiaDe(resultado))?.categoriaNombre ?? '')
        : (categoriasDeGuias.get(idDeGuiaDe(resultado)) ?? ''),
    [categoriasDeGuias, equipos],
  )
  const [elegida, setElegida] = useState<{ alcance: Alcance; nombre: string | null }>({ alcance, nombre: null })
  // Otro alcance, otra fila: la categoría elegida no viaja de uno a otro.
  if (elegida.alcance !== alcance) setElegida({ alcance, nombre: null })
  const { categorias, total } = useMemo(
    () => categoriasDelAlcance(alcance, visibles, categoriaDe),
    [alcance, visibles, categoriaDe],
  )
  const categoria = categoriaEfectiva(elegida.alcance === alcance ? elegida.nombre : null, categorias)
  const filtrados = useMemo(
    () => filtrarPorCategoria(visibles, categoria, categoriaDe),
    [visibles, categoria, categoriaDe],
  )
  const elegir = useCallback((nombre: string | null) => setElegida({ alcance, nombre }), [alcance])
  return { categorias, total, categoria, elegir, filtrados }
}
