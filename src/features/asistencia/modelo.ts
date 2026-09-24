// EL CONTENIDO QUE VIAJA AL COMPUTADOR ATENDIDO (tarea 258).
//
// Este modulo es la frontera entre la app del tecnico y el portal
// publico `/asistencia`, y por eso NO importa nada de la app: ni la base
// local, ni Supabase, ni la Boveda. Lo usan los dos lados: el portal para
// saber que puede dibujar, y la app para armar y comprobar lo que envia.
//
// Tres barreras, y ninguna es CSS (PROPUESTA_REDISENO_RESOLVER.md 7.7):
//   1. Construccion: `contenidoPaso.ts` arma el envio solo con campos
//      permitidos del paso; el constructor no recibe la Boveda ni los
//      campos protegidos (por tipos, no puede).
//   2. Vista previa: el tecnico ve exactamente lo que se enviara, con el
//      mismo componente que usa el portal.
//   3. Servidor: `asistencia_enviar` valida la misma estructura y rechaza
//      cualquier texto con forma de secreto (`asistencia_parece_secreto`
//      en supabase/schema.sql, seccion 7). Lo de aqui es un espejo para
//      avisar ANTES de enviar; el servidor no se fia del cliente.

/** Version del formato. El servidor solo acepta esta. */
export const VERSION_CONTENIDO = 1

export type TipoBloqueAsistencia =
  | 'donde'
  | 'accion'
  | 'comprobacion'
  | 'nota'
  | 'dato'
  | 'comando'
  | 'atajo'
  | 'url'
  | 'archivo'
  | 'debes_ver'

export const TIPOS_BLOQUE_ASISTENCIA: readonly TipoBloqueAsistencia[] = [
  'donde',
  'accion',
  'comprobacion',
  'nota',
  'dato',
  'comando',
  'atajo',
  'url',
  'archivo',
  'debes_ver',
]

export interface BloqueAsistencia {
  tipo: TipoBloqueAsistencia
  /** Lo que se muestra (y en comando, atajo, url, archivo y dato, lo que se copia). */
  texto: string
  /** Nombre de un comando o atajo del Centro de consulta. */
  titulo?: string
  /** Donde se usa un comando ("Windows (símbolo del sistema)"). */
  plataforma?: string
  /** Tono de una nota ("Precaución", "Consejo") o nombre de un dato. */
  etiqueta?: string
}

export interface ContenidoAsistencia {
  v: typeof VERSION_CONTENIDO
  /** "Paso 3 · Instalar el controlador". */
  titulo: string
  /** El nombre de la guía, para ubicarse. */
  subtitulo?: string
  bloques: BloqueAsistencia[]
}

// Limites: los mismos de `asistencia_validar_contenido` en el servidor.
export const MAXIMO_BLOQUES = 40
export const MAXIMO_BYTES = 16384
export const MAXIMO_TITULO = 200
const MAXIMO_TEXTO_LARGO = 2000
const MAXIMO_TEXTO_CORTO = 500
const TIPOS_CORTOS: ReadonlySet<TipoBloqueAsistencia> = new Set(['comando', 'atajo', 'url', 'archivo', 'dato'])

export function maximoTexto(tipo: TipoBloqueAsistencia): number {
  return TIPOS_CORTOS.has(tipo) ? MAXIMO_TEXTO_CORTO : MAXIMO_TEXTO_LARGO
}

// ¿PARECE UN SECRETO? Espejo exacto de `asistencia_parece_secreto`
// (supabase/schema.sql, seccion 7): `modelo.test.ts` comprueba que las
// dos listas digan lo mismo. Un nombre de secreto seguido de un valor,
// con hasta dos palabras en medio ("contraseña del administrador: x"),
// un bloque cifrado de la app, un JWT, una llave privada, una clave
// secreta de Supabase o una URL con usuario y contraseña.
export const NOMBRES_DE_SECRETO = [
  'contraseña',
  'contrasena',
  'password',
  'passwd',
  'pwd',
  'clave',
  'llave',
  'pin',
  'token',
  'api[ _-]?key',
  'secreto',
  'secret',
] as const

