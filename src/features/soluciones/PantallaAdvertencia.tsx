import { useId, type Ref } from 'react'
import { ArrowDown, ArrowRight } from '../../components/iconos'
import type { BloquePaso } from '../../lib/db'
import { tonoDeLaAdvertencia } from './advertenciaPrevia'

// LA ADVERTENCIA PREVIA, DIBUJADA (tarea 311; la regla en advertenciaPrevia.ts).
//
// Una sola finalidad: que el técnico sea consciente del riesgo antes de hacer
// lo que sigue. La jerarquía es la del encargo:
//
//   PRECAUCIÓN (o IMPORTANTE)     el tono, con su icono y su palabra
//   Antes de continuar            el encabezado
//   el texto del autor            tal cual, sin párrafos añadidos
//   LO QUE SIGUE                  la acción a la que se refiere
//   la instrucción                para saber sobre qué acción aplica
//
// Deliberadamente distinta de una acción (un panel con la barra y el fondo
// del riesgo), difícil de ignorar sin parecer un error de la aplicación: no
// llena la pantalla de rojo, y el nivel de riesgo se dice con el icono y la
// palabra, nunca solo con el color (regla R16). El tono más fuerte manda
// (`tonoDeLaAdvertencia`). Ni el dato técnico ni la credencial viajan aquí:
// son herramientas de la acción, y la acción viene después.
//
// El ENCABEZADO lleva el tono y "Antes de continuar" juntos, así que al
// recibir el foco (como toda pantalla de Modo Foco) se anuncia una sola vez
// lo que es: "Precaución. Antes de continuar". Sin `role="alert"`: con el
// foco ya se lee, y las dos cosas a la vez lo leerían dos veces.

interface Props {
  /** Los riesgos de la acción, en el orden del autor. */
  alertas: readonly BloquePaso[]
  /** La instrucción de la acción a la que preceden. */
  loQueSigue: string
}

/** Los textos del autor: uno solo, como frase; varios, como lista. */
function TextosDelRiesgo({ alertas, clase }: { alertas: readonly BloquePaso[]; clase: string }) {
  if (alertas.length === 1) {
    return <p className={`text-pretty [overflow-wrap:anywhere] ${clase}`}>{alertas[0].texto || 'Aviso sin texto'}</p>
  }
  return (
    <ul className={`flex flex-col gap-2 ${clase}`}>
      {alertas.map((alerta) => (
        <li key={alerta.id} className="flex items-start gap-2.5">
          <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
          <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">{alerta.texto || 'Aviso sin texto'}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * LA PANTALLA PROPIA, en la acción a la vez (Modo Foco). Solo el cuerpo: el
 * pie ("Anterior" y "Entiendo, continuar") es el de Modo Foco, el mismo de
 * cada acción. `refTitulo` es el encabezado que recibe el foco.
 */
export function PantallaAdvertencia({
  alertas,
  loQueSigue,
  refTitulo,
}: Props & { refTitulo: Ref<HTMLHeadingElement> }) {
  const idTitulo = useId()
  const tono = tonoDeLaAdvertencia(alertas)
  return (
    <div className="flex flex-col gap-7">
      <section
        aria-labelledby={idTitulo}
        className={`flex flex-col gap-3.5 rounded-r-2xl border-l-4 px-4 py-4 ${tono.claseBarra} ${tono.claseFondo}`}
      >
        <h2
          id={idTitulo}
          ref={refTitulo}
          tabIndex={-1}
          data-foco-lectura
          data-advertencia-previa={tono.valor}
          className="flex flex-col gap-1.5 outline-none"
        >
          <span
            className={`inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[.08em] ${tono.claseIcono}`}
          >
            <tono.Icono size={19} className="shrink-0" aria-hidden />
            {tono.etiqueta}
            <span className="sr-only">.</span>
          </span>{' '}
          <span className="text-[26px] font-medium leading-[1.25] tracking-[-.01em] text-noct-text">
            Antes de continuar
          </span>
        </h2>
        <TextosDelRiesgo alertas={alertas} clase="text-[17px] leading-[1.45] text-noct-text" />
      </section>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
          <ArrowDown size={13} className="shrink-0" aria-hidden />
          Lo que sigue
        </p>
        <p className="text-[18px] leading-snug text-pretty text-noct-neutral-200 [overflow-wrap:anywhere]">{loQueSigue}</p>
      </div>
    </div>
  )
}

/**
 * EN UNA LISTA (el paso entero, la lectura, "Probar"): ocupa el sitio de su
 * acción mientras esté pendiente y sin leer, con su propio "Entiendo,
 * continuar", que la descubre. No marca nada.
 */
export function TarjetaAdvertencia({ alertas, loQueSigue, onContinuar }: Props & { onContinuar: () => void }) {
  const idTitulo = useId()
  const tono = tonoDeLaAdvertencia(alertas)
  return (
    <section
      aria-labelledby={idTitulo}
      data-advertencia-previa={tono.valor}
      className={`flex flex-col gap-2.5 rounded-r-xl border-l-[3px] px-3.5 py-3 ${tono.claseBarra} ${tono.claseFondo}`}
    >
      <h3 id={idTitulo} className="flex flex-col gap-0.5">
        <span
          className={`inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.08em] ${tono.claseIcono}`}
        >
          <tono.Icono size={16} className="shrink-0" aria-hidden />
          {tono.etiqueta}
          <span className="sr-only">.</span>
        </span>{' '}
        <span className="text-[16px] font-medium leading-snug text-noct-text">Antes de continuar</span>
      </h3>
      <TextosDelRiesgo alertas={alertas} clase="text-[14.5px] leading-[1.45] text-noct-text" />
      <p className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">Lo que sigue</span>
        <span className="text-[14.5px] leading-snug text-pretty text-noct-neutral-200 [overflow-wrap:anywhere]">
          {loQueSigue}
        </span>
      </p>
      <button
        type="button"
        onClick={onContinuar}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-noct-accent bg-noct-accent/[.12] px-4 text-[14px] font-semibold text-noct-accent-200 hover:bg-noct-accent/[.22]"
      >
        Entiendo, continuar
        <ArrowRight size={16} className="shrink-0" aria-hidden />
      </button>
    </section>
  )
}
