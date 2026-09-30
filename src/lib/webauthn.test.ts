import { createHash, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aBase64Url,
  BYTES_DESAFIO,
  comprobarDatosAutenticador,
  comprobarDatosCliente,
  credencialAtestada,
  derAFirmaCruda,
  desdeBase64Url,
  ES256,
  ErrorWebAuthn,
  firmaValida,
  importarClavePublica,
  leerDatosAutenticador,
  leerDatosCliente,
  nuevoDesafio,
  RS256,
  verificarAsercion,
  verificarRegistro,
  type MotivoRechazo,
} from './webauthn'

// LA VERIFICACIÓN DE WEBAUTHN, PIEZA POR PIEZA (tarea 278). Las claves y
// las firmas las hace `node:crypto`, no el código que se prueba: si la
// verificación acepta una firma DER de OpenSSL y rechaza la misma
// estropeada, no es porque se esté dando la razón a sí misma.

const RP_ID = 'soluciones-it.test'
const ORIGEN = 'https://soluciones-it.test'

function hex(texto: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(texto.replace(/[\s|]/g, ''), 'hex'))
}

function bytes(datos: ArrayLike<number> | Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Array.from(datos as ArrayLike<number>))
}

function motivoDe(accion: () => unknown): MotivoRechazo | null {
  try {
    accion()
    return null
  } catch (error) {
    if (error instanceof ErrorWebAuthn) return error.motivo
    throw error
  }
}

async function motivoDeAsync(accion: () => Promise<unknown>): Promise<MotivoRechazo | null> {
  try {
    await accion()
    return null
  } catch (error) {
    if (error instanceof ErrorWebAuthn) return error.motivo
    throw error
  }
}

function datosAutenticador(opciones: { rpId?: string; banderas: number; contador?: number; resto?: Uint8Array }) {
  const contador = Buffer.alloc(4)
  contador.writeUInt32BE(opciones.contador ?? 0)
  return bytes(
    Buffer.concat([
      createHash('sha256').update(opciones.rpId ?? RP_ID).digest(),
      Buffer.from([opciones.banderas]),
      contador,
      Buffer.from(opciones.resto ?? []),
    ]),
  )
}

const UP = 0x01
const UV = 0x04
const BE = 0x08
const BS = 0x10
const AT = 0x40

afterEach(() => {
  vi.restoreAllMocks()
})

