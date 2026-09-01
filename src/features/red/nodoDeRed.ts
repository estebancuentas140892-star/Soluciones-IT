import { contarDescendientes, type NodoTopologia } from './arbol'

// Qué nodo abre la pestaña Red (hallazgo M-018 de la auditoría móvil).
//
// Red abría con una lista de equipos: el mismo buscador, los mismos
// grupos y la misma fila que Equipos. La sección que existe para
// explicar dependencias no las mostraba en su primera pantalla, y la
// que sí lo hacía (la topología de un equipo) estaba a tres toques.
//
// Ahora la pestaña abre con UN NODO y su vecindad. Cuál, en orden:
//
// 1. El que se estaba recorriendo, que viaja en `/red?nodo=<id>` y lo
//    repone la memoria de pestaña que ya existía (`memoriaPestana.ts`,
//    tarea 187). Sin persistencia nueva: el nodo es el "filtro" de esta
//    pestaña, igual que el texto de búsqueda lo es de Guías.
// 2. Si no hay memoria, o el equipo recordado se borró, la raíz del
//    bosque con MÁS equipos colgando. Es el nodo del que depende más
//    gente: el rack o el switch de núcleo. Abrir por ahí es abrir por
//    donde empiezan casi todos los recorridos.
// 3. Si no hay ninguna raíz, null, y la pantalla dice que todavía no
//    hay nada conectado.

/**
 * El nodo con el que abre la pestaña. `pedido` es el `?nodo=` de la URL
 * (o null); se respeta solo si ese equipo sigue estando en el bosque,
 * para que un enlace viejo a un equipo borrado no deje la pantalla en
 * blanco.
 */
export function nodoInicial(pedido: string | null, bosque: NodoTopologia[]): string | null {
  if (pedido && contiene(bosque, pedido)) return pedido
  return raizPrincipal(bosque)
}

/**
 * La raíz del bosque con más descendientes. A igualdad manda el orden en
 * que viene el bosque, que `construirBosque` ya deja en orden natural
 * por nombre: así el nodo de entrada no cambia entre recargas.
 */
export function raizPrincipal(bosque: NodoTopologia[]): string | null {
  let mejor: NodoTopologia | null = null
  let mejorCuenta = -1
  for (const raiz of bosque) {
    const cuenta = contarDescendientes(raiz)
    if (cuenta > mejorCuenta) {
      mejor = raiz
      mejorCuenta = cuenta
    }
  }
  return mejor?.dispositivoId ?? null
}

/**
 * ¿Está este equipo en algún punto del bosque? Se busca en TODO el
 * árbol, no solo en las raíces: el nodo recordado casi siempre es un
 * equipo intermedio al que se llegó recorriendo.
 */
export function contiene(bosque: NodoTopologia[], dispositivoId: string): boolean {
  const pendientes = [...bosque]
  // Recorrido iterativo: un ciclo mal registrado no puede reventar la
  // pila, y `construirArbol` ya corta los ciclos con su set de
  // visitados, así que la lista termina.
  while (pendientes.length > 0) {
    const nodo = pendientes.pop()
    if (!nodo) break
    if (nodo.dispositivoId === dispositivoId) return true
    pendientes.push(...nodo.hijos)
  }
  return false
}
