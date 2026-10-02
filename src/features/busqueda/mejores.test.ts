import { describe, expect, it } from 'vitest'
import { datosBenchmark } from './benchmarkResolver'
import {
  confianzaDeResultados,
  hayQueSepararMejores,
  intencionesDeConsulta,
  leerResultados,
  MAXIMO_MEJORES,
  MAXIMO_POR_CLASE_SIN_INTENCION,
  mejoresResultados,
  PRIORIDAD_INTENCIONES,
  sinLosMejores,
  subtituloConTipo,
} from './mejores'
import {
  buscar,
  crearIndiceDesdeDocumentos,
  documentosDeBusqueda,
  type CampoIndice,
  type ResultadoBusqueda,
  type TipoResultado,
} from './useIndiceBusqueda'

// Pruebas del ranking global de "Mejores resultados" (tarea 241). Todo
// es logica pura sobre lo que `buscar` ya devolvio, asi que no hace
// falta ni navegador ni base local.

function resultado(
  id: string,
  tipo: TipoResultado,
  titulo: string,
  extra: Partial<ResultadoBusqueda> = {},
): ResultadoBusqueda {
  return {
    id,
    tipo,
    titulo,
    subtitulo: '',
    ruta: `/${tipo}/${id}`,
    portadaRef: '',
    ...extra,
  }
}

const titulos = (lista: ResultadoBusqueda[]) => lista.map((r) => r.titulo)

describe('mejoresResultados', () => {
  it('cruza modulos: el equipo exacto se adelanta a las guias que iban antes por grupo', () => {
    // El orden de entrada es el del buscador, que respeta el score pero
    // NO el modulo: el agrupado de la interfaz era el que ponia siempre
    // Guias primero.
    const entrada = [
      resultado('a1', 'articulo', 'Cambiar el rodillo de una impresora'),
      resultado('a2', 'articulo', 'Impresora: atasco de papel'),
      resultado('d1', 'dispositivo', 'Impresora caja 4'),
    ]
    expect(titulos(mejoresResultados(entrada, 'impresora caja 4'))[0]).toBe('Impresora caja 4')
  })

  it('el titulo exacto manda sobre cualquier otro peso', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Diagnosticar la red con ping y tracert'),
      resultado('c1', 'comando', 'ping'),
    ]
    expect(titulos(mejoresResultados(entrada, 'ping'))[0]).toBe('ping')
  })

  it('una herramienta con el nombre exacto gana a la guia que la menciona', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Revisar alertas de Zabbix cada mañana'),
      resultado('h1', 'herramienta', 'Zabbix'),
    ]
    expect(titulos(mejoresResultados(entrada, 'zabbix'))[0]).toBe('Zabbix')
  })

  it('un resultado que solo trae un sinonimo NUNCA adelanta a uno directo', () => {
    // "Copia de seguridad" es un articulo (peso operativo alto) y ademas
    // lleva la consulta expandida entera en el titulo; aun asi va detras
    // del resultado que coincide con lo escrito.
    const entrada = [
      resultado('h1', 'herramienta', 'Backup Exec'),
      resultado('a1', 'articulo', 'Crear copia de seguridad del SQL Server', { soloSinonimo: true }),
    ]
    expect(titulos(mejoresResultados(entrada, 'backup'))).toEqual([
      'Backup Exec',
      'Crear copia de seguridad del SQL Server',
    ])
  })

  it('a igualdad de coincidencia gana lo que resuelve, no lo que es un escalon', () => {
    const entrada = [
      resultado('cat1', 'categoria', 'Impresoras'),
      resultado('a1', 'articulo', 'Impresoras'),
    ]
    expect(titulos(mejoresResultados(entrada, 'impresoras'))[0]).toBe('Impresoras')
    expect(mejoresResultados(entrada, 'impresoras')[0].tipo).toBe('articulo')
  })

  it('nunca devuelve mas de cinco', () => {
    const entrada = Array.from({ length: 12 }, (_, i) =>
      resultado(`a${i}`, 'articulo', `Configurar impresora ${i}`),
    )
    expect(mejoresResultados(entrada, 'impresora')).toHaveLength(MAXIMO_MEJORES)
  })

  it('conserva el orden del buscador como desempate, para que no baile entre teclas', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Reiniciar el servidor de correo'),
      resultado('a2', 'articulo', 'Reiniciar el servidor de archivos'),
    ]
    expect(titulos(mejoresResultados(entrada, 'reiniciar servidor'))).toEqual([
      'Reiniciar el servidor de correo',
      'Reiniciar el servidor de archivos',
    ])
  })

  it('sin consulta o sin resultados no elige nada', () => {
    expect(mejoresResultados([], 'algo')).toEqual([])
    expect(mejoresResultados([resultado('a1', 'articulo', 'Algo')], '  ')).toEqual([])
  })
})

