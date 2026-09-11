import { afterAll, describe, expect, it } from 'vitest'
import {
  descripcionVencida,
  diasDeCalendario,
  estadoVencimiento,
  proximoVencimiento,
  textoVencimiento,
  vencimientoDesactualizado,
} from './vencimiento'

const HOY = new Date('2026-07-09T12:00:00')

describe('estadoVencimiento', () => {
  it('devuelve null sin fecha', () => {
    expect(estadoVencimiento(null, HOY)).toBeNull()
  })

  it('devuelve null si falta mucho para vencer', () => {
    expect(estadoVencimiento('2026-12-31', HOY)).toBeNull()
  })

  it('devuelve "proxima" dentro de los 30 días, incluido el día de hoy', () => {
    expect(estadoVencimiento('2026-07-09', HOY)).toBe('proxima')
    expect(estadoVencimiento('2026-08-01', HOY)).toBe('proxima')
  })

  it('devuelve "vencida" para una fecha ya pasada', () => {
    expect(estadoVencimiento('2026-07-08', HOY)).toBe('vencida')
    expect(estadoVencimiento('2026-01-01', HOY)).toBe('vencida')
  })

  it('ignora una fecha mal formada', () => {
    expect(estadoVencimiento('no-es-fecha', HOY)).toBeNull()
  })
})

describe('descripcionVencida', () => {
  it('dice "hoy" cuando vence justo el día de hoy', () => {
    expect(descripcionVencida('2026-07-09', HOY)).toBe('Venció hoy')
  })

  it('concuerda el singular a 1 día', () => {
    expect(descripcionVencida('2026-07-08', HOY)).toBe('Venció hace 1 día')
  })

  it('cuenta varios días', () => {
    expect(descripcionVencida('2026-07-06', HOY)).toBe('Venció hace 3 días')
  })

  it('sigue contando aunque venciera hace mucho', () => {
    expect(descripcionVencida('2026-01-01', HOY)).toBe('Venció hace 189 días')
  })

  it('no inventa una antigüedad con una fecha ilegible', () => {
    // Antes decía "Venció hace NaN días" en la fila de la Bóveda.
    expect(descripcionVencida('no-es-fecha', HOY)).toBe('Venció')
    expect(descripcionVencida('2026-02-31', HOY)).toBe('Venció')
  })

  it('no depende de la hora del día', () => {
    const respuestas = new Set(
      [0, 1, 6, 12, 18, 23].map((h) => descripcionVencida('2026-07-06', new Date(2026, 6, 9, h, 30))),
    )
    expect([...respuestas]).toEqual(['Venció hace 3 días'])
  })
})

// EL DEFECTO DEL HUSO, REPRODUCIDO (encargo del 2026-09-09, cambio 6).
//
// Se cambia `process.env.TZ` dentro del propio archivo porque la máquina
// de desarrollo está en America/Bogota, que NO tiene horario de verano:
// sin un huso que lo tenga, el defecto no se manifiesta y la prueba no
// probaría nada. Node relee la zona en cada operación de fecha, así que
// basta con asignarla y devolverla al terminar. Vitest aísla cada
// archivo en su propio proceso, así que esto no alcanza al resto.
describe('días de calendario en un huso con horario de verano', () => {
  const TZ_ORIGINAL = process.env.TZ
  afterAll(() => {
    process.env.TZ = TZ_ORIGINAL
  })

  // Santiago de Chile adelanta la hora en septiembre y la atrasa en
  // abril: los dos sentidos del cambio caen dentro de estos rangos.
  function conHuso<T>(zona: string, hacer: () => T): T {
    const previo = process.env.TZ
    process.env.TZ = zona
    try {
      return hacer()
    } finally {
      process.env.TZ = previo
    }
  }

  it('cuenta 19 días donde la resta de horas contaba 18 (cambio de septiembre)', () => {
    conHuso('America/Santiago', () => {
      expect(diasDeCalendario('2026-09-01', new Date(2026, 8, 20, 12))).toBe(-19)
      expect(descripcionVencida('2026-09-01', new Date(2026, 8, 20, 12))).toBe('Venció hace 19 días')
    })
  })

  it('tampoco se pasa de largo en el cambio de abril', () => {
    conHuso('America/Santiago', () => {
      expect(descripcionVencida('2026-03-25', new Date(2026, 3, 10, 12))).toBe('Venció hace 16 días')
    })
  })

  it('el huso del norte da exactamente lo mismo', () => {
    conHuso('Europe/Madrid', () => {
      expect(descripcionVencida('2026-03-20', new Date(2026, 3, 10, 12))).toBe('Venció hace 21 días')
    })
    conHuso('America/Bogota', () => {
      expect(descripcionVencida('2026-03-20', new Date(2026, 3, 10, 12))).toBe('Venció hace 21 días')
    })
    conHuso('UTC', () => {
      expect(descripcionVencida('2026-03-20', new Date(2026, 3, 10, 12))).toBe('Venció hace 21 días')
    })
  })

  it('el estado de la pastilla tampoco se corre un día', () => {
    conHuso('America/Santiago', () => {
      // Con el conteo por horas, un vencimiento a 31 días de distancia
      // pasaba a leerse como 30 y encendía el ámbar un día antes.
      expect(estadoVencimiento('2026-10-21', new Date(2026, 8, 20, 12))).toBeNull()
      expect(estadoVencimiento('2026-10-20', new Date(2026, 8, 20, 12))).toBe('proxima')
    })
  })

  it('un año entero cuenta día a día sin desviarse en ningún huso', () => {
    for (const zona of ['America/Santiago', 'Europe/Madrid', 'Pacific/Auckland', 'UTC']) {
      conHuso(zona, () => {
        const hoy = new Date(2026, 0, 1, 12)
        for (let i = 0; i <= 365; i++) {
          const fecha = new Date(Date.UTC(2026, 0, 1 + i))
          const iso = fecha.toISOString().slice(0, 10)
          expect(diasDeCalendario(iso, hoy)).toBe(i)
        }
      })
    }
  })
})

