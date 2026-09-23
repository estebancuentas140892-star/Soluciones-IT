import { describe, expect, it } from 'vitest'
import type { Articulo, BloquePaso, EstadoArticulo, Procedimiento, Referencia } from '../../lib/db'
import {
  bloquesUnicos,
  categoriasDe,
  coincide,
  coincidenciasPorTipo,
  esTipoConocido,
  filtrarCatalogo,
  guiasQueUsan,
  idsUnicos,
  INFO_TIPO,
  ordenarPorTitulo,
  plataformasDe,
  referenciasDelProcedimiento,
  resolverGuiasRelacionadas,
  resumenDeLista,
  rutaDeCatalogo,
  TEXTO_ESTADO_USO,
  textoBuscable,
  tipoDePestana,
  tipoEfectivo,
  TIPOS_REFERENCIA,
  tituloConAbreviatura,
  tituloEfectivo,
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
    proveedor: '',
    usoEnMetroparques: '',
    estadoUso: '',
    notas: '',
    guiasRelacionadas: [],
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

function articulo(
  id: string,
  titulo: string,
  bloques: BloquePaso[],
  estado: EstadoArticulo = 'publicado',
): Articulo {
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
          lugar: '',
          resultado: '',
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
    estado,
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

  it('una herramienta se encuentra por su proveedor, su uso en Metroparques y sus notas', () => {
    const sicof = referencia({
      id: 'h1',
      tipo: 'herramienta',
      titulo: 'SICOF ERP',
      proveedor: 'ADA',
      usoEnMetroparques: 'Procesos administrativos y financieros',
      notas: 'No confundir con ICG Manager',
    })
    expect(coincide(sicof, 'ada')).toBe(true)
    expect(coincide(sicof, 'financieros')).toBe(true)
    expect(coincide(sicof, 'icg')).toBe(true)
  })

  it('las guías relacionadas no entran en el texto buscable', () => {
    const ssms = referencia({
      id: 'h2',
      tipo: 'herramienta',
      titulo: 'SQL Server Management Studio',
      guiasRelacionadas: [{ id: 'a1', titulo: 'Crear copia de seguridad de una base de datos' }],
    })
    expect(coincide(ssms, 'copia de seguridad')).toBe(false)
  })
})

