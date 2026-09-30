import { db, ID_BLOQUEO_APP, type ConfigBloqueoApp, type MetodoBloqueoApp } from '../../lib/db'
import {
  analizarBloque,
  cifrarTexto,
  derivarClave,
  descifrarTexto,
  ITERACIONES_PBKDF2,
  nuevaSal,
} from '../../lib/crypto'
import type { CredencialRegistrada } from '../../lib/webauthn'
import {
  avisarCredencialRetirada,
  comprobarCredencial,
  crearCredencial,
  type MotivoFallo,
} from './desbloqueoDispositivo'
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
// comprobarlo sin conexion.
//
// Desbloqueo del dispositivo (tarea 278, revisa AD-012): una via rapida
// OPCIONAL que se suma al patron o la contrasena, que siguen siendo el
// respaldo. El autenticador del sistema verifica a la persona (huella,
// rostro, Windows Hello o su codigo) y firma un desafio; la app solo
// guarda la clave publica y verifica esa firma aqui, sin red. Nunca
// recibe ni guarda un dato biometrico, y no hay ningun "ya se verifico"
// guardado: la unica forma de abrir es `abrirSesion()`, en memoria, tras
// un secreto correcto o una firma verificada.

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

// Cuanto vale la confirmacion del codigo actual para activar el
// desbloqueo del dispositivo (dos toques: crear y comprobar).
const VIGENCIA_CONFIRMACION_MS = 2 * 60_000

let desbloqueada = false
let intentosFallidos = 0
let minutosCache = MINUTOS_POR_DEFECTO
// Hasta cuando vale la ultima confirmacion del codigo actual. Solo en
// memoria: recargar la pierde.
let confirmadoHasta = 0

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

function mensajeEspera(ms: number): string {
  return `Demasiados intentos. Espera ${Math.ceil(ms / 1000)} segundos e inténtalo de nuevo.`
}

const MENSAJE_CODIGO_ACTUAL = 'El código actual no es correcto.'

// Comprueba el secreto con el freno de intentos. Lo usan TODAS las
// puertas que piden el codigo actual: desbloquear, confirmar (para
// activar el desbloqueo del dispositivo), cambiar y quitar. Antes Cambiar
// y Quitar no contaban los fallos, y por ahi se podia probar patrones sin
// limite con la app abierta; ahora cualquier fallo suma al mismo freno.
// `esperaMs` > 0 si hay que esperar.
async function comprobarSecretoConFreno(
  config: ConfigBloqueoApp,
  secreto: string,
): Promise<{ ok: true } | { ok: false; esperaMs: number }> {
  const espera = restanteCooldown(config)
  if (espera > 0) return { ok: false, esperaMs: espera }
  if (await secretoCoincide(secreto, config.verificador)) {
    intentosFallidos = 0
    if (config.bloqueadoHasta) {
      await db.seguridadApp.update(ID_BLOQUEO_APP, { bloqueadoHasta: null })
    }
    return { ok: true }
  }
  intentosFallidos++
  if (intentosFallidos >= UMBRAL_INTENTOS) {
    await db.seguridadApp.update(ID_BLOQUEO_APP, {
      bloqueadoHasta: new Date(Date.now() + COOLDOWN_MS).toISOString(),
    })
    return { ok: false, esperaMs: COOLDOWN_MS }
  }
  return { ok: false, esperaMs: 0 }
}

function aplicarMinutos(config: ConfigBloqueoApp): void {
  minutosCache = OPCIONES_AUTOBLOQUEO_APP_MIN.includes(config.minutosAutobloqueo)
    ? config.minutosAutobloqueo
    : MINUTOS_POR_DEFECTO
}

export async function desbloquearApp(secreto: string): Promise<string | null> {
  if (desbloqueada) return null
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return 'No hay un bloqueo configurado en este dispositivo.'

  const espera = restanteCooldown(config)
  if (espera > 0) return mensajeEspera(espera)
  // Vacio no cuenta como intento.
  if (!secreto) return mensajeIncorrecto(config.metodo)

  const resultado = await comprobarSecretoConFreno(config, secreto)
  if (resultado.ok) {
    aplicarMinutos(config)
    abrirSesion()
    return null
  }
  return resultado.esperaMs > 0 ? mensajeEspera(resultado.esperaMs) : mensajeIncorrecto(config.metodo)
}

