// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Diagnostico, type NodoDiagnostico, type OpcionDiagnostico } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { raizDelProcedimiento } from '../../lib/progresoDiagnostico'
import { bloquear } from '../boveda/sesionBoveda'
import {
  anclarMaestra,
  campoBuscador,
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  MAESTRA_PRUEBA,
  montar,
  navegarAtras,
  pasoPrueba,
  sembrarCredencial,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { ResolverPage } from '../inicio/ResolverPage'
import { GuiaPage } from '../soluciones/GuiaPage'
import { DiagnosticoRunPage } from './DiagnosticoRunPage'
import { DiagnosticosPage } from './DiagnosticosPage'

// RESOLUCIÓN GUIADA (tarea 263, encargo del 2026-09-22). Se prueba el
// RECORRIDO con las pantallas de verdad, con los cinco ejemplos del
// encargo en versión inventada:
//
//   A y B  un procedimiento directo: se escribe en Resolver y se abre la
//          guía en su paso 1, sin ninguna pregunta.
//   C      "la impresora no imprime": una guía con preguntas cuyas
//          respuestas llevan a caminos distintos (seguir, ejecutar un
//          procedimiento y volver, escalar).
//   D      "no puede iniciar sesión": distingue la causa y lleva al
//          procedimiento que corresponde.
//   E      una guía con un incidente en medio: la decisión abre una rama,
//          se resuelve y se vuelve al punto exacto de la principal.
//
// Y lo transversal: el procedimiento dentro del recorrido tiene su propio
// avance (la guía suelta no se entera), salir y volver retoma, la
// credencial se consulta sin salir, y el final dice cómo termina.
//
// Todo lo sembrado es INVENTADO.

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/diagnostico/:diagnosticoId', elemento: <DiagnosticoRunPage /> },
  { ruta: '/diagnostico/:diagnosticoId/editar', elemento: <p>EDITOR DEL RECORRIDO</p> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
  { ruta: '/boveda/:credencialId', elemento: <p>FICHA DE LA BÓVEDA</p> },
]

const AHORA = '2026-09-22T12:00:00.000Z'

function opcion(id: string, etiqueta: string, extra: Partial<OpcionDiagnostico> = {}): OpcionDiagnostico {
  return {
    id,
    etiqueta,
    siguienteNodoId: null,
    articuloId: null,
    articuloTitulo: '',
    mensajeFinal: '',
    resultado: '',
    ...extra,
  }
}

function pregunta(id: string, texto: string, opciones: OpcionDiagnostico[]): NodoDiagnostico {
  return { id, tituloInterno: '', pregunta: texto, descripcion: '', opciones }
}

async function sembrarRecorrido(id: string, titulo: string, nodos: NodoDiagnostico[]): Promise<Diagnostico> {
  const diagnostico: Diagnostico = {
    id,
    categoriaId: 'cat-pruebas',
    titulo,
    descripcion: '',
    nodos,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  }
  await db.diagnosticos.put(diagnostico)
  return diagnostico
}

const TITULO_CONECTAR = 'Conectar la impresora compartida de prueba'
const TITULO_IMPRESORA = 'La impresora de prueba no imprime'

/**
 * Ejemplo C. La guía "Conectar..." lleva una credencial en su paso; el
 * recorrido pregunta si la impresora aparece y, según la respuesta,
 * sigue, ejecuta la guía y vuelve, o termina en "Hay que escalar".
 */
async function sembrarImpresora(): Promise<void> {
  await sembrarGuia({
    id: 'guia-conectar',
    titulo: TITULO_CONECTAR,
    pasos: [
      {
        ...pasoPrueba('conectar-p1', 'Agregar la impresora', [
          'Abrir Impresoras y escáneres',
          'Agregar la impresora compartida de prueba',
        ]),
        vinculoProtegido: { tipo: 'credencial', id: 'cred-impresion', titulo: 'Acceso de prueba al servidor de impresión' },
      },
    ],
  })
  await sembrarRecorrido('rec-impresora', TITULO_IMPRESORA, [
    pregunta('n1', '¿La impresora aparece en Windows?', [
      opcion('o-si', 'Sí', { siguienteNodoId: 'n2' }),
      opcion('o-no', 'No', { siguienteNodoId: 'n2', articuloId: 'guia-conectar', articuloTitulo: TITULO_CONECTAR }),
      opcion('o-sin-conexion', 'Aparece sin conexión', {
        mensajeFinal: 'Avisar a la mesa de ayuda de prueba con el nombre de la impresora.',
        resultado: 'escalar',
      }),
    ]),
    pregunta('n2', '¿Ahora imprime una página de prueba?', [
      opcion('o2-si', 'Sí', { mensajeFinal: 'La impresora de prueba quedó funcionando.', resultado: 'solucionado' }),
      opcion('o2-no', 'No', { mensajeFinal: 'Revisar el controlador de prueba.', resultado: 'sin_resolver' }),
    ]),
  ])
}

/** El botón grande del pie de la ejecución, por su texto exacto. */
function principal(texto: string): HTMLElement | null {
  return control(new RegExp(`^${texto}$`))
}

/**
 * Una respuesta del recorrido, por su etiqueta. La que lleva a una guía
 * dice debajo "Te lleva a «...»", así que su texto entero es más largo.
 */
function respuesta(etiqueta: string): HTMLElement | null {
  return (
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('main button')).find(
      (boton) => boton.querySelector('span')?.textContent?.trim() === etiqueta,
    ) ?? null
  )
}

