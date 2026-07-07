import { Suspense } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { Cargando } from '../components/Cargando'
import { IndicadorSync } from '../components/IndicadorSync'
import { useAuth } from '../features/autenticacion/authContext'
import { db, ID_BLOQUEO_APP } from '../lib/db'
import { bloquearApp } from '../features/seguridad/bloqueoApp'

export function Layout() {
  const { perfil, cerrarSesion } = useAuth()
  const bloqueoConfigurado = useLiveQuery(
    async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) !== undefined,
    [],
    false,
  )

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-end gap-2 px-4 pt-3">
        <IndicadorSync />
        <Link
          to="/cuenta"
          className="text-xs text-slate-400 underline decoration-dotted decoration-slate-600 underline-offset-2"
        >
          {perfil?.nombre || 'Mi cuenta'}
        </Link>
        {bloqueoConfigurado && (
          <button
            type="button"
            onClick={bloquearApp}
            aria-label="Bloquear la aplicación"
            title="Bloquear la aplicación"
            className="flex items-center rounded-lg border border-slate-800 px-2 py-1 text-slate-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 11V7.5a4 4 0 0 1 8 0V11" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-300"
        >
          Cerrar sesión
        </button>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        <Suspense fallback={<Cargando />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