describe('intencionesDeConsulta', () => {
  it('"crear cliente externo" pide un procedimiento', () => {
    expect(intencionesDeConsulta('crear cliente externo')).toContain('procedimiento')
  })

  it('"que es dhcp" pide el glosario', () => {
    expect(intencionesDeConsulta('qué es dhcp')).toContain('glosario')
  })

  it('"impresora taquilla 2" pide un equipo concreto', () => {
    expect(intencionesDeConsulta('impresora taquilla 2')).toContain('equipo')
  })

  it('"administrador pos" pide un acceso', () => {
    expect(intencionesDeConsulta('administrador POS')).toContain('acceso')
  })

  it('"la impresora no aparece" es un problema', () => {
    expect(intencionesDeConsulta('la impresora no aparece')).toContain('problema')
  })

  it('una palabra suelta sin señales no fuerza ninguna intencion', () => {
    expect(intencionesDeConsulta('zabbix')).toEqual([])
  })

  // Tarea 263, ejemplos B y D del encargo "Resolución guiada".
  it('"desbloquear usuario" es un procedimiento; "usuario bloqueado", un problema', () => {
    expect(intencionesDeConsulta('desbloquear usuario active directory')).toContain('procedimiento')
    expect(intencionesDeConsulta('usuario bloqueado')).toContain('problema')
    expect(intencionesDeConsulta('usuario bloqueado')).not.toContain('procedimiento')
  })

  it('"desbloquear usuario" pone la guía por delante de la credencial que se llama parecido', () => {
    const entrada = [
      resultado('c1', 'credencial', 'Usuario administrador del directorio'),
      resultado('a1', 'articulo', 'Desbloquear usuario en el directorio activo'),
    ]
    expect(titulos(mejoresResultados(entrada, 'desbloquear usuario'))[0]).toBe(
      'Desbloquear usuario en el directorio activo',
    )
  })
})

describe('la intencion desempata sin inventar resultados', () => {
  it('"crear cliente externo" favorece la guia frente al equipo que se llama parecido', () => {
    const entrada = [
      resultado('d1', 'dispositivo', 'Cliente externo (PC recepción)'),
      resultado('a1', 'articulo', 'Crear cliente externo en ICG Manager'),
    ]
    expect(mejoresResultados(entrada, 'crear cliente externo')[0].tipo).toBe('articulo')
  })

  it('"la impresora no imprime" favorece el diagnostico', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Impresora: cambiar el tóner'),
      resultado('dg1', 'diagnostico', 'La impresora no imprime'),
    ]
    expect(mejoresResultados(entrada, 'la impresora no imprime')[0].tipo).toBe('diagnostico')
  })
})

describe('hayQueSepararMejores', () => {
  it('con dos resultados o más se separa: es donde viven las acciones directas', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Guía A'),
      resultado('dg1', 'diagnostico', 'Diagnóstico B'),
    ]
    expect(hayQueSepararMejores(entrada, entrada)).toBe(true)
  })

  it('separa también cuando quedan resultados fuera de la selección', () => {
    const entrada = Array.from({ length: 8 }, (_, i) => resultado(`a${i}`, 'articulo', `Guía ${i}`))
    expect(hayQueSepararMejores(entrada, entrada.slice(0, 5))).toBe(true)
  })

  it('con UN solo resultado no: una cabecera sobre una fila única es ruido', () => {
    const entrada = [resultado('a1', 'articulo', 'Guía A')]
    expect(hayQueSepararMejores(entrada, entrada)).toBe(false)
  })

  it('sin resultados no hay nada que separar', () => {
    expect(hayQueSepararMejores([], [])).toBe(false)
  })
})

