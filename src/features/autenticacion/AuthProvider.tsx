import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { db, type Perfil } from '../../lib/db'
import { sincronizar } from '../../lib/sync'
import { MODO_PRUEBA_LOCAL, PERFIL_PRUEBA } from '../../lib/modoPruebaLocal'
import { AuthContext } from './authContext'
import { traducirErrorAuth } from './erroresAuth'

// Sesion ficticia del banco de pruebas local (solo desarrollo, ver
// src/lib/modoPruebaLocal.ts). No lleva token de nada: sirve unicamente
// para que `RequireAuth` deje pasar y se pueda mirar la interfaz en un
// ancho de telefono sin credenciales del servidor.
const SESION_PRUEBA = {
  access_token: 'prueba-local',
  refresh_token: 'prueba-local',
  expires_in: 0,
  token_type: 'bearer',
  user: { id: PERFIL_PRUEBA.id, email: PERFIL_PRUEBA.correo },
} as unknown as Session

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    if (!supabase) {
      // Banco de pruebas local: sin servidor, con sesion ficticia y la
      // base sembrada de datos inventados. La rama entera desaparece
      // del build de produccion (`import.meta.env.DEV` es false), y la
      // semilla se importa de forma dinamica para que ni siquiera se
      // empaquete.
      if (MODO_PRUEBA_LOCAL) {
        void import('../../pruebas/semillaLocal')
          .then((m) => m.sembrarBancoDePruebas())
          .finally(() => {
            setSession(SESION_PRUEBA)
            setCargando(false)
          })
        return
      }
      setCargando(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSession) => {
      setSession(nuevaSession)
      // Sincroniza de inmediato al iniciar sesión, sin esperar al
      // siguiente intervalo o evento de red.
      if (nuevaSession) void sincronizar()
    })

    return () => suscripcion.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setPerfil(null)
      return
    }
    let vigente = true
    db.perfiles.get(session.user.id).then((encontrado) => {
      if (vigente) setPerfil(encontrado ?? null)
    })
    return () => {
      vigente = false
    }
  }, [session])

  async function iniciarSesion(correo: string, contrasena: string): Promise<string | null> {
    if (!supabase) return 'La aplicación aún no está conectada al servidor.'
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
    return error ? traducirErrorAuth(error.message) : null
  }

  async function cambiarContrasena(actual: string, nueva: string): Promise<string | null> {
    if (!supabase) return 'La aplicación aún no está conectada al servidor.'
    const correo = session?.user?.email
    if (!correo) return 'No hay una sesión activa. Vuelve a iniciar sesión.'

    // Verifica la contraseña actual antes de cambiarla: evita que
    // alguien que tome un teléfono con la sesión abierta la cambie
    // sin conocerla.
    const verificacion = await supabase.auth.signInWithPassword({
      email: correo,
      password: actual,
    })
    if (verificacion.error) {
      return /invalid login credentials/i.test(verificacion.error.message)
        ? 'La contraseña actual no es correcta.'
        : traducirErrorAuth(verificacion.error.message)
    }

    const { error } = await supabase.auth.updateUser({ password: nueva })
    return error ? traducirErrorAuth(error.message) : null
  }

  async function cerrarSesion(): Promise<void> {
    if (!supabase) return
    // No se borra la base local: puede haber cambios sin subir y el
    // equipo es de confianza, cada quien usa su propio teléfono.
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ cargando, session, perfil, iniciarSesion, cambiarContrasena, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  )
}
