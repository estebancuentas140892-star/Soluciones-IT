import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { IconoCategoria } from '../../components/IconoCategoria'
import { Question } from '../../components/iconos'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { TARJETA_TOCABLE } from '../../components/ventana/estilos'
import type { TramoTitulo } from '../busqueda/presentacionResultados'
import { lineaAvanceGuia, type AccionGuia } from './accionGuia'
import { capacidadDeGuia, lineaDeCapacidad } from './capacidadGuia'
import { lineaQueDistingue } from './catalogoTelefono'
import { iconoDeTipoEnTelefono } from './iconosSoluciones'
import { tipoEnSingular } from './tiposArticulo'

// UNA GUÍA EN UNA LISTA DEL TELÉFONO (tarea 358, alternativa A2 de Claude
// Design, «cada guía con su identidad»). La comparten el catálogo de Guías y
// la búsqueda de Resolver; desde 768 px cada pantalla conserva su fila
// (`FilaArticulo`, `FilaResultado`).
//
// Al buscar «impresora» salían ocho tarjetas que empezaban por la misma
// impresora rosa y resaltaban justo la palabra que todas compartían: había que
// leerlas enteras para elegir. Ahora cada guía se reconoce sin abrirla, de
// arriba abajo:
//
//   1. POR SU FORMA: el glifo del tipo, en tinta, en un recuadro neutro de 40
//      (D4). Sin color: el ámbar y el verde significan atención y comprobado.
//   2. POR LO QUE CAMBIA DE SU TÍTULO: en una lista homogénea la palabra
//      repetida va atenuada y el resto en claro (D12, `tramosDeTitulo`). El
//      título nunca se recorta (regla 23).
//   3. POR SU SITUACIÓN, en una línea: su «cuándo usarla» o su primer síntoma
//      (D11, `lineaQueDistingue`). Lo secundario sí puede recortarse.
//   4. POR SU MEDIDA, en pequeño: «Aplica a», la categoría si la lista las
//      mezcla, el tipo y «6 pasos · ~10 min» o «para leer».
//
// Una guía a medias cambia la medida por «Vas en el paso N de M» en acento y
// la flecha por «Continuar»: se ve por la palabra y por el sitio, sin sumar un
// elemento. Toda la tarjeta es un solo toque, como `FilaArticulo`.

/** Atributos `data-*` para quien busca la tarjeta (las pruebas, la búsqueda). */
type AtributosDatos = { [clave: `data-${string}`]: string | boolean }

export function TarjetaGuiaTelefono({
  articulo,
  to,
  state,
  onClick,
  tramos,
  accion,
  conCategoria = false,
  categoriaNombre = '',
  posibleCoincidencia = false,
  datos,
}: {
  articulo: Articulo
  to: string
  state?: unknown
  onClick?: () => void
  /** El título en tramos (`tramosDeTitulo`); sin búsqueda, un solo tramo. */
  tramos?: TramoTitulo[]
  /** El avance de la guía en este teléfono (`accionDeGuia`), o null. */
  accion?: AccionGuia | null
  /** La categoría en la medida: solo donde la lista mezcla categorías. */
  conCategoria?: boolean
  categoriaNombre?: string
  /** Coincidió solo con una errata (búsqueda): se dice, como en las demás tarjetas. */
  posibleCoincidencia?: boolean
  datos?: AtributosDatos
}) {
  const Glifo = iconoDeTipoEnTelefono(articulo.tipo)
  const obsoleta = articulo.estado === 'obsoleto'
  const capacidad = capacidadDeGuia(articulo)
  const linea = lineaDeCapacidad(capacidad)
  const avance = capacidad.ejecutable ? lineaAvanceGuia(accion) : null
  const situacion = lineaQueDistingue(articulo)
  const aplicaA = [articulo.aplicaA?.marca, articulo.aplicaA?.modelo]
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(' ')
  const medida = [
    aplicaA,
    conCategoria ? categoriaNombre : '',
    tipoEnSingular(articulo.tipo),
    capacidad.ejecutable ? [linea.pasos, linea.minutos].filter(Boolean).join(' · ') : linea.aviso,
  ]
    .filter(Boolean)
    .join(' · ')
  // El nombre accesible sustituye al texto de la tarjeta: lleva también lo que
  // la pastilla y el aviso dicen a la vista (borrador, obsoleta, posible).
  const estado =
    articulo.estado === 'borrador' ? ' (borrador)' : articulo.estado === 'obsoleto' ? ' (obsoleta)' : ''
  const etiqueta = `${
    avance
      ? `Continuar "${articulo.titulo}"${estado}: ${avance.charAt(0).toLowerCase()}${avance.slice(1)}`
      : capacidad.ejecutable
        ? `Abrir la guía "${articulo.titulo}"${estado}`
        : `Abrir "${articulo.titulo}"${estado}`
  }${posibleCoincidencia ? ', posible coincidencia' : ''}`

  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      aria-label={etiqueta}
      data-tarjeta-guia
      {...datos}
      className={`${TARJETA_TOCABLE} flex w-full min-w-0 items-start gap-3 p-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent`}
    >
      <span
        aria-hidden
        data-glifo-tipo={articulo.tipo}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-noct-neutral-900 ${
          obsoleta ? 'text-noct-neutral-500' : 'text-noct-text'
        }`}
      >
        <Glifo size={21} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span
          data-nombre-principal
          className={`min-w-0 text-[16px] font-bold leading-[21px] text-pretty [overflow-wrap:anywhere] ${
            obsoleta ? 'text-noct-neutral-400' : ''
          }`}
        >
          {(tramos ?? [{ texto: articulo.titulo }]).map((tramo, indice) => (
            <span
              key={indice}
              data-tramo={tramo.atenuado ? 'atenuado' : tramo.resaltado ? 'resaltado' : undefined}
              className={
                tramo.atenuado
                  ? 'font-medium text-noct-neutral-300 underline decoration-noct-accent-600 decoration-dotted underline-offset-4'
                  : tramo.resaltado
                    ? 'rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200'
                    : undefined
              }
            >
              {tramo.texto}
            </span>
          ))}
        </span>
        {posibleCoincidencia && (
          <span data-posible-coincidencia className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-noct-precaucion">
            <Question size={13} className="shrink-0" aria-hidden />
            Posible coincidencia
          </span>
        )}
        {situacion && (
          <span data-situacion className="line-clamp-1 text-[14px] font-medium leading-[1.4] text-noct-neutral-300">
            {situacion}
          </span>
        )}
        {avance ? (
          <span className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-0.5 pt-0.5 text-[14px] leading-[1.35] text-noct-accent-300">
            <span className="font-bold">{avance}</span>
            <span aria-hidden className="font-extrabold">
              Continuar
            </span>
          </span>
        ) : (
          <span data-medida className="flex items-start gap-1.5 pt-0.5 text-[13px] font-semibold leading-[18px] text-noct-neutral-400">
            {conCategoria && categoriaNombre && <IconoCategoria nombre={categoriaNombre} tam={18} />}
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>{medida}</span>
              <PastillaEstadoArticulo estado={articulo.estado} />
            </span>
          </span>
        )}
      </span>
      {!avance && <IconoVentana nombre="adelante" tam={18} className="shrink-0 self-center text-noct-neutral-400" />}
    </Link>
  )
}
