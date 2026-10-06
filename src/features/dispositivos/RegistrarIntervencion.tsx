import { useState, type FormEvent } from 'react'
import { registrarIntervencion } from '../../lib/repositorio'
import { Adjuntos } from '../../components/Adjuntos'
import { Plus } from '../../components/iconos'
import { CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { Boton } from '../../components/Boton'

interface Props {
  dispositivoId: string
}

// El formulario se dibuja sobre una tarjeta, así que usa la variante de
// fondo de app (sobre superficie el campo no contrastaría).
const CLASE_CAMPO = CLASE_CAMPO_SOBRE_SUPERFICIE

// Bitacora manual: lo que el historial automatico no captura porque
// no viene de editar un campo (ejemplo: "cambio de disco",
// "reinstalacion de Windows"). La entrada creada se mezcla en el
// mismo "Ver historial" de la ficha (Historial.tsx, campo
// 'intervencion'); tras guardar se ofrece adjuntarle una foto.
// Re-autorizado a Nocturne (Ficha de Dispositivo.dc.html): encabeza la
// seccion "Intervenciones", tarjeta de registro con textarea y acciones.
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
      <Boton papel="texto" className="-ml-2 self-start" icono={<Plus size={13} aria-hidden />} onClick={() => setAbierto(true)}>
        Registrar
      </Boton>
    )
  }

  if (entradaId) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface px-3 py-3">
        <p className="text-sm text-noct-text">Intervención registrada.</p>
        <Adjuntos entidadTipo="historial" entidadId={entradaId} />
        <Boton papel="texto" tono="descarte" className="-ml-2 self-start" onClick={cerrar}>
          Listo
        </Boton>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-noct-neutral-400">
        Qué se hizo
        <textarea
          rows={2}
          required
          autoFocus
          placeholder="Qué se hizo: cambio de ribbon, limpieza de cabezal..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-noct-neutral-400">
        Motivo (opcional)
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={`min-h-11 ${CLASE_CAMPO}`}
        />
      </label>
      <div className="flex gap-2">
        {/* Desactivado mientras la descripción, que está a la vista, siga
            vacía (T4). */}
        <Boton
          type="submit"
          papel="principal"
          disabled={!descripcion.trim()}
          cargando={guardando}
          textoCargando="Guardando…"
        >
          Guardar intervención
        </Boton>
        <Boton papel="texto" tono="descarte" onClick={cerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}
