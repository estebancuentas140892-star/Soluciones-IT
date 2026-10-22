import type { ReactNode } from 'react'
import type { MicroPasoComoHacer } from '../../lib/db'
import { IconoVentana } from './IconoVentana'

// LAS FILAS DE LA VENTANA (tarea 348): lo que se lee y se hace dentro de ella.
//
// Una instrucción NO lleva casilla: el técnico no marca acción por acción, la
// ventana se cierra con un solo "Listo". El número es para situarse ("voy por
// la 3") y, junto con el texto, lo único que hay que leer. Lo que cuelga de la
// instrucción ("Debes ver", la credencial) va debajo, alineado con el texto y
// no con el número.
//
// COMO EL PROTOTIPO DE CLAUDE DESIGN (tarea 350): el texto a 19/27 y el número
// en su círculo de 30 con el tinte del acento. Una acción con su «Cómo
// hacerlo» (dos microacciones o más) se lee como en el prototipo: la
// instrucción encabeza, a 15 en tinta 2, y debajo cada microacción en su
// número, con lo que se hace y, en negrita, con qué; su ubicación, debajo. La
// numeración sigue por toda la ventana (`numerarFilasDeVentana`): los números
// dicen dónde se va de lo que se tiene delante. Es la misma lista numerada a
// la vista de la regla 27 c, sin el rótulo «Cómo hacerlo», que la instrucción
// encima ya hace de encabezado.

const TEXTO_FILA = 'min-w-0 flex-1 text-[19px] font-medium leading-[27px] text-pretty [overflow-wrap:anywhere]'

function Numero({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-noct-accent-900 text-[15px] font-extrabold leading-none text-noct-accent-300"
    >
      {n}
    </span>
  )
}

interface FilaInstruccionProps {
  /** El número de la primera fila de esta acción en la ventana. */
  numero: number
  texto: string
  /** Las microacciones que se enseñan (dos o más), o ninguna. */
  microacciones?: MicroPasoComoHacer[]
  /** "Debes ver" y lo demás que cuelga de esta instrucción. */
  children?: ReactNode
}

export function FilaInstruccion({ numero, texto, microacciones = [], children }: FilaInstruccionProps) {
  const conMicro = microacciones.length >= 2
  return (
    <div data-fila-ventana className="flex flex-col gap-2.5">
      {conMicro ? (
        <>
          <p className="text-[15px] font-semibold leading-[21px] text-noct-neutral-300 text-pretty [overflow-wrap:anywhere]">
            {texto}
          </p>
          <ol className="flex flex-col gap-3">
            {microacciones.map((micro, i) => (
              <li key={micro.id} data-instruccion-ventana={numero + i} className="flex items-start gap-3">
                <Numero n={numero + i} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className={TEXTO_FILA}>
                    <span className="sr-only">Paso {numero + i}: </span>
                    {micro.accion.trim()} <strong className="font-extrabold">{micro.elemento.trim()}</strong>
                  </p>
                  {micro.ubicacion && (
                    <p className="text-[14.5px] font-semibold leading-5 text-noct-neutral-300 text-pretty [overflow-wrap:anywhere]">
                      <span className="sr-only">Ubicación: </span>
                      {micro.ubicacion}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div data-instruccion-ventana={numero} className="flex items-start gap-3">
          <Numero n={numero} />
          <p className={TEXTO_FILA}>
            <span className="sr-only">Instrucción {numero}: </span>
            {texto}
          </p>
        </div>
      )}
      {children && <div className="flex flex-col gap-1.5 pl-[42px]">{children}</div>}
    </div>
  )
}

interface FilaComprobacionProps {
  texto: string
  /** "Debes ver" y la salida "No se cumple". */
  children?: ReactNode
}

/**
 * LA COMPROBACIÓN DE LA VENTANA: lo que debe verse al terminar las acciones.
 * Verde y con su palabra, para no confundirla con una instrucción más; no
 * lleva casilla, porque "Listo" ya dice que se comprobó. Si NO se cumple, la
 * salida está en la propia fila ("No se cumple"), no escondida. Con el tinte
 * verde y el círculo de la comprobación del prototipo (tarea 350).
 */
export function FilaComprobacion({ texto, children }: FilaComprobacionProps) {
  return (
    <div data-comprobacion-ventana className="flex items-start gap-2.5 rounded-[14px] bg-noct-exito-tinte p-3">
      <IconoVentana nombre="comprobacion" tam={22} grosor={2.4} className="mt-px shrink-0 text-noct-exito" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[13px] font-extrabold uppercase leading-snug tracking-[.04em] text-noct-exito">Comprobación</p>
        <p className="text-[16px] font-medium leading-[22px] text-pretty [overflow-wrap:anywhere]">{texto}</p>
        {children}
      </div>
    </div>
  )
}
