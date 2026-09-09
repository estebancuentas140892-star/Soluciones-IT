// Capturas de verificacion movil por CDP (solo desarrollo, no entra en el
// build). Levanta Chrome headless, emula 360 / 390 / 430 px con touch y
// recorre las pantallas que el encargo del 2026-09-09 pide comprobar,
// dejando un PNG por recorrido en `evidencia/` (carpeta ignorada por git).
//
// Uso: node scripts/capturas-moviles.mjs [url-base]
// Requiere el servidor de desarrollo levantado con VITE_MODO_PRUEBA_LOCAL=1.

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const SALIDA = 'evidencia'
const PERFIL = join(process.env.TEMP ?? '.', `cdp-capturas-${Date.now()}`)
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PUERTO = 9333

const ANCHOS = [360, 390, 430]

// Cada parada: nombre del archivo, ruta y guion opcional que deja la
// pantalla en el estado que hay que fotografiar.
const PARADAS = [
  { nombre: 'catalogo', ruta: '/soluciones' },
  {
    nombre: 'catalogo-titulo-largo',
    ruta: '/soluciones',
    guion: `const el=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Configurar las paginas'));
            el?.scrollIntoView({block:'center'});`,
  },
  {
    nombre: 'hoja-categorias',
    ruta: '/soluciones',
    guion: `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Categorías'))?.click();`,
  },
  { nombre: 'ficha-con-avance', ruta: '/soluciones/cat-impresoras/art-recurso-compartido' },
  { nombre: 'foco-apoyos-tarea-1', ruta: '/soluciones/cat-impresoras/art-alcance-tarea/ejecutar' },
  {
    nombre: 'foco-apoyos-tarea-2',
    ruta: '/soluciones/cat-impresoras/art-alcance-tarea/ejecutar',
    guion: `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Ver la tarea siguiente'))?.click();`,
  },
  {
    nombre: 'foco-del-paso-desplegado',
    ruta: '/soluciones/cat-impresoras/art-recurso-compartido/ejecutar',
    guion: `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Del paso'))?.click();`,
  },
  { nombre: 'guia-vinculada', ruta: '/soluciones/cat-software/art-alta-usuario/ejecutar' },
  { nombre: 'vinculo-roto', ruta: '/soluciones/cat-software/art-vinculo-roto/ejecutar' },
  {
    nombre: 'decision',
    ruta: '/soluciones/cat-pos/art-decision/ejecutar',
    guion: `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Ver la tarea siguiente'))?.click();`,
  },
  {
    nombre: 'verificacion',
    ruta: '/soluciones/cat-pos/art-decision/ejecutar',
    guion: `const sig=()=>[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Ver la tarea siguiente'));
            sig()?.click(); await new Promise(r=>setTimeout(r,300)); sig()?.click();`,
  },
  { nombre: 'editor-pasos', ruta: '/soluciones/cat-impresoras/art-alcance-tarea/editar', guion: `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pasos')?.click();` },
]

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function json(ruta, metodo = 'GET') {
  const res = await fetch(`http://127.0.0.1:${PUERTO}${ruta}`, { method: metodo })
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
}

async function main() {
  mkdirSync(SALIDA, { recursive: true })
  mkdirSync(PERFIL, { recursive: true })
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PUERTO}`,
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

  // Espera a que el puerto de depuracion responda.
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

  // Primera carga: deja que el banco de pruebas siembre IndexedDB.
  await s.enviar('Page.navigate', { url: `${BASE}/soluciones` })
  await esperar(4000)

  const desbordes = []
  for (const ancho of ANCHOS) {
    await s.enviar('Emulation.setDeviceMetricsOverride', {
      width: ancho,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await s.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    for (const parada of PARADAS) {
      await s.enviar('Page.navigate', { url: BASE + parada.ruta })
      await esperar(2200)
      if (parada.guion) {
        await s.enviar('Runtime.evaluate', {
          expression: `(async () => { ${parada.guion} })()`,
          awaitPromise: true,
        })
        await esperar(1200)
      }
      const medida = await s.enviar('Runtime.evaluate', {
        expression: `JSON.stringify({ancho: innerWidth, scroll: document.documentElement.scrollWidth})`,
        returnByValue: true,
      })
      const { ancho: w, scroll } = JSON.parse(medida.result.value)
      if (scroll > w + 1) desbordes.push(`${ancho}px ${parada.nombre}: scrollWidth ${scroll} > ${w}`)
      const shot = await s.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      writeFileSync(join(SALIDA, `m${ancho}-${parada.nombre}.png`), Buffer.from(shot.data, 'base64'))
      console.log(`ok  ${ancho}px  ${parada.nombre}`)
    }
  }

  console.log(
    desbordes.length === 0
      ? '\nSin desbordamiento horizontal en ningun ancho.'
      : `\nDESBORDES:\n${desbordes.join('\n')}`,
  )
  ws.close()
  chrome.kill()
  await esperar(500)
  try {
    rmSync(PERFIL, { recursive: true, force: true })
  } catch {
    // El perfil temporal a veces queda bloqueado un instante; no importa.
  }
}

main()
