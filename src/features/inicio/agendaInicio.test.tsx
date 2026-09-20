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
import { InicioPage } from './InicioPage'

// INICIO ES LA AGENDA OPERATIVA (encargo del 2026-09-20).
//
// Las reglas puras (reparto por fecha, orden global, permisos) ya se
// prueban en `agenda.test.ts` y `pendientes.test.ts`. Aquí se prueba lo
// que solo se ve montando las pantallas de verdad: que Inicio pinta los
// grupos en su orden, que no repite la guía a medias, que "Favoritas" y
// "Recientes" ya no están, que el enlace abre `/agenda` y que el número
// de la pestaña cuenta solo lo urgente.
//
// Todo lo que se siembra es INVENTADO.

const RUTAS = [
  { ruta: '/', elemento: <InicioPage /> },
  { ruta: '/agenda', elemento: <AgendaPage /> },
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

/** Espera a que la agenda deje de estar cargando y devuelve el texto. */
async function esperarAgenda(que: string): Promise<string> {
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

describe('Inicio: buscador arriba y agenda debajo', () => {
  it('pinta los grupos en el orden del encargo, con todos los vencidos y los de hoy', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Correo de soporte', -4)
    await sembrarAcceso('c3', 'Portal de nómina', 0)
    await sembrarAcceso('c4', 'Hosting', 3)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Vencidos')
    // 1. el buscador sigue siendo lo primero.
    expect(texto).toContain('¿Qué necesitas solucionar?')
    expect(campoBuscador()).not.toBeNull()
    // 2 a 7: el orden de la pantalla.
    const orden = [
      '¿Qué necesitas solucionar?',
      'Vencidos',
      'Para hoy',
      'Próximos',
      'En curso',
      'Por revisar del equipo',
    ].map((rotulo) => texto.indexOf(rotulo))
    expect(orden.every((posicion) => posicion >= 0)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)

    // Vencidos: TODOS, y en orden global por fecha (lo más vencido primero).
    expect(texto.indexOf('Panel del router')).toBeLessThan(texto.indexOf('Correo de soporte'))
    // Para hoy: el del día. Próximos: el que aún no vence.
    expect(texto).toContain('Portal de nómina')
    expect(texto).toContain('Hosting')
    // Nada se repite entre grupos.
    expect(texto.split('Panel del router')).toHaveLength(2)
  })

  it('ordena juntos los accesos de Bóveda y los datos protegidos de un equipo', async () => {
    await sembrarAcceso('c1', 'Clave del correo', -1)
    await sembrarDatoDeEquipo('cp1', 'PIN de la alarma', -20)
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('PIN de la alarma')
    // El dato del equipo vencido hace 20 días va antes que la clave de
    // la Bóveda vencida ayer: manda la fecha, no la procedencia.
    expect(texto.indexOf('PIN de la alarma')).toBeLessThan(texto.indexOf('Clave del correo'))
    expect(texto).toContain('Switch de prueba')
  })

  it('muestra tres próximos y despliega el resto sin cambiar de pantalla', async () => {
    await sembrarAcceso('c1', 'Acceso uno', 2)
    await sembrarAcceso('c2', 'Acceso dos', 4)
    await sembrarAcceso('c3', 'Acceso tres', 6)
    await sembrarAcceso('c4', 'Acceso cuatro', 8)
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Próximos')
    expect(texto).toContain('Acceso tres')
    expect(texto).not.toContain('Acceso cuatro')
    // Cuatro próximos, tres a la vista: el desplegable concuerda en singular.
    const verMas = await esperar(() => control(/^Ver el otro/), 'el desplegable de próximos')
    await tocar(verMas)
    expect(textoPantalla()).toContain('Acceso cuatro')
  })

  it('no repite la guía a medias entre la tarjeta de reanudar y "En curso"', async () => {
    await sembrarBorradorPropio('b1', 'Configurar la impresora de prueba', true)
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('En curso')
    // Aparece una sola vez, y con su acción directa para continuarla.
    expect(texto.split('Configurar la impresora de prueba')).toHaveLength(2)
    expect(control(/^Continuar Configurar la impresora/)).not.toBeNull()
  })

  it('continúa la guía en el paso donde iba', async () => {
    await sembrarBorradorPropio('b1', 'Configurar la impresora de prueba', true)
    await montar(RUTAS, '/')
    await esperarAgenda('En curso')

    const seguir = await esperar(() => control(/^Continuar Configurar la impresora/), 'el control de continuar')
    await tocar(seguir)
    expect(ubicacionActual().pathname).toContain('b1')
  })

  it('"Ver agenda completa" abre /agenda con los mismos grupos', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')
    await esperarAgenda('Vencidos')

    await tocar(await esperar(() => control('Ver agenda completa'), 'el enlace a la agenda'))
    expect(ubicacionActual().pathname).toBe('/agenda')
    const texto = await esperarAgenda('Panel del router')
    expect(texto).toContain('Vencidos')
    // La pantalla completa no se enlaza a sí misma.
    expect(control('Ver agenda completa')).toBeNull()
  })
})

