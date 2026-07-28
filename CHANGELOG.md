# Historial de cambios

Registro canónico de los cambios del proyecto. Es la única fuente de verdad del historial de cambios (regla 19c de [REGLAS.md](REGLAS.md)).

Formato: cada entrada lleva fecha, y agrupa los cambios por tipo (Agregado, Cambiado, Corregido, Documentación, Seguridad). Los identificadores de tarea (por ejemplo "tarea 167") enlazan con el detalle en [TAREAS.md](TAREAS.md) mientras están en curso, o en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md) una vez cerradas.

> Alcance histórico: este archivo se inaugura el 2026-07-24. El historial detallado tarea por tarea anterior a esa fecha vive en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md) (no se reescribe aquí para no duplicarlo). Las decisiones de arquitectura, con su motivo, están en [DECISIONES.md](DECISIONES.md).

## 2026-07-28

### Agregado (tarea 181): barra superior global, con el buscador y el estado del dato en las cinco pestañas

**Área modificada:** chasis (`src/components/BarraSuperior.tsx`, `PastillaSync.tsx`) y las cinco pestañas raíz; buscador (`src/features/busqueda/`).
**Motivo:** turno 3 del handoff "Auditoría de Soluciones TI" (mockup `3d`). El shell aportaba pestañas y sidebar y nada más: cada pantalla dibujaba su propia cabecera con altura, relleno y controles distintos, y los tres servicios globales vivían dentro de una sola pestaña.
**Impacto esperado:** encontrar cualquier cosa pasa a un toque desde donde estés, sin perder el sitio; y en las cinco pestañas se sabe si lo que se acaba de escribir ya subió. Sin cambios de datos ni de esquema.

- **Agregado** `src/components/BarraSuperior.tsx`: tres ranuras fijas y siempre en el mismo orden (regla **R14**): título de la sección · estado del dato · buscar + cuenta. Por ahora cubre el modo raíz; los modos documento y tarea llegan con el chasis de tres niveles (tarea 185).
- **Agregado** `src/features/busqueda/BuscadorGlobal.tsx`: el buscador global en capa, invocable desde cualquier pestaña. **Declara su alcance por escrito** ("Busca en todo a la vez: Guías, Equipos, Bóveda, Ubicaciones y Personas"), que era la otra mitad del problema: cinco buscadores con la misma forma y cinco alcances distintos. Portal a `document.body` por el mismo motivo que `Modal` (la barra lleva `backdrop-blur`, que crea bloque contenedor).
- **Agregado** `src/lib/iniciales.ts` (+ 8 pruebas): las iniciales del técnico para el avatar de la cuenta, que resuelve nombre suelto, nombre y apellidos, espacios de más y el respaldo por correo.
- **Refactorizado** la presentación de resultados sale de `InicioPage.tsx` a `src/features/busqueda/resultados.ts` (catálogo y helpers: `VISUAL_POR_TIPO`, `GRUPOS_BUSQUEDA`, `partirTitulo`, `agruparResultados`) y `ResultadosBusqueda.tsx` (los componentes). Separados en dos archivos para no mezclar componentes y constantes, que `oxlint` avisa por fast-refresh. `InicioPage` pierde 70 líneas.
- **Refactorizado** `PastillaSync` sale de `InicioPage.tsx` a `src/components/PastillaSync.tsx` y se monta en el chasis (regla **R7** aplicada al chasis), con la forma del mockup: sin borde, 44 px de alto de toque, rótulo de 12 px y el icono llevando el color del estado.
- **Cambiado** las cinco pestañas raíz (`InicioPage`, `SolucionesPage`, `DispositivosPage`, `RedPage`, `BovedaPage`) dejan de dibujar su propia fila de título y montan `BarraSuperior`. Sus acciones ("Crear", "Escanear", el menú "···", los subtítulos, la pastilla de frescura) bajan a la banda de controles inmediatamente debajo: ver [DECISIONES.md](DECISIONES.md) AD-023, que resuelve la contradicción entre el turno 1 y el turno 3 del handoff. Los subtítulos suben de `neutral-500` a `neutral-400` para cumplir **R2**.
- **Cambiado** "Mi cuenta" deja de alcanzarse solo desde Inicio en el teléfono: el avatar vive ahora en la barra de las cinco pestañas.
- **Sin cambios** Inicio conserva su buscador en línea además de la lupa, porque esa pantalla ES el buscador: abrir y buscar sigue tomando dos toques.
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.10f, 2.10g, 2.13 y 3.8c; [DECISIONES.md](DECISIONES.md) AD-023; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) secciones 2, 5.1 a 5.5 y 12; [BUSCADOR.md](BUSCADOR.md) secciones 1, 3, 7, 11 y 12.

**Verificación:** lint, `tsc -b` y build limpios. 1677 pruebas pasan (8 nuevas de `iniciales`). Siguen los mismos **4 fallos preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage), duplicados por el worktree obsoleto de la tarea 178. La app arranca sin errores de consola y redirige limpio a `/login`. **Sin verificar en navegador**: la barra vive detrás del login y esta sesión no tiene cuenta real de técnico.

### Cambiado (tarea 180): un solo nombre visible, y las secciones pasan a llamarse Guías y Equipos

