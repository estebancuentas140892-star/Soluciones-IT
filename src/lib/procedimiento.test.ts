import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento, Procedimiento } from './db'
import {
  crearPaso,
  normalizarProcedimiento,
  pasoSeCompletaSolo,
  pasoTrabajoPrevioCompleto,
  prepararProcedimientoParaGuardar,
  siguientePasoPendiente,
  textoDeProcedimiento,
  type DatosProcedimientoParaGuardar,
} from './procedimiento'

function pasoCompleto(cambios: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'paso-1',
    titulo: 'Abrir SQL Server Management Studio',
    objetivo: '',
    instrucciones: [],
    adjuntos: [],
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...cambios,
  }
}

function procedimientoCompleto(cambios: Partial<Procedimiento> = {}): Procedimiento {
  return {
    objetivoGeneral: '',
    requisitos: [],
    pasos: [pasoCompleto()],
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
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
      objetivoGeneral: 'Dejar el SQL Server operativo',
      requisitos: ['Credenciales del SQL Server'],
      pasos: [pasoCompleto()],
      verificacionFinal: ['El servicio quedó en marcha'],
      tiempoEstimadoMin: 15,
      dificultad: 'intermedio' as const,
    }
    expect(normalizarProcedimiento(procedimiento)).toEqual(procedimiento)
  })

  it('completa los campos faltantes de un paso incompleto', () => {
    const resultado = normalizarProcedimiento({ pasos: [{ titulo: 'Solo título' }] })
    expect(resultado?.pasos[0]).toMatchObject({
      titulo: 'Solo título',
      objetivo: '',
      instrucciones: [],
      adjuntos: [],
      credencialId: null,
      credencialTitulo: '',
      subArticuloId: null,
      subArticuloTitulo: '',
      solucionArticuloId: null,
      solucionArticuloTitulo: '',
    })
    expect(resultado?.pasos[0].id).not.toBe('')
    expect(resultado?.objetivoGeneral).toBe('')
    expect(resultado?.requisitos).toEqual([])
    expect(resultado?.verificacionFinal).toEqual([])
    expect(resultado?.tiempoEstimadoMin).toBeNull()
    expect(resultado?.dificultad).toBeNull()
  })

  it('descarta tiempoEstimadoMin y dificultad invalidos', () => {
    const resultado = normalizarProcedimiento({
      pasos: [pasoCompleto()],
      tiempoEstimadoMin: -5,
      dificultad: 'experto',
    })
    expect(resultado?.tiempoEstimadoMin).toBeNull()
    expect(resultado?.dificultad).toBeNull()
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

  it('conserva los adjuntos válidos y descarta los que no tienen referencia', () => {
    const resultado = normalizarProcedimiento({
      pasos: [
        {
          titulo: 'Con adjuntos',
          adjuntos: [
            { referencia: 'a/1.jpg', nombre: 'foto.jpg', tipo: 'image/jpeg' },
            { referencia: '', nombre: 'sin ref', tipo: 'image/jpeg' },
            { nombre: 'sin referencia' },
            'no es objeto',
          ],
        },
      ],
    })
    expect(resultado?.pasos[0].adjuntos).toEqual([
      { referencia: 'a/1.jpg', nombre: 'foto.jpg', tipo: 'image/jpeg' },
    ])
  })

  it('completa nombre y tipo faltantes de un adjunto a partir de la referencia', () => {
    const resultado = normalizarProcedimiento({
      pasos: [{ titulo: 'x', adjuntos: [{ referencia: 'articulos/a1/pasos/1699999999-manual.pdf' }] }],
    })
    expect(resultado?.pasos[0].adjuntos).toEqual([
      { referencia: 'articulos/a1/pasos/1699999999-manual.pdf', nombre: 'manual.pdf', tipo: 'application/pdf' },
    ])
  })

  it('migra el campo viejo "imagen" (una sola captura) a un adjunto', () => {
    const resultado = normalizarProcedimiento({
      pasos: [{ titulo: 'Paso con captura vieja', imagen: 'articulos/a1/pasos/1699999999-captura.png' }],
    })
    expect(resultado?.pasos[0].adjuntos).toEqual([
      { referencia: 'articulos/a1/pasos/1699999999-captura.png', nombre: 'captura.png', tipo: 'image/png' },
    ])
  })

  it('prefiere la lista nueva de adjuntos por encima del campo viejo "imagen"', () => {
    const resultado = normalizarProcedimiento({
      pasos: [
        {
          titulo: 'x',
          imagen: 'vieja.jpg',
          adjuntos: [{ referencia: 'nueva.jpg', nombre: 'nueva.jpg', tipo: 'image/jpeg' }],
        },
      ],
    })
    expect(resultado?.pasos[0].adjuntos).toEqual([
      { referencia: 'nueva.jpg', nombre: 'nueva.jpg', tipo: 'image/jpeg' },
    ])
  })
})

