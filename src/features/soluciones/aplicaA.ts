import type { AplicaA } from '../../lib/db'

// Compara sin distinguir mayusculas ni espacios sobrantes: la marca
// "HP" y "hp " deben contar como la misma, mismo criterio que el resto
// de comparaciones de texto libre de la app (serial/IP duplicados,
// vocabulario derivado).
function normalizar(texto: string): string {
  return texto.trim().toLowerCase()
}

// Un equipo minimo para la comparacion: solo lo que aplicaA puede
// filtrar. Evita acoplar este modulo al tipo completo `Dispositivo`.
export interface CriterioDispositivo {
  marca: string
  modelo: string
}

// Decide si un articulo con este `aplicaA` (hallazgo H6) aplica al
// equipo dado, DENTRO de una categoria que ya coincide (H1 sigue siendo
// el filtro principal; esto solo lo refina). null o sin ningun criterio
// significa "toda la categoria": aplica siempre. Un criterio vacio
// ("") en marca o modelo se trata igual que ausente (no filtra), asi
// un campo a medio llenar no excluye equipos por accidente. Cuando
// ambos criterios estan presentes, deben coincidir los dos (AND).
// Logica pura, sin React ni base de datos.
export function aplicaAlDispositivo(aplicaA: AplicaA | null, dispositivo: CriterioDispositivo): boolean {
  if (!aplicaA) return true

  const marca = aplicaA.marca?.trim() ?? ''
  const modelo = aplicaA.modelo?.trim() ?? ''
  if (marca === '' && modelo === '') return true

  if (marca !== '' && normalizar(marca) !== normalizar(dispositivo.marca)) return false
  if (modelo !== '' && normalizar(modelo) !== normalizar(dispositivo.modelo)) return false
  return true
}

// `aplicaA` a partir de lo escrito en el editor: cadenas vacias se
// normalizan a null (vuelve a "toda la categoria"), y si ambos campos
// quedan vacios el resultado completo es null en vez de un objeto con
// dos null sueltos, para no guardar ruido.
export function aplicaADesdeFormulario(marca: string, modelo: string): AplicaA | null {
  const marcaLimpia = marca.trim()
  const modeloLimpio = modelo.trim()
  if (marcaLimpia === '' && modeloLimpio === '') return null
  return {
    marca: marcaLimpia === '' ? null : marcaLimpia,
    modelo: modeloLimpio === '' ? null : modeloLimpio,
  }
}

// Texto breve para mostrar el refinamiento en la ficha del articulo
// ("Marca: Zebra", "Modelo: ZT411", "Marca: Zebra · Modelo: ZT411").
// '' si no hay ningun criterio (toda la categoria, nada que aclarar).
export function describirAplicaA(aplicaA: AplicaA | null): string {
  if (!aplicaA) return ''
  const partes: string[] = []
  if (aplicaA.marca) partes.push(`Marca: ${aplicaA.marca}`)
  if (aplicaA.modelo) partes.push(`Modelo: ${aplicaA.modelo}`)
  return partes.join(' · ')
}
