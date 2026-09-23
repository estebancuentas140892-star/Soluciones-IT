import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { idsDeRed, esDeRed } from '../../lib/categorias'
import { conOrigen } from '../../lib/origenNavegacion'
import { FilaDispositivo } from '../../components/FilaDispositivo'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { Monitor, Plus, QrCode } from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { useAnotarBusqueda, useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { buscarEquipos, conteosDeChips } from './busquedaEquipos'

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

  const { generales, deRed } = useMemo(
    () => buscarEquipos(dispositivos ?? [], idsRed, { texto, categoriaId }),
    [dispositivos, idsRed, texto, categoriaId],
  )
  // EL CHIP CUENTA LO QUE VA A DAR (tarea 207, hallazgo M-022): sobre lo
  // que deja la búsqueda, sin aplicar el propio eje de categoría.
  const conteos = useMemo(
    () => conteosDeChips(dispositivos ?? [], idsRed, texto),
    [dispositivos, idsRed, texto],
  )

  const consulta = texto.trim()
  const hayFiltrosActivos = Boolean(categoriaId || consulta)
  const hayResultados = generales.length + deRed.length > 0

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
    <Chasis titulo="Equipos" conLupa={false} barra={
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

        {/* BUSCAR Y ESCANEAR, CON EL MISMO PESO: la misma altura (46 px),
            la misma superficie y el mismo borde. */}
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <CampoBusqueda valor={texto} onCambiar={setTexto} alcance="Equipos" className="min-w-0 flex-1" />
          <Link
            to="/escaner"
            className="inline-flex h-[46px] shrink-0 items-center gap-2 rounded-lg border border-noct-divider bg-noct-surface px-3.5 text-[14px] font-medium text-noct-text hover:border-noct-neutral-600 hover:bg-noct-text/[.04]"
          >
            <QrCode size={18} className="shrink-0 text-noct-accent-300" aria-hidden />
            Escanear QR
          </Link>
        </div>

        {categoriasGenerales.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[{ id: '', nombre: 'Todos', count: conteos.todos }, ...categoriasGenerales.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              count: conteos.porCategoria.get(c.id) ?? 0,
            }))].map((chip) => {
              const activo = chip.id === categoriaId
              return (
                <button
                  key={chip.id || '__todos'}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => elegirCategoria(activo ? '' : chip.id)}
                  className={`inline-flex h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border px-[14px] text-[13px] font-medium transition-colors ${
                    activo
                      ? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                  }`}
                >
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
      </>
    }>
      <main className="flex-1 px-4 pb-16 pt-3">
        {hayResultados ? (
          <>
            {generales.length > 0 && (
              <div className="flex flex-col">
                {generales.map((d) => (
                  <FilaDispositivo
                    key={d.id}
                    dispositivo={d}
                    categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                    subtitulo={[nombreCategoria.get(d.categoriaId), d.ubicacion].filter(Boolean).join(' · ')}
                    conFoto
                    estado={hayFiltrosActivos ? estadoDeSalto : undefined}
                    alAbrir={alAbrir}
                  />
                ))}
              </div>
            )}

            {/* LOS DE RED, APARTE (sección 17 del encargo): solo al
                escribir, con su categoría, y su regreso vuelve aquí. */}
            {deRed.length > 0 && (
              <section className={generales.length > 0 ? 'mt-5' : ''}>
                <TituloSeccion className="mb-1 px-0.5">Equipos de red</TituloSeccion>
                <div className="flex flex-col">
                  {deRed.map((d) => (
                    <FilaDispositivo
                      key={d.id}
                      dispositivo={d}
                      categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                      subtitulo={[nombreCategoria.get(d.categoriaId), d.ubicacion].filter(Boolean).join(' · ')}
                      estado={estadoDeSalto}
                      alAbrir={alAbrir}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
            <Monitor size={30} className="text-noct-neutral-600" aria-hidden />
            <div>
              <p className="text-[14.5px] font-medium">
                {hayFiltrosActivos ? 'Ningún equipo coincide' : 'Aún no hay equipos registrados'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                {hayFiltrosActivos
                  ? 'Probar con otra palabra o quitar el filtro de categoría.'
                  : 'Agregarlos desde "Crear equipo".'}
              </p>
            </div>
            {hayFiltrosActivos && (
              <button type="button" onClick={quitarFiltros} className={`mt-0.5 min-h-11 ${BTN_SECUNDARIO}`}>
                Quitar filtros
              </button>
            )}
          </div>
        )}
      </main>
    </Chasis>
  )
}
