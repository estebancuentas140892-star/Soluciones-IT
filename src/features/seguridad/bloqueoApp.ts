import { db, ID_BLOQUEO_APP, type ConfigBloqueoApp, type MetodoBloqueoApp } from '../../lib/db'
import {
  analizarBloque,
  cifrarTexto,
  derivarClave,
  descifrarTexto,
  ITERACIONES_PBKDF2,
  nuevaSal,
} from '../../lib/crypto'
import { contarNodosSerializados, MIN_NODOS_PATRON } from './patron'

// Bloqueo de la aplicacion en este dispositivo. Es una capa de ACCESO
// (no de cifrado): impide que quien tome el telefono abra la app y
// navegue por las secciones. La informacion realmente secreta (las
// credenciales de la boveda) sigue cifrada aparte con la contrasena
// maestra, que este bloqueo no reemplaza.
//
// Mientras esta desbloqueada, el estado vive solo en memoria: al
// recargar o reabrir la app siempre vuelve a pedir el desbloqueo. El
// secreto (patron o contrasena) nunca se guarda; solo un verificador
// cifrado (mismo mecanismo que la contrasena maestra) que permite
// comprobarlo sin conexion. No se usa biometria por decision de
// diseño: es un dato personal sensible que no todos quieren entregar.

export type MetodoBloqueo = MetodoBloqueoApp

// Texto fijo que se cifra como verificador: descifrarlo con exito
// (AES-GCM valida integridad) demuestra que el secreto es correcto.
export const TEXTO_VERIFICADOR_APP = 'soluciones-it:bloqueo-app'

export const MIN_LONGITUD_CONTRASENA_APP = 4
export const OPCIONES_AUTOBLOQUEO_APP_MIN = [1, 5, 15, 30]
const MINUTOS_POR_DEFECTO = 5

// Freno a la fuerza bruta desde la interfaz: tras varios fallos se
// impone una espera. No protege contra un atacante que extraiga la
// base y ataque el verificador sin conexion (un patron o PIN es de
// baja entropia); para eso esta la boveda cifrada con la contrasena
// maestra. Aqui solo se disuade el "probar a mano" con el telefono.
const UMBRAL_INTENTOS = 5
const COOLDOWN_MS = 30_000

let desbloqueada = false
let intentosFallidos = 0
let minutosCache = MINUTOS_POR_DEFECTO

// ----------------------------------------------------------------
// Estado observable (para la interfaz)
// ----------------------------------------------------------------

const suscriptores = new Set<() => void>()

export function bloqueoAppDesbloqueado(): boolean {
  return desbloqueada
}

