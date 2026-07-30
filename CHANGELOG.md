# Historial de cambios

Registro canónico de los cambios del proyecto. Es la única fuente de verdad del historial de cambios (regla 19c de [REGLAS.md](REGLAS.md)).

Formato: cada entrada lleva fecha, y agrupa los cambios por tipo (Agregado, Cambiado, Corregido, Documentación, Seguridad). Los identificadores de tarea (por ejemplo "tarea 167") enlazan con el detalle en [TAREAS.md](TAREAS.md) mientras están en curso, o en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md) una vez cerradas.

> Alcance histórico: este archivo se inaugura el 2026-07-24. El historial detallado tarea por tarea anterior a esa fecha vive en [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md) (no se reescribe aquí para no duplicarlo). Las decisiones de arquitectura, con su motivo, están en [DECISIONES.md](DECISIONES.md).

## 2026-07-30

### Documentación (tarea 176): cerrada por absorción en la tarea 199

**Área modificada:** [TAREAS.md](TAREAS.md), [TAREAS_ARCHIVO.md](TAREAS_ARCHIVO.md), [DECISIONES.md](DECISIONES.md) (AD-021 y AD-026), `src/app/Chasis.tsx` (un comentario).
**Motivo:** decisión del usuario. La tarea 176 (escritorio de las cinco pantallas de Soluciones, turno 2 del handoff) y la parte 2 del turno 5 (tarea 199, maestro-detalle) eran el mismo trabajo visto desde dos turnos distintos: las dos rehacían la misma lista, la misma ficha y el mismo editor. Mantenerlas separadas obligaba a escribir esas tres pantallas dos veces.
**Impacto esperado:** ninguno en el comportamiento de la app. Un solo frente de trabajo para el escritorio de Guías.

- **Eliminado** la tarea 176 del tablero, con su contenido **íntegro** trasladado al frente (b) de la tarea 199: los mockups `2a` a `2f`, sus cuatro reglas (**R8** a **R11**) y sus tres componentes nuevos (`RailSecciones`, `CarrilContexto`, `VistaPreviaViva`). No se descartó nada.
- **Corregido** una ubicación caduca que la 176 arrastraba: apuntaba al tope de ancho de `src/app/ShellNocturne.tsx` línea 108, archivo que la tarea 185 eliminó y cuyo tope reemplazó la 191 en la constante `ANCHO_CONTENIDO` de `Chasis.tsx`.
- **Cambiado** el comentario del nivel `tarea` en `Chasis.tsx`, que remitía a la 176 para el ancho de los editores, y ahora remite a la 199 diciendo por qué los cuatro puntos de quiebre de la 191 no llegan a ese nivel a propósito.

### Cambiado (tarea 191): el chasis en cuatro puntos de quiebre

**Área modificada:** `src/app/Chasis.tsx`, `src/index.css`, `src/components/BarraReanudar.tsx`, `src/features/dispositivos/DispositivoPage.tsx`, `src/features/soluciones/ArticuloPage.tsx`.
**Motivo:** turno 5 del handoff "Auditoría de Soluciones TI" (mockups `5a` a `5d`), reglas **R25**, **R26** y **R30**. Los puntos de quiebre eran los de Tailwind por defecto (640/768/1024/1536) y solo el de 1024 cambiaba algo estructural, así que entre 768 y 1023 no había sidebar, el contenido ya medía 768 y la barra de pestañas seguía anclada a 448 px centrados: una isla flotante en cualquier iPad en horizontal o ventana a media pantalla.
**Impacto esperado:** cierra el hueco de tableta para las 44 rutas a la vez, sin tocar ninguna pantalla (el ancho lo decide el chasis). Sin cambios de datos.

- **Cambiado** los puntos de quiebre del chasis a cuatro, con una composición completa en cada uno: `<768` teléfono (columna de 448 y pestañas), `768` rail de iconos de 64 px sin pestañas, `1280` sidebar completa de 240, `1680` sidebar de 232 y columna de hasta 1294 (322 de lista + 720 de documento + 252 de contexto, el presupuesto de las tres zonas que reparte la tarea 199).
- **Agregado** el punto de quiebre `3xl` como token de `@theme` en `src/index.css`, **en rem (105rem) y no en px**: ver [DECISIONES.md](DECISIONES.md) AD-028, porque en px la regla se emite antes que las de `sm`/`md`/`lg`/`xl` y queda pisada.
- **Agregado** la variante `sidebar` de `BarraReanudar`: en escritorio el procedimiento a medias vive al pie del rail, encima de la cuenta, en vez de flotar sobre el contenido. En el rail estrecho queda solo el anillo de avance, con el botón de descarte debajo; sin arrastre, porque deslizar es un gesto de dedo.
- **Cambiado** `lg:px-12` por `lg:px-10` en la ficha de equipo y la de artículo: eran 8 px de desalineación entre fichas hermanas y con la fila de chips de la propia ficha de equipo (**R26**).
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.0 y 2.10i; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) sección del chasis; [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md) 11.2; [DECISIONES.md](DECISIONES.md) AD-028.

**Verificación:** typecheck, lint y build limpios; 1724 pruebas pasan (los 4 fallos de siempre, preexistentes y ajenos). **Medido en navegador real** con un banco temporal (retirado antes de commitear), en seis anchos: 375 (sin sidebar, pestañas, columna 375), 767 (sin sidebar, pestañas, columna 448), 768 (rail de 64, sin pestañas, columna 689), 1279 (rail de 64, columna 1040), 1280 (sidebar 240 con rótulo, columna 1025) y 1680 (sidebar 232, columna 1294). Sin desborde horizontal en ninguno. La barra de reanudar de escritorio se midió dentro del ancho real de sus dos railes: 46 px de contenido en el rail de 64 y 206 en el de 232, sin desborde, con el rótulo oculto por debajo de 1280 y el botón de descarte siempre presente. **Dos defectos encontrados al medir**, los dos invisibles leyendo el código y corregidos en la misma tarea: el punto de quiebre en px quedaba pisado por `xl` (ver AD-028) y la columna se estrechaba al ensanchar la ventana (1200 px a 1279, 1040 a 1280) porque la banda de tableta no tenía tope.

