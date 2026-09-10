import { useLiveQuery } from 'dexie-react-hooks'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type KeyboardEvent as EventoTeclado,
  type PointerEvent as EventoPuntero,
  type ReactNode,
} from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import {
  db,
  type Articulo,
  type BloquePaso,
  type DispositivoAfectado,
  type IntencionGuia,
  type PasoAdjunto,
  type PasoProcedimiento,
  type Referencia,
  type TipoReferencia,
  type TipoTarea,
  type TipoVinculoProtegido,
  type TonoAviso,
} from '../../lib/db'
import {
  crearBloqueArchivo,
  crearBloqueAviso,
  crearBloqueGuia,
  crearBloqueImagen,
  crearBloqueReferencia,
  crearBloqueTarea,
  crearPaso,
  normalizarProcedimiento,
  procedimientoEjecutable,
} from '../../lib/procedimiento'
import {
  cambiarTipoTarea,
  DESTINO_PASO,
  destinoTarea,
  etiquetaDestino,
  insertarApoyo,
  moverTareaConApoyos,
  opcionesDestino,
  reasignarApoyo,
  type DestinoApoyo,
} from './bloquesEditor'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  ArrowDown,
  ArrowElbowDownRight,
  ArrowUp,
  BookBookmark,
  BookOpen,
  Keyboard,
  Camera,
  CaretDown,
  CaretUp,
  DotsSixVertical,
  DotsThreeOutline,
  Info,
  type IconoProps,
  LinkSimple,
  LockSimple,
  Paperclip,
  Plus,
  Question,
  SealCheck,
  Signpost,
  Square,
  TerminalWindow,
  TrashSimple,
  Warning,
  Wrench,
  X,
} from '../../components/iconos'
import { TONOS_AVISO, type TonoInfo } from './tonos'
import { CLASE_CAMPO_SIN_ANCHO } from '../../components/campos'
import { HojaTipoBloque, type OpcionTipoBloque } from './HojaTipoBloque'
import { HojaVinculo, type GrupoVinculo } from './HojaVinculo'
import { AccionesPaso } from './ranuraAccionesPaso'
import { avisoDeVinculo } from './validacionVinculos'
import { SelectorReferencia } from '../referencia/SelectorReferencia'
import { INFO_TIPO } from '../referencia/referencias'

interface Props {
  articuloId: string
  pasos: PasoProcedimiento[]
  onPasosChange: (pasos: PasoProcedimiento[]) => void
  // Equipos donde aplica este artículo (grupo P2): sus campos
  // protegidos aparecen primero al vincular información protegida a un
  // paso, antes que los secretos globales de la bóveda (ejemplo del
  // encargo: "Conectar impresora Lanier MP3050" -> "Contraseña
  // administrador del dispositivo").
  dispositivosAfectados: DispositivoAfectado[]
  // Paso sobre el que actúa la barra fija de añadir (tablero 6b). Vive
  // en el formulario porque el botón "Probar" de la misma barra también
  // lo necesita ("Probar el paso 3"). null = todavía no se ha tocado
  // ninguno; entonces manda el último, que es donde se está escribiendo.
  pasoActivoId: string | null
  onPasoActivoChange: (pasoId: string | null) => void
  // Apoyo heredado que hay que ABRIR ahora mismo (encargo del
  // 2026-09-09, tarea 7). Llega del acceso "Sin asignar" del
  // formulario: despliega su paso, lo trae a la vista y abre el
  // selector de destino, que es la decision que falta. `onAbierto`
  // avisa de vuelta para que el formulario lo olvide y el mismo apoyo
  // se pueda volver a pedir mas tarde.
  apoyoDestacadoId?: string | null
  onApoyoDestacadoAbierto?: () => void
}

// Una opcion del selector polimorfico "Vincular informacion
// protegida": un secreto de la boveda o un campo protegido de un
// equipo, cada uno con su id ya calificado por tipo.
interface OpcionVinculoProtegido {
  tipo: TipoVinculoProtegido
  id: string
  titulo: string
}

// Metadatos visuales de cada clasificacion de tarea. Antes el icono se
// tocaba para CICLAR entre los tipos; desde el tablero 6b del handoff
// "Diseño móvil" el tipo se elige en una hoja, así que cada uno lleva
// además su palabra corta (la que cabe en la pastilla) y una línea que
// dice para qué sirve.
interface TipoTareaInfo {
  valor: TipoTarea
  Icono: ComponentType<IconoProps>
  claseIcono: string
  // Palabra de la pastilla. Compite por el ancho con el texto de la
  // tarea, así que "Verificación" se abrevia y "Acción" no.
  corto: string
  etiqueta: string
  descripcion: string
  // Fondo y borde de la pastilla. La acción es la neutra (es el tipo
  // por defecto y el más común); los otros dos se tiñen para que se
  // reconozcan de un vistazo en una lista larga de tareas.
  clasePastilla: string
  placeholder: string
}

const TIPOS_TAREA: TipoTareaInfo[] = [
  {
    valor: 'accion',
    Icono: Square,
    claseIcono: 'text-noct-accent-300',
    corto: 'Acción',
    etiqueta: 'Acción',
    descripcion: 'Algo que el técnico ejecuta',
    clasePastilla: 'border-noct-divider bg-noct-bg',
    placeholder: 'Tarea (por ejemplo: Encender la impresora)',
  },
  {
    valor: 'verificacion',
    Icono: SealCheck,
    claseIcono: 'text-noct-exito',
    corto: 'Verif.',
    etiqueta: 'Verificación',
    descripcion: 'Comprobar antes de continuar',
    clasePastilla: 'border-noct-exito/45 bg-noct-exito/10',
    placeholder: 'Comprobación (por ejemplo: Verificar que aparece)',
  },
  {
    valor: 'decision',
    Icono: Question,
    claseIcono: 'text-noct-precaucion',
    corto: 'Decisión',
    etiqueta: 'Decisión Sí / No',
    descripcion: '«No» abre otra guía y vuelve aquí',
    clasePastilla: 'border-noct-precaucion/45 bg-noct-precaucion/[.12]',
    placeholder: 'Pregunta de Sí/No',
  },
]

// LOS OCHO TIPOS DE CONTENIDO QUE EL AUTOR PUEDE INSERTAR (seccion 4
// del encargo del 2026-09-08). Hasta ahora la barra del editor solo
// ofrecia cuatro cosas (tarea, aviso, foto y "reusar"), y el archivo,
// la guia vinculada y el dato protegido solo existian escondidos en
// "Vinculos del paso", es decir a nivel de PASO y nunca de tarea.
//
// Accion, Verificacion y Decision son el mismo bloque 'tarea' con
// distinto `tipoTarea`: el catalogo los ofrece por separado porque el
// autor piensa en ellos como tipos, pero NO se duplican en el modelo.
type ClaveContenido =
  | 'accion'
  | 'verificacion'
  | 'decision'
  | 'imagen'
  | 'aviso'
  | 'archivo'
  | 'guia'
  | 'dato'
  | 'termino'
  | 'atajo'
  | 'comando'

const CONTENIDOS: OpcionTipoBloque<ClaveContenido>[] = [
  { valor: 'accion', etiqueta: 'Acción', descripcion: 'Algo que el técnico ejecuta', Icono: Square, claseIcono: 'text-noct-accent-300' },
  { valor: 'verificacion', etiqueta: 'Verificación', descripcion: 'Comprobar antes de continuar', Icono: SealCheck, claseIcono: 'text-noct-exito' },
  { valor: 'decision', etiqueta: 'Decisión Sí / No', descripcion: '«No» abre otra guía y vuelve aquí', Icono: Question, claseIcono: 'text-noct-precaucion' },
  { valor: 'imagen', etiqueta: 'Imagen', descripcion: 'Una captura en este punto', Icono: Camera, claseIcono: 'text-noct-accent-300' },
  { valor: 'aviso', etiqueta: 'Aviso', descripcion: 'Precaución, dato o consejo', Icono: Warning, claseIcono: 'text-noct-precaucion' },
  { valor: 'archivo', etiqueta: 'Archivo', descripcion: 'Manual, PDF o planilla', Icono: Paperclip, claseIcono: 'text-noct-neutral-300' },
  { valor: 'guia', etiqueta: 'Guía vinculada', descripcion: 'Otra guía que se hace aquí', Icono: BookOpen, claseIcono: 'text-noct-accent-300' },
  { valor: 'dato', etiqueta: 'Dato protegido', descripcion: 'Clave o campo de la bóveda', Icono: LockSimple, claseIcono: 'text-noct-neutral-300' },
  // Referencia (encargo del 2026-09-10). No duplica el contenido: el
  // bloque guarda el id de la ficha central mas una copia del titulo,
  // asi que editar el termino lo actualiza en todas las guias.
  { valor: 'termino', etiqueta: 'Término del glosario', descripcion: 'Una palabra del vocabulario del equipo', Icono: BookBookmark, claseIcono: 'text-noct-accent-300' },
  { valor: 'atajo', etiqueta: 'Atajo de teclado', descripcion: 'Una combinación de teclas', Icono: Keyboard, claseIcono: 'text-noct-accent-300' },
  { valor: 'comando', etiqueta: 'Comando', descripcion: 'Algo que se escribe en una consola o en Ejecutar', Icono: TerminalWindow, claseIcono: 'text-noct-accent-300' },
]

// Que clase de referencia inserta cada clave del catalogo. Las tres
// comparten flujo (elegir o crear, y colgarse de la tarea activa), asi
// que se resuelven en una sola rama en vez de tres.
const REFERENCIA_POR_CLAVE: Partial<Record<ClaveContenido, TipoReferencia>> = {
  termino: 'termino',
  atajo: 'atajo',
  comando: 'comando',
}

// Para que sirve una guia vinculada. La distincion es del encargo
// (seccion 5, punto 6): una consulta opcional NO puede bloquear.
const INTENCIONES_GUIA: OpcionTipoBloque<IntencionGuia>[] = [
  { valor: 'necesario', etiqueta: 'Necesaria', descripcion: 'Hay que completarla para cerrar el paso', Icono: BookOpen, claseIcono: 'text-noct-accent-300' },
  { valor: 'consulta', etiqueta: 'Consulta opcional', descripcion: 'Material de apoyo; no bloquea el avance', Icono: Info, claseIcono: 'text-noct-neutral-300' },
  { valor: 'contingencia', etiqueta: 'Contingencia', descripcion: 'Qué hacer si esto falla', Icono: Wrench, claseIcono: 'text-noct-precaucion' },
]

const OPCIONES_TIPO_TAREA: OpcionTipoBloque<TipoTarea>[] = TIPOS_TAREA.map((t) => ({
  valor: t.valor,
  etiqueta: t.etiqueta,
  descripcion: t.descripcion,
  Icono: t.Icono,
  claseIcono: t.claseIcono,
}))

const OPCIONES_TONO: OpcionTipoBloque<TonoAviso>[] = TONOS_AVISO.map((t) => ({
  valor: t.valor,
  etiqueta: t.etiqueta,
  descripcion: t.descripcion,
  Icono: t.Icono,
  claseIcono: t.claseIcono,
}))

