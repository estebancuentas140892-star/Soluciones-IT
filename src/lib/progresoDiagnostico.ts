import { db, type NodoDiagnostico, type OpcionDiagnostico, type ProgresoDiagnostico } from './db'
import { avanceAlResponder, avanceAlRetroceder, avanceTrasArticulo } from './diagnostico'
import { reiniciarProgreso } from './progresoPasos'

// EL PROCEDIMIENTO DENTRO DE UN RECORRIDO TIENE SU PROPIO AVANCE (tarea
// 263, encargo "Resolución guiada", sección 5: "un procedimiento
// vinculado no debe convertirse en una tarea pendiente global").
//
// Hasta ahora se ejecutaba con la fila de `progresoPasos` de la propia
// guía, la misma que usa esa guía abierta por su cuenta, y al empezar la
// REINICIABA: borraba lo que el técnico llevara hecho en ella y, mientras
// duraba, la guía aparecía "a medias" en Resolver y en la agenda. Ahora
// vive en una raíz propia del recorrido, con el mismo mecanismo que las
// guías vinculadas (`contextoEjecucion.ts`): la guía no se entera.
const PREFIJO_RECORRIDO = 'recorrido:'

/** La raíz de `progresoPasos` del procedimiento que ejecuta un recorrido. */
export function raizDelProcedimiento(diagnosticoId: string): string {
  return `${PREFIJO_RECORRIDO}${diagnosticoId}`
}

// Avance local de un diagnostico en curso (tabla progresoDiagnostico,
// solo en este dispositivo, como progresoPasos): el tecnico puede
// cerrar la app, ejecutar un procedimiento vinculado o quedarse sin
// señal y siempre retoma en el punto exacto. Las transiciones viven
// aqui, separadas de la interfaz, para poder probarlas sin navegador.

export async function iniciarDiagnostico(diagnosticoId: string, primerNodoId: string): Promise<void> {
  const ahora = new Date().toISOString()
  await db.progresoDiagnostico.put({
    diagnosticoId,
    camino: [],
    estado: { tipo: 'pregunta', nodoId: primerNodoId },
    articulosEjecutados: [],
    iniciadoEn: ahora,
    actualizadoEn: ahora,
  })
}

// Responde la pregunta actual con una de sus opciones. El paso queda
// en el camino (con copias de los textos, para que el registro sea
// legible aunque el diagnostico se edite despues) y el estado avanza:
// a ejecutar un procedimiento, a la siguiente pregunta o al final.
export async function responderOpcion(
  diagnosticoId: string,
  nodo: NodoDiagnostico,
  opcion: OpcionDiagnostico,
): Promise<void> {
  const actual = await db.progresoDiagnostico.get(diagnosticoId)
  if (!actual) return

  const siguiente = avanceAlResponder(actual, nodo, opcion)

  // Un procedimiento DISTINTO del que guarda la raíz del recorrido
  // arranca de cero; el mismo (se retrocedió y se volvió a elegir)
  // conserva lo hecho. La fila propia de la guía no se toca nunca.
  const enCurso = actual.procedimientoEnCurso ?? null
  if (opcion.articuloId && opcion.articuloId !== enCurso) {
    await reiniciarProgreso(raizDelProcedimiento(diagnosticoId))
  }

  await db.progresoDiagnostico.put({
    ...actual,
    camino: siguiente.camino,
    estado: siguiente.estado,
    procedimientoEnCurso: opcion.articuloId ?? enCurso,
    actualizadoEn: new Date().toISOString(),
  })
}

// El procedimiento vinculado termino: se anota como ejecutado, su
// avance dentro del recorrido se reinicia (queda listo para el proximo
// uso) y el recorrido continua solo desde la siguiente pregunta, o pasa
// al resultado final si la rama terminaba aqui.
export async function terminarEjecucionArticulo(diagnosticoId: string): Promise<void> {
  const actual = await db.progresoDiagnostico.get(diagnosticoId)
  if (!actual || actual.estado.tipo !== 'articulo') return

  // Terminado, su avance dentro del recorrido ya no sirve: el próximo
  // uso (aquí o en otra rama) empieza de cero.
  await reiniciarProgreso(raizDelProcedimiento(diagnosticoId))

  const siguiente = avanceTrasArticulo(actual)
  await db.progresoDiagnostico.put({
    ...actual,
    estado: siguiente.estado,
    articulosEjecutados: siguiente.articulosEjecutados,
    procedimientoEnCurso: null,
    actualizadoEn: new Date().toISOString(),
  })
}

// Deshace la ultima respuesta: vuelve a la pregunta que la origino.
// Sirve tanto desde una pregunta como desde un procedimiento en
// ejecucion o el resultado final (siempre que haya camino que
// deshacer).
export async function volverAtras(diagnosticoId: string): Promise<void> {
  const actual = await db.progresoDiagnostico.get(diagnosticoId)
  if (!actual || actual.camino.length === 0) return

  const siguiente = avanceAlRetroceder(actual)
  await db.progresoDiagnostico.put({
    ...actual,
    camino: siguiente.camino,
    estado: siguiente.estado,
    actualizadoEn: new Date().toISOString(),
  })
}

export async function eliminarProgresoDiagnostico(diagnosticoId: string): Promise<void> {
  await db.progresoDiagnostico.delete(diagnosticoId)
  // Y el avance del procedimiento que el recorrido tuviera a medias.
  await reiniciarProgreso(raizDelProcedimiento(diagnosticoId))
}

// Duracion en segundos de la sesion en curso, para el registro.
export function duracionSegundos(progreso: ProgresoDiagnostico, ahora = Date.now()): number {
  const inicio = Date.parse(progreso.iniciadoEn)
  if (Number.isNaN(inicio)) return 0
  return Math.max(0, Math.round((ahora - inicio) / 1000))
}
