import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Plus } from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { necesitaRevision } from '../../lib/autorizaciones'
import { db, type AutorizacionFacturacion } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { porUso } from './autorizacion'
import { FilaAutorizacion } from './PresentacionAutorizacion'

// TODAS LAS AUTORIZACIONES DE FACTURACIÓN (tarea 321). La puerta está en
// Más > Inventario. Hace falta además de la ficha de cada POS porque una
// autorización puede no tener POS (Equipos POS documenta PNTE sin
// identificar el equipo): aquí se ve, dicha como "Sin POS asociado", sin
// colgarla de un equipo que la fuente no nombra.
//
// Tres grupos por lo que piden: primero las que piden revisión (por
// validar o en conflicto), después las confirmadas y al final las
// reemplazadas. Dentro de cada uno, por prefijo.

export function AutorizacionesPage() {
  const autorizaciones = useLiveQuery(
    () => db.autorizaciones_facturacion.filter((a) => !a.eliminadoEn).toArray(),
    [],
  )
  const nombres = useLiveQuery(
    async () =>
      new Map(
        (await db.dispositivos.toArray()).filter((d) => !d.eliminadoEn).map((d) => [d.id, d.nombre] as const),
      ),
    [],
  )

  const lista = (autorizaciones ?? []).slice().sort(porUso)
  const revisar = lista.filter(necesitaRevision)
  const confirmadas = lista.filter((a) => a.estado === 'confirmada')
  const reemplazadas = lista.filter((a) => a.estado === 'reemplazada')
  const origen = conOrigen('/facturacion', 'Autorizaciones')

  function posDe(autorizacion: AutorizacionFacturacion): string {
    return (autorizacion.dispositivoIds ?? [])
      .map((id) => nombres?.get(id))
      .filter((n): n is string => Boolean(n))
      .join(', ')
  }

  function grupo(titulo: string, filas: AutorizacionFacturacion[]) {
    if (filas.length === 0) return null
    return (
      <section className="flex flex-col gap-1">
        <TituloSeccion>{titulo}</TituloSeccion>
        <ul className="flex flex-col divide-y divide-noct-divider">
          {filas.map((a) => (
            <li key={a.id}>
              <FilaAutorizacion autorizacion={a} pos={posDe(a)} origen={origen} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <Chasis
      modo="documento"
      acciones={
        <Link to="/facturacion/nueva" state={origen} className={`min-h-11 shrink-0 ${BTN_SECUNDARIO}`}>
          <Plus size={15} aria-hidden />
          Registrar
        </Link>
      }
      barra={
        <div className="px-4 pb-2.5 pt-0.5">
          <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Autorizaciones de facturación</h1>
          <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">Prefijos y rangos DIAN de los POS</p>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-5 px-4 pb-12 pt-3">
        {autorizaciones === undefined ? (
          <p className="text-sm text-noct-neutral-400">Cargando...</p>
        ) : lista.length === 0 ? (
          <p className="text-[13px] text-noct-neutral-500">Ninguna autorización registrada.</p>
        ) : (
          <>
            {grupo('Piden revisión', revisar)}
            {grupo('Confirmadas', confirmadas)}
            {grupo('Reemplazadas', reemplazadas)}
          </>
        )}
      </main>
    </Chasis>
  )
}
