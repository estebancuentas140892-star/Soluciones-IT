import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo } from '../../lib/db'
import {
  borradorDifiere,
  borradorTieneContenido,
  borrarBorrador,
  datosDesdeArticulo,
  datosVacios,
  guardarBorrador,
  leerBorrador,
  limpiarBorradoresViejos,
  normalizarDatosBorrador,
} from './borradorArticulo'

function articuloDePrueba(parcial: Partial<Articulo> = {}): Articulo {
  return {
    id: 'a1',
    categoriaId: 'cat-1',
    titulo: 'Instalar la Zebra ZT411',
    tipo: 'instalacion',
    contenido: '',
    etiquetas: ['zebra'],
    procedimiento: {
      descripcion: 'Usar cuando llega una impresora nueva.',
      portada: null,
      objetivoGeneral: '',
      requisitos: ['Acceso a la red', 'Permisos de administrador'],
      pasos: [],
      verificacionFinal: ['La etiqueta sale centrada'],
      tiempoEstimadoMin: 25,
      dificultad: 'intermedio',
    },
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'publicado',
    version: '1.3',
    relacionados: [],
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  } as Articulo
}

describe('datosDesdeArticulo', () => {
  it('desarma el procedimiento en los campos que tiene el formulario', () => {
    const datos = datosDesdeArticulo(articuloDePrueba())
    expect(datos.titulo).toBe('Instalar la Zebra ZT411')
    // Los arrays vuelven a ser texto de una línea por elemento, que es
    // como los edita el formulario.
    expect(datos.requisitos).toBe('Acceso a la red\nPermisos de administrador')
    expect(datos.verificacionFinal).toBe('La etiqueta sale centrada')
    // El tiempo es texto en el formulario, no número.
    expect(datos.tiempoEstimadoMin).toBe('25')
    expect(datos.dificultad).toBe('intermedio')
  })

  it('un artículo sin procedimiento no rompe: deja los campos vacíos', () => {
    const datos = datosDesdeArticulo(articuloDePrueba({ procedimiento: null }))
    expect(datos.requisitos).toBe('')
    expect(datos.pasos).toEqual([])
    expect(datos.tiempoEstimadoMin).toBe('')
  })

  it('el motivo del cambio NO viaja desde el artículo: es de este guardado', () => {
    expect(datosDesdeArticulo(articuloDePrueba()).motivo).toBe('')
  })
})

describe('borradorDifiere', () => {
  it('un borrador idéntico a lo guardado no difiere (y por tanto no se restaura)', () => {
    const guardado = datosDesdeArticulo(articuloDePrueba())
    expect(borradorDifiere({ ...guardado }, guardado)).toBe(false)
  })

  it('detecta un cambio en cualquier campo, incluido uno anidado', () => {
    const guardado = datosDesdeArticulo(articuloDePrueba())
    expect(borradorDifiere({ ...guardado, titulo: 'Otro título' }, guardado)).toBe(true)
    expect(borradorDifiere({ ...guardado, requisitos: 'Acceso a la red' }, guardado)).toBe(true)
    expect(
      borradorDifiere({ ...guardado, dispositivosAfectados: [{ id: 'd1', nombre: 'Zebra' }] }, guardado),
    ).toBe(true)
  })

  it('detecta hasta un espacio a medio teclear: el borrador restaura lo que se estaba escribiendo', () => {
    const guardado = datosDesdeArticulo(articuloDePrueba())
    expect(borradorDifiere({ ...guardado, descripcion: `${guardado.descripcion} ` }, guardado)).toBe(true)
  })
})

describe('borradorTieneContenido', () => {
  it('un formulario intacto no tiene nada que recuperar', () => {
    expect(borradorTieneContenido(datosVacios())).toBe(false)
  })

  it('un título a medias ya vale la pena', () => {
    expect(borradorTieneContenido({ ...datosVacios(), titulo: 'Insta' })).toBe(true)
  })
})

describe('normalizarDatosBorrador', () => {
  it('rellena los huecos de una fila guardada por una versión anterior', () => {
    const datos = normalizarDatosBorrador({ titulo: 'Solo el título' })
    expect(datos.titulo).toBe('Solo el título')
    expect(datos.pasos).toEqual([])
    expect(datos.etiquetas).toEqual([])
    expect(datos.estado).toBe('borrador')
  })

  it('tolera basura sin romper la apertura del editor', () => {
    expect(normalizarDatosBorrador(null).titulo).toBe('')
    expect(normalizarDatosBorrador('lo que sea').titulo).toBe('')
    expect(normalizarDatosBorrador([1, 2, 3]).titulo).toBe('')
    // Un campo con el tipo equivocado cae en su valor por defecto en vez
    // de llegar al formulario y reventarlo al pintarlo.
    expect(normalizarDatosBorrador({ titulo: 42, etiquetas: 'no es lista' }).titulo).toBe('')
    expect(normalizarDatosBorrador({ etiquetas: 'no es lista' }).etiquetas).toEqual([])
  })
})

describe('la tabla de borradores', () => {
  beforeEach(async () => {
    await db.borradoresArticulo.clear()
  })

  it('guarda, lee y borra el borrador de un artículo', async () => {
    expect(await leerBorrador('a1')).toBeNull()
    await guardarBorrador('a1', 'cat-1', { ...datosVacios(), titulo: 'A medio escribir' })
    expect((await leerBorrador('a1'))?.titulo).toBe('A medio escribir')
    await borrarBorrador('a1')
    expect(await leerBorrador('a1')).toBeNull()
  })

  it('guardar dos veces deja una sola fila, la última', async () => {
    await guardarBorrador('a1', 'cat-1', { ...datosVacios(), titulo: 'Primera' })
    await guardarBorrador('a1', 'cat-1', { ...datosVacios(), titulo: 'Segunda' })
    expect(await db.borradoresArticulo.count()).toBe(1)
    expect((await leerBorrador('a1'))?.titulo).toBe('Segunda')
  })

  it('lee un borrador incompleto sin romper (pasa por normalizarDatosBorrador)', async () => {
    await db.borradoresArticulo.put({
      articuloId: 'a2',
      categoriaId: 'cat-1',
      actualizadoEn: new Date().toISOString(),
      datos: { titulo: 'Viejo' } as never,
    })
    const datos = await leerBorrador('a2')
    expect(datos?.titulo).toBe('Viejo')
    expect(datos?.pasos).toEqual([])
  })

  it('el barrido se lleva los abandonados y respeta los recientes', async () => {
    const hace40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    await db.borradoresArticulo.put({
      articuloId: 'viejo',
      categoriaId: 'cat-1',
      actualizadoEn: hace40Dias,
      datos: datosVacios(),
    })
    await guardarBorrador('reciente', 'cat-1', datosVacios())

    expect(await limpiarBorradoresViejos()).toBe(1)
    expect(await db.borradoresArticulo.get('viejo')).toBeUndefined()
    expect(await db.borradoresArticulo.get('reciente')).toBeDefined()
  })
})
