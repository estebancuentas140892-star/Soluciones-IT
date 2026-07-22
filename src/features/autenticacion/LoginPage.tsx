import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './authContext'
import { supabaseConfigured } from '../../lib/supabase'
import { CampoContrasena } from '../../components/CampoContrasena'
import { Campo, CLASE_CAMPO } from '../../components/campos'
import { BTN_PRIMARIO } from '../../components/nocturne'

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
    <div className="nocturne flex min-h-svh flex-col items-center justify-center gap-6 bg-noct-bg px-6 font-inter text-noct-text">
      <div className="text-center">
        <h1 className="text-[22px] font-medium leading-tight">Soluciones IT</h1>
        <p className="mt-1.5 text-[13.5px] text-noct-neutral-400">Inicia sesión para continuar</p>
      </div>

      {!supabaseConfigured && (
        <p className="w-full max-w-sm rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-4 py-3 text-sm text-noct-precaucion">
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
        <Campo etiqueta="Correo">
          <input
            type="email"
            required
            autoComplete="off"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>
        <Campo etiqueta="Contraseña">
          <CampoContrasena
            required
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>

        {error && (
          <p role="alert" className="text-sm text-noct-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !supabaseConfigured}
          className={`${BTN_PRIMARIO} mt-2 min-h-12 justify-center disabled:opacity-50`}
        >
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
