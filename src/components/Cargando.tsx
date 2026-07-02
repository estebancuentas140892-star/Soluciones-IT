// Indicador de carga compartido. Se usa como fallback de Suspense
// mientras se descarga el trozo (chunk) de una pantalla cargada de
// forma diferida, y en cualquier vista que espere datos locales.
export function Cargando() {
  return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
}
