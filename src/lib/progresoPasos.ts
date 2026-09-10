import { db, type ProgresoPasos, type ProgresoVinculo } from './db'

// Avance local de un tecnico dentro de un procedimiento: que pasos
// marco como hechos y que instrucciones marco dentro de cada paso.
// Vive solo en el dispositivo (como los recientes): cada tecnico
// lleva su propio avance y puede retomarlo si lo interrumpen a mitad
// de un mantenimiento.
//
// Consistencia entre niveles: completar todas las instrucciones deja
// el paso LISTO para completarse, pero quien decide marcarlo hecho es
// la vista (ProcedimientoVista), que tambien exige el subprocedimiento
// vinculado y la solucion de error del paso; desmarcar una instruccion
// vuelve el paso pendiente; marcar o desmarcar el paso entero arrastra
// todas sus instrucciones.

// DONDE SE GUARDA ESTE AVANCE (encargo del 2026-09-09, tarea 2).
//
// Dos sitios, porque son dos trabajos distintos:
//
// - Un id de articulo a secas: la guia ejecutandose POR SI SOLA. Es su
//   fila de `progresoPasos`, la de toda la vida.
// - `{ raizId, vinculoId }`: la guia ejecutandose COMO VINCULO dentro
//   de otra. Vive dentro de la fila de la guia principal, en
//   `vinculos[vinculoId]`, asi que pertenece a ESA ejecucion y nada
//   mas.
//
// Antes solo existia lo primero, y por eso haber completado ayer una
// guia (aqui, en otra guia o por su cuenta) daba por cumplido el
// vinculo de hoy sin que el tecnico tocara nada.
export type ClaveProgreso = string | { raizId: string; vinculoId: string }

/** El articulo cuya FILA guarda este avance. */
export function raizDe(clave: ClaveProgreso): string {
  return typeof clave === 'string' ? clave : clave.raizId
}

/** El vinculo dentro de esa fila, o null si el avance es de la fila. */
export function vinculoDe(clave: ClaveProgreso): string | null {
  return typeof clave === 'string' ? null : clave.vinculoId
}

// La forma comun de los dos: lo que se marca dentro de un
// procedimiento, se guarde donde se guarde.
export interface AvanceProcedimiento {
  pasosHechos: string[]
  instruccionesHechas?: string[]
  verificacionHecha?: number[]
  evidenciasPorPaso?: Record<string, string>
  pasosSaltados?: string[]
}

/**
 * El avance que corresponde a `clave` dentro de una fila ya leida.
 * Sirve a las live queries, que leen la fila raiz una sola vez y
 * necesitan quedarse con la parte que les toca.
 *
 * Un vinculo SIN entrada devuelve undefined, nunca la fila propia del
 * articulo vinculado: dar por cumplido lo que se hizo en otra
 * ejecucion es exactamente el defecto que cierra la tarea 2.
 */
export function avanceDe(
  fila: ProgresoPasos | undefined,
  clave: ClaveProgreso,
): AvanceProcedimiento | undefined {
  if (!fila) return undefined
  const vinculoId = vinculoDe(clave)
  if (vinculoId === null) return fila
  return fila.vinculos?.[vinculoId]
}

