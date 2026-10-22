// @vitest-environment happy-dom
import { act, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HojaInferior } from '../components/HojaInferior'
import { BovedaPage } from '../features/boveda/BovedaPage'
import { DispositivoPage } from '../features/dispositivos/DispositivoPage'
import { DispositivosPage } from '../features/dispositivos/DispositivosPage'
import { AutorizacionPage } from '../features/facturacion/AutorizacionPage'
import { ResolverPage } from '../features/inicio/ResolverPage'
import { MantenimientosPage } from '../features/mantenimientos/MantenimientosPage'
import { PantallaMas } from '../features/mas/PantallaMas'
import { db } from '../lib/db'
import {
  anclarMaestra,
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pausa,
  sembrarEquipo,
  sembrarPerfil,
  tocar,
} from '../pruebas/montaje'
import { Chasis } from './Chasis'

// EL CHASIS POR ANCHO (tarea 339, handoff de tableta y escritorio, T1 y T2).
//
// Lo que se decide en JavaScript, y por eso se prueba aquí, con la ventana
// de happy-dom a cada ancho (su `matchMedia` sigue a `setViewport`):
//
//   - el buscador de una raíz vive en UN solo sitio: el dock en el
//     teléfono, la barra superior desde 768 px. Nunca dos campos;
//   - en las demás secciones, la lupa del teléfono es desde 768 px un
//     disparador con forma de campo, con la tecla "/" a la vista desde 1280;
//   - la acción principal de un documento aparece una sola vez por ventana:
//     en su barra fija en el teléfono, en la cabecera desde 768;
//   - la hoja inferior es desde 768 px un panel lateral con la misma API,
//     y se cierra con Esc, con la X o con un clic fuera;
//   - la tarea no monta navegación en ningún tamaño.
//
// Las pruebas miran un teléfono por defecto (src/pruebas/setup.ts).

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

const TELEFONO = { width: 390, height: 844 }
const TABLETA = { width: 768, height: 1024 }
const ESCRITORIO = { width: 1280, height: 832 }
const AMPLIO = { width: 1680, height: 1050 }
const ANCHOS = [
  ['390', TELEFONO],
  ['768', TABLETA],
  ['1280', ESCRITORIO],
  ['1680', AMPLIO],
] as const

function verA(vista: { width: number; height: number }): void {
  ventana.happyDOM.setViewport(vista)
}

const AHORA = '2026-10-14T12:00:00.000Z'

const campos = (alcance: string) => document.body.querySelectorAll(`input[aria-label="Buscar en ${alcance}"]`)
const enDock = (elemento: Element | null) => elemento?.closest('[data-dock-busqueda]') ?? null
// Resolver en el teléfono lleva su campo arriba, bajo el título (tarea 344).
const arribaEnResolver = (elemento: Element | null) => elemento?.closest('[data-buscador-resolver]') ?? null
const enCabecera = (elemento: Element | null) => elemento?.closest('.sticky.top-0') ?? null
const controles = (nombre: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>('button, a')).filter(
    (el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim() === nombre,
  )
const dialogo = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
  verA({ width: 375, height: 812 })
})