describe('sinLosMejores', () => {
  it('descuenta de los grupos lo que ya subio arriba: nada se pinta dos veces', () => {
    const uno = resultado('a1', 'articulo', 'Guía A')
    const dos = resultado('d1', 'dispositivo', 'Equipo B')
    expect(sinLosMejores([uno, dos], [uno])).toEqual([dos])
  })
})

describe('subtituloConTipo', () => {
  it('antepone el tipo cuando el subtitulo no lo dice', () => {
    expect(subtituloConTipo(resultado('a1', 'articulo', 'X', { subtitulo: 'ICG Manager' }))).toBe(
      'Guía · ICG Manager',
    )
    expect(subtituloConTipo(resultado('c1', 'credencial', 'X', { subtitulo: 'Acceso' }))).toBe(
      'Bóveda · Acceso',
    )
  })

  it('no lo repite cuando el subtitulo ya empieza por el', () => {
    expect(
      subtituloConTipo(resultado('h1', 'herramienta', 'X', { subtitulo: 'Herramienta · Monitoreo' })),
    ).toBe('Herramienta · Monitoreo')
  })

  it('sin subtitulo se queda solo con el tipo', () => {
    expect(subtituloConTipo(resultado('d1', 'dispositivo', 'X'))).toBe('Equipo')
  })

  it('si el tipo ya es un tramo del subtitulo, pasa delante sin repetirse (tarea 263)', () => {
    expect(
      subtituloConTipo(resultado('g1', 'diagnostico', 'X', { subtitulo: 'Impresoras · Guía con preguntas' })),
    ).toBe('Guía con preguntas · Impresoras')
  })
})

// ----------------------------------------------------------------
// RESOLVER ENTIENDE LA INTENCIÓN (tarea 288, fases 4, 6, 7 y 8)
// ----------------------------------------------------------------

// Un resultado con la metadata que anota `buscar`: los campos donde
// coincidió cada palabra que dice algo de la consulta, en orden.
function anotado(
  id: string,
  tipo: TipoResultado,
  titulo: string,
  campos: CampoIndice[][],
  extra: Partial<ResultadoBusqueda> = {},
): ResultadoBusqueda {
  return resultado(id, tipo, titulo, {
    camposPorPalabra: campos,
    camposPorSinonimo: campos.map(() => []),
    camposCoincidentes: [...new Set(campos.flat())],
    puntajeIndice: 1,
    ...extra,
  })
}

const ids = (lista: ResultadoBusqueda[]) => lista.map((r) => r.id)

// El índice de los datos sintéticos del benchmark, para las intenciones
// que se apoyan en lo que el índice encontró.
const indiceBanco = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosBenchmark(false)))
const conEvidencia = (consulta: string) => intencionesDeConsulta(consulta, buscar(indiceBanco, consulta))

