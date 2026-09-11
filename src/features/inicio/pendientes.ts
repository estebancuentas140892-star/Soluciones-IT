import type { Articulo, CampoProtegido, Credencial, EjecucionDiagnostico } from '../../lib/db'
import { diasDeCalendario, estadoVencimiento, textoVencimiento } from '../../lib/vencimiento'
import { tiempoRelativo } from '../historial/actividadEquipo'

// Bloque "Pendientes" de Inicio (decisión D5 de PROPUESTA_JORNADA_TECNICO.md,
// aprobada por el usuario el 2026-07-21 con el contenido recomendado):
// no existe una entidad "pendiente" en el sistema, y crear una (un
// gestor de tareas) sería otro producto. En cambio se deriva de lo que
// ya SIGNIFICA "pendiente" en los datos reales, sin esquema ni tabla
// nueva: mis borradores, credenciales por vencer o vencidas (solo con
// permiso de bóveda) y sugerencias del equipo sin revisar (mismo dato
// que ya muestra SugerenciasEquipoPage). Lógica pura, separada de la
// consulta a la base, mismo patrón que actividadEquipo.ts.
//
// EL ORDEN ES POR FECHA, NO POR PROCEDENCIA (encargo del 2026-09-11,
// tarea 1). Antes cada fuente se ordenaba por su cuenta y luego se
// concatenaban, así que TODAS las credenciales de la Bóveda —incluida
// una que vence dentro de tres semanas— salían antes que un dato
// protegido de un equipo vencido hace medio año. Para el técnico son lo
// mismo: una clave con fecha. Por eso cada ítem lleva ahora su fecha
// real (`fecha`) y los días de calendario que faltan (`diasRestantes`),
// y el orden es uno solo y global: lo más vencido primero, luego lo de
// hoy, luego lo más cercano.

export interface ItemPendiente {
  clave: string
  titulo: string
  detalle: string
  ruta: string
  tono: 'neutro' | 'precaucion' | 'error'
  categoria: 'borrador' | 'credencial' | 'sugerencia' | 'campo_protegido'
  /** Fecha de vencimiento "YYYY-MM-DD", o null si el ítem no tiene una. */
  fecha: string | null
  /**
   * Días de calendario hasta `fecha`: negativo si ya venció, 0 si vence
   * hoy, positivo si falta. `null` cuando no hay fecha (un borrador o
   * una sugerencia no vencen).
   */
  diasRestantes: number | null
}

// Orden global de lo que TIENE fecha: el más vencido primero
// (diasRestantes más negativo), después lo de hoy (0) y por último lo
// próximo, de la fecha más cercana a la más lejana. A igualdad de día,
// por título, para que la lista no baile entre renders.
function porFecha(a: ItemPendiente, b: ItemPendiente): number {
  const diferencia = (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0)
  return diferencia !== 0 ? diferencia : a.titulo.localeCompare(b.titulo, 'es')
}