function infoTipoTarea(tipo: TipoTarea | null): TipoTareaInfo {
  return TIPOS_TAREA.find((t) => t.valor === (tipo ?? 'accion')) ?? TIPOS_TAREA[0]
}

function infoTono(tono: TonoAviso | null): TonoInfo {
  return TONOS_AVISO.find((t) => t.valor === (tono ?? 'info')) ?? TONOS_AVISO[0]
}

// Como se nombra, en el titulo de la hoja de contenido, la tarea a la
// que va a caer lo que el autor elija. El alcance por defecto es la
// tarea seleccionada (requisito 4), asi que decirlo ANTES de elegir es
// lo que evita el "¿y esto donde va a salir?".
function etiquetaDestinoActivo(bloques: BloquePaso[], destino: DestinoApoyo): string {
  if (destino.alcance === 'paso' || !destino.tareaId) return 'todo el paso'
  const numero = bloques.filter((b) => b.tipo === 'tarea').findIndex((b) => b.id === destino.tareaId)
  return numero >= 0 ? `la tarea ${numero + 1}` : 'todo el paso'
}

// Separación vertical entre tarjetas de paso (`gap-3.5`). El arrastre
// necesita el número para calcular cuánto se corre cada tarjeta al
// dejar hueco, así que vive en un solo sitio.
const HUECO_ENTRE_PASOS = 14

