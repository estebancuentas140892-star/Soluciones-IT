// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { olvidarTodo } from '../../app/memoriaPestana'
import { db } from '../../lib/db'
import {
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  PERFIL_PRUEBA,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { AgendaPage } from '../inicio/AgendaPage'
import { HerramientasInventarioPage } from '../inventario/HerramientasInventarioPage'
import { RedPage } from '../red/RedPage'
import { TopologiaPage } from '../red/TopologiaPage'
import { PantallaMas } from './PantallaMas'

// MÁS E INFRAESTRUCTURA (tarea 257, Fase 5 del encargo del 2026-09-22,
// sección 6 de PROPUESTA_REDISENO_RESOLVER.md; revisada en la tarea 268,
// sección 22 del encargo del 2026-09-23). Con las pantallas de verdad:
//
//   - Más en cinco grupos, en su orden, cada destino en el suyo: una
//     puerta por capacidad.
//   - "Mejor desde el ordenador" ya no es un grupo: es la nota de
//     Importar y de Etiquetas, que viven en Herramientas de inventario.
//   - Mis favoritos es una fila de Consulta, y solo si hay alguno.
//   - Actividad del equipo salió de Más y está al final de la Agenda,
//     plegada.
//   - Red cuelga de Más con la pantalla que dejó la tarea 254, y la fila
//     de Más la abre en el nodo donde se dejó (lo que perdió en la 254).
//   - Topología ya no es fila de Más (tarea 268): se abre desde Red.
//
// Todo lo sembrado es INVENTADO.

const RUTAS = [
  { ruta: '/mas', elemento: <PantallaMas /> },
  { ruta: '/agenda', elemento: <AgendaPage /> },
  { ruta: '/red', elemento: <RedPage /> },
  { ruta: '/red/topologia', elemento: <TopologiaPage /> },
  { ruta: '/red/equipos', elemento: <p>EQUIPOS DE RED</p> },
  { ruta: '/inventario', elemento: <HerramientasInventarioPage /> },
  { ruta: '/referencia', elemento: <p>CENTRO DE CONSULTA</p> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>LA GUÍA</p> },
]

// Los grupos de Más: cada `section` con su título y los títulos de sus
// filas, en el orden en que se pintan.
function gruposDeMas(): { titulo: string; filas: string[] }[] {
  return Array.from(document.body.querySelectorAll('main section')).map((seccion) => ({
    titulo: (seccion.querySelector('h2')?.textContent ?? '').trim(),
    filas: Array.from(seccion.querySelectorAll('a, button'))
      .map((fila) => (fila.querySelector('.text-\\[15px\\]')?.textContent ?? '').trim())
      .filter(Boolean),
  }))
}

// La fila de Más cuyo título coincide.
function filaDeMas(titulo: string): HTMLElement | null {
  return (
    Array.from(document.body.querySelectorAll<HTMLElement>('main a, main button')).find(
      (fila) => (fila.querySelector('.text-\\[15px\\]')?.textContent ?? '').trim() === titulo,
    ) ?? null
  )
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  olvidarTodo()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('Más en cinco grupos', () => {
  it('Consulta, Organización, Infraestructura, Herramientas y Aplicación, en ese orden', async () => {
    await montar(RUTAS, '/mas')
    const grupos = await esperar(() => {
      const g = gruposDeMas()
      return g.length === 5 ? g : null
    }, 'Más pinta sus cinco grupos')

    expect(grupos.map((g) => g.titulo)).toEqual(['Consulta', 'Organización', 'Infraestructura', 'Herramientas', 'Aplicación'])
    // Los grupos de antes ya no existen.
    const texto = textoPantalla()
    expect(texto).not.toContain('Trabajo técnico')
    expect(texto).not.toContain('Lo mío y lo del equipo')
  })

  it('cada destino en su grupo, sin perder ninguno', async () => {
    await montar(RUTAS, '/mas')
    const grupos = await esperar(() => {
      const g = gruposDeMas()
      return g.length === 5 ? g : null
    }, 'Más pinta sus cinco grupos')

    // Sin favoritos, Consulta no tiene fila de favoritos.
    expect(grupos[0].filas).toEqual(['Centro de consulta', 'Agenda'])
    expect(grupos[1].filas).toEqual(['Personas', 'Ubicaciones'])
    expect(grupos[2].filas).toEqual(['Red'])
    // Diagnóstico salió en la tarea 269: su puerta es Guías.
    expect(grupos[3].filas).toEqual(['Herramientas de inventario'])
    expect(filaDeMas('Diagnóstico')).toBeNull()
    // Mi cuenta, Bloqueo y seguridad y Buscar actualización son una sola
    // puerta, y su subtítulo dice lo que hay dentro.
    expect(grupos[4].filas).toEqual(['Ajustes'])
    expect(filaDeMas('Ajustes')?.textContent).toContain('bloqueo')
    expect(filaDeMas('Ajustes')?.textContent).toContain('actualización')
    expect(filaDeMas('Ajustes')?.getAttribute('href')).toBe('/cuenta')
  })

  it('Topología ya no es fila de Más: se abre desde Red, que la enlaza', async () => {
    await montar(RUTAS, '/mas')
    await esperar(() => filaDeMas('Red'), 'aparece la fila Red')
    expect(filaDeMas('Topología')).toBeNull()

    await tocar(filaDeMas('Red') as HTMLElement)
    expect(ubicacionActual().pathname).toBe('/red')
    const mapa = await esperarControl(/^Mapa completo, desde cada raíz/)
    expect(mapa.getAttribute('href')).toBe('/red/topologia')
    await tocar(mapa)
    expect(ubicacionActual().pathname).toBe('/red/topologia')
  })

  it('Importar y Etiquetas viven en Herramientas de inventario, con su nota', async () => {
    await montar(RUTAS, '/mas')
    const puerta = await esperar(() => filaDeMas('Herramientas de inventario'), 'la puerta de inventario')
    expect(filaDeMas('Importar equipos')).toBeNull()
    expect(filaDeMas('Etiquetas QR')).toBeNull()

    await tocar(puerta)
    expect(ubicacionActual().pathname).toBe('/inventario')
    await esperar(() => filaDeMas('Etiquetas QR'), 'aparece la fila Etiquetas QR')
    expect(filaDeMas('Importar equipos')?.textContent).toContain('Mejor desde el ordenador')
    expect(filaDeMas('Etiquetas QR')?.textContent).toContain('Mejor desde el ordenador')
    // Ningún título de grupo lo dice.
    const titulos = Array.from(document.body.querySelectorAll('main h2')).map((h) => h.textContent)
    expect(titulos).not.toContain('Mejor desde el ordenador')
    // Su regreso vuelve a esta puerta, no a Equipos.
    expect(filaDeMas('Etiquetas QR')?.getAttribute('href')).toBe('/dispositivos/etiquetas')
  })
})

describe('Mis favoritos, una fila de Consulta solo si hay', () => {
  it('con un favorito aparece en Consulta, con su conteo, y se despliega en el sitio', async () => {
    const guia = await sembrarGuia({
      id: 'guia-favorita',
      titulo: 'Configurar la impresora de ejemplo',
      pasos: [pasoPrueba('p1', 'Abrir el panel', ['Tocar el engranaje'])],
    })
    await db.favoritos.put({
      clave: `articulo:${guia.id}`,
      tipo: 'articulo',
      entidadId: guia.id,
      marcadoEn: new Date().toISOString(),
    })

    await montar(RUTAS, '/mas')
    const fila = await esperar(() => filaDeMas('Mis favoritos'), 'aparece la fila Mis favoritos')

    // Es la última de Consulta, y cuenta uno.
    const consulta = gruposDeMas()[0]
    expect(consulta.titulo).toBe('Consulta')
    expect(consulta.filas).toEqual(['Centro de consulta', 'Agenda', 'Mis favoritos'])
    expect(fila.getAttribute('aria-expanded')).toBe('false')
    expect(fila.textContent).toContain('1')
    // Plegada, el favorito no está en pantalla.
    expect(textoPantalla()).not.toContain('Configurar la impresora de ejemplo')

    await tocar(fila)
    expect(fila.getAttribute('aria-expanded')).toBe('true')
    const enlace = await esperarControl(/Configurar la impresora de ejemplo/)
    expect(enlace.getAttribute('href')).toBe(`/soluciones/${guia.categoriaId}/${guia.id}`)
  })

  it('sin favoritos no hay fila: un destino vacío no lleva a nada', async () => {
    await montar(RUTAS, '/mas')
    await esperar(() => filaDeMas('Agenda'), 'aparece la fila Agenda')
    expect(filaDeMas('Mis favoritos')).toBeNull()
  })
})

describe('Actividad del equipo, al final de la Agenda', () => {
  async function sembrarActividad() {
    const guia = await sembrarGuia({
      id: 'guia-editada',
      titulo: 'Reiniciar el switch de ejemplo',
      pasos: [pasoPrueba('p1', 'Apagar', ['Desconectar la corriente'])],
    })
    await db.historial.put({
      id: 'hist-1',
      entidadTipo: 'articulo',
      entidadId: guia.id,
      usuario: PERFIL_PRUEBA.id,
      usuarioNombre: PERFIL_PRUEBA.nombre,
      fechaHora: new Date().toISOString(),
      campo: 'titulo',
      valorAnterior: 'Reiniciar el switch',
      valorNuevo: guia.titulo,
      motivo: '',
    })
  }

  it('ya no está en Más', async () => {
    await sembrarActividad()
    await montar(RUTAS, '/mas')
    await esperar(() => filaDeMas('Agenda'), 'aparece la fila Agenda')
    expect(textoPantalla()).not.toContain('Actividad del equipo')
  })

  it('está en la Agenda, la última, y plegada hasta que se abre', async () => {
    await sembrarActividad()
    await montar(RUTAS, '/agenda')
    const cabecera = await esperarControl(/^Actividad del equipo/)

    // Es lo último de la agenda: no compite con lo vencido ni con lo de hoy.
    const columna = document.body.querySelector('main > div')
    expect(columna?.lastElementChild?.contains(cabecera)).toBe(true)
    // Plegada: dice cuántos, pero no quién hizo qué.
    expect(cabecera.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain('editó')

    await tocar(cabecera)
    await esperar(() => textoPantalla().includes('editó'), 'se despliega la actividad')
    const texto = textoPantalla()
    expect(texto).toContain(`${PERFIL_PRUEBA.nombre} editó Reiniciar el switch de ejemplo`)
  })

  it('sin actividad, la Agenda no monta la sección', async () => {
    await montar(RUTAS, '/agenda')
    await esperar(() => textoPantalla().includes('Todo al día'), 'la agenda termina de cargar')
    expect(textoPantalla()).not.toContain('Actividad del equipo')
  })
})

// Red cambia de puerta, no de comportamiento (sección 6 de la
// propuesta: "no se tocan"). Su pantalla sigue siendo la sección con
// regreso que dejó la tarea 254; lo que se prueba es la puerta.
describe('Red cuelga de Más', () => {
  it('conserva su pantalla: sección con su nombre y regreso a Más', async () => {
    await montar(RUTAS, '/red')
    const volver = await esperarControl('Volver a Más')
    expect(volver.getAttribute('href')).toBe('/mas')
    expect(document.body.querySelector('h1')?.textContent).toBe('Red')

    await tocar(volver)
    expect(ubicacionActual().pathname).toBe('/mas')
  })

  it('la fila de Más la abre en el nodo donde se dejó (lo que perdió en la tarea 254)', async () => {
    await montar(RUTAS, '/red?nodo=sw-bodega')
    await tocar(await esperarControl('Volver a Más'))

    const red = await esperar(() => filaDeMas('Red'), 'aparece la fila Red')
    expect(red.getAttribute('href')).toBe('/red?nodo=sw-bodega')
    await tocar(red)
    expect(ubicacionActual().pathname).toBe('/red')
    expect(ubicacionActual().search).toBe('?nodo=sw-bodega')
  })

  it('sin haber pasado por Red, la fila abre Red a secas', async () => {
    await montar(RUTAS, '/mas')
    const red = await esperar(() => filaDeMas('Red'), 'aparece la fila Red')
    expect(red.getAttribute('href')).toBe('/red')
  })
})
