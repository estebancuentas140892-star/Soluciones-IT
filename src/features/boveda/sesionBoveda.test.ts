import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { cifrarTexto, derivarClave, ITERACIONES_PBKDF2, nuevaSal } from '../../lib/crypto'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  bloquear,
  bovedaDesbloqueada,
  cifrarCredencial,
  descifrarCredencial,
  desbloquear,
  type DatosCredencial,
} from './sesionBoveda'

const datos: DatosCredencial = {
  usuario: 'admin',
  contrasena: 'ClaveSegura!2026',
  ip: '192.168.10.1',
  url: 'https://router.local',
  notas: 'Router principal de la sede',
  extras: { puerto: '8443' },
}

async function guardarCredencial(titulo: string, datosCifrados: string): Promise<void> {
  await guardarRegistro('credenciales', { id: nuevoId(), titulo, categoria: 'Redes', datosCifrados })
}

beforeEach(async () => {
  bloquear()
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

describe('sesion de la boveda', () => {
  it('con la boveda vacia cualquier contraseña la abre y define la maestra', async () => {
    expect(await desbloquear('maestra')).toBeNull()
    expect(bovedaDesbloqueada()).toBe(true)

    const bloque = await cifrarCredencial(datos)
    expect(bloque.startsWith('v1.')).toBe(true)
    expect(await descifrarCredencial(bloque)).toEqual(datos)
  })

  it('bloquear borra las claves: no se puede cifrar ni descifrar', async () => {
    await desbloquear('maestra')
    const bloque = await cifrarCredencial(datos)

    bloquear()

    expect(bovedaDesbloqueada()).toBe(false)
    expect(await descifrarCredencial(bloque)).toBeNull()
    await expect(cifrarCredencial(datos)).rejects.toThrow()
  })

  it('con credenciales guardadas rechaza la contraseña incorrecta y acepta la correcta', async () => {
    await desbloquear('maestra')
    await guardarCredencial('Router principal', await cifrarCredencial(datos))
    bloquear()

    expect(await desbloquear('otra-contrasena')).toBe('Contraseña incorrecta.')
    expect(bovedaDesbloqueada()).toBe(false)

    expect(await desbloquear('maestra')).toBeNull()
    const guardada = (await db.credenciales.toArray())[0]
    expect(await descifrarCredencial(guardada.datosCifrados)).toEqual(datos)
  })

  it('descifra bloques con salt distinto si usan la misma contraseña', async () => {
    await desbloquear('maestra')
    await guardarCredencial('Router principal', await cifrarCredencial(datos))

    // Simula la primera credencial creada en otro telefono sin
    // conexion: misma contraseña maestra pero otro salt.
    const otroSalt = nuevaSal()
    const otraClave = await derivarClave('maestra', otroSalt, ITERACIONES_PBKDF2)
    const bloqueAjeno = await cifrarTexto(otraClave, otroSalt, ITERACIONES_PBKDF2, JSON.stringify(datos))
    await guardarCredencial('Switch bodega', bloqueAjeno)
    bloquear()

    expect(await desbloquear('maestra')).toBeNull()
    for (const credencial of await db.credenciales.toArray()) {
      expect(await descifrarCredencial(credencial.datosCifrados)).toEqual(datos)
    }
  })

  it('un bloque cifrado con otra contraseña queda ilegible pero no impide desbloquear', async () => {
    await desbloquear('maestra')
    await guardarCredencial('Router principal', await cifrarCredencial(datos))

    const saltAjeno = nuevaSal()
    const claveAjena = await derivarClave('contrasena-vieja', saltAjeno, ITERACIONES_PBKDF2)
    const bloqueAjeno = await cifrarTexto(claveAjena, saltAjeno, ITERACIONES_PBKDF2, JSON.stringify(datos))
    await guardarCredencial('Credencial vieja', bloqueAjeno)
    bloquear()

    expect(await desbloquear('maestra')).toBeNull()
    expect(await descifrarCredencial(bloqueAjeno)).toBeNull()

    const router = (await db.credenciales.toArray()).find((c) => c.titulo === 'Router principal')
    expect(await descifrarCredencial(router!.datosCifrados)).toEqual(datos)
  })

  it('ignora bloques con formato invalido al desbloquear', async () => {
    await guardarCredencial('Corrupta', 'esto-no-es-un-bloque-cifrado')

    expect(await desbloquear('maestra')).toBeNull()
    expect(bovedaDesbloqueada()).toBe(true)
    expect(await descifrarCredencial('esto-no-es-un-bloque-cifrado')).toBeNull()
  })
})
