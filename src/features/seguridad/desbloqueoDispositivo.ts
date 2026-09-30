import {
  ALGORITMOS_ADMITIDOS,
  comoBytes,
  desdeBase64Url,
  ErrorWebAuthn,
  nuevoDesafio,
  verificarAsercion,
  verificarRegistro,
  type CredencialRegistrada,
} from '../../lib/webauthn'

// DESBLOQUEO DEL DISPOSITIVO: LAS CEREMONIAS CON EL NAVEGADOR (tarea 278).
//
// Habla con `navigator.credentials` y entrega a `lib/webauthn.ts` lo que
// vuelve, para que lo verifique. No guarda nada ni abre la app: eso lo
// decide `bloqueoApp.ts`, y solo con una ceremonia que pasó la
// verificación entera.
//
// Qué pide al autenticador:
// - el de la plataforma (`authenticatorAttachment: 'platform'`, transporte
//   `internal`): el de este teléfono o este computador, no una llave USB ni
//   otro teléfono por QR;
// - verificación del usuario obligatoria (`userVerification: 'required'`):
//   huella, rostro, Windows Hello o el código del dispositivo, lo que el
//   sistema decida. La app nunca sabe cuál fue ni recibe ningún dato
//   biométrico: solo una firma;
// - sin atestación del fabricante (`attestation: 'none'`): no hace falta
//   saber qué modelo de autenticador es;
// - ninguna extensión (en particular, nada de PRF: eso sería la Bóveda,
//   tarea 279).
//
// Cada ceremonia sale de un toque de la persona. Safari limita las
// llamadas que no vienen de un gesto, y abrir el diálogo solo al llegar a
// la pantalla de bloqueo (que aparece tras la inactividad, con nadie
// mirando) lo dejaría caducar o lo repetiría en bucle.

const TIEMPO_CEREMONIA_MS = 60_000
const BYTES_USUARIO = 16
const NOMBRE_APP = 'Soluciones IT'

export type MotivoFallo =
  /** La persona canceló, se agotó el tiempo o el dispositivo no tiene la credencial (el navegador no distingue). */
  | 'cancelado'
  /** Este navegador o dispositivo no lo permite (o ya no lo permite). */
  | 'no-disponible'
  /** Hubo respuesta, pero no pasó la verificación. */
  | 'rechazado'
  /** Cualquier otro error del navegador. */
  | 'fallo'

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoFallo }

interface ConstructorCredencial {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
  signalUnknownCredential?: (opciones: { rpId: string; credentialId: string }) => Promise<void>
}

/** Lo que las ceremonias necesitan del navegador. Las pruebas pasan uno propio. */
export interface EntornoWebAuthn {
  credenciales: Pick<CredentialsContainer, 'create' | 'get'> | undefined
  PublicKeyCredential: ConstructorCredencial | undefined
  AuthenticatorAttestationResponse: { prototype: object } | undefined
  origen: string
  host: string
  contextoSeguro: boolean
  nivelSuperior: boolean
}

export function entornoDelNavegador(): EntornoWebAuthn {
  const global = globalThis as typeof globalThis & {
    PublicKeyCredential?: ConstructorCredencial
    AuthenticatorAttestationResponse?: { prototype: object }
  }
  let nivelSuperior = false
  try {
    nivelSuperior = typeof window !== 'undefined' && window.self === window.top
  } catch {
    nivelSuperior = false
  }
  return {
    credenciales: typeof navigator !== 'undefined' ? navigator.credentials : undefined,
    PublicKeyCredential: global.PublicKeyCredential,
    AuthenticatorAttestationResponse: global.AuthenticatorAttestationResponse,
    origen: typeof location !== 'undefined' ? location.origin : '',
    host: typeof location !== 'undefined' ? location.hostname : '',
    contextoSeguro: global.isSecureContext === true,
    nivelSuperior,
  }
}

