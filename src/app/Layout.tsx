import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

export function Layout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-slate-950 text-slate-100">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
