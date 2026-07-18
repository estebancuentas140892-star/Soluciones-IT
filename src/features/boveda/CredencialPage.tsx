import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { eliminarRegistro, registrarAccesoBoveda } from '../../lib/repositorio'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { ReferenciadoPor } from '../../components/ReferenciadoPor'
import { useGrafo } from '../../components/useGrafo'
import { resumenImpacto } from '../../lib/grafo'
import { Historial } from '../historial/Historial'
import { CampoSecreto } from './CampoSecreto'
import { IndicadorVencimiento } from './IndicadorVencimiento'
import { descifrarCredencial, type DatosCredencial } from './sesionBoveda'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export function CredencialPage() {
  const { credencialId = '' } = useParams()
  const navigate = useNavigate()

  const credencial = useLiveQuery(
    async () => (await db.credenciales.get(credencialId)) ?? null,
    [credencialId],
  )

  // Ultimo acceso (fase B3): la entrada de auditoria mas reciente de
  // esta credencial, sin contar la que se acaba de registrar por
  // abrir esta misma ficha (esa es "ahora mismo", no aporta nada
  // mostrarla como "ultimo acceso" de otra persona).
  const ultimoAcceso = useLiveQuery(
    async () => {
      const accesos = await db.accesos_boveda.where('credencialId').equals(credencialId).toArray()
      return accesos.sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))[1] ?? null
    },
    [credencialId],
  )

  // undefined: descifrando; null: no se pudo descifrar.
  const [datos, setDatos] = useState<DatosCredencial | null | undefined>(undefined)
  const [verContrasena, setVerContrasena] = useState(false)
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  // Impacto antes de eliminar (fase N1): procedimientos que muestran
  // esta credencial en alguno de sus pasos o tareas y quedarían sin ella.
  const grafo = useGrafo()
  const impacto = resumenImpacto(grafo, 'credencial', credencialId)

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

  // Auditoria de la boveda (fase B3): una entrada de "consulto" por
  // apertura de la ficha, una vez que la credencial ya cargo. El ref
  // evita registrar de nuevo si `credencial` se refresca (por ejemplo
  // al sincronizar) sin que el tecnico haya vuelto a abrir la ficha.
  const yaRegistrado = useRef<string | null>(null)
  useEffect(() => {
    if (!credencial || yaRegistrado.current === credencial.id) return
    yaRegistrado.current = credencial.id
    void registrarAccesoBoveda({
      credencialId: credencial.id,
      credencialTitulo: credencial.titulo,
      accion: 'consulto',
    })
  }, [credencial])

  if (credencial === null || credencial?.eliminadoEn) return <Navigate to="/boveda" replace />
  if (!credencial || datos === undefined) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }
  // Copia local: TypeScript no conserva el descarte de null/undefined
  // de arriba dentro de las funciones declaradas mas abajo.
  const tituloActual = credencial.titulo

  async function eliminar() {
    await registrarAccesoBoveda({ credencialId, credencialTitulo: tituloActual, accion: 'elimino' })
    await eliminarRegistro('credenciales', credencialId)
    navigate('/boveda')
  }

  function alternarVerContrasena() {
    setVerContrasena((v) => {
      const nuevoValor = !v
      if (nuevoValor) {
        void registrarAccesoBoveda({ credencialId, credencialTitulo: tituloActual, accion: 'mostro' })
      }
      return nuevoValor
    })
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <BotonVolver />

      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{credencial.titulo}</h1>
          {credencial.categoria && <p className="text-xs text-slate-500">{credencial.categoria}</p>}
          <p className="text-xs text-slate-600">
            Última modificación: {formateadorFecha.format(new Date(credencial.updatedAt))}
          </p>
          {ultimoAcceso && (
            <p className="text-xs text-slate-600">
              Último acceso: {formateadorFecha.format(new Date(ultimoAcceso.fechaHora))}
              {ultimoAcceso.usuarioNombre ? `, ${ultimoAcceso.usuarioNombre}` : ''}
            </p>
          )}
          <div className="mt-1">
            <IndicadorVencimiento venceEn={credencial.venceEn ?? null} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to={`/boveda/${credencialId}/editar`}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => setMostrarEliminar(true)}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
          >
            Eliminar
          </button>
        </div>
      </header>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar "${credencial.titulo}"?`}
        descripcion="Esta acción eliminará esta credencial de la bóveda."
        advertencia={impacto ? `${impacto} Esos pasos quedarán sin la credencial vinculada.` : null}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      {datos === null ? (
        <p className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          No se pudo descifrar esta credencial con la contraseña maestra actual. Se guardó con una
          contraseña distinta: verifica con el equipo cuál se usó, o edítala para reemplazar su
          contenido.
        </p>
      ) : (
        <dl className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
          {datos.usuario && (
            <CampoSecreto
              etiqueta="Usuario"
              valor={datos.usuario}
              onCopiado={() =>
                void registrarAccesoBoveda({ credencialId, credencialTitulo: credencial.titulo, accion: 'copio_usuario' })
              }
            />
          )}
          {datos.contrasena && (
            <CampoSecreto
              etiqueta="Contraseña"
              valor={datos.contrasena}
              oculto={!verContrasena}
              alternarOculto={alternarVerContrasena}
              onCopiado={() =>
                void registrarAccesoBoveda({ credencialId, credencialTitulo: credencial.titulo, accion: 'copio_contrasena' })
              }
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

      {/* Inverso universal: en qué procedimientos se usa esta credencial.
          Antes no había forma de saberlo desde la bóveda. */}
      <ReferenciadoPor
        tipo="credencial"
        id={credencialId}
        titulo="Usada en"
        relaciones={['credencial_paso', 'credencial_tarea']}
      />

      <Historial entidadTipo="credencial" entidadId={credencialId} />
    </div>
  )
}
