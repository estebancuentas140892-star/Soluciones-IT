import type { Articulo, Referencia } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// LA REVISION DE CONSISTENCIA DE REFERENCIA.
//
// Un glosario que se escribe entre cinco personas deriva solo: dos
// fichas para la misma palabra, la misma abreviatura significando dos
// cosas, un comando documentado dos veces con resultados distintos. Eso
// no lo arregla una validacion que impida guardar (bloquear al que
// escribe es peor que la deriva): lo arregla DECIRLO donde se escribe,
// con el nombre de la ficha con la que choca, y dejar que una persona
// decida.
//
// Por eso todo lo de aqui DESCRIBE y nunca bloquea, igual que
// `validacionVinculos.ts` hace con los vinculos entre guias.
//
// Modulo puro y sin React: se prueba sin navegador y lo usan tanto el
// editor de una ficha como el panel del catalogo.

export type ClaveAviso =
  | 'termino_duplicado'
  | 'abreviatura_contradictoria'
  | 'alias_ambiguo'
  | 'giga_ambiguo'
  | 'comando_duplicado'
  | 'resultado_contradictorio'
  | 'comando_sin_plataforma'
  | 'comando_sin_resultado'
  | 'comando_delicado_sin_advertencia'
  | 'referencia_eliminada_en_guia'

export interface AvisoConsistencia {
  clave: ClaveAviso
  /** Qué pasa, con el nombre de la ficha con la que choca. */
  texto: string
  /**
   * 'contradiccion': dos fichas dicen cosas distintas de lo mismo, y
   * alguien tiene que decidir cuál vale. 'incompleto': falta un dato
   * que hace falta para usar la ficha con seguridad.
   */
  nivel: 'contradiccion' | 'incompleto'
  /** Ficha con la que choca, para poder abrirla. */
  otraId?: string
}

function limpio(texto: string): string {
  return normalizarTexto(texto.trim())
}

/** Todas las formas con las que se nombra una ficha: título, abreviatura y alias. */
function nombresDe(referencia: Referencia): string[] {
  return [referencia.titulo, referencia.abreviatura, ...(referencia.alias ?? [])]
    .map(limpio)
    .filter((n) => n !== '')
}

// COMANDOS QUE MERECEN UNA ADVERTENCIA ESCRITA.
//
// Es una lista corta y deliberadamente conservadora: verbos que borran,
// formatean, apagan o reinician algo. No pretende ser exhaustiva (no
// existe tal lista), sino cubrir lo que un tecnico puede pegar en una
// consola a las once de la noche sin releerlo. Un falso positivo cuesta
// una linea de advertencia; un falso negativo, un equipo.
const PALABRAS_DELICADAS = [
  'format',
  'diskpart',
  'del ',
  'rd /s',
  'rmdir',
  'rm -rf',
  'shutdown',
  'reg delete',
  'reg add',
  'taskkill',
  'net user',
  'net stop',
  'sc delete',
  'bcdedit',
  'cipher /w',
  'chkdsk /f',
  'dism',
  'sfc /scannow',
  'gpupdate /force',
  'wmic',
  'mkfs',
  'dd if=',
  'chmod 777',
  'iptables',
]

/** ¿Este comando puede dejar un equipo peor de como estaba? */
export function esComandoDelicado(valor: string): boolean {
  const texto = ` ${valor.toLowerCase().trim()} `
  return PALABRAS_DELICADAS.some((palabra) => texto.includes(palabra))
}

/**
 * "Giga" a secas no significa nada: puede ser gigabit (velocidad) o
 * gigabyte (almacenamiento), y confundirlos cambia el resultado por un
 * factor de ocho. Se detecta la palabra SUELTA, nunca dentro de
 * "gigabyte" ni "gigabits".
 */
export function usaGigaAmbiguo(texto: string): boolean {
  return /(^|[^a-z])giga([^a-z]|$)/.test(limpio(texto))
}

/**
 * Los avisos de UNA ficha frente al resto del catálogo.
 *
 * `borrador` es la ficha tal como está en el formulario (todavía sin
 * guardar), y `otras` el resto de fichas vivas. La propia ficha se
 * excluye por id, así que editarla no se choca consigo misma.
 */
