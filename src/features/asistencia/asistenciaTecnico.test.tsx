// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BloquePaso } from '../../lib/db'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  PERFIL_PRUEBA,
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  sembrarReferencia,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { AsistentePage } from '../soluciones/AsistentePage'
import * as api from './apiTecnico'
import { ConectarPage } from './ConectarPage'
import { reiniciarSesionAsistenciaParaPruebas } from './sesionAsistencia'

// EL LADO DEL TECNICO DE LA ASISTENCIA (tarea 258), con las pantallas de
// verdad y el servidor simulado (se sustituyen las cuatro funciones de
// `apiTecnico`; los textos son los reales). Todo es inventado.

vi.mock('./apiTecnico', async (original) => {
  const real = await original<typeof import('./apiTecnico')>()
  return {
    ...real,
    conectarConCodigo: vi.fn(),
    enviarContenido: vi.fn(),
    consultarEstadoTecnico: vi.fn(),
    desconectarSesion: vi.fn(),
  }
})

const conectar = vi.mocked(api.conectarConCodigo)
const enviar = vi.mocked(api.enviarContenido)
const estado = vi.mocked(api.consultarEstadoTecnico)
const desconectar = vi.mocked(api.desconectarSesion)

const RUTA_GUIA = '/soluciones/cat-pruebas/guia-asistencia/ejecutar'
const RUTAS = [
  { ruta: '/conectar', elemento: <ConectarPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/ejecutar', elemento: <AsistentePage /> },
]

function conexionOk(codigo = '482731') {
  return {
    ok: true as const,
    id: 'sesion-prueba-1',
    codigo,
    conectada_en: '2026-09-24T10:30:00.000Z',
    vence_inactividad_en: '2026-09-24T10:45:00.000Z',
    vence_maximo_en: '2026-09-24T14:30:00.000Z',
  }
}

async function conectarPorPantalla(codigo = '482731') {
  conectar.mockResolvedValueOnce(conexionOk(codigo))
  await montar(RUTAS, `/conectar?codigo=${codigo}`)
  await tocar(await esperarControl(`Conectar con ${codigo.slice(0, 3)} ${codigo.slice(3)}`))
  await esperar(() => textoPantalla().includes('Conectado al equipo'), 'la conexión')
  await desmontarTodo()
}

beforeEach(async () => {
  reiniciarSesionAsistenciaParaPruebas()
  conectar.mockReset()
  enviar.mockReset()
  estado.mockReset()
  desconectar.mockReset()
  estado.mockResolvedValue({ ok: true, estado: 'conectada', codigo: '482731' })
  desconectar.mockResolvedValue({ ok: true, estado: 'cerrada' })
  await limpiarBase()
  await sembrarPerfil(false)
  await guardarModoEjecucion('foco')
  await sembrarReferencia({ id: 'ref-dns', tipo: 'comando', titulo: 'Limpiar la caché DNS de prueba', valor: 'ipconfig /flushdns' })
  const paso = pasoPrueba('asis-p1', 'Vaciar la caché', ['Ejecuta ipconfig /flushdns en la consola'])
  const datoSecreto: BloquePaso = {
    ...paso.bloques[0],
    id: 'asis-p1-secreto',
    tipo: 'aviso',
    texto: 'Contraseña del administrador: Prueba-2026',
    tono: 'dato',
    tipoTarea: null,
    alcance: 'tarea',
    tareaId: paso.bloques[0].id,
  }
  await sembrarGuia({
    id: 'guia-asistencia',
    titulo: 'Guía de prueba de asistencia',
    pasos: [{ ...paso, lugar: 'Símbolo del sistema', bloques: [...paso.bloques, datoSecreto] }],
  })
})

afterEach(async () => {
  await desmontarTodo()
})

describe('Conectar equipo', () => {
  it('con el código del QR pide confirmar y conecta', async () => {
    conectar.mockResolvedValueOnce(conexionOk())
    await montar(RUTAS, '/conectar?codigo=482731')
    expect(textoPantalla()).toContain('¿Conectar con este equipo?')
    // No conecta solo: hace falta confirmar.
    expect(conectar).not.toHaveBeenCalled()

    await tocar(await esperarControl('Conectar con 482 731'))
    await esperar(() => textoPantalla().includes('Conectado al equipo'), 'la conexión')
    expect(conectar).toHaveBeenCalledWith('482731')
    expect(textoPantalla()).toContain('482 731')
    // El id guardado es del técnico que conectó, y nada más.
    expect(JSON.parse(localStorage.getItem('asistencia:sesion') ?? '{}')).toEqual({
      id: 'sesion-prueba-1',
      codigo: '482731',
      usuario: PERFIL_PRUEBA.id,
      conectadaEn: '2026-09-24T10:30:00.000Z',
    })
  })

  it('un código incorrecto lo dice y no conecta', async () => {
    conectar.mockResolvedValueOnce({ ok: false, error: 'codigo_incorrecto' })
    await montar(RUTAS, '/conectar')
    const campo = document.querySelector('input') as HTMLInputElement
    await escribir(campo, '111 222')
    await tocar(await esperarControl('Conectar'))
    await esperar(() => textoPantalla().includes(api.TEXTO_ERROR.codigo_incorrecto), 'el error')
    expect(localStorage.getItem('asistencia:sesion')).toBeNull()
  })

  it('un código vencido o ya usado lo dice', async () => {
    conectar.mockResolvedValueOnce({ ok: false, error: 'codigo_usado' })
    await montar(RUTAS, '/conectar?codigo=482731')
    await tocar(await esperarControl('Conectar con 482 731'))
    await esperar(() => textoPantalla().includes(api.TEXTO_ERROR.codigo_usado), 'el error')
  })

  it('desconectar revoca en el servidor y vuelve al formulario', async () => {
    await conectarPorPantalla()
    await montar(RUTAS, '/conectar')
    await tocar(await esperarControl('Desconectar equipo'))
    await esperar(() => textoPantalla().includes('Desconectaste el equipo.'), 'el aviso')
    expect(desconectar).toHaveBeenCalledWith('sesion-prueba-1')
    expect(localStorage.getItem('asistencia:sesion')).toBeNull()
  })
})

describe('Enviar a este equipo desde la guía', () => {
  it('sin equipo conectado la guía no añade nada, y el índice ofrece conectarlo', async () => {
    await montar(RUTAS, RUTA_GUIA)
    await esperar(() => textoPantalla().includes('Ejecuta ipconfig /flushdns en la consola'), 'la acción')
    expect(control('Enviar a este equipo')).toBeNull()
    await tocar(await esperarControl(/Abrir el índice de pasos/))
    expect(control('Conectar un equipo')).not.toBeNull()
  })

  it('con equipo conectado: vista previa, lo protegido apartado y envío', async () => {
    enviar.mockResolvedValue({ ok: true, id: 7 })
    await conectarPorPantalla()
    await montar(RUTAS, RUTA_GUIA)
    await esperar(() => textoPantalla().includes('Equipo 482 731'), 'la franja del equipo')

    await tocar(await esperarControl('Enviar a este equipo'))
    const hoja = await esperar(() => document.body.querySelector('[role=dialog]'), 'la vista previa')
    expect(hoja.textContent).toContain('Así se verá en el equipo')
    expect(hoja.textContent).toContain('Paso 1 · Vaciar la caché')
    expect(hoja.textContent).toContain('ipconfig /flushdns')
    // El dato con forma de contraseña no se envía, y se dice sin repetirlo.
    expect(hoja.textContent).toContain('No se envía un dato técnico: parece un dato protegido.')
    expect(hoja.textContent).not.toContain('Prueba-2026')

    await tocar(await esperarControl('Enviar'))
    await esperar(() => textoPantalla().includes('Enviado'), 'la confirmación')
    expect(enviar).toHaveBeenCalledTimes(1)
    const [id, contenido] = enviar.mock.calls[0]
    expect(id).toBe('sesion-prueba-1')
    expect(JSON.stringify(contenido)).not.toContain('Prueba-2026')
    expect(contenido.bloques.map((b) => b.tipo)).toEqual(['donde', 'accion', 'comando'])
  })

  it('si el servidor rechaza el contenido, lo dice y no da nada por enviado', async () => {
    enviar.mockResolvedValue({ ok: false, error: 'contenido_protegido' })
    await conectarPorPantalla()
    await montar(RUTAS, RUTA_GUIA)
    await tocar(await esperarControl('Enviar a este equipo'))
    await tocar(await esperarControl('Enviar'))
    await esperar(() => textoPantalla().includes(api.TEXTO_ERROR.contenido_protegido), 'el rechazo')
    expect(textoPantalla()).not.toContain('Enviado')
  })

  it('si el computador terminó la sesión, el latido lo detecta y la franja desaparece', async () => {
    await conectarPorPantalla()
    estado.mockResolvedValue({ ok: true, estado: 'cerrada', motivo: 'portal', codigo: '482731' })
    await montar(RUTAS, RUTA_GUIA)
    await esperar(() => !textoPantalla().includes('Equipo 482 731'), 'que la franja desaparezca')
    expect(localStorage.getItem('asistencia:sesion')).toBeNull()
  })
})
