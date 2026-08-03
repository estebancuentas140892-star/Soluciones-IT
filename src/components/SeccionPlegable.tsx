import { useId, useState, type ReactNode } from 'react'
import { CaretDown, type IconoProps } from './iconos'

// Sección plegada que informa al plegarse (auditoría móvil del
// 2026-08-03, hallazgo M-014, regla M-R4).
//
// La ficha 360° de un equipo pintaba nueve secciones siempre abiertas,
// sin plegado ni índice: "Conexiones", que es la respuesta a "¿de qué
// depende esto?", empezaba pasadas tres pantallas de scroll a 360 px.
// Plegar sin más habría cambiado un problema por otro (esconder), así
// que la regla M-R4 exige que la cabecera plegada muestre **su conteo**:
// "Conexiones · 4" dice más que cuatro filas que hay que desplazar.
//
// El contenido solo se monta cuando la sección está abierta. Además de
// ahorrar trabajo, evita que cinco bloques con sus propias consultas en
// vivo se pinten enteros para quedar fuera de pantalla.

interface Props {
  titulo: string
  Icono: (props: IconoProps) => React.JSX.Element
  /**
   * Lo que la cabecera dice cuando está plegada: un número ("4"), una
   * cantidad con unidad ("9 equipos") o una frase corta ("última hace
   * 6 d"). Si no hay nada que contar, la sección no debería montarse.
   */
  conteo: ReactNode
  /** Tiñe icono y conteo cuando el dato en sí es una advertencia. */
  tono?: 'neutro' | 'precaucion'
  /** Abierta de entrada (capas "Ahora" y "Contexto", nunca "Profundidad"). */
  inicialAbierta?: boolean
  /** Ancla para los enlaces internos de la ficha (bloque "¿Qué sigue?"). */
  id?: string
  children: ReactNode
}

export function SeccionPlegable({
  titulo,
  Icono,
  conteo,
  tono = 'neutro',
  inicialAbierta = false,
  id,
  children,
}: Props) {
  const [abierta, setAbierta] = useState(inicialAbierta)
  const idCuerpo = useId()
  const color = tono === 'precaucion' ? 'text-noct-precaucion' : 'text-noct-neutral-400'

  return (
    <div id={id}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-noct-accent"
      >
        <Icono size={17} className={`shrink-0 ${color}`} aria-hidden />
        <span className="min-w-0 flex-1 text-[14px] text-noct-text">{titulo}</span>
        <span className={`shrink-0 text-[12.5px] font-medium tabular-nums ${color}`}>{conteo}</span>
        <CaretDown
          size={13}
          className={`shrink-0 text-noct-neutral-500 transition-transform duration-150 motion-reduce:transition-none ${
            abierta ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {abierta && (
        <div id={idCuerpo} className="px-3.5 pb-3.5 pt-0.5">
          {children}
        </div>
      )}
    </div>
  )
}
