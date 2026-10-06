import type { BloquePaso, OpcionDecision, PasoProcedimiento, Procedimiento } from './db'
import { esDecisionConOpciones, pasoTieneContenido, tareasDe } from './procedimiento'

// LA RUTA DE UNA GUÍA CON DECISIONES (tarea 302).
//
// Una guía sigue siendo una lista ordenada de pasos. Lo que cambia es que
// una decisión con opciones ("¿Qué versión de Outlook estás utilizando?")
// puede llevar a otro paso posterior, y que un paso puede decir dónde
// sigue al terminar (`alTerminar`), que es lo que deja que dos caminos se
// junten otra vez en un paso común sin duplicarlo:
//
//   1 ¿Qué Outlook tienes? ── Clásico ──> 2 (al terminar, sigue en 4)
//                         └─ Nuevo ────> 3
//   4 Guardar y comprobar el .pst  <── los dos caminos llegan aquí
//
// La RUTA es la lista de pasos que se recorren de verdad con las respuestas
// dadas: el primero, y después el que toque según cada paso y cada
// respuesta. Si la ruta llega a una decisión sin responder, se detiene ahí
// (`pendiente`): lo que viene después depende de la respuesta y no se
// enseña ni se cuenta. Toda la ejecución cuenta sobre la ruta (el contador,
// el índice, terminar, "Sin terminar"), así que los pasos de los caminos
// no elegidos no existen para quien ejecuta.
//
// SOLO SE SALTA HACIA ADELANTE. Un destino que vuelve atrás o al mismo
// paso repetiría el recorrido sin fin: el editor no deja guardarlo y, si
// llegara de todos modos (un dato a medias), la ruta lo ignora y sigue por
// el paso de abajo. Así la ruta siempre termina y nunca repite un paso.
//
// Lógica pura, sin React ni base de datos, para probarla aislada.

/** La opción elegida en cada decisión de esta ejecución: id de la tarea de decisión -> id de la opción. */
export type Elecciones = Readonly<Record<string, string>>

/** Una decisión de la ruta que todavía no tiene respuesta. */
export interface DecisionPendiente {
  paso: PasoProcedimiento
  decision: BloquePaso
}

export interface Ruta {
  /** Los pasos que se recorren, en orden. */
  pasos: PasoProcedimiento[]
  /** La decisión sin responder donde se detiene la ruta, o null si llega al final. */
  pendiente: DecisionPendiente | null
}

/**
 * La decisión que decide por dónde sigue la ruta después de este paso: su
 * ÚLTIMA tarea de decisión con opciones. El editor exige que sea la última
 * acción del paso (y que haya una sola); si un dato trae otra cosa, manda
 * la última, que es la más cercana al final del paso.
 */
export function decisionDeRuta(paso: PasoProcedimiento): BloquePaso | null {
  const decisiones = tareasDe(paso.bloques).filter(esDecisionConOpciones)
  return decisiones[decisiones.length - 1] ?? null
}

/** La opción elegida de una decisión, o null si no se respondió (o la respuesta ya no existe). */
export function opcionElegida(decision: BloquePaso, elecciones: Elecciones | undefined): OpcionDecision | null {
  const elegida = elecciones?.[decision.id]
  if (!elegida) return null
  return decision.opciones?.find((opcion) => opcion.id === elegida) ?? null
}

// Hacia dónde sigue la ruta desde el paso `indice`: el índice del paso
// siguiente, 'fin' si la ruta termina aquí, o 'pendiente' si depende de
// una decisión sin responder.
type Siguiente = number | 'fin' | 'pendiente'

function siguienteDesde(
  pasos: PasoProcedimiento[],
  indice: number,
  posicion: ReadonlyMap<string, number>,
  elecciones: Elecciones | undefined,
): Siguiente {
  const paso = pasos[indice]
  // Un salto solo vale hacia un paso que exista y venga DESPUÉS: si no,
  // se sigue por el de abajo (ver la cabecera).
  const haciaAdelante = (pasoId: string): number | null => {
    const destino = posicion.get(pasoId)
    return destino !== undefined && destino > indice ? destino : null
  }

  const decision = decisionDeRuta(paso)
  if (decision) {
    const opcion = opcionElegida(decision, elecciones)
    if (!opcion) return 'pendiente'
    if (opcion.destino.tipo === 'fin') return 'fin'
    if (opcion.destino.tipo === 'paso') {
      const destino = haciaAdelante(opcion.destino.pasoId)
      if (destino !== null) return destino
    }
    // 'continuar' y 'guia' (que se hace en el flujo y vuelve) siguen la
    // continuación propia del paso, como si no hubiera pregunta.
  }

  if (paso.alTerminar?.tipo === 'fin') return 'fin'
  if (paso.alTerminar?.tipo === 'paso') {
    const destino = haciaAdelante(paso.alTerminar.pasoId)
    if (destino !== null) return destino
  }
  return indice + 1 < pasos.length ? indice + 1 : 'fin'
}

