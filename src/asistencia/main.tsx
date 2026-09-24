import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { PortalAsistencia } from './PortalAsistencia'

// ENTRADA PROPIA DEL PORTAL PUBLICO (tarea 258). No es la app con una
// ruta mas: no importa `App`, ni la sincronizacion, ni Dexie, ni el
// cliente de Supabase, ni registra el service worker, asi que en el
// computador de otra persona no queda instalado nada. Solo trae los
// estilos (el tema Nocturne) y el portal. `src/asistencia/aislamiento.test.ts`
// recorre las importaciones de este archivo y falla si alguna alcanza
// la app.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalAsistencia />
  </StrictMode>,
)
