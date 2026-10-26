import type { ReactNode } from 'react'
import { SubtituloTarea } from '../../app/bandaTarea'
import { useHaySubtituloTarea } from '../../app/ranuraSubtitulo'

// LA LÍNEA BAJO EL TÍTULO DE LA GUÍA, EN EL TELÉFONO: dónde se va («Paso 2 de
// 4 · acción 1 de 3 · POSPN01», «Ventana 2 de 4 · POSPN01») o «Comprobación
// final». Desde la tarea 351 va pegada al título, en la misma fila que la X y
// el índice, como en el prototipo; si la cabecera no publica esa ranura,
// debajo de la fila, donde iba en la tarea 350.
//
// Vive aparte desde la tarea 355: la pinta la guía (`AsistenteVista`) en la
// ventana y en el cierre, y la acción a la vez (`ModoFoco`), que es la que
// sabe en qué acción del paso se está.
//
// CON `partes` (la acción a la vez, tarea 355), la línea no se recorta: en esa
// fila caben además «Tengo un problema» y el índice, así que «Paso 2 de 2 ·
// acción 1 de 2» no entra en una línea a 390 px y lo que se perdía era justo
// la acción. Baja a una segunda línea, y solo entre sus partes («Paso 2 de 2 ·
// / acción 1 de 2»), nunca a mitad de una.
export function LineaBajoElTitulo({ children, partes }: { children?: ReactNode; partes?: readonly string[] }) {
  const enElTitulo = useHaySubtituloTarea()
  const contenido = partes ? textoPorPartes(partes) : children
  const texto = (
    <p
      data-paso-en-cabecera
      className={`text-[13px] font-semibold leading-[18px] text-noct-neutral-300 ${partes ? 'line-clamp-2' : 'truncate'} ${
        enElTitulo ? '' : '-mt-1.5 pb-2 pl-[52px] pr-4'
      }`}
    >
      {contenido}
    </p>
  )
  return enElTitulo ? <SubtituloTarea>{texto}</SubtituloTarea> : texto
}

// El espacio que no parte la línea.
const ESPACIO_DURO = String.fromCharCode(0xa0)

// Cada parte (y cada trozo de una parte que ya lleva « · ») con espacios que no
// parten la línea; entre partes, « · » con un espacio que sí.
function textoPorPartes(partes: readonly string[]): string {
  return partes
    .flatMap((parte) => parte.split(' · '))
    .map((trozo) => trozo.trim())
    .filter(Boolean)
    .map((trozo) => trozo.replace(/ /g, ESPACIO_DURO))
    .join(`${ESPACIO_DURO}· `)
}
