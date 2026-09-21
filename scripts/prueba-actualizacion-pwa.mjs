// PRUEBA DE ACTUALIZACION DE LA PWA, DE VERDAD: VERSION A -> VERSION B
// (encargo del 2026-09-21, punto 8). Solo desarrollo; no entra en el build.
//
// Por que existe: las pruebas unitarias comprueban la logica con un
// service worker de mentira. Lo que fallaba en el telefono no era la
// logica, era el conjunto (service worker real + caches del navegador +
// cabeceras), y eso solo se ve con un navegador que conserve su
// almacenamiento entre dos versiones servidas en el MISMO origen.
//
// Que hace, en orden:
//   1. compila la version A (commit ficticio aaaaaaa) y la B (bbbbbbb);
//   2. sirve A en http://localhost:5180 con las MISMAS cabeceras que
//      pone vercel.json (no-store solo en sw.js, version.json y el
//      manifiesto) y el mismo rewrite a index.html;
//   3. abre Chrome con un perfil PERSISTENTE, espera a que el service
//      worker controle la pagina y guarda datos en localStorage e
//      IndexedDB;
//   4. cambia el servidor a la version B SIN tocar el navegador;
//   5. vuelve a abrir la app (como quien la saca del segundo plano) y
//      comprueba que aparece "Version nueva disponible";
//   6. pulsa "Actualizar", espera la recarga y comprueba que ya corre la
//      version B;
//   7. comprueba que los datos de la version A siguen intactos y que no
//      hay bucle de recargas.
//
// Uso: node scripts/prueba-actualizacion-pwa.mjs
// Salida: "PRUEBA A->B: OK" y codigo 0, o el fallo concreto y codigo 1.

import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

const RAIZ = resolve(process.cwd())
const PUERTO = 5180
const BASE = `http://localhost:${PUERTO}`
const PERFIL = join(process.env.TEMP ?? '.', 'cdp-pwa-persistente')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PUERTO_CDP = 9377
const VERSION_A = 'aaaaaaa'
const VERSION_B = 'bbbbbbb'
const DIR_A = join(RAIZ, 'dist-pwa-a')
const DIR_B = join(RAIZ, 'dist-pwa-b')

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const paso = (texto) => console.log(`\n== ${texto}`)

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

// Las mismas cabeceras que pone vercel.json: no-store SOLO en los
// archivos que controlan la actualizacion.
const SIN_CACHE = /^\/(sw\.js|registerSW\.js|version\.json|manifest\.webmanifest)$/

function compilar(version, salida, relativo) {
  paso(`Compilando la version ${version} en ${relativo}`)
  // El outDir va RELATIVO a proposito: la ruta absoluta de este
  // proyecto tiene espacios y, con `shell: true` en Windows, el
  // argumento se parte por la mitad.
  const resultado = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'build', '--outDir', relativo, '--emptyOutDir'],
    {
      cwd: RAIZ,
      env: { ...process.env, VERCEL_GIT_COMMIT_SHA: version },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  )
  if (resultado.status !== 0) {
    console.error(resultado.stdout, resultado.stderr)
    throw new Error(`La compilacion de ${version} fallo`)
  }
  const anunciada = JSON.parse(readFileSync(join(salida, 'version.json'), 'utf8')).version
  if (anunciada !== version) throw new Error(`version.json dice ${anunciada}, no ${version}`)
  console.log(`   version.json = ${anunciada}`)
}

let raizServida = DIR_A

