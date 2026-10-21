// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { alternarFavorito } from '../../lib/favoritos'
import { registrarVisita } from '../../lib/recientes'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
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
import { AYUDA_BUSCADOR } from '../busqueda/resultados'
import { fechaDeHoy } from './agenda'
import { AgendaPage } from './AgendaPage'
import { ResolverPage } from './ResolverPage'

// RESOLVER Y LA AGENDA COMPLETA (encargos del 2026-09-20 y del 2026-09-22).
//
// Las reglas puras (reparto por fecha, orden global, permisos, qué asoma
// en Resolver) ya se prueban en `agenda.test.ts`, `pendientes.test.ts` y
// `resolver.test.ts`. Aquí se prueba lo que solo se ve montando las
// pantallas de verdad:
//
//   - la agenda completa (`/agenda`) pinta los grupos en su orden, no
//     repite la guía a medias y despliega los próximos;
//   - Resolver enseña solo lo que tiene fecha ("Atención"), las guías
//     recientes, los accesos rápidos y siempre "Todas las guías";
//   - el número de la pestaña Resolver cuenta solo lo urgente.
//
// Todo lo que se siembra es INVENTADO.

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/agenda', elemento: <AgendaPage /> },
  { ruta: '/personas/:personaId', elemento: <p>Ficha de la persona</p> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>Ficha del equipo</p> },
  { ruta: '/soluciones', elemento: <p>Catálogo de guías</p> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>Guía abierta</p> },
]

/** "YYYY-MM-DD" a N días de hoy (la agenda mira el día real del aparato). */
function fechaRelativa(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

async function sembrarAcceso(id: string, titulo: string, dias: number): Promise<void> {
  await db.credenciales.put({
    id,
    titulo,
    categoria: 'Pruebas',
    tipo: 'cuenta',
    datosCifrados: '',
    venceEn: fechaRelativa(dias),
    dispositivos: [],
    archivo: null,
    updatedAt: '2026-09-20T12:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
  })
}

async function sembrarDatoDeEquipo(id: string, nombre: string, dias: number): Promise<void> {
  await db.dispositivos.put({
    id: 'equipo-1',
    nombre: 'Switch de prueba',
    categoriaId: 'cat-equipos',
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ubicacionId: null,
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    ip: '',
    estado: '',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '2026-09-20T12:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
  })
  await db.campos_protegidos.put({
    id,
    dispositivoId: 'equipo-1',
    nombre,
    tipo: 'contrasena',
    valorCifrado: '',
    orden: 0,
    venceEn: fechaRelativa(dias),
    updatedAt: '2026-09-20T12:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
  })
}

async function sembrarSugerenciaDelEquipo(id: string, titulo: string): Promise<void> {
  await db.ejecuciones_diagnostico.put({
    id,
    diagnosticoId: 'diag-1',
    diagnosticoTitulo: titulo,
    usuario: null,
    usuarioNombre: '',
    camino: [],
    articulosEjecutados: [],
    resuelto: 'no',
    duracionSegundos: 0,
    fechaHora: '2026-09-19T12:00:00.000Z',
    motivo: 'encontro_otra_solucion',
    solucionPropuesta: 'Reinicié el spooler de prueba',
  })
}

/** Una guía propia en borrador, opcionalmente con avance a medias. */
async function sembrarBorradorPropio(id: string, titulo: string, conAvance = false): Promise<void> {
  await sembrarGuia({
    id,
    titulo,
    pasos: [pasoPrueba(`${id}-p1`, 'Primer paso', ['Hacer algo']), pasoPrueba(`${id}-p2`, 'Segundo paso', ['Hacer otra cosa'])],
  })
  await db.articulos.update(id, { estado: 'borrador', updatedBy: PERFIL_PRUEBA.id })
  if (conAvance) {
    await db.progresoPasos.put({
      articuloId: id,
      pasosHechos: [`${id}-p1`],
      instruccionesHechas: [`${id}-p1-t1`],
      verificacionHecha: [],
      actualizadoEn: '2026-09-20T12:00:00.000Z',
    })
  }
}

/** Espera a que aparezca un texto y devuelve el de toda la pantalla. */
async function esperarTexto(que: string): Promise<string> {
  await esperar(() => textoPantalla().includes(que), `aparece "${que}"`)
  return textoPantalla()
}

/**
 * Resolver pintado: su puerta al catálogo siempre está ("Todas", con nombre
 * "Todas las guías", desde 768; "Ver todas las guías (N)" en el teléfono).
 */
async function esperarResolver(): Promise<string> {
  await esperar(() => control(/^(Ver t|T)odas las guías/), 'aparece "Todas las guías"')
  return textoPantalla()
}

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventanaDePrueba = window as unknown as VentanaDePrueba

// DESDE 768 PX RESOLVER NO CAMBIA (rediseño móvil, fase 1, tarea 344): sus
// pruebas de siempre corren a 1024, donde siguen describiendo lo que hay. El
// teléfono tiene las suyas, más abajo.
function enTableta(): void {
  ventanaDePrueba.happyDOM.setViewport({ width: 1024, height: 768 })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
  ventanaDePrueba.happyDOM.setViewport({ width: 375, height: 812 })
})

