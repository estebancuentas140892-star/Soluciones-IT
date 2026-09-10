import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { ArrowRight, Check, Play } from '../../components/iconos'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { colorIconoDeTipo, iconoDeTipo } from './iconosSoluciones'
import { partirTitulo } from './coincidencia'
import { capacidadDeGuia, lineaDeCapacidad } from './capacidadGuia'

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
// verificación final y para un borrador sin un solo paso, así que el
// técnico descubría que la guía estaba vacía **después de abrirla**, de
// pie y frente al equipo. Ahora cada tarjeta dice **lo que la guía puede
// hacer por ti** y, si es ejecutable, trae su propia acción: un toque del
// listado al paso 1, en vez de abrir la guía y buscar "Ejecutar" dentro.
//
// EL REPARTO EN TRES ZONAS (encargo del 2026-09-09, sección 1). Hasta
// hoy la tarjeta era UNA fila: glifo, título, pastilla "Borrador" y un
// botón de ejecutar de 52 px, los cuatro repartiéndose el mismo ancho.
// En 360 px al título le quedaban unos 150, así que
// "Configurar las páginas que abre Google Chrome al iniciar en un POS"
// se leía como una columna de palabras sueltas. La causa no era el
// tamaño de letra ni la falta de recorte: era el reparto del renglón.
//
// Ahora la tarjeta se lee de arriba abajo y cada zona tiene el ancho
// entero:
//
//   1. el TÍTULO, con el glifo al lado y nada más que le quite sitio;
//   2. los METADATOS (categoría, pasos, minutos, verificación y el
//      estado "Borrador"), que pueden pasar a otra línea sin estrechar
//      el título;
//   3. la ACCIÓN (abrir, empezar o continuar), en su propia fila.
//
// Sin recorte ni `line-clamp`: el nombre completo se lee entero en la
// propia tarjeta, así que no hace falta ningún gesto para recuperarlo, y
// menos uno de `hover`, que en un teléfono no existe.

// Dónde coincidió la búsqueda, cuando NO fue en el título. Sin esto la
// lista muestra resultados sin explicación aparente ("¿por qué sale este
// artículo si no dice 'zebra' en ninguna parte?").
export interface CoincidenciaFila {
  // En palabras y con artículo: "la etiqueta", "la categoría", "el tipo".
  donde: string
  // El valor que coincidió; se muestra como chip a continuación.
  valor: string
}

/** Avance guardado de esta guía en este dispositivo, si lo hay. */
export interface AvanceFila {
  hechos: number
  total: number
  /**
   * Primer paso PENDIENTE de verdad (1-based), o null si no queda
   * ninguno. No es `hechos + 1`: con los pasos cerrados fuera de orden
   * esa cuenta señalaba un paso ya hecho (tarea 5 del encargo).
   */
  pasoPendiente: number | null
}

export function FilaArticulo({
  articulo,
  to,
  categoriaNombre,
  consulta = '',
  coincidencia,
  avance,
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
  // Avance a medias, para que la acción diga "Continuar" en vez de
  // "Empezar" y nombre el paso. Es la misma lectura que hace la ficha
  // (`BarraAccionFicha`), traída a la tarjeta para que las dos digan lo
  // mismo. Sin avance, o con la guía terminada, se omite.
  avance?: AvanceFila | null
}) {
  const Icono = iconoDeTipo(articulo.tipo)
  const { pre, match, post } = partirTitulo(articulo.titulo, consulta)
  // Un artículo obsoleto sigue siendo consultable (a veces es lo único
  // que hay), pero no debe pesar lo mismo que uno vigente: baja de
  // jerarquía sin desaparecer.
  const obsoleto = articulo.estado === 'obsoleto'
  const capacidad = capacidadDeGuia(articulo)
  const linea = lineaDeCapacidad(capacidad)
  // "Continuar" solo con avance real y sin terminar: con 0 pasos hechos
  // no hay nada que continuar, y con todos hechos lo honesto es volver a
  // ofrecer "Empezar", porque repetir una guía es el caso normal de un
  // mantenimiento.
  const aMedias = avance != null && avance.hechos > 0 && avance.pasoPendiente !== null

  return (
    // La tarjeta NO es un enlace que envuelva a la acción: un control
    // dentro de otro control no es HTML válido y el lector de pantalla no
    // sabría cuál anuncia. El cuerpo (título y metadatos) es el enlace, y
    // la acción vive en su propia fila, DEBAJO, para no quitarle ancho al
    // título.
    <div
      className={`flex flex-col rounded-xl border p-3 ${
        capacidad.ejecutable
          ? 'border-noct-divider bg-noct-surface'
          : 'border-dashed border-noct-neutral-700 bg-transparent'
      }`}
    >
      <Link to={to} className="flex min-w-0 flex-col gap-2 text-noct-text">
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
          <span
            className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13.5px] ${
              linea.aviso ? 'text-noct-precaucion' : 'text-noct-neutral-300'
            }`}
          >
            {categoriaNombre && <span className="text-noct-neutral-400">{categoriaNombre}</span>}
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
            {/* El estado baja aquí desde su antigua ranura propia en el
                renglón del título, donde le costaba a ese título unos 90
                px de ancho. Es un metadato más. */}
            <PastillaEstadoArticulo estado={articulo.estado} />
          </span>
        )}
      </Link>

      {/* ZONA 3: la acción, en su propia fila y a 48 px de alto. Una guía
          ejecutable ofrece empezarla o continuarla; una que solo son
          notas ofrece abrirla, que es todo lo que se puede hacer con
          ella. Nunca comparte renglón con el título. */}
      <div className={`flex ${capacidad.ejecutable ? 'mt-2.5' : 'mt-1'}`}>
        {capacidad.ejecutable ? (
          <Link
            to={`${to}/ejecutar`}
            aria-label={
              aMedias
                ? `Continuar "${articulo.titulo}" en el paso ${avance.pasoPendiente} de ${avance.total}`
                : `Empezar "${articulo.titulo}"`
            }
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-noct-accent bg-noct-accent/10 px-3 text-[14.5px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
          >
            <Play size={17} className="shrink-0" aria-hidden />
            <span className="truncate">
              {aMedias ? `Continuar · paso ${avance.pasoPendiente} de ${avance.total}` : 'Empezar'}
            </span>
          </Link>
        ) : (
          // La de "solo notas" va a la derecha y con el ancho justo, no
          // a lo ancho como la de ejecutar: son 13 tarjetas de 44 px en
          // un catálogo de 20, y darles el mismo peso que a una guía
          // ejecutable llenaría la pantalla de botones que solo
          // repiten el enlace del título. Sigue midiendo 44 px de alto,
          // que es lo que pide el dedo (R6).
          <Link
            to={to}
            aria-label={`Abrir "${articulo.titulo}"`}
            className="ml-auto flex h-11 min-w-0 items-center gap-2 rounded-[10px] px-3 text-[14.5px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
          >
            <span className="truncate">Abrir</span>
            <ArrowRight size={17} className="shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}
