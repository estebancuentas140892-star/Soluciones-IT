import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento, Procedimiento } from '../../lib/db'
import {
  acortarNombreGuia,
  cierreDelPaso,
  guiaPendienteDelPaso,
  guiaTerminada,
  LARGO_MAXIMO_NOMBRE_GUIA,
  rotuloCompletaGuia,
  type DatosCierrePaso,
} from './cierrePaso'

function datos(cambios: Partial<DatosCierrePaso> = {}): DatosCierrePaso {
  return {
    pasoHecho: false,
    totalTareas: 0,
    tareasMarcadas: 0,
    guiaPendiente: null,
    hayPasoSiguiente: true,
    numeroPasoSiguiente: 2,
    ...cambios,
  }
}

function paso(cambios: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'paso-1',
    titulo: 'Paso 1',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    vinculoProtegido: null,
    ...cambios,
  } as PasoProcedimiento
}

describe('cierreDelPaso', () => {
  // La gramatica de la propuesta final de Claude Design (2026-10-01): el
  // rotulo dice la consecuencia, nunca "Comprobado" o "Hecho" a secas.
  it('deja cerrar el paso cuando no queda trabajo, y dice que sigue', () => {
    const cierre = cierreDelPaso(datos({ totalTareas: 2, tareasMarcadas: 2 }))
    expect(cierre.accion).toBe('completar')
    expect(cierre.etiqueta).toBe('Completar y seguir')
    expect(cierre.etiquetaCompleta).toBe('Completar y seguir')
  })

  it('cuando cerrarlo termina la guia promete terminar, no seguir', () => {
    const cierre = cierreDelPaso(datos({ hayPasoSiguiente: false }))
    expect(cierre.accion).toBe('completar')
    expect(cierre.etiqueta).toBe('Completar y terminar')
  })

  it('ningun rotulo se queda en "Comprobado" o "Hecho" a secas', () => {
    const rotulos = [
      cierreDelPaso(datos()),
      cierreDelPaso(datos({ hayPasoSiguiente: false })),
      cierreDelPaso(datos({ pasoHecho: true })),
      cierreDelPaso(datos({ totalTareas: 1 })),
      cierreDelPaso(datos({ guiaPendiente: 'Reiniciar el router' })),
    ].map((cierre) => cierre.etiqueta)
    for (const rotulo of rotulos) expect(rotulo).not.toMatch(/^(Comprobado|Hecho)\b/)
  })

  it('nunca dice "Paso hecho" mientras falten tareas: dice cuantas', () => {
    expect(cierreDelPaso(datos({ totalTareas: 3, tareasMarcadas: 1 }))).toMatchObject({
      accion: 'bloqueado',
      etiqueta: 'Faltan 2 tareas',
    })
    expect(cierreDelPaso(datos({ totalTareas: 3, tareasMarcadas: 2 })).etiqueta).toBe('Falta 1 tarea')
  })

  it('nombra la guia que falta', () => {
    const cierre = cierreDelPaso(datos({ guiaPendiente: 'Reiniciar el router' }))
    expect(cierre.accion).toBe('bloqueado')
    expect(cierre.etiqueta).toBe('Completa «Reiniciar el router»')
    expect(cierre.etiquetaCompleta).toBe('Completa «Reiniciar el router»')
  })

  it('con un nombre largo acorta DENTRO de las comillas y conserva el nombre entero para el lector', () => {
    const largo = 'Configurar las paginas que abre Google Chrome al iniciar en un POS de taquilla'
    const cierre = cierreDelPaso(datos({ guiaPendiente: largo }))
    expect(cierre.etiqueta.startsWith('Completa «')).toBe(true)
    expect(cierre.etiqueta.endsWith('…»')).toBe(true)
    expect(cierre.etiqueta.length).toBeLessThan(`Completa «${largo}»`.length)
    expect(cierre.etiquetaCompleta).toBe(`Completa «${largo}»`)
  })

  it('con guia y tareas pendientes nombra la guia, que es el trabajo que va primero', () => {
    const cierre = cierreDelPaso(
      datos({ guiaPendiente: 'Reiniciar el router', totalTareas: 4, tareasMarcadas: 0 }),
    )
    expect(cierre.etiqueta).toBe('Completa «Reiniciar el router»')
    expect(cierre.tareasPendientes).toBe(4)
  })

  it('un paso que contiene solo una guia se cierra al terminarla', () => {
    expect(cierreDelPaso(datos({ totalTareas: 0, guiaPendiente: 'Reiniciar el router' })).accion).toBe(
      'bloqueado',
    )
    expect(cierreDelPaso(datos({ totalTareas: 0, guiaPendiente: null })).accion).toBe('completar')
  })

  it('un paso ya hecho lleva al siguiente en vez de volver a cerrarse', () => {
    expect(cierreDelPaso(datos({ pasoHecho: true, numeroPasoSiguiente: 4 }))).toMatchObject({
      accion: 'navegar',
      etiqueta: 'Ir al paso 4',
    })
    expect(cierreDelPaso(datos({ pasoHecho: true, hayPasoSiguiente: false })).etiqueta).toBe(
      'Continuar',
    )
  })

  it('un paso hecho no reclama trabajo pendiente en su rotulo', () => {
    const cierre = cierreDelPaso(
      datos({ pasoHecho: true, totalTareas: 2, tareasMarcadas: 0, guiaPendiente: 'X' }),
    )
    expect(cierre.accion).toBe('navegar')
    expect(cierre.guiaPendiente).toBeNull()
  })
})

