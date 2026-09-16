import { describe, expect, it } from 'vitest'
import { filaNavega, ofreceAccionDirecta, vistaRapidaDe } from './modoConsulta'
import type { TipoResultado } from './useIndiceBusqueda'

// LAS REGLAS DEL MODO CONSULTA (encargo del 2026-09-16, secciones 8 a 10).
// De ellas depende que un toque accidental en el buscador no saque al
// técnico de una guía en ejecución, así que se fijan aquí además de en
// las pruebas de flujo.

const TODOS: TipoResultado[] = [
  'articulo',
  'dispositivo',
  'credencial',
  'diagnostico',
  'categoria',
  'adjunto',
  'ubicacion',
  'persona',
  'herramienta',
  'termino',
  'atajo',
  'comando',
]

describe('filaNavega', () => {
  it('fuera de una tarea la fila abre su ficha, como siempre', () => {
    expect(filaNavega('normal')).toBe(true)
  })

  it('en modo consulta NINGUNA fila navega', () => {
    expect(filaNavega('consulta')).toBe(false)
  })
})

describe('ofreceAccionDirecta (caso F: no iniciar otra guía durante una guía)', () => {
  it('en modo consulta no se ofrece empezar, continuar ni repetir una guía, ni iniciar un diagnóstico', () => {
    expect(ofreceAccionDirecta('articulo', 'consulta')).toBe(false)
    expect(ofreceAccionDirecta('diagnostico', 'consulta')).toBe(false)
  })

  it('copiar una credencial, un comando o un atajo sigue: no abandona nada', () => {
    expect(ofreceAccionDirecta('credencial', 'consulta')).toBe(true)
    expect(ofreceAccionDirecta('comando', 'consulta')).toBe(true)
    expect(ofreceAccionDirecta('atajo', 'consulta')).toBe(true)
  })

  it('fuera de una tarea todas las acciones siguen disponibles', () => {
    for (const tipo of TODOS) expect(ofreceAccionDirecta(tipo, 'normal')).toBe(true)
  })
})

describe('vistaRapidaDe', () => {
  const resultado = (tipo: TipoResultado, id = `${tipo}:1`) => ({ id, tipo })

  it('una credencial tiene vista rápida en los dos modos', () => {
    expect(vistaRapidaDe(resultado('credencial'), 'normal')).toBe('credencial')
    expect(vistaRapidaDe(resultado('credencial'), 'consulta')).toBe('credencial')
  })

  it('fuera de una tarea, nada más la tiene: el resto abre su ficha', () => {
    for (const tipo of TODOS.filter((t) => t !== 'credencial')) {
      expect(vistaRapidaDe(resultado(tipo), 'normal')).toBeNull()
    }
  })

  it('en consulta, comandos y atajos se ven y se copian dentro de la capa', () => {
    expect(vistaRapidaDe(resultado('comando'), 'consulta')).toBe('comando')
    expect(vistaRapidaDe(resultado('atajo'), 'consulta')).toBe('comando')
  })

  it('en consulta, un término y una herramienta abren su ficha rápida dentro de la capa (caso G)', () => {
    expect(vistaRapidaDe(resultado('termino'), 'consulta')).toBe('referencia')
    expect(vistaRapidaDe(resultado('herramienta'), 'consulta')).toBe('referencia')
  })

  it('en consulta, un equipo se ve en compacto; un dato protegido de un equipo no', () => {
    expect(vistaRapidaDe(resultado('dispositivo', 'dispositivo:eq-1'), 'consulta')).toBe('equipo')
    expect(vistaRapidaDe(resultado('dispositivo', 'campo:pin-1'), 'consulta')).toBeNull()
  })

  it('en consulta, una guía, un diagnóstico y el resto quedan como referencia sin vista', () => {
    for (const tipo of ['articulo', 'diagnostico', 'categoria', 'adjunto', 'ubicacion', 'persona'] as const) {
      expect(vistaRapidaDe(resultado(tipo), 'consulta')).toBeNull()
    }
  })
})
