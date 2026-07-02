import { useState } from 'react'
import { copiarAlPortapapeles } from '../lib/portapapeles'

// Valor que se copia al portapapeles con un toque. Para las IP
// ofrece ademas abrir la interfaz web del equipo en el navegador.

export function ValorCopiable({ valor, esIp = false }: { valor: string; esIp?: boolean }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (await copiarAlPortapapeles(valor)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => void copiar()}
        title="Tocar para copiar"
        className="break-all text-left text-sm text-slate-100 underline decoration-dotted decoration-slate-600 underline-offset-2"
      >
        {valor}
      </button>
      {copiado && <span className="text-[10px] text-emerald-400">Copiado</span>}
      {esIp && !copiado && (
        <a
          href={`http://${valor}`}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-slate-800 px-1.5 py-0.5 text-[10px] text-sky-400"
        >
          Abrir
        </a>
      )}
    </span>
  )
}
