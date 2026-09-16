import { describe, expect, it } from 'vitest'
import { debeOfrecerPuenteBoveda, etiquetaPuenteBoveda } from './reglasPuenteBoveda'

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
