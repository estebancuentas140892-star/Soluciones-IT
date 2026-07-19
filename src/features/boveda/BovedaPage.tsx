import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { ShellNocturne } from '../../app/ShellNocturne'
import {
  Broadcast,
  CaretRight,
  ClockCountdown,
  Cloud,
  HardDrives,
  Key,
  LockSimple,
  MagnifyingGlass,
  Plus,
  Printer,
  Vault,
  VideoCamera,
  Warning,
  WifiHigh,
  XCircleFill,
  type IconoProps,
} from '../../components/iconos'
import { BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { estadoVencimiento, type EstadoVencimiento } from '../../lib/vencimiento'
import {
  bloquear,
  definirMinutosAutobloqueo,
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

export function BovedaPage() {
  const credenciales = useLiveQuery(
    () => db.credenciales.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )

  const [categoria, setCategoria] = useState('')
  const [texto, setTexto] = useState('')
  const [minutos, setMinutos] = useState(obtenerMinutosAutobloqueo)

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

  function cambiarMinutos(valor: number) {
    setMinutos(valor)
    definirMinutosAutobloqueo(valor)
  }

  function quitarFiltros() {
    setCategoria('')
    setTexto('')
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
            <Link to="/boveda/nueva" className={`shrink-0 ${BTN_SECUNDARIO}`}>
              <Plus size={15} aria-hidden />
              Crear
            </Link>
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
                <Link
                  key={c.id}
                  to={`/boveda/${c.id}`}
                  className="flex min-h-[56px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
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
                  <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
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
    </ShellNocturne>
  )
}
