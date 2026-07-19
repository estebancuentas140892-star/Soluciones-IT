import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type Articulo, type NodoDiagnostico } from '../../lib/db'
import {
  crearNodo,
  crearOpcion,
  duplicarNodo,
  normalizarNodos,
  prepararNodosParaGuardar,
  procedimientosVinculadosRotos,
  validarNodos,
} from '../../lib/diagnostico'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import {
  ArrowDown,
  ArrowElbowDownRight,
  ArrowUp,
  BookOpen,
  CaretDown,
  Copy,
  DotsThreeOutline,
  FlagCheckered,
  FloppyDisk,
  Play,
  Plus,
  Signpost,
  TrashSimple,
  Warning,
  WarningOctagon,
  X,
} from '../../components/iconos'
import {
  BTN_GHOST_ACENTO,
  BTN_GHOST_PELIGRO,
  BTN_PRIMARIO,
  BTN_SECUNDARIO,
  TituloSeccion,
} from '../../components/nocturne'
import { iconoDeCategoria } from '../soluciones/iconosSoluciones'
import { Historial } from '../historial/Historial'
import { PruebaDiagnostico } from './PruebaDiagnostico'

// Clases compartidas de los campos de texto (mismo lenguaje que el
// Editor de Artículo): borde divisor, fondo de superficie y foco en el
// acento.
const CLASE_CAMPO =
  'w-full box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'
const CLASE_ETIQUETA = 'text-[12.5px] font-medium text-noct-neutral-400'

