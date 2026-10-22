import { claseDeNombre, type ClaseVisual } from '../lib/claseVisual'

// EL ICONO DE CATEGORÍA DEL TELÉFONO (tarea 350; pizarra «Icono de categoría»
// del prototipo de Claude Design). Un recuadro tintado con el glifo de la
// CLASE de lo que representa: la misma pieza para una categoría de guías
// (Software, Impresoras, POS...) y para la clase de un equipo (Computadores,
// Cámaras, Switches...), porque en el trabajo son lo mismo: "esto es de
// impresoras". Se reconoce antes de leer el nombre.
//
// La clase se deduce del NOMBRE escrito por el equipo, por palabras clave,
// igual que `iconoDeCategoria` y `tipoDeNodoVisual`: las categorías no
// guardan un icono. Lo que no se reconoce cae en el reloj neutro del
// prototipo, nunca en un color inventado.
//
// Proporciones del prototipo: radio del 30 % del lado y glifo del 55 %, con
// trazo de 2.1. Los colores salen de los tokens `noct-clase-*` (index.css),
// con su valor claro; las clases van completas porque Tailwind no ve nombres
// construidos.

const TONO: Record<ClaseVisual, string> = {
  software: 'bg-noct-clase-software-tinte text-noct-clase-software',
  impresora: 'bg-noct-clase-impresora-tinte text-noct-clase-impresora',
  pos: 'bg-noct-clase-pos-tinte text-noct-clase-pos',
  servidor: 'bg-noct-clase-servidor-tinte text-noct-clase-servidor',
  red: 'bg-noct-clase-red-tinte text-noct-clase-red',
  computador: 'bg-noct-clase-computador-tinte text-noct-clase-computador',
  camara: 'bg-noct-clase-camara-tinte text-noct-clase-camara',
  switch: 'bg-noct-clase-switch-tinte text-noct-clase-switch',
  datafono: 'bg-noct-clase-datafono-tinte text-noct-clase-datafono',
  general: 'bg-noct-neutral-900 text-noct-neutral-300',
}

function Glifo({ clase }: { clase: ClaseVisual }) {
  switch (clase) {
    case 'software':
      return (
        <>
          <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
          <path d="M2.5 9h19" />
          <path d="M6 6.5h.01M9 6.5h.01" />
          <path d="M8 14l2 2-2 2M12.5 18H16" />
        </>
      )
    case 'impresora':
      return (
        <>
          <path d="M6 9V3h12v6" />
          <path d="M6 18H4.5A2.5 2.5 0 0 1 2 15.5v-4A2.5 2.5 0 0 1 4.5 9h15a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H18" />
          <rect x="6" y="14" width="12" height="7" rx="1" />
        </>
      )
    case 'pos':
      return (
        <>
          <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      )
    case 'servidor':
      return (
        <>
          <rect x="3" y="3" width="18" height="7.5" rx="2" />
          <rect x="3" y="13.5" width="18" height="7.5" rx="2" />
          <path d="M7 6.8h.01M7 17.3h.01M11 6.8h6M11 17.3h6" />
        </>
      )
    case 'red':
      return (
        <>
          <rect x="9" y="2.5" width="6" height="6" rx="1.2" />
          <rect x="2.5" y="15.5" width="6" height="6" rx="1.2" />
          <rect x="15.5" y="15.5" width="6" height="6" rx="1.2" />
          <path d="M5.5 15.5v-3h13v3M12 12.5v-4" />
        </>
      )
    case 'computador':
      return (
        <>
          <rect x="2.5" y="3.5" width="19" height="13" rx="2.5" />
          <path d="M8 21h8M12 16.5V21" />
        </>
      )
    case 'camara':
      return (
        <>
          <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
          <path d="M15.5 10.5l6-3v9l-6-3" />
        </>
      )
    case 'switch':
      return (
        <>
          <rect x="2" y="7.5" width="20" height="9" rx="2" />
          <path d="M6 12h.01M9.5 12h.01M13 12h.01M16.5 12h1.5" />
        </>
      )
    case 'datafono':
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2.5" />
          <path d="M2 10h20M6 15h4" />
        </>
      )
    default:
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4l2.5 2" />
        </>
      )
  }
}

interface Props {
  /** El nombre de la categoría o de la clase del equipo ("Impresoras"). */
  nombre?: string | null
  /** La clase ya resuelta; manda sobre `nombre`. */
  clase?: ClaseVisual
  /** Lado del recuadro, en px (40 en las filas, 44 en «Sigue donde ibas»). */
  tam?: number
  className?: string
}

export function IconoCategoria({ nombre, clase, tam = 40, className = '' }: Props) {
  const resuelta = clase ?? claseDeNombre(nombre)
  const glifo = Math.round(tam * 0.55)
  return (
    <span
      aria-hidden
      data-icono-categoria={resuelta}
      className={`flex shrink-0 items-center justify-center ${TONO[resuelta]} ${className}`}
      style={{ width: tam, height: tam, borderRadius: Math.round(tam * 0.3) }}
    >
      <svg
        width={glifo}
        height={glifo}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Glifo clase={resuelta} />
      </svg>
    </span>
  )
}
