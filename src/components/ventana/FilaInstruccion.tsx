import type { ReactNode } from 'react'
import { SealCheck } from '../iconos'

// LAS FILAS DE LA VENTANA (tarea 348): lo que se lee y se hace dentro de ella.
//
// Una instrucción NO lleva casilla: el técnico no marca acción por acción, la
// ventana se cierra con un solo "Listo". El número es para situarse ("voy por
// la 3") y, junto con el texto, lo único que hay que leer. Lo que cuelga de la
// instrucción ("Cómo hacerlo", "Debes ver", la credencial) va debajo,
// alineado con el texto y no con el número.

interface FilaInstruccionProps {
  numero: number
  texto: string
  /** "Cómo hacerlo", "Debes ver" y lo demás que cuelga de esta instrucción. */
  children?: ReactNode
}

export function FilaInstruccion({ numero, texto, children }: FilaInstruccionProps) {
  return (
    <div data-instruccion-ventana={numero} className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-px flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-noct-accent/[.16] text-[15px] font-bold leading-none text-noct-accent-300"
        >
          {numero}
        </span>
        <p className="min-w-0 flex-1 text-[16px] font-medium leading-[1.4] text-pretty [overflow-wrap:anywhere]">
          <span className="sr-only">Instrucción {numero}: </span>
          {texto}
        </p>
      </div>
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
 * salida está en la propia fila ("No se cumple"), no escondida.
 */
export function FilaComprobacion({ texto, children }: FilaComprobacionProps) {
  return (
    <div
      data-comprobacion-ventana
      className="flex items-start gap-2.5 rounded-2xl bg-noct-exito/(--tinte-estado) px-3.5 py-3"
    >
      <SealCheck size={22} className="mt-px shrink-0 text-noct-exito" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[13px] font-extrabold uppercase leading-snug tracking-[.05em] text-noct-exito">
          Comprobación
        </p>
        <p className="text-[16px] font-medium leading-[1.4] text-pretty [overflow-wrap:anywhere]">{texto}</p>
        {children}
      </div>
    </div>
  )
}
