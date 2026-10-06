// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso, type OpcionDecision, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'
import { ProcedimientoVista } from './ProcedimientoVista'
import { ProveedorEjecucion } from './ProveedorEjecucion'

// LAS DECISIONES CON OPCIONES EN LA EJECUCIÓN (tarea 302, fase 3).
//
// Se recorre con la pantalla de verdad lo que pidió el encargo:
//
//   - la pregunta con sus respuestas a la vista, cada una con su ayuda;
//   - responder lleva en el acto por el camino de esa respuesta, y los
//     pasos del otro camino no aparecen ni cuentan;
//   - los dos caminos vuelven a juntarse en los pasos comunes;
//   - "Anterior" vuelve por el camino recorrido, y cambiar la respuesta
//     recalcula la ruta sin dejar pasos "fantasma";
//   - una respuesta puede abrir otra guía, que se hace en el flujo;
//   - recargar conserva la ruta elegida, como conserva el resto del avance.
//
// La guía tiene la FORMA de la copia de seguridad del correo (una decisión
// por versión al principio y los pasos comunes al final), con textos
// inventados.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

const RUTA_COPIA = '/soluciones/cat-pruebas/guia-copia'

function decision(id: string, texto: string, opciones: OpcionDecision[]): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'decision', opciones }
}

function conAlTerminar(paso: PasoProcedimiento, pasoId: string): PasoProcedimiento {
  return { ...paso, alTerminar: { tipo: 'paso', pasoId } }
}

// 1 identifica y pregunta (clásica -> 2, nueva -> 3); 2 sigue en 4; 3 llega
// a 4 por el orden; 4 y 5 son comunes. Cada camino tiene cuatro pasos.
function pasosCopia(): PasoProcedimiento[] {
  const identificar = pasoPrueba('cp-p1', 'Identificar la versión del programa', ['Confirmar el buzón de la persona'])
  identificar.bloques.push(
    decision('cp-version', '¿Qué versión del programa de prueba usas?', [
      {
        id: 'cp-clasica',
        titulo: 'Versión clásica',
        descripcion: 'Veo el menú Archivo arriba.',
        destino: { tipo: 'paso', pasoId: 'cp-p2' },
      },
      {
        id: 'cp-nueva',
        titulo: 'Versión nueva',
        descripcion: 'Uso la versión nueva del programa.',
        destino: { tipo: 'paso', pasoId: 'cp-p3' },
      },
    ]),
  )
  return [
    identificar,
    conAlTerminar(pasoPrueba('cp-p2', 'Exportar en la versión clásica', ['Abrir Archivo y elegir Exportar']), 'cp-p4'),
    pasoPrueba('cp-p3', 'Exportar en la versión nueva', ['Abrir Configuración y elegir Exportar']),
    pasoPrueba('cp-p4', 'Guardar y comprobar el archivo', ['Comprobar que el archivo existe']),
    pasoPrueba('cp-p5', 'Copiar el archivo al servidor de prueba', ['Copiar el archivo a la carpeta de la persona']),
  ]
}

async function sembrarCopia(): Promise<void> {
  await sembrarGuia({ id: 'guia-copia', titulo: 'Copia de seguridad del correo de prueba', pasos: pasosCopia() })
}

/** El control grande del pie, por su rótulo exacto. */
function principal(texto: string): HTMLElement | null {
  return control(new RegExp(`^${texto}$`))
}

/** La respuesta de la decisión cuyo título empieza por `titulo`. */
function opcion(titulo: string): HTMLElement | null {
  return control(new RegExp(`^${titulo}`))
}

