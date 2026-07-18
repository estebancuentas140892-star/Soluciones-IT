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

## Diseño

12. La aplicación es de tema oscuro únicamente (decisión del usuario, 2026-07-17). No se ofrece modo claro ni conmutador de tema. El sistema de diseño vigente es Nocturne (oscuro, fondo `#161826`); las pantallas que aún queden en el tema claro heredado (Dispositivos, Red, Topología) se migran a Nocturne oscuro, no se conservan en claro. Si un handoff de diseño llega en tema claro, se traduce a Nocturne oscuro antes de implementarlo (mismo criterio que ya se aplicó con Soluciones).

## Navegación

13. Comportamiento unificado de "Cancelar" y "Volver" en los formularios (regla registrada al corregir la tarea 75, 2026-07-18):
    - Desde un formulario de CREACIÓN, Cancelar/Volver regresa siempre a la pantalla-lista de la sección (`/soluciones`, `/dispositivos`, `/boveda`, `/ubicaciones`, `/diagnostico`), nunca a una pantalla intermedia o derivada (por ejemplo la ficha de categoría) por la que el flujo de creación no pasó.
    - Desde un formulario de EDICIÓN, Cancelar/Volver regresa a la ficha de la entidad que se editaba (`/seccion/:id`).
    - El destino se declara como un `to={destino}` fijo y determinista, no con `navigate(-1)`: así el regreso es a prueba de enlaces profundos y de recargas (no depende de la pila de historial, que puede estar vacía o venir de otra sección).
    - Cuando la pantalla de origen tenía un filtro o estado que importa reponer, se lleva por la URL (por ejemplo `/soluciones?categoria=<id>` repone el chip activo) para volver "exactamente como estaba".
