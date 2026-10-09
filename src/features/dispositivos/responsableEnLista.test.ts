import { describe, expect, it } from 'vitest'
import type { Dispositivo, Persona } from '../../lib/db'
import { lineaDeContexto } from '../../lib/contextoEquipo'
import {
  anotadoEnLista,
  areaDeQuienLoTiene,
  partesDelSubtitulo,
  personaQueLoTiene,
  type ContextoDeEquipo,
  type PersonasPorId,
} from './responsableEnLista'

// La línea bajo el nombre en la lista de Equipos (tarea 317): quién tiene
// el equipo, de qué área es (leída de la ficha de la persona) y dónde está
// el equipo, antes que la categoría que el icono ya dice. Todo es
// inventado.

type EquipoLista = Pick<Dispositivo, 'nombre' | 'responsable' | 'responsableId' | 'estado' | 'eliminadoEn'>

function equipo(cambios: Partial<EquipoLista> = {}): EquipoLista {
  return { nombre: 'metrojp19', responsable: '', responsableId: null, estado: 'operativo', eliminadoEn: null, ...cambios }
}

function personas(...lista: [string, Partial<Pick<Persona, 'nombre' | 'area' | 'eliminadoEn'>>][]): PersonasPorId {
  return new Map(lista.map(([id, p]) => [id, { nombre: '', area: '', eliminadoEn: null, ...p }]))
}

const CONTEXTO: ContextoDeEquipo = { categoria: 'Computadores', ubicacion: 'Caja Parque de Prueba' }
const SIN_UBICACION: ContextoDeEquipo = { categoria: 'Computadores', ubicacion: '' }

const PERSONAS = personas(
  ['esteban', { nombre: 'Esteban Cardona Rendón', area: 'Control Interno' }],
  ['lucia', { nombre: 'Lucía Santa de Prueba', area: 'UEN Parque de Prueba' }],
  ['sistemas', { nombre: 'Esteban Cardona Rendón', area: 'Sistemas' }],
  ['ana', { nombre: 'Ana Gil', area: 'TI' }],
  ['maria', { nombre: 'María Fernanda Restrepo Echeverri', area: 'Gestión Administrativa y Financiera' }],
  ['sin-area', { nombre: 'Esteban Cardona Rendón', area: '' }],
  ['espacios', { nombre: 'Esteban Cardona Rendón', area: '   ' }],
  ['eliminada', { nombre: 'Persona eliminada de prueba', area: 'Control Interno', eliminadoEn: '2026-09-01T00:00:00.000Z' }],
)

/** La línea tal como la dibuja la lista: las partes unidas con " · ". */
function linea(cambios: Partial<EquipoLista>, contexto: ContextoDeEquipo = CONTEXTO, mapa: PersonasPorId = PERSONAS): string {
  const d = equipo(cambios)
  return lineaDeContexto(d.nombre, partesDelSubtitulo(d, contexto, mapa))
}

describe('partesDelSubtitulo: persona, área y ubicación', () => {
  it('persona, área y ubicación distintas: las tres, en ese orden, sin la categoría', () => {
    expect(linea({ nombre: 'metrojp43', responsableId: 'lucia' })).toBe(
      'Lucía Santa de Prueba · UEN Parque de Prueba · Caja Parque de Prueba',
    )
  })

  it('si el área y la ubicación son la misma, se dice una vez', () => {
    const sistemas = { categoria: 'Computadores', ubicacion: 'Sistemas' }
    expect(linea({ nombre: 'metrojp62', responsableId: 'sistemas' }, sistemas)).toBe('Esteban Cardona Rendón · Sistemas')
    // Con la normalización de siempre: sin contar mayúsculas ni tildes.
    for (const ubicacion of ['SISTEMAS', 'sístemas']) {
      expect(linea({ nombre: 'metrojp62', responsableId: 'sistemas' }, { ...sistemas, ubicacion })).toBe(
        'Esteban Cardona Rendón · Sistemas',
      )
    }
  })

  it('una persona sin área: su nombre y la ubicación, sin separador sobrante ni "Sin área"', () => {
    expect(linea({ responsableId: 'sin-area' })).toBe('Esteban Cardona Rendón · Caja Parque de Prueba')
    expect(linea({ responsableId: 'espacios' })).toBe('Esteban Cardona Rendón · Caja Parque de Prueba')
    expect(linea({ responsableId: 'sin-area' })).not.toMatch(/sin área/i)
  })

  it('sin ubicación: la persona y su área', () => {
    expect(linea({ responsableId: 'esteban' }, SIN_UBICACION)).toBe('Esteban Cardona Rendón · Control Interno')
    expect(linea({ responsableId: 'ana' }, SIN_UBICACION)).toBe('Ana Gil · TI')
  })

  it('solo la persona, sin área ni ubicación: únicamente su nombre', () => {
    const texto = linea({ responsableId: 'sin-area' }, SIN_UBICACION)
    expect(texto).toBe('Esteban Cardona Rendón')
    expect(texto).not.toContain('·')
  })

  it('una persona guardada antes de que existiera el área se lee con su nombre y la ubicación', () => {
    const antigua = new Map([['vieja', { nombre: 'Ana Gil', eliminadoEn: null } as Pick<Persona, 'nombre' | 'area' | 'eliminadoEn'>]])
    expect(linea({ responsableId: 'vieja' }, CONTEXTO, antigua)).toBe('Ana Gil · Caja Parque de Prueba')
  })

  it('nombres, áreas y ubicaciones largos llegan enteros: el recorte lo decide la fila, no la lógica', () => {
    expect(linea({ responsableId: 'maria' }, { categoria: 'Computadores', ubicacion: 'Bodega central del parque de prueba' })).toBe(
      'María Fernanda Restrepo Echeverri · Gestión Administrativa y Financiera · Bodega central del parque de prueba',
    )
  })

  it('el nombre del equipo que ya dice la ubicación la calla (regla 22), nunca a la persona', () => {
    expect(linea({ nombre: 'PC Caja Parque de Prueba 2', responsableId: 'ana' })).toBe('Ana Gil · TI')
  })

  it('el nombre es el de la ficha viva, no la copia vieja del equipo', () => {
    expect(linea({ responsable: 'Esteban Cardona', responsableId: 'esteban' }, SIN_UBICACION)).toBe(
      'Esteban Cardona Rendón · Control Interno',
    )
  })
})