describe('intencionesDeConsulta: lo que pide cada familia de consultas (fase 4)', () => {
  it.each([
    'la impresora no imprime',
    'no funciona el escáner',
    'el programa no abre',
    'el wifi no conecta',
    'da error al guardar',
    'está lento el equipo',
    'se bloqueó la cuenta',
    'la impresora no aparece',
    'windows no inicia',
    'el servidor no responde',
    // El "no" al final ya cuenta (antes exigía un espacio detrás).
    'word imprime pero pdf no',
  ])('"%s" es un problema', (consulta) => {
    expect(intencionesDeConsulta(consulta)).toContain('problema')
  })

  it.each([
    'crear usuario',
    'configurar correo',
    'instalar impresora',
    'cambiar tóner',
    'agregar usuario al grupo',
    'conectar impresora de red',
    'actualizar antivirus',
    'restablecer contraseña',
    'montar unidad de red',
    'poner backup del correo',
  ])('"%s" es un procedimiento', (consulta) => {
    expect(intencionesDeConsulta(consulta)).toContain('procedimiento')
  })

  it.each(['clave impresora', 'usuario servidor', 'contraseña', 'PIN', 'credencial del firewall', 'administrador POS'])(
    '"%s" pide un acceso',
    (consulta) => {
      expect(intencionesDeConsulta(consulta)).toContain('acceso')
    },
  )

  it('"usuario" no es un acceso cuando es lo que se crea o quien tiene el problema', () => {
    expect(intencionesDeConsulta('crear usuario nuevo')).toEqual(['procedimiento'])
    expect(intencionesDeConsulta('usuario bloqueado')).toEqual(['problema'])
    // Cambiar una contraseña es un procedimiento sobre ella, no pedirla.
    expect(intencionesDeConsulta('cambiar contraseña del correo')).toEqual(['procedimiento'])
  })

  it.each(['ping', 'ipconfig /all', 'windows r', 'ctrl alt supr', 'alt tab', 'comando para la ip'])(
    '"%s" pide un comando o un atajo',
    (consulta) => {
      expect(intencionesDeConsulta(consulta)).toContain('consola')
    },
  )

  it('"windows 10" no es un atajo: 10 no es una tecla', () => {
    expect(intencionesDeConsulta('instalar windows 10')).not.toContain('consola')
  })

  it.each(['qué es DHCP', 'para qué sirve Zabbix', 'qué significa VLAN'])('"%s" pide información', (consulta) => {
    expect(intencionesDeConsulta(consulta)).toContain('glosario')
  })

  it.each(['10.10.6.8', 'serial ABC123', 'placa 456', 'ip impresora mercadeo', 'impresora taquilla 2'])(
    '"%s" pide un equipo por la forma de lo escrito',
    (consulta) => {
      expect(intencionesDeConsulta(consulta)).toContain('equipo')
    },
  )

  it.each(['impresora mercadeo', 'RICOH MP 501', 'servidor facturación', 'PC contabilidad', 'impresora mercadep'])(
    '"%s" pide un equipo porque coincide de verdad con uno (sin depender de números)',
    (consulta) => {
      expect(conEvidencia(consulta)).toContain('equipo')
    },
  )

  it('sin lo que lo identifica no hay equipo: una clase sola, o una palabra corriente que está en un nombre', () => {
    expect(conEvidencia('impresora')).toEqual([])
    // "archivo" está en "Servidor de archivos", pero la consulta no nombra
    // un servidor: no se lee como ese equipo.
    expect(conEvidencia('no me deja enviar archivo pesado')).toEqual(['problema'])
  })

  it('pueden convivir, y la primera es la que manda: lo que se pide antes que el equipo', () => {
    expect(conEvidencia('la impresora de mercadeo no imprime')).toEqual(['problema', 'equipo'])
    expect(conEvidencia('clave impresora mercadeo')).toEqual(['acceso', 'equipo'])
    expect(PRIORIDAD_INTENCIONES.at(-1)).toBe('equipo')
  })
})

