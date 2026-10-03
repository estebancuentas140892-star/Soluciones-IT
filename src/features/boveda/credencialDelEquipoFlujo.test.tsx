// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type PasoProcedimiento, type VinculoProtegido } from '../../lib/db'
import {
  anclarMaestra,
  campoBuscador,
  control,
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  MAESTRA_PRUEBA,
  montar,
  pasoPrueba,
  sembrarCredencial,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { ProcedimientosDelEquipo } from '../dispositivos/ProcedimientosDelEquipo'
import { ResolverPage } from '../inicio/ResolverPage'
import { GuiaPage } from '../soluciones/GuiaPage'
import { bloquear } from './sesionBoveda'

// LA CREDENCIAL DEL EQUIPO EN UNA GUÍA, CON LA PANTALLA DE VERDAD (tarea
// 290, fase 3).
//
// Una guía de impresoras que sirve para varias impresoras pide "la
// credencial del equipo actual". El equipo llega de la ficha del equipo,
// de Resolver o lo elige el técnico en la propia acción, y la consulta de
// la Bóveda de siempre muestra la credencial que corresponde: una,
// ninguna o "no se puede saber cuál", sin inventar ni elegir al azar.
//
// Todo es inventado: equipos, credenciales, usuarios y contraseñas.

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/boveda/:credencialId', elemento: <p>FICHA DE LA CREDENCIAL</p> },
  {
    ruta: '/dispositivos/:dispositivoId',
    elemento: <ProcedimientosDelEquipo dispositivoId="imp-a" categoriaId="cat-pruebas" marca="" modelo="" />,
  },
]

const SECRETOS = [
  'usuario.prueba.a',
  'Clave-Falsa-A-111',
  'usuario.prueba.b',
  'Clave-Falsa-B-222',
  'usuario.prueba.d1',
  'Clave-Falsa-D1-333',
  'usuario.prueba.d2',
  'Clave-Falsa-D2-444',
  'usuario.prueba.e.remoto',
  'Clave-Falsa-E-555',
  'usuario.prueba.e.programa',
  'Clave-Falsa-E-666',
]

const DEL_EQUIPO: VinculoProtegido = { tipo: 'equipo', finalidad: '', titulo: 'Credencial del equipo' }
const DEL_EQUIPO_REMOTO: VinculoProtegido = {
  tipo: 'equipo',
  finalidad: 'Escritorio remoto',
  titulo: 'Credencial del equipo · Escritorio remoto',
}

/** Un paso cuya primera tarea pide el vínculo dado. */
function pasoConVinculo(id: string, titulo: string, tareas: string[], vinculo: VinculoProtegido): PasoProcedimiento {
  const paso = pasoPrueba(id, titulo, tareas)
  paso.bloques[0] = { ...paso.bloques[0], vinculoProtegido: vinculo }
  return paso
}

async function sembrarInventario(): Promise<void> {
  await sembrarEquipo({ id: 'imp-a', nombre: 'Impresora de prueba A', ubicacion: 'Oficina A', categoriaId: 'cat-pruebas' })
  await sembrarEquipo({ id: 'imp-b', nombre: 'Impresora de prueba B', ubicacion: 'Oficina B', categoriaId: 'cat-pruebas' })
  await sembrarEquipo({ id: 'imp-c', nombre: 'Impresora de prueba C', ubicacion: 'Oficina C', categoriaId: 'cat-pruebas' })
  await sembrarEquipo({ id: 'imp-d', nombre: 'Impresora de prueba D', ubicacion: 'Oficina D', categoriaId: 'cat-pruebas' })
  await sembrarEquipo({ id: 'srv-e', nombre: 'Servidor de prueba E', ubicacion: 'Cuarto de prueba' })
}