// GUARDA MEZCLANDO, NUNCA REEMPLAZANDO (2026-09-09).
//
// Cada escritor de este modulo armaba el registro entero a mano, asi que
// cualquier campo que no listara desaparecia: `establecerPasoHecho` y
// `alternarInstruccionHecha` no nombraban `evidenciasPorPaso`, de modo
// que marcar un paso borraba el vinculo de TODA la evidencia fotografica
// del articulo (las entradas del historial seguian ahi, pero el paso
// dejaba de encontrarlas y la siguiente foto creaba otra intervencion).
// Con el campo nuevo `pasosSaltados` el mismo descuido habria vuelto a
// morder, asi que se centraliza: quien escribe dice SOLO lo que cambia.
async function guardarProgreso(
  clave: ClaveProgreso,
  cambios: Partial<AvanceProcedimiento>,
): Promise<void> {
  const articuloId = raizDe(clave)
  const vinculoId = vinculoDe(clave)
  const actual = await db.progresoPasos.get(articuloId)
  const ahora = new Date().toISOString()

  if (vinculoId !== null) {
    const previo = actual?.vinculos?.[vinculoId]
    const vinculo: ProgresoVinculo = {
      pasosHechos: previo?.pasosHechos ?? [],
      instruccionesHechas: previo?.instruccionesHechas,
      verificacionHecha: previo?.verificacionHecha,
      evidenciasPorPaso: previo?.evidenciasPorPaso,
      pasosSaltados: previo?.pasosSaltados,
      ...cambios,
      actualizadoEn: ahora,
    }
    await db.progresoPasos.put({
      articuloId,
      ejecucionId: actual?.ejecucionId ?? nuevoIdEjecucion(),
      pasosHechos: actual?.pasosHechos ?? [],
      instruccionesHechas: actual?.instruccionesHechas ?? [],
      verificacionHecha: actual?.verificacionHecha ?? [],
      evidenciasPorPaso: actual?.evidenciasPorPaso,
      pasosSaltados: actual?.pasosSaltados,
      vinculos: { ...actual?.vinculos, [vinculoId]: vinculo },
      actualizadoEn: ahora,
    })
    return
  }

  await db.progresoPasos.put({
    articuloId,
    // La ejecucion se identifica desde la primera escritura. Las filas
    // viejas la estrenan aqui sin perder nada de lo ya marcado.
    ejecucionId: actual?.ejecucionId ?? nuevoIdEjecucion(),
    vinculos: actual?.vinculos,
    pasosHechos: actual?.pasosHechos ?? [],
    instruccionesHechas: actual?.instruccionesHechas ?? [],
    verificacionHecha: actual?.verificacionHecha ?? [],
    evidenciasPorPaso: actual?.evidenciasPorPaso,
    pasosSaltados: actual?.pasosSaltados,
    ...cambios,
    actualizadoEn: ahora,
  })
}

// PROGRESO DE PRUEBA, SEPARADO DEL DE VERDAD (encargo del 2026-09-09,
// tarea 6). La vista previa del editor ejecuta el procedimiento con una
// raiz efimera: lo que se marque ahi -y el avance de TODOS sus
// vinculos, que desde la tarea 2 vive dentro de esa misma fila- no toca
// el progreso real de ninguna guia.
const PREFIJO_VISTA_PREVIA = 'vista-previa:'

/**
 * Raiz de UNA sesion de vista previa. Lleva identificador propio, no
 * solo el id del articulo: dos pruebas del mismo articulo (cerrar y
 * volver a abrir "Probar") son dos sesiones distintas y no deben
 * heredarse el avance.
 */
export function claveVistaPrevia(articuloId: string): string {
  return `${PREFIJO_VISTA_PREVIA}${articuloId}:${crypto.randomUUID()}`
}

/** ¿Esta raiz es la de una prueba del editor y no la de un articulo? */
export function esVistaPrevia(raizId: string): boolean {
  return raizId.startsWith(PREFIJO_VISTA_PREVIA)
}

/**
 * Borra el progreso de prueba. Sin argumento borra todo el que haya
 * quedado suelto (una vista previa que se cerro con un recargo, no con
 * el boton); con `salvo` conserva la sesion en curso.
 */
export async function limpiarProgresoVistaPrevia(salvo?: string): Promise<void> {
  const claves = await db.progresoPasos
    .where('articuloId')
    .startsWith(PREFIJO_VISTA_PREVIA)
    .primaryKeys()
  const aBorrar = claves.filter((clave) => clave !== salvo)
  if (aBorrar.length > 0) await db.progresoPasos.bulkDelete(aBorrar)
}

/** Identificador de una ejecucion. Local y efimero, como el avance. */
export function nuevoIdEjecucion(): string {
  return crypto.randomUUID()
}

/**
 * Lee el avance guardado para `clave` sin live query, para decidir una
 * escritura sin depender de cuando refresque la interfaz.
 */
export async function leerAvance(clave: ClaveProgreso): Promise<AvanceProcedimiento | undefined> {
  return avanceDe(await db.progresoPasos.get(raizDe(clave)), clave)
}

