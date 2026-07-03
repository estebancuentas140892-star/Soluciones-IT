// Logica pura de autenticacion: traduccion de los mensajes de error
// de Supabase Auth al espanol y validacion local del cambio de
// contrasena. Separada de los componentes para poder probarla sin
// navegador ni servidor.

export function traducirErrorAuth(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(mensaje)) return 'La cuenta aún no fue confirmada.'
  if (/new password should be different/i.test(mensaje)) {
    return 'La nueva contraseña debe ser distinta de la actual.'
  }
  // "Password should be at least N characters": el minimo real lo
  // decide el servidor; aqui solo se traduce conservando el numero.
  const minimo = /password should be at least (\d+)/i.exec(mensaje)
  if (minimo) return `La contraseña debe tener al menos ${minimo[1]} caracteres.`
  if (/rate limit|too many requests/i.test(mensaje)) {
    return 'Demasiados intentos seguidos. Espera un momento y vuelve a intentar.'
  }
  if (/fetch|network/i.test(mensaje)) return 'Sin conexión con el servidor. Intenta de nuevo.'
  return mensaje
}

// Minimo local para contrasenas nuevas. Supabase acepta 6 por
// defecto; aqui se exige un poco mas por ser cuentas compartidas
// con acceso a la boveda del equipo.
export const MINIMO_CARACTERES_CONTRASENA = 8

// Devuelve el mensaje de error para mostrar, o null si el cambio es
// valido y se puede enviar al servidor.
export function validarCambioContrasena(
  actual: string,
  nueva: string,
  confirmacion: string,
): string | null {
  if (!actual) return 'Escribe tu contraseña actual.'
  if (nueva.length < MINIMO_CARACTERES_CONTRASENA) {
    return `La nueva contraseña debe tener al menos ${MINIMO_CARACTERES_CONTRASENA} caracteres.`
  }
  if (nueva !== confirmacion) return 'Las contraseñas no coinciden.'
  if (nueva === actual) return 'La nueva contraseña debe ser distinta de la actual.'
  return null
}
