import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { CaretRight, Check, Play } from '../../components/iconos'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { colorIconoDeTipo, iconoDeTipo } from './iconosSoluciones'
import { partirTitulo } from './coincidencia'
import { capacidadDeGuia, lineaDeCapacidad } from './capacidadGuia'

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
//
// TABLERO 3b del handoff "Diseño móvil" (tarea 214). La fila deja de ser
// un renglón con separador y pasa a ser una TARJETA, y sobre todo deja de
// mentir: antes pintaba exactamente lo mismo para una guía de 7 pasos con
// verificación final y para un borrador sin un solo paso (mismo recuadro
// de 34 px, misma línea `categoría · tipo · min`), así que el técnico
// descubría que la guía estaba vacía **después de abrirla**, de pie y
// frente al equipo. Ahora cada fila dice **lo que la guía puede hacer por
// ti** y, si es ejecutable, trae su propio botón: un toque del listado al
// paso 1, en vez de abrir la guía y buscar "Ejecutar" dentro.

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
}) {
  const Icono = iconoDeTipo(articulo.tipo)
  const { pre, match, post } = partirTitulo(articulo.titulo, consulta)
  // Un artículo obsoleto sigue siendo consultable (a veces es lo único
  // que hay), pero no debe pesar lo mismo que uno vigente: baja de
  // jerarquía sin desaparecer.
  const obsoleto = articulo.estado === 'obsoleto'
  const capacidad = capacidadDeGuia(articulo)
  const linea = lineaDeCapacidad(capacidad)

  return (
    // La tarjeta NO es un enlace que envuelva al botón: un control dentro
    // de otro control no es HTML válido y el lector de pantalla no sabría
    // cuál anuncia. El cuerpo es el enlace y "Ejecutar" va a su lado.
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        capacidad.ejecutable
          ? 'border-noct-divider bg-noct-surface'
          : 'border-dashed border-noct-neutral-700 bg-transparent'
      }`}
    >
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 text-noct-text">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-noct-text/[.06]">
          <Icono size={21} className={colorIconoDeTipo(articulo.tipo)} aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block text-[16.5px] font-medium leading-[1.25] [text-wrap:pretty] ${
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
            // LÍNEA DE CAPACIDAD (3b): qué puede hacer esta guía por ti.
            // A 13,5 px en neutral-300, nunca en neutral-600: con ese paso
            // el contraste sobre el fondo es 4.0:1 y AA pide 4.5 (R2).
            <span
              className={`mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] ${
                linea.aviso ? 'text-noct-precaucion' : 'text-noct-neutral-300'
              }`}
            >
              {categoriaNombre && <span className="truncate text-noct-neutral-400">{categoriaNombre}</span>}
              <span className={linea.aviso ? '' : 'text-noct-text'}>{linea.pasos}</span>
              {linea.minutos && <span>{linea.minutos}</span>}
              {linea.verificacion && (
                <span className="inline-flex items-center gap-1 text-noct-exito">
                  <Check size={14} aria-hidden />
                  verificación
                </span>
              )}
              {/* En neutral-400 y no en ámbar: el ámbar ya lo puso "Sin
                  pasos". Repetirlo en toda la línea la convertiría en una
                  alarma, y un manual sin pasos no está roto. */}
              {linea.aviso && <span className="text-noct-neutral-400">{linea.aviso}</span>}
            </span>
          )}
        </span>

        <PastillaEstadoArticulo estado={articulo.estado} />
      </Link>

      {/* "Ejecutar" de 52 px en la propia fila: un toque del listado al
          paso 1. Y su AUSENCIA es la señal de que no hay procedimiento,
          así que no hace falta ningún cartel que lo diga. */}
      {capacidad.ejecutable ? (
        <Link
          to={`${to}/ejecutar`}
          aria-label={`Ejecutar "${articulo.titulo}"`}
          title="Ejecutar"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-noct-accent bg-noct-accent/10 text-noct-accent-300 hover:bg-noct-accent/[.24]"
        >
          <Play size={18} aria-hidden />
        </Link>
      ) : (
        <CaretRight size={17} className="shrink-0 text-noct-neutral-400" aria-hidden />
      )}
    </div>
  )
}
