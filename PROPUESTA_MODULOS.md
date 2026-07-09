# Propuesta: mejoras por módulos (Soluciones, Diagnóstico, Dispositivos, Red y Bóveda)

Fecha: 2026-07-09
Estado: APROBADA para ejecutarse por fases (2026-07-09). Decisiones del usuario: empezar por S1; reactivar etiquetas (SÍ, se adelanta a S1 porque no requiere esquema); renombrar "Notas" a "Bóveda" completo (entra en B1); el nombre sigue siendo Soluciones IT ("IT Brain" queda informal). Pendientes de decidir sobre la marcha: estados del artículo (4 o versión mínima), nodos compartidos entre diagnósticos (recomendado NO) y si R2 se hace tras probar R1.

Origen: cinco documentos entregados por el usuario el 2026-07-09, uno por módulo, con 71 puntos en total. Esta propuesta analiza cada punto contra el código real, señala lo que ya existe (que es mucho: las tareas 38 a 47 ya cubrieron buena parte), agrupa lo nuevo en fases ejecutables, marca las contradicciones con decisiones anteriores del propio usuario y recomienda un orden.

Nota sobre el nombre: los documentos llaman a la aplicación "IT Brain". Hoy la app se llama "Soluciones IT" en el manifiesto, el título y la documentación. Si el nombre nuevo es oficial, renombrarla es una tarea pequeña aparte (ver sección 8).

## 1. Resumen ejecutivo

De los 71 puntos, alrededor de 25 ya están resueltos total o casi totalmente (respuestas dinámicas del diagnóstico, regreso exacto tras ejecutar un procedimiento, historial inmutable con usuario y motivo, duplicar dispositivos, botón Bloquear, generar contraseña, sinónimos del buscador, árbol de dependencias de red, entre otros). Otros ~10 son renombres y reorganizaciones visuales de bajo riesgo. El resto se agrupa en tres bloques de esfuerzo creciente:

1. **Campos nuevos en JSON existentes** (sin tocar Supabase): título interno de las preguntas del diagnóstico, indicador de completitud, plantillas, vista previa, duplicar artículo, foto principal del dispositivo, impacto de falla en la topología.
2. **Un único cambio de esquema agrupado** (una sola intervención del usuario en Supabase): estado y versión del artículo, etiquetas (si se aprueba reactivarlas), relacionados a nivel de artículo, vencimiento de credenciales, motivo de la retroalimentación del diagnóstico y auditoría de la bóveda.
3. **Dos proyectos grandes** que conviene decidir por separado: la vista 360° del dispositivo (que ya existe como tarea 39 y estos documentos terminan de diseñar) y el mapa interactivo de red con zoom y panel lateral (lo más costoso de todo el paquete).

Hay 4 puntos donde recomiendo NO hacer lo pedido (o hacerlo distinto), explicados en su sección: nodos compartidos entre diagnósticos (3.3), detección de menciones de dispositivos al escribir (2.12), monitoreo por ping desde la PWA (5.15) e indexar el contenido cifrado de la bóveda en el buscador global (6.13).

Y hay 3 decisiones que solo el usuario puede tomar porque contradicen decisiones suyas anteriores: reactivar las etiquetas (retiradas el 2026-07-03), renombrar la pestaña "Notas" a "Bóveda" (el nombre neutro fue una decisión de discreción) y adoptar el nombre "IT Brain".

---

## 2. Módulo Soluciones (14 puntos)

### Qué ya existe

| Punto | Estado | Dónde |
|---|---|---|
| 7. Duplicar | NO existe para artículos, pero el patrón sí | Dispositivos ya duplica con `/dispositivos/nuevo?copiarDe=<id>` (`DispositivoForm.tsx`). Copiarlo a artículos es directo; los adjuntos comparten referencia de Storage sin copiar archivos (los archivos nunca se borran de Storage, ver ARQUITECTURA). |
| 4. Versiones (parcial) | El historial ya conserva TODO | Cada guardado registra usuario, fecha, campo, valores anterior/nuevo y motivo (`historial`, inmutable). Falta solo el "número de versión" legible (1.0, 1.1). |
| 9. Formulario adaptativo (parcial) | HECHO para problema_frecuente | `ArticuloForm.tsx`: síntomas, causas y dispositivos afectados solo aparecen con ese tipo (tarea 38). |
| 11. Relacionados (parcial) | HECHO por paso | Subprocedimiento, solución y decisión por paso/tarea. Falta la sección a nivel de artículo completo. |
| 12. Recomendaciones (parcial) | HECHO en parte | Anti duplicados al escribir el título (tarea 45) y sugerencia de vincular procedimiento existente al titular un paso (`SugerenciaVinculo`). |
| 13. Integración | En curso | Bóveda por paso y por tarea (40/47), dispositivos afectados (38), diagnóstico (46). Lo que falta es la tarea 39. |

