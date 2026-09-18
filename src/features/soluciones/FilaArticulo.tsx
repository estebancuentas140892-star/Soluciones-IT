import { Link, useLocation } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { CaretRight, Check } from '../../components/iconos'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { colorIconoDeTipo, iconoDeTipo } from './iconosSoluciones'
import { partirTitulo } from './coincidencia'
import { capacidadDeGuia, lineaDeCapacidad } from './capacidadGuia'
import { lineaAvanceGuia, type AccionGuia } from './accionGuia'

// La tarjeta de un artículo en un listado, compartida por SolucionesPage y
// CategoriaPage. Sale de la auditoría de Soluciones, que la pedía como
// componente propio para dejar de copiar el marcado entre las dos
// pantallas.
//
// Sobre la decisión de la tarea 145, que dijo "NO crear <FilaArticulo>":
// ahí se comparaba la fila de artículo contra `<FilaDispositivo>` y la de
// Red ("no comparte interior con las otras dos filas"), y sigue siendo
// cierto: esto NO se unifica con la fila de dispositivo. Lo que se
// unifica son las DOS filas de artículo, que antes divergían solo porque
// nadie las había mirado juntas.
//
// Regla R1 de la auditoría, "color con oficio": el matiz del TIPO vive en
// el glifo y el recuadro va neutro (`text/6%`). El color de la CATEGORÍA
// sigue viviendo en los chips de filtro, no aquí.
//
// TABLERO 3b del handoff "Diseño móvil" (tarea 214): cada tarjeta dice
// **lo que la guía puede hacer por ti** ("7 pasos · ~25 min ·
// verificación", o "Sin pasos · para leer"), para no descubrir que una
// guía está vacía después de abrirla frente al equipo.
//
// Se lee de arriba abajo, y cada zona tiene el ancho entero (encargo del
// 2026-09-09, sección 1): el TÍTULO completo, sin recorte, con el glifo
// al lado; y debajo los METADATOS, que pueden pasar a otra línea sin
// estrechar el título.
//
// UNA TARJETA, UN TOQUE (encargo del 2026-09-17, sección 3). Hasta hoy
// la tarjeta tenía dos destinos: el título abría la ficha y un botón de
// 48 px ("Empezar", "Continuar · paso 2 de 3", "Repetir guía") abría la
// ejecución. Desde que abrir una guía lleva directo al primer paso
// pendiente, los dos hacían lo mismo, así que la tarjeta entera es el
// enlace y el botón se retira: el catálogo pierde una fila de botones por
// guía y el gesto principal no cambia. Lo que el botón decía de una guía
// a medias sigue a la vista, como información ("Vas en el paso 2 de 3").

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
  accion,
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
  // El avance de esta guía en este teléfono, resuelto por `accionDeGuia`
  // (la misma decisión que usa la ejecución). Sin ejecución guardada
  // llega null.
  accion?: AccionGuia | null
}) {
  const { pathname, search } = useLocation()
  const Icono = iconoDeTipo(articulo.tipo)
  const { pre, match, post } = partirTitulo(articulo.titulo, consulta)
  // Un artículo obsoleto sigue siendo consultable (a veces es lo único
  // que hay), pero no debe pesar lo mismo que uno vigente: baja de
  // jerarquía sin desaparecer.
  const obsoleto = articulo.estado === 'obsoleto'
  const capacidad = capacidadDeGuia(articulo)
  const linea = lineaDeCapacidad(capacidad)
  const avance = capacidad.ejecutable ? lineaAvanceGuia(accion) : null

  return (
    <Link
      to={to}
      // VOLVER A LA MISMA LISTA (criterio A03). La X de la guía y el
      // regreso de la ficha deshacen este salto con el filtro y el término
      // que había, no con el padre declarado, que solo repone la categoría.
      state={conOrigen(`${pathname}${search}`, 'Guías')}
      aria-label={capacidad.ejecutable ? `Abrir la guía "${articulo.titulo}"` : `Abrir "${articulo.titulo}"`}
      className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-noct-text hover:bg-noct-text/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent active:bg-noct-text/[.07] ${
        capacidad.ejecutable
          ? 'border-noct-divider bg-noct-surface'
          : 'border-dashed border-noct-neutral-700 bg-transparent'
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        {/* ZONA 1: el título, y nada más en su renglón. */}
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-px flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-noct-text/[.06]">
            <Icono size={21} className={colorIconoDeTipo(articulo.tipo)} aria-hidden />
          </span>
          <span
            className={`min-w-0 flex-1 text-[16.5px] font-medium leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty] ${
              obsoleto ? 'text-noct-neutral-300' : ''
            }`}
          >
            {pre}
            {match && (
              <span className="rounded-[3px] bg-noct-accent/[.22] px-0.5 text-noct-accent-200">{match}</span>
            )}
            {post}
          </span>
        </span>

        {/* ZONA 2: los metadatos, con permiso para pasar de línea. */}
        {coincidencia ? (
          <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-noct-neutral-400">
            Coincide en {coincidencia.donde}
            <span className="rounded-full bg-noct-neutral-800 px-[7px] py-px text-[11px] text-noct-neutral-200">
              {coincidencia.valor}
            </span>
          </span>
        ) : (
          // LÍNEA DE CAPACIDAD (3b): qué puede hacer esta guía por ti.
          // A 13,5 px en neutral-300, nunca en neutral-600: con ese paso
          // el contraste sobre el fondo es 4.0:1 y AA pide 4.5 (R2).
          // Sin ámbar (segunda pasada del encargo del 2026-09-17): un
          // artículo para leer no es un riesgo, y el ámbar de la lista
          // tiene que quedar libre para lo que sí lo es.
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13.5px] text-noct-neutral-300">
            {categoriaNombre && <span className="text-noct-neutral-400">{categoriaNombre}</span>}
            <span className={linea.aviso ? '' : 'text-noct-text'}>{linea.pasos}</span>
            {linea.minutos && <span>{linea.minutos}</span>}
            {linea.verificacion && (
              <span className="inline-flex items-center gap-1 text-noct-exito">
                <Check size={14} aria-hidden />
                verificación
              </span>
            )}
            {linea.aviso && <span className="text-noct-neutral-400">{linea.aviso}</span>}
            <PastillaEstadoArticulo estado={articulo.estado} />
          </span>
        )}

        {/* Dónde va una guía a medias en este teléfono. Es información,
            no un botón: tocar la tarjeta ya retoma ahí. */}
        {avance && <span className="text-[13px] font-medium text-noct-accent-300">{avance}</span>}
      </span>
      <CaretRight size={17} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}
