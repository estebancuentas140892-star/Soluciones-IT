// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type MicroPasoComoHacer, type OpcionDecision, type PasoProcedimiento, type ResultadoVisual } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  pausa,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ArticuloForm } from './ArticuloForm'
import { GuiaPage } from './GuiaPage'

// LA ADVERTENCIA PREVIA ANTES DE UNA ACCIÓN DE RIESGO (tarea 311, AD-072,
// RN-070, regla 27 g), con las pantallas de verdad.
//
// En uso real, una advertencia que compartía pantalla con la instrucción,
// "Cómo hacerlo" y los demás apoyos podía pasarse por alto aunque fuera en
// rojo. Ahora un riesgo real (Precaución o Importante) se lee ANTES de su
// acción, en su propia pantalla: el tono, "Antes de continuar", el texto del
// autor y "Lo que sigue" con la instrucción; "Entiendo, continuar" lleva a la
// acción, que ya no lo repite. No es una acción: no se marca, no cuenta y no
// se guarda.
//
// Todo lo sembrado es inventado; el caso copia la FORMA del encargo (borrar la
// carpeta de un programa de acceso remoto).

// La imagen de "Debes ver" se da por resuelta, como en ejecucionMinima.test.tsx.
vi.mock('../../components/useUrlAdjunto', () => ({
  useUrlAdjunto: (referencia: string | null) => (referencia ? `blob:prueba/${referencia}` : null),
}))

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>DETALLES DE LA GUÍA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]
const RUTA = '/soluciones/cat-pruebas/guia-riesgo'

const ACCION_1 = 'Cierra el programa de acceso remoto de prueba'
const ACCION_2 = 'Elimina la carpeta de prueba.'
const ACCION_3 = 'Vacía la papelera de prueba'
const RIESGO = 'Asegúrate de que el programa de prueba esté completamente cerrado antes de eliminar sus archivos.'
const DATO = '%APPDATA%\\Prueba'
const CREDENCIAL = 'Clave de prueba del servidor de respaldos'
const COMO: MicroPasoComoHacer[] = [
  { id: 'rg-m1', accion: 'Pulsa', elemento: 'Windows + R' },
  { id: 'rg-m2', accion: 'Escribe', elemento: '%APPDATA%' },
  { id: 'rg-m3', accion: 'Elimina', elemento: 'la carpeta de prueba', ubicacion: 'Lista de carpetas de prueba' },
]
const DESCRIPCION = 'La carpeta de prueba ya no aparece'
const RESULTADO: ResultadoVisual = {
  adjunto: { referencia: 'pruebas/1700000011-carpeta.png', nombre: 'carpeta.png', tipo: 'image/png' },
  descripcion: DESCRIPCION,
}

function aviso(id: string, tono: BloquePaso['tono'], texto: string, tareaId: string | null): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id,
    tipo: 'aviso',
    texto,
    tono,
    alcance: tareaId ? 'tarea' : 'paso',
    tareaId,
  }
}

/** Un paso de tres acciones; la segunda, de riesgo, con todo lo suyo. */
function pasoConRiesgo(avisosDeLa2: BloquePaso[] = [aviso('rg-riesgo', 'precaucion', RIESGO, 'rg-p1-t2')]): PasoProcedimiento {
  const base = pasoPrueba('rg-p1', 'Borrar la configuración de prueba', [ACCION_1, ACCION_2, ACCION_3])
  return {
    ...base,
    bloques: [
      base.bloques[0],
      {
        ...base.bloques[1],
        comoHacer: COMO,
        resultadoVisual: RESULTADO,
        vinculoProtegido: { tipo: 'credencial', id: 'cred-prueba', titulo: CREDENCIAL },
      },
      ...avisosDeLa2,
      aviso('rg-dato', 'dato', DATO, 'rg-p1-t2'),
      base.bloques[2],
    ],
  }
}