describe('el buscador de una raíz se monta una sola vez', () => {
  const RAICES = [
    {
      nombre: 'Resolver',
      rutas: [
        { ruta: '/', elemento: <ResolverPage /> },
        { ruta: '/soluciones', elemento: <p>Catálogo de guías</p> },
      ],
      entrada: '/',
      alcance: 'Soluciones IT',
      // Desde la tarea 344, en el teléfono el campo va arriba y no en el dock.
      enTelefono: 'arriba' as const,
    },
    {
      nombre: 'Equipos',
      rutas: [{ ruta: '/dispositivos', elemento: <DispositivosPage /> }],
      entrada: '/dispositivos',
      alcance: 'Equipos',
      // Desde la tarea 350 (prototipo de Claude Design), arriba, bajo el
      // título, en la cabecera fija; el escáner, en la fila del título.
      enTelefono: 'cabecera' as const,
    },
  ]

  for (const raiz of RAICES) {
    for (const [etiqueta, vista] of ANCHOS) {
      const dondeEnTelefono = raiz.enTelefono === 'cabecera' ? 'en la cabecera, bajo el título' : 'arriba, bajo el título'
      it(`${raiz.nombre} a ${etiqueta} px: un campo, ${vista.width < 768 ? dondeEnTelefono : 'en la barra superior'}`, async () => {
        verA(vista)
        await montar(raiz.rutas, raiz.entrada)
        const campo = await esperar(() => campos(raiz.alcance)[0], `aparece el buscador de ${raiz.nombre}`)
        expect(campos(raiz.alcance)).toHaveLength(1)
        // El escáner va con el campo: al lado en el dock, dentro en la barra;
        // en Resolver del teléfono, al final del propio campo (tarea 350; en la
        // fila del título desde la 344).
        expect(controles('Escanear QR')).toHaveLength(1)
        if (vista.width < 768 && raiz.enTelefono === 'arriba') {
          expect(arribaEnResolver(campo)).not.toBeNull()
          expect(enDock(campo)).toBeNull()
          expect(document.body.querySelector('[data-dock-busqueda]')).toBeNull()
          expect(campo.closest('label')?.querySelector('a[aria-label="Escanear QR"]')).not.toBeNull()
        } else if (vista.width < 768) {
          expect(enDock(campo)).toBeNull()
          expect(document.body.querySelector('[data-dock-busqueda]')).toBeNull()
          expect(enCabecera(campo)).not.toBeNull()
          expect(enCabecera(controles('Escanear QR')[0])).not.toBeNull()
        } else {
          expect(document.body.querySelector('[data-dock-busqueda]')).toBeNull()
          expect(enCabecera(campo)).not.toBeNull()
          expect(campo.closest('label')?.querySelector('a[aria-label="Escanear QR"]')).not.toBeNull()
        }
      })
    }
  }

  it('la Bóveda abierta también: el dock en el teléfono y la barra desde 768', async () => {
    await anclarMaestra()
    for (const vista of [TELEFONO, ESCRITORIO]) {
      verA(vista)
      const montaje = await montar([{ ruta: '/boveda', elemento: <BovedaPage /> }], '/boveda')
      const campo = await esperar(() => campos('la Bóveda')[0], 'aparece el buscador de la Bóveda')
      expect(campos('la Bóveda')).toHaveLength(1)
      expect(Boolean(enDock(campo))).toBe(vista.width < 768)
      expect(Boolean(enCabecera(campo))).toBe(vista.width >= 768)
      await montaje.desmontar()
    }
  })

  it('al cruzar los 768 px el campo cambia de sitio sin duplicarse ni perder lo escrito', async () => {
    verA(TELEFONO)
    await montar(
      [
        { ruta: '/', elemento: <ResolverPage /> },
        { ruta: '/soluciones', elemento: <p>Catálogo de guías</p> },
      ],
      '/',
    )
    await escribir(await esperar(() => campoBuscador(), 'aparece el buscador'), 'impresora')
    expect(arribaEnResolver(campoBuscador())).not.toBeNull()

    await act(async () => verA(ESCRITORIO))
    await pausa()
    expect(campos('Soluciones IT')).toHaveLength(1)
    expect(enDock(campoBuscador())).toBeNull()
    expect(enCabecera(campoBuscador())).not.toBeNull()
    expect(campoBuscador()?.value).toBe('impresora')

    await act(async () => verA(TELEFONO))
    await pausa()
    expect(campos('Soluciones IT')).toHaveLength(1)
    expect(arribaEnResolver(campoBuscador())).not.toBeNull()
    expect(campoBuscador()?.value).toBe('impresora')
  })
})

describe('el disparador del buscador global', () => {
  const RUTAS = [{ ruta: '/mas', elemento: <PantallaMas /> }]

  it('en el teléfono es la lupa de siempre, sin campo ni tecla', async () => {
    verA(TELEFONO)
    await montar(RUTAS, '/mas')
    const lupa = await esperarControl('Buscar en Soluciones IT')
    expect(controles('Buscar en Soluciones IT')).toHaveLength(1)
    expect(lupa.querySelector('kbd')).toBeNull()
    expect(lupa.textContent?.trim()).toBe('')
  })

  for (const [etiqueta, vista] of [
    ['768', TABLETA],
    ['1280', ESCRITORIO],
  ] as const) {
    it(`a ${etiqueta} px tiene forma de campo, dice qué busca y abre el buscador global`, async () => {
      verA(vista)
      await montar(RUTAS, '/mas')
      const disparador = await esperarControl('Buscar en Soluciones IT')
      expect(controles('Buscar en Soluciones IT')).toHaveLength(1)
      expect(disparador.textContent).toContain('Buscar en Soluciones IT')
      expect(disparador.getAttribute('aria-keyshortcuts')).toBe('/')
      // La tecla se dibuja siempre y se ve desde 1280 (`xl:inline-flex`).
      expect(disparador.querySelector('kbd')?.className).toContain('xl:inline-flex')
      expect(enCabecera(disparador)).not.toBeNull()

      await tocar(disparador)
      await esperar(() => campoBuscador(), 'se abre el buscador global')
    })
  }
})

