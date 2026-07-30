import { useLayoutEffect } from 'react'

// Memoria de scroll por ruta (tarea 187, regla R20: "volver es volver al
// mismo sitio"). Vive en un Map de módulo, fuera de React: Chasis se
// desmonta y se vuelve a montar en cada navegación (cada pantalla monta
// el suyo), así que un estado de componente no sobreviviría de una
// pestaña a la siguiente.
const posiciones = new Map<string, number>()

export function guardarScroll(pathname: string, y: number): void {
  posiciones.set(pathname, y)
}

export function obtenerScroll(pathname: string): number | undefined {
  return posiciones.get(pathname)
}

// Restaura la posición guardada de `pathname` al montar (sin animar: es
// un salto, no una transición más) y la actualiza mientras se hace
// scroll. Se reintenta una vez tras dos fotogramas por si el contenido
// todavía era corto en el primer render (los datos de Dexie llegan un
// instante después del montaje inicial), y una última vez al desmontar,
// por si el usuario navega antes de que el siguiente scroll dispare.
export function useMemoriaScroll(pathname: string): void {
  useLayoutEffect(() => {
    function restaurar() {
      window.scrollTo({ top: obtenerScroll(pathname) ?? 0, behavior: 'auto' })
    }
    restaurar()
    const id = requestAnimationFrame(() => requestAnimationFrame(restaurar))

    let pendiente = false
    function alDesplazar() {
      if (pendiente) return
      pendiente = true
      requestAnimationFrame(() => {
        guardarScroll(pathname, window.scrollY)
        pendiente = false
      })
    }
    window.addEventListener('scroll', alDesplazar, { passive: true })

    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('scroll', alDesplazar)
      guardarScroll(pathname, window.scrollY)
    }
  }, [pathname])
}