describe('base64url', () => {
  it('ida y vuelta con cualquier largo, sin relleno ni + ni /', () => {
    for (let largo = 0; largo < 70; largo++) {
      const datos = crypto.getRandomValues(new Uint8Array(largo))
      const texto = aBase64Url(datos)
      expect(texto).toMatch(/^[A-Za-z0-9_-]*$/)
      expect(desdeBase64Url(texto)).toEqual(datos)
    }
  })

  it('usa el alfabeto seguro para URL', () => {
    expect(aBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8')
    expect(desdeBase64Url('-_8')).toEqual(new Uint8Array([0xfb, 0xff]))
  })

  it('rechaza caracteres de base64 normal, relleno y largos imposibles', () => {
    for (const malo of ['+_8', '/_8', '-_8=', 'ab c', 'a', 'abcde']) {
      expect(motivoDe(() => desdeBase64Url(malo))).toBe('codificacion')
    }
  })
})

describe('nuevoDesafio', () => {
  it('32 bytes del generador criptográfico, distintos cada vez', () => {
    const espia = vi.spyOn(crypto, 'getRandomValues')
    const a = nuevoDesafio()
    const b = nuevoDesafio()
    expect(BYTES_DESAFIO).toBe(32)
    expect(a).toHaveLength(32)
    expect(espia).toHaveBeenCalledTimes(2)
    expect(aBase64Url(a)).not.toBe(aBase64Url(b))
  })
})

describe('clientDataJSON', () => {
  const desafio = hex('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff')

  function cliente(valor: unknown, bom = false): Uint8Array<ArrayBuffer> {
    const texto = new TextEncoder().encode(JSON.stringify(valor))
    return bom ? bytes([0xef, 0xbb, 0xbf, ...texto]) : bytes(texto)
  }

  const bueno = { type: 'webauthn.get', challenge: aBase64Url(desafio), origin: ORIGEN, crossOrigin: false }
  const esperado = { tipo: 'webauthn.get' as const, desafio, origen: ORIGEN }

  it('acepta el de una ceremonia correcta (también con BOM al principio)', () => {
    expect(motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente(bueno)), esperado))).toBeNull()
    expect(motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente(bueno, true)), esperado))).toBeNull()
  })

  it('rechaza lo que no es un clientDataJSON', () => {
    expect(motivoDe(() => leerDatosCliente(bytes([0xff, 0xfe, 0x00])))).toBe('datos-cliente')
    expect(motivoDe(() => leerDatosCliente(bytes(new TextEncoder().encode('no es json'))))).toBe('datos-cliente')
    expect(motivoDe(() => leerDatosCliente(cliente([bueno])))).toBe('datos-cliente')
    expect(motivoDe(() => leerDatosCliente(cliente({ ...bueno, origin: 7 })))).toBe('datos-cliente')
    expect(motivoDe(() => leerDatosCliente(cliente({ ...bueno, crossOrigin: 'false' })))).toBe('datos-cliente')
  })

  it('el tipo tiene que ser el de la ceremonia', () => {
    const creado = leerDatosCliente(cliente({ ...bueno, type: 'webauthn.create' }))
    expect(motivoDe(() => comprobarDatosCliente(creado, esperado))).toBe('tipo')
  })

  it('el desafío tiene que ser exactamente el generado', () => {
    const otro = aBase64Url(nuevoDesafio())
    expect(motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente({ ...bueno, challenge: otro })), esperado))).toBe(
      'desafio',
    )
    // El mismo desafío en base64 con relleno no es "el mismo texto".
    const conRelleno = `${aBase64Url(desafio)}=`
    expect(
      motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente({ ...bueno, challenge: conRelleno })), esperado)),
    ).toBe('desafio')
  })

  it('el origen tiene que ser exactamente el de la app', () => {
    for (const origin of ['http://soluciones-it.test', 'https://soluciones-it.test/', 'https://otro.test', 'https://soluciones-it.test:444']) {
      expect(motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente({ ...bueno, origin })), esperado))).toBe(
        'origen',
      )
    }
  })

  it('no acepta una ceremonia hecha dentro de un iframe de otro origen', () => {
    expect(
      motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente({ ...bueno, crossOrigin: true })), esperado)),
    ).toBe('origen-cruzado')
    expect(
      motivoDe(() => comprobarDatosCliente(leerDatosCliente(cliente({ ...bueno, topOrigin: 'https://otro.test' })), esperado)),
    ).toBe('origen-cruzado')
  })
})

describe('authenticatorData', () => {
  const asercion = { rpId: RP_ID, ceremonia: 'asercion' as const, respaldable: false }

  it('lee el hash, las banderas y el contador', () => {
    const datos = leerDatosAutenticador(datosAutenticador({ banderas: UP | UV, contador: 0x01020304 }))
    expect(datos.banderas).toBe(UP | UV)
    expect(datos.contador).toBe(0x01020304)
    expect(datos.rpIdHash).toEqual(bytes(createHash('sha256').update(RP_ID).digest()))
  })

  it('menos de 37 bytes no son datos del autenticador', () => {
    expect(motivoDe(() => leerDatosAutenticador(new Uint8Array(36)))).toBe('datos-autenticador')
  })

  it('acepta presencia y verificación, con el contador en 0 (como muchos autenticadores)', async () => {
    const datos = leerDatosAutenticador(datosAutenticador({ banderas: UP | UV, contador: 0 }))
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(datos, asercion))).toBeNull()
  })

  it('el hash tiene que ser el del RP ID de la app', async () => {
    const datos = leerDatosAutenticador(datosAutenticador({ rpId: 'otro.test', banderas: UP | UV }))
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(datos, asercion))).toBe('rp-id')
  })

  it('sin presencia (UP) o sin verificación del usuario (UV) no vale', async () => {
    const sinUP = leerDatosAutenticador(datosAutenticador({ banderas: UV }))
    const sinUV = leerDatosAutenticador(datosAutenticador({ banderas: UP }))
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(sinUP, asercion))).toBe('presencia')
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(sinUV, asercion))).toBe('verificacion')
  })

  it('respaldo incoherente o distinto del registrado no vale', async () => {
    const bsSinBe = leerDatosAutenticador(datosAutenticador({ banderas: UP | UV | BS }))
    const conBe = leerDatosAutenticador(datosAutenticador({ banderas: UP | UV | BE }))
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(bsSinBe, asercion))).toBe('respaldo')
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(conBe, asercion))).toBe('respaldo')
    expect(
      await motivoDeAsync(() => comprobarDatosAutenticador(conBe, { ...asercion, respaldable: true })),
    ).toBeNull()
  })

  it('los datos de credencial (AT) van al registrar y nunca en un desbloqueo', async () => {
    const conAT = leerDatosAutenticador(datosAutenticador({ banderas: UP | UV | AT }))
    const sinAT = leerDatosAutenticador(datosAutenticador({ banderas: UP | UV }))
    expect(await motivoDeAsync(() => comprobarDatosAutenticador(conAT, asercion))).toBe('datos-autenticador')
    expect(
      await motivoDeAsync(() => comprobarDatosAutenticador(sinAT, { rpId: RP_ID, ceremonia: 'registro' })),
    ).toBe('datos-autenticador')
  })

  it('lee el identificador de la credencial atestada y rechaza largos imposibles', () => {
    const id = crypto.getRandomValues(new Uint8Array(20))
    const atestada = (largo: number, cuerpo: Uint8Array) =>
      leerDatosAutenticador(
        datosAutenticador({
          banderas: UP | UV | AT,
          resto: bytes([...new Uint8Array(16), largo >> 8, largo & 0xff, ...cuerpo]),
        }),
      )
    expect(credencialAtestada(atestada(20, id))).toEqual(id)
    expect(motivoDe(() => credencialAtestada(atestada(0, id)))).toBe('datos-autenticador')
    expect(motivoDe(() => credencialAtestada(atestada(21, id)))).toBe('datos-autenticador')
    expect(motivoDe(() => credencialAtestada(atestada(1024, new Uint8Array(1024))))).toBe('datos-autenticador')
  })
})

