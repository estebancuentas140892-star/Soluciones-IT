import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/autenticacion/AuthProvider'
import { RequireAuth } from './features/autenticacion/RequireAuth'
import { LoginPage } from './features/autenticacion/LoginPage'
import { Layout } from './app/Layout'
import { InicioPage } from './features/inicio/InicioPage'
import { SolucionesPage } from './features/soluciones/SolucionesPage'
import { DispositivosPage } from './features/dispositivos/DispositivosPage'
import { BovedaPage } from './features/boveda/BovedaPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<InicioPage />} />
              <Route path="soluciones" element={<SolucionesPage />} />
              <Route path="dispositivos" element={<DispositivosPage />} />
              <Route path="boveda" element={<BovedaPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