describe('filtrarCatalogo', () => {
  const datos = [
    referencia({ id: 'r1', titulo: 'Byte', abreviatura: 'B', categoria: 'Medidas' }),
    referencia({ id: 'r2', titulo: 'Access Point', alias: ['AP'], categoria: 'Redes' }),
    referencia({ id: 'r3', titulo: 'Abrir Ejecutar', tipo: 'atajo', valor: 'Windows + R', plataforma: 'Windows' }),
    referencia({ id: 'r4', titulo: 'Ver la IP', tipo: 'comando', valor: 'ipconfig', plataforma: 'Windows' }),
    referencia({ id: 'r5', titulo: 'Escritorio remoto', tipo: 'comando', valor: 'mstsc', plataforma: 'Windows' }),
    referencia({ id: 'h1', titulo: 'Zabbix', tipo: 'herramienta', categoria: 'Monitoreo' }),
    referencia({ id: 'h2', titulo: 'TightVNC', tipo: 'herramienta', categoria: 'Acceso remoto' }),
    referencia({ id: 'h3', titulo: 'SICOF ERP', tipo: 'herramienta', categoria: 'Administración', proveedor: 'ADA' }),
  ]
  const sinFiltros = { consulta: '', categoria: null, plataforma: null }

  it('Herramientas solo trae herramientas, en orden alfabético', () => {
    const visibles = filtrarCatalogo(datos, { tipo: 'herramienta', ...sinFiltros })
    expect(visibles.map((r) => r.titulo)).toEqual(['SICOF ERP', 'TightVNC', 'Zabbix'])
  })

  it('Herramientas acota por categoría y busca por proveedor', () => {
    expect(
      filtrarCatalogo(datos, { tipo: 'herramienta', ...sinFiltros, categoria: 'Monitoreo' }).map((r) => r.id),
    ).toEqual(['h1'])
    expect(filtrarCatalogo(datos, { tipo: 'herramienta', ...sinFiltros, consulta: 'ada' }).map((r) => r.id)).toEqual([
      'h3',
    ])
  })

  it('el Glosario solo trae términos, y acota por categoría o alias', () => {
    expect(filtrarCatalogo(datos, { tipo: 'termino', ...sinFiltros }).map((r) => r.titulo)).toEqual([
      'Access Point',
      'Byte',
    ])
    expect(filtrarCatalogo(datos, { tipo: 'termino', ...sinFiltros, categoria: 'Redes' }).map((r) => r.id)).toEqual([
      'r2',
    ])
    expect(filtrarCatalogo(datos, { tipo: 'termino', ...sinFiltros, consulta: 'AP' }).map((r) => r.id)).toEqual(['r2'])
  })

  it('Atajos y Comandos ya no se mezclan', () => {
    expect(filtrarCatalogo(datos, { tipo: 'atajo', ...sinFiltros }).map((r) => r.id)).toEqual(['r3'])
    expect(filtrarCatalogo(datos, { tipo: 'comando', ...sinFiltros }).map((r) => r.id)).toEqual(['r5', 'r4'])
  })

  it('acota Comandos por plataforma y búsqueda', () => {
    expect(
      filtrarCatalogo(datos, { tipo: 'comando', consulta: 'mstsc', categoria: null, plataforma: 'Windows' }).map(
        (r) => r.id,
      ),
    ).toEqual(['r5'])
  })

  it('un filtro del otro eje no vacía la pestaña', () => {
    // Una plataforma no significa nada en Herramientas.
    expect(filtrarCatalogo(datos, { tipo: 'herramienta', ...sinFiltros, plataforma: 'Windows' })).toHaveLength(3)
    // Ni una categoría en Atajos.
    expect(filtrarCatalogo(datos, { tipo: 'atajo', ...sinFiltros, categoria: 'Medidas' })).toHaveLength(1)
  })

  it('las listas de filtro solo traen lo realmente escrito', () => {
    expect(categoriasDe(datos.filter((r) => r.tipo === 'termino'))).toEqual(['Medidas', 'Redes'])
    expect(categoriasDe(datos.filter((r) => r.tipo === 'herramienta'))).toEqual([
      'Acceso remoto',
      'Administración',
      'Monitoreo',
    ])
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

  it('cuenta las coincidencias de cada pestaña para el estado vacío', () => {
    const eliminado = referencia({ id: 'x', titulo: 'Windows viejo', tipo: 'atajo', eliminadoEn: '2026-01-01' })
    expect(coincidenciasPorTipo([...datos, eliminado], 'windows')).toEqual({
      herramienta: 0,
      termino: 0,
      atajo: 1,
      comando: 2,
    })
  })
})

describe('tipos y pestañas del Centro de consulta', () => {
  it('son cuatro, con Herramientas primero', () => {
    expect(TIPOS_REFERENCIA).toEqual(['herramienta', 'termino', 'atajo', 'comando'])
    expect(TIPOS_REFERENCIA.map((tipo) => INFO_TIPO[tipo].pestana)).toEqual([
      'Herramientas',
      'Glosario',
      'Atajos',
      'Comandos',
    ])
  })

  it('herramientas y términos se acotan por categoría; atajos y comandos, por plataforma', () => {
    expect(INFO_TIPO.herramienta.eje).toBe('categoria')
    expect(INFO_TIPO.termino.eje).toBe('categoria')
    expect(INFO_TIPO.atajo.eje).toBe('plataforma')
    expect(INFO_TIPO.comando.eje).toBe('plataforma')
  })

  it('la URL abre la pestaña correcta, también con los enlaces viejos', () => {
    expect(tipoDePestana(null)).toBe('herramienta')
    expect(tipoDePestana('glosario')).toBe('termino')
    expect(tipoDePestana('atajos')).toBe('atajo')
    // `?tab=comandos` era la pestaña "Atajos y comandos": sigue abriendo Comandos.
    expect(tipoDePestana('comandos')).toBe('comando')
    expect(tipoDePestana('lo-que-sea')).toBe('herramienta')
  })

  it('la ruta de cada lista vuelve a abrir su misma pestaña', () => {
    for (const tipo of TIPOS_REFERENCIA) {
      const url = new URL(rutaDeCatalogo(tipo), 'https://soluciones.local')
      expect(url.pathname).toBe('/referencia')
      expect(tipoDePestana(url.searchParams.get('tab'))).toBe(tipo)
    }
    expect(rutaDeCatalogo('herramienta')).toBe('/referencia')
  })

  it('reconoce solo los tipos que esta versión sabe dibujar', () => {
    expect(esTipoConocido('herramienta')).toBe(true)
    expect(esTipoConocido('comando')).toBe(true)
    expect(esTipoConocido('software')).toBe(false)
    expect(esTipoConocido(undefined)).toBe(false)
  })

  it('nombra una herramienta con su forma corta', () => {
    expect(
      tituloConAbreviatura(
        referencia({ id: 'h', tipo: 'herramienta', titulo: 'SQL Server Management Studio', abreviatura: 'SSMS' }),
      ),
    ).toBe('SQL Server Management Studio (SSMS)')
    expect(tituloConAbreviatura(referencia({ id: 'h', tipo: 'herramienta', titulo: 'Zabbix' }))).toBe('Zabbix')
  })
})

describe('resumenDeLista', () => {
  it('un término y una herramienta se resumen con su descripción', () => {
    expect(resumenDeLista(referencia({ id: 'r', titulo: 'Bit', definicion: 'La unidad mínima' }))).toBe(
      'La unidad mínima',
    )
    expect(
      resumenDeLista(
        referencia({ id: 'h', tipo: 'herramienta', titulo: 'Zabbix', definicion: 'Plataforma de monitoreo' }),
      ),
    ).toBe('Plataforma de monitoreo')
  })

  it('un atajo o un comando se resumen con cuándo sirven, porque lo que se teclea va aparte', () => {
    expect(
      resumenDeLista(
        referencia({
          id: 'r',
          titulo: 'Ver la IP',
          tipo: 'comando',
          valor: 'ipconfig',
          cuandoUsar: 'Para saber qué IP tiene el equipo',
        }),
      ),
    ).toBe('Para saber qué IP tiene el equipo')
    expect(
      resumenDeLista(referencia({ id: 'r', titulo: 'Abrir Ejecutar', tipo: 'atajo', definicion: 'Nota del atajo' })),
    ).toBe('Nota del atajo')
  })

  it('sin nada que decir, no devuelve una línea en blanco', () => {
    expect(resumenDeLista(referencia({ id: 'r', titulo: 'Bit' }))).toBe('')
  })
})

describe('uso de una herramienta en Metroparques', () => {
  it('lo documentado nunca se presenta como vigente', () => {
    expect(TEXTO_ESTADO_USO.documentado).toBe(
      'Uso documentado en Metroparques; estado actual pendiente de confirmar.',
    )
    expect(TEXTO_ESTADO_USO.confirmado).toContain('confirmado')
  })
})

describe('resolverGuiasRelacionadas', () => {
  const publicada = articulo('a1', 'Conectar de forma remota a un POS', [])
  const borrador = articulo('a2', 'Crear copia de seguridad en SQL Server', [], 'borrador')
  const eliminada = { ...articulo('a3', 'Guía retirada', []), eliminadoEn: '2026-09-01' }

  it('resuelve el título vivo, la ruta y el estado de cada guía', () => {
    const renombrada = { ...publicada, titulo: 'Conectar de forma remota a un POS desde un computador' }
    expect(resolverGuiasRelacionadas([{ id: 'a1', titulo: 'Copia vieja' }], [renombrada])).toEqual([
      {
        id: 'a1',
        titulo: 'Conectar de forma remota a un POS desde un computador',
        ruta: '/soluciones/cat-1/a1',
        estado: 'publicado',
      },
    ])
  })

  it('un borrador se lista con su estado, no se esconde', () => {
    const [guia] = resolverGuiasRelacionadas([{ id: 'a2', titulo: 'x' }], [borrador])
    expect(guia.estado).toBe('borrador')
    expect(guia.ruta).toBe('/soluciones/cat-1/a2')
  })

  it('una guía eliminada o que no llegó conserva su copia y pierde el enlace', () => {
    expect(
      resolverGuiasRelacionadas(
        [
          { id: 'a3', titulo: 'Guía retirada' },
          { id: 'a9', titulo: 'Guía que no llegó' },
        ],
        [eliminada],
      ),
    ).toEqual([
      { id: 'a3', titulo: 'Guía retirada', ruta: null, estado: null },
      { id: 'a9', titulo: 'Guía que no llegó', ruta: null, estado: null },
    ])
  })

  it('no repite una guía enlazada dos veces y respeta el orden del autor', () => {
    const guias = resolverGuiasRelacionadas(
      [
        { id: 'a2', titulo: 'b' },
        { id: 'a1', titulo: 'a' },
        { id: 'a2', titulo: 'b' },
      ],
      [publicada, borrador],
    )
    expect(guias.map((g) => g.id)).toEqual(['a2', 'a1'])
  })

  it('una ficha guardada sin el campo no rompe nada', () => {
    expect(resolverGuiasRelacionadas(undefined, [publicada])).toEqual([])
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
        lugar: '',
        resultado: '',
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

  it('una ficha que pasó a ser herramienta se presenta como herramienta en todas las guías', () => {
    const vivas = new Map([['r1', referencia({ id: 'r1', titulo: 'TightVNC', tipo: 'herramienta' })]])
    expect(tipoEfectivo({ id: 'r1', titulo: 'VNC', tipoDeclarado: 'termino' }, vivas)).toBe('herramienta')
  })

  it('sin la ficha viva cae al tipo y al título guardados en el bloque', () => {
    const vinculo = { id: 'r9', titulo: 'Gigabyte', tipoDeclarado: 'termino' as const }
    expect(tipoEfectivo(vinculo, new Map())).toBe('termino')
    expect(tituloEfectivo(vinculo, new Map())).toBe('Gigabyte')
  })
})
