import { describe, expect, it } from 'vitest'
import {
  hayQueSepararMejores,
  intencionesDeConsulta,
  MAXIMO_MEJORES,
  mejoresResultados,
  sinLosMejores,
  subtituloConTipo,
} from './mejores'
import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// Pruebas del ranking global de "Mejores resultados" (tarea 241). Todo
// es logica pura sobre lo que `buscar` ya devolvio, asi que no hace
// falta ni navegador ni base local.

function resultado(
  id: string,
  tipo: TipoResultado,
  titulo: string,
  extra: Partial<ResultadoBusqueda> = {},
): ResultadoBusqueda {
  return {
    id,
    tipo,
    titulo,
    subtitulo: '',
    ruta: `/${tipo}/${id}`,
    portadaRef: '',
    ...extra,
  }
}

const titulos = (lista: ResultadoBusqueda[]) => lista.map((r) => r.titulo)

describe('mejoresResultados', () => {
  it('cruza modulos: el equipo exacto se adelanta a las guias que iban antes por grupo', () => {
    // El orden de entrada es el del buscador, que respeta el score pero
    // NO el modulo: el agrupado de la interfaz era el que ponia siempre
    // Guias primero.
    const entrada = [
      resultado('a1', 'articulo', 'Cambiar el rodillo de una impresora'),
      resultado('a2', 'articulo', 'Impresora: atasco de papel'),
      resultado('d1', 'dispositivo', 'Impresora caja 4'),
    ]
    expect(titulos(mejoresResultados(entrada, 'impresora caja 4'))[0]).toBe('Impresora caja 4')
  })

  it('el titulo exacto manda sobre cualquier otro peso', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Diagnosticar la red con ping y tracert'),
      resultado('c1', 'comando', 'ping'),
    ]
    expect(titulos(mejoresResultados(entrada, 'ping'))[0]).toBe('ping')
  })

  it('una herramienta con el nombre exacto gana a la guia que la menciona', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Revisar alertas de Zabbix cada mañana'),
      resultado('h1', 'herramienta', 'Zabbix'),
    ]
    expect(titulos(mejoresResultados(entrada, 'zabbix'))[0]).toBe('Zabbix')
  })

  it('un resultado que solo trae un sinonimo NUNCA adelanta a uno directo', () => {
    // "Copia de seguridad" es un articulo (peso operativo alto) y ademas
    // lleva la consulta expandida entera en el titulo; aun asi va detras
    // del resultado que coincide con lo escrito.
    const entrada = [
      resultado('h1', 'herramienta', 'Backup Exec'),
      resultado('a1', 'articulo', 'Crear copia de seguridad del SQL Server', { soloSinonimo: true }),
    ]
    expect(titulos(mejoresResultados(entrada, 'backup'))).toEqual([
      'Backup Exec',
      'Crear copia de seguridad del SQL Server',
    ])
  })

  it('a igualdad de coincidencia gana lo que resuelve, no lo que es un escalon', () => {
    const entrada = [
      resultado('cat1', 'categoria', 'Impresoras'),
      resultado('a1', 'articulo', 'Impresoras'),
    ]
    expect(titulos(mejoresResultados(entrada, 'impresoras'))[0]).toBe('Impresoras')
    expect(mejoresResultados(entrada, 'impresoras')[0].tipo).toBe('articulo')
  })

  it('nunca devuelve mas de cinco', () => {
    const entrada = Array.from({ length: 12 }, (_, i) =>
      resultado(`a${i}`, 'articulo', `Configurar impresora ${i}`),
    )
    expect(mejoresResultados(entrada, 'impresora')).toHaveLength(MAXIMO_MEJORES)
  })

  it('conserva el orden del buscador como desempate, para que no baile entre teclas', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Reiniciar el servidor de correo'),
      resultado('a2', 'articulo', 'Reiniciar el servidor de archivos'),
    ]
    expect(titulos(mejoresResultados(entrada, 'reiniciar servidor'))).toEqual([
      'Reiniciar el servidor de correo',
      'Reiniciar el servidor de archivos',
    ])
  })

  it('sin consulta o sin resultados no elige nada', () => {
    expect(mejoresResultados([], 'algo')).toEqual([])
    expect(mejoresResultados([resultado('a1', 'articulo', 'Algo')], '  ')).toEqual([])
  })
})

