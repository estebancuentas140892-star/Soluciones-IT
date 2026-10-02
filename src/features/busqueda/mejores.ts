import { ROTULO_RECORRIDO } from '../../lib/diagnostico'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { palabrasDeConsulta, palabrasDeContenido } from './consultaNatural'
import type { CampoIndice, ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// MEJORES RESULTADOS: LA RESPUESTA ANTES QUE EL MODULO (encargo del
// 2026-09-15, tarea 241, secciones 2, 14 y 15).
//
// Hasta ahora los resultados se ordenaban SIEMPRE por grupo de origen
// (Guias, Equipos, Boveda, Ubicaciones, Personas, Centro de consulta) y
// el grupo mandaba sobre la relevancia: buscando "impresora caja", el
// equipo exacto aparecia despues de todas las guias, porque Guias va
// primero en la lista de grupos. Eso obliga al tecnico a preguntarse
// "¿en que modulo esta lo que necesito?" antes de poder resolver nada.
//
// Esta funcion NO sustituye al buscador ni a su motor: recibe lo que
// `buscar` ya devolvio, en su orden, y elige los 3 a 5 con mas
// relevancia global, vengan del modulo que vengan. Los grupos completos
// siguen debajo para explorar.
//
// LO ESCRITO MANDA SOBRE EL SINONIMO, TAMBIEN AQUI (seccion 14). El
// reordenado por relevancia operativa podria colar por delante un
// resultado que solo trajo un sinonimo; por eso la comparacion es en dos
// tramos: primero todos los directos, despues los de sinonimo. Ningun
// bono puede saltar de tramo.

/** Cuantos resultados caben arriba. Cinco es el tope del encargo. */
export const MAXIMO_MEJORES = 5

/**
 * Como se nombra el tipo de un resultado cuando NO esta dentro de su
 * grupo. En "Mejores resultados" no hay cabecera de grupo que lo diga,
 * asi que el contexto viaja en la propia fila ("Guia · ICG Manager",
 * "Boveda · Acceso"), que es lo que pide la seccion 13 del encargo.
 */
export const ETIQUETA_TIPO: Record<TipoResultado, string> = {
  articulo: 'Guía',
  categoria: 'Categoría',
  diagnostico: ROTULO_RECORRIDO,
  adjunto: 'Adjunto',
  dispositivo: 'Equipo',
  credencial: 'Bóveda',
  ubicacion: 'Ubicación',
  persona: 'Persona',
  herramienta: 'Herramienta',
  termino: 'Término',
  atajo: 'Atajo',
  comando: 'Comando',
}

/**
 * El subtitulo de una fila suelta: el tipo por delante, sin repetirlo
 * cuando el subtitulo ya empieza por el ("Herramienta · Monitoreo" no
 * puede convertirse en "Herramienta · Herramienta · Monitoreo") ni
 * cuando ya es uno de sus tramos: "Impresoras · Guía con preguntas" pasa
 * a "Guía con preguntas · Impresoras" (tarea 263; antes salia
 * "Diagnóstico · Impresoras · Diagnóstico").
 */
export function subtituloConTipo(resultado: ResultadoBusqueda): string {
  const etiqueta = ETIQUETA_TIPO[resultado.tipo]
  const subtitulo = resultado.subtitulo.trim()
  if (!subtitulo) return etiqueta
  const clave = normalizarTexto(etiqueta)
  if (normalizarTexto(subtitulo).startsWith(clave)) return subtitulo
  const tramos = subtitulo.split(' · ')
  const resto = tramos.filter((tramo) => normalizarTexto(tramo.trim()) !== clave)
  if (resto.length < tramos.length) return [etiqueta, ...resto].join(' · ')
  return `${etiqueta} · ${subtitulo}`
}

// CUANTO RESUELVE CADA TIPO (seccion 14, punto 3: "relevancia
// operacional"). No es una preferencia estetica: una guia, un
// diagnostico, un equipo y una credencial son cosas sobre las que se
// ACTUA en campo; una categoria o un adjunto son escalones para llegar a
// otra cosa. A igualdad de coincidencia gana lo que resuelve.
const PESO_OPERATIVO: Record<TipoResultado, number> = {
  articulo: 6,
  diagnostico: 6,
  dispositivo: 6,
  credencial: 6,
  comando: 5,
  herramienta: 5,
  atajo: 5,
  termino: 4,
  categoria: 2,
  ubicacion: 2,
  persona: 2,
  adjunto: 1,
}

/**
 * Que esta pidiendo la consulta, deducido de las palabras que el equipo
 * ya usa (seccion 15: sin IA generativa y sin servicios externos) y,
 * desde la tarea 288, de lo que el indice encontro. Pueden aplicar varias
 * a la vez ("no imprime la caja 4" es problema y equipo).
 */
export type Intencion = 'procedimiento' | 'glosario' | 'equipo' | 'problema' | 'acceso' | 'consola'

/**
 * Qué intención manda cuando conviven varias (tarea 288). Lo que se PIDE
 * (resolver un problema, hacer un procedimiento, un acceso, un comando,
 * una definición) va antes que el equipo sobre el que se pide: en "la
 * impresora de mercadeo no imprime" el equipo dice DÓNDE pasa y la
 * solución es lo que hay que hacer; en "clave impresora mercadeo", la
 * clave. El equipo manda solo cuando es lo único que se pide.
 * `intencionesDeConsulta` las devuelve en este orden: la primera manda.
 */
export const PRIORIDAD_INTENCIONES: readonly Intencion[] = [
  'problema',
  'procedimiento',
  'acceso',
  'consola',
  'glosario',
  'equipo',
]

// Verbos con los que el equipo nombra un procedimiento. Van como
// palabra entera (no como subcadena) para que "crear" no se dispare
// dentro de otra palabra.
const VERBOS_PROCEDIMIENTO = new Set([
  'crear',
  'configurar',
  'instalar',
  'reinstalar',
  'reiniciar',
  'cambiar',
  'activar',
  'desactivar',
  'agregar',
  'anadir',
  'conectar',
  'desconectar',
  'restablecer',
  'restaurar',
  'actualizar',
  // "Desbloquear usuario" es un procedimiento concreto (tarea 263,
  // ejemplo B): sin el verbo, la palabra "usuario" solo pedía un acceso y
  // una credencial con ese nombre podía ganarle a la guía.
  'desbloquear',
  'bloquear',
  'quitar',
  'eliminar',
  'habilitar',
  'deshabilitar',
  'montar',
  'generar',
  'hacer',
  'como',
  // Tarea 288: "poner backup del correo" es configurarlo; y los verbos
  // de mantenimiento que el equipo escribe tal cual.
  'poner',
  'asignar',
  'programar',
  'reemplazar',
  'renovar',
  'exportar',
  'importar',
  'respaldar',
  'migrar',
  'mapear',
  'compartir',
  'formatear',
  'vincular',
  'sincronizar',
])

// Procedimientos que se nombran con una frase y no con un verbo suelto.
const FRASES_PROCEDIMIENTO = ['dar de alta', 'dar de baja']

const PALABRAS_GLOSARIO = [
  'que es',
  'que son',
  'que significa',
  'que quiere decir',
  'para que sirve',
  'definicion',
  'significado',
]

// LAS MARCAS DE UN PROBLEMA (tarea 288). Se miran como PALABRAS, no como
// subcadenas: antes "no " exigía un espacio detrás, así que "word imprime
// pero pdf no" (el "no" al final) no era un problema; y una raíz suelta
// como "roto" se disparaba dentro de "protocolo".
const MARCAS_PROBLEMA = new Set(['no', 'sin', 'bloqueo', 'roto', 'rota', 'rotos', 'rotas', 'dano', 'caido', 'caida'])
// Comienzos de palabra: "falla", "fallando"; "error", "errores";
// "bloqueado", "bloqueada" (tarea 263: "usuario bloqueado" es un síntoma).
const RAICES_PROBLEMA = [
  'falla',
  'fallo',
  'error',
  'lento',
  'lenta',
  'lentitud',
  'demora',
  'bloquead',
  'congel',
  'colgad',
  'atasc',
  'danad',
  'apagad',
  'intermitente',
]
const FRASES_PROBLEMA = ['se cae', 'se apaga', 'se cuelga', 'se reinicia', 'se congela', 'se traba', 'se bloquea', 'da error']

// LO QUE PIDE UN ACCESO (tarea 288). Las palabras FUERTES nombran un
// secreto y piden acceso siempre que no haya un verbo de procedimiento
// ("cambiar la contraseña" es un procedimiento sobre ella). Las DÉBILES
// también nombran otras cosas: "usuario" en "crear usuario nuevo" es lo
// que se crea y en "usuario bloqueado" quien tiene el problema; solo
// piden un acceso cuando la consulta no pide ninguna otra cosa
// ("administrador POS", "usuario administrador servidor").
const ACCESO_FUERTE = new Set([
  'clave',
  'claves',
  'contrasena',
  'contrasenas',
  'password',
  'pass',
  'pin',
  'credencial',
  'credenciales',
  'token',
  'licencia',
  'licencias',
])
const ACCESO_DEBIL = new Set(['usuario', 'usuarios', 'cuenta', 'cuentas', 'acceso', 'accesos', 'administrador', 'admin'])

const PALABRAS_CONSOLA = new Set(['comando', 'comandos', 'consola', 'terminal', 'cmd', 'powershell', 'atajo', 'atajos', 'tecla', 'teclas'])
// Los comandos que el equipo teclea por su nombre (tarea 288): "ping" es
// un comando aunque la consulta no diga "comando".
const COMANDOS_CONOCIDOS = new Set([
  'ping',
  'ipconfig',
  'tracert',
  'traceroute',
  'nslookup',
  'netstat',
  'gpupdate',
  'gpresult',
  'mstsc',
  'regedit',
  'msconfig',
  'chkdsk',
  'sfc',
  'dism',
  'shutdown',
  'telnet',
  'ssh',
  'arp',
  'whoami',
  'hostname',
  'robocopy',
  'taskkill',
  'tasklist',
  'msc',
  'cpl',
])
// UN ATAJO: una tecla modificadora y otra tecla ("windows r", "ctrl alt
// supr", "alt tab"). "windows 10" no lo es: "10" no es una tecla.
const TECLAS_MODIFICADORAS = new Set(['ctrl', 'control', 'alt', 'shift', 'mayus', 'windows', 'win', 'fn'])
const TECLAS_CON_NOMBRE = new Set(['tab', 'esc', 'supr', 'delete', 'enter', 'intro', 'inicio', 'fin', 'impr', 'tabulador'])

// LO QUE NOMBRA UNA CLASE DE EQUIPO, no uno concreto (tarea 288).
// "impresora" sola es ambigua (un equipo, una guía, la categoría); lo que
// convierte la consulta en "un equipo" es lo que lo identifica: Mercadeo,
// caja 2, una IP, un serial. Estas palabras nunca bastan por sí solas.
const TIPOS_DE_EQUIPO = new Set([
  'impresora',
  'multifuncional',
  'escaner',
  'pc',
  'computador',
  'computadora',
  'portatil',
  'laptop',
  'equipo',
  'servidor',
  'switch',
  'router',
  'firewall',
  'ap',
  'antena',
  'camara',
  'dvr',
  'nvr',
  'ups',
  'monitor',
  'pantalla',
  'televisor',
  'tv',
  'telefono',
  'celular',
  'tablet',
  'tableta',
  'lector',
  'datafono',
  'pos',
  'torniquete',
  'biometrico',
  'huellero',
  'proyector',
  'nas',
  'rack',
  'modem',
  'disco',
])
// Los rótulos con que se piden los datos de un equipo ("ip impresora
// mercadeo", "serial ABC123", "placa 456").
const ROTULOS_DE_EQUIPO = new Set(['serial', 'serie', 'placa', 'inventario', 'mac'])

function esTipoDeEquipo(palabra: string): boolean {
  if (TIPOS_DE_EQUIPO.has(palabra)) return true
  if (palabra.endsWith('es') && TIPOS_DE_EQUIPO.has(palabra.slice(0, -2))) return true
  return palabra.endsWith('s') && TIPOS_DE_EQUIPO.has(palabra.slice(0, -1))
}

// ¿Aparece `frase` como palabras seguidas en `texto`? Sobre el texto
// normalizado y con bordes de palabra ("se cae" no está en "base caerá").
function contieneFrase(texto: string, frase: string): boolean {
  return ` ${texto} `.includes(` ${frase} `)
}

// Una palabra que dice qué se pide, no sobre qué equipo: nunca cuenta
// como lo que identifica a un equipo.
function esPalabraDeIntencion(palabra: string): boolean {
  return (
    VERBOS_PROCEDIMIENTO.has(palabra) ||
    MARCAS_PROBLEMA.has(palabra) ||
    RAICES_PROBLEMA.some((raiz) => palabra.startsWith(raiz)) ||
    ACCESO_FUERTE.has(palabra) ||
    ACCESO_DEBIL.has(palabra) ||
    PALABRAS_CONSOLA.has(palabra) ||
    COMANDOS_CONOCIDOS.has(palabra) ||
    ROTULOS_DE_EQUIPO.has(palabra) ||
    palabra === 'ip'
  )
}

/** Lo que la consulta pide y qué parte de ella nombra un equipo concreto. */
interface AnalisisConsulta {
  /** Las palabras que dicen algo (`palabrasDeContenido`), en el orden de `camposPorPalabra`. */
  palabras: string[]
  /** En el orden de `PRIORIDAD_INTENCIONES`: la primera manda. */
  intenciones: Intencion[]
  /**
   * Las posiciones (en `palabras`) de las que identifican un equipo
   * CONCRETO porque coincidieron con su identidad o su nombre: "mercadeo"
   * en "la impresora de mercadeo no imprime".
   */
  objeto: ReadonlySet<number>
}

// LA COINCIDENCIA REAL CON UN EQUIPO APORTA EVIDENCIA (tarea 288, fase 4).
// Una palabra identifica un equipo concreto cuando no es una clase de
// equipo ni una palabra de intención y coincidió:
//   a) con la IDENTIDAD de un equipo (su lugar, responsable, marca,
//      modelo, serial, placa o IP): "pc contabilidad", "ricoh mp 501"; o
//   b) con su NOMBRE, siempre que la consulta nombre también su clase y
//      esa clase coincida con el mismo equipo: "servidor facturación",
//      "impresora caja 2". Sin la clase, una palabra corriente que esté en
//      un nombre ("archivo" en "Servidor de archivos") no basta.
function objetoDeLaConsulta(palabras: string[], resultados: readonly ResultadoBusqueda[]): Set<number> {
  const objeto = new Set<number>()
  const calificadoras = palabras
    .map((palabra, indice) => ({ palabra, indice }))
    .filter(({ palabra }) => !esTipoDeEquipo(palabra) && !esPalabraDeIntencion(palabra))
  if (calificadoras.length === 0) return objeto
  const clases = palabras.map((palabra, indice) => ({ palabra, indice })).filter(({ palabra }) => esTipoDeEquipo(palabra))
  for (const resultado of resultados) {
    if (resultado.tipo !== 'dispositivo' || resultado.id.startsWith('campo:')) continue
    const campos = resultado.camposPorPalabra
    if (!campos || campos.length !== palabras.length) continue
    const claseCoincide = clases.some(({ indice }) => campos[indice].includes('titulo') || campos[indice].includes('identidad'))
    for (const { indice } of calificadoras) {
      if (campos[indice].includes('identidad') || (claseCoincide && campos[indice].includes('titulo'))) {
        objeto.add(indice)
      }
    }
  }
  return objeto
}

function analizarConsulta(consulta: string, resultados: readonly ResultadoBusqueda[]): AnalisisConsulta {
  const texto = normalizarTexto(consulta.trim())
  const palabras = palabrasDeContenido(texto)
  if (!texto) return { palabras, intenciones: [], objeto: new Set() }
  const todas = palabrasDeConsulta(texto)
  const crudas = texto.split(/\s+/).filter(Boolean)
  const hay = new Set<Intencion>()

  if (PALABRAS_GLOSARIO.some((clave) => texto.startsWith(clave))) hay.add('glosario')

  const procedimiento =
    todas.some((palabra) => VERBOS_PROCEDIMIENTO.has(palabra)) ||
    FRASES_PROCEDIMIENTO.some((frase) => contieneFrase(texto, frase))
  if (procedimiento) hay.add('procedimiento')

  const problema =
    todas.some((palabra) => MARCAS_PROBLEMA.has(palabra) || RAICES_PROBLEMA.some((raiz) => palabra.startsWith(raiz))) ||
    FRASES_PROBLEMA.some((frase) => contieneFrase(texto, frase))
  if (problema) hay.add('problema')

  const accesoFuerte = todas.some((palabra) => ACCESO_FUERTE.has(palabra))
  const accesoDebil = todas.some((palabra) => ACCESO_DEBIL.has(palabra))
  if ((accesoFuerte && !procedimiento) || (accesoDebil && !procedimiento && !problema)) hay.add('acceso')

  const comando = todas.some((palabra) => PALABRAS_CONSOLA.has(palabra) || COMANDOS_CONOCIDOS.has(palabra))
  const atajo =
    todas.some((palabra) => TECLAS_MODIFICADORAS.has(palabra)) &&
    todas.some(
      (palabra) =>
        !TECLAS_MODIFICADORAS.has(palabra) &&
        (/^[a-z0-9]$/.test(palabra) || /^f([1-9]|1[0-2])$/.test(palabra) || TECLAS_CON_NOMBRE.has(palabra)),
    )
  if (comando || atajo) hay.add('consola')

  // EQUIPO. Por la forma de lo escrito: una IP, un rótulo con su valor
  // ("serial ABC123", "placa 456"), "ip" sobre algo, o un número suelto
  // entre varias palabras ("caja 4", "impresora taquilla 2"). Y, desde la
  // tarea 288, porque una palabra coincidió de verdad con un equipo.
  const objeto = objetoDeLaConsulta(palabras, resultados)
  const pareceIp = crudas.some((cruda) => /^\d{1,3}(\.\d{1,3}){2,3}$/.test(cruda))
  const conRotulo =
    todas.some((palabra) => ROTULOS_DE_EQUIPO.has(palabra)) && todas.some((palabra) => /\d/.test(palabra))
  const pideIp = palabras.includes('ip') && palabras.length > 1
  const numeroSuelto = todas.length > 1 && todas.some((palabra) => /^\d+$/.test(palabra))
  if (pareceIp || conRotulo || pideIp || numeroSuelto || objeto.size > 0) hay.add('equipo')

  return { palabras, intenciones: PRIORIDAD_INTENCIONES.filter((intencion) => hay.has(intencion)), objeto }
}

/**
 * Las intenciones de la consulta, la que manda primero. Sin `resultados`
 * solo se leen las palabras; con ellos, además, la coincidencia real con
 * la identidad de un equipo cuenta como evidencia de "equipo" (fase 4).
 * Las intenciones no inventan resultados: solo ordenan los que ya
 * coincidieron con lo escrito.
 */
export function intencionesDeConsulta(consulta: string, resultados: readonly ResultadoBusqueda[] = []): Intencion[] {
  return analizarConsulta(consulta, resultados).intenciones
}

// ----------------------------------------------------------------
// EL RANKING (tarea 288, fases 6 y 7)
// ----------------------------------------------------------------
//
// Cada resultado se puntúa con cinco piezas, de más a menos peso. Cada
// grupo de peso existe por una prueba que lo exige (`mejores.test.ts`,
// "por qué pesa lo que pesa"), y el benchmark (`benchmarkResolver.ts`)
// mide el conjunto.
//
//   1. EVIDENCIA (0 a 100): cuánto de la consulta explica el resultado y
//      con qué autoridad. Cada palabra que dice algo vale lo que vale el
//      campo más fuerte donde coincidió (`PESO_CAMPO`); un sinónimo, la
//      mitad; y la evidencia es el promedio de las palabras.
//   2. NOMBRE: el título ES lo buscado (+30) o empieza por lo buscado (+15).
//   3. INTENCIÓN: el tipo que resuelve la intención que manda (+25) o
//      una de las otras (+10).
//   4. RELEVANCIA OPERATIVA del tipo (1 a 6, `PESO_OPERATIVO`).
//   5. EL PUNTAJE DEL ÍNDICE (0 a 10): el BM25 de MiniSearch relativo al
//      mejor, para desempatar con la rareza de las palabras y el largo de
//      los campos.
//
// Y antes que nada, el tramo: lo escrito va antes que lo que solo trajo un
// sinónimo, sin que ningún bono lo cruce (sección 14 del encargo de 2026-09-15).

/**
 * La autoridad de cada campo como evidencia (fase 6, "dirección de
 * relevancia" del encargo). Muy fuerte: lo que nombra o identifica
 * (título, identidad, formas de búsqueda). Fuerte: lo que describe la
 * situación (síntoma, cuándo usar). Contexto: el subtítulo. Menor: el
 * contenido general, una palabra que puede estar en cualquier paso.
 */
export const PESO_CAMPO: Record<CampoIndice, number> = {
  titulo: 1,
  identidad: 1,
  formasBusqueda: 1,
  sintomas: 0.75,
  cuandoUsar: 0.75,
  subtitulo: 0.5,
  texto: 0.25,
}

/**
 * Un sinónimo explica una palabra a medias: amplía, pero no puede igualar
 * a la palabra escrita en el mismo campo. Es el mismo medio punto que el
 * índice le da al sinónimo (`PESO_SINONIMO`).
 */
export const PESO_SINONIMO_EVIDENCIA = 0.5

/** Lo que vale explicar la consulta entera en un campo muy fuerte. */
export const PUNTOS_EVIDENCIA = 100
/** El título es exactamente lo buscado (sin las palabras vacías). */
export const BONO_NOMBRE_EXACTO = 30
/** El título empieza por lo buscado: es lo que se está tecleando. */
export const BONO_NOMBRE_PREFIJO = 15
/** El tipo resuelve la intención que manda. */
export const BONO_INTENCION_PRINCIPAL = 25
/** El tipo resuelve otra de las intenciones de la consulta. */
export const BONO_INTENCION_SECUNDARIA = 10
/** El techo del desempate por el puntaje del índice. */
export const PUNTOS_INDICE = 10
/**
 * Sin ninguna intención, una sola clase no se lleva los cinco puestos de
 * arriba si otra también coincide: "impresora" no puede responderse solo
 * con equipos (ni solo con guías). Tres de cinco deja a la mejor clase la
 * mayoría y a la otra lectura dos puestos.
 */
export const MAXIMO_POR_CLASE_SIN_INTENCION = 3

/** "Mejor coincidencia" (alta) o "Mejores resultados" (cercana). */
export type Confianza = 'alta' | 'cercana'

// ¿Este tipo de resultado resuelve esta intención? Un dato protegido de un
// equipo se indexa como 'dispositivo', pero es un ACCESO (su id es
// `campo:`): lo que se copia es la clave, no el equipo.
function resuelve(intencion: Intencion, resultado: ResultadoBusqueda): boolean {
  const datoProtegido = resultado.id.startsWith('campo:')
  switch (intencion) {
    case 'problema':
    case 'procedimiento':
      return resultado.tipo === 'articulo' || resultado.tipo === 'diagnostico'
    case 'acceso':
      return resultado.tipo === 'credencial' || datoProtegido
    case 'consola':
      return resultado.tipo === 'comando' || resultado.tipo === 'atajo'
    case 'glosario':
      return resultado.tipo === 'termino' || resultado.tipo === 'herramienta'
    case 'equipo':
      return resultado.tipo === 'dispositivo' && !datoProtegido
  }
}

// La clase de un resultado para no repetir una sola lectura en los cinco
// de arriba (`MAXIMO_POR_CLASE_SIN_INTENCION`).
function claseDe(resultado: ResultadoBusqueda): string {
  if (resultado.id.startsWith('campo:')) return 'acceso'
  switch (resultado.tipo) {
    case 'articulo':
    case 'diagnostico':
      return 'guia'
    case 'credencial':
      return 'acceso'
    case 'herramienta':
    case 'termino':
    case 'atajo':
    case 'comando':
      return 'consulta'
    default:
      return resultado.tipo
  }
}

function pesoMaximo(campos: readonly CampoIndice[] | undefined): number {
  let maximo = 0
  for (const campo of campos ?? []) maximo = Math.max(maximo, PESO_CAMPO[campo] ?? 0)
  return maximo
}

/** Cuánto explica un resultado de cada palabra (0 a 1), y si la explica con lo escrito. */
function explicacion(resultado: ResultadoBusqueda, palabras: string[]): { peso: number; directa: boolean }[] {
  const porPalabra = resultado.camposPorPalabra
  if (!porPalabra || porPalabra.length !== palabras.length) {
    // Un resultado sin la metadata (armado a mano en una prueba antigua):
    // solo se sabe lo que dice su título, como el ranking anterior.
    const titulo = normalizarTexto(resultado.titulo)
    return palabras.map((palabra) => {
      const enTitulo = titulo.includes(palabra)
      return { peso: enTitulo ? 1 : 0, directa: enTitulo }
    })
  }
  return palabras.map((_, indice) => {
    const directa = pesoMaximo(porPalabra[indice])
    const porSinonimo = PESO_SINONIMO_EVIDENCIA * pesoMaximo(resultado.camposPorSinonimo?.[indice])
    return { peso: Math.max(directa, porSinonimo), directa: directa > 0 }
  })
}

function promedio(valores: number[]): number {
  return valores.length === 0 ? 0 : valores.reduce((suma, valor) => suma + valor, 0) / valores.length
}

// EL NOMBRE ES LO BUSCADO. Se compara palabra a palabra sin las vacías:
// "La impresora no imprime" ES "la impresora no imprime", y "DHCP" ES
// "qué es DHCP". Por prefijo, la última palabra puede estar a medio
// escribir ("impresora merc").
function bonoDeNombre(titulo: string, palabras: string[]): number {
  const nombre = palabrasDeContenido(titulo)
  if (nombre.length === palabras.length && nombre.every((palabra, i) => palabra === palabras[i])) {
    return BONO_NOMBRE_EXACTO
  }
  if (nombre.length < palabras.length) return 0
  const ultima = palabras.length - 1
  const empieza = palabras.every((palabra, i) => (i === ultima ? nombre[i].startsWith(palabra) : nombre[i] === palabra))
  return empieza ? BONO_NOMBRE_PREFIJO : 0
}

interface Puntuado {
  resultado: ResultadoBusqueda
  orden: number
  tramo: number
  puntos: number
  /** Explica todas las palabras de la consulta con lo escrito (en algún campo). */
  explicaTodo: boolean
}

/** Lo que el buscador lee de una lista de resultados. */
export interface LecturaResultados {
  intenciones: Intencion[]
  /** Los de arriba, de 0 a `limite`. */
  mejores: ResultadoBusqueda[]
  /** ¿Hay una opción claramente superior? */
  confianza: Confianza
}

/**
 * La lectura completa de una búsqueda: intenciones, "Mejores resultados"
 * y la confianza. La interfaz la pide una vez por consulta.
 */
export function leerResultados(
  resultados: ResultadoBusqueda[],
  consulta: string,
  limite = MAXIMO_MEJORES,
): LecturaResultados {
  const texto = normalizarTexto(consulta.trim())
  const { palabras, intenciones, objeto } = analizarConsulta(texto, resultados)
  if (!texto || resultados.length === 0 || limite <= 0 || palabras.length === 0) {
    return { intenciones, mejores: [], confianza: 'cercana' }
  }

  // CONSULTA MIXTA (fase 7). Si lo que manda es otra cosa que el equipo,
  // las palabras que nombran ESE equipo dicen dónde pasa, no qué hacer:
  // la solución de "la impresora de mercadeo no imprime" no tiene por qué
  // decir "mercadeo". A lo que no es el equipo se le mide además sin
  // ellas, y vale lo mejor de las dos medidas; el equipo se mide con todo.
  const mixta = objeto.size > 0 && intenciones.length > 0 && intenciones[0] !== 'equipo'
  const sinObjeto = palabras.map((_, indice) => !objeto.has(indice))
  const maximoIndice = Math.max(Number.EPSILON, ...resultados.map((resultado) => resultado.puntajeIndice ?? 0))

  // EL EQUIPO PEDIDO, NO CUALQUIER EQUIPO. Cuando la consulta identifica
  // uno ("impresora mercadeo"), la intención "equipo" favorece a los que
  // coinciden con eso que lo identifica; las demás impresoras solo
  // comparten la clase, y empujarlas arriba sacaría de los mejores la guía
  // del tóner de ESA impresora. Sin nada que lo identifique (una consulta
  // por número o por rótulo sin coincidencia), favorece a todos, como antes.
  const tocaElObjeto = (resultado: ResultadoBusqueda): boolean => {
    const campos = resultado.camposPorPalabra
    if (!campos || campos.length !== palabras.length) return false
    return [...objeto].some((indice) => campos[indice].includes('titulo') || campos[indice].includes('identidad'))
  }
  const favorece = (intencion: Intencion, resultado: ResultadoBusqueda): boolean =>
    intencion === 'equipo' && objeto.size > 0
      ? resuelve('equipo', resultado) && tocaElObjeto(resultado)
      : resuelve(intencion, resultado)

  const puntuados: Puntuado[] = resultados.map((resultado, orden) => {
    const porPalabra = explicacion(resultado, palabras)
    let evidencia = promedio(porPalabra.map((p) => p.peso))
    if (mixta && !resuelve('equipo', resultado) && sinObjeto.some(Boolean)) {
      evidencia = Math.max(evidencia, promedio(porPalabra.filter((_, i) => sinObjeto[i]).map((p) => p.peso)))
    }
    const intencion =
      intenciones.length > 0 && favorece(intenciones[0], resultado)
        ? BONO_INTENCION_PRINCIPAL
        : intenciones.slice(1).some((otra) => favorece(otra, resultado))
          ? BONO_INTENCION_SECUNDARIA
          : 0
    const puntos =
      PUNTOS_EVIDENCIA * evidencia +
      bonoDeNombre(resultado.titulo, palabras) +
      intencion +
      PESO_OPERATIVO[resultado.tipo] +
      (PUNTOS_INDICE * (resultado.puntajeIndice ?? 0)) / maximoIndice
    return {
      resultado,
      orden,
      // Tramo 0: lo que coincide con lo escrito. Tramo 1: lo que solo
      // trajo un sinonimo. Ningun bono cruza de tramo (seccion 14).
      tramo: resultado.soloSinonimo ? 1 : 0,
      puntos,
      explicaTodo: porPalabra.every((p) => p.directa),
    }
  })
  const ordenados = puntuados.sort((a, b) => a.tramo - b.tramo || b.puntos - a.puntos || a.orden - b.orden)

  return {
    intenciones,
    mejores: elegirMejores(ordenados, intenciones.length === 0, limite).map((p) => p.resultado),
    confianza: confianzaDe(ordenados, palabras.length),
  }
}

// Los de arriba. Sin ninguna intención, ninguna clase pasa de
// `MAXIMO_POR_CLASE_SIN_INTENCION` mientras haya otra para ocupar el
// puesto; si no la hay, se completa con la misma.
function elegirMejores(ordenados: Puntuado[], repartir: boolean, limite: number): Puntuado[] {
  if (!repartir) return ordenados.slice(0, limite)
  const elegidos: Puntuado[] = []
  const apartados: Puntuado[] = []
  const porClase = new Map<string, number>()
  for (const puntuado of ordenados) {
    if (elegidos.length === limite) break
    const clase = claseDe(puntuado.resultado)
    const usados = porClase.get(clase) ?? 0
    if (usados >= MAXIMO_POR_CLASE_SIN_INTENCION) {
      apartados.push(puntuado)
      continue
    }
    porClase.set(clase, usados + 1)
    elegidos.push(puntuado)
  }
  const completos = [...elegidos, ...apartados.slice(0, Math.max(0, limite - elegidos.length))]
  // Se presentan en el orden del ranking, no en el de la elección.
  return completos.sort((a, b) => ordenados.indexOf(a) - ordenados.indexOf(b))
}

/**
 * LA REGLA DE CONFIANZA (fase 8). Hay UNA opción claramente superior
 * cuando:
 *
 *   1. coincide con lo escrito (no solo por un sinónimo) y explica TODAS
 *      las palabras de la consulta, cada una en algún campo; y
 *   2. su ventaja sobre la segunda es, como mínimo, lo que vale explicar
 *      una palabra más de la consulta en un campo muy fuerte:
 *      `PUNTOS_EVIDENCIA / palabras`.
 *
 * No es un umbral mágico: es la unidad de la propia escala. Una ventaja
 * menor no sale de explicar más la consulta, sale de los desempates
 * (tipo, intención, puntaje del índice), y con eso no se finge certeza.
 * Con una sola palabra hace falta toda una palabra de ventaja: "impresora"
 * o "correo" no tienen un ganador claro aunque uno empiece igual.
 */
function confianzaDe(ordenados: Puntuado[], cantidadPalabras: number): Confianza {
  const directos = ordenados.filter((puntuado) => puntuado.tramo === 0)
  const [primero, segundo] = directos
  if (!primero || !primero.explicaTodo) return 'cercana'
  if (!segundo) return 'alta'
  return primero.puntos - segundo.puntos >= PUNTOS_EVIDENCIA / cantidadPalabras ? 'alta' : 'cercana'
}

/**
 * Los mejores resultados globales, sin importar el modulo, conservando
 * el orden del buscador como desempate final (para que dos resultados
 * igual de buenos no bailen entre teclas).
 */
export function mejoresResultados(
  resultados: ResultadoBusqueda[],
  consulta: string,
  limite = MAXIMO_MEJORES,
): ResultadoBusqueda[] {
  return leerResultados(resultados, consulta, limite).mejores
}

/** ¿Hay una opción claramente superior? (regla de `confianzaDe`). */
export function confianzaDeResultados(resultados: ResultadoBusqueda[], consulta: string): Confianza {
  return leerResultados(resultados, consulta).confianza
}

/**
 * ¿Se dibuja la seccion "Mejores resultados"?
 *
 * Con dos resultados o mas, si: es la lectura por relevancia que el
 * encargo pide (seccion 2) y ADEMAS es donde viven las acciones
 * directas, acotadas a cinco filas como mucho. Los grupos de abajo se
 * quedan para explorar, en su forma de siempre.
 *
 * Con UN solo resultado, no: una cabecera "Mejores resultados · 1" sobre
 * una fila unica es puro ruido, y ahi la accion la lleva la fila del
 * grupo, que es una sola y no satura nada (seccion 13).
 */
export function hayQueSepararMejores(
  resultados: ResultadoBusqueda[],
  mejores: ResultadoBusqueda[],
): boolean {
  return resultados.length >= 2 && mejores.length > 0
}

/** Lo que queda para los grupos: un resultado no se pinta dos veces. */
export function sinLosMejores(
  resultados: ResultadoBusqueda[],
  mejores: ResultadoBusqueda[],
): ResultadoBusqueda[] {
  const elegidos = new Set(mejores.map((resultado) => resultado.id))
  return resultados.filter((resultado) => !elegidos.has(resultado.id))
}
