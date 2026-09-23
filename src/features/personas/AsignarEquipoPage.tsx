import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Cargando } from '../../components/Cargando'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { Check, Monitor, Warning } from '../../components/iconos'
import { BTN_PRIMARIO, TituloSeccion } from '../../components/nocturne'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { db, type Dispositivo } from '../../lib/db'
import { idsDeRed } from '../../lib/categorias'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import {
  candidatosParaAsignar,
  categoriasQueSeAsignan,
  equiposActuales,
  estaActiva,
  ORDEN_GRUPOS,
  responsablePorValidar,
  sugerirDisponible,
  type GrupoCandidato,
} from './cicloPersona'
import { asignarEquipo, liberarEquipo } from './operaciones'

// ASIGNAR UN EQUIPO A UNA PERSONA (tarea 266, sección 7 del encargo).
//
// "Nueva persona → asignar equipo → configurar usuario": este es el
// segundo paso. Se ofrecen primero los equipos Disponibles, luego los que
// no tienen responsable y al final los que ya tiene otra persona (pasar
// uno de esos también es asignar, y la pantalla lo dice antes de
// confirmar). El buscador encuentra cualquiera por nombre, placa, serial,
// IP o ubicación.
//
// "Cambiar de equipo" es esto mismo: si la persona ya tiene equipos, se
// puede soltar el anterior en el mismo gesto (queda sin responsable, y
// Disponible si funcionaba).

const TITULO_GRUPO: Record<GrupoCandidato, string> = {
  disponible: 'Disponibles',
  sinResponsable: 'Sin responsable',
  deOtraPersona: 'Asignados a otra persona',
}

const MAXIMO_SIN_BUSCAR = 60

function coincide(d: Dispositivo, consulta: string): boolean {
  if (!consulta) return true
  const texto = normalizarTexto(
    [d.nombre, d.placaInventario, d.serial, d.ip, d.ubicacion, d.marca, d.modelo, d.responsable].join(' '),
  )
  return consulta.split(/\s+/).every((parte) => texto.includes(parte))
}

