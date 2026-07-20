import { db, type EjecucionDiagnostico, type HistorialEntrada, type TipoEntidadHistorial } from '../../lib/db'
import { textoVivo } from '../../lib/referencia'

// Actividad reciente del equipo (fase J2 de la jornada del tecnico):
// responde "¿que cambio hoy?" sin abrir ficha por ficha. Vista
// DERIVADA de dos tablas que ya existen y ya se sincronizan
// (historial, ejecuciones_diagnostico): cero esquema, cero escrituras
// nuevas, escalable por construccion (mismo argumento que el grafo
// derivado de src/lib/grafo.ts). Logica pura separada de la consulta a
// la base, mismo patron que lineaDeTiempo.ts/textoHistorial.ts.

const UMBRAL_RAFAGA_MIN = 30
const MAX_HISTORIAL_A_REVISAR = 60

// Tipos de entidad que entran al feed: lo que un tecnico documenta
// como trabajo real. Quedan fuera 'categoria'/'ubicacion'
// (housekeeping, no trabajo de campo) y 'credencial': mostrar que
// credencial se edito filtraria su titulo a tecnicos sin permiso de
// boveda, el mismo riesgo que ya evita accesos_boveda (ver
// ARQUITECTURA.md seccion 8). Inicio no tiene lectura condicional por
// permiso, asi que se excluye siempre, no solo para quien no puede ver
// la boveda.
const TIPOS_VISIBLES: TipoEntidadHistorial[] = ['articulo', 'dispositivo', 'diagnostico']

export type EntidadActividad = 'articulo' | 'dispositivo' | 'diagnostico'
export type AccionCambio = 'creo' | 'edito' | 'elimino'

export const ETIQUETA_ACCION_CAMBIO: Record<AccionCambio, string> = {
  creo: 'creó',
  edito: 'editó',
  elimino: 'eliminó',
}

// Una rafaga de historial: mismo usuario editando la misma ficha en
// una sola sesion de trabajo (separadas por menos de UMBRAL_RAFAGA_MIN
// entre si), colapsada en un solo renglon.
export interface EventoCambio {
  tipo: 'cambio'
  clave: string
  entidadTipo: EntidadActividad
  entidadId: string
  usuario: string | null
  usuarioNombre: string
  accion: AccionCambio
  cantidadCambios: number
  fechaHora: string
  // Copia del titulo tomada de la entrada de creacion/eliminacion de la
  // rafaga, si tiene una: unico lugar donde el historial guarda el
  // nombre de la ficha (los cambios de campo no lo repiten). Vacio si
  // la rafaga es solo ediciones intermedias.
  tituloCongelado: string
}

// Una ejecucion de diagnostico es una accion puntual, no una edicion
// incremental: nunca se agrupa con otras, cada una es su propio evento.
export interface EventoEjecucion {
  tipo: 'ejecucion'
  clave: string
  diagnosticoId: string
  diagnosticoTitulo: string
  usuario: string | null
  usuarioNombre: string
  resuelto: EjecucionDiagnostico['resuelto']
  fechaHora: string
}

export type EventoActividad = EventoCambio | EventoEjecucion

function minutosEntre(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000
}

// Agrupa entradas de historial en rafagas y las combina en el tiempo
// con las ejecuciones de diagnostico. Pura: no toca la base, se puede
// probar sin navegador.
export function agruparActividad(
  historial: HistorialEntrada[],
  ejecuciones: EjecucionDiagnostico[],
  limite = 5,
): EventoActividad[] {
  const visibles = historial
    .filter((e) => TIPOS_VISIBLES.includes(e.entidadTipo))
    .slice()
    .sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))

  const cambios: EventoCambio[] = []
  let grupo: HistorialEntrada[] = []

  function cerrarGrupo() {
    if (grupo.length === 0) return
    const masReciente = grupo[0]
    const contieneEliminacion = grupo.some((e) => e.campo === 'eliminacion')
    const contieneCreacion = grupo.some((e) => e.campo === 'creacion')
    const accion: AccionCambio = contieneEliminacion ? 'elimino' : contieneCreacion ? 'creo' : 'edito'
    const congelada = grupo.find((e) => e.campo === 'creacion' || e.campo === 'eliminacion')
    const tituloCongelado = congelada
      ? congelada.campo === 'creacion'
        ? congelada.valorNuevo
        : congelada.valorAnterior
      : ''
    cambios.push({
      tipo: 'cambio',
      clave: `cambio:${masReciente.entidadTipo}:${masReciente.entidadId}:${masReciente.fechaHora}`,
      entidadTipo: masReciente.entidadTipo as EntidadActividad,
      entidadId: masReciente.entidadId,
      usuario: masReciente.usuario,
      usuarioNombre: masReciente.usuarioNombre,
      accion,
      cantidadCambios: grupo.length,
      fechaHora: masReciente.fechaHora,
      tituloCongelado,
    })
    grupo = []
  }

  for (const entrada of visibles) {
    const anterior = grupo[grupo.length - 1]
    const mismaRafaga =
      anterior &&
      anterior.usuario === entrada.usuario &&
      anterior.entidadTipo === entrada.entidadTipo &&
      anterior.entidadId === entrada.entidadId &&
      minutosEntre(anterior.fechaHora, entrada.fechaHora) <= UMBRAL_RAFAGA_MIN
    if (!mismaRafaga) cerrarGrupo()
    grupo.push(entrada)
  }
  cerrarGrupo()

  const ejecucionesEventos: EventoEjecucion[] = ejecuciones.map((e) => ({
    tipo: 'ejecucion',
    clave: `ejecucion:${e.id}`,
    diagnosticoId: e.diagnosticoId,
    diagnosticoTitulo: e.diagnosticoTitulo,
    usuario: e.usuario,
    usuarioNombre: e.usuarioNombre,
    resuelto: e.resuelto,
    fechaHora: e.fechaHora,
  }))

  return [...cambios, ...ejecucionesEventos]
    .sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))
    .slice(0, limite)
}

