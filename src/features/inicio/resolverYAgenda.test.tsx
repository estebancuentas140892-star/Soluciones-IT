// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { alternarFavorito } from '../../lib/favoritos'
import { registrarVisita } from '../../lib/recientes'
import {
  campoBuscador,
  control,
  desmontarTodo,
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

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
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
    const orden = ['Vencidos', 'Para hoy', 'Próximos', 'En curso', 'Por revisar del equipo'].map((rotulo) =>
      texto.indexOf(rotulo),
    )
    expect(orden.every((posicion) => posicion >= 0)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)

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

  it('no lo dice si queda algo vencido o para hoy, y el resumen concuerda en singular', async () => {
    await sembrarAcceso('c1', 'Portal de nómina', 0)
    await montar(RUTAS, '/agenda')

    const texto = await esperarTexto('Para hoy')
    expect(texto).not.toContain('Todo al día por hoy')
    expect(texto).toContain('1 para hoy')
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

describe('Resolver: la pregunta, el buscador y solo lo que ayuda', () => {
  it('pregunta qué hay que resolver y el buscador es lo primero', async () => {
    await montar(RUTAS, '/')
    const texto = await esperarTexto('¿Qué necesitas resolver?')
    expect(campoBuscador()).not.toBeNull()
    expect(campoBuscador()?.placeholder).toBe('Buscar problema, equipo, comando…')
    // Sin nada que atender no hay bloque "Atención" (ni un "todo al día"
    // de adorno), pero el catálogo sigue a un toque.
    expect(texto).not.toContain('Atención')
    expect(control('Todas las guías')).not.toBeNull()
  })

  it('"Atención" enseña hasta tres asuntos con fecha y lleva a la agenda completa', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Correo de soporte', -4)
    await sembrarAcceso('c3', 'Portal de nómina', 0)
    await sembrarAcceso('c4', 'Hosting', 3)
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Atención')
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
    expect(await esperarTexto('Atención')).toContain('Resolución POS de prueba')
  })

  it('los borradores propios y las sugerencias del equipo no salen en Resolver', async () => {
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')
    const texto = await esperarTexto('Todas las guías')
    expect(texto).not.toContain('Cambiar el tóner')
    expect(texto).not.toContain('La impresora no imprime')
    expect(texto).not.toContain('Atención')
  })

  it('"Recientes" lista la guía usada y la que está a medias se continúa en su paso', async () => {
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

    const texto = await esperarTexto('Recientes')
    expect(texto).toContain('Instalar la impresora de prueba')
    expect(texto).toContain('Vas en el paso 2 de 2')
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

    const texto = await esperarTexto('Todas las guías')
    expect(texto).not.toContain('Favoritas')
    expect(texto).not.toContain('Guía marcada con estrella')
    expect(await db.favoritos.count()).toBe(1)
  })

  it('"Accesos rápidos" aparece con dos o más categorías con guías y filtra la lista', async () => {
    await sembrarGuia({ id: 'g1', titulo: 'Guía de impresoras', categoriaId: 'cat-imp', pasos: [pasoPrueba('a1', 'Paso', ['Hacer'])] })
    await db.categorias.update('cat-imp', { nombre: 'Impresoras' })
    await sembrarGuia({ id: 'g2', titulo: 'Guía de POS', categoriaId: 'cat-pos', pasos: [pasoPrueba('b1', 'Paso', ['Hacer'])] })
    await db.categorias.update('cat-pos', { nombre: 'POS', orden: 0 })
    await montar(RUTAS, '/')

    await esperarTexto('Accesos rápidos')
    await tocar(await esperar(() => control(/^Impresoras: 1 guía/), 'el acceso rápido de Impresoras'))
    expect(ubicacionActual().pathname).toBe('/soluciones')
    expect(ubicacionActual().search).toBe('?categoria=cat-imp')
  })

  it('con una sola categoría con guías no hay accesos rápidos, pero sí "Todas las guías"', async () => {
    await sembrarGuia({ id: 'g1', titulo: 'Guía única', pasos: [pasoPrueba('a1', 'Paso', ['Hacer'])] })
    await montar(RUTAS, '/')
    expect(await esperarTexto('Todas las guías')).not.toContain('Accesos rápidos')
  })
})

describe('Resolver: el número de la pestaña', () => {
  it('cuenta los vencidos y los de hoy', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Portal de nómina', 0)
    await montar(RUTAS, '/')

    await esperarTexto('Atención')
    expect(textoPantalla()).toContain('(2 asuntos urgentes)')
  })

  it('no cuenta próximos, borradores ni guías en curso', async () => {
    await sembrarAcceso('c1', 'Hosting', 10)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner', true)
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Atención')
    expect(texto).not.toContain('asuntos urgentes')
    expect(texto).not.toContain('asunto urgente')
  })

  it('con un solo asunto urgente lo dice en singular', async () => {
    await sembrarAcceso('c1', 'Panel del router', -3)
    await montar(RUTAS, '/')

    await esperarTexto('Atención')
    expect(textoPantalla()).toContain('(1 asunto urgente)')
  })
})

describe('Resolver: permisos', () => {
  it('sin permiso de bóveda no asoma ni el título de un acceso', async () => {
    await sembrarPerfil(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarDatoDeEquipo('cp1', 'PIN de la alarma', -2)
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Todas las guías')
    expect(texto).not.toContain('Panel del router')
    expect(texto).not.toContain('PIN de la alarma')
    expect(texto).not.toContain('Atención')
  })
})

describe('Resolver en móvil y en escritorio', () => {
  const matchMediaOriginal = window.matchMedia

  function fingirPuntero(fino: boolean): void {
    window.matchMedia = ((consulta: string) =>
      ({
        matches: fino && consulta.includes('pointer: fine'),
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

    await esperarTexto('Atención')
    expect(document.activeElement).toBe(campoBuscador())
  })

  it('en el teléfono el teclado no se abre solo y lo que atender queda a la vista', async () => {
    fingirPuntero(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')

    const texto = await esperarTexto('Atención')
    expect(document.activeElement).not.toBe(campoBuscador())
    expect(texto).toContain('Panel del router')
  })
})
