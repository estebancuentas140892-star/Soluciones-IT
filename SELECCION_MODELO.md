# Selección de modelo y nivel de esfuerzo

Guía para decidir, antes de empezar cualquier tarea, qué modelo de Claude y qué nivel de esfuerzo conviene usar. El objetivo no es usar siempre el modelo más potente, sino el que da la mejor relación entre calidad del resultado, tiempo de respuesta y consumo de cuota para la complejidad real del trabajo.

Es la referencia completa de la regla 3 de [REGLAS.md](REGLAS.md); vive en su propio archivo para que cualquier persona que abra el proyecto la encuentre sin leer REGLAS.md entero.

La decisión se toma con la **matriz de puntuación** de la sección 2, no a ojo. La ventaja de puntuar la tarea en vez de memorizar qué modelo usar para qué: si Anthropic saca modelos nuevos o cambia sus capacidades, solo hay que mover los umbrales de la tabla, no reescribir el criterio.

## 1. Cómo funciona en la práctica

Claude Code no puede cambiar su propio modelo activo a mitad de una respuesta. El modelo con el que se genera cada respuesta lo elige el usuario (`/model` en su cliente). Por eso esto es una **recomendación**, no un cambio automático:

- Antes de empezar cualquier tarea que no sea trivial (una tarea de TAREAS.md, un bug, una función, un refactor, una decisión de arquitectura) se puntúa la matriz y se muestra el bloque de decisión de la sección 5.
- Si el modelo recomendado coincide con el activo, se avisa en una línea y se empieza.
- Si el activo se queda CORTO, se avisa de forma explícita con el comando `/model` sugerido antes de continuar, en vez de gastar la tarea con menos capacidad de la que necesita.
- Si el activo está POR ENCIMA de lo necesario, se anota y se sigue igual: interrumpir para bajar de modelo cuesta más de lo que ahorra.
- No se repite el bloque en cada mensaje de una misma tarea, solo al empezar una nueva.

## 2. Matriz inteligente de decisión

Puntuar cada criterio de 0 a 5, donde 0 = no aplica, 1 = muy bajo, 2 = bajo, 3 = medio, 4 = alto, 5 = muy alto.

| Criterio | Qué mide |
|---|---|
| Tamaño del proyecto | Cuántos archivos y líneas tiene el repo (constante por proyecto, ver calibración) |
| Cantidad de archivos involucrados | Cuántos archivos hay que leer o tocar para esta tarea |
| Complejidad técnica | Qué tan difícil es el dominio del problema en sí |
| Complejidad del razonamiento | Cuánto hay que deducir, no solo ejecutar |
| Riesgo de introducir errores | Qué tan caro sale equivocarse (producción, datos, seguridad) |
| Necesidad de planificación | Si hay que diseñar antes de escribir |
| Cantidad de dependencias entre módulos | Cuántas piezas se afectan entre sí |
| Cantidad de decisiones importantes | Cuántas elecciones de diseño quedan abiertas |
| Necesidad de mantener contexto durante mucho tiempo | Si la tarea abarca muchas horas o muchos pasos encadenados |
| Conveniencia de dividir el trabajo en paralelo | Si hay frentes independientes que avanzarían a la vez |
| Necesidad de desplegar múltiples agentes especializados | Si esos frentes requieren perspectivas distintas (seguridad, UX, datos) |

Máximo posible: **55 puntos** (11 criterios x 5).

### Interpretación del puntaje

| Puntaje | Modelo | Esfuerzo | Perfil |
|---|---|---|---|
| 0 a 10 | Haiku 4.5 | No aplica | Tareas rápidas y mecánicas |
| 11 a 22 | Sonnet 5 | Bajo o Medio | Trabajo cotidiano |
| 23 a 34 | Sonnet 5 | Alto o Extra | Problemas moderadamente complejos |
| 35 a 45 | Opus 4.8 | Extra o Max | Problemas difíciles con mucho análisis |
| Más de 45 | Fable 5 | Max | Máxima profundidad y contexto |

### Calibración para ESTE proyecto

Soluciones IT tiene 222 archivos fuente y unas 44.000 líneas: es un proyecto **mediano**, no gigantesco. Consecuencias prácticas al puntuar:

- **Tamaño del proyecto = 3** en casi toda tarea de este repo. Reservar 4 y 5 para repos de cientos o miles de archivos. Es un criterio constante: no sube ni baja según la tarea, así que aporta un piso fijo de 3 puntos a todo.
- Por ese piso, el rango normal aquí va de 11 a 34 (banda Sonnet), y Opus aparece solo en trabajo genuinamente difícil. Que la matriz diga "Sonnet" la mayoría de las veces no es un fallo de la matriz: es el tamaño real del proyecto.
- **Guarda contra el falso Fable** (ajuste propio de este proyecto, no de la matriz original): una tarea de análisis puro puede pasar de 45 sin que el repo lo justifique, porque planificación, contexto, razonamiento, paralelización y agentes suben todos juntos en cualquier auditoría. Regla: **para recomendar Fable 5, "Tamaño del proyecto" debe ser 4 o más**. Si no lo es, tope en Opus 4.8 + Ultracode aunque el total supere 45. Con 222 archivos, Fable no corresponde en este repo hoy.

