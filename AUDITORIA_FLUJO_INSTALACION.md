# Auditoría de rediseño del flujo del técnico

Análisis del flujo de trabajo real de un técnico de TI durante una instalación/configuración/mantenimiento, con el objetivo de que **cada dato exista una sola vez y todo lo demás lo referencie**, y que la aplicación haga el mayor trabajo posible automáticamente.

Escenario completo usado como hilo conductor: **conectar una impresora a un computador Windows**, desde que el técnico recibe la impresora hasta que termina la instalación y deja todo relacionado.

Roles desde los que se audita: Product Manager Senior, UX Designer Senior, Arquitecto de Software y Técnico de Soporte TI.

Fecha: 2026-07-23. Basado en lectura directa del código de `src/`.

---

## 0. Resumen ejecutivo (veredicto)

**La aplicación ya cumple, en gran medida, el principio "cada dato una sola vez".** No parte de cero: la arquitectura fue rediseñada explícitamente con ese norte (ver `PROPUESTA_BASE_CONOCIMIENTO.md`, ejecutada), y hoy ya existen las piezas que el encargo pide construir:

| Lo que pide el encargo | Estado en la app |
|------------------------|------------------|
| Los procedimientos referencian secretos, nunca los copian | **Ya existe** (`vinculoProtegido` guarda `{tipo, id, título}`; el secreto se descifra en vivo) |
| Composición de procedimientos por referencia (reusar otros) | **Ya existe** (subprocedimiento vinculado, solución vinculada, decisión vinculada, con progreso compartido) |
| Red solo contiene relaciones, no duplica el dispositivo | **Ya existe** (Red = `dispositivos` filtrado por `es_red` + tabla `conexiones`; nombres resueltos en vivo) |
| Crear procedimiento/incidencia/secreto desde la ficha con datos precargados | **Ya existe** (creación contextual con categoría y equipo precargados) |
| Nunca escribir un dato que ya existe en otra entidad | **Ya existe** en su mayoría (referencia viva, grafo derivado, "Referenciado por", ubicación/persona como entidad) |
| Trabajar desde la ficha del dispositivo sin cambiar de módulo | **Casi completo** (ficha 360°: información, seguridad, procedimientos, problemas, credenciales, conexiones, diagnóstico, historial, adjuntos) |

Por eso, el valor de esta auditoría **no es reinventar lo que ya funciona bien**, sino:

1. Cerrar los **huecos reales** que rompen el flujo del técnico.
2. Recomendar de forma honesta **qué NO cambiar** (evitar cambios que empeorarían el flujo, como convertir el editor a 7 pestañas).
3. Priorizar por impacto y proponer un plan por fases.

**El hueco más importante detectado:** los procedimientos e incidencias solo se ofrecen en la ficha del equipo si están vinculados **uno por uno**; no se ofrecen por **categoría**. Un procedimiento genérico "Instalar impresora de red" no aparece en una impresora concreta salvo que un técnico lo vincule a mano a cada impresora. Esto rompe el caso de la impresora y escala mal. (Detalle en H1.)

---

## 1. Recorrido del caso de uso: conectar una impresora a un PC Windows

Simulación del trabajo real, marcando en cada paso qué YA funciona (✅), qué funciona con fricción (⚠️) y qué falta (❌).

| # | Paso del técnico | Cómo lo resuelve la app hoy | Estado |
|---|------------------|-----------------------------|--------|
| 1 | Revisar si la impresora ya existe | Buscador global (Inicio) o buscador de Dispositivos o Escáner (QR/serial/placa) | ✅ |
| 2 | Revisar si el computador ya existe | Igual (ambos son `dispositivos`) | ✅ |
| 3 | Crear la impresora si no existe | Dispositivos > Crear; o Escáner > "Registrar equipo"; o alta rápida desde el formulario de conexión | ✅ / ⚠️ (el escáner no precarga el código leído, H3) |
| 3b| Crear el PC si no existe | Igual | ✅ |
| 4 | Asociar la ubicación | `SelectorUbicacion` (elegir/crear/texto); herencia de ubicación desde el otro extremo al conectar | ✅ |
| 5 | Asociar la topología de red | Ficha > Conexiones > Agregar (impresora de red: enlace con switch; impresora USB al PC: relación "relacionado") | ✅ |
| 6 | Asociar credenciales si hacen falta | Ficha > "Guardar secreto" (precargado) o "Seguridad" (campos protegidos del equipo) | ✅ |
| 7 | Buscar el procedimiento existente | Ficha > "Procedimientos de este equipo" / "Problemas de este equipo" | ❌ **solo si está vinculado por equipo, no por categoría (H1)** |
| 8 | Ejecutar el procedimiento | Ficha > "Ejecutar" (modo asistente, paso a paso, con cronómetro) | ✅ |
| 9 | Verificar funcionamiento | Checklist de "Verificación final" al terminar los pasos | ✅ |
| 10| Dejar todo relacionado | Grafo derivado, referencia viva, historial, "Referenciado por" | ✅ |

