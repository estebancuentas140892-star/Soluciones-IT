import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  db,
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
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { siguienteVersion } from '../../lib/version'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  CaretDown,
  CaretUp,
  Check,
  Circle,
  Eye,
  FloppyDisk,
  Info,
  LinkSimple,
  Sparkle,
  X,
} from '../../components/iconos'
import { BotonVolver } from '../../components/BotonVolver'
import { TagNeutral, TituloSeccion } from '../../components/nocturne'
import { buscarArticulosSimilares, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { PasosEditor } from './PasosEditor'
import { hayPlantilla, pasosDePlantilla, plantillaDe } from './plantillas'
import { colorIconoDeTipo, iconoDeTipo } from './iconosSoluciones'
import { tituloEditar, tituloNuevo } from './tiposArticulo'

// La vista previa carga react-markdown, que pesa: se difiere hasta que
// el usuario la pida para no encarecer la apertura del editor.
const VistaPreviaArticulo = lazy(() =>
  import('./VistaPreviaArticulo').then((m) => ({ default: m.VistaPreviaArticulo })),
)

// Los seis tipos de documento como rejilla (handoff "Editor de
// Artículo"): etiqueta singular, icono de dominio y color del icono
// segun el color de identidad del tipo (colorIconoDeTipo): cada tipo
// operativo con su propio color, la incidencia en precaución, el
// mantenimiento en éxito y el manual neutro.
const TIPOS_GRID: { valor: TipoArticulo; etiqueta: string }[] = [
  { valor: 'instalacion', etiqueta: 'Instalación' },
  { valor: 'configuracion', etiqueta: 'Configuración' },
  { valor: 'conexion', etiqueta: 'Conexión' },
  { valor: 'problema_frecuente', etiqueta: 'Problema frecuente' },
  { valor: 'mantenimiento', etiqueta: 'Mantenimiento' },
  { valor: 'manual', etiqueta: 'Manual' },
]

const ESTADOS: { valor: EstadoArticulo; etiqueta: string }[] = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'publicado', etiqueta: 'Publicado' },
  { valor: 'obsoleto', etiqueta: 'Obsoleto' },
]

const DIFICULTADES: { valor: NivelDificultad; etiqueta: string }[] = [
  { valor: 'principiante', etiqueta: 'Principiante' },
  { valor: 'intermedio', etiqueta: 'Intermedio' },
  { valor: 'avanzado', etiqueta: 'Avanzado' },
]

// Clases compartidas de los campos de texto del editor (borde divisor,
// fondo de superficie y foco en el acento).
const CLASE_CAMPO =
  'w-full rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent'
const CLASE_ETIQUETA = 'text-[12.5px] font-medium text-noct-neutral-400'

