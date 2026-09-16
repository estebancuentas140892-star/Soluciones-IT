import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

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
  diagnostico: 'Diagnóstico',
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
 * puede convertirse en "Herramienta · Herramienta · Monitoreo").
 */
export function subtituloConTipo(resultado: ResultadoBusqueda): string {
  const etiqueta = ETIQUETA_TIPO[resultado.tipo]
  const subtitulo = resultado.subtitulo.trim()
  if (!subtitulo) return etiqueta
  if (normalizarTexto(subtitulo).startsWith(normalizarTexto(etiqueta))) return subtitulo
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
 * ya usa (seccion 15: sin IA generativa y sin servicios externos).
 * Pueden aplicar varias a la vez ("no imprime la caja 4" es problema y
 * equipo).
 */
export type Intencion = 'procedimiento' | 'glosario' | 'equipo' | 'problema' | 'acceso' | 'consola'

const TIPOS_POR_INTENCION: Record<Intencion, TipoResultado[]> = {
  procedimiento: ['articulo', 'diagnostico'],
  glosario: ['termino'],
  equipo: ['dispositivo'],
  problema: ['diagnostico', 'articulo'],
  acceso: ['credencial'],
  consola: ['comando', 'atajo'],
}

// Verbos con los que el equipo nombra un procedimiento. Van como
// prefijo de palabra (no como subcadena) para que "crear" no se dispare
// dentro de otra palabra.
const VERBOS_PROCEDIMIENTO = [
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
  'quitar',
  'eliminar',
  'habilitar',
  'deshabilitar',
  'montar',
  'generar',
  'hacer',
  'como',
]

const PALABRAS_GLOSARIO = ['que es', 'que son', 'que significa', 'definicion', 'significado']

const PALABRAS_PROBLEMA = [
  'no ',
  'falla',
  'fallo',
  'error',
  'lento',
  'lentitud',
  'se cae',
  'se apaga',
  'se cuelga',
  'sin ',
]

const PALABRAS_ACCESO = [
  'usuario',
  'contrasena',
  'clave',
  'password',
  'acceso',
  'cuenta',
  'credencial',
  'pin',
  'token',
  'licencia',
  'administrador',
  'admin',
]

const PALABRAS_CONSOLA = ['comando', 'consola', 'terminal', 'cmd', 'powershell', 'atajo', 'tecla']

export function intencionesDeConsulta(consulta: string): Intencion[] {
  const texto = normalizarTexto(consulta.trim())
  if (!texto) return []
  const palabras = texto.split(/\s+/).filter(Boolean)
  const intenciones = new Set<Intencion>()

  if (PALABRAS_GLOSARIO.some((clave) => texto.startsWith(clave))) intenciones.add('glosario')
  if (palabras.some((palabra) => VERBOS_PROCEDIMIENTO.includes(palabra))) intenciones.add('procedimiento')
  if (PALABRAS_PROBLEMA.some((clave) => texto.includes(clave))) intenciones.add('problema')
  if (PALABRAS_ACCESO.some((clave) => palabras.includes(clave))) intenciones.add('acceso')
  if (PALABRAS_CONSOLA.some((clave) => palabras.includes(clave))) intenciones.add('consola')
  // Un numero suelto entre las palabras nombra casi siempre un equipo
  // concreto ("caja 4", "impresora taquilla 2"), no un procedimiento.
  if (palabras.length > 1 && palabras.some((palabra) => /^\d+$/.test(palabra))) intenciones.add('equipo')

  return [...intenciones]
}

// Cuanto suma acertar la intencion. Menos que una coincidencia de
// titulo a proposito: la intencion desempata entre cosas que ya
// coinciden, nunca inventa un resultado que no se busco.
const BONO_INTENCION = 18

function puntuacion(
  resultado: ResultadoBusqueda,
  consulta: string,
  palabras: string[],
  intenciones: Intencion[],
): number {
  const titulo = normalizarTexto(resultado.titulo)
  let puntos = PESO_OPERATIVO[resultado.tipo]

  // El orden del encargo (seccion 14): titulo exacto, coincidencia
  // directa, y por debajo lo parcial.
  if (titulo === consulta) puntos += 100
  else if (titulo.startsWith(consulta)) puntos += 60
  else if (titulo.includes(consulta)) puntos += 40
  else if (palabras.length > 1 && palabras.every((palabra) => titulo.includes(palabra))) puntos += 25
  else if (palabras.some((palabra) => titulo.includes(palabra))) puntos += 10

  for (const intencion of intenciones) {
    if (TIPOS_POR_INTENCION[intencion].includes(resultado.tipo)) puntos += BONO_INTENCION
  }

  return puntos
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
  const texto = normalizarTexto(consulta.trim())
  if (!texto || resultados.length === 0 || limite <= 0) return []
  const palabras = texto.split(/\s+/).filter(Boolean)
  const intenciones = intencionesDeConsulta(consulta)

  return resultados
    .map((resultado, orden) => ({
      resultado,
      orden,
      // Tramo 0: lo que coincide con lo escrito. Tramo 1: lo que solo
      // trajo un sinonimo. Ningun bono cruza de tramo (seccion 14).
      tramo: resultado.soloSinonimo ? 1 : 0,
      puntos: puntuacion(resultado, texto, palabras, intenciones),
    }))
    .sort((a, b) => a.tramo - b.tramo || b.puntos - a.puntos || a.orden - b.orden)
    .slice(0, limite)
    .map((entrada) => entrada.resultado)
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
