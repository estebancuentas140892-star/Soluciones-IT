import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Conexion, Dispositivo } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { eliminarRegistro } from '../../lib/repositorio'
import { agruparConexiones, type ExtremoConexion } from '../../lib/conexiones'
import { nombreVivo } from '../../lib/referencia'
import { Monitor, Plus, TreeStructure, X } from '../../components/iconos'
import { VALOR_TECNICO_COMPACTO } from '../../components/FilaDato'
import { conOrigen, type EstadoConOrigen } from '../../lib/origenNavegacion'
import { BTN_GHOST, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { FormularioConexion } from './FormularioConexion'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { NodoRed } from './NodoRed'

import { useNodoRed, useRedCargada } from './useNodoRed'

// Topología de un equipo re-autorizada en el sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Topología de Equipo.dc.html).
// Es la vista de topología centrada en UN dispositivo (ruta
// /red/topologia/:dispositivoId): responde de un vistazo "¿de qué
// depende?", "¿qué se cae si falla?" y "¿qué depende de él?", más el
// editor de conexiones.
//
// Desde la tarea 204 (hallazgo M-018) las tres primeras preguntas las
// pinta `NodoRed`, compartido con la pestaña Red, que ahora abre con
// esta misma vecindad: era "la pantalla que Red necesitaba", solo que a
// tres toques. Aquí queda lo que es propio de esta pantalla: la
// identidad del equipo en la barra, el acceso a su ficha y el EDITOR de
// conexiones, que es trabajo de escritorio y no tiene sitio en la raíz
// de una pestaña.
//
// El formulario de "Agregar conexión" es el mismo componente compartido
// que usa ConexionesFicha (hallazgo D1 de AUDITORIA_FLUJOS_TI.md: antes
// eran dos implementaciones casi idénticas ya divergidas), ver
// FormularioConexion.tsx.

export function TopologiaEquipoPage() {
  const { dispositivoId = '' } = useParams()
  const red = useRedCargada()
  const nodo = useNodoRed(dispositivoId, red)
  const [agregando, setAgregando] = useState(false)

  if (red.cargando) {
    return <Chasis modo="documento">{null}</Chasis>
  }

  const equipo = nodo.equipo
  if (!equipo) {
    return (
      <Chasis modo="documento">
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
          <p className="text-[14.5px] font-medium">No se encontró el equipo</p>
          <Link to="/red" className={BTN_SECUNDARIO}>
            Volver a Red
          </Link>
        </main>
      </Chasis>
    )
  }


  // Seguir una conexión rompía el hilo en cada salto: el equipo abierto
  // desde aquí volvía a la LISTA de Red, no a esta topología (hallazgo
  // M-020). Con el origen, el regreso deshace un salto (regla M-R2).
  const origenTopologia = conOrigen(`/red/topologia/${equipo.id}`, 'Topología')

  return (
    // Nivel 2 del chasis (tarea 185): documento. El chasis pone el
    // bloque pegajoso, el retorno y las pestañas; aquí quedan el acceso
    // a la ficha y la identidad del equipo (nombre, estado con punto de
    // color e IP).
    <Chasis
      modo="documento"
      acciones={
        <Link to={`/dispositivos/${equipo.id}`} state={origenTopologia} className={`shrink-0 ${BTN_GHOST}`}>
          <Monitor size={14} aria-hidden />
          Abrir la ficha
        </Link>
      }
      barra={
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-noct-accent/[.14] text-noct-accent-300">
            <TreeStructure size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-medium leading-[1.3]">{equipo.nombre}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-noct-neutral-500">
              <PastillaEstadoDispositivo estado={equipo.estado} />
              {equipo.ip && (
                <>
                  <span className="text-noct-neutral-600">·</span>
                  {/* Piso del dato técnico (M-R5): la IP no baja de 13 px
                      ni de neutral-300. */}
                  <span className={VALOR_TECNICO_COMPACTO}>{equipo.ip}</span>
                </>
              )}
            </p>
          </div>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-16 pt-4">
        {/* Aquí tocar un equipo abre su FICHA, no lo sustituye: esta
            pantalla es un documento sobre un equipo concreto, y quien
            llega a ella viene a mirar ese equipo. Recorrer nodo a nodo
            es lo que hace la pestaña Red. */}
        <NodoRed
          dependeDe={nodo.dependeDe}
          chipsImpacto={nodo.chipsImpacto}
          totalDependientes={nodo.totalDependientes}
          arbol={nodo.arbol}
          nombreCategoria={red.nombreCategoria}
          enlaceANodo={(id) => ({ to: `/dispositivos/${id}`, state: origenTopologia })}
        />

        {/* Conexiones: lista agrupada editable + alta de conexión. */}
        <ConexionesSeccion
          equipo={equipo}
          grupos={nodo.grupos}
          nombrePorId={red.nombrePorId}
          agregando={agregando}
          onToggleAgregar={() => setAgregando((v) => !v)}
          origen={origenTopologia}
        />
      </main>
    </Chasis>
  )
}

function ConexionesSeccion({
  equipo,
  grupos,
  nombrePorId,
  agregando,
  onToggleAgregar,
  origen,
}: {
  equipo: Dispositivo
  grupos: ReturnType<typeof agruparConexiones>
  origen: EstadoConOrigen
  nombrePorId: Map<string, string>
  agregando: boolean
  onToggleAgregar: () => void
}) {
  const listas: { titulo: string; items: ExtremoConexion[] }[] = [
    { titulo: 'Instalado en', items: grupos.instaladoEn },
    { titulo: 'Contiene', items: grupos.contiene },
    { titulo: 'Enlaces', items: grupos.enlaces },
    { titulo: 'Relacionados', items: grupos.relacionados },
  ].filter((g) => g.items.length > 0)

  const total =
    grupos.instaladoEn.length + grupos.contiene.length + grupos.enlaces.length + grupos.relacionados.length

  async function quitar(conexion: Conexion) {
    await eliminarRegistro('conexiones', conexion.id)
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <TituloSeccion>Conexiones</TituloSeccion>
        <button type="button" onClick={onToggleAgregar} className={BTN_GHOST}>
          <Plus size={13} aria-hidden />
          Agregar
        </button>
      </div>

      {agregando && (
        <FormularioConexion
          dispositivo={equipo}
          enlaces={grupos.enlaces}
          variante="topologia"
          onCerrar={onToggleAgregar}
        />
      )}

      {total === 0 && !agregando && (
        <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4 text-center text-sm text-noct-neutral-500">
          Sin conexiones registradas
        </p>
      )}

      {listas.map((grupo) => (
        <div key={grupo.titulo} className="mb-2.5">
          <p className="mb-1 px-0.5 text-[12px] text-noct-neutral-500">{grupo.titulo}</p>
          <div className="flex flex-col gap-1.5">
            {grupo.items.map((extremo) => {
              const nombre = nombreVivo(nombrePorId, extremo.otroId, extremo.otroNombre)
              const detalle = [
                extremo.puertoLocal && `Puerto ${extremo.puertoLocal}`,
                extremo.puertoRemoto && `→ puerto ${extremo.puertoRemoto}`,
                extremo.conexion.medio,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={extremo.conexion.id}
                  className="flex min-h-[50px] items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface py-1.5 pl-3 pr-1.5"
                >
                  <Link to={`/dispositivos/${extremo.otroId}`} state={origen} className="min-w-0 flex-1 text-noct-text">
                    <span className="block truncate text-[13.5px] font-medium leading-[1.3]">{nombre}</span>
                    {(detalle || extremo.conexion.notas) && (
                      <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
                        {detalle || extremo.conexion.notas}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void quitar(extremo.conexion)}
                    aria-label={`Quitar la conexión con ${nombre}`}
                    className="flex min-h-11 w-[38px] shrink-0 items-center justify-center rounded-md text-noct-neutral-600 hover:bg-noct-error/[.08] hover:text-noct-error"
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
