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

  it('señala la alerta que solo recuerda algo, sin ofrecer Información (tarea 307)', async () => {
    await sembrarParaEditar()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))

    await esperar(() => textoPantalla().includes('Empieza como un recordatorio'), 'la pista de la alerta')
    expect(textoPantalla()).toContain('Una advertencia es para un riesgo real')
    // Información ya no se muestra al ejecutar: no hay a dónde "pasarla".
    expect(control('Pasar a Información')).toBeNull()
    expect(control(/^Tono del aviso: Precaución/)).not.toBeNull()
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

  // CRITERIO ADICIONAL DE LA FASE 4. Regla definitiva: un requisito de una
  // guía reutilizada NO se convierte automáticamente en requisito de la guía
  // padre. El editor lo enseña solo como referencia: plegado, sin contar en
  // la completitud, con el criterio para decidir antes que la lista, y nada
  // se añade si el autor no lo elige, de uno en uno.
  it('lo que piden las guías reutilizadas es solo referencia: plegado, con el criterio delante, y nada pasa solo', async () => {
    await sembrarMezclas()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    const referencia = await esperarControl('Lo que piden las guías que reutiliza (2), solo como referencia')
    const campoRequisitos = () =>
      Array.from(document.body.querySelectorAll('textarea')).find((t) =>
        t.value.includes('Acceso autorizado mediante el procedimiento relacionado'),
      )

    // Plegado: ni la lista ni un solo "Añadir" a la vista.
    expect(referencia.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain('«Entrar al programa de prueba» (paso 1)')
    expect(control(/^Añadir a los requisitos/)).toBeNull()
    // Nada se suma solo, tampoco lo de la guía del paso 1, ni se presenta como algo que hacer.
    expect(campoRequisitos()?.value.split('\n')).toEqual(['Acceso autorizado mediante el procedimiento relacionado'])
    expect(textoPantalla()).not.toContain('se pide solo antes de empezar')
    expect(textoPantalla()).not.toContain('añade las que hagan falta')

    await tocar(referencia)
    expect(referencia.getAttribute('aria-expanded')).toBe('true')
    const abierto = textoPantalla()
    // Primero el criterio, después la lista.
    expect(abierto).toContain('Ninguno pasa solo a «Antes de empezar». Añade uno solo si hay que tenerlo listo antes')
    expect(abierto).toContain('Déjalo fuera si:')
    expect(abierto).toContain('Soluciones IT ya lo da donde se usa, como una credencial o una IP.')
    expect(abierto).toContain('Es algo que se hace durante el procedimiento: es un paso.')
    expect(abierto).toContain('Lo tiene o lo sabe cualquiera del equipo de Sistemas')
    expect(abierto).toContain('Solo aplica a esa guía en otros casos')
    expect(abierto).toContain('Sí suele hacer falta lo que solo la persona o el caso pueden dar')
    expect(abierto.indexOf('Déjalo fuera si:')).toBeLessThan(abierto.indexOf('«Entrar al programa de prueba» (paso 1)'))
    // Todas las guías, la del paso 1 incluida, y cada requisito una sola vez.
    expect(abierto).toContain('«Entrar al programa de prueba» (paso 1)')
    expect(abierto).toContain('«Configurar el correo de prueba» (paso 2)')
    expect(
      Array.from(document.body.querySelectorAll('button')).filter(
        (b) => b.getAttribute('aria-label') === 'Añadir a los requisitos de esta guía: Red de prueba disponible.',
      ),
    ).toHaveLength(1)
    // Abrirlo tampoco añade nada.
    expect(campoRequisitos()?.value.split('\n')).toEqual(['Acceso autorizado mediante el procedimiento relacionado'])

    // Solo lo que el autor elige, y solo eso.
    await tocar(await esperarControl('Añadir a los requisitos de esta guía: Correo de prueba de la persona.'))
    await esperar(() => campoRequisitos()?.value.includes('Correo de prueba de la persona.'), 'el requisito elegido')
    expect(campoRequisitos()?.value.split('\n')).toEqual([
      'Acceso autorizado mediante el procedimiento relacionado',
      'Correo de prueba de la persona.',
    ])
    await esperar(() => !textoPantalla().includes('«Configurar el correo de prueba» (paso 2)'), 'ya no se ofrece')
    expect(control('Lo que piden las guías que reutiliza (1), solo como referencia')).not.toBeNull()
    expect(control('Añadir a los requisitos de esta guía: Red de prueba disponible.')).not.toBeNull()
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
