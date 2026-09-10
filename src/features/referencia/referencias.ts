import type { Articulo, BloquePaso, Procedimiento, Referencia, TipoReferencia } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { valoresUnicos } from '../../lib/vocabulario'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// LAS REGLAS DE REFERENCIA, FUERA DE LOS COMPONENTES.
//
// Buscar, filtrar y ordenar el glosario y los atajos son decisiones del
// producto, no de la presentacion: viven aqui para poder probarlas sin
// navegador y para que la pantalla, el buscador global y el editor de
// guias usen exactamente la misma definicion de "coincide".

export const TIPOS_REFERENCIA: TipoReferencia[] = ['termino', 'atajo', 'comando']

export interface InfoTipo {
  valor: TipoReferencia
  /** Como se nombra una entrada de este tipo, en singular. */
  etiqueta: string
  plural: string
  /** Una linea que dice que es, para los selectores. */
  descripcion: string
}

export const INFO_TIPO: Record<TipoReferencia, InfoTipo> = {
  termino: {
    valor: 'termino',
    etiqueta: 'Término',
    plural: 'Términos',
    descripcion: 'Una palabra del vocabulario del equipo',
  },
  atajo: {
    valor: 'atajo',
    etiqueta: 'Atajo',
    plural: 'Atajos',
    descripcion: 'Una combinación de teclas',
  },
  comando: {
    valor: 'comando',
    etiqueta: 'Comando',
    plural: 'Comandos',
    descripcion: 'Algo que se escribe en una consola o en Ejecutar',
  },
}

export function etiquetaTipo(tipo: TipoReferencia | null): string {
  return tipo ? INFO_TIPO[tipo].etiqueta : 'Referencia'
}

/** ¿Esta entrada pertenece al glosario? */
export function esTermino(referencia: Referencia): boolean {
  return referencia.tipo === 'termino'
}

/** ¿Esta entrada pertenece a "Atajos y comandos"? */
export function esAtajoOComando(referencia: Referencia): boolean {
  return referencia.tipo === 'atajo' || referencia.tipo === 'comando'
}

// TODO LO QUE HACE ENCONTRABLE UNA ENTRADA. Es la lista del encargo:
// titulo, abreviatura, alias, definicion, plataforma, valor del comando
// o atajo y etiquetas. La misma cadena alimenta la busqueda de la
// pantalla y el indice global, para que buscar dos veces lo mismo no de
// dos resultados distintos.
export function textoBuscable(referencia: Referencia): string {
  return [
    referencia.titulo,
    referencia.abreviatura,
    ...(referencia.alias ?? []),
    referencia.definicion,
    referencia.plataforma,
    referencia.valor,
    referencia.cuandoUsar,
    referencia.resultadoEsperado,
    ...(referencia.etiquetas ?? []),
  ]
    .filter(Boolean)
    .join(' ')
}

// Coincidencia por subcadena, sin acentos ni mayusculas: es lo que se
// espera de un filtro que se escribe sobre la lista que ya esta en
// pantalla (mismo criterio que `incluyeTexto` en src/lib/texto.ts, con
// la normalizacion de acentos que aqui hace falta para "Cámaras").
export function coincide(referencia: Referencia, consulta: string): boolean {
  const buscado = normalizarTexto(consulta.trim())
  if (buscado === '') return true
  return normalizarTexto(textoBuscable(referencia)).includes(buscado)
}

/** Orden alfabético en español, con números donde el técnico los espera. */
export function ordenarPorTitulo(referencias: Referencia[]): Referencia[] {
  return [...referencias].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))
}

/** Las categorías realmente usadas, para el filtro. Vacía si nadie escribió ninguna. */
export function categoriasDe(referencias: Referencia[]): string[] {
  return valoresUnicos(referencias.map((r) => r.categoria))
}

/** Las plataformas realmente usadas, para el filtro. */
export function plataformasDe(referencias: Referencia[]): string[] {
  return valoresUnicos(referencias.map((r) => r.plataforma))
}

export interface FiltrosGlosario {
  consulta: string
  /** null = todas. */
  categoria: string | null
}

export function filtrarGlosario(referencias: Referencia[], filtros: FiltrosGlosario): Referencia[] {
  return ordenarPorTitulo(
    referencias.filter(
      (r) =>
        esTermino(r) &&
        (filtros.categoria === null || r.categoria === filtros.categoria) &&
        coincide(r, filtros.consulta),
    ),
  )
}

export interface FiltrosComandos {
  consulta: string
  /** null = atajos y comandos juntos. */
  tipo: TipoReferencia | null
  /** null = todas las plataformas. */
  plataforma: string | null
}

export function filtrarComandos(referencias: Referencia[], filtros: FiltrosComandos): Referencia[] {
  return ordenarPorTitulo(
    referencias.filter(
      (r) =>
        esAtajoOComando(r) &&
        (filtros.tipo === null || r.tipo === filtros.tipo) &&
        (filtros.plataforma === null || r.plataforma === filtros.plataforma) &&
        coincide(r, filtros.consulta),
    ),
  )
}

/**
 * Lo que se lee bajo el título en la lista: la definición para un
 * término, el valor tecleado para un atajo o un comando. Vacío cuando
 * no hay nada que decir, para no dibujar una línea en blanco.
 */
