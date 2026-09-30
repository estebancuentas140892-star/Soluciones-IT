// WEBAUTHN VERIFICADO EN EL PROPIO DISPOSITIVO, SIN SERVIDOR (tarea 278).
//
// El desbloqueo del dispositivo protege el bloqueo LOCAL de la app: el
// autenticador del sistema (huella, rostro, Windows Hello o el código del
// teléfono) firma un desafío con una clave privada que nunca sale de él, y
// la app comprueba esa firma con la clave pública que guardó al activarlo.
// Todo ocurre en el teléfono: funciona sin red y no reemplaza el inicio de
// sesión de Supabase ni abre la Bóveda.
//
// Este módulo es la parte pura: lee y comprueba lo que devuelve el
// navegador según la especificación W3C (Web Authentication, nivel 3,
// § 7.1 y § 7.2) y verifica la firma con Web Crypto. No toca la base ni
// la interfaz, y no confía en nada por haber llegado: la respuesta de
// `navigator.credentials.get()` solo vale si cada comprobación pasa.
//
// Algoritmos: ES256 (-7), el de casi todos los autenticadores, y RS256
// (-257), el de Windows Hello (Chromium lo pide para no dejar fuera a
// Windows). La clave pública llega ya en SubjectPublicKeyInfo gracias a
// `getPublicKey()` (Chrome 85, Firefox 119, Safari 16): no hace falta
// decodificar CBOR, y un navegador sin esa función no ofrece la opción.

export const ES256 = -7
export const RS256 = -257
export type AlgoritmoCose = typeof ES256 | typeof RS256
export const ALGORITMOS_ADMITIDOS: readonly AlgoritmoCose[] = [ES256, RS256]

/** Bytes del desafío de cada ceremonia (el mínimo recomendado es 16). */
export const BYTES_DESAFIO = 32

// Datos del autenticador (§ 6.1): rpIdHash (32) | flags (1) | signCount (4)
// y, solo al registrar, los datos de la credencial atestada.
const LARGO_RP_ID_HASH = 32
const MIN_DATOS_AUTENTICADOR = LARGO_RP_ID_HASH + 1 + 4
const LARGO_AAGUID = 16
// El identificador de una credencial no pasa de 1023 bytes (§ 6.5.1).
const MAX_LARGO_CREDENCIAL = 1023
// Una clave RSA de menos de 2048 bits no se acepta.
const MIN_BITS_RSA = 2048

const BANDERA_UP = 0x01 // el usuario estaba presente
const BANDERA_UV = 0x04 // el dispositivo verificó al usuario
const BANDERA_BE = 0x08 // la credencial puede respaldarse (multidispositivo)
const BANDERA_BS = 0x10 // la credencial está respaldada
const BANDERA_AT = 0x40 // incluye los datos de la credencial atestada

/** Por qué se rechazó una respuesta. Solo para pruebas y registro: la persona ve un único mensaje. */
export type MotivoRechazo =
  | 'codificacion'
  | 'credencial'
  | 'usuario'
  | 'datos-cliente'
  | 'tipo'
  | 'desafio'
  | 'origen'
  | 'origen-cruzado'
  | 'datos-autenticador'
  | 'rp-id'
  | 'presencia'
  | 'verificacion'
  | 'respaldo'
  | 'clave'
  | 'firma'

export class ErrorWebAuthn extends Error {
  readonly motivo: MotivoRechazo

  constructor(motivo: MotivoRechazo) {
    super(`Respuesta del autenticador rechazada: ${motivo}`)
    this.name = 'ErrorWebAuthn'
    this.motivo = motivo
  }
}

// ----------------------------------------------------------------
// Bytes y base64url
// ----------------------------------------------------------------

/** Copia a un `Uint8Array` propio lo que llegue como ArrayBuffer o vista. */
export function comoBytes(valor: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  if (ArrayBuffer.isView(valor)) {
    return new Uint8Array(valor.buffer.slice(valor.byteOffset, valor.byteOffset + valor.byteLength) as ArrayBuffer)
  }
  return new Uint8Array(valor.slice(0))
}

