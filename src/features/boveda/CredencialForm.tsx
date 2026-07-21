import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { CampoContrasena } from '../../components/CampoContrasena'
import { ArrowsClockwise, Eye, EyeSlash, LockSimple, Plus, X } from '../../components/iconos'
import {
  BTN_GHOST,
  BTN_ICONO_SECUNDARIO,
  BTN_PRIMARIO,
  BTN_SECUNDARIO,
  TagNeutral,
  TituloSeccion,
} from '../../components/nocturne'
import { db, type Dispositivo, type DispositivoAfectado, type TipoSecreto } from '../../lib/db'
import { guardarRegistro, nuevoId, registrarAccesoBoveda } from '../../lib/repositorio'
import { cifrarCredencial, descifrarCredencial } from './sesionBoveda'

interface CampoExtra {
  clave: string
  valor: string
}

// Presets de "Crear" (decisión de diseño D-018, handoff "Rediseño de
// aplicación empresarial"): los tipos NO son entidades distintas, son
// el mismo editor precargando qué campos del secreto aparecen, para
// escribir menos. El tipo llega por la URL desde la hoja "Crear" de la
// Bóveda (`/boveda/nueva?tipo=...`). 'completo' es el modo sin preset:
// al editar, o al crear desde la ficha de un equipo, se muestran todos.
// El preset 'equipo' (que guardaba usuario, contraseña e IP de un
// dispositivo entero dentro del secreto) se eliminó en la fase P0 de
// PROPUESTA_SEGURIDAD_DISPOSITIVO.md (2026-07-21): esa información es
// la del propio equipo y ya no se duplica aquí. Un equipo se sigue
// pudiendo vincular a un secreto (sección "Equipos con acceso" más
// abajo), pero el secreto ya no puede REPRESENTAR al equipo.
type TipoCredencial = 'wifi' | 'web' | 'nota' | 'completo'

const TIPOS_VALIDOS = ['wifi', 'web', 'nota'] as const

interface CamposVisibles {
  usuario: boolean
  contrasena: boolean
  url: boolean
  extras: boolean
}

const CAMPOS_POR_TIPO: Record<TipoCredencial, CamposVisibles> = {
  wifi: { usuario: false, contrasena: true, url: false, extras: true },
  web: { usuario: true, contrasena: true, url: true, extras: true },
  nota: { usuario: false, contrasena: false, url: false, extras: false },
  completo: { usuario: true, contrasena: true, url: true, extras: true },
}

const NOMBRE_TIPO: Record<Exclude<TipoCredencial, 'completo'>, string> = {
  wifi: 'Red WiFi',
  web: 'Cuenta web',
  nota: 'Nota segura',
}

const PLACEHOLDER_TITULO: Record<TipoCredencial, string> = {
  wifi: 'Nombre de la red WiFi',
  web: 'Servicio: Panel de Supabase, correo...',
  nota: 'Título de la nota',
  completo: 'Router principal, cámara bodega, servidor...',
}

// Preset del editor -> tipo de secreto que se guarda en la columna
// `tipo` (grupo P1). El preset 'completo' no dice nada del contenido,
// asi que cae a 'cuenta', el default de la columna. La interfaz propia
// de tipos (con "Llave digital" y "Archivo seguro") llega en la fase P3.
function tipoSecretoDePreset(preset: TipoCredencial): TipoSecreto {
  switch (preset) {
    case 'wifi':
      return 'red'
    case 'nota':
      return 'nota'
    case 'web':
    case 'completo':
      return 'cuenta'
  }
}

const CLASE_CAMPO =
  'w-full box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'
const CLASE_CAMPO_MONO = `${CLASE_CAMPO} font-mono`
const CLASE_ETIQUETA = 'text-[12.5px] font-medium text-noct-neutral-400'

