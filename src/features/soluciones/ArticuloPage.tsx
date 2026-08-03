import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  db,
  type Articulo,
  type ArticuloRelacionado,
  type NivelDificultad,
  type Procedimiento,
} from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import { contarHechos, reiniciarProgreso } from '../../lib/progresoPasos'
import { compartirOCopiar } from '../../lib/portapapeles'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { Chasis } from '../../app/Chasis'
import { Adjuntos } from '../../components/Adjuntos'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { ReferenciadoPor } from '../../components/ReferenciadoPor'
import { useGrafo } from '../../components/useGrafo'
import { resumenImpacto } from '../../lib/grafo'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  BookOpen,
  CaretRight,
  Circle,
  ClockCounterClockwise,
  Copy,
  DotsThreeBold,
  PencilSimple,
  ShareNetwork,
  TrashSimple,
  Warning,
  WarningOctagon,
} from '../../components/iconos'
import { BotonFavorito } from '../../components/BotonFavorito'
import { BarraAccionFicha, type EstadoAccion } from '../../components/BarraAccionFicha'
import { BTN_ICONO_SECUNDARIO, TagNeutral, TituloSeccion } from '../../components/nocturne'
import { Historial } from '../historial/Historial'
import { ProcedimientoVista } from './ProcedimientoVista'
import { colorIconoDeTipo } from './iconosSoluciones'
import { etiquetaDeTipo } from './tiposArticulo'
import { describirAplicaA } from './aplicaA'

const ETIQUETA_DIFICULTAD: Record<NivelDificultad, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

// Fecha corta al estilo del diseño ("12 jul"); con el año solo cuando
// no es el actual, para no perder informacion en articulos viejos.
function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const opciones: Intl.DateTimeFormatOptions =
    fecha.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('es', opciones).format(fecha)
}

