// Instalacion de la PWA en el dispositivo del tecnico: es de lo que
// depende el trabajo sin señal, y hasta la tarea 184 la app no lo
// ofrecia en ninguna parte (problema del turno 3 del handoff: "la app
// instalable no invita a instalarse").
//
// Se resuelve como store externo (mismo patron que el progreso de
// descarga en adjuntosOffline.ts) y NO como hook con estado propio, por
// un motivo concreto: el navegador dispara `beforeinstallprompt` una
// sola vez, muy temprano tras cargar la pagina, y todas las pantallas de
// esta app se cargan bajo demanda (`lazy` en App.tsx). Si el oyente
// viviera dentro de un componente, el evento ya habria pasado cuando el
// componente monta y el boton "Instalar" no aparaceria nunca. Por eso
// este modulo se importa desde main.tsx, que se evalua en el arranque.

// El evento no esta en los tipos del DOM (es una extension de Chromium).
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface EstadoInstalacion {
  // Ya corre como app instalada (ventana propia, sin barra del
  // navegador). Es el unico estado que cierra el paso 2 de la
  // bienvenida.
  instalada: boolean
  // El navegador ofrecio su dialogo nativo: hay un boton "Instalar"
  // que hace el trabajo de un toque.
  puedeInstalar: boolean
  // Safari en iPhone/iPad instala desde el menu Compartir y nunca
  // dispara `beforeinstallprompt`, asi que ahi no hay boton posible:
  // solo se pueden dar las instrucciones.
  requiereManual: boolean
}

const EN_NAVEGADOR = typeof window !== 'undefined'

// ¿La pagina corre ya como app instalada? `display-mode: standalone`
// es el estandar; `navigator.standalone` es el equivalente propietario
// de Safari en iOS, que no soporta la media query.
function detectarInstalada(): boolean {
  if (!EN_NAVEGADOR) return false
  const comoApp =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches)
  const enIosApp = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return comoApp || enIosApp
}

// Safari de iOS/iPadOS. Se mira el motor, no la marca del navegador:
// en iOS todos los navegadores usan WebKit y ninguno dispara
// `beforeinstallprompt`, asi que a todos les sirven las mismas
// instrucciones manuales.
function detectarIos(): boolean {
  if (!EN_NAVEGADOR) return false
  const ua = window.navigator.userAgent
  const iphone = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ se anuncia como Mac; se distingue porque tiene tactil.
  const ipadModerno = /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1
  return iphone || ipadModerno
}

let promptGuardado: EventoInstalacion | null = null
let estado: EstadoInstalacion = {
  instalada: detectarInstalada(),
  puedeInstalar: false,
  requiereManual: detectarIos() && !detectarInstalada(),
}

const suscriptores = new Set<() => void>()

export function obtenerEstadoInstalacion(): EstadoInstalacion {
  return estado
}

export function suscribirEstadoInstalacion(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

// El objeto solo se reemplaza cuando algo cambia de verdad: quien lo lea
// con useSyncExternalStore recibe siempre la misma referencia mientras el
// estado no se mueva (si cambiara en cada lectura, React re-renderizaria
// sin fin).
function actualizar(cambios: Partial<EstadoInstalacion>): void {
  const siguiente = { ...estado, ...cambios }
  if (
    siguiente.instalada === estado.instalada &&
    siguiente.puedeInstalar === estado.puedeInstalar &&
    siguiente.requiereManual === estado.requiereManual
  ) {
    return
  }
  estado = siguiente
  for (const escucha of suscriptores) escucha()
}

// Registra los oyentes del navegador. Se llama desde main.tsx en el
// arranque; llamarla dos veces no duplica nada.
let registrado = false
export function iniciarInstalacionPwa(): void {
  if (!EN_NAVEGADOR || registrado) return
  registrado = true

  window.addEventListener('beforeinstallprompt', (evento) => {
    // Sin preventDefault, algunos navegadores muestran su propia
    // invitacion cuando quieren. La decision del handoff es que la
    // instalacion se ofrezca en la bienvenida y en Mi cuenta, "nunca
    // como banner intrusivo", asi que se guarda el evento y se ofrece
    // desde la interfaz de la app.
    evento.preventDefault()
    promptGuardado = evento as EventoInstalacion
    actualizar({ puedeInstalar: true, requiereManual: false })
  })

  window.addEventListener('appinstalled', () => {
    promptGuardado = null
    actualizar({ instalada: true, puedeInstalar: false, requiereManual: false })
  })

  // Instalar desde el propio navegador (menu del navegador, sin pasar
  // por nuestro boton) cambia el modo de presentacion sin recargar.
  if (typeof window.matchMedia === 'function') {
    const consulta = window.matchMedia('(display-mode: standalone)')
    consulta.addEventListener?.('change', () => {
      const instalada = detectarInstalada()
      actualizar({ instalada, puedeInstalar: instalada ? false : estado.puedeInstalar })
    })
  }
}

export type ResultadoInstalacion = 'instalada' | 'rechazada' | 'sin_dialogo'

// Abre el dialogo nativo de instalacion. El evento guardado se puede
// usar UNA sola vez: si el tecnico lo rechaza, el navegador decide
// cuando volver a ofrecerlo, asi que se descarta y el boton deja paso a
// las instrucciones manuales.
export async function instalarApp(): Promise<ResultadoInstalacion> {
  if (!promptGuardado) return 'sin_dialogo'
  const evento = promptGuardado
  promptGuardado = null
  await evento.prompt()
  const { outcome } = await evento.userChoice
  if (outcome === 'accepted') {
    // El estado definitivo lo confirma `appinstalled`; esto solo evita
    // que el boton siga invitando mientras llega.
    actualizar({ puedeInstalar: false })
    return 'instalada'
  }
  actualizar({ puedeInstalar: false, requiereManual: true })
  return 'rechazada'
}

// Instrucciones para los navegadores sin dialogo nativo (Safari de iOS
// siempre; el resto cuando el dialogo ya se uso o se rechazo).
export const PASOS_INSTALACION_MANUAL = [
  'En el teléfono: abre el menú del navegador (Compartir en iPhone, los tres puntos en Android).',
  'Toca "Añadir a pantalla de inicio" o "Instalar aplicación".',
  'Confirma el nombre y listo: la app queda con su propio icono.',
]