describe('intencionesDeConsulta', () => {
  it('"crear cliente externo" pide un procedimiento', () => {
    expect(intencionesDeConsulta('crear cliente externo')).toContain('procedimiento')
  })

  it('"que es dhcp" pide el glosario', () => {
    expect(intencionesDeConsulta('qué es dhcp')).toContain('glosario')
  })

  it('"impresora taquilla 2" pide un equipo concreto', () => {
    expect(intencionesDeConsulta('impresora taquilla 2')).toContain('equipo')
  })

  it('"administrador pos" pide un acceso', () => {
    expect(intencionesDeConsulta('administrador POS')).toContain('acceso')
  })

  it('"la impresora no aparece" es un problema', () => {
    expect(intencionesDeConsulta('la impresora no aparece')).toContain('problema')
  })

  it('una palabra suelta sin señales no fuerza ninguna intencion', () => {
    expect(intencionesDeConsulta('zabbix')).toEqual([])
  })
})

describe('la intencion desempata sin inventar resultados', () => {
  it('"crear cliente externo" favorece la guia frente al equipo que se llama parecido', () => {
    const entrada = [
      resultado('d1', 'dispositivo', 'Cliente externo (PC recepción)'),
      resultado('a1', 'articulo', 'Crear cliente externo en ICG Manager'),
    ]
    expect(mejoresResultados(entrada, 'crear cliente externo')[0].tipo).toBe('articulo')
  })

  it('"la impresora no imprime" favorece el diagnostico', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Impresora: cambiar el tóner'),
      resultado('dg1', 'diagnostico', 'La impresora no imprime'),
    ]
    expect(mejoresResultados(entrada, 'la impresora no imprime')[0].tipo).toBe('diagnostico')
  })
})

describe('hayQueSepararMejores', () => {
  it('con dos resultados o más se separa: es donde viven las acciones directas', () => {
    const entrada = [
      resultado('a1', 'articulo', 'Guía A'),
      resultado('dg1', 'diagnostico', 'Diagnóstico B'),
    ]
    expect(hayQueSepararMejores(entrada, entrada)).toBe(true)
  })

  it('separa también cuando quedan resultados fuera de la selección', () => {
    const entrada = Array.from({ length: 8 }, (_, i) => resultado(`a${i}`, 'articulo', `Guía ${i}`))
    expect(hayQueSepararMejores(entrada, entrada.slice(0, 5))).toBe(true)
  })

  it('con UN solo resultado no: una cabecera sobre una fila única es ruido', () => {
    const entrada = [resultado('a1', 'articulo', 'Guía A')]
    expect(hayQueSepararMejores(entrada, entrada)).toBe(false)
  })

  it('sin resultados no hay nada que separar', () => {
    expect(hayQueSepararMejores([], [])).toBe(false)
  })
})

describe('sinLosMejores', () => {
  it('descuenta de los grupos lo que ya subio arriba: nada se pinta dos veces', () => {
    const uno = resultado('a1', 'articulo', 'Guía A')
    const dos = resultado('d1', 'dispositivo', 'Equipo B')
    expect(sinLosMejores([uno, dos], [uno])).toEqual([dos])
  })
})

describe('subtituloConTipo', () => {
  it('antepone el tipo cuando el subtitulo no lo dice', () => {
    expect(subtituloConTipo(resultado('a1', 'articulo', 'X', { subtitulo: 'ICG Manager' }))).toBe(
      'Guía · ICG Manager',
    )
    expect(subtituloConTipo(resultado('c1', 'credencial', 'X', { subtitulo: 'Acceso' }))).toBe(
      'Bóveda · Acceso',
    )
  })

  it('no lo repite cuando el subtitulo ya empieza por el', () => {
    expect(
      subtituloConTipo(resultado('h1', 'herramienta', 'X', { subtitulo: 'Herramienta · Monitoreo' })),
    ).toBe('Herramienta · Monitoreo')
  })

  it('sin subtitulo se queda solo con el tipo', () => {
    expect(subtituloConTipo(resultado('d1', 'dispositivo', 'X'))).toBe('Equipo')
  })
})
