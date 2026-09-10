import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { accionFoco, idTareaGuiaDelPaso, tareaFocoHecha, tareasParaFoco } from './tareasFoco'

function bloque(parcial: Partial<BloquePaso> & { id: string; tipo: BloquePaso['tipo'] }): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, ...parcial }
}

function paso(parcial: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'p1',
    titulo: 'Cargar el rollo de etiquetas',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    ...parcial,
  } as PasoProcedimiento
}

describe('tareasParaFoco', () => {
  it('devuelve las tareas del paso en orden, ignorando imagenes y apoyos sin alcance', () => {
    const p = paso({
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Abrir la tapa lateral' }),
        bloque({ id: 'b2', tipo: 'imagen', texto: 'La guia del rollo' }),
        bloque({ id: 'b3', tipo: 'tarea', texto: 'Colocar el rollo hacia arriba' }),
      ],
    })
    expect(tareasParaFoco(p, 'Cargar el rollo').map((t) => t.texto)).toEqual([
      'Abrir la tapa lateral',
      'Colocar el rollo hacia arriba',
    ])
    expect(tareasParaFoco(p, 'Cargar el rollo').every((t) => !t.esPasoEntero)).toBe(true)
  })

  it('un paso SIN tareas se presenta como una sola tarea con el titulo (G-18)', () => {
    const tareas = tareasParaFoco(paso({ bloques: [] }), 'Desembalar y ubicar')
    expect(tareas).toHaveLength(1)
    expect(tareas[0].texto).toBe('Desembalar y ubicar')
    expect(tareas[0].esPasoEntero).toBe(true)
    // El id no puede chocar con el de un bloque: el progreso se guarda
    // por id y marcar esta pseudo tarea no debe ensuciar nada.
    expect(tareas[0].id).toBe('paso:p1')
  })

  it('un paso con solo avisos conserva su tarea unica detras de ellos', () => {
    const p = paso({
      bloques: [bloque({ id: 'b1', tipo: 'aviso', alcance: 'paso', texto: 'Cuidado' })],
    })
    const recorrido = tareasParaFoco(p, 'Revisar')
    expect(recorrido.map((t) => t.clase)).toEqual(['aviso', 'paso-entero'])
    // Sin esto el paso se quedaria sin forma de cerrarse: el boton
    // grande cuelga de la entrada 'paso-entero'.
    expect(recorrido[1].esPasoEntero).toBe(true)
  })

  it('el vinculo protegido de la tarea gana al del paso, y el del paso sirve de respaldo', () => {
    const vinculoTarea = { tipo: 'credencial', id: 'c1', titulo: 'Admin Zebra' } as never
    const vinculoPaso = { tipo: 'credencial', id: 'c2', titulo: 'Admin red' } as never
    const p = paso({
      vinculoProtegido: vinculoPaso,
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Con clave propia', vinculoProtegido: vinculoTarea }),
        bloque({ id: 'b2', tipo: 'tarea', texto: 'Sin clave propia' }),
      ],
    })
    const tareas = tareasParaFoco(p, 'Conectar')
    expect(tareas[0].vinculoProtegido).toBe(vinculoTarea)
    expect(tareas[1].vinculoProtegido).toBe(vinculoPaso)
  })

  it('la tarea unica hereda el vinculo protegido del paso', () => {
    const vinculoPaso = { tipo: 'credencial', id: 'c2', titulo: 'Admin red' } as never
    const tareas = tareasParaFoco(paso({ bloques: [], vinculoProtegido: vinculoPaso }), 'Conectar')
    expect(tareas[0].vinculoProtegido).toBe(vinculoPaso)
  })
})

