# Propuesta: optimizar la jornada del técnico (centro de operaciones, favoritos y actividad)

Fecha: 2026-07-20
Estado: las fases J1 (favoritos, tarea 108) y J2 (actividad reciente del equipo, tarea 109) quedaron implementadas, verificadas y archivadas el 2026-07-20, aplicando las decisiones D1 y D2 con sus opciones recomendadas (favoritos personales; solo bloque en Inicio, sin pantalla completa). Pendiente: que el usuario valide J1/J2, apruebe las fases J3 a J5 y resuelva las decisiones D3 a D5 de la sección 5.

Origen: encargo del usuario del 2026-07-20 con 12 puntos de mejora ("IT Brain como cerebro operativo"). Este documento contrasta cada punto contra el código real y separa tres cosas: lo que YA existe (más de lo que el encargo asume), lo que falta de verdad (fases J1 a J5) y lo que se recomienda NO hacer con su justificación.

## 1. Corrección de contexto

Dos precisiones sobre el encargo, antes del análisis:

- La aplicación NO es Flutter: es una PWA en React + TypeScript + Vite (ver [ARQUITECTURA.md](ARQUITECTURA.md) sección 3). Todo lo propuesto aquí se evalúa contra ese stack real.
- El principio "cada dato existe una sola vez, todo lo demás lo referencia" ya es el principio rector registrado de la arquitectura (ARQUITECTURA.md sección 15: grafo de referencias derivado, regla de referencia viva, copias de referencia como caché de presentación). Las fases N0 a N4 y el grupo de esquema N3 (tareas 54, 60, 61, 70) lo llevaron a la práctica. Ninguna fase de esta propuesta lo rompe; varias lo reutilizan.

## 2. Mapa de los 12 puntos contra el código real