// POR QUÉ PESA LO QUE PESA (fase 6). Cada grupo de pesos de `mejores.ts`
// tiene aquí la prueba que lo exige. Las consultas no llevan palabras de
// intención salvo donde se dice, para medir cada pieza sola.
describe('el ranking: por qué pesa lo que pesa (tarea 288)', () => {
  it('PESO_CAMPO: una palabra en "cuándo usar" pesa más que la misma palabra suelta en un paso', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Guía A', [['texto'], ['texto']]),
      anotado('a2', 'articulo', 'Guía B', [['cuandoUsar'], ['cuandoUsar']]),
    ]
    expect(ids(mejoresResultados(entrada, 'intentos fallidos'))[0]).toBe('a2')
  })

  it('PESO_CAMPO: un síntoma ordena por delante de un paso', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Guía A', [['texto'], ['texto']]),
      anotado('a2', 'articulo', 'Guía B', [['sintomas'], ['sintomas']]),
    ]
    expect(ids(mejoresResultados(entrada, 'hojas manchadas'))[0]).toBe('a2')
  })

  it('PESO_CAMPO: el nombre pesa más que la descripción', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Guía A', [['cuandoUsar'], ['cuandoUsar']]),
      anotado('a2', 'articulo', 'Guía B', [['titulo'], ['titulo']]),
    ]
    expect(ids(mejoresResultados(entrada, 'cola atascada'))[0]).toBe('a2')
  })

  it('PESO_CAMPO: una forma de búsqueda encuentra la guía aunque su nombre no se parezca', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Archivos en la red', [[], ['titulo'], ['texto']]),
      anotado('a2', 'articulo', 'Enviar con OneDrive', [['formasBusqueda'], ['formasBusqueda'], ['formasBusqueda']]),
    ]
    expect(ids(mejoresResultados(entrada, 'mandar archivo pesado'))[0]).toBe('a2')
  })

  it('PESO_CAMPO: la identidad que explica toda la consulta gana a la que la comparte a medias', () => {
    const entrada = [
      anotado('d1', 'dispositivo', 'UPS', [['identidad'], []]),
      anotado('d2', 'dispositivo', 'Lector de huella', [['identidad'], ['identidad']]),
    ]
    const lectura = leerResultados(entrada, 'serial abc123')
    expect(ids(lectura.mejores)[0]).toBe('d2')
    expect(lectura.confianza).toBe('alta')
  })

  it('PESO_SINONIMO_EVIDENCIA: un sinónimo explica a medias; amplía, pero no iguala a lo escrito', () => {
    const porSinonimo = anotado('a2', 'articulo', 'Copia de seguridad del servidor', [[], ['titulo']], {
      camposPorSinonimo: [['titulo'], []],
    })
    const entrada = [
      porSinonimo,
      anotado('a1', 'articulo', 'Backup del servidor', [['titulo'], ['titulo']]),
      anotado('a3', 'articulo', 'Reiniciar el servidor', [[], ['titulo']]),
    ]
    // Lo escrito gana al sinónimo; el sinónimo gana a quien solo comparte
    // la otra palabra.
    expect(ids(mejoresResultados(entrada, 'backup servidor'))).toEqual(['a1', 'a2', 'a3'])
  })

  it('BONO_NOMBRE_EXACTO: el título que ES lo buscado gana a otro que lo explica igual', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Reiniciar la cola de impresión en el servidor', [['titulo'], ['titulo'], ['titulo']]),
      anotado('a2', 'articulo', 'Reiniciar la cola de impresión', [['titulo'], ['titulo'], ['titulo']]),
    ]
    expect(ids(mejoresResultados(entrada, 'reiniciar la cola de impresión'))[0]).toBe('a2')
  })

  it('BONO_NOMBRE_PREFIJO: mientras se escribe, el título que empieza por lo escrito sube', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Cambiar el tóner de la impresora de mercadeo', [['titulo'], ['titulo']]),
      anotado('a2', 'articulo', 'Impresora mercadeo: ajustes de bandeja', [['titulo'], ['titulo']]),
    ]
    expect(ids(mejoresResultados(entrada, 'impresora merc'))[0]).toBe('a2')
  })

  it('BONO_INTENCION_PRINCIPAL: la intención desempata, pero no le gana a explicar una palabra más', () => {
    // "configurar" pide un procedimiento: favorece a las guías.
    const herramienta = anotado('h1', 'herramienta', 'Correo en Outlook', [[], ['titulo'], ['titulo']])
    const guiaQueExplicaMenos = anotado('a1', 'articulo', 'Configurar el escáner', [['titulo'], [], []])
    expect(ids(mejoresResultados([guiaQueExplicaMenos, herramienta], 'configurar correo outlook'))[0]).toBe('h1')
    const guiaQueExplicaTodo = anotado('a2', 'articulo', 'Configurar el correo en Outlook', [
      ['titulo'],
      ['titulo'],
      ['titulo'],
    ])
    expect(ids(mejoresResultados([herramienta, guiaQueExplicaTodo], 'configurar correo outlook'))[0]).toBe('a2')
    // Y a igualdad de evidencia, la que resuelve la intención va primero.
    const empate = [
      anotado('h2', 'herramienta', 'Outlook', [['titulo'], ['titulo'], ['titulo']]),
      anotado('a3', 'articulo', 'Outlook', [['titulo'], ['titulo'], ['titulo']]),
    ]
    expect(ids(mejoresResultados(empate, 'configurar correo outlook'))[0]).toBe('a3')
  })

  it('PUNTOS_INDICE: el puntaje del índice desempata, pero no le gana a una palabra más', () => {
    const empate = [
      anotado('a1', 'articulo', 'Guía A', [['titulo'], ['titulo']], { puntajeIndice: 2 }),
      anotado('a2', 'articulo', 'Guía B', [['titulo'], ['titulo']], { puntajeIndice: 9 }),
    ]
    expect(ids(mejoresResultados(empate, 'alfa beta'))[0]).toBe('a2')
    const masPalabras = [
      anotado('a1', 'articulo', 'Guía A', [['titulo'], []], { puntajeIndice: 50 }),
      anotado('a2', 'articulo', 'Guía B', [['titulo'], ['titulo']], { puntajeIndice: 1 }),
    ]
    expect(ids(mejoresResultados(masPalabras, 'alfa beta'))[0]).toBe('a2')
  })

  it('MAXIMO_POR_CLASE_SIN_INTENCION: sin intención, una sola clase no se lleva los cinco puestos', () => {
    const equipos = Array.from({ length: 5 }, (_, i) => anotado(`d${i}`, 'dispositivo', `Impresora ${i}`, [['titulo']]))
    const guias = [
      anotado('a1', 'articulo', 'Conectar una impresora de red', [['titulo']]),
      anotado('a2', 'articulo', 'Cambiar el tóner de la impresora', [['titulo']]),
    ]
    const mejores = mejoresResultados([...equipos, ...guias], 'impresora')
    expect(mejores.filter((r) => r.tipo === 'dispositivo')).toHaveLength(MAXIMO_POR_CLASE_SIN_INTENCION)
    expect(mejores.filter((r) => r.tipo === 'articulo')).toHaveLength(2)
    // Con una intención, manda la intención: sin reparto.
    const problemas = Array.from({ length: 5 }, (_, i) =>
      anotado(`p${i}`, 'articulo', `Guía de impresora ${i}`, [['titulo'], ['sintomas']]),
    )
    const equiposDelProblema = equipos.map((e) => ({ ...e, camposPorPalabra: [['titulo'], []] as CampoIndice[][] }))
    const conIntencion = mejoresResultados([...problemas, ...equiposDelProblema], 'impresora no imprime')
    expect(conIntencion.every((r) => r.tipo === 'articulo')).toBe(true)
  })
})

