import { describe, expect, it } from 'vitest'
import {
  antecedenteDesdeCronograma,
  datosDocumentados,
  fechaDeMarca,
  mesDeTexto,
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
