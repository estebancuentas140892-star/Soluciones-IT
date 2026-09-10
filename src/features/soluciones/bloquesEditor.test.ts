import { describe, expect, it } from 'vitest'
import type { BloquePaso } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { apoyosDeTarea } from './apoyosTarea'
import {
  cambiarTipoTarea,
  DESTINO_PASO,
  destinoTarea,
  etiquetaDestino,
  insertarApoyo,
  moverBloque,
  moverTareaConApoyos,
  opcionesDestino,
  reasignarApoyo,
} from './bloquesEditor'

function bloque(parcial: Partial<BloquePaso> & { id: string; tipo: BloquePaso['tipo'] }): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, ...parcial }
}

const FOTO = { referencia: 'r/1.jpg', nombre: '1.jpg', tipo: 'image/jpeg' }

function pasoDePrueba(): BloquePaso[] {
  return [
    bloque({ id: 't1', tipo: 'tarea', texto: 'Escribir la dirección', tipoTarea: 'accion' }),
    bloque({ id: 'a1', tipo: 'aviso', texto: 'Cuidado con la dirección', alcance: 'tarea', tareaId: 't1' }),
    bloque({ id: 't2', tipo: 'tarea', texto: 'Confirmar', tipoTarea: 'accion' }),
    bloque({ id: 't3', tipo: 'tarea', texto: 'Comprobar', tipoTarea: 'verificacion' }),
  ]
}

describe('insertarApoyo', () => {
  it('coloca el apoyo junto a su tarea, no al final del paso', () => {
    const nuevo = bloque({ id: 'i1', tipo: 'imagen', adjunto: FOTO })
    const resultado = insertarApoyo(pasoDePrueba(), nuevo, destinoTarea('t1'))
    // Detrás de la tarea 1 y del aviso que ya colgaba de ella.
    expect(resultado.map((b) => b.id)).toEqual(['t1', 'a1', 'i1', 't2', 't3'])
    expect(resultado[2].alcance).toBe('tarea')
    expect(resultado[2].tareaId).toBe('t1')
  })

  it('un apoyo del paso completo va al final: no acompaña a ninguna tarea', () => {
    const nuevo = bloque({ id: 'a2', tipo: 'aviso', texto: 'Vale para todo el paso' })
    const resultado = insertarApoyo(pasoDePrueba(), nuevo, DESTINO_PASO)
    expect(resultado.map((b) => b.id)).toEqual(['t1', 'a1', 't2', 't3', 'a2'])
    expect(resultado[4].alcance).toBe('paso')
  })

  it('si la tarea de destino no existe, el apoyo se conserva al final en vez de perderse', () => {
    const nuevo = bloque({ id: 'a3', tipo: 'aviso', texto: 'Huérfano' })
    const resultado = insertarApoyo(pasoDePrueba(), nuevo, destinoTarea('inexistente'))
    expect(resultado).toHaveLength(5)
    expect(resultado[4].id).toBe('a3')
  })
})

// A06: reordenar una tarea conserva sus imágenes, avisos y vínculos.
describe('reordenar', () => {
  it('mover una tarea se lleva sus apoyos con ella', () => {
    const resultado = moverTareaConApoyos(pasoDePrueba(), 't1', 1)
    expect(resultado.map((b) => b.id)).toEqual(['t2', 't1', 'a1', 't3'])
  })

  it('el apoyo sigue perteneciendo a su tarea después de reordenar', () => {
    const bloques = moverTareaConApoyos(pasoDePrueba(), 't1', 1)
    const paso = {
      id: 'p1',
      titulo: '',
      objetivo: '',
      bloques,
      adjuntos: [],
      vinculoProtegido: null,
      subArticuloId: null,
      subArticuloTitulo: '',
      solucionArticuloId: null,
      solucionArticuloTitulo: '',
    }
    expect(apoyosDeTarea(paso, 't1').avisos.map((b) => b.id)).toEqual(['a1'])
    expect(apoyosDeTarea(paso, 't2').avisos).toEqual([])
  })

  it('no se sale del rango por los extremos', () => {
    expect(moverTareaConApoyos(pasoDePrueba(), 't1', -1).map((b) => b.id)).toEqual(['t1', 'a1', 't2', 't3'])
    expect(moverTareaConApoyos(pasoDePrueba(), 't3', 1).map((b) => b.id)).toEqual(['t1', 'a1', 't2', 't3'])
  })

  it('mover un bloque suelto no cambia a quién pertenece', () => {
    const resultado = moverBloque(pasoDePrueba(), 'a1', 1)
    expect(resultado.map((b) => b.id)).toEqual(['t1', 't2', 'a1', 't3'])
    expect(resultado.find((b) => b.id === 'a1')?.tareaId).toBe('t1')
  })
})

