import type {
  Articulo,
  ArticuloRelacionado,
  BloquePaso,
  EstadoArticulo,
  EstadoUsoHerramienta,
  Procedimiento,
  Referencia,
  TipoReferencia,
} from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { valoresUnicos } from '../../lib/vocabulario'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// LAS REGLAS DEL CENTRO DE CONSULTA, FUERA DE LOS COMPONENTES.
//
// Buscar, filtrar y ordenar las herramientas, el glosario, los atajos y
// los comandos son decisiones del producto, no de la presentacion: viven
// aqui para poder probarlas sin navegador y para que la pantalla, el
// buscador global y el editor de guias usen exactamente la misma
// definicion de "coincide".
//
// El modulo conserva por dentro el nombre "referencia" (tabla, ruta
// `/referencia`, tipos): renombrarlo no aportaba nada y obligaba a migrar
// datos y enlaces guardados. Lo que cambio (2026-09-14) es lo visible:
// para el tecnico la seccion es el "Centro de consulta".

// El orden es el de las pestañas: primero lo que un tecnico nuevo
// pregunta antes ("¿que es Zabbix?"), despues el vocabulario y al final
// lo que se teclea. Atajos y comandos van separados: una combinacion de
// teclas y una orden escrita no son lo mismo.
export const TIPOS_REFERENCIA: TipoReferencia[] = ['herramienta', 'termino', 'atajo', 'comando']

/** Clave de la URL que dice que pestaña esta abierta. */
export const PARAMETRO_PESTANA = 'tab'

export interface InfoTipo {
  valor: TipoReferencia
  /** Como se nombra una entrada de este tipo, en singular. */
  etiqueta: string
  plural: string
  /** Rotulo de su pestaña en el Centro de consulta. */
  pestana: string
  /** Titulo del editor al crear una ("Nueva herramienta"). */
  nueva: string
  /** Una linea que dice que es, para los selectores. */
  descripcion: string
  /** Valor de `?tab=` que abre su pestaña. */
  parametro: string
  /**
   * Por que eje se acota su lista: una herramienta o un termino por su
   * categoria, un atajo o un comando por el programa donde funciona.
   */
  eje: 'categoria' | 'plataforma'
}

export const INFO_TIPO: Record<TipoReferencia, InfoTipo> = {
  herramienta: {
    valor: 'herramienta',
    etiqueta: 'Herramienta',
    plural: 'Herramientas',
    pestana: 'Herramientas',
    nueva: 'Nueva herramienta',
    descripcion: 'Un programa, sistema o plataforma que usa el equipo',
    parametro: 'herramientas',
    eje: 'categoria',
  },
  termino: {
    valor: 'termino',
    etiqueta: 'Término',
    plural: 'Términos',
    pestana: 'Glosario',
    nueva: 'Nuevo término',
    descripcion: 'Un concepto técnico del vocabulario del equipo',
    parametro: 'glosario',
    eje: 'categoria',
  },
  atajo: {
    valor: 'atajo',
    etiqueta: 'Atajo',
    plural: 'Atajos',
    pestana: 'Atajos',
    nueva: 'Nuevo atajo',
    descripcion: 'Una combinación de teclas',
    parametro: 'atajos',
    eje: 'plataforma',
  },
  comando: {
    valor: 'comando',
    etiqueta: 'Comando',
    plural: 'Comandos',
    pestana: 'Comandos',
    nueva: 'Nuevo comando',
    descripcion: 'Algo que se escribe en una consola o en Ejecutar',
    parametro: 'comandos',
    eje: 'plataforma',
  },
}

/**
 * ¿Es un tipo que esta version conoce?
 *
 * Una fila con un tipo que no esta en la lista la escribio una version
 * MAS NUEVA de la app. Se ignora en vez de romper la pantalla: es
 * exactamente el fallo que tendria un telefono sin actualizar si
 * `INFO_TIPO[tipo]` devolviera undefined en mitad de un render.
 */
