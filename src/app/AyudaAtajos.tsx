import { Modal } from '../components/Modal'
import { X } from '../components/iconos'
import { atajosVisibles, type AtajoApp } from './atajosApp'

// LA LISTA COMPLETA DE ATAJOS, tal como la pide el encargo: el dialogo
// que abre "?" enseña TODOS, no una seleccion.
//
// Se reutiliza tal cual desde el apartado Referencia, donde vive la
// entrada visible "Atajos de la aplicacion": los atajos propios de esta
// app son parte del vocabulario del equipo, igual que Windows + R, y
// tienen que poder consultarse sin saber de antemano que existe "?".

const ID_TITULO = 'ayuda-atajos-titulo'

export function AyudaAtajos({
  abierto,
  onCerrar,
  puedeVerBoveda,
}: {
  abierto: boolean
  onCerrar: () => void
  puedeVerBoveda: boolean
}) {
  const atajos = atajosVisibles(puedeVerBoveda)
  const grupos = [...new Set(atajos.map((a) => a.grupo))]

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={ID_TITULO} className="text-[17px] font-medium leading-tight text-noct-text">
          Atajos de la aplicación
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        {grupos.map((grupo) => (
          <div key={grupo}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-noct-neutral-500">
              {grupo}
            </p>
            <dl className="flex flex-col">
              {atajos
                .filter((atajo) => atajo.grupo === grupo)
                .map((atajo) => (
                  <FilaAtajo key={atajo.teclas.join('+')} atajo={atajo} />
                ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-3.5 border-t border-noct-divider pt-2.5 text-[12px] leading-[1.5] text-noct-neutral-500">
        Los atajos no actúan mientras escribes en un campo. La secuencia que empieza con{' '}
        <Tecla>G</Tecla> se cancela sola si la segunda tecla tarda. Las teclas de ir a una sección
        tampoco actúan mientras editas o ejecutas una guía, para no sacarte de un trabajo a medias.
      </p>
    </Modal>
  )
}

function FilaAtajo({ atajo }: { atajo: AtajoApp }) {
  return (
    <div className="flex min-h-[38px] items-center gap-3 py-1">
      <dt className="flex shrink-0 items-center gap-1">
        {atajo.teclas.map((tecla, indice) => (
          <span key={indice} className="flex items-center gap-1">
            {indice > 0 && <span className="text-[11px] text-noct-neutral-600">luego</span>}
            <Tecla>{tecla}</Tecla>
          </span>
        ))}
      </dt>
      <dd className="min-w-0 flex-1 text-pretty text-[13px] leading-snug text-noct-neutral-200">
        {atajo.descripcion}
      </dd>
    </div>
  )
}

function Tecla({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[26px] items-center justify-center rounded border border-noct-divider bg-noct-bg px-1.5 py-0.5 font-mono text-[12px] text-noct-text">
      {children}
    </kbd>
  )
}
