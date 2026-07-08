# Propuesta: UX de procedimientos y Modo Diagnóstico Inteligente

Fecha: 2026-07-08
Estado: aprobada, en ejecución por fases. Fase A hecha (tarea 41 del archivo), fase B hecha (tarea 42). Pendientes: C, D, E, F.

Origen: documento de mejoras entregado por el usuario el 2026-07-08 con 18 puntos de UX para procedimientos más la nueva funcionalidad "Modo Diagnóstico Inteligente". Esta propuesta analiza cada punto contra el código real, señala lo que ya existe, agrupa lo nuevo en fases ejecutables y define el diseño técnico de cada fase.

## 1. Resumen ejecutivo

De los 18 puntos, 5 ya están resueltos en la aplicación actual (progreso automático, soluciones contextuales por paso, bóveda integrada con copia individual, historial con usuario y motivo, buscador con tolerancia a errores). Otros 6 son campos opcionales que caben en el JSON del procedimiento sin tocar el esquema de Supabase (objetivo por paso, objetivo general, verificación final, tiempo estimado, dificultad, requisitos). El corazón de la propuesta es un único cambio de modelo que resuelve de golpe 4 pedidos distintos: convertir las instrucciones de un paso de líneas de texto a una lista de bloques tipados (tarea, aviso, imagen, y más adelante vínculos). Ese mismo cambio absorbe la tarea 40 del tablero.

El Modo Diagnóstico Inteligente es viable y encaja limpio en la arquitectura: una tabla nueva de árboles de decisión cuyos nodos referencian artículos existentes (mismo patrón de copia de referencia que ya usan los pasos), un asistente de ejecución que se comparte con el "modo asistente" del punto 14, y una tabla de ejecuciones para las estadísticas. Se propone construirlo por fases, dejando el "aprendizaje" (ranking por tasa de éxito) para cuando existan datos reales.

## 2. Qué ya está resuelto hoy

| Punto del documento | Estado | Dónde |
|---|---|---|
| 2. Progreso del procedimiento | HECHO | `src/features/soluciones/ProcedimientoVista.tsx` líneas 365-386: barra de progreso, contador "X de Y pasos completados", actualización automática al marcar, banner verde al completar todo. Falta solo un detalle menor (ver fase A). |
| 15. Soluciones contextuales | HECHO | `ProcedimientoVista.tsx`, componente `SolucionEnPaso`: la pregunta "¿Ocurrió algún error durante este paso?" con botones Sí/No aparece al terminar el trabajo del paso; "No" avanza solo, "Sí" despliega la solución vinculada ahí mismo. Es exactamente lo pedido. |
| 16. Bóveda integrada | HECHO | `src/features/boveda/CredencialEnPaso.tsx`: apartado "Datos" contraído por defecto, exige permiso y contraseña maestra, y `CampoSecreto.tsx` copia usuario o contraseña individualmente. Nunca se muestran credenciales de otros pasos. |
| 11. Historial del procedimiento | HECHO | Componente `Historial` en cada artículo: usuario, fecha y hora, campo, valores y motivo del cambio; los cambios de procedimiento se resumen en lenguaje natural (`resumenProcedimiento.ts`). Detalle menor: mostrar "última modificación" en la cabecera del artículo (fase A). |
| 13. Buscador inteligente (parcial) | HECHO EN PARTE | MiniSearch con `fuzzy: 0.2` y `prefix: true` ya encuentra "impresora" en títulos, pasos, síntomas y causas (`useIndiceBusqueda.ts`). Lo que NO cubre: sinónimos ("backup" no encuentra "copia de seguridad" si esa palabra no aparece en el texto). Ver fase E. |
| 12. Reutilización (parcial) | HECHO EN PARTE | El editor ya permite vincular procedimientos existentes como subprocedimiento o solución (`PasosEditor.tsx`). Lo que NO hace: sugerir automáticamente al escribir. Ver fase E. |
| 10. Requisitos (parcial) | EXISTE EL MODELO | `Procedimiento.requisitos` existe y la vista lo muestra como "Antes de empezar", pero el rediseño del 2026-07-03 retiró su edición. Reactivarla es trivial (fase A). |

