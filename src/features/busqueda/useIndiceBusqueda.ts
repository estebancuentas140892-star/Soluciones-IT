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
import { ROTULO_RECORRIDO, textoDeNodos } from '../../lib/diagnostico'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { textoVivo } from '../../lib/referencia'
import {
  distanciaDamerau,
  distanciaLevenshtein,
  esAproximable,
  esSoloLetras,
  palabrasLiterales,
  terminosDe,
  toleranciaDe,
} from '../../lib/coincidenciaAproximada'
import { FRACCION_DIFUSA, palabrasDeContenido, usaPrefijo } from './consultaNatural'
import { sinonimosDe, sinonimosPorPalabra } from './sinonimos'
import { cadenaNombres, mapaPorId } from '../ubicaciones/arbol'
import { lineasDeContexto, ubicacionDeEquipo } from '../../lib/contextoEquipo'
import { esTipoConocido, INFO_TIPO, tituloConAbreviatura } from '../referencia/referencias'

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

/**
 * LOS CAMPOS DEL ÍNDICE, CADA UNO CON SU SIGNIFICADO (tarea 288, fase 2).
 *
 * Hasta la tarea 288 eran tres (`titulo`, `subtitulo` y `texto`) y casi
 * todo iba revuelto en `texto`: la descripción de "cuándo usar" una guía,
 * sus síntomas, la IP y el serial de un equipo, una palabra suelta de un
 * paso. El buscador encontraba igual, pero no podía saber POR QUÉ
 * coincidía un resultado, y no es lo mismo que "no imprime" esté en los
 * síntomas de una guía que en el paso 7 de otra.
 *
 * - `titulo`: el nombre canónico.
 * - `subtitulo`: el contexto que se ve bajo el nombre (categoría y tipo,
 *   marca y lugar de un equipo, la ruta de una ubicación).
 * - `formasBusqueda`: cómo lo buscaría una persona que no sabe su nombre
 *   (campo editorial de las guías, fase 5).
 * - `sintomas`: qué ocurre (los síntomas de un problema frecuente).
 * - `cuandoUsar`: cuándo corresponde usarlo (la descripción del
 *   procedimiento; la de una guía con preguntas; el "cuándo usar" de un
 *   comando, un atajo o una herramienta).
 * - `identidad`: con qué se identifica. De un equipo: marca, modelo,
 *   serial, placa, IP, lugar y responsable. De un comando o un atajo: lo
 *   que se teclea. De una ficha: sus otros nombres. De una credencial: los
 *   equipos a los que da acceso. Nunca un valor protegido.
 * - `texto`: el contenido general. Sigue encontrando, con menos autoridad.
 *
 * Cada dato vive en UN campo: separarlos no duplica nada.
 */
export type CampoIndice =
  | 'titulo'
  | 'subtitulo'
  | 'formasBusqueda'
  | 'sintomas'
  | 'cuandoUsar'
  | 'identidad'
  | 'texto'

export const CAMPOS_INDICE: readonly CampoIndice[] = [
  'titulo',
  'subtitulo',
  'formasBusqueda',
  'sintomas',
  'cuandoUsar',
  'identidad',
  'texto',
]