// Editor de un diagnóstico guiado, rediseñado al sistema Nocturne
// (handoff "Rediseño de aplicación empresarial", Editor de
// Diagnóstico.dc.html): el problema (título, categoría en chips y
// descripción) y su árbol de preguntas, una lista plana donde cada
// respuesta elige con un select a qué pregunta continuar, qué
// procedimiento ejecutar o con qué mensaje terminar. Conserva el
// modelo de datos `nodos`/`opciones` y toda la lógica del editor
// previo: validación de ramas sueltas, ciclos e inalcanzables al
// guardar, duplicar/mover preguntas, aviso de vínculos rotos,
// eliminación sensible (contraseña maestra), historial en edición y
// modo prueba. Trae su propio shell a pantalla completa, por eso su
// ruta sale del Layout oscuro como los demás editores.
export function DiagnosticoForm() {
  const { diagnosticoId } = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(diagnosticoId)

  const [id] = useState(() => diagnosticoId ?? nuevoId())
  const diagnostico = useLiveQuery(
    () => (diagnosticoId ? db.diagnosticos.get(diagnosticoId) : undefined),
    [diagnosticoId],
  )

  const [titulo, setTitulo] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [nodos, setNodos] = useState<NodoDiagnostico[]>(() => [crearNodo()])
  const [motivo, setMotivo] = useState('')
  const [problemas, setProblemas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [mostrarPrueba, setMostrarPrueba] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)

  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])

  // Ids de artículos ejecutables en tiempo de ejecución (existen, no
  // eliminados y con procedimiento), sin importar su estado: el
  // asistente los ejecuta aunque sean borrador. Sirve para detectar
  // vínculos rotos (fase D2), un conjunto más amplio que `vinculables`.
  const idsEjecutables = useLiveQuery(
    async () => {
      const todos = await db.articulos.filter((a) => !a.eliminadoEn).toArray()
      return new Set(todos.filter((a) => normalizarProcedimiento(a.procedimiento) !== null).map((a) => a.id))
    },
    [],
    new Set<string>(),
  )

  // Artículos con procedimiento (publicados): los bloques reutilizables
  // que una respuesta puede ejecutar. El diagnóstico nunca duplica pasos.
  const vinculables = useLiveQuery(
    () =>
      db.articulos
        .filter(
          (a) =>
            !a.eliminadoEn &&
            (a.estado ?? 'publicado') === 'publicado' &&
            normalizarProcedimiento(a.procedimiento) !== null,
        )
        .toArray(),
    [],
    [],
  )
  const vinculablesOrdenados = useMemo(
    () => [...vinculables].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [vinculables],
  )

  const nodosPreparados = useMemo(() => prepararNodosParaGuardar(nodos), [nodos])
  const advertenciasVinculos = useMemo(
    () => procedimientosVinculadosRotos(nodosPreparados, (aid) => idsEjecutables.has(aid)),
    [nodosPreparados, idsEjecutables],
  )

  useEffect(() => {
    if (!diagnostico || cargadoInicial) return
    setTitulo(diagnostico.titulo)
    setCategoriaId(diagnostico.categoriaId)
    setDescripcion(diagnostico.descripcion)
    const normalizados = normalizarNodos(diagnostico.nodos)
    setNodos(normalizados.length > 0 ? normalizados : [crearNodo()])
    setCargadoInicial(true)
  }, [diagnostico, cargadoInicial])

  if (esEdicion && diagnostico === null) return <Navigate to="/diagnostico" replace />
  if (esEdicion && !cargadoInicial) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  async function guardar() {
    const preparados = prepararNodosParaGuardar(nodos)
    const encontrados: string[] = []
    if (!titulo.trim()) encontrados.push('Escribir el problema (título del diagnóstico).')
    if (!categoriaId) encontrados.push('Elegir una categoría.')
    encontrados.push(...validarNodos(preparados))
    setProblemas(encontrados)
    if (encontrados.length > 0) return

    setGuardando(true)
    await guardarRegistro(
      'diagnosticos',
      { id, categoriaId, titulo: titulo.trim(), descripcion: descripcion.trim(), nodos: preparados },
      motivo.trim(),
    )
    navigate('/diagnostico')
  }

  async function eliminar() {
    await eliminarRegistro('diagnosticos', id)
    navigate('/diagnostico')
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa con blur: cancelar, eliminar y título. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver variante="nocturne">Cancelar</BotonVolver>
            {esEdicion && (
              <button
                type="button"
                onClick={() => setMostrarEliminar(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[12.5px] text-noct-neutral-500 hover:text-noct-error"
              >
                <TrashSimple size={15} aria-hidden />
                Eliminar
              </button>
            )}
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? 'Editar diagnóstico' : 'Nuevo diagnóstico'}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Un árbol de preguntas que lleva del problema a la solución
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-[150px] pt-[18px]">
          {/* Problema + categoría + descripción */}
          <section className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Problema <span className="text-noct-accent-300">*</span>
              </span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Como lo diría el técnico: La impresora no imprime"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Categoría <span className="text-noct-accent-300">*</span>
              </span>
              <div className="flex flex-wrap gap-[7px]">
                {categorias.map((c) => {
                  const activa = c.id === categoriaId
                  const Icono = iconoDeCategoria(c.nombre)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => setCategoriaId(c.id)}
                      className={`inline-flex min-h-[38px] items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                        activa
                          ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                          : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                      }`}
                    >
                      <Icono size={15} aria-hidden />
                      {c.nombre}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Descripción (opcional)</span>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Una línea que ayude a reconocer el problema"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>
          </section>

          <NodosEditor nodos={nodos} onChange={setNodos} articulos={vinculablesOrdenados} />

          {problemas.length > 0 && (
            <div className="flex flex-col gap-[7px] rounded-md border border-noct-error/35 bg-noct-error/[.09] px-[13px] py-3">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <WarningOctagon size={16} className="text-noct-error" aria-hidden />
                Antes de guardar, revisar esto
              </p>
              {problemas.map((problema, indice) => (
                <p key={indice} className="ml-6 text-[12.5px] leading-[1.5] text-noct-neutral-300">
                  {problema}
                </p>
              ))}
            </div>
          )}

          {advertenciasVinculos.length > 0 && (
            <div className="flex flex-col gap-[7px] rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-[13px] py-3">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <Warning size={16} className="text-noct-precaucion" aria-hidden />
                Procedimientos vinculados sin disponibilidad
              </p>
              {advertenciasVinculos.map((advertencia, indice) => (
                <p key={indice} className="ml-6 text-[12.5px] leading-[1.5] text-noct-neutral-300">
                  {advertencia}
                </p>
              ))}
              <p className="ml-6 text-[11px] leading-[1.5] text-noct-neutral-500">
                No impide guardar (puede ser un artículo que aún no sincronizó), pero en el diagnóstico real esa
                rama quedaría sin el procedimiento.
              </p>
            </div>
          )}

          {esEdicion && (
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Motivo del cambio (opcional)</span>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por qué se actualizó este diagnóstico"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>
          )}

          {esEdicion && <Historial entidadTipo="diagnostico" entidadId={id} />}
        </main>

        {/* Barra inferior fija: Probar y Guardar. */}
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-[12px]">
          <div className="flex gap-2.5">
            <button type="button" onClick={() => setMostrarPrueba(true)} className={`${BTN_SECUNDARIO} px-4 py-[11px]`}>
              <Play size={15} aria-hidden />
              Probar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar()}
              className={`flex-1 ${BTN_PRIMARIO} py-[11px] text-sm disabled:opacity-50`}
            >
              <FloppyDisk size={15} aria-hidden />
              {guardando ? 'Guardando...' : 'Guardar diagnóstico'}
            </button>
          </div>
        </div>
      </div>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar este diagnóstico?`}
        descripcion="Se elimina el árbol de preguntas completo. Los procedimientos vinculados no se tocan."
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      {mostrarPrueba && (
        <PruebaDiagnostico
          nodos={nodosPreparados}
          titulo={titulo}
          ejecutables={idsEjecutables}
          onCerrar={() => setMostrarPrueba(false)}
        />
      )}
    </div>
  )
}

// Editor del árbol: sección "Preguntas" con una tarjeta por pregunta.
// La primera es siempre el inicio del diagnóstico. El menú "···" de
// cada tarjeta agrupa mover, duplicar y eliminar (regla 4 de
// 08_ESTILO.md: lo secundario no compite con la edición).
function NodosEditor({
  nodos,
  onChange,
  articulos,
}: {
  nodos: NodoDiagnostico[]
  onChange: (nodos: NodoDiagnostico[]) => void
  articulos: Articulo[]
}) {
  const [menuId, setMenuId] = useState<string | null>(null)
  const [eligiendoId, setEligiendoId] = useState<string | null>(null)

  function actualizarNodo(indice: number, cambios: Partial<NodoDiagnostico>) {
    onChange(nodos.map((nodo, i) => (i === indice ? { ...nodo, ...cambios } : nodo)))
  }

  function actualizarOpcion(indice: number, indiceOpcion: number, cambios: Partial<NodoDiagnostico['opciones'][number]>) {
    actualizarNodo(indice, {
      opciones: nodos[indice].opciones.map((o, m) => (m === indiceOpcion ? { ...o, ...cambios } : o)),
    })
  }

  function moverNodo(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion
    if (destino < 0 || destino >= nodos.length) return
    const copia = [...nodos]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    onChange(copia)
    setMenuId(null)
  }

  // Al eliminar una pregunta, las respuestas que apuntaban a ella
  // quedan sin destino (en vez de romperse): la validación al guardar
  // pedirá elegirles uno nuevo.
  function eliminarNodo(indice: number) {
    if (nodos.length === 1) {
      setMenuId(null)
      return
    }
    const eliminado = nodos[indice]
    onChange(
      nodos
        .filter((_, i) => i !== indice)
        .map((nodo) => ({
          ...nodo,
          opciones: nodo.opciones.map((opcion) =>
            opcion.siguienteNodoId === eliminado.id ? { ...opcion, siguienteNodoId: null } : opcion,
          ),
        })),
    )
    setMenuId(null)
  }

  function duplicarNodoEn(indice: number) {
    const copia = duplicarNodo(nodos[indice])
    const arreglo = [...nodos]
    arreglo.splice(indice + 1, 0, copia)
    onChange(arreglo)
    setMenuId(null)
  }

  // Etiqueta de una pregunta en los selectores de destino: el título
  // interno si existe (se conserva aunque el editor ya no lo edite), si
  // no la pregunta recortada, si no "Pregunta N".
  function etiquetaDestino(destino: NodoDiagnostico, indiceDestino: number): string {
    if (destino.tituloInterno) return destino.tituloInterno
    return destino.pregunta ? recortar(destino.pregunta, 38) : `Pregunta ${indiceDestino + 1}`
  }

  const resumen = nodos.length === 1 ? '1 pregunta' : `${nodos.length} preguntas`

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <TituloSeccion>Preguntas</TituloSeccion>
        <span className="text-[11px] text-noct-neutral-600">{resumen}</span>
      </div>

      <div className="flex flex-col gap-3.5">
        {nodos.map((nodo, indice) => (
          <div key={nodo.id} className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noct-accent text-[12.5px] font-medium text-noct-accent-300">
                {indice + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-noct-neutral-500">
                {indice === 0 ? 'Inicio del diagnóstico' : `Pregunta ${indice + 1}`}
              </span>
              <button
                type="button"
                onClick={() => setMenuId((actual) => (actual === nodo.id ? null : nodo.id))}
                aria-label={`Opciones de la pregunta ${indice + 1}: mover, duplicar o eliminar`}
                aria-expanded={menuId === nodo.id}
                className="flex min-h-11 w-10 shrink-0 items-center justify-center rounded-md text-noct-neutral-500 hover:bg-noct-text/5 hover:text-noct-text"
              >
                <DotsThreeOutline size={18} aria-hidden />
              </button>
            </div>

            {menuId === nodo.id && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={indice === 0}
                  onClick={() => moverNodo(indice, -1)}
                  className={`${BTN_SECUNDARIO} disabled:opacity-30`}
                >
                  <ArrowUp size={14} aria-hidden />
                  Subir
                </button>
                <button
                  type="button"
                  disabled={indice === nodos.length - 1}
                  onClick={() => moverNodo(indice, 1)}
                  className={`${BTN_SECUNDARIO} disabled:opacity-30`}
                >
                  <ArrowDown size={14} aria-hidden />
                  Bajar
                </button>
                <button type="button" onClick={() => duplicarNodoEn(indice)} className={BTN_SECUNDARIO}>
                  <Copy size={14} aria-hidden />
                  Duplicar
                </button>
                <button
                  type="button"
                  disabled={nodos.length === 1}
                  onClick={() => eliminarNodo(indice)}
                  className={`${BTN_GHOST_PELIGRO} disabled:opacity-30`}
                >
                  <TrashSimple size={14} aria-hidden />
                  Eliminar
                </button>
              </div>
            )}

            <input
              type="text"
              value={nodo.pregunta}
              onChange={(e) => actualizarNodo(indice, { pregunta: e.target.value })}
              placeholder="La pregunta: ¿La impresora está encendida?"
              className="box-border min-h-11 w-full rounded-md border border-noct-divider bg-noct-bg px-3 py-2.5 text-[14.5px] font-medium text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600"
            />
            <input
              type="text"
              value={nodo.descripcion}
              onChange={(e) => actualizarNodo(indice, { descripcion: e.target.value })}
              placeholder="Cómo comprobarlo (opcional)"
              className="box-border min-h-[38px] w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-[13px] text-noct-neutral-300 outline-none focus:border-noct-divider focus:bg-noct-bg placeholder:text-noct-neutral-600"
            />

            <div className="flex flex-col gap-2 border-t border-noct-divider pt-2.5">
              {nodo.opciones.map((opcion, indiceOpcion) => {
                const destinoColor = opcion.siguienteNodoId ? 'text-noct-accent-300' : 'text-noct-neutral-400'
                return (
                  <div
                    key={opcion.id}
                    className="flex flex-col gap-[7px] rounded-md border border-noct-divider bg-noct-bg px-2.5 py-[9px]"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowElbowDownRight
                        size={15}
                        className="w-[22px] shrink-0 text-center text-noct-neutral-500"
                        aria-hidden
                      />
                      <input
                        type="text"
                        value={opcion.etiqueta}
                        onChange={(e) => actualizarOpcion(indice, indiceOpcion, { etiqueta: e.target.value })}
                        placeholder="Respuesta: Sí, No, otra..."
                        className="box-border min-h-10 min-w-0 flex-1 rounded-md border border-noct-divider bg-noct-surface px-2.5 py-2 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          actualizarNodo(indice, {
                            opciones: nodo.opciones.filter((_, m) => m !== indiceOpcion),
                          })
                        }
                        aria-label="Quitar esta respuesta"
                        className="flex min-h-11 w-8 shrink-0 items-center justify-center rounded-md text-noct-neutral-600 hover:text-noct-text"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Signpost size={14} className={`w-[22px] shrink-0 text-center ${destinoColor}`} aria-hidden />
                      <div className="relative min-w-0 flex-1">
                        <select
                          value={opcion.siguienteNodoId ?? ''}
                          aria-label="Destino de esta respuesta"
                          onChange={(e) =>
                            actualizarOpcion(indice, indiceOpcion, { siguienteNodoId: e.target.value || null })
                          }
                          className={`box-border min-h-[38px] w-full appearance-none rounded-md border border-transparent bg-transparent py-1.5 pl-2.5 pr-8 text-[12.5px] outline-none hover:border-noct-divider hover:bg-noct-surface focus:border-noct-accent ${destinoColor}`}
                        >
                          <option value="">Termina aquí (mensaje final o procedimiento)</option>
                          {nodos.map(
                            (destino, indiceDestino) =>
                              destino.id !== nodo.id && (
                                <option key={destino.id} value={destino.id}>
                                  Sigue en la pregunta {indiceDestino + 1}: {etiquetaDestino(destino, indiceDestino)}
                                </option>
                              ),
                          )}
                        </select>
                        <CaretDown
                          size={12}
                          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-noct-neutral-500"
                          aria-hidden
                        />
                      </div>
                    </div>

                    {!opcion.siguienteNodoId && (
                      <div className="flex items-center gap-1">
                        <FlagCheckered
                          size={14}
                          className="w-[22px] shrink-0 text-center text-noct-neutral-500"
                          aria-hidden
                        />
                        <input
                          type="text"
                          value={opcion.mensajeFinal}
                          onChange={(e) => actualizarOpcion(indice, indiceOpcion, { mensajeFinal: e.target.value })}
                          placeholder="Mensaje final: Encender y probar de nuevo"
                          className="box-border min-h-[38px] min-w-0 flex-1 rounded-md border border-noct-divider bg-noct-surface px-2.5 py-2 text-[13px] text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600"
                        />
                      </div>
                    )}

                    {opcion.articuloId ? (
                      <div className="ml-[26px] flex items-center justify-between gap-2 rounded-md border border-noct-accent/30 bg-noct-accent/10 px-2.5 py-[7px]">
                        <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-noct-accent-300">
                          <BookOpen size={13} aria-hidden />
                          Ejecuta: {opcion.articuloTitulo || 'un procedimiento'}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            actualizarOpcion(indice, indiceOpcion, { articuloId: null, articuloTitulo: '' })
                          }
                          className="shrink-0 p-1 text-xs text-noct-neutral-500 hover:text-noct-text"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : eligiendoId === opcion.id ? (
                      <div className="ml-[26px] flex flex-col gap-1">
                        {articulos.length === 0 && (
                          <p className="text-xs text-noct-neutral-500">No hay procedimientos publicados para vincular.</p>
                        )}
                        {articulos.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              actualizarOpcion(indice, indiceOpcion, { articuloId: a.id, articuloTitulo: a.titulo })
                              setEligiendoId(null)
                            }}
                            className="flex min-h-[42px] w-full items-center gap-[9px] rounded-md border border-noct-divider bg-noct-surface px-2.5 text-left text-[13px] text-noct-text hover:border-noct-accent"
                          >
                            <BookOpen size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                            <span className="min-w-0 truncate">{a.titulo}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEligiendoId(null)}
                          className="self-start px-0.5 py-1.5 text-xs text-noct-neutral-500 hover:text-noct-text"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEligiendoId(opcion.id)}
                        className="ml-[26px] inline-flex min-h-[34px] items-center gap-[7px] self-start whitespace-nowrap rounded-md border border-dashed border-noct-neutral-700 px-2.5 text-xs text-noct-neutral-500 hover:border-noct-accent hover:text-noct-accent-300"
                      >
                        <BookOpen size={13} aria-hidden />
                        Vincular procedimiento
                      </button>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                onClick={() => actualizarNodo(indice, { opciones: [...nodo.opciones, crearOpcion()] })}
                className={`${BTN_GHOST_ACENTO} self-start`}
              >
                <Plus size={13} aria-hidden />
                Respuesta
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...nodos, crearNodo()])}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-noct-neutral-700 text-sm font-medium text-noct-neutral-300 hover:border-noct-accent hover:text-noct-accent-300"
      >
        <Plus size={16} aria-hidden />
        Agregar pregunta
      </button>
    </section>
  )
}

function recortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto
}