// Recorre la guía desde el paso `inicio` con las respuestas dadas.
function recorrer(pasos: PasoProcedimiento[], inicio: number, elecciones: Elecciones | undefined): Ruta {
  const posicion = new Map(pasos.map((paso, i) => [paso.id, i]))
  const recorrido: PasoProcedimiento[] = []
  let indice = inicio
  // Cada salto va hacia adelante, así que el bucle da como mucho una
  // vuelta por paso.
  while (indice >= 0 && indice < pasos.length) {
    const paso = pasos[indice]
    recorrido.push(paso)
    const siguiente = siguienteDesde(pasos, indice, posicion, elecciones)
    if (siguiente === 'fin') break
    if (siguiente === 'pendiente') {
      return { pasos: recorrido, pendiente: { paso, decision: decisionDeRuta(paso) as BloquePaso } }
    }
    indice = siguiente
  }
  return { pasos: recorrido, pendiente: null }
}

/** La ruta de la guía con las respuestas dadas en esta ejecución. Sin decisiones con opciones, son todos sus pasos. */
export function rutaDe(procedimiento: Pick<Procedimiento, 'pasos'>, elecciones?: Elecciones): Ruta {
  return recorrer(procedimiento.pasos, 0, elecciones)
}

/** Los ids de los pasos de la ruta, en orden. */
export function idsDeRuta(procedimiento: Pick<Procedimiento, 'pasos'>, elecciones?: Elecciones): string[] {
  return rutaDe(procedimiento, elecciones).pasos.map((paso) => paso.id)
}

/**
 * Los pasos marcados como hechos que valen PARA ESTA RUTA. El paso de una
 * decisión sin responder nunca cuenta: su respuesta es la que dice por
 * dónde se sigue, así que sin ella el paso no está terminado (aunque un
 * dato viejo lo tenga marcado). Los pasos fuera de la ruta pueden quedar
 * en el conjunto: quien pregunta lo hace por pasos de la ruta.
 */
export function hechosDeRuta(ruta: Ruta, pasosHechos: readonly string[] | undefined): Set<string> {
  const hechos = new Set(pasosHechos ?? [])
  if (ruta.pendiente) hechos.delete(ruta.pendiente.paso.id)
  return hechos
}

/** Cuántos pasos recorre la ruta entera: el camino más corto y el más largo de los que siguen abiertos. */
export interface LargoDeRuta {
  minimo: number
  maximo: number
}

/**
 * EL LARGO DE LA RUTA, AUNQUE FALTE RESPONDER. Con las respuestas dadas,
 * cuántos pasos recorre la guía entera; si en el camino queda una decisión
 * sin responder, se miran todas sus opciones y se da el camino más corto y
 * el más largo. Cuando coinciden, el total se sabe antes de responder: en la
 * copia de seguridad de Outlook los dos caminos tienen cinco pasos, así que
 * la guía es de cinco pasos se elija lo que se elija.
 */
