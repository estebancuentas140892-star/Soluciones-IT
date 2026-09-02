import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import {
  ArrowElbowDownRight,
  ArrowSquareOut,
  Broadcast,
  CaretRight,
  Check,
  ClockCountdown,
  Cloud,
  Copy,
  DotsThreeOutlineVertical,
  Globe,
  HardDrives,
  Key,
  LockSimple,
  Note,
  Paperclip,
  PencilSimple,
  Plus,
  Printer,
  TrashSimple,
  User,
  Vault,
  VideoCamera,
  Warning,
  WifiHigh,
  X,
  type IconoProps,
} from '../../components/iconos'
import { BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useGrafo } from '../../components/useGrafo'
import { resumenImpacto } from '../../lib/grafo'
import { iconoPorPalabraClave } from '../../lib/iconoPorPalabraClave'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { eliminarRegistro, registrarAccesoBoveda } from '../../lib/repositorio'
import { descripcionVencida, estadoVencimiento, type EstadoVencimiento } from '../../lib/vencimiento'
import { detectarCandidatos } from './migracionSecretos'
import {
  bloquear,
  definirMinutosAutobloqueo,
  descifrarCredencial,
  obtenerMinutosAutobloqueo,
  OPCIONES_AUTOBLOQUEO_MIN,
} from './sesionBoveda'

// Pantalla Bóveda re-autorizada en el sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Bóveda.dc.html, tarea 97):
// responde "¿cuál es el usuario/contraseña de tal cosa?" con la lista
// de credenciales cifradas del equipo. Es la sección más sensible de
// la app, así que la lista solo expone metadatos (título, categoría,
// equipos con acceso y aviso de vencimiento); el secreto vive cifrado
// y solo se descifra al abrir la ficha. Buscador único (título,
// categoría o equipo), chips de categoría deslizables con conteo
// (incluye "Todas"), aviso de rotación y control de autobloqueo por
// inactividad. Declara nivel de sección en el chasis único (tarea 185),
// que le pone sidebar en escritorio y pestañas en móvil.
// La lógica y los datos no cambian: la contraseña maestra descifra
// todo en el propio teléfono (ver BovedaGuard) y nunca sale de él.
//
// Dos hojas inferiores completan el mockup: "Crear" ofrece los atajos
// de tipo (todos abren el mismo editor) y el menú "···" de cada
// fila permite copiar el usuario o la contraseña sin abrir la ficha
// (descifra al momento y registra el acceso en la auditoría), abrir,
// editar o eliminar (esto último exige la contraseña maestra).

// Normaliza para buscar sin distinguir mayúsculas ni acentos.
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// La bóveda solo guarda la categoría como texto libre (no un icono por
// credencial), así que el icono se deriva de la categoría por palabras
// clave. Cae a la llave genérica cuando ninguna regla coincide: nunca
// queda una fila sin icono.
const REGLAS_ICONO: [RegExp, ComponentType<IconoProps>][] = [
  [/impres/, Printer],
  [/cctv|camara|video|grabador|dvr|nvr|vigilancia/, VideoCamera],
  [/servidor|nas|backup|respaldo|storage|almacen/, HardDrives],
  [/nube|cloud|web|saas|panel|hosting|correo/, Cloud],
  [/router|switch|mikrotik|firewall|enlace/, Broadcast],
  [/red|wifi|wi-fi|internet|lan|vlan/, WifiHigh],
]

function iconoDeCategoria(categoria: string): ComponentType<IconoProps> {
  return iconoPorPalabraClave(normalizar(categoria), REGLAS_ICONO, Key)
}

// Orden de severidad para llevar lo que urge rotar al principio de la
// lista (vencida antes que próxima, ambas antes que el resto).
const ORDEN_VENCIMIENTO: Record<string, number> = { vencida: 0, proxima: 1 }
function severidad(estado: EstadoVencimiento): number {
  return estado ? ORDEN_VENCIMIENTO[estado] : 2
}

