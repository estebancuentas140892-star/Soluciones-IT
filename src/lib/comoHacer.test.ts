import { describe, expect, it } from 'vitest'
import {
  admiteComoHacer,
  AVISO_UNA_SOLA_MICROACCION,
  camposQueFaltan,
  comoHacerDe,
  comoHacerQueSeEnsena,
  crearMicroPaso,
  fraseDeMicroPaso,
  llevaPuntoFinal,
  mensajeProblemaComoHacer,
  normalizarComoHacer,
  pasoAPasoAportaAlgo,
  problemasDeComoHacer,
  textoDeLoQueFalta,
  textoPasoAPaso,
  tieneUnaSolaMicroaccion,
} from './comoHacer'
import type { BloquePaso, MicroPasoComoHacer, PasoProcedimiento } from './db'
import {
  CAMPOS_BLOQUE_VACIOS,
  duplicarProcedimiento,
  normalizarProcedimiento,
  prepararProcedimientoParaGuardar,
  textoDeProcedimiento,
} from './procedimiento'

// EL CONTRATO DE "CÓMO HACERLO" (tarea 303): una lista de microacciones
// (`MicroPasoComoHacer`) en el bloque 'tarea' de tipo 'accion', dentro del
// JSON `procedimiento`. Opcional, ausente cuando no hay ninguna (nunca se
// guarda `[]`), con ids estables, conservada al normalizar, guardar y volver
// a leer, y sin tocar nada de una guía que no la usa. Cada microacción
// necesita acción Y elemento (la ubicación es opcional): una a medias no se
// lee ni se guarda como válida, y nada inventa el campo que falta. Nada se
// deduce del texto. Todo lo sembrado es inventado: el caso del encargo.

const FICHERO: MicroPasoComoHacer = { id: 'm1', accion: 'Abre', elemento: 'Fichero', ubicacion: 'Barra superior' }
const CLIENTE: MicroPasoComoHacer = { id: 'm2', accion: 'Selecciona', elemento: 'Cliente' }
const FICHERO_OTRA_VEZ: MicroPasoComoHacer = { id: 'm3', accion: 'Abre', elemento: 'Fichero' }
const NUEVO: MicroPasoComoHacer = { id: 'm4', accion: 'Selecciona', elemento: 'Nuevo' }
const CASO_DEL_ENCARGO = [FICHERO, CLIENTE, FICHERO_OTRA_VEZ, NUEVO]

function tarea(id: string, texto: string, cambios: Partial<BloquePaso> = {}): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'accion', ...cambios }
}

