import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Adjuntos } from '../../components/Adjuntos'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { HojaInferior } from '../../components/HojaInferior'
import { Check, FloppyDisk, Note } from '../../components/iconos'
import { BTN_PRIMARIO_RELLENO, BTN_SECUNDARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { registrarIntervencion } from '../../lib/repositorio'

// REGISTRAR LA INTERVENCIÓN AL TERMINAR LA GUÍA (recomendación RP-1 del
// rediseño móvil, tarea 335). Una guía que se ejecutó con un equipo (el de
// la ejecución: `?equipo=` o el que se fijó en la guía) termina ofreciendo
// dejarlo en el historial de ese equipo, con el texto ya escrito.
//
// Nada se escribe solo: escribir en el historial del equipo es decisión
// del técnico (la misma regla que la evidencia de un paso). Es la misma
// bitácora que "Intervenciones" de la ficha (`registrarIntervencion`, campo
// 'intervencion'), con el mismo formulario: qué se hizo y el motivo
// opcional, y después, la foto si hace falta.
export function IntervencionAlTerminar({ equipoId, tituloGuia }: { equipoId: string; tituloGuia: string }) {
  const equipo = useLiveQuery(() => db.dispositivos.get(equipoId), [equipoId])
  const [abierta, setAbierta] = useState(false)
  const [entradaId, setEntradaId] = useState<string | null>(null)

  // Un equipo que ya no existe no recibe nada.
  if (!equipo || equipo.eliminadoEn) return null

  return (
    <>
      {entradaId ? (
        <p role="status" className="mt-1 inline-flex items-center gap-1.5 text-[13.5px] text-noct-exito">
          <Check size={15} aria-hidden />
          Registrada en el historial de {equipo.nombre}
        </p>
      ) : (
        // El equipo ya lo dicen la cabecera de la guía y la hoja: en el botón
        // partiría su nombre en dos líneas. Va en el nombre accesible.
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label={`Registrar intervención en ${equipo.nombre}`}
          className={`mt-2 w-full max-w-xs justify-center ${BTN_SECUNDARIO} min-h-12`}
        >
          <Note size={16} aria-hidden />
          Registrar intervención
        </button>
      )}
      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={entradaId ? 'Intervención registrada' : 'Registrar intervención'}
        contexto={equipo.nombre}
        etiquetaCerrar={entradaId ? 'Listo' : 'Cerrar'}
      >
        {abierta && (
          <FormularioIntervencion
            equipoId={equipoId}
            tituloGuia={tituloGuia}
            entradaId={entradaId}
            alGuardar={setEntradaId}
            alTerminar={() => setAbierta(false)}
          />
        )}
      </HojaInferior>
    </>
  )
}

function FormularioIntervencion({
  equipoId,
  tituloGuia,
  entradaId,
  alGuardar,
  alTerminar,
}: {
  equipoId: string
  tituloGuia: string
  entradaId: string | null
  alGuardar: (id: string) => void
  alTerminar: () => void
}) {
  const [descripcion, setDescripcion] = useState(`Se ejecutó la guía «${tituloGuia}».`)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!descripcion.trim() || guardando) return
    setGuardando(true)
    alGuardar(await registrarIntervencion(equipoId, descripcion.trim(), motivo.trim()))
    setGuardando(false)
  }

  // Ya guardada: como en la ficha, se ofrece la foto y se cierra con "Listo".
  if (entradaId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[14px] leading-[1.45] text-noct-neutral-300">Quedó en su historial. Si hace falta, agrega una foto.</p>
        <Adjuntos entidadTipo="historial" entidadId={entradaId} />
        <button type="button" onClick={alTerminar} className={`w-full ${BTN_PRIMARIO_RELLENO}`}>
          Listo
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <Campo etiqueta="Qué se hizo" ayuda="Añade lo que encontraste o cambiaste.">
        <textarea
          rows={3}
          required
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={`resize-y leading-[1.5] ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Motivo (opcional)">
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <button type="submit" disabled={guardando || !descripcion.trim()} className={`w-full ${BTN_PRIMARIO_RELLENO}`}>
        <FloppyDisk size={18} aria-hidden />
        {guardando ? 'Guardando...' : 'Guardar en el historial'}
      </button>
    </form>
  )
}
