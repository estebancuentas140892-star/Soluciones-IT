import { useMemo, useState } from 'react'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { DescargarOffline } from '../../components/DescargarOffline'

export function InicioPage() {
  const [consulta, setConsulta] = useState('')
  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, consulta), [indice, consulta])
  const buscando = consulta.trim().length > 0

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header>
        <h1 className="text-xl font-semibold">Soluciones IT</h1>
        <p className="text-sm text-slate-400">Todo el conocimiento del equipo, al instante</p>
      </header>

      <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <SearchIcon className="h-5 w-5 text-slate-400" />
        <input
          type="search"
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Buscar impresora, POS, cámara, Zebra..."
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </label>

      {buscando ? (
        <ResultadosBusqueda resultados={resultados} />
      ) : (
        <>
          <DescargarOffline />
          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-400">Recientes</h2>
            <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
              Aún no hay elementos recientes
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