**Conclusión del recorrido.** El flujo está resuelto de punta a punta salvo el paso 7 (encontrar el procedimiento aplicable), con dos fricciones menores en el 3 (escáner) y en el arranque (Inicio no ofrece "crear" ante un equipo inexistente). Todo lo demás ya respeta el principio.

---

## 2. Análisis por módulo

### 2.1 Inicio

- **¿Es el mejor punto para empezar un trabajo?** Es un buen *hub* (buscador global + "Continuar donde quedaste" + atajos + recientes + pendientes). Pero para el caso "recibo hardware nuevo", el arranque natural es **Dispositivos** (buscar/crear) o el **Escáner**. Hoy los atajos de Inicio son solo "Diagnóstico inteligente" y "Escanear equipo".
- **Buscador contextual.** El buscador global ya sugiere dispositivos, procedimientos, diagnósticos, credenciales, ubicaciones y personas, agrupados por fuente, con tolerancia a errores y sinónimos. Lo que falta: cuando **no hay coincidencias**, no ofrece **crear** (el único "crear desde no-encontrado" está en el Escáner). (H9.)
- **Veredicto:** Inicio se mantiene como hub; se le añade un atajo "Registrar equipo" y un "crear" contextual en el estado sin resultados. No se rediseña.

### 2.2 Dispositivos (punto de partida natural)

- La ficha del equipo ya es una **vista 360°** que reúne, sin salir del módulo: Información, Seguridad (datos protegidos), "Resolver con este equipo" (diagnóstico + procedimientos + problemas + credenciales + creación contextual), Impacto y dependencias, Conexiones (con enlace a topología), Adjuntos, Intervenciones e Historial. Esto ya cumple casi todo lo que pide el encargo ("crear procedimiento, ver procedimientos, abrir credenciales, ver conexiones, abrir diagnósticos, historial, archivos, fotos").
- **Hueco:** "Procedimientos de este equipo" y "Problemas de este equipo" solo listan lo vinculado por `dispositivosAfectados` (equipo por equipo), no lo aplicable por **categoría**. En cambio, el botón "Iniciar diagnóstico" YA se ofrece por categoría. Inconsistencia. (H1.)
- **Veredicto:** el módulo ya es el centro de trabajo; solo hay que completar el paso 7 (H1).

### 2.3 Red

- Confirmado: **no duplica**. Los equipos de red son `dispositivos` con la bandera de categoría `es_red`; lo único propio del módulo es la tabla `conexiones`. Los nombres de los extremos se guardan como copia de referencia pero se **resuelven en vivo** (`nombreVivo`), así renombrar un switch se refleja en todas sus conexiones sin reescribir nada.
- **Veredicto:** correcto. Nada que cambiar. (H7, confirmación.)

### 2.4 Bóveda

- Confirmado: los pasos de un procedimiento **referencian** el secreto mediante `vinculoProtegido = {tipo, id, título}`. El secreto nunca viaja dentro del artículo; se descifra en vivo al ejecutar, con permiso de bóveda y contraseña maestra. Si el secreto cambia (rotación), **el procedimiento sigue funcionando sin tocarlo**.
- **Veredicto:** correcto. Nada que cambiar. (H8, confirmación.)

### 2.5 Soluciones (editor de procedimientos)