/** La fila del índice cuyo texto contiene `titulo`, dentro de la hoja. */
function filasDelIndice(): string[] {
  const hoja = document.body.querySelector('[role="dialog"]')
  if (!hoja) return []
  return Array.from(hoja.querySelectorAll<HTMLElement>('ol button')).map((boton) => boton.textContent ?? '')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una decisión con dos opciones que llevan a dos pasos', () => {
  it('pregunta con sus respuestas, lleva solo por el camino elegido y los caminos se juntan', async () => {
    await sembrarCopia()
    await montar(RUTAS, RUTA_COPIA)
    await esperar(() => textoPantalla().includes('Confirmar el buzón de la persona'), 'la primera acción')
    // Los dos caminos miden lo mismo: el total se sabe antes de responder.
    expect(control(/^Paso 1 de 4\. Abrir el índice de pasos$/)).not.toBeNull()

    await tocar(await esperar(() => principal('Completar y seguir'), 'Completar y seguir'))
    await esperar(() => textoPantalla().includes('¿Qué versión del programa de prueba usas?'), 'la pregunta')
    // La pregunta es la acción: sus respuestas con su ayuda, y el pie dice lo que falta.
    expect(textoPantalla()).toContain('Veo el menú Archivo arriba.')
    expect(textoPantalla()).toContain('Uso la versión nueva del programa.')
    expect(principal('Elige una opción')?.hasAttribute('disabled')).toBe(true)
    const grupo = document.body.querySelector('[role="group"]')
    expect(grupo?.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.getElementById(grupo?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      '¿Qué versión del programa de prueba usas?',
    )

    await tocar(await esperar(() => opcion('Versión clásica'), 'la respuesta clásica'))
    await esperar(() => textoPantalla().includes('Abrir Archivo y elegir Exportar'), 'el camino clásico')
    expect(textoPantalla()).not.toContain('Abrir Configuración y elegir Exportar')
    expect(control(/^Paso 2 de 4\. Abrir el índice de pasos$/)).not.toBeNull()
    const avance = await db.progresoPasos.get('guia-copia')
    expect(avance?.elecciones).toEqual({ 'cp-version': 'cp-clasica' })
    expect(avance?.pasosHechos).toEqual(['cp-p1'])

    // El camino clásico vuelve a los pasos comunes: después del 2, el de guardar.
    await tocar(await esperar(() => principal('Completar y seguir'), 'cerrar el camino clásico'))
    await esperar(() => textoPantalla().includes('Comprobar que el archivo existe'), 'el paso común')
    expect(control(/^Paso 3 de 4\. Abrir el índice de pasos$/)).not.toBeNull()

    // El índice enseña la ruta elegida, sin el otro camino.
    await tocar(await esperarControl(/^Paso 3 de 4\. Abrir el índice de pasos$/))
    await esperar(() => filasDelIndice().length > 0, 'el índice')
    const filas = filasDelIndice().join(' | ')
    expect(filas).toContain('Exportar en la versión clásica')
    expect(filas).not.toContain('Exportar en la versión nueva')
    expect(filas).toContain('Copiar el archivo al servidor de prueba')
  })

  it('"Anterior" vuelve por el camino recorrido y cambiar la respuesta recalcula la ruta sin pasos fantasma', async () => {
    await sembrarCopia()
    await montar(RUTAS, RUTA_COPIA)
    await tocar(await esperar(() => principal('Completar y seguir'), 'la primera acción'))
    await tocar(await esperar(() => opcion('Versión clásica'), 'la respuesta clásica'))
    await esperar(() => textoPantalla().includes('Abrir Archivo y elegir Exportar'), 'el camino clásico')
    await tocar(await esperar(() => principal('Completar y seguir'), 'cerrar el camino clásico'))
    await esperar(() => textoPantalla().includes('Comprobar que el archivo existe'), 'el paso común')

    // Desde el paso común, "Anterior" lleva al camino que se recorrió (el 2), no al 3.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Abrir Archivo y elegir Exportar'), 'de vuelta en el camino clásico')
    expect(textoPantalla()).not.toContain('Abrir Configuración y elegir Exportar')

    // Y desde ahí, a la pregunta ya respondida.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('¿Qué versión del programa de prueba usas?'), 'la pregunta respondida')
    expect(textoPantalla()).toContain('Respondida')
    expect(opcion('Versión clásica')?.textContent).toContain('Tu respuesta')
    expect(opcion('Versión nueva')?.textContent).not.toContain('Tu respuesta')
    expect(textoPantalla()).toContain('Si eliges otra respuesta, se reinicia lo que hiciste después de esta pregunta.')

    await tocar(await esperar(() => opcion('Versión nueva'), 'la respuesta nueva'))
    await esperar(() => textoPantalla().includes('Abrir Configuración y elegir Exportar'), 'el camino nuevo')
    expect(control(/^Paso 2 de 4\. Abrir el índice de pasos$/)).not.toBeNull()

    // Nada de lo hecho con la respuesta anterior sigue contando.
    await esperarQue(
      async () => (await db.progresoPasos.get('guia-copia'))?.elecciones?.['cp-version'] === 'cp-nueva',
      'la respuesta nueva guardada',
    )
    const avance = await db.progresoPasos.get('guia-copia')
    expect(avance?.pasosHechos).toEqual(['cp-p1'])
    expect(avance?.instruccionesHechas).not.toContain('cp-p2-t1')
    expect(avance?.instruccionesHechas).toEqual(expect.arrayContaining(['cp-p1-t1', 'cp-version']))

    // El camino nuevo llega a los mismos pasos comunes y la guía termina con sus cuatro pasos.
    await tocar(await esperar(() => principal('Completar y seguir'), 'cerrar el camino nuevo'))
    await esperar(() => textoPantalla().includes('Comprobar que el archivo existe'), 'el paso común')
    await tocar(await esperar(() => principal('Completar y seguir'), 'cerrar el paso común'))
    await esperar(() => textoPantalla().includes('Copiar el archivo a la carpeta de la persona'), 'el último paso')
    await tocar(await esperar(() => principal('Completar y terminar'), 'terminar'))
    await esperar(() => textoPantalla().includes('Guía terminada'), 'la guía terminada')
    expect(textoPantalla()).toContain('4 pasos')
  })

  it('recargar conserva la ruta elegida y retoma en su paso', async () => {
    await sembrarCopia()
    const primera = await montar(RUTAS, RUTA_COPIA)
    await tocar(await esperar(() => principal('Completar y seguir'), 'la primera acción'))
    await tocar(await esperar(() => opcion('Versión nueva'), 'la respuesta nueva'))
    await esperar(() => textoPantalla().includes('Abrir Configuración y elegir Exportar'), 'el camino nuevo')
    await primera.desmontar()

    await montar(RUTAS, RUTA_COPIA)
    await esperar(() => textoPantalla().includes('Abrir Configuración y elegir Exportar'), 'retoma en el camino nuevo')
    expect(textoPantalla()).toContain('Retomando · paso 2 de 4')
    expect(textoPantalla()).not.toContain('Abrir Archivo y elegir Exportar')
  })
})

