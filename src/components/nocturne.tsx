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

// Botones .btn del sistema: el primario va delineado en el acento
// (nunca relleno, regla de Nocturne) y el secundario con el divisor.
const BTN_BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium leading-tight'
export const BTN_PRIMARIO = `${BTN_BASE} border-noct-accent px-2.5 py-[7px] text-noct-accent hover:bg-noct-accent/10 active:bg-noct-accent/20`
export const BTN_SECUNDARIO = `${BTN_BASE} border-noct-divider px-2.5 py-[7px] text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15`
// Botón fantasma (.btn-ghost): sin borde, solo tinte al pasar por
// encima. Para acciones ligeras de cabecera y pie (Crear, Volver,
// Cancelar) donde un borde competiría con la acción principal.
export const BTN_GHOST = `${BTN_BASE} border-transparent px-2.5 py-[7px] text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15`
// Variante cuadrada de solo icono (.btn-icon), completa en si misma
// para no depender del orden de las clases de padding.
export const BTN_ICONO_SECUNDARIO = `${BTN_BASE} h-[34px] w-[34px] shrink-0 border-noct-divider p-0 text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15`
