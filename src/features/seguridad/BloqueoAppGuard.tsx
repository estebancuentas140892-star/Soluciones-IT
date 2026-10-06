import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { db, ID_BLOQUEO_APP, type ConfigBloqueoApp } from '../../lib/db'
import { Cargando } from '../../components/Cargando'
import { CampoContrasena } from '../../components/CampoContrasena'
import { LockSimple } from '../../components/iconos'
import { useAuth } from '../autenticacion/authContext'
import {
  desbloquearApp,
  desbloquearAppConDispositivo,
  MENSAJE_DISPOSITIVO_NO_SE_PUDO,
  restablecerBloqueoApp,
} from './bloqueoApp'
import { serializarPatron } from './patron'
import { PatronInput } from './PatronInput'
import { useBloqueoAppDesbloqueado, useDesbloqueoDispositivoDisponible } from './useBloqueoApp'
import { Boton } from '../../components/Boton'
import { claseBoton } from '../../components/claseBoton'

// Envuelve TODAS las rutas autenticadas: si el dispositivo tiene un
// bloqueo configurado y aun no se ha desbloqueado en esta apertura de
// la app, muestra la pantalla de bloqueo en vez del contenido. Si no
// hay bloqueo configurado, la app se ve como siempre (es opcional y lo
// activa cada tecnico en su telefono).
export function BloqueoAppGuard() {
  const desbloqueada = useBloqueoAppDesbloqueado()
  // undefined mientras carga, null si no hay bloqueo, la config si lo hay.
  const config = useLiveQuery(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) ?? null, [])

  if (config === undefined) return <Cargando />
  if (config === null) return <Outlet />
  if (desbloqueada) return <Outlet />
  return <PantallaBloqueo config={config} />
}

