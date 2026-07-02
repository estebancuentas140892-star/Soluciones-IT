import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './authContext'

export function RequireAuth() {
  const { cargando, session } = useAuth()

  if (cargando) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-950 text-sm text-slate-400">
        Cargando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
