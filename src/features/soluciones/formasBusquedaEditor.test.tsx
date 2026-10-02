// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  desmontarTodo,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pausa,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ArticuloForm } from './ArticuloForm'
import { AsistentePage } from './AsistentePage'

// "¿CÓMO BUSCARÍA ALGUIEN ESTA GUÍA?" (tarea 288, fase 5), con el editor
// y la ejecución de verdad:
//
//   - el campo está en la pestaña General, es opcional y se guarda dentro
//     del JSON del procedimiento, una frase por línea (sin columna nueva);
//   - durante la ejecución esas frases no se ven.
//
// Todo lo sembrado es inventado.

const RUTA_EDITOR = '/soluciones/cat-pruebas/guia-formas/editar'
const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/ejecutar', elemento: <AsistentePage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>FICHA DE LA GUÍA</p> },
]
const ETIQUETA = '¿Cómo buscaría alguien esta guía?'

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrarGuia({
    id: 'guia-formas',
    titulo: 'Enviar archivos pesados con OneDrive',
    pasos: [pasoPrueba('formas-p1', 'Subir el archivo', ['Sube el archivo a una carpeta de OneDrive'])],
  })
})

afterEach(async () => {
  await desmontarTodo()
})

/** El área de texto del campo con esa etiqueta. */
function areaDe(etiqueta: string): HTMLTextAreaElement | null {
  const rotulo = Array.from(document.body.querySelectorAll('span')).find((span) => span.textContent === etiqueta)
  return rotulo?.closest('label')?.querySelector('textarea') ?? null
}

/** Escribe en un área de texto como lo haría el teclado. */
async function escribirArea(area: HTMLTextAreaElement, texto: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(area, texto)
    area.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await pausa()
}

describe('formas de búsqueda en el editor de guías', () => {
  it('se escriben en General, una por línea, y se guardan dentro del procedimiento', async () => {
    await montar(RUTAS, RUTA_EDITOR)
    const area = await esperar(() => areaDe(ETIQUETA), 'el campo de formas de búsqueda')
    // Opcional y vacío en una guía que no las tenía.
    expect(area.value).toBe('')
    expect(textoPantalla()).toContain('no se ven al ejecutarla')

    await escribirArea(area, 'no me deja enviar archivo pesado\n\narchivo grande por correo\n')
    await tocar(await esperarControl('Guardar procedimiento'))

    await esperarQue(
      async () => (await db.articulos.get('guia-formas'))?.procedimiento?.formasBusqueda?.length === 2,
      'las formas de búsqueda guardadas',
    )
    const guardada = await db.articulos.get('guia-formas')
    expect(guardada?.procedimiento?.formasBusqueda).toEqual(['no me deja enviar archivo pesado', 'archivo grande por correo'])
    // Lo demás de la guía no se tocó.
    expect(guardada?.procedimiento?.pasos[0].titulo).toBe('Subir el archivo')
  })

  it('al volver a abrir la guía en el editor aparecen como se guardaron', async () => {
    const guia = await db.articulos.get('guia-formas')
    await db.articulos.put({
      ...guia!,
      procedimiento: { ...guia!.procedimiento!, formasBusqueda: ['mandar archivo pesado', 'no puedo adjuntar archivo'] },
    })
    await montar(RUTAS, RUTA_EDITOR)
    await esperar(() => areaDe(ETIQUETA)?.value === 'mandar archivo pesado\nno puedo adjuntar archivo', 'las frases')
  })

  it('durante la ejecución no se ven', async () => {
    const guia = await db.articulos.get('guia-formas')
    await db.articulos.put({
      ...guia!,
      procedimiento: { ...guia!.procedimiento!, formasBusqueda: ['frase-solo-para-buscar'] },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-formas/ejecutar')
    await esperar(() => textoPantalla().includes('Sube el archivo a una carpeta de OneDrive'), 'la ejecución de la guía')
    expect(textoPantalla()).not.toContain('frase-solo-para-buscar')
  })
})
