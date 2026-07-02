# Tablero de tareas

Reglas del tablero: solo puede haber una tarea "En proceso" a la vez. Las tareas terminadas se mueven a [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md). Cada tarea indica su ubicación exacta dentro del proyecto.

## En proceso

### 10. Pulido móvil y puesta en marcha
- Descripción: optimización de rendimiento (dividir el bundle, que hoy supera los 700 kB por supabase-js + react-markdown + minisearch), compresión de fotos al subirlas, botón "Descargar todo para offline", icono definitivo de la app, pruebas en los teléfonos reales del equipo y guía de instalación de la PWA.
- Prioridad: Media
- Ubicación: general
- Avance: división del bundle HECHA. Ya no hay un único archivo de 766 kB; se parte en 30+ trozos con carga diferida por ruta (`React.lazy` en `src/App.tsx`, límite de Suspense en `src/app/Layout.tsx`, fallback compartido en `src/components/Cargando.tsx`) y separación de vendors estables (`supabase`, `react-vendor`, `dexie`) vía `build.rollupOptions.output.advancedChunks` en `vite.config.ts`. El chunk de entrada bajó de ~110 kB a ~15 kB; react-markdown (155 kB) solo carga al abrir un artículo y minisearch solo en Inicio; la pantalla de login no arrastra ninguno. Verificado en build de producción real (`vite preview`, config nueva en `.claude/launch.json`): el service worker precachea los 25 trozos JS (cache-first, funcionan offline) y tiene NavigationRoute a index.html (recarga de URL profunda offline sirve el shell SPA). 42 pruebas, lint y build en verde.
- Pendiente: (a) compresión de fotos al subirlas, en `src/components/Adjuntos.tsx` (redimensionar/comprimir con canvas antes del upload a Storage); (b) botón "Descargar todo para offline" que precachee los adjuntos de Storage (hoy solo se cachean al verlos por primera vez); (c) icono definitivo de la app (hoy `public/icon.svg` es placeholder, referenciado en `vite.config.ts`); (d) guía de instalación de la PWA (documento nuevo); (e) pruebas en los teléfonos reales del equipo (las hace el usuario).

## Por hacer

### 2. Backend en Supabase (pasos del usuario)
- Descripción: aplicar el esquema y dar de alta al equipo en el proyecto de Supabase.
- Prioridad: Alta
- Ubicación: `supabase/schema.sql`, `supabase/INSTRUCCIONES.md`
- Avance: esquema completo escrito (tablas, historial inmutable con `recibido_en`, triggers de updated_at, RLS con permiso especial para la bóveda, bucket de adjuntos y categorías iniciales). Credenciales configuradas en `.env` local.
- Bloqueada por: el usuario debe ejecutar `supabase/schema.sql` en el SQL Editor, crear los 5 usuarios, autorizar la bóveda y desactivar el registro público, siguiendo `supabase/INSTRUCCIONES.md`. Importante: si ya se había ejecutado una versión anterior del esquema, volver a ejecutarlo completo (es idempotente y agrega la columna `recibido_en` al historial). Necesaria para probar el login (tarea 4) con usuarios reales, la sincronización real de los módulos ya construidos y la política RLS de la bóveda (tarea 9).
