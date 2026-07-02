# Tablero de tareas

Reglas del tablero: solo puede haber una tarea "En proceso" a la vez. Las tareas terminadas se mueven a [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md). Cada tarea indica su ubicación exacta dentro del proyecto.

## En proceso

### 2. Backend en Supabase
- Descripción: definir el esquema de tablas, las políticas RLS, el bucket de archivos y dar de alta a los 5 técnicos.
- Prioridad: Alta
- Ubicación: `supabase/schema.sql`, `supabase/INSTRUCCIONES.md`, `.env`
- Avance: esquema completo escrito (tablas, historial inmutable, triggers de updated_at, RLS con permiso especial para la bóveda, bucket de adjuntos y categorías iniciales). Credenciales configuradas en `.env` local.
- Pendiente: el usuario debe ejecutar `supabase/schema.sql` en el SQL Editor, crear los 5 usuarios, autorizar la bóveda y desactivar el registro público, siguiendo `supabase/INSTRUCCIONES.md`.

## Por hacer

### 3. Capa de datos local y sincronización
- Descripción: base de datos local con Dexie, cola de cambios offline (outbox) y sincronización bidireccional con Supabase.
- Prioridad: Alta
- Ubicación: `src/lib/db.ts`, `src/lib/sync.ts`

### 4. Módulo Soluciones
- Descripción: gestión de categorías y artículos con contenido Markdown, imágenes y adjuntos; vista de categoría con los procedimientos agrupados por tipo (instalación, configuración, problemas frecuentes, mantenimiento, manuales).
- Prioridad: Alta
- Ubicación: `src/features/soluciones/`

### 5. Búsqueda global
- Descripción: índice MiniSearch sobre artículos y dispositivos, pantalla de Inicio con el buscador y resultados agrupados por tipo.
- Prioridad: Alta
- Ubicación: `src/features/busqueda/`, `src/features/inicio/`

### 6. Módulo Dispositivos
- Descripción: inventario con filtros por tipo, ubicación y estado; fichas con campos dinámicos según el tipo de dispositivo y enlaces a los procedimientos de su categoría.
- Prioridad: Alta
- Ubicación: `src/features/dispositivos/`

### 7. Historial de cambios
- Descripción: registro automático de quién, cuándo, qué cambió y motivo en cada creación, edición o eliminación; visor de historial en cada ficha.
- Prioridad: Media
- Ubicación: `src/lib/historial.ts`, `src/features/historial/`

### 8. Bóveda de IP y credenciales
- Descripción: sección protegida con contraseña maestra, cifrado AES-256-GCM en el dispositivo, autobloqueo por inactividad y acceso restringido a usuarios autorizados.
- Prioridad: Alta
- Ubicación: `src/features/boveda/`, `src/lib/crypto.ts`

### 9. Pulido móvil y puesta en marcha
- Descripción: optimización de rendimiento, botón "Descargar todo para offline", pruebas en los teléfonos reales del equipo y guía de instalación de la PWA.
- Prioridad: Media
- Ubicación: general
