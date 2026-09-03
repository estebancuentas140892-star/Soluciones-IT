import type { PasoProcedimiento, VinculoProtegido } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'

// LO QUE EL MODO FOCO RECORRE (tarea 217, hallazgo G-18).
//
// Hasta ahora el foco solo se montaba si el paso tenia tareas: un paso
// sin ellas expulsaba al tecnico a la vista completa a mitad de
// procedimiento, sin explicacion y sin forma de volver hasta el paso
// siguiente. Con el foco convertido en la ejecucion por defecto eso
// deja de ser un hueco cosmetico y pasa a romper el modo, asi que el
// paso sin tareas se presenta como UNA sola tarea: su titulo, a los
// mismos 30 px, y marcarla completa el paso.
//
// La decision vive aqui, fuera del componente, porque es la regla que
// hay que poder probar: que un paso sin tareas nunca devuelva una lista
// vacia, y que el boton grande sepa si esta marcando una tarea o
// cerrando el paso.

export interface TareaFoco {
  id: string
  texto: string
  // true solo en el paso sin tareas: no hay bloque que marcar, asi que
  // el boton grande completa el paso directamente.
  esPasoEntero: boolean
  vinculoProtegido: VinculoProtegido | null
}

// El titulo llega ya resuelto por quien llama (`paso.titulo` puede
// estar vacio y caer en el del subarticulo o en "Paso N"), para no
// duplicar aqui esa cadena de respaldos.
export function tareasParaFoco(paso: PasoProcedimiento, tituloPaso: string): TareaFoco[] {
  const tareas = tareasDe(paso.bloques)
  if (tareas.length > 0) {
    return tareas.map((t) => ({
      id: t.id,
      texto: t.texto,
      esPasoEntero: false,
      vinculoProtegido: t.vinculoProtegido ?? paso.vinculoProtegido,
    }))
  }
  return [
    {
      id: `paso:${paso.id}`,
      texto: tituloPaso,
      esPasoEntero: true,
      vinculoProtegido: paso.vinculoProtegido,
    },
  ]
}

// Que hace el boton grande del foco. `marcar` mientras queden tareas
// del paso sin hacer; `completar` cuando ya no queda ninguna, que es
// cuando el gesto siguiente es cerrar el paso y pasar al que sigue.
// El paso sin tareas es `completar` desde el principio: no hay nada
// intermedio que marcar.
export type AccionFoco = 'marcar' | 'completar'

export function accionFoco(tareas: TareaFoco[], hechas: ReadonlySet<string>): AccionFoco {
  if (tareas.length === 1 && tareas[0].esPasoEntero) return 'completar'
  return tareas.every((t) => hechas.has(t.id)) ? 'completar' : 'marcar'
}
