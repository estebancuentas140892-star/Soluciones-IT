import { beforeEach, describe, expect, it } from 'vitest'
import { resumenProcedimiento } from '../features/historial/resumenProcedimiento'
import { cambiarTipoTarea } from '../features/soluciones/bloquesEditor'
import { tareasParaFoco } from '../features/soluciones/tareasFoco'
import { referenciasParaOffline } from './adjuntosOffline'
import { db, type Articulo, type BloquePaso, type PasoProcedimiento, type Procedimiento, type ResultadoVisual } from './db'
import {
  CAMPOS_BLOQUE_VACIOS,
  crearPaso,
  duplicarProcedimiento,
  normalizarProcedimiento,
  prepararProcedimientoParaGuardar,
} from './procedimiento'
import { admiteResultadoVisual, normalizarResultadoVisual, resultadoVisualDe } from './resultadoVisual'

// "DEBES VER" COMO IMAGEN DEL RESULTADO (tarea 307): el modelo. Una imagen
// por acción o comprobación, explícita, tolerada al leer, conservada al
// guardar y al duplicar, en la copia sin conexión y en el historial. Las
// pantallas se prueban en `ejecucionMinima.test.tsx`. Todo es inventado.

const IMAGEN: ResultadoVisual = {
  adjunto: { referencia: 'articulos/a1/pasos/1700000009-ventana.png', nombre: 'ventana.png', tipo: 'image/png' },
  descripcion: 'La ventana de prueba abierta',
}

function tarea(id: string, tipoTarea: BloquePaso['tipoTarea'] = 'accion', extra: Partial<BloquePaso> = {}): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto: `Tarea ${id}`, tipoTarea, ...extra }
}

function paso(bloques: BloquePaso[]): PasoProcedimiento {
  return { ...crearPaso(), id: 'p1', titulo: 'Paso de prueba', bloques }
}

function procedimiento(pasos: PasoProcedimiento[]): Procedimiento {
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    pasos,
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
  }
}

function guardar(pasos: PasoProcedimiento[]): Procedimiento | null {
  return prepararProcedimientoParaGuardar({
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitosTexto: '',
    pasos,
    verificacionFinalTexto: '',
    tiempoEstimadoMin: null,
    dificultad: null,
  })
}

describe('dónde vive la imagen de "Debes ver"', () => {
  it('en una acción o una comprobación; nunca en una decisión ni en un aviso', () => {
    expect(admiteResultadoVisual(tarea('a'))).toBe(true)
    expect(admiteResultadoVisual(tarea('v', 'verificacion'))).toBe(true)
    // Una tarea de antes de la clasificación es una acción.
    expect(admiteResultadoVisual(tarea('s', null))).toBe(true)
    expect(admiteResultadoVisual(tarea('d', 'decision'))).toBe(false)
    expect(admiteResultadoVisual({ tipo: 'aviso', tipoTarea: null })).toBe(false)
  })

  it('un paso nuevo no trae los textos heredados (objetivo, lugar ni resultado)', () => {
    const nuevo = crearPaso()
    expect(nuevo).not.toHaveProperty('objetivo')
    expect(nuevo).not.toHaveProperty('lugar')
    expect(nuevo).not.toHaveProperty('resultado')
  })
})

describe('leerla tolerando lo que llegue', () => {
  it('una imagen válida se lee entera, y la descripción vacía no se conserva', () => {
    expect(normalizarResultadoVisual(IMAGEN)).toEqual(IMAGEN)
    expect(normalizarResultadoVisual({ ...IMAGEN, descripcion: '   ' })).toEqual({ adjunto: IMAGEN.adjunto })
  })

  it('lo que no es una imagen con referencia se descarta, sin romper la guía', () => {
    expect(normalizarResultadoVisual(null)).toBeNull()
    expect(normalizarResultadoVisual('captura.png')).toBeNull()
    expect(normalizarResultadoVisual({ adjunto: { referencia: '', nombre: 'x.png', tipo: 'image/png' } })).toBeNull()
    expect(normalizarResultadoVisual({ adjunto: { referencia: 'a/manual.pdf', nombre: 'manual.pdf', tipo: 'application/pdf' } })).toBeNull()
    expect(normalizarResultadoVisual({ descripcion: 'Sin adjunto' })).toBeNull()
  })

  it('la guía la lee en la acción, la suelta en una decisión y no la deduce de una imagen intercalada', () => {
    const intercalada: BloquePaso = {
      ...CAMPOS_BLOQUE_VACIOS,
      id: 'img',
      tipo: 'imagen',
      adjunto: IMAGEN.adjunto,
      alcance: 'tarea',
      tareaId: 't2',
    }
    const leido = normalizarProcedimiento(
      procedimiento([
        paso([
          tarea('t1', 'accion', { resultadoVisual: IMAGEN }),
          tarea('t2', 'accion'),
          intercalada,
          tarea('t3', 'decision', { resultadoVisual: IMAGEN }),
        ]),
      ]),
    )
    const [t1, t2, , t3] = leido?.pasos[0].bloques ?? []
    expect(t1.resultadoVisual).toEqual(IMAGEN)
    // La imagen intercalada sigue siendo una imagen intercalada: no pasa a ser el resultado.
    expect(t2).not.toHaveProperty('resultadoVisual')
    expect(t3).not.toHaveProperty('resultadoVisual')
  })

  it('la ejecución la recibe por acción, y las entradas sin imagen no la tienen', () => {
    const p = paso([tarea('t1', 'accion', { resultadoVisual: IMAGEN }), tarea('t2', 'verificacion')])
    const recorrido = tareasParaFoco(p, 'Paso de prueba')
    expect(recorrido.map((t) => t.resultadoVisual)).toEqual([IMAGEN, null])
    expect(resultadoVisualDe(tarea('t3', 'decision', { resultadoVisual: IMAGEN }))).toBeNull()
  })
})

