// Aviso en una pestaña de la barra inferior (tarea 187, mockup `4e`,
// regla R23: un aviso solo si hay un dato detrás, ningún punto
// decorativo). Dos variantes: `punto` (hay un procedimiento a medias
// descartado de `BarraReanudar`) y `numero` (Inicio, los asuntos
// URGENTES de la agenda: lo vencido y lo de hoy, nada más). Quien la
// usa decide cuándo mostrarla; este componente solo dibuja, y con cero
// no dibuja nada.

interface PropsPunto {
  variante: 'punto'
}

interface PropsNumero {
  variante: 'numero'
  valor: number
}

export function AvisoPestana(props: PropsPunto | PropsNumero) {
  if (props.variante === 'punto') {
    return (
      <span
        className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-noct-accent ring-2 ring-noct-bg"
        aria-hidden
      />
    )
  }

  if (props.valor <= 0) return null
  return (
    <span
      // En el teléfono, la pastilla de 18 px del handoff con su número a 12
      // (tarea 341); desde 768, la de siempre.
      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-noct-precaucion px-1 text-[10px] max-md:text-[12px] font-semibold text-noct-bg ring-2 ring-noct-bg max-md:h-[18px] max-md:min-w-[18px]"
      aria-hidden
    >
      {props.valor > 9 ? '9+' : props.valor}
    </span>
  )
}
