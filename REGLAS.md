# Reglas de trabajo

Registro de las reglas acordadas durante el proyecto. Toda nueva regla se agrega aquí de inmediato y se aplica de forma consistente en adelante.

## Redacción

1. Nunca usar guiones largos (—) en ningún texto, documento ni interfaz.
2. Toda la comunicación, la documentación y la interfaz de usuario van en español.

## Metodología

3. Al final de cada respuesta se recomiendan SIEMPRE, de forma explícita, dos cosas para la siguiente tarea: (a) el modelo de Claude y (b) el nivel de esfuerzo o modo. Nunca indicar solo el modelo. El marco de referencia completo (modelos, niveles de esfuerzo low/medium/high/xHigh/Max, modo Ultracode y el formato de respuesta cuando el usuario pregunta explícitamente qué configuración usar) es la regla 16 (Guía Maestra). La recomendación breve de fin de respuesta sigue siendo obligatoria; el formato estructurado completo de la regla 16 se usa cuando el usuario pregunta de forma explícita qué modelo o configuración utilizar. Si dentro de una misma tarea conviven partes de distinto nivel, indicarlo (por ejemplo, Sonnet High en general y Opus xHigh para la parte crítica).
4. Solo puede existir una tarea "En proceso" a la vez en TAREAS.md.
5. Cada tarea registra su ubicación exacta: ruta completa, archivo y líneas aproximadas cuando aplique.
6. Las tareas finalizadas se archivan en TAREAS_ARCHIVO.md; el tablero activo solo muestra trabajo pendiente y en desarrollo.
7. Si una tarea no se completa del todo, no se marca como finalizada: se anota qué falta y dónde.
8. La calidad del código prevalece siempre sobre el ahorro de tokens.

## Código (propuestas iniciales, ajustables si el usuario lo prefiere)

9. Identificadores de código en inglés; textos visibles para el usuario en español.
10. TypeScript estricto en todo el proyecto.

## Control de versiones

11. Todo cambio realizado se commitea y se hace push siempre, sin esperar a que el usuario lo indique. Se hace al terminar cada cambio o tarea, una vez que las pruebas, el lint y el build estén en verde. Los commits van a `main` (la rama desde la que despliega Vercel) con mensaje claro en español. NUNCA se deja trabajo verificado sin commitear ni sin subir: si al empezar una sesión se encuentran cambios sin commitear en el árbol de trabajo, se revisan y se suben antes de seguir (un cambio local no llega a Vercel).

14. Verificación de despliegue en Vercel (regla acordada 2026-07-18, tras notar que los cambios "no se veían" en producción). Un cambio NO se da por entregado hasta confirmar que llegó al enlace de producción: **https://soluciones-it-psi.vercel.app** (proyecto Vercel `soluciones-it`, despliega automáticamente en cada push a `main`). Tras cada push se comprueba SIEMPRE:
    - Que Vercel generó un despliegue nuevo para ese commit y terminó en estado "Ready" (verificable con `gh api repos/<owner>/<repo>/commits/<sha>/status` y `.../deployments`, o esperando ~1-2 min y confirmando por HTTP que el sitio sirve el build nuevo).
    - Se le avisa al usuario que la app es una PWA con `registerType: 'prompt'` (ver `vite.config.ts`): en un dispositivo que ya la tiene instalada, la versión nueva NO se activa sola. Aparece el aviso "Actualización disponible" (`src/components/ActualizacionDisponible.tsx`) y hay que aceptarlo; en escritorio, una recarga forzada. Si el usuario dice que "no ve el cambio", lo más probable es (a) que faltó el push, o (b) que el service worker está sirviendo la versión anterior en su dispositivo y falta aceptar la actualización.

## Diseño

15. Alcance de un handoff de diseño (regla acordada 2026-07-18): cuando se autoriza implementar un handoff de Claude Design, no se implementa solo el archivo `.dc.html` que señala el README, sino TODAS las pantallas (`.dc.html`) que estén dentro de la carpeta del proyecto del handoff (por ejemplo `.../project/`). El README apunta a la pantalla que el usuario tenía abierta, pero el encargo es dejar re-autorizada toda la carpeta. Cada pantalla se implementa como su propia tarea (una "En proceso" a la vez, regla 4), verificada y archivada, hasta agotar la carpeta. Antes de empezar se revisa qué pantallas de la carpeta ya están hechas (para no repetirlas) y se listan las que faltan.

12. La aplicación es de tema oscuro únicamente (decisión del usuario, 2026-07-17). No se ofrece modo claro ni conmutador de tema. El sistema de diseño vigente es Nocturne (oscuro, fondo `#161826`); las pantallas que aún queden en el tema claro heredado (Dispositivos, Red, Topología) se migran a Nocturne oscuro, no se conservan en claro. Si un handoff de diseño llega en tema claro, se traduce a Nocturne oscuro antes de implementarlo (mismo criterio que ya se aplicó con Soluciones).

## Navegación

