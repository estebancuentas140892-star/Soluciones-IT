import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento, Procedimiento } from './db'
import { evaluarCompletitud } from './completitud'

function tarea(texto: string, cambios: Partial<BloquePaso> = {}): BloquePaso {
  return {
    id: `tarea-${texto}`,
    tipo: 'tarea',
    texto,
    tono: null,
    adjunto: null,
    tipoTarea: 'accion',
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    credencialId: null,
    credencialTitulo: '',
    ...cambios,
  }
}

function paso(cambios: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'paso-1',
    titulo: 'Abrir la consola',
    objetivo: '',
    bloques: [tarea('Hacer algo')],
    adjuntos: [],
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...cambios,
  }
}

function procedimiento(cambios: Partial<Procedimiento> = {}): Procedimiento {
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    pasos: [paso()],
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
    ...cambios,
  }
}

describe('evaluarCompletitud', () => {
  it('devuelve 0 sin sugerencias cuando no hay procedimiento', () => {
    expect(evaluarCompletitud(null, [])).toEqual({ porcentaje: 0, sugerencias: [] })
  })

  it('un procedimiento mínimo obtiene un porcentaje bajo con la lista de sugerencias', () => {
    const resultado = evaluarCompletitud(procedimiento(), [])
    // Solo cumple "todos los pasos tienen tareas": 1 de 11 criterios.
    expect(resultado.porcentaje).toBe(9)
    expect(resultado.sugerencias.length).toBe(10)
    expect(resultado.sugerencias.join(' ')).toContain('portada')
    expect(resultado.sugerencias.join(' ')).toContain('etiquetas')
  })

  it('un procedimiento completo llega a 100 sin sugerencias', () => {
    const completo = procedimiento({
      descripcion: 'Usar cuando la impresora de red no aparece',
      portada: { referencia: 'a/portada.jpg', nombre: 'p.jpg', tipo: 'image/jpeg' },
      objetivoGeneral: 'Dejar la impresora funcionando',
      requisitos: ['Acceso a la red'],
      tiempoEstimadoMin: 15,
      dificultad: 'principiante',
      verificacionFinal: ['Imprime la página de prueba'],
      pasos: [
        paso({
          credencialId: 'cred-1',
          credencialTitulo: 'Impresora',
          bloques: [
            tarea('Conectar el cable'),
            {
              id: 'img-1',
              tipo: 'imagen',
              texto: '',
              tono: null,
              adjunto: { referencia: 'a/1.jpg', nombre: '1.jpg', tipo: 'image/jpeg' },
              tipoTarea: null,
              decisionArticuloId: null,
              decisionArticuloTitulo: '',
              credencialId: null,
              credencialTitulo: '',
            },
          ],
        }),
      ],
    })
    expect(evaluarCompletitud(completo, ['impresora', 'red'])).toEqual({
      porcentaje: 100,
      sugerencias: [],
    })
  })

  it('detecta pasos sin tareas', () => {
    const resultado = evaluarCompletitud(
      procedimiento({ pasos: [paso(), paso({ id: 'paso-2', bloques: [] })] }),
      [],
    )
    expect(resultado.sugerencias.join(' ')).toContain('pasos sin tareas')
  })

  it('los vínculos por tarea (credencial o decisión) también cuentan como vínculo', () => {
    const conVinculoEnTarea = procedimiento({
      pasos: [paso({ bloques: [tarea('Ingresar usuario', { credencialId: 'cred-1', credencialTitulo: 'X' })] })],
    })
    const resultado = evaluarCompletitud(conVinculoEnTarea, [])
    expect(resultado.sugerencias.join(' ')).not.toContain('Vincula procedimientos')
  })
})
