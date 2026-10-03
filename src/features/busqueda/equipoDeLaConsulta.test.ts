import { describe, expect, it } from 'vitest'
import { datosBenchmark } from './benchmarkResolver'
import { equipoDeLaConsulta } from './mejores'
import { buscar, crearIndiceDesdeDocumentos, documentosDeBusqueda } from './useIndiceBusqueda'

// EL EQUIPO QUE LA CONSULTA IDENTIFICA (tarea 290). Con el índice de
// verdad y los datos sintéticos del benchmark de la tarea 288: lo que
// Resolver ya sabe del equipo de la consulta, leído sin tocar el ranking,
// para que una guía abierta desde ahí sepa con qué equipo se trabaja.

const indice = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosBenchmark(false)))
const equipoDe = (consulta: string) => equipoDeLaConsulta(consulta, buscar(indice, consulta))

describe('equipoDeLaConsulta', () => {
  it('el problema sobre un equipo concreto lleva a ese equipo', () => {
    expect(equipoDe('la impresora de mercadeo no imprime')).toBe('d-imp-mercadeo')
    expect(equipoDe('la impresora de contabilidad no imprime')).toBe('d-imp-contabilidad')
    expect(equipoDe('clave impresora mercadeo')).toBe('d-imp-mercadeo')
  })

  it('por su nombre, su número o su IP, cuando solo hay uno', () => {
    expect(equipoDe('impresora caja 2')).toBe('d-imp-caja2')
    expect(equipoDe('switch mercadeo')).toBe('d-switch-mercadeo')
    expect(equipoDe('servidor facturacion')).toBe('d-srv-facturacion')
    expect(equipoDe('pc contabilidad')).toBe('d-pc-contabilidad')
  })

  it('si lo escrito vale para dos equipos, ninguno: no se adivina', () => {
    // Dos impresoras de caja.
    expect(equipoDe('impresora caja')).toBeNull()
    // "mercadeo" a secas: la impresora y el switch de Mercadeo.
    expect(equipoDe('mercadeo')).toBeNull()
  })

  it('sin nada que identifique un equipo concreto, ninguno', () => {
    expect(equipoDe('impresora')).toBeNull()
    expect(equipoDe('no imprime')).toBeNull()
    expect(equipoDe('crear usuario')).toBeNull()
    expect(equipoDeLaConsulta('', [])).toBeNull()
  })
})