/** La Bóveda de prueba: muchos equipos con una credencial, como la de verdad. */
async function sembrarBoveda(): Promise<void> {
  await sembrarCredencial({
    id: 'cred-a',
    titulo: 'Acceso de prueba A',
    tipo: 'cuenta',
    usuario: 'usuario.prueba.a',
    contrasena: 'Clave-Falsa-A-111',
    categoria: 'Impresoras',
    dispositivos: [{ id: 'imp-a', nombre: 'Impresora de prueba A' }],
  })
  await sembrarCredencial({
    id: 'cred-b',
    titulo: 'Acceso de prueba B',
    tipo: 'cuenta',
    usuario: 'usuario.prueba.b',
    contrasena: 'Clave-Falsa-B-222',
    categoria: 'Impresoras',
    dispositivos: [{ id: 'imp-b', nombre: 'Impresora de prueba B' }],
  })
  await sembrarCredencial({
    id: 'cred-d1',
    titulo: 'Acceso de prueba D uno',
    tipo: 'cuenta',
    usuario: 'usuario.prueba.d1',
    contrasena: 'Clave-Falsa-D1-333',
    categoria: 'Impresoras',
    dispositivos: [{ id: 'imp-d', nombre: 'Impresora de prueba D' }],
  })
  await sembrarCredencial({
    id: 'cred-d2',
    titulo: 'Acceso de prueba D dos',
    tipo: 'cuenta',
    usuario: 'usuario.prueba.d2',
    contrasena: 'Clave-Falsa-D2-444',
    categoria: 'Impresoras',
    dispositivos: [{ id: 'imp-d', nombre: 'Impresora de prueba D' }],
  })
  await sembrarCredencial({
    id: 'cred-e-remoto',
    titulo: 'Acceso de prueba E remoto',
    tipo: 'cuenta',
    usuario: 'usuario.prueba.e.remoto',
    contrasena: 'Clave-Falsa-E-555',
    categoria: 'Escritorio remoto',
    dispositivos: [{ id: 'srv-e', nombre: 'Servidor de prueba E' }],
  })
  await sembrarCredencial({
    id: 'cred-e-programa',
    titulo: 'Acceso de prueba E programa',
    tipo: 'cuenta',
    usuario: 'usuario.prueba.e.programa',
    contrasena: 'Clave-Falsa-E-666',
    categoria: 'Programa de prueba',
    dispositivos: [{ id: 'srv-e', nombre: 'Servidor de prueba E' }],
  })
}

/** La guía representativa: una sola guía para varias impresoras. */
async function sembrarGuiaDeImpresoras(): Promise<void> {
  await sembrarGuia({
    id: 'guia-imp',
    titulo: 'Diagnosticar una impresora de prueba que no imprime',
    pasos: [
      pasoConVinculo(
        'imp-p1',
        'Entrar al panel de la impresora',
        ['Entra al panel web de la impresora con el usuario administrador', 'Revisa la lista de usuarios de impresión'],
        DEL_EQUIPO,
      ),
    ],
  })
}

const accesos = () => db.accesos_boveda.toArray()
const RUTA_GUIA = '/soluciones/cat-pruebas/guia-imp'

let consola: ReturnType<typeof vi.spyOn>[] = []

beforeEach(async () => {
  await limpiarBase()
  await db.accesos_boveda.clear()
  await sembrarPerfil(true)
  await sembrarInventario()
  await anclarMaestra()
  await sembrarBoveda()
  await sembrarGuiaDeImpresoras()
  consola = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) =>
    vi.spyOn(console, metodo).mockImplementation(() => {}),
  )
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
  // NINGÚN VALOR PROTEGIDO EN LA CONSOLA: ni en un aviso, ni en un error.
  const escrito = consola.flatMap((espia) => (espia.mock.calls.flat() as unknown[]).map((parte) => String(parte)))
  for (const secreto of SECRETOS) {
    expect(escrito.some((linea) => linea.includes(secreto))).toBe(false)
  }
  vi.restoreAllMocks()
})

/** Nada de la Bóveda en pantalla, salvo lo permitido. */
function sinSecretosSalvo(...permitidos: string[]): void {
  const texto = textoPantalla()
  for (const secreto of SECRETOS) {
    if (!permitidos.includes(secreto)) expect(texto).not.toContain(secreto)
  }
}

async function desbloquearEnLinea(): Promise<void> {
  const campo = await esperar(
    () => document.body.querySelector<HTMLInputElement>('input[placeholder="Contraseña maestra"]'),
    'el campo de la contraseña maestra',
  )
  await escribir(campo, MAESTRA_PRUEBA)
  await enviarFormulario(campo)
}

