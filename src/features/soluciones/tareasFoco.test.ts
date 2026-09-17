import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { accionFoco, avisosDeTareaFoco, idTareaGuiaDelPaso, tareaFocoHecha, tareasParaFoco } from './tareasFoco'

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

  it('un paso con solo avisos conserva su tarea unica, y el aviso va con ella', () => {
    const p = paso({
      bloques: [bloque({ id: 'b1', tipo: 'aviso', alcance: 'paso', tono: 'precaucion', texto: 'Cuidado' })],
    })
    const recorrido = tareasParaFoco(p, 'Revisar')
    // El aviso ya no es una parada: el recorrido es solo el trabajo.
    expect(recorrido.map((t) => t.clase)).toEqual(['paso-entero'])
    // Sin esto el paso se quedaria sin forma de cerrarse: el boton
    // grande cuelga de la entrada 'paso-entero'.
    expect(recorrido[0].esPasoEntero).toBe(true)
    expect(avisosDeTareaFoco(p, recorrido, 0).alertas.map((a) => a.id)).toEqual(['b1'])
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

// Encargo del 2026-09-17 (secciones 6 y 7): los avisos dejan de ser
// paradas del recorrido. El recorrido es solo trabajo, y cada aviso
// acompaña a su accion con un trato que decide el tono.
describe('los avisos acompañan a su acción, sin detener el recorrido', () => {
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

  it('el recorrido solo tiene trabajo: ningun aviso ocupa un turno', () => {
    expect(tareasParaFoco(p, 'Cargar el rollo').map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('el del paso va UNA vez, con la primera accion, y no se repite en las demas', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    expect(avisosDeTareaFoco(p, recorrido, 0).alertas.map((a) => a.id)).toEqual(['a-paso'])
    expect(avisosDeTareaFoco(p, recorrido, 1).alertas.map((a) => a.id)).toEqual(['a-t2'])
  })

  it('el de una tarea va con ESA tarea y con ninguna otra', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    const conAviso = recorrido.map((_, i) => avisosDeTareaFoco(p, recorrido, i).alertas.some((a) => a.id === 'a-t2'))
    expect(conAviso).toEqual([false, true])
  })

  it('conserva el bloque entero, con su tono y su alcance', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    const [primero] = avisosDeTareaFoco(p, recorrido, 0).alertas
    expect(primero.tono).toBe('precaucion')
    expect(primero.alcance).toBe('paso')
    expect(primero.texto).toBe('Corta la energia antes de abrir')
  })

  it('el tono decide el trato: riesgo como alerta, dato a la vista, informacion y consejo plegados', () => {
    const variado = paso({
      bloques: [
        bloque({ id: 't1', tipo: 'tarea', texto: 'Guardar la configuracion' }),
        aviso('imp', 'Borra la configuracion anterior', { tono: 'importante', alcance: 'tarea', tareaId: 't1' }),
        aviso('pre', 'Cierra la caja antes', { tono: 'precaucion', alcance: 'tarea', tareaId: 't1' }),
        aviso('dat', 'Prefijo: EJ01', { tono: 'dato', alcance: 'tarea', tareaId: 't1' }),
        aviso('inf', 'Por que se hace esto', { tono: 'info', alcance: 'tarea', tareaId: 't1' }),
        aviso('con', 'Truco del equipo', { tono: 'consejo', alcance: 'tarea', tareaId: 't1' }),
      ],
    })
    const recorrido = tareasParaFoco(variado, 'Guardar')
    const avisos = avisosDeTareaFoco(variado, recorrido, 0)
    expect(avisos.alertas.map((a) => a.id)).toEqual(['imp', 'pre'])
    expect(avisos.datos.map((a) => a.id)).toEqual(['dat'])
    expect(avisos.plegados.map((a) => a.id)).toEqual(['inf', 'con'])
  })

  it('dos avisos con el MISMO texto siguen siendo dos, cada uno con su tarea', () => {
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
    const recorrido = tareasParaFoco(repetido, 'Cambiar el fusor')
    expect(avisosDeTareaFoco(repetido, recorrido, 0).alertas.map((a) => a.id)).toEqual(['a1'])
    expect(avisosDeTareaFoco(repetido, recorrido, 1).alertas.map((a) => a.id)).toEqual(['a2'])
  })

  it('al reordenar las tareas el aviso sigue a la suya: el anclaje es `tareaId`, no la posicion', () => {
    const reordenado = paso({
      bloques: [
        aviso('a-paso', 'Corta la energia antes de abrir', { alcance: 'paso' }),
        aviso('a-t2', 'La guia se dobla si la fuerzas', { alcance: 'tarea', tareaId: 't2' }),
        bloque({ id: 't2', tipo: 'tarea', texto: 'Colocar el rollo' }),
        bloque({ id: 't1', tipo: 'tarea', texto: 'Abrir la tapa' }),
      ],
    })
    const recorrido = tareasParaFoco(reordenado, 'Cargar el rollo')
    expect(recorrido.map((t) => t.id)).toEqual(['t2', 't1'])
    expect(avisosDeTareaFoco(reordenado, recorrido, 0).alertas.map((a) => a.id)).toEqual(['a-paso', 'a-t2'])
    expect(avisosDeTareaFoco(reordenado, recorrido, 1).alertas).toEqual([])
  })

  it('un aviso heredado sin asignar se comporta como el del paso', () => {
    const heredado = paso({
      bloques: [
        aviso('a-viejo', 'Escrito antes del campo alcance', { alcance: 'sin-asignar' }),
        bloque({ id: 't1', tipo: 'tarea', texto: 'Abrir la tapa' }),
        bloque({ id: 't2', tipo: 'tarea', texto: 'Cerrar la tapa' }),
      ],
    })
    const recorrido = tareasParaFoco(heredado, 'Paso')
    expect(avisosDeTareaFoco(heredado, recorrido, 0).alertas.map((a) => a.id)).toEqual(['a-viejo'])
    expect(avisosDeTareaFoco(heredado, recorrido, 1).alertas).toEqual([])
  })

  it('con la guia del paso delante, los avisos del paso van con ella', () => {
    const conGuia = paso({
      subArticuloId: 'art-gestor',
      subArticuloTitulo: 'Acceder al gestor',
      bloques: [aviso('a-paso', 'Hazlo con la caja cerrada', { alcance: 'paso' }), bloque({ id: 't1', tipo: 'tarea', texto: 'Crear la ficha' })],
    })
    const recorrido = tareasParaFoco(conGuia, 'Entrar')
    expect(recorrido[0].clase).toBe('guia-del-paso')
    expect(avisosDeTareaFoco(conGuia, recorrido, 0).alertas.map((a) => a.id)).toEqual(['a-paso'])
    expect(avisosDeTareaFoco(conGuia, recorrido, 1).alertas).toEqual([])
  })

  it('un aviso nunca retiene el cierre del paso: solo cuentan las tareas', () => {
    const recorrido = tareasParaFoco(p, 'Cargar el rollo')
    expect(accionFoco(recorrido, new Set())).toBe('marcar')
    expect(accionFoco(recorrido, new Set(['t1', 't2']))).toBe('completar')
    // El id de un aviso en el avance no cumple nada.
    expect(tareaFocoHecha(recorrido[0], new Set(['a-paso']), true)).toBe(false)
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
