// LA MARCA DEL TELÉFONO (tarea 350, cabecera de Inicio del prototipo de Claude
// Design): una ventana con su marca de hecho, sobre el relleno del acento y
// con su relieve. Es el mismo glifo que preside «Guía completada»: la app se
// presenta con lo que hace, cerrar ventanas. `Marca` (el glifo de siempre)
// sigue en la barra lateral de escritorio y en el inicio de sesión.

export function GlifoVentana({ tam = 20, grosor = 2.2 }: { tam?: number; grosor?: number }) {
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
    >
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="M2.5 9h19" />
      <path d="M8.5 14.5l2.2 2.2 4.8-4.8" />
    </svg>
  )
}

export function MarcaVentana() {
  return (
    <span
      aria-hidden
      data-marca-ventana
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-noct-accent text-noct-on-accent shadow-[0_3px_0_var(--color-noct-accent-borde)]"
    >
      <GlifoVentana />
    </span>
  )
}
