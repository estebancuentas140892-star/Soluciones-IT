# Rediseño funcional: Resolver

Encargo del usuario del **22 de septiembre de 2026**. Soluciones IT deja de ser una colección de módulos del mismo peso y pasa a ser una herramienta que acompaña al técnico hasta el puesto de trabajo, le deja encontrar el procedimiento que necesita y lo guía paso a paso hasta solucionar el problema:

**BUSCAR → ENCONTRAR → EJECUTAR → SOLUCIONAR**

Este documento es la **Fase 1** del encargo (analizar el estado actual y definir el mapa final de navegación) y el plan de las siete fases que siguen. Cuando una fase se cierra, lo visible pasa a [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md), las reglas a [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md), lo técnico a [ARQUITECTURA.md](ARQUITECTURA.md) y cada decisión de fondo a [DECISIONES.md](DECISIONES.md) (desde AD-042). Aquí queda el mapa del encargo y lo que se analizó para llegar a él.

---

## 1. Estado actual (revisado sobre el código el 2026-09-22)

### 1.1 Navegación

- **Teléfono:** tres pestañas, Inicio, Guías y Más (desde el 2026-09-17, AD-040). Equipos, Red y la Bóveda se abren desde Más y su cabecera lleva un regreso a Más.
- **Escritorio:** Inicio y Guías arriba; debajo, el grupo "Consulta" (Equipos, Red, Bóveda, Centro de consulta, Ubicaciones, Personas) y el grupo "Trabajo técnico" (Agenda, Diagnóstico, Escanear). Rail de iconos de 64 px entre 768 y 1279 px; barra lateral completa desde 1280.
- **Chasis único** (`src/app/Chasis.tsx`) con tres niveles: `seccion` (raíz de una pila), `documento` (se lee o se recorre) y `tarea` (se hace y se sale, sin pestañas). La jerarquía "Up" vive en un solo sitio, `padreDe` (`src/lib/navegacion.ts`); el último salto real viaja en `location.state` (M-R2) y manda sobre el padre declarado.
- **44 rutas** bajo `RequireAuth` y `BloqueoAppGuard`; `/login` es la única fuera. Todas las pantallas se cargan con `React.lazy`.

### 1.2 Inicio

Buscador global arriba ("¿Qué necesitas solucionar?") y, debajo, la **agenda operativa completa**: fecha del día, resumen, Vencidos, Para hoy, Próximos (tres), En curso (borradores y la guía a medias) y Por revisar del equipo, con "Ver agenda completa" al final (tarea 247). Bienvenida del primer día debajo.

### 1.3 Guías

- **Abrir es ejecutar** (AD-040): la dirección de la guía abre la ejecución en el primer paso pendiente; la ficha vive en `/detalles`.
- **Modo foco** (`ModoFoco.tsx`): una acción por pantalla, con "Paso N de M", la instrucción a 26 px, los avisos según su tono (precaución e importante como alerta, dato técnico a la vista, información y consejo plegados), imágenes, comandos con copiar, dato protegido, archivos y guías vinculadas. Abajo, Anterior / Siguiente y "Tengo un problema".
- **Requisitos** solo en el paso 1 de una ejecución sin avance; el editor señala el requisito que en realidad es una acción (AD-041).
- **Bóveda dentro del paso** (`CredencialEnPaso.tsx`): fila plegada; al abrirla exige permiso `puedeVerBoveda`, contraseña maestra y respeta el autobloqueo; cada consulta se registra en `accesos_boveda`.
- **Consulta sin abandonar** (AD-039): la lupa de la cabecera abre el buscador en modo consulta como capa; la ejecución no se desmonta (paso, avance y contexto intactos).
- **Modelo del paso** (`PasoProcedimiento`, `src/lib/db.ts`): título, objetivo, bloques (tarea de acción, verificación o decisión; aviso por tono; imagen; archivo; guía vinculada; referencia), adjuntos, vínculo protegido, subprocedimiento y contingencia. **No existe ningún dato para "dónde se hace" ni para "qué debe verse después".**

### 1.4 Equipos y escáner