describe('consultas mixtas: la solución arriba y el equipo nombrado sigue ahí (fase 7)', () => {
  const mejoresDe = (consulta: string, boveda = false) => {
    const indice = boveda ? crearIndiceDesdeDocumentos(documentosDeBusqueda(datosBenchmark(true))) : indiceBanco
    return ids(mejoresResultados(buscar(indice, consulta), consulta))
  }

  it('"la impresora de mercadeo no imprime": primero una solución, y el equipo de Mercadeo entre los mejores', () => {
    const mejores = mejoresDe('la impresora de mercadeo no imprime')
    expect(['diagnostico:dg-imprime', 'articulo:a-cola', 'articulo:a-pdf']).toContain(mejores[0])
    expect(mejores).toContain('dispositivo:d-imp-mercadeo')
  })

  it('"clave impresora mercadeo": con la Bóveda abierta, la clave de ESE equipo y el equipo', () => {
    expect(mejoresDe('clave impresora mercadeo', true).slice(0, 2)).toEqual([
      'campo:cp-imp-mercadeo',
      'dispositivo:d-imp-mercadeo',
    ])
  })

  it('"clave impresora mercadeo": con la Bóveda cerrada, el equipo, y nada de la Bóveda', () => {
    const mejores = mejoresDe('clave impresora mercadeo')
    expect(mejores[0]).toBe('dispositivo:d-imp-mercadeo')
    expect(mejores.some((id) => id.startsWith('campo:') || id.startsWith('credencial:'))).toBe(false)
  })

  it('las palabras que nombran el equipo no le restan a la solución, aunque sean varias', () => {
    // Palabras: impresora, mercadeo, segundo, piso, imprime. El equipo
    // explica casi todo (su nombre y su lugar); la guía, el problema entero.
    const equipo = anotado('d1', 'dispositivo', 'Impresora Mercadeo', [
      ['titulo'],
      ['titulo', 'identidad'],
      ['identidad'],
      ['identidad'],
      ['texto'],
    ])
    const solucion = anotado('g1', 'diagnostico', 'La impresora no imprime', [['titulo'], [], [], [], ['titulo']])
    const lectura = leerResultados([equipo, solucion], 'la impresora de mercadeo segundo piso no imprime')
    expect(lectura.intenciones).toEqual(['problema', 'equipo'])
    expect(ids(lectura.mejores)).toEqual(['g1', 'd1'])
  })

  it('el equipo pedido, no cualquier equipo: las impresoras ajenas no tapan la guía de ESA impresora', () => {
    const mejores = mejoresDe('impresora mercadeo')
    expect(mejores[0]).toBe('dispositivo:d-imp-mercadeo')
    expect(mejores).toContain('articulo:a-toner')
    expect(mejores).not.toContain('dispositivo:d-imp-caja1')
  })
})