export interface DocumentoBusqueda {
  id: string
  tipo: TipoResultado
  titulo: string
  subtitulo: string
  ruta: string
  /** Las frases de "¿Cómo buscaría alguien esta guía?", una por línea. */
  formasBusqueda?: string
  sintomas?: string
  cuandoUsar?: string
  identidad?: string
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
  /**
   * Este resultado NO coincide con lo que el tecnico escribio: lo trajo
   * un sinonimo (2026-09-15, tarea 241). El orden de `buscar` ya lo dice
   * (los directos van primero), pero `mejoresResultados` reordena por
   * relevancia operativa y necesita el dato explicito para no dejar que
   * un sinonimo adelante a una coincidencia directa (seccion 14 del
   * encargo). Ausente equivale a false.
   */
  soloSinonimo?: boolean
  // METADATA MÍNIMA DE LA COINCIDENCIA (tarea 288, fase 3). MiniSearch ya
  // sabe en qué campos coincidió cada término y `buscar` lo descartaba.
  // Se conserva solo lo que el ranking necesita: CAMPOS y PUNTAJE. Nunca
  // la consulta, ni las palabras, ni los términos del documento; no se
  // guarda en ninguna parte (vive lo que vive la lista) ni se mide. Los
  // tres faltan en un resultado armado a mano (pruebas antiguas); el
  // ranking lo tolera.
  /** Los campos donde coincidió lo escrito (sin contar los sinónimos). */
  camposCoincidentes?: CampoIndice[]
  /**
   * Para cada palabra que dice algo de la consulta (`palabrasDeContenido`,
   * en el mismo orden), los campos donde coincidió ella misma: [] si no
   * coincidió. Es lo que permite medir cuánto de la consulta explica un
   * resultado y con qué autoridad.
   */
  camposPorPalabra?: CampoIndice[][]
  /** Igual, pero por un sinónimo de esa palabra ("backup" por "respaldo"). */
  camposPorSinonimo?: CampoIndice[][]
  /** Puntaje de MiniSearch: BM25 con el peso de cada campo. */
  puntajeIndice?: number
  /**
   * COINCIDENCIA APROXIMADA (tarea 346). Para cada palabra de
   * `camposPorPalabra`, true si este resultado la explica SOLO con una
   * errata ("impresra" por "impresora", "gracia" por "garcia"), nunca tal
   * como se escribió. Falta en un resultado armado a mano.
   */
  aproximadoPorPalabra?: boolean[]
  /**
   * Alguna palabra solo coincide de forma aproximada: el resultado se
   * presenta como "Posible coincidencia" y nunca como la mejor.
   */
  aproximado?: boolean
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
  // La bóveda solo cuenta como abierta para el índice con el PERMISO del
  // perfil (encargo del 2026-09-16, caso J). Sin permiso la RLS ya no
  // descarga nada y la interfaz no deja desbloquear; esto cubre además
  // las filas que pudieran quedar en el teléfono de antes de retirarlo.
  const perfil = usePerfilVivo()
  const bovedaDesbloqueada = useBovedaDesbloqueada() && Boolean(perfil?.puedeVerBoveda)

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
 * sin abrirlo. Lo indexado son exactamente las palabras del mismo
 * `textoBuscable` que usa la pantalla del Centro de consulta (buscar dos
 * veces lo mismo no puede dar dos resultados distintos), repartidas
 * desde la tarea 288 por lo que significan: lo que se teclea y los otros
 * nombres son su identidad, y el "cuándo usar" es su cuándo usar.
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
    // "ping [dirección]" o "Windows + R" ES el comando o el atajo; los
    // alias ("AP", "punto de acceso") son la misma ficha con otro nombre.
    identidad: unidos([referencia.valor, ...(referencia.alias ?? [])]),
    cuandoUsar: unidos([referencia.cuandoUsar]),
    texto: [
      referencia.definicion,
      referencia.plataforma,
      referencia.resultadoEsperado,
      referencia.proveedor,
      referencia.usoEnMetroparques,
      referencia.notas,
      ...(referencia.etiquetas ?? []),
    ]
      .filter(Boolean)
      .join(' '),
    portadaRef: '',
  }
}

/**
 * La identidad de un equipo en el índice (tarea 288): todo lo que lo
 * identifica salvo el nombre, que ya es el título. El serial, la placa y
 * la IP llevan su rótulo ("serial ABC123", "placa 456", "ip 10.10.6.8")
 * porque así los pide el técnico, y "serial ABC123" tiene que explicarse
 * entero con ESTE equipo, no a medias. Un rótulo solo se escribe si hay
 * valor. Los datos protegidos del equipo no entran aquí: viven cifrados en
 * `campos_protegidos`.
 */
function identidadDeEquipo(dispositivo: Dispositivo, lugarVivo: string, responsableVivo: string): string | undefined {
  return unidos([
    dispositivo.marca,
    dispositivo.modelo,
    dispositivo.serial ? `serial ${dispositivo.serial}` : '',
    dispositivo.placaInventario ? `placa ${dispositivo.placaInventario}` : '',
    dispositivo.ip ? `ip ${dispositivo.ip}` : '',
    // El lugar vivo de su ficha de Ubicación y el texto heredado, sin
    // repetirlo cuando coinciden (tarea 277).
    ...new Set([dispositivo.ubicacion, lugarVivo]),
    // Quién lo tiene: el nombre VIGENTE de la persona vinculada (tarea 346),
    // no la copia legible que guardó el equipo; sin persona vinculada, lo
    // escrito (por validar), como siempre.
    responsableVivo,
  ])
}