describe('Inicio: estados de la agenda', () => {
  it('dice "Todo al día por hoy" solo cuando no hay vencidos ni asuntos del día', async () => {
    await sembrarAcceso('c1', 'Hosting', 5)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner')
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Próximos')
    // Un próximo y un borrador no desmienten "Todo al día por hoy".
    expect(texto).toContain('Todo al día por hoy')
  })

  it('no lo dice si queda algo vencido o para hoy', async () => {
    await sembrarAcceso('c1', 'Portal de nómina', 0)
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Para hoy')
    expect(texto).not.toContain('Todo al día por hoy')
    // Y el resumen concuerda en singular.
    expect(texto).toContain('1 para hoy')
  })

  it('con la agenda vacía no inventa filas ni secciones', async () => {
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Todo al día por hoy')
    expect(texto).toContain('Nada con fecha')
    expect(texto).not.toContain('Vencidos')
    expect(texto).not.toContain('Por revisar del equipo')
    // El acceso a la agenda completa sigue estando.
    expect(control('Ver agenda completa')).not.toBeNull()
  })

  it('concuerda en plural el resumen de lo que hay con fecha', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Correo de soporte', -4)
    await sembrarAcceso('c3', 'Hosting', 3)
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Vencidos')
    expect(texto).toContain('2 vencidos · 1 próximo')
  })
})

describe('Inicio: el número de la pestaña', () => {
  it('cuenta los vencidos y los de hoy', async () => {
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarAcceso('c2', 'Portal de nómina', 0)
    await montar(RUTAS, '/')

    await esperarAgenda('Vencidos')
    expect(textoPantalla()).toContain('(2 asuntos urgentes)')
  })

  it('no cuenta próximos, borradores ni guías en curso', async () => {
    await sembrarAcceso('c1', 'Hosting', 10)
    await sembrarBorradorPropio('b1', 'Cambiar el tóner', true)
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Próximos')
    expect(texto).not.toContain('asuntos urgentes')
    expect(texto).not.toContain('asunto urgente')
  })

  it('con un solo asunto urgente lo dice en singular', async () => {
    await sembrarAcceso('c1', 'Panel del router', -3)
    await montar(RUTAS, '/')

    await esperarAgenda('Vencidos')
    expect(textoPantalla()).toContain('(1 asunto urgente)')
  })
})

describe('Inicio: permisos y contenido retirado', () => {
  it('sin permiso de bóveda no asoma ni el título de un acceso', async () => {
    await sembrarPerfil(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await sembrarDatoDeEquipo('cp1', 'PIN de la alarma', -2)
    await sembrarSugerenciaDelEquipo('e1', 'La impresora no imprime')
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Por revisar del equipo')
    expect(texto).not.toContain('Panel del router')
    expect(texto).not.toContain('PIN de la alarma')
    expect(texto).not.toContain('Vencidos')
    // Lo que no depende de la bóveda se sigue viendo.
    expect(texto).toContain('La impresora no imprime')
  })

  it('ya no muestra "Favoritas" ni "Recientes", aunque existan', async () => {
    await sembrarGuia({
      id: 'guia-1',
      titulo: 'Guía marcada con estrella',
      pasos: [pasoPrueba('g1-p1', 'Un paso', ['Hacer algo'])],
    })
    await alternarFavorito('articulo', 'guia-1')
    await registrarVisita('articulo', 'guia-1')
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Todo al día por hoy')
    expect(texto).not.toContain('Favoritas')
    expect(texto).not.toContain('Recientes')
    expect(texto).not.toContain('Guía marcada con estrella')
    // El dato no se pierde: sigue guardado para Más.
    expect(await db.favoritos.count()).toBe(1)
    expect(await db.recientes.count()).toBe(1)
  })
})

describe('Inicio en móvil y en escritorio', () => {
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

  it('en escritorio el campo recibe el foco y la agenda se ve igual', async () => {
    fingirPuntero(true)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')

    await esperarAgenda('Vencidos')
    expect(document.activeElement).toBe(campoBuscador())
  })

  it('en el teléfono el teclado no se abre solo y la agenda queda a la vista', async () => {
    fingirPuntero(false)
    await sembrarAcceso('c1', 'Panel del router', -30)
    await montar(RUTAS, '/')

    const texto = await esperarAgenda('Vencidos')
    expect(document.activeElement).not.toBe(campoBuscador())
    expect(texto).toContain('Panel del router')
  })
})