// Cambia el metodo o el secreto. Exige el secreto actual (evita que
// alguien con el telefono ya desbloqueado lo cambie sin conocerlo).
// El desbloqueo del dispositivo, si esta activo, se conserva: sigue
// siendo valido y solo cambia el respaldo (`update` no toca el campo).
export async function cambiarBloqueoApp(
  secretoActual: string,
  metodoNuevo: MetodoBloqueo,
  secretoNuevo: string,
): Promise<string | null> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return 'No hay un bloqueo configurado en este dispositivo.'
  const actual = await comprobarSecretoConFreno(config, secretoActual)
  if (!actual.ok) return actual.esperaMs > 0 ? mensajeEspera(actual.esperaMs) : MENSAJE_CODIGO_ACTUAL
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

// Quita el bloqueo. Exige el secreto actual. Con la fila se va tambien
// el desbloqueo del dispositivo: no queda una credencial que la app de
// por activa sin bloqueo debajo.
export async function quitarBloqueoApp(secretoActual: string): Promise<string | null> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return null
  const actual = await comprobarSecretoConFreno(config, secretoActual)
  if (!actual.ok) return actual.esperaMs > 0 ? mensajeEspera(actual.esperaMs) : MENSAJE_CODIGO_ACTUAL
  await db.seguridadApp.delete(ID_BLOQUEO_APP)
  intentosFallidos = 0
  confirmadoHasta = 0
  if (config.desbloqueoDispositivo) avisarCredencialRetirada(config.desbloqueoDispositivo)
  return null
}

// Restablece el bloqueo SIN pedir el secreto. Solo debe usarse junto
// con el cierre de sesion (salida de emergencia por olvido): borrar el
// bloqueo y a la vez cerrar la sesion no da acceso a nada, porque para
// volver a entrar hay que autenticarse con la contraseña de la cuenta.
// Tambien se va el desbloqueo del dispositivo, que vive en la misma fila.
export async function restablecerBloqueoApp(): Promise<void> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  await db.seguridadApp.delete(ID_BLOQUEO_APP)
  intentosFallidos = 0
  confirmadoHasta = 0
  bloquearApp()
  if (config?.desbloqueoDispositivo) avisarCredencialRetirada(config.desbloqueoDispositivo)
}

// ----------------------------------------------------------------
// Desbloqueo del dispositivo (tarea 278)
// ----------------------------------------------------------------

/** Lo que ve la persona cuando el dispositivo no pudo desbloquear. */
export const MENSAJE_DISPOSITIVO_NO_SE_PUDO = 'No se pudo usar el desbloqueo del dispositivo.'

export type ResultadoDispositivo = 'ok' | MotivoFallo

// Confirma el codigo actual (patron o contrasena) antes de activar o
// volver a registrar el desbloqueo del dispositivo: quien encuentre la
// app abierta un momento no puede registrar su propia huella sin
// conocerlo. Usa el mismo freno de intentos que el desbloqueo. La
// confirmacion vive solo en memoria y dura unos minutos.
export async function confirmarBloqueoActual(secreto: string): Promise<string | null> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return 'No hay un bloqueo configurado en este dispositivo.'
  const resultado = await comprobarSecretoConFreno(config, secreto)
  if (!resultado.ok) return resultado.esperaMs > 0 ? mensajeEspera(resultado.esperaMs) : MENSAJE_CODIGO_ACTUAL
  confirmadoHasta = Date.now() + VIGENCIA_CONFIRMACION_MS
  return null
}

export function confirmacionVigente(): boolean {
  return Date.now() < confirmadoHasta
}

// Primer toque de la activacion: crea la credencial en el autenticador de
// este dispositivo y verifica la respuesta. NO guarda nada.
export async function crearDesbloqueoDispositivo(): Promise<
  { ok: true; pendiente: CredencialRegistrada } | { ok: false; motivo: MotivoFallo | 'sin-confirmar' }