function paso(bloques: BloquePaso[], id = 'p1'): PasoProcedimiento {
  return {
    id,
    titulo: 'Crear el registro de ejemplo',
    objetivo: '',
    lugar: 'Aplicación de ejemplo',
    resultado: 'El formulario queda abierto',
    bloques,
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

function preparar(pasos: PasoProcedimiento[]) {
  return prepararProcedimientoParaGuardar({
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitosTexto: '',
    pasos,
    verificacionFinalTexto: '',
    tiempoEstimadoMin: null,
    dificultad: null,
  })
}

/** Los bloques del primer paso de un JSON, tal como quedan tras normalizar. */
function bloquesNormalizados(bloques: unknown[]): BloquePaso[] {
  return normalizarProcedimiento({ pasos: [{ id: 'p1', titulo: 'Paso de ejemplo', bloques }] })?.pasos[0]?.bloques ?? []
}

/** Una tarea de acción en JSON crudo, como llega de Supabase. */
function tareaCruda(comoHacer: unknown, cambios: Record<string, unknown> = {}) {
  return { id: 't1', tipo: 'tarea', texto: 'Abre un registro nuevo', tipoTarea: 'accion', comoHacer, ...cambios }
}

describe('una guía de antes, sin "Cómo hacerlo"', () => {
  it('se lee exactamente igual: ninguna tarea gana la clave', () => {
    // El JSON como lo guardaba la app antes del campo.
    const antigua = {
      pasos: [
        {
          id: 'p1',
          titulo: 'Abrir la configuración de prueba',
          bloques: [
            { id: 't1', tipo: 'tarea', texto: 'Abre la sección de conexiones', tipoTarea: 'accion' },
            { id: 't2', tipo: 'tarea', texto: 'Abre la sección vieja sin tipo' },
            { id: 't3', tipo: 'tarea', texto: '¿Aparece el adaptador?', tipoTarea: 'decision' },
            { id: 'a1', tipo: 'aviso', texto: 'Nota de prueba', tono: 'info', alcance: 'tarea', tareaId: 't1' },
          ],
        },
      ],
    }
    const normalizado = normalizarProcedimiento(antigua)
    for (const bloque of normalizado?.pasos[0].bloques ?? []) expect('comoHacer' in bloque).toBe(false)
    expect(JSON.stringify(normalizado)).not.toContain('comoHacer')
  })

  it('guardarla tampoco la escribe, y releerla da lo mismo', () => {
    const guardado = preparar([paso([tarea('t1', 'Abre la sección de conexiones')])])
    expect(JSON.stringify(guardado)).not.toContain('comoHacer')
    expect(normalizarProcedimiento(JSON.parse(JSON.stringify(guardado)))).toEqual(guardado)
  })
})

describe('normalizar las microacciones', () => {
  it('conserva una sola microacción tal como se escribió', () => {
    const [bloque] = bloquesNormalizados([tareaCruda([{ id: 'm1', accion: 'Abre', elemento: 'Fichero' }])])
    expect(bloque.comoHacer).toEqual([{ id: 'm1', accion: 'Abre', elemento: 'Fichero' }])
  })

  it('acción, elemento y ubicación: válida, con su ubicación', () => {
    const [bloque] = bloquesNormalizados([tareaCruda([{ id: 'm1', accion: 'Abre', elemento: 'Fichero', ubicacion: 'Barra superior' }])])
    expect(bloque.comoHacer).toEqual([{ id: 'm1', accion: 'Abre', elemento: 'Fichero', ubicacion: 'Barra superior' }])
  })

  it('sin acción, sin elemento o sin los dos, la microacción no vale y se descarta; nada se inventa', () => {
    for (const aMedias of [
      { id: 'x', accion: '', elemento: 'Fichero' },
      { id: 'x', accion: '   ', elemento: 'Fichero', ubicacion: 'Barra superior' },
      { id: 'x', elemento: 'Fichero' },
      { id: 'x', accion: 'Abre', elemento: '' },
      { id: 'x', accion: 'Abre', elemento: '  ', ubicacion: 'Barra superior' },
      { id: 'x', accion: 'Abre' },
      { id: 'x', accion: '', elemento: '' },
      { id: 'x', accion: '', elemento: '', ubicacion: 'Barra superior' },
    ]) {
      const [bloque] = bloquesNormalizados([tareaCruda([aMedias])])
      // Sin ninguna válida, la clave ni aparece.
      expect('comoHacer' in bloque).toBe(false)
      expect(bloque.texto).toBe('Abre un registro nuevo')
    }
  })

  it('conserva varias, en su orden y con sus ids', () => {
    const [bloque] = bloquesNormalizados([tareaCruda(CASO_DEL_ENCARGO)])
    expect(bloque.comoHacer).toEqual(CASO_DEL_ENCARGO)
  })

  it('la ubicación es opcional: sin ella, vacía o que no es texto, la clave no aparece', () => {
    for (const ubicacion of [undefined, '', '   ', null, 4, { texto: 'Barra superior' }]) {
      const [bloque] = bloquesNormalizados([tareaCruda([{ id: 'm1', accion: 'Abre', elemento: 'Fichero', ubicacion }])])
      expect(bloque.comoHacer).toHaveLength(1)
      expect('ubicacion' in (bloque.comoHacer?.[0] ?? {})).toBe(false)
    }
  })

  it('el texto se conserva como se escribió: se recorta al guardar, no al leer', () => {
    const [bloque] = bloquesNormalizados([tareaCruda([{ id: 'm1', accion: ' Abre ', elemento: 'Fichero ', ubicacion: ' Barra superior' }])])
    expect(bloque.comoHacer).toEqual([{ id: 'm1', accion: ' Abre ', elemento: 'Fichero ', ubicacion: ' Barra superior' }])
  })

  it('lo que no es una lista no se convierte en nada, tampoco un texto con flechas (la forma descartada)', () => {
    for (const comoHacer of ['Fichero → Cliente → Nuevo', 'Fichero > Cliente', 7, true, null, { accion: 'Abre', elemento: 'Fichero' }]) {
      const [bloque] = bloquesNormalizados([tareaCruda(comoHacer)])
      expect('comoHacer' in bloque).toBe(false)
    }
  })

  it('una lista vacía no escribe la clave', () => {
    const [bloque] = bloquesNormalizados([tareaCruda([])])
    expect('comoHacer' in bloque).toBe(false)
  })

  it('descarta con seguridad lo inválido y conserva lo demás, sin romper la guía', () => {
    const [bloque] = bloquesNormalizados([
      tareaCruda([
        null,
        'Abre Fichero',
        42,
        ['Abre', 'Fichero'],
        { id: 'vacia', accion: '', elemento: '   ' },
        { id: 'solo-ubicacion', ubicacion: 'Barra superior' },
        { id: 'no-texto', accion: 3, elemento: { nombre: 'Fichero' } },
        { id: 'm1', accion: 'Abre', elemento: 'Fichero' },
        { id: 'solo-accion', accion: 'Reinicia', elemento: null },
        { id: 'solo-elemento', elemento: 'Enter' },
        { id: 'm2', accion: 'Selecciona', elemento: 'Nuevo' },
      ]),
    ])
    expect(bloque.texto).toBe('Abre un registro nuevo')
    // Solo las completas, en su orden y con sus ids de siempre.
    expect(bloque.comoHacer).toEqual([
      { id: 'm1', accion: 'Abre', elemento: 'Fichero' },
      { id: 'm2', accion: 'Selecciona', elemento: 'Nuevo' },
    ])
  })

  it('solo en una tarea de acción: en una comprobación, una decisión o un aviso no se conserva', () => {
    const bloques = bloquesNormalizados([
      tareaCruda(CASO_DEL_ENCARGO, { id: 'accion' }),
      tareaCruda(CASO_DEL_ENCARGO, { id: 'sin-tipo', tipoTarea: undefined }),
      tareaCruda(CASO_DEL_ENCARGO, { id: 'comprobacion', tipoTarea: 'verificacion' }),
      tareaCruda(CASO_DEL_ENCARGO, { id: 'si-no', tipoTarea: 'decision' }),
      tareaCruda(CASO_DEL_ENCARGO, {
        id: 'con-opciones',
        tipoTarea: 'decision',
        opciones: [
          { id: 'o1', titulo: 'Versión A', descripcion: '', destino: { tipo: 'continuar' } },
          { id: 'o2', titulo: 'Versión B', descripcion: '', destino: { tipo: 'fin' } },
        ],
      }),
      { id: 'a1', tipo: 'aviso', texto: 'Nota de ejemplo', tono: 'info', alcance: 'tarea', tareaId: 'accion', comoHacer: CASO_DEL_ENCARGO },
    ])
    expect(bloques.map((b) => [b.id, 'comoHacer' in b])).toEqual([
      ['accion', true],
      // Una tarea sin tipo es una acción (la clasificación es posterior).
      ['sin-tipo', true],
      ['comprobacion', false],
      ['si-no', false],
      ['con-opciones', false],
      ['a1', false],
    ])
    // Las opciones de la decisión siguen intactas (tarea 302).
    expect(bloques[4].opciones?.map((o) => o.titulo)).toEqual(['Versión A', 'Versión B'])
  })

  it('no deduce microacciones del texto de la tarea, aunque traiga flechas', () => {
    const bloques = bloquesNormalizados([
      { id: 't1', tipo: 'tarea', texto: 'Fichero → Cliente → Fichero → Nuevo', tipoTarea: 'accion' },
      { id: 't2', tipo: 'tarea', texto: 'Abre Fichero > Cliente > Nuevo', tipoTarea: 'accion' },
    ])
    expect(bloques.every((b) => !('comoHacer' in b))).toBe(true)
  })
})

describe('ids estables', () => {
  it('normalizar no cambia los ids declarados, ni la primera vez ni las siguientes', () => {
    const una = normalizarComoHacer(CASO_DEL_ENCARGO)
    const otra = normalizarComoHacer(JSON.parse(JSON.stringify(una)))
    expect(una.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(otra.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('un id que falta o que se repite se renueva; los demás no se tocan', () => {
    const lista = normalizarComoHacer([
      { id: 'm1', accion: 'Abre', elemento: 'Fichero' },
      { accion: 'Selecciona', elemento: 'Cliente' },
      { id: 'm1', accion: 'Abre', elemento: 'Fichero' },
      { id: '', accion: 'Selecciona', elemento: 'Nuevo' },
    ])
    expect(lista[0].id).toBe('m1')
    const ids = lista.map((m) => m.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids.slice(1).every((id) => id !== '' && id !== 'm1')).toBe(true)
  })

  it('descartar una a medias no toca los ids de las demás', () => {
    const lista = normalizarComoHacer([FICHERO, { id: 'a-medias', accion: 'Abre', elemento: '' }, CLIENTE, NUEVO])
    expect(lista.map((m) => m.id)).toEqual(['m1', 'm2', 'm4'])
  })

  it('una microacción nueva nace vacía y con su propio id', () => {
    const una = crearMicroPaso()
    const otra = crearMicroPaso()
    expect(una).toEqual({ id: una.id, accion: '', elemento: '' })
    expect(una.id).not.toBe(otra.id)
  })
})

describe('guardar y volver a abrir', () => {
  it('se guarda dentro de la tarea y vuelve igual al leerla, y guardarla otra vez no la cambia', () => {
    const guardado = preparar([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: CASO_DEL_ENCARGO })])])
    expect(guardado?.pasos[0].bloques[0].comoHacer).toEqual(CASO_DEL_ENCARGO)
    // Como viaja a Supabase y vuelve: texto JSON y normalizador.
    const releido = normalizarProcedimiento(JSON.parse(JSON.stringify(guardado)))
    expect(releido?.pasos[0].bloques[0].comoHacer).toEqual(CASO_DEL_ENCARGO)
    expect(preparar(releido?.pasos ?? [])).toEqual(guardado)
  })

  it('recorta cada campo, quita la ubicación vacía y descarta las filas vacías, sin tocar ids ni orden', () => {
    const guardado = preparar([
      paso([
        tarea('t1', 'Abre un registro nuevo', {
          comoHacer: [
            { id: 'm1', accion: '  Abre ', elemento: ' Fichero  ', ubicacion: '  Barra superior ' },
            { id: 'vacia', accion: '  ', elemento: '' },
            { id: 'm2', accion: 'Selecciona', elemento: 'Cliente', ubicacion: '   ' },
          ],
        }),
      ]),
    ])
    expect(guardado?.pasos[0].bloques[0].comoHacer).toEqual([
      { id: 'm1', accion: 'Abre', elemento: 'Fichero', ubicacion: 'Barra superior' },
      { id: 'm2', accion: 'Selecciona', elemento: 'Cliente' },
    ])
  })

  it('vacía no se serializa: ni `[]`, ni filas vacías, ni la clave sin valor', () => {
    for (const comoHacer of [[], [{ id: 'm1', accion: ' ', elemento: '' }], undefined]) {
      const guardado = preparar([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer })])])
      expect('comoHacer' in (guardado?.pasos[0].bloques[0] ?? {})).toBe(false)
      expect(JSON.stringify(guardado)).not.toContain('comoHacer')
    }
  })

  it('una microacción a medias nunca se guarda como válida (el editor no deja llegar hasta aquí)', () => {
    const guardado = preparar([
      paso([
        tarea('t1', 'Abre un registro nuevo', {
          comoHacer: [CLIENTE, { id: 'sin-elemento', accion: 'Abre', elemento: '' }, { id: 'sin-accion', accion: '', elemento: 'Nuevo' }],
        }),
      ]),
    ])
    expect(guardado?.pasos[0].bloques[0].comoHacer).toEqual([CLIENTE])
  })

  it('una tarea que no es de acción no lo guarda', () => {
    const guardado = preparar([
      paso([
        tarea('t1', 'Comprueba el registro', { tipoTarea: 'verificacion', comoHacer: CASO_DEL_ENCARGO }),
        { ...CAMPOS_BLOQUE_VACIOS, id: 'a1', tipo: 'aviso', texto: 'Nota', tono: 'info', alcance: 'tarea', tareaId: 't1', comoHacer: CASO_DEL_ENCARGO },
      ]),
    ])
    expect(JSON.stringify(guardado)).not.toContain('comoHacer')
  })

  it('una decisión con opciones sigue guardándose igual al lado de una acción con microacciones (tarea 302)', () => {
    const decision = tarea('t2', '¿Qué versión de ejemplo usas?', {
      tipoTarea: 'decision',
      opciones: [
        { id: 'o1', titulo: 'Versión A', descripcion: '', destino: { tipo: 'continuar' } },
        { id: 'o2', titulo: 'Versión B', descripcion: '', destino: { tipo: 'fin' } },
      ],
    })
    const bloques = preparar([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: [CLIENTE] }), decision])])?.pasos[0].bloques
    expect(bloques?.[0].comoHacer).toEqual([CLIENTE])
    expect(bloques?.[1].opciones).toHaveLength(2)
    expect('comoHacer' in (bloques?.[1] ?? {})).toBe(false)
  })
})

