import { afterEach, describe, expect, it, vi } from 'vitest'
import { datosDelIndice } from '../../pruebas/datosBusquedaAproximada'
import { leerResultados } from './mejores'
import {
  buscar,
  crearIndiceDesdeDocumentos,
  documentosDeBusqueda,
  sugerirConsulta,
  type ResultadoBusqueda,
} from './useIndiceBusqueda'

// RESOLVER ENCUENTRA AUNQUE SE ESCRIBA CON ERRORES (tarea 346). Sobre el
// índice global de verdad, con datos inventados (`datosBusquedaAproximada`):
// letras cambiadas de sitio, tildes, omisiones y varias palabras; lo exacto
// siempre delante; lo aproximado dicho como tal; la IP y el serial, tal
// cual; y nada de la Bóveda que no se haya escrito exactamente.

const indice = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosDelIndice()))

/** Todo lo encontrado, en el orden en que Resolver lo presenta. */
function enOrden(consulta: string): ResultadoBusqueda[] {
  const resultados = buscar(indice, consulta)
  return leerResultados(resultados, consulta, resultados.length).mejores
}

function titulos(lista: ResultadoBusqueda[]): string[] {
  return lista.map((resultado) => resultado.titulo)
}

describe('nombre y apellido con letras cambiadas de sitio', () => {
  it('"daniel garcia" encuentra a Daniel Gracia y a Daniela Gracia, dichos como posibles', () => {
    const lista = enOrden('daniel garcia')
    const gracia = lista.find((r) => r.titulo === 'Daniel Gracia')
    const daniela = lista.find((r) => r.titulo === 'Daniela Gracia')
    expect(gracia?.aproximado).toBe(true)
    expect(daniela?.aproximado).toBe(true)
    // El apellido cuenta: no basta con "Daniel". Gracia, que se parece en
    // las dos palabras, va antes que Daniel Pérez, que solo comparte el nombre.
    expect(titulos(lista).indexOf('Daniel Gracia')).toBeLessThan(titulos(lista).indexOf('Daniel Pérez'))
    // Y el apellido de verdad es el que se anota como aproximado.
    expect(gracia?.aproximadoPorPalabra).toEqual([false, true])
  })

  it('también con mayúsculas y con la tilde puesta', () => {
    expect(titulos(enOrden('DANIEL GARCÍA')).slice(0, 2)).toEqual(titulos(enOrden('daniel garcia')).slice(0, 2))
    expect(enOrden('Daniel Gracia').find((r) => r.titulo === 'Daniel Gracia')?.aproximado).toBe(false)
  })
})

describe('lo exacto siempre va delante de lo aproximado', () => {
  it('"daniel garcia": Daniel García (exacto) primero, y ningún aproximado antes que él', () => {
    const lista = enOrden('daniel garcia')
    expect(lista[0].titulo).toBe('Daniel García')
    expect(lista[0].aproximado).toBe(false)
    const primerAproximado = lista.findIndex((r) => r.aproximado)
    const ultimoExactoCompleto = lista.findLastIndex(
      (r) => !r.aproximado && (r.camposPorPalabra ?? []).every((campos) => campos.length > 0),
    )
    expect(primerAproximado).toBeGreaterThan(ultimoExactoCompleto)
  })

  it('una posible coincidencia nunca se presenta como la mejor', () => {
    expect(leerResultados(buscar(indice, 'no impirme'), 'no impirme').confianza).toBe('cercana')
    expect(leerResultados(buscar(indice, 'impresra'), 'impresra').confianza).toBe('cercana')
  })
})

describe('personas con nombres parecidos: se enseñan todas y nada se elige solo', () => {
  it('"daniel gracia" trae a Daniel y a Daniela Gracia, sin una "mejor coincidencia" que decida', () => {
    const resultados = buscar(indice, 'daniela gracia')
    const lista = leerResultados(resultados, 'daniela gracia', resultados.length)
    const personas = lista.mejores.filter((r) => r.tipo === 'persona').map((r) => r.titulo)
    expect(personas).toContain('Daniela Gracia')
    expect(personas).toContain('Daniel Gracia')
  })

  it('con dos posibles para "daniel garcia", la confianza no es alta', () => {
    expect(leerResultados(buscar(indice, 'daniel garcia'), 'daniel garcia').confianza).toBe('cercana')
  })
})

