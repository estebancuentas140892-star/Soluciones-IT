import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MAXIMO_BLOQUES,
  NOMBRES_DE_SECRETO,
  formatoCodigo,
  pareceSecreto,
  validarContenido,
  type ContenidoAsistencia,
} from './modelo'

// EL ESPEJO DEL SERVIDOR (tarea 258). `pareceSecreto` y
// `validarContenido` avisan en el telefono ANTES de enviar; quien decide
// es el servidor (`asistencia_parece_secreto` y
// `asistencia_validar_contenido`, supabase/schema.sql seccion 7). Si los
// dos lados dijeran cosas distintas, la vista previa prometeria envios que
// el servidor rechaza, o al reves. Estos casos son los mismos que se
// comprobaron contra Postgres el 2026-09-24 (21 de 21).

const CASOS: [string, boolean][] = [
  ['Contraseña: Admin123', true],
  ['contraseña del administrador: X9!', true],
  ['clave de licencia: ABCD-1234', true],
  ['PIN=1234', true],
  ['pin del lector: 4321', true],
  ['api key: sk-123456', true],
  ['https://x.test/a?token=abc123', true],
  ['llave: 0x99', true],
  ['Password = hunter2', true],
  ['v1.600000.QUJDREVGR0g=.SUpLTE1OT1A=.cXJzdHV2d3g=', true],
  ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.abc', true],
  ['-----BEGIN RSA PRIVATE KEY-----', true],
  ['ftp://usuario:secreto@10.0.0.5/carpeta', true],
  ['Escribe la contraseña y pulsa Aceptar: debe aparecer el escritorio', false],
  ['Escribe la contraseña del administrador en el campo', false],
  ['ipconfig /flushdns', false],
  ['runas /user:Administrador cmd', false],
  ['https://soporte.test/password-reset', false],
  ['Abre Ejecutar con Windows + R', false],
  ['spin: 5 vueltas', false],
  ['El PIN lo tiene el jefe de área', false],
]

describe('pareceSecreto', () => {
  it.each(CASOS)('«%s» → %s (lo mismo que dijo Postgres)', (texto, esperado) => {
    expect(pareceSecreto(texto)).toBe(esperado)
  })

  it('la lista de nombres es la misma del servidor', () => {
    const esquema = readFileSync('supabase/schema.sql', 'utf8')
    const lista = /\\y\(([^)]*\))\\y/.exec(esquema)?.[1] ?? ''
    // La lista del servidor termina en ')': se quita, y el grupo interno
    // de "api key" se reconstruye igual que en el cliente.
    expect(lista.slice(0, -1).split('|')).toEqual([...NOMBRES_DE_SECRETO])
  })
})

function contenidoValido(): ContenidoAsistencia {
  return {
    v: 1,
    titulo: 'Paso 2 · Vaciar la caché DNS',
    subtitulo: 'Guía de prueba',
    bloques: [
      { tipo: 'donde', texto: 'Símbolo del sistema' },
      { tipo: 'accion', texto: 'Ejecuta el comando' },
      { tipo: 'comando', texto: 'ipconfig /flushdns', plataforma: 'Windows' },
      { tipo: 'url', texto: 'https://example.com/ayuda' },
      { tipo: 'debes_ver', texto: 'Se vació correctamente' },
    ],
  }
}

describe('validarContenido (espejo de asistencia_validar_contenido)', () => {
  it('acepta un envío con la forma permitida', () => {
    expect(validarContenido(contenidoValido())).toBeNull()
  })

  it('rechaza una clave que el formato no conoce (por ejemplo, un valor cifrado)', () => {
    const c = contenidoValido() as unknown as { bloques: Record<string, string>[] }
    c.bloques[1] = { tipo: 'accion', texto: 'a', valor_cifrado: 'x' }
    expect(validarContenido(c)).toBe('estructura')
  })

  it('rechaza un tipo de bloque desconocido y una versión distinta', () => {
    expect(validarContenido({ ...contenidoValido(), bloques: [{ tipo: 'script', texto: 'x' }] })).toBe('estructura')
    expect(validarContenido({ ...contenidoValido(), v: 2 })).toBe('estructura')
  })

  it('una URL solo vale si es http(s)', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hola', 'file:///c:/x', 'https://ok.test/a b']) {
      expect(validarContenido({ ...contenidoValido(), bloques: [{ tipo: 'url', texto: url }] })).toBe('url')
    }
  })

  it('rechaza un secreto en cualquier campo, también en el título', () => {
    expect(validarContenido({ ...contenidoValido(), bloques: [{ tipo: 'dato', texto: 'PIN: 1234' }] })).toBe('secreto')
    expect(validarContenido({ ...contenidoValido(), titulo: 'Clave: 99' })).toBe('secreto')
    expect(
      validarContenido({ ...contenidoValido(), bloques: [{ tipo: 'comando', texto: 'x', titulo: 'token: abc' }] }),
    ).toBe('secreto')
  })

  it('rechaza vacíos, excesos de largo y de cantidad', () => {
    expect(validarContenido({ ...contenidoValido(), titulo: '' })).toBe('estructura')
    expect(validarContenido({ ...contenidoValido(), bloques: [] })).toBe('estructura')
    expect(validarContenido({ ...contenidoValido(), bloques: [{ tipo: 'comando', texto: 'x'.repeat(501) }] })).toBe(
      'estructura',
    )
    const muchos = Array.from({ length: MAXIMO_BLOQUES + 1 }, (_, i) => ({ tipo: 'accion', texto: `a${i}` }))
    expect(validarContenido({ ...contenidoValido(), bloques: muchos })).toBe('estructura')
  })

  it('rechaza lo que no es un objeto', () => {
    expect(validarContenido(null)).toBe('estructura')
    expect(validarContenido([])).toBe('estructura')
    expect(validarContenido('hola')).toBe('estructura')
  })
})

describe('formatoCodigo', () => {
  it('parte el código en dos grupos de tres', () => {
    expect(formatoCodigo('482731')).toBe('482 731')
    expect(formatoCodigo('12')).toBe('12')
  })
})
