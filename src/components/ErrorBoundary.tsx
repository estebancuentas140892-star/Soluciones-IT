import { Component, type ErrorInfo, type ReactNode } from 'react'
import { esErrorDeChunk, recargarUnaVezPorChunk } from '../lib/recargaChunk'
import { BTN_PRIMARIO } from './nocturne'

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
//
// Esta pantalla se dibuja con las clases de Nocturne escritas a mano y
// solo toma BTN_PRIMARIO de components/nocturne.tsx, que son constantes
// de texto (1.5 kB en su propio trozo). En particular NO usa un icono de
// components/iconos.tsx a proposito, aunque el resto de las pantallas a
// pantalla completa (BloqueoAppGuard, BovedaGuard) lo lleven en un
// circulo: main.tsx importa este componente de forma ESTATICA, asi que
// todo lo que se importe aqui entra al trozo de entrada, y el de iconos
// pesa 38 kB (mas que el de entrada entero). Cargarlos en cada arranque
// frio, incluido el login, para adornar una pantalla que casi nunca se
// ve seria un mal negocio; y ademas este es justo el componente que
// tiene que poder dibujarse cuando bajar un trozo es lo que esta
// fallando.
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

    // El fondo lo pinta el contenedor a lo ancho de toda la ventana (no
    // una columna centrada como antes): con `max-w-md` en el mismo
    // elemento que el color, en pantalla ancha el oscuro llegaba solo
    // hasta los 28rem del centro y los lados quedaban en el blanco del
    // body. El ancho maximo pasa al bloque de texto, que es lo unico
    // que hay que evitar que se estire.
    return (
      <div className="nocturne flex min-h-svh flex-col items-center justify-center gap-6 bg-noct-bg px-6 text-center font-inter text-noct-text">
        {this.state.recargando ? (
          <p className="text-[13.5px] text-noct-neutral-400">Actualizando la aplicación...</p>
        ) : (
          <>
            <div className="flex max-w-[320px] flex-col gap-1.5">
              <h1 className="text-[22px] font-medium leading-tight">
                No se pudo cargar la aplicación
              </h1>
              <p className="text-[13.5px] leading-[1.5] text-noct-neutral-400">
                Vuelve a intentarlo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${BTN_PRIMARIO} min-h-12 w-full max-w-[300px]`}
            >
              Recargar
            </button>
          </>
        )}
      </div>
    )
  }
}