- La lista excluye las categorías de red (esas van a Red), muestra un resumen de estados y un menú "···" con Ubicaciones, Personas, Etiquetas e Importar. El escáner es un icono pequeño junto a "Crear".
- El escáner (`EscanerPage.tsx`) es una pantalla de tarea. Al leer un código muestra la tarjeta "Equipo identificado" y hay que tocar "Abrir la ficha" (se diseñó para inventariar varios equipos seguidos).
- La ficha del equipo (`DispositivoPage.tsx`) tiene cuatro capas: **Ahora** (nombre, estado, IP copiable, ubicación), **Contexto** (todos los datos técnicos, abierta), **Acción** (diagnóstico, procedimientos, problemas, credenciales) y **Profundidad** (impacto, conexiones, datos protegidos, adjuntos, intervenciones, plegadas).

### 1.5 Más

Grupos "Consulta", "Trabajo técnico" y "Mejor desde el ordenador", más "Mis favoritos" y "Actividad del equipo" plegados, y "Mi cuenta" con Bloqueo y seguridad y Buscar actualización. Es la única puerta en el teléfono a Red, Ubicaciones, Personas, Diagnóstico, Etiquetas e Importar.

### 1.6 Datos, Supabase y seguridad

- Copia local en Dexie (IndexedDB) con cola de subida; Supabase con RLS **`to authenticated` en todas las tablas**: el rol anónimo no puede leer ni escribir nada.
- Bóveda: permiso `puede_ver_boveda` por RLS, cifrado AES-256-GCM en el cliente (formato `v1.<iteraciones>.<sal>.<iv>.<cifrado>`), verificador de la contraseña maestra en `boveda_meta` y auditoría inmutable en `accesos_boveda`.
- **No se usa Supabase Realtime.** La sincronización es por consulta periódica y por eventos de red.

### 1.7 PWA y rendimiento

- `registerType: 'prompt'`, `version.json` fuera del precache (tarea 251). El service worker sirve todas las navegaciones desde su `index.html` precacheado.
- **El precache lleva todo**: 141 archivos, unos 1,5 MB sin comprimir. Lo más pesado: `xlsx` (493 KB, solo Importar), `react-vendor` (231 KB), `supabase` (204 KB), el trozo de markdown (158 KB), `jsQR` (130 KB, lector de respaldo del escáner donde no hay `BarcodeDetector`) y el editor de guías (106 KB).

### 1.8 Lo que ya cumple el encargo y se conserva

| Punto del encargo | Dónde ya existe | Qué falta |
|---|---|---|
| 6. Una acción clara por paso | Modo foco (AD-033, AD-040) | "Dónde" y "Debes ver" (no hay dato) |
| 7. No duplicar "Antes de empezar" | Paso 1 sin avance + revisión del editor (AD-041) | Llamarlo "Requisitos" |
| 8. Bóveda dentro del paso | `CredencialEnPaso` | Presentarlo como "Credencial necesaria" |
| 19. Consulta sin abandonar | Modo consulta (AD-039) | Nada estructural |

Se ajustan; no se rehacen.

---

## 2. Mapa final de navegación

### 2.1 Cuatro destinos, en todos los tamaños

| Destino | Raíz | Responde | Se ilumina en |
|---|---|---|---|
| **Resolver** | `/` | ¿Qué necesitas resolver? | `/`, `/agenda`, `/soluciones/**` (lista, categoría, guía, detalles, editor), `/conectar` |
| **Equipos** | `/dispositivos` | ¿Qué sabemos de este dispositivo? | `/dispositivos/**`, `/escaner` |
| **Bóveda** | `/boveda` | ¿Cuál es la clave? | `/boveda/**` |
| **Más** | `/mas` | Todo lo demás | `/referencia/**`, `/red/**`, `/ubicaciones/**`, `/personas/**`, `/diagnostico/**`, `/cuenta/**` |

