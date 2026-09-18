import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { crearBloqueAviso, crearBloqueTarea, crearPaso } from '../../lib/procedimiento'
import { accionesEncadenadas, esAccionDePantalla, esRecordatorio, revisarGuia } from './revisionGuia'

function tarea(texto: string, extra: Partial<BloquePaso> = {}): BloquePaso {
  return { ...crearBloqueTarea(), texto, ...extra }
}

function paso(...bloques: BloquePaso[]): PasoProcedimiento {
  return { ...crearPaso(), bloques }
}

describe('accionesEncadenadas: una acción por tarea (regla 20a)', () => {
  it('parte el ejemplo del encargo en sus cinco acciones, sin inventar texto', () => {
    expect(
      accionesEncadenadas(
        'Ingresa al administrador, entra a terminales y dispositivos, selecciona editar, luego entra a impresoras y busca la resolución',
      ),
    ).toEqual([
      'Ingresa al administrador',
      'Entra a terminales y dispositivos',
      'Selecciona editar',
      'Entra a impresoras',
      'Busca la resolución',
    ])
  })

  it('"Selecciona la terminal y pulsa Editar" es UNA acción para quien la hace', () => {
    expect(accionesEncadenadas('Selecciona la terminal correspondiente y pulsa Editar')).toBeNull()
    expect(accionesEncadenadas('Abre FrontRest')).toBeNull()
  })

  it('dos acciones unidas por "luego" ya son una cadena', () => {
    expect(accionesEncadenadas('Abre la consola y luego escribe el comando')).toEqual([
      'Abre la consola',
      'Escribe el comando',
    ])
    expect(accionesEncadenadas('Guarda los cambios. Después cierra la ventana')).toEqual([
      'Guarda los cambios',
      'Cierra la ventana',
    ])
  })

  it('el contexto del principio viaja con la primera acción', () => {
    expect(accionesEncadenadas('En el POS, abre FrontRest, entra en Administrador y abre Terminales')).toEqual([
      'En el POS, abre FrontRest',
      'Entra en Administrador',
      'Abre Terminales',
    ])
  })

  it('reconoce "haz clic", "ve a" y los infinitivos con que se escriben los apuntes', () => {
    expect(accionesEncadenadas('Haz clic en Guardar, espera el mensaje y cierra la ventana')).toEqual([
      'Haz clic en Guardar',
      'Espera el mensaje',
      'Cierra la ventana',
    ])
    expect(accionesEncadenadas('Ir a Configuración, seleccionar Impresoras y pulsar Agregar')).toEqual([
      'Ir a Configuración',
      'Seleccionar Impresoras',
      'Pulsar Agregar',
    ])
  })

  it('las "y" entre cosas no son acciones', () => {
    expect(accionesEncadenadas('Revisa que el papel, la cinta y el rodillo estén bien puestos')).toBeNull()
    expect(accionesEncadenadas('Anota el prefijo, el rango y las fechas de la resolución')).toBeNull()
  })

  it('texto vacío o sin verbos no es una cadena', () => {
    expect(accionesEncadenadas('')).toBeNull()
    expect(accionesEncadenadas('   ')).toBeNull()
    expect(accionesEncadenadas('Resolución de la DIAN vigente')).toBeNull()
  })
})

describe('esAccionDePantalla: lo que no es un requisito (regla 20b)', () => {
  it('un gesto sobre una pantalla o un menú es un paso', () => {
    expect(esAccionDePantalla('Entra al administrador')).toBe(true)
    expect(esAccionDePantalla('Haz clic en Terminales')).toBe(true)
    expect(esAccionDePantalla('Selecciona Editar')).toBe(true)
    expect(esAccionDePantalla('Ve a Impresoras')).toBe(true)
    expect(esAccionDePantalla('- Entrar al administrador')).toBe(true)
    expect(esAccionDePantalla('1. Abrir FrontRest')).toBe(true)
  })

  it('lo que hay que tener listo antes del paso 1 no se señala', () => {
    expect(esAccionDePantalla('Resolución de la DIAN en PDF')).toBe(false)
    expect(esAccionDePantalla('Usuario con permisos de administrador')).toBe(false)
    expect(esAccionDePantalla('Tener a mano la resolución vigente')).toBe(false)
    // Una conexión física es una preparación válida (sección 4 del
    // encargo), aunque se escriba como verbo.
    expect(esAccionDePantalla('Conectar el lector de códigos al POS')).toBe(false)
    expect(esAccionDePantalla('Se ve la pantalla de inicio')).toBe(false)
  })
})