describe('comoHacerDe: lo que se enseña', () => {
  it('las microacciones limpias de una acción', () => {
    const bloque = tarea('t1', 'Abre un registro nuevo', {
      comoHacer: [{ id: 'm1', accion: ' Abre ', elemento: 'Fichero ', ubicacion: ' ' }, { id: 'm2', accion: '', elemento: '' }],
    })
    expect(comoHacerDe(bloque)).toEqual([{ id: 'm1', accion: 'Abre', elemento: 'Fichero' }])
  })

  it('solo las completas: una fila a medias del editor no se enseña (tampoco en "Probar")', () => {
    const bloque = tarea('t1', 'Abre un registro nuevo', {
      comoHacer: [
        { id: 'sin-elemento', accion: 'Reinicia', elemento: '' },
        FICHERO,
        { id: 'sin-accion', accion: '', elemento: 'Ayuda', ubicacion: 'Barra superior' },
      ],
    })
    expect(comoHacerDe(bloque)).toEqual([FICHERO])
  })

  it('vacío en todo lo demás', () => {
    expect(comoHacerDe(tarea('t1', 'Abre un registro nuevo'))).toEqual([])
    expect(comoHacerDe(tarea('t1', 'Comprueba', { tipoTarea: 'verificacion', comoHacer: CASO_DEL_ENCARGO }))).toEqual([])
    expect(comoHacerDe(tarea('t1', '¿Sí o no?', { tipoTarea: 'decision', comoHacer: CASO_DEL_ENCARGO }))).toEqual([])
    expect(comoHacerDe({ ...CAMPOS_BLOQUE_VACIOS, id: 'a1', tipo: 'aviso', texto: 'Nota', comoHacer: CASO_DEL_ENCARGO })).toEqual([])
  })

  it('una tarea sin tipo es una acción', () => {
    expect(admiteComoHacer({ tipo: 'tarea', tipoTarea: null })).toBe(true)
    expect(admiteComoHacer({ tipo: 'tarea', tipoTarea: 'verificacion' })).toBe(false)
    expect(admiteComoHacer({ tipo: 'aviso', tipoTarea: null })).toBe(false)
  })
})

