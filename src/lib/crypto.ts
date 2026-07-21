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

// Primitivos crudos (AES-GCM sobre bytes, sin texto ni formato de
// bloque): los usan tanto el cifrado de texto como el de archivos
// (fase P5), para no repetir la generacion del IV ni la llamada a
// WebCrypto en dos lugares.
async function cifrarCrudo(
  clave: CryptoKey,
  datos: Uint8Array<ArrayBuffer>,
): Promise<{ iv: Uint8Array<ArrayBuffer>; cifrado: Uint8Array<ArrayBuffer> }> {
  const iv = crypto.getRandomValues(new Uint8Array(BYTES_IV))
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, datos)
  return { iv, cifrado: new Uint8Array(cifrado) }
}

// Lanza un error si la clave no corresponde o si los datos fueron
// alterados: AES-GCM verifica la integridad al descifrar.
async function descifrarCrudo(
  clave: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  cifrado: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clave, cifrado)
  return new Uint8Array(datos)
}

export async function cifrarTexto(
  clave: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  iteraciones: number,
  texto: string,
): Promise<string> {
  const { iv, cifrado } = await cifrarCrudo(clave, new TextEncoder().encode(texto))
  return [VERSION, String(iteraciones), aBase64(salt), aBase64(iv), aBase64(cifrado)].join('.')
}

export async function descifrarTexto(clave: CryptoKey, bloque: BloqueCifrado): Promise<string> {
  const datos = await descifrarCrudo(clave, bloque.iv, bloque.datos)
  return new TextDecoder().decode(datos)
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

// ----------------------------------------------------------------
// Formato binario para archivos (fase P5, "Archivo seguro")
// ----------------------------------------------------------------
//
// A diferencia del bloque de texto (pensado para viajar en una columna
// y gastar ~33% extra en Base64 no importa), un archivo cifrado se
// sube tal cual a Supabase Storage: sus parametros de cifrado viajan
// como una cabecera binaria compacta, autocontenida, al principio del
// mismo blob que se sube:
//   [1 byte version][4 bytes iteraciones][16 bytes salt][12 bytes iv][ciphertext+tag]
// Asi el objeto de Storage se basta a si mismo para descifrarse; no
// depende de ninguna columna de la base de datos.

const VERSION_BINARIA = 1
const BYTES_ITERACIONES_BIN = 4
// AES-GCM agrega un tag de autenticacion de 16 bytes al final del
// cifrado (incluso para un archivo de 0 bytes), asi que un bloque valido
// nunca puede pesar menos que la cabecera mas ese tag.
const BYTES_TAG_GCM = 16
const LARGO_CABECERA_BIN = 1 + BYTES_ITERACIONES_BIN + BYTES_SALT + BYTES_IV

export interface BloqueArchivoCifrado {
  iteraciones: number
  salt: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
  datos: Uint8Array<ArrayBuffer>
}

export async function cifrarBinario(
  clave: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  iteraciones: number,
  datos: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const { iv, cifrado } = await cifrarCrudo(clave, datos)
  const resultado = new Uint8Array(LARGO_CABECERA_BIN + cifrado.length)
  new DataView(resultado.buffer).setUint32(1, iteraciones, false)
  resultado[0] = VERSION_BINARIA
  resultado.set(salt, 1 + BYTES_ITERACIONES_BIN)
  resultado.set(iv, 1 + BYTES_ITERACIONES_BIN + BYTES_SALT)
  resultado.set(cifrado, LARGO_CABECERA_BIN)
  return resultado
}

export async function descifrarBinario(
  clave: CryptoKey,
  bloque: BloqueArchivoCifrado,
): Promise<Uint8Array<ArrayBuffer>> {
  return descifrarCrudo(clave, bloque.iv, bloque.datos)
}

// null si el buffer es demasiado corto, tiene una version desconocida o
// unas iteraciones invalidas (archivo truncado o ajeno a este formato).
// Nunca lanza: quien lo use decide que hacer con un archivo ilegible.
export function analizarBloqueBinario(datos: Uint8Array<ArrayBuffer>): BloqueArchivoCifrado | null {
  if (datos.length < LARGO_CABECERA_BIN + BYTES_TAG_GCM) return null
  if (datos[0] !== VERSION_BINARIA) return null

  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  const iteraciones = vista.getUint32(1, false)
  if (iteraciones <= 0) return null

  return {
    iteraciones,
    salt: datos.slice(1 + BYTES_ITERACIONES_BIN, 1 + BYTES_ITERACIONES_BIN + BYTES_SALT),
    iv: datos.slice(1 + BYTES_ITERACIONES_BIN + BYTES_SALT, LARGO_CABECERA_BIN),
    datos: datos.slice(LARGO_CABECERA_BIN),
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
