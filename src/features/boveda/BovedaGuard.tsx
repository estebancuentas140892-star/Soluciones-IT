import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { db } from '../../lib/db'
import { useAuth } from '../autenticacion/authContext'
import { desbloquear } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

// Envuelve todas las rutas de la boveda: exige el permiso
// puedeVerBoveda del perfil y que la boveda este desbloqueada.
export function BovedaGuard() {
  const { session } = useAuth()
  const desbloqueada = useBovedaDesbloqueada()

  // El perfil se lee en vivo de la base local para reaccionar cuando
  // la primera sincronizacion lo descarga.
  const perfil = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )

  if (perfil === undefined) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }
  if (!perfil?.puedeVerBoveda) return <AccesoRestringido />
  if (!desbloqueada) return <PantallaDesbloqueo />
  return <Outlet />
}

function AccesoRestringido() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <IconoCandado />
      <div>
        <h1 className="text-xl font-semibold">Bóveda</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tu usuario no tiene acceso a la bóveda. Un administrador puede habilitarlo desde Supabase
          activando el permiso de bóveda en tu perfil.
        </p>
      </div>
    </div>
  )
}

function PantallaDesbloqueo() {
  // Si la boveda esta vacia, la contrasena que se escriba aqui queda
  // como contrasena maestra: se pide confirmarla para evitar erratas.
  const cantidad = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).count(), [])
  const bovedaVacia = cantidad === 0

  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (bovedaVacia && contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError(null)
    setAbriendo(true)
    const resultado = await desbloquear(contrasena)
    setAbriendo(false)
    if (resultado) setError(resultado)
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <IconoCandado />
      <div>
        <h1 className="text-xl font-semibold">Bóveda</h1>
        <p className="mt-1 text-sm text-slate-400">
          IP, usuarios y contraseñas. Ingresa la contraseña maestra para desbloquear.
        </p>
      </div>

      <form onSubmit={manejarEnvio} className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          required
          autoFocus
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Contraseña maestra"
          autoComplete="off"
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />

        {bovedaVacia && (
          <>
            <input
              type="password"
              required
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder="Confirma la contraseña"
              autoComplete="off"
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-xs text-slate-500">
              La bóveda está vacía. Esta contraseña quedará como la contraseña maestra del equipo:
              acuérdenla entre todos y guárdenla bien, sin ella no se pueden recuperar las
              credenciales.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={abriendo}
          className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {abriendo ? 'Desbloqueando...' : 'Desbloquear'}
        </button>
      </form>
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
