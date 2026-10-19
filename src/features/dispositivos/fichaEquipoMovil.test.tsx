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
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Wrench, type IconoProps } from '../../components/iconos'
import { bloquear } from '../boveda/sesionBoveda'
import { DispositivoPage } from './DispositivoPage'

/** El primer trazo de un icono, para saber cuál se dibujó. */
function trazoDe(Icono: (props: IconoProps) => React.JSX.Element): string | undefined {
  return /\sd="([^"]+)"/.exec(renderToStaticMarkup(createElement(Icono)))?.[1]
}

// LA FICHA DE EQUIPO EN EL TELÉFONO (rediseño móvil "1b Pulgar", tarea 329,
// AD-079; jerarquía del DESPUÉS de Claude Design desde la tarea 344): avisos
// bajo el carnet, los datos para trabajar en su tarjeta con "Copiar", el
// mantenimiento a la vista, "Guías para este equipo" en filas cortas con
// "Ver N", "Información del equipo" con sus hojas, el menú "···" con
// Favorito y Compartir y lo destructivo aparte, y "Clave" con su palabra en
// la barra fija. Lo de antes (la identidad, los datos para
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

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
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
  // En el teléfono (tarea 344): filas cortas, solo las tres que se ven, con
  // qué es y cuántos pasos tiene, sin icono ni síntoma.
  it('en el teléfono, tres guías en filas cortas, los problemas primero, y "Ver N" abre todas', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await sembrarArticulo('prob-1', 'Problema de prueba uno', 'problema_frecuente')
    await sembrarArticulo('prob-2', 'Problema de prueba dos', 'problema_frecuente')
    await sembrarArticulo('proc-1', 'Procedimiento de prueba uno', 'configuracion')
    await sembrarArticulo('proc-2', 'Procedimiento de prueba dos', 'configuracion')
    await montar(RUTAS, '/dispositivos/pc')

    const seccion = await esperar(
      () => document.body.querySelector<HTMLElement>('section[aria-labelledby="resolver-con-este-equipo"]'),
      'Guías para este equipo',
    )
    expect(seccion.querySelector('h2')?.textContent).toBe('Guías para este equipo')
    await esperar(() => seccion.querySelectorAll('a').length === 3, 'tres guías')
    const enlaces = Array.from(seccion.querySelectorAll('a'))
    expect(seccion.querySelector('li.hidden')).toBeNull()
    expect(enlaces.slice(0, 2).every((a) => (a.textContent ?? '').includes('Problema frecuente · 1 paso'))).toBe(true)
    // Sin el síntoma ni el icono: el título y una línea.
    expect(seccion.textContent).not.toContain('Síntoma de')
    expect(enlaces.every((a) => a.getAttribute('href')?.endsWith('?equipo=pc'))).toBe(true)

    await tocar(await esperarControl('Ver las 4 formas de resolver con este equipo'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    await esperar(() => (hoja.textContent ?? '').includes('Procedimiento de prueba dos'), 'todas')
  })

  it('desde 768, tres formas a la vista, los problemas primero, y "Ver N" abre todas con su equipo', async () => {
    ventana.happyDOM.setViewport({ width: 1024, height: 768 })
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
    // A la vista en el teléfono: desde la tarea 339 (T4) la ficha pasa hasta
    // cinco y las que sobran de tres se esconden con CSS por debajo de 1280.
    const aLaVista = () => Array.from(seccion.querySelectorAll('a')).filter((a) => !a.closest('li.hidden'))
    await esperar(() => aLaVista().length === 3, 'tres formas')
    expect(seccion.querySelectorAll('a').length).toBe(4)
    expect(seccion.querySelector('li.hidden')?.className).toContain('xl:block')
    const enlaces = aLaVista()
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

  // Tarea 342: en el teléfono el "···" abre una hoja, no una banda en la
  // cabecera; las seis acciones en filas de 54 y lo destructivo en rojo.
  it('en el teléfono el menú es una hoja con lo destructivo aparte y en rojo', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await montar(RUTAS, '/dispositivos/pc')
    const menu = await esperarControl(/^Acciones del equipo/)
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog')
    await tocar(menu)
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja del menú')
    expect(hoja.textContent).toContain('Acciones del equipo')
    const nombres = ['Marcar como favorito', 'Compartir la ficha', 'Duplicar', 'Editar', 'Etiqueta QR', 'Reemplazar', 'Dar de baja', 'Eliminar']
    for (const nombre of nombres) {
      const accion = control(nombre) as HTMLElement
      expect(hoja.contains(accion)).toBe(true)
      expect(accion.className).toContain('min-h-[54px]')
    }
    // Nada de la banda de antes dentro de la cabecera.
    expect(document.body.querySelector('.sticky')?.contains(control('Editar'))).toBe(false)
    for (const nombre of ['Dar de baja', 'Eliminar']) expect((control(nombre) as HTMLElement).className).toContain('text-noct-error')
    expect((control('Editar') as HTMLElement).className).not.toContain('text-noct-error')

    // Eliminar cierra la hoja y pide confirmación.
    await tocar(control('Eliminar') as HTMLElement)
    await esperar(() => textoPantalla().includes('¿Eliminar el equipo "PC de prueba"?'), 'la confirmación')
  })
})

