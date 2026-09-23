import type { Dispositivo } from '../../lib/db'
import { compararNatural } from '../../lib/conexiones'
import { incluyeTexto } from '../../lib/texto'

// LO QUE ENCUENTRA EL BUSCADOR DE EQUIPOS (encargo del 2026-09-22,
// sección 17, tarea 256).
//
// Sin texto, Equipos es el inventario general: las categorías de red
// (switches, cámaras, puntos de red...) viven en Red y no llenan esta
// lista. Pero "¿qué sabemos de SW-CENTRAL-02?" es una pregunta de
// Equipos aunque su topología viva en Red, así que AL ESCRIBIR también
// salen los equipos de red que coinciden, aparte y con su categoría. Con
// un chip de categoría elegido no: los chips son de categorías generales
// y un equipo de red no puede estar en ninguna.
//
// Lógica pura, sin React ni base de datos, para probarla sola.

/**
 * Dónde se busca: nombre, IP, ubicación, serial, placa, marca y modelo.
 * La placa y el serial son lo que se lee en la etiqueta del equipo; la
 * marca y el modelo, lo que se dice de él ("la Zebra de caja").
 */
export function camposDeBusqueda(dispositivo: Dispositivo): string[] {
  return [
    dispositivo.nombre,
    dispositivo.ip,
    dispositivo.ubicacion,
    dispositivo.serial,
    dispositivo.placaInventario,
    dispositivo.marca,
    dispositivo.modelo,
  ]
}

export interface EquiposEncontrados {
  /** Del inventario general, por texto y categoría. */
  generales: Dispositivo[]
  /** De la red: solo al escribir y sin chip de categoría. */
  deRed: Dispositivo[]
}

function porNombre(a: Dispositivo, b: Dispositivo): number {
  return compararNatural(a.nombre, b.nombre)
}

export function buscarEquipos(
  dispositivos: Dispositivo[],
  idsRed: ReadonlySet<string>,
  { texto, categoriaId }: { texto: string; categoriaId: string },
): EquiposEncontrados {
  const vivos = dispositivos.filter((d) => !d.eliminadoEn)
  const coincide = (d: Dispositivo) => incluyeTexto(camposDeBusqueda(d), texto)
  const generales = vivos
    .filter((d) => !idsRed.has(d.categoriaId) && (!categoriaId || d.categoriaId === categoriaId) && coincide(d))
    .sort(porNombre)
  const conRed = texto.trim() !== '' && !categoriaId
  const deRed = conRed ? vivos.filter((d) => idsRed.has(d.categoriaId) && coincide(d)).sort(porNombre) : []
  return { generales, deRed }
}

/**
 * Lo que promete cada chip (tarea 207, hallazgo M-022: el chip cuenta lo
 * que va a dar). "Todos" cuenta también los de red que salen al
 * escribir; cada categoría, solo los suyos.
 */
export function conteosDeChips(
  dispositivos: Dispositivo[],
  idsRed: ReadonlySet<string>,
  texto: string,
): { todos: number; porCategoria: Map<string, number> } {
  const { generales, deRed } = buscarEquipos(dispositivos, idsRed, { texto, categoriaId: '' })
  const porCategoria = new Map<string, number>()
  for (const d of generales) porCategoria.set(d.categoriaId, (porCategoria.get(d.categoriaId) ?? 0) + 1)
  return { todos: generales.length + deRed.length, porCategoria }
}
