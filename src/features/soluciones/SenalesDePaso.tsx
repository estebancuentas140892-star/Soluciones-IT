import { useId, useState } from 'react'
import { ArrowElbowDownRight, CaretDown, Code, Eye } from '../../components/iconos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { ImagenAmpliable } from '../../components/VisorImagen'
import {
  comoHacerQueSeEnsena,
  fraseDeMicroPaso,
  llevaPuntoFinal,
  pasoAPasoAportaAlgo,
  ROTULO_RUTA_RAPIDA,
} from '../../lib/comoHacer'
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
//     instrucción y en voz más baja que ella. Primero la ruta rápida (la
//     secuencia ejecutable, con sus verbos, para quien ya sabe orientarse)
//     y, plegado y solo si añade algo, el paso a paso numerado (para quien
//     llega nuevo). Texto normal, sin caja ni color de estado: es apoyo
//     operativo, no un aviso ni un valor.
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
// la vez), bajo la fila de una tarea (paso entero, lectura y "Probar") o
// en la lectura compacta de una guía reutilizada. `sangria` alinea el
// paso a paso con el texto de la ruta (el icono y su hueco).
const TAMANOS_COMO_HACERLO = {
  accion: { ruta: 'text-[16px]', icono: 17, margen: 'mt-[3px]', sangria: 'pl-[25px]', paso: 'text-[15px]', ubicacion: 'text-[13px]', boton: 'text-[14px]' },
  fila: { ruta: 'text-[14px]', icono: 15, margen: 'mt-[2px]', sangria: 'pl-[23px]', paso: 'text-[14px]', ubicacion: 'text-[12.5px]', boton: 'text-[13px]' },
  lectura: { ruta: 'text-[13px]', icono: 14, margen: 'mt-[2px]', sangria: 'pl-[22px]', paso: 'text-[13px]', ubicacion: 'text-[12px]', boton: 'text-[13px]' },
} as const