- **Orden de pestañas.** Hoy: General (tipo, título, descripción, objetivo, etiquetas, portada, equipos) → Pasos (requisitos, pasos, verificación) → Detalles (síntomas, causas, tiempo, dificultad, relacionados, notas) → Publicación (estado, ruta de inicio, cambio mayor, motivo). El flujo lineal que se propone (General → Requisitos → Equipos → Pasos → Verificación → Detalles → Publicación) **ya existe DENTRO de las cuatro pestañas**: la pestaña Pasos ya ordena requisitos → pasos → verificación, y "Equipos" vive en General. Convertirlo en 7 pestañas **empeoraría móvil** (7 pestañas no caben sin scroll horizontal; más carga cognitiva). (H5.)
- **"Equipos donde aplica" por criterios.** La propuesta de aplicar por categoría/marca/modelo/versión/ubicación tiene sentido, pero **la categoría ya está implícita**: tanto el artículo como el dispositivo tienen `categoria_id`. Resolver "procedimientos de la categoría de este equipo" no necesita esquema. Marca/modelo/versión sí necesitarían esquema nuevo y aportan poco sobre la categoría. (H1 cubre el 90%; H6 defiere marca/modelo.)
- **Procedimientos reutilizables.** Ya existe la composición por referencia (subprocedimiento vinculado). "Configurar impresión segura" **ya puede** reutilizar "Configurar PIN", "Configurar usuario", etc., sin copiar contenido, con progreso compartido. El hueco es de **descubribilidad**: la acción vive en una sección plegada ("Vínculos del paso") poco visible. (H4.)
- **Automatización al crear desde la ficha.** La categoría (por la ruta) y el dispositivo afectado **ya se precargan**. Marca/modelo NO son campos del artículo **a propósito** (el artículo referencia el equipo, no copia sus datos): pedir que se "precarguen" en el artículo sería introducir la duplicación que el propio encargo quiere evitar. Esto ya está bien resuelto. (H2, confirmación con matiz.)

---

## 3. Hallazgos (formato estructurado)

### H1 — Procedimientos e incidencias aplicables por categoría en la ficha del equipo · Prioridad: ALTA

- **Problema.** `procedimientosDeDispositivo` y `problemasDeDispositivo` filtran solo por `dispositivosAfectados` (vínculo equipo por equipo). Un procedimiento genérico ("Instalar impresora de red") no aparece en una impresora concreta salvo que se vincule a mano a cada una. Inconsistente con el diagnóstico, que sí se ofrece por categoría.
- **Impacto.** En el paso 7 del caso de uso, el técnico no encuentra el procedimiento desde la ficha y debe salir a Soluciones a buscar. Escala mal (N equipos x M procedimientos vinculados a mano). Es el hueco que más rompe "trabajar desde la ficha".
- **Solución.** En la ficha, además de "Específicos de este equipo" (los de `dispositivosAfectados`), mostrar "De esta categoría": procedimientos e incidencias publicados cuyo `categoria_id` coincida con la categoría del equipo. Consulta derivada pura, **sin esquema**. Reutiliza la lógica existente; se separa visualmente para no confundir lo específico con lo general.
- **Beneficios.** Un procedimiento sirve a toda su categoría automáticamente; cero vínculos manuales; coherencia con el diagnóstico; el técnico resuelve sin cambiar de módulo.
- **Riesgos.** Una categoría con muchos artículos podría alargar la sección. Mitigación: colapsar/limitar y ofrecer "Ver todos" enlazando a `/soluciones?categoria=<id>`.
- **Área afectada.** `src/features/dispositivos/procedimientosDeDispositivo.ts`, `problemasDeDispositivo.ts`, `ProcedimientosDelEquipo.tsx`, `ProblemasDelEquipo.tsx`, `DispositivoPage.tsx`.

### H2 — Automatización de datos al crear desde la ficha · Prioridad: MEDIA (mayormente confirmación)

- **Problema.** El encargo pide precargar categoría, marca, modelo y dispositivo al crear un procedimiento desde la ficha.
- **Análisis.** Categoría y dispositivo afectado **ya se precargan**. Marca/modelo no son campos del artículo a propósito: el artículo **referencia** el equipo (H1), no copia su marca/modelo. Copiarlos sería duplicación.
- **Solución.** Mantener el comportamiento actual. Con H1, un procedimiento creado "de categoría" aplica sin necesidad de vincular el equipo. Complemento: al "Documentar procedimiento" desde la ficha, ofrecer explícitamente elegir entre "para este equipo" o "para toda la categoría {X}".
- **Beneficios.** Coherencia con el principio; menos campos que llenar.
- **Riesgos.** Ninguno (se conserva lo existente).
- **Área afectada.** `DispositivoPage.tsx` (texto/opción del enlace de creación), `ArticuloForm.tsx`.