async function sembrar(paso: PasoProcedimiento = pasoConRiesgo(), mas: PasoProcedimiento[] = []): Promise<void> {
  await sembrarGuia({ id: 'guia-riesgo', titulo: 'Quitar el acceso remoto de prueba', pasos: [paso, ...mas] })
}

/** El encabezado que recibe el foco: la instrucción, o el de la advertencia. */
function encabezado(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('h2[data-foco-lectura]')
}

function principal(texto: string): HTMLElement | null {
  return control(new RegExp(`^${texto}$`))
}

async function enLaAdvertencia(tono = 'Precaución'): Promise<HTMLElement> {
  return esperar(
    () => (encabezado()?.textContent === `${tono}. Antes de continuar` ? encabezado() : null),
    `la advertencia previa (${tono})`,
  )
}

async function enLaAccion(texto: string): Promise<void> {
  await esperar(() => encabezado()?.textContent === texto, `la acción «${texto}»`)
}

async function completar(texto: string): Promise<void> {
  await enLaAccion(texto)
  await tocar(await esperar(() => principal('Completar y seguir'), `"Completar y seguir" en «${texto}»`))
}

async function entiendo(): Promise<void> {
  await tocar(await esperar(() => principal('Entiendo, continuar'), '"Entiendo, continuar"'))
}

async function anterior(): Promise<void> {
  await tocar(await esperarControl(/^Anterior/))
}

async function hechas(): Promise<string[]> {
  return (await db.progresoPasos.get('guia-riesgo'))?.instruccionesHechas ?? []
}

function clasesDe(elemento: Element): string[] {
  return [elemento, ...Array.from(elemento.querySelectorAll('*'))].flatMap((e) => Array.from(e.classList))
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una acción sin advertencia', () => {
  it('el flujo es el de siempre: sin pantalla previa ni "Entiendo, continuar"', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await enLaAccion(ACCION_1)
    expect(textoPantalla()).not.toContain('Antes de continuar')
    expect(principal('Entiendo, continuar')).toBeNull()
    expect(principal('Completar y seguir')).not.toBeNull()
  })

  it('un dato técnico no genera pantalla: sigue dentro de su acción', async () => {
    const base = pasoPrueba('dt-p1', 'Configurar la conexión de prueba', ['Escribe la dirección de prueba'])
    await sembrar({ ...base, bloques: [base.bloques[0], aviso('dt-dato', 'dato', '10.0.0.99', 'dt-p1-t1')] })
    await montar(RUTAS, RUTA)
    await enLaAccion('Escribe la dirección de prueba')
    expect(textoPantalla()).not.toContain('Antes de continuar')
    expect(textoPantalla()).toContain('Dato técnico')
    expect(textoPantalla()).toContain('10.0.0.99')
  })
})

