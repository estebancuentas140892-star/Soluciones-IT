import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Articulo, TipoArticulo } from '../../lib/db'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { CaretDown, Info, Plus, Sliders } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { HojaFiltro, type OpcionHoja } from '../../components/HojaFiltro'
import { PastillaFrescura } from '../../components/PastillaFrescura'
import { TIPOS_ARTICULO, etiquetaDeTipo } from './tiposArticulo'
import { colorIconoDeTipo, iconoDeCategoria, iconoDeTipo, normalizarTexto } from './iconosSoluciones'
import { claseActivaDeCategoria, claseTextoDeCategoria } from './coloresCategoria'
import { accionDeGuia, type AccionGuia } from './accionGuia'
import { FilaArticulo } from './FilaArticulo'
import { coincidenciaArticulo } from './coincidencia'
import { sugerenciaBusqueda } from './sugerenciaBusqueda'
import { normalizarProcedimiento } from '../../lib/procedimiento'

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
//   4. (RETIRADO el 2026-09-09, hallazgo H01 del informe del 8 de
//      septiembre.) Aquí vivía el bloque "Sin terminar". Acumulaba
//      procedimientos a medias sobre el catálogo, así que abrir una
//      guía para consultarla acababa pareciendo una obligación
//      pendiente y el catálogo perdía el primer plano. Lo que se
//      conserva es el AVANCE, que no se toca: la ficha de cada guía
//      sigue diciendo "Seguir en el paso N de M" y ahora ofrece
//      también "Empezar de nuevo" al lado. Es la regla del encargo:
//      la posición de lectura se guarda, pero no genera una lista
//      global de pendientes.
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
  // EL TÉRMINO BUSCADO VIAJA A LA URL (criterio A03: volver desde una
  // guía repone filtro, término y posición). Antes no viajaba a
  // propósito, "porque es transitorio y reescribiría la URL en cada
  // tecla"; el efecto secundario era que abrir un resultado y volver
  // dejaba el catálogo entero y la búsqueda perdida. Se resuelve
  // escribiéndolo con retardo (ver el efecto de sincronización), no
  // quitándolo: una escritura cada 400 ms no ensucia el historial
  // porque va con `replace`.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
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
  // ACCESO A LAS CATEGORÍAS QUE NO SE ESCONDE (hallazgo H02). Ver la
  // nota del control, más abajo.
  const [hojaCategoriaAbierta, setHojaCategoriaAbierta] = useState(false)

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
  // El avance guardado en ESTE teléfono, solo para que la acción de la
  // tarjeta diga "Continuar · paso N de M" en vez de "Empezar" (encargo
  // del 2026-09-09, sección 1: la tercera zona es "abrir, empezar o
  // continuar"). No reaparece el bloque "Sin terminar" que retiró H01:
  // esto no ordena, no filtra ni saca ninguna guía de su sitio en el
  // catálogo; solo cambia el rótulo de la guía que ya estás mirando.
  const progresos = useLiveQuery(() => db.progresoPasos.toArray(), [], [])
  // Lo que ofrece cada tarjeta lo decide `accionDeGuia`, la MISMA
  // funcion que la ficha de la guia: antes la tarjeta tenia su propia
  // regla (`hechos > 0`) y por eso decia "Empezar" con una ejecucion
  // abierta. Solo entran los articulos con fila de progreso; sin ella
  // la tarjeta ofrece "Empezar", que es lo correcto.
  const accionPorArticulo = useMemo(() => {
    const mapa = new Map<string, AccionGuia>()
    for (const progreso of progresos) {
      const procedimiento = normalizarProcedimiento(
        articulos.find((a) => a.id === progreso.articuloId)?.procedimiento ?? null,
      )
      if (!procedimiento || procedimiento.pasos.length === 0) continue
      mapa.set(progreso.articuloId, accionDeGuia(procedimiento, progreso, true))
    }
    return mapa
  }, [progresos, articulos])
  const nombreCat = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const ordenCat = useMemo(() => new Map(categorias.map((c, i) => [c.id, i])), [categorias])
  const categoriaActiva = categoriaSel ? categorias.find((c) => c.id === categoriaSel) : undefined

  const consultaCruda = query.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

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

  // EL CHIP CUENTA LO QUE VA A DAR (tarea 207, hallazgo M-022). Antes el
  // número iba sobre la biblioteca entera, así que buscando "switch" un
  // chip podía prometer "CCTV 12" y al tocarlo dar cero. Ahora se cuenta
  // sobre el ALCANCE VISIBLE: lo que dejan los demás filtros activos
  // (la búsqueda, la etiqueta, el tipo), sin aplicar el propio eje de
  // categoría, que es lo que el chip decide. Es el criterio que ya usaba
  // la hoja del segundo eje.
  const alcanceChips = useMemo(() => {
    return articulos.filter((articulo) => {
      if (buscando) return coincidencias.has(articulo.id)
      if (etiquetaSel) {
        const clave = normalizarTexto(etiquetaSel)
        return (articulo.etiquetas ?? []).some((e) => normalizarTexto(e) === clave)
      }
      return !tipoSel || articulo.tipo === tipoSel
    })
  }, [articulos, buscando, coincidencias, etiquetaSel, tipoSel])

  const conteos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const articulo of alcanceChips) {
      mapa.set(articulo.categoriaId, (mapa.get(articulo.categoriaId) ?? 0) + 1)
    }
    return mapa
  }, [alcanceChips])

  const chips = useMemo<Chip[]>(
    () => [
      {
        id: null,
        nombre: 'Todos',
        count: alcanceChips.length,
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
    [alcanceChips.length, categorias, conteos],
  )

  // OPCIONES DE LA HOJA DE CATEGORÍAS (hallazgo H02, criterios A01 y
  // A02). Solo las que TIENEN contenido dentro del alcance visible: una
  // categoría vacía en el primer plano de consulta es un camino que no
  // lleva a ninguna parte (sigue existiendo en administración, que es
  // lo que pide el encargo). "Todos" va siempre.
  const opcionesCategoria = useMemo<OpcionHoja<string>[]>(
    () => [
      { valor: '__todos', etiqueta: 'Todas las categorías', count: alcanceChips.length },
      ...categorias
        .filter((c) => (conteos.get(c.id) ?? 0) > 0)
        .map((c) => ({
          valor: c.id,
          etiqueta: c.nombre,
          Icono: iconoDeCategoria(c.nombre),
          claseIcono: claseTextoDeCategoria(c),
          count: conteos.get(c.id) ?? 0,
        })),
    ],
    [alcanceChips.length, categorias, conteos],
  )

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
    const escribir = () => {
      const params = new URLSearchParams()
      if (categoriaSel) params.set('categoria', categoriaSel)
      if (tipoSel) params.set('tipo', tipoSel)
      if (etiquetaSel) params.set('etiqueta', etiquetaSel)
      if (query.trim()) params.set('q', query.trim())
      if (params.toString() === searchParams.toString()) return
      setSearchParams(params, { replace: true })
    }
    // Los ejes se escriben ya; el texto, con retardo, para no tocar la
    // URL en cada tecla.
    const id = setTimeout(escribir, 400)
    return () => clearTimeout(id)
  }, [categoriaSel, tipoSel, etiquetaSel, query, searchParams, setSearchParams])

  function setCategoria(id: string | null) {
    const quita = id === null || categoriaSel === id
    setCategoriaSel(quita ? null : id)
    setTipoSel(null)
    setEtiquetaSel(null)
    // ELEGIR UNA CATEGORÍA MIENTRAS SE BUSCA ES ACOTAR LA BÚSQUEDA. Sin
    // esto, tocar "Impresoras" con un término escrito no cambiaba nada
    // visible: la búsqueda manda sobre el eje de categoría salvo que se
    // pida "Solo ahí", así que el control parecía roto. Elegirla ES
    // pedirlo; la cinta de contexto sigue explicando en qué alcance se
    // está buscando y permite volver a todas.
    setSoloEnCategoria(!quita && buscando)
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
      // Tarjetas separadas por hueco, no renglones con regla (tablero
      // 3b): cada guía es una unidad con su propia acción, no un
      // elemento de una lista continua.
      //
      // UNA COLUMNA HASTA QUE HAYA SITIO DE VERDAD (encargo del
      // 2026-09-09, sección 1). Los cortes son de CONTENEDOR, no de
      // pantalla, así que cuentan el ancho útil que queda después de las
      // barras laterales de escritorio. Estaban en `@lg` (512 px) y
      // `@4xl` (896): a 512 cada tarjeta se quedaba con unos 240 px de
      // ancho, menos que un teléfono de 360, y el título largo volvía a
      // partirse igual que en móvil. Con `@2xl` (672) la segunda columna
      // entra a unos 325 px por tarjeta y la tercera, en `@5xl` (1024),
      // a unos 330.
      <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {articulosDelGrupo.map((articulo) => {
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
              accion={accionPorArticulo.get(articulo.id) ?? null}
              coincidencia={
                coincidencia && !coincidencia.enTitulo && coincidencia.donde && coincidencia.valor
                  ? { donde: coincidencia.donde, valor: coincidencia.valor }
                  : undefined
              }
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
    // `conLupa={false}` (regla M-R8, "un buscador por pantalla", tarea
    // 207): esta pantalla ya tiene su propio campo con el alcance
    // escrito, así que la lupa de la barra superior sería el segundo
    // buscador de la misma pantalla y con otro alcance. La duda que
    // midió la auditoría era exactamente esa: "¿esto busca en todo o
    // solo aquí?". Buscar en todo sigue a un toque, desde Inicio.
    <Chasis titulo="Guías" conLupa={false} barra={
      <>
        <header className="flex items-center justify-between gap-2.5 px-4 pb-2 pt-1">
          <PastillaFrescura total={articulos.length} singular="artículo" plural="artículos" />
          {botonCrear}
        </header>

        <div className="px-4 pb-2.5">
          <CampoBusqueda
            valor={query}
            onCambiar={(v) => (v ? setQuery(v) : limpiarQuery())}
            alcance="Guías"
          />
        </div>

        {/* CATEGORÍAS QUE NO SE PIERDEN (hallazgo H02, criterios A01,
            A02 y A18).

            Aquí había un carrusel horizontal: en 360 px cabían "Todos" y
            una categoría y media, POS quedaba a medio cortar y Software,
            Impresoras y las otras cinco solo se alcanzaban arrastrando
            una fila sin barra de scroll visible. Encima desaparecía
            entera al escribir en el buscador (`!buscando`), así que
            justo cuando el técnico quería acotar por categoría, el
            control ya no estaba.

            Ahora son DOS controles fijos de 44 px, con el nombre
            completo de lo que está activo, y las opciones se eligen en
            una hoja donde todas caben con su nombre y su conteo. Una
            sola fila: el encargo pide no apilar barras fijas. Y no se
            oculta al buscar, así que acotar sigue a un toque. */}
        <div className="flex items-center gap-2 px-4 pb-3 xl:hidden">
          <button
            type="button"
            onClick={() => setHojaCategoriaAbierta(true)}
            aria-haspopup="dialog"
            className={`inline-flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border-[1.5px] px-4 text-[14.5px] font-medium transition-colors ${
              categoriaActiva
                ? (claseActivaDeCategoria(categoriaActiva) ??
                  'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300')
                : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
            }`}
          >
            <Sliders size={15} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">
              {categoriaActiva ? categoriaActiva.nombre : 'Categorías'}
            </span>
            <span className={`shrink-0 text-[12.5px] ${categoriaActiva ? 'opacity-75' : 'text-noct-neutral-400'}`}>
              {categoriaActiva ? (conteos.get(categoriaActiva.id) ?? 0) : alcanceChips.length}
            </span>
            <CaretDown size={12} className="shrink-0" aria-hidden />
          </button>
          {opcionesTipo.length > 0 && (
            <button
              type="button"
              onClick={() => setHojaTipoAbierta(true)}
              aria-haspopup="dialog"
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed bg-noct-bg px-4 text-[14.5px] font-medium transition-colors ${
                tipoSel
                  ? 'border-noct-accent text-noct-accent-300'
                  : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
              }`}
            >
              <span className="max-w-[7.5rem] truncate">{tipoSel ? etiquetaDeTipo(tipoSel) : 'Tipo'}</span>
              <CaretDown size={12} className={tipoSel ? undefined : 'text-noct-neutral-400'} aria-hidden />
            </button>
          )}
        </div>
      </>
    }>
      <main className="flex-1 px-4 pb-16 pt-3.5">
        {/* EL RAIL DE CATEGORÍAS NO SE VA AL BUSCAR (2026-09-09, cambio
            1 del encargo). Tanto la rejilla como el `aside` colgaban de
            `!buscando`, así que en escritorio las categorías
            desaparecían al escribir en el buscador y el técnico se
            quedaba sin forma de acotar justo cuando más falta hacía. En
            móvil ya no pasaba (los dos controles de 44 px son fijos);
            esto pone al escritorio a la par. Los conteos del rail ya se
            calculaban sobre el alcance visible, así que durante una
            búsqueda dicen cuántos resultados hay en cada categoría. */}
        <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-6">
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

      {/* Todas las categorías con su nombre completo y su conteo. Es lo
          que sustituye al carrusel que escondía la mitad. */}
      <HojaFiltro
        abierto={hojaCategoriaAbierta}
        onCerrar={() => setHojaCategoriaAbierta(false)}
        titulo="Categorías"
        opciones={opcionesCategoria}
        seleccionada={categoriaSel ?? '__todos'}
        onElegir={(valor) => {
          setCategoriaSel(valor === '__todos' ? null : valor)
          setTipoSel(null)
          setEtiquetaSel(null)
          setSoloEnCategoria(false)
          setHojaCategoriaAbierta(false)
        }}
      />

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
