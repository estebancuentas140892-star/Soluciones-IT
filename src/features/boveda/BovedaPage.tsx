import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { ShellNocturne } from '../../app/ShellNocturne'
import {
  ArrowSquareOut,
  Broadcast,
  CaretRight,
  Check,
  ClockCountdown,
  Cloud,
  DotsThreeOutlineVertical,
  Globe,
  HardDrives,
  Key,
  LockSimple,
  MagnifyingGlass,
  Monitor,
  Note,
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
  XCircleFill,
  type IconoProps,
} from '../../components/iconos'
import { BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useGrafo } from '../../components/useGrafo'
import { resumenImpacto } from '../../lib/grafo'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { eliminarRegistro, registrarAccesoBoveda } from '../../lib/repositorio'
import { estadoVencimiento, type EstadoVencimiento } from '../../lib/vencimiento'
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
// inactividad. Trae su propio ShellNocturne (sidebar en escritorio,
// pestañas en móvil), por eso su ruta sale del Layout oscuro heredado.
// La lógica y los datos no cambian: la contraseña maestra descifra
// todo en el propio teléfono (ver BovedaGuard) y nunca sale de él.
//
// Dos hojas inferiores completan el mockup: "Crear" ofrece los cuatro
// atajos de tipo (todos abren el mismo editor) y el menú "···" de cada
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
const REGLAS_ICONO: [RegExp, (props: IconoProps) => React.JSX.Element][] = [
  [/impres/, Printer],
  [/cctv|camara|video|grabador|dvr|nvr|vigilancia/, VideoCamera],
  [/servidor|nas|backup|respaldo|storage|almacen/, HardDrives],
  [/nube|cloud|web|saas|panel|hosting|correo/, Cloud],
  [/router|switch|mikrotik|firewall|enlace/, Broadcast],
  [/red|wifi|wi-fi|internet|lan|vlan/, WifiHigh],
]

function iconoDeCategoria(categoria: string): (props: IconoProps) => React.JSX.Element {
  const n = normalizar(categoria)
  for (const [regla, Icono] of REGLAS_ICONO) if (regla.test(n)) return Icono
  return Key
}

// Orden de severidad para llevar lo que urge rotar al principio de la
// lista (vencida antes que próxima, ambas antes que el resto).
const ORDEN_VENCIMIENTO: Record<string, number> = { vencida: 0, proxima: 1 }
function severidad(estado: EstadoVencimiento): number {
  return estado ? ORDEN_VENCIMIENTO[estado] : 2
}