describe('firma ECDSA: de DER a r || s', () => {
  it('el ejemplo de la especificación: r con relleno 0x00 y s corta que se completa por delante', () => {
    const der = hex(`30 43
      02 21 00 89 90 95 04 e1 4f 1e 29 db a8 15 8f a7 c3 87 e8 88 ff be 07 d8 24 bb 21 43 20 55 06 ab 15 9c 3e
      02 1e 56 55 4f b5 81 9b 12 84 5e 85 be 2f 78 37 1c f3 cb 95 e3 87 f4 51 cb 36 2b 94 78 d1 83 d2`)
    const cruda = derAFirmaCruda(der)
    expect(Buffer.from(cruda).toString('hex')).toBe(
      '89909504e14f1e29dba8158fa7c387e888ffbe07d824bb2143205506ab159c3e' +
        '0000' +
        '56554fb5819b12845e85be2f78371cf3cb95e387f451cb362b9478d183d2',
    )
  })

  it('s con relleno 0x00', () => {
    const r = 'aa'.repeat(32).replace(/^aa/, '11')
    const der = hex(`30 45 02 20 ${r} 02 21 00 ${'bb'.repeat(32)}`)
    expect(Buffer.from(derAFirmaCruda(der)).toString('hex')).toBe(r + 'bb'.repeat(32))
  })

  it('firmas reales de OpenSSL: la conversión verifica con la clave pública', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    for (let i = 0; i < 40; i++) {
      const mensaje = crypto.getRandomValues(new Uint8Array(64))
      const der = sign('sha256', mensaje, { key: privateKey, dsaEncoding: 'der' })
      const cruda = derAFirmaCruda(bytes(der))
      expect(cruda).toHaveLength(64)
      expect(verify('sha256', mensaje, { key: publicKey, dsaEncoding: 'ieee-p1363' }, cruda)).toBe(true)
    }
  })

  const r32 = '11'.repeat(32)
  const s32 = '22'.repeat(32)
  const casos: Array<[string, string]> = [
    ['vacía', ''],
    ['no es una secuencia', `31 44 02 20 ${r32} 02 20 ${s32}`],
    ['largo de la secuencia mayor que lo que hay (truncada)', `30 45 02 20 ${r32} 02 20 ${s32}`],
    ['largo de la secuencia menor que lo que hay', `30 43 02 20 ${r32} 02 20 ${s32}`],
    ['sobran bytes al final', `30 44 02 20 ${r32} 02 20 ${s32} 00`],
    ['sobra un byte dentro de la secuencia, después de s', `30 45 02 20 ${r32} 02 20 ${s32} 00`],
    ['secuencia cortada a la mitad de s', `30 44 02 20 ${r32} 02 20 ${'22'.repeat(31)}`],
    ['entero con largo que se sale', `30 44 02 20 ${r32} 02 21 ${s32}`],
    ['no es un INTEGER', `30 44 03 20 ${r32} 02 20 ${s32}`],
    ['largo en forma larga', `30 81 44 02 20 ${r32} 02 20 ${s32}`],
    ['INTEGER negativo (bit alto sin 0x00)', `30 44 02 20 ${'91'.repeat(32)} 02 20 ${s32}`],
    ['relleno 0x00 que sobra', `30 45 02 21 00 ${r32} 02 20 ${s32}`],
    ['INTEGER de largo 0', `30 24 02 00 02 20 ${s32}`],
    ['INTEGER cero', `30 25 02 01 00 02 20 ${s32}`],
    ['entero más largo que la curva', `30 46 02 22 00 ff ${'11'.repeat(32)} 02 20 ${s32}`],
    ['r || s crudos en vez de DER', `${r32}${s32}`],
  ]
  it.each(casos)('rechaza: %s', (_, texto) => {
    expect(motivoDe(() => derAFirmaCruda(hex(texto)))).toBe('firma')
  })
})