export function esTipoConocido(tipo: unknown): tipo is TipoReferencia {
  return typeof tipo === 'string' && (TIPOS_REFERENCIA as string[]).includes(tipo)
}

export function etiquetaTipo(tipo: TipoReferencia | null): string {
  return esTipoConocido(tipo) ? INFO_TIPO[tipo].etiqueta : 'Ficha'
}

/** El tipo que abre `?tab=`. Sin parametro, o con uno desconocido, Herramientas. */
export function tipoDePestana(parametro: string | null): TipoReferencia {
  return TIPOS_REFERENCIA.find((tipo) => INFO_TIPO[tipo].parametro === parametro) ?? 'herramienta'
}

/**
 * La lista de un tipo dentro del Centro de consulta. Herramientas es la
 * pestaña por defecto, asi que va sin parametro; un enlace viejo con
 * `?tab=comandos` sigue abriendo Comandos.
 */
export function rutaDeCatalogo(tipo: TipoReferencia): string {
  return tipo === 'herramienta'
    ? '/referencia'
    : `/referencia?${PARAMETRO_PESTANA}=${INFO_TIPO[tipo].parametro}`
}

/** "SQL Server Management Studio (SSMS)": el nombre con su forma corta, si la tiene. */
export function tituloConAbreviatura(referencia: Referencia): string {
  return referencia.abreviatura ? `${referencia.titulo} (${referencia.abreviatura})` : referencia.titulo
}

// TODO LO QUE HACE ENCONTRABLE UNA ENTRADA: titulo, abreviatura, alias,
// definicion, plataforma, valor del comando o atajo, cuando usarlo, el
// resultado esperado, lo propio de una herramienta (proveedor, su uso en
// Metroparques y sus notas) y las etiquetas. La misma cadena alimenta la
// busqueda de la pantalla y el indice global, para que buscar dos veces
// lo mismo no de dos resultados distintos.
//
// Las guias relacionadas NO entran: buscar el titulo de un borrador no
// debe devolver la herramienta que lo enlaza.
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
    referencia.proveedor,
    referencia.usoEnMetroparques,
    referencia.notas,
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

export interface FiltrosCatalogo {
  /** La pestaña: solo se listan fichas de este tipo. */
  tipo: TipoReferencia
  consulta: string
  /** null = todas. Solo acota los tipos cuyo eje es la categoría. */
  categoria: string | null
  /** null = todas. Solo acota los tipos cuyo eje es la plataforma. */
  plataforma: string | null
}

/**
 * La lista de una pestaña. Un filtro del otro eje se ignora en vez de
 * vaciar la lista: una plataforma no significa nada en Herramientas, y
 * dejarla aplicada e invisible haría que la pestaña pareciera vacía.
 */
export function filtrarCatalogo(referencias: Referencia[], filtros: FiltrosCatalogo): Referencia[] {
  const eje = INFO_TIPO[filtros.tipo].eje
  return ordenarPorTitulo(
    referencias.filter(
      (r) =>
        r.tipo === filtros.tipo &&
        (eje !== 'categoria' || filtros.categoria === null || r.categoria === filtros.categoria) &&
        (eje !== 'plataforma' || filtros.plataforma === null || r.plataforma === filtros.plataforma) &&
        coincide(r, filtros.consulta),
    ),
  )
}

/**
 * Cuántas fichas de cada tipo coinciden con la búsqueda, sin filtros de
 * eje. Alimenta el estado vacío: quien busca "zabbix" en el Glosario
 * tiene que enterarse de que está en Herramientas.
 */
export function coincidenciasPorTipo(
  referencias: Referencia[],
  consulta: string,
): Record<TipoReferencia, number> {
  const cuentas: Record<TipoReferencia, number> = { herramienta: 0, termino: 0, atajo: 0, comando: 0 }
  for (const referencia of referencias) {
    if (referencia.eliminadoEn || !esTipoConocido(referencia.tipo)) continue
    if (coincide(referencia, consulta)) cuentas[referencia.tipo] += 1
  }
  return cuentas
}

