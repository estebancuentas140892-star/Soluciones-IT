// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Diagnostico, type NodoDiagnostico, type OpcionDiagnostico } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import {
  campoBuscador,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { IniciarDiagnosticoBoton } from '../dispositivos/IniciarDiagnosticoBoton'
import { ResolverPage } from '../inicio/ResolverPage'
import { SolucionesPage } from '../soluciones/SolucionesPage'
import { DiagnosticoRunPage } from './DiagnosticoRunPage'
import { DiagnosticosPage } from './DiagnosticosPage'

// LAS GUÍAS CON PREGUNTAS DENTRO DE RESOLVER Y FUERA DE MÁS (tarea 269,
// sección 17 del encargo del 2026-09-23). Con las pantallas de verdad:
//
//   - el técnico no elige herramienta: un SÍNTOMA escrito en Resolver
//     abre la guía con preguntas, y un PROCEDIMIENTO, la guía con pasos,
//     aunque las dos coincidan con las palabras;
//   - la administración (crear, editar, estadísticas, sugerencias) tiene
//     su puerta en Guías, "Guías con preguntas", y vuelve a Guías con el
//     filtro puesto;
//   - desde la ficha de un equipo, la lista de problemas vuelve al equipo.
//
// Los recorridos A a E de la tarea 263 siguen probados en
// `resolucionGuiada.test.tsx`. Todo lo sembrado es INVENTADO.

const AHORA = '2026-09-23T12:00:00.000Z'

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/soluciones', elemento: <SolucionesPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>LA GUÍA CON PASOS</p> },
  { ruta: '/diagnostico', elemento: <DiagnosticosPage /> },
  { ruta: '/diagnostico/:diagnosticoId', elemento: <DiagnosticoRunPage /> },
  { ruta: '/diagnostico/:diagnosticoId/editar', elemento: <p>EDITOR</p> },
  {
    ruta: '/dispositivos/:dispositivoId',
    elemento: (
      <IniciarDiagnosticoBoton
        categoriaId="cat-pruebas"
        categoriaNombre="Pruebas"
        estado={conOrigen('/dispositivos/pc-1', 'PC-PRUEBA-1')}
      />
    ),
  },
]

function opcion(id: string, etiqueta: string, extra: Partial<OpcionDiagnostico> = {}): OpcionDiagnostico {
  return {
    id,
    etiqueta,
    siguienteNodoId: null,
    articuloId: null,
    articuloTitulo: '',
    mensajeFinal: '',
    resultado: '',
    ...extra,
  }
}

function pregunta(id: string, texto: string, opciones: OpcionDiagnostico[]): NodoDiagnostico {
  return { id, tituloInterno: '', pregunta: texto, descripcion: '', opciones }
}

async function sembrarRecorrido(id: string, titulo: string, categoriaId: string, nodos: NodoDiagnostico[]) {
  const diagnostico: Diagnostico = {
    id,
    categoriaId,
    titulo,
    descripcion: '',
    nodos,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  }
  await db.diagnosticos.put(diagnostico)
}

const TITULO_CLAVE = 'Cambiar la clave vencida de prueba'
const TITULO_SESION = 'El usuario de prueba no puede iniciar sesión'

/** Una guía con pasos y una guía con preguntas que la usa: coinciden en palabras. */
async function sembrarSesion() {
  await sembrarGuia({
    id: 'guia-clave',
    titulo: TITULO_CLAVE,
    pasos: [pasoPrueba('clave-p1', 'Cambiar', ['Asignar una clave temporal de prueba'])],
  })
  await sembrarRecorrido('rec-sesion', TITULO_SESION, 'cat-pruebas', [
    pregunta('s1', '¿Qué mensaje aparece al entrar?', [
      opcion('s-venc', 'Contraseña vencida', {
        articuloId: 'guia-clave',
        articuloTitulo: TITULO_CLAVE,
        mensajeFinal: 'Entregar la clave temporal.',
        resultado: 'solucionado',
      }),
      opcion('s-otro', 'Otro mensaje', { resultado: 'falta_informacion', mensajeFinal: 'Anotar el mensaje exacto.' }),
    ]),
  ])
}

