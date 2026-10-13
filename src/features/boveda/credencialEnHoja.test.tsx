// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type PasoProcedimiento } from '../../lib/db'
import {
  abrirCredencial,
  anclarMaestra,
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  MAESTRA_PRUEBA,
  montar,
  pasoPrueba,
  pausa,
  sembrarCredencial,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { GuiaPage } from '../soluciones/GuiaPage'
import { bloquear, bovedaDesbloqueada } from './sesionBoveda'

// LA CREDENCIAL DE UNA ACCIÓN, EN SU HOJA (tarea 328, rediseño móvil "1b
// Pulgar", AD-078). En la ejecución la credencial es una fila con borde que
// dice cuál hace falta y abre el bloque protegido de siempre en una hoja. Lo
// que se vigila aquí es lo que la hoja añade: que la fila diga el nombre vivo,
// que abrirla y cerrarla no mueva la guía y que, cerrada, nada descifrado
// quede en el documento. El comportamiento de la Bóveda dentro de la hoja lo
// vigilan bloqueoContextual, vinculoFijo y credencialDelEquipoFlujo.
//
// Todo es inventado: ni usuarios, ni contraseñas, ni equipos reales.

const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> }]
const RUTA = '/soluciones/cat-pruebas/guia-hoja'
const ACCION = 'Conéctate al panel de prueba'
const USUARIO = 'usuario.falso.hoja'
const CLAVE = 'Clave-Falsa-Hoja-321'

function pasoConCredencial(): PasoProcedimiento {
  const paso = pasoPrueba('hj-p1', 'Conectarse al panel de prueba', [ACCION, 'Revisa el panel de prueba'])
  paso.bloques[0] = {
    ...paso.bloques[0],
    vinculoProtegido: { tipo: 'credencial', id: 'cred-hoja', titulo: 'Copia de referencia del panel' },
  }
  return paso
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await anclarMaestra()
  await sembrarCredencial({ id: 'cred-hoja', titulo: 'Acceso de prueba al panel', tipo: 'cuenta', usuario: USUARIO, contrasena: CLAVE })
  bloquear()
  await sembrarGuia({ id: 'guia-hoja', titulo: 'Revisar un panel de prueba', pasos: [pasoConCredencial()] })
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

describe('la credencial de la acción, como fila que abre su hoja', () => {
  it('la fila dice qué credencial hace falta, con el nombre vivo, y no enseña nada protegido', async () => {
    await montar(RUTAS, RUTA)
    const fila = await esperarControl('Ver la credencial: Acceso de prueba al panel')
    expect(fila.getAttribute('aria-haspopup')).toBe('dialog')
    expect(fila.textContent).toContain('Se abre aquí, sin salir de la guía')
    // Cerrada, ni el bloque protegido ni su "Mostrar".
    expect(textoPantalla()).not.toContain('Credencial necesaria')
    expect(control('Dato protegido: Acceso de prueba al panel')).toBeNull()
    expect(document.body.innerHTML).not.toContain(USUARIO)
  })

  it('se abre, se desbloquea dentro y al cerrarla la guía sigue igual y lo descifrado sale del documento', async () => {
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    const avanceAntes = await db.progresoPasos.get('guia-hoja')

    await abrirCredencial('Acceso de prueba al panel')
    const hoja = await esperar(() => document.body.querySelector('[role="dialog"]'), 'la hoja')
    expect(hoja.textContent).toContain('Credencial necesaria')
    await tocar(await esperarControl('Dato protegido: Acceso de prueba al panel'))
    const campo = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
      'el desbloqueo dentro de la hoja',
    )
    await escribir(campo, MAESTRA_PRUEBA)
    await enviarFormulario(campo)
    await esperar(() => textoPantalla().includes(USUARIO), 'el usuario descifrado en la hoja')

    await tocar(await esperarControl('Cerrar y volver a la guía'))
    await esperar(() => !document.body.querySelector('[role="dialog"]'), 'la hoja cerrada')
    // Nada descifrado queda en el documento, aunque la Bóveda siga abierta.
    expect(document.body.innerHTML).not.toContain(USUARIO)
    expect(bovedaDesbloqueada()).toBe(true)
    // La guía no se movió: misma ruta, misma acción, sin completar nada.
    expect(ubicacionActual().pathname).toBe(RUTA)
    expect(document.body.querySelector('h2[data-foco-lectura]')?.textContent).toBe(ACCION)
    expect(control('Completar y seguir')).not.toBeNull()
    await pausa(100)
    expect(await db.progresoPasos.get('guia-hoja')).toEqual(avanceAntes)
  })
})
