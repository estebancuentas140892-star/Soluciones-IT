import { describe, expect, it } from 'vitest'
import type { Procedimiento } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import {
  cuandoUsarParaMostrar,
  guiaDelPrimerPaso,
  orientacionDe,
  pantallasDePreparacion,
  requisitosEfectivos,
} from './preparacionGuia'

// La preparación de una guía (tarea 289, fase 2): reglas puras. El
// recorrido con la pantalla de verdad está en guiasFlujoNatural.test.tsx.

function procedimiento(datos: Record<string, unknown>): Procedimiento {
  const resultado = normalizarProcedimiento({ pasos: [{ id: 'p1', titulo: 'Paso 1' }], ...datos })
  if (!resultado) throw new Error('procedimiento de prueba inválido')
  return resultado
}

describe('cuandoUsarParaMostrar', () => {
  it('quita la fórmula que ya dice el rótulo "Cuándo usarla"', () => {
    expect(cuandoUsarParaMostrar('Usa esta guía cuando la impresora no imprime.')).toBe('Cuando la impresora no imprime.')
    expect(cuandoUsarParaMostrar('Usar cuando el usuario es nuevo.')).toBe('Cuando el usuario es nuevo.')
    expect(cuandoUsarParaMostrar('Úsala cuando el equipo no arranca.')).toBe('Cuando el equipo no arranca.')
    expect(cuandoUsarParaMostrar('Utiliza este procedimiento cuando falle la red.')).toBe('Cuando falle la red.')
  })

  it('conserva la restricción: "únicamente cuando" sigue diciendo "únicamente"', () => {
    expect(cuandoUsarParaMostrar('Usa esta guía únicamente cuando el soporte lo autorice.')).toBe(
      'Únicamente cuando el soporte lo autorice.',
    )
    expect(cuandoUsarParaMostrar('Usa esta guía solo cuando haya corte.')).toBe('Solo cuando haya corte.')
  })

  it('cualquier otro comienzo se muestra tal cual, sin inventar nada', () => {
    expect(cuandoUsarParaMostrar('La impresora ya está instalada, pero no imprime.')).toBe(
      'La impresora ya está instalada, pero no imprime.',
    )
    expect(cuandoUsarParaMostrar('Aplica esto cuando sea necesario.')).toBe('Aplica esto cuando sea necesario.')
    // "cuando" en mitad del texto no es la fórmula.
    expect(cuandoUsarParaMostrar('Sirve para la caja cuando abre el turno.')).toBe('Sirve para la caja cuando abre el turno.')
    expect(cuandoUsarParaMostrar('   ')).toBe('')
  })
})

describe('orientacionDe', () => {
  it('compone la orientación con los campos que ya existen', () => {
    expect(
      orientacionDe(procedimiento({ descripcion: 'Usa esta guía cuando X.', objetivoGeneral: ' Dejar Y listo. ' })),
    ).toEqual({ cuandoUsar: 'Cuando X.', objetivo: 'Dejar Y listo.' })
  })

  it('con uno solo de los dos, orienta con ese', () => {
    expect(orientacionDe(procedimiento({ objetivoGeneral: 'Dejar Y listo.' }))).toEqual({
      cuandoUsar: '',
      objetivo: 'Dejar Y listo.',
    })
  })

  it('sin "cuándo usar" ni objetivo no hay nada que orientar', () => {
    expect(orientacionDe(procedimiento({}))).toBeNull()
    expect(orientacionDe(procedimiento({ descripcion: '  ', objetivoGeneral: '' }))).toBeNull()
  })
})

describe('guiaDelPrimerPaso', () => {
  it('es la guía que reutiliza el paso 1, o ninguna', () => {
    expect(guiaDelPrimerPaso(procedimiento({ pasos: [{ id: 'p1', titulo: 'Entrar', subArticuloId: 'acceso' }] }))).toBe(
      'acceso',
    )
    expect(guiaDelPrimerPaso(procedimiento({}))).toBeNull()
    // La de un paso posterior no cuenta: algo se hace antes que ella.
    expect(
      guiaDelPrimerPaso(
        procedimiento({
          pasos: [
            { id: 'p1', titulo: 'Abrir' },
            { id: 'p2', titulo: 'Firma', subArticuloId: 'firma' },
          ],
        }),
      ),
    ).toBeNull()
  })
})

describe('requisitosEfectivos', () => {
  it('primero los de la guía, después los de la guía del paso 1', () => {
    expect(requisitosEfectivos(['Autorización.', 'Cédula.'], ['Red interna.', 'Acceso al programa.'])).toEqual([
      'Autorización.',
      'Cédula.',
      'Red interna.',
      'Acceso al programa.',
    ])
  })

  it('no repite: mismo texto salvo mayúsculas, tildes, espacios o punto final', () => {
    expect(
      requisitosEfectivos(
        ['Acceso autorizado al programa de caja.', 'Cédula de la persona'],
        ['acceso  autorizado al programa de caja', 'CEDULA DE LA PERSONA.', 'Red interna.'],
      ),
    ).toEqual(['Acceso autorizado al programa de caja.', 'Cédula de la persona', 'Red interna.'])
  })

  it('tampoco repite dentro de una misma lista, y descarta los vacíos', () => {
    expect(requisitosEfectivos(['Red.', ' red ', '  '], null)).toEqual(['Red.'])
  })

  it('sin guía en el paso 1, son los de la guía tal cual', () => {
    expect(requisitosEfectivos(['Uno.', 'Dos.'], null)).toEqual(['Uno.', 'Dos.'])
    expect(requisitosEfectivos([], null)).toEqual([])
  })
})

describe('pantallasDePreparacion', () => {
  const orientacion = { cuandoUsar: 'Cuando X.', objetivo: '' }

  it('orientar y preparar, en ese orden, solo cuando tienen algo que decir', () => {
    expect(pantallasDePreparacion(orientacion, ['Red.'])).toEqual(['orientacion', 'requisitos'])
    expect(pantallasDePreparacion(orientacion, [])).toEqual(['orientacion'])
    expect(pantallasDePreparacion(null, ['Red.'])).toEqual(['requisitos'])
  })

  it('una guía sin nada que orientar ni preparar abre en su primera acción', () => {
    expect(pantallasDePreparacion(null, [])).toEqual([])
  })
})