- **Teléfono (< 768 px):** barra inferior de cuatro pestañas, siempre las mismas para todos (regla R17). El número de asuntos urgentes va sobre Resolver, que es donde asoman.
- **Tableta (768 a 1279 px):** rail de 64 px con los mismos cuatro iconos.
- **Escritorio (≥ 1280 px):** barra lateral con los cuatro destinos y la cuenta al pie. **Sin grupos secundarios:** Más es una sola puerta en todos los tamaños, y en pantallas anchas su contenido se reparte en columnas. Los grupos "Consulta" y "Trabajo técnico" de la barra lateral desaparecen: eran la segunda copia de Más.
- **Bóveda sin permiso:** la pestaña se mantiene (R17: la barra no cambia según el permiso) y abre la pantalla "Acceso restringido" que ya existe.
- **Guías deja de ser pestaña.** El catálogo sigue en `/soluciones` y se abre desde Resolver ("Todas las guías" y los accesos rápidos por categoría).

### 2.2 Ninguna dirección cambia

Se conservan **todas** las rutas: enlaces guardados, etiquetas QR impresas (`/dispositivos/:id`), `/soluciones/:cat/:art/ejecutar` y `/notas`. Solo cambian las etiquetas, los padres y la pestaña que se ilumina. Rutas nuevas:

- `/conectar` (autenticada): emparejar el teléfono con un computador atendido.
- `/asistencia` (pública, fuera de la app): el portal del computador atendido (sección 7).

### 2.3 Padres ("Up") que cambian

| Ruta | Antes | Después |
|---|---|---|
| `/soluciones` | raíz de pestaña | Resolver |
| `/agenda` | Inicio | Resolver |
| `/escaner` | Inicio | Equipos |
| `/diagnostico` | Inicio | Más |
| `/cuenta` | Inicio | Más |
| `/red`, `/referencia`, `/ubicaciones`, `/personas` | Más (o raíz, `/red`) | Más |

`/red` deja de ser raíz de pestaña: pasa a colgar de Más → Infraestructura.

### 2.4 Atajos de teclado

`G R` Resolver, `G E` Equipos, `G B` Bóveda (con permiso), `G M` Más y `G G` la lista de guías. Red pierde su atajo propio: vive en Más.

---

## 3. Resolver

Sustituye a Inicio y a la pestaña Guías. **No es un tablero**: no lleva estadísticas, actividad, favoritos ni tarjetas decorativas. De arriba abajo:

1. **La pregunta y el buscador:** "¿Qué necesitas resolver?" y el campo "Buscar problema, equipo, comando…". Es el mismo buscador global (guías, equipos, comandos, glosario, Bóveda con su puente de desbloqueo), con el foco puesto al abrir en escritorio.
2. **Atención**, solo si hay algo con fecha que atender: vencidos, de hoy y próximos a vencer (máximo tres, el orden de la agenda) y "Ver agenda completa". Los borradores propios y las sugerencias del equipo **no** salen aquí: viven en la agenda completa (`/agenda`, en Más → Consulta).
3. **Continuar**, solo si hay una guía a medias: su nombre y el paso donde se quedó.
4. **Recientes**, solo si ayudan: hasta tres guías usadas en los últimos 14 días, sin repetir la de "Continuar".
5. **Accesos rápidos**, solo si aportan: las categorías con al menos una guía publicada y ejecutable, las más usadas primero (y luego por su orden), hasta seis. Si hay menos de dos categorías con guías, el bloque no se dibuja (una sola sería lo mismo que "Todas las guías"). Al final, "Todas las guías".
6. La bienvenida del primer día sigue como estaba (solo mientras no hay trabajo real).

Mientras se escribe, todo lo anterior deja paso a los resultados.

---

## 4. Guías: ruta visual y lenguaje de color

### 4.1 Los colores significan, no decoran

Dentro de una guía cada color tiene **un solo** significado, y ninguno va sin icono y palabra (R16: el significado nunca depende solo del color).

| Color | Significado | Icono + texto |
|---|---|---|
| **Verde** | Inicio, acción completada, resultado correcto | Marca de hecho, "Debes ver" |
| **Amarillo** | Lugar, menú, sección o elemento que hay que localizar | Chincheta, "Dónde" |
| **Azul** | La acción: entrar, abrir o seleccionar un destino | Puntero, el paso en curso |
| **Rojo** | Riesgo real, detenerse, requiere especial atención | Octágono, "Cuidado" / "Importante" |
| (sin color) | Verificación | Sello, "Comprueba" |