### Fase S1: constructor sin tocar el modelo (recomendada primero)

- **Título dinámico (punto 1)**: "Nuevo procedimiento / Nueva solución / Nuevo manual..." según el tipo seleccionado, en vivo. `TIPOS_ARTICULO` ya tiene las etiquetas; falta un mapa tipo→sustantivo con género. Trivial.
- **Formulario por bloques (punto 2)**: reorganizar `ArticuloForm.tsx` en las 5 secciones pedidas (Información general / Configuración / Antes de comenzar / Desarrollo / Finalización) con encabezados y divisores, el mismo estilo que la tarea 47 dio a cada paso. Solo presentación, cero cambio de datos. Detalle: "Descripción" e "Imagen de portada" (tarea 47) caen naturales en "Información general".
- **Vista previa (punto 6)**: botón que abre un modal (o sección plegable) renderizando `ProcedimientoVista` con los datos EN MEMORIA del formulario (`prepararProcedimientoParaGuardar` ya produce el objeto exacto). Ojo: el progreso local usa `articuloId`; la vista previa debe montarse con las casillas deshabilitadas o un id efímero para no ensuciar `progresoPasos`.
- **Duplicar procedimiento (punto 7)**: botón "Duplicar" en `ArticuloPage` → `/soluciones/:categoriaId/nuevo?copiarDe=<id>`. Al duplicar se regeneran TODOS los ids internos (pasos y bloques) para que el progreso local jamás se cruce entre original y copia; título "Copia de ...". Los `PasoAdjunto` conservan la misma referencia de Storage (compartir archivo es correcto y barato).
- **Indicador de completitud (punto 10)**: función pura `completitudProcedimiento(articulo, procedimiento)` que puntúa la presencia de portada, descripción, objetivo, requisitos, tiempo, dificultad, verificación final, imágenes y vínculos, y devuelve el porcentaje más la lista de sugerencias. Se muestra como barra + chips desplegables encima del botón Guardar. Nunca bloquea el guardado. Probable con pruebas unitarias.
- **Plantillas (punto 8)**: al crear un artículo nuevo, si el formulario está vacío y se elige un tipo, ofrecer "¿Empezar con la estructura recomendada para {tipo}?" que precarga pasos/campos de ejemplo (definidos como datos en `src/features/soluciones/plantillas.ts`, no hardcodeados en el componente). Nunca pisa contenido ya escrito. Las plantillas son editables por nosotros en código; una gestión de plantillas por el equipo sería fase futura.

### Fase S2: adaptación por tipo y recomendaciones (medio)

- **Punto 9 (priorizar por tipo)**: reordenar/plegar secciones según el tipo (instalación abre "Antes de comenzar"; configuración destaca advertencias y credenciales; problema_frecuente ya tiene su bloque). Implementable como un mapa tipo→orden/visibilidad de secciones sobre la estructura de bloques de S1. No inventar campos nuevos por tipo todavía ("Parámetros", "Capítulos"): los tipos actuales cubren el contenido con los bloques existentes.
- **Punto 12 (recomendaciones contextuales)**: agregar solo las baratas y fiables: (a) tipo instalación/configuración sin requisitos → chip "Agrega requisitos"; (b) advertencia sin imagen en el mismo paso → chip "Una imagen explicativa ayuda"; (c) las de credencial y vínculo ya existen. **Recomiendo NO hacer** la detección de menciones de dispositivos en el texto libre: con nombres reales ("Impresora Caja 2") produce falsos positivos constantes y exige indexar mientras se escribe; el selector de dispositivos afectados ya cubre el caso con intención explícita.

### Fase S3: estado, versión, etiquetas y relacionados (UN cambio de esquema)

Agrupar en una sola actualización de `schema.sql` (una sola intervención en Supabase):

