import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './authContext'
import { supabaseConfigured } from '../../lib/supabase'
import { CampoContrasena } from '../../components/CampoContrasena'
import { Campo, CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import { Marca } from '../../components/Marca'
import { Modal } from '../../components/Modal'
import { X } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'

// Login re-autorizado en la tarea 184 (mockup 3b del handoff, turno 3).
// Antes decia el nombre de la app y "Inicia sesión para continuar", y
// nada mas: ni que es esto, ni de quien es, ni que hacer si no tienes
// cuenta o si olvidaste la contraseña. Es la primera pantalla que ve un
// tecnico nuevo, y la unica que no puede preguntarle nada a la base local.
export function LoginPage() {
  const { iniciarSesion, session, cargando } = useAuth()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  if (!cargando && session) return <Navigate to="/" replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    const mensaje = await iniciarSesion(correo.trim(), contrasena)
    setEnviando(false)
    if (mensaje) setError(mensaje)
  }

  return (
    <div className="nocturne flex min-h-svh flex-col items-center justify-center gap-[26px] bg-noct-bg px-6 py-10 font-inter text-noct-text">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-noct-accent text-noct-accent">
          <Marca className="h-[26px] w-[26px]" aria-hidden />
        </span>
        <div>
          <h1 className="text-[23px] font-medium leading-[1.2]">Soluciones IT</h1>
          {/* Que es esto y de quien es. No nombra a la organización a
              proposito (decision del usuario, 2026-07-28): un rotulo con
              el nombre de la empresa envejece mal y aqui no aporta nada
              que el tecnico no sepa ya. */}
          <p className="mt-[7px] max-w-[34ch] text-[13.5px] leading-normal text-noct-neutral-200">
            La base de conocimiento del equipo de soporte y mantenimiento de TI.
          </p>
        </div>
      </div>

      {!supabaseConfigured && (
        <p className="w-full max-w-sm rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-4 py-3 text-sm text-noct-precaucion">
          La aplicación aún no está conectada al servidor. Falta configurar las variables de entorno de
          Supabase.
        </p>
      )}

      {/* El correo SI se autocompleta (`autocomplete="username"`, decision
          aprobada por el usuario el 2026-07-28): escribirlo entero cada
          vez, en un teclado de teléfono y a veces con guantes, no protege
          nada. Lo que hay que mantener fuera del gestor es la contraseña,
          y de eso se encarga CampoContrasena, que ademas usa un input de
          texto enmascarado por CSS para que el llavero del sistema no
          reconozca el formulario como un login y no ofrezca guardarlo.
          Por eso el formulario ya NO lleva autoComplete="off": puesto
          ahi anulaba tambien la pista del correo. */}
      <form onSubmit={manejarEnvio} className="flex w-full max-w-sm flex-col gap-3.5">
        <Campo etiqueta="Correo">
          <input
            type="email"
            required
            autoComplete="username"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="tu@correo.com"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </Campo>

        <div className="flex flex-col gap-1.5">
          {/* No usa <Campo> porque la etiqueta comparte fila con el
              enlace de ayuda, pero SI su misma clase de rotulo: el campo
              de arriba y este tienen que verse igual (fuente unica de
              campos.tsx, Fase 0 de la revision arquitectonica). */}
          <div className="flex items-baseline justify-between gap-2">
            {/* `htmlFor` en vez de envolver el campo: el enlace de ayuda
                comparte la fila y un <button> dentro de un <label> no es
                valido (tocar el rotulo activaria el control anidado). */}
            <label htmlFor="login-contrasena" className={CLASE_ETIQUETA}>
              Contraseña
            </label>
            {/* El relleno vertical con margen negativo le da 44px reales
                de zona tactil (regla R6) sin engordar la fila del rotulo
                ni mover la linea base del texto: el mockup lo dibuja como
                un enlace de 18px, que es la mitad del minimo. */}
            <button
              type="button"
              onClick={() => setAyudaAbierta(true)}
              className="-my-[13px] shrink-0 py-[13px] text-[12px] font-medium text-noct-accent-300 underline underline-offset-[3px]"
            >
              ¿La olvidaste?
            </button>
          </div>
          <CampoContrasena
            id="login-contrasena"
            required
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-noct-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !supabaseConfigured}
          className={`${BTN_PRIMARIO} mt-1 min-h-[52px] justify-center text-[15px] disabled:opacity-50`}
        >
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="text-center text-[12px] leading-normal text-noct-neutral-400">
          ¿Sin cuenta? Pídesela al administrador de la app. Todo queda guardado en este teléfono, así
          que funciona sin señal.
        </p>
      </form>

      {/* "¿La olvidaste?" no manda un correo de recuperación: no existe
          ese flujo (decision del usuario, 2026-07-28). La contraseña
          inicial la asigna el administrador en el panel de Supabase, y
          restablecerla es el mismo camino. Este panel lo dice en vez de
          dejar el enlace prometiendo algo que la app no hace. */}
      <Modal
        abierto={ayudaAbierta}
        onCerrar={() => setAyudaAbierta(false)}
        tituloId="titulo-olvide-contrasena"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-olvide-contrasena" className="text-[17px] font-medium leading-[1.3]">
            Olvidé mi contraseña
          </h2>
          <button
            type="button"
            onClick={() => setAyudaAbierta(false)}
            aria-label="Cerrar"
            className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-noct-neutral-200">
          La app no envía correos de recuperación. Pídele al administrador que te asigne una nueva
          desde el panel de Supabase, igual que hizo con la primera.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-noct-neutral-400">
          Cuando entres, cámbiala por una tuya en Mi cuenta. Si lo que no recuerdas es el bloqueo de
          este teléfono (el patrón o la clave que pide la app al abrirla), eso se resuelve desde la
          propia pantalla de bloqueo.
        </p>
        <button
          type="button"
          onClick={() => setAyudaAbierta(false)}
          className={`${BTN_SECUNDARIO} mt-4 min-h-11 w-full justify-center`}
        >
          Entendido
        </button>
      </Modal>
    </div>
  )
}
