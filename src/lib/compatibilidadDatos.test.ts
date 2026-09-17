import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  type Articulo,
  type Credencial,
  type Dispositivo,
  type ProgresoPasos,
  type Referencia,
} from './db'
import { normalizarProcedimiento } from './procedimiento'
import {
  avanceDe,
  contarHechos,
  ejecucionAbierta,
  empezarEjecucion,
  establecerPasoHecho,
  leerAvance,
  verificacionFinalCompleta,
} from './progresoPasos'
import { obtenerRecientes, registrarVisita } from './recientes'
import { accionDeGuia, lineaAvanceGuia } from '../features/soluciones/accionGuia'
import { guiaTerminada } from '../features/soluciones/cierrePaso'
import { accionesDeGuia } from '../features/soluciones/useAccionesDeGuia'
import { accionesRapidasDeCredencial, tipoDe } from '../features/boveda/accionesCredencial'
import {
  crearIndiceDesdeDocumentos,
  documentosDeBusqueda,
  buscar,
  type DatosIndice,
} from '../features/busqueda/useIndiceBusqueda'

// COMPATIBILIDAD CON LOS DATOS QUE YA EXISTEN (punto 9 del encargo del
// 2026-09-09, tarea 234).
//
// Las tareas 233 a 241 agregaron campos y funciones nuevas sobre datos
// que el equipo lleva meses escribiendo: filas de progreso sin
// `ejecucionId` ni `vinculos`, credenciales sin `tipo`, artículos sin
// `estado`, equipos sin `detalles`. Nada de eso se migra al leer (la
// versión 15 de Dexie solo repara lo que rompía el render), así que la
// garantía tiene que ser que el código NUEVO aguanta la forma VIEJA.
//
// Por eso las filas de estas pruebas se escriben a mano, sin pasar por
// los escritores actuales: reproducen lo que hay hoy en los teléfonos,
// no lo que produciría esta versión.

const AYER = '2026-09-14T10:00:00.000Z'

/** Una fila de progreso tal como la escribía la versión anterior. */
function progresoViejo(articuloId: string, pasosHechos: string[]): ProgresoPasos {
  // Sin `ejecucionId`, sin `vinculos`, sin `pasosSaltados`, sin
  // `verificacionHecha` y sin `instruccionesHechas`.
  return { articuloId, pasosHechos, actualizadoEn: AYER } as unknown as ProgresoPasos
}

/** Una guía con el procedimiento en la forma anterior a los bloques. */
function guiaVieja(id: string, pasos: string[]): Articulo {
  return {
    id,
    categoriaId: 'cat-1',
    titulo: `Guía ${id}`,
    tipo: 'configuracion',
    // `instrucciones` en vez de `bloques`, y sin los campos que el
    // editor actual escribe siempre.
    procedimiento: {
      pasos: pasos.map((idPaso) => ({
        id: idPaso,
        titulo: `Paso ${idPaso}`,
        instrucciones: [`Hacer ${idPaso}`],
      })),
    },
    eliminadoEn: null,
  } as unknown as Articulo
}

beforeEach(async () => {
  await db.progresoPasos.clear()
  await db.recientes.clear()
  await db.articulos.clear()
  await db.dispositivos.clear()
  await db.categorias.clear()
})

describe('progreso escrito por una versión anterior', () => {
  it('se lee entero, con los campos que faltan en su valor vacío', async () => {
    await db.progresoPasos.put(progresoViejo('a1', ['p1']))

    const avance = await leerAvance('a1')

    expect(avance?.pasosHechos).toEqual(['p1'])
    // Lo que no existía no rompe a quien lo lee: se trata como vacío.
    expect(avance?.verificacionHecha ?? []).toEqual([])
    expect(avance?.pasosSaltados ?? []).toEqual([])
  })

  it('la existencia de la FILA es lo que dice que hay ejecución abierta', async () => {
    await db.progresoPasos.put(progresoViejo('a1', ['p1']))

    // Lo que mira la ficha de la guía (`progreso != null`), y que es lo
    // que `accionDeGuia` recibe como tercer argumento.
    expect(await db.progresoPasos.get('a1')).toBeDefined()
    // `ejecucionAbierta` devuelve el IDENTIFICADOR, que en una fila
    // anterior a ese campo todavía no existe: null aquí NO significa
    // "sin empezar". Por eso ninguna pantalla decide con esta función.
    expect(await ejecucionAbierta('a1')).toBeNull()
  })

  it('`avanceDe` de una fila vieja devuelve la fila; su vínculo, undefined', () => {
    const fila = progresoViejo('a1', ['p1'])
    expect(avanceDe(fila, 'a1')?.pasosHechos).toEqual(['p1'])
    // Sin `vinculos`, un vínculo NO hereda el avance de la fila: dar por
    // cumplido lo de otra ejecución es justo el defecto que cerró la 235.
    expect(avanceDe(fila, { raizId: 'a1', vinculoId: 'v1' })).toBeUndefined()
  })

  it('ofrece continuar en el primer paso pendiente, no en "hechos + 1"', async () => {
    await db.progresoPasos.put(progresoViejo('a1', ['p2']))
    const procedimiento = normalizarProcedimiento(guiaVieja('a1', ['p1', 'p2', 'p3']).procedimiento)!

    const accion = accionDeGuia(procedimiento, await leerAvance('a1'), true)

    expect(accion.estado).toBe('continuar')
    expect(lineaAvanceGuia(accion)).toBe('Vas en el paso 1 de 3')
  })

  it('escribir sobre ella le estrena `ejecucionId` sin perder lo marcado', async () => {
    await db.progresoPasos.put(progresoViejo('a1', ['p1']))

    await establecerPasoHecho('a1', 'p2', true, [])

    const fila = await db.progresoPasos.get('a1')
    expect(fila?.pasosHechos).toEqual(['p1', 'p2'])
    expect(fila?.ejecucionId).toBeTruthy()
  })

  it('repetirla la estrena limpia y con identificador propio', async () => {
    await db.progresoPasos.put(progresoViejo('a1', ['p1', 'p2']))

    const ejecucionId = await empezarEjecucion('a1')

    const fila = await db.progresoPasos.get('a1')
    expect(fila?.pasosHechos).toEqual([])
    expect(fila?.ejecucionId).toBe(ejecucionId)
  })

  it('una guía vieja SIN comprobaciones finales se da por terminada con sus pasos', () => {
    const procedimiento = normalizarProcedimiento(guiaVieja('a1', ['p1', 'p2']).procedimiento)!
    expect(procedimiento.verificacionFinal).toEqual([])
    // `verificacionHecha` no existe en la fila vieja: sin comprobaciones
    // que marcar, no puede dejar la guía eternamente a medias.
    expect(guiaTerminada(procedimiento, ['p1', 'p2'], undefined)).toBe(true)
    expect(verificacionFinalCompleta(undefined, 0)).toBe(true)
  })

  it('un paso borrado de la guía no cuenta como hecho', () => {
    expect(contarHechos(['p1', 'paso-que-ya-no-existe'], ['p1', 'p2'])).toBe(1)
  })
})

