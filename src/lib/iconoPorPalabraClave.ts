// Motor generico para resolver un icono (o cualquier otro valor) a
// partir de un texto libre por palabras clave: recorre las reglas en
// orden y devuelve el valor de la primera cuyo patron coincida, o el
// valor por defecto si ninguna lo hace. El orden importa porque las
// reglas no son excluyentes entre si. Lo usan iconoDeCategoria
// (categorias de equipo, en features/soluciones/iconosSoluciones.ts) y
// su equivalente de la boveda (categoria de credencial, en
// features/boveda/BovedaPage.tsx): mismo mecanismo, vocabularios y
// conjuntos de iconos propios de cada dominio.
export function iconoPorPalabraClave<T>(texto: string, reglas: [RegExp, T][], porDefecto: T): T {
  for (const [regla, valor] of reglas) {
    if (regla.test(texto)) return valor
  }
  return porDefecto
}
