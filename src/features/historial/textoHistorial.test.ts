import { describe, expect, it } from 'vitest'
import { descripcionEntrada, etiquetaDeCampo } from './textoHistorial'

describe('etiquetaDeCampo', () => {
  it('traduce campos conocidos', () => {
    expect(etiquetaDeCampo('ip')).toBe('Dirección IP')
    expect(etiquetaDeCampo('titulo')).toBe('Título')
    expect(etiquetaDeCampo('datosCifrados')).toBe('Datos protegidos')
  })

  it('usa el nombre del campo si no hay traducción', () => {
    expect(etiquetaDeCampo('campoDesconocido')).toBe('campoDesconocido')
  })
})

describe('descripcionEntrada', () => {
  it('describe la creación', () => {
    expect(
      descripcionEntrada({ campo: 'creacion', valorAnterior: '', valorNuevo: 'Router principal' }),
    ).toBe('Se creó: Router principal')
  })

  it('describe la eliminación', () => {
    expect(
      descripcionEntrada({ campo: 'eliminacion', valorAnterior: 'Router principal', valorNuevo: '' }),
    ).toBe('Se eliminó: Router principal')
  })

  it('describe una intervención manual con su propio texto', () => {
    expect(
      descripcionEntrada({ campo: 'intervencion', valorAnterior: '', valorNuevo: 'Cambio de disco duro' }),
    ).toBe('Cambio de disco duro')
  })

  it('describe un adjunto agregado', () => {
    expect(descripcionEntrada({ campo: 'adjunto', valorAnterior: '', valorNuevo: 'manual.pdf' })).toBe(
      'Se agregó el adjunto: manual.pdf',
    )
  })

  it('describe una conexión agregada y una quitada', () => {
    expect(
      descripcionEntrada({ campo: 'conexion', valorAnterior: '', valorNuevo: 'Switch D32 → Punto D80' }),
    ).toBe('Se agregó la conexión: Switch D32 → Punto D80')
    expect(
      descripcionEntrada({ campo: 'conexion', valorAnterior: 'Switch D32 → Punto D80', valorNuevo: '' }),
    ).toBe('Se quitó la conexión: Switch D32 → Punto D80')
  })

  // Tarea 320: programar, posponer, cancelar y quitar un mantenimiento.
  it('describe un mantenimiento programado, movido, quitado y un antecedente', () => {
    expect(
      descripcionEntrada({ campo: 'mantenimiento', valorAnterior: '', valorNuevo: 'Preventivo para el 20 oct 2026' }),
    ).toBe('Se programó el mantenimiento: Preventivo para el 20 oct 2026')
    expect(
      descripcionEntrada({
        campo: 'mantenimiento',
        valorAnterior: 'Preventivo para el 20 oct 2026',
        valorNuevo: 'Preventivo, pospuesto al 3 nov 2026',
      }),
    ).toBe('Mantenimiento: Preventivo para el 20 oct 2026 → Preventivo, pospuesto al 3 nov 2026')
    expect(
      descripcionEntrada({ campo: 'mantenimiento', valorAnterior: 'Preventivo para el 20 oct 2026', valorNuevo: '' }),
    ).toBe('Se quitó el mantenimiento: Preventivo para el 20 oct 2026')
    expect(
      descripcionEntrada({
        campo: 'mantenimiento',
        valorAnterior: '',
        valorNuevo: 'Preventivo para el 12 mar 2025 (documentado, por validar)',
      }),
    ).toBe('Se registró un antecedente de mantenimiento: Preventivo para el 12 mar 2025 (documentado, por validar)')
  })

  // Tarea 321: una autorización de facturación en el historial de su POS.
  it('describe una autorización asociada, cambiada y quitada', () => {
    const antes = 'PRB · 3.000 a 8.000 · Documentada, por validar'
    const despues = 'PRB · 3.000 a 8.000 · Confirmada'
    expect(descripcionEntrada({ campo: 'autorizacion_facturacion', valorAnterior: '', valorNuevo: antes })).toBe(
      `Se asoció la autorización de facturación: ${antes}`,
    )
    expect(descripcionEntrada({ campo: 'autorizacion_facturacion', valorAnterior: antes, valorNuevo: despues })).toBe(
      `Autorización de facturación: ${antes} → ${despues}`,
    )
    expect(descripcionEntrada({ campo: 'autorizacion_facturacion', valorAnterior: despues, valorNuevo: '' })).toBe(
      `Se quitó la autorización de facturación: ${despues}`,
    )
  })

  it('con los dos valores describe la inversión, no un alta', () => {
    expect(
      descripcionEntrada({
        campo: 'conexion',
        valorAnterior: 'Punto D80 → Switch D32',
        valorNuevo: 'Switch D32 → Punto D80',
      }),
    ).toBe('Se invirtió la dirección: Punto D80 → Switch D32 pasó a Switch D32 → Punto D80')
  })

  it('describe un cambio de campo con valor anterior y nuevo', () => {
    expect(
      descripcionEntrada({ campo: 'ip', valorAnterior: '192.168.1.50', valorNuevo: '192.168.1.60' }),
    ).toBe('Dirección IP: "192.168.1.50" → "192.168.1.60"')
  })

  it('describe cuando un campo se define por primera vez', () => {
    expect(
      descripcionEntrada({ campo: 'observaciones', valorAnterior: '', valorNuevo: 'Reemplazado el disco' }),
    ).toBe('Observaciones: se definió como "Reemplazado el disco"')
  })

  it('describe cuando se quita el valor de un campo', () => {
    expect(descripcionEntrada({ campo: 'observaciones', valorAnterior: 'Antiguo', valorNuevo: '' })).toBe(
      'Observaciones: se quitó "Antiguo"',
    )
  })

  it('para las credenciales nunca muestra el bloque cifrado, solo el marcador', () => {
    expect(
      descripcionEntrada({ campo: 'datosCifrados', valorAnterior: '(cifrado)', valorNuevo: '(cifrado)' }),
    ).toBe('Datos protegidos: "(cifrado)" → "(cifrado)"')
  })
})
