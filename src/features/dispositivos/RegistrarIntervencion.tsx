import { useState, type FormEvent } from 'react'
import { registrarIntervencion } from '../../lib/repositorio'
import { Adjuntos } from '../../components/Adjuntos'

interface Props {
  dispositivoId: string
}

// Bitacora manual: lo que el historial automatico no captura porque
// no viene de editar un campo (ejemplo: "cambio de disco",
// "reinstalacion de Windows"). La entrada creada se mezcla en el
// mismo "Ver historial" de la ficha (Historial.tsx, campo
// 'intervencion'); tras guardar se ofrece adjuntarle una foto.
export function RegistrarIntervencion({ dispositivoId }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [entradaId, setEntradaId] = useState<string | null>(null)

  function cerrar() {
    setAbierto(false)
    setDescripcion('')
    setMotivo('')
    setEntradaId(null)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!descripcion.trim() || guardando) return
    setGuardando(true)
    const id = await registrarIntervencion(dispositivoId, descripcion.trim(), motivo.trim())
    setGuardando(false)
    setEntradaId(id)
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
      >
        + Registrar intervención
      </button>
    )
  }

  if (entradaId) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
        <p className="text-sm text-slate-200">Intervención registrada.</p>
        <Adjuntos entidadTipo="historial" entidadId={entradaId} />
        <button
          type="button"
          onClick={cerrar}
          className="w-fit rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Listo
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4"
    >
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Qué se hizo
        <textarea
          rows={2}
          required
          autoFocus
          placeholder="Ejemplo: cambio de disco duro, reinstalación de Windows"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Motivo (opcional)
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={guardando || !descripcion.trim()}
          className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="rounded-xl border border-slate-800 px-6 py-3 text-sm text-slate-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
