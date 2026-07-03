import { useState } from 'react'
import { copiarAlPortapapeles } from '../../lib/portapapeles'

// Campo de una credencial descifrada (usuario, contrasena, IP...)
// con boton de copiar y, si aplica, mostrar/ocultar. Se usa en la
// ficha de la boveda y en los pasos de procedimiento que vinculan
// una credencial.
export function CampoSecreto({
  etiqueta,
  valor,
  oculto = false,
  alternarOculto,
}: {
  etiqueta: string
  valor: string
  oculto?: boolean
  alternarOculto?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{etiqueta}</dt>
        <dd className="truncate font-mono text-sm text-slate-100">{oculto ? '••••••••' : valor}</dd>
      </div>
      <div className="flex shrink-0 gap-2">
        {alternarOculto && (
          <button
            type="button"
            onClick={alternarOculto}
            className="rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300"
          >
            {oculto ? 'Mostrar' : 'Ocultar'}
          </button>
        )}
        <BotonCopiar etiqueta={etiqueta} valor={valor} />
      </div>
    </div>
  )
}

function BotonCopiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (await copiarAlPortapapeles(valor)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      aria-label={`Copiar ${etiqueta}`}
      className="rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300"
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}
