import { describe, expect, it } from 'vitest'
import { resumenDetalles } from './resumenDetalles'

function json(detalles: Record<string, string>): string {
  return JSON.stringify(detalles)
}

describe('resumenDetalles', () => {
  it('detecta un campo agregado', () => {
    const resumen = resumenDetalles(json({}), json({ Puerto: '1' }))
    expect(resumen.cambios).toEqual(['Se agregó el campo "Puerto": "1".'])
  })

  it('detecta un campo quitado', () => {
    const resumen = resumenDetalles(json({ 'Usuario asignado': 'jperez' }), json({}))
    expect(resumen.cambios).toEqual(['Se quitó el campo "Usuario asignado" ("jperez").'])
  })

  it('detecta un campo cambiado', () => {
    const resumen = resumenDetalles(json({ Switch: 'D31' }), json({ Switch: 'D32' }))
    expect(resumen.cambios).toEqual(['Se cambió "Switch": "D31" → "D32".'])
  })

  it('ignora los campos que no cambiaron', () => {
    const resumen = resumenDetalles(
      json({ Puerto: '1', Switch: 'D31' }),
      json({ Puerto: '1', Switch: 'D32' }),
    )
    expect(resumen.cambios).toEqual(['Se cambió "Switch": "D31" → "D32".'])
  })

  it('reúne varios cambios de una misma edición', () => {
    const resumen = resumenDetalles(
      json({ Puerto: '1', Switch: 'D31' }),
      json({ Puerto: '2', Switch: 'D31', VLAN: '10' }),
    )
    expect(resumen.cambios.sort()).toEqual(
      ['Se cambió "Puerto": "1" → "2".', 'Se agregó el campo "VLAN": "10".'].sort(),
    )
  })

  it('ofrece un resumen genérico cuando no hay diferencias detectables', () => {
    expect(resumenDetalles('{no es json', '{tampoco').cambios).toEqual([
      'Se actualizaron los campos adicionales.',
    ])
  })

  it('trata la ausencia de valor anterior como un objeto vacío', () => {
    const resumen = resumenDetalles('', json({ Puerto: '1' }))
    expect(resumen.cambios).toEqual(['Se agregó el campo "Puerto": "1".'])
  })
})