**Pendiente de esta regla:** **R26** queda a medias. Se eliminó el par `lg:px-10`/`lg:px-12` entre fichas hermanas, que es lo que el handoff midió, pero la cabecera del chasis (`pl-4`) y el cuerpo (`lg:px-10`) siguen sin compartir eje. Alinearlos toca la cabecera de las 44 rutas y se hace en la tarea 199, que rehace la ficha para el maestro-detalle.

### Agregado (tarea 187): comportamientos dinámicos del chasis

**Área modificada:** `src/app/Chasis.tsx`, `src/app/direccionTransicion.ts`, `src/app/memoriaScroll.ts`, `src/app/memoriaPestana.ts` (los tres nuevos), `src/components/CabeceraColapsable.tsx` y `src/components/AvisoPestana.tsx` (nuevos), `src/components/BarraSuperior.tsx`, `src/components/PastillaSync.tsx`, `src/features/inicio/usePendientes.ts` (nuevo), `src/features/inicio/InicioPage.tsx`, `src/features/soluciones/SolucionesPage.tsx`, `src/lib/navegacion.ts`, `src/index.css`.
**Motivo:** turno 4 del handoff "Auditoría de Soluciones TI" (mockup `4e`), reglas **R20**, **R21** y **R23**. La app no tenía ninguna transición (ni `startViewTransition` ni transformaciones de entrada) ni memoria de posición: cambiar de pestaña y volver reiniciaba el scroll y borraba el filtro de categoría, porque la pestaña apuntaba a la ruta pelada. Y la barra inferior nunca reflejaba que hubiera pendientes o trabajo a medias, aunque la app ya calculaba los dos datos.
**Impacto esperado:** alto en percepción de uso ("la diferencia entre una app y una web"), sin esquema ni tabla nuevos: los avisos salen de cálculos que ya existían.

- **Agregado** `src/app/direccionTransicion.ts`: la dirección de la transición de entrada según la jerarquía (R21). Más profundo es `entra`, menos profundo `vuelve`, y de una raíz de pestaña a otra siempre `lateral`, aunque `/` y `/soluciones` tengan distinta cantidad de segmentos. Memoriza por `location.key` para ser segura bajo `StrictMode`, que monta cada componente dos veces en desarrollo.
- **Agregado** en `src/index.css` los tres keyframes (`chasis-entra` 180 ms desde la derecha, `chasis-vuelve` 180 ms desde la izquierda, `chasis-lateral` 120 ms de fundido), aplicados por el atributo `data-transicion` que pone el chasis y anulados en bloque bajo `prefers-reduced-motion`.
- **Agregado** `src/app/memoriaScroll.ts` y `src/app/memoriaPestana.ts`: las dos mitades de la memoria por pestaña (R20). El scroll se guarda por ruta y se restaura al montar (con un reintento a los dos fotogramas, porque los datos de Dexie llegan después del primer render). Los filtros se guardan por raíz de pestaña y el enlace de la pestaña los vuelve a poner al regresar; estando dentro de la pestaña el enlace queda pelado, para que tocar la pestaña activa suelte el filtro y vuelva a su raíz.
- **Cambiado** `SolucionesPage`: los tres filtros de eje (categoría, tipo, etiqueta) ahora **escriben** en la URL con `replace`, no solo se leen como semilla inicial. Sin esto no había nada que recordar: el chip vivía únicamente en el estado local. El texto buscado no viaja (es transitorio y reescribiría la URL en cada tecla).
- **Agregado** `src/components/CabeceraColapsable.tsx`: el nombre de la sección se contrae de 21 a 14 px al desplazarse y no se va nunca de pantalla.
- **Agregado** `src/components/AvisoPestana.tsx`: punto (Guías, procedimiento a medias descartado) y número (Más, conteo real de pendientes, "9+" por encima de nueve), los dos con texto accesible oculto y ninguno decorativo (**R23**).
- **Refactorizado** las cinco consultas de "Pendientes" salen de `InicioPage` a `src/features/inicio/usePendientes.ts`, porque el chasis necesita el conteo **real** y no solo los seis que Inicio muestra.
- **Cambiado** `PastillaSync` se vuelve adaptativa: al día no gasta palabras en la buena noticia (solo el icono, en el mismo hueco de 44x44 que el resto de botones de la fila) y el resto de estados dicen el número real ("3 sin subir", "2 con error") en vez de un genérico "Sincronizando".
- **Cambiado** tocar la pestaña ya activa sube al principio de la lista; con un filtro puesto o desde una ficha interna, primero vuelve a la raíz de la pestaña.
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.0, 2.10f, 2.10g, 2.10j y 2.10k (los dos últimos nuevos); [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) sección del chasis; [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md) 11.2.

**Verificación:** typecheck, lint y build limpios. 1724 pruebas pasan, 24 de ellas nuevas (`memoriaPestana.test.ts`, `direccionTransicion.test.ts` y `esRaizDePestana` en `navegacion.test.ts`); los 4 fallos que quedan son los mismos **preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage con el `.env` real), duplicados por el worktree obsoleto de la tarea 178. **Verificación en navegador parcial**, con un banco temporal fuera de `RequireAuth` (retirado antes de commitear): se confirmó por DOM y estilo computado que `PastillaSync` al día mide exactamente 44x44 sin texto, que el contenedor recibe `data-transicion` con la animación correcta aplicada (`chasis-lateral`, 0,12 s) y que `AvisoPestana` se dibuja en sus dos variantes. **Lo que depende de scroll o de clic quedó sin verificar** (cabecera colapsable, memoria de scroll, memoria de filtros de punta a punta): con el panel del navegador oculto la página no compone fotogramas, así que el navegador no despacha eventos de `scroll` ni de puntero al React de la página, y el JS inyectado corre en un mundo aislado desde el que no se pueden simular. Queda pendiente repetir esa parte con el panel visible.

## 2026-07-28

### Agregado (tarea 186): `BarraReanudar`, el procedimiento a medias viaja contigo

