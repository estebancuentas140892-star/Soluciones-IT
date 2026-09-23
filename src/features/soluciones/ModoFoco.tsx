import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BloquePaso, PasoAdjunto, PasoProcedimiento } from '../../lib/db'
import { normalizarTexto } from './iconosSoluciones'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { DebesVerPaso, DondeSeHacePaso } from './SenalesDePaso'
import {
  BookOpen,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  Code,
  CursorClick,
  Info,
  ListChecks,
  Question,
  SealCheck,
  Warning,
  X,
} from '../../components/iconos'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { ChipReferencia } from '../referencia/ChipReferencia'
import { fichasEnlazadasDelPaso } from '../referencia/comandosEnTexto'
import { QueHaceEnTexto } from '../referencia/QueHaceEnTexto'
import { TarjetaComando } from '../referencia/TarjetaComando'
import { bloquesUnicos, tipoEfectivo } from '../referencia/referencias'
import { useReferencias } from '../referencia/useReferencias'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import { apoyosDelPaso, apoyosDeTarea, type Apoyos } from './apoyosTarea'
import { motivoGuiasPendientes } from './guiasObligatorias'
import { accionFoco, avisosDeTareaFoco, tareaFocoHecha, tareasParaFoco, type TareaFoco } from './tareasFoco'
import { tonoInfo } from './tonos'

// MODO FOCO: una acción a la vez (handoff "Diseño móvil", tablero 6d).
// Desde la tarea 217 es LA ejecución de una guía, no un modo opcional.
//
// Frente al equipo, con una mano y a veces con guantes, la unidad real
// de trabajo es la ACCIÓN ("pulsa Editar"), no el paso entero. Esta
// vista enseña una sola y dice qué hacer ahora.
//
// QUÉ CAMBIA EL 2026-09-17 (encargo "resolver rápido con guías").
// Principio: la guía no enseña todo mientras se trabaja; dice qué hacer
// ahora, y la información correcta aparece en el momento correcto.
//
//   - Nada detiene el recorrido salvo el trabajo. Los avisos dejaron de
//     ser pantallas con "Entendido · continuar": van con su acción y el
//     tono decide cómo (ver `presenciaDeAviso` en tonos.ts). Solo los
//     riesgos reales se ven como alerta.
//   - La pantalla se lee de arriba abajo en el orden en que se usa:
//     dónde estoy (paso y título), qué riesgo hay, qué hago, con qué lo
//     hago (dato, comando, imagen, clave, archivo) y, plegado, por qué.
//   - Las imágenes y la clave de la acción se ven sin abrir nada. Antes
//     estaban detrás de chips de 52 px ("Foto", "Clave") y la
//     información del paso llegaba desplegada sobre la primera tarea.
//   - Abajo, "Anterior" y "Siguiente". "Tengo un problema" baja a una
//     línea discreta: tiene que estar cuando algo falla, pero no puede
//     competir con la acción en cada pantalla.
//
// Las reglas de fondo no cambian: qué cuenta como hecho, qué bloquea una
// tarea (guías necesarias), cómo se responde una decisión y cómo se
// abre una guía vinculada siguen donde estaban.