Conclusión: la base ya camina en la dirección del documento. Lo nuevo de verdad son los bloques tipados (fase B), el modo asistente (fase D), el visor de imágenes (fase C), sinónimos y sugerencias (fase E) y el diagnóstico (fase F).

## 3. La pieza central: bloques tipados dentro del paso (fase B)

### El problema

Cuatro pedidos distintos chocan contra la misma limitación del modelo: hoy `PasoProcedimiento.instrucciones` es `string[]` (`src/lib/db.ts:49`), una lista plana de textos con casilla.

- Punto 4 (tipos de contenido: información, precaución, consejo, dato técnico).
- Punto 5 (advertencia justo ANTES de la acción peligrosa, no al final del paso).
- Punto 7 (imagen justo después de una tarea concreta, no todas juntas al inicio del paso).
- Tarea 40 del tablero (vínculos por instrucción individual: credencial, subprocedimiento, etc.).

Nota importante: el rediseño del 2026-07-03 eliminó a propósito los campos nota, advertencia y consejo POR PASO. No es contradictorio volver a ellos ahora, porque el diseño anterior fallaba por su posición (campos fijos colgando al final del paso, lejos de la acción). Lo que se propone es distinto: bloques posicionales intercalados en el flujo del checklist. La advertencia va donde el autor la ponga, es decir, inmediatamente antes de la tarea peligrosa, que es justo lo que pide el punto 5.

### El modelo propuesto

`instrucciones: string[]` pasa a `contenido: ItemPaso[]`:

```ts
interface ItemPaso {
  id: string            // estable, generado al crear; el progreso local lo usa como clave
  tipo: 'tarea' | 'aviso' | 'imagen'
  texto: string         // la tarea o el texto del aviso; en imagen, el pie opcional
  // Solo tipo 'aviso': el tono visual del bloque.
  tono?: 'info' | 'precaucion' | 'importante' | 'consejo' | 'dato'
  // Solo tipo 'imagen': el adjunto inline (mismo formato PasoAdjunto).
  adjunto?: PasoAdjunto
}
```

- Solo los items `tarea` llevan casilla y cuentan para el progreso del paso. Los avisos e imágenes son contenido de lectura: no bloquean el avance.
- Tonos con icono y color propios: ℹ info (azul), ⚠ precaución (ámbar), ⛔ importante (rojo), 💡 consejo (verde), 🔧 dato técnico (violeta). Se recomienda NO agregar "referencia" como tono: ese caso lo cubren los vínculos (tarea 40) en una fase posterior.
- La tarea 40 (vínculos por instrucción) queda absorbida: cuando se decida hacerla, los vínculos serán campos opcionales de `ItemPaso` (`credencialId`, `subArticuloId`...), sin otro cambio de modelo.

### Migración y compatibilidad

- Todo vive en el JSON de `articulos.procedimiento`: cero cambios en `supabase/schema.sql`.
- `normalizarPaso` en `src/lib/procedimiento.ts` convierte lo viejo al leer: cada string de `instrucciones` se vuelve un item `tarea` con id nuevo; `paso.adjuntos` se conserva como galería del paso (los adjuntos existentes no se tocan; las imágenes inline son solo para contenido nuevo). Mismo patrón que la migración de `imagen` a `adjuntos`.
- El guardado escribe el formato nuevo. Un teléfono con la app vieja que lea el formato nuevo no lo entiende: como con cambios anteriores, conviene que el equipo actualice antes de editar procedimientos (el aviso de versión nueva ya existe).
- Progreso local: las claves actuales son `pasoId:indice` (`src/lib/progresoPasos.ts:21`). Pasan a `pasoId:itemId`. El avance a medias de un procedimiento abierto durante el despliegue se pierde una única vez; es un dato local y efímero, aceptable (ya está documentado ese criterio en el propio archivo).

### Editor

`PasosEditor.tsx` cambia la única `textarea` de instrucciones por una lista de filas: cada fila con su texto y un selector discreto de tipo (por defecto "tarea", que sigue siendo escribir y listo), botones subir/bajar/eliminar por fila y un botón "+ Aviso" / "+ Imagen" para intercalar. La edición del caso común (solo tareas) debe seguir siendo igual de rápida que hoy: esa es la vara de calidad de esta fase.