describe('un contenido, dos lecturas', () => {
  /**
   * La ruta rápida de una acción tal como la enseña `ComoHacerlo` (tarea 309):
   * lo que se enseña, cada microacción con su frase, en orden.
   */
  const rutaDe = (comoHacer: MicroPasoComoHacer[]) =>
    comoHacerQueSeEnsena(comoHacerDe(tarea('t1', 'Abre un registro nuevo', { comoHacer })))
      .map(fraseDeMicroPaso)
      .join(' › ')

  it('la ruta rápida del encargo: cada microacción con su verbo, en orden', () => {
    expect(rutaDe(CASO_DEL_ENCARGO)).toBe('Abre Fichero › Selecciona Cliente › Abre Fichero › Selecciona Nuevo')
  })

  it('el atajo de ejemplo también es una ruta ejecutable', () => {
    const atajo = [
      { id: 'a', accion: 'Pulsa', elemento: 'Windows + R' },
      { id: 'b', accion: 'Escribe', elemento: 'comando-ejemplo' },
      { id: 'c', accion: 'Pulsa', elemento: 'Enter' },
    ]
    expect(rutaDe(atajo)).toBe('Pulsa Windows + R › Escribe comando-ejemplo › Pulsa Enter')
  })

  it('el caso del respaldo conserva los verbos: no es una lista de sustantivos', () => {
    const respaldo = [
      { id: 'r1', accion: 'Abre o crea', elemento: 'la carpeta de la persona' },
      { id: 'r2', accion: 'Copia', elemento: 'el archivo .pst desde el equipo local' },
      { id: 'r3', accion: 'Pega', elemento: 'el archivo .pst en la carpeta del servidor' },
    ]
    const ruta = rutaDe(respaldo)
    expect(ruta).toBe(
      'Abre o crea la carpeta de la persona › Copia el archivo .pst desde el equipo local › Pega el archivo .pst en la carpeta del servidor',
    )
    expect(ruta).not.toBe('la carpeta de la persona › el archivo .pst desde el equipo local › el archivo .pst en la carpeta del servidor')
  })

  it('una microacción sin elemento no llega a la ruta, ni su acción sola', () => {
    const ruta = rutaDe([FICHERO, { id: 'sin-elemento', accion: 'Reinicia', elemento: '' }, NUEVO])
    expect(ruta).toBe('Abre Fichero › Selecciona Nuevo')
    expect(ruta).not.toContain('Reinicia')
  })

  it('el paso a paso del encargo, como frases de acción más elemento', () => {
    expect(CASO_DEL_ENCARGO.map(fraseDeMicroPaso)).toEqual(['Abre Fichero', 'Selecciona Cliente', 'Abre Fichero', 'Selecciona Nuevo'])
    expect(fraseDeMicroPaso({ id: 'x', accion: ' Pulsa ', elemento: ' Enter ' })).toBe('Pulsa Enter')
  })

  it('el paso a paso como texto, numerado y con la ubicación (para el computador atendido)', () => {
    expect(textoPasoAPaso(CASO_DEL_ENCARGO)).toBe(
      ['1. Abre Fichero (Barra superior).', '2. Selecciona Cliente.', '3. Abre Fichero.', '4. Selecciona Nuevo.'].join('\n'),
    )
  })

  it('no repite el signo con que el autor ya cerró la frase', () => {
    expect(llevaPuntoFinal('Abre Fichero')).toBe(true)
    expect(llevaPuntoFinal('Pulsa ¿Guardar cambios?')).toBe(false)
    expect(textoPasoAPaso([{ id: 'x', accion: 'Pulsa', elemento: '¿Guardar cambios?' }])).toBe('1. Pulsa ¿Guardar cambios?')
  })
})

