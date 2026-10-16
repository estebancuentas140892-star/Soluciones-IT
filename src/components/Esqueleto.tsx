import type { ReactNode } from 'react'

// ESQUELETOS DE CARGA (tarea 342, "Estados" del sistema visual móvil "1b
// Pulgar": "Esqueleto con la forma real; nunca 'todo al día' antes de mirar").
// Mientras la copia local se lee, la pantalla enseña la forma de lo que va a
// llegar en vez de un "Cargando..." suelto, y nada se afirma antes de leer.
//
// No es un sistema de plantillas: un contenedor que se anuncia como estado,
// un hueso (`Hueso`, el bloque tintado al que cada pantalla le da su tamaño) y
// cuatro formas, las de las pantallas que más se esperan. El brillo es el
// del handoff (1.2 s) y no existe si el teléfono pide reducir el movimiento
// (`motion-safe:`). Los colores son el tinte del sistema, en los dos temas.
// No llevan margen propio: van dentro del `main` de su pantalla, que recibe
// el margen de banda del chasis desde 768 (T1).

/** Un bloque tintado con la forma de lo que va a llegar. El tamaño lo pone quien lo usa. */
export function Hueso({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block shrink-0 rounded-md bg-noct-tinte ${className}`} />
}

/**
 * El contenedor: se anuncia como estado ("Cargando la ficha del equipo") y,
 * si se le da, dice qué está pasando en una línea a 13 px debajo.
 */
export function Esqueleto({
  etiqueta,
  texto,
  className = '',
  children,
}: {
  /** Lo que lee el lector de pantalla mientras dura. */
  etiqueta: string
  /** La línea visible bajo la forma ("Leyendo la copia local…"). */
  texto?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div role="status" aria-label={etiqueta} data-esqueleto className={`flex flex-col ${className}`}>
      <div aria-hidden className="flex flex-col gap-[inherit] motion-safe:animate-[brillo_1.2s_ease-in-out_infinite]">
        {children}
      </div>
      {texto && <p className="text-[13px] leading-snug text-noct-neutral-400">{texto}</p>}
    </div>
  )
}

// LA FICHA DE UN EQUIPO: el carnet (icono de 52, nombre y su línea), las
// filas técnicas de los datos para trabajar y los dos bloques de debajo.
export function EsqueletoFicha() {
  return (
    <Esqueleto etiqueta="Cargando la ficha del equipo" texto="Leyendo la copia local…" className="gap-[18px] pt-2">
      <div className="flex items-center gap-3.5">
        <Hueso className="h-[52px] w-[52px] rounded-[14px]" />
        <span className="flex flex-1 flex-col gap-2">
          <Hueso className="h-[22px] w-3/5 rounded-[6px]" />
          <Hueso className="h-3 w-2/5 rounded" />
        </span>
      </div>
      <Hueso className="h-11 rounded-xl" />
      <Hueso className="h-16 rounded-[10px]" />
      <Hueso className="h-12 rounded-[10px]" />
      <Hueso className="h-12 rounded-[10px]" />
      <Hueso className="h-[120px] rounded-xl" />
      <Hueso className="h-[160px] rounded-xl" />
    </Esqueleto>
  )
}

// UN MANTENIMIENTO: el título con su estado, sus datos y las acciones.
export function EsqueletoMantenimiento() {
  return (
    <Esqueleto etiqueta="Cargando el mantenimiento" className="gap-4 pt-2">
      <div className="flex items-center justify-between gap-3">
        <Hueso className="h-6 w-1/2 rounded-[6px]" />
        <Hueso className="h-[22px] w-24 rounded-full" />
      </div>
      <Hueso className="h-3 w-2/5 rounded" />
      <div className="flex flex-col gap-2.5">
        <Hueso className="h-12 rounded-[10px]" />
        <Hueso className="h-12 rounded-[10px]" />
        <Hueso className="h-12 rounded-[10px]" />
      </div>
      <Hueso className="h-[54px] rounded-[15px]" />
    </Esqueleto>
  )
}

// UNA AUTORIZACIÓN DE FACTURACIÓN: el prefijo con su pastilla, el secuencial
// y las tres capas del dato (lo documentado, lo confirmado y el dato actual).
export function EsqueletoAutorizacion() {
  return (
    <Esqueleto etiqueta="Cargando la autorización" className="gap-4 pt-2">
      <div className="flex items-center gap-3">
        <Hueso className="h-[34px] w-28 rounded-[8px]" />
        <Hueso className="h-[22px] w-24 rounded-full" />
      </div>
      <Hueso className="h-3 w-1/2 rounded" />
      <Hueso className="h-[96px] rounded-xl" />
      <Hueso className="h-[84px] rounded-xl" />
      <Hueso className="h-[96px] rounded-xl" />
    </Esqueleto>
  )
}

// EL ÍNDICE DE BÚSQUEDA PREPARÁNDOSE: dos filas ligeras con su icono y la
// línea que dice qué pasa. No es un spinner ni ocupa la pantalla.
export function EsqueletoBusqueda() {
  return (
    <Esqueleto etiqueta="Preparando el índice de búsqueda" texto="Preparando el índice de búsqueda…" className="gap-3.5 pt-1">
      {['w-[70%]', 'w-[55%]'].map((ancho) => (
        <div key={ancho} className="flex items-center gap-3">
          <Hueso className="h-[38px] w-[38px] rounded-[11px]" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Hueso className={`h-[13px] rounded ${ancho}`} />
            <Hueso className="h-2.5 w-2/5 rounded" />
          </span>
        </div>
      ))}
    </Esqueleto>
  )
}
