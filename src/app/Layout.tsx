import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { Cargando } from '../components/Cargando'
import { IndicadorSync } from '../components/IndicadorSync'
import { useAuth } from '../features/autenticacion/authContext'

export function Layout() {
  const { perfil, cerrarSesion } = useAuth()

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
