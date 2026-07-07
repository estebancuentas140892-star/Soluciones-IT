import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { db, ID_BLOQUEO_APP, type MetodoBloqueoApp } from '../../lib/db'
import { Cargando } from '../../components/Cargando'
import { CampoContrasena } from '../../components/CampoContrasena'
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-slate-100">
      <div className="flex flex-col items-center gap-3 text-center">
        <IconoCandado />
        <div>
          <h1 className="text-xl font-semibold">Soluciones IT</h1>
          <p className="mt-1 text-sm text-slate-400">
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
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <form onSubmit={manejarEnvioContrasena} className="flex w-full max-w-xs flex-col gap-3">
          <CampoContrasena
            required
            autoFocus
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="Contraseña de desbloqueo"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={abriendo}
            className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {abriendo ? 'Desbloqueando...' : 'Desbloquear'}
          </button>
        </form>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => setMostrarAyuda((v) => !v)}
          className="text-xs text-slate-500 underline decoration-dotted underline-offset-2"
        >
          ¿Olvidaste tu código de desbloqueo?
        </button>
        {mostrarAyuda && (
          <div className="flex max-w-xs flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-400">
              Puedes cerrar sesión para quitar el bloqueo. Para volver a entrar necesitarás la
              contraseña de tu cuenta. Tu información no se pierde: se recupera al iniciar sesión de
              nuevo.
            </p>
            <button
              type="button"
              onClick={() => void restablecerYCerrar()}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-200"
            >
              Cerrar sesión y quitar el bloqueo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function IconoCandado() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-6 w-6 text-slate-400"
      >
        <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 11V7.5a4 4 0 0 1 8 0V11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