describe('Precaución: la advertencia previa y después la acción', () => {
  it('se llega a la acción de riesgo por su advertencia: el tono, el texto, lo que sigue y "Entiendo, continuar"', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    const titulo = await enLaAdvertencia()

    const texto = textoPantalla()
    const orden = [
      texto.indexOf('Precaución. Antes de continuar'),
      texto.indexOf(RIESGO),
      texto.indexOf('Lo que sigue'),
      texto.indexOf(ACCION_2),
    ]
    expect(orden.every((p) => p >= 0)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)
    // El texto del autor, tal cual: sin párrafos añadidos.
    const panel = titulo.closest('section') as HTMLElement
    expect(panel.querySelector('p')?.textContent).toBe(RIESGO)
    // Nada de la acción: ni "Qué hacer", ni "Cómo hacerlo", ni el dato
    // técnico, ni la credencial, ni "Debes ver" (son de la acción).
    for (const deLaAccion of ['Qué hacer', 'Cómo hacerlo', 'Dato técnico', DATO, 'Credencial necesaria', CREDENCIAL, 'Debes ver']) {
      expect(texto).not.toContain(deLaAccion)
    }
    // El control: el botón principal de siempre, nunca en rojo.
    const boton = principal('Entiendo, continuar') as HTMLElement
    expect(boton.className).toContain('border-noct-accent')
    expect(boton.className).not.toContain('noct-error')
    expect(principal('Completar y seguir')).toBeNull()
  })

  it('"Entiendo, continuar" lleva a la acción, que no repite el riesgo y conserva todo lo suyo', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await enLaAccion(ACCION_2)

    const texto = textoPantalla()
    expect(texto).not.toContain(RIESGO)
    expect(texto).not.toContain('Antes de continuar')
    // Qué hacer, Cómo hacerlo (numerado, tarea 310), el dato, la credencial y "Debes ver".
    expect(texto).toContain('Qué hacer')
    const lista = Array.from(document.body.querySelectorAll('ol')).find((ol) => ol.textContent?.includes('Pulsa Windows + R.'))
    expect(Array.from(lista?.children ?? []).map((li) => li.firstElementChild?.textContent)).toEqual([
      'Pulsa Windows + R.',
      'Escribe %APPDATA%.',
      'Elimina la carpeta de prueba.',
    ])
    expect(texto).toContain('Lista de carpetas de prueba')
    expect(texto).toContain('Dato técnico')
    expect(texto).toContain(DATO)
    expect(texto).toContain('Credencial necesaria')
    expect(texto).toContain(CREDENCIAL)
    // "Debes ver", plegado como siempre (sin regresión de la tarea 307).
    const debesVer = control('Debes ver')
    expect(debesVer?.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.querySelector(`img[alt="${DESCRIPCION}"]`)).toBeNull()
    await tocar(debesVer as HTMLElement)
    await esperar(() => document.body.querySelector(`img[alt="${DESCRIPCION}"]`), 'la imagen de "Debes ver"')
  })

  it('"Entiendo, continuar" no completa la acción, no la marca y no toca el avance', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await esperarQue(async () => (await hechas()).includes('rg-p1-t1'), 'la acción 1 guardada')
    const antes = await db.progresoPasos.get('guia-riesgo')
    await entiendo()
    await enLaAccion(ACCION_2)
    await pausa(150)
    expect(await db.progresoPasos.get('guia-riesgo')).toEqual(antes)
    expect(await hechas()).toEqual(['rg-p1-t1'])
    // Pendiente, sin la marca de hecha.
    expect(document.body.querySelector('[role="img"][aria-label="Completada"]')).toBeNull()
  })

  it('la advertencia no es una acción: el paso sigue teniendo 3', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await enLaAccion(ACCION_1)
    expect(textoPantalla()).toContain('acción 1 de 3')
    await completar(ACCION_1)
    await enLaAdvertencia()
    expect(textoPantalla()).toContain('acción 2 de 3')
    expect(textoPantalla()).not.toContain('de 4')
    await entiendo()
    await enLaAccion(ACCION_2)
    expect(textoPantalla()).toContain('acción 2 de 3')
    await completar(ACCION_2)
    await enLaAccion(ACCION_3)
    expect(textoPantalla()).toContain('acción 3 de 3')
  })

  it('se anuncia una sola vez: el encabezado con el tono recibe el foco; sin role="alert"; el icono, oculto', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    const titulo = await enLaAdvertencia()
    await esperar(() => document.activeElement === titulo, 'el foco en el encabezado de la advertencia')
    expect(titulo.tagName).toBe('H2')
    const panel = titulo.closest('section') as HTMLElement
    expect(panel.getAttribute('aria-labelledby')).toBe(titulo.id)
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
    // El nivel de riesgo no depende del color: la palabra está en el nombre.
    expect(titulo.textContent).toContain('Precaución')
    expect(Array.from(titulo.querySelectorAll('svg')).every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true)
    // Y al pasar a la acción, el foco va a su instrucción.
    await entiendo()
    await enLaAccion(ACCION_2)
    await esperar(() => document.activeElement === encabezado(), 'el foco en la instrucción')
  })
})