describe('tildes, erratas y omisiones', () => {
  it('"no impirme" encuentra la guía "La impresora no imprime" y propone "no imprime"', () => {
    const resultados = buscar(indice, 'no impirme')
    const guia = resultados.find((r) => r.titulo === 'La impresora no imprime')
    expect(guia).toBeDefined()
    expect(guia?.aproximado).toBe(true)
    expect(sugerirConsulta(indice, 'no impirme', resultados)).toBe('no imprime')
  })

  it('"impresra" encuentra "impresora", dicho como posible, y lo propone', () => {
    const resultados = buscar(indice, 'impresra')
    expect(titulos(resultados)).toContain('Impresoras')
    expect(titulos(resultados)).toContain('Impresora Mercadeo')
    expect(resultados.every((r) => r.aproximado)).toBe(true)
    expect(sugerirConsulta(indice, 'impresra', resultados)).toBe('impresora')
  })

  it('"jose" encuentra a José Ramírez como coincidencia EXACTA (la tilde no es un error)', () => {
    const resultados = buscar(indice, 'jose')
    const jose = resultados.find((r) => r.titulo === 'José Ramírez')
    expect(jose?.aproximado).toBe(false)
    expect(sugerirConsulta(indice, 'jose', resultados)).toBeNull()
  })

  it('la sugerencia conserva lo demás como se escribió y no toca lo que ya existe', () => {
    expect(sugerirConsulta(indice, 'La impresora no impirme', buscar(indice, 'La impresora no impirme'))).toBe(
      'La impresora no imprime',
    )
    expect(sugerirConsulta(indice, 'Impresra', buscar(indice, 'Impresra'))).toBe('Impresora')
    expect(sugerirConsulta(indice, 'daniel garcia', buscar(indice, 'daniel garcia'))).toBeNull()
  })
})

describe('el responsable de un equipo, con el nombre vigente de su persona', () => {
  it('"daniel perez" encuentra el equipo vinculado aunque guarde una copia vieja del nombre', () => {
    const resultados = buscar(indice, 'daniel perez')
    const equipo = resultados.find((r) => r.titulo === 'PC Contabilidad 02')
    expect(equipo).toBeDefined()
    expect(equipo?.aproximado).toBe(false)
  })

  it('"daniel garcia" trae los equipos de quien se parece, dichos como posibles', () => {
    const lista = enOrden('daniel garcia')
    expect(lista.find((r) => r.titulo === 'PC Tesorería')?.aproximado).toBe(false)
    expect(lista.find((r) => r.titulo === 'Impresora Bodega')?.aproximado).toBe(true)
  })
})

describe('IP y serial, tal cual', () => {
  it('"XK7Q2291" encuentra SU equipo y no el de serial casi igual', () => {
    const resultados = buscar(indice, 'XK7Q2291')
    expect(titulos(resultados)).toEqual(['Impresora Mercadeo'])
    expect(resultados[0].aproximado).toBe(false)
    // Un serial con un número cambiado no trae nada por parecido.
    expect(buscar(indice, 'XK7Q2219')).toEqual([])
  })

  it('"10.10.6.8" pone primero el equipo con esa IP, y nada se marca como posible', () => {
    const lista = enOrden('10.10.6.8')
    expect(lista[0].titulo).toBe('Impresora Mercadeo')
    expect(lista.some((r) => r.aproximado)).toBe(false)
  })

  it('lo escrito como un valor no se corrige en la sugerencia', () => {
    expect(sugerirConsulta(indice, 'XK7Q2219', buscar(indice, 'XK7Q2219'))).toBeNull()
  })
})

describe('sin filtraciones de la Bóveda', () => {
  const abierta = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosDelIndice({ bovedaDesbloqueada: true })))

  it('con la Bóveda bloqueada, ni lo exacto ni lo aproximado traen una credencial', () => {
    for (const consulta of ['acceso mercadeo', 'acseso mercadoe', 'acseso']) {
      expect(buscar(indice, consulta).some((r) => r.tipo === 'credencial')).toBe(false)
    }
  })

  it('abierta, la credencial responde a lo escrito tal cual, no a una errata', () => {
    expect(buscar(abierta, 'acceso mercadeo').some((r) => r.tipo === 'credencial')).toBe(true)
    expect(buscar(abierta, 'acseso mercadoe').some((r) => r.tipo === 'credencial')).toBe(false)
  })

  it('una palabra que solo existe en la Bóveda nunca sale como sugerencia', () => {
    // "acceso" solo está en el título de la credencial: no es vocabulario.
    expect(sugerirConsulta(abierta, 'acseso', buscar(abierta, 'acseso'))).toBeNull()
  })

  it('el contenido cifrado no entra al índice en ningún caso', () => {
    const documentos = documentosDeBusqueda(datosDelIndice({ bovedaDesbloqueada: true }))
    expect(JSON.stringify(documentos)).not.toContain('CIFRADO-DE-PRUEBA-NO-DEBE-SALIR')
  })
})

describe('sin conexión', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('buscar y sugerir no tocan la red: todo sale del índice local', () => {
    const pedir = vi.fn(() => Promise.reject(new Error('sin red')))
    vi.stubGlobal('fetch', pedir)
    vi.stubGlobal('navigator', { ...globalThis.navigator, onLine: false })
    const resultados = buscar(indice, 'no impirme')
    expect(resultados.length).toBeGreaterThan(0)
    expect(sugerirConsulta(indice, 'no impirme', resultados)).toBe('no imprime')
    expect(pedir).not.toHaveBeenCalled()
  })
})