export function CredencialForm() {
  const { credencialId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(credencialId)

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

  // Tipo/preset del secreto (D-018). Al editar (o crear sin `?tipo=`
  // válido, p. ej. desde la ficha de un equipo) se muestra el formulario
  // completo; los presets solo aplican al crear desde la hoja "Crear".
  const tipoParam = searchParams.get('tipo')
  const tipo: TipoCredencial =
    !esEdicion && (TIPOS_VALIDOS as readonly string[]).includes(tipoParam ?? '')
      ? (tipoParam as TipoCredencial)
      : 'completo'

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
  const categorias = useMemo(
    () => [...new Set((credenciales ?? []).map((c) => c.categoria).filter(Boolean))].sort(),
    [credenciales],
  )

  const [titulo, setTitulo] = useState(tituloContextual)
  const [categoria, setCategoria] = useState(categoriaContextual)
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  // Dirección IP heredada de un secreto de tipo 'equipo' guardado antes
  // de la fase P0 (2026-07-21): ya no se edita como campo nuevo, solo
  // se conserva tal cual hasta que el técnico la quite a mano.
  const [ipHeredada, setIpHeredada] = useState('')
  const [url, setUrl] = useState('')
  const [notas, setNotas] = useState('')
  const [extras, setExtras] = useState<CampoExtra[]>([])
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
  const [motivo, setMotivo] = useState('')
  const [sinDescifrar, setSinDescifrar] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El preset oculta los campos que su tipo no suele tocar; este botón
  // los revela sin perder nada (y siempre al editar, tipo 'completo').
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const visibles = mostrarTodos ? CAMPOS_POR_TIPO.completo : CAMPOS_POR_TIPO[tipo]
  const hayCamposOcultos = tipo !== 'completo' && !mostrarTodos

  useEffect(() => {
    if (!credencial || cargadoInicial) return
    let vigente = true
    setTitulo(credencial.titulo)
    setCategoria(credencial.categoria)
    setVenceEn(credencial.venceEn ?? '')
    setDispositivos(credencial.dispositivos ?? [])
    void descifrarCredencial(credencial.datosCifrados).then((datos) => {
      if (!vigente) return
      if (datos) {
        setUsuario(datos.usuario)
        setContrasena(datos.contrasena)
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

  function actualizarExtra(indice: number, campo: keyof CampoExtra, valor: string) {
    setExtras((actuales) => actuales.map((e, i) => (i === indice ? { ...e, [campo]: valor } : e)))
  }

  function quitarExtra(indice: number) {
    setExtras((actuales) => actuales.filter((_, i) => i !== indice))
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
      const id = credencialId ?? nuevoId()
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
          // El tipo de secreto (grupo P1) se conserva al editar y, al
          // crear, sale del preset. La interfaz completa de tipos llega
          // en la fase P3; aqui solo se guarda para no perder el dato.
          tipo: credencial?.tipo ?? tipoSecretoDePreset(tipo),
          datosCifrados,
          venceEn: venceEn.trim() === '' ? null : venceEn.trim(),
          dispositivos,
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
  const nombreTipo = tipo === 'completo' ? null : NOMBRE_TIPO[tipo]
  // Aviso del pie: error de bloqueo primero, luego validación.
  const aviso = error ?? (intentoGuardar && !valido ? 'Falta el título' : '')
  const avisoEsError = Boolean(error) || (intentoGuardar && !valido)
  const etiquetaContrasena = tipo === 'wifi' ? 'Clave' : 'Contraseña'

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa con blur: cancelar, nota de cifrado y título. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pb-0 pl-2 pr-3">
            <BotonVolver variante="nocturne">Cancelar</BotonVolver>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] text-noct-neutral-500">
              <LockSimple size={13} aria-hidden />
              Se guarda cifrada
            </span>
          </header>
          <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-0.5">
            <div className="min-w-0">
              <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
                {esEdicion ? 'Editar secreto' : 'Nuevo secreto'}
              </h1>
              <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
                Solo el título es obligatorio; el vencimiento y los equipos no se cifran para poder
                avisar sin desbloquear
              </p>
            </div>
            {nombreTipo && <TagNeutral className="mt-1 shrink-0">{nombreTipo}</TagNeutral>}
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
            {/* Identificación: título + categoría. */}
            <section className="flex flex-col gap-3.5">
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

              <div className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Categoría</span>
                <input
                  type="text"
                  list="categorias-boveda"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Redes, Servidores, CCTV..."
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
                <datalist id="categorias-boveda">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </section>

            {/* Secreto: todo lo que viaja cifrado en datosCifrados. El
                preset (D-018) decide qué campos aparecen; "Mostrar todos"
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
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={CLASE_ETIQUETA}>Otros datos protegidos</span>
                    <button
                      type="button"
                      onClick={() => setExtras((actuales) => [...actuales, { clave: '', valor: '' }])}
                      className={`${BTN_GHOST} whitespace-nowrap`}
                    >
                      <Plus size={13} aria-hidden />
                      Campo
                    </button>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-noct-neutral-600">
                    Puerto, PIN, clave WiFi, usuario de respaldo... también van cifrados.
                  </p>

                  {extras.map((campo, indice) => (
                    <div key={indice} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Campo"
                        value={campo.clave}
                        onChange={(e) => actualizarExtra(indice, 'clave', e.target.value)}
                        className={`min-h-[42px] w-[38%] ${CLASE_CAMPO}`}
                      />
                      <input
                        type="text"
                        placeholder="Valor"
                        value={campo.valor}
                        onChange={(e) => actualizarExtra(indice, 'valor', e.target.value)}
                        autoComplete="off"
                        className={`min-h-[42px] flex-1 ${CLASE_CAMPO_MONO}`}
                      />
                      <button
                        type="button"
                        onClick={() => quitarExtra(indice)}
                        aria-label="Quitar este campo"
                        className="flex min-h-11 w-8 shrink-0 items-center justify-center text-noct-neutral-600 hover:text-noct-text"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ))}
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

              <div className="flex flex-col gap-2">
                <span className={CLASE_ETIQUETA}>Equipos con acceso</span>
                <EquiposVinculadosEditor
                  vinculados={dispositivos}
                  dispositivos={dispositivosOrdenados}
                  onVincular={(d) => setDispositivos((actuales) => [...actuales, { id: d.id, nombre: d.nombre }])}
                  onQuitar={(id) => setDispositivos((actuales) => actuales.filter((d) => d.id !== id))}
                />
              </div>

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

function generarContrasena(): string {
  // Sin caracteres que se confunden entre si (O/0, l/1, I).
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$%&*+-=?'
  const valores = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(valores, (v) => caracteres[v % caracteres.length]).join('')
}
