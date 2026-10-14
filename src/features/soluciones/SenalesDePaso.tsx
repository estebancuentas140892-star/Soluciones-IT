import { useId, useState } from 'react'
import { ArrowElbowDownRight, CaretDown, Code, Eye } from '../../components/iconos'
import { BotonCopiar } from '../../components/FilaDato'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { ImagenAmpliable } from '../../components/VisorImagen'
import { comoHacerQueSeEnsena, fraseDeMicroPaso, llevaPuntoFinal, ROTULO_COMO_HACERLO } from '../../lib/comoHacer'
import type { MicroPasoComoHacer, ResultadoVisual } from '../../lib/db'
import { ROTULO_DEBES_VER } from '../../lib/resultadoVisual'

// LAS SEÑALES DE UNA ACCIÓN (encargo del 2026-09-22; tareas 303 y 307).
//
// Lo que acompaña a la instrucción para hacerla: CÓMO HACERLO, el DATO
// TÉCNICO que necesita y, al final, cómo DEBES VER la pantalla cuando
// salió bien. Viven aparte porque los usan las tres vistas de una guía (una
// acción a la vez, el paso entero y la lectura, también "Probar") y la
// lectura de una guía reutilizada, y ModoFoco ya importa de
// ProcedimientoVista: tenerlos en cualquiera de los dos cerraría un ciclo
// de importaciones.
//
// LA EJECUCIÓN MÍNIMA (tarea 307, AD-068). La pantalla responde "¿qué hago
// ahora y cómo lo hago?" y solo la instrucción manda (26 px). Estas señales
// pesan menos que ella y se distinguen por icono, palabra, tipografía y
// espacio antes que por fondos y bordes:
//
//   - Cómo hacerlo: las microacciones que hacen la acción, pegadas a la
//     instrucción y en voz más baja que ella: una lista numerada, a la
//     vista (tarea 310). Texto normal, sin caja ni color de estado: es
//     apoyo operativo, no un aviso ni un valor.
//   - Dato técnico: un valor exacto que la acción necesita, con su rótulo
//     y en monoespaciada, subordinado a la instrucción.
//   - Debes ver: la IMAGEN del resultado, plegada. No ocupa sitio hasta que
//     se pide, y sin imagen no existe.
//
// "Dónde" y el "Debes ver" de texto se retiraron (tarea 307): la guía ya
// lleva al sitio, lo que cuesta encontrar es la ubicación de una
// microacción, y una frase sobre una ventana que nunca se ha visto no la
// enseña. El único bloque con fondo de color sigue siendo el riesgo real
// (Precaución e Importante, en tonos.ts).

// Tamaños según dónde se lee: bajo la instrucción de 26 px (una acción a
// la vez), bajo la fila de una tarea de 16 px (paso entero, lectura y
// "Probar") o bajo la tarea de 14 px de la lectura compacta de una guía
// reutilizada. La lista va siempre por debajo de lo que la sostiene: en
// una vista compacta, ni los números ni las frases crecen más que su tarea.
const TAMANOS_COMO_HACERLO = {
  accion: { rotulo: 'text-[12px]', icono: 13, lista: 'text-[16px] space-y-1.5', ubicacion: 'text-[13px]' },
  fila: { rotulo: 'text-[12px] md:text-[11.5px]', icono: 12, lista: 'text-[14px] space-y-1', ubicacion: 'text-[12.5px]' },
  lectura: { rotulo: 'text-[12px] md:text-[11px]', icono: 12, lista: 'text-[13px] space-y-1', ubicacion: 'text-[12px]' },
} as const

// El número de cada microacción en la ejecución: una caja de 24 px con el
// contador `micro` de su lista (ver `ComoHacerlo`). Solo en el teléfono
// (tarea 338): desde 768 px no hay caja y numera el navegador, como antes.
const NUMERO_EN_CAJA =
  'relative min-h-6 pl-9 [counter-increment:micro] before:absolute before:left-0 before:top-[-1px] before:flex before:h-6 before:w-6 before:items-center before:justify-center before:rounded-[7px] before:bg-noct-text/[.06] before:font-mono before:text-[13px] before:font-semibold before:text-noct-neutral-300 before:content-[counter(micro)] md:static md:min-h-0 md:pl-0.5 md:before:hidden'

