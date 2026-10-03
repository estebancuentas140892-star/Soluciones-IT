import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { crearBloqueAviso, crearBloqueTarea, crearPaso } from '../../lib/procedimiento'
import {
  accionesEncadenadas,
  cuandoUsarSinSituacion,
  esAccionDePantalla,
  esComprobacion,
  esCondicionPrevia,
  esRecordatorio,
  hablaDeLaArquitectura,
  revisarCuandoUsar,
  revisarGuia,
} from './revisionGuia'

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

  it('un "Luego" que la puntuación dejó suelto no se pega a ninguna acción', () => {
    expect(accionesEncadenadas('Abre FrontRest. Luego, entra en Administrador y selecciona Terminales')).toEqual([
      'Abre FrontRest',
      'Entra en Administrador',
      'Selecciona Terminales',
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

  it('reconoce el verbo con el pronombre pegado ("ábrelo", "cambiarla")', () => {
    expect(accionesEncadenadas('Ábrelo, entra a Impresoras y guárdalo')).toEqual([
      'Ábrelo',
      'Entra a Impresoras',
      'Guárdalo',
    ])
    expect(accionesEncadenadas('Busca el campo resolución, bórralo y escribe la nueva')).toEqual([
      'Busca el campo resolución',
      'Bórralo',
      'Escribe la nueva',
    ])
    // Un sustantivo que termina como un pronombre no es un verbo.
    expect(accionesEncadenadas('Consola, pantalla y tabla de resoluciones')).toBeNull()
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

  it('no confunde un sustantivo, una preposición o un nombre propio con un verbo', () => {
    // El requisito típico de la guía DIAN no puede salir señalado.
    expect(esAccionDePantalla('Copia de la resolución DIAN en PDF')).toBe(false)
    expect(esAccionDePantalla('Marca y modelo del lector')).toBe(false)
    expect(esAccionDePantalla('Cierre de caja hecho')).toBe(false)
    expect(esAccionDePantalla('Entre 10 y 15 minutos sin ventas')).toBe(false)
    expect(esAccionDePantalla('Active Directory: usuario con permisos')).toBe(false)
    expect(esAccionDePantalla('Despliegue de la actualización aprobado')).toBe(false)
    // Las formas que solo son verbo se siguen señalando.
    expect(esAccionDePantalla('Copiar el archivo al escritorio del POS')).toBe(true)
    expect(esAccionDePantalla('Cierra FrontRest')).toBe(true)
  })

  it('dentro de una tarea, "entre" en usted sí es una acción', () => {
    expect(accionesEncadenadas('Entre al administrador, seleccione Terminales y pulse Editar')).toEqual([
      'Entre al administrador',
      'Seleccione Terminales',
      'Pulse Editar',
    ])
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
    expect(revision).toEqual({
      requisitosQueSonAcciones: [],
      tareasEncadenadas: [],
      alertasQueRecuerdan: [],
      tareasQueSonRequisitos: [],
      tareasQueSonComprobaciones: [],
      comprobacionesQueSonAcciones: [],
      requisitosQueHablanDeLaGuia: [],
    })
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

// TAREA 289, FASE 4: requisito, acción, verificación y la forma de hablarle
// a quien ejecuta. Los ejemplos positivos son los del encargo y los de la
// auditoría de las guías reales (sin datos protegidos).
describe('esCondicionPrevia: una tarea que es un requisito previo (tarea 289)', () => {
  it('reconoce lo que debe existir antes de empezar', () => {
    expect(esCondicionPrevia('Tener acceso administrativo.')).toBe(true)
    expect(esCondicionPrevia('Tener a mano la resolución DIAN')).toBe(true)
    expect(esCondicionPrevia('Ten a mano la cédula de la persona')).toBe(true)
    expect(esCondicionPrevia('Contar con el número de cédula')).toBe(true)
    expect(esCondicionPrevia('Estar conectado a la VPN')).toBe(true)
    expect(esCondicionPrevia('Haber creado el usuario en Active Directory')).toBe(true)
    expect(esCondicionPrevia('Debes tener permisos de administrador')).toBe(true)
    expect(esCondicionPrevia('Hay que estar en la red de la sede')).toBe(true)
    expect(esCondicionPrevia('Asegúrate de tener la contraseña del POS')).toBe(true)
    expect(esCondicionPrevia('Se requiere usuario con permisos de administrador')).toBe(true)
    expect(esCondicionPrevia('Necesitas la autorización de la coordinación')).toBe(true)
    expect(esCondicionPrevia('- Disponer de la impresora encendida')).toBe(true)
  })

  it('no confunde una acción, una obligación de hacer ni un aviso con una condición', () => {
    expect(esCondicionPrevia('Abre ICG Manager')).toBe(false)
    expect(esCondicionPrevia('Presiona Windows + R')).toBe(false)
    expect(esCondicionPrevia('Escribe la cédula en NIF')).toBe(false)
    expect(esCondicionPrevia('Debes seleccionar la impresora')).toBe(false)
    expect(esCondicionPrevia('Hay que abrir el menú Fichero')).toBe(false)
    expect(esCondicionPrevia('Tienes que guardar los cambios')).toBe(false)
    expect(esCondicionPrevia('Necesitas abrir ICG Manager')).toBe(false)
    expect(esCondicionPrevia('Ten en cuenta que tarda unos minutos')).toBe(false)
    expect(esCondicionPrevia('Tener cuidado con el cable de red')).toBe(false)
    expect(esCondicionPrevia('Estar atento al mensaje de error')).toBe(false)
    expect(esCondicionPrevia('Verifica que tengas acceso')).toBe(false)
    expect(esCondicionPrevia('')).toBe(false)
  })
})

describe('esComprobacion: algo que se comprueba (tarea 289)', () => {
  it('reconoce una comprobación por cómo empieza', () => {
    expect(esComprobacion('Comprueba que la impresora aparece en la lista')).toBe(true)
    expect(esComprobacion('Verifica la dirección IP del equipo')).toBe(true)
    expect(esComprobacion('Confirma que el usuario quedó creado')).toBe(true)
    expect(esComprobacion('Revisa que el trabajo salga por la bandeja')).toBe(true)
    expect(esComprobacion('Asegúrate de que la luz quede en verde')).toBe(true)
  })

  it('"Confirma el cambio" y "Revisa la bandeja" son gestos, no comprobaciones', () => {
    expect(esComprobacion('Confirma el cambio')).toBe(false)
    expect(esComprobacion('Revisa la bandeja de entrada')).toBe(false)
    expect(esComprobacion('Selecciona Guardar')).toBe(false)
  })
})

describe('hablaDeLaArquitectura: la complejidad pertenece al sistema (tarea 289)', () => {
  it('reconoce lo que nombra cómo está hecha la guía', () => {
    expect(hablaDeLaArquitectura('Acceso autorizado al programa mediante el procedimiento relacionado')).toBe(true)
    expect(hablaDeLaArquitectura('Tener acceso a la información protegida del servidor')).toBe(true)
    expect(hablaDeLaArquitectura('Acceso protegido de la caja disponible')).toBe(true)
    expect(hablaDeLaArquitectura('Usa esta guía cuando otra guía requiera abrir el programa')).toBe(true)
    expect(hablaDeLaArquitectura('Centraliza el recorrido y abre las guías específicas')).toBe(true)
    expect(hablaDeLaArquitectura('Completar primero la subguía de acceso')).toBe(true)
    expect(hablaDeLaArquitectura('La clave está en la Bóveda')).toBe(true)
  })

  it('lo que dice qué hace falta no se señala', () => {
    expect(hablaDeLaArquitectura('Acceso autorizado a ICG Manager')).toBe(false)
    expect(hablaDeLaArquitectura('Usa esta guía cuando la impresora no imprime')).toBe(false)
    expect(hablaDeLaArquitectura('Número de cédula de la persona')).toBe(false)
  })
})

describe('cuandoUsarSinSituacion: un "cuándo usar" que no dice cuándo (tarea 289)', () => {
  it('señala el que describe lo que hace la guía', () => {
    expect(cuandoUsarSinSituacion('Configurar Microsoft 365 en el computador de la persona')).toBe(true)
    expect(cuandoUsarSinSituacion('Crear la firma corporativa en Outlook')).toBe(true)
  })

  it('no señala el que dice la situación, ni uno vacío', () => {
    expect(cuandoUsarSinSituacion('Usa esta guía cuando la impresora no imprime')).toBe(false)
    expect(cuandoUsarSinSituacion('Configurar la firma si la persona es nueva')).toBe(false)
    expect(cuandoUsarSinSituacion('La impresora ya está instalada pero no imprime')).toBe(false)
    expect(cuandoUsarSinSituacion('')).toBe(false)
  })

  it('revisarCuandoUsar junta las dos preguntas', () => {
    expect(revisarCuandoUsar('Usa esta guía cuando otra guía lo pida')).toEqual({ hablaDeLaGuia: true, sinSituacion: false })
    expect(revisarCuandoUsar('Configurar Outlook')).toEqual({ hablaDeLaGuia: false, sinSituacion: true })
  })
})

describe('revisarGuia: lo que mezcla papeles (tarea 289)', () => {
  it('señala la acción que es un requisito y la comprobación sin marcar, nunca una verificación ni una decisión', () => {
    const condicion = tarea('Tener acceso administrativo')
    const comprobacion = tarea('Comprueba que aparece la impresora')
    const pasos = [
      paso(
        condicion,
        comprobacion,
        tarea('Abre el panel'),
        tarea('Tener acceso administrativo', { tipoTarea: 'verificacion' }),
        tarea('¿Tienes acceso administrativo?', { tipoTarea: 'decision' }),
        tarea('Comprueba que aparece la impresora', { tipoTarea: 'verificacion' }),
      ),
    ]
    const revision = revisarGuia([], pasos)
    expect(revision.tareasQueSonRequisitos).toEqual([{ pasoIndice: 0, tareaId: condicion.id, texto: condicion.texto }])
    expect(revision.tareasQueSonComprobaciones).toEqual([
      { pasoIndice: 0, tareaId: comprobacion.id, texto: comprobacion.texto },
    ])
  })

  it('señala la verificación final que es una acción, pero no la que confirma algo', () => {
    const revision = revisarGuia([], [], [
      'Abrir ICG Manager',
      'Confirmar que el trabajador quedó creado',
      'La persona aparece registrada',
      '',
    ])
    expect(revision.comprobacionesQueSonAcciones).toEqual(['Abrir ICG Manager'])
  })

  it('señala el requisito que habla de cómo está hecha la guía', () => {
    const revision = revisarGuia(
      ['Acceso autorizado mediante el procedimiento relacionado', 'Número de cédula de la persona'],
      [],
    )
    expect(revision.requisitosQueHablanDeLaGuia).toEqual(['Acceso autorizado mediante el procedimiento relacionado'])
  })
})

describe('un aviso nuevo no nace como alerta', () => {
  it('crearBloqueAviso arranca en Información: la alerta la elige el autor', () => {
    expect(crearBloqueAviso().tono).toBe('info')
  })
})
