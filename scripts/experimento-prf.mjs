// EXPERIMENTO AISLADO: LA EXTENSION PRF DE WEBAUTHN EN CHROMIUM (tarea 279).
// Solo investigacion; no entra en el build ni toca la Boveda.
//
// Pregunta: ¿la primitiva PRF se comporta como hace falta para envolver
// una clave? Es decir: salida de 32 bytes, estable para la misma
// credencial y la misma entrada (tambien tras perder todo el estado de la
// pagina y sin red), distinta con otra entrada u otra credencial, solo con
// el usuario verificado, y nada sin la credencial. Y la cadena completa:
// PRF -> HKDF-SHA256 -> clave AES-GCM no extraible -> descifrar un blob
// de PRUEBA (32 bytes aleatorios; nunca la clave de la Boveda).
//
// Usa el autenticador de plataforma VIRTUAL de Chromium (DevTools
// Protocol, dominio WebAuthn, con hasPrf): crea claves y evalua el PRF de
// verdad, con la verificacion del usuario simulada. No es una huella, un
// telefono ni Windows Hello: prueba la primitiva y el navegador, no el
// soporte de cada autenticador real.
//
// Las salidas del PRF solo existen en memoria; en consola sale una huella
// SHA-256 corta de cada una, nunca la salida.
//
// Uso: node scripts/experimento-prf.mjs   (fuera de Windows: CHROME=<ruta>)
// Salida: una linea por comprobacion y "EXPERIMENTO PRF: OK" (codigo 0),
// o los fallos (codigo 1).

import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PUERTO = 5189
const PUERTO_CDP = 9395
const BASE = `http://localhost:${PUERTO}`
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PERFIL = join(process.env.TEMP ?? tmpdir(), `cdp-prf-${Date.now()}`)
const REPETICIONES = 100
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

let fallos = 0
function comprobar(condicion, texto) {
  console.log(`   ${condicion ? 'OK   ' : 'FALLO'} ${texto}`)
  if (!condicion) fallos++
}
const paso = (texto) => console.log(`\n== ${texto}`)

let servidor = createServer((_, respuesta) => {
  respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  respuesta.end('<!doctype html><meta charset="utf-8"><title>Experimento PRF</title>')
}).listen(PUERTO)