- **Estado del documento (punto 5)**: columna `estado` en `articulos` (`borrador | en_revision | publicado | obsoleto`), default `publicado` (todo lo existente queda oficial). Efectos: borradores/obsoletos con banda visual, excluidos del buscador global, de las rutas de inicio, de los vinculables y del Diagnóstico (salvo para quien edita). Advertencia honesta: en un equipo de 5, el paso "en revisión" puede ser burocracia sin un flujo de aprobación real (que es punto 14, futuro); una alternativa mínima es empezar con `borrador | publicado | obsoleto`.
- **Versión (punto 4)**: columna `version` (texto "1.0"). Automática al guardar: cambios sobre un publicado suben la menor (1.0→1.1); un checkbox "Cambio mayor" sube la mayor (→2.0). El historial ya conserva el contenido anterior de cada versión; el visor de versiones completo y la comparación son punto 14 (futuro).
- **Etiquetas (punto 3)**: ⚠ DECISIÓN DEL USUARIO. La columna `etiquetas` existe pero el propio usuario decidió retirar su edición, visualización e indexación el 2026-07-03. Reactivarlas es fácil (editor de chips + volver a indexar en MiniSearch), pero hay que confirmar que se revierte esa decisión. Nota: los sinónimos (tarea 45) ya resuelven parte de lo que las etiquetas buscaban.
- **Relacionados a nivel de artículo (punto 11)**: columna `relacionados jsonb` (lista `{id, titulo}`, mismo patrón de copia de referencia). Sección al final del formulario y de la vista. Bonus barato: mostrar también los inversos ("aparece como relacionado en...") calculados localmente.

Punto 14 (aprobaciones, firmas, exportar PDF/Word, IA): no se implementa ahora; la propuesta anterior deja la arquitectura lista (estado + versión + historial son la base de todo eso). Exportar a PDF sería la primera candidata cuando se pida.

---

## 3. Módulo Diagnóstico Inteligente (14 puntos)

### Qué ya existe (más de lo que el documento asume)

| Punto | Estado | Dónde |
|---|---|---|
| 2. Respuestas dinámicas | HECHO | `OpcionDiagnostico` es una lista sin límite; Sí/No es solo el prellenado de `crearNodo` y el editor tiene "+ Respuesta" (`DiagnosticoForm.tsx:396`). No hay nada fijo que reemplazar. |
| 5. Destinos (casi todo) | HECHO en gran parte | Cada respuesta ya elige: continuar a otra pregunta, ejecutar un procedimiento, mensaje final, o combinaciones. "Abrir una solución" ES ejecutar un artículo (las soluciones son artículos con procedimiento). "Volver al paso anterior" existe en el runner (botón Volver deshace la última respuesta). Solo falta pulir la etiqueta "Termina aquí" (fase D1). |
| 6. Integración con procedimientos + regreso exacto | HECHO | Tarea 46: `ArticuloEnDiagnostico` ejecuta con `AsistenteVista` y regresa solo al punto exacto; el progreso vive en `progresoDiagnostico` y nunca se pierde. |
| 7. Soluciones + "¿quedó resuelto?" | HECHO | El resultado final pregunta "¿Quedó resuelto el problema?" (Sí/No) y lo registra. |
| 8. Validación (parcial) | HECHO estática | `validarNodos`: preguntas sin salida, destinos inexistentes, ciclos, auto referencias, preguntas inalcanzables y duplicadas de facto. Falta el recorrido de prueba interactivo y detectar artículos vinculados eliminados. |
| 9. Buscador | HECHO | Sinónimos + fuzzy + prefijos (tarea 45); los diagnósticos se indexan por título, descripción, preguntas y respuestas. Las "etiquetas" dependen de la decisión S3. |
| 11. Registro de estadísticas | HECHO el registro | `ejecuciones_diagnostico`: usuario, fecha, duración, camino, procedimientos ejecutados, resultado. Falta el TABLERO (era F3, opcional pendiente). |
| 14. Nodos futuros | LISTO el modelo | El comentario de diseño en `db.ts` ya prevé tipos de nodo nuevos sin romper el modelo. |

### Fase D1: pulido del editor (rápida)

