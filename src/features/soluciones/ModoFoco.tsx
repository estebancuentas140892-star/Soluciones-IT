import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { BloquePaso, PasoAdjunto, PasoProcedimiento } from '../../lib/db'
import type { Elecciones } from '../../lib/rutaProcedimiento'
import { mismoVinculoProtegido } from '../../lib/vinculoProtegido'
import { normalizarTexto } from './iconosSoluciones'
import { huecoAvisoActualizacion } from '../../components/ranuraAvisoActualizacion'
import { DatoTecnico, DebesVerPaso, DondeSeHacePaso } from './SenalesDePaso'
import {
  ArrowRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
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
import { apoyosDelPaso, apoyosDeTarea, sinApoyos, type Apoyos } from './apoyosTarea'
import { rotuloCompletaGuia, type CierrePaso } from './cierrePaso'
import { motivoGuiasPendientes } from './guiasObligatorias'
import {
  accionFoco,
  avisosDeTareaFoco,
  esDecisionConOpcionesFoco,
  esGuiaDelRecorrido,
  tareaFocoHecha,
  tareasParaFoco,
  type TareaFoco,
} from './tareasFoco'
import { RespuestasDecision } from './RespuestasDecision'
import { tonoInfo } from './tonos'
import { subirElContenedor } from './subirElContenedor'
import {
  hayApoyosDelFlujo,
  ROTULO_DEL_PASO,
  ROTULO_NECESARIO,
  rotuloDeIntencion,
  type ApoyosDelFlujo,
  type EnFlujo,
} from './flujoContinuo'
import { PasosEnLectura } from './PasosEnLectura'

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
//
// PROPUESTA FINAL DE CLAUDE DESIGN (2026-10-01). La pantalla responde
// "¿qué tengo que hacer ahora?" y la acción manda:
//
//   - Lo que orienta va en voz baja: "acción 2 de 2" y el título del
//     paso en una línea gris. Fuera el rótulo "PASO 3 DE 8" (lo dice el
//     contador "3/8" de la cabecera) y la ruta con el paso de antes y el
//     de después (en el teléfono; en escritorio sigue la horizontal).
//   - El botón dice la CONSECUENCIA: "Completar y seguir", "Completar y
//     terminar", "Ir al paso N", "Ir a la acción N"; si falta trabajo,
//     cuánto ("Falta 1 tarea") o qué guía ("Completa «X»"), inactivo y
//     legible. Hasta dos líneas: el verbo no se corta nunca y un nombre
//     largo se acorta dentro de las comillas (`rotuloCompletaGuia`).
//   - Un paso que no es el de trabajo, abierto desde el índice, se
//     CONSULTA: se lee entero, nada se marca y el botón devuelve al paso
//     de trabajo.
//
// JERARQUÍA DE UNA ACCIÓN (tarea 303, regla 27, AD-066). Una pantalla es
// una acción clara, y eso no significa meterlo todo en una caja: cada
// papel conserva su sitio y la pantalla hace evidente cuál manda.
//
//   1. Qué hacer: la instrucción, a 26 px. Es lo único que domina.
//   2. Dónde: orienta, neutro y en voz baja, separado de la acción.
//   3. El dato técnico que la acción necesita, pegado a la instrucción y
//      subordinado a ella: rótulo y monoespaciada, nunca otra orden.
//   4. Debes ver: la comprobación, en verde, después del trabajo.
//   5. Más información: lo que ayuda a entender sin hacer falta para
//      actuar, plegado. Si alguien nuevo tuviera que abrirlo para saber
//      cómo hacer la acción, ese contenido está mal clasificado.
//   6. La advertencia: solo un riesgo real, antes de actuar, en rojo. Es
//      el único bloque con fondo de color.

interface Props {
  paso: PasoProcedimiento
  tituloPaso: string
  // Dónde está este paso dentro del procedimiento ("Paso 3 de 12"). Sin
  // esto la acción de la pantalla no tenía contexto: el título del paso
  // solo vivía en el índice.
  numeroPaso: number
  // El total de pasos de la RUTA (tarea 302), o null mientras dependa de una
  // respuesta cuyos caminos no miden lo mismo: entonces no se dice "de M".
  totalPasos: number | null
  // ¿Cerrar este paso TERMINA la guía? Lo decide `AsistenteVista` con el
  // mismo cálculo que el avance (`avanzarDespuesDe`, que vuelve también a
  // un paso saltado): sin otro paso por hacer, la última acción dice
  // "Completar y terminar"; si no, "Completar y seguir".
  cierraLaGuia: boolean
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
  // ¿La guía que reutiliza el paso se hace AQUÍ, como acciones de este
  // paso (tarea 289, fase 3)? Lo resuelve `AsistenteVista` (ejecución
  // principal, guía en el dispositivo y con pasos). Si no, el paso la
  // ofrece para leerla aparte o explica que no está.
  guiaDelPasoIntegrada?: boolean
  // ¿Una guía que exige una TAREA de este paso se hace aquí, justo antes
  // de esa tarea (tarea 289, fase 3)? La misma pregunta que la anterior,
  // por guía. Sin ella (lo de dentro de otra guía), ninguna se hace aquí:
  // la tarea la sigue ofreciendo aparte.
  guiaIntegrable?: (guiaId: string) => boolean
  // ESTE FOCO ES PARTE DEL FLUJO DE OTRA GUÍA (tarea 289, fase 3): las
  // acciones de una guía reutilizada, hechas en el sitio del paso que la
  // reutiliza. No dice su propia numeración ("Paso 1 de 3"), porque la del
  // paso es la de la guía que se abrió; y el "Dónde" y el "Debes ver" de
  // ese paso acompañan a esta acción cuando el paso de dentro no trae los
  // suyos (solo llegan para la primera y la última acción reutilizada).
  // `apoyos` es lo que ese paso traía para su primera acción (su "para
  // qué", avisos, imágenes, credencial): llega solo con la primera.
  enFlujo?: { lugar: string; resultado: string; apoyos?: ApoyosDelFlujo | null } | null
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
  // Cierra el paso y avanza (o, en un paso hecho, navega). Es la misma
  // acción dominante de la vista completa: el foco no decide cuándo se
  // puede, solo la ofrece.
  onCompletarPaso: () => void
  // Qué puede hacer ahora el control que cierra el paso y cómo se llama
  // ("Completar y seguir", "Ir al paso 4", "Faltan 2 tareas",
  // "Completa «X»"), resuelto arriba con `cierreDelPaso` para que las
  // vistas digan exactamente lo mismo (tarea 3 del encargo del
  // 2026-09-09).
  cierre: CierrePaso
  // EL PASO SE ESTÁ CONSULTANDO (propuesta final de Claude Design,
  // 2026-10-01): no es el paso de trabajo y se abrió desde el índice o la
  // ruta. Se lee entero, nada se marca y el botón principal devuelve al
  // paso de trabajo ("Ir al paso N"). null fuera de la consulta.
  consulta?: { numeroPasoTrabajo: number; onVolver: () => void } | null
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
  // ¿Esta guía que se hace en el sitio ya terminó en esta ejecución? La
  // misma lectura en vivo que la anterior, por guía: decide si la entrada
  // de una guía del recorrido (la que exige una tarea o la que abre una
  // respuesta) está cumplida.
  guiaCumplida: (guiaId: string) => boolean
  // LAS RESPUESTAS DE ESTA EJECUCIÓN (tarea 302): qué opción se eligió en
  // cada decisión con opciones. Dicen qué respuesta se ve elegida y si la
  // elegida abre una guía que se hace aquí, justo después.
  elecciones?: Elecciones
  // Responder (o cambiar) una decisión con opciones. Lo escribe
  // `AsistenteVista` (esta vista no toca datos): guarda la respuesta y,
  // cuando la ruta la recoge, sigue por ella.
  onElegirOpcion: (decisionId: string, opcionId: string) => void
  // Hay algo hecho DESPUÉS de la decisión de este paso: cambiar la
  // respuesta lo reinicia, y se dice antes de tocar otra opción.
  avanceTrasLaDecision?: boolean
  // LA RUTA DEL PROCEDIMIENTO (encargo del 2026-09-22, sección 5). La
  // aporta `AsistenteVista`, que es quien tiene los estados de todos los
  // pasos. Cuando llega, ES la cabecera del paso: dice dónde se está
  // ("Paso 3 de 7" y el título), así que esta vista no lo repite.
  ruta?: ReactNode
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
    // Sin ella la tarjeta se lee pero no se abre: en la consulta, abrir
    // la guía sería empezar su trabajo.
    onAbrir?: () => void
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
    // Se ejecuta COMO PARTE DE ESTE FLUJO (tarea 289, fase 3): sin
    // cabecera ni numeración propias. Ver `flujoContinuo.ts`.
    enFlujo?: EnFlujo
  }) => ReactNode
  // ASISTENCIA REMOTA (tarea 258): con un computador conectado, la franja
  // "Equipo 482 731 · Enviar a este equipo" sobre los botones del pie. La
  // aporta `AsistenteVista` (solo en la guía principal); recibe la acción
  // a la vista para ofrecer "Solo esta acción". Sin conexión no pinta nada.
  renderEnvioAEquipo?: (tareaId: string | null) => ReactNode
}