describe('guías guardadas antes del editor actual', () => {
  it('sus pasos se leen y la tarjeta ofrece continuar donde iba', () => {
    const mapa = accionesDeGuia([guiaVieja('a1', ['p1', 'p2', 'p3'])], [progresoViejo('a1', ['p1'])])
    expect(lineaAvanceGuia(mapa.get('a1'))).toBe('Vas en el paso 2 de 3')
  })

  it('las instrucciones antiguas se leen como tareas, sin perderse', () => {
    const procedimiento = normalizarProcedimiento(guiaVieja('a1', ['p1']).procedimiento)!
    expect(procedimiento.pasos[0].bloques).toHaveLength(1)
    expect(procedimiento.pasos[0].bloques[0].tipo).toBe('tarea')
  })

  it('un artículo sin `estado` se trata como publicado y entra al buscador', () => {
    const sinEstado = guiaVieja('a1', ['p1'])
    const documentos = documentosDeBusqueda(datosIndice({ articulos: [sinEstado] }))
    expect(documentos.map((d) => d.id)).toContain('articulo:a1')
  })
})

describe('credenciales guardadas antes de la columna `tipo`', () => {
  const vieja = {
    id: 'c1',
    titulo: 'Acceso heredado',
    categoria: 'Redes',
    datosCifrados: 'bloque',
    eliminadoEn: null,
  } as unknown as Credencial

  it('se leen como acceso y ofrecen usuario y contraseña', () => {
    expect(tipoDe(vieja)).toBe('cuenta')
    expect(accionesRapidasDeCredencial(vieja).map((a) => a.campo)).toEqual(['usuario', 'contrasena'])
  })

  it('sin `archivo` ni `dispositivos` entran igual al índice con la bóveda abierta', () => {
    const documentos = documentosDeBusqueda(
      datosIndice({ credenciales: [vieja], bovedaDesbloqueada: true }),
    )
    expect(documentos.map((d) => d.id)).toContain('credencial:c1')
    // Y siguen sin entrar con la bóveda cerrada.
    expect(
      documentosDeBusqueda(datosIndice({ credenciales: [vieja] })).some((d) => d.tipo === 'credencial'),
    ).toBe(false)
  })
})

describe('otras filas anteriores a los campos actuales', () => {
  it('un equipo sin `detalles` se indexa y se encuentra', () => {
    const equipo = { id: 'd1', nombre: 'Switch heredado', eliminadoEn: null } as unknown as Dispositivo
    const indice = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosIndice({ dispositivos: [equipo] })))
    expect(buscar(indice, 'heredado').map((r) => r.id)).toContain('dispositivo:d1')
  })

  it('una ficha de un tipo que esta versión no conoce se ignora, no rompe', () => {
    const futura = { id: 'r1', tipo: 'algo-nuevo', titulo: 'Ficha del futuro', eliminadoEn: null } as unknown as Referencia
    expect(documentosDeBusqueda(datosIndice({ referencias: [futura] }))).toEqual([])
  })

  it('un reciente de los dos tipos que existían antes se sigue resolviendo', async () => {
    await db.categorias.put({ id: 'cat-1', nombre: 'Impresoras' } as never)
    await db.articulos.put(guiaVieja('a1', ['p1']))
    await db.dispositivos.put({ id: 'd1', nombre: 'Switch heredado', eliminadoEn: null } as unknown as Dispositivo)

    await registrarVisita('articulo', 'a1')
    await registrarVisita('dispositivo', 'd1')

    const recientes = await obtenerRecientes(3)
    expect(recientes.map((r) => r.titulo)).toEqual(['Switch heredado', 'Guía a1'])
    // Y nunca aparece nada de la bóveda: esa tabla no la anota.
    expect(recientes.some((r) => r.tipo !== 'articulo' && r.tipo !== 'dispositivo')).toBe(false)
  })
})

function datosIndice(parcial: Partial<DatosIndice>): DatosIndice {
  return {
    articulos: [],
    dispositivos: [],
    categorias: [],
    ubicaciones: [],
    personas: [],
    referencias: [],
    credenciales: [],
    diagnosticos: [],
    adjuntos: [],
    camposProtegidos: [],
    bovedaDesbloqueada: false,
    ...parcial,
  }
}
