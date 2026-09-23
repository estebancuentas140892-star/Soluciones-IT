import { describe, expect, it } from 'vitest'
import type { Articulo, Procedimiento } from '../../lib/db'
import { guiaDeConfiguracion } from './guiaDeConfiguracion'

const CON_PASOS = { pasos: [{ id: 'p1' }] } as unknown as Procedimiento

function guia(id: string, titulo: string, datos: Partial<Articulo> = {}): Articulo {
  return {
    id,
    titulo,
    etiquetas: [],
    estado: 'publicado',
    procedimiento: CON_PASOS,
    eliminadoEn: null,
    ...datos,
  } as Articulo
}

describe('la guía maestra de usuario nuevo', () => {
  it('la encuentra por su título', () => {
    const encontrada = guiaDeConfiguracion([
      guia('a', 'Instalar impresora de red'),
      guia('b', 'Configuración de equipo para usuario nuevo'),
    ])
    expect(encontrada?.id).toBe('b')
  })

  it('entre dos títulos de usuario nuevo, gana el que prepara el equipo', () => {
    const encontrada = guiaDeConfiguracion([
      guia('a', 'Crear usuario nuevo en el dominio'),
      guia('b', 'Configuración de equipo para usuario nuevo'),
    ])
    expect(encontrada?.id).toBe('b')
  })

  it('una etiqueta explícita gana a un título parecido', () => {
    const encontrada = guiaDeConfiguracion([
      guia('a', 'Crear usuario nuevo en el dominio'),
      guia('b', 'Alistamiento del computador', { etiquetas: ['Usuario nuevo'] }),
    ])
    expect(encontrada?.id).toBe('b')
  })

  it('entre dos títulos, la publicada y luego la general', () => {
    const encontrada = guiaDeConfiguracion([
      guia('a', 'Configurar equipo para usuario nuevo en Taquillas'),
      guia('b', 'Configurar equipo para usuario nuevo'),
      guia('c', 'Usuario nuevo (borrador)', { estado: 'borrador' }),
    ])
    expect(encontrada?.id).toBe('b')
  })

  it('ignora las eliminadas, las obsoletas y las que no tienen pasos', () => {
    expect(
      guiaDeConfiguracion([
        guia('a', 'Usuario nuevo', { eliminadoEn: '2026-01-01T00:00:00.000Z' }),
        guia('b', 'Usuario nuevo', { estado: 'obsoleto' }),
        guia('c', 'Usuario nuevo', { procedimiento: null }),
      ]),
    ).toBeNull()
  })

  it('no confunde cualquier guía que diga "nuevo"', () => {
    expect(guiaDeConfiguracion([guia('a', 'Instalar el nuevo firmware del switch')])).toBeNull()
  })
})
