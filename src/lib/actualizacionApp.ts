// COMPROBAR SI HAY VERSIÓN NUEVA, CUANDO DE VERDAD IMPORTA (encargo del
// 2026-09-20).
//
// El defecto que cierra: la app registraba el service worker y ponía un
// `setInterval` de UNA HORA. Un teléfono con la PWA instalada se abre,
// se usa diez minutos y se cierra, así que esa primera comprobación no
// llegaba nunca: el técnico veía la versión de hace días y el aviso
// "Versión nueva disponible" no aparecía aunque Vercel ya hubiera
// desplegado. Ahora se comprueba:
//
//   1. en cuanto el service worker queda registrado (sin esperar la hora);
//   2. al volver a la app desde segundo plano (`visibilitychange`);
//   3. al recuperar la conexión (`online`);
//   4. cuando el técnico lo pide a mano, desde Más;
//   5. y, de respaldo, cada hora como antes.
//
// Con un freno: entre comprobaciones automáticas tienen que pasar al
// menos `MIN_ENTRE_COMPROBACIONES_MS`. Volver a la app cinco veces en un
// minuto no dispara cinco consultas a la red. La manual no tiene freno:
// si alguien la pide, se hace.
//
// LO QUE ESTO NO HACE, A PROPÓSITO: no recarga nunca por su cuenta. El
// service worker está en `registerType: 'prompt'`, así que la versión
// nueva se queda en espera y solo entra cuando el técnico toca
// "Actualizar". Recargar solo se hace desde ese botón
// (`ActualizacionDisponible`), y jamás en mitad de una guía. Tampoco
// toca IndexedDB, la sesión, el avance ni la cola de sincronización: una
// actualización cambia los archivos de la app, nada más.

/** Lo único que este módulo necesita de un `ServiceWorkerRegistration`. */
export interface RegistroActualizable {
  update: () => Promise<unknown>
  waiting?: unknown
  installing?: unknown
}

export type FaseActualizacion =
  | 'inactivo'
  | 'buscando'
  | 'al-dia'
  | 'disponible'
  | 'sin-servicio'

export interface EstadoActualizacion {
  fase: FaseActualizacion
  /** Momento de la última comprobación terminada (ms), o 0 si no hubo. */
  ultimaComprobacion: number
}

/** Un minuto entre comprobaciones automáticas. La manual no espera. */
export const MIN_ENTRE_COMPROBACIONES_MS = 60 * 1000

/** Respaldo: si la app se queda abierta horas, se sigue comprobando. */
export const INTERVALO_COMPROBACION_MS = 60 * 60 * 1000

/**
 * ¿Toca comprobar? Función pura, que es donde vive el freno.
 *
 * `forzado` es la acción manual: siempre se comprueba. Sin fecha previa
 * (`ultima === 0`) también, que es el caso del registro inicial.
 */
export function debeComprobar(
  ultima: number,
  ahora: number,
  forzado = false,
  minimo = MIN_ENTRE_COMPROBACIONES_MS,
): boolean {
  if (forzado) return true
  if (ultima === 0) return true
  return ahora - ultima >= minimo
}

// ----------------------------------------------------------------
// El estado, compartido por toda la app (una sola instancia)
// ----------------------------------------------------------------

let registro: RegistroActualizable | null = null
let estado: EstadoActualizacion = { fase: 'inactivo', ultimaComprobacion: 0 }
let hayVersionNueva = false
let quitarOyentes: (() => void) | null = null
let intervalo: ReturnType<typeof setInterval> | null = null
const suscriptores = new Set<() => void>()
let reloj: () => number = () => Date.now()

function emitir(nuevo: EstadoActualizacion): void {
  estado = nuevo
  for (const avisar of suscriptores) avisar()
}

export function suscribirActualizacion(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar)
  return () => suscriptores.delete(alCambiar)
}

export function estadoActualizacion(): EstadoActualizacion {
  return estado
}

/**
 * La librería dice que hay una versión esperando (`needRefresh`). Se
 * anota aquí para que la acción manual de Más pueda contarlo, y porque
 * una comprobación que encuentra algo termina en 'disponible', no en
 * 'al-dia'.
 */
export function anotarVersionNueva(hay: boolean): void {
  if (hayVersionNueva === hay) return
  hayVersionNueva = hay
  emitir({ ...estado, fase: hay ? 'disponible' : estado.fase })
}

export function hayActualizacionEsperando(): boolean {
  return hayVersionNueva
}

/**
 * Comprueba contra el servidor si hay una versión nueva.
 *
 * Devuelve la fase resultante. Nunca lanza: un teléfono sin conexión o
 * un navegador sin service worker no pueden romper la pantalla que la
 * llamó.
 */
export async function comprobarActualizacion(forzado = false): Promise<FaseActualizacion> {
  if (!registro) {
    const fase: FaseActualizacion = 'sin-servicio'
    emitir({ ...estado, fase })
    return fase
  }
  const ahora = reloj()
  if (!debeComprobar(estado.ultimaComprobacion, ahora, forzado)) {
    return estado.fase === 'buscando' ? 'buscando' : estado.fase
  }

  emitir({ ...estado, fase: 'buscando' })
  try {
    await registro.update()
  } catch {
    // Sin conexión (o el servidor no responde): no es un error que
    // haya que enseñar como fallo. Se dirá lo que se sabe: que no
    // consta versión nueva.
  }
  const fase: FaseActualizacion = hayVersionNueva || registro.waiting ? 'disponible' : 'al-dia'
  emitir({ fase, ultimaComprobacion: reloj() })
  return fase
}