Consecuencias dentro de la ejecución:

- **Precaución deja de ser ámbar.** Precaución e Importante son los dos riesgos reales, así que los dos pasan al rojo (Precaución con borde, Importante con fondo). El amarillo queda libre para "Dónde". Fuera de las guías (vencimientos, estados de equipo) el ámbar no cambia.
- **"No" de una decisión y "Borrador" dejan el ámbar:** no son un riesgo. Van neutros con su icono y su palabra.
- El acento lavanda sigue siendo el color de los controles de la app (Siguiente, enlaces); el azul es el del **contenido** que dice qué hacer.

### 4.2 La ruta del procedimiento

Una ruta compacta orienta sin enseñar el detalle: un nodo por paso, con el nombre corto del paso (el título sin el verbo de navegación: "Abrir SGC" → "SGC"; si el título no empieza por uno de esos verbos, se deja entero).

- Hecho: verde con marca. En curso: azul y en negrita, con "3/7". Pendiente: neutro. Paso con un riesgo real: marca roja pequeña en el nodo, para saber de antemano dónde hay que ir con cuidado.
- **Escritorio y tableta:** horizontal, con flechas, partiendo línea si hace falta. La ejecución gana ancho para esto (hoy es una columna de 448 px en todos los tamaños).
- **Teléfono:** vertical y recortada al paso anterior, el actual y el siguiente, con "Ver la ruta completa". La ruta entera vertical ya vive en el índice de pasos.
- Tocar un nodo mueve la vista (igual que el índice), nunca marca nada.

Debajo de la ruta manda **el paso actual**.

### 4.3 El paso: qué hacer, dónde y qué debo ver

```
PASO 3 DE 7
Abrir Ejecutar                         (título del paso)
[Dónde] Escritorio de Windows          (amarillo, si el paso lo declara)
Presiona:  Windows + R  [Copiar]       (azul: la acción; el comando a la vista)
[Debes ver] La ventana Ejecutar        (verde, si el paso lo declara)
[Anterior]                [Siguiente]
```

- "Dónde" acompaña a la **primera** acción del paso; "Debes ver", a la **última** (es lo que tiene que verse después de hacerla).
- Las alertas siguen yendo antes de la instrucción y solo en la acción donde aplican (regla 20c). Lo que explica sigue plegado en "Más información".
- **Requisitos** (antes "Antes de empezar, ten a mano"): solo en el paso 1 y solo si la guía los declara.

### 4.4 El dato que falta: "Dónde" y "Debes ver"

Se agregan **dos campos opcionales por paso** dentro del JSON del procedimiento: `lugar` y `resultado`. El editor los ofrece bajo el título del paso ("Dónde se hace" y "Qué debe verse al terminar").

- **Sin SQL y sin versión nueva de Dexie:** `procedimiento` ya es `jsonb` en Supabase y un objeto en IndexedDB; el normalizador los lee con valor vacío por defecto. Las guías existentes no cambian hasta que alguien los rellena.
- **Por qué no se reutiliza `objetivo`:** dice para qué sirve el paso ("Dejar la impresora compartida"), no lo que se ve después. Pintarlo como "Debes ver" convertiría objetivos correctos en frases sin sentido. Sigue plegado como "Para qué".
- **Riesgo de compatibilidad:** una copia vieja de la app (sin actualizar) que edite y guarde una guía descarta esos dos campos, porque su normalizador solo conoce los de antes. Se cubre con el aviso de actualización (tarea 251) y se dice al entregar: actualizar los teléfonos antes de rellenarlos.

### 4.5 Credencial necesaria

`CredencialEnPaso` se presenta como un bloque "Credencial necesaria" con el nombre del acceso. Los controles no cambian: permiso, contraseña maestra, autobloqueo y registro de cada consulta. Con la Bóveda abierta, usuario con Copiar y contraseña oculta con Mostrar y Copiar; la guía sigue debajo.

---

## 5. Equipos y QR

