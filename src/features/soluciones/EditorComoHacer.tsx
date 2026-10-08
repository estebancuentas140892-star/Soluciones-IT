import { useId, useState, type ReactNode, type Ref } from 'react'
import { CLASE_CAMPO_SIN_ANCHO } from '../../components/campos'
import { ArrowDown, ArrowElbowDownRight, ArrowUp, Plus, TrashSimple, Warning } from '../../components/iconos'
import {
  camposQueFaltan,
  crearMicroPaso,
  ROTULO_COMO_HACERLO,
  textoDeLoQueFalta,
  type CampoObligatorio,
} from '../../lib/comoHacer'
import type { MicroPasoComoHacer } from '../../lib/db'
import { moverPorId } from './bloquesEditor'
import { BotonIconoLinea } from './controlesEditor'

// "CÓMO HACERLO" DE UNA ACCIÓN, EN EL EDITOR (tarea 303).
//
// Bajo la línea de una tarea de acción, en el orden en que lo leerá el
// técnico: una fila por microacción, con su acción, su elemento y, solo si
// hace falta, su ubicación. Las mismas filas dan la ruta rápida y el paso a
// paso de la ejecución (las dos con la frase acción más elemento, desde la
// tarea 309): no hay un segundo texto que escribir. Se añaden, se quitan y se reordenan aquí
// mismo, con las flechas de 44 px de siempre, y cada una conserva su id al
// moverla o editarla.
//
// ACCIÓN Y ELEMENTO SON OBLIGATORIOS; la ubicación, no. Una fila a medio
// escribir lo dice en su sitio ("Falta el elemento.") y marca el campo, sin
// borrar nada de lo escrito; el formulario no deja guardar mientras quede
// una (`microaccionesIncompletas`) y trae el foco a su primer campo vacío
// (`focoPedido`). Una fila del todo vacía no es una microacción: no se
// guarda y no impide guardar.
//
// Rótulos fijos a la vista, sin ejemplos dentro de los campos: qué gestos
// lleva una guía real lo decide quien escribe su contenido (regla 26). La
// ayuda solo dice para qué sirven.

type ControlConFoco = 'accion' | 'subir' | 'bajar' | 'quitar'

/** El campo de una microacción al que hay que llevar el foco (el primero que le falta). */
export interface FocoMicroPaso {
  microPasoId: string
  campo: CampoObligatorio
}

export function EditorComoHacer({
  microPasos,
  enfocarId = null,
  focoPedido = null,
  onFocoAplicado,
  onCambiar,
  onVaciado,
}: {
  microPasos: MicroPasoComoHacer[]
  /** La microacción recién creada desde fuera, para escribir su acción sin buscarla. */
  enfocarId?: string | null
  /** El campo vacío que el formulario pide enfocar al no dejar guardar. */
  focoPedido?: FocoMicroPaso | null
  /** Ya tiene el foco: el formulario olvida el pedido. */
  onFocoAplicado?: () => void
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

  // La acción o el elemento: además del foco de siempre (la acción de una
  // fila nueva), el que pide el formulario cuando no deja guardar. Ese va
  // al centro de la pantalla para que la barra fija del pie no lo tape.
  function refDeCampo(id: string, campo: CampoObligatorio) {
    const propio = campo === 'accion' ? conFoco(id, 'accion') : null
    return (elemento: HTMLInputElement | null) => {
      propio?.(elemento)
      if (elemento && focoPedido?.microPasoId === id && focoPedido.campo === campo) {
        elemento.focus({ preventScroll: true })
        elemento.scrollIntoView({ block: 'center' })
        onFocoAplicado?.()
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
            <FilaMicro
              key={micro.id}
              micro={micro}
              numero={numero}
              faltan={camposQueFaltan(micro)}
              controles={
                <>
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
                </>
              }
              refAccion={refDeCampo(micro.id, 'accion')}
              refElemento={refDeCampo(micro.id, 'elemento')}
              onCambiar={(cambios) => cambiar(micro.id, cambios)}
            />
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

// Una microacción: su número y sus controles arriba; acción y elemento lado
// a lado (el elemento, más ancho: suele ser lo más largo); lo que le falta,
// justo debajo de los dos; y la ubicación, opcional, al final.
function FilaMicro({
  micro,
  numero,
  faltan,
  controles,
  refAccion,
  refElemento,
  onCambiar,
}: {
  micro: MicroPasoComoHacer
  numero: number
  faltan: CampoObligatorio[]
  controles: ReactNode
  refAccion: Ref<HTMLInputElement>
  refElemento: Ref<HTMLInputElement>
  onCambiar: (cambios: Partial<MicroPasoComoHacer>) => void
}) {
  const idFalta = useId()
  const falta = (campo: CampoObligatorio) => faltan.includes(campo)
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-noct-divider px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noct-neutral-600 font-mono text-[12px] text-noct-neutral-300"
        >
          {numero}
        </span>
        <span className="min-w-0 flex-1" />
        {controles}
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <CampoMicro
          etiqueta="Acción"
          numero={numero}
          valor={micro.accion}
          obligatorio
          invalido={falta('accion')}
          idError={falta('accion') ? idFalta : undefined}
          campoRef={refAccion}
          onCambiar={(accion) => onCambiar({ accion })}
        />
        <CampoMicro
          etiqueta="Elemento"
          numero={numero}
          valor={micro.elemento}
          obligatorio
          invalido={falta('elemento')}
          idError={falta('elemento') ? idFalta : undefined}
          campoRef={refElemento}
          onCambiar={(elemento) => onCambiar({ elemento })}
        />
      </div>
      {faltan.length > 0 && (
        <p id={idFalta} className="-mt-0.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-noct-error">
          <Warning size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span className="min-w-0">{textoDeLoQueFalta(faltan)}</span>
        </p>
      )}
      <CampoMicro
        etiqueta="Ubicación (opcional)"
        numero={numero}
        valor={micro.ubicacion ?? ''}
        onCambiar={(ubicacion) => onCambiar({ ubicacion })}
      />
    </li>
  )
}

// Un campo de una microacción: su rótulo a la vista y, para quien no lo ve,
// de qué microacción es ("Acción de la microacción 2"). Si le falta lo
// obligatorio, el borde lo marca y el aviso de la fila lo describe.
function CampoMicro({
  etiqueta,
  numero,
  valor,
  onCambiar,
  campoRef,
  obligatorio = false,
  invalido = false,
  idError,
}: {
  etiqueta: string
  numero: number
  valor: string
  onCambiar: (valor: string) => void
  campoRef?: Ref<HTMLInputElement>
  obligatorio?: boolean
  invalido?: boolean
  idError?: string
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
        aria-required={obligatorio || undefined}
        aria-invalid={invalido || undefined}
        aria-describedby={idError}
        className={`min-h-11 w-full text-[14.5px] ${CLASE_CAMPO_SIN_ANCHO} ${invalido ? 'border-noct-error' : ''}`}
      />
    </div>
  )
}
