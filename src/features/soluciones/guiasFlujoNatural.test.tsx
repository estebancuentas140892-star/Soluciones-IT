// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento } from '../../lib/db'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ArticuloPage } from './ArticuloPage'
import { GuiaPage } from './GuiaPage'

// LAS GUÍAS COMO UN SOLO FLUJO (tarea 289, fase 1): EL COMPORTAMIENTO DE
// HOY, ANTES DE CAMBIARLO.
//
// Estas pruebas fijan cómo se recorre hoy una guía en los casos que la
// auditoría eligió como representativos, con datos INVENTADOS que copian
// la ESTRUCTURA de las guías reales (ninguna IP, credencial ni texto real):
//
//   - la de alimentación: el paso 1 es otra guía entera (entrar al
//     programa por escritorio remoto, con dos credenciales) y después
//     vienen los pasos propios;
//   - la del computador nuevo: varios pasos seguidos que son otras guías;
//   - una guía sin requisitos y otra con requisitos y orientación;
//   - una guía de diagnóstico con guías de consulta en una tarea;
//   - una decisión cuyo "No" abre otra guía.
//
// Lo que hoy se ve y la tarea 289 cambia queda escrito como tal: la
// tarjeta "Guía necesaria" con "Abrir guía", la cabecera "Estás
// realizando «X» para continuar con «Y»", "Volver a la guía principal", el
// "Paso 1 de 3" y los requisitos propios de la guía de dentro.
//
// FASE 2: antes de la primera acción, la guía orienta (qué vas a hacer,
// cuándo usarla, objetivo) y prepara (los requisitos, juntos, en su propia
// pantalla). Las pruebas de los vínculos atraviesan esa preparación con
// `empezarGuia` y siguen fijando lo de hoy hasta la fase 3.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <ArticuloPage comoDetalles /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

function conLugar(paso: PasoProcedimiento, lugar: string, resultado: string): PasoProcedimiento {
  return { ...paso, lugar, resultado }
}

function contenedor(id: string, titulo: string, guiaId: string, guiaTitulo: string): PasoProcedimiento {
  return { ...pasoPrueba(id, titulo, []), subArticuloId: guiaId, subArticuloTitulo: guiaTitulo }
}

/** La guía de acceso que el paso 1 de alimentación reutiliza. */
async function sembrarAccesoAlPrograma(): Promise<void> {
  await sembrarGuia({
    id: 'acceso-programa',
    titulo: 'Acceder al programa de caja por escritorio remoto',
    pasos: [
      pasoPrueba('acc-p1', 'Conectarse al servidor por escritorio remoto', [
        'Busca y abre Conexión a Escritorio remoto',
        'Escribe la dirección del servidor de prueba',
        'Selecciona Conectar',
      ]),
      {
        ...pasoPrueba('acc-p2', 'Ingresar al servidor', ['Ingresa el usuario y la contraseña del escritorio remoto']),
        vinculoProtegido: { tipo: 'credencial', id: 'cred-escritorio', titulo: 'Acceso de prueba al escritorio remoto' },
      },
      {
        ...pasoPrueba('acc-p3', 'Abrir el programa de caja', ['Abre el programa de caja e ingresa su contraseña']),
        vinculoProtegido: { tipo: 'credencial', id: 'cred-programa', titulo: 'Acceso de prueba al programa de caja' },
      },
    ],
    procedimiento: {
      descripcion: 'Usa esta guía cuando necesites abrir el programa de caja desde otro computador.',
      objetivoGeneral: 'Dejar el programa de caja abierto y listo para trabajar.',
      requisitos: [
        'Estar conectado a la red desde la que se permite el escritorio remoto.',
        'Tener autorización para entrar al programa de caja.',
      ],
      verificacionFinal: ['El programa de caja queda abierto y listo para trabajar.'],
    },
  })
}

