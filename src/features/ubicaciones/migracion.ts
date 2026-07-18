import type { Dispositivo } from '../../lib/db'

// Migracion asistida de ubicaciones (grupo N3). Antes la ubicacion era
// texto libre en cada dispositivo (grieta 1 de PROPUESTA_BASE_CONOCIMIENTO.md):
// "Taquilla Norte", "taquilla norte" y "Taq. Norte" eran tres lugares
// distintos. Esta logica pura (sin React ni base local, con pruebas)
// prepara el paso a la entidad `ubicaciones`: agrupa los textos
// existentes, deja fusionarlos y produce la lista de ubicaciones a crear
// junto con la asignacion de cada dispositivo. La pantalla
// `MigracionUbicaciones.tsx` la envuelve con el guardado real.

// Solo los dispositivos que necesitan migrar: no eliminados, con un
// texto de ubicacion no vacio y todavia sin `ubicacionId`. Los que ya
// estan vinculados a una ubicacion no se vuelven a tocar (la migracion
// es idempotente: correrla otra vez no duplica nada).
type DispositivoMigrable = Pick<Dispositivo, 'id' | 'ubicacion' | 'ubicacionId' | 'eliminadoEn'>

// Clave de comparacion de dos textos de ubicacion: sin distinguir
// mayusculas ni espacios de sobra, para que "Taquilla Norte" y
// "taquilla  norte" caigan en el mismo grupo.
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
    if (existente) existente.cantidad += 1
    else porClave.set(clave, { texto: limpio, cantidad: 1 })
  }
  return [...porClave.values()].sort((a, b) =>
    a.texto.localeCompare(b.texto, 'es', { numeric: true, sensitivity: 'base' }),
  )
}

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
}

// Traduce un plan de grupos en las operaciones concretas a ejecutar:
// que ubicaciones crear y a que ubicacion queda vinculado cada
// dispositivo. Es la parte pura y testeable; la pantalla solo ejecuta el
// resultado (guardar ubicaciones + actualizar dispositivos). Se ignoran
// los grupos sin nombre (el usuario los vacio para descartarlos) y los
// dispositivos que ya no necesitan migrar.
export function construirMigracion(
  dispositivos: DispositivoMigrable[],
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

  const asignaciones: AsignacionUbicacion[] = []
  const usados = new Set<string>()
  for (const d of dispositivos) {
    if (!necesitaMigrar(d)) continue
    const grupo = grupoPorClave.get(claveUbicacion(d.ubicacion))
    if (!grupo) continue
    asignaciones.push({ dispositivoId: d.id, ubicacionId: grupo.id, nombre: grupo.nombre.trim() })
    usados.add(grupo.id)
  }

  // Solo se crean las ubicaciones que quedaron con al menos un
  // dispositivo asignado.
  const ubicaciones = gruposValidos
    .filter((g) => usados.has(g.id))
    .map((g) => ({ id: g.id, nombre: g.nombre.trim() }))

  return { ubicaciones, asignaciones }
}
