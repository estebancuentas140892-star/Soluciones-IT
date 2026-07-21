import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { registrarAccesoBoveda } from '../../lib/repositorio'
import { CampoContrasena } from '../../components/CampoContrasena'
import { CaretDown, CaretUp, Key, LockSimple } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { CampoSecreto } from './CampoSecreto'
import { IndicadorVencimiento } from './IndicadorVencimiento'
import { desbloquear, descifrarCredencial, type DatosCredencial } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

interface Props {
  credencialId: string
  // Copia del titulo guardada en el paso: unica referencia visible
  // cuando la credencial no esta en este dispositivo (sin permiso de
  // boveda o sin sincronizar todavia).
  tituloReferencia: string
}

// Bloque protegido de un paso de procedimiento: la credencial de la
// boveda vinculada al paso, con el patron Nocturne de "lo protegido se
// diferencia de lo publico" (borde discontinuo, candado y kicker
// "Datos protegidos"). Se muestra contraido y sin secretos; solo al
// tocarlo se consulta la boveda, con las mismas protecciones que en su
// propia seccion (permiso puedeVerBoveda del perfil, contrasena
// maestra y autobloqueo). El secreto nunca vive en el articulo y quien
// no este autorizado solo ve el titulo de referencia.
export function CredencialEnPaso({ credencialId, tituloReferencia }: Props) {
  const desbloqueada = useBovedaDesbloqueada()
  // Contraido por defecto: los secretos no entran a la pantalla hasta
  // que el tecnico los pide, aunque la boveda ya este desbloqueada.
  const [abierto, setAbierto] = useState(false)

  const perfil = usePerfilVivo()
  const credencial = useLiveQuery(
    async () => (await db.credenciales.get(credencialId)) ?? null,
    [credencialId],
  )

  if (perfil === undefined || credencial === undefined) return null

  const autorizado = Boolean(perfil?.puedeVerBoveda)
  const eliminada = Boolean(credencial?.eliminadoEn)
  const titulo = (credencial && !eliminada ? credencial.titulo : '') || tituloReferencia

  return (
    <div className="rounded-lg border border-dashed border-noct-neutral-700 bg-noct-surface/55">
      <button
        type="button"
        onClick={() => {
          setAbierto((v) => {
            const nuevoValor = !v
            if (nuevoValor && autorizado && credencial && !eliminada) {
              void registrarAccesoBoveda({ credencialId, credencialTitulo: titulo, accion: 'consulto' })
            }
            return nuevoValor
          })
        }}
        aria-expanded={abierto}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-[11px] text-left"
      >
        <LockSimple size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
            Datos protegidos
          </span>
          <span className="block truncate text-[13.5px] font-medium">{titulo || 'Secreto'}</span>
        </span>
        {credencial && !eliminada && <IndicadorVencimiento venceEn={credencial.venceEn ?? null} />}
        {abierto ? (
          <CaretUp size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        ) : (
          <CaretDown size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        )}
      </button>

      {abierto && (
        <div className="flex flex-col gap-2.5 border-t border-noct-divider p-3">
          {!autorizado || credencial === null ? (
            <p className="text-[13px] leading-normal text-noct-neutral-400">
              Solo los usuarios autorizados pueden consultar los datos de este paso.
            </p>
          ) : eliminada ? (
            <p className="text-[13px] leading-normal text-noct-precaucion">
              Los datos vinculados fueron eliminados de la bóveda. Edita el artículo para quitar el
              vínculo o vincular otros.
            </p>
          ) : !desbloqueada ? (
            <FormularioDesbloqueo />
          ) : (
            <>
              <DatosDescifrados
                datosCifrados={credencial.datosCifrados}
                credencialId={credencialId}
                credencialTitulo={titulo}
              />
              <Link
                to={`/boveda/${credencialId}`}
                className="mt-0.5 text-[12.5px] font-medium text-noct-accent"
              >
                Ver ficha completa en Bóveda →
              </Link>
            </>
          )}
        </div>
      )}
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
    <form onSubmit={manejarEnvio} className="flex flex-col gap-2.5">
      <p className="text-[13px] leading-normal text-noct-neutral-400">
        La bóveda está bloqueada. Los datos no entran a la pantalla hasta desbloquearla con la
        contraseña maestra.
      </p>
      <div className="flex gap-2">
        <CampoContrasena
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Contraseña maestra"
          className="min-w-0 flex-1 rounded-lg border border-noct-divider bg-noct-bg px-3 py-2 text-sm text-noct-text caret-noct-accent placeholder:text-noct-neutral-600"
        />
        <button type="submit" disabled={abriendo} className={`shrink-0 ${BTN_PRIMARIO} disabled:opacity-45`}>
          <Key size={14} aria-hidden />
          {abriendo ? 'Abriendo...' : 'Desbloquear'}
        </button>
      </div>
      {error && <p className="text-xs text-noct-error">{error}</p>}
    </form>
  )
}

function DatosDescifrados({
  datosCifrados,
  credencialId,
  credencialTitulo,
}: {
  datosCifrados: string
  credencialId: string
  credencialTitulo: string
}) {
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
    return <p className="text-xs text-noct-neutral-400">Descifrando...</p>
  }
  if (datos === null) {
    return (
      <p className="text-[13px] leading-normal text-noct-precaucion">
        No se pudo descifrar este secreto con la contraseña maestra actual. Ábrelo en la sección
        Bóveda para ver los detalles.
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
    <div className="flex flex-col gap-2">
      {!sinCampos && (
        <dl className="flex flex-col gap-2">
          {datos.usuario && (
            <CampoSecreto
              etiqueta="Usuario"
              valor={datos.usuario}
              onCopiado={() => void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'copio_usuario' })}
            />
          )}
          {datos.contrasena && (
            <CampoSecreto
              etiqueta="Contraseña"
              valor={datos.contrasena}
              oculto={!verContrasena}
              alternarOculto={() =>
                setVerContrasena((v) => {
                  const nuevoValor = !v
                  if (nuevoValor) void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'mostro' })
                  return nuevoValor
                })
              }
              onCopiado={() =>
                void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'copio_contrasena' })
              }
            />
          )}
          {datos.ip && <CampoSecreto etiqueta="Dirección IP" valor={datos.ip} />}
          {datos.url && <CampoSecreto etiqueta="URL" valor={datos.url} />}
          {Object.entries(datos.extras).map(([clave, valor]) => (
            <CampoSecreto key={clave} etiqueta={clave} valor={valor} />
          ))}
        </dl>
      )}
      {datos.notas && (
        <p className="whitespace-pre-wrap text-xs leading-normal text-noct-neutral-400">{datos.notas}</p>
      )}
      {sinCampos && !datos.notas && (
        <p className="text-xs text-noct-neutral-500">Este secreto no tiene datos guardados.</p>
      )}
    </div>
  )
}
