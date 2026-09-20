import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { obtenerFavoritos } from '../../lib/favoritos'
import { obtenerRecientes, type ElementoReciente } from '../../lib/recientes'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import {
  BookBookmark,
  BookOpen,
  CaretRight,
  ClockCounterClockwise,
  type IconoProps,
  MagnifyingGlass,
  Monitor,
  Plus,
  Star,
  TreeStructure,
} from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { PuenteBoveda } from '../busqueda/PuenteBoveda'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { coincidenciaArticulo } from '../soluciones/coincidencia'
import { tarjetaReanudarVisible, useReanudar } from '../soluciones/useReanudar'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import { agruparAgenda } from './agenda'
import { ResumenDelDia, SeccionesAgenda } from './SeccionesAgenda'
import { usePendientes } from './usePendientes'

// Pantalla de Inicio en el sistema Nocturne. Declara nivel de sección en
// el chasis único (tarea 185), que le pone sidebar en escritorio y
// pestañas en móvil.
//
// INICIO ES LA AGENDA OPERATIVA, CON EL BUSCADOR ARRIBA (encargo del
// 2026-09-20, tarea 1).
//
// El 2026-09-17 la agenda se mudó entera a `/agenda` y en Inicio quedó
// una línea con lo urgente. El efecto en el uso diario fue el contrario
// del buscado: al abrir la app ya no se sabía qué había pendiente, qué
// vencía hoy ni qué trabajo estaba a medias, porque todo eso estaba a un
// toque de distancia en otra pantalla. Buscar sigue siendo la entrada
// rápida y se queda arriba del todo; debajo vuelve la agenda.
//
// De arriba abajo:
//
//   1. la pregunta y el buscador global, lo primero y lo más grande;
//   2. la fecha de hoy y el resumen de lo que hay con fecha;
//   3. Vencidos · 4. Para hoy · 5. Próximos (tres) · 6. En curso ·
//      7. Por revisar del equipo, con "Ver agenda completa" al final.
//
// Los grupos NO se dibujan aquí: son `SeccionesAgenda`, el mismo
// componente que usa `AgendaPage`, sobre el mismo `agruparAgenda` de los
// mismos `usePendientes`. Una sola regla de negocio, dos sitios donde se
// ve.
//
// Nada se inventa: no hay calendario, ni recordatorios a mano, ni tabla
// nueva; la agenda es una vista de datos que ya existen.

// Cuántas filas de recientes. Cinco caben en un teléfono sin empujar la
// pantalla, y son atajos, no un historial.
const MAX_RECIENTES_INICIO = 5

