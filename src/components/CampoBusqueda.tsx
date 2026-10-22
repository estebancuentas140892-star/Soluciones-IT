import { createContext, useContext, type ReactNode, type Ref } from 'react'
import { MagnifyingGlass, XCircleFill } from './iconos'
import { IconoVentana } from './ventana/IconoVentana'

// EL CAMPO EN LA BARRA SUPERIOR (tarea 339, handoff de tableta y escritorio).
// Desde 768 px el buscador de una raíz (Resolver, Equipos, Bóveda) deja el
// dock y sube a la barra, junto al título: es el MISMO elemento, montado en
// otro sitio (`buscador` del chasis), y el sitio es lo que decide su forma.
// La barra lo envuelve en este contexto, con lo que va dentro del campo al
// final (el escáner, tras una línea); fuera de la barra vale `null` y el
// campo es el de siempre.
const CampoEnBarraContexto = createContext<{ accesorio?: ReactNode } | null>(null)

export const ProveedorCampoEnBarra = CampoEnBarraContexto.Provider

// UN BUSCADOR POR PANTALLA, SIEMPRE EL MISMO (tarea 207, hallazgos
// M-004, M-005 y M-009, regla M-R8).
//
// Había NUEVE copias de este campo repartidas por la app, con cuatro
// alturas (46, 44, 42), dos radios, dos tamaños de icono y alcances
// redactados cada uno a su manera. La auditoría lo midió como una duda
// antes de escribir: "¿esto busca en todo o solo aquí?". Y el botón de
// borrar medía unos 26 px en casi todas (Guías era la excepción, con
// 44), justo el control que más se falla porque se usa con el teclado
// abierto y una mano.
//
// Aquí queda uno solo: **46 px de alto**, el alcance escrito en el
// marcador de posición con la misma fórmula en toda la app ("Buscar en
// X") y el borrar a **44 px reales** con margen negativo, para que el
// objetivo táctil crezca sin ensanchar la fila (regla R6, regla M-R14).
//
// UNA EXCEPCIÓN, CON NOMBRE (propuesta final de Claude Design,
// 2026-10-01): en Resolver el campo ES la pantalla ("Tengo un problema,
// lo escribo aquí"), así que la variante `destacada` mide 52 px, con el
// texto a 16 px (sin el zoom de iOS al enfocar) y el borde neutro un
// punto más visible en reposo. El resto de la app sigue con los 46 px.
//
// `resolver` (rediseño móvil, fase 1, tarea 344; DESPUÉS de Claude Design):
// el campo de Resolver en el teléfono, ARRIBA y no en el dock. Borde de
// acento de 2 px siempre (es lo primero que se toca), 17 px de texto y la
// lupa en acento. Su alto lo da la pantalla: 60 al abrir Resolver, 52 en la
// búsqueda.
export function CampoBusqueda({
  valor,
  onCambiar,
  alcance,
  textoAlternativo,
  refCampo,
  variante = 'normal',
  onEnfocar,
  abierta = false,
  accesorio,
  className = '',
}: {
  valor: string
  onCambiar: (valor: string) => void
  // Dónde busca este campo, tal cual se lee: "Guías", "Equipos", "la
  // Bóveda". Compone el marcador ("Buscar en Guías") y la etiqueta
  // accesible, así que no hace falta repetirlo.
  alcance: string
  // Marcador propio, para el campo que no es una búsqueda por alcance
  // sino una pregunta (Diagnóstico: "Describir el problema: no imprime,
  // sin red..."). La etiqueta accesible sigue diciendo el alcance.
  textoAlternativo?: string
  refCampo?: Ref<HTMLInputElement>
  // `paleta` (tarea 339, T6): el campo de la paleta del buscador global
  // desde 1280. Sin caja: es la cabecera de la paleta, que ya es la
  // superficie; la lupa en acento y el texto a 18 px.
  variante?: 'normal' | 'destacada' | 'dock' | 'paleta' | 'resolver'
  /** El campo recibe el foco (Resolver abre su búsqueda en el teléfono). */
  onEnfocar?: () => void
  /**
   * Solo con `variante="resolver"` (tarea 350, el campo del prototipo de
   * Claude Design): en Inicio, una caja de 58 con borde fuerte y relieve;
   * abierta la búsqueda, de 52 con el borde y el anillo del acento.
   */
  abierta?: boolean
  /** Solo con `variante="resolver"`: al final del campo mientras no hay nada escrito (el escáner). */
  accesorio?: ReactNode
  className?: string
}) {
  const enBarra = useContext(CampoEnBarraContexto)
  const buscando = valor.trim().length > 0
  // `dock` (tarea 330): el de abajo, al pulgar. Mismo alto que `destacada`
  // (52 px), más redondo, con borde y sombra: flota sobre la lista.
  const dock = variante === 'dock' && !enBarra
  const resolver = variante === 'resolver' && !enBarra
  const destacada = (variante === 'destacada' || variante === 'dock' || resolver) && !enBarra
  const paleta = variante === 'paleta' && !enBarra

  // En la barra (tarea 339): 44 px en tableta y 48 desde 1280, con el
  // borde neutro fuerte del dock y la elevación del tema claro. Lo de
  // dentro (icono, texto, borrar) a la medida de un campo con ratón.
  const forma = enBarra
    ? 'h-11 gap-2.5 rounded-xl pl-3.5 pr-1.5 shadow-[var(--shadow-noct-elevacion)] xl:h-12 xl:rounded-[13px] xl:pl-4'
    : paleta
      ? 'h-16 min-w-0 flex-1 gap-3'
    : resolver
      ? abierta
        ? 'h-[52px] gap-2 rounded-2xl border-2 pl-3.5 pr-2 shadow-[0_0_0_4px_var(--color-noct-accent-900)]'
        : 'h-[58px] gap-3 rounded-[18px] border-2 pl-4 pr-1 shadow-[0_3px_0_var(--color-noct-divider)]'
    : dock
      ? 'h-[52px] gap-2.5 rounded-2xl pl-4 pr-3.5 shadow-[0_6px_20px_rgba(0,0,0,.16)]'
      : destacada
        ? 'h-[52px] gap-3 rounded-[10px] pl-4 pr-3.5'
        : 'h-[46px] gap-2.5 rounded-lg px-3.5'
  const borde = paleta
    ? ''
    : resolver
    ? abierta
      ? 'border-noct-accent'
      : 'border-noct-divider-fuerte'
    : buscando
    ? 'border-noct-accent'
    : dock || enBarra
      ? 'border-noct-text/25'
      : destacada
        ? 'border-noct-neutral-600'
        : 'border-noct-divider'

  return (
    <label
      // El borde de acento dice también DÓNDE va lo que se escriba: el
      // campo no dibuja anillo propio (`outline-none` y la regla de
      // `[data-campo-busqueda]` en index.css, que apaga el anillo global
      // para no dibujar un segundo marco dentro de la caja). Con el foco,
      // borde más `ring-1`: 2 px de acento, tan visibles como el anillo
      // global que sustituyen, y distintos del borde de 1 px que queda
      // cuando hay texto escrito pero el foco está en otra parte.
      // En `resolver` el borde ya es de 2 px (`forma`): sin el de 1 px de la
      // base, que competiría con él por la misma propiedad.
      className={`flex items-center ${
        paleta
          ? ''
          : resolver
            ? 'bg-noct-surface'
            : 'border bg-noct-surface transition-colors focus-within:border-noct-accent focus-within:ring-1 focus-within:ring-noct-accent'
      } ${forma} ${borde} ${className}`}
    >
      {resolver ? (
        <IconoVentana nombre="buscar" tam={abierta ? 20 : 22} grosor={2.4} className="shrink-0 text-noct-accent" />
      ) : (
        <MagnifyingGlass
          size={destacada || paleta ? 20 : 18}
          className={`shrink-0 ${buscando || dock || enBarra || paleta ? 'text-noct-accent-300' : destacada ? 'text-noct-neutral-300' : 'text-noct-neutral-400'}`}
          aria-hidden
        />
      )}
      <input
        ref={refCampo}
        type="search"
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        onFocus={onEnfocar}
        placeholder={textoAlternativo ?? `Buscar en ${alcance}`}
        aria-label={`Buscar en ${alcance}`}
        data-campo-busqueda
        // La "x" nativa de WebKit se oculta siempre: duplicaba el botón
        // de borrar y medía la mitad.
        className={`min-w-0 flex-1 bg-transparent text-noct-text outline-none placeholder:text-noct-neutral-400 [&::-webkit-search-cancel-button]:hidden ${
          enBarra
            ? 'text-[15px] xl:text-[15.5px]'
            : paleta
              ? 'text-[18px] font-medium'
              : resolver
                ? 'text-[17px] font-medium'
              : destacada
                ? 'text-[16px]'
                : // En el teléfono, 16 para que iOS no amplíe al enfocar (tarea 341).
                  'text-[15px] max-md:text-[16px]'
        }`}
      />
      {buscando && resolver && (
        // El «borrar» del prototipo: un círculo de 36 en la superficie 2, con
        // 44 de toque (`toque-amplio`).
        <button
          type="button"
          onClick={() => onCambiar('')}
          aria-label="Borrar la búsqueda"
          className="toque-amplio relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-noct-neutral-900 text-noct-neutral-300 hover:text-noct-text"
        >
          <IconoVentana nombre="cerrar" tam={16} grosor={2.6} />
        </button>
      )}
      {buscando && !resolver && (
        <button
          type="button"
          onClick={() => onCambiar('')}
          aria-label="Borrar la búsqueda"
          className={`flex shrink-0 items-center justify-center text-noct-neutral-300 hover:text-noct-text ${
            enBarra || paleta ? 'h-9 w-9 rounded-[9px] hover:bg-noct-text/[.05]' : '-mr-3 h-11 w-11'
          }`}
        >
          <XCircleFill size={destacada ? 19 : 18} aria-hidden />
        </button>
      )}
      {resolver && !buscando && accesorio}
      {enBarra?.accesorio && (
        <>
          <span className="h-[22px] w-px shrink-0 bg-noct-divider" aria-hidden />
          {enBarra.accesorio}
        </>
      )}
    </label>
  )
}
