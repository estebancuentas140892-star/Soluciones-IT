import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Perfil } from '../../lib/db'

export interface AuthContextValue {
  cargando: boolean
  session: Session | null
  perfil: Perfil | null
  iniciarSesion: (correo: string, contrasena: string) => Promise<string | null>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
