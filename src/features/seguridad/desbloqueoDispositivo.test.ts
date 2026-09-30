import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cifrarTexto, derivarClave, nuevaSal } from '../../lib/crypto'
import { db, ID_BLOQUEO_APP, type ConfigBloqueoApp, type MetodoBloqueoApp } from '../../lib/db'
import { ES256, RS256 } from '../../lib/webauthn'
import { AutenticadorFalso, HOST_PRUEBA, instalarAutenticador, ORIGEN_PRUEBA, type Alteracion } from '../../pruebas/autenticadorFalso'
import {
  bloquearApp,
  bloqueoAppConfigurado,
  bloqueoAppDesbloqueado,
  cambiarBloqueoApp,
  completarDesbloqueoDispositivo,
  confirmacionVigente,
  confirmarBloqueoActual,
  crearDesbloqueoDispositivo,
  desactivarDesbloqueoDispositivo,
  desbloquearApp,
  desbloquearAppConDispositivo,
  probarDesbloqueoDispositivo,
  quitarBloqueoApp,
  restablecerBloqueoApp,
  TEXTO_VERIFICADOR_APP,
} from './bloqueoApp'
import {
  comprobarCredencial,
  crearCredencial,
  desbloqueoDispositivoDisponible,
  type EntornoWebAuthn,
} from './desbloqueoDispositivo'

// DESBLOQUEO DEL DISPOSITIVO DE PRINCIPIO A FIN, CON UN AUTENTICADOR QUE
// FIRMA DE VERDAD (tarea 278). Lo que se comprueba no es que se llame a
// `navigator.credentials`, sino que la app SOLO se abre con una firma
// correcta de la credencial registrada, sobre el desafío de esa ceremonia,
// desde el origen y el RP ID de la app y con el usuario verificado; que
// cancelar o fallar deja el patrón o la contraseña intactos; y que todo
// funciona sin red.
//
// Todo lo que se siembra es INVENTADO.

const CONTRASENA = 'clave-de-prueba'
const PATRON = '0-1-2-5'

// Iteraciones bajas SOLO aquí (como `montaje.ts` con la Bóveda): el
// verificador lleva las suyas dentro, así que se comprueba con el mismo
// código de producción sin tardar un segundo por prueba.
async function sembrarBloqueo(metodo: MetodoBloqueoApp, secreto: string, extra: Partial<ConfigBloqueoApp> = {}) {
  const sal = nuevaSal()
  const clave = await derivarClave(secreto, sal, 1_000)
  await db.seguridadApp.put({
    id: ID_BLOQUEO_APP,
    metodo,
    verificador: await cifrarTexto(clave, sal, 1_000, TEXTO_VERIFICADOR_APP),
    minutosAutobloqueo: 15,
    bloqueadoHasta: null,
    updatedAt: '2026-09-29T12:00:00.000Z',
    ...extra,
  })
}

function entornoCon(autenticador: AutenticadorFalso, cambios: Partial<EntornoWebAuthn> = {}): EntornoWebAuthn {
  class RespuestaAtestacion {}
  Object.assign(RespuestaAtestacion.prototype, { getPublicKey() {}, getPublicKeyAlgorithm() {}, getAuthenticatorData() {} })
  return {
    credenciales: {
      create: (o?: CredentialCreationOptions) => autenticador.create(o ?? {}),
      get: (o?: CredentialRequestOptions) => autenticador.get(o ?? {}),
    },
    PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true },
    AuthenticatorAttestationResponse: RespuestaAtestacion,
    origen: ORIGEN_PRUEBA,
    host: HOST_PRUEBA,
    contextoSeguro: true,
    nivelSuperior: true,
    ...cambios,
  }
}

/** Activa el desbloqueo del dispositivo como lo hace la pantalla: confirmar, crear, comprobar. */
async function activar(secreto: string): Promise<void> {
  expect(await confirmarBloqueoActual(secreto)).toBeNull()
  const creada = await crearDesbloqueoDispositivo()
  if (!creada.ok) throw new Error(`No se creó: ${creada.motivo}`)
  expect(await completarDesbloqueoDispositivo(creada.pendiente)).toBe('ok')
}

let autenticador: AutenticadorFalso

