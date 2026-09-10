import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import {
  BookOpen,
  Camera,
  CaretLeft,
  Check,
  Info,
  LockSimple,
  Paperclip,
  SealCheck,
  Signpost,
  Warning,
} from '../../components/iconos'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { ChipReferencia } from '../referencia/ChipReferencia'
import { TarjetaComando } from '../referencia/TarjetaComando'
import { bloquesUnicos, tipoEfectivo } from '../referencia/referencias'
import { useReferencias } from '../referencia/useReferencias'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import { apoyosDelPaso, apoyosDeTarea, cuentaApoyos, hayApoyos, type Apoyos } from './apoyosTarea'
import { motivoGuiasPendientes } from './guiasObligatorias'
import { accionFoco, tareaFocoHecha, tareasParaFoco, type TareaFoco } from './tareasFoco'
import { tonoInfo } from './tonos'

// MODO FOCO: una tarea a la vez (handoff "Diseño móvil", tablero 6d).
//
// Es la oportunidad grande que señala el Paso 6: todo el sistema está
// construido alrededor del PASO (la banda, el avance, el plegado, la
// acción dominante), pero frente al equipo, con una mano y guantes, la
// unidad real de trabajo es la TAREA ("desconecta el uplink del puerto
// 24").
//
// DESDE LA TAREA 217 ESTA VISTA ES LA EJECUCIÓN, no un modo opcional.
//
// LO QUE CAMBIA EL 2026-09-09 (informe del 8 de septiembre). Tres
// defectos confirmados vivían aquí, y los tres eran el mismo error de
// fondo: la vista no sabía a qué TAREA pertenecía cada cosa, así que
// se lo daba todo a todas.
//
//   - H04 (criterios A04, A05). `paso.bloques.filter(aviso)` y
//     `filter(imagen)` se pintaban en TODAS las tareas, y la galería
//     del paso salía como un botón "Archivo" en cada una. En el paso
//     de tres tareas del informe, la misma precaución aparecía al
//     escribir la dirección, al confirmar y al comprobar. Ahora los
//     apoyos se reparten por `alcance`/`tareaId` (ver apoyosTarea.ts):
//     los de la tarea van con ella; los del paso se muestran UNA vez,
//     al entrar, y quedan consultables desde un control propio.
//   - H05 (criterios A09, A10). La guía vinculada del paso no se
//     mostraba en ningún sitio: solo había un botón apagado con
//     "Termina el procedimiento vinculado para poder avanzar". Ahora
//     es la PRIMERA tarea del recorrido y se abre aquí mismo.
//   - H07, H08 (criterio A13). "Marcar hecha" era el único rótulo, y
//     las flechas movían sin decir que no marcaban nada. Ahora la
//     acción dice qué tipo de tarea cierra ("Comprobado" en una
//     verificación) y las flechas se anuncian como consulta.

