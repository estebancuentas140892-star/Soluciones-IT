import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { useAuth } from '../autenticacion/authContext'
import { CampoSecreto } from './CampoSecreto'
import { desbloquear, descifrarCredencial, type DatosCredencial } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

interface Props {
  credencialId: string
  // Copia del titulo guardada en el paso: unica referencia visible
  // cuando la credencial no esta en este dispositivo (sin permiso de
  // boveda o sin sincronizar todavia).
  tituloReferencia: string
}

// Apartado "Datos" de un paso de procedimiento: la credencial de la
// boveda vinculada al paso. Se muestra contraido y sin secretos; solo
// al tocarlo se consulta la boveda, con las mismas protecciones que
// en su propia seccion (permiso puedeVerBoveda del perfil, contrasena
// maestra y autobloqueo). El secreto nunca vive en el articulo y
// quien no este autorizado solo ve el titulo de referencia.
export function CredencialEnPaso({ credencialId, tituloReferencia }: Props) {
  const { session } = useAuth()
  const desbloqueada = useBovedaDesbloqueada()
  // Contraido por defecto: los secretos no entran a la pantalla hasta
  // que el tecnico los pide, aunque la boveda ya este desbloqueada.
  const [abierto, setAbierto] = useState(false)

  const perfil = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )
  const credencial = useLiveQuery(
    async () => (await db.credenciales.get(credencialId)) ?? null,
    [credencialId],
  )

  if (perfil === undefined || credencial === undefined) return null

  const autorizado = Boolean(perfil?.puedeVerBoveda)
  const eliminada = Boolean(credencial?.eliminadoEn)
  const titulo = (credencial && !eliminada ? credencial.titulo : '') || tituloReferencia

  return (
    <div className="rounded-lg border border-violet-900/60 bg-violet-950/30 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <p className="min-w-0 truncate text-xs font-medium text-violet-200">
          Datos{titulo ? `: ${titulo}` : ''}
        </p>
        <span className="shrink-0 text-xs text-violet-300 underline underline-offset-2">
          {abierto ? 'Ocultar' : 'Ver'}
        </span>
      </button>

      {abierto &&
        (!autorizado || credencial === null ? (
          <p className="mt-2 text-xs text-violet-300/80">
            Solo los usuarios autorizados pueden consultar los datos de este paso.
          </p>
        ) : eliminada ? (
          <p className="mt-2 text-xs text-amber-300">
            Los datos vinculados fueron eliminados de la bóveda. Edita el artículo para quitar el
            vínculo o vincular otros.
          </p>
        ) : !desbloqueada ? (
          <FormularioDesbloqueo />
        ) : (
          <>
            <DatosDescifrados datosCifrados={credencial.datosCifrados} />
            <div className="mt-2.5">
              <Link
                to={`/notas/${credencialId}`}
                className="text-xs text-violet-300 underline underline-offset-2"
              >
                Abrir en Notas
              </Link>
            </div>
          </>
        ))}
    </div>
  )
}

// Desbloqueo en linea, sin salir del procedimiento. Usa la misma
// sesion global de la boveda: desbloquear aqui desbloquea tambien la
// seccion Boveda (y el autobloqueo por inactividad aplica igual).
// Solo se muestra a usuarios con permiso y con la credencial ya
// sincronizada, asi que la boveda nunca esta vacia en este punto.
function FormularioDesbloqueo() {
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setAbriendo(true)
    const resultado = await desbloquear(contrasena)
    setAbriendo(false)
    if (resultado) setError(resultado)
  }

  return (
    <form onSubmit={manejarEnvio} className="mt-2 flex flex-col gap-2">
      <p className="text-xs text-violet-300/80">
        Los datos están cifrados. Ingresa la contraseña maestra para verlos aquí.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Contraseña maestra"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={abriendo}
          className="shrink-0 rounded-lg bg-violet-500 px-3 py-2 text-xs font-medium text-slate-950 disabled:opacity-50"
        >
          {abriendo ? 'Abriendo...' : 'Desbloquear'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}

function DatosDescifrados({ datosCifrados }: { datosCifrados: string }) {
  // undefined: descifrando; null: no se pudo descifrar.
  const [datos, setDatos] = useState<DatosCredencial | null | undefined>(undefined)
  const [verContrasena, setVerContrasena] = useState(false)

  useEffect(() => {
    let vigente = true
    setDatos(undefined)
    void descifrarCredencial(datosCifrados).then((resultado) => {
      if (vigente) setDatos(resultado)
    })
    return () => {
      vigente = false
    }
  }, [datosCifrados])

  if (datos === undefined) {
    return <p className="mt-1 text-xs text-slate-400">Descifrando...</p>
  }
  if (datos === null) {
    return (
      <p className="mt-1 text-xs text-amber-300">
        No se pudo descifrar esta credencial con la contraseña maestra actual. Ábrela en la sección
        Notas para ver los detalles.
      </p>
    )
  }

  const sinCampos =
    !datos.usuario &&
    !datos.contrasena &&
    !datos.ip &&
    !datos.url &&
    Object.keys(datos.extras).length === 0

  return (
    <div className="mt-2 flex flex-col gap-2.5">
      {!sinCampos && (
        <dl className="flex flex-col gap-2.5">
          {datos.usuario && <CampoSecreto etiqueta="Usuario" valor={datos.usuario} />}
          {datos.contrasena && (
            <CampoSecreto
              etiqueta="Contraseña"
              valor={datos.contrasena}
              oculto={!verContrasena}
              alternarOculto={() => setVerContrasena((v) => !v)}
            />
          )}
          {datos.ip && <CampoSecreto etiqueta="Dirección IP" valor={datos.ip} />}
          {datos.url && <CampoSecreto etiqueta="URL" valor={datos.url} />}
          {Object.entries(datos.extras).map(([clave, valor]) => (
            <CampoSecreto key={clave} etiqueta={clave} valor={valor} />
          ))}
        </dl>
      )}
      {datos.notas && <p className="whitespace-pre-wrap text-xs text-slate-400">{datos.notas}</p>}
      {sinCampos && !datos.notas && (
        <p className="text-xs text-slate-500">Esta credencial no tiene datos guardados.</p>
      )}
    </div>
  )
}
