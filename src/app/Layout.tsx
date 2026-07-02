import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { useAuth } from '../features/autenticacion/authContext'

export function Layout() {
  const { perfil, cerrarSesion } = useAuth()

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-end gap-2 px-4 pt-3">
        {perfil?.nombre && <span className="text-xs text-slate-400">{perfil.nombre}</span>}
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-300"
        >
          Cerrar sesión
        </button>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
