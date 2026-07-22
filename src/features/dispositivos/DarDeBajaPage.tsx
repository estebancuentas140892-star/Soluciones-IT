import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import { CheckCircle, type IconoProps, LinkSimple, LockSimple, PlugsConnected, TrashSimple } from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { db, type CampoProtegido, type Conexion, type Credencial } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, registrarAccesoBoveda } from '../../lib/repositorio'
import { resumenConexion } from '../../lib/conexiones'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { dependenciasDeBaja, sinDependencias, sinDispositivo } from './baja'

// "Dar de baja" con cascada (hallazgo L1 de AUDITORIA_FLUJOS_TI.md): hoy
// "De baja" solo fija un color en el estado, y eliminar un equipo hace
// soft-delete de una sola fila sin tocar sus conexiones, sus credenciales
// vinculadas ni sus campos protegidos, que quedan huerfanos. Esta pantalla
// (accesible desde el menu "···" de la ficha) lista esas tres dependencias
// con `dependenciasDeBaja` y deja resolver cada una por separado -
// decision del usuario (2026-07-22): confirmacion item por item, como
// `/boveda/migrar`, nunca archivado automatico - antes de fijar el estado.
// La lista se refresca sola (useLiveQuery) a medida que cada item se
// resuelve, asi que "Confirmar baja" solo se habilita cuando no queda
// ninguna. Ninguna accion de aqui necesita la boveda desbloqueada: mover o
// quitar un vinculo no toca el valor cifrado, solo a quien pertenece.
export function DarDeBajaPage() {
  const { dispositivoId = '' } = useParams()
  const navigate = useNavigate()
  const perfil = usePerfilVivo()

  const dispositivo = useLiveQuery(() => db.dispositivos.get(dispositivoId), [dispositivoId])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const camposProtegidos = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )

  const [motivo, setMotivo] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const dependencias = useMemo(
    () => dependenciasDeBaja(dispositivoId, { conexiones, credenciales, camposProtegidos }),
    [dispositivoId, conexiones, credenciales, camposProtegidos],
  )
  const listo = sinDependencias(dependencias)

  if (dispositivo === null) return <Navigate to="/dispositivos" replace />
  if (!dispositivo) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  const yaDeBaja = dispositivo.estado.trim().toLowerCase() === 'de baja'

  async function confirmarBaja() {
    if (!listo || !dispositivo) return
    setConfirmando(true)
    await guardarRegistro('dispositivos', { ...dispositivo, estado: 'De baja' }, motivo.trim())
    setConfirmando(false)
    navigate(`/dispositivos/${dispositivoId}`)
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver to={`/dispositivos/${dispositivoId}`}>Volver</BotonVolver>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Dar de baja</h1>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-noct-neutral-500">
              {dispositivo.nombre}. Resuelve primero cada conexión, credencial o dato protegido vinculado, para
              no dejar nada huérfano al retirar el equipo.
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-[18px]">
          {yaDeBaja && (
            <p className="rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-[12.5px] text-noct-neutral-400">
              Este equipo ya está marcado como "De baja".
            </p>
          )}

          {dependencias.conexiones.length > 0 && (
            <SeccionDependencia titulo="Conexiones" Icono={PlugsConnected}>
              {dependencias.conexiones.map((c) => (
                <FilaConexion key={c.id} conexion={c} />
              ))}
            </SeccionDependencia>
          )}

          {perfil?.puedeVerBoveda && dependencias.credenciales.length > 0 && (
            <SeccionDependencia titulo="Credenciales vinculadas" Icono={LockSimple}>
              {dependencias.credenciales.map((c) => (
                <FilaCredencial key={c.id} credencial={c} dispositivoId={dispositivoId} />
              ))}
            </SeccionDependencia>
          )}

          {perfil?.puedeVerBoveda && dependencias.camposProtegidos.length > 0 && (
            <SeccionDependencia titulo="Campos protegidos" Icono={LockSimple}>
              {dependencias.camposProtegidos.map((c) => (
                <FilaCampoProtegido key={c.id} campo={c} />
              ))}
            </SeccionDependencia>
          )}

          {listo && (
            <p className="flex items-center gap-2 rounded-md border border-noct-exito/35 bg-noct-exito/[.08] px-3 py-2.5 text-[13px] text-noct-exito">
              <CheckCircle size={16} className="shrink-0" aria-hidden />
              Sin dependencias pendientes. Ya se puede confirmar la baja.
            </p>
          )}

          <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Motivo (opcional)</span>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Fin de vida útil, avería irreparable..."
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>
            <button
              type="button"
              onClick={() => void confirmarBaja()}
              disabled={!listo || confirmando}
              className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
            >
              {confirmando ? 'Confirmando...' : 'Confirmar baja'}
            </button>
            {!listo && (
              <p className="text-[12px] text-noct-neutral-500">
                Resuelve las dependencias de arriba para habilitar este botón.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function SeccionDependencia({
  titulo,
  Icono,
  children,
}: {
  titulo: string
  Icono: (props: IconoProps) => React.JSX.Element
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <TituloSeccion className="flex items-center gap-1.5">
        <Icono size={13} className="shrink-0" aria-hidden />
        {titulo}
      </TituloSeccion>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function FilaConexion({ conexion }: { conexion: Conexion }) {
  const [quitando, setQuitando] = useState(false)

  async function quitar() {
    setQuitando(true)
    await eliminarRegistro('conexiones', conexion.id, 'Equipo dado de baja')
    setQuitando(false)
  }

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-[13px] text-noct-text">{resumenConexion(conexion)}</span>
      <button
        type="button"
        onClick={() => void quitar()}
        disabled={quitando}
        className={`shrink-0 ${BTN_GHOST_PELIGRO} disabled:opacity-50`}
      >
        <TrashSimple size={13} aria-hidden />
        Eliminar
      </button>
    </div>
  )
}

function FilaCredencial({ credencial, dispositivoId }: { credencial: Credencial; dispositivoId: string }) {
  const [ocupado, setOcupado] = useState<'desvincular' | 'eliminar' | null>(null)

  async function desvincular() {
    setOcupado('desvincular')
    await guardarRegistro(
      'credenciales',
      { ...credencial, dispositivos: sinDispositivo(credencial.dispositivos, dispositivoId) },
      'Equipo dado de baja',
    )
    await registrarAccesoBoveda({ credencialId: credencial.id, credencialTitulo: credencial.titulo, accion: 'modifico' })
    setOcupado(null)
  }

  async function eliminar() {
    setOcupado('eliminar')
    await eliminarRegistro('credenciales', credencial.id, 'Equipo dado de baja')
    await registrarAccesoBoveda({ credencialId: credencial.id, credencialTitulo: credencial.titulo, accion: 'elimino' })
    setOcupado(null)
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <span className="truncate text-[13px] font-medium text-noct-text">{credencial.titulo}</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void desvincular()}
          disabled={ocupado !== null}
          className={`${BTN_SECUNDARIO} disabled:opacity-50`}
        >
          <LinkSimple size={13} aria-hidden />
          {ocupado === 'desvincular' ? 'Desvinculando...' : 'Desvincular de este equipo'}
        </button>
        <button
          type="button"
          onClick={() => void eliminar()}
          disabled={ocupado !== null}
          className={`${BTN_GHOST_PELIGRO} disabled:opacity-50`}
        >
          <TrashSimple size={13} aria-hidden />
          {ocupado === 'eliminar' ? 'Eliminando...' : 'Eliminar credencial'}
        </button>
      </div>
    </div>
  )
}

function FilaCampoProtegido({ campo }: { campo: CampoProtegido }) {
  const [ocupado, setOcupado] = useState<'conservar' | 'eliminar' | null>(null)

  async function conservarSinEquipo() {
    setOcupado('conservar')
    await guardarRegistro('campos_protegidos', { ...campo, dispositivoId: null }, 'Equipo dado de baja')
    await registrarAccesoBoveda({
      entidadTipo: 'campo_protegido',
      credencialId: campo.id,
      credencialTitulo: campo.nombre,
      accion: 'modifico',
    })
    setOcupado(null)
  }

  async function eliminar() {
    setOcupado('eliminar')
    await eliminarRegistro('campos_protegidos', campo.id, 'Equipo dado de baja')
    await registrarAccesoBoveda({
      entidadTipo: 'campo_protegido',
      credencialId: campo.id,
      credencialTitulo: campo.nombre,
      accion: 'elimino',
    })
    setOcupado(null)
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <span className="truncate text-[13px] font-medium text-noct-text">{campo.nombre}</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void conservarSinEquipo()}
          disabled={ocupado !== null}
          className={`${BTN_SECUNDARIO} disabled:opacity-50`}
        >
          {ocupado === 'conservar' ? 'Guardando...' : 'Conservar sin equipo'}
        </button>
        <button
          type="button"
          onClick={() => void eliminar()}
          disabled={ocupado !== null}
          className={`${BTN_GHOST_PELIGRO} disabled:opacity-50`}
        >
          <TrashSimple size={13} aria-hidden />
          {ocupado === 'eliminar' ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}
