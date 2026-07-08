import type { EstadoDiagnostico, NodoDiagnostico, OpcionDiagnostico, PasoCamino } from './db'

// Logica pura del Modo Diagnostico Inteligente, separada de los
// componentes para poder probarla sin navegador. Los nodos del arbol
// de decisiones viajan como JSON por Supabase (columna `nodos`), asi
// que aqui se validan y se completan antes de usarlos, igual que hace
// procedimiento.ts con los pasos.

export function crearOpcion(etiqueta = ''): OpcionDiagnostico {
  return {
    id: crypto.randomUUID(),
    etiqueta,
    siguienteNodoId: null,
    articuloId: null,
    articuloTitulo: '',
    mensajeFinal: '',
  }
}

// Un nodo nuevo arranca con Si/No prefilladas: es el caso mas comun
// segun los ejemplos del equipo ("¿La impresora esta encendida?").
// El editor permite renombrarlas, borrarlas o agregar mas.
export function crearNodo(): NodoDiagnostico {
  return {
    id: crypto.randomUUID(),
    pregunta: '',
    descripcion: '',
    opciones: [crearOpcion('Sí'), crearOpcion('No')],
  }
}

// Devuelve la lista de nodos bien formada (o vacia). Tolera datos
// incompletos o corruptos que lleguen del servidor.
export function normalizarNodos(valor: unknown): NodoDiagnostico[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === 'object')
    .map((origen) => ({
      id: typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID(),
      pregunta: texto(origen.pregunta),
      descripcion: texto(origen.descripcion),
      opciones: normalizarOpciones(origen.opciones),
    }))
}

function normalizarOpciones(valor: unknown): OpcionDiagnostico[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === 'object')
    .map((origen) => {
      const articuloId =
        typeof origen.articuloId === 'string' && origen.articuloId !== '' ? origen.articuloId : null
      const siguienteNodoId =
        typeof origen.siguienteNodoId === 'string' && origen.siguienteNodoId !== ''
          ? origen.siguienteNodoId
          : null
      return {
        id: typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID(),
        etiqueta: texto(origen.etiqueta),
        siguienteNodoId,
        articuloId,
        // El titulo de referencia solo tiene sentido junto a su id.
        articuloTitulo: articuloId ? texto(origen.articuloTitulo) : '',
        // El mensaje final solo tiene sentido en una rama terminal.
        mensajeFinal: siguienteNodoId ? '' : texto(origen.mensajeFinal),
      }
    })
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

// Limpia los nodos antes de guardar: recorta espacios y descarta las
// opciones totalmente vacias (sin etiqueta). No valida: eso lo hace
// validarNodos, que ademas explica que falta.
export function prepararNodosParaGuardar(nodos: NodoDiagnostico[]): NodoDiagnostico[] {
  return nodos.map((nodo) => ({
    ...nodo,
    pregunta: nodo.pregunta.trim(),
    descripcion: nodo.descripcion.trim(),
    opciones: nodo.opciones
      .map((opcion) => ({
        ...opcion,
        etiqueta: opcion.etiqueta.trim(),
        articuloTitulo: opcion.articuloId ? opcion.articuloTitulo.trim() : '',
        mensajeFinal: opcion.siguienteNodoId ? '' : opcion.mensajeFinal.trim(),
      }))
      .filter((opcion) => opcion.etiqueta !== ''),
  }))
}

