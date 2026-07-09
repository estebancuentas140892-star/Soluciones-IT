import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { Seccion } from '../../components/Seccion'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { ESTADOS_SUGERIDOS } from './estados'

interface CampoDetalle {
  clave: string
  valor: string
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

  const [categoriaId, setCategoriaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [serial, setSerial] = useState('')
  const [placaInventario, setPlacaInventario] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [ip, setIp] = useState('')
  const [estado, setEstado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState<CampoDetalle[]>([])
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
    setIp(dispositivo.ip)
    setEstado(dispositivo.estado)
    setObservaciones(dispositivo.observaciones)
    setDetalles(Object.entries(dispositivo.detalles).map(([clave, valor]) => ({ clave, valor })))
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
    setIp('')
    setEstado(original.estado)
    setObservaciones(original.observaciones)
    setDetalles(Object.entries(original.detalles).map(([clave, valor]) => ({ clave, valor })))
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

    const id = dispositivoId ?? nuevoId()
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
        ip: ip.trim(),
        estado: estado.trim(),
        observaciones: observaciones.trim(),
        detalles: detallesObjeto,
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
              <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} className={CLASE_INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Modelo
              <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} className={CLASE_INPUT} />
            </label>
          </div>
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
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              className={CLASE_INPUT}
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

            {detalles.map((campo, indice) => (
              <div key={indice} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Campo"
                  value={campo.clave}
                  onChange={(e) => actualizarDetalle(indice, 'clave', e.target.value)}
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