## 4. Detalle del resto de puntos

### Fase A: metadatos del procedimiento (puntos 1, 3, 8, 9, 10, 17 y remates de 2 y 11)

Todos son campos opcionales dentro del JSON `procedimiento` (sin migración de Supabase) y solo se muestran si tienen valor (punto 18: cero ruido para lo ya escrito):

- `objetivo` por paso (punto 1): una línea bajo el título al expandir el paso. En `PasoProcedimiento`.
- `objetivoGeneral` (punto 17): una línea bajo el título del artículo.
- `verificacionFinal: string[]` (punto 3): checklist que aparece al completar el último paso; el banner "✓ Procedimiento completado" pasa a exigir también estas casillas. Reutiliza el mecanismo de `instruccionesHechas` con una clave propia.
- `tiempoEstimadoMin: number` y `dificultad: 'principiante' | 'intermedio' | 'avanzado'` (puntos 8 y 9): chips en la cabecera del artículo y en las tarjetas de la categoría.
- Requisitos (punto 10): reactivar su edición en `ArticuloForm.tsx` (el campo y la vista ya existen; el 2026-07-03 solo se retiró el editor). Revierte esa decisión con el visto bueno del usuario.
- Remate del punto 2: chip de avance "3/12" en la lista de artículos de la categoría (`CategoriaPage.tsx`), para retomar procedimientos a medias de un vistazo.
- Remate del punto 11: línea "Última modificación: fecha, por usuario" en la cabecera del artículo (los datos ya están en `updatedAt`/`updatedBy`).
- Punto 17 (estandarización): con estos campos, `ArticuloPage.tsx` ya renderiza siempre el mismo orden: título, tipo, objetivo general, chips (tiempo, dificultad), requisitos, pasos, verificación final, notas adicionales, historial. No requiere nada más.

### Fase C: visor de imágenes (punto 6)

En dos partes de costo muy distinto:

- C1, zoom y pantalla completa: hoy la imagen de un paso abre en pestaña nueva (`AdjuntoPaso` en `ProcedimientoVista.tsx:683`). Se reemplaza por un visor propio (overlay a pantalla completa, pellizco para zoom, doble toque, cerrar con gesto). Sin dependencias nuevas. Beneficio alto, costo medio-bajo.
- C2, anotación (flechas, círculos, resaltados, texto): editor de dibujo sobre canvas al adjuntar o editar una imagen. La anotación se "aplana" en una copia JPEG que reemplaza al adjunto: así la vista, el offline y la sincronización no cambian nada (es una imagen normal). Costo medio-alto; se recomienda hacerla después de C1 y medir si el equipo la usa.

### Fase D: modo asistente (puntos 14 y 18)

Ruta nueva `/soluciones/:categoriaId/:articuloId/ejecutar` con pantalla dedicada: solo el paso actual (título, objetivo, checklist de items, adjuntos), barra de progreso, botón Siguiente/Continuar y botón salir. Claves de diseño:

- Reutiliza `progresoPasos` tal cual: entrar y salir del modo asistente no pierde ni duplica avance; la vista clásica sigue existiendo como "mapa" del procedimiento.
- Los subprocedimientos y soluciones vinculados se ejecutan dentro del mismo asistente (apilando y volviendo al paso exacto), que es la mecánica que la vista actual ya implementa con `onCompletado`.
- Esta pantalla es un prerrequisito del Diagnóstico Inteligente: el diagnóstico ejecuta procedimientos "en modo asistente" y regresa al árbol. Construirla primero evita hacerla dos veces.

### Fase E: búsqueda y reutilización (puntos 12 y 13)

