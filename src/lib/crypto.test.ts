import { describe, expect, it } from 'vitest'
import {
  analizarBloque,
  analizarBloqueBinario,
  cifrarBinario,
  cifrarTexto,
  derivarClave,
  descifrarBinario,
  descifrarTexto,
  nuevaSal,
} from './crypto'

// Iteraciones bajas para que las pruebas sean rapidas; la app usa
// ITERACIONES_PBKDF2 y el formato del bloque es el mismo.
const ITERACIONES_PRUEBA = 1000

async function cifradoDePrueba(contrasena: string, texto: string) {
  const salt = nuevaSal()
  const clave = await derivarClave(contrasena, salt, ITERACIONES_PRUEBA)
  const bloque = await cifrarTexto(clave, salt, ITERACIONES_PRUEBA, texto)
  return { clave, bloque }
}

describe('cifrado de la boveda', () => {
  it('cifra y descifra un texto (ida y vuelta)', async () => {
    const { clave, bloque } = await cifradoDePrueba('maestra', 'usuario: admin, clave: 1234')

    const analizado = analizarBloque(bloque)
    expect(analizado).not.toBeNull()
    expect(await descifrarTexto(clave, analizado!)).toBe('usuario: admin, clave: 1234')
  })

  it('el mismo texto produce bloques distintos cada vez (IV aleatorio)', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const bloqueA = await cifrarTexto(clave, salt, ITERACIONES_PRUEBA, 'secreto')
    const bloqueB = await cifrarTexto(clave, salt, ITERACIONES_PRUEBA, 'secreto')
    expect(bloqueA).not.toBe(bloqueB)
  })

  it('una contraseña equivocada no descifra', async () => {
    const { bloque } = await cifradoDePrueba('correcta', 'secreto')
    const analizado = analizarBloque(bloque)!

    const claveMala = await derivarClave('incorrecta', analizado.salt, analizado.iteraciones)
    await expect(descifrarTexto(claveMala, analizado)).rejects.toThrow()
  })

  it('detecta un bloque alterado (integridad de AES-GCM)', async () => {
    const { clave, bloque } = await cifradoDePrueba('maestra', 'secreto')
    const analizado = analizarBloque(bloque)!

    analizado.datos[0] ^= 0xff
    await expect(descifrarTexto(clave, analizado)).rejects.toThrow()
  })

  it('el bloque conserva el salt y las iteraciones con las que se creo', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const bloque = await cifrarTexto(clave, salt, ITERACIONES_PRUEBA, 'secreto')

    const analizado = analizarBloque(bloque)!
    expect(analizado.iteraciones).toBe(ITERACIONES_PRUEBA)
    expect(analizado.salt).toEqual(salt)
  })

  it('rechaza formatos invalidos sin lanzar errores', () => {
    expect(analizarBloque('')).toBeNull()
    expect(analizarBloque('texto plano cualquiera')).toBeNull()
    expect(analizarBloque('v2.1000.aaaa.bbbb.cccc')).toBeNull()
    expect(analizarBloque('v1.no-numero.aaaa.bbbb.cccc')).toBeNull()
    expect(analizarBloque('v1.1000.###.bbbb.cccc')).toBeNull()
  })
})

describe('cifrado binario (fase P5, archivos)', () => {
  it('cifra y descifra bytes binarios (ida y vuelta)', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const original = new Uint8Array([1, 2, 3, 250, 251, 252, 0, 255])

    const blob = await cifrarBinario(clave, salt, ITERACIONES_PRUEBA, original)
    const analizado = analizarBloqueBinario(blob)
    expect(analizado).not.toBeNull()
    expect(await descifrarBinario(clave, analizado!)).toEqual(original)
  })

  it('cifra y descifra un archivo de 0 bytes', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const vacio = new Uint8Array(0)

    const blob = await cifrarBinario(clave, salt, ITERACIONES_PRUEBA, vacio)
    const analizado = analizarBloqueBinario(blob)!
    expect(await descifrarBinario(clave, analizado)).toEqual(vacio)
  })

  it('conserva el salt y las iteraciones con las que se creo', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const blob = await cifrarBinario(clave, salt, ITERACIONES_PRUEBA, new Uint8Array([9, 9]))

    const analizado = analizarBloqueBinario(blob)!
    expect(analizado.iteraciones).toBe(ITERACIONES_PRUEBA)
    expect(analizado.salt).toEqual(salt)
  })

  it('una clave equivocada no descifra', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('correcta', salt, ITERACIONES_PRUEBA)
    const blob = await cifrarBinario(clave, salt, ITERACIONES_PRUEBA, new Uint8Array([1, 2, 3]))
    const analizado = analizarBloqueBinario(blob)!

    const claveMala = await derivarClave('incorrecta', salt, ITERACIONES_PRUEBA)
    await expect(descifrarBinario(claveMala, analizado)).rejects.toThrow()
  })

  it('detecta un byte alterado (integridad de AES-GCM)', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const blob = await cifrarBinario(clave, salt, ITERACIONES_PRUEBA, new Uint8Array([1, 2, 3]))

    blob[blob.length - 1] ^= 0xff
    const analizado = analizarBloqueBinario(blob)!
    await expect(descifrarBinario(clave, analizado)).rejects.toThrow()
  })

  it('rechaza un buffer truncado o con version desconocida sin lanzar', async () => {
    const salt = nuevaSal()
    const clave = await derivarClave('maestra', salt, ITERACIONES_PRUEBA)
    const blob = await cifrarBinario(clave, salt, ITERACIONES_PRUEBA, new Uint8Array([1, 2, 3]))

    expect(analizarBloqueBinario(new Uint8Array(0))).toBeNull()
    expect(analizarBloqueBinario(blob.slice(0, 10))).toBeNull()

    const versionDesconocida = blob.slice()
    versionDesconocida[0] = 9
    expect(analizarBloqueBinario(versionDesconocida)).toBeNull()
  })
})
