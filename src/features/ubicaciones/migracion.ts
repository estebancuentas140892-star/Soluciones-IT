import type { Dispositivo, Ubicacion } from '../../lib/db'

// Migracion asistida de ubicaciones (grupo N3). Antes la ubicacion era
// texto libre en cada dispositivo (grieta 1 de PROPUESTA_BASE_CONOCIMIENTO.md):
// "Taquilla Norte", "taquilla norte" y "Taq. Norte" eran tres lugares
// distintos. Esta logica pura (sin React ni base local, con pruebas)
// prepara el paso a la entidad `ubicaciones`: agrupa los textos
// existentes, deja fusionarlos y produce la lista de ubicaciones a crear
// junto con la asignacion de cada dispositivo. La pantalla
// `MigracionUbicaciones.tsx` la envuelve con el guardado real.
//
// DOS CLASES DE PARECIDO (tarea 267, seccion 11 del encargo del
// 2026-09-23), y solo una se aplica sola:
//
//   - EQUIVALENCIA SEGURA: los textos solo difieren en mayusculas o en
//     espacios ("LOGISTICA" y "Logistica"). Se agrupan de entrada: son
//     el mismo texto escrito de dos maneras.
//   - POSIBLE COINCIDENCIA: se parecen, pero decir que son el mismo
//     lugar es una deduccion ("ADMINISTRACION PN" y "Administracion
//     Parque Norte", "Tesoreria" y "Tesorería", una letra cambiada). Se
//     SEÑALAN y el tecnico confirma; nunca se unen solas.
//
// Y un texto que ya coincide (con equivalencia segura) con una ubicacion
// que existe se vincula a ella en vez de crear otra con el mismo nombre.

// Solo los dispositivos que necesitan migrar: no eliminados, con un
// texto de ubicacion no vacio y todavia sin `ubicacionId`. Los que ya
// estan vinculados a una ubicacion no se vuelven a tocar (la migracion
// es idempotente: correrla otra vez no duplica nada).
type DispositivoMigrable = Pick<Dispositivo, 'id' | 'ubicacion' | 'ubicacionId' | 'eliminadoEn'>

type UbicacionExistente = Pick<Ubicacion, 'id' | 'nombre' | 'eliminadoEn'>

// Clave de comparacion de dos textos de ubicacion: sin distinguir
// mayusculas ni espacios de sobra, para que "Taquilla Norte" y
// "taquilla  norte" caigan en el mismo grupo. Es la EQUIVALENCIA SEGURA:
// conserva las tildes a proposito (ver `coincidenciaDeUbicacion`).
export function claveUbicacion(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLowerCase()
}

function necesitaMigrar(d: DispositivoMigrable): boolean {
  return !d.eliminadoEn && !d.ubicacionId && d.ubicacion.trim() !== ''
}

export interface TextoUbicacion {
  // Forma canonica del texto (la primera vista, ya recortada): la que
  // se propone como nombre de la ubicacion nueva.
  texto: string
  // Cuantos dispositivos usan este texto (sin distinguir mayusculas).
  cantidad: number
  // Las formas distintas en que aparece ("LOGISTICA", "Logistica"),
  // para que la pantalla ENSEÑE la equivalencia segura que aplico en vez
  // de hacerla en silencio. Una sola forma si todos lo escriben igual.
  variantes: string[]
}

// Textos de ubicacion distintos entre los dispositivos que aun no tienen
// `ubicacionId`, con cuantos equipos usa cada uno. Deduplica sin
// distinguir mayusculas (conserva la primera forma vista) y ordena
// alfabeticamente para una lista estable.
export function textosSinUbicacion(dispositivos: DispositivoMigrable[]): TextoUbicacion[] {
  const porClave = new Map<string, TextoUbicacion>()
  for (const d of dispositivos) {
    if (!necesitaMigrar(d)) continue
    const limpio = d.ubicacion.trim().replace(/\s+/g, ' ')
    const clave = claveUbicacion(limpio)
    const existente = porClave.get(clave)
    if (existente) {
      existente.cantidad += 1
      if (!existente.variantes.includes(limpio)) existente.variantes.push(limpio)
    } else {
      porClave.set(clave, { texto: limpio, cantidad: 1, variantes: [limpio] })
    }
  }
  return [...porClave.values()].sort((a, b) =>
    a.texto.localeCompare(b.texto, 'es', { numeric: true, sensitivity: 'base' }),
  )
}

