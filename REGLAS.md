# Reglas de trabajo

Registro de las reglas acordadas durante el proyecto. Toda nueva regla se agrega aquí de inmediato y se aplica de forma consistente en adelante.

## Redacción

1. Nunca usar guiones largos (—) en ningún texto, documento ni interfaz.
2. Toda la comunicación, la documentación y la interfaz de usuario van en español.

## Metodología

3. Antes de empezar cualquier tarea que no sea trivial se puntúa su complejidad con la matriz de decisión (11 criterios de 0 a 5, total sobre 55) y se muestra SIEMPRE el bloque completo: matriz, puntaje, (a) modelo de Claude, (b) nivel de esfuerzo y (c) si corresponde Ultracode (regla acordada 2026-07-23, reemplaza la versión anterior "al final de cada respuesta": mostrarlo antes de empezar permite cambiar de modelo con `/model` antes de gastar la tarea con el modelo equivocado). Nunca indicar solo el modelo. La matriz, los umbrales, la calibración para el tamaño real de este repo, el modo Ultracode y el formato exacto del bloque viven en [SELECCION_MODELO.md](SELECCION_MODELO.md), la regla 16 de aquí abajo. Si dentro de una misma tarea conviven partes de distinto nivel, indicarlo (por ejemplo, Sonnet Alto en general y Opus Extra para la parte crítica).
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
    - **La comprobación válida es por CONTENIDO, no por nombre de archivo** (precisión del 2026-09-02, tarea 206). Se leen los nombres reales de los chunks en `/sw.js` y se busca dentro de ellos una cadena que solo exista con el cambio nuevo; y, cuando el cambio retira algo, también se comprueba que la cadena vieja YA NO esté. **Nunca se comparan los hashes del build local con los de producción**: son el mismo código pero los genera otro entorno, y el 2026-09-02 Vercel produjo hashes distintos para el mismo commit (`ProcedimientoVista-BGOIZnvu.js` allá, `-CzGbI3Pa.js` aquí). En los despliegues anteriores coincidían por casualidad, no por garantía.
    - Se le avisa al usuario que la app es una PWA con `registerType: 'prompt'` (ver `vite.config.ts`): en un dispositivo que ya la tiene instalada, la versión nueva NO se activa sola. Aparece el aviso "Actualización disponible" (`src/components/ActualizacionDisponible.tsx`) y hay que aceptarlo; en escritorio, una recarga forzada. Si el usuario dice que "no ve el cambio", lo más probable es (a) que faltó el push, o (b) que el service worker está sirviendo la versión anterior en su dispositivo y falta aceptar la actualización.

## Esquema de base de datos

17. Toda columna que la app sincronice debe existir en `supabase/schema.sql` (regla nacida el 2026-07-22, tarea 143, tras un error real en producción). `aFilaRemota` envía todas las columnas declaradas en `configTablas`, y PostgREST rechaza la fila ENTERA si una no existe en el servidor: el cambio se queda reintentándose para siempre en la cola y esa ficha además deja de recibir las novedades del equipo. Al agregar una columna:
    - Declararla en `src/lib/tablas.ts` Y en `supabase/schema.sql` en el mismo cambio, nunca en uno solo. La prueba `src/lib/esquema.test.ts` lo verifica automáticamente y falla si se olvida.
    - Si es nullable y su valor no se limpia nunca desde la interfaz, declararla también en `camposOpcionales`: así se omite del payload cuando vale null y el despliegue no depende de que el usuario aplique el SQL a tiempo. Si el usuario SÍ puede vaciarla (desasignar una persona o una ubicación), NO va ahí: necesita viajar como null.
    - Avisar al usuario, al entregar, que debe ejecutar `supabase/schema.sql` completo en el SQL Editor de Supabase, y que el archivo es idempotente.

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

16. Guía Maestra para recomendar modelo y nivel de razonamiento (acordada con el usuario el 2026-07-20, trasladada a su propio archivo el 2026-07-23). Es la referencia principal para cumplir la regla 3. La prioridad, en tareas de programación/arquitectura/proyectos técnicos, es siempre la calidad sobre el ahorro de tokens; y no recomendar por defecto el modelo más potente, sino la mejor relación calidad/tiempo/costo tras analizar la complejidad real.

    El contenido completo vive en [SELECCION_MODELO.md](SELECCION_MODELO.md), para que cualquier persona que abra el proyecto lo encuentre sin tener que leer todo REGLAS.md: la matriz de 11 criterios con sus umbrales, los cuatro modelos, los niveles Bajo/Medio/Alto/Extra/Max y su equivalencia con el parámetro `level` real de las herramientas de revisión, el modo Ultracode con su reparto de agentes, las reglas de escalamiento, el formato exacto del bloque y ejemplos puntuados con tareas reales ya archivadas de este proyecto. Se aplica antes de empezar cualquier tarea (regla 3), no solo cuando el usuario pregunta explícitamente qué modelo usar.

    Dos decisiones propias de este repo quedaron registradas ahí y conviene revisarlas si el proyecto crece: (a) "Tamaño del proyecto" puntúa 3 sobre 5 (222 archivos fuente, ~44.000 líneas: mediano), lo que da un piso fijo de 3 puntos a toda tarea; (b) guarda contra el falso Fable: para recomendar Fable 5 se exige además que "Tamaño del proyecto" sea 4 o más, porque una auditoría puede pasar de 45 puntos por acumulación de criterios de análisis sin que el tamaño del repo lo justifique. Hoy, en este proyecto, el tope real es Opus 4.8 + Ultracode.

