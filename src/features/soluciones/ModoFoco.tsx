import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import {
  BookOpen,
  Camera,
  CaretLeft,
  CaretRight,
  Check,
  Info,
  LockSimple,
  Paperclip,
  SealCheck,
  Signpost,
  Warning,
} from '../../components/iconos'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
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
  // ¿Esa guía se EJECUTA aquí dentro (no solo se enlaza)? Cuando sí, la
  // guía trae su propia zona de acciones dominante y el pie de este
  // paso se retira mientras siga abierta: si no, la pantalla mostraba a
  // la vez el pie de la guía vinculada y el cartel grande «Esta tarea
  // se cumple al terminar la guía de arriba».
  guiaDelPasoEnLinea?: boolean
  // Este foco es el de una guía vinculada, dibujada DENTRO del paso de
  // otra. Solo cambia el encuadre: el pie deja de sangrar hacia los
  // lados, porque ahí ya no llega al borde de la pantalla sino al de la
  // tarjeta que lo contiene.
  anidado?: boolean
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
  // Pinta una guía vinculada para ejecutarla aquí dentro. Lo aporta
  // `AsistenteVista`, que es quien sabe anidar otra ejecución y quien
  // conserva el punto de origen.
  renderGuia: (opciones: {
    guiaId: string
    tituloReferencia: string
    obligatoria: boolean
    // Rótulo de la fila, cuando el que se deduce de `obligatoria`
    // ("Otra guía" / "Consulta opcional") no describe el papel.
    kicker?: string
    // Llega desplegada, sin esperar a que el técnico la abra.
    abierta?: boolean
    // Qué hacer cuando la guía anidada termina. Sin esto, el asistente
    // intenta cerrar el paso, que es lo que corresponde a un requisito
    // del paso. Una DECISIÓN respondida con "No" necesita lo otro: al
    // terminar el destino, lo que queda respondido es la decisión.
    alCompletar?: () => void
  }) => ReactNode
}

