import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import MiniSearch from 'minisearch'
import {
  db,
  type Adjunto,
  type Articulo,
  type CampoProtegido,
  type Categoria,
  type Credencial,
  type Diagnostico,
  type Dispositivo,
  type Persona,
  type Referencia,
  type Ubicacion,
} from '../../lib/db'
import { normalizarProcedimiento, textoDeProcedimiento } from '../../lib/procedimiento'
import { textoDeNodos } from '../../lib/diagnostico'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { sinonimosDe } from './sinonimos'
import { cadenaNombres, mapaPorId } from '../ubicaciones/arbol'
import { esTipoConocido, INFO_TIPO, textoBuscable, tituloConAbreviatura } from '../referencia/referencias'

export type TipoResultado =
  | 'articulo'
  | 'dispositivo'
  | 'credencial'
  | 'diagnostico'
  | 'categoria'
  | 'adjunto'
  | 'ubicacion'
  | 'persona'
  // Centro de consulta (2026-09-10, herramienta desde el 2026-09-14).
  // Son CUATRO tipos y no uno solo porque el resultado tiene que decir
  // de que clase es: buscar "mstsc" y que salga "Referencia" no dice si
  // es una palabra del glosario, algo que se teclea o un programa.
  | 'herramienta'
  | 'termino'
  | 'atajo'
  | 'comando'

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

/** Todo lo que alimenta el índice, tal como sale de la base local. */
export interface DatosIndice {
  articulos: Articulo[]
  dispositivos: Dispositivo[]
  categorias: Categoria[]
  ubicaciones: Ubicacion[]
  personas: Persona[]
  referencias: Referencia[]
  credenciales: Credencial[]
  diagnosticos: Diagnostico[]
  adjuntos: Adjunto[]
  camposProtegidos: CampoProtegido[]
  /** Sin la bóveda abierta en esta sesión, nada de la bóveda entra al índice. */
  bovedaDesbloqueada: boolean
}

