import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import {
  ArrowElbowDownRight,
  CaretRight,
  House,
  MagnifyingGlass,
  MapPin,
  Plus,
  XCircleFill,
} from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { db, type Ubicacion } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { hijosDirectos } from './arbol'
import { textosSinUbicacion } from './migracion'

// Minusculas sin acentos, para que la busqueda encuentre "Area" al
// escribir "area".
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// Recorre el arbol en orden (raices y luego sus hijos) devolviendo cada
// ubicacion con su nivel, para pintarla con sangria segun la jerarquia.
function ordenarConNivel(ubicaciones: Ubicacion[]): { u: Ubicacion; nivel: number }[] {
  const orden: { u: Ubicacion; nivel: number }[] = []
  const agregar = (u: Ubicacion, nivel: number) => {
    orden.push({ u, nivel })
    for (const hijo of hijosDirectos(u.id, ubicaciones)) agregar(hijo, nivel + 1)
  }
  for (const raiz of hijosDirectos(null, ubicaciones)) agregar(raiz, 0)
  return orden
}

const CLASE_CAMPO =
  'w-full box-border rounded-md border border-noct-divider bg-noct-bg px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'

// Lista de ubicaciones (grupo N3) re-autorizada al sistema Nocturne
// (handoff "Rediseño de aplicación empresarial", Ubicaciones.dc.html): el
// lugar físico como entidad, con su jerarquía (árbol con sangría),
// cuántos equipos hay en cada una, creación inline y el aviso de
// migración de los textos de ubicación que aún no son entidad. Trae su
// propio shell Nocturne (pantalla enfocada bajo Dispositivos), por eso
// sale del Layout oscuro. La lógica y los datos no cambian: al tocar una
// ubicación se navega a su ficha 360°.
export function UbicacionesPage() {
  const navigate = useNavigate()
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const [filtro, setFiltro] = useState('')
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPadre, setNuevoPadre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const conteoPorUbicacion = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const d of dispositivos) {
      if (d.ubicacionId) conteo.set(d.ubicacionId, (conteo.get(d.ubicacionId) ?? 0) + 1)
    }
    return conteo
  }, [dispositivos])

  const arbol = useMemo(() => ordenarConNivel(ubicaciones), [ubicaciones])
  const raices = useMemo(() => hijosDirectos(null, ubicaciones), [ubicaciones])
  const porMigrar = useMemo(() => textosSinUbicacion(dispositivos).length, [dispositivos])

  const f = normalizar(filtro.trim())
  const hayFiltro = f.length > 0
  const visibles = hayFiltro ? arbol.filter(({ u }) => normalizar(u.nombre).includes(f)) : arbol

  function alternarCrear() {
    setCreando((v) => !v)
    setNuevoNombre('')
    setNuevoPadre('')
  }

  async function crear() {
    const nombre = nuevoNombre.trim()
    if (nombre === '' || guardando) return
    setGuardando(true)
    await guardarRegistro('ubicaciones', { id: nuevoId(), nombre, padreId: nuevoPadre || null, notas: '' })
    setGuardando(false)
    setCreando(false)
    setNuevoNombre('')
    setNuevoPadre('')
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa: volver, crear, título y buscador. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver variante="nocturne" to="/dispositivos">
              Dispositivos
            </BotonVolver>
            <button type="button" onClick={alternarCrear} className={`shrink-0 ${BTN_SECUNDARIO}`}>
              <Plus size={15} aria-hidden />
              Crear
            </button>
          </header>
          <div className="px-4 pb-2.5 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Ubicaciones</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">Los lugares físicos donde viven los equipos</p>
          </div>
          <div className="px-4 pb-3">
            <label
              className={`flex h-11 items-center gap-2.5 rounded-md border bg-noct-surface px-3.5 transition-colors ${
                hayFiltro ? 'border-noct-accent' : 'border-noct-divider'
              }`}
            >
              <MagnifyingGlass
                size={18}
                className={`shrink-0 ${hayFiltro ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
                aria-hidden
              />
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar un lugar"
                aria-label="Buscar ubicación"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500 [&::-webkit-search-cancel-button]:hidden"
              />
              {hayFiltro && (
                <button
                  type="button"
                  onClick={() => setFiltro('')}
                  aria-label="Borrar búsqueda"
                  className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
                >
                  <XCircleFill size={18} aria-hidden />
                </button>
              )}
            </label>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-3.5 px-4 pb-12 pt-3.5">
          {creando && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3">
              <p className="text-[13.5px] font-medium">Nueva ubicación</p>
              <input
                type="text"
                autoFocus
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre: Piso 2, Rack principal, Caja 3..."
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-noct-neutral-500">Dentro de (opcional)</span>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: '', nombre: 'Ninguna (raíz)' }, ...raices].map((p) => {
                    const activo = nuevoPadre === p.id
                    return (
                      <button
                        key={p.id || '__raiz'}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setNuevoPadre(p.id)}
                        className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-3 text-[12.5px] transition-colors ${
                          activo
                            ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                            : 'border-noct-divider text-noct-neutral-400 hover:bg-noct-text/[.05]'
                        }`}
                      >
                        {p.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void crear()}
                  disabled={guardando || nuevoNombre.trim() === ''}
                  className={`${BTN_PRIMARIO} px-4 py-2.5 disabled:opacity-50`}
                >
                  {guardando ? 'Creando...' : 'Crear ubicación'}
                </button>
                <button type="button" onClick={alternarCrear} className={`${BTN_GHOST} px-4 py-2.5`}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {porMigrar > 0 && !hayFiltro && (
            <button
              type="button"
              onClick={() => navigate('/ubicaciones/migrar')}
              className="flex w-full items-center gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-left text-noct-text"
            >
              <ArrowElbowDownRight size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
              <span className="min-w-0 flex-1 text-[13px] leading-[1.45]">
                {porMigrar} {porMigrar === 1 ? 'equipo tiene' : 'equipos tienen'} la ubicación escrita como texto.
                Convertirlas en fichas para poder navegarlas.
              </span>
              <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
            </button>
          )}

          {visibles.length > 0 ? (
            <div className="flex flex-col">
              {visibles.map(({ u, nivel }) => {
                const conteo = conteoPorUbicacion.get(u.id) ?? 0
                const esRaiz = nivel === 0
                const Icono = esRaiz ? House : MapPin
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => navigate(`/ubicaciones/${u.id}`)}
                    style={{ paddingLeft: `${8 + nivel * 22}px` }}
                    className="flex min-h-[52px] items-center gap-[11px] rounded-md py-2.5 pr-2 text-left text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <Icono
                      size={18}
                      className={`shrink-0 ${esRaiz ? 'text-noct-accent-300' : 'text-noct-neutral-500'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-[1.3]">{u.nombre}</span>
                    <span className="shrink-0 text-[12px] text-noct-neutral-500">
                      {conteo} {conteo === 1 ? 'equipo' : 'equipos'}
                    </span>
                    <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
              <MapPin size={30} className="text-noct-neutral-600" aria-hidden />
              <p className="text-[13px] leading-[1.5] text-noct-neutral-400">
                {hayFiltro
                  ? 'Ningún lugar coincide con la búsqueda.'
                  : 'Aún no hay ubicaciones registradas.'}
                {!hayFiltro && porMigrar > 0 && ' Se pueden crear migrando los textos existentes.'}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
