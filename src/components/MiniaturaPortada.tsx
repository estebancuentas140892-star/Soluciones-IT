import { useUrlAdjunto } from './useUrlAdjunto'

// Miniatura de la imagen de portada de un procedimiento en los
// listados (categoria, resultados del buscador, rutas de aprendizaje
// y recomendaciones): ayuda a identificar el procedimiento de un
// vistazo. Si la imagen aun no esta disponible (por ejemplo offline
// sin cache) no se muestra nada y la fila queda como siempre.
export function MiniaturaPortada({ referencia, alt = '' }: { referencia: string; alt?: string }) {
  const url = useUrlAdjunto(referencia)
  if (!url) return null
  return (
    <img
      src={url}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-lg border border-slate-800 object-cover"
    />
  )
}
