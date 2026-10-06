import { Boton } from '../../components/Boton'
import { Hoja } from '../../components/Hoja'
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

export function DialogoProbarPaso({ abierto, numeroPaso, onCerrar, onVerComoTecnico }: Props) {
  return (
    // Una sola salida además de la acción: la × de la hoja (P4).
    <Hoja
      abierta={abierto}
      onCerrar={onCerrar}
      titulo={`Probar el paso ${numeroPaso}`}
      descripcion="Lo ves exactamente como lo verá el técnico en campo, sin salir del editor y sin guardar."
      pie={
        <Boton
          papel="principal"
          tamano={52}
          anchoCompleto
          icono={<Play size={18} aria-hidden />}
          onClick={onVerComoTecnico}
        >
          Ver como técnico
        </Boton>
      }
    />
  )
}
