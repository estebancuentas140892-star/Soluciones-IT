import { describe, expect, it } from 'vitest'
import type { NodoDiagnostico, OpcionDiagnostico } from './db'
import {
  crearNodo,
  duplicarNodo,
  normalizarNodos,
  porcentajeDiagnostico,
  prepararNodosParaGuardar,
  profundidadRestante,
  textoDeNodos,
  validarNodos,
} from './diagnostico'

function opcion(cambios: Partial<OpcionDiagnostico> & { id: string; etiqueta: string }): OpcionDiagnostico {
  return {
    siguienteNodoId: null,
    articuloId: null,
    articuloTitulo: '',
    mensajeFinal: '',
    ...cambios,
  }
}

function nodo(cambios: Partial<NodoDiagnostico> & { id: string; pregunta: string }): NodoDiagnostico {
  return { tituloInterno: '', descripcion: '', opciones: [], ...cambios }
}

// Arbol de los ejemplos del usuario: ¿encendida? -> ¿instalada? -> fin.
function arbolImpresora(): NodoDiagnostico[] {
  return [
    nodo({
      id: 'n1',
      pregunta: '¿La impresora está encendida?',
      opciones: [
        opcion({ id: 'o1', etiqueta: 'Sí', siguienteNodoId: 'n2' }),
        opcion({ id: 'o2', etiqueta: 'No', mensajeFinal: 'Enciéndela y prueba de nuevo.' }),
      ],
    }),
    nodo({
      id: 'n2',
      pregunta: '¿Aparece instalada en Windows?',
      opciones: [
        opcion({ id: 'o3', etiqueta: 'Sí', mensajeFinal: 'Imprime una página de prueba.' }),
        opcion({
          id: 'o4',
          etiqueta: 'No',
          articuloId: 'art-1',
          articuloTitulo: 'Conectar impresora a computadora',
          siguienteNodoId: 'n3',
        }),
      ],
    }),
    nodo({
      id: 'n3',
      pregunta: '¿Ya imprime la página de prueba?',
      opciones: [
        opcion({ id: 'o5', etiqueta: 'Sí', mensajeFinal: 'Problema resuelto.' }),
        opcion({ id: 'o6', etiqueta: 'No', articuloId: 'art-2', articuloTitulo: 'Revisar el spooler' }),
      ],
    }),
  ]
}

describe('crearNodo', () => {
  it('arranca con Sí y No prefilladas', () => {
    const nuevo = crearNodo()
    expect(nuevo.opciones.map((o) => o.etiqueta)).toEqual(['Sí', 'No'])
    expect(nuevo.opciones[0].id).not.toBe(nuevo.opciones[1].id)
  })

  it('arranca sin título interno', () => {
    expect(crearNodo().tituloInterno).toBe('')
  })
})

describe('duplicarNodo', () => {
  it('copia el nodo y sus opciones con ids nuevos, conservando el contenido', () => {
    const [original] = arbolImpresora()
    const copia = duplicarNodo(original)

    expect(copia.id).not.toBe(original.id)
    expect(copia.pregunta).toBe(original.pregunta)
    expect(copia.opciones).toHaveLength(original.opciones.length)
    copia.opciones.forEach((opcionCopiada, i) => {
      expect(opcionCopiada.id).not.toBe(original.opciones[i].id)
      expect(opcionCopiada.etiqueta).toBe(original.opciones[i].etiqueta)
      // Los destinos SALIENTES se conservan: siguen siendo la
      // continuacion logica correcta del arbol.
      expect(opcionCopiada.siguienteNodoId).toBe(original.opciones[i].siguienteNodoId)
    })
  })

  it('agrega "(copia)" al título interno si tenía uno, y lo deja vacío si no', () => {
    const conTitulo = duplicarNodo({ ...crearNodo(), tituloInterno: 'Verificar alimentación' })
    expect(conTitulo.tituloInterno).toBe('Verificar alimentación (copia)')

    const sinTitulo = duplicarNodo(crearNodo())
    expect(sinTitulo.tituloInterno).toBe('')
  })
})