rmSync(PERFIL, { recursive: true, force: true })
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PUERTO_CDP}`,
  `--user-data-dir=${PERFIL}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
])
let version = null
for (let i = 0; i < 60 && !version; i++) {
  try {
    version = (await (await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`)).json()).Browser
  } catch {
    await esperar(250)
  }
}
const objetivo = await (await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let siguiente = 0
const pendientes = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (pendientes.has(msg.id)) {
    pendientes.get(msg.id)(msg.result ?? msg.error)
    pendientes.delete(msg.id)
  }
})
const enviar = (method, params = {}) =>
  new Promise((r) => {
    const id = ++siguiente
    pendientes.set(id, r)
    ws.send(JSON.stringify({ id, method, params }))
  })
async function evaluar(codigo) {
  const r = await enviar('Runtime.evaluate', {
    expression: `(async () => { ${codigo} })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'error en la página')
  return r.result.value
}
async function abrirPagina() {
  await enviar('Page.navigate', { url: 'about:blank' })
  await esperar(300)
  await enviar('Page.navigate', { url: `${BASE}/` })
  await esperar(700)
}

// Utilidades DENTRO de la pagina. Las credenciales y las entradas viajan
// en base64url (publicas); las salidas del PRF se quedan en la pagina y
// solo sale su huella. `window.__salidas` se pierde al recargar.
const UTIL = `
  const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
  const desde = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0))
  const huella = async (b) => b64(await crypto.subtle.digest('SHA-256', b)).slice(0, 12)
  window.__salidas ??= {}
`

function crear() {
  return evaluar(`
    ${UTIL}
    const c = await navigator.credentials.create({ publicKey: {
      rp: { id: 'localhost', name: 'Experimento PRF' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'prueba', displayName: 'Prueba' },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
      extensions: { prf: { eval: { first: new TextEncoder().encode('prueba-al-crear') } } },
    } })
    const prf = c.getClientExtensionResults().prf ?? null
    return {
      id: b64(c.rawId),
      enabled: prf?.enabled ?? null,
      resultadosAlCrear: prf?.results?.first ? prf.results.first.byteLength : 0,
    }
  `)
}

// Evalua el PRF y guarda la salida (en memoria de la pagina) bajo `nombre`.
function evaluarPrf(nombre, credencial, entrada, opciones = {}) {
  const uv = opciones.uv ?? 'required'
  const segunda = opciones.segunda ? `, second: desde(${JSON.stringify(opciones.segunda)})` : ''
  return evaluar(`
    ${UTIL}
    try {
      const a = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: 'localhost',
        allowCredentials: [{ type: 'public-key', id: desde(${JSON.stringify(credencial)}), transports: ['internal'] }],
        userVerification: '${uv}',
        extensions: { prf: { eval: { first: desde(${JSON.stringify(entrada)})${segunda} } } },
      } })
      const r = a.getClientExtensionResults().prf?.results
      if (!r?.first) return { error: 'sin salida PRF' }
      window.__salidas[${JSON.stringify(nombre)}] = new Uint8Array(r.first)
      if (r.second) window.__salidas[${JSON.stringify(nombre)} + ':2'] = new Uint8Array(r.second)
      const flags = new Uint8Array(a.response.authenticatorData)[32]
      return { largo: r.first.byteLength, huella: await huella(r.first), huella2: r.second ? await huella(r.second) : null, uv: (flags & 4) !== 0 }
    } catch (e) {
      return { error: e.name }
    }
  `)
}

const aleatorio = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')

// PRF -> HKDF-SHA256 (sal fija del formato, info con el proposito) -> clave
// AES-GCM de 256 bits NO extraible. Con ella se cifra o descifra un blob
// de prueba con IV de 96 bits y AAD que identifica el formato.
const KEK = `
  const INFO = new TextEncoder().encode('soluciones-it:boveda-desbloqueo:v1')
  const AAD = new TextEncoder().encode('soluciones-it:boveda-quick-unlock:v1')
  const kek = async (salida) => {
    const base = await crypto.subtle.importKey('raw', salida, 'HKDF', false, ['deriveKey'])
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  }
`

try {
  await enviar('Page.enable')
  await abrirPagina()
  await enviar('WebAuthn.enable', { enableUI: false })
  const { authenticatorId } = await enviar('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      hasPrf: true,
      automaticPresenceSimulation: true,
    },
  })
  console.log(`Navegador: ${version}; autenticador virtual ${authenticatorId ? 'creado' : 'NO creado'}`)

  paso('1. Crear credenciales con PRF')
  const a = await crear()
  const b = await crear()
  comprobar(a.enabled === true && b.enabled === true, `el navegador dice prf.enabled = ${a.enabled} (A) y ${b.enabled} (B)`)
  console.log(`   INFO  salida del PRF al CREAR: ${a.resultadosAlCrear ? `${a.resultadosAlCrear} bytes` : 'ninguna (hace falta una aserción)'}`)
  const capacidades = await evaluar(`return typeof PublicKeyCredential.getClientCapabilities === 'function' ? (await PublicKeyCredential.getClientCapabilities())['extension:prf'] ?? null : 'sin getClientCapabilities'`)
  console.log(`   INFO  getClientCapabilities()['extension:prf'] = ${capacidades} (dice que el NAVEGADOR la conoce, no que el autenticador la cumpla)`)

  const X = aleatorio()
  const Y = aleatorio()

  paso(`2. Misma credencial y misma entrada: ${REPETICIONES} evaluaciones`)
  const primera = await evaluarPrf('A:X', a.id, X)
  comprobar(primera.largo === 32, `salida de ${primera.largo} bytes (huella ${primera.huella})`)
  comprobar(primera.uv === true, 'la aserción trae UV (el dispositivo verificó a la persona)')
  const huellas = new Set([primera.huella])
  let errores = 0
  for (let i = 1; i < REPETICIONES; i++) {
    const r = await evaluarPrf(`A:X:${i}`, a.id, X)
    if (r.error) errores++
    else huellas.add(r.huella)
  }
  comprobar(errores === 0 && huellas.size === 1, `${REPETICIONES} evaluaciones, ${huellas.size} salida distinta, ${errores} errores`)
  const igualesByte = await evaluar(`
    const s = window.__salidas; const base = s['A:X']
    let iguales = 0
    for (let i = 1; i < ${REPETICIONES}; i++) { const o = s['A:X:' + i]; if (o && o.every((v, j) => v === base[j])) iguales++ }
    return iguales
  `)
  comprobar(igualesByte === REPETICIONES - 1, `comparadas byte a byte: ${igualesByte + 1}/${REPETICIONES} idénticas`)

  paso('3. Otra entrada u otra credencial: otra salida')
  const conY = await evaluarPrf('A:Y', a.id, Y)
  comprobar(!conY.error && conY.huella !== primera.huella, `A+Y distinta de A+X (${conY.huella} ≠ ${primera.huella})`)
  const credB = await evaluarPrf('B:X', b.id, X)
  comprobar(!credB.error && credB.huella !== primera.huella, `B+X distinta de A+X (${credB.huella} ≠ ${primera.huella})`)
  const dos = await evaluarPrf('A:XY', a.id, X, { segunda: Y })
  comprobar(dos.huella === primera.huella && dos.huella2 === conY.huella, 'dos entradas en una sola aserción (first y second): coinciden con cada una por separado (sirve para rotar)')

  paso('4. Sin estado: la página se descarta y se vuelve a abrir')
  await evaluar(`
    ${UTIL}
    ${KEK}
    // Blob de PRUEBA: 32 bytes aleatorios envueltos con la clave derivada
    // del PRF (nunca la clave de la Bóveda). Se deja en sessionStorage
    // solo el blob cifrado, como quedaría en la base local.
    const prueba = crypto.getRandomValues(new Uint8Array(32))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await kek(window.__salidas['A:X']), prueba)
    sessionStorage.setItem('blob', JSON.stringify({ iv: b64(iv), datos: b64(cifrado), huella: await huella(prueba) }))
    return true
  `)
  await abrirPagina()
  comprobar(await evaluar(`return window.__salidas === undefined`), 'el estado de la página se perdió (ninguna salida del PRF en memoria)')
  const trasRecargar = await evaluarPrf('A:X:recarga', a.id, X)
  comprobar(trasRecargar.huella === primera.huella, `tras recargar, A+X da la misma salida (${trasRecargar.huella})`)

  paso('5. La cadena completa: PRF -> HKDF -> AES-GCM no extraíble -> blob de prueba')
  const cadena = await evaluar(`
    ${UTIL}
    ${KEK}
    const blob = JSON.parse(sessionStorage.getItem('blob'))
    const abrir = async (salida, aad = AAD, datos = desde(blob.datos)) => {
      try {
        const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desde(blob.iv), additionalData: aad }, await kek(salida), datos)
        return (await huella(claro)) === blob.huella ? 'abre' : 'otro contenido'
      } catch (e) { return e.name }
    }
    const tocado = desde(blob.datos); tocado[0] ^= 1
    const k = await kek(window.__salidas['A:X:recarga'])
    return {
      conA: await abrir(window.__salidas['A:X:recarga']),
      extraible: k.extractable,
      conOtraAAD: await abrir(window.__salidas['A:X:recarga'], new TextEncoder().encode('otro-formato:v1')),
      tocado: await abrir(window.__salidas['A:X:recarga'], AAD, tocado),
    }
  `)
  comprobar(cadena.conA === 'abre', 'con la salida de A+X, el blob de prueba se abre')
  comprobar(cadena.extraible === false, 'la clave derivada del PRF no es extraíble')
  comprobar(cadena.conOtraAAD === 'OperationError', `con otra AAD no abre (${cadena.conOtraAAD})`)
  comprobar(cadena.tocado === 'OperationError', `con un byte tocado no abre (${cadena.tocado})`)
  await evaluarPrf('B:X:recarga', b.id, X)
  await evaluarPrf('A:Y:recarga', a.id, Y)
  const ajenas = await evaluar(`
    ${UTIL}
    ${KEK}
    const blob = JSON.parse(sessionStorage.getItem('blob'))
    const abrir = async (salida) => { try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desde(blob.iv), additionalData: AAD }, await kek(salida), desde(blob.datos)); return 'abre' } catch (e) { return e.name } }
    return { conB: await abrir(window.__salidas['B:X:recarga']), conY: await abrir(window.__salidas['A:Y:recarga']) }
  `)
  comprobar(ajenas.conB === 'OperationError', `con la credencial B no abre (${ajenas.conB})`)
  comprobar(ajenas.conY === 'OperationError', `con otra entrada del PRF no abre (${ajenas.conY})`)

  // Lo que decide entre las opciones B y C del análisis, con Web Crypto y
  // una contraseña y un salt DE PRUEBA (la Bóveda no se toca): la clave de
  // hoy nace con deriveKey(..., extractable: false).
  paso('5b. Web Crypto para las opciones B y C (contraseña de prueba, sin datos reales)')
  const webcrypto = await evaluar(`
    ${UTIL}
    ${KEK}
    const pbkdf2 = { name: 'PBKDF2', salt: crypto.getRandomValues(new Uint8Array(16)), iterations: 1000, hash: 'SHA-256' }
    const material = async (usos) => crypto.subtle.importKey('raw', new TextEncoder().encode('contraseña-de-prueba'), 'PBKDF2', false, usos)
    // Como hoy: no extraíble.
    const deHoy = await crypto.subtle.deriveKey(pbkdf2, await material(['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    // Clave de envoltura derivada del PRF, con los usos de envolver y desenvolver.
    const base = await crypto.subtle.importKey('raw', window.__salidas['A:X:recarga'], 'HKDF', false, ['deriveKey'])
    const k = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'wrapKey', 'unwrapKey'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    let wrapKey
    try { await crypto.subtle.wrapKey('raw', deHoy, k, { name: 'AES-GCM', iv, additionalData: AAD }); wrapKey = 'envolvió' } catch (e) { wrapKey = e.name + ': ' + e.message }
    // Opción C: los mismos bits con deriveBits, en el momento en que se escribe la contraseña.
    const bits = await crypto.subtle.deriveBits(pbkdf2, await material(['deriveBits']), 256)
    const texto = new TextEncoder().encode('secreto de prueba')
    const ivDato = crypto.getRandomValues(new Uint8Array(12))
    const cifradoHoy = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivDato }, deHoy, texto)
    const envuelta = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, k, bits)
    new Uint8Array(bits).fill(0)
    // Desbloqueo rápido: unwrapKey la devuelve NO extraíble sin pasar los bytes por JavaScript.
    const desenvuelta = await crypto.subtle.unwrapKey('raw', envuelta, k, { name: 'AES-GCM', iv, additionalData: AAD }, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivDato }, desenvuelta, cifradoHoy)
    let exportar
    try { await crypto.subtle.exportKey('raw', desenvuelta); exportar = 'exportó' } catch (e) { exportar = e.name }
    return { wrapKey, extraible: desenvuelta.extractable, exportar, mismoSecreto: new TextDecoder().decode(claro) === 'secreto de prueba' }
  `)
  comprobar(webcrypto.wrapKey.startsWith('InvalidAccessError') && /extractable/i.test(webcrypto.wrapKey), `wrapKey sobre una clave como la de hoy (no extraíble): ${webcrypto.wrapKey} (la opción B exigiría hacerla extraíble)`)
  comprobar(webcrypto.mismoSecreto, 'deriveBits con la misma contraseña y salt da la misma clave: lo cifrado con la de hoy se abre con la desenvuelta')
  comprobar(webcrypto.extraible === false && webcrypto.exportar === 'InvalidAccessError', `unwrapKey la devuelve no extraíble (exportKey: ${webcrypto.exportar})`)

  paso('6. Sin red')
  await enviar('Network.enable')
  await enviar('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  // Las conexiones que Chrome deja abiertas (keep-alive) no dejarían cerrar el servidor.
  servidor.closeAllConnections()
  await new Promise((r) => servidor.close(r))
  servidor = null
  const sinRed = await evaluarPrf('A:X:sinred', a.id, X)
  comprobar(sinRed.huella === primera.huella, `sin red y con el servidor apagado, A+X da la misma salida (${sinRed.huella})`)

  paso('7. Sin verificar al usuario')
  await enviar('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false })
  const sinUV = await evaluarPrf('A:X:sinUV', a.id, X)
  comprobar(sinUV.error === 'NotAllowedError', `pidiendo UV y sin verificar: ${sinUV.error ?? 'devolvió una salida'} (ningún secreto)`)
  const desaconsejado = await evaluarPrf('A:X:discouraged', a.id, X, { uv: 'discouraged' })
  console.log(
    `   INFO  con userVerification 'discouraged' y sin verificar: ${desaconsejado.error ? desaconsejado.error : `salida ${desaconsejado.huella}, UV=${desaconsejado.uv}${desaconsejado.huella === primera.huella ? ' (IGUAL a la verificada)' : ' (distinta de la verificada)'}`}`,
  )
  comprobar(
    Boolean(desaconsejado.error) || desaconsejado.huella !== primera.huella,
    'sin verificar al usuario no se obtiene la salida que abre el blob',
  )
  await enviar('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true })

  paso('8. Sin la credencial')
  await enviar('WebAuthn.clearCredentials', { authenticatorId })
  const sinCredencial = await evaluarPrf('A:X:borrada', a.id, X)
  comprobar(sinCredencial.error === 'NotAllowedError', `credencial borrada: ${sinCredencial.error ?? 'devolvió una salida'} (ningún secreto)`)
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
console.log(fallos === 0 ? '\nEXPERIMENTO PRF: OK' : `\nEXPERIMENTO PRF: ${fallos} FALLO(S)`)
process.exit(fallos === 0 ? 0 : 1)
