// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo } from '../../lib/db'
import {
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  limpiarBase,
  montar,
  navegarAtras,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { EscanerPage } from '../escaner/EscanerPage'
import { DispositivoPage } from './DispositivoPage'
import { DispositivosPage } from './DispositivosPage'

// EQUIPOS + QR (encargo del 2026-09-22, secciones 16 a 18, tarea 256).
// Las reglas puras ya se prueban aparte (`busquedaEquipos.test.ts`,
// `conexiones.test.ts`, `resolverCodigo.test.ts`, `sesionEscaneo.test.ts`);
// aquí, lo que solo se ve montando las pantallas:
//
//   - Equipos pone delante Buscar y Escanear QR, sin menú "···" ni
//     resumen de estados, y al escribir enseña también los de red;
//   - la búsqueda vuelve con el botón atrás al salir a una ficha;
//   - la ficha dice arriba tipo, IP, ubicación, responsable y a qué está
//     conectado, luego problemas y procedimientos, y pliega el resto;
//   - el escáner abre la ficha directamente con un solo equipo y
//     reconoce el QR del portal de asistencia.
//
// Todo lo que se siembra es INVENTADO.

const AHORA = '2026-09-22T12:00:00.000Z'

async function sembrarCategorias() {
  await db.categorias.bulkPut([
    { id: 'cat-equipos', nombre: 'Computadores', icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
    { id: 'cat-red', nombre: 'Switches', icono: '', orden: 2, esRed: true, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
  ])
}

async function sembrarInventario() {
  await sembrarCategorias()
  // El responsable es una ficha de persona (tarea 266): un texto suelto
  // sin ficha se ve "Sin responsable · por validar" (prueba propia abajo).
  await db.personas.put({
    id: 'per-prueba',
    nombre: 'Persona de prueba',
    notas: '',
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
  await sembrarEquipo({
    id: 'pc',
    nombre: 'PC Caja de prueba',
    marca: 'Marca de prueba',
    modelo: 'Modelo X',
    ip: '10.9.9.21',
    ubicacion: 'Taquilla de prueba',
    responsable: 'Persona de prueba',
    responsableId: 'per-prueba',
    serial: 'SERIE-PRUEBA-1',
    placaInventario: 'INV-PRUEBA-1',
    estado: 'operativo',
  })
  await sembrarEquipo({ id: 'sw', nombre: 'SW-CENTRAL-PRUEBA', categoriaId: 'cat-red', ip: '10.9.9.2', ubicacion: 'Rack de prueba' })
  await db.conexiones.put({
    id: 'enlace-1',
    tipo: 'enlace',
    origenId: 'sw',
    origenNombre: 'SW-CENTRAL-PRUEBA',
    origenPuerto: '18',
    destinoId: 'pc',
    destinoNombre: 'PC Caja de prueba',
    destinoPuerto: '',
    medio: 'UTP',
    notas: '',
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  sessionStorage.clear()
})

afterEach(async () => {
  await desmontarTodo()
})

function campoEquipos(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Equipos"]')
}

describe('Equipos', () => {
  const RUTAS = [
    { ruta: '/dispositivos', elemento: <DispositivosPage /> },
    { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
  ]

  it('pone delante Buscar y Escanear QR; Crear es secundario y no hay menú "···" ni resumen', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/dispositivos')
    await esperar(() => textoPantalla().includes('PC Caja de prueba'), 'la lista')

    expect(campoEquipos()).not.toBeNull()
    expect(control('Escanear QR')?.getAttribute('href')).toBe('/escaner')
    expect(control('Crear equipo')?.getAttribute('href')).toBe('/dispositivos/nuevo')
    expect(control(/^Más acciones/)).toBeNull()
    expect(textoPantalla()).not.toContain('operativos')
    // Sin texto, la red no llena la lista.
    expect(textoPantalla()).not.toContain('SW-CENTRAL-PRUEBA')
  })

  it('al escribir también salen los equipos de red, aparte', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/dispositivos')
    const campo = await esperar(() => campoEquipos(), 'el buscador de equipos')

    await escribir(campo, 'central')
    await esperar(() => textoPantalla().includes('SW-CENTRAL-PRUEBA'), 'el switch')
    expect(textoPantalla()).toContain('Equipos de red')
    expect(textoPantalla()).not.toContain('PC Caja de prueba')
  })

  it('la búsqueda vuelve al regresar de la ficha, aunque el equipo sea de red', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/dispositivos')
    const campo = await esperar(() => campoEquipos(), 'el buscador de equipos')
    await escribir(campo, 'central')

    await tocar(await esperar(() => control(/SW-CENTRAL-PRUEBA/), 'la fila del switch'))
    await esperar(() => textoPantalla().includes('FICHA DEL EQUIPO'), 'la ficha')
    // El regreso lleva a Equipos, no a Red, y con la búsqueda.
    const estado = ubicacionActual().state as { origen?: { to: string; busqueda?: { consulta: string } } }
    expect(estado.origen?.to).toBe('/dispositivos')
    expect(estado.origen?.busqueda?.consulta).toBe('central')

    await navegarAtras()
    await esperar(() => campoEquipos()?.value === 'central', 'la búsqueda repuesta')
    expect(textoPantalla()).toContain('SW-CENTRAL-PRUEBA')
  })
})

describe('la ficha del equipo', () => {
  const RUTAS = [
    { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
    { ruta: '/dispositivos', elemento: <p>LISTA</p> },
  ]

  async function sembrarGuiasDelEquipo() {
    const procedimiento = await sembrarGuia({
      id: 'guia-pc',
      titulo: 'Configurar la caja de prueba',
      pasos: [pasoPrueba('p1', 'Abrir la caja', ['Encender'])],
    })
    await db.articulos.update('guia-pc', { dispositivosAfectados: [{ id: 'pc', nombre: 'PC Caja de prueba' }] })
    const problema: Articulo = {
      ...procedimiento,
      id: 'problema-pc',
      titulo: 'La caja de prueba no enciende',
      tipo: 'problema_frecuente',
      sintomas: ['Pantalla negra de prueba'],
      dispositivosAfectados: [{ id: 'pc', nombre: 'PC Caja de prueba' }],
    }
    await db.articulos.put(problema)
  }

  it('dice arriba tipo, IP, ubicación, responsable y a qué está conectado', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => control(/^Conectado a /), 'la línea de conexión')
    // La categoría llega en su propia lectura, después del equipo.
    await esperar(() => textoPantalla().includes('Computadores · Marca de prueba Modelo X'), 'el tipo')

    // La persona llega en su propia lectura, después del equipo.
    await esperar(() => textoPantalla().includes('Responsable: Persona de prueba'), 'el responsable')

    const texto = textoPantalla()
    expect(texto).toContain('10.9.9.21')
    expect(texto).toContain('Taquilla de prueba')
    expect(texto).toContain('Responsable: Persona de prueba')
    expect(texto).toContain('SW-CENTRAL-PRUEBA · Puerto 18')
    expect(control('Conectado a SW-CENTRAL-PRUEBA · Puerto 18. Ver conexión')?.getAttribute('href')).toBe('/red/topologia/pc')
  })

  // Tarea 266, sección 8 del encargo: un responsable escrito que no es
  // una ficha de persona ("Archivo", dos nombres) no se presenta como
  // persona ni se resuelve solo.
  it('un responsable escrito sin ficha se ve "Sin responsable" y queda por validar', async () => {
    await sembrarCategorias()
    await sembrarEquipo({ id: 'pc-archivo', nombre: 'PC Archivo de prueba', responsable: 'Archivo' })
    await montar(RUTAS, '/dispositivos/pc-archivo')
    await esperar(() => textoPantalla().includes('Sin responsable'), 'el responsable')

    expect(textoPantalla()).toContain('Anotado: «Archivo» · por validar')
    expect(textoPantalla()).not.toContain('Responsable: Archivo')
    expect(control('Asignar')).not.toBeNull()
  })

  it('los datos técnicos van plegados en "Más datos del equipo"', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/dispositivos/pc')
    const plegado = await esperar(() => control(/^Más datos del equipo/), 'la sección plegada')

    expect(textoPantalla()).not.toContain('SERIE-PRUEBA-1')
    await tocar(plegado)
    await esperar(() => textoPantalla().includes('SERIE-PRUEBA-1'), 'el serial')
    expect(textoPantalla()).toContain('INV-PRUEBA-1')
  })

  it('después de lo de arriba, problemas frecuentes y procedimientos, y al final la profundidad', async () => {
    await sembrarInventario()
    await sembrarGuiasDelEquipo()
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => textoPantalla().includes('La caja de prueba no enciende'), 'el problema')
    await esperar(() => textoPantalla().includes('Configurar la caja de prueba'), 'el procedimiento')

    const texto = textoPantalla().toLowerCase()
    const conectado = texto.indexOf('conectado a')
    const problemas = texto.indexOf('problemas frecuentes')
    const procedimientos = texto.indexOf('procedimientos')
    const profundidad = texto.indexOf('profundidad')
    expect(conectado).toBeGreaterThan(-1)
    expect(conectado).toBeLessThan(problemas)
    expect(problemas).toBeLessThan(procedimientos)
    expect(procedimientos).toBeLessThan(profundidad)
  })

  it('sin problemas ni procedimientos no quedan títulos vacíos', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => control(/^Conectado a /), 'la ficha')
    expect(textoPantalla().toLowerCase()).not.toContain('problemas frecuentes')
    expect(textoPantalla().toLowerCase()).not.toContain('procedimientos')
  })
})

