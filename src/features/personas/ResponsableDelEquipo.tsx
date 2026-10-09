import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilaDato } from '../../components/FilaDato'
import { CaretRight, User } from '../../components/iconos'
import { PastillaEstado } from '../../components/PastillaEstado'
import { db, type Dispositivo } from '../../lib/db'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'
import { textoVivo } from '../../lib/referencia'
import { esDeBaja, estaActiva, fechaLegible, responsablePorValidar } from './cicloPersona'
import { HojaAsignarPersona } from './HojaAsignarPersona'
import { HojaLiberarEquipo } from './HojaLiberarEquipo'
import { asignadoDesde, periodosDeAsignacion, type PeriodoAsignacion } from './historialAsignaciones'
import { useEntradasDeAsignacion } from './useAsignaciones'

// QUIÉN RESPONDE DE ESTE EQUIPO, EN LA FICHA DEL EQUIPO (tarea 266,
// secciones 5 y 8 del encargo del 2026-09-23).
//
// Cuatro casos, cada uno dicho como es:
//   - Una persona activa: su nombre (enlace a su ficha) y desde cuándo si
//     el historial lo dice. "Cambiar" lo libera o lo pasa a otra.
//   - Una persona retirada: lo mismo, avisando que hay que resolverlo.
//   - Un texto que no es una persona ("Archivo", dos nombres): "Sin
//     responsable" y el texto como anotación "por validar". No se
//     convierte en persona ni se borra solo.
//   - Nada: "Sin responsable" (y la pastilla "Disponible" del estado, si
//     lo está). "Asignar" abre la lista de personas activas.
// Un equipo de baja sin vínculo no lleva fila: no se entrega a nadie.

// EL NOMBRE ES EL DATO PRINCIPAL DE LA FILA (tarea 316). En un teléfono
// comparte el ancho con el icono, la flecha y "Cambiar", y con `truncate`
// se leía "Responsable: Daniela…". El rótulo va en su línea, como el de
// la IP de encima, y el nombre debajo puede ocupar hasta dos líneas antes
// de recortarse: la fila crece en altura antes que perder a quién nombra.
const NOMBRE_RESPONSABLE = 'line-clamp-2 break-words'

