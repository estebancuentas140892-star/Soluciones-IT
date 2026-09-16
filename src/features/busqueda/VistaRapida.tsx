import { useLiveQuery } from 'dexie-react-hooks'
import { FilaDato } from '../../components/FilaDato'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { WarningCircle } from '../../components/iconos'
import { db } from '../../lib/db'
import { textoVivo } from '../../lib/referencia'
import { ContenidoReferencia } from '../referencia/ContenidoReferencia'
import { TarjetaComando } from '../referencia/TarjetaComando'
import { esTipoConocido } from '../referencia/referencias'
import { idDeEntidad, useContextoResultados } from './contextoResultados'
import { vistaRapidaDe } from './modoConsulta'
import { PanelVistaRapida } from './PanelVistaRapida'
import type { ResultadoBusqueda } from './useIndiceBusqueda'
import { VistaRapidaCredencial } from './VistaRapidaCredencial'

// LA VISTA RÁPIDA DE CADA TIPO DE RESULTADO (encargo del 2026-09-16,
// secciones 2 y 9). Qué tipo tiene vista y en qué modo lo decide
// `vistaRapidaDe`; aquí solo se elige qué se pinta.
//
// Ninguna de estas vistas navega. Reutilizan lo que ya se enseña dentro
// de una guía (la tarjeta de un comando, el cuerpo de la hoja de una
// ficha del Centro de consulta) para que la misma información no diga dos
// cosas distintas según desde dónde se consulte.

export function VistaRapidaResultado({
  resultado,
  idPanel,
  desdeMejores,
  onCerrar,
}: {
  resultado: ResultadoBusqueda
  idPanel: string
  desdeMejores: boolean
  onCerrar: () => void
}) {
  const { modo } = useContextoResultados()
  const id = idDeEntidad(resultado.id)

  switch (vistaRapidaDe(resultado, modo)) {
    case 'credencial':
      return (
        <VistaRapidaCredencial credencialId={id} idPanel={idPanel} desdeMejores={desdeMejores} onCerrar={onCerrar} />
      )
    case 'comando':
    case 'referencia':
      return <VistaReferencia referenciaId={id} titulo={resultado.titulo} idPanel={idPanel} onCerrar={onCerrar} />
    case 'equipo':
      return <VistaEquipo dispositivoId={id} titulo={resultado.titulo} idPanel={idPanel} onCerrar={onCerrar} />
    default:
      return null
  }
}

// Un comando o un atajo se ve con la MISMA tarjeta que dentro de una
// tarea (lo que se teclea, a 15 px, con su copia si es un comando); un
// término o una herramienta, con el mismo cuerpo que la hoja que se abre
// desde una guía.
function VistaReferencia({
  referenciaId,
  titulo,
  idPanel,
  onCerrar,
}: {
  referenciaId: string
  titulo: string
  idPanel: string
  onCerrar: () => void
}) {
  // undefined: cargando; null: no está en este dispositivo.
  const referencia = useLiveQuery(
    async () => {
      const fila = await db.referencias.get(referenciaId)
      return fila && !fila.eliminadoEn && esTipoConocido(fila.tipo) ? fila : null
    },
    [referenciaId],
  )
  if (referencia === undefined) return null

  return (
    <PanelVistaRapida idPanel={idPanel} titulo={titulo} onCerrar={onCerrar}>
      {referencia === null ? (
        <NoDisponible />
      ) : referencia.tipo === 'comando' || referencia.tipo === 'atajo' ? (
        <TarjetaComando referencia={referencia} tituloRespaldo={titulo} />
      ) : (
        <ContenidoReferencia referencia={referencia} />
      )}
    </PanelVistaRapida>
  )
}

// Lo esencial de un equipo, con los datos que ya están en este teléfono:
// nombre, ubicación, marca y modelo, estado e IP. La IP de un equipo no
// es un dato protegido (se ve y se copia en su ficha); los datos
// protegidos del equipo NO se enseñan aquí.
function VistaEquipo({
  dispositivoId,
  titulo,
  idPanel,
  onCerrar,
}: {
  dispositivoId: string
  titulo: string
  idPanel: string
  onCerrar: () => void
}) {
  const equipo = useLiveQuery(
    async () => {
      const dispositivo = await db.dispositivos.get(dispositivoId)
      if (!dispositivo || dispositivo.eliminadoEn) return null
      // Referencia viva: el nombre actual de la ubicación y, si la fila
      // aún no llegó, la copia guardada en el equipo.
      const ubicacion = dispositivo.ubicacionId ? await db.ubicaciones.get(dispositivo.ubicacionId) : undefined
      return {
        dispositivo,
        ubicacion: textoVivo(ubicacion && !ubicacion.eliminadoEn ? ubicacion.nombre : null, dispositivo.ubicacion),
      }
    },
    [dispositivoId],
  )
  if (equipo === undefined) return null

  const marcaModelo = equipo ? [equipo.dispositivo.marca, equipo.dispositivo.modelo].filter(Boolean).join(' · ') : ''

  return (
    <PanelVistaRapida idPanel={idPanel} titulo={titulo} onCerrar={onCerrar}>
      {equipo === null ? (
        <NoDisponible />
      ) : (
        <div className="@container flex flex-col divide-y divide-noct-divider rounded-md border border-noct-divider bg-noct-surface px-3">
          <FilaDato etiqueta="Equipo" valor={equipo.dispositivo.nombre} />
          {equipo.ubicacion && <FilaDato etiqueta="Ubicación" valor={equipo.ubicacion} />}
          {marcaModelo && <FilaDato etiqueta="Marca y modelo" valor={marcaModelo} />}
          {equipo.dispositivo.estado && (
            <FilaDato etiqueta="Estado">
              <PastillaEstadoDispositivo estado={equipo.dispositivo.estado} />
            </FilaDato>
          )}
          {equipo.dispositivo.ip && (
            <FilaDato etiqueta="Dirección IP" valor={equipo.dispositivo.ip} tecnico copiable={equipo.dispositivo.ip} />
          )}
        </div>
      )}
    </PanelVistaRapida>
  )
}

function NoDisponible() {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-normal text-noct-neutral-400">
      <WarningCircle size={16} className="mt-px shrink-0" aria-hidden />
      No está disponible en este dispositivo. Puede haberse eliminado o no haber llegado todavía.
    </p>
  )
}
