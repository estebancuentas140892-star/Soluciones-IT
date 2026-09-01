import { Modal } from '../../components/Modal'
import { Play } from '../../components/iconos'

// Confirmación de "Probar" (handoff "Diseño móvil", tablero 6b).
//
// El hueco que cierra: el autor NUNCA veía lo que va a ver el técnico
// mientras escribe. La vista previa existía, pero era un modo aparte que
// abría el artículo entero desde el principio, así que comprobar el paso
// que se acaba de escribir obligaba a recorrerlo todo. "Probar" abre esa
// misma vista previa ya puesta en el paso activo.
//
// Por qué un paso intermedio y no abrir directo: la vista previa tapa la
// pantalla completa y el editor tiene cambios sin guardar. Una frase que
// diga "no sales del editor y no se guarda nada" antes de que todo
// desaparezca evita el susto de creer que se perdió el trabajo.

interface Props {
  abierto: boolean
  numeroPaso: number
  onCerrar: () => void
  onVerComoTecnico: () => void
}

const ID_TITULO = 'dialogo-probar-paso-titulo'

export function DialogoProbarPaso({ abierto, numeroPaso, onCerrar, onVerComoTecnico }: Props) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <h2 id={ID_TITULO} className="text-[17px] font-medium leading-tight text-noct-text">
        Probar el paso {numeroPaso}
      </h2>
      <p className="mt-2 text-sm leading-snug text-noct-neutral-300">
        Lo ves exactamente como lo verá el técnico en campo, sin salir del editor y sin guardar.
      </p>
      <button
        type="button"
        onClick={onVerComoTecnico}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-noct-accent bg-noct-accent/[.14] text-base font-semibold text-noct-accent-300 hover:bg-noct-accent/[.24]"
      >
        <Play size={18} aria-hidden />
        Ver como técnico
      </button>
      <button
        type="button"
        onClick={onCerrar}
        className="mt-2 flex min-h-12 w-full items-center justify-center rounded-[11px] text-[15px] font-medium text-noct-neutral-400 hover:bg-noct-text/[.08] hover:text-noct-text"
      >
        Cancelar
      </button>
    </Modal>
  )
}
