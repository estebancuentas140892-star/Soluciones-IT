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
//   4. las pantallas principales abren sin red, y una guia se ejecuta sin
//      red: lo reutilizado en el sitio, su "Como hacerlo" (tarea 303) y la
//      imagen de "Debes ver" desde la copia sin conexion (tarea 307);
//   5. desbloqueo del dispositivo (tarea 278) con el autenticador virtual
//      de Chromium: se activa sobre la contrasena, abre la app sin red con
//      una credencial y una firma reales, y sin verificar al usuario o con
//      la credencial borrada NO abre, y la contrasena sigue entrando;
//   6. con el bloqueo de la app puesto, "Cerrar sesion y quitar el bloqueo"
//      sin red cierra la sesion de verdad: no deja entrar sin el codigo, y
//      se lleva tambien el desbloqueo del dispositivo;
//   7. "Cerrar sesion" sin red cierra la sesion;
//   8. una pantalla que sale del precache (Importar, tarea 259) dice que
//      necesita red, sin reinstalar nada.
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
  // Los campos de secreto son texto enmascarado por CSS (CampoContrasena),
  // no type=password: se reconocen por su placeholder.
  async escribirYEnviar(valor) {
    return this.evaluar(`
      const c = document.querySelector('input[type=password], input[placeholder="Contraseña"], input[placeholder="Contraseña de desbloqueo"]')
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
// La fila del bloqueo tal como la guarda la app (IndexedDB de Dexie), o null.
const FILA_BLOQUEO = `
  const base = await new Promise((ok, mal) => {
    const r = indexedDB.open('soluciones-it')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })
  const fila = await new Promise((ok, mal) => {
    const r = base.transaction('seguridadApp').objectStore('seguridadApp').get('principal')
    r.onsuccess = () => ok(r.result ?? null)
    r.onerror = () => mal(r.error)
  })
  base.close()
  return fila
`
const HAY_APP = `document.querySelector('nav[aria-label="Navegación principal"]') != null`
// Tarea 289: una guía que reutiliza otra en su paso 1, inventada y escrita
// directo en la base local (IndexedDB) con la red ya cortada.
const AHORA = new Date(0).toISOString()
const CATEGORIA_PRUEBA = { id: 'cat-sin-conexion', nombre: 'Sin conexión', icono: '', orden: 99, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
function guiaDePrueba(id, titulo, procedimiento) {
  return { id, categoriaId: 'cat-sin-conexion', titulo, tipo: 'configuracion', contenido: '', etiquetas: [], procedimiento, sintomas: [], causas: [], dispositivosAfectados: [], esRutaInicio: false, estado: 'publicado', version: '1.0', relacionados: [], ordenRutaInicio: 0, origenSugerenciaId: null, aplicaA: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}
// La imagen de "Debes ver" de la guía sin red (tarea 307): una ventana
// dibujada, sin ningún dato real.
const IMAGEN_SIN_RED = { referencia: 'pruebas/sin-red-ventana.svg', nombre: 'sin-red-ventana.svg', tipo: 'image/svg+xml' }
const DESCRIPCION_SIN_RED = 'La ventana de prueba sin red, abierta'
const SVG_SIN_RED =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#eef"/><rect width="320" height="28" fill="#2b5797"/><text x="10" y="19" font-size="13" fill="#fff">Programa de prueba sin red</text></svg>'
const GUIAS_PRUEBA = [
  guiaDePrueba('acceso-sin-conexion', 'Entrar al programa de prueba sin red', {
    requisitos: ['Red de prueba sin conexión.'],
    // Con "Cómo hacerlo" (tarea 303), dos microacciones inventadas: su ruta
    // rápida y su paso a paso se leen en el flujo de la guía que la
    // reutiliza, sin red.
    pasos: [
      {
        id: 'acs-p1',
        titulo: 'Abrir el programa',
        bloques: [
          {
            id: 'acs-p1-t1',
            tipo: 'tarea',
            texto: 'Abre el programa de prueba sin red',
            comoHacer: [
              { id: 'acs-m1', accion: 'Abre', elemento: 'Acceso rápido de prueba' },
              { id: 'acs-m2', accion: 'Pulsa', elemento: 'Programa', ubicacion: 'Barra lateral de prueba' },
            ],
            // "Debes ver" (tarea 307): la imagen del resultado, que se lee de
            // la copia sin conexión (la deja ahí SEMBRAR_GUIAS_PRUEBA, como
            // "Descargar todo para offline").
            resultadoVisual: { adjunto: IMAGEN_SIN_RED, descripcion: DESCRIPCION_SIN_RED },
          },
        ],
      },
    ],
  }),
  guiaDePrueba('guia-sin-conexion', 'Registrar a una persona de prueba sin red', {
    descripcion: 'Usa esta guía cuando necesites registrar a una persona sin red.',
    requisitos: ['Datos de la persona de prueba.'],
    // Tarea 308: con comprobación final, para volver desde ella sin red.
    verificacionFinal: ['La persona de prueba aparece registrada sin red.'],
    pasos: [
      { id: 'gsc-p1', titulo: 'Entrar al programa', subArticuloId: 'acceso-sin-conexion', subArticuloTitulo: 'Entrar al programa de prueba sin red' },
      { id: 'gsc-p2', titulo: 'Guardar', bloques: [{ id: 'gsc-p2-t1', tipo: 'tarea', texto: 'Selecciona Guardar' }] },
    ],
  }),
]
const SEMBRAR_GUIAS_PRUEBA = `
  const base = await new Promise((ok, mal) => {
    const r = indexedDB.open('soluciones-it')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })
  await new Promise((ok, mal) => {
    const t = base.transaction(['articulos', 'categorias'], 'readwrite')
    t.objectStore('categorias').put(${JSON.stringify(CATEGORIA_PRUEBA)})
    for (const guia of ${JSON.stringify(GUIAS_PRUEBA)}) t.objectStore('articulos').put(guia)
    t.oncomplete = () => ok()
    t.onerror = () => mal(t.error)
  })
  base.close()
  // La imagen de "Debes ver", en la copia sin conexión de los adjuntos, con
  // la misma clave que usa la app (src/lib/adjuntosOffline.ts, claveDe).
  const copia = await caches.open('adjuntos-offline-v1')
  await copia.put(
    'https://adjuntos-offline.local/' + encodeURIComponent(${JSON.stringify(IMAGEN_SIN_RED.referencia)}),
    new Response(new Blob([${JSON.stringify(SVG_SIN_RED)}], { type: 'image/svg+xml' }), { headers: { 'Content-Type': 'image/svg+xml' } }),
  )
  return true
`
// Tarea 290: la credencial del equipo con el que se trabaja, sin red. Dos
// equipos, una credencial relacionada con uno de ellos y una guía que pide
// "la credencial del equipo actual", inventados y escritos directo en la
// base local; el perfil con permiso de Bóveda, como lo deja la app al
// iniciar sesión. Lo "cifrado" es un texto falso: sin la contraseña
// maestra nada se descifra, y eso es justo lo que se comprueba.
const PERFIL_SIN_RED = { id: '00000000-0000-4000-8000-0000000000aa', nombre: 'Técnica sin red', correo: 'sin-red@local', puedeVerBoveda: true }
function equipoDePrueba(id, nombre) {
  return { id, categoriaId: 'cat-sin-conexion', nombre, marca: '', modelo: '', serial: '', placaInventario: '', ubicacion: '', ubicacionId: null, responsable: '', responsableId: null, reemplazaA: null, ip: '', estado: '', observaciones: '', detalles: {}, foto: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}
const EQUIPOS_SIN_RED = [equipoDePrueba('eq-sin-red-a', 'Impresora de prueba sin red A'), equipoDePrueba('eq-sin-red-b', 'Impresora de prueba sin red B')]
const CIFRADO_FALSO = 'cifrado-falso-que-no-se-descifra-sin-red'
const CREDENCIAL_SIN_RED = { id: 'cred-sin-red', titulo: 'Acceso de prueba sin red', categoria: 'Pruebas', tipo: 'cuenta', datosCifrados: CIFRADO_FALSO, venceEn: null, dispositivos: [{ id: 'eq-sin-red-a', nombre: 'Impresora de prueba sin red A' }], archivo: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
const GUIA_DEL_EQUIPO = guiaDePrueba('guia-equipo-sin-red', 'Revisar la impresora de prueba sin red', {
  pasos: [{ id: 'ges-p1', titulo: 'Entrar al panel', bloques: [{ id: 'ges-p1-t1', tipo: 'tarea', texto: 'Entra al panel de la impresora sin red', vinculoProtegido: { tipo: 'equipo', finalidad: '' } }] }],
})
const SEMBRAR_EQUIPO_PRUEBA = `
  const base = await new Promise((ok, mal) => {
    const r = indexedDB.open('soluciones-it')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })
  await new Promise((ok, mal) => {
    const t = base.transaction(['perfiles', 'dispositivos', 'credenciales', 'articulos'], 'readwrite')
    t.objectStore('perfiles').put(${JSON.stringify(PERFIL_SIN_RED)})
    for (const equipo of ${JSON.stringify(EQUIPOS_SIN_RED)}) t.objectStore('dispositivos').put(equipo)
    t.objectStore('credenciales').put(${JSON.stringify(CREDENCIAL_SIN_RED)})
    t.objectStore('articulos').put(${JSON.stringify(GUIA_DEL_EQUIPO)})
    t.oncomplete = () => ok()
    t.onerror = () => mal(t.error)
  })
  base.close()
  return true
`
const AVISO_DISPOSITIVO = 'No se pudo usar el desbloqueo del dispositivo.'

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

    // Tarea 289: la ejecución de una guía no pide nada a la red. Orientar,
    // preparar (solo con los requisitos que escribió su autor: los de la
    // guía que reutiliza su paso 1 no pasan solos) y hacer en el sitio lo
    // reutilizado sale todo de la base local.
    paso('4b. Una guía que reutiliza otra, sin red: orientar, preparar y la primera acción reutilizada (tarea 289)')
    comprobar(Boolean(await s.evaluar(SEMBRAR_GUIAS_PRUEBA)), 'guías inventadas escritas en la base local, con la red cortada')
    await s.enviar('Page.navigate', { url: BASE + '/soluciones/cat-sin-conexion/guia-sin-conexion' })
    comprobar(
      // `innerText` devuelve los rótulos como los pinta el CSS (en mayúsculas).
      Boolean(await s.hasta(`/qué vas a hacer/i.test(document.body.innerText) && document.body.innerText.includes('Cuando necesites registrar a una persona sin red.')`, 'la orientación', 45000)),
      'la orientación se ve sin red',
    )
    await s.tocar('Ver lo que necesitas')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Datos de la persona de prueba.')`, 'los requisitos')),
      'los requisitos de la guía',
    )
    comprobar(
      !(await s.evaluar(`return document.body.innerText.includes('Red de prueba sin conexión.')`)),
      'sin los de la guía del paso 1: no pasan solos',
    )
    await s.tocar('Todo listo, empezar')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Abre el programa de prueba sin red')`, 'la primera acción')),
      'la primera acción reutilizada, en el sitio',
    )
    // Tarea 310: "Cómo hacerlo" es una lista numerada a la vista, sin nada
    // que desplegar; la ubicación va bajo su microacción.
    const LISTA_COMO_HACERLO = `[...document.querySelectorAll('ol[aria-labelledby]')].find((ol) => document.getElementById(ol.getAttribute('aria-labelledby'))?.textContent === 'Cómo hacerlo')`
    comprobar(
      Boolean(
        await s.evaluar(
          `const ol = ${LISTA_COMO_HACERLO}; return Boolean(ol) && [...ol.children].map((li) => li.firstElementChild.textContent).join('|') === 'Abre Acceso rápido de prueba.|Pulsa Programa.'`,
        ),
      ),
      'con su "Cómo hacerlo" numerado, cada microacción con su verbo, sin red (tareas 303, 309 y 310)',
    )
    comprobar(
      Boolean(
        await s.evaluar(
          `const ol = ${LISTA_COMO_HACERLO}; return getComputedStyle(ol).listStyleType === 'decimal' && [...ol.children].some((li) => li.innerText.includes('Barra lateral de prueba'))`,
        ),
      ),
      'numerada de verdad y con la ubicación a la vista bajo su microacción',
    )
    comprobar(
      !(await s.evaluar(`return /Ruta rápida|Ver paso a paso/.test(document.body.innerText)`)),
      'sin "Ruta rápida" ni "Ver paso a paso"',
    )
    const IMAGEN_DEBES_VER = `document.querySelector('img[alt="${DESCRIPCION_SIN_RED}"]')`
    comprobar(
      Boolean(
        await s.evaluar(
          `return [...document.querySelectorAll('button[aria-expanded="false"]')].some((b) => b.textContent.trim() === 'Debes ver') && ${IMAGEN_DEBES_VER} == null`,
        ),
      ),
      '"Debes ver" llega plegado y sin cargar la imagen (tarea 307)',
    )
    await s.tocar('Debes ver')
    comprobar(
      Boolean(await s.hasta(`(() => { const i = ${IMAGEN_DEBES_VER}; return i != null && i.complete && i.naturalWidth > 0 })()`, 'la imagen de Debes ver')),
      'y al abrirlo, la imagen sale de la copia sin conexión, sin red',
    )
    comprobar(
      !(await s.evaluar(`return /Dónde:|Más información|Para qué:/.test(document.body.innerText)`)),
      'sin "Dónde", "Más información" ni "Para qué" (tarea 307)',
    )
    comprobar(
      !(await s.evaluar(`return /Guía necesaria|Estás realizando|Abrir guía|Volver a la guía principal|No se pudo cargar/.test(document.body.innerText)`)),
      'sin tarjeta ni cabecera de otra guía, y sin pantalla de error',
    )

    // Tarea 308: la comprobación final es un estado de la ejecución, no su
    // fin. Todo sale de la base local: volver, seguir y finalizar sin red.
    paso('4b2. La comprobación final sin red: "Anterior" vuelve a la última acción y solo "Finalizar" termina (tarea 308)')
    await s.tocar('Completar y seguir')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Selecciona Guardar')`, 'el paso 2')),
      'lo reutilizado se completa y sigue en el paso 2',
    )
    await s.tocar('Completar y seguir')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Antes de terminar, comprueba')`, 'la comprobación final')),
      'la última acción lleva a la comprobación final',
    )
    const TOCAR_ANTERIOR = `
      const b = [...document.querySelectorAll('button')].find((e) => (e.getAttribute('aria-label') || '').startsWith('Anterior'))
      if (!b || b.disabled) return false
      b.click()
      await new Promise((r) => setTimeout(r, 600))
      return true
    `
    comprobar(Boolean(await s.evaluar(TOCAR_ANTERIOR)), '"Anterior" está en la comprobación, activo')
    comprobar(
      Boolean(
        await s.hasta(
          `document.body.innerText.includes('Selecciona Guardar') && !document.body.innerText.includes('Antes de terminar, comprueba')`,
          'la última acción',
        ),
      ),
      'y vuelve a la última acción, sin red',
    )
    await s.tocar('Seguir')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Antes de terminar, comprueba')`, 'otra vez la comprobación')),
      '"Seguir" vuelve a la comprobación',
    )
    await s.evaluar(`document.querySelector('[role="checkbox"]').click(); await new Promise((r) => setTimeout(r, 600)); return true`)
    comprobar(
      !(await s.evaluar(`return document.body.innerText.includes('Guía terminada')`)),
      'marcar la última comprobación no termina la guía',
    )
    await s.tocar('Finalizar')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Guía terminada')`, 'la guía terminada')),
      'solo "Finalizar" la termina, sin red',
    )

    // Tarea 290: la relación equipo y credencial se lee del teléfono, sin
    // red; los datos siguen detrás de la contraseña maestra.
    paso('4c. La credencial del equipo actual, sin red: se resuelve y sigue protegida (tarea 290)')
    comprobar(Boolean(await s.evaluar(SEMBRAR_EQUIPO_PRUEBA)), 'equipos, credencial y guía inventados escritos en la base local, con la red cortada')
    await s.enviar('Page.navigate', { url: BASE + '/soluciones/cat-sin-conexion/guia-equipo-sin-red?equipo=eq-sin-red-a' })
    comprobar(
      Boolean(
        await s.hasta(
          `document.body.innerText.includes('Acceso de prueba sin red') && document.body.innerText.includes('Impresora de prueba sin red A')`,
          'la credencial del equipo',
          45000,
        ),
      ),
      'la acción resuelve la credencial de ese equipo sin red',
    )
    await s.tocar('Acceso de prueba sin red')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('La bóveda está bloqueada')`, 'el desbloqueo')),
      'para ver sus datos sigue pidiendo la contraseña maestra',
    )
    comprobar(
      !(await s.evaluar(`return document.documentElement.outerHTML.includes(${JSON.stringify(CIFRADO_FALSO)})`)),
      'nada de la Bóveda en la página',
    )
    await s.enviar('Page.navigate', { url: BASE + '/soluciones/cat-sin-conexion/guia-equipo-sin-red?equipo=eq-sin-red-b' })
    await s.hasta(`document.body.innerText.includes('Impresora de prueba sin red B')`, 'el otro equipo', 45000)
    await s.tocar('Credencial del equipo')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('No hay una credencial configurada para este equipo.')`, 'sin credencial')),
      'un equipo sin credencial no recibe la de otro',
    )

    // Un autenticador de plataforma VIRTUAL de Chromium (DevTools
    // Protocol, dominio WebAuthn): crea credenciales y firma de verdad, con
    // la verificacion del usuario simulada. No es una huella fisica.
    paso('5. Desbloqueo del dispositivo sin red (autenticador virtual de Chromium)')
    await s.enviar('WebAuthn.enable', { enableUI: false })
    const { authenticatorId } = await s.enviar('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })
    comprobar(Boolean(authenticatorId), 'autenticador de plataforma virtual, con verificación del usuario')
    pagina = await s.ir('/cuenta/seguridad')
    await s.tocar('Contraseña')
    await s.escribirYEnviar(CONTRASENA_BLOQUEO)
    await s.escribirYEnviar(CONTRASENA_BLOQUEO)
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Desbloqueo del dispositivo') && document.body.innerText.includes('Desactivado.')`, 'la opción')),
      'con autenticador de plataforma, Seguridad ofrece el desbloqueo del dispositivo',
    )
    await s.tocar('Activar')
    await s.escribirYEnviar(CONTRASENA_BLOQUEO)
    await s.hasta(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Activar en este dispositivo')`, 'crear')
    await s.tocar('Activar en este dispositivo')
    await s.hasta(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Comprobar')`, 'comprobar')
    await s.tocar('Comprobar')
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Activo en este dispositivo.')`, 'activo')),
      'se activa tras crear la credencial y comprobarla',
    )
    const fila = await s.evaluar(FILA_BLOQUEO)
    const campos = Object.keys(fila?.desbloqueoDispositivo ?? {}).sort().join(',')
    comprobar(
      campos === 'algoritmo,clavePublica,creadoEn,credencialId,respaldable,rpId,usuarioId' &&
        fila.desbloqueoDispositivo.rpId === 'localhost' &&
        !JSON.stringify(fila).includes(CONTRASENA_BLOQUEO),
      `la app guarda solo material público (${campos}; algoritmo ${fila?.desbloqueoDispositivo?.algoritmo})`,
    )
    const { credentials } = await s.enviar('WebAuthn.getCredentials', { authenticatorId })
    comprobar(
      credentials?.length === 1 && credentials[0].rpId === 'localhost' &&
        credentials[0].credentialId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === fila?.desbloqueoDispositivo?.credencialId,
      'la clave privada vive en el autenticador, con la misma credencial que guardó la app',
    )

    await s.enviar('Page.navigate', { url: BASE + '/' })
    comprobar(
      Boolean(await s.hasta(`document.body.innerText.includes('Desbloquea con este dispositivo')`, 'la vía rápida', 45000)),
      'al abrir, la pantalla de bloqueo ofrece primero el dispositivo',
    )
    comprobar(await s.evaluar(`return !(${HAY_APP})`), 'y la app sigue tapada')
    await s.tocar('Desbloquear')
    comprobar(Boolean(await s.hasta(HAY_APP, 'abre')), 'sin red, una firma real del autenticador abre la app')

    await s.enviar('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false })
    await s.enviar('Page.navigate', { url: BASE + '/' })
    await s.hasta(`document.body.innerText.includes('Desbloquea con este dispositivo')`, 'la vía rápida', 45000)
    await s.tocar('Desbloquear')
    const sinUV = await s.hasta(`document.body.innerText.includes(${JSON.stringify(AVISO_DISPOSITIVO)})`, 'el aviso')
    comprobar(Boolean(sinUV) && (await s.evaluar(`return !(${HAY_APP})`)), 'sin verificar al usuario, NO abre: avisa y pasa a la contraseña')
    comprobar(await s.escribirYEnviar(CONTRASENA_BLOQUEO), 'el campo de la contraseña está a la vista')
    comprobar(Boolean(await s.hasta(HAY_APP, 'abre con la contraseña')), 'la contraseña entra igual')

    await s.enviar('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true })
    await s.enviar('WebAuthn.clearCredentials', { authenticatorId })
    await s.enviar('Page.navigate', { url: BASE + '/' })
    await s.hasta(`document.body.innerText.includes('Desbloquea con este dispositivo')`, 'la vía rápida', 45000)
    await s.tocar('Desbloquear')
    const borrada = await s.hasta(`document.body.innerText.includes(${JSON.stringify(AVISO_DISPOSITIVO)})`, 'el aviso')
    comprobar(Boolean(borrada) && (await s.evaluar(`return !(${HAY_APP})`)), 'con la credencial borrada del dispositivo, NO abre: avisa')
    comprobar(await s.escribirYEnviar(CONTRASENA_BLOQUEO), 'el campo de la contraseña está a la vista')
    comprobar(Boolean(await s.hasta(HAY_APP, 'abre con la contraseña')), 'y la contraseña entra igual')

    paso('6. Bloqueo de la app: olvidar el código sin red no deja entrar')
    // El bloqueo (contraseña y desbloqueo del dispositivo) viene del paso 5.
    await s.enviar('Page.navigate', { url: BASE + '/' })
    const bloqueada = await s.hasta(
      `/Desbloquea con este dispositivo|Ingresa tu contraseña de desbloqueo/.test(document.body.innerText)`,
      'pide el código',
      45000,
    )
    comprobar(Boolean(bloqueada), 'con el bloqueo puesto, la app pide desbloquear')
    await s.tocar('¿Olvidaste tu código')
    await s.tocar('Cerrar sesión y quitar el bloqueo')
    await esperar(2500)
    pagina = await s.evaluar(`return { ruta: location.pathname, texto: document.body.innerText }`)
    comprobar(pagina.ruta === '/login', `termina en el inicio de sesión, no dentro de la app (ruta: ${pagina.ruta})`)
    comprobar(!(await s.evaluar(HAY_SESION)), 'la sesión se borró de este teléfono')
    comprobar((await s.evaluar(FILA_BLOQUEO)) === null, 'el bloqueo y su desbloqueo del dispositivo se quitaron')
    pagina = await s.ir('/')
    comprobar(pagina.ruta === '/login', `al recargar sigue fuera (ruta: ${pagina.ruta})`)

    paso('7. "Cerrar sesión" sin red cierra la sesión')
    await s.evaluar(PONER_SESION)
    pagina = await s.ir('/cuenta')
    comprobar(pagina.app, `Ajustes abre con la sesión guardada (${pagina.ms} ms)`)
    await s.tocar('Cerrar sesión')
    await esperar(2500)
    pagina = await s.evaluar(`return { ruta: location.pathname }`)
    comprobar(pagina.ruta === '/login', `termina en el inicio de sesión (ruta: ${pagina.ruta})`)
    comprobar(!(await s.evaluar(HAY_SESION)), 'la sesión se borró de este teléfono')

    // Al final a proposito: con la red cortada por emulacion (la de CDP),
    // Chrome recarga la pantalla "Sin conexion" de un trozo que fallo en
    // vez de dejar salir de ella. Con el servidor apagado y sin emulacion
    // se sale sin problema (comprobado el 2026-09-29): es de la emulacion,
    // no de la app, pero deja inservible cualquier paso que venga detras.
    // Por lo mismo, solo Importar: Etiquetas sale del precache igual y usa
    // la misma pantalla (tarea 259), y quedaria detras del mismo rebote.
    paso('8. Una pantalla fuera del precache dice que necesita red, sin reinstalar nada')
    await s.evaluar(PONER_SESION)
    pagina = await s.abrir('/dispositivos/importar', 4000)
    comprobar(
      pagina.ruta === '/dispositivos/importar' && pagina.texto.includes('Sin conexión') && !/Reinstalar la aplicación/.test(pagina.texto),
      `/dispositivos/importar: "${pagina.texto.split('\n')[0]}"`,
    )
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
