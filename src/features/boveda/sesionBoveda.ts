import { db } from '../../lib/db'
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

// Sesion de la boveda. Mientras esta desbloqueada guarda en memoria
// (nunca en disco) las claves AES derivadas de la contrasena maestra.
// La contrasena en si se descarta apenas termina la derivacion.
//
// Cada bloque cifrado lleva su propio salt. Normalmente toda la
// boveda comparte uno solo: el del bloque mas reciente, que ademas
// sirve para verificar la contrasena al desbloquear. Si aparecen
// bloques con otro salt (por ejemplo, primeras credenciales creadas
// a la vez en dos telefonos sin conexion) se derivan tambien sus
// claves, asi todas quedan legibles con una sola contrasena.

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

// Devuelve null si la boveda quedo desbloqueada, o el mensaje de
// error para mostrar al usuario.
export async function desbloquear(contrasena: string): Promise<string | null> {
  if (desbloqueada) return null
  if (!contrasena) return 'Escribe la contraseña maestra.'

  // Bloques existentes, del mas reciente al mas antiguo.
  const credenciales = await db.credenciales.filter((c) => !c.eliminadoEn).toArray()
  const bloques = credenciales
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((c) => analizarBloque(c.datosCifrados))
    .filter((bloque): bloque is BloqueCifrado => bloque !== null)

  if (bloques.length === 0) {
    // Boveda vacia: la contrasena usada aqui queda como contrasena
    // maestra al guardar la primera credencial.
    const salt = nuevaSal()
    const clave = await derivarClave(contrasena, salt, ITERACIONES_PBKDF2)
    principal = { clave, salt, iteraciones: ITERACIONES_PBKDF2 }
    clavesPorSal.set(aBase64(salt), clave)
  } else {
    // Un bloque representativo (el mas reciente) por cada salt.
    const porSal = new Map<string, BloqueCifrado>()
    for (const bloque of bloques) {
      if (!porSal.has(bloque.saltBase64)) porSal.set(bloque.saltBase64, bloque)
    }

    for (const bloque of porSal.values()) {
      const clave = await derivarClave(contrasena, bloque.salt, bloque.iteraciones)
      try {
        await descifrarTexto(clave, bloque)
      } catch {
        // Este salt se cifro con otra contrasena: queda sin clave y
        // sus credenciales se mostraran como no descifrables.
        continue
      }
      clavesPorSal.set(bloque.saltBase64, clave)
      // Las credenciales nuevas se cifran con el salt verificado mas
      // reciente (el primero, porque se recorren en ese orden).
      principal ??= { clave, salt: bloque.salt, iteraciones: bloque.iteraciones }
    }

    // La contrasena no abrio ningun bloque: es incorrecta.
    if (!principal) {
      clavesPorSal.clear()
      return 'Contraseña incorrecta.'
    }
  }

  desbloqueada = true
  instalarAutobloqueo()
  notificar()
  return null
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
