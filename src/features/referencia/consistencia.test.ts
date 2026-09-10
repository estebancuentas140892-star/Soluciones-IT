import { describe, expect, it } from 'vitest'
import type { Articulo, BloquePaso, Referencia } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  esComandoDelicado,
  revisarCatalogo,
  revisarReferencia,
  terminosSugeridos,
  usaGigaAmbiguo,
  type ClaveAviso,
} from './consistencia'

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

function comando(parcial: Partial<Referencia> & { id: string; titulo: string }): Referencia {
  return referencia({
    tipo: 'comando',
    plataforma: 'Windows',
    resultadoEsperado: 'Aparece la información en pantalla',
    ...parcial,
  })
}

function claves(avisos: { clave: ClaveAviso }[]): ClaveAviso[] {
  return avisos.map((a) => a.clave)
}

function articuloCon(id: string, titulo: string, referenciaId: string): Articulo {
  const bloque: BloquePaso = {
    ...CAMPOS_BLOQUE_VACIOS,
    id: 'b1',
    tipo: 'referencia',
    referenciaId,
    referenciaTitulo: 'copia',
    referenciaTipo: 'termino',
    alcance: 'tarea',
    tareaId: 't1',
  }
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
          bloques: [{ ...CAMPOS_BLOQUE_VACIOS, id: 't1', tipo: 'tarea', texto: 'Hacer algo' }, bloque],
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

describe('revisarReferencia', () => {
  it('detecta un término duplicado del mismo tipo', () => {
    const avisos = revisarReferencia(referencia({ id: 'r1', titulo: 'Gigabyte' }), [
      referencia({ id: 'r2', titulo: 'gigabyte' }),
    ])
    expect(claves(avisos)).toContain('termino_duplicado')
    expect(avisos.find((a) => a.clave === 'termino_duplicado')?.otraId).toBe('r2')
  })

  it('no se choca consigo misma al editarse', () => {
    const gb = referencia({ id: 'r1', titulo: 'Gigabyte' })
    expect(claves(revisarReferencia(gb, [gb]))).not.toContain('termino_duplicado')
  })

  it('detecta la misma abreviatura para dos conceptos distintos', () => {
    const avisos = revisarReferencia(referencia({ id: 'r1', titulo: 'Gigabyte', abreviatura: 'GB' }), [
      referencia({ id: 'r2', titulo: 'Gigabit', abreviatura: 'GB' }),
    ])
    expect(claves(avisos)).toContain('abreviatura_contradictoria')
  })

  it('detecta un alias que ya nombra a otro concepto', () => {
    const avisos = revisarReferencia(referencia({ id: 'r1', titulo: 'Punto de acceso', alias: ['AP'] }), [
      referencia({ id: 'r2', titulo: 'Antivirus Pro', alias: ['AP'] }),
    ])
    expect(claves(avisos)).toContain('alias_ambiguo')
  })

  it('detecta el uso ambiguo de «giga»', () => {
    expect(usaGigaAmbiguo('la red es de 1 giga')).toBe(true)
    expect(usaGigaAmbiguo('Giga')).toBe(true)
    // Dentro de una palabra completa NO es ambiguo: ahí ya dice cuál es.
    expect(usaGigaAmbiguo('un disco de 500 gigabytes')).toBe(false)
    expect(usaGigaAmbiguo('enlace de 1 gigabit por segundo')).toBe(false)
    const avisos = revisarReferencia(
      referencia({ id: 'r1', titulo: 'Velocidad', definicion: 'La red va a 1 giga' }),
      [],
    )
    expect(claves(avisos)).toContain('giga_ambiguo')
  })

  it('detecta un comando duplicado para la misma plataforma', () => {
    const avisos = revisarReferencia(comando({ id: 'r1', titulo: 'Ver la IP', valor: 'ipconfig' }), [
      comando({ id: 'r2', titulo: 'Configuración de red', valor: 'ipconfig' }),
    ])
    expect(claves(avisos)).toContain('comando_duplicado')
  })

  it('no lo cuenta como duplicado si la plataforma es otra', () => {
    const avisos = revisarReferencia(comando({ id: 'r1', titulo: 'Ver la IP', valor: 'ip a', plataforma: 'Linux' }), [
      comando({ id: 'r2', titulo: 'Ver la IP', valor: 'ip a', plataforma: 'Android' }),
    ])
    expect(claves(avisos)).not.toContain('comando_duplicado')
  })

  it('detecta el mismo comando con resultados esperados contradictorios', () => {
    const avisos = revisarReferencia(
      comando({ id: 'r1', titulo: 'Ver la IP', valor: 'ipconfig', resultadoEsperado: 'Muestra la IP' }),
      [
        comando({
          id: 'r2',
          titulo: 'Otra ficha',
          valor: 'ipconfig',
          plataforma: 'Windows Server',
          resultadoEsperado: 'Reinicia la tarjeta de red',
        }),
      ],
    )
    expect(claves(avisos)).toContain('resultado_contradictorio')
  })

  it('detecta un comando sin plataforma y sin resultado esperado', () => {
    const avisos = revisarReferencia(
      comando({ id: 'r1', titulo: 'Algo', valor: 'foo', plataforma: '', resultadoEsperado: '' }),
      [],
    )
    expect(claves(avisos)).toContain('comando_sin_plataforma')
    expect(claves(avisos)).toContain('comando_sin_resultado')
  })

  it('detecta un comando delicado sin advertencia', () => {
    expect(esComandoDelicado('format C:')).toBe(true)
    expect(esComandoDelicado('shutdown /r /t 0')).toBe(true)
    expect(esComandoDelicado('ipconfig')).toBe(false)
    const avisos = revisarReferencia(comando({ id: 'r1', titulo: 'Formatear', valor: 'format C:' }), [])
    expect(claves(avisos)).toContain('comando_delicado_sin_advertencia')
  })

  it('con advertencia escrita ya no avisa', () => {
    const avisos = revisarReferencia(
      comando({ id: 'r1', titulo: 'Formatear', valor: 'format C:', advertencia: 'Borra todo el disco.' }),
      [],
    )
    expect(claves(avisos)).not.toContain('comando_delicado_sin_advertencia')
  })

  it('un término bien escrito no genera ningún aviso', () => {
    const avisos = revisarReferencia(
      referencia({ id: 'r1', titulo: 'Switch', abreviatura: '', definicion: 'Reparte la red dentro de una misma zona' }),
      [referencia({ id: 'r2', titulo: 'Router' })],
    )
    expect(avisos).toEqual([])
  })
})

describe('revisarCatalogo', () => {
  it('detecta una referencia eliminada que sigue vinculada a una guía', () => {
    const avisos = revisarCatalogo(
      [referencia({ id: 'r1', titulo: 'DNS', eliminadoEn: '2026-09-01T00:00:00.000Z' })],
      [articuloCon('a1', 'Conectar impresora', 'r1')],
    )
    expect(claves(avisos)).toEqual(['referencia_eliminada_en_guia'])
    expect(avisos[0].texto).toContain('Conectar impresora')
  })

  it('una eliminada que ya no se usa no aparece', () => {
    const avisos = revisarCatalogo(
      [referencia({ id: 'r1', titulo: 'DNS', eliminadoEn: '2026-09-01T00:00:00.000Z' })],
      [articuloCon('a1', 'Otra guía', 'r9')],
    )
    expect(avisos).toEqual([])
  })

  it('cuenta un choque entre dos fichas una sola vez', () => {
    const avisos = revisarCatalogo(
      [
        referencia({ id: 'r1', titulo: 'Gigabyte' }),
        referencia({ id: 'r2', titulo: 'Gigabyte' }),
      ],
      [],
    )
    expect(claves(avisos).filter((c) => c === 'termino_duplicado')).toHaveLength(1)
  })

  it('un catálogo sano no devuelve nada', () => {
    expect(revisarCatalogo([referencia({ id: 'r1', titulo: 'Switch' })], [])).toEqual([])
  })
})

describe('terminosSugeridos', () => {
  const glosario = [
    referencia({ id: 'r1', titulo: 'DNS', definicion: 'Traduce nombres a direcciones' }),
    referencia({ id: 'r2', titulo: 'Punto de acceso', alias: ['AP'] }),
    referencia({ id: 'r3', titulo: 'Byte', abreviatura: 'B' }),
    comando({ id: 'r4', titulo: 'Ver la IP', valor: 'ipconfig' }),
  ]

  it('sugiere el término que la tarea ya nombra', () => {
    const sugeridos = terminosSugeridos('Revisar el DNS del equipo', glosario, new Set())
    expect(sugeridos.map((r) => r.id)).toEqual(['r1'])
  })

  it('encuentra también por alias, sin acentos ni mayúsculas', () => {
    expect(terminosSugeridos('Reiniciar el ap del pasillo', glosario, new Set()).map((r) => r.id)).toEqual([
      'r2',
    ])
  })

  it('coincide por palabra entera, no por trozo', () => {
    // "DNSSEC" no es "DNS", y "Bytes" tampoco dispara la abreviatura de
    // una sola letra: sugerir por subcadena llenaría de ruido la fila.
    expect(terminosSugeridos('Configurar DNSSEC', glosario, new Set())).toEqual([])
  })

  it('no sugiere lo que ya está vinculado a esa tarea', () => {
    expect(terminosSugeridos('Revisar el DNS', glosario, new Set(['r1']))).toEqual([])
  })

  it('no sugiere atajos ni comandos: solo el glosario', () => {
    expect(terminosSugeridos('Ejecutar ipconfig', glosario, new Set())).toEqual([])
  })

  it('una tarea sin texto no sugiere nada', () => {
    expect(terminosSugeridos('   ', glosario, new Set())).toEqual([])
  })
})
