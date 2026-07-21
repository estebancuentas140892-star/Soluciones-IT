// Color de identidad de cada categoria (fase 0b de
// PROPUESTA_REVISION_ARQUITECTURA.md). Responde a un pedido explicito
// del usuario ("cada categoria con su color"): hasta ahora todas las
// categorias se veian iguales, moradas al estar activas y neutras al no
// estarlo, asi que nada distinguia "Impresoras" de "Camaras" de un
// vistazo.
//
// Es uno de los TRES lenguajes de color de la app, y conviene no
// mezclarlos al agregar pantallas:
//   - ESTADO de un equipo (operativo, en mantenimiento, fuera de
//     servicio): verde / ambar / rojo. Ver src/features/dispositivos/estados.ts.
//   - TIPO de documento (instalacion, configuracion, conexion...): tiñe
//     el recuadro del icono de cada articulo. Ver iconosSoluciones.ts.
//   - CATEGORIA (esto): tiñe las superficies que REPRESENTAN a la
//     categoria (chips de filtro, cabeceras de grupo, rejillas de
//     seleccion), nunca las filas de contenido de dentro.

import type { Categoria } from '../../lib/db'

// Las diez claves de token disponibles. El nombre es la clave que se
// guarda en la columna `categorias.color`, NUNCA un hex suelto: asi el
// dia que se retoque un matiz se cambia en un solo sitio (index.css) y
// las fichas ya guardadas siguen siendo validas.
export const CLAVES_COLOR_CATEGORIA = [
  'cat-1',
  'cat-2',
  'cat-3',
  'cat-4',
  'cat-5',
  'cat-6',
  'cat-7',
  'cat-8',
  'cat-9',
  'cat-10',
] as const

export type ClaveColorCategoria = (typeof CLAVES_COLOR_CATEGORIA)[number]

export function esClaveColorValida(valor: unknown): valor is ClaveColorCategoria {
  return typeof valor === 'string' && (CLAVES_COLOR_CATEGORIA as readonly string[]).includes(valor)
}

// El color de una categoria: su override manual si lo tiene, y si no
// uno derivado de su `orden`. Derivar del orden (en vez de sortear o de
// usar el id) hace que el color sea ESTABLE y predecible: la misma
// categoria se ve siempre igual en todos los telefonos del equipo sin
// necesidad de guardar nada, y dos categorias contiguas en el listado
// nunca reciben el mismo matiz.
//
// El modulo entero funciona sin la columna: `color` puede llegar null de
// una base a la que aun no se le aplico el schema.sql de N3, y tambien
// puede traer una clave que ya no exista (por ejemplo si algun dia se
// reduce la paleta), en cuyo caso se cae al derivado en vez de romper.
export function colorDeCategoria(categoria: Pick<Categoria, 'color' | 'orden'>): ClaveColorCategoria {
  if (esClaveColorValida(categoria.color)) return categoria.color
  return colorPorOrden(categoria.orden)
}

// Reparte los diez matices por el orden, ciclando al pasar de diez.
// Tolera ordenes negativos, cero y decimales (el dato viene de una
// columna que el equipo puede editar): siempre cae en un indice valido.
export function colorPorOrden(orden: number): ClaveColorCategoria {
  const total = CLAVES_COLOR_CATEGORIA.length
  const entero = Number.isFinite(orden) ? Math.trunc(orden) : 0
  // El doble modulo evita el indice negativo que da % en JavaScript.
  const indice = ((entero % total) + total) % total
  return CLAVES_COLOR_CATEGORIA[indice]
}

// Las clases van COMPLETAS y literales en un Record, nunca construidas
// como `text-noct-${clave}`: Tailwind analiza el codigo como texto y no
// genera las utilidades que no encuentra escritas enteras. Es la misma
// razon por la que iconosSoluciones.ts mantiene dos records paralelos.