// Atajos de la hoja "Crear": los cinco tipos de secreto de la fase P3
// de PROPUESTA_SEGURIDAD_DISPOSITIVO.md (sección 3.2). Todos abren el
// mismo editor; el `tipo` viaja en la URL y de ahí pasa a ser la columna
// guardada (`credenciales.tipo`, grupo P1), ya no solo un preset que
// precarga campos. El preset "Equipo o servicio" se eliminó en la fase
// P0 (2026-07-21): un secreto ya no puede representar un equipo entero
// (eso duplicaba datos que ya viven en la ficha del dispositivo); un
// equipo se sigue pudiendo VINCULAR a un secreto desde "Equipos con
// acceso". "Archivo seguro" (fase P5) cifra el archivo en el propio
// teléfono antes de subirlo a un bucket de Storage propio y privado
// (`archivos_boveda`, RLS de bóveda), distinto del bucket `adjuntos`
// de fotos/manuales que cualquier autenticado puede leer.
const PRESETS: {
  tipo: string
  nombre: string
  descripcion: string
  Icono: (props: IconoProps) => React.JSX.Element
}[] = [
  {
    tipo: 'cuenta',
    nombre: 'Cuenta de sistema',
    descripcion: 'Usuario y contraseña de un servicio o aplicación',
    Icono: Globe,
  },
  { tipo: 'red', nombre: 'Red', descripcion: 'Clave de una red WiFi u otro acceso compartido', Icono: WifiHigh },
  { tipo: 'llave', nombre: 'Llave digital', descripcion: 'Token, licencia o certificado', Icono: Key },
  {
    tipo: 'archivo',
    nombre: 'Archivo seguro',
    descripcion: 'Un archivo cifrado: licencia, certificado, configuración...',
    Icono: Paperclip,
  },
  {
    tipo: 'nota',
    nombre: 'Nota segura',
    descripcion: 'Texto cifrado, sin usuario ni contraseña',
    Icono: Note,
  },
]

// Hoja inferior del sistema Nocturne (mockup Bóveda.dc.html): panel
// pegado al borde inferior sobre un velo, con esquinas superiores
// redondeadas y elevación de menú. Cierra al tocar fuera o con Escape y
// bloquea el desplazamiento del fondo mientras está abierta, igual que
// el `Modal` heredado pero con los tokens Nocturne.
function HojaInferior({
  etiqueta,
  onCerrar,
  children,
}: {
  etiqueta: string
  onCerrar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclado)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [onCerrar])

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-end justify-center bg-noct-neutral-900/50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        onClick={(evento) => evento.stopPropagation()}
        className="box-border flex w-full max-w-[448px] flex-col gap-0.5 rounded-t-[14px] bg-noct-surface px-3 pb-[calc(14px+env(safe-area-inset-bottom))] pt-4 shadow-[0_0_0_1px_#9397ab,0_16px_40px_rgba(0,0,0,0.65)]"
      >
        {children}
      </div>
    </div>
  )
}

