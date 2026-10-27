import { useMemo } from 'react'
import { Chasis } from '../../app/Chasis'
import { Plus } from '../../components/iconos'
import { BTN_DELINEADO_CABECERA, PEGADA_SOBRE_PESTANAS } from '../../components/nocturne'
import { huecoAvisoActualizacion } from '../../components/ranuraAvisoActualizacion'
import { ANCHO_AMPLIO, ANCHO_TABLETA_HORIZONTAL, useEsAncho } from '../../components/useEsAncho'
import { ActividadDelEquipo } from '../historial/ActividadDelEquipo'
import { agruparAgenda, fechaDeHoy } from './agenda'
import { useHojaTarea } from './contextoHojaTarea'
import { ProveedorHojaTarea } from './HojaTarea'
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
// contadores, `ContadoresAgenda`, los mismos de «Tu trabajo de hoy» en
// Resolver. Aquí solo queda el chasis.
//
// REDISEÑO MÓVIL "1b PULGAR" (tarea 332): contadores arriba y los grupos
// con fecha (Vencidos, Para hoy, Próximos). Desde la tarea 365 (D5 y D7 de
// la auditoría del 2026-10-27): las tareas sin fecha debajo, lo del equipo y
// las guías en preparación plegados al final, y «Nueva tarea»: en el
// teléfono fija abajo, al pulgar; desde 768 px, en la cabecera.
export function AgendaPage() {
  return (
    <ProveedorHojaTarea contexto="Agenda">
      <ContenidoAgenda />
    </ProveedorHojaTarea>
  )
}

function ContenidoAgenda() {
  // Los mismos pendientes que cuenta el chasis para el número de la
  // pestaña, repartidos por FECHA en los grupos (agenda.ts). Cada ítem cae
  // en uno solo, así que nada se cuenta ni se pinta dos veces.
  const { items: pendientes, cargando } = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])
  const hoyTexto = useMemo(() => fechaDeHoy(), [])
  const hoja = useHojaTarea()
  const ancho = useEsAncho()
  // POR ANCHO (tarea 339, T7): desde 1024 lo que tiene fecha a la izquierda
  // y lo que no vence, abierto, con la actividad del equipo en su columna.
  // Cambia la estructura (un pliegue o una columna), así que se decide aquí.
  const enColumnas = useEsAncho(ANCHO_TABLETA_HORIZONTAL)
  // Desde 1680, tres columnas de lectura (T10): lo que urge, lo que viene
  // (todos los próximos y las tareas sin fecha) y lo que no vence.
  const enTres = useEsAncho(ANCHO_AMPLIO)
  const disposicion = enTres ? 'tres' : enColumnas ? 'dos' : 'columna'

  return (
    // Nivel documento: se consulta y se vuelve. Sube a Resolver (padreDe).
    <Chasis
      modo="documento"
      titulo="Agenda"
      contexto={hoyTexto}
      // «NUEVA TAREA», DELINEADA EN LA CABECERA DESDE 768 PX (tarea 365): no
      // hace avanzar nada, así que la pantalla no tiene acción rellena.
      accionPrincipal={
        <button type="button" onClick={() => hoja?.nueva()} aria-haspopup="dialog" className={BTN_DELINEADO_CABECERA}>
          <Plus size={16} aria-hidden />
          Nueva tarea
        </button>
      }
    >
      <main className="flex flex-1 flex-col px-4 pb-6 pt-3.5 md:pb-16">
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
        {/* EN EL TELÉFONO, «NUEVA TAREA» FIJA ABAJO, AL PULGAR (tarea 365, el
            prototipo): delineada en el acento con su relieve, sobre el pie
            con su sombra. El aviso («Tarea guardada», «Deshacer») sale
            encima. */}
        {!ancho && (
          <div
            className={`sticky ${PEGADA_SOBRE_PESTANAS} z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg px-4 pb-3 pt-2.5 shadow-[var(--shadow-noct-pie)]`}
          >
            <div ref={huecoAvisoActualizacion} className="mb-2 empty:hidden" />
            <button
              type="button"
              onClick={() => hoja?.nueva()}
              aria-haspopup="dialog"
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-noct-accent bg-noct-surface text-[16px] font-extrabold text-noct-accent-300 shadow-[0_3px_0_var(--color-noct-accent-borde)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-noct-accent-borde)]"
            >
              <Plus size={18} aria-hidden />
              Nueva tarea
            </button>
          </div>
        )}
      </main>
    </Chasis>
  )
}
