import { supabase } from '../../lib/supabase'
import type { ContenidoAsistencia } from './modelo'

// EL LADO DEL TECNICO DE LA ASISTENCIA (tarea 258): las cuatro funciones
// del servidor que usa la app con sesion (`asistencia_conectar`,
// `asistencia_enviar`, `asistencia_estado_tecnico`, `asistencia_desconectar`,
// supabase/schema.sql seccion 7). Todas devuelven `{ ok, ... }` o
// `{ ok: false, error }`: un rechazo no es una excepcion, porque en el
// servidor una excepcion desharia tambien su registro de auditoria.

export type ErrorAsistencia =
  | 'sin_sesion'
  | 'codigo_invalido'
  | 'codigo_incorrecto'
  | 'codigo_vencido'
  | 'codigo_usado'
  | 'demasiados_intentos'
  | 'sesion_no_activa'
  | 'contenido_protegido'
  | 'contenido_no_valido'
  | 'demasiados_envios'
  | 'sin_conexion'
  | 'no_disponible'

export type MotivoCierre = 'tecnico' | 'portal' | 'inactividad' | 'codigo_vencido' | 'maximo' | 'reemplazada'

export type Respuesta<T> = ({ ok: true } & T) | { ok: false; error: ErrorAsistencia; motivo?: string; estado?: string }

export interface DatosConexion {
  id: string
  codigo: string
  conectada_en: string
  vence_inactividad_en: string
  vence_maximo_en: string
}

export interface DatosEstadoTecnico {
  estado: 'esperando' | 'conectada' | 'cerrada' | 'expirada' | 'no_encontrada'
  codigo?: string
  conectada_en?: string
  motivo?: MotivoCierre | null
  vence_inactividad_en?: string
  vence_maximo_en?: string
}

const CONOCIDOS: ReadonlySet<string> = new Set<ErrorAsistencia>([
  'sin_sesion',
  'codigo_invalido',
  'codigo_incorrecto',
  'codigo_vencido',
  'codigo_usado',
  'demasiados_intentos',
  'sesion_no_activa',
  'contenido_protegido',
  'contenido_no_valido',
  'demasiados_envios',
])

function esErrorDeRed(mensaje: string): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /fetch|network|conexi|load failed/i.test(mensaje)
}

// Una respuesta del servidor, pasada por el mismo filtro siempre: lo que
// no reconoce se trata como "no disponible", nunca como exito.
function normalizar<T>(datos: unknown): Respuesta<T> {
  if (!datos || typeof datos !== 'object') return { ok: false, error: 'no_disponible' }
  const r = datos as Record<string, unknown>
  if (r.ok === true) return r as { ok: true } & T
  const error = typeof r.error === 'string' && CONOCIDOS.has(r.error) ? (r.error as ErrorAsistencia) : 'no_disponible'
  return {
    ok: false,
    error,
    motivo: typeof r.motivo === 'string' ? r.motivo : undefined,
    estado: typeof r.estado === 'string' ? r.estado : undefined,
  }
}

async function llamar<T>(funcion: string, argumentos: Record<string, unknown>): Promise<Respuesta<T>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'sin_conexion' }

  // SIMULADOR LOCAL, SOLO EN DESARROLLO (mismo patron que el banco de
  // pruebas de AuthProvider): con `import.meta.env.DEV` delante, el build
  // de produccion elimina esta rama entera. Sirve para recorrer la
  // pantalla sin Supabase, contra `scripts/asistencia-simulada.mjs`.
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_MODO_PRUEBA_LOCAL === '1' &&
    import.meta.env.VITE_ASISTENCIA_SIMULADA_URL
  ) {
    try {
      const respuesta = await fetch(`${import.meta.env.VITE_ASISTENCIA_SIMULADA_URL}/rpc/${funcion}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tecnico-prueba': 'tecnico-prueba' },
        body: JSON.stringify(argumentos),
      })
      return normalizar<T>(await respuesta.json())
    } catch {
      return { ok: false, error: 'sin_conexion' }
    }
  }

  if (!supabase) return { ok: false, error: 'no_disponible' }
  try {
    const { data, error } = await supabase.rpc(funcion, argumentos)
    if (error) return { ok: false, error: esErrorDeRed(error.message) ? 'sin_conexion' : 'no_disponible' }
    return normalizar<T>(data)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    return { ok: false, error: esErrorDeRed(mensaje) ? 'sin_conexion' : 'no_disponible' }
  }
}

export function conectarConCodigo(codigo: string): Promise<Respuesta<DatosConexion>> {
  return llamar<DatosConexion>('asistencia_conectar', { p_codigo: codigo })
}

export function enviarContenido(id: string, contenido: ContenidoAsistencia): Promise<Respuesta<{ id: number }>> {
  return llamar<{ id: number }>('asistencia_enviar', { p_id: id, p_contenido: contenido })
}

export function consultarEstadoTecnico(id: string): Promise<Respuesta<DatosEstadoTecnico>> {
  return llamar<DatosEstadoTecnico>('asistencia_estado_tecnico', { p_id: id })
}

export function desconectarSesion(id: string): Promise<Respuesta<{ estado: string }>> {
  return llamar<{ estado: string }>('asistencia_desconectar', { p_id: id })
}

// Lo que el tecnico lee cuando algo no salio. Frases cortas que dicen
// que hacer, no que fallo por dentro.
export const TEXTO_ERROR: Record<ErrorAsistencia, string> = {
  sin_sesion: 'Tu sesión venció. Vuelve a iniciar sesión en Soluciones IT.',
  codigo_invalido: 'El código tiene 6 cifras.',
  codigo_incorrecto: 'Ese código no corresponde a ningún equipo esperando. Revísalo en la pantalla del computador.',
  codigo_vencido: 'Ese código venció. En el computador, toca «Generar un código nuevo».',
  codigo_usado: 'Ese código ya se usó. En el computador, toca «Generar un código nuevo».',
  demasiados_intentos: 'Demasiados códigos incorrectos. Espera 10 minutos y vuelve a intentarlo.',
  sesion_no_activa: 'La conexión con el equipo ya terminó.',
  contenido_protegido: 'No se envió: el contenido parece incluir un dato protegido (una contraseña, un PIN o una clave).',
  contenido_no_valido: 'No se envió: el contenido no tiene la forma permitida.',
  demasiados_envios: 'Demasiados envíos seguidos. Espera un minuto.',
  sin_conexion: 'Sin conexión. La guía sigue aquí; envía cuando vuelva la red.',
  no_disponible: 'La asistencia remota no está disponible ahora.',
}

export const TEXTO_CIERRE: Record<MotivoCierre, string> = {
  tecnico: 'Desconectaste el equipo.',
  portal: 'El computador terminó la asistencia.',
  inactividad: 'La conexión se cerró tras 15 minutos sin actividad.',
  codigo_vencido: 'El código venció.',
  maximo: 'La conexión llegó a su máximo de 4 horas.',
  reemplazada: 'Te conectaste a otro equipo.',
}