// Con el desbloqueo del dispositivo activo (tarea 278), la pantalla tiene
// UNA accion principal, "Desbloquear", que abre el dialogo del sistema, y
// el patron o la contrasena a un toque. El dialogo nunca se abre solo: la
// pantalla aparece tras la inactividad, con nadie mirando, y Safari limita
// las llamadas sin un gesto. Si se cancela o falla, se pasa al patron o
// la contrasena con un aviso, sin volver a abrir el dialogo.
function PantallaBloqueo({ config }: { config: ConfigBloqueoApp }) {
  const metodo = config.metodo
  const { cerrarSesion } = useAuth()
  const disponible = useDesbloqueoDispositivoDisponible()
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [reinicioPatron, setReinicioPatron] = useState(0)
  const [mostrarAyuda, setMostrarAyuda] = useState(false)
  const [usarCodigo, setUsarCodigo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [esperandoDispositivo, setEsperandoDispositivo] = useState(false)
  const ceremonia = useRef<AbortController | null>(null)

  // Si la pantalla se va (se desbloqueo de otra forma), el dialogo pendiente se cancela.
  useEffect(() => () => ceremonia.current?.abort(), [])

  const conDispositivo = Boolean(config.desbloqueoDispositivo) && disponible === true
  // Mientras se averigua si el dispositivo puede (un instante), no se
  // dibuja ninguna de las dos vias: ni un boton que no funcionara ni un
  // patron que enseguida cambiaria de lugar.
  const decidiendo = Boolean(config.desbloqueoDispositivo) && disponible === null
  const vistaDispositivo = conDispositivo && !usarCodigo

  async function intentar(secreto: string) {
    setError(null)
    setAbriendo(true)
    const mensaje = await desbloquearApp(secreto)
    setAbriendo(false)
    if (mensaje) {
      setError(mensaje)
      setContrasena('')
      setReinicioPatron((n) => n + 1)
    }
    // Si es correcto, el estado observable cambia y el guard muestra la app.
  }

  async function usarDispositivo() {
    setAviso(null)
    setError(null)
    setEsperandoDispositivo(true)
    const controlador = new AbortController()
    ceremonia.current = controlador
    const resultado = await desbloquearAppConDispositivo(controlador.signal)
    if (controlador.signal.aborted) return
    ceremonia.current = null
    setEsperandoDispositivo(false)
    // Si es correcto, el guard muestra la app. Si no, el respaldo, ya.
    if (resultado !== 'ok') {
      setAviso(MENSAJE_DISPOSITIVO_NO_SE_PUDO)
      setUsarCodigo(true)
    }
  }

  async function manejarEnvioContrasena(evento: FormEvent) {
    evento.preventDefault()
    await intentar(contrasena)
  }

  // Primero se cierra la sesión y después se quita el bloqueo (tarea 284).
  // Al revés, mientras la sesión se cerraba (hasta unos segundos sin red)
  // la app ya no tenía bloqueo y se veía entera sin el código.
  async function restablecerYCerrar() {
    await cerrarSesion()
    await restablecerBloqueoApp()
  }

  const subtitulo = decidiendo
    ? ''
    : vistaDispositivo
      ? 'Desbloquea con este dispositivo'
      : metodo === 'patron'
        ? 'Dibuja tu patrón para continuar'
        : 'Ingresa tu contraseña de desbloqueo'

  return (
    <div className="nocturne flex min-h-svh flex-col items-center justify-center gap-6 bg-noct-bg px-6 font-inter text-noct-text">
      <div className="flex flex-col items-center gap-[18px] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-noct-divider bg-noct-surface text-noct-accent-300">
          <LockSimple size={28} aria-hidden />
        </div>
        <div>
          <h1 className="text-[22px] font-medium leading-tight">Soluciones IT</h1>
          {subtitulo && <p className="mt-1.5 text-[13.5px] text-noct-neutral-400">{subtitulo}</p>}
          {aviso && !vistaDispositivo && <p className="mt-2 text-[12.5px] text-noct-neutral-300">{aviso}</p>}
        </div>
      </div>

      {decidiendo ? null : vistaDispositivo ? (
        <div className="flex w-full max-w-[300px] flex-col gap-2.5">
          <Boton
            papel="principal"
            tamano={52}
            onClick={() => void usarDispositivo()}
            cargando={esperandoDispositivo}
            textoCargando="Esperando al dispositivo…"
          >
            Desbloquear
          </Boton>
          <Boton papel="texto" tono="descarte" onClick={() => setUsarCodigo(true)} disabled={esperandoDispositivo}>
            {metodo === 'patron' ? 'Usar patrón' : 'Usar contraseña'}
          </Boton>
        </div>
      ) : metodo === 'patron' ? (
        <div className="flex flex-col items-center gap-3">
          <PatronInput
            onCompletar={(secuencia) => void intentar(serializarPatron(secuencia))}
            deshabilitado={abriendo}
            reiniciarToken={reinicioPatron}
          />
          {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
        </div>
      ) : (
        <form onSubmit={manejarEnvioContrasena} className="flex w-full max-w-[300px] flex-col gap-2.5">
          <CampoContrasena
            required
            autoFocus
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="Contraseña de desbloqueo"
            className={`min-h-12 w-full rounded-md border bg-noct-surface px-3.5 py-3 text-center text-[15px] text-noct-text outline-none transition-colors placeholder:text-noct-neutral-600 focus:border-noct-accent ${error ? 'border-noct-error/55' : 'border-noct-divider'}`}
          />
          {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
          <Boton type="submit" papel="principal" tamano={52} cargando={abriendo} textoCargando="Desbloqueando…">
            Desbloquear
          </Boton>
        </form>
      )}

      {conDispositivo && usarCodigo && (
        <button
          type="button"
          onClick={() => {
            setAviso(null)
            setError(null)
            setUsarCodigo(false)
          }}
          className={claseBoton({ papel: 'texto', tono: 'descarte' })}
        >
          Usar el desbloqueo del dispositivo
        </button>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => setMostrarAyuda((v) => !v)}
          // 44 px de alto (T3): medía 19.
          className="min-h-11 px-2 text-[12.5px] text-noct-neutral-500 underline decoration-dotted underline-offset-2"
        >
          ¿Olvidaste tu código de desbloqueo?
        </button>
        {mostrarAyuda && (
          <div className="flex max-w-[300px] flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface p-3">
            <p className="text-[12.5px] leading-relaxed text-noct-neutral-400">
              Puedes cerrar sesión para quitar el bloqueo. Para volver a entrar necesitarás la
              contraseña de tu cuenta. Tu información no se pierde: se recupera al iniciar sesión de
              nuevo.
            </p>
            <button
              type="button"
              onClick={() => void restablecerYCerrar()}
              className={claseBoton({ papel: 'texto', tono: 'descarte' })}
            >
              Cerrar sesión y quitar el bloqueo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
