import type { HistorialEntrada } from '../../lib/db'

// QUIÉN TUVO QUÉ, RECONSTRUIDO DEL HISTORIAL (tarea 266, sección 5 del
// encargo del 2026-09-23).
//
// Desde la tarea 266 cada cambio de `responsableId` de un equipo deja en
// el historial una entrada con el id de la persona anterior y el de la
// nueva (ver `CAMPOS_SIN_HISTORIAL` en src/lib/repositorio.ts). Con esas
// entradas, ordenadas en el tiempo, se reconstruyen los PERIODOS de
// asignación sin una tabla aparte: el historial ya es el registro
// inmutable de los cambios, y una tabla `asignaciones_dispositivo`
// habría guardado dos veces la misma verdad.
//
// Lo que NO hace, a propósito: inventar fechas. Una asignación anterior a
// la tarea 266 (la del inventario institucional, o la de la migración de
// personas) no dejó entrada con id, así que su comienzo se desconoce: el
// periodo que la cierra lleva `desde: null` y la pantalla dice "hasta
// …", nunca una fecha de inicio. Tampoco empareja nombres: el historial
// anterior solo guardaba el nombre, y deducir de un nombre que dos
// personas son la misma es justo lo que el encargo prohíbe.

export const CAMPO_ASIGNACION = 'responsableId'

export interface PeriodoAsignacion {
  dispositivoId: string
  personaId: string
  /** Instante ISO en que se le asignó, o null si es anterior a los registros. */
  desde: string | null
  /** Instante ISO en que dejó de tenerlo, o null si sigue abierto en el registro. */
  hasta: string | null
  /** Motivo anotado al cerrar el periodo ("Retiro de …", "Reemplazado por …"). */
  motivoFin: string
}

type EntradaAsignacion = Pick<
  HistorialEntrada,
  'entidadTipo' | 'entidadId' | 'campo' | 'valorAnterior' | 'valorNuevo' | 'fechaHora' | 'motivo'
>

export function esEntradaDeAsignacion(entrada: Pick<HistorialEntrada, 'entidadTipo' | 'campo'>): boolean {
  return entrada.entidadTipo === 'dispositivo' && entrada.campo === CAMPO_ASIGNACION
}

/**
 * Los periodos de asignación de todos los equipos, a partir de sus
 * entradas `responsableId` (las demás se ignoran, así que se le puede
 * pasar el historial tal cual).
 *
 * Por equipo y en orden de fecha, cada entrada "A → B" cierra el periodo
 * abierto de A (o, si no había ninguno registrado, deja uno cerrado con
 * comienzo desconocido) y abre uno para B. Un equipo solo tiene un
 * responsable a la vez: si al abrir uno quedaba otro abierto (un cambio
 * hecho en dos teléfonos sin conexión, por ejemplo), ese se cierra en el
 * mismo instante en vez de solaparse.
 */
export function periodosDeAsignacion(entradas: EntradaAsignacion[]): PeriodoAsignacion[] {
  const porEquipo = new Map<string, EntradaAsignacion[]>()
  for (const entrada of entradas) {
    if (!esEntradaDeAsignacion(entrada)) continue
    const lista = porEquipo.get(entrada.entidadId)
    if (lista) lista.push(entrada)
    else porEquipo.set(entrada.entidadId, [entrada])
  }

  const periodos: PeriodoAsignacion[] = []
  for (const [dispositivoId, lista] of porEquipo) {
    const ordenadas = [...lista].sort((a, b) => (a.fechaHora < b.fechaHora ? -1 : a.fechaHora > b.fechaHora ? 1 : 0))
    let abierto: PeriodoAsignacion | null = null
    for (const entrada of ordenadas) {
      const anterior = entrada.valorAnterior.trim()
      const nuevo = entrada.valorNuevo.trim()
      if (anterior) {
        if (abierto && abierto.personaId === anterior) {
          abierto.hasta = entrada.fechaHora
          abierto.motivoFin = entrada.motivo
          abierto = null
        } else {
          periodos.push({ dispositivoId, personaId: anterior, desde: null, hasta: entrada.fechaHora, motivoFin: entrada.motivo })
        }
      }
      if (nuevo) {
        // La misma asignación registrada dos veces (dos teléfonos que la
        // hicieron sin conexión) no parte el periodo en dos.
        if (abierto && abierto.personaId === nuevo) continue
        if (abierto) {
          abierto.hasta = entrada.fechaHora
          abierto.motivoFin = entrada.motivo
        }
        abierto = { dispositivoId, personaId: nuevo, desde: entrada.fechaHora, hasta: null, motivoFin: '' }
        periodos.push(abierto)
      }
    }
  }
  return periodos
}

function porFinMasReciente(a: PeriodoAsignacion, b: PeriodoAsignacion): number {
  return (b.hasta ?? '').localeCompare(a.hasta ?? '')
}

/** Los equipos que la persona tuvo y ya no tiene, del más reciente al más antiguo. */
export function equiposAnteriores(personaId: string, periodos: PeriodoAsignacion[]): PeriodoAsignacion[] {
  return periodos.filter((p) => p.personaId === personaId && p.hasta !== null).sort(porFinMasReciente)
}

/** Las personas que tuvieron el equipo antes, de la más reciente a la más antigua. */
export function responsablesAnteriores(dispositivoId: string, periodos: PeriodoAsignacion[]): PeriodoAsignacion[] {
  return periodos.filter((p) => p.dispositivoId === dispositivoId && p.hasta !== null).sort(porFinMasReciente)
}

/**
 * Desde cuándo tiene la persona este equipo, si el registro lo dice: el
 * comienzo del periodo abierto que coincide con la asignación de hoy.
 * null cuando la asignación es anterior a los registros.
 */
export function asignadoDesde(
  personaId: string,
  dispositivoId: string,
  periodos: PeriodoAsignacion[],
): string | null {
  const abierto = periodos.find(
    (p) => p.dispositivoId === dispositivoId && p.personaId === personaId && p.hasta === null,
  )
  return abierto?.desde ?? null
}