/**
 * ¿Se puede ofrecer aquí? Contexto seguro (HTTPS o localhost), la app en la
 * ventana principal (no dentro de un iframe), WebAuthn con `getPublicKey()`
 * y un autenticador de plataforma que verifica al usuario. Si algo falta,
 * la opción no se muestra y el bloqueo sigue con patrón o contraseña.
 */
export async function desbloqueoDispositivoDisponible(entorno = entornoDelNavegador()): Promise<boolean> {
  if (!entorno.contextoSeguro || !entorno.nivelSuperior || !entorno.host) return false
  if (typeof entorno.credenciales?.create !== 'function' || typeof entorno.credenciales.get !== 'function') return false
  const prototipo = entorno.AuthenticatorAttestationResponse?.prototype
  if (!prototipo || !['getPublicKey', 'getPublicKeyAlgorithm', 'getAuthenticatorData'].every((f) => f in prototipo)) {
    return false
  }
  const consultar = entorno.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable
  if (typeof consultar !== 'function') return false
  try {
    return (await consultar.call(entorno.PublicKeyCredential)) === true
  } catch {
    return false
  }
}

function motivoDeError(error: unknown): MotivoFallo {
  if (error instanceof ErrorWebAuthn) return 'rechazado'
  const nombre = (error as { name?: unknown } | null)?.name
  if (nombre === 'NotAllowedError' || nombre === 'AbortError') return 'cancelado'
  if (nombre === 'NotSupportedError' || nombre === 'SecurityError') return 'no-disponible'
  return 'fallo'
}

function bytesDe(valor: unknown): Uint8Array<ArrayBuffer> | null {
  if (valor instanceof ArrayBuffer || ArrayBuffer.isView(valor)) return comoBytes(valor)
  // Otro reino (un iframe o el entorno de pruebas): se acepta por su forma.
  const posible = valor as { byteLength?: unknown } | null
  if (posible && typeof posible.byteLength === 'number' && Object.prototype.toString.call(valor) === '[object ArrayBuffer]') {
    return new Uint8Array((valor as ArrayBuffer).slice(0))
  }
  return null
}

/**
 * Registro: crea la credencial en el autenticador de este dispositivo y
 * verifica la respuesta. NO guarda nada: quien llama la comprueba con una
 * segunda ceremonia antes (ver `comprobarCredencial`).
 */
export async function crearCredencial(entorno = entornoDelNavegador()): Promise<Resultado<CredencialRegistrada>> {
  if (!(await desbloqueoDispositivoDisponible(entorno)) || !entorno.credenciales) {
    return { ok: false, motivo: 'no-disponible' }
  }
  const desafio = nuevoDesafio()
  const usuarioId = crypto.getRandomValues(new Uint8Array(BYTES_USUARIO))
  let credencial: Credential | null
  try {
    credencial = await entorno.credenciales.create({
      publicKey: {
        rp: { id: entorno.host, name: NOMBRE_APP },
        // Un identificador aleatorio: ni el correo ni el id de la cuenta
        // llegan al autenticador.
        user: { id: usuarioId, name: `Desbloqueo de ${NOMBRE_APP}`, displayName: NOMBRE_APP },
        challenge: desafio,
        pubKeyCredParams: ALGORITMOS_ADMITIDOS.map((alg) => ({ type: 'public-key' as const, alg })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
          requireResidentKey: false,
        },
        attestation: 'none',
        timeout: TIEMPO_CEREMONIA_MS,
      },
    })
  } catch (error) {
    return { ok: false, motivo: motivoDeError(error) }
  }
  const respuesta = (credencial as { response?: Record<string, unknown> } | null)?.response
  const rawId = bytesDe((credencial as { rawId?: unknown } | null)?.rawId)
  if (
    !credencial ||
    credencial.type !== 'public-key' ||
    !rawId ||
    !respuesta ||
    typeof respuesta.getAuthenticatorData !== 'function' ||
    typeof respuesta.getPublicKey !== 'function' ||
    typeof respuesta.getPublicKeyAlgorithm !== 'function'
  ) {
    return { ok: false, motivo: 'rechazado' }
  }
  try {
    const clientDataJSON = bytesDe(respuesta.clientDataJSON)
    const authenticatorData = bytesDe((respuesta.getAuthenticatorData as () => unknown).call(respuesta))
    if (!clientDataJSON || !authenticatorData) return { ok: false, motivo: 'rechazado' }
    const clavePublica = bytesDe((respuesta.getPublicKey as () => unknown).call(respuesta))
    const algoritmo = Number((respuesta.getPublicKeyAlgorithm as () => unknown).call(respuesta))
    const registro = await verificarRegistro(
      { rawId, clientDataJSON, authenticatorData, clavePublica, algoritmo },
      { desafio, origen: entorno.origen, rpId: entorno.host, usuarioId },
    )
    return { ok: true, valor: registro }
  } catch (error) {
    return { ok: false, motivo: motivoDeError(error) }
  }
}

