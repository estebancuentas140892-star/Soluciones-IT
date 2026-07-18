import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { BotonVolver } from '../../components/BotonVolver'
import {
  CaretRight,
  MagnifyingGlass,
  Play,
  Plus,
  TreeStructure,
  WarningCircle,
  XCircleFill,
} from '../../components/iconos'
import { BTN_GHOST, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { iconoDeCategoria, normalizarTexto } from '../soluciones/iconosSoluciones'

// Modo Diagnóstico Inteligente re-autorizado en Nocturne (handoff
// "Rediseño de aplicación empresarial", Diagnóstico.dc.html; tarea 81).
// El técnico no piensa en el nombre de un procedimiento sino en el
// problema que tiene delante: cada fila ES un problema ("La impresora
// no imprime") agrupado por categoría, y tocarlo abre el diagnóstico
// guiado. Pantalla enfocada a la que se llega desde Inicio (no es una
// pestaña), por eso trae su propio shell centrado con "Volver a Inicio"
// en vez del ShellNocturne con pestañas.
export function DiagnosticosPage() {
  const [filtro, setFiltro] = useState('')
  const [searchParams] = useSearchParams()
  // Llegar con ?categoria=<id> (por ejemplo desde "Iniciar diagnóstico"
  // en la ficha de un equipo, fase R1) preselecciona esa categoría en
  // vez de mostrar todas: el técnico ve directo los problemas de SU
  // equipo. El banner permite quitar el filtro.
  const categoriaFiltro = searchParams.get('categoria') ?? ''

  const diagnosticos = useLiveQuery(
    () => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])

  // Diagnóstico con una sesión a medias más reciente en este dispositivo,
  // para ofrecer retomarlo de un vistazo (misma idea que "Continuar donde
  // quedaste" de Inicio). actualizadoEn no está indexado: son pocas filas
  // (el avance de un equipo de 5), se ordena en memoria.
  const enCurso = useLiveQuery(async () => {
    const progresos = (await db.progresoDiagnostico.toArray()).sort((a, b) =>
      b.actualizadoEn.localeCompare(a.actualizadoEn),
    )
    for (const progreso of progresos) {
      const diagnostico = await db.diagnosticos.get(progreso.diagnosticoId)
      if (!diagnostico || diagnostico.eliminadoEn) continue
      return { id: diagnostico.id, titulo: diagnostico.titulo }
    }
    return null
  }, [])

  const fRaw = filtro.trim()
  const hayFiltro = fRaw.length > 0
  const f = normalizarTexto(fRaw)

  const visibles = useMemo(
    () =>
      diagnosticos
        .filter((d) => !categoriaFiltro || d.categoriaId === categoriaFiltro)
        .filter((d) => !f || normalizarTexto(d.titulo).includes(f)),
    [diagnosticos, categoriaFiltro, f],
  )

  const grupos = useMemo(() => {
    return categorias
      .map((categoria) => ({
        categoria,
        Icono: iconoDeCategoria(categoria.nombre),
        delGrupo: visibles.filter((d) => d.categoriaId === categoria.id),
      }))
      .filter((g) => g.delGrupo.length > 0)
  }, [categorias, visibles])

  const sinContenido = diagnosticos.length === 0
  const sinCoincidencias = !sinContenido && grupos.length === 0
  const categoriaActiva = categorias.find((c) => c.id === categoriaFiltro)

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
        {/* Cabecera fija con desenfoque: volver a Inicio, crear, título
            y buscador del problema. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 px-2 pt-2.5">
            <BotonVolver variante="nocturne" />
            <Link to="/diagnostico/nuevo" className={`shrink-0 ${BTN_GHOST}`}>
              <Plus size={14} aria-hidden />
              Crear
            </Link>
          </header>
          <div className="px-4 pb-2.5 pt-0.5">
            <h1 className="text-[22px] font-medium leading-[1.25]">Diagnóstico inteligente</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Empezar por el problema, llegar a la solución
            </p>
            <Link
              to="/diagnostico/sugerencias"
              className="mt-1.5 inline-block text-[12px] text-noct-accent-300 underline-offset-2 hover:underline"
            >
              Sugerencias del equipo
            </Link>
          </div>
          <div className="px-4 pb-3">
            <label
              className={`flex h-11 items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
                hayFiltro ? 'border-noct-accent' : 'border-noct-divider'
              }`}
            >
              <MagnifyingGlass
                size={18}
                className={`shrink-0 ${hayFiltro ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
                aria-hidden
              />
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Describir el problema: no imprime, sin red..."
                aria-label="Describir el problema"
                className="dg-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
              />
              {hayFiltro && (
                <button
                  type="button"
                  onClick={() => setFiltro('')}
                  aria-label="Borrar búsqueda"
                  className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
                >
                  <XCircleFill size={18} aria-hidden />
                </button>
              )}
            </label>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-[18px] px-4 pb-10 pt-3.5">
          {categoriaActiva && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] px-3.5 py-2.5">
              <p className="min-w-0 truncate text-[12.5px] text-noct-accent-300">
                Solo: {categoriaActiva.nombre}
              </p>
              <Link
                to="/diagnostico"
                className="shrink-0 text-[12px] text-noct-accent-300 underline underline-offset-2"
              >
                Ver todos
              </Link>
            </div>
          )}

          {/* Diagnóstico en curso: al retomar, la ficha del asistente
              detecta el progreso guardado y continúa donde quedó. No se
              muestra mientras se filtra (fidelidad al diseño). */}
          {enCurso && !hayFiltro && (
            <Link
              to={`/diagnostico/${enCurso.id}`}
              className="flex items-center gap-3 rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] p-3.5 text-noct-text hover:bg-noct-accent/[.13]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-noct-accent/[.16] text-noct-accent-300">
                <Play size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium uppercase tracking-[0.07em] text-noct-accent-300">
                  Diagnóstico en curso
                </span>
                <span className="mt-[3px] block text-[14.5px] font-medium leading-[1.3]">
                  {enCurso.titulo}
                </span>
              </span>
              <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
            </Link>
          )}

          {grupos.map(({ categoria, Icono, delGrupo }) => (
            <section key={categoria.id}>
              <div className="mb-1.5 flex items-center gap-2 px-0.5">
                <Icono size={14} className="text-noct-neutral-400" aria-hidden />
                <TituloSeccion>{categoria.nombre}</TituloSeccion>
              </div>
              <div className="flex flex-col">
                {delGrupo.map((diagnostico) => (
                  <Link
                    key={diagnostico.id}
                    to={`/diagnostico/${diagnostico.id}`}
                    className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
                  >
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded bg-noct-precaucion/[.12] text-noct-precaucion">
                      <WarningCircle size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
                        {diagnostico.titulo}
                      </span>
                      {diagnostico.descripcion && (
                        <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-500">
                          {diagnostico.descripcion}
                        </span>
                      )}
                    </span>
                    <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {sinContenido && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
              <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
              <p className="text-[13px] leading-relaxed text-noct-neutral-400">
                Todavía no hay diagnósticos. Crea el primero con "Crear": un problema frecuente y las
                preguntas que llevan a su solución.
              </p>
              <Link to="/diagnostico/nuevo" className={`mt-0.5 ${BTN_SECUNDARIO}`}>
                <Plus size={14} aria-hidden />
                Crear diagnóstico
              </Link>
            </div>
          )}

          {sinCoincidencias && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
              <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
              <p className="text-[13px] leading-relaxed text-noct-neutral-400">
                Ningún problema coincide. Prueba con otra palabra o busca directo en Soluciones.
              </p>
              <Link to="/soluciones" className={`mt-0.5 ${BTN_SECUNDARIO}`}>
                Ir a Soluciones
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
