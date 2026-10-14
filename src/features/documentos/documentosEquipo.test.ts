import { beforeEach, describe, expect, it, vi } from 'vitest'

// El bucket se simula: quitar el último vínculo de un documento lo borra
// de Storage, y la prueba comprueba que solo pasa entonces.
const { remove } = vi.hoisted(() => ({ remove: vi.fn(async () => ({ data: [], error: null })) }))
vi.mock('../../lib/supabase', async (original) => ({
  ...(await original<typeof import('../../lib/supabase')>()),
  supabase: { storage: { from: () => ({ remove }) }, auth: { getSession: async () => ({ data: { session: null } }) } },
  supabaseConfigured: true,
}))

import { db, type Adjunto } from '../../lib/db'
import { cambioEsperaSuArchivo } from '../../lib/sync'
import { descripcionEntrada } from '../historial/textoHistorial'
import {
  adjuntoNuevo,
  editarDocumento,
  errorDeDocumento,
  quitarAdjunto,
  textoOtrosEquipos,
  vincularDocumento,
  vinculosDelDocumento,
} from './documentosEquipo'

// UN DOCUMENTO, VARIOS EQUIPOS (tarea 322). El documento es su referencia
// en Storage; cada fila de un equipo es un vínculo con su propia nota.

const REFERENCIA = 'compartidos/hash-acta-prueba'

function acta(id: string, entidadId: string, extra: Partial<Adjunto> = {}): Adjunto {
  return {
    id,
    entidadTipo: 'dispositivo',
    entidadId,
    nombre: 'acta-prueba.pdf',
    tipo: 'application/pdf',
    referencia: REFERENCIA,
    nota: '',
    origen: '',
    fechaDocumento: null,
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
  remove.mockClear()
})

describe('vincularDocumento', () => {
  it('crea un vínculo por equipo con la misma referencia y su propia nota, sin copiar el archivo', async () => {
    const original = acta('a1', 'equipo-a', { origen: 'Acta de entrega de prueba', fechaDocumento: '2025-03-12' })
    await db.adjuntos.put(original)

    const creados = await vincularDocumento(original, [
      { dispositivoId: 'equipo-b', nota: '  Página 2 ' },
      { dispositivoId: 'equipo-c', nota: '' },
    ])

    expect(creados).toBe(2)
    const vinculos = await vinculosDelDocumento(REFERENCIA)
    expect(vinculos.map((v) => v.entidadId).sort()).toEqual(['equipo-a', 'equipo-b', 'equipo-c'])
    const b = vinculos.find((v) => v.entidadId === 'equipo-b')
    expect(b).toMatchObject({
      referencia: REFERENCIA,
      nombre: 'acta-prueba.pdf',
      tipo: 'application/pdf',
      nota: 'Página 2',
      origen: 'Acta de entrega de prueba',
      fechaDocumento: '2025-03-12',
    })
    expect(await db.archivosPendientes.count()).toBe(0)
  })

  it('un equipo que ya lo tiene no recibe un segundo vínculo, ni dos veces en la misma lista', async () => {
    const original = acta('a1', 'equipo-a')
    await db.adjuntos.put(original)
    await db.adjuntos.put(acta('a2', 'equipo-b'))

    const creados = await vincularDocumento(original, [
      { dispositivoId: 'equipo-a', nota: '' },
      { dispositivoId: 'equipo-b', nota: '' },
      { dispositivoId: 'equipo-c', nota: '' },
      { dispositivoId: 'equipo-c', nota: 'otra vez' },
    ])

    expect(creados).toBe(1)
    expect(await db.adjuntos.where('referencia').equals(REFERENCIA).count()).toBe(3)
  })

  it('deja la entrada "Se agregó el adjunto" en el historial del equipo que lo recibe', async () => {
    const original = acta('a1', 'equipo-a')
    await db.adjuntos.put(original)

    await vincularDocumento(original, [{ dispositivoId: 'equipo-b', nota: '' }])

    const entradas = await db.historial.where('[entidadTipo+entidadId]').equals(['dispositivo', 'equipo-b']).toArray()
    expect(entradas).toHaveLength(1)
    expect(descripcionEntrada(entradas[0])).toBe('Se agregó el adjunto: acta-prueba.pdf')
  })
})

