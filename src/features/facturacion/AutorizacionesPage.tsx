import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Plus } from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { FILAS_EN_TARJETA } from '../../components/ventana/estilos'
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
        {/* En el teléfono, el grupo como frase y con cuántas tiene (tarea 345);
            desde la tarea 352, el rótulo y la tarjeta de los grupos de Más. */}
        <TituloSeccion className="max-md:flex max-md:items-baseline max-md:gap-2 max-md:px-1 max-md:pb-1.5 max-md:text-[15px] max-md:font-extrabold max-md:normal-case max-md:tracking-normal max-md:text-noct-neutral-300">
          {titulo}
          <span className="font-mono text-[13px] font-normal text-noct-neutral-500 md:hidden max-md:text-noct-neutral-400">{filas.length}</span>
        </TituloSeccion>
        <ul className={`flex flex-col divide-y divide-noct-divider ${FILAS_EN_TARJETA}`}>
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
          {/* En el teléfono, el título de una pantalla del prototipo «Ventana» (tarea 352). */}
          <h1 className="m-0 text-[22px] font-medium leading-[1.25] max-md:text-[24px] max-md:font-extrabold max-md:leading-[1.2] max-md:tracking-[-.02em]">
            Autorizaciones de facturación
          </h1>
          <p className="mt-[3px] text-[12.5px] text-noct-neutral-500 max-md:mt-1 max-md:text-[14px] max-md:text-noct-neutral-300">
            Prefijos y rangos DIAN de los POS
          </p>
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
