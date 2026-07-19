import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import {
  Camera,
  CaretDown,
  CaretUp,
  FloppyDisk,
  Plus,
  TrashSimple,
  Warning,
  X,
} from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, TagNeutral, TituloSeccion } from '../../components/nocturne'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { db, type PasoAdjunto } from '../../lib/db'
import { comprimirImagen } from '../../lib/comprimirImagen'
import { subirOEncolarArchivo } from '../../lib/archivosPendientes'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { iconoDeCategoria } from '../soluciones/iconosSoluciones'
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

// Punto de color de cada estado sugerido (08_ESTILO: operativo verde,
// mantenimiento ámbar, fuera de servicio rojo, de baja neutro). Se
// indexa por la etiqueta canónica de ESTADOS_SUGERIDOS.
const PUNTO_ESTADO: Record<string, string> = {
  Operativo: 'bg-noct-exito',
  'En mantenimiento': 'bg-noct-precaucion',
  'Fuera de servicio': 'bg-noct-error',
  'De baja': 'bg-noct-neutral-500',
}

// Clases compartidas de los campos de texto (mismo lenguaje que los
// demás editores Nocturne): borde divisor, fondo de superficie y foco
// en el acento.
const CLASE_CAMPO =
  'w-full box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'
const CLASE_ETIQUETA = 'text-[12.5px] font-medium text-noct-neutral-400'

// Formato de una IP v4 sencilla (cuatro grupos de 1-3 dígitos). Es una
// validación de forma, no de rango: sirve para avisar de un error obvio
// de tecleo sin bloquear el guardado.
const RE_IP = /^\d{1,3}(\.\d{1,3}){3}$/