describe('partesDelSubtitulo: sin persona vinculada', () => {
  it('un responsable escrito sin ficha: anotado y por validar, con la ubicación y sin inventar área', () => {
    expect(linea({ responsable: 'Archivo' })).toBe('Anotado: «Archivo» · por validar · Caja Parque de Prueba')
    expect(linea({ responsable: 'Archivo' }, SIN_UBICACION)).toBe('Anotado: «Archivo» · por validar')
    expect(linea({ responsable: 'Archivo' })).not.toContain('Control Interno')
  })

  it('sin responsable conserva categoría y ubicación', () => {
    expect(linea({})).toBe('Computadores · Caja Parque de Prueba')
    expect(linea({}, SIN_UBICACION)).toBe('Computadores')
  })

  it('una persona eliminada no se presenta como quien tiene el equipo', () => {
    expect(linea({ responsable: 'Persona eliminada de prueba', responsableId: 'eliminada' })).toBe(
      'Computadores · Caja Parque de Prueba',
    )
    // Tampoco una ficha que no está cargada (borrada del todo o sin bajar).
    expect(linea({ responsable: 'Alguien', responsableId: 'no-existe' })).toBe('Computadores · Caja Parque de Prueba')
  })

  it('un equipo de baja no lo tiene nadie: vuelve a categoría y ubicación', () => {
    expect(linea({ estado: 'De baja', responsableId: 'esteban' })).toBe('Computadores · Caja Parque de Prueba')
    expect(linea({ estado: 'De baja', responsable: 'Archivo' })).toBe('Computadores · Caja Parque de Prueba')
  })
})

describe('personaQueLoTiene, areaDeQuienLoTiene y anotadoEnLista', () => {
  it('leen la persona por responsableId y el área de su ficha', () => {
    const d = equipo({ responsableId: 'esteban' })
    expect(personaQueLoTiene(d, PERSONAS)?.nombre).toBe('Esteban Cardona Rendón')
    expect(areaDeQuienLoTiene(d, PERSONAS)).toBe('Control Interno')
  })

  it('sin persona viva o con el equipo de baja, no hay área', () => {
    expect(areaDeQuienLoTiene(equipo({ responsableId: 'eliminada' }), PERSONAS)).toBe('')
    expect(areaDeQuienLoTiene(equipo({ responsableId: 'esteban', estado: 'De baja' }), PERSONAS)).toBe('')
    expect(areaDeQuienLoTiene(equipo(), PERSONAS)).toBe('')
  })

  it('el nombre anotado solo cuenta sin ficha vinculada y fuera de una baja', () => {
    expect(anotadoEnLista(equipo({ responsable: ' Archivo ' }))).toBe('Archivo')
    expect(anotadoEnLista(equipo({ responsable: 'Archivo', estado: 'De baja' }))).toBe('')
    expect(anotadoEnLista(equipo({ responsable: 'Esteban', responsableId: 'esteban' }))).toBe('')
  })

  it('si la persona cambia de área, el equipo dice la nueva sin tocar el equipo', () => {
    const d = equipo({ responsableId: 'esteban' })
    const antes = areaDeQuienLoTiene(d, PERSONAS)
    const despues = areaDeQuienLoTiene(d, personas(['esteban', { nombre: 'Esteban Cardona Rendón', area: 'Tesorería' }]))
    expect([antes, despues]).toEqual(['Control Interno', 'Tesorería'])
    expect(d).toEqual(equipo({ responsableId: 'esteban' }))
  })
})