// Artículos en borrador que este técnico editó por última vez. No hay
// un campo "creado por" aparte de updatedBy: "mío" se define por quién
// lo tocó más recientemente (si alguien más lo está retomando, ya no es
// un borrador olvidado de este técnico).
//
// Un borrador NO vence: no lleva fecha y nunca entra en el orden por
// vencimiento. Es trabajo en curso, y su detalle lo dice ("actualizado
// hace 2 d"), no una obligación con plazo.
export function borradoresPropios(
  articulos: Articulo[],
  usuarioId: string,
  ahora: Date = new Date(),
): ItemPendiente[] {
  return articulos
    .filter((a) => !a.eliminadoEn && a.estado === 'borrador' && a.updatedBy === usuarioId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((a) => ({
      clave: `borrador:${a.id}`,
      titulo: a.titulo || '(sin título)',
      detalle: `Borrador propio · actualizado ${tiempoRelativo(a.updatedAt, ahora)}`,
      ruta: `/soluciones/${a.categoriaId}/${a.id}`,
      tono: 'neutro',
      categoria: 'borrador',
      fecha: null,
      diasRestantes: null,
    }))
}

// Credenciales vencidas o por vencer (mismo cálculo que ya usa
// BovedaPage para su aviso de rotación). Quien llama decide si tiene
// sentido pasarlas: sin permiso de bóveda no deberían listarse aquí,
// filtraría títulos de secretos a quien no debe verlos.
export function credencialesPorVencer(credenciales: Credencial[], hoy: Date = new Date()): ItemPendiente[] {
  return credenciales
    .filter((c) => !c.eliminadoEn)
    .map((c) => ({ credencial: c, estado: estadoVencimiento(c.venceEn, hoy) }))
    .filter((x): x is { credencial: Credencial; estado: 'vencida' | 'proxima' } => x.estado !== null)
    .map(({ credencial, estado }) => ({
      clave: `credencial:${credencial.id}`,
      titulo: credencial.titulo,
      detalle: textoVencimiento(credencial.venceEn as string, hoy),
      ruta: `/boveda/${credencial.id}`,
      tono: (estado === 'vencida' ? 'error' : 'precaucion') as ItemPendiente['tono'],
      categoria: 'credencial' as const,
      fecha: credencial.venceEn,
      diasRestantes: diasDeCalendario(credencial.venceEn as string, hoy),
    }))
    .sort(porFecha)
}

// Campos protegidos de equipo vencidos o por vencer (hallazgo S2):
// mismo cálculo que credencialesPorVencer, aplicado a la otra mitad de
// la bóveda. `nombresPorId` da el nombre vivo del equipo (el campo
// protegido no lo guarda, solo el dispositivoId).
export function camposProtegidosPorVencer(
  campos: CampoProtegido[],
  nombresPorId: Map<string, string>,
  hoy: Date = new Date(),
): ItemPendiente[] {
  return campos
    .filter((c) => !c.eliminadoEn && c.dispositivoId)
    .map((c) => ({ campo: c, estado: estadoVencimiento(c.venceEn, hoy) }))
    .filter((x): x is { campo: CampoProtegido; estado: 'vencida' | 'proxima' } => x.estado !== null)
    .map(({ campo, estado }) => ({
      clave: `campo_protegido:${campo.id}`,
      titulo: campo.nombre,
      detalle: `${textoVencimiento(campo.venceEn as string, hoy)} · ${nombresPorId.get(campo.dispositivoId!) ?? 'Equipo eliminado'}`,
      ruta: `/dispositivos/${campo.dispositivoId}`,
      tono: (estado === 'vencida' ? 'error' : 'precaucion') as ItemPendiente['tono'],
      categoria: 'campo_protegido' as const,
      fecha: campo.venceEn,
      diasRestantes: diasDeCalendario(campo.venceEn as string, hoy),
    }))
    .sort(porFecha)
}

// Mismo dato que ya muestra SugerenciasEquipoPage (motivo
// 'encontro_otra_solucion' con texto propuesto). "Sin revisar" era,
// hasta la tarea 140, "todas las que existen", porque no habia ningun
// flujo que las cerrara; este era el lugar marcado para sumar la
// condicion cuando lo hubiera, y ya lo hay: una sugerencia que ya se
// convirtio en articulo (hallazgo K2) deja de ser un pendiente.
//
// El cierre se lee del articulo (`origenSugerenciaId`), no de la
// ejecucion, que es un registro inmutable. Un articulo eliminado no
// cierra nada: la sugerencia vuelve a la lista, que es lo correcto si
// alguien borro el borrador que la atendia.
export function sugerenciasSinRevisar(
  ejecuciones: EjecucionDiagnostico[],
  articulos: Articulo[],
): ItemPendiente[] {
  const yaRedactadas = new Set(
    articulos.filter((a) => !a.eliminadoEn && a.origenSugerenciaId).map((a) => a.origenSugerenciaId),
  )
  return ejecuciones
    .filter(
      (e) =>
        e.motivo === 'encontro_otra_solucion' &&
        e.solucionPropuesta.trim() !== '' &&
        !yaRedactadas.has(e.id),
    )
    .sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))
    .map((e) => ({
      clave: `sugerencia:${e.id}`,
      titulo: e.diagnosticoTitulo,
      detalle: 'Sugerencia sin revisar',
      ruta: '/diagnostico/sugerencias',
      tono: 'neutro',
      categoria: 'sugerencia',
      fecha: null,
      diasRestantes: null,
    }))
}

// Combina las cuatro fuentes en un solo bloque. Primero TODO lo que
// tiene fecha, ordenado globalmente por esa fecha (venga de la Bóveda o
// de los Datos protegidos de un equipo: para quien lo tiene que rotar
// son la misma obligación); después el trabajo sin plazo (borradores
// propios y sugerencias del equipo).
export function calcularPendientes(datos: {
  articulos: Articulo[]
  credenciales: Credencial[]
  camposProtegidos: CampoProtegido[]
  nombresDispositivosPorId: Map<string, string>
  ejecuciones: EjecucionDiagnostico[]
  // Artículos nacidos de una sugerencia, en CUALQUIER estado (tarea
  // 140). Va aparte de `articulos` a propósito: ese primer parámetro
  // trae solo los borradores, y si el cierre del bucle se leyera de
  // ahí, publicar el artículo (que es el cierre más fuerte posible)
  // devolvería la sugerencia a los pendientes para siempre.
  articulosDeSugerencia: Articulo[]
  usuarioId: string
  puedeVerBoveda: boolean
  limite?: number
  hoy?: Date
}): ItemPendiente[] {
  const {
    articulos,
    credenciales,
    camposProtegidos,
    nombresDispositivosPorId,
    ejecuciones,
    articulosDeSugerencia,
    usuarioId,
    puedeVerBoveda,
    limite = 6,
    hoy = new Date(),
  } = datos
  // Sin permiso de bóveda no se filtra ni un título: ni de credenciales
  // ni de datos protegidos de equipo, que llevan la misma RLS.
  const conFecha = [
    ...credencialesPorVencer(puedeVerBoveda ? credenciales : [], hoy),
    ...camposProtegidosPorVencer(puedeVerBoveda ? camposProtegidos : [], nombresDispositivosPorId, hoy),
  ].sort(porFecha)

  const items = [
    ...conFecha,
    ...borradoresPropios(articulos, usuarioId, hoy),
    ...sugerenciasSinRevisar(ejecuciones, articulosDeSugerencia),
  ]
  return items.slice(0, limite)
}