/** El enlace de un resultado o de una fila de Recientes, por su título. */
function enlaceDe(titulo: string): HTMLAnchorElement | undefined {
  return Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent?.includes(titulo))
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('entrar desde Resolver sin elegir herramienta', () => {
  it('ejemplo C: "impresora no imprime" encuentra la guía con preguntas y la abre en su primera pregunta', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/')

    await escribir(await esperar(campoBuscador, 'el buscador de Resolver'), 'impresora no imprime')
    const enlace = await esperar(() => enlaceDe(TITULO_IMPRESORA), 'el recorrido entre los resultados')
    // Se presenta como una guía más, no como otra herramienta.
    expect(textoPantalla()).toContain('Guía con preguntas')
    expect(control(/^Iniciar el diagnóstico/)).toBeNull()

    await tocar(enlace)
    await esperar(() => textoPantalla().includes('¿La impresora aparece en Windows?'), 'la primera pregunta')
    expect(ubicacionActual().pathname).toBe('/diagnostico/rec-impresora')
    const texto = textoPantalla()
    expect(texto).toContain('Resolviendo')
    expect(texto).toContain('Decide')
    expect(texto).toContain(`Te lleva a «${TITULO_CONECTAR}»`)
    expect(texto).not.toContain('Diagnóstico')
  })

  it('salir del recorrido vuelve a Resolver con la búsqueda escrita', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador de Resolver'), 'impresora no imprime')
    await tocar(await esperar(() => enlaceDe(TITULO_IMPRESORA), 'el recorrido'))
    await esperar(() => textoPantalla().includes('¿La impresora aparece en Windows?'), 'la primera pregunta')

    await tocar(await esperarControl('Guardar el avance y salir'))

    await esperar(() => ubicacionActual().pathname === '/', 'vuelve a Resolver')
    expect((await esperar(campoBuscador, 'el buscador de Resolver')).value).toBe('impresora no imprime')
    // Abrirlo y salir sin responder nada no lo deja "a medias".
    await esperarQue(async () => (await db.progresoDiagnostico.get('rec-impresora')) === undefined, 'sin sesión fantasma')
  })

  it('ejemplos A y B: un procedimiento directo abre la guía en su paso 1, sin preguntas', async () => {
    await sembrarGuia({
      id: 'guia-desbloquear',
      titulo: 'Desbloquear usuario de prueba en el directorio',
      pasos: [
        pasoPrueba('desb-p1', 'Buscar la cuenta', ['Abrir la consola del directorio de prueba']),
        pasoPrueba('desb-p2', 'Desbloquear', ['Marcar Desbloquear cuenta']),
      ],
    })
    // Una credencial que se llama parecido no le gana a la guía (ejemplo B).
    await anclarMaestra()
    await sembrarCredencial({ id: 'cred-directorio', titulo: 'Usuario administrador del directorio de prueba', tipo: 'cuenta' })
    await montar(RUTAS, '/')

    await escribir(await esperar(campoBuscador, 'el buscador de Resolver'), 'desbloquear usuario')
    const primero = await esperar(
      () => document.body.querySelector<HTMLAnchorElement>('main a[href^="/soluciones/"], main a[href^="/boveda/"]'),
      'el primer resultado navegable',
    )
    expect(primero.getAttribute('href')).toBe('/soluciones/cat-pruebas/guia-desbloquear')

    await tocar(primero)
    await esperar(() => textoPantalla().includes('Abrir la consola del directorio de prueba'), 'la primera acción')
    expect(textoPantalla()).toContain('Paso 1 de 2')
    expect(textoPantalla()).not.toContain('Decide')
  })
})

