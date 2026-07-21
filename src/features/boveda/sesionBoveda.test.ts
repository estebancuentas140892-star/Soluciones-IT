import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ID_VERIFICADOR } from '../../lib/db'
import { cifrarTexto, derivarClave, ITERACIONES_PBKDF2, nuevaSal } from '../../lib/crypto'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  bloquear,
  bovedaDesbloqueada,
  cifrarCredencial,
  cifrarValor,
  descifrarCredencial,
  descifrarValor,
  desbloquear,
  estadoInicialBoveda,
  TEXTO_VERIFICADOR,
  verificarContrasenaMaestra,
  type DatosCredencial,
} from './sesionBoveda'
import { consultarVerificadorRemoto, subirVerificadorRemoto } from './verificadorRemoto'

// El servidor se simula por completo: cada prueba decide que responde
// la consulta del verificador y su creacion. El comportamiento por
// defecto es "sin respuesta" (como sin conexion), el caso mas
// restrictivo.
vi.mock('./verificadorRemoto', () => ({
  consultarVerificadorRemoto: vi.fn(),
  subirVerificadorRemoto: vi.fn(),
}))
const consultarMock = vi.mocked(consultarVerificadorRemoto)
const subirMock = vi.mocked(subirVerificadorRemoto)

const datos: DatosCredencial = {
  usuario: 'admin',
  contrasena: 'ClaveSegura!2026',
  ip: '192.168.10.1',
  url: 'https://router.local',
  notas: 'Router principal de la sede',
  extras: { puerto: '8443' },
}

async function guardarCredencial(titulo: string, datosCifrados: string): Promise<void> {
  await guardarRegistro('credenciales', {
    id: nuevoId(),
    titulo,
    categoria: 'Redes',
    tipo: 'cuenta',
    datosCifrados,
    venceEn: null,
    dispositivos: [],
  })
}

// Bloque cifrado con una contrasena dada, como el que produciria otro
// telefono (salt propio).
async function bloqueConContrasena(contrasena: string, texto: string): Promise<string> {
  const salt = nuevaSal()
  const clave = await derivarClave(contrasena, salt, ITERACIONES_PBKDF2)
  return cifrarTexto(clave, salt, ITERACIONES_PBKDF2, texto)
}

// Deja un verificador en la base local, como si la sincronizacion ya
// lo hubiera descargado.
async function sembrarVerificador(contrasena: string): Promise<string> {
  const verificador = await bloqueConContrasena(contrasena, TEXTO_VERIFICADOR)
  await db.bovedaMeta.put({ id: ID_VERIFICADOR, verificador, updatedAt: new Date().toISOString() })
  return verificador
}

beforeEach(async () => {
  bloquear()
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
  consultarMock.mockReset().mockResolvedValue({ tipo: 'error' })
  subirMock.mockReset().mockResolvedValue('error')
})

describe('desbloqueo con verificador (contraseña anclada al servidor)', () => {
  it('verifica contra el verificador local: rechaza la incorrecta y acepta la correcta', async () => {
    await sembrarVerificador('maestra')

    expect(await desbloquear('otra-contrasena')).toBe('Contraseña incorrecta.')
    expect(bovedaDesbloqueada()).toBe(false)

    expect(await desbloquear('maestra')).toBeNull()
    expect(bovedaDesbloqueada()).toBe(true)
    const bloque = await cifrarCredencial(datos)
    expect(await descifrarCredencial(bloque)).toEqual(datos)
  })

  it('tras borrar la cache NO permite crear una contraseña nueva si el servidor tiene verificador', async () => {
    // Base local vacia (cache borrada); el servidor si responde.
    const verificador = await bloqueConContrasena('maestra', TEXTO_VERIFICADOR)
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador, hayCredenciales: true })

    expect(await desbloquear('contrasena-del-atacante')).toBe('Contraseña incorrecta.')
    expect(bovedaDesbloqueada()).toBe(false)

    // La correcta si abre, y el verificador queda guardado localmente
    // para poder desbloquear sin conexion la proxima vez.
    expect(await desbloquear('maestra')).toBeNull()
    expect((await db.bovedaMeta.get(ID_VERIFICADOR))?.verificador).toBe(verificador)
  })

  it('con verificador tambien abre bloques de credenciales con otro salt y misma contraseña', async () => {
    await sembrarVerificador('maestra')
    const bloqueAjeno = await bloqueConContrasena('maestra', JSON.stringify(datos))
    await guardarCredencial('Switch bodega', bloqueAjeno)

    expect(await desbloquear('maestra')).toBeNull()
    expect(await descifrarCredencial(bloqueAjeno)).toEqual(datos)
  })
})

