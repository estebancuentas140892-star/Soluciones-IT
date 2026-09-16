import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ID_VERIFICADOR, type Credencial, type TipoSecreto } from '../../lib/db'
import { cifrarTexto, derivarClave, ITERACIONES_PBKDF2, nuevaSal } from '../../lib/crypto'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import {
  accionesRapidasDeCredencial,
  camposVistaRapida,
  copiarCampoCredencial,
  ETIQUETA_COPIA,
  SIN_VALOR,
  tipoDe,
} from './accionesCredencial'
import { bloquear, cifrarCredencial, desbloquear, TEXTO_VERIFICADOR } from './sesionBoveda'

// ACCIONES RAPIDAS DE UNA CREDENCIAL (tarea 241, secciones 4 y 19).
//
// Lo que estas pruebas tienen que dejar clavado, porque es lo que separa
// "copiar sin abrir la ficha" de "saltarse la boveda":
//
//   - con la boveda BLOQUEADA no se copia nada, pase lo que pase;
//   - toda copia con exito deja su entrada en la AUDITORIA;
//   - una copia fallida NO la deja (no hubo acceso al secreto);
//   - el valor copiado es el descifrado, y el resultado nunca lo lleva.
//
// El cifrado es el real (WebCrypto de Node); lo unico simulado es el
// portapapeles, que no existe fuera del navegador.
vi.mock('../../lib/portapapeles', () => ({ copiarAlPortapapeles: vi.fn() }))
const copiarMock = vi.mocked(copiarAlPortapapeles)

const MAESTRA = 'ClaveMaestraDePrueba!2026'

/** Deja la bóveda abierta con una contraseña maestra ya anclada. */
async function abrirBoveda(): Promise<void> {
  const salt = nuevaSal()
  const clave = await derivarClave(MAESTRA, salt, ITERACIONES_PBKDF2)
  const verificador = await cifrarTexto(clave, salt, ITERACIONES_PBKDF2, TEXTO_VERIFICADOR)
  await db.bovedaMeta.put({ id: ID_VERIFICADOR, verificador, updatedAt: new Date().toISOString() })
  expect(await desbloquear(MAESTRA)).toBeNull()
}

async function credencial(
  id: string,
  tipo: TipoSecreto,
  usuario: string,
  contrasena: string,
): Promise<Credencial> {
  const datosCifrados = await cifrarCredencial({
    usuario,
    contrasena,
    ip: '',
    url: '',
    notas: '',
    extras: {},
  })
  return {
    id,
    titulo: `Acceso ${id}`,
    categoria: 'Pruebas',
    tipo,
    datosCifrados,
    venceEn: null,
    dispositivos: [],
    archivo: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  }
}

const auditoria = () => db.accesos_boveda.toArray()

beforeEach(async () => {
  bloquear()
  copiarMock.mockReset()
  copiarMock.mockResolvedValue(true)
  await db.accesos_boveda.clear()
  await db.cambiosPendientes.clear()
  await db.bovedaMeta.clear()
})

describe('accionesRapidasDeCredencial', () => {
  it('un acceso normal ofrece usuario y contraseña, en ese orden', () => {
    expect(accionesRapidasDeCredencial({ tipo: 'cuenta' })).toEqual([
      { campo: 'usuario', etiqueta: 'Copiar usuario' },
      { campo: 'contrasena', etiqueta: 'Copiar contraseña' },
    ])
  })

  it('una clave o PIN ofrece solo la clave: no tiene usuario', () => {
    expect(accionesRapidasDeCredencial({ tipo: 'red' })).toEqual([
      { campo: 'contrasena', etiqueta: 'Copiar clave' },
    ])
  })

  it('un token o licencia se copia sin más nombre', () => {
    expect(accionesRapidasDeCredencial({ tipo: 'llave' })).toEqual([
      { campo: 'contrasena', etiqueta: 'Copiar' },
    ])
  })

  it('un archivo seguro y una nota no se copian desde una fila', () => {
    expect(accionesRapidasDeCredencial({ tipo: 'archivo' })).toEqual([])
    expect(accionesRapidasDeCredencial({ tipo: 'nota' })).toEqual([])
    expect(ETIQUETA_COPIA.archivo).toBeNull()
    expect(ETIQUETA_COPIA.nota).toBeNull()
  })

  it('nunca ofrece más de dos acciones (sección 13: no saturar la fila)', () => {
    const tipos: TipoSecreto[] = ['cuenta', 'red', 'llave', 'archivo', 'nota']
    for (const tipo of tipos) {
      expect(accionesRapidasDeCredencial({ tipo }).length).toBeLessThanOrEqual(2)
    }
  })

  it('una credencial vieja sin columna `tipo` se lee como acceso', () => {
    expect(tipoDe({})).toBe('cuenta')
    expect(accionesRapidasDeCredencial({})).toHaveLength(2)
  })
})