// Editor del procedimiento paso a paso (handoff "Editor de Artículo",
// sistema Nocturne). Componente controlado: el estado vive en el
// formulario. Cada paso es una tarjeta con numero, titulo, objetivo y un
// cuerpo de bloques (tareas con casilla, advertencias e imagenes), mas un
// menu de reordenar/eliminar y los vinculos del paso (bóveda,
// procedimiento y solución).
export function PasosEditor({
  articuloId,
  pasos,
  onPasosChange,
  dispositivosAfectados,
  pasoActivoId,
  onPasoActivoChange,
  apoyoDestacadoId = null,
  onApoyoDestacadoAbierto,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [menuPasoId, setMenuPasoId] = useState<string | null>(null)
  const [vinculosPasoId, setVinculosPasoId] = useState<string | null>(null)
  const [pasoAEliminar, setPasoAEliminar] = useState<number | null>(null)
  const [subiendoBloqueId, setSubiendoBloqueId] = useState<string | null>(null)
  const [subiendoAdjuntoPasoId, setSubiendoAdjuntoPasoId] = useState<string | null>(null)
  const [focoBloqueId, setFocoBloqueId] = useState<string | null>(null)
  // TAREA ACTIVA: a que tarea se le cuelga lo que se añade (requisito 4
  // del editor, "el alcance predeterminado de un apoyo sera la tarea
  // seleccionada"). Se mueve sola al tocar o enfocar una tarea; sin
  // ninguna tocada manda la ultima del paso, que es donde se escribe.
  const [tareaActivaId, setTareaActivaId] = useState<string | null>(null)
  // Hoja de "añadir contenido" (los ocho tipos) del paso activo.
  const [hojaContenidoAbierta, setHojaContenidoAbierta] = useState(false)
  // Apoyo cuyo destino se esta eligiendo, o null.
  const [destinoDeBloqueId, setDestinoDeBloqueId] = useState<string | null>(null)
  // Aviso de lo que se soltaria al cambiar el tipo de una linea
  // (requisito 7): se dice ANTES, no se descubre despues.
  const [avisoCambioTipo, setAvisoCambioTipo] = useState<string | null>(null)
  // Tarea cuyo selector de dato protegido hay que abrir (lo pide el
  // catalogo de contenido, que vive en la barra del pie).
  const [datoDeTareaId, setDatoDeTareaId] = useState<string | null>(null)
  // Referencia que se está eligiendo para INSERTAR un bloque nuevo (el
  // paso al que va y de qué clase es). Cambiar la de un bloque que ya
  // existe lo resuelve el propio bloque, con su selector.
  const [referenciaNueva, setReferenciaNueva] = useState<{
    indice: number
    tipo: TipoReferencia
  } | null>(null)

  // Secretos de la boveda para vincular a un paso. Solo llegan a este
  // dispositivo los de usuarios con permiso de boveda (RLS); el titulo
  // es visible sin desbloquear, los secretos no.
  // Glosario, atajos y comandos disponibles para vincular. Las
  // eliminadas quedan fuera: no se ofrece vincular algo que ya no
  // existe (los bloques que YA apuntaban a una eliminada se conservan,
  // eso lo resuelve la vista, no el selector).
  const referenciasDisponibles = useLiveQuery(
    () => db.referencias.filter((r) => !r.eliminadoEn).toArray(),
    [],
    [],
  )
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  // Campos protegidos de los equipos donde aplica este articulo (grupo
  // P2): misma RLS que las credenciales, asi que sin permiso de boveda
  // esta lista llega vacia y el grupo "Datos protegidos del equipo"
  // del selector no aparece.
  const camposProtegidos = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )
  const idsEquiposVinculados = useMemo(
    () => new Set(dispositivosAfectados.map((d) => d.id)),
    [dispositivosAfectados],
  )
  const nombrePorEquipo = useMemo(
    () => new Map(dispositivosAfectados.map((d) => [d.id, d.nombre])),
    [dispositivosAfectados],
  )
  const opcionesCampos = useMemo<OpcionVinculoProtegido[]>(
    () =>
      camposProtegidos
        .filter((c) => c.dispositivoId && idsEquiposVinculados.has(c.dispositivoId))
        .map((c) => ({
          tipo: 'campo' as const,
          id: c.id,
          titulo: `${c.nombre} (${nombrePorEquipo.get(c.dispositivoId as string) ?? ''})`,
        }))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')),
    [camposProtegidos, idsEquiposVinculados, nombrePorEquipo],
  )
  const opcionesCredenciales = useMemo<OpcionVinculoProtegido[]>(
    () =>
      [...credenciales]
        .map((c) => ({
          tipo: 'credencial' as const,
          id: c.id,
          titulo: c.categoria ? `${c.titulo} (${c.categoria})` : c.titulo,
        }))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')),
    [credenciales],
  )

  // Articulos con procedimiento que se pueden vincular a un paso, como
  // subprocedimiento o como solucion por si el paso falla (y como
  // vinculo "Si responde No" de una tarea de decision). Se excluye el
  // articulo en edicion.
  const vinculables = useLiveQuery(
    () =>
      db.articulos
        .filter(
          (a) =>
            !a.eliminadoEn &&
            a.id !== articuloId &&
            (a.estado ?? 'publicado') === 'publicado' &&
            procedimientoEjecutable(normalizarProcedimiento(a.procedimiento)),
        )
        .toArray(),
    [articuloId],
    [],
  )
  const vinculablesOrdenados = useMemo(
    () => [...vinculables].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [vinculables],
  )
  // Todos los articulos (no solo los vinculables) para poder seguir el
  // grafo al validar un destino: un ciclo puede pasar por una guia que
  // este pantalla no ofrece.
  const todosLosArticulos = useLiveQuery(() => db.articulos.toArray(), [], [])
  const articulosPorId = useMemo(
    () => new Map(todosLosArticulos.map((a) => [a.id, a])),
    [todosLosArticulos],
  )
  // Aviso al elegir un destino: ciclo, borrador o guia que ya no esta
  // (seccion 5, punto 10). Describe, no bloquea (ver validacionVinculos.ts).
  function revisarVinculo(destinoId: string) {
    setAviso(avisoDeVinculo(articuloId, destinoId, articulosPorId))
  }

  function actualizarPaso(indice: number, cambios: Partial<PasoProcedimiento>) {
    onPasosChange(pasos.map((paso, i) => (i === indice ? { ...paso, ...cambios } : paso)))
  }

  function actualizarBloque(indice: number, bloqueId: string, cambios: Partial<BloquePaso>) {
    actualizarPaso(indice, {
      bloques: pasos[indice].bloques.map((b) => (b.id === bloqueId ? { ...b, ...cambios } : b)),
    })
  }

  function quitarBloque(indice: number, bloqueId: string) {
    actualizarPaso(indice, { bloques: pasos[indice].bloques.filter((b) => b.id !== bloqueId) })
  }

  // Añade un bloque al paso. Una TAREA va al final (es trabajo nuevo);
  // un APOYO se coloca junto a la tarea a la que pertenece, para que el
  // orden de escritura sea el orden de lectura (ver `insertarApoyo`).
  function agregarBloque(indice: number, bloque: BloquePaso, destino?: DestinoApoyo) {
    const bloques = pasos[indice].bloques
    if (bloque.tipo === 'tarea') {
      actualizarPaso(indice, { bloques: [...bloques, bloque] })
      setTareaActivaId(bloque.id)
      setFocoBloqueId(bloque.id)
      return
    }
    const destinoFinal = destino ?? destinoPorDefecto(indice)
    actualizarPaso(indice, { bloques: insertarApoyo(bloques, bloque, destinoFinal) })
    if (bloque.tipo === 'aviso') setFocoBloqueId(bloque.id)
  }

  // A que tarea se le cuelga un apoyo nuevo: la seleccionada; si el paso
  // todavia no tiene ninguna, al paso completo.
  function destinoPorDefecto(indice: number): DestinoApoyo {
    const bloques = pasos[indice].bloques
    const activa = bloques.find((b) => b.id === tareaActivaId && b.tipo === 'tarea')
    if (activa) return destinoTarea(activa.id)
    const ultima = [...bloques].reverse().find((b) => b.tipo === 'tarea')
    return ultima ? destinoTarea(ultima.id) : DESTINO_PASO
  }

  // Inserta uno de los ocho tipos del catalogo. Accion, verificacion y
  // decision son el mismo bloque 'tarea'; el dato protegido no es un
  // bloque nuevo sino el vinculo de la tarea seleccionada, que ya
  // existia (no se duplica el concepto, punto 3 de la seccion 4).
  function agregarContenido(indice: number, clave: ClaveContenido) {
    const tareaId = destinoPorDefecto(indice).tareaId
    if (clave === 'accion' || clave === 'verificacion' || clave === 'decision') {
      agregarBloque(indice, crearBloqueTarea(clave))
      return
    }
    const tipoReferencia = REFERENCIA_POR_CLAVE[clave]
    if (tipoReferencia) {
      // El bloque nace CUANDO se elige la referencia, no antes: un
      // bloque de referencia sin destino no es nada y solo dejaría una
      // fila vacía en el paso si el autor cancela.
      setReferenciaNueva({ indice, tipo: tipoReferencia })
      return
    }
    if (clave === 'imagen') return agregarBloque(indice, crearBloqueImagen(tareaId))
    if (clave === 'aviso') return agregarBloque(indice, crearBloqueAviso(tareaId))
    if (clave === 'archivo') return agregarBloque(indice, crearBloqueArchivo(tareaId))
    if (clave === 'guia') return agregarBloque(indice, crearBloqueGuia(tareaId))
    // DATO PROTEGIDO. No nace un bloque nuevo: se usa el vinculo que ya
    // existe en el propio bloque 'tarea' (`vinculoProtegido`, tarea 40),
    // que la ejecucion ya sabia mostrar pero el editor NO permitia
    // rellenar (solo ofrecia el del paso completo). Con una tarea
    // seleccionada se abre su selector; sin ninguna, el del paso.
    if (tareaId) setDatoDeTareaId(tareaId)
    else setVinculosPasoId(pasos[indice].id)
  }

  function moverTarea(indice: number, tareaId: string, direccion: -1 | 1) {
    actualizarPaso(indice, { bloques: moverTareaConApoyos(pasos[indice].bloques, tareaId, direccion) })
  }

  function cambiarDestino(indice: number, bloqueId: string, destino: DestinoApoyo) {
    actualizarPaso(indice, { bloques: reasignarApoyo(pasos[indice].bloques, bloqueId, destino) })
    setDestinoDeBloqueId(null)
  }

  // Enter en una tarea inserta otra debajo y la enfoca; pegar varias
  // lineas las reparte en tareas seguidas. Son atajos de teclado que un
  // mockup estatico no puede mostrar, pero que el editor conserva.
  function insertarTareaDespues(indice: number, bloqueId: string) {
    const bloques = pasos[indice].bloques
    const pos = bloques.findIndex((b) => b.id === bloqueId)
    const nueva = crearBloqueTarea()
    const copia = [...bloques]
    copia.splice(pos + 1, 0, nueva)
    actualizarPaso(indice, { bloques: copia })
    setFocoBloqueId(nueva.id)
  }

  function pegarLineas(indice: number, bloqueId: string, texto: string, evento: { preventDefault: () => void }) {
    const lineas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lineas.length <= 1) return
    evento.preventDefault()
    const bloques = [...pasos[indice].bloques]
    const pos = bloques.findIndex((b) => b.id === bloqueId)
    bloques[pos] = { ...bloques[pos], texto: lineas[0] }
    const extra = lineas.slice(1).map((linea) => ({ ...crearBloqueTarea(), texto: linea }))
    bloques.splice(pos + 1, 0, ...extra)
    actualizarPaso(indice, { bloques })
  }

  function moverPasoA(desde: number, hasta: number) {
    if (desde === hasta || hasta < 0 || hasta >= pasos.length) return
    const copia = [...pasos]
    const [movido] = copia.splice(desde, 1)
    copia.splice(hasta, 0, movido)
    onPasosChange(copia)
  }

  function moverPaso(indice: number, direccion: -1 | 1) {
    moverPasoA(indice, indice + direccion)
  }

  // ARRASTRE PARA REORDENAR (tablero 6b). Antes reordenar era ±1:
  // `moverPaso` intercambia con el vecino, así que llevar el paso 6 al 2
  // eran cuatro toques en un botón de 32 px. Ahora el asa arrastra.
  //
  // No se usa la API de arrastre de HTML5 (`draggable`) porque no
  // existe en los navegadores móviles, que es justo donde se escribe la
  // guía: se implementa con eventos de puntero, que sí cubren dedo,
  // ratón y lápiz con el mismo código.
  //
  // Durante el arrastre NO se reordena el array. Se miden las tarjetas
  // una vez, al agarrar, y se mueven con `transform`; el array se toca
  // una sola vez al soltar. Reordenar en vivo obligaría a volver a medir
  // en cada movimiento, porque el propio reordenamiento cambia el sitio
  // de la tarjeta que el dedo está sujetando.
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const refsPasos = useRef<(HTMLDivElement | null)[]>([])

  // ABRIR UN APOYO HEREDADO DESDE EL ACCESO "SIN ASIGNAR" (tarea 7 del
  // encargo). Despliega su paso, lo trae a la vista y abre el selector
  // de destino: llegar hasta el bloque era justo lo que no habia forma
  // de hacer en una guia de siete pasos.
  useEffect(() => {
    if (!apoyoDestacadoId) return
    const indice = pasos.findIndex((paso) => paso.bloques.some((b) => b.id === apoyoDestacadoId))
    if (indice < 0) {
      onApoyoDestacadoAbierto?.()
      return
    }
    onPasoActivoChange(pasos[indice].id)
    setDestinoDeBloqueId(apoyoDestacadoId)
    refsPasos.current[indice]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onApoyoDestacadoAbierto?.()
    // Solo reacciona al apoyo pedido: incluir `pasos` lo relanzaria en
    // cada tecla que el autor escriba dentro del paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apoyoDestacadoId])
  const medidasRef = useRef<{ arriba: number; alto: number }[]>([])
  const inicioYRef = useRef(0)
  const [arrastre, setArrastre] = useState<{ indice: number; destino: number; dy: number } | null>(null)

  function iniciarArrastre(evento: EventoPuntero<HTMLButtonElement>, indice: number) {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const base = contenedor.getBoundingClientRect().top
    medidasRef.current = refsPasos.current.slice(0, pasos.length).map((elemento) => {
      const caja = elemento?.getBoundingClientRect()
      return caja ? { arriba: caja.top - base, alto: caja.height } : { arriba: 0, alto: 0 }
    })
    inicioYRef.current = evento.clientY
    // La captura es lo que hace que el dedo siga mandando aunque salga
    // del asa. Si el navegador la rechaza (puntero ya liberado) el
    // arrastre sigue funcionando mientras el dedo no se salga, así que
    // no vale la pena abortarlo.
    try {
      evento.currentTarget.setPointerCapture(evento.pointerId)
    } catch {
      // sin captura, pero el arrastre sigue
    }
    // Agarrar el asa NO cambia el paso activo desde la tarea 219, y es
    // una condición del plegado, no una preferencia: el paso activo es
    // el único desplegado, así que activarlo aquí lo haría crecer
    // JUSTO DESPUÉS de medir las tarjetas, y todas las posiciones que
    // acaba de calcular esta función quedarían mintiendo. Por eso el
    // `onPointerDownCapture` de la tarjeta también se salta el asa.
    setArrastre({ indice, destino: indice, dy: 0 })
  }

  function moverArrastre(evento: EventoPuntero<HTMLButtonElement>) {
    if (!arrastre) return
    const medidas = medidasRef.current
    const propia = medidas[arrastre.indice]
    if (!propia) return
    const dy = evento.clientY - inicioYRef.current
    const centro = propia.arriba + propia.alto / 2 + dy
    let destino = arrastre.indice
    for (let j = 0; j < medidas.length; j += 1) {
      if (j === arrastre.indice) continue
      const centroJ = medidas[j].arriba + medidas[j].alto / 2
      if (j < arrastre.indice && centro < centroJ) destino = Math.min(destino, j)
      if (j > arrastre.indice && centro > centroJ) destino = Math.max(destino, j)
    }
    setArrastre({ indice: arrastre.indice, destino, dy })
  }

  function soltarArrastre() {
    if (arrastre) moverPasoA(arrastre.indice, arrastre.destino)
    setArrastre(null)
  }

  // Cuánto se corre cada tarjeta mientras dura el arrastre: la agarrada
  // sigue al dedo, y las que quedan entre su sitio y el destino se
  // apartan el alto de la agarrada para abrir el hueco donde va a caer.
  function desplazamientoDe(indice: number): string | undefined {
    if (!arrastre) return undefined
    if (indice === arrastre.indice) return `translateY(${arrastre.dy}px)`
    const propia = medidasRef.current[arrastre.indice]
    if (!propia) return undefined
    const salto = propia.alto + HUECO_ENTRE_PASOS
    if (arrastre.destino > arrastre.indice && indice > arrastre.indice && indice <= arrastre.destino) {
      return `translateY(${-salto}px)`
    }
    if (arrastre.destino < arrastre.indice && indice >= arrastre.destino && indice < arrastre.indice) {
      return `translateY(${salto}px)`
    }
    return undefined
  }

  // El asa también responde al teclado (±1): sin esto reordenar sería
  // imposible sin puntero, y la app se usa además en PC.
  function tecladoAsa(evento: EventoTeclado<HTMLButtonElement>, indice: number) {
    if (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') return
    evento.preventDefault()
    moverPaso(indice, evento.key === 'ArrowUp' ? -1 : 1)
  }

  function confirmarEliminarPaso() {
    if (pasoAEliminar === null) return
    onPasosChange(pasos.filter((_, i) => i !== pasoAEliminar))
    setPasoAEliminar(null)
    setMenuPasoId(null)
  }

  // Sube (o encola sin conexion) una imagen y la deja como adjunto del
  // bloque. Las fotos pesadas se recomprimen en el telefono antes de subir.
  async function subirImagen(indice: number, bloqueId: string, evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setError(null)
    setAviso(null)
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    setSubiendoBloqueId(bloqueId)
    try {
      const archivoFinal = await comprimirImagen(archivo)
      const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `articulos/${articuloId}/pasos/${Date.now()}-${nombreLimpio}`
      const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
      if (resultado === 'encolado') {
        setAviso('Sin conexión: la imagen quedó guardada en este dispositivo y se subirá sola al recuperar señal.')
      }
      const adjunto: PasoAdjunto = { referencia, nombre: archivoFinal.name, tipo: archivoFinal.type }
      actualizarBloque(indice, bloqueId, { adjunto })
    } catch {
      setError(`No se pudo subir la imagen: ${archivo.name}`)
    }
    setSubiendoBloqueId(null)
  }

  // Archivo de un bloque 'archivo': el manual o la planilla que hace
  // falta EN ESTE PUNTO, a diferencia de la galeria del paso completo.
  // Comparte la subida con la imagen (comprimirImagen deja pasar
  // intactos los PDF y documentos), solo cambia el bloque destino.
  async function subirArchivoBloque(indice: number, bloqueId: string, evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setError(null)
    setAviso(null)
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    setSubiendoBloqueId(bloqueId)
    try {
      const archivoFinal = await comprimirImagen(archivo)
      const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `articulos/${articuloId}/pasos/${Date.now()}-${nombreLimpio}`
      const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
      if (resultado === 'encolado') {
        setAviso('Sin conexión: el archivo quedó guardado en este dispositivo y se subirá solo al recuperar señal.')
      }
      actualizarBloque(indice, bloqueId, {
        adjunto: { referencia, nombre: archivoFinal.name, tipo: archivoFinal.type },
      })
    } catch {
      setError(`No se pudo subir el archivo: ${archivo.name}`)
    }
    setSubiendoBloqueId(null)
  }

  // Adjuntos del paso completo (un manual, un PDF, una planilla), a
  // diferencia de los bloques imagen, que son capturas ancladas a una
  // tarea concreta. La fase J5 repone su edicion: el dato ya se
  // guardaba y la ficha del articulo ya los mostraba, pero desde el
  // rediseño del editor no habia forma de agregarlos ni quitarlos.
  async function subirAdjuntosPaso(indice: number, evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''
    if (archivos.length === 0) return

    setError(null)
    setAviso(null)
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    const paso = pasos[indice]
    setSubiendoAdjuntoPasoId(paso.id)
    const nuevos: PasoAdjunto[] = []
    let algunoEncolado = false
    for (const archivo of archivos) {
      try {
        // Las fotos se recomprimen; los PDF y documentos pasan intactos.
        const archivoFinal = await comprimirImagen(archivo)
        const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
        const referencia = `articulos/${articuloId}/pasos/${Date.now()}-${nombreLimpio}`
        const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
        if (resultado === 'encolado') algunoEncolado = true
        nuevos.push({ referencia, nombre: archivoFinal.name, tipo: archivoFinal.type })
      } catch {
        setError(`No se pudo subir el archivo: ${archivo.name}`)
      }
    }
    if (nuevos.length > 0) {
      actualizarPaso(indice, { adjuntos: [...(paso.adjuntos ?? []), ...nuevos] })
    }
    if (algunoEncolado) {
      setAviso('Sin conexión: los archivos quedaron guardados en este dispositivo y se subirán solos al recuperar señal.')
    }
    setSubiendoAdjuntoPasoId(null)
  }

  function quitarAdjuntoPaso(indice: number, referencia: string) {
    actualizarPaso(indice, {
      adjuntos: (pasos[indice].adjuntos ?? []).filter((a) => a.referencia !== referencia),
    })
  }

  // Paso sobre el que actúa la barra fija de añadir. Si el activo
  // declarado ya no existe (lo acaban de eliminar) o todavía no se ha
  // tocado ninguno, manda el ÚLTIMO: es donde se está escribiendo.
  const indiceEncontrado = pasos.findIndex((p) => p.id === pasoActivoId)
  const indiceActivo = indiceEncontrado >= 0 ? indiceEncontrado : pasos.length - 1
  const idPasoActivo = indiceActivo >= 0 ? pasos[indiceActivo].id : null

  return (
    <div ref={contenedorRef} className="flex flex-col gap-3.5">
      {pasos.length === 0 && (
        <div className="mb-1 rounded-md border border-dashed border-noct-neutral-700 px-4 py-[22px] text-center">
          <p className="text-sm font-medium">Aún no hay pasos</p>
          <p className="mt-1 text-[13px] leading-[1.5] text-noct-neutral-400">
            Cada paso agrupa tareas con casilla, advertencias e imágenes.
          </p>
        </div>
      )}

      {pasos.map((paso, indice) => {
        // PLEGADO (tarea 219, hallazgo G-28). Solo el paso activo se
        // despliega; los demás quedan en una línea. Siete pasos pasaban
        // de más de 2.000 px de desplazamiento a unos 500, que es lo
        // que además devuelve el sentido al asa de arrastre: de nada
        // sirve poder agarrar una tarjeta si su destino está tres
        // pantallas más abajo.
        const desplegado = paso.id === idPasoActivo
        const tareas = paso.bloques.filter((b) => b.tipo === 'tarea').length
        return (
        <div
          key={paso.id}
          ref={(elemento) => {
            refsPasos.current[indice] = elemento
          }}
          // El borde de acento marca el paso ACTIVO: el que reciben los
          // cuatro botones de la barra fija y el que abre "Probar". Sin
          // esa marca, una barra que actúa "sobre un paso" no diría
          // sobre cuál. Desde el plegado marca además el único abierto.
          //
          // El asa se excluye a propósito: agarrarla para reordenar no
          // debe desplegar la tarjeta, porque `iniciarArrastre` ya midió
          // las posiciones con la altura que tenían (ver allí).
          onPointerDownCapture={(evento) => {
            if ((evento.target as HTMLElement).closest('[data-asa]')) return
            onPasoActivoChange(paso.id)
          }}
          onFocusCapture={() => onPasoActivoChange(paso.id)}
          style={{ transform: desplazamientoDe(indice) }}
          className={`flex flex-col rounded-xl border ${desplegado ? 'p-3' : 'px-3 py-1'} ${
            arrastre?.indice === indice
              ? 'z-10 border-noct-accent bg-noct-surface shadow-[0_18px_50px_rgba(0,0,0,.5)]'
              : `bg-noct-surface transition-transform ${
                  desplegado ? 'border-noct-accent/40' : 'border-transparent'
                }`
          }`}
        >
          {/* Cabecera: asa de arrastre, numero, titulo editable y menu. */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-asa
              aria-label={`Reordenar el paso ${indice + 1}: arrastrar, o flechas arriba y abajo`}
              onPointerDown={(evento) => iniciarArrastre(evento, indice)}
              onPointerMove={moverArrastre}
              onPointerUp={soltarArrastre}
              onPointerCancel={soltarArrastre}
              onKeyDown={(evento) => tecladoAsa(evento, indice)}
              // `touch-none`: sin esto el gesto lo captura el scroll de
              // la pagina y la tarjeta no llega a moverse.
              className="flex h-12 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-[9px] text-noct-neutral-400 hover:bg-noct-text/[.06] hover:text-noct-text active:cursor-grabbing"
            >
              <DotsSixVertical size={19} />
            </button>
            <div
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] font-mono text-[13px] font-semibold ${
                desplegado
                  ? 'border-noct-accent text-noct-accent-300'
                  : 'border-noct-neutral-700 text-noct-neutral-400'
              }`}
            >
              {indice + 1}
            </div>
            {desplegado ? (
              <input
                type="text"
                value={paso.titulo}
                onChange={(e) => actualizarPaso(indice, { titulo: e.target.value })}
                placeholder="Qué hacer en este paso"
                className="min-h-12 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-2 text-base font-medium text-noct-text outline-none focus:border-noct-accent focus:bg-noct-bg"
              />
            ) : (
              // Plegado: una línea que se lee y se toca. El título no es
              // un campo aquí a propósito, para que tocar la tarjeta
              // signifique "abrir este paso" y no "poner el cursor en su
              // título"; al abrirse, el campo está donde siempre.
              <button
                type="button"
                onClick={() => onPasoActivoChange(paso.id)}
                aria-expanded={false}
                className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-left"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[15px] ${
                    paso.titulo.trim() === '' ? 'text-noct-neutral-500' : 'font-medium text-noct-text'
                  }`}
                >
                  {paso.titulo.trim() === '' ? 'Paso sin título' : paso.titulo}
                </span>
                {tareas > 0 && (
                  <span className="shrink-0 text-[12.5px] text-noct-neutral-400">
                    {tareas} {tareas === 1 ? 'tarea' : 'tareas'}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMenuPasoId((actual) => (actual === paso.id ? null : paso.id))}
              aria-label="Opciones del paso: mover o eliminar"
              aria-expanded={menuPasoId === paso.id}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[9px] text-noct-neutral-300 hover:bg-noct-text/[.06] hover:text-noct-text"
            >
              <DotsThreeOutline size={20} />
            </button>
          </div>

          {menuPasoId === paso.id && (
            <div className="flex flex-wrap gap-2 py-2 pl-[38px]">
              <BotonMenu Icono={ArrowUp} onClick={() => moverPaso(indice, -1)}>
                Subir
              </BotonMenu>
              <BotonMenu Icono={ArrowDown} onClick={() => moverPaso(indice, 1)}>
                Bajar
              </BotonMenu>
              <BotonMenu Icono={TrashSimple} onClick={() => setPasoAEliminar(indice)} destructivo>
                Eliminar
              </BotonMenu>
            </div>
          )}

          {/* EL CUERPO SOLO EXISTE EN EL PASO ABIERTO (tarea 219,
              hallazgo G-28). No se oculta con CSS: no se monta. Un
              procedimiento de siete pasos tenía siete editores de
              bloques vivos a la vez, con sus campos y sus hojas, para
              que se viera uno. */}
          {desplegado && (
          <>
          <input
            type="text"
            value={paso.objetivo}
            onChange={(e) => actualizarPaso(indice, { objetivo: e.target.value })}
            placeholder="Objetivo: qué se logra al terminar"
            className="mb-2.5 ml-[38px] mt-1 min-h-11 max-w-[calc(100%-38px)] border-none bg-transparent px-2 py-1 text-[13.5px] text-noct-neutral-400 outline-none"
          />

          {/* Cuerpo del paso: tareas, advertencias e imagenes. Los cuatro
              botones de añadir ya no viven aquí: se fueron a la barra
              fija del pie (ver AccionesPaso, más abajo), que está
              siempre a la misma altura en el arco del pulgar en vez de
              moverse según lo largo que sea el paso. */}
          <div className="flex flex-col gap-1.5 border-t border-noct-divider pt-3">
            {paso.bloques.map((bloque) => (
              <BloqueEditor
                key={bloque.id}
                bloque={bloque}
                bloquesDelPaso={paso.bloques}
                activa={bloque.id === tareaActivaId}
                enfocar={focoBloqueId === bloque.id}
                onEnfocado={() => setFocoBloqueId(null)}
                subiendoImagen={subiendoBloqueId === bloque.id}
                onCambiar={(cambios) => actualizarBloque(indice, bloque.id, cambios)}
                onQuitar={() => quitarBloque(indice, bloque.id)}
                onEnter={() => insertarTareaDespues(indice, bloque.id)}
                onPegar={(texto, evento) => pegarLineas(indice, bloque.id, texto, evento)}
                onSubirImagen={(evento) => void subirImagen(indice, bloque.id, evento)}
                onSubirArchivo={(evento) => void subirArchivoBloque(indice, bloque.id, evento)}
                vinculables={vinculablesOrdenados}
                referenciasDisponibles={referenciasDisponibles}
                gruposProtegidos={[
                  { etiqueta: 'Datos protegidos del equipo', opciones: opcionesCampos },
                  { etiqueta: 'Secretos de la bóveda', opciones: opcionesCredenciales },
                ]}
                abrirDatoProtegido={datoDeTareaId === bloque.id}
                onDatoProtegidoAbierto={() => setDatoDeTareaId(null)}
                onSeleccionar={() => bloque.tipo === 'tarea' && setTareaActivaId(bloque.id)}
                onAnadirATarea={() => {
                  setTareaActivaId(bloque.id)
                  setHojaContenidoAbierta(true)
                }}
                onMover={(direccion) => moverTarea(indice, bloque.id, direccion)}
                onCambiarDestino={() => setDestinoDeBloqueId(bloque.id)}
                onAvisoCambioTipo={setAvisoCambioTipo}
                onRevisarVinculo={revisarVinculo}
                destinoAbierto={destinoDeBloqueId === bloque.id}
                onCerrarDestino={() => setDestinoDeBloqueId(null)}
                onElegirDestino={(destino) => cambiarDestino(indice, bloque.id, destino)}
              />
            ))}
            {paso.bloques.length === 0 && (
              <p className="py-1 text-[12.5px] text-noct-neutral-500">
                Sin líneas todavía. Añade una con la barra de abajo.
              </p>
            )}
          </div>

          {/* Archivos del paso completo (manual, PDF, planilla). */}
          <AdjuntosDelPaso
            adjuntos={paso.adjuntos ?? []}
            subiendo={subiendoAdjuntoPasoId === paso.id}
            onSubir={(evento) => void subirAdjuntosPaso(indice, evento)}
            onQuitar={(referencia) => quitarAdjuntoPaso(indice, referencia)}
          />

          {/* Vinculos del paso: informacion protegida, procedimiento o
              solucion. */}
          <div className="mt-2.5 border-t border-noct-divider pt-2">
            {vinculosPasoId === paso.id ? (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setVinculosPasoId(null)}
                  className="flex min-h-10 w-full items-center gap-2 px-0.5 py-1 text-left text-[12.5px] text-noct-neutral-400"
                >
                  <LinkSimple size={15} />
                  Vínculos del paso
                  <CaretUp size={12} className="ml-auto" />
                </button>
                <VinculoProtegidoDelPaso
                  vinculo={paso.vinculoProtegido}
                  gruposOpciones={[
                    { etiqueta: 'Datos protegidos del equipo', opciones: opcionesCampos },
                    { etiqueta: 'Secretos de la bóveda', opciones: opcionesCredenciales },
                  ]}
                  onElegir={(opcion) =>
                    actualizarPaso(indice, {
                      vinculoProtegido: { tipo: opcion.tipo, id: opcion.id, titulo: opcion.titulo },
                    })
                  }
                  onQuitar={() => actualizarPaso(indice, { vinculoProtegido: null })}
                />
                <VinculoDelPaso
                  Icono={BookOpen}
                  etiqueta="Procedimiento relacionado"
                  vinculado={paso.subArticuloId ? paso.subArticuloTitulo : null}
                  opciones={vinculablesOrdenados.map((a) => ({ id: a.id, titulo: a.titulo }))}
                  onElegir={(id) => {
                    const articulo = vinculablesOrdenados.find((a) => a.id === id)
                    if (articulo) {
                      revisarVinculo(articulo.id)
                      actualizarPaso(indice, {
                        subArticuloId: articulo.id,
                        subArticuloTitulo: articulo.titulo,
                        // Si el paso aun no tiene titulo, toma el de la
                        // tarea vinculada: asi la lista de pasos se lee
                        // como lista de tareas sin escribir dos veces lo mismo.
                        titulo: paso.titulo.trim() === '' ? articulo.titulo : paso.titulo,
                      })
                    }
                  }}
                  onQuitar={() => actualizarPaso(indice, { subArticuloId: null, subArticuloTitulo: '' })}
                  placeholderVacio="Vincular procedimiento que se ejecuta en este paso (opcional)"
                />
                <VinculoDelPaso
                  Icono={Wrench}
                  etiqueta="Solución si el paso falla"
                  vinculado={paso.solucionArticuloId ? paso.solucionArticuloTitulo : null}
                  opciones={vinculablesOrdenados.map((a) => ({ id: a.id, titulo: a.titulo }))}
                  onElegir={(id) => {
                    const articulo = vinculablesOrdenados.find((a) => a.id === id)
                    if (articulo) {
                      revisarVinculo(articulo.id)
                      actualizarPaso(indice, { solucionArticuloId: articulo.id, solucionArticuloTitulo: articulo.titulo })
                    }
                  }}
                  onQuitar={() => actualizarPaso(indice, { solucionArticuloId: null, solucionArticuloTitulo: '' })}
                  placeholderVacio="Vincular solución por si el paso falla (opcional)"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVinculosPasoId(paso.id)}
                className="flex min-h-14 w-full items-center gap-2.5 rounded-md px-0.5 py-1 text-left text-[13.5px] text-noct-neutral-400 hover:text-noct-text"
              >
                <LinkSimple size={16} className="shrink-0" />
                <span className="min-w-0 flex-1">Vínculos: dato protegido, procedimiento o solución</span>
                <CaretDown size={14} className="shrink-0" />
              </button>
            )}
          </div>
          </>
          )}
        </div>
        )
      })}

      {error && <p className="text-xs text-noct-error">{error}</p>}
      {aviso && <p className="text-xs text-noct-precaucion">{aviso}</p>}

      <button
        type="button"
        onClick={() => {
          const nuevo = { ...crearPaso(), bloques: [crearBloqueTarea()] }
          onPasosChange([...pasos, nuevo])
          onPasoActivoChange(nuevo.id)
          setFocoBloqueId(nuevo.bloques[0].id)
        }}
        className="mt-3 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-noct-neutral-700 text-base font-medium text-noct-accent-300 hover:border-noct-accent hover:bg-noct-accent/[.08]"
      >
        <Plus size={18} />
        Agregar paso {pasos.length + 1}
      </button>

      {/* BARRA FIJA DE AÑADIR (tablero 6b). Cuatro objetivos de 56 px en
          el arco del pulgar, siempre en el mismo sitio, que actúan sobre
          el paso activo (el del borde de acento). Antes eran cuatro
          botones de 31 px de alto dentro de la tarjeta, es decir los
          controles más usados del editor en sus objetivos más pequeños,
          y además cambiaban de altura con cada paso. Se pinta por portal
          dentro de la barra del formulario para que siga habiendo UNA
          sola barra fija (ver ranuraAccionesPaso.tsx). */}
      {indiceActivo >= 0 && (
        <AccionesPaso>
          <div className="flex gap-1.5 border-b border-noct-divider pb-2">
            <BotonAnadir
              Icono={Plus}
              onClick={() => agregarBloque(indiceActivo, crearBloqueTarea())}
              descripcion={`Añadir una tarea al paso ${indiceActivo + 1}`}
            >
              Tarea
            </BotonAnadir>
            <BotonAnadir
              Icono={Warning}
              onClick={() => agregarBloque(indiceActivo, crearBloqueAviso())}
              descripcion={`Añadir un aviso al paso ${indiceActivo + 1}`}
            >
              Aviso
            </BotonAnadir>
            <BotonAnadir
              Icono={Camera}
              onClick={() => agregarBloque(indiceActivo, crearBloqueImagen())}
              descripcion={`Añadir una foto al paso ${indiceActivo + 1}`}
            >
              Foto
            </BotonAnadir>
            {/* EL MENÚ DE LOS OCHO TIPOS (sección 4 del encargo). Antes
                aquí solo cabían cuatro cosas y el archivo, la guía
                vinculada y el dato protegido vivían escondidos en
                "Vínculos del paso", es decir a nivel de paso y nunca de
                tarea. Ahora se eligen por su nombre y caen en la tarea
                seleccionada. */}
            <BotonAnadir
              Icono={Plus}
              onClick={() => setHojaContenidoAbierta(true)}
              descripcion={`Añadir otro tipo de contenido al paso ${indiceActivo + 1}`}
            >
              Más
            </BotonAnadir>
          </div>
        </AccionesPaso>
      )}

      {/* Catálogo de contenido. El subtítulo dice a qué tarea va a caer
          lo que se elija, porque el alcance por defecto es la tarea
          seleccionada y eso tiene que verse antes de elegir. */}
      <HojaTipoBloque
        abierto={hojaContenidoAbierta && indiceActivo >= 0}
        onCerrar={() => setHojaContenidoAbierta(false)}
        titulo={
          indiceActivo >= 0
            ? `Añadir a ${etiquetaDestinoActivo(pasos[indiceActivo].bloques, destinoPorDefecto(indiceActivo))}`
            : 'Añadir contenido'
        }
        opciones={CONTENIDOS}
        // Sin nada marcado: es un menú de lo que se puede AÑADIR, no un
        // selector de estado. Con "Acción" marcada parecía que el
        // bloque ya era de ese tipo.
        seleccionado={'' as ClaveContenido}
        onElegir={(clave) => indiceActivo >= 0 && agregarContenido(indiceActivo, clave)}
      />

      {/* Requisito 7: lo que se soltaría al cambiar de tipo se dice, no
          se descubre después. */}
      {avisoCambioTipo && (
        <div className="fixed inset-x-3 bottom-[168px] z-30 rounded-xl border border-noct-precaucion/50 bg-noct-bg px-3.5 py-3 shadow-[0_10px_40px_rgba(0,0,0,.55)]">
          <p className="text-[13px] leading-snug text-noct-precaucion">{avisoCambioTipo}</p>
          <button
            type="button"
            onClick={() => setAvisoCambioTipo(null)}
            className="mt-1.5 min-h-11 text-[13px] font-medium text-noct-accent-300"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Elegir (o crear) la referencia que se va a insertar. Vive
          aqui, en el editor completo, y no dentro de un bloque: el
          bloque todavia no existe, y crearlo antes dejaria una fila
          vacia en el paso si el autor cancela. */}
      {referenciaNueva && (
        <SelectorReferencia
          abierto
          onCerrar={() => setReferenciaNueva(null)}
          tipo={referenciaNueva.tipo}
          referencias={referenciasDisponibles}
          onElegir={(referencia) => {
            const { indice, tipo } = referenciaNueva
            // `agregarBloque` resuelve el destino con la tarea activa,
            // igual que una imagen o un aviso: la referencia se cuelga
            // SOLO de la tarea seleccionada, nunca del paso entero
            // mientras haya una tarea donde ponerla.
            agregarBloque(indice, {
              ...crearBloqueReferencia(referencia.tipo || tipo),
              referenciaId: referencia.id,
              referenciaTitulo: referencia.titulo,
            })
            setReferenciaNueva(null)
          }}
        />
      )}

      <DialogoEliminar
        abierto={pasoAEliminar !== null}
        titulo={`¿Eliminar el paso ${(pasoAEliminar ?? 0) + 1}?`}
        descripcion="Se quitará el paso del procedimiento. El cambio se aplica al guardar el artículo."
        textoConfirmar="Eliminar paso"
        onCerrar={() => setPasoAEliminar(null)}
        onConfirmar={confirmarEliminarPaso}
      />
    </div>
  )
}

// Archivos del paso completo: el manual del fabricante, un PDF o una
// planilla que acompaña a TODO el paso, no a una tarea suelta (para eso
// estan los bloques imagen). La ficha del artículo ya los mostraba
// (AdjuntosPaso en ProcedimientoVista); la fase J5 repone la forma de
// agregarlos y quitarlos, que el rediseño del editor habia perdido.
function AdjuntosDelPaso({
  adjuntos,
  subiendo,
  onSubir,
  onQuitar,
}: {
  adjuntos: PasoAdjunto[]
  subiendo: boolean
  onSubir: (evento: ChangeEvent<HTMLInputElement>) => void
  onQuitar: (referencia: string) => void
}) {
  return (
    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-noct-divider pt-2">
      {adjuntos.map((adjunto) => (
        <div
          key={adjunto.referencia}
          className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-noct-divider bg-noct-surface px-3"
        >
          <p className="flex min-w-0 items-center gap-2.5 truncate text-[13px] text-noct-text">
            <Paperclip size={15} className="shrink-0 text-noct-neutral-400" />
            <span className="min-w-0 truncate">{adjunto.nombre}</span>
          </p>
          <button
            type="button"
            onClick={() => onQuitar(adjunto.referencia)}
            aria-label={`Quitar el archivo ${adjunto.nombre}`}
            className="shrink-0 p-1 text-xs text-noct-neutral-500 hover:text-noct-text"
          >
            Quitar
          </button>
        </div>
      ))}
      <label className="flex min-h-10 cursor-pointer items-center gap-2 px-0.5 py-1 text-[12.5px] text-noct-neutral-500 hover:text-noct-text">
        <Paperclip size={15} />
        {subiendo ? 'Subiendo...' : 'Adjuntar archivo del paso: manual, PDF o planilla'}
        <input type="file" multiple className="hidden" disabled={subiendo} onChange={onSubir} />
      </label>
    </div>
  )
}

// Boton del menu del paso (subir, bajar, eliminar).
function BotonMenu({
  Icono,
  onClick,
  destructivo = false,
  children,
}: {
  Icono: ComponentType<IconoProps>
  onClick: () => void
  destructivo?: boolean
  children: string
}) {
  // 48 px, el mínimo táctil del sistema. Antes medían 32 y eran la
  // única forma de reordenar; ahora el asa hace el grueso del trabajo y
  // estos quedan como el camino accesible y el de eliminar.
  const base =
    'inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium leading-tight'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        destructivo
          ? `${base} border-transparent text-noct-error hover:bg-noct-error/10`
          : `${base} border-noct-divider text-noct-text hover:bg-noct-text/[.07]`
      }
    >
      <Icono size={15} />
      {children}
    </button>
  )
}

