import { describe, expect, it } from 'vitest'
import type { Articulo, CampoProtegido, Credencial, EjecucionDiagnostico } from '../../lib/db'
import {
  borradoresPropios,
  calcularPendientes,
  camposProtegidosPorVencer,
  credencialesPorVencer,
  sugerenciasSinRevisar,
} from './pendientes'

// Fecha local en formato "YYYY-MM-DD", igual a como `estadoVencimiento`
// (vencimiento.ts) interpreta `venceEn`: un día de calendario LOCAL, no
// UTC. Las pruebas de más abajo usaban `toISOString().slice(0, 10)`,
// que arma la fecha en UTC; en un huso detrás de UTC (America/Bogota,
// UTC-5) esa fecha UTC "adelanta" al día siguiente varias horas antes
// de medianoche local, así que "ayer" calculado así podía coincidir
// con el "hoy" local (diasRestantes = 0, "Vence pronto") en vez de dar
// negativo ("Vencida"): la prueba caducaba sola según la hora del día.
function fechaLocal(fecha: Date): string {
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

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
    aplicaA: null,
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
    const enUnMes = fechaLocal(new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000))
    const enUnaSemana = fechaLocal(new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000))
    const ayer = fechaLocal(new Date(hoy.getTime() - 24 * 60 * 60 * 1000))
    const items = credencialesPorVencer([
      credencial({ id: 'c1', titulo: 'Lejana', venceEn: enUnMes }),
      credencial({ id: 'c2', titulo: 'Vencida', venceEn: ayer }),
      credencial({ id: 'c3', titulo: 'Próxima', venceEn: enUnaSemana }),
    ])
    // La lejana cae fuera del periodo de aviso; el resto sale por fecha.
    expect(items.map((i) => i.titulo)).toEqual(['Vencida', 'Próxima'])
  })

  it('lleva la fecha real y los días de calendario en el ítem', () => {
    const hoy = new Date(2026, 8, 11)
    const items = credencialesPorVencer(
      [credencial({ id: 'c1', titulo: 'Panel', venceEn: '2026-09-08' })],
      hoy,
    )
    expect(items[0].fecha).toBe('2026-09-08')
    expect(items[0].diasRestantes).toBe(-3)
    expect(items[0].detalle).toBe('Venció hace 3 días')
  })

  it('no incluye una credencial sin vencimiento ni una eliminada', () => {
    const ayer = fechaLocal(new Date(Date.now() - 24 * 60 * 60 * 1000))
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
    const enUnMes = fechaLocal(new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000))
    const ayer = fechaLocal(new Date(hoy.getTime() - 24 * 60 * 60 * 1000))
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
    expect(items[0].detalle).toBe('Venció hace 1 día · Switch B')
    expect(items[0].ruta).toBe('/dispositivos/d2')
  })

  it('no incluye un campo sin vencimiento, eliminado o sin equipo', () => {
    const ayer = fechaLocal(new Date(Date.now() - 24 * 60 * 60 * 1000))
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

describe('calcularPendientes · orden global por fecha', () => {
  const hoy = new Date(2026, 8, 11)

  // El defecto que cierra el encargo del 2026-09-11: TODAS las
  // credenciales de la Bóveda salían antes que cualquier dato protegido
  // de equipo, aunque la credencial venciera dentro de tres semanas y el
  // dato protegido llevara medio año vencido.
  it('una clave próxima nunca aparece antes que un dato protegido vencido', () => {
    const items = calcularPendientes({
      articulos: [],
      credenciales: [credencial({ id: 'c1', titulo: 'Clave próxima', venceEn: '2026-09-30' })],
      camposProtegidos: [campoProtegido({ id: 'cp1', nombre: 'Dato vencido', dispositivoId: 'd1', venceEn: '2026-03-01' })],
      nombresDispositivosPorId: new Map([['d1', 'Switch A']]),
      ejecuciones: [],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: true,
      hoy,
    })
    expect(items.map((i) => i.titulo)).toEqual(['Dato vencido', 'Clave próxima'])
  })

  it('ordena vencidos (más antiguo primero), luego hoy, luego próximos (más cercano primero)', () => {
    const items = calcularPendientes({
      articulos: [],
      credenciales: [
        credencial({ id: 'c1', titulo: 'Vence en 10 días', venceEn: '2026-09-21' }),
        credencial({ id: 'c2', titulo: 'Vence hoy', venceEn: '2026-09-11' }),
        credencial({ id: 'c3', titulo: 'Venció hace 2 días', venceEn: '2026-09-09' }),
      ],
      camposProtegidos: [
        campoProtegido({ id: 'cp1', nombre: 'Venció hace 30 días', dispositivoId: 'd1', venceEn: '2026-08-12' }),
        campoProtegido({ id: 'cp2', nombre: 'Vence en 3 días', dispositivoId: 'd1', venceEn: '2026-09-14' }),
      ],
      nombresDispositivosPorId: new Map([['d1', 'Switch A']]),
      ejecuciones: [],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: true,
      hoy,
    })
    expect(items.map((i) => i.titulo)).toEqual([
      'Venció hace 30 días',
      'Venció hace 2 días',
      'Vence hoy',
      'Vence en 3 días',
      'Vence en 10 días',
    ])
  })

  it('los borradores y las sugerencias van después de todo lo que tiene fecha', () => {
    const items = calcularPendientes({
      articulos: [articulo({ id: 'a1', estado: 'borrador', updatedBy: 'yo', titulo: 'Mi borrador' })],
      credenciales: [credencial({ id: 'c1', titulo: 'Vence en 10 días', venceEn: '2026-09-21' })],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [ejecucion({ id: 'e1' })],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: true,
      hoy,
    })
    expect(items.map((i) => i.categoria)).toEqual(['credencial', 'borrador', 'sugerencia'])
    expect(items.filter((i) => i.fecha === null).map((i) => i.categoria)).toEqual(['borrador', 'sugerencia'])
  })

  it('sin permiso de bóveda no llega ni un título, tampoco de datos protegidos de equipo', () => {
    const items = calcularPendientes({
      articulos: [],
      credenciales: [credencial({ id: 'c1', titulo: 'Secreto', venceEn: '2026-09-01' })],
      camposProtegidos: [campoProtegido({ id: 'cp1', nombre: 'Dato del switch', dispositivoId: 'd1', venceEn: '2026-09-01' })],
      nombresDispositivosPorId: new Map([['d1', 'Switch A']]),
      ejecuciones: [],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: false,
      hoy,
    })
    expect(items).toEqual([])
  })
})

describe('calcularPendientes', () => {
  it('combina las tres fuentes, credenciales primero, y respeta el límite', () => {
    const ayer = fechaLocal(new Date(Date.now() - 24 * 60 * 60 * 1000))
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
    const ayer = fechaLocal(new Date(Date.now() - 24 * 60 * 60 * 1000))
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
