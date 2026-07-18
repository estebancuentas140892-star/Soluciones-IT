import { describe, expect, it } from 'vitest'
import type { CambioPendiente } from './db'
import { describirCambio, explicarErrorDeSync } from './descripcionCambio'

function cambio(parcial: Partial<CambioPendiente>): CambioPendiente {
  return {
    id: 'c1',
    tabla: 'articulos',
    entidadId: 'aaaabbbb-1111-2222-3333-444455556666',
    payload: {},
    creadoEn: '2026-07-17T10:00:00Z',
    error: null,
    intentos: 0,
    ...parcial,
  }
}

describe('describirCambio', () => {
  it('describe una solución por su título', () => {
    const d = describirCambio(cambio({ payload: { titulo: 'Instalar impresora Zebra' } }))
    expect(d.titulo).toBe('Solución: Instalar impresora Zebra')
  })

  it('marca las eliminaciones', () => {
    const d = describirCambio(
      cambio({ payload: { titulo: 'Instalar impresora Zebra', eliminadoEn: '2026-07-17T10:00:00Z' } }),
    )
    expect(d.titulo).toBe('Solución: Instalar impresora Zebra (eliminación)')
  })

  it('usa el nombre para un equipo y traduce la tabla', () => {
    const d = describirCambio(cambio({ tabla: 'dispositivos', payload: { nombre: 'Switch D32' } }))
    expect(d.titulo).toBe('Equipo: Switch D32')
  })

  it('sin título reconocible cae al id recortado', () => {
    const d = describirCambio(cambio({ payload: { otraCosa: 1 } }))
    expect(d.titulo).toBe('Solución: aaaabbbb')
  })

  it('sin error no hay explicación', () => {
    expect(describirCambio(cambio({})).explicacion).toBeNull()
  })

  it('con error entrega la explicación traducida y los intentos', () => {
    const d = describirCambio(
      cambio({ error: 'column "estado" does not exist', intentos: 4 }),
    )
    expect(d.explicacion).toContain('schema.sql')
    expect(d.intentos).toBe(4)
  })
})

describe('explicarErrorDeSync', () => {
  it('columna o tabla inexistente apunta al schema.sql', () => {
    expect(explicarErrorDeSync('relation "public.diagnosticos" does not exist')).toContain(
      'schema.sql',
    )
  })

  it('errores de RLS hablan de permisos', () => {
    expect(
      explicarErrorDeSync('new row violates row-level security policy for table "credenciales"'),
    ).toContain('permisos')
  })

  it('sesión vencida pide volver a entrar', () => {
    expect(explicarErrorDeSync('JWT expired')).toContain('sesión')
  })

  it('un error desconocido se muestra tal cual', () => {
    expect(explicarErrorDeSync('algo raro pasó')).toBe('algo raro pasó')
  })
})
