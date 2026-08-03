import type { ReactNode } from 'react'

// Primitivas visuales del sistema Nocturne (handoff "Herramienta IT
// para técnicos", 08_ESTILO.md), compartidas por las pantallas ya
// re-autorizadas. Equivalen a las clases .btn/.tag/rotulos del
// sistema de diseño original para no repetir las mismas cadenas de
// utilidades en cada pantalla.

// Rótulo de grupo: 11px en mayúsculas espaciadas.
export function TituloSeccion({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500 ${className}`}
    >
      {children}
    </h2>
  )
}

// Etiqueta neutra (.tag .tag-neutral): metadatos y estados sin color.
export function TagNeutral({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-md bg-noct-neutral-800 px-2.5 py-[3px] text-[11px] tracking-[0.02em] text-noct-neutral-100 ${className}`}
    >
      {children}
    </span>
  )
}

// Desplazamiento inferior de una barra pegajosa en los niveles que
// CONSERVAN la barra de pestañas (sección y documento). Corregido el
// 2026-08-03 al medir la acción dominante de la ficha de equipo (tarea
// 201) y encontrar el mismo defecto en la de la ficha de artículo (tarea
// 172): `sticky bottom-0` ancla el elemento al borde inferior del
// **viewport**, no al de su contenedor, así que mientras quedara
// contenido por debajo la barra quedaba 65 px por detrás de las
// pestañas, que son `fixed`. Al final del scroll volvía a su sitio en el
// flujo, y por eso la revisión anterior no lo vio: hay que medir a
// MITAD de un documento largo, no al final.
//
// El valor es el mismo `ALTO_PESTANAS` que reserva el chasis (65 px
// medidos más el área segura, AD-027). Desde `md` no hay barra de
// pestañas y la barra vuelve a pegarse al borde.
export const PEGADA_SOBRE_PESTANAS = 'bottom-[calc(65px+env(safe-area-inset-bottom))] md:bottom-0'

// Botones .btn del sistema: el primario va delineado en el acento
// (nunca relleno, regla de Nocturne) y el secundario con el divisor.
const BTN_BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium leading-tight'
export const BTN_PRIMARIO = `${BTN_BASE} border-noct-accent px-2.5 py-[7px] text-noct-accent hover:bg-noct-accent/10 active:bg-noct-accent/20`
export const BTN_SECUNDARIO = `${BTN_BASE} border-noct-divider px-2.5 py-[7px] text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15`
// Variante destructiva del primario (.btn-danger): para la accion que
// SI ejecuta la eliminacion (a diferencia de BTN_GHOST_PELIGRO, pensado
// para acciones ligeras). Delineada en rojo, nunca rellena, misma regla
// de Nocturne que el resto de la familia BTN_PRIMARIO.
export const BTN_PRIMARIO_PELIGRO = `${BTN_BASE} border-noct-error px-2.5 py-[7px] text-noct-error hover:bg-noct-error/10 active:bg-noct-error/20`
// Botón fantasma (.btn-ghost): sin borde, solo tinte al pasar por
// encima. Para acciones ligeras de cabecera y pie (Crear, Volver,
// Cancelar) donde un borde competiría con la acción principal.
export const BTN_GHOST = `${BTN_BASE} border-transparent px-2.5 py-[7px] text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15`
// Variantes de color del boton fantasma. Son constantes propias y NO
// se arman como `${BTN_GHOST} text-noct-error`: escribir una clase de
// color despues de la constante no cambia nada, porque BTN_GHOST ya
// trae `text-noct-text` y ambas utilidades tienen la misma
// especificidad. En ese empate gana la que Tailwind emite mas tarde en
// la hoja, y Tailwind ordena las utilidades del mismo tipo por nombre:
// `text-noct-text` sale despues de `text-noct-accent`,
// `text-noct-error` y `text-noct-neutral-500`, asi que las tapa a todas
// (lo mismo pasa con `hover:bg-noct-text/[.07]` frente a
// `hover:bg-noct-error/10`). Por eso cada variante repite el juego
// completo de color, tinte y estado activo.
export const BTN_GHOST_PELIGRO = `${BTN_BASE} border-transparent px-2.5 py-[7px] text-noct-error hover:bg-noct-error/10 active:bg-noct-error/20`
export const BTN_GHOST_ACENTO = `${BTN_BASE} border-transparent px-2.5 py-[7px] text-noct-accent hover:bg-noct-accent/10 active:bg-noct-accent/20`
// Fantasma atenuado: para la accion de descarte que acompaña a una
// principal (por ejemplo "Cancelar" junto a "Continuar").
export const BTN_GHOST_TENUE = `${BTN_BASE} border-transparent px-2.5 py-[7px] text-noct-neutral-500 hover:bg-noct-text/[.07] active:bg-noct-text/15`
// Variante cuadrada de solo icono (.btn-icon), completa en si misma
// para no depender del orden de las clases de padding.
export const BTN_ICONO_SECUNDARIO = `${BTN_BASE} h-[34px] w-[34px] shrink-0 border-noct-divider p-0 text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15`
// La misma variante para la accion destructiva (eliminar): sin borde y
// en rojo. Existe como constante propia porque añadir `text-noct-error`
// sobre BTN_ICONO_SECUNDARIO NO funciona: las dos clases de color tienen
// la misma especificidad y gana la que Tailwind emite despues, no la que
// se escribe al final del atributo.
export const BTN_ICONO_PELIGRO = `${BTN_BASE} h-[34px] w-[34px] shrink-0 border-transparent p-0 text-noct-error hover:bg-noct-error/10 active:bg-noct-error/20`