- **Punto 1**: "+ Diagnóstico" → "+ Crear diagnóstico" (`DiagnosticosPage.tsx:60`).
- **Punto 4**: campo `tituloInterno` en `NodoDiagnostico` (JSON, sin esquema). Se muestra en la tarjeta del editor y en los selectores de destino ("Continúa en: Verificar alimentación"), que hoy recortan la pregunta a 40 caracteres. Opcional y normalizado como el resto.
- **Punto 5 (etiqueta)**: "Termina aquí (mensaje o procedimiento final)" → "Destino: termina aquí (mensaje final o procedimiento)". Cosmético; el modelo no cambia.
- **Punto 13**: agregar "Duplicar pregunta" a la tarjeta (copia el nodo con id nuevo y sin destinos entrantes). Mover/eliminar/agregar respuesta ya existen.

### Fase D2: "Probar diagnóstico" (medio)

- Botón en el editor que abre el runner en **modo prueba**: mismo `DiagnosticoRunPage` con un flag que (a) usa los nodos EN MEMORIA del formulario (aún sin guardar), (b) no toca `progresoDiagnostico` ni registra ejecución, (c) muestra una banda "Modo prueba". La detección de bucles/salidas/destinos ya la hace `validarNodos` al guardar; lo nuevo es la validación asíncrona de artículos vinculados eliminados (consultar `db.articulos` por los `articuloId` referenciados) que se suma a la lista de problemas.

### Fase D3: retroalimentación con motivo (cambio de esquema, va con el grupo S3)

- **Punto 12**: al responder "No" al cierre, pedir motivo (lista: la solución no funcionó / no encontré mi problema / faltan pasos / encontré otra solución / otro) y, si es "encontré otra solución", un texto libre. Columnas nuevas en `ejecuciones_diagnostico`: `motivo`, `solucion_propuesta`. Las propuestas del equipo se listan en una vista simple ("Sugerencias del equipo") para que quien mantiene la base las convierta en artículos. Sin flujo de aprobación formal todavía.

### Fase D4: "Problemas frecuentes" en Inicio + tablero (cuando haya datos)

- **Punto 10**: sección en Inicio con los diagnósticos más ejecutados (agregación local sobre `ejecuciones_diagnostico`), con fallback a los más recientes mientras no haya volumen. Barata una vez que el equipo use el módulo.
- **Punto 11 (tablero)**: es la F3 que quedó opcional: ejecuciones, tiempo promedio, tasa de éxito, procedimientos más usados. Recomiendo hacerla junto con D4.

### Punto 3: nodos reutilizables entre diagnósticos — RECOMIENDO NO (por ahora)

Compartir nodos entre árboles suena bien pero cambia el costo de mantenimiento de golpe: editar una pregunta compartida altera N diagnósticos en silencio, la validación deja de ser local a un árbol (ciclos y alcanzabilidad cruzarían diagnósticos) y el editor necesita gestión de dependencias. La reutilización que de verdad ahorra trabajo ya existe: los procedimientos y soluciones se vinculan sin duplicarse, que es donde vive el contenido pesado; las preguntas son texto corto. Alternativa barata que sí propongo: "Duplicar pregunta" (D1) y "Duplicar diagnóstico" completo. Si algún día hay cientos de diagnósticos con las mismas preguntas, se rediseña con datos reales.

---

## 4. Módulo Dispositivos (13 puntos)

### Qué ya existe

| Punto | Estado | Dónde |
|---|---|---|
| Duplicar | HECHO | `?copiarDe=` en `DispositivoForm.tsx`. |
| 5. Historial | HECHO | Cambios automáticos campo a campo + intervenciones manuales con foto (`RegistrarIntervencion`), con usuario, fecha y descripción. Cambios de conexión también se registran. |
| 6. Procedimientos (parcial) | HECHO por categoría | La ficha enlaza "Ver procedimientos de {categoría}". Lo específico por equipo es la tarea 39. |
| 7. Problemas frecuentes (base) | HECHO el vínculo | `dispositivosAfectados` (tarea 38) une incidencias con equipos; falta mostrar el inverso en la ficha (39). |
| 8. QR | HECHO el flujo | El escáner resuelve el código y abre la ficha (`resolverCodigo.ts`); "vista completa" = enriquecer la ficha, no cambiar el QR. |
| 9. Buscador (casi) | HECHO en gran parte | El buscador global ya encuentra por nombre, marca, modelo, serie, placa, IP, ubicación, estado y observaciones. Falta indexar `detalles` (propiedades personalizadas): una línea en `useIndiceBusqueda.ts`. |
| 10. Relaciones (base) | HECHO el modelo | `conexiones` ya relaciona dispositivos (enlace/instalación) y la ficha las muestra (`ConexionesFicha`). |

