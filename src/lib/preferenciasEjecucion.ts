import { db, type PreferenciasTecnico } from './db'

// PREFERENCIAS DE EJECUCION DEL TECNICO (tarea 217, hallazgos G-16 a
// G-19 de la auditoria visual de Guias).
//
// El informe lo dice sin rodeos: la mejor pantalla de ejecucion de la
// app era un modo opcional, escondido tras un boton secundario, que se
// perdia al salir. Aqui se invierte la relacion. `foco` (una tarea a la
// vez) es la ejecucion por defecto; `pasoEntero` (la vista de paso
// completo) pasa a ser la excepcion, y la eleccion se GUARDA: el avance
// ya sobrevivia a una interrupcion y la preferencia no, que era lo
// unico del flujo sin persistir (G-17).
//
// Vive en `db.preferenciasTecnico`, local a este dispositivo y sin
// sincronizar. El informe pide "por usuario, no por sesion"; en este
// equipo cada tecnico trabaja desde su propio telefono, asi que
// guardarlo por dispositivo es lo mismo en la practica y sigue la
// convencion ya establecida para `favoritos` y `recientes` (decision
// D1). Si algun dia se comparte un telefono, esta es la funcion que
// habria que atar al perfil de la sesion, y solo esta.

export type ModoEjecucion = PreferenciasTecnico['modoEjecucion']

// Fila unica de la tabla. Mismo criterio que `ID_BLOQUEO_APP`.
export const ID_PREFERENCIAS_TECNICO = 'tecnico'

// La ejecucion por defecto es el foco. Un tecnico que nunca toque nada
// trabaja con una tarea a la vez, que es justo lo que el informe pide:
// el sistema lleva el buen comportamiento por defecto en vez de
// pedirle una decision de pie frente a un rack.
export const MODO_EJECUCION_POR_DEFECTO: ModoEjecucion = 'foco'

// Tolera una fila ausente o con un valor que no reconocemos (una
// version anterior, un dato a medio migrar): en los dos casos vale el
// defecto, y la ejecucion nunca se queda sin modo.
export function normalizarModoEjecucion(valor: unknown): ModoEjecucion {
  return valor === 'pasoEntero' || valor === 'foco' ? valor : MODO_EJECUCION_POR_DEFECTO
}

export async function leerModoEjecucion(): Promise<ModoEjecucion> {
  const fila = await db.preferenciasTecnico.get(ID_PREFERENCIAS_TECNICO)
  return normalizarModoEjecucion(fila?.modoEjecucion)
}

export async function guardarModoEjecucion(modo: ModoEjecucion): Promise<void> {
  await db.preferenciasTecnico.put({
    id: ID_PREFERENCIAS_TECNICO,
    modoEjecucion: modo,
    actualizadoEn: new Date().toISOString(),
  })
}
