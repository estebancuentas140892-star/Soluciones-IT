import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Articulo, TipoArticulo } from '../../lib/db'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { ShellNocturne } from '../../app/ShellNocturne'
import { CaretRight, Clock, MagnifyingGlass, Plus, XCircleFill } from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { TIPOS_ARTICULO, etiquetaDeTipo } from './tiposArticulo'
import {
  claseTonoDeTipo,
  iconoDeCategoria,
  iconoDeTipo,
  normalizarTexto,
} from './iconosSoluciones'

// Pantalla Soluciones en el sistema Nocturne (re-autoria del handoff
// "Herramienta IT para técnicos", Soluciones.dc.html): un solo objetivo,
// "¿como realizo este procedimiento?". El buscador y una fila de chips de
// categoria (con su conteo) filtran en el sitio; dentro de una categoria
// aparecen subfiltros por tipo. La lista unifica los articulos con su
// icono de tipo coloreado, metadatos y estado; al buscar, los resultados
// se agrupan por categoria con el termino resaltado. Trae su propio
// ShellNocturne (sidebar en escritorio, pestañas en movil), por eso su
// ruta vive fuera del Layout oscuro heredado.

// Parte un titulo en tres tramos segun donde cae el termino buscado
// (comparando en texto normalizado, pero devolviendo el original con sus
// acentos y mayusculas). El resaltado usa `match`; si no hay coincidencia
// o consulta, todo el titulo queda en `pre`.
function partirTitulo(titulo: string, consulta: string) {
  if (!consulta) return { pre: titulo, match: '', post: '' }
  const i = normalizarTexto(titulo).indexOf(consulta)
  if (i < 0) return { pre: titulo, match: '', post: '' }
  return {
    pre: titulo.slice(0, i),
    match: titulo.slice(i, i + consulta.length),
    post: titulo.slice(i + consulta.length),
  }
}

// Chip de la fila superior: "Todos" mas una entrada por categoria.
interface Chip {
  id: string | null
  nombre: string
  count: number
  Icono: ReturnType<typeof iconoDeCategoria> | null
}

