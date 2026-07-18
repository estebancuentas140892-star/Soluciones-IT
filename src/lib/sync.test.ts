import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { guardarRegistro, nuevoId } from './repositorio'
import { aplicarFilasRemotas, descartarCambioPendiente } from './sync'
import { aEntidadLocal, aFilaRemota } from './tablas'

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

function filaRemotaDeArticulo(id: string, titulo: string): Record<string, unknown> {
  return {
    id,
    categoria_id: nuevoId(),
    titulo,
    tipo: 'problema_frecuente',
    contenido: 'Pasos para resolverlo',
    etiquetas: ['zebra', 'impresora'],
    procedimiento: null,
    updated_at: '2026-07-02T15:00:00+00:00',
    updated_by: null,
    eliminado_en: null,
  }
}

describe('mapeo entre columnas locales y remotas', () => {
  it('convierte filas del servidor a entidades locales', () => {
    const fila = filaRemotaDeArticulo(nuevoId(), 'Impresora Zebra no imprime')
    const articulo = aEntidadLocal('articulos', fila)

    expect(articulo.categoriaId).toBe(fila.categoria_id)
    expect(articulo.titulo).toBe('Impresora Zebra no imprime')
    expect(articulo.etiquetas).toEqual(['zebra', 'impresora'])
    expect(articulo.updatedAt).toBe('2026-07-02T15:00:00+00:00')
  })

  it('al subir no envía updated_at ni updated_by porque los pone el servidor', () => {
    const fila = aFilaRemota('articulos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      titulo: 'Título',
      tipo: 'manual',
      contenido: '',
      etiquetas: [],
      procedimiento: null,
      updatedAt: '2026-07-02T15:00:00Z',
      updatedBy: 'alguien',
      eliminadoEn: null,
    })

    expect(fila).not.toHaveProperty('updated_at')
    expect(fila).not.toHaveProperty('updated_by')
    expect(fila).toHaveProperty('eliminado_en', null)
    expect(fila).toHaveProperty('categoria_id')
  })

  it('el procedimiento viaja completo en ambas direcciones', () => {
    const procedimiento = {
      requisitos: ['Credenciales del SQL Server'],
      pasos: [
        {
          id: 'paso-1',
          titulo: 'Abrir SQL Server Management Studio',
          detalle: '',
          imagen: null,
          nota: '',
          advertencia: 'Verificar el espacio en disco',
          consejo: '',
          decision: { pregunta: '¿La base está en línea?', pasoSi: null, pasoNo: 2 },
        },
      ],
    }

    const fila = filaRemotaDeArticulo(nuevoId(), 'Copia de seguridad')
    fila.procedimiento = procedimiento
    expect(aEntidadLocal('articulos', fila).procedimiento).toEqual(procedimiento)

    const subida = aFilaRemota('articulos', { ...aEntidadLocal('articulos', fila) })
    expect(subida.procedimiento).toEqual(procedimiento)
  })

  it('mapea los diagnósticos con sus nodos en ambas direcciones', () => {
    const nodos = [
      {
        id: 'n1',
        pregunta: '¿Está encendida?',
        descripcion: '',
        opciones: [{ id: 'o1', etiqueta: 'Sí', siguienteNodoId: null, articuloId: null, articuloTitulo: '', mensajeFinal: 'Listo' }],
      },
    ]
    const fila = {
      id: nuevoId(),
      categoria_id: nuevoId(),
      titulo: 'La impresora no imprime',
      descripcion: 'Cualquier impresora térmica',
      nodos,
      updated_at: '2026-07-08T15:00:00+00:00',
      updated_by: null,
      eliminado_en: null,
    }
    const diagnostico = aEntidadLocal('diagnosticos', fila)
    expect(diagnostico.categoriaId).toBe(fila.categoria_id)
    expect(diagnostico.nodos).toEqual(nodos)

    const subida = aFilaRemota('diagnosticos', diagnostico)
    expect(subida.nodos).toEqual(nodos)
    expect(subida).not.toHaveProperty('updated_at')
  })

  it('mapea las ejecuciones de diagnóstico (registro inmutable)', () => {
    const fila = aFilaRemota('ejecuciones_diagnostico', {
      id: nuevoId(),
      diagnosticoId: 'diag-1',
      diagnosticoTitulo: 'La impresora no imprime',
      usuario: null,
      usuarioNombre: 'Técnico',
      camino: [{ nodoId: 'n1', pregunta: '¿Encendida?', opcionId: 'o1', etiqueta: 'No' }],
      articulosEjecutados: [{ id: 'art-1', titulo: 'Conectar impresora' }],
      resuelto: 'si',
      duracionSegundos: 120,
      fechaHora: '2026-07-08T15:00:00+00:00',
    })
    expect(fila.diagnostico_id).toBe('diag-1')
    expect(fila.resuelto).toBe('si')
    expect(fila.duracion_segundos).toBe(120)
    expect(fila.fecha_hora).toBe('2026-07-08T15:00:00+00:00')
    expect(fila.articulos_ejecutados).toEqual([{ id: 'art-1', titulo: 'Conectar impresora' }])
  })
})

