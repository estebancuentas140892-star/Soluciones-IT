import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import {
  db,
  type Articulo,
  type BloquePaso,
  type Credencial,
  type PasoAdjunto,
  type PasoProcedimiento,
  type TipoTarea,
  type TonoAviso,
} from '../../lib/db'
import {
  crearBloqueAviso,
  crearBloqueImagen,
  crearBloqueTarea,
  crearPaso,
  normalizarProcedimiento,
} from '../../lib/procedimiento'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { buscarArticulosSimilares, crearIndiceDesdeDocumentos } from '../busqueda/useIndiceBusqueda'
import { TONOS_AVISO } from './tonos'

interface Props {
  articuloId: string
  pasos: PasoProcedimiento[]
  onPasosChange: (pasos: PasoProcedimiento[]) => void
}

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Editor del procedimiento paso a paso dentro del formulario de
// articulo. Es un componente controlado: el estado vive en el
// formulario y aqui solo se edita. Cada paso sigue siempre la misma
// estructura: nombre, objetivo, tareas (bloques intercalados de
// tareas con casilla, advertencias e imagenes explicativas), archivos
// relacionados y los tres vinculos (datos de la boveda, procedimiento
// relacionado y solucion por si el paso falla).
export function PasosEditor({ articuloId, pasos, onPasosChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [subiendoPasoId, setSubiendoPasoId] = useState<string | null>(null)
  const [subiendoImagenPasoId, setSubiendoImagenPasoId] = useState<string | null>(null)
  const [pasoAEliminar, setPasoAEliminar] = useState<number | null>(null)

  // Credenciales de la boveda para vincular a un paso. Solo llegan a
  // este dispositivo las de usuarios con permiso de boveda (RLS); el
  // titulo es visible sin desbloquear, los secretos no.
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const credencialesOrdenadas = useMemo(
    () => [...credenciales].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [credenciales],
  )

  // Articulos con procedimiento que se pueden vincular a un paso,
  // como tarea reutilizable o como solucion por si el paso falla. Se
  // excluye el articulo en edicion (un procedimiento no puede
  // vincularse a si mismo).
  const vinculables = useLiveQuery(
    () =>
      db.articulos
        .filter(
          (a) =>
            !a.eliminadoEn &&
            a.id !== articuloId &&
            (a.estado ?? 'publicado') === 'publicado' &&
            normalizarProcedimiento(a.procedimiento) !== null,
        )
        .toArray(),
    [articuloId],
    [],
  )
  const vinculablesOrdenados = useMemo(
    () => [...vinculables].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [vinculables],
  )

  // Reutilizacion proactiva: al escribir el titulo de un paso se busca
  // entre los procedimientos vinculables uno de titulo parecido y se
  // ofrece vincularlo como tarea (el selector manual ya existia; esto
  // solo lo vuelve visible en el momento justo). Cada sugerencia se
  // puede descartar por paso.
  const indiceVinculables = useMemo(
    () =>
      crearIndiceDesdeDocumentos(
        vinculablesOrdenados.map((a) => ({
          id: `articulo:${a.id}`,
          tipo: 'articulo' as const,
          titulo: a.titulo,
          subtitulo: '',
          ruta: '',
          texto: a.titulo,
        })),
      ),
    [vinculablesOrdenados],
  )
  const [sugerenciasOcultas, setSugerenciasOcultas] = useState<ReadonlySet<string>>(new Set())

  function sugerenciaPara(paso: PasoProcedimiento): Articulo | null {
    if (paso.subArticuloId || sugerenciasOcultas.has(paso.id)) return null
    const similar = buscarArticulosSimilares(indiceVinculables, paso.titulo, '', 1)[0]
    if (!similar) return null
    const articuloId = String(similar.id).replace(/^articulo:/, '')
    return vinculablesOrdenados.find((a) => a.id === articuloId) ?? null
  }

  function descartarSugerencia(pasoId: string) {
    setSugerenciasOcultas((actuales) => new Set([...actuales, pasoId]))
  }

  function actualizarPaso(indice: number, cambios: Partial<PasoProcedimiento>) {
    onPasosChange(pasos.map((paso, i) => (i === indice ? { ...paso, ...cambios } : paso)))
  }

  function moverPaso(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion
    if (destino < 0 || destino >= pasos.length) return
    const copia = [...pasos]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    onPasosChange(copia)
  }

  function confirmarEliminarPaso() {
    if (pasoAEliminar === null) return
    onPasosChange(pasos.filter((_, i) => i !== pasoAEliminar))
    setPasoAEliminar(null)
  }

  // Sube (o encola offline) un lote de archivos y devuelve los adjuntos
  // creados. Compartido por la galeria del paso y por las imagenes
  // intercaladas en el cuerpo, para no duplicar la logica de subida.
  async function subirArchivos(
    archivos: File[],
  ): Promise<{ nuevos: PasoAdjunto[]; fallidos: string[]; encolados: number }> {
    const nuevos: PasoAdjunto[] = []
    const fallidos: string[] = []
    let encolados = 0

    for (const archivo of archivos) {
      try {
        // Las fotos pesadas se redimensionan y recomprimen en el
        // telefono antes de subir; los PDF y demas pasan sin tocar.
        const archivoFinal = await comprimirImagen(archivo)
        const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
        const referencia = `articulos/${articuloId}/pasos/${Date.now()}-${nombreLimpio}`

        // Sin conexion, el adjunto queda guardado en el telefono y la
        // cola de sincronizacion lo sube sola al recuperar señal.
        const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
        if (resultado === 'encolado') encolados += 1
        nuevos.push({ referencia, nombre: archivoFinal.name, tipo: archivoFinal.type })
      } catch {
        fallidos.push(archivo.name)
      }
    }

    return { nuevos, fallidos, encolados }
  }

  function reportarSubida(fallidos: string[], encolados: number) {
    if (fallidos.length > 0) setError(`No se pudo subir: ${fallidos.join(', ')}`)
    if (encolados > 0) {
      setAviso(
        encolados === 1
          ? 'Sin conexión: el archivo quedó guardado en este dispositivo y se subirá solo al recuperar señal.'
          : `Sin conexión: ${encolados} archivos quedaron guardados en este dispositivo y se subirán solos al recuperar señal.`,
      )
    }
  }

  // ¿Hay servidor configurado para subir? Deja el error listo si no.
  function servidorListo(): boolean {
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return false
    }
    return true
  }

  async function subirAdjuntos(indice: number, evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''
    if (archivos.length === 0) return

    setError(null)
    setAviso(null)
    if (!servidorListo()) return

    const paso = pasos[indice]
    setSubiendoPasoId(paso.id)
    const { nuevos, fallidos, encolados } = await subirArchivos(archivos)
    // Se agregan sobre los adjuntos que el paso tenia al empezar la
    // subida (una sola escritura al terminar todo el lote).
    if (nuevos.length > 0) actualizarPaso(indice, { adjuntos: [...paso.adjuntos, ...nuevos] })
    reportarSubida(fallidos, encolados)
    setSubiendoPasoId(null)
  }

  // Sube imagenes y las agrega como bloques 'imagen' al final del cuerpo
  // del paso (el tecnico las reordena con las flechas hasta la posicion
  // deseada, por ejemplo justo despues de una tarea).
  async function subirImagenBloque(indice: number, evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''
    if (archivos.length === 0) return

    setError(null)
    setAviso(null)
    if (!servidorListo()) return

    const paso = pasos[indice]
    setSubiendoImagenPasoId(paso.id)
    const { nuevos, fallidos, encolados } = await subirArchivos(archivos)
    if (nuevos.length > 0) {
      actualizarPaso(indice, { bloques: [...paso.bloques, ...nuevos.map(crearBloqueImagen)] })
    }
    reportarSubida(fallidos, encolados)
    setSubiendoImagenPasoId(null)
  }

  function quitarAdjunto(indice: number, referencia: string) {
    // Solo se quita la referencia del paso: el archivo queda en Storage
    // por si una version ya guardada del articulo lo usa.
    actualizarPaso(indice, {
      adjuntos: pasos[indice].adjuntos.filter((a) => a.referencia !== referencia),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {pasos.map((paso, indice) => (
        <div key={paso.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">Paso {indice + 1}</span>
            <div className="flex gap-1.5">
              <BotonPaso etiqueta={`Subir el paso ${indice + 1}`} onClick={() => moverPaso(indice, -1)} deshabilitado={indice === 0}>
                ↑
              </BotonPaso>
              <BotonPaso
                etiqueta={`Bajar el paso ${indice + 1}`}
                onClick={() => moverPaso(indice, 1)}
                deshabilitado={indice === pasos.length - 1}
              >
                ↓
              </BotonPaso>
              <BotonPaso etiqueta={`Eliminar el paso ${indice + 1}`} onClick={() => setPasoAEliminar(indice)}>
                ✕
              </BotonPaso>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Nombre</span>
            <input
              type="text"
              required
              value={paso.titulo}
              onChange={(e) => actualizarPaso(indice, { titulo: e.target.value })}
              placeholder="Qué hacer (por ejemplo: Conectar impresora)"
              className={CLASE_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">🎯 Objetivo</span>
            <input
              type="text"
              value={paso.objetivo}
              onChange={(e) => actualizarPaso(indice, { objetivo: e.target.value })}
              placeholder="Opcional, 1 línea: qué se logra al terminar el paso"
              className={`${CLASE_INPUT} text-sm`}
            />
          </label>

          <SugerenciaVinculo
            articulo={sugerenciaPara(paso)}
            onVincular={(articulo) =>
              actualizarPaso(indice, {
                subArticuloId: articulo.id,
                subArticuloTitulo: articulo.titulo,
              })
            }
            onDescartar={() => descartarSugerencia(paso.id)}
          />

          <div className="border-t border-slate-800/70 pt-3">
            <ContenidoEditor
              bloques={paso.bloques}
              vinculables={vinculablesOrdenados}
              credenciales={credencialesOrdenadas}
              onChange={(bloques) => actualizarPaso(indice, { bloques })}
              onSubirImagen={(evento) => void subirImagenBloque(indice, evento)}
              subiendoImagen={subiendoImagenPasoId === paso.id}
            />
          </div>

          <div className="border-t border-slate-800/70 pt-3">
            <AdjuntosPasoEditor
              paso={paso}
              subiendo={subiendoPasoId === paso.id}
              onSubir={(evento) => void subirAdjuntos(indice, evento)}
              onQuitar={(referencia) => quitarAdjunto(indice, referencia)}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800/70 pt-3">
            <CredencialSelector
              paso={paso}
              credenciales={credencialesOrdenadas}
              onVincular={(credencial) =>
                actualizarPaso(indice, {
                  credencialId: credencial.id,
                  credencialTitulo: credencial.titulo,
                })
              }
              onQuitar={() => actualizarPaso(indice, { credencialId: null, credencialTitulo: '' })}
            />

            <SubProcedimientoSelector
              paso={paso}
              articulos={vinculablesOrdenados}
              onVincular={(articulo) =>
                actualizarPaso(indice, {
                  subArticuloId: articulo.id,
                  subArticuloTitulo: articulo.titulo,
                  // Si el paso aun no tiene titulo, toma el de la tarea
                  // vinculada: asi la lista de pasos se lee como lista
                  // de tareas sin escribir dos veces lo mismo.
                  titulo: paso.titulo.trim() === '' ? articulo.titulo : paso.titulo,
                })
              }
              onQuitar={() => actualizarPaso(indice, { subArticuloId: null, subArticuloTitulo: '' })}
            />

            <SolucionSelector
              paso={paso}
              articulos={vinculablesOrdenados}
              onVincular={(articulo) =>
                actualizarPaso(indice, {
                  solucionArticuloId: articulo.id,
                  solucionArticuloTitulo: articulo.titulo,
                })
              }
              onQuitar={() =>
                actualizarPaso(indice, { solucionArticuloId: null, solucionArticuloTitulo: '' })
              }
            />
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {aviso && <p className="text-xs text-amber-300">{aviso}</p>}

      <button
        type="button"
        onClick={() => onPasosChange([...pasos, crearPaso()])}
        className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300"
      >
        + Agregar paso
      </button>

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

function BotonPaso({
  etiqueta,
  onClick,
  deshabilitado = false,
  children,
}: {
  etiqueta: string
  onClick: () => void
  deshabilitado?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 text-xs text-slate-400 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

// Aviso de reutilizacion bajo el titulo de un paso: ya existe un
// procedimiento con titulo parecido y puede vincularse como tarea en
// vez de escribirlo de nuevo. "✕" lo descarta para ese paso.
function SugerenciaVinculo({
  articulo,
  onVincular,
  onDescartar,
}: {
  articulo: Articulo | null
  onVincular: (articulo: Articulo) => void
  onDescartar: () => void
}) {
  if (!articulo) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-900/60 bg-sky-950/20 px-3 py-2">
      <p className="min-w-0 truncate text-xs text-sky-200">
        Ya existe el procedimiento "{articulo.titulo}".
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onVincular(articulo)}
          className="rounded-lg border border-sky-800 px-2.5 py-1 text-xs text-sky-300"
        >
          Vincular
        </button>
        <button
          type="button"
          onClick={onDescartar}
          aria-label="Descartar sugerencia"
          className="text-xs text-slate-500"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// Editor del apartado "Tareas" del paso: la lista ordenada de bloques
// (tareas con casilla, advertencias e imagenes explicativas). El caso
// comun (solo tareas) se mantiene rapido: al pulsar Enter en una tarea
// se crea otra debajo y se enfoca, y pegar varias lineas las reparte
// en tareas seguidas. Las advertencias y las imagenes se intercalan
// desde la barra "Agregar" y se reordenan con las flechas para
// colocarlas en la posicion exacta (por ejemplo, una advertencia justo
// antes de la tarea peligrosa).
function ContenidoEditor({
  bloques,
  vinculables,
  credenciales,
  onChange,
  onSubirImagen,
  subiendoImagen,
}: {
  bloques: BloquePaso[]
  // Articulos con procedimiento que una tarea de decision puede
  // vincular como respuesta "No" (la misma lista de los selectores
  // de procedimiento y solucion del paso).
  vinculables: Articulo[]
  // Credenciales de la boveda que una tarea puede vincular (tarea 40),
  // igual que el apartado "Datos" del paso pero anclado a una sola
  // instruccion.
  credenciales: Credencial[]
  onChange: (bloques: BloquePaso[]) => void
  onSubirImagen: (evento: ChangeEvent<HTMLInputElement>) => void
  subiendoImagen: boolean
}) {
  // Id del bloque a enfocar tras crearlo (Enter o boton "+ Tarea"),
  // consumido por la fila cuando monta su input.
  const [focoId, setFocoId] = useState<string | null>(null)

  function actualizar(id: string, cambios: Partial<BloquePaso>) {
    onChange(bloques.map((b) => (b.id === id ? { ...b, ...cambios } : b)))
  }

  function quitar(id: string) {
    onChange(bloques.filter((b) => b.id !== id))
  }

  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion
    if (destino < 0 || destino >= bloques.length) return
    const copia = [...bloques]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    onChange(copia)
  }

  function agregarAlFinal(bloque: BloquePaso) {
    onChange([...bloques, bloque])
    setFocoId(bloque.id)
  }

  function insertarTareaDespues(indice: number) {
    const nueva = crearBloqueTarea()
    const copia = [...bloques]
    copia.splice(indice + 1, 0, nueva)
    onChange(copia)
    setFocoId(nueva.id)
  }

  // Pegar varias lineas en una tarea las convierte en tareas seguidas
  // (recupera la comodidad de la vieja edicion "una por linea").
  function pegarLineas(indice: number, texto: string, evento: { preventDefault: () => void }) {
    const lineas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lineas.length <= 1) return
    evento.preventDefault()
    const copia = [...bloques]
    copia[indice] = { ...copia[indice], texto: lineas[0] }
    const extra = lineas.slice(1).map((linea) => ({ ...crearBloqueTarea(), texto: linea }))
    copia.splice(indice + 1, 0, ...extra)
    onChange(copia)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-slate-400">☑ Tareas</span>

      {bloques.length === 0 && (
        <p className="text-xs text-slate-500">
          Sin tareas todavía. Cada tarea es una única acción con casilla; usa la barra Agregar para
          sumar tareas, advertencias o imágenes explicativas.
        </p>
      )}

      {bloques.map((bloque, indice) => (
        <FilaBloque
          key={bloque.id}
          bloque={bloque}
          vinculables={vinculables}
          credenciales={credenciales}
          primero={indice === 0}
          ultimo={indice === bloques.length - 1}
          enfocar={focoId === bloque.id}
          onEnfocado={() => setFocoId(null)}
          onCambiar={(cambios) => actualizar(bloque.id, cambios)}
          onEnter={() => insertarTareaDespues(indice)}
          onPegar={(texto, evento) => pegarLineas(indice, texto, evento)}
          onMover={(dir) => mover(indice, dir)}
          onQuitar={() => quitar(bloque.id)}
        />
      ))}

      {/* Barra "Agregar": las tres formas de sumar contenido al paso,
          agrupadas para que el editor se lea como un constructor y no
          como botones sueltos. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-900/70 px-2.5 py-2">
        <span className="text-xs font-medium text-slate-500">Agregar</span>
        <button
          type="button"
          onClick={() => agregarAlFinal(crearBloqueTarea())}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          + ☑ Tarea
        </button>
        <button
          type="button"
          onClick={() => agregarAlFinal(crearBloqueAviso())}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          + ⚠ Advertencia
        </button>
        <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {subiendoImagen ? 'Subiendo...' : '+ 🖼 Imagen explicativa'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendoImagen}
            onChange={onSubirImagen}
          />
        </label>
      </div>
    </div>
  )
}

// Metadatos de los tipos de tarea del checklist: icono para el
// selector y placeholder de ejemplo para el texto.
const TIPOS_TAREA: { valor: TipoTarea; etiqueta: string; placeholder: string }[] = [
  {
    valor: 'accion',
    etiqueta: '☐ Acción',
    placeholder: 'Tarea con casilla (por ejemplo: Encender la impresora)',
  },
  {
    valor: 'verificacion',
    etiqueta: '☑ Verificación',
    placeholder: 'Comprobación (por ejemplo: Verificar que la base de datos aparece)',
  },
  {
    valor: 'decision',
    etiqueta: '❓ Decisión',
    placeholder: 'Pregunta de Sí/No (por ejemplo: ¿La impresora aparece instalada?)',
  },
]

// Una fila del editor de contenido: el editor del bloque segun su tipo,
// mas los controles de reordenar y eliminar comunes a todos.
function FilaBloque({
  bloque,
  vinculables,
  credenciales,
  primero,
  ultimo,
  enfocar,
  onEnfocado,
  onCambiar,
  onEnter,
  onPegar,
  onMover,
  onQuitar,
}: {
  bloque: BloquePaso
  vinculables: Articulo[]
  credenciales: Credencial[]
  primero: boolean
  ultimo: boolean
  enfocar: boolean
  onEnfocado: () => void
  onCambiar: (cambios: Partial<BloquePaso>) => void
  onEnter: () => void
  onPegar: (texto: string, evento: { preventDefault: () => void }) => void
  onMover: (direccion: -1 | 1) => void
  onQuitar: () => void
}) {
  const tipoTarea = bloque.tipoTarea ?? 'accion'
  const infoTipo = TIPOS_TAREA.find((t) => t.valor === tipoTarea) ?? TIPOS_TAREA[0]

  return (
    <div className="flex items-start gap-1.5">
      <div className="flex-1">
        {bloque.tipo === 'tarea' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {/* Clasificacion de la tarea. Al salir del tipo decision
                  se limpia su vinculo, que solo tiene sentido ahi. */}
              <select
                value={tipoTarea}
                aria-label="Tipo de tarea"
                onChange={(e) => {
                  const nuevo = e.target.value as TipoTarea
                  onCambiar(
                    nuevo === 'decision'
                      ? { tipoTarea: nuevo }
                      : { tipoTarea: nuevo, decisionArticuloId: null, decisionArticuloTitulo: '' },
                  )
                }}
                className="shrink-0 rounded-lg border border-slate-800 bg-slate-950 py-2 pl-1 pr-0.5 text-xs text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {TIPOS_TAREA.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
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
                placeholder={infoTipo.placeholder}
                className={`${CLASE_INPUT} w-full`}
              />
            </div>
            {tipoTarea === 'decision' && (
              <DecisionVinculoSelector bloque={bloque} articulos={vinculables} onCambiar={onCambiar} />
            )}
            {/* Vinculo de credencial (tarea 40): opcional en cualquier
                tarea, independiente de su clasificacion. */}
            <CredencialTareaSelector bloque={bloque} credenciales={credenciales} onCambiar={onCambiar} />
          </div>
        )}

        {bloque.tipo === 'aviso' && (
          <div className="flex flex-col gap-1">
            <select
              value={bloque.tono ?? 'info'}
              aria-label="Tono de la advertencia"
              onChange={(e) => onCambiar({ tono: e.target.value as TonoAviso })}
              className={`${CLASE_INPUT} text-slate-300`}
            >
              {TONOS_AVISO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={bloque.texto}
              ref={(el) => {
                if (el && enfocar) {
                  el.focus()
                  onEnfocado()
                }
              }}
              onChange={(e) => onCambiar({ texto: e.target.value })}
              placeholder="Texto de la advertencia (por ejemplo: Verifica el nombre del archivo antes de eliminar el backup)"
              className={CLASE_INPUT}
            />
          </div>
        )}

        {bloque.tipo === 'imagen' && (
          <ImagenBloqueEditor bloque={bloque} onCambiarTexto={(texto) => onCambiar({ texto })} />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <BotonPaso etiqueta="Subir el bloque" onClick={() => onMover(-1)} deshabilitado={primero}>
          ↑
        </BotonPaso>
        <BotonPaso etiqueta="Bajar el bloque" onClick={() => onMover(1)} deshabilitado={ultimo}>
          ↓
        </BotonPaso>
        <BotonPaso etiqueta="Eliminar el bloque" onClick={onQuitar}>
          ✕
        </BotonPaso>
      </div>
    </div>
  )
}

// Vinculo de una tarea de decision: la solucion o el procedimiento
// que se ejecuta cuando el tecnico responde "No" a la pregunta. Sin
// vinculo, las dos respuestas simplemente continuan. Mismo patron de
// referencia (id + copia del titulo) que los vinculos del paso.
function DecisionVinculoSelector({
  bloque,
  articulos,
  onCambiar,
}: {
  bloque: BloquePaso
  articulos: Articulo[]
  onCambiar: (cambios: Partial<BloquePaso>) => void
}) {
  if (bloque.decisionArticuloId) {
    const vinculado = articulos.find((a) => a.id === bloque.decisionArticuloId)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2">
        <p className="min-w-0 truncate text-xs text-amber-200">
          🛠 Si responde No: {vinculado?.titulo ?? bloque.decisionArticuloTitulo}
        </p>
        <button
          type="button"
          onClick={() => onCambiar({ decisionArticuloId: null, decisionArticuloTitulo: '' })}
          className="shrink-0 text-xs text-slate-400 underline underline-offset-2"
        >
          Quitar
        </button>
      </div>
    )
  }

  if (articulos.length === 0) return null

  return (
    <select
      value=""
      aria-label="Vincular qué abrir si la respuesta es No"
      onChange={(e) => {
        const articulo = articulos.find((a) => a.id === e.target.value)
        if (articulo) {
          onCambiar({ decisionArticuloId: articulo.id, decisionArticuloTitulo: articulo.titulo })
        }
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ Si responde No, abrir esta solución o procedimiento (opcional)</option>
      {articulos.map((a) => (
        <option key={a.id} value={a.id}>
          {a.titulo}
        </option>
      ))}
    </select>
  )
}

// Vinculo de credencial de una tarea puntual (tarea 40): para el caso
// de un paso con varias instrucciones donde solo una necesita mostrar
// datos de la boveda (por ejemplo "Ingresar usuario y contraseña"),
// sin tener que vincular la credencial a todo el paso. Mismo patron de
// referencia (id + copia del titulo) que el apartado "Datos" del paso
// (`CredencialSelector`), pero compacto y anclado a la tarea.
function CredencialTareaSelector({
  bloque,
  credenciales,
  onCambiar,
}: {
  bloque: BloquePaso
  credenciales: Credencial[]
  onCambiar: (cambios: Partial<BloquePaso>) => void
}) {
  if (bloque.credencialId) {
    const vinculada = credenciales.find((c) => c.id === bloque.credencialId)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-900/60 bg-violet-950/30 px-3 py-2">
        <p className="min-w-0 truncate text-xs text-violet-200">
          🔐 Datos de la bóveda: {vinculada?.titulo ?? bloque.credencialTitulo}
        </p>
        <button
          type="button"
          onClick={() => onCambiar({ credencialId: null, credencialTitulo: '' })}
          className="shrink-0 text-xs text-slate-400 underline underline-offset-2"
        >
          Quitar
        </button>
      </div>
    )
  }

  // Sin credenciales locales no hay nada que vincular: usuarios sin
  // permiso de boveda no ven este control (RLS no les baja las filas).
  if (credenciales.length === 0) return null

  return (
    <select
      value=""
      aria-label="Vincular datos de la bóveda a esta tarea"
      onChange={(e) => {
        const credencial = credenciales.find((c) => c.id === e.target.value)
        if (credencial) onCambiar({ credencialId: credencial.id, credencialTitulo: credencial.titulo })
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ 🔐 Datos de la bóveda para esta tarea (opcional)</option>
      {credenciales.map((c) => (
        <option key={c.id} value={c.id}>
          {c.titulo}
          {c.categoria ? ` (${c.categoria})` : ''}
        </option>
      ))}
    </select>
  )
}

// Editor de un bloque de imagen: miniatura mas el pie de foto opcional.
// La imagen ya se subio al crear el bloque; aqui solo se ve y se puede
// escribir su descripcion o quitar el bloque (con las flechas/✕ de la
// fila).
function ImagenBloqueEditor({
  bloque,
  onCambiarTexto,
}: {
  bloque: BloquePaso
  onCambiarTexto: (texto: string) => void
}) {
  const url = useUrlAdjunto(bloque.adjunto?.referencia ?? null)
  const esImagen = bloque.adjunto?.tipo.startsWith('image/') ?? false

  return (
    <div className="flex items-center gap-2">
      {esImagen && url ? (
        <img
          src={url}
          alt={bloque.adjunto?.nombre ?? 'Imagen'}
          className="h-16 w-16 shrink-0 rounded-lg border border-slate-800 object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-500">
          🖼
        </div>
      )}
      <input
        type="text"
        value={bloque.texto}
        onChange={(e) => onCambiarTexto(e.target.value)}
        placeholder="Pie de imagen (opcional)"
        className={`${CLASE_INPUT} w-full`}
      />
    </div>
  )
}

// Apartado "Datos" del paso: el vinculo con una credencial de la
// boveda. En el paso solo se guarda el id y una copia del titulo como
// referencia: el usuario y la contrasena se consultan cifrados en la
// boveda al leer el procedimiento, asi nunca se duplican y siempre
// estan al dia.
function CredencialSelector({
  paso,
  credenciales,
  onVincular,
  onQuitar,
}: {
  paso: PasoProcedimiento
  credenciales: Credencial[]
  onVincular: (credencial: Credencial) => void
  onQuitar: () => void
}) {
  if (paso.credencialId) {
    const vinculada = credenciales.find((c) => c.id === paso.credencialId)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-900/60 bg-violet-950/30 px-3 py-2">
        <p className="min-w-0 truncate text-xs text-violet-200">
          🔐 Datos de la bóveda: {vinculada?.titulo ?? paso.credencialTitulo}
        </p>
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 text-xs text-slate-400 underline underline-offset-2"
        >
          Quitar
        </button>
      </div>
    )
  }

  // Sin credenciales locales no hay nada que vincular: usuarios sin
  // permiso de boveda no ven este control (RLS no les baja las filas).
  if (credenciales.length === 0) return null

  return (
    <select
      value=""
      aria-label="Vincular datos de la bóveda al paso"
      onChange={(e) => {
        const credencial = credenciales.find((c) => c.id === e.target.value)
        if (credencial) onVincular(credencial)
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ 🔐 Datos de la bóveda (opcional)</option>
      {credenciales.map((c) => (
        <option key={c.id} value={c.id}>
          {c.titulo}
          {c.categoria ? ` (${c.categoria})` : ''}
        </option>
      ))}
    </select>
  )
}

// Vinculo del paso con otro articulo que tiene procedimiento: la
// "tarea" del paso. En el paso solo quedan el id y una copia del
// titulo; el paso a paso vive en el articulo vinculado, se reutiliza
// desde cualquier procedimiento y se actualiza en un solo lugar.
function SubProcedimientoSelector({
  paso,
  articulos,
  onVincular,
  onQuitar,
}: {
  paso: PasoProcedimiento
  articulos: Articulo[]
  onVincular: (articulo: Articulo) => void
  onQuitar: () => void
}) {
  if (paso.subArticuloId) {
    const vinculado = articulos.find((a) => a.id === paso.subArticuloId)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-900/60 bg-sky-950/20 px-3 py-2">
        <p className="min-w-0 truncate text-xs text-sky-200">
          🔗 Procedimiento relacionado: {vinculado?.titulo ?? paso.subArticuloTitulo}
        </p>
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 text-xs text-slate-400 underline underline-offset-2"
        >
          Quitar
        </button>
      </div>
    )
  }

  if (articulos.length === 0) return null

  return (
    <select
      value=""
      aria-label="Vincular procedimiento relacionado como tarea de este paso"
      onChange={(e) => {
        const articulo = articulos.find((a) => a.id === e.target.value)
        if (articulo) onVincular(articulo)
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ 🔗 Procedimiento relacionado como tarea (opcional)</option>
      {articulos.map((a) => (
        <option key={a.id} value={a.id}>
          {a.titulo}
        </option>
      ))}
    </select>
  )
}

// Vinculo del paso con su procedimiento de solucion, el que se
// despliega cuando el tecnico responde que si ocurrio un error en
// este paso. Mismo patron de referencia que la tarea vinculada.
function SolucionSelector({
  paso,
  articulos,
  onVincular,
  onQuitar,
}: {
  paso: PasoProcedimiento
  articulos: Articulo[]
  onVincular: (articulo: Articulo) => void
  onQuitar: () => void
}) {
  if (paso.solucionArticuloId) {
    const vinculado = articulos.find((a) => a.id === paso.solucionArticuloId)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2">
        <p className="min-w-0 truncate text-xs text-amber-200">
          🛠 Solución relacionada: {vinculado?.titulo ?? paso.solucionArticuloTitulo}
        </p>
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 text-xs text-slate-400 underline underline-offset-2"
        >
          Quitar
        </button>
      </div>
    )
  }

  if (articulos.length === 0) return null

  return (
    <select
      value=""
      aria-label="Vincular solución relacionada por si este paso falla"
      onChange={(e) => {
        const articulo = articulos.find((a) => a.id === e.target.value)
        if (articulo) onVincular(articulo)
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ 🛠 Solución relacionada por si este paso falla (opcional)</option>
      {articulos.map((a) => (
        <option key={a.id} value={a.id}>
          {a.titulo}
        </option>
      ))}
    </select>
  )
}

// "Archivos relacionados" del paso en el editor: manuales, PDF, Word,
// Excel, presentaciones y fotos (varios). Dos formas de agregar:
// "Tomar fotografía" usa la camara en el sitio (util desde el celular
// en un mantenimiento) y "Seleccionar archivos" sube documentos ya
// guardados. Cada archivo se puede quitar.
const TIPOS_ARCHIVO_ACEPTADOS =
  'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv'

function AdjuntosPasoEditor({
  paso,
  subiendo,
  onSubir,
  onQuitar,
}: {
  paso: PasoProcedimiento
  subiendo: boolean
  onSubir: (evento: ChangeEvent<HTMLInputElement>) => void
  onQuitar: (referencia: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-slate-400">📎 Archivos relacionados</span>
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {subiendo ? 'Subiendo...' : '📷 Tomar fotografía'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={subiendo}
            onChange={onSubir}
          />
        </label>
        {!subiendo && (
          <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
            📎 Seleccionar archivos
            <input
              type="file"
              accept={TIPOS_ARCHIVO_ACEPTADOS}
              multiple
              className="hidden"
              onChange={onSubir}
            />
          </label>
        )}
      </div>

      {paso.adjuntos.length === 0 ? (
        <p className="text-xs text-slate-500">
          Sin archivos todavía. Agrega manuales, PDF, Word, Excel o presentaciones que se necesiten
          en este paso.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {paso.adjuntos.map((adjunto) => (
            <AdjuntoPasoMiniatura
              key={adjunto.referencia}
              adjunto={adjunto}
              onQuitar={() => onQuitar(adjunto.referencia)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AdjuntoPasoMiniatura({
  adjunto,
  onQuitar,
}: {
  adjunto: PasoAdjunto
  onQuitar: () => void
}) {
  const url = useUrlAdjunto(adjunto.referencia)
  const esImagen = adjunto.tipo.startsWith('image/')

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${adjunto.nombre}`}
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-xs text-slate-300"
      >
        ×
      </button>
      {esImagen && url ? (
        <img src={url} alt={adjunto.nombre} className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center px-2 text-center text-xs text-slate-400">
          {adjunto.nombre}
        </div>
      )}
    </div>
  )
}
