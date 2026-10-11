import { describe, expect, it } from 'vitest'
import type { AutorizacionFacturacion } from '../../lib/db'
import { configTablas } from '../../lib/tablas'
import { agruparAgenda } from '../inicio/agenda'
import { calcularPendientes } from '../inicio/pendientes'
import {
  autorizacionDesdeDatos,
  autorizacionesDelPos,
  autorizacionesEnAgenda,
  conteoDeFacturacion,
  DATOS_VACIOS,
  datosDesdeAutorizacion,
  errorDeAutorizacion,
  esCategoriaPos,
  evidenciaValida,
  leerEntero,
  motivoDeRevision,
  numerosRestantes,
  rangoAgotado,
  type DatosAutorizacion,
} from './autorizacion'

// AUTORIZACIONES DE FACTURACIÓN (tarea 321, encargo del 2026-10-10, fase
// C). La Agenda solo avisa de lo confiable, el formulario separa lo
// documentado de lo confirmado y del dato medido, y los casos reales que
// siguen abiertos (PNT9 en conflicto, PNTE sin POS, PN10 a PN13 con fecha
// documental) se pueden representar sin resolverlos. Todo es inventado:
// prefijos, rangos, fechas y nombres de prueba.

const HOY = new Date(2026, 9, 10) // 10 oct 2026, día local

/** "YYYY-MM-DD" a N días de HOY. */
function dia(n: number): string {
  const fecha = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + n)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

const EQUIPOS = [
  { id: 'pos-1', nombre: 'POS de prueba 1', eliminadoEn: null },
  { id: 'pos-2', nombre: 'POS de prueba 2', eliminadoEn: null },
  { id: 'pos-baja', nombre: 'POS eliminado', eliminadoEn: '2026-01-01T00:00:00.000Z' },
]

