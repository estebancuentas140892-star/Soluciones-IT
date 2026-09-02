import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { obtenerFavoritos } from '../../lib/favoritos'
import { obtenerRecientes } from '../../lib/recientes'
import { Chasis } from '../../app/Chasis'
import { BarraReanudar } from '../../components/BarraReanudar'
import { DescargarOffline } from '../../components/DescargarOffline'
import { SeccionPlegable } from '../../components/SeccionPlegable'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import {
  CaretDown,
  CaretRight,
  ChartBar,
  FlagBanner,
  type IconoProps,
  Lightbulb,
  LockSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  QrCode,
  Star,
  TreeStructure,
  UsersThree,
  WarningCircle,
} from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { agruparResultados, VISUAL_POR_TIPO } from '../busqueda/resultados'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { useReanudar } from '../soluciones/useReanudar'
import {
  ETIQUETA_ACCION_CAMBIO,
  obtenerActividadReciente,
  tiempoRelativo,
  type FilaActividad,
} from '../historial/actividadEquipo'
import { etiquetaResuelto } from '../historial/lineaDeTiempo'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import type { ItemPendiente } from './pendientes'
import { usePendientes } from './usePendientes'
import { problemasFrecuentesInicio } from './problemasFrecuentes'

// Pantalla de Inicio en el sistema Nocturne. Un buscador global que
// atraviesa guías, equipos y bóveda, y, cuando no se busca, lo que el
// técnico necesita al abrir la app. Declara nivel de sección en el
// chasis único (tarea 185), que le pone sidebar en escritorio y
// pestañas en móvil.
//
// CINCO BLOQUES, DOS PESOS DE FILA (tarea 203, auditoría móvil M-006 y
// M-007, mockup `2b`, reglas M-R6 y M-R7). Con la base llena esta
// pantalla medía más de 2.200 px a 360: cuatro pantallas de scroll. El
// problema no era la cantidad de información sino que cinco bloques
// usaban EXACTAMENTE la misma fila de 52 px, y solo un rótulo de 11 px
// los distinguía: "Pendientes" (algo que debo hacer) pesaba igual que
// "Actividad del equipo" (algo que hizo otro). Sin foco, el técnico
// desplaza buscando en vez de reconocer.
//
// Lo que hay ahora, de arriba abajo:
//   1. reanudar   4. "Te toca a ti"      (fila de ACCIÓN)
//   2. buscar     5. "Lo que consultaste" (fila de INFORMACIÓN)
//   3. dos atajos
//
// Y debajo, **nada se borra**: Problemas frecuentes, Favoritos, Para
// empezar y Actividad del equipo se pliegan tras una línea con su
// conteo (`SeccionPlegable`, regla M-R4). Cuatro líneas de 52 px en vez
// de unos 1.200 px de filas, y el conteo sigue diciendo lo que hay
// dentro sin abrirlas.
//
// Las DOS ÚNICAS formas de fila de la pantalla (M-R6, "una fila, un
// significado"): `FilaAccion` para lo que el técnico debe resolver
// (56 px, título de 15 px, la razón en el color de su estado) y
// `FilaInfo` para lo que solo se consulta (44 px, 13,5 px, sin cuadrado
// de color ni galón). Si dos bloques tienen la misma forma es porque
// tienen la misma naturaleza.

