import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useParams } from 'react-router-dom'
import { db, type Articulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'
import { ShellNocturne } from '../../app/ShellNocturne'
import { BotonVolver } from '../../components/BotonVolver'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { CaretRight, Plus, WarningCircle } from '../../components/iconos'
import { BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { claseEstado, estadoConEtiqueta, tipoDeNodoVisual } from '../red/topologiaVisual'
import { IconoNodo } from '../red/IconoNodo'
import { Historial } from '../historial/Historial'
import { claseTonoDeTipo, iconoDeCategoria, iconoDeTipo } from './iconosSoluciones'
import { claseTonoDeCategoria } from './coloresCategoria'
import { TIPOS_ARTICULO } from './tiposArticulo'

// Ficha de categoria en el sistema Nocturne (fase N4, sin esquema;
// re-autoria tarea 77): esqueleto estandar aplicado a una entidad que
// hasta ahora ni siquiera tenia ficha propia (seccion 8 de
// PROPUESTA_BASE_CONOCIMIENTO.md). Reune todo lo que pertenece a la
// categoria (articulos, dispositivos, diagnosticos) mas su historial,
// sin tocar el esquema: dispositivos y diagnosticos ya llevan
// categoria_id, solo faltaba mostrarlos juntos aqui. Ruta anidada bajo
// la pestaña Soluciones, por eso usa el mismo ShellNocturne que
// SolucionesPage y ArticuloPage (la barra inferior sigue resaltando
// Soluciones).
export function CategoriaPage() {
  const { categoriaId = '' } = useParams()

  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])
  const articulos = useLiveQuery(
    () => db.articulos.where('categoriaId').equals(categoriaId).filter((a) => !a.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )
  const dispositivos = useLiveQuery(
    () => db.dispositivos.where('categoriaId').equals(categoriaId).filter((d) => !d.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )
  const diagnosticos = useLiveQuery(
    () => db.diagnosticos.where('categoriaId').equals(categoriaId).filter((d) => !d.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )

  if (categoria === null) return <Navigate to="/soluciones" replace />

  const vacia = articulos.length === 0 && dispositivos.length === 0 && diagnosticos.length === 0
  const IconoCategoria = iconoDeCategoria(categoria?.nombre ?? '')

  return (
    <ShellNocturne>
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
          <BotonVolver />
          <Link to={`/soluciones/${categoriaId}/nuevo`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
            <Plus size={15} aria-hidden />
            Artículo
          </Link>
        </header>
        <div className="px-4 pb-3 pt-0.5">
          {/* La ficha de la categoría es donde su identidad debe leerse
              más: el icono va en un recuadro con su color propio (fase
              0b), el mismo tratamiento que ya recibe el tipo en cada
              fila de artículo. */}
          <div className="flex items-center gap-2.5">
            {categoria && (
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${claseTonoDeCategoria(categoria)}`}
              >
                <IconoCategoria size={18} aria-hidden />
              </span>
            )}
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">{categoria?.nombre ?? '...'}</h1>
          </div>
          {!vacia && (
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              {[
                articulos.length > 0 ? `${articulos.length} ${articulos.length === 1 ? 'artículo' : 'artículos'}` : null,
                dispositivos.length > 0
                  ? `${dispositivos.length} ${dispositivos.length === 1 ? 'equipo' : 'equipos'}`
                  : null,
                diagnosticos.length > 0
                  ? `${diagnosticos.length} ${diagnosticos.length === 1 ? 'diagnóstico' : 'diagnósticos'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-6 px-4 pb-10 pt-3.5">
        {vacia && (
          <div className="rounded-lg border border-dashed border-noct-neutral-700 px-6 py-14 text-center">
            <p className="text-sm font-medium">Todavía no hay nada en esta categoría</p>
            <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
              Crea el primer artículo con el botón de arriba.
            </p>
          </div>
        )}

        {TIPOS_ARTICULO.map(({ valor, etiqueta }) => {
          const delTipo = articulos.filter((a) => a.tipo === valor)
          if (delTipo.length === 0) return null
          return (
            <section key={valor}>
              <TituloSeccion className="mb-2">{etiqueta}</TituloSeccion>
              <div className="flex flex-col">
                {delTipo.map((articulo) => {
                  const portada = normalizarProcedimiento(articulo.procedimiento)?.portada
                  const Icono = iconoDeTipo(articulo.tipo)
                  return (
                    <Link
                      key={articulo.id}
                      to={`/soluciones/${categoriaId}/${articulo.id}`}
                      className="flex min-h-[56px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded ${claseTonoDeTipo(articulo.tipo)}`}
                      >
                        {portada ? (
                          <MiniaturaPortada
                            referencia={portada.referencia}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Icono size={18} aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-[1.3]">
                        {articulo.titulo}
                      </span>
                      <AvanceArticulo articulo={articulo} />
                      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}

        {dispositivos.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Dispositivos de esta categoría</TituloSeccion>
            <div className="flex flex-col">
              {dispositivos.map((dispositivo) => {
                const estado = estadoConEtiqueta(dispositivo.estado)
                return (
                  <Link
                    key={dispositivo.id}
                    to={`/dispositivos/${dispositivo.id}`}
                    className="flex min-h-[56px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-noct-text/[.06] text-noct-neutral-400">
                      {dispositivo.foto ? (
                        <MiniaturaPortada
                          referencia={dispositivo.foto.referencia}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <IconoNodo
                          tipo={tipoDeNodoVisual(categoria?.nombre ?? '')}
                          className="h-[18px] w-[18px]"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-[1.3]">{dispositivo.nombre}</p>
                      {dispositivo.ubicacion && (
                        <p className="truncate text-[12px] text-noct-neutral-500">{dispositivo.ubicacion}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium ${claseEstado(estado.etiqueta)}`}
                    >
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                      {estado.etiqueta}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {diagnosticos.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Diagnósticos de esta categoría</TituloSeccion>
            <div className="flex flex-col">
              {diagnosticos.map((diagnostico) => (
                <Link
                  key={diagnostico.id}
                  to={`/diagnostico/${diagnostico.id}`}
                  className="flex min-h-[56px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-noct-precaucion/[.12] text-noct-precaucion">
                    <WarningCircle size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium leading-[1.3]">
                    {diagnostico.titulo}
                  </span>
                  <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        <Historial entidadTipo="categoria" entidadId={categoriaId} />
      </main>
    </ShellNocturne>
  )
}

// Chip "X/Y pasos" para retomar de un vistazo un procedimiento a
// medias, sin tener que abrirlo. Solo se muestra en artículos con
// procedimiento y avance previo (evita ruido en el resto de la lista).
function AvanceArticulo({ articulo }: { articulo: Articulo }) {
  const procedimiento = normalizarProcedimiento(articulo.procedimiento)
  const progreso = useLiveQuery(() => db.progresoPasos.get(articulo.id), [articulo.id])

  if (!procedimiento) return null
  const total = procedimiento.pasos.length
  const hechos = contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((p) => p.id))
  if (hechos === 0) return null

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
        hechos === total
          ? 'border-noct-exito/40 bg-noct-exito/10 text-noct-exito'
          : 'border-noct-precaucion/40 bg-noct-precaucion/10 text-noct-precaucion'
      }`}
    >
      {hechos}/{total}
    </span>
  )
}
