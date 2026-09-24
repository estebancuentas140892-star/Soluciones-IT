import type { MensajeAsistencia } from '../features/asistencia/modelo'

// EL PORTAL HABLA CON TRES FUNCIONES Y NADA MAS (tarea 258).
//
// `fetch` directo a `/rest/v1/rpc/...` con la clave publicable, sin el
// cliente de Supabase: el portal no tiene sesion, no guarda tokens y no
// puede leer ninguna tabla (las de la asistencia no tienen politicas ni
// privilegios, y las del resto de la app exigen `authenticated`). Solo
// `asistencia_crear`, `asistencia_estado` y `asistencia_cerrar_portal`
// estan concedidas a `anon` (supabase/schema.sql, seccion 7).

export type EstadoServidor = 'esperando' | 'conectada' | 'cerrada' | 'expirada' | 'no_encontrada'

export interface SesionCreada {
  id: string
  secreto: string
  codigo: string
  codigo_vence_en: string
  ahora: string
}

export interface EstadoPortal {
  estado: EstadoServidor
  codigo?: string | null
  codigo_vence_en?: string | null
  motivo?: string | null
  mensajes: MensajeAsistencia[]
  ahora: string
}

/** Sin red o sin respuesta: se reintenta sola. */
export class ErrorDeRed extends Error {}
/** El servidor respondió, pero la asistencia no está disponible (sin migrar, saturada, caída). */
export class ErrorNoDisponible extends Error {
  readonly causa: string
  constructor(causa: string) {
    super(causa)
    this.causa = causa
  }
}

function base(): { url: string; clave: string } | null {
  // SIMULADOR LOCAL, SOLO EN DESARROLLO: el build de produccion elimina
  // esta rama (import.meta.env.DEV vale false). Ver
  // scripts/asistencia-simulada.mjs.
  if (import.meta.env.DEV && import.meta.env.VITE_ASISTENCIA_SIMULADA_URL) {
    return { url: import.meta.env.VITE_ASISTENCIA_SIMULADA_URL, clave: 'simulada' }
  }
  const url = import.meta.env.VITE_SUPABASE_URL
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && clave ? { url: `${url}/rest/v1`, clave } : null
}

async function llamar(funcion: string, argumentos: Record<string, unknown>): Promise<Record<string, unknown>> {
  const destino = base()
  if (!destino) throw new ErrorNoDisponible('sin_configuracion')
  let respuesta: Response
  try {
    respuesta = await fetch(`${destino.url}/rpc/${funcion}`, {
      method: 'POST',
      headers: { apikey: destino.clave, 'Content-Type': 'application/json' },
      body: JSON.stringify(argumentos),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new ErrorDeRed('sin_conexion')
  }
  if (!respuesta.ok) {
    // 404 PGRST202: la migración de la asistencia no está aplicada.
    throw new ErrorNoDisponible(respuesta.status === 404 ? 'sin_migrar' : `http_${respuesta.status}`)
  }
  const datos = (await respuesta.json().catch(() => null)) as Record<string, unknown> | null
  if (!datos || typeof datos !== 'object') throw new ErrorNoDisponible('respuesta_invalida')
  return datos
}

export async function crearSesion(): Promise<SesionCreada> {
  const datos = await llamar('asistencia_crear', {})
  if (datos.ok !== true) throw new ErrorNoDisponible(typeof datos.error === 'string' ? datos.error : 'rechazada')
  return datos as unknown as SesionCreada
}

export async function consultarEstado(id: string, secreto: string, desde: number): Promise<EstadoPortal> {
  const datos = await llamar('asistencia_estado', { p_id: id, p_secreto: secreto, p_desde: desde })
  const mensajes = Array.isArray(datos.mensajes) ? (datos.mensajes as MensajeAsistencia[]) : []
  return { ...(datos as unknown as EstadoPortal), mensajes }
}

export async function cerrarDesdePortal(id: string, secreto: string): Promise<void> {
  await llamar('asistencia_cerrar_portal', { p_id: id, p_secreto: secreto })
}