// Editor de articulos rediseñado al sistema Nocturne (handoff "Editor de
// Artículo"): cabecera pegajosa con el tipo dinamico, rejilla de tipos,
// pasos, y las secciones "Detalles" y "Publicación" plegadas, mas una
// barra inferior fija con la completitud y las acciones. Conserva la
// carga (edicion, duplicado y creacion contextual) y el guardado del
// editor previo; los campos que este diseño no muestra (equipos donde
// aplica, adjuntos de paso, relacionados, orden en la ruta de inicio) se
// conservan tal cual estaban al guardar, no se pierden.
export function ArticuloForm() {
  const { categoriaId = '', articuloId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(articuloId)

  const copiarDe = esEdicion ? null : searchParams.get('copiarDe')
  const tipoContextual = !esEdicion && !copiarDe ? searchParams.get('tipo') : null
  const dispositivoContextualId = !esEdicion && !copiarDe ? searchParams.get('dispositivoAfectado') : null
  const dispositivoContextualNombre = searchParams.get('dispositivoNombre') ?? ''

  const [id] = useState(() => articuloId ?? nuevoId())

  const articulo = useLiveQuery(
    () => (articuloId ? db.articulos.get(articuloId) : undefined),
    [articuloId],
  )
  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])
  const original = useLiveQuery(
    async () => (copiarDe ? ((await db.articulos.get(copiarDe)) ?? null) : null),
    [copiarDe],
  )

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoArticulo>(() => {
    const valido = TIPOS_GRID.some((t) => t.valor === tipoContextual)
    return valido ? (tipoContextual as TipoArticulo) : 'manual'
  })
  const [contenido, setContenido] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [descripcion, setDescripcion] = useState('')
  const [portada, setPortada] = useState<PasoAdjunto | null>(null)
  const [objetivoGeneral, setObjetivoGeneral] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [pasos, setPasos] = useState<PasoProcedimiento[]>([])
  const [verificacionFinal, setVerificacionFinal] = useState('')
  const [tiempoEstimadoMin, setTiempoEstimadoMin] = useState('')
  const [dificultad, setDificultad] = useState<NivelDificultad | ''>('')
  const [sintomas, setSintomas] = useState('')
  const [causas, setCausas] = useState('')
  const [esRutaInicio, setEsRutaInicio] = useState(false)
  const [estado, setEstado] = useState<EstadoArticulo>('borrador')
  const [motivo, setMotivo] = useState('')
  // Campos que este diseño no ofrece pero que se conservan al guardar:
  // el articulo original puede tenerlos y no deben perderse. Se cargan de
  // la base y se reescriben tal cual (ver manejarEnvio).
  const [dispositivosAfectados, setDispositivosAfectados] = useState(
    dispositivoContextualId ? [{ id: dispositivoContextualId, nombre: dispositivoContextualNombre }] : [],
  )
  const [ordenRutaInicio, setOrdenRutaInicio] = useState(0)
  const [relacionados, setRelacionados] = useState<{ id: string; titulo: string }[]>([])

  // Candidatos para "Artículos relacionados": todos los articulos vivos
  // salvo este mismo (mismo criterio que el editor anterior, sin
  // exigir que tengan procedimiento).
  const candidatosRelacionados = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && a.id !== id).toArray(),
    [id],
    [],
  )
  const relacionadosDisponibles = useMemo(() => {
    const yaVinculados = new Set(relacionados.map((r) => r.id))
    return [...candidatosRelacionados]
      .filter((a) => !yaVinculados.has(a.id))
      .sort((a, b) => a.titulo.localeCompare(b.titulo))
  }, [candidatosRelacionados, relacionados])

  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion && !copiarDe)
  const [guardando, setGuardando] = useState(false)
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false)
  const [similaresDescartados, setSimilaresDescartados] = useState(false)
  const [plantillasDescartadas, setPlantillasDescartadas] = useState<ReadonlySet<TipoArticulo>>(new Set())
  const [detallesAbierto, setDetallesAbierto] = useState(false)
  const [publicacionAbierta, setPublicacionAbierta] = useState(false)
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false)

  // Anti duplicados: al escribir el titulo de un articulo nuevo se
  // buscan articulos parecidos y se ofrece abrirlos. Rebote de 300 ms.
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
    setOrdenRutaInicio(articulo.ordenRutaInicio ?? 0)
    setEstado(articulo.estado ?? 'publicado')
    setRelacionados(articulo.relacionados ?? [])
    setCargadoInicial(true)
  }, [articulo, cargadoInicial])

  // Precarga del modo duplicar: todo el contenido del original con ids
  // internos regenerados; la copia nace en borrador y sin la marca de
  // ruta de inicio (para no duplicar destacados).
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
    setEstado('borrador')
    setCargadoInicial(true)
  }, [copiarDe, original, cargadoInicial])

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

  // Completitud como en el handoff "Editor de Artículo": diez señales
  // tomadas directamente de lo escrito (titulo, pasos, descripcion,
  // etiquetas, requisitos, tiempo, dificultad, verificacion y objetivo),
  // de modo que la barra reacciona aunque el articulo aun no tenga pasos.
  // Las señales con sugerencia vacia suman al porcentaje pero no generan
  // una linea en la lista de sugerencias.
  const completitud = useMemo(() => {
    const puntos: [boolean, string][] = [
      [Boolean(titulo.trim()), ''],
      [pasos.length > 0, 'Agregar al menos un paso'],
      [pasos.length > 1, ''],
      [Boolean(descripcion.trim()), 'Escribir cuándo usar este procedimiento'],
      [etiquetas.length > 0, 'Agregar etiquetas para el buscador'],
      [Boolean(requisitos.trim()), 'Anotar los requisitos previos'],
      [Boolean(tiempoEstimadoMin.trim()), 'Indicar el tiempo estimado'],
      [Boolean(dificultad), 'Indicar la dificultad'],
      [Boolean(verificacionFinal.trim()), 'Escribir la verificación final'],
      [Boolean(objetivoGeneral.trim()), 'Indicar el objetivo general'],
    ]
    const completos = puntos.filter(([ok]) => ok).length
    const sugerencias = puntos.filter(([ok, texto]) => !ok && texto).map(([, texto]) => texto)
    return { porcentaje: Math.round((completos / puntos.length) * 100), sugerencias }
  }, [titulo, pasos, descripcion, etiquetas, requisitos, tiempoEstimadoMin, dificultad, verificacionFinal, objetivoGeneral])

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

  const mostrarSimilares =
    !esEdicion && !copiarDe && !similaresDescartados && similares.length > 0 && titulo.trim().length > 0

  const esProblema = tipo === 'problema_frecuente'
  const camposDetalle = [
    descripcion.trim(),
    objetivoGeneral.trim(),
    requisitos.trim(),
    etiquetas.length ? 'x' : '',
    tiempoEstimadoMin.trim(),
    dificultad,
    verificacionFinal.trim(),
  ].filter(Boolean).length

  const estadoEtiqueta = ESTADOS.find((e) => e.valor === estado)?.etiqueta ?? 'Borrador'
  const resumenPasos =
    pasos.length === 0 ? 'ninguno todavía' : pasos.length === 1 ? '1 paso' : `${pasos.length} pasos`
  const guardarEtiqueta = pasos.length > 0 ? 'Guardar procedimiento' : 'Guardar artículo'
  const sugerenciasEtiqueta =
    completitud.sugerencias.length === 0
      ? 'Completo'
      : `${completitud.sugerencias.length} ${completitud.sugerencias.length === 1 ? 'sugerencia' : 'sugerencias'}`

  if (esEdicion && articulo === null) return <Navigate to="/soluciones" replace />

  async function manejarEnvio() {
    setGuardando(true)

    const version =
      esEdicion && articulo && articulo.estado === 'publicado'
        ? siguienteVersion(articulo.version ?? '1.0', false)
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
        // Campos que el editor conserva pero no muestra (ver arriba).
        dispositivosAfectados,
        esRutaInicio,
        ordenRutaInicio: esRutaInicio ? Math.max(0, Math.trunc(ordenRutaInicio || 0)) : 0,
        estado,
        version,
        relacionados,
      },
      motivo.trim(),
    )

    navigate(`/soluciones/${categoriaId}/${id}`)
  }

  if (!cargadoInicial) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa con blur: cancelar, estado y titulo dinamico. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            {/* Destino derivado de la jerarquía central (padreDe): en
                creación vuelve a la lista con el chip de la categoría; en
                edición, a la ficha del artículo. */}
            <BotonVolver variante="nocturne">Cancelar</BotonVolver>
            <TagNeutral className="shrink-0">{estadoEtiqueta}</TagNeutral>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? tituloEditar(tipo) : tituloNuevo(tipo)}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Se guarda en la categoría {categoria?.nombre ?? '...'}
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-[190px] pt-[18px]">
          {/* Tipo de documento */}
          <section>
            <TituloSeccion className="mb-2">Tipo de documento</TituloSeccion>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_GRID.map((t) => {
                const Icono = iconoDeTipo(t.valor)
                const activo = t.valor === tipo
                return (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setTipo(t.valor)}
                    aria-pressed={activo}
                    className={`flex min-h-11 items-center gap-[9px] rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      activo
                        ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                        : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/5'
                    }`}
                  >
                    <Icono size={17} className={`shrink-0 ${activo ? 'text-noct-accent-300' : colorIconoDeTipo(t.valor)}`} />
                    {t.etiqueta}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Titulo + anti duplicados */}
          <section className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Título <span className="text-noct-accent-300">*</span>
              </span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Qué se hace y sobre qué equipo"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            {mostrarSimilares && (
              <div className="flex flex-col gap-2 rounded-md border border-noct-accent/30 bg-noct-accent/10 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <Info size={16} className="mt-px shrink-0 text-noct-accent" />
                  <p className="text-[13px] leading-[1.5]">
                    Ya existe un artículo parecido. Ábrelo en lugar de documentarlo dos veces.
                  </p>
                </div>
                <div className="flex flex-col gap-1 pl-[26px]">
                  {similares.map((similar) => (
                    <div key={similar.id} className="flex items-center justify-between gap-2">
                      <Link
                        to={similar.ruta}
                        className="min-w-0 truncate text-[13.5px] font-medium text-noct-accent-300 hover:text-noct-accent-400"
                      >
                        {similar.titulo}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSimilaresDescartados(true)}
                        className="shrink-0 p-1.5 text-xs text-noct-neutral-500 hover:text-noct-text"
                      >
                        Descartar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Oferta de plantilla */}
          {ofrecerPlantilla && (
            <div className="flex flex-col gap-2.5 rounded-md border border-noct-accent/30 bg-noct-accent/10 p-3">
              <div className="flex items-start gap-2.5">
                <Sparkle size={16} className="mt-px shrink-0 text-noct-accent" />
                <p className="text-[13px] leading-[1.5]">
                  Estructura recomendada para {TIPOS_GRID.find((t) => t.valor === tipo)?.etiqueta.toLowerCase()}:
                  pasos con sus tareas, requisitos y verificación final. Solo hay que editar los textos.
                </p>
              </div>
              <div className="flex gap-2 pl-[26px]">
                <button
                  type="button"
                  onClick={aplicarPlantilla}
                  className="inline-flex items-center rounded-lg border border-noct-accent px-2.5 py-[7px] text-[13px] font-medium text-noct-accent hover:bg-noct-accent/10"
                >
                  Usar plantilla
                </button>
                <button
                  type="button"
                  onClick={() => setPlantillasDescartadas((actuales) => new Set([...actuales, tipo]))}
                  className="inline-flex items-center rounded-lg border border-transparent px-1 py-[7px] text-[13px] font-medium text-noct-accent hover:bg-noct-accent/10"
                >
                  Empezar en blanco
                </button>
              </div>
            </div>
          )}

          {/* Pasos */}
          <section>
            <div className="mb-2.5 flex items-baseline justify-between">
              <TituloSeccion>Pasos</TituloSeccion>
              <span className="text-[11px] text-noct-neutral-600">{resumenPasos}</span>
            </div>
            <PasosEditor articuloId={id} pasos={pasos} onPasosChange={setPasos} />
          </section>

          {/* Detalles (plegable) */}
          <section className="border-t border-noct-divider">
            <button
              type="button"
              onClick={() => setDetallesAbierto((v) => !v)}
              aria-expanded={detallesAbierto}
              className="flex min-h-[52px] w-full items-center gap-2.5 px-0.5 py-1.5 text-left"
            >
              <TituloSeccion>Detalles</TituloSeccion>
              <span className="text-[11px] text-noct-neutral-600">
                {camposDetalle} de 7 campos con contenido
              </span>
              <Caret abierto={detallesAbierto} />
            </button>
            {detallesAbierto && (
              <div className="flex flex-col gap-4 px-0 pb-2 pt-1">
                <Campo etiqueta="¿Cuándo usar este procedimiento?">
                  <textarea
                    rows={2}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Usar cuando llega una impresora nueva a bodega o pierde su configuración"
                    className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                  />
                </Campo>

                <Campo etiqueta="Objetivo general (1 línea)">
                  <input
                    type="text"
                    value={objetivoGeneral}
                    onChange={(e) => setObjetivoGeneral(e.target.value)}
                    placeholder="Qué se logra al completar todo el procedimiento"
                    className={`min-h-11 ${CLASE_CAMPO}`}
                  />
                </Campo>

                <Campo etiqueta="Antes de empezar (un requisito por línea)">
                  <textarea
                    rows={3}
                    value={requisitos}
                    onChange={(e) => setRequisitos(e.target.value)}
                    placeholder={'Acceso a la red\nPermisos de administrador'}
                    className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                  />
                </Campo>

                {esProblema && (
                  <>
                    <Campo etiqueta="Síntomas (uno por línea)">
                      <textarea
                        rows={3}
                        value={sintomas}
                        onChange={(e) => setSintomas(e.target.value)}
                        placeholder={'No imprime nada\nLuz roja parpadeando'}
                        className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                      />
                    </Campo>
                    <Campo etiqueta="Posibles causas (una por línea)">
                      <textarea
                        rows={3}
                        value={causas}
                        onChange={(e) => setCausas(e.target.value)}
                        placeholder={'Cable de red suelto\nTóner agotado'}
                        className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                      />
                    </Campo>
                  </>
                )}

                <EtiquetasEditor etiquetas={etiquetas} onChange={setEtiquetas} />

                <PortadaEditor articuloId={id} portada={portada} onChange={setPortada} />

                <div className="flex gap-3">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className={CLASE_ETIQUETA}>Tiempo (min)</span>
                    <input
                      type="number"
                      min={1}
                      value={tiempoEstimadoMin}
                      onChange={(e) => setTiempoEstimadoMin(e.target.value)}
                      className={`min-h-11 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${CLASE_CAMPO}`}
                    />
                  </label>
                  <div className="flex flex-[2] flex-col gap-1.5">
                    <span className={CLASE_ETIQUETA}>Dificultad</span>
                    <Segmentado
                      opciones={DIFICULTADES}
                      valor={dificultad}
                      onCambiar={(v) => setDificultad((actual) => (actual === v ? '' : v))}
                    />
                  </div>
                </div>

                <Campo etiqueta="Verificación final (una comprobación por línea)">
                  <textarea
                    rows={3}
                    value={verificacionFinal}
                    onChange={(e) => setVerificacionFinal(e.target.value)}
                    placeholder={'La impresora aparece instalada\nLa impresión de prueba fue exitosa'}
                    className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                  />
                </Campo>

                <Campo etiqueta="Notas adicionales (admite Markdown)">
                  <textarea
                    rows={3}
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    placeholder="Notas de cierre, enlaces del fabricante, aclaraciones"
                    className={`resize-y font-mono text-[13px] leading-[1.55] ${CLASE_CAMPO}`}
                  />
                </Campo>
              </div>
            )}
          </section>

          {/* Publicación (plegable) */}
          <section className="border-t border-noct-divider">
            <button
              type="button"
              onClick={() => setPublicacionAbierta((v) => !v)}
              aria-expanded={publicacionAbierta}
              className="flex min-h-[52px] w-full items-center gap-2.5 px-0.5 py-1.5 text-left"
            >
              <TituloSeccion>Publicación</TituloSeccion>
              <span className="text-[11px] text-noct-neutral-600">
                {estadoEtiqueta}
                {esRutaInicio ? ' · destacado en Inicio' : ''}
              </span>
              <Caret abierto={publicacionAbierta} />
            </button>
            {publicacionAbierta && (
              <div className="flex flex-col gap-4 px-0 pb-2 pt-1">
                <div className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>Estado</span>
                  <Segmentado
                    opciones={ESTADOS}
                    valor={estado}
                    onCambiar={(v) => setEstado(v)}
                  />
                  <p className="text-xs leading-[1.5] text-noct-neutral-500">
                    Un borrador u obsoleto no aparece en el buscador ni en el diagnóstico.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEsRutaInicio((v) => !v)}
                  className="flex min-h-11 items-start gap-2.5 p-0.5 text-left"
                >
                  {esRutaInicio ? (
                    <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-noct-accent">
                      <Check size={13} className="text-noct-bg" />
                    </span>
                  ) : (
                    <span className="mt-px h-[18px] w-[18px] shrink-0 rounded border-[1.5px] border-noct-neutral-700" />
                  )}
                  <span className="text-sm leading-[1.4]">
                    Destacar en Inicio como ruta de aprendizaje
                    <span className="mt-0.5 block text-xs text-noct-neutral-500">
                      Para guías como "Primer día en TI".
                    </span>
                  </span>
                </button>

                {esEdicion && (
                  <Campo etiqueta="Motivo del cambio">
                    <input
                      type="text"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Por qué se actualizó este artículo"
                      className={`min-h-11 ${CLASE_CAMPO}`}
                    />
                  </Campo>
                )}

                <div className="flex flex-col gap-2">
                  <span className={CLASE_ETIQUETA}>Artículos relacionados</span>
                  {relacionados.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {relacionados.map((r) => (
                        <TagNeutral key={r.id} className="gap-1.5">
                          {r.titulo}
                          <button
                            type="button"
                            onClick={() => setRelacionados((actuales) => actuales.filter((x) => x.id !== r.id))}
                            aria-label={`Quitar ${r.titulo} de relacionados`}
                            className="flex p-0.5 text-noct-neutral-500 hover:text-noct-text"
                          >
                            <X size={11} />
                          </button>
                        </TagNeutral>
                      ))}
                    </div>
                  )}
                  {relacionadosDisponibles.length > 0 && (
                    <div className="relative">
                      <LinkSimple
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-noct-neutral-400"
                      />
                      <select
                        value=""
                        aria-label="Agregar artículo relacionado"
                        onChange={(e) => {
                          const articulo = relacionadosDisponibles.find((a) => a.id === e.target.value)
                          if (articulo) {
                            setRelacionados((actuales) => [...actuales, { id: articulo.id, titulo: articulo.titulo }])
                          }
                        }}
                        className="flex min-h-11 w-full appearance-none rounded-md border border-dashed border-noct-neutral-700 bg-transparent pl-9 pr-3 text-[13px] text-noct-neutral-400 outline-none hover:border-noct-neutral-500 hover:text-noct-text"
                      >
                        <option value="">Vincular artículo relacionado (opcional)</option>
                        {relacionadosDisponibles.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.titulo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </main>

        {/* Barra inferior fija: completitud, sugerencias y acciones. */}
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[12px]">
          {sugerenciasAbiertas && completitud.sugerencias.length > 0 && (
            <div className="flex flex-col gap-[5px] pb-2.5 pt-0.5">
              {completitud.sugerencias.map((sugerencia) => (
                <p key={sugerencia} className="flex items-center gap-[7px] text-[12.5px] text-noct-neutral-400">
                  <Circle size={9} className="shrink-0 text-noct-neutral-600" />
                  {sugerencia}
                </p>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSugerenciasAbiertas((v) => !v)}
            className="flex w-full items-center gap-2.5 pb-[9px]"
          >
            <span className="shrink-0 text-xs text-noct-neutral-400">
              Completitud {completitud.porcentaje}%
            </span>
            <span className="block h-[3px] flex-1 overflow-hidden rounded-full bg-noct-neutral-900">
              <span
                className="block h-full rounded-full bg-noct-accent transition-[width] duration-150"
                style={{ width: `${completitud.porcentaje}%` }}
              />
            </span>
            <span className="shrink-0 text-xs text-noct-accent-300">{sugerenciasEtiqueta}</span>
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setMostrarVistaPrevia(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-noct-divider px-2.5 py-[9px] text-[13px] font-medium text-noct-text hover:bg-noct-text/[.07]"
            >
              <Eye size={15} />
              Vista previa
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void manejarEnvio()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-noct-accent px-2.5 py-[9px] text-[13px] font-medium text-noct-accent hover:bg-noct-accent/10 disabled:opacity-50"
            >
              <FloppyDisk size={15} />
              {guardando ? 'Guardando...' : guardarEtiqueta}
            </button>
          </div>
        </div>
      </div>

      {mostrarVistaPrevia && (
        <Suspense fallback={<p className="p-4 text-sm text-noct-neutral-400">Preparando la vista previa...</p>}>
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

// Caret que indica si una seccion plegable esta abierta.
function Caret({ abierto }: { abierto: boolean }) {
  return abierto ? (
    <CaretUp size={14} className="ml-auto text-noct-neutral-500" />
  ) : (
    <CaretDown size={14} className="ml-auto text-noct-neutral-500" />
  )
}

// Campo etiquetado (etiqueta arriba, control debajo).
function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={CLASE_ETIQUETA}>{etiqueta}</span>
      {children}
    </label>
  )
}

// Control segmentado: una fila de opciones dentro de un recuadro, con la
// activa en acento. Usado por Estado y Dificultad.
function Segmentado<T extends string>({
  opciones,
  valor,
  onCambiar,
}: {
  opciones: { valor: T; etiqueta: string }[]
  valor: T | ''
  onCambiar: (valor: T) => void
}) {
  return (
    <div className="flex min-h-11 overflow-hidden rounded-md border border-noct-divider">
      {opciones.map((o, i) => {
        const activa = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onCambiar(o.valor)}
            aria-pressed={activa}
            className={`flex-1 text-[12.5px] font-medium transition-colors ${i > 0 ? '-ml-px border-l border-noct-divider' : ''} ${
              activa ? 'bg-noct-accent/[.12] text-noct-accent-300' : 'text-noct-neutral-400'
            }`}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// Editor de etiquetas como chips: Enter o coma agregan, la X quita.
function EtiquetasEditor({
  etiquetas,
  onChange,
}: {
  etiquetas: string[]
  onChange: (etiquetas: string[]) => void
}) {
  const [texto, setTexto] = useState('')

  function agregar(bruto: string) {
    const nuevas: string[] = []
    const puestas = new Set(etiquetas.map((e) => e.toLowerCase()))
    for (const parte of bruto.split(/[,\n]/)) {
      const limpia = parte.trim()
      if (limpia === '') continue
      const clave = limpia.toLowerCase()
      if (puestas.has(clave)) continue
      puestas.add(clave)
      nuevas.push(limpia)
    }
    if (nuevas.length > 0) onChange([...etiquetas, ...nuevas])
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={CLASE_ETIQUETA}>Etiquetas</span>
      {etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {etiquetas.map((etiqueta) => (
            <TagNeutral key={etiqueta} className="gap-1.5">
              {etiqueta}
              <button
                type="button"
                onClick={() => onChange(etiquetas.filter((e) => e !== etiqueta))}
                aria-label={`Quitar la etiqueta ${etiqueta}`}
                className="flex p-0.5 text-noct-neutral-500 hover:text-noct-text"
              >
                <X size={11} />
              </button>
            </TagNeutral>
          ))}
        </div>
      )}
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            agregar(texto)
            setTexto('')
          } else if (e.key === 'Backspace' && texto === '' && etiquetas.length > 0) {
            onChange(etiquetas.slice(0, -1))
          }
        }}
        onPaste={(e) => {
          const pegado = e.clipboardData.getData('text')
          if (!/[,\n]/.test(pegado)) return
          e.preventDefault()
          agregar(pegado)
        }}
        onBlur={() => {
          agregar(texto)
          setTexto('')
        }}
        placeholder="Escribir y presionar Enter (Impresora, POS, Backup...)"
        className={`min-h-11 ${CLASE_CAMPO}`}
      />
    </div>
  )
}

// Imagen de portada del articulo: identifica el articulo de un vistazo
// en el listado y el buscador. Se sube igual que las capturas de los
// pasos (comprimida en el telefono, encolada sin conexion).
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
    <div className="flex flex-col gap-2">
      <span className={CLASE_ETIQUETA}>Imagen de portada</span>
      <div className="flex items-center gap-3">
        <label className="h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-md">
          {portada && url ? (
            <img src={url} alt="Portada del procedimiento" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-noct-neutral-700 text-center text-[11px] text-noct-neutral-500 hover:border-noct-neutral-500 hover:text-noct-text">
              {subiendo ? 'Subiendo...' : 'Portada'}
            </span>
          )}
          <input type="file" accept="image/*" className="hidden" disabled={subiendo} onChange={(e) => void subir(e)} />
        </label>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs leading-[1.5] text-noct-neutral-500">
            Identifica el artículo de un vistazo en la lista y el buscador.
          </p>
          {portada && !subiendo && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="self-start text-xs text-noct-neutral-400 underline underline-offset-2 hover:text-noct-text"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-noct-error">{error}</p>}
      {aviso && <p className="text-xs text-noct-precaucion">{aviso}</p>}
    </div>
  )
}
