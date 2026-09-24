import { validarContenido, type MensajeAsistencia } from '../features/asistencia/modelo'

export { formatoCodigo } from '../features/asistencia/modelo'

// LOGICA PURA DEL PORTAL (tarea 258): cuanto esperar entre consultas,
// que decir al terminar, como guardar la sesion de ESTA pestaña y que
// mensajes se dibujan. Sin DOM ni red, para probarla aislada.

/** La sesión de esta pestaña. Solo en sessionStorage: ni otra pestaña nueva ni otro navegador la ven. */
export interface SesionPortal {
  id: string
  secreto: string
}

const CLAVE = 'asistencia:portal'

export function leerSesionPortal(almacen: Storage | null = almacenSeguro()): SesionPortal | null {
  try {
    const crudo = almacen?.getItem(CLAVE)
    if (!crudo) return null
    const valor = JSON.parse(crudo) as Partial<SesionPortal>
    if (typeof valor.id !== 'string' || typeof valor.secreto !== 'string') return null
    if (!/^[0-9a-f]{64}$/.test(valor.secreto)) return null
    return { id: valor.id, secreto: valor.secreto }
  } catch {
    return null
  }
}

export function guardarSesionPortal(sesion: SesionPortal, almacen: Storage | null = almacenSeguro()) {
  try {
    almacen?.setItem(CLAVE, JSON.stringify(sesion))
  } catch {
    // Sin almacenamiento: la sesión vive mientras la pestaña no se recargue.
  }
}

export function olvidarSesionPortal(almacen: Storage | null = almacenSeguro()) {
  try {
    almacen?.removeItem(CLAVE)
  } catch {
    // nada
  }
}

function almacenSeguro(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

// CADA CUANTO SE CONSULTA. Cada 2 s mientras la pestaña está a la vista
// (enseñar un paso no necesita inmediatez de un segundo), cada 10 s en
// segundo plano, y con errores seguidos se espacia hasta 30 s para no
// insistir contra una red caída.
export const CONSULTA_VISIBLE_MS = 2000
export const CONSULTA_OCULTA_MS = 10_000
export const CONSULTA_MAXIMA_MS = 30_000

export function intervaloConsulta(visible: boolean, erroresSeguidos: number): number {
  const base = visible ? CONSULTA_VISIBLE_MS : CONSULTA_OCULTA_MS
  if (erroresSeguidos <= 0) return base
  return Math.min(CONSULTA_MAXIMA_MS, base * 2 ** Math.min(erroresSeguidos, 4))
}

/** "9:41" (minutos y segundos restantes), o "0:00" si ya pasó. */
export function formatoRestante(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutos = Math.floor(total / 60)
  const segundos = total % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

export interface TextoFinal {
  titulo: string
  detalle: string
}

// LO QUE VE EL COMPUTADOR CUANDO LA SESION TERMINA. Siempre con la
// salida: generar un código nuevo.
export function textoFinal(estado: string, motivo: string | null | undefined): TextoFinal {
  if (estado === 'no_encontrada') {
    return {
      titulo: 'Esta asistencia ya no existe',
      detalle: 'Para recibir asistencia, genera un código nuevo.',
    }
  }
  switch (motivo) {
    case 'tecnico':
      return { titulo: 'El técnico se desconectó', detalle: 'La sesión terminó. Para recibir asistencia otra vez, genera un código nuevo.' }
    case 'portal':
      return { titulo: 'Sesión finalizada', detalle: 'Terminaste la asistencia. Para recibir asistencia otra vez, genera un código nuevo.' }
    case 'inactividad':
      return { titulo: 'La sesión se cerró', detalle: 'Pasaron 15 minutos sin actividad del técnico. Genera un código nuevo si todavía necesitas ayuda.' }
    case 'codigo_vencido':
      return { titulo: 'El código venció', detalle: 'Nadie se conectó en 10 minutos. Genera un código nuevo.' }
    case 'maximo':
      return { titulo: 'La sesión terminó', detalle: 'Una asistencia dura como máximo 4 horas. Genera un código nuevo si todavía necesitas ayuda.' }
    case 'reemplazada':
      return { titulo: 'El técnico se conectó a otro equipo', detalle: 'Esta sesión terminó. Genera un código nuevo si todavía necesitas ayuda.' }
    default:
      return { titulo: 'Sesión finalizada', detalle: 'Para recibir asistencia, genera un código nuevo.' }
  }
}

/** Máximo de envíos que se dibujan: los más recientes. */
export const MAXIMO_MENSAJES_VISIBLES = 30

/**
 * Suma los mensajes nuevos a los que ya se ven: sin repetir, en orden de
 * llegada y descartando cualquiera que no tenga la forma permitida (el
 * servidor ya los validó; el portal no dibuja nada que no entienda).
 */
export function unirMensajes(previos: MensajeAsistencia[], nuevos: MensajeAsistencia[]): MensajeAsistencia[] {
  const porId = new Map<number, MensajeAsistencia>()
  for (const mensaje of [...previos, ...nuevos]) {
    if (typeof mensaje?.id !== 'number') continue
    if (validarContenido(mensaje.contenido) !== null) continue
    porId.set(mensaje.id, mensaje)
  }
  return [...porId.values()].sort((a, b) => a.id - b.id).slice(-MAXIMO_MENSAJES_VISIBLES)
}
