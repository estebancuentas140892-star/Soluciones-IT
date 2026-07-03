import { describe, expect, it } from 'vitest'
import {
  MINIMO_CARACTERES_CONTRASENA,
  traducirErrorAuth,
  validarCambioContrasena,
} from './erroresAuth'

describe('traducirErrorAuth', () => {
  it('traduce los errores conocidos de Supabase', () => {
    expect(traducirErrorAuth('Invalid login credentials')).toBe('Correo o contraseña incorrectos.')
    expect(traducirErrorAuth('Email not confirmed')).toBe('La cuenta aún no fue confirmada.')
    expect(traducirErrorAuth('New password should be different from the old password.')).toBe(
      'La nueva contraseña debe ser distinta de la actual.',
    )
    expect(traducirErrorAuth('Request rate limit reached')).toBe(
      'Demasiados intentos seguidos. Espera un momento y vuelve a intentar.',
    )
    expect(traducirErrorAuth('Failed to fetch')).toBe('Sin conexión con el servidor. Intenta de nuevo.')
  })

  it('conserva el mínimo de caracteres que exige el servidor', () => {
    expect(traducirErrorAuth('Password should be at least 6 characters.')).toBe(
      'La contraseña debe tener al menos 6 caracteres.',
    )
    expect(traducirErrorAuth('Password should be at least 12 characters.')).toBe(
      'La contraseña debe tener al menos 12 caracteres.',
    )
  })

  it('deja pasar tal cual un mensaje desconocido', () => {
    expect(traducirErrorAuth('Algo inesperado')).toBe('Algo inesperado')
  })
})

describe('validarCambioContrasena', () => {
  const valida = 'NuevaClave99'

  it('acepta un cambio bien formado', () => {
    expect(validarCambioContrasena('actual123', valida, valida)).toBeNull()
  })

  it('exige la contraseña actual', () => {
    expect(validarCambioContrasena('', valida, valida)).toBe('Escribe tu contraseña actual.')
  })

  it('exige el mínimo de caracteres en la nueva', () => {
    const corta = 'a'.repeat(MINIMO_CARACTERES_CONTRASENA - 1)
    expect(validarCambioContrasena('actual123', corta, corta)).toBe(
      `La nueva contraseña debe tener al menos ${MINIMO_CARACTERES_CONTRASENA} caracteres.`,
    )
  })

  it('exige que la confirmación coincida', () => {
    expect(validarCambioContrasena('actual123', valida, 'otraCosa99')).toBe(
      'Las contraseñas no coinciden.',
    )
  })

  it('rechaza reutilizar la contraseña actual', () => {
    expect(validarCambioContrasena(valida, valida, valida)).toBe(
      'La nueva contraseña debe ser distinta de la actual.',
    )
  })
})
