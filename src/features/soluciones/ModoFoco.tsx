import { useState } from 'react'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { Camera, CaretLeft, CaretRight, Check, LockSimple, Paperclip, Warning } from '../../components/iconos'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import { tonoInfo } from './tonos'

// MODO FOCO: una tarea a la vez (handoff "Diseño móvil", tablero 6d).
//
// Es la oportunidad grande que señala el Paso 6: todo el sistema está
// construido alrededor del PASO (la banda, el avance, el plegado, la
// acción dominante), pero frente al equipo, con una mano y guantes, la
// unidad real de trabajo es la TAREA ("desconecta el uplink del puerto
// 24"). Hasta ahora el técnico veía tres tareas, dos avisos y una
// imagen a la vez, y tenía que encontrar en ese bloque cuál le tocaba.
//
// El modelo de datos ya soportaba la unidad fina y no se toca: los
// bloques tienen id, tipo y progreso propio (`instruccionesHechas`), y
// `alternarTarea` ya marca de a una. Esta vista solo los recorre.
//
// Es un MODO, no un reemplazo: "Ver todo" vuelve a la vista de paso
// completo. El técnico experto se queda en la lista; el que hace el
// procedimiento por primera vez, o el que trabaja con guantes, entra
// aquí.

interface Props {
  paso: PasoProcedimiento
  indicePaso: number
  totalPasos: number
  tituloPaso: string
  instruccionesHechas: ReadonlySet<string>
  onAlternarTarea: (tareaId: string) => void
  onSalir: () => void
  // El técnico declara que algo va mal en esta tarea. Abre la MISMA
  // hoja de salidas que el "Falla" de la vista completa (tablero 3d);
  // lo único que aporta el foco es saber en qué tarea estaba. No sale
  // del foco: eso lo hace la salida que se elija, porque las salidas
  // ocurren en el paso completo. Cancelar deja al técnico donde estaba.
  onFalla: (textoTarea: string) => void
}

