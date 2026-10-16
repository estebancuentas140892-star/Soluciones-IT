import { useSyncExternalStore } from 'react'
import { obtenerEstadoSync, sincronizar, suscribirSync } from '../lib/sync'
import { CloudSlash, WarningCircle } from './iconos'
import { useEnLinea } from './useEnLinea'

// LOS ESTADOS DEL SISTEMA EN EL TELÉFONO (tarea 342, "Estados" del sistema
// visual móvil "1b Pulgar"). Solo presentación sobre lo que la app ya sabe:
// si hay red (`navigator.onLine`) y lo que dice la sincronización
// (`obtenerEstadoSync`). Ninguna lógica nueva de conexión ni de subida.
//
//   - Sin conexión: una franja de 38 bajo la barra de estado, en precaución.
//     No bloquea nada: todo sigue funcionando con la copia local.
//   - Error de sincronización: la misma franja, en error, con cuántos cambios
//     no se subieron y "Reintentar", que es la sincronización de siempre (la
//     misma que "Reintentar ahora" del panel de sincronización).
//   - Sincronizando: una línea de 2 px arriba, que complementa a la pastilla
//     de la cabecera ("Subiendo") sin repetir su texto.
//
// Solo por debajo de 768 px: desde 768 la pastilla de la barra lo dice y la
// composición aprobada en la 339 no cambia.

/** La franja de 38 px bajo la barra de estado: sin conexión o error al subir. Nada si todo va bien. */
export function FranjaEstadoSistema() {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const enLinea = useEnLinea()

  if (!enLinea) {
    return (
      <div
        role="status"
        data-franja-sistema="sin-conexion"
        className="flex min-h-[38px] items-center gap-2 bg-noct-precaucion/(--tinte-estado) px-3.5 py-1 text-[13px] font-medium leading-[1.3] text-noct-text md:hidden"
      >
        <CloudSlash size={16} className="shrink-0 text-noct-precaucion" aria-hidden />
        <span className="min-w-0 flex-1">
          Sin conexión. <span className="font-normal text-noct-neutral-300">Trabajas con la copia local</span>
        </span>
      </div>
    )
  }

  if (estado.cambiosConError > 0) {
    const n = estado.cambiosConError
    return (
      // `status` y no `alert`: la franja vuelve a montarse en cada pantalla
      // mientras dure el error, y un `alert` lo anunciaría cada vez.
      <div
        role="status"
        data-franja-sistema="error"
        className="flex min-h-[38px] items-center gap-2 bg-noct-error/(--tinte-estado) py-1 pl-3.5 pr-2 text-[13px] font-medium leading-[1.3] text-noct-text md:hidden"
      >
        <WarningCircle size={16} className="shrink-0 text-noct-error" aria-hidden />
        <span className="min-w-0 flex-1">{n === 1 ? '1 cambio no se subió' : `${n} cambios no se subieron`}</span>
        {/* La misma sincronización que "Reintentar ahora" del panel. Mientras
            corre no se pide otra: la línea de arriba ya dice que está en ello. */}
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={estado.enCurso}
          className="toque-amplio relative min-h-[34px] shrink-0 rounded-[9px] border-[1.5px] border-current px-3 text-[14px] font-semibold text-noct-error disabled:opacity-60"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return null
}

/**
 * La línea de 2 px mientras se sincroniza, pegada arriba de la ventana. Un
 * tramo del acento recorre su carril; con "reducir movimiento" el carril se
 * queda lleno y quieto.
 */
export function LineaSincronizacion() {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const enLinea = useEnLinea()
  if (!estado.enCurso || !enLinea) return null
  return (
    <div
      aria-hidden
      data-linea-sincronizacion
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[70] h-[2px] overflow-hidden bg-noct-accent/[.14] md:hidden"
    >
      <div className="h-full w-full bg-noct-accent/60 motion-safe:w-2/5 motion-safe:animate-[avance_1.1s_ease-in-out_infinite] motion-safe:bg-noct-accent" />
    </div>
  )
}
