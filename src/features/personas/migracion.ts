import type { Dispositivo } from '../../lib/db'

// Migracion asistida de personas (hallazgo T1 de AUDITORIA_FLUJOS_TI.md).
// A diferencia de ubicaciones (grupo N3), "usuario asignado" nunca fue un
// campo fijo del dispositivo: vivia como una clave cualquiera, sin nombre
// consistente, dentro de la bolsa libre `detalles` ("Usuario asignado",
// "Responsable", "Asignado a"...). Esta logica pura (sin React ni base
// local, con pruebas) escanea esas claves candidatas, agrupa los valores
// repetidos y produce la lista de personas a crear junto con la
// asignacion de cada dispositivo (y que clave de `detalles` retirar al
// aplicar, para no dejar el dato duplicado). La pantalla
// `MigracionPersonas.tsx` la envuelve con el guardado real.

// Nombres de clave que un tecnico pudo haber usado para anotar el
// responsable de un equipo dentro de `detalles`. Se comparan
// normalizados (sin mayusculas ni acentos), asi "Usuario Asignado" y
// "usuario asignado" coinciden. El orden importa cuando un mismo
// dispositivo tuviera mas de una clave candidata: gana la primera.
const CLAVES_CANDIDATAS = [
  'usuario asignado',
  'responsable',
  'responsable del equipo',
  'asignado a',
  'asignado',
  'empleado',
  'encargado',
  'persona asignada',
  'usuario',
]

function normalizarClave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Clave de comparacion de dos nombres de persona: sin distinguir
// mayusculas ni espacios de sobra (mismo criterio que claveUbicacion),
// para que "Juan Perez" y "juan  perez" caigan en el mismo grupo.
export function clavePersona(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLowerCase()
}

type DispositivoMigrable = Pick<Dispositivo, 'id' | 'detalles' | 'responsableId' | 'eliminadoEn'>

// Un dispositivo que aun no tiene `responsableId` y donde se encontro
// una clave candidata con contenido dentro de `detalles`.
export interface CandidatoPersona {
  dispositivoId: string
  // Nombre EXACTO de la clave en `detalles` de ESE dispositivo (puede
  // variar de un equipo a otro: "Responsable" en uno, "Usuario asignado"
  // en otro). Se necesita tal cual para poder retirarla al migrar.
  claveDetalle: string
  texto: string
}

function detectarCandidato(d: DispositivoMigrable): CandidatoPersona | null {
  if (d.eliminadoEn || d.responsableId) return null
  for (const alias of CLAVES_CANDIDATAS) {
    for (const [claveDetalle, valor] of Object.entries(d.detalles)) {
      if (normalizarClave(claveDetalle) === alias && valor.trim() !== '') {
        return { dispositivoId: d.id, claveDetalle, texto: valor.trim() }
      }
    }
  }
  return null
}

// Candidatos de todos los dispositivos que aun no tienen responsable
// vinculado. Idempotente: un dispositivo ya migrado (con responsableId)
// no vuelve a proponerse.
export function candidatosPersona(dispositivos: DispositivoMigrable[]): CandidatoPersona[] {
  const candidatos: CandidatoPersona[] = []
  for (const d of dispositivos) {
    const candidato = detectarCandidato(d)
    if (candidato) candidatos.push(candidato)
  }
  return candidatos
}

export interface TextoPersona {
  // Forma canonica del texto (la primera vista, ya recortada): la que
  // se propone como nombre de la persona nueva.
  texto: string
  // Cuantos dispositivos usan este texto (sin distinguir mayusculas).
  cantidad: number
}

// Textos de persona distintos entre los candidatos, con cuantos equipos
// usa cada uno. Deduplica sin distinguir mayusculas (conserva la primera
// forma vista) y ordena alfabeticamente para una lista estable.
export function textosSinPersona(candidatos: CandidatoPersona[]): TextoPersona[] {
  const porClave = new Map<string, TextoPersona>()
  for (const candidato of candidatos) {
    const clave = clavePersona(candidato.texto)
    const existente = porClave.get(clave)
    if (existente) existente.cantidad += 1
    else porClave.set(clave, { texto: candidato.texto, cantidad: 1 })
  }
  return [...porClave.values()].sort((a, b) =>
    a.texto.localeCompare(b.texto, 'es', { numeric: true, sensitivity: 'base' }),
  )
}

// Un grupo de la migracion: una persona a crear con su nombre final y
// las claves de los textos originales que se fusionan en ella. El `id`
// lo asigna la pantalla (sera el id de la fila `personas`), asi la
// logica pura no depende de crypto.
export interface GrupoMigracion {
  id: string
  nombre: string
  claves: string[]
}

export interface PersonaNueva {
  id: string
  nombre: string
}

export interface AsignacionPersona {
  dispositivoId: string
  personaId: string
  // Nombre canonico de la persona, que pasa a ser la copia de
  // referencia `responsable` del dispositivo (misma regla que el resto
  // de vinculos: id canonico + copia del nombre).
  nombre: string
  // Clave exacta a retirar de `detalles` de ESE dispositivo al aplicar,
  // para no dejar el dato duplicado en dos lugares.
  claveDetalle: string
}

export interface ResultadoMigracion {
  personas: PersonaNueva[]
  asignaciones: AsignacionPersona[]
}

// Traduce un plan de grupos en las operaciones concretas a ejecutar: que
// personas crear y a que persona queda vinculado cada dispositivo (mas
// la clave de `detalles` a retirar). Es la parte pura y testeable; la
// pantalla solo ejecuta el resultado (guardar personas + actualizar
// dispositivos). Se ignoran los grupos sin nombre (el usuario los vacio
// para descartarlos).
export function construirMigracion(
  candidatos: CandidatoPersona[],
  grupos: GrupoMigracion[],
): ResultadoMigracion {
  const gruposValidos = grupos.filter((g) => g.nombre.trim() !== '' && g.claves.length > 0)

  // Clave de texto -> grupo destino. Si dos grupos reclaman la misma
  // clave (no deberia pasar desde la pantalla), gana el primero.
  const grupoPorClave = new Map<string, GrupoMigracion>()
  for (const grupo of gruposValidos) {
    for (const clave of grupo.claves) {
      if (!grupoPorClave.has(clave)) grupoPorClave.set(clave, grupo)
    }
  }

  const asignaciones: AsignacionPersona[] = []
  const usados = new Set<string>()
  for (const candidato of candidatos) {
    const grupo = grupoPorClave.get(clavePersona(candidato.texto))
    if (!grupo) continue
    asignaciones.push({
      dispositivoId: candidato.dispositivoId,
      personaId: grupo.id,
      nombre: grupo.nombre.trim(),
      claveDetalle: candidato.claveDetalle,
    })
    usados.add(grupo.id)
  }

  // Solo se crean las personas que quedaron con al menos un dispositivo
  // asignado.
  const personas = gruposValidos
    .filter((g) => usados.has(g.id))
    .map((g) => ({ id: g.id, nombre: g.nombre.trim() }))

  return { personas, asignaciones }
}