/**
 * Lo que se lee bajo el título en la lista. Una herramienta y un término
 * se resumen con su descripción; un atajo y un comando, con cuándo
 * sirven, porque la combinación o el comando ya se pintan aparte en
 * monoespaciado. Vacío cuando no hay nada que decir, para no dibujar una
 * línea en blanco.
 */
export function resumenDeLista(referencia: Referencia): string {
  if (referencia.tipo === 'atajo' || referencia.tipo === 'comando') {
    return referencia.cuandoUsar.trim() || referencia.definicion.trim()
  }
  return referencia.definicion.trim()
}

// ----------------------------------------------------------------
// Uso de una herramienta en Metroparques
// ----------------------------------------------------------------

/**
 * Cómo se dice lo que se sabe del uso. Las palabras son deliberadas: lo
 * documentado nunca se presenta como vigente, y sin estado no se afirma
 * nada (por eso no hay texto para '').
 */
export const TEXTO_ESTADO_USO: Record<Exclude<EstadoUsoHerramienta, ''>, string> = {
  confirmado: 'Uso actual confirmado en Metroparques.',
  documentado: 'Uso documentado en Metroparques; estado actual pendiente de confirmar.',
}

export const OPCIONES_ESTADO_USO: { valor: EstadoUsoHerramienta; etiqueta: string; descripcion: string }[] = [
  { valor: '', etiqueta: 'Sin indicar', descripcion: 'La ficha no dice si se usa hoy' },
  { valor: 'confirmado', etiqueta: 'Confirmado', descripcion: 'El equipo confirmó que se usa actualmente' },
  {
    valor: 'documentado',
    etiqueta: 'Documentado, por confirmar',
    descripcion: 'Hay evidencia de uso, pero no se sabe si sigue vigente',
  },
]

// ----------------------------------------------------------------
// Guías relacionadas de una ficha
// ----------------------------------------------------------------

export interface GuiaDeFicha {
  id: string
  /** El título vivo si la guía está en este dispositivo; la copia guardada si no. */
  titulo: string
  /** Ruta de la guía, o null si no está disponible aquí. */
  ruta: string | null
  /** Estado de la guía viva; null si no está. */
  estado: EstadoArticulo | null
}

/**
 * Las guías relacionadas de una ficha, resueltas contra las guías vivas
 * (regla de referencia viva, src/lib/referencia.ts).
 *
 * Una guía eliminada o que todavía no llegó se conserva con su copia del
 * título y sin ruta: la ficha dice que no está, no la esconde. Un
 * BORRADOR se lista con su estado, porque enlazar el procedimiento que
 * se está escribiendo es útil para el equipo; lo que no hace es aparecer
 * en el buscador global como procedimiento oficial, y eso lo decide el
 * índice, no la ficha. Sin repetir, en el orden del autor.
 */
export function resolverGuiasRelacionadas(
  guias: ArticuloRelacionado[] | undefined,
  articulos: Articulo[],
): GuiaDeFicha[] {
  const vivas = new Map(articulos.filter((a) => !a.eliminadoEn).map((a) => [a.id, a]))
  const vistas = new Set<string>()
  const resultado: GuiaDeFicha[] = []
  for (const guia of guias ?? []) {
    if (!guia?.id || vistas.has(guia.id)) continue
    vistas.add(guia.id)
    const viva = vivas.get(guia.id)
    resultado.push(
      viva
        ? {
            id: viva.id,
            titulo: viva.titulo,
            ruta: `/soluciones/${viva.categoriaId}/${viva.id}`,
            estado: viva.estado ?? 'publicado',
          }
        : { id: guia.id, titulo: guia.titulo || 'Guía', ruta: null, estado: null },
    )
  }
  return resultado
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
  return referencias.get(vinculo.id)?.titulo || vinculo.titulo || 'Ficha'
}
