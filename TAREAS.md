# Tablero de tareas

Reglas del tablero: solo puede haber una tarea "En proceso" a la vez. Las tareas terminadas se mueven a [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md). Cada tarea indica su ubicación exacta dentro del proyecto.

## En proceso

### 9. Bóveda de IP y credenciales
- Descripción: sección protegida con contraseña maestra, cifrado AES-256-GCM en el dispositivo, autobloqueo por inactividad y acceso restringido a usuarios autorizados (perfil.puedeVerBoveda).
- Prioridad: Alta
- Ubicación: `src/features/boveda/`, `src/lib/crypto.ts`

## Por hacer

### 2. Backend en Supabase (pasos del usuario)
- Descripción: aplicar el esquema y dar de alta al equipo en el proyecto de Supabase.
- Prioridad: Alta
- Ubicación: `supabase/schema.sql`, `supabase/INSTRUCCIONES.md`
- Avance: esquema completo escrito (tablas, historial inmutable con `recibido_en`, triggers de updated_at, RLS con permiso especial para la bóveda, bucket de adjuntos y categorías iniciales). Credenciales configuradas en `.env` local.
- Bloqueada por: el usuario debe ejecutar `supabase/schema.sql` en el SQL Editor, crear los 5 usuarios, autorizar la bóveda y desactivar el registro público, siguiendo `supabase/INSTRUCCIONES.md`. Importante: si ya se había ejecutado una versión anterior del esquema, volver a ejecutarlo completo (es idempotente y agrega la columna `recibido_en` al historial). Necesaria para probar el login (tarea 4) con usuarios reales y para probar la sincronización real de los módulos ya construidos.

### 8. Visor de historial de cambios
- Descripción: el registro automático (quién, cuándo, qué cambió y motivo) ya está implementado en `src/lib/repositorio.ts` y en uso en artículos y dispositivos; falta el visor de historial dentro de cada ficha (artículos, dispositivos y credenciales).
- Prioridad: Media
- Ubicación: `src/features/historial/`

### 10. Pulido móvil y puesta en marcha
- Descripción: optimización de rendimiento (dividir el bundle, que hoy supera los 700 kB por supabase-js + react-markdown + minisearch), compresión de fotos al subirlas, botón "Descargar todo para offline", icono definitivo de la app, pruebas en los teléfonos reales del equipo y guía de instalación de la PWA.
- Prioridad: Media
- Ubicación: general
