import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { BarraReanudar } from '../../components/BarraReanudar'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import {
  BookOpen,
  CaretDown,
  CaretRight,
  Check,
  type IconoProps,
  Lightbulb,
  LockSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
} from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { agruparResultados } from '../busqueda/resultados'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { coincidenciaArticulo } from '../soluciones/coincidencia'
import { tarjetaReanudarVisible, useReanudar } from '../soluciones/useReanudar'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import type { ItemPendiente } from './pendientes'
import { agruparAgenda, asuntosUrgentes, fechaDeHoy, resumenAgenda } from './agenda'
import { usePendientes } from './usePendientes'

// Pantalla de Inicio en el sistema Nocturne. Un buscador global que
// atraviesa guías, equipos y bóveda, y, cuando no se busca, lo que el
// técnico necesita al abrir la app. Declara nivel de sección en el
// chasis único (tarea 185), que le pone sidebar en escritorio y
// pestañas en móvil.
//
// UNA AGENDA OPERATIVA, NO UNA COLECCIÓN DE BLOQUES (encargo del
// 2026-09-11, tarea 2). Inicio apilaba cosas sin relación entre sí, y
// la peor era "Te toca a ti": mezclaba una clave vencida hace medio
// año, un borrador propio y una sugerencia de OTRO técnico bajo un
// rótulo que además mentía. Al entrar no se podía responder la única
// pregunta de las 8 de la mañana: ¿qué tengo que hacer hoy?
//
// Ahora, de arriba abajo:
//   1. buscador global        5. Para hoy
//   2. fecha de hoy (es-CO)   6. Próximos
//   3. resumen de una línea   7. En curso
//   4. Vencidos               8. Por revisar del equipo
//
// El reparto en grupos es lógica pura y vive en `agenda.ts`: la fecha
// manda, y cada ítem cae en UN grupo, así que nada se duplica. Sigue
// sin haber entidad "tarea" ni tabla de recordatorios: es una vista
// derivada de datos que ya existen.
//
// Las DOS formas de fila (M-R6, "una fila, un significado"):
// `FilaAgenda` para lo que el técnico debe resolver (56 px, título de
// 15 px, la razón en el color de su estado y el origen al lado) y
// `FilaInfo` para lo que solo se consulta (44 px, 13,5 px, sin cuadrado
// de color ni galón).

// Cuántas filas se ven antes de "Ver los otros N". Dos bastan para
// reconocer si hay algo urgente; el resto está a un toque y sin cambiar
// de pantalla.
const FILAS_VISIBLES = 2

