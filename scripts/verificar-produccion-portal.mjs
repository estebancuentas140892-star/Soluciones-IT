#!/usr/bin/env node
// VERIFICA EL PORTAL /asistencia EN PRODUCCION (tarea 258, regla 14).
//
// `scripts/verificar-portal.mjs` revisa el build local; esto revisa lo que
// Vercel SIRVE de verdad en https://soluciones-it-psi.vercel.app, porque
// que Vercel diga "Ready" no basta:
//   1. HTTP: /version.json es el commit esperado; /asistencia (con y sin
//      .html, con consulta) sirve el portal y NO el index.html de la app,
//      con sus 7 encabezados exactos (CSP incluida); las rutas de la app no
//      llevan la CSP del portal; los archivos que el portal descarga
//      existen, dicen lo que deben y pasan scripts/verificar-portal.mjs; el
//      service worker no precachea el portal y le deja pasar /asistencia; y
//      /conectar (la pantalla del tecnico) esta en el precache.
//   2. Navegador (Chromium con Playwright): el portal real pide un codigo
//      de 6 cifras con QR y cuenta atras, sin inicio de sesion, sin service
//      worker, sin manifiesto (no ofrece instalar), sin IndexedDB ni
//      localStorage, sin violaciones de CSP y sin hablar con nada mas que
//      las tres funciones del portal; "Terminar la asistencia" lo cierra.
//
// CREA UNA SESION REAL en Supabase (una fila en asistencia_sesiones y los
// eventos "creada" y "cerrada"). Al final imprime el SQL que la borra; hay
// que ejecutarlo (SQL Editor o MCP de Supabase) para no dejar datos de
// prueba. No toca ninguna otra tabla.
//
// Uso: node scripts/verificar-produccion-portal.mjs <sha corto esperado> [carpeta de salida]
//   En una sesion en la nube, con proxy: NODE_USE_ENV_PROXY=1 delante.
//   Necesita Playwright (local o global) con Chromium.
// Para probar el propio guion contra un build servido en local:
//   BASE=http://localhost:4173 SIMULADOR=http://localhost:5199 ...
//   (SIMULADOR = scripts/asistencia-simulada.mjs; con el, el guion ademas
//   conecta un tecnico simulado y comprueba que el envio se dibuja).

import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BASE = process.env.BASE ?? 'https://soluciones-it-psi.vercel.app'
const SIMULADOR = process.env.SIMULADOR ?? null
const SHA = process.argv[2]
const SALIDA = process.argv[3] ?? mkdtempSync(join(tmpdir(), 'portal-'))
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const RPC = 'https://kwwxnmlprdivckqcgjws.supabase.co/rest/v1/rpc/'
const TITULO_ENVIO = 'Prueba de verificación del portal'
const ENCABEZADOS_PORTAL = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src https://kwwxnmlprdivckqcgjws.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-robots-tag': 'noindex, nofollow',
}

if (!SHA) {
  console.error('Falta el commit esperado: node scripts/verificar-produccion-portal.mjs <sha corto>')
  process.exit(2)
}

const fallos = []
const informe = { base: BASE, rutas: {}, portal: {}, sw: {}, navegador: {}, fallos }
function comprobar(condicion, texto) {
  if (condicion) console.log(`  ok: ${texto}`)
  else {
    fallos.push(texto)
    console.log(`  FALLO: ${texto}`)
  }
}

async function traer(ruta) {
  const r = await fetch(BASE + ruta, { redirect: 'manual' })
  const cuerpo = Buffer.from(await r.arrayBuffer())
  return { status: r.status, headers: r.headers, cuerpo, texto: cuerpo.toString('utf8') }
}

