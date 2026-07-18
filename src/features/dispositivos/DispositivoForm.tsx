import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { Seccion } from '../../components/Seccion'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { db, type PasoAdjunto } from '../../lib/db'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { SelectorUbicacion } from '../ubicaciones/SelectorUbicacion'
import { ESTADOS_SUGERIDOS } from './estados'

interface CampoDetalle {
  clave: string
  valor: string
}

// Valores distintos, sin vacíos y ordenados, para un datalist de
// autocompletar. Deduplica sin distinguir mayúsculas (conserva la
// primera forma vista) para no ofrecer "POS" y "pos" como opciones
// separadas.
function valoresUnicos(valores: string[]): string[] {
  const porClave = new Map<string, string>()
  for (const valor of valores) {
    const limpio = valor.trim()
    if (limpio === '') continue
    const clave = limpio.toLowerCase()
    if (!porClave.has(clave)) porClave.set(clave, limpio)
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
}

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

export function DispositivoForm() {
  const { dispositivoId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(dispositivoId)
  // Modo duplicar: /dispositivos/nuevo?copiarDe=<id> precarga la ficha
  // de otro dispositivo, dejando en blanco lo que identifica al equipo
  // (serial, placa, IP).
  const copiarDe = esEdicion ? null : searchParams.get('copiarDe')
  // El id se decide desde el inicio (no al guardar) para que la foto
  // pueda subirse a su carpeta definitiva de Storage antes de que el
  // dispositivo exista (mismo patron que la portada de un articulo).
  const [id] = useState(() => dispositivoId ?? nuevoId())

  const dispositivo = useLiveQuery(
    () => (dispositivoId ? db.dispositivos.get(dispositivoId) : undefined),
    [dispositivoId],
  )
  // null significa "no existe" (distinto de undefined, "cargando").
  const original = useLiveQuery(async () => {
    if (!copiarDe) return undefined
    return (await db.dispositivos.get(copiarDe)) ?? null
  }, [copiarDe])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  // Vocabulario derivado (fase N0): las marcas ya usadas por otros
  // equipos se ofrecen como autocompletar. La ubicación dejó de ser texto
  // libre con datalist: ahora es una entidad propia (grupo N3), elegida
  // con SelectorUbicacion.
  const todosDispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const marcasSugeridas = useMemo(
    () => valoresUnicos(todosDispositivos.map((d) => d.marca)),
    [todosDispositivos],
  )

  const [categoriaId, setCategoriaId] = useState('')

  // Propiedades sugeridas por categoria (fase N2, punto 3): al agregar
  // un campo personalizado, se ofrecen las CLAVES que ya usan otros
  // equipos de la MISMA categoria (si 30 camaras tienen "puerto" y
  // "switch", la 31 las recibe como sugerencia). Es la plantilla por
  // categoria que se pidio, pero aprendida del uso real en vez de
  // configurada: no exige mantenimiento con una categoria nueva.
  const propiedadesSugeridas = useMemo(
    () =>
      valoresUnicos(
        todosDispositivos.filter((d) => d.categoriaId === categoriaId).flatMap((d) => Object.keys(d.detalles)),
      ),
    [todosDispositivos, categoriaId],
  )
  const [nombre, setNombre] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [serial, setSerial] = useState('')
  const [placaInventario, setPlacaInventario] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  // Id de la ubicacion (entidad, grupo N3), o null si es texto libre.
  const [ubicacionId, setUbicacionId] = useState<string | null>(null)
  const [ip, setIp] = useState('')
  const [estado, setEstado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState<CampoDetalle[]>([])
  const [foto, setFoto] = useState<PasoAdjunto | null>(null)
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion && !copiarDe)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!dispositivo || cargadoInicial) return
    setCategoriaId(dispositivo.categoriaId)
    setNombre(dispositivo.nombre)
    setMarca(dispositivo.marca)
    setModelo(dispositivo.modelo)
    setSerial(dispositivo.serial)
    setPlacaInventario(dispositivo.placaInventario)
    setUbicacion(dispositivo.ubicacion)
    setUbicacionId(dispositivo.ubicacionId ?? null)
    setIp(dispositivo.ip)
    setEstado(dispositivo.estado)
    setObservaciones(dispositivo.observaciones)
    setDetalles(Object.entries(dispositivo.detalles).map(([clave, valor]) => ({ clave, valor })))
    setFoto(dispositivo.foto ?? null)
    setCargadoInicial(true)
  }, [dispositivo, cargadoInicial])

  useEffect(() => {
    if (esEdicion || original === undefined || cargadoInicial) return
    if (original === null) {
      // La ficha a copiar ya no existe: se sigue con el formulario vacío.
      setCargadoInicial(true)
      return
    }
    setCategoriaId(original.categoriaId)
    setNombre(`${original.nombre} (copia)`)
    setMarca(original.marca)
    setModelo(original.modelo)
    setSerial('')
    setPlacaInventario('')
    setUbicacion(original.ubicacion)
    setUbicacionId(original.ubicacionId ?? null)
    setIp('')
    setEstado(original.estado)
    setObservaciones(original.observaciones)
    setDetalles(Object.entries(original.detalles).map(([clave, valor]) => ({ clave, valor })))
    // La foto NO se copia: es un equipo fisico distinto, con su propia
    // imagen (mismo criterio que serial, placa e IP, que tampoco se
    // copian).
    setCargadoInicial(true)
  }, [esEdicion, original, cargadoInicial])

  useEffect(() => {
    if (!esEdicion && !categoriaId && categorias && categorias.length > 0) {
      setCategoriaId(categorias[0].id)
    }
  }, [esEdicion, categoriaId, categorias])

  if (esEdicion && dispositivo === null) return <Navigate to="/dispositivos" replace />

  function actualizarDetalle(indice: number, campo: keyof CampoDetalle, valor: string) {
    setDetalles((actuales) => actuales.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d)))
  }

  function quitarDetalle(indice: number) {
    setDetalles((actuales) => actuales.filter((_, i) => i !== indice))
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setGuardando(true)

    const detallesObjeto = Object.fromEntries(
      detalles.filter((d) => d.clave.trim()).map((d) => [d.clave.trim(), d.valor.trim()]),
    )

    await guardarRegistro(
      'dispositivos',
      {
        id,
        categoriaId,
        nombre: nombre.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        serial: serial.trim(),
        placaInventario: placaInventario.trim(),
        ubicacion: ubicacion.trim(),
        // Solo se conserva el id si la ubicacion no quedo en blanco.
        ubicacionId: ubicacion.trim() === '' ? null : ubicacionId,
        ip: ip.trim(),
        estado: estado.trim(),
        observaciones: observaciones.trim(),
        detalles: detallesObjeto,
        foto,
      },
      motivo.trim(),
    )

    navigate(`/dispositivos/${id}`)
  }

  if ((esEdicion || copiarDe) && !cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  const volverA = esEdicion ? `/dispositivos/${dispositivoId}` : '/dispositivos'

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to={volverA}>Volver</BotonVolver>
        <h1 className="text-xl font-semibold">{esEdicion ? 'Editar dispositivo' : 'Nuevo dispositivo'}</h1>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-5">
        <Seccion titulo="Información general" descripcion="Qué es el equipo y a qué categoría pertenece.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Nombre
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={CLASE_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Categoría
            <select
              required
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className={CLASE_INPUT}
            >
              {categorias?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Marca
              <input
                type="text"
                list="marcas-sugeridas"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className={CLASE_INPUT}
              />
              <datalist id="marcas-sugeridas">
                {marcasSugeridas.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Modelo
              <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} className={CLASE_INPUT} />
            </label>
          </div>

          <FotoEditor dispositivoId={id} foto={foto} onChange={setFoto} />
        </Seccion>

        <Seccion titulo="Identificación" descripcion="Cómo distinguir físicamente este equipo de otro igual.">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Número de serie
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className={CLASE_INPUT}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Placa de inventario
              <input
                type="text"
                value={placaInventario}
                onChange={(e) => setPlacaInventario(e.target.value)}
                className={CLASE_INPUT}
              />
            </label>
          </div>
        </Seccion>

        <Seccion titulo="Ubicación" descripcion="Dónde encontrar físicamente el equipo.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Ubicación
            <SelectorUbicacion
              ubicacionId={ubicacionId}
              ubicacion={ubicacion}
              onChange={(id, texto) => {
                setUbicacionId(id)
                setUbicacion(texto)
              }}
            />
          </label>
        </Seccion>

        <Seccion titulo="Conectividad" descripcion="Cómo se accede a este equipo en la red y en qué estado está.">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Dirección IP
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.10"
                className={CLASE_INPUT}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Estado
              <input
                type="text"
                list="estados-sugeridos"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className={CLASE_INPUT}
              />
              <datalist id="estados-sugeridos">
                {ESTADOS_SUGERIDOS.map((valor) => (
                  <option key={valor} value={valor} />
                ))}
              </datalist>
            </label>
          </div>
        </Seccion>

        <Seccion titulo="Información adicional" descripcion="Observaciones y datos propios de este tipo de equipo.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Observaciones
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className={CLASE_INPUT}
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Propiedades personalizadas</span>
              <button
                type="button"
                onClick={() => setDetalles((actuales) => [...actuales, { clave: '', valor: '' }])}
                className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
              >
                + Agregar campo
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Para datos propios de este tipo de dispositivo, por ejemplo puerto, switch, usuario asignado o
              sistema operativo.
            </p>

            {propiedadesSugeridas.length > 0 && (
              <datalist id="propiedades-sugeridas">
                {propiedadesSugeridas.map((clave) => (
                  <option key={clave} value={clave} />
                ))}
              </datalist>
            )}

            {detalles.map((campo, indice) => (
              <div key={indice} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Campo"
                  value={campo.clave}
                  onChange={(e) => actualizarDetalle(indice, 'clave', e.target.value)}
                  list="propiedades-sugeridas"
                  className="w-2/5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  placeholder="Valor"
                  value={campo.valor}
                  onChange={(e) => actualizarDetalle(indice, 'valor', e.target.value)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => quitarDetalle(indice)}
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
                placeholder="¿Por qué se actualizó esta ficha?"
                className={CLASE_INPUT}
              />
            </label>
          )}
        </Seccion>

        <button
          type="submit"
          disabled={guardando || !categoriaId}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

// Fotografia principal del equipo (fase Dis2): identifica el
// dispositivo de un vistazo en la ficha, el listado, el buscador y al
// escanear su codigo QR. Mismo patron que la portada de un
// procedimiento (comprimida en el telefono, encolada si no hay señal;
// solo queda la referencia de Storage en el dispositivo).
function FotoEditor({
  dispositivoId,
  foto,
  onChange,
}: {
  dispositivoId: string
  foto: PasoAdjunto | null
  onChange: (foto: PasoAdjunto | null) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const url = useUrlAdjunto(foto?.referencia ?? null)

  async function subir(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setError(null)
    setAviso(null)
    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    setSubiendo(true)
    try {
      const archivoFinal = await comprimirImagen(archivo)
      const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `dispositivos/${dispositivoId}/foto/${Date.now()}-${nombreLimpio}`
      const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
      if (resultado === 'encolado') {
        setAviso('Sin conexión: la foto quedó guardada en este dispositivo y se subirá sola al recuperar señal.')
      }
      onChange({ referencia, nombre: archivoFinal.name, tipo: archivoFinal.type })
    } catch {
      setError(`No se pudo subir la foto: ${archivo.name}`)
    }
    setSubiendo(false)
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-slate-300">
      <span>📷 Fotografía principal (opcional)</span>
      <div className="flex items-center gap-3">
        {foto &&
          (url ? (
            <img
              src={url}
              alt="Fotografía del equipo"
              className="h-16 w-24 shrink-0 rounded-lg border border-slate-800 object-cover"
            />
          ) : (
            <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-500">
              📷
            </div>
          ))}
        <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {subiendo ? 'Subiendo...' : foto ? 'Cambiar foto' : '+ Elegir foto'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendo}
            onChange={(evento) => void subir(evento)}
          />
        </label>
        {foto && !subiendo && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-slate-400 underline underline-offset-2"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Se muestra en la ficha, el listado, el buscador y al escanear el código QR del equipo.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {aviso && <p className="text-xs text-amber-300">{aviso}</p>}
    </div>
  )
}
