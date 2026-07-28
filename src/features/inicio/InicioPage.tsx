import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'
import { obtenerFavoritos } from '../../lib/favoritos'
import { obtenerRecientes } from '../../lib/recientes'
import { ShellNocturne } from '../../app/ShellNocturne'
import { BarraSuperior } from '../../components/BarraSuperior'
import { DescargarOffline } from '../../components/DescargarOffline'
import {
  CaretRight,
  ChartBar,
  CheckCircle,
  ClockCounterClockwise,
  FlagBanner,
  type IconoProps,
  Lightbulb,
  LockSimple,
  MagnifyingGlass,
  Monitor,
  PencilSimple,
  Play,
  Plus,
  QrCode,
  Star,
  TreeStructure,
  UsersThree,
  WarningCircle,
  XCircleFill,
} from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { agruparResultados, VISUAL_POR_TIPO } from '../busqueda/resultados'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
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
import { problemasFrecuentesInicio } from './problemasFrecuentes'

// Pantalla de Inicio en el sistema Nocturne (re-autoria del handoff
// "Rediseño de aplicación empresarial", Inicio.dc.html). Un solo punto
// de entrada al conocimiento del equipo: un buscador global que atraviesa
// soluciones, dispositivos y boveda, y, cuando no se busca, los atajos de
// trabajo (retomar un procedimiento a medias, diagnostico, escaner), lo
// reciente y la ruta de aprendizaje. Trae su propio ShellNocturne (sidebar
// en escritorio, pestañas en movil), por eso su ruta vive fuera del Layout
// oscuro heredado, como el resto de pantallas ya re-autorizadas.

// VISUAL_POR_TIPO, GRUPOS_BUSQUEDA, partirTitulo y FilaResultado vivian
// aqui porque Inicio era el unico sitio desde donde se podia buscar. La
// tarea 181 saco el buscador al chasis, asi que esa presentacion se
// comparte ahora desde features/busqueda/resultados.tsx. Inicio sigue
// usando VISUAL_POR_TIPO para el bloque "Actividad del equipo".

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

  // Problemas frecuentes (decision D4 de PROPUESTA_MODULOS.md, punto 10):
  // agregacion local sobre ejecuciones_diagnostico, con fallback a los
  // diagnosticos mas recientes mientras el equipo no acumule volumen.
  const ejecucionesDiagnostico = useLiveQuery(() => db.ejecuciones_diagnostico.toArray(), [], [])
  const diagnosticosVivos = useLiveQuery(
    () => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const problemasFrecuentes = useMemo(
    () => problemasFrecuentesInicio(ejecucionesDiagnostico, diagnosticosVivos),
    [ejecucionesDiagnostico, diagnosticosVivos],
  )

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
  // Campos protegidos de equipo con vencimiento (hallazgo S2): la otra
  // mitad de la bóveda, mismo criterio que credencialesConVencimiento.
  const camposProtegidosConVencimiento = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn && Boolean(c.venceEn)).toArray(),
    [],
    [],
  )
  // Solo nombre e id: lo mínimo para resolver el nombre vivo del equipo
  // en el detalle del pendiente, sin cargar la ficha completa.
  const nombresDispositivosPorId = useLiveQuery(
    async () => new Map((await db.dispositivos.toArray()).map((d) => [d.id, d.nombre])),
    [],
    new Map<string, string>(),
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
            camposProtegidos: camposProtegidosConVencimiento,
            nombresDispositivosPorId,
            ejecuciones: ejecucionesConSugerencia,
            articulosDeSugerencia,
            usuarioId: perfil.id,
            puedeVerBoveda: perfil.puedeVerBoveda,
          })
        : [],
    [
      perfil,
      borradores,
      credencialesConVencimiento,
      camposProtegidosConVencimiento,
      nombresDispositivosPorId,
      ejecucionesConSugerencia,
      articulosDeSugerencia,
    ],
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

  const gruposResultado = useMemo(() => agruparResultados(resultados), [resultados])

  return (
    <ShellNocturne>
      {/* El titulo ("Inicio", regla R12), el estado del dato, la lupa y la
          cuenta los aporta ya BarraSuperior (tarea 181). Inicio conserva
          ademas su buscador en linea, porque esta pantalla ES el buscador:
          abrir y buscar sigue tomando dos toques. */}
      <BarraSuperior titulo="Inicio">
        <p className="px-4 pb-0.5 text-[12.5px] text-noct-neutral-400">{saludo}</p>

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
      </BarraSuperior>

      <main className="flex-1 px-4 pb-[116px] pt-4 lg:pb-16">
        {buscando ? (
          gruposResultado.length > 0 ? (
            <ResultadosBusqueda grupos={gruposResultado} consulta={consulta} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
              <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
              <div>
                <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                  Nada coincide con "{consultaCruda}". Prueba otra palabra o revisa la ortografía.
                </p>
              </div>
              {/* Crear desde el buscador sin resultados (hallazgo H9): si
                  el equipo no existe, se registra sin cambiar de módulo,
                  con el texto buscado precargado como nombre. */}
              <div className="mt-0.5 flex flex-wrap justify-center gap-2">
                <Link
                  to={`/dispositivos/nuevo?nombre=${encodeURIComponent(consultaCruda)}`}
                  className={BTN_SECUNDARIO}
                >
                  <Plus size={15} aria-hidden />
                  Crear equipo
                </Link>
                <button type="button" onClick={() => setQuery('')} className={BTN_SECUNDARIO}>
                  Limpiar búsqueda
                </button>
              </div>
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
              {/* Registrar equipo (hallazgo H9): el arranque natural de
                  quien recibe hardware nuevo. Va a lo ancho para no dejar
                  un hueco impar en la rejilla de dos columnas. */}
              <AtajoRapido
                to="/dispositivos/nuevo"
                Icono={Monitor}
                titulo="Registrar equipo"
                detalle="Dar de alta un equipo nuevo"
                className="col-span-2"
              />
            </div>

            {/* Problemas frecuentes (decisión D4 de PROPUESTA_MODULOS.md):
                los diagnósticos que más se ejecutan, o los más recientes
                mientras no haya historial suficiente. Vista derivada,
                colapsada a 4 filas; enlaza al tablero completo. */}
            {problemasFrecuentes.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2">
                    <WarningCircle size={14} className="text-noct-neutral-400" aria-hidden />
                    <TituloSeccion>Problemas frecuentes</TituloSeccion>
                  </div>
                  <Link
                    to="/diagnostico/estadisticas"
                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-noct-accent-300 underline-offset-2 hover:underline"
                  >
                    <ChartBar size={12} aria-hidden />
                    Estadísticas
                  </Link>
                </div>
                <div className="flex flex-col">
                  {problemasFrecuentes.map((problema) => (
                    <Link
                      key={problema.diagnosticoId}
                      to={`/diagnostico/${problema.diagnosticoId}`}
                      className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                    >
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded bg-noct-precaucion/[.12] text-noct-precaucion">
                        <WarningCircle size={17} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                        {problema.titulo}
                      </span>
                      <span className="shrink-0 text-[12px] text-noct-neutral-500">
                        {problema.ejecuciones == null
                          ? 'Nuevo'
                          : problema.ejecuciones === 1
                            ? '1 vez'
                            : `${problema.ejecuciones} veces`}
                      </span>
                      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
            )}

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
  campo_protegido: LockSimple,
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
  className = '',
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  detalle: string
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-11 flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface p-3.5 text-noct-text hover:border-noct-accent hover:bg-noct-accent/[.06] ${className}`}
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

