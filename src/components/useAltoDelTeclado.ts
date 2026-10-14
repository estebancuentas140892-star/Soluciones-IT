import { useEffect, useState } from 'react'

/**
 * Cuánto tapa el teclado la parte de abajo de la pantalla, en px (0 si nada),
 * según `visualViewport` (rediseño móvil "1b Pulgar", tarea 330). En iOS el
 * teclado no encoge la página y tapa lo que esté pegado abajo; con esta medida
 * se pega encima. Donde el navegador ya encoge la página, vale 0. Sin
 * `visualViewport`, también 0.
 */
export function useAltoDelTeclado(): number {
  const [alto, setAlto] = useState(0)
  useEffect(() => {
    const vista = window.visualViewport
    if (!vista) return
    const ventana = vista
    function medir() {
      setAlto(Math.max(0, Math.round(window.innerHeight - ventana.height - ventana.offsetTop)))
    }
    medir()
    ventana.addEventListener('resize', medir)
    ventana.addEventListener('scroll', medir)
    return () => {
      ventana.removeEventListener('resize', medir)
      ventana.removeEventListener('scroll', medir)
    }
  }, [])
  return alto
}