/**
 * Autenticación: pide al autenticador que firme un desafío nuevo con ESA
 * credencial y verifica la respuesta completa. `ok` solo si pasó todo.
 */
export async function comprobarCredencial(
  registro: CredencialRegistrada,
  entorno = entornoDelNavegador(),
  senal?: AbortSignal,
): Promise<Resultado<void>> {
  if (!(await desbloqueoDispositivoDisponible(entorno)) || !entorno.credenciales) {
    return { ok: false, motivo: 'no-disponible' }
  }
  // La credencial pertenece a un host: en otro (una vista previa, otro
  // dominio) no puede funcionar.
  if (registro.rpId !== entorno.host) return { ok: false, motivo: 'no-disponible' }
  const desafio = nuevoDesafio()
  let credencial: Credential | null
  try {
    credencial = await entorno.credenciales.get({
      publicKey: {
        challenge: desafio,
        rpId: registro.rpId,
        allowCredentials: [
          { type: 'public-key', id: desdeBase64Url(registro.credencialId), transports: ['internal'] },
        ],
        userVerification: 'required',
        timeout: TIEMPO_CEREMONIA_MS,
      },
      signal: senal,
    })
  } catch (error) {
    return { ok: false, motivo: motivoDeError(error) }
  }
  if (!credencial) return { ok: false, motivo: 'cancelado' }
  const respuesta = (credencial as { response?: Record<string, unknown> }).response
  const rawId = bytesDe((credencial as { rawId?: unknown }).rawId)
  const clientDataJSON = bytesDe(respuesta?.clientDataJSON)
  const authenticatorData = bytesDe(respuesta?.authenticatorData)
  const signature = bytesDe(respuesta?.signature)
  const userHandle = respuesta?.userHandle == null ? null : bytesDe(respuesta.userHandle)
  if (credencial.type !== 'public-key' || !rawId || !clientDataJSON || !authenticatorData || !signature) {
    return { ok: false, motivo: 'rechazado' }
  }
  try {
    await verificarAsercion(
      { rawId, clientDataJSON, authenticatorData, signature, userHandle },
      registro,
      { desafio, origen: entorno.origen },
    )
    return { ok: true, valor: undefined }
  } catch (error) {
    return { ok: false, motivo: motivoDeError(error) }
  }
}

/**
 * Le avisa al gestor de credenciales del sistema que esta credencial ya no
 * se usa, para que no quede listada como huérfana (Chrome 132, Safari 26).
 * Es una cortesía: donde no existe, o si falla, no pasa nada.
 */
export function avisarCredencialRetirada(
  registro: Pick<CredencialRegistrada, 'rpId' | 'credencialId'>,
  entorno = entornoDelNavegador(),
): void {
  const avisar = entorno.PublicKeyCredential?.signalUnknownCredential
  if (typeof avisar !== 'function' || registro.rpId !== entorno.host) return
  try {
    void avisar
      .call(entorno.PublicKeyCredential, { rpId: registro.rpId, credentialId: registro.credencialId })
      .catch(() => {})
  } catch {
    // Un navegador que la declara pero la rechaza: no es asunto de la app.
  }
}
