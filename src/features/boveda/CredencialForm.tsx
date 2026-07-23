import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { CampoContrasena } from '../../components/CampoContrasena'
import { ArrowsClockwise, Eye, EyeSlash, LockSimple, Paperclip, Plus, X } from '../../components/iconos'
import { BTN_GHOST, BTN_ICONO_SECUNDARIO, BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import {
  Campo,
  CampoConSugerencias,
  CamposClaveValor,
  CLASE_CAMPO,
  CLASE_CAMPO_MONO,
  CLASE_ETIQUETA,
  type CampoClaveValor,
} from '../../components/campos'
import { subirOEncolarArchivo, eliminarArchivoPendiente } from '../../lib/archivosPendientes'
import { db, type ArchivoSeguro, type Dispositivo, type DispositivoAfectado, type TipoSecreto } from '../../lib/db'
import { guardarRegistro, nuevoId, registrarAccesoBoveda } from '../../lib/repositorio'
import { generarContrasena } from '../../lib/generarContrasena'
import { proximoVencimiento, vencimientoDesactualizado } from '../../lib/vencimiento'
import { valoresUnicos } from '../../lib/vocabulario'
import { BUCKET_ARCHIVOS_BOVEDA } from './archivoSeguro'
import { equiposConContrasenaProtegida } from './solapamientoSecreto'
import { tituloAccesoSugerido } from './tituloAcceso'
import { cifrarArchivo, cifrarCredencial, descifrarCredencial } from './sesionBoveda'

// Cinco tipos de secreto (fase P3 de PROPUESTA_SEGURIDAD_DISPOSITIVO.md,
// sección 3.2): el `tipo` ya no es solo un preset de URL que precarga
// campos, es la columna real que se guarda (`credenciales.tipo`, grupo
// P1) y se puede ver y cambiar tanto al crear como al editar. El preset
// 'equipo' (que guardaba usuario, contraseña e IP de un dispositivo
// entero dentro del secreto) se eliminó en la fase P0 (2026-07-21): esa
// información es la del propio equipo y ya no se duplica aquí. Un
// equipo se sigue pudiendo vincular a un secreto (sección "Equipos con
// acceso" más abajo), pero el secreto ya no puede REPRESENTAR al equipo.
const TIPOS_SECRETO_VALIDOS = ['cuenta', 'red', 'llave', 'archivo', 'nota'] as const

interface CamposVisibles {
  usuario: boolean
  contrasena: boolean
  url: boolean
  extras: boolean
}

const TODOS_LOS_CAMPOS: CamposVisibles = { usuario: true, contrasena: true, url: true, extras: true }

const CAMPOS_POR_TIPO: Record<TipoSecreto, CamposVisibles> = {
  cuenta: TODOS_LOS_CAMPOS,
  red: { usuario: false, contrasena: true, url: false, extras: true },
  llave: { usuario: false, contrasena: true, url: false, extras: true },
  // Archivo seguro (fase P5): notas y datos protegidos de referencia,
  // más el propio archivo cifrado (editor aparte, ver más abajo).
  archivo: { usuario: false, contrasena: false, url: false, extras: true },
  nota: { usuario: false, contrasena: false, url: false, extras: false },
}

const NOMBRE_TIPO: Record<TipoSecreto, string> = {
  cuenta: 'Cuenta de sistema',
  red: 'Red',
  llave: 'Llave digital',
  archivo: 'Archivo seguro',
  nota: 'Nota segura',
}

const DESCRIPCION_TIPO: Record<TipoSecreto, string> = {
  cuenta: 'Usuario y contraseña de un servicio o aplicación',
  red: 'Clave de una red WiFi u otro acceso compartido',
  llave: 'Token, licencia o certificado',
  archivo: 'Un archivo cifrado (licencia, certificado, config...) con sus datos de referencia',
  nota: 'Texto cifrado, sin usuario ni contraseña',
}

const PLACEHOLDER_TITULO: Record<TipoSecreto, string> = {
  cuenta: 'Servicio: Panel de Supabase, correo...',
  red: 'Nombre de la red WiFi',
  llave: 'Licencia de Windows, certificado SSL...',
  archivo: 'Qué es este archivo',
  nota: 'Título de la nota',
}

// Etiqueta del campo "contraseña": cada tipo llama distinto a lo mismo.
const ETIQUETA_CONTRASENA: Record<TipoSecreto, string> = {
  cuenta: 'Contraseña',
  red: 'Clave',
  llave: 'Clave o token',
  archivo: '',
  nota: '',
}

function esTipoSecretoValido(valor: string | null): valor is TipoSecreto {
  return (TIPOS_SECRETO_VALIDOS as readonly string[]).includes(valor ?? '')
}

// Normaliza para comparar sin distinguir mayusculas ni acentos (mismo
// criterio que el buscador de la Boveda, BovedaPage.tsx).
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function CredencialForm() {
  const { credencialId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(credencialId)

  // El id se decide UNA SOLA VEZ al montar (no en cada envío, como
  // pasaba antes): el editor de archivo (fase P5) necesita subirlo a
  // una ruta estable `credenciales/<id>/...` antes de que la fila
  // exista, mismo motivo por el que DispositivoForm ya hace esto para
  // la foto del equipo.
  const [id] = useState(() => credencialId ?? nuevoId())

  // Creacion contextual (fase N2/N3, punto 1): "+ Credencial" desde la
  // ficha de un equipo llega con /boveda/nueva?titulo=<sugerido>
  // &categoria=<categoria del equipo>&dispositivoId=<id>&dispositivoNombre=<n>.
  // Con el vinculo credencial<->dispositivo de N3, ademas de los dos
  // textos ahora tambien se precarga el equipo vinculado; el tecnico
  // puede editarlo o quitarlo sin problema.
  const tituloContextual = esEdicion ? '' : (searchParams.get('titulo') ?? '')
  const categoriaContextual = esEdicion ? '' : (searchParams.get('categoria') ?? '')
  const dispositivoContextualId = esEdicion ? '' : (searchParams.get('dispositivoId') ?? '')
  const dispositivoContextualNombre = esEdicion ? '' : (searchParams.get('dispositivoNombre') ?? '')

  // Tipo de secreto (fase P3): llega por la URL desde la hoja "Crear"
  // de la Bóveda (`/boveda/nueva?tipo=...`); sin `?tipo=` válido (por
  // ejemplo al crear desde la ficha de un equipo) cae a 'cuenta', el
  // default de la columna. Al editar se ve y se puede cambiar con el
  // selector de más abajo, cargado desde `credencial.tipo` una vez que
  // llega (ver el efecto de carga).
  const tipoParam = searchParams.get('tipo')
  const [tipo, setTipo] = useState<TipoSecreto>(
    !esEdicion && esTipoSecretoValido(tipoParam) ? tipoParam : 'cuenta',
  )

  const credencial = useLiveQuery(
    async () => (credencialId ? ((await db.credenciales.get(credencialId)) ?? null) : undefined),
    [credencialId],
  )
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  // Dispositivos para el selector de "Equipos con acceso" (grupo N3).
  const dispositivosDisponibles = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const dispositivosOrdenados = useMemo(
    () => [...dispositivosDisponibles].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [dispositivosDisponibles],
  )
  // Solapamiento credencial <-> campo protegido (hallazgo S5): datos de
  // los campos protegidos de tipo 'contrasena', para avisar si un equipo
  // vinculado ya guarda su contraseña en Seguridad.
  const camposProtegidosConContrasena = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn && c.tipo === 'contrasena').toArray(),
    [],
    [],
  )
  // Vocabulario derivado, igual que las marcas de un dispositivo. Antes
  // deduplicaba con `new Set` sin recortar espacios ni ignorar
  // mayúsculas, así que "POS" y "pos" aparecían como dos categorías
  // distintas; `valoresUnicos` las une y además ordena con locale
  // español (los acentos dejan de irse al final).
  const categorias = useMemo(
    () => valoresUnicos((credenciales ?? []).map((c) => c.categoria)),
    [credenciales],
  )

  const [titulo, setTitulo] = useState(tituloContextual)
  const [categoria, setCategoria] = useState(categoriaContextual)
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  // Contraseña tal como se cargó al abrir el editor (S1): compararla
  // con el valor actual es como se detecta que el técnico la rotó, sin
  // depender de que recuerde tocar el vencimiento a mano.
  const [contrasenaOriginal, setContrasenaOriginal] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  // Dirección IP heredada de un secreto de tipo 'equipo' guardado antes
  // de la fase P0 (2026-07-21): ya no se edita como campo nuevo, solo
  // se conserva tal cual hasta que el técnico la quite a mano.
  const [ipHeredada, setIpHeredada] = useState('')
  const [url, setUrl] = useState('')
  const [notas, setNotas] = useState('')
  const [extras, setExtras] = useState<CampoClaveValor[]>([])
  // Equipos a los que da acceso esta credencial (grupo N3): lista
  // {id, nombre} como copia de referencia. NO se cifra (como venceEn):
  // que credencial pertenece a que equipo no es el secreto.
  const [dispositivos, setDispositivos] = useState<DispositivoAfectado[]>(() =>
    dispositivoContextualId
      ? [{ id: dispositivoContextualId, nombre: dispositivoContextualNombre }]
      : [],
  )
  // Fecha de vencimiento (fase B2), "YYYY-MM-DD" o ''. A diferencia
  // del resto del formulario NO viaja cifrada: se carga directo del
  // registro, sin esperar el descifrado.
  const [venceEn, setVenceEn] = useState('')
  // Vencimiento tal como se cargó (S1): mientras el técnico no lo
  // toque desde entonces, sigue siendo este valor; sirve para no
  // repetir el aviso de rotación si ya lo atendió.
  const [venceEnOriginal, setVenceEnOriginal] = useState('')
  const [motivo, setMotivo] = useState('')
  // Archivo cifrado del secreto tipo 'archivo' (fase P5). Se sube al
  // elegirlo (no al guardar el formulario), como ya hace FotoEditor en
  // DispositivoForm; solo el {referencia, nombre, tipo, tamano} viaja
  // en el estado del formulario hasta el guardado final.
  const [archivo, setArchivo] = useState<ArchivoSeguro | null>(null)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [sinDescifrar, setSinDescifrar] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El tipo oculta los campos que no suele tocar; este botón los
  // revela sin perder nada, en cualquier tipo.
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const visibles = mostrarTodos ? TODOS_LOS_CAMPOS : CAMPOS_POR_TIPO[tipo]
  const hayCamposOcultos = !mostrarTodos && Object.values(CAMPOS_POR_TIPO[tipo]).includes(false)

  // Nudge anti duplicidad (fase P3, sección 3.2): si el título escrito
  // coincide con el nombre de un equipo del inventario, ese secreto
  // probablemente debería ser un campo protegido de esa ficha en vez de
  // una entrada aparte en la Bóveda (la grieta que describe la
  // propuesta). Se compara sin distinguir mayúsculas ni acentos.
  const dispositivoCoincidente = useMemo(() => {
    const buscado = normalizar(titulo.trim())
    if (!buscado) return null
    return dispositivosOrdenados.find((d) => normalizar(d.nombre) === buscado) ?? null
  }, [titulo, dispositivosOrdenados])

  // Título desactualizado (hallazgo S4): si el equipo vinculado se
  // renombró desde que se creó "Acceso {nombre}" y el técnico no
  // personalizó el título desde entonces, se sugiere el título vivo en
  // vez de dejarlo desfasado en silencio.
  const primerVinculo = dispositivos[0] ?? null
  const tituloSugerido = useMemo(() => {
    if (!primerVinculo) return null
    const vivo = dispositivosOrdenados.find((d) => d.id === primerVinculo.id)?.nombre ?? ''
    return tituloAccesoSugerido(titulo, primerVinculo.nombre, vivo)
  }, [titulo, primerVinculo, dispositivosOrdenados])

  // Solapamiento (hallazgo S5): solo aplica al tipo 'cuenta', que es el
  // que guarda usuario+contraseña representando la identidad de acceso
  // del equipo (el mismo dato que un CampoProtegido 'contrasena').
  const equiposSolapados = useMemo(
    () => (tipo === 'cuenta' ? equiposConContrasenaProtegida(dispositivos, camposProtegidosConContrasena) : []),
    [tipo, dispositivos, camposProtegidosConContrasena],
  )

  useEffect(() => {
    if (!credencial || cargadoInicial) return
    let vigente = true
    setTitulo(credencial.titulo)
    setCategoria(credencial.categoria)
    setTipo(credencial.tipo ?? 'cuenta')
    setVenceEn(credencial.venceEn ?? '')
    setVenceEnOriginal(credencial.venceEn ?? '')
    setDispositivos(credencial.dispositivos ?? [])
    setArchivo(credencial.archivo ?? null)
    void descifrarCredencial(credencial.datosCifrados).then((datos) => {
      if (!vigente) return
      if (datos) {
        setUsuario(datos.usuario)
        setContrasena(datos.contrasena)
        setContrasenaOriginal(datos.contrasena)
        setIpHeredada(datos.ip)
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
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  // Cifra y sube (o encola sin conexión) el archivo elegido de inmediato,
  // igual que ya hace FotoEditor con la foto del equipo: no espera a que
  // se guarde el formulario completo. Si ya había uno, reemplaza el
  // estado local y cancela su subida pendiente si todavía no se había
  // confirmado (inofensivo si ya se subió: no borra nada de Storage,
  // eso solo pasa al eliminar el secreto completo desde su ficha).
  async function manejarArchivoElegido(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0]
    evento.target.value = ''
    if (!elegido) return

    setErrorArchivo(null)
    setSubiendoArchivo(true)
    try {
      const cifrado = await cifrarArchivo(elegido)
      const nombreLimpio = elegido.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `credenciales/${id}/${Date.now()}-${nombreLimpio}`
      await subirOEncolarArchivo(referencia, cifrado, elegido.name, BUCKET_ARCHIVOS_BOVEDA)
      if (archivo) await eliminarArchivoPendiente(archivo.referencia)
      setArchivo({ referencia, nombre: elegido.name, tipo: elegido.type, tamano: elegido.size })
    } catch {
      setErrorArchivo('No se pudo cifrar o subir el archivo. Inténtalo de nuevo.')
    } finally {
      setSubiendoArchivo(false)
    }
  }

  function quitarArchivo() {
    if (archivo) void eliminarArchivoPendiente(archivo.referencia)
    setArchivo(null)
  }

  // S1: si la contraseña cambió desde que se abrió el editor y el
  // vencimiento sigue siendo el mismo, avisa en vez de dejar que el
  // secreto quede "Vencida" o "Próxima" sin ningún motivo real. Ofrece
  // una fecha, no la impone: el técnico puede ajustarla o ignorarla.
  const avisarVencimientoDesactualizado =
    esEdicion &&
    cargadoInicial &&
    vencimientoDesactualizado({
      contrasenaActual: contrasena,
      contrasenaOriginal,
      venceEnActual: venceEn,
      venceEnOriginal,
    })

  function renovarVencimiento() {
    setVenceEn(proximoVencimiento())
  }

  function formatearTamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (!titulo.trim()) {
      setIntentoGuardar(true)
      return
    }
    setGuardando(true)
    setError(null)

    try {
      const datosCifrados = await cifrarCredencial({
        usuario: usuario.trim(),
        contrasena,
        ip: ipHeredada.trim(),
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
          tipo,
          datosCifrados,
          venceEn: venceEn.trim() === '' ? null : venceEn.trim(),
          dispositivos,
          archivo,
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

  const valido = titulo.trim().length > 0
  // Aviso del pie: error de bloqueo primero, luego validación.
  const aviso = error ?? (intentoGuardar && !valido ? 'Falta el título' : '')
  const avisoEsError = Boolean(error) || (intentoGuardar && !valido)
  const etiquetaContrasena = ETIQUETA_CONTRASENA[tipo]

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa con blur: cancelar, nota de cifrado y título. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pb-0 pl-2 pr-3">
            <BotonVolver>Cancelar</BotonVolver>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] text-noct-neutral-500">
              <LockSimple size={13} aria-hidden />
              Se guarda cifrada
            </span>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? 'Editar secreto' : 'Nuevo secreto'}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Solo el título es obligatorio; el vencimiento y los equipos no se cifran para poder
              avisar sin desbloquear
            </p>
          </div>
        </div>

        {sinDescifrar && (
          <div className="mx-4 mt-4 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-[12.5px] leading-relaxed text-noct-precaucion">
            No se pudo descifrar el contenido actual (se guardó con otra contraseña maestra). Si
            guardas, se reemplazará por lo que escribas aquí.
          </div>
        )}

        <form onSubmit={manejarEnvio} className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-6 px-4 pb-[120px] pt-[18px]">
            {/* Identificación: tipo, título + categoría. */}
            <section className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Tipo de secreto</span>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoSecreto)}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                >
                  {TIPOS_SECRETO_VALIDOS.map((t) => (
                    <option key={t} value={t}>
                      {NOMBRE_TIPO[t]}
                    </option>
                  ))}
                </select>
                <span className="text-[11.5px] leading-relaxed text-noct-neutral-600">
                  {DESCRIPCION_TIPO[tipo]}
                </span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>
                  Título <span className="text-noct-accent-300">*</span>
                </span>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder={PLACEHOLDER_TITULO[tipo]}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </label>

              {dispositivoCoincidente && (
                <div className="flex items-center justify-between gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
                    &quot;{dispositivoCoincidente.nombre}&quot; ya es un equipo del inventario. ¿Esto
                    pertenece a ese equipo? Guárdalo en su ficha en vez de un secreto aparte.
                  </p>
                  <Link
                    to={`/dispositivos/${dispositivoCoincidente.id}?nuevoCampoProtegido=${encodeURIComponent(titulo.trim())}`}
                    className="shrink-0 whitespace-nowrap text-[12px] font-medium text-noct-precaucion underline"
                  >
                    Ir a la ficha
                  </Link>
                </div>
              )}

              {tituloSugerido && (
                <div className="flex items-center justify-between gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
                    El equipo vinculado se renombró. El título quedó desactualizado.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTitulo(tituloSugerido)}
                    className="shrink-0 whitespace-nowrap text-[12px] font-medium text-noct-precaucion underline"
                  >
                    Usar &quot;{tituloSugerido}&quot;
                  </button>
                </div>
              )}

              <Campo etiqueta="Categoría">
                <CampoConSugerencias
                  valor={categoria}
                  onChange={setCategoria}
                  sugerencias={categorias}
                  placeholder="Redes, Servidores, CCTV..."
                  className="min-h-11"
                />
              </Campo>
            </section>

            {/* Secreto: todo lo que viaja cifrado en datosCifrados. El
                tipo decide qué campos aparecen (fase P3); "Mostrar todos"
                los revela sin perder nada. */}
            <section className="flex flex-col gap-3.5">
              <TituloSeccion>Secreto</TituloSeccion>

              {/* Dirección IP heredada de un secreto de tipo "equipo"
                  guardado antes de la fase P0: ya no se puede crear de
                  nuevo, solo se conserva hasta que se quite a mano. */}
              {ipHeredada && (
                <div className="flex items-center justify-between gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
                    Guarda una dirección IP heredada ({ipHeredada}). Vincula el equipo en
                    &quot;Equipos con acceso&quot; y quita este dato: ya no se guarda en secretos
                    nuevos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIpHeredada('')}
                    className="shrink-0 text-[12px] font-medium text-noct-precaucion underline"
                  >
                    Quitar
                  </button>
                </div>
              )}

              {visibles.usuario && (
                <label className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>Usuario</span>
                  <input
                    type="text"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoComplete="off"
                    className={`min-h-11 ${CLASE_CAMPO_MONO}`}
                  />
                </label>
              )}

              {visibles.contrasena && (
                <div className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>{etiquetaContrasena}</span>
                  <div className="flex gap-2">
                    <CampoContrasena
                      revelado={verContrasena}
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      className={`min-h-11 flex-1 ${CLASE_CAMPO_MONO}`}
                    />
                    <button
                      type="button"
                      onClick={() => setVerContrasena((v) => !v)}
                      aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className={`${BTN_ICONO_SECUNDARIO} min-h-11 min-w-11`}
                    >
                      {verContrasena ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContrasena(generarContrasena())
                        setVerContrasena(true)
                      }}
                      className={`${BTN_SECUNDARIO} h-11 shrink-0 whitespace-nowrap`}
                    >
                      <ArrowsClockwise size={14} aria-hidden />
                      Generar
                    </button>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-noct-neutral-600">
                    Generar crea 16 caracteres sin los que se confunden entre sí (O/0, l/1).
                  </p>
                </div>
              )}

              {visibles.url && (
                <label className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>URL</span>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className={`min-h-11 ${CLASE_CAMPO_MONO}`}
                  />
                </label>
              )}

              {visibles.extras && (
                <CamposClaveValor
                  titulo="Otros datos protegidos"
                  ayuda="Puerto, PIN, clave WiFi, usuario de respaldo... también van cifrados."
                  campos={extras}
                  onChange={setExtras}
                  valorMono
                  valorAutoComplete="off"
                />
              )}

              {/* Archivo cifrado (fase P5, tipo "Archivo seguro"): se
                  cifra y sube al elegirlo, no al guardar el formulario
                  completo (mismo patrón que la foto del dispositivo). */}
              {tipo === 'archivo' && (
                <div className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>Archivo</span>
                  {archivo ? (
                    <div className="flex items-center justify-between gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
                        <span className="min-w-0 truncate text-sm">
                          {archivo.nombre} · {formatearTamano(archivo.tamano)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={quitarArchivo}
                        className="shrink-0 text-[12px] font-medium text-noct-neutral-400 underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-noct-neutral-700 px-3 py-2.5 text-sm text-noct-neutral-400 ${subiendoArchivo ? 'opacity-60' : ''}`}
                    >
                      <Paperclip size={15} aria-hidden />
                      {subiendoArchivo ? 'Cifrando y subiendo...' : 'Elegir archivo'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={subiendoArchivo}
                        onChange={(e) => void manejarArchivoElegido(e)}
                      />
                    </label>
                  )}
                  {errorArchivo && <p className="text-[12px] text-noct-error">{errorArchivo}</p>}
                  <p className="text-[11.5px] leading-relaxed text-noct-neutral-600">
                    Se cifra en este teléfono antes de subirse: ni el servidor ni un técnico sin acceso
                    a la Bóveda pueden leerlo.
                  </p>
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Notas</span>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Cómo y cuándo se usa"
                  className={`resize-y ${CLASE_CAMPO}`}
                />
              </label>

              {hayCamposOcultos && (
                <button
                  type="button"
                  onClick={() => setMostrarTodos(true)}
                  className={`${BTN_GHOST} self-start`}
                >
                  <Plus size={13} aria-hidden />
                  Mostrar todos los campos
                </button>
              )}
            </section>

            {/* Visible sin desbloquear: vencimiento y equipos no son el
                secreto; existen para avisar y navegar con la bóveda cerrada. */}
            <section className="flex flex-col gap-3.5">
              <div>
                <TituloSeccion>Visible sin desbloquear</TituloSeccion>
                <p className="mt-[3px] text-[12px] leading-relaxed text-noct-neutral-600">
                  El vencimiento y el vínculo con equipos no son el secreto: permiten avisos y
                  navegación con la bóveda cerrada
                </p>
              </div>

              <label className="flex max-w-[220px] flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Vencimiento (opcional)</span>
                <input
                  type="date"
                  value={venceEn}
                  onChange={(e) => setVenceEn(e.target.value)}
                  className={`min-h-11 [color-scheme:dark] ${CLASE_CAMPO}`}
                />
              </label>

              {avisarVencimientoDesactualizado && (
                <div className="flex items-center justify-between gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
                    La contraseña cambió pero el vencimiento sigue siendo el mismo. ¿Renovarlo?
                  </p>
                  <button
                    type="button"
                    onClick={renovarVencimiento}
                    className="shrink-0 whitespace-nowrap text-[12px] font-medium text-noct-precaucion underline"
                  >
                    Renovar 90 días
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className={CLASE_ETIQUETA}>Equipos con acceso</span>
                <EquiposVinculadosEditor
                  vinculados={dispositivos}
                  dispositivos={dispositivosOrdenados}
                  onVincular={(d) => setDispositivos((actuales) => [...actuales, { id: d.id, nombre: d.nombre }])}
                  onQuitar={(id) => setDispositivos((actuales) => actuales.filter((d) => d.id !== id))}
                />
              </div>

              {equiposSolapados.map((equipo) => (
                <div
                  key={equipo.id}
                  className="flex items-center justify-between gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5"
                >
                  <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
                    &quot;{equipo.nombre}&quot; ya guarda una contraseña en Seguridad. Evita duplicarla: al
                    rotar hay que acordarse de cambiarla en los dos lados.
                  </p>
                  <Link
                    to={`/dispositivos/${equipo.id}`}
                    className="shrink-0 whitespace-nowrap text-[12px] font-medium text-noct-precaucion underline"
                  >
                    Ir a la ficha
                  </Link>
                </div>
              ))}

              {esEdicion && (
                <label className="flex flex-col gap-1.5">
                  <span className={CLASE_ETIQUETA}>Motivo del cambio (opcional)</span>
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por qué se actualizó: rotación, incidente..."
                    className={`min-h-11 ${CLASE_CAMPO}`}
                  />
                </label>
              )}
            </section>
          </main>

          {/* Barra inferior fija: aviso + Guardar. */}
          <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-[12px]">
            <div className="flex items-center gap-2.5">
              <span
                className={`min-w-0 flex-1 truncate text-[12px] ${avisoEsError ? 'text-noct-precaucion' : 'text-noct-neutral-500'}`}
              >
                {aviso}
              </span>
              <button
                type="submit"
                disabled={guardando}
                className={`${BTN_PRIMARIO} min-h-[46px] px-4 disabled:opacity-50`}
                style={{ opacity: valido ? undefined : 0.55 }}
              >
                <LockSimple size={15} aria-hidden />
                {guardando ? 'Guardando...' : 'Guardar secreto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Equipos a los que da acceso la credencial (grupo N3), re-autorizado a
// Nocturne: los vinculados como pastillas de acento con quitar (X) y un
// selector delineado para agregar. Copia de referencia (id + nombre).
function EquiposVinculadosEditor({
  vinculados,
  dispositivos,
  onVincular,
  onQuitar,
}: {
  vinculados: DispositivoAfectado[]
  dispositivos: Dispositivo[]
  onVincular: (dispositivo: Dispositivo) => void
  onQuitar: (id: string) => void
}) {
  const disponibles = dispositivos.filter((d) => !vinculados.some((v) => v.id === d.id))

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {vinculados.map((vinculo) => (
        <span
          key={vinculo.id}
          className="inline-flex min-h-9 items-center gap-[7px] whitespace-nowrap rounded-full border border-noct-accent/30 bg-noct-accent/[.08] py-0 pl-3 pr-1.5 text-[12.5px]"
        >
          {vinculo.nombre || '(equipo sin nombre)'}
          <button
            type="button"
            onClick={() => onQuitar(vinculo.id)}
            aria-label={`Quitar ${vinculo.nombre}`}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-noct-neutral-500 hover:text-noct-text"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}

      {disponibles.length > 0 ? (
        <label className="relative inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-noct-neutral-700 px-3 text-[12.5px] text-noct-neutral-400 transition-colors focus-within:border-noct-accent hover:border-noct-accent hover:text-noct-accent-300">
          <Plus size={12} aria-hidden />
          Agregar equipo
          <select
            value=""
            aria-label="Agregar equipo con acceso"
            onChange={(e) => {
              const dispositivo = disponibles.find((d) => d.id === e.target.value)
              if (dispositivo) onVincular(dispositivo)
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">Agregar equipo</option>
            {disponibles.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
                {d.ubicacion ? ` (${d.ubicacion})` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        vinculados.length === 0 && (
          <p className="text-[12px] text-noct-neutral-600">No hay dispositivos registrados todavía.</p>
        )
      )}
    </div>
  )
}

