// Indicador de carga compartido. Se usa como fallback de Suspense
// mientras se descarga el trozo (chunk) de una pantalla cargada de
// forma diferida, y en cualquier vista que espere datos locales. Trae
// su propio fondo y tipografia porque se dibuja ANTES de que exista
// el shell autenticado (ShellNocturne): en el login, el guard de
// bloqueo y el de sesion no hay ningun ancestro que ya pinte el fondo
// oscuro (mismo motivo que documenta ErrorBoundary.tsx).
export function Cargando() {
  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
      <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
    </div>
  )
}