// CÓMO HACERLO (tarea 303; una sola lista numerada desde la tarea 310,
// AD-071): las microacciones de la acción (ver `src/lib/comoHacer.ts`).
// Recibe solo microacciones completas (`comoHacerDe`): cada una tiene
// acción y elemento, así que aquí no hay sustitutos.
//
//   - NADA CON MENOS DE DOS (`comoHacerQueSeEnsena`): una sola microacción
//     pertenece a la instrucción principal, que ya la dice.
//   - CON DOS O MÁS, UNA LISTA NUMERADA A LA VISTA, sin nada que pulsar:
//     cada microacción en su línea, dicha con `fraseDeMicroPaso` y cerrada
//     con su punto (`llevaPuntoFinal`). Los números dicen dónde se está, qué
//     se acaba de hacer y qué sigue. La secuencia en una línea (la "Ruta
//     rápida" de la tarea 309, separada por "›") se volvía un párrafo largo
//     en cuanto había varios gestos, y el paso a paso plegado la repetía.
//   - LA UBICACIÓN, debajo de su microacción, más pequeña y en gris: dice
//     dónde está el elemento sin competir con lo que se hace, alineada con
//     el texto de su número. No decide si hay lista: solo acompaña a la suya.
//
// Una lista ordenada de verdad (`ol` con sus `li`): el orden y la posición
// llegan también a quien usa lector de pantalla. Los números van fuera del
// texto (los del navegador o, en la ejecución desde la tarea 328, los de su
// caja pequeña): una frase larga envuelve alineada con la suya, nunca bajo
// el número. Ligera, sin tarjetas: la numeración y el espacio vertical
// ordenan, y la flecha en ángulo del rótulo la cuelga de la instrucción. Nada se interpreta: un comando
// escrito como elemento conserva el tratamiento de siempre ("¿Qué hace?",
// `QueHaceEnTexto`, fuera de aquí).
export function ComoHacerlo({
  microPasos,
  variante = 'accion',
  className = '',
}: {
  microPasos: MicroPasoComoHacer[]
  variante?: keyof typeof TAMANOS_COMO_HACERLO
  className?: string
}) {
  const idRotulo = useId()
  const microacciones = comoHacerQueSeEnsena(microPasos)
  if (microacciones.length === 0) return null
  const tamano = TAMANOS_COMO_HACERLO[variante]
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <p
        id={idRotulo}
        className={`flex items-center gap-1.5 font-semibold uppercase tracking-[.06em] text-noct-neutral-400 ${tamano.rotulo}`}
      >
        <ArrowElbowDownRight size={tamano.icono} className="shrink-0" aria-hidden />
        {ROTULO_COMO_HACERLO}
      </p>
      {/* EN LA EJECUCIÓN, EL NÚMERO EN SU CAJA (rediseño móvil "1b Pulgar",
          tarea 328): 24 px, monoespaciada y fondo tenue, a la izquierda de
          cada frase, dibujada con un contador de CSS. Es lo único con fondo y
          monoespaciada de la lista: la frase sigue siendo texto normal, así
          que no se confunde con un dato técnico, y cada `li` conserva solo
          su frase y su ubicación. En las vistas de lista, los números del
          navegador; y también en la ejecución desde 768 px (tarea 338), con
          la lista de antes del rediseño. */}
      <ol
        aria-labelledby={idRotulo}
        className={
          variante === 'accion'
            ? 'flex list-none flex-col gap-2.5 pt-1 text-[16px] leading-[1.4] text-noct-text [counter-reset:micro] md:block md:list-decimal md:space-y-1.5 md:pl-[1.6em] md:pt-0 md:leading-snug md:text-noct-neutral-200 md:tabular-nums md:marker:text-noct-neutral-400'
            : `list-decimal pl-[1.6em] leading-snug text-noct-neutral-200 tabular-nums marker:text-noct-neutral-400 ${tamano.lista}`
        }
      >
        {microacciones.map((micro) => {
          const frase = fraseDeMicroPaso(micro)
          return (
            <li key={micro.id} className={variante === 'accion' ? NUMERO_EN_CAJA : 'pl-0.5'}>
              <span className="text-pretty [overflow-wrap:anywhere]">
                {frase}
                {llevaPuntoFinal(frase) && '.'}
              </span>
              {micro.ubicacion && (
                <span className={`mt-0.5 block text-pretty text-noct-neutral-400 [overflow-wrap:anywhere] ${tamano.ubicacion}`}>
                  <span className="sr-only">Ubicación: </span>
                  {micro.ubicacion}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// UN DATO TÉCNICO: el valor exacto que hace falta para la acción (una IP,
// un puerto, una ruta, un comando, un nombre de archivo). Su rótulo dice
// qué es, y la monoespaciada, que se escribe tal cual: así no se lee como
// una segunda instrucción.
//
// Desde el rediseño móvil "1b Pulgar" (tarea 328) ocupa el ancho, con
// IBM Plex Mono a 15 px y un botón de copiar de 44 px a su derecha: el dato
// se viene a copiar, no a teclear mirando la pantalla. Sin texto no hay qué
// copiar, y no se ofrece.
//
// Desde 768 px (tarea 338), la forma de antes: el dato en su caja pequeña,
// a su medida y con la letra de entonces; el botón de copiar, a su lado.
export function DatoTecnico({ texto }: { texto: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 md:gap-1">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        <Code size={13} className="shrink-0" aria-hidden />
        Dato técnico
      </p>
      <div className="flex min-w-0 items-center gap-2 rounded-xl bg-noct-text/[.06] py-1 pl-3 pr-1 md:w-fit md:max-w-full md:rounded-none md:bg-transparent md:p-0">
        <p className="min-w-0 flex-1 py-1.5 font-mono text-[15px] leading-[1.35] text-noct-neutral-100 [overflow-wrap:anywhere] md:flex-initial md:rounded-md md:bg-noct-text/[.06] md:px-2.5 md:text-[14.5px] md:leading-snug md:text-noct-neutral-200">
          {texto || 'Dato sin texto'}
        </p>
        {texto && <BotonCopiar etiqueta="el dato" texto={texto} destacado />}
      </div>
    </div>
  )
}

// Tamaños según dónde se lee, los mismos tres sitios que "Cómo hacerlo".
const TAMANOS_DEBES_VER = {
  accion: { boton: 'text-[15px] font-semibold md:text-[14px] md:font-medium md:[&>svg:first-child]:size-4', icono: 18 },
  fila: { boton: 'text-[13px] font-medium', icono: 15 },
  lectura: { boton: 'text-[13px] font-medium', icono: 14 },
} as const

// DEBES VER (tarea 307): cómo debe quedar la pantalla cuando la acción
// salió bien, para quien nunca la ha visto. Es una IMAGEN, no un párrafo:
//
//   - Plegada al llegar. No ocupa sitio hasta que se pide, y se pide con un
//     control de 44 px con su ojo y su palabra en el verde de lo que
//     confirma, después de todo lo que se usa para hacer la acción.
//   - Al abrirla, la imagen a todo el ancho; tocarla la amplía en el visor
//     de siempre (zoom con dos dedos, cerrar con Escape). La descripción,
//     si el autor la escribió, es su texto alternativo y el pie del visor.
//   - Sin imagen, nada: no se rellena el hueco con texto (`resultado`).
//
// La imagen se pide solo al abrir (el componente de dentro se monta
// entonces): una pantalla que no la necesita no la descarga. Lo desplegado
// es de esta acción: quien la cambia por otra le da otra `key`, y vuelve
// plegada.
export function DebesVer({
  resultado,
  variante = 'accion',
  className = '',
}: {
  resultado: ResultadoVisual | null
  variante?: keyof typeof TAMANOS_DEBES_VER
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const idImagen = useId()
  if (!resultado) return null
  const tamano = TAMANOS_DEBES_VER[variante]
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? idImagen : undefined}
        onClick={() => setAbierto((valor) => !valor)}
        className={`-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 text-noct-exito hover:bg-noct-text/[.05] ${tamano.boton}`}
      >
        <Eye size={tamano.icono} className="shrink-0" aria-hidden />
        {ROTULO_DEBES_VER}
        <CaretDown
          size={13}
          className={`shrink-0 text-noct-neutral-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {abierto && (
        <div id={idImagen}>
          <ImagenDelResultado resultado={resultado} />
        </div>
      )}
    </div>
  )
}

function ImagenDelResultado({ resultado }: { resultado: ResultadoVisual }) {
  const url = useUrlAdjunto(resultado.adjunto.referencia)
  const descripcion = resultado.descripcion ?? null
  if (!url) {
    return (
      <p className="rounded-lg border border-dashed border-noct-neutral-700 px-3 py-4 text-center text-[12.5px] leading-snug text-noct-neutral-400">
        La imagen no está en este dispositivo. Si estás sin conexión, usa "Descargar todo para offline" con señal.
      </p>
    )
  }
  return (
    <ImagenAmpliable
      url={url}
      alt={descripcion ?? 'Cómo debe verse la pantalla al terminar esta acción'}
      pie={descripcion}
      claseBoton="border border-noct-divider bg-noct-surface"
      className="max-h-80 w-full object-contain"
    />
  )
}
