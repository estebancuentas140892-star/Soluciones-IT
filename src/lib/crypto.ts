// Cifrado de la boveda con WebCrypto: AES-256-GCM con clave derivada
// de la contrasena maestra mediante PBKDF2 (SHA-256). El cifrado y el
// descifrado ocurren siempre en el dispositivo: al servidor y a la
// base local solo llegan bloques cifrados.
//
// Formato de un bloque cifrado (las partes binarias en Base64):
//   v1.<iteraciones>.<salt>.<iv>.<datos>
// Cada bloque lleva sus propios parametros para poder subir las
// iteraciones en el futuro sin invalidar lo ya guardado.

// Recomendacion OWASP para PBKDF2 con SHA-256.
export const ITERACIONES_PBKDF2 = 600_000

const VERSION = 'v1'
const BYTES_SALT = 16
const BYTES_IV = 12

export interface BloqueCifrado {
  iteraciones: number
  saltBase64: string
  salt: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
  datos: Uint8Array<ArrayBuffer>
}

export function nuevaSal(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(BYTES_SALT))
}

export async function derivarClave(
  contrasena: string,
  salt: Uint8Array<ArrayBuffer>,
  iteraciones: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(contrasena),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iteraciones, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function cifrarTexto(
  clave: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  iteraciones: number,
  texto: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(BYTES_IV))
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    clave,
    new TextEncoder().encode(texto),
  )
  return [VERSION, String(iteraciones), aBase64(salt), aBase64(iv), aBase64(new Uint8Array(cifrado))].join('.')
}

// Lanza un error si la clave no corresponde o si el bloque fue
// alterado: AES-GCM verifica la integridad al descifrar.
export async function descifrarTexto(clave: CryptoKey, bloque: BloqueCifrado): Promise<string> {
  const texto = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bloque.iv }, clave, bloque.datos)
  return new TextDecoder().decode(texto)
}

export function analizarBloque(bloque: string): BloqueCifrado | null {
  const partes = bloque.split('.')
  if (partes.length !== 5 || partes[0] !== VERSION) return null
  const iteraciones = Number(partes[1])
  if (!Number.isInteger(iteraciones) || iteraciones <= 0) return null
  try {
    return {
      iteraciones,
      saltBase64: partes[2],
      salt: desdeBase64(partes[2]),
      iv: desdeBase64(partes[3]),
      datos: desdeBase64(partes[4]),
    }
  } catch {
    return null
  }
}

export function aBase64(datos: Uint8Array): string {
  let binario = ''
  for (const byte of datos) binario += String.fromCharCode(byte)
  return btoa(binario)
}

export function desdeBase64(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto)
  const datos = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) datos[i] = binario.charCodeAt(i)
  return datos
}
