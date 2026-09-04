# Base de Conocimiento Universal — Soluciones IT

**Documento generado por auditoría QA / arquitectura funcional, basado 100% en el código fuente real de la aplicación** (React 18 + TypeScript + Vite + React Router, almacenamiento local‑first en Dexie/IndexedDB sincronizado con Supabase/Postgres mediante una cola de cambios pendientes, PWA instalable con soporte offline). No existe una URL en producción a la que este documento haya navegado: cada afirmación aquí está trazada a un archivo y, cuando ayuda, una línea concreta del repositorio (`D:\Soluciones-IT`), no a una exploración visual de pantallas.

Objetivo del documento: que **cualquier otra IA** (o una persona nueva en el equipo) entienda al 100 % cómo funciona el sistema — su modelo de datos, su navegación, cada formulario campo por campo, cómo se relacionan las entidades entre sí, y las reglas de negocio que gobiernan guardar, cancelar, eliminar y sincronizar — sin tener que abrir la aplicación ni leer el código fuente por su cuenta.

Idioma de la app: español (Colombia). Convención del propio equipo (regla R12/REGLAS.md): las **rutas y los identificadores de código conservan su nombre original** aunque una sección se haya renombrado visualmente (por ejemplo `/dispositivos` sigue siendo la ruta de "Equipos"), para no romper enlaces profundos ya compartidos por el equipo.

---

## Índice

1. Resumen ejecutivo y arquitectura
2. Mapa de relaciones funcionales
3. Desglose sección por sección
   3.1 Chasis compartido y navegación global
   3.2 Inicio (`/`)
   3.3 Buscador global e Historial (transversales)
   3.4 Guías / Soluciones (`/soluciones`)
   3.5 Diagnóstico (`/diagnostico`)
   3.6 Equipos / Inventario (`/dispositivos`)
   3.7 Escanear (`/escaner`)
   3.8 Red (`/red`)
   3.9 Bóveda (`/boveda`)
   3.10 Seguridad de la app (`/cuenta/seguridad`)
   3.11 Ubicaciones (`/ubicaciones`) y Personas (`/personas`)
   3.12 Mi Cuenta, Login y "Más" (`/cuenta`, `/login`, `/mas`)
4. Catálogo de flujos de usuario
5. Matriz de interacciones y atajos
6. Reglas de negocio y hallazgos

---

## 1. Resumen ejecutivo y arquitectura

**Qué es la app.** Soluciones IT es la base de conocimiento y el sistema operativo diario de un equipo pequeño de soporte técnico/IT (departamento de TI de una entidad, en un contexto tipo parque/entidad pública colombiana). Reúne en una sola PWA instalable en el teléfono: procedimientos paso a paso ("Guías"), inventario de equipos, mapa de red, una bóveda de contraseñas cifrada, un asistente de diagnóstico guiado (árbol de decisión), un escáner de códigos QR/de barras, y un directorio de ubicaciones y personas responsables. Está pensada para funcionar **sin conexión**: todo se guarda primero en el teléfono (IndexedDB vía Dexie) y se sincroniza en segundo plano con un backend Supabase compartido por todo el equipo.

**Principio de arquitectura de datos — "punto único de escritura".** Ninguna pantalla escribe directamente en la base: toda creación, edición o eliminación pasa por `guardarRegistro`/`eliminarRegistro` (`src/lib/repositorio.ts`), que en una sola transacción (1) guarda en Dexie sin esperar a la red, (2) genera automáticamente las entradas de **historial** (quién, cuándo, qué campo cambió, de qué a qué), y (3) encola el cambio en `cambiosPendientes` para subirlo a Supabase apenas haya señal. Tres tablas son de **solo inserción** (append-only, nunca se editan): `historial`, `ejecuciones_diagnostico` y `accesos_boveda` — son los tres registros de auditoría/trazabilidad del sistema.

**Principio de "referencia viva".** Cuando una entidad vincula a otra (un Equipo a su Ubicación, una Guía a un Equipo, una Conexión a sus dos extremos), el vínculo se guarda como **id real + copia de texto del nombre** (`{id, nombre}` o `{id, titulo}`). La interfaz siempre intenta resolver el nombre **en vivo** contra la entidad real; si esta ya no existe localmente (no sincronizó aún, o fue eliminada), cae a la copia de texto guardada. Esto permite que la app funcione offline y sin esperar sincronización entre técnicos, al costo de que un cambio de nombre no reescribe automáticamente todas las conexiones — se refleja solo cuando la fila vinculada existe localmente.

**Eliminación = borrado lógico, sin cascada real.** `eliminarRegistro` únicamente marca `eliminadoEn` con la fecha actual; nunca hace un `delete` físico ni limpia referencias en otras tablas. Las pantallas que sí necesitan resolver dependencias antes de eliminar (Dar de baja de un equipo, Reemplazar equipo) lo hacen a mano, con sus propias pantallas dedicadas — no es un mecanismo genérico del repositorio.

**Seguridad en tres capas independientes**, cada una con su propio candado y sin que ninguna sustituya a otra:

| Capa | Protege | Ámbito | Sincronizada | Si se olvida |
|---|---|---|---|---|
| Sesión de cuenta (Supabase Auth, login) | Acceso a la app en general | La cuenta del técnico | Sí (servidor) | El administrador la restablece desde el panel de Supabase (no hay recuperación por correo) |
| Bloqueo de la app (patrón o contraseña) | Que alguien tome el teléfono desbloqueado y navegue | Un dispositivo físico | No | Cerrar sesión (sin necesitar el secreto) y volver a iniciar sesión |
| Contraseña maestra de la Bóveda | El contenido cifrado (AES‑256‑GCM) de credenciales y campos protegidos | Todo el equipo (una sola, compartida) | Sí (solo su verificador cifrado) | **No hay recuperación**: sin ella el contenido cifrado es ilegible para siempre |

### Entidades principales — dónde se crean vs. dónde se consumen

| Entidad (tabla) | Se crea principalmente en | También se crea inline desde | Se consume / referencia desde |
|---|---|---|---|
| **Categoría** (`categorias`) | (fuera del alcance auditado: no tiene pantalla propia de alta visible en el recorrido) | — | Clasifica Artículos, Dispositivos, Diagnósticos; `esRed` decide si sus equipos van a Equipos o a Red |
| **Artículo / Guía** (`articulos`) | `/soluciones/:cat/nuevo` (`ArticuloForm`) | Desde la ficha de un Equipo ("Reportar incidencia"/"Documentar procedimiento"), desde una Sugerencia de Diagnóstico (`?desdeSugerencia=`), duplicando otro artículo (`?copiarDe=`) | Diagnóstico (respuesta → ejecuta procedimiento), ficha de Equipo (procedimientos/problemas aplicables), Historial, Buscador global |
| **Dispositivo / Equipo** (`dispositivos`) | `/dispositivos/nuevo` | Desde el buscador de Inicio sin resultados (`?nombre=`), desde el Escáner sin coincidencia (`?serial=`), duplicando (`?copiarDe=`), reemplazando (`?reemplazaA=`), desde `FormularioConexion` ("Crear equipo nuevo") | Guías (equipos donde aplica), Red/Conexiones, Bóveda (equipos con acceso, campos protegidos), Diagnóstico (categoría), Ubicaciones/Personas (inverso) |
| **Ubicación** (`ubicaciones`) | `/ubicaciones/nueva` | Desde `SelectorUbicacion` embebido en el formulario de Equipo ("+ Crear ubicación nueva"), desde la migración asistida (`/ubicaciones/migrar`) | `Dispositivo.ubicacionId`; ficha de Ubicación muestra sus equipos |
| **Persona** (`personas`) | `/personas/nueva` | Desde `SelectorPersona` embebido en el formulario de Equipo, desde la migración asistida (`/personas/migrar`) | `Dispositivo.responsableId`; ficha de Persona muestra sus equipos |
| **Conexión** (`conexiones`) | `FormularioConexion`, embebido en la ficha de un Equipo o en `TopologiaEquipoPage` | — | Árbol de topología de Red, "Si este equipo falla" (impacto), historial de ambos extremos |
| **Credencial / Secreto de Bóveda** (`credenciales`) | `/boveda/nueva` | Desde la ficha de Equipo ("Guardar secreto", precarga título/categoría/equipo), desde un paso de procedimiento (vínculo protegido) | Pasos de procedimientos (`vinculoProtegido`), ficha de Equipo ("Credenciales de este equipo") |
| **Campo protegido** (`campos_protegidos`) | Sección "Datos protegidos" de la ficha de un Equipo | Desde la migración asistida de Bóveda (una Credencial mal ubicada se convierte en Campo protegido) | Pasos de procedimientos (`vinculoProtegido`, tipo `campo`) |
| **Diagnóstico** (`diagnosticos`) | `/diagnostico/nuevo` | — | `DiagnosticoRunPage` (ejecución), ficha de Equipo ("Iniciar diagnóstico") |
| **Historial** (`historial`, solo inserción) | Automático (`repositorio.ts`) en cada guardado/eliminación/adjunto/conexión | Manualmente vía "Registrar intervención" en la ficha de Equipo | Componente `<Historial>` en toda ficha; "Actividad del equipo" en Inicio |
| **Ejecución de diagnóstico** (`ejecuciones_diagnostico`, solo inserción) | Automático al cerrar `DiagnosticoRunPage` | — | Estadísticas, Sugerencias del equipo, Historial de un Artículo (si lo ejecutó) |
| **Acceso a Bóveda** (`accesos_boveda`, solo inserción) | Automático en cada consulta/revelado/copia/edición/eliminación de un secreto | — | Sección "Actividad" de la ficha de Credencial / Campo protegido |
| **Adjunto** (`adjuntos`) | Botones "Cámara"/"+ Archivos" en cualquier ficha con galería (Artículo, Dispositivo, Historial de intervención) | — | Galerías de fichas; portada de procedimiento y foto de equipo NO usan esta tabla (van embebidas como `PasoAdjunto`) |
## 2. Mapa de relaciones funcionales

Los siete módulos de la app no son compartimentos aislados: comparten un pequeño número de mecanismos transversales que explican por qué, al leer cualquier pantalla, aparecen constantemente los mismos patrones de "ir a", "vincular" o "crear desde aquí". Este mapa describe esos mecanismos de conexión, no cada relación entidad‑por‑entidad (esas ya están en la tabla de la sección 1 y se detallan módulo por módulo en la sección 3).

### 2.1 El eje central: el Equipo (Dispositivo)

`Dispositivo` es la entidad más referenciada del sistema — casi todos los demás módulos existen, en última instancia, para documentar, proteger o diagnosticar equipos:

- **Guías ↔ Equipos.** Un `Articulo` puede declarar `dispositivosAfectados` (a qué equipos aplica) y opcionalmente refinar con `aplicaA` (marca/modelo). Desde la ficha de un Equipo, el bloque "Procedimientos y problemas de este equipo" filtra la lista de Guías por esa relación, y el botón "Reportar incidencia"/"Documentar procedimiento" abre `ArticuloForm` precargando ese equipo como afectado.
- **Bóveda ↔ Equipos.** Una `Credencial` tiene un arreglo `dispositivos` (referencia viva a los equipos que la usan). Desde la ficha de un Equipo, la sección "Credenciales de este equipo" filtra la Bóveda por esa relación; el botón "Guardar secreto" abre el formulario de Credencial precargando título/categoría/equipo. Los `CampoProtegido` (la otra mitad del cifrado) en cambio **no son una tabla aparte referenciada**: viven embebidos dentro de la sección "Datos protegidos" del propio Equipo (`dispositivoId` obligatorio, sin existencia independiente).
- **Diagnóstico ↔ Equipos.** Un `Diagnostico` se clasifica por `Categoria` (la misma tabla de categorías que usan los equipos), y desde la ficha de un Equipo el botón "Iniciar diagnóstico" abre `DiagnosticoRunPage` filtrando los diagnósticos disponibles para la categoría de ese equipo.
- **Red ↔ Equipos.** Toda `Conexion` tiene dos extremos que son IDs de `Dispositivo`. El árbol de topología (`src/features/red/arbol.ts`) es enteramente derivado — no hay una tabla de "topología", se reconstruye en memoria a partir de las conexiones cada vez. `Categoria.esRed` es el interruptor que decide si un equipo aparece en el listado de Equipos/Inventario o en el listado de Red: son la misma tabla `dispositivos`, filtrada por la categoría a la que pertenece cada fila.
- **Ubicaciones/Personas ↔ Equipos.** La relación es inversa a las anteriores: `Dispositivo.ubicacionId` y `Dispositivo.responsableId` apuntan hacia Ubicación/Persona, y son esos módulos (no Equipos) los que muestran "qué equipos hay aquí" resolviendo la relación en sentido contrario. El formulario de Equipo puede **crear** una Ubicación o Persona nueva sin salir de la pantalla (`SelectorUbicacion`/`SelectorPersona` embebidos, ver 2.3).
- **Historial/Auditoría ↔ Equipos.** Cada guardado, eliminación, adjunto o conexión que toca a un equipo genera automáticamente una entrada en `historial` con `entidadTipo='dispositivo'` y `entidadId` = el equipo. La ficha de Equipo agrega además una vía manual: "Registrar intervención", que escribe directamente una entrada de historial sin pasar por `guardarRegistro` (es la única escritura de historial que no es un efecto secundario de otro guardado).

### 2.2 El patrón "vínculo protegido": Guías × Bóveda

El punto de contacto más elaborado del sistema es el **vínculo protegido** dentro de un paso de procedimiento (`PasoProcedimiento.vinculoProtegido`, tipo `VinculoProtegido`). Al editar los Pasos de una Guía, un paso puede declarar que ese paso concreto requiere un dato sensible: una `Credencial` completa (tipo `credencial`) o un `CampoProtegido` puntual de un equipo (tipo `campo`). El vínculo guarda `{tipo, id, etiqueta}` (referencia viva otra vez). En modo lectura (`ProcedimientoVista`) y en modo ejecución guiada (`AsistenteVista`), ese paso muestra un botón "Ver dato protegido" que, si la Bóveda está desbloqueada, revela el valor inline (y registra un `AccesoBoveda` de tipo `consulto`/`mostro`); si la Bóveda está bloqueada, pide la contraseña maestra ahí mismo sin abandonar la guía. Es el único lugar del sistema donde un módulo "presta" un componente de desbloqueo a otro módulo en vez de redirigir de pantalla.

### 2.3 El patrón "crear sin salir": selectores embebidos

Tres formularios permiten dar de alta una entidad relacionada **sin navegar y sin perder lo ya escrito** en el formulario padre:

- `SelectorUbicacion` y `SelectorPersona` (usados dentro de `DispositivoForm`): son un `<select>` con una opción final "+ Crear ubicación/persona nueva" que despliega un mini‑formulario inline (solo Nombre + Dentro de/Notas); al guardar, llama a `guardarRegistro` y hace `onChange()` directamente sobre el estado del formulario de Equipo — no hay remount, modal ni navegación.
- La búsqueda del otro extremo en `FormularioConexion` ofrece, cuando no hay coincidencia, "Crear equipo nuevo" inline (solo en la variante embebida en la ficha de un equipo, no en la de Topología).

Este patrón es deliberado: reconoce que en el flujo real de trabajo ("estoy documentando un equipo nuevo y su ubicación tampoco existe todavía") obligar a salir del formulario a crear la entidad relacionada y volver sería más fricción de la que vale la pena, a costa de que estos mini‑formularios tengan muchos menos campos que sus pantallas completas (`/ubicaciones/nueva`, `/personas/nueva`).

### 2.4 El patrón "sugerencia": Diagnóstico → Guías

Cuando un `Diagnostico` (árbol de decisión) termina en un nodo sin una Guía todavía escrita para ese caso, el sistema registra la ejecución como "no resuelto" con un motivo. `SugerenciasEquipoPage` agrega esos casos no resueltos y los convierte en una cola priorizada de "guías que faltan por escribir"; el botón de cada sugerencia abre `ArticuloForm` con `?desdeSugerencia=` precargando título/categoría a partir del contexto del diagnóstico fallido. Es el único lazo de retroalimentación explícito del sistema: la ejecución real (dato de auditoría, tabla `ejecuciones_diagnostico`) alimenta directamente la producción de contenido nuevo (tabla `articulos`).

### 2.5 El patrón transversal: Buscador global e Historial

`BuscadorGlobal` (accesible desde Inicio) y el componente `<Historial>` (embebido en toda ficha) son los dos únicos mecanismos que **cruzan todas las entidades a la vez** en vez de seguir una relación declarada explícitamente en el modelo de datos:

- El buscador indexa (MiniSearch, en memoria) Guías, Equipos, Ubicaciones, Personas y Credenciales (sin revelar su contenido cifrado, solo título/metadatos) en un solo índice con sinónimos curados, para que buscar "impresora" encuentre tanto el equipo como su guía de configuración y su credencial de administración.
- El Historial unifica tres tablas de auditoría distintas (`historial`, `ejecuciones_diagnostico`, `accesos_boveda`) en una sola línea de tiempo por entidad, y es también la fuente de "Actividad del equipo (de soporte)" en Inicio y de "Actividad" dentro de la ficha de una Credencial.

### 2.6 Resumen visual de dependencias entre módulos

```
                     ┌───────────────┐
                     │   Categoría   │  (esRed decide Equipos↔Red)
                     └───────┬───────┘
                             │ clasifica
        ┌───────────┬───────┼────────┬────────────┐
        ▼           ▼       ▼        ▼             ▼
    ┌───────┐   ┌────────┐ ┌──────┐ ┌──────┐  ┌───────────┐
    │ Guías │◄──┤ Equipo │─┤ Red  │ │Bóveda│  │Diagnóstico│
    └───┬───┘   └───┬────┘ │(Conex│ └──┬───┘  └─────┬─────┘
        │ vínculo    │      │iones)│    │ vínculo    │ sugiere
        │ protegido  │      └──────┘    │ protegido  │ guía
        └────────────┴──────────────────┘            ▼
                      │                            (Guías)
              ubicacionId/responsableId
                      │
              ┌───────┴────────┐
              ▼                ▼
        ┌───────────┐    ┌─────────┐
        │ Ubicación │    │ Persona │
        └───────────┘    └─────────┘

Historial (auditoría) y Buscador global: transversales, tocan todas las entidades de arriba.
```

---

## 3. Desglose sección por sección

Esta sección recorre, una por una, las 12 áreas funcionales de la app en el orden sugerido para la auditoría: jerarquía de pantallas y rutas, cada componente de interfaz, los formularios campo por campo, las relaciones con otras entidades, y las reglas de negocio y comportamientos especiales de cada módulo.

### 3.1 Chasis compartido y navegación global

#### 3.1.1 Jerarquía y rutas

Desde la tarea 185, **todas** las pantallas autenticadas montan el componente `<Chasis>` (`src/app/Chasis.tsx:204`), que antepone `App.tsx` con `BloqueoAppGuard` (`src/App.tsx:153-159`) dentro de `RequireAuth`: si el dispositivo tiene un bloqueo configurado y no está desbloqueado en esta apertura, se muestra la pantalla de bloqueo en vez de cualquier ruta, incluso antes de que el chasis se dibuje.

`Chasis` declara uno de tres niveles posibles (`ModoChasis`, `src/app/Chasis.tsx:64`), que determinan la estructura de cabecera y navegación de cada pantalla de la app:

- **`seccion`** (raíz de pestaña): barra superior de 3 ranuras fijas (título, `PastillaSync`, lupa + avatar) más pestañas inferiores (móvil) o sidebar (escritorio). Ejemplos: Inicio, Más.
- **`documento`** (algo que se lee o recorre): fila de regreso con un ancla permanente que se queda fija al hacer scroll (contexto a 11px + nombre a 14px), acciones propias a la derecha, conserva las pestañas visibles. Ejemplos: `CuentaPage`, `SeguridadPage`.
- **`tarea`** (algo que se hace y de lo que se sale): sin pestañas; en su lugar `BarraTarea` con rótulo, título, ruta de vuelta escrita y una X de salida. Ejemplos: editores, escáner, importador.

La navegación entre estos niveles se rige por dos mecanismos combinados: el **padre lógico** (fuente única `src/lib/navegacion.ts`) y el **origen real del salto** (override de `src/lib/origenNavegacion.ts` / `src/app/useOrigen.ts`), descritos a continuación.

#### 3.1.2 Navegación "Volver" — padre lógico (`src/lib/navegacion.ts`)

- `RAICES_DE_PESTANA = ['/soluciones', '/dispositivos', '/red', '/boveda', '/mas', '/']` (línea 38): estas rutas nunca muestran "Volver" (`padreDe` devuelve `null`) porque son raíces de pestaña.
- `RAICES_NO_TAB` (línea 53-64): mapea raíces que se alcanzan desde otra sección a su padre lógico declarado:
  - `/diagnostico` → `{ to: '/', etiqueta: 'Inicio' }`
  - `/escaner` → `{ to: '/', etiqueta: 'Inicio' }`
  - `/ubicaciones` → `{ to: '/mas', etiqueta: 'Más' }` (desde la tarea 182; antes subía a Equipos)
  - `/personas` → `{ to: '/mas', etiqueta: 'Más' }` (mismo cambio que ubicaciones)
  - `/cuenta` → `{ to: '/', etiqueta: 'Inicio' }`
- `case 'cuenta':` dentro de `padreDe` (línea 127-129): `/cuenta/seguridad` → `{ to: '/cuenta', etiqueta: 'Mi cuenta' }` (`/cuenta` en sí ya queda cubierta por `RAICES_NO_TAB`).
- `default: return { to: '/', etiqueta: 'Inicio' }` (línea 130-131): cualquier ruta no listada explícitamente sube a Inicio como respaldo universal.

#### 3.1.3 Origen de navegación por encima del padre lógico (`src/lib/origenNavegacion.ts`, `src/app/useOrigen.ts`)

Desde la tarea 202 (regla M-R2), el nivel `documento` del chasis prioriza el **origen real del salto** por encima del padre lógico declarado por `padreDe`. El origen se guarda en `location.state.origen` por quien originó el salto, vía `conOrigen(to, etiqueta)`. Orden de prioridad exacto (`Chasis.tsx:279-297`):

1. `origen` — el hecho concreto del recorrido (por ejemplo, "vengo del escáner").
2. Override explícito de la pantalla (`volverA` / `volverEtiqueta`).
3. `padreDe` — siempre existe, es el respaldo final.

El origen se lee de `location.state` (nunca de la URL, para no ensuciar enlaces compartidos) y por lo tanto **no sobrevive** a una recarga de página ni a un enlace profundo (deep link); en esos casos se cae siempre al padre declarado por `padreDe`.

#### 3.1.4 Componentes del chasis — interfaz y comportamiento

| Componente | Nivel / uso | Comportamiento |
|---|---|---|
| `BarraSuperior.tsx` | nivel `seccion` | Tres ranuras fijas siempre en el mismo orden (regla R14): 1) título de sección (`CabeceraColapsable`), 2) `PastillaSync`, 3) botón "Buscar en todo" (icono lupa, abre `BuscadorGlobal`) + avatar (enlace a `/cuenta`, oculto en breakpoint `lg` porque el sidebar de escritorio ya ofrece la cuenta al pie). |
| `BarraTarea.tsx` | nivel `tarea` | Rótulo ("Editando" / "Creando" / "Ejecutando"...), título, ruta de vuelta escrita en texto (p. ej. "Guías › Impresoras · vuelves aquí al terminar") y una X de área táctil 44×44 que navega a `salidaA ?? padreDe(pathname)?.to ?? '/'`, con `aria-label`/`title` por defecto **"Salir sin guardar"**. Si se pasa la prop `alSalir`, la X deja de ser un enlace directo y ejecuta esa función en su lugar (permite confirmar antes de descartar cambios). |
| `BotonVolver.tsx` | usado en nivel `documento` | Botón de regreso unificado; deriva destino y etiqueta de `padreDe` salvo override explícito. Variante `soloIcono` (cuadrado 44px, solo chevron) usada en el ancla permanente del nivel `documento`. |
| `AvisoPestana.tsx` | pestañas móviles | Dos variantes: `punto` (7×7px, sin dato numérico; usado en Guías cuando hay un procedimiento a medias descartado de `BarraReanudar`) y `numero` (badge con conteo real, usado en Más con `usePendientes().length`; muestra "9+" si supera 9). Regla R23: nunca decorativo, solo se muestra si hay un dato real detrás. |
| `ActualizacionDisponible.tsx` | banner global (montado en `App.tsx`, fuera del router) | Aparece cuando `useRegisterSW` detecta una versión nueva en espera (`registerType: 'prompt'`); se comprueba cada hora además de al cargar. Botón **"Actualizar"** pasa a "Actualizando..." y se deshabilita. La recarga la controla siempre el propio componente (nunca delega en la librería, por un bug histórico donde `registration.waiting` podía ser `null` con el aviso ya en pantalla): escucha el evento `controllerchange` y, como red de seguridad, recarga igual a los 2500ms si ese evento no llegó. |
| `BotonInstalarApp.tsx` | usado **solo** en `BienvenidaPrimerDia` y `CuentaPage` (decisión: "nunca como banner intrusivo") | Si `obtenerEstadoInstalacion().puedeInstalar` es `true`, muestra "Instalar" y abre el diálogo nativo vía `instalarApp()`; si no, muestra "Cómo instalar" y abre un modal con 3 pasos manuales (`PASOS_INSTALACION_MANUAL`, `src/lib/instalacionPwa.ts:156-160`). Si el diálogo nativo se rechaza, también cae a las instrucciones manuales. |
| `DescargarOffline.tsx` | tarjeta reutilizable (chasis e Inicio) | "Descargar todo para offline" con botón "Descargar" / "Descargando..." (deshabilitado mientras `progreso.enCurso`). Debajo, según estado: contador "`completados+fallidos` de `total`" mientras está en curso; aviso ámbar si `fallidos > 0` al terminar; o "Última descarga: `fecha`" si terminó sin fallos. Comparte el mismo store (`adjuntosOffline.ts`) que el paso 3 de `BienvenidaPrimerDia`. |
| `PanelSync.tsx` | modal, abierto desde `PastillaSync` | Muestra estado ("Sincronizando..." / "Conectado en tiempo real" / "Conectado (revisa cada 2 minutos)"), última sincronización, cambios por subir; aviso si `sinSesion`; aviso de `ultimoError`; lista de **conflictos recientes** ("Se sobrescribió una edición más reciente de un compañero en..."); y, agrupados por causa, los **cambios rechazados por el servidor** con botón "Descartar (`N` intentos)" que pide confirmación en línea ("¿Descartar este cambio? Se perderá y la ficha volverá a como está en el servidor.") antes de llamar a `descartarCambioPendiente`. Botones de pie: "Reintentar ahora" (dispara `sincronizar()`) y "Cerrar". |
| `PastillaSync.tsx` | ranura 2 de la barra superior | Estado "al día" muestra solo el icono `CloudCheck` sin texto (regla R23); el resto de estados dicen el número real: "Sin conexión" / "Sin conexión · N sin subir" (ámbar), "N con error" (rojo, si `cambiosConError > 0`), "Subiendo" / "N sin subir" (ámbar). Tocarla dispara `sincronizar()` **y** abre `PanelSync` a la vez. |
| `BarraReanudar.tsx` | flotante (móvil, fija sobre las pestañas) o de sidebar (escritorio, al pie del rail) | Muestra el procedimiento a medias más reciente (`useReanudar`). En móvil se descarta **deslizando** horizontalmente (umbral 90px, con umbral de inicio de arrastre de 6px para no robar el toque del botón X ni del enlace) o tocando la X; en escritorio solo con el botón X (sin gesto de arrastre). |
| `Avatar.tsx` | reutilizable | Iniciales del técnico en círculo (`inicialesDe(nombre, correo)`), o el icono genérico `User` si ambas cadenas están vacías. |
| `Marca.tsx` | sidebar de escritorio y Login | Logotipo SVG de la app ("el cerebro"); no forma parte del catálogo de iconos de dominio. |
| `Cargando.tsx` | fallback de `Suspense` | Se dibuja con su propio fondo, antes de que exista el chasis autenticado, para los chunks diferidos. |
| `ErrorBoundary.tsx` | límite de error de toda la app (importado estáticamente en `main.tsx`) | Si el error coincide con el patrón de fallo de chunk (regex de `recargaChunk.ts`: `failed to fetch dynamically imported module`, etc.), recarga automáticamente una vez (ventana de 10s guardada en `sessionStorage` para no entrar en bucle); si no, muestra "No se pudo cargar la aplicación" con botón "Recargar". |

#### 3.1.5 Ranura de banda de tarea (`src/app/bandaTarea.tsx`)

`BandaTarea` es un portal a un hueco (`ranuraTarea`) que `Chasis` publica dentro de su `BarraTarea`, únicamente en el nivel `tarea`. Permite que un componente varios niveles por debajo (por ejemplo, el paso actual del asistente de ejecución de un diagnóstico) pinte contenido pegajoso bajo el título de la barra de tarea sin necesidad de subir todo su estado hasta `Chasis`. Fuera del nivel `tarea` el portal simplemente no pinta nada (no produce error).

#### 3.1.6 Transiciones y memoria de navegación

- **Dirección de transición** (`direccionTransicion.ts`, función `direccionPara`): navegar hacia una pantalla más profunda produce `'entra'`; hacia una menos profunda produce `'vuelve'`; cambiar entre raíces de pestaña produce siempre `'lateral'` (aunque tengan distinta cantidad de segmentos de ruta). Se memoriza la última navegación **procesada** por `location.key`, lo que la hace segura bajo `StrictMode`.
- **Memoria de filtros por pestaña** (`memoriaPestana.ts`, funciones `recordarBusqueda` / `destinoDePestana`): guarda, por cada raíz de pestaña, el último `search` (query string) visto **en esa raíz exacta** — nunca dentro de una ficha interna. El enlace de cada pestaña del chasis usa `destinoDePestana` para reponer ese filtro al volver a ella, salvo si ya se está en esa misma pestaña, en cuyo caso devuelve la raíz pelada (sin query).
- **Memoria de scroll** (`memoriaScroll.ts`, hook `useMemoriaScroll`): restaura la posición vertical guardada por `pathname` al montar (sin animación), reintenta tras 2 frames por si Dexie todavía no había entregado los datos, y guarda la posición también al desmontar.
- **Tocar la pestaña ya activa** (`alTocarPestana`, `Chasis.tsx:239-243`): produce un scroll suave hasta el principio de la página, pero solo si se está EXACTAMENTE en la raíz pelada (sin query string).

#### 3.1.7 Instalación PWA y actualización (mecanismos transversales)

**Instalación (`src/lib/instalacionPwa.ts`)**: implementada como store externo (no como hook con estado propio local a un componente), porque el evento `beforeinstallprompt` dispara **una sola vez y muy temprano** tras cargar la página, y las pantallas de la app se cargan bajo demanda (`lazy`); si el listener viviera dentro de un componente diferido, el evento ya habría pasado cuando ese componente monta. Por eso se importa desde `main.tsx`, evaluado ya en el arranque de la aplicación.

`EstadoInstalacion { instalada, puedeInstalar, requiereManual }`:
- `instalada`: se detecta por `display-mode: standalone` / `minimal-ui`, o por `navigator.standalone` en Safari iOS.
- `puedeInstalar`: pasa a `true` tras capturar el evento `beforeinstallprompt` (se llama `preventDefault()` para nunca mostrar el diálogo nativo del navegador de forma espontánea; siempre se ofrece desde la interfaz propia de la app).
- `requiereManual`: `true` en iOS/iPadOS (detectado por motor WebKit, no por marca de navegador, ya que ningún navegador de iOS dispara `beforeinstallprompt`), o cuando el diálogo nativo ya se usó o fue rechazado una vez.

`instalarApp()`: abre el prompt guardado (solo puede usarse una vez). Si `outcome === 'accepted'`, devuelve `'instalada'` (el estado definitivo lo confirma después el evento `appinstalled`); si se rechaza, cae a `requiereManual: true` y devuelve `'rechazada'`.

**Recuperación de chunk (`src/lib/recargaChunk.ts`)**, consumida por `ErrorBoundary` (ver 3.1.4): detecta el patrón de mensaje de import dinámico fallido (típico tras publicar una versión nueva de la app, cuando el navegador aún tiene el `index.html` viejo y pide un chunk cuyo nombre ya no existe) y recarga la página **una sola vez**, con una ventana de 10 segundos guardada en `sessionStorage` para no entrar en un bucle de recargas si el problema real es otro (por ejemplo, sin conexión).

#### 3.1.8 Relaciones y reutilización de datos

El chasis no posee datos de dominio propios; es la capa que orquesta y expone a cada pantalla: el estado de sincronización (`PastillaSync`/`PanelSync`, consumiendo la cola `db.cambiosPendientes` y el estado de `sync.ts`), el estado de bloqueo del dispositivo (`BloqueoAppGuard`, consumiendo `db.seguridadApp`), el conteo de pendientes (`usePendientes()`, compartido con Inicio) para el badge de la pestaña "Más", el procedimiento a medias (`useReanudar`, compartido con el bloque "Continuar donde quedaste" de Inicio) y el progreso de descarga offline (`adjuntosOffline.ts`, compartido entre `DescargarOffline` y `BienvenidaPrimerDia`).

#### 3.1.9 Comportamientos y reglas de negocio

- Ninguna pantalla autenticada puede evitar `BloqueoAppGuard`: se antepone incluso al chasis.
- El origen de navegación por `location.state` es efímero por diseño: una recarga de página o un enlace profundo siempre caen al padre lógico declarado en `navegacion.ts`, nunca se persiste.
- La X de `BarraTarea` es el único punto de salida del nivel `tarea`; su comportamiento por defecto es una navegación directa ("Salir sin guardar"), y solo se convierte en un punto de confirmación si la pantalla que la usa pasa explícitamente `alSalir`.
- Los indicadores de aviso (`AvisoPestana`, `PastillaSync` en estado "al día") siguen la regla R23 de la app: nunca son puramente decorativos, solo aparecen cuando hay un dato real que justifique mostrarlos.
- La actualización de versión y la recuperación de chunk nunca dependen de que el usuario recargue manualmente: ambas tienen su propio mecanismo de reintento acotado (2500ms de red de seguridad en un caso, ventana de 10s antibucle en el otro) para no dejar a un técnico con la app rota tras publicar una versión nueva.

---

### 3.2 Inicio (`/`)

#### 3.2.1 Jerarquía y rutas

`InicioPage.tsx`, ruta `/`, nivel de chasis `seccion`. Es la única pestaña que, además de la lupa global del chasis (que abre la capa `BuscadorGlobal`, ver 3.3), conserva su propio **buscador en línea** integrado en el cuerpo de la pantalla, porque, según el comentario del propio código (`InicioPage.tsx:169-171`), "esta pantalla ES el buscador: abrir y buscar toma dos toques".

Desde Inicio se navega, según el bloque, hacia: fichas de artículo (`/soluciones/{categoriaId}/{id}`), el flujo de diagnóstico (`/diagnostico`, `/diagnostico/estadisticas`), el escáner (`/escaner`), el alta de equipo (`/dispositivos/nuevo`, con posible query `?nombre=`), y hacia cualquier entidad que aparezca en Pendientes, Favoritos, Recientes o Actividad del equipo (artículos, dispositivos, credenciales, etc.).

#### 3.2.2 Componentes e interfaz — buscador en línea

| Elemento | Comportamiento |
|---|---|
| `<input type="search">` | `placeholder="Buscar en todo: artículos, equipos, bóveda"`, `aria-label="Buscar en todo el conocimiento del equipo"` (`InicioPage.tsx:192-199`). |
| Botón "Borrar búsqueda" | Icono `XCircleFill`, visible solo cuando hay texto escrito. |
| Manejo de la escritura | `query` (sin retraso) alimenta el `value` del input; `queryDiferida = useDeferredValue(query)` alimenta todo lo derivado (buscar, pintar resultados), de modo que escribir se siente instantáneo aunque el cálculo de resultados vaya un paso detrás (`InicioPage.tsx:66-74`). |
| Estado sin coincidencias | "Sin coincidencias" + "Nada coincide con «{consultaCruda}». Prueba otra palabra o revisa la ortografía." + botones **"Crear equipo"** (navega a `/dispositivos/nuevo?nombre=<texto>`) y **"Limpiar búsqueda"**. |

#### 3.2.3 Bloques del modo "sin buscar" — orden exacto de renderizado

| # | Bloque | Condición de aparición | Contenido / enlace |
|---|---|---|---|
| 0 | `BienvenidaPrimerDia` | Solo si `consultasListas` (espera a que `enCurso !== undefined` para no parpadear) y `debeMostrarBienvenida` (ver 3.2.4) | Ver 3.2.4 |
| 1 | "Continuar donde quedaste" | `enCurso`: primer artículo vivo (no eliminado) con `hechos > 0 && hechos < total`, tomado de `db.progresoPasos` ordenado por `actualizadoEn` descendente | Tarjeta con barra de progreso e icono `Play`; enlaza a `/soluciones/{categoriaId}/{id}` |
| 2 | Atajos rápidos | Siempre visible | Grid de 2 columnas: "Diagnóstico inteligente" → `/diagnostico`; "Escanear equipo" → `/escaner`; "Registrar equipo" → `/dispositivos/nuevo` (a lo ancho, `col-span-2`) |
| 3 | "Problemas frecuentes" | `problemasFrecuentesInicio(...).length > 0` | Ver 3.2.5; enlace "Estadísticas" → `/diagnostico/estadisticas` |
| 4 | "Pendientes" | `usePendientes().slice(0, 6)` | Ver 3.2.6 |
| 5 | "Favoritos" | Solo si hay al menos uno (`obtenerFavoritos()`) | Grid `@2xl:grid-cols-2` |
| 6 | "Recientes" | Siempre visible | Estado vacío: "Aún no hay elementos recientes. Lo que se consulte aparece aquí." |
| 7 | "Para empezar" | Solo si hay artículos con `esRutaInicio: true`, publicados y no eliminados | Ordenados por `ordenRutaInicio` y luego por título; numerados 1..N. En ancho `@2xl` comparte fila con "Recientes" en dos columnas |
| 8 | "Actividad del equipo" | Solo si `obtenerActividadReciente()` devuelve algo | Ver 3.3.6 |
| 9 | `<DescargarOffline />` | Siempre, al final | Ver tabla de componentes del chasis (3.1.4) |

#### 3.2.4 Bienvenida del primer día (`bienvenida.ts`, `BienvenidaPrimerDia.tsx`)

Lógica pura en `bienvenida.ts`. Tres pasos fijos (`pasosBienvenida`, línea 42-54):

| Paso | Etiqueta | Se marca hecho cuando |
|---|---|---|
| `sesion` | "Entraste con tu cuenta" | **Siempre `hecho: true`** — la pantalla solo se ve con sesión abierta; aparece para demostrar que la lista "se apaga sola" |
| `instalar` | "Instala la app en el teléfono" | `obtenerEstadoInstalacion().instalada` |
| `offline` | "Descarga todo para trabajar sin señal" | `obtenerProgresoDescarga().ultimaDescarga !== null` |

`siguiente: true` se asigna únicamente al primer paso pendiente (se pinta en acento; el resto de pendientes queda en tono neutro, regla R1: un solo lenguaje de color por superficie).

**Regla de visibilidad** (`debeMostrarBienvenida`, línea 65-68): se oculta si `hayBloquesReales` (Inicio ya tiene recientes, pendientes, o un procedimiento a medias) **o** si ya no queda ningún paso pendiente. No existe botón para cerrarla manualmente: se retira sola cuando deja de cumplirse la condición.

**Presentación**: "Bienvenido, {nombre de pila}" (o "Bienvenido" a secas si no hay nombre), párrafo fijo ("Aquí vive lo que el equipo sabe hacer..."), lista de 3 pasos con marca (check verde si hecho, número en círculo si falta). El paso "instalar" incluye `<BotonInstalarApp />` en línea mientras no esté hecho; el paso "offline" trae un botón propio "Descargar" / "`completados+fallidos` de `total`" que llama a `descargarTodoOffline()` — comparte el mismo store que `DescargarOffline`, de modo que el progreso se refleja en ambos sitios simultáneamente.

#### 3.2.5 "Problemas frecuentes" (`problemasFrecuentes.ts`)

`problemasFrecuentesInicio(ejecuciones, diagnosticosVivos, limite=4)`: si **no** hay ninguna ejecución de diagnóstico registrada todavía, cae a un modo "recientes" (los diagnósticos vivos más recientes por `updatedAt`, mostrando "Nuevo" en vez de un conteo porque `ejecuciones: null`). Con ejecuciones ya existentes, reutiliza `problemasMasFrecuentes` de `features/diagnostico/estadisticas.ts` (fuera de este alcance) y filtra los diagnósticos ya eliminados. Cada fila muestra el conteo: "1 vez" / "N veces" / "Nuevo".

#### 3.2.6 "Pendientes" (`pendientes.ts`, `usePendientes.ts`)

No existe una entidad "pendiente" propia; se deriva de datos ya existentes en otras tablas (decisión D5 de `PROPUESTA_JORNADA_TECNICO.md`). Cuatro fuentes combinadas por `calcularPendientes`, con las **credenciales y campos protegidos vencidos primero** por ser lo más urgente:

| Fuente | Función | Condición | Tono visual |
|---|---|---|---|
| Borradores propios | `borradoresPropios` | `articulo.estado === 'borrador' && updatedBy === usuarioId`, no eliminado | neutro |
| Credenciales por vencer | `credencialesPorVencer` | `estadoVencimiento(venceEn)` no nulo; **solo si `puedeVerBoveda`** | error (vencida) / precaución (próxima) |
| Campos protegidos por vencer | `camposProtegidosPorVencer` | ídem, con `dispositivoId` no nulo; **solo si `puedeVerBoveda`** | error / precaución |
| Sugerencias sin revisar | `sugerenciasSinRevisar` | `motivo === 'encontro_otra_solucion'`, `solucionPropuesta` no vacío, **y** que ningún artículo vivo tenga `origenSugerenciaId` igual al de la ejecución (cierre del bucle, hallazgo K2) | neutro |

`usePendientes()` (también usado por el chasis para el número de la pestaña "Más" mediante `AvisoPestana` variante `numero`) trae las 5 consultas Dexie necesarias con `limite: Infinity`; `InicioPage` recorta el resultado a 6 con `.slice(0, 6)`.

Iconos por categoría (`InicioPage.tsx:555-565`): `borrador` → `PencilSimple`; `credencial` / `campo_protegido` → `LockSimple`; `sugerencia` → `Lightbulb`.

#### 3.2.7 Recientes y Favoritos (`src/lib/recientes.ts`, `src/lib/favoritos.ts`)

Ambos son **tablas locales no sincronizadas** (`db.recientes`, clave `{tipo}:{entidadId}`; `db.favoritos`, misma clave). Ambos resuelven título, subtítulo y ruta **en vivo** contra la ficha real (nunca guardan una copia), de modo que:
- una ficha eliminada se omite silenciosamente de la lista, sin borrar el registro de favorito: si la ficha reaparece al sincronizar, el favorito vuelve a aparecer solo;
- un cambio de nombre de la ficha se refleja de inmediato en la lista.

`registrarVisita(tipo, entidadId)` hace un `put` (upsert por clave) y recorta a `MAX_RECIENTES = 20`, borrando las visitas más antiguas si se excede el límite.

`alternarFavorito(tipo, entidadId)` es un toggle simple (`delete` si ya existe, `put` si no) que devuelve el nuevo estado booleano; `esFavorito` consulta por clave.

#### 3.2.8 Relaciones y reutilización de datos

Inicio no tiene datos propios: agrega y resume información de `db.progresoPasos`, `db.ejecuciones_diagnostico`, `db.historial` (vía Actividad del equipo, ver 3.3.6), `db.recientes`, `db.favoritos`, credenciales y campos protegidos de la bóveda (con verificación de permiso `puedeVerBoveda`), y artículos marcados `esRutaInicio`. Comparte estado en vivo con el chasis (badge de "Más", `BarraReanudar`) y con `CuentaPage`/`SeguridadPage` (progreso de instalación y de descarga offline).

#### 3.2.9 Comportamientos y reglas de negocio

- El buscador en línea de Inicio y la capa `BuscadorGlobal` comparten exactamente el mismo motor e índice (ver 3.3); la diferencia es puramente de envoltorio visual.
- Ningún bloque de Inicio se muestra si su condición de datos no se cumple: no hay placeholders vacíos salvo "Recientes" (que sí declara explícitamente su estado vacío) y el estado sin coincidencias del buscador.
- La visibilidad de "Bienvenida del primer día" es puramente derivada (sin bandera de "cerrado manualmente" persistida): desaparece en cuanto Inicio deja de estar "vacío" de contenido real o se completan los 3 pasos.
- El acceso a Pendientes de tipo credencial/campo protegido respeta el permiso `puedeVerBoveda` a nivel de fuente de datos, no solo de presentación: un técnico sin ese permiso ni siquiera dispara esas dos consultas.

---

### 3.3 Buscador global e Historial (transversales)

#### 3.3.1 Jerarquía y componentes del buscador

El Buscador Global existe en dos envoltorios que comparten el mismo índice, la misma lógica de agrupación y la misma presentación de fila de resultado; solo cambia la capa visual:

- **`BuscadorGlobal.tsx`** — capa a pantalla completa, se abre desde la lupa de `BarraSuperior.tsx` (estado `buscadorAbierto`, montado solo cuando `abierto` es verdadero). Se renderiza como portal a `document.body` (necesario porque la barra superior usa `backdrop-blur`, que crea un bloque contenedor que rompería un `fixed inset-0`).
- **Buscador en línea de Inicio** — descrito en 3.2.2, mismo motor, presentación inline en vez de capa.

Comportamiento de la capa `BuscadorGlobal`:
- Al abrirse: `document.body.style.overflow = 'hidden'`, foco automático en el input, y la tecla `Escape` la cierra (listener en `document`).
- Al cerrarse: `query` se resetea a `''` — la capa siempre se abre limpia, sin importar desde qué pestaña se invocó.
- Estado sin buscar: párrafo que declara el alcance de la búsqueda ("Busca en todo a la vez: Guías, Equipos, Bóveda, Ubicaciones y Personas. Tolera errores de escritura y entiende sinónimos («backup» encuentra «copia de seguridad»)").
- Estado sin coincidencias: mismo patrón que Inicio (botones "Crear equipo" con `?nombre=` y "Limpiar búsqueda"), pero aquí ambos botones cierran también la capa (`onNavegar={onCerrar}` en el enlace de crear).

#### 3.3.2 Motor de búsqueda (`useIndiceBusqueda.ts`, `resultados.ts`, `sinonimos.ts`)

- Índice **único de MiniSearch en memoria**, reconstruido por completo (`useMemo`) cada vez que cambian los datos locales relevantes, vía `useLiveQuery`. Nunca consulta al servidor.
- Opciones fijas del índice (`crearIndiceDesdeDocumentos`, línea 311-324): `fuzzy: 0.2`, `prefix: true`, `boost: { titulo: 3, subtitulo: 1.5 }`, `combineWith` por defecto de la librería = **OR**.

**Qué se indexa, por tipo de entidad:**

| Tipo | Condición de inclusión | Texto indexado |
|---|---|---|
| `articulo` | `estado === 'publicado'` (o `?? 'publicado'` para filas antiguas) y no eliminado | Título + contenido Markdown + `textoDeProcedimiento` + etiquetas + síntomas + causas + nombres de dispositivos afectados |
| `dispositivo` | No eliminado (sin filtro de estado) | Todos los campos de texto libre + **todos los valores** de `detalles` (propiedades personalizadas) |
| `diagnostico`, `categoria`, `ubicacion`, `persona` | No eliminados | Campos propios de cada entidad |
| `adjunto` | El dueño debe resolver localmente; se descarta si es huérfano | Adjuntos de galería de un paso de artículo y adjuntos de la tabla `adjuntos` |
| `credencial` y campo protegido (indexado como `tipo: 'dispositivo'`, no existe tipo propio) | **Solo si `bovedaDesbloqueada` es `true`** (flag de sesión en memoria) | Nunca se indexa `datosCifrados` ni `valorCifrado` |

- `buscar(indice, consulta)`: expande la consulta con sinónimos (`expandirConsulta`) y mapea el resultado de MiniSearch a `ResultadoBusqueda { id, tipo, titulo, subtitulo, ruta, portadaRef }`.
- `portadaRef` se calcula (portada de procedimiento, foto de dispositivo, o la propia referencia si el adjunto es imagen), pero **ningún componente dentro de este alcance lo pinta**: `FilaResultado` usa un icono genérico por tipo (confirmado por `BUSCADOR.md` §3, estado real 2026-07-24: deuda pendiente).
- `buscarSimilares` / `buscarArticulosSimilares` (viven en el mismo módulo, fuera del alcance de uso directo aquí): exigen coincidencia en el campo `titulo`, excluyen el id propio y truncan a 3 resultados. Se usan en `ArticuloForm` / `DiagnosticoForm` (fuera de alcance) para el aviso de posible duplicado.

**Sinónimos (`sinonimos.ts`)**: 12 grupos curados a mano (línea 16-29): `backup/respaldo/copia de seguridad`, `internet/red/wifi/ip/conexion`, `impresora/impresion/imprimir`, `contraseña/clave/password`, `computador/computadora/pc/equipo`, `camara/cctv/video`, `pos/datafono/punto de venta`, `correo/email`, `servidor/server`, `pantalla/monitor`, `lento/lentitud/demorado`, `encender/prender`. Solo las entradas de una sola palabra funcionan como clave detectable en la consulta escrita; las de varias palabras (por ejemplo "copia de seguridad") solo se agregan como expansión, no se detectan como término escrito. La expansión conserva siempre los términos originales primero y solo agrega términos (nunca resta, porque MiniSearch combina con OR).

#### 3.3.3 Agrupación y presentación de resultados

`GRUPOS_BUSQUEDA` (`resultados.ts`, línea 44-58) define **5 grupos en orden fijo**:

| Orden | Grupo | Tipos incluidos |
|---|---|---|
| 1 | Guías | `diagnostico`, `categoria`, `articulo`, `adjunto` |
| 2 | Equipos | `dispositivo` |
| 3 | Bóveda | `credencial` |
| 4 | Ubicaciones | `ubicacion` |
| 5 | Personas | `persona` |

`agruparResultados` filtra la lista final a solo los grupos que tienen al menos un resultado.

`FilaResultado`: icono y tono según `VISUAL_POR_TIPO` (línea 30-39: artículo/categoría/diagnóstico en acento; dispositivo en verde éxito; credencial/adjunto/ubicación/persona en neutro); título con el término resaltado (`partirTitulo`, resalta el primer match literal normalizado; si no hay match literal — porque el hit vino de búsqueda difusa o por sinónimo — no resalta nada); subtítulo; flecha de navegación. La prop `onNavegar` (opcional) se pasa desde la capa global para cerrarla al elegir un resultado; el buscador en línea de Inicio no la pasa.

#### 3.3.4 El componente `<Historial>` — estructura

Componente reutilizable `<Historial entidadTipo entidadId />`, montado dentro de las fichas de categoría, artículo, dispositivo, credencial, diagnóstico, ubicación, persona y campo protegido (esas fichas quedan fuera de este alcance directo, pero el componente `Historial` en sí sí está dentro).

Colapsado por defecto (`abierto`, botón toggle con `aria-expanded`). Cabecera: "Historial" + conteo ("Sin cambios" / "N cambio(s)") + chevron. Al abrir, lista `<ul>` de eventos, o el texto "Sin cambios registrados" si está vacía.

#### 3.3.5 Fuentes combinadas — línea de tiempo unificada (`lineaDeTiempo.ts`, fase N4)

Tres tablas distintas se fusionan cronológicamente en un solo `<Historial>`:

| Fuente | Condición de inclusión |
|---|---|
| `db.historial` (`HistorialEntrada`, append-only editable vía repositorio) | Siempre |
| `db.ejecuciones_diagnostico` | **Solo si `entidadTipo === 'articulo'`**, filtrando las ejecuciones cuyo `articulosEjecutados` incluya ese id |
| `db.accesos_boveda` | **Solo si `entidadTipo === 'credencial'` o `'campo_protegido'`**, filtrando por `credencialId === entidadId` **y** `(entidadTipo ?? 'credencial') === entidadTipo` (las filas anteriores al grupo P1 no traen `entidadTipo` propio y se leen como `'credencial'` por defecto) |

`combinarEventos` (`lineaDeTiempo.ts:16-29`) une las tres fuentes y las ordena por `fechaHora` descendente (más reciente primero).

**Presentación por tipo de evento (`EventoItem`):**

- **`EjecucionItem`**: usuario, fecha, "Ejecutó el diagnóstico *{título}*" (enlace a `/diagnostico/{id}`), etiqueta de resultado (`etiquetaResuelto`: Resuelto / No resuelto / Abandonado) más duración formateada (`formatearDuracion`: "45 s" / "3 min" / "3 min 20 s"), y "Solución propuesta: …" si trae texto libre.
- **`AccesoItem`**: usuario, fecha, `etiquetaAccesoBoveda(acceso)` — usa `ETIQUETA_ACCION_BOVEDA` (Consultó la ficha / Mostró la contraseña / Copió el usuario / Copió la contraseña / Modificó el secreto / Eliminó el secreto / Descargó el archivo) o, si `entidadTipo === 'campo_protegido'`, `ETIQUETA_ACCION_CAMPO` (mismas acciones con lenguaje de "dato protegido" en vez de "secreto"/"ficha").
- **`EntradaItem`**: usuario, fecha, y el texto según el campo modificado:
  - `campo === 'procedimiento'` → `CambioProcedimiento` (resumen en lenguaje natural, ver 3.3.6).
  - `campo === 'detalles'` → `CambioDetalles` (diff clave por clave, ver 3.3.6).
  - resto → `descripcionEntrada(entrada)` (ver 3.3.6).
  - Si `campo === 'intervencion'`, se muestra además la galería `<Adjuntos entidadTipo="historial" entidadId={entrada.id} />` (fuera de alcance directo, pero se cita porque cuelga del historial).
  - Si `entrada.motivo` no está vacío, se muestra "Motivo: {motivo}" debajo del texto principal.

#### 3.3.6 Resúmenes de cambio y texto por defecto

**Resumen de cambios de procedimiento (`resumenProcedimiento.ts`)**: en vez de volcar el JSON completo, describe en lenguaje natural pasos agregados/eliminados/reordenados, cambios por paso (título, objetivo, tareas, avisos, imágenes — contadas juntas galería e intercaladas, vínculo protegido, subprocedimiento, solución de error), requisitos, verificación final, objetivo general, descripción, portada (comparada por referencia de Storage: un reemplazo se lee como baja+alta) y tiempo estimado/dificultad. El JSON crudo de antes/después queda plegado bajo un `<details>` "Detalle técnico" para depuración. `diffLista` interpreta un elemento que desaparece más otro que aparece como una **edición** (no como baja+alta), de modo que cambiar una palabra de una instrucción se lee "se editó" y no "se eliminó y se agregó".

**Resumen de cambios de "Campos adicionales" (`resumenDetalles.ts`)**: compara clave por clave el `Record<string,string>` de `detalles`: "Se agregó el campo «X»: «Y»." / "Se quitó el campo «X» («Y»)." / "Se cambió «X»: «Y» → «Z»." Si no detecta nada específico (datos corruptos), cae a "Se actualizaron los campos adicionales."

**Descripción por defecto de una entrada (`textoHistorial.ts`, función `descripcionEntrada`)** — casos especiales según `campo`:

| Campo | Texto generado |
|---|---|
| `intervencion` | El propio `valorNuevo` (texto libre de la nota manual) |
| `creacion` | "Se creó: {valorNuevo}" |
| `eliminacion` | "Se eliminó: {valorAnterior}" |
| `adjunto` | "Se agregó el adjunto: {valorNuevo}" |
| `procedimiento` / `detalles` | Texto de respaldo genérico (la vista real es `CambioProcedimiento` / `CambioDetalles`; esto solo evita volcar JSON crudo si algo falla) |
| `conexion` | "Se agregó la conexión: {valorNuevo}" o "Se quitó la conexión: {valorAnterior}" |
| Genérico (cualquier otro campo) | `{etiqueta}: se definió como "{valorNuevo}"` / `{etiqueta}: se quitó "{valorAnterior}"` / `{etiqueta}: "{valorAnterior}" → "{valorNuevo}"`, con `etiqueta = etiquetaDeCampo(campo)` (diccionario español de unos 25 nombres de campo, línea 5-38; si el campo no está en el diccionario se usa el nombre crudo) |

#### 3.3.7 "Actividad del equipo" — bloque de Inicio (`actividadEquipo.ts`)

Vista **compartida** entre todo el equipo (a diferencia de Recientes/Favoritos, que son personales de cada técnico), derivada de `historial` + `ejecuciones_diagnostico`, sin tabla propia adicional.

- **Lista blanca de tipos visibles** (`TIPOS_VISIBLES = ['articulo', 'dispositivo', 'diagnostico']`, línea 26): excluye a propósito `categoria`/`ubicacion` (housekeeping, sin interés operativo) y `credencial`/`campo_protegido` — grupo P1: mostrar qué secreto se editó filtraría su título incluso a técnicos sin permiso de bóveda, e Inicio no aplica lectura condicional por permiso en este bloque, así que se excluyen **siempre**, no solo para quien carece del permiso. Al ser lista blanca, un tipo de entidad nuevo queda fuera del feed hasta que alguien lo agregue explícitamente.
- **Agrupación en ráfagas** (`agruparActividad`): entradas del mismo usuario sobre la misma ficha, separadas por menos de `UMBRAL_RAFAGA_MIN = 30` minutos entre sí, se colapsan en un solo renglón (por ejemplo, "Ana editó X (3 cambios)"). La acción mostrada se decide por si el grupo contiene una entrada `campo === 'eliminacion'` (→ "eliminó"), `campo === 'creacion'` (→ "creó"), o ninguna de las dos (→ "editó").
- Cada ejecución de diagnóstico es siempre su propio evento independiente (nunca se agrupa con otras).
- `obtenerActividadReciente(limite=5)`: trae como máximo `MAX_HISTORIAL_A_REVISAR = 60` entradas más recientes por índice de `fechaHora` (nunca hace `toArray()` completo, porque el historial crece sin límite), agrupa las entradas, y resuelve cada fila contra la ficha viva (`resolverFicha`); una ficha eliminada omite su fila del resultado.
- `tiempoRelativo(iso)`: "justo ahora" (menos de 1 minuto), "hace N min" (menos de 60 min), "hace N h" (menos de 24 h), "hace N d" (menos de 7 días), y más allá cae a fecha corta con `Intl.DateTimeFormat('es', ...)`.

#### 3.3.8 Origen de los datos — repositorio y sincronización

**`src/lib/repositorio.ts` — punto único de escritura.** `guardarRegistro(tabla, entidad, motivo='')` y `eliminarRegistro(tabla, id, motivo='')` son el único camino de escritura de toda la app (comentario, línea 16-20). Cada llamada, dentro de una transacción Dexie:

1. Compara `anterior` contra `nueva` campo por campo (`huboCambios`, ignora `updatedAt`/`updatedBy`); si no cambió nada real, no hace nada.
2. Construye entradas de historial (`construirHistorial`), con reglas especiales:
   - `CAMPOS_SIN_HISTORIAL` (línea 208-216): `id`, `updatedAt`, `updatedBy`, `eliminadoEn`, `ubicacionId`, `responsableId`, `reemplazaA` no generan su propia entrada (las copias legibles `ubicacion`/`responsable` sí la registran; `reemplazaA` se fija una única vez al crear y su trazabilidad vive en la ficha, no en el historial).
   - Tabla `conexiones`: genera una entrada **por cada extremo** (los dos dispositivos), campo `'conexion'`, solo al crear o eliminar (una conexión nunca se edita: se quita y se vuelve a crear).
   - Tabla `adjuntos`: genera una entrada colgada del dueño (`articulo`/`dispositivo`), salvo si `entidadTipo === 'historial'` (una foto de una intervención no genera historial sobre el propio historial).
   - Formateo especial (`formatearValor`): `datosCifrados`/`valorCifrado` → `"(cifrado)"` o `""` (nunca el valor real); `dispositivosAfectados`/`dispositivos` → lista de nombres en vez de JSON con ids; `aplicaA` → `"Marca: X · Modelo: Y"`; `nodos` (de un diagnóstico) → `"N preguntas"`.
3. Guarda la entidad, agrega las entradas de historial (`bulkAdd`), **encola el cambio de la entidad** para subir (`encolarCambioDeEntidad`, con `baseActualizadoEn` capturado del `anterior?.updatedAt` — la versión de la que partió esta edición, usada después para detectar conflictos) y **encola cada entrada de historial por separado** (`encolarEntradasDeHistorial`).
4. Fuera de la transacción, llama a `sincronizarPronto()` (`programarSync`, con debounce de 800ms para agrupar varios cambios seguidos en una sola pasada de sync).

`registrarIntervencion`, `registrarEjecucionDiagnostico` y `registrarAccesoBoveda` son variantes de solo-inserción para las tablas append-only (`historial` vía intervención manual, `ejecuciones_diagnostico`, `accesos_boveda`).

**`src/lib/sync.ts` — cola de cambios pendientes y descarga.**

- **Subida** (`subirCambiosPendientes`): recorre `db.cambiosPendientes` en orden de creación. Antes de subir, si la tabla no es de solo-inserción y el cambio trae `baseActualizadoEn`, compara contra el `updated_at` remoto actual (`mensajeSiHayConflicto`/`esConflicto`): si el servidor ya tiene algo más nuevo, un compañero editó la misma ficha mientras el cambio esperaba en cola — **no cambia la resolución** (gana la última escritura de todas formas), solo lo reporta como "conflicto reciente" en el `PanelSync`. Un error de clave duplicada (`23505`) en una tabla de solo-inserción se trata como éxito. Un error de red aborta todo el lote (se reintenta completo en la próxima pasada); un error de servidor distinto se anota en el propio `CambioPendiente` (`error`, `intentos++`) y se sigue con el resto de la cola.
- **Descarga** (`descargarTabla`): por cursor incremental sobre `columnaCursor` (`updated_at` o `recibido_en` según la tabla), con un margen de 5 minutos hacia atrás para no perder filas confirmadas fuera de orden. `aplicarFilasRemotas` **nunca pisa una fila con un cambio local pendiente de subir** (regla anti-pisado): la conserva local hasta que ese cambio suba y ambas versiones converjan.
- **Tiempo real**: un único canal de Supabase Realtime (`cambios-equipo`, sin filtro de tabla) se usa solo como **señal** para disparar `programarSync()`, nunca aplica directamente el payload del evento — así el dato siempre respeta RLS al pasar por una consulta real.
- `descartarCambioPendiente(id)`: salida de emergencia desde `PanelSync` (ver 3.1.4) — quita el cambio de la cola y, con la mejor voluntad, intenta restaurar la versión del servidor de esa ficha (o borrarla localmente si nunca llegó a existir en el servidor).

#### 3.3.9 Relaciones y reutilización de datos

El buscador consume prácticamente todas las tablas de dominio (artículos, dispositivos, diagnósticos, categorías, ubicaciones, personas, adjuntos, credenciales y campos protegidos) para construir un único índice; es el consumidor transversal por excelencia. El componente `Historial` es igualmente transversal: se monta desde 7 tipos distintos de ficha y lee de 3 tablas distintas según el tipo de entidad anfitriona. El bloque "Actividad del equipo" de Inicio (3.2.3, posición 8) reutiliza directamente la infraestructura de `Historial`/`lineaDeTiempo` pero con su propia lista blanca de tipos y su propia agrupación en ráfagas.

#### 3.3.10 Comportamientos y reglas de negocio

- La bóveda (credenciales, campos protegidos) solo se indexa para búsqueda mientras está desbloqueada en la sesión actual (`bovedaDesbloqueada`); nunca se indexan los valores cifrados en sí.
- El historial de una entidad nunca se pisa ni se reescribe: es estrictamente append-only, generado automáticamente por `repositorio.ts` en cada escritura real (comparando campo por campo) y complementado por dos tablas append-only adicionales (`ejecuciones_diagnostico`, `accesos_boveda`) que se fusionan solo en la presentación, no en el almacenamiento.
- Cualquier valor sensible (`datosCifrados`, `valorCifrado`) queda deliberadamente ilegible tanto en el índice de búsqueda como en el propio historial ("(cifrado)"), incluso para quien tiene permiso de ver la bóveda: el historial documenta que hubo un cambio, no cuál fue.
- La resolución de conflictos de sincronización es siempre "gana la última escritura"; el `PanelSync` informa del conflicto mas no permite elegir una versión distinta, y "descartar" es una operación explícita y separada que además intenta recomponer el estado desde el servidor.

---

### 3.4 Guías / Soluciones (`/soluciones`)

#### 3.4.1 Jerarquía y rutas

| Ruta | Pantalla | Nivel de chasis | "Volver" / X va a |
|---|---|---|---|
| `/soluciones` | `SolucionesPage` | raíz de pestaña (0) | (es raíz, sin volver) |
| `/soluciones/:categoriaId` | `CategoriaPage` | documento (2) | `/soluciones` (lista, sin chip) |
| `/soluciones/:categoriaId/nuevo` | `ArticuloForm` (crear) | tarea (3) | `/soluciones?categoria=:categoriaId` (lista con el chip repuesto) |
| `/soluciones/:categoriaId/:articuloId` | `ArticuloPage` | documento (2) | `/soluciones?categoria=:categoriaId` |
| `/soluciones/:categoriaId/:articuloId/editar` | `ArticuloForm` (editar) | tarea (3) | `/soluciones/:categoriaId/:articuloId` (ficha) |
| `/soluciones/:categoriaId/:articuloId/ejecutar` | `AsistentePage` | tarea (3), sin pestañas | `/soluciones/:categoriaId/:articuloId` (ficha) |

Fuente: `src/lib/navegacion.ts` (función `padreDe`).

Notas de navegación:
- Dentro de `/soluciones`, la categoría es un **filtro de la lista**, no un nivel de navegación real: volver desde un artículo o desde "nuevo" repone el chip de categoría vía query string (`?categoria=X`); nunca se abre una pantalla intermedia de categoría.
- La ficha de categoría (`CategoriaPage`) sí es un nivel de chasis propio (documento, nivel 2), accesible desde chips/enlaces de otras pantallas (por ejemplo desde la ficha de un dispositivo), aunque no forma parte del recorrido "Volver" estándar de artículo→lista.

#### 3.4.2 Componentes e interfaz

**`SolucionesPage` (`/soluciones`) — listado**

Archivo: `src/features/soluciones/SolucionesPage.tsx`.

Cabecera (`barra` del `Chasis`):
- `PastillaFrescura`: cuenta total de artículos vivos (`total={articulos.length}`).
- Botón **"Crear"** (`BTN_PRIMARIO`, ícono `Plus`): siempre habilitado (decisión de diseño explícita en el código, "R3"). Con categoría activa (`categoriaSel`) es un `Link` directo a `/soluciones/:categoriaId/nuevo`; sin categoría, es un botón que abre la hoja "¿En qué categoría?".
- Campo de búsqueda (`type="search"`, `aria-label="Buscar artículos"`, placeholder "Buscar equipo, síntoma o etiqueta"): 46px de alto, borde de acento cuando hay texto. Botón "Borrar búsqueda" (ícono `XCircleFill`, 44×44px) visible solo con texto.
- Fila de chips de categoría (móvil, oculta mientras se busca): "Todos" + una por categoría (`db.categorias` ordenadas por `orden`, sin las eliminadas), cada una con ícono propio y contador de artículos. Al final, si hay tipos presentes en el alcance actual, botón **"Tipo"** (o la etiqueta del tipo elegido) que abre la hoja `HojaFiltro` de segundo eje.
- En escritorio (`xl:`) el mismo conjunto de chips se muestra como rail lateral fijo (`sticky top-[104px]`) en vez de fila horizontal.

Comportamiento de filtros (estado local, viaja a la URL con `history.replace`, sin crear entradas de historial):
- **Modo búsqueda** (`buscando = query.trim().length > 0`): ignora `tipoSel`/`etiquetaSel`; filtra sobre todas las categorías salvo que el técnico pulse **"Solo ahí"** en la cinta de contexto que aparece cuando hay una categoría activa mientras se busca ("Busco en todas las categorías. El filtro *X* queda en pausa." / "Busco solo en *X*.").
- **Modo etiqueta** (`etiquetaSel` activo y no buscando): filtra por coincidencia exacta normalizada de etiqueta; se llega tocando una etiqueta en la ficha de un artículo (`/soluciones?etiqueta=X`). Banner "Etiqueta: X" con enlace "Ver todos".
- **Modo navegación normal**: filtra por `categoriaSel` y `tipoSel` combinados (AND).
- Elegir una categoría (`setCategoria`) limpia siempre `tipoSel`, `etiquetaSel` y `soloEnCategoria`.
- Coincidencia de búsqueda: `coincidenciaArticulo` explica POR DÓNDE coincidió cada resultado cuando no fue por el título (etiqueta / categoría / tipo), por ejemplo "Coincide en la etiqueta: Impresora".
- Agrupación: sin búsqueda, lista plana sin encabezados; buscando, un grupo por categoría con encabezado e ícono.
- Orden: por `orden` de categoría y luego alfabético por título (`localeCompare`, locale `es`).

Bloque "Sin terminar": hasta `MAX_SIN_TERMINAR = 3` procedimientos con avance a medias (`articulosSinTerminar`), oculto mientras se busca o hay filtro de etiqueta. Cada fila es un `Link` a `.../ejecutar` con ícono del tipo, título, "Paso N de M" + minutos restantes estimados (si el procedimiento tiene `tiempoEstimadoMin`), botón "Seguir" y barra de progreso (`IndicadorAvance`, variante "barra").

Estados vacíos (mutuamente excluyentes):
- `primeraVez` (sin filtros ni búsqueda y sin artículos): "Aquí va a vivir lo que el equipo sabe" + botón "Crear el primero".
- Buscando sin resultados: "Nada coincide con «consulta»" + sugerencia ortográfica tocable si existe (`sugerenciaBusqueda`), botones "Limpiar la búsqueda" y "Documentarlo" (abre la hoja de creación).
- Con filtros sin resultados: "No hay artículos con estos filtros" (mensaje distinto si el filtro activo es de tipo), botones "Quitar los filtros" y "Crear".

Hojas modales (`HojaFiltro`, componente compartido):
1. "Tipo de documento": una opción por tipo presente en el alcance actual con su contador; alternar la misma opción la deselecciona.
2. "¿En qué categoría?": una opción por categoría; al elegir navega a `/soluciones/:id/nuevo`.

**`CategoriaPage` (`/soluciones/:categoriaId`) — ficha de categoría**

Archivo: `src/features/soluciones/CategoriaPage.tsx`.
- Cabecera: ícono de la categoría en su color propio, nombre (`h1`), línea de resumen "N artículos · N equipos · N diagnósticos" (omite los conteos en cero).
- Acción de cabecera: botón secundario **"Artículo"** → `/soluciones/:categoriaId/nuevo`.
- Si la categoría fue eliminada → `Navigate to="/soluciones"`.
- Cuerpo, en secciones que se omiten si están vacías:
  1. Una sección por `TipoArticulo` presente (mismo orden que `TIPOS_ARTICULO`), con filas de artículo (miniatura de portada o ícono del tipo, título, chip "hechos/total" si hay avance local, caret).
  2. "Dispositivos de esta categoría": filas con foto o ícono, nombre, ubicación, pastilla de estado coloreada.
  3. "Diagnósticos de esta categoría": filas con ícono `WarningCircle`, título; enlazan a `/diagnostico/:id`.
  4. `Historial` de la categoría (componente compartido).
- Estado vacío único: "Todavía no hay nada en esta categoría" + "Crea el primer artículo con el botón de arriba".

**`ArticuloPage` — ficha de detalle**

Archivo: `src/features/soluciones/ArticuloPage.tsx`. Ruta `/soluciones/:categoriaId/:articuloId`.

Cabecera (`Chasis modo="documento"`): `volverEtiqueta` = nombre de la categoría (o "Guías"); `contexto` = "Guías · [Categoría]". Tres acciones de 44px, exactamente:
1. `BotonFavorito` (estrella).
2. Ícono "Editar" (`PencilSimple`) → `/soluciones/:categoriaId/:articuloId/editar`.
3. Menú "···" (`MenuAcciones`).

Menú "···" (ícono `DotsThreeBold`, se cierra al clicar fuera):
- **Compartir**: usa `navigator.share` si existe; si no, copia el enlace al portapapeles y muestra "Enlace copiado" 1.2s antes de cerrar el menú.
- **Duplicar**: `Link` a `/soluciones/:categoriaId/nuevo?copiarDe=:articuloId`.
- **Reiniciar progreso** (solo si tiene procedimiento): borra `db.progresoPasos` de este artículo.
- **Eliminar** (rojo): abre `DialogoEliminar`.

Banners de estado (mutuamente excluyentes, bajo la portada):
- `borrador`: "Borrador. No aparece en el buscador, las rutas de inicio ni el diagnóstico." (ámbar, precaución).
- `obsoleto`: "Obsoleto. Se conserva solo como referencia; usar el procedimiento vigente." (rojo, error).

Cuerpo, en orden:
1. Portada del procedimiento (si existe).
2. Encabezado: kicker con el tipo (color propio), `h1` con el título, descripción del "cuándo usar", metadatos como lista de definición (`MetadatosArticulo`): Tiempo, Dificultad, Aplica a (solo si `aplicaA` tiene marca/modelo), Versión (siempre, `v${version}`). Línea final "Actualizado el [fecha] por [autor]".
3. Si el tipo es `problema_frecuente`: `IncidenciaResumen` (listas de Síntomas y Posibles causas, con viñeta, y chips navegables "Equipos afectados" a `/dispositivos/:id`); se omite si las tres listas están vacías.
4. Si el procedimiento es ejecutable: `ProcedimientoVista` (stepper completo).
5. Contenido Markdown del artículo (si no está vacío), renderizado con `react-markdown` + `remark-gfm`.
6. Adjuntos del artículo (componente `Adjuntos`, entidad `articulo`) — solo si el artículo NO tiene procedimiento (los procedimientos anclan sus adjuntos a cada paso).
7. `ArticulosRelacionados`: sección "Relacionados" (los vinculados explícitamente, con fila "(eliminado)" si el destino ya no existe) + sección "Aparece como relacionado en" (calculada localmente, inverso no persistido).
8. `ReferenciadoPor` (relaciones `subprocedimiento`, `solucion`, `decision`, `diagnostico_articulo`): qué otros artículos/diagnósticos usan este artículo. Excluye a propósito `relacionado`, ya cubierto arriba.
9. Etiquetas como chips tocables → `/soluciones?etiqueta=X`.
10. `Historial` del artículo.
11. **Acción dominante fija al pie** (`AccionDominante`, solo si hay procedimiento ejecutable): etiqueta según avance local — "Empezar" (0 pasos hechos), "Seguir en el paso N de M" (a medias), "Repetir" (todos hechos) — enlaza a `.../ejecutar`.

`DialogoEliminar`: sensible (confirmación reforzada); título y descripción cambian según si el artículo tiene procedimiento o no; muestra advertencia de impacto (`resumenImpacto` sobre el grafo de referencias) si algo lo referencia ("Al eliminarlo, esos vínculos quedarán rotos.").

Si el artículo fue eliminado → `Navigate` a `/soluciones?categoria=:categoriaId`.

**`PasosEditor` — constructor de pasos (dentro de la pestaña Pasos)**

Archivo: `src/features/soluciones/PasosEditor.tsx`. Cada paso es una tarjeta con:
- Número (círculo), input de título (placeholder "Qué hacer en este paso"), menú "···" (`DotsThreeOutline`) con **Subir / Bajar / Eliminar** (elimina con `DialogoEliminar` no sensible, "¿Eliminar el paso N?").
- Input de objetivo (placeholder "Objetivo: qué se logra al terminar (opcional)").
- Cuerpo: lista de bloques + fila de botones "Tarea" / "Advertencia" / "Imagen" / **"Reutilizar"** (abre los vínculos del paso).
- Adjuntos del paso completo (galería `AdjuntosDelPaso`): múltiples archivos (manual/PDF/planilla), cada uno con botón "Quitar"; solo las imágenes se recomprimen antes de subir.
- Sección plegable "Vínculos del paso: información protegida, procedimiento o solución":
  1. **Vínculo protegido** (`VinculoProtegidoDelPaso`): `<select>` con dos `<optgroup>` — "Datos protegidos del equipo" (campos protegidos de los equipos ya puestos en "Equipos donde aplica" del artículo) y "Secretos de la bóveda" (todas las credenciales vivas). El valor codifica `tipo:id`. Vinculado, muestra "Información protegida: X" con botón "Quitar". Si no hay ninguna opción disponible (sin permiso de bóveda ni equipos vinculados), el selector no se muestra.
  2. **Procedimiento relacionado** (`subArticuloId`): `<select>` de artículos publicados con procedimiento ejecutable (excluye el propio artículo en edición). Si el título del paso está vacío, elegir el vínculo lo rellena con el título del artículo vinculado.
  3. **Solución si el paso falla** (`solucionArticuloId`): mismo universo de candidatos.

Bloques del paso (`BloqueEditor`), tres tipos:
- **Tarea**: ícono a la izquierda cicla `tipoTarea` en el ciclo `accion → verificacion → decision → accion` (tocar el ícono); al pasar a `decision` conserva `decisionArticuloId` solo si ya lo tenía; al salir de `decision` lo limpia. Input de texto con placeholder según el tipo. Enter inserta una tarea nueva debajo y la enfoca. Pegar texto con saltos de línea reparte cada línea en una tarea nueva. Si `tipoTarea === 'decision'`: sub-selector "Si responde No" (`decisionArticuloId`, mismo universo de vinculables) — "Si responde No: [título]" con botón Quitar, o el `<select>` si aún no hay vínculo.
- **Advertencia**: ícono cicla el tono (`info → precaucion → importante → consejo → dato → info`); textarea (2 filas) para el texto.
- **Imagen**: slot de 140px de alto para subir/mostrar la imagen; input de pie de foto opcional; botón Quitar.

Cada bloque de tipo `tarea` y `aviso` tiene botón "Quitar esta línea" / "Quitar la advertencia" (X). Errores de subida: falta de conexión con Supabase bloquea con error; sin señal de red encola y avisa (mismo patrón que la portada del artículo).

**`ProcedimientoVista` — vista de lectura del procedimiento (dentro de `ArticuloPage`)**

Archivo: `src/features/soluciones/ProcedimientoVista.tsx`. Reutilizada también por `VistaPreviaArticulo`. Estructura, en orden:
1. "Objetivo" (si existe `objetivoGeneral`).
2. "Antes de empezar" (lista de `requisitos`, con viñeta).
3. "Pasos": título de sección + `IndicadorAvance` en variante "segmentos" y "texto" ("N de M").
4. Lista ordenada de pasos, cada uno con insignia circular: completo (check, tinte de acento), actual (número con halo de acento, el primer paso sin completar), pendiente (número neutro), unidos por línea conectora vertical.
5. "Verificación final": mientras los pasos no estén todos completos se anuncia en tarjeta neutra ("Al terminar hay N comprobaciones. Se abren cuando marques el paso M."), nunca se muestra deshabilitada. Al completarse todos los pasos, se convierte en checklist real marcable.
6. Banner "Procedimiento completado" (si todo completado) con botón "Reiniciar".

Plegado de pasos (solo en el nivel 0; los niveles anidados van siempre abiertos): por defecto solo el paso actual llega abierto; el técnico puede abrir/cerrar cualquiera a mano (estado local no persistido) y esa elección prevalece sobre el valor por defecto.

Contenido de cada paso abierto: adjuntos de galería, lista de bloques (`BloqueVista`), vínculo protegido (`CredencialEnPaso`), subprocedimiento vinculado (`SubProcedimientoEnPaso`) con aviso de bloqueo si no está satisfecho, y pregunta de error (`SolucionEnPaso`) si hay `solucionArticuloId` y el trabajo previo ya está completo.

Bloques en lectura (`BloqueVista`, compartido con el modo asistente):
- `aviso`: panel con color e ícono del tono, con la palabra del tono en negrita antes del texto ("Precaución. [texto]") — nunca solo color.
- `imagen`: figura con imagen (visor con zoom al tocar) y pie opcional; sin adjunto, no renderiza nada.
- `tarea` accion/verificacion: `FilaTarea` — casilla de 24px, texto tachado al marcar; las de verificación llevan un `TagNeutral` "Verificación" a la derecha.
- `tarea` decision: `DecisionEnTarea`.

`DecisionEnTarea`: mientras no está respondida, muestra la pregunta con dos botones — "Sí, continuar" (marca la tarea directamente) y "No, abrir '[título]'" (o "No, continuar" sin vínculo) que despliega inline el artículo vinculado en `ProcedimientoVista` anidado (nivel+1), o solo un enlace si ya está en nivel ≥1 o el vínculo no es ejecutable/roto. Al completarse el vinculado, la tarea se marca automáticamente y su progreso se reinicia para el próximo uso. Ya respondida, se muestra como `FilaTarea` marcada; tocarla la desmarca para volver a responder.

`SolucionEnPaso`: solo aparece si `paso.solucionArticuloId` existe, el paso no está hecho y su trabajo previo ya está completo. "¿Ocurrió algún error durante este paso?" con "No, continuar" (completa el paso y avanza) y "Sí, ver la solución" (despliega la solución inline, nivel+1). Al completar la solución, se reinicia su progreso y el paso padre se marca hecho y avanza.

Vínculo roto: si el artículo vinculado (subprocedimiento, solución o decisión) fue eliminado, panel de precaución: "El procedimiento vinculado 'X' ya no está disponible. Edita el artículo para quitar el vínculo o vincular otro."

Niveles anidados (≥1): sin barra pegajosa; el avance se muestra en barra compacta al pie de la tarjeta ("N de M pasos completados") con enlace "Reiniciar progreso".

**Modo de ejecución guiada — `AsistentePage` / `AsistenteVista`**

Archivos: `src/features/soluciones/AsistentePage.tsx` y `AsistenteVista.tsx`. Ruta `/soluciones/:categoriaId/:articuloId/ejecutar`.

`AsistentePage`: shell (`Chasis modo="tarea"`, sin pestañas), rótulo "Ejecutando", `vuelta` = "Guías › [Categoría]", `salidaEtiqueta` = "Salir del modo ejecución". Si el artículo no existe → `Navigate` a `/soluciones`. Si el procedimiento no es ejecutable (sin pasos) → `Navigate` de vuelta a la ficha. El progreso vive en la base local, no en el estado del componente: salir nunca lo pierde.

Avance paso a paso (`AsistenteVista`, nivel 0):
- Al entrar, se resuelve el primer paso pendiente con una lectura directa (no reactiva) del progreso guardado, para retomar exactamente donde quedó sin saltar al azar mientras la lectura reactiva se estabiliza.
- Ancla pegajosa (`CabeceraPaso`, dentro de `BandaTarea`, 44px): "Paso N de M", título truncado, contador de tareas del paso (marcadas/total) y barra de progreso de 3px del procedimiento completo.
- Cuerpo del paso: objetivo, cronómetro de la sesión (MM:SS, no persistido, solo nivel 0) contra el tiempo estimado, adjuntos de galería, bloques (mismo `BloqueVista`, con `ejecutarInline` anidando otro `AsistenteVista` en vez de `ProcedimientoVista`), vínculo protegido, subprocedimiento vinculado (`SubProcedimientoEnAsistente`) y pregunta de error (`SolucionEnAsistente`) — mismas reglas de un solo nivel de anidamiento y vínculo roto que en `ProcedimientoVista`.
- Evidencia fotográfica (`EvidenciaPaso`, solo nivel 0 y solo si el artículo tiene `dispositivosAfectados[0]`): botón "Adjuntar evidencia de este paso" que crea una entrada de historial (`registrarIntervencion`) sobre ese dispositivo con la descripción `Evidencia del paso "X" (Y)`, y guarda el vínculo en el progreso local (`registrarEvidenciaPaso`) para que revisitar el paso reutilice la misma galería en vez de crear intervenciones nuevas. La galería se muestra con `Adjuntos` sobre esa misma entrada.
- Acción dominante fija al pie (solo nivel 0, `sticky bottom-0`): botón "Atrás" (44px, deshabilitado en el primer paso) + botón principal con etiqueta contextual:
  - Paso no hecho, con trabajo pendiente → deshabilitado, con motivo escrito arriba: "Falta N tarea(s) de este paso para poder avanzar" o "Termina el procedimiento vinculado para poder avanzar".
  - Paso no hecho, trabajo previo completo → "Paso hecho · ir al N" o "Paso hecho · terminar" (último paso).
  - Paso ya hecho (revisando con Atrás) → "Ir al paso N" o "Continuar" (último paso); al pulsar navega linealmente sin re-ejecutar validaciones.
  - Se oculta mientras se muestra la pregunta de error sin responder, para no competir con "No, continuar" / "Sí, ver la solución".
- Niveles anidados (≥1): sin ancla ni barra pegajosa propia; un solo botón "Siguiente" en línea, deshabilitado hasta que el trabajo previo esté completo.

Pantalla de verificación final (pasos completos, verificación pendiente): banner de precaución "Verificación final" con el checklist marcable.

Pantalla de completado: barra al 100%, banner de éxito "Procedimiento completado" con contador de pasos y duración de la sesión, botón "Reiniciar y volver a empezar" (borra el progreso guardado y reposiciona el cronómetro y el índice en el primer paso).

Diferencia clave con `ProcedimientoVista`: aquí no hay "mapa" completo visible ni plegado por técnico, un solo paso ocupa la pantalla en todo momento; el resto de la lógica de negocio es idéntica porque ambas vistas comparten el hook `useProcedimientoEjecucion`.

#### 3.4.3 Formularios y campos

`ArticuloForm` (archivo `src/features/soluciones/ArticuloForm.tsx`; rutas `/soluciones/:categoriaId/nuevo` y `/soluciones/:categoriaId/:articuloId/editar`) tiene 4 pestañas (`role="tablist"`), cada una con un punto (`aria-label="Tiene sugerencias pendientes"`) si `completitud.pestanasPendientes` la incluye. Cambiar de pestaña hace `window.scrollTo({top:0})`.

Modos de entrada por query string, mutuamente excluyentes:
- `?copiarDe=<id>`: precarga como duplicado de otro artículo — título "Copia de X", `tipo` y todo el procedimiento clonado con `duplicarProcedimiento` (nuevos ids internos; adjuntos/portada conservan su referencia de Storage), nace en `estado='borrador'` sin marca de ruta de inicio.
- `?desdeSugerencia=<idEjecucionDiagnostico>`: precarga desde una sugerencia del equipo — título = título del diagnóstico, `tipo='problema_frecuente'`, `descripcion` = el texto libre `solucionPropuesta`, `estado='borrador'`.
- `?tipo=<tipoArticulo>`: preselecciona el tipo (solo si es un valor válido de `TIPOS_GRID`).
- `?dispositivoAfectado=<id>&dispositivoNombre=<nombre>`: precarga `dispositivosAfectados` con ese único equipo.

**Pestaña "General" — de qué trata y cómo se encuentra**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Tipo de documento | Rejilla de 6 botones (`aria-pressed`) | Siempre tiene un valor | `manual`, o `?tipo=` si es válido | Un único tipo seleccionable; cambia iconografía/color de toda la ficha |
| Título | `input text` | Obligatorio | `''` | Placeholder "Qué se hace y sobre qué equipo"; al escribir limpia `errorEnvio`; dispara anti-duplicados con rebote de 300ms (`useIndiceBusqueda` + `buscarArticulosSimilares`) mostrando hasta N artículos parecidos con enlace directo y botón "Descartar" |
| ¿Cuándo usar este procedimiento? | `textarea` (2 filas) | Opcional | `''` | Placeholder de ejemplo; indexa en búsqueda; suma a completitud |
| Objetivo general (1 línea) | `input text` | Opcional | `''` | Qué se logra al completar todo el procedimiento |
| Etiquetas | Editor de chips (`EtiquetasEditor`) | Opcional | `[]` | Enter o coma agregan; Backspace con campo vacío borra la última; pegar texto con comas/saltos de línea reparte en varias; comparación insensible a acentos/mayúsculas (`normalizarTexto`); muestra hasta 8 chips de sugerencia del vocabulario ya usado en otros artículos (`etiquetasFrecuentes`) |
| Imagen de portada | Selector de archivo (imagen) | Opcional | `null` | Sube comprimida (`comprimirImagen`) y encola sin conexión (`subirOEncolarArchivo`); sin conexión con Supabase muestra error "La aplicación aún no está conectada al servidor."; con conexión intermitente avisa encolado; botón "Quitar" cuando ya hay portada |
| Equipos donde aplica | Selector (`EquiposDondeAplica`) | Opcional | `[]` (o el equipo contextual de `?dispositivoAfectado`) | `<select>` con dispositivos vivos no ya elegidos; cada elección se agrega como chip removible `{id, nombre}`; nota fija: "Vincula equipos para destacar el artículo... Publicado, ya aparece en las fichas de todos los equipos de la categoría [...] aunque lo dejes vacío" |
| Restringir a marca o modelo (opcional) | Dos `CampoConSugerencias` (marca / modelo) | Opcional | `''` / `''` | Sugerencias tomadas del vocabulario real de dispositivos (`valoresUnicos`); ambos vacíos = "aplica a toda la categoría"; con los dos llenos se exige coincidencia AND |

Si el tipo es `manual`, la señal de completitud de "Pasos" se sustituye por una sola señal en la pestaña Detalles ("Escribir el contenido del manual").

Oferta de plantilla (solo al crear, sin `copiarDe`, con plantilla disponible para el tipo elegido, sin pasos aún y sin haberla descartado antes): tarjeta con "Usar plantilla" (rellena pasos/requisitos/verificación/contenido predefinidos según el tipo, sin pisar lo ya escrito) o "Empezar en blanco" (descarta la oferta para ese tipo en esta sesión de edición).

**Pestaña "Pasos" — lo que se ejecuta**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento |
|---|---|---|---|---|
| Antes de empezar (un requisito por línea) | `textarea` (3 filas) | Opcional | `''` | Cada línea no vacía se convierte en un requisito |
| Pasos | `PasosEditor` (ver 3.4.2) | Opcional | `[]` | Constructor de pasos con bloques (tareas/avisos/imágenes) y vínculos |
| Verificación final (una comprobación por línea) | `textarea` (3 filas) | Opcional | `''` | Checklist final del procedimiento |

**Pestaña "Detalles" — ayuda a decidir si sirve**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Visible cuando |
|---|---|---|---|---|
| Síntomas (uno por línea) | `textarea` (3 filas) | Opcional | `''` | Solo `tipo === 'problema_frecuente'` |
| Posibles causas (una por línea) | `textarea` (3 filas) | Opcional | `''` | Solo `tipo === 'problema_frecuente'` |
| Tiempo (min) | `input number`, `min={1}` | Opcional | `''` | Siempre |
| Dificultad | Segmentado (Principiante/Intermedio/Avanzado) | Opcional | `''` | Siempre; tocar la opción activa la deselecciona |
| Artículos relacionados | Chips + `<select>` | Opcional | `[]` (o los del original si `copiarDe`) | Candidatos = todos los artículos vivos salvo el propio; cada elección agrega `{id, titulo}` |
| Notas adicionales (admite Markdown) | `textarea` (3 filas, monoespaciada) | Opcional | `''` | Contenido Markdown del artículo (cuerpo libre, se renderiza en la ficha con `react-markdown` + `remark-gfm`) |

**Pestaña "Publicación" — quién lo ve y cómo queda registrado**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento |
|---|---|---|---|---|
| Estado | Segmentado (Borrador/Publicado/Obsoleto) | Siempre tiene valor | `'borrador'` (o `'publicado'` al editar un artículo sin estado guardado, o `'borrador'` si viene de `copiarDe`/`desdeSugerencia`) | Nota fija: "Un borrador u obsoleto no aparece en el buscador ni en el diagnóstico." |
| Destacar en Inicio como ruta de aprendizaje (`esRutaInicio`) | Casilla | Opcional | `false` | Ayuda: "Para guías como 'Primer día en TI'." |
| Orden en la ruta de Inicio (`ordenRutaInicio`) | `input number`, `min={0}` | Opcional | `0` | Solo visible si `esRutaInicio` está marcado; nota: "Los destacados se muestran de menor a mayor. El 0 va primero." Al guardar se fuerza a `Math.max(0, Math.trunc(...))`; si `esRutaInicio` es falso se guarda como `0` |
| Es un cambio mayor (`cambioMayor`) | Casilla | Opcional | `false` | Solo visible en edición de un artículo ya publicado; ayuda dinámica: "La versión pasaría de X a Y en vez de Z" (calculado con `siguienteVersion`) |
| Motivo del cambio | `input text` | Opcional | `''` | Solo visible en edición; se guarda como el motivo del registro de historial |

Único campo obligatorio del formulario completo: **el título** (pestaña General). Al enviar sin título: `errorEnvio = 'Falta el título del artículo.'`, salta a la pestaña General, marca el campo con borde rojo (`aria-invalid`) y mensaje con ícono `Warning` bajo el campo.

Barra fija inferior: barra de completitud ("Completitud N%", con lista plegable de sugerencias tocables que llevan directo a la pestaña donde se resuelven) + botones "Vista previa" (abre `VistaPreviaArticulo`, cargado en diferido) y "Guardar procedimiento" / "Guardar artículo" (etiqueta según si hay pasos) — deshabilitado mientras se guarda.

Completitud (`completitudArticulo.ts`): 8-9 señales binarias según el tipo, repartidas entre General/Pasos/Detalles; porcentaje = completas/total redondeado. Un artículo `manual` reemplaza las 4 señales de "Pasos" por una única señal ("tener contenido escrito") anclada a Detalles.

Versión al guardar: si es edición y el artículo ya estaba `publicado`, la versión sube (`siguienteVersion`); si no, se conserva la versión existente o `'1.0'`.

Al guardar: `guardarRegistro('articulos', {...}, motivo.trim())` y navega a la ficha del artículo recién guardado/editado.

#### 3.4.4 Relaciones y reutilización de datos

| Vínculo | Campo(s) | Dónde se edita | Dónde se ejecuta/lee |
|---|---|---|---|
| Paso → Bóveda / campo protegido de un equipo | `PasoProcedimiento.vinculoProtegido` y `BloquePaso.vinculoProtegido` (`{tipo:'credencial'\|'campo', id, titulo}`) | `PasosEditor.tsx` (`VinculoProtegidoDelPaso`) | `CredencialEnPaso` en `ProcedimientoVista` y `AsistenteVista` |
| Artículo → Equipos donde aplica | `Articulo.dispositivosAfectados: DispositivoAfectado[]` | Pestaña General, `EquiposDondeAplica` | Alimenta "Procedimientos de este equipo"/"Problemas frecuentes" en la ficha del dispositivo; también decide si el modo asistente ofrece "Adjuntar evidencia" |
| Artículo → refinamiento marca/modelo | `Articulo.aplicaA: AplicaA \| null` | Pestaña General, `AplicaACriterios` | `aplicaAlDispositivo`, consumido al listar procedimientos de un dispositivo concreto |
| Paso → subprocedimiento | `PasoProcedimiento.subArticuloId/Titulo` | `PasosEditor.tsx`, "Procedimiento relacionado" | Ejecución inline en `ProcedimientoVista`/`AsistenteVista` (un nivel), o enlace más allá |
| Paso → solución de error | `PasoProcedimiento.solucionArticuloId/Titulo` | `PasosEditor.tsx`, "Solución si el paso falla" | Pregunta "¿Ocurrió algún error?" en ambas vistas |
| Tarea de decisión → artículo si "No" | `BloquePaso.decisionArticuloId/Titulo` (solo `tipoTarea==='decision'`) | `PasosEditor.tsx`, sub-selector bajo la tarea | `DecisionEnTarea` en `ProcedimientoVista`/`AsistenteVista` |
| Artículo → artículos relacionados | `Articulo.relacionados: ArticuloRelacionado[]` | Pestaña Detalles | Sección "Relacionados" en la ficha; el inverso ("Aparece como relacionado en") se calcula localmente, no se persiste |
| Diagnóstico → artículo nuevo (bucle de sugerencia) | `EjecucionDiagnostico.solucionPropuesta` (motivo `encontro_otra_solucion`) → `Articulo.origenSugerenciaId` | Se origina en `DiagnosticoRunPage` (Resultado), se cierra en `ArticuloForm` vía `?desdeSugerencia=` | `SugerenciasEquipoPage` lista las pendientes; `ArticuloForm` precarga título/descripción/tipo/estado; al editar, `origenSugerenciaId` se conserva sin cambios (nunca se reasigna) |

Todos los vínculos a otro artículo comparten el mismo patrón: guardan el `id` real más una copia de referencia del título (`...Titulo`), para poder mostrar el nombre aunque ese artículo aún no haya sincronizado desde otro dispositivo, y para detectar vínculos rotos sin depender de una consulta adicional. Ningún vínculo duplica el procedimiento en sí, siempre se referencia, nunca se copia el contenido.

Los vínculos hacia Diagnóstico (respuesta → procedimiento, artículo ejecutado dentro de un diagnóstico) se detallan en 3.5.4.

#### 3.4.5 Comportamientos y reglas de negocio

**Lógica de ejecución compartida (`useProcedimientoEjecucion`)**, archivo `src/features/soluciones/useProcedimientoEjecucion.ts`, usada por `ProcedimientoVista` y `AsistenteVista`:
- Un paso es un contenedor, no una sola instrucción: no se da por completado hasta que TODO su contenido lo esté — sus tareas propias (`alternarInstruccionHecha`) y su subprocedimiento vinculado (si lo tiene y está en nivel 0).
- `intentarCompletarPaso`: usa lecturas frescas de la base (no reactivas) para decidir si el paso puede completarse solo (`pasoSeCompletaSolo`, trabajo previo completo y sin `solucionArticuloId`). Si tiene solución vinculada, no avanza aquí: aparece la pregunta de error y el paso se completa al responderla.
- `completarPasoYAvanzar`: usada por "No, continuar" de la pregunta de error y por una solución ya resuelta; completa sin la validación previa (porque la pregunta solo aparece cuando el trabajo previo ya estaba completo).
- `avanzarDespuesDe`: calcula el siguiente paso pendiente (`siguientePasoPendiente`, primero busca hacia adelante, luego desde el inicio); si no queda ninguno, avisa `onCompletado` hacia el padre (relevante cuando este hook describe un subprocedimiento/solución anidados) y notifica `onAvanzar(null)`.
- Los subprocedimientos vinculados solo se resuelven como "trabajo pendiente del paso" en nivel 0 (`subIds` vacío si `nivel !== 0`); en niveles más profundos, un `subArticuloId` no bloquea nada porque no se ejecuta inline.

**Regla de anidamiento único**: subprocedimientos, soluciones y decisiones solo se ejecutan inline en nivel 0 → nivel 1 (un solo nivel de profundidad). Más allá del nivel 1, o si el vínculo ya no tiene pasos, solo se muestra como tarjeta de enlace ("Continúa en...", "Solución") con botón "Abrir" que navega a la ficha del artículo vinculado; esto corta cualquier ciclo A→B→A y evita expansión infinita.

**`procedimientoEjecutable`** (`src/lib/procedimiento.ts`): un procedimiento no nulo puede existir solo por su metadata (portada/descripción/objetivo/requisitos/verificación, sin pasos); la pregunta correcta para decidir si corresponde ofrecer "Ejecutar", el modo asistente o vincularlo como subprocedimiento/solución/raíz de diagnóstico es `procedimiento.pasos.length > 0`, nunca solo que el procedimiento no sea nulo.

**Historial de cambios de un artículo**: el componente compartido `Historial` no fue releído en detalle en la auditoría fuente, pero lo propio del módulo es:
- Versión (`Articulo.version`): etiqueta legible tipo "1.0", "1.1", "2.0". Sube la menor en cada guardado sobre un artículo ya publicado, o la mayor si se marca "Es un cambio mayor" en la pestaña Publicación (`siguienteVersion`).
- La versión no cambia al guardar un artículo en `borrador` o `obsoleto`, ni la primera vez que se publica desde borrador (la condición exacta es edición Y el artículo ya estaba publicado).
- El "Motivo del cambio" (pestaña Publicación, solo en edición) se pasa como segundo argumento a `guardarRegistro(...)`, que escribe la entrada de historial.

**Estados del artículo** (`EstadoArticulo = 'borrador' | 'publicado' | 'obsoleto'`):
- `publicado` es el estado por defecto de todo lo existente antes de que este campo existiera.
- Un `borrador` u `obsoleto` se excluye del buscador global, las rutas de inicio y el Diagnóstico Inteligente, salvo para quien está editando ese mismo artículo. En `PasosEditor.tsx` y `DiagnosticoForm.tsx`, los artículos "vinculables" como subprocedimiento/solución/decisión, o como respuesta que ejecuta un procedimiento en un diagnóstico, se filtran explícitamente a `estado === 'publicado'`. En cambio, el asistente en tiempo de ejecución de un diagnóstico ya guardado SÍ ejecuta artículos aunque sean borrador (solo se exige que existan, no estén eliminados y tengan procedimiento).
- Solo 3 estados, deliberadamente sin "en revisión": un equipo de 5 técnicos no tiene hoy un flujo de aprobación real detrás de ese paso.
- Efecto visible: banners específicos por estado en `ArticuloPage`; en `FilaArticulo.tsx` un artículo obsoleto sigue siendo consultable pero baja de jerarquía visual (texto más apagado, sin desaparecer).

**Guardar / Cancelar / X / Escape en Guías**:
- Guardar: botón "Guardar procedimiento"/"Guardar artículo" en la barra fija inferior del `ArticuloForm`; valida solo el título; si pasa, navega a la ficha del artículo.
- Cancelar/X: la X del `Chasis` (`salidaEtiqueta="Cancelar y volver"`) usa `padreDe` — al crear vuelve a la lista con el chip de categoría repuesto; al editar vuelve a la ficha del artículo. No hay confirmación de "¿descartar cambios?" en el código auditado.
- Escape: implementado explícitamente en `VistaPreviaArticulo.tsx` (cierra la vista previa). No se encontró un manejador de Escape en el propio `ArticuloForm`.
- Vista previa: modal a pantalla completa (`z-[70]`) con badge "Sin guardar"; usa un id de progreso efímero (`vista-previa:<id>`) para que las casillas de prueba nunca toquen el avance real del artículo; ese progreso efímero se borra al cerrar (en el cleanup del `useEffect`).

**Utilidades y reglas de datos del módulo**:

| Archivo | Responsabilidad |
|---|---|
| `aplicaA.ts` | `aplicaAlDispositivo`: decide si un `AplicaA {marca, modelo}` filtra a un equipo dado (comparación insensible a mayúsculas/espacios; ambos vacíos = "toda la categoría"; con los dos presentes exige AND). `aplicaADesdeFormulario` normaliza cadenas vacías a `null`. `describirAplicaA` da el texto corto para la ficha. |
| `coincidencia.ts` | `coincidenciaArticulo`: orden de prioridad título → etiqueta → categoría → tipo, devolviendo dónde coincidió. `partirTitulo`: parte el título en pre/match/post para resaltar el término buscado conservando acentos/mayúsculas originales. |
| `coloresCategoria.ts` | 10 claves de color de categoría (`cat-1`…`cat-10`), derivadas del `orden` si no hay override manual, estable y determinista. Es uno de los 3 "lenguajes de color" de la app (estado de equipo / tipo de documento / categoría), deliberadamente no mezclados. |
| `completitudArticulo.ts` | Señales de completitud del editor (10 para procedimientos, 7 para manuales), cada una atada a la pestaña donde se resuelve. |
| `etiquetas.ts` | `etiquetasFrecuentes`: vocabulario derivado del uso real, agrupado por clave normalizada, ordenado por frecuencia (empate → alfabético). `normalizarEtiquetas`: al guardar un artículo, recorta espacios, quita duplicados internos y adopta la grafía canónica ya usada por el resto del equipo si existe. |
| `iconosSoluciones.ts` | Íconos por tipo de artículo (fijos) y por categoría (heurística de palabras clave sobre el nombre normalizado, con `BookOpen` como respaldo). `normalizarTexto` (minúsculas sin diacríticos) es la base de comparación de todo el módulo. |
| `plantillas.ts` | Estructura recomendada por tipo (pasos, requisitos, verificación) o esqueleto Markdown (solo `manual`). |
| `sinTerminar.ts` | `articulosSinTerminar`: procedimientos con 0 < hechos < total, ordenados por última actualización; calcula minutos restantes proporcionales al estimado. |
| `sugerenciaBusqueda.ts` | Corrección ortográfica ("Quizá quisiste decir...") por distancia de edición con tolerancia según longitud (0 si menos de 4 letras, 1 si menos de 7, 2 si más), vocabulario propio (títulos/etiquetas/categorías de lo que la lista muestra, no el índice global, que excluye borradores/obsoletos). |
| `tiposArticulo.ts` | Etiquetas de los 6 tipos + títulos dinámicos con género gramatical correcto ("Nueva instalación", "Nuevo manual"). |
| `tonos.ts` | Metadatos de los 5 tonos de aviso (info/precaución/importante/consejo/dato), compartidos entre editor y vista de lectura. |
| `useReanudar.ts` | El procedimiento a medias más reciente de todo el equipo de artículos, para la barra de reanudar global del chasis; el descarte ("ahora no") se guarda en `localStorage` y solo aplica mientras ese artículo siga siendo el más reciente sin terminar. |

---

### 3.5 Diagnóstico (`/diagnostico`)

#### 3.5.1 Jerarquía y rutas

| Ruta | Pantalla | Nivel de chasis | "Volver" / X va a |
|---|---|---|---|
| `/diagnostico` | `DiagnosticosPage` | documento (2) | `/` (Inicio), es una "raíz no-tab" |
| `/diagnostico/nuevo` | `DiagnosticoForm` (crear) | tarea (3) | `/diagnostico` |
| `/diagnostico/sugerencias` | `SugerenciasEquipoPage` | documento (2) | `/diagnostico` |
| `/diagnostico/estadisticas` | `EstadisticasPage` | documento (2) | `/diagnostico` |
| `/diagnostico/:id` | `DiagnosticoRunPage` | tarea (3), sin pestañas | `/diagnostico` (la X guarda el avance antes de salir) |
| `/diagnostico/:id/editar` | `DiagnosticoForm` (editar) | tarea (3) | `/diagnostico` |

Fuente: `src/lib/navegacion.ts`.

Notas de navegación:
- Todas las subrutas de `/diagnostico/*` (nuevo, sugerencias, estadísticas, `:id`, `:id/editar`) vuelven siempre a la lista `/diagnostico`: no hay noción de "categoría activa" que reponer en Diagnóstico como sí la hay en Guías.
- `/diagnostico` en sí mismo es una raíz no-tab: su propio "Volver" (al acceder a la pantalla, no desde una subruta) apunta a `/` (Inicio), porque no es una pestaña de la barra inferior (`RAICES_NO_TAB`).

#### 3.5.2 Componentes e interfaz

**`DiagnosticosPage` (`/diagnostico`) — listado de problemas**

Archivo: `src/features/diagnostico/DiagnosticosPage.tsx`.
- Cabecera: título "Diagnóstico inteligente", subtítulo "Empezar por el problema, llegar a la solución", enlaces "Sugerencias del equipo" (→ `/diagnostico/sugerencias`) y "Estadísticas" (→ `/diagnostico/estadisticas`).
- Acción de cabecera: **"Crear"** (`BTN_GHOST`) → `/diagnostico/nuevo` (o `/diagnostico/nuevo?categoria=X` si hay filtro de categoría activo por query string).
- Buscador (`type="search"`, placeholder "Describir el problema: no imprime, sin red..."), filtra por título normalizado.
- `?categoria=<id>` (llegada, por ejemplo, desde "Iniciar diagnóstico" en la ficha de un equipo): preselecciona esa categoría; banner "Solo: [Categoría]" con enlace "Ver todos".
- Diagnóstico en curso: banner destacado (ícono `Play`) con el diagnóstico que tiene la sesión local más reciente (`db.progresoDiagnostico`, ordenado por `actualizadoEn`), oculto mientras se filtra; enlaza directo a `/diagnostico/:id` (retoma automáticamente, ver 3.5.5).
- Listado agrupado por categoría (solo categorías con resultados), cada fila con ícono `WarningCircle` fijo (naranja/precaución, no cambia por tipo, a diferencia de los artículos), título, descripción truncada opcional, `BotonFavorito` (hermano del `Link`, no anidado, por accesibilidad) y caret.
- Estados vacíos: "Todavía no hay diagnósticos" (sin ninguno creado, con botón Crear) vs. "Ningún problema coincide" (hay diagnósticos pero el filtro no encuentra nada, con enlace "Ir a Guías").

**`DiagnosticoForm` — editor de diagnóstico (crear/editar)**

Archivo: `src/features/diagnostico/DiagnosticoForm.tsx`. Rutas `/diagnostico/nuevo` y `/diagnostico/:diagnosticoId/editar`.

Cabecera (`Chasis modo="tarea"`, sin pestañas): rótulo "Creando"/"Editando", subtítulo fijo "Un árbol de preguntas que lleva del problema a la solución", botón "Eliminar" (solo en edición) que abre `DialogoEliminar`.

`NodosEditor` (sección "Preguntas"): cada nodo (pregunta) es una tarjeta con:
- Número + etiqueta ("Inicio del diagnóstico" para el nodo 0, "Pregunta N" para el resto; el primer nodo de la lista es siempre el inicio, sin marcador de datos aparte).
- Menú "···" (`DotsThreeOutline`) con **Subir / Bajar** (deshabilitados en los extremos), **Duplicar** (copia con id nuevo, título interno sufijado " (copia)", ids de opciones regenerados, destinos salientes conservados) y **Eliminar** (deshabilitado si es el único nodo; al eliminar, cualquier respuesta de otro nodo que apuntaba a este queda con `siguienteNodoId: null` en vez de romperse).
- Input "La pregunta: ¿La impresora está encendida?" (texto de la pregunta).
- Input "Cómo comprobarlo (opcional)" (descripción/ayuda).
- Lista de respuestas (`OpcionDiagnostico`), ver tabla de campos en 3.5.3.
- Botón "+ Respuesta" al pie de cada tarjeta.
- Botón "+ Agregar pregunta" al pie de toda la sección (crea un nodo nuevo con opciones "Sí"/"No" prefilladas, `crearNodo`).

Panel "Antes de guardar, revisar esto" (rojo, `WarningOctagon`): solo aparece tras un intento de guardar fallido; lista de problemas detectados por `validarNodos` (ver 3.5.5).

Panel "Procedimientos vinculados sin disponibilidad" (ámbar, no bloquea el guardado): por cada respuesta que ejecuta un `articuloId` que ya no está entre los ejecutables (existe, no eliminado, con procedimiento, sin filtrar por estado publicado a propósito, porque el asistente real ejecuta aunque sea borrador). Nota fija: "No impide guardar (puede ser un artículo que aún no sincronizó), pero en el diagnóstico real esa rama quedaría sin el procedimiento."

Motivo del cambio (solo en edición): mismo patrón que en `ArticuloForm`.

Barra inferior fija: botón secundario **"Probar"** (abre `PruebaDiagnostico`) y botón primario **"Guardar diagnóstico"** (deshabilitado mientras se guarda).

`DialogoEliminar` (sensible): "¿Eliminar este diagnóstico?" / "Se elimina el árbol de preguntas completo. Los procedimientos vinculados no se tocan."

**Modo prueba — `PruebaDiagnostico`**

Archivo: `src/features/diagnostico/PruebaDiagnostico.tsx`. Se abre como capa modal (`z-[70]`) sobre el formulario, sin navegar ni guardar nada.
- Badge fijo "Modo prueba" en la cabecera.
- Aviso permanente: "Es un recorrido de prueba: no se guarda nada y los procedimientos vinculados no se ejecutan de verdad."
- Un artículo vinculado nunca se ejecuta de verdad, se representa con una tarjeta:
  - Si sigue siendo ejecutable: "Aquí se ejecutaría el procedimiento: [título]" + botón "Continuar (como si estuviera completo)".
  - Si ya no está disponible: panel de error "El procedimiento «X» ya no está disponible (se eliminó o perdió sus pasos)." + botón "Continuar de todos modos".
- Si una respuesta apunta a una pregunta ya eliminada del árbol en memoria: panel de precaución + botón "Empezar de nuevo".
- Pantalla final: mensaje final (o el genérico según haya ejecutado un artículo o recorrido todas las preguntas), "Camino recorrido" (lista pregunta → respuesta), botón "Volver a empezar".
- Navegación: "← Volver" (deshace la última respuesta, oculto si no hay camino) y "Reiniciar" (mientras hay camino y no se llegó al final).
- Botón "Cerrar" en la cabecera, sin confirmación.

**Ejecución real — `DiagnosticoRunPage`**

Archivo: `src/features/diagnostico/DiagnosticoRunPage.tsx`. Ruta `/diagnostico/:diagnosticoId`.

Cabecera (`Chasis modo="tarea"`, sin pestañas): rótulo "Diagnosticando", `vuelta="Diagnósticos"`, `salidaEtiqueta="Guardar el avance y salir"`. Ícono lápiz (editar diagnóstico) arriba a la derecha. Barra de progreso pegajosa con `porcentajeDiagnostico` y etiqueta "Completado" o "Pregunta N".

Estados de la sesión (`estado.tipo`):
1. **`pregunta`**: título = pregunta del nodo actual, descripción opcional debajo. Una fila de botones, uno por opción (`min-h-[52px]`): etiqueta + "Ejecuta: [título]" si la opción tiene `articuloId`. Si el nodo actual ya no existe (se editó el diagnóstico a mitad de una sesión): panel de precaución "El diagnóstico cambió y la pregunta actual ya no existe. Hay que empezar de nuevo." + botón que borra el progreso.
2. **`articulo`**: tarjeta "Ejecutando el procedimiento: [título]" (con nota "Marca cada paso con su número al completarlo." si el procedimiento no tiene tareas con casilla) + `AsistenteVista` anidado a nivel 0. Si el artículo vinculado ya no existe o quedó sin pasos: panel de precaución + botón "Continuar con el diagnóstico" (avanza igual, sin ejecutar nada).
3. **`final`**: pantalla de resultado (ver comportamientos en 3.5.5).

Navegación dentro de la sesión (fuera del estado `final`, oculta mientras se confirma cancelar):
- "Volver" (solo si hay camino recorrido): `volverAtras` deshace la última respuesta y vuelve a la pregunta que la originó (funciona también desde un estado `articulo` o `final`).
- "Cancelar": abre confirmación inline "¿Cancelar el diagnóstico? El avance se descarta y queda registrado como abandonado." con "Sí, cancelar" y "Seguir con el diagnóstico".

Resultado (`estado.tipo === 'final'`):
- Banner de éxito "Diagnóstico completado" con el mensaje final (el de la opción terminal, o "Se ejecutó 'X'." si terminó tras un artículo, o "Se recorrieron todas las preguntas." si no hay mensaje ni artículo).
- "Camino recorrido": lista pregunta → respuesta elegida, y si hubo artículos ejecutados, su lista de títulos.
- "¿Quedó resuelto el problema?": botones "Sí, resuelto" / "No" (con selector de motivo, ver 3.5.4).

**`SugerenciasEquipoPage` (`/diagnostico/sugerencias`)**

Archivo: `src/features/diagnostico/SugerenciasEquipoPage.tsx`.
- Lista todas las `ejecuciones_diagnostico` con motivo `encontro_otra_solucion` y `solucionPropuesta` no vacía, más recientes primero.
- Cada tarjeta: título del diagnóstico (congelado) + fecha, texto libre de la solución propuesta, "Reportado por [nombre]" si existe.
- Cierre del bucle: si ya existe un artículo con `origenSugerenciaId` igual al id de esta ejecución → enlace "Ya redactada: [título]" (evita que dos técnicos redacten el mismo artículo dos veces). Si no existe y el diagnóstico de origen todavía existe → botón "Redactar artículo" → `/soluciones/:categoriaId/nuevo?desdeSugerencia=:id`. Si el diagnóstico de origen fue eliminado, no se ofrece ningún botón.
- Estado vacío: "Todavía no hay sugerencias del equipo."

**`EstadisticasPage` (`/diagnostico/estadisticas`)**

Archivos: `src/features/diagnostico/estadisticas.ts` (lógica pura) + `EstadisticasPage.tsx` (vista). Fuente única: la tabla inmutable `ejecuciones_diagnostico`.
- Resumen (4 tarjetas): Ejecuciones (total), Tasa de éxito (`resueltas/cerradas`, solo sobre `si`+`no`, excluye abandonadas), Duración típica (mediana, no promedio, de las ejecuciones resueltas), Abandonados (conteo).
- "Problemas más frecuentes": hasta 5, agrupados por `diagnosticoId`, ordenados por cantidad de ejecuciones (desempate alfabético); título mostrado = el de la ejecución más reciente de ese grupo; enlaza a `/diagnostico/:id` solo si el diagnóstico sigue vivo, si no se muestra como texto plano.
- "Procedimientos más usados": hasta 5, contando en cuántas ejecuciones (no cuántas veces en total) se abrió cada artículo; enlaza a la ficha del artículo si sigue vivo.
- "Por qué no queda resuelto": desglose de las ejecuciones cerradas en `'no'` por motivo (omite las sin motivo, de antes de la fase D3); si aparece `encontro_otra_solucion`, enlace a "Ver las sugerencias del equipo".
- Formato: duración sin decimales ("45 s", "3 min", "1 h 20 min"); porcentaje redondeado con espacio fino antes del signo ("80 %").
- Estado vacío: "Todavía no hay diagnósticos ejecutados."

#### 3.5.3 Formularios y campos

**`DiagnosticoForm` — campos de "Problema" (sección fija, sin pestañas)**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento |
|---|---|---|---|---|
| Problema (`titulo`) | `input text` | Obligatorio | `''` | Placeholder "Como lo diría el técnico: La impresora no imprime"; anti-duplicados cruzado con rebote de 300ms contra artículos Y diagnósticos (`buscarSimilares(..., ['articulo','diagnostico'])`) |
| Categoría (`categoriaId`) | Chips de selección única | Obligatorio | `''`, o `?categoria=` al crear | Un solo chip activo por vez; al editar, la categoría real del diagnóstico pisa cualquier `?categoria=` de la URL |
| Descripción (opcional) | `input text` | Opcional | `''` | "Una línea que ayude a reconocer el problema" |

**Nodo del árbol (`NodoDiagnostico`)**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento |
|---|---|---|---|---|
| Pregunta | `input text` | Obligatorio de hecho (validado al guardar) | `''` | "La pregunta: ¿La impresora está encendida?"; sin texto genera error de validación |
| Cómo comprobarlo (descripción/ayuda) | `input text` | Opcional | `''` | Texto de apoyo bajo la pregunta |
| Respuestas | Lista de `OpcionDiagnostico` (ver abajo) | Obligatorio al menos una (validado al guardar) | `[]` (o `Sí`/`No` prefilladas al crear el nodo con "+ Agregar pregunta") | Sin respuestas genera error de validación |

**Respuesta (`OpcionDiagnostico`)**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento |
|---|---|---|---|---|
| Etiqueta | `input text` | Obligatorio de hecho (validado al guardar) | `''` (o "Sí"/"No" al crear el nodo) | "Respuesta: Sí, No, otra..."; botón X para quitar la respuesta |
| Destino de esta respuesta | `<select>` | Obligatorio (siempre resuelve a un valor) | "Termina aquí" | Opciones: "Termina aquí (mensaje final o procedimiento)" o "Sigue en la pregunta N: [título]"; la lista excluye la propia pregunta |
| Mensaje final | `input text` | Condicional | `''` | Visible solo si NO hay `siguienteNodoId`; junto con el vínculo a procedimiento, al menos uno de los dos debe existir (validado al guardar) |
| Vincular procedimiento (`articuloId`) | Botón que despliega lista de artículos | Opcional | sin vínculo | Candidatos = artículos publicados con procedimiento ejecutable (o mensaje "No hay procedimientos publicados para vincular." si no hay ninguno); vinculado, muestra "Ejecuta: [título]" con botón Quitar |

#### 3.5.4 Relaciones y reutilización de datos

| Vínculo | Campo(s) | Dónde se edita | Dónde se ejecuta/lee |
|---|---|---|---|
| Diagnóstico: respuesta → procedimiento | `OpcionDiagnostico.articuloId/Titulo` | `DiagnosticoForm.tsx`, `NodosEditor` | `DiagnosticoRunPage` (estado `articulo`) y `PruebaDiagnostico` (representado, no ejecutado) |
| Diagnóstico → artículo nuevo (bucle de sugerencia) | `EjecucionDiagnostico.solucionPropuesta` (motivo `encontro_otra_solucion`) → `Articulo.origenSugerenciaId` | Se origina en `DiagnosticoRunPage` (Resultado), se cierra en `ArticuloForm` vía `?desdeSugerencia=` | `SugerenciasEquipoPage` lista las pendientes; `ArticuloForm` precarga título/descripción/tipo/estado |

El resto de los vínculos que Diagnóstico comparte con Guías (paso→bóveda, artículo→equipos, subprocedimiento, solución, decisión, artículos relacionados) están documentados en la tabla completa de 3.4.4, ya que se editan y ejecutan dentro del módulo Guías; Diagnóstico solo los consume indirectamente al ejecutar un artículo publicado como parte de una rama del árbol.

**Motivos de "no resuelto"** (archivo `src/features/diagnostico/motivos.ts`, único dueño del texto de cada motivo, compartido entre `DiagnosticoRunPage` y `EstadisticasPage`):

| Valor | Etiqueta |
|---|---|
| `no_funciono` | La solución no funcionó |
| `no_encontro_problema` | No encontré mi problema |
| `faltan_pasos` | Faltan pasos |
| `encontro_otra_solucion` | Encontré otra solución |
| `otro` | Otro |

Orden de la pregunta: de lo más accionable ("la solución existe pero no sirvió") a lo más vago. Si el motivo elegido es "Encontré otra solución", aparece un `textarea` obligatorio-de-hecho (placeholder "Qué funcionó, para revisarlo e incorporarlo a la base de conocimiento") cuyo contenido se guarda como `solucionPropuesta`, la semilla de las "Sugerencias del equipo".

Regla de estado del artículo aplicada aquí (ver también 3.4.5): los artículos vinculables como respuesta de un nodo se filtran a `estado === 'publicado'` en el editor (`DiagnosticoForm.tsx`), pero el asistente en tiempo de ejecución de un diagnóstico ya guardado SÍ ejecuta artículos aunque sean borrador (solo exige que existan, no estén eliminados y tengan procedimiento).

#### 3.5.5 Comportamientos y reglas de negocio

**Validación del árbol al guardar** (`validarNodos`, `src/lib/diagnostico.ts`), mostrada en el panel "Antes de guardar, revisar esto" solo tras un intento de guardar fallido:
- Falta el problema (título del diagnóstico).
- Falta elegir una categoría.
- Por cada pregunta: sin texto ("La pregunta N no tiene texto."), sin respuestas ("La pregunta N no tiene respuestas.").
- Por cada respuesta: sin texto, destino a una pregunta que ya no existe, destino a su propia pregunta (auto-ciclo trivial), o terminal sin mensaje ni artículo ("no lleva a ninguna parte").
- **Ciclos**: DFS desde el nodo inicial; si el recorrido vuelve a un nodo ya en la pila de visita actual, error "Las preguntas forman un ciclo: siguiendo las respuestas se vuelve a una pregunta anterior."
- **Nodos inalcanzables**: cualquier pregunta no visitada desde el nodo inicial, error "La pregunta N no se puede alcanzar desde la primera: conéctala desde alguna respuesta o elimínala."

Al guardar (`guardar()`): valida título + categoría + `validarNodos`; si hay problemas, los muestra y no guarda; si no, `guardarRegistro('diagnosticos', {...}, motivo)` y navega a `/diagnostico`.

**Reglas de negocio del árbol** (archivo `src/lib/diagnostico.ts`):
- El primer nodo de la lista (`nodos[0]`) es siempre el nodo inicial; no hay un campo `esInicial` separado, por lo que reordenar preguntas en el editor puede cambiar cuál es el inicio.
- Una opción terminal (`siguienteNodoId === null`) debe tener mensaje final o artículo vinculado (puede tener ambos: el mensaje se ignora en favor del artículo, ya que `avanceAlResponder` prioriza `opcion.articuloId` sobre `opcion.mensajeFinal`/`siguienteNodoId`).
- `profundidadRestante`: mide, desde un nodo, la cadena más larga posible hasta una rama terminal (con protección anti-ciclo, corta a 0 si detecta revisita), usada solo para la barra de progreso, nunca para la validación de guardado.
- `porcentajeDiagnostico`: `respondidas / (respondidas + restante)`, tope 95% mientras no se llega al final (100% solo en el resultado), nunca retrocede al responder.

**Modo prueba (`PruebaDiagnostico`)**: recorre los nodos en memoria (aún sin guardar), usando las mismas transiciones puras que el asistente real (`avanceInicial`, `avanceAlResponder`, `avanceTrasArticulo`, `avanceAlRetroceder` de `src/lib/diagnostico.ts`), de modo que "qué respuesta lleva a dónde" es idéntico a lo que verá el técnico en producción; ningún artículo vinculado se ejecuta de verdad y no se persiste nada.

**Ejecución real (`DiagnosticoRunPage`)**:
- **Auto-inicio**: si no hay `progresoDiagnostico` guardado para este diagnóstico y hay nodos, se inicia automáticamente en la primera pregunta (`iniciarDiagnostico`, sin pantalla intermedia), decisión explícita de producto. Un `ref` (`iniciando`) evita doble disparo mientras las live queries se estabilizan.
- **Salir (la X)** (`salir()`): si la sesión no tiene ningún paso respondido todavía (auto-inicio recién disparado sin interacción), se descarta el progreso (`eliminarProgresoDiagnostico`) para no dejar un "en curso" fantasma; si ya hay avance, se conserva tal cual para retomar después. Ambos casos navegan a `/diagnostico`.
- Al tocar una opción de respuesta, `responderOpcion`: si la opción ejecuta un artículo, su progreso se reinicia siempre primero, para que un avance viejo de haberlo ejecutado suelto no lo dé por completado y se lo salte.
- En el estado `articulo`, al completarse (todos los pasos y su verificación final, calculado con `contarHechos`/`verificacionFinalCompleta`), un `useEffect` con guardia `avisado` dispara una sola vez `terminarEjecucionArticulo`, que reinicia el progreso del artículo y avanza a la siguiente pregunta (o al resultado final).
- Resultado: "¿Quedó resuelto el problema?" → "Sí, resuelto" cierra directo con `resuelto='si'`; "No" despliega el selector de motivo (ver 3.5.4); botones "Confirmar" (cierra con `resuelto='no'`) y "Volver" (regresa a Sí/No).
- **Cierre de la sesión (`cerrar`)**: un abandono sin ninguna respuesta (`resuelto==='abandonado' && sesion.camino.length===0`) no se registra en absoluto (no aporta nada a las estadísticas); en cualquier otro caso se llama `registrarEjecucionDiagnostico` (crea la fila inmutable en `ejecuciones_diagnostico` con `diagnosticoId`, título congelado, camino, artículos ejecutados, `resuelto`, `duracionSegundos` calculada desde `iniciadoEn`, `motivo`, `solucionPropuesta`) y siempre se elimina el progreso local (`eliminarProgresoDiagnostico`), navegando a `/diagnostico`.

**Regla de anidamiento único (compartida con Guías)**: los artículos ejecutados dentro de un diagnóstico usan `AsistenteVista` a nivel 0, con las mismas reglas de un solo nivel de anidamiento inline para subprocedimientos, soluciones y decisiones, y el mismo tratamiento de vínculo roto descrito en 3.4.2 y 3.4.5.
### 3.6 Equipos / Inventario (`/dispositivos`)

#### 3.6.1 Jerarquía y rutas

El módulo de Equipos abarca las siguientes pantallas, todas bajo el prefijo `/dispositivos` salvo la ficha individual (que comparte espacio de nombres con la sección Red):

| Ruta | Componente | Nivel de chasis | Cómo se llega | A dónde vuelve |
|---|---|---|---|---|
| `/dispositivos` | `DispositivosPage` (lista) | 1 (raíz de pila) | Menú principal, enlaces "Equipos" | Es raíz, no tiene "volver" |
| `/dispositivos/nuevo` | `DispositivoForm` (modo alta) | 3 (tarea con salida) | Botón "Crear" de la lista; "Duplicar"/"Reemplazar" desde la ficha; "Registrar equipo" desde el escáner | "Cancelar y volver"; tras guardar navega a la ficha nueva `/dispositivos/:id` (con `state:{recienCreado:true}`, salvo en modo reemplazo) |
| `/dispositivos/:id/editar` | `DispositivoForm` (modo edición) | 3 | "Editar" del menú "···" de la ficha, o "Editar la ficha" desde "Documentar este equipo" | Igual; tras guardar navega a `/dispositivos/:id` sin el estado `recienCreado` |
| `/dispositivos/:id` | `DispositivoPage` (ficha) | 2 (documento, con pestañas) | Fila de la lista, enlaces "Duplicar/Reemplazar/etc.", escáner, buscador | `volverA = esRed ? '/red' : '/dispositivos'`, calculado dinámicamente según la categoría real del equipo; etiqueta del botón "Red" o "Equipos" según corresponda |
| `/dispositivos/:id/baja` | `DarDeBajaPage` | 3 | "Dar de baja" del menú "···" de la ficha | Salida "Salir sin dar de baja" hacia `/dispositivos/{id}` (vuelta "La ficha del equipo") |
| `/dispositivos/:id/reemplazo` | `ReemplazoPage` | 3 | Automático tras guardar el alta con `?reemplazaA=`, o desde el banner "Migración pendiente" de la ficha del equipo entrante | Salida "Salir sin migrar" hacia `/dispositivos/{nuevoId}` (vuelta "La ficha del equipo nuevo") |
| `/dispositivos/etiquetas` | `EtiquetasPage` | 3 (contenedor propio fuera del `Layout`, pensado para imprimir) | Menú "···" de la lista ("Etiquetas QR"), o menú "···" de una ficha individual ("Etiqueta QR") | Salida "Salir sin imprimir" hacia `/dispositivos` (vuelta "Equipos") |
| `/dispositivos/importar` | `ImportarDispositivosPage` | 3 | Menú "···" de la lista ("Importar") | Salida "Salir sin importar" hacia `/dispositivos` (vuelta "Equipos") |

**Regla de anulación de "Volver" para categorías de red (`esRed`)**: en `DispositivoPage.tsx:234-237` se calcula en tiempo de ejecución, sobre la categoría real del dispositivo (no sobre cómo se llegó a la ficha):

```
const esRed = esDeRed(categoria)
const volverA = esRed ? '/red' : '/dispositivos'
```

La etiqueta del botón de regreso del chasis (`volverEtiqueta`) y el contexto mostrado bajo el título también cambian entre "Red" y "Equipos" según esta misma condición. Al eliminar un equipo desde su ficha, la función `eliminar()` navega también a `volverA`, de modo que un equipo de red eliminado regresa a `/red` en vez de a `/dispositivos`.

Consecuencia directa: la lista `DispositivosPage` excluye explícitamente del listado a todos los dispositivos cuya categoría sea `esRed` (mediante el conjunto `idsRed`); esos equipos nunca aparecen en "Equipos", solo en la sección Red.

#### 3.6.2 Lista de Equipos (`DispositivosPage`)

Fuente de datos: consulta en vivo `db.dispositivos.filter(d => !d.eliminadoEn)`, excluyendo las categorías de red.

**Cabecera / barra**
- Subtítulo fijo: "Qué se sabe de cada equipo".
- Ícono "Escanear equipo" (ícono `QrCode`, botón secundario): navega a `/escaner`.
- Botón "Crear" (ícono `Plus` + texto): navega a `/dispositivos/nuevo`.
- Botón "···" ("Más acciones", `aria-label="Más acciones: ubicaciones, personas, etiquetas QR, importar"`): alterna un menú desplegable con 4 chips:
  - "Ubicaciones" (`MapPin`) → `/ubicaciones`
  - "Personas" (`User`) → `/personas`
  - "Etiquetas QR" (`QrCode`) → `/dispositivos/etiquetas`
  - "Importar" (`UploadSimple`) → `/dispositivos/importar`
  - Cada clic cierra el menú automáticamente.

**Buscador**
- Campo `type="search"`, placeholder "Nombre, IP, serial o ubicación", `aria-label="Buscar equipos"`.
- Filtra en memoria sobre los campos `nombre`, `ip`, `ubicacion` y `serial` de cada equipo.
- Botón "×" (`XCircleFill`, `aria-label="Borrar búsqueda"`) para vaciar el texto, visible solo mientras hay texto escrito.
- El borde del campo cambia a color de acento mientras hay texto ingresado.

**Chips de categoría**
- Fila deslizable horizontal (sin scrollbar visible): "Todos" (con el conteo total) más un chip por cada categoría NO-red, ordenadas por su campo `orden`.
- Cada chip muestra su conteo calculado sobre el inventario general completo, no sobre el resultado del filtro de texto actual.
- `aria-pressed` refleja si el chip está activo; volver a tocar el mismo chip lo desactiva (comportamiento de alternancia/toggle).

**Resumen de estados**
Se calcula siempre sobre el inventario general completo, nunca sobre el filtro actual en pantalla:
- "{N} equipos" (total)
- "{N} operativos" (punto verde)
- "{N} en mantenimiento" (punto ámbar)
- "{N} fuera de servicio" (punto rojo)
- La comparación de estado usa la función de normalización de etiquetas del módulo de topología de Red, no el texto crudo guardado en `estado`.

**Filas y estado vacío**
- Cada resultado usa el componente compartido `FilaDispositivo`, con subtítulo `[categoría, ubicación].filter(Boolean).join(' · ')` y foto si existe.
- Estado vacío sin filtros activos: "Aún no hay equipos registrados" / "Agregarlos desde 'Crear'."
- Estado vacío con filtros activos: "Ningún equipo coincide" / "Probar con otra palabra o quitar el filtro de categoría." más un botón "Quitar filtros" que resetea a la vez la categoría seleccionada y el texto de búsqueda.

#### 3.6.3 Formulario de creación / edición (`DispositivoForm`)

**Modos de entrada según parámetros de la URL**

| Query param | Efecto |
|---|---|
| (ninguno, ruta `/dispositivos/:id/editar`) | Edición: precarga todos los campos del dispositivo existente. |
| `?copiarDe=<id>` | Duplicar: precarga desde otro equipo. El nombre se sufija con " (copia)". Serial, placa, IP y foto quedan en blanco. El estado se copia tal cual del original. |
| `?reemplazaA=<id>` | Reemplazo: misma precarga que duplicar (usa internamente el mismo mecanismo de `copiarDe`), pero el nombre se conserva IGUAL (sin "(copia)"), y el estado se fuerza a "Operativo" en vez de copiarse del equipo saliente (para no arrastrar el motivo por el que se está reemplazando). Al guardar, no navega a la ficha del nuevo equipo sino a `/dispositivos/:id/reemplazo`. |
| `?red=1` | Prioriza las categorías `es_red` en el selector de categoría (usado desde la sección Red). |
| `?serial=<texto>` | Precarga el campo Serial, solo si NO es edición ni copia; usado por el escáner cuando no encuentra coincidencia para un código leído. |
| `?nombre=<texto>` | Precarga el campo Nombre, solo en alta desde cero; usado desde el buscador de Inicio. |

El `id` del registro se decide al montar el formulario y permanece estable durante toda la sesión de edición, lo que permite excluirse a sí mismo en los chequeos de duplicado (serial/IP) y navegar a su propia ficha apenas se guarda.

**Cabecera del formulario**
- Chasis en modo "tarea"; rótulo "Editando" o "Creando"; título = nombre escrito en vivo, o "Editar equipo"/"Nuevo equipo" mientras el campo Nombre está vacío.
- Etiqueta de salida: "Cancelar y volver".
- Tag visible en la barra: "Reemplazo de otro equipo" (si el formulario está en modo reemplazo) o "Copia de otro equipo" (si es duplicado sin ser reemplazo).
- Texto de ayuda permanente: "Solo el nombre y la categoría son obligatorios; el resto se puede completar después".

**Tabla completa de campos — `DispositivoForm`**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Nombre | `input text` | **Obligatorio** | `''`, o precargado por `?nombre=`, o `"{original} (copia)"` en duplicar, o el nombre tal cual en reemplazo | Placeholder "Qué es y dónde está: Zebra ZT411 · Bodega central"; determina el título de la cabecera en vivo |
| Categoría | Chips seleccionables (uno activo) | **Obligatorio** | `''` | Lista ordenada por `orden` (o priorizando red si `?red=1`); cada chip con ícono y color propios de la categoría |
| Marca | `input text` con sugerencias (`datalist`) | Opcional | `''` | Sugerencias = marcas ya usadas por otros equipos; placeholder "Zebra, HP, Cisco..." |
| Modelo | `input text` | Opcional | `''` | Placeholder "ZT411" |
| Foto | Selector de archivo (`accept="image/*"`) | Opcional | `null` | Ver comportamiento detallado más abajo (Foto/`FotoEditor`) |
| Número de serie | `input text` monoespaciado | Opcional | `''`, o precargado por `?serial=` | Si coincide (sin distinguir mayúsculas, con espacios recortados) con el serial de otro dispositivo existente (excluyendo el propio id), muestra aviso: "Este serial ya existe en **{nombre}**. Revisar antes de crear un duplicado." con enlace a la ficha del duplicado. No bloquea el guardado |
| Placa de inventario | `input text` monoespaciado | Opcional | `''` | Sin chequeo de duplicado en este formulario (solo se valida en la importación masiva) |
| Ubicación (`SelectorUbicacion`) | `select` + opciones especiales | Opcional | `''` texto / `null` id | Ver comportamiento detallado más abajo |
| Responsable (`SelectorPersona`) | `select` + opciones especiales | Opcional | `''` texto / `null` id | Ver comportamiento detallado más abajo |
| Dirección IP | `input text` (`inputMode="decimal"`, monoespaciado) | Opcional | `''` | Valida solo el FORMATO (regex `^\d{1,3}(\.\d{1,3}){3}$`), no el rango de valores. Si no cumple el formato y el campo no está vacío, el borde se marca en color de precaución con mensaje "No parece una IP válida (formato 192.168.1.10)", pero NO bloquea el guardado. Si coincide (sin distinguir mayúsculas) con la IP de otro dispositivo existente, muestra aviso de conflicto: "Esta IP ya existe en **{nombre}**. Revisar antes de crear un conflicto de red." con enlace |
| Estado | Chips seleccionables con punto de color | Opcional | `'Operativo'` en alta nueva; `''` en edición/duplicado hasta cargar | Opciones: Operativo (verde), En mantenimiento (ámbar), Fuera de servicio (rojo), De baja (gris); comparación insensible a mayúsculas |
| Observaciones (dentro de "Más información") | `textarea` (3 filas) | Opcional | `''` | Placeholder "Qué imprime, cada cuánto se mantiene, particularidades" |
| Propiedades / "detalles" (`CamposClaveValor`, dentro de "Más información") | Lista dinámica de pares clave/valor | Opcional | `[]`, o precargado desde los detalles del dispositivo | Botón "+ Campo" agrega una fila `{clave, valor}` vacía; cada fila tiene botón "×" para quitarla. La clave ofrece sugerencias (`datalist`) tomadas de las claves ya usadas por otros equipos de la MISMA categoría. Al guardar, las filas con clave vacía se descartan |
| Motivo del cambio (solo en edición, dentro de "Más información") | `input text` | Opcional | `''` | Placeholder "Por qué se actualizó esta ficha"; se registra como motivo en el historial |

**Comportamiento de sub-componentes del formulario**

*Foto (`FotoEditor`)*
- Slot de 96x64 px; el clic abre el selector de archivo (`accept="image/*"`).
- Al elegir un archivo, exige que Supabase esté configurado; si no lo está, muestra error "La aplicación aún no está conectada al servidor." y no continúa.
- Comprime la imagen (ver `comprimirImagen` en 3.6.7) y la sube con deduplicación por hash.
- Avisos posibles tras subir: "Sin conexión: la foto quedó guardada en este dispositivo y se subirá sola al recuperar señal." (si quedó encolada); "Esa foto ya existía: se reutilizó sin subir contenido nuevo." (si se reutilizó por hash).
- Si falla la subida: "No se pudo subir la foto: {nombre archivo}".
- Botón "Quitar foto" (visible solo si hay foto y no está subiendo) limpia el campo a `null`.
- Texto de ayuda fijo: "Fotografía principal (opcional). Identifica el equipo en la lista, el buscador y al escanear su QR."
- **La foto NUNCA se copia al duplicar ni al reemplazar** (regla explícita del código): cada equipo físico lleva su propia imagen, igual que serial, placa e IP.

*Selector de Ubicación (`SelectorUbicacion`)*
- `<select>` con: "Sin ubicación" (vacío), cada ubicación existente (ordenada jerárquicamente, mostrando su ruta completa), "Otra (escribir manualmente)" y "+ Crear ubicación nueva".
- Si se elige "Otra": aparece un `input text` libre (placeholder "Escribe la ubicación"); el id de ubicación se pone en `null` pero el texto se conserva.
- Si se elige "+ Crear ubicación nueva": se despliega un mini-formulario inline con `input` "Nombre de la ubicación" (autoFocus), `select` "Dentro de (opcional)" para anidar bajo otra ubicación existente, botón "Crear y usar" (deshabilitado si el nombre está vacío o mientras guarda; crea la fila en el módulo Ubicaciones y la selecciona automáticamente) y botón "Cancelar" (cierra el mini-formulario sin crear nada).
- Texto de ayuda fijo: "Elige un lugar registrado para conectarlo con su ficha, o escríbelo a mano."
- El valor mostrado se resuelve así: si el id apunta a una fila que existe localmente, se muestra esa; si hay texto libre (o un id que ya no existe localmente), se muestra "Otra"; si no hay nada, queda vacío.

*Selector de Responsable (`SelectorPersona`)*
- Mismo patrón exacto que Ubicación, pero sin jerarquía: `<select>` con "Sin responsable", personas existentes (ordenadas alfabéticamente), "Otra (escribir manualmente)", "+ Crear persona nueva".
- El mini-formulario de creación solo pide "Nombre de la persona" (sin campo de "padre"/jerarquía).
- Texto de ayuda: "Elige a quién tiene asignado este equipo para conectarlo con su ficha, o escríbelo a mano."

*Bloque plegable "Más información"*
- Botón con resumen que alterna el bloque; el texto del resumen es "observaciones y propiedades" si nada tiene contenido, o "{N} con contenido" (cuenta observaciones no vacías más detalles con clave no vacía).
- Contiene: Observaciones, Propiedades (`CamposClaveValor` con título "Propiedades de {categoría}") y, solo en edición, Motivo del cambio.

**Validación general y guardado**
- El formulario se considera válido cuando el nombre no está vacío y hay una categoría seleccionada.
- Botón "Guardar equipo" (o "Guardando..." mientras procesa): si se pulsa sin ser válido, muestra el aviso "Falta el nombre o la categoría" en la barra inferior fija, sin guardar. El botón se atenúa visualmente cuando no es válido, aunque el atributo `disabled` real solo depende de si está guardando.
- Al guardar exitosamente:
  - Recorta todos los strings con `.trim()`.
  - El id de ubicación solo se conserva si el texto de ubicación no quedó vacío tras el trim (si quedó vacío, se fuerza `null` aunque hubiera un id seleccionado); mismo invariante para el id de responsable.
  - El campo que indica "reemplaza a" se fija una sola vez al crear y nunca se edita después.
  - Si es modo reemplazo: navega a `/dispositivos/{id}/reemplazo`.
  - Si no: navega a `/dispositivos/{id}`, pasando `state:{recienCreado:true}` solo si NO es edición (para disparar el bloque "¿Qué sigue?" una sola vez).
- Si se está editando un id que no existe, redirige automáticamente a `/dispositivos`.
- Mientras carga (en edición o copia, antes de la carga inicial), muestra una pantalla simple "Cargando...".

**Guardar / Cancelar / cierre**
- Cancelar = "Cancelar y volver" en la cabecera (salida del chasis en modo tarea); no hay confirmación explícita de descarte de cambios en el código.
- Guardar = botón fijo al pie ("Guardar equipo"/"Guardando...").
- No hay comportamiento de tecla Escape codificado explícitamente en este formulario (depende del componente compartido de chasis, fuera del alcance de este informe).

#### 3.6.4 Ficha del equipo (`DispositivoPage`)

La ficha se organiza en 4 capas conceptuales documentadas explícitamente en el código: **Ahora**, **Contexto**, **Acción**, **Profundidad**, más un bloque de creación al pie ("Puerta única de documentar") y una acción dominante fija.

**Cabecera y menú "···"**
- Título = nombre del equipo (se ancla al hacer scroll).
- Contexto bajo el título: `[Red o Equipos, ubicación].filter(Boolean).join(' · ')`.
- Botón favorito (tipo dispositivo).
- Botón "Compartir": usa el diálogo nativo de compartir del teléfono, o copia el enlace al portapapeles si no está disponible; si copia, cambia el ícono a un check por 1.5 segundos y el `aria-label` pasa a "Enlace copiado".
- Botón "···" (`aria-label="Más acciones: duplicar, editar, etiqueta QR, reemplazar, dar de baja o eliminar"`), despliega en la barra bajo la cabecera:
  - **Duplicar** → `/dispositivos/nuevo?copiarDe={id}`
  - **Editar** → `/dispositivos/{id}/editar`
  - **Etiqueta QR** → `/dispositivos/etiquetas` (NO enfoca directamente la etiqueta de este equipo; abre la pantalla general de etiquetas, donde hay que volver a localizar el equipo entre todos o filtrar por categoría)
  - **Reemplazar** → `/dispositivos/nuevo?reemplazaA={id}`
  - **Dar de baja** → `/dispositivos/{id}/baja`
  - **Eliminar** (estilo peligro/ghost): no navega; abre el diálogo `DialogoEliminar`
  - Cada opción cierra el menú al hacer clic.

**Diálogo Eliminar**
- Título: `¿Eliminar el equipo "{nombre}"?`
- Descripción: "Esta acción eliminará la ficha del equipo, sus campos y sus conexiones registradas."
- Advertencia condicional (calculada sobre el grafo de referencias): "Esas referencias quedarán rotas." si se detecta impacto en otras entidades.
- Marcado como acción sensible (probablemente exige confirmación reforzada, componente compartido).
- Al confirmar: elimina el registro y navega a `volverA` (Red o Equipos, según corresponda).
- Al cerrar: solo cierra el diálogo, sin efectos.

**Banner "Migración pendiente"**
- Se muestra solo si el equipo tiene un `reemplazaA` registrado Y el equipo saliente todavía tiene alguna dependencia sin migrar (conexiones, credenciales o campos protegidos).
- Texto: "Este equipo reemplaza a otro que todavía tiene conexiones, credenciales o campos protegidos sin migrar." con enlace a `/dispositivos/{id}/reemplazo`.
- Desaparece automáticamente (de forma reactiva) en cuanto no queda ninguna dependencia pendiente.

**Bloque "¿Qué sigue?"**
- Se muestra solo si el equipo fue `recienCreado` (capturado una única vez al montar la ficha desde el estado de navegación, para que el bloque no se autodestruya al tocar sus propios enlaces de anclaje).
- Pasos posibles, recalculados en vivo (un paso desaparece de la lista en cuanto se completa):
  - "Agregar una foto" → navega a `/dispositivos/{id}/editar` (único paso que es un enlace de navegación real; los demás son anclas `#hash`)
  - "Guardar sus datos de acceso" (solo con permiso de Bóveda y si aún no hay campos protegidos) → ancla `#seguridad`
  - "Registrar sus conexiones de red" (si aún no hay conexiones) → ancla `#conexiones`
  - "Vincular un procedimiento o reportar una incidencia" (si aún no hay procedimiento vinculado) → ancla `#resolver`

**Capa "Ahora"**
- Tarjeta con miniatura (foto o ícono de categoría), nombre, marca/modelo (o línea meta alternativa si faltan), y una pastilla de estado con punto de color.
- Fila "Dirección IP" (copiable) si el equipo tiene IP registrada.
- Fila de Ubicación: si hay una entidad de ubicación viva, es un enlace a `/ubicaciones/{id}` con flecha, pasando estado de navegación para que la ficha de ubicación pueda indicar "vuelve al equipo X"; si solo hay una copia de referencia en texto, se muestra sin enlace, en gris.

**Capa "Contexto"**
Solo se renderiza si hay al menos un dato de contexto disponible. En orden:
- Número de serie (técnico, copiable) — solo si tiene valor.
- Placa de inventario (técnico, copiable) — solo si tiene valor.
- Cada par de "detalles" (propiedades libres) como fila, con etiqueta = clave, copiable.
- Responsable: enlace a `/personas/{id}` si la entidad está viva, o texto plano si solo hay copia de referencia.
- "Reemplaza a": enlace a `/dispositivos/{reemplazaA}`, solo si el vínculo se resuelve; sin copia de referencia — si el dato no sincronizó o ya no existe, la fila simplemente no se muestra (no expone el id crudo).
- "Reemplazado por": vínculo inverso derivado (no guardado en la base), calculado buscando el equipo vivo cuyo `reemplazaA` apunte a este; enlace a la ficha del equipo entrante.
- "Categoría y fecha": `"{categoría} · actualizado {fecha corta}"`.
- Observaciones (párrafo libre), debajo de la tarjeta, si no está vacío.

**Capa "Acción" (`#resolver`)**, en orden:
1. Botón destacado "Iniciar diagnóstico {de categoría}" → `/diagnostico?categoria={categoriaId}`; se oculta por completo si no hay ningún diagnóstico definido para esa categoría.
2. **Procedimientos del equipo**: filas de procedimientos específicos de este equipo (vínculo inverso desde artículos que lo listan como equipo afectado, excluyendo los de tipo "problema frecuente", solo publicados) más procedimientos de la misma categoría (hasta 5 visibles, con enlace "Ver los N de la categoría" si hay más), refinados opcionalmente por marca/modelo aplicable. Se oculta entera si no hay ninguno.
3. **Problemas del equipo**: mismo patrón que el anterior pero para artículos de tipo "problema frecuente", con ícono ámbar y mostrando el primer síntoma como subtítulo.
4. **Credenciales del equipo**: credenciales de la Bóveda que dan acceso a este equipo (vínculo inverso del grafo). Solo visible con permiso de ver Bóveda; si no hay permiso, la sección no aparece en absoluto (ni siquiera insinúa que existan credenciales). Cada fila enlaza a la ficha de la credencial en la Bóveda ("Bóveda · requiere desbloqueo").

**Capa "Profundidad"** (secciones plegables con conteo, contenido montado solo al abrirse):
1. "Si falla, caen" (visible solo si hay equipos en riesgo o cadena de dependencia) — contenido de impacto de red, fuera del alcance detallado de este documento.
2. "Conexiones" (`#conexiones`) — conteo = total de conexiones donde el equipo es origen o destino, o "Ninguna".
3. "Datos protegidos" (`#seguridad`, solo visible con permiso de Bóveda) — conteo = campos protegidos activos, o "Ninguno". Se fuerza abierta inicialmente si llega el parámetro `?nuevoCampoProtegido=` (aviso anti-duplicidad desde la Bóveda). Ver detalle en 3.6.5.
4. "Adjuntos" (`#foto`) — conteo total de adjuntos del equipo, o "Ninguno". Muestra primero la foto principal (banner de 150px si existe y está disponible offline) y luego el componente genérico de Adjuntos.
5. "Intervenciones" — conteo de entradas de historial de tipo intervención, mostrado como tiempo relativo de la última si hay alguna, o "Ninguna". Contiene el formulario para registrar una intervención más el historial genérico.

**Puerta única de documentar**
- Botón plegable "Documentar este equipo · foto, procedimiento o incidencia" con nota "se hace mejor desde el ordenador".
- Al abrir, muestra:
  - Si falta completitud: "Ficha al {N}%. Falta: {lista}." (calculado según se detalla en 3.6.6).
  - Botones: "Editar la ficha" (`/dispositivos/{id}/editar`); "Reportar incidencia" (`/soluciones/{categoriaId}/nuevo?tipo=problema_frecuente&dispositivoAfectado={id}&dispositivoNombre={nombre}`); "Documentar procedimiento" (mismo destino sin forzar el tipo); y, solo con permiso de Bóveda, "Guardar secreto" (`/boveda/nueva?titulo=Acceso {nombre}&categoria={categoriaNombre}&dispositivoId={id}&dispositivoNombre={nombre}`).

**Acción dominante fija**
- Solo aparece si hay al menos un procedimiento o problema aplicable (específico del equipo o de su categoría).
- Botón único fijo al pie: "Resolver un problema con este equipo" → `/diagnostico?categoria={categoriaId}`.
- Subtexto: "{N procedimientos} y {N problemas frecuentes} aplican aquí" (singular/plural ajustado correctamente).

#### 3.6.5 Sección "Seguridad" / campos protegidos del equipo

Vive dentro de la ficha del equipo (no en el formulario de alta/edición), por diseño explícito del código: coherencia con Adjuntos y Conexiones (que también son tablas aparte) y porque exige la Bóveda desbloqueada para cifrar, lo que rompería el guardado de una ficha normal si estuviera integrado en el mismo formulario.

- **Visibilidad**: la sección entera no se renderiza si no hay permiso de ver Bóveda (misma regla de permisos remota que las credenciales), de modo que un técnico sin permiso no descarga ni una fila.
- **Lista vacía**: "Sin datos protegidos. Aquí van el usuario, la contraseña o el PIN de este equipo, en vez de crearlos como un secreto aparte en la Bóveda."
- **Cada fila**: nombre y tipo siempre visibles (no son el secreto); al desplegar:
  - Si la Bóveda está desbloqueada: descifra y muestra el valor, con máscara/revelar para tipos ocultos y botón de copiar con auditoría de acceso.
  - Si está bloqueada: muestra un formulario de desbloqueo (contraseña maestra) inline, sin salir de la ficha.
  - Badge de vencimiento si la fecha de vencimiento está vencida o próxima.
  - Botones "Editar" y "Eliminar".
  - Sección "Usado en": procedimientos que referencian este campo (derivado del grafo), con aviso "Si se elimina este dato, esos pasos quedan sin él."
  - Historial propio del campo protegido, NO mezclado con el historial general del equipo (para respetar la regla de permisos de la Bóveda).

**Tipos de campo protegido**

| Tipo | Etiqueta | Oculto por defecto |
|---|---|---|
| `usuario` | Usuario | No |
| `contrasena` | Contraseña | Sí |
| `pin` | PIN | Sí |
| `llave` | Llave | Sí |
| `token` | Token | Sí |
| `texto` | Otro dato | Sí (también funciona como comodín para tipos desconocidos) |

**Tabla de campos — Editor de campo protegido (alta/edición)**

| Campo | Tipo | Obligatorio/Opcional | Comportamiento/validación |
|---|---|---|---|
| Nombre | `input text` | **Obligatorio** | Placeholder "Usuario administrador, PIN de impresión..."; se valida que no esté vacío y que no esté duplicado (comparación normalizada sin acentos ni mayúsculas) dentro del mismo equipo |
| Tipo | `select` | Obligatorio (con valor por defecto "Contraseña") | Opciones según la tabla de tipos anterior |
| Valor | Campo de contraseña con botón mostrar/ocultar + botón "Generar" (solo si el tipo es oculto por defecto) | Implícito | Al editar, se precarga descifrando el valor actual |
| Vencimiento | `input type="date"` | Opcional | Formato `AAAA-MM-DD` o vacío |
| Motivo del cambio (solo al editar) | `input text` | Opcional | Placeholder "Por qué se actualizó: rotación, incidente..." |

- Mensajes de error: "Escribe un nombre para el dato." (nombre vacío) / "Ya existe un dato con ese nombre en este equipo." (duplicado).
- Si la Bóveda se bloquea por inactividad mientras se escribe: "La bóveda se bloqueó por inactividad. Desbloquéala de nuevo para guardar."
- Botones "Guardar" / "Cancelar" (cierra el editor sin guardar).
- Si la Bóveda está bloqueada al abrir el editor de creación, se muestra solo el formulario de desbloqueo más el botón "Cancelar".
- El editor puede abrirse ya con un nombre precargado, cuando llega desde el parámetro `?nuevoCampoProtegido=` en la URL de la ficha (aviso anti-duplicidad).

**Eliminar campo protegido**
- Diálogo: título `¿Eliminar "{nombre}"?`, descripción "Se elimina este dato protegido del equipo para todo el equipo de trabajo.", con advertencia de impacto si hay procedimientos vinculados.
- Al confirmar: se registra auditoría de eliminación y se elimina el registro.

#### 3.6.6 Completitud e "¿Qué sigue?"

- El porcentaje de completitud de la ficha se calcula como el promedio de 7 señales (8 si la categoría es de red, sumando la IP): nombre, categoría, marca, modelo, serial, ubicación (entidad o texto libre), estado y foto. El resultado es solo una guía y nunca bloquea el guardado ni el uso normal de la ficha, mismo criterio aplicado en el formulario de artículos de la Base de Conocimiento.
- Los pasos sugeridos del bloque "¿Qué sigue?" generan hasta 4 opciones (foto, seguridad, conexiones, procedimiento), condicionadas por el permiso de ver Bóveda, y se usan únicamente en el bloque que aparece tras crear un equipo nuevo.

#### 3.6.7 Relaciones y reutilización de datos

- **Ubicaciones**: el formulario de equipo permite elegir una ubicación existente (con jerarquía y ruta completa) o crear una nueva sin salir del formulario; la ficha muestra la ubicación como enlace vivo a `/ubicaciones/{id}` cuando la entidad existe, o como texto plano (copia de referencia) cuando no.
- **Personas**: el mismo patrón de reutilización/creación inline aplica al campo Responsable; la ficha enlaza a `/personas/{id}` cuando el vínculo está vivo.
- **Bóveda**: la ficha del equipo aloja su propia sección de campos protegidos (usuario/contraseña/PIN/llave/token propios del equipo) y muestra también las credenciales generales de la Bóveda que dan acceso a él, ambas condicionadas al permiso de ver Bóveda; el flujo de "Guardar secreto" desde "Documentar este equipo" prellenar la Bóveda con el nombre y categoría del equipo.
- **Guías / Base de Conocimiento**: la ficha muestra procedimientos y problemas frecuentes vinculados directamente al equipo o a su categoría (con posible refinamiento por marca/modelo), y ofrece accesos directos para documentar un procedimiento o reportar una incidencia con el equipo ya asociado.
- **Diagnóstico**: la ficha ofrece iniciar un diagnóstico filtrado por la categoría del equipo, tanto desde la capa "Acción" como desde la acción dominante fija al pie.
- **Red**: los equipos de categorías `esRed` no aparecen en la lista de Equipos (viven en la sección Red) y su ficha cambia la navegación "Volver" y las etiquetas de contexto de "Equipos" a "Red".
- **Regla de "referencia viva"** (`referencia.ts`): todo vínculo entre entidades guarda el id del otro extremo más una copia de su texto (nombre/título). Si la fila vinculada existe localmente y no está eliminada, se muestra el dato vivo; si no, se cae a la copia de texto guardada. Se aplica en la ficha del equipo al nombre de ubicación y al nombre de responsable. Excepción deliberada: el vínculo "reemplaza a" NO tiene copia de referencia — si la fila vinculada no está disponible, esa fila de la ficha simplemente no se muestra (para no exponer un id crudo). Los registros inmutables (historial, ejecuciones de diagnóstico, accesos a Bóveda) no usan esta regla: guardan texto congelado a propósito, por ser "fotos del pasado".

#### 3.6.8 Flujo "Dar de baja" (`DarDeBajaPage`)

**Objetivo y modelo**: antes de esta pantalla, marcar "De baja" solo fijaba un color en el estado, y eliminar un equipo dejaba conexiones, credenciales y campos protegidos huérfanos. Esta pantalla obliga a resolver cada dependencia antes de fijar el estado a "De baja".

**Detección de dependencias** (`dependenciasDeBaja`, sin usar el grafo genérico, porque necesita la fila completa para poder editarla o eliminarla):
- Conexiones: donde el equipo es origen o destino, no eliminadas.
- Credenciales: cuyo array de dispositivos incluye el id del equipo.
- Campos protegidos: cuyo `dispositivoId` apunta al equipo, no eliminados.

**Pasos exactos**
1. Si el estado actual ya es "De baja" (comparación insensible a mayúsculas): banner "Este equipo ya está marcado como 'De baja'." (no impide continuar).
2. Se muestran hasta tres secciones (solo las que tengan elementos; las de credenciales y campos protegidos solo con permiso de Bóveda):
   - **Conexiones**: cada fila con su resumen y botón "Eliminar" (estilo peligro) — elimina la conexión directamente, sin opción de "conservar".
   - **Credenciales vinculadas**: cada fila con dos botones: "Desvincular de este equipo" (quita solo este equipo del array de dispositivos de la credencial, conservando el resto de vínculos, y audita la modificación) o "Eliminar credencial" (elimina la credencial completa y audita la eliminación).
   - **Campos protegidos**: cada fila con dos botones: "Conservar sin equipo" (pone el `dispositivoId` en `null`, el dato sigue existiendo pero ya no vinculado a ningún equipo, y audita la modificación) o "Eliminar" (elimina el campo y audita la eliminación).
3. Cuando ya no quedan dependencias pendientes, banner verde: "Sin dependencias pendientes. Ya se puede confirmar la baja."
4. Campo Motivo (opcional): `input text`, placeholder "Fin de vida útil, avería irreparable...".
5. Botón "Confirmar baja" (deshabilitado mientras haya dependencias sin resolver o mientras confirma): guarda el equipo con `estado: 'De baja'` junto con el motivo, y navega a la ficha del equipo. Si está deshabilitado, muestra el texto de ayuda "Resuelve las dependencias de arriba para habilitar este botón."
6. Cancelar: "Salir sin dar de baja" — vuelve a la ficha del equipo sin cambiar el estado; las dependencias ya resueltas (eliminaciones o desvinculaciones ya ejecutadas) SÍ quedan hechas, solo el cambio final a estado "De baja" no se aplica hasta confirmar.

#### 3.6.9 Flujo "Reemplazar equipo" (`ReemplazoPage`)

**Precondición y entrada**: se llega automáticamente después de guardar un alta con `?reemplazaA=<idViejo>` desde el formulario de equipo, o volviendo desde el banner de la ficha del equipo entrante si se salió sin migrar. Ruta: `/dispositivos/{idNuevo}/reemplazo`.

**Validaciones de guarda al entrar**:
- Si el equipo nuevo no existe, redirige a `/dispositivos`.
- Si el equipo nuevo no tiene un `reemplazaA` registrado, redirige a su propia ficha.
- Si el equipo viejo referenciado ya no existe, se muestra una pantalla informativa: "El equipo que este reemplaza ya no existe. No hay nada que migrar." (sin ninguna acción disponible).

**Comportamiento: migración "todo o nada"**. A diferencia de "Dar de baja" (resolución ítem por ítem), aquí la decisión de diseño fue migrar todo junto con un solo botón; no hay forma de excluir ítems puntuales.

- Reutiliza la misma detección de dependencias que "Dar de baja" para saber qué hay que mover.
- Si no hay ninguna dependencia: "'{viejo}' no tiene conexiones, credenciales ni campos protegidos que migrar." y el resumen indica: "Se dará de baja a **{viejo}** sin nada más que mover."
- Si hay dependencias, se listan por sección (Conexiones / Credenciales vinculadas [solo con permiso de Bóveda] / Campos protegidos [solo con permiso de Bóveda]) mostrando solo título y resumen, sin botones de acción individuales — todo se resuelve en conjunto.
- Resumen: "Se moverán **{N}** {dependencia/dependencias} a **{nuevo}** y se dará de baja a **{viejo}**."
- Campo Motivo (opcional): placeholder = "Reemplazado por {nuevo}"; si se deja vacío, ese mismo texto se usa como motivo real al guardar.
- Botón "Migrar todo y dar de baja" ejecuta la migración completa:
  1. Cada conexión: reasigna el extremo (origen o destino) que apuntaba al equipo viejo hacia el nuevo, copiando tanto el id como el nombre.
  2. Cada credencial: reemplaza al viejo por el nuevo dentro del array de dispositivos vinculados (conserva el resto de vínculos intactos); no toca los datos cifrados. Se audita como modificación.
  3. Cada campo protegido: reasigna el `dispositivoId` al nuevo equipo; no toca el valor cifrado (no requiere descifrar). Se audita como modificación.
  4. Finalmente guarda el equipo viejo con `estado: 'De baja'`.
  5. Navega a la ficha del equipo nuevo.
- Cancelar: "Salir sin migrar" — texto explícito: "Se puede volver más tarde: nada se pierde ni se toca hasta confirmar." (nada se ejecuta hasta pulsar el botón de migración; a diferencia de "Dar de baja", aquí no hay acciones parciales posibles porque no existen botones por ítem individual).

#### 3.6.10 Importación masiva (`ImportarDispositivosPage`)

**Flujo de 3 pasos**: `elegir` → `revisar` → `importando` → `terminado`, con indicador "Paso 1 de 3" / "Paso 2 de 3" / "Paso 3 de 3" / "Listo".

**Paso 1 — Elegir archivo**
- Zona de clic: "Elegir archivo .xlsx o .csv" (acepta extensiones `.csv`, `.xlsx`, `.xls`).
- Texto explicativo: "La primera fila debe traer los encabezados: Nombre, Categoría, Marca, Serial, Ubicación..."
- Caja "Cómo se interpreta el archivo": explica que existen sinónimos de encabezado (ejemplo: "No. de serie" cuenta como Serial, "Sede" como Ubicación), que cualquier otra columna se guarda como propiedad del equipo, y que las filas con serial o placa ya registrados se detectan automáticamente.
- Botón "Descargar plantilla CSV de ejemplo": genera un CSV con BOM UTF-8, separador `;`, columnas Nombre/Categoría/Marca/Modelo/Serial/Placa de inventario/Ubicación/IP/Estado/Observaciones y 2 filas de ejemplo.
- Si falla la lectura: "No se pudo leer '{nombre}'. Verificar que sea un archivo .xlsx o .csv válido."
- Lectura de `.xlsx`/`.xls` mediante SheetJS (toma la primera hoja no vacía, fechas ya formateadas como texto). Lectura de `.csv` intentando UTF-8 estricto primero y cayendo a Windows-1252 si falla (común en Excel en español), quitando el BOM.
- El parseo de CSV autodetecta el separador entre `;`, `,` y tabulador contando ocurrencias fuera de comillas en la línea de encabezados (en empate gana `;`; por defecto `,` si ninguno aparece), respeta comillas y comillas escapadas, tolera saltos de línea Windows, y descarta filas vacías al final.

**Paso 2 — Revisar / mapeo**
- Encabezados reconocidos por alias (normalizando acentos, mayúsculas y puntuación): Nombre, Categoría, Marca, Modelo, Serial, Placa de inventario, Ubicación, Responsable, IP, Estado, Observaciones. Por ejemplo, el campo Serial acepta como alias: serial, serie, numero de serie, no de serie, no serie, num serie, nro serie, n de serie, sn, s/n.
- Las columnas no reconocidas se guardan como propiedad del equipo (par clave/valor en "detalles"), usando el encabezado literal como clave.
- Si el mismo campo fijo aparece dos veces en el archivo (por ejemplo "Serial" y "No. de serie"), la primera columna gana ese campo; la segunda cae a propiedad libre.
- **Errores generales** (bloquean toda la importación): archivo vacío ("El archivo está vacío."); solo encabezados sin datos ("El archivo solo tiene la fila de encabezados, sin datos."); sin columna de Nombre reconocible ("No se encontró la columna del nombre. La primera fila debe tener encabezados, por ejemplo: Nombre, Categoría, Marca, Serial, Ubicación.").

**Tabla — validación y omisión por fila** (nunca se descarta en silencio, siempre se reporta el motivo)

| Condición | Resultado |
|---|---|
| Fila totalmente vacía | Se omite sin reportar (no cuenta como error) |
| Sin nombre | "No tiene nombre." |
| Categoría con texto que no coincide (normalizado) con ninguna existente | `La categoría "{texto}" no existe en la app.` |
| Sin columna/valor de categoría y sin categoría predeterminada elegida | "No tiene categoría." (se resuelve eligiendo una categoría predeterminada en la UI, aplicada a todas las filas sin categoría) |
| Serial ya existente en la base local | `Ya hay un dispositivo con el serial "{serial}".` |
| Serial repetido dentro del mismo archivo | `Serial repetido en el archivo (igual a la fila {N}).` |
| Placa ya existente en la base local | `Ya hay un dispositivo con la placa "{placa}".` |
| Placa repetida dentro del mismo archivo | `Placa repetida en el archivo (igual a la fila {N}).` |

- Los datos de cada fila importable se normalizan con `.trim()` implícito. El id de ubicación y el id de responsable quedan siempre `null` en la importación masiva: solo se trae el texto, nunca se vincula a la entidad (la vinculación posterior se hace por migración manual desde los módulos correspondientes). El campo "reemplaza a" siempre queda `null` — la importación nunca crea un equipo de reemplazo, esa acción solo existe desde el menú "···" de una ficha individual.
- **UI de revisión**: tarjeta con el nombre del archivo y botón "Cambiar" (vuelve al paso "elegir"). Si hay un error general, solo se muestra la caja de error roja. Si no, se muestra "Columnas detectadas" (ícono check para campo reconocido, ícono "+" para columna que se guardará como propiedad), un selector "Categoría para las filas que no traen una" si aplica, contadores en dos tarjetas ("{N} nuevos" en verde / "{N} se omiten" en ámbar), una lista colapsable de filas omitidas (hasta 30 filas con "Fila {N}: {motivo}", con "... y {N} filas más." si excede) y una vista previa de las primeras 6 filas importables (tag "Nuevo" + nombre + detalle categoría/ubicación/IP).

**Paso 3 — Importar**
- Barra inferior fija con "Cancelar" (vuelve al paso "elegir") e "Importar {N} equipos" (deshabilitado si no hay filas importables).
- Al confirmar: pasa a la fase "importando", guarda las filas una por una con motivo `"Importado desde {nombreArchivo}"` (queda registrado en el historial de cada equipo). Muestra barra de progreso "Importando {avance} de {total}..." con aviso "No cerrar la aplicación. Cada equipo queda con la nota del archivo de origen en su historial."
- Si una fila falla al guardar, se cuenta como fallida pero NO detiene el resto del proceso.

**Paso 4 — Terminado**
- "Importación completada": "{N} equipo(s) importado(s). {N si es mayor a 0} filas fallaron al guardarse. Los cambios se sincronizan solos con el resto del equipo."
- Botón "Ver equipos" → `/dispositivos`.
- Botón "Importar otro archivo" → vuelve al paso "elegir" en blanco.

#### 3.6.11 Generación de etiquetas QR (`EtiquetasPage`)

**Qué codifica el QR**: cada etiqueta codifica la URL completa de la ficha del dispositivo (`{origen}/dispositivos/{id}`), generada con la librería `qrcode` (nivel de corrección de errores M, margen 1, escala 6).

**Pantalla (no imprimible)**
- Cabecera: "Imprimiendo" / "Etiquetas QR"; salida "Salir sin imprimir" hacia `/dispositivos` (vuelta "Equipos"). Texto: "Imprimir y pegar en los equipos: al escanear se abre su ficha".
- Chips de categoría ("Todas" + cada categoría, INCLUYENDO las de red — aquí no se excluyen, a diferencia de la lista de Equipos).
- Resumen: "{N} de {N} seleccionadas" o "Ninguna etiqueta seleccionada".
- Botón "Seleccionar todas" / "Quitar todas" (alterna según si todas las visibles ya están marcadas).
- Grid de 2 columnas con tarjetas seleccionables: checkbox visual, miniatura real del QR (88x88), nombre, código (placa de inventario o serial, el que exista) y ubicación.
- Estado vacío: "No hay equipos en esta categoría."
- Barra inferior fija: "Formato: 3 por fila en hoja carta" más botón "Imprimir {N}" (deshabilitado si no hay ninguna marcada), que dispara la impresión del navegador.
- Por defecto TODOS los equipos visibles entran ya marcados (internamente se guarda el conjunto de las DESELECCIONADAS, no de las marcadas, de modo que un equipo nuevo o recién cargado aparece automáticamente seleccionado).

**Formato de impresión**
- Hoja oculta en pantalla, visible solo al imprimir, en 3 columnas, fondo blanco y texto negro.
- Cada etiqueta imprimible: QR de 112px, nombre en negrita, código (placa o serie) y ubicación, evitando que se corte entre páginas.
- Solo se imprimen las etiquetas marcadas, no todas las visibles.

---

### 3.7 Escanear (`/escaner`)

#### 3.7.1 Jerarquía y rutas

`EscanerPage` es una pantalla de nivel 3 (contenedor propio, cámara a pantalla completa). Se llega desde el ícono de cámara en la cabecera de la lista de Equipos. La salida usa la etiqueta "Salir del escáner", sin destino de salida explícito configurado: usa el comportamiento por defecto del componente compartido de barra de tarea, que retrocede en el historial de navegación.

Desde el resultado de un escaneo exitoso se puede navegar a `/dispositivos/{id}` (ficha del equipo identificado) SIN usar reemplazo de historial (`replace:true`) — decisión deliberada para que el escáner quede en el historial de navegación y el botón de regreso de la ficha diga "‹ Escáner", permitiendo inventariar varios equipos seguidos con solo 2 toques en vez de 4 (escanear, abrir ficha, volver, escanear siguiente).

Desde un resultado sin coincidencias también se puede navegar a `/dispositivos/nuevo` (con o sin el código precargado como serial, según el caso).

#### 3.7.2 Componentes e interfaz

**Detección de código**
- Usa `BarcodeDetector`, la API nativa del navegador, cuando está disponible (típicamente Android), con los formatos: `qr_code`, `code_128`, `code_39`, `ean_13`, `ean_8`, `upc_a`, `upc_e`, `itf`.
- Si no hay detector nativo (por ejemplo en iPhone), cae a la librería `jsQR` (cargada bajo demanda), que solo detecta códigos QR; en ese caso el cuadro de video se reduce a un máximo de 640px de ancho por rendimiento.
- El bucle de lectura corre cada 200 milisegundos mientras no haya un aviso de resultado en pantalla (se pausa mientras se muestra un resultado, para no volver a disparar el mismo código repetidamente).

**Búsqueda manual**
- Campo de texto siempre visible en la barra inferior mientras no haya un aviso de resultado activo: placeholder "O escribir la placa o el serial", con botón "Buscar" que ejecuta exactamente la misma función de resolución que el escaneo por cámara.

**Contador de sesión**
- Se guarda en `sessionStorage` (no en la base de datos local Dexie ni en el estado interno del componente): sobrevive a navegar a una ficha y volver, pero se pierde al cerrar la pestaña; no se sincroniza entre dispositivos ni entre técnicos.
- Se incrementa por código ÚNICO leído (repetir el mismo código no suma dos veces).
- Se muestra como un chip "{N} leído(s)" en la cabecera; tocarlo reinicia el conteo a 0.
- Todo el módulo está envuelto en try/catch: si `sessionStorage` no existe o falla (modo privado del navegador, cuota llena), el contador simplemente deja de funcionar, sin afectar el escaneo en sí.

**Linterna**
- Se ofrece solo si la pista de video expone la capacidad de linterna (`torch`) del dispositivo.
- Botón de alternancia que aplica la restricción correspondiente al stream de video; si falla, vuelve a marcarse como no disponible.

**Cierre / salida**
- Barra de tarea con etiqueta de salida "Salir del escáner", sin destino explícito (comportamiento por defecto del componente compartido).
- Al desmontar el componente, se detienen todas las pistas del stream de la cámara.

#### 3.7.3 Formularios y campos

Este módulo no tiene un formulario propio de captura de datos; su única entrada de texto es el campo de búsqueda manual descrito arriba (placa o serial, sin campos adicionales). El resultado de un código sin coincidencias puede derivar al formulario de alta de equipo (`DispositivoForm`, documentado en la sección 3.6.3), con el parámro `?serial=` precargado cuando corresponde.

#### 3.7.4 Relaciones y reutilización de datos

- **Equipos**: el escáner busca coincidencias directamente contra los campos `placaInventario` y `serial` de los equipos vivos (no eliminados) del inventario, y contra las URLs de etiqueta que apuntan a `/dispositivos/{id}`.
- Un resultado exitoso abre la ficha completa del equipo (`DispositivoPage`), reutilizando toda su información (estado, IP, ubicación) directamente en la tarjeta de resultado, sin necesidad de navegar.
- Un resultado sin coincidencias ofrece crear el equipo desde cero, reutilizando el código leído como valor inicial del campo Serial del formulario de alta (ver 3.6.3), salvo que el código sea una URL.

#### 3.7.5 Comportamientos y reglas de negocio

**Resolución del código leído (o escrito a mano)** — orden estricto de interpretación:
1. **URL de etiqueta**: si el texto es una URL válida (`http`/`https`) cuya ruta coincide con el patrón `/dispositivos/{id}` (y el id no es literalmente `nuevo` ni `etiquetas`, que son rutas hermanas dentro del mismo prefijo), y ese dispositivo existe y no está eliminado, el resultado es directo: `{tipo: 'dispositivo', dispositivoId}`. El origen o dominio de la URL se ignora deliberadamente, para que una etiqueta impresa en producción siga funcionando igual si el dominio cambia o se prueba en un entorno local.
2. **Placa de inventario**: si el texto no es una URL de etiqueta reconocible, se normaliza (recortando espacios y pasando a mayúsculas) y se busca coincidencia exacta contra la placa de inventario de equipos vivos. La placa tiene PRIORIDAD sobre el serial, porque se asume que es la etiqueta propia y única del equipo, mientras que un serial de fabricante podría coincidir por casualidad con la placa de otro equipo.
3. **Serial**: si no hay coincidencia por placa, se busca por serial normalizado.
4. Según el número de coincidencias encontradas:
   - 0 coincidencias → resultado "no encontrado".
   - 1 coincidencia → resultado "dispositivo" (va directo a la ficha).
   - 2 o más coincidencias → resultado "varios" (lista de candidatos).

**Comportamiento en pantalla según el resultado**
- **Encontrado**: tarjeta verde "Equipo identificado" con nombre, ubicación, estado (con punto de color) e IP mostrados directamente en la tarjeta (para evitar tener que abrir la ficha solo para consultar esos datos). Botones: "Abrir la ficha" (navega a la ficha sin reemplazar el historial, como se explicó en 3.7.1) y "Seguir" (cierra el aviso sin navegar, para seguir escaneando). Nota visible: "La ficha vuelve aquí al terminar".
- **Varios**: tarjeta "Varios equipos comparten este código" con una lista de tarjetas, una por cada equipo candidato (nombre + ubicación), cada una con enlace directo a su propia ficha. Botón "Seguir escaneando".
- **No encontrado**: tarjeta "Ningún equipo coincide con este código", mostrando el código leído en fuente monoespaciada. Botones: "Seguir escaneando" (o "Cerrar" si la cámara falló) y "Registrar equipo", que navega a `/dispositivos/nuevo?serial={código}` precargando el código como Serial, SALVO que el código leído sea en sí mismo una URL (`http`/`https`), en cuyo caso navega a `/dispositivos/nuevo` sin precargar nada, porque una URL de etiqueta rota no es un valor válido para el campo Serial.

**Estados de fallo de cámara**

| Estado | Causa | Mensaje mostrado |
|---|---|---|
| `sin_permiso` | Error de permiso denegado por el navegador | "La aplicación no tiene permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a entrar. Mientras tanto puedes buscar el equipo escribiendo su placa o serial." |
| `sin_camara` | No se encuentra cámara o las restricciones no se pueden satisfacer | "No se encontró una cámara en este equipo. Busca el equipo escribiendo su placa de inventario o el serial." |
| `no_soportado` | Cualquier otro error, o la API de cámara no existe en el navegador (también ocurre fuera de HTTPS) | "Este navegador no permite usar la cámara aquí. Busca el equipo escribiendo su placa de inventario o el serial." |

En cualquiera de estos tres casos, el campo de búsqueda manual (placa o serial) sigue disponible como alternativa funcional completa a la cámara.

**Caso límite documentado**: el ítem "Etiqueta QR" del menú "···" de la ficha de UN equipo específico no lleva directamente a la etiqueta de ESE equipo: navega a la pantalla general `/dispositivos/etiquetas`, donde hay que volver a localizarlo entre todos los equipos (o filtrar por categoría) y marcarlo manualmente para imprimir. Este comportamiento está descrito aquí en términos puramente funcionales, sin evaluar si es o no el comportamiento deseado.
### 3.8 Red (`/red`)

#### 3.8.1 Jerarquía y rutas

El módulo Red vive bajo `src/features/red/` y expone tres pantallas, todas registradas en `App.tsx` (líneas 447-474) con `lazy` + `Suspense`:

| Ruta | Componente | Nivel de chasis | A dónde va "Volver" |
|---|---|---|---|
| `/red` | `RedPage` | `seccion` (pestaña) | Raíz de pestaña, no tiene botón Volver propio |
| `/red/topologia` | `TopologiaPage` | `documento` | `/red` ("Red") |
| `/red/topologia/:dispositivoId` | `TopologiaEquipoPage` | `documento` | `/red/topologia` ("Topología") |
| `/dispositivos/:id` (cuando el equipo es de red) | `DispositivoPage` (compartida con Equipos) | `documento` | `/red` (no `/dispositivos`) |

La jerarquía de "Volver" se resuelve en `src/lib/navegacion.ts`, función `padreDe`, caso `'red'` (líneas 122-126):

```
case 'red':
  if (a === 'topologia' && b) return { to: '/red/topologia', etiqueta: 'Topología' }
  return { to: '/red', etiqueta: 'Red' }
```

Es decir: `/red/topologia/:id` sube a `/red/topologia`, y `/red/topologia` sube a `/red`. El propio código documenta el porqué (comentario líneas 122-124): "Jerarquía de los mockups Nocturne: la topología de un equipo (topologia/:id) sube al mapa general, y este a Red."

El caso `'dispositivos'` de `navegacion.ts` (líneas 96-106) aclara que la ficha de un equipo de red vuelve a Red en vez de a Equipos, pero que **esa decisión depende de datos en tiempo de ejecución (`categoria.esRed`) y la resuelve la propia pantalla con un override**, no `navegacion.ts`. Se confirma en `DispositivoPage.tsx` (líneas 234-237):

```js
const esRed = esDeRed(categoria)
const volverA = esRed ? '/red' : '/dispositivos'
```

Ese `volverA` se usa tanto para el botón Volver como para el destino de navegación tras eliminar el equipo (línea 241).

**Preservación del hilo de navegación.** Seguir un enlace desde `TopologiaEquipoPage` hacia la ficha de otro equipo (padre, hijo, o desde la sección Conexiones) no rompe el hilo de navegación: se le adjunta `state = conOrigen('/red/topologia/:id', 'Topología')` (línea 127, usado en las líneas 137, 177, 344 y 449 de `TopologiaEquipoPage.tsx`), de modo que el "Volver" de esa ficha regresa a la topología del equipo original en lugar de caer a la lista general de Red. Esta regla corrige un hallazgo histórico documentado en el propio código (línea 125, "hallazgo M-020"): *"Seguir una conexión rompía el hilo en cada salto: el equipo abierto desde aquí volvía a la LISTA de Red, no a esta topología."*

Mecánicamente, `Chasis.tsx` resuelve el botón "Volver" real: en modo `documento`, `volverA`/`volverEtiqueta` toman el `origen` de `location.state` si existe; si no, caen al cálculo por defecto de `padreDe` (líneas 295-297).

#### 3.8.2 Componentes e interfaz

**RedPage (`/red`) — listado.** Chasis de nivel `seccion`, título "Red". Contenido de la barra (`RedPage.tsx` líneas 86-129):

- Subtítulo: "Cómo está conectada la infraestructura" (línea 90).
- Botón **"Crear"** (`BTN_SECUNDARIO`, ícono `Plus`): enlaza a `/dispositivos/nuevo?red=1` (línea 92); el query param `red=1` prioriza las categorías `esRed` en el selector de categoría del alta de equipo (función `priorizarCategorias`, `categorias.ts` líneas 26-34).
- Buscador `<input type="search">`, placeholder "Equipo de red, IP, ubicación" (línea 113), filtra en vivo por nombre, ubicación, IP, marca, modelo o nombre de categoría (`incluyeTexto`, líneas 43-48). El borde cambia a `border-noct-accent` mientras hay texto (línea 101); aparece una `X` (`XCircleFill`) para borrar la búsqueda cuando hay texto (líneas 117-126).

Contenido principal:

1. Tarjeta destacada **"Topología de red"** (líneas 134-148), tintada en acento, ícono `TreeStructure`, texto "Recorrer las conexiones desde el rack hasta cada equipo" y flecha `CaretRight`; enlaza a `/red/topologia`.
2. **Listado agrupado por ubicación** (texto libre de `dispositivo.ubicacion`, orden alfabético natural; los equipos sin ubicación caen a un grupo final "Sin ubicación", líneas 53-76). Cada grupo muestra ícono `MapPin`, nombre de ubicación en mayúsculas y la cuenta ("N equipos" / "1 equipo", líneas 152-159). Cada fila usa el componente compartido `FilaDispositivo` con subtítulo `categoría · marca modelo` (líneas 161-173).
3. **Filtro de datos**: solo entran dispositivos no eliminados cuya `categoriaId` está en `idsRed` (categorías con `esRed = true`), líneas 33-34 y 42.
4. **Estado vacío**: ícono `TreeStructure` grande y dos mensajes distintos según si hay búsqueda activa ("Ningún equipo de red coincide" / "Aún no hay equipos de red registrados", líneas 178-196), con botón "Quitar búsqueda" solo cuando se está buscando.

**TopologiaPage (`/red/topologia`) — bosque general.** Chasis `documento`, título "Topología de red", subtítulo "Al expandir un equipo se ve todo lo que depende de él" (líneas 128-131). Acciones de cabecera pegajosa (solo si hay contenido):

- **"Expandir todo"** (líneas 116-118): `modoExpansion = 'todo'` y limpia el set de inversiones — todas las filas con hijos quedan abiertas.
- **"Contraer"** (líneas 119-121): `modoExpansion = 'nada'` y limpia inversiones — todas las filas se cierran.

**Buscador** (líneas 133-165, solo si hay contenido): `<input type="search">`, placeholder "Buscar un equipo en el mapa". Comportamiento al escribir:

- Recorre todos los árboles del bosque y marca como **coincidentes** (resaltados) los nodos cuyo `nombre` incluye el texto (insensible a mayúsculas, líneas 82-96).
- Marca como **a-abrir** a todos los ancestros de un nodo coincidente, forzando su expansión aunque estén cerrados por el toggle individual o por "Contraer" (línea 256: `idsAAbrir.has(nodo.dispositivoId)` interviene en el cálculo de `abierto`).
- Hace scroll suave (`scrollIntoView({behavior:'smooth', block:'center'})`) al primer nodo coincidente (líneas 101-105).
- Si no hay coincidencias: mensaje `Ningún equipo coincide con "{busqueda}".` (línea 177).
- Al vaciar el campo, el árbol vuelve a su apertura normal (se limpian `idsCoincidentes`/`idsAAbrir`).

**Leyenda de estado** (líneas 166-170): tres pastillas con punto de color más etiqueta: Operativo (verde, `text-noct-exito`), Mantenimiento (ámbar, `text-noct-precaucion`), Fuera de servicio (rojo, `text-noct-error`).

El bosque se construye con `construirBosque(dispositivos, conexiones, esCategoriaRed)` (ver §3.8.4).

**Anatomía de la fila de nodo (`NodoFila`, líneas 224-350)**, de fuera hacia adentro:

1. **Caret** (`CaretDown`/`CaretRight`) si tiene hijos; si no, un punto gris decorativo de 5px (líneas 278-292). El estado abierto/cerrado se calcula así: base según `modoExpansion` y nivel (`nivel < 2` en modo `'inicial'`), invertida si la clave de esta fila está en el set `invertidos` (toggle individual del usuario), y forzada a abierta si la búsqueda lo exige (línea 256).
2. **Ícono del tipo de equipo** (`IconoNodo`), en una placa cuadrada de 8×8.
3. **Nombre + detalle**, enlazado a `/dispositivos/:id` (línea 300). Si el nodo está `truncado` (ciclo detectado) se agrega un glifo `↺` con `title="Ya aparece más arriba"` (líneas 305-309). El detalle bajo el nombre es `detalleDeNodo({via, medio})` si el nodo tiene padre, o `marca modelo` si es raíz (líneas 263-265).
4. **Enlace de impacto "+N"** (líneas 314-322): solo se muestra si `contarDescendientes(nodo) >= 2`; enlaza a `/red/topologia/:dispositivoId` (topología centrada en ese equipo), con título "Ver la topología desde este equipo".
5. **Punto de estado** (7px), coloreado por `claseEstado(estado.etiqueta)`, con `title` igual a la etiqueta de estado.

La fila resaltada por búsqueda recibe fondo `bg-noct-accent/[.12]` (líneas 273-275). Indentación: `4 + nivel*20` px (línea 276).

Pie de página fijo: "Tocar un equipo abre su ficha. El número junto al estado indica cuántos equipos quedarían sin servicio si falla." (líneas 215-218).

Estado vacío (sin contenido en absoluto): ícono grande + "Aún no hay conexiones registradas" / "Agregarlas desde la ficha de cada equipo, en la sección Conexiones." (líneas 182-190).

**Representación visual del árbol — íconos por tipo de equipo.** `tipoDeNodoVisual(nombreCategoria)` (`topologiaVisual.ts` líneas 35-57) deriva el tipo visual **del texto libre del nombre de categoría** (normalizado sin acentos/mayúsculas mediante `normalizar`, líneas 27-33), aplicando reglas de coincidencia en este orden de prioridad:

1. `rack` → ícono rack
2. `ups` / `regulador` → ícono UPS
3. `switch` → ícono switch
4. `camara` / `cctv` → ícono cámara
5. `impresora` → ícono impresora
6. `servidor` → ícono servidor
7. `access point` / `\bap\b` / `inalambric` / `wifi` → ícono AP
8. `\bpos\b` / `venta` / `caja` → ícono POS (evaluado **antes** que "punto" a propósito — comentario línea 46: para que "Punto(s) de venta" caiga en POS y "Puntos de red" caiga en el ícono de punto)
9. `punto` → ícono punto de red
10. `computador` / `\bpc\b` / `portatil` / `laptop` → ícono PC
11. `router` / `modem` / `fibra` / `\bred(es)?\b` → ícono router
12. Cualquier otro texto → `'generico'` (ícono caja con dos puntos, `IconoNodo.tsx` líneas 104-110, caso `default`)

Los 12 SVG de `IconoNodo.tsx` (trazo 1.8, estilo Lucide, `viewBox 0 0 24 24`) son: `router`, `switch`, `ap`, `ups`, `punto`, `pc`, `impresora`, `pos`, `rack`, `camara`, `servidor`, `generico`. El comentario del archivo (líneas 6-8) documenta que los 7 primeros más "ups" vienen de los mockups originales de diseño (`Topologia.dc.html`, `Red.dc.html`), y que `rack`, `camara`, `servidor` y `generico` se agregaron después porque las categorías reales del esquema los necesitaban.

**Color de estado** (`claseEstado`/`estadoConEtiqueta`, `topologiaVisual.ts` líneas 65-96), lista canónica única (`ESTADOS_CONOCIDOS`, líneas 65-70) compartida con `features/dispositivos/estados.ts`:

| Etiqueta | Clase de color |
|---|---|
| Operativo | `text-noct-exito` (verde) |
| En mantenimiento | `text-noct-precaucion` (ámbar) |
| Fuera de servicio | `text-noct-error` (rojo) |
| De baja | `text-noct-neutral-500` (gris) |
| Cualquier otro texto / vacío | Se conserva el texto tal cual (o "Sin estado" si está vacío), color `text-noct-neutral-500` |

`estado.estado` sigue siendo texto libre (campo `Dispositivo.estado`); la comparación es insensible a mayúsculas/acentos. El punto de color de 7px se dibuja con `bg-current` sobre esa clase de texto.

**No hay canvas gráfico ni SVG de líneas.** La "topología" se representa íntegramente como **árbol textual indentado** (lista jerárquica con 20px de indentación por nivel), nunca como un diagrama de nodos y aristas dibujado. La "arista" hacia el padre se representa como texto bajo el nombre del nodo: `detalleDeNodo({categoria, marcaModelo, via, medio})` (`topologiaVisual.ts` líneas 102-112) compone `categoría · marca modelo · via · medio`, uniendo con `·` y omitiendo el medio si es igual (normalizado) al `via`, para no repetir por ejemplo "UTP · UTP" cuando el enlace no tiene puerto y usa el medio como vía.

**Ícono de vía** (`iconoDeVia`, `medios.ts` líneas 8-17), usado en el bloque "Depende de" de la ficha de dispositivo:

- `instalacion` → 🗄
- medio contiene "fibra" → 🟣
- medio contiene "inalámbric"/"inalambric"/"wifi"/"wi-fi" → 📶
- medio contiene "utp"/"cable"/"ethernet" → 🔌
- cualquier otro texto → 🔗 (genérico, comentario línea 7: "sin romper nada")

**Interacción sobre un nodo:**

- **Caret** (si tiene hijos): expande/contrae SOLO esa fila (toggle individual, no navega).
- **Cuerpo del nodo (nombre)**: navega a `/dispositivos/:id`, la ficha completa del equipo.
- **"+N"** (si `contarDescendientes >= 2`): navega a `/red/topologia/:dispositivoId`, la topología centrada en ese equipo.
- El punto de estado no es interactivo (solo tiene `title` con la etiqueta).

**TopologiaEquipoPage (`/red/topologia/:dispositivoId`).** Pantalla "rica" centrada en un solo equipo (comentario líneas 18-34): responde de un vistazo "¿de qué depende?", "¿qué se cae si falla?", "¿qué depende de él?", y trae el editor de conexiones embebido. Reutiliza la misma lógica que la ficha y el mapa general (`arbol.ts`, `conexiones.ts`, `repositorio.ts`).

Estructura de la barra (cabecera pegajosa, líneas 142-165):

- Ícono `TreeStructure` en placa de acento.
- `h1` con el nombre del equipo.
- Estado con punto de color + etiqueta.
- IP (si existe), con clase `VALOR_TECNICO_COMPACTO`.
- Acción de cabecera **"Abrir la ficha"** (`BTN_GHOST`, ícono `Monitor`), a `/dispositivos/:id` con `state = origenTopologia` para preservar el hilo de "Volver".

Estados de carga/no encontrado (líneas 104-120): mientras `dispositivos`/`conexiones` no cargaron, chasis vacío; si el `dispositivoId` no corresponde a ningún equipo, mensaje "No se encontró el equipo" + botón "Volver a la topología".

Secciones del cuerpo (todas condicionales, solo aparecen si hay datos):

1. **"Depende de"** (líneas 169-190): lista de padres directos, de dónde viene "Instalado en" (`grupos.instaladoEn`) y los enlaces que este equipo **recibe** (`grupos.enlaces` filtrando fuera los que tienen `esOrigen === true`; comentario línea 80: "los que este equipo SIRVE son hijos, no padres"). Cada fila usa la flecha-codo `FlechaCodoArriba` (SVG local, líneas 479-486) más nombre, `via` y `CaretRight`, navegable a la ficha con `state=origenTopologia`.
2. **"Si este equipo falla"** (líneas 194-222): tarjeta de precaución con el total de dependientes en negrita y chips por categoría (ícono `IconoNodo` + "N categoría"), usando `contarImpacto`/`contarDescendientes` sobre `construirArbol(dispositivoId, ...)` con este equipo como raíz.
3. **"Dependen de este equipo"** (líneas 225-235, solo si `arbol.hijos.length > 0`): árbol expandible (`ArbolDependientes`/`FilaArbol`, líneas 256-375) con el mismo patrón visual que `TopologiaPage`, pero **todas las ramas arrancan ABIERTAS** (comentario línea 253: "el técnico contrae lo que no necesita"), sin buscador ni controles de expandir/contraer global, y sin el enlace "+N" (no aplica: ya se está en la topología de este equipo).
4. **"Conexiones"** (`ConexionesSeccion`, líneas 377-473): lista agrupada en las 4 categorías (Instalado en, Contiene, Enlaces, Relacionados — las mismas que en la ficha), cada fila con botón de quitar (`X`), y botón **"Agregar"** (`BTN_GHOST`, ícono `Plus`) que abre/cierra `FormularioConexion` con `variante="topologia"`.

**ConexionesFicha — sección "Conexiones" de la ficha de dispositivo.** Compartida por `DispositivoPage` para cualquier equipo, sea de red o no:

- Consulta las conexiones donde el dispositivo es origen O destino (`.where('origenId').equals(...).or('destinoId').equals(...)`, líneas 29-39).
- Los nombres del otro extremo son "vivos": si el otro dispositivo existe localmente se usa su nombre actual (`nombrePorId` vía `mapaDeTextos`); si no (no sincronizó o fue eliminado), se usa la copia de referencia `otroNombre` guardada en la conexión (comentario líneas 41-46).
- Agrupa con `agruparConexiones` en 4 grupos con rótulo (`GrupoConexiones`): **"Instalado en"**, **"Contiene"**, **"Enlaces"**, **"Relacionados"** — solo se muestra el grupo si tiene elementos (líneas 82-112).
- Cada fila (`FilaConexion`, líneas 140-177): nombre del otro equipo (enlace a `/dispositivos/:otroId`), detalle = `Puerto X · → puerto Y · medio` (los campos que apliquen, unidos con `·`) o las `notas` si no hay detalle de puerto/medio, y un botón `X` "Quitar conexión" que llama `eliminarRegistro('conexiones', conexion.id)` (soft delete, sin confirmación adicional: un solo tap la borra).
- Botón **"Ver en topología"** (arriba, alineado a la derecha si `sinCabecera`): navega a `/red/topologia/:dispositivoId`.
- Estado vacío: "Sin conexiones registradas" (borde punteado) si no hay conexiones y no se está agregando.
- Botón **"Agregar conexión"** (`BTN_GHOST_ACENTO`, ícono `Plus`) abre `FormularioConexion` con `variante="ficha"`.

**Agrupación de conexiones (`agruparConexiones`, `conexiones.ts` líneas 112-137)**, función pura compartida por `ConexionesFicha` y `TopologiaEquipoPage`, vista desde un `dispositivoId`:

- `instaladoEn`: conexiones `instalacion` donde el dispositivo consultado es el **origen** (está instalado dentro del destino).
- `contiene`: conexiones `instalacion` donde el dispositivo consultado es el **destino** (es el rack que contiene al origen).
- `enlaces`: todas las conexiones `enlace` que tocan al dispositivo (en cualquier sentido), ordenadas por puerto local (orden natural) y luego por nombre del otro.
- `relacionados`: conexiones `relacionado`, ordenadas por nombre del otro.

`desdeExtremo` (líneas 87-97) resuelve, para el dispositivo consultado, cuál es "el otro" (`otroId`, `otroNombre`) y cuál es el puerto "local" vs. "remoto" según si el dispositivo es origen o destino de la conexión.

`resumenConexion(conexion)` (líneas 58-73) genera el texto corto usado en historial/confirmaciones:

- `instalacion`: `"{origen} instalado en {destino}"`.
- `relacionado`: `"{origen} relacionado con {destino}"`.
- `enlace`: `"{origen} (puerto {origenPuerto}) → {destino} (puerto {destinoPuerto})"` (el fragmento `(puerto ...)` se omite si el puerto está vacío, función `conPuerto`, líneas 54-56).

#### 3.8.3 Formularios y campos

`FormularioConexion.tsx` es un componente **único y compartido** entre `ConexionesFicha` (`variante="ficha"`) y `TopologiaEquipoPage` (`variante="topologia"`). El comentario del archivo (líneas 39-47) documenta explícitamente que antes existían dos implementaciones casi idénticas ya divergidas (hallazgo D1 de AUDITORIA_FLUJOS_TI.md: "el medio por defecto arrancaba vacío en una y en UTP en la otra"); ahora el estado y la lógica de guardado son ÚNICOS y `variante` solo cambia el "chrome" visual: select vs. chips para el tipo, datalist vs. chips para el medio, encabezado propio vs. footer con Cancelar aparte.

**Punto crítico de modelo de datos — `ModoConexion` (5 valores en la interfaz) frente a `TipoConexion` (3 valores persistidos).** El formulario ofrece más matices que el modelo de datos porque expresa el **sentido** (quién es origen/padre) además del tipo. `ModoConexion` está definido en `conexiones.ts` línea 20. El comentario clave de ese archivo (líneas 14-19) explica el porqué del quinto valor: *"'enlace' y 'recibeDe' son el mismo `TipoConexion` ('enlace') en sentido opuesto (hallazgo N1): antes solo existía 'enlace' con esta ficha siempre como origen/padre, así que documentar 'el switch me da servicio' desde la ficha del punto de red invertía la topología."*

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| **Tipo de relación** (`ModoConexion`) | `<select>` nativo en `variante="ficha"`; fila de chips con `aria-pressed` en `variante="topologia"` (con párrafo de ayuda contextual bajo los chips, solo en topología) | Obligatorio (siempre tiene un valor; no hay opción vacía) | `'enlace'` (`useState<ModoConexion>('enlace')`, línea 69) | 5 opciones, ver tabla de mapeo `ModoConexion → TipoConexion` más abajo. Al cambiar de modo: si es `enlace`/`recibeDe` se muestran los campos de puerto/medio (`esEnlace`); si es `relacionado`, aparece un aviso fijo: "Relaciona dos equipos que no son de red (por ejemplo un POS con su impresora). Aparece en la ficha de ambos, sin puertos ni medio, y no entra en la topología." |
| **Buscar el otro equipo** | `<input type="search">` | Implícito (no se puede guardar sin `otro` elegido) | `''` | Filtra dispositivos por nombre/ubicación/IP (`incluyeTexto`). Placeholder "Buscar el otro equipo por nombre, ubicación o IP..." (ficha) / mismo texto sin puntos suspensivos (topología). Sin texto, pre-sugiere candidatos con puntaje > 0 (mismo `ubicacionId` = +2, categoría `esRed` = +1); si ninguno puntúa, no sugiere nada. Con texto, filtra por subcadena y reordena por puntaje. Límite de 8 resultados; el propio dispositivo queda excluido de los candidatos. Al elegir un candidato, en `topologia` se limpia también el campo de búsqueda; en `ficha` no |
| **Chip del otro equipo elegido** | Bloque de solo lectura + botón "Cambiar" | — (aparece cuando `otro !== null`) | — | Muestra nombre (más ubicación en `ficha`, o ícono `Monitor` en `topologia`); "Cambiar" limpia `otro` y la búsqueda, volviendo al estado de selección |
| **Banda "Copiar ubicación"** | Aviso + botón | Opcional, aparece solo si el equipo actual no tiene ubicación y el otro extremo sí | — | Botón "Copiar ubicación" (texto cambia a "Copiando..." mientras procesa) hace `guardarRegistro('dispositivos', {...dispositivo, ...sugerenciaUbicacion})`; nunca sobrescribe una ubicación ya cargada |
| **Crear equipo nuevo** (solo `variante="ficha"`; NO existe en `variante="topologia"`, decisión deliberada según comentario del código) | Botón `BTN_GHOST_ACENTO` que abre mini-formulario inline | — | Precarga el nombre con lo tecleado en la búsqueda | Abre subformulario con los 2 campos de la fila siguiente |
| — Nombre del equipo nuevo | Texto, autofocus | Sí | `''` (o precargado desde la búsqueda) | Botón "Crear y usar" deshabilitado si `nombre.trim() === ''` |
| — Categoría del equipo nuevo | `<select>` con opción vacía "Elige una categoría..." | Sí | `''` | Deshabilitado si `categoriaEquipoNuevo === ''`; `categoria_id` es `NOT NULL` en el esquema. Al crear: `nuevoId()` + `guardarRegistro('dispositivos', {...})` con todos los campos por defecto vacíos salvo `nombre`, `categoriaId` y `estado: 'Operativo'`; luego relee de la base (`db.dispositivos.get(id)`) para obtener `updatedAt`/`updatedBy` reales; el resultado pasa a ser el `otro` elegido |
| **Puerto en {este equipo}** ("Puerto aquí") — solo si `esEnlace` (modo `enlace` o `recibeDe`) | Texto libre | No (opcional aunque el modo sea enlace) | `proximoPuertoLibre(enlaces)`: siguiente puerto numérico libre entre los ya registrados, empezando en 1 | Sin validación de formato; se guarda con `.trim()`. Placeholder "Ej. 18" (ficha) / "3" (topología) |
| **Puerto en el otro** — solo si `esEnlace` | Texto libre | No | `''` | Sin validación. Placeholder "Opcional" |
| **Medio** — solo si `esEnlace` | Texto libre con `<datalist>` (ficha) o chips seleccionables con `aria-pressed` (topología) | No | `MEDIOS_SUGERIDOS[0]` = `'UTP'` | Sin validación, texto libre. Opciones sugeridas: `UTP`, `Fibra óptica`, `Inalámbrico`. Al guardar, el medio solo se persiste si `conPuertos` es `true`; de lo contrario se guarda `medio: ''` |
| **Notas** — solo `variante="ficha"` (no existe en absoluto en `variante="topologia"`) | Texto libre | No | `''` | Se recorta al guardar; en `topologia` queda siempre `''` |

**Mapeo `ModoConexion` (interfaz, 5 valores) → `TipoConexion` (persistido, 3 valores):**

| Valor (`ModoConexion`) | Etiqueta visible | Ayuda (solo `variante="topologia"`) | `TipoConexion` guardado | `origenEsteDispositivo` | `conPuertos` |
|---|---|---|---|---|---|
| `enlace` | "Da servicio a" | "Este equipo da servicio al otro por un puerto (uplink). Entra en la topología." | `enlace` | `true` (este equipo es origen/padre) | `true` |
| `recibeDe` | "Recibe de" | "El otro equipo te da servicio por un puerto (uplink). Entra en la topología." | `enlace` | `false` (el otro es origen/padre) | `true` |
| `instalado` | "Instalado en" | "Este equipo está montado dentro del otro (un rack)." | `instalacion` | `true` | `false` |
| `contiene` | "Contiene" | "El otro equipo está montado dentro de este." | `instalacion` | `false` (el otro es origen: este equipo, el rack, es el destino/padre) | `false` |
| `relacionado` | "Relacionado" | "Vincula equipos que no son de red (un POS con su impresora). No entra en la topología." | `relacionado` | `true` | `false` |

Como se ve, `enlace` y `recibeDe` son la MISMA `TipoConexion` ("enlace") pero con el sentido origen/destino invertido; lo mismo ocurre entre `instalado` y `contiene` para `instalacion`. El modelo persistido no distingue el sentido por separado: el sentido queda fijado en qué extremo se guardó como `origenId` y cuál como `destinoId`.

**Guardado (`guardar`, líneas 123-163):**

1. Si no hay `otro` elegido o ya está guardando, la función no hace nada (guard, línea 124).
2. `datosSegunModo(modo)` da `{tipo, origenEsteDispositivo, conPuertos}`.
3. `origen`/`destino` = `dispositivo`/`otro` según `origenEsteDispositivo`.
4. Los campos del formulario son siempre "puerto en ESTE equipo" y "puerto en el OTRO"; según el sentido, eso mapea a `origenPuerto` o `destinoPuerto` (comentario líneas 130-132).
5. Se inserta en `conexiones` vía `guardarRegistro`: `id: nuevoId()`, `tipo`, `origenId`, `origenNombre` (copia de referencia = `origen.nombre` en el momento de guardar), `origenPuerto` (recortado, o `''` si `!conPuertos`), `destinoId`, `destinoNombre`, `destinoPuerto`, `medio` (recortado, o `''`), `notas` (recortada; el estado de notas solo lo deja editar la UI de `variante="ficha"`; en `topologia` queda `''`).
6. No hay validación adicional: no valida formato de IP, no valida que el puerto no esté duplicado, no valida longitud de notas. Solo el guard de "debe haber un `otro`" y el `disabled` de los botones.

**Botones:**

| Botón | Variante | Comportamiento |
|---|---|---|
| **Guardar conexión** | ambas | `guardar(true)`: guarda y llama `onCerrar()` de inmediato. Deshabilitado si `!otro \|\| guardando`. Texto "Guardando..." mientras procesa |
| **Guardar y agregar otra** | solo `ficha` | `guardar(false)`: guarda SIN cerrar. Conserva el `modo` elegido (sirve para dar de alta varias conexiones del mismo tipo seguidas, ej. 20 uplinks de un switch). Limpia `otro` y `busqueda`, recalcula `puertoLocal` sumando a mano el puerto recién usado a la lista de `enlaces` (porque el prop `enlaces` aún no incluye la conexión recién guardada), limpia `puertoRemoto`, resetea `medio` a `MEDIOS_SUGERIDOS[0]`, limpia `notas` |
| **Cancelar** | ambas, mecánica distinta | En `ficha`: texto discreto en el encabezado del formulario, junto al título "Nueva conexión". En `topologia`: botón `BTN_GHOST` en el footer, junto a "Guardar conexión". En ambos casos llama `onCerrar()` sin guardar nada |
| **×** | No existe | No hay botón "×" explícito dentro de `FormularioConexion`; el cierre siempre es por el texto/botón "Cancelar" |
| **Escape** | No se maneja | No hay `onKeyDown`/listener de teclado en el componente |

**Por qué `FormularioConexion` no es un modal:** el componente no usa `Modal.tsx`; es un bloque inline dentro de la página o de la ficha (footer con Cancelar aparte en la variante topología, encabezado propio con Cancelar textual en la variante ficha). Al no ser un `<dialog>` ni envolverse en `Modal`, ni la tecla Escape ni un botón "×" lo cierran: la única salida es el botón/texto "Cancelar" o completar el guardado.

**Nota de integridad:** el formulario no impide guardar dos veces la "misma" conexión (mismo par de equipos y puertos) ni valida ciclos al momento de crear; el ciclo solo se detecta y trunca visualmente al construir el árbol (`arbol.ts`, líneas 131-133), nunca al guardar.

#### 3.8.4 Relaciones y reutilización de datos

Red **no tiene tabla propia de topología**: todo lo que se ve en `/red`, `/red/topologia` y `/red/topologia/:id` se deriva en memoria, en el momento de la consulta, a partir de dos tablas ya existentes:

- **`dispositivos`**: de aquí sale el listado de equipos, sus categorías, estados, IP, ubicación, marca y modelo.
- **`conexiones`**: de aquí sale toda relación entre equipos (`tipo`, `origenId`, `destinoId`, puertos, medio, notas).

El vínculo con Equipos pasa por `Categoria.esRed: boolean` (implícito en `esDeRed`, `categorias.ts` líneas 15-17: `Boolean(categoria?.esRed)`):

- `idsDeRed(categorias)` (líneas 22-24) da el `Set` de ids de categoría marcadas `esRed`. Es, según el comentario del código (línea 20), "el uso más repetido de la regla": **Dispositivos excluye** esos ids en la sección Equipos, y **Red y Topología se quedan solo con ellos** (más los dispositivos que participan de una conexión aunque su categoría no sea de red, ver más abajo).
- `priorizarCategorias(categorias, priorizarRed)` (líneas 26-34): con `priorizarRed=true` ordena las categorías `esRed` primero (orden estable dentro de cada grupo); se usa cuando se llega al alta de equipo desde `/dispositivos/nuevo?red=1` (el botón "Crear" de `RedPage`).
- La ficha de dispositivo (`DispositivoPage.tsx`) es el MISMO componente para equipos de red y equipos normales; lo único que cambia según `esDeRed(categoria)` es el destino de "Volver"/eliminar (`/red` vs. `/dispositivos`) y que solo los equipos de red entran al árbol de topología "por derecho propio" — un equipo no-red puede aun así aparecer en el árbol si tiene una conexión `enlace`/`instalacion` (ver regla de `idsRelevantes` abajo).

**Construcción del árbol/bosque (`arbol.ts`)**, módulo puro sin React, pensado para responder "¿qué depende de este equipo?":

- **Regla padre → hijo** (comentario líneas 6-13):
  - `instalacion`: el **destino** (por ejemplo un rack) es el **padre** del **origen** (el equipo instalado dentro).
  - `enlace`: el **origen** (switch, router — el que da servicio) es el **padre** del **destino** (el que recibe el servicio).
  - `relacionado`: nunca aparece en el árbol (ver §3.8.5).
- `hijosDirectos(nodoId, conexiones)` (líneas 55-83): si es `instalacion` y `destinoId === nodoId`, el hijo es `origenId` con `via = 'Instalado'`; si es `enlace` y `origenId === nodoId`, el hijo es `destinoId` con `via = "Puerto {origenPuerto}"` si hay puerto, o `conexion.medio || 'Enlace'` si no.
- `padreDirecto(nodoId, conexiones)` (líneas 88-115) es el simétrico inverso, usado para subir por el árbol ("¿de qué depende este equipo?", base de `caminoAscendente`).
- `construirNodo` (líneas 117-143) arma recursivamente el `NodoTopologia` (interfaz líneas 25-44: `dispositivoId`, `nombre`, `estado`, `categoriaId`, `via`, `tipoConexion`, `medio`, `hijos[]`, `truncado`). Los hijos de cada nivel se ordenan por `orden` (puerto o nombre, natural) y luego por nombre.
- `construirArbol(raizId, ...)` (líneas 145-151) es el punto de entrada para un único equipo como raíz, usado por `TopologiaEquipoPage` y `useImpactoEquipo`.
- `construirBosque(dispositivos, conexiones, esCategoriaRed)` (líneas 190-202) construye TODOS los árboles del mapa general:
  - **Nodos relevantes** (`idsRelevantes`, líneas 171-188): entran los dispositivos no eliminados cuya categoría es de red (`esCategoriaRed`), MÁS cualquier dispositivo que participe como origen o destino de una conexión de tipo `enlace` o `instalacion` (no `relacionado` — línea 183: `if (conexion.eliminadoEn || conexion.tipo === 'relacionado') continue`). Esto permite que un PC o una impresora "cuelguen" del árbol si tienen un enlace de red, aunque su categoría no sea `esRed`.
  - **Raíces del bosque** (`tienenPadre`, líneas 156-164, filtro línea 198): un nodo es raíz si no tiene padre, es decir, no aparece como `origenId` de una `instalacion` ni como `destinoId` de un `enlace`. Comentario línea 155: "normalmente los racks y los switches de núcleo". Los árboles resultantes se ordenan por nombre.

**Impacto y dependencias, derivados del árbol ya construido:**

- `contarImpacto(nodo)` (líneas 220-230): recorre el árbol ya construido (no relee conexiones) y cuenta los descendientes agrupados por `categoriaId`. Un nodo truncado por ciclo se cuenta una sola vez.
- `contarDescendientes(nodo)` (líneas 236-240): total de descendientes (suma sin agrupar), misma lógica de no duplicar ciclos.
- `caminoAscendente(dispositivoId, conexiones, infoPorId)` (líneas 255-277): sube por `padreDirecto` hasta llegar a la raíz o toparse con un ciclo (protegido con un set de `visitados` y un máximo de 100 iteraciones). Devuelve la cadena `PasoAscendente[]` (padre inmediato primero, raíz al final); es la base de la sección "Depende de".

"Impacto" en el dominio significa: si el dispositivo raíz falla, todos sus descendientes en el árbol (los que reciben servicio por enlace, o están instalados dentro de él) quedan "sin servicio". Es un cálculo puramente derivado de las conexiones vivas (`enlace`/`instalacion`), sin ningún campo de estado "afecta a" almacenado en base.

**Reutilización en la ficha de dispositivo (`useImpactoEquipo`/`ImpactoYDependencias`).** `useImpactoEquipo(dispositivoId)` es el hook que reutiliza `arbol.ts` para no duplicar la lógica entre la ficha de dispositivo y el mapa de topología (comentario del archivo). Devuelve `impacto` (`Map<categoriaId, cantidad>` = `contarImpacto(construirArbol(...))`), `camino` (`caminoAscendente(...)`), `nombreCategoria` (mapa id→nombre) y `totalEquipos` (suma de todos los valores de `impacto`). `ImpactoYDependencias.tsx` (sección "Si este equipo falla" de la ficha) no renderiza nada si `impacto.size === 0 && camino.length === 0`, y muestra dos bloques cuando hay datos: "También quedarían sin servicio" (tarjeta de precaución, lista `• {cantidad} {nombreCategoria}` ordenada de mayor a menor) y "Depende de" (tarjeta neutra, lista de pasos con ícono de vía, texto del `via`, flecha y nombre del padre enlazado). `TopologiaEquipoPage` reimplementa una versión más rica del mismo dato reutilizando `arbol.ts` directamente, en vez del componente `ImpactoYDependencias`.

**El grafo genérico de referencias (`lib/grafo.ts`) es independiente del árbol de topología.** Modela cualquier vínculo del sistema (procedimientos, credenciales, campos protegidos, diagnósticos, reemplazos, conexiones) como aristas dirigidas "origen referencia a destino", derivadas en memoria y nunca persistidas como columna inversa (comentario: "un grafo derivado no puede estar desactualizado"). Para conexiones, `construirGrafo` (líneas 212-233) agrega DOS aristas por conexión (una por cada extremo, bidireccional a efectos de impacto), relación `'conexion'`, e incluye TODAS las conexiones no eliminadas, **incluidas las `relacionado`** (a diferencia de `arbol.ts`, aquí no hay filtro de tipo). Este grafo alimenta el componente genérico `ReferenciadoPor` (que la ficha de dispositivo no usa para sus conexiones, ya que usa la más rica `ConexionesFicha`) y `resumenImpacto`, el aviso que se muestra antes de eliminar un dispositivo (ver §3.8.5).

**Nombres "vivos".** Toda la UI de Red/Topología resuelve el nombre del otro extremo contra la tabla `dispositivos` en vivo cuando el dispositivo existe (`nombreVivo`), cayendo a la copia de referencia (`origenNombre`/`destinoNombre`) guardada en la propia conexión solo si el dispositivo no existe localmente (no sincronizado o eliminado). Renombrar un equipo se refleja automáticamente en todas sus conexiones sin reescribir ninguna fila de `conexiones`.

#### 3.8.5 Comportamientos y reglas de negocio

1. **Por qué `relacionado` no aparece en la topología (doble filtro).** (a) `idsRelevantes` en `arbol.ts` descarta las conexiones `relacionado` al decidir qué dispositivos entran al bosque; (b) `hijosDirectos`/`padreDirecto` en `arbol.ts` solo procesan `conexion.tipo === 'instalacion'` o `'enlace'` — una conexión `relacionado` nunca genera una relación padre-hijo. Semánticamente, `relacionado` vincula dos equipos que no son de red (por ejemplo un POS con su impresora) sin que uno "dependa" de la disponibilidad del otro como servicio de red. Sí aparece en ambas fichas (`ConexionesFicha`, `TopologiaEquipoPage`) como grupo "Relacionados", y sí genera una arista bidireccional en el grafo de referencias genérico (`grafo.ts`, relación `'conexion'`) — es decir, cuenta para el aviso de impacto al eliminar un dispositivo (punto 3 más abajo), pero no para la topología de servicio.

2. **Eliminar una conexión.** `eliminarRegistro('conexiones', id)` es un soft delete: pone `eliminadoEn` con la fecha actual, registra historial y encola el cambio para sincronizar. No hay diálogo de confirmación: un solo tap en el botón `X` la elimina de inmediato (sin `DialogoEliminar`).

3. **Eliminar un dispositivo que tiene conexiones.** También es soft delete (`eliminarRegistro('dispositivos', dispositivoId)`), y **no hay cascada**: las conexiones que lo referencian (`origenId`/`destinoId`) no se eliminan ni se limpian; quedan apuntando a un dispositivo con `eliminadoEn` seteado. Antes de confirmar, `DispositivoPage.tsx` calcula `resumenImpacto(grafo, 'dispositivo', dispositivoId)` (`grafo.ts` líneas 278-306) y lo muestra como advertencia en `DialogoEliminar`: `` `${impacto} Esas referencias quedarán rotas.` `` — por ejemplo "Se usa en 3 conexiones. Esas referencias quedarán rotas." La eliminación de un dispositivo es **sensible** (`DialogoEliminar` con `sensible`, exige contraseña maestra si el equipo ya la tiene configurada). Tras confirmar, el `nombreVivo`/`nombrePorId` en las pantallas de Red deja de resolver ese id contra un dispositivo activo y cae a la copia de referencia guardada en la conexión (`origenNombre`/`destinoNombre`); en el árbol de `arbol.ts` ese nodo deja de tener `InfoDispositivo` (se filtran los dispositivos con `eliminadoEn`), por lo que su `estado`/`categoriaId` quedan vacíos y su nombre cae al `nombreReferencia` guardado en la conexión.

4. **Impacto de eliminar una conexión sobre la topología.** Al quitar una conexión `enlace`/`instalacion`, el subárbol que colgaba de ella dentro del padre desaparece de ese lugar; si el hijo tenía otras conexiones propias, puede reaparecer como raíz nueva del bosque (si quedó sin padre) o seguir colgando de otro punto. No hay ninguna validación que impida "romper" la topología quitando una conexión.

5. **Por qué `FormularioConexion` no es un modal.** No usa el componente `Modal.tsx`: es un bloque inline embebido en la página (`TopologiaEquipoPage`, variante topología) o en la ficha (`ConexionesFicha`, variante ficha). Como consecuencia directa, no maneja la tecla `Escape` (no hay listener de teclado en el componente) ni ofrece un botón "×"; la única forma de cerrarlo sin guardar es el texto/botón "Cancelar" (ver tabla de botones en §3.8.3). Esto contrasta con `DialogoEliminar` (usado para eliminar un dispositivo, no una conexión), que sí es un `Modal` con botón "Cancelar"/"Cerrar", botón de confirmación que cambia a "Eliminando..." mientras procesa, y que exige contraseña maestra cuando la eliminación es sensible.

6. **Sin validación de ciclos ni de duplicados al guardar una conexión.** El formulario no impide guardar dos veces la misma conexión (mismo par de equipos y puertos) ni valida ciclos al crear; el ciclo se detecta y trunca solo de forma visual al construir el árbol (`arbol.ts`, con `truncado: true` y el glifo `↺`), nunca al momento de guardar en base.

7. **Detección de ciclos al construir el árbol.** `construirNodo` mantiene un `Set<string> enCamino` que se copia por rama (no se comparte entre hermanos): si un `dispositivoId` ya está en el camino actual, el nodo se corta como hoja con `truncado: true` — así dos ramas distintas pueden llevar al mismo subárbol sin bloquearse entre sí, y solo un ciclo real corta la recursión. `caminoAscendente` aplica una protección equivalente (set de `visitados` más un máximo de 100 iteraciones) al subir por los padres.

**Nota sobre discrepancia documental.** El informe de auditoría original no encontró discrepancias entre el código y `ARQUITECTURA_FUNCIONAL.md`/`DOCUMENTACION_FUNCIONAL.md` respecto de la definición de `TipoConexion` en `db.ts`, que coincide con la semántica de enlace/instalación/relacionado. Sí señala un punto a vigilar para quien mantenga la documentación funcional: `ModoConexion` (5 valores en el formulario, interfaz de usuario) no es 1:1 con `TipoConexion` (3 valores persistidos en base) — si la documentación funcional describe el selector "Tipo de relación" listando solo 3 valores, está desactualizada respecto del código, que ofrece 5 (`enlace`, `recibeDe`, `instalado`, `contiene`, `relacionado`, ver §3.8.3).
### 3.9 Bóveda (`/boveda`)

#### 3.9.1 Jerarquía y rutas

La Bóveda vive bajo el prefijo `/boveda`, definido en `src/App.tsx` (líneas ~496-504). Todas sus rutas están envueltas por `BovedaGuard` (`src/features/boveda/BovedaGuard.tsx`), que exige primero el permiso `puedeVerBoveda` del perfil del técnico y luego que la sesión de bóveda esté desbloqueada (`BovedaGuard.tsx:25-38`); solo entonces se renderiza el contenido real.

| Ruta | Componente | Archivo |
|---|---|---|
| `/boveda` | `BovedaGuard` envuelve todo; `BovedaPage` en el índice (listado) | `src/features/boveda/BovedaGuard.tsx`, `BovedaPage.tsx` |
| `/boveda/nueva` | `CredencialForm` (modo creación) | `src/features/boveda/CredencialForm.tsx` |
| `/boveda/migrar` | `MigracionCredenciales` (migración asistida) | `src/features/boveda/MigracionCredenciales.tsx` |
| `/boveda/:credencialId/editar` | `CredencialForm` (modo edición) | mismo archivo |
| `/boveda/:credencialId` | `CredencialPage` (ficha del secreto) | `src/features/boveda/CredencialPage.tsx` |

**Navegación "volver" (chasis, `src/app/Chasis.tsx`):**

- `CredencialForm` es nivel "tarea" del chasis (`modo="tarea"`) y declara `salidaEtiqueta="Cancelar y volver"` (`CredencialForm.tsx:420`); la X/salida de la barra de tarea navega al origen registrado por el chasis (la ficha si se llegó editando, o la lista `/boveda` si se llegó creando desde ahí).
- `CredencialPage` es nivel "documento" y no fija `volverA` explícito: hereda el destino de origen del propio chasis (`origen?.to`, `Chasis.tsx:295`); en la práctica, desde `/boveda` se abre la ficha y "Volver" regresa a `/boveda`.
- Navegación programática: `CredencialForm.tsx:398` hace `navigate('/boveda/${id}')` tras guardar (siempre va a la ficha); `CredencialPage.tsx:220` hace `navigate('/boveda')` tras eliminar.
- `MigracionCredenciales` es nivel "tarea" y declara `salidaEtiqueta="Salir sin migrar"` (`MigracionCredenciales.tsx:152`); como solo se llega desde el enlace `Link to="/boveda/migrar"` de `BovedaPage.tsx:470`, su salida vuelve a `/boveda`.

Regla general confirmada por el código: dentro de `/boveda`, **editar** vuelve a la ficha de la credencial editada; el resto de las salidas vuelve a la lista `/boveda`.

#### 3.9.2 Componentes e interfaz

**Pantalla de bloqueo/desbloqueo (`PantallaDesbloqueo`, dentro de `BovedaGuard.tsx:81-201`).** No es un modal: ocupa toda la pantalla, no tiene X y no se cierra con Escape (no hay nada "detrás" a lo que volver sin autenticarse, `BovedaGuard.tsx` sección 8.2 del informe fuente). Su contenido cambia según el estado calculado por `estadoInicialBoveda()`:

- **Modo `crear`** (primera vez real, ver 3.9.5): dos campos, "Contraseña" y "Confirma la contraseña" (`BovedaGuard.tsx:165-179`), con el aviso literal: *"Esta contraseña quedará registrada como la contraseña maestra del equipo, asociada a la cuenta y válida en todos los dispositivos: acuérdenla entre todos y guárdenla bien, sin ella no se puede recuperar el contenido."* Si los dos campos no coinciden: *"Las contraseñas no coinciden."* (`BovedaGuard.tsx:115-118`).
- **Modo `verificar`** (ya existe contraseña maestra): un solo campo de contraseña (`BovedaGuard.tsx:151-198`). Muestra además el texto informativo sobre autobloqueo: *"Se vuelve a bloquear sola tras {N} minutos sin actividad."* (`BovedaGuard.tsx:192-196`), donde `{N}` refleja la preferencia guardada.
- **Modo `sin-confirmar`** (sin conexión y sin verificador local ni remoto confirmado): no se permite ni crear ni verificar; la app no puede validar la contraseña maestra hasta reconectar.
- **Sin permiso `puedeVerBoveda`**: el técnico ve una pantalla genérica de acceso restringido ("Tu usuario no tiene acceso a esta sección...") sin revelar contenido específico ni siquiera con un candado descriptivo (mínima exposición, `BovedaGuard.tsx:68-76`).

**Listado (`BovedaPage`).** Cabecera con botón de candado que ejecuta el bloqueo manual (`bloquear`, `BovedaPage.tsx:369-377`). Chips al pie para configurar el autobloqueo por inactividad (opciones 1/5/15/30 minutos, `BovedaPage.tsx:553-577`). Botón/enlace "Crear" que abre una `HojaInferior` para elegir tipo de secreto (precarga `?tipo=` en `CredencialForm`). Cada fila de la lista tiene un menú "···" (también `HojaInferior`) con acciones: copiar usuario, copiar contraseña, eliminar (con aviso "pide la contraseña maestra", `BovedaPage.tsx:697`, por ser eliminación sensible). Aviso de migración: si `detectarCandidatos` (con conteo barato, solo por vínculo) encuentra candidatos, se muestra *"{N} secretos parecen ser de un solo equipo. Muévelos a su ficha."* con enlace a `/boveda/migrar` (`BovedaPage.tsx:201-204, 470`).

**`HojaInferior`** (`BovedaPage.tsx:149-187`, usada para "Crear" y el menú "···"): botón X visible que cierra con `onCerrar`; escucha `Escape` en `document` (`keydown`) y bloquea el scroll de fondo (`overflow:hidden`) mientras está abierta, restaurándolo al cerrar.

**Ficha de credencial (`CredencialPage`).** Muestra los campos descifrados vía `CampoSecreto.tsx` (componente reutilizable también usado en `CredencialEnPaso.tsx` y `MigracionCredenciales.tsx`): etiqueta a la izquierda, valor en monoespaciado, icono de ojo (si `alternarOculto` está definido) y botón de copiar con confirmación visual de 1.4-1.5 segundos. Incluye sección "Actividad" con la línea de tiempo de auditoría (ver 3.9.5). Botón "Eliminar" abre `DialogoEliminar` en modo sensible (pide contraseña maestra). Si el contenido no se pudo descifrar con la contraseña actual, se muestra el aviso *"No se pudo descifrar este secreto con la contraseña maestra actual..."* (`CredencialPage.tsx:356-361`) en vez de fallar en silencio.

**`DialogoEliminar`** (modal, `src/components/Modal.tsx` + lógica propia): "Cancelar" (o "Cerrar" en modo `sin-comprobar`) cierra sin ejecutar la acción; el botón de acción usa `textoConfirmar` (por defecto "Eliminar") y queda deshabilitado mientras está `ocupado` o, en modo `contrasena`, mientras el campo de contraseña maestra está vacío. Se cierra con Escape o tocando fuera de la tarjeta.

#### 3.9.3 Formularios y campos

**Tabla completa de `CredencialForm`** (`src/features/boveda/CredencialForm.tsx`). Todo lo que va a `datosCifrados` viaja cifrado con AES-256-GCM; el resto se marca explícitamente como no cifrado.

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Tipo de secreto | `<select>` (5 opciones fijas, `TIPOS_SECRETO_VALIDOS`) | Obligatorio (siempre tiene un valor) | Al crear, precargado por `?tipo=` desde la hoja "Crear" de `BovedaPage`; si no es válido cae a `'cuenta'`. Al editar, el tipo guardado. | No cifrado (columna `credenciales.tipo`). Editable tanto al crear como al editar. |
| Título | `<input type="text">` | **Obligatorio (único campo obligatorio del formulario)** | Vacío (o sugerido, ver nudges) | No cifrado. Placeholder varía según tipo (tabla de tipos, 3.9.4). Si está vacío al enviar: no guarda, error "Falta el título" (`CredencialForm.tsx:359-362, 406-409`). Si el título coincide (sin distinguir mayúsculas/acentos) con el nombre de un equipo del inventario, aviso de posible duplicado con enlace a la ficha del equipo. Si el secreto proviene de creación contextual ("Acceso {equipo}") y el equipo se renombró, se sugiere el título actualizado. |
| Categoría | `<input>` con autocompletado (`CampoConSugerencias`) | Opcional | Vacío | No cifrado. Sugerencias derivadas de categorías ya usadas en otras credenciales. |
| Usuario | `<input type="text">` | Opcional | Vacío | Cifrado. Visible por defecto solo en tipo `cuenta`; en el resto de tipos solo con "Mostrar todos los campos". `autoComplete="off"`. |
| Contraseña / Clave | `CampoContrasena` (oculto/enmascarado) | Opcional | Vacío | Cifrado. Aplica a `cuenta`, `red`, `llave`. Botón de ojo para mostrar/ocultar en el propio formulario; botón "Generar" crea 16 caracteres sin ambigüedad visual (evita O/0, l/1) vía `generarContrasena()`. La etiqueta cambia según el tipo ("Contraseña" / "Clave" / "Clave o token"). |
| URL | `<input type="text">` | Opcional | Vacío | Cifrado. Visible por defecto solo en `cuenta`; en el resto solo con "Mostrar todos". Si el texto escrito coincide con la IP de un equipo del inventario, se sugiere vincular ese equipo (solo si aún no hay ninguno vinculado). |
| Otros datos protegidos (extras) | Lista clave/valor dinámica (`CamposClaveValor`) | Opcional | Vacía | Cifrado. Aplica a todos salvo `nota`. Ayuda: "Puerto, PIN, clave WiFi, usuario de respaldo... también van cifrados." Valor en monoespaciado, `autoComplete="off"`. |
| Archivo | `<input type="file">` | Opcional | Sin archivo | El contenido se cifra; los metadatos no. Solo aplica al tipo `archivo`. Se cifra y sube de inmediato al elegirlo (no espera a "Guardar"), a `archivos_boveda/credenciales/{id}/{timestamp}-{nombre}`. Metadatos en claro: referencia, nombre, tipo MIME, tamaño. Muestra nombre y tamaño formateado más botón "Quitar" (borra solo el estado local o cancela una subida pendiente; nunca borra de Storage hasta que se elimina el secreto completo). Error propio si falla cifrar o subir. |
| Notas | `<textarea>` | Opcional | Vacío | Cifrado. Aplica a todos los tipos. |
| Vencimiento | `<input type="date">` | Opcional | Vacío | **No cifrado a propósito** (`Credencial.venceEn`), sección "Visible sin desbloquear". Permite avisar de rotación sin desbloquear la bóveda. Si la contraseña cambió desde que se abrió el editor y el vencimiento no se tocó, aparece aviso *"La contraseña cambió pero el vencimiento sigue siendo el mismo. ¿Renovarlo?"* con botón "Renovar 90 días" (`proximoVencimiento` → +90 días). |
| Equipos con acceso | Editor de pastillas (`EquiposVinculadosEditor`) | Opcional | Vacío o preseleccionado si se creó desde la ficha de un equipo | **No cifrado a propósito** (`Credencial.dispositivos: DispositivoAfectado[]`). Selector `<select>` con los dispositivos aún no vinculados; cada vínculo se quita con una X. Si un equipo vinculado ya tiene un campo protegido tipo `contrasena` en su ficha, aviso de solapamiento. |
| Motivo del cambio | `<input type="text">` | Opcional | Vacío | No cifrado, va al historial. Solo aparece en modo edición. Placeholder: "Por qué se actualizó: rotación, incidente..." |

Aviso fijo en la barra del formulario: *"Se guarda cifrada"* + *"Solo el título es obligatorio; el vencimiento y los equipos no se cifran para poder avisar sin desbloquear"* (`CredencialForm.tsx:421-431`). El botón "Mostrar todos los campos" revela todos los campos sin perder datos, en cualquier tipo (`CredencialForm.tsx:220-222, 692-701`).

**Dirección IP heredada:** si la credencial proviene de un tipo `equipo` (preset eliminado en la fase P0, 2026-07-21), se muestra como aviso con botón "Quitar" (`CredencialForm.tsx:523-541`); ya no se puede volver a crear, solo conservar o quitar el dato heredado.

Al guardar, se llama `cifrarCredencial()`, que falla si la bóveda se bloqueó por inactividad durante la edición (*"La sección se bloqueó por inactividad. Desbloquéala de nuevo para guardar."*, `CredencialForm.tsx:399-403`), y luego `guardarRegistro('credenciales', {...}, motivo)`. Si es edición, además se registra `registrarAccesoBoveda({accion: 'modifico'})` (la creación ya queda en el historial general, sin duplicar auditoría de bóveda).

**Tabla de avisos/nudges del formulario** (todos son sugerencias, no bloqueos):

| Aviso | Condición | Acción ofrecida |
|---|---|---|
| "ya es un equipo del inventario" | Título coincide exactamente (normalizado) con el nombre de un dispositivo | Enlace a la ficha del equipo con `?nuevoCampoProtegido=` |
| "El equipo vinculado se renombró" | Título sigue el patrón "Acceso {nombre-viejo}" y el equipo vinculado ya tiene otro nombre | Botón "Usar {nombre-nuevo}" |
| "Esa dirección coincide con..." | URL/IP escrita contiene la IP de un dispositivo y aún no hay ningún equipo vinculado | Botón "Vincular equipo" |
| "...ya guarda una contraseña en Seguridad" | Tipo `cuenta` y algún equipo vinculado tiene un `CampoProtegido` tipo `contrasena` activo | Enlace a la ficha del equipo (evita duplicar la contraseña en dos lados) |
| "Guarda una dirección IP heredada" | Credencial de tipo legado con IP heredada aún presente | Botón "Quitar" |

#### 3.9.4 Relaciones y reutilización de datos

**Los 5 tipos de secreto (`TipoSecreto`)**, definidos en `src/lib/db.ts:423` y detallados en `CredencialForm.tsx` (constantes `CAMPOS_POR_TIPO`, `NOMBRE_TIPO`, `DESCRIPCION_TIPO`, `PLACEHOLDER_TITULO`, `ETIQUETA_CONTRASENA`, líneas 49-90):

| Tipo (`TipoSecreto`) | Nombre visible | Descripción (ayuda) | Placeholder del título | Usuario | Contraseña/Clave (etiqueta) | URL | Otros datos protegidos (extras) | Campo específico |
|---|---|---|---|---|---|---|---|---|
| `cuenta` | Cuenta de sistema | Usuario y contraseña de un servicio o aplicación | "Servicio: Panel de Supabase, correo..." | Sí | Sí ("Contraseña") | Sí | Sí | — |
| `red` | Red | Clave de una red WiFi u otro acceso compartido | "Nombre de la red WiFi" | No | Sí ("Clave") | No | Sí | — |
| `llave` | Llave digital | Token, licencia o certificado | "Licencia de Windows, certificado SSL..." | No | Sí ("Clave o token") | No | Sí | — |
| `archivo` | Archivo seguro | Un archivo cifrado (licencia, certificado, config...) con sus datos de referencia | "Qué es este archivo" | No | No | No | Sí | Selector de archivo (cifrado antes de subir) |
| `nota` | Nota segura | Texto cifrado, sin usuario ni contraseña | "Título de la nota" | No | No | No | No | — |

Nota importante: el preset `'equipo'` (que antes representaba un equipo entero dentro del secreto) fue eliminado en la fase P0 (2026-07-21): ya no se puede crear, solo se conservan datos heredados (IP heredada) hasta que el técnico los quite a mano.

Todos los tipos comparten además, independientemente de qué campos se muestren por defecto: Título (obligatorio), Categoría, Notas, Vencimiento (opcional, sin cifrar) y "Equipos con acceso" (sin cifrar).

**Relación con Equipos (inventario):** el campo "Equipos con acceso" vincula un secreto de la Bóveda con uno o varios dispositivos del inventario, sin cifrar ese vínculo. Si el título de un secreto coincide con el nombre de un equipo, el formulario sugiere crear en su lugar un campo protegido en la ficha del propio equipo. Si un equipo vinculado ya tiene un `CampoProtegido` tipo `contrasena`, se advierte de la posible duplicación. La migración asistida (3.9.5) traslada contenido de la Bóveda hacia `campos_protegidos` de un equipo específico cuando el vínculo es 1 a 1.

**Relación con Guías (procedimientos):** `CredencialEnPaso.tsx` permite vincular y revelar en línea, dentro de un paso de un procedimiento, el contenido de una credencial o campo protegido (si el técnico está autorizado y el dato existe). Eliminar un secreto vinculado a un paso está permitido pero con aviso de impacto previo (ver 3.9.5); tras eliminarlo, el paso muestra "Los datos vinculados fueron eliminados. Edita el artículo para quitar el vínculo o vincular otros."

#### 3.9.5 Comportamientos y reglas de negocio

**Mecánica criptográfica y de sesión.**

La contraseña maestra nunca se guarda. La sesión mantiene en memoria (nunca en disco) la `CryptoKey` derivada por PBKDF2 con 600.000 iteraciones (`ITERACIONES_PBKDF2`, `crypto.ts:12`); la contraseña en sí se descarta apenas termina la derivación. Su existencia se comprueba con un **verificador**: un texto fijo (`TEXTO_VERIFICADOR = 'soluciones-it:boveda'`) cifrado con la clave maestra y guardado en la tabla `boveda_meta` de Supabase (fila única `ID_VERIFICADOR = 'principal'`) y su copia local (`db.bovedaMeta`). Descifrar el verificador con éxito (AES-GCM valida integridad) demuestra que la contraseña es correcta, sin que esta viaje ni se guarde jamás.

**Estado inicial (`estadoInicialBoveda()`):**
1. Si hay verificador local (`db.bovedaMeta`) → modo `verificar`.
2. Si no hay verificador local pero sí credenciales cifradas locales (equipo con datos previos al verificador) → modo `verificar`.
3. Si no hay nada local, se consulta el servidor: si hay error de conexión/sesión/esquema → `sin-confirmar` (no se permite crear); si el servidor tiene verificador → se guarda localmente, modo `verificar`; si el servidor confirma que no hay verificador ni credenciales cifradas → modo `crear` (primera vez real); si no hay verificador pero sí hay credenciales remotas → `sin-confirmar`.

Regla de oro explícita en el código: mientras exista un verificador (local o remoto), la app **nunca** ofrece crear una contraseña nueva. Borrar caché, cambiar de teléfono o vaciar las credenciales locales nunca reabre el flujo de "primera vez"; solo una confirmación explícita del servidor de que no existe nada habilita `crear`.

**Flujo de creación por primera vez (modo `crear`):** al enviar, (1) se genera un salt nuevo y se deriva la clave con 600.000 iteraciones; (2) se cifra el texto fijo del verificador con esa clave; (3) se intenta subir primero el verificador al servidor (inserción en `boveda_meta`); solo si el servidor lo acepta se guarda localmente y se abre la sesión — si el registro remoto falla, **no se desbloquea**; (4) si otro técnico definió la contraseña maestra en el mismo instante (conflicto de clave primaria, código Postgres `23505`), se relee el verificador remoto y se valida la contraseña escrita contra el de ese otro técnico; si no coincide: *"Otro técnico acaba de definir la contraseña maestra y no coincide con la que escribiste."*

**Flujo de desbloqueo posterior (modo `verificar`):** (1) si hay verificador (local o recién descargado), se deriva la clave con el salt/iteraciones del verificador y se intenta descifrar; si falla → "Contraseña incorrecta."; si acierta, se abre la sesión y además se derivan las claves de cualquier otro salt distinto encontrado entre las credenciales locales, para poder leer credenciales cifradas con un salt antiguo (creadas antes de que existiera el verificador, o sin conexión en otro teléfono); (2) si no hay verificador pero sí credenciales cifradas locales, la contraseña se valida directamente contra ellas y, si acierta, se sube automáticamente el verificador al servidor para anclar la contraseña; (3) si nada de lo anterior aplica y el servidor no confirmó que está vacío: *"No se pudo comprobar la contraseña maestra del equipo. Conéctate a internet, espera a que la aplicación sincronice y vuelve a intentarlo."*

**No hay recuperación si se olvida la contraseña maestra.** El código no ofrece ningún mecanismo de reseteo: la contraseña nunca se guarda en claro en ningún lado (ni cliente ni servidor), solo su verificador cifrado. El aviso al crearla ya lo advierte literalmente: "sin ella no se puede recuperar el contenido". Solo queda pedirla a un compañero que la recuerde (es compartida por todo el equipo) o, si nadie la recuerda, el contenido cifrado queda ilegible para siempre.

**Contenido no descifrable con la contraseña actual:** si una credencial fue cifrada con un salt/contraseña que no coincide con la sesión actual, `descifrarCredencial` devuelve `null`, y tanto `CredencialForm` (bandera `sinDescifrar`, aviso *"No se pudo descifrar el contenido actual (se guardó con otra contraseña maestra). Si guardas, se reemplazará por lo que escribas aquí."*) como `CredencialPage` (*"No se pudo descifrar este secreto con la contraseña maestra actual..."*) lo muestran explícitamente en vez de fallar en silencio.

**Duración de la sesión:**
- Autobloqueo por inactividad: opciones 1, 5, 15, 30 minutos, por defecto **5 minutos**, guardado en `localStorage` (clave `boveda_autobloqueo_minutos`), configurable desde chips al pie de `BovedaPage`. El temporizador se reinicia con cualquier `pointerdown` o `keydown` en `document` (captura). Al vencer, llama a `bloquear()`.
- Bloqueo manual: botón de candado en la cabecera de `BovedaPage`.
- Al bloquear (`bloquear()`): se limpia la bandera `desbloqueada`, la clave principal (`principal = null`) y el mapa de claves por salt (`clavesPorSal.clear()`), y se desinstalan los listeners de actividad.
- El estado se expone a React vía `useSyncExternalStore` en `useSesionBoveda.ts`, así que todos los componentes que dependen de `bovedaDesbloqueada()` se refrescan solos.
- Cerrar o recargar la pestaña también bloquea (la clave solo vive en memoria de módulo, nunca en `localStorage`/IndexedDB).
- Esta sesión de bóveda es **independiente** del bloqueo de la app (sección 3.10): son dos capas distintas con temporizadores propios.

**Auditoría de revelado y copia (`AccesoBoveda`).** Modelo en `src/lib/db.ts:706-738` (`AccionBoveda`, `AccesoBoveda`); tabla local `db.accesos_boveda`, remota `accesos_boveda` — solo inserción, inmutable, sincronizada con el resto del equipo. `entidadTipo` distingue `'credencial'` de `'campo_protegido'`; por compatibilidad, los campos `credencialId`/`credencialTitulo` se reutilizan como id/título del objetivo en ambos casos. Función central: `registrarAccesoBoveda()` (`src/lib/repositorio.ts:163-188`).

| Acción (`AccionBoveda`) | Cuándo se dispara | Dónde (archivo:línea) |
|---|---|---|
| `consulto` | Al abrir la ficha de una credencial (una vez por apertura, protegido con `ref` contra doble registro) | `CredencialPage.tsx:163-171` |
| `consulto` | Al expandir el informe previo de un candidato en la migración asistida | `MigracionCredenciales.tsx:71-79` |
| `consulto` | Al expandir en línea un bloque protegido dentro de un paso de procedimiento, si está autorizado y el dato existe | `CredencialEnPaso.tsx:75-77` |
| `mostro` | Al revelar la contraseña oculta en la ficha (solo cuando `clave === 'contrasena'`, no para otros campos) | `CredencialPage.tsx:259-263` |
| `mostro` | Al revelar la contraseña de un candidato en la migración (solo `campo.tipo === 'contrasena'`) | `MigracionCredenciales.tsx:99-101` |
| `mostro` | Al revelar la contraseña dentro de un paso de procedimiento | `CredencialEnPaso.tsx:243` |
| `mostro` | Al revelar un `CampoProtegido` cuyo tipo se considera oculto por defecto, dentro de un paso | `CredencialEnPaso.tsx:313-317` |
| `copio_usuario` | Al copiar el campo "usuario" desde el menú de la lista, la ficha, la migración o el paso de procedimiento | `BovedaPage.tsx:328-332`, `CredencialPage.tsx:288-289`, `MigracionCredenciales.tsx:86-90`, `CredencialEnPaso.tsx:232` |
| `copio_contrasena` | Igual que arriba pero para el campo "contraseña" | mismos archivos, mismo patrón |
| `modifico` | Al guardar una edición de una credencial existente (no al crear) | `CredencialForm.tsx:395-397` |
| `elimino` | Al confirmar la eliminación de una credencial, desde el menú de la lista o desde la ficha | `BovedaPage.tsx:347-351`, `CredencialPage.tsx:210` |
| `elimino` | Al migrar una credencial a campos protegidos de un equipo (se registra como eliminación porque el secreto deja de existir como tal en la Bóveda) | `MigracionCredenciales.tsx:133-137` |
| `descargo` | Al descargar y descifrar con éxito un secreto de tipo `archivo` | `CredencialPage.tsx:246` |

Notas importantes: solo `usuario` y `contrasena` tienen una acción de copia nombrada; copiar la URL, las notas o los "extras" no genera auditoría. Solo la **contraseña** genera `mostro`; ningún otro campo revelado (usuario, IP, extras) lo hace. El texto de la hoja de acciones de `BovedaPage` avisa explícitamente: *"Copiar registra quién y cuándo"*. El texto de la ficha avisa: *"Cada consulta, revelado y copia queda registrada"*. El botón "Eliminar" del menú indica *"pide la contraseña maestra"* porque el borrado es una eliminación sensible.

**Dónde consultar la auditoría:** dentro de la propia ficha de cada credencial (`CredencialPage`), sección "Actividad" (`CredencialPage.tsx:467-489`): combina los eventos de `accesos_boveda` de esa credencial con su `historial` de cambios en una sola línea de tiempo, lo más reciente primero, mostrando por defecto 6 eventos con "Ver toda la actividad (N)" para expandir. Cada línea muestra icono (según `AccionBoveda`), texto descriptivo, quién y cuándo. **No existe una pantalla separada de auditoría global de bóveda:** se consulta credencial por credencial (o campo protegido por campo protegido) desde su propia ficha.

**Migración asistida.** Archivos: `MigracionCredenciales.tsx` (pantalla), `migracionSecretos.ts` (lógica pura, sin React ni criptografía real, testeable), `solapamientoSecreto.ts` y `sugerenciaEquipoPorIp.ts` (avisos del formulario).

Criterios de detección (`detectarCandidatos`), para cada credencial no eliminada:
1. Motivo `'vinculo'` (señal explícita, más fuerte): si la credencial está vinculada a exactamente un dispositivo existente y no eliminado → candidata.
2. Motivo `'ip'` (señal implícita, solo si no aplicó el vínculo): si la IP descifrada heredada de la credencial coincide (normalizada) con la IP de algún dispositivo del inventario → candidata.

El vínculo explícito gana sobre la coincidencia de IP cuando apuntan a equipos distintos, por ser una señal puesta a mano por un técnico. En `BovedaPage.tsx:201-204` se calcula un conteo barato (solo motivo `'vinculo'`, sin desbloquear ni descifrar) para mostrar el aviso de candidatos; el análisis completo (incluida la coincidencia por IP, que sí requiere descifrar) vive solo en la pantalla dedicada `/boveda/migrar`.

Qué se crea al migrar (`camposAMigrar`), a partir del contenido ya descifrado: `usuario` (si no vacío) → `CampoProtegido` tipo `usuario`; `contrasena` (si no vacía) → tipo `contrasena`; `url` (si no vacía) → tipo `texto`, nombre "URL"; `notas` (si no vacías) → tipo `texto`, nombre "Notas"; cada entrada de `extras` con valor no vacío → tipo `texto`, nombre = la clave original. **La IP heredada se descarta a propósito**: ya vive sin cifrar en `dispositivo.ip`, volver a guardarla repetiría la duplicación (aviso al técnico: *"Se descarta la dirección IP heredada (...): ya vive sin cifrar en la ficha del equipo."*). Los nombres se desambiguan contra los campos ya existentes del equipo agregando sufijo " (2)", " (3)"...

Ejecución (`migrar()`): (1) requiere que la credencial se haya podido descifrar con la contraseña maestra actual (si no, el botón "Migrar a este equipo" queda bloqueado); (2) por cada campo propuesto, `guardarRegistro('campos_protegidos', {...})` con `orden` consecutivo tras los campos existentes; (3) se registra `elimino` en la auditoría de bóveda; (4) se llama `eliminarRegistro('credenciales', id)`; (5) la lista se refresca sola por `useLiveQuery`. **Es idempotente**: al migrar, la credencial se elimina de la Bóveda, así que una segunda pasada del detector no vuelve a proponerla.

No se crea una entrada de historial especial de "migración": lo que queda es la entrada `elimino` en `accesos_boveda` de la credencial de origen y las nuevas filas en `campos_protegidos`, cada una con su propio ciclo de vida. El vínculo entre la credencial vieja y los campos nuevos no queda registrado explícitamente; solo se infiere por la cercanía temporal de los eventos.

Casos no migrables: si la credencial detectada no se pudo descifrar con la contraseña maestra actual, se muestra *"No se pudo descifrar este secreto con la contraseña maestra actual (se guardó con otra). No se puede migrar sin poder leer su contenido."* y el botón queda deshabilitado; si la credencial no tiene contenido (todos los campos vacíos), se indica *"Este secreto no tiene contenido: se puede eliminar directo desde la Bóveda."* sin ofrecer botón de migrar; se muestra un contador al pie con la cantidad de secretos detectados que no se pudieron leer y por tanto no se pueden migrar todavía.

**Guardar / Cancelar / × / Escape.** `CredencialForm`: botón primario "Guardar secreto" (deshabilitado mientras `guardando`), barra inferior fija con el aviso de validación o de error de bloqueo; "Cancelar y volver" navega sin guardar. `HojaInferior` (crear / menú "···"): X visible, cierra con `onCerrar`, escucha Escape y bloquea el scroll de fondo mientras está abierta. `Modal`/`DialogoEliminar`: se cierra con Escape o tocando fuera de la tarjeta. La pantalla de bloqueo (`BovedaGuard`) no es modal: ocupa toda la pantalla, sin X ni cierre con Escape.

**Restricciones de integridad:**
- Eliminar una credencial vinculada a un paso de procedimiento **está permitido**, pero con aviso previo de impacto: `resumenImpacto()` (`src/lib/grafo.ts:278-...`) cuenta cuántos procedimientos, diagnósticos, artículos u otras entidades referencian esa credencial (vía el grafo de referencias), y `DialogoEliminar` lo muestra como advertencia: *"Esta acción eliminará este secreto de la bóveda."* + *"{impacto} Esos pasos quedarán sin el secreto vinculado."* No hay bloqueo duro: el sistema no impide eliminar un secreto en uso, solo advierte. Tras eliminar, el paso que lo vinculaba muestra "Los datos vinculados fueron eliminados. Edita el artículo para quitar el vínculo o vincular otros."
- **Eliminación "sensible"**: eliminar una credencial de la Bóveda (y, reutilizando `DialogoEliminar`, otras entidades sensibles de la app) exige la contraseña maestra antes de confirmar, siempre que el equipo ya la tenga definida (`sensible=true`). Flujo exacto: si el estado inicial de la Bóveda es `'verificar'` (ya existe contraseña maestra) → pide la contraseña, la valida contra el verificador con `verificarContrasenaMaestra()` (comprobación de un solo uso, sin abrir sesión de Bóveda ni tocar estado) y solo si es correcta ejecuta la confirmación; si es `'crear'` (el servidor confirma que aún no hay contraseña maestra) → cae a confirmación simple, sin pedir contraseña; si es `'sin-comprobar'` (sin conexión y sin verificador local) → **la eliminación se niega** por seguridad, con el único botón "Cerrar" disponible. Decisión explícita del 2026-07-17: cualquier técnico autenticado puede autorizar esta eliminación con la contraseña maestra, ya no se exige además el permiso `puede_ver_boveda` (eso bloqueaba innecesariamente al resto del equipo); ver credenciales de la Bóveda sí sigue exigiendo ese permiso, eso no cambió.
- Migración: no elimina nada sin antes crear con éxito los campos protegidos correspondientes (el guardado de cada campo ocurre antes de la eliminación de la credencial); si el descifrado falla, el botón de migrar está deshabilitado y no se puede ni empezar.
- Archivo seguro: el archivo cifrado en Storage solo se borra al eliminar el secreto completo desde su ficha (con contraseña maestra ya exigida por ser sensible), nunca al editarlo o quitarlo desde el formulario (eso solo toca el estado local).
- Acceso restringido silencioso: un técnico sin `puedeVerBoveda` que llega a `/boveda` ve una pantalla genérica de acceso restringido, sin revelar qué contiene la sección.

---

### 3.10 Seguridad de la app (`/cuenta/seguridad`)

#### 3.10.1 Jerarquía y rutas

Ruta única: `/cuenta/seguridad`, componente `SeguridadPage` (`src/features/seguridad/SeguridadPage.tsx`, definida en `App.tsx` línea ~529). A diferencia de la Bóveda, esta sección no tiene guard de permiso propio adicional: es una preferencia local del dispositivo que cualquier técnico autenticado puede configurar para sí mismo. El bloqueo resultante, sin embargo, se aplica mediante `BloqueoAppGuard`, que envuelve **todas las rutas autenticadas** de la app (no solo Bóveda): si hay un bloqueo configurado en el dispositivo y aún no se desbloqueó en esta apertura, se muestra la pantalla de bloqueo en vez de cualquier contenido (`BloqueoAppGuard.tsx:20-29`). Si no hay bloqueo configurado, la app se ve normal (es opcional, cada técnico lo activa por su cuenta).

Archivos relevantes: `src/features/seguridad/bloqueoApp.ts` (lógica), `BloqueoAppGuard.tsx` (guard global), `patron.ts` (lógica pura del patrón), `PatronInput.tsx` (dibujo SVG del patrón), `SeguridadPage.tsx` (pantalla de configuración), `useBloqueoApp.ts` (hook reactivo).

#### 3.10.2 Componentes e interfaz

**Pantalla de bloqueo (`PantallaBloqueo`, dentro de `BloqueoAppGuard.tsx:31-135`).** No es un modal: ocupa toda la pantalla, sin X y sin cierre con Escape. Pide el secreto (patrón o contraseña, según el método configurado). Incluye un enlace "¿Olvidaste tu código de desbloqueo?" que despliega la explicación y el botón "Cerrar sesión y quitar el bloqueo" (ver 3.10.5).

**`SeguridadPage` — panel sin configurar (`PanelSinConfigurar`, `SeguridadPage.tsx:65-102`):** selector de método (Patrón / Contraseña) y flujo de creación con doble confirmación (ver 3.10.3).

**`SeguridadPage` — panel configurado (`PanelConfigurado`, `SeguridadPage.tsx:141-154` y alrededores):** muestra el método activo, un `<select>` para el minuto de autobloqueo (1/5/15/30), botón manual "Bloquear ahora" (`bloquearApp`, `SeguridadPage.tsx:136-139`), y accesos a los subflujos "Cambiar" (`FlujoCambiar`, `SeguridadPage.tsx:172-217`) y "Quitar" (`FlujoQuitar`, `SeguridadPage.tsx:219-253`), cada uno con "Cancelar" propio que vuelve al panel principal sin aplicar cambios.

**`PatronInput.tsx`:** grilla 3x3 dibujada en SVG, con arrastre capturado por puntero (`pointerdown`/`pointermove`) y el mismo criterio de "punto intermedio" que un patrón estilo Android: si el trazo salta un nodo alineado en línea recta entre dos nodos ya marcados, ese nodo intermedio se agrega automáticamente antes de continuar.

**`CampoContrasena` centrado**, reutilizado para el método de contraseña.

#### 3.10.3 Formularios y campos

**Tabla de método de bloqueo (`MetodoBloqueoApp`):**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Método | Selector (`SelectorMetodo`): Patrón / Contraseña | Obligatorio para avanzar | Sin selección | Determina qué componente de captura de secreto se usa a continuación. Se puede elegir un método distinto al cambiar el bloqueo existente. |

**Tabla de configuración de patrón:**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Patrón (primer trazo) | `PatronInput` (grilla 3x3, `LADO_PATRON=3`, `TOTAL_NODOS=9`) | Obligatorio | Vacío | Debe unir al menos **4 puntos** (`MIN_NODOS_PATRON`, `patron.ts:17`); si no llega al mínimo, error y se reinicia el trazo (`reiniciarToken`). Se serializa como texto (p. ej. "0-4-8", `serializarPatron`); el dibujo nunca viaja ni se guarda tal cual. |
| Patrón (confirmación) | `PatronInput` | Obligatorio | Vacío | Debe coincidir exactamente con el primer trazo; si no, error *"Los patrones no coinciden."* y se vuelve a pedir el primero. |

**Tabla de configuración de contraseña:**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Contraseña (primer intento) | `CampoContrasena` | Obligatorio | Vacío | Mínimo **4 caracteres** (`MIN_LONGITUD_CONTRASENA_APP`, `bloqueoApp.ts:31`); si no cumple, error y se limpia el campo. |
| Contraseña (confirmación) | `CampoContrasena` | Obligatorio | Vacío | Debe coincidir exactamente con el primer intento; si no, error *"Las contraseñas no coinciden."* y se vuelve a pedir el primero. |

**Tabla de autobloqueo (panel configurado):**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Minutos de autobloqueo | `<select>` (opciones `OPCIONES_AUTOBLOQUEO_APP_MIN = [1, 5, 15, 30]`) | Opcional (siempre tiene valor) | 5 minutos (`minutosAutobloqueo` por defecto al configurar) | Cambia el umbral de inactividad y de retorno de segundo plano que dispara `bloquearApp()`. |

**Flujo de cambiar bloqueo (`FlujoCambiar`):** exige primero el secreto **actual** (paso `EntradaSecreto`) antes de permitir elegir método y secreto nuevos; si el actual es incorrecto: *"El código actual no es correcto."*

**Flujo de quitar bloqueo (`FlujoQuitar`):** también exige el secreto actual; si coincide, borra la fila de `db.seguridadApp` por completo.

#### 3.10.4 Relaciones y reutilización de datos

**Independencia frente a la Bóveda pese al mecanismo similar.** El bloqueo de la app es una capa de **acceso**, no de cifrado: impide que quien tome el teléfono abra la app y navegue por las secciones, pero la información realmente secreta (credenciales de la Bóveda) sigue cifrada aparte con la contraseña maestra, que este bloqueo **no reemplaza** (comentario explícito en `bloqueoApp.ts:12-23`). Usa el mismo mecanismo criptográfico AES-256-GCM/PBKDF2 (600.000 iteraciones) que la contraseña maestra de la Bóveda, pero con un ámbito totalmente independiente: texto verificador distinto (`TEXTO_VERIFICADOR_APP = 'soluciones-it:bloqueo-app'`), salt propio y sin relación con `boveda_meta`. Es **local a cada dispositivo y no se sincroniza**: la tabla `seguridadApp` no está en `TABLAS_SINCRONIZADAS`; cada técnico lo configura en su propio teléfono, de forma independiente del resto del equipo. Nunca usa biometría (decisión de diseño explícita: dato personal sensible que no todos quieren entregar). El secreto (patrón o contraseña) nunca se guarda; solo su verificador cifrado.

**Independencia frente a la sesión de la Bóveda:** el autobloqueo de la app tiene su propio temporizador y configuración (`minutosAutobloqueo` en `db.seguridadApp`), separado del autobloqueo de la Bóveda (`boveda_autobloqueo_minutos` en `localStorage`); bloquear una de las dos capas no afecta a la otra.

**Relación con el login de la cuenta:** el mecanismo de "olvidé el código" (3.10.5) se apoya en el inicio de sesión estándar de Supabase Auth: quitar el bloqueo local no requiere el secreto porque el acceso real de la app sigue protegido por la autenticación de la cuenta.

#### 3.10.5 Comportamientos y reglas de negocio

**Configuración por primera vez (`configurarBloqueoApp`, `bloqueoApp.ts:113-135`):**
1. El técnico elige método (Patrón o Contraseña).
2. `CrearSecreto` pide el secreto dos veces (confirmación): el primer intento se valida con `validarSecreto` (longitud o puntos mínimos); si falla, error y se reinicia el trazo del patrón o se limpia el campo de contraseña. El segundo intento debe coincidir exactamente con el primero; si no, error de "no coinciden" y se vuelve a pedir el primero.
3. Al confirmar, se cifra un verificador nuevo (salt nuevo, 600.000 iteraciones) y se guarda en `db.seguridadApp` con `minutosAutobloqueo = 5` (por defecto) y `bloqueadoHasta = null`.
4. **Al configurarlo, la app queda desbloqueada de inmediato** (quien lo configura acaba de demostrar el secreto): se llama `abrirSesion()` al final de `configurarBloqueoApp`.

**Desbloqueo posterior (`desbloquearApp`, `bloqueoApp.ts:149-180`):**
1. Si hay un `bloqueadoHasta` vigente (cooldown activo), se niega directamente con el tiempo restante en segundos, sin siquiera comprobar el secreto.
2. Se compara el secreto ingresado contra el verificador (`secretoCoincide`, mismo mecanismo AES-GCM). Si coincide: se resetea el contador de intentos fallidos, se limpia `bloqueadoHasta` si estaba activo, se carga `minutosAutobloqueo` desde la configuración y se abre la sesión.
3. Si no coincide: `intentosFallidos++`. Al llegar al umbral `UMBRAL_INTENTOS = 5`, se fija `bloqueadoHasta = ahora + 30 segundos` (`COOLDOWN_MS`) en `db.seguridadApp` y se informa el tiempo de espera. El código aclara explícitamente que este freno solo protege contra "probar a mano" desde la interfaz, no contra un atacante que extraiga la base de datos y ataque el verificador sin conexión (para eso está la contraseña maestra de la Bóveda, con PBKDF2 de 600.000 iteraciones).
4. Mensaje de error genérico según el método: *"Patrón incorrecto."* / *"Contraseña incorrecta."*

**"¿Olvidaste tu código de desbloqueo?" (`restablecerBloqueoApp`, `bloqueoApp.ts:219-227`):** un enlace despliega la explicación *"Puedes cerrar sesión para quitar el bloqueo. Para volver a entrar necesitarás la contraseña de tu cuenta. Tu información no se pierde: se recupera al iniciar sesión de nuevo."* con botón "Cerrar sesión y quitar el bloqueo". Esto ejecuta `restablecerBloqueoApp()` (borra `db.seguridadApp` **sin pedir el secreto**) seguido de `cerrarSesion()`. El código documenta por qué es seguro: borrar el bloqueo local y cerrar la sesión a la vez no da acceso a nada, porque para volver a entrar hace falta autenticarse con la contraseña real de la cuenta.

**Cambiar el bloqueo (`cambiarBloqueoApp`, `bloqueoApp.ts:184-205`):** exige primero el secreto actual — evita que alguien con el teléfono ya desbloqueado lo cambie sin conocerlo. Si el actual es incorrecto: *"El código actual no es correcto."* Permite cambiar de método (de patrón a contraseña o viceversa) y pide el secreto nuevo con confirmación doble. Al aplicar, se genera un verificador nuevo, se limpia `bloqueadoHasta` y se resetea `intentosFallidos`.

**Quitar el bloqueo (`quitarBloqueoApp`, `bloqueoApp.ts:208-217`):** también exige el secreto actual; si coincide, borra la fila de `db.seguridadApp` por completo (el dispositivo deja de pedir desbloqueo).

**Autobloqueo, dos disparadores (`bloqueoApp.ts:32, 250-282`):**
1. **Inactividad:** mismo patrón que la Bóveda — el temporizador se reinicia con `pointerdown` o `keydown` en `document` (captura); al agotarse el tiempo configurado, se llama `bloquearApp()`.
2. **Retorno de segundo plano** (`alCambiarVisibilidad`, `bloqueoApp.ts:271-282`): al pasar `document.visibilityState` a `'hidden'` se guarda el instante; al volver a visible, si transcurrió más tiempo que `minutosAutobloqueo`, se bloquea de inmediato; si transcurrió menos, se reinicia el temporizador normal. Esto cubre el caso del móvil que conserva la página en memoria al cambiar de app, sin disparar una recarga completa.

También existe el botón manual "Bloquear ahora" en `SeguridadPage`.

**Guardar / Cancelar:** cada subflujo de `SeguridadPage` (crear, cambiar, quitar) tiene su propio botón "Cancelar" que vuelve al panel principal sin aplicar cambios, y "Continuar"/"Confirmar" para avanzar al siguiente paso.

**Tabla resumen de independencia entre las 3 capas de seguridad:**

| Capa | Ámbito | Sincronizada | Protege | Recuperable si se olvida |
|---|---|---|---|---|
| Sesión de inicio (login) | Cuenta | N/A (Supabase Auth) | Acceso a la app en general | Sí, flujo estándar de la cuenta |
| Bloqueo de la app (patrón/contraseña) | Un dispositivo | No | Que alguien tome el teléfono desbloqueado y navegue | Cerrar sesión (sin necesitar el secreto) y volver a iniciar sesión |
| Contraseña maestra de la Bóveda | Todo el equipo (una sola, compartida) | Sí (verificador en `boveda_meta`) | El contenido cifrado de credenciales y campos protegidos | **No** — sin la contraseña, el contenido cifrado es irrecuperable |
### 3.11 Ubicaciones (`/ubicaciones`) y Personas (`/personas`)

Dos módulos gemelos y de estructura paralela: Ubicaciones es jerárquica (árbol de lugares físicos), Personas es plana (sin padre). Ambos comparten patrón de pantallas, panel de creación inline, ficha 360, migración asistida desde texto libre y las mismas reglas (y los mismos huecos) de integridad al eliminar.

#### 1. Jerarquía y rutas

| Ruta | Componente | Descripción |
|---|---|---|
| `/ubicaciones` | `UbicacionesPage.tsx` | Lista con árbol jerárquico |
| `/ubicaciones/nueva` | `UbicacionForm.tsx` | Crear (admite `?padre=<id>` para precargar el padre) |
| `/ubicaciones/:id/editar` | `UbicacionForm.tsx` | Editar |
| `/ubicaciones/:id` | `UbicacionPage.tsx` | Ficha 360 |
| `/ubicaciones/migrar` | `MigracionUbicaciones.tsx` | Migración asistida |
| `/personas` | `PersonasPage.tsx` | Lista plana |
| `/personas/nueva` | `PersonaForm.tsx` | Crear |
| `/personas/:id/editar` | `PersonaForm.tsx` | Editar |
| `/personas/:id` | `PersonaPage.tsx` | Ficha 360 |
| `/personas/migrar` | `MigracionPersonas.tsx` | Migración asistida |

Rutas registradas de forma perezosa (`lazy`) en `src/App.tsx:100-123`.

**Padre lógico de "Volver" (`src/lib/navegacion.ts`)**: ambas secciones son raíces no-pestaña cuyo padre lógico declarado es `/mas` ("Más") — `RAICES_NO_TAB`, líneas 61-62. El propio código deja constancia de que antes subían al menú "···" de Equipos, y que desde la tarea 182 la puerta real de acceso pasó a ser "Más", por lo que ese es ahora el padre correcto. Dentro de cada sección (`padreDe`, líneas 107-114):
- `/ubicaciones/:id/editar` vuelve a la ficha propia `/ubicaciones/:id` (etiqueta "Volver").
- Cualquier otra ruta de `ubicaciones/*` (crear, migrar, ficha) vuelve a `/ubicaciones` (etiqueta "Ubicaciones").
- Simétrico para `personas/*`, etiqueta "Personas".

Es navegación "Up" declarada (padre lógico fijo), no `history.back()`, para que un enlace profundo o una recarga sepan siempre a dónde subir. Además, `Chasis.tsx` (líneas 279-297) antepone el "origen" real de la sesión (`useOrigen`, tarea 202, regla M-R2) por encima de ese padre declarado: si el técnico llega a `/ubicaciones/:id` tocando la ubicación desde la ficha de un Equipo, "Volver" regresa a ese equipo, no a la lista de Ubicaciones. El override de `padreDe` solo aplica cuando no hay un origen concreto registrado.

Las fichas (`UbicacionPage`, `PersonaPage`) son nivel "documento" del chasis (`modo="documento"`, conservan las pestañas inferiores). Las pantallas de crear/editar y de migración son nivel "tarea" (`modo="tarea"`, sin pestañas, con `BarraTarea` y una "×" de salida) — `UbicacionForm.tsx:71-80`, `PersonaForm.tsx:52-61`, `MigracionUbicaciones.tsx:88-102`.

#### 2. Componentes e interfaz

**Listados (`UbicacionesPage.tsx` / `PersonasPage.tsx`, mismo patrón)**

| Elemento | Etiqueta exacta | Comportamiento |
|---|---|---|
| Botón cabecera | "Crear" (ícono `Plus`) | Alterna (`alternarCrear`) un panel inline de creación rápida arriba de la lista; limpia el formulario al abrir/cerrar |
| Buscador | placeholder "Buscar un lugar" / "Buscar una persona" | `<input type="search">`; filtra en cliente, sin distinguir acentos/mayúsculas (`normalizar`, quita diacríticos con `\p{Diacritic}`) |
| Botón borrar búsqueda | ícono `XCircleFill`, `aria-label="Borrar búsqueda"` | Solo visible con `filtro` no vacío; lo vacía |
| Banner de migración (ámbar) | "`N` equipo(s) tiene(n) la ubicación escrita como texto..." / "...un responsable escrito como texto..." | Solo si `porMigrar > 0` y no hay filtro activo; navega a `/ubicaciones/migrar` o `/personas/migrar` |
| Fila de la lista | nombre + contador "`N` equipo(s)" + ícono `CaretRight` | Navega a la ficha (`/ubicaciones/:id` o `/personas/:id`) |
| Estado vacío | "Ningún lugar/persona coincide con la búsqueda." o "Aún no hay ubicaciones/personas registradas." (más sugerencia de migrar si `porMigrar > 0`) | — |

**Panel de creación inline (en ambas listas)**:
- Ubicaciones: campo "Nombre" (placeholder "Piso 2, Rack principal, Caja 3...", `autoFocus`) más chips "Dentro de (opcional)" (chip "Ninguna (raíz)" y un chip por cada ubicación raíz existente, con `aria-pressed`) más botones "Crear ubicación" / "Cancelar". Deshabilitado si `guardando` o si el nombre está vacío (`UbicacionesPage.tsx:149-197`).
- Personas: solo campo "Nombre completo" más botones "Crear persona" / "Cancelar" (`PersonasPage.tsx:126-151`). Sin jerarquía porque Persona no tiene padre.

**Árbol jerárquico de Ubicaciones (exclusivo de esta lista)**: `ordenarConNivel` (`UbicacionesPage.tsx:29-37`) recorre en profundidad (primero las raíces, luego `hijosDirectos` de forma recursiva) y asigna un `nivel` a cada fila. Se representa visualmente con sangría progresiva (`paddingLeft: 8 + nivel*22 px`, línea 225), ícono `House` (con acento de color) en nivel 0 e ícono `MapPin` (gris) en niveles 1 o superiores. No existe expandir/colapsar: el árbol se muestra siempre completo y plano con sangría; al escribir en el buscador se filtra por nombre pero se conserva el nivel de sangría original de cada fila que coincide, sin reconstruir el árbol (línea 76).

**Breadcrumbs y botones de la ficha 360**: ver punto 5 más abajo (comparten metodología con formularios y reglas, se detallan ahí para no duplicar).

#### 3. Formularios y campos

**`UbicacionForm.tsx`**

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Nombre | `input text`, `required` | Obligatorio (asterisco visual) | `''`; en edición se carga de `ubicacion.nombre` tras `useEffect` | Placeholder "Taquilla 2, Bodega, Rack principal...". Botón de envío deshabilitado si `nombre.trim() === ''`; el `required` HTML5 también bloquea el submit nativo. No hay mensaje de error propio en pantalla, solo el estado deshabilitado del botón |
| Dentro de (opcional) | `select` | Opcional | `''` (raíz), o precargado desde `?padre=<id>` en creación (`padreContextual`), o `ubicacion.padreId` en edición | Opciones = `posiblesPadres`: todas las ubicaciones excepto la propia y toda su descendencia (`idsDescendientes`, evita ciclos), listadas por ruta completa (`rutaUbicacion`, ej. "Sede Norte > Área caja"). No hay validación adicional en el formulario porque la exclusión de ciclos ya ocurre al construir la lista de opciones, así que desde la UI no puede seleccionarse un valor inválido |
| Notas (opcional) | `textarea rows=3` | Opcional | `''` | Texto libre, sin validación |
| Motivo del cambio (opcional) | `input text` | Opcional | `''` | Solo aparece en edición (`esEdicion`); se pasa como `motivo` a `guardarRegistro` para quedar registrado en el historial |

Botón principal: "Guardar ubicación" (ícono `FloppyDisk`), cambia a "Guardando..." mientras `guardando`; deshabilitado si `guardando` o si el nombre está vacío. Al enviar ejecuta `guardarRegistro('ubicaciones', {id, nombre: trim, padreId: padreId||null, notas: trim}, motivo.trim())` y navega a `/ubicaciones/:id`. Cancelar usa `salidaEtiqueta="Cancelar y volver"` (el botón "×" de la `BarraTarea`, sale hacia el origen o padre lógico sin guardar). Mientras el registro no llegó todavía de la base (`cargadoInicial=false`) se muestra "Cargando..." en vez del formulario. Si el `ubicacionId` no existe en la base (`ubicacion === null`) se redirige con `<Navigate to="/ubicaciones" replace />`.

**`PersonaForm.tsx`** (estructura idéntica, sin jerarquía)

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Nombre | `input text`, `required` | Obligatorio | `''` / cargado de `persona.nombre` | Placeholder "Juan Pérez". Botón deshabilitado si está vacío; `required` HTML5 |
| Notas (opcional) | `textarea rows=3` | Opcional | `''` | Placeholder "Cargo, área, extensión...", sin validación |
| Motivo del cambio (opcional) | `input text` | Opcional | `''` | Solo aparece en edición |

Botón: "Guardar persona"; guarda `{id, nombre: trim, notas: trim}` en la tabla `personas` y navega a `/personas/:id`. Mismo patrón de `cargadoInicial`, `Navigate` si `persona === null`, y "Cancelar y volver".

> **Hallazgo/discrepancia de validación**: en ninguno de los dos formularios hay mensajes de error en texto libre (del tipo "Este campo es obligatorio"). La única retroalimentación de que falta el Nombre es el botón deshabilitado y el atributo `required` nativo del navegador — no hay texto de error en línea junto al campo.

**Selector embebido `SelectorUbicacion.tsx` / `SelectorPersona.tsx`** (usado dentro de `DispositivoForm.tsx`, confirmado por grep en las líneas 456-476 de ese archivo, en las secciones "Ubicación" y "Responsable" del formulario de Equipo)

| Campo | Tipo | Obligatorio/Opcional | Valor inicial | Comportamiento/validación |
|---|---|---|---|---|
| Selector principal | `<select>` único (no dropdown con búsqueda tipeada, no modal, no navegación) | Opcional | Depende de `valorSelect` (ver abajo) | Opciones: 1) "Sin ubicación" / "Sin responsable" (valor `''`); 2) una opción por cada entidad existente ordenada por ruta completa (Ubicación, ej. "Sede Norte > Área caja > Taquilla 2") o alfabéticamente (Persona, sin jerarquía); 3) "Otra (escribir manualmente)" (valor especial `__texto__`); 4) "+ Crear ubicación nueva" / "+ Crear persona nueva" (valor especial `__nueva__`) |
| Campo de texto libre ("Otra") | `input text` | Opcional | vacío | Aparece bajo el `<select>` al elegir "Otra (escribir manualmente)", placeholder "Escribe la ubicación" / "Escribe el nombre del responsable". Al usarlo se llama `onChange(null, texto)`: se suelta el `id` vinculado (queda `null`) pero se conserva el texto como copia de referencia. Es el mecanismo pensado para trabajar offline o antes de migrar |
| Mini-formulario "+ Crear... nueva" — Nombre | `input text`, `autoFocus` | Obligatorio (implícito, botón "Crear y usar" opera sobre él) | vacío | "Nombre de la ubicación" / "Nombre de la persona"; se despliega debajo del `<select>` sin modal ni navegación (líneas 109-152 en Ubicación, 111-142 en Persona) |
| Mini-formulario — Dentro de (opcional, solo Ubicación) | `<select>` secundario | Opcional | `''` | Mismas opciones que el árbol completo de "Dentro de" del formulario grande |
| Mini-formulario — botones | "Crear y usar" / "Cancelar" | — | — | "Crear y usar" ejecuta `crear()` (líneas 68-84 / 76-86): genera `id = nuevoId()`, llama `guardarRegistro('ubicaciones'\|'personas', {...})` (persiste ya en Dexie/cola de sync) e invoca de inmediato `onChange(id, nombre)` sobre el estado del `DispositivoForm` padre; luego colapsa el mini-formulario (`setCreando(false)`) y el `<select>` principal queda mostrando la entidad recién creada como seleccionada. "Cancelar" solo colapsa `creando=false` y limpia los campos locales (`nombreNueva`, `padreNueva`); no afecta la selección previa del `<select>` principal |

Texto de ayuda fijo bajo el selector: "Elige un lugar registrado para conectarlo con su ficha, o escríbelo a mano." / "Elige a quién tiene asignado este equipo para conectarlo con su ficha, o escríbelo a mano."

Cálculo del valor mostrado (`valorSelect`): si el `ubicacionId`/`responsableId` actual apunta a una fila que sigue existiendo (no eliminada, ver punto 5) se muestra esa opción seleccionada; si hay copia de texto sin id válido, se muestra "Otra"; si no hay nada, queda vacío ("Sin ubicación"/"Sin responsable").

#### 4. Relaciones y reutilización de datos

- **`Dispositivo.ubicacionId` / `Dispositivo.responsableId`**: son la relación directa entre Equipo y Ubicación/Persona. La dirección de lectura es inversa a la de otros módulos: es Ubicación/Persona la que resuelve "qué equipos hay aquí/asignados a mí" mirando hacia `dispositivos`, y no al revés.
- **"Contiene" / "Equipos en este lugar" / "Equipos asignados"** en la ficha 360 (ver punto 5) son esa resolución inversa, calculada en cada render, no una tabla de relación aparte.
- **Migración asistida (ambos módulos)**, `migracion.ts` más `MigracionUbicaciones.tsx` / `MigracionPersonas.tsx`:
  - **Ubicaciones**: detecta dispositivos no eliminados con `ubicacion` (texto) no vacío y sin `ubicacionId` todavía (`necesitaMigrar`, `migracion.ts:25-27`) — el texto libre que el campo fijo `Dispositivo.ubicacion` conservaba de antes de existir la entidad. Deduplica sin distinguir mayúsculas/espacios (`claveUbicacion`), agrupando por ejemplo "Taquilla Norte" con "taquilla  norte". El usuario ve, por cada texto distinto, la cantidad de equipos y un `<input>` editable con el "nombre final" propuesto (precargado con el texto original); renombrar dos textos al mismo nombre final los fusiona automáticamente (agrupado en tiempo real con `useMemo`); dejar el campo en blanco omite ese texto (`construirMigracion` filtra `g.nombre.trim() !== ''`). Resumen antes de aplicar: "Se crearán N ubicación(es) y se vincularán N equipo(s)." Al aplicar (`aplicar()`): primero `guardarRegistro('ubicaciones', ...)` por cada ubicación nueva, siempre con `padreId: null` (siempre se crean como raíz durante la migración, sin jerarquía asignada), luego actualiza cada dispositivo migrado con `ubicacionId` más `ubicacion` (nombre canónico) vía `guardarRegistro('dispositivos', {...spread completo...})`. El texto original se sobreescribe con el nombre canónico final (no se pierde el campo, pasa a ser la copia de referencia); es idempotente porque una vez migrado ya no "necesita migrar" (tiene `ubicacionId`). Salida: "Salir sin migrar" no aplica nada; si no quedan textos pendientes la pantalla se auto-redirige a `/ubicaciones` sin mostrar contenido.
  - **Personas**: diferencia clave respecto a Ubicaciones — el texto no vive en un campo fijo del dispositivo sino como una clave cualquiera dentro de la bolsa libre `Dispositivo.detalles`. `candidatosPersona` escanea cada dispositivo sin `responsableId` buscando la primera clave de `detalles` que coincida (normalizada, sin acentos/mayúsculas) con una lista de alias candidatos: `usuario asignado`, `responsable`, `responsable del equipo`, `asignado a`, `asignado`, `empleado`, `encargado`, `persona asignada`, `usuario` (`migracion.ts:19-29`, en ese orden de prioridad si un dispositivo tuviera más de una coincidencia). Mismo patrón de UI que Ubicaciones (lista de textos distintos con cantidad, input editable, fusión automática, vaciar para omitir). Al aplicar: crea personas (`guardarRegistro('personas', {id, nombre, notas:''})`) y, por cada dispositivo migrado, retira la clave original de `detalles` (`const { [claveDetalle]: _omitida, ...detallesSinClave } = d.detalles`) además de fijar `responsableId` más `responsable`. Aquí sí se limpia el dato de origen para no dejarlo duplicado, a diferencia de Ubicaciones, donde el campo de origen (`ubicacion`) se reutiliza como copia de referencia y nunca se "retira" de ningún sitio porque siempre fue un campo fijo y no una clave de la bolsa libre.
- **Ficha 360**:
  - `UbicacionPage.tsx`: breadcrumbs (migas de pan) de ancestros, cada una navegable a su propia ficha, separadas por "›" (líneas 79-90; el título grande y el ancestro superior quedan anclados arriba al hacer scroll, regla M-R1). Acciones: "Sub-ubicación" (ícono `Plus`, enlace a `/ubicaciones/nueva?padre=<id>`, precarga el padre), "Renombrar" (ícono `PencilSimple`, enlace a `/ubicaciones/:id/editar`), "Eliminar" (ícono `TrashSimple`, abre `DialogoEliminar`). Sección "Notas" solo se muestra si `ubicacion.notas` no está vacío. Sección "Contiene": lista de `hijosDirectos(ubicacionId, ubicaciones)` (sub-ubicaciones inmediatas, cada una enlazada a su ficha; se oculta si no hay ninguna). Sección "Equipos en este lugar": dispositivos con `d.ubicacionId === ubicacionId` (no eliminados), ordenados por nombre, cada fila enlaza a `/dispositivos/:id` mostrando nombre más IP si existe; si no hay ninguno, "Ningún equipo tiene esta ubicación." Historial (`<Historial entidadTipo="ubicacion" entidadId={ubicacionId} />`): línea de tiempo de cambios sobre esa ficha.
  - `PersonaPage.tsx` (simétrica, sin jerarquía): acciones solo "Editar" y "Eliminar" (no existe "Sub-persona"). Sección "Equipos asignados": dispositivos con `d.responsableId === personaId`. Historial con `entidadTipo="persona"`.
  - Ambas fichas: si el id no existe en la base, `<Navigate to="/ubicaciones|/personas" replace />`; mientras carga (`persona`/`ubicacion === undefined`), "Cargando...".

#### 5. Comportamientos y reglas de negocio

**Comportamiento exacto del selector embebido (sin remount, preserva el formulario padre)**: al elegir "+ Crear ubicación nueva" / "+ Crear persona nueva" en `SelectorUbicacion`/`SelectorPersona`, no se abre un modal ni se navega a `/ubicaciones/nueva`; se activa un estado local `creando=true` del propio componente que despliega el mini-formulario descrito en el punto 3, dentro de la misma pantalla y el mismo árbol de React. Al pulsar "Crear y usar", la entidad se persiste de inmediato en Dexie/la cola de sincronización y `onChange(id, nombre)` fija `ubicacionId`/`responsableId` y el texto de copia directamente en el estado del `DispositivoForm` padre. Mientras tanto, el resto del formulario de Equipo se preserva íntegramente: no hay navegación de página, no hay modal que lo tape, no hay pérdida de foco de contexto. Los demás campos del `DispositivoForm` (nombre, marca, categoría, IP, etc.) viven en el estado de React del componente padre y no se tocan ni se remontan en ningún momento de este flujo — funcionalmente, es la relación más segura posible entre módulos: crear la entidad relacionada no interrumpe ni arriesga el trabajo ya escrito en el formulario que la originó.

**Migración asistida**: ver el desglose completo en el punto 4. En síntesis, ambos módulos convierten texto libre histórico (`Dispositivo.ubicacion` para Ubicaciones, claves alias dentro de `Dispositivo.detalles` para Personas) en entidades reales con id, de forma agrupable, editable, omitible y — en el caso de Ubicaciones — idempotente.

**Hallazgo de integridad — eliminar NO limpia referencias en Dispositivo ni re-parenta sub-ubicaciones** (confirmado por código, `eliminarRegistro`, `src/lib/repositorio.ts:72-95`):
- `eliminarRegistro` es un borrado lógico (soft delete): solo pone `eliminadoEn = ahora` en la fila de la ubicación/persona y la deja en la base. Nunca hace un `delete` real ni toca ninguna otra tabla ni fila.
- `DialogoEliminar` en Ubicaciones y Personas no exige contraseña maestra (`sensible` no se pasa como `true` en ninguna de las dos fichas, a diferencia de dispositivos/credenciales); es una confirmación simple.
- El diálogo muestra un aviso previo calculado por la propia página (no por el sistema de eliminación): en Ubicaciones cuenta cuántos equipos (`d.ubicacionId === id`) y cuántas sub-ubicaciones directas quedarán afectados ("`N` equipo(s) y `M` sub-ubicación(es) quedarán sin este vínculo."); en Personas, "`N` equipo(s) quedarán sin este vínculo." Este aviso no bloquea la eliminación, solo informa.
- Lo que el código realmente hace (y lo que no hace): `eliminarRegistro('ubicaciones'|'personas', id)` únicamente marca `eliminadoEn` en la fila eliminada. No limpia `dispositivos.ubicacionId`/`responsableId` de los equipos que apuntaban a ella, y no reasigna ni limpia `padreId` de sus sub-ubicaciones. El texto del diálogo ("perderán el enlace a esta ficha") describe el efecto observado en pantalla, no una operación explícita de limpieza de esos campos.
- Por qué el enlace "se pierde" igual en la práctica: todas las funciones de lectura que resuelven el vínculo filtran las entidades eliminadas (`mapaPorId`, `arbol.ts:7-9`, excluye `eliminadoEn`), y tanto `SelectorUbicacion` como `SelectorPersona` calculan `existeVinculada = ubicacionId ? porId.has(ubicacionId) : false`. Como la fila eliminada ya no está en `porId`, `existeVinculada` da `false` y el selector cae a mostrar "Otra (escribir manualmente)" con el último texto de copia conocido. El `ubicacionId`/`responsableId` crudo sigue almacenado en el dispositivo, apuntando a una fila borrada (huérfano), simplemente deja de resolverse como vínculo activo en toda la UI que usa estos helpers.
- Qué pasa con la jerarquía si se elimina un padre de Ubicaciones: no hay reasignación ni "adopción" de los hijos. `hijosDirectos(padreId, ubicaciones)` filtra `!u.eliminadoEn` sobre cada candidato pero no verifica si el `padreId` referenciado sigue vivo. Efecto observado: `ordenarConNivel` de `UbicacionesPage` construye el árbol recorriendo primero las raíces (`hijosDirectos(null, ...)`) y bajando de forma recursiva; si el nodo eliminado era una raíz o un nodo intermedio, deja de aparecer en el recorrido (está `eliminadoEn`) y por lo tanto sus hijos, cuyo `padreId` sigue apuntando a él, nunca son visitados por la recursión y desaparecen silenciosamente de la lista/árbol, aunque sus filas sigan existiendo en la base con un `padreId` huérfano. Esos hijos siguen siendo accesibles por URL directa (`/ubicaciones/:id`) y su ficha se ve normalmente, pero `cadenaUbicaciones` (usada para las migas de pan) corta el recorrido al llegar al ancestro eliminado (`porId.get(actual)` devuelve `undefined` y el bucle hace `break`), así que la ficha del hijo huérfano queda sin ninguna miga de pan (contexto "Ubicaciones" por defecto). No existe en el código ningún flujo de "reasignar hijos" o "adoptar al abuelo" al eliminar un padre.
- Nada de esto bloquea la eliminación: cualquier ubicación o persona puede eliminarse aunque tenga equipos o sub-ubicaciones vinculados; el sistema solo informa, nunca impide.

**Hallazgo de documentación — componentes compartidos no usados en estos módulos**: los componentes `HojaFiltro.tsx`, `FilaDato.tsx`, `CabeceraColapsable.tsx` y `SeccionPlegable.tsx` no se usan en ningún archivo de `features/ubicaciones` ni `features/personas` (confirmado por `grep` sin resultados). El buscador y el árbol/lista de estos dos módulos se construyen con markup propio e inline directamente en `UbicacionesPage.tsx`/`PersonasPage.tsx`, sin reutilizar esos primitivos de UI que sí están documentados en `COMPONENTES_UI.md`. Si la documentación de componentes describe a estos cuatro como usados en Ubicaciones o Personas, es una discrepancia que debe corregirse ahí.

**Otras reglas puntuales confirmadas por código**:
- La creación de ubicaciones vía migración asistida siempre las crea como raíz (`padreId: null`); solo la creación manual (panel de la lista, botón "Sub-ubicación" de la ficha, o el selector inline) permite fijar un padre.
- `Persona` (`db.ts:54-58`) no tiene `padreId`, sin jerarquía, a diferencia de `Ubicacion` (`db.ts:40-48`).
- Guardar/Cancelar/×/Escape: en los formularios de crear/editar (nivel "tarea" del chasis), "Guardar ubicación"/"Guardar persona" es el único submit; la "×" de la `BarraTarea` (`salidaEtiqueta="Cancelar y volver"`) navega al padre lógico sin persistir cambios, sin confirmación de "¿descartar cambios?" (`Chasis.tsx` prevé un `alSalir` opcional para eso, pero ni `UbicacionForm` ni `PersonaForm` lo usan). En migración, "×" equivale a `salidaEtiqueta="Salir sin migrar"` y no aplica nada. En el panel de creación inline de las listas, "Cancelar" limpia y colapsa el panel (`alternarCrear`), sin tecla dedicada. `DialogoEliminar` (modal, `Modal.tsx`) se cierra con Escape (listener global `keydown`, `Modal.tsx:19-21`) o tocando fuera de la tarjeta; el botón de confirmar es "Eliminar", pasa a "Eliminando..." mientras `ocupado`. En el selector inline, "Crear y usar"/"Cancelar" son botones normales dentro del formulario, sin atajo de teclado propio (Escape no está interceptado ahí, a diferencia del `Modal`).
### 3.12 Mi Cuenta, Login y "Más" (`/cuenta`, `/login`, `/mas`)

#### 3.12.1 Jerarquía y rutas

- `LoginPage.tsx`, ruta `/login`, **fuera** de la zona autenticada (no usa `Chasis`).
- `CuentaPage.tsx`, ruta `/cuenta`, nivel `documento`, alcanzable desde el avatar de `BarraSuperior`, desde el grupo "Mi cuenta" de `PantallaMas`, y desde `RAICES_NO_TAB` como destino de la mayoría de rutas sin padre declarado.
- `SeguridadPage.tsx`, ruta `/cuenta/seguridad`, nivel `documento`, hija lógica de `/cuenta` (ver `padreDe`, 3.1.2).
- `PantallaMas.tsx`, ruta `/mas`, nivel `seccion`, quinta pestaña móvil.
- `BloqueoAppGuard.tsx` no tiene ruta propia: envuelve todas las rutas autenticadas y sustituye cualquier pantalla por `PantallaBloqueo` cuando corresponde.

Flujo típico de entrada: `Login` (sin sesión) → cualquier ruta autenticada (con sesión, si no hay bloqueo de dispositivo o ya está desbloqueado) → `BloqueoAppGuard` intercepta primero si hay bloqueo configurado y no desbloqueado en esta apertura.

#### 3.12.2 `AuthProvider.tsx` / `authContext.ts` — sesión de la cuenta

Contexto `AuthContext` con la forma `{ cargando, session, perfil, iniciarSesion, cambiarContrasena, cerrarSesion }`. `perfil` es un snapshot cargado una sola vez al cambiar `session` (desde `db.perfiles`, tabla sincronizada); las pantallas que necesitan reactividad en vivo (por ejemplo, si `puedeVerBoveda` cambia desde otro dispositivo) usan además `usePerfilVivo()` (`useLiveQuery` sobre `db.perfiles.get(session.user.id)`).

- `iniciarSesion(correo, contrasena)`: llama a `supabase.auth.signInWithPassword`; devuelve `null` si tuvo éxito, o el mensaje ya traducido (`traducirErrorAuth`) si falla.
- `cambiarContrasena(actual, nueva)`: **primero reverifica la contraseña actual** con un `signInWithPassword` extra (evita que alguien con el teléfono ya desbloqueado la cambie sin conocerla realmente), y solo después llama a `supabase.auth.updateUser({ password: nueva })`.
- `cerrarSesion()`: únicamente `supabase.auth.signOut()` — **no borra la base local** (puede haber cambios sin subir; se asume un equipo de confianza donde cada quien usa su propio teléfono).
- Al recibir una sesión nueva (`onAuthStateChange`), dispara `sincronizar()` de inmediato, sin esperar al siguiente intervalo o evento de red.

`RequireAuth.tsx`: renderiza `<Outlet/>` si hay sesión; `<Navigate to="/login" replace/>` si no la hay; `<Cargando/>` mientras `cargando` es verdadero.

#### 3.12.3 Login (`LoginPage.tsx`, ruta `/login`)

**Presentación**: glifo `Marca` en un cuadro de 52×52 con borde de acento, título "Soluciones IT", subtítulo fijo "La base de conocimiento del equipo de soporte y mantenimiento de TI." (deliberadamente sin nombrar la organización). Si `!supabaseConfigured`, aviso ámbar: "La aplicación aún no está conectada al servidor. Falta configurar las variables de entorno de Supabase."

**Formulario de inicio de sesión:**

| Campo | Tipo | Obligatorio | Valor inicial | Comportamiento / validación |
|---|---|---|---|---|
| Correo | `<input type="email">`, `autoComplete="username"`, `inputMode="email"`, `autoCapitalize="off"`, `spellCheck={false}` | Sí (`required` HTML) | `''` | Placeholder "tu@correo.com". Se envía con `trim()`. **Sí se autocompleta** a propósito (decisión aprobada el 2026-07-28): escribirlo entero cada vez en un teclado móvil no aporta ninguna protección real. |
| Contraseña | `CampoContrasena` (input enmascarado por CSS para que el gestor de contraseñas del sistema no reconozca el formulario como un login) | Sí | `''` | `id="login-contrasena"`, etiqueta compartida en la misma fila con el enlace "¿La olvidaste?". |

- Botón **"Ingresar"** (52px de alto), `disabled` mientras `enviando || !supabaseConfigured`; el texto pasa a "Ingresando...".
- Un error de servidor se muestra con `role="alert"` bajo el formulario, con el mensaje ya traducido al español por `traducirErrorAuth` (ver 3.12.4).
- Nota fija bajo el botón: "¿Sin cuenta? Pídesela al administrador de la app. Todo queda guardado en este teléfono, así que funciona sin señal."
- **"¿La olvidaste?"** (botón de texto, con zona táctil real de 44px lograda con relleno y margen negativo) abre un **modal** "Olvidé mi contraseña": explica que la app **no envía correos de recuperación** (decisión del usuario, 2026-07-28) — hay que pedirle al administrador una contraseña nueva desde el panel de Supabase — y aclara explícitamente que el bloqueo del teléfono (patrón/contraseña de dispositivo) es un flujo distinto, que se resuelve en su propia pantalla (ver 3.12.6). Botón "Entendido" cierra el modal.
- Si ya existe una sesión activa (`session` y `!cargando`), la página redirige a `/` (`<Navigate to="/" replace/>`).

#### 3.12.4 `erroresAuth.ts` — traducción y validación

`traducirErrorAuth(mensaje)` mapea, por expresión regular, los mensajes de Supabase Auth al español:

| Patrón detectado | Mensaje traducido |
|---|---|
| `invalid login credentials` | "Correo o contraseña incorrectos." |
| `email not confirmed` | "La cuenta aún no fue confirmada." |
| `new password should be different` | "La nueva contraseña debe ser distinta de la actual." |
| `password should be at least (\d+)` | "La contraseña debe tener al menos {N} caracteres." (el mínimo real lo decide el servidor) |
| `rate limit` / `too many requests` | "Demasiados intentos seguidos. Espera un momento y vuelve a intentar." |
| `fetch` / `network` | "Sin conexión con el servidor. Intenta de nuevo." |
| Cualquier otro | Se devuelve el mensaje original de Supabase, sin traducir |

`MINIMO_CARACTERES_CONTRASENA = 8` — deliberadamente más alto que el mínimo de 6 que exige Supabase por defecto, "por ser cuentas compartidas con acceso a la bóveda del equipo".

`validarCambioContrasena(actual, nueva, confirmacion)` — validación local, ejecutada antes de tocar el servidor:

1. `!actual` → "Escribe tu contraseña actual."
2. `nueva.length < 8` → "La nueva contraseña debe tener al menos 8 caracteres."
3. `nueva !== confirmacion` → "Las contraseñas no coinciden."
4. `nueva === actual` → "La nueva contraseña debe ser distinta de la actual."

#### 3.12.5 Mi Cuenta (`CuentaPage.tsx`, ruta `/cuenta`, nivel `documento`)

Cabecera propia bajo la fila de regreso: "Mi cuenta" + `{perfil.nombre} · {session.user.email}` (se muestra cualquiera de los dos datos que exista).

**Formulario "Cambiar contraseña de inicio de sesión"** (requiere conexión a internet; aviso explícito en el propio formulario):

| Campo | Tipo | Obligatorio | Valor inicial | Validación / mensaje de error |
|---|---|---|---|---|
| Contraseña actual | `CampoContrasena` | Sí (`required`) | `''` | Ver `validarCambioContrasena`, punto 1 (3.12.4). |
| Nueva contraseña | `CampoContrasena` | Sí | `''` | Mínimo 8 caracteres (3.12.4, punto 2). |
| Confirmar la nueva contraseña | `CampoContrasena` | Sí | `''` | Debe coincidir con "Nueva contraseña" (3.12.4, punto 3). |

- Botón **"Cambiar contraseña"** (`disabled` mientras `guardando`, el texto pasa a "Cambiando...").
- Al enviar: valida localmente con `validarCambioContrasena`; si pasa, llama a `cambiarContrasena(actual, nueva)` del contexto de autenticación, que a su vez reverifica `actual` contra el servidor antes de aplicar el cambio (ver 3.12.2).
- Error mostrado con `role="alert"`; éxito con `role="status"`: "Contraseña actualizada. Úsala la próxima vez que inicies sesión." — y los tres campos del formulario se limpian.

**Tarjeta "Instalar la app en este dispositivo"**: visible solo si `!instalacion.instalada`. Es el segundo de los dos únicos sitios de toda la app que ofrecen instalar la PWA (el otro es `BienvenidaPrimerDia`, ver 3.2.4); nunca se ofrece como banner intrusivo. Contiene `<BotonInstalarApp />` (ver 3.1.4).

**Enlace "Seguridad de la aplicación"** → navega a `/cuenta/seguridad`, con subtítulo "Bloqueo de este dispositivo con patrón o contraseña, para que nadie entre con solo tomar el teléfono."

**Botón "Cerrar sesión"** (icono `SignOut`): llama a `cerrarSesion()` del contexto (3.12.2). Antes de la reforma del chasis (tarea 185) este botón solo vivía en la cabecera de un layout heredado; al retirar esa pantalla del sistema no quedaba ningún sitio desde donde cerrar sesión, por lo que se sumó aquí.

#### 3.12.6 Seguridad de la aplicación (`SeguridadPage.tsx`, ruta `/cuenta/seguridad`, nivel `documento`)

Configura el bloqueo de **este dispositivo** (patrón o contraseña, **nunca biometría** — decisión de diseño explícita: "es un dato personal sensible que no todos quieren entregar", `bloqueoApp.ts:22-23`). Es una capa de **acceso**, no de cifrado: no reemplaza ni sustituye la contraseña maestra de la bóveda. El estado desbloqueado vive solo en memoria (recargar la página o reabrir la app siempre vuelve a pedir el desbloqueo). El secreto en sí nunca se guarda: solo un "verificador" cifrado con AES-GCM (`crypto.ts`, fuera de alcance) que se descifra correctamente únicamente si el secreto introducido es el correcto.

**Estado no configurado (`PanelSinConfigurar`)**: aviso más un selector de método (**Patrón** / **Contraseña**) que lleva a `CrearSecreto`.

**Formulario `CrearSecreto`** — captura con confirmación en dos pasos:

| Paso | Validación (`validarSecreto`) | Mensaje de error |
|---|---|---|
| 1. Captura | Si `metodo === 'contrasena'`: `secreto.length >= MIN_LONGITUD_CONTRASENA_APP` (= **4**) | "La contraseña debe tener al menos 4 caracteres." |
| 1. Captura | Si `metodo === 'patron'`: `contarNodosSerializados(secreto) >= MIN_NODOS_PATRON` (= **4**, según la etiqueta del formulario "Dibuja el patrón nuevo (une al menos 4 puntos)") | "El patrón debe unir al menos 4 puntos." |
| 2. Confirmación | El segundo valor debe coincidir exactamente con el primero | "Los patrones no coinciden." / "Las contraseñas no coinciden." (y `primero` vuelve a `null`, reiniciando el flujo) |

Al completar ambos pasos, se llama a `configurarBloqueoApp(metodo, secreto)`.

**`configurarBloqueoApp`** (`bloqueoApp.ts:113-135`): valida el secreto, comprueba que no exista ya un bloqueo configurado ("El bloqueo ya está configurado en este dispositivo."), crea el verificador (PBKDF2 + AES-GCM), guarda `ConfigBloqueoApp` (con `minutosAutobloqueo` por defecto = 5), y **deja la app desbloqueada de inmediato** (quien lo configuró acaba de demostrar que conoce el secreto).

**Estado configurado (`PanelConfigurado`)**: tarjeta "Bloqueo activo" con el método vigente, botón **"Bloquear ahora"** (`bloquearApp()` inmediato), selector **"Autobloqueo por inactividad"** (`<select>`, opciones `OPCIONES_AUTOBLOQUEO_APP_MIN = [1, 5, 15, 30]` minutos, aplica el cambio con `definirMinutosAutobloqueoApp`), y dos botones: **"Cambiar"** y **"Quitar bloqueo"**.

**`FlujoCambiar`**: pide primero el secreto actual (`EntradaSecreto`), luego el método nuevo, y finalmente `CrearSecreto` para el secreto nuevo (con confirmación como en la tabla anterior). Llama a `cambiarBloqueoApp(actual, metodoNuevo, secretoNuevo)`:
- Si `actual` no coincide con el verificador guardado → "El código actual no es correcto."
- Si el secreto nuevo no pasa `validarSecreto` → mismo mensaje que en la creación.
- Si todo pasa, reemplaza método y verificador, y limpia `bloqueadoHasta`.

**`FlujoQuitar`**: pide el secreto actual y llama a `quitarBloqueoApp(secreto)` — mismo chequeo de coincidencia ("El código actual no es correcto."); si pasa, ejecuta `db.seguridadApp.delete(ID_BLOQUEO_APP)`.

**Freno de fuerza bruta** (`bloqueoApp.ts:35-41, 172-179`): tras `UMBRAL_INTENTOS = 5` fallos consecutivos en `desbloquearApp`, se impone un `bloqueadoHasta` de `COOLDOWN_MS = 30000` ms (30 segundos), con mensaje "Demasiados intentos. Espera N segundos e inténtalo de nuevo." Un intento correcto reinicia el contador de fallos a 0.

**Autobloqueo por inactividad** (`instalarAutobloqueo` / `reiniciarTemporizador`): un temporizador se reinicia en cada `pointerdown`/`keydown` (capturados en fase de captura, `true`); al vencer los `minutosCache` minutos sin actividad, llama a `bloquearApp()`. Además, `alCambiarVisibilidad` detecta cuando la pestaña vuelve de segundo plano (`visibilitychange`): si estuvo oculta más tiempo que el autobloqueo configurado, bloquea de inmediato; si estuvo oculta menos tiempo, solo reinicia el temporizador (cubre el caso móvil típico donde la página se conserva en memoria sin recargarse).

#### 3.12.7 `BloqueoAppGuard.tsx` — la pantalla de bloqueo en sí

Envuelve **todas** las rutas autenticadas (`App.tsx:153-159`). Comportamiento según estado:
- `config === undefined` → `<Cargando/>`.
- `config === null` (sin bloqueo configurado) → `<Outlet/>` directo.
- `desbloqueada` (store en memoria) → `<Outlet/>`.
- Cualquier otro caso → `<PantallaBloqueo metodo={config.metodo}>`.

**`PantallaBloqueo`**: glifo `LockSimple`, título "Soluciones IT", subtítulo según el método configurado ("Dibuja tu patrón para continuar" / "Ingresa tu contraseña de desbloqueo"). Entrada de patrón (`PatronInput`, se reinicia con `reiniciarToken` en cada error) o formulario de contraseña (`CampoContrasena`, con `autoFocus`) con botón **"Desbloquear"** / "Desbloqueando...". Al fallar, muestra `mensajeIncorrecto` ("Patrón incorrecto." / "Contraseña incorrecta.") o el mensaje de cooldown correspondiente; **limpia el campo y reinicia el patrón** en cada intento fallido.

Enlace **"¿Olvidaste tu código de desbloqueo?"** despliega un panel explicativo: "Puedes cerrar sesión para quitar el bloqueo. Para volver a entrar necesitarás la contraseña de tu cuenta. Tu información no se pierde: se recupera al iniciar sesión de nuevo." Botón **"Cerrar sesión y quitar el bloqueo"** llama a `restablecerBloqueoApp()` (borra `seguridadApp` **sin pedir el secreto** — es intencional: esta llamada siempre se combina de inmediato con `cerrarSesion()` a continuación, así que no otorga acceso a nada por sí sola, porque para volver a entrar hará falta la contraseña real de la cuenta).

#### 3.12.8 Pantalla "Más" (`PantallaMas.tsx`, ruta `/mas`, nivel `seccion`)

Quinta pestaña móvil (tarea 182), que reemplazó a `/boveda` como pestaña (la Bóveda sigue siendo una raíz de navegación aparte, alcanzable desde aquí y desde el sidebar de escritorio). Funciona como puerta de acceso a los destinos que antes solo se alcanzaban desde el menú "···" de Equipos, o que no aparecían en ningún sitio evidente para un técnico nuevo.

**Grupos, en orden exacto de aparición:**

| Grupo | Filas | Condición / detalle |
|---|---|---|
| 1. "Consulta protegida" | "Bóveda" → `/boveda`, subtítulo "Claves y credenciales del equipo" | Fila destacada (borde/fondo de acento); **solo si `usuario?.puedeVerBoveda`** |
| 2. "Herramientas" | "Diagnóstico" → `/diagnostico` (subtítulo "Del síntoma a la guía, paso a paso"); "Escanear equipo" → `/escaner` (subtítulo "Abre la ficha por código QR") | Siempre visible |
| 3. "Registros" | "Ubicaciones" → `/ubicaciones` (subtítulo "Sedes, salas y racks · {conteo}"); "Personas" → `/personas` (subtítulo "Responsables de cada equipo · {conteo}"); "Etiquetas QR" → `/dispositivos/etiquetas`; "Importar" → `/dispositivos/importar` (subtítulo "Carga masiva de equipos desde Excel o CSV") | Siempre visible |
| 4. "Mi cuenta" | Fila de perfil (avatar + nombre + correo) → `/cuenta`; "Bloqueo y seguridad" → `/cuenta/seguridad` | Subtítulo dinámico de "Bloqueo y seguridad": "Cargando..." mientras `bloqueo === undefined`, o "`{Contraseña\|Patrón}` de este teléfono · `{activo\|inactivo}`" según `db.seguridadApp` |

Los conteos de Ubicaciones/Personas se calculan con `useLiveQuery` sobre las tablas respectivas: Personas filtra `!eliminadoEn`, pero Ubicaciones **no filtra** las eliminadas en esta consulta en particular (asimetría notada entre ambas consultas, que viven en el mismo archivo, línea 34-35).

#### 3.12.9 Relaciones y reutilización de datos

`CuentaPage` y `PantallaMas` comparten la fila de perfil (avatar + nombre + correo, alimentada por `AuthContext`/`usePerfilVivo`). `SeguridadPage` y `BloqueoAppGuard` comparten la tabla `db.seguridadApp` y el módulo `bloqueoApp.ts` como única fuente de verdad del estado de bloqueo. El botón de instalar (`BotonInstalarApp`) y el progreso de descarga offline se reutilizan idénticos entre `CuentaPage` y `BienvenidaPrimerDia`/`DescargarOffline` (ver 3.1.4 y 3.2.4). El permiso `puedeVerBoveda` del perfil determina tanto la visibilidad de la fila "Bóveda" en `PantallaMas` como el acceso a las fuentes de datos de Pendientes relacionadas con credenciales (3.2.6).

#### 3.12.10 Comportamientos y reglas de negocio

- Cerrar sesión nunca borra datos locales: es una operación exclusivamente de autenticación remota, coherente con el modelo de "equipo de confianza, cada quien su propio teléfono".
- Cambiar la contraseña de la cuenta exige reverificación de la contraseña actual contra el servidor, incluso si el dispositivo ya está en una sesión abierta.
- El bloqueo de dispositivo es completamente independiente de la autenticación de cuenta: son dos secretos distintos, verificados por mecanismos distintos (Supabase Auth vs. verificador local AES-GCM), y la única forma de recuperarse de un olvido del bloqueo es cerrar la sesión de cuenta y volver a entrar con la contraseña real.
- La app nunca ofrece recuperación de contraseña por correo: es una decisión de producto explícita, resuelta siempre por intervención de un administrador desde el panel de Supabase.
- La biometría queda excluida por decisión de diseño explícita del bloqueo de dispositivo, incluso siendo una opción técnicamente disponible en la mayoría de los teléfonos del equipo.
- El freno de fuerza bruta (30 segundos tras 5 fallos) y el autobloqueo por inactividad configurable (1/5/15/30 minutos) son las dos únicas defensas activas del bloqueo de dispositivo; ninguna de las dos aplica a la autenticación de cuenta, que depende enteramente de las políticas del servidor de Supabase.

---

## 4. Catálogo de flujos de usuario

Esta sección documenta, paso a paso, los recorridos completos que un técnico realiza a través de varias pantallas para cumplir una tarea concreta. A diferencia de la sección 3 (que describe cada pantalla por separado), aquí el foco está en la secuencia: pantalla de partida, acción del usuario, reacción del sistema y pantalla siguiente, citando rutas reales y componentes. Cada flujo cierra, cuando el material fuente lo especifica, con una nota sobre qué ocurre si se cancela o se sale a mitad de camino.

### 4.1 Crear un equipo nuevo desde cero, con creación inline de Ubicación y Persona

1. **Pantalla**: lista de Equipos (`DispositivosPage`, `/dispositivos`). **Acción**: el técnico toca el botón "Crear" (ícono `Plus`). **Sistema**: navega a `/dispositivos/nuevo` (`DispositivoForm` en modo alta, nivel de chasis "tarea", rótulo "Creando"). **Pantalla siguiente**: formulario vacío con la ayuda fija "Solo el nombre y la categoría son obligatorios; el resto se puede completar después".
2. **Acción**: escribe el Nombre y elige una Categoría (chips, un único valor activo). **Sistema**: el título de la cabecera se actualiza en vivo con lo escrito; sin estos dos datos el formulario no se considera válido.
3. **Acción**: completa opcionalmente Marca, Modelo, Foto, Serial, Placa de inventario, IP, Estado y Observaciones. **Sistema**: si el Serial coincide con el de otro equipo existente, muestra un aviso no bloqueante con enlace al duplicado; si la IP no tiene formato válido o coincide con la de otro equipo, muestra un aviso equivalente, tampoco bloqueante.
4. **Pantalla**: mismo formulario, campo Ubicación (`SelectorUbicacion`). **Acción**: abre el `<select>` y, como la ubicación todavía no existe, elige la opción "+ Crear ubicación nueva". **Sistema**: despliega un mini formulario inline (campo Nombre con `autoFocus` y un `<select>` opcional "Dentro de") sin navegar ni perder nada de lo ya escrito en el resto del formulario de Equipo.
5. **Acción**: escribe el nombre de la ubicación y, si corresponde, elige un padre; toca "Crear y usar". **Sistema**: genera un id, ejecuta `guardarRegistro('ubicaciones', ...)` (queda persistida en Dexie y encolada para sincronizar de inmediato) y llama `onChange(id, nombre)` directamente sobre el estado del `DispositivoForm` padre: el `<select>` de Ubicación queda mostrando la entidad recién creada como seleccionada, sin remount ni pérdida de foco. El mini formulario se colapsa.
6. **Acción**: repite el mismo mecanismo en el campo Responsable (`SelectorPersona`): elige "+ Crear persona nueva", escribe el Nombre (único campo, sin jerarquía) y toca "Crear y usar". **Sistema**: crea la persona y la selecciona en el `<select>` de Responsable, con el mismo comportamiento sin salir del formulario.
7. **Acción**: opcionalmente abre el bloque plegable "Más información" y añade Observaciones o Propiedades personalizadas (`CamposClaveValor`). **Acción final**: toca "Guardar equipo".
8. **Sistema**: valida que Nombre y Categoría no estén vacíos (si falta alguno, muestra "Falta el nombre o la categoría" en la barra inferior y no guarda). Si es válido, recorta todos los textos, fuerza `ubicacionId`/`responsableId` a `null` si el texto correspondiente quedó vacío tras el recorte, y guarda con `guardarRegistro('dispositivos', ...)`.
9. **Sistema**: navega a la ficha nueva `/dispositivos/{id}`, pasando `state:{recienCreado:true}`. **Pantalla siguiente**: `DispositivoPage` muestra el bloque "¿Qué sigue?" con los pasos pendientes recalculados en vivo (agregar foto, guardar datos de acceso si hay permiso de Bóveda, registrar conexiones, vincular un procedimiento o reportar una incidencia).

**Si se cancela**: la "×"/"Cancelar y volver" de la barra de tarea navega de inmediato sin guardar el equipo, sin ningún diálogo de "¿descartar cambios?". Importante: si ya se creó una Ubicación o Persona nueva de forma inline en los pasos 5 o 6, esa entidad queda persistida igual, porque `guardarRegistro` se ejecutó en el momento de crearla, no al guardar el formulario completo del equipo.

### 4.2 Vincular una credencial de Bóveda a un paso de procedimiento y revelarla durante la ejecución

1. **Pantalla**: `ArticuloForm`, pestaña "Pasos" (`/soluciones/{categoriaId}/nuevo` o `.../{articuloId}/editar`). **Acción**: en la tarjeta de un paso, abre la sección plegable "Vínculos del paso: información protegida, procedimiento o solución". **Sistema**: `VinculoProtegidoDelPaso` muestra un `<select>` con dos grupos: "Datos protegidos del equipo" (campos protegidos de los equipos ya agregados en "Equipos donde aplica" del artículo) y "Secretos de la bóveda" (todas las credenciales vivas). Si no hay ninguna opción disponible (sin permiso de Bóveda ni equipos vinculados), el selector directamente no se muestra.
2. **Acción**: elige una opción del `<select>` (el valor codifica `tipo:id`). **Sistema**: guarda `vinculoProtegido = {tipo, id, etiqueta}` en el paso (referencia viva) y muestra "Información protegida: {etiqueta}" con botón "Quitar".
3. **Acción**: toca "Guardar procedimiento" en la barra inferior. **Sistema**: `guardarRegistro('articulos', ...)` persiste el artículo con el vínculo ya incluido.
4. **Pantalla**: ficha del artículo (`ArticuloPage`), en `ProcedimientoVista`, o en ejecución guiada (`AsistenteVista`, ver flujo 4.9). Al llegar al paso con el vínculo, el sistema muestra dentro de ese paso un botón "Ver dato protegido" (`CredencialEnPaso`).
5. **Caso Bóveda desbloqueada**: **acción**: toca "Ver dato protegido". **Sistema**: revela el valor inline, sin navegar a la Bóveda; registra un `AccesoBoveda` de tipo `consulto` al expandir el bloque, y de tipo `mostro` si además se revela específicamente la contraseña (o un campo oculto por defecto en el caso de un campo protegido).
6. **Caso Bóveda bloqueada**: **acción**: toca el mismo botón. **Sistema**: en vez de navegar fuera de la guía, muestra un formulario de desbloqueo (contraseña maestra) inline, dentro de la misma pantalla. **Acción**: escribe la contraseña maestra. **Sistema**: si es correcta, abre la sesión de Bóveda y revela el dato sin abandonar la guía ni el asistente; si es incorrecta, muestra "Contraseña incorrecta." y permite reintentar.
7. **En ejecución guiada** (`AsistenteVista`, `/soluciones/{categoriaId}/{articuloId}/ejecutar`): el mismo botón "Ver dato protegido" aparece dentro del paso actual con idéntico comportamiento; revelar el dato no completa el paso por sí solo, el paso se completa por sus propias tareas y su trabajo previo.
8. **Caso vínculo roto**: si el secreto vinculado fue eliminado desde la Bóveda, el paso muestra "Los datos vinculados fueron eliminados. Edita el artículo para quitar el vínculo o vincular otros."

**Si se cancela**: en `PasosEditor`, el botón "Quitar" del vínculo solo lo limpia en el estado local del formulario; el cambio no se persiste hasta guardar el artículo completo. No se encontró manejo de Escape en `ArticuloForm`.

### 4.3 Diagnosticar una falla con el árbol de decisión hasta guía o "no resuelto", y su conversión en sugerencia

1. **Pantalla**: Inicio o `DiagnosticosPage` (`/diagnostico`). **Acción**: toca "Diagnóstico inteligente" desde Inicio, o "Iniciar diagnóstico" desde la ficha de un equipo (con `?categoria={id}` precargado). **Sistema**: lista de problemas agrupada por categoría, filtrada si llegó con categoría.
2. **Acción**: elige un diagnóstico. **Sistema**: navega a `/diagnostico/{id}` (`DiagnosticoRunPage`, nivel tarea). Si no hay progreso guardado, se autoinicia en la primera pregunta sin pantalla intermedia.
3. **Pantalla**: estado `pregunta`, con el texto de la pregunta y su ayuda "Cómo comprobarlo". **Acción**: toca una de las opciones de respuesta. **Sistema**: avanza según el `siguienteNodoId` de la opción elegida; si la opción tiene un `articuloId` vinculado, pasa al estado `articulo`.
4. Se repite el paso 3 tantas veces como preguntas encadenadas haya, con la posibilidad de tocar "Volver" en cualquier momento para deshacer la última respuesta.
5. **Rama con procedimiento**: la pantalla cambia a estado `articulo`, "Ejecutando el procedimiento: {título}", con `AsistenteVista` anidado a nivel 0 dentro de la misma pantalla de diagnóstico. **Acción**: completa los pasos y la verificación final. **Sistema**: al completarse todo, `terminarEjecucionArticulo` reinicia el progreso de ese artículo y avanza automáticamente a la siguiente pregunta o al resultado final.
6. **Rama sin procedimiento**: la opción terminal solo trae mensaje final; el sistema pasa directo al estado `final`.
7. **Pantalla**: estado `final`. **Sistema**: banner "Diagnóstico completado" con el mensaje final, "Camino recorrido" (lista pregunta → respuesta) y los artículos ejecutados si hubo alguno; pregunta "¿Quedó resuelto el problema?".
8. **Camino "sí resuelto"**: **acción**: toca "Sí, resuelto". **Sistema**: cierra la sesión con `resuelto='si'`, registra la ejecución inmutable (`ejecuciones_diagnostico`, con camino, artículos ejecutados y duración), borra el progreso local y navega a `/diagnostico`.
9. **Camino "no resuelto"**: **acción**: toca "No". **Sistema**: despliega el selector de motivo (La solución no funcionó / No encontré mi problema / Faltan pasos / Encontré otra solución / Otro). Si el motivo es "Encontré otra solución", aparece un `textarea` obligatorio de hecho ("Qué funcionó, para revisarlo e incorporarlo a la base de conocimiento") cuyo texto se guarda como `solucionPropuesta`. **Acción**: confirma. **Sistema**: cierra con `resuelto='no'`, registra la ejecución con el motivo, borra el progreso local, navega a `/diagnostico`.
10. **Bucle de retroalimentación**: si el motivo fue "Encontré otra solución", esa ejecución queda disponible como sugerencia pendiente. **Pantalla**: cualquier técnico entra a `/diagnostico/sugerencias` (`SugerenciasEquipoPage`). **Sistema**: lista tarjetas con el título del diagnóstico, el texto de la solución propuesta y "Reportado por {nombre}" si existe.
11. **Acción**: toca "Redactar artículo" en una sugerencia todavía sin artículo. **Sistema**: navega a `/soluciones/{categoriaId}/nuevo?desdeSugerencia={idEjecucion}`, precargando título = título del diagnóstico, tipo = "problema frecuente", descripción = el texto de la solución propuesta, y estado = "borrador".
12. **Acción**: completa y guarda el artículo (siguiendo el patrón del formulario de Guías). **Sistema**: al guardarlo, fija `origenSugerenciaId` apuntando a la ejecución de origen; de ahí en adelante esa sugerencia deja de listarse como pendiente en `SugerenciasEquipoPage`, que muestra en su lugar "Ya redactada: {título}" con enlace directo, evitando que dos técnicos redacten el mismo artículo.

**Si se cancela**: dentro de la sesión de diagnóstico, "Cancelar" abre una confirmación inline "¿Cancelar el diagnóstico? El avance se descarta y queda registrado como abandonado." Al confirmar, se registra la ejecución con `resuelto='abandonado'`, salvo que no se haya respondido nada todavía, en cuyo caso no se guarda nada. La salida por la "×" ("Guardar el avance y salir") conserva el progreso si ya hubo alguna respuesta (se puede retomar luego desde el banner "Diagnóstico en curso" de la lista) o lo descarta si el autoinicio no tuvo ninguna interacción.

### 4.4 Dar de baja un equipo con sus dependencias

1. **Pantalla**: ficha del equipo (`DispositivoPage`, `/dispositivos/{id}`). **Acción**: abre el menú "···" y toca "Dar de baja". **Sistema**: navega a `/dispositivos/{id}/baja` (`DarDeBajaPage`, nivel tarea).
2. **Sistema**: calcula las dependencias del equipo (`dependenciasDeBaja`): conexiones donde es origen o destino, credenciales cuyo arreglo de dispositivos lo incluye, y campos protegidos cuyo `dispositivoId` apunta a él. Si el estado ya es "De baja", muestra un banner informativo que no impide continuar.
3. **Pantalla**: hasta tres secciones, solo si tienen elementos (Credenciales y Campos protegidos solo visibles con permiso de Bóveda):
   - **Conexiones**: cada fila con botón "Eliminar" (elimina la conexión directamente, sin opción de conservar).
   - **Credenciales vinculadas**: cada fila con "Desvincular de este equipo" (quita solo este equipo del vínculo, conserva el resto) o "Eliminar credencial" (borra el secreto completo).
   - **Campos protegidos**: cada fila con "Conservar sin equipo" (`dispositivoId` pasa a `null`, el dato sigue existiendo) o "Eliminar".
4. **Acción**: el técnico resuelve cada dependencia una por una, tocando el botón correspondiente en cada fila. **Sistema**: ejecuta cada acción de inmediato (auditando la modificación o eliminación según el caso) y la fila desaparece de la lista.
5. **Sistema**: en cuanto no queda ninguna dependencia pendiente, muestra el banner verde "Sin dependencias pendientes. Ya se puede confirmar la baja."
6. **Acción**: opcionalmente escribe un Motivo y toca "Confirmar baja" (deshabilitado mientras haya dependencias sin resolver). **Sistema**: guarda el equipo con `estado:'De baja'` y el motivo, y navega de vuelta a la ficha del equipo.

**Si se cancela**: "Salir sin dar de baja" vuelve a la ficha del equipo sin cambiar su estado a "De baja"; las dependencias ya resueltas en el camino (eliminaciones o desvinculaciones ya ejecutadas en el paso 4) quedan hechas de todas formas, solo el cambio final de estado no se aplica hasta confirmar.

### 4.5 Reemplazar un equipo por otro (migración todo o nada)

1. **Pantalla**: ficha del equipo saliente (`DispositivoPage`). **Acción**: abre "···" y toca "Reemplazar". **Sistema**: navega a `/dispositivos/nuevo?reemplazaA={idViejo}` (`DispositivoForm` en modo alta, precargado como duplicado pero conservando el nombre igual, sin sufijo "(copia)", con el estado forzado a "Operativo" en lugar de copiar el del equipo saliente, y con el tag "Reemplazo de otro equipo" visible en la barra).
2. **Acción**: completa o ajusta los datos propios del equipo entrante (Serial, Placa, IP, Foto: la foto nunca se copia al duplicar ni al reemplazar, cada equipo físico lleva la suya). **Acción**: toca "Guardar equipo".
3. **Sistema**: por estar en modo reemplazo, no navega a la ficha del equipo nuevo sino a `/dispositivos/{idNuevo}/reemplazo` (`ReemplazoPage`, nivel tarea).
4. **Sistema**, al entrar, valida: si el equipo nuevo no existe, redirige a `/dispositivos`; si no tiene `reemplazaA` registrado, redirige a su propia ficha; si el equipo viejo referenciado ya no existe, muestra una pantalla informativa sin ninguna acción disponible ("El equipo que este reemplaza ya no existe. No hay nada que migrar.").
5. **Sistema**: reutiliza la misma detección de dependencias del flujo 4.4 sobre el equipo viejo. Si no hay ninguna, muestra "'{viejo}' no tiene conexiones, credenciales ni campos protegidos que migrar." y el resumen indica que solo se dará de baja al viejo sin nada más que mover.
6. **Si hay dependencias**, se listan agrupadas por sección (Conexiones / Credenciales vinculadas / Campos protegidos, estos dos últimos solo con permiso de Bóveda) mostrando solo título y resumen, SIN botones de acción por ítem individual: a diferencia de "Dar de baja", aquí no existe resolución parcial, todo se decide en conjunto con un único botón.
7. **Acción**: opcionalmente escribe un Motivo (placeholder = "Reemplazado por {nuevo}", que se usa igual como motivo real si se deja vacío). **Acción**: toca "Migrar todo y dar de baja".
8. **Sistema** ejecuta en bloque: (1) reasigna en cada conexión el extremo que apuntaba al equipo viejo hacia el nuevo, copiando id y nombre; (2) en cada credencial, reemplaza el viejo por el nuevo dentro del arreglo de dispositivos vinculados, conservando el resto de vínculos y sin tocar los datos cifrados (se audita como modificación); (3) en cada campo protegido, reasigna el `dispositivoId` al nuevo equipo sin descifrar el valor (también se audita como modificación); (4) finalmente guarda el equipo viejo con `estado:'De baja'`.
9. **Sistema**: navega a la ficha del equipo nuevo.

**Si se cancela**: "Salir sin migrar" no ejecuta absolutamente nada ("Se puede volver más tarde: nada se pierde ni se toca hasta confirmar"). El equipo nuevo ya existe (se creó en el paso 2), pero queda sin las dependencias migradas; su ficha muestra el banner "Migración pendiente" con enlace de vuelta a `/dispositivos/{idNuevo}/reemplazo` para retomar el flujo más tarde.

### 4.6 Importar equipos masivamente desde archivo

1. **Pantalla**: lista de Equipos (`/dispositivos`). **Acción**: abre el menú "···" y toca "Importar". **Sistema**: navega a `/dispositivos/importar` (`ImportarDispositivosPage`, nivel tarea, indicador "Paso 1 de 3").
2. **Paso 1, Elegir archivo**: **Acción**: toca la zona de clic y selecciona un archivo `.xlsx`, `.xls` o `.csv` (o descarga primero la "plantilla CSV de ejemplo" ofrecida en pantalla). **Sistema**: lee el archivo (SheetJS para Excel; para CSV intenta UTF-8 estricto y cae a Windows-1252 si falla, con autodetección del separador entre `;`, `,` y tabulador); si la lectura falla, muestra "No se pudo leer '{nombre}'. Verificar que sea un archivo .xlsx o .csv válido."
3. **Paso 2, Revisar**: **Sistema**: reconoce encabezados por alias normalizados (Nombre, Categoría, Marca, Modelo, Serial, Placa de inventario, Ubicación, Responsable, IP, Estado, Observaciones); cualquier columna no reconocida se guarda como propiedad libre del equipo. Valida fila por fila y clasifica cada una en "nuevos" u "omitidos" con un motivo explícito (sin nombre, categoría inexistente, serial o placa duplicados dentro del archivo o contra la base local).
4. **Acción**: si hay filas sin categoría reconocible, el técnico elige una "Categoría para las filas que no traen una" en el selector de la pantalla. **Sistema**: recalcula en vivo cuántas filas pasan a ser importables.
5. **Acción**: revisa los contadores ("{N} nuevos" en verde / "{N} se omiten" en ámbar), la lista colapsable de filas omitidas con su motivo, y la vista previa de las primeras 6 filas importables.
6. **Acción**: toca "Importar {N} equipos" (deshabilitado si no hay ninguna fila importable). **Sistema**: pasa a "Paso 3 de 3, importando", guardando las filas una por una con motivo `"Importado desde {nombreArchivo}"` (queda registrado en el historial de cada equipo), mostrando la barra de progreso "Importando {avance} de {total}..."; una fila que falla al guardar se cuenta como fallida pero no detiene el resto del proceso.
7. **Pantalla "Listo"**: "Importación completada: {N} equipo(s) importado(s)" más las filas fallidas si las hubo. **Acción**: toca "Ver equipos" (navega a `/dispositivos`) o "Importar otro archivo" (vuelve al paso 1 en blanco).

Nota adicional: la ubicación y el responsable importados quedan solo como texto libre (`ubicacionId`/`responsableId` en `null`); vincularlos a entidades reales requiere después la migración asistida descrita en el flujo 4.13. El campo "reemplaza a" siempre queda vacío en la importación masiva, esa relación solo se crea desde el menú "···" de una ficha individual (flujo 4.5).

**Si se cancela**: el botón "Cancelar" del paso 2 vuelve al paso 1 (elegir archivo) sin importar nada; la salida "Salir sin importar" de la barra de tarea vuelve a `/dispositivos` sin ejecutar ninguna importación si se sale antes de confirmar el paso 3.

### 4.7 Desbloquear la Bóveda por primera vez y en un uso posterior

1. **Pantalla**: cualquier ruta bajo `/boveda`, alcanzada por ejemplo desde "Bóveda" en la pantalla "Más" o desde un enlace de la ficha de un equipo. **Sistema** (`BovedaGuard`): comprueba primero el permiso `puedeVerBoveda` del perfil; sin ese permiso, muestra una pantalla genérica de acceso restringido, sin revelar nada del contenido.
2. **Sistema**, con permiso: calcula `estadoInicialBoveda()`. Si es la primera vez real (sin verificador local ni remoto, el servidor confirma que no existe nada) entra en modo `crear`.
3. **Pantalla**: `PantallaDesbloqueo` en modo `crear`, a pantalla completa (no es un modal, sin "×" ni cierre con Escape). Muestra dos campos, "Contraseña" y "Confirma la contraseña", con el aviso literal de que quedará registrada como la contraseña maestra del equipo, compartida por todos los técnicos, y que sin ella no se puede recuperar el contenido.
4. **Acción**: escribe la contraseña dos veces. **Sistema**: valida que ambas coincidan ("Las contraseñas no coinciden." si no). **Acción**: confirma.
5. **Sistema**: genera un salt nuevo y deriva la clave con PBKDF2 (600.000 iteraciones); cifra el texto fijo del verificador con esa clave; intenta subirlo primero al servidor (`boveda_meta`), y solo si el servidor lo acepta lo guarda localmente y abre la sesión. Si otro técnico definió la contraseña maestra en el mismo instante (conflicto de clave primaria), relee el verificador remoto y valida lo escrito contra el de ese compañero; si no coincide, avisa que la contraseña recién definida por otro técnico no coincide con la escrita.
6. **Pantalla siguiente**: `BovedaPage` con el contenido real, ya desbloqueada.

**Uso posterior**:

7. **Pantalla**: `PantallaDesbloqueo` en modo `verificar` (ya existe verificador). Un solo campo "Contraseña", con la nota "Se vuelve a bloquear sola tras {N} minutos sin actividad."
8. **Acción**: escribe la contraseña maestra y confirma. **Sistema**: deriva la clave con el salt y las iteraciones del verificador guardado e intenta descifrarlo; si acierta, abre la sesión (y deriva también las claves de cualquier salt antiguo distinto encontrado entre credenciales locales, para poder leer secretos cifrados con una contraseña anterior); si falla, muestra "Contraseña incorrecta."
9. **Sistema**: la sesión permanece abierta hasta el autobloqueo por inactividad (1/5/15/30 minutos configurables en chips al pie de `BovedaPage`, 5 minutos por defecto), hasta tocar el candado de bloqueo manual en la cabecera, o hasta cerrar o recargar la pestaña (la clave solo vive en memoria de módulo).

**Si se olvida la contraseña maestra**: no existe ningún mecanismo de recuperación; el aviso de creación ya lo advierte explícitamente. Solo queda pedirla a un compañero que la recuerde (es compartida por todo el equipo); si nadie la recuerda, el contenido cifrado queda ilegible para siempre.

**Si se cancela / cierra**: la pantalla de bloqueo no tiene "×" ni se cierra con Escape, porque no hay nada "detrás" a lo que volver sin autenticarse; la única salida es introducir la contraseña correcta, o navegar fuera de `/boveda` por otra vía del chasis.

### 4.8 Configurar el bloqueo de la app por primera vez, y qué pasa si se olvida

1. **Pantalla**: `CuentaPage` (`/cuenta`). **Acción**: toca "Seguridad de la aplicación". **Sistema**: navega a `/cuenta/seguridad` (`SeguridadPage`, nivel documento).
2. **Pantalla**: `PanelSinConfigurar` (sin bloqueo aún). **Acción**: elige el método, Patrón o Contraseña.
3. **Si Patrón**: pantalla con grilla `PatronInput` (3x3). **Acción**: dibuja un trazo que una al menos 4 puntos. **Sistema**: valida el mínimo de 4 nodos; si no llega, muestra error y reinicia el trazo.
   **Si Contraseña**: **Acción**: escribe al menos 4 caracteres en `CampoContrasena`. **Sistema**: valida la longitud mínima.
4. **Sistema**: pide repetir el mismo patrón o contraseña como confirmación. **Acción**: lo repite. **Sistema**: valida que coincida exactamente; si no, muestra "Los patrones no coinciden." / "Las contraseñas no coinciden." y reinicia desde el primer intento.
5. **Sistema** (`configurarBloqueoApp`): cifra un verificador nuevo con salt propio (600.000 iteraciones, independiente del de la Bóveda), guarda la configuración en `db.seguridadApp` con `minutosAutobloqueo = 5` por defecto, y **deja la app desbloqueada de inmediato**, porque quien lo configuró acaba de demostrar que conoce el secreto.
6. **Pantalla siguiente**: `PanelConfigurado`, tarjeta "Bloqueo activo" con el método vigente, botón "Bloquear ahora", selector de minutos de autobloqueo (1/5/15/30) y botones "Cambiar"/"Quitar bloqueo".
7. **A partir de aquí**: en cualquier apertura posterior de la app, tras el autobloqueo por inactividad o por volver de segundo plano, o al tocar "Bloquear ahora", `BloqueoAppGuard` intercepta TODAS las rutas autenticadas y muestra `PantallaBloqueo` (patrón o contraseña según el método) antes que cualquier otra pantalla, incluso antes de que se dibuje el chasis.

**Qué pasa si se olvida**:

8. **Pantalla**: `PantallaBloqueo`. **Acción**: toca "¿Olvidaste tu código de desbloqueo?". **Sistema**: despliega la explicación "Puedes cerrar sesión para quitar el bloqueo. Para volver a entrar necesitarás la contraseña de tu cuenta. Tu información no se pierde: se recupera al iniciar sesión de nuevo."
9. **Acción**: toca "Cerrar sesión y quitar el bloqueo". **Sistema**: `restablecerBloqueoApp()` borra `db.seguridadApp` sin pedir el secreto, y de inmediato ejecuta `cerrarSesion()` (solo cierra la sesión de Supabase; nunca borra la base local). **Pantalla siguiente**: `LoginPage` (`/login`).
10. **Acción**: vuelve a iniciar sesión con la contraseña real de la cuenta. **Sistema**: al recuperar sesión, ya no hay bloqueo configurado en este dispositivo (se puede volver a configurar uno nuevo desde `/cuenta/seguridad` si se desea); todos los datos locales se conservan intactos.

Nota adicional: 5 intentos fallidos consecutivos de desbloqueo imponen un enfriamiento de 30 segundos antes de poder reintentar, independiente del mecanismo de "olvidé el código".

### 4.9 Ejecutar un procedimiento guiado paso a paso (modo Asistente), incluida la evidencia fotográfica

1. **Pantalla**: ficha del artículo `ArticuloPage` (`/soluciones/{categoriaId}/{articuloId}`), con `ProcedimientoVista` y la acción dominante fija al pie ("Empezar" / "Seguir en el paso N de M" / "Repetir", según el avance local). **Acción**: toca ese botón. **Sistema**: navega a `/soluciones/{categoriaId}/{articuloId}/ejecutar` (`AsistentePage`/`AsistenteVista`, nivel tarea, rótulo "Ejecutando").
2. **Sistema**: al entrar, resuelve el primer paso pendiente leyendo directamente el progreso ya guardado, para retomar exactamente donde quedó.
3. **Pantalla**: un único paso ocupa toda la pantalla, con ancla pegajosa "Paso N de M", título, contador de tareas del paso y barra de progreso del procedimiento completo.
4. **Acción**: marca cada tarea del paso (casillas de `FilaTarea`), responde las tareas de tipo decisión ("Sí, continuar" o "No, abrir {título}"), y revela cualquier vínculo protegido que el paso requiera (ver flujo 4.2 para el detalle de ese mecanismo).
5. **Solo si** el artículo tiene al menos un equipo afectado y el técnico está en el nivel 0: aparece el bloque "Adjuntar evidencia de este paso" (`EvidenciaPaso`). **Acción**: lo toca y sube una o varias fotos.
6. **Sistema**: crea una entrada de historial (`registrarIntervencion`) sobre ese equipo con la descripción `Evidencia del paso "{título}" ({fecha})`, y guarda el vínculo en el progreso local para que, si el técnico vuelve a este paso más tarde, reutilice la misma galería en vez de crear una intervención nueva. La galería se muestra con el componente `Adjuntos` sobre esa entrada de historial.
7. **Acción**: toca el botón principal fijo al pie, cuya etiqueta cambia según el estado: deshabilitado con el motivo escrito arriba si falta trabajo del paso ("Falta N tarea(s) de este paso para poder avanzar"), o "Paso hecho · ir al N" / "Paso hecho · terminar" cuando ya se puede avanzar.
8. **Sistema**: completa el paso y calcula el siguiente paso pendiente (busca primero hacia adelante, luego desde el inicio), navegando a él automáticamente.
9. **Al llegar a la verificación final** (todos los pasos completos, verificación pendiente): banner de precaución "Verificación final" con un checklist marcable.
10. **Al completar todo**: pantalla de completado, barra al 100%, banner "Procedimiento completado" con el contador de pasos y la duración de la sesión (cronómetro local), y botón "Reiniciar y volver a empezar" que borra el progreso guardado y repone el cronómetro y el índice en el primer paso.

**Si se sale a mitad de camino**: la etiqueta de salida es "Salir del modo ejecución"; el progreso vive en la base local, no en el estado del componente, así que salir nunca lo pierde. Se puede retomar más tarde desde el bloque "Continuar donde quedaste" de Inicio o desde "Sin terminar" en la lista de Guías.

### 4.10 Escanear un código QR/serial de un equipo, según haya o no coincidencia

1. **Pantalla**: lista de Equipos (`/dispositivos`). **Acción**: toca el ícono de cámara "Escanear equipo". **Sistema**: navega a `/escaner` (`EscanerPage`, cámara a pantalla completa).
2. **Sistema**: activa la cámara y el bucle de lectura (cada 200 ms), usando `BarcodeDetector` nativo cuando está disponible o `jsQR` como respaldo. Si falla el acceso a la cámara (sin permiso, sin cámara, o no soportado), muestra el mensaje correspondiente y deja disponible el campo de búsqueda manual (placa o serial) como alternativa completa.
3. **Acción**: apunta la cámara a un código, o escribe la placa o el serial en el campo manual y toca "Buscar". **Sistema**: resuelve el código con el mismo orden de prioridad en ambos casos: (1) URL de etiqueta con el patrón `/dispositivos/{id}`, (2) coincidencia exacta de placa de inventario, (3) coincidencia exacta de serial.
4. **Caso "una coincidencia"**: tarjeta verde "Equipo identificado" con nombre, ubicación, estado e IP mostrados directamente en la tarjeta. **Acción**: toca "Abrir la ficha". **Sistema**: navega a `/dispositivos/{id}` sin reemplazar el historial de navegación, de modo que el botón "Volver" de la ficha dice "‹ Escáner" y regresa aquí. **Acción alternativa**: toca "Seguir" para cerrar el aviso sin navegar y seguir escaneando.
5. **Caso "varias coincidencias"**: tarjeta "Varios equipos comparten este código" con una lista de candidatos, cada uno enlazado a su propia ficha. **Acción**: elige uno, o toca "Seguir escaneando".
6. **Caso "no encontrado"**: tarjeta "Ningún equipo coincide con este código", mostrando el código leído. **Acción**: toca "Registrar equipo". **Sistema**: navega a `/dispositivos/nuevo?serial={código}`, precargando el código como Serial, salvo que el código en sí sea una URL, en cuyo caso navega sin precargar nada. Desde ahí continúa el flujo 4.1 desde el paso 2. **Acción alternativa**: "Seguir escaneando" (o "Cerrar" si falló la cámara).
7. El contador de sesión ("{N} leído(s)", guardado solo en `sessionStorage`) suma por cada código único leído, sin importar el resultado; tocarlo lo reinicia a 0.

**Si se cierra**: la salida "Salir del escáner" retrocede en el historial de navegación (sin destino explícito configurado); al desmontar el componente, se detienen todas las pistas de video de la cámara.

### 4.11 Documentar una conexión de red entre dos equipos, incluida la creación del otro extremo

1. **Pantalla**: sección "Conexiones" de la ficha de un equipo (`DispositivoPage`), o `TopologiaEquipoPage`. **Acción**: toca "Agregar conexión" / "Agregar". **Sistema**: despliega inline `FormularioConexion` (variante "ficha" o "topología" según el origen; no es un modal, no cierra con Escape ni con "×").
2. **Acción**: elige el "Tipo de relación": Da servicio a / Recibe de / Instalado en / Contiene / Relacionado. **Sistema**: según el modo, muestra u oculta los campos de puerto y medio (solo aplican a "Da servicio a" y "Recibe de"); si elige "Relacionado", muestra el aviso de que ese vínculo no entra en la topología.
3. **Acción**: escribe en "Buscar el otro equipo". **Sistema**: filtra dispositivos por nombre, ubicación o IP; sin texto escrito, pre sugiere candidatos por puntaje (misma ubicación suma más que categoría de red).
4. **Si el otro equipo ya existe**: **acción**: lo elige de la lista de candidatos. **Sistema**: lo fija como el "otro" extremo, mostrando un chip de solo lectura con botón "Cambiar".
5. **Si el otro equipo no existe todavía** (solo disponible en variante "ficha", no en variante "topología"): **acción**: toca "Crear equipo nuevo" (precarga el nombre con lo ya tecleado en la búsqueda). **Sistema**: despliega un mini formulario inline con Nombre (obligatorio, autoFocus) y Categoría (`<select>`, obligatorio). **Acción**: completa ambos y toca "Crear y usar". **Sistema**: genera un id, guarda el equipo nuevo (`guardarRegistro('dispositivos', ...)` con nombre, categoría y `estado:'Operativo'`, el resto vacío), relee la base para obtener `updatedAt`/`updatedBy` reales, y lo fija de inmediato como el "otro" elegido, sin salir del formulario de conexión ni de la ficha del equipo original.
6. **Si el equipo actual no tiene ubicación y el otro extremo sí**: aparece la banda "Copiar ubicación". **Acción opcional**: toca "Copiar ubicación". **Sistema**: guarda esa ubicación en el equipo actual (nunca sobrescribe una ya cargada).
7. **Acción**: si el modo implica puertos, completa "Puerto aquí" (prellenado con el siguiente puerto libre) y opcionalmente "Puerto en el otro", y elige el "Medio" (UTP por defecto, con sugerencias de Fibra óptica e Inalámbrico). En variante "ficha" puede añadir Notas.
8. **Acción**: toca "Guardar conexión" (guarda y cierra el bloque) o, solo en variante "ficha", "Guardar y agregar otra" (guarda sin cerrar, conserva el mismo tipo de relación elegido, limpia el resto de campos; útil para dar de alta varios uplinks del mismo switch seguidos).
9. **Sistema**: inserta la fila en `conexiones` con `origenId`/`destinoId` según el sentido del modo elegido, copias de referencia de los nombres, puertos, medio y notas; genera una entrada de historial por cada uno de los dos extremos.
10. **Pantalla resultante**: la conexión aparece agrupada (Instalado en / Contiene / Enlaces / Relacionados) en ambas fichas, y en el árbol de Topología (`/red/topologia`), salvo si es "Relacionado", que solo aparece en las fichas y nunca en el árbol.

**Si se cancela**: no hay "×" ni tecla Escape en `FormularioConexion` porque no es un modal; la única salida sin guardar es el texto/botón "Cancelar", que cierra el bloque sin persistir nada, salvo que ya se haya creado el equipo nuevo del paso 5, que queda guardado igual (mismo comportamiento que la creación inline de Ubicación/Persona del flujo 4.1).

### 4.12 Migración asistida de credenciales sueltas de la Bóveda hacia vincularlas a un equipo

1. **Pantalla**: `BovedaPage` (`/boveda`). **Sistema**: si `detectarCandidatos` (conteo barato, solo por vínculo explícito, sin desbloquear ni descifrar nada) encuentra candidatos, muestra el aviso "{N} secretos parecen ser de un solo equipo. Muévelos a su ficha." con enlace a `/boveda/migrar`.
2. **Acción**: toca el enlace. **Sistema**: navega a `/boveda/migrar` (`MigracionCredenciales`, nivel tarea, salida "Salir sin migrar").
3. **Sistema** ejecuta el análisis completo (esta vez sí requiere descifrar para revisar la coincidencia por IP): calcula candidatos por dos criterios, en orden de prioridad: motivo "vinculo" (la credencial está vinculada a exactamente un dispositivo existente, señal explícita más fuerte) o motivo "ip" (la IP heredada descifrada coincide con la IP de algún equipo del inventario, evaluado solo si no aplicó el vínculo).
4. **Pantalla**: lista de candidatos. **Acción**: expande el informe previo de un candidato. **Sistema**: registra un `AccesoBoveda` de tipo `consulto`.
5. **Acción**: opcionalmente revela la contraseña del candidato antes de decidir. **Sistema**: registra `mostro` (solo aplica al campo tipo contraseña).
6. **Sistema** calcula qué se crearía, a partir del contenido ya descifrado: usuario (si no vacío) pasa a Campo protegido tipo Usuario; contraseña pasa a tipo Contraseña; URL pasa a tipo Otro dato con nombre "URL"; notas pasan a tipo Otro dato con nombre "Notas"; cada entrada de "extras" con valor pasa a tipo Otro dato usando la clave original como nombre. La IP heredada se descarta a propósito, porque ya vive sin cifrar en la ficha del equipo. Los nombres se desambiguan agregando sufijos " (2)", " (3)"... contra los campos que el equipo destino ya tenga.
7. **Acción**: toca "Migrar a este equipo" (deshabilitado si la credencial no se pudo descifrar con la contraseña maestra actual, o si no tiene contenido, caso en el que el sistema sugiere eliminarla directo desde la Bóveda en vez de migrarla).
8. **Sistema** ejecuta la migración: (1) guarda cada campo propuesto como `campos_protegidos` con orden consecutivo tras los ya existentes del equipo; (2) registra `elimino` en la auditoría de Bóveda de la credencial de origen; (3) elimina la credencial (`eliminarRegistro('credenciales', id)`). No se elimina nada hasta que los campos nuevos ya se guardaron con éxito.
9. **Sistema**: la lista se refresca sola; el proceso es idempotente, una segunda pasada del detector ya no vuelve a proponer esa credencial porque fue eliminada.
10. **Pantalla siguiente**: los datos ahora viven en la sección "Datos protegidos" de la ficha del equipo (`/dispositivos/{id}#seguridad`).

**Si se cancela**: "Salir sin migrar" navega de vuelta a `/boveda` sin ejecutar ninguna migración todavía pendiente; lo que ya se migró en el paso 8 sobre algún candidato queda hecho de todas formas, porque la operación se ejecuta candidato por candidato, no como un lote completo.

### 4.13 Migración asistida de ubicaciones y personas en texto libre hacia entidades reales

1. **Pantalla**: lista de Equipos, o las listas `UbicacionesPage`/`PersonasPage`. **Sistema**: si hay dispositivos con ubicación o responsable guardados solo como texto libre sin vincular, muestra un banner ámbar: "{N} equipo(s) tiene(n) la ubicación escrita como texto..." (o el equivalente para responsable).
2. **Acción**: toca el banner. **Sistema**: navega a `/ubicaciones/migrar` (`MigracionUbicaciones`) o `/personas/migrar` (`MigracionPersonas`), nivel tarea.
3. **Ubicaciones**: el sistema detecta dispositivos no eliminados con el campo `ubicacion` (texto) no vacío y todavía sin `ubicacionId`, deduplicando sin distinguir mayúsculas ni espacios (por ejemplo agrupa "Taquilla Norte" con "taquilla  norte").
   **Personas**: el sistema escanea cada dispositivo sin `responsableId` buscando la primera clave de sus Propiedades (`detalles`) que coincida, normalizada, con una lista de alias en orden de prioridad ("usuario asignado", "responsable", "responsable del equipo", "asignado a", "asignado", "empleado", "encargado", "persona asignada", "usuario").
4. **Pantalla**: por cada texto distinto detectado, se muestra la cantidad de equipos afectados y un campo editable con el "nombre final" propuesto, precargado con el texto original.
5. **Acción**: el técnico puede renombrar el nombre final de un grupo (dos textos renombrados al mismo valor se fusionan automáticamente en tiempo real), o vaciar el campo para omitir ese texto de la migración.
6. **Sistema**: muestra el resumen "Se crearán N ubicación(es)/persona(s) y se vincularán N equipo(s)."
7. **Acción**: confirma la migración.
8. **Sistema (Ubicaciones)**: por cada ubicación nueva, `guardarRegistro('ubicaciones', ...)` siempre con `padreId: null` (se crean siempre como raíz durante la migración, sin jerarquía asignada); luego actualiza cada dispositivo migrado con `ubicacionId` más `ubicacion` igual al nombre canónico final (el texto original queda sobrescrito por el nombre canónico, pasando a ser la copia de referencia viva).
   **Sistema (Personas)**: por cada persona nueva, `guardarRegistro('personas', ...)`; por cada dispositivo migrado, retira la clave original de sus Propiedades (a diferencia de Ubicaciones, aquí sí se limpia el dato de origen para no dejarlo duplicado) y fija `responsableId` más `responsable`.
9. **Sistema**: para Ubicaciones el proceso es idempotente (una vez migrado, ya no "necesita migrar" porque tiene `ubicacionId`); si no quedan textos pendientes, la pantalla se autorredirige a `/ubicaciones` sin mostrar contenido.

**Si se cancela**: "Salir sin migrar" no aplica ninguno de los cambios revisados en pantalla.

### 4.14 Buscar algo desde Inicio con el buscador global y llegar al resultado correcto entre varios tipos de entidad

1. **Pantalla**: Inicio (`/`). **Acción**: escribe directamente en el buscador integrado en el cuerpo de la pantalla (placeholder "Buscar en todo: artículos, equipos, bóveda"). **Alternativa**: desde cualquier pestaña, toca la lupa de la barra superior, que abre la capa a pantalla completa `BuscadorGlobal` (mismo motor de búsqueda, se renderiza como portal a `document.body`, con foco automático en el input y se cierra con Escape).
2. **Acción**: escribe el término de búsqueda, por ejemplo "impresora". **Sistema**: el texto escrito alimenta el campo sin retraso, pero el cálculo de resultados usa un valor diferido, de modo que escribir se siente instantáneo aunque el resultado vaya un paso detrás.
3. **Sistema**: expande la consulta con sinónimos curados (por ejemplo "backup" también encuentra "respaldo" y "copia de seguridad") y la ejecuta contra el índice único de MiniSearch en memoria, que indexa Guías (artículos publicados, diagnósticos, categorías), Equipos, Ubicaciones, Personas, y Credenciales de la Bóveda, estas últimas solo mientras la sesión de Bóveda está desbloqueada, y nunca su contenido cifrado.
4. **Sistema**: agrupa los resultados en 5 grupos de orden fijo, mostrando solo los que tienen al menos un resultado: 1) Guías, 2) Equipos, 3) Bóveda, 4) Ubicaciones, 5) Personas. Cada fila muestra un ícono y tono propios del tipo de entidad, el título con el término resaltado cuando el acierto fue literal, el subtítulo y una flecha de navegación.
5. **Acción**: entre varios tipos de entidad con nombres similares (por ejemplo un equipo "Impresora Bodega" y una guía "Configurar impresora de red"), el técnico identifica cuál necesita y toca esa fila.
6. **Sistema**: navega a la ruta correspondiente a ese tipo de entidad (`/soluciones/{categoriaId}/{id}` para una guía, `/dispositivos/{id}` para un equipo, `/boveda/{id}` para una credencial, `/ubicaciones/{id}` o `/personas/{id}`). Si la búsqueda venía de la capa `BuscadorGlobal`, esta se cierra al navegar; si era el buscador de Inicio, simplemente navega sin capas de por medio.
7. **Caso sin coincidencias**: pantalla "Sin coincidencias" con el texto "Nada coincide con «{consulta}». Prueba otra palabra o revisa la ortografía." y dos botones: "Crear equipo" (navega a `/dispositivos/nuevo?nombre={texto buscado}`, iniciando el flujo 4.1 con el nombre ya precargado) y "Limpiar búsqueda".

**Si se cierra**: en la capa `BuscadorGlobal`, cerrarla (con Escape, tocando fuera, o al navegar a un resultado) siempre resetea el texto de búsqueda a vacío, de modo que la próxima vez que se abra aparece limpia sin importar desde qué pestaña se invocó. El buscador integrado de Inicio no tiene estado de "cerrado": es parte permanente del cuerpo de esa pantalla.
## 5. Matriz de interacciones y atajos

Esta sección consolida en tablas de referencia rápida el comportamiento exacto de cada control interactivo (botones, iconos, menús "···", pestañas, filtros, modales, banners y formularios) ya descrito en la sección 3, módulo por módulo, en el mismo orden. No introduce comportamiento nuevo: cuando una fuente no documentó el efecto de cerrar/cancelar un control, la celda dice "No especificado".

### 5.1 Chasis global

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Lupa "Buscar en todo" (`BarraSuperior`) | Toda pantalla nivel `seccion` | Abre la capa `BuscadorGlobal` | Portal a `document.body`, foco automático en el input | Cierra con Escape (ver 5.3) |
| Avatar (`BarraSuperior`) | Toda pantalla nivel `seccion` (oculto en breakpoint `lg`) | Enlace directo | Navega a `/cuenta` | En `lg` el sidebar ya ofrece la cuenta al pie |
| X de `BarraTarea` (nivel `tarea`) | Toda pantalla modo tarea | Navega a `salidaA ?? padreDe(pathname)?.to ?? '/'`, o ejecuta `alSalir` si la pantalla lo pasó | Depende de la pantalla (ver módulos 5.4-5.11) | Por defecto sin confirmación, `aria-label`/`title` "Salir sin guardar"; solo confirma si la pantalla pasa `alSalir` explícitamente |
| `BotonVolver` (nivel `documento`) | Toda pantalla modo documento | Navega al destino de `padreDe` o al `origen` de `location.state` si existe | Ver 3.1.2/3.1.3 | Variante `soloIcono`: 44px, solo chevron |
| Botón "Actualizar" (`ActualizacionDisponible`) | Banner global (toda la app) | Pasa a "Actualizando...", se deshabilita | Recarga la app al recibir `controllerchange`, o a los 2500ms como red de seguridad | Se revisa cada hora además de al cargar |
| Botón "Instalar" (`BotonInstalarApp`) | `BienvenidaPrimerDia`, `CuentaPage` | Abre el diálogo nativo de instalación (`instalarApp()`) | Si se acepta: instala la PWA (confirmado luego por `appinstalled`) | Solo puede usarse una vez |
| Botón "Cómo instalar" (`BotonInstalarApp`) | ídem, o si el diálogo nativo no está disponible/fue rechazado | Abre modal con 3 pasos manuales | — | Si el diálogo nativo se rechaza, cae aquí automáticamente |
| Botón "Descargar" / "Descargando..." (`DescargarOffline`) | Chasis (toda pantalla), Inicio | Descarga todo el contenido para uso offline | Contador de progreso en vivo; aviso ámbar si hay fallidos al terminar | Deshabilitado mientras `progreso.enCurso`; comparte store con `BienvenidaPrimerDia` |
| `PastillaSync` (ranura 2, barra superior) | Toda pantalla nivel `seccion` | Al tocar: dispara `sincronizar()` **y** abre `PanelSync` a la vez | — | Estado "al día" muestra solo ícono; el resto muestra el número real |
| `PanelSync` (modal, abierto desde `PastillaSync`) | Global | — | — | Ver botones internos abajo |
| Botón "Descartar (N intentos)" (dentro de `PanelSync`) | `PanelSync` | Pide confirmación inline: "¿Descartar este cambio? Se perderá y la ficha volverá a como está en el servidor." | Al confirmar, llama `descartarCambioPendiente` | Confirmación en línea, no modal aparte |
| Botón "Reintentar ahora" (`PanelSync`) | `PanelSync` | Dispara `sincronizar()` | — | — |
| Botón "Cerrar" (`PanelSync`) | `PanelSync` | Cierra el panel | — | No especificado si limpia algún estado adicional |
| X de `BarraReanudar` | Flotante (móvil, sobre pestañas) o sidebar (escritorio) | Descarta el aviso de reanudación | — | En móvil también se descarta deslizando horizontalmente (umbral 90px, umbral de arrastre 6px); en escritorio solo con la X |
| Botón "Recargar" (`ErrorBoundary`) | Toda la app, tras un error no reconocido | Recarga manualmente la página | — | Si el error coincide con fallo de chunk, se autorrecarga una vez (ventana antibucle de 10s en `sessionStorage`) sin mostrar este botón |
| Pestaña ya activa (barra inferior/sidebar) | Toda raíz de pestaña | Al tocar la pestaña en la que ya se está | Scroll suave al inicio de la página | Solo si se está exactamente en la raíz pelada (sin query string) |

### 5.2 Inicio (`/`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| `<input type="search">` buscador en línea | Inicio | Escritura instantánea en `query`; `queryDiferida` alimenta resultados | Filtra en vivo | `placeholder`: "Buscar en todo: artículos, equipos, bóveda" |
| Botón "Borrar búsqueda" (`XCircleFill`) | Inicio, junto al buscador en línea | Vacía el campo de texto | — | Visible solo con texto escrito |
| Botón "Crear equipo" (estado sin coincidencias) | Inicio | Navega | `/dispositivos/nuevo?nombre=<texto>` | — |
| Botón "Limpiar búsqueda" (estado sin coincidencias) | Inicio | Vacía la consulta | — | — |
| Tarjeta "Continuar donde quedaste" | Inicio (bloque 1) | Enlace | `/soluciones/{categoriaId}/{id}` | Solo visible si hay un artículo con avance a medias |
| Atajo "Diagnóstico inteligente" | Inicio (bloque 2) | Enlace | `/diagnostico` | — |
| Atajo "Escanear equipo" | Inicio (bloque 2) | Enlace | `/escaner` | — |
| Atajo "Registrar equipo" | Inicio (bloque 2) | Enlace | `/dispositivos/nuevo` | Ocupa el ancho completo (`col-span-2`) |
| Enlace "Estadísticas" (bloque "Problemas frecuentes") | Inicio (bloque 3) | Enlace | `/diagnostico/estadisticas` | Solo si hay problemas frecuentes que mostrar |
| Filas de "Pendientes" | Inicio (bloque 4) | Enlace, según tipo (borrador, credencial, campo protegido, sugerencia) | A la ficha correspondiente | Icono por categoría: `PencilSimple` / `LockSimple` / `Lightbulb` |
| Filas de "Favoritos" | Inicio (bloque 5) | Enlace en vivo a la ficha | — | Solo visible si hay al menos un favorito |
| Filas de "Recientes" | Inicio (bloque 6) | Enlace en vivo a la ficha | — | Estado vacío declarado: "Aún no hay elementos recientes..." |
| Filas numeradas "Para empezar" | Inicio (bloque 7) | Enlace | A la ficha del artículo `esRutaInicio` | Ordenadas por `ordenRutaInicio` |
| Filas "Actividad del equipo" | Inicio (bloque 8) | Enlace en vivo a la ficha del artículo/equipo/diagnóstico | — | Ver 5.3 (comparte infraestructura con `Historial`) |
| Botón "Descargar" (`DescargarOffline`, bloque 9) | Inicio | Igual que 5.1 | — | Comparte store con el chasis |
| `<BotonInstalarApp />` inline (paso "instalar" de `BienvenidaPrimerDia`) | Inicio, bloque 0 | Igual que 5.1 | — | Solo visible mientras el paso no está hecho |
| Botón "Descargar" del paso "offline" (`BienvenidaPrimerDia`) | Inicio, bloque 0 | Llama `descargarTodoOffline()` | Progreso compartido con `DescargarOffline` | No tiene botón para cerrar la tarjeta manualmente; desaparece sola |

### 5.3 Buscador global e Historial (transversales)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Capa `BuscadorGlobal` | Abierta desde la lupa de `BarraSuperior` | Al abrir: bloquea scroll del fondo, foco automático en input | — | **Escape la cierra** (listener en `document`); no se documenta un botón "×" explícito dentro de la capa |
| `<input>` de la capa `BuscadorGlobal` | Capa global | Buscar en vivo | — | Al cerrarse, `query` se resetea a `''` siempre |
| Botón "Crear equipo" (sin coincidencias, capa global) | Capa global | Navega con `?nombre=` | `/dispositivos/nuevo?nombre=<texto>` | Además **cierra la capa** (`onNavegar={onCerrar}`) |
| Botón "Limpiar búsqueda" (sin coincidencias, capa global) | Capa global | Vacía la consulta | — | También cierra la capa |
| Fila de resultado (`FilaResultado`) | Capa global e Inicio | Enlace a la ficha del resultado | Según tipo (artículo/equipo/credencial/ubicación/persona) | En la capa global, `onNavegar` cierra la capa al elegir; en el buscador en línea de Inicio no se pasa esa prop |
| Toggle del componente `<Historial>` (chevron) | Toda ficha con historial (7+ tipos) | Expande/colapsa la lista de eventos | — | Colapsado por defecto; cabecera muestra conteo ("Sin cambios" / "N cambio(s)") |
| Enlaces dentro de una `EjecucionItem` del historial | Dentro de `<Historial>` | Enlace | `/diagnostico/{id}` | — |

### 5.4 Guías (`/soluciones`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Botón "Crear" (cabecera) | `SolucionesPage` | Con categoría activa: `Link` directo; sin categoría: abre hoja "¿En qué categoría?" | `/soluciones/:categoriaId/nuevo` | Siempre habilitado (decisión "R3") |
| Campo de búsqueda + botón "Borrar búsqueda" | `SolucionesPage` | Filtra en vivo / vacía el campo | — | Botón visible solo con texto |
| Chips de categoría ("Todos" + una por categoría) | `SolucionesPage` | Selecciona/filtra | — | Elegir categoría limpia siempre `tipoSel`, `etiquetaSel`, `soloEnCategoria` |
| Botón "Tipo" | `SolucionesPage` | Abre hoja `HojaFiltro` de segundo eje | — | Etiqueta cambia al tipo elegido |
| Botón "Solo ahí" (cinta de contexto al buscar) | `SolucionesPage` | Restringe la búsqueda a la categoría activa | — | Solo aparece con categoría activa mientras se busca |
| Banner "Etiqueta: X" → enlace "Ver todos" | `SolucionesPage` | Quita el filtro de etiqueta | `/soluciones` sin query | — |
| Fila "Sin terminar" → botón "Seguir" | `SolucionesPage` | Enlace | `.../ejecutar` (retoma en el paso) | Oculto mientras se busca o hay filtro de etiqueta |
| Botón "Crear el primero" (estado vacío) | `SolucionesPage` | Abre flujo de creación | — | Solo si no hay artículos, sin filtros |
| Botones "Limpiar la búsqueda" / "Documentarlo" (sin resultados) | `SolucionesPage` | Vacía búsqueda / abre hoja de creación | — | — |
| Botones "Quitar los filtros" / "Crear" (filtros sin resultados) | `SolucionesPage` | Resetea filtros / abre creación | — | — |
| Hoja "Tipo de documento" (`HojaFiltro`) | `SolucionesPage` | Alternar opción de tipo | — | Tocar la misma opción la deselecciona |
| Hoja "¿En qué categoría?" (`HojaFiltro`) | `SolucionesPage` | Elegir categoría | `/soluciones/:id/nuevo` | — |
| Botón secundario "Artículo" (cabecera) | `CategoriaPage` | Enlace | `/soluciones/:categoriaId/nuevo` | — |
| Toggle `<Historial>` (categoría) | `CategoriaPage` | Igual que 5.3 | — | — |
| `BotonFavorito` (estrella) | `ArticuloPage` | Alterna favorito | — | — |
| Ícono "Editar" (`PencilSimple`) | `ArticuloPage` | Navega | `/soluciones/:categoriaId/:articuloId/editar` | — |
| Menú "···" (`MenuAcciones`) | `ArticuloPage` | Alterna menú | — | Se cierra al clicar fuera |
| — Opción "Compartir" | Menú "···" de `ArticuloPage` | `navigator.share` si existe; si no, copia enlace | Aviso "Enlace copiado" 1.2s | — |
| — Opción "Duplicar" | Menú "···" de `ArticuloPage` | Enlace | `/soluciones/:categoriaId/nuevo?copiarDe=:articuloId` | — |
| — Opción "Reiniciar progreso" | Menú "···" de `ArticuloPage` | Borra `db.progresoPasos` de este artículo | — | Solo si tiene procedimiento |
| — Opción "Eliminar" (roja) | Menú "···" de `ArticuloPage` | Abre `DialogoEliminar` | — | Sensible; muestra advertencia de impacto si hay referencias |
| `DialogoEliminar` de artículo | `ArticuloPage` | Confirma/cancela | Al confirmar, elimina y navega a `/soluciones?categoria=:categoriaId`; al cerrar, solo cierra | Sensible; título/descripción varían si tiene procedimiento |
| Chips "Equipos afectados" | `ArticuloPage` | Enlace | `/dispositivos/:id` | — |
| Chips de etiqueta | `ArticuloPage` | Enlace | `/soluciones?etiqueta=X` | — |
| `AccionDominante` ("Empezar"/"Seguir en el paso N"/"Repetir") | `ArticuloPage` (pie) | Enlace | `.../ejecutar` | Solo si hay procedimiento ejecutable |
| Menú "···" de un paso (`PasosEditor`) | `ArticuloForm`, pestaña Pasos | Subir / Bajar / Eliminar | Eliminar abre `DialogoEliminar` no sensible ("¿Eliminar el paso N?") | — |
| Botones "Tarea" / "Advertencia" / "Imagen" / "Reutilizar" | `PasosEditor` | Agregan bloque al paso / abren vínculos | — | — |
| Botón "Quitar" (adjunto del paso) | `PasosEditor` | Quita el adjunto | — | — |
| Selector "Vínculo protegido" + botón "Quitar" | `PasosEditor` | Vincula/desvincula credencial o campo protegido | — | Selector no se muestra si no hay opciones disponibles |
| Selector "Procedimiento relacionado" | `PasosEditor` | Vincula subprocedimiento | — | Rellena el título del paso si estaba vacío |
| Selector "Solución si el paso falla" | `PasosEditor` | Vincula artículo de solución | — | — |
| Ícono de tarea (cicla tipo) | `PasosEditor`, bloque tarea | Ciclo `accion → verificacion → decision → accion` | — | Enter inserta tarea nueva debajo y la enfoca; pegar texto multilínea reparte en tareas |
| Sub-selector "Si responde No" | `PasosEditor`, bloque tarea tipo decisión | Vincula artículo de la rama "No" | — | Con botón "Quitar" una vez vinculado |
| Ícono de advertencia (cicla tono) | `PasosEditor`, bloque aviso | Ciclo `info→precaucion→importante→consejo→dato→info` | — | — |
| Botón "Quitar esta línea" / "Quitar la advertencia" (X) | `PasosEditor`, bloques tarea/aviso | Elimina el bloque | — | — |
| Botón "Quitar" (bloque imagen) | `PasosEditor` | Quita la imagen | — | — |
| Plegado de pasos (clic en cabecera de paso) | `ProcedimientoVista` | Abre/cierra ese paso | — | Estado local no persistido; solo nivel 0 |
| Checklist "Verificación final" | `ProcedimientoVista` | Marca comprobaciones | — | Se convierte en marcable solo al completar todos los pasos |
| Botón "Reiniciar" (banner completado) | `ProcedimientoVista` | Reinicia el progreso | — | — |
| `DecisionEnTarea`: "Sí, continuar" | `ProcedimientoVista`/`AsistenteVista` | Marca la tarea directamente | — | — |
| `DecisionEnTarea`: "No, abrir '[título]'" / "No, continuar" | ídem | Despliega el artículo vinculado inline (nivel+1) o solo enlace | — | Al completarse el vinculado, la tarea se marca sola |
| `DecisionEnTarea` ya respondida (tocar) | ídem | Desmarca para volver a responder | — | — |
| `SolucionEnPaso`: "No, continuar" | ídem | Completa el paso y avanza | — | Solo aparece si hay `solucionArticuloId`, paso no hecho y trabajo previo completo |
| `SolucionEnPaso`: "Sí, ver la solución" | ídem | Despliega la solución inline (nivel+1) | — | Al completarla, se reinicia su progreso y el paso padre se marca hecho |
| Botón "Abrir" (vínculo nivel ≥1 o no ejecutable) | ídem | Enlace | Ficha del artículo vinculado | Corta la expansión infinita (regla de anidamiento único) |
| Botón "Atrás" (pie, `AsistenteVista` nivel 0) | `AsistentePage` | Retrocede un paso | — | Deshabilitado en el primer paso |
| Botón principal contextual (pie) | `AsistentePage` | Avanza / navega según estado | Ver etiquetas en 3.4.2 | Deshabilitado con motivo escrito si falta trabajo del paso |
| Botón "Adjuntar evidencia de este paso" | `AsistenteVista` (`EvidenciaPaso`) | Crea entrada de historial e intervención | — | Solo nivel 0 y solo si el artículo tiene `dispositivosAfectados[0]` |
| Botón "Reiniciar y volver a empezar" | `AsistenteVista`, pantalla completado | Borra progreso guardado | Reposiciona cronómetro y paso a 0 | — |
| Pestañas General/Pasos/Detalles/Publicación | `ArticuloForm` | Cambia de pestaña | `window.scrollTo({top:0})` | Punto indicador si tiene sugerencias pendientes |
| Botón "Usar plantilla" | `ArticuloForm` | Rellena estructura predefinida | — | Sin pisar lo ya escrito |
| Botón "Empezar en blanco" | `ArticuloForm` | Descarta la oferta de plantilla | — | Solo para esa sesión de edición |
| Editor de etiquetas (`EtiquetasEditor`) | `ArticuloForm` | Enter/coma agregan; Backspace en vacío borra la última | — | Pegar con comas/saltos reparte en varias |
| Selector de imagen de portada + botón "Quitar" | `ArticuloForm` | Sube/retira portada | — | Sin conexión con Supabase: error; con conexión intermitente: encolado |
| `EquiposDondeAplica` (select + chips) | `ArticuloForm` | Agrega/quita equipo afectado | — | — |
| Botón "Descartar" (anti-duplicados) | `ArticuloForm`, campo Título | Descarta el aviso de posible duplicado | — | — |
| Barra de completitud (plegable) | `ArticuloForm` (pie) | Expande sugerencias tocables | Lleva a la pestaña donde se resuelve cada una | — |
| Botón "Vista previa" | `ArticuloForm` (pie) | Abre `VistaPreviaArticulo` | Modal a pantalla completa (`z-[70]`), badge "Sin guardar" | Cierra con Escape |
| Botón "Guardar procedimiento" / "Guardar artículo" | `ArticuloForm` (pie) | Valida título; guarda | Navega a la ficha del artículo | Deshabilitado mientras guarda |
| X de `ArticuloForm` ("Cancelar y volver") | `ArticuloForm` | Usa `padreDe` | Al crear: lista con chip repuesto; al editar: ficha | Sin confirmación de descarte |

### 5.5 Diagnóstico (`/diagnostico`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Enlace "Sugerencias del equipo" | `DiagnosticosPage` | Enlace | `/diagnostico/sugerencias` | — |
| Enlace "Estadísticas" | `DiagnosticosPage` | Enlace | `/diagnostico/estadisticas` | — |
| Botón "Crear" | `DiagnosticosPage` | Enlace | `/diagnostico/nuevo` (o con `?categoria=X` si hay filtro) | — |
| Buscador | `DiagnosticosPage` | Filtra por título normalizado | — | — |
| Banner "Solo: [Categoría]" → "Ver todos" | `DiagnosticosPage` | Quita el filtro de categoría | — | — |
| Banner "diagnóstico en curso" | `DiagnosticosPage` | Enlace | `/diagnostico/:id` (retoma) | Oculto mientras se filtra |
| `BotonFavorito` (fila de diagnóstico) | `DiagnosticosPage` | Alterna favorito | — | Hermano del `Link`, no anidado |
| Enlace "Ya redactada: [título]" | `SugerenciasEquipoPage` | Enlace | Ficha del artículo ya escrito | Evita redactar dos veces |
| Botón "Redactar artículo" | `SugerenciasEquipoPage` | Enlace | `/soluciones/:categoriaId/nuevo?desdeSugerencia=:id` | Solo si el diagnóstico de origen aún existe |
| Botón "Eliminar" (cabecera, solo edición) | `DiagnosticoForm` | Abre `DialogoEliminar` sensible | "¿Eliminar este diagnóstico?" | Los procedimientos vinculados no se tocan |
| Menú "···" de un nodo | `DiagnosticoForm` (`NodosEditor`) | Subir / Bajar (deshabilitados en extremos) / Duplicar / Eliminar (deshabilitado si es el único nodo) | Al eliminar, respuestas que apuntaban ahí quedan con `siguienteNodoId: null` | — |
| Botón "+ Respuesta" | `DiagnosticoForm`, por nodo | Agrega una opción | — | — |
| Botón "+ Agregar pregunta" | `DiagnosticoForm` | Crea nodo nuevo | Con opciones "Sí"/"No" prefilladas | — |
| Botón X de una respuesta | `DiagnosticoForm` | Quita la respuesta | — | — |
| Select "Destino de esta respuesta" | `DiagnosticoForm` | Fija a qué nodo va o "Termina aquí" | — | Excluye la propia pregunta |
| Botón "Vincular procedimiento" + botón "Quitar" | `DiagnosticoForm` | Vincula/desvincula artículo | — | — |
| Botón "Probar" | `DiagnosticoForm` (pie) | Abre `PruebaDiagnostico` | Capa modal `z-[70]`, sin guardar ni navegar | — |
| Botón "Guardar diagnóstico" | `DiagnosticoForm` (pie) | Valida (`validarNodos`) y guarda | Navega a `/diagnostico` | Deshabilitado mientras guarda; si falla, muestra panel de errores |
| Botón "Continuar (como si estuviera completo)" | `PruebaDiagnostico` | Simula ejecución de un artículo vinculado | — | Nunca ejecuta de verdad |
| Botón "Continuar de todos modos" | `PruebaDiagnostico` | Avanza pese a artículo no disponible | — | — |
| Botón "Empezar de nuevo" | `PruebaDiagnostico` | Reinicia el recorrido de prueba | — | Aparece si una respuesta apunta a pregunta eliminada |
| Botón "← Volver" | `PruebaDiagnostico` | Deshace la última respuesta | — | Oculto si no hay camino recorrido |
| Botón "Reiniciar" | `PruebaDiagnostico` | Reinicia el recorrido | — | Visible mientras hay camino y no se llegó al final |
| Botón "Cerrar" (cabecera) | `PruebaDiagnostico` | Cierra la capa | — | Sin confirmación |
| Botón "Volver a empezar" (pantalla final) | `PruebaDiagnostico` | Reinicia | — | — |
| Fila de botones de opción (pregunta) | `DiagnosticoRunPage` | Responde la pregunta actual | Avanza al siguiente nodo o ejecuta artículo | Si ejecuta un `articuloId`, muestra "Ejecuta: [título]" |
| Botón que borra el progreso (nodo ya no existe) | `DiagnosticoRunPage` | Elimina el progreso de la sesión | — | — |
| Botón "Continuar con el diagnóstico" (artículo eliminado/sin pasos) | `DiagnosticoRunPage` | Avanza sin ejecutar nada | — | — |
| "Volver" (dentro de la sesión) | `DiagnosticoRunPage` | Deshace última respuesta | Vuelve a la pregunta que la originó | Solo si hay camino recorrido; funciona también desde estado `articulo`/`final` |
| "Cancelar" | `DiagnosticoRunPage` | Abre confirmación inline: "¿Cancelar el diagnóstico? El avance se descarta y queda registrado como abandonado." | "Sí, cancelar" / "Seguir con el diagnóstico" | — |
| Ícono lápiz (cabecera) | `DiagnosticoRunPage` | Enlace | `/diagnostico/:id/editar` | — |
| X de salida ("Guardar el avance y salir") | `DiagnosticoRunPage` | Guarda avance en base local y navega | `/diagnostico` | Si no hay ningún paso respondido (auto-inicio sin interacción), descarta el progreso en vez de conservarlo |
| Botones "Sí, resuelto" / "No" (resultado) | `DiagnosticoRunPage` | Cierra con `resuelto='si'` directo, o despliega selector de motivo | — | — |
| Botones "Confirmar" / "Volver" (selector de motivo) | `DiagnosticoRunPage` | Cierra con `resuelto='no'` / regresa a Sí-No | — | — |

### 5.6 Equipos / Inventario (`/dispositivos`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Ícono "Escanear equipo" | `DispositivosPage` | Enlace | `/escaner` | — |
| Botón "Crear" | `DispositivosPage` | Enlace | `/dispositivos/nuevo` | — |
| Botón "···" ("Más acciones") | `DispositivosPage` | Alterna menú de 4 chips | — | Cada clic cierra el menú |
| — "Ubicaciones" | Menú "···" de `DispositivosPage` | Enlace | `/ubicaciones` | — |
| — "Personas" | ídem | Enlace | `/personas` | — |
| — "Etiquetas QR" | ídem | Enlace | `/dispositivos/etiquetas` | — |
| — "Importar" | ídem | Enlace | `/dispositivos/importar` | — |
| Buscador + botón "×" | `DispositivosPage` | Filtra en memoria / vacía | — | — |
| Chips de categoría (toggle) | `DispositivosPage` | Selecciona/deselecciona | — | Tocar el mismo chip lo desactiva |
| Botón "Quitar filtros" (estado vacío) | `DispositivosPage` | Resetea categoría y texto | — | — |
| Selector de archivo Foto (`FotoEditor`) | `DispositivoForm` | Abre selector; sube comprimida | — | Exige Supabase configurado |
| Botón "Quitar foto" | `DispositivoForm` | Limpia el campo a `null` | — | Visible solo si hay foto y no está subiendo; **la foto nunca se copia al duplicar/reemplazar** |
| `SelectorUbicacion`: opción "Otra" | `DispositivoForm` | Muestra input de texto libre | — | El id se pone en `null`, se conserva el texto |
| `SelectorUbicacion`: "+ Crear ubicación nueva" | `DispositivoForm` | Despliega mini-formulario inline | Botón "Crear y usar" (deshabilitado si nombre vacío) / "Cancelar" (cierra sin crear) | Sin remount, modal ni navegación |
| `SelectorPersona`: mismos controles | `DispositivoForm` | Igual que Ubicación, sin jerarquía | — | — |
| Bloque plegable "Más información" | `DispositivoForm` | Alterna visibilidad | — | Resumen dinámico ("N con contenido") |
| Botón "+ Campo" / "×" por fila (`CamposClaveValor`) | `DispositivoForm` | Agrega/quita propiedad clave-valor | — | Filas con clave vacía se descartan al guardar |
| Botón "Guardar equipo" | `DispositivoForm` (pie) | Valida nombre+categoría; guarda | Navega a la ficha (o a `/dispositivos/:id/reemplazo` en modo reemplazo) | Si inválido: aviso "Falta el nombre o la categoría", sin guardar |
| X "Cancelar y volver" | `DispositivoForm` | Sale sin guardar | — | Sin confirmación de descarte documentada |
| Botón favorito | `DispositivoPage` | Alterna favorito | — | — |
| Botón "Compartir" | `DispositivoPage` | `navigator.share` o copia enlace | Ícono cambia a check 1.5s si copia | — |
| Botón "···" | `DispositivoPage` | Despliega menú bajo la cabecera | — | Cada opción cierra el menú |
| — "Duplicar" | Menú "···" de `DispositivoPage` | Enlace | `/dispositivos/nuevo?copiarDe={id}` | — |
| — "Editar" | ídem | Enlace | `/dispositivos/{id}/editar` | — |
| — "Etiqueta QR" | ídem | Enlace | `/dispositivos/etiquetas` (pantalla general, no la de este equipo) | Hay que volver a localizar el equipo |
| — "Reemplazar" | ídem | Enlace | `/dispositivos/nuevo?reemplazaA={id}` | — |
| — "Dar de baja" | ídem | Enlace | `/dispositivos/{id}/baja` | — |
| — "Eliminar" (peligro/ghost) | ídem | Abre `DialogoEliminar` | — | No navega directamente |
| `DialogoEliminar` de equipo | `DispositivoPage` | Confirmar/Cerrar | Al confirmar: elimina y navega a `volverA` (Red o Equipos); al cerrar: solo cierra | Sensible; advertencia condicional de impacto |
| Banner "Migración pendiente" | `DispositivoPage` | Enlace | `/dispositivos/{id}/reemplazo` | Desaparece automáticamente al resolverse |
| Pasos de "¿Qué sigue?" | `DispositivoPage` | Enlace ("Agregar una foto") o ancla `#hash` (resto) | `/dispositivos/{id}/editar` o secciones internas | Solo visible si `recienCreado`; recalculado en vivo |
| Botón "Iniciar diagnóstico {de categoría}" | `DispositivoPage`, capa Acción | Enlace | `/diagnostico?categoria={categoriaId}` | Oculto si no hay diagnóstico para esa categoría |
| Botón plegable "Documentar este equipo" | `DispositivoPage` | Alterna bloque | — | — |
| — "Editar la ficha" | Bloque "Documentar" | Enlace | `/dispositivos/{id}/editar` | — |
| — "Reportar incidencia" | ídem | Enlace | `/soluciones/{categoriaId}/nuevo?tipo=problema_frecuente&dispositivoAfectado={id}&...` | — |
| — "Documentar procedimiento" | ídem | Enlace | Mismo destino sin forzar tipo | — |
| — "Guardar secreto" (solo con permiso Bóveda) | ídem | Enlace | `/boveda/nueva?titulo=...&dispositivoId={id}&...` | — |
| Secciones plegables de "Profundidad" (5) | `DispositivoPage` | Alterna cada sección | — | Contenido montado solo al abrirse; "Datos protegidos" se fuerza abierta con `?nuevoCampoProtegido=` |
| Botón "Resolver un problema con este equipo" (acción dominante) | `DispositivoPage` (pie) | Enlace | `/diagnostico?categoria={categoriaId}` | Solo si hay procedimiento/problema aplicable |
| Fila de campo protegido (desplegar) | `DispositivoPage`, sección Seguridad | Muestra valor descifrado (si desbloqueada) o formulario de desbloqueo inline | — | — |
| Botones "Editar" / "Eliminar" (campo protegido) | ídem | Abre editor / `DialogoEliminar` | — | — |
| Botones "Guardar" / "Cancelar" (editor de campo protegido) | ídem | Guarda o cierra sin guardar | — | Si la bóveda se bloquea a mitad de edición: "La bóveda se bloqueó por inactividad..." |
| Botón "Generar" (valor del campo protegido, tipos ocultos) | ídem | Genera un valor aleatorio | — | — |
| Botón "Eliminar" (conexión, `DarDeBajaPage`) | `DarDeBajaPage` | Elimina la conexión directamente | — | Sin opción de "conservar" |
| Botones "Desvincular de este equipo" / "Eliminar credencial" | `DarDeBajaPage` | Quita solo este equipo del vínculo / elimina la credencial completa | Audita en ambos casos | — |
| Botones "Conservar sin equipo" / "Eliminar" (campo protegido) | `DarDeBajaPage` | `dispositivoId → null` / elimina el campo | Audita en ambos casos | — |
| Botón "Confirmar baja" | `DarDeBajaPage` (pie) | Guarda `estado: 'De baja'` + motivo | Navega a la ficha del equipo | Deshabilitado mientras haya dependencias sin resolver |
| Salida "Salir sin dar de baja" | `DarDeBajaPage` | Cancela el flujo | Vuelve a la ficha del equipo | Las dependencias ya resueltas quedan hechas igual |
| Botón "Migrar todo y dar de baja" | `ReemplazoPage` (pie) | Migra conexiones/credenciales/campos y da de baja al equipo viejo | Navega a la ficha del equipo nuevo | Migración "todo o nada", sin exclusión por ítem |
| Salida "Salir sin migrar" | `ReemplazoPage` | Cancela | Nada se ejecuta hasta confirmar | — |
| Zona "Elegir archivo .xlsx o .csv" | `ImportarDispositivosPage`, paso 1 | Abre selector de archivo | — | — |
| Botón "Descargar plantilla CSV de ejemplo" | `ImportarDispositivosPage`, paso 1 | Genera y descarga CSV de ejemplo | — | — |
| Botón "Cambiar" (paso 2) | `ImportarDispositivosPage` | Vuelve al paso "elegir" | — | — |
| Selector "Categoría para las filas que no traen una" | `ImportarDispositivosPage`, paso 2 | Fija categoría predeterminada | — | — |
| Botón "Cancelar" (paso 3) | `ImportarDispositivosPage` | Vuelve al paso "elegir" | — | — |
| Botón "Importar N equipos" | `ImportarDispositivosPage`, paso 3 | Ejecuta la importación fila por fila | Barra de progreso | Deshabilitado si no hay filas importables |
| Botón "Ver equipos" (paso 4) | `ImportarDispositivosPage` | Enlace | `/dispositivos` | — |
| Botón "Importar otro archivo" (paso 4) | `ImportarDispositivosPage` | Vuelve al paso "elegir" en blanco | — | — |
| Chips de categoría (incl. red) | `EtiquetasPage` | Filtra tarjetas | — | Aquí sí incluye categorías de red |
| Botón "Seleccionar todas" / "Quitar todas" | `EtiquetasPage` | Alterna selección masiva | — | Etiquetas nuevas entran ya seleccionadas por defecto |
| Checkbox por tarjeta | `EtiquetasPage` | Marca/desmarca esa etiqueta | — | — |
| Botón "Imprimir N" | `EtiquetasPage` (pie) | Dispara impresión del navegador | Solo imprime las marcadas | Deshabilitado si no hay ninguna marcada |
| Salida "Salir sin imprimir" | `EtiquetasPage` | Cancela | Vuelve a `/dispositivos` | — |

### 5.7 Escanear (`/escaner`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Campo de búsqueda manual + botón "Buscar" | `EscanerPage` | Ejecuta la misma resolución que el escaneo por cámara | — | Visible siempre que no haya un aviso de resultado activo |
| Chip contador "{N} leído(s)" | `EscanerPage` | Al tocarlo, reinicia el conteo a 0 | — | Se guarda en `sessionStorage`, no sincronizado |
| Botón de linterna (toggle) | `EscanerPage` | Enciende/apaga el flash | — | Solo si el dispositivo expone la capacidad `torch` |
| Salida "Salir del escáner" | `EscanerPage` | Sin destino explícito | Comportamiento por defecto: retrocede en el historial | Al desmontar, detiene el stream de cámara |
| Botón "Abrir la ficha" (resultado encontrado) | `EscanerPage` | Navega SIN reemplazar historial | `/dispositivos/{id}` | Permite volver con "‹ Escáner" |
| Botón "Seguir" (resultado encontrado) | `EscanerPage` | Cierra el aviso sin navegar | — | Sigue escaneando |
| Enlace por candidato (resultado "Varios") | `EscanerPage` | Enlace | `/dispositivos/{id}` de ese candidato | — |
| Botón "Seguir escaneando" (resultado "Varios"/"No encontrado") | `EscanerPage` | Cierra el aviso | — | — |
| Botón "Cerrar" (si la cámara falló, resultado "No encontrado") | `EscanerPage` | Cierra el aviso | — | Alternativa a "Seguir escaneando" |
| Botón "Registrar equipo" (resultado "No encontrado") | `EscanerPage` | Navega | `/dispositivos/nuevo?serial={código}` (sin precargar si el código es una URL) | — |

### 5.8 Red (`/red`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Botón "Crear" | `RedPage` | Enlace | `/dispositivos/nuevo?red=1` | Prioriza categorías `esRed` en el selector |
| Buscador + botón "×" | `RedPage` | Filtra en vivo / vacía | — | — |
| Tarjeta "Topología de red" | `RedPage` | Enlace | `/red/topologia` | — |
| Botón "Quitar búsqueda" (estado vacío) | `RedPage` | Vacía la búsqueda | — | Solo cuando se está buscando |
| Botón "Expandir todo" | `TopologiaPage` | `modoExpansion='todo'`, limpia inversiones | Todas las filas con hijos quedan abiertas | — |
| Botón "Contraer" | `TopologiaPage` | `modoExpansion='nada'`, limpia inversiones | Todas las filas se cierran | — |
| Buscador de topología | `TopologiaPage` | Resalta coincidencias, fuerza apertura de ancestros, scroll suave | — | Al vaciar, el árbol vuelve a su apertura normal |
| Caret de un nodo (con hijos) | `TopologiaPage`/`TopologiaEquipoPage` | Expande/contrae SOLO esa fila | — | Toggle individual, no navega |
| Cuerpo del nodo (nombre) | ídem | Enlace | `/dispositivos/:id` | — |
| Enlace "+N" (nodo con ≥2 descendientes) | `TopologiaPage` | Enlace | `/red/topologia/:dispositivoId` | Título "Ver la topología desde este equipo" |
| Punto de estado | `TopologiaPage`/`TopologiaEquipoPage` | No interactivo | — | Solo `title` con la etiqueta |
| Botón "Abrir la ficha" | `TopologiaEquipoPage` | Enlace con `state=origenTopologia` | `/dispositivos/:id` | Preserva el hilo de "Volver" hacia la topología de origen |
| Botón "Agregar" (sección Conexiones) | `TopologiaEquipoPage` | Abre/cierra `FormularioConexion` (variante `topologia`) | — | — |
| Botón "X" (quitar conexión, en sección Conexiones) | `TopologiaEquipoPage`/`ConexionesFicha` | `eliminarRegistro('conexiones', id)` | — | Soft delete, **sin confirmación**: un solo tap la borra |
| Botón "Ver en topología" | `ConexionesFicha` | Enlace | `/red/topologia/:dispositivoId` | — |
| Botón "Agregar conexión" | `ConexionesFicha` | Abre `FormularioConexion` (variante `ficha`) | — | — |
| Chips/select "Tipo de relación" (`ModoConexion`) | `FormularioConexion` | Cambia el modo (5 valores) | Cambia campos visibles (puerto/medio o aviso de "relacionado") | Siempre tiene un valor, default `'enlace'` |
| Input "Buscar el otro equipo" | `FormularioConexion` | Filtra candidatos por nombre/ubicación/IP | — | Sugiere por puntaje si el texto está vacío; límite 8 resultados |
| Botón "Cambiar" (chip del otro equipo elegido) | `FormularioConexion` | Limpia `otro` y la búsqueda | Vuelve al estado de selección | — |
| Botón "Copiar ubicación" | `FormularioConexion` | Copia la ubicación del otro extremo al equipo actual | — | Solo si el equipo actual no tiene ubicación; nunca sobrescribe una ya cargada |
| Botón "Crear equipo nuevo" (solo variante `ficha`) | `FormularioConexion` | Abre mini-formulario inline | Botón "Crear y usar" (deshabilitado si nombre o categoría vacíos) | No existe en variante `topologia` |
| Botón "Guardar conexión" | `FormularioConexion` | Guarda y cierra (`onCerrar()`) | — | Deshabilitado si no hay `otro` o está guardando |
| Botón "Guardar y agregar otra" (solo variante `ficha`) | `FormularioConexion` | Guarda sin cerrar, conserva el modo | Limpia `otro`/búsqueda/puerto remoto/notas | — |
| Botón/texto "Cancelar" | `FormularioConexion` | Cierra sin guardar (`onCerrar()`) | — | **Única forma de cerrar**: el componente no es un `Modal`, no tiene "×" ni responde a Escape |

### 5.9 Bóveda (`/boveda`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Formulario "Crear" contraseña maestra (modo `crear`) | `PantallaDesbloqueo` (`BovedaGuard`) | Valida coincidencia de los dos campos; sube verificador | Abre la sesión de bóveda si el servidor lo acepta | No es modal: pantalla completa, sin X ni Escape |
| Formulario "Verificar" contraseña maestra (modo `verificar`) | `PantallaDesbloqueo` | Deriva clave y descifra el verificador | Abre la sesión si acierta; "Contraseña incorrecta." si falla | ídem, sin X ni Escape |
| Botón de candado (bloqueo manual) | `BovedaPage` (cabecera) | Bloquea la sesión de inmediato | — | — |
| Chips de autobloqueo (1/5/15/30 min) | `BovedaPage` (pie) | Fija el minuto de autobloqueo | — | Guardado en `localStorage` |
| Botón/enlace "Crear" | `BovedaPage` | Abre `HojaInferior` para elegir tipo de secreto | Navega a `CredencialForm` con `?tipo=` precargado | — |
| Menú "···" por fila (`HojaInferior`) | `BovedaPage` | Copiar usuario / Copiar contraseña / Eliminar | Eliminar avisa "pide la contraseña maestra" | Eliminación sensible |
| `HojaInferior` (genérica: Crear, menú "···") | `BovedaPage` | — | — | Botón "X" visible cierra con `onCerrar`; **Escape la cierra**; bloquea scroll de fondo mientras está abierta |
| Banner de migración | `BovedaPage` | Enlace | `/boveda/migrar` | Solo si `detectarCandidatos` encuentra candidatos |
| Ícono de ojo (`CampoSecreto`) | `CredencialPage`, `CredencialEnPaso`, `MigracionCredenciales` | Muestra/oculta el valor descifrado | — | Solo si `alternarOculto` está definido |
| Botón de copiar (`CampoSecreto`) | ídem | Copia al portapapeles | Confirmación visual 1.4-1.5s | Audita `copio_usuario`/`copio_contrasena` solo para esos dos campos |
| Botón "Eliminar" | `CredencialPage` | Abre `DialogoEliminar` sensible | — | — |
| `DialogoEliminar` (Bóveda y otras entidades sensibles) | Varias pantallas | "Cancelar"/"Cerrar" cierra sin ejecutar | Botón de acción (por defecto "Eliminar") deshabilitado mientras `ocupado` o, en modo `contrasena`, mientras el campo está vacío | Se cierra con Escape o tocando fuera de la tarjeta (`Modal.tsx`) |
| Select "Tipo de secreto" | `CredencialForm` | Cambia campos visibles según tipo | — | 5 opciones fijas |
| Botón de ojo (mostrar/ocultar contraseña) | `CredencialForm` | Alterna visibilidad del campo | — | — |
| Botón "Generar" (contraseña) | `CredencialForm` | Genera 16 caracteres sin ambigüedad visual | — | — |
| Botón "Mostrar todos los campos" | `CredencialForm` | Revela todos los campos ocultos por tipo | — | No pierde datos |
| Selector de archivo (tipo `archivo`) | `CredencialForm` | Cifra y sube de inmediato al elegir | — | No espera a "Guardar" |
| Botón "Quitar" (archivo adjunto) | `CredencialForm` | Borra estado local / cancela subida pendiente | — | Nunca borra de Storage hasta eliminar el secreto completo |
| Botón "Renovar 90 días" (aviso de vencimiento) | `CredencialForm` | Actualiza el campo Vencimiento (+90 días) | — | Solo si la contraseña cambió y el vencimiento no se tocó |
| Editor de pastillas "Equipos con acceso" | `CredencialForm` | Agrega/quita vínculo con "X" | — | — |
| Botón "Quitar" (IP heredada, tipo legado) | `CredencialForm` | Descarta el dato heredado | — | Ya no se puede volver a crear |
| Botón "Guardar secreto" | `CredencialForm` (pie) | Cifra y guarda | Navega a la ficha | Deshabilitado mientras guarda; falla si la bóveda se bloqueó por inactividad durante la edición |
| X "Cancelar y volver" | `CredencialForm` | Cierra sin guardar | Origen (ficha si editaba) o `/boveda` (si creaba) | — |
| Botón "Migrar a este equipo" | `MigracionCredenciales` | Crea campos protegidos y elimina la credencial de origen | — | Deshabilitado si la credencial no se pudo descifrar |

### 5.10 Seguridad de la app (`/cuenta/seguridad`)

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Selector de método (Patrón / Contraseña) | `SeguridadPage`, `PanelSinConfigurar` | Determina el flujo de captura siguiente | — | — |
| `PatronInput` (grilla 3x3) | Flujos de captura de patrón | Dibuja el trazo; auto-agrega nodo intermedio si salta uno alineado | — | Debe unir al menos 4 puntos |
| `CampoContrasena` (captura) | Flujos de captura de contraseña | Escribe el secreto | — | Mínimo 4 caracteres |
| Botón "Bloquear ahora" | `SeguridadPage`, `PanelConfigurado` | Bloquea la app de inmediato | — | — |
| Select "Autobloqueo por inactividad" | `SeguridadPage`, `PanelConfigurado` | Cambia el umbral (1/5/15/30 min) | — | Aplica con `definirMinutosAutobloqueoApp` |
| Botón "Cambiar" | `SeguridadPage`, `PanelConfigurado` | Abre `FlujoCambiar` | Pide secreto actual, luego método y secreto nuevos | Tiene su propio "Cancelar" que vuelve al panel principal |
| Botón "Quitar bloqueo" | `SeguridadPage`, `PanelConfigurado` | Abre `FlujoQuitar` | Pide secreto actual; si coincide, borra `db.seguridadApp` | Tiene su propio "Cancelar" |
| Enlace "¿Olvidaste tu código de desbloqueo?" | `PantallaBloqueo` (`BloqueoAppGuard`) | Despliega panel explicativo | — | — |
| Botón "Cerrar sesión y quitar el bloqueo" | `PantallaBloqueo` | `restablecerBloqueoApp()` (sin pedir secreto) + `cerrarSesion()` | Navega al login | Seguro porque exige la contraseña real de la cuenta para volver a entrar |
| Botón "Desbloquear" | `PantallaBloqueo` | Compara el secreto contra el verificador | Abre la sesión si coincide | Tras 5 fallos: cooldown de 30s; limpia el campo y reinicia el patrón en cada fallo |

### 5.11 Ubicaciones y Personas

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Botón "Crear" (cabecera) | `UbicacionesPage`/`PersonasPage` | Alterna panel de creación inline | — | Limpia el formulario al abrir/cerrar |
| Buscador + botón "×" (`XCircleFill`) | `UbicacionesPage`/`PersonasPage` | Filtra sin distinguir acentos/mayúsculas / vacía | — | — |
| Banner de migración (ámbar) | `UbicacionesPage`/`PersonasPage` | Enlace | `/ubicaciones/migrar` o `/personas/migrar` | Solo si `porMigrar > 0` y sin filtro activo |
| Fila de la lista | `UbicacionesPage`/`PersonasPage` | Enlace | `/ubicaciones/:id` o `/personas/:id` | — |
| Panel de creación inline: "Crear ubicación"/"Crear persona" | `UbicacionesPage`/`PersonasPage` | Guarda la entidad | Cierra el panel | Deshabilitado si `guardando` o nombre vacío |
| Panel de creación inline: "Cancelar" | ídem | Cierra el panel sin crear | — | — |
| Chips "Dentro de" (solo Ubicaciones, panel inline) | `UbicacionesPage` | Elige padre | — | — |
| Botón "Guardar ubicación" / "Guardar persona" | `UbicacionForm`/`PersonaForm` (pie) | Valida nombre no vacío; guarda | Navega a `/ubicaciones/:id` o `/personas/:id` | Deshabilitado si vacío; sin mensaje de error en línea (solo botón deshabilitado + `required` HTML5) |
| X "Cancelar y volver" | `UbicacionForm`/`PersonaForm` | Cierra sin guardar | Al origen o padre lógico | Sin confirmación de descarte |
| `SelectorUbicacion`/`SelectorPersona` (embebidos en `DispositivoForm`): opción "Otra" | `DispositivoForm` | Muestra input de texto libre | — | Suelta el id, conserva el texto |
| ídem: "+ Crear... nueva" | `DispositivoForm` | Despliega mini-formulario | Botón "Crear y usar" (persiste de inmediato y selecciona) / "Cancelar" (colapsa sin afectar selección previa) | Sin remount ni navegación; preserva el resto del formulario padre |
| Botón "Sub-ubicación" | `UbicacionPage` | Enlace | `/ubicaciones/nueva?padre=<id>` | Precarga el padre |
| Botón "Renombrar" | `UbicacionPage` | Enlace | `/ubicaciones/:id/editar` | — |
| Botón "Editar" | `PersonaPage` | Enlace | `/personas/:id/editar` | — |
| Botón "Eliminar" (Ubicación/Persona) | `UbicacionPage`/`PersonaPage` | Abre `DialogoEliminar` | Al confirmar: soft delete (`eliminadoEn`), sin cascada | **No sensible** (no exige contraseña maestra), a diferencia de dispositivos/credenciales; el diálogo informa impacto pero no bloquea |
| Migas de pan (breadcrumbs) | `UbicacionPage` | Enlace a cada ancestro | Ficha del ancestro | Se corta si un ancestro fue eliminado (queda sin breadcrumbs) |
| Filas "Contiene" / "Equipos en este lugar" / "Equipos asignados" | `UbicacionPage`/`PersonaPage` | Enlace | Ficha de la sub-ubicación o del equipo | Resolución inversa calculada en cada render |

### 5.12 Mi Cuenta, Login y "Más"

| Control | Pantalla donde aparece | Acción al activarlo | Resultado / navegación | Notas |
|---|---|---|---|---|
| Botón "Ingresar" | `LoginPage` | Envía credenciales | Redirige a `/` si tiene éxito | `disabled` mientras `enviando \|\| !supabaseConfigured`; texto pasa a "Ingresando..." |
| Enlace "¿La olvidaste?" | `LoginPage` | Abre modal "Olvidé mi contraseña" | — | Explica que no hay recuperación por correo |
| Botón "Entendido" (modal olvidé contraseña) | `LoginPage` | Cierra el modal | — | — |
| Formulario "Cambiar contraseña de inicio de sesión" | `CuentaPage` | Valida localmente, luego reverifica contra el servidor | Éxito: limpia los 3 campos, mensaje "Contraseña actualizada..." | Requiere conexión a internet |
| Botón "Cambiar contraseña" | `CuentaPage` | Envía el formulario | — | `disabled` mientras `guardando`; texto pasa a "Cambiando..." |
| `<BotonInstalarApp />` (tarjeta "Instalar la app") | `CuentaPage` | Igual que 5.1 | — | Visible solo si `!instalacion.instalada` |
| Enlace "Seguridad de la aplicación" | `CuentaPage` | Enlace | `/cuenta/seguridad` | — |
| Botón "Cerrar sesión" | `CuentaPage` | `cerrarSesion()` (solo remoto) | Redirige al login | **No borra la base local** |
| Fila "Bóveda" (grupo "Consulta protegida") | `PantallaMas` | Enlace | `/boveda` | Solo si `puedeVerBoveda`; fila destacada |
| Fila "Diagnóstico" | `PantallaMas` | Enlace | `/diagnostico` | — |
| Fila "Escanear equipo" | `PantallaMas` | Enlace | `/escaner` | — |
| Fila "Ubicaciones" | `PantallaMas` | Enlace | `/ubicaciones` | Subtítulo con conteo |
| Fila "Personas" | `PantallaMas` | Enlace | `/personas` | Subtítulo con conteo |
| Fila "Etiquetas QR" | `PantallaMas` | Enlace | `/dispositivos/etiquetas` | — |
| Fila "Importar" | `PantallaMas` | Enlace | `/dispositivos/importar` | — |
| Fila de perfil (avatar+nombre+correo) | `PantallaMas` | Enlace | `/cuenta` | — |
| Fila "Bloqueo y seguridad" | `PantallaMas` | Enlace | `/cuenta/seguridad` | Subtítulo dinámico según `db.seguridadApp` |

### 5.13 Comportamiento genérico transversal

| Convención | Dónde aplica | Comportamiento | Excepciones documentadas |
|---|---|---|---|
| Botón "Cancelar" (formularios inline y mini-formularios) | Toda la app | Cierra/colapsa sin guardar, sin confirmación de descarte | Ninguna confirmación de "¿descartar cambios?" fue encontrada en el código auditado en ningún formulario |
| X / Escape en `Modal.tsx` (componente genérico) | `DialogoEliminar` y demás modales que usan `Modal.tsx` (Bóveda, Guías, Equipos, Ubicaciones/Personas) | Cierra el modal; bloquea el scroll de fondo mientras está abierto | `FormularioConexion` (Red) **no** usa `Modal.tsx`: no tiene X ni responde a Escape, solo el botón/texto "Cancelar" cierra |
| X / Escape en `HojaInferior` (hojas modales de Bóveda) | `BovedaPage` (Crear, menú "···") | X visible cierra con `onCerrar`; Escape también cierra; bloquea scroll de fondo | — |
| X de `BarraTarea` (nivel `tarea` del chasis) | Toda pantalla modo tarea | Navega directo (`salidaA ?? padreDe(pathname)?.to ?? '/'`), etiqueta por defecto "Salir sin guardar" | Se convierte en punto de confirmación solo si la pantalla pasa `alSalir` explícitamente (ningún formulario auditado lo usa hoy) |
| Botón/enlace "Volver" (barra superior, nivel `documento`) | Toda pantalla modo documento | Navega al `origen` real del salto (`location.state`) si existe; si no, al padre lógico de `padreDe` (`navegacion.ts`) | El origen es efímero: una recarga o un enlace profundo siempre caen al padre lógico declarado |
| Confirmación de eliminación "sensible" | Equipos (`DispositivoPage`), Bóveda (credenciales, campos protegidos) | Exige la contraseña maestra de la Bóveda antes de confirmar, cuando ya existe una configurada; si el estado es `sin-comprobar`, la eliminación **se niega** por completo | Si aún no existe contraseña maestra (`estado='crear'`), cae a confirmación simple |
| Confirmación de eliminación "simple" | Artículos (no sensible en pasos individuales), Diagnósticos, Ubicaciones, Personas, conexiones de Red | Solo pide "Cancelar"/"Eliminar" (o "Cerrar"), sin contraseña maestra | Eliminar una conexión de Red no pasa ni siquiera por `DialogoEliminar`: un solo tap la borra sin diálogo |
| Menú "···" (contextual) | Toda ficha con acciones secundarias (Guías, Diagnóstico, Equipos, Bóveda) | Alterna un menú desplegable o una hoja; cada opción elegida cierra el menú automáticamente | — |
| Botón de guardado ("Guardar X") | Todo formulario | Texto cambia a "Guardando..." mientras procesa; se deshabilita durante el guardado | El criterio de "inválido" (ej. falta nombre) solo atenúa visualmente el botón; el `disabled` real depende únicamente de si está guardando |
| Selector embebido "+ Crear... nueva" | `SelectorUbicacion`, `SelectorPersona` (dentro de `DispositivoForm`) | Despliega mini-formulario inline sin modal ni navegación; "Crear y usar" persiste de inmediato y selecciona; "Cancelar" solo colapsa | Preserva íntegramente el resto del formulario padre (sin remount) |
| Botón "×" para quitar un ítem de lista (chips, filas dinámicas) | Etiquetas, campos clave-valor, equipos vinculados, respuestas de diagnóstico, bloques de paso | Quita el ítem de inmediato, sin confirmación | — |
| Borrado = borrado lógico (soft delete) | Todo `eliminarRegistro` de la app | Marca `eliminadoEn`, nunca hace `delete` físico ni limpia referencias en otras tablas | Las pantallas que sí resuelven dependencias antes de eliminar (Dar de baja, Reemplazar equipo) lo hacen a mano, no es un mecanismo genérico |
## 6. Reglas de negocio y hallazgos

Esta sección reúne, desde la óptica de auditoría, las reglas arquitectónicas que gobiernan la integridad de los datos, los estados del sistema y la seguridad de la aplicación, y cierra con los hallazgos y discrepancias concretas que la revisión de código detectó. No repite la descripción funcional ya hecha en las secciones 2 a 5: aquí cada mecanismo se lee como restricción (qué garantiza, qué NO garantiza, y qué pasa si se ignora), y cada hallazgo se documenta con su origen exacto en el código.

### 6.1 Reglas de integridad y consistencia de datos

**Punto único de escritura (`guardarRegistro` / `eliminarRegistro`, `src/lib/repositorio.ts`).** Ninguna pantalla escribe directamente en Dexie ni en Supabase: toda creación, edición o eliminación pasa por estas dos funciones, que en una sola transacción local (1) guardan sin esperar a la red, (2) generan automáticamente el historial comparando campo por campo contra la versión anterior, y (3) encolan el cambio en `cambiosPendientes` para subirlo apenas haya señal. La restricción real que esto impone: **no existe ningún camino de escritura que evite el historial ni la cola de sincronización**. La única excepción documentada son las variantes de solo-inserción (`registrarIntervencion`, `registrarEjecucionDiagnostico`, `registrarAccesoBoveda`) para las tres tablas append-only del sistema (`historial`, `ejecuciones_diagnostico`, `accesos_boveda`), que tampoco se editan nunca después de creadas.

**Referencia viva (`{id, nombre}` / `{id, titulo}`).** Todo vínculo entre entidades (Equipo→Ubicación, Guía→Equipos afectados, Conexión→sus dos extremos, paso→subprocedimiento, etc.) guarda el id real más una copia de texto capturada en el momento de vincular. La interfaz resuelve el nombre en vivo contra la fila real cuando existe localmente y no está eliminada; si no, cae a la copia de texto. **Restricción derivada, no evidente para quien no lea el código: renombrar una entidad NO reescribe retroactivamente las copias de texto ya guardadas en otras filas.** Esas copias solo se refrescan cuando alguien vuelve a guardar la fila que las contiene. En la práctica esto es invisible casi siempre porque la mayoría de las pantallas resuelven en vivo contra la entidad real (mientras exista y esté sincronizada), pero cualquier snapshot de texto capturado (por ejemplo un nombre de equipo copiado en una conexión cuyo otro extremo se eliminó, o en un historial/ejecución de diagnóstico, que son "fotos del pasado" a propósito) queda congelado con el nombre de cuando se guardó.

**Borrado lógico universal, sin cascada real.** `eliminarRegistro` únicamente marca `eliminadoEn` con la fecha actual: nunca ejecuta un `delete` físico ni limpia referencias en otras tablas. Esta es la regla por defecto en todo el sistema — Categorías, Artículos, Dispositivos, Conexiones, Credenciales, Campos protegidos, Ubicaciones, Personas, Diagnósticos — y su consecuencia directa es que **cualquier fila que apuntaba a la entidad eliminada queda con un id huérfano**, invisible en las pantallas que filtran por `!eliminadoEn`, pero técnicamente presente en la base y alcanzable si algo la referencia por URL directa.

Dos excepciones manuales, ambas con pantalla dedicada, resuelven las dependencias a mano en vez de dejarlas huérfanas:
- **Dar de baja de un equipo** (`DarDeBajaPage`, `/dispositivos/:id/baja`): obliga a resolver, ítem por ítem, cada conexión, credencial vinculada y campo protegido del equipo (eliminar o desvincular) antes de habilitar el botón "Confirmar baja".
- **Reemplazo de equipo** (`ReemplazoPage`, `/dispositivos/:id/reemplazo`): migra en bloque ("todo o nada") las conexiones, credenciales y campos protegidos del equipo saliente hacia el entrante, y solo entonces marca al saliente como "De baja".

Fuera de estos dos flujos, **el repositorio no ofrece ningún mecanismo genérico de resolución de dependencias al eliminar**: eliminar una Categoría, una Ubicación, una Persona, un Artículo o una Conexión desde cualquier otra pantalla del sistema es un borrado lógico simple, sin limpieza de referencias inversas (ver hallazgo 6.5.3 para el caso concreto de Ubicaciones/Personas).

**Regla anti-pisado del motor de sincronización (`src/lib/sync.ts`).** Al descargar filas remotas (`aplicarFilasRemotas`), el motor nunca sobrescribe una fila que tiene un cambio local todavía pendiente de subir: la conserva local hasta que ese cambio suba y ambas versiones converjan. Al subir (`subirCambiosPendientes`), si el cambio local trae `baseActualizadoEn` y el servidor ya tiene algo más nuevo que esa base, se detecta como conflicto — pero **la resolución sigue siendo "gana la última escritura"**, no una fusión ni una elección manual de versión: el conflicto solo se reporta en `PanelSync` como aviso informativo. Restricción de lectura: un técnico nunca puede, desde la interfaz, elegir conservar su versión sobre la de un compañero; solo puede "Descartar" su cambio en cola (lo que además intenta recomponer el estado desde el servidor).

### 6.2 Manejo de estados

**Artículo/Guía (`EstadoArticulo = 'borrador' | 'publicado' | 'obsoleto'`).** Tres estados, deliberadamente sin "en revisión" (un equipo de 5 técnicos no tiene hoy un flujo de aprobación real). `publicado` es el valor por defecto de todo lo creado antes de que este campo existiera. Un `borrador` u `obsoleto` queda excluido del buscador global, las rutas de inicio y el Diagnóstico Inteligente al vincular (los editores de `PasosEditor`/`DiagnosticoForm` filtran explícitamente a `publicado` al ofrecer artículos vinculables), **salvo una asimetría documentada**: el asistente en tiempo de ejecución de un diagnóstico ya guardado SÍ ejecuta un artículo aunque sea borrador — solo exige que exista, no esté eliminado y tenga procedimiento. Es decir, el filtro por estado se aplica al construir/editar contenido, no al ejecutar contenido ya construido. Banners visibles: "Borrador. No aparece en el buscador, las rutas de inicio ni el diagnóstico." (ámbar) y "Obsoleto. Se conserva solo como referencia; usar el procedimiento vigente." (rojo), mutuamente excluyentes en `ArticuloPage`.

**Sesión de ejecución de Diagnóstico (`estado.tipo` en `DiagnosticoRunPage`).** Tres estados: `pregunta` (nodo actual del árbol), `articulo` (ejecutando un procedimiento vinculado, con `AsistenteVista` anidado a nivel 0) y `final` (resultado, con "¿Quedó resuelto?"). El progreso vive en `db.progresoDiagnostico`, no en el estado del componente React: salir de la pantalla nunca lo pierde. Caso límite manejado explícitamente: si el diagnóstico se editó mientras había una sesión en curso y el nodo actual ya no existe, la pantalla no intenta adivinar un nodo sustituto — muestra "El diagnóstico cambió y la pregunta actual ya no existe. Hay que empezar de nuevo." con un botón que borra el progreso. Cierre de sesión: un abandono sin ninguna respuesta registrada no se guarda en `ejecuciones_diagnostico` (no aporta nada a las estadísticas); cualquier otro cierre sí, incluida la cancelación explícita ("El avance se descarta y queda registrado como abandonado").

**Estados de la Bóveda (`estadoInicialBoveda()`).** Tres estados posibles al llegar a `/boveda`: `crear` (primera vez real, confirmada por el servidor — nunca se ofrece si existe cualquier verificador local o remoto), `verificar` (ya existe contraseña maestra, pide desbloquear) y `sin-confirmar` (sin conexión y sin verificador local ni remoto: no se permite ni crear ni verificar). Regla de oro explícita en el código: **mientras exista un verificador en cualquier lado, la app nunca vuelve a ofrecer "crear"** — borrar caché, cambiar de teléfono o vaciar las credenciales locales no reabre ese flujo. Independientemente de estos tres estados de configuración, la sesión de desbloqueo en sí tiene solo dos estados en memoria (desbloqueada/bloqueada), nunca persistidos: se pierde al cerrar o recargar la pestaña, y se cierra por inactividad (1/5/15/30 min, por defecto 5) o manualmente con el botón de candado.

**Banners de estado transversales.** El sistema usa un vocabulario reducido y consistente de banners de una sola línea para comunicar estado, siempre mutuamente excluyentes dentro de una misma pantalla: precaución/ámbar para algo reversible o informativo (borrador, migración pendiente, secretos por migrar, dependencias por resolver), error/rojo para algo definitivo o bloqueante (obsoleto, vencimiento vencido, error de sincronización), éxito/verde para confirmación de una acción completada (procedimiento completado, sin dependencias pendientes). Ninguno de estos banners es decorativo (regla R23 citada en varias secciones): todos dependen de una condición de datos real, nunca se muestran "por si acaso".

### 6.3 Seguridad

El sistema sostiene **tres capas de seguridad independientes**, cada una con su propio candado, su propio verificador criptográfico y su propio ámbito — ninguna sustituye a otra, y perder una no compromete ni recupera las demás:

| Capa | Protege | Ámbito | Sincronizada | Si se olvida |
|---|---|---|---|---|
| Sesión de cuenta (Supabase Auth) | Acceso a la app en general | La cuenta del técnico | Sí (servidor) | El administrador la restablece desde el panel de Supabase; no hay recuperación por correo (decisión de producto explícita) |
| Bloqueo de la app (patrón o contraseña) | Que alguien tome el teléfono desbloqueado y navegue | Un dispositivo físico, no sincronizado | No | "Cerrar sesión y quitar el bloqueo" (no exige el secreto porque se combina siempre con `cerrarSesion()`: volver a entrar exige la contraseña real de la cuenta) |
| Contraseña maestra de la Bóveda | El contenido cifrado AES-256-GCM de credenciales y campos protegidos | Todo el equipo, una sola, compartida | Sí (solo su verificador cifrado) | **No hay recuperación**: el contenido cifrado queda ilegible para siempre |

Las dos primeras capas se implementan con el mismo mecanismo técnico (PBKDF2 600.000 iteraciones + AES-GCM sobre un texto verificador fijo, nunca se guarda el secreto en sí) pero con textos verificadores y ámbitos totalmente distintos y sin relación entre sí (`TEXTO_VERIFICADOR_APP` vs. `TEXTO_VERIFICADOR` de la Bóveda). Bloquear una capa no afecta a las otras: sus temporizadores de autobloqueo son independientes entre sí.

**Reglas de auditoría.** Tres tablas append-only cubren la trazabilidad del sistema: `historial` (todo guardado/eliminación/adjunto/conexión, generado automáticamente por el repositorio), `ejecuciones_diagnostico` (cada sesión de diagnóstico cerrada) y `accesos_boveda` (cada consulta, revelado, copia, modificación o eliminación de un secreto o campo protegido). Ninguna de las tres se edita nunca después de creada. El historial deliberadamente nunca expone el valor real de un campo cifrado (`datosCifrados`/`valorCifrado` se formatean siempre como `"(cifrado)"`), ni siquiera para un técnico con permiso de ver la Bóveda: documenta que hubo un cambio, nunca cuál fue. De los accesos a la Bóveda, solo `usuario` y `contraseña` generan acciones de auditoría nombradas (`mostro`, `copio_usuario`, `copio_contrasena`); copiar la URL, las notas o los campos "extras" no queda registrado — una asimetría de cobertura de auditoría dentro de la propia Bóveda.

**Restricciones de acceso sin el permiso `puede_ver_boveda`.** Un técnico sin este permiso: no ve la sección "Bóveda" en el menú "Más"; si navega directamente a `/boveda`, `BovedaGuard` le muestra una pantalla genérica de acceso restringido sin insinuar contenido; en la ficha de un Equipo, las secciones "Credenciales de este equipo" y "Datos protegidos" no se renderizan en absoluto (no solo se ocultan visualmente: las consultas Dexie correspondientes ni siquiera se disparan, según lo documentado en Inicio §3.2.9 para Pendientes y en la ficha de Equipo §3.6.4); y el bloque "Actividad del equipo" de Inicio excluye siempre los tipos `credencial`/`campo_protegido` de su feed — no solo para quien carece del permiso, sino para todo el equipo, precisamente para no filtrar el título de un secreto a nadie sin ese permiso por una vía lateral. Una excepción deliberada y documentada (decisión del 2026-07-17): **eliminar una credencial ya no exige el permiso `puede_ver_boveda`**, solo la contraseña maestra — cualquier técnico autenticado que conozca la contraseña maestra compartida puede autorizar esa eliminación puntual, aunque no pueda navegar ni consultar el resto de la Bóveda; ver y consultar credenciales sí sigue exigiendo el permiso.

### 6.4 Reglas de anidamiento y detección de ciclos

**Un solo nivel de anidamiento (Guías y Diagnóstico).** Subprocedimientos, soluciones de error y ramas de decisión ("Si responde No") solo se ejecutan/muestran **inline hasta el nivel 1** (nivel 0 → nivel 1). Más allá de esa profundidad, o si el artículo vinculado ya no tiene pasos, el sistema deja de expandir y muestra en su lugar una tarjeta de enlace ("Continúa en...", "Solución") con un botón "Abrir" que navega a la ficha completa del artículo vinculado. Esta regla, aplicada de forma idéntica en `ProcedimientoVista` (lectura), `AsistenteVista` (ejecución guiada) y dentro de una ejecución de Diagnóstico, es la única defensa del sistema contra un ciclo de referencias A→B→A entre artículos: no hay detección de ciclos explícita en este grafo, la profundidad máxima de un nivel simplemente corta cualquier expansión infinita antes de que pueda ocurrir.

**Detección de ciclos y nodos inalcanzables en árboles de Diagnóstico.** A diferencia del anidamiento de Guías (que se corta por profundidad), el árbol de preguntas de un Diagnóstico se valida explícitamente al guardar (`validarNodos`, `src/lib/diagnostico.ts`): un DFS desde el nodo inicial detecta si el recorrido vuelve a un nodo ya presente en la pila de visita actual ("Las preguntas forman un ciclo: siguiendo las respuestas se vuelve a una pregunta anterior.") y reporta también cualquier pregunta que quede sin poder alcanzarse desde el nodo inicial ("La pregunta N no se puede alcanzar desde la primera..."). Ambos son errores de guardado, mostrados en el panel "Antes de guardar, revisar esto": **el diagnóstico simplemente no se guarda mientras persistan**. Complementa a `profundidadRestante` (con su propia protección anti-ciclo, usada solo para la barra de progreso, nunca para validar) y a la regla de que el primer nodo de la lista es siempre el inicio, sin marcador de datos aparte — lo que significa que reordenar preguntas en el editor puede cambiar cuál es el nodo inicial sin ningún aviso explícito de esa consecuencia.

**Detección de ciclos en el árbol de Red.** `construirNodo` (`src/features/red/arbol.ts`) mantiene un set `enCamino` copiado por rama (no compartido entre hermanos): si un `dispositivoId` ya está en el camino actual de esa rama, el nodo se corta como hoja con `truncado: true` y el glifo visual `↺` ("Ya aparece más arriba"), sin bloquear la construcción del resto del árbol — dos ramas distintas pueden llevar al mismo subárbol sin interferirse. `caminoAscendente` (subir por los padres, usado en "Depende de") aplica una protección equivalente: un set de visitados más un tope de 100 iteraciones. A diferencia de Diagnóstico, **esta detección es puramente visual y de solo lectura**: `FormularioConexion` no valida ciclos ni duplicados al guardar una conexión nueva — el ciclo se detecta y trunca únicamente al construir el árbol en memoria, nunca al momento de persistir el dato en la base.

### 6.5 Hallazgos y discrepancias detectadas por la auditoría

**1. "Etiqueta QR" desde la ficha de un equipo no lleva a la etiqueta de ESE equipo.**
- **Descripción**: el ítem "Etiqueta QR" del menú "···" de la ficha de un equipo individual (`DispositivoPage`) navega a `/dispositivos/etiquetas`, la pantalla GENERAL de generación de etiquetas (selección múltiple, pensada para imprimir varias a la vez), y no a una vista centrada en el equipo desde el que se invocó. El técnico llega a una pantalla con todos los equipos de la categoría activa y debe volver a localizar el suyo (o filtrar por categoría) y marcarlo manualmente antes de poder imprimir.
- **Dónde se origina**: `DispositivoPage.tsx`, menú "···" (acción "Etiqueta QR" → `Link to="/dispositivos/etiquetas"`, sin parámetro que preseleccione ni centre el equipo de origen); confirmado también desde `EscanerPage`/inventario en general, informe C (`C_equipos_escanear.md`).
- **Impacto/riesgo**: fricción de UX pura, sin riesgo de integridad de datos: el técnico puede terminar imprimiendo la etiqueta equivocada si no revisa con cuidado la selección, o simplemente perder pasos en una tarea que debería ser directa (un toque, una etiqueta).
- **Recomendación**: pasar el id del equipo de origen como query param (por ejemplo `?destacar={id}`) para que `EtiquetasPage` abra con ese equipo ya identificado/aislado, o preseleccionado además de marcado, en vez de exigir una búsqueda manual entre todos.

**2. `FormularioConexion` expone 5 valores de interfaz sobre un modelo de datos de 3 valores.**
- **Descripción**: el selector "Tipo de relación" del formulario de conexiones ofrece 5 opciones (`ModoConexion`: `enlace`/"Da servicio a", `recibeDe`/"Recibe de", `instalado`/"Instalado en", `contiene`/"Contiene", `relacionado`/"Relacionado"), pero el modelo persistido (`TipoConexion`) solo tiene 3 valores (`enlace`, `instalacion`, `relacionado`). `enlace` y `recibeDe` son la MISMA `TipoConexion` ("enlace") con el sentido origen/destino invertido; lo mismo entre `instalado` y `contiene` para `instalacion`. El sentido no se persiste como campo aparte: queda codificado en cuál de los dos equipos se guardó como `origenId` y cuál como `destinoId`.
- **Dónde se origina**: `src/features/red/conexiones.ts` (definición de `ModoConexion`, con el comentario del propio código explicando el porqué del quinto valor: antes solo existía "enlace" con la ficha actual siempre como origen/padre, lo que invertía la topología al documentar "el switch me da servicio" desde la ficha del punto de red) y `FormularioConexion.tsx` (tabla de mapeo `ModoConexion → TipoConexion`).
- **Impacto/riesgo**: es una traducción legítima de UX a modelo de datos (5 formas de decir 3 cosas, con el sentido resuelto por asignación de origen/destino), pero es exactamente el tipo de decisión que la documentación funcional del equipo puede no reflejar si describe el selector con solo 3 opciones. No hay riesgo de integridad —el mapeo es determinista y se aplica siempre— pero sí riesgo de documentación desactualizada y de confusión para quien lea el modelo de datos sin conocer el formulario.
- **Recomendación**: si `ARQUITECTURA_FUNCIONAL.md`/`DOCUMENTACION_FUNCIONAL.md` describen el selector de tipo de conexión, verificar que listen los 5 valores de interfaz y expliquen el mapeo a los 3 valores persistidos, no solo estos últimos.

**3. `eliminarRegistro` sobre Ubicación o Persona deja huérfanos silenciosos.**
- **Descripción**: eliminar una Ubicación o una Persona (`eliminarRegistro('ubicaciones'|'personas', id)`) es un borrado lógico puro: solo marca `eliminadoEn`. No limpia `dispositivos.ubicacionId`/`responsableId` de los equipos que apuntaban a esa fila, y no reasigna ni limpia `padreId` de las sub-ubicaciones hijas de una Ubicación eliminada. El diálogo de confirmación muestra un aviso previo ("N equipo(s) y M sub-ubicación(es) quedarán sin este vínculo") pero es puramente informativo: no bloquea la eliminación ni dispara ninguna limpieza. En la práctica el vínculo "se pierde" en toda la UI porque las funciones de lectura filtran filas eliminadas (`existeVinculada` da `false`, el selector cae a "Otra" con el último texto conocido) — pero el id crudo sigue almacenado, apuntando a una fila borrada. Para el caso de sub-ubicaciones huérfanas, el efecto es más severo: como la recursión del árbol (`ordenarConNivel`) solo desciende desde raíces vivas, los hijos de un nodo eliminado simplemente desaparecen del árbol y del breadcrumb (`cadenaUbicaciones` corta el recorrido y no muestra ninguna miga de pan), pero sus fichas siguen existiendo y son accesibles por URL directa (`/ubicaciones/:id`) con normalidad.
- **Dónde se origina**: `src/lib/repositorio.ts:72-95` (`eliminarRegistro`, genérico para toda la app); confirmado específicamente para Ubicaciones/Personas en `UbicacionPage.tsx`/`PersonaPage.tsx` (cálculo del aviso previo) y en `arbol.ts`/`ordenarConNivel` de `UbicacionesPage.tsx` (recorte silencioso de la recursión).
- **Impacto/riesgo**: dato huérfano invisible en árboles y breadcrumbs pero alcanzable por enlace directo o deep link — puede confundir a un técnico que llega a una ficha de sub-ubicación "sin contexto" (sin miga de pan) sin entender por qué, o hacer que un equipo aparezca "sin ubicación" en listados aunque su `ubicacionId` técnicamente siga poblado. No es un riesgo de seguridad ni de pérdida de datos (nada se borra físicamente, todo es recuperable inspeccionando la base), pero sí un riesgo de integridad percibida y de navegación rota silenciosamente.
- **Recomendación**: extender `eliminarRegistro` (o construir un flujo dedicado, al estilo "Dar de baja" de Equipos) para que eliminar una Ubicación/Persona limpie explícitamente `ubicacionId`/`responsableId` en los equipos dependientes y re-parente (o desvincule) las sub-ubicaciones hijas, en vez de dejarlo a que la UI oculte el síntoma.

**4. Los componentes genéricos `HojaFiltro`/`FilaDato`/`CabeceraColapsable`/`SeccionPlegable` no se usan en Ubicaciones/Personas.**
- **Descripción**: pese a estar disponibles, documentados en `COMPONENTES_UI.md`, y usados activamente en otros módulos de la app (por ejemplo `HojaFiltro` en Guías/Soluciones), estos cuatro componentes compartidos tienen cero apariciones en `features/ubicaciones` y `features/personas`. Ambos módulos construyen su buscador, su árbol/lista y sus secciones plegables con markup propio e inline, en vez de reutilizar estos primitivos.
- **Dónde se origina**: confirmado por `grep` sin resultados sobre `src/features/ubicaciones/` y `src/features/personas/` para los cuatro nombres de componente (informe F).
- **Impacto/riesgo**: no es un defecto funcional — ambos módulos funcionan correctamente con su implementación propia — pero es una inconsistencia de UI/mantenibilidad entre módulos: cualquier mejora o corrección futura a esos componentes compartidos (accesibilidad, estilo, comportamiento) no se propaga automáticamente a Ubicaciones/Personas porque no los usan. También implica una posible discrepancia documental si `COMPONENTES_UI.md` los lista como usados en estos módulos.
- **Recomendación**: evaluar si conviene migrar Ubicaciones/Personas a los primitivos compartidos (reduce deuda de mantenimiento a futuro) o, si la decisión de mantenerlos aparte fue deliberada por alguna razón no documentada, dejar constancia explícita del motivo en la documentación de componentes para que no se lea como un olvido.

**5. `UbicacionForm`/`PersonaForm` no dan retroalimentación de error en línea.**
- **Descripción**: en ambos formularios, la única señal de que el campo obligatorio "Nombre" está vacío es que el botón de guardar permanece deshabilitado, más el atributo `required` nativo de HTML5 (que en algunos navegadores/flujos ni siquiera llega a dispararse porque el botón ya está inhabilitado). No existe un mensaje de error explícito en texto junto al campo, del tipo "Este campo es obligatorio" o similar, como sí ofrecen formularios más elaborados de la app (por ejemplo `ArticuloForm`, que marca el campo con `aria-invalid` y un mensaje con ícono `Warning` bajo el campo tras un intento de envío fallido).
- **Dónde se origina**: `UbicacionForm.tsx` y `PersonaForm.tsx` (informe F), contrastado contra el patrón de validación de `ArticuloForm.tsx` (sección 3.4.3 de este documento).
- **Impacto/riesgo**: bajo pero real, sobre todo de accesibilidad: un técnico que use un lector de pantalla, o que simplemente no repare en que el botón está inhabilitado, no recibe ninguna explicación textual de por qué no puede guardar. Es una inconsistencia de patrón de validación entre módulos de la misma app, no un defecto que impida usar el formulario.
- **Recomendación**: alinear `UbicacionForm`/`PersonaForm` al patrón de validación ya existente en `ArticuloForm` (mensaje de error explícito con `aria-invalid` y texto visible bajo el campo tras un intento de envío fallido), en vez de depender únicamente del estado deshabilitado del botón.