interface Props {
  paso: PasoProcedimiento
  tituloPaso: string
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
  // AVISOS CONFIRMADOS EN ESTA EJECUCION (encargo del 2026-09-10,
  // tarea 1). Vive arriba, en `AsistenteVista`, y no en el avance
  // guardado, por dos razones: confirmar un aviso no es trabajo hecho
  // (no puede contar como tarea) y la confirmacion caduca con la
  // ejecucion, asi que repetir la guia vuelve a mostrarlo. Al vivir
  // arriba, cambiar de paso y volver dentro de la MISMA ejecucion no
  // pide confirmarlo otra vez.
  avisosConfirmados: ReadonlySet<string>
  onConfirmarAviso: (avisoId: string) => void
  onAlternarTarea: (tareaId: string) => void
  // Cierra el paso y avanza. Es la misma acción dominante de la vista
  // completa: el foco no decide cuándo se puede, solo la ofrece.
  onCompletarPaso: () => void
  // Rótulo de esa acción ("Completar paso y continuar", "Faltan 2
  // tareas", "Completa «X»"), resuelto arriba con `cierreDelPaso` para
  // que las tres vistas digan exactamente lo mismo. El rótulo YA dice
  // lo que falta: por eso no hay una segunda línea repitiéndolo.
  etiquetaAvance: string
  // ¿El paso puede cerrarse ya? Misma regla para todos los controles de
  // finalización (tarea 3 del encargo).
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

export function ModoFoco({
  paso,
  tituloPaso,
  instruccionesHechas,
  subSatisfecho,
  guiaDelPasoDisponible = true,
  anidado = false,
  avisosConfirmados,
  onConfirmarAviso,
  onAlternarTarea,
  onCompletarPaso,
  etiquetaAvance,
  puedeCerrarPaso,
  onFalla,
  onDecisionResuelta,
  guiasPendientes,
  tituloGuiaPrincipal = '',
  onVinculoCompletado,
  renderTarjetaGuia,
  renderGuia,
}: Props) {
  const tareas = tareasParaFoco(paso, tituloPaso)
  // Los avisos del paso YA son elementos del recorrido: dejarlos
  // tambien en el panel "Información del paso" seria enseñar el mismo
  // bloque dos veces en la misma pantalla.
  const delPaso: Apoyos = { ...apoyosDelPaso(paso), avisos: [] }
  const hayApoyosDelPaso = hayApoyos(delPaso)

  function cumplida(tarea: TareaFoco): boolean {
    return tareaFocoHecha(tarea, instruccionesHechas, subSatisfecho, avisosConfirmados)
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

  // El siguiente elemento sin cumplir, mirando primero HACIA ADELANTE:
  // marcar una tarea no puede devolver al tecnico a un aviso que dejo
  // atras con las flechas. Si delante no queda nada, se vuelve al que
  // siga pendiente donde sea.
  function siguientePendiente(desde: number): number {
    const adelante = tareas.findIndex((t, i) => i > desde && !cumplida(t))
    if (adelante >= 0) return adelante
    return tareas.findIndex((t, i) => i !== desde && !cumplida(t))
  }

  const [indiceTarea, setIndiceTarea] = useState(primeraPendiente)
  // Qué panel está desplegado. Los apoyos siguen a mano pero no ocupan
  // la pantalla: lo que se lee de brazo estirado es la instrucción.
  //
  // UN SOLO CONTENEDOR PARA LOS APOYOS DEL PASO. Antes había dos: los
  // avisos del paso se pintaban SUELTOS al entrar y el control "Del
  // paso" los pintaba OTRA VEZ dentro de su panel, así que pulsarlo no
  // ocultaba nada: la información desaparecía de arriba y reaparecía
  // debajo, y cerrarla la devolvía arriba. Ahora hay un único sitio, el
  // panel, que al entrar al paso llega abierto y se cierra de verdad.
  const [panel, setPanel] = useState<'clave' | 'fotos' | 'archivos' | 'paso' | null>(() =>
    hayApoyosDelPaso && tareas[primeraPendiente()]?.clase === 'tarea' ? 'paso' : null,
  )
  // Id de la tarea de decisión cuyo "No" está abierto. Se guarda el id
  // y no un booleano porque un paso puede tener más de una decisión, y
  // un booleano las abriría todas a la vez.
  const [decisionAbierta, setDecisionAbierta] = useState<string | null>(null)
  // LA GUÍA VINCULADA QUE OCUPA AHORA EL SITIO DE LA TAREA (encargo del
  // 2026-09-10, tarea 4). Antes se desplegaba DEBAJO: dos guías en una
  // pantalla, con dos zonas de acciones y una página que no acababa.
  // Ahora sustituye el contenido de la tarea mientras dure, y salir
  // devuelve al mismo punto con el vínculo como estaba.
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
  // mirando "Guía completada" con la tarea siguiente escondida detrás
  // de una flecha: el único gesto que ya no puede hacer (marcar) es
  // justo el que movía el recorrido. Solo se avanza en la TRANSICIÓN de
  // pendiente a cumplida, así que volver luego a mirarla no expulsa a
  // nadie de su sitio.
  const guiaCumplidaAntes = useRef(subSatisfecho)
  useEffect(() => {
    const eraPendiente = !guiaCumplidaAntes.current
    guiaCumplidaAntes.current = subSatisfecho
    if (!subSatisfecho || !eraPendiente || !guiaDelPasoDisponible) return
    const actual = Math.min(indiceTarea, tareas.length - 1)
    if (tareas[actual]?.clase !== 'guia-del-paso') return
    const siguiente = tareas.findIndex(
      (t, i) =>
        i !== actual && !tareaFocoHecha(t, instruccionesHechas, subSatisfecho, avisosConfirmados),
    )
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }, [
    subSatisfecho,
    guiaDelPasoDisponible,
    indiceTarea,
    tareas,
    instruccionesHechas,
    avisosConfirmados,
  ])

  const indice = Math.min(indiceTarea, tareas.length - 1)

  // EL PANEL ES DE LA TAREA QUE SE ESTA MIRANDO, no del paso entero.
  //
  // Dejarlo abierto y pulsar la flecha lo arrastraba a la tarea
  // siguiente: sus fotos, su archivo o su clave aparecian desplegados
  // sin que nadie los pidiera, y el contenido que se veia era el de la
  // tarea anterior. Vale para los cuatro controles, y para cualquier
  // motivo del cambio: las flechas, marcar una tarea o terminar la guia
  // vinculada, que mueven `indiceTarea` por su cuenta.
  //
  // Se cierra AQUI, durante el render en el que cambia la tarea, y no
  // en un efecto: un efecto corre despues de pintar, asi que el
  // contenido de la tarea anterior alcanzaria a verse un instante.
  const tareaMostrada = useRef(indice)
  if (tareaMostrada.current !== indice) {
    tareaMostrada.current = indice
    if (panel !== null) setPanel(null)
    // El vínculo pertenece a la tarea que lo pide: cambiar de tarea lo
    // cierra, igual que cierra su panel de apoyos.
    if (vinculoAbierto !== null) setVinculoAbierto(null)
    if (decisionAbierta !== null) setDecisionAbierta(null)
  }

  // ARRIBA DEL TODO Y CON EL FOCO EN EL ENCABEZADO, cada vez que cambia
  // lo que está en pantalla: al pasar de tarea, al completar una y al
  // volver de un vínculo (encargo del 2026-09-10, tarea 4). Sin esto se
  // llegaba a la tarea siguiente por la mitad, con el desplazamiento
  // que había dejado la anterior.
  useEffect(() => {
    subirElContenedor(encabezado.current)
    encabezado.current?.focus({ preventScroll: true })
  }, [indice, vinculoAbierto])

  const tarea = tareas[indice]
  if (!tarea) return null

  const esAviso = tarea.clase === 'aviso' && tarea.aviso !== null
  const hecha = cumplida(tarea)
  const hechas = tareas.filter(cumplida).length
  // Los avisos ya no acompañan a la tarea: tienen su propio turno, asi
  // que se sacan de los apoyos para no pintarlos dos veces.
  const apoyosCrudos: Apoyos =
    tarea.clase === 'tarea' ? apoyosDeTarea(paso, tarea.id) : { ...apoyosDelPaso(paso), adjuntosPaso: [] }
  const apoyos: Apoyos = { ...apoyosCrudos, avisos: [] }
  const vinculoProtegido = apoyos.vinculoProtegido ?? tarea.vinculoProtegido
  const accion = accionFoco(tareas, instruccionesHechas, subSatisfecho, avisosConfirmados)
  const cierraPaso = accion === 'completar'
  // LA CUENTA VISIBLE SIGUE SIENDO DE TAREAS. Un aviso ocupa un turno
  // del recorrido pero no es trabajo: contarlo diria "Tarea 2 de 5" en
  // un paso de tres tareas.
  const totalTareas = tareas.filter((t) => t.clase !== 'aviso').length
  const numeroTarea = tareas.slice(0, indice + 1).filter((t) => t.clase !== 'aviso').length
  const esVerificacion = tarea.tipoTarea === 'verificacion'
  // UNA DECISIÓN NO ES UNA ACCIÓN (encargo del 2026-09-09, secciones 5
  // y 6). Hasta hoy este modo, que es LA ejecución desde la tarea 217,
  // pintaba una decisión igual que una instrucción: el mismo "Marcar
  // hecha" y ninguna de sus dos respuestas. El destino del "No", que el
  // editor sí deja configurar y la vista completa sí ofrece, no existía
  // aquí, así que marcarla equivalía a responder "sí" en silencio.
  const esDecision = tarea.tipoTarea === 'decision'
  // UNA SOLA ZONA DE ACCIONES DOMINANTE. Mientras la guía vinculada
  // ocupa la pantalla, la suya es la que manda: este pie desaparece
  // entero (cartel, flechas y «Falla»), y vuelve al salir del vínculo o
  // al terminarlo. Es el "oculta las acciones de la tarea principal"
  // del encargo del 2026-09-10.
  const pieCedidoAlVinculo = vinculoAbierto !== null
  const destinoDelNo = esDecision ? tarea.decisionGuiaId : null
  const noAbierto = esDecision && decisionAbierta === tarea.id
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
  // no se puede marcar: es lo que hacía que la palabra "necesario" del
  // editor no significara nada en la ejecución.
  const pendientes = tarea.clase === 'tarea' ? guiasPendientes(tarea.id) : []
  const motivoGuias = motivoGuiasPendientes(pendientes)
  // Guías de consulta y contingencia asignadas a esta tarea: apoyo, no
  // prerrequisito, así que van entre los apoyos y nunca bloquean.
  const guiasDeApoyo = apoyos.guias.filter((g) => g.intencionGuia !== 'necesario')
  // Los TÉRMINOS del glosario vinculados a esta tarea. Los atajos y los
  // comandos no entran aquí: se presentan enteros dentro de la tarea,
  // con las teclas o el comando delante.
  const referenciasDeLaTarea = bloquesUnicos(apoyos.referencias).map((bloque) => ({
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
  const terminos = referenciasDeLaTarea.filter((r) => r.tipo === 'termino').map((r) => r.bloque)
  // Un atajo o un comando SE USA en el momento, no se consulta: va
  // entero y a la vista, no detrás de una etiqueta que haya que abrir
  // con el teclado en una mano y el equipo en la otra.
  const atajosYComandos = referenciasDeLaTarea
    .filter((r) => r.tipo === 'atajo' || r.tipo === 'comando')
    .map((r) => r.bloque)

  // El motivo de la guía vinculada, en las palabras del autor: el
  // título del paso del que sale y su objetivo, si lo escribió. Se
  // omite cuando el paso no tiene título propio, porque entonces
  // `tituloPaso` cae en el nombre de la propia guía y la frase se
  // volvería un espejo ("completa X porque X").
  const motivoGuiaDelPaso =
    tarea.clase === 'guia-del-paso'
      ? [
          paso.titulo ? `El paso «${paso.titulo}» depende de ella.` : null,
          paso.objetivo || null,
        ]
          .filter(Boolean)
          .join(' ')
      : ''

  // COMPLETAR Y AVANZAR SON UN SOLO GESTO (encargo del 2026-09-10,
  // tarea 5). Había dos controles que parecían servir para continuar,
  // "Marcar hecha" y la flecha derecha, y solo uno registraba el
  // trabajo: con la flecha se recorría el paso entero sin marcar nada,
  // el cierre aparecía bloqueado al final y había que volver hacia
  // atrás tarea por tarea. La flecha se retira y el botón grande hace
  // las dos cosas.
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

  // Seguir SIN tocar nada, desde una tarea que ya estaba cumplida (se
  // llegó a ella con "Ver la anterior"). Es la única forma de volver
  // hacia adelante ahora que no hay flecha derecha, y no registra nada.
  function continuarSinMarcar() {
    const pendiente = siguientePendiente(indice)
    if (pendiente >= 0) setIndiceTarea(pendiente)
    else if (indice + 1 < tareas.length) setIndiceTarea(indice + 1)
  }

  // CONFIRMAR UN AVISO DEJA PASAR, NO MARCA TRABAJO. La confirmación se
  // guarda arriba (por ejecución) y el recorrido avanza al elemento
  // siguiente, que es lo que el aviso estaba reteniendo.
  function confirmarAviso() {
    onConfirmarAviso(tarea.id)
    if (indice + 1 < tareas.length) setIndiceTarea(indice + 1)
  }

  // TERMINAR EL VÍNCULO DEVUELVE AL PUNTO EXACTO. Se cierra la guía y
  // se sigue con el recorrido donde estaba: si la tarea ya quedó
  // cumplida con eso, en la siguiente pendiente; si no (una consulta),
  // en la misma tarea. El efecto de más arriba se encarga del
  // desplazamiento y del foco.
  function cerrarVinculo() {
    setVinculoAbierto(null)
    // Salir del destino de un "no" deshace la respuesta: quien vuelve
    // sin terminarlo todavía no ha resuelto nada, así que la pregunta
    // vuelve a ofrecer sus dos salidas.
    setDecisionAbierta(null)
  }

  // EL RÓTULO DICE LAS DOS COSAS QUE HACE (encargo del 2026-09-10,
  // tarea 5): registra la tarea Y trae la siguiente. Una comprobación
  // no se "hace": se comprueba (H08).
  const etiquetaPrincipal = esVerificacion ? 'Sí, lo comprobé · continuar' : 'Hecho · continuar'

  // Responder que sí es seguir por la vía prevista: marca y avanza,
  // igual que cualquier tarea cumplida.
  function responderSi() {
    setDecisionAbierta(null)
    completarYContinuar()
  }

  // Responder que no abre el destino si lo hay. Sin destino, la
  // decisión se registra igual y el flujo sigue: es la misma salida que
  // ofrece la vista completa, y no dejar salida sería obligar a mentir.
  //
  // El destino del "no" es el TRABAJO que toca ahora, así que ocupa la
  // pantalla como cualquier otra guía vinculada, en vez de desplegarse
  // debajo de la pregunta.
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
  // 2026-09-10, tarea 4). Ni una página larga con las dos guías, ni una
  // pantalla nueva que saque al técnico de la ejecución: el mismo sitio,
  // con una cabecera compacta que dice qué está haciendo y para qué, y
  // una salida que devuelve al punto exacto con el vínculo como estaba.
  if (vinculoAbierto) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-none flex-col gap-2.5 border-b border-noct-divider pb-3 pt-1">
          <h2
            ref={encabezado}
            tabIndex={-1}
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
            // TERMINARLA DEVUELVE AL PUNTO EXACTO. Se cierra el
            // vinculo y se avisa arriba, que es quien revisa si con eso
            // el paso ya se puede cerrar. El recorrido se queda donde
            // estaba: si la tarea sigue pendiente (la guia era su
            // requisito, pero marcarla es otro gesto) vuelve a ella; si
            // ya quedo cumplida, el efecto de mas arriba pasa a la
            // siguiente pendiente. En los dos casos, desde arriba.
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

  return (
    <div className="flex flex-1 flex-col">
      {/* Un segmento por TAREA del paso, no por paso. */}
      {!tarea.esPasoEntero && (
        <IndicadorAvance
          hechos={hechas}
          total={tareas.length}
          variante="segmentos"
          expandido
          actual={indice}
          className="flex-none"
        />
      )}

      <div className="flex flex-1 flex-col justify-center gap-[22px] py-7">
        {esAviso && tarea.aviso ? (
          // EL AVISO OCUPA LA PANTALLA ENTERA, sin la tarea siguiente
          // debajo: es el turno del recorrido en el que solo hay que
          // leer.
          <AvisoDelRecorrido aviso={tarea.aviso} confirmado={hecha} refEncabezado={encabezado} />
        ) : (
          <>
        {!tarea.esPasoEntero && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full bg-noct-accent/[.18] px-3.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
              <Check size={14} aria-hidden />
              Tarea {numeroTarea} de {totalTareas}
            </span>
            {/* La palabra del tipo, además del color (regla R16). Una
                comprobación se anuncia como tal ANTES de leerla, para
                que el técnico sepa que ahí se mira, no se ejecuta. */}
            {esVerificacion && (
              <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-noct-exito/45 bg-noct-exito/10 px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-exito">
                <SealCheck size={14} aria-hidden />
                Comprobación
              </span>
            )}
            {/* La palabra "Decisión", además de los dos botones: quien
                mira la pantalla de lejos tiene que saber que ahí se
                elige, no se ejecuta (regla R16, estado en dos canales). */}
            {esDecision && (
              <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-noct-accent/45 bg-noct-accent/10 px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
                <Signpost size={14} aria-hidden />
                Decisión
              </span>
            )}
            {tarea.clase === 'guia-del-paso' && (
              <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-noct-divider px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-300">
                <BookOpen size={14} aria-hidden />
                Otra guía
              </span>
            )}
            {/* EL ESTADO DE UNA TAREA YA CUMPLIDA, junto a su número
                (encargo del 2026-09-10, tarea 5). "Desmarcar" bajó al
                pie, como control secundario: era un botón dentro de la
                fila de pastillas y competía con la acción dominante. */}
            {hecha && tarea.clase === 'tarea' && (
              <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-noct-exito/45 bg-noct-exito/10 px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-exito">
                <Check size={14} aria-hidden />
                Completada
              </span>
            )}
          </div>
        )}

        {/* 30 px: es lo que se lee de brazo estirado, a pleno sol, con
            el teléfono apoyado en el rack. */}
        {/* En la entrada de guía vinculada el titular NO repite el
            nombre de la guía: ese nombre ya lo lleva la fila de abajo,
            junto a su avance. El titular dice qué hay que hacer, que es
            lo que un técnico que abre la guía por primera vez necesita
            leer (hallazgo H06: hasta ahora la única forma de llegar a
            la guía vinculada era un camino oculto). */}
        <h2
          ref={encabezado}
          tabIndex={-1}
          className={`text-[30px] font-medium leading-[1.25] tracking-[-.015em] text-pretty outline-none ${
            hecha ? 'text-noct-neutral-400' : 'text-noct-text'
          }`}
        >
          {tarea.clase === 'guia-del-paso'
            ? !guiaDelPasoDisponible
              ? 'Esta guía no está disponible'
              : hecha
                ? 'Guía completada'
                : 'Primero, completa esta guía'
            : tarea.texto || 'Tarea sin texto'}
        </h2>

        {/* POR QUÉ ESTÁS HACIENDO ESTA GUÍA (encargo del 2026-09-09,
            sección 4). El titular dice qué hacer y la fila de abajo dice
            cuál es la guía, pero el MOTIVO se perdía: en el modo de una
            tarea a la vez el título del paso solo vive en la cabecera
            compacta, detrás del contador "1/2", así que el técnico veía
            "Primero, completa esta guía" sin saber para qué. El motivo
            es el paso del que sale, y es lo que evita que la guía
            vinculada parezca un desvío arbitrario. */}
        {motivoGuiaDelPaso && (
          <p className="-mt-3 text-[15.5px] leading-snug text-noct-neutral-300 text-pretty">
            {motivoGuiaDelPaso}
          </p>
        )}

        {/* Los avisos de esta tarea ya no cuelgan de ella: son el
            elemento del recorrido que viene JUSTO ANTES (encargo del
            2026-09-10, tarea 1). Un aviso que comparte pantalla con la
            instrucción y con un botón de 76 px no advierte. */}

        {/* LOS TÉRMINOS DE ESTA TAREA, COMO ETIQUETAS DISCRETAS.
            Debajo de la instrucción y en una sola fila: no compiten con
            el titular de 30 px y se tocan para leer la definición sin
            salir de la guía ni tocar el avance. El mismo término
            vinculado dos veces a la misma tarea sale UNA sola vez
            (`bloquesUnicos`). */}
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

        {/* ATAJOS Y COMANDOS DE ESTA TAREA. No ejecutan nada, no
            marcan la tarea y no cuentan para cerrar el paso: su id no
            es el de un bloque 'tarea', así que no entra en el avance
            guardado. El comando trae "Copiar" con su confirmación
            dentro del propio bloque. */}
        {atajosYComandos.map((bloque) => (
          <TarjetaComando
            key={bloque.id}
            referencia={referenciasVivas.get(bloque.referenciaId as string)}
            tituloRespaldo={bloque.referenciaTitulo}
          />
        ))}

        {/* LA GUÍA VINCULADA, COMO TARJETA COMPACTA (encargo del
            2026-09-10, tarea 4). Antes se desplegaba entera debajo de
            la tarea: dos guías en una pantalla y una página que no
            acababa. Ahora la tarjeta dice qué papel juega, el nombre
            completo y en qué va; abrirla sustituye esta pantalla. */}
        {guiasDeLaTarea.map((g) => (
          <div key={g.clave}>
            {renderTarjetaGuia({
              guiaId: g.id,
              tituloReferencia: g.titulo,
              obligatoria: true,
              onAbrir: () =>
                setVinculoAbierto({ guiaId: g.id, titulo: g.titulo, obligatoria: true }),
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

        <ChipsApoyo
          apoyos={apoyos}
          delPaso={delPaso}
          conVinculoProtegido={Boolean(vinculoProtegido)}
          // El chip está SIEMPRE que haya algo del paso: es el único
          // control que abre y cierra ese contenido, incluso en la
          // primera tarea, donde llega abierto.
          mostrarChipDelPaso={hayApoyosDelPaso && tarea.clase === 'tarea'}
          panel={panel}
          onPanel={(p) => setPanel(panel === p ? null : p)}
        />

        {panel === 'clave' && vinculoProtegido && <CredencialEnPaso vinculo={vinculoProtegido} />}
        {panel === 'fotos' &&
          apoyos.imagenes.map((imagen) => (
            <BloqueVista key={imagen.id} bloque={imagen} marcada={false} onAlternar={() => {}} />
          ))}
        {panel === 'archivos' && (
          <AdjuntosPaso
            adjuntos={apoyos.archivos.flatMap((a) => (a.adjunto ? [a.adjunto] : []))}
            titulo={paso.titulo}
          />
        )}
        {panel === 'paso' && <ApoyosDelPasoPanel apoyos={delPaso} titulo={paso.titulo} />}
          </>
        )}
      </div>

      {/* Acción dominante de 76 px: es el ÚNICO elemento grande de la
          pantalla, así que no hay que apuntar. */}
      {!pieCedidoAlVinculo && (
      <div
        // OPACA Y CON BORDE, no un degradado (encargo del 2026-09-10,
        // tarea 4). El degradado dejaba el texto a medio leer detras de
        // su mitad transparente: una instruccion medio escondida es una
        // instruccion perdida. Es `sticky`, asi que ademas reserva su
        // propio hueco en el flujo y no tapa el final del contenido.
        className={`sticky bottom-0 z-10 mt-auto flex flex-none flex-col gap-2.5 border-t border-noct-divider bg-noct-bg pt-3 ${
          anidado ? 'pb-3' : '-mx-4 px-4 pb-[calc(12px+env(safe-area-inset-bottom))]'
        }`}
      >
        {/* QUÉ GUÍA FALTA, con su nombre. Sin esto el botón apagado no
            dice por qué, que es el defecto que el encargo llama "no se
            muestra cuál guía falta completar". */}
        {!esAviso && !cierraPaso && !hecha && motivoGuias && (
          <p className="text-center text-[11.5px] text-noct-precaucion">{motivoGuias}</p>
        )}
        {esAviso && tarea.aviso ? (
          // CONFIRMAR, NO MARCAR. El rótulo dice lo que el aviso pide:
          // una precaución o algo importante se dan por ENTENDIDOS antes
          // de seguir; una información normal solo se continúa. Y el
          // botón no lleva el verde de "hecha": confirmar no completa
          // trabajo.
          <button
            type="button"
            onClick={confirmarAviso}
            className="flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] text-xl font-semibold text-noct-accent-300 active:bg-noct-accent/[.34]"
          >
            <Check size={26} className="shrink-0" aria-hidden />
            {etiquetaAviso(tarea.aviso)}
          </button>
        ) : cierraPaso ? (
          <button
            type="button"
            disabled={!puedeCerrarPaso}
            onClick={onCompletarPaso}
            className="flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] text-xl font-semibold text-noct-accent-300 active:bg-noct-accent/[.34] disabled:opacity-30"
          >
            <Check size={26} className="shrink-0" aria-hidden />
            <span className="truncate">{etiquetaAvance}</span>
          </button>
        ) : tarea.clase === 'guia-del-paso' ? (
          // LA ACCIÓN DOMINANTE ES LA DE LA TARJETA ("Abrir guía" /
          // "Continuar guía"), así que aquí no va otra (encargo del
          // 2026-09-10, tarea 5: una sola acción dominante a la vez).
          // Antes había un cartel de 76 px con borde discontinuo que
          // ocupaba el sitio del botón sin ser uno.
          //
          // Solo hay pie propio en los dos casos en los que la tarjeta
          // no ofrece nada que hacer: la guía ya está completa, o no
          // está en este dispositivo y el vínculo no bloquea (A12).
          hecha || !guiaDelPasoDisponible ? (
            <button
              type="button"
              onClick={continuarSinMarcar}
              className="flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] text-xl font-semibold text-noct-accent-300 active:bg-noct-accent/[.34]"
            >
              <Check size={26} className="shrink-0" aria-hidden />
              Continuar
            </button>
          ) : (
            <p className="flex items-center justify-center gap-2 px-2 text-center text-[13px] leading-snug text-noct-neutral-400">
              <BookOpen size={16} className="shrink-0" aria-hidden />
              Esta tarea se cumple al terminar la guía de arriba
            </p>
          )
        ) : esDecision && !hecha && !noAbierto ? (
          // UNA DECISIÓN SE RESPONDE, NO SE MARCA (secciones 5 y 6). Las
          // dos respuestas, con su consecuencia escrita: el sí sigue por
          // la vía prevista y el no nombra a dónde lleva. Los mismos
          // colores que la vista completa (regla R60): acento la vía que
          // continúa, ámbar la que se desvía. Antes aquí había un
          // "Marcar hecha" idéntico al de una instrucción, así que las
          // dos respuestas eran el mismo gesto y el destino del no no
          // aparecía en ninguna parte de la pantalla.
          <div className="flex flex-col gap-2">
            {/* EL DESTINO, EN SU PROPIA LÍNEA. Iba dentro del botón
                ("No, abrir «Acceder al gestor de ejemplo»") y en 360 px
                se recortaba a «Acced…», que es justo lo contrario de
                "mostrar claramente el nombre de la guía vinculada". Aquí
                cabe entero y en dos líneas si hace falta. */}
            {destinoDelNo && (
              <p className="text-center text-[13px] leading-snug text-noct-neutral-300 text-pretty">
                Si respondes que no, se abre «{tarea.decisionGuiaTitulo || 'la salida'}»
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={responderSi}
                disabled={motivoGuias !== null}
                aria-label="Sí: seguir con la guía"
                className="flex h-[76px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] px-3 text-xl font-semibold text-noct-accent-300 active:bg-noct-accent/[.34] disabled:opacity-30"
              >
                <Check size={24} className="shrink-0" aria-hidden />
                Sí
              </button>
              <button
                type="button"
                onClick={responderNo}
                aria-label={
                  destinoDelNo
                    ? `No: abrir «${tarea.decisionGuiaTitulo || 'la salida'}»`
                    : 'No: registrar la respuesta y seguir'
                }
                className="flex h-[76px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-noct-precaucion/60 bg-noct-precaucion/[.12] px-3 text-xl font-semibold text-noct-precaucion active:bg-noct-precaucion/25"
              >
                <Warning size={22} className="shrink-0" aria-hidden />
                No
              </button>
            </div>
          </div>
        ) : hecha ? (
          // YA CUMPLIDA: se llegó aquí con "Ver la anterior". El estado
          // lo dice la pastilla "Completada" de arriba y el gesto que
          // queda es seguir; deshacerlo es secundario y vive abajo.
          <button
            type="button"
            onClick={continuarSinMarcar}
            className="flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] text-xl font-semibold text-noct-accent-300 active:bg-noct-accent/[.34]"
          >
            <Check size={26} className="shrink-0" aria-hidden />
            Continuar
          </button>
        ) : (
          <button
            type="button"
            onClick={completarYContinuar}
            disabled={motivoGuias !== null}
            className="flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] text-xl font-semibold text-noct-accent-300 active:bg-noct-accent/[.34] disabled:opacity-30"
          >
            <Check size={26} className="shrink-0" aria-hidden />
            <span className="truncate">{etiquetaPrincipal}</span>
          </button>
        )}
        {/* CONTROLES SECUNDARIOS. La flecha derecha se retiró (encargo
            del 2026-09-10, tarea 5): era el atajo que dejaba recorrer el
            paso entero sin registrar nada, y el cierre aparecía
            bloqueado al final. Queda solo el regreso, que consulta y no
            toca el avance. */}
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={indice === 0}
            onClick={() => setIndiceTarea(Math.max(0, indice - 1))}
            aria-label="Ver la tarea anterior. Solo mueve la vista, no cambia lo marcado"
            title="Ver la anterior"
            className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.08] disabled:opacity-30"
          >
            <CaretLeft size={20} aria-hidden />
          </button>
          {/* "Tengo un problema" abre las salidas del paso (la
              contingencia, la evidencia, saltar) SIN completar nada ni
              cambiar de tarea. Se llamaba "Falla", que nombra el estado
              y no lo que el técnico puede hacer, y en una comprobación
              cambiaba a "No se cumple": dos rótulos para el mismo
              control. En un aviso no se ofrece: todavía no hay nada
              hecho que pueda haber salido mal. */}
          {esAviso ? (
            <div className="min-w-0 flex-1" />
          ) : (
            <button
              type="button"
              onClick={() => onFalla(tarea.texto)}
              aria-haspopup="dialog"
              aria-label="Tengo un problema con esta tarea: ver las salidas"
              className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-noct-precaucion/55 bg-noct-precaucion/10 text-[15.5px] font-medium text-noct-precaucion hover:bg-noct-precaucion/[.2]"
            >
              <Warning size={19} className="shrink-0" aria-hidden />
              <span className="truncate">Tengo un problema</span>
            </button>
          )}
        </div>
        {/* Deshacer lo marcado: secundario y discreto, para corregirse
            sin que compita con la acción dominante. */}
        {hecha && tarea.clase === 'tarea' && (
          <button
            type="button"
            onClick={desmarcar}
            className="mx-auto flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.08]"
          >
            Desmarcar esta tarea
          </button>
        )}
      </div>
      )}
    </div>
  )
}

// Los chips de 52 px que despliegan un apoyo sin sacarlo de la
// pantalla. Solo se dibujan los que tienen algo detrás: un chip
// "Archivo" que no lleva a ningún archivo de esta tarea era justo el
// ruido que reportaba H04.
function ChipsApoyo({
  apoyos,
  delPaso,
  conVinculoProtegido,
  mostrarChipDelPaso,
  panel,
  onPanel,
}: {
  apoyos: Apoyos
  delPaso: Apoyos
  conVinculoProtegido: boolean
  mostrarChipDelPaso: boolean
  panel: string | null
  onPanel: (panel: 'clave' | 'fotos' | 'archivos' | 'paso') => void
}) {
  const fotos = apoyos.imagenes.length
  const archivos = apoyos.archivos.length
  if (!conVinculoProtegido && fotos === 0 && archivos === 0 && !mostrarChipDelPaso) return null
  const delPasoCuenta = cuentaApoyos(delPaso)

  return (
    <div className="flex flex-wrap gap-2">
      {conVinculoProtegido && (
        <ChipFoco Icono={LockSimple} activo={panel === 'clave'} onClick={() => onPanel('clave')}>
          Clave
        </ChipFoco>
      )}
      {fotos > 0 && (
        <ChipFoco Icono={Camera} activo={panel === 'fotos'} onClick={() => onPanel('fotos')}>
          {fotos === 1 ? 'Foto' : `${fotos} fotos`}
        </ChipFoco>
      )}
      {archivos > 0 && (
        <ChipFoco Icono={Paperclip} activo={panel === 'archivos'} onClick={() => onPanel('archivos')}>
          {archivos === 1 ? 'Archivo' : `${archivos} archivos`}
        </ChipFoco>
      )}
      {mostrarChipDelPaso && (
        // El rótulo dice lo que va a pasar al tocarlo, y con el panel
        // abierto dice "ocultar": antes decía siempre "Del paso (N)",
        // asi que el mismo texto servía para abrir y para cerrar.
        <ChipFoco Icono={Info} activo={panel === 'paso'} onClick={() => onPanel('paso')}>
          {panel === 'paso' ? 'Ocultar información del paso' : `Información del paso (${delPasoCuenta})`}
        </ChipFoco>
      )}
    </div>
  )
}

// Lo que acompaña al PASO completo, consultable desde cualquier tarea
// sin repetirse en todas ellas.
function ApoyosDelPasoPanel({ apoyos, titulo }: { apoyos: Apoyos; titulo: string }) {
  const archivos = [...apoyos.archivos.flatMap((a) => (a.adjunto ? [a.adjunto] : [])), ...apoyos.adjuntosPaso]
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-noct-divider bg-noct-surface/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        Apoyo de todo el paso
      </p>
      {/* Sin avisos: los del paso se leen una sola vez al principio del
          recorrido, con su propia pantalla. */}
      {apoyos.imagenes.map((imagen) => (
        <BloqueVista key={imagen.id} bloque={imagen} marcada={false} onAlternar={() => {}} />
      ))}
      {archivos.length > 0 && <AdjuntosPaso adjuntos={archivos} titulo={titulo} />}
      {apoyos.vinculoProtegido && <CredencialEnPaso vinculo={apoyos.vinculoProtegido} />}
    </div>
  )
}

// EL RÓTULO DEL BOTÓN QUE CIERRA UN AVISO. Una precaución y algo
// importante se dan por ENTENDIDOS antes de seguir; una información
// normal (también un consejo o un dato técnico) solo se continúa.
function etiquetaAviso(aviso: BloquePaso): string {
  return aviso.tono === 'precaucion' || aviso.tono === 'importante'
    ? 'Entendido · continuar'
    : 'Continuar'
}

// EL AVISO COMO ELEMENTO DEL RECORRIDO (encargo del 2026-09-10, tarea
// 1). Ocupa el área principal del modo foco, sin la tarea siguiente
// debajo: hasta ahora era una tira de color pegada a la instrucción, y
// competía con un titular de 30 px y un botón de 76.
//
// Conserva sus cuatro señales, y ninguna es solo el color (regla R16):
// el icono del tono, la palabra ("Información", "Precaución",
// "Importante"), la barra lateral y el fondo. Dice además de quién es,
// porque un aviso del paso no se lee igual que uno de la tarea que
// viene ahora.
function AvisoDelRecorrido({
  aviso,
  confirmado,
  refEncabezado,
}: {
  aviso: BloquePaso
  confirmado: boolean
  refEncabezado: RefObject<HTMLHeadingElement | null>
}) {
  const tono = tonoInfo(aviso.tono)
  const delPaso = aviso.alcance !== 'tarea'
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[11px] font-semibold uppercase tracking-[.06em] ${tono.clasesPanel} ${tono.claseIcono}`}
        >
          <tono.Icono size={15} aria-hidden />
          {tono.etiqueta}
        </span>
        <span className="inline-flex h-[34px] items-center rounded-full border border-noct-divider px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-300">
          {delPaso ? 'De todo el paso' : 'De la tarea que sigue'}
        </span>
        {/* Ya leído en esta ejecución: volver con las flechas no vuelve
            a exigir la confirmación, y la pantalla lo dice. */}
        {confirmado && (
          <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-noct-exito/45 bg-noct-exito/10 px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-exito">
            <Check size={14} aria-hidden />
            Confirmado
          </span>
        )}
      </div>
      <div
        className={`flex items-start gap-3.5 rounded-r-[10px] border-l-[3px] px-4 py-4 ${tono.claseBarra} ${tono.claseFondo}`}
      >
        <tono.Icono size={26} className={`mt-0.5 shrink-0 ${tono.claseIcono}`} aria-hidden />
        <h2
          ref={refEncabezado}
          tabIndex={-1}
          className="min-w-0 text-[19px] font-normal leading-[1.4] text-pretty outline-none"
        >
          <span className={`font-semibold ${tono.claseIcono}`}>{tono.etiqueta}.</span>{' '}
          {aviso.texto || 'Aviso sin texto'}
        </h2>
      </div>
    </div>
  )
}

// Chip de 52 px que despliega un apoyo sin sacarlo de la pantalla.
function ChipFoco({
  Icono,
  activo,
  onClick,
  children,
}: {
  Icono: typeof LockSimple
  activo: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-expanded={activo}
      onClick={onClick}
      className={`inline-flex h-[52px] items-center gap-2 rounded-[10px] border-[1.5px] px-4 text-[14.5px] font-medium ${
        activo
          ? 'border-noct-accent bg-noct-accent/[.16] text-noct-accent-300'
          : 'border-noct-divider bg-noct-surface text-noct-text hover:bg-noct-text/[.06]'
      }`}
    >
      <Icono size={19} className="shrink-0 text-noct-accent-300" aria-hidden />
      {children}
    </button>
  )
}

export type { TareaFoco }
