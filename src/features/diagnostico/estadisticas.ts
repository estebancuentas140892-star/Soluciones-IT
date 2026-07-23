import type { EjecucionDiagnostico } from '../../lib/db'
import { MOTIVOS_ORDEN, type MotivoConcreto } from './motivos'

// Tablero de estadisticas del Modo Diagnostico (F3 de
// PROPUESTA_MODULOS.md, tambien Fase 2 de
// PROPUESTA_REVISION_ARQUITECTURA.md): explota lo que el equipo ya
// lleva registrando en `ejecuciones_diagnostico` desde la tarea 46, una
// tabla de solo inserciones que hasta hoy nadie leia para agregar.
// Vista DERIVADA: cero esquema, cero escrituras nuevas, mismo argumento
// que actividadEquipo.ts y grafo.ts.
//
// Todo este modulo es puro (no toca la base) y trabaja con los TEXTOS
// CONGELADOS de cada ejecucion, que es lo correcto para un registro
// inmutable (ver la excepcion deliberada en src/lib/referencia.ts). La
// pantalla resuelve despues el titulo vivo contra la ficha, para que
// renombrar un diagnostico no deje el tablero con el nombre viejo.

// Duracion "tipica" y tasa de exito se calculan solo sobre las
// ejecuciones CERRADAS, es decir las que terminaron en 'si' o 'no'. Una
// abandonada no es un fracaso del diagnostico: el tecnico se fue a otra
// cosa, y su duracion es arbitraria (puede ser la app abierta media
// hora). Contarlas hundiria la tasa y ensuciaria el tiempo.
function estaCerrada(ejecucion: EjecucionDiagnostico): boolean {
  return ejecucion.resuelto === 'si' || ejecucion.resuelto === 'no'
}

// Mediana, no promedio: con el volumen de un equipo de 5 tecnicos una
// sola ejecucion olvidada abierta arrastra el promedio a un numero que
// no le paso a nadie. La mediana aguanta ese caso sin descartar datos a
// mano.
function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2
}

export interface ResumenEjecuciones {
  total: number
  resueltas: number
  noResueltas: number
  abandonadas: number
  // Proporcion de 0 a 1 sobre las cerradas, o null si aun no hay
  // ninguna cerrada (no es lo mismo "0 %" que "todavia no se sabe").
  tasaExito: number | null
  // Mediana en segundos de las ejecuciones RESUELTAS: responde "cuanto
  // se tarda cuando esto funciona". null si ninguna se resolvio aun.
  duracionMedianaSegundos: number | null
}

export function resumirEjecuciones(ejecuciones: EjecucionDiagnostico[]): ResumenEjecuciones {
  const resueltas = ejecuciones.filter((e) => e.resuelto === 'si')
  const noResueltas = ejecuciones.filter((e) => e.resuelto === 'no')
  const abandonadas = ejecuciones.filter((e) => e.resuelto === 'abandonado')
  const cerradas = ejecuciones.filter(estaCerrada)
  return {
    total: ejecuciones.length,
    resueltas: resueltas.length,
    noResueltas: noResueltas.length,
    abandonadas: abandonadas.length,
    tasaExito: cerradas.length === 0 ? null : resueltas.length / cerradas.length,
    duracionMedianaSegundos: mediana(resueltas.map((e) => e.duracionSegundos)),
  }
}

export interface FilaProblema {
  diagnosticoId: string
  // Copia congelada de la ejecucion mas reciente; la pantalla la
  // resuelve contra la ficha viva antes de pintarla.
  titulo: string
  ejecuciones: number
  resueltas: number
  tasaExito: number | null
}

