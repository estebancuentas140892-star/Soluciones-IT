import { describe, expect, it } from 'vitest'
import {
  cuentaDeTipo,
  filasConPrefijoComun,
  MINIMO_FILAS_PREFIJO,
  partesSubtituloConTipo,
  partirPorPrefijo,
  tipoComun,
} from './presentacionResultados'
import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// Cómo se pinta una lista de resultados según la propuesta final de
// Claude Design: lógica pura sobre lo que `buscar` ya devolvió. Ningún
// título cambia; solo qué tramo se atenúa y dónde va el tipo.

function resultado(id: string, tipo: TipoResultado, titulo: string, subtitulo = ''): ResultadoBusqueda {
  return { id, tipo, titulo, subtitulo, ruta: `/${tipo}/${id}`, portadaRef: '' }
}

const IMPRESORAS = [
  resultado('i1', 'dispositivo', 'Impresora Mercadeo', 'KYOCERA · ECOSYS M3655'),
  resultado('i2', 'dispositivo', 'Impresora Comunicaciones', 'TOSHIBA · e-STUDIO2515AC'),
  resultado('i3', 'dispositivo', 'Impresora Logística', 'RICOH · MP 501'),
  resultado('i4', 'dispositivo', 'Impresora Caja PN', 'HP · LaserJet MFP M527'),
]

describe('partirPorPrefijo', () => {
  it('parte el título original por la consulta normalizada, sin tocar mayúsculas ni tildes', () => {
    expect(partirPorPrefijo('Impresora Caja PN', 'impresora')).toEqual({ prefijo: 'Impresora', resto: ' Caja PN' })
    expect(partirPorPrefijo('Cámara Taquilla 2', 'camara')).toEqual({ prefijo: 'Cámara', resto: ' Taquilla 2' })
  })

  it('solo cuenta una palabra entera: "Impresoras" no empieza por "impresora"', () => {
    expect(partirPorPrefijo('Impresoras Caja', 'impresora')).toBeNull()
    expect(partirPorPrefijo('Impresora Caja', 'impre')).toBeNull()
  })

  it('sin nada que distinga no hay prefijo: el título igual a lo buscado se resalta como siempre', () => {
    expect(partirPorPrefijo('Impresora', 'impresora')).toBeNull()
    expect(partirPorPrefijo('Impresora ·', 'impresora')).toBeNull()
    expect(partirPorPrefijo('Diagnosticar una impresora', 'impresora')).toBeNull()
  })

  it('una consulta de varias palabras también es un comienzo', () => {
    expect(partirPorPrefijo('Impresora Caja PN', 'impresora caja')).toEqual({ prefijo: 'Impresora Caja', resto: ' PN' })
  })
})

describe('filasConPrefijoComun', () => {
  it(`con ${MINIMO_FILAS_PREFIJO} o más filas que empiezan por lo buscado, esas se atenúan`, () => {
    const conMezcla = [...IMPRESORAS, resultado('g1', 'articulo', 'Diagnosticar una impresora que no imprime')]
    expect([...filasConPrefijoComun(conMezcla, 'impresora')]).toEqual(['i1', 'i2', 'i3', 'i4'])
  })

  it('con menos no es una lista que comparar: ninguna se atenúa', () => {
    expect(filasConPrefijoComun(IMPRESORAS.slice(0, MINIMO_FILAS_PREFIJO - 1), 'impresora').size).toBe(0)
  })

  it('sin consulta no hay nada que atenuar', () => {
    expect(filasConPrefijoComun(IMPRESORAS, '').size).toBe(0)
  })
})

describe('tipoComun y cuentaDeTipo', () => {
  it('el tipo sube al encabezado solo si todas las filas lo comparten', () => {
    expect(tipoComun(IMPRESORAS)).toBe('dispositivo')
    expect(cuentaDeTipo('dispositivo', 4)).toBe('4 equipos')
    expect(tipoComun([...IMPRESORAS, resultado('p1', 'persona', 'Impresora Persona')])).toBeNull()
  })

  it('una sola fila no es una lista', () => {
    expect(tipoComun(IMPRESORAS.slice(0, 1))).toBeNull()
  })

  it('el plural de cada tipo se lee bien', () => {
    expect(cuentaDeTipo('diagnostico', 2)).toBe('2 guías con preguntas')
    expect(cuentaDeTipo('ubicacion', 3)).toBe('3 ubicaciones')
    expect(cuentaDeTipo('articulo', 5)).toBe('5 guías')
  })
})

describe('partesSubtituloConTipo', () => {
  it('separa el tipo del resto del contexto, para pintarlo más claro', () => {
    expect(partesSubtituloConTipo(resultado('g', 'articulo', 'X', 'Impresoras'))).toEqual({
      tipo: 'Guía',
      detalle: 'Impresoras',
    })
    expect(partesSubtituloConTipo(resultado('e', 'dispositivo', 'X'))).toEqual({ tipo: 'Equipo', detalle: '' })
  })

  it('no repite el tipo cuando el subtítulo ya lo trae', () => {
    expect(partesSubtituloConTipo(resultado('h', 'herramienta', 'X', 'Herramienta · Monitoreo'))).toEqual({
      tipo: 'Herramienta',
      detalle: 'Monitoreo',
    })
  })
})
