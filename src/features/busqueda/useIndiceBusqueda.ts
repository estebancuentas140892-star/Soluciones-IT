import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import MiniSearch from 'minisearch'
import { db } from '../../lib/db'
import { normalizarProcedimiento, textoDeProcedimiento } from '../../lib/procedimiento'
import { textoDeNodos } from '../../lib/diagnostico'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { expandirConsulta } from './sinonimos'

export type TipoResultado = 'articulo' | 'dispositivo' | 'credencial' | 'diagnostico'

export interface DocumentoBusqueda {
  id: string
  tipo: TipoResultado
  titulo: string
  subtitulo: string
  ruta: string
  texto: string
  // Referencia de Storage de la imagen de portada del procedimiento
  // (opcional, '' si no tiene): permite mostrar la miniatura en los
  // resultados sin volver a consultar la base local.
  portadaRef?: string
}

export interface ResultadoBusqueda {
  id: string
  tipo: TipoResultado
  titulo: string
  subtitulo: string
  ruta: string
  portadaRef: string
}

// Indice en memoria: se reconstruye cuando cambian los datos locales
// (creación, edición o sincronización). Con el tamaño de datos de un
// equipo de 5 técnicos esto es instantáneo.
export function useIndiceBusqueda(): MiniSearch<DocumentoBusqueda> {
  // Un borrador u obsoleto no aparece en el buscador global (grupo de
  // esquema, 2026-07-09): no es contenido oficial que se le deba
  // sugerir al resto del equipo. `?? 'publicado'` cubre las filas
  // guardadas antes de que existiera el campo.
  const articulos = useLiveQuery(
    () => db.articulos.filter((a) => !a.eliminadoEn && (a.estado ?? 'publicado') === 'publicado').toArray(),
    [],
    [],
  )
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const bovedaDesbloqueada = useBovedaDesbloqueada()

  return useMemo(() => {
    const nombreCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]))

    const documentos: DocumentoBusqueda[] = []

    for (const articulo of articulos ?? []) {
      const procedimiento = normalizarProcedimiento(articulo.procedimiento)
      documentos.push({
        id: `articulo:${articulo.id}`,
        tipo: 'articulo',
        titulo: articulo.titulo,
        subtitulo: [nombreCategoria.get(articulo.categoriaId), etiquetaDeTipo(articulo.tipo)]
          .filter(Boolean)
          .join(' · '),
        ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
        texto: [
          articulo.titulo,
          articulo.contenido,
          textoDeProcedimiento(procedimiento),
          // Etiquetas reactivadas el 2026-07-09 (fase S1): vuelven a
          // alimentar el indice para mejorar los resultados.
          ...(articulo.etiquetas ?? []),
          ...(articulo.sintomas ?? []),
          ...(articulo.causas ?? []),
          ...(articulo.dispositivosAfectados ?? []).map((d) => d.nombre),
        ].join(' '),
        portadaRef: procedimiento?.portada?.referencia ?? '',
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
          // Propiedades personalizadas (fase Dis1, punto 9): un
          // tecnico que solo recuerda un dato propio del equipo
          // (por ejemplo el usuario asignado) tambien lo encuentra.
          ...Object.values(dispositivo.detalles),
        ].join(' '),
        // Fotografia principal (fase Dis2): identifica el equipo de
        // un vistazo en los resultados, igual que la portada de un
        // procedimiento.
        portadaRef: dispositivo.foto?.referencia ?? '',
      })
    }

    // Los diagnosticos se encuentran por el problema ("la impresora
    // no imprime"), por sus preguntas o por sus respuestas.
    for (const diagnostico of diagnosticos ?? []) {
      documentos.push({
        id: `diagnostico:${diagnostico.id}`,
        tipo: 'diagnostico',
        titulo: diagnostico.titulo,
        subtitulo: [nombreCategoria.get(diagnostico.categoriaId), 'Diagnóstico'].filter(Boolean).join(' · '),
        ruta: `/diagnostico/${diagnostico.id}`,
        texto: [diagnostico.titulo, diagnostico.descripcion, textoDeNodos(diagnostico.nodos ?? [])].join(' '),
        portadaRef: '',
      })
    }

    // La boveda solo entra al indice cuando esta desbloqueada, y
    // unicamente por titulo y categoria: el contenido cifrado de las
    // credenciales nunca se indexa.
    if (bovedaDesbloqueada) {
      for (const credencial of credenciales ?? []) {
        documentos.push({
          id: `credencial:${credencial.id}`,
          tipo: 'credencial',
          titulo: credencial.titulo,
          subtitulo: credencial.categoria,
          ruta: `/boveda/${credencial.id}`,
          texto: credencial.titulo,
          portadaRef: '',
        })
      }
    }

    return crearIndiceDesdeDocumentos(documentos)
  }, [articulos, dispositivos, categorias, credenciales, diagnosticos, bovedaDesbloqueada])
}

// Separado del hook para poder probarlo sin depender de React ni de
// la base local.
export function crearIndiceDesdeDocumentos(documentos: DocumentoBusqueda[]): MiniSearch<DocumentoBusqueda> {
  const indice = new MiniSearch<DocumentoBusqueda>({
    idField: 'id',
    fields: ['titulo', 'subtitulo', 'texto'],
    storeFields: ['tipo', 'titulo', 'subtitulo', 'ruta', 'portadaRef'],
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
  // La consulta se expande con sinonimos ("backup" agrega "respaldo",
  // "copia", "seguridad"). MiniSearch combina los terminos con OR, asi
  // que la expansion solo AGREGA resultados.
  return indice.search(expandirConsulta(texto)).map((resultado) => ({
    id: String(resultado.id),
    tipo: resultado.tipo as TipoResultado,
    titulo: resultado.titulo as string,
    subtitulo: resultado.subtitulo as string,
    ruta: resultado.ruta as string,
    portadaRef: (resultado.portadaRef as string) ?? '',
  }))
}

// Articulos con titulo parecido al texto dado, para avisar antes de
// crear un duplicado ("Ya existe 'Conectar impresora'... ¿abrirlo en
// lugar de crear uno nuevo?"). Solo cuenta las coincidencias en el
// TITULO (no en el contenido): es lo que define que dos articulos
// traten de lo mismo. Devuelve como maximo `limite` resultados.
export function buscarArticulosSimilares(
  indice: MiniSearch<DocumentoBusqueda>,
  titulo: string,
  excluirArticuloId: string,
  limite = 3,
): ResultadoBusqueda[] {
  const texto = titulo.trim()
  if (texto.length < 4) return []
  return indice
    .search(expandirConsulta(texto))
    .filter(
      (resultado) =>
        resultado.tipo === 'articulo' &&
        String(resultado.id) !== `articulo:${excluirArticuloId}` &&
        // `match` mapea cada termino encontrado a los campos donde
        // aparecio: exigir el titulo descarta coincidencias que solo
        // estan en el cuerpo del articulo.
        Object.values(resultado.match).some((campos) => campos.includes('titulo')),
    )
    .slice(0, limite)
    .map((resultado) => ({
      id: String(resultado.id),
      tipo: resultado.tipo as TipoResultado,
      titulo: resultado.titulo as string,
      subtitulo: resultado.subtitulo as string,
      ruta: resultado.ruta as string,
      portadaRef: (resultado.portadaRef as string) ?? '',
    }))
}
