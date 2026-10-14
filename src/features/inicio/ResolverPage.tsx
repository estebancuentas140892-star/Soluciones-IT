import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { tiempoRelativo } from '../../lib/tiempoRelativo'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { DockBusqueda } from '../../components/DockBusqueda'
import { useAnchoTelefono } from '../../components/useAnchoTelefono'
import {
  ArrowRight,
  BookOpen,
  CaretRight,
  ClockCountdown,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  TreeStructure,
} from '../../components/iconos'
import { ROTULO_RECORRIDO } from '../../lib/diagnostico'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { PuenteBoveda } from '../busqueda/PuenteBoveda'
import { alcanceEfectivo, conteoPorAlcance, filtrarPorAlcance, type Alcance } from '../busqueda/alcanceBusqueda'
import { ChipsDeAlcance } from '../busqueda/ChipsDeAlcance'
import { useIdsDeRed } from '../busqueda/useIdsDeRed'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { BorradoresCoincidentes, GuiasEnBorrador } from '../busqueda/BorradoresCoincidentes'
import { AYUDA_BUSCADOR, MARCADOR_BUSCADOR } from '../busqueda/resultados'
import {
  borradoresCoincidentes,
  esBorradorVivo,
  hayGuiaPublicadaEnTitulo,
  repartirBorradores,
  sinLosYaOficiales,
} from '../busqueda/borradoresEnBusqueda'
import { iconoDeCategoria, normalizarTexto } from '../soluciones/iconosSoluciones'
import { claseTextoDeCategoria } from '../soluciones/coloresCategoria'
import { articulosSinTerminar, pasoDeTotal } from '../soluciones/sinTerminar'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { obtenerActividadReciente } from '../historial/actividadEquipo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import { agruparAgenda, type Agenda } from './agenda'
import {
  accesosRapidos,
  asuntosDeAtencion,
  guiasRecientes,
  juntarRecientes,
  partesPuertaAgenda,
  recorridosRecientes,
  type AccesoRapido,
  type GuiaReciente,
} from './resolver'
import { ContadoresAgenda, FilaAgenda } from './SeccionesAgenda'
import { usePendientes } from './usePendientes'

// RESOLVER (encargo del 2026-09-22, secciones 1 y 2).
//
// Soluciones IT se usa así: el técnico va hacia un puesto de trabajo, tiene
// un problema delante y quiere encontrar el procedimiento y seguirlo. Esta
// pantalla responde a UNA pregunta, "¿qué necesitas resolver?", y sustituye
// a dos puertas que decían lo mismo: Inicio (buscador y agenda completa) y
// la pestaña Guías (el catálogo, que ahora cuelga de aquí).
//
// NO ES UN TABLERO. Debajo del buscador solo aparece lo que ayuda a
// resolver algo, y cada bloque se retira solo cuando no tiene nada que
// decir (reglas en `resolver.ts`):
//
//   1. la pregunta y el buscador, lo primero y lo más grande;
//   2. Atención: lo que tiene fecha y hay que atender (tres como mucho);
//   3. Recientes: las guías que este técnico usó en los últimos 14 días,
//      con el paso donde se quedó si están a medias;
//   4. Accesos rápidos: las categorías con guías para ejecutar, las más
//      usadas primero, y "Todas las guías".
//
// La agenda completa (borradores, sugerencias del equipo, todo lo próximo)
// sigue en `/agenda`, a un toque desde "Atención" y desde Más. Sin
// estadísticas, actividad ni favoritos: el encargo los saca del primer
// plano y siguen donde estaban (Más).

// El origen que llevan los saltos de esta pantalla: la X de una guía y el
// regreso de la lista vuelven aquí (regla M-R2).
const ORIGEN_RESOLVER = conOrigen('/', 'Resolver')

