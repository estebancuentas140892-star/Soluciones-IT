import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { tiempoRelativo } from '../../lib/tiempoRelativo'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { BookOpen, CaretRight, MagnifyingGlass, PencilSimple, Play, Plus, Warning } from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { PuenteBoveda } from '../busqueda/PuenteBoveda'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { BorradoresCoincidentes, GuiasEnBorrador } from '../busqueda/BorradoresCoincidentes'
import {
  borradoresCoincidentes,
  esBorradorVivo,
  hayGuiaPublicadaEnTitulo,
  repartirBorradores,
  sinLosYaOficiales,
} from '../busqueda/borradoresEnBusqueda'
import { iconoDeCategoria, normalizarTexto } from '../soluciones/iconosSoluciones'
import { claseTextoDeCategoria } from '../soluciones/coloresCategoria'
import { articulosSinTerminar } from '../soluciones/sinTerminar'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import { agruparAgenda, type Agenda } from './agenda'
import {
  accesosRapidos,
  asuntosDeAtencion,
  guiasRecientes,
  type AccesoRapido,
  type GuiaReciente,
} from './resolver'
import { FilaAgenda } from './SeccionesAgenda'
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

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])

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
      new Map(articulosSinTerminar(articulos, progresos).map((s) => [s.articulo.id, { hechos: s.hechos, total: s.total }])),
    [articulos, progresos],
  )
  const recientes = useMemo(
    () => guiasRecientes(visitas, articulos, categorias, avances),
    [visitas, articulos, categorias, avances],
  )
  const accesos = useMemo(() => accesosRapidos(categorias, articulos, visitas), [categorias, articulos, visitas])

  // Bienvenida del primer día (tarea 184): se muestra mientras falte
  // alguno de sus tres pasos Y no haya todavía trabajo real. Sin valor
  // por defecto, `useLiveQuery` devuelve `undefined` hasta que resuelve:
  // es la señal de "ya sé lo que hay" que evita enseñarla un instante a
  // quien sí tiene trabajo a medias.
  const consultasListas = useLiveQuery(() => db.progresoPasos.count(), []) !== undefined
  const hayBloquesReales = pendientes.length > 0 || avances.size > 0

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila, el primero de los
    // cuatro destinos. `conLupa={false}` (regla M-R8, "un buscador por
    // pantalla"): esta pantalla trae su propio campo en línea, así que la
    // lupa del chasis sería el segundo buscador de la misma pantalla.
    <Chasis
      titulo="Resolver"
      conLupa={false}
      barra={
        <div className="px-4 pb-3.5 pt-1.5">
          {/* LA PREGUNTA, NO EL MÓDULO. El técnico no llega con ganas de
              buscar, llega con algo que resolver. La etiqueta accesible
              sigue nombrando el alcance (regla M-R8). */}
          <p className="mb-2 px-0.5 text-[17px] font-medium leading-snug text-noct-text">
            ¿Qué necesitas resolver?
          </p>
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo="Buscar problema, equipo, comando…"
            refCampo={refCampo}
          />
        </div>
      }
    >
      <main className="flex-1 px-4 pb-16 pt-4">
        {buscando ? (
          <div className="flex flex-col gap-4">
            {/* La guía en borrador que coincide en el título, DELANTE de
                todo lo demás, salvo que ya haya una publicada que también
                coincida en el título: esa conserva la prioridad. */}
            {!hayPublicadaEnTitulo && <GuiasEnBorrador borradores={destacados} consulta={consulta} consultaCruda={consultaCruda} />}

            {resultados.length > 0 ? (
              <ResultadosBusqueda
                resultados={resultados}
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

            {hayPublicadaEnTitulo && <GuiasEnBorrador borradores={destacados} consulta={consulta} consultaCruda={consultaCruda} />}

            {/* BORRADORES COINCIDENTES: los que solo coinciden por
                etiqueta, categoría o tipo. En su propio bloque, nunca
                mezclados con los oficiales. */}
            <BorradoresCoincidentes
              borradores={secundarios}
              consulta={consulta}
              consultaCruda={consultaCruda}
            />

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
            <BloqueRecientes recientes={recientes} />
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
    </Chasis>
  )
}

// ATENCIÓN: lo que tiene fecha y hay que atender, con la misma fila que la
// agenda completa (`FilaAgenda`, que ya dice el estado con palabra y color
// y la acción con un verbo). Si no hay nada con fecha, no hay bloque: un
// "todo al día" aquí sería un adorno que empuja lo demás.
function BloqueAtencion({ agenda }: { agenda: Agenda }) {
  const { visibles, total } = asuntosDeAtencion(agenda)
  if (total === 0) return null
  return (
    <section aria-labelledby="resolver-atencion">
      <div className="mb-1.5 flex items-center gap-2 px-0.5">
        <Warning size={14} className="shrink-0 text-noct-precaucion" aria-hidden />
        <TituloSeccion>
          <span id="resolver-atencion">Atención</span>
        </TituloSeccion>
      </div>
      <div className="flex flex-col">
        {visibles.map(({ item, estado }) => (
          <FilaAgenda key={item.clave} item={item} estado={estado} />
        ))}
      </div>
      <Link
        to="/agenda"
        state={ORIGEN_RESOLVER}
        className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[13px] font-medium text-noct-accent-300 hover:underline"
      >
        {total > visibles.length ? `Ver la agenda completa (${total})` : 'Ver la agenda completa'}
        <CaretRight size={13} aria-hidden />
      </Link>
    </section>
  )
}

// RECIENTES: las guías que este técnico usó en los últimos días. La que
// está a medias lo dice y se continúa en el paso donde iba (abrir una guía
// ya la lleva al primer paso pendiente, AD-040).
function BloqueRecientes({ recientes }: { recientes: GuiaReciente[] }) {
  if (recientes.length === 0) return null
  return (
    <section aria-labelledby="resolver-recientes">
      <TituloSeccion className="mb-1.5 px-0.5">
        <span id="resolver-recientes">Recientes</span>
      </TituloSeccion>
      <div className="flex flex-col">
        {recientes.map((guia) => (
          <FilaReciente key={guia.id} guia={guia} />
        ))}
      </div>
    </section>
  )
}

function FilaReciente({ guia }: { guia: GuiaReciente }) {
  const aMedias = guia.avance !== null
  const accion = aMedias ? 'Continuar' : 'Abrir'
  const cuando = tiempoRelativo(guia.visitadoEn)
  const detalle = aMedias
    ? `Vas en el paso ${Math.min(guia.avance!.hechos + 1, guia.avance!.total)} de ${guia.avance!.total}`
    : [guia.categoriaNombre, cuando].filter(Boolean).join(' · ')
  const Icono = aMedias ? Play : BookOpen
  return (
    <Link
      to={guia.ruta}
      state={ORIGEN_RESOLVER}
      aria-label={`${accion} ${guia.titulo}${guia.borrador ? ' (borrador)' : ''}`}
      className="flex min-h-14 items-center gap-3 rounded-md px-2 py-[9px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md ${
          aMedias ? 'bg-noct-accent/[.14] text-noct-accent-300' : 'bg-noct-text/[.06] text-noct-neutral-300'
        }`}
      >
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-[1.3]">{guia.titulo}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
          {guia.borrador && (
            <span className="inline-flex shrink-0 items-center gap-1 text-noct-neutral-300">
              <PencilSimple size={11} aria-hidden />
              Borrador ·
            </span>
          )}
          <span className={`truncate ${aMedias ? 'text-noct-accent-300' : 'text-noct-neutral-400'}`}>{detalle}</span>
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300" aria-hidden>
        {accion}
      </span>
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
  return (
    <section aria-labelledby="resolver-accesos">
      {accesos.length > 0 && (
        <>
          <TituloSeccion className="mb-2 px-0.5">
            <span id="resolver-accesos">Accesos rápidos</span>
          </TituloSeccion>
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-noct-divider bg-noct-surface px-3.5 text-[14px] font-medium text-noct-text hover:border-noct-neutral-600 hover:bg-noct-text/[.04]"
                >
                  <Icono size={16} className={`shrink-0 ${categoria ? claseTextoDeCategoria(categoria) : 'text-noct-neutral-400'}`} aria-hidden />
                  {acceso.nombre}
                </Link>
              )
            })}
          </div>
        </>
      )}
      <Link
        to="/soluciones"
        state={ORIGEN_RESOLVER}
        className={`${accesos.length > 0 ? 'mt-2' : ''} inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[13px] font-medium text-noct-accent-300 hover:underline`}
      >
        <BookOpen size={14} aria-hidden />
        Todas las guías
        <CaretRight size={13} aria-hidden />
      </Link>
    </section>
  )
}
