import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useParams } from 'react-router-dom'
import { db, type Articulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'
import { BotonVolver } from '../../components/BotonVolver'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { IndicadorEstado } from '../dispositivos/IndicadorEstado'
import { Historial } from '../historial/Historial'
import { TIPOS_ARTICULO } from './tiposArticulo'

// Ficha de categoria (fase N4, sin esquema): esqueleto estandar
// aplicado a una entidad que hasta ahora ni siquiera tenia ficha
// propia (seccion 8 de PROPUESTA_BASE_CONOCIMIENTO.md). Reune todo lo
// que pertenece a la categoria (articulos, dispositivos, diagnosticos)
// mas su historial, sin tocar el esquema: dispositivos y diagnosticos
// ya llevan categoria_id, solo faltaba mostrarlos juntos aqui.
export function CategoriaPage() {
  const { categoriaId = '' } = useParams()

  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])
  const articulos = useLiveQuery(
    () => db.articulos.where('categoriaId').equals(categoriaId).filter((a) => !a.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )
  const dispositivos = useLiveQuery(
    () => db.dispositivos.where('categoriaId').equals(categoriaId).filter((d) => !d.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )
  const diagnosticos = useLiveQuery(
    () => db.diagnosticos.where('categoriaId').equals(categoriaId).filter((d) => !d.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )

  if (categoria === null) return <Navigate to="/soluciones" replace />

  const vacia = articulos.length === 0 && dispositivos.length === 0 && diagnosticos.length === 0

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-2">
          <BotonVolver to="/soluciones">Soluciones</BotonVolver>
          <div>
            <h1 className="text-xl font-semibold">{categoria?.nombre ?? '...'}</h1>
            {!vacia && (
              <p className="text-xs text-slate-500">
                {[
                  articulos.length > 0 ? `${articulos.length} ${articulos.length === 1 ? 'artículo' : 'artículos'}` : null,
                  dispositivos.length > 0
                    ? `${dispositivos.length} ${dispositivos.length === 1 ? 'equipo' : 'equipos'}`
                    : null,
                  diagnosticos.length > 0
                    ? `${diagnosticos.length} ${diagnosticos.length === 1 ? 'diagnóstico' : 'diagnósticos'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>
        <Link
          to={`/soluciones/${categoriaId}/nuevo`}
          className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
        >
          + Artículo
        </Link>
      </header>

      {vacia && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Todavía no hay nada en esta categoría
        </p>
      )}

      {TIPOS_ARTICULO.map(({ valor, etiqueta }) => {
        const delTipo = articulos?.filter((a) => a.tipo === valor) ?? []
        if (delTipo.length === 0) return null
        return (
          <section key={valor}>
            <h2 className="mb-2 text-sm font-medium text-slate-400">{etiqueta}</h2>
            <ul className="flex flex-col gap-2">
              {delTipo.map((articulo) => {
                const portada = normalizarProcedimiento(articulo.procedimiento)?.portada
                return (
                  <li key={articulo.id}>
                    <Link
                      to={`/soluciones/${categoriaId}/${articulo.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {portada && <MiniaturaPortada referencia={portada.referencia} />}
                        <span className="min-w-0 truncate">{articulo.titulo}</span>
                      </span>
                      <AvanceArticulo articulo={articulo} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {dispositivos.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-400">Dispositivos de esta categoría</h2>
          <ul className="flex flex-col gap-2">
            {dispositivos.map((dispositivo) => (
              <li key={dispositivo.id}>
                <Link
                  to={`/dispositivos/${dispositivo.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                >
                  <span className="min-w-0 truncate">{dispositivo.nombre}</span>
                  <IndicadorEstado estado={dispositivo.estado} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {diagnosticos.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-400">Diagnósticos de esta categoría</h2>
          <ul className="flex flex-col gap-2">
            {diagnosticos.map((diagnostico) => (
              <li key={diagnostico.id}>
                <Link
                  to={`/diagnostico/${diagnostico.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                >
                  <span className="min-w-0 truncate">{diagnostico.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Historial entidadTipo="categoria" entidadId={categoriaId} />
    </div>
  )
}

// Chip "X/Y pasos" para retomar de un vistazo un procedimiento a
// medias, sin tener que abrirlo. Solo se muestra en artículos con
// procedimiento y avance previo (evita ruido en el resto de la lista).
function AvanceArticulo({ articulo }: { articulo: Articulo }) {
  const procedimiento = normalizarProcedimiento(articulo.procedimiento)
  const progreso = useLiveQuery(() => db.progresoPasos.get(articulo.id), [articulo.id])

  if (!procedimiento) return null
  const total = procedimiento.pasos.length
  const hechos = contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((p) => p.id))
  if (hechos === 0) return null

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
        hechos === total
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
          : 'border-amber-800 bg-amber-950/40 text-amber-400'
      }`}
    >
      {hechos}/{total}
    </span>
  )
}