// LA VISTA RÁPIDA DEL BUSCADOR (encargo del 2026-09-16, secciones 2 y 4).
describe('camposVistaRapida', () => {
  it('un acceso muestra Usuario a la vista y Contraseña tapada, cada uno con su copia', () => {
    expect(camposVistaRapida({ tipo: 'cuenta' })).toEqual([
      { campo: 'usuario', etiqueta: 'Copiar usuario', rotulo: 'Usuario', secreto: false },
      { campo: 'contrasena', etiqueta: 'Copiar contraseña', rotulo: 'Contraseña', secreto: true },
    ])
  })

  it('una clave o PIN muestra solo la clave, tapada', () => {
    expect(camposVistaRapida({ tipo: 'red' })).toEqual([
      { campo: 'contrasena', etiqueta: 'Copiar clave', rotulo: 'Clave o PIN', secreto: true },
    ])
  })

  it('un token, licencia o clave muestra su Valor, tapado', () => {
    expect(camposVistaRapida({ tipo: 'llave' })).toEqual([
      { campo: 'contrasena', etiqueta: 'Copiar', rotulo: 'Valor', secreto: true },
    ])
  })

  it('una nota y un archivo seguro no tienen campos que destapar', () => {
    expect(camposVistaRapida({ tipo: 'nota' })).toEqual([])
    expect(camposVistaRapida({ tipo: 'archivo' })).toEqual([])
  })

  it('son EXACTAMENTE los datos que se pueden copiar desde la fila, en el mismo orden', () => {
    const tipos: TipoSecreto[] = ['cuenta', 'red', 'llave', 'archivo', 'nota']
    for (const tipo of tipos) {
      expect(camposVistaRapida({ tipo }).map(({ campo, etiqueta }) => ({ campo, etiqueta }))).toEqual(
        accionesRapidasDeCredencial({ tipo }),
      )
    }
  })

  it('todo lo secreto arranca tapado: solo el usuario se ve sin tocar "Mostrar"', () => {
    const tipos: TipoSecreto[] = ['cuenta', 'red', 'llave']
    for (const tipo of tipos) {
      for (const campo of camposVistaRapida({ tipo })) expect(campo.secreto).toBe(campo.campo !== 'usuario')
    }
  })

  it('una credencial vieja sin `tipo` se lee como acceso también aquí', () => {
    expect(camposVistaRapida({}).map((c) => c.rotulo)).toEqual(['Usuario', 'Contraseña'])
  })
})

describe('copiarCampoCredencial', () => {
  it('con la bóveda BLOQUEADA no copia nada ni registra ningún acceso', async () => {
    await abrirBoveda()
    const acceso = await credencial('c1', 'cuenta', 'admin', 'Secreta!2026')
    bloquear()

    const resultado = await copiarCampoCredencial(acceso, 'contrasena')

    expect(resultado.ok).toBe(false)
    expect(copiarMock).not.toHaveBeenCalled()
    expect(await auditoria()).toEqual([])
  })

  it('copia la contraseña descifrada y registra el acceso en la auditoría', async () => {
    await abrirBoveda()
    const acceso = await credencial('c1', 'cuenta', 'admin', 'Secreta!2026')

    const resultado = await copiarCampoCredencial(acceso, 'contrasena')

    expect(resultado.ok).toBe(true)
    expect(copiarMock).toHaveBeenCalledWith('Secreta!2026')
    const registros = await auditoria()
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({
      credencialId: 'c1',
      credencialTitulo: 'Acceso c1',
      accion: 'copio_contrasena',
      entidadTipo: 'credencial',
    })
  })

  it('copiar el usuario registra su propia acción', async () => {
    await abrirBoveda()
    const acceso = await credencial('c2', 'cuenta', 'administrador', 'x')

    expect((await copiarCampoCredencial(acceso, 'usuario')).ok).toBe(true)

    expect(copiarMock).toHaveBeenCalledWith('administrador')
    expect((await auditoria())[0]).toMatchObject({ accion: 'copio_usuario' })
  })

  it('el resultado NUNCA lleva el valor copiado', async () => {
    await abrirBoveda()
    const acceso = await credencial('c3', 'cuenta', 'admin', 'Secreta!2026')

    const resultado = await copiarCampoCredencial(acceso, 'contrasena')

    expect(JSON.stringify(resultado)).not.toContain('Secreta!2026')
  })

  it('un campo vacío avisa con el motivo del tipo y no registra acceso', async () => {
    await abrirBoveda()
    const acceso = await credencial('c4', 'red', '', '')

    const resultado = await copiarCampoCredencial(acceso, 'contrasena')

    expect(resultado).toMatchObject({ ok: false, sinDato: true, mensaje: SIN_VALOR.red })
    expect(copiarMock).not.toHaveBeenCalled()
    expect(await auditoria()).toEqual([])
  })

  it('si el portapapeles falla, no se registra un acceso que no llegó a ocurrir', async () => {
    await abrirBoveda()
    copiarMock.mockResolvedValue(false)
    const acceso = await credencial('c5', 'cuenta', 'admin', 'Secreta!2026')

    const resultado = await copiarCampoCredencial(acceso, 'contrasena')

    expect(resultado.ok).toBe(false)
    expect(await auditoria()).toEqual([])
  })

  it('un bloque cifrado con otra contraseña maestra no se descifra ni se copia', async () => {
    await abrirBoveda()
    const acceso = await credencial('c6', 'cuenta', 'admin', 'Secreta!2026')
    const ajena: Credencial = { ...acceso, datosCifrados: 'bloque-de-otra-contrasena' }

    const resultado = await copiarCampoCredencial(ajena, 'contrasena')

    expect(resultado.ok).toBe(false)
    expect(copiarMock).not.toHaveBeenCalled()
    expect(await auditoria()).toEqual([])
  })
})
