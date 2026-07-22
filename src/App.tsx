import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/autenticacion/AuthProvider'
import { RequireAuth } from './features/autenticacion/RequireAuth'
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
const DiagnosticosPage = lazy(() =>
  import('./features/diagnostico/DiagnosticosPage').then((m) => ({ default: m.DiagnosticosPage })),
)
const DiagnosticoForm = lazy(() =>
  import('./features/diagnostico/DiagnosticoForm').then((m) => ({ default: m.DiagnosticoForm })),
)
const DiagnosticoRunPage = lazy(() =>
  import('./features/diagnostico/DiagnosticoRunPage').then((m) => ({ default: m.DiagnosticoRunPage })),
)
const SugerenciasEquipoPage = lazy(() =>
  import('./features/diagnostico/SugerenciasEquipoPage').then((m) => ({ default: m.SugerenciasEquipoPage })),
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
const DarDeBajaPage = lazy(() =>
  import('./features/dispositivos/DarDeBajaPage').then((m) => ({ default: m.DarDeBajaPage })),
)
const ReemplazoPage = lazy(() =>
  import('./features/dispositivos/ReemplazoPage').then((m) => ({ default: m.ReemplazoPage })),
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
const MigracionCredenciales = lazy(() =>
  import('./features/boveda/MigracionCredenciales').then((m) => ({ default: m.MigracionCredenciales })),
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
const UbicacionesPage = lazy(() =>
  import('./features/ubicaciones/UbicacionesPage').then((m) => ({ default: m.UbicacionesPage })),
)
const UbicacionPage = lazy(() =>
  import('./features/ubicaciones/UbicacionPage').then((m) => ({ default: m.UbicacionPage })),
)
const UbicacionForm = lazy(() =>
  import('./features/ubicaciones/UbicacionForm').then((m) => ({ default: m.UbicacionForm })),
)
const MigracionUbicaciones = lazy(() =>
  import('./features/ubicaciones/MigracionUbicaciones').then((m) => ({ default: m.MigracionUbicaciones })),
)
const PersonasPage = lazy(() =>
  import('./features/personas/PersonasPage').then((m) => ({ default: m.PersonasPage })),
)
const PersonaPage = lazy(() =>
  import('./features/personas/PersonaPage').then((m) => ({ default: m.PersonaPage })),
)
const PersonaForm = lazy(() =>
  import('./features/personas/PersonaForm').then((m) => ({ default: m.PersonaForm })),
)
const MigracionPersonas = lazy(() =>
  import('./features/personas/MigracionPersonas').then((m) => ({ default: m.MigracionPersonas })),
)
const RedPage = lazy(() => import('./features/red/RedPage').then((m) => ({ default: m.RedPage })))
const TopologiaPage = lazy(() =>
  import('./features/red/TopologiaPage').then((m) => ({ default: m.TopologiaPage })),
)
const TopologiaEquipoPage = lazy(() =>
  import('./features/red/TopologiaEquipoPage').then((m) => ({ default: m.TopologiaEquipoPage })),
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
              {/* Importar inventario re-autorizada en Nocturne (tarea 90,
                  handoff "Rediseño de aplicación empresarial", Importar
                  Dispositivos.dc.html): trae su propio shell a pantalla
                  completa con cabecera pegajosa y barra inferior fija en la
                  revisión, por eso sale del Layout oscuro como las demás. */}
              <Route
                path="dispositivos/importar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <ImportarDispositivosPage />
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
              {/* El asistente del diagnostico tambien va sin barra
                  inferior: una pregunta a la vez, sin distracciones. */}
              <Route
                path="diagnostico/:diagnosticoId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DiagnosticoRunPage />
                  </Suspense>
                }
              />
              {/* Lista del Modo Diagnostico re-autorizada en Nocturne
                  (tarea 81, handoff "Rediseño de aplicación empresarial",
                  Diagnóstico.dc.html): pantalla enfocada a la que se llega
                  desde Inicio (no es pestaña), trae su propio shell
                  centrado con "Volver a Inicio", por eso sale del Layout
                  oscuro heredado como el resto del rediseño. */}
              <Route
                path="diagnostico"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DiagnosticosPage />
                  </Suspense>
                }
              />
              {/* El editor de diagnóstico (tarea 83, mismo handoff,
                  Editor de Diagnóstico.dc.html) trae su propio shell
                  Nocturne a pantalla completa (cabecera pegajosa y barra
                  de acciones fija), por eso sale del Layout oscuro. */}
              <Route
                path="diagnostico/nuevo"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DiagnosticoForm />
                  </Suspense>
                }
              />
              <Route
                path="diagnostico/:diagnosticoId/editar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DiagnosticoForm />
                  </Suspense>
                }
              />
              {/* La ficha de articulo es la primera pantalla del
                  rediseño Nocturne (tarea 58, handoff "Herramienta IT
                  para técnicos"): trae su propio ShellNocturne, por
                  eso va fuera del Layout oscuro. La lista de Soluciones
                  (tarea 59, handoff de Soluciones trasladado a Nocturne)
                  tambien trae su ShellNocturne y sale del Layout. */}
              <Route
                path="soluciones"
                element={
                  <Suspense fallback={<Cargando />}>
                    <SolucionesPage />
                  </Suspense>
                }
              />
              <Route
                path="soluciones/:categoriaId/:articuloId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <ArticuloPage />
                  </Suspense>
                }
              />
              {/* El editor de articulo (tarea del handoff "Editor de
                  Artículo") trae su propio shell Nocturne a pantalla
                  completa (cabecera pegajosa y barra de acciones fija),
                  por eso sale del Layout oscuro como la ficha y la lista. */}
              <Route
                path="soluciones/:categoriaId/nuevo"
                element={
                  <Suspense fallback={<Cargando />}>
                    <ArticuloForm />
                  </Suspense>
                }
              />
              <Route
                path="soluciones/:categoriaId/:articuloId/editar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <ArticuloForm />
                  </Suspense>
                }
              />
              {/* Dispositivos re-autorizada a Nocturne (handoff "Rediseño
                  de aplicación empresarial", Dispositivos.dc.html, tarea
                  85): trae su propio ShellNocturne, por eso sale del
                  Layout oscuro. Red (tarea 91), la topología general
                  (TopologiaPage, tarea 92) y la topología de un equipo
                  (TopologiaEquipoPage, tarea 93) ya están en Nocturne,
                  cada una con su propio ShellNocturne, también fuera
                  del Layout. */}
              <Route
                path="dispositivos"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DispositivosPage />
                  </Suspense>
                }
              />
              {/* La ficha de dispositivo (tarea 86, Ficha de
                  Dispositivo.dc.html) y el editor (tarea 87, Editor de
                  Dispositivo.dc.html) traen su propio shell Nocturne, por
                  eso salen del Layout oscuro. La ficha usa ShellNocturne
                  (sidebar/pestañas) como la ficha de artículo; el editor
                  va a pantalla completa como los demás editores. */}
              <Route
                path="dispositivos/:dispositivoId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DispositivoPage />
                  </Suspense>
                }
              />
              <Route
                path="dispositivos/nuevo"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DispositivoForm />
                  </Suspense>
                }
              />
              {/* Ubicaciones como entidad (grupo N3, tarea 88, Ubicaciones.dc.html):
                  lista con árbol y creación inline, ficha 360, formulario y
                  migración asistida. Re-autorizadas a Nocturne, cada una trae
                  su propio shell enfocado (bajo Dispositivos), por eso salen
                  del Layout oscuro. */}
              <Route
                path="ubicaciones"
                element={
                  <Suspense fallback={<Cargando />}>
                    <UbicacionesPage />
                  </Suspense>
                }
              />
              <Route
                path="ubicaciones/nueva"
                element={
                  <Suspense fallback={<Cargando />}>
                    <UbicacionForm />
                  </Suspense>
                }
              />
              <Route
                path="ubicaciones/migrar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <MigracionUbicaciones />
                  </Suspense>
                }
              />
              <Route
                path="ubicaciones/:ubicacionId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <UbicacionPage />
                  </Suspense>
                }
              />
              {/* Personas como entidad (hallazgo T1 de AUDITORIA_FLUJOS_TI.md):
                  lista plana con creación inline, ficha 360, formulario y
                  migración asistida. Mismo patrón Nocturne que ubicaciones,
                  cada una trae su propio shell enfocado (bajo Dispositivos),
                  por eso salen del Layout oscuro. */}
              <Route
                path="personas"
                element={
                  <Suspense fallback={<Cargando />}>
                    <PersonasPage />
                  </Suspense>
                }
              />
              <Route
                path="personas/nueva"
                element={
                  <Suspense fallback={<Cargando />}>
                    <PersonaForm />
                  </Suspense>
                }
              />
              <Route
                path="personas/migrar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <MigracionPersonas />
                  </Suspense>
                }
              />
              <Route
                path="personas/:personaId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <PersonaPage />
                  </Suspense>
                }
              />
              <Route
                path="personas/:personaId/editar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <PersonaForm />
                  </Suspense>
                }
              />
              <Route
                path="ubicaciones/:ubicacionId/editar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <UbicacionForm />
                  </Suspense>
                }
              />
              <Route
                path="dispositivos/:dispositivoId/editar"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DispositivoForm />
                  </Suspense>
                }
              />
              {/* Dar de baja con cascada (hallazgo L1 de AUDITORIA_FLUJOS_TI.md):
                  resuelve conexiones, credenciales y campos protegidos del
                  equipo antes de fijar el estado. Propia pantalla Nocturne,
                  por eso sale del Layout oscuro como el resto de asistentes. */}
              <Route
                path="dispositivos/:dispositivoId/baja"
                element={
                  <Suspense fallback={<Cargando />}>
                    <DarDeBajaPage />
                  </Suspense>
                }
              />
              {/* Reemplazar equipo (hallazgos L2/L3 de AUDITORIA_FLUJOS_TI.md):
                  tras crear el equipo entrante con ?reemplazaA=<id>, esta
                  pantalla migra sus conexiones, credenciales y campos
                  protegidos. Propia pantalla Nocturne, por eso sale del
                  Layout oscuro como el resto de asistentes. */}
              <Route
                path="dispositivos/:dispositivoId/reemplazo"
                element={
                  <Suspense fallback={<Cargando />}>
                    <ReemplazoPage />
                  </Suspense>
                }
              />
              <Route
                path="red"
                element={
                  <Suspense fallback={<Cargando />}>
                    <RedPage />
                  </Suspense>
                }
              />
              <Route
                path="red/topologia"
                element={
                  <Suspense fallback={<Cargando />}>
                    <TopologiaPage />
                  </Suspense>
                }
              />
              {/* Topología de un equipo re-autorizada a Nocturne (handoff
                  "Rediseño de aplicación empresarial", Topología de
                  Equipo.dc.html): pantalla propia con su ShellNocturne.
                  El bosque general (/red/topologia, sin equipo) vive en
                  TopologiaPage, también en Nocturne (tarea 92). */}
              <Route
                path="red/topologia/:dispositivoId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <TopologiaEquipoPage />
                  </Suspense>
                }
              />
              {/* Inicio re-autorizada a Nocturne (handoff "Rediseño de
                  aplicación empresarial", Inicio.dc.html): trae su propio
                  ShellNocturne (cabecera con estado de sincronizacion,
                  buscador global y pestañas/sidebar), por eso sale del
                  Layout oscuro heredado como las demas pantallas del
                  rediseño. */}
              <Route
                index
                element={
                  <Suspense fallback={<Cargando />}>
                    <InicioPage />
                  </Suspense>
                }
              />
              {/* Boveda re-autorizada a Nocturne por completo (handoff
                  "Rediseño de aplicación empresarial", tarea 97): la lista
                  (BovedaPage), la pantalla de bloqueo (BovedaGuard), el
                  editor de credencial (CredencialForm, Editor de
                  Credencial.dc.html, tarea 104) y la ficha (CredencialPage,
                  Ficha de Credencial.dc.html, tarea 105) traen su propio
                  shell Nocturne, por eso ninguna pasa ya por el Layout
                  oscuro heredado. */}
              <Route path="boveda" element={<BovedaGuard />}>
                <Route index element={<BovedaPage />} />
                <Route path="nueva" element={<CredencialForm />} />
                {/* Migracion asistida (fase P4): detecta secretos que en
                    realidad son de un equipo y los mueve a su ficha. */}
                <Route path="migrar" element={<MigracionCredenciales />} />
                <Route path=":credencialId/editar" element={<CredencialForm />} />
                <Route path=":credencialId" element={<CredencialPage />} />
              </Route>
              {/* Cuenta, Seguridad y Sugerencias del equipo re-autorizadas a
                  Nocturne (tarea 97, sin mockup: se tradujo el diseño
                  heredado): traen su propio shell centrado (mismo patrón
                  que DiagnosticosPage), por eso salen del Layout oscuro. */}
              <Route
                path="cuenta"
                element={
                  <Suspense fallback={<Cargando />}>
                    <CuentaPage />
                  </Suspense>
                }
              />
              <Route
                path="cuenta/seguridad"
                element={
                  <Suspense fallback={<Cargando />}>
                    <SeguridadPage />
                  </Suspense>
                }
              />
              <Route
                path="diagnostico/sugerencias"
                element={
                  <Suspense fallback={<Cargando />}>
                    <SugerenciasEquipoPage />
                  </Suspense>
                }
              />
              {/* Ficha de categoria re-autorizada a Nocturne (tarea 77):
                  era la ULTIMA pantalla en el Layout oscuro heredado, que
                  con esto quedo sin ninguna ruta y se eliminó. */}
              <Route
                path="soluciones/:categoriaId"
                element={
                  <Suspense fallback={<Cargando />}>
                    <CategoriaPage />
                  </Suspense>
                }
              />
              {/* La seccion de credenciales se llamo "Notas" (nombre
                  neutro de discrecion) hasta el 2026-07-09, cuando el
                  usuario decidio volver a llamarla Boveda. La ruta
                  vieja redirige por si quedo algun enlace guardado. */}
              <Route path="notas/*" element={<Navigate to="/boveda" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
