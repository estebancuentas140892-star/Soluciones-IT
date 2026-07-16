import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { AppShell } from '../../app/AppShell'
import { compararNatural } from '../../lib/conexiones'
import { IconoNodo } from './IconoNodo'
import { estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'

// Sección Red rediseñada en tema claro (handoff de Claude Design,
// Red.dc.html): responde "¿cómo está conectada la infraestructura?"
// con el inventario de red agrupado por ubicación y la entrada
// destacada a la Topología. Reúne los dispositivos de las categorías
// marcadas como es_red.
export function RedPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
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
    return ubicaciones.map((ubicacion) => ({
      ubicacion,
      equipos: (porUbicacion.get(ubicacion) ?? []).sort((a, b) => compararNatural(a.nombre, b.nombre)),
    }))
  }, [filtrados])

  const hayResultados = filtrados.length > 0

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-semibold">¿Cómo está conectada la infraestructura?</h1>
            <p className="text-sm text-zinc-600">Equipos de red agrupados por ubicación</p>
          </div>
          <Link
            to="/dispositivos/nuevo"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-[9px] text-[13.5px] font-semibold text-white hover:bg-blue-700"
          >
            <IconoMas className="h-4 w-4" />
            <span className="hidden lg:inline">Nuevo equipo</span>
          </Link>
        </header>

        <Link
          to="/red/topologia"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100/60"
        >
          <IconoRed className="mt-px h-[22px] w-[22px] shrink-0 text-blue-600" />
          <div className="flex-1">
            <p className="mb-0.5 text-[15px] font-semibold text-zinc-900">Topología de red</p>
            <p className="text-[13px] text-blue-800/80">Recorre las conexiones desde el rack hasta cada equipo</p>
          </div>
          <ChevronDerecha className="h-[17px] w-[17px] shrink-0 self-center text-blue-600" />
        </Link>

        <label className="flex items-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-[13px]">
          <IconoBuscar className="h-[19px] w-[19px] shrink-0 text-zinc-400" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar equipo de red, IP..."
            className="flex-1 border-none bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </label>

        {hayResultados ? (
          <div className="flex flex-col gap-6">
            {grupos.map((grupo) => (
              <section key={grupo.ubicacion}>
                <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold tracking-[.03em] text-zinc-500 uppercase">
                  <IconoUbicacion className="h-3.5 w-3.5 text-zinc-400" />
                  {grupo.ubicacion}
                </h2>
                <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  {grupo.equipos.map((d) => {
                    const estado = estadoConEtiqueta(d.estado)
                    const marcaModelo = [d.marca, d.modelo].filter(Boolean).join(' ')
                    return (
                      <Link
                        key={d.id}
                        to={`/dispositivos/${d.id}`}
                        className="-mt-px flex items-center gap-3.5 border-t border-zinc-100 px-4 py-[13px] hover:bg-zinc-100"
                      >
                        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[7px] bg-zinc-100 text-zinc-600">
                          <IconoNodo tipo={tipoDeNodoVisual(nombreCategoria.get(d.categoriaId) ?? '')} className="h-[19px] w-[19px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900">{d.nombre}</p>
                          <p className="text-[12.5px] text-zinc-400">
                            {[nombreCategoria.get(d.categoriaId), marcaModelo].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {d.ip && (
                          <span className="hidden shrink-0 font-mono text-[12.5px] text-zinc-500 lg:inline">{d.ip}</span>
                        )}
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${estado.clase}`} />
                          <span className={`text-[12.5px] font-semibold ${estado.textoClase}`}>{estado.etiqueta}</span>
                        </span>
                        <ChevronDerecha className="h-[17px] w-[17px] shrink-0 text-zinc-300" />
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center">
            <IconoBuscar className="h-7 w-7 text-zinc-400" />
            <div>
              <p className="mb-[3px] text-sm font-semibold text-zinc-900">
                {texto ? 'No se encontraron equipos' : 'Aún no hay equipos de red registrados'}
              </p>
              <p className="text-[13px] text-zinc-500">
                {texto ? 'Prueba con otras palabras' : 'Agrégalos desde "Nuevo equipo"'}
              </p>
            </div>
            {texto && (
              <button
                type="button"
                onClick={() => setTexto('')}
                className="mt-1 cursor-pointer rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Quitar búsqueda
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function IconoMas(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function IconoBuscar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoUbicacion(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function IconoRed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="9" y="3" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 12H6v4M12 12h6v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDerecha(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