describe('el caso representativo: la misma guía para varias impresoras', () => {
  it('impresora A: la credencial A, con los controles de siempre y la consulta registrada', async () => {
    bloquear()
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-a`)

    await esperar(() => textoPantalla().includes('Credencial necesaria'), 'la credencial de la acción')
    const fila = await esperarControl('Dato protegido: Acceso de prueba A')
    expect(fila.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).toContain('Equipo: Impresora de prueba A')
    sinSecretosSalvo()

    await tocar(fila)
    await esperar(() => textoPantalla().includes('La bóveda está bloqueada'), 'el desbloqueo en línea')
    await esperarQue(async () => (await accesos()).length === 1, 'la consulta registrada')
    expect((await accesos()).map((a) => [a.accion, a.credencialId])).toEqual([['consulto', 'cred-a']])
    sinSecretosSalvo()

    await desbloquearEnLinea()
    await esperar(() => textoPantalla().includes('usuario.prueba.a'), 'el usuario de A')
    // La contraseña sigue tras el ojo, y nada de B.
    sinSecretosSalvo('usuario.prueba.a')
    expect(control(/^Ver ficha completa en Bóveda/)?.getAttribute('href')).toBe('/boveda/cred-a')
  })

  it('impresora B: la misma guía resuelve la credencial B', async () => {
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-b`)
    const fila = await esperarControl('Dato protegido: Acceso de prueba B')
    await tocar(fila)
    await esperar(() => textoPantalla().includes('usuario.prueba.b'), 'el usuario de B')
    sinSecretosSalvo('usuario.prueba.b')
    expect((await accesos()).map((a) => a.credencialId)).toEqual(['cred-b'])
  })

  it('impresora C, sin credencial: un estado neutro, sin inventar ni sugerir otra', async () => {
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-c`)
    const fila = await esperarControl('Dato protegido: Credencial del equipo')
    await tocar(fila)
    await esperar(
      () => textoPantalla().includes('No hay una credencial configurada para este equipo.'),
      'el estado sin credencial',
    )
    expect(textoPantalla()).not.toContain('Acceso de prueba')
    expect(document.body.querySelector('input[placeholder="Contraseña maestra"]')).toBeNull()
    expect(await accesos()).toEqual([])
    sinSecretosSalvo()
  })

  it('impresora D, con dos credenciales de la misma finalidad: no se elige ninguna', async () => {
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-d`)
    await tocar(await esperarControl('Dato protegido: Credencial del equipo'))
    await esperar(
      () => textoPantalla().includes('Este equipo tiene varias credenciales y no se puede saber cuál corresponde a esta acción.'),
      'el estado ambiguo',
    )
    // Ni sus títulos: el técnico no elige ni prueba.
    expect(textoPantalla()).not.toContain('Acceso de prueba D')
    expect(await accesos()).toEqual([])
    sinSecretosSalvo()
  })

  it('equipo E, con dos finalidades: la acción que pide una resuelve solo esa', async () => {
    await sembrarGuia({
      id: 'guia-srv',
      titulo: 'Entrar al servidor de prueba',
      pasos: [pasoConVinculo('srv-p1', 'Conectarse', ['Conéctate por escritorio remoto'], DEL_EQUIPO_REMOTO)],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-srv?equipo=srv-e')
    await tocar(await esperarControl('Dato protegido: Acceso de prueba E remoto'))
    await esperar(() => textoPantalla().includes('usuario.prueba.e.remoto'), 'el acceso de escritorio remoto')
    sinSecretosSalvo('usuario.prueba.e.remoto')
  })
})