describe('reasignarApoyo', () => {
  it('mueve el apoyo de una tarea a otra sin tocar su contenido', () => {
    const resultado = reasignarApoyo(pasoDePrueba(), 'a1', destinoTarea('t3'))
    const aviso = resultado.find((b) => b.id === 'a1')
    expect(aviso?.tareaId).toBe('t3')
    expect(aviso?.texto).toBe('Cuidado con la dirección')
  })

  it('un apoyo heredado se resuelve asignándolo, y deja de estar sin asignar', () => {
    const bloques = [
      bloque({ id: 't1', tipo: 'tarea', texto: 'Una' }),
      bloque({ id: 'a1', tipo: 'aviso', texto: 'Heredado', alcance: 'sin-asignar' }),
    ]
    expect(etiquetaDestino(bloques, bloques[1])).toBe('Sin asignar')
    const resultado = reasignarApoyo(bloques, 'a1', destinoTarea('t1'))
    expect(etiquetaDestino(resultado, resultado[1])).toBe('Tarea 1')
  })
})

// Requisito 7: cambiar el tipo no borra nada en silencio.
describe('cambiarTipoTarea', () => {
  const decision = bloque({
    id: 'd1',
    tipo: 'tarea',
    texto: '¿Aparece la impresora?',
    tipoTarea: 'decision',
    decisionArticuloId: 'art-9',
    decisionArticuloTitulo: 'Reinstalar el controlador',
  })

  it('avisa de lo que quedaría fuera al salir de decisión', () => {
    const { bloque: nuevo, perdido } = cambiarTipoTarea(decision, 'accion')
    expect(perdido).toHaveLength(1)
    expect(perdido[0]).toContain('Reinstalar el controlador')
    expect(nuevo.decisionArticuloId).toBeNull()
    // El texto de la línea nunca se pierde: es compatible con los tres.
    expect(nuevo.texto).toBe('¿Aparece la impresora?')
  })

  it('sin vínculo que soltar no hay nada que avisar', () => {
    const simple = bloque({ id: 't1', tipo: 'tarea', texto: 'Encender', tipoTarea: 'accion' })
    expect(cambiarTipoTarea(simple, 'verificacion').perdido).toEqual([])
  })

  it('volver a decisión no pierde nada', () => {
    expect(cambiarTipoTarea(decision, 'decision').bloque.decisionArticuloId).toBe('art-9')
  })
})

describe('etiquetas del selector de destino', () => {
  it('nombra la tarea por su número dentro del paso', () => {
    const bloques = pasoDePrueba()
    expect(etiquetaDestino(bloques, bloques[1])).toBe('Tarea 1')
    expect(etiquetaDestino(bloques, { ...bloques[1], alcance: 'paso', tareaId: null })).toBe('Todo el paso')
  })

  it('lista las tareas numeradas para elegir destino', () => {
    expect(opcionesDestino(pasoDePrueba()).map((o) => o.numero)).toEqual([1, 2, 3])
  })
})

// UN TERMINO VINCULADO SIGUE A SU TAREA (encargo del 2026-09-10, tarea
// 3: "conserva su posicion al reordenar la tarea con sus apoyos"). No
// hace falta logica nueva: el anclaje es `tareaId`, un id estable, no
// una posicion, asi que el bloque de referencia se comporta como
// cualquier otro apoyo. Esta prueba existe para demostrarlo.
describe('bloques de referencia al reordenar', () => {
  function pasoConTermino(): BloquePaso[] {
    return [
      bloque({ id: 't1', tipo: 'tarea', texto: 'Escribir la dirección', tipoTarea: 'accion' }),
      bloque({ id: 'r1', tipo: 'referencia', referenciaId: 'ref-1', referenciaTitulo: 'DNS', alcance: 'tarea', tareaId: 't1' }),
      bloque({ id: 't2', tipo: 'tarea', texto: 'Confirmar', tipoTarea: 'accion' }),
    ]
  }

  it('se mueve pegado a su tarea', () => {
    const resultado = moverTareaConApoyos(pasoConTermino(), 't1', 1)
    expect(resultado.map((b) => b.id)).toEqual(['t2', 't1', 'r1'])
    expect(resultado[2].tareaId).toBe('t1')
  })

  it('sigue perteneciendo a la misma tarea después de reordenar', () => {
    const resultado = moverTareaConApoyos(pasoConTermino(), 't1', 1)
    expect(apoyosDeTarea(pasoDeBloques(resultado), 't1').referencias.map((b) => b.id)).toEqual(['r1'])
    expect(apoyosDeTarea(pasoDeBloques(resultado), 't2').referencias).toEqual([])
  })

  it('se puede reasignar a otra tarea o al paso completo', () => {
    const aTarea2 = reasignarApoyo(pasoConTermino(), 'r1', destinoTarea('t2'))
    expect(aTarea2.find((b) => b.id === 'r1')?.tareaId).toBe('t2')
    const alPaso = reasignarApoyo(pasoConTermino(), 'r1', DESTINO_PASO)
    expect(alPaso.find((b) => b.id === 'r1')?.alcance).toBe('paso')
  })
})

function pasoDeBloques(bloques: BloquePaso[]) {
  return {
    id: 'p1',
    titulo: 'Paso',
    objetivo: '',
    bloques,
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}