describe('textoDeProcedimiento', () => {
  it('junta requisitos, títulos e instrucciones para el índice de búsqueda', () => {
    const texto = textoDeProcedimiento(
      procedimientoCompleto({
        requisitos: ['Credenciales del SQL Server'],
        pasos: [pasoCompleto({ instrucciones: ['Verificar el espacio en disco'] })],
      }),
    )
    expect(texto).toContain('Credenciales del SQL Server')
    expect(texto).toContain('Abrir SQL Server Management Studio')
    expect(texto).toContain('Verificar el espacio en disco')
  })

  it('devuelve texto vacío cuando no hay procedimiento', () => {
    expect(textoDeProcedimiento(null)).toBe('')
  })

  it('no incluye el título de la credencial vinculada (la bóveda solo se busca desbloqueada)', () => {
    const texto = textoDeProcedimiento(
      procedimientoCompleto({
        pasos: [pasoCompleto({ credencialId: 'cred-1', credencialTitulo: 'SQL Server producción' })],
      }),
    )
    expect(texto).not.toContain('SQL Server producción')
  })

  it('incluye los títulos del subprocedimiento y de la solución vinculados', () => {
    const texto = textoDeProcedimiento(
      procedimientoCompleto({
        pasos: [
          pasoCompleto({
            subArticuloId: 'art-2',
            subArticuloTitulo: 'Configurar impresora',
            solucionArticuloId: 'art-3',
            solucionArticuloTitulo: 'Reparar el spooler',
          }),
        ],
      }),
    )
    expect(texto).toContain('Configurar impresora')
    expect(texto).toContain('Reparar el spooler')
  })
})

function preparar(pasos: PasoProcedimiento[], cambios: Partial<DatosProcedimientoParaGuardar> = {}) {
  return prepararProcedimientoParaGuardar({
    objetivoGeneral: '',
    requisitosTexto: '',
    pasos,
    verificacionFinalTexto: '',
    tiempoEstimadoMin: null,
    dificultad: null,
    ...cambios,
  })
}

