import { describe, expect, it } from 'vitest'
import {
  extraerIdDeEtiqueta,
  resolverCodigo,
  type DispositivoEscaneable,
} from './resolverCodigo'

function dispositivo(
  id: string,
  extra: Partial<DispositivoEscaneable> = {},
): DispositivoEscaneable {
  return { id, serial: '', placaInventario: '', eliminadoEn: null, ...extra }
}

describe('extraerIdDeEtiqueta', () => {
  it('extrae el id de una URL de ficha, sin importar el origen', () => {
    expect(extraerIdDeEtiqueta('https://soluciones-it-psi.vercel.app/dispositivos/abc-123')).toBe(
      'abc-123',
    )
    expect(extraerIdDeEtiqueta('http://localhost:5173/dispositivos/abc-123')).toBe('abc-123')
    expect(extraerIdDeEtiqueta('https://otro-dominio.com/dispositivos/abc-123/')).toBe('abc-123')
  })

  it('rechaza lo que no es una URL de ficha de dispositivo', () => {
    expect(extraerIdDeEtiqueta('PLACA-001')).toBeNull()
    expect(extraerIdDeEtiqueta('https://app.com/soluciones/cat-1')).toBeNull()
    expect(extraerIdDeEtiqueta('https://app.com/dispositivos')).toBeNull()
    expect(extraerIdDeEtiqueta('https://app.com/dispositivos/abc/editar')).toBeNull()
    expect(extraerIdDeEtiqueta('https://app.com/dispositivos/nuevo')).toBeNull()
    expect(extraerIdDeEtiqueta('https://app.com/dispositivos/etiquetas')).toBeNull()
    expect(extraerIdDeEtiqueta('mailto:alguien@correo.com')).toBeNull()
  })
})

describe('resolverCodigo', () => {
  it('una etiqueta de la app abre la ficha si el dispositivo existe', () => {
    const lista = [dispositivo('abc-123')]
    expect(resolverCodigo('https://app.com/dispositivos/abc-123', lista)).toEqual({
      tipo: 'dispositivo',
      dispositivoId: 'abc-123',
    })
  })

  it('una etiqueta de un dispositivo eliminado o inexistente no encuentra nada', () => {
    const lista = [dispositivo('abc-123', { eliminadoEn: '2026-07-01T00:00:00Z' })]
    expect(resolverCodigo('https://app.com/dispositivos/abc-123', lista)).toEqual({
      tipo: 'no_encontrado',
    })
    expect(resolverCodigo('https://app.com/dispositivos/no-existe', lista)).toEqual({
      tipo: 'no_encontrado',
    })
  })

  it('encuentra por placa de inventario, sin distinguir mayusculas ni espacios', () => {
    const lista = [dispositivo('d1', { placaInventario: 'PLACA-001' })]
    expect(resolverCodigo('  placa-001  ', lista)).toEqual({
      tipo: 'dispositivo',
      dispositivoId: 'd1',
    })
  })

  it('encuentra por serial cuando ninguna placa coincide', () => {
    const lista = [dispositivo('d1', { serial: 'SN-9988' })]
    expect(resolverCodigo('sn-9988', lista)).toEqual({ tipo: 'dispositivo', dispositivoId: 'd1' })
  })

  it('la placa tiene prioridad sobre el serial de otro dispositivo', () => {
    const lista = [
      dispositivo('con-serial', { serial: 'X-100' }),
      dispositivo('con-placa', { placaInventario: 'X-100' }),
    ]
    expect(resolverCodigo('X-100', lista)).toEqual({
      tipo: 'dispositivo',
      dispositivoId: 'con-placa',
    })
  })

  it('devuelve todos los candidatos si el codigo coincide con varios', () => {
    const lista = [
      dispositivo('d1', { serial: 'REPETIDO' }),
      dispositivo('d2', { serial: 'REPETIDO' }),
    ]
    expect(resolverCodigo('REPETIDO', lista)).toEqual({
      tipo: 'varios',
      dispositivoIds: ['d1', 'd2'],
    })
  })

  it('ignora dispositivos eliminados al buscar por placa o serial', () => {
    const lista = [
      dispositivo('vivo', { serial: 'SN-1' }),
      dispositivo('borrado', { serial: 'SN-1', eliminadoEn: '2026-07-01T00:00:00Z' }),
    ]
    expect(resolverCodigo('SN-1', lista)).toEqual({ tipo: 'dispositivo', dispositivoId: 'vivo' })
  })

  it('un codigo vacio o desconocido no encuentra nada', () => {
    const lista = [dispositivo('d1', { placaInventario: 'PLACA-001' })]
    expect(resolverCodigo('   ', lista)).toEqual({ tipo: 'no_encontrado' })
    expect(resolverCodigo('OTRA-COSA', lista)).toEqual({ tipo: 'no_encontrado' })
  })

  it('un dispositivo sin placa ni serial no coincide con nada', () => {
    const lista = [dispositivo('d1')]
    expect(resolverCodigo('X', lista)).toEqual({ tipo: 'no_encontrado' })
  })
})
