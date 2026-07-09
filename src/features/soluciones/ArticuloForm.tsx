import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  db,
  type Dispositivo,
  type DispositivoAfectado,
  type NivelDificultad,
  type PasoProcedimiento,
  type TipoArticulo,
} from '../../lib/db'
import { normalizarProcedimiento, prepararProcedimientoParaGuardar } from '../../lib/procedimiento'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { BotonVolver } from '../../components/BotonVolver'
import { buscarArticulosSimilares, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
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
  // Etiquetas ya no se editan (rediseño del 2026-07-03), pero los
  // articulos guardados antes las conservan: se cargan y se devuelven
  // tal cual al guardar para no borrar datos existentes.
  const [etiquetas, setEtiquetas] = useState('')
  const [objetivoGeneral, setObjetivoGeneral] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [pasos, setPasos] = useState<PasoProcedimiento[]>([])
  const [verificacionFinal, setVerificacionFinal] = useState('')
  const [tiempoEstimadoMin, setTiempoEstimadoMin] = useState('')
  const [dificultad, setDificultad] = useState<NivelDificultad | ''>('')
  // Estructura de una incidencia (solo se muestra con tipo
  // 'problema_frecuente'). El `?? []` defiende contra una base que
  // aun no tiene estas columnas (schema.sql pendiente de aplicar).
  const [sintomas, setSintomas] = useState('')
  const [causas, setCausas] = useState('')
  const [dispositivosAfectados, setDispositivosAfectados] = useState<DispositivoAfectado[]>([])
  const [esRutaInicio, setEsRutaInicio] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const dispositivosOrdenados = useMemo(
    () => [...dispositivos].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [dispositivos],
  )

  // Anti duplicados: al escribir el titulo de un articulo NUEVO se
  // buscan articulos con titulo parecido y se ofrece abrirlos en lugar
  // de crear otro. Con rebote de 300 ms para no buscar en cada tecla.
  const indice = useIndiceBusqueda()
  const [tituloConRebote, setTituloConRebote] = useState('')
  useEffect(() => {
    const temporizador = setTimeout(() => setTituloConRebote(titulo), 300)
    return () => clearTimeout(temporizador)
  }, [titulo])
  const similares = useMemo(
    () => (esEdicion ? [] : buscarArticulosSimilares(indice, tituloConRebote, id)),
    [indice, tituloConRebote, esEdicion, id],
  )

  useEffect(() => {
    if (!articulo || cargadoInicial) return
    setTitulo(articulo.titulo)
    setTipo(articulo.tipo)
    setEtiquetas(articulo.etiquetas.join(', '))
    setContenido(articulo.contenido)
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    setObjetivoGeneral(procedimiento?.objetivoGeneral ?? '')
    setRequisitos(procedimiento?.requisitos.join('\n') ?? '')
    setPasos(procedimiento?.pasos ?? [])
    setVerificacionFinal(procedimiento?.verificacionFinal.join('\n') ?? '')
    setTiempoEstimadoMin(procedimiento?.tiempoEstimadoMin ? String(procedimiento.tiempoEstimadoMin) : '')
    setDificultad(procedimiento?.dificultad ?? '')
    setSintomas((articulo.sintomas ?? []).join('\n'))
    setCausas((articulo.causas ?? []).join('\n'))
    setDispositivosAfectados(articulo.dispositivosAfectados ?? [])
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
        procedimiento: prepararProcedimientoParaGuardar({
          objetivoGeneral,
          requisitosTexto: requisitos,
          pasos,
          verificacionFinalTexto: verificacionFinal,
          tiempoEstimadoMin: tiempoEstimadoMin.trim() === '' ? null : Number(tiempoEstimadoMin),
          dificultad: dificultad === '' ? null : dificultad,
        }),
        sintomas: sintomas
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        causas: causas
          .split('\n')
          .map((c) => c.trim())
          .filter(Boolean),
        dispositivosAfectados,
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

        {similares.length > 0 && (
          <div className="rounded-xl border border-sky-900/60 bg-sky-950/20 px-4 py-3">
            <p className="text-xs font-medium text-sky-200">
              Ya existen artículos parecidos. ¿Es alguno de estos? Ábrelo en lugar de crear uno nuevo.
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {similares.map((similar) => (
                <li key={similar.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-slate-200">{similar.titulo}</span>
                  <Link
                    to={similar.ruta}
                    className="shrink-0 text-xs text-sky-300 underline underline-offset-2"
                  >
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {tipo === 'problema_frecuente' && (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Síntomas (uno por línea)
              <textarea
                rows={3}
                value={sintomas}
                onChange={(e) => setSintomas(e.target.value)}
                placeholder={'No imprime nada\nLuz roja parpadeando\nAtasco de papel frecuente'}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Posibles causas (una por línea)
              <textarea
                rows={3}
                value={causas}
                onChange={(e) => setCausas(e.target.value)}
                placeholder={'Cable de red suelto\nTóner agotado\nSpooler de impresión caído'}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>

            <DispositivosAfectadosEditor
              vinculados={dispositivosAfectados}
              dispositivos={dispositivosOrdenados}
              onVincular={(dispositivo) =>
                setDispositivosAfectados((actuales) => [
                  ...actuales,
                  { id: dispositivo.id, nombre: dispositivo.nombre },
                ])
              }
              onQuitar={(id) =>
                setDispositivosAfectados((actuales) => actuales.filter((d) => d.id !== id))
              }
            />
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          🎯 Objetivo general del procedimiento (opcional, 1 línea)
          <input
            type="text"
            value={objetivoGeneral}
            onChange={(e) => setObjetivoGeneral(e.target.value)}
            placeholder="Qué se logra al completar todo el procedimiento"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
            Tiempo estimado (minutos, opcional)
            <input
              type="number"
              min={1}
              value={tiempoEstimadoMin}
              onChange={(e) => setTiempoEstimadoMin(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>

          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
            Dificultad (opcional)
            <select
              value={dificultad}
              onChange={(e) => setDificultad(e.target.value as NivelDificultad | '')}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Sin definir</option>
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Requisitos, "Antes de empezar" (uno por línea, opcional)
          <textarea
            rows={3}
            value={requisitos}
            onChange={(e) => setRequisitos(e.target.value)}
            placeholder={'Acceso a la red\nPermisos de administrador\nConexión VPN activa'}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <PasosEditor articuloId={id} pasos={pasos} onPasosChange={setPasos} />

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          ✅ Verificación final (una por línea, opcional)
          <textarea
            rows={3}
            value={verificacionFinal}
            onChange={(e) => setVerificacionFinal(e.target.value)}
            placeholder={'La impresora aparece instalada\nLa impresión de prueba fue exitosa'}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {pasos.length > 0 ? '📝 Notas adicionales (opcional, admite Markdown)' : 'Contenido (admite Markdown)'}
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
            📖 Motivo del cambio (opcional)
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
          {/* El nombre completo aclara QUE se guarda, ahora que el
              formulario convive con mas acciones (volver, eliminar). */}
          {guardando ? 'Guardando...' : pasos.length > 0 ? 'Guardar procedimiento' : 'Guardar artículo'}
        </button>
      </form>
    </div>
  )
}

// Vinculo de una incidencia con los dispositivos que la sufren: mismo
// patron que CredencialSelector en PasosEditor.tsx (id real mas copia
// del nombre), pero con varios elementos en vez de uno solo.
function DispositivosAfectadosEditor({
  vinculados,
  dispositivos,
  onVincular,
  onQuitar,
}: {
  vinculados: DispositivoAfectado[]
  dispositivos: Dispositivo[]
  onVincular: (dispositivo: Dispositivo) => void
  onQuitar: (id: string) => void
}) {
  const disponibles = dispositivos.filter((d) => !vinculados.some((v) => v.id === d.id))

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-slate-300">Dispositivos afectados</span>

      {vinculados.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {vinculados.map((vinculo) => (
            <li
              key={vinculo.id}
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
            >
              {vinculo.nombre}
              <button
                type="button"
                onClick={() => onQuitar(vinculo.id)}
                aria-label={`Quitar ${vinculo.nombre} de dispositivos afectados`}
                className="text-slate-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {disponibles.length > 0 && (
        <select
          value=""
          aria-label="Agregar dispositivo afectado"
          onChange={(e) => {
            const dispositivo = disponibles.find((d) => d.id === e.target.value)
            if (dispositivo) onVincular(dispositivo)
          }}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">+ Agregar dispositivo afectado (opcional)</option>
          {disponibles.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
              {d.ubicacion ? ` (${d.ubicacion})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
