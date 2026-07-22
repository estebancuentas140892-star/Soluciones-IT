import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useDeferredValue, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'
import { obtenerFavoritos } from '../../lib/favoritos'
import { obtenerRecientes } from '../../lib/recientes'
import { obtenerEstadoSync, sincronizar, suscribirSync } from '../../lib/sync'
import { ShellNocturne } from '../../app/ShellNocturne'
import { DescargarOffline } from '../../components/DescargarOffline'
import {
  BookOpen,
  CaretRight,
  CheckCircle,
  ClockCounterClockwise,
  CloudArrowUp,
  CloudCheck,
  CloudSlash,
  FlagBanner,
  type IconoProps,
  Lightbulb,
  LockSimple,
  MagnifyingGlass,
  MapPin,
  Monitor,
  PencilSimple,
  Play,
  QrCode,
  Star,
  TreeStructure,
  User,
  UsersThree,
  Vault,
  XCircleFill,
} from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import {
  buscar,
  type ResultadoBusqueda,
  type TipoResultado,
  useIndiceBusqueda,
} from '../busqueda/useIndiceBusqueda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import {
  ETIQUETA_ACCION_CAMBIO,
  obtenerActividadReciente,
  tiempoRelativo,
  type FilaActividad,
} from '../historial/actividadEquipo'
import { etiquetaResuelto } from '../historial/lineaDeTiempo'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { calcularPendientes, type ItemPendiente } from './pendientes'

// Pantalla de Inicio en el sistema Nocturne (re-autoria del handoff
// "Rediseño de aplicación empresarial", Inicio.dc.html). Un solo punto
// de entrada al conocimiento del equipo: un buscador global que atraviesa
// soluciones, dispositivos y boveda, y, cuando no se busca, los atajos de
// trabajo (retomar un procedimiento a medias, diagnostico, escaner), lo
// reciente y la ruta de aprendizaje. Trae su propio ShellNocturne (sidebar
// en escritorio, pestañas en movil), por eso su ruta vive fuera del Layout
// oscuro heredado, como el resto de pantallas ya re-autorizadas.