// Un campo opcional del índice: el texto, o nada si no hay texto. Un
// campo vacío no se indexa (MiniSearch se lo salta), y así no cuenta como
// un campo de una palabra al medir longitudes.
function unidos(partes: (string | null | undefined)[], separador = ' '): string | undefined {
  const texto = partes
    .map((parte) => (parte ?? '').trim())
    .filter(Boolean)
    .join(separador)
  return texto === '' ? undefined : texto
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
      // El nombre ya es el título (tarea 288: cada dato en un campo).
      texto: '',
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
      texto: ubicacion.notas ?? '',
      portadaRef: '',
    })
  }

  // Personas como resultado propio (hallazgo T1): "¿quién es Juan
  // Pérez?" hoy solo se resolvía revisando cada dispositivo a mano. Una
  // persona retirada sigue apareciendo (su ficha y su historial se
  // conservan, tarea 266), pero lo dice antes de abrirla.
  for (const persona of personas) {
    documentos.push({
      id: `persona:${persona.id}`,
      tipo: 'persona',
      titulo: persona.nombre,
      subtitulo: persona.estado === 'retirada' ? 'Persona · Retirada' : 'Persona',
      ruta: `/personas/${persona.id}`,
      texto: persona.notas ?? '',
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
      // Cada parte de la guía en el campo que dice lo que es (tarea 288).
      // Una frase por línea: el salto separa las frases sin pegar la
      // última palabra de una con la primera de la siguiente.
      formasBusqueda: unidos(procedimiento?.formasBusqueda ?? [], '\n'),
      sintomas: unidos(articulo.sintomas ?? [], '\n'),
      // "¿Cuándo usar este procedimiento?": ya entraba al índice dentro de
      // `textoDeProcedimiento`; ahora va aparte, no además.
      cuandoUsar: unidos([procedimiento?.descripcion]),
      texto: [
        articulo.contenido,
        textoDeProcedimiento(procedimiento),
        // Etiquetas reactivadas el 2026-07-09 (fase S1): vuelven a
        // alimentar el indice para mejorar los resultados.
        ...(articulo.etiquetas ?? []),
        ...(articulo.causas ?? []),
        // Los equipos donde aplica: contexto de la guía, no su identidad.
        ...(articulo.dispositivosAfectados ?? []).map((d) => d.nombre),
      ]
        .filter(Boolean)
        .join(' '),
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
          // Por articulo y paso: el mismo archivo (misma referencia, tarea
          // 123) puede estar en dos guias o en una ficha (tarea 322).
          id: `adjunto:${articulo.id}:${indice}:${adjunto.referencia}`,
          tipo: 'adjunto',
          titulo: adjunto.nombre,
          subtitulo: `${articulo.titulo} · ${paso.titulo || `Paso ${indice + 1}`}`,
          ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
          texto: '',
          portadaRef: adjunto.tipo.startsWith('image/') ? adjunto.referencia : '',
        })
      }
    })
  }

  // Un equipo lleva debajo solo lo que su nombre no dice ya (tarea 277),
  // con el lugar de su ficha de Ubicación si está vinculada: es lo que se
  // VE. Lo que se busca no pierde nada: lo que se calla está en el título
  // (por eso se calla), y el texto indexado sigue llevando todos los datos,
  // también el texto de ubicación heredado junto al nombre vivo.
  const lugarDeEquipo = dispositivos.map((d) => ubicacionDeEquipo(d, porIdUbicacion.get(d.ubicacionId ?? '')))
  const subtitulosDeEquipo = lineasDeContexto(
    dispositivos.map((d, i) => ({ nombre: d.nombre, partes: [d.marca, d.modelo, lugarDeEquipo[i]] })),
  )
  const nombrePersona = new Map(personas.map((p) => [p.id, p.nombre]))
  const responsableVivo = (d: Dispositivo) =>
    d.responsableId ? textoVivo(nombrePersona.get(d.responsableId), d.responsable) : d.responsable
  for (const [indice, dispositivo] of dispositivos.entries()) {
    documentos.push({
      id: `dispositivo:${dispositivo.id}`,
      tipo: 'dispositivo',
      titulo: dispositivo.nombre,
      subtitulo: subtitulosDeEquipo[indice],
      ruta: `/dispositivos/${dispositivo.id}`,
      identidad: identidadDeEquipo(dispositivo, lugarDeEquipo[indice], responsableVivo(dispositivo)),
      texto: [
        dispositivo.estado,
        dispositivo.observaciones,
        // Propiedades personalizadas (fase Dis1, punto 9): un
        // tecnico que solo recuerda un dato propio del equipo
        // (por ejemplo el usuario asignado) tambien lo encuentra.
        // Van con el contenido general y no con la identidad: son
        // texto libre de cualquier clase ("Windows 11 Pro").
        ...Object.values(dispositivo.detalles ?? {}),
      ]
        .filter(Boolean)
        .join(' '),
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
      // Por fila y no por referencia (tarea 322): un acta vinculada a
      // varios equipos son varias filas con la misma referencia, y cada
      // una sale con su equipo. Con `adjunto:<referencia>` el indice
      // recibia dos veces el mismo id y MiniSearch tumbaba Resolver.
      id: `adjunto:${adjunto.id}`,
      tipo: 'adjunto',
      titulo: adjunto.nombre,
      subtitulo: dueno.titulo,
      ruta: dueno.ruta,
      texto: '',
      portadaRef: adjunto.tipo.startsWith('image/') ? adjunto.referencia : '',
    })
  }

  // Los diagnosticos se encuentran por el problema ("la impresora
  // no imprime"), por sus preguntas o por sus respuestas. Para quien
  // resuelve son "guías con preguntas" (tarea 263): el subtitulo no le
  // pide distinguir herramientas.
  for (const diagnostico of diagnosticos) {
    documentos.push({
      id: `diagnostico:${diagnostico.id}`,
      tipo: 'diagnostico',
      titulo: diagnostico.titulo,
      subtitulo: [nombreCategoria.get(diagnostico.categoriaId), ROTULO_RECORRIDO].filter(Boolean).join(' · '),
      ruta: `/diagnostico/${diagnostico.id}`,
      // Su descripción ("una línea que ayude a reconocer el problema")
      // dice cuándo corresponde recorrerla.
      cuandoUsar: unidos([diagnostico.descripcion]),
      texto: textoDeNodos(diagnostico.nodos ?? []),
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
        // A qué equipos da acceso (grupo N3): va en claro a propósito
        // (no es el secreto) y es lo que hace que "clave impresora
        // mercadeo" encuentre la credencial de ESE equipo (tarea 288).
        identidad: unidos((credencial.dispositivos ?? []).map((d) => d.nombre)),
        // NUNCA portadaRef: credencial.archivo?.referencia, aunque el
        // tipo MIME sea imagen. Esa referencia apunta al bucket
        // cifrado (archivos_boveda) y no se puede renderizar directo
        // como <img>, a diferencia de los adjuntos normales.
        texto: credencial.archivo?.nombre ?? '',
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
        // El nombre del dato y el del equipo ya son el título.
        texto: '',
        portadaRef: '',
      })
    }
  }

  return documentos
}

