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

13. Comportamiento unificado de "Cancelar" y "Volver" (regla registrada al corregir la tarea 75 y consolidada en la tarea 76, 2026-07-18):
    - Fuente única de la jerarquía: `src/lib/navegacion.ts` (`padreDe(pathname)`) define, en un solo lugar y con pruebas, cuál es la pantalla lógica superior ("Up") de cada ruta y su etiqueta. Ninguna pantalla cablea su destino de regreso a mano. Al agregar una pantalla nueva se declara su padre ahí; así un rediseño no puede volver a dejar un "Volver" apuntando a una pantalla obsoleta.
    - Componente único: `src/components/BotonVolver.tsx` deriva destino y etiqueta de `padreDe` (variantes `claro` y `nocturne`). Solo se pasa un override (`to`/`children`) cuando el destino depende de datos en runtime (la ficha de un equipo de red vuelve a Red) o cuando la etiqueta es especial ("Salir", "Cancelar").
    - Es navegación "Up" (padre lógico declarado), NO `navigate(-1)`/`history.back()`: hay flujos hacia adelante (guardar -> ficha nueva) donde retroceder en el historial caería en el formulario recién enviado. El padre lógico es determinista y a prueba de enlaces profundos y recargas.
    - Regla de la jerarquía: CREACIÓN y las fichas de contenido suben a la pantalla-lista de su sección; EDICIÓN y el asistente suben a la ficha de la entidad. Nunca a una pantalla intermedia o derivada por la que el flujo no pasó.
    - Estado por URL: cuando la pantalla de origen tenía un filtro que importa reponer, viaja en la URL (`/soluciones?categoria=<id>` repone el chip) para volver "exactamente como estaba". En Soluciones la categoría es un FILTRO de la lista, no una pantalla propia (decisión del usuario, 2026-07-18).
