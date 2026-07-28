// Marca de la app (cerebro): glifo del handoff de Soluciones. NO forma
// parte del set de iconos de dominio (`iconos.tsx`): es el logotipo, y
// se usa solo donde la app se presenta a si misma (el sidebar de
// escritorio y el login). La regla R12 retiro el nombre "IT Brain" de
// la interfaz (tarea 180) pero conserva este glifo como marca.
//
// Vivia dentro de Chasis.tsx (antes ShellNocturne.tsx) hasta la tarea 184, que necesito el
// mismo glifo en el login: "el login se presenta" empieza por mostrar la
// marca, y duplicar el trazado habria dejado dos copias que divergen.
export function Marca(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path
        d="M12 3a4 4 0 0 0-4 4v1.2A5 5 0 0 0 5 13v3a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3a5 5 0 0 0-3-4.8V7a4 4 0 0 0-4-4Z"
        strokeLinejoin="round"
      />
      <path d="M9 20v.5A1.5 1.5 0 0 0 10.5 22h3a1.5 1.5 0 0 0 1.5-1.5V20" strokeLinecap="round" />
    </svg>
  )
}