/** El caso de referencia: un trabajador para almuerzo, con el acceso reutilizado en el paso 1. */
async function sembrarCasoAlimentacion(): Promise<void> {
  await sembrarAccesoAlPrograma()
  await sembrarGuia({
    id: 'guia-alimentacion',
    titulo: 'Crear un trabajador para almuerzo en el programa de caja',
    pasos: [
      conLugar(
        contenedor('ali-p1', 'Ingresar al programa de caja', 'acceso-programa', 'Acceder al programa de caja por escritorio remoto'),
        'Escritorio remoto · programa de caja',
        'El programa de caja queda abierto y listo para trabajar.',
      ),
      conLugar(
        pasoPrueba('ali-p2', 'Cerrar el aviso inicial', ['Si aparece el aviso inicial, selecciona Salir']),
        'Programa de caja · mensaje al iniciar',
        'Queda disponible el menú principal.',
      ),
      conLugar(
        pasoPrueba('ali-p3', 'Abrir un cliente nuevo', ['Ve a Fichero → Cliente → Fichero → Nuevo']),
        'Fichero → Cliente',
        'Se abre un registro nuevo de cliente.',
      ),
      pasoPrueba('ali-p4', 'Completar los Datos Comerciales', ['Escribe el nombre completo', 'Escribe la cédula en NIF']),
      pasoPrueba('ali-p5', 'Completar los Campos Libres', ['Selecciona Empleado en TIPO_CLIENTE', 'Selecciona el régimen']),
      pasoPrueba('ali-p6', 'Configurar las tarifas de alimentación', ['Selecciona las dos tarifas de alimentación']),
      pasoPrueba('ali-p7', 'Guardar y comprobar el trabajador', ['Selecciona Guardar']),
    ],
    procedimiento: {
      descripcion:
        'Usa esta guía cuando necesites registrar a un trabajador autorizado para recibir el beneficio de alimentación.',
      objetivoGeneral: 'Dejar al trabajador registrado con sus datos, sus campos libres y las tarifas de alimentación.',
      requisitos: ['Autorización para crear al trabajador.', 'Nombre completo, cédula y celular de la persona.'],
      verificacionFinal: ['El trabajador aparece registrado.', 'Las tarifas de alimentación quedaron asociadas.'],
    },
  })
}

/** Una guía que es solo otras guías, una detrás de otra. */
async function sembrarCasoComputador(): Promise<void> {
  await sembrarGuia({
    id: 'correo-prueba',
    titulo: 'Configurar el correo de prueba',
    pasos: [pasoPrueba('cor-p1', 'Abrir el correo de prueba', ['Abre el correo de prueba e inicia sesión'])],
    procedimiento: { requisitos: ['Correo de la persona y contraseña vigente.'] },
  })
  await sembrarGuia({
    id: 'firma-prueba',
    titulo: 'Configurar la firma de prueba',
    pasos: [pasoPrueba('fir-p1', 'Crear la firma de prueba', ['Crea la firma de prueba en el correo'])],
    // Lo produce el paso anterior de la guía que la reutiliza.
    procedimiento: { requisitos: ['Correo de prueba configurado.'] },
  })
  await sembrarGuia({
    id: 'impresora-prueba',
    titulo: 'Conectar la impresora de prueba',
    pasos: [pasoPrueba('imp-p1', 'Conectar la impresora de prueba', ['Selecciona Conectar en la impresora de prueba'])],
    procedimiento: { requisitos: ['Impresora de prueba encendida.'] },
  })
  await sembrarGuia({
    id: 'guia-computador',
    titulo: 'Configurar el computador para una persona nueva',
    pasos: [
      contenedor('com-p1', 'Configurar el correo de prueba', 'correo-prueba', 'Configurar el correo de prueba'),
      contenedor('com-p2', 'Configurar la firma de prueba', 'firma-prueba', 'Configurar la firma de prueba'),
      contenedor('com-p3', 'Instalar la impresora de la persona', 'impresora-prueba', 'Conectar la impresora de prueba'),
    ],
    procedimiento: {
      descripcion: 'Usa esta guía cuando una persona nueva necesite su computador listo para trabajar.',
      objetivoGeneral: 'Dejar el correo, la firma y la impresora de la persona funcionando.',
      requisitos: ['Cuenta de la persona creada.', 'Impresora que usará la persona identificada.'],
    },
  })
}

/** Una guía sin requisitos ni orientación: como las que siembran las pruebas de siempre. */
async function sembrarGuiaSinRequisitos(): Promise<void> {
  await sembrarGuia({
    id: 'guia-lector',
    titulo: 'Reiniciar el lector de prueba',
    pasos: [pasoPrueba('lec-p1', 'Reiniciar el lector', ['Desconecta el lector de prueba', 'Vuelve a conectarlo'])],
  })
}

