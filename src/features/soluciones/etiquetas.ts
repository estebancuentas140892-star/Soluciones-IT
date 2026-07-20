import { normalizarTexto } from './iconosSoluciones'

// Vocabulario de etiquetas derivado del uso real (fase J4 de la
// jornada del tecnico): nunca una tabla nueva que administrar, mismo
// criterio que las marcas y las propiedades sugeridas de dispositivos
// (valoresUnicos en DispositivoForm.tsx). La diferencia con ese patron
// es que aqui el orden importa (las sugerencias mas usadas primero) y
// hay que resolver una grafia canonica por clave normalizada, asi que
// vive en su propio modulo.

export interface GrafiaEtiqueta {
  // Grafia a mostrar: la mas usada entre todos los articulos para esa
  // clave normalizada (sin acentos ni mayusculas). A igualdad de uso,
  // la primera en orden alfabetico, para que el resultado sea
  // deterministico y las pruebas no dependan del orden de recorrido.
  texto: string
  usos: number
}

// Agrupa las etiquetas de todos los articulos por su clave normalizada
// y elige la grafia canonica de cada grupo. Ordena por uso descendente
// (las sugerencias mas frecuentes primero).
export function etiquetasFrecuentes(etiquetasPorArticulo: string[][]): GrafiaEtiqueta[] {
  const grafiasPorClave = new Map<string, Map<string, number>>()
  for (const etiquetas of etiquetasPorArticulo) {
    for (const cruda of etiquetas) {
      const limpia = cruda.trim()
      if (limpia === '') continue
      const clave = normalizarTexto(limpia)
      const grafias = grafiasPorClave.get(clave) ?? new Map<string, number>()
      grafias.set(limpia, (grafias.get(limpia) ?? 0) + 1)
      grafiasPorClave.set(clave, grafias)
    }
  }

  const resultado: GrafiaEtiqueta[] = []
  for (const grafias of grafiasPorClave.values()) {
    let mejorTexto = ''
    let mejorUsos = -1
    let totalUsos = 0
    for (const [texto, usos] of [...grafias.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
      totalUsos += usos
      if (usos > mejorUsos) {
        mejorUsos = usos
        mejorTexto = texto
      }
    }
    resultado.push({ texto: mejorTexto, usos: totalUsos })
  }

  return resultado.sort((a, b) => b.usos - a.usos || a.texto.localeCompare(b.texto, 'es'))
}

// Normalizacion suave al guardar UN articulo (fase J4): recorta
// espacios, quita duplicados internos que solo difieren en mayusculas
// o acentos (conservando el primero escrito) y, si el vocabulario
// global ya tiene una grafia mas usada para esa misma etiqueta, la
// adopta (asi "impresora" converge a "Impresora" si el resto del
// equipo ya escribe con mayuscula). Nunca reescribe otros articulos:
// una migracion masiva del vocabulario existente se decidiria aparte.
export function normalizarEtiquetas(etiquetas: string[], vocabulario: GrafiaEtiqueta[]): string[] {
  const canonicaPorClave = new Map(vocabulario.map((g) => [normalizarTexto(g.texto), g.texto]))
  const vistas = new Set<string>()
  const resultado: string[] = []
  for (const cruda of etiquetas) {
    const limpia = cruda.trim()
    if (limpia === '') continue
    const clave = normalizarTexto(limpia)
    if (vistas.has(clave)) continue
    vistas.add(clave)
    resultado.push(canonicaPorClave.get(clave) ?? limpia)
  }
  return resultado
}
