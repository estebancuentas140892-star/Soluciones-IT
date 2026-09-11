import { describe, expect, it } from 'vitest'
import type { Articulo, CampoProtegido, Credencial, EjecucionDiagnostico } from '../../lib/db'
import { agruparAgenda, asuntosUrgentes, fechaDeHoy, resumenAgenda } from './agenda'
import { calcularPendientes, type ItemPendiente } from './pendientes'
import { tarjetaReanudarVisible } from '../soluciones/useReanudar'
import type { ArticuloSinTerminar } from '../soluciones/sinTerminar'

// La agenda operativa de Inicio (encargo del 2026-09-11). Se prueba
// sobre la salida real de `calcularPendientes`, no sobre ítems
// inventados a mano: lo que importa es que la cadena completa —datos,
// orden global por fecha y reparto en grupos— diga lo mismo que la
// pantalla.

const HOY = new Date(2026, 8, 11) // viernes 11 de septiembre de 2026

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
    updatedAt: '2026-09-10T00:00:00Z',
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
    fechaHora: '2026-09-01T00:00:00Z',
    motivo: 'encontro_otra_solucion',
    solucionPropuesta: 'Reinicié el spooler de impresión',
    ...cambios,
  }
}

// Caso completo: lo hay de todo y de cada grupo.
function pendientesDeEjemplo(puedeVerBoveda = true): ItemPendiente[] {
  return calcularPendientes({
    articulos: [
      articulo({ id: 'a1', estado: 'borrador', updatedBy: 'yo', titulo: 'Cambiar tóner' }),
    ],
    credenciales: [
      credencial({ id: 'c1', titulo: 'Panel del router', venceEn: '2026-08-12' }),
      credencial({ id: 'c2', titulo: 'Correo de soporte', venceEn: '2026-09-11' }),
      credencial({ id: 'c3', titulo: 'Hosting', venceEn: '2026-09-21' }),
    ],
    camposProtegidos: [
      campoProtegido({ id: 'cp1', nombre: 'PIN de la alarma', dispositivoId: 'd1', venceEn: '2026-09-09' }),
      campoProtegido({ id: 'cp2', nombre: 'Clave del NVR', dispositivoId: 'd1', venceEn: '2026-09-14' }),
    ],
    nombresDispositivosPorId: new Map([['d1', 'Switch A']]),
    ejecuciones: [ejecucion({ id: 'e1' })],
    articulosDeSugerencia: [],
    usuarioId: 'yo',
    puedeVerBoveda,
    limite: Infinity,
    hoy: HOY,
  })
}

describe('agruparAgenda', () => {
  it('reparte en Vencidos, Para hoy, Próximos, En curso y Por revisar', () => {
    const agenda = agruparAgenda(pendientesDeEjemplo())
    expect(agenda.vencidos.map((i) => i.titulo)).toEqual(['Panel del router', 'PIN de la alarma'])
    expect(agenda.hoy.map((i) => i.titulo)).toEqual(['Correo de soporte'])
    expect(agenda.proximos.map((i) => i.titulo)).toEqual(['Clave del NVR', 'Hosting'])
    expect(agenda.enCurso.map((i) => i.titulo)).toEqual(['Cambiar tóner'])
    expect(agenda.porRevisar.map((i) => i.titulo)).toEqual(['La impresora no imprime'])
  })

  it('ordena globalmente por fecha, sin mirar de dónde sale el dato', () => {
    const agenda = agruparAgenda(pendientesDeEjemplo())
    // La credencial de Bóveda vencida hace un mes va antes que el dato
    // protegido de equipo vencido hace dos días.
    expect(agenda.vencidos.map((i) => i.origen)).toEqual(['Bóveda', 'Switch A'])
    expect(agenda.vencidos.map((i) => i.diasRestantes)).toEqual([-30, -2])
    // Entre próximos, primero la fecha más cercana.
    expect(agenda.proximos.map((i) => i.diasRestantes)).toEqual([3, 10])
  })

  it('separa el trabajo personal del del equipo', () => {
    const agenda = agruparAgenda(pendientesDeEjemplo())
    expect(agenda.enCurso.every((i) => i.categoria === 'borrador')).toBe(true)
    expect(agenda.porRevisar.every((i) => i.categoria === 'sugerencia')).toBe(true)
    // Un borrador propio no es una obligación con plazo.
    expect(agenda.vencidos.concat(agenda.hoy).some((i) => i.categoria === 'borrador')).toBe(false)
  })

  it('no duplica ningún elemento entre grupos', () => {
    const items = pendientesDeEjemplo()
    const agenda = agruparAgenda(items)
    const repartidos = [
      ...agenda.vencidos,
      ...agenda.hoy,
      ...agenda.proximos,
      ...agenda.enCurso,
      ...agenda.porRevisar,
    ].map((i) => i.clave)
    expect(repartidos).toHaveLength(items.length)
    expect(new Set(repartidos).size).toBe(items.length)
  })

  it('sin permiso de bóveda no reparte ni un dato protegido', () => {
    const agenda = agruparAgenda(pendientesDeEjemplo(false))
    expect(agenda.vencidos).toEqual([])
    expect(agenda.hoy).toEqual([])
    expect(agenda.proximos).toEqual([])
    // Lo que no depende de la bóveda se sigue viendo.
    expect(agenda.enCurso).toHaveLength(1)
    expect(agenda.porRevisar).toHaveLength(1)
  })
})

