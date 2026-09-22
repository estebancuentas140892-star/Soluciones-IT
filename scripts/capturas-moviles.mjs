// Capturas de verificacion por CDP (solo desarrollo, no entra en el
// build). Levanta Chrome headless, emula cada tamaño (con touch por debajo
// de 768 px) y recorre las pantallas, dejando en `evidencia/` (carpeta
// ignorada por git) DOS PNG por parada: la pantalla tal como se abre
// (`-arriba`) y el final del scroll, que es donde se hace la auditoria.
//
// Uso:
//   node scripts/capturas-moviles.mjs [url-base] [--tamanos=390x844,1366x768] [--paradas=resolver,mas]
//
// Por defecto, los cuatro tamaños del encargo del 2026-09-22 (seccion 26):
// telefono 390x844, tableta 768x1024, portatil 1366x768 y escritorio
// 1920x1080. `--paradas` filtra por prefijo de nombre.
// Requiere el servidor de desarrollo levantado con VITE_MODO_PRUEBA_LOCAL=1.

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const argumentos = process.argv.slice(2)
const opcion = (nombre) => argumentos.find((a) => a.startsWith(`--${nombre}=`))?.split('=')[1]
const BASE = argumentos.find((a) => !a.startsWith('--')) ?? 'http://localhost:5173'
const SALIDA = 'evidencia'
const PERFIL = join(process.env.TEMP ?? '.', `cdp-capturas-${Date.now()}`)
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PUERTO = 9333

const TAMANOS = (opcion('tamanos') ?? '390x844,768x1024,1366x768,1920x1080').split(',').map((t) => {
  const [ancho, alto] = t.split('x').map(Number)
  return { ancho, alto }
})
const FILTRO_PARADAS = opcion('paradas')?.split(',') ?? null

// Recorridos del encargo del 2026-09-17 ("resolver rápido con guías"):
// abrir una guía entra a su paso pendiente (ya no hay `/ejecutar` ni
// ficha por delante), los avisos acompañan a su acción y la navegación
// del teléfono es Inicio, Guías y Más.
const tocar = (texto) =>
  `const el=[...document.querySelectorAll('button, a')].find(b=>((b.getAttribute('aria-label')||b.textContent||'').replace(/\\s+/g,' ').trim()).startsWith(${JSON.stringify(texto)})); el?.click(); await new Promise(r=>setTimeout(r,500));`
const siguiente = `const s=[...document.querySelectorAll('button')].find(b=>b.textContent.replace(/\\s+/g,' ').trim()==='Siguiente'); s?.click(); await new Promise(r=>setTimeout(r,500));`

const TODAS_LAS_PARADAS = [
  // Encargo del 2026-09-22: Resolver, Equipos, Bóveda y Más.
  { nombre: 'resolver', ruta: '/' },
  { nombre: 'resolver-buscando', ruta: '/', guion: `const c=document.querySelector('input[type=search]'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(c,'caja'); c.dispatchEvent(new Event('input',{bubbles:true}));` },
  { nombre: 'boveda', ruta: '/boveda' },
  { nombre: 'red', ruta: '/red' },
  { nombre: 'catalogo', ruta: '/soluciones' },
  {
    nombre: 'catalogo-titulo-largo',
    ruta: '/soluciones',
    guion: `const el=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Configurar las paginas'));
            el?.scrollIntoView({block:'center'});`,
  },
  { nombre: 'mas', ruta: '/mas' },
  { nombre: 'equipos', ruta: '/dispositivos' },
  { nombre: 'agenda', ruta: '/agenda' },
  { nombre: 'guia-paso-1-con-requisitos', ruta: '/soluciones/cat-pos/art-tonos' },
  { nombre: 'guia-dato-y-plegado', ruta: '/soluciones/cat-pos/art-tonos', guion: siguiente },
  { nombre: 'guia-mas-informacion', ruta: '/soluciones/cat-pos/art-tonos', guion: siguiente + tocar('Más información') },
  { nombre: 'guia-alerta-importante', ruta: '/soluciones/cat-pos/art-tonos', guion: siguiente + siguiente },
  { nombre: 'guia-retomada', ruta: '/soluciones/cat-impresoras/art-recurso-compartido' },
  { nombre: 'guia-apoyos-tarea-1', ruta: '/soluciones/cat-impresoras/art-alcance-tarea' },
  { nombre: 'guia-apoyos-tarea-2', ruta: '/soluciones/cat-impresoras/art-alcance-tarea', guion: siguiente },
  { nombre: 'guia-indice', ruta: '/soluciones/cat-impresoras/art-alcance-tarea', guion: tocar('Paso 1 de 2. Abrir el índice') },
  { nombre: 'guia-vinculada', ruta: '/soluciones/cat-software/art-alta-usuario' },
  { nombre: 'vinculo-roto', ruta: '/soluciones/cat-software/art-vinculo-roto' },
  { nombre: 'decision', ruta: '/soluciones/cat-pos/art-decision', guion: siguiente },
  { nombre: 'problema', ruta: '/soluciones/cat-pos/art-decision', guion: tocar('Tengo un problema') },
  { nombre: 'detalles', ruta: '/soluciones/cat-impresoras/art-recurso-compartido/detalles' },
  { nombre: 'editor-pasos', ruta: '/soluciones/cat-impresoras/art-alcance-tarea/editar', guion: `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pasos')?.click();` },
]

