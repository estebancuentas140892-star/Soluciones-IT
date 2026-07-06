import { Component, type ErrorInfo, type ReactNode } from 'react'
import { esErrorDeChunk, recargarUnaVezPorChunk } from '../lib/recargaChunk'

interface Props {
  children: ReactNode
}

interface State {
  fallo: boolean
  recargando: boolean
}

// Limite de error de toda la app. Sin el, cualquier error al renderizar
// (sobre todo un import dinamico que falla tras publicar una version
// nueva) desmonta React por completo y deja la pantalla en blanco. Aqui
// ese caso se recupera solo recargando una vez; cualquier otro error
// muestra una pantalla con boton de reintento en vez de la blanca.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { fallo: false, recargando: false }

  static getDerivedStateFromError(error: unknown): State {
    // Optimista: si parece un fallo de version, muestra "Actualizando"
    // mientras componentDidCatch decide si recarga.
    return { fallo: true, recargando: esErrorDeChunk(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Error capturado por ErrorBoundary:', error, info)
    if (esErrorDeChunk(error) && recargarUnaVezPorChunk()) return
    // No hubo recarga (error normal, o ya se recargo hace poco): pasar a
    // la pantalla de reintento manual.
    if (this.state.recargando) this.setState({ recargando: false })
  }

  render(): ReactNode {
    if (!this.state.fallo) return this.props.children

    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-100">
        {this.state.recargando ? (
          <p className="text-sm text-slate-400">Actualizando la aplicación...</p>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              No se pudo cargar la aplicación. Vuelve a intentarlo.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950"
            >
              Recargar
            </button>
          </>
        )}
      </div>
    )
  }
}
