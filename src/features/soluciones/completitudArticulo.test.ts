import { describe, expect, it } from 'vitest'
import {
  calcularCompletitud,
  senalesDeArticulo,
  type DatosCompletitud,
  type SenalCompletitud,
} from './completitudArticulo'

const VACIO: DatosCompletitud = {
  tipo: 'instalacion',
  titulo: '',
  cantidadPasos: 0,
  descripcion: '',
  cantidadEtiquetas: 0,
  requisitos: '',
  tiempoEstimadoMin: '',
  dificultad: '',
  verificacionFinal: '',
  objetivoGeneral: '',
  contenido: '',
}

const COMPLETO: DatosCompletitud = {
  tipo: 'instalacion',
  titulo: 'Instalar impresora de bodega',
  cantidadPasos: 3,
  descripcion: 'Cuando llega una impresora nueva',
  cantidadEtiquetas: 2,
  requisitos: 'Acceso a la red',
  tiempoEstimadoMin: '20',
  dificultad: 'intermedio',
  verificacionFinal: 'La impresión de prueba salió',
  objetivoGeneral: 'Dejar la impresora operativa',
  contenido: '',
}

describe('calcularCompletitud', () => {
  it('un artículo vacío da 0 % y uno completo da 100 %', () => {
    expect(calcularCompletitud(senalesDeArticulo(VACIO)).porcentaje).toBe(0)
    expect(calcularCompletitud(senalesDeArticulo(COMPLETO)).porcentaje).toBe(100)
  })

  it('un artículo completo no deja ninguna pestaña marcada', () => {
    const completitud = calcularCompletitud(senalesDeArticulo(COMPLETO))
    expect(completitud.sugerencias).toEqual([])
    expect(completitud.pestanasPendientes.size).toBe(0)
  })

  it('las señales sin texto suman al porcentaje pero no generan sugerencia', () => {
    // El título es obligatorio y no merece una línea propia; con solo
    // el título escrito el porcentaje sube, pero la pestaña General
    // sigue marcada por sus otras señales (descripción, etiquetas...).
    const soloTitulo = calcularCompletitud(senalesDeArticulo({ ...VACIO, titulo: 'Algo' }))
    expect(soloTitulo.porcentaje).toBe(10)
    expect(soloTitulo.sugerencias.some((s) => s.texto.toLowerCase().includes('título'))).toBe(false)
  })

  it('el segundo paso suma al porcentaje sin agregar una sugerencia nueva', () => {
    const unPaso = calcularCompletitud(senalesDeArticulo({ ...VACIO, cantidadPasos: 1 }))
    const dosPasos = calcularCompletitud(senalesDeArticulo({ ...VACIO, cantidadPasos: 2 }))
    expect(dosPasos.porcentaje).toBeGreaterThan(unPaso.porcentaje)
    expect(dosPasos.sugerencias).toHaveLength(unPaso.sugerencias.length)
  })

  it('cada sugerencia apunta a la pestaña donde se resuelve', () => {
    const completitud = calcularCompletitud(senalesDeArticulo(VACIO))
    const porTexto = new Map(completitud.sugerencias.map((s) => [s.texto, s.pestana]))
    expect(porTexto.get('Agregar al menos un paso')).toBe('pasos')
    expect(porTexto.get('Escribir la verificación final')).toBe('pasos')
    expect(porTexto.get('Anotar los requisitos previos')).toBe('pasos')
    expect(porTexto.get('Escribir cuándo usar este procedimiento')).toBe('general')
    expect(porTexto.get('Agregar etiquetas para el buscador')).toBe('general')
    expect(porTexto.get('Indicar el objetivo general')).toBe('general')
    expect(porTexto.get('Indicar el tiempo estimado')).toBe('detalles')
    expect(porTexto.get('Indicar la dificultad')).toBe('detalles')
  })

  it('Publicación nunca queda marcada: no tiene señales de completitud', () => {
    const completitud = calcularCompletitud(senalesDeArticulo(VACIO))
    expect(completitud.pestanasPendientes.has('publicacion')).toBe(false)
  })

  it('una pestaña deja de estar marcada al completar todas sus señales', () => {
    const conDetalles = calcularCompletitud(
      senalesDeArticulo({ ...VACIO, tiempoEstimadoMin: '15', dificultad: 'principiante' }),
    )
    expect(conDetalles.pestanasPendientes.has('detalles')).toBe(false)
    expect(conDetalles.pestanasPendientes.has('pasos')).toBe(true)
  })

  it('no divide por cero si no llegan señales', () => {
    const vacio: SenalCompletitud[] = []
    expect(calcularCompletitud(vacio)).toEqual({
      porcentaje: 0,
      sugerencias: [],
      pestanasPendientes: new Set(),
    })
  })

  it('los espacios en blanco no cuentan como contenido', () => {
    const soloEspacios = calcularCompletitud(
      senalesDeArticulo({ ...VACIO, descripcion: '   ', objetivoGeneral: '\n\t' }),
    )
    expect(soloEspacios.porcentaje).toBe(0)
  })

  // Hallazgo K3 de AUDITORIA_FLUJOS_TI.md: un manual no tiene
  // procedimiento, así que antes se quedaba con "Agregar al menos un
  // paso" para siempre y un porcentaje que nunca llegaba a 100.
  describe('artículos de tipo manual', () => {
    it('no exige pasos, requisitos ni verificación final', () => {
      const manualVacio = calcularCompletitud(senalesDeArticulo({ ...VACIO, tipo: 'manual' }))
      const sugerencias = manualVacio.sugerencias.map((s) => s.texto)
      expect(sugerencias).not.toContain('Agregar al menos un paso')
      expect(sugerencias).not.toContain('Anotar los requisitos previos')
      expect(sugerencias).not.toContain('Escribir la verificación final')
      expect(manualVacio.pestanasPendientes.has('pasos')).toBe(false)
    })

    it('un manual puede llegar a 100 % sin ningún paso', () => {
      const manualCompleto = calcularCompletitud(
        senalesDeArticulo({
          ...VACIO,
          tipo: 'manual',
          titulo: 'Configurar VPN corporativa',
          descripcion: 'Cuando alguien trabaja remoto',
          cantidadEtiquetas: 2,
          tiempoEstimadoMin: '5',
          dificultad: 'principiante',
          objetivoGeneral: 'Dejar el acceso remoto funcionando',
          contenido: '## Pasos\n1. Abrir el cliente VPN\n2. Ingresar credenciales',
        }),
      )
      expect(manualCompleto.porcentaje).toBe(100)
    })

    it('puntúa el contenido en Markdown en vez del paso a paso', () => {
      const sinContenido = calcularCompletitud(senalesDeArticulo({ ...VACIO, tipo: 'manual' }))
      const conContenido = calcularCompletitud(
        senalesDeArticulo({ ...VACIO, tipo: 'manual', contenido: 'Texto del manual' }),
      )
      expect(conContenido.porcentaje).toBeGreaterThan(sinContenido.porcentaje)
      expect(sinContenido.sugerencias.map((s) => s.texto)).toContain('Escribir el contenido del manual')
      expect(conContenido.sugerencias.map((s) => s.texto)).not.toContain('Escribir el contenido del manual')
    })

    it('un artículo que no es manual sigue exigiendo pasos, no contenido', () => {
      const instalacionVacia = calcularCompletitud(senalesDeArticulo({ ...VACIO, tipo: 'instalacion' }))
      const sugerencias = instalacionVacia.sugerencias.map((s) => s.texto)
      expect(sugerencias).toContain('Agregar al menos un paso')
      expect(sugerencias).not.toContain('Escribir el contenido del manual')
    })
  })
})
