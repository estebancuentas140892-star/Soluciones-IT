import type { ComponentType, RefObject } from 'react'
import { Boton } from './Boton'
import { Hoja } from './Hoja'
import { Check, type IconoProps } from './iconos'

// Hoja inferior para elegir UNA opción de una lista corta: el segundo eje
// de filtro de una pantalla de lista, o "dentro de qué categoría" al
// crear. Regla R4 de la auditoría de Soluciones: un solo eje de filtro
// visible; el segundo se plega aquí con su contador.
//
// El problema que cierra: en /soluciones los filtros de categoría y de
// tipo eran dos carruseles horizontales apilados, y entre título,
// buscador y esas dos filas la cabecera pegajosa llegaba a 232 px, un
// tercio de la pantalla antes del primer artículo. Sacando el segundo eje
// a una hoja la cabecera baja a ~156 px.
//
// Desde la tarea 291 es la hoja estándar (`Hoja`, auditoría UX, F1):
// pegada abajo con asa, título y × de 44 px en el teléfono, y en
// escritorio junto al control que la abrió (`ancla`).

export interface OpcionHoja<T extends string> {
  valor: T
  etiqueta: string
  // Glifo de la opción. En el filtro de tipo lleva el matiz del tipo
  // (regla R1: el color del tipo vive en el glifo), en el de categoría
  // el de la categoría.
  Icono?: ComponentType<IconoProps>
  claseIcono?: string
  // Cuántos elementos caen en esta opción. Se omite cuando la hoja no
  // filtra una lista (elegir categoría al crear no tiene conteo útil).
  count?: number
}

interface Props<T extends string> {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  opciones: OpcionHoja<T>[]
  // null = ninguna elegida. La hoja no es multi-selección a propósito:
  // el eje plegado sigue siendo UN eje.
  seleccionada?: T | null
  onElegir: (valor: T) => void
  // Cuando se pasa y hay algo elegido, aparece "Quitar el filtro" al pie.
  // Se omite en las hojas donde no elegir nada no es un estado válido
  // (elegir categoría para crear).
  onLimpiar?: () => void
  // El botón que abre la hoja: en escritorio la hoja aparece a su lado.
  ancla?: RefObject<HTMLElement | null>
}

export function HojaFiltro<T extends string>({
  abierto,
  onCerrar,
  titulo,
  opciones,
  seleccionada = null,
  onElegir,
  onLimpiar,
  ancla,
}: Props<T>) {
  return (
    <Hoja
      abierta={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      ancla={ancla}
      claseCuerpo="flex flex-col gap-1.5"
      pie={
        onLimpiar && seleccionada !== null ? (
          <Boton
            papel="texto"
            tono="descarte"
            tamano={52}
            anchoCompleto
            onClick={() => {
              onLimpiar()
              onCerrar()
            }}
          >
            Quitar el filtro
          </Boton>
        ) : undefined
      }
    >
      {/* UNA COLUMNA (2026-09-09). La rejilla de dos columnas recortaba
          los nombres en 360 px: "Impresor…", "Control d…", "Todas las
          ca…", justo los que el técnico necesita distinguir. El encargo
          pide que la hoja abra "todas las opciones con sus nombres
          completos", así que la lista pasa a una columna, que a cambio da
          56 px de alto y el nombre entero. El desplazamiento es el de la
          hoja. */}
      {opciones.map((opcion) => {
        const activa = opcion.valor === seleccionada
        const Icono = opcion.Icono
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activa}
            onClick={() => {
              onElegir(opcion.valor)
              onCerrar()
            }}
            // min-h-11 son los 44 px de la regla R6: la hoja se toca de
            // pie, con una mano, frente al equipo.
            className={`flex min-h-14 items-center gap-2.5 rounded-lg border px-3.5 text-left text-[14.5px] font-medium transition-colors ${
              activa
                ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
            }`}
          >
            {Icono && <Icono size={17} className={`shrink-0 ${opcion.claseIcono ?? ''}`} aria-hidden />}
            <span className="min-w-0 flex-1 text-pretty">{opcion.etiqueta}</span>
            {opcion.count != null && (
              <span className="shrink-0 text-[11.5px] text-noct-neutral-400">{opcion.count}</span>
            )}
            {activa && opcion.count == null && (
              <Check size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
            )}
          </button>
        )
      })}
    </Hoja>
  )
}