- La cabecera de Equipos prioriza **Buscar equipo** y **Escanear QR** (con el mismo peso visual). "Crear" baja a secundario; Ubicaciones, Personas, Etiquetas e Importar salen del menú "···" hacia Más. El resumen de estados se retira del primer plano (cada fila ya lleva su estado).
- **QR = otra forma de buscar.** Si el código identifica un solo equipo, el escáner **abre la ficha directamente** (el regreso de la ficha vuelve al escáner con la cámara viva, así que inventariar varios sigue siendo un toque por equipo). Con varios equipos o ninguno, las tarjetas actuales. El escáner reconoce también el QR del portal de asistencia y lleva a emparejar.
- **Buscar incluye los equipos de red.** La lista sin texto sigue siendo la del inventario general; al escribir, también aparecen switches, cámaras y puntos de red con su categoría, porque "¿qué sabemos de SW-CENTRAL-02?" es una pregunta de Equipos aunque su topología viva en Infraestructura.
- **La ficha** reparte así: arriba nombre, tipo, ubicación, IP con Copiar, responsable y, si lo hay, "Conectado a: SW-CENTRAL-02 · Puerto 18 · Ver conexión". Después **Problemas frecuentes** y **Procedimientos**. Los datos técnicos completos pasan a plegados ("Más datos del equipo"), junto a la Profundidad que ya existe.

---

## 6. Más e Infraestructura

| Grupo | Destinos |
|---|---|
| **Consulta** | Centro de consulta · Agenda · Mis favoritos (solo si hay) |
| **Infraestructura** | Red · Topología · Ubicaciones · Personas |
| **Herramientas** | Diagnóstico · Importar equipos · Etiquetas QR |
| **Configuración** | Mi cuenta · Bloqueo y seguridad · Buscar actualización |

- "Actividad del equipo" pasa al final de la Agenda (plegada): es lo que pasa en el equipo, no un destino.
- "Mejor desde el ordenador" deja de ser un grupo: Importar y Etiquetas conservan la nota en su fila.
- Red, Topología, conexiones, switches, puertos y dependencias **no se tocan**: cambian de puerta, no de comportamiento. En la ficha de un equipo solo asoma el contexto útil ("Conectado a").
- Infraestructura queda desacoplada de la experiencia principal (sus pantallas no entran en el arranque ni en la barra), sin duplicar autenticación, equipos, Supabase, ubicaciones ni permisos: si un día se separa, se separa por sus rutas.

---

## 7. Portal público de asistencia temporal (`/asistencia`)

### 7.1 Qué es y qué no es

Una página pública, fuera de la autenticación, cuya **única** función es que el computador atendido se conecte a una sesión que inicia un técnico autenticado desde su teléfono y muestre lo que ese técnico le envía. No da acceso a guías, buscador, equipos, Bóveda, usuarios, red, topología, agenda ni a nada interno. No pide iniciar sesión.

### 7.2 Flujo

1. En el computador: `soluciones-it-psi.vercel.app/asistencia` genera un **código de 6 cifras** ("482 731"), su **QR** y "Esperando al técnico…". El código vence a los 10 minutos.
2. En el teléfono, dentro de Soluciones IT: **Conectar equipo** → Escanear QR o Introducir código. El QR lleva a `/conectar?codigo=…`, que pide confirmar antes de conectar.
3. Conectados, en cada paso de una guía: **Enviar a este equipo** abre una vista previa ("Así se verá en el equipo") y, al confirmar, el computador muestra el paso: la acción, los comandos con Copiar, las URL, los nombres de archivo, lo que debe verse y las comprobaciones.
4. **Desconectar equipo** (o 15 minutos sin enviar nada) cierra la sesión: el computador muestra "Sesión finalizada. Para recibir asistencia genera un nuevo código."

### 7.3 Arquitectura del portal

- **Una entrada propia del build** (`asistencia.html` y su propio `main`), no la app con una ruta más: no carga Dexie, ni la sincronización, ni el cliente completo de Supabase, ni registra el service worker. En el computador de otra persona no queda instalada la app ni su precache.
- Habla con Supabase por `fetch` a funciones RPC con la clave anónima. Sus archivos **no** entran en el precache de la app del técnico, y el service worker deja pasar `/asistencia` a la red (`navigateFallbackDenylist`).
- Cabeceras propias: `no-store`, sin incrustarse en marcos ajenos (`frame-ancestors 'none'`) y sin enviar `Referer`.

