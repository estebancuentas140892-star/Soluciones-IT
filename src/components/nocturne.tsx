import type { ReactNode } from 'react'

// Primitivas visuales del sistema Nocturne (handoff "Herramienta IT
// para técnicos", 08_ESTILO.md), compartidas por las pantallas ya
// re-autorizadas. Equivalen a las clases .tag y a los rótulos del sistema
// de diseño original para no repetir las mismas cadenas de utilidades en
// cada pantalla.
//
// Los botones ya no viven aquí: desde la tarea 291 (auditoría UX, T1 a
// T4) son `Boton` y `claseBoton` (components/Boton.tsx y claseBoton.ts),
// con cuatro papeles y tres tamaños en vez de las nueve constantes BTN_*.

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
//
// Es también donde se pega la franja del aviso de versión nueva del
// chasis (tarea 274): una barra que use esta clase publica su propio
// hueco del aviso (`huecoAvisoActualizacion`), o una taparía a la otra.
export const PEGADA_SOBRE_PESTANAS = 'bottom-[calc(65px+env(safe-area-inset-bottom))] md:bottom-0'
