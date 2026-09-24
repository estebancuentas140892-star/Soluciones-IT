import { useEffect, useSyncExternalStore } from 'react'
import {
  conectarConCodigo,
  consultarEstadoTecnico,
  desconectarSesion,
  enviarContenido,
  type ErrorAsistencia,
  type MotivoCierre,
  type Respuesta,
} from './apiTecnico'
import type { ContenidoAsistencia } from './modelo'

// LA CONEXION DEL TELEFONO CON UN COMPUTADOR ATENDIDO (tarea 258).
//
// Una sola por tecnico (el servidor cierra la anterior al conectar otra).
// Se guarda en localStorage con el id del usuario, para que sobreviva a
// cerrar la app o a cambiar de pantalla: el tecnico conecta, abre una
// guia y envia paso a paso. Nunca se guarda ahi nada secreto: el id de la
// sesion no sirve sin la sesion de Supabase del mismo tecnico (el
// servidor comprueba que la sesion sea suya).
//
// RECONEXION (decision de la tarea 258, AD-053):
//   - el telefono SI la retoma tras cerrar la app o perder la red, con el
//     id guardado y el mismo usuario, mientras la sesion siga viva;
//   - el codigo NUNCA vuelve a conectar: canjeado, vencido o cerrado, el
//     computador tiene que generar uno nuevo;
//   - el latido (`useLatidoAsistencia`) mantiene viva la sesion mientras
//     la app la tiene abierta a la vista; sin el, a los 15 minutos sin
//     enviar nada el servidor la cierra por inactividad.

export interface SesionAsistencia {
  id: string
  codigo: string
  usuario: string
  conectadaEn: string
}

/** Por qué terminó la última conexión, para decirlo una vez. */
export interface CierreReciente {
  motivo: MotivoCierre | 'no_encontrada'
  codigo: string
}

const CLAVE = 'asistencia:sesion'
const INTERVALO_LATIDO_MS = 60_000

let actual: SesionAsistencia | null = leer()
let cierreReciente: CierreReciente | null = null
const oyentes = new Set<() => void>()

function leer(): SesionAsistencia | null {
  try {
    const crudo = typeof localStorage === 'undefined' ? null : localStorage.getItem(CLAVE)
    if (!crudo) return null
    const valor = JSON.parse(crudo) as Partial<SesionAsistencia>
    if (
      typeof valor.id !== 'string' ||
      typeof valor.codigo !== 'string' ||
      typeof valor.usuario !== 'string' ||
      typeof valor.conectadaEn !== 'string'
    ) {
      return null
    }
    return { id: valor.id, codigo: valor.codigo, usuario: valor.usuario, conectadaEn: valor.conectadaEn }
  } catch {
    return null
  }
}

function avisar() {
  for (const oyente of oyentes) oyente()
}

function guardar(sesion: SesionAsistencia | null) {
  actual = sesion
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion))
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento (modo privado): la conexion vive en memoria.
  }
  avisar()
}

// Otra pestaña de la app conecto o desconecto: esta se entera.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (evento) => {
    if (evento.key !== CLAVE) return
    actual = leer()
    avisar()
  })
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

/** La conexión del usuario indicado, o null (la de otro usuario no cuenta). */
export function sesionDe(usuario: string | null | undefined): SesionAsistencia | null {
  return usuario && actual?.usuario === usuario ? actual : null
}

export function useSesionAsistencia(usuario: string | null | undefined): SesionAsistencia | null {
  const sesion = useSyncExternalStore(suscribir, () => actual, () => null)
  return usuario && sesion?.usuario === usuario ? sesion : null
}

export function useCierreReciente(): CierreReciente | null {
  return useSyncExternalStore(suscribir, () => cierreReciente, () => null)
}

export function olvidarCierreReciente() {
  if (!cierreReciente) return
  cierreReciente = null
  avisar()
}

function terminarLocal(motivo: CierreReciente['motivo']) {
  if (actual) cierreReciente = { motivo, codigo: actual.codigo }
  guardar(null)
}

export async function conectarEquipo(
  codigo: string,
  usuario: string,
): Promise<{ ok: true; sesion: SesionAsistencia } | { ok: false; error: ErrorAsistencia }> {
  const respuesta = await conectarConCodigo(codigo)
  if (!respuesta.ok) return { ok: false, error: respuesta.error }
  cierreReciente = null
  const sesion: SesionAsistencia = {
    id: respuesta.id,
    codigo: respuesta.codigo,
    usuario,
    conectadaEn: respuesta.conectada_en,
  }
  guardar(sesion)
  return { ok: true, sesion }
}

export async function enviarAlEquipo(
  usuario: string,
  contenido: ContenidoAsistencia,
): Promise<Respuesta<{ id: number }>> {
  const sesion = sesionDe(usuario)
  if (!sesion) return { ok: false, error: 'sesion_no_activa' }
  const respuesta = await enviarContenido(sesion.id, contenido)
  if (!respuesta.ok && respuesta.error === 'sesion_no_activa') {
    terminarLocal((respuesta.motivo as MotivoCierre | undefined) ?? 'no_encontrada')
  }
  return respuesta
}

export async function desconectarEquipo(usuario: string): Promise<void> {
  const sesion = sesionDe(usuario)
  if (!sesion) return
  // Primero se olvida aquí: aunque el servidor no conteste (sin red), el
  // teléfono deja de enviar a ese equipo, y la inactividad cierra la
  // sesión en el servidor a los 15 minutos.
  terminarLocal('tecnico')
  await desconectarSesion(sesion.id)
}

/**
 * Al cerrar sesión en la app: se desconecta el equipo (si hay red, en un
 * par de segundos como mucho) y se olvida la conexión. Nunca bloquea el
 * cierre de sesión.
 */
export async function desconectarAlSalir(): Promise<void> {
  const sesion = actual
  if (!sesion) return
  guardar(null)
  await Promise.race([desconectarSesion(sesion.id), new Promise((resolver) => setTimeout(resolver, 2500))])
}

/** Latido: pregunta al servidor y, de paso, mantiene viva la sesión. */
export async function comprobarSesion(usuario: string): Promise<void> {
  const sesion = sesionDe(usuario)
  if (!sesion) return
  const respuesta = await consultarEstadoTecnico(sesion.id)
  if (!respuesta.ok) {
    // Sin red o servidor caído: no se da por cerrada, se reintenta luego.
    if (respuesta.error === 'sin_sesion') terminarLocal('no_encontrada')
    return
  }
  if (respuesta.estado !== 'conectada') terminarLocal(respuesta.motivo ?? 'no_encontrada')
}

/**
 * Mientras la pantalla que lo usa esté montada y visible, comprueba la
 * conexión al montarse, cada minuto y al volver a la vista o a la red.
 */
export function useLatidoAsistencia(usuario: string | null | undefined) {
  const conectada = Boolean(useSesionAsistencia(usuario))
  useEffect(() => {
    if (!conectada || !usuario) return
    let vigente = true
    const latir = () => {
      if (vigente && document.visibilityState === 'visible') void comprobarSesion(usuario)
    }
    latir()
    const intervalo = window.setInterval(latir, INTERVALO_LATIDO_MS)
    document.addEventListener('visibilitychange', latir)
    window.addEventListener('online', latir)
    return () => {
      vigente = false
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', latir)
      window.removeEventListener('online', latir)
    }
  }, [conectada, usuario])
}

/** Solo para las pruebas: vuelve al estado inicial. */
export function reiniciarSesionAsistenciaParaPruebas() {
  actual = null
  cierreReciente = null
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // nada
  }
  avisar()
}