**Área modificada:** `src/app/Chasis.tsx`, `src/components/BarraReanudar.tsx` (nuevo), `src/features/soluciones/useReanudar.ts` (nuevo).
**Motivo:** turno 4 del handoff "Auditoría de Soluciones TI" (mockup `4e`), regla **R23**. Caso real: estar en el paso 3 de un mantenimiento y salir a la Bóveda a buscar una clave; hasta ahora la app no recordaba en pantalla que había algo a medias y había que volver a Inicio a reconstruirlo. El propio handoff la señala como "la propuesta que más cambia el día del técnico".
**Impacto esperado:** alto en uso diario, sin esquema nuevo ni tabla nueva: el dato (`db.progresoPasos`) ya existía.

- **Agregado** `src/features/soluciones/useReanudar.ts`: el procedimiento a medias más reciente de todo el equipo de artículos, reutilizando `articulosSinTerminar` (ya usado en el bloque "Sin terminar" de `SolucionesPage`) en vez de duplicar la consulta a `progresoPasos`. También resuelve si ese procedimiento está descartado (persistido en `localStorage`, una clave con el id del último artículo descartado).
- **Agregado** `src/components/BarraReanudar.tsx`: barra flotante con el título, "Paso N de M", los minutos restantes y "Seguir" (directo al asistente). Se descarta con arrastre horizontal (umbral de 90 px) o con un botón "X" siempre presente. El arrastre solo captura el puntero una vez superado un umbral de 6 px, para no robarle el click a la X ni al enlace "Seguir" cuando es solo un toque.
- **Cambiado** `Chasis`: monta `BarraReanudar` en los niveles `seccion` y `documento` (no en `tarea`, que ya tiene su propia `BarraTarea`, R19). Mientras el procedimiento vigente esté descartado, la pestaña Guías (solo móvil) suma un punto de aviso junto a su icono.
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.0 y 2.10i (nuevo); [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) sección del chasis; [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md) 11.2.

**Verificación:** typecheck, lint y build limpios. 1702 pruebas pasan; los 4 fallos que quedan son los mismos **preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage con el `.env` real), duplicados por el worktree obsoleto de la tarea 178. **Verificado en navegador real** con un banco de pruebas temporal (bypass de sesión en `RequireAuth` + una siembra de artículo/progreso, ambos retirados antes de commitear): la barra aparece en Inicio con el paso y los minutos correctos, el botón "X" la descarta, el punto aparece en la pestaña Guías en viewport móvil (375x812) y desaparece la barra; el arrastre horizontal (simulado con eventos de puntero reales) también descarta al superar el umbral. Encontrado y corregido en la misma tarea: la primera versión capturaba el puntero desde el primer píxel de movimiento, lo que impedía el click normal del botón "X" y del enlace "Seguir" (un `setPointerCapture` inmediato retargetea el `pointerup` al contenedor); ahora solo se captura tras superar 6 px de arrastre real.

### Refactorizado (tarea 185): un solo chasis, con tres niveles, y `BarraTarea`

**Área modificada:** el chasis (`src/app/Chasis.tsx`, nuevo, que absorbe y reemplaza a `src/app/ShellNocturne.tsx`, eliminado), `src/components/BarraTarea.tsx` (nuevo), `src/lib/navegacion.ts`, `src/App.tsx` y las 35 pantallas de `src/features/`.
**Motivo:** turno 4 del handoff "Auditoría de Soluciones TI" (mockups `4a` a `4c`), reglas **R18**, **R19** y **R22**. Convivían dos chasis: 13 pantallas montaban `ShellNocturne` (sidebar y pestañas) y 25 montaban a mano un `mx-auto max-w-md` con su propia cabecera. El problema no se veía en ninguna pantalla suelta sino en el trayecto: pasar de la ficha al editor apagaba la navegación y ponía otra barra fija en su lugar sin avisar, y tres listas que se recorren durante minutos (Personas, Ubicaciones, Diagnósticos) habían quedado como islas con una sola salida.
**Impacto esperado:** el chasis deja de encenderse y apagarse sin motivo; cualquier cambio en la barra se hace en un archivo y no en once. Sin cambios de datos, de esquema ni de permisos.

- **Agregado** `src/app/Chasis.tsx`: un solo componente con `modo = seccion | documento | tarea` (unión discriminada, así cada nivel solo acepta sus props). Reemplaza a `ShellNocturne` y a los 15 contenedores `max-w-md` escritos a mano. Cada pantalla declara su nivel (R18).
- **Agregado** `src/components/BarraTarea.tsx`: la cabecera del nivel 3. El nivel `tarea` es el único que puede quedarse sin pestañas, y a cambio pone fondo de superficie, rótulo de lo que se hace ("Editando", "Ejecutando", "Migrando"), sobre qué, la ruta de vuelta **escrita** ("Guías › Impresoras · vuelves aquí al terminar") y una X siempre en el mismo sitio (R19). Sustituye a las cabeceras propias de los editores.
- **Agregado** `vueltaDeTarea(pathname)` en `src/lib/navegacion.ts`: devuelve el texto de la vuelta desde la jerarquía central, o `null` cuando esta solo sabe decir "Volver" (editar y ejecutar suben a una ficha cuyo nombre depende de datos en runtime), y entonces la pantalla escribe el suyo. **9 pruebas nuevas.**
- **Cambiado** el reparto de niveles de las 44 rutas: 6 de sección, 15 de documento y 22 de tarea. **Personas, Ubicaciones, Diagnósticos, Sugerencias, Estadísticas, Mi cuenta y Seguridad recuperan la barra de pestañas**, que habían perdido por aplicarles la regla de "pantalla enfocada" donde no correspondía.
- **Cambiado** la cabecera del nivel documento a una sola gramática (regreso a la izquierda, acciones a la derecha, dentro de un bloque pegajoso), en vez de los cuatro rellenos distintos que había (`px-2`, `pl-2 pr-3`, `px-4`, `py-2.5`). Varias fichas ganan cabecera pegajosa, que antes no tenían.
- **Eliminado** el `pb-[116px]` escrito a mano en 11 pantallas: **el chasis reserva su propio espacio** (R22), en una sola constante.
- **Corregido**, de paso, la medida de esa reserva: el handoff dice "una barra que mide 53", dato anterior a la tarea 182. Medida en el navegador, la barra mide **64,6 px** (63,6 de celda más 1 de borde), así que la reserva quedó en `calc(65px + env(safe-area-inset-bottom))`. Copiar el 53 habría dejado unos 12 px de contenido bajo la barra.
- **Cambiado** `BotonVolver`: pasa de 31 consumidores a **dos** (el chasis y `BarraTarea`). Las pantallas ya no dibujan su regreso; solo pasan `volverA`/`volverEtiqueta` cuando el destino depende de datos en runtime.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-026 (los tres niveles y qué pantalla es cuál) y AD-027 (la reserva se mide, no se copia); [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.0, 2.4, 2.10f, 2.10h y sección 4; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) secciones 2 y 3 (la columna "Shell" de la tabla de rutas pasa a "Nivel del chasis") y las fichas de pantalla; [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md) 11.2; [ARQUITECTURA.md](ARQUITECTURA.md) sección 3.