describe('aplicarFilasRemotas', () => {
  it('guarda las filas recibidas en la base local', async () => {
    const id = nuevoId()
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Configurar POS')])

    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Configurar POS')
  })

  it('no pisa una ficha con cambios locales pendientes de subir', async () => {
    const id = nuevoId()
    const categoriaId = nuevoId()
    await guardarRegistro('articulos', {
      id,
      categoriaId,
      titulo: 'Versión editada en este teléfono',
      tipo: 'manual',
      contenido: '',
      etiquetas: [],
      procedimiento: null,
      sintomas: [],
      causas: [],
      dispositivosAfectados: [],
      esRutaInicio: false,
      estado: 'publicado',
      version: '1.0',
      relacionados: [],
    })

    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Versión vieja del servidor')])

    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Versión editada en este teléfono')
  })

  it('sí actualiza una ficha sin cambios pendientes', async () => {
    const id = nuevoId()
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Título original')])
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Título actualizado por un compañero')])

    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Título actualizado por un compañero')
  })

  it('las eliminaciones de otros técnicos llegan como borrado suave', async () => {
    const id = nuevoId()
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Artículo a eliminar')])

    const fila = filaRemotaDeArticulo(id, 'Artículo a eliminar')
    fila.eliminado_en = '2026-07-02T16:00:00+00:00'
    await aplicarFilasRemotas('articulos', [fila])

    const articulo = await db.articulos.get(id)
    expect(articulo?.eliminadoEn).toBe('2026-07-02T16:00:00+00:00')
  })
})

describe('descartarCambioPendiente', () => {
  it('quita el cambio de la cola y desbloquea la ficha para recibir novedades', async () => {
    const id = nuevoId()
    const categoriaId = nuevoId()
    // Un guardado local encola el cambio (y bloquea la descarga de esa ficha).
    await guardarRegistro('articulos', {
      id,
      categoriaId,
      titulo: 'Cambio que el servidor rechaza',
      tipo: 'manual',
      contenido: '',
      etiquetas: [],
      procedimiento: null,
      sintomas: [],
      causas: [],
      dispositivosAfectados: [],
      esRutaInicio: false,
      estado: 'publicado',
      version: '1.0',
      relacionados: [],
    })
    const cola = await db.cambiosPendientes.where('[tabla+entidadId]').equals(['articulos', id]).toArray()
    expect(cola.length).toBeGreaterThan(0)

    for (const cambio of cola) {
      await descartarCambioPendiente(cambio.id)
    }

    const colaDespues = await db.cambiosPendientes
      .where('[tabla+entidadId]')
      .equals(['articulos', id])
      .count()
    expect(colaDespues).toBe(0)

    // Sin el cambio pendiente, la version del servidor vuelve a aplicar.
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Versión del servidor')])
    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Versión del servidor')
  })

  it('descartar un id inexistente no hace nada', async () => {
    await expect(descartarCambioPendiente('no-existe')).resolves.toBeUndefined()
  })
})
