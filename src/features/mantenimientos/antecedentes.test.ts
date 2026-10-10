import { describe, expect, it } from 'vitest'
import { esPorValidar, estaAbierto } from '../../lib/mantenimientos'
import {
  antecedenteDesdeCronograma,
  datosDocumentados,
  ESTADOS_MARCADOS,
  fechaDeMarca,
  mesDeTexto,
  type EstadoMarcado,
  type MarcaDeCronograma,
} from './antecedentes'
import { entraEnAgenda } from './mantenimiento'

// La vía para registrar lo que dice un cronograma antiguo (tarea 320,
// encargo del 2026-10-10): nunca como mantenimiento confirmado, sin
// afirmar técnico, resultado ni fecha real, y sin convertir día + hoja
// en fecha cuando el título de la hoja dice otro mes. Datos inventados.

function marca(cambios: Partial<MarcaDeCronograma> = {}): MarcaDeCronograma {
  return {
    dispositivoId: 'equipo-1',
    tipo: 'preventivo',
    estadoMarcado: 'PROGRAMADO',
    anio: 2025,
    hoja: 'Marzo',
    tituloHoja: 'Cronograma de mantenimiento marzo 2025',
    dia: 12,
    fuente: 'Cronograma de prueba 2025, hoja Marzo',
    ...cambios,
  }
}

describe('mesDeTexto', () => {
  it('reconoce el mes sin importar mayúsculas, tildes ni palabras alrededor', () => {
    expect(mesDeTexto('Marzo')).toBe(3)
    expect(mesDeTexto('CRONOGRAMA DE MANTENIMIENTO MARZO 2025')).toBe(3)
    expect(mesDeTexto('Setiembre')).toBe(9)
    expect(mesDeTexto('septiembre')).toBe(9)
  })

  it('no decide si no hay mes o hay dos distintos', () => {
    expect(mesDeTexto('Hoja 3')).toBeNull()
    expect(mesDeTexto('Marzo y abril')).toBeNull()
  })
})

describe('fechaDeMarca', () => {
  it('con hoja y título del mismo mes da la fecha', () => {
    expect(fechaDeMarca(marca())).toEqual({ ok: true, fecha: '2025-03-12' })
  })

  it('un título mensual inconsistente impide convertir día + hoja en fecha', () => {
    expect(fechaDeMarca(marca({ tituloHoja: 'Cronograma de mantenimiento abril 2025' }))).toEqual({
      ok: false,
      motivo: 'mes_sin_conciliar',
    })
    // Un título sin mes tampoco confirma el de la hoja.
    expect(fechaDeMarca(marca({ tituloHoja: 'Cronograma de mantenimiento' }))).toEqual({
      ok: false,
      motivo: 'mes_sin_conciliar',
    })
  })

  it('con el mes conciliado por una persona, da la fecha de ese mes', () => {
    expect(fechaDeMarca(marca({ tituloHoja: 'Cronograma abril 2025', mesConciliado: 4 }))).toEqual({
      ok: true,
      fecha: '2025-04-12',
    })
    expect(fechaDeMarca(marca({ mesConciliado: 13 }))).toEqual({ ok: false, motivo: 'mes_sin_conciliar' })
  })

  it('un día que no existe en el mes no se desborda al siguiente', () => {
    expect(fechaDeMarca(marca({ hoja: 'Abril', tituloHoja: 'Abril 2025', dia: 31 }))).toEqual({
      ok: false,
      motivo: 'dia_invalido',
    })
    expect(fechaDeMarca(marca({ dia: 0 }))).toEqual({ ok: false, motivo: 'dia_invalido' })
  })
})

describe('antecedenteDesdeCronograma', () => {
  it('queda documentado por validar, sin técnico, resultado, fecha real ni intervención', () => {
    const fila = antecedenteDesdeCronograma('a1', marca())
    expect(fila).toMatchObject({
      id: 'a1',
      dispositivoId: 'equipo-1',
      tipo: 'preventivo',
      fechaProgramada: '2025-03-12',
      estado: 'programado',
      tecnico: '',
      fechaRealizada: null,
      resultado: '',
      historialId: null,
      fuente: 'Cronograma de prueba 2025, hoja Marzo',
      validacion: 'documentado_por_validar',
    })
    expect(fila.observaciones).toContain('hoja «Marzo»')
    // Nunca entra en la Agenda, aunque su fecha sea de hoy.
    expect(entraEnAgenda({ ...fila, eliminadoEn: null })).toBe(false)
  })

  it('con el mes sin conciliar se registra sin fecha y con la marca tal cual', () => {
    const fila = antecedenteDesdeCronograma('a2', marca({ tituloHoja: 'Cronograma abril 2025' }))
    expect(fila.fechaProgramada).toBeNull()
    expect(fila.observaciones).toContain('título «Cronograma abril 2025»')
    expect(fila.observaciones).toContain('día 12')
    expect(fila.observaciones).toContain('falta conciliarlo')
  })

  it('sin fuente no hay antecedente', () => {
    expect(() => antecedenteDesdeCronograma('a3', marca({ fuente: '  ' }))).toThrow('Un antecedente necesita su fuente.')
  })
})

