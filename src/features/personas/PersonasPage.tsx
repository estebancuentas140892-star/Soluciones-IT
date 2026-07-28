import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { ArrowElbowDownRight, CaretRight, MagnifyingGlass, Plus, User, XCircleFill } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { candidatosPersona } from './migracion'
import { CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'

// Minusculas sin acentos, para que la busqueda encuentre "Perez" al
// escribir "perez".
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// Buscador dibujado sobre una tarjeta: variante de fondo de app.
const CLASE_CAMPO = CLASE_CAMPO_SOBRE_SUPERFICIE

// Lista de personas (hallazgo T1 de AUDITORIA_FLUJOS_TI.md): el
// responsable de un equipo como entidad, con creación inline y el aviso
// de migración de los textos de "usuario asignado" que aún no son
// entidad. Sin jerarquía (no aplica a personas, a diferencia de
// ubicaciones): lista plana ordenada por nombre. Trae su propio shell
// Nocturne (pantalla enfocada; su puerta es "Más" desde la tarea 182,
// antes se alcanzaba solo desde el menú "···" de Equipos), por eso sale
// del Layout oscuro.
export function PersonasPage() {
  const navigate = useNavigate()
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const [filtro, setFiltro] = useState('')
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const conteoPorPersona = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const d of dispositivos) {
      if (d.responsableId) conteo.set(d.responsableId, (conteo.get(d.responsableId) ?? 0) + 1)
    }
    return conteo
  }, [dispositivos])

  const ordenadas = useMemo(
    () => [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [personas],
  )
  const porMigrar = useMemo(() => candidatosPersona(dispositivos).length, [dispositivos])

  const f = normalizar(filtro.trim())
  const hayFiltro = f.length > 0
  const visibles = hayFiltro ? ordenadas.filter((p) => normalizar(p.nombre).includes(f)) : ordenadas

  function alternarCrear() {
    setCreando((v) => !v)
    setNuevoNombre('')
  }

  async function crear() {
    const nombre = nuevoNombre.trim()
    if (nombre === '' || guardando) return
    setGuardando(true)
    await guardarRegistro('personas', { id: nuevoId(), nombre, notas: '' })
    setGuardando(false)
    setCreando(false)
    setNuevoNombre('')
  }

  return (
    // Nivel 2 del chasis (tarea 185): documento. Recupera la barra de
    // pestañas, que esta pantalla había perdido por aplicarle la regla
    // de "pantalla enfocada" (R19): es un registro que se recorre
    // durante minutos, no una tarea con salida.
    <Chasis
      modo="documento"
      acciones={
        <button type="button" onClick={alternarCrear} className={`shrink-0 ${BTN_SECUNDARIO}`}>
          <Plus size={15} aria-hidden />
          Crear
        </button>
      }
      barra={
        <>
          <div className="px-4 pb-2.5 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Personas</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">Quién tiene asignado cada equipo</p>
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
                placeholder="Buscar una persona"
                aria-label="Buscar persona"
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
        </>
      }
    >
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-12 pt-3.5">
        {creando && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3">
            <p className="text-[13.5px] font-medium">Nueva persona</p>
            <input
              type="text"
              autoFocus
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre completo"
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void crear()}
                disabled={guardando || nuevoNombre.trim() === ''}
                className={`${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-50`}
              >
                {guardando ? 'Creando...' : 'Crear persona'}
              </button>
              <button type="button" onClick={alternarCrear} className={`${BTN_GHOST} min-h-11 px-4`}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {porMigrar > 0 && !hayFiltro && (
          <button
            type="button"
            onClick={() => navigate('/personas/migrar')}
            className="flex w-full items-center gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-left text-noct-text"
          >
            <ArrowElbowDownRight size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
            <span className="min-w-0 flex-1 text-[13px] leading-[1.45]">
              {porMigrar} {porMigrar === 1 ? 'equipo tiene' : 'equipos tienen'} un responsable escrito como
              texto. Convertirlos en fichas para poder navegarlos.
            </span>
            <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
          </button>
        )}

        {visibles.length > 0 ? (
          <div className="flex flex-col">
            {visibles.map((p) => {
              const conteo = conteoPorPersona.get(p.id) ?? 0
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/personas/${p.id}`)}
                  className="flex min-h-[52px] items-center gap-[11px] rounded-md py-2.5 pr-2 text-left text-noct-text transition-colors hover:bg-noct-text/[.05]"
                >
                  <User size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium leading-[1.3]">{p.nombre}</span>
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
            <User size={30} className="text-noct-neutral-600" aria-hidden />
            <p className="text-[13px] leading-[1.5] text-noct-neutral-400">
              {hayFiltro ? 'Ninguna persona coincide con la búsqueda.' : 'Aún no hay personas registradas.'}
              {!hayFiltro && porMigrar > 0 && ' Se pueden crear migrando los textos existentes.'}
            </p>
          </div>
        )}
      </main>
    </Chasis>
  )
}