describe('asuntosUrgentes', () => {
  it('cuenta solo lo vencido y lo de hoy', () => {
    expect(asuntosUrgentes(agruparAgenda(pendientesDeEjemplo()))).toBe(3)
  })

  it('no cuenta próximos, borradores ni sugerencias del equipo', () => {
    const soloDiferido = calcularPendientes({
      articulos: [articulo({ id: 'a1', estado: 'borrador', updatedBy: 'yo', titulo: 'Borrador' })],
      credenciales: [credencial({ id: 'c1', titulo: 'Hosting', venceEn: '2026-09-21' })],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [ejecucion({ id: 'e1' })],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: true,
      limite: Infinity,
      hoy: HOY,
    })
    expect(asuntosUrgentes(agruparAgenda(soloDiferido))).toBe(0)
  })

  it('es cero cuando no hay nada: la pestaña no muestra número', () => {
    expect(asuntosUrgentes(agruparAgenda([]))).toBe(0)
  })
})

describe('resumenAgenda', () => {
  it('escribe la frase con las tres categorías con fecha', () => {
    expect(resumenAgenda(agruparAgenda(pendientesDeEjemplo()))).toBe('2 vencidos · 1 para hoy · 2 próximos')
  })

  it('no nombra las categorías vacías', () => {
    const soloProximos = calcularPendientes({
      articulos: [],
      credenciales: [credencial({ id: 'c1', titulo: 'Hosting', venceEn: '2026-09-21' })],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [],
      articulosDeSugerencia: [],
      usuarioId: 'yo',
      puedeVerBoveda: true,
      limite: Infinity,
      hoy: HOY,
    })
    expect(resumenAgenda(agruparAgenda(soloProximos))).toBe('1 próximo')
  })

  // El estado "Todo al día por hoy" de la pantalla es exactamente esto:
  // cero urgentes. Que haya próximos no lo convierte en alarma.
  it('queda vacío y sin urgentes cuando no hay nada con fecha', () => {
    const agenda = agruparAgenda([])
    expect(resumenAgenda(agenda)).toBe('')
    expect(asuntosUrgentes(agenda)).toBe(0)
  })
})

describe('fechaDeHoy', () => {
  it('escribe el día en español y con inicial mayúscula', () => {
    expect(fechaDeHoy(HOY)).toMatch(/^[A-ZÁÉÍÓÚ]/)
    expect(fechaDeHoy(HOY)).toContain('septiembre')
  })
})

describe('reanudación de una guía en la agenda', () => {
  const A_MEDIAS = {
    articulo: { id: 'a9' },
    hechos: 2,
    total: 5,
    minutosRestantes: 9,
  } as unknown as ArticuloSinTerminar

  it('la guía a medias entra en "En curso" y se puede descartar', () => {
    expect(tarjetaReanudarVisible({ actual: A_MEDIAS, descartado: false })).toBe(true)
    expect(tarjetaReanudarVisible({ actual: A_MEDIAS, descartado: true })).toBe(false)
  })

  it('no cuenta como asunto urgente', () => {
    expect(asuntosUrgentes(agruparAgenda([]))).toBe(0)
  })
})