### H3 — El escáner no precarga el código leído al registrar un equipo · Prioridad: MEDIA

- **Problema.** Tras escanear un código no encontrado, "Registrar equipo" abre `/dispositivos/nuevo` en blanco; el técnico reescribe el serial/placa que la app acaba de leer.
- **Impacto.** Reintroducir un dato ya conocido. Viola "nunca escribir dos veces".
- **Solución.** Pasar el código como parámetro (`/dispositivos/nuevo?serial=<código>`) y precargarlo en `DispositivoForm` (campo serial, editable; el técnico puede moverlo a placa).
- **Beneficios.** Un dato menos que teclear; flujo escáner → alta sin fricción.
- **Riesgos.** Bajo. No se sabe si el código es serial o placa; se precarga como serial (lo más común de fábrica).
- **Área afectada.** `EscanerPage.tsx`, `DispositivoForm.tsx`.

### H4 — La composición de procedimientos existe pero es poco descubrible · Prioridad: MEDIA

- **Problema.** Reutilizar otro procedimiento dentro de un paso (subprocedimiento) está en una sección plegada al final del paso ("Vínculos del paso"). Un técnico podría no saber que puede componer en vez de copiar.
- **Impacto.** Riesgo de que se copie contenido en vez de referenciarlo, contra el principio.
- **Solución.** Subir la visibilidad de "Reutilizar procedimiento" (por ejemplo, junto a los botones "Tarea / Advertencia / Imagen" del paso, o con una ayuda contextual). UX-only, sin esquema.
- **Beneficios.** Fomenta la composición; menos duplicación de pasos.
- **Riesgos.** Bajo (solo presentación).
- **Área afectada.** `PasosEditor.tsx`.

### H5 — Orden de pestañas del editor: recomendación de NO cambiar a 7 pestañas · Prioridad: BAJA (decisión)

- **Problema.** Se plantea reordenar el editor a 7 secciones lineales.
- **Análisis.** El flujo lineal ya existe dentro de las 4 pestañas (Pasos ordena requisitos → pasos → verificación). 7 pestañas perjudican móvil (no caben, scroll horizontal, más carga cognitiva). Las 4 pestañas agrupan por fase mental y son mobile-first.
- **Solución propuesta.** **Mantener 4 pestañas.** No implementar el cambio a 7. Mejora opcional mínima: con H1, "Equipos donde aplica" pierde peso; podría moverse a Detalles para aligerar General.
- **Beneficios.** Se conserva la ergonomía móvil.
- **Riesgos.** Cambiarlo sería un retroceso de UX.
- **Área afectada.** `ArticuloForm.tsx`, `completitudArticulo.ts` (si se mueve un campo de pestaña).

### H6 — "Aplica a" por marca/modelo/versión (con esquema) · Prioridad: BAJA (deferida)

- **Problema.** Un procedimiento que aplica solo a un modelo concreto dentro de una categoría (no a toda la categoría) no se puede expresar con H1 solo.
- **Impacto.** Marginal una vez implementado H1: la mayoría de procedimientos aplican a nivel categoría.
- **Solución.** Un criterio `aplica_a` (JSON con marca/modelo/versión opcionales) en el artículo, emparejado contra el equipo. **Requiere esquema.**
- **Beneficios.** Precisión fina de aplicabilidad.
- **Riesgos.** Complejidad de emparejamiento; esquema nuevo; beneficio incierto antes de medir el uso tras H1.
- **Área afectada.** `articulos` (esquema), `ArticuloForm.tsx`, lógica de aplicabilidad.
- **Recomendación.** Deferir. Evaluar solo si tras H1 persiste fricción real.

### H7 — Red no duplica información del dispositivo · Prioridad: N/A (confirmación)

- **Estado.** Correcto. Red consume el inventario y solo añade relaciones. Nada que cambiar.

### H8 — Bóveda: los procedimientos referencian secretos · Prioridad: N/A (confirmación)

- **Estado.** Correcto. Los secretos se referencian por id, se descifran en vivo, y rotarlos no rompe ningún procedimiento. Nada que cambiar.

