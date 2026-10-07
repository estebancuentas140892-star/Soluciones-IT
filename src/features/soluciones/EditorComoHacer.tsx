import { useId, useState, type Ref } from 'react'
import { CLASE_CAMPO_SIN_ANCHO } from '../../components/campos'
import { ArrowDown, ArrowElbowDownRight, ArrowUp, Plus, TrashSimple } from '../../components/iconos'
import { crearMicroPaso, ROTULO_COMO_HACERLO } from '../../lib/comoHacer'
import type { MicroPasoComoHacer } from '../../lib/db'
import { moverPorId } from './bloquesEditor'
import { BotonIconoLinea } from './controlesEditor'

// "CÓMO HACERLO" DE UNA ACCIÓN, EN EL EDITOR (tarea 303).
//
// Bajo la línea de una tarea de acción, en el orden en que lo leerá el
// técnico: una fila por microacción, con su acción, su elemento y, solo si
// hace falta, su ubicación. Las mismas filas dan la ruta rápida (los
// elementos) y el paso a paso (las frases) de la ejecución: no hay un
// segundo texto que escribir. Se añaden, se quitan y se reordenan aquí
// mismo, con las flechas de 44 px de siempre, y cada una conserva su id al
// moverla o editarla.
//
// Rótulos fijos a la vista, sin ejemplos dentro de los campos: qué gestos
// lleva una guía real lo decide quien escribe su contenido (regla 26). La
// ayuda solo dice para qué sirven. Una fila vacía no se guarda.

type ControlConFoco = 'accion' | 'subir' | 'bajar' | 'quitar'

