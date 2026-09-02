import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { CaretRight, LinkSimple, MagnifyingGlass, Plus, TreeStructure } from '../../components/iconos'
import { VALOR_TECNICO_COMPACTO } from '../../components/FilaDato'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { conOrigen } from '../../lib/origenNavegacion'
import { IconoNodo } from './IconoNodo'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { NodoRed } from './NodoRed'
import { nodoInicial } from './nodoDeRed'
import { tipoDeNodoVisual } from './topologiaVisual'
import { useNodoRed, useRedCargada } from './useNodoRed'

// La pestaña Red abre con el NODO, no con la lista (hallazgo M-018 de
// la auditoría móvil, mockup `10c`, tarea 204).
//
// Lo que había: "el mismo buscador, los mismos grupos y la misma fila de
// equipo que Equipos, con la ubicación como título de grupo". Un segundo
// inventario. La sección que existe para explicar dependencias no las
// mostraba en su primera pantalla, y las apartaba detrás de una fila.
//
// Lo que la auditoría encontró y ahorra el trabajo: la pantalla que Red
// necesitaba YA ESTABA CONSTRUIDA (la vecindad de un equipo, con "de qué
// depende", "si falla, caen N equipos" y el árbol de dependientes), solo
// que a tres toques y sin ser la forma de la sección. Así que esta
// pantalla no inventa nada: monta `NodoRed`, el mismo bloque que pinta
// la topología de un equipo.
//
// La respuesta a "¿se puede entender una infraestructura compleja en una
// pantalla pequeña?" no es dibujar el diagrama más pequeño: es
// RECORRERLA POR NODOS. Uno a la vez, con su padre arriba, sus hijos
// abajo y cuántos caen si falla.
//
// El nodo que se está recorriendo viaja en `/red?nodo=<id>`, y por eso
// la memoria de pestaña (tarea 187) lo repone sola al volver de otra
// sección: para esta pestaña el nodo es lo que el filtro es para Guías.
// Sin almacenamiento nuevo.