// ----------------------------------------------------------------
// Posibles coincidencias (se señalan, no se aplican)
// ----------------------------------------------------------------

export type TipoCoincidencia = 'tildes' | 'abreviatura' | 'escritura'

export const MOTIVO_COINCIDENCIA: Record<TipoCoincidencia, string> = {
  tildes: 'solo cambian las tildes',
  abreviatura: 'uno parece abreviatura del otro',
  escritura: 'se escriben casi igual',
}

// Palabras que no distinguen un lugar de otro ("Administracion DE
// Parque Norte" y "Administracion Parque Norte").
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e'])

function sinTildes(texto: string): string {
  return claveUbicacion(texto).normalize('NFD').replace(/\p{M}/gu, '')
}

function palabras(texto: string): string[] {
  return sinTildes(texto)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((p) => p !== '' && !PALABRAS_VACIAS.has(p))
}

// ¿Se puede leer `corta` como abreviatura de `larga`, palabra por
// palabra? Una palabra de `corta` casa con: la misma palabra de `larga`,
// las iniciales de dos o mas palabras seguidas ("pn" = "parque norte"),
// o el comienzo de una palabra de al menos 3 letras ("adm" =
// "administracion"). Hace falta al menos una abreviatura real: dos
// listas iguales no son "abreviatura".
function esAbreviatura(corta: string[], larga: string[]): boolean {
  let i = 0
  let j = 0
  let abrevio = false
  while (i < corta.length && j < larga.length) {
    const palabra = corta[i]
    if (palabra === larga[j]) {
      i += 1
      j += 1
      continue
    }
    const k = palabra.length
    if (k >= 2 && j + k <= larga.length && [...palabra].every((letra, m) => larga[j + m].startsWith(letra))) {
      i += 1
      j += k
      abrevio = true
      continue
    }
    if (k >= 3 && larga[j].length > k && larga[j].startsWith(palabra)) {
      i += 1
      j += 1
      abrevio = true
      continue
    }
    return false
  }
  return abrevio && i === corta.length && j === larga.length
}