describe('la acción principal de un documento, una vez por ventana', () => {
  async function sembrarPos(): Promise<void> {
    await db.categorias.put({ id: 'cat-pos', nombre: 'POS', icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null })
    await sembrarEquipo({ id: 'pos-a', nombre: 'POS de prueba A', categoriaId: 'cat-pos', estado: 'Operativo' })
  }

  for (const [etiqueta, vista] of ANCHOS) {
    it(`"Programar mantenimiento" a ${etiqueta} px`, async () => {
      verA(vista)
      await sembrarPos()
      await montar(
        [{ ruta: '/dispositivos/:dispositivoId/mantenimientos', elemento: <MantenimientosPage /> }],
        '/dispositivos/pos-a/mantenimientos',
      )
      // Se cuenta con la pantalla ya cargada: la barra del teléfono llega
      // con la lista de mantenimientos, después de la cabecera.
      await esperar(() => document.body.textContent?.includes('Sin mantenimientos'), 'carga la pantalla')
      const boton = await esperarControl('Programar mantenimiento')
      expect(controles('Programar mantenimiento')).toHaveLength(1)
      expect(Boolean(enCabecera(boton))).toBe(vista.width >= 768)

      await tocar(boton)
      const hoja = await esperar(() => dialogo(), 'se abre la hoja de programar')
      expect(hoja.textContent).toContain('Programar mantenimiento')
    })
  }

  for (const [etiqueta, vista] of [
    ['390', TELEFONO],
    ['1280', ESCRITORIO],
  ] as const) {
    it(`"Editar" de una autorización a ${etiqueta} px`, async () => {
      verA(vista)
      await sembrarPos()
      await db.autorizaciones_facturacion.put({
        id: 'aut-1',
        dispositivoIds: ['pos-a'],
        prefijo: 'PRB',
        formulario: '',
        rangoDesde: 3000,
        rangoHasta: 8000,
        fechaFormalizacion: null,
        vigenciaReportada: '',
        vencimientoDocumentado: null,
        vencimientoConfirmado: null,
        consecutivoActual: null,
        consecutivoLeidoEn: null,
        consecutivoFuente: '',
        estado: 'documentada',
        fuente: 'Documento de prueba',
        verificadoEn: null,
        verificacionFuente: '',
        observaciones: '',
        evidenciaAdjuntoId: null,
        updatedAt: AHORA,
        updatedBy: null,
        eliminadoEn: null,
      })
      await montar([{ ruta: '/facturacion/:autorizacionId', elemento: <AutorizacionPage /> }], '/facturacion/aut-1')
      const editar = await esperarControl('Editar')
      expect(controles('Editar')).toHaveLength(1)
      expect(Boolean(enCabecera(editar))).toBe(vista.width >= 768)
      expect(editar.getAttribute('href')).toBe('/facturacion/aut-1/editar')
    })
  }
})

