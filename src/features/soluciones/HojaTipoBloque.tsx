import type { ComponentType } from 'react'
import { Hoja } from '../../components/Hoja'
import { Check, type IconoProps } from '../../components/iconos'

// Hoja inferior que ELIGE el tipo de una línea del paso: la
// clasificación de una tarea (acción / verificación / decisión) o el
// tono de un aviso (información / cuidado / alerta / consejo / dato).
//
// El problema que cierra (handoff "Diseño móvil", tablero 6b): los dos
// se cambiaban CICLANDO A CIEGAS. `CICLO_TIPO_TAREA` avanzaba
// acción -> verificación -> decisión con cada toque de un icono de
// 18 px que no decía qué venía después, así que pasarse costaba dos
// toques más; el tono era peor, cinco valores en un ciclo. Aquí los
// tres (o cinco) se ven a la vez, cada uno con su nombre y con lo que
// significa, y el elegido se marca.
//
// Es la hoja estándar (`Hoja`, tarea 291, auditoría UX F1), igual que
// `HojaFiltro`: título, × de 44 px y desplazamiento propio.

export interface OpcionTipoBloque<T extends string> {
  valor: T
  etiqueta: string
  descripcion: string
  Icono: ComponentType<IconoProps>
  claseIcono: string
}

interface Props<T extends string> {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  opciones: OpcionTipoBloque<T>[]
  seleccionado: T
  onElegir: (valor: T) => void
}

export function HojaTipoBloque<T extends string>({
  abierto,
  onCerrar,
  titulo,
  opciones,
  seleccionado,
  onElegir,
}: Props<T>) {
  return (
    <Hoja abierta={abierto} onCerrar={onCerrar} titulo={titulo}>
      <div className="flex flex-col gap-0.5">
        {opciones.map((opcion) => {
          const activa = opcion.valor === seleccionado
          return (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={activa}
              onClick={() => {
                onElegir(opcion.valor)
                onCerrar()
              }}
              // 64 px: es la fila de una hoja que se toca de pie, con
              // una mano, mientras se escribe la guía frente al equipo.
              className={`flex min-h-16 items-center gap-3 rounded-[10px] border px-3 text-left ${
                activa
                  ? 'border-noct-accent bg-noct-accent/[.14]'
                  : 'border-transparent hover:bg-noct-text/[.06] active:bg-noct-text/[.1]'
              }`}
            >
              <opcion.Icono size={21} className={`shrink-0 ${opcion.claseIcono}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium leading-tight text-noct-text">
                  {opcion.etiqueta}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-noct-neutral-300">
                  {opcion.descripcion}
                </span>
              </span>
              {activa && <Check size={17} className="shrink-0 text-noct-accent-300" aria-hidden />}
            </button>
          )
        })}
      </div>
    </Hoja>
  )
}