// Cuántas filas se ven antes de "Ver los otros N". Dos bastan para
// reconocer si hay algo urgente; el resto está a un toque y sin cambiar
// de pantalla.
const FILAS_VISIBLES = 2

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

  // Pendientes (fase J-D5 de PROPUESTA_JORNADA_TECNICO.md): bloque
  // derivado de lo que ya significa "pendiente" en los datos reales, sin
  // tabla ni esquema nuevos. Las cinco consultas viven en `usePendientes`
  // (tarea 187): el chasis también las necesita, para el número de la
  // pestaña Inicio.
  const perfil = usePerfilVivo()
  const pendientes = usePendientes()

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

  // UNA SOLA TARJETA DE REANUDAR (hallazgo M-013). El procedimiento a
  // medias se dibujaba de tres formas que parecían tres cosas distintas
  // y eran la misma: "Continuar donde quedaste" (una consulta propia de
  // esta pantalla), "Sin terminar" en Guías y la barra flotante del
  // chasis. Aquí se retiró la consulta propia: ahora Inicio lee el mismo
  // `useReanudar` que el chasis y pinta el mismo componente en su
  // tamaño grande.
  //
  // Y no se repite: si la barra flotante está visible, Inicio no dibuja
  // su tarjeta. Se veían las dos a la vez, una encima de la otra.
  const reanudar = useReanudar()
  const barraFlotanteVisible = reanudar.actual != null && !reanudar.descartado

  const gruposResultado = useMemo(() => agruparResultados(resultados), [resultados])

  // Bienvenida del primer día (tarea 184): se muestra mientras falte
  // alguno de sus tres pasos Y esta pantalla no tenga todavía bloques
  // propios. Sin valor por defecto, `useLiveQuery` devuelve `undefined`
  // hasta que resuelve: es la señal de "ya sé lo que hay" que evita
  // enseñar la bienvenida un instante a quien sí tiene trabajo a medias.
  const consultasListas = useLiveQuery(() => db.progresoPasos.count(), []) !== undefined
  const hayBloquesReales = recientes.length > 0 || pendientes.length > 0 || reanudar.actual != null

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
          <div className="@container flex flex-col gap-[18px]">
            {/* Bienvenida del primer día: los tres pasos que dejan al
                técnico listo para trabajar sin señal. Se retira sola (no
                se cierra a mano) cuando los cumple o cuando esta pantalla
                ya tiene bloques propios que mostrar. */}
            {consultasListas && (
              <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
            )}

            {/* BLOQUE 1 · Reanudar. */}
            {reanudar.actual && !barraFlotanteVisible && (
              <BarraReanudar
                variante="tarjeta"
                articulo={reanudar.actual.articulo}
                hechos={reanudar.actual.hechos}
                total={reanudar.actual.total}
                minutosRestantes={reanudar.actual.minutosRestantes}
                onDescartar={reanudar.descartar}
              />
            )}

            {/* BLOQUE 3 · Atajos. (El 2 es el buscador, arriba.) */}
            <div className="grid grid-cols-2 gap-2.5">
              <AtajoRapido
                to="/diagnostico"
                Icono={TreeStructure}
                titulo="Diagnóstico"
                detalle="Del síntoma a la guía"
              />
              <AtajoRapido to="/escaner" Icono={QrCode} titulo="Escanear" detalle="Ficha por QR" />
              {/* DOS ATAJOS, NO TRES (tarea 207, hallazgo M-008, regla
                  M-R10). "Registrar equipo" ocupaba una fila entera de
                  esta rejilla, en un dispositivo cuyo criterio es la
                  consulta: daba protagonismo a un alta que se hace mejor
                  en el ordenador. Los dos que quedan solo existen aquí,
                  con el teléfono en la mano.

                  El alta NO se pierde, se queda donde tiene contexto:
                  tras un escaneo sin coincidencia (`EscanerPage` ofrece
                  "/dispositivos/nuevo?serial=" con el código ya leído),
                  en el "Crear" de Equipos y de Red, y en el vacío del
                  buscador global, que precarga el nombre buscado. */}
            </div>

            {/* BLOQUE 4 · "Te toca a ti": lo único con fila de ACCIÓN.
                Es lo que el técnico debe resolver, y por eso es lo único
                que pesa 15 px y lleva la razón en color de estado. */}
            {pendientes.length > 0 && (
              <BloqueLista titulo="Te toca a ti" total={pendientes.length} etiquetaVerMas="pendientes">
                {(visibles) =>
                  pendientes.slice(0, visibles).map((item) => <FilaAccion key={item.clave} item={item} />)
                }
              </BloqueLista>
            )}

            {/* BLOQUE 5 · "Lo que consultaste": fila de INFORMACIÓN. */}
            {recientes.length > 0 && (
              <BloqueLista titulo="Lo que consultaste" total={recientes.length} etiquetaVerMas="recientes">
                {(visibles) =>
                  recientes.slice(0, visibles).map((reciente) => {
                    const { Icono } = reciente.clave.startsWith('dispositivo:')
                      ? VISUAL_POR_TIPO.dispositivo
                      : VISUAL_POR_TIPO.articulo
                    return (
                      <FilaInfo
                        key={reciente.clave}
                        to={reciente.ruta}
                        Icono={Icono}
                        titulo={reciente.titulo}
                        meta={reciente.subtitulo}
                      />
                    )
                  })
                }
              </BloqueLista>
            )}

            {/* Lo que NO se borra pero deja de competir por la atención:
                cuatro líneas de 52 px con su conteo (regla M-R4). Se
                abren en el sitio, sin cambiar de pantalla. */}
            {(problemasFrecuentes.length > 0 ||
              favoritos.length > 0 ||
              rutas.length > 0 ||
              actividad.length > 0) && (
              <div className="overflow-hidden rounded-lg border border-noct-divider [&>*+*]:border-t [&>*+*]:border-noct-divider">
                {problemasFrecuentes.length > 0 && (
                  <SeccionPlegable
                    titulo="Problemas frecuentes"
                    Icono={WarningCircle}
                    conteo={problemasFrecuentes.length}
                    tono="precaucion"
                  >
                    <div className="flex flex-col">
                      {problemasFrecuentes.map((problema) => (
                        <FilaInfo
                          key={problema.diagnosticoId}
                          to={`/diagnostico/${problema.diagnosticoId}`}
                          Icono={WarningCircle}
                          titulo={problema.titulo}
                          meta={
                            problema.ejecuciones == null
                              ? 'Nuevo'
                              : problema.ejecuciones === 1
                                ? '1 vez'
                                : `${problema.ejecuciones} veces`
                          }
                        />
                      ))}
                    </div>
                    <Link
                      to="/diagnostico/estadisticas"
                      className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-medium text-noct-accent-300"
                    >
                      <ChartBar size={13} aria-hidden />
                      Ver estadísticas
                    </Link>
                  </SeccionPlegable>
                )}

                {favoritos.length > 0 && (
                  <SeccionPlegable titulo="Favoritos" Icono={Star} conteo={favoritos.length}>
                    <div className="flex flex-col">
                      {favoritos.map((favorito) => {
                        const { Icono } = VISUAL_POR_TIPO[favorito.tipo]
                        return (
                          <FilaInfo
                            key={favorito.clave}
                            to={favorito.ruta}
                            Icono={Icono}
                            titulo={favorito.titulo}
                            meta={favorito.subtitulo}
                          />
                        )
                      })}
                    </div>
                  </SeccionPlegable>
                )}

                {rutas.length > 0 && (
                  <SeccionPlegable titulo="Para empezar" Icono={FlagBanner} conteo={rutas.length}>
                    <ol className="flex flex-col">
                      {rutas.map((articulo, indice) => (
                        <li key={articulo.id}>
                          <Link
                            to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
                            className="flex min-h-11 items-center gap-2.5 border-t border-noct-divider/60 text-[13.5px] text-noct-text first:border-t-0 hover:text-noct-accent-300"
                          >
                            <span className="w-4 shrink-0 text-center font-mono text-[12px] text-noct-neutral-400">
                              {indice + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{articulo.titulo}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </SeccionPlegable>
                )}

                {actividad.length > 0 && (
                  <SeccionPlegable
                    titulo="Actividad del equipo"
                    Icono={UsersThree}
                    conteo={actividad.length}
                  >
                    <div className="flex flex-col">
                      {actividad.map((fila) => (
                        <FilaActividadItem key={fila.clave} fila={fila} />
                      ))}
                    </div>
                  </SeccionPlegable>
                )}
              </div>
            )}

            <DescargarOffline />
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
  children,
}: {
  titulo: string
  total: number
  // Qué son los que faltan, para que el texto accesible diga algo
  // ("Ver los otros 4 pendientes") en vez de solo un número.
  etiquetaVerMas: string
  children: (visibles: number) => ReactNode
}) {
  const [desplegado, setDesplegado] = useState(false)
  const ocultos = total - FILAS_VISIBLES

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
        <TituloSeccion>{titulo}</TituloSeccion>
        <span className="shrink-0 text-[11px] tabular-nums text-noct-neutral-400">{total}</span>
      </div>
      <div className="flex flex-col">{children(desplegado ? total : FILAS_VISIBLES)}</div>
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

// FILA DE ACCIÓN (M-R6). Lo que el técnico debe resolver: 56 px, título
// de 15 px y, debajo, LA RAZÓN en el color de su estado ("Venció hace 3
// días" en rojo). Es la única fila de la pantalla con cuadrado de color
// y galón, porque es la única que pide actuar.
function FilaAccion({ item }: { item: ItemPendiente }) {
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
        <span className={`block truncate text-[12.5px] ${COLOR_RAZON[item.tono]}`}>{item.detalle}</span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
    </Link>
  )
}

// FILA DE INFORMACIÓN (M-R6). Lo que solo se consulta: 44 px, 13,5 px,
// icono pequeño sin cuadrado de color, y el dato que sirve para
// reconocerlo a la derecha. Sin galón: no promete una acción.
function FilaInfo({
  to,
  Icono,
  titulo,
  meta,
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  meta?: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-2.5 border-t border-noct-divider/60 text-[13.5px] text-noct-text first:border-t-0 hover:text-noct-accent-300"
    >
      <Icono size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{titulo}</span>
      {meta && <span className="max-w-[45%] shrink-0 truncate text-[12px] text-noct-neutral-400">{meta}</span>}
    </Link>
  )
}

// Fila del bloque "Actividad del equipo": quien hizo que, sobre que
// ficha, hace cuanto. Un cambio de campo dice "Ana editó X (3
// cambios)"; una ejecucion de diagnostico dice "Ana ejecutó el
// diagnostico X (Resuelto)". Es una FRASE, no un par título/subtítulo,
// así que no encaja en `FilaInfo`; conserva su forma propia pero con el
// peso de información (13,5 px, sin cuadrado de color).
function FilaActividadItem({ fila }: { fila: FilaActividad }) {
  const { Icono } = VISUAL_POR_TIPO[fila.entidadTipo ?? 'diagnostico']
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
      className="flex min-h-11 items-start gap-2.5 border-t border-noct-divider/60 py-2 text-[13.5px] text-noct-text first:border-t-0 hover:text-noct-accent-300"
    >
      <Icono size={15} className="mt-[3px] shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0 flex-1 leading-[1.35] [text-wrap:pretty]">
        <span className="font-medium">{fila.usuarioNombre}</span> {accionTexto}{' '}
        <span className="font-medium">{fila.titulo}</span> {detalle}
      </span>
      <span className="shrink-0 text-[12px] text-noct-neutral-400">{tiempoRelativo(fila.fechaHora)}</span>
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
      className={`flex min-h-12 flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface p-3.5 text-noct-text hover:border-noct-accent hover:bg-noct-accent/[.06] ${className}`}
    >
      <Icono size={21} className="text-noct-accent" aria-hidden />
      <span className="text-[13.5px] font-medium leading-[1.3]">
        {titulo}
        <span className="mt-0.5 block text-[11.5px] font-normal leading-[1.4] text-noct-neutral-400">
          {detalle}
        </span>
      </span>
    </Link>
  )
}
