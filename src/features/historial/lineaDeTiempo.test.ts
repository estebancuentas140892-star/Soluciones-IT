import { describe, expect, it } from 'vitest'
import type { AccesoBoveda, EjecucionDiagnostico, HistorialEntrada } from '../../lib/db'
import { combinarEventos, etiquetaResuelto, formatearDuracion, ETIQUETA_ACCION_BOVEDA } from './lineaDeTiempo'

function entrada(cambios: Partial<HistorialEntrada> & { id: string; fechaHora: string }): HistorialEntrada {
  return {
    entidadTipo: 'articulo',
    entidadId: 'a1',
    usuario: 'u1',
    usuarioNombre: 'Ana',
    campo: 'titulo',
    valorAnterior: '',
    valorNuevo: '',
    motivo: '',
    ...cambios,
  }
}

function ejecucion(cambios: Partial<EjecucionDiagnostico> & { id: string; fechaHora: string }): EjecucionDiagnostico {
  return {
    diagnosticoId: 'd1',
    diagnosticoTitulo: 'La impresora no imprime',
    usuario: 'u1',
    usuarioNombre: 'Ana',
    camino: [],
    articulosEjecutados: [{ id: 'a1', titulo: 'Reiniciar spooler' }],
    resuelto: 'si',
    duracionSegundos: 120,
    motivo: '',
    solucionPropuesta: '',
    ...cambios,
  }
}

function acceso(cambios: Partial<AccesoBoveda> & { id: string; fechaHora: string }): AccesoBoveda {
  return {
    entidadTipo: 'credencial',
    credencialId: 'c1',
    credencialTitulo: 'Admin router',
    usuario: 'u1',
    usuarioNombre: 'Ana',
    accion: 'consulto',
    ...cambios,
  }
}

describe('combinarEventos', () => {
  it('fusiona las tres fuentes en una sola lista', () => {
    const eventos = combinarEventos(
      [entrada({ id: 'h1', fechaHora: '2026-01-01T10:00:00Z' })],
      [ejecucion({ id: 'e1', fechaHora: '2026-01-02T10:00:00Z' })],
      [acceso({ id: 'a1', fechaHora: '2026-01-03T10:00:00Z' })],
    )
    expect(eventos.map((e) => e.tipo)).toEqual(['acceso_boveda', 'ejecucion_diagnostico', 'historial'])
  })

  it('ordena de mas reciente a mas antiguo, sin importar la fuente', () => {
    const eventos = combinarEventos(
      [
        entrada({ id: 'h1', fechaHora: '2026-01-05T10:00:00Z' }),
        entrada({ id: 'h2', fechaHora: '2026-01-01T10:00:00Z' }),
      ],
      [ejecucion({ id: 'e1', fechaHora: '2026-01-03T10:00:00Z' })],
    )
    expect(eventos.map((e) => (e.tipo === 'historial' ? e.entrada.id : e.tipo === 'ejecucion_diagnostico' ? e.ejecucion.id : ''))).toEqual([
      'h1',
      'e1',
      'h2',
    ])
  })

  it('funciona solo con historial, sin ejecuciones ni accesos (caso dispositivo/diagnóstico/categoría)', () => {
    const eventos = combinarEventos([entrada({ id: 'h1', fechaHora: '2026-01-01T10:00:00Z' })])
    expect(eventos).toHaveLength(1)
    expect(eventos[0].tipo).toBe('historial')
  })

  it('devuelve vacío sin ninguna fuente', () => {
    expect(combinarEventos([])).toEqual([])
  })
})

describe('formatearDuracion', () => {
  it('muestra segundos solos por debajo de un minuto', () => {
    expect(formatearDuracion(45)).toBe('45 s')
  })

  it('muestra minutos exactos sin segundos sueltos', () => {
    expect(formatearDuracion(180)).toBe('3 min')
  })

  it('muestra minutos y segundos combinados', () => {
    expect(formatearDuracion(200)).toBe('3 min 20 s')
  })
})

describe('etiquetaResuelto', () => {
  it('traduce los 3 estados posibles', () => {
    expect(etiquetaResuelto('si')).toBe('Resuelto')
    expect(etiquetaResuelto('no')).toBe('No resuelto')
    expect(etiquetaResuelto('abandonado')).toBe('Abandonado')
  })
})

describe('ETIQUETA_ACCION_BOVEDA', () => {
  it('tiene una etiqueta legible para las 6 acciones posibles', () => {
    const acciones: AccesoBoveda['accion'][] = [
      'consulto',
      'mostro',
      'copio_usuario',
      'copio_contrasena',
      'modifico',
      'elimino',
    ]
    for (const accion of acciones) {
      expect(ETIQUETA_ACCION_BOVEDA[accion]).toBeTruthy()
    }
  })
})