describe('ejemplo C: las respuestas cambian el camino', () => {
  it('"No" ejecuta la guía dentro del recorrido y, al terminarla, vuelve sola a la pregunta siguiente', async () => {
    await sembrarImpresora()
    // Lo que el técnico llevaba hecho en la guía por su cuenta.
    await db.progresoPasos.put({
      articuloId: 'guia-conectar',
      pasosHechos: [],
      instruccionesHechas: ['conectar-p1-t1'],
      verificacionHecha: [],
      actualizadoEn: AHORA,
    })
    await montar(RUTAS, '/diagnostico/rec-impresora')

    await tocar(await esperar(() => respuesta('No'), 'la respuesta No'))
    await esperar(() => textoPantalla().includes('Estás realizando'), 'la cabecera del procedimiento')
    expect(textoPantalla()).toContain(`Estás realizando «${TITULO_CONECTAR}» para continuar con «${TITULO_IMPRESORA}»`)
    // Empieza de cero DENTRO del recorrido: no hereda el avance suelto.
    await esperar(() => textoPantalla().includes('Abrir Impresoras y escáneres'), 'la primera acción del procedimiento')

    await tocar(await esperar(() => principal('Siguiente'), 'Siguiente'))
    await esperar(() => textoPantalla().includes('Agregar la impresora compartida de prueba'), 'la segunda acción')
    await tocar(await esperar(() => principal('Terminar'), 'Terminar'))

    // Regreso automático al punto exacto del recorrido.
    await esperar(() => textoPantalla().includes('¿Ahora imprime una página de prueba?'), 'la pregunta siguiente')
    expect(ubicacionActual().pathname).toBe('/diagnostico/rec-impresora')
    expect(textoPantalla()).toContain('¿La impresora aparece en Windows?: No')

    // La guía suelta sigue como estaba y el avance del recorrido se limpió.
    expect((await db.progresoPasos.get('guia-conectar'))?.instruccionesHechas).toEqual(['conectar-p1-t1'])
    expect(await db.progresoPasos.get(raizDelProcedimiento('rec-impresora'))).toBeUndefined()

    // Y el final "Solucionado" todavía pide confirmarlo.
    await tocar(await esperar(() => respuesta('Sí'), 'la respuesta Sí'))
    await esperar(() => textoPantalla().includes('La impresora de prueba quedó funcionando.'), 'el final')
    expect(textoPantalla()).toContain('Solucionado')
    expect(textoPantalla()).toContain(`Guías hechas: ${TITULO_CONECTAR}`)
    await tocar(await esperarControl('Sí, resuelto'))

    await esperar(() => ubicacionActual().pathname === '/', 'termina en Resolver')
    const ejecuciones = await db.ejecuciones_diagnostico.toArray()
    expect(ejecuciones).toHaveLength(1)
    expect(ejecuciones[0]).toMatchObject({ resuelto: 'si', motivo: '' })
    expect(ejecuciones[0].articulosEjecutados.map((a) => a.id)).toEqual(['guia-conectar'])
    expect(await db.progresoDiagnostico.get('rec-impresora')).toBeUndefined()
  })

  it('"Sí" sigue sin procedimiento y un final "Sigue sin resolverse" se registra sin preguntar', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/diagnostico/rec-impresora')

    await tocar(await esperar(() => respuesta('Sí'), 'la respuesta Sí'))
    await esperar(() => textoPantalla().includes('¿Ahora imprime una página de prueba?'), 'la segunda pregunta')
    expect(textoPantalla()).not.toContain('Estás realizando')

    await tocar(await esperar(() => respuesta('No'), 'la respuesta No'))
    await esperar(() => textoPantalla().includes('Sigue sin resolverse'), 'el final')
    expect(textoPantalla()).not.toContain('¿Quedó resuelto el problema?')
    await tocar(await esperarControl('Terminar'))

    await esperar(() => ubicacionActual().pathname === '/', 'termina en Resolver')
    const [ejecucion] = await db.ejecuciones_diagnostico.toArray()
    expect(ejecucion).toMatchObject({ resuelto: 'no', motivo: '' })
  })

  it('"Aparece sin conexión" termina en "Hay que escalar", no en resuelto', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/diagnostico/rec-impresora')

    await tocar(await esperar(() => respuesta('Aparece sin conexión'), 'la tercera respuesta'))
    await esperar(() => textoPantalla().includes('Hay que escalar'), 'el final de escalar')
    expect(textoPantalla()).toContain('Avisar a la mesa de ayuda de prueba con el nombre de la impresora.')
    expect(textoPantalla()).not.toContain('Solucionado')
    expect(control('Sí, resuelto')).toBeNull()
  })
})

