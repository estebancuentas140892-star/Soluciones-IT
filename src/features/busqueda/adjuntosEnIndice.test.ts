import { describe, expect, it } from 'vitest'
import type { Adjunto } from '../../lib/db'
import { datosBenchmark } from './benchmarkResolver'
import { buscar, crearIndiceDesdeDocumentos, documentosDeBusqueda, type DocumentoBusqueda } from './useIndiceBusqueda'

// UN MISMO ARCHIVO EN VARIAS FICHAS NO TUMBA RESOLVER (tarea 322).
//
// El índice nombraba cada adjunto por su referencia de Storage
// (`adjunto:<referencia>`). Con la deduplicación (tarea 123) y los
// vínculos de un documento con varios equipos (tarea 322), dos filas
// comparten referencia: MiniSearch recibía dos veces el mismo id, lanzaba
// "duplicate ID" y Resolver caía entero en "No se pudo cargar la
// aplicación". Todo lo sembrado es inventado.

// Solo los campos que el índice lee: la prueba no depende de las columnas
// de la tarea 322, así que el arreglo se puede llevar a `main` solo.
function acta(id: string, entidadId: string): Adjunto {
  return {
    id,
    entidadTipo: 'dispositivo',
    entidadId,
    nombre: 'acta-compartida-inventada.pdf',
    tipo: 'application/pdf',
    referencia: 'compartidos/hash-acta-compartida',
    updatedAt: '2026-10-13T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
  } as Adjunto
}

describe('adjuntos en el índice de búsqueda', () => {
  it('un acta vinculada a dos equipos entra dos veces, cada una con su equipo, sin romper el índice', () => {
    const datos = datosBenchmark(false)
    const [primero, segundo] = datos.dispositivos
    datos.adjuntos = [acta('a1', primero.id), acta('a2', segundo.id)]

    const documentos = documentosDeBusqueda(datos)
    const ids = documentos.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)

    const indice = crearIndiceDesdeDocumentos(documentos)
    const encontrados = buscar(indice, 'acta compartida inventada').filter((r) => r.tipo === 'adjunto')
    expect(encontrados.map((r) => r.subtitulo).sort()).toEqual([primero.nombre, segundo.nombre].sort())
  })

  it('un id repetido, venga de donde venga, no hace caer el índice: se queda el primero', () => {
    const doc = (titulo: string): DocumentoBusqueda => ({
      id: 'adjunto:repetido',
      tipo: 'adjunto',
      titulo,
      subtitulo: '',
      ruta: '/',
      texto: '',
    })
    const indice = crearIndiceDesdeDocumentos([doc('primero inventado'), doc('segundo inventado')])
    expect(buscar(indice, 'primero inventado').map((r) => r.titulo)).toContain('primero inventado')
    expect(buscar(indice, 'segundo inventado').map((r) => r.titulo)).not.toContain('segundo inventado')
  })
})