// Boton de la barra fija de añadir (tarea, aviso, foto, reusar). Icono
// arriba y palabra debajo, 56 px de alto y un cuarto del ancho cada uno:
// cuatro objetivos grandes, iguales y siempre en el mismo sitio. El
// `descripcion` va al aria-label porque la palabra sola ("Tarea") no
// dice a qué paso se añade.
function BotonAnadir({
  Icono,
  onClick,
  descripcion,
  children,
}: {
  Icono: ComponentType<IconoProps>
  onClick: () => void
  descripcion: string
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={descripcion}
      className="flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[9px] text-[11.5px] font-medium text-noct-accent-300 hover:bg-noct-accent/[.12] active:bg-noct-accent/[.2]"
    >
      <Icono size={20} />
      {children}
    </button>
  )
}

// Un vinculo del paso (subprocedimiento o solucion): sin vinculo, un
// recuadro punteado que abre `HojaVinculo` (buscador, tarea 212);
// vinculado, una fila solida con el titulo de referencia y un botón
// para quitar. Sin candidatos para elegir, no se muestra nada.
function VinculoDelPaso({
  Icono,
  etiqueta,
  vinculado,
  opciones,
  onElegir,
  onQuitar,
  placeholderVacio,
}: {
  Icono: ComponentType<IconoProps>
  etiqueta: string
  vinculado: string | null
  opciones: { id: string; titulo: string }[]
  onElegir: (id: string) => void
  onQuitar: () => void
  placeholderVacio: string
}) {
  const [abierta, setAbierta] = useState(false)

  if (vinculado) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-noct-divider bg-noct-surface px-3">
        <p className="flex min-w-0 items-center gap-2.5 truncate text-[13px] text-noct-text">
          <Icono size={15} className="shrink-0 text-noct-neutral-400" />
          <span className="min-w-0 truncate">
            {etiqueta}: {vinculado}
          </span>
        </p>
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 p-1 text-xs text-noct-neutral-500 hover:text-noct-text"
        >
          Quitar
        </button>
      </div>
    )
  }

  if (opciones.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="relative flex min-h-11 w-full items-center rounded-md border border-dashed border-noct-neutral-700 bg-transparent pl-9 pr-3 text-left text-[13px] text-noct-neutral-400 hover:border-noct-neutral-500 hover:text-noct-text"
      >
        <Icono size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-noct-neutral-400" />
        <span className="min-w-0 flex-1 truncate">{placeholderVacio}</span>
      </button>
      <HojaVinculo
        abierto={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={etiqueta}
        placeholderBuscar={`Buscar en ${opciones.length} ${opciones.length === 1 ? 'guía' : 'guías'}`}
        grupos={[{ opciones }]}
        onElegir={onElegir}
      />
    </>
  )
}

