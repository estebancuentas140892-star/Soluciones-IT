// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo } from '../../lib/db'
import {
  anclarMaestra,
  control,
  desmontarTodo,
  esperar,
  esperarControl,
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
import { DispositivoPage } from './DispositivoPage'

// LA FICHA DE EQUIPO EN EL TELÉFONO (rediseño móvil "1b Pulgar", tarea 329,
// AD-079): avisos bajo el carnet, "Resolver con este equipo" con tres formas
// y "Ver N", el índice "Más del equipo" con sus hojas, el menú "···" con
// Favorito y Compartir y lo destructivo aparte, y la llave de las
// credenciales en la barra fija. Lo de antes (la identidad, los datos para
// trabajar, cada hoja por dentro) lo siguen vigilando equiposYQr,
// contextoEquipoPantallas, responsableDelEquipo, facturacionFlujo y
// mantenimientoFlujo.
//
// Todo es inventado.

const AHORA = '2026-10-13T12:00:00.000Z'
const RUTAS = [
  { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
  { ruta: '/dispositivos', elemento: <p>LISTA DE EQUIPOS</p> },
]

async function sembrarCategorias(): Promise<void> {
  await db.categorias.bulkPut([
    { id: 'cat-equipos', nombre: 'Computadores', icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
  ])
}

/** Un problema frecuente o un procedimiento de este equipo. */
async function sembrarArticulo(id: string, titulo: string, tipo: Articulo['tipo']): Promise<void> {
  const base = await sembrarGuia({ id, titulo, pasos: [pasoPrueba(`${id}-p1`, 'Paso de prueba', ['Haz algo de prueba'])] })
  await db.articulos.put({
    ...base,
    tipo,
    sintomas: tipo === 'problema_frecuente' ? [`Síntoma de ${titulo}`] : [],
    dispositivosAfectados: [{ id: 'pc', nombre: 'PC de prueba' }],
  })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrarCategorias()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('los avisos del equipo', () => {
  it('dicen bajo el carnet lo que sus datos piden, cada uno con su verbo y su hoja', async () => {
    await sembrarEquipo({
      id: 'pc',
      nombre: 'PC de prueba',
      ip: '10.9.9.30',
      responsable: 'Archivo de prueba',
      detalles: { 'Conflicto IP histórico': '10.9.9.30 o 10.9.9.31 según la fuente' },
    })
    await db.autorizaciones_facturacion.put({
      id: 'aut-conflicto',
      dispositivoIds: ['pc'],
      prefijo: 'PRB',
      formulario: '',
      rangoDesde: 1,
      rangoHasta: 100,
      fechaFormalizacion: null,
      vigenciaReportada: '',
      vencimientoDocumentado: null,
      vencimientoConfirmado: null,
      consecutivoActual: null,
      consecutivoLeidoEn: null,
      consecutivoFuente: '',
      estado: 'conflicto',
      fuente: 'Documento de prueba',
      verificadoEn: null,
      verificacionFuente: '',
      observaciones: 'Las fuentes de prueba no coinciden',
      evidenciaAdjuntoId: null,
      updatedAt: AHORA,
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, '/dispositivos/pc')

    const lista = await esperar(
      () => document.body.querySelector<HTMLElement>('ul[aria-label="Avisos del equipo"]'),
      'los avisos',
    )
    await esperar(() => (lista.textContent ?? '').includes('Autorización de facturación en conflicto'), 'el de facturación')
    const texto = lista.textContent ?? ''
    expect(texto).toContain('Responsable anotado, por validar')
    expect(texto).toContain('Conflicto IP histórico')
    // Van debajo del carnet y antes de los datos para trabajar.
    const pantalla = textoPantalla()
    expect(pantalla.indexOf('PC de prueba')).toBeLessThan(pantalla.indexOf('Autorización de facturación en conflicto'))
    expect(pantalla.indexOf('Conflicto IP histórico')).toBeLessThan(pantalla.indexOf('Dirección IP'))

    // El conflicto anotado abre los datos del equipo, donde está su valor.
    expect(textoPantalla()).not.toContain('10.9.9.30 o 10.9.9.31 según la fuente')
    await tocar(await esperarControl('Ver los datos del equipo: Conflicto IP histórico'))
    await esperar(() => textoPantalla().includes('10.9.9.30 o 10.9.9.31 según la fuente'), 'el valor del conflicto')
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Más datos del equipo')
  })

  it('sin nada que pida atención, no hay bloque de avisos', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba', ip: '10.9.9.30' })
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => textoPantalla().includes('10.9.9.30'), 'la ficha')
    expect(document.body.querySelector('ul[aria-label="Avisos del equipo"]')).toBeNull()
  })
})

describe('resolver con este equipo', () => {
  it('tres formas a la vista, los problemas primero, y "Ver N" abre todas con su equipo', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await sembrarArticulo('prob-1', 'Problema de prueba uno', 'problema_frecuente')
    await sembrarArticulo('prob-2', 'Problema de prueba dos', 'problema_frecuente')
    await sembrarArticulo('proc-1', 'Procedimiento de prueba uno', 'configuracion')
    await sembrarArticulo('proc-2', 'Procedimiento de prueba dos', 'configuracion')
    await montar(RUTAS, '/dispositivos/pc')

    const seccion = await esperar(
      () => document.body.querySelector<HTMLElement>('section[aria-labelledby="resolver-con-este-equipo"]'),
      'Resolver con este equipo',
    )
    await esperar(() => seccion.querySelectorAll('a').length === 3, 'tres formas')
    const enlaces = Array.from(seccion.querySelectorAll('a'))
    expect(enlaces.slice(0, 2).every((a) => (a.textContent ?? '').includes('Problema frecuente'))).toBe(true)
    // Cada una abre la guía con este equipo (tarea 290).
    expect(enlaces.every((a) => a.getAttribute('href')?.endsWith('?equipo=pc'))).toBe(true)

    await tocar(await esperarControl('Ver las 4 formas de resolver con este equipo'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    await esperar(() => (hoja.textContent ?? '').includes('Procedimiento de prueba dos'), 'todas')
    for (const titulo of ['Problema de prueba uno', 'Problema de prueba dos', 'Procedimiento de prueba uno']) {
      expect(hoja.textContent).toContain(titulo)
    }
  })

  it('con tres o menos no hay "Ver N"', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await sembrarArticulo('prob-1', 'Problema de prueba uno', 'problema_frecuente')
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => textoPantalla().includes('Problema de prueba uno'), 'la forma')
    expect(control(/^Ver las \d+ formas/)).toBeNull()
  })
})

describe('la cabecera y el menú', () => {
  it('Favorito y Compartir viven en "···", y lo destructivo va aparte', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await montar(RUTAS, '/dispositivos/pc')
    const menu = await esperarControl(/^Acciones del equipo/)
    // El nombre sigue siendo el encabezado de la página, aunque la cabecera
    // enseñe "Equipos" mientras el carnet está a la vista.
    expect(document.body.querySelector('h1')?.textContent).toContain('PC de prueba')
    expect(control('Marcar como favorito')).toBeNull()
    expect(control('Compartir la ficha')).toBeNull()

    await tocar(menu)
    const favorito = await esperarControl('Marcar como favorito')
    expect(control('Compartir la ficha')).not.toBeNull()
    const editar = control('Editar') as HTMLElement
    const eliminar = control('Eliminar') as HTMLElement
    const darDeBaja = control('Dar de baja') as HTMLElement
    expect(editar.parentElement).toBe(favorito.parentElement)
    // Eliminar y Dar de baja, en su propio grupo, separado por una línea.
    expect(eliminar.parentElement).toBe(darDeBaja.parentElement)
    expect(eliminar.parentElement).not.toBe(editar.parentElement)
    expect(eliminar.parentElement?.className).toContain('border-t')
  })
})

describe('la barra fija', () => {
  it('"Resolver un problema" va relleno y la llave abre las credenciales del equipo en su hoja', async () => {
    await sembrarPerfil(true)
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await sembrarArticulo('prob-1', 'Problema de prueba uno', 'problema_frecuente')
    await anclarMaestra()
    await sembrarCredencial({
      id: 'cred-pc',
      titulo: 'Acceso de prueba al PC',
      tipo: 'cuenta',
      usuario: 'usuario.falso.pc',
      contrasena: 'Clave-Falsa-PC-1',
      dispositivos: [{ id: 'pc', nombre: 'PC de prueba' }],
    })
    bloquear()
    await montar(RUTAS, '/dispositivos/pc')

    const resolver = await esperarControl('Resolver un problema con este equipo')
    expect(resolver.className).toContain('bg-noct-accent')
    await tocar(await esperarControl('Credenciales del equipo'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    await esperar(() => (hoja.textContent ?? '').includes('Acceso de prueba al PC'), 'la credencial')
    // Solo su título: nada de la Bóveda se descifra aquí.
    expect(document.body.innerHTML).not.toContain('usuario.falso.pc')
  })

  it('sin permiso de Bóveda no hay llave ni fila de credenciales', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await sembrarArticulo('prob-1', 'Problema de prueba uno', 'problema_frecuente')
    await montar(RUTAS, '/dispositivos/pc')
    await esperarControl('Resolver un problema con este equipo')
    expect(control('Credenciales del equipo')).toBeNull()
    expect(control(/^Credenciales/)).toBeNull()
  })
})