/**
 * El identificador de la ejecucion abierta de un articulo, o null si no
 * hay ninguna empezada. Lo usan los botones de la ficha para distinguir
 * continuar de empezar de nuevo.
 */
export async function ejecucionAbierta(articuloId: string): Promise<string | null> {
  return (await db.progresoPasos.get(articuloId))?.ejecucionId ?? null
}

/**
 * Estrena una ejecucion del articulo: borra la fila entera (avance
 * propio Y avance de sus vinculos) y devuelve el identificador nuevo,
 * que nacera con la primera escritura.
 *
 * Reiniciar la guia principal reinicia sus dependencias DENTRO de esa
 * ejecucion, no en la ficha de cada guia vinculada: el avance que esa
 * guia lleve por su cuenta no es asunto de esta ejecucion.
 */
export async function empezarEjecucion(articuloId: string): Promise<string> {
  await db.progresoPasos.delete(articuloId)
  const ejecucionId = nuevoIdEjecucion()
  await db.progresoPasos.put({
    articuloId,
    ejecucionId,
    pasosHechos: [],
    instruccionesHechas: [],
    verificacionHecha: [],
    vinculos: {},
    actualizadoEn: new Date().toISOString(),
  })
  return ejecucionId
}

// Marca o desmarca un paso completo, arrastrando sus tareas (los
// bloques con casilla). `tareaIds` son los ids de esos bloques.
export async function establecerPasoHecho(
  clave: ClaveProgreso,
  pasoId: string,
  hecho: boolean,
  tareaIds: string[] = [],
): Promise<void> {
  const actual = await leerAvance(clave)
  const pasos = new Set(actual?.pasosHechos ?? [])
  const instrucciones = new Set(actual?.instruccionesHechas ?? [])

  if (hecho) {
    pasos.add(pasoId)
    for (const tareaId of tareaIds) instrucciones.add(tareaId)
  } else {
    pasos.delete(pasoId)
    for (const tareaId of tareaIds) instrucciones.delete(tareaId)
  }

  // Un paso que se completa deja de estar saltado: son estados
  // excluyentes, y el indice tiene que decir el ultimo que vale.
  const saltados = (actual?.pasosSaltados ?? []).filter((id) => id !== pasoId)

  await guardarProgreso(clave, {
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    pasosSaltados: saltados,
  })
}

/**
 * Deja constancia de que el tecnico SALTO este paso a proposito
 * (hallazgo H07). Es un acto explicito, no una deduccion: hasta ahora
 * el indice llamaba "saltado" a cualquier paso sin hacer que quedara
 * por detras del actual, asi que mirar el paso siguiente con la flecha
 * bastaba para marcar el anterior como saltado. Navegar es consultar;
 * saltar es decidir seguir sin hacerlo.
 */
export async function marcarPasoSaltado(clave: ClaveProgreso, pasoId: string): Promise<void> {
  const actual = await leerAvance(clave)
  const saltados = new Set(actual?.pasosSaltados ?? [])
  saltados.add(pasoId)
  await guardarProgreso(clave, { pasosSaltados: [...saltados] })
}

/** Retira la marca de saltado (el tecnico vuelve y lo retoma). */
export async function quitarPasoSaltado(clave: ClaveProgreso, pasoId: string): Promise<void> {
  const actual = await leerAvance(clave)
  if (!actual?.pasosSaltados?.includes(pasoId)) return
  await guardarProgreso(clave, {
    pasosSaltados: actual.pasosSaltados.filter((id) => id !== pasoId),
  })
}

