import { useEffect, useState, type RefObject } from 'react'
import type { FueraDeVista } from '../../features/soluciones/ventana'

// QUÉ PARTES DE LA VENTANA QUEDAN FUERA DE LA VISTA, POR DEBAJO (tarea 348).
//
// Alimenta el indicador «Más abajo». Observa las partes que la ventana marca
// con un atributo (`data-aviso-ventana`, `data-instruccion-ventana`,
// `data-comprobacion-ventana`, `data-decision-ventana`) y dice cuáles todavía
// no se ven porque están debajo del borde de la pantalla, descontando el pie
// fijo, que es lo que las tapa. Lo que se dejó atrás, arriba, no cuenta: el
// indicador anuncia lo que falta por leer, no lo ya leído.
//
// Sin `IntersectionObserver` (un navegador viejo, las pruebas) no hay
// indicador: la ventana funciona igual, solo que sin ese aviso.

const PARTES = '[data-aviso-ventana],[data-instruccion-ventana],[data-comprobacion-ventana],[data-decision-ventana]'

function parteDe(elemento: Element): FueraDeVista | null {
  const aviso = elemento.getAttribute('data-aviso-ventana')
  if (aviso) return { parte: aviso === 'critica' ? 'critica' : 'precaucion' }
  const instruccion = elemento.getAttribute('data-instruccion-ventana')
  if (instruccion) return { parte: 'instruccion', numero: Number(instruccion) }
  if (elemento.hasAttribute('data-comprobacion-ventana')) return { parte: 'comprobacion' }
  if (elemento.getAttribute('data-decision-ventana') === 'pendiente') return { parte: 'pregunta' }
  return null
}

/**
 * @param contenedor la ventana, de donde se toman las partes.
 * @param clave cambia cuando cambian las partes (otra ventana, otro estado): vuelve a observar.
 * @param activo sin él no se observa nada.
 */
export function useFueraDeVista(contenedor: RefObject<HTMLElement | null>, clave: string, activo: boolean): FueraDeVista[] {
  const [fuera, setFuera] = useState<FueraDeVista[]>([])

  useEffect(() => {
    const raiz = contenedor.current
    if (!activo || !raiz || typeof IntersectionObserver === 'undefined') {
      setFuera([])
      return
    }
    // Lo que tapa el pie fijo: sin su franja «Más abajo», que es lo que se
    // anuncia y no debe contarse como parte de lo tapado.
    const pie = document.querySelector<HTMLElement>('[data-pie-ventana]')
    const franja = pie?.querySelector<HTMLElement>('[data-mas-abajo]')
    const tapado = Math.max(0, (pie?.offsetHeight ?? 0) - (franja?.offsetHeight ?? 0))

    const debajo = new Map<Element, boolean>()
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const limite = entrada.rootBounds?.bottom ?? window.innerHeight
          debajo.set(entrada.target, !entrada.isIntersecting && entrada.boundingClientRect.top >= limite)
        }
        const partes: FueraDeVista[] = []
        for (const [elemento, estaDebajo] of debajo) {
          if (!estaDebajo) continue
          const parte = parteDe(elemento)
          if (parte) partes.push(parte)
        }
        setFuera(partes)
      },
      { rootMargin: `0px 0px -${tapado}px 0px`, threshold: 0 },
    )
    raiz.querySelectorAll(PARTES).forEach((elemento) => observador.observe(elemento))
    return () => observador.disconnect()
  }, [contenedor, clave, activo])

  return fuera
}
