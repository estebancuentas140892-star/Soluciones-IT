// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento } from '../../lib/db'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  anclarMaestra,
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarCredencial,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { bloquear } from '../boveda/sesionBoveda'
import { ArticuloPage } from './ArticuloPage'
import { TERMINOS_INTERNOS } from './flujoContinuo'
import { GuiaPage } from './GuiaPage'

// LAS GUÍAS COMO UN SOLO FLUJO (tarea 289).
//
// Estas pruebas recorren una guía en los casos que la auditoría eligió
// como representativos, con datos INVENTADOS que copian la ESTRUCTURA de
// las guías reales (ninguna IP, credencial ni texto real):
//
//   - la de alimentación: el paso 1 es otra guía entera (entrar al
//     programa por escritorio remoto, con dos credenciales) y después
//     vienen los pasos propios;
//   - la del computador nuevo: varios pasos seguidos que son otras guías;
//   - una guía sin requisitos y otra con requisitos y orientación;
//   - una guía de diagnóstico con guías de consulta en una tarea;
//   - una decisión cuyo "No" abre otra guía.
//
// La fase 1 fijó aquí lo que se veía antes: los requisitos junto a la
// primera acción, la tarjeta "Guía necesaria" con "Abrir guía", la
// cabecera "Estás realizando «X» para continuar con «Y»", "Volver a la
// guía principal", el "Paso 1 de 3" y los requisitos de la guía de dentro.
// Las fases siguientes las cambiaron a propósito:
//
//   - FASE 2: antes de la primera acción, la guía orienta (qué vas a
//     hacer, cuándo usarla, objetivo) y prepara (los requisitos, juntos,
//     en su propia pantalla). `empezarGuia` atraviesa esa preparación.
//   - FASE 3: lo que un paso reutiliza se hace en el sitio, como acciones
//     de ese paso, y nada de lo que se ve habla de cómo está construida la
//     guía (`sinArquitectura`).

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

