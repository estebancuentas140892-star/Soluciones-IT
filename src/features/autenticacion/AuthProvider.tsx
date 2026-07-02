import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { db, type Perfil } from '../../lib/db'
import { sincronizar } from '../../lib/sync'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    if (!supabase) {
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
    return error ? traducirError(error.message) : null
  }

  async function cerrarSesion(): Promise<void> {
    if (!supabase) return
    // No se borra la base local: puede haber cambios sin subir y el
    // equipo es de confianza, cada quien usa su propio teléfono.
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ cargando, session, perfil, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

function traducirError(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(mensaje)) return 'La cuenta aún no fue confirmada.'
  if (/fetch|network/i.test(mensaje)) return 'Sin conexión con el servidor. Intenta de nuevo.'
  return mensaje
}