describe('La agenda completa (/agenda)', () => {
  it('pinta los grupos en el orden del encargo, con todos los vencidos y los de hoy', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Correo de soporte', -4)
    await sembrarAcceso('c3', 'Portal de nómina', 0)
    await sembrarAcceso('c4', 'Hosting', 3)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Vencidos')
    const orden = ['Vencidos', 'Para hoy', 'Próximos', 'Sin fecha'].map((rotulo) => texto.indexOf(rotulo))
    expect(orden.every((posicion) => posicion >= 0)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)

    // Lo que no vence va al final y plegado (tarea 332): "Sin fecha" dice
    // cuántos guarda y, al abrirlo, En curso y Por revisar del equipo.
    expect(texto).not.toContain('En curso')
    expect(texto).not.toContain('Cambiar el tóner')
    const sinFecha = await esperar(() => control(/^Sin fecha/), 'la fila plegada')
    expect(sinFecha.getAttribute('aria-expanded')).toBe('false')
    expect(sinFecha.textContent).toContain('Por revisar y en curso. No vencen.')
    expect(sinFecha.textContent).toContain('2')
    await tocar(sinFecha)
    await esperar(() => textoPantalla().includes('Cambiar el tóner'), 'se despliega')
    expect(sinFecha.getAttribute('aria-expanded')).toBe('true')
    const desplegado = textoPantalla()
    const sinFechaOrden = ['Sin fecha', 'En curso', 'Cambiar el tóner', 'Por revisar del equipo', 'La impresora no imprime'].map(
      (rotulo) => desplegado.indexOf(rotulo),
    )
    expect(sinFechaOrden.every((posicion) => posicion >= 0)).toBe(true)
    expect([...sinFechaOrden].sort((a, b) => a - b)).toEqual(sinFechaOrden)

    // Vencidos: TODOS, y en orden global por fecha (lo más vencido primero).
    expect(texto.indexOf('Panel del router')).toBeLessThan(texto.indexOf('Correo de soporte'))
    expect(texto).toContain('Portal de nómina')
    expect(texto).toContain('Hosting')
    // Nada se repite entre grupos.
    expect(texto.split('Panel del router')).toHaveLength(2)
  })

  it('ordena juntos los accesos de Bóveda y los datos protegidos de un equipo', async () => {
    await sembrarAcceso('c1', 'Clave del correo', -1)
    await sembrarDatoDeEquipo('cp1', 'PIN de la alarma', -20)
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('PIN de la alarma')
    // Manda la fecha, no la procedencia.
    expect(texto.indexOf('PIN de la alarma')).toBeLessThan(texto.indexOf('Clave del correo'))
    expect(texto).toContain('Switch de prueba')
  })

  it('muestra tres próximos y despliega el resto sin cambiar de pantalla', async () => {
    await sembrarAcceso('c1', 'Acceso uno', 2)
    await sembrarAcceso('c2', 'Acceso dos', 4)
    await sembrarAcceso('c3', 'Acceso tres', 6)
    await sembrarAcceso('c4', 'Acceso cuatro', 8)
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Próximos')
    expect(texto).toContain('Acceso tres')
    expect(texto).not.toContain('Acceso cuatro')
    const verMas = await esperar(() => control(/^Ver el otro/), 'el desplegable de próximos')
    await tocar(verMas)
    expect(textoPantalla()).toContain('Acceso cuatro')
  })

  it('no repite la guía a medias entre la tarjeta de reanudar y "En curso"', async () => {
    await sembrarBorradorPropio('b1', 'Configurar la impresora de prueba', true)
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('En curso')
    expect(texto.split('Configurar la impresora de prueba')).toHaveLength(2)
    expect(control(/^Continuar Configurar la impresora/)).not.toBeNull()
  })

  it('dice "Todo al día por hoy" solo cuando no hay vencidos ni asuntos del día', async () => {
    await sembrarAcceso('c1', 'Hosting', 5)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Próximos')
    expect(texto).toContain('Todo al día por hoy')
  })

  it('no lo dice si queda algo vencido o para hoy, y los contadores concuerdan en singular', async () => {
    await sembrarAcceso('c1', 'Portal de nómina', 0)
    await sembrarAcceso('c2', 'Hosting', 4)
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Para hoy')
    expect(texto).not.toContain('Todo al día por hoy')
    // Los tres contadores arriba (tarea 332), sin enlace: ya se está en la Agenda.
    expect(texto).toContain('0 vencidos')
    expect(texto).toContain('1 para hoy')
    expect(texto).toContain('1 próximo')
    expect(texto.indexOf('1 para hoy')).toBeLessThan(texto.indexOf('Portal de nómina'))
    expect(control(/abrir la Agenda/)).toBeNull()
  })

  it('sin nada con fecha, "Sin fecha" ya viene abierto: es lo único que hay', async () => {
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await montar(RUTAS, '/agenda')

    await esperarTexto('Cambiar el tóner')
    expect(control(/^Sin fecha/)?.getAttribute('aria-expanded')).toBe('true')
    expect(textoPantalla()).toContain('Todo al día por hoy')
  })

  it('con la agenda vacía no inventa filas ni secciones', async () => {
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Todo al día por hoy')
    expect(texto).not.toContain('Vencidos')
    expect(texto).not.toContain('Por revisar del equipo')
  })

  it('la pantalla completa no se enlaza a sí misma', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/agenda')
    await esperarTexto('Vencidos')
    expect(control(/agenda completa/)).toBeNull()
  })

  // Tarea 270: lo que piden los ingresos, los retiros y los equipos que
  // se sueltan, derivado de personas, equipos e historial.
  it('la persona que llega mañana sin equipo es un próximo, y su fila abre su ficha', async () => {
    await db.personas.put({
      id: 'per-nora',
      nombre: 'Nora de Prueba',
      area: '',
      notas: '',
      estado: 'activa',
      fechaIngreso: fechaRelativa(1),
      fechaRetiro: null,
      motivoRetiro: '',
      updatedAt: '2026-09-01T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Nora de Prueba')
    expect(texto).toContain('Ingresa mañana · sin equipo')
    expect(texto.indexOf('Próximos')).toBeLessThan(texto.indexOf('Nora de Prueba'))
    const fila = await esperar(() => control(/^Abrir Nora de Prueba/), 'la fila de la persona')
    await tocar(fila)
    expect(ubicacionActual().pathname).toBe('/personas/per-nora')
  })

  it('un equipo liberado hace poco y Disponible espera dueño en "Por revisar del equipo"', async () => {
    await db.dispositivos.put({
      id: 'pc-44',
      categoriaId: 'cat-equipos',
      nombre: 'PC-PRUEBA-44',
      marca: '',
      modelo: '',
      serial: '',
      placaInventario: '',
      ubicacion: '',
      ubicacionId: null,
      responsable: '',
      responsableId: null,
      reemplazaA: null,
      ip: '',
      estado: 'Disponible',
      observaciones: '',
      detalles: {},
      foto: null,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      eliminadoEn: null,
    })
    await db.historial.put({
      id: 'h-liberado',
      entidadTipo: 'dispositivo',
      entidadId: 'pc-44',
      usuario: null,
      usuarioNombre: 'Técnico de prueba',
      fechaHora: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      campo: 'responsableId',
      valorAnterior: 'per-luis',
      valorNuevo: '',
      motivo: '',
    })
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('PC-PRUEBA-44')
    expect(texto).toContain('Liberado hace 2 d · Disponible')
    expect(texto.indexOf('Por revisar del equipo')).toBeLessThan(texto.indexOf('PC-PRUEBA-44'))
    // No es urgente: la agenda sigue "al día".
    expect(texto).toContain('Todo al día por hoy')
    await tocar(await esperar(() => control(/^Revisar PC-PRUEBA-44/), 'la fila del equipo'))
    expect(ubicacionActual().pathname).toBe('/dispositivos/pc-44')
  })
})