/** Una guía con orientación y requisitos reales. */
async function sembrarGuiaConRequisitos(): Promise<void> {
  await sembrarGuia({
    id: 'guia-ip',
    titulo: 'Agregar una impresora de prueba por su dirección',
    pasos: [
      pasoPrueba('ip-p1', 'Buscar la impresora', ['Abre Impresoras y escáneres', 'Selecciona Agregar dispositivo']),
      pasoPrueba('ip-p2', 'Probar la impresora', ['Imprime una página de prueba']),
    ],
    procedimiento: {
      descripcion: 'Usa esta guía cuando necesites agregar una impresora de red usando su propia dirección.',
      objetivoGeneral: 'Dejar la impresora agregada y comprobada con una impresión de prueba.',
      requisitos: ['Impresora encendida y conectada a la red.', 'Dirección confirmada de la impresora.'],
    },
  })
}

function bloqueGuia(id: string, tareaId: string, guiaId: string, guiaTitulo: string, intencion: 'consulta' | 'contingencia'): BloquePaso {
  return {
    ...pasoPrueba('aux', 'aux', ['aux']).bloques[0],
    id,
    tipo: 'guia',
    texto: '',
    tipoTarea: null,
    tareaId,
    alcance: 'tarea',
    guiaArticuloId: guiaId,
    guiaArticuloTitulo: guiaTitulo,
    intencionGuia: intencion,
  }
}

/** Un diagnóstico cuyo último paso ofrece dos guías de consulta. */
async function sembrarDiagnosticoConConsultas(): Promise<void> {
  await sembrarGuiaConRequisitos()
  const paso = pasoPrueba('dia-p1', 'Reinstalar si el problema continúa', ['Confirma cómo estaba instalada la impresora'])
  paso.bloques.push(bloqueGuia('dia-g1', 'dia-p1-t1', 'guia-ip', 'Agregar una impresora de prueba por su dirección', 'consulta'))
  await sembrarGuia({
    id: 'guia-diagnostico',
    titulo: 'Diagnosticar una impresora de prueba que no imprime',
    pasos: [paso],
  })
}

/** Una decisión cuyo "No" lleva a otra guía. */
async function sembrarDecisionConDestino(): Promise<void> {
  await sembrarGuia({
    id: 'guia-vinculo-edicion',
    titulo: 'Crear un vínculo de prueba con permiso de edición',
    pasos: [pasoPrueba('ved-p1', 'Permitir la edición', ['Selecciona Puede editar'])],
  })
  const paso = pasoPrueba('env-p1', 'Copiar el vínculo de solo lectura', ['Copia el vínculo del archivo'])
  paso.bloques.push({
    ...paso.bloques[0],
    id: 'env-p1-dec',
    texto: '¿La persona solo necesita ver el archivo?',
    tipoTarea: 'decision',
    decisionArticuloId: 'guia-vinculo-edicion',
    decisionArticuloTitulo: 'Crear un vínculo de prueba con permiso de edición',
  })
  await sembrarGuia({
    id: 'guia-envio',
    titulo: 'Enviar un archivo grande de prueba',
    pasos: [paso, pasoPrueba('env-p2', 'Enviar el correo', ['Pega el vínculo y envía el correo'])],
  })
}

/** Toca el control principal de la acción hasta que aparezca `texto`. */
async function completarHasta(texto: string, intentos = 12): Promise<void> {
  await esperar(
    () => textoPantalla().includes(texto) || control(/^Completar y (seguir|terminar)$/),
    `la ejecución lista para llegar a «${texto}»`,
  )
  for (let i = 0; i < intentos; i++) {
    if (textoPantalla().includes(texto)) return
    const boton = control(/^Completar y (seguir|terminar)$/)
    if (!boton) break
    await tocar(boton)
  }
  await esperar(() => textoPantalla().includes(texto), `aparece «${texto}»`)
}