describe('guardarla y reabrirla', () => {
  it('se guarda con la descripción recortada y se vuelve a leer igual', () => {
    const guardado = guardar([paso([tarea('t1', 'accion', { resultadoVisual: { ...IMAGEN, descripcion: '  La ventana de prueba abierta ' } })])])
    expect(guardado?.pasos[0].bloques[0].resultadoVisual).toEqual(IMAGEN)
    const reabierto = normalizarProcedimiento(JSON.parse(JSON.stringify(guardado)))
    expect(reabierto?.pasos[0].bloques[0].resultadoVisual).toEqual(IMAGEN)
  })

  it('quitarla quita la clave, y una tarea que nunca la tuvo no la escribe', () => {
    const guardado = guardar([paso([tarea('t1', 'accion', { resultadoVisual: undefined }), tarea('t2')])])
    expect(guardado?.pasos[0].bloques[0]).not.toHaveProperty('resultadoVisual')
    expect(guardado?.pasos[0].bloques[1]).not.toHaveProperty('resultadoVisual')
  })

  it('los textos heredados del paso se conservan al guardar si dicen algo, y no se escriben si no', () => {
    const conHeredados = { ...paso([tarea('t1')]), lugar: '  Panel de prueba ', objetivo: '', resultado: 'Ventana de prueba' }
    const guardado = guardar([conHeredados])
    expect(guardado?.pasos[0]).toMatchObject({ lugar: 'Panel de prueba', resultado: 'Ventana de prueba' })
    expect(guardado?.pasos[0]).not.toHaveProperty('objetivo')
  })

  it('duplicar la guía copia la imagen con su misma referencia, sin compartir el objeto', () => {
    const original = procedimiento([paso([tarea('t1', 'accion', { resultadoVisual: IMAGEN })])])
    const copia = duplicarProcedimiento(original)
    const copiada = copia.pasos[0].bloques[0].resultadoVisual
    expect(copiada).toEqual(IMAGEN)
    expect(copiada).not.toBe(original.pasos[0].bloques[0].resultadoVisual)
  })

  it('pasar la acción a decisión suelta la imagen y lo dice; a comprobación, la conserva', () => {
    const conImagen = tarea('t1', 'accion', { resultadoVisual: IMAGEN })
    const aDecision = cambiarTipoTarea(conImagen, 'decision')
    expect(aDecision.bloque.resultadoVisual).toBeUndefined()
    expect(aDecision.perdido).toContain('la imagen de «Debes ver»')
    const aComprobacion = cambiarTipoTarea(conImagen, 'verificacion')
    expect(aComprobacion.bloque.resultadoVisual).toEqual(IMAGEN)
    expect(aComprobacion.perdido).toEqual([])
  })
})

describe('el historial la nombra', () => {
  it('añadir, cambiar y quitar la imagen de una instrucción', () => {
    const sin = JSON.stringify(procedimiento([paso([tarea('t1')])]))
    const con = JSON.stringify(procedimiento([paso([tarea('t1', 'accion', { resultadoVisual: IMAGEN })])]))
    const otra = JSON.stringify(
      procedimiento([paso([tarea('t1', 'accion', { resultadoVisual: { ...IMAGEN, descripcion: 'Otra descripción de prueba' } })])]),
    )
    expect(resumenProcedimiento(sin, con).cambios.join(' ')).toContain('Se añadió la imagen de «Debes ver» en una instrucción')
    expect(resumenProcedimiento(con, otra).cambios.join(' ')).toContain('Se cambió la imagen de «Debes ver» en una instrucción')
    expect(resumenProcedimiento(con, sin).cambios.join(' ')).toContain('Se quitó la imagen de «Debes ver» de una instrucción')
  })
})

describe('sin conexión', () => {
  beforeEach(async () => {
    await db.adjuntos.clear()
    await db.articulos.clear()
    await db.dispositivos.clear()
  })

  it('su archivo entra en "Descargar todo para offline", como cualquier imagen del paso', async () => {
    const articulo = {
      id: 'a1',
      categoriaId: 'cat-1',
      titulo: 'Guía de prueba',
      tipo: 'configuracion',
      contenido: '',
      etiquetas: [],
      procedimiento: procedimiento([paso([tarea('t1', 'accion', { resultadoVisual: IMAGEN })])]),
      sintomas: [],
      causas: [],
      dispositivosAfectados: [],
      esRutaInicio: false,
      ordenRutaInicio: 0,
      estado: 'publicado',
      version: '1.0',
      relacionados: [],
      origenSugerenciaId: null,
      aplicaA: null,
      updatedAt: '2026-10-07T12:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    } satisfies Articulo
    await db.articulos.put(articulo)
    expect(await referenciasParaOffline()).toContain(IMAGEN.adjunto.referencia)
  })
})
