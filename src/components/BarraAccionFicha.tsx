import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowsClockwise, Play } from './iconos'
import { PEGADA_SOBRE_PESTANAS } from './nocturne'

// Barra inferior de UNA sola acción dominante (tarea 172, mockup `1f`).
//
// Nace de la auditoría de la ficha de artículo: "Ejecutar" y "Editar"
// pesaban lo mismo (Nocturne pide el primario delineado, así que eran dos
// botones de borde uno al lado del otro) y vivían arriba, en la zona menos
// alcanzable del pulgar, cuando "Ejecutar" es justo lo que se toca de pie
// frente al equipo. Además decía siempre "Ejecutar", incluso con 2 de 6
// pasos hechos, donde lo que se hace es *seguir*.
//
// La etiqueta dice qué va a pasar, y debajo la promesa de que el avance no
// se pierde. Reservar su alto es responsabilidad de quien la monta (el
// chasis reserva el de las pestañas, no el de esta barra: R22 cubre el
// chasis, no las barras de una pantalla).

// CADA BOTON HACE LO QUE DICE (encargo del 2026-09-09, tarea 5).
// "Empezar" y "Repetir guia" ESTRENAN ejecucion antes de entrar (ver
// `onIniciar`); "Continuar" conserva la abierta y entra sin tocar
// nada. Antes los tres eran el mismo enlace y la ejecucion retomaba lo
// que hubiera guardado, asi que "Empezar" continuaba y "Repetir"
// enseñaba la pantalla de completado.
export type EstadoAccion = 'empezar' | 'continuar' | 'repetir'

interface Props {
  to: string
  estado: EstadoAccion
  /**
   * Rotulo ya resuelto (`etiquetaAccionGuia`). Lo decide quien conoce
   * el avance, no esta barra: con las comprobaciones finales pendientes
   * no hay numero de paso que mostrar, y armar aqui la frase obligaria
   * a mantener una segunda definicion de lo que falta.
   */
  etiqueta: string
  /**
   * Prepara la ejecucion antes de navegar (`empezar` y `repetir`
   * estrenan una). Mientras corre, el control queda ocupado: navegar
   * antes de que termine dejaria a la ejecucion leyendo el avance viejo.
   */
  onIniciar?: () => Promise<void>
  /**
   * Borra el avance guardado de esta guía. Solo se ofrece en el estado
   * `seguir`, y ahí SIEMPRE (2026-09-09, sección 3 del encargo).
   *
   * Es la otra mitad de haber retirado "Sin terminar" de la lista: la
   * posición de lectura se conserva, pero deja de generar una lista
   * global de pendientes, así que las dos salidas ("continuar donde
   * estaba" y "empezar de nuevo") tienen que vivir DENTRO de la guía.
   * Antes "empezar de nuevo" existía solo dentro del menú "···" de la
   * cabecera, es decir en el sitio opuesto de la pantalla al de la
   * acción con la que compite.
   */
  onReiniciar?: () => void
}

export function BarraAccionFicha({ to, estado, etiqueta, onIniciar, onReiniciar }: Props) {
  const navegar = useNavigate()
  const [ocupado, setOcupado] = useState(false)

  const Icono = estado === 'repetir' ? ArrowsClockwise : Play
  const nota =
    estado === 'continuar'
      ? 'Tu avance se guarda en este teléfono'
      : estado === 'repetir'
        ? 'Empieza un caso nuevo desde el paso 1'
        : 'Un paso a la vez, sin distracciones'

  async function iniciarYEntrar() {
    if (ocupado) return
    setOcupado(true)
    try {
      await onIniciar?.()
      navegar(to)
    } finally {
      setOcupado(false)
    }
  }

  const claseAccion =
    'flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-4 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18] active:bg-noct-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent'

  return (
    <div
      className={`sticky ${PEGADA_SOBRE_PESTANAS} z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.92] px-4 pb-3 pt-2.5 backdrop-blur-[12px] lg:px-10`}
    >
      <div className="flex items-center gap-2">
        {onIniciar ? (
          <button type="button" disabled={ocupado} onClick={() => void iniciarYEntrar()} className={claseAccion}>
            <Icono size={17} className="shrink-0" aria-hidden />
            <span className="truncate">{etiqueta}</span>
          </button>
        ) : (
          <Link to={to} className={claseAccion}>
            <Icono size={17} className="shrink-0" aria-hidden />
            <span className="truncate">{etiqueta}</span>
          </Link>
        )}
        {estado === 'continuar' && onReiniciar && (
          <button
            type="button"
            onClick={onReiniciar}
            aria-label="Empezar de nuevo: borra el avance de esta guía"
            title="Empezar de nuevo"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
          >
            <ArrowsClockwise size={17} aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[11.5px] text-noct-neutral-500">
        {nota}
        {estado === 'continuar' && onReiniciar ? ' · el botón de al lado lo borra y empieza de cero' : ''}
      </p>
    </div>
  )
}