function tipoDeHtml(texto) {
  if (texto.includes('<title>Asistencia · Soluciones IT</title>') && /\/assets\/asistencia-[^"]+\.js/.test(texto)) return 'portal'
  if (texto.includes('<title>Soluciones IT</title>') && /\/assets\/index-[^"]+\.js/.test(texto)) return 'app'
  return 'otro'
}

// ---------------------------------------------------------------- HTTP
console.log(`1. Version servida (${BASE})`)
const version = await traer('/version.json')
informe.version = JSON.parse(version.texto)
console.log(`  ${version.texto.replace(/\s+/g, ' ')}`)
comprobar(informe.version.version === SHA, `/version.json = ${SHA}`)

console.log('2. Rutas y encabezados')
const htmlPortal = {}
for (const ruta of ['/asistencia', '/asistencia.html', '/asistencia?origen=qr', '/asistencia/', '/', '/conectar?codigo=123456']) {
  const r = await traer(ruta)
  const tipo = r.status === 200 ? tipoDeHtml(r.texto) : `${r.status} ${r.headers.get('location') ?? ''}`.trim()
  const encabezados = Object.fromEntries(Object.keys(ENCABEZADOS_PORTAL).map((k) => [k, r.headers.get(k)]))
  informe.rutas[ruta] = { status: r.status, tipo, encabezados }
  console.log(`  ${ruta} -> ${r.status} ${tipo}`)
  if (tipo === 'portal') htmlPortal[ruta] = r.texto
}
for (const ruta of ['/asistencia', '/asistencia.html', '/asistencia?origen=qr']) {
  const { tipo, encabezados } = informe.rutas[ruta]
  comprobar(tipo === 'portal', `${ruta} sirve el portal, no el index.html de la app`)
  const distintos = Object.entries(ENCABEZADOS_PORTAL).filter(([k, v]) => encabezados[k] !== v)
  comprobar(distintos.length === 0, `${ruta}: los 7 encabezados exactos${distintos.length ? ` (difieren: ${distintos.map(([k]) => k).join(', ')})` : ''}`)
}
for (const ruta of ['/', '/conectar?codigo=123456']) {
  comprobar(informe.rutas[ruta].tipo === 'app', `${ruta} sirve la app`)
  comprobar(!informe.rutas[ruta].encabezados['content-security-policy'], `${ruta} no lleva la CSP del portal`)
}

console.log('3. Lo que descarga el portal')
const dist = join(SALIDA, 'servido')
mkdirSync(join(dist, 'assets'), { recursive: true })
const html = htmlPortal['/asistencia'] ?? ''
writeFileSync(join(dist, 'asistencia.html'), html)
const pendientes = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1])
const visitados = new Set()
let codigo = ''
while (pendientes.length > 0) {
  const archivo = pendientes.pop()
  if (visitados.has(archivo)) continue
  visitados.add(archivo)
  const r = await traer(`/${archivo}`)
  comprobar(r.status === 200, `/${archivo} responde 200 (${r.cuerpo.length} B)`)
  if (r.status !== 200) continue
  writeFileSync(join(dist, archivo), r.cuerpo)
  if (!archivo.endsWith('.js')) continue
  codigo += `${r.texto}\n`
  for (const [, relativo] of r.texto.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) pendientes.push(`assets/${relativo}`)
}
for (const texto of ['Dale este código al técnico', 'Terminar la asistencia', 'asistencia_crear', 'asistencia_estado', 'asistencia_cerrar_portal', RPC.split('/rest')[0]]) {
  comprobar(codigo.includes(texto), `el portal contiene «${texto}»`)
}
for (const texto of ['serviceWorker.register', 'createClient', '/auth/v1', 'asistencia_conectar', 'asistencia_enviar', 'VITE_ASISTENCIA_SIMULADA_URL']) {
  comprobar(!codigo.includes(texto), `el portal NO contiene «${texto}»`)
}
comprobar(html !== '' && !/rel="manifest"/.test(html), 'el HTML del portal no enlaza el manifiesto')

console.log('4. Service worker de la app')
const sw = await traer('/sw.js')
writeFileSync(join(dist, 'sw.js'), sw.cuerpo)
const precache = [...sw.texto.matchAll(/url:"([^"]+)"/g)].map((m) => m[1])
informe.sw = { entradas: precache.length, denylist: sw.texto.match(/denylist:\[[^\]]*\]/)?.[0] ?? null }
console.log(`  ${precache.length} entradas en el precache; ${informe.sw.denylist}`)
comprobar(!precache.some((u) => /asistencia/.test(u)), 'el precache no contiene nada del portal')
comprobar(/asistencia/.test(informe.sw.denylist ?? ''), 'la navegacion a /asistencia no cae en el index.html del service worker')
const conectar = precache.find((u) => /ConectarPage-/.test(u))
const trozoConectar = conectar ? await traer(`/${conectar}`) : null
comprobar(trozoConectar?.texto.includes('Conectar equipo') ?? false, `la app precachea Conectar equipo (${conectar ?? 'sin trozo'})`)

try {
  execFileSync('node', [join(RAIZ, 'scripts/verificar-portal.mjs'), dist], { stdio: 'inherit' })
} catch {
  comprobar(false, 'scripts/verificar-portal.mjs sobre lo servido')
}

// ----------------------------------------------------------- navegador
console.log('5. El portal en Chromium')
let playwright
try {
  playwright = await import('playwright')
} catch {
  const global = execSync('npm root -g', { encoding: 'utf8' }).trim()
  playwright = await import(pathToFileURL(join(global, 'playwright/index.mjs')).href)
}
const usarProxy = !SIMULADOR && process.env.HTTPS_PROXY
const navegador = await playwright.chromium.launch({ proxy: usarProxy ? { server: process.env.HTTPS_PROXY } : undefined })
const nav = informe.navegador
nav.peticiones = []
nav.consola = []
try {
  const contexto = await navegador.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-CO' })
  await contexto.addInitScript(() => {
    window.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
    window.__instalar = false
    window.addEventListener('beforeinstallprompt', () => (window.__instalar = true))
  })
  if (SIMULADOR) {
    // La CSP se aplica en el navegador antes de interceptar: si connect-src
    // no permitiera Supabase, la peticion no llegaria aqui.
    await contexto.route(`${RPC}**`, async (ruta) => {
      const funcion = new URL(ruta.request().url()).pathname.replace(/^.*\/rpc\//, '')
      const r = await fetch(`${SIMULADOR}/rpc/${funcion}`, { method: 'POST', body: ruta.request().postData() ?? '{}' })
      await ruta.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await r.text() })
    })
  }
  const pagina = await contexto.newPage()
  pagina.on('console', (m) => nav.consola.push(`${m.type()}: ${m.text()}`))
  pagina.on('pageerror', (e) => nav.consola.push(`error: ${e}`))
  pagina.on('request', (r) => nav.peticiones.push(r.url().replace(/\?.*$/, '')))

  const respuesta = await pagina.goto(`${BASE}/asistencia`, { waitUntil: 'load' })
  comprobar(respuesta.status() === 200 && Boolean(respuesta.headers()['content-security-policy']), 'el navegador recibe el portal con su CSP')
  await pagina.getByText('Dale este código al técnico').waitFor({ timeout: 30000 })
  const cifras = (await pagina.locator('p[aria-label^="Código "]').innerText()).replace(/\D/g, '')
  comprobar(/^\d{6}$/.test(cifras), 'el portal genera un código de 6 cifras')
  const qr = await pagina.getByRole('img', { name: 'QR para conectar el teléfono del técnico' }).locator('path').getAttribute('d')
  comprobar((qr?.length ?? 0) > 100, 'el QR se dibuja como SVG')
  comprobar((await pagina.getByText(/El código vence en \d+:\d{2}/).count()) === 1, 'cuenta atrás del código')
  const estado = await pagina.evaluate(async () => ({
    titulo: document.title,
    serviceWorkers: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    manifiesto: Boolean(document.querySelector('link[rel="manifest"]')),
    instalar: window.__instalar,
    indexedDB: indexedDB.databases ? (await indexedDB.databases()).length : 0,
    localStorage: localStorage.length,
    login: document.querySelectorAll('input[type="password"], input[type="email"]').length + (/Iniciar sesión/.test(document.body.innerText) ? 1 : 0),
    id: JSON.parse(sessionStorage.getItem('asistencia:portal') ?? '{}').id ?? null,
  }))
  nav.sesion = estado.id
  comprobar(estado.titulo === 'Asistencia · Soluciones IT', `pestaña «${estado.titulo}»`)
  comprobar(estado.serviceWorkers === 0, 'no registra ningún service worker')
  comprobar(!estado.manifiesto && !estado.instalar, 'no ofrece instalar la app')
  comprobar(estado.indexedDB === 0 && estado.localStorage === 0, 'no guarda nada en IndexedDB ni en localStorage')
  comprobar(estado.login === 0, 'no pide iniciar sesión')
  comprobar(Boolean(estado.id), 'la sesión vive solo en sessionStorage')
  await pagina.screenshot({ path: join(SALIDA, 'portal-esperando.png') })

  if (SIMULADOR) {
    const tecnico = (funcion, cuerpo) =>
      fetch(`${SIMULADOR}/rpc/${funcion}`, { method: 'POST', headers: { 'x-tecnico-prueba': 'verificacion' }, body: JSON.stringify(cuerpo) })
    await tecnico('asistencia_conectar', { p_codigo: cifras })
    await tecnico('asistencia_enviar', {
      p_id: estado.id,
      p_contenido: { v: 1, titulo: TITULO_ENVIO, bloques: [{ tipo: 'comando', texto: 'ipconfig /flushdns', plataforma: 'Windows' }] },
    })
    await pagina.getByText(TITULO_ENVIO).waitFor({ timeout: 30000 })
    comprobar((await pagina.getByRole('button', { name: /Copiar/ }).count()) >= 1, 'el envío del técnico se dibuja con «Copiar»')
    await pagina.screenshot({ path: join(SALIDA, 'portal-conectado.png') })
  }

  await pagina.getByRole('button', { name: 'Terminar la asistencia' }).click()
  await pagina.getByText('Sesión finalizada').waitFor({ timeout: 20000 })
  const final = await pagina.evaluate(() => ({ sesion: sessionStorage.getItem('asistencia:portal'), csp: window.__csp }))
  comprobar(final.sesion === null, '«Terminar la asistencia» cierra y la pestaña olvida la sesión')
  comprobar(final.csp.length === 0, `sin violaciones de CSP${final.csp.length ? `: ${final.csp.join('; ')}` : ''}`)
  const ajenas = nav.peticiones.filter((u) => !u.startsWith(`${BASE}/`) && !u.startsWith(`${RPC}asistencia_`))
  comprobar(ajenas.length === 0, `solo habla con el sitio y con las funciones del portal${ajenas.length ? `: ${ajenas.join(', ')}` : ''}`)
  const errores = nav.consola.filter((l) => l.startsWith('error'))
  comprobar(errores.length === 0, `sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`)
} catch (error) {
  comprobar(false, `el recorrido en el navegador terminó con: ${error.message}`)
} finally {
  await navegador.close()
}

writeFileSync(join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2))
console.log(`\nInforme y capturas en ${SALIDA}`)
if (nav.sesion && !SIMULADOR) {
  console.log('\nBORRAR LA SESION DE PRUEBA (SQL Editor o MCP de Supabase):')
  console.log(`  delete from public.asistencia_eventos where sesion_id = '${nav.sesion}';`)
  console.log(`  delete from public.asistencia_sesiones where id = '${nav.sesion}';`)
}
console.log(fallos.length === 0 ? '\nTODO EN VERDE' : `\n${fallos.length} FALLO(S)`)
process.exit(fallos.length === 0 ? 0 : 1)
