import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import type { MensajeAsistencia } from '../features/asistencia/modelo'
import {
  CONSULTA_MAXIMA_MS,
  CONSULTA_OCULTA_MS,
  CONSULTA_VISIBLE_MS,
  MAXIMO_MENSAJES_VISIBLES,
  formatoRestante,
  guardarSesionPortal,
  intervaloConsulta,
  leerSesionPortal,
  olvidarSesionPortal,
  textoFinal,
  unirMensajes,
} from './estadoPortal'
import { rutaDeModulos } from './qr'

// LA LOGICA PURA DEL PORTAL DE ASISTENCIA (tarea 258).

class AlmacenFalso implements Storage {
  private datos = new Map<string, string>()
  get length() {
    return this.datos.size
  }
  clear() {
    this.datos.clear()
  }
  getItem(clave: string) {
    return this.datos.get(clave) ?? null
  }
  key(indice: number) {
    return [...this.datos.keys()][indice] ?? null
  }
  removeItem(clave: string) {
    this.datos.delete(clave)
  }
  setItem(clave: string, valor: string) {
    this.datos.set(clave, valor)
  }
}

const SECRETO = 'ab'.repeat(32)

function mensaje(id: number, titulo = `Paso ${id}`): MensajeAsistencia {
  return {
    id,
    creado_en: '2026-09-24T12:00:00.000Z',
    contenido: { v: 1, titulo, bloques: [{ tipo: 'accion', texto: `Haz la acción ${id}` }] },
  }
}

describe('la sesión de la pestaña', () => {
  it('se guarda, se lee y se olvida', () => {
    const almacen = new AlmacenFalso()
    guardarSesionPortal({ id: 's1', secreto: SECRETO }, almacen)
    expect(leerSesionPortal(almacen)).toEqual({ id: 's1', secreto: SECRETO })
    olvidarSesionPortal(almacen)
    expect(leerSesionPortal(almacen)).toBeNull()
  })

  it('descarta lo que no tiene la forma de una sesión', () => {
    const almacen = new AlmacenFalso()
    almacen.setItem('asistencia:portal', '{"id":"s1","secreto":"corto"}')
    expect(leerSesionPortal(almacen)).toBeNull()
    almacen.setItem('asistencia:portal', 'no es json')
    expect(leerSesionPortal(almacen)).toBeNull()
  })
})

describe('intervaloConsulta', () => {
  it('2 s a la vista, 10 s en segundo plano', () => {
    expect(intervaloConsulta(true, 0)).toBe(CONSULTA_VISIBLE_MS)
    expect(intervaloConsulta(false, 0)).toBe(CONSULTA_OCULTA_MS)
  })

  it('se espacia con los errores, hasta 30 s', () => {
    expect(intervaloConsulta(true, 1)).toBe(4000)
    expect(intervaloConsulta(true, 2)).toBe(8000)
    expect(intervaloConsulta(true, 20)).toBe(CONSULTA_MAXIMA_MS)
  })
})

describe('formatoRestante', () => {
  it('minutos y segundos, nunca negativo', () => {
    expect(formatoRestante(9 * 60_000 + 41_000)).toBe('9:41')
    expect(formatoRestante(500)).toBe('0:01')
    expect(formatoRestante(-10)).toBe('0:00')
  })
})

describe('textoFinal', () => {
  it('dice por qué terminó, y siempre la salida', () => {
    expect(textoFinal('cerrada', 'tecnico').titulo).toBe('El técnico se desconectó')
    expect(textoFinal('cerrada', 'portal').titulo).toBe('Sesión finalizada')
    expect(textoFinal('expirada', 'inactividad').detalle).toContain('15 minutos')
    expect(textoFinal('expirada', 'codigo_vencido').titulo).toBe('El código venció')
    expect(textoFinal('expirada', 'maximo').detalle).toContain('4 horas')
    expect(textoFinal('cerrada', 'reemplazada').titulo).toContain('otro equipo')
    expect(textoFinal('no_encontrada', null).titulo).toBe('Esta asistencia ya no existe')
    for (const motivo of ['tecnico', 'portal', 'inactividad', 'codigo_vencido', 'maximo', 'reemplazada', null]) {
      expect(textoFinal('cerrada', motivo).detalle).toMatch(/código nuevo/)
    }
  })
})

describe('unirMensajes', () => {
  it('sin repetir, en orden de llegada', () => {
    const unidos = unirMensajes([mensaje(1), mensaje(3)], [mensaje(2), mensaje(3)])
    expect(unidos.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('no dibuja nada que no tenga la forma permitida', () => {
    const conScript = {
      id: 9,
      creado_en: '2026-09-24T12:00:00.000Z',
      contenido: { v: 1, titulo: 'x', bloques: [{ tipo: 'html', texto: '<script>alert(1)</script>' }] },
    } as unknown as MensajeAsistencia
    const conSecreto = mensaje(10, 'Contraseña: 1234')
    expect(unirMensajes([], [mensaje(1), conScript, conSecreto]).map((m) => m.id)).toEqual([1])
  })

  it('guarda solo los más recientes', () => {
    const muchos = Array.from({ length: MAXIMO_MENSAJES_VISIBLES + 5 }, (_, i) => mensaje(i + 1))
    const unidos = unirMensajes([], muchos)
    expect(unidos).toHaveLength(MAXIMO_MENSAJES_VISIBLES)
    expect(unidos[0].id).toBe(6)
  })
})

describe('el QR del portal', () => {
  it('se lee de vuelta con jsQR (el mismo lector del escáner de la app)', () => {
    const url = 'https://soluciones-it-psi.vercel.app/conectar?codigo=482731'
    const { lado, ruta } = rutaDeModulos(url)
    // Se pinta la ruta SVG en píxeles (4 por módulo) y se decodifica.
    const escala = 4
    const ancho = lado * escala
    const pixeles = new Uint8ClampedArray(ancho * ancho * 4).fill(255)
    for (const [, x, y] of ruta.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
      for (let dy = 0; dy < escala; dy += 1) {
        for (let dx = 0; dx < escala; dx += 1) {
          const i = ((Number(y) * escala + dy) * ancho + (Number(x) * escala + dx)) * 4
          pixeles[i] = 0
          pixeles[i + 1] = 0
          pixeles[i + 2] = 0
        }
      }
    }
    expect(jsQR(pixeles, ancho, ancho)?.data).toBe(url)
  })
})
