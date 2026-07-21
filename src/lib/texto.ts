// Helper generico de coercion de texto, sin dependencias de dominio.
// Vive aca (y no repetido en cada modulo que lo necesita) para que
// procedimiento.ts, diagnostico.ts y cualquier otro que reciba datos
// sueltos (por ejemplo de un JSON importado o de Supabase) compartan
// la misma regla.

// Valor arbitrario -> texto. Cualquier cosa que no sea string (null,
// undefined, numero, objeto) se trata como ausente y cae a ''.
export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}