function distanciaEdicion(a: string, b: string): number {
  const previa = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previa[0]
    previa[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const arriba = previa[j]
      previa[j] = Math.min(previa[j] + 1, previa[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = arriba
    }
  }
  return previa[b.length]
}

/**
 * Si dos textos de ubicacion PODRIAN ser el mismo lugar, y por que; null
 * si no se parecen o si son equivalentes de forma segura (misma clave:
 * esos ya van juntos y no hay nada que preguntar).
 */
export function coincidenciaDeUbicacion(a: string, b: string): TipoCoincidencia | null {
  if (claveUbicacion(a) === claveUbicacion(b)) return null
  const planoA = sinTildes(a)
  const planoB = sinTildes(b)
  if (planoA === planoB) return 'tildes'
  const pa = palabras(a)
  const pb = palabras(b)
  if (pa.length > 0 && pb.length > 0 && (esAbreviatura(pa, pb) || esAbreviatura(pb, pa))) return 'abreviatura'
  const juntoA = pa.join(' ')
  const juntoB = pb.join(' ')
  if (juntoA === juntoB) return 'escritura'
  // Una o dos letras de diferencia en nombres de cierta longitud: un
  // error de tecleo ("Mantenimeinto"). En nombres cortos dos letras ya
  // son otra palabra ("Sala 1" y "Sala 2" son dos salas).
  const minimo = Math.min(juntoA.length, juntoB.length)
  const maximoCambios = minimo >= 10 ? 2 : minimo >= 6 ? 1 : 0
  if (maximoCambios > 0 && !/\d/.test(juntoA + juntoB) && distanciaEdicion(juntoA, juntoB) <= maximoCambios) {
    return 'escritura'
  }
  return null
}

/** Con qué se parece un texto: otro texto pendiente o una ubicación que ya existe. */
export type ObjetivoCoincidencia =
  | { tipo: 'texto'; clave: string; texto: string }
  | { tipo: 'ubicacion'; id: string; nombre: string }

export interface PosibleCoincidencia {
  /** Clave (`claveUbicacion`) del texto pendiente al que se le pregunta. */
  clave: string
  con: ObjetivoCoincidencia
  motivo: TipoCoincidencia
}

/**
 * Las posibles coincidencias de cada texto pendiente, con las ubicaciones
 * que ya existen primero (unirse a una que ya existe no crea nada) y con
 * los demas textos despues. Cada par de textos se señala UNA vez, en el
 * texto con menos equipos (lo habitual es que la variante rara se una a
 * la comun, no al reves).
 */
export function posiblesCoincidencias(
  textos: TextoUbicacion[],
  existentes: UbicacionExistente[] = [],
): PosibleCoincidencia[] {
  const vivas = existentes.filter((u) => !u.eliminadoEn)
  const resultado: PosibleCoincidencia[] = []
  for (const t of textos) {
    const clave = claveUbicacion(t.texto)
    // Si ya coincide con una existente de forma segura, se vincula a ella
    // sin preguntar nada.
    if (vivas.some((u) => claveUbicacion(u.nombre) === clave)) continue
    for (const u of vivas) {
      const motivo = coincidenciaDeUbicacion(t.texto, u.nombre)
      if (motivo) resultado.push({ clave, con: { tipo: 'ubicacion', id: u.id, nombre: u.nombre }, motivo })
    }
  }
  for (let i = 0; i < textos.length; i += 1) {
    for (let j = i + 1; j < textos.length; j += 1) {
      const a = textos[i]
      const b = textos[j]
      const motivo = coincidenciaDeUbicacion(a.texto, b.texto)
      if (!motivo) continue
      // Se le pregunta al de menos equipos; a igualdad, al segundo.
      const [pregunta, destino] = a.cantidad < b.cantidad ? [a, b] : [b, a]
      resultado.push({
        clave: claveUbicacion(pregunta.texto),
        con: { tipo: 'texto', clave: claveUbicacion(destino.texto), texto: destino.texto },
        motivo,
      })
    }
  }
  return resultado
}

// ----------------------------------------------------------------
// Plan y resultado
// ----------------------------------------------------------------

// Un grupo de la migracion: una ubicacion a crear con su nombre final y
// las claves de los textos originales que se fusionan en ella. El `id`
// lo asigna la pantalla (sera el id de la fila `ubicaciones`), asi la
// logica pura no depende de crypto.
export interface GrupoMigracion {
  id: string
  nombre: string
  claves: string[]
}

// Plan inicial: un grupo por cada texto distinto (sin fusiones). La
// pantalla puede luego fusionar grupos o renombrarlos antes de aplicar.
// El `idFactory` lo provee quien llama (la pantalla usa crypto.randomUUID)
// para que esta funcion siga siendo pura y testeable.
export function planInicial(
  textos: TextoUbicacion[],
  idFactory: () => string,
): GrupoMigracion[] {
  return textos.map((t) => ({ id: idFactory(), nombre: t.texto, claves: [claveUbicacion(t.texto)] }))
}

export interface UbicacionNueva {
  id: string
  nombre: string
}

export interface AsignacionUbicacion {
  dispositivoId: string
  ubicacionId: string
  // Nombre canonico de la ubicacion, que pasa a ser la copia de
  // referencia `ubicacion` del dispositivo (misma regla que el resto de
  // vinculos: id canonico + copia del nombre).
  nombre: string
}

export interface ResultadoMigracion {
  ubicaciones: UbicacionNueva[]
  asignaciones: AsignacionUbicacion[]
  // Ubicaciones que YA existian y reciben equipos (por nombre igual, con
  // equivalencia segura), en vez de crear otra con el mismo nombre.
  existentesUsadas: UbicacionNueva[]
}

/**
 * La ubicacion existente con ese nombre (equivalencia segura), o null si
 * no hay ninguna. Si hay MAS de una con el mismo nombre (dos "Taquillas"
 * en sedes distintas), no se elige ninguna: seria adivinar cual es.
 */
export function existenteConNombre(nombre: string, existentes: UbicacionExistente[]): UbicacionExistente | null {
  const clave = claveUbicacion(nombre)
  const iguales = existentes.filter((u) => !u.eliminadoEn && claveUbicacion(u.nombre) === clave)
  return iguales.length === 1 ? iguales[0] : null
}

/** ¿Hay varias ubicaciones que se llaman así? Entonces el grupo no se aplica. */
export function nombreAmbiguo(nombre: string, existentes: UbicacionExistente[]): boolean {
  const clave = claveUbicacion(nombre)
  return existentes.filter((u) => !u.eliminadoEn && claveUbicacion(u.nombre) === clave).length > 1
}

// Traduce un plan de grupos en las operaciones concretas a ejecutar:
// que ubicaciones crear y a que ubicacion queda vinculado cada
// dispositivo. Es la parte pura y testeable; la pantalla solo ejecuta el
// resultado (guardar ubicaciones + actualizar dispositivos). Se ignoran
// los grupos sin nombre (el usuario los vacio para descartarlos), los
// grupos cuyo nombre es ambiguo entre varias ubicaciones existentes y
// los dispositivos que ya no necesitan migrar. Un grupo cuyo nombre ya
// es el de una ubicacion existente reutiliza esa ubicacion.
export function construirMigracion(
  dispositivos: DispositivoMigrable[],
  grupos: GrupoMigracion[],
  existentes: UbicacionExistente[] = [],
): ResultadoMigracion {
  const gruposValidos = grupos.filter(
    (g) => g.nombre.trim() !== '' && g.claves.length > 0 && !nombreAmbiguo(g.nombre, existentes),
  )

  // Clave de texto -> grupo destino. Si dos grupos reclaman la misma
  // clave (no deberia pasar desde la pantalla), gana el primero.
  const grupoPorClave = new Map<string, GrupoMigracion>()
  for (const grupo of gruposValidos) {
    for (const clave of grupo.claves) {
      if (!grupoPorClave.has(clave)) grupoPorClave.set(clave, grupo)
    }
  }

  // Grupo -> ubicacion destino: la existente con su nombre, o el propio
  // id del grupo (una ubicacion nueva).
  const destinoDe = new Map<string, UbicacionNueva>()
  for (const grupo of gruposValidos) {
    const existente = existenteConNombre(grupo.nombre, existentes)
    destinoDe.set(
      grupo.id,
      existente ? { id: existente.id, nombre: existente.nombre } : { id: grupo.id, nombre: grupo.nombre.trim() },
    )
  }

  const asignaciones: AsignacionUbicacion[] = []
  const usados = new Set<string>()
  for (const d of dispositivos) {
    if (!necesitaMigrar(d)) continue
    const grupo = grupoPorClave.get(claveUbicacion(d.ubicacion))
    if (!grupo) continue
    const destino = destinoDe.get(grupo.id) as UbicacionNueva
    asignaciones.push({ dispositivoId: d.id, ubicacionId: destino.id, nombre: destino.nombre })
    usados.add(grupo.id)
  }

  // Solo se crean las ubicaciones que quedaron con al menos un
  // dispositivo asignado y que no existian ya.
  const ubicaciones: UbicacionNueva[] = []
  const existentesUsadas: UbicacionNueva[] = []
  for (const grupo of gruposValidos) {
    if (!usados.has(grupo.id)) continue
    const destino = destinoDe.get(grupo.id) as UbicacionNueva
    if (destino.id === grupo.id) ubicaciones.push(destino)
    else if (!existentesUsadas.some((u) => u.id === destino.id)) existentesUsadas.push(destino)
  }

  return { ubicaciones, asignaciones, existentesUsadas }
}