function autorizacion(cambios: Partial<AutorizacionFacturacion> = {}): AutorizacionFacturacion {
  return {
    id: 'aut-1',
    dispositivoIds: ['pos-1'],
    prefijo: 'PRB',
    formulario: '',
    rangoDesde: 3000,
    rangoHasta: 8000,
    fechaFormalizacion: null,
    vigenciaReportada: '',
    vencimientoDocumentado: null,
    vencimientoConfirmado: null,
    consecutivoActual: null,
    consecutivoLeidoEn: null,
    consecutivoFuente: '',
    estado: 'documentada',
    fuente: 'Documento de prueba',
    verificadoEn: null,
    verificacionFuente: '',
    observaciones: '',
    evidenciaAdjuntoId: null,
    updatedAt: '2026-10-10T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

/** Una confirmada como la dejaría quien la comprobó en ICG/HKA. */
function confirmada(cambios: Partial<AutorizacionFacturacion> = {}): AutorizacionFacturacion {
  return autorizacion({ estado: 'confirmada', verificadoEn: dia(-1), verificacionFuente: 'Consulta de prueba', ...cambios })
}

function datos(cambios: Partial<DatosAutorizacion> = {}): DatosAutorizacion {
  return {
    ...DATOS_VACIOS,
    prefijo: 'PRB',
    rangoDesde: '3000',
    rangoHasta: '8000',
    fuente: 'Documento de prueba',
    dispositivoIds: ['pos-1'],
    ...cambios,
  }
}

const enAgenda = (lista: AutorizacionFacturacion[]) => autorizacionesEnAgenda(lista, EQUIPOS, HOY)

describe('los cuatro estados', () => {
  it('documentada: se guarda sin verificación y no avisa de nada, aunque su fuente dé un vencimiento cercano', () => {
    expect(errorDeAutorizacion(datos(), HOY)).toBeNull()
    expect(enAgenda([autorizacion({ vencimientoDocumentado: dia(10) })])).toEqual([])
    expect(motivoDeRevision({ estado: 'documentada' })).toMatch(/^Por validar/)
  })

  it('confirmada: pide cuándo y con qué fuente actual se comprobó; un PDF no basta', () => {
    const conPdf = datos({ estado: 'confirmada', fuente: 'PDF DIAN de prueba' })
    expect(errorDeAutorizacion(conPdf, HOY)).toEqual({
      campo: 'verificadoEn',
      mensaje: 'Para confirmarla, di cuándo y con qué fuente actual se comprobó.',
    })
    expect(errorDeAutorizacion({ ...conPdf, verificadoEn: dia(-1) }, HOY)?.campo).toBe('verificacionFuente')
    expect(errorDeAutorizacion({ ...conPdf, verificadoEn: dia(-1), verificacionFuente: 'Consulta de prueba' }, HOY)).toBeNull()
    expect(motivoDeRevision({ estado: 'confirmada' })).toBeNull()
  })

  it('confirmada: una verificación con fecha futura se rechaza', () => {
    expect(
      errorDeAutorizacion(datos({ estado: 'confirmada', verificadoEn: dia(1), verificacionFuente: 'Consulta' }), HOY)?.campo,
    ).toBe('verificadoEn')
  })

  it('conflicto: pide explicarlo en las observaciones y no avisa de nada', () => {
    expect(errorDeAutorizacion(datos({ estado: 'conflicto' }), HOY)?.campo).toBe('observaciones')
    expect(errorDeAutorizacion(datos({ estado: 'conflicto', observaciones: 'Dos fechas distintas' }), HOY)).toBeNull()
    expect(enAgenda([autorizacion({ estado: 'conflicto', observaciones: 'x', vencimientoDocumentado: dia(-3) })])).toEqual([])
    expect(motivoDeRevision({ estado: 'conflicto' })).toMatch(/^En conflicto/)
  })

  it('reemplazada: no avisa aunque tenga un vencimiento confirmado pasado y un rango agotado', () => {
    const vieja = autorizacion({
      estado: 'reemplazada',
      vencimientoConfirmado: dia(-30),
      consecutivoActual: 8000,
      consecutivoLeidoEn: dia(-40),
      consecutivoFuente: 'Lectura de prueba',
    })
    expect(enAgenda([vieja])).toEqual([])
    expect(motivoDeRevision(vieja)).toBeNull()
  })

  it('el vencimiento confirmado solo cabe en una confirmada (o reemplazada)', () => {
    for (const estado of ['documentada', 'conflicto'] as const) {
      expect(
        errorDeAutorizacion(datos({ estado, observaciones: 'x', vencimientoConfirmado: dia(100) }), HOY)?.campo,
      ).toBe('vencimientoConfirmado')
    }
  })

  // Revisión del 2026-10-10: un vencimiento confirmado lleva la
  // verificación que lo confirmó. Una reemplazada lo conserva solo con
  // ella; sin vencimiento confirmado, no la necesita.
  it('una reemplazada conserva el vencimiento confirmado solo con su verificación', () => {
    expect(errorDeAutorizacion(datos({ estado: 'reemplazada', vencimientoConfirmado: dia(-100) }), HOY)).toEqual({
      campo: 'verificadoEn',
      mensaje: 'Un vencimiento confirmado necesita la verificación que lo confirmó: su día y su fuente.',
    })
    expect(
      errorDeAutorizacion(
        datos({ estado: 'reemplazada', vencimientoConfirmado: dia(-100), verificadoEn: dia(-200), verificacionFuente: 'Consulta' }),
        HOY,
      ),
    ).toBeNull()
    expect(errorDeAutorizacion(datos({ estado: 'reemplazada' }), HOY)).toBeNull()
  })
})

describe('la verificación: su día y su fuente van juntos', () => {
  it.each([
    ['documentada', {}],
    ['conflicto', { observaciones: 'Dos fechas distintas' }],
    ['reemplazada', {}],
  ] as const)('ambos vacíos es válido en una %s', (estado, cambios) => {
    expect(errorDeAutorizacion(datos({ estado, ...cambios }), HOY)).toBeNull()
  })

  it('solo la fecha, o solo la fuente, se rechaza en cualquier estado', () => {
    const mensaje = 'Una verificación lleva su día y su fuente, los dos (o ninguno).'
    expect(errorDeAutorizacion(datos({ verificadoEn: dia(-1) }), HOY)).toEqual({ campo: 'verificacionFuente', mensaje })
    expect(errorDeAutorizacion(datos({ verificacionFuente: 'Consulta' }), HOY)).toEqual({ campo: 'verificadoEn', mensaje })
    expect(errorDeAutorizacion(datos({ estado: 'reemplazada', verificadoEn: dia(-1) }), HOY)?.mensaje).toBe(mensaje)
  })

  it('los dos: válido', () => {
    expect(errorDeAutorizacion(datos({ verificadoEn: dia(-1), verificacionFuente: 'Consulta' }), HOY)).toBeNull()
  })

  it('una confirmada sin los dos: inválida', () => {
    for (const cambios of [{}, { verificadoEn: dia(-1) }, { verificacionFuente: 'Consulta' }]) {
      expect(errorDeAutorizacion(datos({ estado: 'confirmada', ...cambios }), HOY)?.mensaje).toBe(
        'Para confirmarla, di cuándo y con qué fuente actual se comprobó.',
      )
    }
  })
})

describe('el rango', () => {
  it('válido: los dos extremos, enteros mayores que cero y en orden; con o sin punto de miles', () => {
    expect(errorDeAutorizacion(datos({ rangoDesde: '52.300', rangoHasta: '90.000' }), HOY)).toBeNull()
    expect(errorDeAutorizacion(datos({ rangoDesde: '', rangoHasta: '' }), HOY)).toBeNull()
    expect(errorDeAutorizacion(datos({ rangoDesde: '5', rangoHasta: '5' }), HOY)).toBeNull()
  })

  it.each([
    ['solo el inicio', { rangoHasta: '' }, 'rangoHasta', 'Escribe el rango completo: desde y hasta.'],
    ['solo el final', { rangoDesde: '' }, 'rangoDesde', 'Escribe el rango completo: desde y hasta.'],
    ['inicio mayor que el final', { rangoDesde: '9000' }, 'rangoDesde', 'El inicio del rango no puede ser mayor que el final.'],
    ['cero', { rangoDesde: '0' }, 'rangoDesde', 'El rango tiene que ser de números enteros mayores que cero.'],
    ['letras', { rangoHasta: 'mil' }, 'rangoHasta', 'El rango tiene que ser de números enteros mayores que cero.'],
    ['decimal', { rangoHasta: '8000,5' }, 'rangoHasta', 'El rango tiene que ser de números enteros mayores que cero.'],
    ['punto mal puesto', { rangoHasta: '20.00' }, 'rangoHasta', 'El rango tiene que ser de números enteros mayores que cero.'],
  ])('inválido: %s', (_caso, cambios, campo, mensaje) => {
    expect(errorDeAutorizacion(datos(cambios), HOY)).toEqual({ campo, mensaje })
  })

  it('leerEntero no interpreta lo que no es un entero', () => {
    expect(leerEntero('')).toBeNull()
    expect(leerEntero(' 90000 ')).toBe(90000)
    expect(leerEntero('1.000.000')).toBe(1000000)
    expect(leerEntero('-5')).toBeNaN()
    expect(leerEntero('1,5')).toBeNaN()
  })
})

describe('el consecutivo actual: un dato medido, nunca estimado', () => {
  const conLectura = (consecutivoActual: string, cambios: Partial<DatosAutorizacion> = {}) =>
    datos({ consecutivoActual, consecutivoLeidoEn: dia(-2), consecutivoFuente: 'Lectura de prueba', ...cambios })

  it('dentro del rango, con día y fuente de lectura: se guarda', () => {
    expect(errorDeAutorizacion(conLectura('3000'), HOY)).toBeNull()
    expect(errorDeAutorizacion(conLectura('5.000'), HOY)).toBeNull()
    expect(errorDeAutorizacion(conLectura('8000'), HOY)).toBeNull()
  })

  it('fuera del rango: se rechaza diciendo cuál es el rango', () => {
    expect(errorDeAutorizacion(conLectura('2999'), HOY)).toEqual({
      campo: 'consecutivoActual',
      mensaje: 'El consecutivo tiene que estar dentro del rango (3.000 a 8.000).',
    })
    expect(errorDeAutorizacion(conLectura('8001'), HOY)?.campo).toBe('consecutivoActual')
  })

  it('sin rango no hay consecutivo', () => {
    expect(errorDeAutorizacion(conLectura('10', { rangoDesde: '', rangoHasta: '' }), HOY)?.mensaje).toBe(
      'Sin el rango no se puede registrar el consecutivo.',
    )
  })

  // Los tres o ninguno, igual que el CHECK del esquema (revisión del
  // 2026-10-10).
  it.each([
    ['los tres vacíos', {}, null],
    ['solo la fuente', { consecutivoFuente: 'Lectura' }, 'consecutivoActual'],
    ['solo la fecha', { consecutivoLeidoEn: dia(-1) }, 'consecutivoActual'],
    ['solo el número', { consecutivoActual: '3500' }, 'consecutivoLeidoEn'],
    ['número y fecha sin fuente', { consecutivoActual: '3500', consecutivoLeidoEn: dia(-1) }, 'consecutivoFuente'],
    ['los tres completos', { consecutivoActual: '3500', consecutivoLeidoEn: dia(-1), consecutivoFuente: 'Lectura' }, null],
  ] as const)('%s', (_caso, cambios, campo) => {
    expect(errorDeAutorizacion(datos(cambios), HOY)?.campo ?? null).toBe(campo)
  })

  it('pide los tres: número, día de lectura y dónde se leyó', () => {
    expect(errorDeAutorizacion(datos({ consecutivoActual: '3500' }), HOY)?.campo).toBe('consecutivoLeidoEn')
    expect(errorDeAutorizacion(datos({ consecutivoActual: '3500', consecutivoLeidoEn: dia(-1) }), HOY)?.campo).toBe(
      'consecutivoFuente',
    )
    expect(errorDeAutorizacion(datos({ consecutivoLeidoEn: dia(-1), consecutivoFuente: 'x' }), HOY)?.campo).toBe(
      'consecutivoActual',
    )
  })

  it('una lectura con fecha futura se rechaza', () => {
    expect(errorDeAutorizacion(conLectura('3500', { consecutivoLeidoEn: dia(1) }), HOY)?.campo).toBe('consecutivoLeidoEn')
  })

  it('números que quedan, solo con una lectura completa', () => {
    expect(numerosRestantes(autorizacion())).toBeNull()
    expect(
      numerosRestantes(autorizacion({ consecutivoActual: 7000, consecutivoLeidoEn: dia(-1), consecutivoFuente: '' })),
    ).toBeNull()
    expect(
      numerosRestantes(autorizacion({ consecutivoActual: 7000, consecutivoLeidoEn: dia(-1), consecutivoFuente: 'x' })),
    ).toBe(1000)
  })
})

describe('la Agenda solo deriva avisos confiables', () => {
  it('sin vencimiento confirmado no avisa del vencimiento, aunque sea confirmada y la fuente dé una fecha', () => {
    expect(enAgenda([confirmada({ vencimientoDocumentado: dia(5) })])).toEqual([])
  })

  it('vencimiento confirmado dentro de 30 días: precaución, con los POS como título', () => {
    const [aviso] = enAgenda([confirmada({ vencimientoConfirmado: dia(12) })])
    expect(aviso).toMatchObject({
      clave: 'facturacion-vence:aut-1',
      titulo: 'POS de prueba 1',
      detalle: `Vence el ${Number(dia(12).slice(8))} oct`,
      ruta: '/facturacion/aut-1',
      tono: 'precaucion',
      categoria: 'facturacion',
      fecha: dia(12),
      diasRestantes: 12,
      origen: 'Autorización PRB',
    })
  })

  it('vencimiento confirmado ya pasado: error, "Venció hace"', () => {
    const [aviso] = enAgenda([confirmada({ vencimientoConfirmado: dia(-3) })])
    expect(aviso).toMatchObject({ tono: 'error', detalle: 'Venció hace 3 días', diasRestantes: -3 })
  })

  it('vencimiento confirmado a más de 30 días: todavía no avisa', () => {
    expect(enAgenda([confirmada({ vencimientoConfirmado: dia(31) })])).toEqual([])
    expect(enAgenda([confirmada({ vencimientoConfirmado: dia(30) })])).toHaveLength(1)
  })

  it('sin consecutivo no hay aviso de agotamiento, aunque el rango sea corto', () => {
    expect(enAgenda([confirmada({ rangoDesde: 1, rangoHasta: 2 })])).toEqual([])
  })

  it('rango agotado según una lectura confiable: error, fechado el día de la lectura', () => {
    const agotada = confirmada({ consecutivoActual: 8000, consecutivoLeidoEn: dia(-4), consecutivoFuente: 'Lectura' })
    expect(rangoAgotado(agotada)).toBe(true)
    const [aviso] = enAgenda([agotada])
    expect(aviso).toMatchObject({
      clave: 'facturacion-agotada:aut-1',
      tono: 'error',
      fecha: dia(-4),
      diasRestantes: -4,
      detalle: `Rango agotado (leído el ${Number(dia(-4).slice(8))} oct)`,
    })
  })

  it('"por agotarse" no existe sin umbral decidido: con un solo número libre no avisa', () => {
    const casi = confirmada({ consecutivoActual: 7999, consecutivoLeidoEn: dia(-1), consecutivoFuente: 'Lectura' })
    expect(rangoAgotado(casi)).toBe(false)
    expect(enAgenda([casi])).toEqual([])
  })

  it('un consecutivo sin fuente no es confiable: no avisa de agotamiento', () => {
    expect(enAgenda([confirmada({ consecutivoActual: 8000, consecutivoLeidoEn: dia(-1), consecutivoFuente: '' })])).toEqual([])
  })

  it('sin un POS que exista no avisa (una autorización sin POS, o con el POS eliminado)', () => {
    expect(enAgenda([confirmada({ dispositivoIds: [], vencimientoConfirmado: dia(-1) })])).toEqual([])
    expect(enAgenda([confirmada({ dispositivoIds: ['pos-baja'], vencimientoConfirmado: dia(-1) })])).toEqual([])
    expect(enAgenda([confirmada({ eliminadoEn: '2026-10-01T00:00:00.000Z', vencimientoConfirmado: dia(-1) })])).toEqual([])
  })

  it('en la agenda completa: solo los avisos confiables, en su grupo por fecha', () => {
    const items = calcularPendientes({
      articulos: [],
      credenciales: [],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [],
      articulosDeSugerencia: [],
      dispositivos: EQUIPOS.map((e) => ({ ...e, estado: '', responsableId: null })),
      autorizaciones: [
        confirmada({ id: 'vence', vencimientoConfirmado: dia(7) }),
        confirmada({ id: 'agotada', consecutivoActual: 8000, consecutivoLeidoEn: dia(0), consecutivoFuente: 'Lectura' }),
        autorizacion({ id: 'documental', vencimientoDocumentado: dia(3) }),
        autorizacion({ id: 'conflicto', estado: 'conflicto', observaciones: 'x', vencimientoDocumentado: dia(-1) }),
        confirmada({ id: 'sin-pos', dispositivoIds: [], vencimientoConfirmado: dia(1) }),
      ],
      usuarioId: 'yo',
      puedeVerBoveda: false,
      limite: Infinity,
      hoy: HOY,
    })
    expect(items.map((i) => i.clave)).toEqual(['facturacion-agotada:agotada', 'facturacion-vence:vence'])
    const agenda = agruparAgenda(items)
    expect(agenda.hoy.map((i) => i.clave)).toEqual(['facturacion-agotada:agotada'])
    expect(agenda.proximos.map((i) => i.clave)).toEqual(['facturacion-vence:vence'])
  })
})

describe('varios POS y ninguno', () => {
  it('una autorización con dos POS aparece en los dos y avisa con los dos nombres', () => {
    const compartida = confirmada({ dispositivoIds: ['pos-1', 'pos-2'], vencimientoConfirmado: dia(2) })
    expect(autorizacionesDelPos([compartida], 'pos-1')).toEqual([compartida])
    expect(autorizacionesDelPos([compartida], 'pos-2')).toEqual([compartida])
    expect(enAgenda([compartida])[0].titulo).toBe('POS de prueba 1, POS de prueba 2')
  })

  it('PNTE: se conserva sin asignarla falsamente a un POS', () => {
    const sinPos = datos({
      prefijo: 'PRUEBA-SIN-POS',
      rangoDesde: '',
      rangoHasta: '',
      dispositivoIds: [],
      vencimientoDocumentado: dia(60),
      fuente: 'Hoja de prueba: una fila con prefijo y fecha, sin equipo',
    })
    expect(errorDeAutorizacion(sinPos, HOY)).toBeNull()
    const fila = autorizacion(autorizacionDesdeDatos('sin-pos', sinPos))
    expect(fila.dispositivoIds).toEqual([])
    expect(autorizacionesDelPos([fila], 'pos-1')).toEqual([])
    expect(enAgenda([fila])).toEqual([])
  })

  it('PNT9: se representa como conflicto, con su rango y su formalización, sin elegir fecha ni avisar', () => {
    const pnt9 = datos({
      prefijo: 'PRUEBA-CONFLICTO',
      rangoDesde: '700001',
      rangoHasta: '720000',
      fechaFormalizacion: '2026-05-14',
      vigenciaReportada: '24 meses',
      estado: 'conflicto',
      observaciones: 'La fecha del PDF y la de la hoja de equipos no coinciden. Sin resolver.',
      fuente: 'PDF de prueba y hoja de prueba',
    })
    expect(errorDeAutorizacion(pnt9, HOY)).toBeNull()
    const fila = autorizacion(autorizacionDesdeDatos('pnt9', pnt9))
    expect(fila).toMatchObject({ estado: 'conflicto', vencimientoConfirmado: null, vencimientoDocumentado: null })
    expect(enAgenda([fila])).toEqual([])
    expect(conteoDeFacturacion([fila])).toEqual({ texto: 'PRUEBA-CONFLICTO', revisar: true })
  })

  it('PN10 a PN13: fecha documental sin PDF, por validar y sin aviso aunque esté cerca', () => {
    const pn10 = autorizacion({
      rangoDesde: null,
      rangoHasta: null,
      vencimientoDocumentado: dia(42),
      fuente: 'Hoja de prueba, sin PDF',
    })
    expect(enAgenda([pn10])).toEqual([])
    expect(conteoDeFacturacion([pn10])).toEqual({ texto: 'PRB', revisar: true })
  })
})

describe('la ficha del POS', () => {
  it('la sección se reconoce por la categoría POS, sin importar mayúsculas', () => {
    expect(esCategoriaPos('POS')).toBe(true)
    expect(esCategoriaPos('pos')).toBe(true)
    expect(esCategoriaPos('Datáfonos')).toBe(false)
    expect(esCategoriaPos(undefined)).toBe(false)
  })

  it('la fila plegada dice el prefijo en uso, cuántas si son varias, o "Ninguna"; las reemplazadas no cuentan', () => {
    expect(conteoDeFacturacion([])).toEqual({ texto: 'Ninguna', revisar: false })
    expect(conteoDeFacturacion([confirmada({ prefijo: 'ZZZ' }), autorizacion({ prefijo: 'AAA', estado: 'reemplazada' })])).toEqual(
      { texto: 'ZZZ', revisar: false },
    )
    // Varios prefijos seguidos pisaban el título a 320 px.
    expect(
      conteoDeFacturacion([
        confirmada({ prefijo: 'ZZZ' }),
        autorizacion({ prefijo: 'AAA', estado: 'reemplazada' }),
        autorizacion({ prefijo: 'BBB' }),
      ]),
    ).toEqual({ texto: '2 en uso', revisar: true })
    expect(conteoDeFacturacion([autorizacion({ estado: 'reemplazada' })])).toEqual({ texto: 'Ninguna', revisar: false })
  })

  it('las del POS: primero las que siguen en uso, las reemplazadas al final, sin eliminadas', () => {
    const lista = [
      autorizacion({ id: 'r', prefijo: 'AAA', estado: 'reemplazada' }),
      confirmada({ id: 'c', prefijo: 'CCC' }),
      autorizacion({ id: 'b', prefijo: 'BBB' }),
      autorizacion({ id: 'x', prefijo: 'XXX', eliminadoEn: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(autorizacionesDelPos(lista, 'pos-1').map((a) => a.id)).toEqual(['b', 'c', 'r'])
  })
})

describe('del formulario a la fila y de vuelta', () => {
  it('convierte textos en números y nulos, y no repite un POS', () => {
    const fila = autorizacionDesdeDatos(
      'aut-9',
      datos({ rangoDesde: '4.100', dispositivoIds: ['pos-1', 'pos-1', 'pos-2'], fechaFormalizacion: '', prefijo: ' PRB ' }),
    )
    expect(fila).toMatchObject({
      id: 'aut-9',
      prefijo: 'PRB',
      rangoDesde: 4100,
      rangoHasta: 8000,
      fechaFormalizacion: null,
      dispositivoIds: ['pos-1', 'pos-2'],
      evidenciaAdjuntoId: null,
      consecutivoActual: null,
    })
    expect(datosDesdeAutorizacion(autorizacion(fila))).toMatchObject({ rangoDesde: '4100', rangoHasta: '8000', prefijo: 'PRB' })
  })
})

describe('seguridad: la autorización no tiene donde guardar un secreto', () => {
  it('ninguna de sus columnas es un usuario, contraseña, token, PIN o clave', () => {
    const columnas = Object.values(configTablas.autorizaciones_facturacion.campos).join(' ')
    expect(columnas).not.toMatch(/usuario|contrasena|password|token|pin\b|clave|secreto|cifrad/i)
  })
})

describe('el documento: un adjunto de uno de sus POS', () => {
  const adjunto = { entidadTipo: 'dispositivo' as const, entidadId: 'pos-1', eliminadoEn: null }

  it('vale si existe, está vivo, cuelga de un equipo y ese equipo es uno de sus POS', () => {
    expect(evidenciaValida(adjunto, ['pos-1', 'pos-2'])).toBe(true)
  })

  it('no vale si no existe, está eliminado, no es de un equipo o su POS ya no está asociado', () => {
    expect(evidenciaValida(undefined, ['pos-1'])).toBe(false)
    expect(evidenciaValida({ ...adjunto, eliminadoEn: '2026-10-01T00:00:00.000Z' }, ['pos-1'])).toBe(false)
    expect(evidenciaValida({ ...adjunto, entidadTipo: 'historial' }, ['pos-1'])).toBe(false)
    expect(evidenciaValida(adjunto, ['pos-2'])).toBe(false)
    expect(evidenciaValida(adjunto, [])).toBe(false)
  })
})
