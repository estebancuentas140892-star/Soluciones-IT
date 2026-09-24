import { useEffect, useState } from 'react'
import { Check, PlugsConnected } from '../../components/iconos'
import type { PasoProcedimiento, Referencia } from '../../lib/db'
import { useAuth } from '../autenticacion/authContext'
import { HojaEnviarAEquipo } from './HojaEnviarAEquipo'
import { formatoCodigo } from './modelo'
import { useLatidoAsistencia, useSesionAsistencia } from './sesionAsistencia'

// EL EQUIPO CONECTADO, EN LA GUIA (tarea 258).
//
// Solo existe mientras hay una conexion: sin equipo conectado la guia no
// pinta nada nuevo (regla 20e: nada por sumar). Es a la vez el indicador
// ("Equipo 482 731") y la accion ("Enviar a este equipo"), en una fila de
// 44 px sobre los botones del pie. Monta tambien el latido que mantiene
// viva la sesion mientras la guia esta abierta a la vista.

interface Props {
  paso: PasoProcedimiento
  numeroPaso: number
  tituloGuia: string
  referencias: Map<string, Referencia>
  /** La acción a la vista, para ofrecer "Solo esta acción". */
  tareaId: string | null
}

export function FranjaEquipoConectado(props: Props) {
  const { session } = useAuth()
  const usuario = session?.user?.id ?? null
  const sesion = useSesionAsistencia(usuario)
  useLatidoAsistencia(usuario)
  const [abierta, setAbierta] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!enviado) return
    const temporizador = window.setTimeout(() => setEnviado(false), 2500)
    return () => window.clearTimeout(temporizador)
  }, [enviado])

  if (!sesion) return null

  return (
    <>
      <div className="mx-auto flex min-h-11 w-full max-w-xl items-center gap-2 rounded-xl border border-noct-exito/30 bg-noct-exito/[.07] pl-3 pr-1">
        <PlugsConnected size={16} className="shrink-0 text-noct-exito" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] text-noct-neutral-200">
          Equipo <span className="font-mono tracking-[.08em]">{formatoCodigo(sesion.codigo)}</span>
        </span>
        {enviado ? (
          <span role="status" className="flex h-11 items-center gap-1.5 px-2.5 text-[13px] font-medium text-noct-exito">
            <Check size={15} aria-hidden />
            Enviado
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAbierta(true)}
            aria-haspopup="dialog"
            className="flex h-11 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium text-noct-accent-300 hover:bg-noct-accent/10"
          >
            Enviar a este equipo
          </button>
        )}
      </div>
      <HojaEnviarAEquipo
        abierto={abierta}
        onCerrar={() => setAbierta(false)}
        onEnviado={() => {
          setAbierta(false)
          setEnviado(true)
        }}
        sesion={sesion}
        {...props}
      />
    </>
  )
}
