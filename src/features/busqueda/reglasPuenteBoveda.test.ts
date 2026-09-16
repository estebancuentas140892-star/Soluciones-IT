import { describe, expect, it } from 'vitest'
import {
  debeOfrecerPuenteBoveda,
  etiquetaPuenteBoveda,
  hayCoincidenciaFuerte,
  prominenciaPuenteBoveda,
} from './reglasPuenteBoveda'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

// El puente a la boveda bloqueada (tarea 241, secciones 5 y 19). Lo que
// se comprueba aqui es de seguridad, no de maquetacion.

describe('debeOfrecerPuenteBoveda', () => {
  const base = { puedeVerBoveda: true, desbloqueada: false, consulta: 'administrador POS' }

  it('se ofrece con permiso, con la bóveda cerrada y con algo escrito', () => {
    expect(debeOfrecerPuenteBoveda(base)).toBe(true)
  })

  it('NO se ofrece sin permiso de bóveda: quien no está autorizado no sabe ni que existe', () => {
    expect(debeOfrecerPuenteBoveda({ ...base, puedeVerBoveda: false })).toBe(false)
  })

  it('no se ofrece con la bóveda ya abierta: sus accesos ya salen en los resultados', () => {
    expect(debeOfrecerPuenteBoveda({ ...base, desbloqueada: true })).toBe(false)
  })

  it('no se ofrece sin consulta', () => {
    expect(debeOfrecerPuenteBoveda({ ...base, consulta: '' })).toBe(false)
    expect(debeOfrecerPuenteBoveda({ ...base, consulta: '   ' })).toBe(false)
  })
})

describe('etiquetaPuenteBoveda', () => {
  it('cita lo escrito, sin recortarlo ni interpretarlo', () => {
    expect(etiquetaPuenteBoveda('administrador POS')).toBe('Buscar "administrador POS" en Bóveda')
    expect(etiquetaPuenteBoveda('  caja 4  ')).toBe('Buscar "caja 4" en Bóveda')
  })

  it('es la MISMA frase exista o no la credencial: la sugerencia no delata nada', () => {
    // Dos consultas distintas producen dos rotulos con la misma forma.
    // El puente no puede convertirse en un oraculo de "¿existe X?".
    const plantilla = (etiqueta: string, consulta: string) => etiqueta.replace(consulta, '{}')
    expect(plantilla(etiquetaPuenteBoveda('administrador POS'), 'administrador POS')).toBe(
      plantilla(etiquetaPuenteBoveda('xyz'), 'xyz'),
    )
  })

  it('no afirma que haya resultados ni nombra ninguna credencial', () => {
    const etiqueta = etiquetaPuenteBoveda('administrador POS')
    expect(etiqueta).not.toMatch(/existe|encontrad|hay \d|coincidencia/i)
  })
})

// EL PESO DEL PUENTE (encargo del 2026-09-16, sección 14): cede ante una
// coincidencia pública fuerte y conserva su forma destacada sin ella.
describe('prominenciaPuenteBoveda', () => {
  function resultado(titulo: string, extra: Partial<ResultadoBusqueda> = {}): ResultadoBusqueda {
    return { id: `herramienta:${titulo}`, tipo: 'herramienta', titulo, subtitulo: '', ruta: '/', portadaRef: '', ...extra }
  }

  it('con una coincidencia exacta del título ("Zabbix") pasa a secundario', () => {
    expect(prominenciaPuenteBoveda([resultado('Zabbix')], 'zabbix')).toBe('secundario')
    // Sin distinguir mayúsculas ni acentos, como el resto del buscador.
    expect(prominenciaPuenteBoveda([resultado('Cámaras')], 'camaras')).toBe('secundario')
  })

  it('un título que empieza por la consulta entera también es coincidencia fuerte', () => {
    expect(prominenciaPuenteBoveda([resultado('Zabbix (ZBX)')], 'Zabbix')).toBe('secundario')
    expect(prominenciaPuenteBoveda([resultado('Servidor de archivos')], 'servidor')).toBe('secundario')
  })

  it('sin resultados públicos el puente se queda destacado', () => {
    expect(prominenciaPuenteBoveda([], 'administrador POS')).toBe('destacado')
  })

  it('una coincidencia parcial o dentro de otra palabra no le quita protagonismo', () => {
    expect(prominenciaPuenteBoveda([resultado('Monitoreo con Zabbix')], 'zabbix')).toBe('destacado')
    expect(prominenciaPuenteBoveda([resultado('Servidores')], 'servidor')).toBe('destacado')
  })

  it('lo que solo trajo un sinónimo no cuenta: no es lo que se escribió', () => {
    expect(prominenciaPuenteBoveda([resultado('Respaldo', { soloSinonimo: true })], 'respaldo')).toBe('destacado')
  })

  it('no depende de nada de la bóveda: la misma consulta y los mismos resultados dan lo mismo siempre', () => {
    const publicos = [resultado('Zabbix')]
    expect(prominenciaPuenteBoveda(publicos, 'zabbix')).toBe(prominenciaPuenteBoveda(publicos, 'zabbix'))
    expect(hayCoincidenciaFuerte(publicos, '   ')).toBe(false)
  })
})