beforeEach(async () => {
  await restablecerBloqueoApp()
  await db.seguridadApp.clear()
  autenticador = new AutenticadorFalso({ origen: ORIGEN_PRUEBA })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('¿se puede ofrecer aquí?', () => {
  it('sí, con contexto seguro, ventana principal, getPublicKey y autenticador de plataforma', async () => {
    expect(await desbloqueoDispositivoDisponible(entornoCon(autenticador))).toBe(true)
  })

  it('no, si falta cualquiera de esas cosas', async () => {
    const sinGetPublicKey = { prototype: {} }
    const casos: Array<Partial<EntornoWebAuthn>> = [
      { contextoSeguro: false },
      { nivelSuperior: false },
      { credenciales: undefined },
      { PublicKeyCredential: undefined },
      { PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => false } },
      {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('sin permiso')),
        },
      },
      { AuthenticatorAttestationResponse: sinGetPublicKey },
      { AuthenticatorAttestationResponse: undefined },
    ]
    for (const cambios of casos) {
      expect(await desbloqueoDispositivoDisponible(entornoCon(autenticador, cambios))).toBe(false)
    }
  })

  it('sin soporte no se llama al autenticador', async () => {
    const entorno = entornoCon(autenticador, {
      PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => false },
    })
    expect(await crearCredencial(entorno)).toEqual({ ok: false, motivo: 'no-disponible' })
    expect(autenticador.llamadas.create).toHaveLength(0)
  })
})

describe('registro', () => {
  it('pide autenticador de plataforma, usuario verificado, sin atestación, ES256 y RS256, desafío de 32 bytes', async () => {
    const creada = await crearCredencial(entornoCon(autenticador))
    expect(creada.ok).toBe(true)
    const pk = autenticador.llamadas.create[0].publicKey!
    expect(pk.authenticatorSelection).toMatchObject({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'discouraged',
    })
    expect(pk.attestation).toBe('none')
    expect(pk.pubKeyCredParams.map((p) => p.alg)).toEqual([ES256, RS256])
    expect(pk.rp.id).toBe(HOST_PRUEBA)
    expect((pk.challenge as Uint8Array).byteLength).toBe(32)
    expect((pk.user.id as Uint8Array).byteLength).toBe(16)
    expect(pk.extensions).toBeUndefined()
    if (creada.ok) {
      expect(creada.valor).toMatchObject({ algoritmo: ES256, rpId: HOST_PRUEBA, respaldable: false })
      expect([...autenticador.credenciales.keys()]).toEqual([creada.valor.credencialId])
    }
  })

  it('con RS256 (Windows Hello) también', async () => {
    autenticador.algoritmo = RS256
    const creada = await crearCredencial(entornoCon(autenticador))
    expect(creada.ok && creada.valor.algoritmo).toBe(RS256)
  })

  const alteraciones: Array<[string, Alteracion]> = [
    ['otro origen', { origen: 'https://otro.test' }],
    ['otro desafío', { desafio: 'AAAA' }],
    ['otro tipo de ceremonia', { tipo: 'webauthn.get' }],
    ['otro RP ID', { rpId: 'otro.test' }],
    ['sin verificar al usuario', { sinUV: true }],
    ['una credencial distinta de la declarada', { otroId: true }],
    ['desde un iframe de otro origen', { crossOrigin: true }],
  ]
  it.each(alteraciones)('rechaza una respuesta con %s', async (_, alteracion) => {
    autenticador.alterarSiguiente = alteracion
    expect(await crearCredencial(entornoCon(autenticador))).toEqual({ ok: false, motivo: 'rechazado' })
  })

  it('cancelar o un error del navegador no es un registro', async () => {
    for (const [nombre, motivo] of [
      ['NotAllowedError', 'cancelado'],
      ['AbortError', 'cancelado'],
      ['InvalidStateError', 'fallo'],
      ['NotSupportedError', 'no-disponible'],
      ['SecurityError', 'no-disponible'],
    ] as const) {
      autenticador.errorSiguiente = nombre
      expect(await crearCredencial(entornoCon(autenticador))).toEqual({ ok: false, motivo })
    }
  })
})

