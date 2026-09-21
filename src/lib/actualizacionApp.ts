// COORDINADOR DE ACTUALIZACIONES DE LA PWA (encargo del 2026-09-21).
//
// EL DEFECTO REAL, y por qué las dos correcciones anteriores no bastaron:
//
// La app ya comprobaba "al abrir" llamando a `registration.update()`. Eso
// le pide al navegador que revalide `sw.js`... y el navegador puede
// servirlo desde SU caché HTTP. Sin cabeceras que lo prohíban, un
// teléfono con la PWA instalada podía pasar días con el mismo `sw.js` en
// caché: `update()` no traía nada nuevo, no había `updatefound`,
// `needRefresh` no se encendía y el aviso no aparecía NUNCA. Desde
// dentro de la app era indistinguible de "ya estás al día".
//
// Por eso ahora hay tres piezas, y las tres hacen falta:
//
//   1. `/version.json` (lo emite `vite.config.ts`): un dato que se pide
//      SIEMPRE a la red, con `cache: 'no-store'` y un parámetro variable,
//      y que NO entra en el precache. Comparado con la versión horneada
//      en este build, dice la verdad aunque el `sw.js` esté cacheado.
//   2. Cabeceras `no-store` en `vercel.json` para `sw.js`,
//      `registerSW.js`, `version.json` y el manifiesto: nada más. El
//      resto de la app sigue cacheándose por hash, que es lo correcto.
//   3. Este módulo, que observa TODOS los estados del service worker
//      (`waiting`, `installing`, `updatefound`, `statechange`,
//      `controllerchange`) en vez de fiarse solo de `needRefresh`, que
//      solo se enciende si el evento llega a ESTA ventana.
//
// Cuándo se comprueba: al arrancar, al volver la app a primer plano, al
// recuperar el foco de la ventana, al recuperar la conexión, a mano
// desde Más y, de respaldo, cada cinco minutos. Con un mínimo de un
// minuto entre comprobaciones automáticas.
//
// LO QUE NUNCA HACE: recargar por su cuenta mientras se trabaja, borrar
// cachés, tocar IndexedDB, la sesión, el avance de las guías o la cola de
// sincronización. Una actualización reemplaza los archivos de la app y
// nada más; desinstalar la PWA no es (ni debe ser) parte de esto.

import { versionApp } from './versionApp'

/** Lo único que este módulo necesita de un `ServiceWorkerRegistration`. */
export interface RegistroActualizable {
  update: () => Promise<unknown>
  waiting?: unknown
  installing?: unknown
  active?: unknown
  addEventListener?: (tipo: string, fn: () => void) => void
}

export type FaseActualizacion =
  | 'inactivo'
  | 'buscando'
  | 'al-dia'
  | 'disponible'
  | 'sin-conexion'
  | 'sin-servicio'

export type EstadoWorker = 'sin-worker' | 'activo' | 'instalando' | 'esperando'

export interface EstadoActualizacion {
  fase: FaseActualizacion
  /** Momento de la última comprobación terminada (ms), o 0 si no hubo. */
  ultimaComprobacion: number
  /** La versión de ESTE build (la que corre ahora mismo). */
  versionInstalada: string
  /** La que anuncia `/version.json`, o null si aún no se ha podido leer. */
  versionDisponible: string | null
  estadoWorker: EstadoWorker
}

/** Un minuto entre comprobaciones automáticas. La manual no espera. */
export const MIN_ENTRE_COMPROBACIONES_MS = 60 * 1000

/**
 * Respaldo periódico. Cinco minutos, no una hora: con la app abierta en
 * el mostrador, enterarse dentro de sesenta minutos es no enterarse.
 */
export const INTERVALO_COMPROBACION_MS = 5 * 60 * 1000

/** Si el worker nuevo no toma el control en este tiempo, se recarga igual. */
export const ESPERA_MAX_MS = 2500

/** Mensaje que activa el worker en espera (lo entiende el SW de workbox). */
export const MENSAJE_SALTAR_ESPERA = 'SKIP_WAITING'

/**
 * ¿Toca comprobar? Función pura, que es donde vive el freno.
 *
 * `forzado` es la acción manual: siempre se comprueba. Sin fecha previa
 * (`ultima === 0`) también, que es el caso del arranque.
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

/**
 * ¿La versión que anuncia el servidor es otra? Pura, para poder probar
 * los casos raros: sin dato remoto no se afirma nada, y en desarrollo
 * local (sin commit horneado) no se compara.
 */
export function hayVersionDistinta(instalada: string, disponible: string | null): boolean {
  if (!disponible) return false
  if (instalada === 'desarrollo' || disponible === 'desarrollo') return false
  return instalada !== disponible
}

// ----------------------------------------------------------------
// El estado, compartido por toda la app (una sola instancia)
// ----------------------------------------------------------------