/** Base64url sin relleno (RFC 4648 § 5), como lo usa WebAuthn. */
export function aBase64Url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Lo contrario de `aBase64Url`. Rechaza cualquier carácter fuera del alfabeto o un largo imposible. */
export function desdeBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) throw new ErrorWebAuthn('codificacion')
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4)
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/** Igualdad de bytes sin salir en el primer byte distinto. */
export function mismosBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i]
  return diferencia === 0
}

function unir(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const salida = new Uint8Array(a.length + b.length)
  salida.set(a, 0)
  salida.set(b, a.length)
  return salida
}

async function sha256(datos: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', datos))
}

/**
 * Un desafío nuevo para cada ceremonia: 32 bytes del generador
 * criptográfico del sistema. Nunca `Math.random()`, una fecha, un contador
 * ni un texto fijo: un desafío previsible permitiría reutilizar una firma.
 */
export function nuevoDesafio(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(BYTES_DESAFIO))
}

// ----------------------------------------------------------------
// Datos del cliente (clientDataJSON, § 5.8.1)
// ----------------------------------------------------------------

export interface DatosCliente {
  type: string
  challenge: string
  origin: string
  crossOrigin?: boolean
  topOrigin?: string
}

/** Lee el clientDataJSON (UTF-8 estricto; un BOM inicial se descarta, como pide § 7.2). */
export function leerDatosCliente(clientDataJSON: Uint8Array<ArrayBuffer>): DatosCliente {
  let valor: unknown
  try {
    valor = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(clientDataJSON))
  } catch {
    throw new ErrorWebAuthn('datos-cliente')
  }
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new ErrorWebAuthn('datos-cliente')
  const { type, challenge, origin, crossOrigin, topOrigin } = valor as Record<string, unknown>
  if (typeof type !== 'string' || typeof challenge !== 'string' || typeof origin !== 'string') {
    throw new ErrorWebAuthn('datos-cliente')
  }
  if (crossOrigin !== undefined && typeof crossOrigin !== 'boolean') throw new ErrorWebAuthn('datos-cliente')
  if (topOrigin !== undefined && typeof topOrigin !== 'string') throw new ErrorWebAuthn('datos-cliente')
  return { type, challenge, origin, crossOrigin, topOrigin }
}

/**
 * Tipo de ceremonia, desafío exacto y origen exacto. La app nunca corre
 * dentro de un iframe de otro origen, así que una respuesta marcada como
 * de origen cruzado (o con `topOrigin`) no se acepta.
 */
export function comprobarDatosCliente(
  datos: DatosCliente,
  esperado: { tipo: 'webauthn.create' | 'webauthn.get'; desafio: Uint8Array; origen: string },
): void {
  if (datos.type !== esperado.tipo) throw new ErrorWebAuthn('tipo')
  if (datos.challenge !== aBase64Url(esperado.desafio)) throw new ErrorWebAuthn('desafio')
  if (datos.origin !== esperado.origen) throw new ErrorWebAuthn('origen')
  if (datos.crossOrigin === true || datos.topOrigin !== undefined) throw new ErrorWebAuthn('origen-cruzado')
}

// ----------------------------------------------------------------
// Datos del autenticador (authenticatorData, § 6.1)
// ----------------------------------------------------------------

export interface DatosAutenticador {
  bytes: Uint8Array<ArrayBuffer>
  rpIdHash: Uint8Array<ArrayBuffer>
  banderas: number
  contador: number
}

export function leerDatosAutenticador(bytes: Uint8Array<ArrayBuffer>): DatosAutenticador {
  if (bytes.length < MIN_DATOS_AUTENTICADOR) throw new ErrorWebAuthn('datos-autenticador')
  return {
    bytes,
    rpIdHash: bytes.slice(0, LARGO_RP_ID_HASH),
    banderas: bytes[LARGO_RP_ID_HASH],
    contador: new DataView(bytes.buffer, bytes.byteOffset + LARGO_RP_ID_HASH + 1, 4).getUint32(0),
  }
}

