// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento, type ResultadoVisual } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  control,
  desmontarTodo,
  escribir,
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

// EL EDITOR DE LA EJECUCIÓN MÍNIMA (tarea 307). Lo que la ejecución ya no
// muestra, el editor ya no lo ofrece ("Para qué", "Dónde" y el "Debes ver"
// de texto del paso; Información y Consejo como tono), pero lo que una guía
// ya tiene se conserva al guardar. Y "Debes ver" pasa a ser la imagen de
// cada acción, subida por el mismo camino que cualquier imagen de un paso.
//
// La subida real necesita Supabase: aquí el servidor se da por conectado y
// la subida por hecha (`subirOEncolarArchivo`), sin sincronizar nada. Todo
// lo sembrado es inventado.

vi.mock('../../lib/supabase', async (original) => ({
  ...(await original<typeof import('../../lib/supabase')>()),
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
  supabaseConfigured: true,
}))
vi.mock('../../lib/archivosPendientes', async (original) => ({
  ...(await original<typeof import('../../lib/archivosPendientes')>()),
  subirOEncolarArchivo: vi.fn(async () => 'subido'),
}))
vi.mock('../../lib/comprimirImagen', () => ({ comprimirImagen: async (archivo: File) => archivo }))
vi.mock('../../lib/sync', async (original) => ({
  ...(await original<typeof import('../../lib/sync')>()),
  programarSync: () => {},
}))
vi.mock('../../components/useUrlAdjunto', () => ({
  useUrlAdjunto: (referencia: string | null) => (referencia ? `blob:prueba/${referencia}` : null),
}))

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>LA GUÍA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]
const RUTA = '/soluciones/cat-pruebas/guia-editor-min/editar'
const TITULO_PASO = 'Exportar el buzón de prueba'
const ACCION = 'Abre la opción de exportación'
const COMPROBACION = 'Comprueba que el asistente de prueba queda abierto'
const DONDE = 'Aplicación de correo de prueba'
const PARA_QUE = 'Tener una copia del buzón de prueba'
const DEBES_VER_TEXTO = 'El asistente de exportación de prueba queda abierto'
const EXPLICACION = 'Explicación de prueba heredada'

function avisoInfo(): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id: 'ed-info', tipo: 'aviso', texto: EXPLICACION, tono: 'info', alcance: 'tarea', tareaId: 'ed-p1-t1' }
}

async function sembrar(cambios: Partial<PasoProcedimiento> = {}, extra: BloquePaso[] = []) {
  const base = pasoPrueba('ed-p1', TITULO_PASO, [ACCION, COMPROBACION])
  const paso: PasoProcedimiento = {
    ...base,
    bloques: [base.bloques[0], { ...base.bloques[1], tipoTarea: 'verificacion' }, ...extra],
    ...cambios,
  }
  await sembrarGuia({ id: 'guia-editor-min', titulo: 'Guía de prueba del editor', pasos: [paso] })
}

async function abrirElEditor(): Promise<void> {
  await montar(RUTAS, RUTA)
  await tocar(await esperarControl(/^Pasos/))
  const plegado = control(new RegExp(`^${TITULO_PASO}`))
  if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
  await esperar(() => campoConValor(ACCION), 'la acción en el editor')
}

function campoConValor(valor: string): HTMLInputElement | null {
  return Array.from(document.body.querySelectorAll<HTMLInputElement>('input')).find((i) => i.value === valor) ?? null
}

/** Selecciona la tarea como lo hace el autor: tocándola. */
async function seleccionar(texto: string): Promise<void> {
  const entrada = await esperar(() => campoConValor(texto), `el campo de la tarea «${texto}»`)
  await act(async () => {
    entrada.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  })
  await pausa()
}

function campoPorEtiqueta(etiqueta: string): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>(`input[aria-label="${etiqueta}"]`)
}

