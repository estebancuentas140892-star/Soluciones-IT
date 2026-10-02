import { describe, expect, it } from 'vitest'
import { CASOS_BENCHMARK, ejecutarBenchmark, informeBenchmark, type Pipeline } from './benchmarkResolver'
import { confianzaDeResultados, intencionesDeConsulta, mejoresResultados } from './mejores'
import { buscar } from './useIndiceBusqueda'

// BENCHMARK DE CONSULTAS NATURALES (tarea 288). Los casos, los datos
// sintéticos y la vara de medir viven en `benchmarkResolver.ts`; los casos
// se escribieron antes de cambiar el algoritmo y no se tocan.
//
// Para leer el informe completo (una fila por consulta; con el reporter
// por defecto, vitest no enseña lo que imprime una prueba que pasa):
//   BENCHMARK_INFORME=1 npx vitest run src/features/busqueda/benchmarkResolver.test.ts --reporter=verbose
// y con los títulos de "Mejores resultados" de cada consulta:
//   BENCHMARK_INFORME=detalle npx vitest run src/features/busqueda/benchmarkResolver.test.ts --reporter=verbose

// El buscador de la app, pieza por pieza: el índice, "Mejores
// resultados", las intenciones con la evidencia de lo encontrado y la
// regla de confianza que decide entre "Mejor coincidencia" y "Mejores
// resultados".
const BUSCADOR: Pipeline = {
  buscar,
  mejores: (resultados, consulta) => mejoresResultados(resultados, consulta),
  intenciones: (consulta, resultados) => intencionesDeConsulta(consulta, resultados),
  confianza: (resultados, consulta) => confianzaDeResultados(resultados, consulta),
}

// EL ANTES (commit 81b8787, buscador de 70a7e0e): estos 22 casos fallaban
// y 13 de 35 se cumplían. Se conservan como registro de dónde se partió;
// la tabla completa está en BUSCADOR.md, sección 14.1.
const FALLABAN_ANTES = [
  'impresora',
  'impresora-mercadeo',
  'impresora-caja-2',
  'mercadeo-no-imprime',
  'word-pdf',
  'ip-impresora-mercadeo',
  'ip-sola',
  'crear-usuario',
  'crear-usuario-boveda',
  'persona-nueva',
  'backup-correo',
  'que-es-dhcp',
  'ping',
  'windows-r',
  'clave-mercadeo-cerrada',
  'clave-mercadeo-abierta',
  'pc-contabilidad',
  'servidor-facturacion',
  'serial',
  'placa',
  'errata',
  'titulo-exacto',
]

describe('benchmark de consultas naturales de Resolver (tarea 288)', () => {
  const veredictos = ejecutarBenchmark(BUSCADOR)
  const informe = process.env.BENCHMARK_INFORME
  if (informe) console.log(informeBenchmark(veredictos, 'Buscador actual', informe === 'detalle'))

  it('mide al menos las 20 consultas del encargo', () => {
    expect(CASOS_BENCHMARK.length).toBeGreaterThanOrEqual(20)
  })

  it('el registro del ANTES nombra casos que existen', () => {
    const ids = new Set(CASOS_BENCHMARK.map((caso) => caso.id))
    expect(FALLABAN_ANTES.filter((id) => !ids.has(id))).toEqual([])
  })

  // EL DESPUÉS: cada caso se cumple entero. Si un cambio del buscador rompe
  // uno, esta prueba dice cuál y en qué criterio.
  it.each(veredictos.map((veredicto) => [veredicto.caso.id, veredicto] as const))('%s', (_id, veredicto) => {
    expect(veredicto.criterios.filter((criterio) => !criterio.ok)).toEqual([])
  })
})