export function ResolverPage() {
  // VOLVER CON LA BÚSQUEDA ESCRITA (encargo del 2026-09-16, sección 13).
  // Abrir una ficha desde un resultado y volver (con el regreso de la app
  // o con el botón atrás del teléfono) repone lo que estaba escrito en
  // este campo. Viaja en el estado de navegación, nunca en la URL ni en
  // localStorage.
  const { restaurada, descartar } = useBusquedaRestaurada()
  const repuesta = restaurada && !restaurada.capa ? restaurada.consulta : ''
  const [query, setQuery] = useState(repuesta)
  // Vaciar el campo repuesto es dar la búsqueda por terminada: se olvida
  // también en el historial, para que volver más tarde no la reponga.
  useEffect(() => {
    if (repuesta !== '' && query === '') descartar()
  }, [repuesta, query, descartar])
  // BUSCAR NADA MÁS ABRIR, EN ESCRITORIO. Con ratón y teclado físico el
  // campo recibe el foco al llegar: se escribe sin tocar nada. En el
  // teléfono NO: el teclado en pantalla taparía lo que hay debajo; ahí el
  // campo ya es lo primero y lo más grande.
  const refCampo = useRef<HTMLInputElement>(null)
  // El buscador va abajo, en el dock, solo con ancho de teléfono (tarea
  // 338); desde 768 px vuelve arriba, en la banda de la pregunta.
  const telefono = useAnchoTelefono()
  useEffect(() => {
    const conPunteroFino =
      typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (conPunteroFino) refCampo.current?.focus({ preventScroll: true })
  }, [])
  // La bóveda se abrió desde el puente de la propia búsqueda, sin salir
  // de aquí: cuenta una interacción más en la medición del recorrido.
  const [huboDesbloqueo, setHuboDesbloqueo] = useState(false)
  // El input usa `query` directo (nunca se atrasa); todo lo derivado de
  // buscar y pintar resultados usa la version diferida, para que
  // escribir se sienta instantaneo.
  const queryDiferida = useDeferredValue(query)
  const consultaCruda = queryDiferida.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0
  // CON EL PRIMER CARÁCTER (propuesta final de Claude Design, 2026-10-01)
  // la pregunta se pliega y el título baja a 14 px: el campo sube UNA sola
  // vez, en el mismo gesto, antes de que haya resultados. Después solo
  // cambia la lista, que nunca se mueve bajo el dedo. Se mira lo escrito
  // al instante, no la versión diferida, para que el pliegue no llegue
  // tarde y mueva el campo con los resultados ya a la vista.
  const escribiendo = query.trim().length > 0

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])
  // EL ALCANCE (tarea 330): chips que solo filtran la vista de lo encontrado.
  const [alcanceElegido, setAlcance] = useState<Alcance>('todo')
  const idsDeRed = useIdsDeRed()
  const conteo = useMemo(() => conteoPorAlcance(resultados, idsDeRed), [resultados, idsDeRed])
  const alcance = alcanceEfectivo(alcanceElegido, conteo)
  const visibles = useMemo(() => filtrarPorAlcance(resultados, alcance, idsDeRed), [resultados, alcance, idsDeRed])
  // Los borradores son guías: se ven en "Todo" y en "Guías".
  const conBorradores = alcance === 'todo' || alcance === 'guias'

  // ALCANCES DISTINTOS, DICHOS EN VOZ ALTA (hallazgo H09, criterio A16;
  // encargo del 2026-09-20, tarea 1). El buscador global solo indexa lo
  // PUBLICADO; un borrador que coincide se enseña aparte, siempre marcado.
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])
  const borradores = useMemo(() => articulos.filter(esBorradorVivo), [articulos])
  const nombresCategoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const borradoresQueCoinciden = useMemo(
    () =>
      sinLosYaOficiales(borradoresCoincidentes(borradores, nombresCategoriaPorId, consulta), resultados),
    [borradores, nombresCategoriaPorId, consulta, resultados],
  )
  // COINCIDENCIA FUERTE ARRIBA: un borrador que coincide EN EL TÍTULO sube
  // con los resultados, marcado; el que solo coincide por etiqueta,
  // categoría o tipo se queda en el bloque de abajo.
  const { destacados, secundarios } = useMemo(
    () => repartirBorradores(borradoresQueCoinciden),
    [borradoresQueCoinciden],
  )
  // Lo PUBLICADO manda: si ya hay una guía oficial con la consulta en el
  // título, el borrador va detrás de los resultados, no delante.
  const hayPublicadaEnTitulo = useMemo(
    () => hayGuiaPublicadaEnTitulo(resultados, consulta, normalizarTexto),
    [resultados, consulta],
  )

  // ATENCIÓN. Los mismos pendientes que cuenta el número de la pestaña,
  // repartidos con la misma función que usa `/agenda`: aquí no se vuelve a
  // decidir qué está vencido ni qué es de hoy.
  const perfil = usePerfilVivo()
  const { items: pendientes, cargando: agendaCargando } = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])

  // RECIENTES Y ACCESOS RÁPIDOS salen del registro local de este teléfono
  // (no se sincroniza) y de las guías: ningún contador nuevo.
  const visitas = useLiveQuery(() => db.recientes.toArray(), [], [])
  const progresos = useLiveQuery(() => db.progresoPasos.toArray(), [], [])
  const avances = useMemo(
    () =>
      new Map(
        articulosSinTerminar(articulos, progresos).map((s) => [
          s.articulo.id,
          { hechos: s.hechos, total: s.total, totalAbierto: s.totalAbierto },
        ]),
      ),
    [articulos, progresos],
  )
  // Las guías con preguntas (diagnósticos) entran en la misma lista (tarea
  // 263): se resuelve sin elegir antes la herramienta, y tampoco hay que
  // acordarse de cuál se usó para retomarla.
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const sesionesRecorrido = useLiveQuery(() => db.progresoDiagnostico.toArray(), [], [])
  const recorridosEnCurso = useMemo(
    () => new Map(sesionesRecorrido.map((s) => [s.diagnosticoId, s])),
    [sesionesRecorrido],
  )
  const recientes = useMemo(
    () =>
      juntarRecientes(
        guiasRecientes(visitas, articulos, categorias, avances),
        recorridosRecientes(visitas, diagnosticos, categorias, recorridosEnCurso),
      ),
    [visitas, articulos, categorias, avances, diagnosticos, recorridosEnCurso],
  )
  const accesos = useMemo(() => accesosRapidos(categorias, articulos, visitas), [categorias, articulos, visitas])

  // Bienvenida del primer día (tarea 184): se muestra mientras falte
  // alguno de sus tres pasos Y no haya todavía trabajo real. Sin valor
  // por defecto, `useLiveQuery` devuelve `undefined` hasta que resuelve:
  // es la señal de "ya sé lo que hay" que evita enseñarla un instante a
  // quien sí tiene trabajo a medias.
  const consultasListas = useLiveQuery(() => db.progresoPasos.count(), []) !== undefined
  // La guía a medias más reciente (con avance o con una pregunta en curso).
  const seguir = recientes.find((r) => r.avance !== null || r.enCurso !== null) ?? null
  const hayBloquesReales =
    pendientes.length > 0 || avances.size > 0 || recientes.some((r) => r.enCurso !== null)

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila, el primero de los
    // cuatro destinos. `conLupa={false}` (regla M-R8, "un buscador por
    // pantalla"): esta pantalla trae su propio buscador, así que la lupa
    // del chasis sería el segundo de la misma pantalla. Desde la tarea 330,
    // en el teléfono, la cabecera es de una fila (título, sincronización y
    // cuenta) y el buscador baja al dock: la pregunta "¿Qué necesitas
    // resolver?" y la línea de ayuda se retiran. Desde 768 px (tarea 338)
    // vuelven arriba, en la banda del chasis, como antes del rediseño.
    <Chasis
      titulo="Resolver"
      conLupa={false}
      tituloContraido={escribiendo}
      barra={
        telefono ? undefined : (
          <div className="px-4 pb-3.5 pt-1.5">
            {/* LA PREGUNTA, NO EL MÓDULO. El técnico no llega con ganas de
                buscar, llega con algo que resolver. La etiqueta accesible
                sigue nombrando el alcance (regla M-R8). Se pliega con el
                primer carácter (alto y opacidad, 180 ms; sin animación si
                el sistema pide menos movimiento). */}
            <div
              aria-hidden={escribiendo}
              className={`grid transition-[grid-template-rows,opacity] duration-[180ms] ease-out motion-reduce:transition-none ${
                escribiendo ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-0.5 pb-2.5 text-[22px] font-medium leading-[1.25] tracking-[-.01em] text-noct-text">
                  ¿Qué necesitas resolver?
                </p>
              </div>
            </div>
            {/* SE DESCRIBE, NO SE NOMBRA (tarea 288, fase 9): el marcador
                invita a contar lo que pasa. */}
            <CampoBusqueda
              valor={query}
              onCambiar={setQuery}
              alcance="Soluciones IT"
              textoAlternativo={MARCADOR_BUSCADOR}
              refCampo={refCampo}
              variante="destacada"
            />
            {/* Con el campo vacío, una ayuda discreta con tres maneras reales
                de escribir; se pliega con el primer carácter, igual que la
                pregunta. */}
            <div
              aria-hidden={escribiendo}
              className={`grid transition-[grid-template-rows,opacity] duration-[180ms] ease-out motion-reduce:transition-none ${
                escribiendo ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-1 pt-2 text-[12.5px] leading-snug text-noct-neutral-400">{AYUDA_BUSCADOR}</p>
              </div>
            </div>
          </div>
        )
      }
    >
      <main className="flex-1 px-4 pb-6 pt-4 md:pb-16">
        {buscando ? (
          <div className="flex flex-col gap-4">
            {resultados.length > 0 && <ChipsDeAlcance conteo={conteo} alcance={alcance} onCambiar={setAlcance} />}
            {/* La guía en borrador que coincide en el título, DELANTE de
                todo lo demás, salvo que ya haya una publicada que también
                coincida en el título: esa conserva la prioridad. */}
            {conBorradores && !hayPublicadaEnTitulo && <GuiasEnBorrador borradores={destacados} consulta={consulta} consultaCruda={consultaCruda} />}

            {resultados.length > 0 ? (
              <ResultadosBusqueda
                resultados={visibles}
                consulta={consulta}
                consultaCruda={consultaCruda}
                onDesbloqueada={() => setHuboDesbloqueo(true)}
                huboDesbloqueo={huboDesbloqueo}
              />
            ) : (
              <>
                {/* Estado vacío más útil: con la bóveda bloqueada, "no se
                    encontró nada" no es toda la verdad, porque sus accesos ni
                    siquiera se buscaron. */}
                <PuenteBoveda consulta={consultaCruda} onDesbloqueada={() => setHuboDesbloqueo(true)} />
                {borradoresQueCoinciden.length > 0 ? (
                  // NO ES "SIN COINCIDENCIAS": hay algo escrito sobre esto,
                  // solo que sin publicar.
                  <div className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4">
                    <p className="text-[14.5px] font-medium">No hay una guía publicada con esta búsqueda.</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                      Lo que hay está sin publicar y lleva su aviso.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
                    <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
                    <div>
                      <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                        Nada coincide con "{consultaCruda}" en Soluciones IT. Prueba otra palabra o revisa la
                        ortografía.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {conBorradores && hayPublicadaEnTitulo && <GuiasEnBorrador borradores={destacados} consulta={consulta} consultaCruda={consultaCruda} />}

            {/* BORRADORES COINCIDENTES: los que solo coinciden por
                etiqueta, categoría o tipo. En su propio bloque, nunca
                mezclados con los oficiales. */}
            {conBorradores && <BorradoresCoincidentes
              borradores={secundarios}
              consulta={consulta}
              consultaCruda={consultaCruda}
            />}

            {resultados.length === 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                <Link to={`/soluciones?q=${encodeURIComponent(consultaCruda)}`} className={BTN_SECUNDARIO}>
                  <MagnifyingGlass size={15} aria-hidden />
                  Buscar solo en Guías
                </Link>
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
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[22px]">
            {!agendaCargando && <BloqueAtencion agenda={agenda} />}
            {/* SEGUIR DONDE IBAS (tarea 330): la guía a medias más reciente,
                en una tarjeta con su avance. Las demás recientes siguen
                debajo, en su lista. */}
            {seguir && <BloqueSeguir guia={seguir} />}
            <BloqueRecientes recientes={recientes.filter((r) => r !== seguir)} />
            <BloqueAccesos accesos={accesos} categorias={categorias} />

            {/* Bienvenida del primer día: los tres pasos que dejan al
                técnico listo para trabajar sin señal. Va al final para no
                empujar nada, se retira sola en cuanto hay trabajo real y,
                cumplida, no vuelve. */}
            {consultasListas && (
              <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
            )}
          </div>
        )}
      </main>

      {/* EL BUSCADOR, AL PULGAR (tarea 330): el mismo de siempre, abajo,
          sobre las pestañas y, con el teclado abierto, sobre el teclado.
          El marcador sigue invitando a describir lo que pasa (tarea 288).
          Solo en el teléfono (tarea 338). */}
      {telefono && (
        <DockBusqueda>
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo={MARCADOR_BUSCADOR}
            refCampo={refCampo}
            variante="dock"
          />
        </DockBusqueda>
      )}
    </Chasis>
  )
}

// ATENCIÓN: lo que tiene fecha y hay que atender, con la misma fila que la
// agenda completa (`FilaAgenda`, que ya dice el estado con palabra y color
// y la acción con un verbo). Si no hay nada con fecha, no hay bloque: un
// "todo al día" aquí sería un adorno que empuja lo demás. Resolver es la
// única puerta de la Agenda (tarea 265): sin nada con fecha, queda una sola
// línea que la abre si guarda algo más, y nada si está vacía.
function BloqueAtencion({ agenda }: { agenda: Agenda }) {
  const { visibles, total } = asuntosDeAtencion(agenda)
  if (total === 0) return <PuertaAgendaSinFecha agenda={agenda} />
  // NECESITA ATENCIÓN (tarea 330): tres contadores (vencidos, para hoy y
  // próximos) que abren la Agenda, y debajo los asuntos con su fila. Los
  // contadores son los mismos de la Agenda (`ContadoresAgenda`, tarea 332).
  // Desde 768 px (tarea 338), los títulos de bloque vuelven al rótulo de
  // `TituloSeccion` y los enlaces, a 13 px en peso 500.
  return (
    <section aria-labelledby="resolver-atencion" className="flex flex-col gap-2.5 md:gap-1.5">
      <div className="flex items-baseline justify-between gap-2 md:items-center md:px-0.5">
        <h2 id="resolver-atencion" className="text-[17px] font-semibold tracking-[-.01em] md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500">
          Necesita atención
        </h2>
        <Link
          to="/agenda"
          // Sin origen a propósito: la Agenda ya sube a Resolver (padreDe) y
          // el origen taparía la fecha de hoy de su cabecera (tarea 265).
          aria-label={total > visibles.length ? `Ver la agenda completa (${total})` : 'Ver la agenda completa'}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300 hover:underline md:gap-1.5 md:text-[13px] md:font-medium"
        >
          Agenda
          <CaretRight size={13} aria-hidden />
        </Link>
      </div>
      <ContadoresAgenda agenda={agenda} enlace="/agenda" />
      <div className="flex flex-col">
        {visibles.map(({ item, estado }) => (
          <FilaAgenda key={item.clave} item={item} estado={estado} />
        ))}
      </div>
    </section>
  )
}

// SEGUIR DONDE IBAS (tarea 330): la guía a medias más reciente, en una
// tarjeta que se toca entera (la tarjeta queda para lo que se toca entero,
// regla del sistema visual). Dice qué es, su título entero, su avance en
// segmentos (uno por paso; con muchos pasos, una barra) y "Continuar".
function BloqueSeguir({ guia }: { guia: GuiaReciente }) {
  const conPreguntas = guia.tipo === 'diagnostico'
  const Icono = conPreguntas ? TreeStructure : BookOpen
  const avance = guia.avance
  const detalle =
    guia.enCurso ??
    (avance ? pasoDeTotal(Math.min(avance.hechos + 1, avance.total), avance.total, avance.totalAbierto ?? false) : '')
  return (
    <section aria-labelledby="resolver-seguir" className="flex flex-col gap-2.5 md:gap-1.5">
      <h2 id="resolver-seguir" className="text-[17px] font-semibold tracking-[-.01em] md:px-0.5 md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500">
        Seguir donde ibas
      </h2>
      <Link
        to={guia.ruta}
        state={ORIGEN_RESOLVER}
        aria-label={`Continuar ${guia.titulo}${guia.borrador ? ' (borrador)' : ''}`}
        // Desde 768 px (tarea 338), tarjeta del lenguaje de antes del
        // rediseño móvil: radio de 8 px y borde divisor que se aclara al
        // pasar el puntero; el avance, en la barra fina de acento de la
        // guía a medias de entonces (`BarraReanudar`).
        className="flex flex-col gap-2.5 rounded-2xl border border-noct-text/25 bg-noct-surface p-3.5 text-noct-text hover:bg-noct-text/[.04] md:rounded-lg md:border-noct-divider md:hover:border-noct-neutral-600"
      >
        <span className="flex items-center gap-2 text-[12.5px] text-noct-neutral-400">
          <Icono size={14} className="shrink-0" aria-hidden />
          <span className="min-w-0 truncate">
            {conPreguntas ? ROTULO_RECORRIDO : ['Guía', guia.categoriaNombre].filter(Boolean).join(' · ')}
            {guia.borrador ? ' · Borrador' : ''}
          </span>
        </span>
        <span data-nombre-principal className="text-[16px] font-semibold leading-[1.3] text-pretty [overflow-wrap:anywhere] md:text-[15px] md:font-medium">
          {guia.titulo}
        </span>
        {avance && avance.total > 0 && (
          <span aria-hidden className="flex gap-1">
            {avance.total <= 12 ? (
              Array.from({ length: avance.total }, (_, i) => (
                <span
                  key={i}
                  className={`h-[5px] min-w-0 flex-1 rounded-[3px] md:h-[3px] md:rounded-full ${
                    i < avance.hechos
                      ? 'bg-noct-accent'
                      : i === avance.hechos
                        ? 'bg-noct-text md:bg-noct-accent/[.18]'
                        : 'bg-noct-neutral-700 md:bg-noct-accent/[.18]'
                  }`}
                />
              ))
            ) : (
              <span className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-noct-neutral-700 md:h-[3px] md:rounded-full md:bg-noct-accent/[.18]">
                <span className="block h-full bg-noct-accent" style={{ width: `${Math.round((avance.hechos / avance.total) * 100)}%` }} />
              </span>
            )}
          </span>
        )}
        {/* Desde 768 px, el avance y "Continuar" como los decía la fila
            de la guía a medias en Recientes antes del rediseño móvil (tarea
            338): el paso en acento y "Continuar" con forma de botón. */}
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[13.5px] text-noct-neutral-300 md:text-[12.5px] md:leading-[1.4] md:text-noct-accent-300">{detalle}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-noct-accent-300 md:h-9 md:rounded-lg md:border md:border-noct-accent md:px-3 md:text-[13px] md:font-medium">
            Continuar
            <ArrowRight size={15} className="md:hidden" aria-hidden />
          </span>
        </span>
      </Link>
    </section>
  )
}

// La actividad del equipo solo se consulta aquí, cuando no hay nada con
// fecha: con Atención a la vista, la agenda ya tiene su puerta.
//
// Una línea de índice, no un botón (propuesta final de Claude Design,
// 2026-10-01): "Agenda" en claro, lo que está en curso en gris y en acento
// solo lo que pide una acción ("2 por revisar").
function PuertaAgendaSinFecha({ agenda }: { agenda: Agenda }) {
  const hayActividad = useLiveQuery(async () => (await obtenerActividadReciente(1)).length > 0, [], false)
  const partes = partesPuertaAgenda(agenda, hayActividad)
  if (!partes) return null
  return (
    <Link
      to="/agenda"
      className="inline-flex min-h-11 items-center gap-[7px] self-start px-0.5 text-[13.5px] hover:underline"
    >
      <ClockCountdown size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium text-noct-neutral-200">Agenda</span>
        {partes.map((parte) => (
          <Fragment key={parte.texto}>
            <span className="text-noct-neutral-400"> · </span>
            <span className={parte.pideAccion ? 'font-medium text-noct-accent-300' : 'text-noct-neutral-400'}>
              {parte.texto}
            </span>
          </Fragment>
        ))}
      </span>
      <CaretRight size={12} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}

// RECIENTES: las guías que este técnico usó en los últimos días, con pasos
// o con preguntas. La que está a medias lo dice y se continúa donde iba
// (abrir una guía ya la lleva al primer paso pendiente, AD-040; una guía
// con preguntas, a la pregunta o al procedimiento en que quedó).
function BloqueRecientes({ recientes }: { recientes: GuiaReciente[] }) {
  if (recientes.length === 0) return null
  return (
    <section aria-labelledby="resolver-recientes">
      <h2 id="resolver-recientes" className="mb-1 text-[17px] font-semibold tracking-[-.01em] md:mb-1.5 md:px-0.5 md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500">
        Recientes
      </h2>
      <div className="flex flex-col">
        {recientes.map((guia) => (
          <FilaReciente key={`${guia.tipo}:${guia.id}`} guia={guia} />
        ))}
      </div>
    </section>
  )
}

// LA FILA DE RECIENTES (propuesta final de Claude Design, 2026-10-01). El
// título manda, entero. La guía a medias es la que se retoma:
// su avance va en acento ("paso 3 de 8") y lleva "Continuar" con forma de
// botón; las demás no repiten "Abrir" (toda la fila se abre). El icono
// dice qué clase de guía es: con pasos o con preguntas.
function FilaReciente({ guia }: { guia: GuiaReciente }) {
  const conPreguntas = guia.tipo === 'diagnostico'
  const aMedias = guia.avance !== null || guia.enCurso !== null
  const accion = aMedias ? 'Continuar' : 'Abrir'
  const cuando = tiempoRelativo(guia.visitadoEn)
  // Una guía con preguntas dice que lo es en vez de la categoría: es lo
  // que la distingue en la lista, y así la línea cabe a 360 px.
  const detalle =
    guia.enCurso ??
    (guia.avance
      ? pasoDeTotal(
          Math.min(guia.avance.hechos + 1, guia.avance.total),
          guia.avance.total,
          guia.avance.totalAbierto ?? false,
        )
      : [conPreguntas ? ROTULO_RECORRIDO : guia.categoriaNombre, cuando].filter(Boolean).join(' · '))
  const Icono = conPreguntas ? TreeStructure : BookOpen
  return (
    <Link
      to={guia.ruta}
      state={ORIGEN_RESOLVER}
      aria-label={`${accion} ${guia.titulo}${guia.borrador ? ' (borrador)' : ''}`}
      className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-[9px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-accent/[.12] text-noct-accent-300">
        <Icono size={17} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* EL TÍTULO ENTERO, NO CORTADO (tarea 263, y sin el tope de
            dos líneas desde la regla 23): a 360 px el título de una guía
            se quedaba en "La impresora de ejemplo...", y con dos líneas
            seguía perdiendo el final, que suele ser lo que la distingue. */}
        <span
          data-nombre-principal
          className="min-w-0 text-[15px] font-medium leading-[1.3] [overflow-wrap:anywhere] text-pretty"
        >
          {guia.titulo}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[12.5px] leading-[1.4] text-noct-neutral-400">
          {guia.borrador && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <PencilSimple size={11} aria-hidden />
              Borrador ·
            </span>
          )}
          <span className={`min-w-0 ${aMedias ? 'text-noct-accent-300' : ''}`}>{detalle}</span>
        </span>
      </span>
      {aMedias && (
        <span
          aria-hidden
          className="flex h-9 shrink-0 items-center rounded-lg border border-noct-accent px-3 text-[13px] font-medium text-noct-accent-300"
        >
          Continuar
        </span>
      )}
    </Link>
  )
}

// ACCESOS RÁPIDOS: cada categoría con guías lleva a la lista filtrada por
// ella (la categoría es un FILTRO de la lista, decisión del 2026-07-18).
// "Todas las guías" está SIEMPRE, con o sin accesos: es la única puerta
// al catálogo desde que Guías dejó de ser pestaña.
function BloqueAccesos({
  accesos,
  categorias,
}: {
  accesos: AccesoRapido[]
  categorias: { id: string; nombre: string; color: string | null; orden: number }[]
}) {
  const porId = new Map(categorias.map((c) => [c.id, c]))
  // GUÍAS (tarea 330): el catálogo por categoría, con cuántas guías tiene
  // cada una, y "Todas" a la derecha del título. "Todas las guías" está
  // SIEMPRE: es la única puerta al catálogo desde que Guías dejó de ser
  // pestaña.
  return (
    <section aria-labelledby="resolver-accesos" className="flex flex-col gap-2.5 md:gap-2">
      <div className="flex items-baseline justify-between gap-2 md:items-center md:px-0.5">
        <h2 id="resolver-accesos" className="text-[17px] font-semibold tracking-[-.01em] md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500">
          Guías
        </h2>
        <Link
          to="/soluciones"
          state={ORIGEN_RESOLVER}
          aria-label="Todas las guías"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300 hover:underline md:gap-1.5 md:text-[13.5px] md:font-medium"
        >
          Todas
          <CaretRight size={13} aria-hidden />
        </Link>
      </div>
      {accesos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accesos.map((acceso) => {
            const categoria = porId.get(acceso.categoriaId)
            const Icono = iconoDeCategoria(acceso.nombre)
            return (
              <Link
                key={acceso.categoriaId}
                to={`/soluciones?categoria=${encodeURIComponent(acceso.categoriaId)}`}
                state={ORIGEN_RESOLVER}
                aria-label={`${acceso.nombre}: ${acceso.guias} ${acceso.guias === 1 ? 'guía' : 'guías'}`}
                // Desde 768 px, la píldora de los accesos rápidos de antes
                // del rediseño móvil (tarea 338).
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-noct-text/25 px-3.5 text-[14.5px] font-[550] text-noct-text hover:bg-noct-text/[.05] md:rounded-full md:border-noct-divider md:bg-noct-surface md:text-[14px] md:font-medium md:hover:border-noct-neutral-600 md:hover:bg-noct-text/[.04]"
              >
                {/* El icono de su categoría, en su color, solo desde 768 px:
                    la píldora de antes del rediseño móvil lo llevaba (tarea 338). */}
                <Icono
                  size={16}
                  className={`hidden shrink-0 md:block ${categoria ? claseTextoDeCategoria(categoria) : 'text-noct-neutral-400'}`}
                  aria-hidden
                />
                {acceso.nombre}
                <span className="font-mono text-[12.5px] text-noct-neutral-500">{acceso.guias}</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
