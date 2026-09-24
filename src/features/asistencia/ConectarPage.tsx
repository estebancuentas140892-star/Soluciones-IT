import { useState, useSyncExternalStore } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { useOrigen } from '../../app/useOrigen'
import { CloudSlash, Monitor, PlugsConnected, QrCode } from '../../components/iconos'
import { CLASE_CAMPO_MONO, CLASE_ETIQUETA } from '../../components/campos'
import { BTN_GHOST_PELIGRO, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { conOrigen } from '../../lib/origenNavegacion'
import { useAuth } from '../autenticacion/authContext'
import { TEXTO_CIERRE, TEXTO_ERROR, type ErrorAsistencia } from './apiTecnico'
import { formatoCodigo } from './modelo'
import {
  conectarEquipo,
  desconectarEquipo,
  olvidarCierreReciente,
  useCierreReciente,
  useLatidoAsistencia,
  useSesionAsistencia,
} from './sesionAsistencia'

// CONECTAR EQUIPO (tarea 258, sección 10 del encargo).
//
// El computador atendido abre `/asistencia` y enseña un código de 6
// cifras y su QR. Aquí se escribe el código, o llega ya puesto desde el
// QR (`/conectar?codigo=482731`, leído con la cámara del teléfono o con
// el escáner de la app, que reconoce ese QR desde la tarea 256): en ese
// caso se PIDE CONFIRMAR antes de conectar, porque un QR puede venir de
// cualquier pantalla. Conectado, se vuelve a la guía (si se vino de una)
// y cada paso ofrece "Enviar a este equipo".

function suscribirRed(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

function soloCifras(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 6)
}

function horaCorta(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export function ConectarPage() {
  const navigate = useNavigate()
  const origen = useOrigen()
  const [parametros] = useSearchParams()
  const { session } = useAuth()
  const usuario = session?.user?.id ?? null
  const sesion = useSesionAsistencia(usuario)
  const cierre = useCierreReciente()
  useLatidoAsistencia(usuario)
  const enLinea = useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true)

  const codigoDelQr = soloCifras(parametros.get('codigo') ?? '')
  const [codigo, setCodigo] = useState(codigoDelQr.length === 6 ? codigoDelQr : '')
  const [conectando, setConectando] = useState(false)
  const [error, setError] = useState<ErrorAsistencia | null>(null)

  const desdeQr = codigoDelQr.length === 6 && codigo === codigoDelQr

  async function conectar() {
    if (!usuario || codigo.length !== 6 || conectando) return
    setConectando(true)
    setError(null)
    const resultado = await conectarEquipo(codigo, usuario)
    setConectando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setCodigo('')
    olvidarCierreReciente()
  }

  const volver = origen ? (
    <button type="button" onClick={() => navigate(origen.to)} className={`min-h-11 justify-center ${BTN_PRIMARIO}`}>
      <span className="truncate">
        {origen.to.startsWith('/soluciones/') ? 'Seguir con la guía' : `Volver a ${origen.etiqueta}`}
      </span>
    </button>
  ) : (
    <button type="button" onClick={() => navigate('/')} className={`min-h-11 justify-center ${BTN_PRIMARIO}`}>
      Ir a Resolver para abrir una guía
    </button>
  )

  return (
    <Chasis modo="tarea" rotulo="Asistencia remota" titulo="Conectar equipo">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-8 pt-4">
        {sesion ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-noct-exito/30 bg-noct-exito/[.07] p-4">
            <p className="flex items-center gap-2 text-[15px] font-medium text-noct-text">
              <PlugsConnected size={19} className="shrink-0 text-noct-exito" aria-hidden />
              Conectado al equipo{' '}
              <span className="font-mono tracking-[.1em]">{formatoCodigo(sesion.codigo)}</span>
            </p>
            <p className="text-[13.5px] leading-snug text-noct-neutral-300">
              Desde las {horaCorta(sesion.conectadaEn)}. Abre una guía y, en cada paso, toca{' '}
              <span className="font-medium text-noct-neutral-100">«Enviar a este equipo»</span>. El computador
              solo ve lo que envíes, nunca la Bóveda ni ninguna clave.
            </p>
            {volver}
            <button
              type="button"
              onClick={() => usuario && void desconectarEquipo(usuario)}
              className={`min-h-11 justify-center ${BTN_GHOST_PELIGRO}`}
            >
              Desconectar equipo
            </button>
          </section>
        ) : (
          <>
            {cierre && (
              <p role="status" className="rounded-xl border border-noct-divider bg-noct-surface px-3.5 py-3 text-[13.5px] leading-snug text-noct-neutral-200">
                La conexión con el equipo {formatoCodigo(cierre.codigo)} terminó.{' '}
                {cierre.motivo === 'no_encontrada' ? '' : TEXTO_CIERRE[cierre.motivo]}
              </p>
            )}

            <section className="flex flex-col gap-2 rounded-2xl border border-noct-divider bg-noct-surface p-4">
              <p className="flex items-start gap-2.5 text-[14px] leading-snug text-noct-neutral-200">
                <Monitor size={18} className="mt-px shrink-0 text-noct-neutral-400" aria-hidden />
                <span>
                  En el computador que vas a atender, abre{' '}
                  <span className="font-mono text-noct-text">{window.location.host}/asistencia</span>. Te dará un código
                  de 6 cifras.
                </span>
              </p>
            </section>

            <form
              onSubmit={(evento) => {
                evento.preventDefault()
                void conectar()
              }}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>
                  {desdeQr ? '¿Conectar con este equipo?' : 'Código del equipo'}
                </span>
                <input
                  value={codigo.length > 3 ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : codigo}
                  onChange={(evento) => {
                    setError(null)
                    setCodigo(soloCifras(evento.target.value))
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  enterKeyHint="go"
                  aria-describedby={error ? 'conectar-error' : undefined}
                  aria-invalid={error ? true : undefined}
                  placeholder="000 000"
                  className={`${CLASE_CAMPO_MONO} h-14 text-center text-[26px] tracking-[.18em]`}
                />
              </label>

              {error && (
                <p id="conectar-error" role="alert" className="text-[13.5px] leading-snug text-noct-error">
                  {TEXTO_ERROR[error]}
                </p>
              )}

              {!enLinea && (
                <p className="flex items-start gap-2 rounded-lg bg-noct-text/[.05] px-3 py-2.5 text-[13px] leading-snug text-noct-neutral-200">
                  <CloudSlash size={16} className="mt-px shrink-0 text-noct-neutral-400" aria-hidden />
                  Sin conexión: conectar un equipo necesita internet.
                </p>
              )}

              <button
                type="submit"
                disabled={codigo.length !== 6 || !enLinea || conectando || !usuario}
                className={`min-h-12 justify-center text-[15px] ${BTN_PRIMARIO} disabled:opacity-40`}
              >
                {conectando ? 'Conectando…' : desdeQr ? `Conectar con ${formatoCodigo(codigo)}` : 'Conectar'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate('/escaner', { state: origen ? conOrigen(origen.to, origen.etiqueta) : undefined })}
              className={`min-h-11 justify-center gap-2 ${BTN_SECUNDARIO}`}
            >
              <QrCode size={17} aria-hidden />
              Escanear el QR de la pantalla
            </button>
          </>
        )}
      </div>
    </Chasis>
  )
}
