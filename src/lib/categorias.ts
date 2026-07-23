// Unico dueño de la regla `es_red` (Fase 1 de
// PROPUESTA_REVISION_ARQUITECTURA.md). Antes cada pantalla leia
// `categoria.esRed` suelto: DispositivosPage y RedPage lo hacian con
// `.filter((c) => c.esRed)` (sin `Boolean()`, pese a que el campo puede
// llegar null de una base que aun no tiene la columna, ver el comentario
// de `Categoria.esRed` en db.ts), TopologiaPage armaba su propio Set y
// DispositivoPage si usaba `Boolean()`. Con esto la regla se define una
// sola vez y todas las pantallas la leen igual.

import type { Categoria } from './db'

// Una categoria es "de red" cuando sus dispositivos se muestran en la
// seccion Red en vez de Dispositivos. Tolera null/undefined (categoria
// que aun no bajo, o columna que aun no existe en la base).
export function esDeRed(categoria: Categoria | null | undefined): boolean {
  return Boolean(categoria?.esRed)
}

// Ids de las categorias de red, para separar el inventario en las dos
// secciones. Es el uso mas repetido de la regla: Dispositivos excluye
// estos ids, Red y Topologia se quedan solo con ellos.
export function idsDeRed(categorias: Categoria[] | undefined): Set<string> {
  return new Set((categorias ?? []).filter(esDeRed).map((c) => c.id))
}
