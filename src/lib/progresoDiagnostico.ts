import { db, type NodoDiagnostico, type OpcionDiagnostico, type ProgresoDiagnostico } from './db'
import { avanceAlResponder, avanceAlRetroceder, avanceTrasArticulo } from './diagnostico'
import { reiniciarProgreso } from './progresoPasos'

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

  if (opcion.articuloId) {
    // El procedimiento arranca SIEMPRE de cero dentro del diagnostico:
    // un avance viejo (por ejemplo, de haberlo ejecutado suelto la
    // semana pasada) haria que el asistente lo diera por completado y
    // se lo saltara sin ejecutarlo.
    await reiniciarProgreso(opcion.articuloId)
  }

  await db.progresoDiagnostico.put({
    ...actual,
    camino: siguiente.camino,
    estado: siguiente.estado,
    actualizadoEn: new Date().toISOString(),
  })
}

// El procedimiento vinculado termino: se anota como ejecutado, su
// avance local se reinicia (queda listo para el proximo uso, igual
// que las soluciones de error de los pasos) y el diagnostico continua
// solo desde la siguiente pregunta, o pasa al resultado final si la
// rama terminaba aqui.
export async function terminarEjecucionArticulo(diagnosticoId: string): Promise<void> {
  const actual = await db.progresoDiagnostico.get(diagnosticoId)
  if (!actual || actual.estado.tipo !== 'articulo') return

  await reiniciarProgreso(actual.estado.articuloId)

  const siguiente = avanceTrasArticulo(actual)
  await db.progresoDiagnostico.put({
    ...actual,
    estado: siguiente.estado,
    articulosEjecutados: siguiente.articulosEjecutados,
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
}

// Duracion en segundos de la sesion en curso, para el registro.
export function duracionSegundos(progreso: ProgresoDiagnostico, ahora = Date.now()): number {
  const inicio = Date.parse(progreso.iniciadoEn)
  if (Number.isNaN(inicio)) return 0
  return Math.max(0, Math.round((ahora - inicio) / 1000))
}
