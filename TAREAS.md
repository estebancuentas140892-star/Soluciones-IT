# Tablero de tareas

Reglas del tablero: solo puede haber una tarea "En proceso" a la vez. Las tareas terminadas se mueven a [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md). Cada tarea indica su ubicación exacta dentro del proyecto.

## En proceso

### 2. Backend en Supabase (pasos del usuario)
- Descripción: aplicar el esquema y dar de alta al equipo en el proyecto de Supabase.
- Prioridad: Alta
- Ubicación: `supabase/schema.sql`, `supabase/INSTRUCCIONES.md`
- Avance: esquema completo escrito (tablas, historial inmutable con `recibido_en`, triggers de updated_at, RLS con permiso especial para la bóveda, bucket de adjuntos y categorías iniciales). Credenciales configuradas en `.env` local.
- Pendiente: el usuario debe ejecutar `supabase/schema.sql` en el SQL Editor, crear los 5 usuarios, autorizar la bóveda y desactivar el registro público, siguiendo `supabase/INSTRUCCIONES.md`. Importante: si ya se había ejecutado una versión anterior del esquema, volver a ejecutarlo completo (es idempotente y agrega la columna `recibido_en` al historial).

## Por hacer

### 4. Autenticación en la app
- Descripción: pantalla de inicio de sesión con correo y contraseña (Supabase Auth), persistencia de la sesión, protección de rutas cuando no hay sesión y botón de cerrar sesión. Sin sesión no se sincroniza ni se muestra contenido.
- Prioridad: Alta
- Ubicación: `src/features/autenticacion/`, `src/app/Layout.tsx` (protección de rutas)

### 5. Módulo Soluciones
- Descripción: gestión de categorías y artículos con contenido Markdown, imágenes y adjuntos; vista de categoría con los procedimientos agrupados por tipo (instalación, configuración, problemas frecuentes, mantenimiento, manuales). Toda escritura pasa por `src/lib/repositorio.ts`.
- Prioridad: Alta
- Ubicación: `src/features/soluciones/`

### 6. Búsqueda global
- Descripción: índice MiniSearch sobre artículos y dispositivos, pantalla de Inicio con el buscador y resultados agrupados por tipo.
- Prioridad: Alta
- Ubicación: `src/features/busqueda/`, `src/features/inicio/`

### 7. Módulo Dispositivos
- Descripción: inventario con filtros por tipo, ubicación y estado; fichas con campos dinámicos según el tipo de dispositivo y enlaces a los procedimientos de su categoría. Toda escritura pasa por `src/lib/repositorio.ts`.
- Prioridad: Alta
- Ubicación: `src/features/dispositivos/`

### 8. Visor de historial de cambios
- Descripción: el registro automático (quién, cuándo, qué cambió y motivo) ya quedó implementado en `src/lib/repositorio.ts`; falta el visor de historial dentro de cada ficha y el campo opcional de motivo al guardar.
- Prioridad: Media
- Ubicación: `src/features/historial/`

### 9. Bóveda de IP y credenciales
- Descripción: sección protegida con contraseña maestra, cifrado AES-256-GCM en el dispositivo, autobloqueo por inactividad y acceso restringido a usuarios autorizados.
- Prioridad: Alta
- Ubicación: `src/features/boveda/`, `src/lib/crypto.ts`

### 10. Pulido móvil y puesta en marcha
- Descripción: optimización de rendimiento (dividir el bundle, que hoy supera los 500 kB por supabase-js), botón "Descargar todo para offline", icono definitivo de la app, pruebas en los teléfonos reales del equipo y guía de instalación de la PWA.
- Prioridad: Media
- Ubicación: general
