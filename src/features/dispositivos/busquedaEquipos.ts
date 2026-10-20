import type { Dispositivo } from '../../lib/db'
import { compararNatural } from '../../lib/conexiones'
import { normalizarTexto } from '../../lib/texto'
import { coincidenciaDePalabra, esAproximable, palabrasLiterales, terminosDe } from '../../lib/coincidenciaAproximada'
import { palabrasDeContenido } from '../busqueda/consultaNatural'
import { areaDeQuienLoTiene, personaQueLoTiene, SIN_PERSONAS, type PersonasPorId } from './responsableEnLista'

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
// CON ERRORES DE TECLEO (tarea 346, encargo del 2026-10-20). Hasta ahora
// era una búsqueda por subcadena que distinguía tildes: "jose" no
// encontraba "José", y "daniel garcia" no encontraba nada si la persona era
// "Daniel Gracia". Ahora, con la regla común de Resolver
// (`lib/coincidenciaAproximada.ts`):
//   1. TAL CUAL: sin tildes ni mayúsculas, la consulta entera o cada una de
//      sus palabras que dicen algo está en los campos del equipo. Es lo
//      exacto, y va primero; dentro, el equipo cuya IP, serial o placa ES
//      lo escrito ("10.10.6.8" antes que "10.10.6.80").
//   2. POSIBLE COINCIDENCIA: cada palabra que no está tal cual se parece,
//      dentro de la tolerancia de siempre y contando dos letras cambiadas
//      de sitio como un error, a una palabra del nombre, el lugar, la marca,
//      el modelo, la persona o su área. Se devuelve aparte (`posibles`),
//      detrás de lo exacto, para que la pantalla lo diga.
//   La IP, el serial y la placa nunca se aproximan, y una palabra escrita
//   como un valor (con dígitos o símbolos) tampoco: "XK7Q2291" no trae el
//   equipo "XK7Q2292".
//
// Lógica pura, sin React ni base de datos, para probarla sola.

/** Un campo donde se busca. `valor`: solo coincide tal cual, nunca con una errata. */
export interface CampoDeBusqueda {
  texto: string
  valor: boolean
}

/**
 * Dónde se busca: nombre, IP, ubicación, serial, placa, marca, modelo y
 * responsable. La placa y el serial son lo que se lee en la etiqueta del
 * equipo; la marca y el modelo, lo que se dice de él ("la Zebra de
 * caja"); el responsable, de quién es, porque se conoce a la persona
 * antes que el nombre de su equipo.
 *
 * El responsable es la PERSONA VINCULADA por `responsableId`, con su nombre
 * vigente (tarea 346): si cambió de nombre, el equipo se encuentra por el
 * nuevo, no por la copia que guardó. Sin persona vinculada, lo escrito como
 * responsable (por validar, o el último de un equipo de baja), que nunca se
 * presenta como una persona: la fila lo dice "Anotado: «…» · por validar".
 *
 * Desde la tarea 317, también el área de quien lo tiene ("Control
 * Interno"), que se lee de la ficha de la persona: el equipo no la guarda.
 */
export function camposDeBusqueda(dispositivo: Dispositivo, personas: PersonasPorId = SIN_PERSONAS): CampoDeBusqueda[] {
  const persona = personaQueLoTiene(dispositivo, personas)
  return [
    { texto: dispositivo.nombre, valor: false },
    { texto: dispositivo.ip, valor: true },
    { texto: dispositivo.ubicacion, valor: false },
    { texto: dispositivo.serial, valor: true },
    { texto: dispositivo.placaInventario, valor: true },
    { texto: dispositivo.marca, valor: false },
    { texto: dispositivo.modelo, valor: false },
    { texto: persona ? persona.nombre : dispositivo.responsable, valor: false },
    { texto: areaDeQuienLoTiene(dispositivo, personas), valor: false },
  ]
}

/** Cómo coincide un equipo con lo escrito, o null si no coincide. */
export interface CoincidenciaDeEquipo {
  tipo: 'exacta' | 'aproximada'
  /** Cuántos errores se toleraron (0 si es exacta). */
  errores: number
  /** Su IP, su serial o su placa es exactamente lo escrito. */
  valorExacto: boolean
}

