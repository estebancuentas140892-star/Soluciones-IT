import { describe, expect, it } from 'vitest'
import type { Articulo, BloquePaso, Procedimiento, Referencia } from '../../lib/db'
import {
  bloquesUnicos,
  referenciasDelProcedimiento,
  tipoEfectivo,
  tituloEfectivo,
  categoriasDe,
  coincide,
  filtrarComandos,
  filtrarGlosario,
  guiasQueUsan,
  idsUnicos,
  ordenarPorTitulo,
  plataformasDe,
  resumenDeLista,
  textoBuscable,
} from './referencias'

function referencia(parcial: Partial<Referencia> & { id: string; titulo: string }): Referencia {
  return {
    tipo: 'termino',
    abreviatura: '',
    alias: [],
    definicion: '',
    ejemplo: '',
    categoria: '',
    plataforma: '',
    valor: '',
    cuandoUsar: '',
    resultadoEsperado: '',
    requiereAdmin: false,
    advertencia: '',
    relacionadas: [],
    etiquetas: [],
    updatedAt: '2026-09-10T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  }
}

function bloqueReferencia(id: string, referenciaId: string | null): BloquePaso {
  return {
    id,
    tipo: 'referencia',
    texto: '',
    tono: null,
    adjunto: null,
    tipoTarea: null,
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    vinculoProtegido: null,
    alcance: 'tarea',
    tareaId: 't1',
    guiaArticuloId: null,
    guiaArticuloTitulo: '',
    intencionGuia: null,
    referenciaId,
    referenciaTitulo: '',
    referenciaTipo: 'termino',
  }
}

function articulo(id: string, titulo: string, bloques: BloquePaso[]): Articulo {
  return {
    id,
    categoriaId: 'cat-1',
    titulo,
    tipo: 'instalacion',
    contenido: '',
    etiquetas: [],
    procedimiento: {
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      pasos: [
        {
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
        },
      ],
      verificacionFinal: [],
      tiempoEstimadoMin: null,
      dificultad: null,
    },
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    ordenRutaInicio: 0,
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: '2026-09-10T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
  }
}

describe('coincide', () => {
  const gigabyte = referencia({
    id: 'r1',
    titulo: 'Gigabyte',
    abreviatura: 'GB',
    alias: ['giga byte'],
    definicion: 'Unidad de almacenamiento',
    etiquetas: ['medida'],
  })

  it('encuentra por título, abreviatura, alias, definición y etiqueta', () => {
    expect(coincide(gigabyte, 'giga')).toBe(true)
    expect(coincide(gigabyte, 'GB')).toBe(true)
    expect(coincide(gigabyte, 'giga byte')).toBe(true)
    expect(coincide(gigabyte, 'almacenamiento')).toBe(true)
    expect(coincide(gigabyte, 'medida')).toBe(true)
  })

  it('ignora acentos y mayúsculas', () => {
    const camara = referencia({ id: 'r2', titulo: 'Cámara IP', definicion: 'Videovigilancia' })
    expect(coincide(camara, 'camara')).toBe(true)
    expect(coincide(camara, 'CÁMARA')).toBe(true)
  })

  it('una consulta vacía no filtra nada', () => {
    expect(coincide(gigabyte, '   ')).toBe(true)
  })

  it('no inventa coincidencias', () => {
    expect(coincide(gigabyte, 'impresora')).toBe(false)
  })

  it('un comando se encuentra por su valor y por su plataforma', () => {
    const ping = referencia({
      id: 'r3',
      titulo: 'Probar conectividad',
      tipo: 'comando',
      valor: 'ping 8.8.8.8',
      plataforma: 'Windows',
    })
    expect(coincide(ping, 'ping')).toBe(true)
    expect(coincide(ping, 'windows')).toBe(true)
    expect(textoBuscable(ping)).toContain('ping 8.8.8.8')
  })
})

describe('filtrar', () => {
  const datos = [
    referencia({ id: 'r1', titulo: 'Byte', abreviatura: 'B', categoria: 'Medidas' }),
    referencia({ id: 'r2', titulo: 'Access Point', alias: ['AP'], categoria: 'Redes' }),
    referencia({ id: 'r3', titulo: 'Abrir Ejecutar', tipo: 'atajo', valor: 'Windows + R', plataforma: 'Windows' }),
    referencia({ id: 'r4', titulo: 'Ver la IP', tipo: 'comando', valor: 'ipconfig', plataforma: 'Windows' }),
    referencia({ id: 'r5', titulo: 'Escritorio remoto', tipo: 'comando', valor: 'mstsc', plataforma: 'Windows' }),
  ]

  it('el glosario solo trae términos, en orden alfabético', () => {
    const visibles = filtrarGlosario(datos, { consulta: '', categoria: null })
    expect(visibles.map((r) => r.titulo)).toEqual(['Access Point', 'Byte'])
  })

  it('el glosario acota por categoría', () => {
    const visibles = filtrarGlosario(datos, { consulta: '', categoria: 'Redes' })
    expect(visibles.map((r) => r.id)).toEqual(['r2'])
  })

  it('el glosario encuentra un término por su alias', () => {
    const visibles = filtrarGlosario(datos, { consulta: 'AP', categoria: null })
    expect(visibles.map((r) => r.id)).toEqual(['r2'])
  })

  it('atajos y comandos excluye los términos', () => {
    const visibles = filtrarComandos(datos, { consulta: '', tipo: null, plataforma: null })
    expect(visibles.map((r) => r.id)).toEqual(['r3', 'r5', 'r4'])
  })

  it('acota por tipo y por plataforma', () => {
    expect(
      filtrarComandos(datos, { consulta: '', tipo: 'atajo', plataforma: null }).map((r) => r.id),
    ).toEqual(['r3'])
    expect(
      filtrarComandos(datos, { consulta: 'mstsc', tipo: null, plataforma: 'Windows' }).map((r) => r.id),
    ).toEqual(['r5'])
  })

  it('las listas de filtro solo traen lo realmente escrito', () => {
    expect(categoriasDe(datos)).toEqual(['Medidas', 'Redes'])
    expect(plataformasDe(datos)).toEqual(['Windows'])
    expect(categoriasDe([referencia({ id: 'x', titulo: 'Sin categoría' })])).toEqual([])
  })

  it('ordena con el locale español', () => {
    const ordenadas = ordenarPorTitulo([
      referencia({ id: 'a', titulo: 'Switch' }),
      referencia({ id: 'b', titulo: 'Ámbito' }),
      referencia({ id: 'c', titulo: 'Router' }),
    ])
    expect(ordenadas.map((r) => r.titulo)).toEqual(['Ámbito', 'Router', 'Switch'])
  })
})

describe('resumenDeLista', () => {
  it('un término se resume con su definición', () => {
    expect(resumenDeLista(referencia({ id: 'r', titulo: 'Bit', definicion: 'La unidad mínima' }))).toBe(
      'La unidad mínima',
    )
  })

  it('un comando se resume con lo que se teclea', () => {
    expect(
      resumenDeLista(
        referencia({ id: 'r', titulo: 'Ver la IP', tipo: 'comando', valor: 'ipconfig', definicion: 'x' }),
      ),
    ).toBe('ipconfig')
  })

  it('sin nada que decir, no devuelve una línea en blanco', () => {
    expect(resumenDeLista(referencia({ id: 'r', titulo: 'Bit' }))).toBe('')
  })
})

describe('guiasQueUsan', () => {
  it('encuentra las guías que vinculan la referencia y cuenta las veces', () => {
    const articulos = [
      articulo('a1', 'Conectar impresora', [bloqueReferencia('b1', 'r1'), bloqueReferencia('b2', 'r1')]),
      articulo('a2', 'Cambiar el switch', [bloqueReferencia('b3', 'r2')]),
    ]
    const usos = guiasQueUsan('r1', articulos)
    expect(usos).toHaveLength(1)
    expect(usos[0].articuloId).toBe('a1')
    expect(usos[0].veces).toBe(2)
  })

  it('no cuenta una guía eliminada', () => {
    const eliminado = { ...articulo('a1', 'Vieja', [bloqueReferencia('b1', 'r1')]), eliminadoEn: '2026-01-01' }
    expect(guiasQueUsan('r1', [eliminado])).toEqual([])
  })

  it('sin usos devuelve una lista vacía, no una sección con cero', () => {
    expect(guiasQueUsan('r9', [articulo('a1', 'Guía', [bloqueReferencia('b1', 'r1')])])).toEqual([])
  })
})

describe('deduplicación por tarea', () => {
  it('el mismo término vinculado dos veces se muestra una sola', () => {
    const bloques = [bloqueReferencia('b1', 'r1'), bloqueReferencia('b2', 'r1'), bloqueReferencia('b3', 'r2')]
    expect(idsUnicos(bloques)).toEqual(['r1', 'r2'])
    // Se conserva el PRIMER bloque de cada referencia: la posición la
    // manda quien lo colocó primero.
    expect(bloquesUnicos(bloques).map((b) => b.id)).toEqual(['b1', 'b3'])
  })

  it('un bloque sin destino no cuenta', () => {
    expect(idsUnicos([bloqueReferencia('b1', null)])).toEqual([])
  })
})

describe('referencias de una guía completa', () => {
  function procedimiento(pasos: BloquePaso[][]): Procedimiento {
    return {
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      pasos: pasos.map((bloques, i) => ({
        id: `p${i}`,
        titulo: `Paso ${i + 1}`,
        objetivo: '',
        bloques,
        adjuntos: [],
        vinculoProtegido: null,
        subArticuloId: null,
        subArticuloTitulo: '',
        solucionArticuloId: null,
        solucionArticuloTitulo: '',
      })),
      verificacionFinal: [],
      tiempoEstimadoMin: null,
      dificultad: null,
    }
  }

  it('reúne los vínculos de todos los pasos, sin repetir', () => {
    const vinculos = referenciasDelProcedimiento(
      procedimiento([
        [bloqueReferencia('b1', 'r1'), bloqueReferencia('b2', 'r2')],
        [bloqueReferencia('b3', 'r1')],
      ]),
    )
    expect(vinculos.map((v) => v.id)).toEqual(['r1', 'r2'])
  })

  it('una guía sin procedimiento no aporta ninguno', () => {
    expect(referenciasDelProcedimiento(null)).toEqual([])
  })

  it('manda el tipo de la ficha viva sobre el declarado al insertarlo', () => {
    const vivas = new Map([['r1', referencia({ id: 'r1', titulo: 'mstsc', tipo: 'comando' })]])
    const vinculo = { id: 'r1', titulo: 'copia vieja', tipoDeclarado: 'termino' as const }
    expect(tipoEfectivo(vinculo, vivas)).toBe('comando')
    expect(tituloEfectivo(vinculo, vivas)).toBe('mstsc')
  })

  it('sin la ficha viva cae al tipo y al título guardados en el bloque', () => {
    const vinculo = { id: 'r9', titulo: 'Gigabyte', tipoDeclarado: 'termino' as const }
    expect(tipoEfectivo(vinculo, new Map())).toBe('termino')
    expect(tituloEfectivo(vinculo, new Map())).toBe('Gigabyte')
  })
})
