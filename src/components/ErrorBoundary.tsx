import { Component, type ErrorInfo, type ReactNode } from 'react'
import { esErrorDeChunk, recargarUnaVezPorChunk, reinstalarYRecargar } from '../lib/recargaChunk'
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
    if (esErrorDeChunk(error)) {
      // Primer intento: recargar para tomar el index.html nuevo.
      if (recargarUnaVezPorChunk()) return
      // Ya se recargo y volvio a fallar. Entonces no es que el
      // navegador tuviera el index.html viejo en memoria: es que la
      // instalacion en si esta rota, porque el service worker sirve un
      // index.html precacheado cuyos trozos ya no estan ni en la cache
      // ni en el servidor. Reinstalar es lo unico que sale de ese
      // bucle. Se hace solo, sin pedirle nada al tecnico, que esta de
      // pie frente a un rack y no tiene por que saber esto.
      void reinstalarYRecargar().then((seReinstalo) => {
        if (!seReinstalo) this.setState({ recargando: false })
      })
      return
    }
    // Error normal: pasar a la pantalla de reintento manual.
    if (this.state.recargando) this.setState({ recargando: false })
  }

  // El boton de la pantalla de error. Una recarga a secas ya se probo
  // sola antes de llegar aqui, asi que repetirla es el callejon sin
  // salida que reporto el equipo: mismo mensaje una y otra vez. Este
  // boton reinstala.
  private reintentar = (): void => {
    void reinstalarYRecargar().then((seReinstalo) => {
      if (!seReinstalo) window.location.reload()
    })
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
                Vuelve a descargarla desde el servidor. Tus guías, tu avance y lo que esté esperando
                para subir no se tocan.
              </p>
            </div>
            <button
              type="button"
              onClick={this.reintentar}
              className={`${BTN_PRIMARIO} min-h-12 w-full max-w-[300px]`}
            >
              Reinstalar la aplicación
            </button>
          </>
        )}
      </div>
    )
  }
}