| # | Punto del encargo | Estado real | Dónde |
|---|-------------------|-------------|-------|
| 1 | Inicio como panel de trabajo | PARCIAL: ya tiene buscador universal, "Continuar donde quedaste" con barra de progreso, accesos rápidos (Diagnóstico, Escáner), estado de sincronización en vivo (pastilla de la cabecera), Recientes, "Para empezar" y Descarga offline. Faltan: favoritos, actividad del equipo y pendientes | `src/features/inicio/InicioPage.tsx` (enCurso: líneas 134-157; PastillaSync: 453-504) |
| 2 | Actividad reciente global | NO EXISTE como vista. El DATO ya existe completo y sincronizado: la tabla `historial` registra cada creación, edición y eliminación de las 6 entidades, y `ejecuciones_diagnostico` cada diagnóstico corrido. Solo falta la vista global derivada (hoy el historial se consulta ficha por ficha) | Tablas en `src/lib/db.ts` (526-537, 503-516); visor por entidad en `src/features/historial/Historial.tsx` |
| 3 | Favoritos | NO EXISTE. Sí existe el patrón a imitar: `recientes` (tabla local Dexie, no sincronizada, resolución en vivo contra las fichas) | Patrón en `src/lib/recientes.ts` y `src/lib/db.ts` (637-642, versión 2) |
| 4 | Dispositivo como nodo central de relaciones | YA HECHO (~95 %). La ficha es una vista 360°: Información con filas copiables, ubicación como entidad enlazada, "Resolver con este equipo" (procedimientos, problemas frecuentes y credenciales vinculados, cada uno el inverso de un vínculo por referencia), inicio de diagnóstico por categoría, impacto de falla y dependencias, conexiones (equipos conectados), adjuntos, foto banner e intervenciones con línea de tiempo. Además creación contextual (reportar incidencia y guardar credencial precargadas) | `src/features/dispositivos/DispositivoPage.tsx` completo; inversos en `ProcedimientosDelEquipo.tsx`, `ProblemasDelEquipo.tsx`, `CredencialesDelEquipo.tsx`, `ConexionesFicha.tsx`, `ImpactoYDependencias.tsx` |
| 5 | Entidad Archivo reutilizable | SE RECOMIENDA NO HACER (ver sección 4.1). Alternativa ligera propuesta: deduplicación por hash al subir | Modelo actual: tabla `adjuntos` + `PasoAdjunto` inline (`src/lib/db.ts` 56-60, 559-572) |
| 6 | Etiquetas reutilizables | PARCIAL, con una REGRESIÓN detectada: la fase N0 había puesto un `<datalist>` con las etiquetas ya usadas en el editor, pero el rediseño Nocturne del editor (tarea 71) lo perdió; hoy `EtiquetasEditor` es texto libre sin sugerencias entre artículos (solo deduplica dentro del mismo artículo). Es exactamente el riesgo que señala el encargo (Impresora / impresora / Printer) | `src/features/soluciones/ArticuloForm.tsx` (EtiquetasEditor, 849-920); verificado: ningún `datalist` de etiquetas en `src/` |
| 7 | Formularios más cortos | MAYORMENTE HECHO: DispositivoForm ya tiene bloques con lo esencial primero y un plegable "Más información"; CredencialForm tiene bloques y presets de campos por tipo (tarea 104); ArticuloForm tiene 5 bloques con "Detalles" y "Publicación" plegados por defecto, plantillas por tipo y vista previa | `DispositivoForm.tsx` (689 líneas), `CredencialForm.tsx` (613), `ArticuloForm.tsx` (1000) |
| 8 | Editor de procedimientos en pestañas | CANDIDATO REAL: el editor es un solo scroll largo (1000 líneas de formulario + PasosEditor de 792) con secciones plegables. En móvil, pestañas reducirían el desplazamiento. Se propone como fase J5, la de mayor riesgo | `src/features/soluciones/ArticuloForm.tsx`, `PasosEditor.tsx` |
| 9 | Navegación cruzada total | YA HECHO como sistema: regla de referencia viva (`src/lib/referencia.ts`), inverso universal "Referenciado por" (`src/components/ReferenciadoPor.tsx` sobre el grafo derivado `src/lib/grafo.ts`), ubicación enlazada, conexiones enlazadas, jerarquía única de "Volver" (`src/lib/navegacion.ts`). Hueco menor: las etiquetas de un artículo no son tocables (no llevan a una búsqueda filtrada); se incluye en J4 | Ver ARQUITECTURA.md secciones 11 y 15 |
| 10 | Mostrar progreso | MITAD HECHO: los procedimientos ya muestran pasos hechos/pendientes, contador por paso, progreso compartido con subprocedimientos y "Continuar donde quedaste" con porcentaje. Falta la otra mitad: completitud de la ficha del dispositivo ("Falta: foto, serial, modelo"), que sí no existe. Es la fase J3. El editor de artículos ya tiene su indicador de completitud (10 señales) | Progreso: `src/lib/progresoPasos.ts`, `useProcedimientoEjecucion.ts`. Completitud de artículo: `ArticuloForm.tsx` |
| 11 | Historial técnico del dispositivo | YA HECHO: historial automático de campos + intervenciones manuales ("cambio de disco", con foto opcional) + cambios de cableado registrados en ambos extremos + línea de tiempo unificada. No hay nada que construir | `src/features/dispositivos/RegistrarIntervencion.tsx`, `src/features/historial/Historial.tsx` y `lineaDeTiempo.ts` |
| 12 | Nombre del módulo "Soluciones" | DECISIÓN DEL USUARIO (sección 5, D4). Análisis incluido, sin cambio automático | Etiqueta en `src/app/ShellNocturne.tsx` y textos varios |

Conclusión del mapa: de los 12 puntos, 4 ya están hechos (4, 9, 11 y la mitad de 10), 2 son decisiones (5, 12) y el trabajo real nuevo se concentra en 5 fases acotadas, todas sin tocar el esquema de Supabase.

## 3. Fases propuestas (todas sin esquema en Supabase)

Criterio de orden: valor por clic ahorrado primero, riesgo al final. Cada fase es una tarea del tablero (una "En proceso" a la vez, regla 4) con su propia verificación.

### Fase J1: Favoritos

