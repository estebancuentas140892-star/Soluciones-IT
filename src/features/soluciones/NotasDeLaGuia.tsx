import type { Procedimiento } from '../../lib/db'
import { Info, Lightbulb } from '../../components/iconos'
import { TARJETA } from '../../components/ventana/estilos'
import { SeccionIntro } from './IntroduccionGuia'
import { notasDeLaGuia } from './notasGuia'

// «NOTAS DE LA GUÍA» EN DETALLES, EN EL TELÉFONO (tarea 354). Las notas y
// los consejos que la ejecución no enseña desde la tarea 307, por ventana y
// en su orden, cada uno con su palabra («Información», «Consejo») para que
// no se confundan con una advertencia. Sin ninguna, no se monta nada.
export function NotasDeLaGuia({ procedimiento }: { procedimiento: Procedimiento | null | undefined }) {
  const ventanas = notasDeLaGuia(procedimiento)
  if (ventanas.length === 0) return null
  return (
    <SeccionIntro titulo="Notas de la guía">
      <div data-notas-guia className="flex flex-col gap-2.5">
        {ventanas.map((ventana) => (
          <section key={ventana.numero} className={`${TARJETA} flex flex-col gap-2.5 px-4 py-3.5`}>
            <h3 className="text-[13px] font-extrabold uppercase leading-snug tracking-[.05em] text-noct-neutral-300 [overflow-wrap:anywhere]">
              Ventana {ventana.numero} · {ventana.titulo}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {ventana.notas.map((nota) => {
                const Icono = nota.tono === 'consejo' ? Lightbulb : Info
                return (
                  <li key={nota.id} className="flex items-start gap-2.5">
                    <Icono size={18} className="mt-0.5 shrink-0 text-noct-neutral-300" aria-hidden />
                    <p className="min-w-0 text-[15px] leading-[1.45] text-pretty [overflow-wrap:anywhere]">
                      <span className="font-bold">{nota.tono === 'consejo' ? 'Consejo' : 'Información'}. </span>
                      <span className="whitespace-pre-line">{nota.texto}</span>
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </SeccionIntro>
  )
}