describe('editarDocumento', () => {
  it('los datos del documento se guardan en todos sus vínculos; la nota, solo en este', async () => {
    await db.adjuntos.bulkPut([acta('a1', 'equipo-a', { nota: 'Página 1' }), acta('a2', 'equipo-b', { nota: 'Página 2' })])
    const a1 = (await db.adjuntos.get('a1')) as Adjunto

    await editarDocumento(a1, { nombre: ' Acta de entrega ', origen: 'Almacén', fechaDocumento: '2025-03-12' }, 'Página 1 y 4')

    expect(await db.adjuntos.get('a1')).toMatchObject({
      nombre: 'Acta de entrega',
      origen: 'Almacén',
      fechaDocumento: '2025-03-12',
      nota: 'Página 1 y 4',
    })
    expect(await db.adjuntos.get('a2')).toMatchObject({
      nombre: 'Acta de entrega',
      origen: 'Almacén',
      fechaDocumento: '2025-03-12',
      nota: 'Página 2',
    })
  })

  it('no toca un adjunto de un artículo que comparte el archivo, ni uno ya quitado', async () => {
    await db.adjuntos.bulkPut([
      acta('a1', 'equipo-a'),
      acta('art', 'articulo-1', { entidadTipo: 'articulo' }),
      acta('viejo', 'equipo-z', { eliminadoEn: '2026-10-02T00:00:00.000Z' }),
    ])
    const a1 = (await db.adjuntos.get('a1')) as Adjunto

    await editarDocumento(a1, { nombre: 'Acta de entrega', origen: '', fechaDocumento: null }, '')

    expect((await db.adjuntos.get('art'))?.nombre).toBe('acta-prueba.pdf')
    expect((await db.adjuntos.get('viejo'))?.nombre).toBe('acta-prueba.pdf')
  })

  it('sin cambios en los demás vínculos, no los reescribe ni encola nada por ellos', async () => {
    await db.adjuntos.bulkPut([acta('a1', 'equipo-a'), acta('a2', 'equipo-b')])
    const a1 = (await db.adjuntos.get('a1')) as Adjunto

    await editarDocumento(a1, { nombre: a1.nombre, origen: '', fechaDocumento: null }, 'Página 1')

    expect((await db.adjuntos.get('a2'))?.updatedAt).toBe('2026-10-01T00:00:00.000Z')
    const encolados = await db.cambiosPendientes.where('tabla').equals('adjuntos').toArray()
    expect(encolados.map((c) => c.entidadId)).toEqual(['a1'])
  })

  it('rechaza un nombre vacío o una fecha imposible sin guardar nada', async () => {
    await db.adjuntos.put(acta('a1', 'equipo-a'))
    const a1 = (await db.adjuntos.get('a1')) as Adjunto

    await expect(editarDocumento(a1, { nombre: '  ', origen: '', fechaDocumento: null }, '')).rejects.toThrow('nombre')
    await expect(editarDocumento(a1, { nombre: 'Acta', origen: '', fechaDocumento: '2025-02-30' }, '')).rejects.toThrow('fecha')
    expect(await db.cambiosPendientes.count()).toBe(0)
  })
})

describe('errorDeDocumento', () => {
  const hoy = '2026-10-13'

  it('acepta un documento sin origen ni fecha: no se inventan', () => {
    expect(errorDeDocumento({ nombre: 'Acta', origen: '', fechaDocumento: null }, hoy)).toBeNull()
  })

  it('acepta una fecha confirmada de hoy o anterior', () => {
    expect(errorDeDocumento({ nombre: 'Acta', origen: '', fechaDocumento: '2026-10-13' }, hoy)).toBeNull()
    expect(errorDeDocumento({ nombre: 'Acta', origen: '', fechaDocumento: '2019-01-31' }, hoy)).toBeNull()
  })

  it('rechaza una fecha del futuro: un acta sin firmar no tiene fecha confirmada', () => {
    expect(errorDeDocumento({ nombre: 'Acta', origen: '', fechaDocumento: '2026-10-14' }, hoy)).toMatch(/posterior a hoy/)
  })
})

