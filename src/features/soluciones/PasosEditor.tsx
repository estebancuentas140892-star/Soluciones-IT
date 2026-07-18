import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ChangeEvent, type ComponentType } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import {
  db,
  type Articulo,
  type BloquePaso,
  type PasoAdjunto,
  type PasoProcedimiento,
  type TipoTarea,
  type TonoAviso,
} from '../../lib/db'
import { crearBloqueAviso, crearBloqueTarea, crearPaso, normalizarProcedimiento } from '../../lib/procedimiento'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  ArrowDown,
  ArrowElbowDownRight,
  ArrowUp,
  BookOpen,
  Camera,
  CaretDown,
  CaretUp,
  DotsThreeOutline,
  type IconoProps,
  LinkSimple,
  LockSimple,
  Plus,
  Question,
  SealCheck,
  Square,
  TrashSimple,
  Warning,
  Wrench,
  X,
} from '../../components/iconos'
import { TONOS_AVISO } from './tonos'

interface Props {
  articuloId: string
  pasos: PasoProcedimiento[]
  onPasosChange: (pasos: PasoProcedimiento[]) => void
}

// Metadatos visuales de cada clasificacion de tarea (handoff "Editor de
// Artículo": el icono se toca para ciclar entre los tipos). Icono,
// color y placeholder calcan el mockup.
interface TipoTareaInfo {
  valor: TipoTarea
  Icono: ComponentType<IconoProps>
  claseIcono: string
  titulo: string
  placeholder: string
}

const TIPOS_TAREA: TipoTareaInfo[] = [
  {
    valor: 'accion',
    Icono: Square,
    claseIcono: 'text-noct-neutral-500',
    titulo: 'Acción con casilla. Tocar para cambiar el tipo',
    placeholder: 'Tarea (por ejemplo: Encender la impresora)',
  },
  {
    valor: 'verificacion',
    Icono: SealCheck,
    claseIcono: 'text-noct-accent-300',
    titulo: 'Verificación. Tocar para cambiar el tipo',
    placeholder: 'Comprobación (por ejemplo: Verificar que aparece)',
  },
  {
    valor: 'decision',
    Icono: Question,
    claseIcono: 'text-noct-precaucion',
    titulo: 'Decisión Sí/No. Tocar para cambiar el tipo',
    placeholder: 'Pregunta de Sí/No',
  },
]

const CICLO_TIPO_TAREA: Record<TipoTarea, TipoTarea> = {
  accion: 'verificacion',
  verificacion: 'decision',
  decision: 'accion',
}

function infoTipoTarea(tipo: TipoTarea | null): TipoTareaInfo {
  return TIPOS_TAREA.find((t) => t.valor === (tipo ?? 'accion')) ?? TIPOS_TAREA[0]
}

// El icono de la advertencia cicla entre los cinco tonos del sistema
// (mismo orden que TONOS_AVISO), un tono por toque.
function tonoSiguiente(tono: TonoAviso | null): TonoAviso {
  const indice = TONOS_AVISO.findIndex((t) => t.valor === (tono ?? 'info'))
  return TONOS_AVISO[(indice + 1) % TONOS_AVISO.length].valor
}

// Bloque de imagen recien creado, sin adjunto todavia: el slot del
// bloque permite subir la foto (a diferencia de tareas y avisos, que
// nacen con su contenido en blanco listo para escribir). Se descarta al
// guardar si no llega a tener imagen (limpiarBloques en procedimiento.ts).
function crearBloqueImagenVacio(): BloquePaso {
  return {
    id: crypto.randomUUID(),
    tipo: 'imagen',
    texto: '',
    tono: null,
    adjunto: null,
    tipoTarea: null,
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    credencialId: null,
    credencialTitulo: '',
  }
}

