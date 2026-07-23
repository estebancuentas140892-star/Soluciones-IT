# Soluciones IT

Aplicación móvil (PWA) para el equipo de soporte y mantenimiento de TI: base de conocimiento por categorías, inventario de dispositivos, bóveda de IP y credenciales y búsqueda global, todo con funcionamiento offline. Equipo de 5 técnicos. Sustituye a Miro como fuente de conocimiento del equipo.

## Documentos clave

- [ARQUITECTURA.md](ARQUITECTURA.md): stack, modelo de datos y decisiones técnicas.
- [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md): inventario funcional completo de la app (pantallas, formularios campo por campo, modales, botones, acciones, relaciones y flujos).
- [TAREAS.md](TAREAS.md): tablero Kanban con el trabajo pendiente y en desarrollo.
- [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md): historial de tareas finalizadas.
- [REGLAS.md](REGLAS.md): reglas de trabajo acordadas. Leerlas y aplicarlas siempre.
- [SELECCION_MODELO.md](SELECCION_MODELO.md): qué modelo de Claude y qué nivel de esfuerzo usar antes de empezar cada tarea.
- [INSTALACION.md](INSTALACION.md): guía para el equipo, cómo instalar la app en el teléfono o la PC.

## Metodología obligatoria en cada sesión

1. Mantener TAREAS.md actualizado: las tareas nuevas entran en "Por hacer"; al comenzar su desarrollo pasan a "En proceso" (solo una a la vez); al terminarlas se mueven a TAREAS_ARCHIVO.md y la siguiente pendiente pasa a "En proceso".
2. Cada tarea debe registrar: descripción clara, estado, prioridad, y la ubicación exacta (ruta completa de archivos y líneas aproximadas cuando aplique). Si la ubicación real resulta ser otra, corregirla.
3. Si una tarea queda incompleta, no marcarla como finalizada: anotar qué falta y dónde.
4. Toda nueva regla de trabajo acordada con el usuario se registra de inmediato en REGLAS.md.
5. Antes de empezar cualquier tarea que no sea trivial, analizar su complejidad y mostrar el bloque de decisión con el modelo de Claude y el nivel de esfuerzo recomendados (nunca el modelo solo). Si el modelo activo en la sesión no alcanza para lo que la tarea exige, avisarlo de forma explícita con el comando `/model` sugerido antes de continuar. Guía completa, con el proceso de decisión y el formato exacto del bloque, en [SELECCION_MODELO.md](SELECCION_MODELO.md). Guía rápida: Haiku 4.5 para explorar, buscar y leer; Sonnet 5 para desarrollar e implementar (opción por defecto); Opus 4.8 para arquitectura y problemas complejos; Fable 5 para los desafíos de máxima complejidad.
6. Prioridad absoluta: la calidad del código está por encima del ahorro de tokens. Si una tarea justifica un modelo superior o más esfuerzo, recomendarlo.

## Estilo

- Toda la comunicación con el usuario en español.
- Nunca usar guiones largos (—) en textos, documentación ni interfaz.
- Identificadores de código en inglés; textos visibles para el usuario en español.
