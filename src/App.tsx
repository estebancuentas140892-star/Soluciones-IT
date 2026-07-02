import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/autenticacion/AuthProvider'
import { RequireAuth } from './features/autenticacion/RequireAuth'
import { LoginPage } from './features/autenticacion/LoginPage'
import { Layout } from './app/Layout'
import { InicioPage } from './features/inicio/InicioPage'
import { SolucionesPage } from './features/soluciones/SolucionesPage'
import { CategoriaPage } from './features/soluciones/CategoriaPage'
import { ArticuloPage } from './features/soluciones/ArticuloPage'
import { ArticuloForm } from './features/soluciones/ArticuloForm'
import { DispositivosPage } from './features/dispositivos/DispositivosPage'
import { DispositivoPage } from './features/dispositivos/DispositivoPage'
import { DispositivoForm } from './features/dispositivos/DispositivoForm'
import { BovedaGuard } from './features/boveda/BovedaGuard'
import { BovedaPage } from './features/boveda/BovedaPage'
import { CredencialPage } from './features/boveda/CredencialPage'
import { CredencialForm } from './features/boveda/CredencialForm'

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
              <Route path="soluciones/:categoriaId" element={<CategoriaPage />} />
              <Route path="soluciones/:categoriaId/nuevo" element={<ArticuloForm />} />
              <Route path="soluciones/:categoriaId/:articuloId" element={<ArticuloPage />} />
              <Route path="soluciones/:categoriaId/:articuloId/editar" element={<ArticuloForm />} />
              <Route path="dispositivos" element={<DispositivosPage />} />
              <Route path="dispositivos/nuevo" element={<DispositivoForm />} />
              <Route path="dispositivos/:dispositivoId" element={<DispositivoPage />} />
              <Route path="dispositivos/:dispositivoId/editar" element={<DispositivoForm />} />
              <Route path="boveda" element={<BovedaGuard />}>
                <Route index element={<BovedaPage />} />
                <Route path="nueva" element={<CredencialForm />} />
                <Route path=":credencialId" element={<CredencialPage />} />
                <Route path=":credencialId/editar" element={<CredencialForm />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