export function ResponsableDelEquipo({
  dispositivo,
  origen,
  ocultarSiNoHay = false,
}: {
  dispositivo: Dispositivo
  /** El `state` para que la ficha de la persona vuelva a este equipo. */
  origen: EstadoConOrigen
  /** Sin persona ni nombre anotado, no dibuja nada (lo dice la línea de identidad). */
  ocultarSiNoHay?: boolean
}) {
  const persona = useLiveQuery(
    async () => (dispositivo.responsableId ? ((await db.personas.get(dispositivo.responsableId)) ?? null) : null),
    [dispositivo.responsableId],
  )
  const otras = useLiveQuery(
    () => db.personas.filter((p) => !p.eliminadoEn && estaActiva(p) && p.id !== dispositivo.responsableId).toArray(),
    [dispositivo.responsableId],
    [],
  )
  const entradas = useEntradasDeAsignacion(dispositivo.id)
  const [asignando, setAsignando] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  const otrasOrdenadas = useMemo(
    () => [...otras].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [otras],
  )
  const periodos = useMemo(() => periodosDeAsignacion(entradas), [entradas])

  const personaViva = persona && !persona.eliminadoEn ? persona : null
  const porValidar = responsablePorValidar(dispositivo)

  // Un equipo de baja que conserva el vínculo (datos de antes de la
  // tarea 266, cuando la baja no lo soltaba): no es de nadie, pero se
  // dice quién lo tuvo por última vez, sin pedir que se reasigne.
  if (personaViva && esDeBaja(dispositivo)) {
    return (
      <Link
        to={`/personas/${personaViva.id}`}
        state={origen}
        className="flex min-h-12 items-center gap-2.5 px-3.5 py-1.5 text-[13.5px] text-noct-accent-300 hover:bg-noct-text/[.04]"
      >
        <User size={15} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-noct-neutral-500">Último responsable: </span>
          <span className={NOMBRE_RESPONSABLE}>{textoVivo(personaViva.nombre, dispositivo.responsable)}</span>
        </span>
        <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
      </Link>
    )
  }

  if (personaViva) {
    const desde = asignadoDesde(personaViva.id, dispositivo.id, periodos)
    const retirada = !estaActiva(personaViva)
    return (
      <div className="flex items-center gap-1 pr-2">
        <Link
          to={`/personas/${personaViva.id}`}
          state={origen}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-3.5 py-1.5 text-[13.5px] text-noct-accent-300 hover:bg-noct-text/[.04]"
        >
          <User size={15} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-noct-neutral-500">Responsable: </span>
            <span className={NOMBRE_RESPONSABLE}>{textoVivo(personaViva.nombre, dispositivo.responsable)}</span>
            {/* "Retirada" va con su aviso, dentro de la columna: al lado
                del nombre le quitaba al teléfono el ancho que le falta. */}
            {(desde || retirada) && (
              <span
                className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] ${retirada ? 'text-noct-precaucion' : 'text-noct-neutral-500'}`}
              >
                {retirada && <PastillaEstado tono="neutro">Retirada</PastillaEstado>}
                <span className="min-w-0 break-words">
                  {retirada ? 'Se retiró: reasignar o liberar este equipo' : `Desde el ${fechaLegible(desde as string)}`}
                </span>
              </span>
            )}
          </span>
          <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => setCambiando(true)}
          className="min-h-11 shrink-0 rounded-md px-2.5 text-[12.5px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.06]"
        >
          Cambiar
        </button>
        <HojaLiberarEquipo
          dispositivo={cambiando ? dispositivo : null}
          persona={personaViva}
          otrasPersonas={otrasOrdenadas}
          onCerrar={() => setCambiando(false)}
          desdeElEquipo
        />
      </div>
    )
  }

  // Sin persona vinculada: un equipo de baja no se entrega a nadie.
  if (esDeBaja(dispositivo)) return null

  // SIN NADIE, LA FICHA LO DICE EN SU LÍNEA DE IDENTIDAD (propuesta final
  // de Claude Design, 2026-10-01): "Sin responsable" no es un dato para
  // trabajar, es un dato que falta. Con `ocultarSiNoHay` esta fila no se
  // dibuja y quien la monta ofrece "Asignar" junto a esa línea. Un nombre
  // ANOTADO sí es un dato (por validar), y la fila se queda para decirlo.
  if (!porValidar && ocultarSiNoHay) return null

  return (
    <div className="flex items-center gap-1 pr-2">
      <span className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-3.5 py-1.5 text-[13.5px] text-noct-neutral-200">
        <User size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
        {/* Un nombre escrito que no es una ficha de persona no se
            presenta como persona ni se resuelve solo (tarea 266): se dice
            que está anotado y por validar. */}
        {porValidar ? (
          <span className="min-w-0 flex-1 leading-[1.4]">Anotado: «{porValidar}» · por validar</span>
        ) : (
          <span className="block min-w-0 flex-1 truncate">Sin responsable</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => setAsignando(true)}
        className="min-h-11 shrink-0 rounded-md px-2.5 text-[12.5px] font-medium text-noct-accent-300 hover:bg-noct-accent/10"
      >
        Asignar
      </button>
      <HojaAsignarPersona dispositivo={dispositivo} abierto={asignando} onCerrar={() => setAsignando(false)} />
    </div>
  )
}

/**
 * "Responsables anteriores" dentro de "Más datos del equipo". Nada si no
 * consta ninguno (una fila vacía no informa).
 */
export function ResponsablesAnteriores({
  periodos,
  origen,
}: {
  periodos: PeriodoAsignacion[]
  origen: EstadoConOrigen
}) {
  const ids = useMemo(() => [...new Set(periodos.map((p) => p.personaId))], [periodos])
  const personas = useLiveQuery(() => db.personas.bulkGet(ids), [ids.join(',')], [])
  const porId = useMemo(
    () => new Map(personas.flatMap((p) => (p ? [[p.id, p] as const] : []))),
    [personas],
  )

  if (periodos.length === 0) return null
  return (
    <FilaDato etiqueta="Responsables anteriores">
      <span className="flex min-w-0 flex-1 flex-col">
        {periodos.map((p) => {
          const persona = porId.get(p.personaId)
          const fechas = p.desde
            ? `${fechaLegible(p.desde)} → ${fechaLegible(p.hasta as string)}`
            : `hasta el ${fechaLegible(p.hasta as string)}`
          const contenido = (
            <>
              <span className="block truncate text-[13.5px]">{persona?.nombre ?? 'Persona sin ficha'}</span>
              <span className="block text-[12px] text-noct-neutral-500">{fechas}</span>
            </>
          )
          // Cada persona es una fila de 44 px que abre su ficha (R6: el
          // nombre suelto dentro del texto era un blanco de 16 px).
          return persona && !persona.eliminadoEn ? (
            <Link
              key={`${p.personaId}:${p.hasta}`}
              to={`/personas/${persona.id}`}
              state={origen}
              className="flex min-h-11 min-w-0 flex-col justify-center text-noct-accent-300 hover:text-noct-accent-400"
            >
              {contenido}
            </Link>
          ) : (
            <span
              key={`${p.personaId}:${p.hasta}`}
              className="flex min-h-11 min-w-0 flex-col justify-center text-noct-neutral-300"
            >
              {contenido}
            </span>
          )
        })}
      </span>
    </FilaDato>
  )
}
