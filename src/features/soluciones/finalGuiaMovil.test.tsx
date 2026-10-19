// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AvisoFlotante } from '../../components/AvisoFlotante'
import { retirarAviso } from '../../components/avisosFlotantes'
import {
  COMPLETAR_Y_SEGUIR,
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// EL REMATE MÓVIL DE LA GUÍA (tarea 341, handoff móvil "1b Pulgar").
//
//   - En el teléfono, la pantalla final dice "Guía completada", qué se hizo y
//     dónde, la hora del cierre en mono, y deja una sola acción rellena
//     (salir) con RP-1 y "Empezar de nuevo" a mano. Ninguna función se pierde.
//   - Desde 768 la pantalla final es la aprobada de siempre.
//   - Salir con la X a mitad de la guía avisa de que el avance quedó guardado.
//
// Todo lo sembrado es inventado.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba
const TELEFONO = { width: 390, height: 844 }
const TABLETA = { width: 768, height: 1024 }

const RUTA = '/soluciones/cat-pruebas/guia-fin'
const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
]

/** Las acciones rellenas a la vista (la regla 30: como mucho una). */
function rellenas(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('a, button')).filter((el) =>
    el.className.split(/\s+/).includes('bg-noct-accent'),
  )
}

beforeEach(async () => {
  ventana.happyDOM.setViewport(TELEFONO)
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrarEquipo({ id: 'fin-1', nombre: 'IMPRESORA-PRUEBA-FIN' })
})

afterEach(async () => {
  await desmontarTodo()
  retirarAviso()
  ventana.happyDOM.setViewport(TELEFONO)
})

describe('la pantalla final de una guía', () => {
  beforeEach(async () => {
    await sembrarGuia({ id: 'guia-fin', titulo: 'Limpiar el rodillo de prueba', pasos: [pasoPrueba('fin-p1', 'Limpiar', ['Pasar el paño'])] })
  })

  it('en el teléfono: "Guía completada", qué y dónde, la hora en mono y una sola acción rellena', async () => {
    await montar(RUTAS, `${RUTA}?equipo=fin-1`)
    await tocar(await esperar(() => control(/^Completar y terminar$/), 'la única acción'))
    await esperar(() => textoPantalla().includes('Guía completada'), 'la pantalla final del teléfono')

    expect(textoPantalla()).toContain('Limpiar el rodillo de prueba en IMPRESORA-PRUEBA-FIN. 1 paso.')
    expect(textoPantalla()).not.toContain('Guía terminada')
    const fecha = await esperar(
      () => Array.from(document.body.querySelectorAll('p.font-mono')).find((p) => /\d{4} · \d{1,2}:\d{2}$/.test(p.textContent ?? '')),
      'la hora del cierre en mono',
    )
    expect(fecha).toBeTruthy()
    // La marca que crece una vez (la animación la gobierna index.css, con
    // "reducir movimiento" respetado).
    expect(document.body.querySelector('[data-marca-completada]')).not.toBeNull()

    // Ninguna función se pierde: salir, RP-1 y empezar de nuevo.
    expect(rellenas().map((el) => el.textContent?.trim())).toEqual(['Salir de la guía'])
    await esperar(() => control('Registrar intervención en IMPRESORA-PRUEBA-FIN'), 'la oferta de RP-1')
    expect(control('Empezar de nuevo')).not.toBeNull()
  })

  it('desde 768, la pantalla final aprobada no cambia', async () => {
    ventana.happyDOM.setViewport(TABLETA)
    await montar(RUTAS, `${RUTA}?equipo=fin-1`)
    await tocar(await esperar(() => control(/^Completar y terminar$/), 'la única acción'))
    await esperar(() => textoPantalla().includes('Guía terminada'), 'la pantalla final aprobada')

    expect(textoPantalla()).not.toContain('Guía completada')
    expect(document.body.querySelector('[data-marca-completada]')).toBeNull()
    expect(control('Salir de la guía')).not.toBeNull()
    await esperar(() => control('Registrar intervención en IMPRESORA-PRUEBA-FIN'), 'la oferta de RP-1')
    expect(control('Empezar de nuevo')).not.toBeNull()
  })
})

describe('salir de la guía a medias', () => {
  it('la X avisa de que el avance quedó guardado, y el aviso se anuncia sin robar el foco', async () => {
    await sembrarGuia({
      id: 'guia-fin',
      titulo: 'Limpiar el rodillo de prueba',
      pasos: [pasoPrueba('fin-p1', 'Abrir la tapa', ['Abrir la tapa de prueba']), pasoPrueba('fin-p2', 'Limpiar', ['Pasar el paño'])],
    })
    // El aviso vive en la raíz de la app, fuera de las rutas: sigue a la
    // vista aunque la X navegue.
    await montar([{ ruta: '*', elemento: <AvisoFlotante /> }], '/')
    await montar(RUTAS, RUTA)

    await tocar(await esperarControl(COMPLETAR_Y_SEGUIR))
    await esperar(() => textoPantalla().includes('Pasar el paño'), 'el paso 2')
    await tocar(await esperarControl('Salir de la guía'))

    const region = await esperar(
      () => Array.from(document.body.querySelectorAll('[role="status"]')).find((el) => el.textContent?.includes('Avance guardado')),
      'el aviso flotante',
    )
    expect(region.textContent).toBe('Avance guardado: paso 2 de 2')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(textoPantalla()).toContain('LISTA DE GUÍAS')
  })
})