describe('una respuesta que abre otra guía', () => {
  async function sembrarImpresora(): Promise<void> {
    await sembrarGuia({
      id: 'guia-controlador',
      titulo: 'Instalar el controlador de prueba',
      pasos: [
        pasoPrueba('ctl-p1', 'Descargar el controlador', ['Descargar el controlador de prueba']),
        pasoPrueba('ctl-p2', 'Instalar el controlador', ['Ejecutar el instalador de prueba']),
      ],
    })
    const revisar = pasoPrueba('imp-p1', 'Revisar la impresora de prueba', [])
    revisar.bloques = [
      decision('imp-controlador', '¿La impresora de prueba tiene su controlador?', [
        { id: 'imp-si', titulo: 'Sí, ya está instalado', descripcion: '', destino: { tipo: 'continuar' } },
        {
          id: 'imp-no',
          titulo: 'No, falta instalarlo',
          descripcion: 'No aparece en Dispositivos.',
          destino: { tipo: 'guia', articuloId: 'guia-controlador', titulo: 'Instalar el controlador de prueba' },
        },
      ]),
    ]
    await sembrarGuia({
      id: 'guia-impresora',
      titulo: 'Imprimir una hoja de prueba',
      pasos: [revisar, pasoPrueba('imp-p2', 'Imprimir la prueba', ['Imprimir la hoja de prueba'])],
    })
  }

  it('A continúa con el paso siguiente', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-impresora')
    await tocar(await esperar(() => opcion('Sí, ya está instalado'), 'la respuesta que continúa'))
    await esperar(() => textoPantalla().includes('Imprimir la hoja de prueba'), 'el paso siguiente')
    expect(textoPantalla()).not.toContain('Descargar el controlador de prueba')
  })

  it('B hace la otra guía en el flujo y después sigue; cambiar a A la deja fuera', async () => {
    await sembrarImpresora()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-impresora')
    await tocar(await esperar(() => opcion('No, falta instalarlo'), 'la respuesta que abre la guía'))

    // La guía de la respuesta, en el sitio, como acciones de este paso.
    await esperar(() => textoPantalla().includes('Descargar el controlador de prueba'), 'la guía de la respuesta')
    expect(control(/^Paso 1 de 2\. Abrir el índice de pasos$/)).not.toBeNull()
    await tocar(await esperar(() => principal('Completar y seguir'), 'la primera acción de la guía'))
    await esperar(() => textoPantalla().includes('Ejecutar el instalador de prueba'), 'la segunda acción de la guía')
    await tocar(await esperar(() => principal('Completar y seguir'), 'la última acción de la guía'))

    // Terminada, el recorrido sigue con el paso siguiente de la guía que se abrió.
    await esperar(() => textoPantalla().includes('Imprimir la hoja de prueba'), 'el paso siguiente')
    let avance = await db.progresoPasos.get('guia-impresora')
    expect(avance?.elecciones).toEqual({ 'imp-controlador': 'imp-no' })
    expect(avance?.pasosHechos).toEqual(['imp-p1'])
    expect(avance?.vinculos?.['guia-controlador']?.pasosHechos).toEqual(['ctl-p1', 'ctl-p2'])

    // "Anterior" vuelve por donde se vino: primero a lo que hizo la guía de
    // la respuesta (ya hecho, para leerlo), después a la pregunta.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Instalar el controlador de prueba'), 'la guía de la respuesta, hecha')
    expect(textoPantalla()).toContain('Descargar el controlador de prueba')
    expect(principal('Completar y seguir')).toBeNull()
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('¿La impresora de prueba tiene su controlador?'), 'la pregunta')
    expect(opcion('No, falta instalarlo')?.textContent).toContain('Tu respuesta')

    // Elegir la otra respuesta deja fuera lo que hizo la guía.
    await tocar(await esperar(() => opcion('Sí, ya está instalado'), 'la otra respuesta'))
    await esperar(() => textoPantalla().includes('Imprimir la hoja de prueba'), 'el paso siguiente con la otra respuesta')
    await esperarQue(
      async () => (await db.progresoPasos.get('guia-impresora'))?.elecciones?.['imp-controlador'] === 'imp-si',
      'la respuesta cambiada',
    )
    avance = await db.progresoPasos.get('guia-impresora')
    expect(avance?.vinculos?.['guia-controlador']).toBeUndefined()
  })
})

