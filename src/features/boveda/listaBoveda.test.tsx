// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Chasis } from '../../app/Chasis'
import {
  anclarMaestra,
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  navegarAtras,
  sembrarCredencial,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { BovedaPage } from './BovedaPage'

// LA LISTA DE LA BÓVEDA (encargo del 2026-11-26, sección 7): encontrar la
// credencial rápido sin tocar ningún control de seguridad.
//
//   - cada palabra escrita, en cualquier orden, y la IP del equipo
//     vinculado encuentran la credencial;
//   - con un solo equipo, la fila dice cuál (sin repetirlo si el título ya
//     lo nombra);
//   - lo escrito y la categoría vuelven al volver de la credencial, por el
//     regreso de la app y por el botón atrás del teléfono.
//
// La ficha de destino es mínima, en el chasis REAL, porque lo que se prueba
// es su regreso. Todo lo sembrado es INVENTADO.

function FichaCredencial() {
  return (
    <Chasis modo="documento" titulo="Ficha de la credencial">
      <p>FICHA DE LA CREDENCIAL</p>
    </Chasis>
  )
}

const RUTAS = [
  { ruta: '/boveda', elemento: <BovedaPage /> },
  { ruta: '/boveda/:credencialId', elemento: <FichaCredencial /> },
]

function campoBoveda(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en la Bóveda"]')
}

/** El enlace de una fila, por su título. */
function filaDe(titulo: string): HTMLAnchorElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLAnchorElement>('main a')).find((a) =>
    a.textContent?.includes(titulo),
  )
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await anclarMaestra()
  await sembrarEquipo({ id: 'sw-prueba', nombre: 'SW-PRUEBA-CENTRAL', ip: '10.99.9.2' })
  await sembrarEquipo({ id: 'imp-prueba', nombre: 'IMP-PRUEBA-TAQUILLA', ip: '10.99.9.40' })
  await sembrarEquipo({ id: 'imp-prueba-2', nombre: 'IMP-PRUEBA-BODEGA', ip: '10.99.9.41' })
  await sembrarCredencial({
    id: 'cred-switch',
    titulo: 'Admin del switch de prueba',
    tipo: 'cuenta',
    categoria: 'Redes',
    dispositivos: [{ id: 'sw-prueba', nombre: 'SW-PRUEBA-CENTRAL' }],
  })
  await sembrarCredencial({
    id: 'cred-web',
    titulo: 'Administrador web de prueba',
    tipo: 'cuenta',
    categoria: 'Impresoras',
    dispositivos: [{ id: 'imp-prueba', nombre: 'IMP-PRUEBA-TAQUILLA' }],
  })
  await sembrarCredencial({
    id: 'cred-dos',
    titulo: 'Panel compartido de prueba',
    tipo: 'cuenta',
    categoria: 'Impresoras',
    dispositivos: [
      { id: 'imp-prueba', nombre: 'IMP-PRUEBA-TAQUILLA' },
      { id: 'imp-prueba-2', nombre: 'IMP-PRUEBA-BODEGA' },
    ],
  })
  await sembrarCredencial({ id: 'cred-correo', titulo: 'Correo de prueba', tipo: 'cuenta', categoria: 'Correo' })
})

afterEach(async () => {
  await desmontarTodo()
})

describe('buscar en la Bóveda', () => {
  it('encuentra cada palabra en cualquier orden', async () => {
    await montar(RUTAS, '/boveda')
    await escribir(await esperar(campoBoveda, 'el buscador'), 'switch admin')
    await esperar(() => !filaDe('Correo de prueba'), 'solo lo que coincide')
    expect(filaDe('Admin del switch de prueba')).toBeDefined()
  })

  it('encuentra la credencial por la IP de su equipo', async () => {
    await montar(RUTAS, '/boveda')
    await escribir(await esperar(campoBoveda, 'el buscador'), '10.99.9.2')
    await esperar(() => !filaDe('Correo de prueba'), 'solo lo que coincide')
    expect(filaDe('Admin del switch de prueba')).toBeDefined()
    expect(filaDe('Administrador web de prueba')).toBeUndefined()
  })
})

describe('la fila de una credencial', () => {
  it('con un equipo lo nombra; con varios, los cuenta', async () => {
    await montar(RUTAS, '/boveda')
    const web = await esperar(() => filaDe('Administrador web de prueba'), 'la fila')
    expect(web.textContent).toContain('IMP-PRUEBA-TAQUILLA')
    expect(filaDe('Panel compartido de prueba')?.textContent).toContain('2 equipos con acceso')
  })

  it('no repite el equipo si el título ya lo nombra', async () => {
    await sembrarCredencial({
      id: 'cred-nombrada',
      titulo: 'Clave de SW-PRUEBA-CENTRAL',
      tipo: 'cuenta',
      categoria: 'Redes',
      dispositivos: [{ id: 'sw-prueba', nombre: 'SW-PRUEBA-CENTRAL' }],
    })
    await montar(RUTAS, '/boveda')
    const fila = await esperar(() => filaDe('Clave de SW-PRUEBA-CENTRAL'), 'la fila')
    expect(fila.textContent).toContain('1 equipo con acceso')
  })
})

describe('volver de una credencial', () => {
  async function abrirDesdeLaBusqueda(): Promise<void> {
    await montar(RUTAS, '/boveda')
    await tocar(await esperar(() => control(/^Impresoras/), 'el chip de categoría'))
    await esperar(() => ubicacionActual().search === '?categoria=Impresoras', 'la categoría en la URL')
    await escribir(await esperar(campoBoveda, 'el buscador'), 'panel')
    await tocar(await esperar(() => filaDe('Panel compartido de prueba'), 'el resultado'))
    await esperar(() => textoPantalla().includes('FICHA DE LA CREDENCIAL'), 'la ficha')
    // Lo escrito nunca viaja en la URL ni en localStorage.
    expect(ubicacionActual().search).toBe('')
    expect(window.localStorage.length).toBe(0)
  }

  it('el regreso de la app repone lo escrito y la categoría', async () => {
    await abrirDesdeLaBusqueda()

    await tocar(await esperarControl('Volver a Bóveda'))

    await esperar(() => ubicacionActual().pathname === '/boveda', 'la lista')
    expect(ubicacionActual().search).toBe('?categoria=Impresoras')
    expect((await esperar(campoBoveda, 'el buscador')).value).toBe('panel')
    expect(filaDe('Panel compartido de prueba')).toBeDefined()
  })

  it('el botón atrás del teléfono también', async () => {
    await abrirDesdeLaBusqueda()

    await navegarAtras()

    expect(ubicacionActual().search).toBe('?categoria=Impresoras')
    expect((await esperar(campoBoveda, 'el buscador')).value).toBe('panel')
  })
})
