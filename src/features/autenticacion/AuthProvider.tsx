import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CLAVE_SESION, supabase } from '../../lib/supabase'
import { borrarSesionGuardada, leerSesionGuardada, sesionTrasComprobar } from '../../lib/sesionGuardada'
import { db, type Perfil } from '../../lib/db'
import { sincronizar } from '../../lib/sync'
import { AuthContext } from './authContext'
import { traducirErrorAuth } from './erroresAuth'
import { desconectarAlSalir } from '../asistencia/sesionAsistencia'

// Lo que se le da al servidor para cerrar la sesión antes de cerrarla solo
// en este teléfono (tarea 284).
const ESPERA_CIERRE_MS = 4000

function sesionGuardadaAlAbrir(): Session | null {
  if (!supabase || !CLAVE_SESION || typeof localStorage === 'undefined') return null
  return leerSesionGuardada(localStorage, CLAVE_SESION)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // SIN CONEXIÓN, LA SESIÓN GUARDADA ABRE LA APP (tarea 284). Con el token
  // vencido y sin red, supabase-js tarda unos 25 s en rendirse y al final
  // contesta "sin sesión" aunque la sigue guardando: la app se quedaba en
  // "Cargando" y acababa en el inicio de sesión, sin dejar abrir lo que ya
  // está en el teléfono. La sesión guardada se usa desde el primer momento
  // y la comprobación de supabase-js decide después (`sesionTrasComprobar`).
  const [sesionInicial] = useState(sesionGuardadaAlAbrir)
  const [cargando, setCargando] = useState(sesionInicial === null)
  const [session, setSession] = useState<Session | null>(sesionInicial)
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

    supabase.auth.getSession().then(({ data, error }) => {
      setSession((actual) => sesionTrasComprobar(data.session, error, actual))
      setCargando(false)
    })

    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, nuevaSession) => {
      // La sesión inicial la decide getSession, arriba: sin red y con el
      // token vencido, este aviso llega sin sesión aunque siga guardada.
      if (evento === 'INITIAL_SESSION' && !nuevaSession) return
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
    // Un computador conectado por asistencia remota (tarea 258) se
    // desconecta antes de salir: la sesión es del técnico, no del
    // teléfono. Nunca frena el cierre (como mucho un par de segundos).
    await desconectarAlSalir()
    // No se borra la base local: puede haber cambios sin subir y el
    // equipo es de confianza, cada quien usa su propio teléfono.
    //
    // Sin red, supabase-js no llega al servidor: devuelve el error y deja
    // la sesión guardada (y con el token vencido tarda unos 25 s en
    // rendirse). Cerrar sesión tiene que cerrarla SIEMPRE, porque es la
    // salida del bloqueo olvidado (tarea 284): sin red se borra al
    // instante la de este teléfono, y con red se le dan unos segundos al
    // servidor. La del servidor vence sola; aquí ya no queda con qué usarla.
    const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false
    const { error } = sinRed
      ? { error: new Error('Sin conexión.') }
      : await Promise.race([
          supabase.auth.signOut(),
          new Promise<{ error: Error }>((listo) =>
            setTimeout(() => listo({ error: new Error('El servidor no contestó a tiempo.') }), ESPERA_CIERRE_MS),
          ),
        ])
    if (error && CLAVE_SESION) {
      borrarSesionGuardada(localStorage, CLAVE_SESION)
      setSession(null)
      // Ya sin nada guardado, supabase-js la cierra sin ir al servidor y
      // avisa SIGNED_OUT a quien escucha (el canal de tiempo real de sync.ts).
      void supabase.auth.signOut().catch(() => {})
    }
  }

  return (
    <AuthContext.Provider
      value={{ cargando, session, perfil, iniciarSesion, cambiarContrasena, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  )
}
