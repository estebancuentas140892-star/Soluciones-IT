import { useId, type ReactNode } from 'react'
import type { Categoria } from '../../lib/db'
import { IconoCategoria } from '../../components/IconoCategoria'

// UNA CATEGORÍA DEL CATÁLOGO EN EL TELÉFONO (tarea 358, alternativa A2 de
// Claude Design). La categoría se dice una vez, en la cabecera del grupo, con
// el icono de su clase (el mismo color que en Resolver, D3) y su número de
// guías contado como en Resolver (D9). Debajo, cada guía en su propia tarjeta,
// a 8 px: sin tarjeta contenedora ni divisores, porque en filas continuas no
// se veía qué línea pertenecía a qué guía (D11). Entre grupos, 20 px: la
// distancia entre guías es siempre menor que entre categorías.
export function GrupoGuiasTelefono({
  categoria,
  cuenta,
  children,
}: {
  categoria: Pick<Categoria, 'id' | 'nombre'>
  /** «6 guías · 2 para leer» (`textoCuenta`), o '' si no hay nada que contar. */
  cuenta: string
  children: ReactNode
}) {
  const idTitulo = useId()
  return (
    <section aria-labelledby={idTitulo} data-grupo-categoria={categoria.id} className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center gap-2.5">
        <IconoCategoria nombre={categoria.nombre} tam={28} />
        <h2 id={idTitulo} className="min-w-0 flex-1 text-[16px] font-extrabold leading-[1.3] hyphens-auto">
          {categoria.nombre}
        </h2>
        {cuenta && <span className="shrink-0 text-[14px] font-semibold text-noct-neutral-300">{cuenta}</span>}
      </div>
      {children}
    </section>
  )
}
