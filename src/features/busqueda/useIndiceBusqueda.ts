import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import MiniSearch from 'minisearch'
import { db } from '../../lib/db'
import { normalizarProcedimiento, textoDeProcedimiento } from '../../lib/procedimiento'
import { textoDeNodos } from '../../lib/diagnostico'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { expandirConsulta } from './sinonimos'
import { cadenaNombres, mapaPorId } from '../ubicaciones/arbol'

export type TipoResultado =
  | 'articulo'
  | 'dispositivo'
  | 'credencial'
  | 'diagnostico'
  | 'categoria'
  | 'adjunto'
  | 'ubicacion'

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
  // Ubicaciones (grupo N3, fase P3 punto 4 del encargo): hoy faltaban
  // del buscador global pese a ser una entidad propia desde hace tiempo.
  const ubicaciones = useLiveQuery(() => db.ubicaciones.filter((u) => !u.eliminadoEn).toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  // Adjuntos del articulo/dispositivo completo (fase N2, punto 2): la
  // galeria por paso de un procedimiento se indexa aparte, mas abajo,
  // porque vive inline en el JSON y no en esta tabla.
  const adjuntosTabla = useLiveQuery(() => db.adjuntos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  // Campos protegidos (grupo P1): solo llegan aqui si la RLS los
  // descargo, es decir si el perfil tiene permiso de boveda.
  const camposProtegidos = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )
  const bovedaDesbloqueada = useBovedaDesbloqueada()

  return useMemo(() => {
    const nombreCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]))
    const nombreDispositivo = new Map((dispositivos ?? []).map((d) => [d.id, d.nombre]))

    const documentos: DocumentoBusqueda[] = []

    // Categorias como resultado propio (fase N2, punto 1): buscar
    // "impresoras" debe ofrecer la categoria ademas de sus articulos.
    for (const categoria of categorias ?? []) {
      if (categoria.eliminadoEn) continue
      documentos.push({
        id: `categoria:${categoria.id}`,
        tipo: 'categoria',
        titulo: categoria.nombre,
        subtitulo: 'Categoría',
        ruta: `/soluciones/${categoria.id}`,
        texto: categoria.nombre,
        portadaRef: '',
      })
    }

    // Ubicaciones como resultado propio (fase P3, punto 4 del encargo de
    // PROPUESTA_SEGURIDAD_DISPOSITIVO.md): "¿dónde está la sala de
    // servidores?" hoy solo se resolvía revisando cada dispositivo. El
    // subtítulo muestra la ruta jerárquica completa (Sede Norte > Área
    // caja) salvo el propio nombre, para dar contexto sin repetirlo.
    const porIdUbicacion = mapaPorId(ubicaciones ?? [])
    for (const ubicacion of ubicaciones ?? []) {
      const ruta = cadenaNombres(ubicacion.id, porIdUbicacion)
      documentos.push({
        id: `ubicacion:${ubicacion.id}`,
        tipo: 'ubicacion',
        titulo: ubicacion.nombre,
        subtitulo: ruta.slice(0, -1).join(' > ') || 'Ubicación',
        ruta: `/ubicaciones/${ubicacion.id}`,
        texto: [ubicacion.nombre, ubicacion.notas].join(' '),
        portadaRef: '',
      })
    }

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

      // Galeria de adjuntos de cada paso (fase N2, punto 2): un manual
      // o una captura se encuentra hoy solo si el texto del articulo
      // los menciona; con esto "manual_zebra.pdf" tambien aparece,
      // apuntando al articulo que lo contiene (no hay ancla por paso
      // en la ficha, asi que la ruta es la del articulo completo).
      ;(procedimiento?.pasos ?? []).forEach((paso, indice) => {
        for (const adjunto of paso.adjuntos) {
          documentos.push({
            id: `adjunto:${adjunto.referencia}`,
            tipo: 'adjunto',
            titulo: adjunto.nombre,
            subtitulo: `${articulo.titulo} · ${paso.titulo || `Paso ${indice + 1}`}`,
            ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
            texto: adjunto.nombre,
            portadaRef: adjunto.tipo.startsWith('image/') ? adjunto.referencia : '',
          })
        }
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

    // Adjuntos del articulo o dispositivo completo (fase N2, punto 2):
    // manuales y PDF que hoy solo se encontraban si el texto del
    // articulo los mencionaba. El dueno puede haberse eliminado sin
    // que el adjunto lo refleje todavia (offline); se omite en ese caso.
    const rutaArticulo = new Map(
      (articulos ?? []).map((a) => [a.id, { titulo: a.titulo, ruta: `/soluciones/${a.categoriaId}/${a.id}` }]),
    )
    const rutaDispositivo = new Map(
      (dispositivos ?? []).map((d) => [d.id, { titulo: d.nombre, ruta: `/dispositivos/${d.id}` }]),
    )
    for (const adjunto of adjuntosTabla ?? []) {
      const dueno =
        adjunto.entidadTipo === 'articulo'
          ? rutaArticulo.get(adjunto.entidadId)
          : adjunto.entidadTipo === 'dispositivo'
            ? rutaDispositivo.get(adjunto.entidadId)
            : undefined
      if (!dueno) continue
      documentos.push({
        id: `adjunto:${adjunto.referencia}`,
        tipo: 'adjunto',
        titulo: adjunto.nombre,
        subtitulo: dueno.titulo,
        ruta: dueno.ruta,
        texto: adjunto.nombre,
        portadaRef: adjunto.tipo.startsWith('image/') ? adjunto.referencia : '',
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
    // unicamente por titulo, categoria y el NOMBRE del archivo seguro
    // (fase P5, nunca su contenido, que ni siquiera esta descifrado
    // aqui): el contenido cifrado de las credenciales nunca se indexa.
    if (bovedaDesbloqueada) {
      for (const credencial of credenciales ?? []) {
        documentos.push({
          id: `credencial:${credencial.id}`,
          tipo: 'credencial',
          titulo: credencial.titulo,
          subtitulo: credencial.categoria,
          ruta: `/boveda/${credencial.id}`,
          // NUNCA portadaRef: credencial.archivo?.referencia, aunque el
          // tipo MIME sea imagen. Esa referencia apunta al bucket
          // cifrado (archivos_boveda) y no se puede renderizar directo
          // como <img>, a diferencia de los adjuntos normales.
          texto: [credencial.titulo, credencial.archivo?.nombre ?? ''].join(' '),
          portadaRef: '',
        })
      }

      // Campos protegidos de un equipo (grupo P1): se indexa el NOMBRE
      // del dato y el equipo al que pertenece, JAMAS su valor (que ni
      // siquiera esta descifrado aqui). Sirve para "¿dónde está el PIN
      // de la impresora?"; el resultado lleva a la ficha del equipo,
      // que es donde el dato se consulta con su propia auditoria.
      // Igual que las credenciales, solo con la boveda abierta; y sin
      // permiso de boveda la RLS ni siquiera descarga estas filas.
      for (const campo of camposProtegidos ?? []) {
        const equipo = campo.dispositivoId ? nombreDispositivo.get(campo.dispositivoId) : null
        if (!equipo) continue
        documentos.push({
          id: `campo:${campo.id}`,
          tipo: 'dispositivo',
          titulo: `${campo.nombre} · ${equipo}`,
          subtitulo: 'Dato protegido del equipo',
          ruta: `/dispositivos/${campo.dispositivoId}`,
          texto: `${campo.nombre} ${equipo}`,
          portadaRef: '',
        })
      }
    }

    return crearIndiceDesdeDocumentos(documentos)
  }, [
    articulos,
    dispositivos,
    categorias,
    ubicaciones,
    credenciales,
    diagnosticos,
    adjuntosTabla,
    camposProtegidos,
    bovedaDesbloqueada,
  ])
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
