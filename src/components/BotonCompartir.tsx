import { useState } from 'react'
import { copiarAlPortapapeles } from '../lib/portapapeles'

// Comparte el enlace de la pantalla actual con el dialogo nativo del
// telefono (WhatsApp, correo, etc.). Donde no exista (PC con algunos
// navegadores), copia el enlace al portapapeles.

export function BotonCompartir({ titulo }: { titulo: string }) {
  const [aviso, setAviso] = useState<string | null>(null)

  async function compartir() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url })
      } catch {
        // El usuario cancelo el dialogo de compartir: no es un error.
      }
      return
    }
    if (await copiarAlPortapapeles(url)) {
      setAviso('Enlace copiado')
      setTimeout(() => setAviso(null), 1500)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void compartir()}
      className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
    >
      {aviso ?? 'Compartir'}
    </button>
  )
}