describe('el escáner', () => {
  const RUTAS = [
    { ruta: '/escaner', elemento: <EscanerPage /> },
    { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
  ]

  function campoManual(): HTMLInputElement | null {
    return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar por placa o serial"]')
  }

  it('con un solo equipo abre la ficha directamente, y su regreso vuelve al escáner', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/escaner')
    const campo = await esperar(() => campoManual(), 'la búsqueda manual')

    await escribir(campo, 'INV-PRUEBA-1')
    await enviarFormulario(campo)
    await esperar(() => textoPantalla().includes('FICHA DEL EQUIPO'), 'la ficha')

    expect(ubicacionActual().pathname).toBe('/dispositivos/pc')
    const estado = ubicacionActual().state as { origen?: { to: string; etiqueta: string } }
    expect(estado.origen).toEqual({ to: '/escaner', etiqueta: 'Escáner' })
    // Queda anotado para no reabrirla al volver con la cámara sobre ella.
    expect(sessionStorage.getItem('escaner:ultimo-abierto')).toBe('INV-PRUEBA-1')
  })

  it('reconoce el QR del portal de asistencia y lo dice, sin tratarlo como un equipo', async () => {
    await sembrarInventario()
    await montar(RUTAS, '/escaner')
    const campo = await esperar(() => campoManual(), 'la búsqueda manual')

    await escribir(campo, 'https://soluciones-it-psi.vercel.app/conectar?codigo=482731')
    await enviarFormulario(campo)
    await esperar(() => textoPantalla().includes('Código para conectar un computador'), 'la tarjeta')

    expect(textoPantalla()).toContain('482 731')
    expect(textoPantalla()).not.toContain('Ningún equipo coincide')
    expect(ubicacionActual().pathname).toBe('/escaner')
  })
})