// "Próximos" muestra tres y guarda el resto tras "Ver los otros N": son
// avisos, no urgencias, y una lista larga de fechas futuras empuja
// fuera de pantalla lo que sí hay que hacer hoy.
const PROXIMOS_VISIBLES = 3

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

  // ALCANCES DISTINTOS, DICHOS EN VOZ ALTA (hallazgo H09, criterio A16).
  //
  // El buscador global solo indexa lo PUBLICADO (`useIndiceBusqueda`
  // filtra por estado), mientras que la lista de Guías muestra también
  // los borradores marcados como tales. Buscar "almuerzo" aquí decía
  // "Sin coincidencias" y ofrecía "Crear equipo", mientras que la misma
  // palabra en Guías encontraba el borrador: la diferencia era real y
  // no estaba explicada en ninguna parte.
  //
  // No se cambia el alcance (un borrador no debe aparecer como si fuera
  // procedimiento oficial del equipo): se cuenta cuántos hay y se
  // ofrece ir a verlos, identificados como borradores.
  const borradores = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && (a.estado ?? 'publicado') !== 'publicado').toArray(),
    [],
    [],
  )
  const borradoresQueCoinciden = useMemo(
    () => (consulta ? borradores.filter((a) => coincidenciaArticulo(a, consulta, '') !== null).length : 0),
    [borradores, consulta],
  )

  // Pendientes (fase J-D5 de PROPUESTA_JORNADA_TECNICO.md): bloque
  // derivado de lo que ya significa "pendiente" en los datos reales, sin
  // tabla ni esquema nuevos. Las cinco consultas viven en `usePendientes`
  // (tarea 187): el chasis también las necesita, para el número de la
  // pestaña Inicio.
  const perfil = usePerfilVivo()
  const pendientes = usePendientes()
  // La agenda del día: los mismos pendientes, repartidos por FECHA en
  // los cinco grupos que el técnico usa para decidir (agenda.ts). Cada
  // ítem cae en uno solo, así que nada se cuenta ni se pinta dos veces.
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])
  const resumen = resumenAgenda(agenda)
  const urgentes = asuntosUrgentes(agenda)
  const hoyTexto = useMemo(() => fechaDeHoy(), [])

  // UNA SOLA TARJETA DE REANUDAR (hallazgo M-013). El procedimiento a
  // medias se dibujaba de varias formas que parecían cosas distintas y
  // eran la misma. Inicio lee `useReanudar`, el mismo dato que el
  // bloque "Sin terminar" de Guías, y pinta el componente en su tamaño
  // grande. La barra flotante global se retiró; la comprobación que
  // preguntaba si estaba visible desaparece con ella (valía lo mismo
  // que tener algo que reanudar, así que anulaba la tarjeta siempre).
  const reanudar = useReanudar()
  const hayQueReanudar = tarjetaReanudarVisible(reanudar)

  const gruposResultado = useMemo(() => agruparResultados(resultados), [resultados])

  // Bienvenida del primer día (tarea 184): se muestra mientras falte
  // alguno de sus tres pasos Y esta pantalla no tenga todavía bloques
  // propios. Sin valor por defecto, `useLiveQuery` devuelve `undefined`
  // hasta que resuelve: es la señal de "ya sé lo que hay" que evita
  // enseñar la bienvenida un instante a quien sí tiene trabajo a medias.
  const consultasListas = useLiveQuery(() => db.progresoPasos.count(), []) !== undefined
  const hayBloquesReales = pendientes.length > 0 || reanudar.actual != null

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila. El titulo
    // ("Inicio", regla R12), el estado del dato y la cuenta los aporta el
    // chasis (tarea 181).
    //
    // `conLupa={false}` (regla M-R8, "un buscador por pantalla"): esta
    // pantalla trae su propio campo de búsqueda en línea, con el alcance
    // escrito, así que la lupa del chasis sería el segundo buscador de
    // la misma pantalla. Se apaga aquí y solo aquí; en las otras cuatro
    // secciones la lupa ES el buscador.
    <Chasis
      titulo="Inicio"
      conLupa={false}
      barra={
        <div className="px-4 pb-3 pt-2">
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Guías, Equipos y Bóveda"
          />
        </div>
      }
    >
      <main className="flex-1 px-4 pb-16 pt-4">
        {buscando ? (
          gruposResultado.length > 0 ? (
            <ResultadosBusqueda grupos={gruposResultado} consulta={consulta} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
              <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
              <div>
                <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                  Nada coincide con "{consultaCruda}" en las guías publicadas, los equipos ni la bóveda. Prueba
                  otra palabra o revisa la ortografía.
                </p>
                {/* La diferencia de alcance, dicha donde se nota
                    (H09/A16). Solo aparece cuando de verdad hay algo que
                    ofrecer, y dice qué es: un borrador, no una guía
                    publicada. */}
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
              {/* Salidas del estado vacío (hallazgo H9 y H09). "Crear
                  equipo" ya no es la única: primero se ofrece seguir
                  buscando donde el alcance es otro, y solo después
                  registrar algo nuevo. */}
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
          )
        ) : (
          <div className="@container flex flex-col gap-[18px]">
            {/* Bienvenida del primer día: los tres pasos que dejan al
                técnico listo para trabajar sin señal. No compite con la
                agenda: se retira sola (no se cierra a mano) en cuanto hay
                algo que atender, y una vez cumplidos los tres pasos no
                vuelve a aparecer en este dispositivo. */}
            {consultasListas && (
              <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
            )}

            {/* LA AGENDA. Fecha de hoy y resumen de una línea; debajo,
                los grupos, en el orden en que se decide el día: lo que
                ya falló, lo de hoy, lo que viene, lo que tengo a medias
                y lo que el equipo dejó por revisar. */}
            <section className="flex flex-col gap-0.5 px-0.5">
              <p className="text-[12.5px] text-noct-neutral-400">{hoyTexto}</p>
              {resumen !== '' && (
                <p
                  className={`text-[15px] font-medium leading-[1.35] ${urgentes > 0 ? 'text-noct-text' : 'text-noct-neutral-300'}`}
                >
                  {resumen}
                </p>
              )}
            </section>

            {/* ESTADO TRANQUILO (encargo del 2026-09-11, tarea 5). Sin
                vencidos ni asuntos de hoy, la pantalla lo dice con todas
                sus letras en vez de quedarse en blanco. Lo que viene
                después (Próximos) se sigue viendo, pero como aviso, no
                como alarma. */}
            {urgentes === 0 && (
              <section className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-5">
                <div className="flex items-center gap-2.5">
                  <Check size={17} className="shrink-0 text-noct-exito" aria-hidden />
                  <h2 className="text-[15px] font-medium leading-[1.3]">Todo al día por hoy</h2>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-noct-neutral-400">
                  No hay accesos vencidos ni asuntos con fecha para hoy.
                </p>
              </section>
            )}

            {agenda.vencidos.length > 0 && (
              <section>
                <CabeceraAgenda titulo="Vencidos" total={agenda.vencidos.length} />
                <div className="flex flex-col">
                  {agenda.vencidos.map((item) => (
                    <FilaAgenda key={item.clave} item={item} />
                  ))}
                </div>
              </section>
            )}

            {agenda.hoy.length > 0 && (
              <section>
                <CabeceraAgenda titulo="Para hoy" total={agenda.hoy.length} />
                <div className="flex flex-col">
                  {agenda.hoy.map((item) => (
                    <FilaAgenda key={item.clave} item={item} />
                  ))}
                </div>
              </section>
            )}

            {agenda.proximos.length > 0 && (
              <BloqueLista
                titulo="Próximos"
                total={agenda.proximos.length}
                etiquetaVerMas="próximos"
                visiblesIniciales={PROXIMOS_VISIBLES}
              >
                {(visibles) =>
                  agenda.proximos.slice(0, visibles).map((item) => <FilaAgenda key={item.clave} item={item} />)
                }
              </BloqueLista>
            )}

            {/* EN CURSO · trabajo propio empezado: la guía a medias y
                los borradores. No son obligaciones con plazo, así que
                no entran en "Vencidos" ni en "Para hoy". */}
            {(hayQueReanudar || agenda.enCurso.length > 0) && (
              <section>
                <CabeceraAgenda
                  titulo="En curso"
                  total={agenda.enCurso.length + (hayQueReanudar ? 1 : 0)}
                />
                <div className="flex flex-col gap-2">
                  {hayQueReanudar && reanudar.actual && (
                    <BarraReanudar
                      variante="tarjeta"
                      articulo={reanudar.actual.articulo}
                      hechos={reanudar.actual.hechos}
                      total={reanudar.actual.total}
                      minutosRestantes={reanudar.actual.minutosRestantes}
                      onDescartar={reanudar.descartar}
                    />
                  )}
                  {agenda.enCurso.length > 0 && (
                    <div className="flex flex-col">
                      {agenda.enCurso.map((item) => (
                        <FilaAgenda key={item.clave} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* POR REVISAR DEL EQUIPO · sugerencias de diagnóstico que
                nadie ha convertido en guía. No están asignadas a este
                técnico, así que no se anuncian como algo que le toque. */}
            {agenda.porRevisar.length > 0 && (
              <BloqueLista
                titulo="Por revisar del equipo"
                total={agenda.porRevisar.length}
                etiquetaVerMas="sugerencias del equipo"
              >
                {(visibles) =>
                  agenda.porRevisar.slice(0, visibles).map((item) => <FilaAgenda key={item.clave} item={item} />)
                }
              </BloqueLista>
            )}

          </div>
        )}
      </main>
    </Chasis>
  )
}

// Bloque de lista con cabecera de rótulo + conteo y un "Ver los otros N"
// que despliega el resto EN EL SITIO (mockup `2b`). Antes cada bloque
// pintaba sus filas completas: seis pendientes y cinco recientes son
// once filas de 52 px que empujan todo lo demás fuera de la pantalla.
function BloqueLista({
  titulo,
  total,
  etiquetaVerMas,
  visiblesIniciales = FILAS_VISIBLES,
  children,
}: {
  titulo: string
  total: number
  // Qué son los que faltan, para que el texto accesible diga algo
  // ("Ver los otros 4 pendientes") en vez de solo un número.
  etiquetaVerMas: string
  visiblesIniciales?: number
  children: (visibles: number) => ReactNode
}) {
  const [desplegado, setDesplegado] = useState(false)
  const ocultos = total - visiblesIniciales

  return (
    <section>
      <CabeceraAgenda titulo={titulo} total={total} />
      <div className="flex flex-col">{children(desplegado ? total : visiblesIniciales)}</div>
      {ocultos > 0 && !desplegado && (
        <button
          type="button"
          onClick={() => setDesplegado(true)}
          className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[12.5px] font-medium text-noct-accent-300"
        >
          Ver los otros {ocultos}
          <span className="sr-only"> {etiquetaVerMas}</span>
          <CaretDown size={12} aria-hidden />
        </button>
      )}
    </section>
  )
}

// Cabecera de un grupo de la agenda: qué es y cuántos hay. El conteo va
// aquí y no dentro de cada fila, para que el grupo se pueda evaluar sin
// leerlo entero.
function CabeceraAgenda({ titulo, total }: { titulo: string; total: number }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
      <TituloSeccion>{titulo}</TituloSeccion>
      <span className="shrink-0 text-[11px] tabular-nums text-noct-neutral-400">{total}</span>
    </div>
  )
}

// FILA DE LA AGENDA (M-R6, fila de ACCIÓN). 56 px, título de 15 px y,
// debajo, LA RAZÓN en el color de su estado ("Venció hace 3 días" en
// rojo) y de dónde sale ("Bóveda", o el nombre del equipo). El origen
// solo aparece cuando el ítem tiene fecha: en un borrador su detalle ya
// dice de quién es y repetirlo sería la misma palabra dos veces.
function FilaAgenda({ item }: { item: ItemPendiente }) {
  const Icono = ICONO_PENDIENTE[item.categoria]
  return (
    <Link
      to={item.ruta}
      className={`flex min-h-14 items-center gap-3 rounded-md px-2 py-[9px] text-noct-text hover:bg-noct-text/[.05] ${
        item.tono === 'error' ? 'bg-noct-error/[.07]' : ''
      }`}
    >
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md ${TONO_PENDIENTE[item.tono]}`}
      >
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-[1.3]">{item.titulo}</span>
        <span className="block truncate text-[12.5px]">
          <span className={COLOR_RAZON[item.tono]}>{item.detalle}</span>
          {item.fecha !== null && (
            <span className="text-noct-neutral-400"> · {item.origen}</span>
          )}
        </span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
    </Link>
  )
}

// Icono y tono de una fila de "Te toca a ti" según su categoría: una
// credencial vencida pesa distinto que un borrador propio, aunque ambos
// sean "algo por resolver".
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
// La razón va en el color del estado, no en gris: es lo que distingue
// "Venció hace 3 días" de "Borrador tuyo · hace 2 días" de un vistazo,
// sin leer (M-R6). Lo neutro se queda neutro para que el color siga
// significando algo.
const COLOR_RAZON: Record<ItemPendiente['tono'], string> = {
  neutro: 'text-noct-neutral-400',
  precaucion: 'text-noct-precaucion',
  error: 'text-noct-error',
}
