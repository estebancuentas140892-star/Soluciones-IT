import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { BotonVolver } from '../../components/BotonVolver'

// Lista de problemas frecuentes del Modo Diagnostico Inteligente,
// agrupados por categoria (POS, Impresoras, Redes...). El tecnico no
// piensa en el nombre de un procedimiento sino en el problema que
// tiene delante: cada tarjeta ES un problema ("La impresora no
// imprime") y tocarla inicia el diagnostico guiado.
export function DiagnosticosPage() {
  const [filtro, setFiltro] = useState('')
  const [searchParams] = useSearchParams()
  // Llegar con ?categoria=<id> (por ejemplo desde "Iniciar diagnóstico"
  // en la ficha de un equipo, fase R1) preselecciona esa categoria en
  // vez de mostrar todas: el tecnico ve directo los problemas de SU
  // equipo. El desplegable sigue permitiendo cambiarla.
  const categoriaInicial = searchParams.get('categoria') ?? ''
  const [categoriaId, setCategoriaId] = useState(categoriaInicial)

  const diagnosticos = useLiveQuery(
    () => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])
  // Diagnosticos con una sesion a medias en este dispositivo, para
  // mostrar "En curso" y retomarlos de un vistazo.
  const enCurso = useLiveQuery(async () => {
    const progresos = await db.progresoDiagnostico.toArray()
    return new Set(progresos.map((p) => p.diagnosticoId))
  }, [])

  const filtroLimpio = filtro.trim().toLowerCase()
  const visibles = useMemo(
    () =>
      diagnosticos
        .filter((d) => !categoriaId || d.categoriaId === categoriaId)
        .filter((d) => filtroLimpio === '' || d.titulo.toLowerCase().includes(filtroLimpio)),
    [diagnosticos, categoriaId, filtroLimpio],
  )

  const grupos = useMemo(() => {
    return categorias
      .map((categoria) => ({
        categoria,
        delGrupo: visibles.filter((d) => d.categoriaId === categoria.id),
      }))
      .filter((g) => g.delGrupo.length > 0)
  }, [categorias, visibles])

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-2">
          <BotonVolver to="/">Inicio</BotonVolver>
          <div>
            <h1 className="text-xl font-semibold">Diagnóstico Inteligente</h1>
            <p className="text-sm text-slate-400">Empieza por el problema, llega a la solución</p>
          </div>
          <Link
            to="/diagnostico/sugerencias"
            className="w-fit text-xs text-slate-400 underline underline-offset-2"
          >
            Sugerencias del equipo
          </Link>
        </div>
        <Link
          to="/diagnostico/nuevo"
          className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
        >
          + Crear diagnóstico
        </Link>
      </header>

      <input
        type="search"
        value={filtro}
        onChange={(evento) => setFiltro(evento.target.value)}
        placeholder="Buscar un problema..."
        className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      {categoriaId && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-sky-900/60 bg-sky-950/20 px-4 py-2.5">
          <p className="text-xs text-sky-200">
            Mostrando solo: {categorias.find((c) => c.id === categoriaId)?.nombre ?? 'esta categoría'}
          </p>
          <button
            type="button"
            onClick={() => setCategoriaId('')}
            className="shrink-0 text-xs text-sky-300 underline underline-offset-2"
          >
            Ver todos
          </button>
        </div>
      )}

      {diagnosticos.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Todavía no hay diagnósticos. Crea el primero con "+ Crear diagnóstico": un problema
          frecuente y las preguntas que llevan a su solución.
        </p>
      )}

      {diagnosticos.length > 0 && grupos.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Ningún diagnóstico coincide con el filtro.
        </p>
      )}

      {grupos.map(({ categoria, delGrupo }) => (
        <section key={categoria.id}>
          <h2 className="mb-2 text-sm font-medium text-slate-400">{categoria.nombre}</h2>
          <ul className="flex flex-col gap-2">
            {delGrupo.map((diagnostico) => (
              <li key={diagnostico.id}>
                <Link
                  to={`/diagnostico/${diagnostico.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {diagnostico.titulo}
                    </span>
                    {diagnostico.descripcion && (
                      <span className="block truncate text-xs text-slate-400">{diagnostico.descripcion}</span>
                    )}
                  </span>
                  {enCurso?.has(diagnostico.id) && (
                    <span className="shrink-0 rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-400">
                      En curso
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