**Verificación:** lint, `tsc -b` y build limpios. 1702 pruebas pasan; los 4 fallos que quedan son los mismos **preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage con el `.env` real), duplicados por el worktree obsoleto de la tarea 178. **Los tres niveles SÍ se verificaron en navegador real** con un banco de pruebas temporal (retirado antes de commitear), a 375x812 y a 1280x800: el nivel sección monta barra superior y las cinco pestañas; el documento conserva las pestañas y su regreso apunta a donde dice; el tarea va sin pestañas y sin sidebar, con la barra de superficie y la X. Medido que la reserva (65 px) iguala el alto real de la barra y que la última fila no queda tapada. **Sin verificar en navegador las 35 pantallas reales**: viven detrás del login y esta sesión no tiene cuenta de técnico.

### Agregado (tarea 184): login que se presenta y bienvenida del primer día

**Área modificada:** autenticación (`src/features/autenticacion/LoginPage.tsx`, `CuentaPage.tsx`), Inicio (`src/features/inicio/InicioPage.tsx` y dos archivos nuevos), chasis (`src/app/ShellNocturne.tsx`, `src/main.tsx`), y dos piezas compartidas nuevas en `src/components`.
**Motivo:** turno 3 del handoff "Auditoría de Soluciones TI" (mockup `3b`). Con la base vacía, seis de los nueve bloques de Inicio no se pintan, así que a un técnico nuevo le quedaban un saludo, un buscador y tres atajos. El login no decía qué es esto, de quién es, ni qué hacer si no tienes cuenta o si olvidaste la contraseña. Y la app instalable no invitaba a instalarse en ninguna pantalla, pese a que de eso depende el trabajo sin señal.
**Impacto esperado:** el primer arranque explica la app y encamina la instalación. Sin cambios de datos ni de esquema.

- **Agregado** `src/lib/instalacionPwa.ts`: store externo con el estado de instalación (`instalada` / `puedeInstalar` / `requiereManual`), registrado desde `main.tsx` y **no** desde un componente, porque `beforeinstallprompt` se dispara una sola vez y muy pronto, mientras que todas las pantallas van con `lazy`. Detecta "ya instalada" por `display-mode` y por `navigator.standalone` (iOS), escucha `appinstalled`, y cae a instrucciones manuales cuando no hay diálogo nativo (Safari de iOS siempre). Detalle técnico en [ARQUITECTURA.md](ARQUITECTURA.md) sección 7.
- **Agregado** `src/components/BotonInstalarApp.tsx`: el botón compartido por los dos únicos sitios desde donde la app ofrece instalarse (la bienvenida y Mi cuenta), con el modal de los tres pasos manuales dentro.
- **Agregado** `src/features/inicio/BienvenidaPrimerDia.tsx` con su lógica pura en `bienvenida.ts`: tres pasos que se apagan solos (entraste · instala la app · descarga para offline), sin tour modal y **sin botón de cerrar**. Se retira sola cuando los tres están hechos o cuando Inicio ya tiene bloques propios (recientes, pendientes o un procedimiento a medias).
- **Agregado** `src/components/Marca.tsx`: el glifo del cerebro sale de dentro de `ShellNocturne.tsx` a pieza propia, porque el login lo necesita también.
- **Cambiado** el **login**: marca de 52 px, una línea de qué es esto (sin nombrar a la organización), "¿La olvidaste?" con 44 px reales de zona táctil (regla R6; el mockup lo dibuja de 18) que abre un panel con el camino real de recuperación, "¿Sin cuenta? Pídesela al administrador de la app", y botón "Ingresar" de 52 px. El rótulo de Contraseña usa `htmlFor` (no puede envolver el campo, porque comparte fila con un `<button>`).
- **Cambiado** el **autocompletado del login**: el correo ahora sí se autocompleta (`autoComplete="username"`); el `autoComplete="off"` del `<form>` se retiró porque anulaba esa pista. La contraseña sigue fuera del gestor, garantizado por `CampoContrasena` (texto enmascarado por CSS, así que el llavero no reconoce el formulario como login).
- **Eliminado** el **saludo por hora** del encabezado de Inicio ("Buenos días/tardes/noches. Todo el conocimiento del equipo, al instante"), decisión aprobada por el usuario: cambiaba tres veces al día, así que la entrada nunca se veía igual dos veces.
- **Agregado** en **Mi cuenta** la tarjeta "Instalar la app en este dispositivo", visible solo mientras la app no corra ya instalada.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-025 (las dos decisiones del usuario: sin nombre de organización, y recuperación por el administrador en vez de por correo); [ARQUITECTURA.md](ARQUITECTURA.md) sección 7 (instalación de la PWA); [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.2c, 2.2d, 3.8d, secciones 4 y 5; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) secciones 5.1, 6.6, 6.9, 7, 8 y 10.

**Verificación:** lint, `tsc -b` y build limpios. **22 pruebas nuevas** (8 de `bienvenida.ts`, 14 de `instalacionPwa.ts` con una ventana falsa, la única forma de cubrir un módulo de navegador con `environment: 'node'`). 1699 pruebas pasan con `npm test`; sin el worktree obsoleto de la tarea 178, que duplica la suite, son **911 pasan / 2 fallan**, y esos 2 son los mismos **preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage con el `.env` real). **El login SÍ se verificó en navegador real** (375x812 y 375x667): sin errores de consola, sin scroll en ninguno de los dos ejes, el panel de "¿La olvidaste?" abre y cierra, "¿La olvidaste?" mide 44 px, "Ingresar" 52, el correo lleva `autocomplete="username"` y la contraseña sigue en `type="text"` enmascarado. **Sin verificar en navegador** la bienvenida de Inicio y la tarjeta de Mi cuenta: viven detrás del login y esta sesión no tiene cuenta de técnico.