/**
 * Cuánto pesa cada campo en el puntaje de MiniSearch (tarea 288). Los
 * tres niveles del encargo: lo que nombra o identifica (título, identidad,
 * formas de búsqueda) pesa como el título de siempre; lo que describe la
 * situación (síntomas, cuándo usar), algo menos; el contexto, como el
 * subtítulo de siempre; y el contenido general, lo mínimo. Es el orden de
 * `buscar` (y el de cada grupo); "Mejores resultados" mide además QUÉ
 * campos coincidieron (`mejores.ts`).
 */
export const PESO_EN_INDICE: Record<CampoIndice, number> = {
  titulo: 3,
  identidad: 3,
  formasBusqueda: 3,
  sintomas: 2,
  cuandoUsar: 2,
  subtitulo: 1.5,
  texto: 1,
}

// EL VOCABULARIO DEL ÍNDICE (tarea 346): los términos hechos de letras que
// hay en los datos y en cuántos documentos aparece cada uno. De aquí salen
// las palabras que solo se alcanzan con dos letras cambiadas de sitio
// ("impirme" por "imprime") y el "Quizás buscabas…". NADA DE LA BÓVEDA
// entra: una credencial o un dato protegido nunca aparecen como corrección
// ni como sugerencia. Se arma una vez con el índice y vive lo que él.
interface Vocabulario {
  /** En cuántos documentos aparece cada término. */
  frecuencia: Map<string, number>
  /** Los términos por longitud: solo se comparan los que pueden estar cerca. */
  porLongitud: Map<number, string[]>
  /** Ordenados, para saber deprisa si una palabra empieza algún término. */
  ordenados: string[]
}