export function largoDeLaRuta(procedimiento: Pick<Procedimiento, 'pasos'>, elecciones?: Elecciones): LargoDeRuta {
  const { pasos } = procedimiento
  if (pasos.length === 0) return { minimo: 0, maximo: 0 }
  const posicion = new Map(pasos.map((paso, i) => [paso.id, i]))
  // De atrás hacia adelante: todo salto va hacia adelante, así que lo que
  // sigue a un paso ya está medido cuando se llega a él.
  const largos: LargoDeRuta[] = []
  for (let i = pasos.length - 1; i >= 0; i--) {
    const decision = decisionDeRuta(pasos[i])
    const abierta = decision !== null && opcionElegida(decision, elecciones) === null
    // Una decisión sin responder abre un camino por opción.
    const respuestas = abierta
      ? (decision.opciones ?? []).map((opcion) => ({ ...elecciones, [decision.id]: opcion.id }))
      : [elecciones]
    const restos = respuestas.map((respuesta) => {
      const siguiente = siguienteDesde(pasos, i, posicion, respuesta)
      return typeof siguiente === 'number' ? largos[siguiente] : { minimo: 0, maximo: 0 }
    })
    largos[i] = {
      minimo: 1 + Math.min(...restos.map((resto) => resto.minimo)),
      maximo: 1 + Math.max(...restos.map((resto) => resto.maximo)),
    }
  }
  return largos[0]
}

/** El avance de una ejecución contado sobre su ruta. */
export interface AvanceDeLaRuta {
  ruta: Ruta
  /** Pasos de la ruta hechos. */
  hechos: number
  /**
   * Los pasos de la ruta entera. Con una decisión sin responder, el total
   * se sabe si todos sus caminos miden lo mismo; si no, son los pasos que
   * ya se conocen (y `totalAbierto`).
   */
  total: number
  /**
   * ¿El total todavía no se sabe? Solo con una decisión sin responder cuyos
   * caminos no miden lo mismo: quien lo pinta no dice "de M".
   */
  totalAbierto: boolean
  /** ¿Todos los pasos de la ruta hechos y ninguna decisión pendiente? (Las comprobaciones finales van aparte.) */
  pasosListos: boolean
}

export function avanceDeLaRuta(
  procedimiento: Pick<Procedimiento, 'pasos'>,
  avance: { pasosHechos?: string[]; elecciones?: Elecciones } | null | undefined,
): AvanceDeLaRuta {
  const ruta = rutaDe(procedimiento, avance?.elecciones)
  const hechosSet = hechosDeRuta(ruta, avance?.pasosHechos)
  const hechos = ruta.pasos.filter((paso) => hechosSet.has(paso.id)).length
  const largo = ruta.pendiente ? largoDeLaRuta(procedimiento, avance?.elecciones) : null
  const totalAbierto = largo !== null && largo.minimo !== largo.maximo
  return {
    ruta,
    hechos,
    total: largo !== null && !totalAbierto ? largo.minimo : ruta.pasos.length,
    totalAbierto,
    pasosListos: ruta.pendiente === null && hechos === ruta.pasos.length,
  }
}

/**
 * La guía que abre la respuesta elegida en la decisión de este paso, o
 * null: sin decisión con opciones, sin responder o con otro destino. Se
 * hace en el flujo, justo después de la decisión, y el paso no se cierra
 * hasta terminarla.
 */
export function guiaDeLaRespuesta(
  paso: PasoProcedimiento,
  elecciones: Elecciones | undefined,
): { articuloId: string; titulo: string } | null {
  const decision = decisionDeRuta(paso)
  const opcion = decision ? opcionElegida(decision, elecciones) : null
  return opcion?.destino.tipo === 'guia' ? { articuloId: opcion.destino.articuloId, titulo: opcion.destino.titulo } : null
}

/** Las guías que puede abrir alguna respuesta de las decisiones de este paso. */
export function guiasDeLasOpciones(paso: PasoProcedimiento): string[] {
  return paso.bloques.flatMap((bloque) =>
    (bloque.opciones ?? []).flatMap((opcion) => (opcion.destino.tipo === 'guia' ? [opcion.destino.articuloId] : [])),
  )
}

/**
 * EL CAMINO DE UNA RESPUESTA, para enseñarlo en el editor: los pasos que se
 * recorren DESPUÉS de la decisión si se elige `opcionId`, hasta el final o
 * hasta la siguiente decisión (que todavía no tiene respuesta). Vacío si la
 * opción termina la guía ahí mismo o si el paso no existe.
 */
export function caminoDeOpcion(
  procedimiento: Pick<Procedimiento, 'pasos'>,
  pasoId: string,
  decisionId: string,
  opcionId: string,
): Ruta {
  const inicio = procedimiento.pasos.findIndex((paso) => paso.id === pasoId)
  if (inicio < 0) return { pasos: [], pendiente: null }
  const ruta = recorrer(procedimiento.pasos, inicio, { [decisionId]: opcionId })
  return { pasos: ruta.pasos.slice(1), pendiente: ruta.pendiente }
}

