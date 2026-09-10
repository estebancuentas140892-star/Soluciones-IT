import { useRef, useState } from 'react'
import { BookBookmark } from '../../components/iconos'
import type { Referencia } from '../../lib/db'
import { HojaReferencia } from './HojaReferencia'

// LA ETIQUETA DISCRETA DE UN TERMINO DENTRO DE UNA TAREA.
//
// Discreta es el requisito, y aqui significa tres cosas: no compite con
// la instruccion (que se lee a 30 px), no ocupa una fila propia y no
// parece un boton de accion. Es una pastilla de borde fino con el
// nombre del termino, y solo eso.
//
// NO SE SUBRAYAN LAS PALABRAS DE LA INSTRUCCION. Convertir en enlace
// cada palabra tecnica que aparezca en el texto seria adivinar: el
// mismo termino puede estar escrito de otra forma, y el subrayado
// automatico llenaria de enlaces una pantalla que se lee a un brazo de
// distancia. El vinculo lo pone el autor, una vez, y aparece aqui.
//
// EL FOCO VUELVE AL CHIP AL CERRAR. Sin esto, quien navega con teclado
// o con lector de pantalla vuelve al principio del documento despues de
// leer una definicion, y pierde el sitio de la tarea. Es la mitad del
// requisito "al cerrar, devuelve el foco y la posicion a la tarea"; la
// otra mitad la cumple `Modal`, que bloquea el scroll del fondo
// mientras esta abierto y lo restaura al cerrarse.

export function ChipReferencia({
  referenciaId,
  tituloRespaldo,
  referencias,
}: {
  referenciaId: string
  tituloRespaldo: string
  referencias: Map<string, Referencia>
}) {
  const [abierta, setAbierta] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)

  const referencia = referencias.get(referenciaId)
  const disponible = referencia !== undefined
  const titulo = referencia?.titulo || tituloRespaldo || 'Referencia'

  function cerrar() {
    setAbierta(false)
    boton.current?.focus()
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        aria-label={
          disponible
            ? `Ver qué significa ${titulo}`
            : `${titulo}: esta referencia no está disponible en este dispositivo`
        }
        className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium ${
          disponible
            ? 'border-noct-divider bg-noct-surface text-noct-neutral-200 hover:border-noct-accent/60 hover:text-noct-text'
            : 'border-dashed border-noct-neutral-700 text-noct-neutral-500'
        }`}
      >
        <BookBookmark size={13} className="shrink-0 text-noct-accent-300" aria-hidden />
        <span className="min-w-0 truncate">{titulo}</span>
        {!disponible && <span className="shrink-0 text-[11px]">no disponible</span>}
      </button>

      <HojaReferencia
        abierto={abierta}
        onCerrar={cerrar}
        referenciaId={referenciaId}
        tituloRespaldo={tituloRespaldo}
        referencias={referencias}
      />
    </>
  )
}
