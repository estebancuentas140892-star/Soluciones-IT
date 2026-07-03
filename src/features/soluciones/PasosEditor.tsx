import { useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import type { PasoProcedimiento } from '../../lib/db'
import { crearPaso } from '../../lib/procedimiento'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'

interface Props {
  articuloId: string
  requisitos: string
  onRequisitosChange: (valor: string) => void
  pasos: PasoProcedimiento[]
  onPasosChange: (pasos: PasoProcedimiento[]) => void
}

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Editor del procedimiento paso a paso dentro del formulario de
// articulo. Es un componente controlado: el estado vive en el
// formulario y aqui solo se edita.
export function PasosEditor({ articuloId, requisitos, onRequisitosChange, pasos, onPasosChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [subiendoPasoId, setSubiendoPasoId] = useState<string | null>(null)

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

  function eliminarPaso(indice: number) {
    if (!window.confirm(`¿Eliminar el paso ${indice + 1}?`)) return
    onPasosChange(pasos.filter((_, i) => i !== indice))
  }

  async function subirImagen(indice: number, evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setError(null)
    setAviso(null)
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    setSubiendoPasoId(pasos[indice].id)
    try {
      const archivoFinal = await comprimirImagen(archivo)
      const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `articulos/${articuloId}/pasos/${Date.now()}-${nombreLimpio}`

      // Sin conexion, la captura queda guardada en el telefono y la
      // cola de sincronizacion la sube sola al recuperar señal.
      const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
      if (resultado === 'encolado') {
        setAviso('Sin conexión: la captura quedó guardada en este dispositivo y se subirá sola al recuperar señal.')
      }

      actualizarPaso(indice, { imagen: referencia })
    } catch {
      setError(`No se pudo subir la captura del paso ${indice + 1}.`)
    } finally {
      setSubiendoPasoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div>
        <h2 className="text-sm font-medium text-slate-200">Procedimiento paso a paso</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Opcional: si agregas pasos, el artículo se mostrará como un procedimiento guiado.
        </p>
      </div>

      <details className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
        <summary className="cursor-pointer text-xs text-slate-400">Guía para redactar buenos pasos</summary>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
          <li>• Una sola acción y un solo lugar por paso.</li>
          <li>• Empieza cada paso con un verbo: "Abrir...", "Seleccionar...".</li>
          <li>• Máximo ~12 pasos; si hay más, divide el procedimiento.</li>
          <li>• Anota la versión del software en los requisitos.</li>
          <li>• Agrega captura solo cuando la pantalla pueda confundir.</li>
          <li>• Cierra siempre con un paso que verifique el resultado.</li>
        </ul>
      </details>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Antes de empezar (un requisito por línea)
        <textarea
          rows={3}
          value={requisitos}
          onChange={(e) => onRequisitosChange(e.target.value)}
          placeholder={'Usuario y contraseña del SQL Server (ver Bóveda)\nAcceso al servidor'}
          className={CLASE_INPUT}
        />
      </label>

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
              <BotonPaso etiqueta={`Eliminar el paso ${indice + 1}`} onClick={() => eliminarPaso(indice)}>
                ✕
              </BotonPaso>
            </div>
          </div>

          <input
            type="text"
            required
            value={paso.titulo}
            onChange={(e) => actualizarPaso(indice, { titulo: e.target.value })}
            placeholder="Qué hacer (por ejemplo: Abrir SQL Server Management Studio)"
            className={CLASE_INPUT}
          />

          <textarea
            rows={2}
            value={paso.detalle}
            onChange={(e) => actualizarPaso(indice, { detalle: e.target.value })}
            placeholder="Detalle del paso (opcional)"
            className={CLASE_INPUT}
          />

          <ImagenPasoEditor
            paso={paso}
            subiendo={subiendoPasoId === paso.id}
            onSubir={(evento) => void subirImagen(indice, evento)}
            onQuitar={() => actualizarPaso(indice, { imagen: null })}
          />

          <input
            type="text"
            value={paso.nota}
            onChange={(e) => actualizarPaso(indice, { nota: e.target.value })}
            placeholder="Nota (opcional)"
            className={CLASE_INPUT}
          />
          <input
            type="text"
            value={paso.advertencia}
            onChange={(e) => actualizarPaso(indice, { advertencia: e.target.value })}
            placeholder="Advertencia (opcional)"
            className={CLASE_INPUT}
          />
          <input
            type="text"
            value={paso.consejo}
            onChange={(e) => actualizarPaso(indice, { consejo: e.target.value })}
            placeholder="Consejo (opcional)"
            className={CLASE_INPUT}
          />

          {paso.decision ? (
            <div className="flex flex-col gap-2 rounded-lg border border-sky-900/60 bg-sky-950/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-sky-300">Decisión (ramificación)</span>
                <button
                  type="button"
                  onClick={() => actualizarPaso(indice, { decision: null })}
                  className="text-xs text-slate-400 underline underline-offset-2"
                >
                  Quitar
                </button>
              </div>
              <input
                type="text"
                required
                value={paso.decision.pregunta}
                onChange={(e) =>
                  actualizarPaso(indice, { decision: { ...paso.decision!, pregunta: e.target.value } })
                }
                placeholder="Pregunta (por ejemplo: ¿La base está en línea?)"
                className={CLASE_INPUT}
              />
              <CampoSalto
                etiqueta="Si la respuesta es sí, ir al paso"
                valor={paso.decision.pasoSi}
                maximo={pasos.length}
                onChange={(pasoSi) => actualizarPaso(indice, { decision: { ...paso.decision!, pasoSi } })}
              />
              <CampoSalto
                etiqueta="Si la respuesta es no, ir al paso"
                valor={paso.decision.pasoNo}
                maximo={pasos.length}
                onChange={(pasoNo) => actualizarPaso(indice, { decision: { ...paso.decision!, pasoNo } })}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                actualizarPaso(indice, { decision: { pregunta: '', pasoSi: null, pasoNo: null } })
              }
              className="self-start text-xs text-sky-400 underline underline-offset-2"
            >
              + Agregar decisión (ramificación)
            </button>
          )}
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

function CampoSalto({
  etiqueta,
  valor,
  maximo,
  onChange,
}: {
  etiqueta: string
  valor: number | null
  maximo: number
  onChange: (valor: number | null) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-400">
      {etiqueta}
      <input
        type="number"
        min={1}
        max={maximo}
        value={valor ?? ''}
        onChange={(e) => {
          const numero = Number(e.target.value)
          onChange(e.target.value === '' || !Number.isFinite(numero) || numero < 1 ? null : Math.trunc(numero))
        }}
        placeholder="siguiente"
        className={`w-24 ${CLASE_INPUT}`}
      />
    </label>
  )
}

function ImagenPasoEditor({
  paso,
  subiendo,
  onSubir,
  onQuitar,
}: {
  paso: PasoProcedimiento
  subiendo: boolean
  onSubir: (evento: ChangeEvent<HTMLInputElement>) => void
  onQuitar: () => void
}) {
  const url = useUrlAdjunto(paso.imagen)

  return (
    <div className="flex flex-col gap-2">
      {paso.imagen && url && (
        <img
          src={url}
          alt={`Captura del paso: ${paso.titulo}`}
          className="max-h-40 w-full rounded-lg border border-slate-800 object-contain"
        />
      )}
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {subiendo ? 'Subiendo...' : paso.imagen ? 'Cambiar captura' : '+ Captura'}
          <input type="file" accept="image/*" className="hidden" disabled={subiendo} onChange={onSubir} />
        </label>
        {paso.imagen && !subiendo && (
          // Solo se quita la referencia: el archivo queda en Storage
          // por si una version ya guardada del articulo lo usa.
          <button type="button" onClick={onQuitar} className="text-xs text-slate-400 underline underline-offset-2">
            Quitar captura
          </button>
        )}
      </div>
    </div>
  )
}