describe('claves públicas y firmas', () => {
  const authData = datosAutenticador({ banderas: UP | UV })
  const clientData = bytes(new TextEncoder().encode('{"type":"webauthn.get"}'))
  const firmado = Buffer.concat([authData, createHash('sha256').update(clientData).digest()])

  function spki(clave: KeyObject): Uint8Array<ArrayBuffer> {
    return bytes(clave.export({ type: 'spki', format: 'der' }))
  }

  it('ES256: firma DER válida sí; datos o firma alterados, no', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const clave = await importarClavePublica(spki(publicKey), ES256)
    const firma = bytes(sign('sha256', firmado, { key: privateKey, dsaEncoding: 'der' }))
    expect(await firmaValida(clave, ES256, firma, authData, clientData)).toBe(true)

    const otroAuth = authData.slice()
    otroAuth[32] ^= UV
    expect(await firmaValida(clave, ES256, firma, otroAuth, clientData)).toBe(false)
    const otroCliente = bytes(new TextEncoder().encode('{"type":"webauthn.get "}'))
    expect(await firmaValida(clave, ES256, firma, authData, otroCliente)).toBe(false)
    const otraFirma = firma.slice()
    otraFirma[otraFirma.length - 1] ^= 1
    expect(await firmaValida(clave, ES256, otraFirma, authData, clientData)).toBe(false)
    // La misma firma en r || s no es el formato de WebAuthn: no vale.
    const cruda = bytes(sign('sha256', firmado, { key: privateKey, dsaEncoding: 'ieee-p1363' }))
    expect(await firmaValida(clave, ES256, cruda, authData, clientData)).toBe(false)
  })

  it('ES256: la firma de otra clave no vale', async () => {
    const propia = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const ajena = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const clave = await importarClavePublica(spki(propia.publicKey), ES256)
    const firma = bytes(sign('sha256', firmado, { key: ajena.privateKey, dsaEncoding: 'der' }))
    expect(await firmaValida(clave, ES256, firma, authData, clientData)).toBe(false)
  })

  it('RS256 (Windows Hello): firma válida sí; alterada, no', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const clave = await importarClavePublica(spki(publicKey), RS256)
    const firma = bytes(sign('sha256', firmado, privateKey))
    expect(await firmaValida(clave, RS256, firma, authData, clientData)).toBe(true)
    const otraFirma = firma.slice()
    otraFirma[10] ^= 1
    expect(await firmaValida(clave, RS256, otraFirma, authData, clientData)).toBe(false)
  })

  it('rechaza claves débiles, de otra curva, de otro algoritmo o que no son claves', async () => {
    const rsaCorta = generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey
    const p384 = generateKeyPairSync('ec', { namedCurve: 'P-384' }).publicKey
    const p256 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey
    expect(await motivoDeAsync(() => importarClavePublica(spki(rsaCorta), RS256))).toBe('clave')
    expect(await motivoDeAsync(() => importarClavePublica(spki(p384), ES256))).toBe('clave')
    expect(await motivoDeAsync(() => importarClavePublica(spki(p256), RS256))).toBe('clave')
    expect(await motivoDeAsync(() => importarClavePublica(spki(p256), -8))).toBe('clave')
    expect(await motivoDeAsync(() => importarClavePublica(bytes([1, 2, 3]), ES256))).toBe('clave')
  })
})