/**
 * Los pasos por los que pasa ALGUNA ruta, sea cual sea la respuesta. Un
 * paso fuera de este conjunto no lo verá nadie: el editor lo señala.
 */
export function pasosAlcanzables(procedimiento: Pick<Procedimiento, 'pasos'>): Set<string> {
  const { pasos } = procedimiento
  const posicion = new Map(pasos.map((paso, i) => [paso.id, i]))
  const alcanzados = new Set<number>()
  const porVisitar = pasos.length > 0 ? [0] : []
  while (porVisitar.length > 0) {
    const indice = porVisitar.pop() as number
    if (alcanzados.has(indice)) continue
    alcanzados.add(indice)
    const decision = decisionDeRuta(pasos[indice])
    // Cada respuesta posible de la decisión del paso es un camino.
    const respuestas = decision ? (decision.opciones ?? []).map((opcion) => ({ [decision.id]: opcion.id })) : [{}]
    for (const elecciones of respuestas) {
      const siguiente = siguienteDesde(pasos, indice, posicion, elecciones)
      if (typeof siguiente === 'number') porVisitar.push(siguiente)
    }
  }
  return new Set([...alcanzados].map((indice) => pasos[indice].id))
}

// ---------------------------------------------------------------------
// LO QUE EL EDITOR NO DEJA GUARDAR
// ---------------------------------------------------------------------

/** Un problema de las decisiones o de los caminos de una guía, dicho para quien la escribe. */
export interface ProblemaRuta {
  pasoId: string
  /** La decisión afectada, si el problema es de una decisión o de una de sus opciones. */
  decisionId: string | null
  opcionId: string | null
  mensaje: string
  /** true: no deja guardar. false: se avisa, pero se puede guardar. */
  bloquea: boolean
}

// Cómo se nombra una opción en un mensaje: por su título, o por su número
// si todavía no tiene.
function nombreDeOpcion(opcion: OpcionDecision, numero: number): string {
  return opcion.titulo.trim() ? `«${opcion.titulo.trim()}»` : `La opción ${numero}`
}

/**
 * Todo lo que impide guardar (o merece un aviso) en las decisiones con
 * opciones y en los caminos de la guía. Las decisiones de Sí/No de antes no
 * se revisan aquí: siguen como estaban, sin reglas nuevas.
 *
 * Se revisan los pasos TAL COMO ESTÁN EN EL EDITOR (sin limpiar), para que
 * los números de paso de los mensajes sean los que ve el autor.
 *
 * Bloquean: la decisión sin pregunta, con menos de dos opciones, con una
 * opción sin título o repetida, una opción sin destino o con un destino que
 * no existe, está vacío o no está después (volver atrás no terminaría
 * nunca), la decisión que no es la última acción de su paso, y el "al
 * terminar" de un paso que apunta a un paso así.
 *
 * Avisan, sin bloquear: un paso por el que no pasa ninguna ruta.
 */