export function ModoFoco({
  paso,
  tituloPaso,
  instruccionesHechas,
  subSatisfecho,
  guiaDelPasoDisponible = true,
  guiaDelPasoEnLinea = false,
  anidado = false,
  onAlternarTarea,
  onCompletarPaso,
  etiquetaAvance,
  puedeCerrarPaso,
  onFalla,
  onDecisionResuelta,
  guiasPendientes,
  renderGuia,
}: Props) {
  const tareas = tareasParaFoco(paso, tituloPaso)
  const delPaso = apoyosDelPaso(paso)
  const hayApoyosDelPaso = hayApoyos(delPaso)

  // La guía que no está disponible se lee ANTES de seguir: cuenta como
  // cumplida para no bloquear, pero el recorrido empieza en ella para
  // que su explicación no pase de largo (A12).
  function primeraPendiente(): number {
    const pendiente = tareas.findIndex(
      (t) =>
        !tareaFocoHecha(t, instruccionesHechas, subSatisfecho) ||
        (t.clase === 'guia-del-paso' && !guiaDelPasoDisponible),
    )
    return pendiente >= 0 ? pendiente : 0
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
      (t, i) => i !== actual && !tareaFocoHecha(t, instruccionesHechas, subSatisfecho),
    )
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }, [subSatisfecho, guiaDelPasoDisponible, indiceTarea, tareas, instruccionesHechas])

  const indice = Math.min(indiceTarea, tareas.length - 1)
  const tarea = tareas[indice]
  if (!tarea) return null

  const hecha = tareaFocoHecha(tarea, instruccionesHechas, subSatisfecho)
  const hechas = tareas.filter((t) => tareaFocoHecha(t, instruccionesHechas, subSatisfecho)).length
  const apoyos: Apoyos =
    tarea.clase === 'tarea' ? apoyosDeTarea(paso, tarea.id) : { ...apoyosDelPaso(paso), adjuntosPaso: [] }
  const vinculoProtegido = apoyos.vinculoProtegido ?? tarea.vinculoProtegido
  const accion = accionFoco(tareas, instruccionesHechas, subSatisfecho)
  const cierraPaso = accion === 'completar'
  const esVerificacion = tarea.tipoTarea === 'verificacion'
  // UNA DECISIÓN NO ES UNA ACCIÓN (encargo del 2026-09-09, secciones 5
  // y 6). Hasta hoy este modo, que es LA ejecución desde la tarea 217,
  // pintaba una decisión igual que una instrucción: el mismo "Marcar
  // hecha" y ninguna de sus dos respuestas. El destino del "No", que el
  // editor sí deja configurar y la vista completa sí ofrece, no existía
  // aquí, así que marcarla equivalía a responder "sí" en silencio.
  const esDecision = tarea.tipoTarea === 'decision'
  // UNA SOLA ZONA DE ACCIONES DOMINANTE. Mientras la guía vinculada se
  // ejecuta aquí dentro, la suya es la que manda: este pie desaparece
  // entero (cartel, flechas y «Falla»), y vuelve en cuanto la guía
  // queda cumplida y el recorrido pasa a la tarea siguiente.
  const pieCedidoAlVinculo =
    tarea.clase === 'guia-del-paso' && guiaDelPasoEnLinea && guiaDelPasoDisponible && !hecha
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

  function marcar() {
    // La misma regla que aplica el hook al escribir, aquí solo para no
    // ofrecer un gesto que no va a hacer nada.
    if (!hecha && motivoGuias) return
    onAlternarTarea(tarea.id)
    // Marcar avanza a la siguiente tarea sin cumplir: es el gesto de
    // "ya está, dame la que sigue". Desmarcar no mueve nada, porque
    // quien desmarca está corrigiéndose y quiere quedarse donde está.
    if (hecha) return
    const siguiente = tareas.findIndex(
      (t, i) => i !== indice && !tareaFocoHecha(t, instruccionesHechas, subSatisfecho),
    )
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }

  // El rótulo de la acción dominante nombra lo que se cierra. Una
  // comprobación no se "hace": se comprueba (H08). Y una guía vinculada
  // no se marca a mano: se cumple al terminarla (A10). Una decisión ya
  // respondida dice "Respondida", no "Hecha": lo que ocurrió ahí fue
  // elegir un camino, no ejecutar una instrucción.
  const etiquetaMarcar = esVerificacion
    ? hecha
      ? 'Comprobado'
      : 'Sí, lo comprobé'
    : esDecision
      ? hecha
        ? 'Respondida'
        : 'Ya quedó resuelto, continuar'
      : hecha
        ? 'Hecha'
        : 'Marcar hecha'

  // Responder que sí es seguir por la vía prevista: marca y avanza,
  // igual que cualquier tarea cumplida.
  function responderSi() {
    setDecisionAbierta(null)
    marcar()
  }

  // Responder que no abre el destino si lo hay. Sin destino, la
  // decisión se registra igual y el flujo sigue: es la misma salida que
  // ofrece la vista completa, y no dejar salida sería obligar a mentir.
  function responderNo() {
    if (destinoDelNo) setDecisionAbierta(tarea.id)
    else marcar()
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
        {!tarea.esPasoEntero && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full bg-noct-accent/[.18] px-3.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
              <Check size={14} aria-hidden />
              Tarea {indice + 1} de {tareas.length}
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
            {cierraPaso && hecha && tarea.clase !== 'guia-del-paso' && (
              <button
                type="button"
                onClick={() => onAlternarTarea(tarea.id)}
                className="flex h-11 items-center rounded-full px-3 text-[13px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.08]"
              >
                Desmarcar
              </button>
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
          className={`text-[30px] font-medium leading-[1.25] tracking-[-.015em] text-pretty ${
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

        {/* Los avisos de ESTA tarea van pegados a ella: un aviso que hay
            que ir a buscar no advierte. Los del paso solo al entrar. */}
        {apoyos.avisos.map((aviso) => (
          <AvisoFoco key={aviso.id} aviso={aviso} />
        ))}

        {/* LA GUÍA VINCULADA, AQUÍ Y AHORA (H05). Antes esto no
            existía: el paso decía que había que terminarla y no había
            forma de abrirla sin salir a la vista completa. */}
        {guiasDeLaTarea.map((g) => (
          <div key={g.clave} className="rounded-xl border border-noct-divider bg-noct-surface/60 p-3">
            {renderGuia({ guiaId: g.id, tituloReferencia: g.titulo, obligatoria: true })}
          </div>
        ))}

        {/* EL DESTINO DEL "NO", ejecutado aquí mismo (secciones 5 y 6
            del encargo del 2026-09-09). Es el mismo trato que la vista
            completa le da a una decisión: responder que no abre la guía
            de salida, y terminarla responde la decisión y devuelve al
            técnico a este punto exacto. Con el destino abierto, la
            respuesta ya está tomada, así que la barra de abajo deja de
            ofrecer las dos opciones. */}
        {noAbierto && destinoDelNo && (
          <div className="rounded-xl border border-noct-precaucion/45 bg-noct-precaucion/[.08] p-3">
            <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[.06em] text-noct-precaucion">
              Respondiste que no
            </p>
            {renderGuia({
              guiaId: destinoDelNo,
              tituloReferencia: tarea.decisionGuiaTitulo,
              obligatoria: false,
              // El destino de un "no" no es material de consulta: es el
              // trabajo que toca ahora, así que llega ABIERTO y con el
              // rótulo de la vista completa ("Si esto falla"), no con el
              // de una guía que se ojea si hace falta.
              kicker: 'Si esto falla',
              abierta: true,
              alCompletar: () => {
                setDecisionAbierta(null)
                onDecisionResuelta(tarea.id, destinoDelNo)
              },
            })}
            <button
              type="button"
              onClick={() => setDecisionAbierta(null)}
              className="mt-2 inline-flex min-h-11 items-center text-[13px] font-medium text-noct-neutral-300 hover:text-noct-text"
            >
              Volver a la pregunta
            </button>
          </div>
        )}

        {guiasDeApoyo.map((g) => (
          <div key={g.id} className="rounded-xl border border-noct-divider bg-noct-surface/60 p-3">
            {renderGuia({
              guiaId: g.guiaArticuloId ?? '',
              tituloReferencia: g.guiaArticuloTitulo,
              obligatoria: false,
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
      </div>

      {/* Acción dominante de 76 px: es el ÚNICO elemento grande de la
          pantalla, así que no hay que apuntar. */}
      {!pieCedidoAlVinculo && (
      <div
        className={`sticky bottom-0 z-10 mt-auto flex flex-none flex-col gap-2.5 bg-gradient-to-t from-noct-bg from-55% to-transparent pt-3 ${
          anidado ? 'pb-3' : '-mx-4 px-4 pb-[calc(12px+env(safe-area-inset-bottom))]'
        }`}
      >
        {/* QUÉ GUÍA FALTA, con su nombre. Sin esto el botón apagado no
            dice por qué, que es el defecto que el encargo llama "no se
            muestra cuál guía falta completar". */}
        {!cierraPaso && !hecha && motivoGuias && (
          <p className="text-center text-[11.5px] text-noct-precaucion">{motivoGuias}</p>
        )}
        {cierraPaso ? (
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
          // La guía vinculada NO tiene botón de marcar: se cumple sola
          // al terminarla (A10). Poner uno sería ofrecer justo lo que
          // el criterio prohíbe, dar por hecha una guía sin hacerla.
          <p className="flex min-h-[76px] w-full items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-noct-divider px-4 text-center text-[14px] leading-snug text-noct-neutral-300">
            <BookOpen size={18} className="shrink-0 text-noct-neutral-400" aria-hidden />
            {guiaDelPasoDisponible
              ? 'Esta tarea se cumple al terminar la guía de arriba'
              : 'Sigue con el resto del paso: este vínculo no impide cerrarlo'}
          </p>
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
        ) : (
          <button
            type="button"
            onClick={marcar}
            aria-pressed={hecha}
            disabled={!hecha && motivoGuias !== null}
            className={`flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 text-xl font-semibold disabled:opacity-30 ${
              hecha
                ? 'border-noct-exito bg-noct-exito/[.16] text-noct-exito'
                : 'border-noct-accent bg-noct-accent/[.16] text-noct-accent-300 active:bg-noct-accent/[.34]'
            }`}
          >
            <Check size={26} className="shrink-0" aria-hidden />
            {etiquetaMarcar}
          </button>
        )}
        <div className="flex gap-2.5">
          {/* NAVEGAR NO ES MARCAR (H07, criterio A13). Las flechas se
              anuncian como consulta: "ver la anterior", "ver la
              siguiente". Antes decían solo "Tarea anterior" y "Tarea
              siguiente", que en una pantalla cuya acción es marcar se
              leía como avanzar el trabajo. */}
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
          <button
            type="button"
            onClick={() => onFalla(tarea.texto)}
            aria-haspopup="dialog"
            aria-label={
              esVerificacion ? 'La comprobación no se cumple: ver las salidas' : 'Algo va mal en esta tarea'
            }
            className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-noct-precaucion/55 bg-noct-precaucion/10 text-[15.5px] font-medium text-noct-precaucion hover:bg-noct-precaucion/[.2]"
          >
            <Warning size={19} className="shrink-0" aria-hidden />
            <span className="truncate">{esVerificacion ? 'No se cumple' : 'Falla'}</span>
          </button>
          <button
            type="button"
            disabled={indice >= tareas.length - 1}
            onClick={() => setIndiceTarea(Math.min(tareas.length - 1, indice + 1))}
            aria-label="Ver la tarea siguiente. Solo mueve la vista, no la marca como hecha"
            title="Ver la siguiente"
            className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.08] disabled:opacity-30"
          >
            <CaretRight size={20} aria-hidden />
          </button>
        </div>
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
      {apoyos.avisos.map((aviso) => (
        <AvisoFoco key={aviso.id} aviso={aviso} delPaso />
      ))}
      {apoyos.imagenes.map((imagen) => (
        <BloqueVista key={imagen.id} bloque={imagen} marcada={false} onAlternar={() => {}} />
      ))}
      {archivos.length > 0 && <AdjuntosPaso adjuntos={archivos} titulo={titulo} />}
      {apoyos.vinculoProtegido && <CredencialEnPaso vinculo={apoyos.vinculoProtegido} />}
    </div>
  )
}

// El aviso en foco: barra de color a la izquierda y texto a 16 px, más
// grande que en la vista normal. Conserva su palabra además del color
// (regla R16: estado en dos canales, nunca solo color).
function AvisoFoco({ aviso, delPaso = false }: { aviso: BloquePaso; delPaso?: boolean }) {
  const tono = tonoInfo(aviso.tono)
  return (
    <div
      className={`flex items-start gap-3 rounded-r-[10px] border-l-[3px] px-4 py-3.5 ${tono.claseBarra} ${tono.claseFondo}`}
    >
      <tono.Icono size={22} className={`mt-px shrink-0 ${tono.claseIcono}`} aria-hidden />
      <p className="min-w-0 text-base leading-[1.45] text-pretty">
        <span className={`font-semibold ${tono.claseIcono}`}>{tono.etiqueta}.</span> {aviso.texto}
        {/* De quién es el aviso, cuando no es de esta tarea: sin esto,
            un aviso del paso se lee como si fuera de la instrucción que
            tiene encima. */}
        {delPaso && (
          <span className="ml-1 text-[12.5px] text-noct-neutral-400">(aviso de todo el paso)</span>
        )}
      </p>
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