interface Props {
  paso: PasoProcedimiento
  tituloPaso: string
  // Dónde está este paso dentro del procedimiento ("Paso 3 de 12"). Sin
  // esto la acción de la pantalla no tenía contexto: el título del paso
  // solo vivía en el índice.
  numeroPaso: number
  totalPasos: number
  // ¿Queda algún paso después de este? Decide si la última acción dice
  // "Siguiente" o "Terminar".
  hayPasoSiguiente: boolean
  instruccionesHechas: ReadonlySet<string>
  // ¿La guía vinculada del paso ya está completa? La resuelve quien
  // llama con lectura en vivo; aquí decide si la primera tarea del
  // recorrido está cumplida.
  subSatisfecho: boolean
  // ¿La guía vinculada del paso está en este dispositivo? Un vínculo
  // roto NO bloquea (el paso tiene que poder cerrarse igual), pero
  // tampoco puede pasar por cumplido en silencio: sin esto el recorrido
  // empezaba directamente en la tarea siguiente y el técnico nunca leía
  // el motivo (criterio A12).
  guiaDelPasoDisponible?: boolean
  // Este foco es el de una guía vinculada, dibujada DENTRO del paso de
  // otra. Solo cambia el encuadre: el pie deja de sangrar hacia los
  // lados, porque ahí ya no llega al borde de la pantalla sino al de la
  // tarjeta que lo contiene.
  anidado?: boolean
  // LO QUE HAY QUE TENER LISTO ANTES DEL PASO 1 (encargo del 2026-09-17,
  // sección 4). Solo llega cuando toca enseñarlo: primer paso y sin
  // avance. Una guía sin requisitos no dibuja nada.
  requisitos?: string[]
  // Se llegó a este paso con "Anterior" desde el siguiente: se entra por
  // su última acción, que es la que el técnico acaba de dejar atrás.
  entrarPorElFinal?: boolean
  // "Anterior" desde la primera acción del paso. Sin paso anterior no
  // llega, y el control se apaga.
  onPasoAnterior?: () => void
  onAlternarTarea: (tareaId: string) => void
  // Cierra el paso y avanza. Es la misma acción dominante de la vista
  // completa: el foco no decide cuándo se puede, solo la ofrece.
  onCompletarPaso: () => void
  // Rótulo de esa acción cuando NO se puede cerrar todavía ("Faltan 2
  // tareas", "Completa «X»"), resuelto arriba con `cierreDelPaso` para
  // que las vistas digan exactamente lo mismo.
  etiquetaAvance: string
  // ¿El paso puede cerrarse ya? Misma regla para todos los controles de
  // finalización (tarea 3 del encargo del 2026-09-09).
  puedeCerrarPaso: boolean
  // El técnico declara que algo va mal en esta tarea. Abre la MISMA
  // hoja de salidas que el "Falla" de la vista completa (tablero 3d).
  onFalla: (textoTarea: string) => void
  // El destino de un "No" terminó: la decisión queda respondida y el
  // avance del destino se reinicia para su próximo uso, aquí o en
  // cualquier otra guía que lo reutilice. Lo resuelve `AsistenteVista`,
  // que es quien escribe en la base; esta vista no toca datos.
  onDecisionResuelta: (tareaId: string, guiaId: string) => void
  // Las guias obligatorias que la tarea todavia no ha cumplido, en el
  // orden del editor. Las resuelve `useProcedimientoEjecucion` con
  // lectura en vivo; aqui deciden si la tarea se puede marcar y que se
  // escribe debajo del boton (encargo del 2026-09-09, tarea 1).
  guiasPendientes: (tareaId: string) => BloquePaso[]
  // LA RUTA DEL PROCEDIMIENTO (encargo del 2026-09-22, sección 5). La
  // aporta `AsistenteVista`, que es quien tiene los estados de todos los
  // pasos. Cuando llega, ES la cabecera del paso: dice dónde se está
  // ("Paso 3 de 7" y el título), así que esta vista no lo repite.
  ruta?: ReactNode
  // Nombre de la guía que se está ejecutando, para la cabecera compacta
  // del vínculo ("Estás realizando X para continuar con Y").
  tituloGuiaPrincipal?: string
  // La guía vinculada terminó de verdad. Cerrar el vínculo lo hace esta
  // vista; lo que hay que revisar arriba (si con eso el paso ya se
  // puede cerrar) lo decide `AsistenteVista`, que es quien escribe.
  onVinculoCompletado: () => void
  // La TARJETA compacta de una guía vinculada: su papel, su nombre
  // entero, en qué va y una acción. La aporta `AsistenteVista`, que es
  // quien lee el artículo y su avance en vivo. `onAbrir` es de esta
  // vista: abrir sustituye el contenido de la tarea, no despliega nada
  // debajo (encargo del 2026-09-10, tarea 4).
  renderTarjetaGuia: (opciones: {
    guiaId: string
    tituloReferencia: string
    obligatoria: boolean
    // Rótulo de la tarjeta, cuando el que se deduce de `obligatoria`
    // ("Guía necesaria" / "Consulta opcional") no describe el papel.
    kicker?: string
    onAbrir: () => void
  }) => ReactNode
  // Ejecuta una guía vinculada EN LUGAR del contenido de la tarea. Lo
  // aporta `AsistenteVista`, que es quien sabe anidar otra ejecución y
  // quien conserva el punto de origen.
  renderGuia: (opciones: {
    guiaId: string
    tituloReferencia: string
    obligatoria: boolean
    // Qué hacer cuando la guía anidada termina. Sin esto, el asistente
    // intenta cerrar el paso, que es lo que corresponde a un requisito
    // del paso. Una DECISIÓN respondida con "No" necesita lo otro: al
    // terminar el destino, lo que queda respondido es la decisión.
    alCompletar?: () => void
  }) => ReactNode
}

// EL CONTENIDO NUEVO EMPIEZA ARRIBA (encargo del 2026-09-10, tarea 4).
//
// La ejecución no scrollea la ventana: el contenido vive dentro de un
// contenedor del chasis, y ese contenedor conservaba el desplazamiento
// de la tarea anterior, así que la tarea siguiente aparecía empezada
// por la mitad. Se sube el primer ancestro que de verdad puede
// desplazarse, y también la ventana por si el chasis cambia.
function subirElContenedor(desde: Element | null) {
  for (let nodo = desde?.parentElement ?? null; nodo; nodo = nodo.parentElement) {
    const desbordamiento = getComputedStyle(nodo).overflowY
    const puedeDesplazarse =
      (desbordamiento === 'auto' || desbordamiento === 'scroll') &&
      nodo.scrollHeight > nodo.clientHeight
    if (puedeDesplazarse) {
      nodo.scrollTop = 0
      return
    }
  }
  window.scrollTo({ top: 0 })
}

// La guía vinculada que ocupa ahora mismo el sitio de la tarea.
interface VinculoAbierto {
  guiaId: string
  titulo: string
  obligatoria: boolean
  alCompletar?: () => void
}

function adjuntosDe(bloques: BloquePaso[]): PasoAdjunto[] {
  return bloques.flatMap((b) => (b.adjunto ? [b.adjunto] : []))
}

// Clases compartidas de los controles del pie. 64 px de alto: es lo que
// se toca sin mirar, de pie frente al equipo.
const BOTON_PRINCIPAL =
  'flex h-16 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] px-3 text-[18px] font-semibold text-noct-accent-300 active:bg-noct-accent/[.34] disabled:opacity-30'
const BOTON_ANTERIOR =
  'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.08] disabled:opacity-30'

