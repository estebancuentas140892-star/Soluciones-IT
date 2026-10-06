// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento } from '../../lib/db'
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
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ArticuloForm } from './ArticuloForm'

// DECISIONES CON OPCIONES EN EL EDITOR (tarea 302), con el formulario de
// verdad: se crean sin escribir JSON, se eligen sus destinos en las hojas
// del editor, no se guardan inválidas y las de Sí/No de antes siguen igual.
// Todo lo sembrado es inventado.

const RUTA_EDITOR = '/soluciones/cat-pruebas/guia-version/editar'
const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>FICHA DE LA GUÍA</p> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>FICHA DE LA GUÍA</p> },
]

function decisionSiNo(id: string, guiaId: string): BloquePaso {
  return {
    ...pasoPrueba('x', 'x', ['x']).bloques[0],
    id,
    texto: '¿La persona solo necesita ver el archivo?',
    tipoTarea: 'decision',
    decisionArticuloId: guiaId,
    decisionArticuloTitulo: 'Crear un vínculo con permiso de edición',
  }
}

async function pasosGuardados(): Promise<PasoProcedimiento[]> {
  return (await db.articulos.get('guia-version'))?.procedimiento?.pasos ?? []
}

/** El campo con ese nombre accesible. */
function campo(nombre: string): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>(`input[aria-label="${nombre}"]`)
}

async function escribirEn(nombre: string, texto: string): Promise<void> {
  await escribir(await esperar(() => campo(nombre), `el campo ${nombre}`), texto)
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrarGuia({
    id: 'guia-version',
    titulo: 'Copia de seguridad del correo',
    pasos: [
      pasoPrueba('p1', 'Identificar la versión', ['Confirma el correo de la persona']),
      pasoPrueba('p2', 'Exportar en la versión clásica', ['Inicia la exportación']),
      pasoPrueba('p3', 'Guardar y comprobar', ['Comprueba el archivo']),
    ],
  })
})

afterEach(async () => {
  await desmontarTodo()
})

/** Abre la pestaña de pasos y despliega el paso con ese título. */
async function abrirPaso(titulo: string): Promise<void> {
  if (!control(/^Añadir una tarea al paso/)) await tocar(await esperarControl(/^Pasos/))
  const plegado = control(new RegExp(`^${titulo}`))
  if (plegado) await tocar(plegado)
}

/** Añade una decisión al paso activo desde "Más". */
async function anadirDecision(numeroPaso: number): Promise<void> {
  await tocar(await esperarControl(`Añadir otro tipo de contenido al paso ${numeroPaso}`))
  await tocar(await esperarControl(/^DecisiónUna pregunta con opciones/))
}