// Encargo del 2026-09-10, tarea 1: un aviso deja de ser un apoyo pasivo
// pegado a la instruccion y pasa a ocupar su propio turno del recorrido.
describe('los avisos como elementos del recorrido', () => {
  function aviso(id: string, texto: string, extra: Partial<BloquePaso> = {}) {
    return bloque({ id, tipo: 'aviso', texto, tono: 'precaucion', ...extra })
  }

  const p = paso({
    bloques: [
      aviso('a-paso', 'Corta la energia antes de abrir', { alcance: 'paso' }),
      bloque({ id: 't1', tipo: 'tarea', texto: 'Abrir la tapa' }),
      aviso('a-t2', 'La guia se dobla si la fuerzas', { alcance: 'tarea', tareaId: 't2' }),
      bloque({ id: 't2', tipo: 'tarea', texto: 'Colocar el rollo' }),
    ],
  })

  it('el del paso va UNA vez, delante de la primera tarea', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    expect(recorrido.map((t) => t.id)).toEqual(['a-paso', 't1', 'a-t2', 't2'])
    expect(recorrido.filter((t) => t.id === 'a-paso')).toHaveLength(1)
  })

  it('el de una tarea va inmediatamente antes de ESA tarea y no se repite en las demas', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    const posicionAviso = recorrido.findIndex((t) => t.id === 'a-t2')
    expect(recorrido[posicionAviso + 1].id).toBe('t2')
    expect(recorrido.filter((t) => t.id === 'a-t2')).toHaveLength(1)
  })

  it('conserva el bloque entero, con su tono y su alcance', () => {
    const entrada = tareasParaFoco(p, 'Cargar el rollo')[0]
    expect(entrada.clase).toBe('aviso')
    expect(entrada.aviso?.tono).toBe('precaucion')
    expect(entrada.aviso?.alcance).toBe('paso')
    expect(entrada.texto).toBe('Corta la energia antes de abrir')
  })

  it('dos avisos con el MISMO texto siguen siendo dos elementos distintos', () => {
    // No se deduplica por texto: cada bloque es del autor y tiene su
    // sitio, aunque repita palabra por palabra.
    const repetido = paso({
      bloques: [
        aviso('a1', 'Usa guantes', { alcance: 'tarea', tareaId: 't1' }),
        bloque({ id: 't1', tipo: 'tarea', texto: 'Sacar el fusor' }),
        aviso('a2', 'Usa guantes', { alcance: 'tarea', tareaId: 't2' }),
        bloque({ id: 't2', tipo: 'tarea', texto: 'Montar el fusor nuevo' }),
      ],
    })
    expect(tareasParaFoco(repetido, 'Cambiar el fusor').map((t) => t.id)).toEqual([
      'a1',
      't1',
      'a2',
      't2',
    ])
  })

  it('la posicion es estable al reordenar las tareas: el aviso sigue a la suya', () => {
    // El anclaje es `tareaId`, no la posicion dentro de `bloques`.
    const reordenado = paso({
      bloques: [
        aviso('a-paso', 'Corta la energia antes de abrir', { alcance: 'paso' }),
        aviso('a-t2', 'La guia se dobla si la fuerzas', { alcance: 'tarea', tareaId: 't2' }),
        bloque({ id: 't2', tipo: 'tarea', texto: 'Colocar el rollo' }),
        bloque({ id: 't1', tipo: 'tarea', texto: 'Abrir la tapa' }),
      ],
    })
    expect(tareasParaFoco(reordenado, 'Cargar el rollo').map((t) => t.id)).toEqual([
      'a-paso',
      'a-t2',
      't2',
      't1',
    ])
  })

  it('un aviso heredado sin asignar se comporta como el del paso', () => {
    const heredado = paso({
      bloques: [
        aviso('a-viejo', 'Escrito antes del campo alcance', { alcance: 'sin-asignar' }),
        bloque({ id: 't1', tipo: 'tarea', texto: 'Abrir la tapa' }),
      ],
    })
    expect(tareasParaFoco(heredado, 'Paso').map((t) => t.id)).toEqual(['a-viejo', 't1'])
  })

  it('se cumple al confirmarlo, y la confirmacion NO viaja en el avance marcado', () => {
    const [avisoPaso] = tareasParaFoco(p, 'Cargar el rollo')
    // Aunque su id apareciera entre las tareas marcadas, sin la
    // confirmacion de ESTA ejecucion sigue pendiente: repetir la guia
    // vuelve a mostrarlo.
    expect(tareaFocoHecha(avisoPaso, new Set(['a-paso']), true)).toBe(false)
    expect(tareaFocoHecha(avisoPaso, new Set(), true, new Set(['a-paso']))).toBe(true)
  })

  it('confirmarlo no cierra el paso: el paso sigue esperando sus tareas', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    const confirmados = new Set(['a-paso', 'a-t2'])
    expect(accionFoco(recorrido, new Set(), true, confirmados)).toBe('marcar')
    expect(accionFoco(recorrido, new Set(['t1', 't2']), true, confirmados)).toBe('completar')
  })

  it('un aviso sin confirmar mantiene el recorrido en marcha', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    expect(accionFoco(recorrido, new Set(['t1', 't2']), true, new Set(['a-paso']))).toBe('marcar')
  })
})

