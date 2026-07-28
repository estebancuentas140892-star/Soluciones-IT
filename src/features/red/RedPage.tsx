import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { compararNatural } from '../../lib/conexiones'
import { esDeRed } from '../../lib/categorias'
import { incluyeTexto } from '../../lib/texto'
import { FilaDispositivo } from '../../components/FilaDispositivo'
import { CaretRight, MagnifyingGlass, MapPin, Plus, TreeStructure, XCircleFill } from '../../components/iconos'
import { BTN_SECUNDARIO } from '../../components/nocturne'

// Sección Red re-autorizada en el sistema Nocturne (handoff "Rediseño
// de aplicación empresarial", Red.dc.html, tarea 91): responde "¿cómo
// está conectada la infraestructura?" con el inventario de red
// agrupado por ubicación y la entrada destacada a la Topología. Reúne
// los dispositivos de las categorías marcadas como es_red. Declara
// nivel de sección en el chasis único (tarea 185), que le pone sidebar
// en escritorio y pestañas en móvil. La lógica y los datos no cambian
// respecto de la versión de tema claro: solo se re-autoriza el aspecto
// a Nocturne.

export function RedPage() {
  const dispositivos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [texto, setTexto] = useState('')

  const categoriasRed = useMemo(() => (categorias ?? []).filter(esDeRed), [categorias])
  const idsRed = useMemo(() => new Set(categoriasRed.map((c) => c.id)), [categoriasRed])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const filtrados = useMemo(() => {
    return (dispositivos ?? [])
      .filter((d) => idsRed.has(d.categoriaId))
      .filter((d) =>
        incluyeTexto(
          [d.nombre, d.ubicacion, d.ip, d.marca, d.modelo, nombreCategoria.get(d.categoriaId)],
          texto,
        ),
      )
  }, [dispositivos, idsRed, texto, nombreCategoria])

  // Grupos por ubicación (texto libre), orden alfabético natural; los
  // equipos sin ubicación registrada van al final en su propio grupo.
  const grupos = useMemo(() => {
    const porUbicacion = new Map<string, typeof filtrados>()
    for (const d of filtrados) {
      const clave = d.ubicacion.trim() || 'Sin ubicación'
      const lista = porUbicacion.get(clave)
      if (lista) lista.push(d)
      else porUbicacion.set(clave, [d])
    }
    const ubicaciones = [...porUbicacion.keys()].sort((a, b) => {
      if (a === 'Sin ubicación') return 1
      if (b === 'Sin ubicación') return -1
      return compararNatural(a, b)
    })
    return ubicaciones.map((ubicacion) => {
      const equipos = (porUbicacion.get(ubicacion) ?? []).sort((a, b) =>
        compararNatural(a.nombre, b.nombre),
      )
      return {
        ubicacion,
        cuenta: equipos.length === 1 ? '1 equipo' : `${equipos.length} equipos`,
        equipos,
      }
    })
  }, [filtrados])

  const buscando = texto.trim().length > 0
  const hayResultados = filtrados.length > 0

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila. El título, el
    // estado del dato, buscar y la cuenta los aporta el chasis (tarea
    // 181); en `barra` quedan la acción Crear y el buscador de equipos
    // de red, con borde de acento al escribir.
    <Chasis titulo="Red" barra={
      <>
        <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-1">
          <p className="min-w-0 truncate text-[12.5px] text-noct-neutral-400">
            Cómo está conectada la infraestructura
          </p>
          <Link to="/dispositivos/nuevo?red=1" className={`shrink-0 ${BTN_SECUNDARIO}`}>
            <Plus size={15} aria-hidden />
            Crear
          </Link>
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
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Equipo de red, IP, ubicación"
              aria-label="Buscar equipo de red"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500 [&::-webkit-search-cancel-button]:hidden"
            />
            {buscando && (
              <button
                type="button"
                onClick={() => setTexto('')}
                aria-label="Borrar búsqueda"
                className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
              >
                <XCircleFill size={18} aria-hidden />
              </button>
            )}
          </label>
        </div>
      </>
    }>
      <main className="flex-1 px-4 pb-16 pt-3.5">
        <div className="flex flex-col gap-[18px]">
          {/* Entrada destacada a la Topología, tintada en el acento. */}
          <Link
            to="/red/topologia"
            className="flex items-center gap-3 rounded-lg border border-noct-accent/[.35] bg-noct-accent/[.08] px-3.5 py-[13px] text-noct-text hover:bg-noct-accent/[.13]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-noct-accent/[.16] text-noct-accent-300">
              <TreeStructure size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-medium leading-[1.3]">Topología de red</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-noct-neutral-400">
                Recorrer las conexiones desde el rack hasta cada equipo
              </p>
            </div>
            <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
          </Link>

          {hayResultados ? (
            grupos.map((grupo) => (
              <section key={grupo.ubicacion}>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <MapPin size={14} className="text-noct-neutral-400" aria-hidden />
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
                    {grupo.ubicacion}
                  </h2>
                  <span className="text-[11px] text-noct-neutral-600">{grupo.cuenta}</span>
                </div>
                <div className="flex flex-col">
                  {grupo.equipos.map((d) => {
                    const marcaModelo = [d.marca, d.modelo].filter(Boolean).join(' ')
                    return (
                      <FilaDispositivo
                        key={d.id}
                        dispositivo={d}
                        categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                        subtitulo={[nombreCategoria.get(d.categoriaId), marcaModelo]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    )
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
              <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
              <div>
                <p className="text-[14.5px] font-medium">
                  {buscando ? 'Ningún equipo de red coincide' : 'Aún no hay equipos de red registrados'}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                  {buscando
                    ? 'Probar con otra palabra o revisar la ortografía.'
                    : 'Marcar una categoría como de red o agregar equipos desde "Crear".'}
                </p>
              </div>
              {buscando && (
                <button type="button" onClick={() => setTexto('')} className={`mt-0.5 ${BTN_SECUNDARIO}`}>
                  Quitar búsqueda
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </Chasis>
  )
}