// Valida el arbol completo antes de guardar. Devuelve la lista de
// problemas en lenguaje claro (vacia si todo esta bien): sin nodos
// sueltos, sin ciclos y con toda rama terminando en algo util.
export function validarNodos(nodos: NodoDiagnostico[]): string[] {
  const problemas: string[] = []
  if (nodos.length === 0) {
    return ['El diagnóstico necesita al menos una pregunta.']
  }

  const ids = new Set(nodos.map((n) => n.id))
  const numeroDe = new Map(nodos.map((n, i) => [n.id, i + 1]))

  nodos.forEach((nodo, indice) => {
    const numero = indice + 1
    if (nodo.pregunta.trim() === '') {
      problemas.push(`La pregunta ${numero} no tiene texto.`)
    }
    if (nodo.opciones.length === 0) {
      problemas.push(`La pregunta ${numero} no tiene respuestas.`)
    }
    for (const opcion of nodo.opciones) {
      const nombre = opcion.etiqueta || '(sin texto)'
      if (opcion.etiqueta.trim() === '') {
        problemas.push(`Una respuesta de la pregunta ${numero} no tiene texto.`)
      }
      if (opcion.siguienteNodoId && !ids.has(opcion.siguienteNodoId)) {
        problemas.push(
          `La respuesta "${nombre}" de la pregunta ${numero} apunta a una pregunta que ya no existe.`,
        )
      }
      if (opcion.siguienteNodoId === nodo.id) {
        problemas.push(`La respuesta "${nombre}" de la pregunta ${numero} apunta a su propia pregunta.`)
      }
      if (!opcion.siguienteNodoId && opcion.mensajeFinal.trim() === '' && !opcion.articuloId) {
        problemas.push(
          `La respuesta "${nombre}" de la pregunta ${numero} no lleva a ninguna parte: elige la siguiente pregunta, un procedimiento o escribe el mensaje final.`,
        )
      }
    }
  })

  // Ciclos y nodos inalcanzables, con un DFS desde el nodo inicial (el
  // primero de la lista). Un ciclo dejaria al tecnico dando vueltas;
  // un nodo inalcanzable es contenido muerto que conviene conectar.
  const alcanzados = new Set<string>()
  const enCamino = new Set<string>()
  let hayCiclo = false

  function visitar(nodoId: string) {
    if (enCamino.has(nodoId)) {
      hayCiclo = true
      return
    }
    if (alcanzados.has(nodoId)) return
    alcanzados.add(nodoId)
    enCamino.add(nodoId)
    const nodo = nodos.find((n) => n.id === nodoId)
    for (const opcion of nodo?.opciones ?? []) {
      if (opcion.siguienteNodoId && ids.has(opcion.siguienteNodoId)) visitar(opcion.siguienteNodoId)
    }
    enCamino.delete(nodoId)
  }
  visitar(nodos[0].id)

  if (hayCiclo) {
    problemas.push('Las preguntas forman un ciclo: siguiendo las respuestas se vuelve a una pregunta anterior.')
  }
  for (const nodo of nodos) {
    if (!alcanzados.has(nodo.id)) {
      problemas.push(
        `La pregunta ${numeroDe.get(nodo.id)} no se puede alcanzar desde la primera: conéctala desde alguna respuesta o elimínala.`,
      )
    }
  }

  return problemas
}

// Cuantas preguntas quedan, como maximo, desde el nodo dado hasta una
// rama terminal (contando el propio nodo). Sirve para la barra de
// progreso del asistente. Los ciclos (que la validacion impide, pero
// pueden llegar de datos viejos) se cortan devolviendo 0.
export function profundidadRestante(nodos: NodoDiagnostico[], nodoId: string): number {
  const porId = new Map(nodos.map((n) => [n.id, n]))

  function medir(id: string, visitados: ReadonlySet<string>): number {
    if (visitados.has(id)) return 0
    const nodo = porId.get(id)
    if (!nodo) return 0
    const siguientes = nodo.opciones
      .map((o) => o.siguienteNodoId)
      .filter((s): s is string => s !== null)
    const visitadosConEste = new Set([...visitados, id])
    const maxHijos = siguientes.reduce((max, s) => Math.max(max, medir(s, visitadosConEste)), 0)
    return 1 + maxHijos
  }

  return medir(nodoId, new Set())
}

// Porcentaje de avance del diagnostico para la barra del asistente:
// preguntas respondidas contra el camino mas largo que podria quedar.
// Nunca retrocede al responder y llega a 100 solo en el resultado.
export function porcentajeDiagnostico(
  nodos: NodoDiagnostico[],
  camino: PasoCamino[],
  estado: EstadoDiagnostico,
): number {
  if (estado.tipo === 'final') return 100
  const respondidas = camino.length
  const restante =
    estado.tipo === 'pregunta'
      ? profundidadRestante(nodos, estado.nodoId)
      : estado.siguienteNodoId
        ? profundidadRestante(nodos, estado.siguienteNodoId)
        : // Ejecutando el procedimiento de una rama terminal: casi listo.
          0.5
  if (respondidas + restante === 0) return 0
  return Math.min(95, Math.round((respondidas / (respondidas + restante)) * 100))
}

// Texto plano de un diagnostico para el indice de busqueda: el
// problema se encuentra por su titulo, sus preguntas o sus respuestas.
export function textoDeNodos(nodos: NodoDiagnostico[]): string {
  const partes: string[] = []
  for (const nodo of nodos) {
    partes.push(nodo.pregunta, nodo.descripcion)
    for (const opcion of nodo.opciones) {
      partes.push(opcion.etiqueta, opcion.mensajeFinal, opcion.articuloTitulo)
    }
  }
  return partes.filter(Boolean).join(' ')
}
