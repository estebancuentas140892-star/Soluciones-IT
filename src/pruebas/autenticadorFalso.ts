import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { vi } from 'vitest'

// UN AUTENTICADOR DE PLATAFORMA DE MENTIRA PARA LAS PRUEBAS (tarea 278).
//
// Responde a `navigator.credentials.create()` y `.get()` como uno de
// verdad: claves y firmas con `node:crypto` (ECDSA P-256 con la firma en
// DER, como la entrega WebAuthn, o RSA PKCS#1 v1.5), datos del
// autenticador con el hash del RP ID y sus banderas, y el clientDataJSON
// con el desafío y el origen que recibió. Es una implementación aparte de
// `src/lib/webauthn.ts`: si las dos coinciden, no es porque una copie a la
// otra.
//
// `alterarSiguiente` estropea a propósito la próxima respuesta (otro
// desafío, otro origen, otro RP ID, sin UV, firma falsa, otra credencial)
// para comprobar que la app NO se abre con ella. Nada de lo que genera
// sirve fuera de estas pruebas.

type Algoritmo = -7 | -257

interface CredencialFalsa {
  id: Uint8Array
  rpId: string
  usuarioId: Uint8Array
  privada: KeyObject
  spki: Uint8Array
  algoritmo: Algoritmo
  contador: number
}

export interface Alteracion {
  tipo?: string
  desafio?: string
  origen?: string
  rpId?: string
  sinUV?: boolean
  sinUP?: boolean
  firmaFalsa?: boolean
  otroId?: boolean
  otroUsuario?: boolean
  crossOrigin?: boolean
  topOrigin?: string
  respaldada?: boolean
  conAT?: boolean
  firmaCruda?: boolean
}

const BANDERA_UP = 0x01
const BANDERA_UV = 0x04
const BANDERA_BE = 0x08
const BANDERA_BS = 0x10
const BANDERA_AT = 0x40

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function comoArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(bytes.length)
  copia.set(bytes)
  return copia.buffer
}

function bytesDe(fuente: BufferSource): Uint8Array {
  return ArrayBuffer.isView(fuente)
    ? new Uint8Array(fuente.buffer, fuente.byteOffset, fuente.byteLength)
    : new Uint8Array(fuente)
}

function sha256(datos: Uint8Array | string): Buffer {
  return createHash('sha256').update(datos).digest()
}

function errorDom(nombre: string): Error {
  return new DOMException(`Simulado: ${nombre}`, nombre)
}

export class AutenticadorFalso {
  readonly credenciales = new Map<string, CredencialFalsa>()
  readonly llamadas: { create: CredentialCreationOptions[]; get: CredentialRequestOptions[] } = { create: [], get: [] }
  /** El origen que el navegador pondría en el clientDataJSON. */
  origen: string
  algoritmo: Algoritmo
  /** Si el dispositivo verifica a la persona (UV). */
  verificaUsuario = true
  /** Si la credencial es de las que se respaldan (BE). */
  respaldable = false
  /** Estropea la PRÓXIMA respuesta, y solo esa. */
  alterarSiguiente: Alteracion | null = null
  /** La próxima llamada falla con este DOMException (NotAllowedError = cancelar). */
  errorSiguiente: string | null = null

  constructor(opciones: { origen: string; algoritmo?: Algoritmo }) {
    this.origen = opciones.origen
    this.algoritmo = opciones.algoritmo ?? -7
  }

  /** El dispositivo pierde sus credenciales (otro navegador, datos borrados). */
  olvidarTodo(): void {
    this.credenciales.clear()
  }

  private tomarAlteracion(): Alteracion {
    const alteracion = this.alterarSiguiente ?? {}
    this.alterarSiguiente = null
    return alteracion
  }

  private tomarError(): void {
    const nombre = this.errorSiguiente
    this.errorSiguiente = null
    if (nombre) throw errorDom(nombre)
  }