// Icono y tono del recuadro por tipo de resultado, con el lenguaje de
// color del sistema: articulos/diagnosticos/categorias en el acento, un
// dispositivo en verde (exito), una credencial y los adjuntos en neutro.
// Las clases van completas y literales porque Tailwind no detecta nombres
// construidos dinamicamente.
interface Visual {
  Icono: (props: IconoProps) => React.JSX.Element
  tono: string
}
const VISUAL_POR_TIPO: Record<TipoResultado, Visual> = {
  articulo: { Icono: BookOpen, tono: 'text-noct-accent bg-noct-accent/[.12]' },
  categoria: { Icono: BookOpen, tono: 'text-noct-accent bg-noct-accent/[.12]' },
  diagnostico: { Icono: TreeStructure, tono: 'text-noct-accent bg-noct-accent/[.12]' },
  adjunto: { Icono: BookOpen, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
  dispositivo: { Icono: Monitor, tono: 'text-noct-exito bg-noct-exito/[.12]' },
  credencial: { Icono: LockSimple, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
  ubicacion: { Icono: MapPin, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
  persona: { Icono: User, tono: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]' },
}

// Los resultados se agrupan por fuente (los modulos con contenido
// buscable), no por los tipos internos: el tecnico piensa en "donde
// esta", no en el tipo de dato. Cada tipo cae en su grupo.
const GRUPOS_BUSQUEDA: {
  id: string
  nombre: string
  Icono: (props: IconoProps) => React.JSX.Element
  tipos: TipoResultado[]
}[] = [
  { id: 'soluciones', nombre: 'Soluciones', Icono: BookOpen, tipos: ['diagnostico', 'categoria', 'articulo', 'adjunto'] },
  { id: 'dispositivos', nombre: 'Dispositivos', Icono: Monitor, tipos: ['dispositivo'] },
  { id: 'boveda', nombre: 'Bóveda', Icono: Vault, tipos: ['credencial'] },
  // Ubicaciones en el buscador (fase P3, punto 4 del encargo): hoy
  // faltaban pese a ser entidad propia desde N3.
  { id: 'ubicaciones', nombre: 'Ubicaciones', Icono: MapPin, tipos: ['ubicacion'] },
  // Personas en el buscador (hallazgo T1): mismo criterio que ubicaciones.
  { id: 'personas', nombre: 'Personas', Icono: User, tipos: ['persona'] },
]

// Parte un titulo en tres tramos segun donde cae el termino buscado
// (comparando normalizado, devolviendo el original). El resaltado usa
// `match`; si no hay coincidencia literal (busqueda difusa o por sinonimo)
// todo el titulo queda en `pre`, sin resaltar.
function partirTitulo(titulo: string, consulta: string) {
  if (!consulta) return { pre: titulo, match: '', post: '' }
  const i = normalizarTexto(titulo).indexOf(consulta)
  if (i < 0) return { pre: titulo, match: '', post: '' }
  return {
    pre: titulo.slice(0, i),
    match: titulo.slice(i, i + consulta.length),
    post: titulo.slice(i + consulta.length),
  }
}

export function InicioPage() {
  const [query, setQuery] = useState('')
  // El input usa `query` directo (nunca se atrasa); todo lo derivado de
  // buscar y pintar resultados usa la version diferida, para que
  // escribir se sienta instantaneo aunque la busqueda o la lista de
  // resultados tarden un poco mas en ponerse al dia.
  const queryDiferida = useDeferredValue(query)
  const consultaCruda = queryDiferida.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])

  const recientes = useLiveQuery(() => obtenerRecientes(), [], [])
  const favoritos = useLiveQuery(() => obtenerFavoritos(), [], [])
  const actividad = useLiveQuery(() => obtenerActividadReciente(), [], [])

  // Pendientes (fase J-D5 de PROPUESTA_JORNADA_TECNICO.md, decision
  // aprobada por el usuario el 2026-07-21 con el contenido recomendado):
  // bloque derivado de lo que ya significa "pendiente" en los datos
  // reales, sin tabla ni esquema nuevos. Ver src/features/inicio/pendientes.ts.
  const perfil = usePerfilVivo()
  const borradores = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && a.estado === 'borrador').toArray(),
    [],
    [],
  )
  const credencialesConVencimiento = useLiveQuery(
    () => db.credenciales.filter((c) => !c.eliminadoEn && Boolean(c.venceEn)).toArray(),
    [],
    [],
  )
  const ejecucionesConSugerencia = useLiveQuery(
    () => db.ejecuciones_diagnostico.filter((e) => e.motivo === 'encontro_otra_solucion').toArray(),
    [],
    [],
  )
  // Artículos que ya cerraron una sugerencia (tarea 140). Consulta
  // propia y no `borradores`: el artículo puede estar publicado, y ese
  // es justamente el caso en que la sugerencia está más cerrada.
  const articulosDeSugerencia = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && Boolean(a.origenSugerenciaId)).toArray(),
    [],
    [],
  )
  const pendientes = useMemo(
    () =>
      perfil
        ? calcularPendientes({
            articulos: borradores,
            credenciales: credencialesConVencimiento,
            ejecuciones: ejecucionesConSugerencia,
            articulosDeSugerencia,
            usuarioId: perfil.id,
            puedeVerBoveda: perfil.puedeVerBoveda,
          })
        : [],
    [perfil, borradores, credencialesConVencimiento, ejecucionesConSugerencia, articulosDeSugerencia],
  )

  // Articulos marcados por el equipo como "ruta de inicio" (ver
  // ArticuloForm): puerta de entrada para quien recien llega. Menor
  // orden primero; a igualdad, por titulo para una lista estable.
  const rutas = useLiveQuery(
    async () => {
      const articulos = await db.articulos
        .filter((a) => a.esRutaInicio && !a.eliminadoEn && (a.estado ?? 'publicado') === 'publicado')
        .toArray()
      return articulos.sort(
        (a, b) =>
          (a.ordenRutaInicio ?? 0) - (b.ordenRutaInicio ?? 0) ||
          a.titulo.localeCompare(b.titulo, 'es', { numeric: true }),
      )
    },
    [],
    [],
  )

  // "Continuar donde quedaste": el procedimiento con avance a medias mas
  // reciente. Se recorre progresoPasos (avance local por dispositivo) de
  // mas nuevo a mas viejo y se toma el primero con al menos un paso hecho
  // pero sin terminar. actualizadoEn no esta indexado, asi que el orden se
  // hace en memoria (son pocas filas: el avance de un equipo de 5). Un
  // articulo eliminado o sin pasos se salta.
  const enCurso = useLiveQuery(async () => {
    const progresos = (await db.progresoPasos.toArray()).sort((a, b) =>
      b.actualizadoEn.localeCompare(a.actualizadoEn),
    )
    for (const progreso of progresos) {
      const articulo = await db.articulos.get(progreso.articuloId)
      if (!articulo || articulo.eliminadoEn) continue
      const proc = normalizarProcedimiento(articulo.procedimiento)
      if (!proc || proc.pasos.length === 0) continue
      const total = proc.pasos.length
      const hechos = contarHechos(
        progreso.pasosHechos ?? [],
        proc.pasos.map((p) => p.id),
      )
      if (hechos === 0 || hechos >= total) continue
      return {
        titulo: articulo.titulo,
        ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
        pct: Math.round((hechos / total) * 100),
        detalle: `Paso ${Math.min(hechos + 1, total)} de ${total}`,
      }
    }
    return null
  }, [])

  const hora = new Date().getHours()
  const saludo =
    (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches') +
    '. Todo el conocimiento del equipo, al instante'

  // Grupos con al menos un resultado, en el orden fijo de GRUPOS_BUSQUEDA.
  const gruposResultado = useMemo(() => {
    return GRUPOS_BUSQUEDA.map((grupo) => {
      const items = resultados.filter((r) => grupo.tipos.includes(r.tipo))
      return items.length ? { ...grupo, items } : null
    }).filter((g): g is NonNullable<typeof g> => g !== null)
  }, [resultados])

  return (
    <ShellNocturne>
      {/* Cabecera fija con desenfoque: marca, saludo, estado de
          sincronizacion, acceso a la cuenta y el buscador global. */}
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-3">
          <div>
            <h1 className="text-[22px] font-medium leading-tight">IT Brain</h1>
            <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">{saludo}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <PastillaSync />
            {/* Unica entrada a Cuenta, Seguridad y Cerrar sesion desde
                el telefono: el sidebar de ShellNocturne que la ofrece
                solo existe en escritorio (lg). Vive en Inicio por ser
                la pestaña que todos abren primero. */}
            <Link
              to="/cuenta"
              aria-label="Mi cuenta"
              title="Mi cuenta"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-noct-neutral-400 hover:bg-noct-text/[.05] hover:text-noct-text lg:hidden"
            >
              <User size={20} aria-hidden />
            </Link>
          </div>
        </header>

        <div className="px-4 pb-3 pt-2">
          <label
            className={`flex h-11 items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
              buscando ? 'border-noct-accent' : 'border-noct-divider'
            }`}
          >
            <MagnifyingGlass
              size={18}
              className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en todo: artículos, equipos, bóveda"
              aria-label="Buscar en todo el conocimiento del equipo"
              className="ini-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
            />
            {buscando && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
              >
                <XCircleFill size={18} aria-hidden />
              </button>
            )}
          </label>
        </div>
      </div>

      <main className="flex-1 px-4 pb-[116px] pt-4 lg:pb-16">
        {buscando ? (
          gruposResultado.length > 0 ? (
            <div className="@container flex flex-col gap-5">
              {gruposResultado.map((grupo) => (
                <section key={grupo.id}>
                  <div className="mb-1.5 flex items-center gap-2 px-0.5">
                    <grupo.Icono size={14} className="text-noct-neutral-400" aria-hidden />
                    <TituloSeccion>{grupo.nombre}</TituloSeccion>
                    <span className="text-[11px] text-noct-neutral-600">{grupo.items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 @2xl:grid-cols-2">
                    {grupo.items.map((item) => (
                      <FilaResultado key={item.id} resultado={item} consulta={consulta} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
              <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
              <div>
                <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                  Nada coincide con "{consultaCruda}". Prueba otra palabra o revisa la ortografía.
                </p>
              </div>
              <button type="button" onClick={() => setQuery('')} className={`mt-0.5 ${BTN_SECUNDARIO}`}>
                Limpiar búsqueda
              </button>
            </div>
          )
        ) : (
          <div className="@container flex flex-col gap-[22px]">
            {enCurso && (
              <Link
                to={enCurso.ruta}
                className="flex flex-col gap-2.5 rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] p-3.5 text-noct-text hover:bg-noct-accent/[.13]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-noct-accent/[.16] text-noct-accent-300">
                    <Play size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.07em] text-noct-accent-300">
                      Continuar donde quedaste
                    </span>
                    <span className="mt-[3px] block text-[14.5px] font-medium leading-[1.3] [text-wrap:pretty]">
                      {enCurso.titulo}
                    </span>
                  </span>
                  <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="block h-[3px] flex-1 overflow-hidden rounded-full bg-noct-accent/[.18]">
                    <span
                      className="block h-full rounded-full bg-noct-accent"
                      style={{ width: `${enCurso.pct}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-[12px] text-noct-neutral-400">{enCurso.detalle}</span>
                </div>
              </Link>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <AtajoRapido
                to="/diagnostico"
                Icono={TreeStructure}
                titulo="Diagnóstico inteligente"
                detalle="Del problema a la solución"
              />
              <AtajoRapido
                to="/escaner"
                Icono={QrCode}
                titulo="Escanear equipo"
                detalle="Ficha por código QR"
              />
            </div>

            {/* Pendientes (decisión D5 de PROPUESTA_JORNADA_TECNICO.md):
                mis borradores, credenciales por vencer/vencidas (solo con
                permiso de bóveda) y sugerencias del equipo sin revisar.
                Bloque derivado, sin tabla ni escrituras nuevas. */}
            {pendientes.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <CheckCircle size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Pendientes</TituloSeccion>
                </div>
                <div className="flex flex-col">
                  {pendientes.map((item) => (
                    <FilaPendiente key={item.clave} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Favoritos: la lista fija que el tecnico arma a mano con la
                estrella de cada ficha. Solo se muestra si hay alguno; el
                bloque no se anuncia vacio para no ensuciar Inicio. */}
            {favoritos.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <Star size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Favoritos</TituloSeccion>
                </div>
                <div className="grid grid-cols-1 @2xl:grid-cols-2">
                  {favoritos.map((favorito) => {
                    const { Icono, tono } = VISUAL_POR_TIPO[favorito.tipo]
                    return (
                      <Link
                        key={favorito.clave}
                        to={favorito.ruta}
                        className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                      >
                        <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${tono}`}>
                          <Icono size={17} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="mb-0.5 block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                            {favorito.titulo}
                          </span>
                          <span className="block truncate text-[12px] text-noct-neutral-500">
                            {favorito.subtitulo}
                          </span>
                        </span>
                        <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* En ancho, Recientes y Para empezar se reparten en dos
                columnas (container query); en móvil quedan apiladas. */}
            <div className={`grid gap-[22px] @2xl:items-start ${rutas.length > 0 ? '@2xl:grid-cols-2' : ''}`}>
            <section>
              <div className="mb-1.5 flex items-center gap-2 px-0.5">
                <ClockCounterClockwise size={14} className="text-noct-neutral-400" aria-hidden />
                <TituloSeccion>Recientes</TituloSeccion>
              </div>
              {recientes.length > 0 ? (
                <div className="flex flex-col">
                  {recientes.map((reciente) => {
                    const esDispositivo = reciente.clave.startsWith('dispositivo:')
                    const { Icono, tono } = esDispositivo
                      ? VISUAL_POR_TIPO.dispositivo
                      : VISUAL_POR_TIPO.articulo
                    return (
                      <Link
                        key={reciente.clave}
                        to={reciente.ruta}
                        className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                      >
                        <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${tono}`}>
                          <Icono size={17} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="mb-0.5 block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                            {reciente.titulo}
                          </span>
                          <span className="block truncate text-[12px] text-noct-neutral-500">
                            {reciente.subtitulo}
                          </span>
                        </span>
                        <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-5 text-center text-[13px] leading-normal text-noct-neutral-500">
                  Aún no hay elementos recientes. Lo que se consulte aparece aquí.
                </p>
              )}
            </section>

            {rutas.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <FlagBanner size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Para empezar</TituloSeccion>
                  <span className="text-[11px] text-noct-neutral-600">ruta de aprendizaje</span>
                </div>
                <div className="flex flex-col">
                  {rutas.map((articulo, indice) => (
                    <Link
                      key={articulo.id}
                      to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
                      className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noct-accent text-[12.5px] font-medium text-noct-accent-300">
                        {indice + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                        {articulo.titulo}
                      </span>
                      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
            )}
            </div>

            {/* Actividad del equipo (fase J2): "¿que cambio hoy?" sin
                abrir ficha por ficha. Vista compartida (a diferencia de
                Favoritos y Recientes, que son personales), colapsada a 5
                renglones; decision D2 aplicada con la opcion recomendada
                (solo bloque en Inicio, sin pantalla completa todavia). */}
            {actividad.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <UsersThree size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Actividad del equipo</TituloSeccion>
                </div>
                <div className="flex flex-col">
                  {actividad.map((fila) => (
                    <FilaActividadItem key={fila.clave} fila={fila} />
                  ))}
                </div>
              </section>
            )}

            <DescargarOffline />
          </div>
        )}
      </main>
    </ShellNocturne>
  )
}

// Fila de un resultado de busqueda, con el termino resaltado.
function FilaResultado({ resultado, consulta }: { resultado: ResultadoBusqueda; consulta: string }) {
  const { Icono, tono } = VISUAL_POR_TIPO[resultado.tipo]
  const { pre, match, post } = partirTitulo(resultado.titulo, consulta)
  return (
    <Link
      to={resultado.ruta}
      className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${tono}`}>
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
          {pre}
          {match && <span className="rounded-[3px] bg-noct-accent/[.18] text-noct-accent-300">{match}</span>}
          {post}
        </span>
        {resultado.subtitulo && (
          <span className="block truncate text-[12px] text-noct-neutral-500">{resultado.subtitulo}</span>
        )}
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

// Fila del bloque "Actividad del equipo": quien hizo que, sobre que
// ficha, hace cuanto. Un cambio de campo dice "Ana editó X (3
// cambios)"; una ejecucion de diagnostico dice "Ana ejecutó el
// diagnostico X (Resuelto)". El tono visual reutiliza VISUAL_POR_TIPO
// (ejecucion se pinta igual que un diagnostico: mismo destino, misma
// naturaleza de contenido).
function FilaActividadItem({ fila }: { fila: FilaActividad }) {
  const { Icono, tono } = VISUAL_POR_TIPO[fila.entidadTipo ?? 'diagnostico']
  const accionTexto =
    fila.tipo === 'ejecucion'
      ? `ejecutó el diagnóstico`
      : ETIQUETA_ACCION_CAMBIO[fila.accion ?? 'edito']
  const detalle =
    fila.tipo === 'ejecucion'
      ? `(${etiquetaResuelto(fila.resuelto ?? 'abandonado')})`
      : fila.accion === 'edito' && fila.cantidadCambios > 1
        ? `(${fila.cantidadCambios} cambios)`
        : ''

  return (
    <Link
      to={fila.ruta}
      className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${tono}`}>
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block text-sm leading-[1.3] [text-wrap:pretty]">
          <span className="font-medium">{fila.usuarioNombre}</span> {accionTexto}{' '}
          <span className="font-medium">{fila.titulo}</span> {detalle}
        </span>
        <span className="block truncate text-[12px] text-noct-neutral-500">
          {tiempoRelativo(fila.fechaHora)}
        </span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

// Icono y tono de una fila de "Pendientes" según su categoría/urgencia:
// una credencial vencida pesa distinto que un borrador propio, aunque
// ambos sean "algo por resolver".
const ICONO_PENDIENTE: Record<ItemPendiente['categoria'], (props: IconoProps) => React.JSX.Element> = {
  borrador: PencilSimple,
  credencial: LockSimple,
  sugerencia: Lightbulb,
}
const TONO_PENDIENTE: Record<ItemPendiente['tono'], string> = {
  neutro: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]',
  precaucion: 'text-noct-precaucion bg-noct-precaucion/[.12]',
  error: 'text-noct-error bg-noct-error/[.12]',
}

function FilaPendiente({ item }: { item: ItemPendiente }) {
  const Icono = ICONO_PENDIENTE[item.categoria]
  return (
    <Link
      to={item.ruta}
      className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${TONO_PENDIENTE[item.tono]}`}>
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block truncate text-sm font-medium leading-[1.3] [text-wrap:pretty]">
          {item.titulo}
        </span>
        <span className="block truncate text-[12px] text-noct-neutral-500">{item.detalle}</span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

// Atajo de la rejilla superior (diagnostico, escaner): icono en el
// acento, titulo y subtitulo, borde que reacciona al hover.
function AtajoRapido({
  to,
  Icono,
  titulo,
  detalle,
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  detalle: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-11 flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface p-3.5 text-noct-text hover:border-noct-accent hover:bg-noct-accent/[.06]"
    >
      <Icono size={21} className="text-noct-accent" aria-hidden />
      <span className="text-[13.5px] font-medium leading-[1.3]">
        {titulo}
        <span className="mt-0.5 block text-[11.5px] font-normal leading-[1.4] text-noct-neutral-500">
          {detalle}
        </span>
      </span>
    </Link>
  )
}

// El panel de sincronizacion solo carga si el usuario lo abre.
const PanelSync = lazy(() => import('../../components/PanelSync').then((m) => ({ default: m.PanelSync })))

function suscribirRed(escucha: () => void): () => void {
  window.addEventListener('online', escucha)
  window.addEventListener('offline', escucha)
  return () => {
    window.removeEventListener('online', escucha)
    window.removeEventListener('offline', escucha)
  }
}

// Pastilla de estado de sincronizacion en la cabecera: responde de un
// vistazo "¿ya se subio lo que cambie?" con icono, etiqueta y color.
// Tocarla fuerza una sincronizacion y abre el panel (mismo comportamiento
// que IndicadorSync, con el aspecto Nocturne del handoff). Cuatro estados:
// al dia (neutro), sincronizando/pendiente (precaucion), con error (error)
// y sin conexion (precaucion), siguiendo el lenguaje de estados de 08_ESTILO.
function PastillaSync() {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const enLinea = useSyncExternalStore(suscribirRed, () => navigator.onLine)
  const [panelAbierto, setPanelAbierto] = useState(false)

  let Icono = CloudCheck
  let etiqueta = 'Al día'
  let titulo = 'Sincronizado y disponible sin conexión'
  let clase = 'border-noct-divider text-noct-neutral-400'
  if (!enLinea) {
    Icono = CloudSlash
    etiqueta = 'Sin conexión'
    titulo =
      estado.cambiosPendientes > 0
        ? `Trabajando con la copia local. ${estado.cambiosPendientes} cambio(s) por subir.`
        : 'Trabajando con la copia local'
    clase = 'border-noct-precaucion/40 text-noct-precaucion'
  } else if (estado.cambiosConError > 0) {
    Icono = CloudSlash
    etiqueta = 'Con error'
    titulo = `${estado.cambiosConError} cambio(s) con error de sincronización`
    clase = 'border-noct-error/40 text-noct-error'
  } else if (estado.enCurso || estado.cambiosPendientes > 0) {
    Icono = CloudArrowUp
    etiqueta = 'Sincronizando'
    titulo = estado.enCurso ? 'Subiendo los cambios' : 'Hay cambios pendientes de subir'
    clase = 'border-noct-precaucion/40 text-noct-precaucion'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void sincronizar()
          setPanelAbierto(true)
        }}
        title={`${titulo}. Tocar para ver el detalle y sincronizar ahora.`}
        aria-label={titulo}
        className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-[11px] text-[12px] font-medium ${clase}`}
      >
        <Icono size={14} className={estado.enCurso ? 'animate-pulse' : ''} aria-hidden />
        {etiqueta}
      </button>
      {panelAbierto && (
        <Suspense fallback={null}>
          <PanelSync abierto={panelAbierto} onCerrar={() => setPanelAbierto(false)} />
        </Suspense>
      )}
    </>
  )
}
