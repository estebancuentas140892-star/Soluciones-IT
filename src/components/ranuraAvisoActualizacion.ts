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
//
// FUERA DE UNA GUÍA, EL CHASIS (tarea 274). En las pantallas normales la
// pastilla flotaba sobre el contenido y, al final de Resolver, tapaba los
// accesos rápidos. El chasis publica también su hueco, una franja pegajosa
// sobre las pestañas, con menos rango que el de una barra de acciones de
// la pantalla (la de una guía, o la de la ficha de un equipo, que se pega
// a la misma altura que la franja): si los dos existen, manda la barra,
// que es donde se trabaja, y la franja queda vacía.

type Lugar = 'barra' | 'chasis'

let huecos: { elemento: HTMLElement; lugar: Lugar }[] = []
const suscriptores = new Set<() => void>()

function avisar(): void {
  for (const escucha of suscriptores) escucha()
}

function suscribir(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

function huecoActual(): HTMLElement | null {
  const deBarra = huecos.findLast((hueco) => hueco.lugar === 'barra')
  return (deBarra ?? huecos.at(-1))?.elemento ?? null
}

function registrar(elemento: HTMLElement | null, lugar: Lugar): (() => void) | undefined {
  if (!elemento) return undefined
  const nuevo = { elemento, lugar }
  huecos = [...huecos, nuevo]
  avisar()
  return () => {
    huecos = huecos.filter((hueco) => hueco !== nuevo)
    avisar()
  }
}

/**
 * `ref` del hueco, en una barra de acciones de la pantalla (la de una guía
 * en curso, la de la ficha de un equipo). Es una función fija y no una
 * flecha en el JSX, para que React la llame una vez al montar el hueco y
 * su limpieza una vez al quitarlo.
 */
export function huecoAvisoActualizacion(elemento: HTMLElement | null): (() => void) | undefined {
  return registrar(elemento, 'barra')
}

/** `ref` de la franja del chasis, para las pantallas normales (tarea 274). */
export function huecoAvisoActualizacionChasis(elemento: HTMLElement | null): (() => void) | undefined {
  return registrar(elemento, 'chasis')
}

/**
 * Dónde pintar el aviso: el hueco de una barra de acciones, si no la
 * franja del chasis, o null donde no hay ninguno (el inicio de sesión, una
 * tarea que no es una guía), y entonces flota como siempre.
 */
export function useHuecoAvisoActualizacion(): HTMLElement | null {
  return useSyncExternalStore(suscribir, huecoActual, () => null)
}
