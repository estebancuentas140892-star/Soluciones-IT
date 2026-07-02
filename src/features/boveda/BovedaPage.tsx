export function BovedaPage() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
        <LockIcon className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Bóveda</h1>
        <p className="mt-1 text-sm text-slate-400">
          IP, usuarios y contraseñas. Ingresa la contraseña maestra para desbloquear.
        </p>
      </div>
      <button
        type="button"
        className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950"
      >
        Desbloquear
      </button>
    </div>
  )
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