/** Atraviesa la orientación y los requisitos de una ejecución nueva hasta la primera acción. */
async function empezarGuia(): Promise<void> {
  const boton = await esperar(
    () => control('Ver lo que necesitas') ?? control('Todo listo, empezar') ?? control('Empezar'),
    'la preparación de la guía',
  )
  await tocar(boton)
  const siguiente = control('Todo listo, empezar')
  if (siguiente) await tocar(siguiente)
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una guía sin nada que orientar ni preparar', () => {
  it('abre directamente en su primera acción, como siempre: ninguna pantalla vacía', async () => {
    await sembrarGuiaSinRequisitos()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-lector')
    await esperar(() => textoPantalla().includes('Desconecta el lector de prueba'), 'la primera acción')
    expect(textoPantalla()).not.toContain('Antes de empezar')
    expect(textoPantalla()).not.toContain('Cuándo usarla')
    expect(textoPantalla()).not.toContain('Ten esto listo')
  })

})

describe('antes del primer paso: orientar y preparar (fase 2)', () => {
  it('orienta primero: qué vas a hacer, cuándo usarla y el objetivo, sin ninguna acción', async () => {
    await sembrarGuiaConRequisitos()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-ip')
    await esperar(() => textoPantalla().includes('Cuándo usarla'), 'la orientación')
    const texto = textoPantalla()
    expect(texto).toContain('Qué vas a hacer')
    expect(texto).toContain('Agregar una impresora de prueba por su dirección')
    expect(texto).toContain('2 pasos · unos 10 min')
    // "Usa esta guía cuando…" no repite lo que ya dice "Cuándo usarla".
    expect(texto).toContain('Cuando necesites agregar una impresora de red usando su propia dirección.')
    expect(texto).not.toContain('Usa esta guía cuando')
    expect(texto).toContain('Objetivo')
    expect(texto).toContain('Dejar la impresora agregada y comprobada con una impresión de prueba.')
    // Orientar no es preparar ni ejecutar: ni requisitos ni acciones todavía.
    expect(texto).not.toContain('Dirección confirmada de la impresora.')
    expect(texto).not.toContain('Abre Impresoras y escáneres')
    // El lector de pantalla y el teclado empiezan en el nombre de la guía.
    expect(document.activeElement?.tagName).toBe('H2')
    expect(document.activeElement?.textContent).toBe('Agregar una impresora de prueba por su dirección')
    // Una sola acción, que dice a dónde lleva.
    expect(control('Ver lo que necesitas')).not.toBeNull()
    expect(control('Anterior')).toBeNull()
  })

  it('prepara después: los requisitos juntos; "Anterior" vuelve y "Todo listo, empezar" lleva a la primera acción', async () => {
    await sembrarGuiaConRequisitos()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-ip')
    await tocar(await esperarControl('Ver lo que necesitas'))
    await esperar(() => textoPantalla().includes('Antes de empezar'), 'los requisitos')
    expect(textoPantalla()).toContain('Impresora encendida y conectada a la red.')
    expect(textoPantalla()).toContain('Dirección confirmada de la impresora.')
    expect(textoPantalla()).not.toContain('Abre Impresoras y escáneres')
    expect(textoPantalla()).not.toContain('Cuándo usarla')
    expect(document.activeElement?.textContent).toBe('Antes de empezar')

    await tocar(await esperarControl('Anterior'))
    await esperar(() => textoPantalla().includes('Cuándo usarla'), 'de vuelta en la orientación')
    await tocar(await esperarControl('Ver lo que necesitas'))
    await tocar(await esperarControl('Todo listo, empezar'))
    await esperar(() => textoPantalla().includes('Abre Impresoras y escáneres'), 'la primera acción')
    // Los requisitos no vuelven junto a la acción.
    expect(textoPantalla()).not.toContain('Dirección confirmada de la impresora.')
    expect(textoPantalla()).not.toContain('Ten esto listo')
    // Leer la preparación no es avanzar: no se guarda nada.
    expect(await db.progresoPasos.get('guia-ip')).toBeUndefined()
  })

  it('con orientación y sin requisitos, "Empezar" lleva directo a la primera acción', async () => {
    await sembrarGuia({
      id: 'guia-vpn',
      titulo: 'Desconectarse de la conexión de prueba',
      pasos: [pasoPrueba('vpn-p1', 'Desconectar', ['Selecciona Desconectar'])],
      procedimiento: { descripcion: 'Usa esta guía cuando termines de trabajar desde fuera.' },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-vpn')
    await esperar(() => textoPantalla().includes('Cuando termines de trabajar desde fuera.'), 'la orientación')
    // Sin objetivo, no hay sección vacía.
    expect(textoPantalla()).not.toContain('Objetivo')
    await tocar(await esperarControl('Empezar'))
    await esperar(() => textoPantalla().includes('Selecciona Desconectar'), 'la primera acción')
    expect(textoPantalla()).not.toContain('Antes de empezar')
  })

  it('una ejecución a medias se retoma donde iba, sin volver a prepararse', async () => {
    await sembrarGuiaConRequisitos()
    await db.progresoPasos.put({
      articuloId: 'guia-ip',
      pasosHechos: ['ip-p1'],
      instruccionesHechas: ['ip-p1-t1', 'ip-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: '2026-10-02T12:00:00.000Z',
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-ip')
    await esperar(() => textoPantalla().includes('Imprime una página de prueba'), 'el paso 2')
    expect(textoPantalla()).toContain('Retomando · paso 2 de 2')
    expect(textoPantalla()).not.toContain('Cuándo usarla')
    expect(textoPantalla()).not.toContain('Antes de empezar')
  })

  it('empezar de nuevo es una ejecución nueva: vuelve a orientar', async () => {
    await sembrarGuiaConRequisitos()
    await db.progresoPasos.put({
      articuloId: 'guia-ip',
      pasosHechos: ['ip-p1'],
      instruccionesHechas: ['ip-p1-t1', 'ip-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: '2026-10-02T12:00:00.000Z',
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-ip')
    await tocar(await esperarControl('Empezar de nuevo'))
    await esperar(() => textoPantalla().includes('Cuándo usarla'), 'la orientación otra vez')
    expect(await db.progresoPasos.get('guia-ip')).toBeUndefined()
  })
})

describe('lo que hace falta antes de una guía que reutiliza otras (fase 2)', () => {
  it('suma los requisitos de la guía del paso 1, que se hace antes que nada', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await tocar(await esperarControl('Ver lo que necesitas'))
    await esperar(() => textoPantalla().includes('Antes de empezar'), 'los requisitos')
    const texto = textoPantalla()
    expect(texto).toContain('Autorización para crear al trabajador.')
    expect(texto).toContain('Nombre completo, cédula y celular de la persona.')
    expect(texto).toContain('Estar conectado a la red desde la que se permite el escritorio remoto.')
    expect(texto).toContain('Tener autorización para entrar al programa de caja.')
  })

  it('no suma los de las guías de más adelante: un paso anterior puede producirlos', async () => {
    await sembrarCasoComputador()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-computador')
    await tocar(await esperarControl('Ver lo que necesitas'))
    await esperar(() => textoPantalla().includes('Antes de empezar'), 'los requisitos')
    const texto = textoPantalla()
    expect(texto).toContain('Cuenta de la persona creada.')
    expect(texto).toContain('Impresora que usará la persona identificada.')
    // El paso 1 es otra guía: lo que ella pide hace falta antes de empezar.
    expect(texto).toContain('Correo de la persona y contraseña vigente.')
    // Lo deja hecho el paso 1 de esta misma guía: no es un requisito previo.
    expect(texto).not.toContain('Correo de prueba configurado.')
    expect(texto).not.toContain('Impresora de prueba encendida.')
  })

  it('los detalles de la guía enseñan la misma lista: una sola verdad para "qué hace falta"', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion/detalles')
    await esperar(
      () => textoPantalla().includes('Estar conectado a la red desde la que se permite el escritorio remoto.'),
      'los requisitos de la guía del paso 1 en los detalles',
    )
    expect(textoPantalla()).toContain('Autorización para crear al trabajador.')
  })

  it('sin conexión: orientar y preparar salen de lo guardado en el dispositivo, sin pedir nada a la red', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', red)
    try {
      await sembrarCasoAlimentacion()
      await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
      await tocar(await esperarControl('Ver lo que necesitas'))
      await esperar(
        () => textoPantalla().includes('Tener autorización para entrar al programa de caja.'),
        'los requisitos, leídos de la base local',
      )
      await tocar(await esperarControl('Todo listo, empezar'))
      await esperar(() => textoPantalla().includes('Primero, completa esta guía'), 'la primera acción')
      expect(red).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('hoy: una guía que reutiliza otra en su paso 1 (el caso de alimentación)', () => {
  it('el paso 1 es una tarjeta que hay que abrir, y dentro se ve otra guía con su numeración y sus requisitos', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await empezarGuia()
    await esperar(() => textoPantalla().includes('Primero, completa esta guía'), 'la guía del paso 1')
    await esperar(() => textoPantalla().includes('Guía necesaria'), 'la tarjeta de la guía')
    expect(textoPantalla()).toContain('Acceder al programa de caja por escritorio remoto')

    await tocar(await esperarControl('Abrir guía: Acceder al programa de caja por escritorio remoto'))
    await esperar(() => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'), 'la guía de dentro')
    const dentro = textoPantalla()
    expect(dentro).toContain(
      'Estás realizando «Acceder al programa de caja por escritorio remoto» para continuar con «Crear un trabajador para almuerzo en el programa de caja»',
    )
    expect(control('Volver a la guía principal')).not.toBeNull()
    expect(dentro).toContain('Paso 1 de 3')
    // Los requisitos de la guía de dentro, a mitad de la ejecución.
    expect(dentro).toContain('Estar conectado a la red desde la que se permite el escritorio remoto.')
  })

  it('terminarla pide "terminar" y sus comprobaciones a mitad del recorrido, y después sigue el paso 2', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await empezarGuia()
    await tocar(await esperarControl('Abrir guía: Acceder al programa de caja por escritorio remoto'))
    await completarHasta('Abre el programa de caja e ingresa su contraseña')
    expect(control('Completar y terminar')).not.toBeNull()
    await tocar(await esperarControl('Completar y terminar'))
    await esperar(() => textoPantalla().includes('Antes de terminar, comprueba'), 'las comprobaciones de la guía de dentro')
    await tocar(await esperar(() => document.body.querySelector<HTMLElement>('[role="checkbox"]'), 'la comprobación'))
    await esperar(() => textoPantalla().includes('Si aparece el aviso inicial, selecciona Salir'), 'el paso 2 de la guía')
    const progreso = await db.progresoPasos.get('guia-alimentacion')
    expect(progreso?.pasosHechos).toEqual(['ali-p1'])
    expect(progreso?.vinculos?.['acceso-programa']?.pasosHechos).toEqual(['acc-p1', 'acc-p2', 'acc-p3'])
  })
})

describe('hoy: una guía hecha de otras guías (el computador nuevo)', () => {
  it('cada paso es una tarjeta distinta que hay que abrir y de la que hay que volver', async () => {
    await sembrarCasoComputador()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-computador')
    await empezarGuia()
    await tocar(await esperarControl('Abrir guía: Configurar el correo de prueba'))
    await esperar(() => textoPantalla().includes('Abre el correo de prueba e inicia sesión'), 'la primera guía')
    // Su única acción "termina" aunque la guía de fuera siga.
    await tocar(await esperarControl('Completar y terminar'))
    // Al terminarla, el paso 2 vuelve a ser una tarjeta cerrada.
    await esperar(() => control('Abrir guía: Configurar la firma de prueba'), 'la tarjeta del paso 2')
    expect(textoPantalla()).toContain('Primero, completa esta guía')
  })
})

describe('hoy: guías de consulta y decisiones', () => {
  it('una guía de consulta se ofrece como "Consulta opcional" con "Abrir guía"', async () => {
    await sembrarDiagnosticoConConsultas()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-diagnostico')
    await esperar(() => textoPantalla().includes('Confirma cómo estaba instalada la impresora'), 'la tarea')
    await esperar(() => textoPantalla().includes('Consulta opcional'), 'la tarjeta de consulta')
    expect(control('Abrir guía: Agregar una impresora de prueba por su dirección')).not.toBeNull()
  })

  it('responder "No" abre la otra guía con su cabecera y su regreso', async () => {
    await sembrarDecisionConDestino()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-envio')
    await completarHasta('¿La persona solo necesita ver el archivo?')
    await tocar(await esperarControl(/^No: abrir/))
    await esperar(() => textoPantalla().includes('Selecciona Puede editar'), 'el destino del no')
    expect(textoPantalla()).toContain('Estás realizando «Crear un vínculo de prueba con permiso de edición»')
    expect(control('Volver a la guía principal')).not.toBeNull()
  })
})
