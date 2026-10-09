import { describe, expect, it } from 'vitest'
import type { Dispositivo, Persona } from '../../lib/db'
import { lineaDeContexto } from '../../lib/contextoEquipo'
import { areaDeQuienLoTiene, partesDelSubtitulo, personaQueLoTiene, type PersonasPorId } from './responsableEnLista'

// La línea bajo el nombre en la lista de Equipos (tarea 317): quién tiene
// el equipo y de qué área es, leída de la ficha de la persona, antes que
// la categoría que el icono ya dice. Todo es inventado.

type EquipoLista = Pick<Dispositivo, 'nombre' | 'responsable' | 'responsableId' | 'estado' | 'eliminadoEn'>

function equipo(cambios: Partial<EquipoLista> = {}): EquipoLista {
  return { nombre: 'metrojp19', responsable: '', responsableId: null, estado: 'operativo', eliminadoEn: null, ...cambios }
}

function personas(...lista: [string, Partial<Pick<Persona, 'nombre' | 'area' | 'eliminadoEn'>>][]): PersonasPorId {
  return new Map(lista.map(([id, p]) => [id, { nombre: '', area: '', eliminadoEn: null, ...p }]))
}

const CONTEXTO = ['Computadores', 'Administración']

const PERSONAS = personas(
  ['esteban', { nombre: 'Esteban Cardona Rendón', area: 'Control Interno' }],
  ['ana', { nombre: 'Ana Gil', area: 'TI' }],
  ['maria', { nombre: 'María Fernanda Restrepo Echeverri', area: 'Gestión Administrativa y Financiera' }],
  ['sin-area', { nombre: 'Esteban Cardona Rendón', area: '' }],
  ['espacios', { nombre: 'Esteban Cardona Rendón', area: '   ' }],
  ['eliminada', { nombre: 'Persona eliminada de prueba', area: 'Control Interno', eliminadoEn: '2026-09-01T00:00:00.000Z' }],
)

/** La línea tal como la dibuja la lista: las partes unidas con " · ". */
function linea(cambios: Partial<EquipoLista>, mapa: PersonasPorId = PERSONAS): string {
  const d = equipo(cambios)
  return lineaDeContexto(d.nombre, partesDelSubtitulo(d, CONTEXTO, mapa))
}

describe('partesDelSubtitulo', () => {
  it('una persona vinculada con área: su nombre y su área, no la categoría', () => {
    expect(linea({ responsable: 'Esteban Cardona Rendón', responsableId: 'esteban' })).toBe(
      'Esteban Cardona Rendón · Control Interno',
    )
  })

  it('sin área, solo el nombre: sin separador sobrante ni "Sin área"', () => {
    expect(linea({ responsableId: 'sin-area' })).toBe('Esteban Cardona Rendón')
    expect(linea({ responsableId: 'espacios' })).toBe('Esteban Cardona Rendón')
    const texto = linea({ responsableId: 'sin-area' })
    expect(texto).not.toContain('·')
    expect(texto).not.toMatch(/sin área/i)
  })

  it('una persona guardada antes de que existiera el área se lee sin ella', () => {
    const antigua = new Map([['vieja', { nombre: 'Ana Gil', eliminadoEn: null } as Pick<Persona, 'nombre' | 'area' | 'eliminadoEn'>]])
    expect(linea({ responsableId: 'vieja' }, antigua)).toBe('Ana Gil')
  })

  it('nombres y áreas largos llegan enteros: el recorte lo decide la fila, no la lógica', () => {
    expect(linea({ responsableId: 'maria' })).toBe('María Fernanda Restrepo Echeverri · Gestión Administrativa y Financiera')
    expect(linea({ responsableId: 'ana' })).toBe('Ana Gil · TI')
  })

  it('un responsable escrito sin ficha se dice anotado y por validar, sin inventar área', () => {
    const texto = linea({ responsable: 'Archivo' })
    expect(texto).toBe('Anotado: «Archivo» · por validar')
    expect(texto).not.toContain('Control Interno')
  })

  it('sin responsable conserva el contexto de siempre', () => {
    expect(linea({})).toBe('Computadores · Administración')
  })

  it('una persona eliminada no se presenta como quien tiene el equipo', () => {
    expect(linea({ responsable: 'Persona eliminada de prueba', responsableId: 'eliminada' })).toBe(
      'Computadores · Administración',
    )
    // Tampoco una ficha que no está cargada (borrada del todo o sin bajar).
    expect(linea({ responsable: 'Alguien', responsableId: 'no-existe' })).toBe('Computadores · Administración')
  })

  it('un equipo de baja no lo tiene nadie: vuelve al contexto', () => {
    expect(linea({ estado: 'De baja', responsableId: 'esteban' })).toBe('Computadores · Administración')
    expect(linea({ estado: 'De baja', responsable: 'Archivo' })).toBe('Computadores · Administración')
  })

  it('el nombre del equipo que ya dice el área la calla (regla 22), nunca a la persona', () => {
    expect(linea({ nombre: 'PC TI 3', responsableId: 'ana' })).toBe('Ana Gil')
  })

  it('el nombre es el de la ficha viva, no la copia vieja del equipo', () => {
    expect(linea({ responsable: 'Esteban Cardona', responsableId: 'esteban' })).toBe(
      'Esteban Cardona Rendón · Control Interno',
    )
  })
})

describe('personaQueLoTiene y areaDeQuienLoTiene', () => {
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

  it('si la persona cambia de área, el equipo dice la nueva sin tocar el equipo', () => {
    const d = equipo({ responsableId: 'esteban' })
    const antes = areaDeQuienLoTiene(d, PERSONAS)
    const despues = areaDeQuienLoTiene(d, personas(['esteban', { nombre: 'Esteban Cardona Rendón', area: 'Tesorería' }]))
    expect([antes, despues]).toEqual(['Control Interno', 'Tesorería'])
    expect(d).toEqual(equipo({ responsableId: 'esteban' }))
  })
})