export function BovedaPage() {
  const credenciales = useLiveQuery(
    () => db.credenciales.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )
  // Solo para el aviso de migración de abajo: cuenta cuántas cifras
  // podrían ser de un equipo, SIN descifrar nada (detectarCandidatos con
  // un mapa de IPs vacío solo encuentra el motivo 'vinculo', que no
  // necesita abrir la bóveda). El resto del análisis, incluida la
  // coincidencia por IP heredada, vive en la pantalla dedicada.
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const porMigrar = useMemo(
    () => detectarCandidatos(credenciales, dispositivos, new Map()).length,
    [credenciales, dispositivos],
  )

  const [categoria, setCategoria] = useState('')
  const [texto, setTexto] = useState('')
  const [minutos, setMinutos] = useState(obtenerMinutosAutobloqueo)

  // Hojas inferiores del rediseño: la de "Crear" (con presets) y el
  // menú de acciones de una fila. `menuId` guarda la credencial cuyo
  // menú está abierto; `eliminarId`, la que se está por eliminar.
  const [crearAbierto, setCrearAbierto] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  // Feedback del menú al copiar: `copiado` marca el campo recién copiado
  // (icono de tilde, como en el mockup); `avisoCopia` cubre los casos en
  // que no se pudo (sin dato o sin poder descifrar).
  const [copiado, setCopiado] = useState<'usuario' | 'contrasena' | null>(null)
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null)
  const temporizadorCopia = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Copiar la contraseña directo desde la fila (hallazgo M-021): estado
  // independiente del menú, porque aquí no hay una hoja abierta que
  // sostenga el aviso. Se guarda por id de credencial (no un booleano
  // suelto) para que el icono de "copiado" o de error aparezca en la
  // fila correcta y no en la última que se tocó.
  const [filaAccion, setFilaAccion] = useState<{ id: string; ok: boolean; mensaje?: string } | null>(null)
  const temporizadorFila = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Grafo de referencias: para avisar, antes de eliminar, qué
  // procedimientos usan esta credencial (mismo aviso que la ficha).
  const grafo = useGrafo()

  const buscado = normalizar(texto.trim())

  // EL CHIP CUENTA LO QUE VA A DAR (tarea 207, hallazgo M-022). El
  // conteo iba sobre la bóveda completa, así que con el buscador escrito
  // el número prometía resultados que el filtro no podía dar. Ahora va
  // sobre el ALCANCE VISIBLE: lo que deja la búsqueda, sin aplicar el
  // propio eje de categoría, que es lo que el chip decide.
  const alcanceChips = useMemo(() => {
    return (credenciales ?? []).filter((c) => {
      if (!buscado) return true
      const equipos = (c.dispositivos ?? []).map((d) => d.nombre).join(' ')
      return normalizar(`${c.titulo} ${c.categoria ?? ''} ${equipos}`).includes(buscado)
    })
  }, [credenciales, buscado])

  // Categorías presentes, con su conteo, para los chips.
  const categorias = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const c of alcanceChips) {
      if (!c.categoria) continue
      conteo.set(c.categoria, (conteo.get(c.categoria) ?? 0) + 1)
    }
    return [...conteo.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [alcanceChips])

  const filtradas = useMemo(() => {
    return alcanceChips
      .filter((c) => !categoria || c.categoria === categoria)
      .map((c) => ({ credencial: c, estado: estadoVencimiento(c.venceEn) }))
      .sort((a, b) => {
        const dif = severidad(a.estado) - severidad(b.estado)
        return dif !== 0 ? dif : a.credencial.titulo.localeCompare(b.credencial.titulo)
      })
  }, [alcanceChips, categoria])

  // Credenciales que ya vencieron o están por vencer, sobre el total.
  const porRotar = useMemo(
    () => (credenciales ?? []).filter((c) => estadoVencimiento(c.venceEn) !== null).length,
    [credenciales],
  )

  const hayFiltrosActivos = Boolean(categoria || texto)
  const hayResultados = filtradas.length > 0
  // El aviso de rotación solo tiene sentido en la vista completa: al
  // filtrar, la propia lista ya destaca lo urgente arriba.
  const mostrarAviso = !hayFiltrosActivos && porRotar > 0

  // Credencial cuyo menú de acciones está abierto, y la que se está por
  // eliminar. Se buscan en la lista completa (no en la filtrada) para no
  // depender del filtro activo mientras la hoja está abierta.
  const credencialMenu = (credenciales ?? []).find((c) => c.id === menuId) ?? null
  const credencialEliminar = (credenciales ?? []).find((c) => c.id === eliminarId) ?? null
  const impactoEliminar = eliminarId ? resumenImpacto(grafo, 'credencial', eliminarId) : ''

  function cambiarMinutos(valor: number) {
    setMinutos(valor)
    definirMinutosAutobloqueo(valor)
  }

  function quitarFiltros() {
    setCategoria('')
    setTexto('')
  }

  function cerrarMenu() {
    setMenuId(null)
    setCopiado(null)
    setAvisoCopia(null)
    clearTimeout(temporizadorCopia.current)
  }

  function programarResetCopia() {
    clearTimeout(temporizadorCopia.current)
    temporizadorCopia.current = setTimeout(() => {
      setCopiado(null)
      setAvisoCopia(null)
    }, 1400)
  }

  // Descifra y copia un campo de la credencial, registra el acceso en
  // la auditoría (regla del mockup: "Copiar registra quién y cuándo") y
  // devuelve el resultado en vez de tocar estado directamente: la
  // comparten el menú de la fila (`copiar`, con su propio aviso dentro
  // de la hoja) y el botón nuevo en la fila misma (`copiarFila`, sin
  // hoja donde mostrar un mensaje largo). La contraseña nunca se
  // muestra; solo va al portapapeles.
  async function descifrarYCopiar(
    c: (typeof filtradas)[number]['credencial'],
    campo: 'usuario' | 'contrasena',
  ): Promise<{ ok: boolean; mensaje?: string }> {
    const datos = await descifrarCredencial(c.datosCifrados)
    if (!datos) return { ok: false, mensaje: 'No se pudo descifrar con la contraseña maestra actual.' }
    const valor = campo === 'usuario' ? datos.usuario : datos.contrasena
    if (!valor) return { ok: false, mensaje: campo === 'usuario' ? 'Sin usuario guardado.' : 'Sin contraseña guardada.' }
    if (!(await copiarAlPortapapeles(valor))) return { ok: false, mensaje: 'No se pudo copiar al portapapeles.' }
    void registrarAccesoBoveda({
      credencialId: c.id,
      credencialTitulo: c.titulo,
      accion: campo === 'usuario' ? 'copio_usuario' : 'copio_contrasena',
    })
    return { ok: true }
  }

  // Copiar usuario o contraseña desde el menú de la lista, sin abrir la
  // ficha: el aviso (éxito o motivo del fallo) se ve dentro de la hoja.
  async function copiar(campo: 'usuario' | 'contrasena') {
    const c = credencialMenu
    if (!c) return
    const resultado = await descifrarYCopiar(c, campo)
    if (!resultado.ok) {
      setCopiado(null)
      setAvisoCopia(resultado.mensaje ?? null)
      programarResetCopia()
      return
    }
    setAvisoCopia(null)
    setCopiado(campo)
    programarResetCopia()
  }

  // Copiar la CONTRASEÑA directo desde la fila (hallazgo M-021, mockup
  // `9b`): es el gesto real y frecuente ("copiar la clave del switch"),
  // y hasta ahora exigía abrir el menú "···" y una hoja inferior para
  // el 80 % de las visitas a la sección. El usuario y el resto de
  // acciones (abrir, editar, eliminar) se quedan en el menú: copiar la
  // contraseña es el único gesto frecuente a diario, no todos lo son.
  async function copiarFila(c: (typeof filtradas)[number]['credencial']) {
    const resultado = await descifrarYCopiar(c, 'contrasena')
    clearTimeout(temporizadorFila.current)
    setFilaAccion({ id: c.id, ok: resultado.ok, mensaje: resultado.mensaje })
    temporizadorFila.current = setTimeout(() => setFilaAccion(null), 1400)
  }

  function pedirEliminar() {
    if (!menuId) return
    setEliminarId(menuId)
    cerrarMenu()
  }

  async function confirmarEliminar() {
    const c = credencialEliminar
    if (!c) return
    await registrarAccesoBoveda({
      credencialId: c.id,
      credencialTitulo: c.titulo,
      accion: 'elimino',
    })
    await eliminarRegistro('credenciales', c.id)
    setEliminarId(null)
    // La lista se refresca sola por useLiveQuery.
  }

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila. El título, el
    // estado del dato, buscar y la cuenta los aporta el chasis (tarea
    // 181); en `barra` quedan las acciones propias de la sección, el
    // buscador y la fila de chips de categoría deslizable.
    // `conLupa={false}` (regla M-R8, "un buscador por pantalla", tarea
    // 207): esta pantalla ya tiene su propio campo con el alcance
    // escrito, así que la lupa de la barra superior sería el segundo
    // buscador de la misma pantalla y con otro alcance. La duda que
    // midió la auditoría era exactamente esa: "¿esto busca en todo o
    // solo aquí?". Buscar en todo sigue a un toque, desde Inicio.
    <Chasis titulo="Bóveda" conLupa={false} barra={
      <>
        <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-1">
          <p className="min-w-0 truncate text-[12.5px] text-noct-neutral-400">
            Usuarios y contraseñas del equipo
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={bloquear}
              aria-label="Bloquear la bóveda ahora"
              title="Bloquear ahora"
              className={BTN_ICONO_SECUNDARIO}
            >
              <LockSimple size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCrearAbierto(true)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <Plus size={15} aria-hidden />
              Crear
            </button>
          </div>
        </header>

        <div className="px-4 pb-2.5 pt-2.5">
          <CampoBusqueda
            valor={texto}
            onCambiar={setTexto}
            alcance="la Bóveda"
          />
        </div>

        {categorias.length > 0 && (
          <div className="flex gap-[7px] overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { valor: '', nombre: 'Todas', count: alcanceChips.length },
              ...categorias.map(([nombre, count]) => ({ valor: nombre, nombre, count })),
            ].map((chip) => {
              const activa = chip.valor === categoria
              return (
                <button
                  key={chip.valor || '__todas'}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setCategoria((v) => (v === chip.valor ? '' : chip.valor))}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                    activa
                      ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                  }`}
                >
                  {chip.nombre}
                  <span
                    className={`text-[11px] ${activa ? 'text-noct-accent-400' : 'text-noct-neutral-600'}`}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </>
    }>
      <main className="flex flex-1 flex-col gap-3 px-4 pb-16 pt-3">
        {mostrarAviso && (
          <div className="flex items-center gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
            <Warning size={16} className="shrink-0 text-noct-precaucion" aria-hidden />
            <p className="text-[12.5px] leading-relaxed">
              {porRotar === 1
                ? '1 secreto necesita rotarse pronto. Aparece primero en la lista.'
                : `${porRotar} secretos necesitan rotarse pronto. Aparecen primero en la lista.`}
            </p>
          </div>
        )}

        {/* Migración asistida (fase P4): aviso barato (sin descifrar
            nada) de que hay secretos que probablemente son de un equipo.
            El análisis completo, incluida la coincidencia por IP, vive
            en /boveda/migrar. */}
        {porMigrar > 0 && !hayFiltrosActivos && (
          <Link
            to="/boveda/migrar"
            className="flex w-full items-center gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-left text-noct-text"
          >
            <ArrowElbowDownRight size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
            <span className="min-w-0 flex-1 text-[13px] leading-[1.45]">
              {porMigrar} {porMigrar === 1 ? 'secreto parece ser' : 'secretos parecen ser'} de un solo
              equipo. Muévelos a su ficha.
            </span>
            <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
          </Link>
        )}

        {hayResultados ? (
          <div className="flex flex-col">
            {filtradas.map(({ credencial: c, estado }) => {
              const Icono = iconoDeCategoria(c.categoria ?? '')
              const equipos = (c.dispositivos ?? []).length
              // La fila vencida ya sube al principio de la lista
              // (`severidad`, sin cambios). Lo que cambia (M-021) es que
              // deja de decir solo "Vencida" y dice CUÁNTO hace: no es
              // lo mismo venció ayer que hace medio año. La pastilla de
              // la derecha desaparece para esa fila; la duración toma su
              // sitio en la segunda línea, que es donde ya se leía la
              // categoría.
              const detalle =
                estado === 'vencida' && c.venceEn
                  ? [descripcionVencida(c.venceEn), c.categoria || 'Sin categoría'].join(' · ')
                  : [
                      c.categoria || 'Sin categoría',
                      equipos > 0 && `${equipos} ${equipos === 1 ? 'equipo' : 'equipos'} con acceso`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
              const accionFila = filaAccion?.id === c.id ? filaAccion : null
              return (
                <div
                  key={c.id}
                  className="flex min-h-[56px] items-center gap-2 rounded transition-colors hover:bg-noct-text/[.05]"
                >
                  <Link
                    to={`/boveda/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-[13px] py-[11px] pl-2 text-noct-text"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400">
                      <Icono size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-[1.3]">{c.titulo}</p>
                      <p
                        className={`truncate text-[12px] ${estado === 'vencida' ? 'text-noct-error' : 'text-noct-neutral-500'}`}
                      >
                        {estado === 'vencida' && <ClockCountdown size={11} className="mr-1 inline-block align-[-1px]" aria-hidden />}
                        {detalle}
                      </p>
                    </div>
                    {estado === 'proxima' && (
                      <span className="inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border border-noct-precaucion/40 px-[9px] py-[3px] text-[11px] font-medium text-noct-precaucion">
                        <ClockCountdown size={12} aria-hidden />
                        Vence pronto
                      </span>
                    )}
                  </Link>
                  {/* Copiar la contraseña sin abrir el menú (M-021): el
                      gesto real y frecuente del técnico en el sitio.
                      44 px, separado 8 px de la fila enlazada (M-R14):
                      no va DENTRO del enlace para no anidar un control
                      dentro de otro. */}
                  <button
                    type="button"
                    onClick={() => void copiarFila(c)}
                    aria-label={
                      accionFila && !accionFila.ok
                        ? (accionFila.mensaje ?? `No se pudo copiar la contraseña de ${c.titulo}`)
                        : `Copiar la contraseña de ${c.titulo}`
                    }
                    title="Copiar contraseña"
                    className="flex min-h-[56px] w-11 shrink-0 items-center justify-center rounded text-noct-neutral-500 hover:text-noct-accent-300"
                  >
                    {accionFila?.ok ? (
                      <Check size={17} className="text-noct-exito" aria-hidden />
                    ) : accionFila && !accionFila.ok ? (
                      <Warning size={17} className="text-noct-error" aria-hidden />
                    ) : (
                      <Copy size={17} aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(c.id)
                      setCopiado(null)
                      setAvisoCopia(null)
                    }}
                    aria-label={`Más acciones de ${c.titulo}`}
                    className="flex min-h-[56px] w-11 shrink-0 items-center justify-center rounded text-noct-neutral-500 hover:text-noct-text"
                  >
                    <DotsThreeOutlineVertical size={16} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
            <Vault size={30} className="text-noct-neutral-600" aria-hidden />
            <p className="text-[13px] leading-relaxed text-noct-neutral-400">
              {hayFiltrosActivos ? 'Ningún secreto coincide.' : 'Aún no hay secretos guardados.'}
            </p>
            {hayFiltrosActivos && (
              <button type="button" onClick={quitarFiltros} className={BTN_SECUNDARIO}>
                Quitar filtros
              </button>
            )}
          </div>
        )}

        {/* Autobloqueo por inactividad: mismo ajuste local que ya existía,
            re-autorizado como chips en el pie de la lista. */}
        <div className="flex items-center justify-between gap-2.5 px-0.5 pt-1">
          <span className="text-[12px] text-noct-neutral-600">Autobloqueo por inactividad</span>
          <div className="flex gap-[5px]">
            {OPCIONES_AUTOBLOQUEO_MIN.map((m) => {
              const activo = minutos === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiarMinutos(m)}
                  className={`inline-flex h-8 items-center rounded-full border px-2.5 text-[12px] transition-colors ${
                    activo
                      ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-500 hover:bg-noct-text/[.05]'
                  }`}
                >
                  {m} min
                </button>
              )
            })}
          </div>
        </div>
      </main>

      {/* Hoja "Crear": los atajos de tipo de secreto. Todos abren el
          mismo editor; el tipo solo adelanta el trabajo. */}
      {crearAbierto && (
        <HojaInferior etiqueta="Guardar en la bóveda" onCerrar={() => setCrearAbierto(false)}>
          <div className="flex items-center justify-between gap-2.5 px-1.5 pb-2.5">
            <p className="text-[15px] font-medium">Guardar en la bóveda</p>
            <button
              type="button"
              onClick={() => setCrearAbierto(false)}
              aria-label="Cerrar"
              className="flex p-1.5 text-noct-neutral-400 hover:text-noct-text"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {PRESETS.map(({ tipo, nombre, descripcion, Icono }) => (
            <Link
              key={tipo}
              to={`/boveda/nueva?tipo=${tipo}`}
              className="flex min-h-[56px] items-center gap-[13px] rounded-md px-1.5 py-2 text-noct-text hover:bg-noct-text/[.05]"
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md bg-noct-accent/[.12] text-noct-accent-300">
                <Icono size={19} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-[1.3]">{nombre}</p>
                <p className="mt-0.5 text-[12px] leading-[1.4] text-noct-neutral-500">
                  {descripcion}
                </p>
              </div>
              <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
            </Link>
          ))}
          <p className="mx-1.5 mt-1.5 text-[11.5px] leading-relaxed text-noct-neutral-600">
            Todos usan el mismo editor; el tipo solo deja listos los campos que tocan.
          </p>
        </HojaInferior>
      )}

      {/* Menú de acciones de una fila: copiar sin abrir la ficha (con
          auditoría), abrir, editar o eliminar (con contraseña maestra). */}
      {credencialMenu && (
        <HojaInferior
          etiqueta={`Acciones de ${credencialMenu.titulo}`}
          onCerrar={cerrarMenu}
        >
          <div className="flex items-center justify-between gap-2.5 px-1.5 pb-1.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium leading-[1.3]">
                {credencialMenu.titulo}
              </p>
              <p
                className={`mt-0.5 text-[11.5px] ${avisoCopia ? 'text-noct-precaucion' : 'text-noct-neutral-600'}`}
              >
                {avisoCopia ?? 'Copiar registra quién y cuándo'}
              </p>
            </div>
            <button
              type="button"
              onClick={cerrarMenu}
              aria-label="Cerrar"
              className="flex shrink-0 p-1.5 text-noct-neutral-400 hover:text-noct-text"
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void copiar('usuario')}
            className="flex min-h-[50px] w-full items-center gap-[13px] rounded-md p-1.5 text-left text-noct-text hover:bg-noct-text/[.05]"
          >
            {copiado === 'usuario' ? (
              <Check size={18} className="w-[26px] shrink-0 text-center text-noct-exito" aria-hidden />
            ) : (
              <User size={18} className="w-[26px] shrink-0 text-center text-noct-neutral-400" aria-hidden />
            )}
            <span className="flex-1 text-sm font-medium">Copiar usuario</span>
          </button>

          <button
            type="button"
            onClick={() => void copiar('contrasena')}
            className="flex min-h-[50px] w-full items-center gap-[13px] rounded-md p-1.5 text-left text-noct-text hover:bg-noct-text/[.05]"
          >
            {copiado === 'contrasena' ? (
              <Check size={18} className="w-[26px] shrink-0 text-center text-noct-exito" aria-hidden />
            ) : (
              <Key size={18} className="w-[26px] shrink-0 text-center text-noct-neutral-400" aria-hidden />
            )}
            <span className="flex-1 text-sm font-medium">Copiar contraseña</span>
            <span className="text-[11.5px] text-noct-neutral-600">sin mostrarla</span>
          </button>

          <Link
            to={`/boveda/${credencialMenu.id}`}
            className="flex min-h-[50px] items-center gap-[13px] rounded-md p-1.5 text-noct-text hover:bg-noct-text/[.05]"
          >
            <ArrowSquareOut size={18} className="w-[26px] shrink-0 text-center text-noct-neutral-400" aria-hidden />
            <span className="flex-1 text-sm font-medium">Abrir la ficha</span>
          </Link>

          <Link
            to={`/boveda/${credencialMenu.id}/editar`}
            className="flex min-h-[50px] items-center gap-[13px] rounded-md p-1.5 text-noct-text hover:bg-noct-text/[.05]"
          >
            <PencilSimple size={18} className="w-[26px] shrink-0 text-center text-noct-neutral-400" aria-hidden />
            <span className="flex-1 text-sm font-medium">Editar</span>
          </Link>

          <button
            type="button"
            onClick={pedirEliminar}
            className="flex min-h-[50px] w-full items-center gap-[13px] rounded-md p-1.5 text-left text-noct-error hover:bg-noct-error/[.08]"
          >
            <TrashSimple size={18} className="w-[26px] shrink-0 text-center" aria-hidden />
            <span className="flex-1 text-sm font-medium">Eliminar</span>
            <span className="text-[11.5px] text-noct-neutral-600">pide la contraseña maestra</span>
          </button>
        </HojaInferior>
      )}

      <DialogoEliminar
        abierto={Boolean(credencialEliminar)}
        sensible
        titulo={`¿Eliminar "${credencialEliminar?.titulo ?? ''}"?`}
        descripcion="Esta acción eliminará este secreto de la bóveda."
        advertencia={
          impactoEliminar ? `${impactoEliminar} Esos pasos quedarán sin el secreto vinculado.` : null
        }
        onCerrar={() => setEliminarId(null)}
        onConfirmar={confirmarEliminar}
      />
    </Chasis>
  )
}
