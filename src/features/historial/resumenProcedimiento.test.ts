import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento, Procedimiento } from '../../lib/db'
import { resumenProcedimiento, textoContexto } from './resumenProcedimiento'

function paso(parcial: Partial<PasoProcedimiento> & { id: string }): PasoProcedimiento {
  return {
    titulo: '',
    instrucciones: [],
    imagen: null,
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...parcial,
  }
}

function proc(pasos: PasoProcedimiento[], requisitos: string[] = []): Procedimiento {
  return { requisitos, pasos }
}

// El historial guarda el procedimiento como JSON; las pruebas simulan
// ese mismo formato.
function json(procedimiento: Procedimiento | null): string {
  return procedimiento ? JSON.stringify(procedimiento) : ''
}

describe('textoContexto', () => {
  it('usa singular y plural correctos', () => {
    expect(textoContexto({ pasos: 1, instrucciones: 1 })).toBe('1 paso, 1 instrucción')
    expect(textoContexto({ pasos: 5, instrucciones: 10 })).toBe('5 pasos, 10 instrucciones')
  })
})

describe('resumenProcedimiento', () => {
  it('describe cuando se agrega el procedimiento por primera vez', () => {
    const nuevo = proc([paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a', 'b'] })])
    const resumen = resumenProcedimiento('', json(nuevo))
    expect(resumen.contexto).toBeNull()
    expect(resumen.cambios).toEqual(['Se agregó el procedimiento (1 paso, 2 instrucciones).'])
  })

  it('describe cuando se elimina el procedimiento', () => {
    const anterior = proc([paso({ id: 'p1', instrucciones: ['a'] })])
    const resumen = resumenProcedimiento(json(anterior), '')
    expect(resumen.contexto).toEqual({ pasos: 1, instrucciones: 1 })
    expect(resumen.cambios).toEqual(['Se eliminó el procedimiento.'])
  })

  it('da contexto del estado anterior', () => {
    const antes = proc([
      paso({ id: 'p1', instrucciones: ['a', 'b'] }),
      paso({ id: 'p2', instrucciones: ['c'] }),
    ])
    const despues = proc([
      paso({ id: 'p1', instrucciones: ['a', 'b'] }),
      paso({ id: 'p2', instrucciones: ['c', 'd'] }),
    ])
    const resumen = resumenProcedimiento(json(antes), json(despues))
    expect(resumen.contexto).toEqual({ pasos: 2, instrucciones: 3 })
  })

  it('detecta una instrucción agregada a un paso', () => {
    const antes = proc([paso({ id: 'p3', titulo: 'Databases', instrucciones: ['a'] })])
    const despues = proc([paso({ id: 'p3', titulo: 'Databases', instrucciones: ['a', 'b'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregó una nueva instrucción al Paso 1: Databases.',
    ])
  })

  it('detecta una instrucción eliminada de un paso', () => {
    const antes = proc([paso({ id: 'p2', titulo: 'Ingresar usuario y contraseña', instrucciones: ['a', 'b'] })])
    const despues = proc([paso({ id: 'p2', titulo: 'Ingresar usuario y contraseña', instrucciones: ['a'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se eliminó una instrucción del Paso 1: Ingresar usuario y contraseña.',
    ])
  })

  it('detecta la edición de una instrucción sin contarla como alta y baja', () => {
    const antes = proc([paso({ id: 'p3', titulo: 'Databases', instrucciones: ['abrir consola'] })])
    const despues = proc([paso({ id: 'p3', titulo: 'Databases', instrucciones: ['abrir la consola'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se editó una instrucción del Paso 1: Databases.',
    ])
  })

  it('pluraliza varias instrucciones agregadas', () => {
    const antes = proc([paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] })])
    const despues = proc([paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a', 'b', 'c'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregaron 2 instrucciones al Paso 1: Uno.',
    ])
  })

  it('detecta el cambio de título de un paso', () => {
    const antes = proc([paso({ id: 'p1', titulo: 'Viejo', instrucciones: ['a'] })])
    const despues = proc([paso({ id: 'p1', titulo: 'Nuevo', instrucciones: ['a'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se modificó el título del Paso 1: "Viejo" → "Nuevo".',
    ])
  })

  it('detecta credencial agregada, reemplazada y eliminada', () => {
    const base = paso({ id: 'p2', titulo: 'Login', instrucciones: ['a'] })
    const conCred = paso({ ...base, credencialId: 'c1', credencialTitulo: 'SQL' })
    const otraCred = paso({ ...base, credencialId: 'c2', credencialTitulo: 'Otro' })

    expect(resumenProcedimiento(json(proc([base])), json(proc([conCred]))).cambios).toEqual([
      'Se agregó una credencial al Paso 1: Login.',
    ])
    expect(resumenProcedimiento(json(proc([conCred])), json(proc([otraCred]))).cambios).toEqual([
      'Se reemplazó la credencial del Paso 1: Login.',
    ])
    expect(resumenProcedimiento(json(proc([conCred])), json(proc([base]))).cambios).toEqual([
      'Se eliminó la credencial del Paso 1: Login.',
    ])
  })

  it('detecta imagen agregada, actualizada y eliminada', () => {
    const base = paso({ id: 'p4', titulo: 'Foto', instrucciones: ['a'] })
    const conImg = paso({ ...base, imagen: 'ruta/1.jpg' })
    const otraImg = paso({ ...base, imagen: 'ruta/2.jpg' })

    expect(resumenProcedimiento(json(proc([base])), json(proc([conImg]))).cambios).toEqual([
      'Se agregó una imagen al Paso 1: Foto.',
    ])
    expect(resumenProcedimiento(json(proc([conImg])), json(proc([otraImg]))).cambios).toEqual([
      'Se actualizó la imagen del Paso 1: Foto.',
    ])
    expect(resumenProcedimiento(json(proc([conImg])), json(proc([base]))).cambios).toEqual([
      'Se eliminó la imagen del Paso 1: Foto.',
    ])
  })

  it('describe un paso nuevo por su título', () => {
    const antes = proc([paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] })])
    const despues = proc([
      paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] }),
      paso({ id: 'p2', titulo: 'Realizar copia de seguridad', instrucciones: ['x'] }),
    ])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregó un nuevo paso "Realizar copia de seguridad".',
    ])
  })

  it('describe un paso eliminado por su posición anterior', () => {
    const antes = proc([
      paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] }),
      paso({ id: 'p5', titulo: 'Cinco', instrucciones: ['e'] }),
    ])
    const despues = proc([paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se eliminó el Paso 2: Cinco.',
    ])
  })

  it('detecta el cambio de orden de los pasos', () => {
    const antes = proc([
      paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] }),
      paso({ id: 'p2', titulo: 'Dos', instrucciones: ['b'] }),
    ])
    const despues = proc([
      paso({ id: 'p2', titulo: 'Dos', instrucciones: ['b'] }),
      paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] }),
    ])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toContain(
      'Se cambió el orden de los pasos.',
    )
  })

  it('detecta un requisito actualizado del procedimiento', () => {
    const antes = proc([paso({ id: 'p1', instrucciones: ['a'] })], ['Tener acceso VPN'])
    const despues = proc([paso({ id: 'p1', instrucciones: ['a'] })], ['Tener acceso a la VPN'])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se actualizó un requisito del procedimiento.',
    ])
  })

  it('reúne varios cambios de una misma edición', () => {
    const antes = proc([
      paso({ id: 'p1', titulo: 'Uno', instrucciones: ['a'] }),
      paso({ id: 'p3', titulo: 'Databases', instrucciones: ['x'] }),
    ])
    const despues = proc([
      paso({ id: 'p1', titulo: 'Uno editado', instrucciones: ['a'] }),
      paso({ id: 'p3', titulo: 'Databases', instrucciones: ['x', 'y'] }),
    ])
    const cambios = resumenProcedimiento(json(antes), json(despues)).cambios
    expect(cambios).toEqual([
      'Se modificó el título del Paso 1: "Uno" → "Uno editado".',
      'Se agregó una nueva instrucción al Paso 2: Databases.',
    ])
  })

  it('ante un cambio no reconocible ofrece un resumen genérico', () => {
    // JSON invalido en ambos lados: nunca debe volcarse crudo.
    const resumen = resumenProcedimiento('{no es json', '{tampoco')
    expect(resumen.cambios).toEqual(['Se actualizó el procedimiento.'])
  })
})
