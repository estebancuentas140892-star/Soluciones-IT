# Historial de cambios

Registro canónico de los cambios del proyecto. Es la única fuente de verdad del historial de cambios (regla 19c de [REGLAS.md](REGLAS.md)).

Formato: cada entrada lleva fecha, y agrupa los cambios por tipo (Agregado, Cambiado, Corregido, Documentación, Seguridad). Los identificadores de tarea (por ejemplo "tarea 167") enlazan con el detalle en [TAREAS.md](TAREAS.md) mientras están en curso, o en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md) una vez cerradas.

> Alcance histórico: este archivo se inaugura el 2026-07-24. El historial detallado tarea por tarea anterior a esa fecha vive en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md) (no se reescribe aquí para no duplicarlo). Las decisiones de arquitectura, con su motivo, están en [DECISIONES.md](DECISIONES.md).

## 2026-07-27

### Rediseño de la lista de Soluciones (tarea 168, pantalla P1 del handoff "Auditoría de Soluciones TI")

**Área modificada:** sección Soluciones (`/soluciones`) y componentes compartidos de `src/components`.
**Motivo:** implementar la auditoría de diseño de la sección, que documentó 11 problemas y 13 decisiones para esta pantalla, más 7 reglas visuales transversales.
**Impacto esperado:** la cabecera pegajosa baja de 232 px a ~156 px (más artículos visibles antes del primer scroll), retomar un procedimiento a medias pasa de 4 toques a 1, y desaparecen los controles muertos y los textos por debajo del mínimo de contraste AA.

- **Agregado** `src/components/PastillaEstado.tsx`: una sola forma de contorno para todo estado de fila. Es el `IndicadorEstado` que pedía el candidato CAND-1. Antes "Borrador" iba con borde punteado y relleno ámbar y "Obsoleto" con relleno neutro sólido, dos diseños para el mismo tipo de dato.
- **Agregado** `src/components/IndicadorAvance.tsx`: único indicador de "X de Y pasos", con variantes `anillo | barra | texto`. Registrado como candidato **CAND-7** para absorber `AvanceArticulo` y `ContadorSubProgreso` al rediseñar P2 y P4.
- **Agregado** `src/components/PastillaFrescura.tsx`: frescura del dato y cambios sin subir bajo el título de la lista (regla R7). Antes esta señal solo existía en Inicio.
- **Agregado** `src/components/HojaFiltro.tsx`: hoja inferior genérica para el segundo eje de filtro y para elegir categoría al crear (regla R4). Se apoya en `Modal`, que ya resuelve portal, Escape y bloqueo de scroll.
- **Agregado** `src/features/soluciones/FilaArticulo.tsx`: fila de artículo compartida. Ver [DECISIONES.md](DECISIONES.md) AD-020 sobre por qué esto no contradice la decisión de la tarea 145.
- **Agregado** `src/lib/tiempoRelativo.ts` (+ pruebas): antigüedad en lenguaje humano ("hace 4 min").
- **Agregado** `src/features/soluciones/sinTerminar.ts` (+ pruebas): los procedimientos que el técnico dejó a medias, para el bloque "Sin terminar".
- **Agregado** `src/features/soluciones/coincidencia.ts` (+ pruebas): además de si un artículo coincide, **por dónde** (título, etiqueta, categoría, tipo). Absorbe `partirTitulo`, que estaba dentro de `SolucionesPage.tsx`.
- **Agregado** `src/features/soluciones/sugerenciaBusqueda.ts` (+ pruebas): corrección ortográfica local ("Quizá quisiste decir *zebra*") con distancia de edición y tolerancia por longitud. **No** reutiliza el `fuzzy` del índice global porque ese índice excluye borradores y obsoletos, que esta pantalla sí lista.
- **Cambiado** `src/features/soluciones/SolucionesPage.tsx`: "Crear" siempre activo (sin categoría abre una hoja que pregunta cuál); el eje de tipo pasa de una segunda fila de chips a la hoja "Tipo de documento" y está disponible siempre, no solo dentro de una categoría; bloque "Sin terminar"; cinta de contexto al buscar con acción "Solo ahí" para acotar la búsqueda a la categoría en pausa; estados vacíos con acción; contadores y metadatos suben de `neutral-600` a `neutral-400`; el botón de borrar la búsqueda pasa de 26 a 44 px; degradado de recorte al final del carrusel de categorías.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-019 (reglas R1 a R7), AD-020 (`FilaArticulo`) y AD-021 (escritorio se conserva); [COMPONENTES_UI.md](COMPONENTES_UI.md) secciones 2.10b a 2.10e, 3.8b y candidatos CAND-1/CAND-2/CAND-7; [BUSCADOR.md](BUSCADOR.md) secciones 10.1 a 10.3; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) sección 5.2.