// Indice en memoria: se reconstruye cuando cambian los datos locales
// (creación, edición o sincronización). Con el tamaño de datos de un
// equipo de 5 técnicos esto es instantáneo.
export function useIndiceBusqueda(): MiniSearch<DocumentoBusqueda> {
  const articulos = useLiveQuery(() => db.articulos.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const personas = useLiveQuery(() => db.personas.toArray(), [], [])
  const referencias = useLiveQuery(() => db.referencias.toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.toArray(), [], [])
  const diagnosticos = useLiveQuery(() => db.diagnosticos.toArray(), [], [])
  const adjuntos = useLiveQuery(() => db.adjuntos.toArray(), [], [])
  // Campos protegidos (grupo P1): solo llegan aqui si la RLS los
  // descargo, es decir si el perfil tiene permiso de boveda.
  const camposProtegidos = useLiveQuery(() => db.campos_protegidos.toArray(), [], [])
  const bovedaDesbloqueada = useBovedaDesbloqueada()

  return useMemo(
    () =>
      crearIndiceDesdeDocumentos(
        documentosDeBusqueda({
          articulos,
          dispositivos,
          categorias,
          ubicaciones,
          personas,
          referencias,
          credenciales,
          diagnosticos,
          adjuntos,
          camposProtegidos,
          bovedaDesbloqueada,
        }),
      ),
    [
      articulos,
      dispositivos,
      categorias,
      ubicaciones,
      personas,
      referencias,
      credenciales,
      diagnosticos,
      adjuntos,
      camposProtegidos,
      bovedaDesbloqueada,
    ],
  )
}

/**
 * Una ficha del Centro de consulta como documento del índice, o null si
 * no debe entrar (eliminada, o de un tipo que esta versión no conoce).
 *
 * El subtítulo empieza SIEMPRE por el tipo ("Herramienta · Acceso
 * remoto", "Atajo · Windows"): es lo que el resultado tiene que decir
 * sin abrirlo. El texto indexado es el mismo `textoBuscable` que usa la
 * pantalla del Centro de consulta, para que buscar dos veces lo mismo no
 * dé dos resultados distintos.
 */
export function documentoDeReferencia(referencia: Referencia): DocumentoBusqueda | null {
  if (referencia.eliminadoEn || !esTipoConocido(referencia.tipo)) return null
  // Sin repetir: un atajo de Windows con categoría "Windows" decía
  // "Atajo · Windows · Windows".
  const partes = [INFO_TIPO[referencia.tipo].etiqueta, referencia.plataforma, referencia.categoria].filter(Boolean)
  return {
    id: `referencia:${referencia.id}`,
    tipo: referencia.tipo,
    titulo: tituloConAbreviatura(referencia),
    subtitulo: [...new Set(partes)].join(' · '),
    ruta: `/referencia/${referencia.id}`,
    texto: textoBuscable(referencia),
    portadaRef: '',
  }
}

/**
 * Los documentos del índice global a partir de los datos locales.
 *
 * Separado del hook (2026-09-14) para poder PROBAR sin navegador las dos
 * garantías que el buscador no puede perder: que un borrador nunca sale
 * como procedimiento oficial y que nada de la bóveda entra sin la bóveda
 * abierta. Recibe las tablas enteras y filtra aquí, en un solo sitio.
 */
export function documentosDeBusqueda(datos: DatosIndice): DocumentoBusqueda[] {
  // Un borrador u obsoleto no aparece en el buscador global (grupo de
  // esquema, 2026-07-09): no es contenido oficial que se le deba
  // sugerir al resto del equipo. `?? 'publicado'` cubre las filas
  // guardadas antes de que existiera el campo.
  const articulos = datos.articulos.filter(
    (a) => !a.eliminadoEn && (a.estado ?? 'publicado') === 'publicado',
  )
  const dispositivos = datos.dispositivos.filter((d) => !d.eliminadoEn)
  // Ubicaciones (grupo N3, fase P3 punto 4 del encargo) y personas
  // (hallazgo T1): entidades propias indexables desde el buscador global.
  const ubicaciones = datos.ubicaciones.filter((u) => !u.eliminadoEn)
  const personas = datos.personas.filter((p) => !p.eliminadoEn)
  const diagnosticos = datos.diagnosticos.filter((d) => !d.eliminadoEn)
  // Adjuntos del articulo/dispositivo completo (fase N2, punto 2): la
  // galeria por paso de un procedimiento se indexa aparte, mas abajo,
  // porque vive inline en el JSON y no en esta tabla.
  const adjuntosTabla = datos.adjuntos.filter((a) => !a.eliminadoEn)

  const nombreCategoria = new Map(datos.categorias.map((c) => [c.id, c.nombre]))
  const nombreDispositivo = new Map(dispositivos.map((d) => [d.id, d.nombre]))

  const documentos: DocumentoBusqueda[] = []

  // Categorias como resultado propio (fase N2, punto 1): buscar
  // "impresoras" debe ofrecer la categoria ademas de sus articulos.
  for (const categoria of datos.categorias) {
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
  const porIdUbicacion = mapaPorId(ubicaciones)
  for (const ubicacion of ubicaciones) {
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

  // Personas como resultado propio (hallazgo T1): "¿quién es Juan
  // Pérez?" hoy solo se resolvía revisando cada dispositivo a mano.
  for (const persona of personas) {
    documentos.push({
      id: `persona:${persona.id}`,
      tipo: 'persona',
      titulo: persona.nombre,
      subtitulo: 'Persona',
      ruta: `/personas/${persona.id}`,
      texto: [persona.nombre, persona.notas].join(' '),
      portadaRef: '',
    })
  }

  // Centro de consulta: herramientas, glosario, atajos y comandos. Es
  // contenido general del equipo (misma RLS que categorias o articulos),
  // asi que entra al indice sin condiciones, a diferencia de la boveda.
  for (const referencia of datos.referencias) {
    const documento = documentoDeReferencia(referencia)
    if (documento) documentos.push(documento)
  }

  for (const articulo of articulos) {
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

  for (const dispositivo of dispositivos) {
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
        dispositivo.responsable,
        dispositivo.ip,
        dispositivo.estado,
        dispositivo.observaciones,
        // Propiedades personalizadas (fase Dis1, punto 9): un
        // tecnico que solo recuerda un dato propio del equipo
        // (por ejemplo el usuario asignado) tambien lo encuentra.
        ...Object.values(dispositivo.detalles ?? {}),
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
  // Tambien se omite el de un BORRADOR: su dueño no esta en el indice.
  const rutaArticulo = new Map(
    articulos.map((a) => [a.id, { titulo: a.titulo, ruta: `/soluciones/${a.categoriaId}/${a.id}` }]),
  )
  const rutaDispositivo = new Map(
    dispositivos.map((d) => [d.id, { titulo: d.nombre, ruta: `/dispositivos/${d.id}` }]),
  )
  for (const adjunto of adjuntosTabla) {
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
  for (const diagnostico of diagnosticos) {
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
  if (datos.bovedaDesbloqueada) {
    for (const credencial of datos.credenciales) {
      if (credencial.eliminadoEn) continue
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
    for (const campo of datos.camposProtegidos) {
      if (campo.eliminadoEn) continue
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

  return documentos
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
      // Por prefijo mientras se escribe ("impre" encuentra "impresora"),
      // salvo una letra suelta que ACOMPAÑA a otras palabras (2026-09-14).
      // En "windows r" la "r" es la tecla, no el comienzo de "router",
      // "red" y "respaldo": como prefijo traía media base de datos y el
      // atajo que se buscaba quedaba enterrado. Sola ("r"), se sigue
      // tratando como prefijo, que es lo que se espera al empezar a teclear.
      prefix: (termino: string, _indice: number, terminos: string[]) =>
        termino.length > 1 || terminos.length === 1,
    },
  })
  indice.addAll(documentos)
  return indice
}

type ResultadoIndice = ReturnType<MiniSearch<DocumentoBusqueda>['search']>[number]

// Cuánto suma un sinónimo a un resultado que YA coincide con lo escrito:
// desempata a favor de lo que además nombra el sinónimo, sin pasar por
// delante de nada.
const PESO_SINONIMO = 0.5

/**
 * Busca lo escrito y, aparte, sus sinónimos (2026-09-15).
 *
 * LO ESCRITO MANDA. Van primero los documentos que coinciden con lo que
 * el técnico tecleó (exacto, por prefijo o con una errata), ordenados por
 * su puntuación más medio punto por sinónimo; y detrás, los que SOLO
 * trae un sinónimo, en su propio orden. Antes la expansión viajaba en la
 * misma consulta con el mismo peso, así que "Crear copia de seguridad"
 * (dos palabras del sinónimo en el título) adelantaba a "Backup del
 * servidor" buscando "backup". Los sinónimos siguen sumando resultados;
 * lo que ya no pueden es tapar lo que se buscó.
 */
export function buscarConSinonimos(indice: MiniSearch<DocumentoBusqueda>, consulta: string): ResultadoIndice[] {
  const texto = consulta.trim()
  if (!texto) return []
  const directos = indice.search(texto)
  const agregadas = sinonimosDe(texto)
  if (agregadas.length === 0) return directos

  const porSinonimo = indice.search(agregadas.join(' '))
  const deSinonimo = new Map(porSinonimo.map((resultado) => [resultado.id, resultado]))
  const primeros = directos
    .map((resultado) => {
      const extra = deSinonimo.get(resultado.id)
      if (!extra) return resultado
      return {
        ...resultado,
        score: resultado.score + PESO_SINONIMO * extra.score,
        terms: [...new Set([...resultado.terms, ...extra.terms])],
        queryTerms: [...new Set([...resultado.queryTerms, ...extra.queryTerms])],
        match: { ...extra.match, ...resultado.match },
      }
    })
    .sort((a, b) => b.score - a.score)
  const idsDirectos = new Set(directos.map((resultado) => resultado.id))
  return [...primeros, ...porSinonimo.filter((resultado) => !idsDirectos.has(resultado.id))]
}

function aResultado(resultado: ResultadoIndice): ResultadoBusqueda {
  return {
    id: String(resultado.id),
    tipo: resultado.tipo as TipoResultado,
    titulo: resultado.titulo as string,
    subtitulo: resultado.subtitulo as string,
    ruta: resultado.ruta as string,
    portadaRef: (resultado.portadaRef as string) ?? '',
  }
}

export function buscar(indice: MiniSearch<DocumentoBusqueda>, consulta: string): ResultadoBusqueda[] {
  // La consulta se amplía con sinónimos ("backup" agrega "respaldo",
  // "copia", "seguridad"), que solo AGREGAN resultados y nunca adelantan
  // a lo escrito (`buscarConSinonimos`).
  return buscarConSinonimos(indice, consulta).map(aResultado)
}

// Entradas con titulo parecido al texto dado, para avisar antes de
// crear una duplicada ("Ya existe 'Conectar impresora'... ¿abrirlo en
// lugar de crear una nueva?"). Solo cuenta las coincidencias en el
// TITULO (no en el contenido): es lo que define que dos entradas
// traten de lo mismo. `tipos` acota que tipos de resultado cuentan
// (hallazgo K5 de AUDITORIA_FLUJOS_TI.md: un `problema_frecuente` y un
// `diagnostico` del mismo problema son dos entradas al mismo
// conocimiento, y el aviso de duplicado solo cruzaba articulos con
// articulos). Devuelve como maximo `limite` resultados.
export function buscarSimilares(
  indice: MiniSearch<DocumentoBusqueda>,
  titulo: string,
  excluirId: string,
  tipos: TipoResultado[],
  limite = 3,
): ResultadoBusqueda[] {
  const texto = titulo.trim()
  if (texto.length < 4) return []
  // Mismo orden que el buscador: el título exacto antes que el parecido
  // solo por sinónimo, que es justo el que menos probablemente sea el
  // duplicado.
  return buscarConSinonimos(indice, texto)
    .filter(
      (resultado) =>
        tipos.includes(resultado.tipo as TipoResultado) &&
        // El id propio se excluye por su tipo real (no cualquier
        // articulo/diagnostico que comparta el mismo uuid al azar):
        // un articulo y un diagnostico nunca comparten espacio de ids.
        String(resultado.id) !== `${resultado.tipo}:${excluirId}` &&
        // `match` mapea cada termino encontrado a los campos donde
        // aparecio: exigir el titulo descarta coincidencias que solo
        // estan en el cuerpo de la entrada.
        Object.values(resultado.match).some((campos) => campos.includes('titulo')),
    )
    .slice(0, limite)
    .map(aResultado)
}

export function buscarArticulosSimilares(
  indice: MiniSearch<DocumentoBusqueda>,
  titulo: string,
  excluirArticuloId: string,
  limite = 3,
): ResultadoBusqueda[] {
  return buscarSimilares(indice, titulo, excluirArticuloId, ['articulo'], limite)
}
