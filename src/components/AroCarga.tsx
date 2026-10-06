// El aro abierto que gira mientras termina algo (tarea 291, auditoría UX,
// T4, F9 y S3): dentro del botón pulsado ("Guardando…") y junto a
// "Cargando…".
//
// Es el `circle-notch` de Phosphor 2.1.1, pero NO vive en `iconos.tsx` a
// propósito: lo dibujan el botón común y el "Cargando…" de las pantallas
// diferidas, que se importan desde el trozo de entrada (`App.tsx`,
// `ActualizacionDisponible`), y traer `iconos.tsx` desde ahí lo metía
// entero en la precarga del arranque (44 kB, más que el propio trozo de
// entrada). Mismo motivo que documenta `ErrorBoundary.tsx`.
export function AroCarga({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
      className={`shrink-0 animate-spin motion-reduce:animate-none ${className}`}
    >
      <path d="M232,128a104,104,0,0,1-208,0c0-41,23.81-78.36,60.66-95.27a8,8,0,0,1,6.68,14.54C60.15,61.59,40,93.27,40,128a88,88,0,0,0,176,0c0-34.73-20.15-66.41-51.34-80.73a8,8,0,0,1,6.68-14.54C208.19,49.64,232,87,232,128Z" />
    </svg>
  )
}
