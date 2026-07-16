import { useState } from 'react'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { Check, Copy, Eye, EyeSlash } from '../../components/iconos'

// Campo de una credencial descifrada (usuario, contrasena, IP...) con
// boton de copiar y, si aplica, mostrar/ocultar, en el patron Nocturne
// del rediseño: fila con etiqueta a la izquierda, valor en
// monoespaciado y acciones de icono a la derecha. Se usa en la ficha
// de la boveda y en los pasos de procedimiento que vinculan una
// credencial.
export function CampoSecreto({
  etiqueta,
  valor,
  oculto = false,
  alternarOculto,
  onCopiado,
}: {
  etiqueta: string
  valor: string
  oculto?: boolean
  alternarOculto?: () => void
  // Auditoria de la boveda (fase B3): el componente no sabe si esto es
  // un usuario, una contrasena u otro dato, asi que deja la decision
  // de que registrar a quien lo use.
  onCopiado?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-noct-divider bg-noct-surface px-2.5 py-[7px]">
      <dt className="shrink-0 text-xs text-noct-neutral-400">{etiqueta}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className={`truncate font-mono text-[13px] ${oculto ? 'tracking-[2px]' : ''}`}>
          {oculto ? '••••••••' : valor}
        </span>
        {alternarOculto && (
          <button
            type="button"
            onClick={alternarOculto}
            aria-label={oculto ? `Mostrar ${etiqueta}` : `Ocultar ${etiqueta}`}
            className="flex shrink-0 cursor-pointer p-1 text-noct-neutral-400 hover:text-noct-accent"
          >
            {oculto ? <Eye size={15} aria-hidden /> : <EyeSlash size={15} aria-hidden />}
          </button>
        )}
        <BotonCopiar etiqueta={etiqueta} valor={valor} onCopiado={onCopiado} />
      </dd>
    </div>
  )
}

function BotonCopiar({
  etiqueta,
  valor,
  onCopiado,
}: {
  etiqueta: string
  valor: string
  onCopiado?: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (await copiarAlPortapapeles(valor)) {
      setCopiado(true)
      onCopiado?.()
      setTimeout(() => setCopiado(false), 1500)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      aria-label={`Copiar ${etiqueta}`}
      className="flex shrink-0 cursor-pointer p-1 text-noct-neutral-400 hover:text-noct-accent"
    >
      {copiado ? <Check size={15} className="text-noct-exito" aria-hidden /> : <Copy size={15} aria-hidden />}
    </button>
  )
}
