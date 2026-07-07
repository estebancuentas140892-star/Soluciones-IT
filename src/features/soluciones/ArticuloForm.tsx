import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type PasoProcedimiento, type TipoArticulo } from '../../lib/db'
import { normalizarProcedimiento, prepararProcedimientoParaGuardar } from '../../lib/procedimiento'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { BotonVolver } from '../../components/BotonVolver'
import { PasosEditor } from './PasosEditor'
import { TIPOS_ARTICULO } from './tiposArticulo'

export function ArticuloForm() {
  const { categoriaId = '', articuloId } = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(articuloId)

  // El id se decide desde el inicio (no al guardar) para que las
  // capturas de los pasos puedan subirse a su carpeta definitiva de
  // Storage antes de que el articulo exista.
  const [id] = useState(() => articuloId ?? nuevoId())

  const articulo = useLiveQuery(
    () => (articuloId ? db.articulos.get(articuloId) : undefined),
    [articuloId],
  )

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoArticulo>('manual')
  const [contenido, setContenido] = useState('')
  // Etiquetas y requisitos ya no se editan (rediseño del 2026-07-03),
  // pero los articulos guardados antes los conservan: se cargan y se
  // devuelven tal cual al guardar para no borrar datos existentes.
  const [etiquetas, setEtiquetas] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [pasos, setPasos] = useState<PasoProcedimiento[]>([])
  const [esRutaInicio, setEsRutaInicio] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!articulo || cargadoInicial) return
    setTitulo(articulo.titulo)
    setTipo(articulo.tipo)
    setEtiquetas(articulo.etiquetas.join(', '))
    setContenido(articulo.contenido)
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    setRequisitos(procedimiento?.requisitos.join('\n') ?? '')
    setPasos(procedimiento?.pasos ?? [])
    setEsRutaInicio(articulo.esRutaInicio)
    setCargadoInicial(true)
  }, [articulo, cargadoInicial])

  if (esEdicion && articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setGuardando(true)

    await guardarRegistro(
      'articulos',
      {
        id,
        categoriaId,
        titulo: titulo.trim(),
        tipo,
        contenido,
        etiquetas: etiquetas
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
        procedimiento: prepararProcedimientoParaGuardar(requisitos, pasos),
        esRutaInicio,
      },
      motivo.trim(),
    )

    navigate(`/soluciones/${categoriaId}/${id}`)
  }

  if (esEdicion && !cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <header className="flex flex-col gap-2">
        <BotonVolver to={esEdicion ? `/soluciones/${categoriaId}/${articuloId}` : `/soluciones/${categoriaId}`}>
          Volver
        </BotonVolver>
        <h1 className="text-xl font-semibold">{esEdicion ? 'Editar artículo' : 'Nuevo artículo'}</h1>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Título
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoArticulo)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {TIPOS_ARTICULO.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={esRutaInicio}
            onChange={(e) => setEsRutaInicio(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Destacar en Inicio como ruta de aprendizaje
            <span className="block text-xs text-slate-500">
              Para guías como "Primer día en TI": aparece en un acceso destacado en la pantalla de Inicio.
            </span>
          </span>
        </label>

        <PasosEditor articuloId={id} pasos={pasos} onPasosChange={setPasos} />

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {pasos.length > 0 ? 'Notas adicionales (opcional, admite Markdown)' : 'Contenido (admite Markdown)'}
          <textarea
            required={pasos.length === 0}
            rows={pasos.length > 0 ? 4 : 10}
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        {esEdicion && (
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Motivo del cambio (opcional)
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué se actualizó este artículo?"
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