### Fase Dis1: presentación y estado (rápida)

- **Puntos 1 y 2**: ficha y formulario por bloques (Información general / Identificación / Ubicación / Conectividad / Propiedades personalizadas) y renombrar "Campos adicionales" → "Propiedades personalizadas". Los ejemplos por tipo del documento entran como placeholder/sugerencias, no como plantilla rígida (la decisión de campos libres en vez de plantillas por categoría fue deliberada y sigue siendo correcta).
- **Punto 4**: indicador de color por estado. `ESTADOS_SUGERIDOS` ya existe; mapear los conocidos (🟢 en servicio, 🟡 en mantenimiento, 🔴 fuera de servicio, ⚫ retirado) y dejar color neutro para estados libres. Aplicar en ficha, listado y (fase R1) topología.
- **Punto 9**: indexar los valores de `detalles` en el buscador global.

### Fase Dis2: fotografía principal (media)

- **Punto 3**: mismo patrón de la portada de procedimientos (tarea 47): campo `foto` en la ficha... con una diferencia: `dispositivos` no tiene columna JSON libre, así que requiere columna nueva (`foto jsonb`) → va al grupo de esquema de S3, o alternativa sin esquema: convención sobre la tabla `adjuntos` existente (el adjunto marcado como principal). Propuesta concreta: columna `foto jsonb` (referencia + nombre + tipo), subida comprimida con cola offline, mostrada en ficha, listado, resultados del buscador (el campo `portadaRef` del índice ya existe y lo soporta gratis) y al escanear el QR.

### Fase Dis3 = tarea 39 (la vista 360°)

Los puntos 6, 7, 10, 11 y 12 SON la tarea 39 del tablero, y este documento aporta su diseño: ficha por secciones (no pestañas separadas de la ruta: plegables tipo acordeón conserva el enlace único y funciona offline igual), con Información / Procedimientos del equipo / Problemas frecuentes / Historial / Archivos / Relaciones. Para "procedimientos del equipo" hace falta el vínculo artículo→dispositivo específico (hoy solo hay categoría y dispositivosAfectados): propuesta: reutilizar `dispositivosAfectados` generalizándolo a cualquier tipo de artículo (la columna ya existe y acepta datos de cualquier tipo sin romper nada, según el propio diseño de la tarea 38). Para relaciones no-red (punto 10: "POS relacionado con impresora"), usar `conexiones` tipo 'enlace' sin puerto o agregar tipo 'relacionado' (una migración pequeña de check constraint, va al grupo de esquema).

---

## 5. Módulo Red (15 puntos)

### Qué ya existe

| Punto | Estado | Dónde |
|---|---|---|
| 1. Creación única | HECHO | "+ Equipo" de Red redirige al formulario de Dispositivos. |
| 13. Grafo, no imagen | HECHO | La topología nunca fue un dibujo: `conexiones` son relaciones y `arbol.ts` la construye en vivo, corta ciclos y responde "¿qué depende de X?". |
| 9. Dependencias (mitad) | HECHO hacia abajo | El árbol muestra qué depende de cada equipo. Falta la vista inversa ("depende de: puerto 12 → switch → servidor"). |
| 6. Tipos de conexión (dato) | HECHO el dato | `medio` (UTP, fibra, inalámbrico) y puerto ya se guardan y se muestran como texto (`via`). Falta el estilo visual. |

### Fase R1: enriquecer el árbol actual (media, alto valor)

Sin cambiar la arquitectura ni agregar dependencias:

- **Punto 5**: punto de color de estado en cada nodo del árbol (reutiliza el mapeo de Dis1).
- **Punto 6**: distinguir el medio visualmente en la insignia `via` (icono/color: cable, Wi-Fi, fibra) en vez de solo texto.
- **Punto 10 (impacto de falla)**: función pura sobre el árbol que cuenta descendientes por categoría; al tocar un nodo (o en su ficha), "Si este equipo falla, quedan sin servicio: 12 POS, 4 impresoras, 2 AP". Es la consulta estrella y sale casi gratis del árbol existente.
- **Punto 9 (depende de)**: en la ficha del dispositivo, la cadena ascendente hasta la raíz (camino inverso sobre `conexiones`).
- **Punto 7 (filtros)**: filtros por categoría y estado en `RedPage` (como los de Dispositivos) y opcionalmente atenuar en la topología lo que no coincide.
- **Punto 8 (buscar en la topología)**: caja de búsqueda en `TopologiaPage` que expande automáticamente las ramas hasta el equipo, lo resalta y hace scroll (el "zoom" del documento aplica a la fase R2).
- **Punto 11 (historial resumido)**: en el panel/ficha, la última entrada del historial del equipo (ya está local).
- **Punto 12**: botón "Iniciar diagnóstico" desde el nodo → lista de diagnósticos de la categoría del equipo (el diagnóstico "personalizado por dispositivo" real llega con la tarea 39).