// La guía vinculada que ocupa ahora mismo el sitio de la tarea.
interface VinculoAbierto {
  guiaId: string
  titulo: string
  obligatoria: boolean
  alCompletar?: () => void
  // Qué papel tiene lo abierto, dicho en la cabecera del desvío ("Si lo
  // necesitas", "Si esto falla"). Sin uso cuando va en el flujo.
  rotulo: string
  // El destino de un "No": es el camino que toca, así que sigue en el
  // flujo, sin cabecera ni regreso propios (tarea 289, fase 3).
  enFlujo?: boolean
}

function adjuntosDe(bloques: BloquePaso[]): PasoAdjunto[] {
  return bloques.flatMap((b) => (b.adjunto ? [b.adjunto] : []))
}

// Clases compartidas de los controles del pie. 64 px de alto: es lo que
// se toca sin mirar, de pie frente al equipo. Inactivo NO es transparente:
// el rótulo dice qué falta y tiene que leerse (borde y texto neutros).
const BOTON_PRINCIPAL =
  'flex h-16 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] px-3.5 text-[17px] font-semibold text-noct-accent-200 active:bg-noct-accent/[.3] disabled:border-noct-neutral-700 disabled:bg-noct-text/[.04] disabled:text-noct-neutral-400'
export const BOTON_ANTERIOR =
  'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.08] disabled:opacity-30'

// EL CONTROL GRANDE DEL PIE, con la gramática de la propuesta final: el
// icono y el rótulo dicen la consecuencia (la marca cierra, la flecha solo
// lleva). Hasta dos líneas, centradas; cuando el rótulo visible abrevia el
// nombre de una guía, el nombre accesible lo lleva entero.
export function BotonPrincipal({
  etiqueta,
  etiquetaCompleta,
  icono = null,
  onClick,
  disabled = false,
}: {
  etiqueta: string
  etiquetaCompleta?: string
  icono?: 'marca' | 'flecha' | null
  onClick?: () => void
  disabled?: boolean
}) {
  const abreviada = etiquetaCompleta !== undefined && etiquetaCompleta !== etiqueta
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={abreviada ? etiquetaCompleta : undefined}
      title={abreviada ? etiquetaCompleta : undefined}
      className={BOTON_PRINCIPAL}
    >
      {icono === 'marca' && <Check size={20} className="shrink-0" aria-hidden />}
      {icono === 'flecha' && <ArrowRight size={20} className="shrink-0" aria-hidden />}
      <span className="line-clamp-2 min-w-0 text-center leading-[1.25] [overflow-wrap:anywhere]">{etiqueta}</span>
    </button>
  )
}

// "acción 2 de 2": dónde está la acción dentro del paso, en voz baja. Un
// trazo por acción (hecha en acento, la que se ve un poco más clara) y la
// frase, que es lo que lee el lector de pantalla.
function AccionesDelPaso({ hechas, actual }: { hechas: boolean[]; actual: number }) {
  return (
    <p className="flex items-center gap-2 text-[12px] leading-snug text-noct-neutral-500">
      <span aria-hidden className="flex gap-[3px]">
        {hechas.map((hecha, i) => (
          <span
            key={i}
            className={`h-[3px] w-3.5 rounded-sm ${
              hecha ? 'bg-noct-accent-300' : i === actual ? 'bg-noct-neutral-500' : 'bg-noct-neutral-700'
            }`}
          />
        ))}
      </span>
      acción {actual + 1} de {hechas.length}
    </p>
  )
}