### Agregado (tarea 183): sidebar completo de escritorio, de cinco a catorce destinos

**Área modificada:** `src/app/ShellNocturne.tsx` (solo el `<aside>` de escritorio).
**Motivo:** turno 3 del handoff "Auditoría de Soluciones TI" (mockup `3e`, "el sidebar tiene 240 px de alto libre y ofrece cinco destinos de catorce"). Los mismos ocho destinos que la tarea 182 le dio puerta en móvil (dentro de "Más") seguían sin ella en escritorio, donde "Más" no existe.
**Impacto esperado:** en escritorio, Diagnóstico, Escanear, Ubicaciones y Personas dejan de alcanzarse solo desde dentro de otra sección; el espacio libre del sidebar (antes vacío bajo el nav de 5 ítems) se usa.

- **Agregado** grupo **"Herramientas"** (Diagnóstico, Escanear) y grupo **"Registros"** (Ubicaciones, Personas), con su rótulo (`TituloSeccion`, el mismo componente de otras cabeceras de sección) y un enlace por fila (`EnlaceGrupo`, local del archivo): icono sin variante rellena que recolorea a acento cuando está activo, para no sumar más colisiones al set de iconos (deferido a la tarea 189, regla R24).
- **Cambiado** el perfil al pie del sidebar usa ahora `Avatar` (iniciales del técnico) y un caret, en vez de solo nombre y correo en texto; el subtítulo pasa a ser el rótulo fijo "Mi cuenta" (mismo criterio que el mockup), no el correo.
- **Sin cambios** el nav principal (Inicio, Guías, Equipos, Red, Bóveda con permiso): la Bóveda sigue ahí, no baja a ningún grupo nuevo. Etiquetas QR e Importar **no** ganan entrada en el sidebar: siguen alcanzándose solo desde el "···" de Equipos, igual que en móvil desde la tarea 182.
- **Documentación:** [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) secciones 2, 5.6 y 10.

**Verificación:** lint, `tsc -b` y build limpios. 1677 pruebas pasan (sin pruebas nuevas: cambio de presentación pura, sin lógica propia que aislar). Siguen los mismos **4 fallos preexistentes y ajenos** de `archivosPendientes.test.ts`. La app arranca sin errores de consola. **Sin verificar en navegador con sesión real**: el sidebar vive detrás del login y esta sesión no tiene cuenta de técnico.

### Agregado (tarea 182): barra de pestañas de cinco destinos fijos y la pantalla "Más"

**Área modificada:** chasis (`src/app/ShellNocturne.tsx`, ruta y pantalla nuevas `src/features/mas/PantallaMas.tsx`), navegación (`src/lib/navegacion.ts`), `UbicacionesPage.tsx`, `PersonasPage.tsx`.
**Motivo:** turno 3 del handoff "Auditoría de Soluciones TI" (mockups `3e`/`3f`). Ocho destinos (Diagnóstico, Escáner, Ubicaciones, Personas, Mi cuenta, Seguridad, Etiquetas, Importar) no aparecían ni en la barra ni en el sidebar; solo se alcanzaban desde dentro de otra sección. La barra móvil además cambiaba de 4 a 5 columnas según el permiso de Bóveda, así que dos técnicos con el mismo teléfono veían barras distintas.
**Impacto esperado:** todo destino gana puerta (regla R15) sin que la barra dependa del permiso de nadie (R17). Cuesta un toque a quien tiene acceso a la Bóveda.

- **Agregado** `src/features/mas/PantallaMas.tsx`: quinta pestaña, en cuatro grupos. "Consulta protegida" (Bóveda, solo con permiso, fila destacada). "Herramientas" (Diagnóstico, Escanear equipo). "Registros" (Ubicaciones y Personas con conteo en vivo, Etiquetas QR, Importar). "Mi cuenta" (perfil con avatar, Bloqueo y seguridad con su estado leído en vivo).
- **Agregado** icono `DotsNine` (`src/components/iconos.tsx`): el glifo de "Más", sin variante rellena (el mockup usa el mismo trazo activo e inactivo).
- **Agregado** `src/components/Avatar.tsx`: extrae el avatar con iniciales que ya vivía en `BarraSuperior` (tarea 181), reutilizado ahora en la fila de perfil de "Más".
- **Cambiado** `ShellNocturne.tsx` separa por primera vez la lista de destinos de escritorio (sin cambios: Bóveda condicional al permiso, sigue así hasta el sidebar completo de la tarea 183) de la de móvil, que ahora es **siempre** Inicio · Guías · Equipos · Red · Más, igual para todos. La Bóveda deja de ser pestaña móvil (decisión aprobada por el usuario).
- **Cambiado** estado de la pestaña activa en tres canales (R16 pide mínimo dos, antes había uno y medio): barra de 2px sobre la pestaña, icono relleno y color de acento; suma estado presionado (fondo de acento al 10%) y anillo de foco de 2px, que no existían. Rótulo de 10,5px a 12px, celda de 44px a 52px.
- **Cambiado** `src/lib/navegacion.ts`: el "Volver" de Ubicaciones y Personas sube ahora a "Más", no a Equipos (antes llevaba a una sección que el técnico no había visitado si llegaba por un enlace; ver [DECISIONES.md](DECISIONES.md) AD-024). Etiquetas QR e Importar conservan a Equipos como padre: su camino principal sigue siendo el menú "···" de esa sección.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-024; [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.2b (`Avatar`), 2.4 (`BotonVolver`) y la nota de `DotsNine`; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) secciones 2, 3, 5.6 (nueva), 6.3, 6.4, 6.6, 6.7, 10 y 14.

