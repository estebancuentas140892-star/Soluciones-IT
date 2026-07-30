import { beforeEach, describe, expect, it, vi } from 'vitest'

// El módulo memoriza por `location.key` en una variable de módulo (para
// ser seguro bajo StrictMode): cada test necesita una instancia fresca,
// así que se reimporta con `vi.resetModules()` en vez de reusar el
// mismo `procesada` de un test a otro.
async function importarFresco() {
  vi.resetModules()
  return import('./direccionTransicion')
}

function loc(pathname: string, key: string) {
  return { pathname, key }
}

describe('direccionPara', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('la primera ubicación procesada es lateral (no hay "anterior" con quien comparar)', async () => {
    const { direccionPara } = await importarFresco()
    expect(direccionPara(loc('/', 'k1'))).toBe('lateral')
  })

  it('bajar un nivel (más segmentos) entra', async () => {
    const { direccionPara } = await importarFresco()
    direccionPara(loc('/soluciones', 'k1'))
    expect(direccionPara(loc('/soluciones/cat-1', 'k2'))).toBe('entra')
  })

  it('subir un nivel (menos segmentos) vuelve', async () => {
    const { direccionPara } = await importarFresco()
    direccionPara(loc('/soluciones/cat-1/art-1', 'k1'))
    expect(direccionPara(loc('/soluciones/cat-1', 'k2'))).toBe('vuelve')
  })

  it('cambiar entre raíces de pestaña es lateral, aunque tengan distinta profundidad', async () => {
    const { direccionPara } = await importarFresco()
    direccionPara(loc('/', 'k1'))
    // "/" tiene 0 segmentos y "/soluciones" tiene 1: por profundidad
    // parecería "entra", pero ambas son raíces de pestaña.
    expect(direccionPara(loc('/soluciones', 'k2'))).toBe('lateral')
  })

  it('misma profundidad entre no-raíces es lateral', async () => {
    const { direccionPara } = await importarFresco()
    direccionPara(loc('/soluciones/cat-1/art-1', 'k1'))
    expect(direccionPara(loc('/soluciones/cat-1/art-2', 'k2'))).toBe('lateral')
  })

  it('es idempotente para la misma clave (StrictMode monta, desmonta y vuelve a montar)', async () => {
    const { direccionPara } = await importarFresco()
    direccionPara(loc('/soluciones', 'k1'))
    const primera = direccionPara(loc('/soluciones/cat-1', 'k2'))
    // Una segunda instancia de Chasis para LA MISMA navegación (mismo
    // key) debe ver la misma dirección ya calculada, no recalcularla
    // contra sí misma (lo que daría "lateral" por error).
    const segunda = direccionPara(loc('/soluciones/cat-1', 'k2'))
    expect(primera).toBe('entra')
    expect(segunda).toBe('entra')
  })

  it('permanecer en la misma ruta (mismo key) es lateral', async () => {
    const { direccionPara } = await importarFresco()
    direccionPara(loc('/soluciones', 'k1'))
    expect(direccionPara(loc('/soluciones', 'k1'))).toBe('lateral')
  })
})
