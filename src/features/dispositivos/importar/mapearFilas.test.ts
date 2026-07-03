import { describe, expect, it } from 'vitest'
import { parsearCsv } from './parsearCsv'
import {
  generarPlantillaCsv,
  mapearFilas,
  normalizar,
  type OpcionesMapeo,
} from './mapearFilas'

const CATEGORIAS = [
  { id: 'cat-pos', nombre: 'POS' },
  { id: 'cat-imp', nombre: 'Impresoras' },
  { id: 'cat-cam', nombre: 'Cámaras' },
]

function opciones(extra: Partial<OpcionesMapeo> = {}): OpcionesMapeo {
  return { categorias: CATEGORIAS, ...extra }
}

describe('normalizar', () => {
  it('quita acentos, espacios repetidos y mayúsculas', () => {
    expect(normalizar('  Número   de SERIE ')).toBe('numero de serie')
    expect(normalizar('Ubicación')).toBe('ubicacion')
  })
})

describe('mapearFilas: encabezados', () => {
  it('reconoce sinónimos, acentos y mayúsculas en los encabezados', () => {
    const filas = [
      ['EQUIPO', 'Tipo', 'Fabricante', 'Número de serie', 'Sede', 'Dirección IP'],
      ['POS caja 1', 'pos', 'HP', 'SN1', 'Principal', '10.0.0.5'],
    ]
    const resultado = mapearFilas(filas, opciones())
    expect(resultado.errorGeneral).toBeNull()
    expect(resultado.importables).toHaveLength(1)
    expect(resultado.importables[0].datos).toMatchObject({
      nombre: 'POS caja 1',
      categoriaId: 'cat-pos',
      marca: 'HP',
      serial: 'SN1',
      ubicacion: 'Principal',
      ip: '10.0.0.5',
    })
  })

  it('ignora la puntuación de los encabezados: "No. de serie" y "Nº de serie" son Serial', () => {
    const conPunto = mapearFilas(
      [
        ['Nombre', 'Categoría', 'No. de serie'],
        ['POS caja 1', 'POS', 'SN-1'],
      ],
      opciones(),
    )
    expect(conPunto.importables[0].datos.serial).toBe('SN-1')
    expect(conPunto.importables[0].datos.detalles).toEqual({})

    const conSimbolo = mapearFilas(
      [
        ['Nombre', 'Categoría', 'Nº de serie'],
        ['POS caja 1', 'POS', 'SN-2'],
      ],
      opciones(),
    )
    expect(conSimbolo.importables[0].datos.serial).toBe('SN-2')
  })

  it('las columnas desconocidas se conservan como campos adicionales', () => {
    const filas = [
      ['Nombre', 'Categoría', 'Garantía hasta', 'Proveedor'],
      ['Cámara bodega', 'Cámaras', '2027-01-15', 'TecnoSum'],
    ]
    const resultado = mapearFilas(filas, opciones())
    expect(resultado.importables[0].datos.detalles).toEqual({
      'Garantía hasta': '2027-01-15',
      Proveedor: 'TecnoSum',
    })
  })

  it('si el mismo campo aparece dos veces, la segunda columna queda como campo adicional', () => {
    const filas = [
      ['Nombre', 'Categoría', 'Serial', 'No. de serie'],
      ['POS caja 1', 'POS', 'SN1', 'SN-VIEJO'],
    ]
    const resultado = mapearFilas(filas, opciones())
    expect(resultado.importables[0].datos.serial).toBe('SN1')
    expect(resultado.importables[0].datos.detalles).toEqual({ 'No. de serie': 'SN-VIEJO' })
  })

  it('sin columna de nombre no se puede importar nada', () => {
    const resultado = mapearFilas([['Marca', 'Modelo'], ['HP', 'X1']], opciones())
    expect(resultado.errorGeneral).toContain('columna del nombre')
    expect(resultado.importables).toHaveLength(0)
  })

  it('archivo vacío o solo con encabezados', () => {
    expect(mapearFilas([], opciones()).errorGeneral).toContain('vacío')
    expect(mapearFilas([['Nombre']], opciones()).errorGeneral).toContain('sin datos')
  })
})

