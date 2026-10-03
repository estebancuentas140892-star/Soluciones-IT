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

    await esperar(
      () => textoPantalla().includes('«Entrar al administrador» parece una acción del procedimiento'),
      'la pista del requisito',
    )
    expect(textoPantalla()).toContain('Ya está en el paso 1: bórrala de aquí.')
    // El requisito de verdad no se señala.
    expect(textoPantalla()).not.toContain('«Resolución de prueba en PDF» parece una acción')
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

// TAREA 289, FASE 4: el editor ayuda a no mezclar requisito, acción,
// comprobación y la forma de hablarle a quien ejecuta. Pistas, nunca
// bloqueos: nada se mueve solo y guardar sigue disponible.
describe('el editor separa requisito, acción y verificación (tarea 289)', () => {
  async function sembrarMezclas() {
    await sembrarGuia({
      id: 'guia-primera',
      titulo: 'Entrar al programa de prueba',
      pasos: [pasoPrueba('pri-p1', 'Entrar', ['Abre el programa de prueba'])],
      procedimiento: { requisitos: ['Red de prueba disponible.'] },
    })
    await sembrarGuia({
      id: 'guia-despues',
      titulo: 'Configurar el correo de prueba',
      pasos: [pasoPrueba('des-p1', 'Configurar', ['Abre el correo de prueba'])],
      procedimiento: { requisitos: ['Correo de prueba de la persona.', 'Red de prueba disponible.'] },
    })
    const p1 = { ...pasoPrueba('ed-p1', 'Entrar al programa', []), subArticuloId: 'guia-primera', subArticuloTitulo: 'Entrar al programa de prueba' }
    const p2 = { ...pasoPrueba('ed-p2', 'Configurar el correo', []), subArticuloId: 'guia-despues', subArticuloTitulo: 'Configurar el correo de prueba' }
    const p3 = pasoPrueba('ed-p3', 'Revisar la impresora', [
      'Tener acceso administrativo al servidor de prueba',
      'Comprueba que la impresora de prueba aparece en la lista',
      'Selecciona Imprimir',
    ])
    await sembrarGuia({
      id: 'guia-editor',
      titulo: 'Guía de prueba para el editor',
      pasos: [p1, p2, p3],
      procedimiento: {
        descripcion: 'Configurar el correo de prueba en el computador de la persona',
        requisitos: ['Acceso autorizado mediante el procedimiento relacionado'],
        verificacionFinal: ['Abrir el programa de prueba', 'La impresora de prueba aparece instalada'],
      },
    })
  }

  it('señala la tarea que es un requisito previo y la comprobación escrita como acción, sin moverlas', async () => {
    await sembrarMezclas()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    // El último paso es el que está abierto al entrar (el paso 3).
    await esperar(() => textoPantalla().includes('Esto parece un requisito previo, no una acción'), 'la pista de la condición')
    expect(textosDeTareas()).toContain('Tener acceso administrativo al servidor de prueba')
    // La acción de verdad no se señala.
    expect(textoPantalla().match(/Esto parece/g)).toHaveLength(2)

    await esperar(() => textoPantalla().includes('Esto parece una comprobación'), 'la pista de la comprobación')
    await tocar(await esperarControl('Marcar como verificación'))
    await esperar(() => !textoPantalla().includes('Esto parece una comprobación'), 'la pista se va')
    expect(control(/^Tipo de línea: Verificación/)).not.toBeNull()
    expect(control('Guardar procedimiento')?.hasAttribute('disabled')).toBe(false)
  })

  it('señala la verificación final que es una acción y el requisito que habla de la guía', async () => {
    await sembrarMezclas()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    await esperar(
      () => textoPantalla().includes('«Abrir el programa de prueba» parece una acción del procedimiento'),
      'la pista de la verificación final',
    )
    expect(textoPantalla()).not.toContain('«La impresora de prueba aparece instalada» parece una acción')
    expect(textoPantalla()).toContain(
      '«Acceso autorizado mediante el procedimiento relacionado» habla de cómo está hecha la guía',
    )
  })

  it('ofrece lo que piden las guías de más adelante, y añadirlo es un toque del autor', async () => {
    await sembrarMezclas()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    await esperar(() => textoPantalla().includes('Lo que piden las guías que este procedimiento reutiliza'), 'la lista')
    // La del paso 1 se pide sola: no se ofrece.
    expect(textoPantalla()).toContain('Lo que pide «Entrar al programa de prueba» (paso 1) se pide solo antes de empezar.')
    expect(textoPantalla()).toContain('«Configurar el correo de prueba» (paso 2)')
    // Lo que ya se pide (por el paso 1) no se repite.
    expect(control('Añadir a los requisitos: Red de prueba disponible.')).toBeNull()

    await tocar(await esperarControl('Añadir a los requisitos: Correo de prueba de la persona.'))
    const requisitos = await esperar(
      () =>
        Array.from(document.body.querySelectorAll('textarea')).find((t) =>
          t.value.includes('Correo de prueba de la persona.'),
        ),
      'el requisito añadido',
    )
    expect(requisitos.value.split('\n')).toEqual([
      'Acceso autorizado mediante el procedimiento relacionado',
      'Correo de prueba de la persona.',
    ])
    await esperar(() => !textoPantalla().includes('«Configurar el correo de prueba» (paso 2)'), 'ya no queda nada que ofrecer')
  })

  it('el "cuándo usar" que dice lo que hace la guía se señala en General', async () => {
    await sembrarMezclas()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Dice lo que hace la guía, no cuándo sirve'), 'la pista del cuándo usar')
    expect(textoPantalla()).toContain('La situación en que sirve, en una frase')
    // Y la completitud lo cuenta, en la lista de sugerencias.
    await tocar(await esperarControl(/sugerencias$/))
    await esperar(
      () => textoPantalla().includes('Decir en «Cuándo usar» la situación en que sirve'),
      'la sugerencia de la completitud',
    )
  })
})