**Verificación:** lint, `tsc -b` y build limpios. 1677 pruebas pasan (sin pruebas nuevas: la pantalla es routing y presentación, cubierta por la app en conjunto; `navegacion.test.ts` se actualizó para las etiquetas nuevas). Siguen los mismos **4 fallos preexistentes y ajenos** de `archivosPendientes.test.ts`. La app arranca sin errores de consola; `/mas` resuelve la ruta y redirige limpio a `/login` sin sesión. **Sin verificar en navegador con sesión real**: la pantalla vive detrás del login y esta sesión no tiene cuenta de técnico.

### Agregado (tarea 181): barra superior global, con el buscador y el estado del dato en las cinco pestañas

**Área modificada:** chasis (`src/components/BarraSuperior.tsx`, `PastillaSync.tsx`) y las cinco pestañas raíz; buscador (`src/features/busqueda/`).
**Motivo:** turno 3 del handoff "Auditoría de Soluciones TI" (mockup `3d`). El shell aportaba pestañas y sidebar y nada más: cada pantalla dibujaba su propia cabecera con altura, relleno y controles distintos, y los tres servicios globales vivían dentro de una sola pestaña.
**Impacto esperado:** encontrar cualquier cosa pasa a un toque desde donde estés, sin perder el sitio; y en las cinco pestañas se sabe si lo que se acaba de escribir ya subió. Sin cambios de datos ni de esquema.

- **Agregado** `src/components/BarraSuperior.tsx`: tres ranuras fijas y siempre en el mismo orden (regla **R14**): título de la sección · estado del dato · buscar + cuenta. Por ahora cubre el modo raíz; los modos documento y tarea llegan con el chasis de tres niveles (tarea 185).
- **Agregado** `src/features/busqueda/BuscadorGlobal.tsx`: el buscador global en capa, invocable desde cualquier pestaña. **Declara su alcance por escrito** ("Busca en todo a la vez: Guías, Equipos, Bóveda, Ubicaciones y Personas"), que era la otra mitad del problema: cinco buscadores con la misma forma y cinco alcances distintos. Portal a `document.body` por el mismo motivo que `Modal` (la barra lleva `backdrop-blur`, que crea bloque contenedor).
- **Agregado** `src/lib/iniciales.ts` (+ 8 pruebas): las iniciales del técnico para el avatar de la cuenta, que resuelve nombre suelto, nombre y apellidos, espacios de más y el respaldo por correo.
- **Refactorizado** la presentación de resultados sale de `InicioPage.tsx` a `src/features/busqueda/resultados.ts` (catálogo y helpers: `VISUAL_POR_TIPO`, `GRUPOS_BUSQUEDA`, `partirTitulo`, `agruparResultados`) y `ResultadosBusqueda.tsx` (los componentes). Separados en dos archivos para no mezclar componentes y constantes, que `oxlint` avisa por fast-refresh. `InicioPage` pierde 70 líneas.
- **Refactorizado** `PastillaSync` sale de `InicioPage.tsx` a `src/components/PastillaSync.tsx` y se monta en el chasis (regla **R7** aplicada al chasis), con la forma del mockup: sin borde, 44 px de alto de toque, rótulo de 12 px y el icono llevando el color del estado.
- **Cambiado** las cinco pestañas raíz (`InicioPage`, `SolucionesPage`, `DispositivosPage`, `RedPage`, `BovedaPage`) dejan de dibujar su propia fila de título y montan `BarraSuperior`. Sus acciones ("Crear", "Escanear", el menú "···", los subtítulos, la pastilla de frescura) bajan a la banda de controles inmediatamente debajo: ver [DECISIONES.md](DECISIONES.md) AD-023, que resuelve la contradicción entre el turno 1 y el turno 3 del handoff. Los subtítulos suben de `neutral-500` a `neutral-400` para cumplir **R2**.
- **Cambiado** "Mi cuenta" deja de alcanzarse solo desde Inicio en el teléfono: el avatar vive ahora en la barra de las cinco pestañas.
- **Sin cambios** Inicio conserva su buscador en línea además de la lupa, porque esa pantalla ES el buscador: abrir y buscar sigue tomando dos toques.
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.10f, 2.10g, 2.13 y 3.8c; [DECISIONES.md](DECISIONES.md) AD-023; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) secciones 2, 5.1 a 5.5 y 12; [BUSCADOR.md](BUSCADOR.md) secciones 1, 3, 7, 11 y 12.

**Verificación:** lint, `tsc -b` y build limpios. 1677 pruebas pasan (8 nuevas de `iniciales`). Siguen los mismos **4 fallos preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage), duplicados por el worktree obsoleto de la tarea 178. La app arranca sin errores de consola y redirige limpio a `/login`. **Sin verificar en navegador**: la barra vive detrás del login y esta sesión no tiene cuenta real de técnico.

### Cambiado (tarea 180): un solo nombre visible, y las secciones pasan a llamarse Guías y Equipos

**Área modificada:** chasis (`src/app/ShellNocturne.tsx`), jerarquía de navegación (`src/lib/navegacion.ts`), Inicio, y los textos visibles de las secciones Guías, Equipos, Diagnóstico, Ubicaciones y Personas.
**Motivo:** primera recomendación del turno 3 del handoff "Auditoría de Soluciones TI", reimportado hoy. La app se presentaba con dos nombres ("Soluciones IT" en login y bloqueo, "IT Brain" en Inicio y el sidebar) y una sección se llamaba igual que la app. Decisión aprobada por el usuario en `Decisiones aprobadas.md`.
**Impacto esperado:** la primera impresión deja de contradecirse, el encabezado vuelve a confirmar la pestaña activa, y la palabra "solución" queda libre para el bloque anidado dentro de un paso, que es donde significa algo. Sin cambios de comportamiento ni de datos.