export function suscribirBloqueoApp(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

function notificar(): void {
  for (const escucha of suscriptores) escucha()
}

// ----------------------------------------------------------------
// Verificador (cifrar / comprobar el secreto)
// ----------------------------------------------------------------

async function crearVerificador(secreto: string): Promise<string> {
  const salt = nuevaSal()
  const clave = await derivarClave(secreto, salt, ITERACIONES_PBKDF2)
  return cifrarTexto(clave, salt, ITERACIONES_PBKDF2, TEXTO_VERIFICADOR_APP)
}

async function secretoCoincide(secreto: string, verificador: string): Promise<boolean> {
  const bloque = analizarBloque(verificador)
  if (!bloque) return false
  const clave = await derivarClave(secreto, bloque.salt, bloque.iteraciones)
  try {
    await descifrarTexto(clave, bloque)
    return true
  } catch {
    return false
  }
}

// Valida la forma del secreto segun el metodo. Devuelve el mensaje de
// error o null si es aceptable.
export function validarSecreto(metodo: MetodoBloqueo, secreto: string): string | null {
  if (metodo === 'contrasena') {
    if (secreto.length < MIN_LONGITUD_CONTRASENA_APP) {
      return `La contraseña debe tener al menos ${MIN_LONGITUD_CONTRASENA_APP} caracteres.`
    }
    return null
  }
  if (contarNodosSerializados(secreto) < MIN_NODOS_PATRON) {
    return `El patrón debe unir al menos ${MIN_NODOS_PATRON} puntos.`
  }
  return null
}

// ----------------------------------------------------------------
// Configuracion, desbloqueo y bloqueo
// ----------------------------------------------------------------

export async function configuracionBloqueoApp(): Promise<ConfigBloqueoApp | null> {
  return (await db.seguridadApp.get(ID_BLOQUEO_APP)) ?? null
}

export async function bloqueoAppConfigurado(): Promise<boolean> {
  return (await db.seguridadApp.get(ID_BLOQUEO_APP)) !== undefined
}

// Define por primera vez el bloqueo del dispositivo. Al hacerlo la app
// queda desbloqueada (quien lo configura acaba de demostrar el secreto).
export async function configurarBloqueoApp(
  metodo: MetodoBloqueo,
  secreto: string,
): Promise<string | null> {
  const invalido = validarSecreto(metodo, secreto)
  if (invalido) return invalido
  if (await db.seguridadApp.get(ID_BLOQUEO_APP)) {
    return 'El bloqueo ya está configurado en este dispositivo.'
  }
  const verificador = await crearVerificador(secreto)
  await db.seguridadApp.put({
    id: ID_BLOQUEO_APP,
    metodo,
    verificador,
    minutosAutobloqueo: MINUTOS_POR_DEFECTO,
    bloqueadoHasta: null,
    updatedAt: new Date().toISOString(),
  })
  minutosCache = MINUTOS_POR_DEFECTO
  intentosFallidos = 0
  abrirSesion()
  return null
}

// Milisegundos que faltan para poder volver a intentar, o 0 si no hay
// espera activa.
function restanteCooldown(config: ConfigBloqueoApp): number {
  if (!config.bloqueadoHasta) return 0
  const restante = new Date(config.bloqueadoHasta).getTime() - Date.now()
  return restante > 0 ? restante : 0
}

function mensajeIncorrecto(metodo: MetodoBloqueo): string {
  return metodo === 'patron' ? 'Patrón incorrecto.' : 'Contraseña incorrecta.'
}

export async function desbloquearApp(secreto: string): Promise<string | null> {
  if (desbloqueada) return null
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return 'No hay un bloqueo configurado en este dispositivo.'

  const espera = restanteCooldown(config)
  if (espera > 0) {
    return `Demasiados intentos. Espera ${Math.ceil(espera / 1000)} segundos e inténtalo de nuevo.`
  }
  if (!secreto) return mensajeIncorrecto(config.metodo)

  if (await secretoCoincide(secreto, config.verificador)) {
    intentosFallidos = 0
    if (config.bloqueadoHasta) {
      await db.seguridadApp.update(ID_BLOQUEO_APP, { bloqueadoHasta: null })
    }
    minutosCache = OPCIONES_AUTOBLOQUEO_APP_MIN.includes(config.minutosAutobloqueo)
      ? config.minutosAutobloqueo
      : MINUTOS_POR_DEFECTO
    abrirSesion()
    return null
  }

  intentosFallidos++
  if (intentosFallidos >= UMBRAL_INTENTOS) {
    await db.seguridadApp.update(ID_BLOQUEO_APP, {
      bloqueadoHasta: new Date(Date.now() + COOLDOWN_MS).toISOString(),
    })
    return `Demasiados intentos. Espera ${COOLDOWN_MS / 1000} segundos e inténtalo de nuevo.`
  }
  return mensajeIncorrecto(config.metodo)
}

// Cambia el metodo o el secreto. Exige el secreto actual (evita que
// alguien con el telefono ya desbloqueado lo cambie sin conocerlo).
export async function cambiarBloqueoApp(
  secretoActual: string,
  metodoNuevo: MetodoBloqueo,
  secretoNuevo: string,
): Promise<string | null> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return 'No hay un bloqueo configurado en este dispositivo.'
  if (!(await secretoCoincide(secretoActual, config.verificador))) {
    return 'El código actual no es correcto.'
  }
  const invalido = validarSecreto(metodoNuevo, secretoNuevo)
  if (invalido) return invalido
  const verificador = await crearVerificador(secretoNuevo)
  await db.seguridadApp.update(ID_BLOQUEO_APP, {
    metodo: metodoNuevo,
    verificador,
    bloqueadoHasta: null,
    updatedAt: new Date().toISOString(),
  })
  intentosFallidos = 0
  return null
}

