// Vocabulario derivado del uso real: las opciones que un campo de
// texto libre ofrece como sugerencia salen de lo que el equipo ya
// escribio, nunca de una tabla de configuracion que alguien tenga que
// mantener al dia. Es el mismo criterio de las marcas y las
// propiedades sugeridas de dispositivos, generalizado aqui para que
// todos los campos con sugerencia se comporten igual.
//
// Convive a proposito con `src/features/soluciones/etiquetas.ts`, que
// NO se fusiona con esto: alli el orden importa (las etiquetas mas
// usadas primero) y hay que elegir una grafia canonica por clave, asi
// que resuelve un problema distinto. Aqui basta con "los valores
// distintos, ordenados alfabeticamente".

// Valores distintos, sin vacios y ordenados, para un datalist de
// autocompletar. Deduplica sin distinguir mayusculas (conserva la
// primera forma vista) para no ofrecer "POS" y "pos" como opciones
// separadas, y ordena con el locale español para que los acentos y los
// numeros queden donde el tecnico los espera.
export function valoresUnicos(valores: string[]): string[] {
  const porClave = new Map<string, string>()
  for (const valor of valores) {
    const limpio = valor.trim()
    if (limpio === '') continue
    const clave = limpio.toLowerCase()
    if (!porClave.has(clave)) porClave.set(clave, limpio)
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
}
