import type { TipoNodoVisual } from './topologiaVisual'

// Icono del tipo de equipo de red (trazo 1.8 estilo Lucide, como el
// resto de la app). Compartido entre Topología y Red: ambas pantallas
// del rediseño en tema claro dibujan el mismo tipo de equipo con el
// mismo icono. Los siete primeros y "ups" vienen de los diseños
// (Topologia.dc.html y Red.dc.html); rack, cámara, servidor y genérico
// se agregan porque las categorías reales del esquema los necesitan.
export function IconoNodo({ tipo, className = 'h-4 w-4' }: { tipo: TipoNodoVisual; className?: string }) {
  const comunes = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    className,
  } as const

  switch (tipo) {
    case 'router':
      return (
        <svg {...comunes}>
          <rect x="3" y="12" width="18" height="8" rx="1.5" />
          <path d="M7 16h.1M10 16h.1" strokeLinecap="round" />
          <path d="M17 12V7" strokeLinecap="round" />
          <circle cx="17" cy="5.5" r="1.2" />
        </svg>
      )
    case 'switch':
      return (
        <svg {...comunes}>
          <rect x="3" y="8" width="18" height="8" rx="1.5" />
          <path d="M6.5 12h.1M9.5 12h.1M12.5 12h.1M15.5 12h.1" strokeLinecap="round" />
        </svg>
      )
    case 'ap':
      return (
        <svg {...comunes}>
          <path d="M5 12.5a10 10 0 0 1 14 0" strokeLinecap="round" />
          <path d="M8 15.5a6 6 0 0 1 8 0" strokeLinecap="round" />
          <circle cx="12" cy="18.5" r="1.2" />
        </svg>
      )
    case 'ups':
      return (
        <svg {...comunes}>
          <rect x="3" y="8" width="16" height="8" rx="1.5" />
          <path d="M21.5 11v2" strokeLinecap="round" />
          <path d="m10 9.5-1.8 2.5h3.6L10 14.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'punto':
      return (
        <svg {...comunes}>
          <rect x="5" y="5" width="14" height="14" rx="1.5" />
          <rect x="9.5" y="9" width="5" height="6" />
        </svg>
      )
    case 'pc':
      return (
        <svg {...comunes}>
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M8 20h8M12 16v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'impresora':
      return (
        <svg {...comunes}>
          <path d="M6 9V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="4" y="9" width="16" height="7" rx="1.5" />
          <path d="M7 16v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'pos':
      return (
        <svg {...comunes}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" strokeLinecap="round" />
          <path d="M7 15h4" strokeLinecap="round" />
        </svg>
      )
    case 'rack':
      return (
        <svg {...comunes}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M5 9h14M5 15h14" />
          <path d="M8 6h.1M8 12h.1M8 18h.1" strokeLinecap="round" />
        </svg>
      )
    case 'camara':
      return (
        <svg {...comunes}>
          <rect x="3" y="7" width="12" height="10" rx="2" />
          <path d="m15 10.5 6-3v9l-6-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'servidor':
      return (
        <svg {...comunes}>
          <rect x="3" y="4" width="18" height="7" rx="1.5" />
          <rect x="3" y="13" width="18" height="7" rx="1.5" />
          <path d="M7 7.5h.1M7 16.5h.1" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg {...comunes}>
          <rect x="3" y="10" width="18" height="9" rx="1.5" />
          <path d="M7 14.5h.1M10 14.5h.1" strokeLinecap="round" />
        </svg>
      )
  }
}