- Sinónimos (13): diccionario estático en `src/features/busqueda/` (por ejemplo backup ↔ copia de seguridad ↔ respaldo; internet ↔ red; impresora ↔ impresión) aplicado como expansión de términos de la consulta sobre el índice MiniSearch existente. Empezar con un mapa corto curado por el equipo; si crece, moverlo a datos editables.
- Sugerencia anti duplicados (12): en `ArticuloForm.tsx`, al escribir el título de un artículo nuevo (con rebote de unos 300 ms), consultar el índice local y, si hay coincidencia fuerte con un artículo con procedimiento, mostrar un aviso inline: "Ya existe (título). ¿Abrirlo en lugar de crear uno nuevo?". Lo mismo en `PasosEditor.tsx` al escribir el título de un paso, ofreciendo vincularlo como subprocedimiento (el selector ya existe; esto solo lo hace proactivo). Todo local e instantáneo.

## 5. Modo Diagnóstico Inteligente (fase F)

### Encaje arquitectónico

No reemplaza nada: es una capa de orquestación sobre los artículos existentes. Sigue los patrones ya establecidos: tabla sincronizada con `updated_at`/`updated_by`/`eliminado_en`, contenido estructurado en JSON normalizado al leer, vínculos por copia de referencia (id + título), progreso local no sincronizado.

### Modelo de datos

Tabla nueva `diagnosticos` (Supabase + Dexie versión 8 + `tablas.ts` + `schema.sql` + RLS como el resto):

```ts
interface Diagnostico {
  id: string
  categoriaId: string        // POS, Impresoras, Redes...
  titulo: string             // el problema en palabras del técnico: "La impresora no imprime"
  descripcion: string
  nodos: NodoDiagnostico[]   // JSON, normalizado al leer como `procedimiento`
  nodoInicialId: string
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}

interface NodoDiagnostico {
  id: string
  pregunta: string           // "¿La impresora está encendida?"
  descripcion: string        // opcional, cómo comprobarlo
  // v1: sí/no y lista de opciones (el sí/no es una lista de 2).
  // Texto, número, código de error y QR quedan para versiones futuras.
  opciones: OpcionDiagnostico[]
}

interface OpcionDiagnostico {
  etiqueta: string                    // "Sí", "No", "Aparece con error 0x0000011b"
  siguienteNodoId: string | null      // continuar preguntando, o null si esta rama termina
  // Acción de la rama (opcional): ejecutar un artículo vinculado.
  // Copia de referencia, mismo patrón que los pasos.
  articuloId: string | null
  articuloTitulo: string
  // Si tras ejecutar el artículo el diagnóstico continúa, vuelve a
  // siguienteNodoId; si es null, el artículo ES la solución final.
  mensajeFinal: string                // "Solucionado: el tóner estaba agotado"
}
```

Registro de ejecuciones, tabla sincronizada `ejecuciones_diagnostico` (F2): id, diagnosticoId, camino recorrido (array de `{nodoId, opcion}` en JSON), articulosEjecutados, resuelto (sí/no/abandonado), duración en segundos, usuario, fecha. Es de solo inserción, como el historial. Con esos datos salen las estadísticas pedidas (problemas más frecuentes, procedimientos más usados, tasa de éxito por rama) sin diseñar nada más.

Progreso local no sincronizado `progresoDiagnostico` (Dexie): diagnóstico abierto, nodo actual, pila de retorno (para volver al nodo exacto tras ejecutar un procedimiento) y respuestas dadas. Garantiza el requisito de "nunca perder el progreso", incluso al cerrar la app.

### Experiencia de uso

- Entrada "Diagnóstico" en Inicio: buscador (el índice MiniSearch suma los diagnósticos: título y preguntas) y lista de problemas agrupados por categoría.
- Ejecución tipo asistente (reutiliza la pantalla de la fase D): pregunta actual, descripción, botones de respuesta grandes, barra de progreso, volver (deshace la última respuesta usando la pila), cancelar y "solicitar ayuda" (v1: enlace al artículo de la categoría o a compartir; no inventar chat).
- Cuando una rama ejecuta un artículo, se abre en modo asistente; al completarlo, la app vuelve sola al diagnóstico y sigue en `siguienteNodoId`. Las credenciales van dentro de los pasos del procedimiento ejecutado, como siempre: la bóveda no necesita integración nueva.
- Resultado final: problema identificado, procedimiento recomendado (con su tiempo estimado y dificultad de la fase A), y botón "¿Quedó resuelto?" Sí/No que cierra el registro de la ejecución.

