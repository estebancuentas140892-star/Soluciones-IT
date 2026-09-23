import type { Dispositivo, HistorialEntrada, Persona } from '../../lib/db'
import { diasDeCalendario, DIAS_AVISO_VENCIMIENTO, fechaCorta } from '../../lib/vencimiento'
import { estadoCanonico } from '../dispositivos/estados'
import { tiempoRelativo } from '../historial/actividadEquipo'
import { equiposActuales, estaActiva } from '../personas/cicloPersona'
import { esEntradaDeAsignacion } from '../personas/historialAsignaciones'
import type { ItemPendiente } from './pendientes'

// LO QUE PIDEN LOS INGRESOS Y LOS RETIROS (tarea 270, secciones 14 y 15
// del encargo del 2026-09-23).
//
// La agenda solo lleva lo que requiere una ACCIÓN. De las personas y sus
// equipos salen tres asuntos, derivados de datos que ya existen (sin
// tabla nueva, sin fechas inventadas):
//
//   - Persona que ingresa sin equipo: activa, con fecha de ingreso entre
//     los próximos 30 días y los 30 pasados, y sin ningún equipo a su
//     nombre. Su fecha es la del ingreso: antes es "Próximo", ese día
//     "Hoy" y después "Vencido" (llegó y no tiene con qué trabajar). Una
//     persona sin fecha de ingreso nunca entra: no se sabe cuándo llega,
//     y suponerlo sería inventarlo.
//   - Persona retirada con equipos a su nombre: el retiro resuelve cada
//     equipo antes de cambiar el estado, así que esto solo pasa con datos
//     de antes o que llegaron de otro teléfono; cuando pasa, hay que
//     resolverlo. Su fecha es la del retiro; sin fecha, va a "Por
//     revisar".
//   - Equipo liberado hace poco (14 días) que está Disponible y sin
//     responsable: espera a quien asignarlo. Sale del historial (la
//     entrada `responsableId` que lo soltó), así que un equipo que
//     siempre estuvo libre no es un asunto. Sin fecha: va a "Por revisar".
//
// Lo que NO entra, a propósito: la calidad del inventario (equipos sin
// foto, sin ubicación, responsables por validar). Eso vive en Más >
// Herramientas de inventario y no compite con lo que vence hoy.

/** Hasta cuántos días después del ingreso sigue avisando una persona sin equipo. */
export const DIAS_TRAS_INGRESO = 30
/** Cuánto dura "liberado hace poco". */
export const DIAS_LIBERADO_RECIENTE = 14

const MS_DIA = 24 * 60 * 60 * 1000

type PersonaDeAgenda = Pick<Persona, 'id' | 'nombre' | 'estado' | 'fechaIngreso' | 'fechaRetiro' | 'eliminadoEn'>
type EquipoDeAgenda = Pick<Dispositivo, 'id' | 'nombre' | 'estado' | 'responsableId' | 'eliminadoEn'>
type EntradaDeAgenda = Pick<
  HistorialEntrada,
  'entidadTipo' | 'entidadId' | 'campo' | 'valorAnterior' | 'valorNuevo' | 'fechaHora'
>