describe('el procedimiento dentro del recorrido no se pierde', () => {
  it('volver a la pregunta y elegir lo mismo retoma donde iba; salir y volver desde Recientes, también', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/diagnostico/rec-impresora')

    await tocar(await esperar(() => respuesta('No'), 'la respuesta No'))
    await tocar(await esperar(() => principal('Siguiente'), 'Siguiente en la primera acción'))
    await esperar(() => textoPantalla().includes('Agregar la impresora compartida de prueba'), 'la segunda acción')

    // Volver a la pregunta deshace la respuesta, no lo hecho.
    await tocar(await esperarControl('Volver a la pregunta'))
    await esperar(() => respuesta('Aparece sin conexión'), 'de vuelta en la primera pregunta')
    await tocar(await esperar(() => respuesta('No'), 'otra vez No'))
    await esperar(() => textoPantalla().includes('Agregar la impresora compartida de prueba'), 'retoma en la segunda acción')

    // Salir guarda: Resolver lo ofrece en Recientes, diciendo dónde va.
    await tocar(await esperarControl('Guardar el avance y salir'))
    await esperar(() => ubicacionActual().pathname === '/', 'sale a Resolver')
    const fila = await esperar(() => enlaceDe(TITULO_IMPRESORA), 'el recorrido en Recientes')
    expect(fila.textContent).toContain(`Haciendo «${TITULO_CONECTAR}»`)
    expect(fila.getAttribute('aria-label')).toBe(`Continuar ${TITULO_IMPRESORA}`)
    // Y la guía suelta no aparece como empezada: no es una tarea pendiente global.
    expect(document.body.querySelector('a[href="/soluciones/cat-pruebas/guia-conectar"]')).toBeNull()

    await tocar(fila)
    await esperar(() => textoPantalla().includes('Agregar la impresora compartida de prueba'), 'retoma la misma acción')
    expect(textoPantalla()).toContain('Estás realizando')
  })

  it('el botón atrás del teléfono desde el procedimiento no rompe el recorrido', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador de Resolver'), 'impresora no imprime')
    await tocar(await esperar(() => enlaceDe(TITULO_IMPRESORA), 'el recorrido'))
    await tocar(await esperar(() => respuesta('No'), 'la respuesta No'))
    await esperar(() => textoPantalla().includes('Abrir Impresoras y escáneres'), 'el procedimiento')

    await navegarAtras()
    await esperar(() => ubicacionActual().pathname === '/', 'vuelve a Resolver')
    expect((await esperar(campoBuscador, 'el buscador')).value).toBe('impresora no imprime')
    // El recorrido sigue guardado en su procedimiento.
    const sesion = await db.progresoDiagnostico.get('rec-impresora')
    expect(sesion?.estado.tipo).toBe('articulo')
  })

  it('la credencial del paso se consulta ahí mismo: se desbloquea sin salir del recorrido', async () => {
    await sembrarImpresora()
    await anclarMaestra()
    await sembrarCredencial({
      id: 'cred-impresion',
      titulo: 'Acceso de prueba al servidor de impresión',
      tipo: 'cuenta',
      usuario: 'impresion.prueba',
      contrasena: 'Clave-De-Prueba-9',
    })
    bloquear()
    await montar(RUTAS, '/diagnostico/rec-impresora')

    await tocar(await esperar(() => respuesta('No'), 'la respuesta No'))
    await esperar(() => textoPantalla().includes('Credencial necesaria'), 'la credencial del paso')
    // Tapada: nada protegido en pantalla hasta pedirlo.
    expect(textoPantalla()).not.toContain('impresion.prueba')

    await tocar(await esperarControl('Dato protegido: Acceso de prueba al servidor de impresión'))
    const campo = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
      'el desbloqueo en línea',
    )
    await escribir(campo, MAESTRA_PRUEBA)
    await enviarFormulario(campo)

    await esperar(() => textoPantalla().includes('impresion.prueba'), 'el usuario descifrado')
    expect(textoPantalla()).not.toContain('Clave-De-Prueba-9')
    expect(ubicacionActual().pathname).toBe('/diagnostico/rec-impresora')
    expect(textoPantalla()).toContain('Estás realizando')
  })
})