export function ModoFoco({
  paso,
  tituloPaso,
  numeroPaso,
  totalPasos,
  hayPasoSiguiente,
  instruccionesHechas,
  subSatisfecho,
  guiaDelPasoDisponible = true,
  anidado = false,
  requisitos = [],
  entrarPorElFinal = false,
  onPasoAnterior,
  onAlternarTarea,
  onCompletarPaso,
  etiquetaAvance,
  puedeCerrarPaso,
  onFalla,
  onDecisionResuelta,
  guiasPendientes,
  ruta,
  tituloGuiaPrincipal = '',
  onVinculoCompletado,
  renderTarjetaGuia,
  renderGuia,
}: Props) {
  const tareas = tareasParaFoco(paso, tituloPaso)

  function cumplida(tarea: TareaFoco): boolean {
    return tareaFocoHecha(tarea, instruccionesHechas, subSatisfecho)
  }

  // La guía que no está disponible se lee ANTES de seguir: cuenta como
  // cumplida para no bloquear, pero el recorrido empieza en ella para
  // que su explicación no pase de largo (A12).
  function primeraPendiente(): number {
    const pendiente = tareas.findIndex(
      (t) => !cumplida(t) || (t.clase === 'guia-del-paso' && !guiaDelPasoDisponible),
    )
    return pendiente >= 0 ? pendiente : 0
  }

  // La siguiente acción sin cumplir, mirando primero HACIA ADELANTE:
  // marcar una tarea no puede devolver al técnico a una que dejó atrás
  // con "Anterior". Si delante no queda nada, se vuelve a la que siga
  // pendiente donde sea.
  function siguientePendiente(desde: number): number {
    const adelante = tareas.findIndex((t, i) => i > desde && !cumplida(t))
    if (adelante >= 0) return adelante
    return tareas.findIndex((t, i) => i !== desde && !cumplida(t))
  }

  const [indiceTarea, setIndiceTarea] = useState(() =>
    entrarPorElFinal ? tareas.length - 1 : primeraPendiente(),
  )
  // "Más información" de la acción que se está mirando. Cerrado por
  // defecto: lo que se lee de brazo estirado es la instrucción.
  const [masInformacion, setMasInformacion] = useState(false)
  // Id de la tarea de decisión cuyo "No" está abierto. Se guarda el id
  // y no un booleano porque un paso puede tener más de una decisión, y
  // un booleano las abriría todas a la vez.
  const [decisionAbierta, setDecisionAbierta] = useState<string | null>(null)
  // LA GUÍA VINCULADA QUE OCUPA AHORA EL SITIO DE LA TAREA (encargo del
  // 2026-09-10, tarea 4). Sustituye el contenido de la tarea mientras
  // dure, y salir devuelve al mismo punto con el vínculo como estaba.
  const [vinculoAbierto, setVinculoAbierto] = useState<VinculoAbierto | null>(null)
  // Las fichas de Referencia vivas. Se resuelven aqui, una sola vez por
  // paso, en vez de en cada chip: asi editar un termino en Referencia
  // actualiza al instante todas las tareas que lo nombran.
  const referenciasVivas = useReferencias()
  // El encabezado del contenido activo: es donde va el foco al cambiar
  // de tarea, al completar una y al volver de un vínculo, para que el
  // lector de pantalla anuncie lo que toca y la vista arranque arriba.
  const encabezado = useRef<HTMLHeadingElement>(null)

  // TERMINAR LA GUÍA VINCULADA ADELANTA SOLO, como marcar una tarea.
  //
  // Sin esto el técnico completaba la guía de arriba y se quedaba
  // mirando "Guía completada" con la tarea siguiente escondida. Solo se
  // avanza en la TRANSICIÓN de pendiente a cumplida, así que volver
  // luego a mirarla no expulsa a nadie de su sitio.
  const guiaCumplidaAntes = useRef(subSatisfecho)
  useEffect(() => {
    const eraPendiente = !guiaCumplidaAntes.current
    guiaCumplidaAntes.current = subSatisfecho
    if (!subSatisfecho || !eraPendiente || !guiaDelPasoDisponible) return
    const actual = Math.min(indiceTarea, tareas.length - 1)
    if (tareas[actual]?.clase !== 'guia-del-paso') return
    const siguiente = tareas.findIndex(
      (t, i) => i !== actual && !tareaFocoHecha(t, instruccionesHechas, subSatisfecho),
    )
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }, [subSatisfecho, guiaDelPasoDisponible, indiceTarea, tareas, instruccionesHechas])

  const indice = Math.min(indiceTarea, tareas.length - 1)

  // LO DESPLEGADO ES DE LA ACCIÓN QUE SE ESTÁ MIRANDO, no del paso.
  // Cambiar de acción (con "Anterior", al marcar o al terminar la guía
  // vinculada) cierra "Más información", el vínculo y la decisión. Se
  // cierra AQUÍ, en el mismo render, y no en un efecto: un efecto corre
  // después de pintar y el contenido anterior alcanzaría a verse.
  const tareaMostrada = useRef(indice)
  if (tareaMostrada.current !== indice) {
    tareaMostrada.current = indice
    if (masInformacion) setMasInformacion(false)
    if (vinculoAbierto !== null) setVinculoAbierto(null)
    if (decisionAbierta !== null) setDecisionAbierta(null)
  }

  // ARRIBA DEL TODO Y CON EL FOCO EN EL ENCABEZADO, cada vez que cambia
  // lo que está en pantalla: al pasar de acción, al completar una y al
  // volver de un vínculo (encargo del 2026-09-10, tarea 4).
  useEffect(() => {
    subirElContenedor(encabezado.current)
    encabezado.current?.focus({ preventScroll: true })
  }, [indice, vinculoAbierto])

  const tarea = tareas[indice]
  if (!tarea) return null

  const hecha = cumplida(tarea)
  const hechas = tareas.filter(cumplida).length
  const esPrimeraDelPaso = indice === 0
  const accion = accionFoco(tareas, instruccionesHechas, subSatisfecho)
  const cierraPaso = accion === 'completar'
  const esVerificacion = tarea.tipoTarea === 'verificacion'
  // UNA DECISIÓN NO ES UNA ACCIÓN (encargo del 2026-09-09, secciones 5
  // y 6): se responde con sus dos salidas, nunca con "Siguiente".
  const esDecision = tarea.tipoTarea === 'decision'
  // UNA SOLA ZONA DE ACCIONES DOMINANTE. Mientras la guía vinculada
  // ocupa la pantalla, la suya es la que manda y este pie desaparece.
  const pieCedidoAlVinculo = vinculoAbierto !== null
  const destinoDelNo = esDecision ? tarea.decisionGuiaId : null
  const noAbierto = esDecision && decisionAbierta === tarea.id

  // LOS AVISOS DE ESTA ACCIÓN, repartidos por cómo se ven (ver
  // `avisosDeTareaFoco`): las alertas antes de la instrucción, los
  // datos a la vista y el resto plegado.
  const avisos = avisosDeTareaFoco(paso, tareas, indice)

  // LOS APOYOS DE ESTA ACCIÓN. Los de la tarea van siempre con ella. Los
  // del paso completo (imágenes y archivos que el autor dejó para todo
  // el paso, o heredados sin asignar) se ven a la vista UNA vez, con la
  // primera acción del paso, y en las siguientes quedan consultables
  // dentro de "Más información": nunca se repiten a la vista.
  const delPaso = apoyosDelPaso(paso)
  // La guía del paso y la tarea única no tienen apoyos propios: los
  // suyos son los del paso, como hasta ahora.
  const propios: Apoyos = tarea.clase === 'tarea' ? apoyosDeTarea(paso, tarea.id) : delPaso
  const imagenesALaVista = [
    ...(tarea.clase === 'tarea' && esPrimeraDelPaso ? delPaso.imagenes : []),
    ...propios.imagenes,
  ]
  const archivosALaVista = [
    ...(tarea.clase === 'tarea' && esPrimeraDelPaso ? [...adjuntosDe(delPaso.archivos), ...delPaso.adjuntosPaso] : []),
    ...adjuntosDe(propios.archivos),
    ...(tarea.clase === 'tarea' ? [] : delPaso.adjuntosPaso),
  ]
  const imagenesPlegadas = esPrimeraDelPaso ? [] : delPaso.imagenes
  const archivosPlegados = esPrimeraDelPaso ? [] : [...adjuntosDe(delPaso.archivos), ...delPaso.adjuntosPaso]
  const vinculoProtegido = propios.vinculoProtegido ?? tarea.vinculoProtegido
  // QUÉ HACER, DÓNDE Y QUÉ DEBO VER DESPUÉS (encargo del 2026-09-22,
  // sección 6). El lugar acompaña a la PRIMERA acción del paso (es donde
  // hay que situarse antes de empezar) y lo que debe verse, a la ÚLTIMA
  // (es lo que confirma que el paso salió). Los dos salen del paso, no de
  // la tarea: son sus campos `lugar` y `resultado`.
  const esUltimaDelPaso = indice === tareas.length - 1
  const lugarDelPaso = esPrimeraDelPaso ? paso.lugar.trim() : ''
  const debesVer = esUltimaDelPaso ? paso.resultado.trim() : ''
  // Para qué sirve el paso: explica, no ordena, así que va plegado y solo
  // con la primera acción del paso.
  const objetivoPlegado = esPrimeraDelPaso ? paso.objetivo.trim() : ''
  const hayMasInformacion =
    avisos.plegados.length > 0 ||
    imagenesPlegadas.length > 0 ||
    archivosPlegados.length > 0 ||
    objetivoPlegado !== ''

  // La guía vinculada de ESTA tarea. En la entrada 'guia-del-paso' es el
  // trabajo entero de la tarea, así que se despliega sin pedir permiso:
  // es lo que el técnico vino a hacer. En una tarea normal pueden ser
  // VARIAS, y se muestran todas en el orden del editor.
  const guiasDeLaTarea =
    tarea.clase === 'guia-del-paso' && tarea.guiaId
      ? [{ id: tarea.guiaId, titulo: tarea.guiaTitulo, clave: 'guia-del-paso' }]
      : tarea.guiasObligatorias.map((g) => ({
          id: g.guiaArticuloId ?? '',
          titulo: g.guiaArticuloTitulo,
          clave: g.id,
        }))
  // Cuáles de ellas siguen sin terminar. Mientras quede una, la tarea
  // no se puede marcar.
  const pendientes = tarea.clase === 'tarea' ? guiasPendientes(tarea.id) : []
  const motivoGuias = motivoGuiasPendientes(pendientes)
  // Guías de consulta y contingencia asignadas a esta tarea: apoyo, no
  // prerrequisito, así que nunca bloquean.
  const guiasDeApoyo = propios.guias.filter((g) => g.intencionGuia !== 'necesario')
  // Los TÉRMINOS del glosario y los ATAJOS o COMANDOS de esta acción.
  const referenciasDeLaTarea = bloquesUnicos(propios.referencias).map((bloque) => ({
    bloque,
    tipo: tipoEfectivo(
      {
        id: bloque.referenciaId as string,
        titulo: bloque.referenciaTitulo,
        tipoDeclarado: bloque.referenciaTipo,
      },
      referenciasVivas,
    ),
  }))
  // Un término o una herramienta se CONSULTA: etiqueta discreta.
  const terminos = referenciasDeLaTarea
    .filter((r) => r.tipo === 'termino' || r.tipo === 'herramienta')
    .map((r) => r.bloque)
  // Un atajo o un comando SE USA en el momento: entero y a la vista.
  const atajosYComandos = referenciasDeLaTarea
    .filter((r) => r.tipo === 'atajo' || r.tipo === 'comando')
    .map((r) => r.bloque)

  // El motivo de la guía vinculada, en las palabras del autor. Se omite
  // cuando el paso no tiene título propio: la frase se volvería un
  // espejo ("completa X porque X").
  const motivoGuiaDelPaso =
    tarea.clase === 'guia-del-paso'
      ? [paso.titulo ? `El paso «${paso.titulo}» depende de ella.` : null, paso.objetivo || null]
          .filter(Boolean)
          .join(' ')
      : ''

  // DÓNDE ESTOY: "Paso 3 de 12", y el título del paso cuando dice algo
  // que la instrucción no dice ya. En un paso de una sola acción con el
  // mismo texto sería la misma frase dos veces.
  const tituloPropio = paso.titulo.trim()
  const textoInstruccion =
    tarea.clase === 'guia-del-paso'
      ? !guiaDelPasoDisponible
        ? 'Esta guía no está disponible'
        : hecha
          ? 'Guía completada'
          : 'Primero, completa esta guía'
      : tarea.texto || 'Tarea sin texto'
  const tituloEnContexto =
    tituloPropio !== '' && normalizarTexto(tituloPropio) !== normalizarTexto(textoInstruccion) ? tituloPropio : ''

  // ¿Esta es la última acción pendiente de TODO el procedimiento? Solo
  // cambia el rótulo: "Terminar" en vez de "Siguiente".
  const quedaTrabajoEnElPaso = tareas.some((t) => t.id !== tarea.id && !cumplida(t))
  const esUltimoTrabajo = !hayPasoSiguiente && !quedaTrabajoEnElPaso

  const puedeRetroceder = indice > 0 || onPasoAnterior !== undefined

  // COMPLETAR Y AVANZAR SON UN SOLO GESTO (encargo del 2026-09-10,
  // tarea 5): "Siguiente" registra la acción Y trae la siguiente.
  function completarYContinuar() {
    // La misma regla que aplica el hook al escribir, aquí solo para no
    // ofrecer un gesto que no va a hacer nada.
    if (motivoGuias) return
    onAlternarTarea(tarea.id)
    const siguiente = siguientePendiente(indice)
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }

  // Corregirse es un gesto aparte y secundario: no mueve el recorrido,
  // porque quien desmarca quiere quedarse donde está.
  function desmarcar() {
    onAlternarTarea(tarea.id)
  }

  // Seguir SIN tocar nada, desde una acción que ya estaba cumplida (se
  // llegó a ella con "Anterior"). No registra nada.
  function continuarSinMarcar() {
    const pendiente = siguientePendiente(indice)
    if (pendiente >= 0) setIndiceTarea(pendiente)
    else if (indice + 1 < tareas.length) setIndiceTarea(indice + 1)
    else onCompletarPaso()
  }

  // "ANTERIOR" CONSULTA, NO DESHACE: mueve la vista a la acción de antes,
  // y desde la primera del paso, a la última del paso anterior.
  function retroceder() {
    if (indice > 0) setIndiceTarea(indice - 1)
    else onPasoAnterior?.()
  }

  // TERMINAR EL VÍNCULO DEVUELVE AL PUNTO EXACTO.
  function cerrarVinculo() {
    setVinculoAbierto(null)
    // Salir del destino de un "no" deshace la respuesta: quien vuelve
    // sin terminarlo todavía no ha resuelto nada.
    setDecisionAbierta(null)
  }

  // Responder que sí es seguir por la vía prevista.
  function responderSi() {
    setDecisionAbierta(null)
    completarYContinuar()
  }

  // Responder que no abre el destino si lo hay. Sin destino, la decisión
  // se registra igual y el flujo sigue: no dejar salida sería obligar a
  // mentir.
  function responderNo() {
    if (!destinoDelNo) {
      completarYContinuar()
      return
    }
    const tareaId = tarea.id
    setDecisionAbierta(tareaId)
    setVinculoAbierto({
      guiaId: destinoDelNo,
      titulo: tarea.decisionGuiaTitulo || 'la salida',
      obligatoria: false,
      alCompletar: () => {
        setDecisionAbierta(null)
        setVinculoAbierto(null)
        onDecisionResuelta(tareaId, destinoDelNo)
      },
    })
  }

  // LA GUÍA VINCULADA SUSTITUYE EL CONTENIDO DE LA TAREA (encargo del
  // 2026-09-10, tarea 4): el mismo sitio, con una cabecera compacta que
  // dice qué se está haciendo y para qué, y una salida que devuelve al
  // punto exacto.
  if (vinculoAbierto) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-none flex-col gap-2.5 border-b border-noct-divider pb-3 pt-1">
          <h2
            ref={encabezado}
            tabIndex={-1}
            data-foco-lectura
            className="text-[15px] leading-snug text-pretty text-noct-neutral-200 outline-none"
          >
            Estás realizando <span className="font-semibold text-noct-text">«{vinculoAbierto.titulo}»</span>
            {tituloGuiaPrincipal ? (
              <>
                {' '}para continuar con{' '}
                <span className="font-semibold text-noct-text">«{tituloGuiaPrincipal}»</span>
              </>
            ) : (
              ' para continuar con esta guía'
            )}
          </h2>
          {/* SALIR SIN TERMINAR NO CUMPLE NADA: se vuelve a la guía
              principal con el vínculo todavía pendiente. */}
          <button
            type="button"
            onClick={cerrarVinculo}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.07]"
          >
            <CaretLeft size={15} className="shrink-0" aria-hidden />
            Volver a la guía principal
          </button>
        </div>
        <div className="flex flex-1 flex-col pt-3">
          {renderGuia({
            guiaId: vinculoAbierto.guiaId,
            tituloReferencia: vinculoAbierto.titulo,
            obligatoria: vinculoAbierto.obligatoria,
            alCompletar:
              vinculoAbierto.alCompletar ??
              (() => {
                cerrarVinculo()
                onVinculoCompletado()
              }),
          })}
        </div>
      </div>
    )
  }

  // El control grande del pie, según lo que toca ahora.
  let principal: ReactNode
  if (cierraPaso) {
    // Con todo el paso hecho, "Siguiente" recorre primero las acciones
    // que quedan delante en este mismo paso (se volvió a revisar con
    // "Anterior") y solo desde la última pasa al paso siguiente.
    const quedaDelante = indice + 1 < tareas.length
    principal = (
      <button
        type="button"
        disabled={!quedaDelante && !puedeCerrarPaso}
        onClick={quedaDelante ? () => setIndiceTarea(indice + 1) : onCompletarPaso}
        className={BOTON_PRINCIPAL}
      >
        {quedaDelante || puedeCerrarPaso ? (
          hayPasoSiguiente || quedaDelante ? (
            <>
              <span className="truncate">Siguiente</span>
              <CaretRight size={22} className="shrink-0" aria-hidden />
            </>
          ) : (
            <>
              <Check size={22} className="shrink-0" aria-hidden />
              <span className="truncate">Terminar</span>
            </>
          )
        ) : (
          <span className="truncate text-[15px]">{etiquetaAvance}</span>
        )}
      </button>
    )
  } else if (tarea.clase === 'guia-del-paso') {
    // LA ACCIÓN DOMINANTE ES LA DE LA TARJETA ("Abrir guía" /
    // "Continuar guía"), así que aquí no va otra. Solo hay botón propio
    // cuando la tarjeta no ofrece nada que hacer: la guía ya está
    // completa, o no está en este dispositivo y no bloquea (A12).
    principal =
      hecha || !guiaDelPasoDisponible ? (
        <button type="button" onClick={continuarSinMarcar} className={BOTON_PRINCIPAL}>
          <span className="truncate">Siguiente</span>
          <CaretRight size={22} className="shrink-0" aria-hidden />
        </button>
      ) : (
        <p className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 text-center text-[13px] leading-snug text-noct-neutral-400">
          <BookOpen size={16} className="shrink-0" aria-hidden />
          Se cumple al terminar la guía de arriba
        </p>
      )
  } else if (esDecision && !hecha && !noAbierto) {
    // UNA DECISIÓN SE RESPONDE, NO SE MARCA. Acento la vía que sigue,
    // ámbar la que se desvía (regla R60).
    principal = (
      <>
        <button
          type="button"
          onClick={responderSi}
          disabled={motivoGuias !== null}
          aria-label="Sí: seguir con la guía"
          className={BOTON_PRINCIPAL}
        >
          <Check size={22} className="shrink-0" aria-hidden />
          Sí
        </button>
        {/* El "No" no es un riesgo, es la otra vía: desde el 2026-09-22
            va neutro. En una guía el ámbar significaría "lugar". */}
        <button
          type="button"
          onClick={responderNo}
          aria-label={
            destinoDelNo
              ? `No: abrir «${tarea.decisionGuiaTitulo || 'la salida'}»`
              : 'No: registrar la respuesta y seguir'
          }
          className="flex h-16 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl border-2 border-noct-neutral-600 px-3 text-[18px] font-semibold text-noct-neutral-200 active:bg-noct-text/10"
        >
          <X size={20} className="shrink-0" aria-hidden />
          No
        </button>
      </>
    )
  } else if (hecha) {
    // YA CUMPLIDA: se llegó aquí con "Anterior". Seguir no registra nada.
    principal = (
      <button type="button" onClick={continuarSinMarcar} className={BOTON_PRINCIPAL}>
        <span className="truncate">Siguiente</span>
        <CaretRight size={22} className="shrink-0" aria-hidden />
      </button>
    )
  } else {
    principal = (
      <button
        type="button"
        onClick={completarYContinuar}
        disabled={motivoGuias !== null}
        className={BOTON_PRINCIPAL}
      >
        {esUltimoTrabajo ? (
          <Check size={22} className="shrink-0" aria-hidden />
        ) : esVerificacion ? (
          <Check size={20} className="shrink-0" aria-hidden />
        ) : null}
        <span className="truncate">
          {esVerificacion
            ? esUltimoTrabajo
              ? 'Comprobado · terminar'
              : 'Comprobado · siguiente'
            : esUltimoTrabajo
              ? 'Terminar'
              : 'Siguiente'}
        </span>
        {!esUltimoTrabajo && !esVerificacion && <CaretRight size={22} className="shrink-0" aria-hidden />}
      </button>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 pb-6 pt-3">
        {requisitos.length > 0 && esPrimeraDelPaso && <AntesDeEmpezar requisitos={requisitos} />}

        {/* Un segmento por acción del paso, solo si el paso tiene más de
            una: con una sola, la barra no dice nada que no diga ya
            "Paso 3 de 12". */}
        {tareas.length > 1 && (
          <IndicadorAvance
            hechos={hechas}
            total={tareas.length}
            variante="segmentos"
            expandido
            actual={indice}
            className="flex-none"
          />
        )}

        {/* DÓNDE ESTOY: la ruta del procedimiento cuando la hay (nivel 0),
            y si no, la línea de siempre. */}
        {ruta ?? (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13.5px] leading-snug text-noct-neutral-400">
            <span className="font-semibold uppercase tracking-[.06em] text-noct-accion">
              Paso {numeroPaso} de {totalPasos}
            </span>
            {tituloEnContexto && <span className="min-w-0 text-pretty text-noct-neutral-300">{tituloEnContexto}</span>}
          </p>
        )}

        {/* LAS ALERTAS, ANTES DE LA INSTRUCCIÓN: un riesgo se lee antes
            de actuar, no después. Solo precaución e importante, y desde
            el 2026-09-22 en rojo: en una guía el rojo es el riesgo. */}
        {avisos.alertas.map((aviso) => (
          <AlertaDeRiesgo key={aviso.id} aviso={aviso} />
        ))}

        {/* DÓNDE SE HACE: el lugar, menú o sección que hay que localizar.
            Con la primera acción del paso, en amarillo, con su icono y su
            palabra (el color nunca va solo). */}
        {lugarDelPaso && <DondeSeHacePaso lugar={lugarDelPaso} />}

        <div className="flex flex-col gap-1">
          {/* Sin etiqueta cuando lo que se lee es un ESTADO de la guía del
              paso ("Esta guía no está disponible", "Guía completada"), no
              una instrucción: "Qué hacer" encima lo contradiría. */}
          {!(tarea.clase === 'guia-del-paso' && (!guiaDelPasoDisponible || hecha)) && (
            <EtiquetaDeAccion tipoTarea={tarea.tipoTarea} hecha={hecha} />
          )}
          <h2
            ref={encabezado}
            tabIndex={-1}
            data-foco-lectura
            className={`text-[26px] font-medium leading-[1.3] tracking-[-.01em] text-pretty outline-none ${
              hecha ? 'text-noct-neutral-400' : 'text-noct-text'
            }`}
          >
            {textoInstruccion}
          </h2>
        </div>

        {motivoGuiaDelPaso && (
          <p className="-mt-2 text-[15px] leading-snug text-noct-neutral-300 text-pretty">{motivoGuiaDelPaso}</p>
        )}

        {avisos.datos.map((aviso) => (
          <DatoTecnico key={aviso.id} aviso={aviso} />
        ))}

        {/* ATAJOS Y COMANDOS DE ESTA ACCIÓN. No marcan la tarea ni
            cuentan para cerrar el paso. */}
        {atajosYComandos.map((bloque) => (
          <TarjetaComando
            key={bloque.id}
            referencia={referenciasVivas.get(bloque.referenciaId as string)}
            tituloRespaldo={bloque.referenciaTitulo}
          />
        ))}

        {/* LA IMAGEN, A LA VISTA. Si el autor la ancló a esta acción es
            porque ayuda a hacerla; tocarla la amplía. */}
        {imagenesALaVista.map((imagen) => (
          <BloqueVista key={imagen.id} bloque={imagen} marcada={false} onAlternar={() => {}} />
        ))}

        {vinculoProtegido && <CredencialEnPaso vinculo={vinculoProtegido} variante="bloque" />}

        {archivosALaVista.length > 0 && <AdjuntosPaso adjuntos={archivosALaVista} titulo={paso.titulo} />}

        {/* LA GUÍA VINCULADA, COMO TARJETA COMPACTA: abrirla sustituye
            esta pantalla (encargo del 2026-09-10, tarea 4). */}
        {guiasDeLaTarea.map((g) => (
          <div key={g.clave}>
            {renderTarjetaGuia({
              guiaId: g.id,
              tituloReferencia: g.titulo,
              obligatoria: true,
              onAbrir: () => setVinculoAbierto({ guiaId: g.id, titulo: g.titulo, obligatoria: true }),
            })}
          </div>
        ))}

        {guiasDeApoyo.map((g) => (
          <div key={g.id}>
            {renderTarjetaGuia({
              guiaId: g.guiaArticuloId ?? '',
              tituloReferencia: g.guiaArticuloTitulo,
              obligatoria: false,
              onAbrir: () =>
                setVinculoAbierto({
                  guiaId: g.guiaArticuloId ?? '',
                  titulo: g.guiaArticuloTitulo,
                  obligatoria: false,
                }),
            })}
          </div>
        ))}

        {/* QUÉ DEBO VER DESPUÉS: con la última acción del paso, en verde
            (el `resultado` del paso). */}
        {debesVer && <DebesVerPaso texto={debesVer} />}

        {/* LOS TÉRMINOS, COMO ETIQUETAS DISCRETAS: se tocan para leer la
            definición sin salir de la guía ni tocar el avance. */}
        {terminos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {terminos.map((bloque) => (
              <ChipReferencia
                key={bloque.id}
                referenciaId={bloque.referenciaId as string}
                tituloRespaldo={bloque.referenciaTitulo}
                referencias={referenciasVivas}
              />
            ))}
          </div>
        )}

        {/* "¿QUÉ HACE?" (tarea 270): la instrucción escribe un comando o
            un atajo que tiene ficha en el Centro de consulta, sin que el
            autor la enlazara. Se abre en la misma hoja que un término. */}
        {tarea.clase === 'tarea' && (
          <QueHaceEnTexto
            texto={tarea.texto}
            referencias={referenciasVivas}
            excluir={fichasEnlazadasDelPaso(paso.bloques)}
          />
        )}

        {/* LO QUE SIRVE PARA ENTENDER, NO PARA HACER (sección 8 del
            encargo): plegado y a un toque. */}
        {hayMasInformacion && (
          <MasInformacion abierta={masInformacion} onAlternar={() => setMasInformacion((v) => !v)}>
            {objetivoPlegado && (
              <p className="text-[14px] leading-normal text-noct-neutral-200">
                <span className="font-medium text-noct-neutral-400">Para qué: </span>
                {objetivoPlegado}
              </p>
            )}
            {avisos.plegados.map((aviso) => (
              <NotaPlegada key={aviso.id} aviso={aviso} />
            ))}
            {imagenesPlegadas.map((imagen) => (
              <BloqueVista key={imagen.id} bloque={imagen} marcada={false} onAlternar={() => {}} />
            ))}
            {archivosPlegados.length > 0 && <AdjuntosPaso adjuntos={archivosPlegados} titulo={paso.titulo} />}
          </MasInformacion>
        )}
      </div>

      {!pieCedidoAlVinculo && (
        <div
          // OPACA Y CON BORDE, no un degradado (encargo del 2026-09-10,
          // tarea 4): una instrucción medio escondida es una instrucción
          // perdida. Es `sticky`, así que reserva su propio hueco.
          className={`sticky bottom-0 z-10 mt-auto flex flex-none flex-col gap-1.5 border-t border-noct-divider bg-noct-bg pt-3 ${
            anidado ? 'pb-2' : '-mx-4 px-4 pb-[calc(6px+env(safe-area-inset-bottom))]'
          }`}
        >
          {/* QUÉ GUÍA FALTA, con su nombre. Sin esto el botón apagado no
              dice por qué. */}
          {!cierraPaso && !hecha && motivoGuias && (
            <p className="text-center text-[12px] text-noct-neutral-300">{motivoGuias}</p>
          )}
          {esDecision && !hecha && !noAbierto && destinoDelNo && (
            <p className="text-center text-[13px] leading-snug text-noct-neutral-300 text-pretty">
              Si respondes que no, se abre «{tarea.decisionGuiaTitulo || 'la salida'}»
            </p>
          )}
          {/* En escritorio la ejecución tiene más ancho (tarea 255), pero
              los controles no se estiran: un botón de 700 px no se toca
              mejor que uno de 600. */}
          <div className="mx-auto flex w-full max-w-xl gap-2.5">
            <button
              type="button"
              disabled={!puedeRetroceder}
              onClick={retroceder}
              aria-label="Anterior. Solo mueve la vista, no cambia lo marcado"
              title="Anterior"
              className={BOTON_ANTERIOR}
            >
              <CaretLeft size={22} aria-hidden />
            </button>
            {principal}
          </div>
          {/* LO SECUNDARIO, EN UNA LÍNEA DISCRETA. "Tengo un problema" abre
              las salidas del paso (contingencia, evidencia, saltar) sin
              completar nada. */}
          <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onFalla(tarea.texto)}
              aria-haspopup="dialog"
              aria-label="Tengo un problema con esta acción: ver las salidas"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.07] hover:text-noct-text"
            >
              <Warning size={15} className="shrink-0" aria-hidden />
              Tengo un problema
            </button>
            {hecha && tarea.clase === 'tarea' && (
              <button
                type="button"
                onClick={desmarcar}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.07] hover:text-noct-text"
              >
                Desmarcar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// "ANTES DE EMPEZAR", SOLO CON REQUISITOS REALES (encargo del 2026-09-17,
// sección 4): lo que tiene que estar a mano antes de la primera acción.
// Sin casillas: no es trabajo que marcar, es algo que comprobar de un
// vistazo. Nunca aparece vacío.
export function AntesDeEmpezar({ requisitos }: { requisitos: string[] }) {
  return (
    <section className="rounded-xl border border-noct-divider bg-noct-surface px-3.5 py-3">
      <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-300">
        <ListChecks size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
        Requisitos
      </h2>
      <p className="mt-0.5 text-[12.5px] leading-snug text-noct-neutral-400">
        Ten esto listo antes de empezar.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {requisitos.map((requisito, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-snug text-noct-text">
            <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-noct-neutral-400" />
            <span className="min-w-0">{requisito}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// QUÉ CLASE DE TRABAJO ES ESTA ACCIÓN (encargo del 2026-09-22, sección
// 4). Una palabra y un icono, siempre los dos: azul para la acción
// (entrar, abrir, seleccionar), verde para la comprobación y neutro para
// la decisión. Una acción ya hecha lo dice en verde, con su marca.
function EtiquetaDeAccion({ tipoTarea, hecha }: { tipoTarea: string | null; hecha: boolean }) {
  if (hecha) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-exito">
        <Check size={13} className="shrink-0" aria-hidden />
        Hecha
      </p>
    )
  }
  if (tipoTarea === 'verificacion') {
    return (
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-exito">
        <SealCheck size={13} className="shrink-0" aria-hidden />
        Comprueba
      </p>
    )
  }
  if (tipoTarea === 'decision') {
    return (
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-300">
        <Question size={13} className="shrink-0" aria-hidden />
        Decide
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-accion">
      <CursorClick size={13} className="shrink-0" aria-hidden />
      Qué hacer
    </p>
  )
}

// UN RIESGO REAL (precaución o importante), antes de la instrucción. Con
// sus cuatro señales, ninguna solo de color (regla R16): icono, palabra,
// barra lateral y fondo.
function AlertaDeRiesgo({ aviso }: { aviso: BloquePaso }) {
  const tono = tonoInfo(aviso.tono)
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-r-[10px] border-l-[3px] px-3.5 py-3 ${tono.claseBarra} ${tono.claseFondo}`}
    >
      <tono.Icono size={21} className={`mt-0.5 shrink-0 ${tono.claseIcono}`} aria-hidden />
      <p className="min-w-0 text-[15.5px] leading-[1.45] text-pretty">
        <span className={`font-semibold ${tono.claseIcono}`}>{tono.etiqueta}.</span> {aviso.texto || 'Aviso sin texto'}
      </p>
    </div>
  )
}

// UN DATO TÉCNICO que hace falta para la acción: a la vista, sin color de
// alerta, para que no compita con los riesgos.
function DatoTecnico({ aviso }: { aviso: BloquePaso }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg bg-noct-text/[.05] px-3 py-2.5 text-[15px] leading-snug text-noct-text">
      <Code size={17} className="mt-0.5 shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0 [overflow-wrap:anywhere]">{aviso.texto || 'Dato sin texto'}</span>
    </p>
  )
}

// Una información o un consejo, ya dentro de "Más información": con su
// palabra, sin fondo de color.
function NotaPlegada({ aviso }: { aviso: BloquePaso }) {
  const tono = tonoInfo(aviso.tono)
  return (
    <p className="flex items-start gap-2 text-[14px] leading-normal text-noct-neutral-200">
      <tono.Icono size={15} className="mt-[3px] shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium text-noct-neutral-400">{tono.etiqueta}. </span>
        {aviso.texto}
      </span>
    </p>
  )
}

// "MÁS INFORMACIÓN": el sitio de lo que ayuda a entender la acción sin
// ser necesario para hacerla. Cerrado por defecto.
function MasInformacion({
  abierta,
  onAlternar,
  children,
}: {
  abierta: boolean
  onAlternar: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={abierta}
        onClick={onAlternar}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[14px] font-medium text-noct-neutral-300 hover:text-noct-text"
      >
        <Info size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
        {abierta ? 'Menos información' : 'Más información'}
        <CaretDown size={13} className={`shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {abierta && <div className="mt-1.5 flex flex-col gap-3 border-l-2 border-noct-divider pl-3">{children}</div>}
    </div>
  )
}

export type { TareaFoco }
