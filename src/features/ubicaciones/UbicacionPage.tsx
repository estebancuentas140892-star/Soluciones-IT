import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { CaretDown, CaretRight, CaretUp, MapPin, PencilSimple, Plus, TrashSimple } from '../../components/iconos'
import { BTN_GHOST_TENUE, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { db, type Dispositivo } from '../../lib/db'
import { conOrigen, type EstadoConOrigen } from '../../lib/origenNavegacion'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'
import { IconoNodo } from '../red/IconoNodo'
import { tipoDeNodoVisual } from '../red/topologiaVisual'
import { cadenaUbicaciones, hijosDirectos, mapaPorId } from './arbol'
import { contenidoDeUbicacion, totalConSububicaciones } from './contenido'

// Ficha 360 de una ubicacion (grupo N3) re-autorizada al sistema
// Nocturne (handoff "Rediseño de aplicación empresarial", derivada del
// panel de Ubicaciones.dc.html): su lugar en la jerarquía (migas), las
// sub-ubicaciones que contiene y los equipos que hay en ella (el inverso
// de dispositivos.ubicacionId), más notas e historial. Trae su propio
// shell Nocturne, por eso sale del Layout oscuro.
//
// Desde la tarea 267 (sección 12 del encargo del 2026-09-23) responde
// "¿qué hay aquí?": los equipos agrupados por su categoría real
// (Computadores, Impresoras, Switches, Puntos de red...), cada uno con su
// IP, su responsable y su estado, y cada fila abre su ficha, que vuelve
// aquí. Las sub-ubicaciones dicen cuántos equipos hay en toda su rama.
// Los de baja van aparte y plegados. La jerarquía es la que el equipo
// creó: esta pantalla no inventa ninguna.
export function UbicacionPage() {
  const { ubicacionId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [bajaAbierta, setBajaAbierta] = useState(false)

  // `?? null`: undefined es "cargando" y null "no existe".
  const ubicacion = useLiveQuery(async () => (await db.ubicaciones.get(ubicacionId)) ?? null, [ubicacionId])
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  const personas = useLiveQuery(() => db.personas.toArray(), [], [])

  const porId = useMemo(() => mapaPorId(ubicaciones), [ubicaciones])
  const subUbicaciones = useMemo(() => hijosDirectos(ubicacionId, ubicaciones), [ubicaciones, ubicacionId])
  const contenido = useMemo(
    () => contenidoDeUbicacion(ubicacionId, dispositivos, categorias),
    [ubicacionId, dispositivos, categorias],
  )
  const categoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const personaPorId = useMemo(
    () => new Map(personas.filter((p) => !p.eliminadoEn).map((p) => [p.id, p])),
    [personas],
  )

  if (ubicacion === null || ubicacion?.eliminadoEn) return <Navigate to="/ubicaciones" replace />
  if (!ubicacion) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  // Cadena de la raíz a la propia; los ancestros (sin la propia) son las
  // migas de pan navegables.
  const cadena = cadenaUbicaciones(ubicacionId, porId)
  const ancestros = cadena.slice(0, -1)
  // Abrir un equipo o una sub-ubicación desde aquí vuelve aquí (M-R2).
  const origenAqui = conOrigen(`/ubicaciones/${ubicacionId}`, ubicacion.nombre)

  async function eliminar() {
    await eliminarRegistro('ubicaciones', ubicacionId)
    navigate('/ubicaciones')
  }

  const totalEquipos = contenido.total
  // Los de toda la rama: una sede cuyos equipos están en sus áreas no
  // está "sin equipos".
  const totalRama = totalConSububicaciones(ubicacionId, ubicaciones, dispositivos)
  const advertencia =
    totalEquipos > 0 || subUbicaciones.length > 0
      ? `${describir(totalEquipos, 'equipo', 'equipos')}${
          totalEquipos > 0 && subUbicaciones.length > 0 ? ' y ' : ''
        }${describir(subUbicaciones.length, 'sub-ubicación', 'sub-ubicaciones')} quedarán sin este vínculo.`
      : null

  function fila(d: Dispositivo) {
    const persona = d.responsableId ? personaPorId.get(d.responsableId) : undefined
    const detalle = [d.ip, persona?.nombre].filter(Boolean).join(' · ')
    return (
      <FilaEquipo
        key={d.id}
        dispositivo={d}
        detalle={detalle}
        tipo={tipoDeNodoVisual(categoriaPorId.get(d.categoriaId)?.nombre ?? '')}
        origen={origenAqui}
      />
    )
  }

  return (
    // Nivel 2 del chasis (tarea 185): documento.
    <Chasis
      modo="documento"
      volverA="/ubicaciones"
      volverEtiqueta="Ubicaciones"
      // Ancla permanente (M-001, M-R1, mockup `6b`): a esta pantalla se
      // llega tocando la ubicación dentro de la ficha de un equipo, así
      // que el nombre y de dónde cuelga se quedan arriba. El h1 pasa a
      // vivir en el chasis; el de abajo se queda como rótulo grande.
      titulo={ubicacion.nombre}
      contexto={ancestros.length > 0 ? ancestros.map((a) => a.nombre).join(' › ') : 'Ubicaciones'}
      barra={
        <div className="px-4 pb-3 pt-0.5">
          {ancestros.length > 0 && (
            <nav className="mb-1 flex flex-wrap items-center gap-1 text-[11.5px] text-noct-neutral-500">
              {ancestros.map((a) => (
                <span key={a.id} className="flex items-center gap-1">
                  <Link
                    to={`/ubicaciones/${a.id}`}
                    className="-my-3 inline-flex min-h-11 items-center text-noct-accent-300 hover:text-noct-accent-400"
                  >
                    {a.nombre}
                  </Link>
                  <span className="text-noct-neutral-600">›</span>
                </span>
              ))}
            </nav>
          )}
          <p className="m-0 text-[19px] font-medium leading-[1.25]">{ubicacion.nombre}</p>
          <p className="mt-0.5 text-[12.5px] text-noct-neutral-400">
            {totalRama === 0
              ? 'Sin equipos'
              : `${totalRama} ${totalRama === 1 ? 'equipo' : 'equipos'}${
                  totalRama !== totalEquipos ? ` (${totalEquipos} aquí, el resto en sus sub-ubicaciones)` : ''
                }`}
            {subUbicaciones.length > 0 &&
              ` · ${subUbicaciones.length} ${subUbicaciones.length === 1 ? 'sub-ubicación' : 'sub-ubicaciones'}`}
          </p>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-12 pt-3.5">
        <div className="flex flex-wrap gap-2">
          <Link to={`/ubicaciones/nueva?padre=${ubicacionId}`} className={`min-h-11 shrink-0 ${BTN_SECUNDARIO}`}>
            <Plus size={14} aria-hidden />
            Sub-ubicación
          </Link>
          <Link to={`/ubicaciones/${ubicacionId}/editar`} className={`min-h-11 shrink-0 ${BTN_SECUNDARIO}`}>
            <PencilSimple size={14} aria-hidden />
            Editar
          </Link>
        </div>

        {ubicacion.notas && (
          <section>
            <TituloSeccion className="mb-1.5">Notas</TituloSeccion>
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] text-noct-neutral-300">{ubicacion.notas}</p>
          </section>
        )}

        {subUbicaciones.length > 0 && (
          <section>
            <TituloSeccion className="mb-1.5">Contiene</TituloSeccion>
            <div className="flex flex-col">
              {subUbicaciones.map((u) => {
                const total = totalConSububicaciones(u.id, ubicaciones, dispositivos)
                return (
                  <Link
                    key={u.id}
                    to={`/ubicaciones/${u.id}`}
                    className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <MapPin size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{u.nombre}</span>
                    <span className="shrink-0 text-[12px] text-noct-neutral-500">
                      {total} {total === 1 ? 'equipo' : 'equipos'}
                    </span>
                    <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ¿QUÉ HAY AQUÍ? (sección 12 del encargo): por categoría real. */}
        <section className="flex flex-col gap-3">
          <TituloSeccion>Qué hay aquí</TituloSeccion>
          {contenido.grupos.length === 0 && contenido.deBaja.length === 0 ? (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-3.5 text-center text-[12.5px] text-noct-neutral-500">
              {totalRama > 0
                ? 'Sus equipos están en las sub-ubicaciones de arriba.'
                : 'Ningún equipo tiene esta ubicación.'}
            </p>
          ) : (
            contenido.grupos.map((g) => (
              <div key={g.categoriaId}>
                <p className="mb-0.5 flex items-baseline gap-1.5 px-1.5 text-[12.5px] font-medium text-noct-neutral-300">
                  {g.titulo}
                  <span className="font-normal text-noct-neutral-500">{g.equipos.length}</span>
                </p>
                <div className="flex flex-col">{g.equipos.map(fila)}</div>
              </div>
            ))
          )}
          {contenido.deBaja.length > 0 && (
            <div className="border-t border-noct-divider pt-1">
              <button
                type="button"
                onClick={() => setBajaAbierta((v) => !v)}
                aria-expanded={bajaAbierta}
                className="flex min-h-11 w-full items-center gap-2 px-1.5 text-left text-[12.5px] text-noct-neutral-400"
              >
                <span className="min-w-0 flex-1">De baja · {contenido.deBaja.length}</span>
                {bajaAbierta ? (
                  <CaretUp size={14} className="shrink-0" aria-hidden />
                ) : (
                  <CaretDown size={14} className="shrink-0" aria-hidden />
                )}
              </button>
              {bajaAbierta && <div className="flex flex-col">{contenido.deBaja.map(fila)}</div>}
            </div>
          )}
        </section>

        <Historial entidadTipo="ubicacion" entidadId={ubicacionId} />

        <div className="border-t border-noct-divider pt-3">
          <button type="button" onClick={() => setMostrarEliminar(true)} className={`${BTN_GHOST_TENUE} min-h-11`}>
            <TrashSimple size={14} aria-hidden />
            Eliminar ubicación
          </button>
        </div>
      </main>

      <DialogoEliminar
        abierto={mostrarEliminar}
        titulo={`¿Eliminar la ubicación "${ubicacion.nombre}"?`}
        descripcion="Los equipos conservarán el nombre del lugar como texto, pero perderán el enlace a esta ficha."
        advertencia={advertencia}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}

function FilaEquipo({
  dispositivo,
  detalle,
  tipo,
  origen,
}: {
  dispositivo: Dispositivo
  detalle: string
  tipo: ReturnType<typeof tipoDeNodoVisual>
  origen: EstadoConOrigen
}) {
  return (
    <Link
      to={`/dispositivos/${dispositivo.id}`}
      state={origen}
      className="flex min-h-[52px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
    >
      <IconoNodo tipo={tipo} className="h-4 w-4 shrink-0 text-noct-neutral-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px]">{dispositivo.nombre}</span>
        {detalle && <span className="block truncate text-[12px] text-noct-neutral-500">{detalle}</span>}
      </span>
      {dispositivo.estado && <PastillaEstadoDispositivo estado={dispositivo.estado} />}
      <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

function describir(n: number, singular: string, plural: string): string {
  if (n === 0) return ''
  return `${n} ${n === 1 ? singular : plural}`
}
