import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { db, ID_VERIFICADOR } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { CampoContrasena } from '../../components/CampoContrasena'
import { LockSimple } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_PRIMARIO_DOMINANTE } from '../../components/nocturne'
import { avisar } from '../../components/avisosFlotantes'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import {
  desbloquear,
  estadoInicialBoveda,
  obtenerMinutosAutobloqueo,
  type EstadoInicialBoveda,
} from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

// Envuelve todas las rutas de la bóveda: exige el permiso
// puedeVerBoveda del perfil y que la bóveda esté desbloqueada. Es la
// pantalla "bloqueada" del handoff Bóveda.dc.html (tarea 97):
// re-autorizada al sistema Nocturne, declara nivel de sección en el
// chasis (pestañas/sidebar visibles como en el mockup) mientras la lista
// y la ficha van tras el Outlet. La lógica de seguridad (verificar/crear/
// sin-confirmar contra el servidor) no cambia: solo el aspecto.
export function BovedaGuard() {
  const desbloqueada = useBovedaDesbloqueada()
  const perfil = usePerfilVivo()

  if (perfil === undefined) {
    return (
      <PantallaBoveda descripcion="Sección protegida del equipo. La contraseña maestra descifra el contenido en este teléfono; nunca sale de aquí.">
        <p className="text-[13px] text-noct-neutral-400">Comprobando acceso...</p>
      </PantallaBoveda>
    )
  }
  if (!perfil?.puedeVerBoveda) return <AccesoRestringido />
  if (!desbloqueada) return <PantallaDesbloqueo />
  return <Outlet />
}

// Envoltorio común de las pantallas de bloqueo: columna centrada con el
// candado y una descripción, en el nivel de sección del chasis (tarea
// 185), así que las pestañas siguen visibles, como en el mockup. El
// nombre de la sección lo pone la barra superior (R14): antes se
// repetía aquí dentro como un h1 propio.
// EN EL TELÉFONO, LA PUERTA DE LA BÓVEDA DEL PROTOTIPO DE CLAUDE DESIGN (tarea
// 350, sin cambios de seguridad): el candado en su recuadro invertido, el color
// de la Bóveda, con su relieve; el título «La Bóveda está bloqueada» cuando
// hay que desbloquearla; lo que protege, a 16; y el campo y «Desbloquear»
// anchos. El desbloqueo, los permisos, el autobloqueo y el registro no
// cambian. Desde 768, como siempre.
function PantallaBoveda({
  descripcion,
  titulo,
  children,
}: {
  descripcion: string
  /** El título de la puerta, solo en el teléfono («La Bóveda está bloqueada»). */
  titulo?: string
  children: ReactNode
}) {
  return (
    <Chasis titulo="Bóveda">
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] px-6 py-8 text-center max-md:gap-3.5 max-md:px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-noct-divider bg-noct-surface text-noct-accent-300 max-md:h-[76px] max-md:w-[76px] max-md:rounded-[24px] max-md:border-0 max-md:bg-noct-boveda max-md:text-noct-on-boveda max-md:shadow-[0_4px_0_var(--color-noct-boveda-borde)]">
          <LockSimple size={28} className="max-md:h-[34px] max-md:w-[34px]" aria-hidden />
        </div>
        {titulo && <h2 className="hidden text-[22px] font-extrabold leading-snug max-md:block">{titulo}</h2>}
        <p className="mx-auto max-w-[300px] text-[13.5px] leading-relaxed text-noct-neutral-400 max-md:text-[16px] max-md:leading-[23px] max-md:text-noct-neutral-300">
          {descripcion}
        </p>
        {children}
      </div>
    </Chasis>
  )
}

// Sin revelar qué es lo que se protege: quien llega aquí sin permiso
// solo ve una sección restringida genérica (mínima exposición).
function AccesoRestringido() {
  return (
    <PantallaBoveda descripcion="Tu usuario no tiene acceso a esta sección. Un administrador puede habilitarlo desde el panel de Supabase.">
      {null}
    </PantallaBoveda>
  )
}

const CAMPO_PASS =
  'min-h-12 w-full rounded-md border bg-noct-surface px-3.5 py-3 text-center text-[15px] text-noct-text outline-none transition-colors placeholder:text-noct-neutral-600 focus:border-noct-accent max-md:h-[52px] max-md:rounded-[14px] max-md:border-2 max-md:text-left max-md:text-[17px]'