/** Lo que se ve no habla de cómo está construida la guía (tarea 289, fase 3). */
function sinArquitectura(): void {
  const texto = textoPantalla()
  expect(texto).not.toMatch(TERMINOS_INTERNOS)
  for (const frase of [
    'Estás realizando',
    'Abrir guía',
    'Continuar guía',
    'Guía necesaria',
    'Consulta opcional',
    'Primero, completa esta guía',
    'Guía completada',
  ]) {
    expect(texto).not.toContain(frase)
  }
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

// REGLA DEFINITIVA (criterio adicional de la fase 4): un requisito de una
// guía reutilizada NO se convierte automáticamente en requisito de la guía
// que la reutiliza, tampoco el de la guía del paso 1. "Antes de empezar"
// enseña solo lo que escribió el autor de la guía que se abrió.
describe('lo que hace falta antes de una guía que reutiliza otras (fase 2)', () => {
  it('pide solo lo que escribió su autor: lo que pide la guía del paso 1 no pasa solo', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await tocar(await esperarControl('Ver lo que necesitas'))
    await esperar(() => textoPantalla().includes('Antes de empezar'), 'los requisitos')
    const texto = textoPantalla()
    expect(texto).toContain('Autorización para crear al trabajador.')
    expect(texto).toContain('Nombre completo, cédula y celular de la persona.')
    expect(texto).not.toContain('Estar conectado a la red desde la que se permite el escritorio remoto.')
    expect(texto).not.toContain('Tener autorización para entrar al programa de caja.')
  })

  it('tampoco suma los de ninguna otra guía que reutilice, en ningún paso', async () => {
    await sembrarCasoComputador()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-computador')
    await tocar(await esperarControl('Ver lo que necesitas'))
    await esperar(() => textoPantalla().includes('Antes de empezar'), 'los requisitos')
    const texto = textoPantalla()
    expect(texto).toContain('Cuenta de la persona creada.')
    expect(texto).toContain('Impresora que usará la persona identificada.')
    expect(texto).not.toContain('Correo de la persona y contraseña vigente.')
    expect(texto).not.toContain('Correo de prueba configurado.')
    expect(texto).not.toContain('Impresora de prueba encendida.')
  })

  it('sin requisitos propios no hay "Antes de empezar", aunque la guía del paso 1 pida cosas', async () => {
    await sembrarAccesoAlPrograma()
    await sembrarGuia({
      id: 'guia-cierre',
      titulo: 'Cerrar la caja de prueba al final del día',
      pasos: [
        contenedor('cie-p1', 'Ingresar al programa de caja', 'acceso-programa', 'Acceder al programa de caja por escritorio remoto'),
        pasoPrueba('cie-p2', 'Cerrar la caja', ['Selecciona Cierre de caja']),
      ],
      procedimiento: { descripcion: 'Usa esta guía cuando termine el turno de la caja de prueba.' },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cierre')
    await esperar(() => textoPantalla().includes('Cuando termine el turno de la caja de prueba.'), 'la orientación')
    // Sin nada que preparar, la orientación lleva directo a la primera acción.
    expect(control('Ver lo que necesitas')).toBeNull()
    await tocar(await esperarControl('Empezar'))
    await esperar(() => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'), 'la primera acción')
    const texto = textoPantalla()
    expect(texto).not.toContain('Antes de empezar')
    expect(texto).not.toContain('Tener autorización para entrar al programa de caja.')
    expect(texto).not.toContain('Ten esto listo')
  })

  it('los detalles de la guía enseñan la misma lista: una sola verdad para "qué hace falta"', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion/detalles')
    await esperar(
      () => textoPantalla().includes('Autorización para crear al trabajador.'),
      'los requisitos de la guía en los detalles',
    )
    expect(textoPantalla()).not.toContain('Estar conectado a la red desde la que se permite el escritorio remoto.')
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
        () => textoPantalla().includes('Nombre completo, cédula y celular de la persona.'),
        'los requisitos, leídos de la base local',
      )
      await tocar(await esperarControl('Todo listo, empezar'))
      await esperar(
        () => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'),
        'la primera acción, reutilizada y leída de la base local',
      )
      expect(red).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('un solo flujo: el caso de alimentación (fase 3)', () => {
  it('el paso 1 hace aquí lo que reutiliza: sin tarjeta, sin cabecera y sin numeración propias', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await empezarGuia()
    await esperar(() => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'), 'la primera acción reutilizada')
    const texto = textoPantalla()
    // La identidad es la de la guía que se abrió: su contador y su paso.
    expect(control('Paso 1 de 7. Abrir el índice de pasos')).not.toBeNull()
    expect(texto).toContain('Ingresar al programa de caja')
    // Lo de dentro no se nombra ni se numera aparte.
    expect(texto).not.toContain('Acceder al programa de caja por escritorio remoto')
    expect(texto).not.toContain('Paso 1 de 3')
    // El título de la parte, en voz baja, y el "Dónde" del paso que la reutiliza.
    expect(texto).toContain('Conectarse al servidor por escritorio remoto')
    expect(texto).toContain('Escritorio remoto · programa de caja')
    // Sus requisitos no se piden: ni antes de empezar ni junto a la acción.
    expect(texto).not.toContain('Estar conectado a la red desde la que se permite el escritorio remoto.')
    expect(texto).not.toContain('Ten esto listo')
    sinArquitectura()
    // El lector de pantalla y el teclado empiezan en la acción.
    expect(document.activeElement?.textContent).toBe('Busca y abre Conexión a Escritorio remoto')
    expect(control('Completar y seguir')).not.toBeNull()
  })

  it('lo reutilizado trae su credencial, sigue con "Completar y seguir", comprueba sin "terminar" y continúa en el paso 2', async () => {
    await sembrarCasoAlimentacion()
    await anclarMaestra()
    await sembrarCredencial({
      id: 'cred-programa',
      titulo: 'Acceso de prueba al programa de caja',
      tipo: 'cuenta',
      usuario: 'caja.prueba',
      contrasena: 'Clave-De-Prueba-7',
    })
    bloquear()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await empezarGuia()
    await completarHasta('Abre el programa de caja e ingresa su contraseña')
    // La credencial va con la acción que la usa, sin salir del flujo.
    await esperar(() => textoPantalla().includes('Credencial necesaria'), 'la credencial de la acción')
    expect(textoPantalla()).toContain('Acceso de prueba al programa de caja')
    // Lo que debe verse al terminar el paso, aunque la acción sea de lo reutilizado.
    expect(textoPantalla()).toContain('El programa de caja queda abierto y listo para trabajar.')
    expect(control('Completar y terminar')).toBeNull()
    sinArquitectura()

    await tocar(await esperarControl('Completar y seguir'))
    await esperar(() => textoPantalla().includes('Comprueba antes de seguir'), 'la comprobación de lo reutilizado')
    expect(textoPantalla()).not.toContain('Antes de terminar')
    // El lector de pantalla y el teclado siguen en lo que acaba de aparecer.
    await esperar(
      () => document.activeElement?.textContent?.includes('Comprueba antes de seguir'),
      'el foco en la comprobación',
    )
    sinArquitectura()
    await tocar(await esperar(() => document.body.querySelector<HTMLElement>('[role="checkbox"]'), 'la comprobación'))

    await esperar(() => textoPantalla().includes('Si aparece el aviso inicial, selecciona Salir'), 'el paso 2')
    expect(control('Paso 2 de 7. Abrir el índice de pasos')).not.toBeNull()
    const progreso = await db.progresoPasos.get('guia-alimentacion')
    expect(progreso?.pasosHechos).toEqual(['ali-p1'])
    expect(progreso?.vinculos?.['acceso-programa']?.pasosHechos).toEqual(['acc-p1', 'acc-p2', 'acc-p3'])
    // Nada se copió dentro de la guía que la reutiliza: sigue siendo una referencia.
    const guia = await db.articulos.get('guia-alimentacion')
    expect(guia?.procedimiento?.pasos[0].subArticuloId).toBe('acceso-programa')
    expect(guia?.procedimiento?.pasos).toHaveLength(7)
  })

  it('desde el paso 2, "Anterior" revisa el paso 1 ya hecho: se lee lo que se hizo, sin abrir nada', async () => {
    await sembrarCasoAlimentacion()
    await db.progresoPasos.put({
      articuloId: 'guia-alimentacion',
      pasosHechos: ['ali-p1'],
      instruccionesHechas: [],
      verificacionHecha: [],
      actualizadoEn: '2026-10-02T12:00:00.000Z',
      vinculos: {
        'acceso-programa': {
          pasosHechos: ['acc-p1', 'acc-p2', 'acc-p3'],
          instruccionesHechas: ['acc-p1-t1', 'acc-p1-t2', 'acc-p1-t3', 'acc-p2-t1', 'acc-p3-t1'],
          verificacionHecha: [0],
          actualizadoEn: '2026-10-02T12:00:00.000Z',
        },
      },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await esperar(() => textoPantalla().includes('Si aparece el aviso inicial, selecciona Salir'), 'el paso 2')
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Conectarse al servidor por escritorio remoto'), 'el paso 1, para leerlo')
    const texto = textoPantalla()
    expect(texto).toContain('Hecha')
    expect(texto).toContain('Ingresar al programa de caja')
    expect(texto).toContain('Abre el programa de caja e ingresa su contraseña')
    expect(control(/^Abrir:/)).toBeNull()
    sinArquitectura()
    expect(control('Ir al paso 2')).not.toBeNull()
  })

  it('retomar a mitad de lo reutilizado sigue en la acción exacta, sin volver a prepararse', async () => {
    await sembrarCasoAlimentacion()
    await db.progresoPasos.put({
      articuloId: 'guia-alimentacion',
      pasosHechos: [],
      instruccionesHechas: [],
      verificacionHecha: [],
      actualizadoEn: '2026-10-02T12:00:00.000Z',
      vinculos: {
        'acceso-programa': {
          pasosHechos: ['acc-p1'],
          instruccionesHechas: ['acc-p1-t1', 'acc-p1-t2', 'acc-p1-t3'],
          verificacionHecha: [],
          actualizadoEn: '2026-10-02T12:00:00.000Z',
        },
      },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await esperar(
      () => textoPantalla().includes('Ingresa el usuario y la contraseña del escritorio remoto'),
      'la acción en que iba',
    )
    expect(textoPantalla()).toContain('Retomando · paso 1 de 7')
    expect(textoPantalla()).not.toContain('Cuándo usarla')
    expect(textoPantalla()).not.toContain('Antes de empezar')
    sinArquitectura()
    // Actuar dentro ya es haber elegido seguir: la línea de "Retomando" se va.
    await tocar(await esperarControl('Completar y seguir'))
    await esperar(() => textoPantalla().includes('Abre el programa de caja e ingresa su contraseña'), 'la acción siguiente')
    expect(textoPantalla()).not.toContain('Retomando ·')
  })

  it('"Tengo un problema" dentro de lo reutilizado habla del paso de la guía que se abrió', async () => {
    await sembrarCasoAlimentacion()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await empezarGuia()
    await esperar(() => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'), 'la primera acción reutilizada')
    await tocar(await esperarControl('Tengo un problema con esta acción: ver las salidas'))
    await esperar(() => textoPantalla().includes('Algo va mal en el paso 1'), 'las salidas del paso')
    // Saltar lleva al paso siguiente de la guía que se abrió.
    await tocar(await esperarControl(/^Seguir con el paso siguiente/))
    await esperar(() => textoPantalla().includes('Si aparece el aviso inicial, selecciona Salir'), 'el paso 2')
    expect((await db.progresoPasos.get('guia-alimentacion'))?.pasosSaltados).toEqual(['ali-p1'])
  })
})

describe('un solo flujo: varias guías seguidas (el computador nuevo, fase 3)', () => {
  it('cada paso hace aquí lo que reutiliza, uno detrás de otro, y solo el último termina', async () => {
    await sembrarCasoComputador()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-computador')
    await empezarGuia()
    const vistos: string[] = []

    await esperar(() => textoPantalla().includes('Abre el correo de prueba e inicia sesión'), 'el paso 1')
    vistos.push(textoPantalla())
    sinArquitectura()
    await tocar(await esperarControl('Completar y seguir'))

    await esperar(() => textoPantalla().includes('Crea la firma de prueba en el correo'), 'el paso 2, sin tarjeta que abrir')
    expect(control('Paso 2 de 3. Abrir el índice de pasos')).not.toBeNull()
    vistos.push(textoPantalla())
    sinArquitectura()
    await tocar(await esperarControl('Completar y seguir'))

    await esperar(() => textoPantalla().includes('Selecciona Conectar en la impresora de prueba'), 'el paso 3')
    vistos.push(textoPantalla())
    sinArquitectura()
    // Con esto termina de verdad la guía que se abrió.
    await tocar(await esperarControl('Completar y terminar'))
    await esperar(() => textoPantalla().includes('Guía terminada'), 'la guía terminada')
    await esperar(() => document.activeElement?.textContent === 'Guía terminada', 'el foco en el cierre')

    // Por el camino no apareció ningún requisito de dentro ni su numeración.
    for (const texto of vistos) {
      expect(texto).not.toContain('Correo de prueba configurado.')
      expect(texto).not.toContain('Impresora de prueba encendida.')
      expect(texto).not.toContain('Paso 1 de 1')
    }
  })

  it('un paso de más adelante se consulta leyendo lo que pide, sin abrir ni marcar nada', async () => {
    await sembrarCasoComputador()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-computador')
    await empezarGuia()
    await esperar(() => textoPantalla().includes('Abre el correo de prueba e inicia sesión'), 'el paso 1')
    await tocar(await esperarControl(/^Paso 3 de 3: Instalar la impresora de la persona/))
    await esperar(() => textoPantalla().includes('Solo consulta'), 'la consulta del paso 3')
    const texto = textoPantalla()
    expect(texto).toContain('Instalar la impresora de la persona')
    expect(texto).toContain('Selecciona Conectar en la impresora de prueba')
    expect(control(/^Abrir:/)).toBeNull()
    sinArquitectura()
    await tocar(await esperarControl('Ir al paso 1'))
    await esperar(() => textoPantalla().includes('Abre el correo de prueba e inicia sesión'), 'de vuelta al paso 1')
    expect((await db.progresoPasos.get('guia-computador'))?.vinculos?.['impresora-prueba']).toBeUndefined()
  })
})

describe('lo opcional sigue siendo un desvío, dicho sin vocabulario interno (fase 3)', () => {
  it('una consulta se ofrece "Si lo necesitas", se abre en el sitio y vuelve al paso exacto', async () => {
    await sembrarDiagnosticoConConsultas()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-diagnostico')
    await esperar(() => textoPantalla().includes('Confirma cómo estaba instalada la impresora'), 'la tarea')
    await esperar(() => textoPantalla().includes('Si lo necesitas'), 'lo que se ofrece')
    expect(textoPantalla()).toContain('Sin empezar')
    sinArquitectura()
    await tocar(await esperarControl('Abrir: Agregar una impresora de prueba por su dirección'))
    await esperar(() => textoPantalla().includes('Abre Impresoras y escáneres'), 'la consulta abierta')
    expect(control('Volver al paso 1')).not.toBeNull()
    sinArquitectura()
    await tocar(await esperarControl('Volver al paso 1'))
    await esperar(() => textoPantalla().includes('Confirma cómo estaba instalada la impresora'), 'de vuelta en la acción')
  })

  it('el "No" de una decisión sigue en el flujo: sus acciones en el sitio y, al terminar, lo que venía después', async () => {
    await sembrarDecisionConDestino()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-envio')
    await completarHasta('¿La persona solo necesita ver el archivo?')
    expect(textoPantalla()).toContain('Si respondes que no, sigues con «Crear un vínculo de prueba con permiso de edición»')
    await tocar(await esperarControl(/^No: seguir con/))
    await esperar(() => textoPantalla().includes('Selecciona Puede editar'), 'el camino del no')
    expect(control('Paso 1 de 2. Abrir el índice de pasos')).not.toBeNull()
    sinArquitectura()
    // "Anterior" desde su primera acción deshace la respuesta.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => control(/^No: seguir con/), 'de vuelta en la decisión, sin responder')
    await tocar(await esperarControl(/^No: seguir con/))
    await esperar(() => textoPantalla().includes('Selecciona Puede editar'), 'otra vez el camino del no')
    await tocar(await esperarControl('Completar y seguir'))
    await esperar(() => textoPantalla().includes('Pega el vínculo y envía el correo'), 'lo que venía después')
    sinArquitectura()
  })
})

describe('lo que el paso traía no se pierde en el flujo (fase 3)', () => {
  it('el "para qué" y el aviso del paso que reutiliza van con la primera acción reutilizada, y solo con ella', async () => {
    await sembrarAccesoAlPrograma()
    const aviso: BloquePaso = {
      ...pasoPrueba('aux', 'aux', ['aux']).bloques[0],
      id: 'reg-p1-aviso',
      tipo: 'aviso',
      texto: 'Si hay ventas abiertas en la caja de prueba, entrar las cierra.',
      tono: 'precaucion',
      tipoTarea: null,
      alcance: 'paso',
    }
    await sembrarGuia({
      id: 'guia-registro',
      titulo: 'Registrar a una persona de prueba en el programa de caja',
      pasos: [
        {
          ...contenedor('reg-p1', 'Ingresar al programa de caja', 'acceso-programa', 'Acceder al programa de caja por escritorio remoto'),
          objetivo: 'Tener el programa de caja abierto para registrar a la persona.',
          bloques: [aviso],
        },
        pasoPrueba('reg-p2', 'Guardar el registro', ['Selecciona Guardar']),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-registro')
    // Sin orientación ni requisitos propios abre en su primera acción: lo que
    // pide la guía reutilizada no crea un "Antes de empezar".
    await esperar(() => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'), 'la primera acción reutilizada')
    expect(textoPantalla()).not.toContain('Antes de empezar')
    // El riesgo del paso, antes de actuar.
    expect(textoPantalla()).toContain('Si hay ventas abiertas en la caja de prueba, entrar las cierra.')
    // Su "para qué", a un toque, como el de cualquier paso.
    await tocar(await esperarControl(/^Más información/))
    await esperar(
      () => textoPantalla().includes('Tener el programa de caja abierto para registrar a la persona.'),
      'el "para qué" del paso que reutiliza',
    )
    sinArquitectura()
    // Solo con la primera acción: la siguiente ya no lo repite.
    await tocar(await esperarControl('Completar y seguir'))
    await esperar(() => textoPantalla().includes('Escribe la dirección del servidor de prueba'), 'la segunda acción')
    expect(textoPantalla()).not.toContain('Si hay ventas abiertas en la caja de prueba, entrar las cierra.')
    expect(textoPantalla()).not.toContain('Tener el programa de caja abierto para registrar a la persona.')
  })
})

describe('el paso entero también es un solo flujo (fase 3)', () => {
  it('lo reutilizado se ve como parte del paso, sin fila propia ni sus requisitos', async () => {
    await sembrarCasoAlimentacion()
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-alimentacion')
    await empezarGuia()
    await esperar(
      () => textoPantalla().includes('Busca y abre Conexión a Escritorio remoto'),
      'lo reutilizado dentro del paso entero',
    )
    const texto = textoPantalla()
    expect(texto).toContain('Ingresar al programa de caja')
    expect(texto).not.toContain('Acceder al programa de caja por escritorio remoto')
    expect(texto).not.toContain('Estar conectado a la red desde la que se permite el escritorio remoto.')
    expect(texto).not.toContain('Esta guía')
    // Lo que debe verse confirma esas acciones: va después de ellas.
    expect(texto.indexOf('El programa de caja queda abierto y listo para trabajar.')).toBeGreaterThan(
      texto.indexOf('Busca y abre Conexión a Escritorio remoto'),
    )
    // El lector de pantalla y el teclado empiezan en el paso.
    await esperar(() => document.activeElement?.textContent === 'Ingresar al programa de caja', 'el foco en el paso')
    sinArquitectura()
  })

  it('la guía que exige una tarea se hace dentro del paso, sin un enlace que saque de la ejecución', async () => {
    await sembrarGuia({
      id: 'guia-controlador',
      titulo: 'Instalar el controlador de la impresora de prueba',
      pasos: [pasoPrueba('con-p1', 'Instalar el controlador', ['Ejecuta el instalador del controlador de prueba'])],
    })
    const paso = pasoPrueba('imp-p1', 'Probar la impresora', ['Imprime una página de prueba'])
    paso.bloques.push({
      ...paso.bloques[0],
      id: 'imp-p1-g1',
      tipo: 'guia',
      texto: '',
      tipoTarea: null,
      tareaId: 'imp-p1-t1',
      alcance: 'tarea',
      guiaArticuloId: 'guia-controlador',
      guiaArticuloTitulo: 'Instalar el controlador de la impresora de prueba',
      intencionGuia: 'necesario',
    })
    await sembrarGuia({ id: 'guia-imprimir', titulo: 'Imprimir la primera página de prueba', pasos: [paso] })
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-imprimir')
    await esperar(
      () => textoPantalla().includes('Ejecuta el instalador del controlador de prueba'),
      'lo que la tarea exige, dentro del paso',
    )
    expect(textoPantalla()).toContain('Imprime una página de prueba')
    expect(textoPantalla()).not.toContain('se abre aparte')
    expect(textoPantalla()).not.toContain('terminarla ahí no cierra este paso')
    sinArquitectura()
  })

  it('el "No" de una decisión sigue con su camino, sin presentarlo como una falla', async () => {
    await sembrarDecisionConDestino()
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-envio')
    await tocar(await esperarControl('No, seguir con «Crear un vínculo de prueba con permiso de edición»'))
    await esperar(() => textoPantalla().includes('Selecciona Puede editar'), 'el camino del no, en el sitio')
    const texto = textoPantalla()
    expect(texto).toContain('Si la respuesta es no')
    expect(texto).not.toContain('Si esto falla')
    expect(texto).not.toContain('contingencia')
    expect(texto).not.toContain('Paso 1 de 1')
    sinArquitectura()
  })
})