/**
 * El service worker acaba de registrarse: se comprueba YA (no dentro de
 * una hora), se deja el respaldo periódico y se enchufan los dos
 * disparadores que faltaban. Los oyentes y el intervalo se instalan una
 * sola vez aunque esto se llame de nuevo (React monta y desmonta).
 */
export function anotarRegistro(nuevo: RegistroActualizable | null): void {
  registro = nuevo
  if (!registro) return

  if (!intervalo) {
    intervalo = setInterval(() => void comprobarActualizacion(), INTERVALO_COMPROBACION_MS)
  }
  instalarOyentes()
  void comprobarActualizacion(true)
}

/**
 * Volver a la app y recuperar la conexión son los dos momentos en los
 * que el técnico está a punto de trabajar: es cuando conviene saber si
 * hay versión nueva. El freno de `debeComprobar` evita que alternar
 * entre apps dispare una consulta por cada cambio.
 */
export function instalarOyentes(destino: EventTarget & { document?: Document } = window): void {
  if (quitarOyentes) return
  const documento = destino.document ?? (typeof document !== 'undefined' ? document : undefined)
  const alVolver = () => {
    if (!documento || documento.visibilityState === 'visible') void comprobarActualizacion()
  }
  const alConectar = () => void comprobarActualizacion()
  documento?.addEventListener('visibilitychange', alVolver)
  destino.addEventListener('online', alConectar)
  // Se guarda cómo deshacerlo: sin esto, cada instalación deja escuchas
  // vivas para siempre (y en las pruebas, una por caso).
  quitarOyentes = () => {
    documento?.removeEventListener('visibilitychange', alVolver)
    destino.removeEventListener('online', alConectar)
  }
}

/** Solo para las pruebas: deja el módulo como recién cargado. */
export function reiniciarActualizacion(opciones: { ahora?: () => number } = {}): void {
  registro = null
  estado = { fase: 'inactivo', ultimaComprobacion: 0 }
  hayVersionNueva = false
  if (quitarOyentes) quitarOyentes()
  quitarOyentes = null
  if (intervalo) clearInterval(intervalo)
  intervalo = null
  suscriptores.clear()
  reloj = opciones.ahora ?? (() => Date.now())
}

/** Solo para las pruebas: ¿cuántos intervalos vivos hay? Debe ser 0 o 1. */
export function hayIntervaloVivo(): boolean {
  return intervalo !== null
}

// ----------------------------------------------------------------
// ACTIVAR LA VERSIÓN NUEVA Y RECARGAR (el botón "Actualizar")
// ----------------------------------------------------------------
//
// Vive aquí, y no dentro del componente, para poder probarlo sin service
// worker: es la parte que el usuario reportó rota el 2026-07-27 ("le doy
// al botón y no pasa nada").
//
// `updateServiceWorker` de la librería termina en
// `registration.waiting && mensaje(registration.waiting)`. Si en ese
// momento no hay worker en espera (otra pestaña ya lo activó, o el móvil
// lo activó al reanudar la app), la llamada no hace NADA en silencio: ni
// `skipWaiting`, ni `controllerchange`, ni recarga, y el aviso se queda
// en pantalla para siempre.
//
// Contrato de esta función: recarga SIEMPRE, una sola vez. Si había
// worker esperando, en cuanto toma el control; si no lo había, al vencer
// la espera (y esa recarga trae igualmente la versión nueva, porque el
// worker ya estaba activo).

/** Si el worker nuevo no toma el control en este tiempo, se recarga igual. */
export const ESPERA_MAX_MS = 2500

export async function activarYRecargar(
  updateServiceWorker: (recargar?: boolean) => Promise<void>,
  opciones: {
    recargar?: () => void
    esperaMs?: number
    servicio?: Pick<ServiceWorkerContainer, 'addEventListener'> | null
    programar?: (fn: () => void, ms: number) => unknown
  } = {},
): Promise<void> {
  const {
    recargar: recargarReal = () => window.location.reload(),
    esperaMs = ESPERA_MAX_MS,
    servicio = typeof navigator !== 'undefined' ? (navigator.serviceWorker ?? null) : null,
    programar = (fn: () => void, ms: number) => setTimeout(fn, ms),
  } = opciones

  let yaRecargado = false
  function recargar() {
    if (yaRecargado) return
    yaRecargado = true
    recargarReal()
  }

  // Camino normal: el worker nuevo toma el control y se recarga.
  servicio?.addEventListener('controllerchange', recargar, { once: true })
  // Red de seguridad para el caso de arriba.
  programar(recargar, esperaMs)

  try {
    // `false` porque la recarga la controlamos aquí.
    await updateServiceWorker(false)
  } catch {
    // Si el mensaje al worker falla, recargar es lo único útil que
    // queda: nunca dejar el botón sin efecto.
    recargar()
  }
}