export function ModoFoco({
  paso,
  tituloPaso,
  numeroPaso,
  totalPasos,
  cierraLaGuia,
  instruccionesHechas,
  subSatisfecho,
  guiaDelPasoDisponible = true,
  guiaDelPasoIntegrada = false,
  guiaIntegrable,
  enFlujo = null,
  anidado = false,
  requisitos = [],
  entrarPorElFinal = false,
  onPasoAnterior,
  onAlternarTarea,
  onCompletarPaso,
  cierre,
  consulta = null,
  onFalla,
  onDecisionResuelta,
  guiasPendientes,
  guiaCumplida,
  elecciones,
  onElegirOpcion,
  avanceTrasLaDecision = false,
  ruta,
  onVinculoCompletado,
  renderTarjetaGuia,
  renderGuia,
  renderEnvioAEquipo,
}: Props) {
  const tareas = tareasParaFoco(paso, tituloPaso, guiaIntegrable, elecciones)

  // Una entrada de guía ('guia-de-tarea', 'guia-de-respuesta') está
  // cumplida cuando su guía terminó en esta ejecución: el avance es por
  // guía, no por tarea.
  function cumplida(tarea: TareaFoco): boolean {
    return tareaFocoHecha(tarea, instruccionesHechas, subSatisfecho, guiaCumplida)
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
  // LA RESPUESTA QUE SE ACABA DE TOCAR (tarea 302), mientras la ruta la
  // recoge: se ve elegida en el acto y las opciones no se pueden tocar dos
  // veces. Cuando llega, el recorrido sigue dentro del paso si le queda algo
  // (la guía de esa respuesta o una acción sin hacer); si no, la ejecución
  // cierra el paso y lleva al destino.
  const [respondiendo, setRespondiendo] = useState<{ decisionId: string; opcionId: string } | null>(null)
  // El encabezado con la pregunta da nombre al grupo de sus respuestas.
  const idPregunta = useId()
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

  const indice = Math.min(indiceTarea, tareas.length - 1)

  // LA RESPUESTA YA ESTÁ EN LA RUTA: lo siguiente es lo que quede por hacer
  // en este paso después de la decisión. Se decide aquí, en el mismo
  // render, como el resto de lo que cambia al moverse de acción.
  if (respondiendo !== null && elecciones?.[respondiendo.decisionId] === respondiendo.opcionId) {
    setRespondiendo(null)
    const desde = tareas.findIndex((t) => t.id === respondiendo.decisionId)
    const siguiente = desde >= 0 ? siguientePendiente(desde) : -1
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }

  // TERMINAR LA GUÍA QUE SE HACE EN EL SITIO ADELANTA SOLO, como marcar una
  // tarea: la del paso y, desde la tarea 289, la que exige una tarea, que
  // da paso a esa tarea.
  //
  // Sin esto el técnico completaba la guía de arriba y se quedaba
  // mirando "Guía completada" con la tarea siguiente escondida. Solo se
  // avanza en la TRANSICIÓN de pendiente a cumplida DE LA MISMA ENTRADA,
  // así que volver luego a mirarla, o moverse a otra ya cumplida, no
  // expulsa a nadie de su sitio.
  const entradaVista = tareas[indice] as TareaFoco | undefined
  const idGuiaVista = entradaVista && esGuiaDelRecorrido(entradaVista) ? entradaVista.id : null
  const guiaVistaCumplida = entradaVista && idGuiaVista !== null ? cumplida(entradaVista) : null
  // Una guía del paso que no está en el dispositivo cuenta como cumplida
  // para no bloquear, pero su explicación se lee antes de seguir (A12).
  const guiaVistaSeLee = entradaVista?.clase === 'guia-del-paso' && !guiaDelPasoDisponible
  const destinoTrasGuia = guiaVistaCumplida === true ? siguientePendiente(indice) : -1
  const guiaVistaAntes = useRef<{ id: string; cumplida: boolean } | null>(null)
  useEffect(() => {
    const antes = guiaVistaAntes.current
    guiaVistaAntes.current =
      idGuiaVista !== null && guiaVistaCumplida !== null ? { id: idGuiaVista, cumplida: guiaVistaCumplida } : null
    if (idGuiaVista === null || guiaVistaCumplida !== true || guiaVistaSeLee) return
    if (!antes || antes.id !== idGuiaVista || antes.cumplida) return
    if (destinoTrasGuia >= 0) setIndiceTarea(destinoTrasGuia)
  }, [idGuiaVista, guiaVistaCumplida, guiaVistaSeLee, destinoTrasGuia])

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
  const esPrimeraDelPaso = indice === 0
  const accion = accionFoco(tareas, instruccionesHechas, subSatisfecho, guiaCumplida)
  const cierraPaso = accion === 'completar'
  // UNA DECISIÓN NO ES UNA ACCIÓN (encargo del 2026-09-09, secciones 5
  // y 6): se responde con sus dos salidas, nunca con "Completar". La de
  // Sí/No, en el pie; la que tiene opciones con nombre (tarea 302), con sus
  // respuestas bajo la pregunta.
  const conOpciones = esDecisionConOpcionesFoco(tarea)
  const esDecision = tarea.tipoTarea === 'decision' && !conOpciones
  // La respuesta elegida: la que se está guardando, o la que ya se dio.
  const respuestaElegida =
    respondiendo?.decisionId === tarea.id
      ? respondiendo.opcionId
      : (tarea.opciones.find((opcion) => opcion.id === elecciones?.[tarea.id])?.id ?? null)
  // UNA SOLA ZONA DE ACCIONES DOMINANTE. Mientras la guía vinculada
  // ocupa la pantalla, la suya es la que manda y este pie desaparece.
  const pieCedidoAlVinculo = vinculoAbierto !== null
  const destinoDelNo = esDecision ? tarea.decisionGuiaId : null
  const noAbierto = esDecision && decisionAbierta === tarea.id

  // LO QUE EL PASO QUE REUTILIZA ESTA GUÍA TRAÍA PARA SU PRIMERA ACCIÓN
  // (tarea 289, fase 3): dentro del flujo de otra guía, la primera acción
  // reutilizada lo enseña junto a lo suyo, para que no se pierda. Solo
  // llega con la primera acción.
  const prestados = esPrimeraDelPaso ? (enFlujo?.apoyos ?? null) : null

  // LOS AVISOS DE ESTA ACCIÓN, repartidos por cómo se ven (ver
  // `avisosDeTareaFoco`): las alertas antes de la instrucción, los
  // datos a la vista y el resto plegado. Los prestados, primero: son las
  // condiciones de todo lo que sigue.
  const avisosPropios = avisosDeTareaFoco(paso, tareas, indice)
  const avisos = {
    alertas: [...(prestados?.alertas ?? []), ...avisosPropios.alertas],
    datos: [...(prestados?.datos ?? []), ...avisosPropios.datos],
    plegados: [...(prestados?.plegados ?? []), ...avisosPropios.plegados],
  }

  // LOS APOYOS DE ESTA ACCIÓN. Los de la tarea van siempre con ella. Los
  // del paso completo (imágenes y archivos que el autor dejó para todo
  // el paso, o heredados sin asignar) se ven a la vista UNA vez, con la
  // primera acción del paso, y en las siguientes quedan consultables
  // dentro de "Más información": nunca se repiten a la vista.
  const delPaso = apoyosDelPaso(paso)
  // La guía del paso y la tarea única no tienen apoyos propios: los
  // suyos son los del paso, como hasta ahora. La guía que exige una tarea
  // lleva los del paso solo si es la primera entrada; los de su tarea van
  // con la tarea, justo después.
  // La guía de una respuesta va siempre detrás de su decisión: nunca lleva
  // los del paso.
  const llevaLosDelPaso =
    tarea.clase !== 'tarea' &&
    tarea.clase !== 'guia-de-respuesta' &&
    (tarea.clase !== 'guia-de-tarea' || esPrimeraDelPaso)
  const propios: Apoyos =
    tarea.clase === 'tarea' ? apoyosDeTarea(paso, tarea.id) : llevaLosDelPaso ? delPaso : sinApoyos()
  const imagenesALaVista = [
    ...(prestados?.imagenes ?? []),
    ...(tarea.clase === 'tarea' && esPrimeraDelPaso ? delPaso.imagenes : []),
    ...propios.imagenes,
  ]
  const archivosALaVista = [
    ...(prestados?.archivos ?? []),
    ...(tarea.clase === 'tarea' && esPrimeraDelPaso ? [...adjuntosDe(delPaso.archivos), ...delPaso.adjuntosPaso] : []),
    ...adjuntosDe(propios.archivos),
    ...(llevaLosDelPaso ? delPaso.adjuntosPaso : []),
  ]
  const imagenesPlegadas = esPrimeraDelPaso ? [] : delPaso.imagenes
  const archivosPlegados = esPrimeraDelPaso ? [] : [...adjuntosDe(delPaso.archivos), ...delPaso.adjuntosPaso]
  const vinculoProtegido = propios.vinculoProtegido ?? tarea.vinculoProtegido
  // La credencial del paso que reutiliza esta guía, cuando no es la misma
  // que pide esta acción: la necesita alguien que está a punto de empezar.
  const credencialPrestada =
    prestados?.vinculoProtegido && !mismoVinculoProtegido(prestados.vinculoProtegido, vinculoProtegido)
      ? prestados.vinculoProtegido
      : null
  // QUÉ HACER, DÓNDE Y QUÉ DEBO VER DESPUÉS (encargo del 2026-09-22,
  // sección 6). El lugar acompaña a la PRIMERA acción del paso (es donde
  // hay que situarse antes de empezar) y lo que debe verse, a la ÚLTIMA
  // (es lo que confirma que el paso salió). Los dos salen del paso, no de
  // la tarea: son sus campos `lugar` y `resultado`.
  const esUltimaDelPaso = indice === tareas.length - 1
  // Dentro del flujo de otra guía, el paso que la reutiliza presta los
  // suyos a la primera y a la última acción reutilizada (tarea 289).
  const lugarDelPaso = esPrimeraDelPaso ? paso.lugar.trim() || (enFlujo?.lugar.trim() ?? '') : ''
  // La pregunta no lo lleva: es la acción de su pantalla, y lo que confirma
  // el paso llega después, con el camino de la respuesta.
  const debesVer =
    esUltimaDelPaso && !conOpciones ? paso.resultado.trim() || (enFlujo?.resultado.trim() ?? '') : ''
  // Para qué sirve el paso: explica, no ordena, así que va plegado y solo
  // con la primera acción del paso. El del paso que reutiliza esta guía,
  // primero.
  const objetivoPlegado = esPrimeraDelPaso ? paso.objetivo.trim() : ''
  const objetivoPrestado = prestados?.objetivo.trim() ?? ''
  const hayMasInformacion =
    avisos.plegados.length > 0 ||
    imagenesPlegadas.length > 0 ||
    archivosPlegados.length > 0 ||
    objetivoPlegado !== '' ||
    objetivoPrestado !== ''

  // LA GUÍA QUE REUTILIZA EL PASO NO ES UNA TARJETA QUE ABRIR (tarea 289,
  // fase 3): se hace en el sitio, como acciones de este paso (más abajo),
  // y se LEE cuando el paso se consulta o se revisa ya hecho. Solo cuando
  // aquí no se puede hacer (otro nivel, una guía sin pasos o que no está)
  // se ofrece aparte o se explica. Lo mismo la que exige una tarea, que
  // solo es entrada del recorrido cuando se puede hacer aquí.
  const guiaDelPasoAparte =
    tarea.clase === 'guia-del-paso' && tarea.guiaId && !guiaDelPasoIntegrada
      ? [{ id: tarea.guiaId, titulo: tarea.guiaTitulo }]
      : []
  const guiaParaLeer =
    (tarea.clase === 'guia-del-paso' && guiaDelPasoIntegrada) ||
    tarea.clase === 'guia-de-tarea' ||
    tarea.clase === 'guia-de-respuesta'
      ? tarea.guiaId
      : null
  // Las guías que una TAREA exige antes de marcarla (pueden ser varias, en
  // el orden del editor) y que AQUÍ NO SE PUEDEN HACER (no están en el
  // dispositivo, o esta ejecución ya es parte de otra guía): se ofrecen en
  // su tarjeta. Las que sí se pueden hacer son entradas del recorrido,
  // justo antes de la tarea (tarea 289, fase 3).
  const guiasDeLaTarea = tarea.guiasObligatorias
    .filter((g) => !tareas.some((e) => e.clase === 'guia-de-tarea' && e.guiaId === g.guiaArticuloId))
    .map((g) => ({
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
  // Los TÉRMINOS del glosario y los ATAJOS o COMANDOS de esta acción (y
  // los del paso que reutiliza esta guía, si son prestados).
  const referenciasDeLaTarea = bloquesUnicos([...(prestados?.referencias ?? []), ...propios.referencias]).map((bloque) => ({
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

  // DÓNDE ESTOY: "Paso 3 de 12", y el título del paso cuando dice algo
  // que la instrucción no dice ya. En un paso de una sola acción con el
  // mismo texto sería la misma frase dos veces.
  const tituloPropio = paso.titulo.trim()
  // El paso que reutiliza otra guía se nombra por SU título, como
  // cualquier paso: lo que se lee es qué se hace, no de dónde sale.
  const textoInstruccion =
    tarea.clase === 'guia-del-paso'
      ? !guiaDelPasoDisponible
        ? 'Las instrucciones de este paso no están en este dispositivo'
        : tituloPropio || tarea.texto || tarea.guiaTitulo
      : tarea.texto || 'Tarea sin texto'
  const tituloEnContexto =
    tituloPropio !== '' && normalizarTexto(tituloPropio) !== normalizarTexto(textoInstruccion) ? tituloPropio : ''

  // ¿Esta es la última acción pendiente de TODO el procedimiento? Solo
  // cambia el rótulo: "Completar y terminar" en vez de "Completar y
  // seguir".
  const quedaTrabajoEnElPaso = tareas.some((t) => t.id !== tarea.id && !cumplida(t))
  const esUltimoTrabajo = cierraLaGuia && !quedaTrabajoEnElPaso

  const puedeRetroceder = indice > 0 || onPasoAnterior !== undefined

  // A qué acción lleva seguir SIN marcar (desde una ya cumplida): la
  // siguiente pendiente mirando hacia adelante, si no la de al lado, y si
  // no queda ninguna, el control del paso. Es la misma regla que
  // `continuarSinMarcar`, aquí para que el rótulo diga a dónde va.
  function destinoSinMarcar(): number | null {
    const pendiente = siguientePendiente(indice)
    if (pendiente >= 0) return pendiente
    if (indice + 1 < tareas.length) return indice + 1
    return null
  }

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

  // RESPONDER ES TOCAR LA OPCIÓN (tarea 302): no hay un "Continuar" aparte.
  // Volver a la pregunta y tocar otra cambia la respuesta.
  function elegirOpcion(opcionId: string) {
    if (respondiendo !== null || consulta) return
    setRespondiendo({ decisionId: tarea.id, opcionId })
    onElegirOpcion(tarea.id, opcionId)
  }

  // Seguir SIN tocar nada, desde una acción que ya estaba cumplida (se
  // llegó a ella con "Anterior"). No registra nada.
  function continuarSinMarcar() {
    const destino = destinoSinMarcar()
    if (destino !== null) setIndiceTarea(destino)
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
    const indiceDecision = indice
    setDecisionAbierta(tareaId)
    setVinculoAbierto({
      guiaId: destinoDelNo,
      titulo: tarea.decisionGuiaTitulo || 'la salida',
      obligatoria: false,
      rotulo: '',
      enFlujo: true,
      alCompletar: () => {
        setDecisionAbierta(null)
        setVinculoAbierto(null)
        onDecisionResuelta(tareaId, destinoDelNo)
        // EL RECORRIDO SIGUE (tarea 289, fase 3): terminado el camino del
        // "No", lo siguiente es la acción que venía después de la
        // decisión, no volver a mirarla ya respondida.
        const siguiente = siguientePendiente(indiceDecision)
        if (siguiente >= 0) setIndiceTarea(siguiente)
      },
    })
  }

  // EL CAMINO DEL "NO" SIGUE EN EL FLUJO (tarea 289, fase 3): sus acciones
  // ocupan el sitio de la decisión sin cabecera ni regreso propios.
  // "Anterior" desde su primera acción deshace la respuesta.
  if (vinculoAbierto?.enFlujo) {
    return (
      <div className="flex flex-1 flex-col">
        {renderGuia({
          guiaId: vinculoAbierto.guiaId,
          tituloReferencia: vinculoAbierto.titulo,
          obligatoria: vinculoAbierto.obligatoria,
          alCompletar: vinculoAbierto.alCompletar,
          enFlujo: { lugar: '', resultado: '', terminaLaGuia: esUltimoTrabajo, alRetroceder: cerrarVinculo },
        })}
      </div>
    )
  }

  // LO OPCIONAL SIGUE SIENDO UN DESVÍO (encargo del 2026-09-10, tarea 4;
  // palabras de la tarea 289): una consulta o una contingencia ocupan el
  // sitio de la tarea con una cabecera que dice qué se abrió y para qué, y
  // una salida que devuelve a la acción exacta. Sin "guía vinculada" ni
  // "guía principal": el rótulo dice el papel y el regreso, el paso.
  if (vinculoAbierto) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-none flex-col gap-2 border-b border-noct-divider pb-3 pt-1">
          {vinculoAbierto.rotulo && (
            <p className="text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
              {vinculoAbierto.rotulo}
            </p>
          )}
          <h2
            ref={encabezado}
            tabIndex={-1}
            data-foco-lectura
            className="text-[17px] font-medium leading-snug text-pretty text-noct-text outline-none [overflow-wrap:anywhere]"
          >
            {vinculoAbierto.titulo}
          </h2>
          {/* SALIR SIN TERMINAR NO CUMPLE NADA: se vuelve a la acción con
              lo abierto como estaba. */}
          <button
            type="button"
            onClick={cerrarVinculo}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.07]"
          >
            <CaretLeft size={15} className="shrink-0" aria-hidden />
            Volver al paso {numeroPaso}
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

  // LO QUE ESTE PASO REUTILIZA SE HACE AQUÍ (tarea 289, fase 3): la guía
  // del paso, o la que exige una tarea, ocupa el sitio de la acción con sus
  // propias acciones, cada una con su pie; al terminar la última, el paso
  // se cierra solo o el recorrido sigue con lo siguiente (la tarea que la
  // exigía, si es eso). La cabecera, el contador y la ruta siguen siendo
  // los de la guía que se abrió. Ver `flujoContinuo.ts`.
  const guiaEnElSitio =
    !hecha &&
    !consulta &&
    tarea.guiaId !== null &&
    ((tarea.clase === 'guia-del-paso' && guiaDelPasoIntegrada) ||
      tarea.clase === 'guia-de-tarea' ||
      tarea.clase === 'guia-de-respuesta')
  if (guiaEnElSitio && tarea.guiaId) {
    // Lo que esta entrada enseñaría con la primera acción del paso viaja a
    // la primera acción reutilizada: el "Dónde", sus avisos, sus imágenes,
    // su credencial y su "para qué". Y el "Debes ver", a la última, solo si
    // con ella se acaba el paso.
    const apoyos: ApoyosDelFlujo | null = esPrimeraDelPaso
      ? {
          alertas: avisos.alertas,
          datos: avisos.datos,
          plegados: avisos.plegados,
          imagenes: imagenesALaVista,
          archivos: archivosALaVista,
          referencias: propios.referencias,
          vinculoProtegido,
          objetivo: objetivoPlegado,
        }
      : null
    return (
      <div className="flex flex-1 flex-col">
        {ruta && <div className="hidden md:block md:pt-2.5">{ruta}</div>}
        {renderGuia({
          guiaId: tarea.guiaId,
          tituloReferencia: tarea.guiaTitulo,
          obligatoria: true,
          enFlujo: {
            lugar: lugarDelPaso,
            resultado: debesVer,
            apoyos: apoyos && hayApoyosDelFlujo(apoyos) ? apoyos : null,
            terminaLaGuia: esUltimoTrabajo,
            alRetroceder: puedeRetroceder ? retroceder : undefined,
          },
        })}
      </div>
    )
  }

  // Seguir sin marcar lleva a otra acción del paso: el rótulo la nombra.
  // Sin ninguna a la que ir, el control es el del paso.
  const destinoSinTocar = destinoSinMarcar()
  const botonSinMarcar =
    destinoSinTocar !== null ? (
      <BotonPrincipal etiqueta={`Ir a la acción ${destinoSinTocar + 1}`} icono="flecha" onClick={continuarSinMarcar} />
    ) : (
      <BotonPrincipal
        etiqueta={cierre.etiqueta}
        etiquetaCompleta={cierre.etiquetaCompleta}
        icono={cierre.accion === 'completar' ? 'marca' : cierre.accion === 'navegar' ? 'flecha' : null}
        disabled={cierre.accion === 'bloqueado'}
        onClick={continuarSinMarcar}
      />
    )

  // El control grande del pie, según lo que toca ahora.
  let principal: ReactNode
  if (consulta) {
    // CONSULTANDO: lo único que se ofrece es volver al paso de trabajo.
    principal = (
      <BotonPrincipal etiqueta={`Ir al paso ${consulta.numeroPasoTrabajo}`} icono="flecha" onClick={consulta.onVolver} />
    )
  } else if (cierraPaso) {
    // Con todo el paso hecho, el control recorre primero las acciones que
    // quedan delante en este mismo paso (se volvió a revisar con
    // "Anterior") y solo desde la última pasa al control del paso: cerrar
    // y seguir, cerrar y terminar, o ir al paso siguiente si ya estaba
    // hecho.
    const quedaDelante = indice + 1 < tareas.length
    principal = quedaDelante ? (
      <BotonPrincipal etiqueta={`Ir a la acción ${indice + 2}`} icono="flecha" onClick={() => setIndiceTarea(indice + 1)} />
    ) : (
      <BotonPrincipal
        etiqueta={cierre.etiqueta}
        etiquetaCompleta={cierre.etiquetaCompleta}
        icono={cierre.accion === 'completar' ? 'marca' : cierre.accion === 'navegar' ? 'flecha' : null}
        disabled={cierre.accion === 'bloqueado'}
        onClick={onCompletarPaso}
      />
    )
  } else if (tarea.clase === 'guia-del-paso') {
    // LA ACCIÓN QUE SE PUEDE HACER ES LA DE LA TARJETA ("Abrir guía" /
    // "Continuar guía"). El control del pie dice qué falta para cerrar
    // el paso, "Completa «X»", inactivo: es la misma gramática de todos
    // los bloqueos. Se puede seguir cuando la tarjeta no ofrece nada que
    // hacer: la guía ya está completa, o no está en este dispositivo y no
    // bloquea (A12).
    const rotulo = rotuloCompletaGuia(tarea.texto)
    principal =
      hecha || !guiaDelPasoDisponible ? (
        botonSinMarcar
      ) : (
        <BotonPrincipal etiqueta={rotulo.visible} etiquetaCompleta={rotulo.completo} disabled />
      )
  } else if (conOpciones && !hecha) {
    // UNA DECISIÓN CON OPCIONES SE RESPONDE ARRIBA, tocando una respuesta:
    // el control del pie dice lo que falta, inactivo y legible, como todo
    // lo que bloquea.
    principal = <BotonPrincipal etiqueta="Elige una opción" disabled />
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
              ? `No: seguir con «${tarea.decisionGuiaTitulo || 'la salida'}»`
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
    principal = botonSinMarcar
  } else if (pendientes.length > 0) {
    // UNA GUÍA NECESARIA DE ESTA TAREA SIN TERMINAR. Si se hace en el sitio
    // (es una acción de este paso, justo antes), el control lleva a ella:
    // se llega aquí sin pasar por ella solo entrando por el final del paso.
    // Si no, el control dice cuál y queda inactivo; su tarjeta, arriba, es
    // la que se abre.
    const entradaDeLaGuia = tareas.findIndex(
      (e) => e.clase === 'guia-de-tarea' && e.guiaId === pendientes[0].guiaArticuloId,
    )
    if (entradaDeLaGuia >= 0) {
      principal = (
        <BotonPrincipal
          etiqueta={`Ir a la acción ${entradaDeLaGuia + 1}`}
          icono="flecha"
          onClick={() => setIndiceTarea(entradaDeLaGuia)}
        />
      )
    } else {
      const rotulo = rotuloCompletaGuia(pendientes[0].guiaArticuloTitulo)
      principal = <BotonPrincipal etiqueta={rotulo.visible} etiquetaCompleta={rotulo.completo} disabled />
    }
  } else {
    // COMPLETAR Y AVANZAR SON UN SOLO GESTO: marca la acción y trae la
    // siguiente. Una comprobación usa el mismo rótulo: "Comprueba", sobre
    // la instrucción, ya dice qué clase de trabajo es.
    principal = (
      <BotonPrincipal
        etiqueta={esUltimoTrabajo ? 'Completar y terminar' : 'Completar y seguir'}
        icono="marca"
        onClick={completarYContinuar}
      />
    )
  }

  // DÓNDE ESTOY, EN VOZ BAJA (propuesta final). En el teléfono, "acción 2
  // de 2" y el título del paso; en escritorio, la ruta horizontal. Dentro
  // de una guía vinculada, la línea de siempre ("Paso 1 de 3" y el
  // título), porque ahí no hay contador que lo diga. Entre esto y la
  // acción, aire: lo que orienta no se lee como parte de lo que se hace.
  const contextoEnTelefono = tareas.length > 1 || tituloEnContexto !== ''
  const separacionAccion = ruta || enFlujo ? (contextoEnTelefono ? 'mt-7' : ruta ? 'md:mt-7' : '') : 'mt-4'

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col pb-6 pt-2.5">
        {requisitos.length > 0 && esPrimeraDelPaso && (
          <div className="mb-4">
            <AntesDeEmpezar requisitos={requisitos} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {/* Un trazo por acción del paso, solo si tiene más de una. */}
          {tareas.length > 1 && <AccionesDelPaso hechas={tareas.map(cumplida)} actual={indice} />}
          {ruta ? (
            <>
              {ruta}
              {tituloEnContexto && (
                <p className="text-[15px] leading-snug text-noct-neutral-300 text-pretty md:hidden">{tituloEnContexto}</p>
              )}
            </>
          ) : enFlujo ? (
            // En el flujo de la guía que se abrió, la numeración es la suya
            // (el contador de la cabecera): aquí solo el título, en voz baja.
            tituloEnContexto && (
              <p className="text-[15px] leading-snug text-noct-neutral-300 text-pretty">{tituloEnContexto}</p>
            )
          ) : (
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13.5px] leading-snug text-noct-neutral-400">
              <span className="font-semibold uppercase tracking-[.06em] text-noct-accion">
                Paso {numeroPaso}
                {totalPasos !== null && ` de ${totalPasos}`}
              </span>
              {tituloEnContexto && <span className="min-w-0 text-pretty text-noct-neutral-300">{tituloEnContexto}</span>}
            </p>
          )}
        </div>

        <div className={`flex flex-col gap-4 ${separacionAccion}`}>
        {/* LAS ALERTAS, ANTES DE LA INSTRUCCIÓN: un riesgo se lee antes
            de actuar, no después. Solo precaución e importante, y desde
            el 2026-09-22 en rojo: en una guía el rojo es el riesgo. */}
        {avisos.alertas.map((aviso) => (
          <AlertaDeRiesgo key={aviso.id} aviso={aviso} />
        ))}

        {/* DÓNDE SE HACE: dónde hay que estar para hacer la acción. Con la
            primera acción del paso. Solo orienta: neutro, con su chincheta
            y su palabra, y a 16 px de la acción (tarea 303). */}
        {lugarDelPaso && <DondeSeHacePaso lugar={lugarDelPaso} />}

        {/* LA ACCIÓN Y LO QUE HACE FALTA PARA HACERLA. El dato técnico va
            pegado a la instrucción (más cerca que el resto de la pantalla)
            porque es SU valor, y con menos peso porque no es otra orden. */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            {/* Sin etiqueta cuando el paso que reutiliza otra guía no se
                puede hacer aquí (no está, o se lee aparte): "Hecha" o "Qué
                hacer" encima dirían lo que no es. */}
            {(tarea.clase !== 'guia-del-paso' || (guiaDelPasoDisponible && guiaDelPasoIntegrada)) && (
              <EtiquetaDeAccion tipoTarea={tarea.tipoTarea} hecha={hecha} conOpciones={conOpciones} />
            )}
            {/* La instrucción nunca se recorta (regla 23): una ruta o un
                nombre sin espacios parte la línea en vez de salirse. */}
            <h2
              ref={encabezado}
              id={conOpciones ? idPregunta : undefined}
              tabIndex={-1}
              data-foco-lectura
              className={`min-w-0 text-[26px] font-medium leading-[1.3] tracking-[-.01em] text-pretty outline-none [overflow-wrap:anywhere] ${
                hecha ? 'text-noct-neutral-400' : 'text-noct-text'
              }`}
            >
              {textoInstruccion}
            </h2>
          </div>
          {avisos.datos.map((aviso) => (
            <DatoTecnico key={aviso.id} texto={aviso.texto} />
          ))}
        </div>

        {/* LAS RESPUESTAS, JUSTO BAJO LA PREGUNTA (tarea 302): son la acción
            de esta pantalla. En la consulta se leen, pero no se tocan. */}
        {conOpciones && (
          <div className="flex flex-col gap-2.5">
            <RespuestasDecision
              variante="foco"
              opciones={tarea.opciones}
              elegida={respuestaElegida}
              inactivas={consulta !== null || respondiendo !== null}
              onElegir={elegirOpcion}
              idPregunta={idPregunta}
            />
            {/* Cambiar la respuesta reinicia lo hecho después: se dice antes
                de tocar, no después. */}
            {hecha && avanceTrasLaDecision && !consulta && (
              <p className="text-[13px] leading-snug text-pretty text-noct-neutral-400">
                Si eliges otra respuesta, se reinicia lo que hiciste después de esta pregunta.
              </p>
            )}
          </div>
        )}

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

        {credencialPrestada && <CredencialEnPaso vinculo={credencialPrestada} variante="bloque" />}
        {vinculoProtegido && <CredencialEnPaso vinculo={vinculoProtegido} variante="bloque" />}

        {archivosALaVista.length > 0 && <AdjuntosPaso adjuntos={archivosALaVista} titulo={paso.titulo} />}

        {/* LO QUE SE HACE EN EL SITIO (la guía del paso, o la que exige una
            tarea), PARA LEERLO: al consultarlo o al revisarlo ya hecho
            (tarea 289, fase 3). */}
        {guiaParaLeer && <PasosEnLectura guiaId={guiaParaLeer} />}

        {/* Y cuando aquí no se puede hacer: se ofrece aparte, o se explica
            que no está. Nunca se abre en el sitio. */}
        {guiaDelPasoAparte.map((g) => (
          <div key={g.id}>
            {renderTarjetaGuia({ guiaId: g.id, tituloReferencia: g.titulo, obligatoria: true, kicker: ROTULO_DEL_PASO })}
          </div>
        ))}

        {/* LO QUE UNA TAREA EXIGE O OFRECE, COMO TARJETA COMPACTA: abrirla
            sustituye esta pantalla (encargo del 2026-09-10, tarea 4). En la
            consulta se leen, pero no se abren: abrir es empezar su trabajo,
            y en un paso consultado no se trabaja. */}
        {guiasDeLaTarea.map((g) => (
          <div key={g.clave}>
            {renderTarjetaGuia({
              guiaId: g.id,
              tituloReferencia: g.titulo,
              obligatoria: true,
              kicker: ROTULO_NECESARIO,
              onAbrir: consulta
                ? undefined
                : () =>
                    setVinculoAbierto({ guiaId: g.id, titulo: g.titulo, obligatoria: true, rotulo: ROTULO_NECESARIO }),
            })}
          </div>
        ))}

        {guiasDeApoyo.map((g) => (
          <div key={g.id}>
            {renderTarjetaGuia({
              guiaId: g.guiaArticuloId ?? '',
              tituloReferencia: g.guiaArticuloTitulo,
              obligatoria: false,
              kicker: rotuloDeIntencion(g.intencionGuia),
              onAbrir: consulta
                ? undefined
                : () =>
                    setVinculoAbierto({
                      guiaId: g.guiaArticuloId ?? '',
                      titulo: g.guiaArticuloTitulo,
                      obligatoria: false,
                      rotulo: rotuloDeIntencion(g.intencionGuia),
                    }),
            })}
          </div>
        ))}

        {/* QUÉ DEBO VER DESPUÉS: con la última acción del paso (el
            `resultado` del paso), después de todo lo que se usa para
            hacerla. Verde en su icono y su palabra: comprueba, no manda. */}
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
            encargo): plegado y a un toque, cerrado al llegar a cada
            acción. Lo necesario para ejecutarla nunca vive aquí (regla
            27): si hiciera falta abrirlo para saber qué hacer, el
            contenido está mal clasificado. */}
        {hayMasInformacion && (
          <MasInformacion abierta={masInformacion} onAlternar={() => setMasInformacion((v) => !v)}>
            {objetivoPrestado && (
              <p className="text-[14px] leading-normal text-noct-neutral-200">
                <span className="font-medium text-noct-neutral-400">Para qué: </span>
                {objetivoPrestado}
              </p>
            )}
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
          {/* El aviso de versión nueva va aquí, encima de los botones, y
              no flotando sobre ellos (tarea 273). Vacío no ocupa nada. La
              barra anidada no lo lleva: lo lleva la de la guía de fuera. */}
          {!anidado && <div ref={huecoAvisoActualizacion} className="mx-auto w-full max-w-xl empty:hidden" />}
          {/* QUÉ GUÍAS FALTAN, cuando son más de una. Con una sola, el
              botón ya la nombra ("Completa «X»"). */}
          {!consulta && !cierraPaso && !hecha && pendientes.length > 1 && motivoGuias && (
            <p className="text-center text-[12px] text-noct-neutral-300">{motivoGuias}</p>
          )}
          {!consulta && esDecision && !hecha && !noAbierto && destinoDelNo && (
            <p className="text-center text-[13px] leading-snug text-noct-neutral-300 text-pretty">
              Si respondes que no, sigues con «{tarea.decisionGuiaTitulo || 'la salida'}»
            </p>
          )}
          {!consulta && !anidado && renderEnvioAEquipo?.(tarea.clase === 'tarea' ? tarea.id : null)}
          {/* En escritorio la ejecución tiene más ancho (tarea 255), pero
              los controles no se estiran: un botón de 700 px no se toca
              mejor que uno de 600. En la consulta no hay "Anterior": el
              único gesto es volver al paso de trabajo. */}
          <div className="mx-auto flex w-full max-w-xl gap-2.5">
            {!consulta && (
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
            )}
            {principal}
          </div>
          {/* LO SECUNDARIO, EN UNA LÍNEA DISCRETA. En la consulta, moverse
              entre las acciones del paso consultado (leerlo entero sin
              marcar nada); si no, "Tengo un problema", que abre las salidas
              del paso (contingencia, evidencia, saltar) sin completar
              nada. */}
          {consulta ? (
            tareas.length > 1 && (
              <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={indice === 0}
                  onClick={() => setIndiceTarea(indice - 1)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.07] hover:text-noct-text disabled:opacity-40"
                >
                  <CaretLeft size={14} className="shrink-0" aria-hidden />
                  Acción anterior
                </button>
                <button
                  type="button"
                  disabled={indice + 1 >= tareas.length}
                  onClick={() => setIndiceTarea(indice + 1)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.07] hover:text-noct-text disabled:opacity-40"
                >
                  Acción siguiente
                  <CaretRight size={14} className="shrink-0" aria-hidden />
                </button>
              </div>
            )
          ) : (
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
            {hecha && tarea.clase === 'tarea' && !conOpciones && (
              <button
                type="button"
                onClick={desmarcar}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.07] hover:text-noct-text"
              >
                Desmarcar
              </button>
            )}
          </div>
          )}
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
function EtiquetaDeAccion({
  tipoTarea,
  hecha,
  conOpciones = false,
}: {
  tipoTarea: string | null
  hecha: boolean
  // Una decisión con opciones (tarea 302) no se hace: se responde.
  conOpciones?: boolean
}) {
  if (hecha) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-exito">
        <Check size={13} className="shrink-0" aria-hidden />
        {conOpciones ? 'Respondida' : 'Hecha'}
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
      <tono.Icono size={19} className={`mt-0.5 shrink-0 ${tono.claseIcono}`} aria-hidden />
      <p className="min-w-0 text-[14.5px] leading-[1.45] text-pretty">
        <span className={`font-semibold ${tono.claseIcono}`}>{tono.etiqueta}.</span> {aviso.texto || 'Aviso sin texto'}
      </p>
    </div>
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
