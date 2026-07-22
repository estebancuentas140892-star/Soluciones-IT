import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { guardarRegistro, nuevoId } from './repositorio'
import { aplicarFilasRemotas, descartarCambioPendiente, esConflicto, intentarDescarga } from './sync'
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

  // Regresion de la tarea 128: una fila descargada mientras la columna
  // todavia no existia en el servidor dejaba la propiedad local en null,
  // y ese null volvia al servidor rompiendo el NOT NULL de la columna.
  it('una columna que el servidor todavía no tiene toma su valor por defecto, no null', () => {
    const fila = filaRemotaDeArticulo(nuevoId(), 'Conectar impresora a computadora')
    expect(fila).not.toHaveProperty('es_ruta_inicio')
    expect(fila).not.toHaveProperty('orden_ruta_inicio')

    const articulo = aEntidadLocal('articulos', fila)
    expect(articulo.esRutaInicio).toBe(false)
    expect(articulo.ordenRutaInicio).toBe(0)
    expect(articulo.estado).toBe('publicado')
    expect(articulo.version).toBe('1.0')
    expect(articulo.relacionados).toEqual([])
    // Las columnas que sí admiten null siguen viajando como null.
    expect(articulo.procedimiento).toBeNull()
  })

  it('al subir rellena los null heredados de las columnas NOT NULL', () => {
    // Payload tal como quedó guardado en la cola por una versión
    // anterior de la app: la eliminación de un artículo con nulls.
    const fila = aFilaRemota('articulos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      titulo: 'Conectar impresora a computadora',
      tipo: 'manual',
      contenido: null,
      etiquetas: null,
      esRutaInicio: null,
      ordenRutaInicio: null,
      eliminadoEn: '2026-07-21T15:00:00Z',
    })

    expect(fila.es_ruta_inicio).toBe(false)
    expect(fila.orden_ruta_inicio).toBe(0)
    expect(fila.contenido).toBe('')
    expect(fila.etiquetas).toEqual([])
    expect(fila.eliminado_en).toBe('2026-07-21T15:00:00Z')
  })

  it('no confunde un valor falso legítimo con un valor ausente', () => {
    const fila = aFilaRemota('articulos', {
      id: nuevoId(),
      esRutaInicio: false,
      ordenRutaInicio: 0,
      contenido: '',
      estado: 'borrador',
    })

    expect(fila.es_ruta_inicio).toBe(false)
    expect(fila.orden_ruta_inicio).toBe(0)
    expect(fila.contenido).toBe('')
    expect(fila.estado).toBe('borrador')
  })

  // Tarea 140 (hallazgo K2). `origen_sugerencia_id` es la primera
  // columna declarada `camposOpcionales`: se agrego cuando la app ya
  // estaba en uso, asi que el push NO debe mandarla mientras no tenga
  // valor. Si viajara como null, PostgREST rechazaria TODA fila de
  // articulos hasta que el usuario aplique el schema.sql, y el cambio
  // se quedaria reintentandose en la cola (el mismo cuadro real que
  // documenta `porDefecto` en tablas.ts).
  it('una columna opcional sin valor no viaja en el payload de subida', () => {
    const fila = aFilaRemota('articulos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      titulo: 'Artículo escrito a mano',
      tipo: 'manual',
      origenSugerenciaId: null,
    })

    expect(fila).not.toHaveProperty('origen_sugerencia_id')
    // El resto de la fila se sigue enviando igual que siempre.
    expect(fila).toHaveProperty('titulo', 'Artículo escrito a mano')
  })

  it('una columna opcional con valor sí viaja', () => {
    const fila = aFilaRemota('articulos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      titulo: 'Redactado desde una sugerencia',
      tipo: 'problema_frecuente',
      origenSugerenciaId: 'ejecucion-1',
    })

    expect(fila.origen_sugerencia_id).toBe('ejecucion-1')
  })

  // Una propiedad ausente del payload (no solo null) tampoco debe
  // inventar la columna: es el caso de todo articulo guardado por una
  // version anterior de la app y encolado antes de este cambio.
  it('una columna opcional ausente del payload tampoco viaja', () => {
    const fila = aFilaRemota('articulos', { id: nuevoId(), titulo: 'Sin la propiedad' })
    expect(fila).not.toHaveProperty('origen_sugerencia_id')
  })

  it('al bajar, una fila sin la columna opcional deja la propiedad en null', () => {
    const fila = filaRemotaDeArticulo(nuevoId(), 'Artículo viejo')
    const articulo = aEntidadLocal('articulos', fila)
    expect(articulo.origenSugerenciaId).toBeNull()
  })

  // Tarea 143: segunda columna opcional, `dispositivos.reemplaza_a`
  // (tarea 134, hallazgo L2/L3), endurecida tras el error real que vio
  // el usuario en produccion antes de aplicar el schema.sql: "Could not
  // find the 'reemplaza_a' column of 'dispositivos' in the schema
  // cache". Con esto un equipo normal (sin reemplazo) se sube igual
  // aunque el esquema remoto no tenga la columna todavia.
  it('reemplazaA sin valor no viaja en el payload de subida de un dispositivo', () => {
    const fila = aFilaRemota('dispositivos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      nombre: 'Impresora Bodega Norte',
      reemplazaA: null,
    })

    expect(fila).not.toHaveProperty('reemplaza_a')
    expect(fila).toHaveProperty('nombre', 'Impresora Bodega Norte')
  })

  it('reemplazaA con valor sí viaja', () => {
    const fila = aFilaRemota('dispositivos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      nombre: 'Impresora Bodega Norte (nueva)',
      reemplazaA: 'dispositivo-viejo',
    })

    expect(fila.reemplaza_a).toBe('dispositivo-viejo')
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
      ordenRutaInicio: 0,
      estado: 'publicado',
      version: '1.0',
      relacionados: [],
      origenSugerenciaId: null,
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

describe('intentarDescarga', () => {
  it('no acumula nada si la tarea no falla', async () => {
    const errores: string[] = []
    await intentarDescarga('categorias', async () => {}, errores)
    expect(errores).toEqual([])
  })

  it('acumula el error con su etiqueta y sigue si no es un error de red', async () => {
    const errores: string[] = []
    await intentarDescarga(
      'categorias',
      async () => {
        throw new Error('relation "categorias" does not exist')
      },
      errores,
    )
    expect(errores).toEqual(['categorias: relation "categorias" does not exist'])
  })

  it('relanza el error sin acumularlo cuando es un error de red', async () => {
    const errores: string[] = []
    await expect(
      intentarDescarga(
        'categorias',
        async () => {
          throw new Error('TypeError: Failed to fetch')
        },
        errores,
      ),
    ).rejects.toThrow('Failed to fetch')
    expect(errores).toEqual([])
  })

  it('no confunde el nombre de una tabla (por ejemplo "conexiones") con un error de red', async () => {
    // Encontrado verificando en navegador contra el proyecto real de
    // Supabase: esErrorDeRed busca la subcadena "conexi" (de "sin
    // conexión"), que "conexiones" tambien contiene. Clasificar sobre
    // el mensaje YA prefijado con el nombre de la tabla hacia que esta
    // tabla en particular se tratara como error de red y abortara el
    // lote entero en vez de aislarse como las demas.
    const errores: string[] = []
    await intentarDescarga(
      'conexiones',
      async () => {
        throw new Error('No suitable key or wrong key type')
      },
      errores,
    )
    expect(errores).toEqual(['conexiones: No suitable key or wrong key type'])
  })
})

describe('esConflicto', () => {
  it('detecta que el servidor tiene una version mas nueva que la base', () => {
    expect(esConflicto('2026-07-18T10:00:00Z', '2026-07-18T11:00:00Z')).toBe(true)
  })

  it('no marca conflicto si el servidor sigue en la misma version base', () => {
    expect(esConflicto('2026-07-18T10:00:00Z', '2026-07-18T10:00:00Z')).toBe(false)
  })

  it('no marca conflicto si no se pudo leer la version remota', () => {
    expect(esConflicto('2026-07-18T10:00:00Z', null)).toBe(false)
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
      ordenRutaInicio: 0,
      estado: 'publicado',
      version: '1.0',
      relacionados: [],
      origenSugerenciaId: null,
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
