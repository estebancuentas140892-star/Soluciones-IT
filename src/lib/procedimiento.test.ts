import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento } from './db'
import {
  crearPaso,
  normalizarProcedimiento,
  prepararProcedimientoParaGuardar,
  siguientePasoPendiente,
  textoDeProcedimiento,
} from './procedimiento'

function pasoCompleto(cambios: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'paso-1',
    titulo: 'Abrir SQL Server Management Studio',
    instrucciones: [],
    imagen: null,
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
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
      instrucciones: [],
      imagen: null,
      credencialId: null,
      credencialTitulo: '',
      subArticuloId: null,
      subArticuloTitulo: '',
      solucionArticuloId: null,
      solucionArticuloTitulo: '',
    })
    expect(resultado?.pasos[0].id).not.toBe('')
    expect(resultado?.requisitos).toEqual([])
  })

  it('descarta los campos retirados en el rediseño (detalle, nota, advertencia, consejo y decisión)', () => {
    const resultado = normalizarProcedimiento({
      pasos: [
        {
          titulo: 'Paso viejo',
          detalle: 'texto de detalle',
          nota: 'una nota',
          advertencia: 'una advertencia',
          consejo: 'un consejo',
          decision: { pregunta: '¿Está en línea?', pasoSi: 3, pasoNo: null },
        },
      ],
    })
    expect(resultado?.pasos[0]).not.toHaveProperty('detalle')
    expect(resultado?.pasos[0]).not.toHaveProperty('nota')
    expect(resultado?.pasos[0]).not.toHaveProperty('advertencia')
    expect(resultado?.pasos[0]).not.toHaveProperty('consejo')
    expect(resultado?.pasos[0]).not.toHaveProperty('decision')
  })

  it('conserva el vínculo de subprocedimiento y descarta uno mal formado', () => {
    const conVinculo = normalizarProcedimiento({
      pasos: [pasoCompleto({ subArticuloId: 'art-2', subArticuloTitulo: 'Configurar impresora' })],
    })
    expect(conVinculo?.pasos[0].subArticuloId).toBe('art-2')
    expect(conVinculo?.pasos[0].subArticuloTitulo).toBe('Configurar impresora')

    const sinId = normalizarProcedimiento({
      pasos: [pasoCompleto({ subArticuloId: 7, subArticuloTitulo: 'huérfano' } as never)],
    })
    expect(sinId?.pasos[0].subArticuloId).toBeNull()
    expect(sinId?.pasos[0].subArticuloTitulo).toBe('')
  })

  it('conserva el vínculo de solución y descarta uno mal formado', () => {
    const conVinculo = normalizarProcedimiento({
      pasos: [
        pasoCompleto({ solucionArticuloId: 'art-3', solucionArticuloTitulo: 'Reparar el spooler' }),
      ],
    })
    expect(conVinculo?.pasos[0].solucionArticuloId).toBe('art-3')
    expect(conVinculo?.pasos[0].solucionArticuloTitulo).toBe('Reparar el spooler')

    const sinId = normalizarProcedimiento({
      pasos: [pasoCompleto({ solucionArticuloId: 7, solucionArticuloTitulo: 'huérfano' } as never)],
    })
    expect(sinId?.pasos[0].solucionArticuloId).toBeNull()
    expect(sinId?.pasos[0].solucionArticuloTitulo).toBe('')
  })

  it('conserva el vínculo de credencial y descarta uno mal formado', () => {
    const conVinculo = normalizarProcedimiento({
      pasos: [pasoCompleto({ credencialId: 'cred-1', credencialTitulo: 'SQL Server' })],
    })
    expect(conVinculo?.pasos[0].credencialId).toBe('cred-1')
    expect(conVinculo?.pasos[0].credencialTitulo).toBe('SQL Server')

    // Sin id valido no hay vinculo, y el titulo suelto se descarta.
    const sinId = normalizarProcedimiento({
      pasos: [pasoCompleto({ credencialId: 42, credencialTitulo: 'SQL Server' } as never)],
    })
    expect(sinId?.pasos[0].credencialId).toBeNull()
    expect(sinId?.pasos[0].credencialTitulo).toBe('')
  })

  it('conserva las instrucciones y descarta las vacías o que no son texto', () => {
    const resultado = normalizarProcedimiento({
      pasos: [
        pasoCompleto({
          instrucciones: ['Presionar Windows + R', '', '   ', 42, null] as never,
        }),
      ],
    })
    expect(resultado?.pasos[0].instrucciones).toEqual(['Presionar Windows + R'])
  })

  it('descarta requisitos vacíos o que no son texto', () => {
    const resultado = normalizarProcedimiento({
      requisitos: ['Acceso al servidor', '', '   ', 42, null],
      pasos: [pasoCompleto()],
    })
    expect(resultado?.requisitos).toEqual(['Acceso al servidor'])
  })
})

