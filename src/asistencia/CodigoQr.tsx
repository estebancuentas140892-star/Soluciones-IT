import { useMemo } from 'react'
import { rutaDeModulos } from './qr'

// El QR del portal, dibujado como un SVG de React a partir de la matriz de
// módulos: nada de `innerHTML` ni de imágenes `data:`, así que la página
// puede llevar una CSP estricta. Módulos negros sobre blanco con zona
// tranquila de 2 módulos, que es lo que leen todas las cámaras (también
// el escáner de la app, que usa jsQR).

export function CodigoQr({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const { lado, ruta } = useMemo(() => rutaDeModulos(texto), [texto])
  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="h-44 w-44 rounded-lg bg-white"
    >
      <rect width={lado} height={lado} fill="#ffffff" />
      <path d={ruta} fill="#000000" />
    </svg>
  )
}
