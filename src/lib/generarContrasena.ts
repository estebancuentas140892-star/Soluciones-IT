// Generador de contrasenas fuertes, compartido entre CredencialForm (Boveda)
// y SeguridadDelEquipo (campos protegidos del dispositivo, hallazgo S3 de
// AUDITORIA_FLUJOS_TI.md): antes vivia solo en CredencialForm.tsx.
export function generarContrasena(): string {
  // Sin caracteres que se confunden entre si (O/0, l/1, I).
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$%&*+-=?'
  const valores = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(valores, (v) => caracteres[v % caracteres.length]).join('')
}
