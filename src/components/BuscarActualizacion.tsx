import { useState, useSyncExternalStore } from 'react'
import {
  comprobarActualizacion,
  estadoActualizacion,
  suscribirActualizacion,
  type EstadoWorker,
  type FaseActualizacion,
} from '../lib/actualizacionApp'
import { ArrowsClockwise, CheckCircle, WarningCircle } from './iconos'

// "BUSCAR ACTUALIZACIÓN", A MANO, Y EL DIAGNÓSTICO MÍNIMO (encargo del
// 2026-09-21, puntos 5 y 6).
//
// La acción hace el trabajo de verdad: pide `/version.json` a la red,
// llama a `registration.update()` y lee `waiting`, `installing` y
// `updatefound` (todo eso vive en `comprobarActualizacion`). No se limita
// a cambiar un texto ni a esperar que `needRefresh` se encienda solo.
//
// Y debajo, en letra pequeña, lo único que hace falta para resolver un
// "no me actualizó" por teléfono: qué versión tiene este aparato, cuál
// anuncia el servidor, en qué estado está el service worker y cuándo se
// comprobó por última vez. Nada más: esto es Más, no una consola.

const TEXTO_FASE: Record<FaseActualizacion, string> = {
  inactivo: 'Comprueba si hay una versión nueva',
  buscando: 'Buscando actualización…',
  'al-dia': 'Ya tienes la versión más reciente',
  disponible: 'Versión nueva disponible: toca "Actualizar" en el aviso',
  'sin-conexion': 'Sin conexión. Inténtalo cuando recuperes Internet',
  'sin-servicio': 'No se pudo comprobar: este navegador no guarda la app para trabajar sin señal',
}

const TEXTO_WORKER: Record<EstadoWorker, string> = {
  'sin-worker': 'sin instalar',
  activo: 'activo',
  instalando: 'instalando',
  esperando: 'esperando para entrar',
}

function textoFecha(ms: number): string {
  if (ms === 0) return 'sin comprobar'
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
}

export function BuscarActualizacion() {
  const estado = useSyncExternalStore(suscribirActualizacion, estadoActualizacion, estadoActualizacion)
  // Solo se enseña el resultado cuando lo pidió el técnico: al entrar en
  // Más no tiene por qué leer el resultado de una comprobación de fondo.
  const [pedido, setPedido] = useState(false)
  const buscando = pedido && estado.fase === 'buscando'
  const fase: FaseActualizacion = pedido || estado.fase === 'disponible' ? estado.fase : 'inactivo'

  async function buscar() {
    setPedido(true)
    await comprobarActualizacion(true)
  }

  const Icono =
    fase === 'al-dia'
      ? CheckCircle
      : fase === 'disponible' || fase === 'sin-conexion' || fase === 'sin-servicio'
        ? WarningCircle
        : ArrowsClockwise
  const tono =
    fase === 'al-dia'
      ? 'text-noct-exito'
      : fase === 'disponible'
        ? 'text-noct-precaucion'
        : 'text-noct-neutral-400'

  return (
    <div className="px-2 py-[11px]">
      <button
        type="button"
        onClick={() => void buscar()}
        disabled={buscando}
        className="flex min-h-11 w-full items-center gap-[13px] rounded-md text-left text-noct-text hover:bg-noct-text/[.05] disabled:opacity-70"
      >
        <Icono size={19} className={`shrink-0 ${tono}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-[1.3]">Buscar actualización</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-noct-neutral-400">
            {TEXTO_FASE[fase]}
          </span>
        </span>
      </button>

      {/* DIAGNÓSTICO, discreto: es lo que permite decir por teléfono
          "tengo la b518231 y el servidor anuncia la c0ffee1" en vez de
          "creo que no me actualizó". */}
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pl-[32px] text-[11px] leading-snug text-noct-neutral-500">
        <dt>Instalada</dt>
        <dd className="font-mono tabular-nums">{estado.versionInstalada}</dd>
        <dt>En el servidor</dt>
        <dd className="font-mono tabular-nums">{estado.versionDisponible ?? 'sin comprobar'}</dd>
        <dt>Service worker</dt>
        <dd>{TEXTO_WORKER[estado.estadoWorker]}</dd>
        <dt>Última comprobación</dt>
        <dd className="tabular-nums">{textoFecha(estado.ultimaComprobacion)}</dd>
      </dl>
    </div>
  )
}
