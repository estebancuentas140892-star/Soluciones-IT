import { describe, expect, it } from 'vitest'
import { faltantesDeAcceso, type EntradaAcceso } from './validacionAcceso'

function entrada(cambios: Partial<EntradaAcceso> = {}): EntradaAcceso {
  return {
    tipo: 'cuenta',
    titulo: 'Panel de Supabase',
    contrasena: 'secreta',
    notas: '',
    tieneArchivo: false,
    extras: [],
    ...cambios,
  }
}

function campos(cambios: Partial<EntradaAcceso> = {}): string[] {
  return faltantesDeAcceso(entrada(cambios)).map((f) => f.campo)
}

describe('faltantesDeAcceso', () => {
  it('no reclama nada cuando la cuenta tiene nombre y contraseña', () => {
    expect(faltantesDeAcceso(entrada())).toEqual([])
  })

  it('exige el nombre en cualquier tipo', () => {
    expect(campos({ titulo: '   ' })).toContain('titulo')
    expect(campos({ tipo: 'nota', titulo: '', notas: 'texto' })).toEqual(['titulo'])
  })

  it('exige la contraseña de una cuenta pero no el usuario', () => {
    expect(campos({ contrasena: '' })).toEqual(['contrasena'])
    expect(faltantesDeAcceso(entrada({ contrasena: '  ' }))[0]?.mensaje).toBe('Falta la contraseña')
  })

  it('exige la clave o PIN de una red con su propio texto', () => {
    const faltantes = faltantesDeAcceso(entrada({ tipo: 'red', contrasena: '' }))
    expect(faltantes.map((f) => f.campo)).toEqual(['contrasena'])
    expect(faltantes[0]?.mensaje).toBe('Falta la clave o PIN')
  })

  it('acepta una llave con el campo principal vacío si hay un dato protegido', () => {
    expect(
      campos({ tipo: 'llave', contrasena: '', extras: [{ clave: 'Token', valor: 'abc123' }] }),
    ).toEqual([])
  })

  it('no acepta una llave con datos protegidos a medio escribir', () => {
    expect(campos({ tipo: 'llave', contrasena: '', extras: [{ clave: 'Token', valor: '  ' }] })).toEqual([
      'contrasena',
    ])
    expect(campos({ tipo: 'llave', contrasena: '', extras: [{ clave: '', valor: 'abc123' }] })).toEqual([
      'contrasena',
    ])
  })

  it('exige el archivo de un archivo seguro', () => {
    expect(campos({ tipo: 'archivo', contrasena: '' })).toEqual(['archivo'])
    expect(campos({ tipo: 'archivo', contrasena: '', tieneArchivo: true })).toEqual([])
  })

  it('exige el texto de una nota segura', () => {
    expect(campos({ tipo: 'nota', contrasena: '', notas: '  ' })).toEqual(['notas'])
    expect(campos({ tipo: 'nota', contrasena: '', notas: 'La clave está en el sobre' })).toEqual([])
  })

  it('no exige contraseña ni notas a los tipos que no las usan', () => {
    expect(campos({ tipo: 'archivo', contrasena: '', notas: '', tieneArchivo: true })).toEqual([])
    expect(campos({ tipo: 'nota', contrasena: '', notas: 'algo' })).toEqual([])
  })

  it('acumula el nombre y el dato del tipo cuando faltan los dos', () => {
    expect(campos({ titulo: '', contrasena: '' })).toEqual(['titulo', 'contrasena'])
  })
})