let registro: RegistroActualizable | null = null
let estado: EstadoActualizacion = {
  fase: 'inactivo',
  ultimaComprobacion: 0,
  versionInstalada: versionApp(),
  versionDisponible: null,
  estadoWorker: 'sin-worker',
}
let hayVersionNueva = false
let quitarOyentes: (() => void) | null = null
let intervalo: ReturnType<typeof setInterval> | null = null
let observado: RegistroActualizable | null = null
let activacionPedida = false
let yaRecargado = false
const suscriptores = new Set<() => void>()
let reloj: () => number = () => Date.now()
let recargarReal: () => void = () => window.location.reload()

function emitir(cambios: Partial<EstadoActualizacion>): void {
  estado = { ...estado, ...cambios }
  for (const avisar of suscriptores) avisar()
}

export function suscribirActualizacion(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar)
  return () => suscriptores.delete(alCambiar)
}

export function estadoActualizacion(): EstadoActualizacion {
  return estado
}

export function hayActualizacionEsperando(): boolean {
  return hayVersionNueva
}

/**
 * Marca que hay una versión lista para entrar. Lo llaman la librería
 * (`needRefresh`) y la observación directa del registro, así que se
 * escribe una vez y todo lo demás lo lee de aquí.
 */
export function anotarVersionNueva(hay: boolean): void {
  if (hayVersionNueva === hay) return
  hayVersionNueva = hay
  emitir({
    fase: hay ? 'disponible' : estado.fase,
    estadoWorker: hay ? 'esperando' : estado.estadoWorker,
  })
}

// ----------------------------------------------------------------
// Observar TODOS los estados del service worker
// ----------------------------------------------------------------

function leerEstadoWorker(reg: RegistroActualizable): EstadoWorker {
  if (reg.waiting) return 'esperando'
  if (reg.installing) return 'instalando'
  if (reg.active) return 'activo'
  return 'sin-worker'
}

function hayControlador(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller)
}

/**
 * Un worker que se está instalando todavía no sirve de nada: hay que
 * esperar a `installed`. Y solo cuenta como "versión nueva" si ya había
 * un controlador; si no, es la PRIMERA instalación de la app y no hay
 * nada que actualizar ni que avisar.
 */
function seguirInstalacion(trabajador: unknown, conControlador = hayControlador()): void {
  const sw = trabajador as
    | { state?: string; addEventListener?: (tipo: string, fn: () => void) => void }
    | null
    | undefined
  if (!sw?.addEventListener) return
  const alCambiar = () => {
    if (sw.state === 'installed') {
      emitir({ estadoWorker: 'esperando' })
      if (conControlador || hayControlador()) anotarVersionNueva(true)
    }
    if (sw.state === 'activated') emitir({ estadoWorker: 'activo' })
  }
  sw.addEventListener('statechange', alCambiar)
  alCambiar()
}

/**
 * Engancha un registro: si YA hay un worker en espera, el aviso sale
 * ahora mismo; si hay uno instalándose, se espera a que llegue a
 * `installed`; y cualquier instalación futura (`updatefound`) se sigue
 * igual. Es lo que `needRefresh` no cubre: ese evento solo existe si la
 * instalación ocurre mientras esta ventana está viva y escuchando.
 */
export function observarRegistro(reg: RegistroActualizable | null): void {
  if (!reg) return
  if (observado === reg) {
    // El mismo registro puede haber cambiado de estado entre dos
    // comprobaciones: se vuelve a leer, pero sin duplicar oyentes.
    emitir({ estadoWorker: leerEstadoWorker(reg) })
    if (reg.waiting) anotarVersionNueva(true)
    return
  }
  observado = reg
  emitir({ estadoWorker: leerEstadoWorker(reg) })

  if (reg.waiting) anotarVersionNueva(true)
  seguirInstalacion(reg.installing)

  reg.addEventListener?.('updatefound', () => {
    emitir({ estadoWorker: 'instalando' })
    seguirInstalacion((reg as { installing?: unknown }).installing)
  })
}

/**
 * Busca el registro que YA existe en este navegador, sin esperar a que
 * la librería avise. Es lo que hace que una PWA instalada con un worker
 * en espera enseñe el aviso nada más abrirse.
 */
export async function adoptarRegistroExistente(
  contenedor: Pick<ServiceWorkerContainer, 'getRegistration'> | null = typeof navigator !== 'undefined'
    ? (navigator.serviceWorker ?? null)
    : null,
): Promise<void> {
  if (!contenedor?.getRegistration) return
  try {
    const existente = await contenedor.getRegistration('/')
    if (existente) anotarRegistro(existente as unknown as RegistroActualizable)
  } catch {
    // Un navegador sin permiso de service worker no es un fallo de la
    // app: simplemente no hay actualizaciones que coordinar.
  }
}

