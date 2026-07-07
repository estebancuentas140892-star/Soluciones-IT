# Reglas de trabajo

Registro de las reglas acordadas durante el proyecto. Toda nueva regla se agrega aquí de inmediato y se aplica de forma consistente en adelante.

## Redacción

1. Nunca usar guiones largos (—) en ningún texto, documento ni interfaz.
2. Toda la comunicación, la documentación y la interfaz de usuario van en español.

## Metodología

3. Al final de cada respuesta se recomiendan SIEMPRE, de forma explícita, dos cosas para la siguiente tarea: (a) el modelo de Claude y (b) el nivel de esfuerzo. Nunca indicar solo el modelo. Niveles de esfuerzo: "bajo" para explorar, leer, buscar y cambios mecánicos; "medio" para desarrollo e implementación habitual; "alto" para arquitectura, depuración compleja o decisiones con muchas piezas. Si dentro de una misma tarea conviven partes de distinto nivel, indicarlo (por ejemplo, medio en general y alto para la parte crítica).
4. Solo puede existir una tarea "En proceso" a la vez en TAREAS.md.
5. Cada tarea registra su ubicación exacta: ruta completa, archivo y líneas aproximadas cuando aplique.
6. Las tareas finalizadas se archivan en TAREAS_ARCHIVO.md; el tablero activo solo muestra trabajo pendiente y en desarrollo.
7. Si una tarea no se completa del todo, no se marca como finalizada: se anota qué falta y dónde.
8. La calidad del código prevalece siempre sobre el ahorro de tokens.

## Código (propuestas iniciales, ajustables si el usuario lo prefiere)

9. Identificadores de código en inglés; textos visibles para el usuario en español.
10. TypeScript estricto en todo el proyecto.

## Control de versiones

11. Todo cambio realizado se commitea y se hace push siempre, sin esperar a que el usuario lo indique. Se hace al terminar cada cambio o tarea, una vez que las pruebas, el lint y el build estén en verde. Los commits van a `main` (la rama desde la que despliega Vercel) con mensaje claro en español.
