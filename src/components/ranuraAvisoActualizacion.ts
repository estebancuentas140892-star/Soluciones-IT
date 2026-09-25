import { useSyncExternalStore } from 'react'

// Hueco del aviso "Versión nueva disponible" dentro de la barra de
// acciones de una guía en curso (tarea 273).
//
// El aviso flota como pastilla a 80 px del borde (`bottom-20`), justo
// encima de la barra inferior del chasis. Pero la ejecución de una guía
// no tiene esa barra: tiene la suya, pegajosa y más alta (la acción
// dominante, Anterior, el índice, Falla, Siguiente y "Enviar a este
// equipo"), y la pastilla quedaba ENCIMA de esos controles. Una versión
// nueva nunca debe impedir trabajar en una guía.
//
// Así que la barra de la guía publica un hueco propio y el aviso se pinta
// dentro por portal, en el flujo de la barra: como la barra es `sticky`,
// reserva su sitio, y el aviso no tapa ni los controles ni el paso. Es la
// idea de `src/app/bandaTarea.tsx`, pero sin contexto: el aviso se monta
// en la raíz de la app, fuera de la guía, así que el hueco se comparte
// con un almacén de módulo.
//
// Se guarda una pila y no un solo hueco: una guía vinculada que ocupa la
// pantalla trae su barra, y el último hueco que entra es el que vale.

let huecos: HTMLElement[] = []
const suscriptores = new Set<() => void>()

function avisar(): void {
  for (const escucha of suscriptores) escucha()
}

function suscribir(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

function huecoActual(): HTMLElement | null {
  return huecos.at(-1) ?? null
}

/**
 * `ref` del hueco, en la barra de acciones de la guía. Es una función fija
 * y no una flecha en el JSX, para que React la llame una vez al montar el
 * hueco y su limpieza una vez al quitarlo.
 */
export function huecoAvisoActualizacion(elemento: HTMLElement | null): (() => void) | undefined {
  if (!elemento) return undefined
  huecos = [...huecos, elemento]
  avisar()
  return () => {
    huecos = huecos.filter((hueco) => hueco !== elemento)
    avisar()
  }
}

/** Dónde pintar el aviso: el hueco de la guía en curso, o null fuera de ella. */
export function useHuecoAvisoActualizacion(): HTMLElement | null {
  return useSyncExternalStore(suscribir, huecoActual, () => null)
}
