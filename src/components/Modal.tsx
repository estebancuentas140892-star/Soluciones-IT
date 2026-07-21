import { useEffect, type ReactNode } from 'react'

interface Props {
  abierto: boolean
  onCerrar: () => void
  // id del titulo dentro del contenido, para accesibilidad.
  tituloId?: string
  children: ReactNode
}

// Ventana modal centrada con el fondo oscurecido. Se cierra con la
// tecla Escape o tocando fuera de la tarjeta. En movil aparece como
// hoja inferior; en pantallas grandes queda centrada. Reutilizable
// para confirmaciones y otros dialogos.
export function Modal({ abierto, onCerrar, tituloId, children }: Props) {
  useEffect(() => {
    if (!abierto) return
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclado)
    // Evita que el fondo se desplace mientras el modal esta abierto.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(evento) => evento.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60"
      >
        {children}
      </div>
    </div>
  )
}
