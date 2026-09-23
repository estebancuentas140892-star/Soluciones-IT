import { describe, expect, it } from 'vitest'
import type { ResumenPaso } from './estadoPasos'
import { descripcionDeNodo, etiquetaDeRuta, vecinosDeRuta } from './rutaVisual'

// La ruta del procedimiento (encargo del 2026-09-22, sección 5).

describe('etiquetaDeRuta', () => {
  it('se queda con el destino cuando el título empieza por un verbo de navegación', () => {
    expect(etiquetaDeRuta('Abrir el navegador')).toBe('Navegador')
    expect(etiquetaDeRuta('Entrar a 10.10.1.8/intranet')).toBe('10.10.1.8/intranet')
    expect(etiquetaDeRuta('Seleccionar SGC')).toBe('SGC')
    expect(etiquetaDeRuta('Ir a Documentación')).toBe('Documentación')
    expect(etiquetaDeRuta('Hacer clic en Proceso de apoyo')).toBe('Proceso de apoyo')
    expect(etiquetaDeRuta('Abre Gestión de las Tecnologías de la Información')).toBe(
      'Gestión de las Tecnologías de la Información',
    )
    expect(etiquetaDeRuta('Haz clic en la pestaña Impresoras')).toBe('Pestaña Impresoras')
    expect(etiquetaDeRuta('Ingresar al administrador del POS')).toBe('Administrador del POS')
  })

  it('reconoce el verbo con tilde o sin ella y en mayúsculas', () => {
    expect(etiquetaDeRuta('ABRIR Ejecutar')).toBe('Ejecutar')
    expect(etiquetaDeRuta('Acceder a Configuración')).toBe('Configuración')
  })

  it('deja entero lo que no es navegar: el verbo dice qué pasa en ese paso', () => {
    expect(etiquetaDeRuta('Verificar que imprime')).toBe('Verificar que imprime')
    expect(etiquetaDeRuta('Configurar Carta y Oficio')).toBe('Configurar Carta y Oficio')
    expect(etiquetaDeRuta('Instalar el controlador')).toBe('Instalar el controlador')
  })

  it('no confunde un verbo con el principio de otra palabra', () => {
    expect(etiquetaDeRuta('Abrirse paso')).toBe('Abrirse paso')
    expect(etiquetaDeRuta('Irradiar la zona')).toBe('Irradiar la zona')
  })

  it('si al quitar el verbo no queda nada, se queda el título', () => {
    expect(etiquetaDeRuta('Abrir')).toBe('Abrir')
    expect(etiquetaDeRuta('Ir a')).toBe('Ir a')
  })

  it('quita la puntuación final y los espacios', () => {
    expect(etiquetaDeRuta('  Abrir Ejecutar.  ')).toBe('Ejecutar')
    expect(etiquetaDeRuta('')).toBe('')
  })
})

function resumen(indice: number, estado: ResumenPaso['estado'], tieneCuidado = false): ResumenPaso {
  return { id: `p${indice}`, indice, titulo: `Paso ${indice + 1}`, estado, tareas: 1, tareasHechas: 0, tieneCuidado }
}

describe('vecinosDeRuta', () => {
  const resumenes = [resumen(0, 'hecho'), resumen(1, 'actual'), resumen(2, 'pendiente')]

  it('devuelve el anterior, el actual y el siguiente', () => {
    const { previo, actual, siguiente } = vecinosDeRuta(resumenes, 1)
    expect([previo?.id, actual?.id, siguiente?.id]).toEqual(['p0', 'p1', 'p2'])
  })

  it('en los extremos no inventa vecinos', () => {
    expect(vecinosDeRuta(resumenes, 0).previo).toBeNull()
    expect(vecinosDeRuta(resumenes, 2).siguiente).toBeNull()
  })
})

describe('descripcionDeNodo', () => {
  it('dice posición, nombre, estado y si hay un riesgo', () => {
    expect(descripcionDeNodo(resumen(1, 'actual', true), 7)).toBe(
      'Paso 2 de 7: Paso 2 (estás aquí, con un riesgo que atender)',
    )
    expect(descripcionDeNodo(resumen(0, 'hecho'), 7)).toBe('Paso 1 de 7: Paso 1 (hecho)')
  })
})