export function resumenDeLista(referencia: Referencia): string {
  if (esTermino(referencia)) return referencia.definicion.trim()
  return referencia.valor.trim() || referencia.definicion.trim()
}

// ----------------------------------------------------------------
// Dónde se usa una referencia
// ----------------------------------------------------------------

export interface UsoEnGuia {
  articuloId: string
  categoriaId: string
  titulo: string
  /** En cuántas tareas distintas de esa guía aparece. */
  veces: number
}

/**
 * Las guías que vinculan esta referencia desde alguna de sus tareas.
 *
 * Recorre los bloques del procedimiento en vez de guardar el inverso en
 * la fila: el vínculo ya vive en el bloque, y duplicarlo obligaría a
 * mantener dos copias sincronizadas de la misma verdad (el mismo
 * criterio con el que el grafo deriva "reemplazado por" en vez de
 * guardarlo). Un artículo eliminado no cuenta.
 */
export function guiasQueUsan(referenciaId: string, articulos: Articulo[]): UsoEnGuia[] {
  const usos: UsoEnGuia[] = []
  for (const articulo of articulos) {
    if (articulo.eliminadoEn) continue
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    if (!procedimiento) continue
    let veces = 0
    for (const paso of procedimiento.pasos) {
      for (const bloque of paso.bloques) {
        if (bloque.tipo === 'referencia' && bloque.referenciaId === referenciaId) veces += 1
      }
    }
    if (veces > 0) {
      usos.push({
        articuloId: articulo.id,
        categoriaId: articulo.categoriaId,
        titulo: articulo.titulo,
        veces,
      })
    }
  }
  return usos.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))
}

/**
 * Los ids de referencia vinculados desde UNA tarea, sin repetir y en el
 * orden del autor.
 *
 * La deduplicación es del encargo y no cosmética: si el mismo término se
 * vinculó dos veces a la misma tarea (por ejemplo al reasignar apoyos),
 * mostrarlo dos veces no aporta nada y ensucia la pantalla donde menos
 * espacio hay. Se conservan LOS DOS bloques en el dato; lo que se
 * colapsa es la presentación.
 */
export function idsUnicos(bloques: BloquePaso[]): string[] {
  const vistos = new Set<string>()
  const ids: string[] = []
  for (const bloque of bloques) {
    const id = bloque.referenciaId
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * Bloques de referencia con ids únicos, conservando el PRIMER bloque de
 * cada referencia (el que el autor colocó primero manda la posición).
 */
export function bloquesUnicos(bloques: BloquePaso[]): BloquePaso[] {
  const vistos = new Set<string>()
  return bloques.filter((bloque) => {
    const id = bloque.referenciaId
    if (!id || vistos.has(id)) return false
    vistos.add(id)
    return true
  })
}

/**
 * Un vinculo a una referencia tal como lo guarda un bloque: el id, la
 * copia del titulo (respaldo sin conexion) y el tipo que el autor
 * eligio al insertarlo.
 */
export interface VinculoReferencia {
  id: string
  /** Copia guardada en el bloque. Solo manda si la fila viva no esta. */
  titulo: string
  /** Lo que el autor eligio insertar; null si el guardado no lo dice. */
  tipoDeclarado: TipoReferencia | null
}

/**
 * Todas las referencias vinculadas desde CUALQUIER tarea de la guia,
 * sin repetir y en el orden en que aparecen.
 *
 * Alimenta el control "Terminos de esta guia" de la presentacion, que
 * por eso no necesita recorrer los pasos ni nombrarlos: aqui solo
 * quedan las referencias, nunca las tareas del procedimiento.
 */
export function referenciasDelProcedimiento(procedimiento: Procedimiento | null): VinculoReferencia[] {
  if (!procedimiento) return []
  const vistos = new Set<string>()
  const vinculos: VinculoReferencia[] = []
  for (const paso of procedimiento.pasos) {
    for (const bloque of paso.bloques) {
      if (bloque.tipo !== 'referencia') continue
      const id = bloque.referenciaId
      if (!id || vistos.has(id)) continue
      vistos.add(id)
      vinculos.push({ id, titulo: bloque.referenciaTitulo, tipoDeclarado: bloque.referenciaTipo })
    }
  }
  return vinculos
}

/**
 * De que tipo es realmente este vinculo.
 *
 * MANDA LA FILA VIVA, y solo si no esta se usa lo que el autor declaro
 * al insertarlo: editar la ficha central es lo que debe cambiar como se
 * presenta en todas las guias, y el tipo declarado existe unicamente
 * para poder dibujar el hueco correcto sin conexion.
 */
export function tipoEfectivo(
  vinculo: VinculoReferencia,
  referencias: Map<string, Referencia>,
): TipoReferencia | null {
  return referencias.get(vinculo.id)?.tipo ?? vinculo.tipoDeclarado
}

/** El titulo que se muestra: el vivo si la fila esta, la copia si no. */
export function tituloEfectivo(vinculo: VinculoReferencia, referencias: Map<string, Referencia>): string {
  return referencias.get(vinculo.id)?.titulo || vinculo.titulo || 'Referencia'
}