// Solo el color del icono o del texto: para un icono suelto sobre el
// fondo (cabecera de grupo, chip en reposo).
const TEXTO_POR_CLAVE: Record<ClaveColorCategoria, string> = {
  'cat-1': 'text-noct-cat-1',
  'cat-2': 'text-noct-cat-2',
  'cat-3': 'text-noct-cat-3',
  'cat-4': 'text-noct-cat-4',
  'cat-5': 'text-noct-cat-5',
  'cat-6': 'text-noct-cat-6',
  'cat-7': 'text-noct-cat-7',
  'cat-8': 'text-noct-cat-8',
  'cat-9': 'text-noct-cat-9',
  'cat-10': 'text-noct-cat-10',
}

// Chip o ficha ACTIVA: borde, fondo tenue y texto en el color de la
// categoria. Reemplaza al acento generico que hasta ahora usaban todas
// por igual. Los porcentajes son los mismos que ya usaba el acento
// (borde solido, fondo al 14 %) para no cambiar el peso visual, solo el
// matiz.
const ACTIVO_POR_CLAVE: Record<ClaveColorCategoria, string> = {
  'cat-1': 'border-noct-cat-1 bg-noct-cat-1/[.14] text-noct-cat-1',
  'cat-2': 'border-noct-cat-2 bg-noct-cat-2/[.14] text-noct-cat-2',
  'cat-3': 'border-noct-cat-3 bg-noct-cat-3/[.14] text-noct-cat-3',
  'cat-4': 'border-noct-cat-4 bg-noct-cat-4/[.14] text-noct-cat-4',
  'cat-5': 'border-noct-cat-5 bg-noct-cat-5/[.14] text-noct-cat-5',
  'cat-6': 'border-noct-cat-6 bg-noct-cat-6/[.14] text-noct-cat-6',
  'cat-7': 'border-noct-cat-7 bg-noct-cat-7/[.14] text-noct-cat-7',
  'cat-8': 'border-noct-cat-8 bg-noct-cat-8/[.14] text-noct-cat-8',
  'cat-9': 'border-noct-cat-9 bg-noct-cat-9/[.14] text-noct-cat-9',
  'cat-10': 'border-noct-cat-10 bg-noct-cat-10/[.14] text-noct-cat-10',
}

// Recuadro de icono con fondo tenue (12 %), el mismo tratamiento que
// `claseTonoDeTipo` da al tipo de documento pero con el matiz de la
// categoria: para la ficha de la categoria y las rejillas donde el
// icono va dentro de un cuadrado.
const TONO_POR_CLAVE: Record<ClaveColorCategoria, string> = {
  'cat-1': 'text-noct-cat-1 bg-noct-cat-1/[.12]',
  'cat-2': 'text-noct-cat-2 bg-noct-cat-2/[.12]',
  'cat-3': 'text-noct-cat-3 bg-noct-cat-3/[.12]',
  'cat-4': 'text-noct-cat-4 bg-noct-cat-4/[.12]',
  'cat-5': 'text-noct-cat-5 bg-noct-cat-5/[.12]',
  'cat-6': 'text-noct-cat-6 bg-noct-cat-6/[.12]',
  'cat-7': 'text-noct-cat-7 bg-noct-cat-7/[.12]',
  'cat-8': 'text-noct-cat-8 bg-noct-cat-8/[.12]',
  'cat-9': 'text-noct-cat-9 bg-noct-cat-9/[.12]',
  'cat-10': 'text-noct-cat-10 bg-noct-cat-10/[.12]',
}

export function claseTextoDeCategoria(categoria: Pick<Categoria, 'color' | 'orden'>): string {
  return TEXTO_POR_CLAVE[colorDeCategoria(categoria)]
}

export function claseActivaDeCategoria(categoria: Pick<Categoria, 'color' | 'orden'>): string {
  return ACTIVO_POR_CLAVE[colorDeCategoria(categoria)]
}

export function claseTonoDeCategoria(categoria: Pick<Categoria, 'color' | 'orden'>): string {
  return TONO_POR_CLAVE[colorDeCategoria(categoria)]
}
