import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type DecisionPaso, type Procedimiento } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { alternarPasoHecho, contarHechos, reiniciarProgreso } from '../../lib/progresoPasos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'

interface Props {
  articuloId: string
  procedimiento: Procedimiento
  // 0 = procedimiento principal; 1 = subprocedimiento expandido
  // dentro de un paso. Mas alla del nivel 1 los vinculos se muestran
  // solo como enlace, sin expandirse.
  nivel?: number
}

// Vista de lectura de un procedimiento: la lista de pasos colapsados
// es el "mapa" del proceso (se ve completo de un vistazo) y cada paso
// se expande al tocarlo para ver el detalle, la captura y los avisos.
// Un paso con subprocedimiento vinculado despliega el paso a paso de
// ese otro articulo ahi mismo, con su propio progreso (compartido con
// el articulo original).
export function ProcedimientoVista({ articuloId, procedimiento, nivel = 0 }: Props) {
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
                  {paso.titulo || paso.subArticuloTitulo || `Paso ${indice + 1}`}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {paso.subArticuloId && <ContadorSubProgreso subArticuloId={paso.subArticuloId} />}
                  <span className="text-xs text-slate-500">{expandido === paso.id ? '▲' : '▼'}</span>
                </span>
              </button>
            </div>

            {expandido === paso.id && (
              <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3">
                {paso.imagen && <ImagenPaso referencia={paso.imagen} titulo={paso.titulo} />}

                {paso.detalle && (
                  <p className="whitespace-pre-line text-sm text-slate-300">{paso.detalle}</p>
                )}

                {paso.credencialId && (
                  <CredencialEnPaso
                    credencialId={paso.credencialId}
                    tituloReferencia={paso.credencialTitulo}
                  />
                )}

                {paso.nota && <Aviso etiqueta="Nota" texto={paso.nota} estilo="nota" />}
                {paso.advertencia && (
                  <Aviso etiqueta="Advertencia" texto={paso.advertencia} estilo="advertencia" />
                )}
                {paso.consejo && <Aviso etiqueta="Consejo" texto={paso.consejo} estilo="consejo" />}

                {paso.subArticuloId && (
                  <SubProcedimientoEnPaso
                    subArticuloId={paso.subArticuloId}
                    tituloReferencia={paso.subArticuloTitulo}
                    nivel={nivel}
                  />
                )}

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

// Avance del subprocedimiento vinculado, visible en la fila colapsada
// del paso: el procedimiento principal funciona como lista de tareas
// y de un vistazo se ve cuales van completas.
function ContadorSubProgreso({ subArticuloId }: { subArticuloId: string }) {
  const articulo = useLiveQuery(
    async () => (await db.articulos.get(subArticuloId)) ?? null,
    [subArticuloId],
  )
  const progreso = useLiveQuery(() => db.progresoPasos.get(subArticuloId), [subArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )

  if (!procedimiento) return null
  const total = procedimiento.pasos.length
  const hechos = contarHechos(
    progreso?.pasosHechos ?? [],
    procedimiento.pasos.map((p) => p.id),
  )

  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
        hechos === total
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
          : 'border-slate-700 bg-slate-800/60 text-slate-400'
      }`}
    >
      {hechos}/{total}
    </span>
  )
}

// Subprocedimiento vinculado a un paso: el paso a paso de otro
// articulo, desplegado dentro del procedimiento principal. El
// progreso usa el id del articulo vinculado, asi que es el mismo se
// abra desde aqui o desde el articulo original.
function SubProcedimientoEnPaso({
  subArticuloId,
  tituloReferencia,
  nivel,
}: {
  subArticuloId: string
  tituloReferencia: string
  nivel: number
}) {
  const articulo = useLiveQuery(
    async () => (await db.articulos.get(subArticuloId)) ?? null,
    [subArticuloId],
  )
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )

  if (articulo === undefined) return null

  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2">
        <p className="text-xs text-amber-300">
          El procedimiento vinculado{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
          disponible. Edita el artículo para quitar el vínculo o vincular otro.
        </p>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Mas alla del primer nivel de anidamiento solo se enlaza, sin
  // expandir: evita la expansion infinita y corta cualquier ciclo
  // (A vincula a B y B a A). Tambien cubre el caso de un articulo
  // vinculado que ya no tiene pasos.
  if (nivel >= 1 || !procedimiento) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-sky-900/60 bg-sky-950/20 px-3 py-2"
      >
        <p className="min-w-0 truncate text-xs font-medium text-sky-200">
          Procedimiento: {articulo.titulo}
        </p>
        <span className="shrink-0 text-xs text-sky-300 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-sky-200">
          Procedimiento: {articulo.titulo}
        </p>
        <Link to={ruta} className="shrink-0 text-xs text-sky-300 underline underline-offset-2">
          Abrir
        </Link>
      </div>
      <ProcedimientoVista articuloId={articulo.id} procedimiento={procedimiento} nivel={nivel + 1} />
    </div>
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
