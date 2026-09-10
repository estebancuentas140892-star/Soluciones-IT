import type { ReactNode } from 'react'
import type { NivelDificultad, Procedimiento } from '../../lib/db'
import { ChartBar, Circle, Clock, ListPlus, type IconoProps } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'

// LA FICHA PRESENTA, LA EJECUCIÓN EJECUTA (encargo del 2026-09-10,
// tarea 2).
//
// Hasta hoy la ficha de una guía montaba el PROCEDIMIENTO ENTERO
// (`ProcedimientoVista`) debajo del título: el stepper con todos los
// pasos, sus tareas con casilla, sus comprobaciones, los botones de
// cierre de cada paso, las guías vinculadas desplegadas y el anuncio de
// las comprobaciones finales. Dos consecuencias:
//
//   - se podía marcar trabajo sin haber empezado la ejecución, desde una
//     pantalla que dice "Empezar" al pie;
//   - antes de decidir si esta era la guía correcta había que recorrer
//     un documento de miles de píxeles, que en un teléfono es todo el
//     procedimiento hacia abajo.
//
// La ficha se queda con lo que ayuda a DECIDIR: de qué va, para qué
// sirve, cuándo usarla, qué hace falta antes y cuánto cuesta. El paso a
// paso vive donde se hace, en la ejecución, y la barra inferior es la
// única puerta.
//
// Estas piezas las comparten la ficha real (`ArticuloPage`) y la vista
// previa del editor (`VistaPreviaArticulo`), para que el autor vea
// exactamente la misma presentación que el técnico.

const ETIQUETA_DIFICULTAD: Record<NivelDificultad, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

// Una sección corta con su rótulo. Separar en secciones breves es el
// encargo: en 360 px, un bloque largo de objetivo + requisitos +
// síntomas se lee como un muro.
export function SeccionIntro({
  titulo,
  children,
  className = '',
}: {
  titulo: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <TituloSeccion className="mb-2">{titulo}</TituloSeccion>
      {children}
    </section>
  )
}

// Lista de viñetas de la introducción (síntomas, posibles causas,
// requisitos). Sin casilla a propósito: aquí no se marca nada, que es
// justo lo que la ficha no debe ofrecer.
export function ListaIntro({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <SeccionIntro titulo={titulo}>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, indice) => (
          <li key={indice} className="flex items-start gap-2.5">
            <Circle size={14} className="mt-[3px] shrink-0 text-noct-neutral-600" aria-hidden />
            <span className="text-sm leading-normal">{item}</span>
          </li>
        ))}
      </ul>
    </SeccionIntro>
  )
}

// Los tres datos que dicen cuánto cuesta la guía, en tres fichas de una
// línea. Iban dentro de la lista de metadatos, mezclados con la versión
// y la aplicabilidad; aquí se leen de un vistazo antes de decidir.
export function ResumenGuia({
  tiempoMin,
  dificultad,
  totalPasos,
}: {
  tiempoMin: number | null
  dificultad: NivelDificultad | null
  totalPasos: number
}) {
  const datos: { Icono: (props: IconoProps) => ReactNode; rotulo: string; valor: string }[] = []
  if (tiempoMin) datos.push({ Icono: Clock, rotulo: 'Tiempo', valor: `${tiempoMin} min` })
  if (dificultad)
    datos.push({ Icono: ChartBar, rotulo: 'Dificultad', valor: ETIQUETA_DIFICULTAD[dificultad] })
  if (totalPasos > 0)
    datos.push({
      Icono: ListPlus,
      rotulo: 'Pasos',
      valor: totalPasos === 1 ? '1 paso' : `${totalPasos} pasos`,
    })

  if (datos.length === 0) return null

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {datos.map(({ Icono, rotulo, valor }) => (
        <div
          key={rotulo}
          className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-noct-divider bg-noct-surface px-3 py-2.5"
        >
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[.06em] text-noct-neutral-500">
            <Icono size={13} className="shrink-0" aria-hidden />
            {rotulo}
          </dt>
          <dd className="text-[14.5px] font-medium text-noct-text">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Lo que se lee ANTES de empezar: el objetivo de la guía y sus
 * requisitos. Nada de tareas, casillas, verificaciones ni cierres de
 * paso: eso es la ejecución.
 */
export function IntroduccionGuia({ procedimiento }: { procedimiento: Procedimiento }) {
  const { objetivoGeneral, requisitos } = procedimiento
  if (!objetivoGeneral && requisitos.length === 0) return null

  return (
    <>
      {objetivoGeneral && (
        <SeccionIntro titulo="Objetivo">
          <p className="text-sm leading-[1.55]">{objetivoGeneral}</p>
        </SeccionIntro>
      )}

      {requisitos.length > 0 && (
        <SeccionIntro titulo="Antes de empezar">
          <div className="flex flex-col gap-2.5 rounded-lg bg-noct-surface p-3.5">
            {requisitos.map((requisito) => (
              <div key={requisito} className="flex items-start gap-2.5">
                <Circle size={14} className="mt-[3px] shrink-0 text-noct-neutral-600" aria-hidden />
                <span className="text-[13.5px] leading-normal">{requisito}</span>
              </div>
            ))}
          </div>
        </SeccionIntro>
      )}
    </>
  )
}