describe('una guía reutilizada con su propia pregunta', () => {
  it('se responde dentro del flujo, sigue por su camino y al revisarla se lee solo ese camino', async () => {
    const elegir = pasoPrueba('ver-p1', 'Elegir la versión', [])
    elegir.bloques = [
      decision('ver-d', '¿Qué versión del programa de prueba tienes?', [
        { id: 'ver-clasica', titulo: 'La clásica', descripcion: '', destino: { tipo: 'paso', pasoId: 'ver-p2' } },
        { id: 'ver-nueva', titulo: 'La nueva', descripcion: '', destino: { tipo: 'paso', pasoId: 'ver-p3' } },
      ]),
    ]
    await sembrarGuia({
      id: 'guia-version',
      titulo: 'Exportar según la versión de prueba',
      pasos: [
        elegir,
        { ...pasoPrueba('ver-p2', 'Exportar en la clásica', ['Hacer lo de la clásica']), alTerminar: { tipo: 'fin' } },
        pasoPrueba('ver-p3', 'Exportar en la nueva', ['Hacer lo de la nueva']),
      ],
    })
    await sembrarGuia({
      id: 'guia-principal',
      titulo: 'Guía que reutiliza la exportación',
      pasos: [
        {
          ...pasoPrueba('pri-p1', 'Exportar el correo de prueba', []),
          subArticuloId: 'guia-version',
          subArticuloTitulo: 'Exportar según la versión de prueba',
        },
        pasoPrueba('pri-p2', 'Terminar la prueba', ['Cerrar todo']),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-principal')

    await tocar(await esperar(() => opcion('La nueva'), 'la pregunta de la guía reutilizada'))
    await esperar(() => textoPantalla().includes('Hacer lo de la nueva'), 'el camino elegido, en el flujo')
    expect(textoPantalla()).not.toContain('Hacer lo de la clásica')
    await tocar(await esperar(() => principal('Completar y seguir'), 'terminar lo reutilizado'))
    await esperar(() => textoPantalla().includes('Cerrar todo'), 'el paso siguiente de la guía que se abrió')

    // Revisado con "Anterior", el paso se lee: solo el camino que se recorrió.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Hacer lo de la nueva'), 'el paso hecho, para leerlo')
    expect(textoPantalla()).not.toContain('Hacer lo de la clásica')
  })
})

describe('la decisión con opciones en la vista del paso entero', () => {
  it('se responde tocando la opción y lleva a su paso', async () => {
    await sembrarCopia()
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, RUTA_COPIA)
    await esperar(() => textoPantalla().includes('¿Qué versión del programa de prueba usas?'), 'la pregunta en el paso')
    await tocar(await esperar(() => control(/^Tarea: Confirmar el buzón de la persona$/), 'la tarea del paso'))
    // Sin responder, el paso no se cierra: el control lo dice.
    expect(principal('Elige una opción')?.hasAttribute('disabled')).toBe(true)

    await tocar(await esperar(() => opcion('Versión nueva'), 'la respuesta nueva'))
    await esperar(() => textoPantalla().includes('Abrir Configuración y elegir Exportar'), 'el paso del camino nuevo')
    expect(textoPantalla()).not.toContain('Abrir Archivo y elegir Exportar')
  })
})

describe('la lectura del procedimiento (la prueba del editor)', () => {
  it('enseña solo la ruta: hasta la pregunta, y después el camino elegido', async () => {
    await sembrarCopia()
    const articulo = await db.articulos.get('guia-copia')
    const procedimiento = articulo?.procedimiento
    if (!procedimiento) throw new Error('falta la guía de prueba')
    await montar(
      [
        {
          ruta: '/prueba',
          elemento: (
            <ProveedorEjecucion raizId="prueba-lectura">
              <ProcedimientoVista articuloId="prueba-lectura" procedimiento={procedimiento} />
            </ProveedorEjecucion>
          ),
        },
      ],
      '/prueba',
    )
    await esperar(() => textoPantalla().includes('¿Qué versión del programa de prueba usas?'), 'la pregunta')
    expect(textoPantalla()).not.toContain('Exportar en la versión clásica')
    expect(textoPantalla()).not.toContain('Guardar y comprobar el archivo')

    await tocar(await esperar(() => opcion('Versión clásica'), 'la respuesta clásica'))
    await esperar(() => textoPantalla().includes('Exportar en la versión clásica'), 'el camino clásico')
    expect(textoPantalla()).toContain('Guardar y comprobar el archivo')
    expect(textoPantalla()).not.toContain('Exportar en la versión nueva')
  })
})

describe('caminos que no miden lo mismo', () => {
  it('el contador no afirma un total que todavía no se sabe', async () => {
    const preguntar = pasoPrueba('cd-p1', 'Elegir el camino', [])
    preguntar.bloques = [
      decision('cd-d', '¿Por dónde sigues?', [
        { id: 'cd-corto', titulo: 'Por el corto', descripcion: '', destino: { tipo: 'paso', pasoId: 'cd-p3' } },
        { id: 'cd-largo', titulo: 'Por el largo', descripcion: '', destino: { tipo: 'continuar' } },
      ]),
    ]
    await sembrarGuia({
      id: 'guia-desigual',
      titulo: 'Guía de caminos desiguales',
      pasos: [preguntar, pasoPrueba('cd-p2', 'Paso del largo', ['Hacer lo del largo']), pasoPrueba('cd-p3', 'Paso final', ['Terminar'])],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-desigual')
    await esperar(() => textoPantalla().includes('¿Por dónde sigues?'), 'la pregunta')
    expect(control(/^Paso 1\. Abrir el índice de pasos$/)).not.toBeNull()

    await tocar(await esperar(() => opcion('Por el corto'), 'el camino corto'))
    await esperar(() => textoPantalla().includes('Terminar'), 'el paso final')
    expect(control(/^Paso 2 de 2\. Abrir el índice de pasos$/)).not.toBeNull()
  })
})
