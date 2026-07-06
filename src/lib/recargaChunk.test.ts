import { describe, expect, it } from 'vitest'
import { esErrorDeChunk } from './recargaChunk'

describe('esErrorDeChunk', () => {
  it('reconoce los mensajes de import dinámico fallido de cada navegador', () => {
    const mensajes = [
      'Failed to fetch dynamically imported module: https://app/assets/RedPage-abc.js',
      'error loading dynamically imported module: https://app/assets/x.js',
      'Importing a module script failed.',
      'ChunkLoadError: Loading chunk 5 failed.',
    ]
    for (const mensaje of mensajes) {
      expect(esErrorDeChunk(new Error(mensaje))).toBe(true)
    }
  })

  it('no confunde otros errores de la app con un fallo de chunk', () => {
    expect(esErrorDeChunk(new Error('La bóveda está bloqueada.'))).toBe(false)
    expect(esErrorDeChunk(new Error('Sin conexión con el servidor'))).toBe(false)
    expect(esErrorDeChunk(new Error('Failed to fetch'))).toBe(false)
    expect(esErrorDeChunk(null)).toBe(false)
    expect(esErrorDeChunk(undefined)).toBe(false)
  })
})