export function problemasDeRutas(procedimiento: Pick<Procedimiento, 'pasos'>): ProblemaRuta[] {
  const { pasos } = procedimiento
  const posicion = new Map(pasos.map((paso, i) => [paso.id, i]))
  const problemas: ProblemaRuta[] = []

  // ¿El destino `pasoId`, pedido desde el paso `indice`, es válido? Un
  // mensaje si no lo es.
  const problemaDeSalto = (pasoId: string, indice: number, quien: string): string | null => {
    if (!pasoId) return `${quien}: elige a qué paso lleva.`
    const destino = posicion.get(pasoId)
    if (destino === undefined) return `${quien} lleva a un paso que ya no existe. Elige otro.`
    if (destino <= indice) {
      return `${quien} solo puede llevar a un paso posterior: volver a uno anterior repetiría el recorrido sin fin.`
    }
    // Un paso vacío se descarta al guardar: el salto quedaría apuntando a
    // nada.
    if (!pasoTieneContenido(pasos[destino])) {
      return `${quien} lleva al paso ${destino + 1}, que está vacío. Escríbelo o elige otro.`
    }
    return null
  }

  pasos.forEach((paso, indice) => {
    const tareas = tareasDe(paso.bloques)
    const conOpciones = tareas.filter(esDecisionConOpciones)

    for (const decision of conOpciones) {
      const base = { pasoId: paso.id, decisionId: decision.id, bloquea: true }
      if (decision.texto.trim() === '') {
        problemas.push({ ...base, opcionId: null, mensaje: 'Escribe la pregunta de la decisión.' })
      }
      // Lo que va después depende de la respuesta, así que una acción
      // detrás de la decisión se haría o no según el camino.
      if (tareas[tareas.length - 1]?.id !== decision.id) {
        problemas.push({
          ...base,
          opcionId: null,
          mensaje:
            'La decisión tiene que ser la última acción del paso: lo que viene después depende de la respuesta. Muévela al final o lleva esas acciones al paso siguiente.',
        })
      }
      const opciones = decision.opciones ?? []
      if (opciones.length < 2) {
        problemas.push({ ...base, opcionId: null, mensaje: 'Una decisión necesita al menos dos opciones.' })
      }
      const titulos = new Set<string>()
      opciones.forEach((opcion, i) => {
        const nombre = nombreDeOpcion(opcion, i + 1)
        const deOpcion = { ...base, opcionId: opcion.id }
        const titulo = opcion.titulo.trim().toLocaleLowerCase('es')
        if (titulo === '') {
          problemas.push({ ...deOpcion, mensaje: `La opción ${i + 1} necesita un título.` })
        } else if (titulos.has(titulo)) {
          problemas.push({ ...deOpcion, mensaje: `Hay dos opciones que se llaman ${nombre}: quien ejecuta no podría distinguirlas.` })
        }
        titulos.add(titulo)
        if (opcion.destino.tipo === 'paso') {
          const mensaje = problemaDeSalto(opcion.destino.pasoId, indice, nombre)
          if (mensaje) problemas.push({ ...deOpcion, mensaje })
        }
        if (opcion.destino.tipo === 'guia' && !opcion.destino.articuloId) {
          problemas.push({ ...deOpcion, mensaje: `${nombre}: elige qué guía abre.` })
        }
      })
    }

    if (paso.alTerminar?.tipo === 'paso') {
      const mensaje = problemaDeSalto(paso.alTerminar.pasoId, indice, `Al terminar el paso ${indice + 1}`)
      if (mensaje) problemas.push({ pasoId: paso.id, decisionId: null, opcionId: null, mensaje, bloquea: true })
    }
  })

  // Solo si los caminos son válidos tiene sentido decir por dónde pasan.
  if (problemas.every((problema) => !problema.bloquea)) {
    const alcanzables = pasosAlcanzables(procedimiento)
    pasos.forEach((paso, indice) => {
      if (alcanzables.has(paso.id)) return
      problemas.push({
        pasoId: paso.id,
        decisionId: null,
        opcionId: null,
        mensaje: `Ninguna ruta pasa por el paso ${indice + 1}: nadie llegará a él. Revisa a dónde llevan las opciones y dónde sigue cada paso.`,
        bloquea: false,
      })
    })
  }

  return problemas
}

// ---------------------------------------------------------------------
// RESPONDER (O CAMBIAR LA RESPUESTA DE) UNA DECISIÓN
// ---------------------------------------------------------------------

/** Lo que una respuesta cambia en el avance de la ejecución. */
export interface AvanceDeRuta {
  pasosHechos: string[]
  instruccionesHechas: string[]
  pasosSaltados: string[]
  elecciones: Record<string, string>
}

export interface EleccionAplicada {
  avance: AvanceDeRuta
  /**
   * Las guías reutilizadas cuyo avance dentro de esta ejecución hay que
   * borrar, porque quedaron fuera de la ruta al cambiar la respuesta.
   */
  guiasFuera: string[]
  /** ¿Cambió una respuesta que ya estaba dada? */
  cambio: boolean
}

/**
 * Las guías que un paso usa: la del paso, las de sus tareas, la de su
 * contingencia, la del "No" de sus decisiones de Sí/No y, si se piden
 * (`conOpciones`), las que abren las respuestas de sus decisiones.
 */
