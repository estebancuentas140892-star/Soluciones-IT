import { useId } from 'react'
import { CLASE_ETIQUETA } from '../../components/campos'
import { OpcionRadio } from '../../components/OpcionRadio'
import type { TipoMantenimiento } from '../../lib/db'
import { ETIQUETA_TIPO_MANTENIMIENTO } from '../../lib/mantenimientos'

const TIPOS: TipoMantenimiento[] = ['preventivo', 'correctivo']

/** Preventivo o correctivo: las dos respuestas, lado a lado (cada una de 44 px). */
export function SelectorTipoMantenimiento({
  valor,
  alCambiar,
}: {
  valor: TipoMantenimiento
  alCambiar: (tipo: TipoMantenimiento) => void
}) {
  const idEtiqueta = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={idEtiqueta} className={CLASE_ETIQUETA}>
        Tipo
      </span>
      <div role="radiogroup" aria-labelledby={idEtiqueta} className="grid grid-cols-2 gap-1.5">
        {TIPOS.map((tipo) => (
          <OpcionRadio key={tipo} activa={valor === tipo} onClick={() => alCambiar(tipo)}>
            {ETIQUETA_TIPO_MANTENIMIENTO[tipo]}
          </OpcionRadio>
        ))}
      </div>
    </div>
  )
}
