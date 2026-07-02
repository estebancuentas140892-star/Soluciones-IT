import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './app/Layout'
import { InicioPage } from './features/inicio/InicioPage'
import { SolucionesPage } from './features/soluciones/SolucionesPage'
import { DispositivosPage } from './features/dispositivos/DispositivosPage'
import { BovedaPage } from './features/boveda/BovedaPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="soluciones" element={<SolucionesPage />} />
          <Route path="dispositivos" element={<DispositivosPage />} />
          <Route path="boveda" element={<BovedaPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
