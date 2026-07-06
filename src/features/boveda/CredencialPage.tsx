import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'
import { CampoSecreto } from './CampoSecreto'
import { descifrarCredencial, type DatosCredencial } from './sesionBoveda'

export function CredencialPage() {
  const { credencialId = '' } = useParams()
  const navigate = useNavigate()

  const credencial = useLiveQuery(
    async () => (await db.credenciales.get(credencialId)) ?? null,
    [credencialId],
  )

  // undefined: descifrando; null: no se pudo descifrar.
  const [datos, setDatos] = useState<DatosCredencial | null | undefined>(undefined)
  const [verContrasena, setVerContrasena] = useState(false)

  useEffect(() => {
    if (!credencial) return
    let vigente = true
    void descifrarCredencial(credencial.datosCifrados).then((resultado) => {
      if (vigente) setDatos(resultado)
    })
    return () => {
      vigente = false
    }
  }, [credencial])

  if (credencial === null || credencial?.eliminadoEn) return <Navigate to="/notas" replace />
  if (!credencial || datos === undefined) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar "${credencial!.titulo}"?`)) return
    await eliminarRegistro('credenciales', credencialId)
    navigate('/notas')
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <Link to="/notas" className="text-xs text-slate-400">
            ← Notas
          </Link>
          <h1 className="text-xl font-semibold">{credencial.titulo}</h1>
          {credencial.categoria && <p className="text-xs text-slate-500">{credencial.categoria}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to={`/notas/${credencialId}/editar`}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => void eliminar()}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
          >
            Eliminar
          </button>
        </div>
      </header>

      {datos === null ? (
        <p className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          No se pudo descifrar esta credencial con la contraseña maestra actual. Se guardó con una
          contraseña distinta: verifica con el equipo cuál se usó, o edítala para reemplazar su
          contenido.
        </p>
      ) : (
        <dl className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
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
          {!datos.usuario &&
            !datos.contrasena &&
            !datos.ip &&
            !datos.url &&
            Object.keys(datos.extras).length === 0 && (
              <p className="text-sm text-slate-500">Esta credencial no tiene datos guardados.</p>
            )}
        </dl>
      )}

      {datos?.notas && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Notas</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{datos.notas}</p>
        </div>
      )}

      <Historial entidadTipo="credencial" entidadId={credencialId} />
    </div>
  )
}
