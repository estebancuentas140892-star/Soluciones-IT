import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento, Procedimiento } from '../../lib/db'
import { resumenProcedimiento, textoContexto } from './resumenProcedimiento'

function tarea(texto: string): BloquePaso {
  return { id: `t-${texto}`, tipo: 'tarea', texto, tono: null, adjunto: null }
}

function aviso(texto: string, tono: BloquePaso['tono'] = 'info'): BloquePaso {
  return { id: `a-${texto}`, tipo: 'aviso', texto, tono, adjunto: null }
}

// Atajo `tareas: [...]` para construir bloques de tarea a partir de sus
// textos (el diff de bloques compara por texto, no por id).
function paso(
  parcial: Partial<PasoProcedimiento> & { id: string; tareas?: string[] },
): PasoProcedimiento {
  const { tareas, ...resto } = parcial
  return {
    titulo: '',
    objetivo: '',
    bloques: tareas ? tareas.map(tarea) : [],
    adjuntos: [],
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...resto,
  }
}

function proc(pasos: PasoProcedimiento[], requisitos: string[] = []): Procedimiento {
  return {
    objetivoGeneral: '',
    requisitos,
    pasos,
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
  }
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
    const nuevo = proc([paso({ id: 'p1', titulo: 'Uno', tareas: ['a', 'b'] })])
    const resumen = resumenProcedimiento('', json(nuevo))
    expect(resumen.contexto).toBeNull()
    expect(resumen.cambios).toEqual(['Se agregó el procedimiento (1 paso, 2 instrucciones).'])
  })

  it('describe cuando se elimina el procedimiento', () => {
    const anterior = proc([paso({ id: 'p1', tareas: ['a'] })])
    const resumen = resumenProcedimiento(json(anterior), '')
    expect(resumen.contexto).toEqual({ pasos: 1, instrucciones: 1 })
    expect(resumen.cambios).toEqual(['Se eliminó el procedimiento.'])
  })

  it('da contexto del estado anterior', () => {
    const antes = proc([
      paso({ id: 'p1', tareas: ['a', 'b'] }),
      paso({ id: 'p2', tareas: ['c'] }),
    ])
    const despues = proc([
      paso({ id: 'p1', tareas: ['a', 'b'] }),
      paso({ id: 'p2', tareas: ['c', 'd'] }),
    ])
    const resumen = resumenProcedimiento(json(antes), json(despues))
    expect(resumen.contexto).toEqual({ pasos: 2, instrucciones: 3 })
  })

  it('detecta una instrucción agregada a un paso', () => {
    const antes = proc([paso({ id: 'p3', titulo: 'Databases', tareas: ['a'] })])
    const despues = proc([paso({ id: 'p3', titulo: 'Databases', tareas: ['a', 'b'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregó una nueva instrucción al Paso 1: Databases.',
    ])
  })

  it('detecta una instrucción eliminada de un paso', () => {
    const antes = proc([paso({ id: 'p2', titulo: 'Ingresar usuario y contraseña', tareas: ['a', 'b'] })])
    const despues = proc([paso({ id: 'p2', titulo: 'Ingresar usuario y contraseña', tareas: ['a'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se eliminó una instrucción del Paso 1: Ingresar usuario y contraseña.',
    ])
  })

  it('detecta la edición de una instrucción sin contarla como alta y baja', () => {
    const antes = proc([paso({ id: 'p3', titulo: 'Databases', tareas: ['abrir consola'] })])
    const despues = proc([paso({ id: 'p3', titulo: 'Databases', tareas: ['abrir la consola'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se editó una instrucción del Paso 1: Databases.',
    ])
  })

  it('pluraliza varias instrucciones agregadas', () => {
    const antes = proc([paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] })])
    const despues = proc([paso({ id: 'p1', titulo: 'Uno', tareas: ['a', 'b', 'c'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregaron 2 instrucciones al Paso 1: Uno.',
    ])
  })

  it('detecta el cambio de título de un paso', () => {
    const antes = proc([paso({ id: 'p1', titulo: 'Viejo', tareas: ['a'] })])
    const despues = proc([paso({ id: 'p1', titulo: 'Nuevo', tareas: ['a'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se modificó el título del Paso 1: "Viejo" → "Nuevo".',
    ])
  })

  it('detecta credencial agregada, reemplazada y eliminada', () => {
    const base = paso({ id: 'p2', titulo: 'Login', tareas: ['a'] })
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

  it('detecta imágenes y archivos agregados y eliminados en un paso', () => {
    const img = (ref: string) => ({ referencia: ref, nombre: 'f.jpg', tipo: 'image/jpeg' })
    const pdf = (ref: string) => ({ referencia: ref, nombre: 'm.pdf', tipo: 'application/pdf' })
    const base = paso({ id: 'p4', titulo: 'Foto', tareas: ['a'] })

    // Una imagen agregada.
    expect(
      resumenProcedimiento(json(proc([base])), json(proc([paso({ ...base, adjuntos: [img('r/1.jpg')] })])))
        .cambios,
    ).toEqual(['Se agregó una imagen al Paso 1: Foto.'])

    // Reemplazo (quitar una y agregar otra) se ve como alta y baja.
    expect(
      resumenProcedimiento(
        json(proc([paso({ ...base, adjuntos: [img('r/1.jpg')] })])),
        json(proc([paso({ ...base, adjuntos: [img('r/2.jpg')] })])),
      ).cambios,
    ).toEqual(['Se agregó una imagen al Paso 1: Foto.', 'Se eliminó una imagen del Paso 1: Foto.'])

    // Un archivo (no imagen) eliminado.
    expect(
      resumenProcedimiento(json(proc([paso({ ...base, adjuntos: [pdf('r/m.pdf')] })])), json(proc([base])))
        .cambios,
    ).toEqual(['Se eliminó un archivo del Paso 1: Foto.'])

    // Varias imágenes agregadas se pluralizan.
    expect(
      resumenProcedimiento(
        json(proc([base])),
        json(proc([paso({ ...base, adjuntos: [img('r/1.jpg'), img('r/2.jpg')] })])),
      ).cambios,
    ).toEqual(['Se agregaron 2 imágenes al Paso 1: Foto.'])
  })

  it('describe un paso nuevo por su título', () => {
    const antes = proc([paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] })])
    const despues = proc([
      paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] }),
      paso({ id: 'p2', titulo: 'Realizar copia de seguridad', tareas: ['x'] }),
    ])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregó un nuevo paso "Realizar copia de seguridad".',
    ])
  })

  it('describe un paso eliminado por su posición anterior', () => {
    const antes = proc([
      paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] }),
      paso({ id: 'p5', titulo: 'Cinco', tareas: ['e'] }),
    ])
    const despues = proc([paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] })])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se eliminó el Paso 2: Cinco.',
    ])
  })

  it('detecta el cambio de orden de los pasos', () => {
    const antes = proc([
      paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] }),
      paso({ id: 'p2', titulo: 'Dos', tareas: ['b'] }),
    ])
    const despues = proc([
      paso({ id: 'p2', titulo: 'Dos', tareas: ['b'] }),
      paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] }),
    ])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toContain(
      'Se cambió el orden de los pasos.',
    )
  })

  it('detecta un requisito actualizado del procedimiento', () => {
    const antes = proc([paso({ id: 'p1', tareas: ['a'] })], ['Tener acceso VPN'])
    const despues = proc([paso({ id: 'p1', tareas: ['a'] })], ['Tener acceso a la VPN'])
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se actualizó un requisito del procedimiento.',
    ])
  })

  it('reúne varios cambios de una misma edición', () => {
    const antes = proc([
      paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] }),
      paso({ id: 'p3', titulo: 'Databases', tareas: ['x'] }),
    ])
    const despues = proc([
      paso({ id: 'p1', titulo: 'Uno editado', tareas: ['a'] }),
      paso({ id: 'p3', titulo: 'Databases', tareas: ['x', 'y'] }),
    ])
    const cambios = resumenProcedimiento(json(antes), json(despues)).cambios
    expect(cambios).toEqual([
      'Se modificó el título del Paso 1: "Uno" → "Uno editado".',
      'Se agregó una nueva instrucción al Paso 2: Databases.',
    ])
  })

  it('detecta el objetivo de un paso definido, modificado y quitado', () => {
    const sinObjetivo = paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] })
    const conObjetivo = paso({ ...sinObjetivo, objetivo: 'Dejarlo listo' })
    const otroObjetivo = paso({ ...sinObjetivo, objetivo: 'Otro objetivo' })

    expect(resumenProcedimiento(json(proc([sinObjetivo])), json(proc([conObjetivo]))).cambios).toEqual([
      'Se definió el objetivo del Paso 1: Uno.',
    ])
    expect(resumenProcedimiento(json(proc([conObjetivo])), json(proc([otroObjetivo]))).cambios).toEqual([
      'Se actualizó el objetivo del Paso 1: Uno.',
    ])
    expect(resumenProcedimiento(json(proc([conObjetivo])), json(proc([sinObjetivo]))).cambios).toEqual([
      'Se quitó el objetivo del Paso 1: Uno.',
    ])
  })

  it('detecta el objetivo general, el tiempo estimado y la dificultad del procedimiento', () => {
    const base = proc([paso({ id: 'p1', tareas: ['a'] })])
    const conMetadatos: Procedimiento = {
      ...base,
      objetivoGeneral: 'Dejar todo operativo',
      tiempoEstimadoMin: 15,
      dificultad: 'intermedio',
    }
    expect(resumenProcedimiento(json(base), json(conMetadatos)).cambios).toEqual([
      'Se definió el objetivo general del procedimiento.',
      'Se actualizó el tiempo estimado a 15 min.',
      'Se actualizó la dificultad a "intermedio".',
    ])
    expect(resumenProcedimiento(json(conMetadatos), json(base)).cambios).toEqual([
      'Se quitó el objetivo general del procedimiento.',
      'Se quitó el tiempo estimado del procedimiento.',
      'Se quitó la dificultad del procedimiento.',
    ])
  })

  it('detecta un ítem agregado a la verificación final', () => {
    const antes: Procedimiento = { ...proc([paso({ id: 'p1', tareas: ['a'] })]) }
    const despues: Procedimiento = { ...antes, verificacionFinal: ['La impresora imprime'] }
    expect(resumenProcedimiento(json(antes), json(despues)).cambios).toEqual([
      'Se agregó un ítem de la verificación final.',
    ])
  })

  it('detecta un aviso agregado y editado en un paso', () => {
    const base = paso({ id: 'p1', titulo: 'Uno', tareas: ['a'] })
    const conAviso = paso({ ...base, bloques: [...base.bloques, aviso('No apagar el servidor', 'importante')] })
    expect(resumenProcedimiento(json(proc([base])), json(proc([conAviso]))).cambios).toEqual([
      'Se agregó un aviso al Paso 1: Uno.',
    ])

    const avisoEditado = paso({ ...base, bloques: [base.bloques[0], aviso('No apagar nunca el servidor', 'importante')] })
    expect(resumenProcedimiento(json(proc([conAviso])), json(proc([avisoEditado]))).cambios).toEqual([
      'Se editó un aviso del Paso 1: Uno.',
    ])
  })

  it('cuenta las imágenes intercaladas en el cuerpo junto a las de la galería', () => {
    const base = paso({ id: 'p1', titulo: 'Foto', tareas: ['a'] })
    const conImagenInline = paso({
      ...base,
      bloques: [
        ...base.bloques,
        { id: 'img', tipo: 'imagen', texto: '', tono: null, adjunto: { referencia: 'r/1.jpg', nombre: 'a.jpg', tipo: 'image/jpeg' } },
      ],
    })
    expect(resumenProcedimiento(json(proc([base])), json(proc([conImagenInline]))).cambios).toEqual([
      'Se agregó una imagen al Paso 1: Foto.',
    ])
  })

  it('ante un cambio no reconocible ofrece un resumen genérico', () => {
    // JSON invalido en ambos lados: nunca debe volcarse crudo.
    const resumen = resumenProcedimiento('{no es json', '{tampoco')
    expect(resumen.cambios).toEqual(['Se actualizó el procedimiento.'])
  })
})