describe('ejemplo D: distinguir la causa lleva al procedimiento que corresponde', () => {
  it('"Cuenta bloqueada" ejecuta el desbloqueo; "Contraseña vencida", el cambio de clave', async () => {
    await sembrarGuia({
      id: 'guia-desbloqueo',
      titulo: 'Desbloquear la cuenta de prueba',
      pasos: [pasoPrueba('desbloqueo-p1', 'Desbloquear', ['Marcar Desbloquear cuenta de prueba'])],
    })
    await sembrarGuia({
      id: 'guia-clave',
      titulo: 'Cambiar la clave vencida de prueba',
      pasos: [pasoPrueba('clave-p1', 'Cambiar', ['Asignar una clave temporal de prueba'])],
    })
    await sembrarRecorrido('rec-sesion', 'El usuario de prueba no puede iniciar sesión', [
      pregunta('s1', '¿Qué mensaje aparece al entrar?', [
        opcion('s-bloq', 'Cuenta bloqueada', {
          articuloId: 'guia-desbloqueo',
          articuloTitulo: 'Desbloquear la cuenta de prueba',
          mensajeFinal: 'Pedir que vuelva a entrar.',
          resultado: 'solucionado',
        }),
        opcion('s-venc', 'Contraseña vencida', {
          articuloId: 'guia-clave',
          articuloTitulo: 'Cambiar la clave vencida de prueba',
          mensajeFinal: 'Entregar la clave temporal.',
          resultado: 'solucionado',
        }),
        opcion('s-otro', 'Otro mensaje', { resultado: 'falta_informacion', mensajeFinal: 'Anotar el mensaje exacto.' }),
      ]),
    ])
    await montar(RUTAS, '/diagnostico/rec-sesion')

    await tocar(await esperar(() => respuesta('Contraseña vencida'), 'la causa'))
    await esperar(() => textoPantalla().includes('Asignar una clave temporal de prueba'), 'el procedimiento de la clave')
    expect(textoPantalla()).not.toContain('Marcar Desbloquear cuenta de prueba')
    await tocar(await esperar(() => principal('Terminar'), 'Terminar'))

    await esperar(() => textoPantalla().includes('Entregar la clave temporal.'), 'el final de esa rama')
    expect(textoPantalla()).toContain('¿Quedó resuelto el problema?')
  })
})

