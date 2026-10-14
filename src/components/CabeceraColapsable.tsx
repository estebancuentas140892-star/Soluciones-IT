import { useEffect, useRef, useState } from 'react'

// Cuánto hay que desplazarse para contar como "ya está leyendo". Bajo a
// propósito: el mockup lo dibuja como "desplazado", no como un umbral
// que tarde en notarse.
const UMBRAL_PX = 12

// Cabecera colapsable de la barra superior (tarea 187, mockup `4e`): el
// nombre de la sección pasa de 21 a 14 px en cuanto el técnico empieza a
// desplazarse, sin desaparecer nunca de pantalla (la orientación no debe
// depender solo de la pestaña iluminada, a 700 px de distancia en
// escritorio y a 10,5 px de tamaño).
//
// `forzarContraida` lo deja a 14 px sin desplazamiento: Resolver mientras
// se escribe (propuesta final de Claude Design, 2026-10-01). La misma
// transición de 150 ms, así que plegar y desplazar se ven igual.
export function CabeceraColapsable({ titulo, forzarContraida = false }: { titulo: string; forzarContraida?: boolean }) {
  const [desplazada, setContraida] = useState(false)
  const contraida = desplazada || forzarContraida
  const pendiente = useRef(false)

  useEffect(() => {
    function alDesplazar() {
      if (pendiente.current) return
      pendiente.current = true
      requestAnimationFrame(() => {
        setContraida(window.scrollY > UMBRAL_PX)
        pendiente.current = false
      })
    }
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [])

  return (
    <h1
      // 25 px y 650 en reposo desde el rediseño móvil "1b Pulgar" (tarea 330):
      // la cabecera de raíz es una sola fila, título, sincronización y cuenta.
      // Desde 768 px, los 21 px y el 500 de antes (tarea 338).
      className={`min-w-0 truncate leading-[1.15] transition-[font-size] duration-150 motion-reduce:transition-none md:leading-[1.2] ${
        contraida
          ? 'text-[14px] font-medium'
          : 'text-[25px] font-[650] tracking-[-.02em] md:text-[21px] md:font-medium md:tracking-normal'
      }`}
    >
      {titulo}
    </h1>
  )
}