const vocabularios = new WeakMap<MiniSearch<DocumentoBusqueda>, Vocabulario>()

/** ¿Es de la Bóveda? Una credencial o un dato protegido solo responden a lo escrito tal cual. */
function esDeBoveda(id: string): boolean {
  return id.startsWith('credencial:') || id.startsWith('campo:')
}

function crearVocabulario(documentos: DocumentoBusqueda[]): Vocabulario {
  const frecuencia = new Map<string, number>()
  for (const documento of documentos) {
    if (esDeBoveda(documento.id)) continue
    const propios = new Set<string>()
    for (const campo of CAMPOS_INDICE) {
      for (const termino of terminosDe(documento[campo])) {
        if (termino.length >= 3 && esSoloLetras(termino)) propios.add(termino)
      }
    }
    for (const termino of propios) frecuencia.set(termino, (frecuencia.get(termino) ?? 0) + 1)
  }
  const porLongitud = new Map<number, string[]>()
  for (const termino of frecuencia.keys()) {
    const lista = porLongitud.get(termino.length)
    if (lista) lista.push(termino)
    else porLongitud.set(termino.length, [termino])
  }
  return { frecuencia, porLongitud, ordenados: [...frecuencia.keys()].sort() }
}

// ¿Hay en el vocabulario un término que sea la palabra o empiece por ella?
function existeEnVocabulario(vocabulario: Vocabulario, palabra: string): boolean {
  if (vocabulario.frecuencia.has(palabra)) return true
  const { ordenados } = vocabulario
  let bajo = 0
  let alto = ordenados.length
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1
    if (ordenados[medio] < palabra) bajo = medio + 1
    else alto = medio
  }
  return bajo < ordenados.length && ordenados[bajo].startsWith(palabra)
}

interface Errata {
  termino: string
  distancia: number
  /** Solo se llega con dos letras cambiadas de sitio: MiniSearch no lo encuentra. */
  soloTransposicion: boolean
}

/**
 * Los términos del vocabulario a los que la palabra llega con una errata
 * dentro de la tolerancia de siempre, contada con Damerau-Levenshtein. No
 * cuenta los que la palabra ya alcanza tal cual o por prefijo.
 */
function erratasDe(vocabulario: Vocabulario, palabra: string): Errata[] {
  const tope = toleranciaDe(palabra)
  const erratas: Errata[] = []
  for (let longitud = palabra.length - tope; longitud <= palabra.length + tope; longitud++) {
    for (const termino of vocabulario.porLongitud.get(longitud) ?? []) {
      if (termino === palabra || termino.startsWith(palabra)) continue
      const distancia = distanciaDamerau(termino, palabra, tope)
      if (distancia > tope) continue
      erratas.push({ termino, distancia, soloTransposicion: distanciaLevenshtein(termino, palabra, tope) > tope })
    }
  }
  return erratas
}

// Separado del hook para poder probarlo sin depender de React ni de
// la base local.
export function crearIndiceDesdeDocumentos(documentos: DocumentoBusqueda[]): MiniSearch<DocumentoBusqueda> {
  const indice = new MiniSearch<DocumentoBusqueda>({
    idField: 'id',
    fields: [...CAMPOS_INDICE],
    storeFields: ['tipo', 'titulo', 'subtitulo', 'ruta', 'portadaRef'],
    // SIN TILDES, EN LOS DOS LADOS (tarea 288). Hasta ahora el índice solo
    // bajaba a minúsculas y la tolerancia a tildes era un efecto del
    // difuso, que no alcanza a las palabras cortas ("qué", "llegó") ni a
    // la ñ escrita como n. Se aplica igual al indexar y al buscar.
    processTerm: (termino: string) => normalizarTexto(termino),
    searchOptions: {
      boost: PESO_EN_INDICE,
      // La tolerancia de siempre, pero solo para una palabra de letras
      // (tarea 346): un número, un serial o una IP se buscan tal cual. Cada
      // búsqueda la afina además con lo que se escribió (`buscarConSinonimos`).
      fuzzy: (termino: string) => (esAproximable(termino) ? FRACCION_DIFUSA : false),
      // Por prefijo mientras se escribe ("impre" encuentra "impresora"),
      // salvo una letra suelta que ACOMPAÑA a otras palabras (2026-09-14).
      // En "windows r" la "r" es la tecla, no el comienzo de "router",
      // "red" y "respaldo": como prefijo traía media base de datos y el
      // atajo que se buscaba quedaba enterrado. Sola ("r"), se sigue
      // tratando como prefijo, que es lo que se espera al empezar a teclear.
      prefix: (termino: string, _indice: number, terminos: string[]) => usaPrefijo(termino, terminos),
    },
  })
  // Un id repetido hace que MiniSearch lance y, con el, cae la pantalla
  // entera ("No se pudo cargar la aplicación"). Los ids se arman para ser
  // unicos; esto es la red: se queda el primero y el resto se ignora.
  const vistos = new Set<string>()
  const unicos = documentos.filter((documento) => {
    if (vistos.has(documento.id)) return false
    vistos.add(documento.id)
    return true
  })
  indice.addAll(unicos)
  vocabularios.set(indice, crearVocabulario(unicos))
  return indice
}