## 3. Los cuatro modelos

**Haiku 4.5** (0 a 10 puntos). Trabajo simple, rápido y de alto volumen: responder preguntas simples, búsquedas, clasificar, extraer datos, generar listas, resúmenes cortos, explicar conceptos básicos, convertir formatos, cambios pequeños de texto, localizar archivos, tareas repetitivas, inspecciones superficiales. No usar para arquitectura, debugging complejo, refactorizaciones grandes, cambios en múltiples archivos, decisiones importantes ni planificación. No requiere nivel de esfuerzo.

**Sonnet 5** (11 a 34). El modelo por defecto: programar, corregir bugs normales, crear funciones, modificar componentes, refactorizaciones pequeñas y medianas, revisar código, escribir documentación y pruebas, mejorar rendimiento, optimizar consultas, análisis de código, UX, automatizaciones. Es la opción recomendada siempre que la tarea no justifique claramente Opus o Fable.

**Opus 4.8** (35 a 45). Solo cuando el problema exige razonamiento profundo: arquitectura, rediseños importantes, debugging extremadamente difícil, investigación profunda, análisis de muchos archivos a la vez, dependencias complejas, problemas difíciles de reproducir, decisiones críticas, optimizaciones complejas, seguridad, concurrencia. No usarlo para tareas normales solo porque "parecen difíciles".

**Fable 5** (más de 45, y solo con tamaño de proyecto 4 o más). Migraciones enormes, refactorizaciones masivas, generación de múltiples módulos, trabajo agéntico prolongado, mantenimiento de mucho contexto, funcionalidades muy grandes, auditorías completas, rediseño integral, planificación completa de sistemas. Nunca para trabajos pequeños solo porque el proyecto en general sea grande.

## 4. Niveles de esfuerzo y modo Ultracode

Se recomiendan siempre junto con el modelo, nunca el modelo solo. Los nombres en español mapean 1 a 1 con el parámetro real `level` que reciben las herramientas de revisión (`/code-review`, `/security-review`).

| Nivel | Equivale a | Usar cuando |
|---|---|---|
| Bajo | `low` | Preguntas simples, cambios pequeños, validaciones sencillas, consultas. Prioriza velocidad. |
| Medio | `medium` | Programación normal, análisis estándar, implementación habitual, refactorizaciones comunes. **Valor por defecto.** |
| Alto | `high` | Lógica compleja, debugging, cambios en varios archivos, decisiones importantes, optimización moderada. |
| Extra | `xhigh` | Arquitectura, planificación compleja, muchos módulos, problemas ambiguos, investigación, varias alternativas a evaluar. |
| Max | `max` | Solo cuando el razonamiento es crítico, una decisión incorrecta sale cara, hay muchas dependencias o el problema es excepcionalmente complejo. Nunca por defecto ni para ahorrar cuota evitando análisis. |

Fuera de las herramientas de revisión, que sí reciben `level` como parámetro, el nivel es una guía cualitativa de cuánto invertir: cuántos archivos explorar antes de tocar código, si conviene usar el modo Plan, si conviene repartir en subagentes, cuántas rondas de verificación (typecheck, lint, pruebas, navegador real) hacer antes de dar la tarea por terminada.

### Modo Ultracode

No es un modelo ni un nivel por encima de Max: es un modo de trabajo que fija esfuerzo muy alto (base Extra) y, sobre todo, **descompone el problema en líneas de trabajo paralelas**. Su ventaja no es "pensar más" que Max, sino organizar el trabajo con varios agentes y consolidar.

Al usarlo:

1. Dividir el problema en subproblemas independientes.
2. Escribir el plan de trabajo antes de empezar.
3. Desplegar agentes especializados en paralelo, con responsabilidades claras y sin solaparse (salvo cuando el solape sea deliberado, para validar un resultado).
4. Integrar todos los hallazgos en una sola respuesta coherente.
5. Hacer revisión cruzada entre agentes: contradicciones, omisiones, inconsistencias.
6. Presentar una conclusión unificada, no la suma de informes sueltos.

Ejemplos de reparto según el tipo de trabajo:

- **Auditoría de aplicación**: UX, arquitectura, rendimiento, automatización, seguridad, base de datos, código obsoleto, bugs potenciales, consistencia visual, flujo funcional.
- **Proyecto de software**: frontend, backend, API, base de datos, infraestructura, seguridad, testing, optimización, documentación.
- **Investigación**: estado del arte, comparación de alternativas, riesgos, costos, recomendaciones, validación cruzada.

**Cuándo activarlo**: auditorías completas, revisión de cientos o miles de archivos, refactorizaciones masivas, arquitecturas complejas, migraciones grandes, optimización integral, investigación técnica profunda, o cualquier análisis donde revisar áreas distintas en paralelo aporte de verdad.