export function SolucionesPage() {
  // El parámetro ?categoria siembra el chip activo al volver desde el
  // editor tras Cancelar/Guardar (ArticuloForm), para reabrir la lista
  // con el mismo filtro. Es una semilla inicial: los cambios de chip
  // posteriores solo tocan el estado local, no la URL.
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [categoriaSel, setCategoriaSel] = useState<string | null>(
    () => searchParams.get('categoria'),
  )
  const [tipoSel, setTipoSel] = useState<TipoArticulo | null>(null)

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

  // Conteo de articulos por categoria para los chips ("N").
  const conteos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const articulo of articulos) {
      mapa.set(articulo.categoriaId, (mapa.get(articulo.categoriaId) ?? 0) + 1)
    }
    return mapa
  }, [articulos])

  // Nombre y orden de cada categoria: el nombre alimenta la busqueda y los
  // encabezados de grupo; el orden mantiene juntos los articulos de una
  // misma categoria en la lista mezclada.
  const nombreCat = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const ordenCat = useMemo(() => new Map(categorias.map((c, i) => [c.id, i])), [categorias])

  const consultaCruda = query.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

  // Coincidencia de un articulo: titulo, categoria, tipo o etiquetas.
  const coincide = (articulo: Articulo): boolean => {
    if (normalizarTexto(articulo.titulo).includes(consulta)) return true
    const categoria = nombreCat.get(articulo.categoriaId) ?? ''
    if (normalizarTexto(categoria).includes(consulta)) return true
    if (normalizarTexto(etiquetaDeTipo(articulo.tipo)).includes(consulta)) return true
    return articulo.etiquetas.some((e) => normalizarTexto(e).includes(consulta))
  }

  const chips = useMemo<Chip[]>(
    () => [
      { id: null, nombre: 'Todos', count: articulos.length, Icono: null },
      ...categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        count: conteos.get(c.id) ?? 0,
        Icono: iconoDeCategoria(c.nombre),
      })),
    ],
    [articulos.length, categorias, conteos],
  )

  // Tipos presentes en la categoria seleccionada (subfiltro solo al
  // navegar dentro de una categoria), en el orden fijo de TIPOS_ARTICULO.
  const tiposEnCategoria = useMemo(() => {
    if (!categoriaSel) return []
    const presentes = new Set(
      articulos.filter((a) => a.categoriaId === categoriaSel).map((a) => a.tipo),
    )
    return TIPOS_ARTICULO.filter((t) => presentes.has(t.valor))
  }, [articulos, categoriaSel])

  // Filtrado: al buscar manda el termino (ignora categoria y tipo); al
  // navegar, la categoria y el subfiltro de tipo.
  const filtrados = useMemo(() => {
    return articulos
      .filter((articulo) => {
        if (buscando) return coincide(articulo)
        if (categoriaSel && articulo.categoriaId !== categoriaSel) return false
        if (tipoSel && articulo.tipo !== tipoSel) return false
        return true
      })
      .sort((a, b) => {
        const oa = ordenCat.get(a.categoriaId) ?? 0
        const ob = ordenCat.get(b.categoriaId) ?? 0
        return oa - ob || a.titulo.localeCompare(b.titulo, 'es')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articulos, buscando, consulta, categoriaSel, tipoSel, nombreCat, ordenCat])

  // Agrupacion: al buscar, un grupo por categoria con encabezado; al
  // navegar, una sola lista plana sin encabezado.
  const grupos = useMemo(() => {
    if (!buscando) {
      return [{ id: 'all', nombre: '', Icono: null, count: filtrados.length, articulos: filtrados }]
    }
    return categorias
      .map((c) => {
        const arts = filtrados.filter((a) => a.categoriaId === c.id)
        return arts.length
          ? {
              id: c.id,
              nombre: c.nombre,
              Icono: iconoDeCategoria(c.nombre),
              count: arts.length,
              articulos: arts,
            }
          : null
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }, [buscando, categorias, filtrados])

  const total = filtrados.length
  const etiquetaResultados = total === 1 ? '1 resultado' : `${total} resultados`
  const primeraVez = !buscando && !categoriaSel && !tipoSel && articulos.length === 0

  function setCategoria(id: string | null) {
    setCategoriaSel((actual) => (actual === id ? null : id))
    setTipoSel(null)
  }
  function limpiarQuery() {
    setQuery('')
    setTipoSel(null)
  }
  function limpiarTodo() {
    setQuery('')
    setCategoriaSel(null)
    setTipoSel(null)
  }

  return (
    <ShellNocturne>
      {/* Cabecera fija con desenfoque: titulo, buscador, chips de
          categoria y, dentro de una categoria, subfiltros por tipo. */}
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-3">
          <h1 className="text-[22px] font-medium leading-tight">Soluciones</h1>
          {categoriaSel ? (
            <Link to={`/soluciones/${categoriaSel}/nuevo`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
              <Plus size={15} aria-hidden />
              Crear
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Elige una categoría para crear el artículo dentro de ella"
              className={`shrink-0 cursor-not-allowed opacity-45 ${BTN_SECUNDARIO}`}
            >
              <Plus size={15} aria-hidden />
              Crear
            </button>
          )}
        </header>

        <div className="px-4 pb-2.5 pt-2">
          <label
            className={`flex h-11 items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
              buscando ? 'border-noct-accent' : 'border-noct-divider'
            }`}
          >
            <MagnifyingGlass
              size={18}
              className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar procedimiento, categoría o etiqueta"
              aria-label="Buscar artículos"
              className="sol-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
            />
            {buscando && (
              <button
                type="button"
                onClick={limpiarQuery}
                aria-label="Borrar búsqueda"
                className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
              >
                <XCircleFill size={18} aria-hidden />
              </button>
            )}
          </label>
        </div>

        {!buscando && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => {
              const activo = chip.id === categoriaSel
              const Icono = chip.Icono
              return (
                <button
                  key={chip.id ?? '__todos'}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setCategoria(chip.id)}
                  className={`inline-flex h-[34px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                    activo
                      ? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                  }`}
                >
                  {Icono && <Icono size={15} aria-hidden />}
                  {chip.nombre}
                  <span
                    className={`text-[11.5px] ${activo ? 'text-noct-accent-400' : 'text-noct-neutral-600'}`}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {!buscando && categoriaSel && tiposEnCategoria.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tiposEnCategoria.map((t) => {
              const activo = t.valor === tipoSel
              const Icono = iconoDeTipo(t.valor)
              return (
                <button
                  key={t.valor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setTipoSel((actual) => (actual === t.valor ? null : t.valor))}
                  className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-[11px] text-[12px] font-medium transition-colors ${
                    activo
                      ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-400 hover:bg-noct-text/[.05]'
                  }`}
                >
                  <Icono size={13} aria-hidden />
                  {t.etiqueta}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <main className="flex-1 px-4 pb-[116px] pt-3.5 lg:pb-16">
        {buscando && (
          <p className="mb-3 text-[12.5px] text-noct-neutral-400">{etiquetaResultados}</p>
        )}

        {total > 0 ? (
          <div className="flex flex-col gap-[22px]">
            {grupos.map((grupo) => {
              const IconoGrupo = grupo.Icono
              return (
                <section key={grupo.id}>
                  {buscando && IconoGrupo && (
                    <div className="mb-2 flex items-center gap-2 px-0.5">
                      <IconoGrupo size={14} className="text-noct-neutral-400" aria-hidden />
                      <TituloSeccion>{grupo.nombre}</TituloSeccion>
                      <span className="text-[11px] text-noct-neutral-600">{grupo.count}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    {grupo.articulos.map((articulo) => {
                      const Icono = iconoDeTipo(articulo.tipo)
                      const tiempo = normalizarProcedimiento(articulo.procedimiento)?.tiempoEstimadoMin
                      const { pre, match, post } = partirTitulo(articulo.titulo, consulta)
                      return (
                        <Link
                          key={articulo.id}
                          to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
                          className="flex min-h-[56px] items-center gap-[13px] rounded px-2 py-3 text-noct-text hover:bg-noct-text/[.05]"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${claseTonoDeTipo(articulo.tipo)}`}
                          >
                            <Icono size={18} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="mb-[3px] block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                              {pre}
                              {match && (
                                <span className="rounded-[3px] bg-noct-accent/[.18] text-noct-accent-300">
                                  {match}
                                </span>
                              )}
                              {post}
                            </span>
                            <span className="flex items-center gap-[7px] whitespace-nowrap text-[12px] text-noct-neutral-500">
                              <span>{etiquetaDeTipo(articulo.tipo)}</span>
                              {tiempo != null && (
                                <>
                                  <span className="h-[2.5px] w-[2.5px] rounded-full bg-noct-neutral-600" />
                                  <span className="inline-flex items-center gap-[3px]">
                                    <Clock size={12} aria-hidden />
                                    {tiempo} min
                                  </span>
                                </>
                              )}
                            </span>
                          </span>
                          {articulo.estado === 'borrador' && (
                            <span className="shrink-0 rounded-md border border-dashed border-noct-precaucion/45 bg-noct-precaucion/[.16] px-2.5 py-[3px] text-[11px] font-medium text-noct-precaucion">
                              Borrador
                            </span>
                          )}
                          {articulo.estado === 'obsoleto' && (
                            <span className="shrink-0 rounded-md bg-noct-neutral-800 px-2.5 py-[3px] text-[11px] font-medium text-noct-neutral-100">
                              Obsoleto
                            </span>
                          )}
                          <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        ) : primeraVez ? (
          <div className="rounded-lg border border-dashed border-noct-neutral-700 px-6 py-14 text-center">
            <p className="text-sm font-medium">Aún no hay artículos</p>
            <p className="mt-1 text-[13px] leading-normal text-noct-neutral-400">
              Elige una categoría para crear el primero.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-14 text-center">
            <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
            <div>
              <p className="text-[14.5px] font-medium">Sin coincidencias</p>
              <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                {buscando
                  ? `Nada coincide con "${consultaCruda}". Prueba otra palabra o revisa la ortografía.`
                  : 'No hay artículos con estos filtros.'}
              </p>
            </div>
            <button type="button" onClick={limpiarTodo} className={`mt-0.5 ${BTN_SECUNDARIO}`}>
              Limpiar búsqueda
            </button>
          </div>
        )}
      </main>
    </ShellNocturne>
  )
}