// Vinculo protegido del paso (grupo P2): "Vincular información
// protegida" reemplaza al viejo "Datos de la bóveda", que solo podía
// apuntar a una credencial. Mismo aspecto que VinculoDelPaso, pero con
// dos grupos de opciones (datos protegidos del equipo primero, secretos
// globales después) que `HojaVinculo` separa con su encabezado de
// grupo (tarea 212, antes un <optgroup> nativo). El id de cada opción
// se codifica "tipo:id" porque el id por si solo no basta para saber a
// que tabla apuntar; se decodifica al elegir.
function VinculoProtegidoDelPaso({
  vinculo,
  gruposOpciones,
  onElegir,
  onQuitar,
}: {
  vinculo: { tipo: TipoVinculoProtegido; id: string; titulo: string } | null
  gruposOpciones: { etiqueta: string; opciones: OpcionVinculoProtegido[] }[]
  onElegir: (opcion: OpcionVinculoProtegido) => void
  onQuitar: () => void
}) {
  const [abierta, setAbierta] = useState(false)

  if (vinculo) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-noct-divider bg-noct-surface px-3">
        <p className="flex min-w-0 items-center gap-2.5 truncate text-[13px] text-noct-text">
          <LockSimple size={15} className="shrink-0 text-noct-neutral-400" />
          <span className="min-w-0 truncate">Información protegida: {vinculo.titulo}</span>
        </p>
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 p-1 text-xs text-noct-neutral-500 hover:text-noct-text"
        >
          Quitar
        </button>
      </div>
    )
  }

  const totalOpciones = gruposOpciones.reduce((total, g) => total + g.opciones.length, 0)
  if (totalOpciones === 0) return null

  const grupos: GrupoVinculo[] = gruposOpciones.map((g) => ({
    etiqueta: g.etiqueta,
    opciones: g.opciones.map((o) => ({ id: `${o.tipo}:${o.id}`, titulo: o.titulo })),
  }))

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="relative flex min-h-11 w-full items-center rounded-md border border-dashed border-noct-neutral-700 bg-transparent pl-9 pr-3 text-left text-[13px] text-noct-neutral-400 hover:border-noct-neutral-500 hover:text-noct-text"
      >
        <LockSimple size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-noct-neutral-400" />
        <span className="min-w-0 flex-1 truncate">Vincular información protegida (opcional)</span>
      </button>
      <HojaVinculo
        abierto={abierta}
        onCerrar={() => setAbierta(false)}
        titulo="Información protegida"
        placeholderBuscar={`Buscar en ${totalOpciones} ${totalOpciones === 1 ? 'dato' : 'datos'}`}
        grupos={grupos}
        onElegir={(idCompuesto) => {
          const separador = idCompuesto.indexOf(':')
          const tipo = idCompuesto.slice(0, separador) as TipoVinculoProtegido
          const id = idCompuesto.slice(separador + 1)
          const opcion = gruposOpciones.flatMap((g) => g.opciones).find((o) => o.tipo === tipo && o.id === id)
          if (opcion) onElegir(opcion)
        }}
      />
    </>
  )
}