### H9 — Inicio: atajo "Registrar equipo" y "crear" ante búsqueda sin resultados · Prioridad: MEDIA

- **Problema.** El técnico que recibe hardware no tiene en Inicio un arranque directo a "registrar equipo"; y el buscador global, sin coincidencias, no ofrece crear.
- **Impacto.** Un par de toques y un cambio de módulo extra al arrancar un trabajo.
- **Solución.** (a) Añadir un atajo "Registrar equipo" a la rejilla de atajos de Inicio. (b) En el estado "Sin coincidencias" del buscador, ofrecer "Crear dispositivo" (con el texto buscado como nombre) y, según el contexto, "Crear procedimiento".
- **Beneficios.** Menos clics y menos navegación al empezar.
- **Riesgos.** Bajo (no ensuciar Inicio: máximo un atajo más).
- **Área afectada.** `InicioPage.tsx`.

### H10 — Relación impresora <-> PC · Prioridad: BAJA (confirmación)

- **Estado.** Existe el tipo de conexión 'relacionado' para equipos no de red (por ejemplo una impresora USB conectada a un PC). Funciona. Sin cambios necesarios.

---

## 4. Priorización por impacto

| Orden | Hallazgo | Prioridad | ¿Esquema? | ¿Rompe compatibilidad? |
|-------|----------|-----------|-----------|------------------------|
| 1 | H1 Procedimientos/incidencias por categoría en la ficha | ALTA | No | No |
| 2 | H3 Escáner precarga el código | MEDIA | No | No |
| 3 | H9 Inicio: atajo "Registrar equipo" + crear sin resultados | MEDIA | No | No |
| 4 | H4 Reutilización de procedimientos más visible | MEDIA | No | No |
| 5 | H2 Elegir "para este equipo" o "para la categoría" al crear | MEDIA | No | No |
| 6 | H5 Mantener 4 pestañas (decisión, no cambio) | BAJA | No | No |
| 7 | H6 "Aplica a" por marca/modelo/versión | BAJA (deferida) | **Sí** | No (aditivo) |

H7, H8, H10 son confirmaciones: la app ya lo hace bien.

---

## 5. Plan de implementación por fases

Todas las fases 1 y 2 son **sin esquema** y **no rompen compatibilidad** (aditivas o de presentación). La fase 3 se defiere.

### Fase 1 — Cerrar el caso de la impresora (alto valor, sin esquema)
- **H1**: sección "De esta categoría" en la ficha del equipo (procedimientos e incidencias por `categoria_id`), separada de los específicos, con "Ver todos".
- **H3**: escáner precarga el código en el alta.
- **H9**: atajo "Registrar equipo" en Inicio y "Crear" en el buscador sin resultados.

### Fase 2 — Reducir carga cognitiva y fomentar composición (UX, sin esquema)
- **H4**: hacer visible "Reutilizar procedimiento" en el editor de pasos.
- **H2**: al crear desde la ficha, elegir "para este equipo" o "para la categoría {X}".
- **H5**: decisión registrada de mantener 4 pestañas; ajuste opcional de mover "Equipos" a Detalles.

### Fase 3 — Aplicabilidad fina (con esquema, deferida)
- **H6**: `aplica_a` por marca/modelo/versión. Solo si tras la Fase 1 persiste fricción real.

### Verificación de cada fase (política de la regla 19)
Para cada cambio: código en verde (typecheck, lint, pruebas), **DOCUMENTACION_FUNCIONAL.md actualizado en la misma tarea**, entrada en su "Historial de cambios", verificación cruzada código<->documentación, y confirmación de que **no se introdujo duplicación** (se referencia, no se copia). Cada mejora se registra como tarea en TAREAS.md con el formato de la regla 19.

---

## 6. Qué NO se hará (y por qué)

- **No** convertir el editor a 7 pestañas (H5): empeoraría móvil; el flujo lineal ya existe dentro de las 4.
- **No** agregar marca/modelo como campos del artículo (H2): sería la duplicación que el encargo quiere eliminar; el artículo referencia el equipo.
- **No** reconstruir la composición de procedimientos (H4): ya existe; solo se hace más visible.
- **No** tocar Red ni el modelo de referencia de secretos (H7, H8): ya cumplen el principio.