describe('qué se enseña y cuándo el paso a paso aporta algo (tarea 309)', () => {
  const COPIA = { id: 'c1', accion: 'Copia', elemento: 'el archivo' }
  const PEGA = { id: 'c2', accion: 'Pega', elemento: 'el archivo en la carpeta' }

  it('"Cómo hacerlo" es una descomposición: con menos de dos microacciones no se enseña nada', () => {
    expect(comoHacerQueSeEnsena([])).toEqual([])
    expect(comoHacerQueSeEnsena([FICHERO])).toEqual([])
    expect(comoHacerQueSeEnsena([COPIA, PEGA])).toEqual([COPIA, PEGA])
    expect(comoHacerQueSeEnsena(CASO_DEL_ENCARGO)).toEqual(CASO_DEL_ENCARGO)
  })

  it('no toca el dato: la microacción única se conserva al leer y al guardar', () => {
    const [bloque] = bloquesNormalizados([tareaCruda([FICHERO])])
    expect(bloque.comoHacer).toEqual([FICHERO])
    const guardado = preparar([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: [FICHERO] })])])
    expect(guardado?.pasos[0].bloques[0].comoHacer).toEqual([FICHERO])
  })

  it('el paso a paso solo aporta algo con alguna ubicación: es lo único que la ruta no dice', () => {
    expect(pasoAPasoAportaAlgo([COPIA, PEGA])).toBe(false)
    expect(pasoAPasoAportaAlgo([COPIA, { ...PEGA, ubicacion: '   ' }])).toBe(false)
    expect(pasoAPasoAportaAlgo([COPIA, { ...PEGA, ubicacion: 'Panel izquierdo' }])).toBe(true)
    expect(pasoAPasoAportaAlgo(CASO_DEL_ENCARGO)).toBe(true)
  })

  it('se decide por estructura: dos frases distintas sin ubicación no lo abren, aunque digan cosas diferentes', () => {
    const distintas = [
      { id: 'd1', accion: 'Abre', elemento: 'el panel de prueba' },
      { id: 'd2', accion: 'Selecciona', elemento: 'una opción larga que no se parece en nada a la primera' },
    ]
    expect(pasoAPasoAportaAlgo(distintas)).toBe(false)
  })
})