/** SHA-256 del RP ID, que es lo que el autenticador pone al principio de sus datos. */
export function hashRpId(rpId: string): Promise<Uint8Array<ArrayBuffer>> {
  return sha256(new TextEncoder().encode(rpId))
}

/**
 * RP ID, presencia (UP) y verificación del usuario (UV), obligatoria: esto
 * se anuncia como desbloqueo del dispositivo y el dispositivo tiene que
 * haber verificado a la persona. BS sin BE es incoherente; BE no puede
 * cambiar desde el registro. AT va solo al registrar.
 *
 * El contador de firmas (`contador`) no se usa: muchos autenticadores
 * actuales lo dejan siempre en 0, y la especificación dice que un
 * contador que no sube es una señal, no una prueba (§ 6.1.1). Rechazar
 * por él bloquearía a quien no hizo nada, y aquí no protege de nada que
 * la firma no cubra.
 */
export async function comprobarDatosAutenticador(
  datos: DatosAutenticador,
  esperado: { rpId: string; ceremonia: 'registro' | 'asercion'; respaldable?: boolean },
): Promise<void> {
  if (!mismosBytes(datos.rpIdHash, await hashRpId(esperado.rpId))) throw new ErrorWebAuthn('rp-id')
  if (!(datos.banderas & BANDERA_UP)) throw new ErrorWebAuthn('presencia')
  if (!(datos.banderas & BANDERA_UV)) throw new ErrorWebAuthn('verificacion')
  const respaldable = (datos.banderas & BANDERA_BE) !== 0
  if (!respaldable && (datos.banderas & BANDERA_BS) !== 0) throw new ErrorWebAuthn('respaldo')
  if (esperado.respaldable !== undefined && respaldable !== esperado.respaldable) throw new ErrorWebAuthn('respaldo')
  const atestada = (datos.banderas & BANDERA_AT) !== 0
  if (atestada !== (esperado.ceremonia === 'registro')) throw new ErrorWebAuthn('datos-autenticador')
}

export function esRespaldable(datos: DatosAutenticador): boolean {
  return (datos.banderas & BANDERA_BE) !== 0
}

/** El identificador de la credencial que el autenticador declara haber creado (§ 6.5.1). */
export function credencialAtestada(datos: DatosAutenticador): Uint8Array<ArrayBuffer> {
  const inicio = MIN_DATOS_AUTENTICADOR + LARGO_AAGUID
  if (datos.bytes.length < inicio + 2) throw new ErrorWebAuthn('datos-autenticador')
  const largo = (datos.bytes[inicio] << 8) | datos.bytes[inicio + 1]
  if (largo === 0 || largo > MAX_LARGO_CREDENCIAL || datos.bytes.length < inicio + 2 + largo) {
    throw new ErrorWebAuthn('datos-autenticador')
  }
  return datos.bytes.slice(inicio + 2, inicio + 2 + largo)
}

// ----------------------------------------------------------------
// Firma
// ----------------------------------------------------------------

/**
 * Firma ECDSA de WebAuthn a la forma que verifica Web Crypto.
 *
 * WebAuthn la entrega en ASN.1 DER (§ 6.5.5, RFC 3279 § 2.2.3):
 *   30 L | 02 Lr r | 02 Ls s
 * y Web Crypto verifica ECDSA con r y s crudos, cada uno de 32 bytes en
 * P-256 (IEEE P1363). Estricta: solo largos cortos (una firma P-256 nunca
 * pasa de 72 bytes), enteros positivos, sin ceros de relleno que sobren,
 * ni cero, ni más largos que la curva, y nada antes ni después. Cualquier
 * otra cosa es una firma inválida.
 */
