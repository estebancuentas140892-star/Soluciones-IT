import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { db, ID_BLOQUEO_APP, type MetodoBloqueoApp } from '../../lib/db'
import { Cargando } from '../../components/Cargando'
import { CampoContrasena } from '../../components/CampoContrasena'
import { LockSimple } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_GHOST_TENUE } from '../../components/nocturne'
import { useAuth } from '../autenticacion/authContext'
import { desbloquearApp, restablecerBloqueoApp } from './bloqueoApp'
import { serializarPatron } from './patron'
import { PatronInput } from './PatronInput'
import { useBloqueoAppDesbloqueado } from './useBloqueoApp'

// Envuelve TODAS las rutas autenticadas: si el dispositivo tiene un
// bloqueo configurado y aun no se ha desbloqueado en esta apertura de
// la app, muestra la pantalla de bloqueo en vez del contenido. Si no
// hay bloqueo configurado, la app se ve como siempre (es opcional y lo
// activa cada tecnico en su telefono).
export function BloqueoAppGuard() {
  const desbloqueada = useBloqueoAppDesbloqueado()
  // undefined mientras carga, null si no hay bloqueo, la config si lo hay.
  const config = useLiveQuery(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) ?? null, [])

  if (config === undefined) return <Cargando />
  if (config === null) return <Outlet />
  if (desbloqueada) return <Outlet />
  return <PantallaBloqueo metodo={config.metodo} />
}

function PantallaBloqueo({ metodo }: { metodo: MetodoBloqueoApp }) {
  const { cerrarSesion } = useAuth()
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [reinicioPatron, setReinicioPatron] = useState(0)
  const [mostrarAyuda, setMostrarAyuda] = useState(false)

  async function intentar(secreto: string) {
    setError(null)
    setAbriendo(true)
    const mensaje = await desbloquearApp(secreto)
    setAbriendo(false)
    if (mensaje) {
      setError(mensaje)
      setContrasena('')
      setReinicioPatron((n) => n + 1)
    }
    // Si es correcto, el estado observable cambia y el guard muestra la app.
  }

  async function manejarEnvioContrasena(evento: FormEvent) {
    evento.preventDefault()
    await intentar(contrasena)
  }

  async function restablecerYCerrar() {
    await restablecerBloqueoApp()
    await cerrarSesion()
  }

  return (
    <div className="nocturne flex min-h-svh flex-col items-center justify-center gap-6 bg-noct-bg px-6 font-inter text-noct-text">
      <div className="flex flex-col items-center gap-[18px] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-noct-divider bg-noct-surface text-noct-accent-300">
          <LockSimple size={28} aria-hidden />
        </div>
        <div>
          <h1 className="text-[22px] font-medium leading-tight">Soluciones IT</h1>
          <p className="mt-1.5 text-[13.5px] text-noct-neutral-400">
            {metodo === 'patron'
              ? 'Dibuja tu patrón para continuar'
              : 'Ingresa tu contraseña de desbloqueo'}
          </p>
        </div>
      </div>

      {metodo === 'patron' ? (
        <div className="flex flex-col items-center gap-3">
          <PatronInput
            onCompletar={(secuencia) => void intentar(serializarPatron(secuencia))}
            deshabilitado={abriendo}
            reiniciarToken={reinicioPatron}
          />
          {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
        </div>
      ) : (
        <form onSubmit={manejarEnvioContrasena} className="flex w-full max-w-[300px] flex-col gap-2.5">
          <CampoContrasena
            required
            autoFocus
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="Contraseña de desbloqueo"
            className={`min-h-12 w-full rounded-md border bg-noct-surface px-3.5 py-3 text-center text-[15px] text-noct-text outline-none transition-colors placeholder:text-noct-neutral-600 focus:border-noct-accent ${error ? 'border-noct-error/55' : 'border-noct-divider'}`}
          />
          {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
          <button
            type="submit"
            disabled={abriendo}
            className={`${BTN_PRIMARIO} min-h-12 justify-center disabled:opacity-50`}
          >
            {abriendo ? 'Desbloqueando...' : 'Desbloquear'}
          </button>
        </form>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => setMostrarAyuda((v) => !v)}
          className="text-[12.5px] text-noct-neutral-500 underline decoration-dotted underline-offset-2"
        >
          ¿Olvidaste tu código de desbloqueo?
        </button>
        {mostrarAyuda && (
          <div className="flex max-w-[300px] flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface p-3">
            <p className="text-[12.5px] leading-relaxed text-noct-neutral-400">
              Puedes cerrar sesión para quitar el bloqueo. Para volver a entrar necesitarás la
              contraseña de tu cuenta. Tu información no se pierde: se recupera al iniciar sesión de
              nuevo.
            </p>
            <button
              type="button"
              onClick={() => void restablecerYCerrar()}
              className={`${BTN_GHOST_TENUE} min-h-9 justify-center`}
            >
              Cerrar sesión y quitar el bloqueo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