// Alterna una tarea (bloque con casilla) por su id. Devuelve true si
// con este cambio TODAS las tareas del paso quedaron marcadas: es la
// señal para que la vista intente completar el paso (que ademas
// revisara el subprocedimiento y la solucion antes de avanzar). Aqui NO
// se marca el paso como hecho al completar las tareas, para no saltarse
// el resto del contenido del paso; pero si al desmarcar una tarea el
// paso deja de estar completo, se retira de los hechos (desmarcar
// vuelve el paso pendiente). `tareaIds` son todos los ids de tareas del
// paso, para saber si quedaron todas marcadas.
export async function alternarInstruccionHecha(
  clave: ClaveProgreso,
  pasoId: string,
  tareaId: string,
  tareaIds: string[],
): Promise<boolean> {
  const actual = await leerAvance(clave)
  const pasos = new Set(actual?.pasosHechos ?? [])
  const instrucciones = new Set(actual?.instruccionesHechas ?? [])

  if (instrucciones.has(tareaId)) {
    instrucciones.delete(tareaId)
  } else {
    instrucciones.add(tareaId)
  }

  const completo = tareaIds.length > 0 && tareaIds.every((id) => instrucciones.has(id))
  if (!completo) {
    pasos.delete(pasoId)
  }

  // Tocar una tarea de un paso saltado es retomarlo.
  const saltados = (actual?.pasosSaltados ?? []).filter((id) => id !== pasoId)

  await guardarProgreso(clave, {
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    pasosSaltados: saltados,
  })
  return completo
}

/**
 * Borra el avance. Con un id de articulo borra su fila entera (lo suyo
 * y el de sus vinculos, que son de esa ejecucion). Con un vinculo borra
 * SOLO esa entrada: el resto de la ejecucion sigue intacto, y el avance
 * que esa guia lleve por su cuenta ni se toca.
 */
export async function reiniciarProgreso(clave: ClaveProgreso): Promise<void> {
  const vinculoId = vinculoDe(clave)
  if (vinculoId === null) {
    await db.progresoPasos.delete(raizDe(clave))
    return
  }
  const articuloId = raizDe(clave)
  const actual = await db.progresoPasos.get(articuloId)
  if (!actual?.vinculos?.[vinculoId]) return
  const vinculos = { ...actual.vinculos }
  delete vinculos[vinculoId]
  await db.progresoPasos.put({ ...actual, vinculos, actualizadoEn: new Date().toISOString() })
}

// Recuerda con que entrada de historial quedo asociada la evidencia
// fotografica de un paso (tarea 79): la primera vez que el tecnico
// adjunta algo para ese paso, no en cada revisita (si no, cada vez que
// se reabre el paso se crearia una intervencion nueva y la evidencia
// quedaria repartida en varias entradas del historial).
export async function registrarEvidenciaPaso(
  clave: ClaveProgreso,
  pasoId: string,
  entradaId: string,
): Promise<void> {
  const actual = await leerAvance(clave)
  await guardarProgreso(clave, {
    evidenciasPorPaso: { ...actual?.evidenciasPorPaso, [pasoId]: entradaId },
  })
}

// Cuantos de los pasos actuales estan hechos. Se cruza contra los
// ids vigentes porque el procedimiento pudo editarse despues de
// marcar avance (los pasos eliminados no deben contar).
export function contarHechos(pasosHechos: string[], idsVigentes: string[]): number {
  const hechos = new Set(pasosHechos)
  return idsVigentes.filter((id) => hechos.has(id)).length
}

// Cuantas de las tareas dadas (por id) estan marcadas.
export function contarInstruccionesHechas(
  instruccionesHechas: string[] | undefined,
  tareaIds: string[],
): number {
  const hechas = new Set(instruccionesHechas ?? [])
  return tareaIds.filter((id) => hechas.has(id)).length
}

// Alterna una casilla de "Verificacion final" (por indice, igual que
// las instrucciones de un paso: no tienen id propio).
export async function alternarVerificacionFinal(
  clave: ClaveProgreso,
  indice: number,
): Promise<void> {
  const actual = await leerAvance(clave)
  const marcadas = new Set(actual?.verificacionHecha ?? [])
  if (marcadas.has(indice)) {
    marcadas.delete(indice)
  } else {
    marcadas.add(indice)
  }
  await guardarProgreso(clave, { verificacionHecha: [...marcadas] })
}

// La verificacion final cuenta como completa cuando no hay items (no
// se definio) o cuando todos estan marcados.
export function verificacionFinalCompleta(
  verificacionHecha: number[] | undefined,
  total: number,
): boolean {
  if (total === 0) return true
  const marcadas = new Set(verificacionHecha ?? [])
  return Array.from({ length: total }, (_, i) => i).every((i) => marcadas.has(i))
}