export function revisarReferencia(borrador: Referencia, otras: Referencia[]): AvisoConsistencia[] {
  const avisos: AvisoConsistencia[] = []
  const resto = otras.filter((r) => r.id !== borrador.id && !r.eliminadoEn)
  const titulo = limpio(borrador.titulo)
  const abreviatura = limpio(borrador.abreviatura)
  const valor = limpio(borrador.valor)
  const plataforma = limpio(borrador.plataforma)

  // 1. Dos fichas del mismo tipo para la misma palabra.
  if (titulo !== '') {
    const duplicada = resto.find((r) => r.tipo === borrador.tipo && limpio(r.titulo) === titulo)
    if (duplicada) {
      avisos.push({
        clave: 'termino_duplicado',
        nivel: 'contradiccion',
        texto: `Ya existe otra ficha con este mismo nombre. Conviene unificarlas en una sola.`,
        otraId: duplicada.id,
      })
    }
  }

  // 2. La misma abreviatura para dos conceptos distintos.
  if (abreviatura !== '') {
    const choque = resto.find(
      (r) => limpio(r.abreviatura) === abreviatura && limpio(r.titulo) !== titulo,
    )
    if (choque) {
      avisos.push({
        clave: 'abreviatura_contradictoria',
        nivel: 'contradiccion',
        texto: `«${borrador.abreviatura}» ya es la abreviatura de «${choque.titulo}». Dos cosas distintas con la misma abreviatura se confunden al leer.`,
        otraId: choque.id,
      })
    }
  }

  // 3. Un alias que ya nombra a otro concepto.
  for (const alias of (borrador.alias ?? []).map(limpio).filter(Boolean)) {
    const choque = resto.find((r) => nombresDe(r).includes(alias) && limpio(r.titulo) !== titulo)
    if (choque) {
      avisos.push({
        clave: 'alias_ambiguo',
        nivel: 'contradiccion',
        texto: `El alias «${alias}» también nombra a «${choque.titulo}». Buscar por esa palabra devolverá dos conceptos distintos.`,
        otraId: choque.id,
      })
      break
    }
  }

  // 4. "Giga" a secas.
  const textosConGiga = [borrador.titulo, borrador.abreviatura, ...(borrador.alias ?? []), borrador.definicion, borrador.ejemplo]
  if (textosConGiga.some(usaGigaAmbiguo)) {
    avisos.push({
      clave: 'giga_ambiguo',
      nivel: 'contradiccion',
      texto:
        '«Giga» por sí solo es ambiguo: puede ser gigabit (velocidad de red) o gigabyte (almacenamiento), y se diferencian por ocho. Conviene escribir cuál de los dos es.',
    })
  }

  if (borrador.tipo === 'comando') {
    // 5. El mismo comando documentado dos veces para la misma plataforma.
    if (valor !== '') {
      const duplicado = resto.find(
        (r) => r.tipo === 'comando' && limpio(r.valor) === valor && limpio(r.plataforma) === plataforma,
      )
      if (duplicado) {
        avisos.push({
          clave: 'comando_duplicado',
          nivel: 'contradiccion',
          texto: `«${duplicado.titulo}» ya documenta este mismo comando para la misma plataforma.`,
          otraId: duplicado.id,
        })
      }

      // 6. El mismo comando con resultados esperados que se contradicen.
      const resultado = limpio(borrador.resultadoEsperado)
      if (resultado !== '') {
        const contradictorio = resto.find(
          (r) =>
            r.tipo === 'comando' &&
            limpio(r.valor) === valor &&
            limpio(r.resultadoEsperado) !== '' &&
            limpio(r.resultadoEsperado) !== resultado,
        )
        if (contradictorio) {
          avisos.push({
            clave: 'resultado_contradictorio',
            nivel: 'contradiccion',
            texto: `«${contradictorio.titulo}» documenta el mismo comando con otro resultado esperado. Uno de los dos está mal.`,
            otraId: contradictorio.id,
          })
        }
      }
    }

    // 7. Sin plataforma no se sabe dónde funciona.
    if (plataforma === '') {
      avisos.push({
        clave: 'comando_sin_plataforma',
        nivel: 'incompleto',
        texto: 'Falta la plataforma o herramienta. Sin ella no se sabe dónde se escribe este comando.',
      })
    }

    // 8. Sin resultado esperado no hay forma de saber si salió bien.
    if (limpio(borrador.resultadoEsperado) === '') {
      avisos.push({
        clave: 'comando_sin_resultado',
        nivel: 'incompleto',
        texto:
          'Falta el resultado esperado. Sin él, quien lo ejecute no puede saber si funcionó o si hay que seguir buscando.',
      })
    }

    // 9. Delicado y sin advertencia escrita.
    if (borrador.advertencia.trim() === '' && (esComandoDelicado(borrador.valor) || borrador.requiereAdmin)) {
      avisos.push({
        clave: 'comando_delicado_sin_advertencia',
        nivel: 'incompleto',
        texto: esComandoDelicado(borrador.valor)
          ? 'Este comando puede dejar un equipo peor de como estaba y no tiene advertencia escrita.'
          : 'Necesita permisos de administrador y no tiene advertencia escrita.',
      })
    }
  }

  return avisos
}

export interface AvisoCatalogo extends AvisoConsistencia {
  /** Ficha a la que apunta el aviso, para poder abrirla desde el panel. */
  referenciaId: string
  referenciaTitulo: string
}