describe('la hoja inferior como panel lateral', () => {
  function ConHoja() {
    const [abierta, setAbierta] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setAbierta(true)}>
          Abrir conexiones
        </button>
        <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Conexiones" contexto="POSPN01">
          <p>Recibe servicio de SW-PN-ACC-02</p>
        </HojaInferior>
      </>
    )
  }

  async function abrir(): Promise<HTMLElement> {
    await tocar(await esperarControl('Abrir conexiones'))
    return esperar(() => dialogo(), 'se abre el panel')
  }

  for (const [etiqueta, vista] of ANCHOS) {
    it(`a ${etiqueta} px se cierra con Esc, con la X y con un clic fuera, y no con uno dentro`, async () => {
      verA(vista)
      await montar([{ ruta: '/', elemento: <ConHoja /> }], '/')

      // Esc.
      await abrir()
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      await pausa()
      expect(dialogo()).toBeNull()

      // La X.
      await abrir()
      await tocar(await esperarControl('Cerrar'))
      expect(dialogo()).toBeNull()

      // Un clic dentro no cierra; uno fuera (en el velo), sí.
      const panel = await abrir()
      await tocar(panel.querySelector('p') as HTMLElement)
      expect(dialogo()).not.toBeNull()
      await tocar(panel.parentElement as HTMLElement)
      expect(dialogo()).toBeNull()
    })
  }

  it('la misma API, con su forma de panel desde 768 px: 420, 440 desde 1280 y 480 desde 1680', async () => {
    verA(ESCRITORIO)
    await montar([{ ruta: '/', elemento: <ConHoja /> }], '/')
    const panel = await abrir()
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(panel.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Conexiones')
    for (const clase of ['md:w-[420px]', 'xl:w-[440px]', '3xl:w-[480px]', 'md:h-full', 'md:shadow-[var(--shadow-noct-panel)]']) {
      expect(panel.className).toContain(clase)
    }
    expect(panel.parentElement?.className).toContain('md:justify-end')
  })

  it('el foco entra al panel, Tab da la vuelta dentro y al cerrar vuelve a lo que lo abrió (tarea 340)', async () => {
    verA(ESCRITORIO)
    await montar([{ ruta: '/', elemento: <ConHoja /> }], '/')
    const abridor = await esperarControl('Abrir conexiones')
    abridor.focus()
    const panel = await abrir()
    expect(panel.contains(document.activeElement)).toBe(true)

    // El único enfocable es la X: Tab y Mayús+Tab se quedan en ella.
    const cerrar = await esperarControl('Cerrar')
    for (const shiftKey of [false, true, false]) {
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }))
      })
      expect(document.activeElement).toBe(cerrar)
    }

    await tocar(cerrar)
    expect(dialogo()).toBeNull()
    expect(document.activeElement).toBe(abridor)
  })

  it('en la ficha, la fila que abrió el panel queda marcada mientras está abierto', async () => {
    verA(ESCRITORIO)
    await sembrarEquipo({ id: 'pc-1', nombre: 'PC de prueba', estado: 'Operativo' })
    await montar([{ ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> }], '/dispositivos/pc-1')
    const fila = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.startsWith('Más datos')),
      'aparece la fila "Más datos"',
    )
    expect(fila.getAttribute('aria-expanded')).toBe('false')
    await tocar(fila)
    await esperar(() => dialogo(), 'se abre el panel de más datos')
    expect(fila.getAttribute('aria-expanded')).toBe('true')
    await tocar(await esperarControl('Cerrar'))
    expect(fila.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('la tarea no monta navegación en ningún tamaño', () => {
  for (const [etiqueta, vista] of ANCHOS) {
    it(`a ${etiqueta} px`, async () => {
      verA(vista)
      await montar(
        [
          {
            ruta: '/',
            elemento: (
              <Chasis modo="tarea" rotulo="Ejecutando" titulo="Guía de prueba">
                <p>Paso 1</p>
              </Chasis>
            ),
          },
        ],
        '/',
      )
      await esperar(() => control('Salir') ?? document.body.textContent?.includes('Paso 1'), 'se monta la tarea')
      expect(document.body.querySelector('nav[aria-label="Navegación principal"]')).toBeNull()
      expect(document.body.querySelector('aside')).toBeNull()
    })
  }
})

// LA PESTAÑA ACTIVA DEL TELÉFONO (tarea 349, navegación de Ventana): la
// pastilla tintada detrás de su icono, el icono relleno y el rótulo en acento
// y en negrita. Las otras tres, sin tinte y con la pastilla del mismo tamaño
// (cambiar de pestaña no mueve nada).
describe('la pestaña activa del teléfono', () => {
  it('lleva la pastilla tintada y la marca de página actual; las demás no', async () => {
    verA(TELEFONO)
    await montar([{ ruta: '/', elemento: <ResolverPage /> }], '/')
    const barra = await esperar(
      // El rail de tableta y escritorio lleva el mismo nombre; la barra del
      // teléfono es la fija de abajo.
      () => document.body.querySelector<HTMLElement>('nav[aria-label="Navegación principal"].fixed'),
      'la barra de pestañas',
    )
    const pestanas = Array.from(barra.querySelectorAll<HTMLAnchorElement>('a'))
    expect(pestanas.map((p) => p.textContent?.replace(/\(.*\)/, '').trim())).toEqual(['Resolver', 'Equipos', 'Bóveda', 'Más'])
    const activa = pestanas.find((p) => p.getAttribute('aria-current') === 'page')
    expect(activa?.textContent).toContain('Resolver')
    // La barra del prototipo (tarea 350): sobre la superficie, 800 la activa
    // y 600 las demás, la pastilla de 56 x 30 con el tinte del acento.
    expect(barra.className).toContain('bg-noct-surface')
    expect(activa?.className).toContain('font-extrabold')
    expect(activa?.querySelector('[data-pastilla-pestana="activa"]')?.className).toContain('bg-noct-accent-900')
    for (const otra of pestanas.filter((p) => p !== activa)) {
      expect(otra.className).toContain('font-semibold')
      expect(otra.querySelector('[data-pastilla-pestana="activa"]')).toBeNull()
      expect(otra.querySelector('span')?.className).toContain('h-[30px] w-14')
    }
  })
})
