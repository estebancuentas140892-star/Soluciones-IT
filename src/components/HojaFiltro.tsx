import type { ComponentType, ReactNode } from 'react'
import { Modal } from './Modal'
import { Check, type IconoProps } from './iconos'
import { IconoVentana } from './ventana/IconoVentana'
import { FILAS_EN_TARJETA_TELEFONO } from './ventana/estilos'

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
  // Solo en la variante `telefono` (tarea 358): un dibujo propio en lugar
  // del glifo (el icono de la categoría, con su clase) y el número dicho en
  // palabras («6 guías · 2 para leer») en lugar de `count`.
  visual?: ReactNode
  detalle?: string
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
  // `telefono` (tarea 358): las piezas de Ventana, para una rama que solo
  // existe por debajo de 768 px. Sin ella, la hoja de siempre.
  variante?: 'normal' | 'telefono'
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
  variante = 'normal',
}: Props<T>) {
  if (variante === 'telefono') {
    return (
      <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={ID_TITULO} className="text-[18px] font-extrabold leading-tight text-noct-text">
            {titulo}
          </h2>
          {onLimpiar && seleccionada !== null && (
            <button
              type="button"
              onClick={() => {
                onLimpiar()
                onCerrar()
              }}
              className="inline-flex min-h-11 shrink-0 items-center text-[14px] font-bold text-noct-accent-300"
            >
              Limpiar
            </button>
          )}
        </div>
        {/* LA HOJA EN VENTANA (tarea 358): filas de 56 con divisor dentro de
            una tarjeta, como los grupos de Más; el nombre entero a 16, su
            número en palabras y la elegida con su marca en acento. */}
        <div className="max-h-[62svh] overflow-y-auto">
          <div className={`${FILAS_EN_TARJETA_TELEFONO} flex flex-col`}>
            {opciones.map((opcion) => {
              const activa = opcion.valor === seleccionada
              const Icono = opcion.Icono
              const detalle = opcion.detalle ?? (opcion.count != null ? String(opcion.count) : '')
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => {
                    onElegir(opcion.valor)
                    onCerrar()
                  }}
                  className="flex min-h-14 items-center gap-3 border-t-[1.5px] border-noct-divider py-2 text-left text-noct-text first:border-t-0 active:bg-noct-presionado"
                >
                  {opcion.visual ??
                    (Icono && <Icono size={20} className={`shrink-0 ${opcion.claseIcono ?? ''}`} aria-hidden />)}
                  <span className="min-w-0 flex-1 text-pretty text-[16px] font-bold leading-snug">{opcion.etiqueta}</span>
                  {detalle && (
                    <span className="shrink-0 text-[14px] font-semibold text-noct-neutral-300">{detalle}</span>
                  )}
                  {activa && <IconoVentana nombre="hecho" tam={20} className="shrink-0 text-noct-accent-300" />}
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    )
  }
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

      {/* UNA COLUMNA (2026-09-09). La rejilla de dos columnas recortaba
          los nombres en 360 px: "Impresor...", "Control d...", "Todas
          las ca...", justo los que el técnico necesita distinguir. El
          encargo pide que la hoja abra "todas las opciones con sus
          nombres completos", así que la lista pasa a una columna, que a
          cambio da 56 px de alto y el nombre entero. */}
      <div className="flex max-h-[62svh] flex-col gap-1.5 overflow-y-auto">
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
                <span className="shrink-0 text-[11.5px] max-md:text-[12px] text-noct-neutral-400">{opcion.count}</span>
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
