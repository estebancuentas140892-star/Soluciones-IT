// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  anclarMaestra,
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarCredencial,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { bloquear } from '../boveda/sesionBoveda'
import { ArticuloForm } from './ArticuloForm'

// "CREDENCIAL DEL EQUIPO ACTUAL" EN EL EDITOR (tarea 290, fase 4), con la
// pantalla de verdad:
//
//   - la hoja de "Información protegida" (del paso y de una tarea) ofrece,
//     antes que las credenciales concretas, la credencial del equipo con el
//     que se trabaje: una guía para varios equipos no elige la de ninguno;
//   - elegida, la finalidad es opcional y sugiere las categorías que ya
//     usa la Bóveda; se guarda recortada y sin ningún id;
//   - una credencial específica sigue funcionando como siempre;
//   - sin permiso de Bóveda no se ofrece nada nuevo.
//
// Todo lo sembrado es inventado.

const RUTA = '/soluciones/cat-pruebas/guia-editor/editar'
const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> }]

async function sembrarParaEditar(): Promise<void> {
  await sembrarGuia({
    id: 'guia-editor',
    titulo: 'Guía de prueba para impresoras',
    pasos: [pasoPrueba('ed-p1', 'Entrar al panel', ['Entra al panel web de la impresora'])],
  })
}

async function sembrarBovedaDePrueba(): Promise<void> {
  await anclarMaestra()
  await sembrarEquipo({ id: 'srv-x', nombre: 'Servidor de prueba X' })
  await sembrarCredencial({
    id: 'cred-remoto',
    titulo: 'Acceso de prueba remoto',
    tipo: 'cuenta',
    usuario: 'usuario.falso',
    contrasena: 'Clave-Falsa-Editor-1',
    categoria: 'Escritorio remoto',
    dispositivos: [{ id: 'srv-x', nombre: 'Servidor de prueba X' }],
  })
  bloquear()
}

/** El campo de la finalidad, por su rótulo. */
function campoFinalidad(): HTMLInputElement | null {
  const rotulo = Array.from(document.body.querySelectorAll('span')).find((s) => s.textContent === 'Finalidad (opcional)')
  return rotulo?.closest('label')?.querySelector('input') ?? null
}

const procedimientoGuardado = async () => (await db.articulos.get('guia-editor'))?.procedimiento

