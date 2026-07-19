import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Perfil } from '../../lib/db'
import { useAuth } from './authContext'

// El perfil en vivo desde la base local (Dexie), no el snapshot que
// carga AuthProvider una sola vez al cambiar la sesion: reacciona al
// instante cuando sync trae un cambio de permisos (por ejemplo
// puedeVerBoveda) desde otro dispositivo. undefined mientras carga,
// null sin sesion o sin fila de perfil. Antes cada pantalla repetia
// esta misma consulta por su cuenta (ShellNocturne, BottomNav,
// BovedaGuard, CredencialEnPaso, DispositivoPage).
export function usePerfilVivo(): Perfil | null | undefined {
  const { session } = useAuth()
  return useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )
}