- **Cambiado** el sidebar de escritorio dice "Soluciones IT" donde decía "IT Brain"; el glifo del cerebro se conserva como marca.
- **Cambiado** el encabezado de Inicio dice "Inicio" donde decía "IT Brain". Era la única pestaña en la que el rótulo y el encabezado no coincidían.
- **Cambiado** la pestaña y todos los rótulos de la sección Soluciones pasan a **"Guías"**; los de Dispositivos, a **"Equipos"**. Incluye las etiquetas de regreso de `navegacion.ts` (que alimentan `BotonVolver` en Ubicaciones, Personas y las fichas), los grupos del buscador global, los títulos de lista, los estados vacíos, el diálogo de eliminar, el editor de equipo y las etiquetas del historial.
- **Cambiado** el vocabulario visible del inventario se unifica en "equipo": "Equipos afectados", "Crear equipo", "Ningún equipo coincide", "Guardar equipo". **No** se tocaron los textos donde "dispositivo" significa el teléfono del técnico ("el archivo quedó guardado en este dispositivo", "bloqueo de este dispositivo"), que conservan la palabra a propósito.
- **Sin cambios** las rutas `/soluciones` y `/dispositivos`, los identificadores de código y el esquema de datos. El motivo está en [DECISIONES.md](DECISIONES.md) AD-022.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-022 (la decisión y sus límites) y [TAREAS.md](TAREAS.md) (registro de las diez tareas nuevas que salen de los turnos 2, 3 y 4 del handoff).

**Verificación:** lint, `tsc -b` y build limpios. 1669 pruebas pasan, incluidas las de `navegacion.test.ts` actualizadas a las etiquetas nuevas. Siguen los mismos **4 fallos preexistentes y ajenos** de `archivosPendientes.test.ts` (RLS de Storage contra el `.env` real de la sesión), duplicados por el worktree obsoleto de la tarea 178. **Sin verificar en navegador**: la app exige login de técnico real, no disponible en esta sesión.

## 2026-07-27

### Corregido (tarea 179): el botón "Actualizar" del aviso de versión nueva no hacía nada

**Área modificada:** `src/components/ActualizacionDisponible.tsx`.
**Motivo:** reportado por el usuario en su teléfono justo al ir a revisar el rediseño de P1: pulsaba "Versión nueva disponible / Actualizar" y no ocurría nada.
**Impacto esperado:** el botón siempre recarga, así que un despliegue nuevo siempre se puede aplicar desde el aviso.