**Área modificada:** chasis (`src/app/ShellNocturne.tsx`), jerarquía de navegación (`src/lib/navegacion.ts`), Inicio, y los textos visibles de las secciones Guías, Equipos, Diagnóstico, Ubicaciones y Personas.
**Motivo:** primera recomendación del turno 3 del handoff "Auditoría de Soluciones TI", reimportado hoy. La app se presentaba con dos nombres ("Soluciones IT" en login y bloqueo, "IT Brain" en Inicio y el sidebar) y una sección se llamaba igual que la app. Decisión aprobada por el usuario en `Decisiones aprobadas.md`.
**Impacto esperado:** la primera impresión deja de contradecirse, el encabezado vuelve a confirmar la pestaña activa, y la palabra "solución" queda libre para el bloque anidado dentro de un paso, que es donde significa algo. Sin cambios de comportamiento ni de datos.

- **Cambiado** el sidebar de escritorio dice "Soluciones IT" donde decía "IT Brain"; el glifo del cerebro se conserva como marca.
- **Cambiado** el encabezado de Inicio dice "Inicio" donde decía "IT Brain". Era la única pestaña en la que el rótulo y el encabezado no coincidían.
- **Cambiado** la pestaña y todos los rótulos de la sección Soluciones pasan a **"Guías"**; los de Dispositivos, a **"Equipos"**. Incluye las etiquetas de regreso de `navegacion.ts` (que alimentan `BotonVolver` en Ubicaciones, Personas y las fichas), los grupos del buscador global, los títulos de lista, los estados vacíos, el diálogo de eliminar, el editor de equipo y las etiquetas del historial.
- **Cambiado** el vocabulario visible del inventario se unifica en "equipo": "Equipos afectados", "Crear equipo", "Ningún equipo coincide", "Guardar equipo". **No** se tocaron los textos donde "dispositivo" significa el teléfono del técnico ("el archivo quedó guardado en este dispositivo", "bloqueo de este dispositivo"), que conservan la palabra a propósito.
- **Sin cambios** las rutas `/soluciones` y `/dispositivos`, los identificadores de código y el esquema de datos. El motivo está en [DECISIONES.md](DECISIONES.md) AD-022.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-022 (la decisión y sus límites) y [TAREAS.md](TAREAS.md) (registro de las diez tareas nuevas que salen de los turnos 2, 3 y 4 del handoff).

**Verificación:** lint, `tsc -b` y build limpios. 1669 pruebas pasan, incluidas las de `navegacion.test.ts` actualizadas a las etiquetas nuevas. Siguen los mismos **4 fallos preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage contra el `.env` real de la sesión), duplicados por el worktree obsoleto de la tarea 178. **Sin verificar en navegador**: la app exige login de técnico real, no disponible en esta sesión.

## 2026-07-27

### Corregido (tarea 179): el botón "Actualizar" del aviso de versión nueva no hacía nada

**Área modificada:** `src/components/ActualizacionDisponible.tsx`.
**Motivo:** reportado por el usuario en su teléfono justo al ir a revisar el rediseño de P1: pulsaba "Versión nueva disponible / Actualizar" y no ocurría nada.
**Impacto esperado:** el botón siempre recarga, así que un despliegue nuevo siempre se puede aplicar desde el aviso.

- **Corregido** la recarga ya no se delega en la librería. `updateServiceWorker` acaba llamando a `messageSkipWaiting()` de workbox-window, que es literalmente `registration.waiting && enviarMensaje(...)`: si en ese momento no hay worker en espera **no hace nada en silencio**, no se emite `controllerchange` y no hay recarga, pero el aviso sigue visible porque `needRefresh` continúa en `true`. El botón quedaba inerte de forma permanente hasta recargar a mano. `registration.waiting` puede ser `null` con el aviso delante si otra ventana de la app ya activó ese worker, o si el teléfono suspendió la app y el navegador lo activó por su cuenta: raro en escritorio y normal en móvil, que es por qué el fallo solo se veía en el teléfono. Ahora el componente engancha su propio `controllerchange` y además una red de seguridad por tiempo (2,5 s) que recarga igual; como el worker nuevo ya está activo en ese escenario, esa recarga trae la versión nueva de todos modos.
- **Cambiado** al pulsar, el botón pasa a "Actualizando..." y se deshabilita. Parte del reporte era que el toque no daba ninguna señal de haberse registrado.
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.1, [ARQUITECTURA.md](ARQUITECTURA.md) sección 7 y [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) (acciones transversales).

**Verificación:** typecheck, lint y build limpios. Reproducción de punta a punta en `vite preview` con Chrome real: con la v1 controlando la página, se construyó una v2 con un marcador visible, el aviso apareció, y pulsar "Actualizar" recargó dejando el marcador de la v2 en pantalla y el aviso retirado (`waiting` a `null`). Verificado también con el worker nuevo ya en espera antes de cargar la página, que es lo que pasa al abrir la app desde el icono. **El tramo concreto que fallaba (aviso visible con `waiting` en `null`) no se pudo reproducir en escritorio**: Chrome no permite redefinir `location.reload` para observar el intento de recarga sin navegar, y ese estado depende del ciclo de vida del móvil. Queda probado por lectura del código enviado (la guarda existe en el build minificado de workbox-window 7.4.1) y el arreglo es un superconjunto del comportamiento anterior: solo puede añadir una recarga que antes no ocurría.

### Rediseño de la lista de Soluciones (tarea 171, pantalla P1 del handoff "Auditoría de Soluciones TI")

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