### Editor de diagnósticos (la parte más delicada)

Nada de editor gráfico de grafos en v1: una lista plana de preguntas, cada una con sus opciones, y cada opción con dos selects ("continúa en la pregunta..." y "ejecuta el procedimiento...", ambos opcionales). Validación al guardar: sin nodos huérfanos, sin ciclos, toda rama termina. Es el mismo enfoque de simplicidad del editor de pasos y cubre el 100 % de los árboles del documento de ejemplo.

### Qué se recomienda posponer a propósito

- Nivel de confianza y orden por probabilidad: sin datos de ejecuciones es un número inventado. Cuando F2 acumule uso real, el orden de las soluciones puede calcularse de verdad (F3).
- Respuestas de texto/número/código de error/QR: el modelo de opciones las admite a futuro (un tipo de nodo nuevo) sin romper nada.
- Estadísticas con pantallas propias: F2 primero solo registra; el tablero de estadísticas es una tarea posterior corta cuando haya datos que mirar.

## 6. Plan de fases recomendado

Orden recomendado: A, B, D, F, con C y E como tareas independientes intercalables cuando convenga. Cada fase entra al tablero como una tarea (o dos, en el caso de C y F).

| Fase | Contenido | Puntos que cubre | Prioridad sugerida | Esfuerzo | Modelo sugerido |
|---|---|---|---|---|---|
| A | Metadatos: objetivo por paso, objetivo general, verificación final, tiempo, dificultad, requisitos editables, chip de avance en categoría, última modificación en cabecera | 1, 3, 8, 9, 10, 17, remates de 2 y 11 | Alta | Medio | Sonnet 5, esfuerzo medio |
| B | Bloques tipados dentro del paso (tarea, aviso con tono, imagen inline) con migración de datos | 4, 5, 7 (y prepara la tarea 40) | Alta | Alto | Opus 4.8, esfuerzo alto (modelo y migración); la UI con Sonnet 5 |
| C1 | Visor de imágenes: zoom y pantalla completa | 6 (parte) | Media | Medio-bajo | Sonnet 5, esfuerzo medio |
| C2 | Anotación de imágenes (flechas, círculos, texto, aplanado a JPEG) | 6 (resto) | Baja | Medio-alto | Sonnet 5, esfuerzo medio-alto |
| D | Modo asistente de ejecución (pantalla dedicada, prerrequisito del diagnóstico) | 14, 18 | Alta | Medio-alto | Sonnet 5, esfuerzo alto |
| E | Sinónimos en la búsqueda y sugerencia anti duplicados al crear | 12, 13 | Media | Medio | Sonnet 5, esfuerzo medio |
| F1 | Diagnóstico: modelo, editor de árboles, asistente de ejecución con pila de retorno | Modo Diagnóstico | Alta (tras D) | Alto | Opus 4.8 para el diseño del modelo y el flujo; Sonnet 5 para el resto |
| F2 | Registro de ejecuciones y base de estadísticas | Aprendizaje | Media (tras F1) | Medio | Sonnet 5, esfuerzo medio |
| F3 | Ranking por tasa de éxito y tablero de estadísticas | Aprendizaje | Futura | Medio | decidir entonces |

## 7. Decisiones que debe tomar el usuario

1. Aprobar el orden de fases (o reordenarlas). Recomendación: A, B, D, F1, F2, con C1 y E intercaladas donde se prefiera.
2. Confirmar que la fase B absorbe la tarea 40 del tablero (los vínculos por instrucción se harían después, sobre el modelo nuevo de items).
3. Confirmar la reversión puntual del rediseño del 2026-07-03 en dos cosas: requisitos vuelven a editarse (fase A) y los avisos vuelven como bloques posicionales, no como campos del paso (fase B).
4. Elegir los tonos de aviso definitivos (propuestos: info, precaución, importante, consejo, dato técnico; "referencia" se descarta por solaparse con los vínculos).
5. Decidir si C2 (anotación de imágenes) se hace o se espera a ver el uso real de C1.
