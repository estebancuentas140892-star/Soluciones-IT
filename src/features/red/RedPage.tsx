import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { ShellNocturne } from '../../app/ShellNocturne'
import { compararNatural } from '../../lib/conexiones'
import { CaretRight, MagnifyingGlass, MapPin, Plus, TreeStructure, XCircleFill } from '../../components/iconos'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { IconoNodo } from './IconoNodo'
import { estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'

// Sección Red re-autorizada en el sistema Nocturne (handoff "Rediseño
// de aplicación empresarial", Red.dc.html, tarea 91): responde "¿cómo
// está conectada la infraestructura?" con el inventario de red
// agrupado por ubicación y la entrada destacada a la Topología. Reúne
// los dispositivos de las categorías marcadas como es_red. Trae su
// propio ShellNocturne (sidebar en escritorio, pestañas en móvil), por
// eso su ruta vive fuera del Layout oscuro heredado. La lógica y los
// datos no cambian respecto de la versión de tema claro: solo se
// re-autoriza el aspecto a Nocturne.

// Color Nocturne del estado, a juego con el punto y la etiqueta de la
// fila (08_ESTILO: operativo verde/éxito, mantenimiento ámbar, fuera
// de servicio rojo, de baja/otro neutro). Se indexa por la etiqueta
// canónica que devuelve estadoConEtiqueta, igual que en Dispositivos.
const CLASE_ESTADO: Record<string, string> = {
  operativo: 'text-noct-exito',
  'en mantenimiento': 'text-noct-precaucion',
  'fuera de servicio': 'text-noct-error',
  'de baja': 'text-noct-neutral-500',
}

function claseEstado(etiqueta: string): string {
  return CLASE_ESTADO[etiqueta.toLowerCase()] ?? 'text-noct-neutral-500'
}

export function RedPage() {
  const dispositivos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [texto, setTexto] = useState('')

  const categoriasRed = useMemo(() => (categorias ?? []).filter((c) => c.esRed), [categorias])
  const idsRed = useMemo(() => new Set(categoriasRed.map((c) => c.id)), [categoriasRed])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return (dispositivos ?? [])
      .filter((d) => idsRed.has(d.categoriaId))
      .filter((d) => {
        if (!buscado) return true
        return [d.nombre, d.ubicacion, d.ip, d.marca, d.modelo, nombreCategoria.get(d.categoriaId)]
          .join(' ')
          .toLowerCase()
          .includes(buscado)
      })
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
    <ShellNocturne>
      {/* Cabecera fija con desenfoque: título, acción Crear y buscador
          con borde de acento al escribir. */}
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-start justify-between gap-2 px-4 pb-0.5 pt-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-medium leading-tight">Red</h1>
            <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">
              Cómo está conectada la infraestructura
            </p>
          </div>
          <Link to="/dispositivos/nuevo" className={`shrink-0 ${BTN_SECUNDARIO}`}>
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
      </div>

      <main className="flex-1 px-4 pb-[116px] pt-3.5 lg:pb-16">
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
                    const estado = estadoConEtiqueta(d.estado)
                    const marcaModelo = [d.marca, d.modelo].filter(Boolean).join(' ')
                    return (
                      <Link
                        key={d.id}
                        to={`/dispositivos/${d.id}`}
                        className="flex min-h-[56px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                      >
                        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400">
                          <IconoNodo
                            tipo={tipoDeNodoVisual(nombreCategoria.get(d.categoriaId) ?? '')}
                            className="h-[19px] w-[19px]"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-[1.3]">{d.nombre}</p>
                          <p className="truncate text-[12px] text-noct-neutral-500">
                            {[nombreCategoria.get(d.categoriaId), marcaModelo].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-[3px]">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${claseEstado(estado.etiqueta)}`}
                          >
                            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                            {estado.etiqueta}
                          </span>
                          {d.ip && (
                            <span className="font-mono text-[11px] text-noct-neutral-600">{d.ip}</span>
                          )}
                        </div>
                      </Link>
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
    </ShellNocturne>
  )
}
