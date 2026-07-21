import type { Articulo, Credencial, EjecucionDiagnostico } from '../../lib/db'
import { estadoVencimiento } from '../../lib/vencimiento'

// Bloque "Pendientes" de Inicio (decisión D5 de PROPUESTA_JORNADA_TECNICO.md,
// aprobada por el usuario el 2026-07-21 con el contenido recomendado):
// no existe una entidad "pendiente" en el sistema, y crear una (un
// gestor de tareas) sería otro producto. En cambio se deriva de lo que
// ya SIGNIFICA "pendiente" en los datos reales, sin esquema ni tabla
// nueva: mis borradores, credenciales por vencer o vencidas (solo con
// permiso de bóveda) y sugerencias del equipo sin revisar (mismo dato
// que ya muestra SugerenciasEquipoPage). Lógica pura, separada de la
// consulta a la base, mismo patrón que actividadEquipo.ts.

export interface ItemPendiente {
  clave: string
  titulo: string
  detalle: string
  ruta: string
  tono: 'neutro' | 'precaucion' | 'error'
  categoria: 'borrador' | 'credencial' | 'sugerencia'
}

// Artículos en borrador que este técnico editó por última vez. No hay
// un campo "creado por" aparte de updatedBy: "mío" se define por quién
// lo tocó más recientemente (si alguien más lo está retomando, ya no es
// un borrador olvidado de este técnico).
export function borradoresPropios(articulos: Articulo[], usuarioId: string): ItemPendiente[] {
  return articulos
    .filter((a) => !a.eliminadoEn && a.estado === 'borrador' && a.updatedBy === usuarioId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((a) => ({
      clave: `borrador:${a.id}`,
      titulo: a.titulo || '(sin título)',
      detalle: 'Borrador propio',
      ruta: `/soluciones/${a.categoriaId}/${a.id}`,
      tono: 'neutro',
      categoria: 'borrador',
    }))
}

// Credenciales vencidas o por vencer (mismo cálculo que ya usa
// BovedaPage para su aviso de rotación). Quien llama decide si tiene
// sentido pasarlas: sin permiso de bóveda no deberían listarse aquí,
// filtraría títulos de secretos a quien no debe verlos.
export function credencialesPorVencer(credenciales: Credencial[]): ItemPendiente[] {
  return credenciales
    .filter((c) => !c.eliminadoEn)
    .map((c) => ({ credencial: c, estado: estadoVencimiento(c.venceEn) }))
    .filter((x): x is { credencial: Credencial; estado: 'vencida' | 'proxima' } => x.estado !== null)
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'vencida' ? -1 : 1))
    .map(({ credencial, estado }) => ({
      clave: `credencial:${credencial.id}`,
      titulo: credencial.titulo,
      detalle: estado === 'vencida' ? 'Vencida' : 'Vence pronto',
      ruta: `/boveda/${credencial.id}`,
      tono: estado === 'vencida' ? 'error' : 'precaucion',
      categoria: 'credencial',
    }))
}

// Mismo dato que ya muestra SugerenciasEquipoPage (motivo
// 'encontro_otra_solucion' con texto propuesto): sin flujo de
// "revisado" todavía, así que "sin revisar" es, hoy, "todas las que
// existen". Si algún día se agrega ese flujo, este filtro es el lugar
// donde sumar la condición.
export function sugerenciasSinRevisar(ejecuciones: EjecucionDiagnostico[]): ItemPendiente[] {
  return ejecuciones
    .filter((e) => e.motivo === 'encontro_otra_solucion' && e.solucionPropuesta.trim() !== '')
    .sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))
    .map((e) => ({
      clave: `sugerencia:${e.id}`,
      titulo: e.diagnosticoTitulo,
      detalle: 'Sugerencia sin revisar',
      ruta: '/diagnostico/sugerencias',
      tono: 'neutro',
      categoria: 'sugerencia',
    }))
}

// Combina las tres fuentes en un solo bloque, lo más urgente primero
// (una credencial vencida importa más que un borrador propio). Tope
// bajo a propósito: Inicio es un panel de trabajo, no un gestor de
// tareas completo; si algo se corta, sigue siendo accesible desde su
// propia pantalla (Bóveda, Soluciones, Sugerencias del equipo).
export function calcularPendientes(datos: {
  articulos: Articulo[]
  credenciales: Credencial[]
  ejecuciones: EjecucionDiagnostico[]
  usuarioId: string
  puedeVerBoveda: boolean
  limite?: number
}): ItemPendiente[] {
  const { articulos, credenciales, ejecuciones, usuarioId, puedeVerBoveda, limite = 6 } = datos
  const items = [
    ...credencialesPorVencer(puedeVerBoveda ? credenciales : []),
    ...borradoresPropios(articulos, usuarioId),
    ...sugerenciasSinRevisar(ejecuciones),
  ]
  return items.slice(0, limite)
}
