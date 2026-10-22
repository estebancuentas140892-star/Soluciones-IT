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
      className={`text-[11px] max-md:text-[12px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500 ${className}`}
    >
      {children}
    </h2>
  )
}

// Etiqueta neutra (.tag .tag-neutral): metadatos y estados sin color.
export function TagNeutral({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-md bg-noct-neutral-800 px-2.5 py-[3px] text-[11px] max-md:text-[12px] tracking-[0.02em] text-noct-neutral-100 ${className}`}
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
// El valor es el mismo `ALTO_PESTANAS` que reserva el chasis (72 px desde la
// tarea 350, la barra del prototipo de Claude Design; 65 medidos antes, más
// el área segura, AD-027). Desde `md` no hay barra de pestañas y la barra
// vuelve a pegarse al borde.
//
// Es también donde se pega la franja del aviso de versión nueva del
// chasis (tarea 274): una barra que use esta clase publica su propio
// hueco del aviso (`huecoAvisoActualizacion`), o una taparía a la otra.
export const PEGADA_SOBRE_PESTANAS = 'bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-0'
// Lo que se suma a PEGADA_SOBRE_PESTANAS en una pantalla cuyas pestañas se
// esconden al bajar (`pestanasSeOcultanAlBajar` del chasis, tarea 329): la
// barra baja al borde, con el área segura dentro de su relleno, y sube otra
// vez cuando las pestañas vuelven.
export const BAJA_CON_LAS_PESTANAS =
  'transition-[bottom] duration-200 motion-reduce:transition-none group-data-[pestanas=ocultas]/chasis:bottom-0 group-data-[pestanas=ocultas]/chasis:pb-[calc(12px+env(safe-area-inset-bottom))]'

// Botones .btn del sistema: el primario va delineado en el acento y el
// secundario con el divisor. Delineado es lo normal: Editar, Programar,
// Registrar lectura y cualquier acción que no hace avanzar.
// EN EL TELÉFONO, 44 PX Y EL VERBO A 14 (tarea 341, mínimos del handoff
// móvil "1b Pulgar"). `btn-tactil` (index.css) da el alto mínimo desde la
// capa de componentes, así que el alto que escriba cada pantalla
// (`min-h-12`, `min-h-[46px]`) sigue mandando; el texto sube con `max-md:`.
// Desde 768 el botón es el de siempre.
const BTN_FORMA =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium leading-tight'
const BTN_BASE = `btn-tactil ${BTN_FORMA} max-md:text-[14px]`
export const BTN_PRIMARIO = `${BTN_BASE} border-noct-accent px-2.5 py-[7px] text-noct-accent hover:bg-noct-accent/10 active:bg-noct-accent/20`
// La ÚNICA acción rellena de una pantalla (regla 30 de REGLAS.md,
// rediseño móvil "1b Pulgar", 2026-10-13): la que hace avanzar o ejecutar
// (Completar y seguir, Resolver un problema, Empezar, Guardar,
// Desbloquear, Terminar). Hasta entonces Nocturne decía "el primario nunca
// va relleno"; ahora el relleno existe, pero una sola vez por pantalla.
// Alto mínimo de 54 (la acción va al pulgar) y texto en `on-accent`, el
// casi negro que se lee sobre el cian. No hereda de BTN_BASE: su tamaño
// de letra, radio y alto son otros, y no lleva borde visible.
//
// POR BANDA (tarea 339, handoff de tableta y escritorio): el mismo botón,
// más bajo donde ya no va al pulgar. Teléfono 54 · 16 px · radio 15;
// tableta 48 · 15.5 · 14; escritorio 40 · 14 · 11, el alto de los botones
// de una cabecera con ratón.
export const BTN_PRIMARIO_RELLENO =
  'inline-flex min-h-[54px] cursor-pointer items-center justify-center gap-2 rounded-[15px] border border-transparent bg-noct-accent px-4 text-[16px] font-semibold leading-tight text-noct-on-accent hover:bg-noct-accent-300 active:bg-noct-accent-500 disabled:cursor-not-allowed disabled:opacity-45 md:min-h-12 md:rounded-[14px] md:text-[15.5px] xl:min-h-10 xl:rounded-[11px] xl:px-[15px] xl:text-[14px]'
// "GUARDAR" Y "DESBLOQUEAR" DONDE SON LA ACCIÓN DOMINANTE (tarea 341, regla
// 30 en el teléfono). En el teléfono es la rellena de 54 · 16 · radio 15; desde
// 768 sigue siendo exactamente el `BTN_PRIMARIO` delineado que esas pantallas
// tenían, porque lo aprobado para tableta y escritorio no cambia. Se arma
// sobre la forma del botón sin el texto de 14 del teléfono de `BTN_BASE`,
// para que dos tamaños de letra no compitan. Solo para la acción que manda
// en su pantalla u hoja: nunca dos rellenas a la vista.
export const BTN_PRIMARIO_DOMINANTE = `${BTN_FORMA} border-noct-accent px-2.5 py-[7px] text-noct-accent hover:bg-noct-accent/10 active:bg-noct-accent/20 max-md:min-h-[54px] max-md:gap-2 max-md:rounded-[15px] max-md:border-transparent max-md:bg-noct-accent max-md:px-4 max-md:text-[16px] max-md:font-semibold max-md:text-noct-on-accent max-md:active:bg-noct-accent-500`
// La acción principal DELINEADA de una cabecera de documento desde 768 px
// (tarea 339): la que no hace avanzar nada pero manda en la pantalla
// ("Programar mantenimiento", "Editar" una autorización, "Credenciales" de
// la ficha). Mismo alto que la rellena de su banda en escritorio (40) y 44
// en tableta. En el teléfono esas acciones viven en la barra fija de su
// pantalla, a 52 px, así que esta constante solo se usa desde 768.
export const BTN_DELINEADO_CABECERA =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-noct-text/25 px-4 text-[15px] font-semibold leading-tight text-noct-text hover:bg-noct-text/[.05] active:bg-noct-text/10 xl:h-10 xl:rounded-[11px] xl:px-[15px] xl:text-[14px]'
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
//
// Mide 44 x 44 (tarea 262, regla R6): el toque es la caja entera y el
// dibujo sigue siendo el que pone cada consumidor (16 a 18 px). Hasta la
// 262 medía 34, por debajo del dedo, en las cabeceras de ficha
// (favorito, compartir, "···"), justo el borde menos alcanzable con una
// mano. Donde ya se le sumaba `min-h-11 min-w-11` (junto a un campo de
// 44) no cambia nada.
//
// Desde 1280 px, 40 x 40 (tarea 339): con ratón no hace falta el dedo, y
// así cuadra con los botones de 40 de la misma cabecera.
export const BTN_ICONO_SECUNDARIO = `${BTN_BASE} h-11 w-11 shrink-0 border-noct-divider p-0 text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15 xl:h-10 xl:w-10`
// La misma variante para la accion destructiva (eliminar): sin borde y
// en rojo. Existe como constante propia porque añadir `text-noct-error`
// sobre BTN_ICONO_SECUNDARIO NO funciona: las dos clases de color tienen
// la misma especificidad y gana la que Tailwind emite despues, no la que
// se escribe al final del atributo. Mismos 44 x 44 (tarea 262).
export const BTN_ICONO_PELIGRO = `${BTN_BASE} h-11 w-11 shrink-0 border-transparent p-0 text-noct-error hover:bg-noct-error/10 active:bg-noct-error/20`

// UNA ACCIÓN DE UN MENÚ EN HOJA (tarea 342, el "···" de la ficha en el
// teléfono del handoff "1b Pulgar"): fila de 54 con su icono de 19 en texto 2
// y la palabra a 15.5, divisor debajo y la respuesta al tocar del teléfono.
// Lo destructivo lleva su propia constante, con el juego de color completo
// (mismo empate de especificidad que las variantes de BTN_GHOST).
export const FILA_ACCION_HOJA =
  'flex min-h-[54px] w-full cursor-pointer items-center gap-3.5 border-b border-noct-divider text-left text-[15.5px] leading-snug text-noct-text active:bg-noct-presionado'
export const FILA_ACCION_HOJA_PELIGRO =
  'flex min-h-[54px] w-full cursor-pointer items-center gap-3.5 border-b border-noct-divider text-left text-[15.5px] font-[550] leading-snug text-noct-error active:bg-noct-error/(--tinte-estado)'
