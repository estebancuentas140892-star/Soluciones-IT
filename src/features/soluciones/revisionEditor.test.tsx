// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
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
import { ArticuloForm } from './ArticuloForm'

// EL EDITOR SEÑALA LO QUE LA REGLA 20 PIDE CORREGIR (segunda pasada del
// encargo del 2026-09-17). Con la pantalla de verdad:
//
//   - un requisito que es una acción se nombra, con el paso donde ya está;
//   - una tarea que encadena acciones enseña cómo quedaría y se divide
//     con un toque, sin inventar texto;
//   - una alerta que solo recuerda algo se pasa a Información con un toque;
//   - nada de eso impide guardar ni toca lo que el autor no pidió.
//
// Todo lo sembrado es inventado.

const RUTA = '/soluciones/cat-pruebas/guia-editor/editar'
const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> }]

const CADENA = 'Ingresa a Terminales, selecciona la terminal de prueba, luego pulsa Editar y abre Impresoras'

function recordatorio(id: string, tareaId: string): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id,
    tipo: 'aviso',
    tono: 'precaucion',
    texto: 'Recuerda cerrar la caja de prueba',
    alcance: 'tarea',
    tareaId,
  }
}

async function sembrarParaEditar() {
  const p1 = pasoPrueba('ed-p1', 'Entrar', ['Entra en Administrador'])
  const base = pasoPrueba('ed-p2', 'Configurar la terminal', [CADENA])
  const p2 = { ...base, bloques: [...base.bloques, recordatorio('ed-av', 'ed-p2-t1')] }
  await sembrarGuia({ id: 'guia-editor', titulo: 'Guía de prueba para el editor', pasos: [p1, p2] })
  const articulo = await db.articulos.get('guia-editor')
  await db.articulos.put({
    ...articulo!,
    procedimiento: {
      ...articulo!.procedimiento!,
      requisitos: ['Resolución de prueba en PDF', 'Entrar al administrador'],
    },
  })
}

/** Los textos de las tareas en el editor, en orden. */
function textosDeTareas(): string[] {
  return Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="text"]'))
    .map((campo) => campo.value)
    .filter((valor) => valor !== '' && valor !== 'Guía de prueba para el editor')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('el editor revisa la guía contra la regla 20', () => {
  it('nombra el requisito que es una acción y el paso donde ya está', async () => {
    await sembrarParaEditar()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))

    await esperar(() => textoPantalla().includes('«Entrar al administrador» es una acción'), 'la pista del requisito')
    expect(textoPantalla()).toContain('Ya está en el paso 1: bórrala de aquí.')
    // El requisito de verdad no se señala.
    expect(textoPantalla()).not.toContain('«Resolución de prueba en PDF» es una acción')
  })

  it('divide la tarea encadenada en sus acciones, con las palabras del autor', async () => {
    await sembrarParaEditar()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    // El último paso es el que está abierto al entrar (el paso 2).

    await esperar(() => textoPantalla().includes('Encadena 4 acciones'), 'la pista de la tarea encadenada')
    await tocar(await esperarControl('Dividir en 4 tareas'))

    await esperar(() => textosDeTareas().includes('Abre Impresoras'), 'las tareas nuevas')
    const tareas = textosDeTareas()
    expect(tareas).toContain('Ingresa a Terminales')
    expect(tareas).toContain('Selecciona la terminal de prueba')
    expect(tareas).toContain('Pulsa Editar')
    expect(tareas).not.toContain(CADENA)
    expect(textoPantalla()).not.toContain('Encadena 4 acciones')
  })

  it('pasa a Información la alerta que solo recuerda algo', async () => {
    await sembrarParaEditar()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))

    await esperar(() => textoPantalla().includes('Empieza como un recordatorio'), 'la pista de la alerta')
    await tocar(await esperarControl('Pasar a Información'))
    await esperar(() => !textoPantalla().includes('Empieza como un recordatorio'), 'la pista se va')
    expect(control(/^Tono del aviso: Información/)).not.toBeNull()
  })
})