describe('esRecordatorio: una alerta que no es un riesgo (regla 20c)', () => {
  it('reconoce las formas de recordar', () => {
    expect(esRecordatorio('Recuerda que la resolución vence cada año')).toBe(true)
    expect(esRecordatorio('No olvides guardar')).toBe(true)
    expect(esRecordatorio('¡Ten presente el prefijo!')).toBe(true)
    expect(esRecordatorio('Tenga en cuenta el horario de la tienda')).toBe(true)
  })

  it('un riesgo escrito como riesgo no es un recordatorio', () => {
    expect(esRecordatorio('Guardar reemplaza la resolución vigente')).toBe(false)
    expect(esRecordatorio('Si se apaga el servidor se cortan las ventas')).toBe(false)
  })
})

describe('revisarGuia', () => {
  it('señala el requisito que es una acción y dice en qué paso ya está', () => {
    const pasos = [paso(tarea('Abre FrontRest')), paso(tarea('Entra en Administrador'))]
    const revision = revisarGuia(
      ['Resolución de la DIAN en PDF', 'Entrar al administrador', 'Ir a Impresoras'],
      pasos,
    )
    expect(revision.requisitosQueSonAcciones).toEqual([
      { texto: 'Entrar al administrador', enPaso: 2 },
      { texto: 'Ir a Impresoras', enPaso: null },
    ])
  })

  it('no confunde un objeto corto con cualquier tarea que lo nombre', () => {
    const pasos = [paso(tarea('Abre el menú de impresoras de la terminal'))]
    const revision = revisarGuia(['Abre el menú'], pasos)
    expect(revision.requisitosQueSonAcciones).toEqual([{ texto: 'Abre el menú', enPaso: null }])
  })

  it('una guía sin requisitos no genera nada', () => {
    const revision = revisarGuia([], [paso(tarea('Abre FrontRest'))])
    expect(revision).toEqual({ requisitosQueSonAcciones: [], tareasEncadenadas: [], alertasQueRecuerdan: [] })
  })

  it('encuentra las tareas encadenadas, pero no parte comprobaciones ni decisiones', () => {
    const cadena = 'Abre FrontRest, entra en Administrador y abre Terminales'
    const accion = tarea(cadena)
    const pasos = [
      paso(
        accion,
        tarea(cadena, { tipoTarea: 'verificacion' }),
        tarea(cadena, { tipoTarea: 'decision' }),
      ),
    ]
    const revision = revisarGuia([], pasos)
    expect(revision.tareasEncadenadas).toEqual([
      {
        pasoIndice: 0,
        tareaId: accion.id,
        texto: cadena,
        acciones: ['Abre FrontRest', 'Entra en Administrador', 'Abre Terminales'],
      },
    ])
  })

  it('solo las alertas (precaución e importante) que recuerdan algo', () => {
    const recordatorio = { ...crearBloqueAviso(), tono: 'precaucion' as const, texto: 'Recuerda cerrar la caja' }
    const informacion = { ...crearBloqueAviso(), tono: 'info' as const, texto: 'Recuerda que esto tarda' }
    const riesgo = { ...crearBloqueAviso(), tono: 'importante' as const, texto: 'Guardar reemplaza la resolución' }
    const revision = revisarGuia([], [paso(tarea('Pulsa Guardar'), recordatorio, informacion, riesgo)])
    expect(revision.alertasQueRecuerdan).toEqual([
      { pasoIndice: 0, bloqueId: recordatorio.id, texto: 'Recuerda cerrar la caja' },
    ])
  })
})

describe('un aviso nuevo no nace como alerta', () => {
  it('crearBloqueAviso arranca en Información: la alerta la elige el autor', () => {
    expect(crearBloqueAviso().tono).toBe('info')
  })
})
