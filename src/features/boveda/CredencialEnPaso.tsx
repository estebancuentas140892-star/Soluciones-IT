import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db, type CampoProtegido, type VinculoProtegido } from '../../lib/db'
import { registrarAccesoBoveda } from '../../lib/repositorio'
import { CampoContrasena } from '../../components/CampoContrasena'
import { CaretDown, CaretUp, Key, LockSimple } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { esOcultoPorDefecto, etiquetaTipo } from '../dispositivos/camposProtegidos'
import { CampoSecreto } from './CampoSecreto'
import { IndicadorVencimiento } from './IndicadorVencimiento'
import { desbloquear, descifrarCredencial, descifrarValor, type DatosCredencial } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

interface Props {
  // Vinculo protegido de un paso o una tarea (grupo P2): un secreto
  // independiente de la boveda o un campo protegido de un dispositivo.
  // Reemplaza a las props sueltas `credencialId`/`tituloReferencia`
  // (unico vinculo que existia antes de P2).
  vinculo: VinculoProtegido
}

// Bloque protegido de un paso de procedimiento: la informacion
// protegida vinculada al paso, con el patron Nocturne de "lo protegido
// se diferencia de lo publico" (borde discontinuo, candado y kicker
// "Datos protegidos"). Se muestra contraido y sin secretos; solo al
// tocarlo se consulta la boveda, con las mismas protecciones que en su
// propia seccion (permiso puedeVerBoveda del perfil, contrasena
// maestra y autobloqueo). El secreto nunca vive en el articulo y quien
// no este autorizado solo ve el titulo de referencia.
export function CredencialEnPaso({ vinculo }: Props) {
  const desbloqueada = useBovedaDesbloqueada()
  // Contraido por defecto: los secretos no entran a la pantalla hasta
  // que el tecnico los pide, aunque la boveda ya este desbloqueada.
  const [abierto, setAbierto] = useState(false)

  const perfil = usePerfilVivo()
  const credencial = useLiveQuery(
    async () => (vinculo.tipo === 'credencial' ? ((await db.credenciales.get(vinculo.id)) ?? null) : null),
    [vinculo.tipo, vinculo.id],
  )
  const campo = useLiveQuery(
    async () => (vinculo.tipo === 'campo' ? ((await db.campos_protegidos.get(vinculo.id)) ?? null) : null),
    [vinculo.tipo, vinculo.id],
  )

  const cargando = vinculo.tipo === 'credencial' ? credencial === undefined : campo === undefined
  if (perfil === undefined || cargando) return null

  const autorizado = Boolean(perfil?.puedeVerBoveda)
  const existe = (vinculo.tipo === 'credencial' ? credencial : campo) !== null
  const eliminada = vinculo.tipo === 'credencial' ? Boolean(credencial?.eliminadoEn) : Boolean(campo?.eliminadoEn)
  const tituloVivo =
    existe && !eliminada ? (vinculo.tipo === 'credencial' ? (credencial?.titulo ?? '') : (campo?.nombre ?? '')) : ''
  const titulo = tituloVivo || vinculo.titulo
  const entidadTipo = vinculo.tipo === 'campo' ? 'campo_protegido' : 'credencial'

  return (
    <div className="rounded-lg border border-dashed border-noct-neutral-700 bg-noct-surface/55">
      <button
        type="button"
        onClick={() => {
          // El registro va FUERA del actualizador de estado: React
          // puede invocarlo dos veces (modo estricto) y se registraria
          // el consulto por duplicado.
          if (!abierto && autorizado && existe && !eliminada) {
            void registrarAccesoBoveda({ entidadTipo, credencialId: vinculo.id, credencialTitulo: titulo, accion: 'consulto' })
          }
          setAbierto((v) => !v)
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
        {vinculo.tipo === 'credencial' && credencial && !eliminada && (
          <IndicadorVencimiento venceEn={credencial.venceEn ?? null} />
        )}
        {abierto ? (
          <CaretUp size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        ) : (
          <CaretDown size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        )}
      </button>

      {abierto && (
        <div className="flex flex-col gap-2.5 border-t border-noct-divider p-3">
          {!autorizado || !existe ? (
            <p className="text-[13px] leading-normal text-noct-neutral-400">
              Solo los usuarios autorizados pueden consultar los datos de este paso.
            </p>
          ) : eliminada ? (
            <p className="text-[13px] leading-normal text-noct-precaucion">
              Los datos vinculados fueron eliminados. Edita el artículo para quitar el vínculo o
              vincular otros.
            </p>
          ) : !desbloqueada ? (
            <FormularioDesbloqueo />
          ) : vinculo.tipo === 'credencial' && credencial ? (
            <>
              <DatosDescifrados datosCifrados={credencial.datosCifrados} credencialId={vinculo.id} credencialTitulo={titulo} />
              <Link to={`/boveda/${vinculo.id}`} className="mt-0.5 text-[12.5px] font-medium text-noct-accent">
                Ver ficha completa en Bóveda →
              </Link>
            </>
          ) : campo ? (
            <>
              <ValorCampoDescifrado campo={campo} titulo={titulo} />
              {campo.dispositivoId && (
                <Link
                  to={`/dispositivos/${campo.dispositivoId}`}
                  className="mt-0.5 text-[12.5px] font-medium text-noct-accent"
                >
                  Ver ficha del equipo →
                </Link>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// Desbloqueo en linea, sin salir del procedimiento. Usa la misma
// sesion global de la boveda: desbloquear aqui desbloquea tambien la
// seccion Boveda (y el autobloqueo por inactividad aplica igual).
// Solo se muestra a usuarios con permiso y con la fila ya sincronizada,
// asi que nunca queda vacia en este punto.
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
        <p className="text-xs text-noct-neutral-500">Esta credencial no tiene datos guardados.</p>
      )}
    </div>
  )
}

// Equivalente de DatosDescifrados para un campo protegido de un
// dispositivo (grupo P2): un solo valor, no un conjunto de campos, asi
// que reutiliza CampoSecreto directo en vez del <dl> con varias filas.
function ValorCampoDescifrado({ campo, titulo }: { campo: CampoProtegido; titulo: string }) {
  // undefined: descifrando; null: no se pudo descifrar.
  const [valor, setValor] = useState<string | null | undefined>(undefined)
  const [revelado, setRevelado] = useState(false)

  useEffect(() => {
    let vigente = true
    setValor(undefined)
    void descifrarValor(campo.valorCifrado).then((resultado) => {
      if (vigente) setValor(resultado)
    })
    return () => {
      vigente = false
    }
  }, [campo.valorCifrado])

  if (valor === undefined) return <p className="text-xs text-noct-neutral-400">Descifrando...</p>
  if (valor === null) {
    return (
      <p className="text-[13px] leading-normal text-noct-precaucion">
        No se pudo descifrar con la contraseña maestra actual. Ábrelo en la ficha del equipo para
        ver los detalles.
      </p>
    )
  }
  if (valor === '') {
    return <p className="text-xs text-noct-neutral-500">Este dato está vacío.</p>
  }

  const oculto = esOcultoPorDefecto(campo.tipo)

  return (
    <dl className="m-0">
      <CampoSecreto
        etiqueta={etiquetaTipo(campo.tipo)}
        valor={valor}
        oculto={oculto && !revelado}
        alternarOculto={
          oculto
            ? () => {
                if (!revelado) {
                  void registrarAccesoBoveda({
                    entidadTipo: 'campo_protegido',
                    credencialId: campo.id,
                    credencialTitulo: titulo,
                    accion: 'mostro',
                  })
                }
                setRevelado((v) => !v)
              }
            : undefined
        }
        onCopiado={() =>
          void registrarAccesoBoveda({
            entidadTipo: 'campo_protegido',
            credencialId: campo.id,
            credencialTitulo: titulo,
            accion: campo.tipo === 'usuario' ? 'copio_usuario' : 'copio_contrasena',
          })
        }
      />
    </dl>
  )
}
