import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { ArrowElbowDownRight, CaretDown, CaretRight, CaretUp, Monitor, Plus, User } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { PastillaEstado } from '../../components/PastillaEstado'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { candidatosPersona } from './migracion'
import { CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { equiposPorValidar, esDeBaja, esFechaValida, estadoDePersona } from './cicloPersona'

// Minusculas sin acentos, para que la busqueda encuentre "Perez" al
// escribir "perez".
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// Buscador dibujado sobre una tarjeta: variante de fondo de app.
const CLASE_CAMPO = CLASE_CAMPO_SOBRE_SUPERFICIE

type Filtro = 'activas' | 'retiradas'

// Lista de personas (hallazgo T1 de AUDITORIA_FLUJOS_TI.md): el
// responsable de un equipo como entidad, con creación inline y el aviso
// de migración de los textos de "usuario asignado" que aún no son
// entidad. Sin jerarquía (no aplica a personas, a diferencia de
// ubicaciones): lista plana ordenada por nombre. Trae su propio shell
// Nocturne (pantalla enfocada; su puerta es "Más" desde la tarea 182,
// antes se alcanzaba solo desde el menú "···" de Equipos), por eso sale
// del Layout oscuro.
//
// Ciclo de vida (tarea 266): arriba las activas, y a un toque las
// retiradas, que no se borran. El número de cada fila son sus equipos
// DE HOY (uno de baja ya no cuenta). Crear lleva a la ficha nueva, donde
// sigue "Asignar equipo" (sección 7 del encargo: nueva persona, asignar
// equipo, configurar usuario). Al final, plegado, lo que está "por
// validar": equipos con un responsable escrito que no es una persona
// (un área, un estado, dos nombres). Se muestran, no se resuelven solos.
export function PersonasPage() {
  const navigate = useNavigate()
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const [filtro, setFiltro] = useState('')
  const [vista, setVista] = useState<Filtro>('activas')
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoIngreso, setNuevoIngreso] = useState('')
  const [guardando, setGuardando] = useState(false)
  // "?porValidar=1" (la puerta de Herramientas de inventario, tarea 268)
  // la abre ya desplegada.
  const [searchParams] = useSearchParams()
  const [porValidarAbierto, setPorValidarAbierto] = useState(() => searchParams.get('porValidar') === '1')

  const conteoPorPersona = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const p of personas) conteo.set(p.id, 0)
    for (const d of dispositivos) {
      // Un equipo de baja ya no es de nadie, aunque conserve el vínculo.
      if (!d.responsableId || !conteo.has(d.responsableId) || esDeBaja(d)) continue
      conteo.set(d.responsableId, (conteo.get(d.responsableId) ?? 0) + 1)
    }
    return conteo
  }, [personas, dispositivos])

  const ordenadas = useMemo(
    () => [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [personas],
  )
  const activas = useMemo(() => ordenadas.filter((p) => estadoDePersona(p) === 'activa'), [ordenadas])
  const retiradas = useMemo(() => ordenadas.filter((p) => estadoDePersona(p) === 'retirada'), [ordenadas])
  const porMigrar = useMemo(() => candidatosPersona(dispositivos).length, [dispositivos])
  const porValidar = useMemo(
    () =>
      equiposPorValidar(dispositivos).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [dispositivos],
  )

  const f = normalizar(filtro.trim())
  const hayFiltro = f.length > 0
  // Con una búsqueda escrita se busca en las dos listas: quien busca un
  // nombre no tiene por qué saber si esa persona sigue o se retiró.
  const base = hayFiltro ? ordenadas : vista === 'activas' ? activas : retiradas
  const visibles = hayFiltro ? base.filter((p) => normalizar(p.nombre).includes(f)) : base

  const ingresoInvalido = nuevoIngreso !== '' && !esFechaValida(nuevoIngreso)

  function alternarCrear() {
    setCreando((v) => !v)
    setNuevoNombre('')
    setNuevoIngreso('')
  }

  async function crear() {
    const nombre = nuevoNombre.trim()
    if (nombre === '' || guardando || ingresoInvalido) return
    setGuardando(true)
    const id = nuevoId()
    await guardarRegistro('personas', {
      id,
      nombre,
      notas: '',
      estado: 'activa',
      fechaIngreso: nuevoIngreso || null,
      fechaRetiro: null,
      motivoRetiro: '',
    })
    setGuardando(false)
    setCreando(false)
    setNuevoNombre('')
    setNuevoIngreso('')
    navigate(`/personas/${id}`)
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
          <div className="px-4 pb-2.5">
            <CampoBusqueda
              valor={filtro}
              onCambiar={setFiltro}
              alcance="Personas"
            />
          </div>
          {!hayFiltro && (
            <div className="flex gap-1.5 px-4 pb-3" role="group" aria-label="Qué personas mostrar">
              {(
                [
                  ['activas', `Activas · ${activas.length}`],
                  ['retiradas', `Retiradas · ${retiradas.length}`],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={vista === valor}
                  onClick={() => setVista(valor)}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] transition-colors ${
                    vista === valor
                      ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-400 hover:bg-noct-text/[.05]'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          )}
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
              aria-label="Nombre completo"
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-noct-neutral-500">Fecha de ingreso (opcional)</span>
              <input
                type="date"
                value={nuevoIngreso}
                onChange={(e) => setNuevoIngreso(e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void crear()}
                disabled={guardando || nuevoNombre.trim() === '' || ingresoInvalido}
                className={`${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-50`}
              >
                {guardando ? 'Creando...' : 'Crear persona'}
              </button>
              <button type="button" onClick={alternarCrear} className={`${BTN_GHOST} min-h-11 px-4`}>
                Cancelar
              </button>
            </div>
            <p className="text-[12px] text-noct-neutral-500">Después se le asigna un equipo desde su ficha.</p>
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
              const retirada = estadoDePersona(p) === 'retirada'
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/personas/${p.id}`)}
                  className="flex min-h-[52px] items-center gap-[11px] rounded-md py-2.5 pr-2 text-left text-noct-text transition-colors hover:bg-noct-text/[.05]"
                >
                  <User size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium leading-[1.3]">{p.nombre}</span>
                  {retirada && <PastillaEstado tono="neutro">Retirada</PastillaEstado>}
                  <span className="shrink-0 text-[12px] text-noct-neutral-500">
                    {conteo === 0 && !retirada ? 'Sin equipo' : `${conteo} ${conteo === 1 ? 'equipo' : 'equipos'}`}
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
              {hayFiltro
                ? 'Ninguna persona coincide con la búsqueda.'
                : vista === 'retiradas'
                  ? 'Nadie se ha retirado todavía.'
                  : 'Aún no hay personas registradas.'}
              {!hayFiltro && vista === 'activas' && porMigrar > 0 && ' Se pueden crear migrando los textos existentes.'}
            </p>
          </div>
        )}

        {/* POR VALIDAR (sección 8 del encargo): el responsable escrito que
            no es una ficha de persona. No se convierte en persona ni se
            limpia solo: cada equipo se abre y se decide en su ficha. */}
        {!hayFiltro && porValidar.length > 0 && (
          <section className="border-t border-noct-divider pt-1">
            <button
              type="button"
              onClick={() => setPorValidarAbierto((v) => !v)}
              aria-expanded={porValidarAbierto}
              className="flex min-h-[52px] w-full items-center gap-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-noct-text">
                  Responsable por validar · {porValidar.length}
                </span>
                <span className="block text-[12px] text-noct-neutral-500">
                  Equipos con un responsable escrito que no es una persona: un área, un estado o dos nombres.
                </span>
              </span>
              {porValidarAbierto ? (
                <CaretUp size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
              ) : (
                <CaretDown size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
              )}
            </button>
            {porValidarAbierto && (
              <div className="flex flex-col">
                {porValidar.map((d) => (
                  <Link
                    key={d.id}
                    to={`/dispositivos/${d.id}`}
                    state={conOrigen('/personas', 'Personas')}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text hover:bg-noct-text/[.05]"
                  >
                    <Monitor size={16} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{d.nombre}</span>
                      <span className="block text-[12px] leading-[1.4] text-noct-neutral-500">Anotado: {d.responsable}</span>
                    </span>
                    <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </Chasis>
  )
}
