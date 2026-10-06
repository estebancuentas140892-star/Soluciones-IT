import type { ReactNode } from 'react'
import { Boton } from './Boton'
import { Hoja } from './Hoja'

// CONFIRMAR LO QUE NO SE DESHACE (tarea 291, auditoría UX de Claude
// Design, sección 7, F2 y F9; regla "Qué se usa para qué": diálogo para
// lo irreversible o un único dato crítico).
//
// Es la hoja estándar (`Hoja`) con las acciones en su sitio:
//
// - **Teléfono:** la acción a todo el ancho, con su nombre completo
//   ("Eliminar el equipo", 52 px, delineada en rojo si destruye) y
//   "Cancelar" debajo (44 px, sin borde). Antes eran dos botones de unos
//   30 px juntos en la esquina, y "Eliminar" no decía qué eliminaba.
// - **Escritorio:** centrado a 440 px, las dos a la derecha a 44 px, con
//   "Cancelar" a la izquierda de la acción.
//
// Es la única pantalla con dos salidas (la × y "Cancelar"): P4 deja una
// sola salida por pantalla salvo en las confirmaciones destructivas, donde
// "Cancelar" es la otra respuesta a una decisión peligrosa.

export interface AccionDialogo {
  // El nombre completo de la consecuencia, nunca "OK" ni "Aceptar".
  texto: string
  // `destructivo` (por defecto) para lo que destruye; `principal` para un
  // dato crítico que no destruye nada.
  papel?: 'principal' | 'destructivo'
  onConfirmar: () => void
  cargando?: boolean
  // "Eliminando…", "Comprobando…": se lee dentro del botón mientras dura.
  textoCargando?: string
  // Solo con la razón a la vista (un campo vacío que se ve, T4).
  deshabilitado?: boolean
}

export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  accion,
  textoCancelar = 'Cancelar',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: ReactNode
  descripcion?: ReactNode
  children?: ReactNode
  // Sin acción, el diálogo solo informa (no se puede seguir y dice por
  // qué) y su única salida dice "Cerrar".
  accion?: AccionDialogo
  textoCancelar?: string
}) {
  return (
    <Hoja
      abierta={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={descripcion}
      claseCuerpo="flex flex-col gap-3"
      pie={
        // En el DOM, primero la acción: en una columna queda arriba y en
        // la fila invertida del escritorio queda a la derecha.
        <div className="flex flex-col gap-1.5 md:flex-row-reverse md:justify-start md:gap-2">
          {accion && (
            <Boton
              papel={accion.papel ?? 'destructivo'}
              tamano={52}
              anchoCompleto
              className="md:w-auto"
              onClick={accion.onConfirmar}
              disabled={accion.deshabilitado}
              cargando={accion.cargando}
              textoCargando={accion.textoCargando}
            >
              {accion.texto}
            </Boton>
          )}
          <Boton papel="texto" tono="descarte" anchoCompleto className="md:w-auto" onClick={onCerrar}>
            {accion ? textoCancelar : 'Cerrar'}
          </Boton>
        </div>
      }
    >
      {children}
    </Hoja>
  )
}
