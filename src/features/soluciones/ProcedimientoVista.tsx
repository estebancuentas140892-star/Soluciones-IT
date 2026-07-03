import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db, type DecisionPaso, type Procedimiento } from '../../lib/db'
import { alternarPasoHecho, contarHechos, reiniciarProgreso } from '../../lib/progresoPasos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'

interface Props {
  articuloId: string
  procedimiento: Procedimiento
}

// Vista de lectura de un procedimiento: la lista de pasos colapsados
// es el "mapa" del proceso (se ve completo de un vistazo) y cada paso
// se expande al tocarlo para ver el detalle, la captura y los avisos.
export function ProcedimientoVista({ articuloId, procedimiento }: Props) {
  const progreso = useLiveQuery(() => db.progresoPasos.get(articuloId), [articuloId])
  const [expandido, setExpandido] = useState<string | null>(null)
  const refsPasos = useRef<(HTMLLIElement | null)[]>([])

  const { requisitos, pasos } = procedimiento
  const hechos = new Set(progreso?.pasosHechos ?? [])
  const completados = contarHechos(progreso?.pasosHechos ?? [], pasos.map((p) => p.id))

  // Salta al paso indicado por una decision (numero 1 en adelante) o
  // al siguiente cuando la decision dice "continuar" (null).
  function irAPaso(numero: number | null, desdeIndice: number) {
    const indice = numero === null ? desdeIndice + 1 : numero - 1
    if (indice < 0 || indice >= pasos.length) return
    setExpandido(pasos[indice].id)
    refsPasos.current[indice]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section className="flex flex-col gap-3">
      {requisitos.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-200">Antes de empezar</h2>
          <ul className="mt-1.5 flex flex-col gap-1">
            {requisitos.map((requisito) => (
              <li key={requisito} className="text-sm text-slate-400">
                • {requisito}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {pasos.map((paso, indice) => (
          <li
            key={paso.id}
            ref={(elemento) => {
              refsPasos.current[indice] = elemento
            }}
            className={`rounded-xl border ${
              expandido === paso.id ? 'border-sky-700' : 'border-slate-800'
            } bg-slate-900`}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                onClick={() => void alternarPasoHecho(articuloId, paso.id)}
                aria-label={
                  hechos.has(paso.id)
                    ? `Desmarcar paso ${indice + 1}`
                    : `Marcar paso ${indice + 1} como hecho`
                }
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                  hechos.has(paso.id)
                    ? 'border-emerald-700 bg-emerald-500/15 text-emerald-400'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                {hechos.has(paso.id) ? '✓' : indice + 1}
              </button>
              <button
                type="button"
                onClick={() => setExpandido(expandido === paso.id ? null : paso.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
              >
                <span
                  className={`text-sm ${
                    hechos.has(paso.id) ? 'text-slate-500' : 'text-slate-200'
                  } ${expandido === paso.id ? 'font-medium' : ''}`}
                >
                  {paso.titulo || `Paso ${indice + 1}`}
                </span>
                <span className="text-xs text-slate-500">{expandido === paso.id ? '▲' : '▼'}</span>
              </button>
            </div>

            {expandido === paso.id && (
              <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3">
                {paso.imagen && <ImagenPaso referencia={paso.imagen} titulo={paso.titulo} />}

                {paso.detalle && (
                  <p className="whitespace-pre-line text-sm text-slate-300">{paso.detalle}</p>
                )}

                {paso.nota && <Aviso etiqueta="Nota" texto={paso.nota} estilo="nota" />}
                {paso.advertencia && (
                  <Aviso etiqueta="Advertencia" texto={paso.advertencia} estilo="advertencia" />
                )}
                {paso.consejo && <Aviso etiqueta="Consejo" texto={paso.consejo} estilo="consejo" />}

                {paso.decision && (
                  <Decision
                    decision={paso.decision}
                    indice={indice}
                    totalPasos={pasos.length}
                    onIr={irAPaso}
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${pasos.length === 0 ? 0 : Math.round((completados / pasos.length) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {completados} de {pasos.length} pasos completados
          </p>
          {completados > 0 && (
            <button
              type="button"
              onClick={() => void reiniciarProgreso(articuloId)}
              className="text-xs text-slate-400 underline underline-offset-2"
            >
              Reiniciar progreso
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

const ESTILOS_AVISO = {
  nota: { caja: 'border-slate-700 bg-slate-800/60', texto: 'text-slate-300' },
  advertencia: { caja: 'border-amber-900/60 bg-amber-950/40', texto: 'text-amber-200' },
  consejo: { caja: 'border-emerald-900/60 bg-emerald-950/40', texto: 'text-emerald-200' },
} as const

function Aviso({
  etiqueta,
  texto,
  estilo,
}: {
  etiqueta: string
  texto: string
  estilo: keyof typeof ESTILOS_AVISO
}) {
  const clases = ESTILOS_AVISO[estilo]
  return (
    <div className={`rounded-lg border px-3 py-2 ${clases.caja}`}>
      <p className={`text-xs font-medium ${clases.texto}`}>{etiqueta}</p>
      <p className={`mt-0.5 whitespace-pre-line text-xs ${clases.texto}`}>{texto}</p>
    </div>
  )
}

function Decision({
  decision,
  indice,
  totalPasos,
  onIr,
}: {
  decision: DecisionPaso
  indice: number
  totalPasos: number
  onIr: (numero: number | null, desdeIndice: number) => void
}) {
  return (
    <div className="rounded-lg border border-sky-900/60 bg-sky-950/40 px-3 py-2">
      <p className="text-xs font-medium text-sky-200">{decision.pregunta}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <BotonDecision respuesta="Sí" numero={decision.pasoSi} indice={indice} totalPasos={totalPasos} onIr={onIr} />
        <BotonDecision respuesta="No" numero={decision.pasoNo} indice={indice} totalPasos={totalPasos} onIr={onIr} />
      </div>
    </div>
  )
}

function BotonDecision({
  respuesta,
  numero,
  indice,
  totalPasos,
  onIr,
}: {
  respuesta: string
  numero: number | null
  indice: number
  totalPasos: number
  onIr: (numero: number | null, desdeIndice: number) => void
}) {
  const destino = numero === null ? indice + 2 : numero
  const etiqueta =
    destino > totalPasos ? `${respuesta}: fin del procedimiento` : `${respuesta}: ir al paso ${destino}`
  return (
    <button
      type="button"
      onClick={() => onIr(numero, indice)}
      className="rounded-lg border border-sky-800 px-3 py-1.5 text-xs text-sky-300"
    >
      {etiqueta}
    </button>
  )
}

function ImagenPaso({ referencia, titulo }: { referencia: string; titulo: string }) {
  const url = useUrlAdjunto(referencia)

  if (!url) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-slate-800 bg-slate-950">
        <p className="px-3 text-center text-xs text-slate-500">
          Captura no disponible. Si estás sin conexión, usa "Descargar todo para offline" con señal.
        </p>
      </div>
    )
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={`Captura del paso: ${titulo}`}
        className="max-h-72 w-full rounded-lg border border-slate-800 object-contain"
      />
    </a>
  )
}