describe('accionFoco', () => {
  const dos = tareasParaFoco(
    paso({
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Una' }),
        bloque({ id: 'b2', tipo: 'tarea', texto: 'Otra' }),
      ],
    }),
    'Paso',
  )

  it('marca mientras quede alguna tarea sin hacer', () => {
    expect(accionFoco(dos, new Set())).toBe('marcar')
    expect(accionFoco(dos, new Set(['b1']))).toBe('marcar')
  })

  it('cierra el paso cuando ya no queda ninguna', () => {
    expect(accionFoco(dos, new Set(['b1', 'b2']))).toBe('completar')
  })

  it('el paso sin tareas cierra desde el principio: no hay nada intermedio que marcar', () => {
    const unica = tareasParaFoco(paso({ bloques: [] }), 'Desembalar')
    expect(accionFoco(unica, new Set())).toBe('completar')
  })
})

// H05 / A09 / A10: la guía vinculada del paso deja de ser un mensaje de
// bloqueo y pasa a ser la primera tarea del recorrido, que es lo que
// permite abrirla, hacerla y volver.
describe('la guía vinculada del paso dentro del recorrido', () => {
  const conGuia = paso({
    subArticuloId: 'art-gestor',
    subArticuloTitulo: 'Acceder al gestor',
    bloques: [
      bloque({ id: 'b1', tipo: 'tarea', texto: 'Crear la ficha' }),
      bloque({ id: 'b2', tipo: 'tarea', texto: 'Comprobar que aparece' }),
    ],
  })

  it('entra como PRIMERA tarea, con el título de la guía', () => {
    const tareas = tareasParaFoco(conGuia, 'Entrar al gestor')
    expect(tareas.map((t) => t.texto)).toEqual(['Acceder al gestor', 'Crear la ficha', 'Comprobar que aparece'])
    expect(tareas[0].clase).toBe('guia-del-paso')
    expect(tareas[0].guiaId).toBe('art-gestor')
    expect(tareas[0].id).toBe(idTareaGuiaDelPaso('p1'))
  })

  it('un paso cuyo único trabajo es la guía vinculada no cae en la tarea única del paso', () => {
    const soloGuia = paso({ subArticuloId: 'art-gestor', subArticuloTitulo: 'Acceder al gestor', bloques: [] })
    const tareas = tareasParaFoco(soloGuia, 'Entrar')
    expect(tareas).toHaveLength(1)
    expect(tareas[0].clase).toBe('guia-del-paso')
    expect(tareas[0].esPasoEntero).toBe(false)
  })

  it('NO se cumple marcándola: se cumple cuando la guía vinculada está completa (A10)', () => {
    const [guia] = tareasParaFoco(conGuia, 'Entrar al gestor')
    // Aunque su id apareciera en el avance marcado, sin la guía hecha
    // sigue pendiente: volver de ella a medias no la da por completada.
    expect(tareaFocoHecha(guia, new Set([guia.id]), false)).toBe(false)
    expect(tareaFocoHecha(guia, new Set(), true)).toBe(true)
  })

  it('el paso no se cierra mientras la guía vinculada siga pendiente', () => {
    const tareas = tareasParaFoco(conGuia, 'Entrar al gestor')
    const todasMarcadas = new Set(['b1', 'b2'])
    expect(accionFoco(tareas, todasMarcadas, false)).toBe('marcar')
    expect(accionFoco(tareas, todasMarcadas, true)).toBe('completar')
  })

  it('una guía "necesario" colgada de una tarea condiciona esa tarea, no el paso entero', () => {
    const p = paso({
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Abrir la consola' }),
        bloque({
          id: 'g1',
          tipo: 'guia',
          alcance: 'tarea',
          tareaId: 'b1',
          guiaArticuloId: 'art-consola',
          guiaArticuloTitulo: 'Abrir la consola de ejemplo',
          intencionGuia: 'necesario',
        }),
        bloque({ id: 'b2', tipo: 'tarea', texto: 'Escribir el nombre' }),
      ],
    })
    const tareas = tareasParaFoco(p, 'Paso')
    expect(tareas.map((t) => t.guiaId)).toEqual(['art-consola', null])
    expect(tareas[0].intencionGuia).toBe('necesario')
  })

  it('una guía de consulta NO condiciona la tarea (punto 6 de la sección 5)', () => {
    const p = paso({
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Abrir la consola' }),
        bloque({
          id: 'g1',
          tipo: 'guia',
          alcance: 'tarea',
          tareaId: 'b1',
          guiaArticuloId: 'art-manual',
          guiaArticuloTitulo: 'Manual de referencia',
          intencionGuia: 'consulta',
        }),
      ],
    })
    expect(tareasParaFoco(p, 'Paso')[0].guiaId).toBeNull()
  })
})