function haceDias(dias: number): string {
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/** "Ingresa el 30 sep", "Ingresa mañana", "Ingresa hoy", "Ingresó hace 3 días". */
export function textoIngreso(fecha: string, dias: number): string {
  if (dias < 0) return `Ingresó ${haceDias(-dias)}`
  if (dias === 0) return 'Ingresa hoy'
  if (dias === 1) return 'Ingresa mañana'
  return `Ingresa el ${fechaCorta(fecha)}`
}

/** "Se retiró hace 5 días", "Se retira hoy", "Se retira el 30 sep". */
export function textoRetiro(fecha: string, dias: number): string {
  if (dias < 0) return `Se retiró ${haceDias(-dias)}`
  if (dias === 0) return 'Se retira hoy'
  if (dias === 1) return 'Se retira mañana'
  return `Se retira el ${fechaCorta(fecha)}`
}

/** Las personas que llegan (o acaban de llegar) sin ningún equipo a su nombre. */
export function personasPorRecibir(
  personas: PersonaDeAgenda[],
  dispositivos: EquipoDeAgenda[],
  hoy: Date = new Date(),
): ItemPendiente[] {
  return personas
    .filter((p) => !p.eliminadoEn && estaActiva(p) && Boolean(p.fechaIngreso))
    .flatMap((p): ItemPendiente[] => {
      const fecha = p.fechaIngreso as string
      const dias = diasDeCalendario(fecha, hoy)
      if (dias === null || dias > DIAS_AVISO_VENCIMIENTO || dias < -DIAS_TRAS_INGRESO) return []
      if (equiposActuales(p.id, dispositivos).length > 0) return []
      return [
        {
          clave: `persona_ingreso:${p.id}`,
          titulo: p.nombre,
          // Corto a propósito: en el teléfono la línea no se parte.
          detalle: `${textoIngreso(fecha, dias)} · sin equipo`,
          ruta: `/personas/${p.id}`,
          tono: dias <= 0 ? 'precaucion' : 'neutro',
          categoria: 'persona_ingreso',
          fecha,
          diasRestantes: dias,
          // Sin origen: el nombre y el icono ya dicen que es una persona.
          origen: '',
        },
      ]
    })
}

/** Las personas retiradas que todavía tienen equipos a su nombre. */
export function personasRetiradasConEquipos(
  personas: PersonaDeAgenda[],
  dispositivos: EquipoDeAgenda[],
  hoy: Date = new Date(),
): ItemPendiente[] {
  return personas
    .filter((p) => !p.eliminadoEn && !estaActiva(p))
    .flatMap((p): ItemPendiente[] => {
      const equipos = equiposActuales(p.id, dispositivos)
      if (equipos.length === 0) return []
      const dias = p.fechaRetiro ? diasDeCalendario(p.fechaRetiro, hoy) : null
      // Un retiro todavía lejano no pide nada hoy.
      if (dias !== null && dias > DIAS_AVISO_VENCIMIENTO) return []
      // El número y no el nombre: un nombre de equipo largo cortaría la
      // línea en el teléfono, y los equipos están en su ficha, a un toque.
      const aSuNombre = equipos.length === 1 ? 'con 1 equipo' : `con ${equipos.length} equipos`
      return [
        {
          clave: `persona_retirada:${p.id}`,
          titulo: p.nombre,
          detalle: dias === null ? `Retirada · ${aSuNombre}` : `${textoRetiro(p.fechaRetiro as string, dias)} · ${aSuNombre}`,
          ruta: `/personas/${p.id}`,
          tono: 'precaucion',
          categoria: 'persona_retirada',
          fecha: dias === null ? null : p.fechaRetiro,
          diasRestantes: dias,
          origen: '',
        },
      ]
    })
}

/**
 * Los equipos que alguien soltó en los últimos `dias` y que siguen
 * Disponibles y sin responsable, el más reciente primero. `entradas`
 * puede traer cualquier historial: solo cuentan las de asignación.
 */
export function equiposLiberadosRecientes(
  entradas: EntradaDeAgenda[],
  dispositivos: EquipoDeAgenda[],
  ahora: Date = new Date(),
  dias: number = DIAS_LIBERADO_RECIENTE,
): ItemPendiente[] {
  // La última entrada de asignación de cada equipo: si después de
  // soltarlo alguien lo asignó, ya no espera nada.
  const ultima = new Map<string, EntradaDeAgenda>()
  for (const entrada of entradas) {
    if (!esEntradaDeAsignacion(entrada)) continue
    const previa = ultima.get(entrada.entidadId)
    if (!previa || previa.fechaHora < entrada.fechaHora) ultima.set(entrada.entidadId, entrada)
  }
  const porId = new Map(dispositivos.map((d) => [d.id, d]))
  const desde = ahora.getTime() - dias * MS_DIA
  return [...ultima.values()]
    .filter((e) => e.valorAnterior !== '' && e.valorNuevo === '' && Date.parse(e.fechaHora) >= desde)
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))
    .flatMap((e): ItemPendiente[] => {
      const equipo = porId.get(e.entidadId)
      if (!equipo || equipo.eliminadoEn || equipo.responsableId) return []
      // Solo el que funciona espera dueño: uno en mantenimiento o de baja
      // no se reasigna, y uno sin estado no dice si funciona.
      if (estadoCanonico(equipo.estado) !== 'Disponible') return []
      return [
        {
          clave: `equipo_liberado:${equipo.id}`,
          titulo: equipo.nombre,
          detalle: `Liberado ${tiempoRelativo(e.fechaHora, ahora)} · Disponible`,
          ruta: `/dispositivos/${equipo.id}`,
          tono: 'neutro',
          categoria: 'equipo_liberado',
          fecha: null,
          diasRestantes: null,
          origen: 'Equipos',
        },
      ]
    })
}