async function sembrarOtraCategoria() {
  await db.categorias.put({
    id: 'cat-otra',
    nombre: 'Otra de prueba',
    icono: '',
    orden: 2,
    esRed: false,
    color: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
  await sembrarRecorrido('rec-otra', 'La pantalla de prueba no enciende', 'cat-otra', [
    pregunta('o1', '¿Tiene corriente?', [opcion('o-si', 'Sí', { resultado: 'solucionado', mensajeFinal: 'Listo.' })]),
  ])
}

/** El primer resultado de Resolver que abre una guía (con pasos o con preguntas). */
function primerResultado(): HTMLAnchorElement | null {
  return document.body.querySelector<HTMLAnchorElement>('main a[href^="/soluciones/"], main a[href^="/diagnostico/"]')
}

/** La fila "Guías con preguntas" de Guías. */
function puertaGuiasConPreguntas(): HTMLAnchorElement | null {
  return (
    Array.from(document.body.querySelectorAll<HTMLAnchorElement>('main a')).find(
      (a) => (a.querySelector('.text-\\[15px\\]')?.textContent ?? '').trim() === 'Guías con preguntas',
    ) ?? null
  )
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('Resolver no pide elegir herramienta', () => {
  it('un síntoma abre la guía con preguntas, presentada como una guía más', async () => {
    await sembrarSesion()
    await montar(RUTAS, '/')

    await escribir(await esperar(campoBuscador, 'el buscador de Resolver'), 'no puede iniciar sesión')
    const primero = await esperar(primerResultado, 'el primer resultado')
    expect(primero.getAttribute('href')).toBe('/diagnostico/rec-sesion')
    expect(primero.textContent).toContain('Guía con preguntas')

    await tocar(primero)
    await esperar(() => textoPantalla().includes('¿Qué mensaje aparece al entrar?'), 'la primera pregunta')
    expect(ubicacionActual().pathname).toBe('/diagnostico/rec-sesion')
  })

  it('un procedimiento abre la guía con pasos, aunque la guía con preguntas también coincida', async () => {
    await sembrarSesion()
    await montar(RUTAS, '/')

    await escribir(await esperar(campoBuscador, 'el buscador de Resolver'), 'cambiar la clave vencida')
    const primero = await esperar(primerResultado, 'el primer resultado')
    expect(primero.getAttribute('href')).toBe('/soluciones/cat-pruebas/guia-clave')
  })
})

describe('la administración de las guías con preguntas vive en Guías', () => {
  it('Guías tiene la puerta, con cuántas hay, y la lista vuelve a Guías', async () => {
    await sembrarSesion()
    await sembrarOtraCategoria()
    await montar(RUTAS, '/soluciones')

    const puerta = await esperar(puertaGuiasConPreguntas, 'la puerta en Guías')
    expect(puerta.getAttribute('href')).toBe('/diagnostico')
    expect(puerta.textContent).toContain('Diagnósticos: crear, editar, estadísticas y sugerencias')
    expect(puerta.textContent).toMatch(/2$/)

    await tocar(puerta)
    expect(ubicacionActual().pathname).toBe('/diagnostico')
    await esperar(() => document.body.querySelector('h1')?.textContent === 'Guías con preguntas', 'la lista')
    expect(ubicacionActual().state).toEqual({ origen: { to: '/soluciones', etiqueta: 'Guías' } })
    // Crear, sugerencias y estadísticas siguen ahí.
    const texto = textoPantalla()
    expect(texto).toContain('Sugerencias del equipo')
    expect(texto).toContain('Estadísticas')
    expect(document.body.querySelector('a[href="/diagnostico/nuevo"]')).not.toBeNull()
  })

  it('con una categoría elegida, cuenta y abre las de esa categoría, y vuelve con el filtro puesto', async () => {
    await sembrarSesion()
    await sembrarOtraCategoria()
    await montar(RUTAS, '/soluciones?categoria=cat-otra')

    const puerta = await esperar(puertaGuiasConPreguntas, 'la puerta en Guías')
    expect(puerta.getAttribute('href')).toBe('/diagnostico?categoria=cat-otra')
    expect(puerta.textContent).toMatch(/1$/)
    await tocar(puerta)
    expect(ubicacionActual().state).toEqual({ origen: { to: '/soluciones?categoria=cat-otra', etiqueta: 'Guías' } })
  })

  it('al buscar artículos la puerta no está: el buscador de Guías mira artículos', async () => {
    await sembrarSesion()
    await montar(RUTAS, '/soluciones')
    await esperar(puertaGuiasConPreguntas, 'la puerta en Guías')

    const campo = document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Guías"]')
    expect(campo).not.toBeNull()
    await escribir(campo as HTMLInputElement, 'clave')
    await esperar(() => puertaGuiasConPreguntas() === null, 'la puerta se retira al buscar')
  })
})

describe('desde la ficha de un equipo', () => {
  it('la lista de problemas de su categoría vuelve al equipo', async () => {
    await sembrarSesion()
    await montar(RUTAS, '/dispositivos/pc-1')

    await tocar(await esperar(() => document.body.querySelector<HTMLAnchorElement>('a[href^="/diagnostico"]'), 'el botón'))
    expect(ubicacionActual().pathname).toBe('/diagnostico')
    expect(ubicacionActual().search).toBe('?categoria=cat-pruebas')
    expect(ubicacionActual().state).toEqual({ origen: { to: '/dispositivos/pc-1', etiqueta: 'PC-PRUEBA-1' } })
    await esperar(() => textoPantalla().includes(TITULO_SESION), 'los problemas de la categoría')
  })
})
