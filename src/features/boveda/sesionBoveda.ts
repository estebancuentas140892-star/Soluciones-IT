import { db, ID_VERIFICADOR } from '../../lib/db'
import {
  aBase64,
  analizarBloque,
  cifrarTexto,
  derivarClave,
  descifrarTexto,
  ITERACIONES_PBKDF2,
  nuevaSal,
  type BloqueCifrado,
} from '../../lib/crypto'
import { consultarVerificadorRemoto, subirVerificadorRemoto } from './verificadorRemoto'

// Sesion de la boveda. Mientras esta desbloqueada guarda en memoria
// (nunca en disco) las claves AES derivadas de la contrasena maestra.
// La contrasena en si se descarta apenas termina la derivacion.
//
// La contrasena maestra esta anclada al servidor mediante un
// verificador (tabla boveda_meta): un texto fijo cifrado con la clave
// maestra. Mientras exista, desbloquear siempre es VERIFICAR contra
// el; crear una contrasena nueva solo se permite cuando el servidor
// confirma explicitamente que no hay ni verificador ni credenciales.
// Borrar la cache, cambiar de dispositivo o vaciar las credenciales
// nunca habilita definir una contrasena nueva.
//
// Cada bloque cifrado lleva su propio salt. Normalmente toda la
// boveda comparte uno solo (el del verificador). Si aparecen bloques
// con otro salt (por ejemplo, credenciales creadas antes de que
// existiera el verificador, o en dos telefonos sin conexion) se
// derivan tambien sus claves, asi todas quedan legibles con una sola
// contrasena.

// Texto fijo que cifra el verificador: descifrarlo con exito (AES-GCM
// valida integridad) demuestra que la contrasena es la correcta.
export const TEXTO_VERIFICADOR = 'soluciones-it:boveda'

// Contenido descifrado de una credencial. Viaja y se guarda siempre
// como bloque cifrado dentro de Credencial.datosCifrados.
export interface DatosCredencial {
  usuario: string
  contrasena: string
  ip: string
  url: string
  notas: string
  extras: Record<string, string>
}

interface ClavePrincipal {
  clave: CryptoKey
  salt: Uint8Array<ArrayBuffer>
  iteraciones: number
}

let desbloqueada = false
let principal: ClavePrincipal | null = null
const clavesPorSal = new Map<string, CryptoKey>()

// ----------------------------------------------------------------
// Estado observable (para la interfaz)
// ----------------------------------------------------------------

const suscriptores = new Set<() => void>()

export function bovedaDesbloqueada(): boolean {
  return desbloqueada
}

