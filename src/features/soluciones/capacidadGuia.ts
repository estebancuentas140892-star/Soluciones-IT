import type { Articulo } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'

// Qué puede hacer una guía POR TI, para decirlo en su fila del listado
// (handoff "Diseño móvil", tablero 3b).
//
// El hallazgo que cierra: la app ya calcula la completitud de una guía
// (`completitudArticulo.ts`), pero **ese dato solo vive en el editor**.
// En el listado, `FilaArticulo` pintaba la misma fila para una guía de 7
// pasos con verificación final y para un borrador sin un solo paso:
// mismo recuadro, misma línea `categoría · tipo · min`. El técnico
// descubría que la guía estaba vacía **después de abrirla**, de pie y
// frente al equipo.
//
// Es una lectura distinta de la del editor a propósito. El editor mide
// "cuánto te falta para publicarla" (diez señales, porcentaje,
// sugerencias); esto responde "¿me sirve ahora mismo?", que es lo que se
// pregunta en el listado. Por eso no reutiliza `senalesDeArticulo`: son
// dos preguntas, no dos vistas de la misma.
//
// Lógica pura y sin consultas: todo sale de `procedimiento`, que la fila
// ya tenía a mano.

export interface CapacidadGuia {
  // ¿Se puede tocar "Ejecutar"? Falso para un manual o un borrador sin
  // pasos. Su ausencia en la fila ES la señal de que no hay
  // procedimiento; no hace falta un cartel que lo diga.
  ejecutable: boolean
  pasos: number
  // Estimado del artículo, si lo declara. No se inventa uno.
  minutos: number | null
  // Tiene checklist de cierre, que es lo que distingue una guía que
  // confirma su resultado de una que solo enumera pasos.
  tieneVerificacion: boolean
}

export function capacidadDeGuia(articulo: Articulo): CapacidadGuia {
  const procedimiento = normalizarProcedimiento(articulo.procedimiento)
  return {
    ejecutable: procedimientoEjecutable(procedimiento),
    pasos: procedimiento?.pasos.length ?? 0,
    minutos: procedimiento?.tiempoEstimadoMin ?? null,
    tieneVerificacion: (procedimiento?.verificacionFinal.length ?? 0) > 0,
  }
}

// Los trozos de la línea de capacidad, en orden, ya redactados. Se
// devuelven sueltos y no como una sola cadena porque el último ("no se
// puede ejecutar") y el primero de una guía vacía se pintan en ámbar,
// y el resto en neutro: la fila necesita saber cuál es cuál.
export interface LineaCapacidad {
  // "7 pasos", o "Sin pasos" cuando no hay procedimiento.
  pasos: string
  // "~25 min", o null si el artículo no declara tiempo estimado.
  minutos: string | null
  // "verificación" solo si la tiene; es una promesa, no un relleno.
  verificacion: boolean
  // Lo que explica por qué esta guía no ofrece "Ejecutar". Solo cuando
  // no es ejecutable.
  aviso: string | null
}

export function lineaDeCapacidad(capacidad: CapacidadGuia): LineaCapacidad {
  if (!capacidad.ejecutable) {
    return {
      pasos: 'Sin pasos',
      minutos: null,
      verificacion: false,
      // "solo notas" dice lo que SÍ hay, no solo lo que falta: un manual
      // sin pasos no está incompleto, es de otra clase.
      aviso: 'solo notas · no se puede ejecutar',
    }
  }
  return {
    pasos: `${capacidad.pasos} ${capacidad.pasos === 1 ? 'paso' : 'pasos'}`,
    minutos: capacidad.minutos == null ? null : `~${capacidad.minutos} min`,
    verificacion: capacidad.tieneVerificacion,
    aviso: null,
  }
}