describe('normalizarNodos', () => {
  it('devuelve vacío para datos que no son una lista', () => {
    expect(normalizarNodos(null)).toEqual([])
    expect(normalizarNodos('texto')).toEqual([])
    expect(normalizarNodos({})).toEqual([])
  })

  it('conserva un árbol bien formado tal cual', () => {
    expect(normalizarNodos(arbolImpresora())).toEqual(arbolImpresora())
  })

  it('conserva el título interno y lo completa vacío cuando falta', () => {
    const conTitulo = normalizarNodos([{ id: 'n1', pregunta: 'x', tituloInterno: 'Verificar alimentación' }])
    expect(conTitulo[0].tituloInterno).toBe('Verificar alimentación')

    const sinTitulo = normalizarNodos([{ id: 'n1', pregunta: 'x' }])
    expect(sinTitulo[0].tituloInterno).toBe('')
  })

  it('completa los campos faltantes y descarta basura', () => {
    const resultado = normalizarNodos([
      { pregunta: 'Solo pregunta', opciones: [{ etiqueta: 'Sí' }, 'no es objeto'] },
      'no es objeto',
    ])
    expect(resultado).toHaveLength(1)
    expect(resultado[0].pregunta).toBe('Solo pregunta')
    expect(resultado[0].id).not.toBe('')
    expect(resultado[0].opciones).toHaveLength(1)
    expect(resultado[0].opciones[0]).toMatchObject({
      etiqueta: 'Sí',
      siguienteNodoId: null,
      articuloId: null,
      articuloTitulo: '',
      mensajeFinal: '',
    })
  })

  it('descarta el título de referencia sin id y el mensaje final de una rama que continúa', () => {
    const resultado = normalizarNodos([
      {
        id: 'n1',
        pregunta: 'x',
        opciones: [
          { id: 'o1', etiqueta: 'a', articuloTitulo: 'huérfano' },
          { id: 'o2', etiqueta: 'b', siguienteNodoId: 'n1', mensajeFinal: 'no aplica' },
        ],
      },
    ])
    expect(resultado[0].opciones[0].articuloTitulo).toBe('')
    expect(resultado[0].opciones[1].mensajeFinal).toBe('')
  })
})

describe('validarNodos', () => {
  it('acepta el árbol de ejemplo sin problemas', () => {
    expect(validarNodos(arbolImpresora())).toEqual([])
  })

  it('exige al menos una pregunta', () => {
    expect(validarNodos([])).toEqual(['El diagnóstico necesita al menos una pregunta.'])
  })

  it('detecta preguntas sin texto y sin respuestas', () => {
    const problemas = validarNodos([nodo({ id: 'n1', pregunta: '  ' })])
    expect(problemas.some((p) => p.includes('no tiene texto'))).toBe(true)
    expect(problemas.some((p) => p.includes('no tiene respuestas'))).toBe(true)
  })

  it('detecta una respuesta que no lleva a ninguna parte', () => {
    const problemas = validarNodos([
      nodo({ id: 'n1', pregunta: 'x', opciones: [opcion({ id: 'o1', etiqueta: 'Sí' })] }),
    ])
    expect(problemas.some((p) => p.includes('no lleva a ninguna parte'))).toBe(true)
  })

  it('detecta destinos rotos y auto referencias', () => {
    const problemas = validarNodos([
      nodo({
        id: 'n1',
        pregunta: 'x',
        opciones: [
          opcion({ id: 'o1', etiqueta: 'a', siguienteNodoId: 'no-existe' }),
          opcion({ id: 'o2', etiqueta: 'b', siguienteNodoId: 'n1' }),
        ],
      }),
    ])
    expect(problemas.some((p) => p.includes('ya no existe'))).toBe(true)
    expect(problemas.some((p) => p.includes('su propia pregunta'))).toBe(true)
  })

  it('detecta ciclos entre preguntas', () => {
    const problemas = validarNodos([
      nodo({ id: 'n1', pregunta: 'a', opciones: [opcion({ id: 'o1', etiqueta: 'Sí', siguienteNodoId: 'n2' })] }),
      nodo({ id: 'n2', pregunta: 'b', opciones: [opcion({ id: 'o2', etiqueta: 'Sí', siguienteNodoId: 'n1' })] }),
    ])
    expect(problemas.some((p) => p.includes('ciclo'))).toBe(true)
  })

  it('detecta preguntas inalcanzables desde la primera', () => {
    const problemas = validarNodos([
      nodo({ id: 'n1', pregunta: 'a', opciones: [opcion({ id: 'o1', etiqueta: 'Fin', mensajeFinal: 'ok' })] }),
      nodo({ id: 'n2', pregunta: 'suelta', opciones: [opcion({ id: 'o2', etiqueta: 'Fin', mensajeFinal: 'ok' })] }),
    ])
    expect(problemas.some((p) => p.includes('no se puede alcanzar'))).toBe(true)
  })
})