export function derAFirmaCruda(der: Uint8Array, bytesPorEntero = 32): Uint8Array<ArrayBuffer> {
  let posicion = 0
  function leerByte(): number {
    if (posicion >= der.length) throw new ErrorWebAuthn('firma')
    return der[posicion++]
  }
  function leerLargo(): number {
    const largo = leerByte()
    if (largo >= 0x80) throw new ErrorWebAuthn('firma')
    return largo
  }
  function leerEntero(): Uint8Array {
    if (leerByte() !== 0x02) throw new ErrorWebAuthn('firma')
    const largo = leerLargo()
    if (largo === 0 || posicion + largo > der.length) throw new ErrorWebAuthn('firma')
    let valor = der.subarray(posicion, posicion + largo)
    posicion += largo
    // Bit alto encendido sin un 0x00 delante: entero negativo.
    if (valor[0] & 0x80) throw new ErrorWebAuthn('firma')
    if (valor[0] === 0x00) {
      // El único 0x00 permitido es el que evita que se lea como negativo.
      if (valor.length === 1 || !(valor[1] & 0x80)) throw new ErrorWebAuthn('firma')
      valor = valor.subarray(1)
    }
    if (valor.length > bytesPorEntero) throw new ErrorWebAuthn('firma')
    return valor
  }

  if (leerByte() !== 0x30) throw new ErrorWebAuthn('firma')
  const largoSecuencia = leerLargo()
  if (largoSecuencia !== der.length - posicion) throw new ErrorWebAuthn('firma')
  const r = leerEntero()
  const s = leerEntero()
  if (posicion !== der.length) throw new ErrorWebAuthn('firma')

  const cruda = new Uint8Array(bytesPorEntero * 2)
  cruda.set(r, bytesPorEntero - r.length)
  cruda.set(s, bytesPorEntero * 2 - s.length)
  return cruda
}

/** Importa la clave pública guardada (SubjectPublicKeyInfo) para verificar, y solo para eso. */
export async function importarClavePublica(spki: Uint8Array<ArrayBuffer>, algoritmo: number): Promise<CryptoKey> {
  try {
    if (algoritmo === ES256) {
      return await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    }
    if (algoritmo === RS256) {
      const clave = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
        'verify',
      ])
      if ((clave.algorithm as RsaHashedKeyAlgorithm).modulusLength < MIN_BITS_RSA) throw new ErrorWebAuthn('clave')
      return clave
    }
  } catch {
    throw new ErrorWebAuthn('clave')
  }
  throw new ErrorWebAuthn('clave')
}

/** La firma cubre `authenticatorData || SHA-256(clientDataJSON)` (§ 7.2). */
export async function firmaValida(
  clave: CryptoKey,
  algoritmo: AlgoritmoCose,
  firma: Uint8Array<ArrayBuffer>,
  authenticatorData: Uint8Array<ArrayBuffer>,
  clientDataJSON: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const firmado = unir(authenticatorData, await sha256(clientDataJSON))
  if (algoritmo === ES256) {
    let cruda: Uint8Array<ArrayBuffer>
    try {
      cruda = derAFirmaCruda(firma)
    } catch {
      return false
    }
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, clave, cruda, firmado)
  }
  return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, clave, firma, firmado)
}

// ----------------------------------------------------------------
// Ceremonias completas
// ----------------------------------------------------------------

/** Lo que se guarda de una credencial: solo material público. */
export interface CredencialRegistrada {
  /** Identificador de la credencial (rawId), en base64url. */
  credencialId: string
  /** Clave pública en SubjectPublicKeyInfo (DER), en base64url. */
  clavePublica: string
  algoritmo: AlgoritmoCose
  /** El RP ID con el que se creó: el host de la app. */
  rpId: string
  /** El `user.id` aleatorio con el que se creó (user handle), en base64url. */
  usuarioId: string
  /** Si el autenticador la declaró respaldable (BE): no puede cambiar después. */
  respaldable: boolean
}