18. Bloque de "siguiente tarea" al final de cada respuesta (regla acordada 2026-07-23). No sustituye a la regla 3 (el bloque de decisión de la tarea ACTIVA, que se muestra antes de empezarla): esta regla agrega, al final de CADA respuesta (no solo al terminar una tarea), un bloque corto con:
    - Cuál sería la siguiente tarea a retomar (la primera de "Por hacer" en TAREAS.md, o la continuación lógica de la que se acaba de cerrar si no hay una obvia).
    - Su puntaje con la matriz de SELECCION_MODELO.md, el modelo y el nivel de esfuerzo recomendados.
    - Si el modelo activo en la sesión no alcanza para esa siguiente tarea, el comando `/model` sugerido.
    Objetivo: que el usuario sepa de entrada, sin preguntar, si conviene seguir con el modelo activo o cambiarlo antes de arrancar lo que sigue.

## Mantenimiento de tareas y documentación

19. Política de mantenimiento de tareas y documentación (acordada con el usuario el 2026-07-23). Es OBLIGATORIA para cualquier modificación del proyecto, sin importar su tamaño. No puede existir ningún cambio sin documentación ni ninguna tarea sin seguimiento.
    - **(a) Registro de tareas.** Toda mejora, bug, optimización, deuda técnica, refactorización, automatización posible, riesgo, inconsistencia, validación faltante, funcionalidad incompleta, problema de UX/accesibilidad/rendimiento/seguridad o idea de mejora que se detecte se registra DE INMEDIATO en la sección correspondiente de [TAREAS.md](TAREAS.md) ("Por hacer" o "En proceso"). Cada tarea incluye como mínimo: **Título, Descripción, Motivo, Impacto, Prioridad (Crítica/Alta/Media/Baja), Estado (Pendiente/En progreso/Completada/Descartada), Área afectada y Dependencias**.
    - **(b) Documentación al día, en el documento correcto.** La documentación se trata como parte del código fuente (única fuente de verdad) y se actualiza EN LA MISMA TAREA que el cambio de código, nunca después. Según qué cambie, se actualiza el documento que corresponde (cada concepto vive en un solo lugar): pantalla, formulario, campo, botón, validación visible, valor por defecto, flujo, navegación o menú va a [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md); regla de negocio, permiso, ciclo de vida o estado, evento, dependencia entre entidades o estructura de datos va a [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md) (y el modelo de datos técnico a [ARQUITECTURA.md](ARQUITECTURA.md)); componente reutilizable (nuevo/eliminado/modificado) va a [COMPONENTES_UI.md](COMPONENTES_UI.md); comportamiento del buscador a [BUSCADOR.md](BUSCADOR.md); una decisión de fondo a [DECISIONES.md](DECISIONES.md). Nunca se permite que la documentación quede desactualizada respecto al código.
    - **(c) Historial de cambios.** Cada modificación se anota en [CHANGELOG.md](CHANGELOG.md), el historial canónico (antes vivía dentro de DOCUMENTACION_FUNCIONAL.md; se movió el 2026-07-24, tarea 167), con: **Fecha, Área modificada, Tipo (Agregado/Modificado/Eliminado/Refactorizado/Optimizado), Descripción, Motivo, Impacto esperado**. Si el cambio afecta la estructura de datos, documentar además tablas, campos, relaciones, restricciones, validaciones e impacto sobre otros módulos.
    - **(d) Verificación cruzada y finalización.** Al cerrar cualquier tarea se verifica que el código coincide con la documentación, que no hay funcionalidades sin documentar ni elementos documentados que ya no existan, y que campos/botones/flujos están al día. Ninguna tarea se considera COMPLETADA hasta que: el código funcione, TAREAS.md esté actualizado, la documentación (el documento que corresponda, ver punto b) refleje el cambio, el [CHANGELOG.md](CHANGELOG.md) esté anotado y la consistencia código<->documentación esté verificada. Si el código cambia, la documentación cambia en la misma tarea.