1. Problema: el técnico repite la misma búsqueda varias veces al día para llegar a los 5 o 6 procedimientos y equipos que más usa. Recientes ayuda pero es volátil (se desplaza con cada consulta).
2. Justificación: reduce clics y tiempo (objetivos 1, 2 y 5 del encargo). Es la pieza de mayor valor por esfuerzo de toda la propuesta.
3. Solución: tabla local Dexie `favoritos` (versión 11 del esquema local; misma forma que `recientes`: clave `tipo:id`, tipo 'articulo' | 'dispositivo' | 'diagnostico', fecha). Módulo `src/lib/favoritos.ts` (alta/baja/lista resuelta en vivo, mismo patrón de resolución y omisión de eliminados que `obtenerRecientes`). Botón estrella en las tres fichas (ArticuloPage, DispositivoPage, DiagnosticosPage por fila o su ficha) y bloque "Favoritos" en Inicio, encima de Recientes. Local y no sincronizado, igual que recientes: los favoritos son hábitos de trabajo personales (decisión D1 si el usuario prefiere compartirlos).
4. Impacto: Inicio pasa de "menú + recientes" a panel personal. Cero migración, cero sincronización nueva.
5. Archivos: `src/lib/db.ts` (interfaz + versión 11), `src/lib/favoritos.ts` nuevo (+ pruebas), `src/features/inicio/InicioPage.tsx`, `src/features/soluciones/ArticuloPage.tsx`, `src/features/dispositivos/DispositivoPage.tsx`, `src/features/diagnostico/DiagnosticosPage.tsx`, icono estrella en `src/components/iconos.tsx` (vía `scripts/generar-iconos.mjs`, nunca a mano).
6. Riesgos: bajos. El único cuidado es la versión Dexie (los teléfonos ya tienen la 10 instalada; toda tabla nueva va en versión nueva, patrón ya establecido).
7. Verificación: pruebas de `favoritos.ts`; en navegador con sesión simulada: marcar, ver en Inicio, desmarcar, favorito de ficha eliminada se omite.

### Fase J2: Actividad reciente del equipo

1. Problema: no hay forma de responder "¿qué cambió el equipo hoy?" sin abrir ficha por ficha. Con 5 técnicos y sincronización en tiempo real, el dato ya viaja pero es invisible.
2. Justificación: mejora navegación y reduce duplicidad de trabajo (dos técnicos documentando lo mismo sin saberlo). Objetivos 4 y 5.
3. Solución: función pura `actividadReciente(historial, ejecuciones)` en `src/features/historial/actividadEquipo.ts` (+ pruebas): toma las últimas N entradas de `historial` (todas las entidades, agrupando ráfagas del mismo usuario sobre la misma ficha en un solo renglón) y las ejecuciones de diagnóstico, y produce renglones "Usuario editó X hace 2 h" con ruta a la ficha. Reutiliza los textos de `textoHistorial.ts` y el patrón de fusión de `lineaDeTiempo.ts`. En Inicio, bloque "Actividad del equipo" (colapsado a 5 renglones); pantalla completa `/actividad` solo si el usuario la quiere (decisión D2). Los accesos a la bóveda NO entran (auditoría restringida por permiso; mostrarla en Inicio filtraría metadatos a quien no debe verlos).
4. Impacto: es una VISTA derivada de tablas que ya existen y ya se sincronizan: cero esquema, cero escrituras nuevas, escalable por construcción (mismo argumento que el grafo derivado).
5. Archivos: `src/features/historial/actividadEquipo.ts` nuevo (+ pruebas), `src/features/inicio/InicioPage.tsx`, y `src/App.tsx` + `src/lib/navegacion.ts` solo si hay pantalla completa.
6. Riesgos: volumen (historial crece sin límite): la consulta debe ir por índice `fechaHora` con límite, nunca `toArray()` completo. Nombres de entidad: resolver en vivo con `mapaDeTextos` (regla de referencia viva) y caer al texto congelado del historial si la ficha ya no existe.
7. Verificación: pruebas de agrupación y orden; en navegador: editar una ficha y verla aparecer en Inicio.

### Fase J3: Completitud de la ficha del dispositivo

1. Problema: el inventario tiene fichas a medias (foto sin subir, serial vacío) y nadie lo ve hasta que necesita el dato en el sitio. Los campos de migraciones viejas pueden venir `undefined`, lo que agrava el hueco.
2. Justificación: mejora la calidad del inventario sin formularios más largos (objetivos 4 y 7). Es la mitad faltante del punto 10 del encargo.
3. Solución: función pura `completitudDispositivo(d)` en `src/features/dispositivos/completitud.ts` (+ pruebas): señales de peso igual (nombre, categoría, marca, modelo, serial, ubicación, estado, foto; IP solo cuando la categoría es de red), devuelve porcentaje y la lista "Falta: ...". En la ficha, una línea discreta bajo la cabecera solo cuando está incompleta ("Ficha al 70 %. Falta: foto, serial") con enlace a Editar. Mismo espíritu que el indicador de completitud del editor de artículos: guía, jamás bloquea.
4. Impacto: convierte cada apertura de ficha en una micro auditoría del inventario, gratis.
5. Archivos: `src/features/dispositivos/completitud.ts` nuevo (+ pruebas), `DispositivoPage.tsx`; opcional un punto ámbar en el listado (`DispositivosPage.tsx`), a confirmar para no ensuciar la lista.
6. Riesgos: bajos. Leer campos posiblemente `undefined` con `?? ''` (lección registrada de las migraciones sin backfill).
7. Verificación: pruebas de la función; navegador: ficha completa no muestra nada, ficha a medias lista lo que falta.

