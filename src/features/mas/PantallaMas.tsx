import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShellNocturne } from '../../app/ShellNocturne'
import { Avatar } from '../../components/Avatar'
import { BarraSuperior } from '../../components/BarraSuperior'
import {
  CaretRight,
  type IconoProps,
  LockSimple,
  MapPin,
  QrCode,
  TreeStructure,
  UploadSimple,
  UsersThree,
  Vault,
} from '../../components/iconos'
import { db, ID_BLOQUEO_APP } from '../../lib/db'
import { useAuth } from '../autenticacion/authContext'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'

// Quinta pestaña (tarea 182, mockup 3f del handoff "Auditoría de
// Soluciones TI"). Puerta de los destinos que hoy no aparecen en la
// barra ni en el sidebar (regla R15): antes un técnico nuevo no podía
// encontrarlos sin que alguien se los mostrara. La Bóveda deja de ser
// pestaña y encabeza el primer grupo (decisión del usuario en
// `Decisiones aprobadas.md`); el resto se agrupa en Herramientas,
// Registros y Mi cuenta.

export function PantallaMas() {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil

  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])
  const bloqueo = useLiveQuery(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) ?? null, [])

  return (
    <ShellNocturne>
      <BarraSuperior titulo="Más" />

      <main className="flex-1 px-4 pb-[116px] pt-4 lg:pb-16">
        <div className="flex flex-col gap-[22px]">
          {usuario?.puedeVerBoveda && (
            <section>
              <TituloGrupo>Consulta protegida</TituloGrupo>
              <FilaDestacada to="/boveda" Icono={Vault} titulo="Bóveda" subtitulo="Claves y credenciales del equipo" />
            </section>
          )}

          <section>
            <TituloGrupo>Herramientas</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Fila
                to="/diagnostico"
                Icono={TreeStructure}
                titulo="Diagnóstico"
                subtitulo="Del síntoma a la guía, paso a paso"
              />
              <Fila to="/escaner" Icono={QrCode} titulo="Escanear equipo" subtitulo="Abre la ficha por código QR" />
            </div>
          </section>

          <section>
            <TituloGrupo>Registros</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Fila
                to="/ubicaciones"
                Icono={MapPin}
                titulo="Ubicaciones"
                subtitulo={`Sedes, salas y racks${ubicaciones ? ` · ${ubicaciones.length}` : ''}`}
              />
              <Fila
                to="/personas"
                Icono={UsersThree}
                titulo="Personas"
                subtitulo={`Responsables de cada equipo${personas ? ` · ${personas.length}` : ''}`}
              />
              <Fila
                to="/dispositivos/etiquetas"
                Icono={QrCode}
                titulo="Etiquetas QR"
                subtitulo="Generar e imprimir etiquetas para el inventario"
              />
              <Fila
                to="/dispositivos/importar"
                Icono={UploadSimple}
                titulo="Importar"
                subtitulo="Carga masiva de equipos desde Excel o CSV"
              />
            </div>
          </section>

          <section>
            <TituloGrupo>Mi cuenta</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Link
                to="/cuenta"
                className="flex min-h-[58px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
              >
                <Avatar
                  nombre={usuario?.nombre}
                  correo={usuario?.correo}
                  className="h-[34px] w-[34px] text-[12px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-[1.3]">
                    {usuario?.nombre || 'Mi cuenta'}
                  </span>
                  {usuario?.correo && (
                    <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-400">
                      {usuario.correo}
                    </span>
                  )}
                </span>
                <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
              </Link>
              <Fila
                to="/cuenta/seguridad"
                Icono={LockSimple}
                titulo="Bloqueo y seguridad"
                subtitulo={
                  bloqueo === undefined
                    ? 'Cargando...'
                    : `${bloqueo?.metodo === 'contrasena' ? 'Contraseña' : 'Patrón'} de este teléfono · ${
                        bloqueo ? 'activo' : 'inactivo'
                      }`
                }
              />
            </div>
          </section>
        </div>
      </main>
    </ShellNocturne>
  )
}

function TituloGrupo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-400">
      {children}
    </h2>
  )
}

function Fila({
  to,
  Icono,
  titulo,
  subtitulo,
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  subtitulo: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[58px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-300">
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-[1.3]">{titulo}</span>
        <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-400">{subtitulo}</span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

// Fila destacada de "Consulta protegida": mismo tratamiento visual que
// la tarjeta de "Diagnóstico en curso" de DiagnosticosPage (acento al
// 35% de borde, 8% de fondo), porque la Bóveda es la única entrada de
// esta pantalla que exige un permiso y merece distinguirse del resto.
function FilaDestacada({
  to,
  Icono,
  titulo,
  subtitulo,
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  subtitulo: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[60px] items-center gap-[13px] rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] p-3 text-noct-text hover:bg-noct-accent/[.13]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-noct-accent/[.16] text-noct-accent-300">
        <Icono size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-[1.3]">{titulo}</span>
        <span className="mt-0.5 block text-[12px] text-noct-neutral-300">{subtitulo}</span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}