describe('el resto del sistema lo conserva', () => {
  it('duplicar una guía copia las microacciones con sus ids, sin compartir los objetos', () => {
    const original = normalizarProcedimiento(preparar([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: CASO_DEL_ENCARGO })])]))
    if (!original) throw new Error('Sin procedimiento')
    const copia = duplicarProcedimiento(original)
    expect(copia.pasos[0].bloques[0].id).not.toBe('t1')
    expect(copia.pasos[0].bloques[0].comoHacer).toEqual(CASO_DEL_ENCARGO)
    expect(copia.pasos[0].bloques[0].comoHacer?.[0]).not.toBe(original.pasos[0].bloques[0].comoHacer?.[0])
  })

  it('el buscador lee la acción, el elemento y la ubicación de cada microacción', () => {
    const procedimiento = normalizarProcedimiento(preparar([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: CASO_DEL_ENCARGO })])]))
    const texto = textoDeProcedimiento(procedimiento)
    for (const palabra of ['Selecciona', 'Cliente', 'Nuevo', 'Barra superior']) expect(texto).toContain(palabra)
  })
})

describe('lo que el editor no deja guardar: acción y elemento, siempre', () => {
  const fila = (accion: string, elemento: string, ubicacion?: string): MicroPasoComoHacer => ({
    id: 'x',
    accion,
    elemento,
    ...(ubicacion === undefined ? {} : { ubicacion }),
  })

  it('una completa no tiene nada que corregir, con ubicación o sin ella', () => {
    expect(camposQueFaltan(fila('Abre', 'Fichero'))).toEqual([])
    expect(camposQueFaltan(fila('Abre', 'Fichero', 'Barra superior'))).toEqual([])
    expect(camposQueFaltan(fila('Selecciona', 'Cliente', ''))).toEqual([])
  })

  it('dice qué falta: la acción, el elemento o los dos (los espacios no cuentan)', () => {
    expect(camposQueFaltan(fila('', 'Fichero'))).toEqual(['accion'])
    expect(camposQueFaltan(fila('   ', 'Fichero', 'Barra superior'))).toEqual(['accion'])
    expect(camposQueFaltan(fila('Abre', ''))).toEqual(['elemento'])
    expect(camposQueFaltan(fila('Abre', '  '))).toEqual(['elemento'])
    expect(camposQueFaltan(fila('', '', 'Barra superior'))).toEqual(['accion', 'elemento'])
    expect(textoDeLoQueFalta(['accion'])).toBe('Falta la acción.')
    expect(textoDeLoQueFalta(['elemento'])).toBe('Falta el elemento.')
    expect(textoDeLoQueFalta(['accion', 'elemento'])).toBe('Faltan la acción y el elemento.')
  })

  it('una fila del todo vacía todavía no es una microacción: no le falta nada (no se guarda)', () => {
    expect(camposQueFaltan(fila('', ''))).toEqual([])
    expect(camposQueFaltan(fila(' ', '', '  '))).toEqual([])
  })

  it('las microacciones a medias de la guía, con el número que ve el autor y en el orden de los pasos', () => {
    const pasos = [
      paso([
        tarea('t1', 'Abre un registro nuevo', {
          comoHacer: [FICHERO, { id: 'vacia', accion: '', elemento: '' }, { id: 'sin-elemento', accion: 'Selecciona', elemento: '' }],
        }),
        // Una comprobación no tiene "Cómo hacerlo": nada que revisar aquí.
        tarea('t2', 'Comprueba el registro', { tipoTarea: 'verificacion', comoHacer: [{ id: 'z', accion: 'Abre', elemento: '' }] }),
      ]),
      paso([tarea('t3', '  Abre la herramienta  ', { comoHacer: [{ id: 'sin-nada-obligatorio', accion: '', elemento: '', ubicacion: 'Menú' }] })], 'p2'),
    ]
    const problemas = problemasDeComoHacer(pasos)
    expect(problemas).toEqual([
      { tipo: 'incompleta', pasoId: 'p1', tareaId: 't1', tareaTexto: 'Abre un registro nuevo', microPasoId: 'sin-elemento', numero: 3, faltan: ['elemento'] },
      { tipo: 'incompleta', pasoId: 'p2', tareaId: 't3', tareaTexto: 'Abre la herramienta', microPasoId: 'sin-nada-obligatorio', numero: 1, faltan: ['accion', 'elemento'] },
    ])
    expect(problemas.map(mensajeProblemaComoHacer)).toEqual([
      'A la microacción 3 de «Abre un registro nuevo» le falta el elemento.',
      'A la microacción 1 de «Abre la herramienta» le faltan la acción y el elemento.',
    ])
    expect(mensajeProblemaComoHacer({ ...problemas[0], tipo: 'incompleta', tareaTexto: '', faltan: ['accion'] })).toBe(
      'A la microacción 3 le falta la acción.',
    )
  })

  it('una guía con todas sus microacciones completas no tiene nada que corregir', () => {
    expect(problemasDeComoHacer([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: CASO_DEL_ENCARGO })])])).toEqual([])
  })
})