describe('desbloqueo: solo una firma correcta abre', () => {
  async function registrada() {
    const creada = await crearCredencial(entornoCon(autenticador))
    if (!creada.ok) throw new Error('no se registró')
    return creada.valor
  }

  it('la firma correcta vale, limitada a esa credencial, con usuario verificado y un desafío nuevo cada vez', async () => {
    const registro = await registrada()
    expect(await comprobarCredencial(registro, entornoCon(autenticador))).toEqual({ ok: true, valor: undefined })
    expect(await comprobarCredencial(registro, entornoCon(autenticador))).toEqual({ ok: true, valor: undefined })
    const [primera, segunda] = autenticador.llamadas.get.map((o) => o.publicKey!)
    expect(primera.userVerification).toBe('required')
    expect(primera.rpId).toBe(HOST_PRUEBA)
    expect(primera.allowCredentials).toHaveLength(1)
    expect(primera.allowCredentials![0].transports).toEqual(['internal'])
    expect((primera.challenge as Uint8Array).byteLength).toBe(32)
    expect(Buffer.from(primera.challenge as Uint8Array).equals(Buffer.from(segunda.challenge as Uint8Array))).toBe(false)
  })

  it('el contador de firmas en 0 una y otra vez no bloquea', async () => {
    const registro = await registrada()
    for (let i = 0; i < 3; i++) {
      expect((await comprobarCredencial(registro, entornoCon(autenticador))).ok).toBe(true)
    }
  })

  const ataques: Array<[string, Alteracion]> = [
    ['un desafío que no es el de esta ceremonia', { desafio: 'desafio-viejo' }],
    ['otro origen', { origen: 'https://soluciones-it.test.atacante.test' }],
    ['otro RP ID', { rpId: 'atacante.test' }],
    ['el usuario sin verificar (UV apagado)', { sinUV: true }],
    ['sin presencia (UP apagado)', { sinUP: true }],
    ['una firma falsa', { firmaFalsa: true }],
    ['otra credencial', { otroId: true }],
    ['otro usuario', { otroUsuario: true }],
    ['la ceremonia de registro en vez de la de desbloqueo', { tipo: 'webauthn.create' }],
    ['un iframe de otro origen', { crossOrigin: true }],
    ['datos de credencial atestada (AT) en un desbloqueo', { conAT: true }],
    ['la firma en r || s en vez de DER', { firmaCruda: true }],
  ]
  it.each(ataques)('NO abre con %s', async (_, alteracion) => {
    const registro = await registrada()
    autenticador.alterarSiguiente = alteracion
    expect(await comprobarCredencial(registro, entornoCon(autenticador))).toEqual({ ok: false, motivo: 'rechazado' })
  })

  it('cancelar, o una credencial que el dispositivo ya no tiene, es "cancelado" (el navegador no los distingue)', async () => {
    const registro = await registrada()
    autenticador.errorSiguiente = 'NotAllowedError'
    expect(await comprobarCredencial(registro, entornoCon(autenticador))).toEqual({ ok: false, motivo: 'cancelado' })
    autenticador.olvidarTodo()
    expect(await comprobarCredencial(registro, entornoCon(autenticador))).toEqual({ ok: false, motivo: 'cancelado' })
  })

  it('una credencial de otro host no se intenta, y sin soporte tampoco', async () => {
    const registro = await registrada()
    const llamadas = autenticador.llamadas.get.length
    expect(await comprobarCredencial({ ...registro, rpId: 'vista-previa.test' }, entornoCon(autenticador))).toEqual({
      ok: false,
      motivo: 'no-disponible',
    })
    expect(
      await comprobarCredencial(registro, entornoCon(autenticador, { nivelSuperior: false })),
    ).toEqual({ ok: false, motivo: 'no-disponible' })
    expect(autenticador.llamadas.get).toHaveLength(llamadas)
  })

  it('una clave pública guardada que no es de ese algoritmo no abre', async () => {
    const registro = await registrada()
    expect(
      await comprobarCredencial({ ...registro, algoritmo: RS256 }, entornoCon(autenticador)),
    ).toEqual({ ok: false, motivo: 'rechazado' })
  })
})

