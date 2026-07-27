import { useSyncExternalStore } from 'react'
import { obtenerEstadoSync, suscribirSync } from '../lib/sync'
import { tiempoRelativo } from '../lib/tiempoRelativo'
import { CloudArrowUp, CloudCheck, CloudSlash } from './iconos'

// "46 artículos al día · hace 4 min", bajo el título de una pantalla de
// lista. Regla R7 de la auditoría de Soluciones: toda lista dice qué tan
// al día está el dato y si hay cambios sin subir.
//
// El problema que cierra: la señal de sincronización solo existía en
// Inicio. En cualquier otra pantalla el técnico no sabía si estaba
// viendo la copia local de ayer o lo que el equipo acaba de escribir, y
// esa duda es peor en campo, donde la conexión va y viene.
//
// Es de solo lectura y no abre nada: el panel de sincronización
// (PanelSync) sigue siendo el sitio donde se actúa. Aquí solo se
// informa, para no poner un control más en una cabecera que la auditoría
// pedía adelgazar.
export function PastillaFrescura({
  total,
  singular,
  plural,
  className = '',
}: {
  // Cuántos elementos se están mostrando, ya contados por la pantalla.
  total: number
  // Sustantivo del elemento contado ("artículo" / "artículos"): la
  // pastilla sirve a cualquier lista, así que el nombre lo pone quien la
  // usa en vez de asumir "artículos".
  singular: string
  plural: string
  className?: string
}) {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const sustantivo = total === 1 ? singular : plural
  const base = `inline-flex items-center gap-[5px] text-[11.5px] ${className}`

  // Prioridad de los tres mensajes: lo que el técnico necesita saber
  // primero es si algo SUYO todavía no salió del teléfono (puede perderse
  // si desinstala o cambia de equipo), después si la app no está
  // sincronizando, y solo al final la antigüedad del dato.
  if (estado.cambiosPendientes > 0) {
    const cambios = estado.cambiosPendientes
    return (
      <p className={`${base} text-noct-precaucion`}>
        <CloudArrowUp size={13} aria-hidden />
        {cambios} {cambios === 1 ? 'cambio' : 'cambios'} sin subir
      </p>
    )
  }

  const desde = tiempoRelativo(estado.ultimaSync)
  if (!desde) {
    return (
      <p className={`${base} text-noct-neutral-400`}>
        <CloudSlash size={13} className="text-noct-neutral-400" aria-hidden />
        {total} {sustantivo} · sin sincronizar aún
      </p>
    )
  }

  return (
    <p className={`${base} text-noct-neutral-400`}>
      <CloudCheck size={13} className="text-noct-exito" aria-hidden />
      {total} {sustantivo} al día · {desde}
    </p>
  )
}