describe('Importante y varias advertencias', () => {
  it('Importante tiene la jerarquía fuerte: su palabra, su icono y el fondo pleno del riesgo', async () => {
    await sembrar(pasoConRiesgo([aviso('rg-imp', 'importante', 'Esto borra los archivos locales de prueba.', 'rg-p1-t2')]))
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    const titulo = await enLaAdvertencia('Importante')
    expect(titulo.getAttribute('data-advertencia-previa')).toBe('importante')
    const panel = titulo.closest('section') as HTMLElement
    expect(clasesDe(panel)).toContain('bg-noct-error/[.16]')
    expect(clasesDe(panel)).toContain('border-noct-error')
  })

  it('varias en una misma acción: UNA sola pantalla, todos los textos en su orden, y manda Importante', async () => {
    await sembrar(
      pasoConRiesgo([
        aviso('rg-a', 'precaucion', 'La aplicación de prueba debe estar completamente cerrada.', 'rg-p1-t2'),
        aviso('rg-b', 'importante', 'Esto elimina los archivos locales de prueba.', 'rg-p1-t2'),
      ]),
    )
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    const titulo = await enLaAdvertencia('Importante')
    const textos = Array.from((titulo.closest('section') as HTMLElement).querySelectorAll('li')).map((li) => li.textContent)
    expect(textos).toEqual(['La aplicación de prueba debe estar completamente cerrada.', 'Esto elimina los archivos locales de prueba.'])
    // Una sola: "Entiendo, continuar" ya lleva a la acción.
    await entiendo()
    await enLaAccion(ACCION_2)
    expect(textoPantalla()).not.toContain('Antes de continuar')
  })

  it('todas Precaución: la pantalla es de Precaución', async () => {
    await sembrar(
      pasoConRiesgo([
        aviso('rg-a', 'precaucion', 'Primera precaución de prueba.', 'rg-p1-t2'),
        aviso('rg-b', 'precaucion', 'Segunda precaución de prueba.', 'rg-p1-t2'),
      ]),
    )
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    const titulo = await enLaAdvertencia('Precaución')
    expect(titulo.getAttribute('data-advertencia-previa')).toBe('precaucion')
  })

  it('los riesgos del paso se leen antes de su primera acción, antes que los de esa acción', async () => {
    const base = pasoPrueba('ps-p1', 'Preparar el equipo de prueba', ['Apaga el equipo de prueba', 'Abre la tapa de prueba'])
    await sembrar({
      ...base,
      bloques: [
        base.bloques[0],
        aviso('ps-tarea', 'precaucion', 'Desconecta el cargador de prueba.', 'ps-p1-t1'),
        base.bloques[1],
        aviso('ps-paso', 'importante', 'Todo el paso de prueba borra la memoria temporal.', null),
      ],
    })
    await montar(RUTAS, RUTA)
    const titulo = await enLaAdvertencia('Importante')
    expect(Array.from((titulo.closest('section') as HTMLElement).querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'Todo el paso de prueba borra la memoria temporal.',
      'Desconecta el cargador de prueba.',
    ])
    expect(textoPantalla()).toContain('Apaga el equipo de prueba')
    await entiendo()
    await completar('Apaga el equipo de prueba')
    // La segunda acción no tiene riesgo propio ni repite los del paso.
    await enLaAccion('Abre la tapa de prueba')
    expect(textoPantalla()).not.toContain('Antes de continuar')
  })
})

