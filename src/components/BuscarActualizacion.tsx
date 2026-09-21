import { useState, useSyncExternalStore } from 'react'
import {
  comprobarActualizacion,
  estadoActualizacion,
  suscribirActualizacion,
  type FaseActualizacion,
} from '../lib/actualizacionApp'
import { versionApp } from '../lib/versionApp'
import { ArrowsClockwise, CheckCircle, WarningCircle } from './iconos'

// "BUSCAR ACTUALIZACIÓN", A MANO (encargo del 2026-09-20, puntos 3 y 4).
//
// La comprobación automática ya no espera una hora, pero sigue haciendo
// falta poder preguntar cuando uno quiere: el técnico acaba de oír "ya
// está desplegado" y necesita saber, ahí mismo, si su teléfono lo tiene.
// Y necesita poder DECIR qué versión lleva, que es lo que convierte
// "creo que no me actualizó" en un dato.
//
// La acción no espera al freno de un minuto: si se pide, se hace. Y no
// se queda en silencio nunca: o dice que está al día, o aparece el aviso
// "Versión nueva disponible" con su botón "Actualizar" (que es quien
// recarga, y solo si lo tocan).

const TEXTO_FASE: Record<FaseActualizacion, string> = {
  inactivo: 'Comprueba si hay una versión nueva',
  buscando: 'Buscando actualización…',
  'al-dia': 'Ya tienes la versión más reciente',
  disponible: 'Hay una versión nueva: toca "Actualizar" en el aviso',
  'sin-conexion': 'Sin conexión. Inténtalo cuando recuperes Internet',
  'sin-servicio': 'Este navegador no guarda la app para trabajar sin señal',
}

export function BuscarActualizacion() {
  const estado = useSyncExternalStore(suscribirActualizacion, estadoActualizacion, estadoActualizacion)
  // Solo se enseña el resultado cuando lo pidió el técnico: al entrar en
  // Más no tiene por qué leer el resultado de una comprobación de fondo.
  const [pedido, setPedido] = useState(false)
  const buscando = pedido && estado.fase === 'buscando'
  const fase: FaseActualizacion = pedido ? estado.fase : 'inactivo'
  const version = versionApp()

  async function buscar() {
    setPedido(true)
    await comprobarActualizacion(true)
  }

  const Icono =
    fase === 'al-dia' ? CheckCircle : fase === 'disponible' || fase === 'sin-servicio' ? WarningCircle : ArrowsClockwise
  const tono =
    fase === 'al-dia'
      ? 'text-noct-exito'
      : fase === 'disponible'
        ? 'text-noct-precaucion'
        : 'text-noct-neutral-400'

  return (
    <button
      type="button"
      onClick={() => void buscar()}
      disabled={buscando}
      className="flex min-h-[58px] w-full items-center gap-[13px] rounded-md px-2 py-[11px] text-left text-noct-text hover:bg-noct-text/[.05] disabled:opacity-70"
    >
      <Icono size={19} className={`shrink-0 ${tono}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-[1.3]">Buscar actualización</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-noct-neutral-400">
          {TEXTO_FASE[fase]}
        </span>
      </span>
      {/* La versión instalada, siempre a la vista: es lo que se compara
          contra el commit desplegado cuando algo no cuadra. */}
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-noct-neutral-500">{version}</span>
    </button>
  )
}
