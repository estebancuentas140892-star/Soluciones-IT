const categorias = [
  'POS',
  'Impresoras',
  'Cámaras',
  'Computadores',
  'Redes',
  'Switches',
  'Access Points',
  'CCTV',
  'Servidores',
]

export function SolucionesPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <header>
        <h1 className="text-xl font-semibold">Soluciones</h1>
        <p className="text-sm text-slate-400">Procedimientos, manuales y resolución de problemas por categoría</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {categorias.map((categoria) => (
          <button
            key={categoria}
            type="button"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-5 text-left text-sm font-medium text-slate-100"
          >
            {categoria}
          </button>
        ))}
      </div>
    </div>
  )
}