// Un bloque del cuerpo de un paso, segun su tipo: tarea, advertencia o
// imagen. Cada uno lleva el mismo patron del mockup (un control a la
// izquierda que cicla el tipo/tono, el contenido, y la X para quitar).
function BloqueEditor({
  bloque,
  bloquesDelPaso,
  activa,
  enfocar,
  onEnfocado,
  subiendoImagen,
  onCambiar,
  onQuitar,
  onEnter,
  onPegar,
  onSubirImagen,
  onSubirArchivo,
  vinculables,
  referenciasDisponibles,
  gruposProtegidos,
  abrirDatoProtegido,
  onDatoProtegidoAbierto,
  onSeleccionar,
  onAnadirATarea,
  onMover,
  onCambiarDestino,
  onAvisoCambioTipo,
  onRevisarVinculo,
  destinoAbierto,
  onCerrarDestino,
  onElegirDestino,
}: {
  bloque: BloquePaso
  // Todo el paso: hace falta para numerar las tareas en el selector de
  // destino y para saber a cuál pertenece este apoyo.
  bloquesDelPaso: BloquePaso[]
  activa: boolean
  enfocar: boolean
  onEnfocado: () => void
  subiendoImagen: boolean
  onCambiar: (cambios: Partial<BloquePaso>) => void
  onQuitar: () => void
  onEnter: () => void
  onPegar: (texto: string, evento: { preventDefault: () => void }) => void
  onSubirImagen: (evento: ChangeEvent<HTMLInputElement>) => void
  onSubirArchivo: (evento: ChangeEvent<HTMLInputElement>) => void
  vinculables: Articulo[]
  referenciasDisponibles: Referencia[]
  gruposProtegidos: { etiqueta?: string; opciones: OpcionVinculoProtegido[] }[]
  abrirDatoProtegido: boolean
  onDatoProtegidoAbierto: () => void
  onSeleccionar: () => void
  onAnadirATarea: () => void
  onMover: (direccion: -1 | 1) => void
  onCambiarDestino: () => void
  onAvisoCambioTipo: (aviso: string) => void
  onRevisarVinculo: (destinoId: string) => void
  destinoAbierto: boolean
  onCerrarDestino: () => void
  onElegirDestino: (destino: DestinoApoyo) => void
}) {
  // Una sola bandera para las dos hojas de TIPO (tarea o tono): un
  // bloque es de un tipo o del otro, nunca de los dos, así que no
  // pueden abrirse a la vez. El vínculo "Si responde No" es un
  // concepto aparte (puede convivir con la de tipo cerrada) y lleva su
  // propia bandera.
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [hojaDecisionAbierta, setHojaDecisionAbierta] = useState(false)
  const [hojaProtegidaAbierta, setHojaProtegidaAbierta] = useState(false)
  const [hojaGuiaAbierta, setHojaGuiaAbierta] = useState(false)
  const [hojaIntencionAbierta, setHojaIntencionAbierta] = useState(false)
  const [hojaReferenciaAbierta, setHojaReferenciaAbierta] = useState(false)

  // El catálogo del pie puede pedir que se abra el selector de dato
  // protegido de ESTA tarea ("Añadir · Dato protegido").
  useEffect(() => {
    if (!abrirDatoProtegido) return
    setHojaProtegidaAbierta(true)
    onDatoProtegidoAbierto()
  }, [abrirDatoProtegido, onDatoProtegidoAbierto])

  // El selector de destino, común a todos los apoyos: dice a qué tarea
  // pertenece y permite cambiarlo. Es lo que faltaba en el editor
  // (hallazgo H03: los controles decían "al paso" y no había forma de
  // señalar una tarea).
  const selectorDestino = (
    <HojaTipoBloque
      abierto={destinoAbierto}
      onCerrar={onCerrarDestino}
      titulo="¿A qué pertenece?"
      opciones={[
        {
          valor: '__paso',
          etiqueta: 'Todo el paso',
          descripcion: 'Se ve al entrar al paso, sin repetirse en cada tarea',
          Icono: Signpost,
          claseIcono: 'text-noct-neutral-300',
        },
        ...opcionesDestino(bloquesDelPaso).map((o) => ({
          valor: o.id,
          etiqueta: `Tarea ${o.numero}`,
          descripcion: o.texto.trim() || 'Sin texto todavía',
          Icono: Square,
          claseIcono: 'text-noct-accent-300',
        })),
      ]}
      seleccionado={bloque.alcance === 'paso' ? '__paso' : (bloque.tareaId ?? '')}
      onElegir={(valor) => onElegirDestino(valor === '__paso' ? DESTINO_PASO : destinoTarea(valor))}
    />
  )

  if (bloque.tipo === 'tarea') {
    const info = infoTipoTarea(bloque.tipoTarea)
    return (
      <div
        onPointerDownCapture={onSeleccionar}
        onFocusCapture={onSeleccionar}
        className={`flex flex-col gap-1.5 rounded-[10px] ${
          activa ? 'bg-noct-accent/[.06] ring-1 ring-inset ring-noct-accent/25' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <PastillaTipo
            Icono={info.Icono}
            claseIcono={info.claseIcono}
            clasePastilla={info.clasePastilla}
            palabra={info.corto}
            etiqueta={`Tipo de línea: ${info.etiqueta}. Tocar para cambiarlo`}
            onClick={() => setHojaAbierta(true)}
          />
          <input
            type="text"
            value={bloque.texto}
            ref={(el) => {
              if (el && enfocar) {
                el.focus()
                onEnfocado()
              }
            }}
            onChange={(e) => onCambiar({ texto: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onEnter()
              }
            }}
            onPaste={(e) => onPegar(e.clipboardData.getData('text'), e)}
            placeholder={info.placeholder}
            className={`min-h-14 min-w-0 flex-1 text-[15.5px] ${CLASE_CAMPO_SIN_ANCHO}`}
          />
          <BotonQuitar onClick={onQuitar} etiqueta="Quitar esta línea" />
          <HojaTipoBloque
            abierto={hojaAbierta}
            onCerrar={() => setHojaAbierta(false)}
            titulo="Tipo de línea"
            opciones={OPCIONES_TIPO_TAREA}
            seleccionado={bloque.tipoTarea ?? 'accion'}
            // REQUISITO 7: cambiar de tipo no borra en silencio. Antes,
            // salir de "decisión" soltaba el vínculo del "No" sin decir
            // nada. Ahora se aplica el cambio Y se avisa de lo que
            // quedó fuera, con el nombre de lo que se soltó.
            onElegir={(tipoTarea) => {
              const { bloque: nuevo, perdido } = cambiarTipoTarea(bloque, tipoTarea)
              onCambiar({
                tipoTarea: nuevo.tipoTarea,
                decisionArticuloId: nuevo.decisionArticuloId,
                decisionArticuloTitulo: nuevo.decisionArticuloTitulo,
              })
              if (perdido.length > 0) {
                onAvisoCambioTipo(`Al pasar a «${infoTipoTarea(tipoTarea).etiqueta}» se soltó ${perdido.join(' y ')}.`)
              }
            }}
          />
        </div>

        {/* AÑADIR CONTENIDO A ESTA TAREA (requisito 2 del editor). Es
            el control que el informe pedía: los apoyos se cuelgan de la
            tarea desde su propia tarjeta, no de un botón que dice "al
            paso". Y el orden de tareas se cambia aquí mismo, con sus
            apoyos pegados (criterio A06). */}
        {/* Cuatro objetivos de 44 px en UNA fila a 360 px: el rótulo
            largo ("Añadir a esta tarea") no cabía junto a las flechas y
            partía la fila en dos. El destino lo dice el título de la
            hoja que se abre ("Añadir a la tarea 2"), y el aria-label lo
            dice para quien no la ve. */}
        <div className="flex items-center gap-1.5 pl-1">
          <BotonLinea Icono={Plus} onClick={onAnadirATarea} etiqueta="Añadir contenido a esta tarea">
            Añadir
          </BotonLinea>
          <BotonLinea
            Icono={LockSimple}
            onClick={() => setHojaProtegidaAbierta(true)}
            activo={bloque.vinculoProtegido !== null}
            etiqueta="Vincular un dato protegido a esta tarea"
          >
            {bloque.vinculoProtegido ? bloque.vinculoProtegido.titulo || 'Dato protegido' : 'Dato'}
          </BotonLinea>
          <span className="ml-auto flex shrink-0 gap-1.5">
            <BotonIconoLinea Icono={ArrowUp} etiqueta="Subir esta tarea con sus apoyos" onClick={() => onMover(-1)} />
            <BotonIconoLinea Icono={ArrowDown} etiqueta="Bajar esta tarea con sus apoyos" onClick={() => onMover(1)} />
          </span>
        </div>

        {bloque.vinculoProtegido && (
          <div className="ml-1 flex items-center justify-between gap-2 rounded-md border border-noct-divider bg-noct-bg px-2.5 py-1.5">
            <p className="min-w-0 truncate text-[12.5px] text-noct-neutral-300">
              <LockSimple size={12} className="mr-1 inline-block align-[-2px] text-noct-neutral-400" />
              Dato protegido: {bloque.vinculoProtegido.titulo || 'sin título'}
            </p>
            <button
              type="button"
              onClick={() => onCambiar({ vinculoProtegido: null })}
              className="shrink-0 p-1 text-xs text-noct-neutral-500 hover:text-noct-text"
            >
              Quitar
            </button>
          </div>
        )}

        <HojaVinculo
          abierto={hojaProtegidaAbierta}
          onCerrar={() => setHojaProtegidaAbierta(false)}
          titulo="Dato protegido de esta tarea"
          placeholderBuscar="Buscar un secreto o un campo protegido"
          grupos={gruposProtegidos}
          onElegir={(id) => {
            const opcion = gruposProtegidos.flatMap((g) => g.opciones).find((o) => o.id === id)
            if (opcion) {
              onCambiar({ vinculoProtegido: { tipo: opcion.tipo, id: opcion.id, titulo: opcion.titulo } })
            }
          }}
        />

        {bloque.tipoTarea === 'decision' &&
          (bloque.decisionArticuloId ? (
            <div className="ml-1 flex items-center justify-between gap-2 rounded-md border border-noct-precaucion/30 bg-noct-precaucion/10 px-2.5 py-2">
              <p className="min-w-0 truncate text-[12.5px] leading-[1.45]">
                <ArrowElbowDownRight size={13} className="mr-1 inline-block align-[-2px] text-noct-precaucion" />
                Si responde No: {bloque.decisionArticuloTitulo}
              </p>
              <button
                type="button"
                onClick={() => onCambiar({ decisionArticuloId: null, decisionArticuloTitulo: '' })}
                className="shrink-0 p-1 text-xs text-noct-neutral-500 hover:text-noct-text"
              >
                Quitar
              </button>
            </div>
          ) : (
            vinculables.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setHojaDecisionAbierta(true)}
                  className="relative ml-1 flex min-h-9 w-[calc(100%-4px)] items-center rounded-md border border-dashed border-noct-neutral-700 bg-transparent py-1 pl-8 pr-3 text-left text-[12.5px] text-noct-neutral-500 hover:border-noct-neutral-500 hover:text-noct-text"
                >
                  <ArrowElbowDownRight
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-noct-neutral-500"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    Si responde No, vincular una solución o procedimiento (opcional)
                  </span>
                </button>
                <HojaVinculo
                  abierto={hojaDecisionAbierta}
                  onCerrar={() => setHojaDecisionAbierta(false)}
                  titulo="Si responde No"
                  placeholderBuscar={`Buscar en ${vinculables.length} ${vinculables.length === 1 ? 'guía' : 'guías'}`}
                  grupos={[{ opciones: vinculables.map((a) => ({ id: a.id, titulo: a.titulo })) }]}
                  onElegir={(id) => {
                    const articulo = vinculables.find((a) => a.id === id)
                    if (articulo) {
                      onRevisarVinculo(articulo.id)
                      onCambiar({ decisionArticuloId: articulo.id, decisionArticuloTitulo: articulo.titulo })
                    }
                  }}
                />
              </>
            )
          ))}
      </div>
    )
  }

  // A PARTIR DE AQUÍ, LOS APOYOS. Todos llevan la misma cabecera: a qué
  // pertenecen, y el aviso cuando eso no se sabe.
  const cabeceraApoyo = (
    <CabeceraApoyo
      bloque={bloque}
      bloquesDelPaso={bloquesDelPaso}
      onCambiarDestino={onCambiarDestino}
      onQuitar={onQuitar}
    />
  )

  if (bloque.tipo === 'aviso') {
    const tono = infoTono(bloque.tono)
    return (
      <div className="ml-1 flex flex-col gap-1.5">
        {cabeceraApoyo}
        <div className="flex items-start gap-2">
          <PastillaTipo
            Icono={tono.Icono}
            claseIcono={tono.claseIcono}
            clasePastilla={tono.clasesPanel}
            palabra={tono.corto}
            etiqueta={`Tono del aviso: ${tono.etiqueta}. Tocar para cambiarlo`}
            onClick={() => setHojaAbierta(true)}
          />
          <div className={`min-w-0 flex-1 rounded-[9px] border-[1.5px] ${tono.clasesPanel}`}>
            <textarea
              rows={3}
              value={bloque.texto}
              ref={(el) => {
                if (el && enfocar) {
                  el.focus()
                  onEnfocado()
                }
              }}
              onChange={(e) => onCambiar({ texto: e.target.value })}
              placeholder="Texto del aviso"
              className="block min-h-14 w-full resize-y border-none bg-transparent px-3 py-2.5 text-[14.5px] leading-[1.45] text-noct-text outline-none"
            />
          </div>
        </div>
        <HojaTipoBloque
          abierto={hojaAbierta}
          onCerrar={() => setHojaAbierta(false)}
          titulo="Tono del aviso"
          opciones={OPCIONES_TONO}
          seleccionado={bloque.tono ?? 'info'}
          onElegir={(tono) => onCambiar({ tono })}
        />
        {selectorDestino}
      </div>
    )
  }

  if (bloque.tipo === 'archivo') {
    return (
      <div className="ml-1 flex flex-col gap-1.5">
        {cabeceraApoyo}
        <label className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-noct-neutral-700 px-3 text-[13px] text-noct-neutral-300 hover:border-noct-neutral-500 hover:text-noct-text">
          <Paperclip size={16} className="shrink-0 text-noct-neutral-400" />
          <span className="min-w-0 flex-1 truncate">
            {subiendoImagen ? 'Subiendo...' : (bloque.adjunto?.nombre ?? 'Elegir el archivo (manual, PDF o planilla)')}
          </span>
          <input type="file" className="hidden" disabled={subiendoImagen} onChange={onSubirArchivo} />
        </label>
        <input
          type="text"
          value={bloque.texto}
          onChange={(e) => onCambiar({ texto: e.target.value })}
          placeholder="Para qué sirve este archivo (opcional)"
          className="min-h-11 border-none bg-transparent px-0.5 py-1 text-xs text-noct-neutral-400 outline-none"
        />
        {selectorDestino}
      </div>
    )
  }

  // UNA REFERENCIA VINCULADA A ESTA TAREA (glosario, atajo o comando).
  //
  // Quitarla usa el mismo botón que el resto de apoyos (`cabeceraApoyo`)
  // y solo borra el BLOQUE: la ficha central sigue intacta en
  // Referencia, con todas las demás guías que la usan.
  if (bloque.tipo === 'referencia') {
    const viva = bloque.referenciaId
      ? referenciasDisponibles.find((r) => r.id === bloque.referenciaId)
      : undefined
    const tipoReferencia: TipoReferencia = viva?.tipo ?? bloque.referenciaTipo ?? 'termino'
    return (
      <div className="ml-1 flex flex-col gap-1.5">
        {cabeceraApoyo}
        <button
          type="button"
          onClick={() => setHojaReferenciaAbierta(true)}
          className="flex min-h-14 items-center gap-2.5 rounded-md border border-dashed border-noct-neutral-700 px-3 text-left text-[13px] text-noct-neutral-300 hover:border-noct-neutral-500 hover:text-noct-text"
        >
          <BookBookmark size={16} className="shrink-0 text-noct-neutral-400" />
          <span className="min-w-0 flex-1 truncate">
            {viva?.titulo || bloque.referenciaTitulo || `Elegir ${INFO_TIPO[tipoReferencia].etiqueta.toLowerCase()}`}
          </span>
          <CaretDown size={13} className="shrink-0" />
        </button>
        {/* El vínculo apunta a algo que no está en este dispositivo. Se
            dice y se conserva: puede llegar en la próxima
            sincronización, y borrarlo aquí destruiría el trabajo del
            autor por un estado temporal. */}
        {bloque.referenciaId && !viva && (
          <p className="px-0.5 text-[12px] leading-snug text-noct-precaucion">
            «{bloque.referenciaTitulo || 'Esta referencia'}» no está en este dispositivo. Se conserva el
            vínculo; se puede cambiar por otra o quitarlo.
          </p>
        )}
        <SelectorReferencia
          abierto={hojaReferenciaAbierta}
          onCerrar={() => setHojaReferenciaAbierta(false)}
          tipo={tipoReferencia}
          referencias={referenciasDisponibles}
          onElegir={(referencia) =>
            onCambiar({
              referenciaId: referencia.id,
              referenciaTitulo: referencia.titulo,
              referenciaTipo: referencia.tipo,
            })
          }
        />
        {selectorDestino}
      </div>
    )
  }

  if (bloque.tipo === 'guia') {
    const intencion = INTENCIONES_GUIA.find((i) => i.valor === (bloque.intencionGuia ?? 'necesario'))
    return (
      <div className="ml-1 flex flex-col gap-1.5">
        {cabeceraApoyo}
        <button
          type="button"
          onClick={() => setHojaGuiaAbierta(true)}
          className="flex min-h-14 items-center gap-2.5 rounded-md border border-dashed border-noct-neutral-700 px-3 text-left text-[13px] text-noct-neutral-300 hover:border-noct-neutral-500 hover:text-noct-text"
        >
          <BookOpen size={16} className="shrink-0 text-noct-neutral-400" />
          <span className="min-w-0 flex-1 truncate">
            {bloque.guiaArticuloTitulo || 'Elegir la guía que se hace en este punto'}
          </span>
          <CaretDown size={13} className="shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => setHojaIntencionAbierta(true)}
          className="flex min-h-11 items-center gap-2 self-start rounded-md border border-noct-divider px-2.5 text-[12.5px] text-noct-neutral-300 hover:text-noct-text"
        >
          {intencion?.Icono && <intencion.Icono size={13} className={intencion.claseIcono} />}
          {intencion?.etiqueta ?? 'Necesaria'}
          <CaretDown size={11} />
        </button>
        <HojaVinculo
          abierto={hojaGuiaAbierta}
          onCerrar={() => setHojaGuiaAbierta(false)}
          titulo="Guía vinculada"
          placeholderBuscar={`Buscar en ${vinculables.length} ${vinculables.length === 1 ? 'guía' : 'guías'}`}
          grupos={[{ opciones: vinculables.map((a) => ({ id: a.id, titulo: a.titulo })) }]}
          onElegir={(id) => {
            const articulo = vinculables.find((a) => a.id === id)
            if (articulo) {
              onRevisarVinculo(articulo.id)
              onCambiar({ guiaArticuloId: articulo.id, guiaArticuloTitulo: articulo.titulo })
            }
          }}
        />
        <HojaTipoBloque
          abierto={hojaIntencionAbierta}
          onCerrar={() => setHojaIntencionAbierta(false)}
          titulo="¿Para qué sirve este vínculo?"
          opciones={INTENCIONES_GUIA}
          seleccionado={bloque.intencionGuia ?? 'necesario'}
          onElegir={(intencionGuia) => onCambiar({ intencionGuia })}
        />
        {selectorDestino}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {cabeceraApoyo}
      <ImagenBloque
        bloque={bloque}
        subiendo={subiendoImagen}
        onCambiarPie={(texto) => onCambiar({ texto })}
        onQuitar={onQuitar}
        onSubir={onSubirImagen}
      />
      {selectorDestino}
    </div>
  )
}

// LA CABECERA DE UN APOYO: a qué pertenece, y el aviso cuando eso no se
// sabe.
//
// Es la pieza que cierra el hallazgo H03. Los controles del editor
// decían "Añadir una foto al paso", "Añadir un aviso al paso" y
// "Adjuntar archivo del paso", así que el autor no tenía forma de
// expresar a qué tarea pertenecía cada apoyo, y la ejecución los
// mostraba en todas.
//
// El caso 'sin-asignar' se señala en ámbar y NO se resuelve solo: es
// contenido escrito antes de que existiera el campo, y adivinarle un
// destino sería inventarle una intención al dato (sección 8 del
// encargo). Se conserva, se muestra una vez y se pide que lo asignen.
function CabeceraApoyo({
  bloque,
  bloquesDelPaso,
  onCambiarDestino,
  onQuitar,
}: {
  bloque: BloquePaso
  bloquesDelPaso: BloquePaso[]
  onCambiarDestino: () => void
  onQuitar: () => void
}) {
  const sinAsignar = bloque.alcance === 'sin-asignar'
  const etiqueta = etiquetaDestino(bloquesDelPaso, bloque)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCambiarDestino}
          aria-label={`Este apoyo pertenece a: ${etiqueta}. Tocar para cambiarlo`}
          className={`inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${
            sinAsignar
              ? 'border-noct-precaucion/55 bg-noct-precaucion/10 text-noct-precaucion'
              : 'border-noct-divider text-noct-neutral-300 hover:text-noct-text'
          }`}
        >
          {sinAsignar ? <Warning size={13} className="shrink-0" /> : <Signpost size={13} className="shrink-0" />}
          <span className="truncate">{etiqueta}</span>
          <CaretDown size={11} className="shrink-0" />
        </button>
        <button
          type="button"
          onClick={onQuitar}
          aria-label="Quitar este apoyo"
          className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] text-noct-neutral-400 hover:bg-noct-text/[.08] hover:text-noct-text"
        >
          <X size={16} />
        </button>
      </div>
      {/* La explicación va en su propia línea: a 360 px, al lado de la
          pastilla, se partía en cinco renglones de dos palabras. */}
      {sinAsignar && (
        <p className="text-[11.5px] leading-snug text-noct-precaucion/90">
          Viene de una versión anterior y no dice a qué tarea pertenece. Se muestra al entrar al paso hasta que
          lo asignes.
        </p>
      )}
    </div>
  )
}

// Botón pequeño de la fila de acciones de una tarea. 44 px de alto
// (regla R6): son controles que se tocan de pie y con una mano.
function BotonLinea({
  Icono,
  onClick,
  activo,
  etiqueta,
  children,
}: {
  Icono: ComponentType<IconoProps>
  onClick: () => void
  activo?: boolean
  etiqueta?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={`inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium ${
        activo
          ? 'border-noct-accent/45 bg-noct-accent/[.1] text-noct-accent-300'
          : 'border-noct-divider text-noct-neutral-300 hover:text-noct-text'
      }`}
    >
      <Icono size={14} className="shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}

function BotonIconoLinea({
  Icono,
  etiqueta,
  onClick,
}: {
  Icono: ComponentType<IconoProps>
  etiqueta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-noct-divider text-noct-neutral-400 hover:text-noct-text"
    >
      <Icono size={15} />
    </button>
  )
}

// Pastilla que ABRE el selector de tipo de una línea: la clasificación
// de una tarea o el tono de un aviso (tablero 6b).
//
// Es el cambio central del tablero. Antes era un icono de 18 px dentro
// de un objetivo de 36 de ancho que CICLABA: cada toque avanzaba al
// siguiente valor sin decir cuál venía, así que pasarse costaba dos
// toques más (y en los avisos, con cinco tonos, cuatro). Ahora mide
// 56 px, dice su palabra, y abre la lista con los valores descritos.
function PastillaTipo({
  Icono,
  claseIcono,
  clasePastilla,
  palabra,
  etiqueta,
  onClick,
}: {
  Icono: ComponentType<IconoProps>
  claseIcono: string
  clasePastilla: string
  palabra: string
  etiqueta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      onClick={onClick}
      className={`flex h-14 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border-[1.5px] px-[11px] hover:brightness-125 ${clasePastilla}`}
    >
      <Icono size={18} className={`shrink-0 ${claseIcono}`} />
      <span className={`text-[9.5px] font-semibold uppercase tracking-[.04em] ${claseIcono}`}>
        {palabra}
      </span>
    </button>
  )
}

// Boton de quitar (la X) comun a tareas y avisos. 48 px: era 32, y es
// el objetivo que está justo al lado del campo de texto que se acaba de
// escribir, así que fallarlo borra la línea equivocada.
function BotonQuitar({ onClick, etiqueta }: { onClick: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex h-14 w-12 shrink-0 items-center justify-center rounded-[9px] text-noct-neutral-400 hover:bg-noct-text/[.08] hover:text-noct-text"
    >
      <X size={17} />
    </button>
  )
}

// Bloque de imagen: el slot sube (o muestra) la captura y debajo va el
// pie de foto opcional. Sin imagen todavia, el slot es un area para
// elegirla; con imagen, la muestra.
function ImagenBloque({
  bloque,
  subiendo,
  onCambiarPie,
  onQuitar,
  onSubir,
}: {
  bloque: BloquePaso
  subiendo: boolean
  onCambiarPie: (texto: string) => void
  onQuitar: () => void
  onSubir: (evento: ChangeEvent<HTMLInputElement>) => void
}) {
  const url = useUrlAdjunto(bloque.adjunto?.referencia ?? null)
  const esImagen = bloque.adjunto?.tipo.startsWith('image/') ?? false

  return (
    <div className="ml-1 flex flex-col gap-1.5">
      <label className="flex h-[140px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-noct-neutral-700 text-center text-[12.5px] text-noct-neutral-400 hover:border-noct-neutral-500 hover:text-noct-text">
        {esImagen && url ? (
          <img src={url} alt={bloque.adjunto?.nombre ?? 'Imagen'} className="h-full w-full object-cover" />
        ) : (
          <span className="px-4">{subiendo ? 'Subiendo...' : 'Imagen explicativa del paso'}</span>
        )}
        <input type="file" accept="image/*" className="hidden" disabled={subiendo} onChange={onSubir} />
      </label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={bloque.texto}
          onChange={(e) => onCambiarPie(e.target.value)}
          placeholder="Pie de imagen (opcional)"
          className="min-h-8 min-w-0 flex-1 border-none bg-transparent px-0.5 py-1 text-xs text-noct-neutral-400 outline-none"
        />
        <button
          type="button"
          onClick={onQuitar}
          aria-label="Quitar la imagen"
          className="px-1.5 py-1 text-xs text-noct-neutral-600 hover:text-noct-text"
        >
          Quitar
        </button>
      </div>
    </div>
  )
}
