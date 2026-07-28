import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import {
  ChartBar,
  CheckCircle,
  Clock,
  ListPlus,
  WarningCircle,
  Wrench,
  type IconoProps,
} from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { ETIQUETA_MOTIVO } from './motivos'
import {
  formatearDuracion,
  formatearPorcentaje,
  motivosDeFallo,
  problemasMasFrecuentes,
  procedimientosMasUsados,
  resumirEjecuciones,
} from './estadisticas'

// Tablero de estadisticas del Modo Diagnostico (F3 de
// PROPUESTA_MODULOS.md): explota `ejecuciones_diagnostico`, una tabla
// que el equipo lleva alimentando desde la tarea 46 sin que nada la
// leyera para agregar. Mismo shell centrado "alcanzado desde Inicio o
// desde Diagnostico" que SugerenciasEquipoPage. Sin paginacion ni
// filtros por fecha: con el volumen de un equipo de 5 tecnicos, traer
// todo a memoria y agregar en el cliente es instantaneo (mismo criterio
// que actividadEquipo.ts).
export function EstadisticasPage() {
  const ejecuciones = useLiveQuery(() => db.ejecuciones_diagnostico.toArray(), [], [])
  // Para resolver, si existe, el titulo VIVO del diagnostico (una
  // ejecucion solo guarda la copia congelada de cuando ocurrio).
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])

  const cargando = ejecuciones === undefined

  const resumen = resumirEjecuciones(ejecuciones ?? [])
  const problemas = problemasMasFrecuentes(ejecuciones ?? [])
  const procedimientos = procedimientosMasUsados(ejecuciones ?? [])
  const motivos = motivosDeFallo(ejecuciones ?? [])

  // Solo importa si el diagnostico/articulo TODAVIA existe (para decidir
  // si la fila es un enlace o texto plano): la ruta de un diagnostico es
  // siempre /diagnostico/<id>, no hace falta resolver mas datos.
  const idsDiagnosticoVivos = new Set((diagnosticos ?? []).map((d) => d.id))
  const rutaArticulo = new Map((articulos ?? []).map((a) => [a.id, `/soluciones/${a.categoriaId}/${a.id}`]))

  const sinDatos = !cargando && resumen.total === 0

  return (
    // Nivel 2 del chasis (tarea 185): documento.
    <Chasis
      modo="documento"
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <h1 className="text-[22px] font-medium leading-[1.25]">Estadísticas de diagnóstico</h1>
          <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
            Qué se diagnostica de verdad y qué tan bien resuelve la base
          </p>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-6 px-4 pb-10 pt-4">
        {cargando && <p className="text-sm text-noct-neutral-400">Cargando...</p>}

        {sinDatos && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
            <ChartBar size={30} className="text-noct-neutral-600" aria-hidden />
            <p className="text-[13px] leading-relaxed text-noct-neutral-400">
              Todavía no hay diagnósticos ejecutados. Las estadísticas aparecen aquí en cuanto el
              equipo empiece a usar el Modo Diagnóstico.
            </p>
          </div>
        )}

        {!cargando && !sinDatos && (
          <>
            {/* Resumen: los 4 números que responden "¿como va el modo
                diagnostico?" de un vistazo. */}
            <section className="grid grid-cols-2 gap-2.5">
              <Tarjeta
                Icono={ChartBar}
                etiqueta="Ejecuciones"
                valor={String(resumen.total)}
              />
              <Tarjeta
                Icono={CheckCircle}
                etiqueta="Tasa de éxito"
                valor={resumen.tasaExito == null ? '—' : formatearPorcentaje(resumen.tasaExito)}
                ayuda="sobre las cerradas"
              />
              <Tarjeta
                Icono={Clock}
                etiqueta="Duración típica"
                valor={
                  resumen.duracionMedianaSegundos == null
                    ? '—'
                    : formatearDuracion(resumen.duracionMedianaSegundos)
                }
                ayuda="cuando se resuelve"
              />
              <Tarjeta
                Icono={WarningCircle}
                etiqueta="Abandonados"
                valor={String(resumen.abandonadas)}
              />
            </section>

            {problemas.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <WarningCircle size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Problemas más frecuentes</TituloSeccion>
                </div>
                <div className="flex flex-col overflow-hidden rounded-lg border border-noct-divider">
                  {problemas.map((fila) => {
                    const ruta = idsDiagnosticoVivos.has(fila.diagnosticoId)
                      ? fila.diagnosticoId
                      : null
                    const contenido = (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                          {fila.titulo || '(sin título)'}
                        </span>
                        <span className="shrink-0 text-[12px] text-noct-neutral-500">
                          {fila.ejecuciones === 1 ? '1 vez' : `${fila.ejecuciones} veces`}
                        </span>
                        <span className="w-12 shrink-0 text-right text-[12px] text-noct-neutral-500">
                          {fila.tasaExito == null ? '—' : formatearPorcentaje(fila.tasaExito)}
                        </span>
                      </>
                    )
                    return ruta ? (
                      <Link
                        key={fila.diagnosticoId}
                        to={`/diagnostico/${ruta}`}
                        className="flex items-center gap-2.5 border-b border-noct-divider px-3.5 py-2.5 last:border-b-0 hover:bg-noct-text/[.05]"
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <div
                        key={fila.diagnosticoId}
                        className="flex items-center gap-2.5 border-b border-noct-divider px-3.5 py-2.5 text-noct-neutral-500 last:border-b-0"
                      >
                        {contenido}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {procedimientos.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <Wrench size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Procedimientos más usados</TituloSeccion>
                </div>
                <div className="flex flex-col overflow-hidden rounded-lg border border-noct-divider">
                  {procedimientos.map((fila) => {
                    const ruta = rutaArticulo.get(fila.articuloId)
                    const contenido = (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                          {fila.titulo || '(sin título)'}
                        </span>
                        <span className="shrink-0 text-[12px] text-noct-neutral-500">
                          {fila.ejecuciones === 1 ? '1 vez' : `${fila.ejecuciones} veces`}
                        </span>
                      </>
                    )
                    return ruta ? (
                      <Link
                        key={fila.articuloId}
                        to={ruta}
                        className="flex items-center gap-2.5 border-b border-noct-divider px-3.5 py-2.5 last:border-b-0 hover:bg-noct-text/[.05]"
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <div
                        key={fila.articuloId}
                        className="flex items-center gap-2.5 border-b border-noct-divider px-3.5 py-2.5 text-noct-neutral-500 last:border-b-0"
                      >
                        {contenido}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {motivos.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <ListPlus size={14} className="text-noct-neutral-400" aria-hidden />
                  <TituloSeccion>Por qué no queda resuelto</TituloSeccion>
                </div>
                <div className="flex flex-col overflow-hidden rounded-lg border border-noct-divider">
                  {motivos.map((fila) => (
                    <div
                      key={fila.motivo}
                      className="flex items-center gap-2.5 border-b border-noct-divider px-3.5 py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {ETIQUETA_MOTIVO[fila.motivo]}
                      </span>
                      <span className="shrink-0 text-[12px] text-noct-neutral-500">
                        {fila.veces === 1 ? '1 vez' : `${fila.veces} veces`}
                      </span>
                    </div>
                  ))}
                </div>
                {motivos.some((m) => m.motivo === 'encontro_otra_solucion') && (
                  <Link
                    to="/diagnostico/sugerencias"
                    className="mt-2 inline-block text-[12px] text-noct-accent-300 underline-offset-2 hover:underline"
                  >
                    Ver las sugerencias del equipo
                  </Link>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </Chasis>
  )
}

function Tarjeta({
  Icono,
  etiqueta,
  valor,
  ayuda,
}: {
  Icono: (props: IconoProps) => React.JSX.Element
  etiqueta: string
  valor: string
  ayuda?: string
}) {
  return (
    <div className="rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3">
      <Icono size={16} className="text-noct-neutral-500" aria-hidden />
      <p className="mt-2 text-[20px] font-medium leading-[1.2]">{valor}</p>
      <p className="mt-0.5 text-[12px] text-noct-neutral-500">
        {etiqueta}
        {ayuda ? ` · ${ayuda}` : ''}
      </p>
    </div>
  )
}
