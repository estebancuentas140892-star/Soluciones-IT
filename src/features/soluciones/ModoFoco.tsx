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
  Warning,
} from '../../components/iconos'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import {
  apoyosDelPaso,
  apoyosDeTarea,
  cuentaApoyos,
  hayApoyos,
  ubicacionApoyosDelPaso,
  type Apoyos,
} from './apoyosTarea'
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
  onAlternarTarea: (tareaId: string) => void
  // Cierra el paso y avanza. Es la misma acción dominante de la vista
  // completa: el foco no decide cuándo se puede, solo la ofrece.
  onCompletarPaso: () => void
  // Rótulo de esa acción ("Paso hecho · ir al 4"), resuelto arriba para
  // que las dos vistas digan exactamente lo mismo.
  etiquetaAvance: string
  // Razón escrita cuando el paso no puede cerrarse todavía. null cuando
  // sí puede.
  motivoBloqueo: string | null
  // El técnico declara que algo va mal en esta tarea. Abre la MISMA
  // hoja de salidas que el "Falla" de la vista completa (tablero 3d).
  onFalla: (textoTarea: string) => void
  // Pinta una guía vinculada para ejecutarla aquí dentro. Lo aporta
  // `AsistenteVista`, que es quien sabe anidar otra ejecución y quien
  // conserva el punto de origen.
  renderGuia: (opciones: { guiaId: string; tituloReferencia: string; obligatoria: boolean }) => ReactNode
}

export function ModoFoco({
  paso,
  tituloPaso,
  instruccionesHechas,
  subSatisfecho,
  guiaDelPasoDisponible = true,
  onAlternarTarea,
  onCompletarPaso,
  etiquetaAvance,
  motivoBloqueo,
  onFalla,
  renderGuia,
}: Props) {
  const tareas = tareasParaFoco(paso, tituloPaso)
  const delPaso = apoyosDelPaso(paso)
  const [indiceTarea, setIndiceTarea] = useState(() => {
    // La guía que no está disponible se lee ANTES de seguir: cuenta
    // como cumplida para no bloquear, pero el recorrido empieza en ella
    // para que su explicación no pase de largo (A12).
    const pendiente = tareas.findIndex(
      (t) =>
        !tareaFocoHecha(t, instruccionesHechas, subSatisfecho) ||
        (t.clase === 'guia-del-paso' && !guiaDelPasoDisponible),
    )
    return pendiente >= 0 ? pendiente : 0
  })
  // Qué panel está desplegado. Los apoyos siguen a mano pero no ocupan
  // la pantalla: lo que se lee de brazo estirado es la instrucción.
  const [panel, setPanel] = useState<'clave' | 'fotos' | 'archivos' | 'paso' | null>(null)

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
  // La guía vinculada de ESTA tarea, si la tiene. En la entrada
  // 'guia-del-paso' es el trabajo entero de la tarea, así que se
  // despliega sin pedir permiso: es lo que el técnico vino a hacer.
  const guiaObligatoria = tarea.guiaId
  // Guías de consulta y contingencia asignadas a esta tarea: apoyo, no
  // prerrequisito, así que van entre los apoyos y nunca bloquean.
  const guiasDeApoyo = apoyos.guias.filter((g) => g.intencionGuia !== 'necesario')

  // LOS APOYOS DEL PASO SE VEN AL ENTRAR, NO EN CADA TAREA (requisito 5
  // del editor). En la primera tarea van desplegados, que es "entrar al
  // paso"; a partir de ahí quedan detrás de su propio control, para
  // poder volver a consultarlos sin que reaparezcan solos.
  //
  // UNA VEZ, NO DOS (encargo del 2026-09-09, sección 3). La condición
  // incluía `|| panel === 'paso'`, y el panel "Del paso" pinta ESOS
  // MISMOS avisos: abrir el control dibujaba la precaución suelta arriba
  // y otra vez dentro del panel. Es la duplicación que reportó el
  // usuario, y no venía del dato ni del reparto de `apoyosTarea`, que
  // devuelve cada bloque una sola vez: venía de dos sitios de esta vista
  // pintando la misma lista a la vez. La decisión de dónde va cada cosa
  // se mudó a `ubicacionApoyosDelPaso`, donde los tres destinos son
  // excluyentes por construcción y hay prueba.
  const ubicacionDelPaso = ubicacionApoyosDelPaso({
    esTareaReal: tarea.clase === 'tarea',
    enPrimeraTarea: indice === 0,
    panelDelPasoAbierto: panel === 'paso',
  })
  const mostrarApoyosDelPaso = ubicacionDelPaso === 'sueltos'
  const hayApoyosDelPaso = hayApoyos(delPaso)

  function marcar() {
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
  // no se marca a mano: se cumple al terminarla (A10).
  const etiquetaMarcar = esVerificacion ? (hecha ? 'Comprobado' : 'Sí, lo comprobé') : hecha ? 'Hecha' : 'Marcar hecha'

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

        {/* Los avisos de ESTA tarea van pegados a ella: un aviso que hay
            que ir a buscar no advierte. Los del paso solo al entrar. */}
        {apoyos.avisos.map((aviso) => (
          <AvisoFoco key={aviso.id} aviso={aviso} />
        ))}
        {mostrarApoyosDelPaso &&
          tarea.clase === 'tarea' &&
          delPaso.avisos.map((aviso) => <AvisoFoco key={aviso.id} aviso={aviso} delPaso />)}

        {/* LA GUÍA VINCULADA, AQUÍ Y AHORA (H05). Antes esto no
            existía: el paso decía que había que terminarla y no había
            forma de abrirla sin salir a la vista completa. */}
        {guiaObligatoria && (
          <div className="rounded-xl border border-noct-divider bg-noct-surface/60 p-3">
            {renderGuia({
              guiaId: guiaObligatoria,
              tituloReferencia: tarea.guiaTitulo,
              obligatoria: true,
            })}
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
          // EL CHIP TAMBIÉN EN LA PRIMERA TAREA. Llevaba `!enPrimeraTarea`,
          // y ahí los apoyos del paso se pintan sueltos, así que parecía
          // redundante. No lo era: sueltos solo se pintan los AVISOS, de
          // modo que la galería del paso, sus imágenes y su dato
          // protegido no tenían ningún control que los abriera mientras
          // el técnico estuviera en la tarea 1. Ahora el chip está
          // siempre que haya algo del paso, y sirve además para cerrar
          // el panel donde se abrió.
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
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-none flex-col gap-2.5 bg-gradient-to-t from-noct-bg from-55% to-transparent px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        {cierraPaso && motivoBloqueo && (
          <p className="text-center text-[11.5px] text-noct-neutral-400">{motivoBloqueo}</p>
        )}
        {cierraPaso ? (
          <button
            type="button"
            disabled={motivoBloqueo !== null}
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
        ) : (
          <button
            type="button"
            onClick={marcar}
            aria-pressed={hecha}
            className={`flex h-[76px] w-full items-center justify-center gap-3 rounded-2xl border-2 text-xl font-semibold ${
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
        <ChipFoco Icono={Info} activo={panel === 'paso'} onClick={() => onPanel('paso')}>
          {`Del paso (${delPasoCuenta})`}
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