// "hace 5 min", "hace 2 h", "hace 3 d"; mas de una semana cae a fecha
// corta (mismo criterio que fechaCorta en ArticuloPage/DispositivoPage:
// "hace N semanas" es una lectura ambigua). `ahora` es inyectable para
// que las pruebas no dependan del reloj real.
export function tiempoRelativo(iso: string, ahora: Date = new Date()): string {
  const ms = ahora.getTime() - new Date(iso).getTime()
  const minutos = Math.round(ms / 60000)
  if (minutos < 1) return 'justo ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias < 7) return `hace ${dias} d`
  const fecha = new Date(iso)
  const opciones: Intl.DateTimeFormatOptions =
    fecha.getFullYear() === ahora.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('es', opciones).format(fecha)
}

// Fila ya lista para pintar: titulo y ruta resueltos en vivo contra la
// ficha (regla de referencia viva). Una ficha eliminada omite su fila,
// mismo criterio que obtenerRecientes/obtenerFavoritos.
export interface FilaActividad {
  clave: string
  tipo: 'cambio' | 'ejecucion'
  entidadTipo: EntidadActividad | null
  titulo: string
  ruta: string
  usuarioNombre: string
  fechaHora: string
  accion: AccionCambio | null
  cantidadCambios: number
  resuelto: EjecucionDiagnostico['resuelto'] | null
}

async function resolverFicha(
  entidadTipo: EntidadActividad,
  entidadId: string,
): Promise<{ titulo: string; ruta: string } | null> {
  if (entidadTipo === 'articulo') {
    const articulo = await db.articulos.get(entidadId)
    if (!articulo || articulo.eliminadoEn) return null
    return { titulo: articulo.titulo, ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}` }
  }
  if (entidadTipo === 'dispositivo') {
    const dispositivo = await db.dispositivos.get(entidadId)
    if (!dispositivo || dispositivo.eliminadoEn) return null
    return { titulo: dispositivo.nombre, ruta: `/dispositivos/${dispositivo.id}` }
  }
  const diagnostico = await db.diagnosticos.get(entidadId)
  if (!diagnostico || diagnostico.eliminadoEn) return null
  return { titulo: diagnostico.titulo, ruta: `/diagnostico/${diagnostico.id}` }
}

// Trae las ultimas MAX_HISTORIAL_A_REVISAR entradas por indice de
// fechaHora (nunca toArray() completo: el historial crece sin limite
// con cada edicion de cualquier ficha), agrupa y resuelve cada fila
// contra las fichas vivas.
export async function obtenerActividadReciente(limite = 5): Promise<FilaActividad[]> {
  const historial = await db.historial.orderBy('fechaHora').reverse().limit(MAX_HISTORIAL_A_REVISAR).toArray()
  const ejecuciones = await db.ejecuciones_diagnostico.toArray()
  const eventos = agruparActividad(historial, ejecuciones, limite)

  const filas: FilaActividad[] = []
  for (const evento of eventos) {
    if (evento.tipo === 'ejecucion') {
      const diagnostico = await db.diagnosticos.get(evento.diagnosticoId)
      const vivo = diagnostico && !diagnostico.eliminadoEn ? diagnostico : null
      if (!vivo) continue
      filas.push({
        clave: evento.clave,
        tipo: 'ejecucion',
        entidadTipo: null,
        titulo: textoVivo(vivo.titulo, evento.diagnosticoTitulo),
        ruta: `/diagnostico/${evento.diagnosticoId}`,
        usuarioNombre: evento.usuarioNombre || 'Alguien del equipo',
        fechaHora: evento.fechaHora,
        accion: null,
        cantidadCambios: 0,
        resuelto: evento.resuelto,
      })
      continue
    }

    const ficha = await resolverFicha(evento.entidadTipo, evento.entidadId)
    if (!ficha) continue
    filas.push({
      clave: evento.clave,
      tipo: 'cambio',
      entidadTipo: evento.entidadTipo,
      titulo: ficha.titulo,
      ruta: ficha.ruta,
      usuarioNombre: evento.usuarioNombre || 'Alguien del equipo',
      fechaHora: evento.fechaHora,
      accion: evento.accion,
      cantidadCambios: evento.cantidadCambios,
      resuelto: null,
    })
  }
  return filas
}
