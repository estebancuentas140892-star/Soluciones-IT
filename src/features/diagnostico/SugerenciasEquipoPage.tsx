import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { BotonVolver } from '../../components/BotonVolver'
import { Check, Lightbulb, Plus } from '../../components/iconos'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

// Vista simple de las propuestas del equipo (fase D3), re-autorizada al
// sistema Nocturne (tarea 97, sin mockup: se traduce el diseño heredado
// siguiendo el patrón ya establecido, regla 12): cuando un diagnóstico
// no resuelve el problema y el técnico marca "Encontré otra solución",
// su texto libre queda aquí para que quien mantiene la base de
// conocimiento lo revise y lo convierta en un artículo si aplica. Sin
// flujo de aprobación formal todavía: es solo una lista. Mismo shell
// centrado "alcanzada desde Inicio" que CuentaPage y DiagnosticosPage
// (desde donde también se enlaza).
export function SugerenciasEquipoPage() {
  // Cada sugerencia se enriquece con lo que hace falta para cerrar el
  // bucle (tarea 140, hallazgo K2): la categoria donde nacera el
  // articulo y el articulo que ya la atendio, si existe.
  //
  // La categoria NO esta en la ejecucion: se resuelve por
  // `diagnosticoId` contra el diagnostico. Si el diagnostico fue
  // eliminado no hay a donde crear el articulo, y la tarjeta se queda
  // solo en lectura en vez de ofrecer un enlace roto.
  const sugerencias = useLiveQuery(async () => {
    const lista = await db.ejecuciones_diagnostico
      .filter((e) => e.motivo === 'encontro_otra_solucion' && e.solucionPropuesta.trim() !== '')
      .toArray()
    lista.sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))

    const diagnosticos = await db.diagnosticos.bulkGet([
      ...new Set(lista.map((e) => e.diagnosticoId)),
    ])
    const categoriaPorDiagnostico = new Map(
      diagnosticos
        .filter((d) => d && !d.eliminadoEn)
        .map((d) => [d!.id, d!.categoriaId] as const),
    )

    const redactados = await db.articulos.filter((a) => !a.eliminadoEn && !!a.origenSugerenciaId).toArray()
    const articuloPorSugerencia = new Map(redactados.map((a) => [a.origenSugerenciaId!, a] as const))

    return lista.map((sugerencia) => ({
      sugerencia,
      categoriaId: categoriaPorDiagnostico.get(sugerencia.diagnosticoId) ?? null,
      articulo: articuloPorSugerencia.get(sugerencia.id) ?? null,
    }))
  }, [], [])

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="px-2 pt-2.5">
            <BotonVolver />
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="text-[22px] font-medium leading-[1.25]">Sugerencias del equipo</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Soluciones que un técnico encontró por su cuenta cuando un diagnóstico no resolvió el
              problema
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-2 px-4 pb-10 pt-4">
          {sugerencias.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
              <Lightbulb size={30} className="text-noct-neutral-600" aria-hidden />
              <p className="text-[13px] leading-relaxed text-noct-neutral-400">
                Todavía no hay sugerencias del equipo.
              </p>
            </div>
          ) : (
            sugerencias.map(({ sugerencia, categoriaId, articulo }) => (
              <div key={sugerencia.id} className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-[12px] text-noct-neutral-500">
                  <span className="truncate">{sugerencia.diagnosticoTitulo}</span>
                  <span className="shrink-0">{formateadorFecha.format(new Date(sugerencia.fechaHora))}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-noct-text">
                  {sugerencia.solucionPropuesta}
                </p>
                {sugerencia.usuarioNombre && (
                  <p className="mt-1.5 text-[12px] text-noct-neutral-500">
                    Reportado por {sugerencia.usuarioNombre}
                  </p>
                )}

                {/* Cierre del bucle (hallazgo K2): mientras nadie la haya
                    redactado se ofrece convertirla; despues, la tarjeta
                    muestra a donde fue a parar en vez del boton, para que
                    dos tecnicos no escriban el mismo articulo dos veces. */}
                {articulo ? (
                  <Link
                    to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
                    className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-noct-accent-300"
                  >
                    <Check size={14} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      Ya redactada: {articulo.titulo || '(sin título)'}
                    </span>
                  </Link>
                ) : categoriaId ? (
                  <Link
                    to={`/soluciones/${categoriaId}/nuevo?desdeSugerencia=${sugerencia.id}`}
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-noct-divider px-3 py-2 text-[12.5px] font-medium text-noct-text"
                  >
                    <Plus size={14} aria-hidden />
                    Redactar artículo
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  )
}
