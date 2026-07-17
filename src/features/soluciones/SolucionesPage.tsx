import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { ShellNocturne } from '../../app/ShellNocturne'
import { CaretRight, MagnifyingGlass, Plus } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { etiquetaDeTipo } from './tiposArticulo'
import { iconoDeCategoria, iconoDeTipo, normalizarTexto } from './iconosSoluciones'

// Pantalla Soluciones en el sistema Nocturne (handoff de Soluciones de
// Claude Design, trasladado al tema oscuro por decision D-006): un solo
// objetivo, "¿como realizo este procedimiento?". Combina buscador,
// rejilla de categorias que filtran en el sitio y una lista unificada
// de articulos con su icono de tipo, metadatos y estado. Sustituye a la
// rejilla simple de categorias anterior. Trae su propio ShellNocturne,
// por eso su ruta vive fuera del Layout oscuro heredado.
export function SolucionesPage() {
  const [query, setQuery] = useState('')
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null)

  const categorias = useLiveQuery(
    () => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'),
    [],
    [],
  )
  const articulos = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn).toArray(),
    [],
    [],
  )

  // Conteo de articulos por categoria para la tarjeta ("N articulos").
  const conteos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const articulo of articulos) {
      mapa.set(articulo.categoriaId, (mapa.get(articulo.categoriaId) ?? 0) + 1)
    }
    return mapa
  }, [articulos])

  // Nombre y orden de cada categoria: el nombre alimenta la linea de
  // metadatos y la busqueda; el orden mantiene juntos los articulos de
  // una misma categoria en la lista mezclada.
  const nombreCat = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const ordenCat = useMemo(() => new Map(categorias.map((c, i) => [c.id, i])), [categorias])

  const articulosFiltrados = useMemo(() => {
    const consulta = normalizarTexto(query.trim())
    return articulos
      .filter((articulo) => !categoriaSel || articulo.categoriaId === categoriaSel)
      .filter((articulo) => {
        if (!consulta) return true
        const categoria = nombreCat.get(articulo.categoriaId) ?? ''
        return (
          normalizarTexto(articulo.titulo).includes(consulta) ||
          normalizarTexto(categoria).includes(consulta)
        )
      })
      .sort((a, b) => {
        const oa = ordenCat.get(a.categoriaId) ?? 0
        const ob = ordenCat.get(b.categoriaId) ?? 0
        return oa - ob || a.titulo.localeCompare(b.titulo, 'es')
      })
  }, [articulos, categoriaSel, query, nombreCat, ordenCat])

  const hayFiltro = categoriaSel !== null || query.trim().length > 0
  const tituloLista = categoriaSel ? (nombreCat.get(categoriaSel) ?? 'Artículos') : 'Todos los artículos'

  function limpiarFiltros() {
    setCategoriaSel(null)
    setQuery('')
  }

  return (
    <ShellNocturne>
      <main className="flex flex-1 flex-col gap-6 px-4 pb-[116px] pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-medium leading-[1.2]">¿Cómo realizo este procedimiento?</h1>
            <p className="mt-1 text-[13.5px] leading-normal text-noct-neutral-400">
              Explora por categoría o busca un artículo
            </p>
          </div>
          {categoriaSel ? (
            <Link to={`/soluciones/${categoriaSel}/nuevo`} className={`shrink-0 ${BTN_PRIMARIO}`}>
              <Plus size={15} aria-hidden />
              Crear
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Elige una categoría para crear el artículo dentro de ella"
              className={`shrink-0 cursor-not-allowed opacity-45 ${BTN_PRIMARIO}`}
            >
              <Plus size={15} aria-hidden />
              Crear
            </button>
          )}
        </header>

        <label className="flex items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3 focus-within:border-noct-accent">
          <MagnifyingGlass size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o categoría"
            aria-label="Buscar artículos"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
          />
        </label>

        {categorias.length > 0 && (
          <section>
            <TituloSeccion className="mb-2.5">Categorías</TituloSeccion>
            <div className="grid grid-cols-2 gap-2.5">
              {categorias.map((categoria) => {
                const Icono = iconoDeCategoria(categoria.nombre)
                const seleccionada = categoria.id === categoriaSel
                const cuenta = conteos.get(categoria.id) ?? 0
                return (
                  <button
                    key={categoria.id}
                    type="button"
                    aria-pressed={seleccionada}
                    onClick={() => setCategoriaSel((actual) => (actual === categoria.id ? null : categoria.id))}
                    className={`flex flex-col items-start gap-2.5 rounded-lg border p-3.5 text-left transition-colors ${
                      seleccionada
                        ? 'border-noct-accent bg-noct-accent/[.08]'
                        : 'border-noct-divider bg-noct-surface hover:bg-noct-text/[.04]'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        seleccionada
                          ? 'bg-noct-accent/15 text-noct-accent-300'
                          : 'bg-noct-neutral-800 text-noct-neutral-400'
                      }`}
                    >
                      <Icono size={18} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{categoria.nombre}</span>
                      <span className="block text-[12.5px] text-noct-neutral-500">
                        {cuenta} {cuenta === 1 ? 'artículo' : 'artículos'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <TituloSeccion>{tituloLista}</TituloSeccion>
            {hayFiltro && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="shrink-0 cursor-pointer text-[12.5px] font-medium text-noct-accent"
              >
                Quitar filtros
              </button>
            )}
          </div>

          {articulosFiltrados.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-noct-divider bg-noct-surface">
              {articulosFiltrados.map((articulo, indice) => {
                const Icono = iconoDeTipo(articulo.tipo)
                const tiempo = normalizarProcedimiento(articulo.procedimiento)?.tiempoEstimadoMin
                const meta = [
                  nombreCat.get(articulo.categoriaId),
                  etiquetaDeTipo(articulo.tipo),
                  tiempo ? `${tiempo} min` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <Link
                    key={articulo.id}
                    to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
                    className={`flex items-center gap-3 px-3.5 py-3 hover:bg-noct-text/[.04] ${
                      indice > 0 ? 'border-t border-noct-divider' : ''
                    }`}
                  >
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-noct-neutral-800 text-noct-neutral-400">
                      <Icono size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{articulo.titulo}</span>
                      <span className="block truncate text-[12.5px] text-noct-neutral-500">{meta}</span>
                    </span>
                    {articulo.estado === 'borrador' && (
                      <span className="shrink-0 rounded-md border border-dashed border-noct-precaucion/40 bg-noct-precaucion/10 px-2 py-[3px] text-[11px] font-medium text-noct-precaucion">
                        Borrador
                      </span>
                    )}
                    {articulo.estado === 'obsoleto' && (
                      <span className="shrink-0 rounded-md bg-noct-neutral-800 px-2 py-[3px] text-[11px] font-medium text-noct-neutral-400">
                        Obsoleto
                      </span>
                    )}
                    <CaretRight size={16} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                )
              })}
            </div>
          ) : hayFiltro ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
              <MagnifyingGlass size={26} className="text-noct-neutral-600" aria-hidden />
              <div>
                <p className="text-sm font-medium">No se encontraron artículos</p>
                <p className="mt-0.5 text-[13px] text-noct-neutral-500">
                  Prueba con otras palabras o quita el filtro de categoría
                </p>
              </div>
              <button type="button" onClick={limpiarFiltros} className={`mt-1 ${BTN_SECUNDARIO}`}>
                Quitar filtros
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
              <p className="text-sm font-medium">Aún no hay artículos</p>
              <p className="mt-0.5 text-[13px] text-noct-neutral-500">
                Elige una categoría para crear el primero.
              </p>
            </div>
          )}
        </section>
      </main>
    </ShellNocturne>
  )
}
