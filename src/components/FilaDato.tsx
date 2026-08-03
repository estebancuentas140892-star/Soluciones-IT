import { useState, type ReactNode } from 'react'
import { copiarAlPortapapeles } from '../lib/portapapeles'
import { Check, Copy } from './iconos'

// Fila de etiqueta y valor de una ficha, y el piso de legibilidad del
// dato técnico (auditoría móvil del 2026-08-03, hallazgos M-015 y M-032,
// reglas M-R5 y M-R13).
//
// El problema medido: la IP, el dato que más se busca en el sitio, era el
// texto más pequeño y de menor contraste de toda la app (11 px
// monoespaciado en `noct-neutral-600`, unos 3,9:1 sobre el fondo), por
// debajo del propio piso que fija la regla R2 del equipo. A pleno sol,
// con guantes y a un brazo de distancia, ese renglón no se lee: se
// adivina. Y la fila que lo contiene reservaba 118 px fijos para la
// etiqueta, así que a 360 px de ancho quedaban unos 174 px para el valor
// y un serial o una MAC se truncaban justo en el teléfono más común del
// equipo.
//
// Las dos reglas que aplica esta fila:
//
//   M-R5  IP, serial, placa, MAC, puerto y clave se leen a 13 px
//         monoespaciado como mínimo, nunca por debajo de neutral-300,
//         con cifras tabulares y copiables con un objetivo de 44 px.
//   M-R13 se diseña a 360 y se verifica a 412: ninguna etiqueta de ancho
//         fijo mayor de 96 px, y ningún valor truncado que sea el motivo
//         de la visita.
//
// Por eso un dato técnico NUNCA comparte renglón con su etiqueta (va
// debajo, a ancho completo) y un dato corriente solo lo comparte cuando
// el contenedor da para ello. El umbral es una container query de 380 px
// sobre el contenedor de la ficha, no el ancho de la ventana: la misma
// fila vive en una columna de 328 px en el teléfono y en una de 720 en
// escritorio.

/**
 * Clase del valor técnico (M-R5). Exportada para las pantallas que
 * pintan un dato técnico fuera de una `FilaDato` (la IP de una fila de
 * lista, el código leído por el escáner).
 */
export const VALOR_TECNICO = 'font-mono text-[14px] leading-[1.35] tabular-nums text-noct-text'

/**
 * Variante compacta del valor técnico, para listas donde el dato
 * acompaña a un nombre en vez de ser el protagonista. Es el piso exacto
 * de M-R5: 13 px y neutral-300, ni un paso por debajo.
 */
export const VALOR_TECNICO_COMPACTO = 'font-mono text-[13px] tabular-nums text-noct-neutral-300'

const ETIQUETA = 'text-[12px] leading-[1.35] text-noct-neutral-400'

interface Props {
  etiqueta: string
  /** Valor en texto. Se ignora si se pasa `children`. */
  valor?: string
  /**
   * IP, serial, placa, MAC, puerto o clave: se rige por M-R5
   * (monoespaciado, tabular y siempre en su propia línea).
   */
  tecnico?: boolean
  /** Contenido propio del valor: un enlace vivo, una pastilla, un icono. */
  children?: ReactNode
  /** Texto a copiar. Sin él no se dibuja el botón de copiar. */
  copiable?: string
}

export function FilaDato({ etiqueta, valor, tecnico = false, children, copiable }: Props) {
  const contenido = children ?? <span className="min-w-0 flex-1 text-[13.5px] text-noct-text">{valor}</span>

  // El dato técnico se apila siempre; el corriente, solo por debajo de
  // 380 px de contenedor (M-R13). En los dos casos la etiqueta nunca
  // pasa de 96 px cuando sí comparte renglón.
  if (tecnico) {
    return (
      <div className="flex items-start gap-2.5 py-2">
        <span className="min-w-0 flex-1">
          <span className={`block ${ETIQUETA}`}>{etiqueta}</span>
          <span className={`mt-px block break-all ${VALOR_TECNICO}`}>{valor}</span>
        </span>
        {copiable && <BotonCopiar etiqueta={etiqueta} texto={copiable} destacado />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 py-2 @[380px]:min-h-[48px] @[380px]:flex-row @[380px]:items-center @[380px]:gap-2.5 @[380px]:py-1.5">
      <span className={`shrink-0 @[380px]:w-24 ${ETIQUETA}`}>{etiqueta}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {contenido}
        {copiable && <BotonCopiar etiqueta={etiqueta} texto={copiable} />}
      </span>
    </div>
  )
}

// Copiar con confirmación breve. El objetivo mide 44 px de alto en las
// dos variantes (M-R14): la del dato técnico además lleva fondo propio,
// porque ahí copiar es la acción que se viene a hacer.
function BotonCopiar({
  etiqueta,
  texto,
  destacado = false,
}: {
  etiqueta: string
  texto: string
  destacado?: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (await copiarAlPortapapeles(texto)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1400)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      aria-label={copiado ? 'Copiado' : `Copiar ${etiqueta.toLowerCase()}`}
      className={`flex h-11 shrink-0 items-center justify-center rounded-lg ${
        destacado
          ? 'w-11 bg-noct-text/[.06] text-noct-neutral-300 hover:bg-noct-text/[.11]'
          : 'w-9 text-noct-neutral-400 hover:bg-noct-text/[.05]'
      }`}
    >
      {copiado ? (
        <Check size={destacado ? 17 : 16} className="text-noct-exito" aria-hidden />
      ) : (
        <Copy size={destacado ? 17 : 16} aria-hidden />
      )}
    </button>
  )
}