// ----------------------------------------------------------------
// Comprobar
// ----------------------------------------------------------------

/**
 * Lee `/version.json` SIEMPRE de la red. Devuelve la versión anunciada,
 * o null si no se pudo (sin conexión, 404 en desarrollo, json raro).
 * Nunca lanza: quedarse sin saber la versión no puede romper la app.
 */
export async function consultarVersionRemota(
  pedir: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<string | null> {
  if (!pedir) return null
  try {
    const respuesta = await pedir(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!respuesta.ok) return null
    const datos = (await respuesta.json()) as { version?: unknown }
    return typeof datos.version === 'string' && datos.version !== '' ? datos.version : null
  } catch {
    return null
  }
}

/**
 * La comprobación completa: versión remota, `update()` del registro y
 * lectura de todos los estados del worker.
 *
 * Devuelve la fase resultante y nunca lanza.
 */
export async function comprobarActualizacion(forzado = false): Promise<FaseActualizacion> {
  const ahora = reloj()
  if (!forzado && !debeComprobar(estado.ultimaComprobacion, ahora, false)) {
    return estado.fase
  }

  emitir({ fase: 'buscando' })

  // 1. Qué versión hay en el servidor (independiente del service worker).
  const remota = await consultarVersionRemota()
  const sinRed = remota === null && typeof navigator !== 'undefined' && navigator.onLine === false

  // 2. Pedirle al navegador que revise el worker.
  if (registro) {
    try {
      await registro.update()
    } catch {
      // Sin conexión o servidor caído: se responde con lo que se sepa.
    }
    observarRegistro(registro)
  }

  // 3. Leer el resultado de todos los estados posibles.
  const estadoWorker = registro ? leerEstadoWorker(registro) : 'sin-worker'
  const distinta = hayVersionDistinta(estado.versionInstalada, remota)
  const disponible = hayVersionNueva || Boolean(registro?.waiting) || distinta

  let fase: FaseActualizacion
  if (disponible) fase = 'disponible'
  else if (sinRed) fase = 'sin-conexion'
  else if (!registro) fase = 'sin-servicio'
  else fase = 'al-dia'

  emitir({ fase, ultimaComprobacion: reloj(), versionDisponible: remota, estadoWorker })
  return fase
}

// ----------------------------------------------------------------
// Arranque: registro, oyentes e intervalo (una sola vez)
// ----------------------------------------------------------------

/**
 * El service worker acaba de registrarse (o se acaba de adoptar el que
 * ya existía): se observa, se comprueba YA y se dejan los disparadores.
 * Todo se instala una sola vez aunque esto se llame de nuevo.
 */
export function anotarRegistro(nuevo: RegistroActualizable | null): void {
  registro = nuevo
  if (!registro) return

  observarRegistro(registro)
  if (!intervalo) {
    intervalo = setInterval(() => void comprobarActualizacion(), INTERVALO_COMPROBACION_MS)
  }
  instalarOyentes()
  void comprobarActualizacion(true)
}

/**
 * El controlador cambió: hay un worker nuevo al mando.
 *
 * Si el cambio lo pidió el técnico (botón "Actualizar"), se recarga UNA
 * vez, que es lo que espera. Si NO lo pidió (otra pestaña actualizó, o el
 * navegador activó el worker por su cuenta), NO se recarga: podría estar
 * en mitad de un paso de una guía. Se enseña el aviso y decide él. Ese es
 * también el freno contra los bucles de recarga.
 */
function alCambiarControlador(): void {
  emitir({ estadoWorker: 'activo' })
  if (!activacionPedida) {
    anotarVersionNueva(true)
    return
  }
  recargarUnaVez()
}

function recargarUnaVez(): void {
  if (yaRecargado) return
  yaRecargado = true
  recargarReal()
}

/**
 * Volver a la app, recuperar el foco y recuperar la conexión son los
 * momentos en los que el técnico está a punto de trabajar: es cuando
 * conviene saber si hay versión nueva. El freno de `debeComprobar` evita
 * que alternar entre apps dispare una consulta por cada cambio.
 */
export function instalarOyentes(destino: EventTarget & { document?: Document } = window): void {
  if (quitarOyentes) return
  const documento = destino.document ?? (typeof document !== 'undefined' ? document : undefined)
  const alVolver = () => {
    if (!documento || documento.visibilityState === 'visible') void comprobarActualizacion()
  }
  const alConectar = () => void comprobarActualizacion()
  const alEnfocar = () => void comprobarActualizacion()
  documento?.addEventListener('visibilitychange', alVolver)
  destino.addEventListener('online', alConectar)
  destino.addEventListener('focus', alEnfocar)

  // `addEventListener` se comprueba a mano: hay navegadores (y entornos
  // de prueba) donde `navigator.serviceWorker` existe a medias.
  const contenedor = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
  const servicio = typeof contenedor?.addEventListener === 'function' ? contenedor : undefined
  servicio?.addEventListener('controllerchange', alCambiarControlador)

  // Se guarda cómo deshacerlo: sin esto, cada instalación deja escuchas
  // vivas para siempre (y en las pruebas, una por caso).
  quitarOyentes = () => {
    documento?.removeEventListener('visibilitychange', alVolver)
    destino.removeEventListener('online', alConectar)
    destino.removeEventListener('focus', alEnfocar)
    servicio?.removeEventListener('controllerchange', alCambiarControlador)
  }
}

/**
 * Arranca el coordinador sin depender de la librería: adopta el registro
 * que ya exista en este navegador. Se llama desde la raíz de la app,
 * antes de iniciar sesión.
 */
export function iniciarCoordinador(): void {
  instalarOyentes()
  void adoptarRegistroExistente()
}

// ----------------------------------------------------------------
// ACTIVAR LA VERSIÓN NUEVA Y RECARGAR (el botón "Actualizar")
// ----------------------------------------------------------------
//
// El fallo histórico que esto cierra (reportado el 2026-07-27, "le doy al
// botón y no pasa nada"): `updateServiceWorker` de la librería termina en
// `registration.waiting && mensaje(registration.waiting)`. Si en ese
// momento no hay worker en espera, la llamada no hace NADA en silencio y
// el aviso se queda para siempre.
//
// Contrato: recarga SIEMPRE, una sola vez. Manda `SKIP_WAITING` al worker
// en espera si lo hay, espera `controllerchange`, y si no llega nada,
// recarga al vencer el plazo (esa recarga trae igualmente la versión
// nueva, porque el worker ya estaba activo).

export async function activarYRecargar(
  updateServiceWorker: (recargar?: boolean) => Promise<void>,
  opciones: {
    recargar?: () => void
    esperaMs?: number
    servicio?: Pick<ServiceWorkerContainer, 'addEventListener'> | null
    programar?: (fn: () => void, ms: number) => unknown
    enEspera?: { postMessage: (mensaje: unknown) => void } | null
  } = {},
): Promise<void> {
  const {
    recargar: recarga = () => window.location.reload(),
    esperaMs = ESPERA_MAX_MS,
    servicio = typeof navigator !== 'undefined' ? (navigator.serviceWorker ?? null) : null,
    programar = (fn: () => void, ms: number) => setTimeout(fn, ms),
    enEspera = (registro?.waiting as { postMessage: (m: unknown) => void } | undefined) ?? null,
  } = opciones

  activacionPedida = true
  let hecho = false
  function recargar() {
    if (hecho) return
    hecho = true
    yaRecargado = true
    recarga()
  }

  // Camino normal: el worker nuevo toma el control y se recarga.
  servicio?.addEventListener('controllerchange', recargar, { once: true })
  // Red de seguridad para el caso de arriba.
  programar(recargar, esperaMs)

  // Al worker en espera se le habla directamente: así no depende de que
  // la librería tenga la misma referencia que nosotros.
  try {
    enEspera?.postMessage({ type: MENSAJE_SALTAR_ESPERA })
  } catch {
    // Un worker que ya no existe no puede recibir mensajes; da igual,
    // la recarga sigue programada.
  }

  try {
    // `false` porque la recarga la controlamos aquí.
    await updateServiceWorker(false)
  } catch {
    // Si el mensaje al worker falla, recargar es lo único útil que
    // queda: nunca dejar el botón sin efecto.
    recargar()
  }
}

// ----------------------------------------------------------------
// Solo para las pruebas
// ----------------------------------------------------------------

export function reiniciarActualizacion(
  opciones: { ahora?: () => number; recargar?: () => void; versionInstalada?: string } = {},
): void {
  registro = null
  observado = null
  estado = {
    fase: 'inactivo',
    ultimaComprobacion: 0,
    versionInstalada: opciones.versionInstalada ?? versionApp(),
    versionDisponible: null,
    estadoWorker: 'sin-worker',
  }
  hayVersionNueva = false
  activacionPedida = false
  yaRecargado = false
  if (quitarOyentes) quitarOyentes()
  quitarOyentes = null
  if (intervalo) clearInterval(intervalo)
  intervalo = null
  suscriptores.clear()
  reloj = opciones.ahora ?? (() => Date.now())
  recargarReal = opciones.recargar ?? (() => window.location.reload())
}

/** ¿Hay un intervalo vivo? Debe ser 0 o 1, nunca más. */
export function hayIntervaloVivo(): boolean {
  return intervalo !== null
}

/** Para probar que `controllerchange` no recarga si nadie lo pidió. */
export function simularCambioDeControlador(): void {
  alCambiarControlador()
}