describe('"Anterior" refleja lo que se acaba de leer', () => {
  it('acción de riesgo → su advertencia → la acción anterior; y adelante otra vez por la advertencia', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await enLaAccion(ACCION_2)

    await anterior()
    await enLaAdvertencia()
    await anterior()
    await enLaAccion(ACCION_1)
    // Desde la acción 1 (hecha) hacia adelante: la 2 sigue pendiente, y llega por su advertencia.
    await tocar(await esperarControl('Ir a la acción 2'))
    await enLaAdvertencia()
  })

  it('desde la advertencia de la primera acción del paso, "Anterior" va al paso anterior', async () => {
    const paso1 = pasoPrueba('an-p1', 'Abrir la herramienta de prueba', ['Abre la herramienta de prueba'])
    const base = pasoPrueba('an-p2', 'Borrar la caché de prueba', ['Borra la caché de prueba'])
    await sembrar(paso1, [{ ...base, bloques: [base.bloques[0], aviso('an-r', 'precaucion', 'Se pierde la sesión de prueba.', 'an-p2-t1')] }])
    await montar(RUTAS, RUTA)
    await completar('Abre la herramienta de prueba')
    await enLaAdvertencia()
    await anterior()
    await enLaAccion('Abre la herramienta de prueba')
  })
})

describe('entrar, recargar y retomar', () => {
  it('al retomar en una acción de riesgo pendiente, primero su advertencia', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await enLaAccion(ACCION_2)
    await esperarQue(async () => (await hechas()).includes('rg-p1-t1'), 'la acción 1 guardada')

    // Recargar: lo leído no se guarda, así que la acción vuelve a llegar por su advertencia.
    await desmontarTodo()
    await montar(RUTAS, RUTA)
    await enLaAdvertencia()
    expect(textoPantalla()).toContain('Retomando')
  })

  it('abrir la guía con la primera acción de riesgo: empieza por la advertencia', async () => {
    const base = pasoPrueba('pr-p1', 'Formatear la memoria de prueba', ['Formatea la memoria de prueba'])
    await sembrar({ ...base, bloques: [base.bloques[0], aviso('pr-r', 'importante', 'Se borra todo lo de la memoria de prueba.', 'pr-p1-t1')] })
    await montar(RUTAS, RUTA)
    await enLaAdvertencia('Importante')
  })
})

describe('una acción de riesgo ya hecha', () => {
  it('se revisa directamente con "Anterior", sin volver a confirmar; su advertencia queda a un "Anterior" más', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await completar(ACCION_2)
    await enLaAccion(ACCION_3)
    await esperarQue(async () => (await hechas()).includes('rg-p1-t2'), 'la acción 2 guardada')
    const antes = await db.progresoPasos.get('guia-riesgo')

    await anterior()
    // Directo a la acción hecha: sin advertencia por delante y sin el riesgo debajo.
    await enLaAccion(ACCION_2)
    expect(document.body.querySelector('[role="img"][aria-label="Completada"]')).not.toBeNull()
    expect(textoPantalla()).not.toContain(RIESGO)
    // El riesgo sigue a mano: un "Anterior" más.
    await anterior()
    await enLaAdvertencia()
    expect(textoPantalla()).toContain(RIESGO)
    // "Entiendo, continuar" vuelve a la acción hecha; nada cambió.
    await entiendo()
    await enLaAccion(ACCION_2)
    expect(principal('Ir a la acción 3')).not.toBeNull()
    expect(await db.progresoPasos.get('guia-riesgo')).toEqual(antes)
  })

  it('hacia adelante, una acción de riesgo ya hecha se abre directamente', async () => {
    await sembrar(pasoConRiesgo(), [pasoPrueba('rg-p2', 'Cerrar la sesión de prueba', ['Cierra la sesión de prueba'])])
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await completar(ACCION_2)
    await completar(ACCION_3)
    await enLaAccion('Cierra la sesión de prueba')
    // Atrás hasta la 1 (pasando por la advertencia de la 2) y adelante otra
    // vez con el paso ya hecho: la 2, hecha, se abre sin advertencia.
    await anterior()
    await enLaAccion(ACCION_3)
    await anterior()
    await enLaAccion(ACCION_2)
    await anterior()
    await enLaAdvertencia()
    await anterior()
    await enLaAccion(ACCION_1)
    await tocar(await esperarControl('Ir a la acción 2'))
    await enLaAccion(ACCION_2)
    expect(textoPantalla()).not.toContain('Antes de continuar')
  })

  it('desmarcarla la vuelve pendiente, y su advertencia vuelve antes de ella', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await completar(ACCION_2)
    await enLaAccion(ACCION_3)
    await anterior()
    await enLaAccion(ACCION_2)
    await tocar(await esperarControl('Desmarcar'))
    await enLaAdvertencia()
    await esperarQue(async () => !(await hechas()).includes('rg-p1-t2'), 'la acción 2 desmarcada')
  })
})