export function guiasDePaso(paso: PasoProcedimiento, conOpciones = true): string[] {
  const guias = new Set<string>()
  if (paso.subArticuloId) guias.add(paso.subArticuloId)
  if (paso.solucionArticuloId) guias.add(paso.solucionArticuloId)
  for (const bloque of paso.bloques) {
    if (bloque.guiaArticuloId) guias.add(bloque.guiaArticuloId)
    if (bloque.decisionArticuloId) guias.add(bloque.decisionArticuloId)
  }
  if (conOpciones) for (const guia of guiasDeLasOpciones(paso)) guias.add(guia)
  return [...guias]
}

/**
 * RESPONDER UNA DECISIÓN CON OPCIONES.
 *
 * Responder la marca como hecha y anota la opción. CAMBIAR una respuesta
 * que ya estaba dada recalcula la ruta y reinicia todo lo que venía
 * DESPUÉS de la decisión: los pasos, tareas, saltos y respuestas de más
 * adelante, y el avance de las guías que solo se usaban ahí. Es lo que
 * evita los pasos "fantasma": nada de lo hecho siguiendo la respuesta
 * anterior queda contando en la nueva ruta (ni reaparece si se vuelve a
 * ella). Lo de antes de la decisión no se toca: es el mismo en las dos
 * rutas.
 */
export function aplicarEleccion(
  procedimiento: Pick<Procedimiento, 'pasos'>,
  avance:
    | {
        pasosHechos?: string[]
        instruccionesHechas?: string[]
        pasosSaltados?: string[]
        elecciones?: Record<string, string>
      }
    | undefined,
  { decisionId, opcionId }: { decisionId: string; opcionId: string },
): EleccionAplicada {
  const anterior = avance?.elecciones?.[decisionId]
  const elecciones = { ...avance?.elecciones, [decisionId]: opcionId }
  const instrucciones = new Set(avance?.instruccionesHechas ?? [])
  instrucciones.add(decisionId)
  const sinCambio: EleccionAplicada = {
    avance: {
      pasosHechos: [...(avance?.pasosHechos ?? [])],
      instruccionesHechas: [...instrucciones],
      pasosSaltados: [...(avance?.pasosSaltados ?? [])],
      elecciones,
    },
    guiasFuera: [],
    cambio: false,
  }
  if (anterior === undefined || anterior === opcionId) return sinCambio

  // Lo que se conserva: la ruta nueva HASTA el paso de la decisión,
  // incluido. Si el paso no está en la ruta (no debería: solo se responde
  // lo que se está viendo), no hay un "después" que reiniciar.
  const ruta = rutaDe(procedimiento, elecciones).pasos
  const posicionDecision = ruta.findIndex((paso) => paso.bloques.some((bloque) => bloque.id === decisionId))
  if (posicionDecision < 0) return { ...sinCambio, cambio: true }
  const conservados = ruta.slice(0, posicionDecision + 1)
  const idsConservados = new Set(conservados.map((paso) => paso.id))
  const bloquesConservados = new Set(conservados.flatMap((paso) => paso.bloques.map((bloque) => bloque.id)))

  // Las guías que usaban los pasos que se reinician y las que abren las
  // respuestas de esta decisión (la anterior era de ese camino; la nueva
  // empieza de cero), salvo las que lo conservado usa por su cuenta: esas
  // ya estaban hechas antes de la pregunta.
  const guiasFuera = new Set(
    procedimiento.pasos.filter((paso) => !idsConservados.has(paso.id)).flatMap((paso) => guiasDePaso(paso)),
  )
  const decision = conservados[posicionDecision].bloques.find((bloque) => bloque.id === decisionId)
  for (const opcion of decision?.opciones ?? []) {
    if ((opcion.id === anterior || opcion.id === opcionId) && opcion.destino.tipo === 'guia') {
      guiasFuera.add(opcion.destino.articuloId)
    }
  }
  for (const guia of conservados.flatMap((paso) => guiasDePaso(paso, false))) guiasFuera.delete(guia)

  return {
    avance: {
      pasosHechos: (avance?.pasosHechos ?? []).filter((id) => idsConservados.has(id)),
      instruccionesHechas: [...instrucciones].filter((id) => bloquesConservados.has(id)),
      pasosSaltados: (avance?.pasosSaltados ?? []).filter((id) => idsConservados.has(id)),
      elecciones: Object.fromEntries(
        Object.entries(elecciones).filter(([idDecision]) => bloquesConservados.has(idDecision)),
      ),
    },
    guiasFuera: [...guiasFuera],
    cambio: true,
  }
}
