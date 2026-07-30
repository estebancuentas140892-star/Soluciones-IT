// Aviso en una pestaña de la barra inferior (tarea 187, mockup `4e`,
// regla R23: un aviso solo si hay un dato detrás, ningún punto
// decorativo). Dos variantes: `punto` (Guías, hay un procedimiento a
// medias descartado de `BarraReanudar`) y `numero` (Más, cuenta real de
// `usePendientes`). Quien la usa decide cuándo mostrarla; este
// componente solo dibuja.

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
      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-noct-precaucion px-1 text-[10px] font-semibold text-noct-bg ring-2 ring-noct-bg"
      aria-hidden
    >
      {props.valor > 9 ? '9+' : props.valor}
    </span>
  )
}
