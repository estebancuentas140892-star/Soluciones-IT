// VECTORES REALES DE WEBAUTHN, GENERADOS POR CHROMIUM (tarea 278).
// Solo desarrollo; no entra en el build.
//
// Abre Chrome sin ventana con un autenticador de plataforma VIRTUAL (el del
// DevTools Protocol, dominio WebAuthn: crea claves y firma de verdad, con
// la verificacion del usuario simulada) y guarda lo que el navegador
// devuelve en src/lib/webauthn.vectores-chromium.json: un registro ES256 y
// otro RS256, cada uno con una asercion con el usuario verificado (UV=1) y
// otra sin verificar (UV=0, pedida con userVerification 'discouraged':
// con 'required' Chromium ni siquiera la entrega). La prueba
// src/lib/webauthn.test.ts verifica esos vectores con el codigo de la app:
// una credencial y una firma que no escribio ella.
//
// Todo es publico: claves publicas y firmas sobre desafios aleatorios. La
// clave privada se queda en el autenticador virtual, que se destruye al
// cerrar Chrome.
//
// Uso: node scripts/vectores-webauthn.mjs   (fuera de Windows: CHROME=<ruta>)

import { spawn } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PUERTO = 5187
const PUERTO_CDP = 9391
const ORIGEN = `http://localhost:${PUERTO}`
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PERFIL = join(process.env.TEMP ?? tmpdir(), `cdp-vectores-${Date.now()}`)
const DESTINO = resolve(process.cwd(), 'src/lib/webauthn.vectores-chromium.json')
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const servidor = createServer((_, respuesta) => {
  respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  respuesta.end('<!doctype html><meta charset="utf-8"><title>Vectores WebAuthn</title>')
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

// Base64url en la página, igual que en la app.
const B64 = `const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')`

function registrar(algoritmos) {
  return evaluar(`
    ${B64}
    const desafio = crypto.getRandomValues(new Uint8Array(32))
    const usuario = crypto.getRandomValues(new Uint8Array(16))
    const c = await navigator.credentials.create({ publicKey: {
      rp: { id: 'localhost', name: 'Soluciones IT' },
      user: { id: usuario, name: 'Desbloqueo de Soluciones IT', displayName: 'Soluciones IT' },
      challenge: desafio,
      pubKeyCredParams: ${JSON.stringify(algoritmos)}.map((alg) => ({ type: 'public-key', alg })),
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
    } })
    window.__credencial = c.rawId
    return {
      desafio: b64(desafio),
      usuarioId: b64(usuario),
      rawId: b64(c.rawId),
      clientDataJSON: b64(c.response.clientDataJSON),
      authenticatorData: b64(c.response.getAuthenticatorData()),
      clavePublica: b64(c.response.getPublicKey()),
      algoritmo: c.response.getPublicKeyAlgorithm(),
    }
  `)
}

function asercion(verificacion) {
  return evaluar(`
    ${B64}
    const desafio = crypto.getRandomValues(new Uint8Array(32))
    const a = await navigator.credentials.get({ publicKey: {
      challenge: desafio,
      rpId: 'localhost',
      allowCredentials: [{ type: 'public-key', id: window.__credencial, transports: ['internal'] }],
      userVerification: '${verificacion}',
    } })
    return {
      desafio: b64(desafio),
      rawId: b64(a.rawId),
      clientDataJSON: b64(a.response.clientDataJSON),
      authenticatorData: b64(a.response.authenticatorData),
      signature: b64(a.response.signature),
      userHandle: a.response.userHandle ? b64(a.response.userHandle) : null,
    }
  `)
}

try {
  await enviar('Page.enable')
  await enviar('Page.navigate', { url: `${ORIGEN}/` })
  await esperar(1000)
  await enviar('WebAuthn.enable', { enableUI: false })
  const { authenticatorId } = await enviar('WebAuthn.addVirtualAuthenticator', {
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
  const vectores = { generadoCon: version, origen: ORIGEN, rpId: 'localhost', credenciales: [] }
  for (const algoritmos of [[-7, -257], [-257]]) {
    await enviar('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true })
    const registro = await registrar(algoritmos)
    const conUV = await asercion('required')
    await enviar('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false })
    const sinUV = await asercion('discouraged')
    vectores.credenciales.push({ registro, conUV, sinUV })
    console.log(`algoritmo ${registro.algoritmo}: registro y dos aserciones`)
  }
  writeFileSync(DESTINO, `${JSON.stringify(vectores, null, 2)}\n`)
  console.log(`Vectores de ${version} en ${DESTINO}`)
} finally {
  ws.close()
  chrome.kill()
  servidor.close()
  await esperar(500)
  try {
    rmSync(PERFIL, { recursive: true, force: true })
  } catch {
    // El perfil temporal a veces queda bloqueado un instante; no importa.
  }
}
