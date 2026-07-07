import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { db, type Articulo, type Credencial, type PasoAdjunto, type PasoProcedimiento } from '../../lib/db'
import { crearPaso, normalizarProcedimiento } from '../../lib/procedimiento'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'

interface Props {
  articuloId: string
  pasos: PasoProcedimiento[]
  onPasosChange: (pasos: PasoProcedimiento[]) => void
}

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Editor del procedimiento paso a paso dentro del formulario de
// articulo. Es un componente controlado: el estado vive en el
// formulario y aqui solo se edita. Cada paso ofrece solo lo esencial:
// titulo, instrucciones con casilla, captura y los tres vinculos
// (datos de la boveda, tarea reutilizable y solucion por si el paso
// falla).
export function PasosEditor({ articuloId, pasos, onPasosChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [subiendoPasoId, setSubiendoPasoId] = useState<string | null>(null)
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
            !a.eliminadoEn && a.id !== articuloId && normalizarProcedimiento(a.procedimiento) !== null,
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

  async function subirAdjuntos(indice: number, evento: ChangeEvent<HTMLInputElement>) {
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
    setSubiendoPasoId(paso.id)
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

    // Se agregan sobre los adjuntos que el paso tenia al empezar la
    // subida (una sola escritura al terminar todo el lote).
    if (nuevos.length > 0) actualizarPaso(indice, { adjuntos: [...paso.adjuntos, ...nuevos] })
    if (fallidos.length > 0) setError(`No se pudo subir: ${fallidos.join(', ')}`)
    if (encolados > 0) {
      setAviso(
        encolados === 1
          ? 'Sin conexión: el archivo quedó guardado en este dispositivo y se subirá solo al recuperar señal.'
          : `Sin conexión: ${encolados} archivos quedaron guardados en este dispositivo y se subirán solos al recuperar señal.`,
      )
    }
    setSubiendoPasoId(null)
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

          <input
            type="text"
            required
            value={paso.titulo}
            onChange={(e) => actualizarPaso(indice, { titulo: e.target.value })}
            placeholder="Qué hacer (por ejemplo: Conectar impresora)"
            className={CLASE_INPUT}
          />

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Instrucciones con casilla (una por línea, opcional)
            <textarea
              rows={3}
              value={paso.instrucciones.join('\n')}
              onChange={(e) => actualizarPaso(indice, { instrucciones: e.target.value.split('\n') })}
              placeholder={'Presionar Windows + R\nEscribir \\\\10.10.5.32\nEjecutar el instalador'}
              className={CLASE_INPUT}
            />
          </label>

          <AdjuntosPasoEditor
            paso={paso}
            subiendo={subiendoPasoId === paso.id}
            onSubir={(evento) => void subirAdjuntos(indice, evento)}
            onQuitar={(referencia) => quitarAdjunto(indice, referencia)}
          />

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
          Datos vinculados: {vinculada?.titulo ?? paso.credencialTitulo}
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
      <option value="">+ Vincular datos de la bóveda (opcional)</option>
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
          Procedimiento vinculado: {vinculado?.titulo ?? paso.subArticuloTitulo}
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
      aria-label="Vincular otro procedimiento como tarea de este paso"
      onChange={(e) => {
        const articulo = articulos.find((a) => a.id === e.target.value)
        if (articulo) onVincular(articulo)
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ Vincular otro procedimiento como tarea (opcional)</option>
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
          Solución si el paso falla: {vinculado?.titulo ?? paso.solucionArticuloTitulo}
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
      aria-label="Vincular una solución por si este paso falla"
      onChange={(e) => {
        const articulo = articulos.find((a) => a.id === e.target.value)
        if (articulo) onVincular(articulo)
      }}
      className={`${CLASE_INPUT} text-slate-400`}
    >
      <option value="">+ Vincular solución por si este paso falla (opcional)</option>
      {articulos.map((a) => (
        <option key={a.id} value={a.id}>
          {a.titulo}
        </option>
      ))}
    </select>
  )
}

// Adjuntos del paso en el editor: imagenes y archivos (varios). Dos
// formas de agregar: "Cámara" toma una foto en el sitio (util desde el
// celular en un mantenimiento) y "+ Archivos" sube capturas, manuales
// o PDF ya guardados. Cada adjunto se puede quitar.
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">Adjuntos del paso</span>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
            {subiendo ? 'Subiendo...' : '📷 Cámara'}
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
              📁 Archivos
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={onSubir}
              />
            </label>
          )}
        </div>
      </div>

      {paso.adjuntos.length === 0 ? (
        <p className="text-xs text-slate-500">Sin adjuntos todavía</p>
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