function servir() {
  return new Promise((listo) => {
    const servidor = createServer((peticion, respuesta) => {
      const url = new URL(peticion.url, BASE)
      let archivo = join(raizServida, url.pathname)
      if (!existsSync(archivo) || url.pathname === '/') archivo = join(raizServida, 'index.html')
      const tipo = TIPOS[extname(archivo)] ?? 'application/octet-stream'
      const cabeceras = { 'Content-Type': tipo }
      cabeceras['Cache-Control'] = SIN_CACHE.test(url.pathname)
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=0, must-revalidate'
      respuesta.writeHead(200, cabeceras)
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
    this.navegaciones = 0
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.method === 'Page.frameNavigated' && !msg.params?.frame?.parentId) this.navegaciones += 1
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
    if (r?.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
    return r?.result?.value
  }
  /** Espera a que la expresion devuelva algo verdadero. */
  async hasta(expresion, que, ms = 30000) {
    const limite = Date.now() + ms
    for (;;) {
      const valor = await this.evaluar(`return (${expresion})`)
      if (valor) return valor
      if (Date.now() > limite) throw new Error(`No llego a pasar: ${que}`)
      await esperar(500)
    }
  }
}

async function main() {
  compilar(VERSION_A, DIR_A, 'dist-pwa-a')
  compilar(VERSION_B, DIR_B, 'dist-pwa-b')

  const servidor = await servir()
  paso(`Sirviendo la version A en ${BASE}`)

  // Perfil PERSISTENTE y limpio al empezar: la prueba tiene que partir
  // de un navegador sin la app, instalarla, y solo despues actualizar.
  rmSync(PERFIL, { recursive: true, force: true })
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PUERTO_CDP}`,
    `--user-data-dir=${PERFIL}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
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

  const objetivo = await json(`/json/new?${encodeURIComponent(BASE)}`, 'PUT')
  const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const s = new Sesion(ws)
  await s.enviar('Page.enable')
  await s.enviar('Runtime.enable')

  try {
    paso('1. La version A queda instalada y controlando la pagina')
    await s.enviar('Page.navigate', { url: BASE })
    await esperar(4000)
    await s.hasta(`(await navigator.serviceWorker.getRegistration('/')) != null`, 'el service worker se registra')
    // El primer worker no controla la pagina que lo instalo: se recarga
    // una vez, como hace cualquier PWA recien instalada.
    await s.enviar('Page.navigate', { url: BASE })
    await esperar(3000)
    await s.hasta('navigator.serviceWorker.controller != null', 'el worker toma el control')
    const scriptA = await s.evaluar(`return document.querySelector('script[type=module]').src`)
    console.log('   script de la version A:', scriptA)

    paso('2. Datos del tecnico guardados con la version A')
    await s.evaluar(`
      localStorage.setItem('prueba_pwa', 'dato de la version A')
      await new Promise((listo, fallo) => {
        const peticion = indexedDB.open('prueba-pwa', 1)
        peticion.onupgradeneeded = () => peticion.result.createObjectStore('cosas')
        peticion.onsuccess = () => {
          const tx = peticion.result.transaction('cosas', 'readwrite')
          tx.objectStore('cosas').put({ avance: 'paso 3 de 7' }, 'guia')
          tx.oncomplete = () => listo()
          tx.onerror = () => fallo(tx.error)
        }
        peticion.onerror = () => fallo(peticion.error)
      })
      return 'ok'
    `)
    const versionVistaA = await s.evaluar(
      `const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' }); return (await r.json()).version`,
    )
    if (versionVistaA !== VERSION_A) throw new Error(`La app ve ${versionVistaA}, no ${VERSION_A}`)
    console.log('   version.json que ve la app:', versionVistaA)

    paso('3. El servidor pasa a la version B (el navegador no se toca)')
    raizServida = DIR_B
    const versionVistaB = await s.evaluar(
      `const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' }); return (await r.json()).version`,
    )
    if (versionVistaB !== VERSION_B) throw new Error(`Tras el cambio la app ve ${versionVistaB}`)
    console.log('   version.json que ve la app ahora:', versionVistaB)

    paso('4. Se vuelve a abrir la app: tiene que avisar de la version nueva')
    const navegacionesAntes = s.navegaciones
    await s.enviar('Page.navigate', { url: BASE })
    await esperar(3000)
    // La pagina la sirve el service worker VIEJO (index.html precacheado),
    // asi que sigue siendo la version A: es exactamente el caso del
    // telefono. Y aun asi tiene que enterarse.
    const scriptTrasCambio = await s.evaluar(`return document.querySelector('script[type=module]').src`)
    console.log('   script que sirve el worker viejo:', scriptTrasCambio)
    await s.hasta(
      `document.body.innerText.includes('Versión nueva disponible')`,
      'aparece el aviso "Versión nueva disponible"',
      45000,
    )
    console.log('   aviso "Version nueva disponible": SI')

    paso('5. "Actualizar": activa el worker nuevo y recarga una sola vez')
    await s.evaluar(`
      const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Actualizar')
      if (!boton) throw new Error('no hay boton Actualizar')
      boton.click()
      return 'ok'
    `)
    await s.hasta(
      `document.querySelector('script[type=module]').src !== ${JSON.stringify(scriptTrasCambio)}`,
      'la pagina pasa a la version B',
      45000,
    )
    const scriptB = await s.evaluar(`return document.querySelector('script[type=module]').src`)
    console.log('   script de la version B:', scriptB)

    paso('6. Los datos de la version A siguen ahi')
    const datos = await s.evaluar(`
      const local = localStorage.getItem('prueba_pwa')
      const guardado = await new Promise((listo) => {
        const peticion = indexedDB.open('prueba-pwa', 1)
        peticion.onsuccess = () => {
          const tx = peticion.result.transaction('cosas', 'readonly')
          const lectura = tx.objectStore('cosas').get('guia')
          lectura.onsuccess = () => listo(lectura.result)
          lectura.onerror = () => listo(null)
        }
        peticion.onerror = () => listo(null)
      })
      return JSON.stringify({ local, guardado })
    `)
    console.log('   datos tras actualizar:', datos)
    const { local, guardado } = JSON.parse(datos)
    if (local !== 'dato de la version A') throw new Error('se perdio el localStorage')
    if (!guardado || guardado.avance !== 'paso 3 de 7') throw new Error('se perdio IndexedDB')

    paso('7. Sin bucle de recargas')
    const trasActualizar = s.navegaciones
    await esperar(8000)
    const extra = s.navegaciones - trasActualizar
    console.log(`   navegaciones desde el aviso: ${s.navegaciones - navegacionesAntes}, nuevas tras 8 s: ${extra}`)
    if (extra > 0) throw new Error('la pagina se sigue recargando sola')

    console.log('\nPRUEBA A->B: OK')
  } finally {
    ws.close()
    chrome.kill()
    servidor.close()
  }
}

main().catch((e) => {
  console.error('\nPRUEBA A->B: FALLO\n', e.message)
  process.exit(1)
})
