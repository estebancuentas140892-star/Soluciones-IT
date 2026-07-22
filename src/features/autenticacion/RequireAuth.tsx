import { Navigate, Outlet } from 'react-router-dom'
import { Cargando } from '../../components/Cargando'
import { useAuth } from './authContext'

export function RequireAuth() {
  const { cargando, session } = useAuth()

  if (cargando) return <Cargando />

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
