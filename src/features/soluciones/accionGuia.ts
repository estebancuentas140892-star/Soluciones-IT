import { siguientePasoPendiente } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'

// QUE OFRECE LA FICHA DE UNA GUIA (encargo del 2026-09-09, tarea 5).
//
// Tres botones que no hacian lo que decian:
//
//   - "Empezar" no empezaba nada: llevaba a la ejecucion, que retomaba
//     lo que hubiera guardado. Con avance viejo a medias, "Empezar"
//     continuaba.
//   - Una guia terminada ofrecia "Repetir", pero repetir tampoco
//     reiniciaba: entraba al procedimiento con todos los pasos hechos,
//     asi que el tecnico veia la pantalla de completado en vez del paso
//     1.
//   - "Seguir en el paso N" calculaba N como `pasosHechos + 1`. Con los
//     pasos completados en otro orden (saltando uno y cerrando los
//     siguientes) esa cuenta señalaba un paso ya hecho y dejaba el
//     pendiente de verdad escondido detras.
//
// Aqui se decide cual de los tres es, y a que paso lleva. El destino
// sale de `siguientePasoPendiente`, el MISMO que usa la ejecucion para
// colocarse: asi la ficha y la pantalla no pueden discrepar.

export type EstadoAccionGuia =
  // Sin ejecucion abierta: hay que crear una.
  | 'empezar'
  // Ejecucion abierta con pasos pendientes: se conserva.
  | 'continuar'
  // Todo hecho: repetir arranca un caso nuevo.
  | 'repetir'

export interface AccionGuia {
  estado: EstadoAccionGuia
  /** Indice (0-based) del primer paso pendiente real, o null si no queda. */
  destino: number | null
  /** Ese mismo paso en numero de cara al tecnico (1-based), o null. */
  numeroPaso: number | null
  pasosHechos: number
  total: number
}

/**
 * `hayEjecucionAbierta` es la existencia de la fila de progreso, no la
 * cantidad de pasos marcados: una ejecucion recien creada todavia no
 * tiene ninguno y sigue siendo una ejecucion abierta.
 */
export function accionDeGuia(
  idsPasos: string[],
  pasosHechos: string[] | undefined,
  hayEjecucionAbierta: boolean,
): AccionGuia {
  const total = idsPasos.length
  const hechos = new Set(pasosHechos ?? [])
  const destino = siguientePasoPendiente(idsPasos, hechos, -1)
  const cuenta = contarHechos(pasosHechos ?? [], idsPasos)

  if (total > 0 && destino === null) {
    return { estado: 'repetir', destino: null, numeroPaso: null, pasosHechos: cuenta, total }
  }

  return {
    estado: hayEjecucionAbierta ? 'continuar' : 'empezar',
    destino,
    numeroPaso: destino === null ? null : destino + 1,
    pasosHechos: cuenta,
    total,
  }
}
