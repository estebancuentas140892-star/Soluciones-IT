import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Articulo, TipoArticulo } from '../../lib/db'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { CaretDown, Info, MagnifyingGlass, Play, Plus, XCircleFill } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { HojaFiltro, type OpcionHoja } from '../../components/HojaFiltro'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { PastillaFrescura } from '../../components/PastillaFrescura'
import { TIPOS_ARTICULO, etiquetaDeTipo } from './tiposArticulo'
import { colorIconoDeTipo, iconoDeCategoria, iconoDeTipo, normalizarTexto } from './iconosSoluciones'
import { claseActivaDeCategoria, claseTextoDeCategoria } from './coloresCategoria'
import { FilaArticulo } from './FilaArticulo'
import { coincidenciaArticulo } from './coincidencia'
import { articulosSinTerminar } from './sinTerminar'
import { sugerenciaBusqueda } from './sugerenciaBusqueda'

// Pantalla Soluciones en el sistema Nocturne. Rediseñada a partir de la
// auditoría de la sección (handoff "Auditoría de Soluciones TI",
// Auditoría Soluciones.dc.html, pantalla P1, opciones 1c y 1d).
//
// Un solo objetivo: "¿cómo hago este procedimiento?". Lo que cambió
// respecto de la versión anterior, y por qué (numeración de la auditoría):
//
//   1. UN eje de filtro visible (R4). Antes había dos carruseles apilados
//      (categoría y tipo) y la cabecera pegajosa llegaba a 232 px, un
//      tercio de la pantalla antes del primer artículo. El tipo pasó a una
//      hoja inferior con su contador.
//   2. "Crear" siempre activo (R3). Antes estaba deshabilitado hasta
//      elegir categoría y la razón vivía en un `title`, que en un teléfono
//      nadie lee porque no hay hover. Ahora, sin categoría, abre una hoja
//      que pregunta cuál.
//   4. Bloque "Sin terminar" arriba: retomar un procedimiento
//      interrumpido pasó de cuatro toques a uno.
//   8. Cinta de contexto al buscar: antes buscar apagaba los filtros en
//      silencio y el resultado salía de otra categoría sin explicación.
//   9. Por qué coincidió cada resultado (ver coincidencia.ts).
//  10. Pastilla de frescura bajo el título (R7).
//  13. Todo objetivo táctil a 44 px (R6): el borrar del buscador medía 26.
//
// El color de la CATEGORÍA vive en los chips de filtro; el del TIPO, en el
// glifo de cada fila (R1, ver FilaArticulo). Nunca los dos en la misma
// superficie.
//
// Escritorio: la auditoría resolvió las cinco pantallas a 448 px y dejó el
// rediseño de escritorio como pendiente explícito, así que el rail de
// categorías y la rejilla de 2-3 columnas desde `xl` se conservan tal como
// estaban (decisión del usuario al autorizar el handoff, 2026-07-27).

interface Chip {
  id: string | null
  nombre: string
  count: number
  Icono: ReturnType<typeof iconoDeCategoria> | null
  claseActiva: string | null
  claseTexto: string | null
}

// Cuántos procedimientos a medias se listan como máximo. El bloque es un
// atajo, no una sección: si ocupa media pantalla deja de ayudar a lo que
// el técnico vino a hacer.
const MAX_SIN_TERMINAR = 3