export function suscribirBoveda(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

function notificar(): void {
  for (const escucha of suscriptores) escucha()
}

// ----------------------------------------------------------------
// Desbloqueo y bloqueo
// ----------------------------------------------------------------

// Con que formulario debe presentarse la pantalla de desbloqueo:
// - 'verificar': ya existe una contrasena maestra (verificador o
//   credenciales cifradas); solo se puede comprobar, jamas crear.
// - 'crear': el SERVIDOR confirmo que no existe nada; se puede
//   definir la contrasena maestra del equipo (con confirmacion).
// - 'sin-confirmar': no hay nada local y el servidor no respondio
//   (sin conexion, sin permiso o esquema sin aplicar). Por seguridad
//   no se permite crear: solo reintentar.
export type EstadoInicialBoveda = 'verificar' | 'crear' | 'sin-confirmar'

export async function estadoInicialBoveda(): Promise<EstadoInicialBoveda> {
  if (await db.bovedaMeta.get(ID_VERIFICADOR)) return 'verificar'
  if ((await bloquesLocales()).length > 0) return 'verificar'

  // Nada local: solo el servidor puede decir si es la primera vez.
  const remoto = await consultarVerificadorRemoto()
  if (remoto.tipo === 'error') return 'sin-confirmar'
  if (remoto.verificador) {
    await guardarVerificadorLocal(remoto.verificador)
    return 'verificar'
  }
  return remoto.hayCredenciales ? 'sin-confirmar' : 'crear'
}

// Devuelve null si la boveda quedo desbloqueada, o el mensaje de
// error para mostrar al usuario.
export async function desbloquear(contrasena: string): Promise<string | null> {
  if (desbloqueada) return null
  if (!contrasena) return 'Escribe la contraseña maestra.'

  let verificador = (await db.bovedaMeta.get(ID_VERIFICADOR))?.verificador ?? null
  const bloques = await bloquesLocales()

  // Sin verificador local: preguntar al servidor antes de decidir.
  // Solo una confirmacion explicita de "no hay nada" habilita crear.
  let servidorConfirmoVacio = false
  if (!verificador) {
    const remoto = await consultarVerificadorRemoto()
    if (remoto.tipo === 'ok') {
      if (remoto.verificador) {
        verificador = remoto.verificador
        await guardarVerificadorLocal(remoto.verificador)
      } else if (!remoto.hayCredenciales) {
        servidorConfirmoVacio = true
      }
    }
  }

  // 1. Hay verificador: la unica via es demostrar la contrasena.
  const bloqueVerificador = verificador ? analizarBloque(verificador) : null
  if (bloqueVerificador) {
    const clave = await derivarClave(
      contrasena,
      bloqueVerificador.salt,
      bloqueVerificador.iteraciones,
    )
    try {
      await descifrarTexto(clave, bloqueVerificador)
    } catch {
      return 'Contraseña incorrecta.'
    }
    principal = {
      clave,
      salt: bloqueVerificador.salt,
      iteraciones: bloqueVerificador.iteraciones,
    }
    clavesPorSal.set(bloqueVerificador.saltBase64, clave)
    // Bloques con otro salt (credenciales anteriores al verificador
    // o creadas sin conexion en otro telefono) tambien se abren.
    await derivarClavesDeBloques(contrasena, bloques)
    abrirSesion()
    return null
  }

  // 2. Sin verificador pero con credenciales cifradas (equipo que
  // viene de una version anterior): la contrasena se valida contra
  // ellas, como siempre, y de paso se ancla al servidor.
  if (bloques.length > 0) {
    await derivarClavesDeBloques(contrasena, bloques)
    if (!principal) {
      clavesPorSal.clear()
      return 'Contraseña incorrecta.'
    }
    abrirSesion()
    // Migracion automatica: sube el verificador para que la
    // contrasena quede anclada a la cuenta. Si falla (sin conexion o
    // esquema sin aplicar) se reintenta en el proximo desbloqueo.
    await subirVerificadorSiFalta()
    return null
  }

  // 3. Nada local y sin confirmacion del servidor: por seguridad no
  // se crea una contrasena nueva. Borrar la cache o estrenar un
  // dispositivo nunca debe reabrir el flujo de "primera vez".
  if (!servidorConfirmoVacio) {
    return 'No se pudo comprobar la contraseña maestra del equipo. Conéctate a internet, espera a que la aplicación sincronice y vuelve a intentarlo.'
  }

  // 4. Primera vez real (confirmada por el servidor): definir la
  // contrasena maestra. Primero queda anclada en el servidor; si el
  // registro falla, NO se desbloquea.
  const salt = nuevaSal()
  const clave = await derivarClave(contrasena, salt, ITERACIONES_PBKDF2)
  const verificadorNuevo = await cifrarTexto(clave, salt, ITERACIONES_PBKDF2, TEXTO_VERIFICADOR)
  const resultado = await subirVerificadorRemoto(verificadorNuevo)

  if (resultado === 'conflicto') {
    // Otro tecnico la definio en este mismo instante: verificar
    // contra la suya.
    const remoto = await consultarVerificadorRemoto()
    if (remoto.tipo === 'ok' && remoto.verificador) {
      await guardarVerificadorLocal(remoto.verificador)
      const bloqueAjeno = analizarBloque(remoto.verificador)
      if (bloqueAjeno) {
        const claveAjena = await derivarClave(contrasena, bloqueAjeno.salt, bloqueAjeno.iteraciones)
        try {
          await descifrarTexto(claveAjena, bloqueAjeno)
        } catch {
          return 'Otro técnico acaba de definir la contraseña maestra y no coincide con la que escribiste.'
        }
        principal = { clave: claveAjena, salt: bloqueAjeno.salt, iteraciones: bloqueAjeno.iteraciones }
        clavesPorSal.set(bloqueAjeno.saltBase64, claveAjena)
        abrirSesion()
        return null
      }
    }
    return 'No se pudo registrar la contraseña maestra. Inténtalo de nuevo.'
  }

  if (resultado === 'error') {
    return 'No se pudo registrar la contraseña maestra en el servidor. Revisa tu conexión e inténtalo de nuevo.'
  }

  await guardarVerificadorLocal(verificadorNuevo)
  principal = { clave, salt, iteraciones: ITERACIONES_PBKDF2 }
  clavesPorSal.set(aBase64(salt), clave)
  abrirSesion()
  return null
}

// Resultado de comprobar la contrasena maestra para una accion
// puntual (por ejemplo, confirmar una eliminacion sensible):
// - 'correcta': coincide con el verificador del equipo.
// - 'incorrecta': hay verificador pero la contrasena no coincide.
// - 'sin-verificar': no hay contra que comprobar (sin verificador
//   local y el servidor no respondio); la accion debe negarse.
export type ResultadoVerificacion = 'correcta' | 'incorrecta' | 'sin-verificar'

// Comprueba la contrasena maestra SIN abrir la sesion de la boveda ni
// tocar ningun estado (ni desbloquear, ni autobloqueo, ni claves en
// memoria). Es una comprobacion de un solo uso para autorizar acciones
// sensibles. Funciona sin conexion si el verificador ya esta local.
export async function verificarContrasenaMaestra(
  contrasena: string,
): Promise<ResultadoVerificacion> {
  if (!contrasena) return 'incorrecta'

  let verificador = (await db.bovedaMeta.get(ID_VERIFICADOR))?.verificador ?? null
  if (!verificador) {
    const remoto = await consultarVerificadorRemoto()
    if (remoto.tipo === 'ok' && remoto.verificador) {
      verificador = remoto.verificador
      await guardarVerificadorLocal(remoto.verificador)
    }
  }

  const bloque = verificador ? analizarBloque(verificador) : null
  if (!bloque) return 'sin-verificar'

  const clave = await derivarClave(contrasena, bloque.salt, bloque.iteraciones)
  try {
    await descifrarTexto(clave, bloque)
    return 'correcta'
  } catch {
    return 'incorrecta'
  }
}

// Bloques cifrados de las credenciales locales, del mas reciente al
// mas antiguo (las credenciales nuevas se cifran con el salt del
// bloque verificado mas reciente cuando no hay verificador).
async function bloquesLocales(): Promise<BloqueCifrado[]> {
  const credenciales = await db.credenciales.filter((c) => !c.eliminadoEn).toArray()
  return credenciales
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((c) => analizarBloque(c.datosCifrados))
    .filter((bloque): bloque is BloqueCifrado => bloque !== null)
}

// Deriva la clave de cada salt distinto entre los bloques dados y
// conserva las que si descifran (un salt cifrado con otra contrasena
// queda sin clave y sus credenciales se muestran como no
// descifrables). Si aun no hay clave principal, la primera que
// funcione queda como principal.
async function derivarClavesDeBloques(
  contrasena: string,
  bloques: BloqueCifrado[],
): Promise<void> {
  const porSal = new Map<string, BloqueCifrado>()
  for (const bloque of bloques) {
    if (!clavesPorSal.has(bloque.saltBase64) && !porSal.has(bloque.saltBase64)) {
      porSal.set(bloque.saltBase64, bloque)
    }
  }
  for (const bloque of porSal.values()) {
    const clave = await derivarClave(contrasena, bloque.salt, bloque.iteraciones)
    try {
      await descifrarTexto(clave, bloque)
    } catch {
      continue
    }
    clavesPorSal.set(bloque.saltBase64, clave)
    principal ??= { clave, salt: bloque.salt, iteraciones: bloque.iteraciones }
  }
}

async function guardarVerificadorLocal(verificador: string): Promise<void> {
  await db.bovedaMeta.put({
    id: ID_VERIFICADOR,
    verificador,
    updatedAt: new Date().toISOString(),
  })
}

// Ancla al servidor la contrasena que acaba de validarse contra las
// credenciales cifradas (migracion desde la version sin verificador).
// Solo guarda la copia local cuando el servidor la acepto: asi, si
// otro dispositivo gano la carrera, se adopta el verificador de el.
async function subirVerificadorSiFalta(): Promise<void> {
  if (!principal) return
  if (await db.bovedaMeta.get(ID_VERIFICADOR)) return
  const verificador = await cifrarTexto(
    principal.clave,
    principal.salt,
    principal.iteraciones,
    TEXTO_VERIFICADOR,
  )
  const resultado = await subirVerificadorRemoto(verificador)
  if (resultado === 'creado') {
    await guardarVerificadorLocal(verificador)
  } else if (resultado === 'conflicto') {
    const remoto = await consultarVerificadorRemoto()
    if (remoto.tipo === 'ok' && remoto.verificador) {
      await guardarVerificadorLocal(remoto.verificador)
    }
  }
}

function abrirSesion(): void {
  desbloqueada = true
  instalarAutobloqueo()
  notificar()
}

export function bloquear(): void {
  if (!desbloqueada && !principal) return
  desbloqueada = false
  principal = null
  clavesPorSal.clear()
  desinstalarAutobloqueo()
  notificar()
}

// ----------------------------------------------------------------
// Cifrado y descifrado de credenciales
// ----------------------------------------------------------------

export async function cifrarCredencial(datos: DatosCredencial): Promise<string> {
  if (!desbloqueada || !principal) throw new Error('La bóveda está bloqueada.')
  return cifrarTexto(principal.clave, principal.salt, principal.iteraciones, JSON.stringify(datos))
}

// Devuelve null si la boveda esta bloqueada, el bloque es invalido o
// se cifro con una contrasena distinta a la actual.
export async function descifrarCredencial(datosCifrados: string): Promise<DatosCredencial | null> {
  if (!desbloqueada) return null
  const bloque = analizarBloque(datosCifrados)
  if (!bloque) return null
  const clave = clavesPorSal.get(bloque.saltBase64)
  if (!clave) return null
  try {
    const texto = await descifrarTexto(clave, bloque)
    const datos = JSON.parse(texto) as Partial<DatosCredencial>
    return {
      usuario: datos.usuario ?? '',
      contrasena: datos.contrasena ?? '',
      ip: datos.ip ?? '',
      url: datos.url ?? '',
      notas: datos.notas ?? '',
      extras: datos.extras ?? {},
    }
  } catch {
    return null
  }
}

// ----------------------------------------------------------------
// Autobloqueo por inactividad
// ----------------------------------------------------------------

export const OPCIONES_AUTOBLOQUEO_MIN = [1, 5, 15, 30]

const CLAVE_AJUSTE_AUTOBLOQUEO = 'boveda_autobloqueo_minutos'
const MINUTOS_POR_DEFECTO = 5
const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown'] as const

let temporizador: ReturnType<typeof setTimeout> | null = null

export function obtenerMinutosAutobloqueo(): number {
  if (typeof localStorage === 'undefined') return MINUTOS_POR_DEFECTO
  const guardado = Number(localStorage.getItem(CLAVE_AJUSTE_AUTOBLOQUEO))
  return OPCIONES_AUTOBLOQUEO_MIN.includes(guardado) ? guardado : MINUTOS_POR_DEFECTO
}

export function definirMinutosAutobloqueo(minutos: number): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CLAVE_AJUSTE_AUTOBLOQUEO, String(minutos))
  }
  if (desbloqueada) reiniciarTemporizador()
}

function reiniciarTemporizador(): void {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(bloquear, obtenerMinutosAutobloqueo() * 60_000)
}

function registrarActividad(): void {
  reiniciarTemporizador()
}

function instalarAutobloqueo(): void {
  // Solo en el navegador: en las pruebas no hay que programar nada.
  if (typeof document === 'undefined') return
  reiniciarTemporizador()
  for (const evento of EVENTOS_ACTIVIDAD) {
    document.addEventListener(evento, registrarActividad, true)
  }
}

function desinstalarAutobloqueo(): void {
  if (temporizador) {
    clearTimeout(temporizador)
    temporizador = null
  }
  if (typeof document === 'undefined') return
  for (const evento of EVENTOS_ACTIVIDAD) {
    document.removeEventListener(evento, registrarActividad, true)
  }
}