describe('el carnet y los datos para trabajar en el teléfono (tareas 342 y 344)', () => {
  it('la pastilla lleva su punto, la IP se copia con "Copiar" y el índice no necesita leyenda', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba', ip: '10.9.9.30', estado: 'Operativo' })
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => textoPantalla().includes('10.9.9.30'), 'la ficha')
    const punto = document.body.querySelector('[data-punto-estado]')
    expect(punto).not.toBeNull()
    expect(punto?.parentElement?.textContent).toContain('Operativo')
    // "Copiar" con su palabra (tarea 344), dentro de la tarjeta de los datos.
    const copiar = control('Copiar dirección ip') as HTMLElement
    expect(copiar.textContent).toBe('Copiar')
    expect(copiar.closest('section[aria-label="Datos para trabajar"]')?.className).toContain('max-md:rounded-2xl')
    // "Información del equipo", sin la leyenda de los galones.
    expect(textoPantalla()).toContain('Información del equipo')
    expect(document.body.querySelector('[data-leyenda-galones]')).toBeNull()
    expect(textoPantalla()).not.toContain('se consulta aquí')
  })

  it('el mantenimiento va a la vista, con lo que dice y "Ver", y no se repite en el índice', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba', ip: '10.9.9.30' })
    await montar(RUTAS, '/dispositivos/pc')
    const fila = await esperarControl(/^Mantenimiento\s*Nada programado/)
    expect(fila.textContent).toContain('Mantenimiento')
    expect(fila.textContent).toContain('Ver')
    const indice = document.body.querySelector<HTMLElement>('section[aria-labelledby="mas-del-equipo"]')
    expect(indice?.textContent).not.toContain('Mantenimiento')
  })

  it('mientras se lee la copia local, la forma de la ficha y no "Cargando..."', async () => {
    await montar(RUTAS, '/dispositivos/pc-que-aun-no-llega')
    // El equipo no existe: Dexie devuelve `undefined` y la ficha espera.
    const esqueleto = await esperar(() => document.body.querySelector('[data-esqueleto]'), 'el esqueleto')
    expect(esqueleto.getAttribute('role')).toBe('status')
    expect(textoPantalla()).toContain('Leyendo la copia local…')
    expect(textoPantalla()).not.toContain('Cargando...')
  })
})

describe('la barra fija', () => {
  it('"Resolver un problema" va relleno y "Clave", con su palabra, abre la clave del equipo en su hoja', async () => {
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
    // La llave inglesa de "resolver" (tarea 342): el árbol queda para las
    // guías con preguntas.
    expect(resolver.querySelector('svg path')?.getAttribute('d')).toBe(trazoDe(Wrench))
    // Con la Bóveda bloqueada, la fila dice que las hay pero cerradas.
    await esperar(() => (control(/^Credenciales/)?.textContent ?? '').includes('Bloqueadas'), 'credenciales bloqueadas')
    // "Clave" con su palabra, delante de "Resolver un problema" (tarea 344).
    const clave = await esperarControl('Clave del equipo')
    expect(clave.textContent).toBe('Clave')
    expect(clave.compareDocumentPosition(resolver) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await tocar(clave)
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    await esperar(() => (hoja.textContent ?? '').includes('Acceso de prueba al PC'), 'la credencial')
    expect(hoja.textContent).toContain('Clave del equipo')
    // Solo su título: nada de la Bóveda se descifra aquí.
    expect(document.body.innerHTML).not.toContain('usuario.falso.pc')
  })

  it('sin permiso de Bóveda no hay llave ni fila de credenciales', async () => {
    await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba' })
    await sembrarArticulo('prob-1', 'Problema de prueba uno', 'problema_frecuente')
    await montar(RUTAS, '/dispositivos/pc')
    await esperarControl('Resolver un problema con este equipo')
    expect(control('Clave del equipo')).toBeNull()
    expect(control('Credenciales del equipo')).toBeNull()
    expect(control(/^Credenciales/)).toBeNull()
  })
})