// EL ESTADO QUE MARCA EL CRONOGRAMA (segunda revisión del 2026-10-10).
// Los datos reales marcan PROGRAMADO, REALIZADO o POSPUESTO, y cada
// registro aclara que es una marca del cronograma, no un acta firmada ni
// un cierre verificado. Antes todas las marcas quedaban como
// 'programado' y el estado de la fuente se perdía. Ahora se conserva tal
// cual en las observaciones, como dato documental, sin tocar el estado
// operativo ni la validación.
describe('antecedenteDesdeCronograma: el estado marcado en la fuente', () => {
  it('conoce solo los tres estados que usa el cronograma', () => {
    expect([...ESTADOS_MARCADOS]).toEqual(['PROGRAMADO', 'REALIZADO', 'POSPUESTO'])
  })

  it.each(ESTADOS_MARCADOS)('%s se conserva como dato documental y no se convierte en confirmado', (estadoMarcado) => {
    const fila = antecedenteDesdeCronograma('e1', marca({ estadoMarcado }))
    expect(fila.observaciones).toContain(`Estado marcado en la fuente: ${estadoMarcado}.`)
    // La marca tal cual sigue entera junto al estado.
    expect(fila.observaciones).toContain('hoja «Marzo»')
    expect(fila.observaciones).toContain('día 12')
    // Documental: ni confirmado ni un estado operativo sacado de la marca.
    expect(fila.validacion).toBe('documentado_por_validar')
    expect(esPorValidar(fila)).toBe(true)
    expect(fila.estado).toBe('programado')
    expect(fila.fuente).toBe('Cronograma de prueba 2025, hoja Marzo')
    // No inventa técnico, resultado, fecha real ni evidencia.
    expect(fila).toMatchObject({ tecnico: '', resultado: '', fechaRealizada: null, historialId: null })
    expect(datosDocumentados(fila)).toEqual([])
    // Nunca entra en la Agenda.
    expect(entraEnAgenda({ ...fila, eliminadoEn: null })).toBe(false)
  })

  it('REALIZADO no queda como un mantenimiento realizado ni cerrado', () => {
    const fila = antecedenteDesdeCronograma('e2', marca({ estadoMarcado: 'REALIZADO' }))
    expect(fila.estado).not.toBe('realizado')
    expect(fila.validacion).not.toBe('confirmado')
    expect(fila.historialId).toBeNull()
    expect(fila.fechaRealizada).toBeNull()
    // Sigue sin poder cerrarse como uno confirmado: la app solo cierra
    // los confirmados, y este no lo es.
    expect(estaAbierto(fila) && !esPorValidar(fila)).toBe(false)
  })

  it('el estado marcado convive con el mes sin conciliar: sin fecha, con los dos datos', () => {
    const fila = antecedenteDesdeCronograma(
      'e3',
      marca({ estadoMarcado: 'POSPUESTO', tituloHoja: 'Cronograma abril 2025' }),
    )
    expect(fila.fechaProgramada).toBeNull()
    expect(fila.estado).toBe('programado')
    expect(fila.observaciones).toContain('Estado marcado en la fuente: POSPUESTO.')
    expect(fila.observaciones).toContain('falta conciliarlo')
  })

  it.each(['realizado', 'HECHO', 'CANCELADO', '', ' REALIZADO '])(
    'un estado que el cronograma no usa (%j) se rechaza en vez de adivinarlo',
    (estadoMarcado) => {
      expect(() =>
        antecedenteDesdeCronograma('e4', marca({ estadoMarcado: estadoMarcado as EstadoMarcado })),
      ).toThrow('Estado marcado desconocido')
    },
  )
})

describe('datosDocumentados (revisión del 2026-10-10)', () => {
  // Lo que la pantalla del antecedente enseña además de la fuente. Solo
  // lo que trae texto, con etiquetas que dicen "documentado".
  const vacio = { fechaRealizada: null, tecnico: '', resultado: '' }

  it('un antecedente solo con fuente no inventa fecha, técnico ni resultado', () => {
    expect(datosDocumentados(vacio)).toEqual([])
  })

  it('espacios en blanco no cuentan como dato', () => {
    expect(datosDocumentados({ fechaRealizada: '  ', tecnico: '   ', resultado: ' '.repeat(4) })).toEqual([])
  })

  it('con fecha real, técnico y resultado los da los tres, en ese orden', () => {
    expect(
      datosDocumentados({ fechaRealizada: '2025-03-14', tecnico: 'Técnico de prueba', resultado: 'Limpieza de prueba' }),
    ).toEqual([
      { etiqueta: 'Fecha real documentada', valor: expect.stringContaining('2025') },
      { etiqueta: 'Técnico documentado', valor: 'Técnico de prueba' },
      { etiqueta: 'Resultado documentado', valor: 'Limpieza de prueba' },
    ])
  })

  it('con uno solo da solo ese', () => {
    expect(datosDocumentados({ ...vacio, resultado: 'Cambio de prueba' })).toEqual([
      { etiqueta: 'Resultado documentado', valor: 'Cambio de prueba' },
    ])
  })

  it('un antecedente con datos documentados sigue sin entrar en la Agenda', () => {
    const conDatos = {
      ...antecedenteDesdeCronograma('a9', marca()),
      estado: 'realizado' as const,
      fechaRealizada: '2025-03-14',
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza de prueba',
      eliminadoEn: null,
    }
    expect(entraEnAgenda(conDatos)).toBe(false)
    expect(entraEnAgenda({ ...conDatos, estado: 'programado' })).toBe(false)
  })
})
