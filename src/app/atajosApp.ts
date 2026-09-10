// ATAJOS DE TECLADO DE LA APLICACION.
//
// Reglas puras, sin React ni DOM global, para poder probarlas sin
// navegador. La capa que las escucha vive en `CapaAtajos.tsx`.
//
// TRES DECISIONES QUE MANDAN SOBRE EL RESTO:
//
//   1. NO SE PISAN LOS ATAJOS DEL NAVEGADOR. Cualquier tecla con Ctrl,
//      Cmd o Alt se deja pasar tal cual: Ctrl+F, Ctrl+L, Cmd+[ y
//      compañia siguen siendo del navegador, no de esta app. Shift SI
//      se admite, porque "?" se teclea con Shift en la mayoria de
//      distribuciones.
//   2. NO SE ACTUA MIENTRAS SE ESCRIBE. Un input, un textarea, un
//      select o cualquier elemento editable se quedan la tecla. Sin
//      esto, escribir "guia" en el buscador de una lista saltaria a
//      Guias en la primera letra.
//   3. LA SECUENCIA "G" CADUCA. Si la segunda tecla no llega en poco
//      mas de un segundo, se olvida: dejar la secuencia abierta para
//      siempre convierte cualquier "e" posterior en un salto a Equipos.

/** Cuanto espera la secuencia iniciada con G a su segunda tecla. */
export const MS_SECUENCIA = 1200

export interface AtajoApp {
  /** Las teclas, en orden, tal como se muestran en la ayuda. */
  teclas: string[]
  descripcion: string
  grupo: string
  /** Solo para los que navegan: a donde llevan. */
  ruta?: string
  /** Exige permiso de boveda para ofrecerse. */
  soloConBoveda?: boolean
  /** No actua mientras se edita o se ejecuta una guia (ver `navegacion`). */
  esNavegacion?: boolean
}

export const ATAJOS_APP: AtajoApp[] = [
  { teclas: ['/'], descripcion: 'Enfocar el buscador global', grupo: 'Buscar y ayuda' },
  { teclas: ['?'], descripcion: 'Abrir esta ayuda de atajos', grupo: 'Buscar y ayuda' },
  { teclas: ['Esc'], descripcion: 'Cerrar el panel, diálogo, visor o ayuda de encima', grupo: 'Buscar y ayuda' },
  { teclas: ['G', 'G'], descripcion: 'Ir a Guías', grupo: 'Ir a', ruta: '/soluciones', esNavegacion: true },
  { teclas: ['G', 'E'], descripcion: 'Ir a Equipos', grupo: 'Ir a', ruta: '/dispositivos', esNavegacion: true },
  { teclas: ['G', 'R'], descripcion: 'Ir a Red', grupo: 'Ir a', ruta: '/red', esNavegacion: true },
  {
    teclas: ['G', 'B'],
    descripcion: 'Ir a Bóveda',
    grupo: 'Ir a',
    ruta: '/boveda',
    soloConBoveda: true,
    esNavegacion: true,
  },
]

/** Los atajos que este usuario puede usar de verdad (R3: nada muerto). */
export function atajosVisibles(puedeVerBoveda: boolean): AtajoApp[] {
  return ATAJOS_APP.filter((atajo) => !atajo.soloConBoveda || puedeVerBoveda)
}

/** Destino de la segunda tecla de la secuencia G, en minúscula. */
const DESTINO_SECUENCIA: Record<string, string> = {
  g: '/soluciones',
  e: '/dispositivos',
  r: '/red',
  b: '/boveda',
}

export type AccionAtajo =
  | { tipo: 'buscar' }
  | { tipo: 'ayuda' }
  | { tipo: 'ir'; ruta: string }
  /** Se inició la secuencia: hay que esperar la segunda tecla. */
  | { tipo: 'esperar' }
  /** La secuencia se abandona (segunda tecla desconocida o Escape). */
  | { tipo: 'cancelar' }
  | null

export interface EventoTecla {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** Ctrl, Cmd o Alt: la tecla es del navegador o del sistema, no nuestra. */
export function tieneModificador(evento: EventoTecla): boolean {
  return evento.ctrlKey || evento.metaKey || evento.altKey
}

interface DestinoEditable {
  tagName?: string
  isContentEditable?: boolean
}

/**
 * ¿El foco está en algo donde se escribe? Cubre input, textarea, select
 * y cualquier elemento con `contenteditable` (el editor de un texto
 * enriquecido no es un `<textarea>` y también se queda la tecla).
 */
export function esCampoEditable(destino: DestinoEditable | null | undefined): boolean {
  if (!destino) return false
  if (destino.isContentEditable) return true
  const etiqueta = (destino.tagName ?? '').toUpperCase()
  return etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT'
}

export interface ContextoAtajo {
  /** Hay una secuencia G esperando su segunda tecla. */
  secuenciaActiva: boolean
  /** Este usuario tiene permiso de bóveda. */
  puedeVerBoveda: boolean
  /**
   * Los atajos que NAVEGAN están permitidos aquí. Se apagan mientras se
   * edita o se ejecuta una guía (nivel `tarea` del chasis): saltar a
   * otra sección desde ahí sacaría al técnico de un trabajo a medias
   * sin pasar por su confirmación de salida. Buscar y pedir ayuda sí
   * siguen disponibles: ninguno de los dos abandona la pantalla.
   */
  navegacion: boolean
}

/**
 * Qué hacer con una tecla. Devuelve null cuando no es asunto nuestro:
 * quien llama no debe entonces tocar el evento ni cancelar nada.
 *
 * `Escape` NO se resuelve aquí a propósito. Cada capa (el buscador, un
 * diálogo, el visor de imágenes) ya cierra la suya con su propio
 * oyente, así que interceptarlo arriba cerraría dos a la vez, que es
 * exactamente lo que la regla "Esc cierra solo la capa superior"
 * prohíbe. Lo único que hace aquí es abandonar la secuencia G.
 */
export function resolverAtajo(evento: EventoTecla, contexto: ContextoAtajo): AccionAtajo {
  if (tieneModificador(evento)) return null

  if (contexto.secuenciaActiva) {
    if (evento.key === 'Escape') return { tipo: 'cancelar' }
    const ruta = DESTINO_SECUENCIA[evento.key.toLowerCase()]
    if (!ruta) return { tipo: 'cancelar' }
    if (ruta === '/boveda' && !contexto.puedeVerBoveda) return { tipo: 'cancelar' }
    return { tipo: 'ir', ruta }
  }

  if (evento.key === '/') return { tipo: 'buscar' }
  if (evento.key === '?') return { tipo: 'ayuda' }
  if (evento.key.toLowerCase() === 'g' && contexto.navegacion) return { tipo: 'esperar' }
  return null
}