describe('Resolver desde 768 px: la pregunta, el buscador y solo lo que ayuda (sin cambios)', () => {
  beforeEach(enTableta)

  it('el buscador va en la barra, sin dock y sin la pregunta (tareas 330 y 339)', async () => {
    await montar(RUTAS, '/')
    await esperarResolver()
    const texto = textoPantalla()
    expect(campoBuscador()).not.toBeNull()
    expect(campoBuscador()?.closest('[data-dock-busqueda]')).toBeNull()
    expect(campoBuscador()?.closest('[data-buscador-resolver]')).toBeNull()
    // La cabecera es de una fila: sin "¿Qué necesitas resolver?".
    expect(texto).not.toContain('¿Qué necesitas resolver?')
    // El marcador invita a contar lo que pasa (tarea 288; antes "Problema,
    // equipo o comando") y el nombre accesible sigue diciendo el alcance.
    expect(campoBuscador()?.placeholder).toBe('Describe qué necesitas resolver…')
    expect(campoBuscador()?.getAttribute('aria-label')).toBe('Buscar en Soluciones IT')
    // Sin nada que atender no hay bloque "Atención" (ni un "todo al día"
    // de adorno), pero el catálogo sigue a un toque.
    expect(texto).not.toContain('Necesita atención')
    expect(control('Todas las guías')).not.toBeNull()
  })

  it('la línea de ayuda ya no va en Resolver (tarea 330): la dice la búsqueda vacía', async () => {
    await montar(RUTAS, '/')
    await esperarResolver()
    expect(AYUDA_BUSCADOR).toBe('Ej.: no imprime, usuario bloqueado, impresora mercadeo')
    expect(textoPantalla()).not.toContain(AYUDA_BUSCADOR)
  })


  it('"Atención" enseña hasta tres asuntos con fecha y lleva a la agenda completa', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Correo de soporte', -4)
    await sembrarAcceso('c3', 'Portal de nómina', 0)
    await sembrarAcceso('c4', 'Hosting', 3)
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Necesita atención')
    expect(texto).toContain('Panel del router')
    expect(texto).toContain('Portal de nómina')
    // El cuarto (un próximo) queda en la agenda completa, y el enlace lo dice.
    expect(texto).not.toContain('Hosting')
    await tocar(await esperar(() => control('Ver la agenda completa (4)'), 'el enlace a la agenda'))
    expect(ubicacionActual().pathname).toBe('/agenda')
    expect(await esperarTexto('Hosting')).toContain('Vencidos')
  })

  it('una clave próxima a vencer también es atención', async () => {
    await sembrarAcceso('c1', 'Resolución POS de prueba', 12)
    await montar(RUTAS, '/')
    expect(await esperarTexto('Necesita atención')).toContain('Resolución POS de prueba')
  })

  it('los borradores propios y las sugerencias del equipo no salen en Resolver', async () => {
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')
    const texto = await esperarResolver()
    expect(texto).not.toContain('Cambiar el tóner')
    expect(texto).not.toContain('La impresora no imprime')
    expect(texto).not.toContain('Necesita atención')
  })

  // La Agenda tiene una sola puerta, Resolver (tarea 265): Más ya no tiene
  // fila propia. Sin nada con fecha no hay "Atención", pero la agenda
  // guarda también lo que no tiene fecha, y no puede quedarse sin puerta.
  it('sin nada con fecha, una sola línea abre la agenda si guarda algo más', async () => {
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')
    await esperarTexto('1 en curso · 1 por revisar')
    const enlace = await esperar(() => control(/^Agenda · 1 en curso · 1 por revisar/), 'la línea de la agenda')
    expect(enlace.getAttribute('href')).toBe('/agenda')
    await tocar(enlace)
    expect(ubicacionActual().pathname).toBe('/agenda')
    // La cabecera dice el día, no "Resolver": el regreso ya lo nombra.
    expect(await esperarTexto('Por revisar del equipo')).toContain(fechaDeHoy())
  })

  it('con solo actividad del equipo, la línea lo dice', async () => {
    const guia = await sembrarGuia({ id: 'g-editada', titulo: 'Reiniciar el switch de prueba', pasos: [pasoPrueba('p1', 'Apagar', ['Desconectar'])] })
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
    await montar(RUTAS, '/')
    await esperarTexto('actividad del equipo')
    expect(control(/^Agenda · actividad del equipo/)?.getAttribute('href')).toBe('/agenda')
  })

  it('con la agenda vacía no hay puerta: nada que abrir', async () => {
    await montar(RUTAS, '/')
    const texto = await esperarResolver()
    expect(texto).not.toContain('Agenda')
    expect(texto).not.toContain('Necesita atención')
  })

  it('"Seguir donde ibas" lleva a la guía a medias y la continúa en su paso (tarea 330)', async () => {
    await sembrarGuia({
      id: 'guia-1',
      titulo: 'Instalar la impresora de prueba',
      pasos: [pasoPrueba('g1-p1', 'Primer paso', ['Hacer algo']), pasoPrueba('g1-p2', 'Segundo paso', ['Otra cosa'])],
    })
    await db.progresoPasos.put({
      articuloId: 'guia-1',
      pasosHechos: ['g1-p1'],
      instruccionesHechas: ['g1-p1-t1'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await registrarVisita('articulo', 'guia-1')
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Seguir donde ibas')
    expect(texto).toContain('Instalar la impresora de prueba')
    // El avance, sin rodeos, junto a "Continuar"; en su tarjeta, no en la
    // lista de recientes (tarea 330).
    expect(texto).toContain('paso 2 de 2')
    expect(texto).toContain('Continuar')
    await tocar(await esperar(() => control(/^Continuar Instalar la impresora/), 'la fila de la guía a medias'))
    expect(ubicacionActual().pathname).toBe('/soluciones/cat-pruebas/guia-1')
  })

  it('no muestra "Favoritas" aunque existan: siguen guardadas para Más', async () => {
    await sembrarGuia({
      id: 'guia-1',
      titulo: 'Guía marcada con estrella',
      pasos: [pasoPrueba('g1-p1', 'Un paso', ['Hacer algo'])],
    })
    await alternarFavorito('articulo', 'guia-1')
    await montar(RUTAS, '/')

    const texto = await esperarResolver()
    expect(texto).not.toContain('Favoritas')
    expect(texto).not.toContain('Guía marcada con estrella')
    expect(await db.favoritos.count()).toBe(1)
  })

  it('"Guías" lista las categorías con guías, con cuántas tiene cada una, y filtra la lista (tarea 330)', async () => {
    await sembrarGuia({ id: 'g1', titulo: 'Guía de impresoras', categoriaId: 'cat-imp', pasos: [pasoPrueba('a1', 'Paso', ['Hacer'])] })
    await db.categorias.update('cat-imp', { nombre: 'Impresoras' })
    await sembrarGuia({ id: 'g2', titulo: 'Guía de POS', categoriaId: 'cat-pos', pasos: [pasoPrueba('b1', 'Paso', ['Hacer'])] })
    await db.categorias.update('cat-pos', { nombre: 'POS', orden: 0 })
    await montar(RUTAS, '/')

    await tocar(await esperar(() => control(/^Impresoras: 1 guía/), 'el acceso rápido de Impresoras'))
    expect(ubicacionActual().pathname).toBe('/soluciones')
    expect(ubicacionActual().search).toBe('?categoria=cat-imp')
  })

  it('con una sola categoría con guías no hay chips de categoría, pero sí "Todas las guías"', async () => {
    await sembrarGuia({ id: 'g1', titulo: 'Guía única', pasos: [pasoPrueba('a1', 'Paso', ['Hacer'])] })
    await montar(RUTAS, '/')
    await esperarResolver()
    expect(control(/: \d+ guías?$/)).toBeNull()
  })
})

describe('Resolver desde 768 px: el número de la pestaña', () => {
  beforeEach(enTableta)

  it('cuenta los vencidos y los de hoy', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Portal de nómina', 0)
    await montar(RUTAS, '/')

    await esperarTexto('Necesita atención')
    expect(textoPantalla()).toContain('(2 asuntos urgentes)')
  })

  it('no cuenta próximos, borradores ni guías en curso', async () => {
    await sembrarAcceso('c1', 'Hosting', 10)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner', true)
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Necesita atención')
    expect(texto).not.toContain('asuntos urgentes')
    expect(texto).not.toContain('asunto urgente')
  })

  it('con un solo asunto urgente lo dice en singular', async () => {
    await sembrarAcceso('c1', 'Panel del router', -3)
    await montar(RUTAS, '/')

    await esperarTexto('Necesita atención')
    expect(textoPantalla()).toContain('(1 asunto urgente)')
  })
})

describe('Resolver desde 768 px: permisos', () => {
  beforeEach(enTableta)

  it('sin permiso de bóveda no asoma ni el título de un acceso', async () => {
    await sembrarPerfil(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarDatoDeEquipo('cp1', 'PIN de la alarma', -2)
    await montar(RUTAS, '/')

    const texto = await esperarResolver()
    expect(texto).not.toContain('Panel del router')
    expect(texto).not.toContain('PIN de la alarma')
    expect(texto).not.toContain('Necesita atención')
  })
})

describe('Resolver en móvil y en escritorio', () => {
  const matchMediaOriginal = window.matchMedia

  // Con ratón, también el ancho del escritorio: el campo solo recibe el foco
  // desde 768 (en el teléfono enfocarlo abre la búsqueda, tarea 344).
  function fingirPuntero(fino: boolean): void {
    window.matchMedia = ((consulta: string) =>
      ({
        matches: fino && (consulta.includes('pointer: fine') || consulta.includes('min-width')),
        media: consulta,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia
  }

  afterEach(() => {
    window.matchMedia = matchMediaOriginal
  })

  it('en escritorio el campo recibe el foco', async () => {
    fingirPuntero(true)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')

    await esperarTexto('Necesita atención')
    expect(document.activeElement).toBe(campoBuscador())
  })

  it('en el teléfono el teclado no se abre solo y lo que atender queda a la vista', async () => {
    fingirPuntero(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Tu trabajo de hoy')
    expect(document.activeElement).not.toBe(campoBuscador())
    expect(texto).toContain('Panel del router')
    expect(texto).not.toContain('Puedes escribir')
  })
})

// RESOLVER EN EL TELÉFONO (rediseño móvil, fase 1, tarea 344; DESPUÉS de
// Claude Design). El buscador arriba y de verdad (tocarlo abre el teclado),
// "¿Qué está fallando?" con las categorías reales, la guía a medias con un
// botón que dice a dónde lleva y el trabajo de hoy dicho en palabras. Buscar
// es su propia pantalla: el regreso, el campo y lo encontrado.
describe('Resolver en el teléfono (tarea 344)', () => {
  const buscadorArriba = () => document.body.querySelector<HTMLElement>('[data-buscador-resolver]')
  async function enfocar(campo: HTMLInputElement): Promise<void> {
    await act(async () => {
      campo.focus()
    })
  }

  it('la pregunta primero y el campo debajo, arriba y no en el dock (tareas 344 y 346)', async () => {
    await montar(RUTAS, '/')
    await esperarResolver()
    const campo = campoBuscador() as HTMLInputElement
    expect(campo.closest('[data-buscador-resolver]')).not.toBeNull()
    expect(campo.closest('[data-dock-busqueda]')).toBeNull()
    expect(document.body.querySelectorAll('input[aria-label="Buscar en Soluciones IT"]')).toHaveLength(1)
    // El marcador dice que también se busca un equipo; el nombre accesible, el alcance.
    expect(campo.placeholder).toBe('Describe el problema o un equipo')
    expect(campo.getAttribute('aria-label')).toBe('Buscar en Soluciones IT')
    const texto = textoPantalla()
    // Lo primero que se lee es la pregunta (tarea 346), y la frase que
    // explicaba la sección ya no está: la pregunta ya lo dice.
    expect(document.body.querySelector('#resolver-pregunta')?.textContent).toBe('¿Qué necesitas resolver?')
    expect(texto).not.toContain('Encuentra qué hacer ante un problema técnico.')
    expect(texto).toContain('Prueba con:')
    expect(texto).toContain('Guías por categoría')
    // Ni los contadores ni "Necesita atención" del diseño anterior.
    expect(texto).not.toContain('Necesita atención')
  })

  it('tocar el campo abre la búsqueda con el teclado: qué escribir, ejemplos y el regreso', async () => {
    await montar(RUTAS, '/')
    await esperarResolver()
    const campo = campoBuscador() as HTMLInputElement
    await enfocar(campo)
    await esperarTexto('Puedes escribir')
    // Es el MISMO campo, con el foco: cambiar de forma no lo desmonta.
    expect(campoBuscador()).toBe(campo)
    expect(document.activeElement).toBe(campo)
    // La pantalla de búsqueda: sin la pregunta ni lo de Resolver.
    expect(textoPantalla()).not.toContain('Guías por categoría')
    expect(textoPantalla()).not.toContain('¿Qué necesitas resolver?')
    expect(buscadorArriba()?.className).toContain('sticky')
    // Un ejemplo escribe la consulta.
    await tocar(await esperar(() => control('no imprime'), 'el ejemplo "no imprime"'))
    expect(campo.value).toBe('no imprime')
    // El regreso borra lo escrito y vuelve a Resolver.
    await tocar(await esperar(() => control('Volver a Resolver'), 'el regreso'))
    expect(campoBuscador()?.value).toBe('')
    expect(await esperarTexto('Guías por categoría')).not.toContain('Puedes escribir')
  })

  it('escribir abre lo encontrado y nada que coincida lo dice con sus salidas', async () => {
    await montar(RUTAS, '/')
    await esperarResolver()
    await escribir(campoBuscador() as HTMLInputElement, 'zzqxw')
    await esperarTexto('Nada coincide con «zzqxw»')
    expect(control('Volver a Resolver')).not.toBeNull()
    expect(control('Crear equipo')?.getAttribute('href')).toBe('/dispositivos/nuevo?nombre=zzqxw')
    expect(control('Buscar solo en Guías')).not.toBeNull()
    await tocar(control('Limpiar búsqueda') as HTMLElement)
    expect(campoBuscador()?.value).toBe('')
  })

  it('"Tu trabajo de hoy" enseña lo urgente con su fila y "Agenda (N)" abre la agenda entera', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Portal de nómina', 0)
    await sembrarAcceso('c3', 'Hosting', 3)
    await montar(RUTAS, '/')
    const texto = await esperarTexto('Tu trabajo de hoy')
    expect(texto).toContain('Panel del router')
    expect(texto).toContain('Portal de nómina')
    // Lo próximo no es de hoy: queda en la Agenda.
    expect(texto).not.toContain('Hosting')
    const agenda = await esperar(() => control('Abrir la Agenda: 3 asuntos'), 'el enlace a la agenda')
    expect(agenda.textContent).toContain('Agenda (3)')
    await tocar(agenda)
    expect(ubicacionActual().pathname).toBe('/agenda')
  })

  it('sin nada urgente lo dice en palabras y nombra lo que guarda la Agenda', async () => {
    await sembrarAcceso('c1', 'Hosting', 10)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')
    const texto = await esperarTexto('Nada atrasado ni para hoy.')
    expect(texto).toContain('En la Agenda: 1 próximo, 1 en curso y 1 por revisar.')
    expect(texto).not.toContain('Cambiar el tóner')
  })

  it('"Sigue donde ibas" es una fila que dice el paso y la retoma (tareas 344 y 346)', async () => {
    await sembrarGuia({
      id: 'guia-1',
      titulo: 'Instalar la impresora de prueba',
      pasos: [pasoPrueba('g1-p1', 'Primer paso', ['Hacer algo']), pasoPrueba('g1-p2', 'Segundo paso', ['Otra cosa'])],
    })
    await db.progresoPasos.put({
      articuloId: 'guia-1',
      pasosHechos: ['g1-p1'],
      instruccionesHechas: ['g1-p1-t1'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await registrarVisita('articulo', 'guia-1')
    await montar(RUTAS, '/')
    const texto = await esperarTexto('Sigue donde ibas')
    expect(texto).toContain('Sigue donde ibas · paso 2 de 2')
    // La fila entera se toca y su nombre dice a dónde lleva.
    const continuar = await esperar(() => control(/^Continuar en el paso 2: Instalar la impresora/), 'la fila')
    expect(continuar.hasAttribute('data-seguir-donde-ibas')).toBe(true)
    expect(continuar.textContent).toContain('Instalar la impresora de prueba')
    expect(continuar.textContent).toContain('Continuar')
    // El avance a la vista (tarea 349): un segmento por paso, el hecho en
    // acento y el actual en claro.
    const segmentos = continuar.querySelectorAll('[data-avance-seguir] span > span')
    expect(segmentos).toHaveLength(2)
    expect(segmentos[0].className).toContain('bg-noct-accent')
    expect(segmentos[1].className).toContain('bg-noct-text')
    await tocar(continuar)
    expect(ubicacionActual().pathname).toBe('/soluciones/cat-pruebas/guia-1')
  })

  it('"Guías por categoría" lleva a cada categoría real y "Todas las guías" al catálogo', async () => {
    await sembrarGuia({ id: 'g1', titulo: 'Guía de impresoras', categoriaId: 'cat-imp', pasos: [pasoPrueba('a1', 'Paso', ['Hacer'])] })
    await db.categorias.update('cat-imp', { nombre: 'Impresoras' })
    await sembrarGuia({ id: 'g2', titulo: 'Guía de POS', categoriaId: 'cat-pos', pasos: [pasoPrueba('b1', 'Paso', ['Hacer'])] })
    await db.categorias.update('cat-pos', { nombre: 'POS', orden: 0 })
    await montar(RUTAS, '/')
    // El número llega cuando se terminan de contar las guías: se espera a él.
    const todas = await esperar(() => {
      const enlace = control(/^Todas las guías/)
      return enlace?.textContent?.includes('(2)') ? enlace : null
    }, 'el catálogo con su número')
    expect(todas.textContent).toContain('Todas las guías (2)')
    expect(todas.getAttribute('href')).toBe('/soluciones')
    // Cada acceso lleva el icono en el color de identidad de su categoría
    // (tarea 349), el mismo que su chip: dos categorías, dos colores.
    const impresoras = await esperar(() => control(/^Impresoras: 1 guía/), 'la categoría Impresoras')
    const pos = await esperar(() => control(/^POS: 1 guía/), 'la categoría POS')
    const colorDe = (enlace: HTMLElement) => enlace.querySelector('[data-color-categoria]')?.className.match(/text-noct-cat-\d+/)?.[0]
    expect(colorDe(impresoras)).toBeTruthy()
    expect(colorDe(pos)).toBeTruthy()
    expect(colorDe(impresoras)).not.toBe(colorDe(pos))
    await tocar(impresoras)
    expect(ubicacionActual().pathname).toBe('/soluciones')
    expect(ubicacionActual().search).toBe('?categoria=cat-imp')
  })

  it('sin permiso de bóveda tampoco asoma el título de un acceso', async () => {
    await sembrarPerfil(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')
    const texto = await esperarTexto('Tu trabajo de hoy')
    expect(texto).not.toContain('Panel del router')
  })
})

// LA AGENDA POR ANCHO (tarea 339, T7): desde 1024, lo que tiene fecha a la
// izquierda y "Sin fecha" abierto en su columna, sin botón, con la actividad
// del equipo al final. Los grupos y lo que cae en cada uno no cambian.
describe('La agenda completa por ancho', () => {
  type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
  const ventana = window as unknown as VentanaDePrueba

  afterEach(() => {
    ventana.happyDOM.setViewport({ width: 375, height: 812 })
  })

  it('a 1280 px "Sin fecha" va abierto en su columna, sin botón', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 832 })
    await sembrarAcceso('c1', 'Panel del router', -3)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Cambiar el tóner')
    expect(texto).toContain('La impresora no imprime')
    expect(control(/^Sin fecha/)).toBeNull()
    // La barra lateral del chasis también es un aside: la columna es la que
    // lleva la cabecera "Sin fecha".
    const columna = Array.from(document.body.querySelectorAll<HTMLElement>('main aside')).find(
      (a) => a.querySelector('h2')?.textContent === 'Sin fecha',
    )
    expect(columna).toBeDefined()
    expect(columna?.textContent).toContain('Por revisar del equipo')
    // Lo que tiene fecha sigue a la izquierda, fuera de esa columna.
    expect(columna?.textContent).not.toContain('Panel del router')
    expect(texto).toContain('Panel del router')
  })

  it('a 768 px sigue en una columna, con "Sin fecha" plegado', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await sembrarAcceso('c1', 'Panel del router', -3)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await montar(RUTAS, '/agenda')

    await esperarTexto('Panel del router')
    const sinFecha = await esperar(() => control(/^Sin fecha/), 'la fila plegada')
    expect(sinFecha.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain('Cambiar el tóner')
  })
})