const LETRA = '\\p{L}\\p{N}_'
const PATRONES_SECRETO: RegExp[] = [
  new RegExp(
    `(?<![${LETRA}])(${NOMBRES_DE_SECRETO.join('|')})(?![${LETRA}])(\\s+\\p{L}+){0,2}\\s*[:=]\\s*\\S`,
    'iu',
  ),
  /v1\.[0-9]+\.[A-Za-z0-9+/=]{8,}\.[A-Za-z0-9+/=]{8,}\.[A-Za-z0-9+/=]{8,}/,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /sb_secret_[A-Za-z0-9_-]+/i,
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i,
]

export function pareceSecreto(texto: string | undefined | null): boolean {
  if (!texto) return false
  return PATRONES_SECRETO.some((patron) => patron.test(texto))
}

/** Solo URL web: nada de `javascript:`, `data:` ni `file:`. */
export function esUrlWeb(texto: string): boolean {
  return /^https?:\/\/\S+$/i.test(texto)
}

export type MotivoRechazo = 'estructura' | 'tamano' | 'url' | 'secreto'

const CLAVES_CONTENIDO = new Set(['v', 'titulo', 'subtitulo', 'bloques'])
const CLAVES_BLOQUE = new Set(['tipo', 'texto', 'titulo', 'plataforma', 'etiqueta'])

function largo(texto: string): number {
  // Postgres cuenta caracteres, no unidades UTF-16: un emoji es uno.
  return [...texto].length
}

/**
 * Espejo de `asistencia_validar_contenido`: null si el servidor lo
 * aceptaria; si no, el motivo. El portal lo usa ademas para no dibujar
 * nada que no tenga esta forma, aunque el servidor ya lo haya filtrado.
 */
export function validarContenido(valor: unknown): MotivoRechazo | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return 'estructura'
  if (new TextEncoder().encode(JSON.stringify(valor)).length > MAXIMO_BYTES) return 'tamano'
  const c = valor as Record<string, unknown>
  if (Object.keys(c).some((clave) => !CLAVES_CONTENIDO.has(clave))) return 'estructura'
  if (c.v !== VERSION_CONTENIDO) return 'estructura'
  if (typeof c.titulo !== 'string' || largo(c.titulo) < 1 || largo(c.titulo) > MAXIMO_TITULO) return 'estructura'
  if ('subtitulo' in c && (typeof c.subtitulo !== 'string' || largo(c.subtitulo) > MAXIMO_TITULO)) return 'estructura'
  if (pareceSecreto([c.titulo, c.subtitulo].filter(Boolean).join(' '))) return 'secreto'
  if (!Array.isArray(c.bloques) || c.bloques.length < 1 || c.bloques.length > MAXIMO_BLOQUES) return 'estructura'
  for (const b of c.bloques as unknown[]) {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return 'estructura'
    const bloque = b as Record<string, unknown>
    for (const [clave, dato] of Object.entries(bloque)) {
      if (!CLAVES_BLOQUE.has(clave) || typeof dato !== 'string') return 'estructura'
    }
    const tipo = bloque.tipo as TipoBloqueAsistencia
    if (!TIPOS_BLOQUE_ASISTENCIA.includes(tipo)) return 'estructura'
    const texto = bloque.texto
    if (typeof texto !== 'string' || largo(texto) < 1 || largo(texto) > maximoTexto(tipo)) return 'estructura'
    if (
      largo((bloque.titulo as string | undefined) ?? '') > 200 ||
      largo((bloque.plataforma as string | undefined) ?? '') > 100 ||
      largo((bloque.etiqueta as string | undefined) ?? '') > 200
    ) {
      return 'estructura'
    }
    if (tipo === 'url' && !esUrlWeb(texto)) return 'url'
    if (pareceSecreto([texto, bloque.titulo, bloque.etiqueta, bloque.plataforma].filter(Boolean).join(' '))) {
      return 'secreto'
    }
  }
  return null
}

/** "482 731": el código de 6 cifras como se dicta y se lee en pantalla. */
export function formatoCodigo(codigo: string): string {
  return /^\d{6}$/.test(codigo) ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : codigo
}

/** Lo que el portal recibe de `asistencia_estado`: un mensaje ya guardado. */
export interface MensajeAsistencia {
  id: number
  creado_en: string
  contenido: ContenidoAsistencia
}