describe('proximoVencimiento', () => {
  it('suma 90 días a la fecha dada', () => {
    expect(proximoVencimiento(HOY)).toBe('2026-10-07')
  })

  it('cruza el fin de año correctamente', () => {
    expect(proximoVencimiento(new Date('2026-12-01T12:00:00'))).toBe('2027-03-01')
  })
})

describe('vencimientoDesactualizado', () => {
  const base = {
    contrasenaActual: 'nueva-clave',
    contrasenaOriginal: 'vieja-clave',
    venceEnActual: '2026-07-08',
    venceEnOriginal: '2026-07-08',
  }

  it('avisa cuando la contraseña cambió y el vencimiento sigue igual (hallazgo S1)', () => {
    expect(vencimientoDesactualizado(base)).toBe(true)
  })

  it('no avisa si la contraseña no cambió', () => {
    expect(vencimientoDesactualizado({ ...base, contrasenaActual: base.contrasenaOriginal })).toBe(false)
  })

  it('no avisa si no había vencimiento guardado (nada que resetear)', () => {
    expect(vencimientoDesactualizado({ ...base, venceEnOriginal: '', venceEnActual: '' })).toBe(false)
  })

  it('no avisa si el técnico ya actualizó el vencimiento', () => {
    expect(vencimientoDesactualizado({ ...base, venceEnActual: '2026-10-07' })).toBe(false)
  })

  it('no avisa si la contraseña quedó vacía (no es una rotación real)', () => {
    expect(vencimientoDesactualizado({ ...base, contrasenaActual: '' })).toBe(false)
  })
})

describe('textoVencimiento', () => {
  const hoy = new Date(2026, 8, 11) // 11 de septiembre de 2026, hora local

  it('dice "Vence hoy" el mismo día', () => {
    expect(textoVencimiento('2026-09-11', hoy)).toBe('Vence hoy')
  })

  it('dice "Vence mañana" el día siguiente', () => {
    expect(textoVencimiento('2026-09-12', hoy)).toBe('Vence mañana')
  })

  it('nunca dice "Venció hoy" para una fecha anterior', () => {
    expect(textoVencimiento('2026-09-10', hoy)).toBe('Venció hace 1 día')
    expect(textoVencimiento('2026-09-08', hoy)).toBe('Venció hace 3 días')
  })

  it('da la fecha corta en español para una fecha futura posterior', () => {
    expect(textoVencimiento('2026-09-18', hoy)).toBe('Vence el 18 sep')
    expect(textoVencimiento('2026-10-01', hoy)).toBe('Vence el 1 oct')
  })

  it('no inventa una fecha cuando el dato no es una fecha', () => {
    expect(textoVencimiento('mañana', hoy)).toBe('Sin fecha')
  })
})
