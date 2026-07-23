import { describe, expect, it } from 'vitest'
import type { Articulo, CampoProtegido, Credencial, EjecucionDiagnostico } from '../../lib/db'
import {
  borradoresPropios,
  calcularPendientes,
  camposProtegidosPorVencer,
  credencialesPorVencer,
  sugerenciasSinRevisar,
} from './pendientes'

function articulo(cambios: Partial<Articulo> & { id: string }): Articulo {
  return {
    categoriaId: 'cat-1',
    titulo: 'Artículo',
    tipo: 'manual',
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    origenSugerenciaId: null,
    updatedAt: '2026-07-01T00:00:00Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function credencial(cambios: Partial<Credencial> & { id: string; titulo: string }): Credencial {
  return {
    categoria: '',
    tipo: 'cuenta',
    datosCifrados: '',
    venceEn: null,
    dispositivos: [],
    archivo: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function campoProtegido(cambios: Partial<CampoProtegido> & { id: string; nombre: string }): CampoProtegido {
  return {
    dispositivoId: 'd1',
    tipo: 'contrasena',
    valorCifrado: '',
    orden: 0,
    venceEn: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function ejecucion(cambios: Partial<EjecucionDiagnostico> & { id: string }): EjecucionDiagnostico {
  return {
    diagnosticoId: 'd1',
    diagnosticoTitulo: 'La impresora no imprime',
    usuario: null,
    usuarioNombre: '',
    camino: [],
    articulosEjecutados: [],
    resuelto: 'no',
    duracionSegundos: 0,
    fechaHora: '2026-07-01T00:00:00Z',
    motivo: 'encontro_otra_solucion',
    solucionPropuesta: 'Reinicié el spooler de impresión',
    ...cambios,
  }
}

describe('borradoresPropios', () => {
  it('lista solo los borradores del usuario dado, más recientes primero', () => {
    const items = borradoresPropios(
      [
        articulo({ id: 'a1', estado: 'borrador', updatedBy: 'yo', updatedAt: '2026-07-01T00:00:00Z', titulo: 'Viejo' }),
        articulo({ id: 'a2', estado: 'borrador', updatedBy: 'yo', updatedAt: '2026-07-05T00:00:00Z', titulo: 'Nuevo' }),
        articulo({ id: 'a3', estado: 'borrador', updatedBy: 'otro', titulo: 'De otro técnico' }),
        articulo({ id: 'a4', estado: 'publicado', updatedBy: 'yo', titulo: 'Ya publicado' }),
      ],
      'yo',
    )
    expect(items.map((i) => i.titulo)).toEqual(['Nuevo', 'Viejo'])
  })

  it('ignora un borrador eliminado', () => {
    const items = borradoresPropios(
      [articulo({ id: 'a1', estado: 'borrador', updatedBy: 'yo', eliminadoEn: '2026-07-01T00:00:00Z' })],
      'yo',
    )
    expect(items).toEqual([])
  })
})

describe('credencialesPorVencer', () => {
  it('incluye vencidas y próximas, vencidas primero', () => {
    const hoy = new Date()
    const enUnMes = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const items = credencialesPorVencer([
      credencial({ id: 'c1', titulo: 'Lejana', venceEn: enUnMes }),
      credencial({ id: 'c2', titulo: 'Vencida', venceEn: ayer }),
    ])
    expect(items.map((i) => i.titulo)).toEqual(['Vencida'])
  })

  it('no incluye una credencial sin vencimiento ni una eliminada', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(
      credencialesPorVencer([
        credencial({ id: 'c1', titulo: 'Sin fecha' }),
        credencial({ id: 'c2', titulo: 'Vencida y eliminada', venceEn: ayer, eliminadoEn: '2026-07-01T00:00:00Z' }),
      ]),
    ).toEqual([])
  })
})

describe('camposProtegidosPorVencer', () => {
  it('incluye vencidos y próximos, vencidos primero, con el nombre vivo del equipo', () => {
    const hoy = new Date()
    const enUnMes = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const items = camposProtegidosPorVencer(
      [
        campoProtegido({ id: 'cp1', nombre: 'Lejana', dispositivoId: 'd1', venceEn: enUnMes }),
        campoProtegido({ id: 'cp2', nombre: 'Vencida', dispositivoId: 'd2', venceEn: ayer }),
      ],
      new Map([
        ['d1', 'Switch A'],
        ['d2', 'Switch B'],
      ]),
    )
    expect(items.map((i) => i.titulo)).toEqual(['Vencida'])
    expect(items[0].detalle).toBe('Vencida · Switch B')
    expect(items[0].ruta).toBe('/dispositivos/d2')
  })

  it('no incluye un campo sin vencimiento, eliminado o sin equipo', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(
      camposProtegidosPorVencer(
        [
          campoProtegido({ id: 'cp1', nombre: 'Sin fecha', dispositivoId: 'd1' }),
          campoProtegido({ id: 'cp2', nombre: 'Vencido y eliminado', dispositivoId: 'd1', venceEn: ayer, eliminadoEn: '2026-07-01T00:00:00Z' }),
          campoProtegido({ id: 'cp3', nombre: 'Sin equipo', dispositivoId: null, venceEn: ayer }),
        ],
        new Map([['d1', 'Switch A']]),
      ),
    ).toEqual([])
  })
})

describe('sugerenciasSinRevisar', () => {
  it('incluye solo las de motivo "encontro_otra_solucion" con texto', () => {
    const items = sugerenciasSinRevisar([
      ejecucion({ id: 'e1', motivo: 'encontro_otra_solucion', solucionPropuesta: 'Reinicié el spooler' }),
      ejecucion({ id: 'e2', motivo: 'no_funciono', solucionPropuesta: '' }),
      ejecucion({ id: 'e3', motivo: 'encontro_otra_solucion', solucionPropuesta: '   ' }),
    ], [])
    expect(items.map((i) => i.clave)).toEqual(['sugerencia:e1'])
  })

  // Cierre del bucle sugerencia -> borrador (tarea 140, hallazgo K2).
  it('excluye una sugerencia que ya se convirtió en artículo', () => {
    const ejecuciones = [
      ejecucion({ id: 'e1', motivo: 'encontro_otra_solucion', solucionPropuesta: 'Reinicié el spooler' }),
      ejecucion({ id: 'e2', motivo: 'encontro_otra_solucion', solucionPropuesta: 'Cambié el cable' }),
    ]
    const items = sugerenciasSinRevisar(ejecuciones, [
      articulo({ id: 'a1', origenSugerenciaId: 'e1' }),
    ])
    expect(items.map((i) => i.clave)).toEqual(['sugerencia:e2'])
  })

  // Si se borra el artículo que la atendía, la sugerencia vuelve a estar
  // pendiente: nadie la está resolviendo ya.
  it('vuelve a incluirla si el artículo que la atendía fue eliminado', () => {
    const items = sugerenciasSinRevisar(
      [ejecucion({ id: 'e1', motivo: 'encontro_otra_solucion', solucionPropuesta: 'Reinicié el spooler' })],
      [articulo({ id: 'a1', origenSugerenciaId: 'e1', eliminadoEn: '2026-07-20T00:00:00Z' })],
    )
    expect(items.map((i) => i.clave)).toEqual(['sugerencia:e1'])
  })
})

describe('calcularPendientes', () => {
  it('combina las tres fuentes, credenciales primero, y respeta el límite', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const items = calcularPendientes({
      articulos: [articulo({ id: 'a1', estado: 'borrador', updatedBy: 'yo', titulo: 'Mi borrador' })],
      credenciales: [credencial({ id: 'c1', titulo: 'Vencida', venceEn: ayer })],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [ejecucion({ id: 'e1' })],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: true,
      limite: 2,
    })
    expect(items).toHaveLength(2)
    expect(items[0].clave).toBe('credencial:c1')
  })

  it('sin permiso de bóveda, no incluye credenciales aunque estén vencidas', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const items = calcularPendientes({
      articulos: [],
      credenciales: [credencial({ id: 'c1', titulo: 'Vencida', venceEn: ayer })],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: false,
    })
    expect(items).toEqual([])
  })

  // Regresión de un defecto encontrado verificando la tarea 140 en el
  // navegador: `articulos` trae SOLO los borradores (así lo consulta
  // InicioPage), así que si el cierre del bucle se leyera de ahí,
  // publicar el artículo devolvería la sugerencia a los pendientes.
  // Publicar es el cierre más fuerte que existe, no el más débil.
  it('una sugerencia ya redactada no vuelve a pendientes al publicar el artículo', () => {
    const yaRedactada = articulo({
      id: 'a1',
      estado: 'publicado',
      titulo: 'La impresora no imprime',
      origenSugerenciaId: 'e1',
    })
    const items = calcularPendientes({
      // El artículo publicado ya no está entre los borradores.
      articulos: [],
      credenciales: [],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [ejecucion({ id: 'e1' })],
      articulosDeSugerencia: [yaRedactada],
      usuarioId: 'yo',
      puedeVerBoveda: true,
    })
    expect(items).toEqual([])
  })
})