// «Desbloquear» en el teléfono (tarea 350): el color de la Bóveda, invertido,
// a 56 de alto con su relieve, como el prototipo. Desde 768, el de siempre.
const DESBLOQUEAR_TELEFONO =
  'max-md:min-h-14 max-md:rounded-2xl max-md:bg-noct-boveda max-md:text-[17px] max-md:font-extrabold max-md:text-noct-on-boveda max-md:shadow-[0_4px_0_var(--color-noct-boveda-borde)] max-md:active:bg-noct-boveda'

function PantallaDesbloqueo() {
  // El formulario depende del estado CONFIRMADO de la contraseña
  // maestra, nunca del conteo local de credenciales: definir una
  // contraseña nueva solo se ofrece cuando el servidor confirma que
  // no existe ninguna (ver estadoInicialBoveda). Así, borrar la cache
  // o estrenar un teléfono jamás reabre el flujo de "primera vez".
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

  // Si la sincronización trae el verificador mientras la pantalla
  // espera, se pasa solo al modo de verificación.
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
    // Lo de debajo no se desmonta; el aviso dice que ya está (tarea 341).
    else avisar('Bóveda desbloqueada', 'candado')
  }

  const descripcion =
    modo === 'crear'
      ? 'Sección protegida del equipo. Aún no tiene contraseña maestra.'
      : 'Sección protegida del equipo. La contraseña maestra descifra el contenido en este teléfono; nunca sale de aquí.'

  return (
    <PantallaBoveda descripcion={descripcion} titulo={modo === 'verificar' ? 'La Bóveda está bloqueada' : undefined}>
      {modo === 'cargando' && <p className="text-[13px] text-noct-neutral-400">Comprobando...</p>}

      {modo === 'sin-confirmar' && (
        <div className="flex w-full max-w-[300px] flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-noct-neutral-400">
            No se pudo comprobar la configuración de esta sección. Conéctate a internet, espera a que
            la aplicación sincronice y vuelve a intentar.
          </p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className={`${BTN_PRIMARIO} min-h-12 justify-center`}
          >
            Reintentar
          </button>
        </div>
      )}

      {(modo === 'verificar' || modo === 'crear') && (
        <form onSubmit={manejarEnvio} className="flex w-full max-w-[300px] flex-col gap-2.5 max-md:mt-1.5 max-md:max-w-[340px]">
          {/* EL RÓTULO A LA VISTA, EN EL TELÉFONO (tarea 351, como el
              prototipo): el campo dice qué pide aunque ya tenga algo escrito.
              Desde 768, el marcador de siempre. */}
          <label htmlFor="boveda-contrasena" className="hidden text-left text-[14.5px] font-extrabold max-md:block">
            Contraseña maestra
          </label>
          <CampoContrasena
            id="boveda-contrasena"
            required
            autoFocus
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value)
              setError(null)
            }}
            placeholder="Contraseña maestra"
            className={`${CAMPO_PASS} ${error ? 'border-noct-error/55' : 'border-noct-divider max-md:border-noct-divider-fuerte'}`}
          />

          {modo === 'crear' && (
            <>
              <CampoContrasena
                required
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="Confirma la contraseña"
                className={`${CAMPO_PASS} ${error ? 'border-noct-error/55' : 'border-noct-divider'}`}
              />
              <p className="text-[11.5px] max-md:text-[12px] leading-relaxed text-noct-neutral-600">
                Esta contraseña quedará registrada como la contraseña maestra del equipo, asociada a
                la cuenta y válida en todos los dispositivos: acuérdenla entre todos y guárdenla bien,
                sin ella no se puede recuperar el contenido.
              </p>
            </>
          )}

          {error && <p className="text-[12.5px] text-noct-error">{error}</p>}

          <button
            type="submit"
            disabled={abriendo}
            className={`${BTN_PRIMARIO_DOMINANTE} min-h-12 justify-center disabled:opacity-50 ${DESBLOQUEAR_TELEFONO}`}
          >
            {abriendo ? 'Desbloqueando...' : 'Desbloquear'}
          </button>

          {modo === 'verificar' && (
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-noct-neutral-600 max-md:text-[14px] max-md:font-semibold max-md:text-noct-neutral-300">
              Se vuelve a bloquear sola tras {obtenerMinutosAutobloqueo()} minutos sin actividad.
            </p>
          )}
        </form>
      )}
    </PantallaBoveda>
  )
}