describe('primera vez: solo con confirmacion explicita del servidor', () => {
  it('sin nada local y sin respuesta del servidor NO desbloquea ni crea', async () => {
    const resultado = await desbloquear('lo-que-sea')
    expect(resultado).toContain('No se pudo comprobar')
    expect(bovedaDesbloqueada()).toBe(false)
    expect(await db.bovedaMeta.get(ID_VERIFICADOR)).toBeUndefined()
  })

  it('si el servidor confirma vacio, crea la maestra y la ancla antes de desbloquear', async () => {
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador: null, hayCredenciales: false })
    subirMock.mockResolvedValue('creado')

    expect(await desbloquear('maestra-nueva')).toBeNull()
    expect(bovedaDesbloqueada()).toBe(true)
    expect(subirMock).toHaveBeenCalledTimes(1)
    expect(await db.bovedaMeta.get(ID_VERIFICADOR)).toBeDefined()

    // La proxima sesion verifica contra el verificador creado.
    bloquear()
    expect(await desbloquear('otra')).toBe('Contraseña incorrecta.')
    expect(await desbloquear('maestra-nueva')).toBeNull()
  })

  it('si el registro en el servidor falla, NO desbloquea', async () => {
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador: null, hayCredenciales: false })
    subirMock.mockResolvedValue('error')

    const resultado = await desbloquear('maestra-nueva')
    expect(resultado).toContain('No se pudo registrar')
    expect(bovedaDesbloqueada()).toBe(false)
  })

  it('si otro tecnico gano la carrera, verifica contra el verificador de el', async () => {
    const verificadorAjeno = await bloqueConContrasena('maestra-del-otro', TEXTO_VERIFICADOR)
    consultarMock
      .mockResolvedValueOnce({ tipo: 'ok', verificador: null, hayCredenciales: false })
      .mockResolvedValue({ tipo: 'ok', verificador: verificadorAjeno, hayCredenciales: true })
    subirMock.mockResolvedValue('conflicto')

    // Con una contrasena distinta a la del otro tecnico: rechazada.
    const resultado = await desbloquear('maestra-nueva')
    expect(resultado).toContain('no coincide')
    expect(bovedaDesbloqueada()).toBe(false)

    // Con la misma contrasena que registro el otro: abre.
    consultarMock
      .mockResolvedValueOnce({ tipo: 'ok', verificador: verificadorAjeno, hayCredenciales: true })
    expect(await desbloquear('maestra-del-otro')).toBeNull()
  })
})

describe('migracion: credenciales cifradas sin verificador', () => {
  it('valida contra las credenciales y ancla el verificador al servidor', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')
    await guardarCredencial('Router principal', await cifrarCredencial(datos))
    // Se simula el estado anterior a esta version: hay credenciales
    // pero no existe verificador (ni local ni en el servidor).
    await db.bovedaMeta.clear()
    bloquear()

    subirMock.mockResolvedValue('creado')
    expect(await desbloquear('otra-contrasena')).toBe('Contraseña incorrecta.')
    expect(await desbloquear('maestra')).toBeNull()

    // El desbloqueo correcto subio el verificador y guardo la copia.
    expect(subirMock).toHaveBeenCalledTimes(1)
    expect(await db.bovedaMeta.get(ID_VERIFICADOR)).toBeDefined()
    const guardada = (await db.credenciales.toArray())[0]
    expect(await descifrarCredencial(guardada.datosCifrados)).toEqual(datos)
  })

  it('sin conexion sigue desbloqueando con las credenciales; el anclaje queda para despues', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')
    await guardarCredencial('Router principal', await cifrarCredencial(datos))
    await db.bovedaMeta.clear()
    bloquear()

    // consultar y subir fallan (sin conexion): el equipo no se queda
    // por fuera de su boveda.
    expect(await desbloquear('maestra')).toBeNull()
    expect(bovedaDesbloqueada()).toBe(true)
    expect(await db.bovedaMeta.get(ID_VERIFICADOR)).toBeUndefined()
  })

  it('vaciar las credenciales ya NO permite definir una contraseña nueva', async () => {
    // El verificador existe: aunque no quede ninguna credencial, la
    // unica via sigue siendo la contraseña original.
    await sembrarVerificador('maestra')
    expect(await desbloquear('contrasena-nueva')).toBe('Contraseña incorrecta.')
    expect(bovedaDesbloqueada()).toBe(false)
  })
})

describe('sesion y descifrado', () => {
  it('bloquear borra las claves: no se puede cifrar ni descifrar', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')
    const bloque = await cifrarCredencial(datos)

    bloquear()

    expect(bovedaDesbloqueada()).toBe(false)
    expect(await descifrarCredencial(bloque)).toBeNull()
    await expect(cifrarCredencial(datos)).rejects.toThrow()
  })

  it('un bloque cifrado con otra contraseña queda ilegible pero no impide desbloquear', async () => {
    await sembrarVerificador('maestra')
    const bloqueAjeno = await bloqueConContrasena('contrasena-vieja', JSON.stringify(datos))
    await guardarCredencial('Credencial vieja', bloqueAjeno)

    expect(await desbloquear('maestra')).toBeNull()
    expect(await descifrarCredencial(bloqueAjeno)).toBeNull()
  })

  it('ignora bloques con formato invalido al desbloquear', async () => {
    await sembrarVerificador('maestra')
    await guardarCredencial('Corrupta', 'esto-no-es-un-bloque-cifrado')

    expect(await desbloquear('maestra')).toBeNull()
    expect(bovedaDesbloqueada()).toBe(true)
    expect(await descifrarCredencial('esto-no-es-un-bloque-cifrado')).toBeNull()
  })
})

