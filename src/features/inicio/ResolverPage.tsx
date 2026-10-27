import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { tiempoRelativo } from '../../lib/tiempoRelativo'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
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
import { ANCHO_TABLETA, coincide, useEsAncho } from '../../components/useEsAncho'
import { NadaCoincide, PuedesEscribir } from '../busqueda/EstadosBusquedaMovil'
import { buscar, sugerirConsulta, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { PuenteBoveda } from '../busqueda/PuenteBoveda'
import { alcanceEfectivo, conteoPorAlcance, filtrarPorAlcance, type Alcance } from '../busqueda/alcanceBusqueda'
import { ChipsDeAlcance } from '../busqueda/ChipsDeAlcance'
import { useIdsDeRed } from '../busqueda/useIdsDeRed'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { BorradoresCoincidentes, GuiasEnBorrador } from '../busqueda/BorradoresCoincidentes'
import {
  ANCHO_MARCADOR_COMPLETO,
  ANCHO_MARCADOR_CON_ESCANER,
  MARCADOR_BUSCADOR,
  MARCADOR_BUSCADOR_ESTRECHO,
  MARCADOR_BUSCADOR_TELEFONO,
} from '../busqueda/resultados'
import {
  borradoresCoincidentes,
  esBorradorVivo,
  hayGuiaPublicadaEnTitulo,
  repartirBorradores,
  sinLosYaOficiales,
} from '../busqueda/borradoresEnBusqueda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { articulosSinTerminar, pasoDeTotal, ventanaDeTotal } from '../soluciones/sinTerminar'
import { IconoCategoria } from '../../components/IconoCategoria'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { RELIEVE_BORDE, TARJETA_TOCABLE, TITULO_GRUPO, TITULO_SECCION } from '../../components/ventana/estilos'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { obtenerActividadReciente } from '../historial/actividadEquipo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import { agruparAgenda, type Agenda } from './agenda'
import {
  accesosRapidos,
  asuntosDeAtencion,
  ATENCION_VISIBLES,
  esGuiaPublicadaEjecutable,
  guiasRecientes,
  juntarRecientes,
  partesPuertaAgenda,
  recorridosRecientes,
  textoSinUrgencias,
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
  useEffect(() => {
    const conPunteroFino =
      typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    // Solo desde 768: en el teléfono enfocar el campo abre su búsqueda
    // (tarea 344), y una ventana estrecha con ratón llegaría a ella sin
    // haber tocado nada.
    if (conPunteroFino && coincide(ANCHO_TABLETA)) refCampo.current?.focus({ preventScroll: true })
  }, [])
  // EN EL TELÉFONO, BUSCAR ES SU PROPIA PANTALLA (rediseño móvil, fase 1,
  // tarea 344; DESPUÉS de Claude Design). El campo está ARRIBA, bajo el
  // título, y es un campo de verdad: tocarlo abre el teclado en el mismo
  // gesto. Al enfocarlo, Resolver se convierte en la búsqueda: el regreso a
  // la izquierda, el campo arriba y, debajo, qué escribir o lo encontrado.
  // Se sale con el regreso, que borra lo escrito; perder el foco no saca de
  // ella (desplazar los resultados cierra el teclado, no la búsqueda). Es
  // el mismo campo en las dos formas: no se desmonta, así que el foco y el
  // teclado no se pierden al cambiar. Desde 768, todo como estaba.
  const ancho = useEsAncho()
  const marcadorCompleto = useEsAncho(ANCHO_MARCADOR_COMPLETO)
  const marcadorCompletoConEscaner = useEsAncho(ANCHO_MARCADOR_CON_ESCANER)
  const [abiertaEnTelefono, setAbiertaEnTelefono] = useState(false)
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
  const busquedaEnTelefono = !ancho && (abiertaEnTelefono || escribiendo)
  function salirDeLaBusqueda() {
    setQuery('')
    setAbiertaEnTelefono(false)
    refCampo.current?.blur()
  }
  // Desplazar lo encontrado con el dedo cierra el teclado: se está mirando,
  // no escribiendo (lo mismo que hacía el dock).
  useEffect(() => {
    if (!busquedaEnTelefono) return
    function alArrastrar(evento: TouchEvent) {
      const campo = refCampo.current
      if (!campo || document.activeElement !== campo) return
      // Arrastrar sobre el propio campo no cuenta: es el que se usa.
      if (evento.target instanceof Node && campo.closest('label')?.contains(evento.target)) return
      campo.blur()
    }
    window.addEventListener('touchmove', alArrastrar, { passive: true })
    return () => window.removeEventListener('touchmove', alArrastrar)
  }, [busquedaEnTelefono])

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])
  // "Quizás buscabas…" (tarea 346): una propuesta que solo se busca si se
  // toca. Lo escrito no cambia solo.
  const sugerencia = useMemo(() => sugerirConsulta(indice, queryDiferida, resultados), [indice, queryDiferida, resultados])
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
          { hechos: s.hechos, total: s.total, totalAbierto: s.totalAbierto, siguiente: s.siguiente },
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
  const otrasRecientes = recientes.filter((r) => r !== seguir)
  const hayBloquesReales =
    pendientes.length > 0 || avances.size > 0 || recientes.some((r) => r.enCurso !== null)

  // Cuántas guías se pueden ejecutar: "Ver todas las guías (N)" en el teléfono.
  const totalGuias = useMemo(() => articulos.filter(esGuiaPublicadaEjecutable).length, [articulos])

  // Las salidas cuando nada coincide, las mismas en todos los anchos.
  const salidasSinResultados = (
    <>
      <Link to={`/soluciones?q=${encodeURIComponent(consultaCruda)}`} className={BTN_SECUNDARIO}>
        <MagnifyingGlass size={15} aria-hidden />
        Buscar solo en Guías
      </Link>
      <Link to={`/dispositivos/nuevo?nombre=${encodeURIComponent(consultaCruda)}`} className={BTN_SECUNDARIO}>
        <Plus size={15} aria-hidden />
        Crear equipo
      </Link>
      <button type="button" onClick={() => setQuery('')} className={BTN_SECUNDARIO}>
        Limpiar búsqueda
      </button>
    </>
  )
  // NADA COINCIDE, COMPACTO EN EL TELÉFONO (tarea 344): el mismo estado que
  // la capa del buscador global, con las salidas dentro. Si hay borradores
  // que coinciden no es "nada coincide": se queda el aviso de siempre.
  const nadaCoincideEnTelefono = !ancho && borradoresQueCoinciden.length === 0

  // LO ENCONTRADO: la misma lista en todos los anchos; solo cambia, en el
  // teléfono, cómo se dice que nada coincide.
  const encontrado = (
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
          sugerencia={sugerencia}
          onUsarSugerencia={setQuery}
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
          ) : nadaCoincideEnTelefono ? (
            <NadaCoincide consulta={consultaCruda}>{salidasSinResultados}</NadaCoincide>
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

      {resultados.length === 0 && !nadaCoincideEnTelefono && (
        <div className="flex flex-wrap justify-center gap-2">{salidasSinResultados}</div>
      )}
    </div>
  )

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila, el primero de los
    // cuatro destinos. `conLupa={false}` (regla M-R8, "un buscador por
    // pantalla"): esta pantalla trae su propio buscador, así que la lupa
    // del chasis sería el segundo de la misma pantalla.
    //
    // EL BUSCADOR, EN LA BARRA DESDE 768 PX (tarea 339): el mismo de
    // siempre, montado por el chasis junto al título. EN EL TELÉFONO, ARRIBA
    // (tarea 344, DESPUÉS de Claude Design; antes, en el dock al pulgar de la
    // tarea 330): lo monta esta pantalla bajo el título, y mientras busca la
    // barra superior se retira para que la búsqueda tenga su regreso y su
    // campo arriba. Un solo campo vivo en cada ancho (regla M-R8).
    <Chasis
      titulo="Resolver"
      conLupa={false}
      // EN EL TELÉFONO, LA PREGUNTA MANDA (tarea 346): "Resolver" queda
      // pequeño en la barra (como al escribir) y lo grande es "¿Qué necesitas
      // resolver?", justo sobre el campo. Desde 768 la barra no cambia.
      tituloContraido={escribiendo || !ancho}
      sinCabeceraEnTelefono={busquedaEnTelefono}
      // Y sin la barra de pestañas (tarea 351), como la pantalla «Buscar» del
      // prototipo: lo encontrado gana su alto; se sale con la flecha.
      sinPestanasEnTelefono={busquedaEnTelefono}
      // LA CABECERA DE INICIO DEL PROTOTIPO (tarea 350): en el teléfono, la
      // marca «Soluciones IT», el estado rotulado («Al día») y la cuenta. El
      // escáner, que la tarea 344 dejó en esta fila, pasa al final del campo
      // (como desde 768): sigue a un toque y la fila cabe a 360 px.
      marcaEnTelefono
      buscador={
        ancho ? (
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo={MARCADOR_BUSCADOR}
            refCampo={refCampo}
            variante="dock"
          />
        ) : undefined
      }
    >
      {ancho ? (
        <main className="@container flex-1 px-4 pb-6 pt-4">
          {buscando ? (
            encontrado
          ) : (
            // TRES ZONAS CON IDENTIDAD FIJA (tarea 339, T3; handoff de tableta y
            // escritorio): A, lo que urge (Necesita atención); B, mi trabajo
            // (Seguir donde ibas y Recientes); C, el catálogo (Guías). El orden
            // de lectura no cambia nunca; el ancho del contenedor decide cuántas
            // caben lado a lado. Por debajo de 880 px, una columna (tableta
            // vertical); desde 880, A | B y C debajo, de lado a lado tras una
            // línea (tableta horizontal y escritorio). Desde 1100 de contenido
            // (1680, T10), las tres lado a lado, con C como un índice vertical
            // de 252. Sin bloques nuevos.
            <div className="flex flex-col gap-[22px] md:gap-[30px] @[880px]:grid @[880px]:grid-cols-2 @[880px]:items-start @[880px]:gap-x-10 @[1100px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_252px] @[1100px]:gap-x-11">
              {!agendaCargando && <BloqueAtencion agenda={agenda} />}
              {(seguir || otrasRecientes.length > 0) && (
                <div className="flex flex-col gap-[22px] md:gap-[26px]">
                  {/* SEGUIR DONDE IBAS (tarea 330): la guía a medias más
                      reciente, en una tarjeta con su avance. Las demás
                      recientes siguen debajo, en su lista. */}
                  {seguir && <BloqueSeguir guia={seguir} />}
                  <BloqueRecientes recientes={otrasRecientes} />
                </div>
              )}
              <div className="@[880px]:col-span-2 @[880px]:border-t @[880px]:border-noct-divider @[880px]:pt-5 @[1100px]:col-span-1 @[1100px]:border-t-0 @[1100px]:pt-0">
                <BloqueAccesos accesos={accesos} />
              </div>

              {/* Bienvenida del primer día: los tres pasos que dejan al
                  técnico listo para trabajar sin señal. Va al final para no
                  empujar nada, se retira sola en cuanto hay trabajo real y,
                  cumplida, no vuelve. */}
              {consultasListas && (
                <div className="empty:hidden @[880px]:col-span-2 @[1100px]:col-span-3">
                  <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
                </div>
              )}
            </div>
          )}
        </main>
      ) : (
        // RESOLVER EN EL TELÉFONO (tarea 344, DESPUÉS de Claude Design). Al
        // abrir: el campo arriba con ejemplos, la guía a
        // medias, el trabajo de hoy dicho en palabras y "¿Qué está fallando?"
        // con las categorías reales. Buscando: el regreso, el campo y lo
        // encontrado. El campo es el MISMO elemento en las dos formas (mismo
        // sitio del árbol): cambiar de forma no le quita el foco.
        <main className="flex-1 px-4 pb-6">
          {!busquedaEnTelefono && (
            // 28 · 800 del prototipo (tarea 350): la pregunta es lo que manda.
            <h2
              id="resolver-pregunta"
              className="pt-5 text-[28px] font-extrabold leading-[34px] tracking-[-.02em] text-pretty"
            >
              ¿Qué necesitas resolver?
            </h2>
          )}
          <div
            data-buscador-resolver
            className={
              busquedaEnTelefono
                ? 'sticky top-0 z-20 -mx-4 flex items-center gap-1.5 bg-noct-bg py-2.5 pl-3 pr-3'
                : 'pt-3'
            }
          >
            {busquedaEnTelefono && (
              <button
                type="button"
                onClick={salirDeLaBusqueda}
                aria-label="Volver a Resolver"
                title="Volver a Resolver"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-noct-text active:bg-noct-presionado"
              >
                <IconoVentana nombre="atras" tam={24} grosor={2.4} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <CampoBusqueda
                valor={query}
                onCambiar={setQuery}
                alcance="Soluciones IT"
                textoAlternativo={
                  (busquedaEnTelefono ? marcadorCompleto : marcadorCompletoConEscaner)
                    ? MARCADOR_BUSCADOR_TELEFONO
                    : MARCADOR_BUSCADOR_ESTRECHO
                }
                refCampo={refCampo}
                variante="resolver"
                abierta={busquedaEnTelefono}
                onEnfocar={() => setAbiertaEnTelefono(true)}
                // El escáner solo en Inicio: abierta la búsqueda, el campo es
                // para escribir y el prototipo no lo lleva.
                accesorio={busquedaEnTelefono ? undefined : <EscanerEnCampoTelefono />}
              />
            </div>
          </div>
          {busquedaEnTelefono ? (
            <div className="pt-1.5">
              {/* Sin la barra superior, el nombre de la pantalla para el lector. */}
              <h1 className="sr-only">Buscar en Soluciones IT</h1>
              {buscando ? (
                encontrado
              ) : (
                // SIN NADA ESCRITO (prototipo, tarea 350): primero lo que este
                // técnico abrió hace poco, a un toque. Qué se puede escribir,
                // con sus ejemplos, solo cuando no hay nada reciente (tarea
                // 358, D2): el primer uso o un registro vacío; quien abre la
                // app a diario ya sabe qué escribir.
                <div className="flex flex-col gap-[18px] pt-1">
                  <AbiertasHacePoco recientes={recientes} />
                  {recientes.length === 0 && <PuedesEscribir onElegir={setQuery} />}
                </div>
              )}
            </div>
          ) : (
            // INICIO EN EL TELÉFONO, COMO EL PROTOTIPO (tarea 350). Bajo la
            // pregunta y el campo, a 22 px, la guía a medias en su tarjeta, las
            // categorías en mosaico y el trabajo de hoy. Lo reciente se abre
            // desde el campo («Abiertas hace poco»), donde el prototipo lo pone:
            // tocarlo ya es buscar. Sin «Prueba con» (tarea 358, D1): empujaba
            // las categorías entre 92 y 136 px y repetía los ejemplos que la
            // búsqueda abierta ya ofrece cuando hacen falta.
            <>
              <div className="flex flex-col gap-[22px] pt-[22px]">
                {seguir && <SeguirEnTelefono guia={seguir} />}
                <CategoriasEnTelefono accesos={accesos} totalGuias={totalGuias} />
                {!agendaCargando && <TrabajoDeHoy agenda={agenda} total={pendientes.length} />}
                {consultasListas && (
                  <div className="empty:hidden">
                    <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
                  </div>
                )}
              </div>
            </>
          )}
        </main>
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
  return (
    <section aria-labelledby="resolver-atencion" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="resolver-atencion" className="text-[17px] font-semibold tracking-[-.01em]">
          Necesita atención
        </h2>
        <Link
          to="/agenda"
          // Sin origen a propósito: la Agenda ya sube a Resolver (padreDe) y
          // el origen taparía la fecha de hoy de su cabecera (tarea 265).
          aria-label={total > visibles.length ? `Ver la agenda completa (${total})` : 'Ver la agenda completa'}
          // 44 de alto mientras sea táctil; con puntero (desde 1280) no
          // descuadra la cabecera de la zona de al lado.
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300 hover:underline xl:min-h-0"
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
    <section aria-labelledby="resolver-seguir" className="flex flex-col gap-2.5">
      {/* Lado a lado con "Necesita atención" (desde 880 px), su cabecera mide
          lo mismo que la de al lado, que lleva el enlace a la Agenda. */}
      <h2
        id="resolver-seguir"
        className="text-[17px] font-semibold tracking-[-.01em] @[880px]:flex @[880px]:items-center lg:min-h-11 xl:min-h-0"
      >
        Seguir donde ibas
      </h2>
      <Link
        to={guia.ruta}
        state={ORIGEN_RESOLVER}
        aria-label={`Continuar ${guia.titulo}${guia.borrador ? ' (borrador)' : ''}`}
        className="flex flex-col gap-2.5 rounded-2xl border border-noct-text/25 bg-noct-surface p-3.5 text-noct-text shadow-[var(--shadow-noct-elevacion)] hover:bg-noct-text/[.04] max-md:active:bg-noct-presionado"
      >
        <span className="flex items-center gap-2 text-[12.5px] text-noct-neutral-400">
          <Icono size={14} className="shrink-0" aria-hidden />
          <span className="min-w-0 truncate">
            {conPreguntas ? ROTULO_RECORRIDO : ['Guía', guia.categoriaNombre].filter(Boolean).join(' · ')}
            {guia.borrador ? ' · Borrador' : ''}
          </span>
        </span>
        <span data-nombre-principal className="text-[16px] font-semibold leading-[1.3] text-pretty [overflow-wrap:anywhere]">
          {guia.titulo}
        </span>
        {avance && <SegmentosAvance avance={avance} />}
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[13.5px] text-noct-neutral-300">{detalle}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-noct-accent-300">
            Continuar
            <ArrowRight size={15} aria-hidden />
          </span>
        </span>
      </Link>
    </section>
  )
}

// El avance de una guía a medias: un segmento por paso (hechos en acento,
// el actual en claro) y, con muchos pasos, una barra. Lo comparten la
// tarjeta de tableta y escritorio y la del teléfono.
//
// En el teléfono (tarea 350), con los colores del prototipo: lo hecho en el
// verde que comprueba, la ventana actual en el acento y lo que falta en el
// color del borde, con 3 px entre segmentos.
function SegmentosAvance({
  avance,
  telefono = false,
}: {
  avance: NonNullable<GuiaReciente['avance']>
  telefono?: boolean
}) {
  if (avance.total <= 0) return null
  const hecho = telefono ? 'bg-noct-exito' : 'bg-noct-accent'
  const actual = telefono ? 'bg-noct-accent' : 'bg-noct-text'
  const falta = telefono ? 'bg-noct-divider' : 'bg-noct-neutral-700'
  return (
    <span aria-hidden className={`flex ${telefono ? 'gap-[3px]' : 'gap-1'}`}>
      {avance.total <= 12 ? (
        Array.from({ length: avance.total }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] min-w-0 flex-1 rounded-[3px] ${
              i < avance.hechos ? hecho : i === avance.hechos ? actual : falta
            }`}
          />
        ))
      ) : (
        <span className={`h-[5px] flex-1 overflow-hidden rounded-[3px] ${falta}`}>
          <span className={`block h-full ${hecho}`} style={{ width: `${Math.round((avance.hechos / avance.total) * 100)}%` }} />
        </span>
      )}
    </span>
  )
}

// SIGUE DONDE IBAS, EN EL TELÉFONO (tarea 344; tarjeta del prototipo de
// Claude Design desde la tarea 350). Solo existe si hay una guía a medias: el
// icono de su categoría, su título entero, en qué ventana va, el avance en
// segmentos y el botón redondo que la retoma. Toda la tarjeta se toca; el
// botón relleno es la única acción rellena de Inicio (regla 30): retomar lo
// que se dejó a medias es lo que hace avanzar. El nombre accesible dice a
// dónde lleva ("Continuar en la ventana 2: …").
function SeguirEnTelefono({ guia }: { guia: GuiaReciente }) {
  const avance = guia.avance
  // LA VENTANA EN LA QUE SE VA, CON SU NOMBRE (tarea 351, como el prototipo:
  // «Ventana 4 · Comprobar la sincronización inicial»): se reconoce dónde se
  // dejó sin abrir la guía. Cuántas faltan lo dicen los segmentos de debajo.
  // Si no se sabe cuál es, «Ventana 2 de 3», como antes.
  const siguiente = avance?.siguiente ?? null
  const numero = siguiente ? siguiente.numero : avance ? Math.min(avance.hechos + 1, avance.total) : null
  const donde =
    guia.enCurso ??
    (siguiente
      ? `Ventana ${siguiente.numero} · ${siguiente.titulo}`
      : avance && numero !== null
        ? ventanaDeTotal(numero, avance.total, avance.totalAbierto ?? false)
        : '')
  const verbo = guia.enCurso === null && numero !== null ? `Continuar en la ventana ${numero}` : 'Continuar'
  return (
    <section aria-labelledby="resolver-seguir-telefono" className="flex flex-col gap-2.5">
      <h2 id="resolver-seguir-telefono" className={TITULO_SECCION}>
        Sigue donde ibas
      </h2>
      <Link
        to={guia.ruta}
        state={ORIGEN_RESOLVER}
        data-seguir-donde-ibas
        aria-label={`${verbo}: ${guia.titulo}${guia.borrador ? ' (borrador)' : ''}`}
        className={`${TARJETA_TOCABLE} ${RELIEVE_BORDE} flex min-w-0 items-center gap-3 rounded-[20px] p-3.5`}
      >
        <IconoCategoria nombre={guia.categoriaNombre} tam={44} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            data-nombre-principal
            className="min-w-0 text-[16px] font-bold leading-[21px] text-pretty [overflow-wrap:anywhere]"
          >
            {guia.titulo}
          </span>
          {(donde || guia.borrador) && (
            <span className="text-[14px] font-medium leading-snug text-noct-neutral-300">
              {[donde, guia.borrador ? 'Borrador' : ''].filter(Boolean).join(' · ')}
            </span>
          )}
          {/* EL AVANCE A LA VISTA (tarea 349): un segmento por ventana, para
              saber de un vistazo cuánto falta sin abrir la guía. */}
          {avance && (
            <span data-avance-seguir className="block pt-1">
              <SegmentosAvance avance={avance} telefono />
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-noct-accent text-noct-on-accent shadow-[0_3px_0_var(--color-noct-accent-borde)]"
        >
          <IconoVentana nombre="flecha" grosor={2.6} />
        </span>
      </Link>
    </section>
  )
}

// ABIERTAS HACE POCO, EN LA BÚSQUEDA DEL TELÉFONO (tarea 350, prototipo de
// Claude Design). Lo que antes era «Recientes» al final de Inicio: las guías
// que este técnico usó en los últimos días, cada una en su tarjeta con el
// icono de su categoría. Se ven al tocar el campo, antes de escribir, que es
// donde se busca lo que ya se abrió una vez. La que está a medias dice en qué
// ventana va.
function AbiertasHacePoco({ recientes }: { recientes: GuiaReciente[] }) {
  if (recientes.length === 0) return null
  return (
    <section aria-labelledby="busqueda-abiertas" className="flex flex-col gap-2.5">
      <h2 id="busqueda-abiertas" className={TITULO_GRUPO}>
        Abiertas hace poco
      </h2>
      {recientes.map((guia) => {
        const avance = guia.avance
        const aMedias = avance !== null || guia.enCurso !== null
        const donde =
          guia.enCurso ??
          (avance
            ? ventanaDeTotal(Math.min(avance.hechos + 1, avance.total), avance.total, avance.totalAbierto ?? false)
            : null)
        return (
          <Link
            key={`${guia.tipo}:${guia.id}`}
            to={guia.ruta}
            state={ORIGEN_RESOLVER}
            data-abierta-hace-poco
            aria-label={`${aMedias ? 'Continuar' : 'Abrir'} ${guia.titulo}${guia.borrador ? ' (borrador)' : ''}`}
            className={`${TARJETA_TOCABLE} flex items-center gap-3 p-3`}
          >
            <IconoCategoria nombre={guia.categoriaNombre} tam={40} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                data-nombre-principal
                className="min-w-0 text-[16px] font-bold leading-[21px] text-pretty [overflow-wrap:anywhere]"
              >
                {guia.titulo}
              </span>
              {(donde || guia.borrador) && (
                <span className={`text-[14px] font-semibold ${donde ? 'text-noct-accent-300' : 'text-noct-neutral-300'}`}>
                  {[guia.borrador ? 'Borrador' : '', donde ?? ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
          </Link>
        )
      })}
    </section>
  )
}

// TU TRABAJO DE HOY, EN EL TELÉFONO (tarea 344; en segundo plano desde la
// tarea 346; la tarjeta punteada del prototipo desde la tarea 350). Una puerta
// a la Agenda que dice, con palabras y su color, lo que urge: «2 atrasados ·
// 1 para hoy», o que no hay nada atrasado. Si hay algo atrasado o para hoy,
// sus filas siguen a la vista dentro de la misma tarjeta (con la fila de la
// Agenda, que dice el estado con palabra y la acción con su verbo): atender
// lo urgente no cuesta un toque más que antes.
function TrabajoDeHoy({ agenda, total }: { agenda: Agenda; total: number }) {
  const urgentes = [
    ...agenda.vencidos.map((item) => ({ item, estado: 'vencido' as const })),
    ...agenda.hoy.map((item) => ({ item, estado: 'hoy' as const })),
  ]
  const visibles = urgentes.slice(0, ATENCION_VISIBLES)
  const atrasados = agenda.vencidos.length
  const paraHoy = agenda.hoy.length
  return (
    <section
      aria-labelledby="resolver-hoy"
      data-trabajo-de-hoy
      className="flex flex-col rounded-2xl border-[1.5px] border-dashed border-noct-divider-fuerte"
    >
      <Link
        to="/agenda"
        // Sin origen a propósito: la Agenda ya sube a Resolver (padreDe).
        aria-label={total > 0 ? `Abrir la Agenda: ${total} ${total === 1 ? 'asunto' : 'asuntos'}` : 'Abrir la Agenda'}
        className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-noct-text active:bg-noct-presionado"
      >
        <IconoVentana nombre="calendario" tam={22} grosor={2} className="shrink-0 text-noct-neutral-300" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="resolver-hoy" className="text-[15px] font-bold leading-snug">
            Tu trabajo de hoy
          </h2>
          <span className="text-[14px] leading-snug text-noct-neutral-300">
            {atrasados === 0 && paraHoy === 0 ? (
              textoSinUrgencias(agenda)
            ) : (
              <>
                {atrasados > 0 && (
                  <span className="font-semibold text-noct-error">
                    {atrasados} {atrasados === 1 ? 'atrasado' : 'atrasados'}
                  </span>
                )}
                {atrasados > 0 && paraHoy > 0 && ' · '}
                {paraHoy > 0 && <span className="font-semibold text-noct-precaucion">{paraHoy} para hoy</span>}
                {total > atrasados + paraHoy && ` · Agenda (${total})`}
              </>
            )}
          </span>
        </div>
        <IconoVentana nombre="adelante" tam={18} className="shrink-0 text-noct-neutral-400" />
      </Link>
      {visibles.length > 0 && (
        <div className="flex flex-col border-t border-dashed border-noct-divider-fuerte px-3 [&>a:last-child]:border-b-0">
          {visibles.map(({ item, estado }) => (
            <FilaAgenda key={item.clave} item={item} estado={estado} />
          ))}
        </div>
      )}
      {urgentes.length > visibles.length && (
        <p className="px-3 pb-2.5 text-[14px] text-noct-neutral-400">
          Y {urgentes.length - visibles.length} más para hoy o atrasados en la Agenda.
        </p>
      )}
    </section>
  )
}

// LAS GUÍAS POR CATEGORÍA, EN EL TELÉFONO (tarea 344 como "¿Qué está
// fallando?"; accesos de una línea desde la tarea 346; el mosaico del
// prototipo de Claude Design desde la tarea 350). Las categorías reales con
// guías para ejecutar, de dos en dos: el icono de su clase, su nombre y
// cuántas guías tiene. Cada una abre el catálogo filtrado (el mismo enlace de
// siempre) y el total, a la derecha del título, abre el catálogo entero
// («Todas las guías»). La tarea 346 retiró unos mosaicos que ocupaban media
// pantalla para cuatro enlaces; estos miden 64 de alto, con el icono que
// reconoce la categoría antes de leerla, y caben seis en lo que ocupaban tres
// filas de chips.
//
// MOSAICO APILADO (tarea 358, alternativa A de Claude Design). El icono y el
// número arriba y el nombre debajo, con todo el ancho de la celda: con el icono
// al lado, «Computadores» se partía a mitad de palabra a 320, 360 y 390 px, la
// celda partida crecía y su vecina no. Ahora las celdas son iguales y el nombre
// nunca se parte sin guion (`hyphens-auto`, la página es `lang="es"`; nunca
// `overflow-wrap:anywhere`). Con un número impar, la última ocupa la fila
// entera en forma horizontal, sin dejar un hueco.
function CategoriasEnTelefono({ accesos, totalGuias }: { accesos: AccesoRapido[]; totalGuias: number }) {
  return (
    <section aria-labelledby="resolver-categorias" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="resolver-categorias" className={TITULO_SECCION}>
          Guías por categoría
        </h2>
        <Link
          to="/soluciones"
          state={ORIGEN_RESOLVER}
          aria-label={totalGuias > 0 ? `Todas las guías (${totalGuias})` : 'Todas las guías'}
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-bold text-noct-accent-300"
        >
          {totalGuias > 0 ? `${totalGuias} ${totalGuias === 1 ? 'guía' : 'guías'}` : 'Todas'}
          <IconoVentana nombre="adelante" tam={15} grosor={2.4} />
        </Link>
      </div>
      {accesos.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {accesos.map((acceso, indice) => {
            const ancha = accesos.length % 2 === 1 && indice === accesos.length - 1
            const cuenta = `${acceso.guias} ${acceso.guias === 1 ? 'guía' : 'guías'}`
            const comun = {
              to: `/soluciones?categoria=${encodeURIComponent(acceso.categoriaId)}`,
              state: ORIGEN_RESOLVER,
              'data-categoria-telefono': true,
              'aria-label': `${acceso.nombre}: ${cuenta}`,
            }
            return ancha ? (
              <Link
                key={acceso.categoriaId}
                {...comun}
                className={`${TARJETA_TOCABLE} col-span-2 flex min-h-[60px] min-w-0 items-center gap-3 p-3`}
              >
                <IconoCategoria nombre={acceso.nombre} tam={36} />
                <span className="min-w-0 flex-1 text-balance text-[15px] font-bold leading-5 hyphens-auto">
                  {acceso.nombre}
                </span>
                <span className="shrink-0 text-[13.5px] font-semibold text-noct-neutral-300">{cuenta}</span>
              </Link>
            ) : (
              <Link
                key={acceso.categoriaId}
                {...comun}
                className={`${TARJETA_TOCABLE} flex min-w-0 flex-col gap-2 p-3`}
              >
                <span className="flex items-center justify-between gap-1.5">
                  <IconoCategoria nombre={acceso.nombre} tam={36} />
                  <span className="whitespace-nowrap text-[13.5px] font-semibold text-noct-neutral-300">{cuenta}</span>
                </span>
                <span className="text-balance text-[15px] font-bold leading-5 hyphens-auto">{acceso.nombre}</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

// EL ESCÁNER AL FINAL DEL CAMPO DE INICIO, EN EL TELÉFONO (tarea 350): otra
// forma de buscar, a un toque, separada por una línea como desde 768 px. Con
// algo escrito deja su sitio al «borrar».
function EscanerEnCampoTelefono() {
  return (
    <>
      <span aria-hidden className="h-6 w-px shrink-0 bg-noct-divider" />
      <Link
        to="/escaner"
        aria-label="Escanear QR"
        title="Escanear QR"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-noct-neutral-300 active:bg-noct-presionado"
      >
        <IconoVentana nombre="qr" tam={21} />
      </Link>
    </>
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
      <h2 id="resolver-recientes" className="mb-1 text-[17px] font-semibold tracking-[-.01em]">
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
      // 56 en el teléfono, 52 en la tableta y 48 desde 1280 (filas densas
      // del escritorio, T3). EN EL TELÉFONO, CADA GUÍA CON SU DIVISOR (tarea
      // 347): sin él, dos recientes de título largo se leían como una sola.
      // La fila va a todo el ancho del contenido, como las de la búsqueda y
      // la Agenda, con 12 px arriba y abajo, y la última sin divisor.
      className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-[9px] text-noct-text hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado max-md:mx-0 max-md:rounded-none max-md:border-b max-md:border-noct-divider-fuerte max-md:px-0 max-md:py-3 max-md:last:border-b-0 md:min-h-[52px] xl:min-h-12 xl:py-1.5"
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
          // En el teléfono, el título manda como en la búsqueda (tarea 347).
          className="min-w-0 text-[15px] font-medium leading-[1.3] [overflow-wrap:anywhere] text-pretty max-md:text-[15.5px] max-md:font-semibold xl:text-[14.5px]"
        >
          {guia.titulo}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[12.5px] leading-[1.4] text-noct-neutral-400 max-md:text-[13px]">
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
function BloqueAccesos({ accesos }: { accesos: AccesoRapido[] }) {
  // GUÍAS (tarea 330): el catálogo por categoría, con cuántas guías tiene
  // cada una, y "Todas" a la derecha del título. "Todas las guías" está
  // SIEMPRE: es la única puerta al catálogo desde que Guías dejó de ser
  // pestaña.
  return (
    <section aria-labelledby="resolver-accesos" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="resolver-accesos" className="text-[17px] font-semibold tracking-[-.01em]">
          Guías
        </h2>
        <Link
          to="/soluciones"
          state={ORIGEN_RESOLVER}
          aria-label="Todas las guías"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300 hover:underline xl:min-h-0"
        >
          Todas
          <CaretRight size={13} aria-hidden />
        </Link>
      </div>
      {accesos.length > 0 && (
        // Desde 1100 de contenido (1680), un índice vertical: una fila por
        // categoría con su libro y cuántas guías tiene, a la derecha (T10).
        <div className="flex flex-wrap gap-2 @[1100px]:flex-col @[1100px]:flex-nowrap @[1100px]:gap-0">
          {accesos.map((acceso) => (
            <Link
              key={acceso.categoriaId}
              to={`/soluciones?categoria=${encodeURIComponent(acceso.categoriaId)}`}
              state={ORIGEN_RESOLVER}
              aria-label={`${acceso.nombre}: ${acceso.guias} ${acceso.guias === 1 ? 'guía' : 'guías'}`}
              // Desde 1280, el chip denso del escritorio (34 px, con puntero).
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-noct-text/25 px-3.5 text-[14.5px] font-[550] text-noct-text hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado xl:min-h-[34px] xl:rounded-[10px] xl:px-3 xl:text-[13.5px] @[1100px]:-mx-2 @[1100px]:min-h-10 @[1100px]:gap-2.5 @[1100px]:rounded-lg @[1100px]:border-0 @[1100px]:px-2 @[1100px]:text-[14px] @[1100px]:font-medium"
            >
              <BookOpen size={15} className="hidden shrink-0 text-noct-neutral-500 @[1100px]:block" aria-hidden />
              {acceso.nombre}
              <span className="font-mono text-[12.5px] text-noct-neutral-500 @[1100px]:ml-auto">{acceso.guias}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