### Fase R2: mapa interactivo (grande, decidir después de R1)

Los puntos 2, 3 y 4 (mapa con pan/zoom, nodos arrastrables, panel lateral) son el proyecto más costoso de los cinco documentos: exige un lienzo SVG con layout automático, gestos táctiles (la app es móvil primero) y estado de cámara. Es viable sin dependencias pesadas (SVG propio + los gestos ya dominados en el visor de imágenes), pero recomiendo hacerlo SOLO si el árbol enriquecido de R1 se queda corto con la infraestructura real del equipo. R1 entrega el 80 % del valor (dependencias, impacto, estados, búsqueda) por una fracción del costo. Si se aprueba R2, el panel lateral del punto 3 reutiliza la ficha existente en versión resumida.

- **Punto 15 (monitoreo, ping)**: honestidad técnica: una PWA no puede hacer ping ICMP ni escanear la red desde el navegador. El estado automático exigiría un componente fuera de la app (un agente o backend), que hoy no existe. Queda para el futuro con esa aclaración; el modelo de estados de Dis1 deja el terreno listo.

---

## 6. Módulo Bóveda (15 puntos)

### Qué ya existe

| Punto | Estado | Dónde |
|---|---|---|
| 12. Bloquear ahora | HECHO | Botón "Bloquear" en `BovedaPage` + autobloqueo por inactividad configurable. |
| 9. Visualización | HECHO | `CampoSecreto`: oculto por defecto, mostrar/ocultar, copiar usuario y contraseña por separado; al bloquear se oculta todo (las claves viven solo en memoria). |
| Generar contraseña | HECHO | Botón "Generar" en `CredencialForm`. |
| 5. Integración con procedimientos | HECHO | `CredencialEnPaso` por paso (y por tarea individual desde la tarea 40): botón contraído, contraseña maestra, regreso sin perder progreso. Exactamente lo pedido. |
| 6. Integración con diagnóstico | HECHO vía procedimientos | Los procedimientos que el diagnóstico ejecuta muestran sus credenciales solo al llegar a ese paso. |
| 3. Propiedades (dato) | HECHO el modelo | `extras` cifrados sin límite; solo falta el renombre. |
| 7. Acceso contextual (parcial) | HECHO en procedimientos | El contexto de dispositivo llega con la tarea 39 (punto 4). |

### Fase B1: presentación (rápida)

- **Punto 3**: "Campos adicionales" → "Propiedades protegidas".
- **Punto 2**: formulario por bloques (Información general / Credenciales / Ubicación / Propiedades protegidas). Los campos ip y url ya existen dentro del cifrado.
- **Punto 10 (parcial)**: mostrar "última modificación" (updatedAt ya existe). "Creada" exige guardar la fecha al crear (campo nuevo dentro del bloque cifrado, sin esquema); "último acceso" depende de la auditoría (B3).

### Fase B2: vencimiento (cambio de esquema, va con el grupo S3)

- **Punto 11**: columna `vence_en date` en `credenciales` (la fecha NO es secreta a propósito: permite avisar sin desbloquear). Aviso ámbar al acercarse, alerta roja al vencer, visibles en la lista de la bóveda y en `CredencialEnPaso`. El punto 10 ("próxima rotación") es este mismo campo.

### Fase B3: auditoría de consultas (cambio de esquema)

- **Puntos 8 y 10 (último acceso)**: tabla nueva `accesos_boveda` solo-inserción (patrón de `historial`/`ejecuciones_diagnostico`): usuario, credencial, acción (consultó/mostró/copió usuario/copió contraseña/modificó/eliminó), fecha. Se muestra en la ficha de la credencial y alimenta "último acceso". Honestidad: es trazabilidad de buena fe del equipo (se registra desde el cliente; no detiene a un atacante con la maestra), y así debe presentarse.