export function EditorComoHacer({
  microPasos,
  enfocarId = null,
  onCambiar,
  onVaciado,
}: {
  microPasos: MicroPasoComoHacer[]
  /** La microacción recién creada desde fuera, para escribir su acción sin buscarla. */
  enfocarId?: string | null
  /** La lista nueva, ya en su orden. Vacía, la tarea se queda sin "Cómo hacerlo". */
  onCambiar: (microPasos: MicroPasoComoHacer[]) => void
  /** Se quitó la última: el foco vuelve a quien abrió "Cómo hacerlo". */
  onVaciado?: () => void
}) {
  const idRotulo = useId()
  const idAyuda = useId()
  // El control que recibe el foco en cuanto existe: la acción de una fila
  // nueva, la flecha que se acaba de usar (en su sitio nuevo) o el "Quitar"
  // de la fila que ocupa el sitio de la que se quitó. Sin esto, mover o
  // quitar con el teclado dejaba el foco perdido en la página.
  const [foco, setFoco] = useState<{ id: string; control: ControlConFoco } | null>(
    enfocarId ? { id: enfocarId, control: 'accion' } : null,
  )

  function conFoco(id: string, control: ControlConFoco) {
    return (elemento: HTMLElement | null) => {
      if (elemento && foco?.id === id && foco.control === control) {
        elemento.focus()
        setFoco(null)
      }
    }
  }

  function cambiar(id: string, cambios: Partial<MicroPasoComoHacer>) {
    onCambiar(microPasos.map((micro) => (micro.id === id ? { ...micro, ...cambios } : micro)))
  }

  function agregar() {
    const nueva = crearMicroPaso()
    onCambiar([...microPasos, nueva])
    setFoco({ id: nueva.id, control: 'accion' })
  }

  function mover(id: string, direccion: -1 | 1) {
    const destino = microPasos.findIndex((micro) => micro.id === id) + direccion
    onCambiar(moverPorId(microPasos, id, direccion))
    // La flecha que se tocó, salvo que en su sitio nuevo ya no haga nada (la
    // primera no sube, la última no baja): entonces, la otra.
    const enUnExtremo = direccion === -1 ? destino === 0 : destino === microPasos.length - 1
    const usada = direccion === -1 ? 'subir' : 'bajar'
    setFoco({ id, control: enUnExtremo ? (usada === 'subir' ? 'bajar' : 'subir') : usada })
  }

  function quitar(id: string) {
    const indice = microPasos.findIndex((micro) => micro.id === id)
    const resto = microPasos.filter((micro) => micro.id !== id)
    onCambiar(resto)
    if (resto.length === 0) {
      onVaciado?.()
      return
    }
    setFoco({ id: resto[Math.min(indice, resto.length - 1)].id, control: 'quitar' })
  }

  return (
    <div role="group" aria-labelledby={idRotulo} aria-describedby={idAyuda} className="ml-1 flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p id={idRotulo} className="flex items-center gap-1.5 text-[13px] font-medium text-noct-neutral-200">
          <ArrowElbowDownRight size={14} className="shrink-0 text-noct-neutral-400" aria-hidden />
          {ROTULO_COMO_HACERLO}
        </p>
        <div id={idAyuda} className="flex flex-col gap-0.5 text-[12px] leading-snug text-noct-neutral-400">
          <p>Pasos necesarios para realizar esta acción. Se usarán para mostrar una ruta rápida y un paso a paso.</p>
          <p>La ubicación solo hace falta cuando el elemento puede ser difícil de encontrar.</p>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {microPasos.map((micro, indice) => {
          const numero = indice + 1
          return (
            <li key={micro.id} className="flex flex-col gap-2 rounded-lg border border-noct-divider px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noct-neutral-600 font-mono text-[12px] text-noct-neutral-300"
                >
                  {numero}
                </span>
                <span className="min-w-0 flex-1" />
                <BotonIconoLinea
                  ref={conFoco(micro.id, 'subir')}
                  Icono={ArrowUp}
                  etiqueta={`Subir la microacción ${numero}`}
                  onClick={() => mover(micro.id, -1)}
                  disabled={indice === 0}
                />
                <BotonIconoLinea
                  ref={conFoco(micro.id, 'bajar')}
                  Icono={ArrowDown}
                  etiqueta={`Bajar la microacción ${numero}`}
                  onClick={() => mover(micro.id, 1)}
                  disabled={indice === microPasos.length - 1}
                />
                <BotonIconoLinea
                  ref={conFoco(micro.id, 'quitar')}
                  Icono={TrashSimple}
                  etiqueta={`Quitar la microacción ${numero}`}
                  onClick={() => quitar(micro.id)}
                />
              </div>
              {/* La acción es un verbo corto; el elemento, lo que más se
                  lee (forma la ruta rápida), se lleva más ancho. */}
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                <CampoMicro
                  etiqueta="Acción"
                  numero={numero}
                  valor={micro.accion}
                  campoRef={conFoco(micro.id, 'accion')}
                  onCambiar={(accion) => cambiar(micro.id, { accion })}
                />
                <CampoMicro
                  etiqueta="Elemento"
                  numero={numero}
                  valor={micro.elemento}
                  onCambiar={(elemento) => cambiar(micro.id, { elemento })}
                />
              </div>
              <CampoMicro
                etiqueta="Ubicación (opcional)"
                numero={numero}
                valor={micro.ubicacion ?? ''}
                onCambiar={(ubicacion) => cambiar(micro.id, { ubicacion })}
              />
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        onClick={agregar}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-noct-neutral-700 text-[13px] font-medium text-noct-accent-300 hover:border-noct-accent hover:bg-noct-accent/[.08]"
      >
        <Plus size={15} aria-hidden />
        Añadir microacción
      </button>
    </div>
  )
}

// Un campo de una microacción: su rótulo a la vista y, para quien no lo ve,
// de qué microacción es ("Acción de la microacción 2").
function CampoMicro({
  etiqueta,
  numero,
  valor,
  onCambiar,
  campoRef,
}: {
  etiqueta: string
  numero: number
  valor: string
  onCambiar: (valor: string) => void
  campoRef?: Ref<HTMLInputElement>
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium leading-snug text-noct-neutral-400">
        {etiqueta}
        <span className="sr-only"> de la microacción {numero}</span>
      </label>
      <input
        id={id}
        ref={campoRef}
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className={`min-h-11 w-full text-[14.5px] ${CLASE_CAMPO_SIN_ANCHO}`}
      />
    </div>
  )
}