// CÓMO HACERLO (tarea 303; ruta ejecutable desde la tarea 309): las
// microacciones de la acción, con UN solo contenido y dos niveles de lectura
// (ver `src/lib/comoHacer.ts`). Recibe solo microacciones completas
// (`comoHacerDe`): cada una tiene acción y elemento, así que aquí no hay
// sustitutos. Cada microacción se dice siempre con `fraseDeMicroPaso`.
//
//   - NADA CON MENOS DE DOS (`comoHacerQueSeEnsena`): una sola microacción
//     pertenece a la instrucción principal, que ya la dice.
//   - RUTA RÁPIDA, siempre a la vista: la secuencia ejecutable condensada,
//     cada microacción con su verbo, en orden y separadas por "›" ("Abre o
//     crea la carpeta de la persona › Copia el archivo .pst › Pega el archivo
//     .pst en la carpeta del servidor"). Es lo que lee de un vistazo quien ya
//     sabe orientarse. Antes eran solo los elementos, y un nombre suelto no
//     dice qué hacer con él. Envuelve en varias líneas cuando no cabe y nunca
//     recorta ni abrevia: el separador va pegado a la frase anterior, así que
//     ninguna línea empieza por él.
//   - VER PASO A PASO, plegado y SOLO SI DICE ALGO NUEVO
//     (`pasoAPasoAportaAlgo`): las mismas frases numeradas, con la ubicación
//     debajo. Sin ninguna ubicación serían la ruta otra vez, con números, y
//     no se ofrece. Ligero, sin tarjetas, y subordinado a la instrucción por
//     la sangría y la raya, no por una caja.
//
// Cuelga de la instrucción (la flecha en ángulo). Lo desplegado es de esta
// acción: quien la cambia por otra le da otra `key`, y vuelve plegado.
// Nada se interpreta: un comando escrito como elemento conserva el
// tratamiento de siempre ("¿Qué hace?", `QueHaceEnTexto`, fuera de aquí).
export function ComoHacerlo({
  microPasos,
  variante = 'accion',
  className = '',
}: {
  microPasos: MicroPasoComoHacer[]
  variante?: keyof typeof TAMANOS_COMO_HACERLO
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const idRuta = useId()
  const idPasoAPaso = useId()
  const microacciones = comoHacerQueSeEnsena(microPasos)
  if (microacciones.length === 0) return null
  const tamano = TAMANOS_COMO_HACERLO[variante]
  const frases = microacciones.map((micro) => ({ id: micro.id, frase: fraseDeMicroPaso(micro), ubicacion: micro.ubicacion }))
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <div className={`flex items-start gap-2 leading-snug ${tamano.ruta}`}>
        <ArrowElbowDownRight size={tamano.icono} className={`${tamano.margen} shrink-0 text-noct-neutral-400`} aria-hidden />
        <div className="min-w-0 text-pretty [overflow-wrap:anywhere]">
          <span id={idRuta} className="font-medium text-noct-neutral-400">
            {ROTULO_RUTA_RAPIDA}:{' '}
          </span>
          {/* Una lista de verdad (el orden importa) que se lee como una
              línea: `role` la conserva aunque se dibuje en línea. */}
          <ol role="list" aria-labelledby={idRuta} className="inline">
            {frases.map(({ id, frase }, indice) => (
              <li key={id} className="inline text-noct-neutral-200">
                {frase}
                {indice < frases.length - 1 && (
                  <span aria-hidden className="text-noct-neutral-500">
                    {' ›'}{' '}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {pasoAPasoAportaAlgo(microacciones) && (
        <div className={`flex flex-col ${tamano.sangria}`}>
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={abierto ? idPasoAPaso : undefined}
            onClick={() => setAbierto((valor) => !valor)}
            className={`-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 font-medium text-noct-neutral-300 hover:text-noct-text ${tamano.boton}`}
          >
            {abierto ? 'Ocultar paso a paso' : 'Ver paso a paso'}
            <CaretDown size={13} className={`shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {abierto && (
            <ol
              id={idPasoAPaso}
              className={`mb-1 list-decimal space-y-1.5 border-l-2 border-noct-divider pl-7 leading-snug text-noct-neutral-200 marker:text-noct-neutral-400 ${tamano.paso}`}
            >
              {frases.map(({ id, frase, ubicacion }) => (
                <li key={id} className="pl-0.5">
                  <span className="text-pretty [overflow-wrap:anywhere]">
                    {frase}
                    {llevaPuntoFinal(frase) && '.'}
                  </span>
                  {ubicacion && (
                    <span className={`mt-0.5 block text-pretty text-noct-neutral-400 [overflow-wrap:anywhere] ${tamano.ubicacion}`}>
                      <span className="sr-only">Ubicación: </span>
                      {ubicacion}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

// UN DATO TÉCNICO: el valor exacto que hace falta para la acción (una IP,
// un puerto, una ruta, un comando, un nombre de archivo). Su rótulo dice
// qué es, y la monoespaciada, que se escribe tal cual: así no se lee como
// una segunda instrucción.
export function DatoTecnico({ texto }: { texto: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        <Code size={13} className="shrink-0" aria-hidden />
        Dato técnico
      </p>
      <p className="w-fit max-w-full rounded-md bg-noct-text/[.06] px-2.5 py-1.5 font-mono text-[14.5px] leading-snug text-noct-neutral-200 [overflow-wrap:anywhere]">
        {texto || 'Dato sin texto'}
      </p>
    </div>
  )
}

// Tamaños según dónde se lee, los mismos tres sitios que "Cómo hacerlo".
const TAMANOS_DEBES_VER = {
  accion: { boton: 'text-[14px]', icono: 16 },
  fila: { boton: 'text-[13px]', icono: 15 },
  lectura: { boton: 'text-[13px]', icono: 14 },
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
        className={`-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 font-medium text-noct-exito hover:bg-noct-text/[.05] ${tamano.boton}`}
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