export function InicioPage() {
  // VOLVER CON LA BÚSQUEDA ESCRITA (encargo del 2026-09-16, sección 13).
  // Abrir una ficha desde un resultado y volver (con el regreso de la app
  // o con el botón atrás del teléfono) repone lo que estaba escrito en
  // este campo. Viaja en el estado de navegación, nunca en la URL ni en
  // localStorage.
  const { restaurada, descartar } = useBusquedaRestaurada()
  const repuesta = restaurada && !restaurada.capa ? restaurada.consulta : ''
  const [query, setQuery] = useState(repuesta)
  // Vaciar el campo repuesto es dar la búsqueda por terminada: se olvida
  // también en el historial, para que volver más tarde a Inicio no la
  // reponga.
  useEffect(() => {
    if (repuesta !== '' && query === '') descartar()
  }, [repuesta, query, descartar])
  // BUSCAR NADA MÁS ABRIR, EN ESCRITORIO (segunda pasada del encargo del
  // 2026-09-17, sección 2: "al abrir la aplicación, poder empezar a buscar
  // inmediatamente"). Con ratón y teclado físico el campo recibe el foco
  // al llegar a Inicio: se escribe sin tocar nada. En el teléfono NO: el
  // teclado en pantalla taparía "Continuar" y "Recientes", que muchas
  // veces es lo que se viene a tocar; ahí el campo ya es lo primero y lo
  // más grande.
  const refCampo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const conPunteroFino =
      typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (conPunteroFino) refCampo.current?.focus({ preventScroll: true })
  }, [])
  // La bóveda se abrió desde el puente de la propia búsqueda, sin salir
  // de Inicio: cuenta una interacción más en la medición del recorrido.
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

  // ALCANCES DISTINTOS, DICHOS EN VOZ ALTA (hallazgo H09, criterio A16).
  // El buscador global solo indexa lo PUBLICADO; la lista de Guías
  // muestra también los borradores marcados como tales. Si solo un
  // borrador coincide, se dice y se ofrece ir a verlo.
  const borradores = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && (a.estado ?? 'publicado') !== 'publicado').toArray(),
    [],
    [],
  )
  const borradoresQueCoinciden = useMemo(
    () => (consulta ? borradores.filter((a) => coincidenciaArticulo(a, consulta, '') !== null).length : 0),
    [borradores, consulta],
  )

  // LA AGENDA. Los mismos pendientes que cuenta el número de la pestaña,
  // repartidos por fecha con la misma función que usa `/agenda`: aquí no
  // se vuelve a decidir qué está vencido ni qué es de hoy.
  const perfil = usePerfilVivo()
  const pendientes = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])

  // UNA SOLA TARJETA DE REANUDAR (hallazgo M-013): la dibuja
  // `SeccionesAgenda` dentro de "En curso". Aquí el dato se lee solo para
  // saber si ya hay trabajo real (bienvenida) y para no repetir la guía
  // en "Recientes".
  const reanudar = useReanudar()
  const hayQueReanudar = tarjetaReanudarVisible(reanudar)
  const idReanudar = hayQueReanudar ? (reanudar.actual?.articulo.id ?? null) : null

  // Bienvenida del primer día (tarea 184): se muestra mientras falte
  // alguno de sus tres pasos Y no haya todavía trabajo real. Sin valor
  // por defecto, `useLiveQuery` devuelve `undefined` hasta que resuelve:
  // es la señal de "ya sé lo que hay" que evita enseñarla un instante a
  // quien sí tiene trabajo a medias.
  const consultasListas = useLiveQuery(() => db.progresoPasos.count(), []) !== undefined
  const hayBloquesReales = pendientes.length > 0 || reanudar.actual != null

  // FAVORITAS: las guías marcadas con la estrella en ESTE teléfono (la
  // misma marca de siempre, `favoritos`). Solo guías: Inicio es para
  // resolver con guías, y los equipos y diagnósticos favoritos siguen en
  // Más.
  const favoritos = useLiveQuery(() => obtenerFavoritos(), [], [])
  const favoritas = useMemo(() => favoritos.filter((f) => f.tipo === 'articulo'), [favoritos])

  // RECIENTES (tarea 241): lo último abierto en este teléfono. Se quita
  // lo que ya está a la vista arriba (la guía de "Continuar" y las
  // favoritas): la misma guía dos veces en la misma pantalla es ruido. La
  // bóveda no aparece nunca: `recientes` no anota credenciales.
  const recientesCrudos = useLiveQuery(() => obtenerRecientes(MAX_RECIENTES_INICIO + 8), [], [])
  const recientes = useMemo(() => {
    const yaVisibles = new Set(favoritas.map((f) => f.clave))
    if (idReanudar) yaVisibles.add(`articulo:${idReanudar}`)
    return recientesCrudos.filter((r) => !yaVisibles.has(r.clave)).slice(0, MAX_RECIENTES_INICIO)
  }, [recientesCrudos, favoritas, idReanudar])

  const sinNadaQueMostrar = !hayQueReanudar && favoritas.length === 0 && recientes.length === 0

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila.
    //
    // `conLupa={false}` (regla M-R8, "un buscador por pantalla"): esta
    // pantalla trae su propio campo de búsqueda en línea, así que la lupa
    // del chasis sería el segundo buscador de la misma pantalla.
    <Chasis
      titulo="Inicio"
      conLupa={false}
      barra={
        <div className="px-4 pb-3.5 pt-1.5">
          {/* LA PREGUNTA, NO EL MÓDULO (tarea 241, sección 1; encargo del
              2026-09-17). El técnico no llega con ganas de buscar, llega
              con algo que solucionar. La etiqueta accesible sigue
              nombrando el alcance (regla M-R8). */}
          <p className="mb-2 px-0.5 text-[17px] font-medium leading-snug text-noct-text">
            ¿Qué necesitas solucionar?
          </p>
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo="Procedimiento, error, equipo…"
            refCampo={refCampo}
          />
        </div>
      }
    >
      <main className="flex-1 px-4 pb-16 pt-4">
        {buscando ? (
          resultados.length > 0 ? (
            <ResultadosBusqueda
              resultados={resultados}
              consulta={consulta}
              consultaCruda={consultaCruda}
              onDesbloqueada={() => setHuboDesbloqueo(true)}
              huboDesbloqueo={huboDesbloqueo}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Estado vacío más útil: con la bóveda bloqueada, "no se
                  encontró nada" no es toda la verdad, porque sus accesos ni
                  siquiera se buscaron. */}
              <PuenteBoveda consulta={consultaCruda} onDesbloqueada={() => setHuboDesbloqueo(true)} />
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
                <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
                <div>
                  <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                    Nada coincide con "{consultaCruda}" en Soluciones IT. Prueba otra palabra o revisa la
                    ortografía.
                  </p>
                  {borradoresQueCoinciden > 0 && (
                    <p className="mt-2 text-[13px] leading-relaxed text-noct-neutral-300">
                      Hay{' '}
                      {borradoresQueCoinciden === 1
                        ? '1 borrador que coincide'
                        : `${borradoresQueCoinciden} borradores que coinciden`}
                      . Los borradores no entran en esta búsqueda porque todavía no son procedimientos del
                      equipo, pero puedes verlos en Guías.
                    </p>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap justify-center gap-2">
                  {borradoresQueCoinciden > 0 && (
                    <Link to={`/soluciones?q=${encodeURIComponent(consultaCruda)}`} className={BTN_SECUNDARIO}>
                      <BookOpen size={15} aria-hidden />
                      Ver los borradores en Guías
                    </Link>
                  )}
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
              </div>
            </div>
          )
        ) : (
          <div className="@container flex flex-col gap-[22px]">
            {/* LA AGENDA OPERATIVA, JUSTO DEBAJO DEL BUSCADOR. El día y el
                resumen primero, y debajo los grupos en el orden en que se
                decide la jornada. La guía a medias entra en "En curso"
                (con su tarjeta) y no se repite en ninguna otra sección. */}
            <div className="flex flex-col gap-[18px]">
              <ResumenDelDia agenda={agenda} />
              <SeccionesAgenda agenda={agenda} conEnlaceCompleta />
            </div>

            {/* Bienvenida del primer día: los tres pasos que dejan al
                técnico listo para trabajar sin señal. Va DEBAJO de la
                agenda para no empujarla, se retira sola en cuanto hay
                trabajo real y, cumplida, no vuelve. */}
            {consultasListas && (
              <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
            )}

            {favoritas.length > 0 && (
              <section>
                <div className="mb-1 flex items-center gap-2 px-0.5">
                  <Star size={13} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Favoritas</TituloSeccion>
                </div>
                <div className="flex flex-col">
                  {favoritas.map((favorita) => (
                    <FilaAtajo
                      key={favorita.clave}
                      ruta={favorita.ruta}
                      Icono={BookOpen}
                      titulo={favorita.titulo}
                      subtitulo={favorita.subtitulo}
                    />
                  ))}
                </div>
              </section>
            )}

            {recientes.length > 0 && (
              <section>
                <div className="mb-1 flex items-center gap-2 px-0.5">
                  <ClockCounterClockwise size={13} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Recientes</TituloSeccion>
                </div>
                <div className="flex flex-col">
                  {recientes.map((item) => (
                    <FilaAtajo
                      key={item.clave}
                      ruta={item.ruta}
                      Icono={ICONO_RECIENTE[item.tipo]}
                      titulo={item.titulo}
                      subtitulo={item.subtitulo}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* SIN HISTORIAL TODAVÍA: la pantalla no se queda en blanco
                debajo del buscador. Dice qué va a aparecer aquí y deja
                explorar las guías. */}
            {consultasListas && sinNadaQueMostrar && (
              <p className="px-0.5 text-[13.5px] leading-relaxed text-noct-neutral-400">
                Aquí aparecerán las guías que uses y las que marques con la estrella. También puedes{' '}
                <Link to="/soluciones" className="font-medium text-noct-accent-300 underline underline-offset-[3px]">
                  ver todas las guías
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </main>
    </Chasis>
  )
}

// UNA FILA DE ATAJO (M-R6, fila de CONSULTA): 52 px, título de 15 px y
// sin cuadrado de color. Lleva a lo que nombra; en una guía, directo a su
// paso pendiente.
function FilaAtajo({
  ruta,
  Icono,
  titulo,
  subtitulo,
}: {
  ruta: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  subtitulo: string
}) {
  return (
    <Link
      to={ruta}
      className="flex min-h-[52px] items-center gap-3 rounded-md px-2 py-2 text-noct-text hover:bg-noct-text/[.05] active:bg-noct-text/[.08]"
    >
      <Icono size={17} className="shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-[1.3] [text-wrap:pretty]">{titulo}</span>
        {subtitulo && <span className="block truncate text-[12px] text-noct-neutral-500">{subtitulo}</span>}
      </span>
      <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

const ICONO_RECIENTE: Record<ElementoReciente['tipo'], (props: IconoProps) => React.JSX.Element> = {
  articulo: BookOpen,
  dispositivo: Monitor,
  diagnostico: TreeStructure,
  referencia: BookBookmark,
}