  private datosCliente(tipo: string, desafio: Uint8Array, alteracion: Alteracion): Uint8Array {
    const datos: Record<string, unknown> = {
      type: alteracion.tipo ?? tipo,
      challenge: alteracion.desafio ?? base64url(desafio),
      origin: alteracion.origen ?? this.origen,
      crossOrigin: alteracion.crossOrigin ?? false,
    }
    if (alteracion.topOrigin) datos.topOrigin = alteracion.topOrigin
    return new TextEncoder().encode(JSON.stringify(datos))
  }

  private banderas(alteracion: Alteracion, extra = 0): number {
    let banderas = extra
    if (!alteracion.sinUP) banderas |= BANDERA_UP
    if (this.verificaUsuario && !alteracion.sinUV) banderas |= BANDERA_UV
    if (this.respaldable) banderas |= BANDERA_BE
    if (alteracion.respaldada) banderas |= BANDERA_BS
    if (alteracion.conAT) banderas |= BANDERA_AT
    return banderas
  }

  async create(opciones: CredentialCreationOptions): Promise<Credential> {
    this.llamadas.create.push(opciones)
    this.tomarError()
    const pk = opciones.publicKey
    if (!pk) throw errorDom('NotSupportedError')
    const alteracion = this.tomarAlteracion()
    const algoritmo = pk.pubKeyCredParams.some((p) => p.alg === this.algoritmo) ? this.algoritmo : null
    if (algoritmo === null) throw errorDom('NotSupportedError')
    const rpId = pk.rp.id ?? new URL(this.origen).hostname
    const { privateKey, publicKey } =
      algoritmo === -7
        ? generateKeyPairSync('ec', { namedCurve: 'P-256' })
        : generateKeyPairSync('rsa', { modulusLength: 2048 })
    const id = new Uint8Array(randomBytes(32))
    const credencial: CredencialFalsa = {
      id,
      rpId,
      usuarioId: new Uint8Array(bytesDe(pk.user.id)),
      privada: privateKey,
      spki: new Uint8Array(publicKey.export({ type: 'spki', format: 'der' })),
      algoritmo,
      contador: 0,
    }
    this.credenciales.set(base64url(id), credencial)

    const idDeclarado = alteracion.otroId ? new Uint8Array(randomBytes(32)) : id
    const largo = Buffer.alloc(2)
    largo.writeUInt16BE(idDeclarado.length)
    const datosAutenticador = Buffer.concat([
      sha256(alteracion.rpId ?? rpId),
      Buffer.from([this.banderas(alteracion, BANDERA_AT)]),
      Buffer.alloc(4),
      Buffer.alloc(16),
      largo,
      Buffer.from(idDeclarado),
      // La clave en COSE: la app no la lee (usa getPublicKey), basta con que esté.
      Buffer.from([0xa0]),
    ])
    const clientDataJSON = this.datosCliente('webauthn.create', bytesDe(pk.challenge), alteracion)
    return {
      type: 'public-key',
      id: base64url(id),
      rawId: comoArrayBuffer(id),
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: comoArrayBuffer(clientDataJSON),
        attestationObject: comoArrayBuffer(new Uint8Array([0xa0])),
        getAuthenticatorData: () => comoArrayBuffer(datosAutenticador),
        getPublicKey: () => comoArrayBuffer(credencial.spki),
        getPublicKeyAlgorithm: () => algoritmo,
        getTransports: () => ['internal'],
      },
    } as unknown as Credential
  }

  async get(opciones: CredentialRequestOptions): Promise<Credential> {
    this.llamadas.get.push(opciones)
    this.tomarError()
    const pk = opciones.publicKey
    if (!pk) throw errorDom('NotSupportedError')
    if (opciones.signal?.aborted) throw errorDom('AbortError')
    const alteracion = this.tomarAlteracion()
    // Como un autenticador de verdad: solo firma con una credencial que
    // tiene y que está en la lista permitida; si no, el navegador dice
    // NotAllowedError (igual que al cancelar).
    const permitida = (pk.allowCredentials ?? [])
      .map((c) => this.credenciales.get(base64url(bytesDe(c.id))))
      .find((c) => c !== undefined)
    if (!permitida || (pk.rpId && pk.rpId !== permitida.rpId)) throw errorDom('NotAllowedError')

    permitida.contador = 0 // como muchos autenticadores de plataforma: siempre 0
    const contador = Buffer.alloc(4)
    contador.writeUInt32BE(permitida.contador)
    const datosAutenticador = Buffer.concat([
      sha256(alteracion.rpId ?? permitida.rpId),
      Buffer.from([this.banderas(alteracion)]),
      contador,
    ])
    const clientDataJSON = this.datosCliente('webauthn.get', bytesDe(pk.challenge), alteracion)
    const firmado = Buffer.concat([datosAutenticador, sha256(clientDataJSON)])
    let firma: Uint8Array =
      permitida.algoritmo === -7
        ? sign('sha256', firmado, { key: permitida.privada, dsaEncoding: alteracion.firmaCruda ? 'ieee-p1363' : 'der' })
        : sign('sha256', firmado, permitida.privada)
    if (alteracion.firmaFalsa) {
      firma = new Uint8Array(firma)
      firma[firma.length - 3] ^= 0x01
    }
    const rawId = alteracion.otroId ? new Uint8Array(randomBytes(32)) : permitida.id
    const usuario = alteracion.otroUsuario ? new Uint8Array(randomBytes(16)) : permitida.usuarioId
    return {
      type: 'public-key',
      id: base64url(rawId),
      rawId: comoArrayBuffer(rawId),
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: comoArrayBuffer(clientDataJSON),
        authenticatorData: comoArrayBuffer(datosAutenticador),
        signature: comoArrayBuffer(firma),
        userHandle: comoArrayBuffer(usuario),
      },
    } as unknown as Credential
  }
}

