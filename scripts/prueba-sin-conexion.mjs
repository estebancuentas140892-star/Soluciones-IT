// PRUEBA SIN CONEXION, DE VERDAD (tarea 260, encargo del 2026-09-29).
// Solo desarrollo; no entra en el build.
//
// Lo que las capturas no pueden probar: el servidor de desarrollo no tiene
// service worker, asi que alli "sin conexion" es solo la pagina ya cargada.
// Aqui la app se compila como en produccion, se sirve con las cabeceras de
// vercel.json y, con el worker instalado, se corta la red de verdad:
//   1. primera carga con red lenta (3G) y la siguiente, ya desde el worker;
//   2. sin red y sin sesion, abre desde el precache (el inicio de sesion);
//   3. sin red y con una sesion cuyo token ya vencio (lo normal tras mas de
//      una hora sin abrir la app), abre la app y no el inicio de sesion;
//   4. las pantallas principales abren sin red, y las dos que salen del
//      precache (Importar y Etiquetas, tarea 259) dicen que necesitan red;
//   5. con el bloqueo de la app puesto, "Cerrar sesion y quitar el bloqueo"
//      sin red cierra la sesion de verdad: no deja entrar sin el codigo;
//   6. "Cerrar sesion" sin red cierra la sesion.
// Se compila contra un Supabase que no existe (prueba-sin-conexion): la
// sesion es inventada y se escribe con la red ya cortada, asi que nada
// llega a ningun servidor.
//
// Uso: node scripts/prueba-sin-conexion.mjs
// Salida: una linea por comprobacion y "PRUEBA SIN CONEXION: OK" (codigo
// 0), o los fallos (codigo 1). Fuera de Windows: CHROME=<ruta>.

import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const RAIZ = resolve(process.cwd())
const PUERTO = 5181
const BASE = `http://localhost:${PUERTO}`
const SALIDA = 'dist-sin-conexion'
const PERFIL = join(process.env.TEMP ?? tmpdir(), `cdp-sin-conexion-${Date.now()}`)
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PUERTO_CDP = 9388
// Un proyecto de Supabase que no existe. La clave de la sesion es la que
// supabase-js deriva de la URL (src/lib/supabase.ts la fija igual).
const URL_SUPABASE = 'https://prueba-sin-conexion.supabase.co'
const CLAVE_SESION = 'sb-prueba-sin-conexion-auth-token'
const CONTRASENA_BLOQUEO = 'prueba-1234'

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const paso = (texto) => console.log(`\n== ${texto}`)
let fallos = 0
function comprobar(condicion, texto) {
  console.log(`   ${condicion ? 'OK   ' : 'FALLO'} ${texto}`)
  if (!condicion) fallos++
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}
const SIN_CACHE = /^\/(sw\.js|registerSW\.js|version\.json|manifest\.webmanifest)$/

