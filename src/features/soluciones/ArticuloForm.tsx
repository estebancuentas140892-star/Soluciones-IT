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
  Check,
  Circle,
  Eye,
  FloppyDisk,
  Info,
  LinkSimple,
  Monitor,
  Plus,
  Sparkle,
  Warning,
  X,
} from '../../components/iconos'
import { BotonVolver } from '../../components/BotonVolver'
import { TagNeutral, TituloSeccion } from '../../components/nocturne'
import { buscarArticulosSimilares, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import {
  calcularCompletitud,
  PESTANAS,
  senalesDeArticulo,
  type PestanaEditor,
} from './completitudArticulo'
import { etiquetasFrecuentes, normalizarEtiquetas, type GrafiaEtiqueta } from './etiquetas'
import { PasosEditor } from './PasosEditor'
import { hayPlantilla, pasosDePlantilla, plantillaDe } from './plantillas'
import { colorIconoDeTipo, iconoDeTipo, normalizarTexto } from './iconosSoluciones'
import { tituloEditar, tituloNuevo } from './tiposArticulo'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'

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

// Editor de articulos en el sistema Nocturne (handoff "Editor de
// Artículo"): cabecera pegajosa con el tipo dinamico y, desde la fase
// J5, cuatro pestañas fijas (General, Pasos, Detalles y Publicación) en
// lugar de un unico scroll largo con secciones plegadas. Debajo, una
// barra fija con la completitud y las acciones.
//
// El estado del formulario vive entero en este componente, asi que
// cambiar de pestaña no pierde nada y el guardado sigue siendo uno
// solo. Por lo mismo, la completitud y la validacion miran SIEMPRE todo
// el formulario, no la pestaña visible: cada sugerencia sabe en que
// pestaña se resuelve (completitudArticulo.ts) y al tocarla lleva ahi.
//
// La fase J5 repuso ademas las cuatro funciones que el rediseño habia
// dejado sin interfaz (tarea 74): equipos donde aplica, orden en la
// ruta de inicio y cambio mayor viven aqui; los adjuntos del paso, en
// PasosEditor. Ya no queda ningun campo que se guarde a ciegas.
export function ArticuloForm() {
  const { categoriaId = '', articuloId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(articuloId)

  const copiarDe = esEdicion ? null : searchParams.get('copiarDe')
  // Bucle sugerencia -> borrador (tarea 140, hallazgo K2): id de la
  // ejecucion de diagnostico cuyo texto libre se esta convirtiendo en
  // articulo. Excluyente con `copiarDe`, que precarga otra cosa.
  const desdeSugerencia = esEdicion || copiarDe ? null : searchParams.get('desdeSugerencia')
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
  const sugerencia = useLiveQuery(
    async () =>
      desdeSugerencia ? ((await db.ejecuciones_diagnostico.get(desdeSugerencia)) ?? null) : null,
    [desdeSugerencia],
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
  const [dispositivosAfectados, setDispositivosAfectados] = useState(
    dispositivoContextualId ? [{ id: dispositivoContextualId, nombre: dispositivoContextualNombre }] : [],
  )
  const [ordenRutaInicio, setOrdenRutaInicio] = useState(0)
  const [relacionados, setRelacionados] = useState<{ id: string; titulo: string }[]>([])
  // Salto de version mayor (1.4 -> 2.0) en vez del menor por defecto:
  // solo tiene sentido al editar un articulo YA publicado, que es el
  // unico caso en que la version se mueve al guardar. No se carga de la
  // base porque es una decision de ESTE guardado, no un dato del articulo.
  const [cambioMayor, setCambioMayor] = useState(false)

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

  // Equipos donde aplica el articulo (tarea 74, repuesto en J5): es el
  // lado del vinculo que alimenta "Procedimientos de este equipo" y
  // "Problemas frecuentes" en la ficha del dispositivo. Hasta ahora solo
  // se podia llenar entrando al editor DESDE un dispositivo.
  const candidatosDispositivos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const dispositivosDisponibles = useMemo(() => {
    const yaPuestos = new Set(dispositivosAfectados.map((d) => d.id))
    return [...candidatosDispositivos]
      .filter((d) => !yaPuestos.has(d.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [candidatosDispositivos, dispositivosAfectados])

  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion && !copiarDe && !desdeSugerencia)
  const [guardando, setGuardando] = useState(false)
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false)
  const [similaresDescartados, setSimilaresDescartados] = useState(false)
  const [plantillasDescartadas, setPlantillasDescartadas] = useState<ReadonlySet<TipoArticulo>>(new Set())
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false)
  const [pestana, setPestana] = useState<PestanaEditor>('general')
  // Error de validacion del envio (hoy solo el titulo obligatorio).
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  // Cambiar de pestaña lleva al principio del formulario: si no, se
  // entra a la pestaña nueva a la altura del scroll de la anterior.
  function irA(destino: PestanaEditor) {
    setPestana(destino)
    window.scrollTo({ top: 0 })
  }

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

  // Vocabulario de etiquetas derivado del uso real (fase J4): las
  // etiquetas ya usadas en el resto de los articulos, mas frecuentes
  // primero, para ofrecerlas como sugerencia y como grafia canonica al
  // guardar. Nunca una tabla nueva, mismo criterio que las marcas
  // sugeridas de dispositivos.
  const todosArticulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const vocabularioEtiquetas = useMemo(
    () => etiquetasFrecuentes(todosArticulos.map((a) => a.etiquetas ?? [])),
    [todosArticulos],
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

  // Precarga del bucle sugerencia -> borrador (tarea 140, hallazgo K2).
  // La sugerencia es el texto libre que escribio un tecnico cuando un
  // diagnostico no resolvio ("Encontre otra solucion"): junto al titulo
  // del diagnostico y su categoria YA es el borrador de un problema
  // frecuente, y hasta ahora habia que recrearlo a mano.
  //
  // La solucion propuesta entra como DESCRIPCION del procedimiento, no
  // como pasos: es prosa, y convertirla en un paso a paso es
  // exactamente el trabajo de redaccion que el tecnico viene a hacer.
  // El articulo nace en borrador (nadie publica sin revisar) y la
  // categoria no se toca: ya viene en la ruta, puesta por quien enlaza.
  useEffect(() => {
    if (!desdeSugerencia || cargadoInicial || sugerencia === undefined) return
    if (sugerencia === null) {
      setCargadoInicial(true)
      return
    }
    setTitulo(sugerencia.diagnosticoTitulo)
    setTipo('problema_frecuente')
    setDescripcion(sugerencia.solucionPropuesta)
    setEstado('borrador')
    setCargadoInicial(true)
  }, [desdeSugerencia, sugerencia, cargadoInicial])

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
  // tomadas de lo escrito, con la pestaña donde se resuelve cada una
  // (ver completitudArticulo.ts). Mira todo el formulario, no la
  // pestaña visible.
  const completitud = useMemo(
    () =>
      calcularCompletitud(
        senalesDeArticulo({
          tipo,
          titulo,
          cantidadPasos: pasos.length,
          descripcion,
          cantidadEtiquetas: etiquetas.length,
          requisitos,
          tiempoEstimadoMin,
          dificultad,
          verificacionFinal,
          objetivoGeneral,
          contenido,
        }),
      ),
    [
      tipo,
      titulo,
      pasos,
      descripcion,
      etiquetas,
      requisitos,
      tiempoEstimadoMin,
      dificultad,
      verificacionFinal,
      objetivoGeneral,
      contenido,
    ],
  )

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
    // La validacion mira todo el formulario y lleva a la pestaña del
    // problema: si no, en un editor con pestañas el error queda fuera
    // de la vista y el guardado parece no responder.
    if (titulo.trim() === '') {
      setErrorEnvio('Falta el título del artículo.')
      irA('general')
      return
    }
    setErrorEnvio(null)
    setGuardando(true)

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
        etiquetas: normalizarEtiquetas(etiquetas, vocabularioEtiquetas),
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
        ordenRutaInicio: esRutaInicio ? Math.max(0, Math.trunc(ordenRutaInicio || 0)) : 0,
        estado,
        version,
        relacionados,
        // Al editar se conserva el origen ya guardado: de que sugerencia
        // nacio el articulo no cambia nunca (tarea 140, hallazgo K2).
        origenSugerenciaId: esEdicion ? (articulo?.origenSugerenciaId ?? null) : desdeSugerencia,
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
            <BotonVolver>Cancelar</BotonVolver>
            <TagNeutral className="shrink-0">{estadoEtiqueta}</TagNeutral>
          </header>
          <div className="px-4 pb-2.5 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? tituloEditar(tipo) : tituloNuevo(tipo)}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Se guarda en la categoría {categoria?.nombre ?? '...'}
            </p>
          </div>

          {/* Pestañas del editor (J5). Van dentro del bloque pegajoso
              para que sigan a mano al desplazarse dentro de una pestaña
              larga, como la de Pasos. */}
          <div role="tablist" aria-label="Secciones del editor" className="flex px-2">
            {PESTANAS.map((p) => {
              const activa = p.valor === pestana
              const pendiente = completitud.pestanasPendientes.has(p.valor)
              return (
                <button
                  key={p.valor}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => irA(p.valor)}
                  className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-1 text-[13px] font-medium transition-colors ${
                    activa
                      ? 'border-noct-accent text-noct-accent-300'
                      : 'border-transparent text-noct-neutral-400 hover:text-noct-text'
                  }`}
                >
                  {p.etiqueta}
                  {/* Punto de "aquí queda algo por completar". Es una
                      pista, no un error: por eso es neutro y no rojo. */}
                  {pendiente && (
                    <span
                      aria-label="Tiene sugerencias pendientes"
                      className={`h-[5px] w-[5px] shrink-0 rounded-full ${
                        activa ? 'bg-noct-accent' : 'bg-noct-neutral-600'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-[190px] pt-[18px]">
          {/* PESTAÑA GENERAL: de qué trata el artículo y cómo se
              encuentra (tipo, título, portada, etiquetas, equipos). */}
          {pestana === 'general' && (
            <>
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
                        <Icono
                          size={17}
                          className={`shrink-0 ${activo ? 'text-noct-accent-300' : colorIconoDeTipo(t.valor)}`}
                        />
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
                    onChange={(e) => {
                      setTitulo(e.target.value)
                      if (errorEnvio) setErrorEnvio(null)
                    }}
                    placeholder="Qué se hace y sobre qué equipo"
                    aria-invalid={errorEnvio !== null}
                    className={`min-h-11 ${CLASE_CAMPO} ${errorEnvio ? 'border-noct-error' : ''}`}
                  />
                </label>

                {errorEnvio && (
                  <p className="flex items-center gap-2 text-[12.5px] text-noct-error">
                    <Warning size={14} className="shrink-0" />
                    {errorEnvio}
                  </p>
                )}

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
                      Estructura recomendada para{' '}
                      {TIPOS_GRID.find((t) => t.valor === tipo)?.etiqueta.toLowerCase()}: pasos con sus
                      tareas, requisitos y verificación final. Solo hay que editar los textos.
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

              <EtiquetasEditor
                etiquetas={etiquetas}
                onChange={setEtiquetas}
                sugerencias={vocabularioEtiquetas}
              />

              <PortadaEditor articuloId={id} portada={portada} onChange={setPortada} />

              <EquiposDondeAplica
                elegidos={dispositivosAfectados}
                disponibles={dispositivosDisponibles}
                onChange={setDispositivosAfectados}
                categoriaNombre={categoria?.nombre}
              />
            </>
          )}

          {/* PESTAÑA PASOS: lo que el técnico ejecuta, de principio a
              fin (requisitos previos, pasos y verificación final). */}
          {pestana === 'pasos' && (
            <>
              <Campo etiqueta="Antes de empezar (un requisito por línea)">
                <textarea
                  rows={3}
                  value={requisitos}
                  onChange={(e) => setRequisitos(e.target.value)}
                  placeholder={'Acceso a la red\nPermisos de administrador'}
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>

              <section>
                <div className="mb-2.5 flex items-baseline justify-between">
                  <TituloSeccion>Pasos</TituloSeccion>
                  <span className="text-[11px] text-noct-neutral-600">{resumenPasos}</span>
                </div>
                <PasosEditor
                  articuloId={id}
                  pasos={pasos}
                  onPasosChange={setPasos}
                  dispositivosAfectados={dispositivosAfectados}
                />
              </section>

              <Campo etiqueta="Verificación final (una comprobación por línea)">
                <textarea
                  rows={3}
                  value={verificacionFinal}
                  onChange={(e) => setVerificacionFinal(e.target.value)}
                  placeholder={'La impresora aparece instalada\nLa impresión de prueba fue exitosa'}
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>
            </>
          )}

          {/* PESTAÑA DETALLES: lo que ayuda a decidir si este artículo
              sirve (síntomas, esfuerzo, artículos vecinos y notas). */}
          {pestana === 'detalles' && (
            <>
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
                          setRelacionados((actuales) => [
                            ...actuales,
                            { id: articulo.id, titulo: articulo.titulo },
                          ])
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

              <Campo etiqueta="Notas adicionales (admite Markdown)">
                <textarea
                  rows={3}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Notas de cierre, enlaces del fabricante, aclaraciones"
                  className={`resize-y font-mono text-[13px] leading-[1.55] ${CLASE_CAMPO}`}
                />
              </Campo>
            </>
          )}

          {/* PESTAÑA PUBLICACIÓN: quién lo ve y cómo queda registrado
              el cambio. */}
          {pestana === 'publicacion' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Estado</span>
                <Segmentado opciones={ESTADOS} valor={estado} onCambiar={(v) => setEstado(v)} />
                <p className="text-xs leading-[1.5] text-noct-neutral-500">
                  Un borrador u obsoleto no aparece en el buscador ni en el diagnóstico.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Casilla
                  marcada={esRutaInicio}
                  onCambiar={() => setEsRutaInicio((v) => !v)}
                  titulo="Destacar en Inicio como ruta de aprendizaje"
                  ayuda='Para guías como "Primer día en TI".'
                />
                {/* Orden dentro de la ruta de inicio (tarea 74): solo
                    tiene sentido si el artículo está destacado. */}
                {esRutaInicio && (
                  <label className="ml-[28px] flex flex-col gap-1.5">
                    <span className={CLASE_ETIQUETA}>Orden en la ruta de Inicio</span>
                    <input
                      type="number"
                      min={0}
                      value={ordenRutaInicio}
                      onChange={(e) => setOrdenRutaInicio(Number(e.target.value))}
                      className={`min-h-11 w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${CLASE_CAMPO}`}
                    />
                    <span className="text-xs leading-[1.5] text-noct-neutral-500">
                      Los destacados se muestran de menor a mayor. El 0 va primero.
                    </span>
                  </label>
                )}
              </div>

              {/* Cambio mayor (tarea 74): la versión solo se mueve al
                  guardar un artículo YA publicado, así que fuera de ese
                  caso la opción confundiría más de lo que ayuda. */}
              {esEdicion && articulo?.estado === 'publicado' && (
                <div className="flex flex-col gap-2">
                  <Casilla
                    marcada={cambioMayor}
                    onCambiar={() => setCambioMayor((v) => !v)}
                    titulo="Es un cambio mayor"
                    ayuda={`La versión pasaría de ${articulo.version ?? '1.0'} a ${siguienteVersion(
                      articulo.version ?? '1.0',
                      true,
                    )} en vez de ${siguienteVersion(articulo.version ?? '1.0', false)}.`}
                  />
                </div>
              )}

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
            </>
          )}
        </main>

        {/* Barra inferior fija: completitud, sugerencias y acciones. */}
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[12px]">
          {sugerenciasAbiertas && completitud.sugerencias.length > 0 && (
            <div className="flex flex-col gap-[5px] pb-2.5 pt-0.5">
              {/* Cada sugerencia lleva a la pestaña donde se resuelve:
                  con pestañas, saber que falta algo no basta si hay que
                  buscar donde. */}
              {completitud.sugerencias.map((sugerencia) => (
                <button
                  key={sugerencia.texto}
                  type="button"
                  onClick={() => irA(sugerencia.pestana)}
                  className="flex items-center gap-[7px] py-0.5 text-left text-[12.5px] text-noct-neutral-400 hover:text-noct-text"
                >
                  <Circle size={9} className="shrink-0 text-noct-neutral-600" />
                  {sugerencia.texto}
                </button>
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

// Casilla de verificacion con titulo y una linea de ayuda debajo, del
// tamaño de un dedo. Usada por las opciones de la pestaña Publicación.
function Casilla({
  marcada,
  onCambiar,
  titulo,
  ayuda,
}: {
  marcada: boolean
  onCambiar: () => void
  titulo: string
  ayuda: string
}) {
  return (
    <button
      type="button"
      onClick={onCambiar}
      aria-pressed={marcada}
      className="flex min-h-11 items-start gap-2.5 p-0.5 text-left"
    >
      {marcada ? (
        <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-noct-accent">
          <Check size={13} className="text-noct-bg" />
        </span>
      ) : (
        <span className="mt-px h-[18px] w-[18px] shrink-0 rounded border-[1.5px] border-noct-neutral-700" />
      )}
      <span className="text-sm leading-[1.4]">
        {titulo}
        <span className="mt-0.5 block text-xs text-noct-neutral-500">{ayuda}</span>
      </span>
    </button>
  )
}

// Equipos donde aplica el articulo (tarea 74, repuesto en J5). Guarda
// una copia de referencia {id, nombre} igual que los relacionados: el
// dato canonico es el dispositivo y el nombre es solo para poder
// mostrarlo sin resolver el vinculo. Es el lado que alimenta
// "Procedimientos de este equipo" y "Problemas frecuentes de este
// equipo" en la ficha del dispositivo.
function EquiposDondeAplica({
  elegidos,
  disponibles,
  onChange,
  categoriaNombre,
}: {
  elegidos: { id: string; nombre: string }[]
  disponibles: { id: string; nombre: string }[]
  onChange: (equipos: { id: string; nombre: string }[]) => void
  categoriaNombre?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={CLASE_ETIQUETA}>Equipos donde aplica</span>
      {elegidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {elegidos.map((equipo) => (
            <TagNeutral key={equipo.id} className="gap-1.5">
              {equipo.nombre || 'Equipo sin nombre'}
              <button
                type="button"
                onClick={() => onChange(elegidos.filter((e) => e.id !== equipo.id))}
                aria-label={`Quitar ${equipo.nombre} de los equipos donde aplica`}
                className="flex p-0.5 text-noct-neutral-500 hover:text-noct-text"
              >
                <X size={11} />
              </button>
            </TagNeutral>
          ))}
        </div>
      )}
      {disponibles.length > 0 && (
        <div className="relative">
          <Monitor
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-noct-neutral-400"
          />
          <select
            value=""
            aria-label="Agregar equipo donde aplica"
            onChange={(e) => {
              const equipo = disponibles.find((d) => d.id === e.target.value)
              if (equipo) onChange([...elegidos, { id: equipo.id, nombre: equipo.nombre }])
            }}
            className="flex min-h-11 w-full appearance-none rounded-md border border-dashed border-noct-neutral-700 bg-transparent pl-9 pr-3 text-[13px] text-noct-neutral-400 outline-none hover:border-noct-neutral-500 hover:text-noct-text"
          >
            <option value="">Vincular un equipo donde aplica (opcional)</option>
            {disponibles.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-xs leading-[1.5] text-noct-neutral-500">
        Vincula equipos para destacar el artículo como específico de ellos. Publicado, ya aparece en
        las fichas de todos los equipos de la categoría{categoriaNombre ? ` ${categoriaNombre}` : ''}{' '}
        aunque lo dejes vacío.
      </p>
    </div>
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

// Cuantas sugerencias tocables se muestran como maximo: suficientes
// para ser utiles sin ensuciar el formulario.
const MAX_SUGERENCIAS_ETIQUETA = 8

// Editor de etiquetas como chips: Enter o coma agregan, la X quita.
// Desde la fase J4 ofrece ademas chips de sugerencia con las etiquetas
// ya usadas en el resto de los articulos (repone la funcion que N0
// habia puesto y el rediseño del editor perdio): tocarlas agrega sin
// tener que escribir, reduciendo el riesgo de variantes como
// "Impresora"/"impresora"/"Printer".
function EtiquetasEditor({
  etiquetas,
  onChange,
  sugerencias,
}: {
  etiquetas: string[]
  onChange: (etiquetas: string[]) => void
  sugerencias: GrafiaEtiqueta[]
}) {
  const [texto, setTexto] = useState('')

  function agregar(bruto: string) {
    const nuevas: string[] = []
    // Clave normalizada (sin acentos ni mayusculas), no solo
    // minusculas: "cafe" y "café" deben contar como la misma etiqueta.
    const puestas = new Set(etiquetas.map((e) => normalizarTexto(e)))
    for (const parte of bruto.split(/[,\n]/)) {
      const limpia = parte.trim()
      if (limpia === '') continue
      const clave = normalizarTexto(limpia)
      if (puestas.has(clave)) continue
      puestas.add(clave)
      nuevas.push(limpia)
    }
    if (nuevas.length > 0) onChange([...etiquetas, ...nuevas])
  }

  const puestasClave = new Set(etiquetas.map((e) => normalizarTexto(e)))
  const sugerenciasVisibles = sugerencias
    .filter((s) => !puestasClave.has(normalizarTexto(s.texto)))
    .slice(0, MAX_SUGERENCIAS_ETIQUETA)

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
      {sugerenciasVisibles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sugerenciasVisibles.map((sugerencia) => (
            <button
              key={sugerencia.texto}
              type="button"
              onClick={() => agregar(sugerencia.texto)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-noct-neutral-700 px-2.5 py-[3px] text-[11px] text-noct-neutral-400 hover:border-noct-accent hover:text-noct-accent-300"
            >
              <Plus size={10} aria-hidden />
              {sugerencia.texto}
            </button>
          ))}
        </div>
      )}
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