// Ficha de un articulo en el sistema Nocturne (handoff "Ficha de
// Procedimiento.dc.html"): cabecera compacta con regreso contextual y
// acciones (Asistente, Editar y el menu "···" con el resto, regla 4 de
// 08_ESTILO.md), etiquetas de metadatos, titulo, y el procedimiento
// como stepper con barra de progreso pegajosa (ProcedimientoVista).
// Primera pantalla que estrena el shell movil Nocturne.
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
  // Un procedimiento puede existir solo por su metadata y sin pasos
  // (K1: un manual con descripcion/portada/objetivo pero sin pasos no
  // es null). "Ejecutar", el modo asistente, reiniciar progreso y el
  // cuerpo en pasos del procedimiento solo tienen sentido si hay algo
  // que ejecutar.
  const tieneProcedimiento = procedimientoEjecutable(procedimiento)

  // Impacto antes de eliminar (fase N1): otros procedimientos o
  // diagnósticos que referencian este artículo y quedarían con el
  // vínculo roto. null si nadie lo usa.
  const grafo = useGrafo()
  const impacto = useMemo(() => resumenImpacto(grafo, 'articulo', articuloId), [grafo, articuloId])

  const idVisitado = articulo && !articulo.eliminadoEn ? articulo.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('articulo', idVisitado)
  }, [idVisitado])

  if (articulo === null) return <Navigate to={`/soluciones?categoria=${categoriaId}`} replace />
  if (!articulo) {
    return (
      <Chasis modo="documento">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </Chasis>
    )
  }

  async function eliminar() {
    await eliminarRegistro('articulos', articuloId)
    navigate(`/soluciones?categoria=${categoriaId}`)
  }

  const estado = articulo.estado ?? 'publicado'
  // El tipo pasó al kicker (decisión 3) y la versión a la lista de
  // metadatos (decisión 4), así que esta línea se queda solo con la
  // procedencia del dato: cuándo y quién.
  const metaLinea = `Actualizado el ${fechaCorta(articulo.updatedAt)}${autor?.nombre ? ` por ${autor.nombre}` : ''}`

  return (
    // Nivel 2 del chasis (tarea 185): documento. Conserva las pestañas
    // (R19: la barra solo cede ante una tarea con salida) y el regreso
    // deriva de la jerarquía central (padreDe): la ficha de artículo
    // sube a la lista de Guías con el chip de su categoría, y la
    // etiqueta muestra el nombre de la categoría.
    <Chasis
      modo="documento"
      volverEtiqueta={categoria?.nombre ?? 'Guías'}
      // Ancla permanente (M-001, M-R1): en un procedimiento de varias
      // pantallas, el título dejaba de verse al primer desplazamiento.
      titulo={articulo.titulo}
      contexto={['Guías', categoria?.nombre].filter(Boolean).join(' · ')}
      acciones={
        // Decisión 2 de P2: tres controles de 44 px y ni uno más. Antes
        // eran cinco (volver + estrella + Ejecutar + Editar + "···") y
        // con una categoría de nombre largo la fila se estrangulaba.
        // "Ejecutar" se va a la barra inferior (decisión 1) y "Editar"
        // pierde su rótulo: con la acción dominante abajo, un botón de
        // borde aquí arriba volvería a competir con ella, que es
        // exactamente lo que la auditoría señala.
        <>
          <BotonFavorito tipo="articulo" entidadId={articuloId} />
          <Link
            to={`/soluciones/${categoriaId}/${articuloId}/editar`}
            aria-label="Editar este artículo"
            title="Editar"
            className={BTN_ICONO_SECUNDARIO}
          >
            <PencilSimple size={17} aria-hidden />
          </Link>
          <MenuAcciones
            articulo={articulo}
            categoriaId={categoriaId}
            conProcedimiento={tieneProcedimiento}
            onEliminar={() => setMostrarEliminar(true)}
          />
        </>
      }
    >
      {/* `lg:px-10` y no `lg:px-12`: un solo eje vertical compartido con
          las fichas hermanas de equipo y credencial (R26, tarea 191). */}
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-16 pt-1 lg:px-10">
        {estado === 'borrador' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-noct-precaucion/30 bg-noct-precaucion/10 px-3 py-2.5">
            <Warning size={16} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
            <p className="text-[13px] leading-normal">
              Borrador. No aparece en el buscador, las rutas de inicio ni el diagnóstico.
            </p>
          </div>
        )}
        {estado === 'obsoleto' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-noct-error/30 bg-noct-error/10 px-3 py-2.5">
            <WarningOctagon size={16} className="mt-px shrink-0 text-noct-error" aria-hidden />
            <p className="text-[13px] leading-normal">
              Obsoleto. Se conserva solo como referencia; usar el procedimiento vigente.
            </p>
          </div>
        )}

        {procedimiento?.portada && <PortadaArticulo portada={procedimiento.portada} titulo={articulo.titulo} />}

        <header className="flex flex-col gap-2">
          {/* Kicker de tipo (decisión 3): identifica el documento en el
              matiz de su tipo sin gastar una pastilla. Antes el tipo iba
              dentro de la línea de metadatos, mezclado con la versión y
              la fecha. La categoría ya no se repite aquí: la nombra el
              botón de regreso (R13). */}
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${colorIconoDeTipo(articulo.tipo)}`}
          >
            {etiquetaDeTipo(articulo.tipo)}
          </p>
          <h1 className="text-pretty text-[22px] font-medium leading-[1.25]">{articulo.titulo}</h1>
          {procedimiento?.descripcion && (
            <p className="text-pretty text-[13.5px] leading-normal text-noct-neutral-400">
              {procedimiento.descripcion}
            </p>
          )}
          <MetadatosArticulo
            tiempoMin={procedimiento?.tiempoEstimadoMin ?? null}
            dificultad={procedimiento?.dificultad ?? null}
            aplicaA={describirAplicaA(articulo.aplicaA ?? null)}
            version={articulo.version ?? '1.0'}
          />
          <p className="text-xs text-noct-neutral-500">{metaLinea}</p>
        </header>

        <DialogoEliminar
          abierto={mostrarEliminar}
          sensible
          titulo={
            tieneProcedimiento
              ? `¿Eliminar procedimiento "${articulo.titulo}"?`
              : `¿Eliminar artículo "${articulo.titulo}"?`
          }
          descripcion={
            tieneProcedimiento
              ? 'Esta acción eliminará todo el procedimiento y sus pasos asociados.'
              : 'Esta acción eliminará el artículo por completo.'
          }
          advertencia={impacto ? `${impacto} Al eliminarlo, esos vínculos quedarán rotos.` : null}
          onCerrar={() => setMostrarEliminar(false)}
          onConfirmar={eliminar}
        />

        {articulo.tipo === 'problema_frecuente' && <IncidenciaResumen articulo={articulo} />}

        {tieneProcedimiento && <ProcedimientoVista articuloId={articuloId} procedimiento={procedimiento} />}

        {articulo.contenido.trim() !== '' && (
          <article className="prose prose-invert prose-sm max-w-none prose-headings:font-medium prose-headings:text-noct-text prose-p:text-noct-neutral-200 prose-li:text-noct-neutral-200 prose-strong:text-noct-text prose-a:text-noct-accent-400">
            <Markdown remarkPlugins={[remarkGfm]}>{articulo.contenido}</Markdown>
          </article>
        )}

        {/* En los procedimientos, los adjuntos viven en cada paso (donde
            se usan). El apartado del articulo solo se muestra para
            articulos sin procedimiento (manuales en Markdown), que no
            tienen pasos donde anclar el archivo. */}
        {!tieneProcedimiento && <Adjuntos entidadTipo="articulo" entidadId={articuloId} />}

        <ArticulosRelacionados articuloId={articuloId} relacionados={articulo.relacionados ?? []} />

        {/* Inverso universal: qué procedimientos y diagnósticos usan este
            artículo. Se excluye 'relacionado', que ya tiene su propio
            bloque ("Aparece como relacionado en") arriba. */}
        <ReferenciadoPor
          tipo="articulo"
          id={articuloId}
          relaciones={['subprocedimiento', 'solucion', 'decision', 'diagnostico_articulo']}
        />

        {(articulo.etiquetas ?? []).length > 0 && (
          <footer className="flex flex-wrap gap-1.5">
            {/* Tocable (fase J4, hueco del punto 9): lleva al filtro por
                esta etiqueta en Soluciones, sin obligar a volver a
                buscar. */}
            {articulo.etiquetas.map((etiqueta) => (
              <Link
                key={etiqueta}
                to={`/soluciones?etiqueta=${encodeURIComponent(etiqueta)}`}
                className="hover:opacity-80"
              >
                <TagNeutral>{etiqueta}</TagNeutral>
              </Link>
            ))}
          </footer>
        )}

        <Historial entidadTipo="articulo" entidadId={articuloId} />

        {/* Decisión 1 de P2: una sola acción dominante, fija abajo y con
            etiqueta contextual. Solo si hay algo que ejecutar (R3: ningún
            control muerto). El `mt-auto` de la barra la empuja al pie
            cuando el documento es corto. */}
        {tieneProcedimiento && (
          <AccionDominante articuloId={articuloId} categoriaId={categoriaId} procedimiento={procedimiento} />
        )}
      </main>
    </Chasis>
  )
}

// Los cuatro metadatos con su rótulo (decisión 4 de P2). Antes eran
// cuatro pastillas neutras idénticas ("Impresoras", "Zebra ZT411",
// "Intermedio", "25 min") donde nada decía que la segunda es una
// restricción de aplicabilidad y no una etiqueta más. Como lista de
// definición, cada dato dice qué es. Se omite el que no existe: una fila
// "Dificultad: sin definir" no informa de nada.
function MetadatosArticulo({
  tiempoMin,
  dificultad,
  aplicaA,
  version,
}: {
  tiempoMin: number | null
  dificultad: NivelDificultad | null
  aplicaA: string
  version: string
}) {
  const filas: { rotulo: string; valor: string }[] = []
  if (tiempoMin) filas.push({ rotulo: 'Tiempo', valor: `${tiempoMin} min` })
  if (dificultad) filas.push({ rotulo: 'Dificultad', valor: ETIQUETA_DIFICULTAD[dificultad] })
  if (aplicaA) filas.push({ rotulo: 'Aplica a', valor: aplicaA })
  filas.push({ rotulo: 'Versión', valor: `v${version}` })

  return (
    <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
      {filas.map(({ rotulo, valor }) => (
        <Fragment key={rotulo}>
          <dt className="text-noct-neutral-500">{rotulo}</dt>
          <dd className="min-w-0 text-noct-neutral-200">{valor}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

// Etiqueta contextual de la barra inferior: "Empezar" sin avance,
// "Seguir en el paso N de M" a medias, "Repetir" cuando ya está todo
// hecho. Antes decía "Ejecutar" siempre, incluso con 2 de 6 pasos
// hechos, donde lo que se hace es seguir.
function AccionDominante({
  articuloId,
  categoriaId,
  procedimiento,
}: {
  articuloId: string
  categoriaId: string
  procedimiento: Procedimiento
}) {
  const progreso = useLiveQuery(() => db.progresoPasos.get(articuloId), [articuloId])
  const idsPasos = procedimiento.pasos.map((p) => p.id)
  const hechos = contarHechos(progreso?.pasosHechos ?? [], idsPasos)
  const total = idsPasos.length
  const estado: EstadoAccion = hechos === 0 ? 'empezar' : hechos >= total ? 'repetir' : 'seguir'

  return (
    <BarraAccionFicha
      to={`/soluciones/${categoriaId}/${articuloId}/ejecutar`}
      estado={estado}
      paso={hechos + 1}
      total={total}
    />
  )
}

// Menu "···" de la cabecera: las acciones que existen pero no son las
// principales (regla 4 de 08_ESTILO.md): compartir, duplicar,
// reiniciar el progreso del procedimiento y eliminar.
function MenuAcciones({
  articulo,
  categoriaId,
  conProcedimiento,
  onEliminar,
}: {
  articulo: Articulo
  categoriaId: string
  conProcedimiento: boolean
  onEliminar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function alClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  // Dialogo nativo si existe; si no, copia el enlace y avisa en el
  // propio item antes de cerrar el menu.
  async function compartir() {
    const resultado = await compartirOCopiar(articulo.titulo)
    if (resultado === 'nativo') {
      setAbierto(false)
      return
    }
    if (resultado === 'copiado') {
      setAviso('Enlace copiado')
      setTimeout(() => {
        setAviso(null)
        setAbierto(false)
      }, 1200)
    }
  }

  const claseItem =
    'flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] font-medium hover:bg-noct-text/[.07]'

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Más acciones: compartir, duplicar, eliminar"
        aria-expanded={abierto}
        className={BTN_ICONO_SECUNDARIO}
      >
        <DotsThreeBold size={18} aria-hidden />
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-col overflow-hidden rounded-lg border border-noct-divider bg-noct-surface py-1 shadow-[0_6px_18px_rgba(0,0,0,0.55)]">
          <button type="button" onClick={() => void compartir()} className={claseItem}>
            <ShareNetwork size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
            {aviso ?? 'Compartir'}
          </button>
          <Link
            to={`/soluciones/${categoriaId}/nuevo?copiarDe=${articulo.id}`}
            onClick={() => setAbierto(false)}
            className={claseItem}
          >
            <Copy size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
            Duplicar
          </Link>
          {conProcedimiento && (
            <button
              type="button"
              onClick={() => {
                void reiniciarProgreso(articulo.id)
                setAbierto(false)
              }}
              className={claseItem}
            >
              <ClockCounterClockwise size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
              Reiniciar progreso
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAbierto(false)
              onEliminar()
            }}
            className={`${claseItem} text-noct-error`}
          >
            <TrashSimple size={15} className="shrink-0" aria-hidden />
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// Articulos relacionados (grupo de esquema, punto 11): los que este
// articulo vincula, mas el inverso ("aparece como relacionado en..."),
// calculado localmente sobre el resto de articulos sin guardarlo aqui
// (bonus barato de la propuesta: nadie tiene que vincular en las dos
// direcciones a mano). Filas al estilo del diseño: icono de libro,
// titulo y caret, separadas por la regla fundida de Nocturne.
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
    <section>
      {relacionados.length > 0 && (
        <>
          <TituloSeccion className="mb-1">Relacionados</TituloSeccion>
          <div className="flex flex-col">
            {relacionados.map((articulo) =>
              rutaPorId.has(articulo.id) ? (
                <FilaRelacionado key={articulo.id} to={rutaPorId.get(articulo.id) ?? ''} titulo={articulo.titulo} />
              ) : (
                <span
                  key={articulo.id}
                  className="fila-fundida flex min-h-12 items-center gap-3 px-1 py-3 text-sm text-noct-neutral-500"
                >
                  <BookOpen size={17} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  {articulo.titulo} (eliminado)
                </span>
              ),
            )}
          </div>
        </>
      )}

      {inversos.length > 0 && (
        <>
          <TituloSeccion className={`mb-1 ${relacionados.length > 0 ? 'mt-5' : ''}`}>
            Aparece como relacionado en
          </TituloSeccion>
          <div className="flex flex-col">
            {inversos.map((articulo) => (
              <FilaRelacionado key={articulo.id} to={rutaPorId.get(articulo.id) ?? ''} titulo={articulo.titulo} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function FilaRelacionado({ to, titulo }: { to: string; titulo: string }) {
  return (
    <Link
      to={to}
      className="fila-fundida flex min-h-12 items-center gap-3 px-1 py-3 text-sm hover:bg-noct-text/[.04]"
    >
      <BookOpen size={17} className="shrink-0 text-noct-neutral-500" aria-hidden />
      <span className="min-w-0 flex-1">{titulo}</span>
      <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
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
      className="max-h-44 w-full rounded-lg border border-noct-divider object-cover"
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
    <>
      {sintomas.length > 0 && <ListaIncidencia titulo="Síntomas" items={sintomas} />}
      {causas.length > 0 && <ListaIncidencia titulo="Posibles causas" items={causas} />}
      {dispositivosAfectados.length > 0 && (
        <section>
          <TituloSeccion className="mb-2">Equipos afectados</TituloSeccion>
          <div className="flex flex-wrap gap-1.5">
            {dispositivosAfectados.map((dispositivo) => (
              <Link
                key={dispositivo.id}
                to={`/dispositivos/${dispositivo.id}`}
                className="inline-flex items-center rounded-md border border-noct-accent/30 bg-noct-accent/10 px-2.5 py-1 text-xs font-medium text-noct-accent-300 hover:bg-noct-accent/[.16]"
              >
                {dispositivo.nombre}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function ListaIncidencia({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <section>
      <TituloSeccion className="mb-2">{titulo}</TituloSeccion>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, indice) => (
          <li key={indice} className="flex items-start gap-2.5">
            <Circle size={14} className="mt-[3px] shrink-0 text-noct-neutral-600" aria-hidden />
            <span className="text-sm leading-normal">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
