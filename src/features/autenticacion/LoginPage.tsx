import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './authContext'
import { supabaseConfigured } from '../../lib/supabase'

export function LoginPage() {
  const { iniciarSesion, session, cargando } = useAuth()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!cargando && session) return <Navigate to="/" replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    const mensaje = await iniciarSesion(correo.trim(), contrasena)
    setEnviando(false)
    if (mensaje) setError(mensaje)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-slate-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Soluciones IT</h1>
        <p className="mt-1 text-sm text-slate-400">Inicia sesión para continuar</p>
      </div>

      {!supabaseConfigured && (
        <p className="w-full max-w-sm rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          La aplicación aún no está conectada al servidor. Falta configurar las variables de entorno de Supabase.
        </p>
      )}

      {/* autoComplete="off" en el formulario y en los campos para
          pedirle al navegador que NO guarde ni autocomplete la cuenta
          y la contraseña: asi nadie que tome el telefono ve una cuenta
          guardada para entrar de un toque. Los navegadores pueden
          ofrecer guardar igualmente (es una funcion del sistema), pero
          esto lo desalienta y quita el autocompletado en la mayoria. */}
      <form onSubmit={manejarEnvio} autoComplete="off" className="flex w-full max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Correo
          <input
            type="email"
            required
            autoComplete="off"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Contraseña
          <input
            type="password"
            required
            autoComplete="off"
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !supabaseConfigured}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