### 7.4 Supabase: estructura independiente

Tres tablas nuevas, sin relación con las existentes salvo `auth.users`:

- `asistencia_sesiones`: estado (`esperando`, `conectada`, `cerrada`, `expirada`), código, **hash** del secreto del portal, técnico, fechas, última actividad y motivo de cierre.
- `asistencia_mensajes`: el contenido ya validado de lo enviado. Se borra al cerrar la sesión.
- `asistencia_eventos`: auditoría mínima (creada, conectada, código incorrecto, bloqueo por intentos, mensaje, cerrada, expirada), **sin contenido ni secretos**.

**RLS activada y ninguna política:** nadie lee ni escribe esas tablas directamente, ni el rol anónimo ni el autenticado. Todo pasa por funciones `security definer` con `search_path` fijo y permisos de ejecución explícitos:

| Función | Rol | Hace |
|---|---|---|
| `asistencia_crear()` | anónimo | Crea la sesión; devuelve id, secreto (una sola vez), código y vencimiento |
| `asistencia_estado(id, secreto, desde)` | anónimo | Estado y mensajes nuevos de ESA sesión, solo con su secreto |
| `asistencia_cerrar_portal(id, secreto)` | anónimo | El computador termina la sesión |
| `asistencia_conectar(codigo)` | autenticado | Empareja con límite de intentos |
| `asistencia_enviar(id, contenido)` | autenticado (dueño) | Valida y guarda lo que se muestra |
| `asistencia_estado_tecnico(id)` | autenticado (dueño) | Estado para el indicador del teléfono |
| `asistencia_desconectar(id)` | autenticado (dueño) | Revoca la sesión |

**No se toca** ninguna tabla, política ni función existente, ni la Bóveda, ni los permisos globales.

### 7.5 ¿Supabase Realtime? Análisis y decisión

- **`postgres_changes`:** entrega filas según la RLS de quien se suscribe. El rol anónimo no tiene identidad, así que no hay forma de limitarlo a SU sesión sin abrir la tabla a todo anónimo (el filtro de la suscripción lo pone el cliente, no es una barrera). **Descartado.**
- **Broadcast directo:** el mensaje va de cliente a cliente sin pasar por el servidor, así que la validación del servidor (punto 12 del encargo) no existiría. **Descartado para el contenido.**
- **Broadcast desde la base (`realtime.send`) con canales privados:** mantendría la validación en el servidor, pero exige activar la autorización de Realtime del proyecto y políticas en el esquema `realtime` (configuración global), y depende de WebSockets que algunas redes corporativas cortan. La ganancia (menos de un segundo frente a uno o dos) no hace falta para enseñar un paso.
- **Decisión: RPC `security definer` con consulta corta y adaptativa** (cada 1,5 s mientras hay conexión y la pestaña está a la vista; más espaciada si no). Sin tablas abiertas, sin configuración global, validación entera en el servidor y funciona detrás de cualquier proxy. Si en el futuro hiciera falta inmediatez, se puede sumar un "timbre" sin contenido por Broadcast sin cambiar el modelo.

### 7.6 Seguridad del emparejamiento (punto 13)

| Exigencia | Cómo |
|---|---|
| Código difícil de adivinar | 6 cifras aleatorias (`gen_random_bytes`) únicas entre las sesiones en espera; **solo un técnico autenticado puede canjearlo**, así que desde internet no hay nada que probar. El portal se identifica con un secreto de 256 bits que nunca se guarda en claro |
| Expiración corta | El código vence a los 10 minutos |
| Límite de intentos | 5 códigos incorrectos por técnico en 10 minutos, y un tope global |
| Un único técnico / una única sesión pública | El canje fija el técnico una sola vez; conectar otra sesión cierra la anterior de ese técnico |
| Revocable | "Desconectar equipo" en el teléfono y "Terminar" en el portal |
| Cierre por inactividad | 15 minutos sin enviar nada; y un máximo absoluto de 4 horas |
| No reutilizable | Cerrada o expirada no vuelve a ningún otro estado; el código queda libre |
| Auditoría mínima | `asistencia_eventos`, sin contenido |

