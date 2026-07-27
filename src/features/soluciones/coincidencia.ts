import type { Articulo } from '../../lib/db'
import { normalizarTexto } from './iconosSoluciones'
import { etiquetaDeTipo } from './tiposArticulo'

// Si un artículo coincide con la búsqueda y, sobre todo, POR DÓNDE.
//
// Sale del problema P1-7 de la auditoría: la lista decía "3 resultados"
// pero no por qué. Cuando un artículo coincidía por una etiqueta y no por
// el título, el técnico veía una fila que no menciona lo que buscó y no
// entendía la lista. El buscador ya miraba estos cuatro campos; lo que
// faltaba era contar cuál acertó.
//
// La consulta llega YA normalizada (minúsculas sin acentos) porque quien
// busca la normaliza una sola vez para toda la lista; los campos se
// normalizan aquí, en cada comparación.

// Parte un título en tres tramos según dónde cae el término buscado
// (comparando en texto normalizado, pero devolviendo el original con sus
// acentos y mayúsculas), para que la fila pueda resaltar el tramo del
// medio. Si no hay coincidencia o consulta, todo queda en `pre`.
export function partirTitulo(titulo: string, consulta: string) {
  if (!consulta) return { pre: titulo, match: '', post: '' }
  const i = normalizarTexto(titulo).indexOf(consulta)
  if (i < 0) return { pre: titulo, match: '', post: '' }
  return {
    pre: titulo.slice(0, i),
    match: titulo.slice(i, i + consulta.length),
    post: titulo.slice(i + consulta.length),
  }
}

export interface CoincidenciaArticulo {
  // Coincidió en el título. No necesita explicación: la fila ya resalta
  // el término dentro del título, que es la señal más clara posible.
  enTitulo: boolean
  // Dónde coincidió cuando NO fue en el título, con su artículo
  // gramatical para que la frase "Coincide en ___" quede natural.
  donde: 'la etiqueta' | 'la categoría' | 'el tipo' | null
  // El valor concreto que coincidió, para mostrarlo como chip.
  valor: string | null
}

// Orden de prioridad: título, etiqueta, categoría, tipo. El título
// primero porque es lo que se ve; la etiqueta antes que categoría y tipo
// porque es la coincidencia más específica y la más sorprendente de las
// tres (nombra un equipo o una sede concreta, no un cajón).
export function coincidenciaArticulo(
  articulo: Articulo,
  consulta: string,
  categoriaNombre: string,
): CoincidenciaArticulo | null {
  if (!consulta) return null

  if (normalizarTexto(articulo.titulo).includes(consulta)) {
    return { enTitulo: true, donde: null, valor: null }
  }

  const etiqueta = (articulo.etiquetas ?? []).find((e) => normalizarTexto(e).includes(consulta))
  if (etiqueta) {
    return { enTitulo: false, donde: 'la etiqueta', valor: etiqueta }
  }

  if (categoriaNombre && normalizarTexto(categoriaNombre).includes(consulta)) {
    return { enTitulo: false, donde: 'la categoría', valor: categoriaNombre }
  }

  const tipo = etiquetaDeTipo(articulo.tipo)
  if (normalizarTexto(tipo).includes(consulta)) {
    return { enTitulo: false, donde: 'el tipo', valor: tipo }
  }

  return null
}