export function AsignarEquipoPage() {
  const { personaId = '' } = useParams()
  const navigate = useNavigate()

  const persona = useLiveQuery(async () => (await db.personas.get(personaId)) ?? null, [personaId])
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const [consulta, setConsulta] = useState('')
  const [elegidoId, setElegidoId] = useState<string | null>(null)
  const [soltar, setSoltar] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  const categoriasDeRed = useMemo(() => idsDeRed(categorias), [categorias])
  const actuales = useMemo(() => equiposActuales(personaId, dispositivos ?? []), [personaId, dispositivos])
  const candidatos = useMemo(() => {
    const todos = dispositivos ?? []
    return candidatosParaAsignar(todos, personaId, categoriasDeRed, categoriasQueSeAsignan(todos))
  }, [dispositivos, personaId, categoriasDeRed])
  const q = normalizarTexto(consulta.trim())
  const visibles = useMemo(() => candidatos.filter((c) => coincide(c.dispositivo, q)), [candidatos, q])

  if (persona === null || persona?.eliminadoEn) return <Navigate to="/personas" replace />
  if (!persona || dispositivos === undefined) return <Cargando />
  // A una persona retirada no se le entregan equipos: primero se reactiva.
  if (!estaActiva(persona)) return <Navigate to={`/personas/${personaId}`} replace />

  const elegido = elegidoId ? (dispositivos.find((d) => d.id === elegidoId) ?? null) : null
  const duenoActual = elegido?.responsableId ? elegido.responsable || 'otra persona' : null
  const recortado = !q && visibles.length > MAXIMO_SIN_BUSCAR
  const mostrados = recortado ? visibles.slice(0, MAXIMO_SIN_BUSCAR) : visibles

  async function confirmar() {
    if (!elegido || !persona) return
    setGuardando(true)
    for (const id of soltar) {
      const anterior = actuales.find((d) => d.id === id)
      if (!anterior) continue
      await liberarEquipo(id, {
        marcarDisponible: sugerirDisponible(anterior.estado) === 'si',
        motivo: `Cambio de equipo de ${persona.nombre}: recibe ${elegido.nombre}`,
      })
    }
    await asignarEquipo(elegido.id, personaId)
    navigate(`/personas/${personaId}`, { replace: true, state: { recienAsignado: elegido.id } })
  }

  return (
    <Chasis
      modo="tarea"
      rotulo="Asignando equipo"
      titulo={persona.nombre}
      salidaA={`/personas/${personaId}`}
      // "Su ficha" y no el nombre: el nombre ya es el título de la barra.
      vuelta="Su ficha"
      salidaEtiqueta="Salir sin asignar"
      barra={
        <div className="px-4 pb-3">
          <CampoBusqueda valor={consulta} onCambiar={setConsulta} alcance="Equipos" />
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-4 px-4 pb-40 pt-3.5">
        {visibles.length === 0 ? (
          <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-[13px] text-noct-neutral-500">
            {q ? 'Ningún equipo coincide con la búsqueda.' : 'No hay equipos que se puedan asignar.'}
          </p>
        ) : (
          ORDEN_GRUPOS.map((grupo) => {
            const delGrupo = mostrados.filter((c) => c.grupo === grupo)
            if (delGrupo.length === 0) return null
            return (
              <section key={grupo} className="flex flex-col gap-1">
                <TituloSeccion className="mb-0.5">{TITULO_GRUPO[grupo]}</TituloSeccion>
                <div role="radiogroup" aria-label={TITULO_GRUPO[grupo]} className="flex flex-col">
                  {delGrupo.map(({ dispositivo: d }) => {
                    const activo = d.id === elegidoId
                    const porValidar = responsablePorValidar(d)
                    const detalle = [d.placaInventario && `Placa ${d.placaInventario}`, d.ubicacion]
                      .filter(Boolean)
                      .join(' · ')
                    // A quién pertenece hoy, en su propia línea: es lo que
                    // decide si elegirlo, y recortado no se leía.
                    const pertenencia =
                      grupo === 'deOtraPersona'
                        ? `Lo tiene ${d.responsable || 'otra persona'}`
                        : porValidar && `Anotado: ${porValidar} (por validar)`
                    return (
                      <button
                        key={d.id}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => setElegidoId(d.id)}
                        className={`flex min-h-[52px] items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          activo
                            ? 'border-noct-accent bg-noct-accent/[.12]'
                            : 'border-transparent hover:bg-noct-text/[.05]'
                        }`}
                      >
                        <Monitor size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-noct-text">{d.nombre}</span>
                          {detalle && <span className="block text-[12px] leading-[1.4] text-noct-neutral-500">{detalle}</span>}
                          {pertenencia && (
                            <span className="block text-[12px] leading-[1.4] text-noct-neutral-400">{pertenencia}</span>
                          )}
                        </span>
                        {d.estado && <PastillaEstadoDispositivo estado={d.estado} />}
                        {activo && <Check size={16} className="shrink-0 text-noct-accent" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
        {recortado && (
          <p className="text-center text-[12px] text-noct-neutral-500">
            Se muestran {MAXIMO_SIN_BUSCAR} de {visibles.length}. Busca por nombre, placa o ubicación para ver el resto.
          </p>
        )}
      </main>

      {/* Confirmación fija al pie: el equipo elegido, a quién se quita si
          era de otra persona, y el equipo actual que se puede soltar. */}
      <div className="sticky bottom-0 z-10 border-t border-noct-divider bg-noct-bg/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        {elegido ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] leading-[1.45] text-noct-neutral-300">
              <strong className="text-noct-text">{elegido.nombre}</strong> pasa a {persona.nombre}.
            </p>
            {duenoActual && (
              <p className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-noct-precaucion">
                <Warning size={13} className="mt-px shrink-0" aria-hidden />
                Hoy lo tiene {duenoActual}: dejará de tenerlo.
              </p>
            )}
            {actuales.map((d) => {
              const marcado = soltar.has(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  onClick={() =>
                    setSoltar((actual) => {
                      const siguiente = new Set(actual)
                      if (siguiente.has(d.id)) siguiente.delete(d.id)
                      else siguiente.add(d.id)
                      return siguiente
                    })
                  }
                  className="flex min-h-11 items-center gap-2.5 text-left text-[13px] text-noct-neutral-300"
                >
                  {marcado ? (
                    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-noct-accent">
                      <Check size={13} className="text-noct-bg" />
                    </span>
                  ) : (
                    <span aria-hidden className="h-5 w-5 shrink-0 rounded-md border-[1.5px] border-noct-neutral-600" />
                  )}
                  <span>Reemplaza a {d.nombre}: dejarlo sin responsable</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={guardando}
              className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
            >
              {guardando ? 'Asignando…' : 'Asignar equipo'}
            </button>
          </div>
        ) : (
          <p className="min-h-11 py-3 text-[13px] text-noct-neutral-500">Elige el equipo que recibe {persona.nombre}.</p>
        )}
      </div>
    </Chasis>
  )
}
