import { describe, expect, it } from 'vitest'
import { analizarBloque, cifrarTexto, derivarClave, descifrarTexto, nuevaSal } from './crypto'

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
