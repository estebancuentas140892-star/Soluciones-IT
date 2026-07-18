import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { CampoContrasena } from '../../components/CampoContrasena'
import { useAuth } from './authContext'
import { validarCambioContrasena } from './erroresAuth'

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Cuenta del tecnico con sesion activa. Por ahora su unica funcion
// es cambiar la contraseña de inicio de sesion (la inicial la asigna
// el administrador al crear la cuenta en Supabase). El cambio se
// hace contra el servidor, asi que requiere internet.
export function CuentaPage() {
  const { session, perfil, cambiarContrasena } = useAuth()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setExito(false)

    const invalido = validarCambioContrasena(actual, nueva, confirmacion)
    if (invalido) {
      setError(invalido)
      return
    }

    setError(null)
    setGuardando(true)
    const mensaje = await cambiarContrasena(actual, nueva)
    setGuardando(false)

    if (mensaje) {
      setError(mensaje)
      return
    }
    setExito(true)
    setActual('')
    setNueva('')
    setConfirmacion('')
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver />
        <div>
          <h1 className="text-xl font-semibold">Mi cuenta</h1>
          {(perfil?.nombre || session?.user?.email) && (
            <p className="text-xs text-slate-500">
              {perfil?.nombre ? `${perfil.nombre} · ` : ''}
              {session?.user?.email}
            </p>
          )}
        </div>
      </header>

      <form
        onSubmit={manejarEnvio}
        className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4"
      >
        <div>
          <h2 className="text-sm font-medium text-slate-200">Cambiar contraseña de inicio de sesión</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Es la contraseña con la que entras a la app. Necesitas conexión a internet para
            cambiarla.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Contraseña actual
          <CampoContrasena
            required
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={CLASE_INPUT}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Nueva contraseña
          <CampoContrasena
            required
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className={CLASE_INPUT}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Confirmar la nueva contraseña
          <CampoContrasena
            required
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            className={CLASE_INPUT}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {exito && (
          <p role="status" className="text-sm text-emerald-400">
            Contraseña actualizada. Úsala la próxima vez que inicies sesión.
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </form>

      <Link
        to="/cuenta/seguridad"
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
      >
        <div>
          <h2 className="text-sm font-medium text-slate-200">Seguridad de la aplicación</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Bloqueo de este dispositivo con patrón o contraseña, para que nadie entre con solo tomar
            el teléfono.
          </p>
        </div>
        <span className="shrink-0 text-slate-500" aria-hidden>
          ›
        </span>
      </Link>
    </div>
  )
}
