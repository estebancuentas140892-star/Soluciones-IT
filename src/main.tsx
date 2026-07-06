import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { recargarUnaVezPorChunk } from './lib/recargaChunk'
import { iniciarSync } from './lib/sync'

// Vite avisa con este evento cuando un import dinamico (una pantalla
// cargada bajo demanda) no se pudo descargar, tipicamente porque se
// publico una version nueva y el navegador aun referencia trozos
// viejos. Recargar una vez toma el index.html nuevo y evita la pantalla
// en blanco sin que el usuario tenga que actualizar a mano. No se llama
// preventDefault a proposito: si la recarga no procede (ya se intento
// hace poco), el error sube al ErrorBoundary, que muestra el reintento.
window.addEventListener('vite:preloadError', () => {
  recargarUnaVezPorChunk()
})

try {
  iniciarSync()
} catch (error) {
  // No debe impedir que la app se muestre.
  console.error('No se pudo iniciar la sincronización:', error)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