> {
  if (!confirmacionVigente()) return { ok: false, motivo: 'sin-confirmar' }
  if (!(await db.seguridadApp.get(ID_BLOQUEO_APP))) return { ok: false, motivo: 'no-disponible' }
  const creada = await crearCredencial()
  return creada.ok ? { ok: true, pendiente: creada.valor } : { ok: false, motivo: creada.motivo }
}

// Segundo toque: comprueba con una ceremonia de verdad que la credencial
// recien creada funciona y SOLO entonces la guarda. Si ya habia una, la
// reemplaza. Nunca queda una configuracion a medias: o se guarda entera,
// verificada, o no se guarda nada.
export async function completarDesbloqueoDispositivo(
  pendiente: CredencialRegistrada,
): Promise<ResultadoDispositivo | 'sin-confirmar'> {
  if (!confirmacionVigente()) return 'sin-confirmar'
  const prueba = await comprobarCredencial(pendiente)
  if (!prueba.ok) return prueba.motivo
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config) return 'no-disponible'
  const ahora = new Date().toISOString()
  await db.seguridadApp.update(ID_BLOQUEO_APP, {
    desbloqueoDispositivo: { ...pendiente, creadoEn: ahora },
    updatedAt: ahora,
  })
  confirmadoHasta = 0
  const anterior = config.desbloqueoDispositivo
  if (anterior && anterior.credencialId !== pendiente.credencialId) avisarCredencialRetirada(anterior)
  return 'ok'
}

// Una credencial creada que no llego a guardarse (la persona cancelo la
// comprobacion o salio): se le avisa al sistema que ya no se usa.
export function descartarDesbloqueoPendiente(pendiente: CredencialRegistrada): void {
  avisarCredencialRetirada(pendiente)
}

// Desbloquea la app con el autenticador del dispositivo. La app se abre
// SOLO si la firma del desafio nuevo verifica contra la clave publica
// guardada; cancelar o fallar no toca el patron ni la contrasena, que
// siguen ahi como respaldo. No usa la red.
export async function desbloquearAppConDispositivo(senal?: AbortSignal): Promise<ResultadoDispositivo> {
  if (desbloqueada) return 'ok'
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config?.desbloqueoDispositivo) return 'no-disponible'
  const resultado = await comprobarCredencial(config.desbloqueoDispositivo, undefined, senal)
  if (!resultado.ok) return resultado.motivo
  intentosFallidos = 0
  if (config.bloqueadoHasta) await db.seguridadApp.update(ID_BLOQUEO_APP, { bloqueadoHasta: null })
  aplicarMinutos(config)
  abrirSesion()
  return 'ok'
}

// "Probar" en Seguridad: la misma ceremonia y la misma verificacion, sin
// cambiar el estado del bloqueo.
export async function probarDesbloqueoDispositivo(): Promise<ResultadoDispositivo> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config?.desbloqueoDispositivo) return 'no-disponible'
  const resultado = await comprobarCredencial(config.desbloqueoDispositivo)
  return resultado.ok ? 'ok' : resultado.motivo
}

// Desactiva la via rapida; el patron o la contrasena quedan igual. No
// pide el codigo: quitar una forma de entrar no abre nada.
export async function desactivarDesbloqueoDispositivo(): Promise<void> {
  const config = await db.seguridadApp.get(ID_BLOQUEO_APP)
  if (!config?.desbloqueoDispositivo) return
  await db.seguridadApp.update(ID_BLOQUEO_APP, {
    desbloqueoDispositivo: undefined,
    updatedAt: new Date().toISOString(),
  })
  avisarCredencialRetirada(config.desbloqueoDispositivo)
}

function abrirSesion(): void {
  desbloqueada = true
  instalarAutobloqueo()
  notificar()
}

export function bloquearApp(): void {
  // Al bloquear, la confirmacion del codigo actual deja de valer.
  confirmadoHasta = 0
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