**Sin cambios de estructura de datos:** no se agregaron ni modificaron tablas, columnas ni relaciones. `db.progresoPasos` (que alimenta "Sin terminar") ya existía y es local del dispositivo, así que no toca `supabase/schema.sql` ni requiere ningún paso en Supabase.

**Verificación:** typecheck, lint y build limpios; 96 pruebas en la sección Soluciones y los helpers nuevos (44 de ellas nuevas). **Sin verificar en navegador**: la app exige iniciar sesión y esta sesión no tiene una cuenta de técnico real (misma limitación registrada desde la tarea 144). Se confirmó que la app arranca sin errores de consola y que `/soluciones` redirige a login limpiamente.

## 2026-07-24

### Documentación (tarea 167, mejora integral)

- **Agregado** [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md): manual del comportamiento interno del sistema. Incluye catálogo numerado de reglas de negocio (RN-001 en adelante), modelo entidad-relación con cardinalidades, ciclos de vida y máquinas de estado por entidad, modelo de permisos con matriz, catálogo de eventos del sistema, dependencias entre entidades, arquitectura offline y de conflictos, auditoría, objetivos de rendimiento, accesibilidad, arquitectura de navegación, convenciones y roadmap.
- **Agregado** [COMPONENTES_UI.md](COMPONENTES_UI.md): catálogo de componentes reutilizables (propósito, props, variantes, ejemplo de uso y pantallas donde aparece cada uno).
- **Agregado** [BUSCADOR.md](BUSCADOR.md): fuente única del subsistema de búsqueda (qué se indexa, ranking, difuso, sinónimos, normalización, buscadores locales y rendimiento).
- **Agregado** [DECISIONES.md](DECISIONES.md): registro de decisiones de arquitectura (ADR) con su contexto, decisión y consecuencias.
- **Agregado** este `CHANGELOG.md` como historial canónico.
- **Cambiado** [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md): se enfocó en lo visible al usuario (pantallas, formularios, botones, flujos, navegación y componentes visibles); el contenido interno se trasladó a `ARQUITECTURA_FUNCIONAL.md` para eliminar la duplicación.
- **Cambiado** [REGLAS.md](REGLAS.md) regla 19c: el historial de cambios pasa a vivir en este `CHANGELOG.md` (antes dentro de `DOCUMENTACION_FUNCIONAL.md`).

### Corregido (documentación desalineada con el código)

Verificación código vs documentación (se priorizó el código). Correcciones aplicadas a `ARQUITECTURA.md`:

- La cabecera de Inicio no muestra "Sincronizado en tiempo real": la pastilla tiene 4 estados ("Al día", "Sin conexión", "Con error", "Sincronizando"). El texto de tiempo real vive en el panel de sincronización.
- `conexiones` ya no es la tabla que sincroniza de última (hoy lo es `personas`).
- `articulos.aplica_a` (aplicabilidad por marca/modelo, hallazgo H6) faltaba en el modelo de datos; se documentó, incluido su tratamiento de sincronización (viaja siempre, incluso `null`, no está en `camposOpcionales`).
- Las eliminaciones sensibles protegen 5 entidades (artículo, dispositivo, credencial, **diagnóstico** y **campo protegido**), no 3.
- `accesos_boveda.accion` tiene 7 valores (faltaba `'descargo'`).
- El componente `<Historial>` cubre 8 entidades (faltaban ubicación, campo protegido y persona).
- Se documentaron la entidad `personas`, y las columnas `dispositivos.responsable`/`responsable_id` y `dispositivos.reemplaza_a` en el modelo de datos.
- Se aclaró que `perfiles` y `boveda_meta` sincronizan con un mecanismo propio (fuera del motor genérico) y que `syncMeta` es una tabla local.
- Búsqueda: la miniatura de portada no se pinta hoy en los resultados; no existe `ResultadosBusqueda.tsx` ni chips de filtro por tipo; la Bóveda se indexa por título, categoría y nombre de archivo; el selector de "vincular procedimiento" no usa el índice de búsqueda.

### Registrado como pendiente (ver [TAREAS.md](TAREAS.md))

- Deuda técnica de seguridad: asimetría de la política de inserción del historial de secretos; control de propietario del bucket `adjuntos`.
- Deuda de duplicación de UI: candidatos CAND-1 a CAND-6 (componente de estado, "buscar o crear inline", desbloqueo inline de bóveda, fila de dispositivo en `CategoriaPage`).
- Búsqueda: miniatura de portada en resultados, unificar normalizaciones de acentos, tope de resultados.
