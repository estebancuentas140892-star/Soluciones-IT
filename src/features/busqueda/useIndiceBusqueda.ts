import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import MiniSearch from 'minisearch'
import { db } from '../../lib/db'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'

export type TipoResultado = 'articulo' | 'dispositivo'

export interface DocumentoBusqueda {
  id: string
  tipo: TipoResultado
  titulo: string
  subtitulo: string
  ruta: string
  texto: string
}

export interface ResultadoBusqueda {
  id: string
  tipo: TipoResultado
  titulo: string
  subtitulo: string
  ruta: string
}

// Indice en memoria: se reconstruye cuando cambian los datos locales
// (creación, edición o sincronización). Con el tamaño de datos de un
// equipo de 5 técnicos esto es instantáneo.
export function useIndiceBusqueda(): MiniSearch<DocumentoBusqueda> {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  return useMemo(() => {
    const nombreCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]))

    const documentos: DocumentoBusqueda[] = []

    for (const articulo of articulos ?? []) {
      documentos.push({
        id: `articulo:${articulo.id}`,
        tipo: 'articulo',
        titulo: articulo.titulo,
        subtitulo: [nombreCategoria.get(articulo.categoriaId), etiquetaDeTipo(articulo.tipo)]
          .filter(Boolean)
          .join(' · '),
        ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
        texto: [articulo.titulo, articulo.contenido, articulo.etiquetas.join(' ')].join(' '),
      })
    }

    for (const dispositivo of dispositivos ?? []) {
      documentos.push({
        id: `dispositivo:${dispositivo.id}`,
        tipo: 'dispositivo',
        titulo: dispositivo.nombre,
        subtitulo: [dispositivo.marca, dispositivo.modelo, dispositivo.ubicacion].filter(Boolean).join(' · '),
        ruta: `/dispositivos/${dispositivo.id}`,
        texto: [
          dispositivo.nombre,
          dispositivo.marca,
          dispositivo.modelo,
          dispositivo.serial,
          dispositivo.placaInventario,
          dispositivo.ubicacion,
          dispositivo.ip,
          dispositivo.estado,
          dispositivo.observaciones,
        ].join(' '),
      })
    }

    return crearIndiceDesdeDocumentos(documentos)
  }, [articulos, dispositivos, categorias])
}

// Separado del hook para poder probarlo sin depender de React ni de
// la base local.
export function crearIndiceDesdeDocumentos(documentos: DocumentoBusqueda[]): MiniSearch<DocumentoBusqueda> {
  const indice = new MiniSearch<DocumentoBusqueda>({
    idField: 'id',
    fields: ['titulo', 'subtitulo', 'texto'],
    storeFields: ['tipo', 'titulo', 'subtitulo', 'ruta'],
    searchOptions: {
      boost: { titulo: 3, subtitulo: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  })
  indice.addAll(documentos)
  return indice
}

export function buscar(indice: MiniSearch<DocumentoBusqueda>, consulta: string): ResultadoBusqueda[] {
  const texto = consulta.trim()
  if (!texto) return []
  return indice.search(texto).map((resultado) => ({
    id: String(resultado.id),
    tipo: resultado.tipo as TipoResultado,
    titulo: resultado.titulo as string,
    subtitulo: resultado.subtitulo as string,
    ruta: resultado.ruta as string,
  }))
}