- **Corregido** la recarga ya no se delega en la librería. `updateServiceWorker` acaba llamando a `messageSkipWaiting()` de workbox-window, que es literalmente `registration.waiting && enviarMensaje(...)`: si en ese momento no hay worker en espera **no hace nada en silencio**, no se emite `controllerchange` y no hay recarga, pero el aviso sigue visible porque `needRefresh` continúa en `true`. El botón quedaba inerte de forma permanente hasta recargar a mano. `registration.waiting` puede ser `null` con el aviso delante si otra ventana de la app ya activó ese worker, o si el teléfono suspendió la app y el navegador lo activó por su cuenta: raro en escritorio y normal en móvil, que es por qué el fallo solo se veía en el teléfono. Ahora el componente engancha su propio `controllerchange` y además una red de seguridad por tiempo (2,5 s) que recarga igual; como el worker nuevo ya está activo en ese escenario, esa recarga trae la versión nueva de todos modos.
- **Cambiado** al pulsar, el botón pasa a "Actualizando..." y se deshabilita. Parte del reporte era que el toque no daba ninguna señal de haberse registrado.
- **Documentación:** [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.1, [ARQUITECTURA.md](ARQUITECTURA.md) sección 7 y [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) (acciones transversales).

**Verificación:** typecheck, lint y build limpios. Reproducción de punta a punta en `vite preview` con Chrome real: con la v1 controlando la página, se construyó una v2 con un marcador visible, el aviso apareció, y pulsar "Actualizar" recargó dejando el marcador de la v2 en pantalla y el aviso retirado (`waiting` a `null`). Verificado también con el worker nuevo ya en espera antes de cargar la página, que es lo que pasa al abrir la app desde el icono. **El tramo concreto que fallaba (aviso visible con `waiting` en `null`) no se pudo reproducir en escritorio**: Chrome no permite redefinir `location.reload` para observar el intento de recarga sin navegar, y ese estado depende del ciclo de vida del móvil. Queda probado por lectura del código enviado (la guarda existe en el build minificado de workbox-window 7.4.1) y el arreglo es un superconjunto del comportamiento anterior: solo puede añadir una recarga que antes no ocurría.

### Rediseño de la lista de Soluciones (tarea 171, pantalla P1 del handoff "Auditoría de Soluciones TI")

**Área modificada:** sección Soluciones (`/soluciones`) y componentes compartidos de `src/components`.
**Motivo:** implementar la auditoría de diseño de la sección, que documentó 11 problemas y 13 decisiones para esta pantalla, más 7 reglas visuales transversales.
**Impacto esperado:** la cabecera pegajosa baja de 232 px a ~156 px (más artículos visibles antes del primer scroll), retomar un procedimiento a medias pasa de 4 toques a 1, y desaparecen los controles muertos y los textos por debajo del mínimo de contraste AA.

- **Agregado** `src/components/PastillaEstado.tsx`: una sola forma de contorno para todo estado de fila. Es el `IndicadorEstado` que pedía el candidato CAND-1. Antes "Borrador" iba con borde punteado y relleno ámbar y "Obsoleto" con relleno neutro sólido, dos diseños para el mismo tipo de dato.
- **Agregado** `src/components/IndicadorAvance.tsx`: único indicador de "X de Y pasos", con variantes `anillo | barra | texto`. Registrado como candidato **CAND-7** para absorber `AvanceArticulo` y `ContadorSubProgreso` al rediseñar P2 y P4.
- **Agregado** `src/components/PastillaFrescura.tsx`: frescura del dato y cambios sin subir bajo el título de la lista (regla R7). Antes esta señal solo existía en Inicio.
- **Agregado** `src/components/HojaFiltro.tsx`: hoja inferior genérica para el segundo eje de filtro y para elegir categoría al crear (regla R4). Se apoya en `Modal`, que ya resuelve portal, Escape y bloqueo de scroll.
- **Agregado** `src/features/soluciones/FilaArticulo.tsx`: fila de artículo compartida. Ver [DECISIONES.md](DECISIONES.md) AD-020 sobre por qué esto no contradice la decisión de la tarea 145.
- **Agregado** `src/lib/tiempoRelativo.ts` (+ pruebas): antigüedad en lenguaje humano ("hace 4 min").
- **Agregado** `src/features/soluciones/sinTerminar.ts` (+ pruebas): los procedimientos que el técnico dejó a medias, para el bloque "Sin terminar".
- **Agregado** `src/features/soluciones/coincidencia.ts` (+ pruebas): además de si un artículo coincide, **por dónde** (título, etiqueta, categoría, tipo). Absorbe `partirTitulo`, que estaba dentro de `SolucionesPage.tsx`.
- **Agregado** `src/features/soluciones/sugerenciaBusqueda.ts` (+ pruebas): corrección ortográfica local ("Quizá quisiste decir *zebra*") con distancia de edición y tolerancia por longitud. **No** reutiliza el `fuzzy` del índice global porque ese índice excluye borradores y obsoletos, que esta pantalla sí lista.
- **Cambiado** `src/features/soluciones/SolucionesPage.tsx`: "Crear" siempre activo (sin categoría abre una hoja que pregunta cuál); el eje de tipo pasa de una segunda fila de chips a la hoja "Tipo de documento" y está disponible siempre, no solo dentro de una categoría; bloque "Sin terminar"; cinta de contexto al buscar con acción "Solo ahí" para acotar la búsqueda a la categoría en pausa; estados vacíos con acción; contadores y metadatos suben de `neutral-600` a `neutral-400`; el botón de borrar la búsqueda pasa de 26 a 44 px; degradado de recorte al final del carrusel de categorías.
- **Documentación:** [DECISIONES.md](DECISIONES.md) AD-019 (reglas R1 a R7), AD-020 (`FilaArticulo`) y AD-021 (escritorio se conserva); [COMPONENTES_UI.md](COMPONENTES_UI.md) secciones 2.10b a 2.10e, 3.8b y candidatos CAND-1/CAND-2/CAND-7; [BUSCADOR.md](BUSCADOR.md) secciones 10.1 a 10.3; [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md) sección 5.2.

**Sin cambios de estructura de datos:** no se agregaron ni modificaron tablas, columnas ni relaciones. `db.progresoPasos` (que alimenta "Sin terminar") ya existía y es local del dispositivo, así que no toca `supabase/schema.sql` ni requiere ningún paso en Supabase.

**Verificación:** typecheck, lint y build limpios; 96 pruebas en la sección Soluciones y los helpers nuevos (44 de ellas nuevas). **Sin verificar en navegador**: la app exige iniciar sesión y esta sesión no tiene una cuenta de técnico real (misma limitación registrada desde la tarea 144). Se confirmó que la app arranca sin errores de consola y que `/soluciones` redirige a login limpiamente.

## 2026-07-24

### Documentación (tarea 167, mejora integral)

- **Agregado** [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md): manual del comportamiento interno del sistema. Incluye catálogo numerado de reglas de negocio (RN-001 en adelante), modelo entidad-relación con cardinalidades, ciclos de vida y máquinas de estado por entidad, modelo de permisos con matriz, catálogo de eventos del sistema, dependencias entre entidades, arquitectura offline y de conflictos, auditoría, objetivos de rendimiento, accesibilidad, arquitectura de navegación, convenciones y roadmap.
- **Agregado** [COMPONENTES_UI.md](COMPONENTES_UI.md): catálogo de componentes reutilizables (propósito, props, variantes, ejemplo de uso y pantallas donde aparece cada uno).
- **Agregado** [BUSCADOR.md](BUSCADOR.md): fuente única del subsistema de búsqueda (qué se indexa, ranking, difuso, sinónimos, normalización, buscadores locales y rendimiento).
- **Agregado** [DECISIONES.md](DECISIONES.md): registro de decisiones de arquitectura (ADR) con su contexto, decisión y consecuencias.
- **Agregado** este `CHANGELOG.md` como historial canónico.
- **Cambiado** [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md): se enfocó en lo visible al usuario (pantallas, formularios, botones, flujos, navegación y componentes visibles); el contenido interno se trasladó a `ARQUITECTURA_FUNCIONAL.md` para eliminar la duplicación.
- **Cambiado** [REGLAS.md](REGLAS.md) regla 19c: el historial de cambios pasa a vivir en este `CHANGELOG.md` (antes dentro de `DOCUMENTACION_FUNCIONAL.md`).

### Corregido (documentación desalineada con el código)

Verificación código vs documentación (se priorizó el código). Correcciones aplicadas a `ARQUITECTURA.md`:

- La cabecera de Inicio no muestra "Sincronizado en tiempo real": la pastilla tiene 4 estados ("Al día", "Sin conexión", "Con error", "Sincronizando"). El texto de tiempo real vive en el panel de sincronización.
- `conexiones` ya no es la tabla que sincroniza de última (hoy lo es `personas`).
- `articulos.aplica_a` (aplicabilidad por marca/modelo, hallazgo H6) faltaba en el modelo de datos; se documentó, incluido su tratamiento de sincronización (viaja siempre, incluso `null`, no está en `camposOpcionales`).
- Las eliminaciones sensibles protegen 5 entidades (artículo, dispositivo, credencial, **diagnóstico** y **campo protegido**), no 3.
- `accesos_boveda.accion` tiene 7 valores (faltaba `'descargo'`).
- El componente `<Historial>` cubre 8 entidades (faltaban ubicación, campo protegido y persona).
- Se documentaron la entidad `personas`, y las columnas `dispositivos.responsable`/`responsable_id` y `dispositivos.reemplaza_a` en el modelo de datos.
- Se aclaró que `perfiles` y `boveda_meta` sincronizan con un mecanismo propio (fuera del motor genérico) y que `syncMeta` es una tabla local.
- Búsqueda: la miniatura de portada no se pinta hoy en los resultados; no existe `ResultadosBusqueda.tsx` ni chips de filtro por tipo; la Bóveda se indexa por título, categoría y nombre de archivo; el selector de "vincular procedimiento" no usa el índice de búsqueda.

### Registrado como pendiente (ver [TAREAS.md](TAREAS.md))

- Deuda técnica de seguridad: asimetría de la política de inserción del historial de secretos; control de propietario del bucket `adjuntos`.
- Deuda de duplicación de UI: candidatos CAND-1 a CAND-6 (componente de estado, "buscar o crear inline", desbloqueo inline de bóveda, fila de dispositivo en `CategoriaPage`).
- Búsqueda: miniatura de portada en resultados, unificar normalizaciones de acentos, tope de resultados.
