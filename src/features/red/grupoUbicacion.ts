import type { Dispositivo } from '../../lib/db'
import { compararNatural } from '../../lib/conexiones'

// Agrupar los equipos de Red por su ubicación REAL (hallazgo M-019 de
// la auditoría móvil).
//
// El defecto: los grupos se formaban con `d.ubicacion`, que es texto
// libre y solo una copia de referencia. Dos escrituras del mismo sitio
// ("Rack 1" y "rack 1 ") producían dos grupos, así que el técnico no
// encontraba el equipo donde lo buscaba. El dato canónico es
// `ubicacionId`, la entidad Ubicación, y es el que manda aquí.
//
// El texto NO desaparece: sigue siendo el respaldo, y hace falta. Un
// equipo puede tener `ubicacionId` con la fila de `ubicaciones` todavía
// sin sincronizar (para eso existe la copia), y otro puede no tener id
// en absoluto, porque se registró antes de que la Ubicación fuera una
// entidad. Los dos casos tienen que agrupar bien.
//
// Nada de esto reescribe datos: es lectura. Unificar de verdad las dos
// grafías de un mismo rack es trabajo del editor, no de una lista.

export const SIN_UBICACION = 'Sin ubicación'

export interface GrupoUbicacion {
  /** Clave estable del grupo, para la `key` de React. No se muestra. */
  clave: string
  /** Nombre visible: el de la entidad, o la grafía más usada del texto. */
  nombre: string
  equipos: Dispositivo[]
  /** "1 equipo" / "N equipos", ya redactado. */
  cuenta: string
}

// Dos grafías del mismo sitio tienen que caer en la misma clave, así
// que se compara sin acentos, sin mayúsculas y sin espacios de más.
function claveDeTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// De las grafías que se vieron para un mismo grupo, la que más se
// repite. Elegir "la primera que apareció" haría que el nombre del
// grupo dependiera del orden de llegada de los datos, que cambia con
// cada sincronización.
//
// El desempate es una comparación ESTRICTA, no `compararNatural`: esa
// ignora acentos y mayúsculas a propósito (es la que agrupa), así que
// para ella "Rack 1" y "rack 1" son la misma cadena y no desempata
// nada. En la práctica el orden binario prefiere la grafía con
// mayúscula inicial, que es como lo escribiría una persona.
function grafiaDominante(cuentas: Map<string, number>): string {
  let mejor = ''
  let mejorCuenta = -1
  for (const [grafia, cuenta] of cuentas) {
    if (cuenta > mejorCuenta || (cuenta === mejorCuenta && grafia < mejor)) {
      mejor = grafia
      mejorCuenta = cuenta
    }
  }
  return mejor
}

interface Acumulado {
  clave: string
  equipos: Dispositivo[]
  /** Grafías vistas del nombre y cuántas veces, para elegir la del grupo. */
  grafias: Map<string, number>
}

/**
 * Agrupa por `ubicacionId` cuando lo hay y por el texto normalizado
 * cuando no. `nombreUbicacion` resuelve el id contra la entidad; si esa
 * fila todavía no llegó, el grupo se queda con la copia de referencia
 * que traen los propios equipos.
 *
 * Los equipos de cada grupo salen en orden natural por nombre, y el
 * grupo "Sin ubicación" siempre al final: es una tarea pendiente de
 * registro, no un sitio.
 */
export function agruparPorUbicacion(
  dispositivos: Dispositivo[],
  nombreUbicacion: Map<string, string>,
): GrupoUbicacion[] {
  const acumulados = new Map<string, Acumulado>()

  for (const dispositivo of dispositivos) {
    const texto = dispositivo.ubicacion.trim()
    const id = dispositivo.ubicacionId
    const clave = id ? `id:${id}` : texto ? `txt:${claveDeTexto(texto)}` : 'sin'

    let acumulado = acumulados.get(clave)
    if (!acumulado) {
      acumulado = { clave, equipos: [], grafias: new Map() }
      acumulados.set(clave, acumulado)
    }
    acumulado.equipos.push(dispositivo)
    if (texto) acumulado.grafias.set(texto, (acumulado.grafias.get(texto) ?? 0) + 1)
  }

  const grupos = [...acumulados.values()].map((acumulado) => {
    const id = acumulado.clave.startsWith('id:') ? acumulado.clave.slice(3) : null
    // La entidad manda sobre la copia; la copia manda sobre el vacío.
    const nombre =
      (id ? nombreUbicacion.get(id) : '') || grafiaDominante(acumulado.grafias) || SIN_UBICACION
    const equipos = [...acumulado.equipos].sort((a, b) => compararNatural(a.nombre, b.nombre))
    return {
      clave: acumulado.clave,
      nombre,
      equipos,
      cuenta: equipos.length === 1 ? '1 equipo' : `${equipos.length} equipos`,
    }
  })

  return grupos.sort((a, b) => {
    if (a.nombre === SIN_UBICACION) return 1
    if (b.nombre === SIN_UBICACION) return -1
    return compararNatural(a.nombre, b.nombre)
  })
}