/** ¿Coincide este equipo (sus campos) con lo escrito? */
export function coincidenciaDeEquipo(campos: readonly CampoDeBusqueda[], consulta: string): CoincidenciaDeEquipo | null {
  const escrito = consulta.trim()
  if (escrito === '') return { tipo: 'exacta', errores: 0, valorExacto: false }
  const buscado = normalizarTexto(escrito)
  // `join` con espacio, como antes: dos campos no se leen como una palabra.
  const todo = normalizarTexto(campos.map((campo) => campo.texto ?? '').join(' '))
  const valorExacto = campos.some((campo) => campo.valor && campo.texto && normalizarTexto(campo.texto.trim()) === buscado)
  const palabras = palabrasDeContenido(escrito)
  if (todo.includes(buscado) || palabras.every((palabra) => todo.includes(palabra))) {
    return { tipo: 'exacta', errores: 0, valorExacto }
  }

  const literales = palabrasLiterales(escrito)
  const terminos = campos.filter((campo) => !campo.valor).flatMap((campo) => terminosDe(campo.texto))
  let errores = 0
  for (const palabra of palabras) {
    if (todo.includes(palabra)) continue
    if (literales.has(palabra) || !esAproximable(palabra)) return null
    let menor = Infinity
    for (const termino of terminos) {
      const parecido = coincidenciaDePalabra(palabra, termino, { prefijo: false })
      if (parecido?.clase === 'aproximada' && parecido.distancia < menor) menor = parecido.distancia
    }
    if (menor === Infinity) return null
    errores += menor
  }
  return { tipo: 'aproximada', errores, valorExacto: false }
}

export interface EquiposEncontrados {
  /** Del inventario general, por texto y categoría. */
  generales: Dispositivo[]
  /** De la red: solo al escribir y sin chip de categoría. */
  deRed: Dispositivo[]
  /**
   * POSIBLES COINCIDENCIAS (tarea 346): los que solo coinciden con una
   * errata, generales y de red con las mismas reglas, detrás de lo exacto y
   * de menos a más errores. Nunca se eligen solos: la pantalla los enseña
   * todos, dichos como lo que son.
   */
  posibles: Dispositivo[]
}

function porNombre(a: Dispositivo, b: Dispositivo): number {
  return compararNatural(a.nombre, b.nombre)
}

export function buscarEquipos(
  dispositivos: Dispositivo[],
  idsRed: ReadonlySet<string>,
  { texto, categoriaId }: { texto: string; categoriaId: string },
  personas: PersonasPorId = SIN_PERSONAS,
): EquiposEncontrados {
  const conRed = texto.trim() !== '' && !categoriaId
  const encontrados = dispositivos.flatMap((dispositivo) => {
    if (dispositivo.eliminadoEn) return []
    const deRed = idsRed.has(dispositivo.categoriaId)
    if (deRed ? !conRed : categoriaId !== '' && dispositivo.categoriaId !== categoriaId) return []
    const coincidencia = coincidenciaDeEquipo(camposDeBusqueda(dispositivo, personas), texto)
    return coincidencia ? [{ dispositivo, deRed, coincidencia }] : []
  })
  const exactos = (deRed: boolean) =>
    encontrados
      .filter((e) => e.deRed === deRed && e.coincidencia.tipo === 'exacta')
      .sort((a, b) => Number(b.coincidencia.valorExacto) - Number(a.coincidencia.valorExacto) || porNombre(a.dispositivo, b.dispositivo))
      .map((e) => e.dispositivo)
  const posibles = encontrados
    .filter((e) => e.coincidencia.tipo === 'aproximada')
    .sort(
      (a, b) =>
        a.coincidencia.errores - b.coincidencia.errores ||
        Number(a.deRed) - Number(b.deRed) ||
        porNombre(a.dispositivo, b.dispositivo),
    )
    .map((e) => e.dispositivo)
  return { generales: exactos(false), deRed: exactos(true), posibles }
}

/**
 * Lo que promete cada chip (tarea 207, hallazgo M-022: el chip cuenta lo
 * que va a dar). "Todos" cuenta también los de red que salen al
 * escribir; cada categoría, solo los suyos. Las posibles coincidencias
 * también se ven, así que también cuentan.
 */
export function conteosDeChips(
  dispositivos: Dispositivo[],
  idsRed: ReadonlySet<string>,
  texto: string,
  personas: PersonasPorId = SIN_PERSONAS,
): { todos: number; porCategoria: Map<string, number> } {
  const { generales, deRed, posibles } = buscarEquipos(dispositivos, idsRed, { texto, categoriaId: '' }, personas)
  const porCategoria = new Map<string, number>()
  for (const d of [...generales, ...posibles]) {
    if (idsRed.has(d.categoriaId)) continue
    porCategoria.set(d.categoriaId, (porCategoria.get(d.categoriaId) ?? 0) + 1)
  }
  return { todos: generales.length + deRed.length + posibles.length, porCategoria }
}
