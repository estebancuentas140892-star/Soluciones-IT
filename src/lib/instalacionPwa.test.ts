import { afterEach, describe, expect, it, vi } from 'vitest'

// El modulo lee `window` al importarse (el estado inicial depende de si
// la pagina ya corre instalada), asi que cada prueba monta su propia
// ventana falsa ANTES de importarlo, con `vi.resetModules()` para que el
// estado de modulo no viaje de una prueba a otra.
//
// Las pruebas del entorno de este repo corren en Node (`environment:
// 'node'` en vite.config.ts), asi que no hay ningun `window` real que
// estorbe. Es la unica forma de cubrir este modulo: el dialogo de
// instalacion y los tres estados que ofrece viven detras del login, y
// esta sesion no tiene cuenta de tecnico para verlos en el navegador.

type Oyente = (evento: unknown) => void

interface OpcionesVentana {
  userAgent?: string
  // `navigator.standalone` de Safari en iOS.
  standaloneIos?: boolean
  // La media query `(display-mode: standalone)` responde que si.
  standaloneMedia?: boolean
  maxTouchPoints?: number
}

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120'
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari'

async function cargar(opciones: OpcionesVentana = {}) {
  const {
    userAgent = UA_ANDROID,
    standaloneIos = false,
    standaloneMedia = false,
    maxTouchPoints = 1,
  } = opciones

  const oyentes = new Map<string, Oyente[]>()
  const ventana = {
    addEventListener(tipo: string, oyente: Oyente) {
      oyentes.set(tipo, [...(oyentes.get(tipo) ?? []), oyente])
    },
    matchMedia(consulta: string) {
      return {
        matches: standaloneMedia && consulta.includes('standalone'),
        addEventListener() {},
      }
    },
    navigator: { userAgent, maxTouchPoints, standalone: standaloneIos },
  }

  vi.stubGlobal('window', ventana)
  vi.resetModules()
  const modulo = await import('./instalacionPwa')
  modulo.iniciarInstalacionPwa()

  return {
    modulo,
    disparar(tipo: string, evento: unknown) {
      for (const oyente of oyentes.get(tipo) ?? []) oyente(evento)
    },
  }
}

// Evento `beforeinstallprompt` de mentira: registra si le pidieron
// preventDefault y con que decision responde el tecnico.
function eventoInstalacion(decision: 'accepted' | 'dismissed') {
  const registro = { preventDefaultLlamado: false, promptLlamado: false }
  return {
    registro,
    evento: {
      preventDefault() {
        registro.preventDefaultLlamado = true
      },
      async prompt() {
        registro.promptLlamado = true
      },
      userChoice: Promise.resolve({ outcome: decision }),
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('estado inicial', () => {
  it('sin evento del navegador no hay botón de instalación', async () => {
    const { modulo } = await cargar()
    expect(modulo.obtenerEstadoInstalacion()).toEqual({
      instalada: false,
      puedeInstalar: false,
      requiereManual: false,
    })
  })

  it('en iPhone pide instrucciones manuales: Safari nunca ofrece el diálogo', async () => {
    const { modulo } = await cargar({ userAgent: UA_IPHONE })
    expect(modulo.obtenerEstadoInstalacion()).toMatchObject({
      puedeInstalar: false,
      requiereManual: true,
    })
  })

  it('en iPad moderno (se anuncia como Mac, pero es táctil) también', async () => {
    const { modulo } = await cargar({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari',
      maxTouchPoints: 5,
    })
    expect(modulo.obtenerEstadoInstalacion().requiereManual).toBe(true)
  })

  it('en Mac de escritorio no pide instrucciones manuales', async () => {
    const { modulo } = await cargar({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120',
      maxTouchPoints: 0,
    })
    expect(modulo.obtenerEstadoInstalacion().requiereManual).toBe(false)
  })

  it('ya corriendo como app instalada, no ofrece nada', async () => {
    const { modulo } = await cargar({ standaloneMedia: true })
    expect(modulo.obtenerEstadoInstalacion()).toMatchObject({
      instalada: true,
      requiereManual: false,
    })
  })

  it('instalada en iOS se detecta por navigator.standalone', async () => {
    const { modulo } = await cargar({ userAgent: UA_IPHONE, standaloneIos: true })
    expect(modulo.obtenerEstadoInstalacion()).toMatchObject({
      instalada: true,
      requiereManual: false,
    })
  })
})

describe('beforeinstallprompt', () => {
  it('enciende el botón y se queda el evento para nosotros', async () => {
    const { modulo, disparar } = await cargar()
    const { evento, registro } = eventoInstalacion('accepted')

    disparar('beforeinstallprompt', evento)

    expect(registro.preventDefaultLlamado).toBe(true)
    expect(modulo.obtenerEstadoInstalacion().puedeInstalar).toBe(true)
  })

  it('avisa a quien esté suscrito', async () => {
    const { modulo, disparar } = await cargar()
    let avisos = 0
    modulo.suscribirEstadoInstalacion(() => {
      avisos += 1
    })

    disparar('beforeinstallprompt', eventoInstalacion('accepted').evento)
    expect(avisos).toBe(1)
  })

  it('no avisa dos veces si el estado no cambia (referencia estable)', async () => {
    const { modulo, disparar } = await cargar()
    disparar('beforeinstallprompt', eventoInstalacion('accepted').evento)
    const antes = modulo.obtenerEstadoInstalacion()

    let avisos = 0
    modulo.suscribirEstadoInstalacion(() => {
      avisos += 1
    })
    disparar('beforeinstallprompt', eventoInstalacion('accepted').evento)

    expect(avisos).toBe(0)
    expect(modulo.obtenerEstadoInstalacion()).toBe(antes)
  })
})

describe('instalarApp', () => {
  it('sin diálogo guardado no inventa nada', async () => {
    const { modulo } = await cargar()
    await expect(modulo.instalarApp()).resolves.toBe('sin_dialogo')
  })

  it('aceptar deja de invitar', async () => {
    const { modulo, disparar } = await cargar()
    const { evento, registro } = eventoInstalacion('accepted')
    disparar('beforeinstallprompt', evento)

    await expect(modulo.instalarApp()).resolves.toBe('instalada')
    expect(registro.promptLlamado).toBe(true)
    expect(modulo.obtenerEstadoInstalacion().puedeInstalar).toBe(false)
  })

  it('rechazar cae a las instrucciones manuales', async () => {
    const { modulo, disparar } = await cargar()
    disparar('beforeinstallprompt', eventoInstalacion('dismissed').evento)

    await expect(modulo.instalarApp()).resolves.toBe('rechazada')
    expect(modulo.obtenerEstadoInstalacion()).toMatchObject({
      puedeInstalar: false,
      requiereManual: true,
    })
  })

  it('el diálogo del navegador sirve una sola vez', async () => {
    const { modulo, disparar } = await cargar()
    disparar('beforeinstallprompt', eventoInstalacion('accepted').evento)

    await modulo.instalarApp()
    await expect(modulo.instalarApp()).resolves.toBe('sin_dialogo')
  })
})

describe('appinstalled', () => {
  it('marca la app como instalada y retira la invitación', async () => {
    const { modulo, disparar } = await cargar()
    disparar('beforeinstallprompt', eventoInstalacion('accepted').evento)

    disparar('appinstalled', {})

    expect(modulo.obtenerEstadoInstalacion()).toEqual({
      instalada: true,
      puedeInstalar: false,
      requiereManual: false,
    })
  })
})
