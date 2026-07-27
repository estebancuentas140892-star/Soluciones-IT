import type { ComponentType } from 'react'
import { Modal } from './Modal'
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
// Se apoya en `Modal`, que ya resuelve lo difícil: portal a <body> (sin
// él `position: fixed` se resuelve contra la cabecera con
// `backdrop-filter`, bug del 2026-07-21), cierre con Escape y por toque
// fuera, y bloqueo del scroll del fondo. En móvil Modal ya entra pegado
// abajo, que es lo que una hoja necesita.

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
  // Cuando se pasa, aparece "Limpiar" arriba a la derecha. Se omite en
  // las hojas donde no elegir nada no es un estado válido (elegir
  // categoría para crear).
  onLimpiar?: () => void
}

const ID_TITULO = 'hoja-filtro-titulo'

export function HojaFiltro<T extends string>({
  abierto,
  onCerrar,
  titulo,
  opciones,
  seleccionada = null,
  onElegir,
  onLimpiar,
}: Props<T>) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={ID_TITULO} className="text-[15px] font-medium leading-tight text-noct-text">
          {titulo}
        </h2>
        {onLimpiar && seleccionada !== null && (
          <button
            type="button"
            onClick={() => {
              onLimpiar()
              onCerrar()
            }}
            className="shrink-0 text-[12px] font-medium text-noct-accent-300 hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
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
              className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-[13px] font-medium transition-colors ${
                activa
                  ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                  : 'border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.05]'
              }`}
            >
              {Icono && <Icono size={17} className={`shrink-0 ${opcion.claseIcono ?? ''}`} aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{opcion.etiqueta}</span>
              {opcion.count != null && (
                <span className="shrink-0 text-[11.5px] text-noct-neutral-400">{opcion.count}</span>
              )}
              {activa && opcion.count == null && (
                <Check size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
