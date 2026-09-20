import { useMemo } from 'react'
import { Chasis } from '../../app/Chasis'
import { agruparAgenda, fechaDeHoy } from './agenda'
import { ResumenDelDia, SeccionesAgenda } from './SeccionesAgenda'
import { usePendientes } from './usePendientes'

// LA AGENDA COMPLETA, EN SU PROPIA PANTALLA.
//
// Desde el 2026-09-20 el resumen de la agenda vuelve a estar en Inicio
// (encargo de ese día, tarea 1), pero esta pantalla se conserva entera:
// es a donde lleva "Ver agenda completa" y la fila "Agenda" de Más, y es
// donde la agenda se lee sin el buscador delante.
//
// No hay dos implementaciones: los grupos, las filas, los desplegables y
// el estado "Todo al día por hoy" los dibuja `SeccionesAgenda`, que es el
// mismo componente que usa Inicio. Aquí solo queda el chasis.
export function AgendaPage() {
  // Los mismos pendientes que cuenta el chasis para el número de la
  // pestaña, repartidos por FECHA en los cinco grupos (agenda.ts). Cada
  // ítem cae en uno solo, así que nada se cuenta ni se pinta dos veces.
  const pendientes = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])
  const hoyTexto = useMemo(() => fechaDeHoy(), [])

  return (
    // Nivel documento: se consulta y se vuelve. Sube a Inicio (padreDe).
    <Chasis modo="documento" titulo="Agenda" contexto={hoyTexto}>
      <main className="flex-1 px-4 pb-16 pt-4">
        <div className="flex flex-col gap-[18px]">
          {/* El día ya está en la cabecera del chasis (`contexto`). */}
          <ResumenDelDia agenda={agenda} dia={null} />
          <SeccionesAgenda agenda={agenda} />
        </div>
      </main>
    </Chasis>
  )
}