describe('el bloqueo de la app con desbloqueo del dispositivo', () => {
  beforeEach(() => {
    instalarAutenticador(autenticador)
  })

  it('activar exige confirmar el código actual antes de crear nada', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    expect(await crearDesbloqueoDispositivo()).toEqual({ ok: false, motivo: 'sin-confirmar' })
    expect(autenticador.llamadas.create).toHaveLength(0)
    expect(await confirmarBloqueoActual('otra-cosa')).toMatch(/actual no es correcto/i)
    expect(confirmacionVigente()).toBe(false)
    expect(await confirmarBloqueoActual(CONTRASENA)).toBeNull()
    expect(confirmacionVigente()).toBe(true)
  })

  it('la confirmación caduca a los dos minutos y se pierde al bloquear', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    vi.useFakeTimers({ toFake: ['Date'] })
    expect(await confirmarBloqueoActual(CONTRASENA)).toBeNull()
    vi.setSystemTime(Date.now() + 2 * 60_000 + 1)
    expect(await crearDesbloqueoDispositivo()).toEqual({ ok: false, motivo: 'sin-confirmar' })
    vi.useRealTimers()
    expect(await confirmarBloqueoActual(CONTRASENA)).toBeNull()
    bloquearApp()
    expect(confirmacionVigente()).toBe(false)
  })

  it('confirmar comparte el freno de intentos: tras 5 fallos ni el código correcto sirve', async () => {
    await sembrarBloqueo('patron', PATRON)
    let ultimo: string | null = null
    for (let i = 0; i < 5; i++) ultimo = await confirmarBloqueoActual('0-3-6-7')
    expect(ultimo).toMatch(/demasiados intentos/i)
    expect(await confirmarBloqueoActual(PATRON)).toMatch(/demasiados intentos/i)
    expect(confirmacionVigente()).toBe(false)
  })

  it('Cambiar y Quitar también cuentan los fallos (antes se podía probar sin límite)', async () => {
    await sembrarBloqueo('patron', PATRON)
    for (let i = 0; i < 4; i++) expect(await cambiarBloqueoApp('0-3-6-7', 'contrasena', 'nueva-1234')).toMatch(/actual/i)
    expect(await quitarBloqueoApp('0-3-6-7')).toMatch(/demasiados intentos/i)
    expect(await quitarBloqueoApp(PATRON)).toMatch(/demasiados intentos/i)
    expect(await bloqueoAppConfigurado()).toBe(true)
  })

  it('guarda solo material público, y solo tras comprobar que funciona', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    expect(await confirmarBloqueoActual(CONTRASENA)).toBeNull()
    const creada = await crearDesbloqueoDispositivo()
    expect(creada.ok).toBe(true)
    // Creada pero sin comprobar: nada guardado todavía.
    expect((await db.seguridadApp.get(ID_BLOQUEO_APP))?.desbloqueoDispositivo).toBeUndefined()
    if (!creada.ok) return
    expect(await completarDesbloqueoDispositivo(creada.pendiente)).toBe('ok')

    const fila = await db.seguridadApp.get(ID_BLOQUEO_APP)
    expect(Object.keys(fila!.desbloqueoDispositivo!).sort()).toEqual([
      'algoritmo',
      'clavePublica',
      'creadoEn',
      'credencialId',
      'respaldable',
      'rpId',
      'usuarioId',
    ])
    // La fila no gana ningún otro campo: ni un "ya se verificó", ni nada
    // del dispositivo que no sea público.
    expect(Object.keys(fila!).sort()).toEqual([
      'bloqueadoHasta',
      'desbloqueoDispositivo',
      'id',
      'metodo',
      'minutosAutobloqueo',
      'updatedAt',
      'verificador',
    ])
    expect(JSON.stringify(fila)).not.toContain(CONTRASENA)
    // La confirmación se consume al guardar.
    expect(confirmacionVigente()).toBe(false)
  })

  it('si la comprobación se cancela o no verifica, no queda nada a medias', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    expect(await confirmarBloqueoActual(CONTRASENA)).toBeNull()
    const creada = await crearDesbloqueoDispositivo()
    if (!creada.ok) throw new Error('no se creó')
    autenticador.errorSiguiente = 'NotAllowedError'
    expect(await completarDesbloqueoDispositivo(creada.pendiente)).toBe('cancelado')
    autenticador.alterarSiguiente = { firmaFalsa: true }
    expect(await completarDesbloqueoDispositivo(creada.pendiente)).toBe('rechazado')
    const fila = await db.seguridadApp.get(ID_BLOQUEO_APP)
    expect(fila?.desbloqueoDispositivo).toBeUndefined()
    // El respaldo sigue intacto.
    bloquearApp()
    expect(await desbloquearApp(CONTRASENA)).toBeNull()
  })

  it('escenario A: activado, bloqueada y SIN RED, el dispositivo abre la app', async () => {
    await sembrarBloqueo('patron', PATRON)
    await activar(PATRON)
    bloquearApp()
    expect(navigator.onLine).toBe(false)
    const red = vi.fn(() => Promise.reject(new TypeError('Sin conexión')))
    vi.stubGlobal('fetch', red)

    expect(await desbloquearAppConDispositivo()).toBe('ok')
    expect(bloqueoAppDesbloqueado()).toBe(true)
    expect(red).not.toHaveBeenCalled()
  })

  it('escenario B: sin red, se cancela el diálogo y el patrón entra igual', async () => {
    await sembrarBloqueo('patron', PATRON)
    await activar(PATRON)
    bloquearApp()
    autenticador.errorSiguiente = 'NotAllowedError'
    expect(await desbloquearAppConDispositivo()).toBe('cancelado')
    expect(bloqueoAppDesbloqueado()).toBe(false)
    expect(await desbloquearApp(PATRON)).toBeNull()
    expect(bloqueoAppDesbloqueado()).toBe(true)
  })

  it('una firma que no verifica no abre, y la contraseña sigue sirviendo', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activar(CONTRASENA)
    bloquearApp()
    for (const alteracion of [{ sinUV: true }, { firmaFalsa: true }, { desafio: 'x' }, { origen: 'https://x.test' }]) {
      autenticador.alterarSiguiente = alteracion
      expect(await desbloquearAppConDispositivo()).toBe('rechazado')
      expect(bloqueoAppDesbloqueado()).toBe(false)
    }
    expect(await desbloquearApp(CONTRASENA)).toBeNull()
  })

  it('escenario C: sin red, "cerrar sesión y quitar el bloqueo" se lleva también el desbloqueo del dispositivo', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activar(CONTRASENA)
    bloquearApp()
    await restablecerBloqueoApp()
    expect(await bloqueoAppConfigurado()).toBe(false)
    expect(await desbloquearAppConDispositivo()).toBe('no-disponible')
    expect(bloqueoAppDesbloqueado()).toBe(false)
  })

  it('quitar el bloqueo también quita el desbloqueo del dispositivo', async () => {
    await sembrarBloqueo('contrasena', CONTRASENA)
    await activar(CONTRASENA)
    expect(await quitarBloqueoApp(CONTRASENA)).toBeNull()
    expect(await db.seguridadApp.get(ID_BLOQUEO_APP)).toBeUndefined()
  })

  it('cambiar de patrón a contraseña conserva el desbloqueo del dispositivo: solo cambia el respaldo', async () => {
    await sembrarBloqueo('patron', PATRON)
    await activar(PATRON)
    const antes = (await db.seguridadApp.get(ID_BLOQUEO_APP))!.desbloqueoDispositivo
    expect(await cambiarBloqueoApp(PATRON, 'contrasena', CONTRASENA)).toBeNull()
    const despues = await db.seguridadApp.get(ID_BLOQUEO_APP)
    expect(despues?.metodo).toBe('contrasena')
    expect(despues?.desbloqueoDispositivo).toEqual(antes)
    bloquearApp()
    expect(await desbloquearAppConDispositivo()).toBe('ok')
    bloquearApp()
    expect(await desbloquearApp(CONTRASENA)).toBeNull()
  })

  it('desactivarlo deja el patrón como estaba', async () => {
    await sembrarBloqueo('patron', PATRON)
    await activar(PATRON)
    await desactivarDesbloqueoDispositivo()
    const fila = await db.seguridadApp.get(ID_BLOQUEO_APP)
    expect(fila && 'desbloqueoDispositivo' in fila).toBe(false)
    bloquearApp()
    expect(await desbloquearAppConDispositivo()).toBe('no-disponible')
    expect(await desbloquearApp(PATRON)).toBeNull()
  })

  it('registrar de nuevo reemplaza la credencial (tras confirmar otra vez)', async () => {
    await sembrarBloqueo('patron', PATRON)
    await activar(PATRON)
    const primera = (await db.seguridadApp.get(ID_BLOQUEO_APP))!.desbloqueoDispositivo!.credencialId
    autenticador.olvidarTodo()
    expect(await probarDesbloqueoDispositivo()).toBe('cancelado')
    await activar(PATRON)
    const segunda = (await db.seguridadApp.get(ID_BLOQUEO_APP))!.desbloqueoDispositivo!.credencialId
    expect(segunda).not.toBe(primera)
    expect(await probarDesbloqueoDispositivo()).toBe('ok')
  })

  it('el dispositivo abre aunque el patrón esté en espera por intentos, y la espera se levanta', async () => {
    await sembrarBloqueo('patron', PATRON)
    await activar(PATRON)
    bloquearApp()
    for (let i = 0; i < 5; i++) await desbloquearApp('0-3-6-7')
    expect(await desbloquearApp(PATRON)).toMatch(/demasiados intentos/i)
    expect(await desbloquearAppConDispositivo()).toBe('ok')
    expect((await db.seguridadApp.get(ID_BLOQUEO_APP))?.bloqueadoHasta).toBeNull()
  })

  it('una fila de antes de la tarea 278 sigue funcionando igual, sin pedir configurar nada', async () => {
    await sembrarBloqueo('patron', PATRON, { minutosAutobloqueo: 30 })
    const fila = await db.seguridadApp.get(ID_BLOQUEO_APP)
    expect(fila && 'desbloqueoDispositivo' in fila).toBe(false)
    expect(await desbloquearAppConDispositivo()).toBe('no-disponible')
    expect(await desbloquearApp(PATRON)).toBeNull()
    expect((await db.seguridadApp.get(ID_BLOQUEO_APP))?.minutosAutobloqueo).toBe(30)
  })
})
