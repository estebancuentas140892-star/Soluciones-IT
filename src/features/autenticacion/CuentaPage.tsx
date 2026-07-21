import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { CampoContrasena } from '../../components/CampoContrasena'
import { CaretRight, LockSimple, SignOut } from '../../components/iconos'
import { BTN_PRIMARIO, TituloSeccion } from '../../components/nocturne'
import { useAuth } from './authContext'
import { validarCambioContrasena } from './erroresAuth'

import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'

// Cuenta del técnico con sesión activa, re-autorizada al sistema
// Nocturne (tarea 97, sin mockup: se traduce el diseño heredado
// siguiendo el patrón ya establecido, regla 12 de REGLAS.md). Pantalla
// alcanzada desde Inicio (no es una pestaña), mismo criterio que
// DiagnosticosPage: shell propio centrado con "Volver a Inicio" en vez
// del ShellNocturne de sidebar/pestañas.
//
// Su función principal sigue siendo cambiar la contraseña de inicio de
// sesión (la inicial la asigna el administrador en Supabase), contra
// el servidor, así que requiere internet. Suma un enlace a Seguridad
// de la aplicación y, nuevo aquí, "Cerrar sesión": antes esa acción
// solo vivía en la cabecera del Layout heredado, y al sacar esta
// pantalla de ahí no quedaba ningún lugar en Nocturne desde donde
// cerrar sesión.
export function CuentaPage() {
  const { session, perfil, cambiarContrasena, cerrarSesion } = useAuth()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setExito(false)

    const invalido = validarCambioContrasena(actual, nueva, confirmacion)
    if (invalido) {
      setError(invalido)
      return
    }

    setError(null)
    setGuardando(true)
    const mensaje = await cambiarContrasena(actual, nueva)
    setGuardando(false)

    if (mensaje) {
      setError(mensaje)
      return
    }
    setExito(true)
    setActual('')
    setNueva('')
    setConfirmacion('')
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="px-2 pt-2.5">
            <BotonVolver variante="nocturne" />
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="text-[22px] font-medium leading-[1.25]">Mi cuenta</h1>
            {(perfil?.nombre || session?.user?.email) && (
              <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
                {perfil?.nombre ? `${perfil.nombre} · ` : ''}
                {session?.user?.email}
              </p>
            )}
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-5 px-4 pb-10 pt-4">
          <form
            onSubmit={manejarEnvio}
            className="flex flex-col gap-3.5 rounded-lg border border-noct-divider bg-noct-surface p-4"
          >
            <div>
              <TituloSeccion>Cambiar contraseña de inicio de sesión</TituloSeccion>
              <p className="mt-1 text-[12.5px] leading-relaxed text-noct-neutral-500">
                Es la contraseña con la que entras a la app. Necesitas conexión a internet para
                cambiarla.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Contraseña actual</span>
              <CampoContrasena
                required
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Nueva contraseña</span>
              <CampoContrasena
                required
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Confirmar la nueva contraseña</span>
              <CampoContrasena
                required
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            {error && (
              <p role="alert" className="text-[12.5px] text-noct-error">
                {error}
              </p>
            )}
            {exito && (
              <p role="status" className="text-[12.5px] text-noct-exito">
                Contraseña actualizada. Úsala la próxima vez que inicies sesión.
              </p>
            )}

            <button
              type="submit"
              disabled={guardando}
              className={`${BTN_PRIMARIO} min-h-11 justify-center disabled:opacity-50`}
            >
              {guardando ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </form>

          <Link
            to="/cuenta/seguridad"
            className="flex items-center gap-3 rounded-lg border border-noct-divider bg-noct-surface p-4 text-noct-text transition-colors hover:bg-noct-text/[.03]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-noct-neutral-400/[.12] text-noct-neutral-400">
              <LockSimple size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-tight">Seguridad de la aplicación</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-noct-neutral-500">
                Bloqueo de este dispositivo con patrón o contraseña, para que nadie entre con solo
                tomar el teléfono.
              </span>
            </span>
            <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
          </Link>

          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-1 flex min-h-11 items-center justify-center gap-2 self-start rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-noct-neutral-400 transition-colors hover:bg-noct-text/[.05] hover:text-noct-text"
          >
            <SignOut size={15} aria-hidden />
            Cerrar sesión
          </button>
        </main>
      </div>
    </div>
  )
}