describe('prepararProcedimientoParaGuardar', () => {
  it('limpia espacios y separa los requisitos y la verificación final por línea', () => {
    const resultado = preparar([pasoCompleto({ titulo: '  Abrir la consola  ' })], {
      requisitosTexto: '  Acceso al servidor  \n\n VPN activa ',
      verificacionFinalTexto: '  Todo funciona  \n\n Sin errores ',
    })
    expect(resultado?.requisitos).toEqual(['Acceso al servidor', 'VPN activa'])
    expect(resultado?.verificacionFinal).toEqual(['Todo funciona', 'Sin errores'])
    expect(resultado?.pasos[0].titulo).toBe('Abrir la consola')
  })

  it('limpia espacios en el objetivo general y conserva tiempo y dificultad', () => {
    const resultado = preparar([pasoCompleto()], {
      objetivoGeneral: '  Dejar todo operativo  ',
      tiempoEstimadoMin: 30,
      dificultad: 'avanzado',
    })
    expect(resultado?.objetivoGeneral).toBe('Dejar todo operativo')
    expect(resultado?.tiempoEstimadoMin).toBe(30)
    expect(resultado?.dificultad).toBe('avanzado')
  })

  it('descarta pasos totalmente vacíos y devuelve null si no queda nada', () => {
    const vacio = crearPaso()
    expect(preparar([vacio])).toBeNull()

    const resultado = preparar([vacio, pasoCompleto()])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].titulo).toBe('Abrir SQL Server Management Studio')
  })

  it('limpia espacios en las instrucciones y descarta las que quedan vacías', () => {
    const resultado = preparar([pasoCompleto({ instrucciones: ['  Presionar Windows + R  ', '', '   '] })])
    expect(resultado?.pasos[0].instrucciones).toEqual(['Presionar Windows + R'])
  })

  it('conserva un paso que solo tiene instrucciones', () => {
    const paso = crearPaso()
    paso.instrucciones = ['Imprimir una página de prueba']
    expect(preparar([paso])?.pasos).toHaveLength(1)
  })

  it('conserva un paso que solo tiene adjuntos', () => {
    const paso = crearPaso()
    paso.adjuntos = [{ referencia: 'articulos/a1/pasos/captura.jpg', nombre: 'captura.jpg', tipo: 'image/jpeg' }]
    expect(preparar([paso])?.pasos).toHaveLength(1)
  })

  it('conserva un paso que solo tiene credencial vinculada y limpia el título de referencia', () => {
    const paso = crearPaso()
    paso.credencialId = 'cred-1'
    paso.credencialTitulo = '  SQL Server  '
    const resultado = preparar([paso])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].credencialTitulo).toBe('SQL Server')
  })

  it('descarta el título de referencia si el paso quedó sin credencial', () => {
    const resultado = preparar([pasoCompleto({ credencialId: null, credencialTitulo: 'huérfano' })])
    expect(resultado?.pasos[0].credencialTitulo).toBe('')
  })

  it('conserva un paso que solo tiene subprocedimiento y limpia su título de referencia', () => {
    const paso = crearPaso()
    paso.subArticuloId = 'art-2'
    paso.subArticuloTitulo = '  Configurar impresora  '
    const resultado = preparar([paso])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].subArticuloTitulo).toBe('Configurar impresora')

    const huerfano = preparar([pasoCompleto({ subArticuloId: null, subArticuloTitulo: 'huérfano' })])
    expect(huerfano?.pasos[0].subArticuloTitulo).toBe('')
  })

  it('conserva un paso que solo tiene solución vinculada y limpia su título de referencia', () => {
    const paso = crearPaso()
    paso.solucionArticuloId = 'art-3'
    paso.solucionArticuloTitulo = '  Reparar el spooler  '
    const resultado = preparar([paso])
    expect(resultado?.pasos).toHaveLength(1)
    expect(resultado?.pasos[0].solucionArticuloTitulo).toBe('Reparar el spooler')

    const huerfano = preparar([pasoCompleto({ solucionArticuloId: null, solucionArticuloTitulo: 'huérfano' })])
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

describe('pasoTrabajoPrevioCompleto', () => {
  it('un paso sin instrucciones y sin subprocedimiento tiene el trabajo previo completo', () => {
    expect(pasoTrabajoPrevioCompleto(0, 0, true)).toBe(true)
  })

  it('exige todas las instrucciones marcadas', () => {
    expect(pasoTrabajoPrevioCompleto(2, 1, true)).toBe(false)
    expect(pasoTrabajoPrevioCompleto(2, 2, true)).toBe(true)
  })

  it('exige el subprocedimiento vinculado satisfecho aunque las instrucciones estén listas', () => {
    expect(pasoTrabajoPrevioCompleto(2, 2, false)).toBe(false)
    expect(pasoTrabajoPrevioCompleto(0, 0, false)).toBe(false)
  })
})

describe('pasoSeCompletaSolo', () => {
  it('se completa solo cuando el trabajo previo está listo y no hay solución vinculada', () => {
    expect(pasoSeCompletaSolo(true, false)).toBe(true)
  })

  it('no se completa solo si el trabajo previo no está listo', () => {
    expect(pasoSeCompletaSolo(false, false)).toBe(false)
  })

  it('no se completa solo si hay una solución vinculada (la completa la pregunta de error)', () => {
    expect(pasoSeCompletaSolo(true, true)).toBe(false)
  })
})