describe('ejemplo E: un incidente en medio de una guía', () => {
  it('la decisión abre la rama, se resuelve y se vuelve al punto exacto de la principal', async () => {
    const decision = {
      ...CAMPOS_BLOQUE_VACIOS,
      id: 'dian-p1-t2',
      tipo: 'tarea' as const,
      texto: '¿Encontraste el número de resolución?',
      tipoTarea: 'decision' as const,
      decisionArticuloId: 'guia-localizar',
      decisionArticuloTitulo: 'Localizar la resolución de prueba',
    }
    const p1 = pasoPrueba('dian-p1', 'Preparar la actualización', ['Abrir el POS de prueba', 'Pendiente'])
    p1.bloques = [p1.bloques[0], decision, { ...p1.bloques[0], id: 'dian-p1-t3', texto: 'Escribir el número en el POS de prueba' }]
    await sembrarGuia({ id: 'guia-dian', titulo: 'Actualizar la resolución de prueba en el POS', pasos: [p1] })
    await sembrarGuia({
      id: 'guia-localizar',
      titulo: 'Localizar la resolución de prueba',
      pasos: [pasoPrueba('loc-p1', 'Buscar', ['Buscar el PDF de la resolución de prueba'])],
    })
    // La rama también es una guía suelta con su propio avance: no se toca.
    await db.progresoPasos.put({
      articuloId: 'guia-localizar',
      pasosHechos: ['loc-p1'],
      instruccionesHechas: ['loc-p1-t1'],
      verificacionHecha: [],
      actualizadoEn: AHORA,
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-dian')

    await esperar(() => textoPantalla().includes('Abrir el POS de prueba'), 'la primera acción')
    await tocar(await esperar(() => principal('Siguiente'), 'Siguiente'))
    await esperar(() => textoPantalla().includes('¿Encontraste el número de resolución?'), 'la decisión')

    await tocar(await esperarControl('No: abrir «Localizar la resolución de prueba»'))
    await esperar(() => textoPantalla().includes('Buscar el PDF de la resolución de prueba'), 'la rama')
    expect(textoPantalla()).toContain(
      'Estás realizando «Localizar la resolución de prueba» para continuar con «Actualizar la resolución de prueba en el POS»',
    )
    await tocar(await esperar(() => principal('Terminar'), 'Terminar la rama'))

    // De vuelta en la principal, en el punto exacto: la decisión, ya
    // respondida, y de ahí a la acción que la seguía.
    await esperar(
      () => !textoPantalla().includes('Estás realizando') && textoPantalla().includes('¿Encontraste el número de resolución?'),
      'de vuelta en la decisión',
    )
    expect(textoPantalla()).toContain('Hecha')
    expect(ubicacionActual().pathname).toBe('/soluciones/cat-pruebas/guia-dian')
    await tocar(await esperar(() => principal('Siguiente'), 'Siguiente tras la decisión'))
    await esperar(() => textoPantalla().includes('Escribir el número en el POS de prueba'), 'la acción siguiente')
    const avance = await db.progresoPasos.get('guia-dian')
    expect(avance?.instruccionesHechas).toEqual(expect.arrayContaining(['dian-p1-t1', 'dian-p1-t2']))
    expect((await db.progresoPasos.get('guia-localizar'))?.instruccionesHechas).toEqual(['loc-p1-t1'])
  })
})

describe('la administración sigue en Más', () => {
  it('un recorrido abierto desde la lista de diagnósticos vuelve a la lista al salir', async () => {
    await sembrarImpresora()
    await montar([...RUTAS, { ruta: '/diagnostico', elemento: <DiagnosticosPage /> }], '/diagnostico')

    await tocar(await esperar(() => enlaceDe(TITULO_IMPRESORA), 'el recorrido en la lista'))
    await esperar(() => textoPantalla().includes('¿La impresora aparece en Windows?'), 'la primera pregunta')
    expect(textoPantalla()).toContain('Diagnósticos · vuelves aquí al terminar')

    await tocar(await esperarControl('Guardar el avance y salir'))
    await esperar(() => ubicacionActual().pathname === '/diagnostico', 'vuelve a la lista')
  })
})

describe('compatibilidad con los recorridos guardados antes', () => {
  it('una respuesta final sin "cómo termina" sigue preguntando si quedó resuelto', async () => {
    const vieja = { ...opcion('v-fin', 'Sí', { mensajeFinal: 'Listo.' }) } as Partial<OpcionDiagnostico>
    delete vieja.resultado
    await sembrarRecorrido('rec-viejo', 'Recorrido de prueba guardado antes', [
      pregunta('v1', '¿Enciende el equipo de prueba?', [vieja as OpcionDiagnostico]),
    ])
    await montar(RUTAS, '/diagnostico/rec-viejo')

    await tocar(await esperar(() => respuesta('Sí'), 'la respuesta'))
    await esperar(() => textoPantalla().includes('Listo.'), 'el final')
    expect(textoPantalla()).toContain('Recorrido terminado')
    expect(textoPantalla()).toContain('¿Quedó resuelto el problema?')
  })
})
