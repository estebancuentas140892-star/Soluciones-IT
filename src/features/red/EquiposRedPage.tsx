import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { esDeRed } from '../../lib/categorias'
import { incluyeTexto } from '../../lib/texto'
import { FilaDispositivo } from '../../components/FilaDispositivo'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { MapPin, Plus, TreeStructure } from '../../components/iconos'
import { lineasDeContexto } from '../../lib/contextoEquipo'
import { agruparPorUbicacion } from './grupoUbicacion'
import { Boton } from '../../components/Boton'
import { claseBoton } from '../../components/claseBoton'
import { SinContenido } from '../../components/SinContenido'

// Todos los equipos de red, agrupados por ubicación.
//
// Era la raíz de la pestaña Red. La auditoría móvil (hallazgo M-018) la
// describe sin piedad: "el mismo buscador, los mismos grupos y la misma
// fila de equipo que Equipos", es decir un SEGUNDO INVENTARIO, mientras
// la sección que existe para explicar dependencias no las mostraba en su
// primera pantalla. Desde la tarea 204 la raíz de Red es el recorrido
// por nodos y esta lista vive un nivel más abajo, a un toque, que es la
// profundidad que le corresponde: se usa para encontrar un equipo
// concreto, no para entender la red.
//
// Y el agrupado cambió de clave (hallazgo M-019): se agrupa por la
// ENTIDAD Ubicación y el texto queda de respaldo, así que "Rack 1" y
// "rack 1" dejan de ser dos sitios. Ver `grupoUbicacion.ts`.

export function EquiposRedPage() {
  const [params] = useSearchParams()
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])
  const ubicaciones = useLiveQuery(() => db.ubicaciones.filter((u) => !u.eliminadoEn).toArray(), [], [])

  const [texto, setTexto] = useState('')

  // Llegar por el buscador de la pestaña Red abre el teclado; llegar por
  // la fila "Todos los equipos" no, porque ahí se viene a mirar.
  const refBuscador = useRef<HTMLInputElement>(null)
  const enfocar = params.get('buscar') === '1'
  useEffect(() => {
    if (enfocar) refBuscador.current?.focus()
  }, [enfocar])

  const idsRed = useMemo(
    () => new Set((categorias ?? []).filter(esDeRed).map((c) => c.id)),
    [categorias],
  )
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )
  const nombreUbicacion = useMemo(
    () => new Map((ubicaciones ?? []).map((u) => [u.id, u.nombre])),
    [ubicaciones],
  )

  const filtrados = useMemo(() => {
    return (dispositivos ?? [])
      .filter((d) => idsRed.has(d.categoriaId))
      .filter((d) =>
        incluyeTexto(
          [d.nombre, d.ubicacion, d.ip, d.marca, d.modelo, nombreCategoria.get(d.categoriaId)],
          texto,
        ),
      )
  }, [dispositivos, idsRed, texto, nombreCategoria])

  const grupos = useMemo(
    () => agruparPorUbicacion(filtrados, nombreUbicacion),
    [filtrados, nombreUbicacion],
  )
  // Bajo el nombre, la categoría y la marca y el modelo, pero solo lo que
  // el nombre no dice ya (tarea 277): "Switch Rack 1" no repite
  // "Switches". La ubicación no va: es el título del grupo.
  const subtitulos = useMemo(() => {
    const lineas = new Map<string, string>()
    for (const grupo of grupos) {
      const textos = lineasDeContexto(
        grupo.equipos.map((d) => ({
          nombre: d.nombre,
          partes: [nombreCategoria.get(d.categoriaId), [d.marca, d.modelo].filter(Boolean).join(' ')],
        })),
      )
      grupo.equipos.forEach((d, i) => lineas.set(d.id, textos[i]))
    }
    return lineas
  }, [grupos, nombreCategoria])

  const buscando = texto.trim().length > 0
  const hayResultados = filtrados.length > 0

  return (
    // Nivel 2 del chasis: documento. Cuelga de la pestaña Red, así que
    // el chasis pone el retorno; aquí quedan la acción Crear y el
    // buscador, con borde de acento al escribir.
    <Chasis
      modo="documento"
      barra={
        <>
          <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-1">
            <h1 className="min-w-0 truncate text-[18px] font-medium leading-[1.3]">Equipos de red</h1>
            <Link to="/dispositivos/nuevo?red=1" className={`shrink-0 ${claseBoton({ papel: 'texto' })}`}>
              <Plus size={15} aria-hidden />
              Crear
            </Link>
          </header>

          <div className="px-4 pb-2.5 pt-2">
            <CampoBusqueda
              valor={texto}
              onCambiar={setTexto}
              alcance="Equipos de red"
              refCampo={refBuscador}
            />
          </div>
        </>
      }
    >
      <main className="flex-1 px-4 pb-16 pt-3.5">
        <div className="flex flex-col gap-[18px]">
          {hayResultados ? (
            grupos.map((grupo) => (
              <section key={grupo.clave}>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <MapPin size={14} className="text-noct-neutral-400" aria-hidden />
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
                    {grupo.nombre}
                  </h2>
                  <span className="text-[11px] text-noct-neutral-500">{grupo.cuenta}</span>
                </div>
                <div className="flex flex-col">
                  {grupo.equipos.map((d) => (
                    <FilaDispositivo
                      key={d.id}
                      dispositivo={d}
                      categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                      subtitulo={subtitulos.get(d.id) ?? ''}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            // Sin contenido con su patrón (tarea 291, auditoría UX S4).
            buscando ? (
              <SinContenido
                tipo="sin-resultados"
                titulo="Ningún equipo de red coincide"
                texto="Prueba con otra palabra o revisa la ortografía."
                accion={
                  <Boton papel="secundario" onClick={() => setTexto('')}>
                    Quitar la búsqueda
                  </Boton>
                }
              />
            ) : (
              <SinContenido
                tipo="vacio"
                Icono={TreeStructure}
                titulo="Aún no hay equipos de red registrados"
                texto="Marca una categoría como de red o agrega equipos desde «Crear»."
              />
            )
          )}
        </div>
      </main>
    </Chasis>
  )
}
