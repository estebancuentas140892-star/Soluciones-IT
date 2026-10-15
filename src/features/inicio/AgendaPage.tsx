import { useMemo } from 'react'
import { Chasis } from '../../app/Chasis'
import { ANCHO_AMPLIO, ANCHO_TABLETA_HORIZONTAL, useEsAncho } from '../../components/useEsAncho'
import { ActividadDelEquipo } from '../historial/ActividadDelEquipo'
import { agruparAgenda, fechaDeHoy } from './agenda'
import { ContadoresAgenda, SeccionesAgenda } from './SeccionesAgenda'
import { usePendientes } from './usePendientes'

// LA AGENDA COMPLETA, EN SU PROPIA PANTALLA.
//
// Desde el 2026-09-20 el resumen de la agenda vuelve a estar en Inicio
// (encargo de ese día, tarea 1), pero esta pantalla se conserva entera:
// es a donde lleva "Ver la agenda completa" de Resolver, y es donde la
// agenda se lee sin el buscador delante. Desde la tarea 265 es su única
// puerta: Más ya no tiene fila de Agenda, y sin nada con fecha Resolver
// deja una línea que la abre si guarda algo más.
//
// No hay dos implementaciones: los grupos, las filas, los desplegables y
// el estado "Todo al día por hoy" los dibuja `SeccionesAgenda`, y los
// contadores, `ContadoresAgenda`, los mismos de "Necesita atención" en
// Resolver. Aquí solo queda el chasis.
//
// REDISEÑO MÓVIL "1b PULGAR" (tarea 332): contadores arriba, los grupos
// con fecha (Vencidos, Para hoy, Próximos) y al final la fila plegada
// "Sin fecha" con En curso y Por revisar del equipo.
export function AgendaPage() {
  // Los mismos pendientes que cuenta el chasis para el número de la
  // pestaña, repartidos por FECHA en los cinco grupos (agenda.ts). Cada
  // ítem cae en uno solo, así que nada se cuenta ni se pinta dos veces.
  const { items: pendientes, cargando } = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])
  const hoyTexto = useMemo(() => fechaDeHoy(), [])
  // POR ANCHO (tarea 339, T7): desde 1024 lo que tiene fecha a la izquierda
  // y "Sin fecha", abierto, con la actividad del equipo en su columna. Cambia
  // la estructura (un pliegue o una columna), así que se decide aquí.
  const enColumnas = useEsAncho(ANCHO_TABLETA_HORIZONTAL)
  // Desde 1680, tres columnas de lectura (T10): lo que urge, lo que viene
  // (todos los próximos) y lo que no vence.
  const enTres = useEsAncho(ANCHO_AMPLIO)
  const disposicion = enTres ? 'tres' : enColumnas ? 'dos' : 'columna'

  return (
    // Nivel documento: se consulta y se vuelve. Sube a Resolver (padreDe).
    <Chasis modo="documento" titulo="Agenda" contexto={hoyTexto}>
      <main className="flex-1 px-4 pb-16 pt-3.5">
        <div className="flex flex-col gap-[22px]">
          {/* El día ya está en la cabecera del chasis (`contexto`). Arriba,
              los tres contadores (tarea 332), sin enlace: ya se está en la
              Agenda. Mientras carga no se cuenta nada. */}
          {!cargando && (
            <div className={enColumnas ? 'max-w-[600px]' : undefined}>
              <ContadoresAgenda agenda={agenda} />
            </div>
          )}
          <SeccionesAgenda
            agenda={agenda}
            cargando={cargando}
            disposicion={disposicion}
            complemento={enColumnas ? <ActividadDelEquipo /> : undefined}
          />
          {/* Lo que pasa en el equipo, al final y plegado (tarea 257):
              no es un pendiente, así que va después de todos ellos. Solo
              aquí y no en el resumen de Resolver, que responde otra
              pregunta. Si no hay actividad, no se monta. */}
          {!enColumnas && <ActividadDelEquipo />}
        </div>
      </main>
    </Chasis>
  )
}