// Problemas mas frecuentes: que se diagnostica de verdad en el dia a
// dia. Ordena por cantidad de ejecuciones y desempata por titulo, para
// que dos problemas empatados no bailen de posicion entre renders.
export function problemasMasFrecuentes(
  ejecuciones: EjecucionDiagnostico[],
  limite = 5,
): FilaProblema[] {
  const porDiagnostico = new Map<string, EjecucionDiagnostico[]>()
  for (const ejecucion of ejecuciones) {
    const lista = porDiagnostico.get(ejecucion.diagnosticoId)
    if (lista) lista.push(ejecucion)
    else porDiagnostico.set(ejecucion.diagnosticoId, [ejecucion])
  }

  return [...porDiagnostico.entries()]
    .map(([diagnosticoId, delGrupo]) => {
      const cerradas = delGrupo.filter(estaCerrada)
      const resueltas = delGrupo.filter((e) => e.resuelto === 'si').length
      // El titulo mas reciente es el menos desactualizado de los
      // congelados, por si la ficha ya no existe.
      const masReciente = delGrupo.reduce((a, b) => (a.fechaHora >= b.fechaHora ? a : b))
      return {
        diagnosticoId,
        titulo: masReciente.diagnosticoTitulo,
        ejecuciones: delGrupo.length,
        resueltas,
        tasaExito: cerradas.length === 0 ? null : resueltas / cerradas.length,
      }
    })
    .sort((a, b) => b.ejecuciones - a.ejecuciones || a.titulo.localeCompare(b.titulo, 'es'))
    .slice(0, limite)
}

export interface FilaProcedimiento {
  articuloId: string
  titulo: string
  // En cuantas EJECUCIONES se abrio, no cuantas veces en total: abrir
  // dos veces el mismo procedimiento dentro de un mismo diagnostico
  // (por ejemplo al volver atras) no lo hace mas usado.
  ejecuciones: number
}

export function procedimientosMasUsados(
  ejecuciones: EjecucionDiagnostico[],
  limite = 5,
): FilaProcedimiento[] {
  const veces = new Map<string, { titulo: string; ejecuciones: number }>()
  for (const ejecucion of ejecuciones) {
    const yaContados = new Set<string>()
    for (const articulo of ejecucion.articulosEjecutados) {
      if (yaContados.has(articulo.id)) continue
      yaContados.add(articulo.id)
      const actual = veces.get(articulo.id)
      if (actual) actual.ejecuciones += 1
      else veces.set(articulo.id, { titulo: articulo.titulo, ejecuciones: 1 })
    }
  }

  return [...veces.entries()]
    .map(([articuloId, datos]) => ({ articuloId, ...datos }))
    .sort((a, b) => b.ejecuciones - a.ejecuciones || a.titulo.localeCompare(b.titulo, 'es'))
    .slice(0, limite)
}

export interface FilaMotivo {
  motivo: MotivoConcreto
  veces: number
}

// Por que falla lo que falla: desglose de las ejecuciones cerradas en
// "no". Es la lectura mas accionable del tablero, porque cada motivo
// apunta a un arreglo distinto (reescribir la solucion, agregar pasos,
// crear un diagnostico que falta). Omite los motivos sin ocurrencias.
export function motivosDeFallo(ejecuciones: EjecucionDiagnostico[]): FilaMotivo[] {
  const conteo = new Map<MotivoConcreto, number>()
  for (const ejecucion of ejecuciones) {
    if (ejecucion.resuelto !== 'no') continue
    // Una ejecucion de antes de la fase D3, o cerrada sin elegir
    // motivo, llega con '' y no suma a ningun motivo.
    if (ejecucion.motivo === '') continue
    conteo.set(ejecucion.motivo, (conteo.get(ejecucion.motivo) ?? 0) + 1)
  }
  return MOTIVOS_ORDEN.filter((motivo) => conteo.has(motivo)).map((motivo) => ({
    motivo,
    veces: conteo.get(motivo) ?? 0,
  }))
}

// "45 s", "3 min", "1 h 20 min". Sin decimales: en un tablero que se
// mira de reojo, "3 min" comunica lo mismo que "3,4 min" y se lee mejor.
export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  if (total < 60) return `${total} s`
  const minutos = Math.round(total / 60)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

// Proporcion 0-1 -> "80 %". Con el espacio fino antes del signo, como
// manda la ortografia del español.
export function formatearPorcentaje(proporcion: number): string {
  return `${Math.round(proporcion * 100)} %`
}