// Valor suelto (grupo P1): el cifrado de un campo protegido de un
// dispositivo. Usa la misma clave y el mismo formato de bloque que una
// credencial, asi que hereda sus garantias; estas pruebas fijan que
// asi sea y que no se pueda leer con la boveda cerrada.
describe('cifrarValor / descifrarValor (campos protegidos del dispositivo)', () => {
  it('ida y vuelta con la boveda abierta', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')

    const bloque = await cifrarValor('PIN-4821')
    expect(bloque).not.toContain('PIN-4821')
    expect(await descifrarValor(bloque)).toBe('PIN-4821')
  })

  it('un valor vacio devuelve cadena vacia, no null (distinto de "no se pudo abrir")', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')

    expect(await descifrarValor(await cifrarValor(''))).toBe('')
  })

  it('con la boveda bloqueada no se puede cifrar ni descifrar', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')
    const bloque = await cifrarValor('secreto')

    bloquear()

    expect(await descifrarValor(bloque)).toBeNull()
    await expect(cifrarValor('otro')).rejects.toThrow()
  })

  it('un bloque cifrado con otra contraseña maestra queda ilegible', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')
    const bloqueAjeno = await bloqueConContrasena('otra-contrasena', 'secreto-ajeno')

    expect(await descifrarValor(bloqueAjeno)).toBeNull()
  })

  it('un bloque con formato invalido devuelve null en vez de romper', async () => {
    await sembrarVerificador('maestra')
    await desbloquear('maestra')

    expect(await descifrarValor('esto-no-es-un-bloque')).toBeNull()
  })
})

describe('verificarContrasenaMaestra (comprobacion puntual para acciones sensibles)', () => {
  it('acepta la correcta y rechaza la incorrecta contra el verificador local', async () => {
    await sembrarVerificador('maestra')
    expect(await verificarContrasenaMaestra('maestra')).toBe('correcta')
    expect(await verificarContrasenaMaestra('otra')).toBe('incorrecta')
    expect(await verificarContrasenaMaestra('')).toBe('incorrecta')
  })

  it('NO abre la sesion de la boveda al verificar', async () => {
    await sembrarVerificador('maestra')
    expect(await verificarContrasenaMaestra('maestra')).toBe('correcta')
    expect(bovedaDesbloqueada()).toBe(false)
  })

  it('sin verificador local lo trae del servidor y lo guarda', async () => {
    const verificador = await bloqueConContrasena('maestra', TEXTO_VERIFICADOR)
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador, hayCredenciales: true })
    expect(await verificarContrasenaMaestra('maestra')).toBe('correcta')
    expect((await db.bovedaMeta.get(ID_VERIFICADOR))?.verificador).toBe(verificador)
  })

  it('sin nada local y sin respuesta del servidor devuelve sin-verificar', async () => {
    expect(await verificarContrasenaMaestra('maestra')).toBe('sin-verificar')
  })
})

describe('estadoInicialBoveda (que formulario ver)', () => {
  it("con verificador local: 'verificar'", async () => {
    await sembrarVerificador('maestra')
    expect(await estadoInicialBoveda()).toBe('verificar')
  })

  it("con credenciales locales sin verificador: 'verificar' (migracion)", async () => {
    await guardarCredencial('Router', await bloqueConContrasena('maestra', JSON.stringify(datos)))
    expect(await estadoInicialBoveda()).toBe('verificar')
  })

  it("sin nada local y sin respuesta del servidor: 'sin-confirmar'", async () => {
    expect(await estadoInicialBoveda()).toBe('sin-confirmar')
  })

  it("sin nada local y servidor con verificador: lo guarda y devuelve 'verificar'", async () => {
    const verificador = await bloqueConContrasena('maestra', TEXTO_VERIFICADOR)
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador, hayCredenciales: true })

    expect(await estadoInicialBoveda()).toBe('verificar')
    expect((await db.bovedaMeta.get(ID_VERIFICADOR))?.verificador).toBe(verificador)
  })

  it("sin nada local y servidor vacio confirmado: 'crear'", async () => {
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador: null, hayCredenciales: false })
    expect(await estadoInicialBoveda()).toBe('crear')
  })

  it("servidor sin verificador pero con credenciales: 'sin-confirmar' (esperar sincronizacion)", async () => {
    consultarMock.mockResolvedValue({ tipo: 'ok', verificador: null, hayCredenciales: true })
    expect(await estadoInicialBoveda()).toBe('sin-confirmar')
  })
})