describe('textoDeProcedimiento', () => {
  it('junta requisitos, títulos e instrucciones para el índice de búsqueda', () => {
    const texto = textoDeProcedimiento({
      requisitos: ['Credenciales del SQL Server'],
      pasos: [pasoCompleto({ instrucciones: ['Verificar el espacio en disco'] })],
    })
    expect(texto).toContain('Credenciales del SQL Server')
    expect(texto).toContain('Abrir SQL Server Management Studio')
    expect(texto).toContain('Verificar el espacio en disco')
  })

  it('devuelve texto vacío cuando no hay procedimiento', () => {
    expect(textoDeProcedimiento(null)).toBe('')
  })

  it('no incluye el título de la credencial vinculada (la bóveda solo se busca desbloqueada)', () => {
    const texto = textoDeProcedimiento({
      requisitos: [],
      pasos: [pasoCompleto({ credencialId: 'cred-1', credencialTitulo: 'SQL Server producción' })],
    })
    expect(texto).not.toContain('SQL Server producción')
  })

  it('incluye los títulos del subprocedimiento y de la solución vinculados', () => {
    const texto = textoDeProcedimiento({
      requisitos: [],
      pasos: [
        pasoCompleto({
          subArticuloId: 'art-2',
          subArticuloTitulo: 'Configurar impresora',
          solucionArticuloId: 'art-3',
          solucionArticuloTitulo: 'Reparar el spooler',
        }),
      ],
    })
    expect(texto).toContain('Configurar impresora')
    expect(texto).toContain('Reparar el spooler')
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

  it('limpia espacios en las instrucciones y descarta las que quedan vacías', () => {
    const resultado = prepararProcedimientoParaGuardar('', [
      pasoCompleto({ instrucciones: ['  Presionar Windows + R  ', '', '   '] }),
    ])
    expect(resultado?.pasos[0].instrucciones).toEqual(['Presionar Windows + R'])
  })

  it('conserva un paso que solo tiene instrucciones', () => {
    const paso = crearPaso()
    paso.instrucciones = ['Imprimir una página de prueba']
    expect(prepararProcedimientoParaGuardar('', [paso])?.pasos).toHaveLength(1)
  })

  it('conserva un paso que solo tiene captura', () => {
    const paso = crearPaso()
    paso.imagen = 'articulos/a1/pasos/captura.jpg'
    expect(prepararProcedimientoParaGuardar('', [paso])?.pasos).toHaveLength(1)
  })

  it('conserva un paso que solo tiene credencial vinculada y limpia el título de referencia', () => {
    const paso = crearPaso()
    paso.credencialId = 'cred-1'
    paso.credencialTitulo = '  SQL Server  '
    const resultado = prepararProcedimientoParaGuardar('', [paso])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].credencialTitulo).toBe('SQL Server')
  })

  it('descarta el título de referencia si el paso quedó sin credencial', () => {
    const resultado = prepararProcedimientoParaGuardar('', [
      pasoCompleto({ credencialId: null, credencialTitulo: 'huérfano' }),
    ])
    expect(resultado?.pasos[0].credencialTitulo).toBe('')
  })

  it('conserva un paso que solo tiene subprocedimiento y limpia su título de referencia', () => {
    const paso = crearPaso()
    paso.subArticuloId = 'art-2'
    paso.subArticuloTitulo = '  Configurar impresora  '
    const resultado = prepararProcedimientoParaGuardar('', [paso])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].subArticuloTitulo).toBe('Configurar impresora')

    const huerfano = prepararProcedimientoParaGuardar('', [
      pasoCompleto({ subArticuloId: null, subArticuloTitulo: 'huérfano' }),
    ])
    expect(huerfano?.pasos[0].subArticuloTitulo).toBe('')
  })

  it('conserva un paso que solo tiene solución vinculada y limpia su título de referencia', () => {
    const paso = crearPaso()
    paso.solucionArticuloId = 'art-3'
    paso.solucionArticuloTitulo = '  Reparar el spooler  '
    const resultado = prepararProcedimientoParaGuardar('', [paso])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].solucionArticuloTitulo).toBe('Reparar el spooler')

    const huerfano = prepararProcedimientoParaGuardar('', [
      pasoCompleto({ solucionArticuloId: null, solucionArticuloTitulo: 'huérfano' }),
    ])
    expect(huerfano?.pasos[0].solucionArticuloTitulo).toBe('')
  })
})

describe('siguientePasoPendiente', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('devuelve el siguiente pendiente hacia adelante', () => {
    expect(siguientePasoPendiente(ids, new Set(['a']), 0)).toBe(1)
    expect(siguientePasoPendiente(ids, new Set(['a', 'b', 'c']), 2)).toBe(3)
  })

  it('salta los pasos ya hechos que están en medio', () => {
    expect(siguientePasoPendiente(ids, new Set(['a', 'b', 'c']), 0)).toBe(3)
  })

  it('vuelve al inicio si hacia adelante no queda ninguno (pasos saltados)', () => {
    expect(siguientePasoPendiente(ids, new Set(['b', 'c', 'd']), 3)).toBe(0)
  })

  it('devuelve null cuando no queda ningún pendiente', () => {
    expect(siguientePasoPendiente(ids, new Set(ids), 1)).toBeNull()
    expect(siguientePasoPendiente([], new Set(), 0)).toBeNull()
  })
})
