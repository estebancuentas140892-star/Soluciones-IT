import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { Cargando } from '../../components/Cargando'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import { type IconoProps, LockSimple, PlugsConnected } from '../../components/iconos'
import { BTN_PRIMARIO, TituloSeccion } from '../../components/nocturne'
import { db } from '../../lib/db'
import { guardarRegistro, registrarAccesoBoveda } from '../../lib/repositorio'
import { resumenConexion } from '../../lib/conexiones'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { dependenciasDeBaja } from './baja'
import { migrarCampoProtegido, migrarConexion, migrarCredencial } from './reemplazo'

// Migracion de "Reemplazar equipo" (hallazgos L2 y L3 de
// AUDITORIA_FLUJOS_TI.md): tras crear el equipo entrante con
// `?reemplazaA=<id>` (DispositivoForm.tsx), esta pantalla mueve las
// conexiones, credenciales vinculadas y campos protegidos del saliente
// hacia el entrante y lo deja en "De baja". Decision del usuario
// (2026-07-22): se migra TODO junto (vista previa + un solo boton), sin
// excluir items puntuales, a diferencia de "dar de baja" (tarea 133):
// aqui la accion es siempre la misma para cada dependencia. Reutiliza
// `dependenciasDeBaja` (baja.ts) para saber QUE hay que mover; "Volver"
// deja la migracion pendiente sin perder nada (el banner de la ficha del
// equipo entrante trae de vuelta aqui).
export function ReemplazoPage() {
  const { dispositivoId = '' } = useParams()
  const navigate = useNavigate()
  const perfil = usePerfilVivo()

  const nuevo = useLiveQuery(() => db.dispositivos.get(dispositivoId), [dispositivoId])
  const viejo = useLiveQuery(
    () => (nuevo?.reemplazaA ? db.dispositivos.get(nuevo.reemplazaA) : undefined),
    [nuevo?.reemplazaA],
  )
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const camposProtegidos = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )

  const [motivo, setMotivo] = useState('')
  const [migrando, setMigrando] = useState(false)

  const dependencias = useMemo(
    () => (viejo ? dependenciasDeBaja(viejo.id, { conexiones, credenciales, camposProtegidos }) : null),
    [viejo, conexiones, credenciales, camposProtegidos],
  )

  if (nuevo === null) return <Navigate to="/dispositivos" replace />
  if (!nuevo) return <Cargando />
  if (!nuevo.reemplazaA) return <Navigate to={`/dispositivos/${dispositivoId}`} replace />
  if (viejo === undefined) return <Cargando />

  if (viejo === null) {
    return (
      <Pantalla nuevoId={dispositivoId}>
        <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
          El equipo que este reemplaza ya no existe. No hay nada que migrar.
        </p>
      </Pantalla>
    )
  }

  const dep = dependencias!
  const total = dep.conexiones.length + dep.credenciales.length + dep.camposProtegidos.length
  const conBoveda = Boolean(perfil?.puedeVerBoveda)

  async function migrar() {
    if (!viejo) return
    setMigrando(true)
    const nuevoRef = { id: nuevo!.id, nombre: nuevo!.nombre }
    const motivoFinal = motivo.trim() || `Reemplazado por ${nuevo!.nombre}`

    for (const conexion of dep.conexiones) {
      await guardarRegistro('conexiones', migrarConexion(conexion, viejo.id, nuevoRef), motivoFinal)
    }
    for (const credencial of dep.credenciales) {
      await guardarRegistro('credenciales', migrarCredencial(credencial, viejo.id, nuevoRef), motivoFinal)
      await registrarAccesoBoveda({
        credencialId: credencial.id,
        credencialTitulo: credencial.titulo,
        accion: 'modifico',
      })
    }
    for (const campo of dep.camposProtegidos) {
      await guardarRegistro('campos_protegidos', migrarCampoProtegido(campo, nuevo!.id), motivoFinal)
      await registrarAccesoBoveda({
        entidadTipo: 'campo_protegido',
        credencialId: campo.id,
        credencialTitulo: campo.nombre,
        accion: 'modifico',
      })
    }
    await guardarRegistro('dispositivos', { ...viejo, estado: 'De baja' }, motivoFinal)

    setMigrando(false)
    navigate(`/dispositivos/${nuevo!.id}`)
  }

  return (
    <Pantalla nuevoId={dispositivoId} titulo={`Migrar de ${viejo.nombre}`}>
      {total === 0 ? (
        <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
          "{viejo.nombre}" no tiene conexiones, credenciales ni campos protegidos que migrar.
        </p>
      ) : (
        <>
          {dep.conexiones.length > 0 && (
            <Seccion titulo="Conexiones" Icono={PlugsConnected}>
              {dep.conexiones.map((c) => (
                <Fila key={c.id} texto={resumenConexion(c)} />
              ))}
            </Seccion>
          )}
          {conBoveda && dep.credenciales.length > 0 && (
            <Seccion titulo="Credenciales vinculadas" Icono={LockSimple}>
              {dep.credenciales.map((c) => (
                <Fila key={c.id} texto={c.titulo} />
              ))}
            </Seccion>
          )}
          {conBoveda && dep.camposProtegidos.length > 0 && (
            <Seccion titulo="Campos protegidos" Icono={LockSimple}>
              {dep.camposProtegidos.map((c) => (
                <Fila key={c.id} texto={c.nombre} />
              ))}
            </Seccion>
          )}
        </>
      )}

      <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
        <p className="text-[13px] text-noct-neutral-300">
          {total === 0 ? (
            <>
              Se dará de baja a <strong className="text-noct-text">{viejo.nombre}</strong> sin nada más que mover.
            </>
          ) : (
            <>
              Se moverán <strong className="text-noct-text">{total}</strong>{' '}
              {total === 1 ? 'dependencia' : 'dependencias'} a{' '}
              <strong className="text-noct-text">{nuevo.nombre}</strong> y se dará de baja a{' '}
              <strong className="text-noct-text">{viejo.nombre}</strong>.
            </>
          )}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className={CLASE_ETIQUETA}>Motivo (opcional)</span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={`Reemplazado por ${nuevo.nombre}`}
            className={`min-h-11 ${CLASE_CAMPO}`}
          />
        </label>
        <button
          type="button"
          onClick={() => void migrar()}
          disabled={migrando}
          className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
        >
          {migrando ? 'Migrando...' : 'Migrar todo y dar de baja'}
        </button>
      </div>
    </Pantalla>
  )
}

function Pantalla({
  nuevoId,
  titulo = 'Migrar dependencias',
  children,
}: {
  nuevoId: string
  titulo?: string
  children: React.ReactNode
}) {
  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver to={`/dispositivos/${nuevoId}`}>Volver</BotonVolver>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">{titulo}</h1>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-noct-neutral-500">
              Se puede volver más tarde: nada se pierde ni se toca hasta confirmar.
            </p>
          </div>
        </div>
        <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-[18px]">{children}</main>
      </div>
    </div>
  )
}

function Seccion({
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

function Fila({ texto }: { texto: string }) {
  return (
    <div className="rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-[13px] text-noct-text">{texto}</span>
    </div>
  )
}
