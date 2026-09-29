import { isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js'

// LA SESIÓN GUARDADA EN ESTE TELÉFONO, SIN DEPENDER DE LA RED (tarea 284).
//
// supabase-js guarda la sesión en localStorage y, al abrir la app, si el
// token ya venció (dura una hora) intenta renovarlo. Sin red reintenta con
// esperas crecientes durante unos 25 segundos y, al rendirse, contesta "no
// hay sesión" aunque la sigue guardando (solo la borra si el servidor la
// rechaza). Resultado, medido en un build real: 26 s de "Cargando" y el
// inicio de sesión, sin poder abrir lo que ya está en el teléfono. Y
// cerrar sesión sin red tampoco la cierra: supabase-js no llega al
// servidor, devuelve el error y la deja guardada.
//
// Estas funciones leen y borran esa sesión directamente, con la misma
// clave que usa supabase-js (`supabase.ts` la fija igual).

/** La clave de localStorage de supabase-js: `sb-<proyecto>-auth-token`. */
export function claveSesionDe(urlSupabase: string): string {
  return `sb-${new URL(urlSupabase).hostname.split('.')[0]}-auth-token`
}

/**
 * La sesión guardada, si tiene la forma que supabase-js da por válida
 * (tokens y vencimiento) y un usuario. Nunca lanza: un almacenamiento
 * bloqueado o un texto dañado cuentan como "no hay".
 */
export function leerSesionGuardada(almacen: Pick<Storage, 'getItem'>, clave: string): Session | null {
  try {
    const texto = almacen.getItem(clave)
    if (!texto) return null
    const valor = JSON.parse(texto) as Partial<Session> | null
    if (
      typeof valor?.access_token === 'string' &&
      typeof valor.refresh_token === 'string' &&
      typeof valor.expires_at === 'number' &&
      typeof valor.user?.id === 'string'
    ) {
      return valor as Session
    }
  } catch {
    // Sin acceso al almacenamiento o texto dañado: no hay sesión que usar.
  }
  return null
}

/** Borra la sesión y sus dos compañeras, como hace supabase-js al cerrarla. */
export function borrarSesionGuardada(almacen: Pick<Storage, 'removeItem'>, clave: string): void {
  for (const sufijo of ['', '-user', '-code-verifier']) {
    try {
      almacen.removeItem(clave + sufijo)
    } catch {
      // Sin acceso al almacenamiento no hay nada que borrar.
    }
  }
}

/**
 * La sesión con la que sigue la app cuando supabase-js termina de
 * comprobarla: la suya si la tiene; la que ya se estaba usando si no pudo
 * renovarla solo por falta de red (vuelve a intentarlo sola al recuperarla);
 * y ninguna si el servidor la rechazó o no la hay.
 */
export function sesionTrasComprobar(
  comprobada: Session | null,
  error: AuthError | null,
  actual: Session | null,
): Session | null {
  if (comprobada) return comprobada
  if (error && isAuthRetryableFetchError(error)) return actual
  return null
}