// Atajos de la hoja "Crear": los cuatro tipos de credencial del handoff.
// Todos abren el mismo editor; el `tipo` viaja en la URL para que, cuando
// se re-autorice el Editor de Credencial (tarea 97), deje listos de una
// vez los campos que ese tipo suele tocar. Hoy el editor lo ignora sin
// romperse: el atajo sigue siendo una entrada guiada válida.
const PRESETS: {
  tipo: string
  nombre: string
  descripcion: string
  Icono: (props: IconoProps) => React.JSX.Element
}[] = [
  {
    tipo: 'equipo',
    nombre: 'Equipo o servicio',
    descripcion: 'Usuario y contraseña de un dispositivo o panel',
    Icono: Monitor,
  },
  { tipo: 'wifi', nombre: 'Red WiFi', descripcion: 'Nombre de la red y clave', Icono: WifiHigh },
  {
    tipo: 'web',
    nombre: 'Cuenta web',
    descripcion: 'Acceso a un servicio en línea, con URL',
    Icono: Globe,
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

  // Grafo de referencias: para avisar, antes de eliminar, qué
  // procedimientos usan esta credencial (mismo aviso que la ficha).
  const grafo = useGrafo()

  // Categorías presentes, con su conteo, para los chips. El conteo va
  // sobre la bóveda completa, no sobre el filtro actual.
  const categorias = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const c of credenciales ?? []) {
      if (!c.categoria) continue
      conteo.set(c.categoria, (conteo.get(c.categoria) ?? 0) + 1)
    }
    return [...conteo.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [credenciales])

  const buscado = normalizar(texto.trim())

  const filtradas = useMemo(() => {
    return (credenciales ?? [])
      .filter((c) => {
        if (categoria && c.categoria !== categoria) return false
        if (!buscado) return true
        const equipos = (c.dispositivos ?? []).map((d) => d.nombre).join(' ')
        return normalizar(`${c.titulo} ${c.categoria ?? ''} ${equipos}`).includes(buscado)
      })
      .map((c) => ({ credencial: c, estado: estadoVencimiento(c.venceEn) }))
      .sort((a, b) => {
        const dif = severidad(a.estado) - severidad(b.estado)
        return dif !== 0 ? dif : a.credencial.titulo.localeCompare(b.credencial.titulo)
      })
  }, [credenciales, categoria, buscado])

  // Credenciales que ya vencieron o están por vencer, sobre el total.
  const porRotar = useMemo(
    () => (credenciales ?? []).filter((c) => estadoVencimiento(c.venceEn) !== null).length,
    [credenciales],
  )

  const buscando = buscado.length > 0
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

  // Copiar usuario o contraseña directo desde el menú de la lista, sin
  // abrir la ficha: descifra al momento (la bóveda ya está desbloqueada)
  // y, si copia, registra en la auditoría quién y cuándo (regla del
  // mockup: "Copiar registra quién y cuándo"). La contraseña nunca se
  // muestra; solo va al portapapeles.
  async function copiar(campo: 'usuario' | 'contrasena') {
    const c = credencialMenu
    if (!c) return
    const datos = await descifrarCredencial(c.datosCifrados)
    if (!datos) {
      setCopiado(null)
      setAvisoCopia('No se pudo descifrar con la contraseña maestra actual.')
      programarResetCopia()
      return
    }
    const valor = campo === 'usuario' ? datos.usuario : datos.contrasena
    if (!valor) {
      setCopiado(null)
      setAvisoCopia(campo === 'usuario' ? 'Sin usuario guardado.' : 'Sin contraseña guardada.')
      programarResetCopia()
      return
    }
    if (!(await copiarAlPortapapeles(valor))) {
      setCopiado(null)
      setAvisoCopia('No se pudo copiar al portapapeles.')
      programarResetCopia()
      return
    }
    void registrarAccesoBoveda({
      credencialId: c.id,
      credencialTitulo: c.titulo,
      accion: campo === 'usuario' ? 'copio_usuario' : 'copio_contrasena',
    })
    setAvisoCopia(null)
    setCopiado(campo)
    programarResetCopia()
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
    <ShellNocturne>
      {/* Cabecera fija con desenfoque: título, acciones, buscador y la
          fila de chips de categoría deslizable. */}
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-start justify-between gap-2 px-4 pb-0.5 pt-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-medium leading-tight">Bóveda</h1>
            <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">
              Usuarios y contraseñas del equipo
            </p>
          </div>
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
          <label
            className={`flex h-11 items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
              buscando ? 'border-noct-accent' : 'border-noct-divider'
            }`}
          >
            <MagnifyingGlass
              size={18}
              className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
              aria-hidden
            />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Título, categoría o equipo"
              aria-label="Buscar credenciales"
              className="bov-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-600"
            />
            {buscando && (
              <button
                type="button"
                onClick={() => setTexto('')}
                aria-label="Borrar búsqueda"
                className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
              >
                <XCircleFill size={18} aria-hidden />
              </button>
            )}
          </label>
        </div>

        {categorias.length > 0 && (
          <div className="flex gap-[7px] overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { valor: '', nombre: 'Todas', count: (credenciales ?? []).length },
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
      </div>

      <main className="flex flex-1 flex-col gap-3 px-4 pb-[116px] pt-3 lg:pb-16">
        {mostrarAviso && (
          <div className="flex items-center gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
            <Warning size={16} className="shrink-0 text-noct-precaucion" aria-hidden />
            <p className="text-[12.5px] leading-relaxed">
              {porRotar === 1
                ? '1 credencial necesita rotarse pronto. Aparece primero en la lista.'
                : `${porRotar} credenciales necesitan rotarse pronto. Aparecen primero en la lista.`}
            </p>
          </div>
        )}

        {hayResultados ? (
          <div className="flex flex-col">
            {filtradas.map(({ credencial: c, estado }) => {
              const Icono = iconoDeCategoria(c.categoria ?? '')
              const equipos = (c.dispositivos ?? []).length
              const detalle = [
                c.categoria || 'Sin categoría',
                equipos > 0 && `${equipos} ${equipos === 1 ? 'equipo' : 'equipos'} con acceso`,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={c.id}
                  className="flex min-h-[56px] items-center rounded transition-colors hover:bg-noct-text/[.05]"
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
                      <p className="truncate text-[12px] text-noct-neutral-500">{detalle}</p>
                    </div>
                    {estado && (
                      <span
                        className={`inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11px] font-medium ${
                          estado === 'vencida'
                            ? 'border-noct-error/40 text-noct-error'
                            : 'border-noct-precaucion/40 text-noct-precaucion'
                        }`}
                      >
                        <ClockCountdown size={12} aria-hidden />
                        {estado === 'vencida' ? 'Vencida' : 'Vence pronto'}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(c.id)
                      setCopiado(null)
                      setAvisoCopia(null)
                    }}
                    aria-label={`Acciones de ${c.titulo}`}
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
              {hayFiltrosActivos ? 'Ninguna credencial coincide.' : 'Aún no hay credenciales guardadas.'}
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

      {/* Hoja "Crear": los cuatro atajos del handoff. Todos abren el
          mismo Editor de Credencial; el tipo solo adelanta el trabajo. */}
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
        descripcion="Esta acción eliminará esta credencial de la bóveda."
        advertencia={
          impactoEliminar ? `${impactoEliminar} Esos pasos quedarán sin la credencial vinculada.` : null
        }
        onCerrar={() => setEliminarId(null)}
        onConfirmar={confirmarEliminar}
      />
    </ShellNocturne>
  )
}
