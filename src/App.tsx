import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/autenticacion/AuthProvider'
import { RequireAuth } from './features/autenticacion/RequireAuth'
import { Layout } from './app/Layout'
import { Cargando } from './components/Cargando'
import { ActualizacionDisponible } from './components/ActualizacionDisponible'

// Cada pantalla se carga en su propio trozo (chunk) bajo demanda. Asi
// la primera carga (la pantalla de login) no arrastra react-markdown
// (solo lo usa la vista de articulo) ni minisearch (solo la pantalla
// de inicio). Todos los trozos los precachea el service worker, por
// lo que siguen disponibles sin conexion. Los componentes usan
// exportaciones con nombre, de ahi el mapeo a `default`.
const LoginPage = lazy(() =>
  import('./features/autenticacion/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const InicioPage = lazy(() =>
  import('./features/inicio/InicioPage').then((m) => ({ default: m.InicioPage })),
)
const CuentaPage = lazy(() =>
  import('./features/autenticacion/CuentaPage').then((m) => ({ default: m.CuentaPage })),
)
const BloqueoAppGuard = lazy(() =>
  import('./features/seguridad/BloqueoAppGuard').then((m) => ({ default: m.BloqueoAppGuard })),
)
const SeguridadPage = lazy(() =>
  import('./features/seguridad/SeguridadPage').then((m) => ({ default: m.SeguridadPage })),
)
const SolucionesPage = lazy(() =>
  import('./features/soluciones/SolucionesPage').then((m) => ({ default: m.SolucionesPage })),
)
const CategoriaPage = lazy(() =>
  import('./features/soluciones/CategoriaPage').then((m) => ({ default: m.CategoriaPage })),
)
const ArticuloPage = lazy(() =>
  import('./features/soluciones/ArticuloPage').then((m) => ({ default: m.ArticuloPage })),
)
const ArticuloForm = lazy(() =>
  import('./features/soluciones/ArticuloForm').then((m) => ({ default: m.ArticuloForm })),
)
const AsistentePage = lazy(() =>
  import('./features/soluciones/AsistentePage').then((m) => ({ default: m.AsistentePage })),
)
const DispositivosPage = lazy(() =>
  import('./features/dispositivos/DispositivosPage').then((m) => ({ default: m.DispositivosPage })),
)
const DispositivoPage = lazy(() =>
  import('./features/dispositivos/DispositivoPage').then((m) => ({ default: m.DispositivoPage })),
)
const DispositivoForm = lazy(() =>
  import('./features/dispositivos/DispositivoForm').then((m) => ({ default: m.DispositivoForm })),
)
const BovedaGuard = lazy(() =>
  import('./features/boveda/BovedaGuard').then((m) => ({ default: m.BovedaGuard })),
)
const BovedaPage = lazy(() =>
  import('./features/boveda/BovedaPage').then((m) => ({ default: m.BovedaPage })),
)
const CredencialPage = lazy(() =>
  import('./features/boveda/CredencialPage').then((m) => ({ default: m.CredencialPage })),
)
const CredencialForm = lazy(() =>
  import('./features/boveda/CredencialForm').then((m) => ({ default: m.CredencialForm })),
)
const EscanerPage = lazy(() =>
  import('./features/escaner/EscanerPage').then((m) => ({ default: m.EscanerPage })),
)
const EtiquetasPage = lazy(() =>
  import('./features/dispositivos/EtiquetasPage').then((m) => ({ default: m.EtiquetasPage })),
)
const ImportarDispositivosPage = lazy(() =>
  import('./features/dispositivos/importar/ImportarDispositivosPage').then((m) => ({
    default: m.ImportarDispositivosPage,
  })),
)
const RedPage = lazy(() => import('./features/red/RedPage').then((m) => ({ default: m.RedPage })))
const TopologiaPage = lazy(() =>
  import('./features/red/TopologiaPage').then((m) => ({ default: m.TopologiaPage })),
)

function App() {
  return (
    <AuthProvider>
      <ActualizacionDisponible />
      <BrowserRouter>
        <Routes>
          <Route
            path="login"
            element={
              <Suspense fallback={<Cargando />}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route element={<RequireAuth />}>
            {/* Bloqueo de la app (patron o contrasena) sobre toda la
                zona autenticada: si este dispositivo lo tiene activo,
                pide desbloquear antes de mostrar cualquier pantalla. */}
            <Route
              element={
                <Suspense fallback={<Cargando />}>
                  <BloqueoAppGuard />
                </Suspense>
              }
            >
              {/* Pantallas fuera del Layout (sin barra inferior): el
                  escaner usa la camara a pantalla completa, las
                  etiquetas se imprimen sin el shell de la app y el
                  modo asistente evita distraer al tecnico con el
                  resto de la interfaz mientras ejecuta un paso. */}
              <Route
                path="escaner"
                element={
                  <Suspense fallback={<Cargando />}>
                    <EscanerPage />
                  </Suspense>
                }
              />
              <Route
                path="dispositivos/etiquetas"
                element={
                  <Suspense fallback={<Cargando />}>
                    <EtiquetasPage />
                  </Suspense>
                }
              />
              <Route
                path="soluciones/:categoriaId/:articuloId/ejecutar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <AsistentePage />
                  </Suspense>
                }
              />
              <Route element={<Layout />}>
                <Route index element={<InicioPage />} />
                <Route path="cuenta" element={<CuentaPage />} />
                <Route path="cuenta/seguridad" element={<SeguridadPage />} />
                <Route path="soluciones" element={<SolucionesPage />} />
                <Route path="soluciones/:categoriaId" element={<CategoriaPage />} />
                <Route path="soluciones/:categoriaId/nuevo" element={<ArticuloForm />} />
                <Route path="soluciones/:categoriaId/:articuloId" element={<ArticuloPage />} />
                <Route path="soluciones/:categoriaId/:articuloId/editar" element={<ArticuloForm />} />
                <Route path="dispositivos" element={<DispositivosPage />} />
                <Route path="dispositivos/nuevo" element={<DispositivoForm />} />
                <Route path="dispositivos/importar" element={<ImportarDispositivosPage />} />
                <Route path="dispositivos/:dispositivoId" element={<DispositivoPage />} />
                <Route path="dispositivos/:dispositivoId/editar" element={<DispositivoForm />} />
                <Route path="red" element={<RedPage />} />
                <Route path="red/topologia" element={<TopologiaPage />} />
                <Route path="red/topologia/:dispositivoId" element={<TopologiaPage />} />
                {/* La seccion de credenciales vive en /notas con nombre
                    neutro (minima exposicion). La ruta vieja redirige
                    por si quedo algun enlace guardado. */}
                <Route path="boveda/*" element={<Navigate to="/notas" replace />} />
                <Route path="notas" element={<BovedaGuard />}>
                  <Route index element={<BovedaPage />} />
                  <Route path="nueva" element={<CredencialForm />} />
                  <Route path=":credencialId" element={<CredencialPage />} />
                  <Route path=":credencialId/editar" element={<CredencialForm />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