type ResultadoIndice = ReturnType<MiniSearch<DocumentoBusqueda>['search']>[number]

/** Un resultado del índice con lo que las tareas 288 y 346 anotan de su coincidencia. */
type ResultadoAnotado = ResultadoIndice & {
  soloSinonimo?: boolean
  camposPorPalabra: CampoIndice[][]
  camposPorSinonimo: CampoIndice[][]
  aproximadoPorPalabra: boolean[]
}

// Cuánto suma un sinónimo a un resultado que YA coincide con lo escrito:
// desempata a favor de lo que además nombra el sinónimo, sin pasar por
// delante de nada.
const PESO_SINONIMO = 0.5

/**
 * Cuánto pesa en el índice una palabra que solo se alcanza con dos letras
 * cambiadas de sitio (tarea 346): lo mismo que una errata de MiniSearch
 * (su peso difuso por defecto, 0,45, por la longitud del término entre la
 * longitud más la distancia), nunca como lo escrito tal cual.
 */
const PESO_TRANSPOSICION = 0.4
const BOOST_TRANSPOSICION: Record<CampoIndice, number> = Object.fromEntries(
  CAMPOS_INDICE.map((campo) => [campo, PESO_EN_INDICE[campo] * PESO_TRANSPOSICION]),
) as Record<CampoIndice, number>

/**
 * En qué campos del documento coincidió alguna de las palabras `buscadas`
 * (tarea 288). MiniSearch dice qué términos DEL DOCUMENTO coincidieron y
 * en qué campos, no de qué palabra salió cada uno; se reconstruye con su
 * misma regla: idéntico, por prefijo o (si se admite) con errata.
 */
function camposDe(
  coincidencias: ResultadoIndice['match'],
  buscadas: readonly string[],
  terminosDeLaBusqueda: readonly string[],
  conErratas: boolean,
): CampoIndice[] {
  if (buscadas.length === 0) return []
  const campos = new Set<string>()
  for (const [termino, enCampos] of Object.entries(coincidencias)) {
    const salio = buscadas.some((buscada) => {
      if (termino === buscada) return true
      if (usaPrefijo(buscada, terminosDeLaBusqueda) && termino.startsWith(buscada)) return true
      const tope = toleranciaDe(buscada)
      return conErratas && esAproximable(buscada) && distanciaLevenshtein(termino, buscada, tope) <= tope
    })
    if (salio) for (const campo of enCampos) campos.add(campo)
  }
  return CAMPOS_INDICE.filter((campo) => campos.has(campo))
}

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
 *
 * SE BUSCA LO QUE DICE ALGO (tarea 288): las palabras vacías de una frase
 * ("la", "de", "una", "me") no se buscan; con prefijo y OR traían medio
 * índice. Y cada resultado lleva anotado en qué campos coincidió cada
 * palabra, por sí misma o por un sinónimo suyo.
 *
 * LA ERRATA, DICHA Y CON SU REGLA (tarea 346):
 * - Una palabra escrita como un valor (con dígitos o símbolos: una IP, un
 *   serial, una placa, "/flushdns") se busca tal cual, sin erratas.
 * - Una palabra de letras tolera lo de siempre y, además, las dos letras
 *   cambiadas de sitio que MiniSearch cuenta doble ("impirme", "gracia"):
 *   esas variantes, sacadas del vocabulario del índice, se buscan aparte y
 *   pesan como una errata.
 * - Cada palabra queda anotada como exacta o aproximada
 *   (`aproximadoPorPalabra`): el ranking pone lo exacto delante y la
 *   pantalla dice "Posible coincidencia".
 * - La Bóveda solo responde a lo escrito tal cual: una credencial o un dato
 *   protegido que solo coincide por una errata no sale.
 */