// Credenciales y firmas que NO hizo este código: las generó Chromium con su
// autenticador de plataforma virtual (`node scripts/vectores-webauthn.mjs`).
// Una de ES256 y otra de RS256 (Windows Hello usa RS256), cada una con una
// aserción con el usuario verificado y otra sin verificar.
describe('vectores reales de Chromium', () => {
  interface Vector {
    desafio: string
    rawId: string
    clientDataJSON: string
    authenticatorData: string
    signature: string
    userHandle: string | null
  }
  interface Registro {
    desafio: string
    usuarioId: string
    rawId: string
    clientDataJSON: string
    authenticatorData: string
    clavePublica: string
    algoritmo: number
  }
  const vectores = JSON.parse(readFileSync(new URL('./webauthn.vectores-chromium.json', import.meta.url), 'utf8')) as {
    generadoCon: string
    origen: string
    rpId: string
    credenciales: Array<{ registro: Registro; conUV: Vector; sinUV: Vector }>
  }

  function respuesta(v: Vector) {
    return {
      rawId: desdeBase64Url(v.rawId),
      clientDataJSON: desdeBase64Url(v.clientDataJSON),
      authenticatorData: desdeBase64Url(v.authenticatorData),
      signature: desdeBase64Url(v.signature),
      userHandle: v.userHandle ? desdeBase64Url(v.userHandle) : null,
    }
  }

  async function registrar(r: Registro) {
    return verificarRegistro(
      {
        rawId: desdeBase64Url(r.rawId),
        clientDataJSON: desdeBase64Url(r.clientDataJSON),
        authenticatorData: desdeBase64Url(r.authenticatorData),
        clavePublica: desdeBase64Url(r.clavePublica),
        algoritmo: r.algoritmo,
      },
      { desafio: desdeBase64Url(r.desafio), origen: vectores.origen, rpId: vectores.rpId, usuarioId: desdeBase64Url(r.usuarioId) },
    )
  }

  it('son de un Chromium de verdad, con ES256 y RS256', () => {
    expect(vectores.generadoCon).toMatch(/Chrome\/\d+/)
    expect(vectores.credenciales.map((c) => c.registro.algoritmo)).toEqual([ES256, RS256])
  })

  for (const [indice, nombre] of ['ES256', 'RS256'].entries()) {
    describe(nombre, () => {
      const { registro, conUV, sinUV } = vectores.credenciales[indice]
      const esperado = () => ({ desafio: desdeBase64Url(conUV.desafio), origen: vectores.origen })

      it('el registro verifica y guarda la credencial que creó el autenticador', async () => {
        const guardada = await registrar(registro)
        expect(guardada).toMatchObject({ credencialId: registro.rawId, algoritmo: registro.algoritmo, rpId: 'localhost' })
      })

      it('la aserción con el usuario verificado abre', async () => {
        const guardada = await registrar(registro)
        expect(await motivoDeAsync(() => verificarAsercion(respuesta(conUV), guardada, esperado()))).toBeNull()
      })

      it('la aserción REAL sin verificar al usuario (UV=0) no abre', async () => {
        const guardada = await registrar(registro)
        const motivo = await motivoDeAsync(() =>
          verificarAsercion(respuesta(sinUV), guardada, { desafio: desdeBase64Url(sinUV.desafio), origen: vectores.origen }),
        )
        expect(motivo).toBe('verificacion')
      })

      it('con otro desafío, otro origen, otro RP ID o la firma tocada, no abre', async () => {
        const guardada = await registrar(registro)
        expect(
          await motivoDeAsync(() => verificarAsercion(respuesta(conUV), guardada, { ...esperado(), desafio: nuevoDesafio() })),
        ).toBe('desafio')
        expect(
          await motivoDeAsync(() => verificarAsercion(respuesta(conUV), guardada, { ...esperado(), origen: 'https://localhost:5187' })),
        ).toBe('origen')
        expect(
          await motivoDeAsync(() => verificarAsercion(respuesta(conUV), { ...guardada, rpId: 'localhost.' }, esperado())),
        ).toBe('rp-id')
        const tocada = respuesta(conUV)
        tocada.signature[tocada.signature.length - 2] ^= 0x01
        expect(await motivoDeAsync(() => verificarAsercion(tocada, guardada, esperado()))).toBe('firma')
        const otrosDatos = respuesta(conUV)
        otrosDatos.authenticatorData[33] ^= 0x01 // el contador: la firma deja de cubrirlo
        expect(await motivoDeAsync(() => verificarAsercion(otrosDatos, guardada, esperado()))).toBe('firma')
      })
    })
  }

  it('la aserción de una credencial no abre con la otra', async () => {
    const es256 = await registrar(vectores.credenciales[0].registro)
    const deRs256 = vectores.credenciales[1].conUV
    expect(
      await motivoDeAsync(() =>
        verificarAsercion(respuesta(deRs256), es256, { desafio: desdeBase64Url(deRs256.desafio), origen: vectores.origen }),
      ),
    ).toBe('credencial')
  })
})
