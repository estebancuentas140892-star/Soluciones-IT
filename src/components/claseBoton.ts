// LAS CLASES DEL BOTÓN DE SOLUCIONES IT (tarea 291). Ver el porqué de
// los cuatro papeles y los tres tamaños en `Boton.tsx`.
//
// Vive en su propio módulo, SIN importaciones, para lo que se dibuja desde
// el trozo de entrada: `ErrorBoundary` se importa de forma estática en
// `main.tsx` y no puede arrastrar `iconos.tsx` (38 kB) ni nada más que
// estas cadenas. `Boton.tsx` las reexporta para el resto de la app.

export type PapelBoton = 'principal' | 'secundario' | 'texto' | 'destructivo'
export type TamanoBoton = 64 | 52 | 44
// Solo para el papel `texto`: actuar (acento), descartar (gris) o abrir
// la confirmación de lo que destruye (rojo).
export type TonoTexto = 'accion' | 'descarte' | 'peligro'

export interface OpcionesBoton {
  papel: PapelBoton
  tamano?: TamanoBoton
  tono?: TonoTexto
  // Forma de solo icono. `'campo'` es la del botón que acompaña a un campo
  // de búsqueda (escanear QR, filtrar): con borde y la altura del campo,
  // 46 px, que es la única medida fuera de la escala y tiene esa razón (T8).
  soloIcono?: boolean | 'campo'
  anchoCompleto?: boolean
  cargando?: boolean
}

const BASE =
  'inline-flex cursor-pointer select-none items-center justify-center text-center leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent'

// Alto, radio y letra por tamaño, para los botones con texto. El de 52
// pasa a 44 desde `md`: en escritorio cambia el aspecto (14 px, radio 8),
// no el área (T1, P1, P6). `min-h` y no `h`: con el texto al 130 % un
// botón pasa a dos líneas antes que recortarse (U3).
const ALTO: Record<TamanoBoton, string> = {
  64: 'min-h-16 gap-2 rounded-xl py-2 text-[17px] font-semibold',
  52: 'min-h-[52px] gap-2 rounded-xl py-2 text-[15px] font-medium md:min-h-11 md:rounded-lg md:text-sm',
  44: 'min-h-11 gap-2 rounded-lg py-1.5 text-sm font-medium',
}

// La caja de un botón de solo icono: cuadrada, el toque es la caja entera
// y el dibujo (16 a 20 px) lo pone quien lo usa.
const CUADRO: Record<TamanoBoton | 'campo', string> = {
  64: 'h-16 w-16 rounded-xl',
  52: 'h-[52px] w-[52px] rounded-xl md:h-11 md:w-11 md:rounded-lg',
  44: 'h-11 w-11 rounded-lg',
  campo: 'h-[46px] w-[46px] rounded-lg',
}

// Color, tinte al pasar y tinte al pulsar de cada papel: completos, sin
// componerse con nada.
const COLOR = {
  principal:
    'border border-noct-accent bg-noct-accent/[.12] text-noct-accent-300 hover:bg-noct-accent/20 active:bg-noct-accent/[.28] active:text-noct-accent-200',
  secundario: 'border border-noct-divider text-noct-text hover:bg-noct-text/[.07] active:bg-noct-text/15',
  textoAccion: 'border border-transparent text-noct-accent-300 hover:bg-noct-accent/10 active:bg-noct-accent/20',
  textoDescarte: 'border border-transparent text-noct-neutral-300 hover:bg-noct-text/[.07] active:bg-noct-text/15',
  // Los iconos universales de cabeceras y hojas (volver, cerrar, favorito,
  // más): sin borde y en el gris claro de 10b.
  textoIcono: 'border border-transparent text-noct-neutral-200 hover:bg-noct-text/[.07] active:bg-noct-text/15',
  textoPeligro: 'border border-transparent text-noct-error hover:bg-noct-error/10 active:bg-noct-error/20',
  destructivo:
    'border border-noct-error bg-noct-error/10 text-noct-error hover:bg-noct-error/20 active:bg-noct-error/[.28]',
} as const

function claseColor(papel: PapelBoton, tono: TonoTexto | undefined, soloIcono: boolean): string {
  if (papel === 'texto') {
    if (tono === 'descarte') return COLOR.textoDescarte
    if (tono === 'peligro') return COLOR.textoPeligro
    if (tono === 'accion') return COLOR.textoAccion
    return soloIcono ? COLOR.textoIcono : COLOR.textoAccion
  }
  return COLOR[papel]
}

// Solo la forma y los estados de un botón con texto, sin color. Existe para
// UNA excepción documentada: el lenguaje de color de la guía en ejecución
// (verde "Sí, lo comprobé", rojo "No se cumple"), que la auditoría UX
// conserva ("Se mantiene: el lenguaje de color de la guía, siempre con
// icono y palabra"). Fuera de la guía, todo botón usa uno de los cuatro
// papeles de `claseBoton`.
export function claseFormaBoton(tamano: TamanoBoton = 44): string {
  return `${BASE} ${ALTO[tamano]} px-[18px] border disabled:cursor-default disabled:opacity-45`
}

// Las clases completas de un botón, para el elemento que no es un
// `<button>` pero se ve como uno (un `<Link>` de react-router, un
// `<label>` que abre un selector de archivos).
export function claseBoton({
  papel,
  tamano = 44,
  tono,
  soloIcono = false,
  anchoCompleto = false,
  cargando = false,
}: OpcionesBoton): string {
  const forma = soloIcono
    ? `shrink-0 p-0 ${CUADRO[soloIcono === 'campo' ? 'campo' : tamano]}`
    : `${ALTO[tamano]} ${papel === 'texto' ? 'px-2' : 'px-[18px]'}`
  // Cargando: inactivo pero legible (80 %), no el 45 % de desactivado, que
  // diría "no se puede" justo cuando se está haciendo.
  const estado = cargando ? 'cursor-default opacity-80' : 'disabled:cursor-default disabled:opacity-45'
  return [BASE, forma, claseColor(papel, tono, Boolean(soloIcono)), estado, anchoCompleto ? 'w-full' : '']
    .filter(Boolean)
    .join(' ')
}