export function buscarConSinonimos(indice: MiniSearch<DocumentoBusqueda>, consulta: string): ResultadoAnotado[] {
  const palabras = palabrasDeContenido(consulta)
  if (palabras.length === 0) return []
  const literales = palabrasLiterales(consulta)
  const aproximable = (palabra: string) => !literales.has(palabra) && esAproximable(palabra)
  const vocabulario = vocabularios.get(indice)
  const transposiciones = new Map<string, Set<string>>()
  if (vocabulario) {
    for (const palabra of palabras) {
      if (!aproximable(palabra)) continue
      const propias = erratasDe(vocabulario, palabra).filter((errata) => errata.soloTransposicion)
      if (propias.length > 0) transposiciones.set(palabra, new Set(propias.map((errata) => errata.termino)))
    }
  }
  const terminosTranspuestos = [...new Set([...transposiciones.values()].flatMap((terminos) => [...terminos]))]
  const difuso = (termino: string) => (aproximable(termino) ? FRACCION_DIFUSA : false)
  const directos = indice.search(
    terminosTranspuestos.length === 0
      ? palabras.join(' ')
      : {
          combineWith: 'OR',
          queries: [
            palabras.join(' '),
            { queries: [terminosTranspuestos.join(' ')], fuzzy: false, prefix: false, boost: BOOST_TRANSPOSICION },
          ],
        },
    { fuzzy: difuso },
  )
  const agregadas = sinonimosDe(consulta)
  const porSinonimo = agregadas.length > 0 ? indice.search(agregadas.join(' ')) : []
  const sinonimosDePalabra = sinonimosPorPalabra(consulta)
  const deSinonimo = new Map(porSinonimo.map((resultado) => [resultado.id, resultado]))
  const porSinonimoDe = (resultado: ResultadoIndice | undefined): CampoIndice[][] =>
    palabras.map((palabra) =>
      resultado
        ? camposDe(resultado.match, sinonimosDePalabra.get(palabra) ?? [], agregadas, !esDeBoveda(String(resultado.id)))
        : [],
    )

  // Para cada palabra, dónde coincidió tal cual (o por prefijo) y dónde solo
  // con una errata. Lo de la Bóveda solo cuenta lo escrito tal cual.
  const anotarPalabras = (resultado: ResultadoIndice) => {
    const deBoveda = esDeBoveda(String(resultado.id))
    const camposPorPalabra: CampoIndice[][] = []
    const aproximadoPorPalabra: boolean[] = []
    for (const palabra of palabras) {
      const exactos = new Set<string>()
      const aproximados = new Set<string>()
      const prefijo = usaPrefijo(palabra, palabras)
      const tope = toleranciaDe(palabra)
      for (const [termino, enCampos] of Object.entries(resultado.match)) {
        if (termino === palabra || (prefijo && termino.startsWith(palabra))) {
          for (const campo of enCampos) exactos.add(campo)
        } else if (
          !deBoveda &&
          aproximable(palabra) &&
          (transposiciones.get(palabra)?.has(termino) || distanciaLevenshtein(termino, palabra, tope) <= tope)
        ) {
          for (const campo of enCampos) aproximados.add(campo)
        }
      }
      camposPorPalabra.push(CAMPOS_INDICE.filter((campo) => exactos.has(campo) || aproximados.has(campo)))
      aproximadoPorPalabra.push(exactos.size === 0 && aproximados.size > 0)
    }
    return { camposPorPalabra, aproximadoPorPalabra }
  }

  const primeros: ResultadoAnotado[] = directos
    .map((resultado) => {
      const extra = deSinonimo.get(resultado.id)
      const anotado = {
        ...resultado,
        ...anotarPalabras(resultado),
        camposPorSinonimo: porSinonimoDe(extra),
      }
      if (!extra) return anotado
      return {
        ...anotado,
        score: resultado.score + PESO_SINONIMO * extra.score,
        terms: [...new Set([...resultado.terms, ...extra.terms])],
        queryTerms: [...new Set([...resultado.queryTerms, ...extra.queryTerms])],
        match: { ...extra.match, ...resultado.match },
      }
    })
    // Lo de la Bóveda que solo trajo una errata no sale.
    .filter((resultado) => !esDeBoveda(String(resultado.id)) || resultado.camposPorPalabra.some((campos) => campos.length > 0))
    .sort((a, b) => b.score - a.score)
  const idsPrimeros = new Set(primeros.map((resultado) => resultado.id))
  return [
    ...primeros,
    // Marcados para que quien reordene despues (`mejoresResultados`) no
    // pueda colocarlos por delante de una coincidencia directa.
    ...porSinonimo
      .filter((resultado) => !idsPrimeros.has(resultado.id))
      .map((resultado) => ({
        ...resultado,
        soloSinonimo: true,
        camposPorPalabra: palabras.map((): CampoIndice[] => []),
        camposPorSinonimo: porSinonimoDe(resultado),
        aproximadoPorPalabra: palabras.map(() => false),
      }))
      .filter(
        (resultado) =>
          !esDeBoveda(String(resultado.id)) || resultado.camposPorSinonimo.some((campos) => campos.length > 0),
      ),
  ]
}

