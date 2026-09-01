// UN solo indicador de avance para toda la app, en tres variantes.
// Nace de la auditoría de Soluciones (decisión P4-3): hoy el mismo dato
// "vas por X de Y pasos" se dibuja de tres maneras que además no
// coinciden entre sí:
//
//   - `AvanceArticulo` (CategoriaPage): pastilla "X/Y" con borde ámbar,
//     que SOLO aparece si hay avance, así que la columna derecha de la
//     lista baila de fila en fila.
//   - `ContadorSubProgreso` (ProcedimientoVista): rectángulo relleno sin
//     borde para el mismo dato.
//   - la barra pegajosa de progreso de la ficha y del asistente.
//
// Las tres se reemplazan por este componente. Queda registrado como
// candidato CAND-7 en COMPONENTES_UI.md (la auditoría lo atribuyó por
// error a CAND-3, que es "copiar con confirmación" y no tiene relación).
//
// El anillo es la variante de fila porque su ancho NO cambia con el
// valor: con 1 de 6 y con 5 de 6 ocupa lo mismo, así que las filas de
// una lista siguen alineadas. La barra es la variante de bloque (cuando
// hay ancho que gastar) y el texto la de lectura precisa.

// La variante `segmentos` la estrena la ficha de artículo (tarea 172,
// mockup `1f`): un segmento por paso junto al título de la sección, en
// vez de una barra pegajosa aparte. Dice dos cosas que la barra continua
// no dice: cuántos pasos hay en total y cuál es el que sigue.
export type VarianteAvance = 'anillo' | 'barra' | 'texto' | 'segmentos'

interface Props {
  hechos: number
  total: number
  variante?: VarianteAvance
  // Tamaño del anillo en px (ignorado por las otras variantes).
  size?: number
  // Solo `segmentos` (tarea 210): los segmentos se reparten TODO el
  // ancho disponible en vez de medir 14 px fijos. Es lo que pide una
  // banda a pantalla completa, donde siete segmentos cortos alineados a
  // la izquierda se leen como un fragmento de barra rota.
  expandido?: boolean
  // Solo `segmentos` (tarea 210): índice del paso que se está haciendo,
  // que se pinta a medias. Sin esto el "cuál sigue" se deduce del primer
  // segmento vacío, y eso deja de ser cierto en cuanto hay pasos
  // saltados: el técnico puede estar en el 5 con el 3 sin hacer.
  actual?: number | null
  className?: string
}

// Al completarse, el avance pasa de acento a verde: es el único momento
// en que el color cambia de significado, y es el que el técnico busca.
// Se decide una vez aquí para que las tres variantes coincidan.
function clasesDeAvance(completo: boolean) {
  return completo
    ? { trazo: 'text-noct-exito', relleno: 'bg-noct-exito', texto: 'text-noct-exito' }
    : { trazo: 'text-noct-accent', relleno: 'bg-noct-accent', texto: 'text-noct-neutral-300' }
}

export function IndicadorAvance({
  hechos,
  total,
  variante = 'anillo',
  size = 26,
  expandido = false,
  actual = null,
  className = '',
}: Props) {
  // Se normaliza contra el total porque el procedimiento pudo editarse
  // después de marcar avance: `contarHechos` ya cruza contra los ids
  // vigentes, pero un total 0 (artículo sin pasos) llegaría igual y
  // dividir por él daría NaN en el anillo.
  const totalSeguro = Math.max(0, total)
  const hechosSeguro = Math.min(Math.max(0, hechos), totalSeguro)
  const fraccion = totalSeguro === 0 ? 0 : hechosSeguro / totalSeguro
  const completo = totalSeguro > 0 && hechosSeguro === totalSeguro
  const clases = clasesDeAvance(completo)
  const etiqueta = `${hechosSeguro} de ${totalSeguro} pasos`

  if (variante === 'texto') {
    return (
      <span className={`text-[11.5px] ${clases.texto} ${className}`}>
        {hechosSeguro} de {totalSeguro} pasos
      </span>
    )
  }

  if (variante === 'segmentos') {
    // Con muchos pasos los segmentos se estrecharían hasta no leerse, así
    // que por encima de 12 se cae a la barra continua: el dato importa
    // más que la forma.
    if (totalSeguro > 12 || totalSeguro === 0) {
      return (
        <IndicadorAvance hechos={hechosSeguro} total={totalSeguro} variante="barra" className={className} />
      )
    }
    return (
      <span
        role="progressbar"
        aria-valuenow={hechosSeguro}
        aria-valuemin={0}
        aria-valuemax={totalSeguro}
        aria-label={etiqueta}
        className={`flex items-center gap-[3px] ${className}`}
      >
        {Array.from({ length: totalSeguro }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`${expandido ? 'h-1 flex-1' : 'h-[3px] w-[14px]'} rounded-full ${
              i < hechosSeguro
                ? clases.relleno
                : i === actual
                  ? `${clases.relleno} opacity-50`
                  : 'bg-noct-neutral-800'
            }`}
          />
        ))}
      </span>
    )
  }

  if (variante === 'barra') {
    return (
      <span
        role="progressbar"
        aria-valuenow={hechosSeguro}
        aria-valuemin={0}
        aria-valuemax={totalSeguro}
        aria-label={etiqueta}
        className={`block h-[3px] overflow-hidden rounded-full bg-noct-neutral-900 ${className}`}
      >
        <span
          className={`block h-full rounded-full ${clases.relleno}`}
          style={{ width: `${fraccion * 100}%` }}
        />
      </span>
    )
  }

  // Anillo. El radio se calcula desde el tamaño para que el trazo no se
  // recorte en los bordes del viewBox, y el círculo se gira -90° para
  // que el avance empiece arriba en vez de a las tres en punto.
  const trazo = 3
  const radio = (size - trazo) / 2
  const perimetro = 2 * Math.PI * radio
  return (
    <span
      role="progressbar"
      aria-valuenow={hechosSeguro}
      aria-valuemin={0}
      aria-valuemax={totalSeguro}
      aria-label={etiqueta}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radio}
          fill="none"
          strokeWidth={trazo}
          className="text-noct-neutral-800"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radio}
          fill="none"
          strokeWidth={trazo}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro * (1 - fraccion)}
          className={clases.trazo}
          stroke="currentColor"
        />
      </svg>
    </span>
  )
}
