import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { db, ID_VERIFICADOR } from '../../lib/db'
import { CampoContrasena } from '../../components/CampoContrasena'
import { useAuth } from '../autenticacion/authContext'
import { desbloquear, estadoInicialBoveda, type EstadoInicialBoveda } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

// Envuelve todas las rutas de la boveda: exige el permiso
// puedeVerBoveda del perfil y que la boveda este desbloqueada.
export function BovedaGuard() {
  const { session } = useAuth()
  const desbloqueada = useBovedaDesbloqueada()

  // El perfil se lee en vivo de la base local para reaccionar cuando
  // la primera sincronizacion lo descarga.
  const perfil = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )

  if (perfil === undefined) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }
  if (!perfil?.puedeVerBoveda) return <AccesoRestringido />
  if (!desbloqueada) return <PantallaDesbloqueo />
  return <Outlet />
}

// Sin revelar que es lo que se protege: quien llega aqui sin permiso
// solo ve una seccion restringida generica (minima exposicion).
function AccesoRestringido() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <IconoCandado />
      <div>
        <h1 className="text-xl font-semibold">Notas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tu usuario no tiene acceso a esta sección. Un administrador puede habilitarlo desde el
          panel de Supabase.
        </p>
      </div>
    </div>
  )
}

function PantallaDesbloqueo() {
  // El formulario depende del estado CONFIRMADO de la contrasena
  // maestra, nunca del conteo local de credenciales: definir una
  // contrasena nueva solo se ofrece cuando el servidor confirma que
  // no existe ninguna (ver estadoInicialBoveda). Asi, borrar la cache
  // o estrenar un telefono jamas reabre el flujo de "primera vez".
  const [modo, setModo] = useState<'cargando' | EstadoInicialBoveda>('cargando')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setModo('cargando')
    void estadoInicialBoveda().then((estado) => {
      if (vigente) setModo(estado)
    })
    return () => {
      vigente = false
    }
  }, [intento])

  // Si la sincronizacion trae el verificador mientras la pantalla
  // espera, se pasa solo al modo de verificacion.
  const verificadorLocal = useLiveQuery(() => db.bovedaMeta.get(ID_VERIFICADOR), [])
  useEffect(() => {
    if (verificadorLocal) setModo('verificar')
  }, [verificadorLocal])

  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (modo === 'crear' && contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError(null)
    setAbriendo(true)
    const resultado = await desbloquear(contrasena)
    setAbriendo(false)
    if (resultado) setError(resultado)
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <IconoCandado />
      <div>
        <h1 className="text-xl font-semibold">Notas</h1>
        <p className="mt-1 text-sm text-slate-400">
          {modo === 'crear'
            ? 'Sección protegida del equipo. Aún no tiene contraseña maestra.'
            : 'Sección protegida del equipo. Ingresa la contraseña maestra para continuar.'}
        </p>
      </div>

      {modo === 'cargando' && <p className="text-sm text-slate-400">Comprobando...</p>}

      {modo === 'sin-confirmar' && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-sm text-slate-400">
            No se pudo comprobar la configuración de esta sección. Conéctate a internet, espera a
            que la aplicación sincronice y vuelve a intentar.
          </p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950"
          >
            Reintentar
          </button>
        </div>
      )}

      {(modo === 'verificar' || modo === 'crear') && (
        <form onSubmit={manejarEnvio} className="flex w-full max-w-xs flex-col gap-3">
          <CampoContrasena
            required
            autoFocus
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="Contraseña maestra"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          {modo === 'crear' && (
            <>
              <CampoContrasena
                required
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="Confirma la contraseña"
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-xs text-slate-500">
                Esta contraseña quedará registrada como la contraseña maestra del equipo, asociada
                a la cuenta y válida en todos los dispositivos: acuérdenla entre todos y guárdenla
                bien, sin ella no se puede recuperar el contenido.
              </p>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={abriendo}
            className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {abriendo ? 'Desbloqueando...' : 'Desbloquear'}
          </button>
        </form>
      )}
    </div>
  )
}

function IconoCandado() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-6 w-6 text-slate-400"
      >
        <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 11V7.5a4 4 0 0 1 8 0V11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