describe('quitarAdjunto', () => {
  it('quitar un vínculo deja el archivo mientras otro equipo lo tenga', async () => {
    await db.adjuntos.bulkPut([acta('a1', 'equipo-a'), acta('a2', 'equipo-b')])
    await db.archivosPendientes.put({
      referencia: REFERENCIA,
      contenido: new Blob(['%PDF']),
      tipo: 'application/pdf',
      nombre: 'acta-prueba.pdf',
      bucket: 'adjuntos',
      creadoEn: '2026-10-01T00:00:00.000Z',
      error: null,
      intentos: 0,
    })

    await quitarAdjunto((await db.adjuntos.get('a1')) as Adjunto)

    expect((await db.adjuntos.get('a1'))?.eliminadoEn).not.toBeNull()
    expect(await db.archivosPendientes.get(REFERENCIA)).toBeDefined()
    expect(remove).not.toHaveBeenCalled()
  })

  it('quitar el último vínculo saca el archivo de la cola y del bucket', async () => {
    // En Node `navigator.onLine` no existe: aquí el teléfono tiene red.
    vi.stubGlobal('navigator', { onLine: true })
    try {
      await db.adjuntos.put(acta('a1', 'equipo-a'))

      await quitarAdjunto((await db.adjuntos.get('a1')) as Adjunto)

      expect(remove).toHaveBeenCalledWith([REFERENCIA])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('el historial dice que se quitó, con su nombre', async () => {
    await db.adjuntos.put(acta('a1', 'equipo-a'))

    await quitarAdjunto((await db.adjuntos.get('a1')) as Adjunto)

    const [entrada] = await db.historial.where('[entidadTipo+entidadId]').equals(['dispositivo', 'equipo-a']).toArray()
    expect(descripcionEntrada(entrada)).toBe('Se quitó el adjunto: acta-prueba.pdf')
  })
})

describe('cambioEsperaSuArchivo', () => {
  const enCola = new Set([REFERENCIA])

  it('la fila de un adjunto espera mientras su archivo siga en la cola de subida', () => {
    expect(cambioEsperaSuArchivo({ tabla: 'adjuntos', payload: acta('a1', 'equipo-a') }, enCola)).toBe(true)
  })

  it('sube cuando el archivo ya no está en la cola', () => {
    expect(cambioEsperaSuArchivo({ tabla: 'adjuntos', payload: acta('a1', 'equipo-a') }, new Set())).toBe(false)
  })

  it('un adjunto quitado viaja igual: es un borrado suave que nadie ve', () => {
    const quitado = acta('a1', 'equipo-a', { eliminadoEn: '2026-10-02T00:00:00.000Z' })
    expect(cambioEsperaSuArchivo({ tabla: 'adjuntos', payload: quitado }, enCola)).toBe(false)
  })

  it('no detiene ninguna otra tabla', () => {
    expect(cambioEsperaSuArchivo({ tabla: 'dispositivos', payload: { referencia: REFERENCIA } }, enCola)).toBe(false)
  })
})

describe('adjuntoNuevo', () => {
  it('subir a un equipo un documento que ya está en otro toma su nombre, origen y fecha', async () => {
    await db.adjuntos.put(acta('a1', 'equipo-a', { nombre: 'Acta de entrega', origen: 'Almacén', fechaDocumento: '2025-03-12' }))

    expect(await adjuntoNuevo('dispositivo', 'equipo-b', REFERENCIA, 'escaneo-001.pdf')).toEqual({
      yaEsta: false,
      nombre: 'Acta de entrega',
      origen: 'Almacén',
      fechaDocumento: '2025-03-12',
    })
  })

  it('el mismo archivo no se repite en la misma ficha', async () => {
    await db.adjuntos.put(acta('a1', 'equipo-a'))
    expect((await adjuntoNuevo('dispositivo', 'equipo-a', REFERENCIA, 'acta-prueba.pdf')).yaEsta).toBe(true)
  })

  it('un archivo nuevo, o en un artículo, lleva el nombre del archivo y nada confirmado', async () => {
    await db.adjuntos.put(acta('a1', 'equipo-a', { origen: 'Almacén' }))
    expect(await adjuntoNuevo('dispositivo', 'equipo-b', 'compartidos/otro', 'nuevo.pdf')).toEqual({
      yaEsta: false,
      nombre: 'nuevo.pdf',
      origen: '',
      fechaDocumento: null,
    })
    expect((await adjuntoNuevo('articulo', 'articulo-1', REFERENCIA, 'manual.pdf')).nombre).toBe('manual.pdf')
  })

  it('un vínculo quitado no cuenta', async () => {
    await db.adjuntos.put(acta('a1', 'equipo-a', { eliminadoEn: '2026-10-02T00:00:00.000Z' }))
    expect((await adjuntoNuevo('dispositivo', 'equipo-a', REFERENCIA, 'acta-prueba.pdf')).yaEsta).toBe(false)
  })
})

describe('textoOtrosEquipos', () => {
  it('dice en cuántos equipos más está', () => {
    expect(textoOtrosEquipos(1)).toBe('En 1 equipo más')
    expect(textoOtrosEquipos(3)).toBe('En 3 equipos más')
  })
})
