import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  db,
  type ArticuloRelacionado,
  type Dispositivo,
  type DispositivoAfectado,
  type EstadoArticulo,
  type NivelDificultad,
  type PasoAdjunto,
  type PasoProcedimiento,
  type TipoArticulo,
} from '../../lib/db'
import {
  duplicarProcedimiento,
  normalizarProcedimiento,
  prepararProcedimientoParaGuardar,
} from '../../lib/procedimiento'
import { evaluarCompletitud } from '../../lib/completitud'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { siguienteVersion } from '../../lib/version'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { BotonVolver } from '../../components/BotonVolver'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { Seccion } from '../../components/Seccion'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { buscarArticulosSimilares, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { PasosEditor } from './PasosEditor'
import { hayPlantilla, pasosDePlantilla, plantillaDe } from './plantillas'
import { TIPOS_ARTICULO, tituloEditar, tituloNuevo } from './tiposArticulo'

// La vista previa carga react-markdown, que pesa: se difiere hasta que
// el usuario la pida para no encarecer la apertura del editor.
const VistaPreviaArticulo = lazy(() =>
  import('./VistaPreviaArticulo').then((m) => ({ default: m.VistaPreviaArticulo })),
)

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Editor de articulos, organizado como un constructor guiado (fase S1
// de PROPUESTA_MODULOS.md): cinco bloques con nombre (Informacion
// general, Configuracion, Antes de comenzar, Desarrollo y
// Finalizacion), titulo dinamico segun el tipo, plantillas que
// precargan la estructura recomendada, vista previa antes de guardar,
// duplicado por ?copiarDe=<id> e indicador de completitud.
export function ArticuloForm() {
  const { categoriaId = '', articuloId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(articuloId)

  // Modo duplicar: /soluciones/:categoriaId/nuevo?copiarDe=<id>
  // precarga todo el articulo original con ids internos nuevos.
  const copiarDe = esEdicion ? null : searchParams.get('copiarDe')

  // El id se decide desde el inicio (no al guardar) para que las
  // capturas de los pasos puedan subirse a su carpeta definitiva de
  // Storage antes de que el articulo exista.
  const [id] = useState(() => articuloId ?? nuevoId())

  const articulo = useLiveQuery(
    () => (articuloId ? db.articulos.get(articuloId) : undefined),
    [articuloId],
  )
  const original = useLiveQuery(
    async () => (copiarDe ? ((await db.articulos.get(copiarDe)) ?? null) : null),
    [copiarDe],
  )

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoArticulo>('manual')
  const [contenido, setContenido] = useState('')
  // Etiquetas: retiradas el 2026-07-03 y reactivadas el 2026-07-09 por
  // decision del usuario (fase S1). Se editan como chips y vuelven a
  // indexarse en el buscador.
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  // Descripcion ("¿cuando usar este procedimiento?") y objetivo
  // general ("¿que se logra al completarlo?") conviven: responden
  // preguntas distintas y no se reemplazan entre si.
  const [descripcion, setDescripcion] = useState('')
  const [portada, setPortada] = useState<PasoAdjunto | null>(null)
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
  const [estado, setEstado] = useState<EstadoArticulo>('publicado')
  const [cambioMayor, setCambioMayor] = useState(false)
  const [relacionados, setRelacionados] = useState<ArticuloRelacionado[]>([])
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion && !copiarDe)
  const [guardando, setGuardando] = useState(false)
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false)
  // Tipos cuya oferta de plantilla ya fue descartada en esta sesion
  // del formulario (no volver a insistir al cambiar de tipo y volver).
  const [plantillasDescartadas, setPlantillasDescartadas] = useState<ReadonlySet<TipoArticulo>>(
    new Set(),
  )

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
    () => (esEdicion || copiarDe ? [] : buscarArticulosSimilares(indice, tituloConRebote, id)),
    [indice, tituloConRebote, esEdicion, copiarDe, id],
  )

  useEffect(() => {
    if (!articulo || cargadoInicial) return
    setTitulo(articulo.titulo)
    setTipo(articulo.tipo)
    setEtiquetas(articulo.etiquetas ?? [])
    setContenido(articulo.contenido)
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    setDescripcion(procedimiento?.descripcion ?? '')
    setPortada(procedimiento?.portada ?? null)
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
    setEstado(articulo.estado ?? 'publicado')
    setRelacionados(articulo.relacionados ?? [])
    setCargadoInicial(true)
  }, [articulo, cargadoInicial])

  // Precarga del modo duplicar: todo el contenido del original con ids
  // internos regenerados (duplicarProcedimiento) para que el progreso
  // local jamas se cruce entre el original y la copia. Los adjuntos
  // comparten referencia de Storage (los archivos no se copian) y la
  // marca de ruta de inicio NO se copia para no duplicar destacados.
  useEffect(() => {
    if (!copiarDe || cargadoInicial || original === undefined) return
    if (original === null || original.eliminadoEn) {
      setCargadoInicial(true)
      return
    }
    setTitulo(`Copia de ${original.titulo}`)
    setTipo(original.tipo)
    setEtiquetas(original.etiquetas ?? [])
    setContenido(original.contenido)
    const procedimiento = normalizarProcedimiento(original.procedimiento)
    const copia = procedimiento ? duplicarProcedimiento(procedimiento) : null
    setDescripcion(copia?.descripcion ?? '')
    setPortada(copia?.portada ?? null)
    setObjetivoGeneral(copia?.objetivoGeneral ?? '')
    setRequisitos(copia?.requisitos.join('\n') ?? '')
    setPasos(copia?.pasos ?? [])
    setVerificacionFinal(copia?.verificacionFinal.join('\n') ?? '')
    setTiempoEstimadoMin(copia?.tiempoEstimadoMin ? String(copia.tiempoEstimadoMin) : '')
    setDificultad(copia?.dificultad ?? '')
    setSintomas((original.sintomas ?? []).join('\n'))
    setCausas((original.causas ?? []).join('\n'))
    setDispositivosAfectados(original.dispositivosAfectados ?? [])
    setRelacionados(original.relacionados ?? [])
    // La copia nace en borrador (no se copia el estado del original):
    // es contenido nuevo que aun no paso por revision, aunque el
    // original ya estuviera publicado.
    setEstado('borrador')
    setCargadoInicial(true)
  }, [copiarDe, original, cargadoInicial])

  // El procedimiento tal cual quedaria guardado con lo escrito hasta
  // ahora: lo comparten la vista previa y el indicador de completitud.
  const procedimientoPreparado = useMemo(
    () =>
      prepararProcedimientoParaGuardar({
        descripcion,
        portada,
        objetivoGeneral,
        requisitosTexto: requisitos,
        pasos,
        verificacionFinalTexto: verificacionFinal,
        tiempoEstimadoMin: tiempoEstimadoMin.trim() === '' ? null : Number(tiempoEstimadoMin),
        dificultad: dificultad === '' ? null : dificultad,
      }),
    [descripcion, portada, objetivoGeneral, requisitos, pasos, verificacionFinal, tiempoEstimadoMin, dificultad],
  )

  const completitud = useMemo(
    () => evaluarCompletitud(procedimientoPreparado, etiquetas),
    [procedimientoPreparado, etiquetas],
  )

  // Oferta de plantilla: solo en un articulo nuevo (no edicion ni
  // copia), con el desarrollo aun vacio y si el tipo tiene estructura
  // recomendada que aportar.
  const plantilla = plantillaDe(tipo)
  const ofrecerPlantilla =
    !esEdicion &&
    !copiarDe &&
    hayPlantilla(tipo) &&
    !plantillasDescartadas.has(tipo) &&
    pasos.length === 0 &&
    (plantilla.contenido === '' || contenido.trim() === '')

  function aplicarPlantilla() {
    if (pasos.length === 0 && plantilla.pasos.length > 0) setPasos(pasosDePlantilla(plantilla))
    if (requisitos.trim() === '' && plantilla.requisitos.length > 0) {
      setRequisitos(plantilla.requisitos.join('\n'))
    }
    if (verificacionFinal.trim() === '' && plantilla.verificacionFinal.length > 0) {
      setVerificacionFinal(plantilla.verificacionFinal.join('\n'))
    }
    if (contenido.trim() === '' && plantilla.contenido !== '') setContenido(plantilla.contenido)
  }

  if (esEdicion && articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setGuardando(true)

    // La version solo sube al editar un articulo que YA estaba
    // publicado (comparado con lo que habia en el servidor antes de
    // este guardado): editar un borrador repetidamente no mueve la
    // version hasta que se publique por primera vez.
    const version =
      esEdicion && articulo && articulo.estado === 'publicado'
        ? siguienteVersion(articulo.version ?? '1.0', cambioMayor)
        : (articulo?.version ?? '1.0')

    await guardarRegistro(
      'articulos',
      {
        id,
        categoriaId,
        titulo: titulo.trim(),
        tipo,
        contenido,
        etiquetas,
        procedimiento: procedimientoPreparado,
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
        estado,
        version,
        relacionados,
      },
      motivo.trim(),
    )

    navigate(`/soluciones/${categoriaId}/${id}`)
  }

  if (!cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to={esEdicion ? `/soluciones/${categoriaId}/${articuloId}` : `/soluciones/${categoriaId}`}>
          Volver
        </BotonVolver>
        {/* El titulo dice QUE se esta creando segun el tipo elegido. */}
        <h1 className="text-xl font-semibold">
          {esEdicion ? tituloEditar(tipo) : tituloNuevo(tipo)}
        </h1>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-5">
        <Seccion titulo="Información general" descripcion="Qué es este documento y cómo identificarlo.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Título
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={CLASE_INPUT}
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
                    <span className="flex min-w-0 items-center gap-2">
                      {similar.portadaRef && <MiniaturaPortada referencia={similar.portadaRef} />}
                      <span className="min-w-0 truncate text-sm text-slate-200">{similar.titulo}</span>
                    </span>
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
              className={CLASE_INPUT}
            >
              {TIPOS_ARTICULO.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>

          {ofrecerPlantilla && (
            <div className="flex flex-col gap-2 rounded-xl border border-sky-900/60 bg-sky-950/20 px-4 py-3">
              <p className="text-xs text-sky-200">
                ¿Empezar con la estructura recomendada para {tituloNuevo(tipo).toLowerCase().replace(/^nuev[oa] /, '')}?
                Precarga pasos y campos de ejemplo que solo tienes que editar.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={aplicarPlantilla}
                  className="rounded-lg border border-sky-800 px-3 py-1.5 text-xs text-sky-300"
                >
                  Usar plantilla
                </button>
                <button
                  type="button"
                  onClick={() => setPlantillasDescartadas((actuales) => new Set([...actuales, tipo]))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400"
                >
                  Empezar en blanco
                </button>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Descripción (opcional): ¿cuándo usar este procedimiento?
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Utiliza este procedimiento cuando necesites conectar una impresora de red a un computador con Windows"
              className={CLASE_INPUT}
            />
          </label>

          <PortadaEditor articuloId={id} portada={portada} onChange={setPortada} />

          <EtiquetasEditor etiquetas={etiquetas} onChange={setEtiquetas} />
        </Seccion>

        <Seccion titulo="Configuración" descripcion="Cómo se presenta y qué esperar de él.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoArticulo)} className={CLASE_INPUT}>
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
              <option value="obsoleto">Obsoleto</option>
            </select>
            <span className="text-xs text-slate-500">
              Un borrador u obsoleto no aparece en el buscador, las rutas de inicio, los vínculos de otros
              procedimientos ni el Diagnóstico Inteligente.
            </span>
          </label>

          {esEdicion && articulo?.estado === 'publicado' && (
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={cambioMayor}
                onChange={(e) => setCambioMayor(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Cambio mayor
                <span className="block text-xs text-slate-500">
                  Este guardado subirá la versión {siguienteVersion(articulo.version ?? '1.0', cambioMayor)}
                  {' '}(en vez de {siguienteVersion(articulo.version ?? '1.0', false)}).
                </span>
              </span>
            </label>
          )}

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

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
              Tiempo estimado (minutos, opcional)
              <input
                type="number"
                min={1}
                value={tiempoEstimadoMin}
                onChange={(e) => setTiempoEstimadoMin(e.target.value)}
                className={CLASE_INPUT}
              />
            </label>

            <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
              Dificultad (opcional)
              <select
                value={dificultad}
                onChange={(e) => setDificultad(e.target.value as NivelDificultad | '')}
                className={CLASE_INPUT}
              >
                <option value="">Sin definir</option>
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </label>
          </div>
        </Seccion>

        <Seccion titulo="Antes de comenzar" descripcion="El contexto que el técnico necesita antes del primer paso.">
          {tipo === 'problema_frecuente' && (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Síntomas (uno por línea)
                <textarea
                  rows={3}
                  value={sintomas}
                  onChange={(e) => setSintomas(e.target.value)}
                  placeholder={'No imprime nada\nLuz roja parpadeando\nAtasco de papel frecuente'}
                  className={CLASE_INPUT}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Posibles causas (una por línea)
                <textarea
                  rows={3}
                  value={causas}
                  onChange={(e) => setCausas(e.target.value)}
                  placeholder={'Cable de red suelto\nTóner agotado\nSpooler de impresión caído'}
                  className={CLASE_INPUT}
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
              className={CLASE_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Requisitos, "Antes de empezar" (uno por línea, opcional)
            <textarea
              rows={3}
              value={requisitos}
              onChange={(e) => setRequisitos(e.target.value)}
              placeholder={'Acceso a la red\nPermisos de administrador\nConexión VPN activa'}
              className={CLASE_INPUT}
            />
          </label>
        </Seccion>

        <Seccion titulo="Desarrollo" descripcion="Los pasos del procedimiento, con sus tareas, advertencias e imágenes.">
          <PasosEditor articuloId={id} pasos={pasos} onPasosChange={setPasos} />
        </Seccion>

        <Seccion titulo="Finalización" descripcion="Cómo confirmar que quedó bien y las notas de cierre.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            ✅ Verificación final (una por línea, opcional)
            <textarea
              rows={3}
              value={verificacionFinal}
              onChange={(e) => setVerificacionFinal(e.target.value)}
              placeholder={'La impresora aparece instalada\nLa impresión de prueba fue exitosa'}
              className={CLASE_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            {pasos.length > 0 ? '📝 Notas adicionales (opcional, admite Markdown)' : 'Contenido (admite Markdown)'}
            <textarea
              required={pasos.length === 0}
              rows={pasos.length > 0 ? 4 : 10}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              className={`${CLASE_INPUT} font-mono`}
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
                className={CLASE_INPUT}
              />
            </label>
          )}
        </Seccion>

        <Seccion titulo="Relacionados" descripcion="Otros artículos conectados con este, para no duplicar información.">
          <RelacionadosEditor
            articuloId={id}
            vinculados={relacionados}
            onVincular={(articuloVinculado) =>
              setRelacionados((actuales) => [...actuales, articuloVinculado])
            }
            onQuitar={(idQuitar) =>
              setRelacionados((actuales) => actuales.filter((r) => r.id !== idQuitar))
            }
          />
        </Seccion>

        {pasos.length > 0 && <IndicadorCompletitud completitud={completitud} />}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMostrarVistaPrevia(true)}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300"
          >
            Vista previa
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {/* El nombre completo aclara QUE se guarda, ahora que el
                formulario convive con mas acciones (volver, eliminar). */}
            {guardando ? 'Guardando...' : pasos.length > 0 ? 'Guardar procedimiento' : 'Guardar artículo'}
          </button>
        </div>
      </form>

      {mostrarVistaPrevia && (
        <Suspense fallback={<p className="text-sm text-slate-400">Preparando la vista previa...</p>}>
          <VistaPreviaArticulo
            articuloId={id}
            titulo={titulo}
            tipo={tipo}
            etiquetas={etiquetas}
            procedimiento={procedimientoPreparado}
            contenido={contenido}
            onCerrar={() => setMostrarVistaPrevia(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

// Barra de completitud del procedimiento: una guia de que agregar para
// que la documentacion quede completa. Nunca bloquea el guardado.
function IndicadorCompletitud({
  completitud,
}: {
  completitud: { porcentaje: number; sugerencias: string[] }
}) {
  const [abierto, setAbierto] = useState(false)
  const completo = completitud.porcentaje === 100

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          Completitud: <span className="font-semibold">{completitud.porcentaje} %</span>
        </p>
        {!completo && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="text-xs text-sky-400 underline underline-offset-2"
          >
            {abierto ? 'Ocultar sugerencias' : `Ver sugerencias (${completitud.sugerencias.length})`}
          </button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${completo ? 'bg-emerald-500' : 'bg-sky-500'}`}
          style={{ width: `${completitud.porcentaje}%` }}
        />
      </div>
      {abierto && !completo && (
        <ul className="flex flex-col gap-1">
          {completitud.sugerencias.map((sugerencia) => (
            <li key={sugerencia} className="text-xs text-slate-400">
              • {sugerencia}
            </li>
          ))}
        </ul>
      )}
      {completo && <p className="text-xs text-emerald-400">Documentación completa. ✓</p>}
    </div>
  )
}

// Editor de etiquetas como chips: Enter o coma agregan, ✕ quita. Se
// guardan como lista y alimentan el indice de busqueda.
function EtiquetasEditor({
  etiquetas,
  onChange,
}: {
  etiquetas: string[]
  onChange: (etiquetas: string[]) => void
}) {
  const [texto, setTexto] = useState('')

  // Vocabulario derivado (fase N0): las etiquetas ya usadas en otros
  // artículos se ofrecen como autocompletar, para reutilizar la misma
  // ("Impresora") en vez de fragmentarla ("impresora", "impresoras").
  // Se excluyen las ya puestas en este artículo.
  const todas = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const sugeridas = useMemo(() => {
    const puestas = new Set(etiquetas.map((e) => e.toLowerCase()))
    const porClave = new Map<string, string>()
    for (const articulo of todas) {
      for (const etiqueta of articulo.etiquetas ?? []) {
        const limpia = etiqueta.trim()
        const clave = limpia.toLowerCase()
        if (limpia === '' || puestas.has(clave) || porClave.has(clave)) continue
        porClave.set(clave, limpia)
      }
    }
    return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  }, [todas, etiquetas])

  function agregar() {
    const limpia = texto.trim().replace(/,+$/, '').trim()
    setTexto('')
    if (limpia === '') return
    if (etiquetas.some((e) => e.toLowerCase() === limpia.toLowerCase())) return
    onChange([...etiquetas, limpia])
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-slate-300">
      <span>Etiquetas (opcional): mejoran los resultados del buscador</span>
      {etiquetas.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {etiquetas.map((etiqueta) => (
            <li
              key={etiqueta}
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
            >
              {etiqueta}
              <button
                type="button"
                onClick={() => onChange(etiquetas.filter((e) => e !== etiqueta))}
                aria-label={`Quitar la etiqueta ${etiqueta}`}
                className="text-slate-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="text"
        list="etiquetas-sugeridas"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            agregar()
          }
        }}
        onBlur={agregar}
        placeholder="Escribe una etiqueta y presiona Enter (SQL, Backup, POS, Impresora...)"
        className={CLASE_INPUT}
      />
      <datalist id="etiquetas-sugeridas">
        {sugeridas.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
    </div>
  )
}

// Imagen de portada opcional del procedimiento: identifica el
// articulo de un vistazo en el listado, el buscador, las rutas de
// aprendizaje y las recomendaciones. Se sube igual que los adjuntos
// de paso (comprimida en el telefono, encolada si no hay señal) y en
// el articulo solo queda la referencia de Storage. Solo se guarda si
// el articulo termina teniendo pasos (vive en el JSON `procedimiento`).
function PortadaEditor({
  articuloId,
  portada,
  onChange,
}: {
  articuloId: string
  portada: PasoAdjunto | null
  onChange: (portada: PasoAdjunto | null) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const url = useUrlAdjunto(portada?.referencia ?? null)

  async function subir(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setError(null)
    setAviso(null)
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    setSubiendo(true)
    try {
      const archivoFinal = await comprimirImagen(archivo)
      const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `articulos/${articuloId}/portada/${Date.now()}-${nombreLimpio}`
      const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
      if (resultado === 'encolado') {
        setAviso('Sin conexión: la portada quedó guardada en este dispositivo y se subirá sola al recuperar señal.')
      }
      onChange({ referencia, nombre: archivoFinal.name, tipo: archivoFinal.type })
    } catch {
      setError(`No se pudo subir la portada: ${archivo.name}`)
    }
    setSubiendo(false)
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-slate-300">
      <span>🖼 Imagen de portada (opcional)</span>
      <div className="flex items-center gap-3">
        {portada &&
          (url ? (
            <img
              src={url}
              alt="Portada del procedimiento"
              className="h-16 w-24 shrink-0 rounded-lg border border-slate-800 object-cover"
            />
          ) : (
            <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-500">
              🖼
            </div>
          ))}
        <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {subiendo ? 'Subiendo...' : portada ? 'Cambiar imagen' : '+ Elegir imagen'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendo}
            onChange={(evento) => void subir(evento)}
          />
        </label>
        {portada && !subiendo && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-slate-400 underline underline-offset-2"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Se muestra en el listado, el buscador y las rutas de aprendizaje para identificar el
        procedimiento de un vistazo.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {aviso && <p className="text-xs text-amber-300">{aviso}</p>}
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

// Otros articulos relacionados (grupo de esquema, punto 11): mismo
// patron de chips + select que DispositivosAfectadosEditor, con
// copia de referencia (id + titulo). La ficha del articulo muestra
// ademas el inverso ("aparece como relacionado en..."), calculado
// localmente sin guardarlo aqui.
function RelacionadosEditor({
  articuloId,
  vinculados,
  onVincular,
  onQuitar,
}: {
  articuloId: string
  vinculados: ArticuloRelacionado[]
  onVincular: (articulo: ArticuloRelacionado) => void
  onQuitar: (id: string) => void
}) {
  const candidatos = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && a.id !== articuloId).toArray(),
    [articuloId],
    [],
  )
  const candidatosOrdenados = useMemo(
    () => [...candidatos].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [candidatos],
  )
  const disponibles = candidatosOrdenados.filter((a) => !vinculados.some((v) => v.id === a.id))

  return (
    <div className="flex flex-col gap-2">
      {vinculados.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {vinculados.map((vinculo) => (
            <li
              key={vinculo.id}
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
            >
              {vinculo.titulo}
              <button
                type="button"
                onClick={() => onQuitar(vinculo.id)}
                aria-label={`Quitar ${vinculo.titulo} de relacionados`}
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
          aria-label="Agregar artículo relacionado"
          onChange={(e) => {
            const articulo = disponibles.find((a) => a.id === e.target.value)
            if (articulo) onVincular({ id: articulo.id, titulo: articulo.titulo })
          }}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">+ Agregar artículo relacionado (opcional)</option>
          {disponibles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.titulo}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