/** Origen y host con los que corren las pruebas (un dominio reservado para pruebas). */
export const ORIGEN_PRUEBA = 'https://soluciones-it.test'
export const HOST_PRUEBA = 'soluciones-it.test'

/**
 * Deja el "navegador" de la prueba con WebAuthn y este autenticador de
 * plataforma: contexto seguro, ventana principal, origen de prueba y
 * `PublicKeyCredential` con `getPublicKey()`. Con `disponible: false` el
 * dispositivo dice que no tiene autenticador que verifique al usuario.
 * Se deshace con `vi.unstubAllGlobals()`.
 */
export function instalarAutenticador(
  autenticador: AutenticadorFalso,
  opciones: { disponible?: boolean; conGetPublicKey?: boolean } = {},
): void {
  const disponible = opciones.disponible ?? true
  const global = globalThis as Record<string, unknown>
  if (typeof global.window === 'undefined') {
    const ventana: Record<string, unknown> = {}
    ventana.self = ventana
    ventana.top = ventana
    vi.stubGlobal('window', ventana)
  }
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('location', new URL(`${ORIGEN_PRUEBA}/`))
  vi.stubGlobal('navigator', {
    ...(typeof navigator === 'undefined' ? {} : navigator),
    onLine: false,
    userAgent: 'prueba',
    credentials: {
      create: (o: CredentialCreationOptions) => autenticador.create(o),
      get: (o: CredentialRequestOptions) => autenticador.get(o),
    },
  })
  vi.stubGlobal('PublicKeyCredential', {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => disponible,
  })
  class RespuestaAtestacion {}
  if (opciones.conGetPublicKey !== false) {
    Object.assign(RespuestaAtestacion.prototype, {
      getPublicKey() {},
      getPublicKeyAlgorithm() {},
      getAuthenticatorData() {},
    })
  }
  vi.stubGlobal('AuthenticatorAttestationResponse', RespuestaAtestacion)
  // Sin red: el desbloqueo del dispositivo no puede depender de ella.
  vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Sin conexión (prueba).')))
}