function aResultado(resultado: ResultadoAnotado): ResultadoBusqueda {
  const coincidentes = new Set(resultado.camposPorPalabra.flat())
  return {
    id: String(resultado.id),
    tipo: resultado.tipo as TipoResultado,
    titulo: resultado.titulo as string,
    subtitulo: resultado.subtitulo as string,
    ruta: resultado.ruta as string,
    portadaRef: (resultado.portadaRef as string) ?? '',
    soloSinonimo: resultado.soloSinonimo === true,
    camposCoincidentes: CAMPOS_INDICE.filter((campo) => coincidentes.has(campo)),
    camposPorPalabra: resultado.camposPorPalabra,
    camposPorSinonimo: resultado.camposPorSinonimo,
    puntajeIndice: resultado.score,
    aproximadoPorPalabra: resultado.aproximadoPorPalabra,
    aproximado: resultado.aproximadoPorPalabra.some(Boolean),
  }
}

/**
 * "QUIZÁS BUSCABAS…" (tarea 346). La consulta con cada palabra que no
 * existe tal como se escribió (ni como comienzo de una) cambiada por el
 * término más cercano que sí existe: el de menos errores y, a igualdad, el
 * que más aparece. Lo demás queda como se tecleó, incluida la mayúscula
 * inicial. Es una PROPUESTA: nunca cambia el campo ni abre nada; el técnico
 * decide tocarla. Una palabra que ya coincide tal cual con algún resultado
 * no se toca, y lo escrito como un valor (una IP, un serial) tampoco. null
 * si no hay nada que proponer.
 */
export function sugerirConsulta(
  indice: MiniSearch<DocumentoBusqueda>,
  consulta: string,
  resultados: readonly ResultadoBusqueda[] = [],
): string | null {
  const vocabulario = vocabularios.get(indice)
  if (!vocabulario || consulta.trim() === '') return null
  const literales = palabrasLiterales(consulta)
  const palabras = palabrasDeContenido(consulta)
  const reemplazos = new Map<string, string>()
  palabras.forEach((palabra, indicePalabra) => {
    if (literales.has(palabra) || !esAproximable(palabra)) return
    if (existeEnVocabulario(vocabulario, palabra)) return
    const tal = resultados.some(
      (resultado) =>
        (resultado.camposPorPalabra?.[indicePalabra]?.length ?? 0) > 0 &&
        resultado.aproximadoPorPalabra?.[indicePalabra] !== true,
    )
    if (tal) return
    const [mejor] = erratasDe(vocabulario, palabra).sort(
      (a, b) =>
        a.distancia - b.distancia ||
        (vocabulario.frecuencia.get(b.termino) ?? 0) - (vocabulario.frecuencia.get(a.termino) ?? 0) ||
        a.termino.localeCompare(b.termino),
    )
    if (mejor) reemplazos.set(palabra, mejor.termino)
  })
  if (reemplazos.size === 0) return null
  return consulta.trim().replace(/[\p{L}\p{M}]+/gu, (escrita) => {
    const reemplazo = reemplazos.get(normalizarTexto(escrita))
    if (!reemplazo) return escrita
    const mayuscula = escrita[0] !== escrita[0].toLowerCase()
    return mayuscula ? reemplazo[0].toUpperCase() + reemplazo.slice(1) : reemplazo
  })
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