describe('en el flujo de otras guías', () => {
  it('la acción de riesgo de una guía reutilizada conserva su advertencia, en el sitio', async () => {
    const reu = pasoPrueba('ru-p1', 'Borrar la carpeta de prueba', ['Cierra la ventana de prueba', ACCION_2])
    await sembrarGuia({
      id: 'guia-reutilizada',
      titulo: 'Borrar la carpeta de prueba',
      pasos: [{ ...reu, bloques: [reu.bloques[0], reu.bloques[1], aviso('ru-r', 'precaucion', RIESGO, 'ru-p1-t2')] }],
    })
    await sembrarGuia({
      id: 'guia-riesgo',
      titulo: 'Reinstalar el programa de prueba',
      pasos: [
        { ...pasoPrueba('ex-p1', 'Borrar la carpeta', []), subArticuloId: 'guia-reutilizada', subArticuloTitulo: 'Borrar la carpeta de prueba' },
        pasoPrueba('ex-p2', 'Instalar', ['Instala el programa de prueba']),
      ],
    })
    await montar(RUTAS, RUTA)
    await completar('Cierra la ventana de prueba')
    await enLaAdvertencia()
    expect(textoPantalla()).toContain(RIESGO)
    await entiendo()
    await enLaAccion(ACCION_2)
    expect(textoPantalla()).not.toContain(RIESGO)
  })

  it('una acción de riesgo a la que lleva una respuesta conserva su advertencia', async () => {
    const opciones: OpcionDecision[] = [
      { id: 'op-a', titulo: 'Con datos de prueba', descripcion: '', destino: { tipo: 'paso', pasoId: 'de-p2' } },
      { id: 'op-b', titulo: 'Sin datos de prueba', descripcion: '', destino: { tipo: 'paso', pasoId: 'de-p3' } },
    ]
    const p1 = pasoPrueba('de-p1', 'Decidir', [])
    p1.bloques = [{ ...CAMPOS_BLOQUE_VACIOS, id: 'de-q', tipo: 'tarea', texto: '¿El equipo de prueba tiene datos?', tipoTarea: 'decision', opciones }]
    const p2 = pasoPrueba('de-p2', 'Respaldar', ['Borra los datos de prueba'])
    p2.bloques = [p2.bloques[0], aviso('de-r', 'importante', 'Sin respaldo, los datos de prueba se pierden.', 'de-p2-t1')]
    await sembrarGuia({
      id: 'guia-riesgo',
      titulo: 'Preparar un equipo de prueba',
      pasos: [p1, { ...p2, alTerminar: { tipo: 'fin' } }, pasoPrueba('de-p3', 'Seguir', ['Sigue sin datos de prueba'])],
    })
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Con datos de prueba/))
    await enLaAdvertencia('Importante')
    expect(textoPantalla()).toContain('Borra los datos de prueba')
  })
})

