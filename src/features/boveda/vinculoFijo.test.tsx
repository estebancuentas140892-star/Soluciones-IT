// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  anclarMaestra,
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  MAESTRA_PRUEBA,
  montar,
  pasoPrueba,
  sembrarCredencial,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from '../soluciones/GuiaPage'
import { bloquear } from './sesionBoveda'

// EL VÍNCULO FIJO DE HOY (tarea 290, fase 1).
//
// Antes de que una acción pueda pedir "la credencial del equipo actual",
// estas pruebas fijan lo que la consulta de la Bóveda dentro de una guía
// hace con un vínculo FIJO, que tiene que seguir haciendo exactamente
// igual: contraída de entrada, el título vivo, el desbloqueo en línea,
// la contraseña oculta y cada consulta registrada; sin permiso, solo el
// título de referencia; una credencial eliminada, sin usarla.
//
// Todo es inventado: ni usuarios, ni contraseñas, ni equipos reales.

const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> }]
const RUTA = '/soluciones/cat-pruebas/guia-fija'
const USUARIO_FALSO = 'usuario.falso.panel'
const CLAVE_FALSA = 'Clave-Falsa-De-Prueba-123'

async function sembrarGuiaConVinculoFijo(): Promise<void> {
  const paso = pasoPrueba('fij-p1', 'Entrar al panel de la impresora de prueba', [
    'Ingresa al panel con el usuario administrador',
    'Revisa la lista de usuarios de impresión',
  ])
  paso.bloques[0] = {
    ...paso.bloques[0],
    vinculoProtegido: { tipo: 'credencial', id: 'cred-fija', titulo: 'Copia de referencia del acceso' },
  }
  await sembrarGuia({ id: 'guia-fija', titulo: 'Revisar los usuarios de la impresora de prueba', pasos: [paso] })
}

const accesos = () => db.accesos_boveda.toArray()

beforeEach(async () => {
  await limpiarBase()
  await db.accesos_boveda.clear()
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

describe('el vínculo fijo de hoy (tarea 290, fase 1)', () => {
  it('con permiso y la Bóveda bloqueada: título vivo, contraída, desbloqueo en línea y la consulta registrada', async () => {
    await sembrarPerfil(true)
    await sembrarGuiaConVinculoFijo()
    await anclarMaestra()
    await sembrarCredencial({
      id: 'cred-fija',
      titulo: 'Acceso de prueba al panel',
      tipo: 'cuenta',
      usuario: USUARIO_FALSO,
      contrasena: CLAVE_FALSA,
    })
    bloquear()
    await montar(RUTAS, RUTA)

    await esperar(() => textoPantalla().includes('Credencial necesaria'), 'la credencial de la acción')
    // El título vivo de la credencial, no la copia de referencia.
    const fila = await esperarControl('Dato protegido: Acceso de prueba al panel')
    expect(fila.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain(USUARIO_FALSO)
    expect(textoPantalla()).not.toContain(CLAVE_FALSA)

    await tocar(fila)
    await esperar(() => textoPantalla().includes('La bóveda está bloqueada'), 'el desbloqueo en línea')
    await esperarQue(async () => (await accesos()).length === 1, 'la consulta registrada')
    expect((await accesos()).map((a) => [a.accion, a.credencialId])).toEqual([['consulto', 'cred-fija']])
    expect(textoPantalla()).not.toContain(USUARIO_FALSO)

    const campo = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
      'el campo de la contraseña maestra',
    )
    await escribir(campo, MAESTRA_PRUEBA)
    await enviarFormulario(campo)
    await esperar(() => textoPantalla().includes(USUARIO_FALSO), 'el usuario descifrado')
    // La contraseña sigue oculta hasta que se pide.
    expect(textoPantalla()).not.toContain(CLAVE_FALSA)
    expect(control(/^Ver ficha completa en Bóveda/)).not.toBeNull()
  })

  it('sin permiso de Bóveda: solo el título de referencia, sin datos ni registro', async () => {
    await sembrarPerfil(false)
    await sembrarGuiaConVinculoFijo()
    // Sin permiso, RLS no descarga la credencial: no se siembra.
    await montar(RUTAS, RUTA)

    const fila = await esperarControl('Dato protegido: Copia de referencia del acceso')
    await tocar(fila)
    await esperar(
      () => textoPantalla().includes('Solo los usuarios autorizados pueden consultar los datos de este paso.'),
      'el aviso de permiso',
    )
    expect(await accesos()).toEqual([])
    expect(document.body.querySelector('input[placeholder="Contraseña maestra"]')).toBeNull()
  })

  it('una credencial eliminada no se usa: lo dice, sin datos ni registro', async () => {
    await sembrarPerfil(true)
    await sembrarGuiaConVinculoFijo()
    await anclarMaestra()
    await sembrarCredencial({
      id: 'cred-fija',
      titulo: 'Acceso de prueba al panel',
      tipo: 'cuenta',
      usuario: USUARIO_FALSO,
      contrasena: CLAVE_FALSA,
    })
    await db.credenciales.update('cred-fija', { eliminadoEn: '2026-10-01T00:00:00.000Z' })
    await montar(RUTAS, RUTA)

    const fila = await esperarControl('Dato protegido: Copia de referencia del acceso')
    await tocar(fila)
    await esperar(() => textoPantalla().includes('Los datos vinculados fueron eliminados'), 'el aviso de eliminada')
    expect(await accesos()).toEqual([])
    expect(textoPantalla()).not.toContain(USUARIO_FALSO)
    expect(textoPantalla()).not.toContain(CLAVE_FALSA)
  })
})