export interface RespuestaRegistro {
  rawId: Uint8Array<ArrayBuffer>
  clientDataJSON: Uint8Array<ArrayBuffer>
  /** `getAuthenticatorData()`. */
  authenticatorData: Uint8Array<ArrayBuffer>
  /** `getPublicKey()`: SubjectPublicKeyInfo, o null si el navegador no la sabe dar. */
  clavePublica: Uint8Array<ArrayBuffer> | null
  /** `getPublicKeyAlgorithm()`. */
  algoritmo: number
}

/** § 7.1, sin atestación (se pide `attestation: 'none'`): devuelve lo que se guardará. */
export async function verificarRegistro(
  respuesta: RespuestaRegistro,
  esperado: { desafio: Uint8Array; origen: string; rpId: string; usuarioId: Uint8Array },
): Promise<CredencialRegistrada> {
  comprobarDatosCliente(leerDatosCliente(respuesta.clientDataJSON), {
    tipo: 'webauthn.create',
    desafio: esperado.desafio,
    origen: esperado.origen,
  })
  const datos = leerDatosAutenticador(respuesta.authenticatorData)
  await comprobarDatosAutenticador(datos, { rpId: esperado.rpId, ceremonia: 'registro' })
  if (!mismosBytes(credencialAtestada(datos), respuesta.rawId)) throw new ErrorWebAuthn('credencial')
  const algoritmo = ALGORITMOS_ADMITIDOS.find((a) => a === respuesta.algoritmo)
  if (algoritmo === undefined || !respuesta.clavePublica) throw new ErrorWebAuthn('clave')
  // Importarla ya comprueba que es una clave de verdad de ese algoritmo.
  await importarClavePublica(respuesta.clavePublica, algoritmo)
  return {
    credencialId: aBase64Url(respuesta.rawId),
    clavePublica: aBase64Url(respuesta.clavePublica),
    algoritmo,
    rpId: esperado.rpId,
    usuarioId: aBase64Url(esperado.usuarioId),
    respaldable: esRespaldable(datos),
  }
}

export interface RespuestaAsercion {
  rawId: Uint8Array<ArrayBuffer>
  clientDataJSON: Uint8Array<ArrayBuffer>
  authenticatorData: Uint8Array<ArrayBuffer>
  signature: Uint8Array<ArrayBuffer>
  userHandle: Uint8Array<ArrayBuffer> | null
}

/**
 * § 7.2 contra la credencial guardada: misma credencial, mismo usuario,
 * datos del cliente, datos del autenticador y firma. Si no lanza, la
 * persona se verificó en ESTE dispositivo ante ESTE desafío.
 */
export async function verificarAsercion(
  respuesta: RespuestaAsercion,
  registro: CredencialRegistrada,
  esperado: { desafio: Uint8Array; origen: string },
): Promise<void> {
  if (!mismosBytes(respuesta.rawId, desdeBase64Url(registro.credencialId))) throw new ErrorWebAuthn('credencial')
  if (respuesta.userHandle && respuesta.userHandle.length > 0) {
    if (!mismosBytes(respuesta.userHandle, desdeBase64Url(registro.usuarioId))) throw new ErrorWebAuthn('usuario')
  }
  comprobarDatosCliente(leerDatosCliente(respuesta.clientDataJSON), {
    tipo: 'webauthn.get',
    desafio: esperado.desafio,
    origen: esperado.origen,
  })
  const datos = leerDatosAutenticador(respuesta.authenticatorData)
  await comprobarDatosAutenticador(datos, {
    rpId: registro.rpId,
    ceremonia: 'asercion',
    respaldable: registro.respaldable,
  })
  const clave = await importarClavePublica(desdeBase64Url(registro.clavePublica), registro.algoritmo)
  const valida = await firmaValida(
    clave,
    registro.algoritmo,
    respuesta.signature,
    respuesta.authenticatorData,
    respuesta.clientDataJSON,
  )
  if (!valida) throw new ErrorWebAuthn('firma')
}