describe('decisiones con opciones en el editor', () => {
  it('se crean sin JSON: pregunta, opciones y a dónde lleva cada una', async () => {
    await montar(RUTAS, RUTA_EDITOR)
    await abrirPaso('Identificar la versión')
    await anadirDecision(1)

    await escribirEn('Pregunta de la decisión', '¿Qué versión de Outlook estás utilizando?')
    await escribirEn('Título de la opción 1', 'Outlook clásico')
    await escribirEn('Ayuda de la opción 1 (opcional)', 'Veo la pestaña Archivo.')
    await escribirEn('Título de la opción 2', 'Nuevo Outlook')

    // La opción 1 lleva al paso 2; la 2 sigue la ruta de siempre.
    await tocar(await esperarControl(/^A dónde lleva la opción 1:/))
    await tocar(await esperarControl(/^Ir a un pasoSalta a un paso posterior/))
    await tocar(await esperarControl(/^Paso 2Exportar en la versión clásica/))
    expect(textoPantalla()).toContain('Ir al paso 2 · Exportar en la versión clásica')
    // Cada opción enseña su camino.
    expect(textoPantalla()).toContain('Después: 2 → 3.')

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await pasosGuardados())[0]?.bloques.some((b) => b.opciones), 'la decisión guardada')

    const [paso1] = await pasosGuardados()
    const decision = paso1.bloques.at(-1)
    expect(decision?.texto).toBe('¿Qué versión de Outlook estás utilizando?')
    expect(decision?.tipoTarea).toBe('decision')
    expect(decision?.opciones?.map((o) => [o.titulo, o.descripcion, o.destino])).toEqual([
      ['Outlook clásico', 'Veo la pestaña Archivo.', { tipo: 'paso', pasoId: 'p2' }],
      ['Nuevo Outlook', '', { tipo: 'continuar' }],
    ])
  })

  it('"Al terminar" junta los caminos y solo aparece en una guía con caminos', async () => {
    await montar(RUTAS, RUTA_EDITOR)
    await abrirPaso('Identificar la versión')
    expect(control(/^Al terminar/)).toBeNull()

    await anadirDecision(1)
    await escribirEn('Pregunta de la decisión', '¿Qué versión?')
    await escribirEn('Título de la opción 1', 'Clásico')
    await escribirEn('Título de la opción 2', 'Nuevo')
    await tocar(await esperarControl(/^A dónde lleva la opción 2:/))
    await tocar(await esperarControl(/^Ir a un pasoSalta a un paso posterior/))
    await tocar(await esperarControl(/^Paso 3Guardar y comprobar/))

    // El paso 2 (el camino "Clásico") termina la guía en vez de seguir en el 3.
    await abrirPaso('Exportar en la versión clásica')
    await tocar(await esperarControl(/^Al terminar, sigue en el paso 3/))
    await tocar(await esperarControl(/^Terminar la guíaEste paso cierra su camino/))
    expect(control(/^Al terminar, termina la guía/)).not.toBeNull()

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await pasosGuardados())[1]?.alTerminar !== undefined, 'el "al terminar" guardado')
    expect((await pasosGuardados())[1].alTerminar).toEqual({ tipo: 'fin' })
  })

  it('no deja guardar una decisión inválida y dice qué corregir y dónde', async () => {
    await montar(RUTAS, RUTA_EDITOR)
    await abrirPaso('Identificar la versión')
    await anadirDecision(1)
    await escribirEn('Pregunta de la decisión', '¿Qué versión?')
    await escribirEn('Título de la opción 1', 'Clásico')
    // La opción 2 se queda sin título.

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperar(() => textoPantalla().includes('Antes de guardar, corrige esto:'), 'el aviso de lo que falta')
    expect(textoPantalla()).toContain('La opción 2 necesita un título.')
    // No se guardó nada: la guía sigue sin decisión.
    expect((await pasosGuardados())[0].bloques.some((b) => b.tipoTarea === 'decision')).toBe(false)

    // Al corregirlo, se guarda.
    await escribirEn('Título de la opción 2', 'Nuevo')
    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await pasosGuardados())[0]?.bloques.some((b) => b.opciones), 'la decisión guardada')
  })

  it('una decisión de Sí/No de antes se guarda como estaba, sin reglas nuevas', async () => {
    const guia = await db.articulos.get('guia-version')
    const pasos = guia!.procedimiento!.pasos
    await db.articulos.put({
      ...guia!,
      procedimiento: {
        ...guia!.procedimiento!,
        pasos: [{ ...pasos[0], bloques: [...pasos[0].bloques, decisionSiNo('sn', 'guia-edicion')] }, ...pasos.slice(1)],
      },
    })
    await montar(RUTAS, RUTA_EDITOR)
    await abrirPaso('Identificar la versión')
    await esperar(() => textoPantalla().includes('Si responde No: Crear un vínculo con permiso de edición'), 'la decisión de Sí/No')
    expect(control('Pasar a opciones con nombre')).not.toBeNull()
    // Sin caminos, no hay "Al terminar".
    expect(control(/^Al terminar/)).toBeNull()

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperar(() => textoPantalla().includes('FICHA DE LA GUÍA'), 'el guardado')
    const guardada = (await pasosGuardados())[0].bloques.find((b) => b.id === 'sn')
    expect(guardada?.decisionArticuloId).toBe('guia-edicion')
    expect(guardada).not.toHaveProperty('opciones')
  })

  it('una de Sí/No pasa a opciones sin perder su "No"', async () => {
    const guia = await db.articulos.get('guia-version')
    const pasos = guia!.procedimiento!.pasos
    await db.articulos.put({
      ...guia!,
      procedimiento: {
        ...guia!.procedimiento!,
        pasos: [{ ...pasos[0], bloques: [...pasos[0].bloques, decisionSiNo('sn', 'guia-edicion')] }, ...pasos.slice(1)],
      },
    })
    await montar(RUTAS, RUTA_EDITOR)
    await abrirPaso('Identificar la versión')
    await tocar(await esperarControl('Pasar a opciones con nombre'))
    expect(campo('Título de la opción 1')?.value).toBe('Sí')
    expect(campo('Título de la opción 2')?.value).toBe('No')
    expect(textoPantalla()).toContain('Abrir «Crear un vínculo con permiso de edición»')

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await pasosGuardados())[0]?.bloques.some((b) => b.opciones), 'la decisión guardada')
    const guardada = (await pasosGuardados())[0].bloques.find((b) => b.id === 'sn')
    expect(guardada?.decisionArticuloId).toBeNull()
    expect(guardada?.opciones?.map((o) => [o.titulo, o.destino.tipo])).toEqual([
      ['Sí', 'continuar'],
      ['No', 'guia'],
    ])
  })
})