describe('el equipo con el que se trabaja', () => {
  it('sin equipo, se elige en la propia acción; cambiarlo recoge lo abierto y resuelve el nuevo', async () => {
    await montar(RUTAS, RUTA_GUIA)
    await esperarControl('Dato protegido: Credencial del equipo')
    expect(textoPantalla()).toContain('Sin equipo elegido.')

    await tocar(await esperarControl('Elegir el equipo'))
    await esperar(() => textoPantalla().includes('¿Con qué equipo trabajas?'), 'la hoja de equipos')
    await tocar(await esperarControl('Impresora de prueba A · Oficina A'))
    const filaA = await esperarControl('Dato protegido: Acceso de prueba A')
    // Queda en la dirección: recargar no lo pierde. Y elegir no es avanzar.
    expect(ubicacionActual().search).toBe('?equipo=imp-a')
    expect(await db.progresoPasos.get('guia-imp')).toBeUndefined()

    await tocar(filaA)
    await esperar(() => textoPantalla().includes('usuario.prueba.a'), 'el usuario de A')

    await tocar(await esperarControl('Cambiar el equipo (ahora Impresora de prueba A)'))
    await tocar(await esperarControl('Impresora de prueba B · Oficina B'))
    const filaB = await esperarControl('Dato protegido: Acceso de prueba B')
    // Lo de A ya no está, y ver B es otro gesto (y otro registro).
    expect(filaB.getAttribute('aria-expanded')).toBe('false')
    sinSecretosSalvo()
    expect((await accesos()).map((a) => a.credencialId)).toEqual(['cred-a'])
    expect(ubicacionActual().search).toBe('?equipo=imp-b')
  })

  it('retomar sigue con el equipo guardado, y marcar avance lo guarda en la ejecución', async () => {
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-b`)
    await esperarControl('Dato protegido: Acceso de prueba B')
    await tocar(await esperarControl('Completar y seguir'))
    await esperarQue(async () => (await db.progresoPasos.get('guia-imp'))?.equipoId === 'imp-b', 'el equipo en la fila')
    await desmontarTodo()

    // Volver a la guía sin el equipo en la dirección: lo trae la fila.
    await montar(RUTAS, RUTA_GUIA)
    await esperar(() => textoPantalla().includes('Revisa la lista de usuarios de impresión'), 'la acción donde iba')
    expect(textoPantalla()).toContain('Retomando')
    await tocar(await esperarControl(/^Anterior/))
    await esperarControl('Dato protegido: Acceso de prueba B')
    expect(textoPantalla()).toContain('Equipo: Impresora de prueba B')
    expect(ubicacionActual().search).toBe('')
  })

  it('lo que una guía reutiliza usa el equipo de la guía que se abrió', async () => {
    await sembrarGuia({
      id: 'guia-padre',
      titulo: 'Atender una impresora de prueba',
      pasos: [
        { ...pasoPrueba('pad-p1', 'Revisar el panel', []), subArticuloId: 'guia-imp', subArticuloTitulo: 'Diagnosticar una impresora de prueba que no imprime' },
        pasoPrueba('pad-p2', 'Imprimir una prueba', ['Imprime una página de prueba']),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-padre?equipo=imp-a')
    await esperar(() => textoPantalla().includes('Entra al panel web de la impresora'), 'la acción reutilizada')
    await esperarControl('Dato protegido: Acceso de prueba A')
    expect(textoPantalla()).toContain('Equipo: Impresora de prueba A')
  })

  it('consultar un paso de más adelante muestra la credencial de ese equipo, sin marcar nada', async () => {
    await sembrarGuia({
      id: 'guia-dos',
      titulo: 'Revisar la impresora de prueba en dos pasos',
      pasos: [
        pasoPrueba('dos-p1', 'Encender', ['Comprueba que la impresora enciende']),
        pasoConVinculo('dos-p2', 'Entrar al panel', ['Entra al panel web de la impresora'], DEL_EQUIPO),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-dos?equipo=imp-a')
    await esperar(() => textoPantalla().includes('Comprueba que la impresora enciende'), 'el paso 1')
    await tocar(await esperarControl(/^Paso 2 de 2: Entrar al panel/))
    await esperar(() => textoPantalla().includes('Solo consulta'), 'la consulta del paso 2')
    await esperarControl('Dato protegido: Acceso de prueba A')
    expect(await db.progresoPasos.get('guia-dos')).toBeUndefined()
  })

  it('un equipo que ya no existe no se usa: se dice y se elige otro', async () => {
    await montar(RUTAS, `${RUTA_GUIA}?equipo=equipo-inexistente`)
    await tocar(await esperarControl('Dato protegido: Credencial del equipo'))
    await esperar(() => textoPantalla().includes('El equipo elegido ya no está disponible.'), 'el aviso')
    expect(control('Elegir el equipo')).not.toBeNull()
    expect(await accesos()).toEqual([])
  })
})

describe('los controles de la Bóveda no cambian', () => {
  it('sin permiso de Bóveda: el título del vínculo y el aviso de siempre, sin equipo ni registro', async () => {
    await sembrarPerfil(false)
    // Sin permiso, RLS no le baja ninguna credencial.
    await db.credenciales.clear()
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-a`)
    const fila = await esperarControl('Dato protegido: Credencial del equipo')
    // Nada le insinúa de qué equipo ni si tiene credencial.
    expect(textoPantalla()).not.toContain('Equipo: Impresora de prueba A')
    expect(control('Elegir el equipo')).toBeNull()
    await tocar(fila)
    await esperar(
      () => textoPantalla().includes('Solo los usuarios autorizados pueden consultar los datos de este paso.'),
      'el aviso de permiso',
    )
    expect(await accesos()).toEqual([])
  })

  it('una credencial eliminada no se usa: el equipo queda sin credencial', async () => {
    await db.credenciales.update('cred-a', { eliminadoEn: '2026-10-01T00:00:00.000Z' })
    await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-a`)
    await tocar(await esperarControl('Dato protegido: Credencial del equipo'))
    await esperar(() => textoPantalla().includes('No hay una credencial configurada para este equipo.'), 'sin credencial')
    expect(textoPantalla()).not.toContain('Acceso de prueba A')
  })

  it('un vínculo fijo sigue siendo fijo, aunque la guía tenga un equipo', async () => {
    await sembrarGuia({
      id: 'guia-fija',
      titulo: 'Revisar con la credencial fija',
      pasos: [
        pasoConVinculo('fij-p1', 'Entrar', ['Entra con la credencial de B'], {
          tipo: 'credencial',
          id: 'cred-b',
          titulo: 'Copia de referencia de B',
        }),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-fija?equipo=imp-a')
    await esperarControl('Dato protegido: Acceso de prueba B')
    // El vínculo fijo no dice de qué equipo es ni ofrece cambiarlo.
    expect(textoPantalla()).not.toContain('Equipo: Impresora de prueba A')
    expect(control('Elegir el equipo')).toBeNull()
  })

  it('sin conexión: se resuelve y se descifra con lo del teléfono, sin pedir nada a la red', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', red)
    try {
      await montar(RUTAS, `${RUTA_GUIA}?equipo=imp-a`)
      await tocar(await esperarControl('Dato protegido: Acceso de prueba A'))
      await esperar(() => textoPantalla().includes('usuario.prueba.a'), 'el usuario de A, sin red')
      expect(red).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('el equipo llega a la guía desde donde se identificó', () => {
  it('la ficha del equipo abre sus guías con ese equipo', async () => {
    await montar(RUTAS, '/dispositivos/imp-a')
    const enlace = await esperar(
      () => document.body.querySelector<HTMLAnchorElement>('a[href^="/soluciones/cat-pruebas/guia-imp"]'),
      'la guía en la ficha del equipo',
    )
    expect(enlace.getAttribute('href')).toBe('/soluciones/cat-pruebas/guia-imp?equipo=imp-a')
    await tocar(enlace)
    await esperarControl('Dato protegido: Acceso de prueba A')
  })

  it('Resolver lleva el equipo que la consulta identifica, y solo si es uno', async () => {
    await sembrarEquipo({ id: 'imp-mercadeo', nombre: 'Impresora Mercadeo', ubicacion: 'Mercadeo', categoriaId: 'cat-pruebas' })
    await sembrarEquipo({ id: 'sw-mercadeo', nombre: 'Switch Mercadeo', ubicacion: 'Mercadeo' })
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador'), 'la impresora de mercadeo no imprime')
    const enlace = await esperar(
      () => document.body.querySelector<HTMLAnchorElement>('a[href^="/soluciones/cat-pruebas/guia-imp"]'),
      'la guía en los resultados',
    )
    expect(enlace.getAttribute('href')).toBe('/soluciones/cat-pruebas/guia-imp?equipo=imp-mercadeo')

    // "impresora" a secas no identifica ninguna: la guía va sin equipo.
    await escribir(await esperar(campoBuscador, 'el buscador'), 'impresora no imprime')
    await esperar(
      () =>
        document.body
          .querySelector<HTMLAnchorElement>('a[href^="/soluciones/cat-pruebas/guia-imp"]')
          ?.getAttribute('href') === '/soluciones/cat-pruebas/guia-imp',
      'la guía sin equipo',
    )

    // Y el equipo que llega sin credencial lo dice, sin asignarle otra.
    await escribir(await esperar(campoBuscador, 'el buscador'), 'la impresora de mercadeo no imprime')
    await tocar(
      await esperar(
        () =>
          document.body.querySelector<HTMLAnchorElement>(
            'a[href="/soluciones/cat-pruebas/guia-imp?equipo=imp-mercadeo"]',
          ),
        'la guía con el equipo',
      ),
    )
    await tocar(await esperarControl('Dato protegido: Credencial del equipo'))
    await esperar(() => textoPantalla().includes('No hay una credencial configurada para este equipo.'), 'sin credencial')
    expect(textoPantalla()).toContain('Equipo: Impresora Mercadeo')
  })
})
