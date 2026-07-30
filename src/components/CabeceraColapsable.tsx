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
export function CabeceraColapsable({ titulo }: { titulo: string }) {
  const [contraida, setContraida] = useState(false)
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
      className={`min-w-0 truncate font-medium leading-[1.2] transition-[font-size] duration-150 motion-reduce:transition-none ${
        contraida ? 'text-[14px]' : 'text-[21px]'
      }`}
    >
      {titulo}
    </h1>
  )
}