// Editor de un dispositivo, rediseñado al sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Editor de Dispositivo.dc.html):
// cabecera pegajosa con "Cancelar" (y el tag "Copia de otro equipo" al
// duplicar), campos esenciales (nombre y categoría en chips son lo
// único obligatorio), foto, identificación con aviso de serial ya
// existente, ubicación, conectividad (IP validada y estado en chips con
// punto de color) y un bloque plegable "Más información" con
// observaciones, propiedades sugeridas por categoría y el motivo del
// cambio. Trae su propio shell a pantalla completa, por eso su ruta
// sale del Layout oscuro como los demás editores. Conserva intactos el
// modelo de datos y toda la lógica del editor previo: id decidido al
// inicio (para subir la foto a su carpeta antes de que el equipo
// exista), modo duplicar por `?copiarDe`, subida/encolado de la foto,
// marcas y propiedades sugeridas aprendidas del uso real, ubicación
// como entidad y guardado con motivo.
export function DispositivoForm() {
  const { dispositivoId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(dispositivoId)
  // Modo duplicar: /dispositivos/nuevo?copiarDe=<id> precarga la ficha
  // de otro dispositivo, dejando en blanco lo que identifica al equipo
  // (serial, placa, IP).
  const copiarDe = esEdicion ? null : searchParams.get('copiarDe')
  const esDuplicado = Boolean(copiarDe)
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
  // Estado libre; en un equipo nuevo se asume "Operativo" (lo esperable
  // al registrar un equipo que se acaba de instalar y que el mockup trae
  // seleccionado por defecto).
  const [estado, setEstado] = useState(esEdicion || esDuplicado ? '' : 'Operativo')
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState<CampoDetalle[]>([])
  const [foto, setFoto] = useState<PasoAdjunto | null>(null)
  const [motivo, setMotivo] = useState('')
  const [masAbierto, setMasAbierto] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
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

  // Nombre de la categoría elegida, para el rótulo "Propiedades de X".
  const categoriaNombre = useMemo(
    () => categorias?.find((c) => c.id === categoriaId)?.nombre ?? 'esta categoría',
    [categorias, categoriaId],
  )

  // Otro equipo (no el actual) que ya usa este mismo serial: aviso de
  // posible duplicado antes de crear la ficha. Dato real, no del mockup.
  const serialDuplicado = useMemo(() => {
    const buscado = serial.trim().toLowerCase()
    if (buscado === '') return null
    return todosDispositivos.find((d) => d.id !== id && d.serial.trim().toLowerCase() === buscado) ?? null
  }, [todosDispositivos, serial, id])

  const ipValida = ip.trim() === '' || RE_IP.test(ip.trim())
  const valido = nombre.trim() !== '' && categoriaId !== ''

  // Resumen del bloque plegable: cuántos campos "extra" tienen contenido.
  const conContenidoMas =
    (observaciones.trim() !== '' ? 1 : 0) + detalles.filter((d) => d.clave.trim() !== '').length
  const resumenMas =
    conContenidoMas === 0 ? 'observaciones y propiedades' : `${conContenidoMas} con contenido`

  if (esEdicion && dispositivo === null) return <Navigate to="/dispositivos" replace />

  function actualizarDetalle(indice: number, campo: keyof CampoDetalle, valor: string) {
    setDetalles((actuales) => actuales.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d)))
  }

  function quitarDetalle(indice: number) {
    setDetalles((actuales) => actuales.filter((_, i) => i !== indice))
  }

  async function guardar() {
    if (!valido) {
      setIntentoGuardar(true)
      return
    }
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
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  const aviso = intentoGuardar && !valido ? 'Falta el nombre o la categoría' : ''

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa con blur: cancelar, tag de copia y título. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver variante="nocturne">Cancelar</BotonVolver>
            {esDuplicado && <TagNeutral className="shrink-0">Copia de otro equipo</TagNeutral>}
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? 'Editar dispositivo' : 'Nuevo dispositivo'}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Solo el nombre y la categoría son obligatorios; el resto se puede completar después
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-[120px] pt-[18px]">
          {/* Datos esenciales: nombre, categoría, marca/modelo y foto. */}
          <section className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Nombre <span className="text-noct-accent-300">*</span>
              </span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Qué es y dónde está: Zebra ZT411 · Bodega central"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Categoría <span className="text-noct-accent-300">*</span>
              </span>
              <div className="flex flex-wrap gap-[7px]">
                {categorias.map((c) => {
                  const activa = c.id === categoriaId
                  const Icono = iconoDeCategoria(c.nombre)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => setCategoriaId(c.id)}
                      className={`inline-flex min-h-[38px] items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                        activa
                          ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                          : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                      }`}
                    >
                      <Icono size={15} aria-hidden />
                      {c.nombre}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Marca</span>
                <input
                  type="text"
                  list="ded-marcas"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Zebra, HP, Cisco..."
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
                <datalist id="ded-marcas">
                  {marcasSugeridas.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Modelo</span>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="ZT411"
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </label>
            </div>

            <FotoEditor dispositivoId={id} foto={foto} onChange={setFoto} />
          </section>

          {/* Identificación física: serial y placa, con aviso de serial
              ya existente. */}
          <section className="flex flex-col gap-3.5">
            <div>
              <TituloSeccion>Identificación</TituloSeccion>
              <p className="mt-[3px] text-[12px] text-noct-neutral-600">
                Cómo distinguir físicamente este equipo de otro igual
                {esDuplicado ? '. Serial, placa e IP no se copian: son de cada equipo físico' : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Número de serie</span>
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  className={`min-h-11 font-mono ${CLASE_CAMPO}`}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Placa de inventario</span>
                <input
                  type="text"
                  value={placaInventario}
                  onChange={(e) => setPlacaInventario(e.target.value)}
                  className={`min-h-11 font-mono ${CLASE_CAMPO}`}
                />
              </label>
            </div>
            {serialDuplicado && (
              <div className="flex items-start gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-3 py-2.5">
                <Warning size={16} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
                <p className="text-[13px] leading-[1.5]">
                  Este serial ya existe en{' '}
                  <Link to={`/dispositivos/${serialDuplicado.id}`} className="text-noct-accent-300 hover:text-noct-accent-400">
                    {serialDuplicado.nombre}
                  </Link>
                  . Revisar antes de crear un duplicado.
                </p>
              </div>
            )}
          </section>

          {/* Ubicación (entidad N3): SelectorUbicacion re-tematizado. */}
          <section className="flex flex-col gap-2.5">
            <TituloSeccion>Ubicación</TituloSeccion>
            <SelectorUbicacion
              ubicacionId={ubicacionId}
              ubicacion={ubicacion}
              onChange={(idUbicacion, texto) => {
                setUbicacionId(idUbicacion)
                setUbicacion(texto)
              }}
            />
          </section>

          {/* Conectividad y estado: IP (validada) y estado en chips. */}
          <section className="flex flex-col gap-3.5">
            <TituloSeccion>Conectividad y estado</TituloSeccion>
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Dirección IP</span>
              <input
                type="text"
                inputMode="decimal"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.10"
                className={`min-h-11 w-full box-border rounded-md border bg-noct-surface px-3 py-2.5 font-mono text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600 ${
                  ipValida ? 'border-noct-divider' : 'border-noct-precaucion/55'
                }`}
              />
              {!ipValida && (
                <span className="text-[12px] text-noct-precaucion">No parece una IP válida (formato 192.168.1.10)</span>
              )}
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Estado</span>
              <div className="flex flex-wrap gap-[7px]">
                {ESTADOS_SUGERIDOS.map((valor) => {
                  const activo = estado.trim().toLowerCase() === valor.toLowerCase()
                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setEstado(valor)}
                      className={`inline-flex min-h-[38px] items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                        activo
                          ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                          : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                      }`}
                    >
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${PUNTO_ESTADO[valor]}`} />
                      {valor}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Más información (plegable): observaciones, propiedades por
              categoría y el motivo del cambio en edición. */}
          <section className="border-t border-noct-divider">
            <button
              type="button"
              onClick={() => setMasAbierto((v) => !v)}
              aria-expanded={masAbierto}
              className="flex min-h-[52px] w-full items-center gap-2.5 px-0.5 py-1.5 text-left"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
                Más información
              </span>
              <span className="text-[11px] text-noct-neutral-600">{resumenMas}</span>
              {masAbierto ? (
                <CaretUp size={14} className="ml-auto text-noct-neutral-500" aria-hidden />
              ) : (
                <CaretDown size={14} className="ml-auto text-noct-neutral-500" aria-hidden />
              )}
            </button>

            {masAbierto && (
              <div className="flex flex-col gap-4 pb-2 pt-1">
                <label className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>Observaciones</span>
                  <textarea
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Qué imprime, cada cuánto se mantiene, particularidades"
                    className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={CLASE_ETIQUETA}>Propiedades de {categoriaNombre}</span>
                    <button
                      type="button"
                      onClick={() => setDetalles((actuales) => [...actuales, { clave: '', valor: '' }])}
                      className={`${BTN_GHOST} text-noct-accent`}
                    >
                      <Plus size={13} aria-hidden />
                      Campo
                    </button>
                  </div>
                  <p className="text-[12px] leading-[1.5] text-noct-neutral-600">
                    Se sugieren los campos que ya usan otros equipos de la misma categoría.
                  </p>

                  {propiedadesSugeridas.length > 0 && (
                    <datalist id="ded-propiedades">
                      {propiedadesSugeridas.map((clave) => (
                        <option key={clave} value={clave} />
                      ))}
                    </datalist>
                  )}

                  {detalles.map((campo, indice) => (
                    <div key={indice} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Campo"
                        value={campo.clave}
                        onChange={(e) => actualizarDetalle(indice, 'clave', e.target.value)}
                        list="ded-propiedades"
                        className="box-border min-h-[42px] w-[38%] rounded-md border border-noct-divider bg-noct-surface px-2.5 py-2 text-[13.5px] text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600"
                      />
                      <input
                        type="text"
                        placeholder="Valor"
                        value={campo.valor}
                        onChange={(e) => actualizarDetalle(indice, 'valor', e.target.value)}
                        className="box-border min-h-[42px] min-w-0 flex-1 rounded-md border border-noct-divider bg-noct-surface px-2.5 py-2 text-[13.5px] text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600"
                      />
                      <button
                        type="button"
                        onClick={() => quitarDetalle(indice)}
                        aria-label="Quitar este campo"
                        className="flex min-h-11 w-8 shrink-0 items-center justify-center text-noct-neutral-600 hover:text-noct-text"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>

                {esEdicion && (
                  <label className="flex flex-col gap-1.5">
                    <span className={CLASE_ETIQUETA}>Motivo del cambio (opcional)</span>
                    <input
                      type="text"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Por qué se actualizó esta ficha"
                      className={`min-h-11 ${CLASE_CAMPO}`}
                    />
                  </label>
                )}
              </div>
            )}
          </section>
        </main>

        {/* Barra inferior fija: aviso de validación + Guardar. */}
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-[12px]">
          <div className="flex items-center gap-2.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-noct-precaucion">{aviso}</span>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar()}
              className={`${BTN_PRIMARIO} min-h-[46px] px-4 disabled:opacity-50`}
              style={{ opacity: valido ? undefined : 0.55 }}
            >
              <FloppyDisk size={15} aria-hidden />
              {guardando ? 'Guardando...' : 'Guardar dispositivo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Fotografia principal del equipo (fase Dis2): identifica el
// dispositivo de un vistazo en la ficha, el listado, el buscador y al
// escanear su codigo QR. Mismo patron que la portada de un
// procedimiento (comprimida en el telefono, encolada si no hay señal;
// solo queda la referencia de Storage en el dispositivo). Re-tematizada
// a Nocturne como slot 96x64 (image-slot del mockup) con un texto
// descriptivo al lado.
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label className="relative h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-md border border-noct-divider bg-noct-surface">
          {foto && url ? (
            <img src={url} alt="Fotografía del equipo" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-noct-neutral-500">
              <Camera size={18} aria-hidden />
              <span className="text-[10px]">{subiendo ? '...' : 'Foto'}</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendo}
            onChange={(evento) => void subir(evento)}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-[1.5] text-noct-neutral-500">
            Fotografía principal (opcional). Identifica el equipo en la lista, el buscador y al escanear su QR.
          </p>
          {foto && !subiendo && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-1 inline-flex items-center gap-1 text-[12px] text-noct-neutral-500 hover:text-noct-text"
            >
              <TrashSimple size={13} aria-hidden />
              Quitar foto
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-[12px] text-noct-error">{error}</p>}
      {aviso && <p className="text-[12px] text-noct-precaucion">{aviso}</p>}
    </div>
  )
}