### 7.7 Lo que nunca puede viajar al portal (punto 12)

Tres barreras, y ninguna es CSS:

1. **Construcción:** lo enviable se arma solo con campos permitidos del paso (título, acción, dónde, debes ver, comprobaciones, comandos y atajos del Centro de consulta, URL que aparecen en el texto y nombres de archivo). El constructor **no recibe** la Bóveda, los campos protegidos ni nada descifrado: por tipos, no puede.
2. **Vista previa:** el técnico ve exactamente lo que se enviará antes de enviarlo.
3. **Servidor:** `asistencia_enviar` acepta solo la estructura permitida (claves, tipos, largos, tamaño total) y **rechaza** cualquier texto con forma de secreto ("contraseña:", "password=", "token", "api key", "clave:", "pin:"…) o con la forma de un bloque cifrado de la app (`v1.<n>.<…>`).

### 7.8 Sin internet

El portal es una ayuda, no una dependencia. La guía sigue entera en el teléfono sin conexión; "Enviar a este equipo" dice "Sin conexión: la guía sigue aquí" y no bloquea nada.

---

## 8. Rendimiento y precache

- Salen del precache (y pasan a caché en tiempo de ejecución, así que funcionan sin conexión desde su primer uso): **Importar** con `xlsx` (casi un tercio del precache), **Etiquetas** y el **portal de asistencia**.
- Se quedan: Resolver, guías (ejecución, lectura y editor, que tiene borrador local para escribir en campo), Equipos con el escáner y `jsQR` (en iPhone es el único lector), Bóveda, Centro de consulta y Red/Topología (pesan poco y se consultan en campo).
- Se revisa qué carga el arranque (`index` y `Chasis`) para que Resolver, Equipos y Bóveda no arrastren Infraestructura.

---

## 9. Fases, tareas y verificación

| Fase | Tarea | Qué |
|---|---|---|
| 1 | 253 | Este análisis y el mapa (sin código) |
| 2 | 254 | Resolver y navegación de cuatro destinos |
| 3 | 255 | Ejecución visual de las guías |
| 4 | 256 | Equipos + QR |
| 5 | 257 | Más e Infraestructura |
| 6 | 258 | Portal `/asistencia` y emparejamiento |
| 7 | 259 | Precache, trozos y rendimiento |
| 8 | 260 | Pruebas completas (390×844, 768×1024, 1366×768, 1920×1080 y los estados del punto 26) |

Al cerrar cada fase: pruebas, lint, tipos y build en verde; comprobación de regresiones; documentación en el documento que corresponda; commits pequeños; push y comprobación del despliegue en `/version.json` (reglas 11 y 14).

---

## 10. Decisiones tomadas sin preguntar, y cómo revertirlas

Ninguna borra datos ni rutas; todas se deshacen tocando la navegación o la presentación.

1. **Bóveda es pestaña para todos** (R17), también sin permiso: abre "Acceso restringido". Revertir: filtrar la pestaña por permiso.
2. **Guías deja de ser pestaña**; su catálogo se abre desde Resolver. Revertir: volver a declararla en los destinos del chasis.
3. **Precaución pasa de ámbar a rojo dentro de las guías**, para dejar el amarillo a "Dónde". Revertir: un token en `tonos.ts`.
4. **"Dónde" y "Debes ver" son dos campos nuevos opcionales por paso** (no se reutiliza `objetivo`).
5. **El escáner abre la ficha directamente** con un solo resultado.
6. **Buscar en Equipos incluye los equipos de red.**
7. **Favoritos y Actividad del equipo salen del primer plano de Más** (favoritos como fila solo si hay; actividad al final de la Agenda).
8. **Tiempos del portal:** código de 10 minutos, 15 de inactividad, 4 horas de máximo, 5 intentos por técnico cada 10 minutos. Son constantes de la migración.

**Lo que depende del usuario:** ejecutar la migración de la Fase 6 en el SQL Editor de Supabase (`supabase/schema.sql`, idempotente). Hasta entonces el portal dice que la asistencia no está disponible y la app sigue funcionando igual.
