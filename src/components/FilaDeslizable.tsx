import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// UNA FILA QUE SE DESLIZA, Y QUE LO DICE (propuesta final de Claude
// Design, 2026-10-01: los chips de categoría de Equipos).
//
// En el teléfono la fila de chips no cabe y se desliza en horizontal. Con
// un corte seco en el borde, el último chip quedaba como "Co" o
// "Impresoras" partida y no se sabía si había más. Aquí el borde que tiene
// contenido detrás se DESVANECE (máscara de 32 px): el chip que sigue se
// insinúa en vez de leerse cortado, y en cuanto se llega al final el
// desvanecido desaparece y el último chip se lee entero. Al deslizar, el
// borde izquierdo hace lo mismo.
//
// Es la única fila con desplazamiento horizontal intencional de la app:
// la página nunca se desliza en horizontal.

const DESVANECIDO_PX = 32

function mascara(izquierda: boolean, derecha: boolean): string | undefined {
  if (!izquierda && !derecha) return undefined
  const inicio = izquierda ? `transparent 0, #000 ${DESVANECIDO_PX}px` : '#000 0'
  const fin = derecha ? `#000 calc(100% - ${DESVANECIDO_PX}px), transparent 100%` : '#000 100%'
  return `linear-gradient(to right, ${inicio}, ${fin})`
}

export function FilaDeslizable({
  children,
  etiqueta,
  className = '',
}: {
  children: ReactNode
  /** Nombre accesible del grupo ("Filtrar por categoría"). */
  etiqueta: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [bordes, setBordes] = useState({ izquierda: false, derecha: false })

  const medir = useCallback(() => {
    const nodo = ref.current
    if (!nodo) return
    const izquierda = nodo.scrollLeft > 1
    const derecha = nodo.scrollLeft + nodo.clientWidth < nodo.scrollWidth - 1
    setBordes((actual) =>
      actual.izquierda === izquierda && actual.derecha === derecha ? actual : { izquierda, derecha },
    )
  }, [])

  useEffect(() => {
    const nodo = ref.current
    if (!nodo) return
    nodo.addEventListener('scroll', medir, { passive: true })
    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null
    observador?.observe(nodo)
    return () => {
      nodo.removeEventListener('scroll', medir)
      observador?.disconnect()
    }
  }, [medir])

  // Los chips cambian de ancho con sus conteos: se vuelve a medir en cada
  // render (es una lectura barata y `setBordes` no re-renderiza si nada
  // cambió).
  useEffect(medir)

  const imagen = mascara(bordes.izquierda, bordes.derecha)

  return (
    <div
      ref={ref}
      role="group"
      aria-label={etiqueta}
      data-desliza-derecha={bordes.derecha || undefined}
      className={`flex overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={imagen ? { maskImage: imagen, WebkitMaskImage: imagen } : undefined}
    >
      {children}
    </div>
  )
}