beforeEach(async () => {
  await limpiarBase()
  await sembrarParaEditar()
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

describe('la credencial del equipo actual en el editor', () => {
  it('en una tarea: se elige sin nombrar una credencial, con la finalidad sugerida, y se guarda sin id', async () => {
    await sembrarPerfil(true)
    await sembrarBovedaDePrueba()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))

    await tocar(await esperarControl('Vincular un dato protegido a esta tarea'))
    await esperar(() => textoPantalla().includes('Según el equipo con el que se trabaje'), 'el grupo del equipo')
    // Antes que las credenciales concretas.
    const texto = textoPantalla()
    expect(texto.indexOf('Credencial del equipo actual')).toBeLessThan(texto.indexOf('Acceso de prueba remoto'))
    await tocar(await esperarControl('Credencial del equipo actual'))

    await esperar(() => textoPantalla().includes('Dato protegido: Credencial del equipo'), 'el vínculo elegido')
    const finalidad = await esperar(campoFinalidad, 'el campo de la finalidad')
    expect(finalidad.value).toBe('')
    // Sugiere las categorías que ya usa la Bóveda.
    const lista = finalidad.getAttribute('list')
    expect(lista).not.toBeNull()
    const opciones = Array.from(document.getElementById(lista!)?.querySelectorAll('option') ?? []).map((o) => o.value)
    expect(opciones).toEqual(['Escritorio remoto'])

    // Mientras se escribe, el espacio entre palabras no desaparece.
    await escribir(finalidad, 'Escritorio ')
    expect(campoFinalidad()?.value).toBe('Escritorio ')
    await escribir(finalidad, ' Escritorio remoto ')
    await esperar(
      () => textoPantalla().includes('Dato protegido: Credencial del equipo · Escritorio remoto'),
      'el título con la finalidad',
    )

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(
      async () => (await procedimientoGuardado())?.pasos[0].bloques[0].vinculoProtegido?.tipo === 'equipo',
      'el vínculo guardado',
    )
    expect((await procedimientoGuardado())?.pasos[0].bloques[0].vinculoProtegido).toEqual({
      tipo: 'equipo',
      finalidad: 'Escritorio remoto',
      titulo: 'Credencial del equipo · Escritorio remoto',
    })
  })

  it('en el paso: "Información protegida" ofrece la credencial del equipo actual y se puede quitar', async () => {
    await sembrarPerfil(true)
    await sembrarBovedaDePrueba()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    await tocar(await esperarControl('Vínculos: dato protegido, procedimiento o solución'))
    await tocar(await esperarControl('Vincular información protegida (opcional)'))
    await tocar(await esperarControl('Credencial del equipo actual'))
    await esperar(() => textoPantalla().includes('Información protegida: Credencial del equipo'), 'el vínculo del paso')
    expect(campoFinalidad()).not.toBeNull()

    // Quitarlo deja el paso como estaba; volver a elegirlo, también.
    const quitar = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent === 'Quitar' && b.parentElement?.textContent?.includes('Información protegida'),
    )
    expect(quitar).toBeDefined()
    await tocar(quitar!)
    await tocar(await esperarControl('Vincular información protegida (opcional)'))
    await tocar(await esperarControl('Credencial del equipo actual'))
    await esperar(() => textoPantalla().includes('Información protegida: Credencial del equipo'), 'otra vez el vínculo')

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(
      async () => (await procedimientoGuardado())?.pasos[0].vinculoProtegido?.tipo === 'equipo',
      'el vínculo del paso guardado',
    )
    expect((await procedimientoGuardado())?.pasos[0].vinculoProtegido).toEqual({
      tipo: 'equipo',
      finalidad: '',
      titulo: 'Credencial del equipo',
    })
  })

  it('una credencial específica sigue siendo un vínculo fijo, como siempre', async () => {
    await sembrarPerfil(true)
    await sembrarBovedaDePrueba()
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    await tocar(await esperarControl('Vincular un dato protegido a esta tarea'))
    await tocar(await esperarControl('Acceso de prueba remoto (Escritorio remoto)'))
    await esperar(() => textoPantalla().includes('Dato protegido: Acceso de prueba remoto'), 'el vínculo fijo')
    // Un vínculo fijo no pide finalidad.
    expect(campoFinalidad()).toBeNull()

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(
      async () => (await procedimientoGuardado())?.pasos[0].bloques[0].vinculoProtegido?.tipo === 'credencial',
      'el vínculo fijo guardado',
    )
    expect((await procedimientoGuardado())?.pasos[0].bloques[0].vinculoProtegido).toEqual({
      tipo: 'credencial',
      id: 'cred-remoto',
      titulo: 'Acceso de prueba remoto (Escritorio remoto)',
    })
  })

  it('sin permiso de Bóveda no se ofrece: ni en la tarea ni en el paso', async () => {
    await sembrarPerfil(false)
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl(/^Pasos/))
    await tocar(await esperarControl('Vincular un dato protegido a esta tarea'))
    await esperar(() => textoPantalla().includes('Dato protegido de esta tarea'), 'la hoja de la tarea')
    expect(control('Credencial del equipo actual')).toBeNull()
    expect(textoPantalla()).not.toContain('Según el equipo con el que se trabaje')
    await tocar(await esperarControl('Cerrar'))

    await tocar(await esperarControl('Vínculos: dato protegido, procedimiento o solución'))
    await esperar(() => textoPantalla().includes('Vínculos del paso'), 'los vínculos del paso')
    expect(control('Vincular información protegida (opcional)')).toBeNull()
  })
})