### Fase J4: Etiquetas reutilizables (repara la regresión N0)

1. Problema: `EtiquetasEditor` perdió las sugerencias de etiquetas existentes en el rediseño del editor (tarea 71). Hoy nada frena "Impresora" / "impresora" / "Printer" entre artículos distintos.
2. Justificación: reduce duplicidad (objetivo 4) y repone una función ya acordada en N0. Coherente con la filosofía registrada: vocabulario DERIVADO del uso real, no una tabla nueva de etiquetas que habría que administrar (mismo criterio que las marcas y las propiedades sugeridas).
3. Solución: (a) en `EtiquetasEditor`, chips de sugerencia con las etiquetas ya usadas en otros artículos (deduplicadas sin distinguir mayúsculas ni acentos, más frecuentes primero), tocables para agregar; escribir sigue permitido (etiqueta nueva legítima). (b) Normalización suave al guardar: recortar espacios y colapsar duplicados que solo difieren en mayúsculas, conservando la grafía más usada. (c) Hueco del punto 9 del encargo: hacer tocable cada etiqueta en la ficha del artículo, llevando a `/soluciones?etiqueta=<x>` (SolucionesPage ya filtra por query param de categoría; se suma el de etiqueta). NO se propone tabla `etiquetas`: para 5 técnicos, el costo de administrar la entidad supera al beneficio sobre el vocabulario derivado.
4. Impacto: etiquetas convergen solas hacia un vocabulario común y se vuelven navegación real.
5. Archivos: `src/features/soluciones/ArticuloForm.tsx` (EtiquetasEditor, 849-920), `ArticuloPage.tsx` (chips tocables), `SolucionesPage.tsx` (filtro por etiqueta), `src/lib/navegacion.ts` si el filtro afecta el "Volver".
6. Riesgos: bajos. La normalización al guardar solo toca el artículo que se está guardando (nunca reescritura masiva de otros artículos: eso sería una migración y se decidiría aparte).
7. Verificación: pruebas del helper de sugerencias/normalización; navegador: crear artículo y ver las etiquetas del resto como chips.

### Fase J5: Editor de procedimientos en pestañas (la de mayor riesgo, al final)

1. Problema: el editor de artículo es un solo scroll largo; en el teléfono, moverse entre "Pasos" y "Publicación" exige desplazamiento largo aunque los bloques se plieguen.
2. Justificación: reduce desplazamiento y carga cognitiva en móvil (objetivos 3, 4 y 8 del encargo).
3. Solución propuesta: pestañas fijas bajo la cabecera del editor: General (título, tipo, categoría, descripción, portada, etiquetas), Pasos (PasosEditor + requisitos + verificación final), Detalles (síntomas, causas, tiempo, dificultad, relacionados), Publicación (estado, versión, ruta de inicio, motivo). El estado del formulario ya vive en el componente padre, así que cambiar de pestaña no pierde datos; el borrador sigue siendo un solo guardado. Al entrar en esta fase conviene resolver a la vez la tarea 74 (las 4 funciones ocultas por el rediseño: equipos donde aplica, adjuntos por paso, orden de ruta, cambio mayor), porque decide qué pestaña las alberga.
4. Impacto: el editor más usado de la app queda cómodo en el teléfono.
5. Archivos: `src/features/soluciones/ArticuloForm.tsx` (reorganización grande), `PasosEditor.tsx` (sin cambios de lógica), pruebas de regresión manuales sobre crear/editar/duplicar/plantillas/vista previa.
6. Riesgos: MEDIOS, los mayores de la propuesta: es el formulario más complejo (validación al enviar debe señalar la pestaña con el error; el indicador de completitud debe seguir viendo todo). Recomendación: hacerla última, sola, y con maqueta o handoff del usuario si quiere decidir el diseño de pestañas.
7. Verificación: recorrido completo de creación y edición con datos reales en navegador, más las pruebas existentes del formulario.