**Cuándo NO**: preguntas sencillas, correcciones pequeñas, cambios en uno o dos archivos, explicaciones básicas, refactorizaciones menores, o cualquier cosa que Sonnet u Opus resuelvan bien de una sola pasada.

**Activación**: es ortogonal al puntaje total, se evalúa aparte. Se considera cuando **Paralelización >= 4 y Agentes especializados >= 4**, y además se cumple la mayoría de estas condiciones: muchos módulos, muchas áreas independientes que revisar, varias disciplinas involucradas (frontend, backend, datos, seguridad, UX, infraestructura), hace falta auditoría integral, distintas perspectivas aportarían de verdad, y hay que consolidar y validar de forma cruzada. Nunca activarlo solo por el tamaño del proyecto, y nunca con Haiku.

**Nota de honestidad**: el modo lo activa el usuario en su cliente; Claude no puede activarlo por su cuenta. La forma concreta ya disponible de revisión multi agente en la nube en este proyecto es `/code-review ultra` (alias `/ultrareview`), que el usuario dispara explícitamente y tiene costo propio. Si no hay conmutador "Ultracode" en la sesión, el equivalente práctico es Sonnet u Opus con esfuerzo Extra, repartiendo el trabajo con la herramienta de subagentes.

## 5. Formato del bloque de decisión

Se muestra antes de empezar cualquier tarea no trivial:

```
Matriz de decisión
Tamaño del proyecto: __/5        Decisiones críticas: __/5
Archivos involucrados: __/5      Contexto prolongado: __/5
Complejidad técnica: __/5        Paralelización: __/5
Complejidad del razonamiento: __/5   Agentes especializados: __/5
Riesgo de error: __/5
Planificación: __/5
Dependencias: __/5
Puntaje total: __/55

Modelo seleccionado: [Haiku 4.5 | Sonnet 5 | Opus 4.8 | Fable 5]
Nivel de esfuerzo: [No aplica | Bajo | Medio | Alto | Extra | Max]
Ultracode: [Sí | No]
Justificación:
- Por qué este modelo y este nivel para esta tarea.
- Si el modelo activo en la sesión no alcanza, qué comando /model ejecutar antes de seguir.
```

## 6. Reglas de escalamiento

- Resolver siempre con el modelo menos costoso que pueda dar un resultado de alta calidad.
- Subir de modelo solo cuando exista una razón técnica concreta, no por precaución genérica.
- No usar Opus solo porque la tarea "se ve difícil"; no usar Fable solo porque el proyecto es grande.
- No saltar de Haiku a Fable salvo justificación evidente: el salto normal es Haiku -> Sonnet -> Opus -> Fable, un escalón a la vez.
- Si a mitad de una tarea se descubre que el modelo elegido se queda corto: detenerse, explicar brevemente por qué, y escalar solo al siguiente modelo necesario.

## 7. Ejemplos puntuados con tareas reales del proyecto

Sirven para calibrar el criterio contra trabajo que ya se hizo aquí (detalle de cada una en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md)).

| Tarea real | Puntaje | Resultado |
|---|---|---|
| "¿Cuál es la siguiente tarea?" (leer el tablero) | ~6 | Haiku 4.5 |
| Tarea 144: aviso de IP duplicada, patrón ya existente en el mismo archivo | ~15 | Sonnet 5 / Medio |
| Tarea 146: tablero de estadísticas, 3 módulos nuevos y 4 pantallas tocadas | ~20 | Sonnet 5 / Medio |
| Tarea 145: extraer `esDeRed` e `incluyeTexto`, 6 archivos, defecto latente de por medio | ~24 | Sonnet 5 / Alto |
| Tarea 128: null heredado que atascaba la cola de subida para siempre | ~38 | Opus 4.8 / Extra |
| Tarea 129 (Fase 0c): 3 frentes ya diagnosticados, repartidos en 3 agentes en worktrees | ~36 | Opus 4.8 / Extra + Ultracode |
| Auditoría integral de flujos: 30 hallazgos, 3 agentes en paralelo | ~47, tope aplicado | Opus 4.8 / Max + Ultracode (Fable descartado por la guarda de tamaño) |

## 8. Guía rápida

| Situación | Modelo + esfuerzo |
|---|---|
| Consulta, búsqueda, lectura del tablero | Haiku 4.5 |
| Trabajo cotidiano, desarrollo habitual | Sonnet 5 / Medio |
| Varias condiciones, varios archivos, debugging | Sonnet 5 / Alto |
| Refactor amplio dentro del repo, full stack | Sonnet 5 / Extra |
| Arquitectura, bug muy difícil, seguridad | Opus 4.8 / Extra |
| Decisión crítica, máximo razonamiento en una ejecución | Opus 4.8 / Max |
| Auditoría o migración que conviene repartir en agentes | Opus 4.8 + Ultracode |
| Proyecto gigantesco, contexto de muchas horas (no aplica hoy a este repo) | Fable 5 + Ultracode |
