import { describe, expect, it } from 'vitest'
import { CASOS_BENCHMARK, ejecutarBenchmark, informeBenchmark, type Pipeline } from './benchmarkResolver'
import { intencionesDeConsulta, mejoresResultados } from './mejores'
import { buscar } from './useIndiceBusqueda'

// BENCHMARK DE CONSULTAS NATURALES (tarea 288, fase 1). Los casos, los
// datos sintéticos y la vara de medir viven en `benchmarkResolver.ts`.
//
// Para leer el informe completo (una fila por consulta; con el reporter
// por defecto, vitest no enseña lo que imprime una prueba que pasa):
//   BENCHMARK_INFORME=1 npx vitest run src/features/busqueda/benchmarkResolver.test.ts --reporter=verbose
// y con los títulos de "Mejores resultados" de cada consulta:
//   BENCHMARK_INFORME=detalle npx vitest run src/features/busqueda/benchmarkResolver.test.ts --reporter=verbose

// El buscador tal como estaba al empezar la tarea 288: sin regla de
// confianza, así que la interfaz decía SIEMPRE "Mejores resultados".
const BUSCADOR_ACTUAL: Pipeline = {
  buscar,
  mejores: (resultados, consulta) => mejoresResultados(resultados, consulta),
  intenciones: (consulta) => intencionesDeConsulta(consulta),
  confianza: () => 'cercana',
}

// Los casos que el buscador de antes NO cumple (el "ANTES" de la fase 1,
// 13 de 35 casos cumplen). La prueba fija el estado real: si un caso
// cambia de resultado sin que se toque el buscador, falla y avisa.
const FALLAN_ANTES = new Set<string>([
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
])

describe('benchmark de consultas naturales de Resolver (tarea 288)', () => {
  const veredictos = ejecutarBenchmark(BUSCADOR_ACTUAL)
  const informe = process.env.BENCHMARK_INFORME
  if (informe) console.log(informeBenchmark(veredictos, 'Buscador actual', informe === 'detalle'))

  it('mide al menos las 20 consultas del encargo', () => {
    expect(CASOS_BENCHMARK.length).toBeGreaterThanOrEqual(20)
  })

  it.each(veredictos.map((veredicto) => [veredicto.caso.id, veredicto] as const))('%s', (_id, veredicto) => {
    const fallos = veredicto.criterios.filter((criterio) => !criterio.ok)
    expect({ cumple: veredicto.ok, fallos }).toEqual({
      cumple: !FALLAN_ANTES.has(veredicto.caso.id),
      fallos: FALLAN_ANTES.has(veredicto.caso.id) ? fallos : [],
    })
  })
})