// Quita el bloqueo. Exige el secreto actual.
export async function quitarBloqueoApp(secretoActual: string): Promise<string | null> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return null
  if (!(await secretoCoincide(secretoActual, config.verificador))) {
    return 'El código actual no es correcto.'
  }
  await db.seguridadApp.delete(ID_BLOQUEO_APP)
  intentosFallidos = 0
  return null
}

// Restablece el bloqueo SIN pedir el secreto. Solo debe usarse junto
// con el cierre de sesion (salida de emergencia por olvido): borrar el
// bloqueo y a la vez cerrar la sesion no da acceso a nada, porque para
// volver a entrar hay que autenticarse con la contraseña de la cuenta.
export async function restablecerBloqueoApp(): Promise<void> {
  await db.seguridadApp.delete(ID_BLOQUEO_APP)
  intentosFallidos = 0
  bloquearApp()
}

function abrirSesion(): void {
  desbloqueada = true
  instalarAutobloqueo()
  notificar()
}

export function bloquearApp(): void {
  if (!desbloqueada) return
  desbloqueada = false
  desinstalarAutobloqueo()
  notificar()
}

// ----------------------------------------------------------------
// Autobloqueo (inactividad y regreso desde segundo plano)
// ----------------------------------------------------------------

const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown'] as const
let temporizador: ReturnType<typeof setTimeout> | null = null
let ocultadoEn: number | null = null

export function obtenerMinutosAutobloqueoApp(): number {
  return minutosCache
}

export async function definirMinutosAutobloqueoApp(minutos: number): Promise<void> {
  if (!OPCIONES_AUTOBLOQUEO_APP_MIN.includes(minutos)) return
  minutosCache = minutos
  if (await db.seguridadApp.get(ID_BLOQUEO_APP)) {
    await db.seguridadApp.update(ID_BLOQUEO_APP, { minutosAutobloqueo: minutos })
  }
  if (desbloqueada) reiniciarTemporizador()
}

function reiniciarTemporizador(): void {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(bloquearApp, minutosCache * 60_000)
}

function registrarActividad(): void {
  reiniciarTemporizador()
}

// Al volver de segundo plano (cambiar de app y regresar), si estuvo
// oculta mas que el tiempo de autobloqueo, se bloquea. Cubre el caso
// del movil que conserva la pagina en memoria y no dispara la recarga.
function alCambiarVisibilidad(): void {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'hidden') {
    ocultadoEn = Date.now()
    return
  }
  if (ocultadoEn === null) return
  const fuera = Date.now() - ocultadoEn
  ocultadoEn = null
  if (fuera >= minutosCache * 60_000) bloquearApp()
  else reiniciarTemporizador()
}

function instalarAutobloqueo(): void {
  if (typeof document === 'undefined') return
  reiniciarTemporizador()
  for (const evento of EVENTOS_ACTIVIDAD) {
    document.addEventListener(evento, registrarActividad, true)
  }
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
}

function desinstalarAutobloqueo(): void {
  if (temporizador) {
    clearTimeout(temporizador)
    temporizador = null
  }
  ocultadoEn = null
  if (typeof document === 'undefined') return
  for (const evento of EVENTOS_ACTIVIDAD) {
    document.removeEventListener(evento, registrarActividad, true)
  }
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
}
