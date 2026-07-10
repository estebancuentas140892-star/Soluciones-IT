import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { CampoContrasena } from '../../components/CampoContrasena'
import { Seccion } from '../../components/Seccion'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId, registrarAccesoBoveda } from '../../lib/repositorio'
import { cifrarCredencial, descifrarCredencial } from './sesionBoveda'

interface CampoExtra {
  clave: string
  valor: string
}

export function CredencialForm() {
  const { credencialId } = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(credencialId)

  const credencial = useLiveQuery(
    async () => (credencialId ? ((await db.credenciales.get(credencialId)) ?? null) : undefined),
    [credencialId],
  )
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useMemo(
    () => [...new Set((credenciales ?? []).map((c) => c.categoria).filter(Boolean))].sort(),
    [credenciales],
  )

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [ip, setIp] = useState('')
  const [url, setUrl] = useState('')
  const [notas, setNotas] = useState('')
  const [extras, setExtras] = useState<CampoExtra[]>([])
  // Fecha de vencimiento (fase B2), "YYYY-MM-DD" o ''. A diferencia
  // del resto del formulario NO viaja cifrada: se carga directo del
  // registro, sin esperar el descifrado.
  const [venceEn, setVenceEn] = useState('')
  const [motivo, setMotivo] = useState('')
  const [sinDescifrar, setSinDescifrar] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!credencial || cargadoInicial) return
    let vigente = true
    setTitulo(credencial.titulo)
    setCategoria(credencial.categoria)
    setVenceEn(credencial.venceEn ?? '')
    void descifrarCredencial(credencial.datosCifrados).then((datos) => {
      if (!vigente) return
      if (datos) {
        setUsuario(datos.usuario)
        setContrasena(datos.contrasena)
        setIp(datos.ip)
        setUrl(datos.url)
        setNotas(datos.notas)
        setExtras(Object.entries(datos.extras).map(([clave, valor]) => ({ clave, valor })))
      } else {
        setSinDescifrar(true)
      }
      setCargadoInicial(true)
    })
    return () => {
      vigente = false
    }
  }, [credencial, cargadoInicial])

  if (esEdicion && credencial === null) return <Navigate to="/boveda" replace />
  if (esEdicion && !cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  function actualizarExtra(indice: number, campo: keyof CampoExtra, valor: string) {
    setExtras((actuales) => actuales.map((e, i) => (i === indice ? { ...e, [campo]: valor } : e)))
  }

  function quitarExtra(indice: number) {
    setExtras((actuales) => actuales.filter((_, i) => i !== indice))
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)

    try {
      const id = credencialId ?? nuevoId()
      const datosCifrados = await cifrarCredencial({
        usuario: usuario.trim(),
        contrasena,
        ip: ip.trim(),
        url: url.trim(),
        notas: notas.trim(),
        extras: Object.fromEntries(
          extras.filter((e) => e.clave.trim()).map((e) => [e.clave.trim(), e.valor.trim()]),
        ),
      })

      const tituloFinal = titulo.trim()
      await guardarRegistro(
        'credenciales',
        {
          id,
          titulo: tituloFinal,
          categoria: categoria.trim(),
          datosCifrados,
          venceEn: venceEn.trim() === '' ? null : venceEn.trim(),
        },
        motivo.trim(),
      )
      // Auditoria de la boveda (fase B3): solo al editar una credencial
      // existente; la creacion ya queda registrada en el historial.
      if (esEdicion) {
        await registrarAccesoBoveda({ credencialId: id, credencialTitulo: tituloFinal, accion: 'modifico' })
      }
      navigate(`/boveda/${id}`)
    } catch {
      // Ocurre si el autobloqueo cerro la boveda durante la edicion.
      setError('La sección se bloqueó por inactividad. Desbloquéala de nuevo para guardar.')
      setGuardando(false)
    }
  }

  const volverA = esEdicion ? `/boveda/${credencialId}` : '/boveda'
  const claseCampo =
    'rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500'

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to={volverA}>Volver</BotonVolver>
        <h1 className="text-xl font-semibold">{esEdicion ? 'Editar credencial' : 'Nueva credencial'}</h1>
      </header>

      {sinDescifrar && (
        <p className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          No se pudo descifrar el contenido actual (se guardó con otra contraseña maestra). Si
          guardas, se reemplazará por lo que escribas aquí.
        </p>
      )}

      <form onSubmit={manejarEnvio} className="flex flex-col gap-5">
        <Seccion titulo="Información general" descripcion="Qué protege esta credencial y cómo encontrarla.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Título
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Router principal, cámara bodega, servidor..."
              className={claseCampo}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Categoría
            <input
              type="text"
              list="categorias-boveda"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Redes, Servidores, CCTV..."
              className={claseCampo}
            />
            <datalist id="categorias-boveda">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Vencimiento (opcional)
            <input type="date" value={venceEn} onChange={(e) => setVenceEn(e.target.value)} className={claseCampo} />
            <span className="text-xs text-slate-500">
              Esta fecha NO se cifra: permite avisar antes de vencer sin desbloquear la bóveda.
            </span>
          </label>
        </Seccion>

        <Seccion titulo="Credenciales" descripcion="El usuario, la contraseña y cualquier nota sobre su uso.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Usuario
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="off"
              className={claseCampo}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Contraseña
            <div className="flex gap-2">
              <CampoContrasena
                revelado={verContrasena}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className={`flex-1 ${claseCampo}`}
              />
              <button
                type="button"
                onClick={() => setVerContrasena((v) => !v)}
                className="shrink-0 rounded-xl border border-slate-800 px-3 text-xs text-slate-300"
              >
                {verContrasena ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setContrasena(generarContrasena())
                  setVerContrasena(true)
                }}
                className="shrink-0 rounded-xl border border-slate-800 px-3 text-xs text-slate-300"
              >
                Generar
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Notas
            <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className={claseCampo} />
          </label>
        </Seccion>

        <Seccion titulo="Ubicación" descripcion="Dónde se usa esta credencial en la red.">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Dirección IP
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.1"
                className={claseCampo}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              URL
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className={claseCampo}
              />
            </label>
          </div>
        </Seccion>

        <Seccion titulo="Propiedades protegidas" descripcion="Cualquier otro dato confidencial que necesites guardar cifrado.">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Propiedades protegidas</span>
              <button
                type="button"
                onClick={() => setExtras((actuales) => [...actuales, { clave: '', valor: '' }])}
                className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
              >
                + Agregar campo
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Para otros datos protegidos, por ejemplo puerto, PIN, clave WiFi o usuario de respaldo.
            </p>

            {extras.map((campo, indice) => (
              <div key={indice} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Campo"
                  value={campo.clave}
                  onChange={(e) => actualizarExtra(indice, 'clave', e.target.value)}
                  className="w-2/5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  placeholder="Valor"
                  value={campo.valor}
                  onChange={(e) => actualizarExtra(indice, 'valor', e.target.value)}
                  autoComplete="off"
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => quitarExtra(indice)}
                  aria-label="Quitar campo"
                  className="shrink-0 rounded-lg border border-slate-800 px-2.5 text-slate-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {esEdicion && (
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Motivo del cambio (opcional)
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="¿Por qué se actualizó esta credencial?"
                className={claseCampo}
              />
            </label>
          )}
        </Seccion>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

function generarContrasena(): string {
  // Sin caracteres que se confunden entre si (O/0, l/1, I).
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$%&*+-=?'
  const valores = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(valores, (v) => caracteres[v % caracteres.length]).join('')
}