### Punto 13: buscador de credenciales — hacerlo distinto a lo pedido

Buscar por usuario, IP, URL o propiedades exige leer contenido CIFRADO. Indexarlo en el buscador global (MiniSearch persistente en memoria de toda la app) violaría la regla de que los secretos nunca salen del descifrado puntual. Propuesta segura: buscador local DENTRO de la sección Bóveda que, solo mientras está desbloqueada, descifra en memoria y filtra por cualquier campo; al bloquear, se descarta. El buscador global sigue encontrando solo título y categoría (como hoy, y solo desbloqueada).

### Punto 1: renombrar "Notas" → "Bóveda" — DECISIÓN DEL USUARIO

El nombre "Notas" con icono neutro fue una decisión deliberada de discreción (ARQUITECTURA sección 8): que la sección no anuncie que guarda contraseñas. Como la pestaña solo la ven los usuarios con permiso, el riesgo restante es el de pantalla a la vista de terceros. Si la discreción ya no importa, el renombre es trivial. Alternativa intermedia: llamarla "Bóveda" solo dentro (títulos internos) y dejar "Notas" en la barra.

Puntos 4 y 14 (credenciales por dispositivo y relaciones): son la tarea 39 (la sección "Credenciales disponibles" de la ficha del equipo, con permiso y maestra). Punto 15 (carpetas, rotación automática, MFA, gestores externos): futuro; la arquitectura actual (bloques cifrados autocontenidos + tablas solo-inserción) no lo obstaculiza.

---

## 7. Orden recomendado de ejecución

| # | Fase | Contenido | Esfuerzo | Requiere esquema |
|---|---|---|---|---|
| 1 | S1 | Constructor de Soluciones: título dinámico, bloques, vista previa, duplicar, completitud, plantillas | Medio | No |
| 2 | D1 | Pulido del editor de diagnósticos: crear diagnóstico, título interno, destino, duplicar pregunta | Bajo | No |
| 3 | Dis1 + B1 | Bloques y renombres de Dispositivos y Bóveda, estados con color, indexar propiedades | Bajo-medio | No |
| 4 | R1 | Árbol de red enriquecido: estados, medios, impacto de falla, "depende de", filtros, búsqueda | Medio | No |
| 5 | D2 | Probar diagnóstico (modo prueba + validación de vínculos rotos) | Medio | No |
| 6 | Dis2 | Fotografía principal del dispositivo | Medio | Sí (agrupar) |
| 7 | GRUPO ESQUEMA | S3 (estado, versión, ¿etiquetas?, relacionados) + B2 (vencimiento) + D3 (motivo) + B3 (auditoría) + foto de Dis2 + tipo 'relacionado' en conexiones. UNA sola actualización de schema.sql | Alto (repartido) | Sí, una vez |
| 8 | Tarea 39 | Vista 360° del dispositivo (absorbe Dis3, B punto 4, R punto 12 completo) | Alto | Parte del grupo |
| 9 | D4 + F3 | Problemas frecuentes en Inicio + tablero de estadísticas | Medio | No |
| 10 | R2 | Mapa interactivo de red (solo si R1 se queda corto) | Muy alto | No |
| — | S2 | Adaptación por tipo y recomendaciones extra (intercalable donde convenga) | Medio | No |

## 8. Decisiones abiertas para el usuario

1. **¿Reactivar las etiquetas?** Contradice la decisión del 2026-07-03 (retiradas del editor, la vista y el índice). Los sinónimos ya cubren parte del beneficio. Si sí: editor de chips + indexación (fase S3).
2. **¿Renombrar la pestaña "Notas" a "Bóveda"?** Contradice la decisión de discreción. Opciones: renombrar todo / solo por dentro / dejar como está.
3. **¿"IT Brain" es el nombre oficial nuevo?** Si sí: tarea pequeña aparte (manifiesto, título, login, documentación).
4. **Estados del artículo**: ¿los 4 pedidos (borrador/en revisión/publicado/obsoleto) o la versión mínima (sin "en revisión") hasta que exista un flujo de aprobación real?
5. **Nodos compartidos entre diagnósticos**: recomiendo NO por ahora (sección 3); confirmar si la alternativa (duplicar pregunta/diagnóstico) es aceptable.
6. **Mapa interactivo de red (R2)**: ¿se aprueba de una vez o se decide después de usar R1?
