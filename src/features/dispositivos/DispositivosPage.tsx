import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { AppShell } from '../../app/AppShell'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { IconoNodo } from '../red/IconoNodo'
import { estadoConEtiqueta, tipoDeNodoVisual } from '../red/topologiaVisual'

// Pantalla Dispositivos rediseñada en tema claro (handoff de Claude
// Design, Dispositivos.dc.html): responde "¿qué sabes sobre este
// equipo?" con el inventario general (las categorías de red se
// muestran en la sección Red, no aquí: decisión ya existente antes
// del rediseño). Chips de categoría en vez de un desplegable, un solo
// buscador y un resumen de estados siempre sobre el total, sin
// filtrar (vista general de un vistazo).
export function DispositivosPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [categoriaId, setCategoriaId] = useState('')
  const [texto, setTexto] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAbierto) return
    function alClicFuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [menuAbierto])

  const categoriasGenerales = useMemo(() => (categorias ?? []).filter((c) => !c.esRed), [categorias])
  const idsRed = useMemo(
    () => new Set((categorias ?? []).filter((c) => c.esRed).map((c) => c.id)),
    [categorias],
  )
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const generales = useMemo(
    () => (dispositivos ?? []).filter((d) => !idsRed.has(d.categoriaId)),
    [dispositivos, idsRed],
  )

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return generales.filter((d) => {
      if (categoriaId && d.categoriaId !== categoriaId) return false
      if (!buscado) return true
      return [d.nombre, d.ip, d.ubicacion, d.serial].join(' ').toLowerCase().includes(buscado)
    })
  }, [generales, categoriaId, texto])

  const resumen = useMemo(
    () => ({
      total: generales.length,
      operativos: generales.filter((d) => estadoConEtiqueta(d.estado).etiqueta === 'Operativo').length,
      mantenimiento: generales.filter((d) => estadoConEtiqueta(d.estado).etiqueta === 'En mantenimiento').length,
      fueraDeServicio: generales.filter((d) => estadoConEtiqueta(d.estado).etiqueta === 'Fuera de servicio').length,
    }),
    [generales],
  )

  const hayFiltrosActivos = Boolean(categoriaId || texto)
  const hayResultados = filtrados.length > 0

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[860px] flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-semibold">¿Qué sabes sobre este equipo?</h1>
            <p className="text-sm text-zinc-600">Busca cualquier dispositivo por nombre, IP o ubicación</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              to="/escaner"
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              <IconoEscanear className="h-4 w-4 text-zinc-600" />
              Escanear
            </Link>
            <Link
              to="/dispositivos/nuevo"
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-[9px] text-[13.5px] font-semibold text-white hover:bg-blue-700"
            >
              <IconoMas className="h-4 w-4" />
              <span className="hidden lg:inline">Crear dispositivo</span>
            </Link>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-label="Más acciones"
                aria-expanded={menuAbierto}
                className="flex h-full cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-2.5 text-zinc-600 hover:bg-zinc-100"
              >
                <IconoMas3Puntos className="h-4 w-4" />
              </button>
              {menuAbierto && (
                <div className="absolute right-0 z-10 mt-1 flex w-48 flex-col overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
                  <Link
                    to="/ubicaciones"
                    onClick={() => setMenuAbierto(false)}
                    className="px-3.5 py-2 text-[13.5px] font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Ubicaciones
                  </Link>
                  <Link
                    to="/dispositivos/etiquetas"
                    onClick={() => setMenuAbierto(false)}
                    className="px-3.5 py-2 text-[13.5px] font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Etiquetas QR
                  </Link>
                  <Link
                    to="/dispositivos/importar"
                    onClick={() => setMenuAbierto(false)}
                    className="px-3.5 py-2 text-[13.5px] font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Importar
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <label className="flex items-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-[13px]">
          <IconoBuscar className="h-[19px] w-[19px] shrink-0 text-zinc-400" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, IP, serial o ubicación..."
            className="flex-1 border-none bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </label>

        {categoriasGenerales.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categoriasGenerales.map((c) => {
              const seleccionada = c.id === categoriaId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId((v) => (v === c.id ? '' : c.id))}
                  className={`cursor-pointer rounded-full border px-3.5 py-[7px] text-[13px] font-semibold ${
                    seleccionada
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {c.nombre}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[13px] text-zinc-500">{resumen.total} equipos</span>
          <ResumenEstado clase="bg-green-600" texto={`${resumen.operativos} operativos`} />
          <ResumenEstado clase="bg-amber-600" texto={`${resumen.mantenimiento} en mantenimiento`} />
          <ResumenEstado clase="bg-red-600" texto={`${resumen.fueraDeServicio} fuera de servicio`} />
        </div>

        {hayResultados ? (
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {filtrados.map((d) => {
              const estado = estadoConEtiqueta(d.estado)
              return (
                <Link
                  key={d.id}
                  to={`/dispositivos/${d.id}`}
                  className="-mt-px flex items-center gap-3.5 border-t border-zinc-100 px-4 py-[13px] hover:bg-zinc-100"
                >
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-zinc-100 text-zinc-600">
                    {d.foto ? (
                      <MiniaturaPortada
                        referencia={d.foto.referencia}
                        alt={d.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconoNodo tipo={tipoDeNodoVisual(nombreCategoria.get(d.categoriaId) ?? '')} className="h-[19px] w-[19px]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">{d.nombre}</p>
                    <p className="truncate text-[12.5px] text-zinc-400">
                      {[nombreCategoria.get(d.categoriaId), d.ubicacion].filter(Boolean).join(' · ')}
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
        ) : (
          <div className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center">
            <IconoBuscar className="h-7 w-7 text-zinc-400" />
            <div>
              <p className="mb-[3px] text-sm font-semibold text-zinc-900">
                {hayFiltrosActivos ? 'No se encontraron dispositivos' : 'Aún no hay dispositivos registrados'}
              </p>
              <p className="text-[13px] text-zinc-500">
                {hayFiltrosActivos ? 'Prueba con otras palabras o quita el filtro de categoría' : 'Agrégalos desde "Crear dispositivo"'}
              </p>
            </div>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={() => {
                  setCategoriaId('')
                  setTexto('')
                }}
                className="mt-1 cursor-pointer rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Quitar filtros
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function ResumenEstado({ clase, texto }: { clase: string; texto: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-[7px] w-[7px] rounded-full ${clase}`} />
      <span className="text-[12.5px] text-zinc-600">{texto}</span>
    </div>
  )
}

function IconoEscanear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12h10" strokeLinecap="round" />
    </svg>
  )
}

function IconoMas(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function IconoMas3Puntos(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
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

function ChevronDerecha(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