// Editor del procedimiento paso a paso (handoff "Editor de Artículo",
// sistema Nocturne). Componente controlado: el estado vive en el
// formulario. Cada paso es una tarjeta con numero, titulo, objetivo y un
// cuerpo de bloques (tareas con casilla, advertencias e imagenes), mas un
// menu de reordenar/eliminar y los vinculos del paso (bóveda,
// procedimiento y solución).
export function PasosEditor({ articuloId, pasos, onPasosChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [menuPasoId, setMenuPasoId] = useState<string | null>(null)
  const [vinculosPasoId, setVinculosPasoId] = useState<string | null>(null)
  const [pasoAEliminar, setPasoAEliminar] = useState<number | null>(null)
  const [subiendoBloqueId, setSubiendoBloqueId] = useState<string | null>(null)
  const [focoBloqueId, setFocoBloqueId] = useState<string | null>(null)

  // Credenciales de la boveda para vincular a un paso. Solo llegan a
  // este dispositivo las de usuarios con permiso de boveda (RLS); el
  // titulo es visible sin desbloquear, los secretos no.
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const credencialesOrdenadas = useMemo(
    () => [...credenciales].sort((a, b) => a.titulo.localeCompare(b.titulo)),
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

  function agregarBloque(indice: number, bloque: BloquePaso) {
    actualizarPaso(indice, { bloques: [...pasos[indice].bloques, bloque] })
    if (bloque.tipo !== 'imagen') setFocoBloqueId(bloque.id)
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

  return (
    <div className="flex flex-col gap-3.5">
      {pasos.length === 0 && (
        <div className="mb-1 rounded-md border border-dashed border-noct-neutral-700 px-4 py-[22px] text-center">
          <p className="text-sm font-medium">Aún no hay pasos</p>
          <p className="mt-1 text-[13px] leading-[1.5] text-noct-neutral-400">
            Cada paso agrupa tareas con casilla, advertencias e imágenes.
          </p>
        </div>
      )}

      {pasos.map((paso, indice) => (
        <div key={paso.id} className="flex flex-col rounded-md bg-noct-surface p-3">
          {/* Cabecera: numero, titulo editable y menu de opciones. */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noct-accent text-[12.5px] font-medium text-noct-accent-300">
              {indice + 1}
            </div>
            <input
              type="text"
              value={paso.titulo}
              onChange={(e) => actualizarPaso(indice, { titulo: e.target.value })}
              placeholder="Qué hacer en este paso"
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2.5 py-2 text-[14.5px] font-medium text-noct-text outline-none focus:border-noct-accent focus:bg-noct-surface"
            />
            <button
              type="button"
              onClick={() => setMenuPasoId((actual) => (actual === paso.id ? null : paso.id))}
              aria-label="Opciones del paso: mover o eliminar"
              className="flex min-h-11 w-10 shrink-0 items-center justify-center rounded-md text-noct-neutral-500 hover:bg-noct-text/[.05] hover:text-noct-text"
            >
              <DotsThreeOutline size={18} />
            </button>
          </div>

          {menuPasoId === paso.id && (
            <div className="flex gap-2 py-2 pl-[38px]">
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

          <input
            type="text"
            value={paso.objetivo}
            onChange={(e) => actualizarPaso(indice, { objetivo: e.target.value })}
            placeholder="Objetivo: qué se logra al terminar (opcional)"
            className="mb-2.5 ml-[38px] mt-0.5 min-h-8 max-w-[calc(100%-38px)] border-none bg-transparent px-2.5 py-1 text-[12.5px] text-noct-neutral-400 outline-none"
          />

          {/* Cuerpo del paso: tareas, advertencias e imagenes. */}
          <div className="flex flex-col gap-2 border-t border-noct-divider pt-2.5">
            {paso.bloques.map((bloque) => (
              <BloqueEditor
                key={bloque.id}
                bloque={bloque}
                enfocar={focoBloqueId === bloque.id}
                onEnfocado={() => setFocoBloqueId(null)}
                subiendoImagen={subiendoBloqueId === bloque.id}
                onCambiar={(cambios) => actualizarBloque(indice, bloque.id, cambios)}
                onQuitar={() => quitarBloque(indice, bloque.id)}
                onEnter={() => insertarTareaDespues(indice, bloque.id)}
                onPegar={(texto, evento) => pegarLineas(indice, bloque.id, texto, evento)}
                onSubirImagen={(evento) => void subirImagen(indice, bloque.id, evento)}
                vinculables={vinculablesOrdenados}
              />
            ))}

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <BotonAgregar Icono={Plus} onClick={() => agregarBloque(indice, crearBloqueTarea())}>
                Tarea
              </BotonAgregar>
              <BotonAgregar Icono={Warning} onClick={() => agregarBloque(indice, crearBloqueAviso())}>
                Advertencia
              </BotonAgregar>
              <BotonAgregar Icono={Camera} onClick={() => agregarBloque(indice, crearBloqueImagenVacio())}>
                Imagen
              </BotonAgregar>
            </div>
          </div>

          {/* Vinculos del paso: bóveda, procedimiento o solución. */}
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
                <VinculoDelPaso
                  Icono={LockSimple}
                  etiqueta="Datos de la bóveda"
                  vinculado={paso.credencialId ? paso.credencialTitulo : null}
                  opciones={credencialesOrdenadas.map((c) => ({
                    id: c.id,
                    titulo: c.categoria ? `${c.titulo} (${c.categoria})` : c.titulo,
                  }))}
                  onElegir={(id) => {
                    const credencial = credencialesOrdenadas.find((c) => c.id === id)
                    if (credencial) actualizarPaso(indice, { credencialId: credencial.id, credencialTitulo: credencial.titulo })
                  }}
                  onQuitar={() => actualizarPaso(indice, { credencialId: null, credencialTitulo: '' })}
                  placeholderVacio="Vincular datos de la bóveda (opcional)"
                />
                <VinculoDelPaso
                  Icono={BookOpen}
                  etiqueta="Procedimiento relacionado"
                  vinculado={paso.subArticuloId ? paso.subArticuloTitulo : null}
                  opciones={vinculablesOrdenados.map((a) => ({ id: a.id, titulo: a.titulo }))}
                  onElegir={(id) => {
                    const articulo = vinculablesOrdenados.find((a) => a.id === id)
                    if (articulo) {
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
                    if (articulo) actualizarPaso(indice, { solucionArticuloId: articulo.id, solucionArticuloTitulo: articulo.titulo })
                  }}
                  onQuitar={() => actualizarPaso(indice, { solucionArticuloId: null, solucionArticuloTitulo: '' })}
                  placeholderVacio="Vincular solución por si el paso falla (opcional)"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVinculosPasoId(paso.id)}
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-0.5 py-1 text-left text-[12.5px] text-noct-neutral-500 hover:text-noct-text"
              >
                <LinkSimple size={15} />
                Vínculos del paso: bóveda, procedimiento o solución
                <CaretDown size={12} className="ml-auto" />
              </button>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-noct-error">{error}</p>}
      {aviso && <p className="text-xs text-noct-precaucion">{aviso}</p>}

      <button
        type="button"
        onClick={() => {
          const nuevo = { ...crearPaso(), bloques: [crearBloqueTarea()] }
          onPasosChange([...pasos, nuevo])
          setFocoBloqueId(nuevo.bloques[0].id)
        }}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-noct-neutral-700 text-sm font-medium text-noct-neutral-300 hover:border-noct-accent hover:text-noct-accent-300"
      >
        <Plus size={16} />
        Agregar paso
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
  const base =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-[13px] font-medium leading-tight'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        destructivo
          ? `${base} border-transparent px-1 text-noct-error hover:bg-noct-error/10`
          : `${base} border-noct-divider text-noct-text hover:bg-noct-text/[.07]`
      }
    >
      <Icono size={14} />
      {children}
    </button>
  )
}

// Boton fantasma de la barra "Agregar" (tarea, advertencia, imagen).
function BotonAgregar({
  Icono,
  onClick,
  children,
}: {
  Icono: ComponentType<IconoProps>
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-1 py-[7px] text-[13px] font-medium leading-tight text-noct-accent hover:bg-noct-accent/10"
    >
      <Icono size={13} />
      {children}
    </button>
  )
}

// Un vinculo del paso (credencial, subprocedimiento o solucion): sin
// vinculo, un recuadro punteado con icono que en realidad es un select
// (mismo aspecto que el mockup); vinculado, una fila solida con el
// titulo de referencia y un botón para quitar. Sin candidatos para
// elegir, no se muestra nada (nunca deja un select vacio).
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
    <div className="relative">
      <Icono size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-noct-neutral-400" />
      <select
        value=""
        aria-label={placeholderVacio}
        onChange={(e) => {
          if (e.target.value) onElegir(e.target.value)
        }}
        className="flex min-h-11 w-full appearance-none rounded-md border border-dashed border-noct-neutral-700 bg-transparent pl-9 pr-3 text-[13px] text-noct-neutral-400 outline-none hover:border-noct-neutral-500 hover:text-noct-text"
      >
        <option value="">{placeholderVacio}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.titulo}
          </option>
        ))}
      </select>
    </div>
  )
}

// Un bloque del cuerpo de un paso, segun su tipo: tarea, advertencia o
// imagen. Cada uno lleva el mismo patron del mockup (un control a la
// izquierda que cicla el tipo/tono, el contenido, y la X para quitar).
function BloqueEditor({
  bloque,
  enfocar,
  onEnfocado,
  subiendoImagen,
  onCambiar,
  onQuitar,
  onEnter,
  onPegar,
  onSubirImagen,
  vinculables,
}: {
  bloque: BloquePaso
  enfocar: boolean
  onEnfocado: () => void
  subiendoImagen: boolean
  onCambiar: (cambios: Partial<BloquePaso>) => void
  onQuitar: () => void
  onEnter: () => void
  onPegar: (texto: string, evento: { preventDefault: () => void }) => void
  onSubirImagen: (evento: ChangeEvent<HTMLInputElement>) => void
  vinculables: Articulo[]
}) {
  if (bloque.tipo === 'tarea') {
    const info = infoTipoTarea(bloque.tipoTarea)
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={info.titulo}
            aria-label={info.titulo}
            onClick={() =>
              onCambiar(
                CICLO_TIPO_TAREA[bloque.tipoTarea ?? 'accion'] === 'decision'
                  ? { tipoTarea: CICLO_TIPO_TAREA[bloque.tipoTarea ?? 'accion'] }
                  : {
                      tipoTarea: CICLO_TIPO_TAREA[bloque.tipoTarea ?? 'accion'],
                      decisionArticuloId: null,
                      decisionArticuloTitulo: '',
                    },
              )
            }
            className={`flex min-h-11 w-9 shrink-0 items-center justify-center rounded-md hover:bg-noct-text/[.05] ${info.claseIcono}`}
          >
            <info.Icono size={18} />
          </button>
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
            className="min-h-11 min-w-0 flex-1 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent"
          />
          <BotonQuitar onClick={onQuitar} etiqueta="Quitar esta línea" />
        </div>
        {bloque.tipoTarea === 'decision' &&
          (bloque.decisionArticuloId ? (
            <div className="ml-10 flex items-center justify-between gap-2 rounded-md border border-noct-precaucion/30 bg-noct-precaucion/10 px-2.5 py-2">
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
              <div className="relative ml-10">
                <ArrowElbowDownRight
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-noct-neutral-500"
                />
                <select
                  value=""
                  aria-label="Vincular qué abrir si la respuesta es No"
                  onChange={(e) => {
                    const articulo = vinculables.find((a) => a.id === e.target.value)
                    if (articulo) onCambiar({ decisionArticuloId: articulo.id, decisionArticuloTitulo: articulo.titulo })
                  }}
                  className="flex min-h-9 w-[calc(100%-0px)] appearance-none rounded-md border border-dashed border-noct-neutral-700 bg-transparent py-1 pl-8 pr-3 text-[12.5px] text-noct-neutral-500 outline-none hover:border-noct-neutral-500 hover:text-noct-text"
                >
                  <option value="">Si responde No, vincular una solución o procedimiento (opcional)</option>
                  {vinculables.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.titulo}
                    </option>
                  ))}
                </select>
              </div>
            )
          ))}
      </div>
    )
  }

  if (bloque.tipo === 'aviso') {
    const tono = TONOS_AVISO.find((t) => t.valor === (bloque.tono ?? 'info')) ?? TONOS_AVISO[0]
    return (
      <div className="flex items-start gap-1">
        <button
          type="button"
          title={`${tono.etiqueta}. Tocar para cambiar el tono`}
          aria-label={`${tono.etiqueta}. Tocar para cambiar el tono`}
          onClick={() => onCambiar({ tono: tonoSiguiente(bloque.tono) })}
          className={`flex min-h-11 w-9 shrink-0 items-center justify-center rounded-md hover:bg-noct-text/[.05] ${tono.claseIcono}`}
        >
          <tono.Icono size={18} />
        </button>
        <div className={`min-w-0 flex-1 rounded-md border ${tono.clasesPanel}`}>
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
            placeholder="Texto de la advertencia"
            className="block w-full resize-y border-none bg-transparent px-3 py-2.5 text-[13px] leading-[1.5] text-noct-text outline-none"
          />
        </div>
        <BotonQuitar onClick={onQuitar} etiqueta="Quitar la advertencia" />
      </div>
    )
  }

  return (
    <ImagenBloque
      bloque={bloque}
      subiendo={subiendoImagen}
      onCambiarPie={(texto) => onCambiar({ texto })}
      onQuitar={onQuitar}
      onSubir={onSubirImagen}
    />
  )
}

// Boton de quitar (la X) comun a tareas y advertencias.
function BotonQuitar({ onClick, etiqueta }: { onClick: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex min-h-11 w-8 shrink-0 items-center justify-center rounded-md text-noct-neutral-600 hover:text-noct-text"
    >
      <X size={14} />
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
    <div className="ml-10 flex flex-col gap-1.5">
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
