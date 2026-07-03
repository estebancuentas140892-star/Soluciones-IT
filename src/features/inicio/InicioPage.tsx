import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { DescargarOffline } from '../../components/DescargarOffline'
import { obtenerRecientes } from '../../lib/recientes'

export function InicioPage() {
  const [consulta, setConsulta] = useState('')
  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, consulta), [indice, consulta])
  const buscando = consulta.trim().length > 0
  const recientes = useLiveQuery(() => obtenerRecientes(), [], [])

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
          <Link
            to="/escaner"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
          >
            <IconoEscanear className="h-5 w-5 text-slate-400" />
            Escanear código de un equipo
          </Link>
          <DescargarOffline />
          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-400">Recientes</h2>
            {recientes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
                Aún no hay elementos recientes
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recientes.map((reciente) => (
                  <li key={reciente.clave}>
                    <Link
                      to={reciente.ruta}
                      className="block rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-slate-100">{reciente.titulo}</p>
                      <p className="text-xs text-slate-400">{reciente.subtitulo}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function IconoEscanear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12h10" strokeLinecap="round" />
    </svg>
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