## 4. Lo que se recomienda NO hacer, y por qué

### 4.1 Entidad "Archivo" independiente (punto 5 del encargo): NO

- El problema que la motiva casi no existe aquí: los archivos ya viven UNA vez en Supabase Storage y todo lo demás guarda solo la referencia (`PasoAdjunto.referencia`, `adjuntos.referencia`). Duplicar un procedimiento ya comparte referencias sin copiar archivos (decisión registrada de la tarea 48). Lo único que hoy puede duplicarse es que dos técnicos suban el mismo PDF por caminos distintos.
- El costo sería alto: tabla nueva + RLS + migración de la tabla `adjuntos` y de todos los `PasoAdjunto` inline en el JSON de cada artículo, tocando la tubería offline completa (cola `archivosPendientes`, cache `adjuntos-offline-v1`, precache). Riesgo de regresión en la función más delicada de la app (offline primero) para un equipo de 5 personas con 1 GB de Storage.
- Alternativa ligera si el duplicado real aparece: hash SHA-256 del contenido antes de subir; si ya existe un archivo con ese hash, reutilizar su referencia en vez de subir de nuevo. Es un cambio local a la tubería de subida, sin esquema y sin migración. Se propone dejarlo ANOTADO y no construirlo hasta ver duplicados reales (no agregar funciones porque sí, criterio del propio encargo).

### 4.2 Historial técnico del dispositivo (punto 11): ya existe, no construir nada

Intervenciones manuales con foto, cambios automáticos de campos, cambios de cableado en ambos extremos y línea de tiempo unificada ya cubren los ejemplos del encargo (cambio de IP queda registrado al editar el campo; cambio de disco es una intervención). Construir "una línea de tiempo" nueva duplicaría la existente.

### 4.3 Tabla de etiquetas, favoritos sincronizados o feed almacenado: no en esta ronda

Los tres tienen versión derivada o local que entrega el mismo valor sin esquema (secciones 3.J4, 3.J1, 3.J2). Si el uso real demuestra que se quedan cortos (por ejemplo, el equipo quiere favoritos compartidos), el salto a esquema se agrupa en un único lote como se hizo con N3.

## 5. Decisiones abiertas (solo el usuario)

- D1. Favoritos: ¿personales por dispositivo (recomendado, sin esquema) o compartidos por el equipo (requiere tabla en Supabase + RLS)?
- D2. Actividad del equipo: ¿solo bloque en Inicio (recomendado para empezar) o también pantalla completa `/actividad` con filtros?
- D3. ¿Anotar la deduplicación por hash de adjuntos como tarea futura (recomendado) o descartarla del todo?
- D4. Nombre del módulo "Soluciones". Análisis: "Procedimientos" se queda corto (el módulo también tiene manuales, configuraciones e incidencias); "Base de conocimiento" es preciso pero largo y frío para una pestaña móvil; "Conocimiento" es el mejor alternativo (describe el contenido completo y cabe en la pestaña). A favor de mantener "Soluciones": es la promesa al técnico (entra buscando una solución, no "conocimiento"), lleva un año de hábito del equipo y combina con Diagnóstico ("del problema a la solución"). Recomendación: MANTENER "Soluciones"; si el usuario prefiere precisión sobre hábito, "Conocimiento". No se cambia nada sin su decisión.
- D5. Bloque "Pendientes" en Inicio (punto 1 del encargo): el encargo lo pide pero no existe una entidad "pendiente" en el sistema, y crear un gestor de tareas es otro producto. Se propone un bloque DERIVADO con lo que ya significa "pendiente" en los datos reales: mis borradores (`articulos.estado = 'borrador'` del usuario actual), credenciales por vencer o vencidas (ya calculado en `src/lib/vencimiento.ts`, visible solo con permiso de bóveda) y sugerencias del equipo sin revisar (`SugerenciasEquipoPage`). ¿Se aprueba con ese contenido, se recorta, o se descarta el bloque?

## 6. Orden recomendado

J1 (favoritos) -> J2 (actividad) -> J3 (completitud) -> J4 (etiquetas) -> J5 (pestañas del editor). Las cuatro primeras son acotadas y de riesgo bajo; J5 es la única grande y conviene decidirla con el diseño a la vista. Cada fase entra al tablero como tarea propia y no se empieza la siguiente sin verificar y archivar la anterior.