describe('acortarNombreGuia', () => {
  it('un nombre que cabe sale intacto', () => {
    expect(acortarNombreGuia('Reiniciar el router')).toBe('Reiniciar el router')
    expect(acortarNombreGuia('  Reiniciar   el router ')).toBe('Reiniciar el router')
  })

  it('un nombre largo se corta por palabras, con puntos suspensivos y sin pasar del tope', () => {
    const corto = acortarNombreGuia('Configurar las paginas que abre Google Chrome al iniciar en un POS')
    expect(corto).toBe('Configurar las paginas que…')
    expect(corto.length).toBeLessThanOrEqual(LARGO_MAXIMO_NOMBRE_GUIA + 1)
  })

  it('no deja puntuacion colgando antes de los puntos suspensivos', () => {
    expect(acortarNombreGuia('Abrir caja, revisar tickets, imprimir cierre del dia', 20)).toBe('Abrir caja, revisar…')
    expect(acortarNombreGuia('Abrir caja, revisar tickets', 12)).toBe('Abrir caja…')
  })

  it('una sola palabra enorme se corta dentro de ella: nunca devuelve solo los puntos', () => {
    expect(acortarNombreGuia('Supercalifragilisticoespialidoso', 10)).toBe('Supercalif…')
  })
})

describe('rotuloCompletaGuia', () => {
  it('el verbo va siempre entero y el nombre entero queda para el nombre accesible', () => {
    const largo = 'Restablecer el perfil del navegador cuando el POS arranca con pestanas equivocadas'
    const rotulo = rotuloCompletaGuia(largo)
    expect(rotulo.visible.startsWith('Completa «')).toBe(true)
    expect(rotulo.visible.endsWith('…»')).toBe(true)
    expect(rotulo.completo).toBe(`Completa «${largo}»`)
  })

  it('sin nombre no inventa uno ni habla de vinculos (tarea 289)', () => {
    expect(rotuloCompletaGuia('  ')).toEqual({ visible: 'Completa lo que falta', completo: 'Completa lo que falta' })
  })
})

describe('guiaPendienteDelPaso', () => {
  it('no hay guia pendiente si el paso no vincula ninguna', () => {
    expect(guiaPendienteDelPaso(paso(), true)).toBeNull()
    expect(guiaPendienteDelPaso(paso(), false)).toBeNull()
  })

  // Un solo flujo (tarea 289): lo que falta se nombra por el PASO, que es
  // lo que el tecnico ve, no por la guia que reutiliza.
  it('nombra el paso mientras la guia que reutiliza siga pendiente', () => {
    const p = paso({ titulo: 'Ingresar al router', subArticuloId: 'guia-1', subArticuloTitulo: 'Reiniciar el router' })
    expect(guiaPendienteDelPaso(p, false)).toBe('Ingresar al router')
    expect(guiaPendienteDelPaso(p, true)).toBeNull()
  })

  it('sin titulo del paso usa el de la guia, y sin ninguno no inventa nada', () => {
    const conGuia = paso({ titulo: '', subArticuloId: 'guia-1', subArticuloTitulo: 'Reiniciar el router' })
    expect(guiaPendienteDelPaso(conGuia, false)).toBe('Reiniciar el router')
    const sinNada = paso({ titulo: '', subArticuloId: 'guia-1', subArticuloTitulo: '' })
    expect(guiaPendienteDelPaso(sinNada, false)).toBe('')
    expect(cierreDelPaso(datos({ guiaPendiente: '' })).etiqueta).toBe('Completa lo que falta')
  })
})

describe('cierreDelPaso dentro del flujo de otra guia (tarea 289)', () => {
  it('desde un paso hecho no nombra la numeracion de dentro: "Seguir"', () => {
    const cierre = cierreDelPaso(datos({ pasoHecho: true, numeroPasoSiguiente: null }))
    expect(cierre).toMatchObject({ accion: 'navegar', etiqueta: 'Seguir' })
  })

  it('sin a donde ir sigue diciendo "Continuar", y fuera del flujo "Ir al paso N"', () => {
    expect(cierreDelPaso(datos({ pasoHecho: true, hayPasoSiguiente: false, numeroPasoSiguiente: null })).etiqueta).toBe(
      'Continuar',
    )
    expect(cierreDelPaso(datos({ pasoHecho: true, numeroPasoSiguiente: 4 })).etiqueta).toBe('Ir al paso 4')
  })
})

// UNA GUIA VINCULADA TERMINA CUANDO TERMINA (encargo del 2026-09-09,
// tarea 4): con sus pasos cerrados Y sus comprobaciones finales hechas.
describe('guiaTerminada', () => {
  function guia(pasos: string[], verificacionFinal: string[] = []): Procedimiento {
    return {
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      pasos: pasos.map((id) => paso({ id })),
      verificacionFinal,
      tiempoEstimadoMin: null,
      dificultad: null,
    } as Procedimiento
  }

  it('sin comprobaciones finales termina al cerrar el ultimo paso', () => {
    const g = guia(['p1', 'p2'])
    expect(guiaTerminada(g, ['p1'], undefined)).toBe(false)
    expect(guiaTerminada(g, ['p1', 'p2'], undefined)).toBe(true)
  })

  it('con comprobaciones finales no termina hasta hacerlas todas', () => {
    const g = guia(['p1'], ['Comprobar A', 'Comprobar B'])
    expect(guiaTerminada(g, ['p1'], undefined)).toBe(false)
    expect(guiaTerminada(g, ['p1'], [0])).toBe(false)
    expect(guiaTerminada(g, ['p1'], [0, 1])).toBe(true)
  })

  it('las comprobaciones no cuentan mientras queden pasos abiertos', () => {
    const g = guia(['p1', 'p2'], ['Comprobar A'])
    expect(guiaTerminada(g, ['p1'], [0])).toBe(false)
  })

  it('una guia sin pasos que ejecutar no bloquea (caso K1)', () => {
    expect(guiaTerminada(guia([]), undefined, undefined)).toBe(true)
  })
})
