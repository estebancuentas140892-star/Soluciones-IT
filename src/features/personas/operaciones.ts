import { db, type Dispositivo, type Persona } from '../../lib/db'
import { guardarRegistro } from '../../lib/repositorio'
import { dependenciasDeBaja, sinDependencias } from '../dispositivos/baja'
import { estadoAlAsignar } from './cicloPersona'

// LAS ESCRITURAS DEL CICLO DE VIDA (tarea 266).
//
// Todo pasa por `guardarRegistro`, el punto único de escritura: cada
// cambio queda en la base local, en el historial (con el id de la
// persona anterior y el de la nueva, ver repositorio.ts) y en la cola de
// sincronización. Nada se borra: retirar a una persona, liberar un
// equipo o darlo de baja son cambios de estado con su huella.
//
// Cada operación RELEE la fila antes de escribir, en vez de fiarse del
// objeto que tenía la pantalla: entre que el técnico abrió la ficha y
// confirmó puede haber llegado un cambio del equipo por sincronización,
// y guardar la copia vieja lo pisaría.

async function equipoVivo(dispositivoId: string): Promise<Dispositivo> {
  const dispositivo = await db.dispositivos.get(dispositivoId)
  if (!dispositivo || dispositivo.eliminadoEn) throw new Error('El equipo ya no existe')
  return dispositivo
}

async function personaViva(personaId: string): Promise<Persona> {
  const persona = await db.personas.get(personaId)
  if (!persona || persona.eliminadoEn) throw new Error('La persona ya no existe')
  return persona
}

/**
 * Asigna el equipo a la persona: fija `responsableId`, pone su nombre
 * como copia de referencia y, si estaba Disponible, lo pasa a Operativo.
 * Si lo tenía otra persona, esta lo deja de tener en el mismo guardado
 * (un equipo tiene un solo responsable).
 */
export async function asignarEquipo(dispositivoId: string, personaId: string, motivo = ''): Promise<void> {
  const [dispositivo, persona] = await Promise.all([equipoVivo(dispositivoId), personaViva(personaId)])
  await guardarRegistro(
    'dispositivos',
    { ...dispositivo, responsableId: persona.id, responsable: persona.nombre, estado: estadoAlAsignar(dispositivo.estado) },
    motivo,
  )
}

/**
 * Deja el equipo sin responsable. El nombre anterior NO se queda como
 * responsable actual (sección 4 del encargo): solo vive en el historial.
 * `marcarDisponible` lo decide quien llama (ver `sugerirDisponible`).
 */
export async function liberarEquipo(
  dispositivoId: string,
  opciones: { marcarDisponible: boolean; motivo?: string },
): Promise<void> {
  const dispositivo = await equipoVivo(dispositivoId)
  await guardarRegistro(
    'dispositivos',
    {
      ...dispositivo,
      responsableId: null,
      responsable: '',
      estado: opciones.marcarDisponible ? 'Disponible' : dispositivo.estado,
    },
    opciones.motivo ?? '',
  )
}

/**
 * La baja de un equipo: queda "De baja" y sin responsable, en el mismo
 * guardado. Es lo que confirma la pantalla de baja y el final de un
 * reemplazo. Antes de la tarea 266 la baja no soltaba al responsable, y
 * el equipo retirado seguía siendo "equipo actual" de su persona.
 *
 * No comprueba dependencias: eso lo hace la pantalla de baja (que obliga
 * a resolverlas una por una) o `retirarPersona` (que solo la aplica
 * cuando no queda ninguna).
 */
export async function darDeBajaEquipo(dispositivoId: string, motivo = ''): Promise<void> {
  const dispositivo = await equipoVivo(dispositivoId)
  await guardarRegistro('dispositivos', { ...dispositivo, estado: 'De baja', responsableId: null, responsable: '' }, motivo)
}

// ----------------------------------------------------------------
// Retirar y reactivar a una persona
// ----------------------------------------------------------------

/** Lo que el técnico decidió para UNO de los equipos de quien se retira. */
export type DecisionEquipo =
  | { dispositivoId: string; tipo: 'liberar'; marcarDisponible: boolean }
  | { dispositivoId: string; tipo: 'reasignar'; personaId: string }
  | { dispositivoId: string; tipo: 'baja' }

export interface DatosRetiro {
  /** "YYYY-MM-DD". */
  fechaRetiro: string
  motivoRetiro: string
}

export interface ResultadoRetiro {
  /**
   * Equipos marcados para dar de baja que tienen conexiones, credenciales
   * o datos protegidos sin resolver: quedan sin responsable, pero la baja
   * se completa en su pantalla (el flujo existente, que obliga a resolver
   * cada dependencia). Nunca se dejan huérfanas en silencio.
   */
  bajasPendientes: string[]
}

export function motivoDeRetiro(nombre: string, motivoRetiro: string): string {
  const motivo = motivoRetiro.trim()
  return motivo ? `Retiro de ${nombre}: ${motivo}` : `Retiro de ${nombre}`
}

/**
 * Retira a la persona (sección 4 del encargo): primero resuelve cada
 * equipo como decidió el técnico y AL FINAL cambia su estado. Si algo
 * interrumpe a mitad de camino, la persona sigue activa con los equipos
 * que faltan, y volver a "Retirar" retoma donde quedó; al revés quedaría
 * retirada con equipos a su nombre.
 *
 * Un equipo sin decisión conserva su asignación (la pantalla exige una
 * por equipo; aquí no se inventa ninguna).
 */
export async function retirarPersona(
  personaId: string,
  datos: DatosRetiro,
  decisiones: DecisionEquipo[],
): Promise<ResultadoRetiro> {
  const persona = await personaViva(personaId)
  const motivo = motivoDeRetiro(persona.nombre, datos.motivoRetiro)
  const bajasPendientes: string[] = []

  for (const decision of decisiones) {
    if (decision.tipo === 'liberar') {
      await liberarEquipo(decision.dispositivoId, { marcarDisponible: decision.marcarDisponible, motivo })
    } else if (decision.tipo === 'reasignar') {
      await asignarEquipo(decision.dispositivoId, decision.personaId, motivo)
    } else {
      const [conexiones, credenciales, camposProtegidos] = await Promise.all([
        db.conexiones.toArray(),
        db.credenciales.toArray(),
        db.campos_protegidos.toArray(),
      ])
      const dependencias = dependenciasDeBaja(decision.dispositivoId, { conexiones, credenciales, camposProtegidos })
      if (sinDependencias(dependencias)) {
        await darDeBajaEquipo(decision.dispositivoId, motivo)
      } else {
        await liberarEquipo(decision.dispositivoId, { marcarDisponible: false, motivo })
        bajasPendientes.push(decision.dispositivoId)
      }
    }
  }

  const actualizada = await personaViva(personaId)
  await guardarRegistro(
    'personas',
    { ...actualizada, estado: 'retirada', fechaRetiro: datos.fechaRetiro, motivoRetiro: datos.motivoRetiro.trim() },
    datos.motivoRetiro.trim(),
  )
  return { bajasPendientes }
}

/**
 * Deshace un retiro (alguien que vuelve, o un retiro por error). Los
 * datos del retiro se vacían en la ficha, pero siguen en su historial.
 * No le devuelve ningún equipo: eso es una asignación nueva.
 */
export async function reactivarPersona(personaId: string, motivo = ''): Promise<void> {
  const persona = await personaViva(personaId)
  await guardarRegistro('personas', { ...persona, estado: 'activa', fechaRetiro: null, motivoRetiro: '' }, motivo)
}