describe('cero o al menos dos: una sola microacción no se guarda (tarea 309)', () => {
  const VACIA: MicroPasoComoHacer = { id: 'vacia', accion: '', elemento: '' }
  const A_MEDIAS: MicroPasoComoHacer = { id: 'a-medias', accion: 'Selecciona', elemento: '' }

  it('cero: nada que corregir (sin la clave, con la lista vacía o solo con filas en blanco)', () => {
    expect(tieneUnaSolaMicroaccion([])).toBe(false)
    expect(tieneUnaSolaMicroaccion([VACIA])).toBe(false)
    expect(problemasDeComoHacer([paso([tarea('t1', 'Abre un registro nuevo')])])).toEqual([])
    expect(problemasDeComoHacer([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: [VACIA] })])])).toEqual([])
  })

  it('una completa: no se guarda, con su número y el aviso que dice qué hacer', () => {
    expect(tieneUnaSolaMicroaccion([CLIENTE])).toBe(true)
    // Con o sin ubicación, y aunque haya filas en blanco alrededor (no se guardan).
    expect(tieneUnaSolaMicroaccion([FICHERO])).toBe(true)
    expect(tieneUnaSolaMicroaccion([VACIA, CLIENTE, { ...VACIA, id: 'vacia-2' }])).toBe(true)

    const pasos = [
      paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: CASO_DEL_ENCARGO })]),
      paso([tarea('t2', '  Configura correctamente la cuenta  ', { comoHacer: [VACIA, CLIENTE] })], 'p2'),
    ]
    const problemas = problemasDeComoHacer(pasos)
    expect(problemas).toEqual([
      { tipo: 'unaSola', pasoId: 'p2', tareaId: 't2', tareaTexto: 'Configura correctamente la cuenta', microPasoId: 'm2', numero: 2 },
    ])
    expect(mensajeProblemaComoHacer(problemas[0])).toBe(
      '«Configura correctamente la cuenta» tiene una sola microacción en Cómo hacerlo: escríbela en la instrucción principal o añade otra.',
    )
    expect(mensajeProblemaComoHacer({ ...problemas[0], tareaTexto: '' })).toBe(
      'Una acción tiene una sola microacción en Cómo hacerlo: escríbela en la instrucción principal o añade otra.',
    )
    expect(AVISO_UNA_SOLA_MICROACCION).toBe(
      'Cómo hacerlo necesita al menos 2 acciones. Si solo hay una, escríbela directamente en la instrucción principal.',
    )
  })

  it('dos o más completas: se guardan', () => {
    expect(tieneUnaSolaMicroaccion([FICHERO, CLIENTE])).toBe(false)
    expect(tieneUnaSolaMicroaccion(CASO_DEL_ENCARGO)).toBe(false)
    expect(problemasDeComoHacer([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: [FICHERO, CLIENTE, VACIA] })])])).toEqual([])
  })

  it('con una a medias manda lo que le falta: nunca un segundo aviso que lo tape', () => {
    // La única escrita, a medias: falta el elemento, no "necesita dos".
    expect(tieneUnaSolaMicroaccion([A_MEDIAS])).toBe(false)
    expect(problemasDeComoHacer([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: [A_MEDIAS] })])])).toEqual([
      { tipo: 'incompleta', pasoId: 'p1', tareaId: 't1', tareaTexto: 'Abre un registro nuevo', microPasoId: 'a-medias', numero: 1, faltan: ['elemento'] },
    ])
    // Una completa y otra a medias: la segunda se está escribiendo.
    expect(tieneUnaSolaMicroaccion([CLIENTE, A_MEDIAS])).toBe(false)
    expect(
      problemasDeComoHacer([paso([tarea('t1', 'Abre un registro nuevo', { comoHacer: [CLIENTE, A_MEDIAS] })])]).map((p) => p.tipo),
    ).toEqual(['incompleta'])
  })

  it('solo en una tarea de acción: una comprobación o una decisión no guardan "Cómo hacerlo"', () => {
    const pasos = [
      paso([
        tarea('t1', 'Comprueba el registro', { tipoTarea: 'verificacion', comoHacer: [CLIENTE] }),
        tarea('t2', '¿Existe el registro?', { tipoTarea: 'decision', comoHacer: [CLIENTE] }),
      ]),
    ]
    expect(problemasDeComoHacer(pasos)).toEqual([])
  })

  it('una guía antigua con una sola se lee y se conserva tal cual: la regla es del editor, no de la lectura', () => {
    const procedimiento = normalizarProcedimiento({
      pasos: [{ id: 'p1', titulo: 'Configurar', bloques: [{ id: 't1', tipo: 'tarea', texto: 'Configura correctamente la cuenta', comoHacer: [CLIENTE] }] }],
    })
    const tareaLeida = procedimiento?.pasos[0].bloques[0] as BloquePaso
    expect(tareaLeida.comoHacer).toEqual([CLIENTE])
    expect(comoHacerQueSeEnsena(comoHacerDe(tareaLeida))).toEqual([])
    // Al editarla, el editor pide resolverla.
    expect(problemasDeComoHacer(procedimiento?.pasos ?? []).map((p) => p.tipo)).toEqual(['unaSola'])
  })
})
