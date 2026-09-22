import { describe, expect, it } from 'vitest'
import {
  ATAJOS_APP,
  atajosVisibles,
  esCampoEditable,
  resolverAtajo,
  tieneModificador,
  type ContextoAtajo,
} from './atajosApp'

function tecla(key: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...extra }
}

const NORMAL: ContextoAtajo = { secuenciaActiva: false, puedeVerBoveda: true, navegacion: true }

describe('resolverAtajo', () => {
  it('la barra abre el buscador global y la interrogación la ayuda', () => {
    expect(resolverAtajo(tecla('/'), NORMAL)).toEqual({ tipo: 'buscar' })
    expect(resolverAtajo(tecla('?'), NORMAL)).toEqual({ tipo: 'ayuda' })
  })

  it('la G inicia la secuencia y la segunda tecla lleva a su sección', () => {
    expect(resolverAtajo(tecla('g'), NORMAL)).toEqual({ tipo: 'esperar' })
    const enSecuencia = { ...NORMAL, secuenciaActiva: true }
    // Encargo del 2026-09-22: los cuatro destinos principales y el catálogo.
    expect(resolverAtajo(tecla('r'), enSecuencia)).toEqual({ tipo: 'ir', ruta: '/' })
    expect(resolverAtajo(tecla('e'), enSecuencia)).toEqual({ tipo: 'ir', ruta: '/dispositivos' })
    expect(resolverAtajo(tecla('b'), enSecuencia)).toEqual({ tipo: 'ir', ruta: '/boveda' })
    expect(resolverAtajo(tecla('m'), enSecuencia)).toEqual({ tipo: 'ir', ruta: '/mas' })
    expect(resolverAtajo(tecla('g'), enSecuencia)).toEqual({ tipo: 'ir', ruta: '/soluciones' })
  })

  it('la secuencia funciona igual en mayúsculas', () => {
    expect(resolverAtajo(tecla('G'), NORMAL)).toEqual({ tipo: 'esperar' })
    expect(resolverAtajo(tecla('E'), { ...NORMAL, secuenciaActiva: true })).toEqual({
      tipo: 'ir',
      ruta: '/dispositivos',
    })
  })

  it('una segunda tecla desconocida abandona la secuencia, no navega', () => {
    expect(resolverAtajo(tecla('x'), { ...NORMAL, secuenciaActiva: true })).toEqual({ tipo: 'cancelar' })
    expect(resolverAtajo(tecla('Escape'), { ...NORMAL, secuenciaActiva: true })).toEqual({
      tipo: 'cancelar',
    })
  })

  it('sin permiso de bóveda, G+B no lleva a ningún sitio', () => {
    expect(
      resolverAtajo(tecla('b'), { secuenciaActiva: true, puedeVerBoveda: false, navegacion: true }),
    ).toEqual({ tipo: 'cancelar' })
  })

  it('no se pisan los atajos del navegador', () => {
    expect(resolverAtajo(tecla('/', { ctrlKey: true }), NORMAL)).toBeNull()
    expect(resolverAtajo(tecla('g', { metaKey: true }), NORMAL)).toBeNull()
    expect(resolverAtajo(tecla('e', { altKey: true }), { ...NORMAL, secuenciaActiva: true })).toBeNull()
    expect(tieneModificador(tecla('l', { ctrlKey: true }))).toBe(true)
    // Shift sí se admite: "?" se teclea con Shift en casi cualquier
    // distribución.
    expect(tieneModificador(tecla('?'))).toBe(false)
  })

  it('Escape no se resuelve aquí: lo cierra la capa de encima', () => {
    expect(resolverAtajo(tecla('Escape'), NORMAL)).toBeNull()
  })

  it('sin navegación (editor o ejecución) la G no abre secuencia, pero buscar y ayuda siguen', () => {
    const enTarea = { ...NORMAL, navegacion: false }
    expect(resolverAtajo(tecla('g'), enTarea)).toBeNull()
    expect(resolverAtajo(tecla('/'), enTarea)).toEqual({ tipo: 'buscar' })
    expect(resolverAtajo(tecla('?'), enTarea)).toEqual({ tipo: 'ayuda' })
  })

  it('cualquier otra tecla no es asunto de la capa', () => {
    expect(resolverAtajo(tecla('a'), NORMAL)).toBeNull()
    expect(resolverAtajo(tecla('Enter'), NORMAL)).toBeNull()
  })
})

describe('esCampoEditable', () => {
  it('reconoce los tres controles de formulario y lo editable', () => {
    expect(esCampoEditable({ tagName: 'INPUT' })).toBe(true)
    expect(esCampoEditable({ tagName: 'textarea' })).toBe(true)
    expect(esCampoEditable({ tagName: 'SELECT' })).toBe(true)
    expect(esCampoEditable({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('un botón o el cuerpo no son campos de escritura', () => {
    expect(esCampoEditable({ tagName: 'BUTTON' })).toBe(false)
    expect(esCampoEditable({ tagName: 'BODY' })).toBe(false)
    expect(esCampoEditable(null)).toBe(false)
  })
})

describe('atajosVisibles', () => {
  it('esconde la Bóveda a quien no tiene el permiso', () => {
    const conBoveda = atajosVisibles(true)
    const sinBoveda = atajosVisibles(false)
    expect(conBoveda).toHaveLength(ATAJOS_APP.length)
    expect(sinBoveda.some((a) => a.ruta === '/boveda')).toBe(false)
  })

  it('la ayuda enseña la lista completa, no una selección', () => {
    // Barra, interrogación, Escape y cinco secuencias con G: los cuatro
    // destinos principales y el catálogo de guías (encargo del 2026-09-22).
    expect(ATAJOS_APP).toHaveLength(8)
    expect(ATAJOS_APP.filter((a) => a.teclas[0] === 'G').map((a) => a.ruta)).toEqual([
      '/',
      '/dispositivos',
      '/boveda',
      '/mas',
      '/soluciones',
    ])
  })
})