13. Comportamiento unificado de "Cancelar" y "Volver" (regla registrada al corregir la tarea 75 y consolidada en la tarea 76, 2026-07-18):
    - Fuente única de la jerarquía: `src/lib/navegacion.ts` (`padreDe(pathname)`) define, en un solo lugar y con pruebas, cuál es la pantalla lógica superior ("Up") de cada ruta y su etiqueta. Ninguna pantalla cablea su destino de regreso a mano. Al agregar una pantalla nueva se declara su padre ahí; así un rediseño no puede volver a dejar un "Volver" apuntando a una pantalla obsoleta.
    - Componente único: `src/components/BotonVolver.tsx` deriva destino y etiqueta de `padreDe` (variantes `claro` y `nocturne`). Solo se pasa un override (`to`/`children`) cuando el destino depende de datos en runtime (la ficha de un equipo de red vuelve a Red) o cuando la etiqueta es especial ("Salir", "Cancelar").
    - Es navegación "Up" (padre lógico declarado), NO `navigate(-1)`/`history.back()`: hay flujos hacia adelante (guardar -> ficha nueva) donde retroceder en el historial caería en el formulario recién enviado. El padre lógico es determinista y a prueba de enlaces profundos y recargas.
    - Regla de la jerarquía: CREACIÓN y las fichas de contenido suben a la pantalla-lista de su sección; EDICIÓN y el asistente suben a la ficha de la entidad. Nunca a una pantalla intermedia o derivada por la que el flujo no pasó.
    - Estado por URL: cuando la pantalla de origen tenía un filtro que importa reponer, viaja en la URL (`/soluciones?categoria=<id>` repone el chip) para volver "exactamente como estaba". En Soluciones la categoría es un FILTRO de la lista, no una pantalla propia (decisión del usuario, 2026-07-18).

## Recomendación de modelo y esfuerzo

16. Guía Maestra para recomendar modelo y nivel de razonamiento (acordada con el usuario el 2026-07-20). Es la referencia principal para cumplir la regla 3. La prioridad, en tareas de programación/arquitectura/proyectos técnicos, es siempre la calidad sobre el ahorro de tokens; y no recomendar por defecto el modelo más potente, sino la mejor relación calidad/tiempo/costo tras analizar la complejidad real.

    Modelos:
    - **Haiku 4.5**: ligero. Tareas simples, rápidas y de alto volumen (clasificar, resumir, extraer, reescribir, correcciones, consultas rápidas, procesamiento masivo). No usar con razonamiento complejo, programación importante, análisis de mucho código ni arquitectura/depuración avanzada.
    - **Sonnet 5**: equilibrado, modelo por defecto del trabajo profesional. Desarrollo (React, TypeScript, Python, SQL), arquitectura sencilla, redacción técnica, documentación, UX, automatizaciones, análisis funcional.
    - **Opus 4.8**: razonamiento complejo cuando la calidad importa mucho más que la velocidad. Bugs muy difíciles, refactorizaciones grandes, seguridad, arquitectura avanzada, optimización compleja, sistemas distribuidos, IA, agentes, análisis profundos.
    - **Fable 5**: máxima profundidad y contexto. Investigación profunda, proyectos gigantescos (cientos/miles de archivos), planeación estratégica, sesiones muy largas donde mantener el contexto es clave.

    Niveles de esfuerzo (siempre recomendar modelo + nivel): **low** (repetitivo, automatización, respuestas rápidas, clasificación); **medium** (trabajo cotidiano, desarrollo sencillo, consultas técnicas); **high** (punto de partida de la mayoría de tareas profesionales: programación, depuración, arquitectura sencilla, diseño técnico, análisis funcional); **xHigh** (programación compleja, grandes refactorizaciones, agentes, optimización, arquitectura, búsquedas extensas: para tareas de programación realmente importantes, preferir xHigh antes que Max); **Max** (máximo por parámetro de esfuerzo; solo cuando una única ejecución necesita el máximo razonamiento posible: problemas extremadamente difíciles, arquitecturas muy complejas, decisiones críticas, algoritmos complejos; no por defecto, porque muchas veces la mejora sobre xHigh no justifica el costo).

    Ultracode (modo de trabajo de Claude Code, no un modelo ni un nivel superior a Max): fija esfuerzo muy alto (base xHigh), activa Dynamic Workflows, permite dividir el problema en varios agentes en paralelo, ejecuta verificaciones extra y consolida antes de responder. Su ventaja no es "pensar más" que Max sino organizar el trabajo con múltiples agentes. Cuando el problema sea lo bastante grande como para beneficiarse de varios agentes, preferir Ultracode antes que subir a Max. Combinaciones: **Sonnet + Ultracode** (mejor relación calidad/velocidad/costo; recomendación por defecto para proyectos de programación, refactorizaciones grandes, full stack, apps completas, revisión completa de proyectos); **Opus + Ultracode** (máxima calidad: bugs muy difíciles, arquitecturas críticas, seguridad, auditorías completas, migraciones grandes, repos enormes); **Fable + Ultracode** (proyectos gigantescos, cientos/miles de archivos, investigación profunda, contexto de muchas horas). Nota de honestidad: el modelo y el nivel/modo los elige y activa el usuario en su cliente; Claude no puede cambiarlos por su cuenta. Si "Ultracode" no estuviera disponible como conmutador en su Claude Code, el equivalente práctico es Sonnet u Opus a xHigh.

    Regla práctica rápida: tarea sencilla -> Haiku/low; trabajo cotidiano -> Sonnet/medium o high; programación profesional -> Sonnet/xHigh; proyecto grande -> Sonnet + Ultracode; problema realmente complejo -> Opus/xHigh; máximo razonamiento en una sola ejecución -> Opus/Max; auditorías, migraciones, refactorizaciones enormes o trabajo que conviene repartir en agentes -> Opus + Ultracode; proyecto gigantesco con enorme contexto -> Fable + Ultracode.

    Formato de respuesta cuando el usuario pregunta EXPLÍCITAMENTE qué modelo o configuración usar (además de la recomendación breve de fin de respuesta): (1) Modelo recomendado; (2) Nivel de razonamiento o modo recomendado; (3) por qué es la mejor opción para esa tarea; (4) si existe una alternativa más potente si el costo no importa; (5) si vale la pena subir al siguiente nivel o sería gasto innecesario; (6) qué se perdería con un modelo inferior.