describe('prepararNodosParaGuardar', () => {
  it('recorta espacios y descarta opciones sin etiqueta', () => {
    const preparados = prepararNodosParaGuardar([
      nodo({
        id: 'n1',
        pregunta: '  ¿Está encendida?  ',
        opciones: [
          opcion({ id: 'o1', etiqueta: '  Sí  ', mensajeFinal: ' listo ' }),
          opcion({ id: 'o2', etiqueta: '   ' }),
        ],
      }),
    ])
    expect(preparados[0].pregunta).toBe('¿Está encendida?')
    expect(preparados[0].opciones).toHaveLength(1)
    expect(preparados[0].opciones[0].mensajeFinal).toBe('listo')
  })

  it('recorta espacios del título interno', () => {
    const preparados = prepararNodosParaGuardar([
      nodo({ id: 'n1', pregunta: 'x', tituloInterno: '  Verificar alimentación  ' }),
    ])
    expect(preparados[0].tituloInterno).toBe('Verificar alimentación')
  })
})

describe('profundidadRestante y porcentaje', () => {
  it('mide el camino más largo desde un nodo', () => {
    const nodos = arbolImpresora()
    expect(profundidadRestante(nodos, 'n3')).toBe(1)
    expect(profundidadRestante(nodos, 'n2')).toBe(2)
    expect(profundidadRestante(nodos, 'n1')).toBe(3)
  })

  it('corta los ciclos sin colgarse', () => {
    const conCiclo = [
      nodo({ id: 'n1', pregunta: 'a', opciones: [opcion({ id: 'o1', etiqueta: 'Sí', siguienteNodoId: 'n2' })] }),
      nodo({ id: 'n2', pregunta: 'b', opciones: [opcion({ id: 'o2', etiqueta: 'Sí', siguienteNodoId: 'n1' })] }),
    ]
    expect(profundidadRestante(conCiclo, 'n1')).toBe(2)
  })

  it('el porcentaje avanza al responder y llega a 100 en el final', () => {
    const nodos = arbolImpresora()
    const paso = { nodoId: 'n1', pregunta: 'x', opcionId: 'o1', etiqueta: 'Sí' }
    const alInicio = porcentajeDiagnostico(nodos, [], { tipo: 'pregunta', nodoId: 'n1' })
    const trasUna = porcentajeDiagnostico(nodos, [paso], { tipo: 'pregunta', nodoId: 'n2' })
    expect(alInicio).toBe(0)
    expect(trasUna).toBeGreaterThan(alInicio)
    expect(trasUna).toBeLessThan(100)
    expect(
      porcentajeDiagnostico(nodos, [paso], { tipo: 'final', mensajeFinal: 'ok', articuloId: null, articuloTitulo: '' }),
    ).toBe(100)
  })

  it('ejecutando el procedimiento de una rama terminal se acerca al final sin llegar a 100', () => {
    const nodos = arbolImpresora()
    const camino = [
      { nodoId: 'n1', pregunta: 'x', opcionId: 'o1', etiqueta: 'Sí' },
      { nodoId: 'n2', pregunta: 'y', opcionId: 'o3', etiqueta: 'Sí' },
    ]
    const pct = porcentajeDiagnostico(nodos, camino, {
      tipo: 'articulo',
      articuloId: 'art-2',
      articuloTitulo: 'Revisar el spooler',
      siguienteNodoId: null,
      mensajeFinal: '',
    })
    expect(pct).toBeGreaterThan(50)
    expect(pct).toBeLessThan(100)
  })
})

describe('textoDeNodos', () => {
  it('junta preguntas, respuestas y títulos vinculados para la búsqueda', () => {
    const texto = textoDeNodos(arbolImpresora())
    expect(texto).toContain('¿La impresora está encendida?')
    expect(texto).toContain('Conectar impresora a computadora')
    expect(texto).toContain('Enciéndela y prueba de nuevo.')
  })
})
