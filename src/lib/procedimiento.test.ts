import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento } from './db'
import {
  crearPaso,
  normalizarProcedimiento,
  prepararProcedimientoParaGuardar,
  textoDeProcedimiento,
} from './procedimiento'

function pasoCompleto(cambios: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'paso-1',
    titulo: 'Abrir SQL Server Management Studio',
    detalle: 'Está en el escritorio del servidor',
    imagen: null,
    nota: '',
    advertencia: '',
    consejo: '',
    decision: null,
    ...cambios,
  }
}

describe('normalizarProcedimiento', () => {
  it('devuelve null para valores que no son un procedimiento', () => {
    expect(normalizarProcedimiento(null)).toBeNull()
    expect(normalizarProcedimiento(undefined)).toBeNull()
    expect(normalizarProcedimiento('texto')).toBeNull()
    expect(normalizarProcedimiento([])).toBeNull()
    expect(normalizarProcedimiento({})).toBeNull()
  })

  it('devuelve null si no hay pasos (es un artículo normal)', () => {
    expect(normalizarProcedimiento({ requisitos: ['algo'], pasos: [] })).toBeNull()
  })

  it('conserva un procedimiento bien formado tal cual', () => {
    const procedimiento = {
      requisitos: ['Credenciales del SQL Server'],
      pasos: [pasoCompleto()],
    }
    expect(normalizarProcedimiento(procedimiento)).toEqual(procedimiento)
  })

  it('completa los campos faltantes de un paso incompleto', () => {
    const resultado = normalizarProcedimiento({ pasos: [{ titulo: 'Solo título' }] })
    expect(resultado?.pasos[0]).toMatchObject({
      titulo: 'Solo título',
      detalle: '',
      imagen: null,
      nota: '',
      advertencia: '',
      consejo: '',
      decision: null,
    })
    expect(resultado?.pasos[0].id).not.toBe('')
    expect(resultado?.requisitos).toEqual([])
  })

  it('descarta requisitos vacíos o que no son texto', () => {
    const resultado = normalizarProcedimiento({
      requisitos: ['Acceso al servidor', '', '   ', 42, null],
      pasos: [pasoCompleto()],
    })
    expect(resultado?.requisitos).toEqual(['Acceso al servidor'])
  })

  it('descarta una decisión sin pregunta y normaliza los saltos', () => {
    const sinPregunta = normalizarProcedimiento({
      pasos: [pasoCompleto({ decision: { pregunta: '  ', pasoSi: 3, pasoNo: null } })],
    })
    expect(sinPregunta?.pasos[0].decision).toBeNull()

    const conSaltos = normalizarProcedimiento({
      pasos: [pasoCompleto({ decision: { pregunta: '¿Está en línea?', pasoSi: '4', pasoNo: 0 } as never })],
    })
    expect(conSaltos?.pasos[0].decision).toEqual({ pregunta: '¿Está en línea?', pasoSi: 4, pasoNo: null })
  })
})

describe('textoDeProcedimiento', () => {
  it('junta requisitos, pasos, avisos y preguntas para el índice de búsqueda', () => {
    const texto = textoDeProcedimiento({
      requisitos: ['Credenciales del SQL Server'],
      pasos: [
        pasoCompleto({
          advertencia: 'Verificar el espacio en disco',
          decision: { pregunta: '¿La base está en línea?', pasoSi: null, pasoNo: 2 },
        }),
      ],
    })
    expect(texto).toContain('Credenciales del SQL Server')
    expect(texto).toContain('Abrir SQL Server Management Studio')
    expect(texto).toContain('Verificar el espacio en disco')
    expect(texto).toContain('¿La base está en línea?')
  })

  it('devuelve texto vacío cuando no hay procedimiento', () => {
    expect(textoDeProcedimiento(null)).toBe('')
  })
})

describe('prepararProcedimientoParaGuardar', () => {
  it('limpia espacios y separa los requisitos por línea', () => {
    const resultado = prepararProcedimientoParaGuardar('  Acceso al servidor  \n\n VPN activa ', [
      pasoCompleto({ titulo: '  Abrir la consola  ' }),
    ])
    expect(resultado?.requisitos).toEqual(['Acceso al servidor', 'VPN activa'])
    expect(resultado?.pasos[0].titulo).toBe('Abrir la consola')
  })

  it('descarta pasos totalmente vacíos y devuelve null si no queda nada', () => {
    const vacio = crearPaso()
    expect(prepararProcedimientoParaGuardar('', [vacio])).toBeNull()

    const resultado = prepararProcedimientoParaGuardar('', [vacio, pasoCompleto()])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].titulo).toBe('Abrir SQL Server Management Studio')
  })

  it('conserva un paso que solo tiene captura', () => {
    const paso = crearPaso()
    paso.imagen = 'articulos/a1/pasos/captura.jpg'
    expect(prepararProcedimientoParaGuardar('', [paso])?.pasos).toHaveLength(1)
  })

  it('descarta una decisión cuya pregunta quedó vacía', () => {
    const resultado = prepararProcedimientoParaGuardar('', [
      pasoCompleto({ decision: { pregunta: '   ', pasoSi: 2, pasoNo: null } }),
    ])
    expect(resultado?.pasos[0].decision).toBeNull()
  })
})
