import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type Articulo, type ArticuloRelacionado, type EstadoArticulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonCompartir } from '../../components/BotonCompartir'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { ReferenciadoPor } from '../../components/ReferenciadoPor'
import { useGrafo } from '../../components/useGrafo'
import { resumenImpacto } from '../../lib/grafo'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { Historial } from '../historial/Historial'
import { ProcedimientoVista } from './ProcedimientoVista'
import { etiquetaDeTipo } from './tiposArticulo'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export function ArticuloPage() {
  const { categoriaId = '', articuloId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])
  const autor = useLiveQuery(
    () => (articulo?.updatedBy ? db.perfiles.get(articulo.updatedBy) : undefined),
    [articulo?.updatedBy],
  )

  // Memorizado para que los ids generados al normalizar datos viejos
  // sean estables entre renders (el progreso local depende de ellos).
  const procedimiento = useMemo(() => normalizarProcedimiento(articulo?.procedimiento), [articulo])

  // Impacto antes de eliminar (fase N1): otros procedimientos o
  // diagnósticos que referencian este artículo y quedarían con el
  // vínculo roto. null si nadie lo usa.
  const grafo = useGrafo()
  const impacto = useMemo(() => resumenImpacto(grafo, 'articulo', articuloId), [grafo, articuloId])

  const idVisitado = articulo && !articulo.eliminadoEn ? articulo.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('articulo', idVisitado)
  }, [idVisitado])

  if (articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />
  if (!articulo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  async function eliminar() {
    await eliminarRegistro('articulos', articuloId)
    navigate(`/soluciones/${categoriaId}`)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to={`/soluciones/${categoriaId}`}>{categoria?.nombre ?? 'Categoría'}</BotonVolver>
        {procedimiento?.portada && <PortadaArticulo portada={procedimiento.portada} titulo={articulo.titulo} />}
        <EstadoArticuloBanda estado={articulo.estado ?? 'publicado'} />
        <div>
          <h1 className="text-xl font-semibold">{articulo.titulo}</h1>
          <p className="text-xs text-slate-500">
            {etiquetaDeTipo(articulo.tipo)} · v{articulo.version ?? '1.0'}
          </p>
          <p className="text-xs text-slate-600">
            Última modificación: {formateadorFecha.format(new Date(articulo.updatedAt))}
            {autor?.nombre ? `, por ${autor.nombre}` : ''}
          </p>
          {(articulo.etiquetas ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {articulo.etiquetas.map((etiqueta) => (
                <li
                  key={etiqueta}
                  className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-400"
                >
                  {etiqueta}
                </li>
              ))}
            </ul>
          )}
        </div>
        {procedimiento?.descripcion && (
          <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            {procedimiento.descripcion}
          </p>
        )}
      </header>

      {procedimiento && (
        <Link
          to={`/soluciones/${categoriaId}/${articuloId}/ejecutar`}
          className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950"
        >
          ▶ Modo asistente
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        <BotonCompartir titulo={articulo.titulo} />
        <Link
          to={`/soluciones/${categoriaId}/${articuloId}/editar`}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Editar
        </Link>
        <Link
          to={`/soluciones/${categoriaId}/nuevo?copiarDe=${articuloId}`}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Duplicar
        </Link>
        <button
          type="button"
          onClick={() => setMostrarEliminar(true)}
          className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
        >
          Eliminar
        </button>
      </div>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={
          procedimiento
            ? `¿Eliminar procedimiento "${articulo.titulo}"?`
            : `¿Eliminar artículo "${articulo.titulo}"?`
        }
        descripcion={
          procedimiento
            ? 'Esta acción eliminará todo el procedimiento y sus pasos asociados.'
            : 'Esta acción eliminará el artículo por completo.'
        }
        advertencia={impacto ? `${impacto} Al eliminarlo, esos vínculos quedarán rotos.` : null}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      {articulo.tipo === 'problema_frecuente' && <IncidenciaResumen articulo={articulo} />}

      <ArticulosRelacionados articuloId={articuloId} relacionados={articulo.relacionados ?? []} />

      {/* Inverso universal: qué procedimientos y diagnósticos usan este
          artículo. Se excluye 'relacionado', que ya tiene su propio
          bloque ("Aparece como relacionado en") arriba. */}
      <ReferenciadoPor
        tipo="articulo"
        id={articuloId}
        relaciones={['subprocedimiento', 'solucion', 'decision', 'diagnostico_articulo']}
      />

      {procedimiento && <ProcedimientoVista articuloId={articuloId} procedimiento={procedimiento} />}

      {articulo.contenido.trim() !== '' && (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-a:text-sky-400">
          <Markdown remarkPlugins={[remarkGfm]}>{articulo.contenido}</Markdown>
        </article>
      )}

      {/* En los procedimientos, los adjuntos viven en cada paso (donde
          se usan). El apartado del articulo solo se muestra para
          articulos sin procedimiento (manuales en Markdown), que no
          tienen pasos donde anclar el archivo. */}
      {!procedimiento && <Adjuntos entidadTipo="articulo" entidadId={articuloId} />}

      <Historial entidadTipo="articulo" entidadId={articuloId} />
    </div>
  )
}

// Banda de estado (grupo de esquema): 'publicado' no se muestra (es
// el estado normal, no necesita aviso); borrador u obsoleto se
// destacan para que quien lo abre sepa que no es contenido oficial.
function EstadoArticuloBanda({ estado }: { estado: EstadoArticulo }) {
  if (estado === 'publicado') return null
  const info =
    estado === 'borrador'
      ? { texto: '📝 Borrador: sin publicar todavía', clases: 'border-amber-800 bg-amber-950/40 text-amber-300' }
      : { texto: '⚠ Obsoleto: puede estar desactualizado', clases: 'border-red-900 bg-red-950/40 text-red-300' }
  return (
    <p className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${info.clases}`}>{info.texto}</p>
  )
}

// Articulos relacionados (grupo de esquema, punto 11): los que este
// articulo vincula, mas el inverso ("aparece como relacionado en..."),
// calculado localmente sobre el resto de articulos sin guardarlo aqui
// (bonus barato de la propuesta: nadie tiene que vincular en las dos
// direcciones a mano).
function ArticulosRelacionados({
  articuloId,
  relacionados,
}: {
  articuloId: string
  relacionados: ArticuloRelacionado[]
}) {
  // Se necesita la categoria de cada articulo relacionado para poder
  // enlazarlo (la ruta es /soluciones/:categoriaId/:articuloId): se
  // trae la lista completa una sola vez y se arma un mapa id -> ruta.
  const todos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const rutaPorId = useMemo(
    () => new Map(todos.map((a) => [a.id, `/soluciones/${a.categoriaId}/${a.id}`])),
    [todos],
  )
  const inversos = useMemo(
    () =>
      todos
        .filter((a) => a.id !== articuloId && (a.relacionados ?? []).some((r) => r.id === articuloId))
        .map((a) => ({ id: a.id, titulo: a.titulo })),
    [todos, articuloId],
  )

  if (relacionados.length === 0 && inversos.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
      {relacionados.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Relacionados</h2>
          <ul className="flex flex-wrap gap-2">
            {relacionados.map((articulo) => (
              <li key={articulo.id}>
                {rutaPorId.has(articulo.id) ? (
                  <Link
                    to={rutaPorId.get(articulo.id) ?? ''}
                    className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-sky-400"
                  >
                    {articulo.titulo}
                  </Link>
                ) : (
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-500">
                    {articulo.titulo} (eliminado)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {inversos.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Aparece como relacionado en</h2>
          <ul className="flex flex-wrap gap-2">
            {inversos.map((articulo) => (
              <li key={articulo.id}>
                <Link
                  to={rutaPorId.get(articulo.id) ?? ''}
                  className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-sky-400"
                >
                  {articulo.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Imagen de portada del procedimiento como banner sobre el titulo.
// Si la imagen aun no esta disponible (offline sin cache) no se
// muestra nada: la pagina queda como la de un articulo sin portada.
function PortadaArticulo({ portada, titulo }: { portada: { referencia: string }; titulo: string }) {
  const url = useUrlAdjunto(portada.referencia)
  if (!url) return null
  return (
    <img
      src={url}
      alt={`Portada: ${titulo}`}
      className="max-h-44 w-full rounded-xl border border-slate-800 object-cover"
    />
  )
}

// Estructura de una incidencia: sintomas, posibles causas y los
// dispositivos que la sufren. La solucion en si es el procedimiento
// del articulo (ProcedimientoVista), que se muestra aparte. `?? []`
// defiende contra una base que aun no tiene estas columnas.
function IncidenciaResumen({ articulo }: { articulo: Articulo }) {
  const sintomas = articulo.sintomas ?? []
  const causas = articulo.causas ?? []
  const dispositivosAfectados = articulo.dispositivosAfectados ?? []

  if (sintomas.length === 0 && causas.length === 0 && dispositivosAfectados.length === 0) return null

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
      {sintomas.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Síntomas</h2>
          <ul className="flex flex-col gap-1">
            {sintomas.map((sintoma, indice) => (
              <li key={indice} className="text-sm text-slate-200">
                • {sintoma}
              </li>
            ))}
          </ul>
        </div>
      )}

      {causas.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Posibles causas</h2>
          <ul className="flex flex-col gap-1">
            {causas.map((causa, indice) => (
              <li key={indice} className="text-sm text-slate-200">
                • {causa}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dispositivosAfectados.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Dispositivos afectados</h2>
          <ul className="flex flex-wrap gap-2">
            {dispositivosAfectados.map((dispositivo) => (
              <li key={dispositivo.id}>
                <Link
                  to={`/dispositivos/${dispositivo.id}`}
                  className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-sky-400"
                >
                  {dispositivo.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
