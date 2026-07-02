export function DispositivosPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <header>
        <h1 className="text-xl font-semibold">Dispositivos</h1>
        <p className="text-sm text-slate-400">Inventario y fichas técnicas del equipo</p>
      </header>

      <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
        Aún no hay dispositivos registrados
      </p>
    </div>
  )
}
