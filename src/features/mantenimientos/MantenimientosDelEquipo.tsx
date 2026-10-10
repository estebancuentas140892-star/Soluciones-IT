import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { Plus } from '../../components/iconos'
import { BTN_GHOST, BTN_GHOST_ACENTO, BTN_PRIMARIO } from '../../components/nocturne'
import { db, type Mantenimiento, type TipoMantenimiento } from '../../lib/db'
import { esPorValidar, fechaConAnio, nombreMantenimiento } from '../../lib/mantenimientos'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { diasDeCalendario } from '../../lib/vencimiento'
import { entraEnAgenda, errorDeProgramacion, hoyIso, textoProgramado } from './mantenimiento'
import { SelectorTipoMantenimiento } from './SelectorTipoMantenimiento'

// "MANTENIMIENTO" DENTRO DE "MÁS DEL EQUIPO" (tarea 320).
//
// Lo que se hace aquí es programar. Cada mantenimiento abierto es una
// fila que lleva a su pantalla, donde se dice cómo terminó (una pantalla,
// una acción). Lo realizado no se repite: ya es una intervención en el
// historial del equipo, con su evidencia. Los antecedentes sacados de
// documentación histórica se enseñan aparte y dicen que están por
// validar: no son trabajo pendiente.

function porFechaProgramada(a: Mantenimiento, b: Mantenimiento): number {
  return (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? '')
}

export function MantenimientosDelEquipo({ dispositivoId }: { dispositivoId: string }) {
  const mantenimientos = useLiveQuery(
    () =>
      db.mantenimientos
        .where('dispositivoId')
        .equals(dispositivoId)
        .filter((m) => !m.eliminadoEn)
        .toArray(),
    [dispositivoId],
  )
  const [programando, setProgramando] = useState(false)

  if (!mantenimientos) return null
  const abiertos = mantenimientos.filter(entraEnAgenda).sort(porFechaProgramada)
  const antecedentes = mantenimientos.filter(esPorValidar).sort(porFechaProgramada)

  return (
    <div className="flex flex-col gap-2.5">
      {programando ? (
        <FormularioProgramar dispositivoId={dispositivoId} alTerminar={() => setProgramando(false)} />
      ) : (
        <button type="button" onClick={() => setProgramando(true)} className={`${BTN_GHOST_ACENTO} min-h-11 self-start`}>
          <Plus size={13} aria-hidden />
          Programar
        </button>
      )}

      {abiertos.length > 0 && (
        <ul className="flex flex-col divide-y divide-noct-divider">
          {abiertos.map((m) => (
            <li key={m.id}>
              <FilaMantenimiento mantenimiento={m} />
            </li>
          ))}
        </ul>
      )}

      {abiertos.length === 0 && !programando && (
        <p className="text-[12.5px] text-noct-neutral-500">Ningún mantenimiento programado.</p>
      )}

      {antecedentes.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-medium text-noct-neutral-400">Antecedentes por validar</p>
          <ul className="flex flex-col divide-y divide-noct-divider">
            {antecedentes.map((m) => (
              <li key={m.id}>
                <FilaAntecedente mantenimiento={m} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FilaMantenimiento({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  const fecha = mantenimiento.fechaProgramada as string
  const restantes = diasDeCalendario(fecha, new Date()) ?? 0
  const razon = textoProgramado(fecha, restantes)
  return (
    <Link
      to={`/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`}
      className="flex min-h-12 items-center gap-3 py-1.5 text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium leading-[1.35]">{nombreMantenimiento(mantenimiento.tipo)}</span>
        <span className={`block text-[12.5px] ${restantes <= 0 ? 'text-noct-precaucion' : 'text-noct-neutral-400'}`}>
          {razon}
          {mantenimiento.estado === 'pospuesto' && <span className="text-noct-neutral-500"> · Pospuesto</span>}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300" aria-hidden>
        Abrir
      </span>
    </Link>
  )
}

function FilaAntecedente({ mantenimiento }: { mantenimiento: Mantenimiento }) {
  const cuando = mantenimiento.fechaProgramada ? fechaConAnio(mantenimiento.fechaProgramada) : 'Sin fecha'
  return (
    <Link
      to={`/dispositivos/${mantenimiento.dispositivoId}/mantenimientos/${mantenimiento.id}`}
      className="flex min-h-12 items-center gap-3 py-1.5 text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] leading-[1.35] text-noct-neutral-300">
          {nombreMantenimiento(mantenimiento.tipo)} · {cuando}
        </span>
        <span className="block text-[12px] text-noct-neutral-500 [overflow-wrap:anywhere]">
          Por validar · {mantenimiento.fuente}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300" aria-hidden>
        Ver
      </span>
    </Link>
  )
}

function FormularioProgramar({ dispositivoId, alTerminar }: { dispositivoId: string; alTerminar: () => void }) {
  const [tipo, setTipo] = useState<TipoMantenimiento>('preventivo')
  const [fecha, setFecha] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const error = errorDeProgramacion(fecha)

  async function programar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    setGuardando(true)
    await guardarRegistro('mantenimientos', {
      id: nuevoId(),
      dispositivoId,
      tipo,
      fechaProgramada: fecha,
      estado: 'programado',
      tecnico: '',
      fechaRealizada: null,
      resultado: '',
      observaciones: observaciones.trim(),
      historialId: null,
      fuente: '',
      validacion: 'confirmado',
    })
    setGuardando(false)
    alTerminar()
  }

  return (
    <form
      onSubmit={programar}
      noValidate
      className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3"
    >
      <SelectorTipoMantenimiento valor={tipo} alCambiar={setTipo} />
      <Campo etiqueta="Fecha en que toca">
        <input
          type="date"
          required
          min={hoyIso()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-invalid={intentado && Boolean(error)}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Observaciones (opcional)">
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      {intentado && error && (
        <p role="alert" className="text-[12.5px] text-noct-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={guardando} className={`${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-50`}>
          {guardando ? 'Guardando...' : 'Programar mantenimiento'}
        </button>
        <button type="button" onClick={alTerminar} className={`${BTN_GHOST} min-h-11 px-4`}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