const PARADAS = FILTRO_PARADAS
  ? TODAS_LAS_PARADAS.filter((p) => FILTRO_PARADAS.some((f) => p.nombre.startsWith(f)))
  : TODAS_LAS_PARADAS


// AUDITORIA EN LA PAGINA (cambio 4 del encargo del 2026-09-09). Busca
// lo que una captura no delata sola: texto recortado por overflow, un
// control tapado por una barra fija, y areas tactiles por debajo de los
// 44 px que pide la regla R6.
const AUDITORIA = `JSON.stringify((() => {
  const hallazgos = []
  const vw = innerWidth
  const vh = innerHeight
  const visible = (el) => {
    const e = getComputedStyle(el)
    if (e.display === 'none' || e.visibility === 'hidden' || e.opacity === '0') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh
  }
  const nombre = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 46) || el.tagName

  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue
    const e = getComputedStyle(el)
    const recorta = e.overflowX === 'hidden' || e.textOverflow === 'ellipsis'
    if (!recorta) continue
    // El texto solo para lectores de pantalla se recorta a proposito.
    if (el.classList.contains('sr-only')) continue
    if (el.scrollWidth > el.clientWidth + 2 && el.children.length === 0) {
      hallazgos.push('texto recortado: ' + nombre(el))
    }
  }

  const barras = [...document.querySelectorAll('*')].filter((el) => {
    const e = getComputedStyle(el)
    if (e.position !== 'fixed' && e.position !== 'sticky') return false
    if (!visible(el)) return false
    const r = el.getBoundingClientRect()
    return r.bottom > vh - 4 && r.top > vh / 2
  })
  const controles = [...document.querySelectorAll('button, a, input, [role=checkbox]')].filter(visible)
  for (const barra of barras) {
    const rb = barra.getBoundingClientRect()
    for (const c of controles) {
      if (barra.contains(c) || c.contains(barra)) continue
      const rc = c.getBoundingClientRect()
      const solapa = rc.bottom > rb.top + 2 && rc.top < rb.bottom - 2 && rc.right > rb.left && rc.left < rb.right
      if (solapa) hallazgos.push('control tapado por barra fija: ' + nombre(c))
    }
  }

  for (const c of controles) {
    const r = c.getBoundingClientRect()
    if (r.height < 43.5 || r.width < 24) {
      hallazgos.push('area tactil ' + Math.round(r.width) + 'x' + Math.round(r.height) + ': ' + nombre(c))
    }
  }

  return {
    ancho: vw,
    scroll: document.documentElement.scrollWidth,
    desborde: document.documentElement.scrollWidth > vw + 1,
    hallazgos: [...new Set(hallazgos)],
  }
})())`

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
  const hallazgos = []
  for (const { ancho, alto } of TAMANOS) {
    const movil = ancho < 768
    await s.enviar('Emulation.setDeviceMetricsOverride', {
      width: ancho,
      height: alto,
      deviceScaleFactor: movil ? 2 : 1,
      mobile: movil,
    })
    await s.enviar('Emulation.setTouchEmulationEnabled', { enabled: movil, maxTouchPoints: movil ? 5 : 0 })
    const etiqueta = `${ancho}x${alto}`
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
      // Como se abre: es lo que el tecnico ve primero.
      const arriba = await s.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      writeFileSync(join(SALIDA, `${etiqueta}-${parada.nombre}-arriba.png`), Buffer.from(arriba.data, 'base64'))
      // La auditoria se hace AL FINAL DEL SCROLL: un control que
      // se cruza con la barra fija a mitad de recorrido es scroll
      // normal, no un defecto. Lo que hay que cazar es lo que
      // sigue tapado cuando ya no queda nada por bajar.
      await s.enviar('Runtime.evaluate', {
        expression: 'window.scrollTo(0, document.documentElement.scrollHeight)',
      })
      await esperar(600)
      const medida = await s.enviar('Runtime.evaluate', { expression: AUDITORIA, returnByValue: true })
      const informe = JSON.parse(medida.result.value)
      if (informe.desborde) {
        desbordes.push(`${etiqueta} ${parada.nombre}: scrollWidth ${informe.scroll} > ${informe.ancho}`)
      }
      for (const h of informe.hallazgos) hallazgos.push(`${etiqueta} ${parada.nombre}: ${h}`)
      const shot = await s.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      writeFileSync(join(SALIDA, `${etiqueta}-${parada.nombre}.png`), Buffer.from(shot.data, 'base64'))
      console.log(`ok  ${etiqueta}  ${parada.nombre}`)
    }
  }

  console.log(
    desbordes.length === 0
      ? '\nSin desbordamiento horizontal en ningun ancho.'
      : `\nDESBORDES:\n${desbordes.join('\n')}`,
  )
  if (hallazgos.length === 0) {
    console.log('Sin texto recortado, controles tapados ni areas tactiles por debajo de 44 px.')
  } else {
    console.log('HALLAZGOS (' + hallazgos.length + '):')
    for (const h of hallazgos) console.log('  ' + h)
  }
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
