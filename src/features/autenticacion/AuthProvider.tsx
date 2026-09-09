import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { db, type Perfil } from '../../lib/db'
import { sincronizar } from '../../lib/sync'
import { AuthContext } from './authContext'
import { traducirErrorAuth } from './erroresAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    if (!supabase) {
      // BANCO DE PRUEBAS LOCAL, SOLO EN DESARROLLO.
      //
      // La condicion se escribe INLINE y con `import.meta.env.DEV` como
      // primer termino a proposito: en el build de produccion Vite lo
      // sustituye por `false`, Rollup elimina la rama entera y con ella
      // el import dinamico, asi que el modulo del banco ni siquiera
      // llega a empaquetarse. Con la bandera en otro modulo el chunk
      // `semillaLocal` SI aparecia en `dist`.
      //
      // Ademas hay que pedirlo a mano con VITE_MODO_PRUEBA_LOCAL=1 en un
      // `.env.local`, que no se versiona.
      if (import.meta.env.DEV && import.meta.env.VITE_MODO_PRUEBA_LOCAL === '1') {
        void import('../../pruebas/semillaLocal')
          .then(async (m) => {
            await m.sembrarBancoDePruebas()
            setSession(m.SESION_PRUEBA)
          })
          .finally(() => setCargando(false))
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
