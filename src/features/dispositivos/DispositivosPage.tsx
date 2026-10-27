import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db, type Dispositivo } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { idsDeRed, esDeRed } from '../../lib/categorias'
import { conOrigen } from '../../lib/origenNavegacion'
import { partesDeContexto, ubicacionDeEquipo } from '../../lib/contextoEquipo'
import { FilaDispositivo } from '../../components/FilaDispositivo'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { FilaDeslizable } from '../../components/FilaDeslizable'
import { Monitor, Plus } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { useEsAncho } from '../../components/useEsAncho'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { CHIP, CHIP_ACTIVO, CHIP_REPOSO, TITULO_GRUPO } from '../../components/ventana/estilos'
import { useAnotarBusqueda, useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { buscarEquipos, chipsDeEquipos, CHIP_RED, conteosDeChips, type ChipDeEquipos } from './busquedaEquipos'
import { anotadoEnLista, partesDelSubtitulo, personaQueLoTiene, type PersonasPorId } from './responsableEnLista'

// Pantalla Dispositivos re-autorizada en el sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Dispositivos.dc.html, entrada
// R4): responde "¿qué se sabe de cada equipo?" con el inventario
// general (las categorías de red van en la sección Red, no aquí:
// decisión ya existente antes del rediseño). Declara nivel de sección en
// el chasis único (tarea 185), que le pone sidebar en escritorio y
// pestañas en móvil.
//
// EQUIPOS + QR (encargo del 2026-09-22, secciones 16 y 17, tarea 256):
//
//   - Buscar y Escanear QR van delante y con el mismo peso: el QR es
//     otra forma de buscar. "Crear equipo" baja a secundario.
//   - Fuera el menú "···" (Ubicaciones, Personas, Etiquetas QR e
//     Importar ya viven en Más) y el resumen de estados (cada fila lleva
//     el suyo).
//   - Al escribir también salen los equipos de red, aparte ("Equipos de
//     red"): ver `busquedaEquipos.ts`.
//   - La búsqueda sobrevive al salto a una ficha: viaja en el estado de
//     navegación como la del buscador de Resolver, y el chip de
//     categoría en la URL (regla 13).

export function DispositivosPage() {
  const dispositivos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const categorias = useLiveQuery(
    () => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'),
    [],
    [],
  )
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  // Quién tiene cada equipo y de qué área es (tarea 317): las personas se
  // cargan UNA vez y se leen por `responsableId`, nunca una consulta por
  // fila. Es reactivo: si una persona cambia de área, la lista lo dice.
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])

  // El chip de categoría, en la URL: volver de una ficha lo repone.
  const [parametros, setParametros] = useSearchParams()
  const categoriaId = parametros.get('categoria') ?? ''
  const elegirCategoria = useCallback(
    (id: string) =>
      setParametros(
        (actuales) => {
          const siguientes = new URLSearchParams(actuales)
          if (id) siguientes.set('categoria', id)
          else siguientes.delete('categoria')
          return siguientes
        },
        { replace: true },
      ),
    [setParametros],
  )

  // Lo escrito vuelve con el regreso de la ficha o con el botón atrás
  // del teléfono (mismo mecanismo que Resolver, sin URL ni localStorage).
  const { restaurada, descartar } = useBusquedaRestaurada()
  const repuesta = restaurada && !restaurada.capa ? restaurada.consulta : ''
  const [texto, setTexto] = useState(repuesta)
  // Vaciar el campo repuesto es dar la búsqueda por terminada.
  useEffect(() => {
    if (repuesta !== '' && texto === '') descartar()
  }, [repuesta, texto, descartar])

  const categoriasGenerales = useMemo(
    () => (categorias ?? []).filter((c) => !esDeRed(c)),
    [categorias],
  )
  const idsRed = useMemo(() => idsDeRed(categorias), [categorias])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )
  const ubicacionPorId = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u])), [ubicaciones])
  const personaPorId: PersonasPorId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])

  // Desde la tarea 317 también se busca por el área de quien tiene el
  // equipo, leída de su ficha de persona.
  // Desde la tarea 346, con errores de tecleo: lo que solo coincide con una
  // errata llega aparte (`posibles`) y se dice como "Posibles coincidencias".
  const { generales, deRed, posibles } = useMemo(
    () => buscarEquipos(dispositivos ?? [], idsRed, { texto, categoriaId }, personaPorId),
    [dispositivos, idsRed, texto, categoriaId, personaPorId],
  )
  // Bajo el nombre, solo lo que el nombre no dice ya (tarea 277):
  // "Impresora Taquilla" no repite "Impresoras · Taquilla". La ubicación,
  // la de su ficha si está vinculada. Se calcula por lista: si callar
  // dejara iguales dos equipos distintos, esos dos lo dicen todo.
  //
  // En el inventario general, si alguien tiene el equipo, la línea dice
  // quién, de qué área es y dónde está el equipo en vez de la categoría,
  // que ya dice el icono (tarea 317, `partesDelSubtitulo`). Van como
  // partes separadas, también con un nombre anotado, para que la fila no
  // las parta por la mitad en un teléfono. Los equipos de red conservan
  // su categoría: en ese bloque es lo que los distingue.
  const subtitulos = useMemo(() => {
    const lineas = new Map<string, string | string[]>()
    const ubicacion = (d: Dispositivo) => ubicacionDeEquipo(d, ubicacionPorId.get(d.ubicacionId ?? ''))
    const contexto = (d: Dispositivo) => [nombreCategoria.get(d.categoriaId), ubicacion(d)]
    const listas: [
      Dispositivo[],
      (d: Dispositivo) => ReadonlyArray<string | null | undefined>,
      (d: Dispositivo) => boolean,
    ][] = [
      [
        generales,
        (d) => partesDelSubtitulo(d, { categoria: nombreCategoria.get(d.categoriaId), ubicacion: ubicacion(d) }, personaPorId),
        (d) => personaQueLoTiene(d, personaPorId) !== null || anotadoEnLista(d) !== '',
      ],
      [deRed, contexto, () => false],
      // Las posibles coincidencias se leen como su lista de origen: la de
      // red con su categoría, la general con quién lo tiene.
      [
        posibles,
        (d) =>
          idsRed.has(d.categoriaId)
            ? contexto(d)
            : partesDelSubtitulo(d, { categoria: nombreCategoria.get(d.categoriaId), ubicacion: ubicacion(d) }, personaPorId),
        (d) => !idsRed.has(d.categoriaId) && (personaQueLoTiene(d, personaPorId) !== null || anotadoEnLista(d) !== ''),
      ],
    ]
    for (const [lista, partes, porPartes] of listas) {
      const visibles = partesDeContexto(lista.map((d) => ({ nombre: d.nombre, partes: partes(d) })))
      lista.forEach((d, i) => lineas.set(d.id, porPartes(d) ? visibles[i] : visibles[i].join(' · ')))
    }
    return lineas
  }, [generales, deRed, posibles, idsRed, nombreCategoria, ubicacionPorId, personaPorId])
  // EL CHIP CUENTA LO QUE VA A DAR (tarea 207, hallazgo M-022): sobre lo
  // que deja la búsqueda, sin aplicar el propio eje de categoría.
  const conteos = useMemo(
    () => conteosDeChips(dispositivos ?? [], idsRed, texto, personaPorId),
    [dispositivos, idsRed, texto, personaPorId],
  )

  const consulta = texto.trim()
  const hayFiltrosActivos = Boolean(categoriaId || consulta)
  const hayExactos = generales.length + deRed.length > 0
  const hayResultados = hayExactos || posibles.length > 0

  // El salto a una ficha lleva el origen cuando hay algo que reponer al
  // volver (la búsqueda o el chip) y SIEMPRE para un equipo de red: su
  // padre declarado es Red, y el técnico vino de aquí.
  const anotar = useAnotarBusqueda()
  const busqueda = useMemo(() => (consulta ? { consulta, capa: false } : undefined), [consulta])
  const estadoDeSalto = useMemo(
    () =>
      conOrigen(
        categoriaId ? `/dispositivos?categoria=${encodeURIComponent(categoriaId)}` : '/dispositivos',
        'Equipos',
        busqueda,
      ),
    [categoriaId, busqueda],
  )
  const alAbrir = useCallback(() => {
    if (busqueda) anotar(busqueda)
  }, [busqueda, anotar])

  function quitarFiltros() {
    elegirCategoria('')
    setTexto('')
  }
  // LA CATEGORÍA ELEGIDA, VACÍA (tarea 363, D3): «Ver los N en Todos» la suelta
  // y conserva lo escrito; antes, «Quitar filtros» borraba también la búsqueda.
  const vacioDeCategoria = Boolean(consulta && categoriaId && conteos.todos > 0)
  const nombreElegida = categoriaId === CHIP_RED ? 'red' : (nombreCategoria.get(categoriaId) ?? '')

  // EQUIPOS EN EL TELÉFONO, COMO EL PROTOTIPO DE CLAUDE DESIGN (tarea 350): el
  // título con cuántos hay en el inventario, el escáner y «Crear equipo» en su
  // fila; el buscador ARRIBA, bajo el título (antes, en el dock al pulgar de la
  // tarea 330: el prototipo lo sube, como la 344 subió el de Resolver); los
  // chips de categoría con su número; y cada equipo en su tarjeta. Desde 768
  // px, como estaba.
  const ancho = useEsAncho()
  const enInventario = useMemo(
    () => (dispositivos ?? []).filter((d) => !idsRed.has(d.categoriaId)).length,
    [dispositivos, idsRed],
  )
  const campo = (
    <CampoBusqueda
      valor={texto}
      onCambiar={setTexto}
      alcance="Equipos"
      textoAlternativo="Nombre, persona, IP, lugar o serial"
      variante={ancho ? 'dock' : 'ventana'}
    />
  )
  // BUSCANDO, SOLO LO QUE SIRVE (tarea 363, D3): «Todos», las categorías con
  // resultados, la elegida aunque quede en 0 y «Red». Sin texto, como siempre.
  const chips = chipsDeEquipos(categoriasGenerales, conteos, { conTexto: consulta !== '', categoriaId })
  const tituloGrupo = ancho ? undefined : TITULO_GRUPO
  // La elegida que se quedó en 0 se ve con el borde punteado: sigue elegida,
  // pero ya no da nada.
  const enCero = (chip: ChipDeEquipos) => consulta !== '' && chip.id === categoriaId && chip.cantidad === 0
  const separador = (
    <span aria-hidden data-separador-red className="h-6 w-px shrink-0 self-center bg-noct-divider-fuerte" />
  )

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila. El título, el
    // estado del dato y la cuenta los aporta el chasis (tarea 181); en
    // `barra` quedan las acciones propias de la sección, el buscador de
    // equipos y la fila de chips deslizable.
    // `conLupa={false}` (regla M-R8, "un buscador por pantalla", tarea
    // 207): esta pantalla ya tiene su propio campo con el alcance
    // escrito, así que la lupa de la barra superior sería el segundo
    // buscador de la misma pantalla y con otro alcance. Buscar en todo
    // sigue a un toque, desde Resolver.
    //
    // BUSCAR Y ESCANEAR (tarea 330, y 339 desde 768 px): el buscador de
    // equipos de siempre (su marcador dice lo que busca de verdad,
    // `camposDeBusqueda`). El chasis lo monta en el dock de abajo, con el
    // escáner al lado, en el teléfono, y en la barra superior, con el
    // escáner dentro, desde 768 px.
    <Chasis
      titulo="Equipos"
      conLupa={false}
      buscador={ancho ? campo : undefined}
      detalleTituloEnTelefono={`${enInventario} en inventario`}
      soloTituloEnTelefono
      accionTelefono={
        <>
          <Link
            to="/dispositivos/nuevo"
            aria-label="Crear equipo"
            title="Crear equipo"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-noct-accent-300 active:bg-noct-presionado"
          >
            <Plus size={22} aria-hidden />
          </Link>
          <Link
            to="/escaner"
            aria-label="Escanear QR"
            title="Escanear QR"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-noct-neutral-900 text-noct-text active:bg-noct-presionado"
          >
            <IconoVentana nombre="qr" tam={22} />
          </Link>
        </>
      }
      barra={
      !ancho ? (
        <div className="flex flex-col gap-2.5 px-4 pb-2.5">
          {campo}
          {categoriasGenerales.length > 0 && (
            <FilaDeslizable etiqueta="Filtrar por categoría" className="-mx-4 gap-2 px-4 py-1">
              {chips.map((chip) => {
                const activo = chip.id === categoriaId
                return (
                  <Fragment key={chip.id || '__todos'}>
                    {chip.separado && separador}
                    <button
                      type="button"
                      aria-pressed={activo}
                      data-chip-equipos={chip.id || 'todos'}
                      onClick={() => elegirCategoria(activo ? '' : chip.id)}
                      className={`${CHIP} gap-1.5 ${
                        enCero(chip)
                          ? 'border-dashed border-noct-text bg-transparent text-noct-text'
                          : activo
                            ? CHIP_ACTIVO
                            : CHIP_REPOSO
                      }`}
                    >
                      {chip.nombre}
                      <span className={activo && !enCero(chip) ? 'font-semibold' : 'font-semibold text-noct-neutral-300'}>
                        {chip.cantidad}
                      </span>
                    </button>
                  </Fragment>
                )
              })}
            </FilaDeslizable>
          )}
        </div>
      ) : (
      <>
        <header className="flex items-center justify-between gap-2 px-4 pt-0.5">
          <p className="min-w-0 truncate text-[12.5px] text-noct-neutral-400">
            Qué se sabe de cada equipo
          </p>
          {/* Secundario: se crea un equipo de vez en cuando; se busca
              uno cada día. 44 px de dedo (regla R6). */}
          <Link
            to="/dispositivos/nuevo"
            className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-noct-accent-300 hover:bg-noct-text/[.05]"
          >
            <Plus size={14} aria-hidden />
            Crear equipo
          </Link>
        </header>

        {categoriasGenerales.length > 0 && (
          // LA ÚNICA FILA QUE SE DESLIZA EN HORIZONTAL: si no cabe, el borde
          // con más chips detrás se desvanece (`FilaDeslizable`) en vez de
          // dejar un chip cortado en seco ("Co"), y al final se lee entero.
          <FilaDeslizable etiqueta="Filtrar por categoría" className="gap-2 px-4 pb-3">
            {chips.map((chip) => {
              const activo = chip.id === categoriaId
              return (
                <Fragment key={chip.id || '__todos'}>
                  {chip.separado && separador}
                  <button
                    type="button"
                    aria-pressed={activo}
                    data-chip-equipos={chip.id || 'todos'}
                    onClick={() => elegirCategoria(activo ? '' : chip.id)}
                    className={`inline-flex h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border px-[14px] text-[13px] font-medium transition-colors ${
                      enCero(chip) ? 'border-dashed ' : ''
                    }${
                      activo
                        ? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300'
                        : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                    }`}
                  >
                    {chip.nombre}
                    <span
                      className={`text-[11.5px] max-md:text-[12px] ${activo ? 'text-noct-accent-400 max-md:text-noct-accent-300' : 'text-noct-neutral-600'}`}
                    >
                      {chip.cantidad}
                    </span>
                  </button>
                </Fragment>
              )
            })}
          </FilaDeslizable>
        )}
      </>
      )
    }>
      <main className="flex-1 px-4 pb-6 pt-3 max-md:pt-1.5">
        {hayResultados ? (
          <>
            {generales.length > 0 && (
              <div className="flex flex-col max-md:gap-2">
                {generales.map((d) => (
                  <FilaDispositivo
                    key={d.id}
                    dispositivo={d}
                    categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                    subtitulo={subtitulos.get(d.id) ?? ''}
                    conFoto
                    estado={hayFiltrosActivos ? estadoDeSalto : undefined}
                    alAbrir={alAbrir}
                    resaltar={consulta}
                    enTarjeta={!ancho}
                  />
                ))}
              </div>
            )}

            {/* LOS DE RED, APARTE (sección 17 del encargo): solo al
                escribir, con su categoría, y su regreso vuelve aquí. */}
            {deRed.length > 0 && (
              <section className={generales.length > 0 ? 'mt-5' : ''}>
                {tituloGrupo ? (
                  <h2 className={`${tituloGrupo} mb-2`}>Equipos de red</h2>
                ) : (
                  <TituloSeccion className="mb-1 px-0.5">Equipos de red</TituloSeccion>
                )}
                <div className="flex flex-col max-md:gap-2">
                  {deRed.map((d) => (
                    <FilaDispositivo
                      key={d.id}
                      dispositivo={d}
                      categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                      subtitulo={subtitulos.get(d.id) ?? ''}
                      estado={estadoDeSalto}
                      alAbrir={alAbrir}
                      resaltar={consulta}
                      enTarjeta={!ancho}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* POSIBLES COINCIDENCIAS (tarea 346): lo que solo se parece a lo
                escrito, detrás de lo exacto y dicho como lo que es. Se
                enseñan todas: nada se elige ni se abre solo, y el campo
                conserva lo escrito. */}
            {posibles.length > 0 && (
              <section className={hayExactos ? 'mt-5' : ''}>
                {tituloGrupo ? (
                  <h2 className={`${tituloGrupo} mb-2`}>Posibles coincidencias</h2>
                ) : (
                  <TituloSeccion className="mb-1 px-0.5">Posibles coincidencias</TituloSeccion>
                )}
                {!hayExactos && (
                  <p className="mb-1.5 px-0.5 text-[13px] leading-snug text-noct-neutral-400">
                    Nada coincide tal cual con «{consulta}». Estos se parecen:
                  </p>
                )}
                <div className="flex flex-col max-md:gap-2">
                  {posibles.map((d) => (
                    <FilaDispositivo
                      key={d.id}
                      dispositivo={d}
                      categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                      subtitulo={subtitulos.get(d.id) ?? ''}
                      conFoto={!idsRed.has(d.categoriaId)}
                      estado={estadoDeSalto}
                      alAbrir={alAbrir}
                      resaltar={consulta}
                      enTarjeta={!ancho}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
            <Monitor size={30} className="text-noct-neutral-600" aria-hidden />
            {/* LOS VACÍOS DE UNA BÚSQUEDA (tarea 363, D3). Con la categoría
                elegida vacía y equipos en otras, la salida conserva lo escrito.
                Sin nada que coincida, «Borrar búsqueda». */}
            <div>
              <p className="text-[14.5px] font-medium">
                {vacioDeCategoria
                  ? `Ningún equipo de ${nombreElegida} coincide con «${consulta}»`
                  : consulta
                    ? `Ningún equipo coincide con «${consulta}»`
                    : hayFiltrosActivos
                      ? 'Ningún equipo coincide'
                      : 'Aún no hay equipos registrados'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                {vacioDeCategoria
                  ? `Hay ${conteos.todos} en ${conteos.todos === 1 ? 'otra categoría' : 'otras categorías'}.`
                  : consulta
                    ? 'Prueba con el nombre de la persona, la IP, el lugar o el serial.'
                    : hayFiltrosActivos
                      ? 'Probar con otra palabra o quitar el filtro de categoría.'
                      : 'Agregarlos desde "Crear equipo".'}
              </p>
            </div>
            {vacioDeCategoria ? (
              <button type="button" onClick={() => elegirCategoria('')} className={`mt-0.5 min-h-11 ${BTN_PRIMARIO}`}>
                {conteos.todos === 1 ? 'Verlo en Todos' : `Ver los ${conteos.todos} en Todos`}
              </button>
            ) : consulta ? (
              <button type="button" onClick={quitarFiltros} className={`mt-0.5 min-h-11 ${BTN_SECUNDARIO}`}>
                Borrar búsqueda
              </button>
            ) : (
              hayFiltrosActivos && (
                <button type="button" onClick={quitarFiltros} className={`mt-0.5 min-h-11 ${BTN_SECUNDARIO}`}>
                  Quitar filtros
                </button>
              )
            )}
          </div>
        )}
      </main>
    </Chasis>
  )
}
