import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { CaretRight, Clock } from '../../components/iconos'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { colorIconoDeTipo, iconoDeTipo } from './iconosSoluciones'
import { partirTitulo } from './coincidencia'
import { etiquetaDeTipo } from './tiposArticulo'

// La fila de un artículo en un listado, compartida por SolucionesPage y
// CategoriaPage. Sale de la auditoría de Soluciones, que la pedía como
// componente propio para dejar de copiar el marcado entre las dos
// pantallas.
//
// Sobre la decisión de la tarea 145, que dijo "NO crear <FilaArticulo>":
// ahí se comparaba la fila de artículo contra `<FilaDispositivo>` y la de
// Red ("no comparte interior con las otras dos filas"), y sigue siendo
// cierto: esto NO se unifica con la fila de dispositivo. Lo que se
// unifica son las DOS filas de artículo, que antes divergían solo porque
// nadie las había mirado juntas, y que este rediseño hace converger a
// propósito (mismo recuadro, misma línea de metadatos, misma ranura de
// estado). Ese es el marcado duplicado que el componente cierra.
//
// Regla R1 de la auditoría, "color con oficio": el matiz del TIPO vive en
// el glifo y el recuadro va neutro (`text/6%`). Antes el recuadro entero
// iba relleno del color del tipo y, con seis tipos en la misma columna,
// la lista se leía como un arcoíris donde el color ya no informaba y
// competía con el título, que es lo único que se lee de verdad. El color
// de la CATEGORÍA sigue viviendo en los chips de filtro, no aquí.

// Dónde coincidió la búsqueda, cuando NO fue en el título. Sin esto la
// lista muestra resultados sin explicación aparente ("¿por qué sale este
// artículo si no dice 'zebra' en ninguna parte?").
export interface CoincidenciaFila {
  // En palabras y con artículo: "la etiqueta", "la categoría", "el tipo".
  donde: string
  // El valor que coincidió; se muestra como chip a continuación.
  valor: string
}

export function FilaArticulo({
  articulo,
  to,
  categoriaNombre,
  consulta = '',
  coincidencia,
  conSeparador = true,
}: {
  articulo: Articulo
  to: string
  // Nombre de la categoría, para la línea de metadatos. Se pasa cuando la
  // lista puede mezclar categorías (buscando, o en "Todos"): así el
  // técnico no tiene que adivinar de dónde salió el resultado. Se omite
  // dentro de la ficha de una categoría, donde sería repetirlo en cada
  // fila.
  categoriaNombre?: string
  // Término de búsqueda YA normalizado, para resaltarlo en el título.
  consulta?: string
  // Cuando la coincidencia no está en el título, sustituye la línea de
  // metadatos para explicar por qué aparece esta fila.
  coincidencia?: CoincidenciaFila
  conSeparador?: boolean
}) {
  const Icono = iconoDeTipo(articulo.tipo)
  const tiempo = normalizarProcedimiento(articulo.procedimiento)?.tiempoEstimadoMin
  const { pre, match, post } = partirTitulo(articulo.titulo, consulta)
  // Un artículo obsoleto sigue siendo consultable (a veces es lo único
  // que hay), pero no debe pesar lo mismo que uno vigente: baja de
  // jerarquía sin desaparecer.
  const obsoleto = articulo.estado === 'obsoleto'

  return (
    <Link
      to={to}
      className={`flex min-h-[60px] items-center gap-3 rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05] ${
        conSeparador ? 'border-b border-noct-divider' : ''
      }`}
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06]">
        <Icono size={17} className={colorIconoDeTipo(articulo.tipo)} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-[15px] font-medium leading-[1.3] [text-wrap:pretty] ${
            obsoleto ? 'text-noct-neutral-300' : ''
          }`}
        >
          {pre}
          {match && (
            <span className="rounded-[3px] bg-noct-accent/[.22] px-0.5 text-noct-accent-200">{match}</span>
          )}
          {post}
        </span>

        {coincidencia ? (
          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-noct-neutral-400">
            Coincide en {coincidencia.donde}
            <span className="rounded-full bg-noct-neutral-800 px-[7px] py-px text-[11px] text-noct-neutral-200">
              {coincidencia.valor}
            </span>
          </span>
        ) : (
          // Metadatos a 12 px en neutral-400, nunca en neutral-600: con
          // ese paso el contraste sobre el fondo es 4.0:1 y AA pide 4.5
          // (regla R2). El separador "·" va un paso más abajo porque es
          // decoración, no texto que haya que leer.
          <span
            className={`mt-[3px] flex flex-wrap items-center gap-1.5 text-[12px] ${
              obsoleto ? 'text-noct-neutral-500' : 'text-noct-neutral-400'
            }`}
          >
            {categoriaNombre && (
              <>
                <span className="truncate">{categoriaNombre}</span>
                <span className="text-noct-neutral-500">·</span>
              </>
            )}
            <span>{etiquetaDeTipo(articulo.tipo)}</span>
            {tiempo != null && (
              <>
                <span className="text-noct-neutral-500">·</span>
                <span className="inline-flex items-center gap-[3px]">
                  <Clock size={12} aria-hidden />
                  {tiempo} min
                </span>
              </>
            )}
          </span>
        )}
      </span>

      <PastillaEstadoArticulo estado={articulo.estado} />
      <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}
