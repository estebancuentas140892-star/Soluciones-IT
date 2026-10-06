import type { ComponentPropsWithRef, ReactNode } from 'react'
import { claseBoton, type OpcionesBoton, type TamanoBoton } from './claseBoton'
import { AroCarga } from './AroCarga'

export type { OpcionesBoton, PapelBoton, TamanoBoton, TonoTexto } from './claseBoton'

// EL BOTÓN DE SOLUCIONES IT: CUATRO PAPELES, TRES TAMAÑOS (tarea 291,
// auditoría UX de Claude Design, sección 10, T1 a T4, y sección 9, P1).
//
// Hasta la 291 había nueve constantes en `nocturne.tsx` (primario,
// secundario, peligro, cuatro fantasmas y dos de icono) más los botones
// sueltos de cada pantalla, sobre una base de unos 32 px de alto que
// cada pantalla corregía a su manera (`min-h-11`, `min-h-12`,
// `min-h-[46px]`, `min-h-[52px]`...) y cuatro opacidades de desactivado
// (30, 40, 45, 50, 55 %). La auditoría lo midió como "seis tamaños para
// el botón principal" y "nueve constantes para cuatro ideas".
//
// Aquí queda uno solo:
//
// - **Papel** (qué hace): `principal` avanza o termina, uno por pantalla
//   (delineado en acento con fondo tenue, nunca relleno); `secundario`
//   es la alternativa real (No, Anterior, Editar); `texto` es la acción
//   en línea (`tono="accion"`, en acento: Cambiar, Asignar) o el descarte
//   (`tono="descarte"`, en gris: Cancelar); `destructivo` ejecuta lo que
//   no se deshace y siempre nombra su objeto ("Eliminar el equipo"). El
//   rojo solo destruye: el único texto en rojo (`tono="peligro"`) es el
//   que abre la confirmación de una eliminación o quita algo, como la fila
//   "Eliminar el equipo" de la hoja de acciones (E4), sin borde.
// - **Tamaño** (dónde está): 64 solo el pie de la ejecución de una guía
//   (peso 600: se pulsa cada pocos segundos, a veces con una mano); 52 en
//   las barras inferiores y las hojas del teléfono, que desde 768 px pasan
//   a 44; 44 en cabeceras, contenido y escritorio. **Nunca menos de 44 de
//   área** (T3). El tamaño es parte del botón: ninguna pantalla lo añade a
//   mano.
// - **Solo icono** no es un papel: es una forma de cualquiera de ellos,
//   siempre cuadrada y de 44 como mínimo, con nombre accesible propio
//   (`aria-label`) y su nombre al pasar el ratón (`title`, T8).
//
// Estados comunes (T4): encima solo con ratón (en Tailwind 4 `hover:` ya
// va dentro de `@media (hover: hover)`), pulsado con un tinte del mismo
// color, foco de 2 px a 2 px solo con teclado, desactivado al 45 % (y solo
// con la razón escrita al lado: si no se puede escribir, el botón queda
// activo y explica al pulsar) y la carga DENTRO del botón: "Guardando…",
// el mismo ancho e inactivo mientras termina (F9).
//
// Cada combinación se arma aquí completa. Igual que antes en
// `nocturne.tsx`, no se le puede añadir a un botón otro color, alto o
// radio desde fuera: dos utilidades del mismo tipo empatan y gana la que
// Tailwind emite después, no la que se escribe al final (COMPONENTES_UI.md,
// sección 0). Lo que sí admite `className` es colocación: márgenes,
// `self-*`, `flex-1`, `shrink-0`, `order-*`.

const TAMANO_ARO: Record<TamanoBoton, number> = { 64: 20, 52: 17, 44: 16 }

type PropsBoton = Omit<ComponentPropsWithRef<'button'>, 'children'> &
  OpcionesBoton & {
    // Dibujo a la izquierda del texto, solo cuando ayuda a reconocer la
    // acción (✓ Completar, ▶ Probar, Copiar, Mostrar); nunca en "Guardar…"
    // ni en "Cancelar". En la forma de solo icono, es el icono.
    icono?: ReactNode
    // El verbo en gerundio que se lee mientras dura (`cargando`):
    // "Guardando…", "Eliminando…", "Comprobando…". Se reserva su sitio
    // desde el principio para que el botón no cambie de ancho.
    textoCargando?: string
    children?: ReactNode
  }

export function Boton({
  papel,
  tamano = 44,
  tono,
  soloIcono = false,
  anchoCompleto = false,
  cargando = false,
  icono,
  textoCargando,
  type = 'button',
  disabled,
  className = '',
  children,
  ...resto
}: PropsBoton) {
  const clase = claseBoton({ papel, tamano, tono, soloIcono, anchoCompleto, cargando })
  // Lo que se reserva sin verse: el texto de carga antes de pulsar y, ya
  // cargando, el normal (si es texto: un rótulo con marcado no cabe en un
  // atributo, y entonces el botón puede encogerse un poco al cargar).
  const reserva = textoCargando
    ? cargando
      ? typeof children === 'string'
        ? children
        : undefined
      : textoCargando
    : undefined
  const aro = <AroCarga size={soloIcono ? 18 : TAMANO_ARO[tamano]} />

  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={className ? `${clase} ${className}` : clase}
      {...resto}
    >
      {soloIcono ? (
        cargando ? (
          aro
        ) : (
          (icono ?? children)
        )
      ) : (
        // EL MISMO ANCHO CARGANDO. El texto que no se ve (el de carga
        // antes de pulsar, el normal mientras carga) ocupa la MISMA celda
        // de una rejilla como pseudoelemento `invisible`: el botón mide lo
        // que el más ancho de los dos desde antes de pulsar. Va en
        // `::after` con `attr()` y no en un elemento para que no entre en
        // el texto del botón ni en su nombre accesible (`invisible` lo
        // saca además del árbol de accesibilidad): solo se lee uno.
        // `pl-6` reserva el aro o el icono que acompañan al texto visible.
        <span
          data-reserva={reserva}
          className={`grid min-w-0 ${
            reserva
              ? `after:invisible after:col-start-1 after:row-start-1 after:content-[attr(data-reserva)] ${
                  cargando && !icono ? '' : 'after:pl-6'
                }`
              : ''
          }`}
        >
          <span className="col-start-1 row-start-1 inline-flex min-w-0 items-center justify-center gap-2">
            {cargando ? aro : icono}
            {cargando && textoCargando ? textoCargando : children}
          </span>
        </span>
      )}
    </button>
  )
}
