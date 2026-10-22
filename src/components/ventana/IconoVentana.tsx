import type { ReactNode } from 'react'

// LOS ICONOS DE «VENTANA» (tarea 350). Los glifos del prototipo de Claude
// Design, con su trazo de 2.2 a 2.6: el teléfono se lee de pie y con prisa,
// y el trazo grueso se distingue antes que el fino de `iconos.tsx`, que sigue
// siendo el de tableta y escritorio y el de todo lo que no se rediseñó. Son
// los mismos trazados del prototipo, sin redibujar nada.

export type NombreIconoVentana =
  | 'buscar'
  | 'flecha'
  | 'flecha-abajo'
  | 'atras'
  | 'adelante'
  | 'cerrar'
  | 'copiar'
  | 'llave'
  | 'monitor'
  | 'candado'
  | 'candado-grande'
  | 'cuadricula'
  | 'calendario'
  | 'indice'
  | 'problema'
  | 'info'
  | 'comprobacion'
  | 'precaucion'
  | 'critica'
  | 'ventana'
  | 'hecho'
  | 'qr'
  | 'nube-al-dia'
  | 'requisitos'
  | 'movil'
  | 'sol'
  | 'luna'

const TRAZOS: Record<NombreIconoVentana, ReactNode> = {
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  flecha: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  'flecha-abajo': <path d="M12 5v14M6 13l6 6 6-6" />,
  atras: <path d="M15 18l-6-6 6-6" />,
  adelante: <path d="M9 18l6-6-6-6" />,
  cerrar: <path d="M18 6L6 18M6 6l12 12" />,
  copiar: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </>
  ),
  llave: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z" />
  ),
  monitor: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2.5" />
      <path d="M8 21h8M12 16.5V21" />
    </>
  ),
  candado: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  'candado-grande': (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <path d="M12 15v2" />
    </>
  ),
  cuadricula: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M16 2.5v3M8 2.5v3M3 10h18" />
    </>
  ),
  indice: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  problema: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M5.3 5.3l3.9 3.9M14.8 14.8l3.9 3.9M14.8 9.2l3.9-3.9M5.3 18.7l3.9-3.9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 16v-4.5M12 8h.01" />
    </>
  ),
  comprobacion: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 12.2l2.8 2.8L16.2 9.5" />
    </>
  ),
  precaucion: (
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  critica: (
    <>
      <path d="M7.9 2.5h8.2l5.4 5.4v8.2l-5.4 5.4H7.9l-5.4-5.4V7.9z" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  ventana: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="M2 9h20" />
    </>
  ),
  hecho: <path d="M20 6L9 17l-5-5" />,
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" />
    </>
  ),
  'nube-al-dia': (
    <>
      <path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z" />
      <path d="M9.5 14l2 2 3.5-3.5" />
    </>
  ),
  requisitos: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 14l2 2 4-4" />
    </>
  ),
  movil: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  luna: <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.5 6.5 0 0 0 11 11z" />,
}

interface Props {
  nombre: NombreIconoVentana
  /** Lado en px (el prototipo usa de 16 a 24). */
  tam?: number
  /** Trazo: 2.2 lo normal, 2.4 a 2.6 en flechas y cierres. */
  grosor?: number
  className?: string
}

export function IconoVentana({ nombre, tam = 20, grosor = 2.2, className }: Props) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