describe('en las listas: el paso entero y "Probar"', () => {
  /** El "Entiendo, continuar" de la tarjeta de una lista. */
  function tarjeta(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('section[data-advertencia-previa]')
  }

  it('en el paso entero, el riesgo ocupa el sitio de su acción (y de sus apoyos) hasta leerlo', async () => {
    await sembrar()
    await montar(RUTAS, RUTA)
    await enLaAccion(ACCION_1)
    await tocar(await esperarControl(/^Paso 1 de 1\. Abrir el índice de pasos$/))
    await tocar(await esperarControl(/^Ver el paso entero$/))
    const card = await esperar(tarjeta, 'la tarjeta de la advertencia')
    expect(card.textContent).toContain(RIESGO)
    expect(card.textContent).toContain(ACCION_2)
    // La acción no se puede marcar todavía: no está su casilla, ni su dato.
    expect(control(`Tarea: ${ACCION_2}`)).toBeNull()
    expect(textoPantalla()).not.toContain(DATO)
    expect(control(`Tarea: ${ACCION_1}`)).not.toBeNull()

    await tocar(await esperarControl(/^Entiendo, continuar$/))
    await esperar(() => control(`Tarea: ${ACCION_2}`), 'la acción, ya leída su advertencia')
    expect(tarjeta()).toBeNull()
    expect(textoPantalla()).not.toContain(RIESGO)
    expect(textoPantalla()).toContain(DATO)
    // Leer no marca nada.
    await pausa(100)
    expect(await hechas()).toEqual([])
  })

  it('"Probar" enseña primero la advertencia y después la acción, como la ejecución', async () => {
    await sembrar()
    await montar(RUTAS, `${RUTA}/editar`)
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(/^Borrar la configuración de prueba/)
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await tocar(await esperarControl(/^Probar$/))
    await tocar(await esperarControl(/^Ver como técnico$/))
    await esperar(() => textoPantalla().includes('Como lo ve el técnico'), 'la prueba del paso')
    // Lo que se ve en la prueba (el editor sigue debajo, con sus campos).
    const prueba = () => document.body.querySelector<HTMLElement>('.fixed.inset-0')?.textContent ?? ''
    const card = await esperar(tarjeta, 'la advertencia en "Probar"')
    expect(card.textContent).toContain('Antes de continuar')
    expect(card.textContent).toContain(RIESGO)
    expect(prueba()).not.toContain(DATO)
    await tocar(await esperarControl(/^Entiendo, continuar$/))
    await esperar(() => prueba().includes(DATO), 'la acción en "Probar"')
    expect(prueba()).not.toContain(RIESGO)
  })
})

describe('sin conexión', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('la advertencia previa sale de la base local, sin pedir nada a la red', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', red)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await sembrar()
    await montar(RUTAS, RUTA)
    await completar(ACCION_1)
    await enLaAdvertencia()
    await entiendo()
    await enLaAccion(ACCION_2)
    expect(red).not.toHaveBeenCalled()
  })
})

describe('en el editor', () => {
  it('el riesgo se sigue escribiendo en su acción, y dice que al ejecutar se leerá antes de ella', async () => {
    const base = pasoPrueba('ed-p1', 'Borrar la configuración de prueba', [ACCION_1, ACCION_2])
    await sembrar({
      ...base,
      bloques: [
        base.bloques[0],
        base.bloques[1],
        aviso('ed-r', 'precaucion', RIESGO, 'ed-p1-t2'),
        aviso('ed-p', 'importante', 'Riesgo de prueba de todo el paso.', null),
        aviso('ed-d', 'dato', DATO, 'ed-p1-t2'),
      ],
    })
    await montar(RUTAS, `${RUTA}/editar`)
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(/^Borrar la configuración de prueba/)
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await esperar(() => textoPantalla().includes('Al ejecutar, se mostrará antes de esta acción.'), 'la nota del riesgo de la acción')
    expect(textoPantalla()).toContain('Al ejecutar, se mostrará antes de la primera acción del paso.')
    // Una vez por riesgo: el dato técnico no la lleva.
    expect(textoPantalla().split('Al ejecutar, se mostrará antes de').length - 1).toBe(2)

    // La hoja del tono dice qué pasa al ejecutar, en pocas palabras.
    await tocar(await esperarControl('Tono del aviso: Precaución. Tocar para cambiarlo'))
    await esperar(() => textoPantalla().includes('Un riesgo real. Al ejecutar se mostrará antes de la acción.'), 'la ayuda de Precaución')
    expect(textoPantalla()).toContain('Riesgo grave o irreversible. Se mostrará como alerta antes de la acción.')
    expect(textoPantalla()).not.toContain('justo bajo la instrucción')
  })
})