/**
 * La revisión de TODO el catálogo, más lo único que no se puede ver
 * desde una ficha suelta: las referencias eliminadas que siguen
 * vinculadas a una guía.
 *
 * `referencias` llega COMPLETA (incluidas las eliminadas), porque el
 * último caso vive justo ahí.
 */
export function revisarCatalogo(referencias: Referencia[], articulos: Articulo[]): AvisoCatalogo[] {
  const vivas = referencias.filter((r) => !r.eliminadoEn)
  const avisos: AvisoCatalogo[] = []

  for (const referencia of vivas) {
    for (const aviso of revisarReferencia(referencia, vivas)) {
      // Un choque entre A y B se cuenta una sola vez, desde la ficha que
      // aparece primero: repetirlo desde las dos convierte un problema
      // en dos y el panel deja de decir cuántos hay de verdad.
      if (
        aviso.otraId &&
        avisos.some((a) => a.clave === aviso.clave && a.referenciaId === aviso.otraId)
      ) {
        continue
      }
      avisos.push({ ...aviso, referenciaId: referencia.id, referenciaTitulo: referencia.titulo })
    }
  }

  // 10. Eliminadas que siguen vinculadas a una guía. El bloque se
  // conserva a propósito (nunca se descuelga solo), así que este aviso
  // es la única forma de que alguien lo repare: o se restaura la ficha,
  // o se cambia el vínculo en la guía.
  const eliminadas = new Map(referencias.filter((r) => r.eliminadoEn).map((r) => [r.id, r]))
  if (eliminadas.size > 0) {
    const usos = new Map<string, string[]>()
    for (const articulo of articulos) {
      if (articulo.eliminadoEn) continue
      const procedimiento = normalizarProcedimiento(articulo.procedimiento)
      if (!procedimiento) continue
      for (const paso of procedimiento.pasos) {
        for (const bloque of paso.bloques) {
          const id = bloque.tipo === 'referencia' ? bloque.referenciaId : null
          if (!id || !eliminadas.has(id)) continue
          const lista = usos.get(id) ?? []
          if (!lista.includes(articulo.titulo)) lista.push(articulo.titulo)
          usos.set(id, lista)
        }
      }
    }
    for (const [id, guias] of usos) {
      const referencia = eliminadas.get(id)
      if (!referencia) continue
      avisos.push({
        clave: 'referencia_eliminada_en_guia',
        nivel: 'contradiccion',
        referenciaId: id,
        referenciaTitulo: referencia.titulo,
        texto: `«${referencia.titulo}» está eliminada pero sigue vinculada en ${
          guias.length === 1 ? `«${guias[0]}»` : `${guias.length} guías`
        }. Esos bloques se muestran como no disponibles.`,
      })
    }
  }

  return avisos
}

// ----------------------------------------------------------------
// Sugerencias de vínculo dentro de una tarea
// ----------------------------------------------------------------

// Una abreviatura de una sola letra ("B" de Byte) coincidiria con
// media guia: se exige un minimo de dos caracteres para que la
// sugerencia signifique algo.
const LARGO_MINIMO = 2

function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** ¿Aparece `nombre` como palabra entera dentro de `texto`? */
function apareceComoPalabra(texto: string, nombre: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escaparRegExp(nombre)}([^a-z0-9]|$)`).test(texto)
}

/**
 * TERMINOS QUE LA TAREA YA NOMBRA Y TODAVIA NO ESTAN VINCULADOS.
 *
 * Es una SUGERENCIA y nada mas: no se toca el texto de la tarea y no se
 * crea ningun vinculo solo. Convertir en enlace cada palabra tecnica
 * que aparezca seria adivinar (la misma palabra puede estar escrita de
 * otra forma, o significar otra cosa en esa frase), y ademas llenaria
 * de enlaces una pantalla que se lee a un brazo de distancia. Quien
 * decide es el autor, con un toque.
 *
 * Coincide por palabra ENTERA sobre el titulo, la abreviatura o
 * cualquier alias, sin acentos ni mayusculas.
 */
export function terminosSugeridos(
  textoTarea: string,
  referencias: Referencia[],
  yaVinculados: ReadonlySet<string>,
  limite = 3,
): Referencia[] {
  const texto = limpio(textoTarea)
  if (texto === '') return []
  const sugeridos: Referencia[] = []
  for (const referencia of referencias) {
    if (referencia.tipo !== 'termino' || referencia.eliminadoEn) continue
    if (yaVinculados.has(referencia.id)) continue
    const nombres = nombresDe(referencia).filter((n) => n.length >= LARGO_MINIMO)
    if (nombres.some((nombre) => apareceComoPalabra(texto, nombre))) {
      sugeridos.push(referencia)
      if (sugeridos.length >= limite) break
    }
  }
  return sugeridos
}