export function RedPage() {
  const [params] = useSearchParams()
  const red = useRedCargada()

  // El nodo pedido solo vale si sigue en el bosque: un enlace guardado a
  // un equipo ya borrado cae al nodo de entrada en vez de dejar la
  // pestaña en blanco (ver `nodoDeRed.ts`).
  const idNodo = useMemo(
    () => nodoInicial(params.get('nodo'), red.bosque) ?? '',
    [params, red.bosque],
  )
  const nodo = useNodoRed(idNodo, red)

  const equipo = nodo.equipo
  const categoria = equipo ? (red.nombreCategoria.get(equipo.categoriaId) ?? '') : ''
  const totalEquiposRed = useMemo(
    () => red.dispositivos.filter((d) => red.idsRed.has(d.categoriaId)).length,
    [red.dispositivos, red.idsRed],
  )
  const sinConexiones = Boolean(equipo) && nodo.dependeDe.length === 0 && nodo.arbol.hijos.length === 0
  const volverAlNodo = equipo ? `/red?nodo=${encodeURIComponent(equipo.id)}` : '/red'

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila. El título, el
    // estado del dato y la cuenta los aporta el chasis; en `barra`
    // quedan la acción Crear y la puerta al buscador.
    <Chasis titulo="Red" barra={
      <>
        <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-1">
          <p className="min-w-0 truncate text-[12.5px] text-noct-neutral-400">
            Cómo está conectada la infraestructura
          </p>
          <Link to="/dispositivos/nuevo?red=1" className={`shrink-0 ${BTN_SECUNDARIO}`}>
            <Plus size={15} aria-hidden />
            Crear
          </Link>
        </header>

        {/* El buscador no vive aquí: aquí se recorre, y buscar es ir a la
            lista. Es un botón con forma de campo, y lleva a la lista con
            el teclado ya abierto. Un campo de verdad en esta pantalla
            filtraría algo que no está a la vista. */}
        <div className="px-4 pb-2.5 pt-2">
          <Link
            to="/red/equipos?buscar=1"
            className="flex h-11 items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3.5 text-[15px] text-noct-neutral-500 hover:border-noct-neutral-700"
          >
            <MagnifyingGlass size={18} className="shrink-0" aria-hidden />
            Equipo de red, IP, ubicación
          </Link>
        </div>
      </>
    }>
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-16 pt-3.5">
        {equipo ? (
          <>
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
                Estás recorriendo
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-noct-accent/[.35] bg-noct-accent/[.08] px-3.5 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-accent/[.16] text-noct-accent-300">
                  <IconoNodo tipo={tipoDeNodoVisual(categoria)} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[16.5px] font-medium leading-[1.25]">{equipo.nombre}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-noct-neutral-500">
                    {equipo.estado && <PastillaEstadoDispositivo estado={equipo.estado} />}
                    {equipo.ip && (
                      <>
                        <span className="text-noct-neutral-600">·</span>
                        {/* Piso del dato técnico (M-R5): la IP no baja de
                            13 px ni de neutral-300. */}
                        <span className={VALOR_TECNICO_COMPACTO}>{equipo.ip}</span>
                      </>
                    )}
                  </p>
                </div>
                <Link
                  to={`/red/topologia/${equipo.id}`}
                  aria-label={`Abrir la topología completa de ${equipo.nombre}`}
                  title="Topología y conexiones"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-noct-accent/50 text-noct-accent-300 hover:bg-noct-accent/[.16]"
                >
                  <TreeStructure size={18} aria-hidden />
                </Link>
              </div>
            </section>

            {/* Tocar un equipo SUSTITUYE el nodo en su sitio: el recorrido
                sigue en la misma pantalla, y el regreso deshace un salto
                en vez de saltar a la lista. Subir se hace por "Depende
                de", que es el camino real hacia arriba. */}
            <NodoRed
              dependeDe={nodo.dependeDe}
              chipsImpacto={nodo.chipsImpacto}
              totalDependientes={nodo.totalDependientes}
              arbol={nodo.arbol}
              nombreCategoria={red.nombreCategoria}
              enlaceANodo={(id) => ({ to: `/red?nodo=${encodeURIComponent(id)}` })}
            />

            {sinConexiones && (
              <div className="flex flex-col items-start gap-2.5 rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4">
                <p className="text-[13.5px] leading-relaxed text-noct-neutral-300">
                  Este equipo todavía no tiene conexiones registradas, así que no hay nada que recorrer desde
                  aquí.
                </p>
                <Link to={`/red/topologia/${equipo.id}`} className={BTN_SECUNDARIO}>
                  <LinkSimple size={15} aria-hidden />
                  Registrar sus conexiones
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
            <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
            <div>
              <p className="text-[14.5px] font-medium">
                {red.cargando ? 'Cargando la red...' : 'Aún no hay equipos de red registrados'}
              </p>
              {!red.cargando && (
                <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                  Marcar una categoría como de red o agregar equipos desde "Crear".
                </p>
              )}
            </div>
          </div>
        )}

        {/* La lista sigue existiendo, debajo y en una fila: se usa para
            encontrar UN equipo, no para entender la red. */}
        <section className="mt-auto flex flex-col gap-2">
          <FilaPuerta
            to="/red/equipos"
            titulo="Todos los equipos de red por ubicación"
            cuenta={totalEquiposRed}
            volverA={volverAlNodo}
          />
          <FilaPuerta to="/red/topologia" titulo="Mapa completo, desde cada raíz" volverA={volverAlNodo} />
        </section>
      </main>
    </Chasis>
  )
}

// Fila-puerta al pie: lleva a una pantalla completa y dice cuánto hay
// detrás, para que abrirla no sea una apuesta.
function FilaPuerta({
  to,
  titulo,
  cuenta,
  volverA,
}: {
  to: string
  titulo: string
  cuenta?: number
  // Ruta de vuelta CON el nodo puesto. El padre lógico de estas dos
  // pantallas es `/red` pelado, que abriría por el nodo de entrada:
  // volver dejaría al técnico en otro sitio del recorrido (regla M-R2).
  volverA: string
}) {
  return (
    <Link
      to={to}
      state={conOrigen(volverA, 'Red')}
      className="flex min-h-[52px] items-center gap-3 rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-2 text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="min-w-0 flex-1 text-[14px] font-medium leading-[1.3]">{titulo}</span>
      {cuenta !== undefined && (
        <span className="shrink-0 font-mono text-[13px] tabular-nums text-noct-neutral-300">{cuenta}</span>
      )}
      <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}