/** Elige un archivo en un `<input type="file">`, como lo haría el selector del sistema. */
async function elegirArchivo(entrada: HTMLInputElement, archivo: File): Promise<void> {
  Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true })
  await act(async () => {
    entrada.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await pausa()
}

async function tareaGuardada(): Promise<BloquePaso | undefined> {
  return (await db.articulos.get('guia-editor-min'))?.procedimiento?.pasos[0].bloques.find((b) => b.id === 'ed-p1-t1')
}

async function guardar(): Promise<void> {
  await tocar(await esperarControl('Guardar procedimiento'))
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('lo que la ejecución ya no muestra, el editor ya no lo ofrece', () => {
  it('el paso no ofrece "Para qué", "Dónde" ni "Debes ver" de texto, y lo que la guía tenía se conserva al guardar', async () => {
    await sembrar({ lugar: DONDE, objetivo: PARA_QUE, resultado: DEBES_VER_TEXTO })
    await abrirElEditor()

    const retirados = Array.from(document.body.querySelectorAll<HTMLInputElement>('input')).filter((i) =>
      /Para qué|Dónde se hace|Qué debe verse al terminar/.test(`${i.getAttribute('aria-label') ?? ''} ${i.placeholder}`),
    )
    expect(retirados).toEqual([])
    expect(textoPantalla()).not.toContain(DONDE)

    // Se edita otra cosa y se guarda: lo heredado sigue en el JSON, intacto.
    await escribir(campoConValor(ACCION) as HTMLInputElement, `${ACCION} de prueba`)
    await guardar()
    await esperarQue(async () => (await tareaGuardada())?.texto === `${ACCION} de prueba`, 'la guía guardada')
    const paso = (await db.articulos.get('guia-editor-min'))?.procedimiento?.pasos[0]
    expect(paso).toMatchObject({ lugar: DONDE, objetivo: PARA_QUE, resultado: DEBES_VER_TEXTO })
  })

  it('añadir un aviso es elegir una advertencia o un dato técnico, nunca Información ni Consejo', async () => {
    await sembrar()
    await abrirElEditor()
    await seleccionar(ACCION)

    // La barra fija añade una advertencia, no una nota.
    await tocar(await esperarControl('Añadir una advertencia al paso 1'))
    await esperar(() => control(/^Tono del aviso: Precaución/), 'la advertencia nueva')

    // El catálogo: Advertencia y Dato técnico, sin el "Aviso" genérico.
    await tocar(await esperarControl('Añadir otro tipo de contenido al paso 1'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'el catálogo')
    expect(hoja.textContent).toContain('Advertencia')
    expect(hoja.textContent).toContain('Dato técnico')
    expect(hoja.textContent).not.toContain('Información, dato o riesgo')
    await tocar(Array.from(hoja.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.startsWith('Dato técnico')) as HTMLElement)
    await esperar(() => control(/^Tono del aviso: Dato técnico/), 'el dato técnico nuevo')

    // El selector de tono de un aviso ofrece los tres vigentes.
    await tocar(await esperarControl(/^Tono del aviso: Precaución/))
    const tonos = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'el selector de tono')
    for (const vigente of ['Precaución', 'Importante', 'Dato técnico']) expect(tonos.textContent).toContain(vigente)
    for (const retirado of ['Información', 'Consejo']) expect(tonos.textContent).not.toContain(retirado)
  })

  it('un aviso de Información heredado se ve como lo que es, con lo que pasa con él', async () => {
    await sembrar({}, [avisoInfo()])
    await abrirElEditor()
    await esperar(() => textoPantalla().includes('«Información» ya no se muestra al ejecutar'), 'la explicación del tono heredado')
    // Nada cambió solo: el texto y el tono siguen en la guía.
    expect(Array.from(document.body.querySelectorAll('textarea')).some((t) => t.value === EXPLICACION)).toBe(true)
    const guardado = (await db.articulos.get('guia-editor-min'))?.procedimiento?.pasos[0].bloques.find((b) => b.id === 'ed-info')
    expect(guardado?.tono).toBe('info')
  })
})

describe('"Debes ver" es la imagen de cada acción', () => {
  it('se ofrece en la acción y en la comprobación que se están escribiendo, nunca en una decisión', async () => {
    await sembrar()
    await abrirElEditor()
    await seleccionar(ACCION)
    expect(campoPorEtiqueta('Añadir la imagen de «Debes ver» de esta tarea')).not.toBeNull()
    expect(textoPantalla()).toContain('· imagen · opcional')
    await seleccionar(COMPROBACION)
    expect(campoPorEtiqueta('Añadir la imagen de «Debes ver» de esta tarea')).not.toBeNull()

    // Pasar la comprobación a decisión: ya no se ofrece.
    await tocar(await esperarControl(/^Tipo de línea: Verificación/))
    const tipos = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'el selector de tipo')
    await tocar(Array.from(tipos.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.startsWith('Decisión')) as HTMLElement)
    await seleccionar(COMPROBACION)
    expect(campoPorEtiqueta('Añadir la imagen de «Debes ver» de esta tarea')).toBeNull()
  })

  it('se sube con el camino de siempre, se describe, se guarda, se reabre y se quita', async () => {
    await sembrar()
    await abrirElEditor()
    await seleccionar(ACCION)
    await elegirArchivo(
      campoPorEtiqueta('Añadir la imagen de «Debes ver» de esta tarea') as HTMLInputElement,
      new File(['imagen de prueba'], 'ventana-exportar.png', { type: 'image/png' }),
    )
    const descripcion = await esperar(() => campoPorEtiqueta('Descripción de la imagen de «Debes ver»'), 'la imagen subida')
    expect(textoPantalla()).toContain('plegada al ejecutar')
    await escribir(descripcion, '  La ventana de exportación de prueba ')
    await guardar()
    await esperarQue(async () => (await tareaGuardada())?.resultadoVisual !== undefined, 'la imagen guardada')
    const guardada = (await tareaGuardada())?.resultadoVisual as ResultadoVisual
    expect(guardada.adjunto.referencia).toMatch(/^articulos\/guia-editor-min\/pasos\/\d+-ventana-exportar\.png$/)
    expect(guardada.adjunto).toMatchObject({ nombre: 'ventana-exportar.png', tipo: 'image/png' })
    expect(guardada.descripcion).toBe('La ventana de exportación de prueba')

    // Reabrir el editor la enseña con su descripción.
    await desmontarTodo()
    await abrirElEditor()
    const reabierta = await esperar(() => campoPorEtiqueta('Descripción de la imagen de «Debes ver»'), 'la imagen al reabrir')
    expect(reabierta.value).toBe('La ventana de exportación de prueba')
    expect(document.body.querySelector(`img[alt="La ventana de exportación de prueba"]`)).not.toBeNull()

    // Quitarla la suelta: al guardar, la clave desaparece.
    await tocar(await esperarControl('Quitar la imagen de «Debes ver»'))
    await guardar()
    await esperarQue(async () => (await tareaGuardada())?.resultadoVisual === undefined, 'la imagen quitada')
    expect(await tareaGuardada()).not.toHaveProperty('resultadoVisual')
  })

  it('lo que no es una imagen no se acepta, y se dice', async () => {
    await sembrar()
    await abrirElEditor()
    await seleccionar(ACCION)
    await elegirArchivo(
      campoPorEtiqueta('Añadir la imagen de «Debes ver» de esta tarea') as HTMLInputElement,
      new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' }),
    )
    await esperar(() => textoPantalla().includes('«Debes ver» necesita una imagen'), 'el aviso')
    expect(campoPorEtiqueta('Descripción de la imagen de «Debes ver»')).toBeNull()
  })
})
