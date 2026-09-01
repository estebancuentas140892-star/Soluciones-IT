import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento } from '../../lib/db'
import { crearBloqueAviso, crearBloqueTarea, crearPaso } from '../../lib/procedimiento'
import { minutosRestantes, resumenDeAvance, resumirPasos, tituloDePaso } from './estadoPasos'

function paso(titulo: string, tareas = 0, aviso: 'precaucion' | 'importante' | 'info' | null = null): PasoProcedimiento {
  const bloques = Array.from({ length: tareas }, () => crearBloqueTarea())
  if (aviso) bloques.push({ ...crearBloqueAviso(), tono: aviso })
  return { ...crearPaso(), titulo, bloques }
}

const vacio = new Set<string>()

describe('resumirPasos', () => {
  it('reparte los cuatro estados alrededor del paso actual', () => {
    const pasos = [paso('Avisar'), paso('Respaldar'), paso('Desconectar'), paso('Montar')]
    const hechos = new Set([pasos[0].id])
    const resumen = resumirPasos(pasos, hechos, vacio, 2)

    expect(resumen.map((r) => r.estado)).toEqual(['hecho', 'saltado', 'actual', 'pendiente'])
  })

  it('un paso hecho sigue hecho aunque se vuelva a él para revisarlo', () => {
    const pasos = [paso('Avisar'), paso('Respaldar')]
    const hechos = new Set([pasos[0].id, pasos[1].id])
    // El técnico retrocedió al paso 1, que ya estaba completo.
    const resumen = resumirPasos(pasos, hechos, vacio, 0)

    expect(resumen.map((r) => r.estado)).toEqual(['hecho', 'hecho'])
  })

  it('sin paso actual nada queda "saltado": lo que falte está pendiente', () => {
    const pasos = [paso('Avisar'), paso('Respaldar')]
    const resumen = resumirPasos(pasos, new Set([pasos[1].id]), vacio, null)

    expect(resumen.map((r) => r.estado)).toEqual(['pendiente', 'hecho'])
  })

  it('cuenta las tareas del paso y cuántas van marcadas', () => {
    const conTareas = paso('Desconectar', 3)
    const marcadas = new Set([conTareas.bloques[0].id, conTareas.bloques[2].id])
    const [resumen] = resumirPasos([conTareas], vacio, marcadas, 0)

    expect(resumen.tareas).toBe(3)
    expect(resumen.tareasHechas).toBe(2)
  })

  it('los avisos que NO advierten de nada no marcan la fila con "cuidado"', () => {
    const resumen = resumirPasos(
      [paso('Con precaución', 0, 'precaucion'), paso('Con importante', 0, 'importante'), paso('Con info', 0, 'info'), paso('Sin aviso')],
      vacio,
      vacio,
      0,
    )

    expect(resumen.map((r) => r.tieneCuidado)).toEqual([true, true, false, false])
  })

  it('un paso sin título se nombra por su posición', () => {
    expect(tituloDePaso(crearPaso(), 4)).toBe('Paso 5')
  })

  it('un paso sin título propio toma el del procedimiento que reutiliza', () => {
    const vinculado = { ...crearPaso(), subArticuloTitulo: 'Respaldar la configuración' }
    expect(tituloDePaso(vinculado, 0)).toBe('Respaldar la configuración')
  })
})

describe('minutosRestantes', () => {
  it('reparte el tiempo estimado entre los pasos que quedan', () => {
    const pasos = [paso('a'), paso('b'), paso('c'), paso('d')]
    const resumen = resumirPasos(pasos, new Set([pasos[0].id]), vacio, 1)

    // 20 min entre 4 pasos, quedan 3.
    expect(minutosRestantes(20, resumen)).toBe(15)
  })

  it('no inventa un tiempo si el artículo no lo declara', () => {
    const resumen = resumirPasos([paso('a')], vacio, vacio, 0)
    expect(minutosRestantes(null, resumen)).toBeNull()
    expect(minutosRestantes(0, resumen)).toBeNull()
  })

  it('con todo hecho no quedan minutos', () => {
    const uno = paso('a')
    const resumen = resumirPasos([uno], new Set([uno.id]), vacio, null)
    expect(minutosRestantes(30, resumen)).toBeNull()
  })

  it('nunca redondea a cero: si queda trabajo, queda al menos un minuto', () => {
    const pasos = Array.from({ length: 10 }, (_, i) => paso(`p${i}`))
    const hechos = new Set(pasos.slice(0, 9).map((p) => p.id))
    const resumen = resumirPasos(pasos, hechos, vacio, 9)

    // 1 min entre 10 pasos, queda 1: la regla de tres da 0,1.
    expect(minutosRestantes(1, resumen)).toBe(1)
  })
})

describe('resumenDeAvance', () => {
  it('nombra los tres datos cuando los tres existen', () => {
    const pasos = [paso('a'), paso('b'), paso('c'), paso('d')]
    const resumen = resumirPasos(pasos, new Set([pasos[0].id, pasos[1].id]), vacio, 3)

    expect(resumenDeAvance(resumen, 14)).toBe('2 hechos · 1 saltado · quedan ~14 min')
  })

  it('sin saltados ni tiempo estimado solo queda lo hecho', () => {
    const pasos = [paso('a'), paso('b')]
    const resumen = resumirPasos(pasos, new Set([pasos[0].id]), vacio, 1)

    expect(resumenDeAvance(resumen, null)).toBe('1 hecho')
  })

  it('concuerda el singular y el plural', () => {
    const pasos = [paso('a'), paso('b'), paso('c')]
    const resumen = resumirPasos(pasos, new Set([pasos[0].id]), vacio, 2)

    expect(resumenDeAvance(resumen, null)).toBe('1 hecho · 1 saltado')
  })
})