describe('guías obligatorias en el recorrido (encargo 2026-09-09, tarea 1)', () => {
  function guia(id: string, tareaId: string, articuloId: string, titulo: string, intencion: BloquePaso['intencionGuia']) {
    return bloque({
      id,
      tipo: 'guia',
      alcance: 'tarea',
      tareaId,
      guiaArticuloId: articuloId,
      guiaArticuloTitulo: titulo,
      intencionGuia: intencion,
    })
  }

  const p = paso({
    bloques: [
      bloque({ id: 't1', tipo: 'tarea', texto: 'Sin guías' }),
      bloque({ id: 't2', tipo: 'tarea', texto: 'Con una' }),
      guia('g1', 't2', 'art-a', 'Primera', 'necesario'),
      bloque({ id: 't3', tipo: 'tarea', texto: 'Con dos' }),
      guia('g2', 't3', 'art-b', 'Segunda', 'necesario'),
      guia('g3', 't3', 'art-c', 'Apoyo', 'consulta'),
      guia('g4', 't3', 'art-d', 'Tercera', 'necesario'),
    ],
  })

  it('cero guías: la tarea no arrastra ninguna', () => {
    const t = tareasParaFoco(p, 'Paso')[0]
    expect(t.guiasObligatorias).toEqual([])
    expect(t.guiaId).toBeNull()
  })

  it('una guía: la lleva y la nombra', () => {
    const t = tareasParaFoco(p, 'Paso')[1]
    expect(t.guiasObligatorias.map((g) => g.guiaArticuloId)).toEqual(['art-a'])
    expect(t.guiaTitulo).toBe('Primera')
  })

  it('VARIAS guías: las lleva todas, en el orden del editor', () => {
    // El defecto: `.find` se quedaba con 'art-b' y 'art-d' no existía
    // para el recorrido, así que ni se veía ni se exigía.
    const t = tareasParaFoco(p, 'Paso')[2]
    expect(t.guiasObligatorias.map((g) => g.guiaArticuloId)).toEqual(['art-b', 'art-d'])
  })

  it('la de consulta no entra en las obligatorias', () => {
    const t = tareasParaFoco(p, 'Paso')[2]
    expect(t.guiasObligatorias.some((g) => g.guiaArticuloId === 'art-c')).toBe(false)
  })
})