export function SolucionesPage() {
  // El parámetro ?categoria siembra el chip activo al volver desde el
  // editor tras Cancelar/Guardar (ArticuloForm), para reabrir la lista
  // con el mismo filtro.
  //
  // Desde la tarea 187 el viaje es en los dos sentidos: el chip también
  // ESCRIBE en la URL, porque de ahí lo lee la memoria de pestaña del
  // chasis (`src/app/memoriaPestana.ts`, regla R20). Antes el filtro
  // solo vivía en el estado local, así que cambiar de pestaña y volver
  // lo borraba: la pestaña apuntaba a `/soluciones` pelado.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [categoriaSel, setCategoriaSel] = useState<string | null>(() => searchParams.get('categoria'))
  const [tipoSel, setTipoSel] = useState<TipoArticulo | null>(
    () => TIPOS_ARTICULO.find((t) => t.valor === searchParams.get('tipo'))?.valor ?? null,
  )
  // Filtro por etiqueta (fase J4): se llega aqui tocando una etiqueta en
  // la ficha de un articulo (?etiqueta=<x>). Es un modo propio, como
  // buscando: mientras esta activo ignora categoria/tipo, y se limpia
  // al elegir una categoria o al volver a "Todos".
  const [etiquetaSel, setEtiquetaSel] = useState<string | null>(() => searchParams.get('etiqueta'))
  // Buscar mira TODAS las categorías por defecto (es lo que el técnico
  // espera al escribir), pero ahora lo dice en voz alta y ofrece acotar a
  // la categoría que tenía elegida en vez de descartarla en silencio.
  const [soloEnCategoria, setSoloEnCategoria] = useState(false)
  const [hojaTipoAbierta, setHojaTipoAbierta] = useState(false)
  const [hojaCrearAbierta, setHojaCrearAbierta] = useState(false)

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
  // Avance local del técnico, para el bloque "Sin terminar". Vive solo en
  // este dispositivo (como los recientes), así que la tabla es pequeña:
  // una fila por procedimiento empezado.
  const progresos = useLiveQuery(() => db.progresoPasos.toArray(), [], [])

  // Conteo de articulos por categoria para los chips ("N").
  const conteos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const articulo of articulos) {
      mapa.set(articulo.categoriaId, (mapa.get(articulo.categoriaId) ?? 0) + 1)
    }
    return mapa
  }, [articulos])

  const nombreCat = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const ordenCat = useMemo(() => new Map(categorias.map((c, i) => [c.id, i])), [categorias])
  const categoriaActiva = categoriaSel ? categorias.find((c) => c.id === categoriaSel) : undefined

  const consultaCruda = query.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

  const chips = useMemo<Chip[]>(
    () => [
      {
        id: null,
        nombre: 'Todos',
        count: articulos.length,
        Icono: null,
        claseActiva: null,
        claseTexto: null,
      },
      ...categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        count: conteos.get(c.id) ?? 0,
        Icono: iconoDeCategoria(c.nombre),
        claseActiva: claseActivaDeCategoria(c),
        claseTexto: claseTextoDeCategoria(c),
      })),
    ],
    [articulos.length, categorias, conteos],
  )

  // Tipos presentes en lo que se está mirando, con su conteo, para la hoja
  // del segundo eje. A diferencia de la versión anterior, el eje de tipo
  // ya no depende de haber elegido categoría: la hoja está siempre
  // disponible y se acota a la categoría cuando hay una.
  const opcionesTipo = useMemo<OpcionHoja<TipoArticulo>[]>(() => {
    const enAlcance = categoriaSel
      ? articulos.filter((a) => a.categoriaId === categoriaSel)
      : articulos
    const conteoPorTipo = new Map<TipoArticulo, number>()
    for (const articulo of enAlcance) {
      conteoPorTipo.set(articulo.tipo, (conteoPorTipo.get(articulo.tipo) ?? 0) + 1)
    }
    return TIPOS_ARTICULO.filter((t) => conteoPorTipo.has(t.valor)).map((t) => ({
      valor: t.valor,
      etiqueta: t.etiqueta,
      Icono: iconoDeTipo(t.valor),
      claseIcono: colorIconoDeTipo(t.valor),
      count: conteoPorTipo.get(t.valor) ?? 0,
    }))
  }, [articulos, categoriaSel])

  // Opciones de la hoja de creación: en qué categoría nace el artículo.
  const opcionesCrear = useMemo<OpcionHoja<string>[]>(
    () =>
      categorias.map((c) => ({
        valor: c.id,
        etiqueta: c.nombre,
        Icono: iconoDeCategoria(c.nombre),
        claseIcono: claseTextoDeCategoria(c),
      })),
    [categorias],
  )

  const sinTerminar = useMemo(
    () => articulosSinTerminar(articulos, progresos),
    [articulos, progresos],
  )

  // Coincidencia de cada artículo con la búsqueda, guardando POR DÓNDE
  // coincidió para poder explicarlo en la fila.
  const coincidencias = useMemo(() => {
    if (!buscando) return new Map<string, ReturnType<typeof coincidenciaArticulo>>()
    const mapa = new Map<string, ReturnType<typeof coincidenciaArticulo>>()
    for (const articulo of articulos) {
      const resultado = coincidenciaArticulo(
        articulo,
        consulta,
        nombreCat.get(articulo.categoriaId) ?? '',
      )
      if (resultado) mapa.set(articulo.id, resultado)
    }
    return mapa
  }, [articulos, buscando, consulta, nombreCat])

  // Filtrado. Al buscar manda el término, acotado a la categoría solo si
  // el técnico lo pidió con "Solo ahí"; si hay una etiqueta activa (y no
  // se está buscando) es su propio modo; si no, categoría y tipo.
  const filtrados = useMemo(() => {
    return articulos
      .filter((articulo) => {
        if (buscando) {
          if (!coincidencias.has(articulo.id)) return false
          if (soloEnCategoria && categoriaSel && articulo.categoriaId !== categoriaSel) return false
          return true
        }
        if (etiquetaSel) {
          const clave = normalizarTexto(etiquetaSel)
          return (articulo.etiquetas ?? []).some((e) => normalizarTexto(e) === clave)
        }
        if (categoriaSel && articulo.categoriaId !== categoriaSel) return false
        if (tipoSel && articulo.tipo !== tipoSel) return false
        return true
      })
      .sort((a, b) => {
        const oa = ordenCat.get(a.categoriaId) ?? 0
        const ob = ordenCat.get(b.categoriaId) ?? 0
        return oa - ob || a.titulo.localeCompare(b.titulo, 'es')
      })
  }, [
    articulos,
    buscando,
    coincidencias,
    soloEnCategoria,
    etiquetaSel,
    categoriaSel,
    tipoSel,
    ordenCat,
  ])

  // Agrupacion: al buscar, un grupo por categoria con encabezado; al
  // navegar, una sola lista plana sin encabezado.
  const grupos = useMemo(() => {
    if (!buscando) {
      return [{ id: 'all', nombre: '', Icono: null, claseTexto: null, count: filtrados.length, articulos: filtrados }]
    }
    return categorias
      .map((c) => {
        const arts = filtrados.filter((a) => a.categoriaId === c.id)
        return arts.length
          ? {
              id: c.id,
              nombre: c.nombre,
              Icono: iconoDeCategoria(c.nombre),
              claseTexto: claseTextoDeCategoria(c),
              count: arts.length,
              articulos: arts,
            }
          : null
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }, [buscando, categorias, filtrados])

  const total = filtrados.length
  const primeraVez = !buscando && !categoriaSel && !tipoSel && articulos.length === 0

  // Corrección ortográfica para el estado vacío del buscador, contra el
  // vocabulario de lo que esta pantalla lista (títulos, etiquetas y
  // nombres de categoría).
  const sugerencia = useMemo(() => {
    if (!buscando || total > 0) return null
    const textos = [
      ...articulos.map((a) => a.titulo),
      ...articulos.flatMap((a) => a.etiquetas ?? []),
      ...categorias.map((c) => c.nombre),
    ]
    return sugerenciaBusqueda(consultaCruda, textos)
  }, [articulos, buscando, categorias, consultaCruda, total])

  // Los tres filtros de eje (categoría, tipo, etiqueta) viajan a la URL
  // con `replace` para no ensuciar el historial: cambiar de chip no es un
  // paso atrás que el técnico quiera deshacer, es la misma pantalla
  // mirada de otra forma. El texto buscado NO viaja: es transitorio y
  // reescribiría la URL en cada tecla.
  useEffect(() => {
    const params = new URLSearchParams()
    if (categoriaSel) params.set('categoria', categoriaSel)
    if (tipoSel) params.set('tipo', tipoSel)
    if (etiquetaSel) params.set('etiqueta', etiquetaSel)
    if (params.toString() === searchParams.toString()) return
    setSearchParams(params, { replace: true })
  }, [categoriaSel, tipoSel, etiquetaSel, searchParams, setSearchParams])

  function setCategoria(id: string | null) {
    setCategoriaSel((actual) => (actual === id ? null : id))
    setTipoSel(null)
    setEtiquetaSel(null)
    setSoloEnCategoria(false)
  }
  function limpiarQuery() {
    setQuery('')
    setTipoSel(null)
    setSoloEnCategoria(false)
  }
  function limpiarTodo() {
    setQuery('')
    setCategoriaSel(null)
    setTipoSel(null)
    setEtiquetaSel(null)
    setSoloEnCategoria(false)
  }

  // "Crear" nunca está muerto (R3): con categoría elegida va directo a su
  // editor; sin ella, pregunta en qué categoría nace el artículo.
  const botonCrear = categoriaSel ? (
    <Link to={`/soluciones/${categoriaSel}/nuevo`} className={`shrink-0 ${BTN_PRIMARIO}`}>
      <Plus size={15} aria-hidden />
      Crear
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => setHojaCrearAbierta(true)}
      className={`shrink-0 ${BTN_PRIMARIO}`}
    >
      <Plus size={15} aria-hidden />
      Crear
    </button>
  )

  // Rejilla de resultados de un grupo. El separador se omite en la última
  // fila para no dejar una regla colgando al final de la lista.
  function filasDe(articulosDelGrupo: Articulo[]) {
    return (
      <div className="grid grid-cols-1 gap-x-3 @lg:grid-cols-2 @4xl:grid-cols-3">
        {articulosDelGrupo.map((articulo, indice) => {
          const coincidencia = coincidencias.get(articulo.id)
          return (
            <FilaArticulo
              key={articulo.id}
              articulo={articulo}
              to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
              // La categoría se nombra cuando la lista puede mezclarlas:
              // buscando, en "Todos" o filtrando por etiqueta.
              categoriaNombre={categoriaSel ? undefined : nombreCat.get(articulo.categoriaId)}
              consulta={consulta}
              coincidencia={
                coincidencia && !coincidencia.enTitulo && coincidencia.donde && coincidencia.valor
                  ? { donde: coincidencia.donde, valor: coincidencia.valor }
                  : undefined
              }
              conSeparador={indice < articulosDelGrupo.length - 1}
            />
          )
        })}
      </div>
    )
  }

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila, con la barra
    // superior de tres ranuras y las pestañas. El título, el estado del
    // dato, buscar y la cuenta los aporta el chasis (tarea 181); en
    // `barra` quedan solo los controles propios de la sección: frescura,
    // "Crear", el buscador de artículos y UN solo eje de filtro visible
    // (categorías) más el botón que plega el segundo.
    <Chasis titulo="Guías" barra={
      <>
        <header className="flex items-center justify-between gap-2.5 px-4 pb-2 pt-1">
          <PastillaFrescura total={articulos.length} singular="artículo" plural="artículos" />
          {botonCrear}
        </header>

        <div className="px-4 pb-2.5">
          <label
            className={`flex h-[46px] items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
              buscando ? 'border-noct-accent' : 'border-noct-divider'
            }`}
          >
            <MagnifyingGlass
              size={18}
              className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-400'}`}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar equipo, síntoma o etiqueta"
              aria-label="Buscar artículos"
              className="sol-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
            />
            {buscando && (
              // 44 px reales (R6): antes eran 26 y era el control que más
              // se falla, porque se usa con el teclado abierto.
              <button
                type="button"
                onClick={limpiarQuery}
                aria-label="Borrar búsqueda"
                className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-noct-neutral-300 hover:text-noct-text"
              >
                <XCircleFill size={18} aria-hidden />
              </button>
            )}
          </label>
        </div>

        {!buscando && (
          <div className="flex items-center gap-2 px-4 pb-3 xl:hidden">
            {/* El degradado del extremo derecho dice que hay más
                categorías sin necesidad de barra de scroll (la barra está
                oculta por CSS y antes nada lo indicaba). */}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,#000_82%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map((chip) => {
                const activo = chip.id === categoriaSel
                const Icono = chip.Icono
                return (
                  <button
                    key={chip.id ?? '__todos'}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setCategoria(chip.id)}
                    className={`inline-flex h-9 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                      activo
                        ? (chip.claseActiva ?? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300')
                        : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
                    }`}
                  >
                    {Icono && (
                      <Icono
                        size={15}
                        className={activo ? undefined : (chip.claseTexto ?? undefined)}
                        aria-hidden
                      />
                    )}
                    {chip.nombre}
                    {/* neutral-400, no neutral-600: a 12 px ese paso daba
                        4.0:1 sobre el fondo y AA pide 4.5 (R2). */}
                    <span className={`text-[12px] ${activo ? 'opacity-75' : 'text-noct-neutral-400'}`}>
                      {chip.count}
                    </span>
                  </button>
                )
              })}
            </div>
            {opcionesTipo.length > 0 && (
              <button
                type="button"
                onClick={() => setHojaTipoAbierta(true)}
                aria-haspopup="dialog"
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-noct-bg px-3 text-[13px] font-medium transition-colors ${
                  tipoSel
                    ? 'border-noct-accent text-noct-accent-300'
                    : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
                }`}
              >
                {tipoSel ? etiquetaDeTipo(tipoSel) : 'Tipo'}
                <CaretDown size={12} className={tipoSel ? undefined : 'text-noct-neutral-400'} aria-hidden />
              </button>
            )}
          </div>
        )}
      </>
    }>
      <main className="flex-1 px-4 pb-16 pt-3.5">
        <div className={!buscando ? 'xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-6' : ''}>
          {!buscando && (
            <aside className="hidden min-w-0 xl:block">
              <div className="sticky top-[104px] flex flex-col gap-1">
                {chips.map((chip) => {
                  const activo = chip.id === categoriaSel
                  const Icono = chip.Icono
                  return (
                    <button
                      key={chip.id ?? '__todos'}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setCategoria(chip.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                        activo
                          ? (chip.claseActiva ?? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300')
                          : 'border-transparent text-noct-neutral-200 hover:bg-noct-text/[.05]'
                      }`}
                    >
                      {Icono && (
                        <Icono
                          size={15}
                          className={`shrink-0 ${activo ? '' : (chip.claseTexto ?? '')}`}
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{chip.nombre}</span>
                      <span className={`shrink-0 text-[12px] ${activo ? 'opacity-75' : 'text-noct-neutral-400'}`}>
                        {chip.count}
                      </span>
                    </button>
                  )
                })}
                {opcionesTipo.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHojaTipoAbierta(true)}
                    aria-haspopup="dialog"
                    className={`mt-2 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      tipoSel
                        ? 'border-noct-accent text-noct-accent-300'
                        : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {tipoSel ? etiquetaDeTipo(tipoSel) : 'Tipo de documento'}
                    </span>
                    <CaretDown size={12} className={tipoSel ? undefined : 'text-noct-neutral-400'} aria-hidden />
                  </button>
                )}
              </div>
            </aside>
          )}

          <div className="@container min-w-0">
            {/* Cinta de contexto al buscar: antes el chip activo
                desaparecía y los resultados salían de otra categoría sin
                decir nada. Ahora se dice qué filtro quedó en pausa y se
                ofrece acotar. */}
            {buscando && categoriaActiva && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-noct-divider bg-noct-surface px-2.5 py-2">
                <Info size={14} className="shrink-0 text-noct-neutral-300" aria-hidden />
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-noct-neutral-200">
                  {soloEnCategoria ? (
                    <>
                      Busco solo en <b className="font-medium">{categoriaActiva.nombre}</b>.
                    </>
                  ) : (
                    <>
                      Busco en todas las categorías. El filtro{' '}
                      <b className="font-medium">{categoriaActiva.nombre}</b> queda en pausa.
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setSoloEnCategoria((actual) => !actual)}
                  className="shrink-0 text-[12px] font-medium text-noct-accent-300 underline underline-offset-[3px]"
                >
                  {soloEnCategoria ? 'En todas' : 'Solo ahí'}
                </button>
              </div>
            )}

            {/* Filtro por etiqueta activo (fase J4): llegado desde una
                ficha de articulo, sin obligar a volver a buscar. */}
            {etiquetaSel && !buscando && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] px-3.5 py-2.5">
                <p className="min-w-0 truncate text-[12.5px] text-noct-accent-300">Etiqueta: {etiquetaSel}</p>
                <Link
                  to="/soluciones"
                  onClick={() => setEtiquetaSel(null)}
                  className="shrink-0 text-[12px] text-noct-accent-300 underline underline-offset-2"
                >
                  Ver todos
                </Link>
              </div>
            )}

            {/* Retomar es tan importante como buscar: lo que quedó a
                medias va arriba, con el paso actual, lo que falta y una
                sola acción. */}
            {!buscando && !etiquetaSel && sinTerminar.length > 0 && (
              <section className="mb-5">
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <TituloSeccion>Sin terminar</TituloSeccion>
                  <span className="text-[11px] text-noct-neutral-400">{sinTerminar.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {sinTerminar.slice(0, MAX_SIN_TERMINAR).map(({ articulo, hechos, total: pasos, minutosRestantes }) => {
                    const Icono = iconoDeTipo(articulo.tipo)
                    return (
                      <Link
                        key={articulo.id}
                        to={`/soluciones/${articulo.categoriaId}/${articulo.id}/ejecutar`}
                        className="block rounded-lg border border-noct-accent/[.32] bg-noct-accent/[.08] px-3 py-2.5 text-noct-text hover:bg-noct-accent/[.12]"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06]">
                            <Icono size={17} className={colorIconoDeTipo(articulo.tipo)} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                              {articulo.titulo}
                            </span>
                            <span className="mt-1 block text-[11.5px] text-noct-neutral-300">
                              Paso {hechos + 1} de {pasos}
                              {minutosRestantes != null && ` · te quedan ~${minutosRestantes} min`}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-noct-accent px-2.5 py-1.5 text-[12px] font-medium text-noct-accent">
                            <Play size={12} aria-hidden />
                            Seguir
                          </span>
                        </span>
                        <IndicadorAvance hechos={hechos} total={pasos} variante="barra" className="mt-2.5" />
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {total > 0 && (
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <TituloSeccion>
                  {buscando
                    ? `${total} ${total === 1 ? 'artículo coincide' : 'artículos coinciden'}`
                    : 'Todos los artículos'}
                </TituloSeccion>
                {!buscando && <span className="text-[11px] text-noct-neutral-400">{total}</span>}
              </div>
            )}

            {total > 0 ? (
              <div className="flex flex-col gap-[22px]">
                {grupos.map((grupo) => {
                  const IconoGrupo = grupo.Icono
                  return (
                    <section key={grupo.id}>
                      {buscando && IconoGrupo && (
                        <div className="mb-2 flex items-center gap-2 px-0.5">
                          <IconoGrupo
                            size={14}
                            className={grupo.claseTexto ?? 'text-noct-neutral-400'}
                            aria-hidden
                          />
                          <TituloSeccion>{grupo.nombre}</TituloSeccion>
                          <span className="text-[11px] text-noct-neutral-400">{grupo.count}</span>
                        </div>
                      )}
                      {filasDe(grupo.articulos)}
                    </section>
                  )
                })}
              </div>
            ) : primeraVez ? (
              // Todo estado vacío nombra qué falta y ofrece la acción que
              // lo llena (R5), en vez de describir el vacío y dejar al
              // técnico buscando el botón.
              <div className="rounded-lg border border-dashed border-noct-neutral-700 px-5 py-6">
                <p className="text-[14.5px] font-medium leading-snug">
                  Aquí va a vivir lo que el equipo sabe
                </p>
                <p className="mb-3 mt-1.5 text-[13px] leading-relaxed text-noct-neutral-300">
                  Nada todavía. El primer artículo suele ser el procedimiento que más repites en la
                  semana.
                </p>
                <button
                  type="button"
                  onClick={() => setHojaCrearAbierta(true)}
                  className={BTN_PRIMARIO}
                >
                  <Plus size={15} aria-hidden />
                  Crear el primero
                </button>
              </div>
            ) : buscando ? (
              <div className="rounded-lg border border-dashed border-noct-neutral-700 px-5 py-6">
                <p className="text-[14.5px] font-medium leading-snug">
                  Nada coincide con «{consultaCruda}»
                </p>
                <p className="mb-3 mt-1.5 text-[13px] leading-relaxed text-noct-neutral-300">
                  {sugerencia ? (
                    <>
                      Quizá quisiste decir{' '}
                      <button
                        type="button"
                        onClick={() => setQuery(sugerencia)}
                        className="text-noct-accent-300 underline underline-offset-[3px]"
                      >
                        {sugerencia}
                      </button>
                      . También puedes buscar por el equipo o por la sede.
                    </>
                  ) : (
                    'Prueba con el nombre del equipo, el síntoma o la sede.'
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={limpiarTodo} className={BTN_SECUNDARIO}>
                    Limpiar la búsqueda
                  </button>
                  <button
                    type="button"
                    onClick={() => setHojaCrearAbierta(true)}
                    className={BTN_PRIMARIO}
                  >
                    <Plus size={14} aria-hidden />
                    Documentarlo
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-noct-neutral-700 px-5 py-6">
                <p className="text-[14.5px] font-medium leading-snug">No hay artículos con estos filtros</p>
                <p className="mb-3 mt-1.5 text-[13px] leading-relaxed text-noct-neutral-300">
                  {tipoSel
                    ? `Ninguno es del tipo «${etiquetaDeTipo(tipoSel)}» aquí.`
                    : 'Esta categoría todavía no tiene nada documentado.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={limpiarTodo} className={BTN_SECUNDARIO}>
                    Quitar los filtros
                  </button>
                  {botonCrear}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* El segundo eje de filtro, plegado (R4). */}
      <HojaFiltro
        abierto={hojaTipoAbierta}
        onCerrar={() => setHojaTipoAbierta(false)}
        titulo="Tipo de documento"
        opciones={opcionesTipo}
        seleccionada={tipoSel}
        onElegir={(valor) => setTipoSel((actual) => (actual === valor ? null : valor))}
        onLimpiar={() => setTipoSel(null)}
      />

      {/* "Crear" sin categoría elegida: la hoja pregunta cuál, en vez de
          dejar el botón apagado con la explicación en un `title` (R3). */}
      <HojaFiltro
        abierto={hojaCrearAbierta}
        onCerrar={() => setHojaCrearAbierta(false)}
        titulo="¿En qué categoría?"
        opciones={opcionesCrear}
        onElegir={(id) => navigate(`/soluciones/${id}/nuevo`)}
      />
    </Chasis>
  )
}