function compilar() {
  paso(`0. Compilando como en produccion en ${SALIDA}, contra ${URL_SUPABASE}`)
  // Vite con el mismo Node, sin shell: en Windows `npx` exige shell y la
  // ruta del proyecto puede llevar espacios.
  const resultado = spawnSync(
    process.execPath,
    [join(RAIZ, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', SALIDA, '--emptyOutDir'],
    {
      cwd: RAIZ,
      // Lo que ya esta en el entorno gana a los .env: el build nunca ve el
      // Supabase de verdad aunque la copia local tenga uno configurado.
      env: {
        ...process.env,
        VITE_SUPABASE_URL: URL_SUPABASE,
        VITE_SUPABASE_ANON_KEY: 'clave-de-prueba',
        VERCEL_GIT_COMMIT_SHA: 'sinred00',
      },
      encoding: 'utf8',
    },
  )
  if (resultado.status !== 0) {
    console.error(resultado.stdout, resultado.stderr)
    throw new Error('La compilacion fallo')
  }
}

function servir() {
  return new Promise((listo) => {
    const raiz = join(RAIZ, SALIDA)
    const servidor = createServer((peticion, respuesta) => {
      const url = new URL(peticion.url, BASE)
      let archivo = join(raiz, url.pathname)
      if (!existsSync(archivo) || url.pathname === '/') archivo = join(raiz, 'index.html')
      respuesta.writeHead(200, {
        'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
        'Cache-Control': SIN_CACHE.test(url.pathname) ? 'no-cache, no-store, must-revalidate' : 'public, max-age=0, must-revalidate',
      })
      createReadStream(archivo).pipe(respuesta)
    })
    servidor.listen(PUERTO, () => listo(servidor))
  })
}

async function json(ruta, metodo = 'GET') {
  const res = await fetch(`http://127.0.0.1:${PUERTO_CDP}${ruta}`, { method: metodo })
  return res.json()
}

class Sesion {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pendientes = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      const resolver = this.pendientes.get(msg.id)
      if (resolver) {
        this.pendientes.delete(msg.id)
        resolver(msg.result ?? msg.error)
      }
    })
  }
  enviar(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((r) => this.pendientes.set(id, r))
  }
  async evaluar(expresion) {
    const r = await this.enviar('Runtime.evaluate', {
      expression: `(async () => { ${expresion} })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r?.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r?.result?.value
  }
  async hasta(expresion, que, ms = 20000) {
    const limite = Date.now() + ms
    for (;;) {
      const valor = await this.evaluar(`return (${expresion})`).catch(() => false)
      if (valor) return valor
      if (Date.now() > limite) return false
      await esperar(250)
    }
  }
  async abrir(ruta, espera = 2500) {
    await this.enviar('Page.navigate', { url: BASE + ruta })
    await esperar(espera)
    return this.evaluar(`return { ruta: location.pathname, texto: document.body.innerText }`)
  }
  // Espera a que se pinte la app (su navegacion principal) o el inicio de
  // sesion, y dice cual y cuanto tardo. "Cargando" no cuenta como abierta.
  async esperarPantalla(ms = 45000) {
    const inicio = Date.now()
    await this.hasta(
      `document.querySelector('nav[aria-label="Navegación principal"]') != null || location.pathname === '/login' || /No se pudo cargar/.test(document.body.innerText)`,
      'la pantalla se pinta',
      ms,
    )
    const estado = await this.evaluar(
      `return { ruta: location.pathname, texto: document.body.innerText, app: document.querySelector('nav[aria-label="Navegación principal"]') != null }`,
    )
    return { ...estado, ms: Date.now() - inicio }
  }
  async ir(ruta) {
    await this.enviar('Page.navigate', { url: BASE + ruta })
    await esperar(300)
    return this.esperarPantalla()
  }
  async tocar(texto) {
    return this.evaluar(`
      const b = [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(texto)}))
      if (!b) return false
      b.click()
      await new Promise((r) => setTimeout(r, 600))
      return true
    `)
  }
  async escribirYEnviar(valor) {
    return this.evaluar(`
      const c = document.querySelector('input[type=password], input[placeholder="Contraseña"]')
      if (!c) return false
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(c, ${JSON.stringify(valor)})
      c.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
      c.form.requestSubmit()
      await new Promise((r) => setTimeout(r, 1500))
      return true
    `)
  }
}

// Una sesion de supabase-js con la forma real y un token que vencio hace
// dos horas. No sirve para nada fuera de esta prueba.
const SESION_VENCIDA = `(() => {
  const ahora = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    access_token: 'token-inventado-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: ahora - 7200,
    refresh_token: 'refresco-inventado-de-prueba',
    user: {
      id: '00000000-0000-4000-8000-0000000000aa',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'tecnico@prueba-sin-conexion.test',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  })
})()`
const PONER_SESION = `localStorage.setItem(${JSON.stringify(CLAVE_SESION)}, ${SESION_VENCIDA}); return true`
const HAY_SESION = `return localStorage.getItem(${JSON.stringify(CLAVE_SESION)}) !== null`
const PANTALLA_ROTA = /No se pudo cargar|Reinstalar la aplicación/

async function main() {
  compilar()
  let servidor = await servir()
  rmSync(PERFIL, { recursive: true, force: true })
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PUERTO_CDP}`,
    `--user-data-dir=${PERFIL}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ])
  chrome.on('error', (e) => {
    console.error('No se pudo lanzar Chrome:', e.message)
    process.exit(1)
  })
  for (let i = 0; i < 60; i++) {
    try {
      await json('/json/version')
      break
    } catch {
      await esperar(250)
    }
  }
  const objetivo = await json(`/json/new?about:blank`, 'PUT')
  const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const s = new Sesion(ws)
  await s.enviar('Page.enable')
  await s.enviar('Runtime.enable')
  await s.enviar('Network.enable')
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  try {
    paso('1. Primera carga con red lenta (3G: 1,6 Mbit/s y 300 ms)')
    await s.enviar('Network.emulateNetworkConditions', {
      offline: false,
      latency: 300,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    let inicio = Date.now()
    await s.enviar('Page.navigate', { url: BASE })
    const primera = await s.hasta(`document.body.innerText.includes('Ingresar')`, 'el inicio de sesion se ve', 60000)
    comprobar(Boolean(primera), `primera carga: el inicio de sesión se ve en ${Date.now() - inicio} ms`)
    comprobar(
      Boolean(await s.hasta(`navigator.serviceWorker.getRegistration('/').then((r) => r?.active != null)`, 'worker activo', 120000)),
      'el service worker queda activo (precache completo)',
    )
    inicio = Date.now()
    await s.enviar('Page.navigate', { url: BASE })
    await s.hasta(`document.body.innerText.includes('Ingresar')`, 'segunda carga', 60000)
    comprobar(
      Boolean(await s.hasta('navigator.serviceWorker.controller != null', 'el worker controla')),
      `segunda carga, ya desde el worker: ${Date.now() - inicio} ms`,
    )

    paso('2. Sin red y sin sesión: abre desde el precache')
    await s.enviar('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    // El servidor tambien se apaga: nada puede venir de la red.
    await new Promise((r) => servidor.close(r))
    servidor = null
    let pagina = await s.abrir('/', 3000)
    comprobar(pagina.ruta === '/login' && pagina.texto.includes('Ingresar'), `sin red abre el inicio de sesión (${pagina.ruta})`)
    comprobar(!PANTALLA_ROTA.test(pagina.texto), 'sin pantalla de error')

    paso('3. Sin red y con la sesión guardada pero vencida: abre la app')
    await s.evaluar(PONER_SESION)
    pagina = await s.ir('/')
    comprobar(pagina.app && pagina.ruta === '/', `abre la app y no el inicio de sesión (ruta: ${pagina.ruta}, ${pagina.ms} ms)`)
    comprobar(pagina.ms < 5000, `sin esperar a que falle la renovación del token (${pagina.ms} ms)`)
    comprobar(await s.evaluar(HAY_SESION), 'la sesión guardada sigue ahí para cuando vuelva la red')

    paso('4. Las pantallas principales abren sin red')
    for (const ruta of ['/soluciones', '/dispositivos', '/red', '/agenda', '/mas', '/boveda', '/cuenta']) {
      pagina = await s.ir(ruta)
      comprobar(pagina.app && pagina.ruta === ruta && !PANTALLA_ROTA.test(pagina.texto), `${ruta} (${pagina.ruta}, ${pagina.ms} ms)`)
    }
    for (const ruta of ['/dispositivos/importar', '/dispositivos/etiquetas']) {
      pagina = await s.abrir(ruta, 4000)
      const linea = pagina.texto.split('\n').find((l) => /conexi|red|No se pudo/i.test(l)) ?? pagina.texto.slice(0, 80)
      comprobar(!/Reinstalar la aplicación/.test(pagina.texto), `${ruta} fuera del precache: "${linea.trim()}"`)
    }

    paso('5. Bloqueo de la app: olvidar el código sin red no deja entrar')
    pagina = await s.ir('/cuenta/seguridad')
    await s.tocar('Contraseña')
    await s.escribirYEnviar(CONTRASENA_BLOQUEO)
    await s.escribirYEnviar(CONTRASENA_BLOQUEO)
    await s.enviar('Page.navigate', { url: BASE + '/' })
    const bloqueada = await s.hasta(`document.body.innerText.includes('Ingresa tu contraseña de desbloqueo')`, 'pide el código', 45000)
    comprobar(Boolean(bloqueada), 'con el bloqueo puesto, la app pide el código')
    await s.tocar('¿Olvidaste tu código')
    await s.tocar('Cerrar sesión y quitar el bloqueo')
    await esperar(2500)
    pagina = await s.evaluar(`return { ruta: location.pathname, texto: document.body.innerText }`)
    comprobar(pagina.ruta === '/login', `termina en el inicio de sesión, no dentro de la app (ruta: ${pagina.ruta})`)
    comprobar(!(await s.evaluar(HAY_SESION)), 'la sesión se borró de este teléfono')
    pagina = await s.ir('/')
    comprobar(pagina.ruta === '/login', `al recargar sigue fuera (ruta: ${pagina.ruta})`)

    paso('6. "Cerrar sesión" sin red cierra la sesión')
    await s.evaluar(PONER_SESION)
    pagina = await s.ir('/cuenta')
    comprobar(pagina.app, `Ajustes abre con la sesión guardada (${pagina.ms} ms)`)
    await s.tocar('Cerrar sesión')
    await esperar(2500)
    pagina = await s.evaluar(`return { ruta: location.pathname }`)
    comprobar(pagina.ruta === '/login', `termina en el inicio de sesión (ruta: ${pagina.ruta})`)
    comprobar(!(await s.evaluar(HAY_SESION)), 'la sesión se borró de este teléfono')
  } finally {
    ws.close()
    chrome.kill()
    if (servidor) servidor.close()
    await esperar(500)
    try {
      rmSync(PERFIL, { recursive: true, force: true })
    } catch {
      // El perfil temporal a veces queda bloqueado un instante; no importa.
    }
  }
  console.log(fallos === 0 ? '\nPRUEBA SIN CONEXION: OK' : `\nPRUEBA SIN CONEXION: ${fallos} FALLO(S)`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\nPRUEBA SIN CONEXION: ERROR\n', e.message)
  process.exit(1)
})