export function ModoFoco({
  paso,
  indicePaso,
  totalPasos,
  tituloPaso,
  instruccionesHechas,
  onAlternarTarea,
  onSalir,
  onFalla,
}: Props) {
  const tareas = tareasDe(paso.bloques)
  const avisos = paso.bloques.filter((b) => b.tipo === 'aviso')
  const imagenes = paso.bloques.filter((b) => b.tipo === 'imagen' && b.adjunto)
  const [indiceTarea, setIndiceTarea] = useState(() => {
    const pendiente = tareas.findIndex((t) => !instruccionesHechas.has(t.id))
    return pendiente >= 0 ? pendiente : 0
  })
  // Qué chip está desplegado. Los vínculos del paso siguen a mano pero
  // no ocupan la pantalla: lo que se lee de brazo estirado es la
  // instrucción, no su contexto.
  const [panel, setPanel] = useState<'clave' | 'fotos' | 'archivos' | null>(null)

  const tarea = tareas[Math.min(indiceTarea, tareas.length - 1)]
  if (!tarea) return null
  const hecha = instruccionesHechas.has(tarea.id)
  const hechas = tareas.filter((t) => instruccionesHechas.has(t.id)).length
  const vinculoProtegido = tarea.vinculoProtegido ?? paso.vinculoProtegido

  function marcar() {
    onAlternarTarea(tarea.id)
    // Marcar avanza a la siguiente tarea sin hacer: es el gesto de "ya
    // está, dame la que sigue". Desmarcar no mueve nada, porque quien
    // desmarca está corrigiéndose y quiere quedarse donde está.
    if (hecha) return
    const siguiente = tareas.findIndex((t, i) => i !== indiceTarea && !instruccionesHechas.has(t.id))
    if (siguiente >= 0) setIndiceTarea(siguiente)
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Cabecera mínima: dónde estoy y cómo salgo. Nada más, porque el
          modo existe para quitar de la pantalla todo lo que no es la
          tarea. */}
      <div className="flex h-14 flex-none items-center gap-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 font-mono text-sm font-semibold text-noct-neutral-400">
            {indicePaso + 1}/{totalPasos}
          </span>
          <span className="min-w-0 truncate text-[13.5px] text-noct-neutral-400">{tituloPaso}</span>
        </span>
        <button
          type="button"
          onClick={onSalir}
          className="flex h-11 shrink-0 items-center rounded-full border-[1.5px] border-noct-divider px-3.5 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.08]"
        >
          Ver todo
        </button>
      </div>

      {/* Un segmento por TAREA del paso, no por paso: dentro del foco la
          unidad es la tarea. */}
      <IndicadorAvance
        hechos={hechas}
        total={tareas.length}
        variante="segmentos"
        expandido
        actual={indiceTarea}
        className="flex-none"
      />

      <div className="flex flex-1 flex-col justify-center gap-[22px] py-7">
        <span className="inline-flex h-[34px] self-start items-center gap-1.5 rounded-full bg-noct-accent/[.18] px-3.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
          <Check size={14} aria-hidden />
          Tarea {indiceTarea + 1} de {tareas.length}
        </span>

        {/* 30 px: es lo que se lee de brazo estirado, a pleno sol, con
            el teléfono apoyado en el rack. */}
        {/* Sin tachado, igual que las casillas del paso (tablero 3d):
            si a 16 px la línea del tachado no se lee a pleno sol, a 30
            solo emborrona más texto. Lo dice el atenuado, y el botón de
            abajo dice "Hecha". */}
        <h2
          className={`text-[30px] font-medium leading-[1.25] tracking-[-.015em] text-pretty ${
            hecha ? 'text-noct-neutral-400' : 'text-noct-text'
          }`}
        >
          {tarea.texto || 'Tarea sin texto'}
        </h2>

        {/* Los avisos del paso van PEGADOS a la tarea, no en otra
            pantalla: un aviso que hay que ir a buscar no advierte. */}
        {avisos.map((aviso) => (
          <AvisoFoco key={aviso.id} aviso={aviso} />
        ))}

        {(vinculoProtegido || imagenes.length > 0 || paso.adjuntos.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {vinculoProtegido && (
              <ChipFoco
                Icono={LockSimple}
                activo={panel === 'clave'}
                onClick={() => setPanel(panel === 'clave' ? null : 'clave')}
              >
                Clave
              </ChipFoco>
            )}
            {imagenes.length > 0 && (
              <ChipFoco
                Icono={Camera}
                activo={panel === 'fotos'}
                onClick={() => setPanel(panel === 'fotos' ? null : 'fotos')}
              >
                {imagenes.length === 1 ? 'Foto' : `${imagenes.length} fotos`}
              </ChipFoco>
            )}
            {paso.adjuntos.length > 0 && (
              <ChipFoco
                Icono={Paperclip}
                activo={panel === 'archivos'}
                onClick={() => setPanel(panel === 'archivos' ? null : 'archivos')}
              >
                {paso.adjuntos.length === 1 ? 'Archivo' : `${paso.adjuntos.length} archivos`}
              </ChipFoco>
            )}
          </div>
        )}

        {panel === 'clave' && vinculoProtegido && <CredencialEnPaso vinculo={vinculoProtegido} />}
        {panel === 'fotos' &&
          imagenes.map((imagen) => (
            <BloqueVista key={imagen.id} bloque={imagen} marcada={false} onAlternar={() => {}} />
          ))}
        {panel === 'archivos' && <AdjuntosPaso adjuntos={paso.adjuntos} titulo={paso.titulo} />}
      </div>

      {/* Acción dominante de 76 px: es el ÚNICO elemento grande de la
          pantalla, así que no hay que apuntar. Con guantes, fallarlo es
          casi imposible. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-none flex-col gap-2.5 bg-gradient-to-t from-noct-bg from-55% to-transparent px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
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
          {hecha ? 'Hecha' : 'Marcar hecha'}
        </button>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={indiceTarea === 0}
            onClick={() => setIndiceTarea((i) => Math.max(0, i - 1))}
            aria-label="Tarea anterior"
            className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.08] disabled:opacity-30"
          >
            <CaretLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onFalla(tarea.texto)}
            aria-haspopup="dialog"
            aria-label="Algo va mal en esta tarea"
            className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-noct-precaucion/55 bg-noct-precaucion/10 text-[15.5px] font-medium text-noct-precaucion hover:bg-noct-precaucion/[.2]"
          >
            <Warning size={19} className="shrink-0" aria-hidden />
            Falla
          </button>
          <button
            type="button"
            disabled={indiceTarea >= tareas.length - 1}
            onClick={() => setIndiceTarea((i) => Math.min(tareas.length - 1, i + 1))}
            aria-label="Tarea siguiente"
            className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.08] disabled:opacity-30"
          >
            <CaretRight size={20} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

// El aviso en foco: barra de color a la izquierda y texto a 16 px, más
// grande que en la vista normal. Conserva su palabra además del color
// (regla R16: estado en dos canales, nunca solo color).
function AvisoFoco({ aviso }: { aviso: BloquePaso }) {
  const tono = tonoInfo(aviso.tono)
  return (
    <div className={`flex items-start gap-3 rounded-r-[10px] border-l-[3px] px-4 py-3.5 ${tono.clasesPanel}`}>
      <tono.Icono size={22} className={`mt-px shrink-0 ${tono.claseIcono}`} aria-hidden />
      <p className="min-w-0 text-base leading-[1.45] text-pretty">
        <span className={`font-semibold ${tono.claseIcono}`}>{tono.etiqueta}.</span> {aviso.texto}
      </p>
    </div>
  )
}

// Chip de 52 px que despliega un vínculo del paso sin sacarlo de la
// pantalla: la clave, las fotos o los archivos.
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