describe('mapearFilas: filas', () => {
  it('omite filas sin nombre y con categoría desconocida, con su número de fila', () => {
    const filas = [
      ['Nombre', 'Categoría'],
      ['', 'POS'],
      ['Router piso 2', 'Enrutadores'],
      ['POS caja 2', 'POS'],
    ]
    const resultado = mapearFilas(filas, opciones())
    expect(resultado.importables).toHaveLength(1)
    expect(resultado.omitidas).toEqual([
      { numeroFila: 2, motivo: 'No tiene nombre.' },
      { numeroFila: 3, motivo: 'La categoría "Enrutadores" no existe en la app.' },
    ])
  })

  it('las filas sin categoría usan la predeterminada si se indicó, o se omiten', () => {
    const filas = [
      ['Nombre', 'Categoría'],
      ['POS caja 1', ''],
    ]
    const sinPredeterminada = mapearFilas(filas, opciones())
    expect(sinPredeterminada.hayFilasSinCategoria).toBe(true)
    expect(sinPredeterminada.omitidas).toEqual([{ numeroFila: 2, motivo: 'No tiene categoría.' }])

    const conPredeterminada = mapearFilas(filas, opciones({ categoriaPredeterminadaId: 'cat-imp' }))
    expect(conPredeterminada.importables[0].datos.categoriaId).toBe('cat-imp')
  })

  it('omite duplicados contra la base, sin distinguir mayúsculas', () => {
    const filas = [
      ['Nombre', 'Categoría', 'Serial', 'Placa'],
      ['POS caja 1', 'POS', 'sn-100', ''],
      ['POS caja 2', 'POS', '', 'inv-9'],
    ]
    const resultado = mapearFilas(
      filas,
      opciones({ serialesExistentes: ['SN-100'], placasExistentes: ['INV-9'] }),
    )
    expect(resultado.importables).toHaveLength(0)
    expect(resultado.omitidas[0].motivo).toContain('serial "sn-100"')
    expect(resultado.omitidas[1].motivo).toContain('placa "inv-9"')
  })

  it('omite duplicados dentro del mismo archivo indicando la fila original', () => {
    const filas = [
      ['Nombre', 'Categoría', 'Serial'],
      ['POS caja 1', 'POS', 'SN-1'],
      ['POS caja 1 repetida', 'POS', 'sn-1'],
    ]
    const resultado = mapearFilas(filas, opciones())
    expect(resultado.importables).toHaveLength(1)
    expect(resultado.omitidas).toEqual([
      { numeroFila: 3, motivo: 'Serial repetido en el archivo (igual a la fila 2).' },
    ])
  })

  it('ignora las filas completamente vacías sin reportarlas', () => {
    const filas = [
      ['Nombre', 'Categoría'],
      ['', ''],
      ['POS caja 1', 'POS'],
    ]
    const resultado = mapearFilas(filas, opciones())
    expect(resultado.importables).toHaveLength(1)
    expect(resultado.omitidas).toHaveLength(0)
  })

  it('los seriales y placas vacíos nunca cuentan como duplicados', () => {
    const filas = [
      ['Nombre', 'Categoría', 'Serial'],
      ['POS caja 1', 'POS', ''],
      ['POS caja 2', 'POS', ''],
    ]
    expect(mapearFilas(filas, opciones()).importables).toHaveLength(2)
  })
})

describe('generarPlantillaCsv', () => {
  it('la plantilla descargable se puede reimportar tal cual', () => {
    const resultado = mapearFilas(parsearCsv(generarPlantillaCsv()), opciones())
    expect(resultado.errorGeneral).toBeNull()
    expect(resultado.omitidas).toHaveLength(0)
    expect(resultado.importables).toHaveLength(2)
    expect(resultado.importables[0].datos.nombre).toBe('POS caja 1')
    expect(resultado.importables[1].datos.categoriaId).toBe('cat-imp')
  })
})