describe('la regla de confianza: "Mejor coincidencia" solo con una opción claramente superior (fase 8)', () => {
  // "alfa beta" no lleva palabras de intención y los títulos no son la
  // consulta: la diferencia entre los dos sale solo de la evidencia.
  it('la frontera es lo que vale explicar una palabra más en un campo muy fuerte: 100 / palabras', () => {
    const justo = [
      anotado('a1', 'articulo', 'Guía A', [['titulo'], ['titulo']]),
      anotado('a2', 'articulo', 'Guía B', [['titulo'], ['subtitulo']]),
    ]
    // Ventaja: 100 - 75 = 25 < 50. Cerca.
    expect(confianzaDeResultados(justo, 'alfa beta')).toBe('cercana')
    const unaPalabraMas = [
      anotado('a1', 'articulo', 'Guía A', [['titulo'], ['titulo']]),
      anotado('a2', 'articulo', 'Guía B', [['titulo'], []]),
    ]
    // Ventaja: 100 - 50 = 50, justo una palabra de dos. Claramente superior.
    expect(confianzaDeResultados(unaPalabraMas, 'alfa beta')).toBe('alta')
  })

  it('dos opciones que explican toda la consulta: no se finge certeza', () => {
    const entrada = [
      anotado('g1', 'diagnostico', 'La impresora no imprime', [['titulo'], ['titulo']]),
      anotado('a1', 'articulo', 'Reiniciar la cola de impresión', [['formasBusqueda'], ['formasBusqueda']]),
    ]
    expect(confianzaDeResultados(entrada, 'impresora no imprime')).toBe('cercana')
  })

  it('el primero tiene que explicar TODAS las palabras, aunque lleve mucha ventaja', () => {
    const entrada = [
      anotado('a1', 'articulo', 'Guía A', [['titulo'], ['titulo'], []]),
      anotado('a2', 'articulo', 'Guía B', [['texto'], [], []]),
    ]
    expect(confianzaDeResultados(entrada, 'alfa beta gamma')).toBe('cercana')
  })

  it('lo que solo trae un sinónimo nunca es la mejor coincidencia', () => {
    const entrada = [anotado('a1', 'articulo', 'Guía A', [[]], { soloSinonimo: true, camposPorSinonimo: [['titulo']] })]
    expect(confianzaDeResultados(entrada, 'alfa')).toBe('cercana')
  })

  it('una palabra genérica no tiene ganador claro: "impresora" sigue siendo "Mejores resultados"', () => {
    const resultados = buscar(indiceBanco, 'impresora')
    expect(confianzaDeResultados(resultados, 'impresora')).toBe('cercana')
    expect(confianzaDeResultados(buscar(indiceBanco, 'correo'), 'correo')).toBe('cercana')
  })

  it('una consulta que identifica una sola cosa sí la tiene', () => {
    for (const consulta of ['10.10.6.8', 'impresora mercadeo', 'qué es DHCP', 'serial ABC123']) {
      expect({ consulta, confianza: confianzaDeResultados(buscar(indiceBanco, consulta), consulta) }).toEqual({
        consulta,
        confianza: 'alta',
      })
    }
  })
})
