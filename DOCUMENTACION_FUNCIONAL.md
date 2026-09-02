# Documentación funcional de Soluciones IT

Inventario completo y estructurado de todo lo que existe dentro de la aplicación: cada pantalla, menú, formulario, modal, pestaña, botón, campo, acción, relación y flujo. El objetivo es que cualquier desarrollador entienda la estructura completa leyendo únicamente este documento.

> Este documento describe el "qué" y el "cómo se usa" (funcional). El "por qué" técnico y las decisiones de arquitectura viven en [ARQUITECTURA.md](ARQUITECTURA.md); el trabajo pendiente en [TAREAS.md](TAREAS.md).

Fecha de redacción: 2026-07-23. Basado en una lectura directa del código en `src/`.

---

## Índice

1. [Visión general](#1-vision-general)
2. [Cómo está construida la app (stack, shells, temas, navegación)](#2-como-esta-construida)
3. [Mapa completo de rutas](#3-mapa-completo-de-rutas)
4. [Modelo de datos (tablas)](#4-modelo-de-datos)
5. [Secciones del menú principal](#5-secciones-del-menu-principal)
   - 5.1 [Inicio](#51-inicio)
   - 5.2 [Guías](#52-guias)
   - 5.3 [Equipos](#53-equipos)
   - 5.4 [Red](#54-red)
   - 5.5 [Bóveda](#55-boveda)
   - 5.6 [Más](#56-mas)
6. [Secciones secundarias](#6-secciones-secundarias)
   - 6.1 [Diagnóstico Inteligente](#61-diagnostico-inteligente)
   - 6.2 [Escáner](#62-escaner)
   - 6.3 [Ubicaciones](#63-ubicaciones)
   - 6.4 [Personas](#64-personas)
   - 6.5 [Ficha de categoría](#65-ficha-de-categoria)
   - 6.6 [Mi cuenta y Seguridad de la aplicación](#66-mi-cuenta-y-seguridad)
   - 6.7 [Etiquetas QR e Importación](#67-etiquetas-e-importacion)
   - 6.8 [Estadísticas y Sugerencias del equipo](#68-estadisticas-y-sugerencias)
   - 6.9 [Autenticación (login) y actualización](#69-autenticacion)
7. [Catálogo de formularios (campo por campo)](#7-catalogo-de-formularios)
8. [Catálogo de modales, hojas y diálogos](#8-catalogo-de-modales)
9. [Catálogo de botones y primitivas de interfaz](#9-catalogo-de-botones)
10. [Menús](#10-menus)
11. [Acciones transversales](#11-acciones-transversales)
12. [Relaciones entre secciones](#12-relaciones-entre-secciones)
13. [Flujos funcionales completos](#13-flujos-completos)
14. [Árbol jerárquico de navegación](#14-arbol-de-navegacion)
15. [Verificación final (auditoría de cobertura)](#15-verificacion-final)
16. [Hallazgos y oportunidades de mejora](#16-hallazgos)
17. [Historial de cambios](#17-historial-de-cambios)

---

<a id="1-vision-general"></a>
## 1. Visión general

Soluciones IT es una aplicación web progresiva (PWA) para un equipo de 5 técnicos de soporte y mantenimiento de TI. Sustituye a Miro como fuente de conocimiento del equipo. Funciona **offline primero**: toda la información vive en el teléfono (IndexedDB) y se consulta al instante sin internet; cuando hay conexión, sincroniza con Supabase para que los técnicos compartan siempre lo mismo.

Cuatro pilares, más un motor de diagnóstico:

- **Base de conocimiento** por categorías (sección Guías): procedimientos, manuales e incidencias.
- **Inventario de equipos** (sección Equipos): equipos que no son de red.
- **Infraestructura de red** (sección Red): equipos de red y topología de conexiones.
- **Bóveda de credenciales** cifradas (sección Bóveda): usuarios, contraseñas, llaves, archivos.
- **Diagnóstico Inteligente**: del problema a la solución mediante un árbol de preguntas.

La app es de **tema oscuro únicamente** (sistema de diseño "Nocturne": fondo `#161826`, un solo color de acento `#9184d9` siempre delineado, tipografía Inter). No hay modo claro ni conmutador de tema.

---

<a id="2-como-esta-construida"></a>
## 2. Cómo está construida la app

### 2.1 Stack

| Capa | Tecnología |
|------|------------|
| Interfaz | React + TypeScript + Vite |
| Estilos | Tailwind CSS v4 (tokens `noct-*`) |
| Navegación | React Router (`BrowserRouter`) |
| Datos locales | Dexie (IndexedDB) |
| Búsqueda | MiniSearch (índice en memoria) |
| Offline | vite-plugin-pwa (service worker, `registerType: 'prompt'`) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Cifrado bóveda | WebCrypto (AES-256-GCM + PBKDF2) |
| Hosting | Vercel (https://soluciones-it-psi.vercel.app) |

### 2.2 Estructura de la interfaz: shells

La app monta rutas dentro de dos envoltorios de autorización y luego cada pantalla usa uno de tres tipos de "shell" (contenedor visual):

1. **`RequireAuth`** (`src/features/autenticacion/RequireAuth.tsx`): sin sesión activa redirige a `/login`.
2. **`BloqueoAppGuard`** (`src/features/seguridad/BloqueoAppGuard.tsx`): envuelve TODA la zona autenticada. Si el dispositivo tiene activado el bloqueo local (patrón o contraseña), pide desbloquear antes de mostrar cualquier pantalla.

**Un solo chasis con tres niveles (`src/app/Chasis.tsx`, desde la tarea 185).** Toda pantalla autenticada monta el mismo chasis y declara cuál de los tres niveles es (regla **R18**). Hasta la tarea 185 convivían dos: trece pantallas con navegación y veinticinco con un contenedor propio sin ella, así que el chasis se encendía y se apagaba al moverse por la app.

| Nivel | Qué pantallas | Qué se ve arriba | ¿Barra de pestañas? |
|---|---|---|---|
| **Sección** | Inicio, Guías, Equipos, Red, Más, Bóveda | título de la sección, estado del dato, buscar y cuenta | sí |
| **Documento** | fichas y listas internas: categoría, artículo, equipo, secreto, topología, Ubicaciones, Personas, Diagnóstico, Estadísticas, Sugerencias, Mi cuenta, Seguridad | en las **cinco fichas** (equipo, artículo, credencial, ubicación, persona), el **ancla permanente** de la tarea 201: chevron de 44 px, el origen a 11 px y el nombre de lo que se ve a 14 px, que no se va con el scroll (regla **M-R1**). En las listas internas, el regreso con el nombre de a dónde vuelve. A la derecha, las acciones de la pantalla | sí |
| **Tarea** | lo que se hace y de lo que se sale: los cuatro editores, el asistente, el diagnóstico en ejecución, el escáner, las etiquetas, la importación y las tres migraciones | `BarraTarea`: rótulo ("Editando"), sobre qué, la ruta de vuelta escrita y una X | **no** |

**Cuatro anchos, cuatro composiciones (desde la tarea 191, regla R30).** Cada punto de quiebre entrega una pantalla completa, y los define el chasis: ninguna pantalla los repite.

| Ventana | Qué se ve |
|---|---|
| Menos de 768px | Teléfono: columna de 448px y las 5 pestañas inferiores. |
| 768 a 1279px | Tableta: barra lateral estrecha de **solo iconos** (64px) y una columna de trabajo. Sin pestañas inferiores. |
| 1280 a 1679px | Portátil: barra lateral completa de 240px con la marca "Soluciones IT", sus catorce destinos y el perfil al pie. |
| 1680px o más | Monitor: barra lateral de 232px y hasta 1294px de contenido, el espacio de las tres zonas (lista, documento y contexto). |

Antes la barra lateral no aparecía hasta 1024px, así que entre 768 y 1023 no había ni barra lateral ni pestañas al ancho: el contenido medía 768px y la barra de pestañas seguía anclada a 448px centrados, flotando debajo. Afectaba a un iPad en horizontal y a cualquier ventana a media pantalla. Las 5 pestañas de móvil son **siempre las mismas para todos** desde la tarea 182 (regla R17), y **el chasis reserva el espacio que la barra ocupa** (regla R22), así que ninguna pantalla lo calcula a mano. El nivel Tarea va sin barra y sin barra lateral, en columna de 448px.

**El procedimiento a medias, en escritorio, vive al pie de la barra lateral** (tarea 191), encima de la cuenta, en vez de flotar sobre el contenido. En la barra estrecha queda solo el anillo de avance, con su botón de descarte debajo.

**Barra superior global (`BarraSuperior`, desde la tarea 181).** Es la cabecera del nivel Sección: tres ranuras fijas y siempre en el mismo orden (regla R14): **título de la sección**, **estado del dato** (pastilla de sincronización) y **buscar + cuenta**. Las acciones propias de cada pantalla ("Crear", "Escanear", el menú "···", el subtítulo) van en la banda que queda justo debajo, dentro del mismo bloque pegajoso ([DECISIONES.md](DECISIONES.md) AD-023). La lupa abre el **buscador global en capa** desde cualquiera de las cinco, sin abandonar la pantalla; el avatar (iniciales del técnico) lleva a Mi cuenta y solo aparece en móvil, porque en escritorio la cuenta vive al pie del sidebar. La miga de pan del nivel Documento llega con la tarea 188.

**La barra de tarea (`BarraTarea`).** Quitar la barra de pestañas obliga a poner algo que oriente (regla **R19**): fondo de superficie para que se note que el chasis cambió, el rótulo de lo que se está haciendo, sobre qué, la promesa escrita de a dónde se vuelve ("Guías › Impresoras · vuelves aquí al terminar") y una X de salida siempre en el mismo sitio. Antes, pasar de la ficha al editor apagaba la navegación y ponía otra barra fija abajo, sin decir nada.

**BarraReanudar (desde la tarea 186).** Mientras haya un procedimiento a medias, una barra flotante viaja por los niveles Sección y Documento (no en Tarea, que ya tiene su propia `BarraTarea`) con el título del artículo, el paso actual, los minutos que quedan y "Seguir", directo al asistente. Caso real: estar en el paso 3 de un mantenimiento y salir a la Bóveda a buscar una clave, sin perder el hilo de vuelta. Se descarta deslizándola o con su botón "X" (regla **R23**: un aviso solo si hay un dato detrás); mientras siga descartada para ese mismo artículo, la pestaña Guías (solo móvil) muestra un punto de aviso. Si aparece un procedimiento más reciente para retomar, la barra vuelve a mostrarse sola.

**Lo que el chasis hace al moverse (desde la tarea 187).** Cuatro comportamientos que antes no existían:

- **El nombre de la sección se contrae, no se va.** Al empezar a desplazarse, el título pasa de 21 a 14 px y se queda en pantalla: la orientación no depende solo de la pestaña iluminada.
- **Volver es volver al mismo sitio (regla R20).** Al regresar a una pestaña se restauran la posición del scroll y el filtro que estaba puesto. Antes, cambiar de pestaña y volver reiniciaba el scroll y borraba el filtro de categoría. Como consecuencia, en Guías el filtro de categoría, tipo y etiqueta viaja en la dirección de la pantalla, así que también se puede compartir por enlace.
- **El movimiento indica jerarquía (regla R21).** Entrar en algo se desliza desde la derecha (180 ms), volver se desliza desde la izquierda y cambiar de pestaña se funde (120 ms). Si el sistema pide menos movimiento (`prefers-reduced-motion`), no hay animación.
- **Avisos solo si hay un dato detrás (regla R23).** Un punto en Guías cuando hay un procedimiento a medias y la barra de reanudar está descartada, y un número en Más con los pendientes reales ("9+" por encima de nueve). Ningún punto decorativo.
- **La pastilla de sincronización se adapta.** Al día no gasta palabras en la buena noticia: solo el icono verde. Cuando hay algo que atender dice el número real ("3 sin subir", "2 con error") y pasa el color también al texto.
- **Tocar la pestaña activa** sube al principio de la lista; si había un filtro puesto o se estaba dentro de una ficha, primero vuelve a la raíz de la pestaña.

El **login** queda fuera del chasis (no hay sesión todavía) y trae su propia columna centrada.

**Desde la tarea 182 el sidebar de escritorio y la barra de pestañas de móvil ya no comparten la misma lista** (antes sí, `DESTINOS_BASE` + `DESTINO_BOVEDA` condicional a los dos). El **sidebar** de escritorio pasa a tener **catorce destinos** desde la tarea 183 (mockup `3e`: "el sidebar tiene 240 px de alto libre y ofrece cinco destinos de catorce"), en tres bloques:

**Nav principal** (sin cambios de la tarea 182):

| Destino | Ruta | Icono | Visible para |
|---------|------|-------|--------------|
| Inicio | `/` | House | Todos |
| Guías | `/soluciones` | BookOpen | Todos |
| Equipos | `/dispositivos` | Monitor | Todos |
| Red | `/red` | TreeStructure | Todos |
| Bóveda | `/boveda` | Vault | Solo con permiso `puede_ver_boveda` |

**Herramientas** (nuevo, tarea 183): Diagnóstico, Escanear.
**Registros** (nuevo, tarea 183): Ubicaciones, Personas.

Estos cuatro son los mismos destinos que "Más" da en móvil (menos Bóveda, Etiquetas, Importar y Mi cuenta, que en escritorio ya tienen puerta: Bóveda en el nav principal, Etiquetas e Importar en el "···" de Equipos, Mi cuenta al pie del sidebar). Icono sin variante rellena (evita sumar más colisiones a las que ya tiene el set, ver R24): solo recolorea a acento cuando está activo.

**Perfil al pie**, ahora con `Avatar` (iniciales) y un caret, en vez de solo nombre y correo: nombre, subtítulo fijo "Mi cuenta", enlace a `/cuenta`.

Las **5 pestañas de móvil** (`DESTINOS_BASE` + `DESTINO_MAS`) son en cambio fijas, iguales para todos (regla R17: "los permisos cambian lo que hay detrás de una puerta, no la forma de la barra"). La Bóveda deja de ser pestaña móvil y pasa a encabezar "Más" (decisión aprobada por el usuario):

| Pestaña (móvil) | Ruta | Icono | Visible para |
|---------|------|-------|--------------|
| Inicio | `/` | House | Todos |
| Guías | `/soluciones` | BookOpen | Todos |
| Equipos | `/dispositivos` | Monitor | Todos |
| Red | `/red` | TreeStructure | Todos |
| Más | `/mas` | DotsNine | Todos |

Estado de la pestaña activa en tres canales (regla R16 exige al menos dos): barra de 2px sobre la pestaña, icono relleno (salvo "Más", que no tiene variante rellena) y color de acento (`neutral-300` inactivo, antes `neutral-500`); más un rótulo de 12px en celdas de 52px (antes 10,5px en 44), estado presionado (fondo de acento al 10%) y anillo de foco de 2px, ninguno de los cuales existía antes de la tarea 182.

La Bóveda **solo aparece a quien tiene el permiso**; el resto ni sabe que existe. Desde la tarea 182 esto ya no cambia la FORMA de ninguna barra: en móvil la pestaña "Más" siempre está (con o sin la fila de Bóveda dentro); en escritorio el nav principal del sidebar mide 5 o 6 filas según el permiso, pero los bloques "Herramientas"/"Registros"/perfil de abajo no varían.

### 2.3 Los tres lenguajes de color

Conviven tres sistemas de color sobre superficies distintas (no se mezclan):

- **Estado de un equipo** (`src/features/dispositivos/estados.ts` + `topologiaVisual.ts`): 🟢 operativo (verde/éxito), 🟡 en mantenimiento (ámbar/precaución), 🔴 fuera de servicio (rojo/error), ⚫ de baja (neutro), gris para cualquier texto libre.
- **Tipo de documento** (`iconosSoluciones.ts`): tiñe el recuadro del icono de cada artículo según su tipo.
- **Identidad de categoría** (`coloresCategoria.ts`): tiñe los chips de filtro, cabeceras de grupo, rejillas de selección y la ficha de categoría. Se deriva del `orden` de la categoría o de un override manual (`categorias.color`).

### 2.4 Navegación "Volver" / "Cancelar"

Fuente única: `src/lib/navegacion.ts` (`padreDe(pathname)`), con pruebas. Define el "padre lógico" (pantalla superior) de cada ruta y su etiqueta. `src/components/BotonVolver.tsx` deriva de ahí destino y texto. Es navegación "Up" declarada, no `history.back()` (hay flujos hacia adelante donde retroceder caería en el formulario recién enviado). Regla: creación y fichas de contenido suben a la pantalla-lista de su sección; edición y asistente suben a la ficha de la entidad. El filtro de la lista viaja por URL (`?categoria=<id>`, `?etiqueta=<x>`) para volver "exactamente como estaba".

**Y el origen manda sobre el padre, cuando lo hay (tarea 202, regla M-R2).** El padre lógico no siempre es el sitio del que se vino, y eso convertía tres recorridos en callejones. Desde ahora, quien origina un salto lateral le pasa al destino de dónde viene, y el chasis usa ese origen para el regreso, su rótulo y la línea de contexto del ancla:

| Vas de | a | El regreso decía | Ahora dice |
|---|---|---|---|
| Escáner | ficha de un equipo | "Equipos" (y el escáner se borraba del historial) | **"‹ Escáner"**, con la cámara viva |
| Topología de un equipo | ficha de otro equipo | "Red" | **"‹ Topología"**, al mismo nodo |
| Ficha de un equipo | Ubicación, Persona o el equipo al que reemplaza | "Ubicaciones", "Personas", "Equipos" | **el nombre del equipo del que vienes** |

El padre declarado sigue siendo el respaldo y no se retira: al abrir un enlace compartido o entrar en frío no hay origen, y el regreso vuelve a ser el de siempre. Ninguna pantalla puede quedarse sin salida. El porqué del mecanismo, en [DECISIONES.md](DECISIONES.md) AD-030.

### 2.5 Sincronización y estado offline

- Todas las lecturas/escrituras van primero a la base local (Dexie); la app nunca espera a la red.
- Cola de cambios pendientes (outbox, tabla `cambiosPendientes`): cada edición offline se guarda y se envía al reconectar.
- Descarga de novedades por `updated_at` (cursor `recibido_en` en las tablas inmutables).
- Propagación en tiempo real vía Supabase Realtime (un canal `cambios-equipo`): reduce el retraso a 1-2 segundos. El evento solo dispara una descarga; la descarga respeta RLS por consulta.
- Conflictos: gana la última escritura, pero el historial conserva ambos cambios y el panel de sincronización avisa qué ficha se sobrescribió.
- La **pastilla de sincronización** (cabecera de Inicio) resume el estado con cuatro variantes: "Al día" (neutro), "Sincronizando" (precaución), "Con error" (rojo) y "Sin conexión" (precaución). Tocarla fuerza una sincronización y abre el **Panel de sincronización** (ver sección 8).

---

<a id="3-mapa-completo-de-rutas"></a>
## 3. Mapa completo de rutas

Definidas en `src/App.tsx`. Todas las pantallas se cargan bajo demanda (`React.lazy`).

| Ruta | Pantalla / Componente | Nivel del chasis | Descripción |
|------|-----------------------|-------|-------------|
| `/login` | LoginPage | Fuera del chasis | Inicio de sesión (fuera de RequireAuth) |
| `/` (index) | InicioPage | Sección | Pantalla principal + buscador global |
| `/cuenta` | CuentaPage | Documento | Mi cuenta (cambiar contraseña, cerrar sesión) |
| `/cuenta/seguridad` | SeguridadPage | Documento | Bloqueo de la app (patrón/contraseña) |
| `/soluciones` | SolucionesPage | Sección | Lista de artículos, chips de categoría, buscador, hoja de tipo, bloque "Sin terminar" |
| `/soluciones/:categoriaId` | CategoriaPage | Documento | Ficha 360° de una categoría |
| `/soluciones/:categoriaId/nuevo` | ArticuloForm | Tarea | Crear artículo (editor con 4 pestañas) |
| `/soluciones/:categoriaId/:articuloId` | ArticuloPage | Documento | Ficha de un artículo/procedimiento |
| `/soluciones/:categoriaId/:articuloId/editar` | ArticuloForm | Tarea | Editar artículo |
| `/soluciones/:categoriaId/:articuloId/ejecutar` | AsistentePage | Tarea | Modo asistente (un paso a la vez) |
| `/dispositivos` | DispositivosPage | Sección | Inventario general |
| `/dispositivos/nuevo` | DispositivoForm | Tarea | Crear equipo (soporta `?copiarDe`, `?reemplazaA`, `?red=1`) |
| `/dispositivos/:dispositivoId` | DispositivoPage | Documento | Ficha 360° de un equipo |
| `/dispositivos/:dispositivoId/editar` | DispositivoForm | Tarea | Editar equipo |
| `/dispositivos/:dispositivoId/baja` | DarDeBajaPage | Tarea | Dar de baja con cascada |
| `/dispositivos/:dispositivoId/reemplazo` | ReemplazoPage | Tarea | Migrar dependencias al reemplazar |
| `/dispositivos/etiquetas` | EtiquetasPage | Tarea | Etiquetas QR imprimibles |
| `/dispositivos/importar` | ImportarDispositivosPage | Tarea | Importación masiva Excel/CSV (3 pasos) |
| `/ubicaciones` | UbicacionesPage | Documento | Lista de ubicaciones (árbol) |
| `/ubicaciones/nueva` | UbicacionForm | Tarea | Crear ubicación |
| `/ubicaciones/migrar` | MigracionUbicaciones | Tarea | Convertir textos en ubicaciones |
| `/ubicaciones/:ubicacionId` | UbicacionPage | Documento | Ficha 360° de una ubicación |
| `/ubicaciones/:ubicacionId/editar` | UbicacionForm | Tarea | Editar ubicación |
| `/personas` | PersonasPage | Documento | Lista de personas/responsables |
| `/personas/nueva` | PersonaForm | Tarea | Crear persona |
| `/personas/migrar` | MigracionPersonas | Tarea | Convertir textos en personas |
| `/personas/:personaId` | PersonaPage | Documento | Ficha 360° de una persona |
| `/personas/:personaId/editar` | PersonaForm | Tarea | Editar persona |
| `/red` | RedPage | Sección | Recorrido por nodos: el equipo, de qué depende y qué cae si falla |
| `/red/equipos` | EquiposRedPage | Documento | Todos los equipos de red, agrupados por ubicación |
| `/red/topologia` | TopologiaPage | Documento | Mapa/bosque de toda la red |
| `/red/topologia/:dispositivoId` | TopologiaEquipoPage | Documento | Topología centrada en un equipo |
| `/boveda` | BovedaGuard > BovedaPage | Sección | Lista de secretos (tras desbloqueo) |
| `/boveda/nueva` | CredencialForm | Tarea | Crear secreto |
| `/boveda/migrar` | MigracionCredenciales | Tarea | Migrar secretos que son de un equipo |
| `/boveda/:credencialId` | CredencialPage | Documento | Ficha de un secreto (descifrado local) |
| `/boveda/:credencialId/editar` | CredencialForm | Tarea | Editar secreto |
| `/mas` | PantallaMas | Sección | Quinta pestaña móvil: puerta de Bóveda, Diagnóstico, Escanear, Ubicaciones, Personas, Etiquetas QR, Importar y Mi cuenta (tarea 182) |
| `/diagnostico` | DiagnosticosPage | Documento | Lista de problemas por categoría |
| `/diagnostico/nuevo` | DiagnosticoForm | Tarea | Crear diagnóstico (árbol de preguntas) |
| `/diagnostico/:diagnosticoId` | DiagnosticoRunPage | Tarea | Asistente de ejecución del diagnóstico |
| `/diagnostico/:diagnosticoId/editar` | DiagnosticoForm | Tarea | Editar diagnóstico |
| `/diagnostico/estadisticas` | EstadisticasPage | Documento | Tablero de estadísticas |
| `/diagnostico/sugerencias` | SugerenciasEquipoPage | Documento | Sugerencias del equipo (borrador de artículos) |
| `/escaner` | EscanerPage | Tarea | Escaneo de QR y códigos de barras |
| `/notas/*` | (redirección) | - | Redirige a `/boveda` (nombre antiguo) |

---

<a id="4-modelo-de-datos"></a>
## 4. Modelo de datos (tablas)

Resumen de las entidades que la app maneja. Detalle completo de columnas y decisiones en [ARQUITECTURA.md](ARQUITECTURA.md) sección 5. Las tablas sincronizadas viven tanto en Dexie (local) como en Supabase (remoto). Algunas tablas son **solo locales** (no sincronizan): `recientes`, `favoritos`, `progresoPasos`, `progresoDiagnostico`, `seguridadApp`, `cambiosPendientes`, `archivosPendientes`.

| Tabla | Rol | ¿Sincroniza? |
|-------|-----|--------------|
| `categorias` | Categorías de conocimiento y de dispositivos (bandera `es_red`, color) | Sí |
| `articulos` | Procedimientos, manuales, incidencias (JSON `procedimiento`); `aplica_a` (jsonb, hallazgo H6) refina a qué marca/modelo aplica dentro de la categoría, null = toda la categoría | Sí |
| `dispositivos` | Inventario de equipos (generales y de red) | Sí |
| `conexiones` | Enlaces entre equipos (enlace, instalación, relacionado) | Sí |
| `ubicaciones` | Lugares físicos con jerarquía opcional | Sí |
| `personas` | Responsables de equipos | Sí |
| `credenciales` | Secretos de la bóveda (cifrados) | Sí |
| `campos_protegidos` | Datos sensibles propios de un equipo (cifrados) | Sí |
| `diagnosticos` | Árboles de preguntas del diagnóstico | Sí |
| `ejecuciones_diagnostico` | Registro inmutable de cada diagnóstico ejecutado | Sí |
| `accesos_boveda` | Auditoría inmutable de la bóveda | Sí |
| `historial` | Registro inmutable de cambios de todas las entidades | Sí |
| `adjuntos` | Referencias a archivos en Storage | Sí |
| `perfiles` | Datos de cada usuario (nombre, permiso de bóveda) | Sí |
| `boveda_meta` | Verificador de la contraseña maestra | Sí |
| `recientes` | Últimas fichas consultadas (personal) | No |
| `favoritos` | Fichas fijadas con la estrella (personal) | No |
| `progresoPasos` | Avance local de cada procedimiento | No |
| `progresoDiagnostico` | Sesión de diagnóstico en curso | No |
| `seguridadApp` | Verificador del bloqueo de la app | No |
| `cambiosPendientes` | Cola de subida (outbox) | No |
| `archivosPendientes` | Cola de subida de archivos offline | No |

Las eliminaciones son **borrados suaves** (`eliminado_en`), no borrado físico.

---

<a id="5-secciones-del-menu-principal"></a>
## 5. Secciones del menú principal

<a id="51-inicio"></a>
### 5.1 Inicio

**Ruta:** `/` · **Archivo:** `src/features/inicio/InicioPage.tsx` · **Nivel:** Sección

**Objetivo.** Punto único de entrada al conocimiento del equipo. La pantalla principal ES el buscador global (el pilar de la app): abrir y buscar toma dos toques. Cuando no se busca, muestra atajos de trabajo y bloques derivados de la actividad reciente.

> **Rediseñada el 2026-09-01** (tarea 203, auditoría móvil M-006, M-007, M-013 y M-003, mockup `2b`). Con la base llena medía **más de 2.200 px a 360 px**: cuatro pantallas. El problema no era la cantidad de información sino que **cinco bloques usaban exactamente la misma fila de 52 px** y solo un rótulo de 11 px los distinguía: "Pendientes" (algo que debo hacer) pesaba igual que "Actividad del equipo" (algo que hizo otro). Ahora son **cinco bloques y dos pesos de fila** (reglas **M-R6** y **M-R7**), y **medido en navegador a 360 px baja a 1.035 px, 1,6 pantallas**. **Nada se borra:** lo secundario se pliega tras una línea con su conteo.

**Cabecera fija (con desenfoque).** Desde la tarea 181 la fila superior es la **barra superior global** (ver la sección 2), común a las cinco pestañas: título "Inicio" (antes decía "IT Brain": era la única pestaña cuyo encabezado no repetía su rótulo, ver [DECISIONES.md](DECISIONES.md) AD-022), pastilla de sincronización y avatar de la cuenta. Debajo, lo propio de Inicio:
- **Buscador en línea** (input `type="search"`), **de 46 px**: placeholder "Buscar en Guías, Equipos y Bóveda". Con botón "Borrar búsqueda" (X) cuando hay texto. Usa `useDeferredValue` para que escribir se sienta instantáneo.
- **La lupa del chasis se apaga aquí, y solo aquí** (`conLupa={false}`, regla **M-R8**, "un buscador por pantalla"): esta pantalla ya trae su campo con el alcance escrito, así que la lupa era el segundo buscador de la misma pantalla y además con el alcance redactado distinto. En las otras cuatro secciones la lupa ES el buscador y se queda.
- **Sin saludo.** El saludo dinámico según la hora ("Buenos días/tardes/noches. Todo el conocimiento del equipo, al instante") **se retiró en la tarea 184** (decisión aprobada por el usuario): ocupaba la línea de contexto con un eslogan que cambiaba tres veces al día, así que la entrada nunca se veía igual dos veces. Lo que hay que decir el primer día lo dice ahora la bienvenida (bloque 0 de abajo), y solo mientras haga falta.

**Modo búsqueda (hay texto).** Resultados agrupados por fuente, en orden fijo: **Guías** (diagnósticos, categorías, artículos, adjuntos), **Equipos**, **Bóveda** (solo si está desbloqueada), **Ubicaciones**, **Personas**. Cada grupo muestra su conteo. Cada fila lleva icono con tono por tipo, título con el término **resaltado**, subtítulo y flecha. Si no hay coincidencias: estado vacío con botón "Limpiar búsqueda". El índice tolera errores de escritura y sinónimos ("backup" encuentra "copia de seguridad").

**Modo inicio (sin texto), bloques en orden:**
0. **Bienvenida del primer día** (`BienvenidaPrimerDia`, tarea 184; solo mientras haga falta): "Bienvenido, {nombre de pila}", una línea de qué vive aquí, y **tres pasos que se apagan solos**, cada uno con su marca (check verde si está hecho, su número si falta; el primero que falta va en acento y el resto en neutro):
   1. *Entraste con tu cuenta* (siempre hecho: esta pantalla solo se ve con sesión).
   2. *Instala la app en el teléfono*, con botón **"Instalar"** (diálogo nativo del navegador) o **"Cómo instalar"** si el navegador no lo ofrece (Safari de iOS siempre), que abre un modal con los tres pasos manuales. Se marca hecho cuando la app corre instalada.
   3. *Descarga todo para trabajar sin señal*, con botón **"Descargar"** que dispara la misma descarga que el bloque 9 (comparten estado, así que el progreso se ve en los dos). Se marca hecho tras la primera descarga.
   **Se retira sola**, sin botón de cerrar: cuando los tres pasos están hechos, o cuando esta pantalla ya tiene bloques propios (recientes, pendientes o un procedimiento a medias). Un cierre a mano habría hecho falta guardar; el bloque desaparece porque deja de ser cierto. Consecuencia conocida: quien llega a un equipo con pendientes visibles no ve la bienvenida, y la instalación le queda ofrecida en Mi cuenta (sección 6.6).
1. **Reanudar** (si aplica): tarjeta con el procedimiento a medias más reciente, "Sigues en el paso N de M" como rótulo, barra de progreso y el tiempo que queda ("~14 min"). **No se repite si la barra flotante de reanudar está visible** (hallazgo **M-013**): se veían las dos a la vez, una encima de la otra. Es el mismo componente (`BarraReanudar variante="tarjeta"`) y el mismo dato (`useReanudar`) que la barra flotante y que "Sin terminar" de Guías: antes eran **tres dibujos distintos de la misma cosa**, uno de ellos con su propia consulta dentro de esta pantalla.
2. **Atajos rápidos**: "Diagnóstico" (→ `/diagnostico`), "Escanear" (→ `/escaner`) y, a lo ancho, **"Registrar equipo"** (→ `/dispositivos/nuevo`, hallazgo H9). Retirar el tercero es el hallazgo **M-008**, que pertenece a la tarea 207 y trae su propia condición (que el alta viva tras un escaneo sin coincidencia), así que sigue aquí. Además, en el estado "Sin coincidencias" del buscador se ofrece **"Crear equipo"** con el texto buscado precargado como nombre (`?nombre=`).
3. **"Te toca a ti"** (si hay), el único bloque con **fila de ACCIÓN**: mis borradores, credenciales/campos protegidos por vencer o vencidos (solo con permiso de bóveda) y sugerencias del equipo sin revisar. La fila mide **56 px**, el título va a **15 px** y debajo va **la razón en el color de su estado** ("Vencida" en rojo, "Borrador tuyo · hace 2 días" en neutro): es lo que distingue lo urgente de lo anecdótico sin leer. Se ven **2 filas** y el resto entra con "Ver los otros N", en el sitio y sin cambiar de pantalla. La cabecera lleva el conteo total a la derecha.
4. **"Lo que consultaste"** (si hay), con **fila de INFORMACIÓN**: las últimas fichas consultadas. **44 px, 13,5 px, icono pequeño sin cuadrado de color y sin galón** (no promete una acción), con el dato para reconocerla a la derecha. Mismo patrón de 2 filas + "Ver los otros N".
5. **Plegados, tras una línea con su conteo** (regla **M-R4**, componente `SeccionPlegable`): **"Problemas frecuentes"**, **"Favoritos"**, **"Para empezar"** y **"Actividad del equipo"**. Cuatro líneas de 52 px en vez de unos 1.200 px de filas; el conteo dice lo que hay dentro sin abrirlas, y se abren en el sitio. Dentro, todo va con fila de información, porque toda es de consulta.
6. **Botón "Descargar todo para offline"** (`DescargarOffline`): deja el contenido de adjuntos en el teléfono antes de salir a un mantenimiento, con progreso.

**Las dos únicas formas de fila (regla M-R6, "una fila, un significado").** Si dos bloques tienen la misma forma es porque tienen la misma naturaleza. **Acción**: lo que el técnico debe resolver (solo "Te toca a ti"). **Información**: todo lo demás. Antes cinco bloques compartían la misma fila de 52 px, con cuadrado de color y galón, y el único distintivo era el rótulo de sección.

**El aviso numérico de la barra de pestañas vive ahora en Inicio** (hallazgo **M-003**, regla **M-R9**). Estaba sobre "Más", que es un índice y **no contiene ni un pendiente**: se tocaba el aviso, no había nada, y eso enseña al técnico a ignorar los avisos. Los pendientes viven en esta pantalla, así que el aviso se mudó con el dato.

**Interacción con otras secciones.** Es la puerta a todo: el buscador atraviesa Guías, Equipos, Bóveda, Ubicaciones y Personas; los bloques enlazan a diagnósticos, artículos, credenciales, fichas de equipo, la pantalla de estadísticas y las sugerencias del equipo.

---

<a id="52-guias"></a>
### 5.2 Guías

**Ruta:** `/soluciones` · **Archivo:** `src/features/soluciones/SolucionesPage.tsx` · **Nivel:** Sección

**Objetivo.** Responder "¿cómo realizo este procedimiento?". Rejilla de artículos (procedimientos, manuales, incidencias) filtrable por categoría, tipo y etiqueta.

> **Rediseñada el 2026-07-27** a partir del handoff "Auditoría de Soluciones TI" (pantalla P1). Las reglas visuales que rigen ahora toda la sección (R1 a R7) están en [DECISIONES.md](DECISIONES.md) AD-019. El layout de escritorio se conservó tal cual (AD-021). **Renombrada a "Guías" el 2026-07-28** (AD-022); la ruta sigue siendo `/soluciones`.

**Cabecera fija:** la fila superior es la **barra superior global** (título "Guías", sincronización, lupa y cuenta; ver la sección 2). Debajo, lo propio de la sección:
- **Pastilla de frescura**: "N artículos al día · hace 4 min", o "N cambios sin subir" en ámbar, o "sin sincronizar aún" (regla R7; antes esta señal solo existía en Inicio). Es informativa, no abre nada.
- **Botón "Crear"**, siempre activo y en acento (regla R3). Con una categoría elegida abre `/soluciones/:categoriaId/nuevo`; **sin categoría abre la hoja "¿En qué categoría?"** y navega al editor de la que se elija. Antes estaba deshabilitado y la razón vivía en un `title`, que en un teléfono nadie lee porque no hay hover.
- **Buscador** (`type="search"`): placeholder "Buscar equipo, síntoma o etiqueta". Busca por título, categoría, tipo y etiquetas (normalizado sin acentos). El botón de borrar mide **44 px** reales (regla R6; medía 26).
- **Chips de categoría de 44 px** (tarea 214, tablero `3b`; medían 36) más el chip punteado **"Tipo"**, que abre su hoja. Un solo eje de filtro visible (R4): la **etiqueta** no es un chip sino un **modo** con su propia cinta de contexto ("Etiqueta: X · Ver todos"), al que se llega tocando una etiqueta en la ficha de un artículo.

**La fila dice lo que la guía puede hacer por ti** (tarea 214, tablero `3b`). Cada guía es una **tarjeta** con recuadro de 40 px, título de 16,5 px y, debajo, su capacidad: **"7 pasos · ~25 min · verificación"**, o **"Sin pasos · solo notas · no se puede ejecutar"** cuando no hay procedimiento (la tarjeta va entonces con borde punteado). Si es ejecutable trae un botón de **52 px** que lleva directo al paso 1 (`/ejecutar`), y **su ausencia es la señal** de que no hay nada que ejecutar. Antes la fila pintaba `categoría · tipo · min` exactamente igual para una guía de 7 pasos con verificación y para un borrador sin un solo paso: el dato existía (lo calcula el editor) pero no llegaba a donde se decide, así que el técnico abría la guía para descubrir que estaba vacía.
- **Chips de categoría** (deslizables en móvil, con un degradado en el extremo derecho que indica que hay más sin necesidad de barra; en escritorio `xl`, rail lateral fijo de 220px): "Todos" + una por categoría, cada uno con su color de identidad, icono y conteo.
- **Botón "Tipo"**: el segundo eje de filtro ya no ocupa cabecera (regla R4). Abre la hoja inferior "Tipo de documento", con los tipos presentes y su conteo. Cuando hay uno elegido, el botón muestra su nombre en acento. Está disponible siempre, no solo dentro de una categoría, y se acota a la categoría activa cuando hay una.

**Cuerpo (lista):**
- **Bloque "Sin terminar"** arriba (solo al navegar, sin buscar ni filtrar por etiqueta): hasta 3 procedimientos que este técnico dejó a medias, con el paso actual, los minutos que le quedan (~), una barra de avance y la acción "Seguir", que va directo al modo asistente. Retomar pasó de cuatro toques a uno. El avance es local del dispositivo.
- Al **buscar**: resultados agrupados por categoría (encabezado con icono, nombre y conteo), término resaltado, y encabezado "N artículos coinciden". Si la coincidencia **no** fue en el título, la fila lo explica: "Coincide en la etiqueta *zebra*".
- **Cinta de contexto al buscar** con una categoría elegida: "Busco en todas las categorías. El filtro **X** queda en pausa", con el botón **"Solo ahí"** para acotar (y "En todas" para volver a abrir). Antes buscar descartaba los filtros en silencio.
- Al **navegar**: lista plana (o rejilla en escritorio: `@lg` 2 columnas, `@4xl` 3), bajo el rótulo "Todos los artículos" con su conteo. Cada fila (`FilaArticulo`) muestra el **glifo del tipo en su color dentro de un recuadro neutro** (regla R1; antes el recuadro entero iba relleno del color del tipo y seis tipos en columna hacían arcoíris), título de 15 px, línea de metadatos (categoría · tipo · tiempo estimado) y una **pastilla de contorno** "Borrador"/"Obsoleto" si aplica (antes eran dos formas distintas para el mismo dato).
- **Filtro por etiqueta** (banner "Etiqueta: X · Ver todos"): se activa al tocar una etiqueta en la ficha de un artículo (`?etiqueta=<x>`). Ignora categoría y tipo mientras esté activo.
- **Estados vacíos, todos con acción** (regla R5):
  - Primera vez: "Aquí va a vivir lo que el equipo sabe" + **"Crear el primero"**.
  - Búsqueda sin resultados: "Nada coincide con «X»", con corrección ortográfica tocable si la hay ("Quizá quisiste decir *zebra*") + **"Limpiar la búsqueda"** y **"Documentarlo"**.
  - Filtros sin resultados: "No hay artículos con estos filtros" + **"Quitar los filtros"** y "Crear".

**Acciones:** buscar (acotable a la categoría), filtrar por categoría/tipo/etiqueta, retomar un procedimiento a medias, crear artículo (con o sin categoría elegida), abrir un artículo, abrir una categoría (desde el buscador global, no desde esta lista).

**Interacción.** Cada artículo abre su ficha; las categorías son un filtro (la ficha de categoría se alcanza desde el buscador global y desde la ficha de un dispositivo). Las fichas de dispositivos enlazan a los procedimientos de su categoría y viceversa.

#### 5.2.1 Ficha de artículo (`ArticuloPage`)

**Ruta:** `/soluciones/:categoriaId/:articuloId` · **Nivel:** Documento

**Cabecera (rediseñada en la tarea 172; ancla permanente desde la tarea 201):** chevron de regreso de 44 px (a la lista con el chip de la categoría) y, a su lado, **"Guías · {categoría}" a 11 px con el título del artículo a 14 px**, que **se queda en pantalla al desplazarse** (regla **M-R1**). A la derecha, **tres controles de 44 px**: **estrella de favorito**, **editar** (icono de lápiz) y menú **"···"** con **Compartir**, **Duplicar** (`?copiarDe`), **Reiniciar progreso** (si tiene procedimiento) y **Eliminar** (eliminación sensible, pide contraseña maestra). Antes eran cinco controles y con una categoría de nombre largo la fila se estrangulaba; "Ejecutar" bajó a la barra de acción.

**Barra de acción, fija abajo (tarea 172).** Una sola acción dominante, al alcance del pulgar, que dice qué va a pasar: **"Empezar"** sin avance, **"Seguir en el paso N de M"** a medias, **"Repetir"** cuando ya está todo hecho, con una nota debajo ("Tu avance se guarda en este teléfono"). Solo aparece si el artículo tiene un procedimiento con pasos. Antes "Ejecutar" y "Editar" pesaban lo mismo, estaban arriba y el botón decía "Ejecutar" incluso con 2 de 6 pasos hechos.

**Cuerpo:**
- Avisos si es **Borrador** ("No aparece en el buscador, rutas de inicio ni diagnóstico") u **Obsoleto** ("Usar el procedimiento vigente"). El estado se dice **una sola vez**: desde la tarea 172 no se repite además como pastilla en el encabezado.
- **Portada** (imagen banner, si tiene).
- **Encabezado**: **kicker de tipo** sobre el título, en el matiz de su tipo; título; descripción ("cuándo usar"); **metadatos como lista con rótulo** (Tiempo, Dificultad, Aplica a, Versión), y línea meta con la procedencia del dato ("Actualizado el DD mmm por Autor"). "Aplica a" es la restricción de marca/modelo (hallazgo H6) y avisa de que el artículo no aparece en otros equipos de la misma categoría; antes iba como una pastilla neutra idéntica a las demás, donde nada decía que fuera una restricción. La categoría no se repite aquí: la nombra el botón de regreso.
- Si es **problema_frecuente**: bloques "Síntomas", "Posibles causas" y "Equipos afectados" (pastillas navegables a la ficha de cada equipo).
- **Procedimiento** (si tiene pasos): `ProcedimientoVista` (ver sección 13, flujo de ejecución) con objetivo, requisitos "Antes de empezar" y el stepper de pasos. Desde la tarea 172: el avance va en **segmentos junto al título de "Pasos"** (se retiró la barra de progreso pegajosa), los **pasos llegan plegados salvo el actual** (al marcar el actual se cierra solo y se abre el siguiente; el técnico puede abrir o cerrar cualquiera y su elección manda), las **casillas miden 24 px en filas de 44** con el texto de la tarea a 15 px, los **avisos dicen su palabra** ("Precaución.") además del color, y la **verificación final se anuncia** en una tarjeta neutra ("Al terminar hay N comprobaciones", con cuándo se abren) hasta que se puede marcar de verdad.
- **Contenido en Markdown** (notas adicionales).
- **Adjuntos** (solo en artículos sin procedimiento).
- **"Relacionados"** y **"Aparece como relacionado en"** (inverso calculado localmente).
- **"Referenciado por"** (`ReferenciadoPor`): qué procedimientos y diagnósticos usan este artículo como subprocedimiento, solución, decisión o ejecución.
- **Etiquetas** tocables (llevan a `/soluciones?etiqueta=<x>`).
- **Historial** (línea de tiempo).

#### 5.2.2 Editor de artículo (`ArticuloForm`)

Ver detalle campo por campo en la sección 7 (Catálogo de formularios). Es un editor a pantalla completa con **cuatro pestañas** (General, Pasos, Detalles, Publicación), completitud con sugerencias, vista previa, plantillas por tipo y aviso de artículos similares.

---

<a id="53-equipos"></a>
### 5.3 Equipos

**Ruta:** `/dispositivos` · **Archivo:** `src/features/dispositivos/DispositivosPage.tsx` · **Nivel:** Sección

**Objetivo.** Responder "¿qué se sabe de cada equipo?" con el inventario **general** (los equipos de categorías de red van en la sección Red, no aquí).

**Cabecera fija:** la fila superior es la **barra superior global** (título "Equipos", sincronización, lupa y cuenta; ver la sección 2). **Renombrada el 2026-07-28** ([DECISIONES.md](DECISIONES.md) AD-022); la ruta sigue siendo `/dispositivos`. Debajo, lo propio de la sección:
- Subtítulo "Qué se sabe de cada equipo".
- **Botón "Escanear equipo"** (icono QR, → `/escaner`).
- **Botón "Crear"** (→ `/dispositivos/nuevo`).
- Menú **"···"** con: **Ubicaciones** (→ `/ubicaciones`), **Personas** (→ `/personas`), **Etiquetas QR** (→ `/dispositivos/etiquetas`), **Importar** (→ `/dispositivos/importar`).
- **Buscador** (`type="search"`): placeholder "Nombre, IP, serial o ubicación".
- **Chips de categoría** deslizables (solo categorías generales): "Todos" + una por categoría con su conteo.

**Cuerpo:**
- **Resumen de estados** (siempre sobre el inventario completo, sin filtrar): "N equipos", "N operativos" (verde), "N en mantenimiento" (ámbar), "N fuera de servicio" (rojo).
- **Lista de fichas** (`FilaDispositivo`): miniatura de foto (o icono), nombre, subtítulo (categoría · ubicación), indicador de estado.
- Estados vacíos: "Ningún dispositivo coincide" (con filtros, botón "Quitar filtros") o "Aún no hay dispositivos registrados".

**Acciones:** buscar, filtrar por categoría, crear, escanear, abrir ubicaciones/personas/etiquetas/importar, abrir una ficha.

#### 5.3.1 Ficha de dispositivo (`DispositivoPage`)

**Ruta:** `/dispositivos/:dispositivoId` · **Nivel:** Documento. Vista 360°.

**Cabecera:** **ancla permanente** (tarea 201, regla M-R1): chevron de regreso de 44 px (a Equipos o a Red según `es_red` de su categoría), y a su lado el origen a 11 px ("Red · Rack 1") con el **nombre del equipo a 14 px**, que **se queda en pantalla al desplazarse**. A la derecha, **estrella de favorito**, **botón Compartir** (diálogo nativo o copia el enlace) y menú **"···"** con: **Duplicar** (`?copiarDe`), **Editar**, **Etiqueta QR**, **Reemplazar** (`?reemplazaA`), **Dar de baja** (→ `/baja`) y **Eliminar** (sensible).

**Cuerpo: cuatro capas** (rediseño del 2026-08-03, tarea 201, regla **M-R4**). Antes eran nueve secciones siempre abiertas, en orden de escritura y no de urgencia: a 360 px, "Conexiones" empezaba pasadas tres pantallas de scroll y la primera se iba entera en la foto de 150 px y la línea de completitud. No se quitó ningún dato; se repartió.

- **Banner de migración pendiente** (si este equipo reemplaza a otro con dependencias sin migrar): enlaza a `/reemplazo`.
- **"¿Qué sigue?"** (solo la primera vez tras crear el equipo): pasos sugeridos (agregar foto, seguridad, conexiones, documentar procedimiento) con enlaces directos.
- **Capa 1, "Ahora"** (cabe en la primera pantalla): tarjeta con miniatura de foto (o icono de tipo de nodo), **nombre**, marca y modelo, **pastilla de estado** con punto de color; **Dirección IP** copiable con el piso de dato técnico (14 px monoespaciado tabular, botón de copiar de 44 px, regla **M-R5**); y la **Ubicación** como enlace vivo a su ficha.
- **Capa 2, "Contexto"** (abierta): tarjeta con **Número de serie** y **Placa de inventario** (copiables, mismo piso técnico), propiedades personalizadas (detalles clave/valor), **Responsable** (enlace vivo a la persona), **"Reemplaza a"** / **"Reemplazado por"** (enlaces), **Categoría y fecha**, y las observaciones debajo. Por debajo de 380 px de contenedor la etiqueta pasa encima del valor en vez de robarle ancho (regla **M-R13**); ninguna etiqueta mide más de 96 px.
- **Capa 3, "Acción"**: botón "Iniciar diagnóstico" (si hay diagnóstico para su categoría); listas "Procedimientos de este equipo" y "Problemas frecuentes de este equipo" que muestran **tanto los específicos** (vinculados por `dispositivosAfectados`) **como los de su categoría** (procedimientos e incidencias publicados de la misma categoría, derivados por `categoria_id`, con sub-rótulo "De la categoría {X}" y "Ver todos" cuando hay más de 5, hallazgo H1), refinados además por el criterio **marca/modelo** del artículo si lo tiene (`aplicaA`, hallazgo H6); y "Credenciales de este equipo" (con permiso). **Los tres botones de creación que se intercalaban aquí bajaron a la puerta única del pie** (regla **M-R10**).
- **Capa 4, "Profundidad"**: cinco filas de 52 px, **plegadas y con su conteo a la vista** (plegar informa, no esconde). El contenido solo se monta al abrirse.
  - **"Si falla, caen · N equipos"** (`ImpactoYDependencias`, solo si participa en conexiones): impacto de falla y dependencia ascendente. Es la única con tono de precaución, porque el dato en sí advierte.
  - **"Conexiones · N"** (`ConexionesFicha`): agrupadas en Instalado en / Contiene / Enlaces / Relacionados, con enlace "Ver en topología" y alta/baja de conexión. **Cada fila del grupo Enlaces dice su dirección** ("Da servicio a" o "Recibe de", los mismos rótulos del alta) y trae un botón **"Invertir la dirección"** de 44 px (tarea 208, hallazgo N1): sin ese rótulo un enlace registrado al revés se veía idéntico a uno correcto y solo se notaba en el árbol de topología, ya torcido. Invertir es reversible con el mismo botón y queda anotado en el historial de los dos equipos.
  - **"Datos protegidos · N"** (`SeguridadDelEquipo`, solo con permiso de bóveda): datos protegidos propios del equipo (usuario, contraseña, PIN...). Ver sección 7. Llega abierta cuando se entra desde el aviso anti duplicidad de la Bóveda (`?nuevoCampoProtegido=`).
  - **"Adjuntos · N"**: la fotografía del equipo a tamaño completo y la galería de adjuntos.
  - **"Intervenciones · última hace X"**: `RegistrarIntervencion` (bitácora manual) + Historial (línea de tiempo, incluye cambios de cableado). El conteo cuenta el trabajo escrito a mano, no cada cambio de campo.
- **Puerta única de documentar** (al pie, plegada): la línea "Documentar este equipo · foto, procedimiento o incidencia — se hace mejor desde el ordenador" abre **Editar la ficha**, **Reportar incidencia**, **Documentar procedimiento** y **Guardar secreto** (con permiso), todos precargando el equipo. El **aviso de completitud** ("Ficha al 70%. Falta: foto, serial.") vive aquí dentro, en neutro y no en ámbar: una ficha a medias no es una advertencia (regla **M-R11**).
- **Acción dominante fija al pie** (52 px, regla **M-R3**), solo si hay algo que resolver: **"Resolver un problema con este equipo"** (→ `/diagnostico?categoria=`) con su promesa escrita debajo ("3 procedimientos y 2 problemas frecuentes aplican aquí").

#### 5.3.2 Editor de dispositivo (`DispositivoForm`)

Ver campo por campo en la sección 7. Soporta tres modos por query param: normal, **duplicar** (`?copiarDe`), **reemplazo** (`?reemplazaA`), y priorización de categorías de red (`?red=1`).

---

<a id="54-red"></a>
### 5.4 Red

**Ruta:** `/red` · **Archivo:** `src/features/red/RedPage.tsx` · **Nivel:** Sección

**Objetivo.** Responder "¿cómo está conectada la infraestructura?". Reúne los equipos de las categorías marcadas `es_red` (racks, puntos de red, switches, access points, cámaras). No duplica el inventario: son dispositivos normales con la bandera de categoría.

**Red abre con el nodo, no con la lista (tarea 204, hallazgo M-018).** Hasta entonces esta pantalla era un **segundo inventario**: el mismo buscador, los mismos grupos y la misma fila de equipo que Equipos, con las relaciones apartadas detrás de una fila. La sección que existe para explicar dependencias no las mostraba en su primera pantalla. Ahora la pestaña abre con **un nodo y su vecindad**, que es la pantalla que ya estaba construida (la topología de un equipo) y estaba a tres toques.

**Cabecera:** la **barra superior global** (título "Red", sincronización, lupa y cuenta; ver la sección 2). Debajo: subtítulo "Cómo está conectada la infraestructura", **botón "Crear"** (→ `/dispositivos/nuevo?red=1`, que prioriza las categorías de red en el selector) y una **puerta al buscador** con forma de campo (→ `/red/equipos?buscar=1`, que abre la lista con el teclado puesto). No es un campo de verdad: aquí se recorre, y filtrar filtraría algo que no está a la vista.

**Cuerpo:**
- **"Estás recorriendo"**: tarjeta del nodo actual con su icono de tipo, nombre, estado (punto de color) e IP, más un botón de 44 px que abre su **topología completa** (`/red/topologia/:id`), donde están las conexiones y su editor.
- **"Depende de"**, **"Si este equipo falla"** y **"Dependen de este equipo"**: el mismo bloque `NodoRed` que pinta la topología de un equipo. Aquí tocar un equipo **sustituye el nodo en su sitio** (`/red?nodo=<id>`) y el recorrido sigue en la misma pantalla; subir se hace por "Depende de", que es el camino real hacia arriba.
- Si el equipo **no tiene conexiones registradas**, lo dice y ofrece registrarlas.
- Al pie, dos filas-puerta: **"Todos los equipos de red por ubicación"** con su conteo (→ `/red/equipos`) y **"Mapa completo, desde cada raíz"** (→ `/red/topologia`). Las dos vuelven **al nodo que se estaba recorriendo**, no al nodo de entrada.

**El nodo se recuerda sin almacenamiento nuevo.** Viaja en `/red?nodo=<id>`, así que la **memoria de pestaña** (tarea 187) lo repone al volver de otra sección igual que repone el filtro de Guías. Si el equipo recordado ya no existe, o no hay memoria, la pestaña abre por la **raíz del bosque con más equipos colgando**: el rack o el switch de núcleo, que es por donde empiezan casi todos los recorridos.

**La ficha de un equipo de red es la misma** `DispositivoPage` (sección 5.3.1); solo cambia el retorno ("Volver" vuelve a Red).

#### 5.4.0 Equipos de red por ubicación (`EquiposRedPage`)

**Ruta:** `/red/equipos` · **Nivel:** Documento. Es la lista que antes era la raíz de la pestaña. Cabecera con título "Equipos de red", **"Crear"** y el **buscador** (placeholder "Equipo de red, IP, ubicación"); llegando por la puerta del buscador (`?buscar=1`) el campo arranca enfocado, llegando por la fila no, porque ahí se viene a mirar.

**Agrupa por la ENTIDAD Ubicación, no por el texto libre (hallazgo M-019).** Antes los grupos se formaban con `d.ubicacion`, que es una copia de referencia: "Rack 1" y "rack 1 " eran dos sitios distintos y el técnico no encontraba el equipo donde lo buscaba. Ahora la clave es `ubicacionId` y el nombre del grupo lo pone la entidad. El texto sigue siendo el respaldo, y hace falta: un equipo puede tener id con la fila de `ubicaciones` aún sin sincronizar (se usa su copia), y otro puede no tener id (se agrupa por el texto normalizado, sin acentos ni mayúsculas ni espacios de más, y el grupo toma la grafía más repetida). Los equipos sin ubicación van al final. **Nada de esto reescribe datos:** es lectura.

#### 5.4.1 Topología general (`TopologiaPage`)

**Ruta:** `/red/topologia` · **Nivel:** Documento. Árbol/bosque expandible de toda la red. Sin raíz muestra el bosque completo (racks y switches de núcleo). Buscador propio que expande las ramas necesarias, resalta coincidencias y hace scroll a la primera. Cada nodo lleva estado (punto de color) e icono según el medio de conexión con su padre. Enlace de impacto "+N" por fila que abre la topología de ese equipo.

#### 5.4.2 Topología de un equipo (`TopologiaEquipoPage`)

**Ruta:** `/red/topologia/:dispositivoId` · **Nivel:** Documento

**Cabecera:** "Volver" (a Topología), botón **"Abrir la ficha"**, e identidad del equipo (nombre, estado con punto de color, IP).

**Cuerpo:**
- **"Depende de"**: padres directos (dónde está instalado y los enlaces que RECIBE), navegables.
- **"Si este equipo falla"**: impacto por categoría en el tono de precaución ("También quedarían sin servicio N equipos") con chips por categoría.
- **"Dependen de este equipo"**: árbol expandible de descendientes, filas indentadas con caret, icono por tipo, detalle de conexión y punto de estado; marca con ↺ los nodos ya vistos (cortan ciclos).
- **"Conexiones"**: lista agrupada editable (Instalado en / Contiene / Enlaces / Relacionados) con botón **"Agregar"** que abre `FormularioConexion` (variante topología, con chips) y "X" para quitar cada conexión. Las filas de enlace muestran su dirección y el botón de invertirla, igual que en la ficha del equipo (tarea 208).

---

<a id="55-boveda"></a>
### 5.5 Bóveda

**Ruta:** `/boveda` · **Archivo:** `src/features/boveda/BovedaPage.tsx` (bajo `BovedaGuard`) · **Nivel:** Sección

Solo visible para usuarios con permiso `puede_ver_boveda`. La sección más sensible: la lista solo expone metadatos; los secretos se descifran únicamente al abrir una ficha, en el propio teléfono.

**Pantalla de bloqueo (`BovedaGuard`).** Al entrar, si la bóveda está bloqueada, aparece una pantalla centrada con candado, título "Bóveda" y:
- Si no tiene permiso: mensaje genérico de sección restringida (mínima exposición, sin revelar qué guarda).
- Si el equipo ya definió contraseña maestra (`verificar`): campo "Contraseña maestra" y botón "Desbloquear". Nota del autobloqueo por inactividad.
- Si aún no existe (`crear`): campo + confirmación + advertencia de que la contraseña quedará como la del equipo y es irrecuperable si se pierde.
- Si no se puede comprobar (offline sin verificador local): mensaje y botón "Reintentar".

**Lista (`BovedaPage`), cabecera:** la fila superior es la **barra superior global** (título "Bóveda", sincronización, lupa y cuenta; ver la sección 2). Debajo, lo propio de la sección:
- Subtítulo "Usuarios y contraseñas del equipo".
- **Botón "Bloquear ahora"** (icono candado).
- **Botón "Crear"**: abre la **hoja inferior "Guardar en la bóveda"** con los cinco tipos de secreto (Cuenta de sistema, Red, Llave digital, Archivo seguro, Nota segura); todos abren el mismo editor con `?tipo=`.
- **Buscador** (placeholder "Título, categoría o equipo").
- **Chips de categoría** (texto libre) con conteo, "Todas" incluida.

**Cuerpo:**
- **Aviso de rotación** (si hay secretos por vencer): "N secretos necesitan rotarse pronto".
- **Aviso de migración** (si hay candidatas, sin descifrar): "N secretos parecen ser de un solo equipo. Muévelos a su ficha." (→ `/boveda/migrar`).
- **Lista de secretos** (ordenados por urgencia de vencimiento): icono derivado de la categoría, título, detalle (categoría · N equipos con acceso), y dos controles de 44 px por fila: **copiar la contraseña** y el menú **"···"**.
- **Copiar la contraseña directo desde la fila** (tarea 205, hallazgo M-021, mockup `9b`): antes el gesto más frecuente de la sección ("copiar la clave del switch") exigía abrir el menú "···" y una hoja inferior, tres toques para el 80 % de las visitas. Ahora un botón de 44 px, separado 8 px de la fila enlazada (M-R14, no anida un control dentro de otro), descifra y copia al portapapeles sin abrir nada, registrando el acceso en la auditoría igual que siempre. El icono pasa a un check verde al copiar o a un aviso rojo si falla (sin desbloqueo, sin dato guardado, sin permiso del portapapeles), y vuelve solo a los 1,4 s. Copia siempre la CONTRASEÑA: el usuario y el resto de acciones (abrir, editar, eliminar) se quedan en el menú, porque no son gestos diarios.
- **La fila vencida dice CUÁNTO hace que venció** (tarea 205, hallazgo M-021), en vez de una pastilla que solo decía "Vencida": "Venció hace 3 días · CCTV", en rojo con icono de reloj, ocupando el sitio donde antes iba la categoría sola. No es lo mismo venció ayer que hace medio año. La fila "próxima a vencer" conserva su pastilla ámbar "Vence pronto"; el orden de la lista (vencidas primero) no cambió, ya lo hacía.
- **Menú "···" de una fila** (hoja inferior, ahora "Más acciones"): **Copiar usuario** y **Copiar contraseña** (sin mostrarla; descifra al momento y registra en la auditoría), **Abrir la ficha**, **Editar**, **Eliminar** (pide contraseña maestra).
- **Autobloqueo por inactividad** (pie): chips 1/5/15/30 min.

#### 5.5.1 Ficha de credencial (`CredencialPage`)

**Ruta:** `/boveda/:credencialId` · **Nivel:** Documento. Descifra el secreto en el propio teléfono.

**Cabecera:** "Volver" (a Bóveda), **Editar**, **Eliminar** (icono, sensible).

**Cuerpo:**
- Título, línea meta (categoría · modificada el DD mmm HH:MM), **indicador de vencimiento**, y línea "Último acceso" (cada consulta queda registrada).
- **Tarjeta de campos**: cada fila con etiqueta, valor monoespaciado, **ojo** (mostrar/ocultar los secretos; mostrar la contraseña registra en auditoría) y **copiar** (con confirmación). Incluye Usuario, Contraseña (oculta), IP heredada (con aviso), extras cifrados, y **URL** como enlace, y **Archivo seguro** (botón descargar que descifra bajo demanda).
- **Notas**.
- **"Da acceso a"**: equipos vinculados (nombre vivo), navegables.
- **"Usada en"**: procedimientos que muestran esta credencial en algún paso (derivado del grafo).
- **"Actividad"**: auditoría de la bóveda + historial de cambios en una sola línea de tiempo (consultó, mostró, copió usuario/contraseña, modificó, eliminó, descargó).

#### 5.5.2 Editor de credencial (`CredencialForm`)

Ver campo por campo en la sección 7. Selector de tipo de secreto que decide qué campos aparecen; avisos anti duplicidad; vínculo con equipos; vencimiento; archivo cifrado.

<a id="56-mas"></a>
### 5.6 Más

**Ruta:** `/mas` · **Archivo:** `src/features/mas/PantallaMas.tsx` · **Nivel:** Sección

**Nueva desde la tarea 182** (mockup `3f` del handoff "Auditoría de Soluciones TI"). Quinta pestaña móvil: la puerta de los ocho destinos que hasta esa tarea no aparecían ni en la barra ni en el sidebar, así que un técnico nuevo no podía encontrarlos sin que alguien se los mostrara (regla **R15**, "todo destino tiene puerta"). La Bóveda deja de ser pestaña y encabeza el primer grupo (decisión aprobada por el usuario en `Decisiones aprobadas.md`).

**Cabecera:** la fila superior es la **barra superior global** (título "Más", sincronización, lupa y cuenta; ver la sección 2). Sin controles propios en la banda de debajo: esta pantalla es solo un índice.

**Cuerpo, en grupos:**
- **"Consulta protegida"** (solo con permiso `puede_ver_boveda`): fila destacada de **Bóveda** ("Claves y credenciales del equipo"), con el mismo tratamiento visual que la tarjeta de "Diagnóstico en curso" (borde y fondo en acento), porque es la única entrada que exige un permiso.
- **"Herramientas"**: **Diagnóstico** ("Del síntoma a la guía, paso a paso") y **Escanear equipo** ("Abre la ficha por código QR").
- **"Registros"**: **Ubicaciones** ("Sedes, salas y racks · N", conteo en vivo), **Personas** ("Responsables de cada equipo · N", conteo en vivo), **Etiquetas QR** y **Importar** (misma pantalla que el menú "···" de Equipos, ahora con puerta propia).
- **"Mi cuenta"**: fila de perfil (avatar con iniciales, nombre, correo → `/cuenta`) y **"Bloqueo y seguridad"** (→ `/cuenta/seguridad`), con subtítulo que dice el método configurado y si está activo o inactivo, leído en vivo de `db.seguridadApp`.

**Volver.** Ubicaciones y Personas, alcanzadas ahora desde aquí, suben a "Más" (no a Equipos): antes su regreso llevaba a una sección que el técnico no había visitado si llegaba por un enlace o por esta pantalla (mismo defecto que el problema #3 del turno 3 de la auditoría). Diagnóstico y Escanear siguen subiendo a Inicio (su puerta original, que se conserva); Etiquetas e Importar siguen subiendo a Equipos, porque su camino principal sigue siendo el menú "···" de esa sección.

**Escritorio:** el sidebar no ofrece "Más" (no lo necesita: sigue mostrando Bóveda como destino propio en su nav principal). Desde la tarea 183 el sidebar completo de 14 destinos da puerta propia en escritorio a Diagnóstico, Escanear, Ubicaciones y Personas (grupos "Herramientas"/"Registros"), y Mi cuenta vive al pie. Etiquetas QR e Importar siguen alcanzándose solo desde el "···" de Equipos en ambas anchuras.

---

<a id="6-secciones-secundarias"></a>
## 6. Secciones secundarias

<a id="61-diagnostico-inteligente"></a>
### 6.1 Diagnóstico Inteligente

**Ruta:** `/diagnostico` · **Archivo:** `src/features/diagnostico/DiagnosticosPage.tsx` · **Shell:** centrado

**Objetivo.** El técnico no piensa en el nombre de un procedimiento sino en el problema ("la impresora no imprime"). Cada fila ES un problema; tocarlo abre el asistente guiado.

**Lista (`DiagnosticosPage`):**
- Cabecera: "Volver a Inicio", **botón "Crear"** (→ `/diagnostico/nuevo`, hereda categoría si se llega filtrado), título "Diagnóstico inteligente", enlaces **"Sugerencias del equipo"** y **"Estadísticas"**, y **buscador** (placeholder "Describir el problema: no imprime, sin red...").
- Banner "Solo: {Categoría}" cuando se llega filtrado (`?categoria=<id>`), con "Ver todos".
- **"Diagnóstico en curso"** (si hay sesión a medias): tarjeta destacada para retomar.
- **Problemas agrupados por categoría** (icono con color, filas con icono de alerta, título, descripción, **estrella de favorito** y flecha).
- Estados vacíos: "Todavía no hay diagnósticos" (con "Crear diagnóstico") o "Ningún problema coincide" (con "Ir a Guías").

**Asistente de ejecución (`DiagnosticoRunPage`).** Ruta `/diagnostico/:diagnosticoId`, nivel Tarea (sin barra de pestañas). Arranca directo en la primera pregunta (auto-inicio). Barra de tarea ("Diagnosticando", el problema, vuelve a Diagnósticos; la X guarda el avance), botón editar y **barra de progreso** ("Pregunta N" / "Completado").
- **Pregunta**: título grande, descripción opcional, y una lista de opciones tocables (cada una puede indicar "Ejecuta: {procedimiento}").
- Al responder una opción que ejecuta un procedimiento: se abre `AsistenteVista` (modo asistente) inline; al completarlo, el diagnóstico continúa solo.
- **"Atrás" junto a la pregunta, como icono** (tarea 205, hallazgo M-026, regla M-R12): antes "Volver" y "Cancelar" compartían fila, tamaño y estilo fantasma de 13 px en la zona del pulgar, así que un toque a 8 px del correcto perdía un diagnóstico a medias sin que nada en la forma lo advirtiera. Volver es reversible, así que se queda arriba, pegado al contenido de la pregunta (o del procedimiento en ejecución), como un icono de 44 px sin texto.
- **"Cancelar" deja de ser un botón y sale de la zona del pulgar** (tarea 205, hallazgo M-026, regla M-R12: lo irreversible no comparte forma con lo reversible). Se convierte en la frase "Salir guarda el avance. **Descartar este diagnóstico**", en texto pequeño y apagado al pie de la pantalla; el enlace en rojo abre la misma confirmación de siempre ("El avance se descarta y queda registrado como abandonado").
- **Resultado final**: mensaje, "Camino recorrido", procedimientos ejecutados, y la pregunta **"¿Quedó resuelto el problema?"** con "Sí, resuelto" / "No". Si "No", pide el **motivo** (no funcionó / no encontró el problema / faltan pasos / encontré otra solución / otro) y, si es "encontré otra solución", un **texto libre** que alimenta las Sugerencias del equipo.

**Editor de diagnóstico (`DiagnosticoForm`).** Ver campo por campo en la sección 7. Árbol de preguntas (nodos y opciones), botón "Probar" (recorrido en memoria), validación de ramas sueltas/ciclos/inalcanzables, aviso de vínculos rotos.

<a id="62-escaner"></a>
### 6.2 Escáner

**Ruta:** `/escaner` · **Archivo:** `src/features/escaner/EscanerPage.tsx` · **Nivel:** Tarea (cámara a pantalla completa)

**Objetivo.** Leer códigos QR (URL de la ficha) y códigos de barras (placa/serial) con la cámara trasera para abrir la ficha de un dispositivo. Usa el detector nativo (`BarcodeDetector`) o cae a jsQR.

**Elementos:**
- Cabecera: barra de tarea ("Escaneando · Código QR o de barras"), **contador de la sesión** y botón **"Linterna"** (si el dispositivo la soporta).
- **Contador "N leídos"** (tarea 202, hallazgo M-029): cuántos equipos distintos se han identificado sin salir del escáner. Sobrevive a abrir una ficha y volver. **Se reinicia tocándolo**, y también al cerrar la aplicación; no se reinicia solo por entrar de nuevo ([DECISIONES.md](DECISIONES.md) AD-031). Los repetidos no suman: apuntar dos veces a la misma etiqueta no es haber inventariado dos equipos.
- Marco de escaneo con línea animada y texto guía.
- Estados de fallo: sin permiso / sin cámara / no soportado, cada uno con mensaje y la alternativa de búsqueda manual.
- **Búsqueda manual** (barra inferior): input "O escribir la placa o el serial" + botón "Buscar".
- **Tarjetas de aviso** (reemplazan la barra al haber resultado):
  - **"Equipo identificado"** (encontrado): nombre y ubicación; **su estado y su IP** (tarea 202: muchas veces son lo único que se venía a mirar, y sacarlos aquí ahorra abrir la ficha entera); botones **"Abrir la ficha"** y **"Seguir"**, con la promesa escrita **"La ficha vuelve aquí al terminar"**.
  - **"Varios equipos comparten este código"**: lista de opciones + "Seguir escaneando".
  - **"Ningún equipo coincide con este código"**: muestra el código, botones "Seguir escaneando" y "Registrar equipo" (este último precarga el código leído como serial en el alta, `?serial=`, salvo que sea una URL de etiqueta; hallazgo H3).

**El escáner queda como origen (tarea 202, hallazgo M-029).** Hasta ahora "Abrir la ficha" **reemplazaba** el escáner en el historial y la ficha volvía a Equipos, así que inventariar diez equipos de un rack costaba cuatro toques por equipo en vez de dos: había que volver a entrar por "Más". Ahora la ficha se apila encima y su regreso dice **"‹ Escáner"**, con la cámara viva y el conteo intacto. Lo mismo con "Registrar equipo" y con la lista de "Varios equipos".

<a id="63-ubicaciones"></a>
### 6.3 Ubicaciones

**Ruta:** `/ubicaciones` · **Archivo:** `src/features/ubicaciones/UbicacionesPage.tsx` · **Shell:** centrado (bajo "Más" desde la tarea 182; antes bajo Equipos, ver [DECISIONES.md](DECISIONES.md))

**Objetivo.** El lugar físico como entidad propia (con jerarquía opcional Sede > Área > Punto), que reemplaza el texto libre de ubicación.

**Lista:** cabecera "Volver a Más", **botón "Crear"** (creación inline: nombre + chips de ubicación padre), **buscador** ("Buscar un lugar"). Aviso de migración (si hay equipos con la ubicación como texto → `/ubicaciones/migrar`). Árbol con sangría por jerarquía: icono House (raíz) o MapPin, nombre, conteo de equipos, flecha.

**Ficha (`UbicacionPage`), vista 360°:** ancestros (ruta jerárquica), sub-ubicaciones, "equipos en este lugar" (inverso de `ubicacion_id`), acciones editar/crear sub-ubicación, e historial. Botones para crear sub-ubicación (`?padre=<id>`).

**Formulario (`UbicacionForm`):** ver sección 7. **Migración asistida (`MigracionUbicaciones`):** convierte los textos de ubicación existentes en entidades, fusionando variantes por nombre; idempotente.

<a id="64-personas"></a>
### 6.4 Personas

**Ruta:** `/personas` · **Archivo:** `src/features/personas/PersonasPage.tsx` · **Shell:** centrado (bajo "Más" desde la tarea 182; antes bajo Equipos)

**Objetivo.** El responsable de un equipo como entidad propia (sin jerarquía, a diferencia de ubicaciones). Mismo patrón que Ubicaciones: lista plana con creación inline y buscador, aviso de migración, **ficha 360°** (`PersonaPage`) con los equipos asignados a esa persona e historial, **formulario** (`PersonaForm`, ver sección 7) y **migración asistida** (`MigracionPersonas`).

<a id="65-ficha-de-categoria"></a>
### 6.5 Ficha de categoría (`CategoriaPage`)

**Ruta:** `/soluciones/:categoriaId` · **Nivel:** Documento (bajo Guías)

Reúne todo lo que pertenece a una categoría en una vista 360°: cabecera con el icono en su color de identidad, nombre y resumen (N artículos · N equipos · N diagnósticos), **botón "Artículo"** para crear. Cuerpo: artículos agrupados por tipo (con chip de avance X/Y en los que están a medias), "Equipos de esta categoría" (con estado), "Diagnósticos de esta categoría", e historial. Se alcanza desde el buscador global y desde la ficha de un equipo.

<a id="66-mi-cuenta-y-seguridad"></a>
### 6.6 Mi cuenta y Seguridad de la aplicación

**Mi cuenta (`CuentaPage`).** Ruta `/cuenta`, nivel Documento. Muestra nombre y correo del técnico. **Formulario "Cambiar contraseña de inicio de sesión"** (requiere internet): campos Contraseña actual / Nueva / Confirmar, y botón "Cambiar contraseña". Tarjeta **"Instalar la app en este dispositivo"** (tarea 184) con el mismo botón que la bienvenida (`BotonInstalarApp`): solo aparece mientras la app **no** corra ya instalada, y es el segundo de los dos únicos sitios desde donde se ofrece instalar (nunca como banner). Enlace a **"Seguridad de la aplicación"**. Botón **"Cerrar sesión"**. Desde la tarea 182 también se alcanza con un toque desde el avatar de la barra superior (en móvil) o desde la fila de perfil de "Más".

**Seguridad de la aplicación (`SeguridadPage`).** Ruta `/cuenta/seguridad`, nivel Documento. Configura el **bloqueo del dispositivo** (patrón o contraseña, nunca biometría), una capa distinta de la sesión y de la contraseña maestra.
- **Sin configurar:** invitación + selector de método (Patrón / Contraseña) + captura del secreto con confirmación.
- **Configurado:** tarjeta "Bloqueo activo" (método), botón **"Bloquear ahora"**, selector de **Autobloqueo por inactividad**, y botones **"Cambiar"** y **"Quitar bloqueo"** (ambos piden el secreto actual).
- El patrón se dibuja en una cuadrícula 3x3 (`PatronInput`); la contraseña, mínimo 4 caracteres.

<a id="67-etiquetas-e-importacion"></a>
### 6.7 Etiquetas QR e Importación

Ambas se alcanzaban solo desde el menú "···" de Equipos; desde la tarea 182 tienen además puerta propia en "Más" (grupo "Registros"). Su "Volver" sigue subiendo a Equipos, que sigue siendo su camino principal.

**Etiquetas QR (`EtiquetasPage`).** Ruta `/dispositivos/etiquetas`, nivel Tarea. Genera etiquetas QR imprimibles (cada una codifica la URL de la ficha). Barra de tarea ("Imprimiendo · Etiquetas QR", vuelve a Equipos) y **chips de categoría**. Cada tarjeta es seleccionable (casilla): miniatura del QR, nombre, código (placa/serial) y ubicación. Botones **"Seleccionar/Quitar todas"** y, en la barra inferior, **"Imprimir N"** (3 etiquetas por fila en hoja carta, la hoja impresa pasa a blanco).

**Importación masiva (`ImportarDispositivosPage`).** Ruta `/dispositivos/importar`, nivel Tarea. Flujo de **3 pasos**:
1. **Elegir archivo** (.xlsx o .csv). Reconoce encabezados parecidos ("No. de serie" = Serial, "Sede" = Ubicación). Enlace **"Descargar plantilla CSV de ejemplo"**.
2. **Revisar**: columnas detectadas (campo o "propiedad del equipo"), selector de categoría para filas sin ella, contadores "nuevos" / "se omiten" (por serial/placa ya registrados), lista desplegable de filas omitidas y vista previa de las primeras filas. Barra inferior: "Cancelar" / "Importar N dispositivos".
3. **Importando / Terminado**: barra de progreso; al final "N dispositivos importados", botón "Ver dispositivos" e "Importar otro archivo". Cada equipo queda con la nota del archivo de origen en su historial.

<a id="68-estadisticas-y-sugerencias"></a>
### 6.8 Estadísticas y Sugerencias del equipo

**Estadísticas de diagnóstico (`EstadisticasPage`).** Ruta `/diagnostico/estadisticas`, nivel Documento. Agrega `ejecuciones_diagnostico`:
- **Tarjetas de resumen** (rejilla de 4): Ejecuciones, Tasa de éxito (sobre las cerradas), Duración típica (cuando se resuelve), Abandonados.
- **"Problemas más frecuentes"**: título, veces, tasa de éxito (enlace al diagnóstico si sigue vivo).
- **"Procedimientos más usados"**: título y veces (enlace al artículo).
- **"Por qué no queda resuelto"**: motivos de fallo con conteo, y enlace a las sugerencias del equipo.
- Estado vacío si no hay ejecuciones.

**Sugerencias del equipo (`SugerenciasEquipoPage`).** Ruta `/diagnostico/sugerencias`, nivel Documento. Lista los textos libres que dejaron los técnicos cuando marcaron "Encontré otra solución". Cada tarjeta: diagnóstico de origen, fecha, texto propuesto, quién lo reportó, y **botón "Redactar artículo"** (→ editor precargado `?desdeSugerencia=<id>`) o, si ya se redactó, "Ya redactada: {título}" con enlace al artículo (cierra el bucle para no duplicar trabajo).

<a id="69-autenticacion"></a>
### 6.9 Autenticación (login) y actualización

**Login (`LoginPage`).** Ruta `/login`, fuera de la zona autenticada. **Rediseñado en la tarea 184** (mockup `3b` del handoff): antes decía el nombre de la app y "Inicia sesión para continuar", y nada más, siendo la primera pantalla que ve un técnico nuevo.
- **Se presenta:** glifo de la marca (`Marca`, el cerebro, en un cuadro de 52 px delineado en acento), título "Soluciones IT" y una línea de qué es esto: "La base de conocimiento del equipo de soporte y mantenimiento de TI." **No nombra a la organización** a propósito ([DECISIONES.md](DECISIONES.md) AD-025).
- **Campos:** **Correo** (`type="email"`, placeholder "tu@correo.com") y **Contraseña** (`CampoContrasena`), con botón "Ingresar" de 52 px.
- **"¿La olvidaste?"** en la fila del rótulo de Contraseña, con 44 px reales de zona táctil (regla R6; el mockup lo dibuja de 18). **No envía correos de recuperación**: abre un modal que dice el camino real, pedirle al administrador una contraseña nueva desde el panel de Supabase, igual que con la primera (AD-025). También recuerda que el bloqueo del teléfono es otra cosa y se resuelve en su propia pantalla.
- **A quién pedir acceso:** "¿Sin cuenta? Pídesela al administrador de la app. Todo queda guardado en este teléfono, así que funciona sin señal."
- **Autocompletado:** el **correo sí** se autocompleta (`autoComplete="username"`); la contraseña sigue fuera del gestor (lo garantiza `CampoContrasena`, que usa texto enmascarado por CSS para que el llavero no reconozca el formulario como un login). El `autoComplete="off"` que llevaba el `<form>` se retiró: puesto ahí anulaba también la pista del correo.
- Aviso si Supabase no está configurado.

**Aviso de actualización (`ActualizacionDisponible`).** Componente global. Cuando se publica una versión nueva, muestra un aviso discreto "Versión nueva disponible" con botón "Actualizar" (activa el nuevo service worker y recarga sin interrumpir un procedimiento a medias). Se comprueba al abrir y cada hora. Al pulsar, el botón pasa a "Actualizando..." y queda deshabilitado; la recarga ocurre en cuanto el service worker nuevo toma el control, y de todos modos pasados 2,5 segundos, así que el botón nunca se queda sin efecto (corregido el 2026-07-27, ver [COMPONENTES_UI.md](COMPONENTES_UI.md) 2.1).

---

<a id="7-catalogo-de-formularios"></a>
## 7. Catálogo de formularios (campo por campo)

Convenciones: **Obligatorio** = validado antes de guardar. La app prioriza guardar sobre bloquear: casi todos los formularios exigen solo lo mínimo (un nombre o título) y el resto se completa después. Las primitivas de campo (`CLASE_CAMPO`, `<Campo>`, `<CampoConSugerencias>`, `<CamposClaveValor>`) viven en `src/components/campos.tsx`.

### 7.1 Editor de dispositivo (`DispositivoForm`)

Archivo `src/features/dispositivos/DispositivoForm.tsx`. Título dinámico "Nuevo/Editar dispositivo". El `id` se decide al montar (estable). Guarda con `guardarRegistro('dispositivos', ...)`.

| Campo visible | Interno | Tipo de control | Oblig. | Defecto | Placeholder / opciones | Validaciones / notas |
|---------------|---------|-----------------|--------|---------|------------------------|----------------------|
| Nombre | `nombre` | Texto | **Sí** | vacío (o `?nombre=`) | "Qué es y dónde está: Zebra ZT411 · Bodega central" | No vacío. Alimenta buscador y QR. Se precarga desde el buscador de Inicio sin resultados (H9) |
| Categoría | `categoriaId` | Chips (una selección) | **Sí** | vacío | categorías vivas; con `?red=1` las de red van primero | Debe elegirse una |
| Marca | `marca` | Texto con sugerencias (datalist) | No | vacío | "Zebra, HP, Cisco..." | Sugiere marcas ya usadas |
| Modelo | `modelo` | Texto | No | vacío | "ZT411" | - |
| Foto | `foto` | Carga de imagen | No | null | slot 96x64 | Se comprime y sube al elegir; cola offline; dedup por hash. No se copia al duplicar |
| Número de serie | `serial` | Texto monoespaciado | No | vacío (o `?serial=`) | - | Aviso si ya existe en otro equipo (enlace a esa ficha). Se precarga con el código leído por el escáner (H3) |
| Placa de inventario | `placaInventario` | Texto monoespaciado | No | vacío | - | - |
| Ubicación | `ubicacionId` / `ubicacion` | Selector de ubicación (buscar/crear/texto) | No | null | `SelectorUbicacion` | Elige entidad registrada, crea inline o texto libre de respaldo |
| Responsable | `responsableId` / `responsable` | Selector de persona (buscar/crear/texto) | No | null | `SelectorPersona` | Igual que ubicación |
| Dirección IP | `ip` | Texto (inputMode decimal) | No | vacío | "192.168.1.10" | Valida forma IPv4 (aviso, no bloquea); aviso si duplicada en otro equipo |
| Estado | `estado` | Chips con punto de color | No | "Operativo" (nuevo) | Operativo / En mantenimiento / Fuera de servicio / De baja | Texto libre; los 4 sugeridos con color |
| Observaciones | `observaciones` | Área de texto (plegable "Más información") | No | vacío | "Qué imprime, cada cuánto se mantiene..." | - |
| Propiedades de {categoría} | `detalles` | Editor clave/valor (plegable) | No | {} | sugiere claves de otros equipos de la misma categoría | Pares libres; se descartan las claves vacías al guardar |
| Motivo del cambio | `motivo` | Texto (plegable, solo edición) | No | vacío | "Por qué se actualizó esta ficha" | Va al historial |

Barra inferior fija: aviso de validación + botón **"Guardar dispositivo"** (atenuado si falta nombre o categoría). En modo reemplazo, tras guardar encadena a `/reemplazo`; recién creado abre la ficha con el bloque "¿Qué sigue?".

### 7.2 Editor de artículo (`ArticuloForm`)

Archivo `src/features/soluciones/ArticuloForm.tsx`. Editor a pantalla completa con **cuatro pestañas** de 52 px dentro de un contenedor pegajoso. El estado vive todo en el componente (cambiar de pestaña no pierde nada; un solo guardado). Cabecera de tarea ("Editando" o "Creando", el título del artículo y la ruta de vuelta escrita) y pastilla de estado en la banda de debajo. Cada pestaña marca con un punto si tiene algo pendiente. Barra inferior con la **barra de añadir** del editor de pasos (solo en la pestaña Pasos, ver 7.2.1), **completitud %** (10 señales), lista de **sugerencias** tocables (cada una lleva a su pestaña), y dos acciones de 56 px: **"Guardar"** y, a su izquierda, **"Vista previa"** o **"Probar"**.

**"Probar"** (tarea 209): dentro de la pestaña Pasos y con al menos un paso escrito, "Vista previa" se convierte en "Probar", que abre un diálogo ("Probar el paso N", "sin salir del editor y sin guardar") y de ahí a la misma vista previa, ya **abierta y puesta en ese paso**. Cierra el hueco de que el autor nunca veía su propio trabajo como lo verá el técnico sin recorrer el artículo entero.

**Pestaña General** (de qué trata y cómo se encuentra):

| Campo | Interno | Control | Oblig. | Defecto | Notas |
|-------|---------|---------|--------|---------|-------|
| Tipo de documento | `tipo` | Rejilla de 6 (una selección) | - | manual (o `?tipo=`) | instalación, configuración, conexión, problema frecuente, mantenimiento, manual |
| Título | `titulo` | Texto | **Sí** | vacío | Aviso de artículos similares (anti duplicados); al enviar vacío salta a General y marca el campo |
| ¿Cuándo usar este procedimiento? | `descripcion` | Área de texto | No | vacío | Se muestra bajo el título e indexa en búsqueda |
| Objetivo general (1 línea) | `objetivoGeneral` | Texto | No | vacío | Qué se logra al completar todo |
| Etiquetas | `etiquetas` | Editor de chips + sugerencias | No | [] | Enter/coma agregan; chips de sugerencia del vocabulario ya usado |
| Imagen de portada | `portada` | Carga de imagen | No | null | Identifica el artículo en lista y buscador |
| Equipos donde aplica | `dispositivosAfectados` | Selector múltiple (chips + select) | No | [] | Marca el artículo como **específico** de esos equipos. Publicado, ya aparece por **categoría** en las fichas aunque se deje vacío (aclarado en la ayuda del campo, H1/H2) |
| Restringir a marca o modelo (opcional) | `aplicaA.marca` / `aplicaA.modelo` | Dos textos con sugerencias (datalist) | No | null (sin restricción) | "Cualquier marca" / "Cualquier modelo" | Refina "de esta categoría" (H1) a un modelo concreto (hallazgo H6). Vacíos: aplica a toda la categoría. Sugerencias tomadas del inventario. Se copia al duplicar el artículo |

**Pestaña Pasos** (lo que se ejecuta):

| Campo | Interno | Control | Notas |
|-------|---------|---------|-------|
| Antes de empezar (un requisito por línea) | `requisitos` | Área de texto | Una línea = un requisito |
| Pasos | `pasos` | `PasosEditor` (ver 7.2.1) | Constructor de pasos con bloques |
| Verificación final (una por línea) | `verificacionFinal` | Área de texto | Checklist final |

**Pestaña Detalles** (ayuda a decidir si sirve):

| Campo | Interno | Control | Notas |
|-------|---------|---------|-------|
| Síntomas (uno por línea) | `sintomas` | Área de texto | Solo se muestra si tipo = problema frecuente |
| Posibles causas (una por línea) | `causas` | Área de texto | Idem |
| Tiempo (min) | `tiempoEstimadoMin` | Número | Sin flechas de incremento |
| Dificultad | `dificultad` | Control segmentado | Principiante / Intermedio / Avanzado (toca de nuevo para deseleccionar) |
| Artículos relacionados | `relacionados` | Chips + select | Copia de referencia {id, título} |
| Notas adicionales (admite Markdown) | `contenido` | Área de texto monoespaciada | Se renderiza como Markdown en la ficha |

**Pestaña Publicación** (quién lo ve y cómo queda registrado):

| Campo | Interno | Control | Notas |
|-------|---------|---------|-------|
| Estado | `estado` | Control segmentado | Borrador / Publicado / Obsoleto |
| Destacar en Inicio como ruta de aprendizaje | `esRutaInicio` | Casilla | Al marcar aparece el orden |
| Orden en la ruta de Inicio | `ordenRutaInicio` | Número | Menor primero; solo si es ruta de inicio |
| Es un cambio mayor | `cambioMayor` | Casilla | Solo al editar un publicado; sube la versión mayor |
| Motivo del cambio | `motivo` | Texto | Solo edición; va al historial |

#### 7.2.1 Editor de pasos (`PasosEditor`)

Cada **paso** es una tarjeta con: **asa de arrastre**, número, **Título** ("Qué hacer en este paso"), **Objetivo** ("qué se logra al terminar") y un menú **"···"** (Subir / Bajar / Eliminar, con confirmación). El **cuerpo** del paso son **bloques**.

**Paso activo** (tarea 209): la tarjeta que se acaba de tocar lleva borde de acento. Es la que reciben la barra de añadir y "Probar". Si no se ha tocado ninguna, manda la última, que es donde se está escribiendo.

**Reordenar** (tarea 209): se arrastra por el asa (44x48, con eventos de puntero, así que funciona con dedo, ratón y lápiz; no usa la API de arrastre de HTML5, que no existe en móvil). Durante el arrastre la tarjeta agarrada sigue al dedo y las de en medio se apartan para abrir el hueco; el orden se aplica al soltar. El asa también acepta **flecha arriba / flecha abajo** (±1), que es el camino sin puntero, y el menú "···" conserva Subir/Bajar. Antes reordenar era solo ±1: llevar el paso 6 al 2 eran cuatro toques en un botón de 32 px.

**Barra de añadir** (tarea 209): cuatro botones de 56 px (**Tarea**, **Aviso**, **Foto**, **Reusar**) fijos al pie, dentro de la misma barra de la acción principal, que actúan sobre el paso activo. Antes vivían dentro de la tarjeta, en `flex-wrap`, con 31 px de alto y cambiando de sitio según lo largo que fuera el paso. "Reusar" (H4) abre los "Vínculos del paso", donde vive "Procedimiento relacionado".

- **Bloque Tarea**: **pastilla etiquetada de 56 px** que dice el tipo ("Acción", "Verif.", "Decisión") y abre una hoja con los tres descritos (`HojaTipoBloque`), + texto. Antes era un icono de 18 px que **ciclaba a ciegas**: no decía qué venía después, así que pasarse costaba dos toques más. Enter inserta otra tarea; pegar varias líneas las reparte. Una **Decisión** puede vincular "Si responde No" un artículo, con buscador (`HojaVinculo`, tarea 212); salir del tipo Decisión suelta ese vínculo. Cada tarea puede llevar además un vínculo protegido.
- **Bloque Aviso**: pastilla con la palabra corta del tono ("Info", "Cuidado", "Alerta", "Consejo", "Dato") que abre la misma hoja con los cinco tonos y su explicación, + área de texto de 3 líneas. Antes el icono ciclaba los cinco tonos, uno por toque.
- **Bloque Imagen**: slot para subir una captura + pie opcional.
- **Quitar una línea**: la X mide **48x56** (antes 32).
- **Archivos del paso completo**: "Adjuntar archivo del paso: manual, PDF o planilla" (distinto de las imágenes ancladas a una tarea).
- **Vínculos del paso** (bloque plegable "Vínculos: dato protegido, procedimiento o solución"), cada uno abre `HojaVinculo` (tarea 212: hoja con buscador, en vez del `<select>` nativo que abría la rueda del sistema y no se podía filtrar):
  - **"Vincular información protegida"**: datos protegidos de los equipos del artículo, y secretos de la bóveda, en dos grupos con encabezado.
  - **"Procedimiento relacionado"** (subprocedimiento que se ejecuta en este paso).
  - **"Solución si el paso falla"**.

### 7.3 Editor de credencial (`CredencialForm`)

Archivo `src/features/boveda/CredencialForm.tsx`. Título "Nuevo/Editar secreto". Cabecera con "Se guarda cifrada". El tipo decide qué campos aparecen (`CAMPOS_POR_TIPO`); botón "Mostrar todos los campos" los revela sin perder nada. Todo lo del bloque "Secreto" viaja **cifrado** (`datos_cifrados`); vencimiento y equipos NO se cifran (para avisar/navegar sin desbloquear).

| Campo | Interno | Control | Oblig. | Notas |
|-------|---------|---------|--------|-------|
| Tipo de secreto | `tipo` | Lista desplegable | - | Cuenta de sistema / Red / Llave digital / Archivo seguro / Nota segura. Cambia los campos visibles y el placeholder del título |
| Título | `titulo` | Texto | **Sí** | Placeholder según tipo. Avisos: coincide con un equipo del inventario ("Ir a la ficha"); título desactualizado si el equipo se renombró |
| Categoría | `categoria` | Texto con sugerencias | No | "Redes, Servidores, CCTV..." |
| Usuario | (en `datosCifrados`) | Texto monoespaciado | No | Solo tipo cuenta (o "Mostrar todos") |
| Contraseña / Clave | (cifrado) | `CampoContrasena` enmascarado + ojo + **"Generar"** | No | "Generar" crea 16 caracteres sin ambiguos (O/0, l/1). Etiqueta varía por tipo |
| URL | (cifrado) | Texto monoespaciado | No | "https://...". Aviso si coincide con la IP/URL de un equipo ("Vincular equipo") |
| Otros datos protegidos | (cifrado) | Editor clave/valor monoespaciado | No | "Puerto, PIN, clave WiFi..." también cifrados |
| Archivo | `archivo` | Carga de archivo (cifrado) | No | Solo tipo archivo. Se cifra en el teléfono al elegirlo, bucket privado |
| Notas | (cifrado) | Área de texto | No | "Cómo y cuándo se usa" |
| Vencimiento (opcional) | `venceEn` | Fecha | No | Sin cifrar. Aviso si la contraseña cambió pero el vencimiento no ("Renovar 90 días") |
| Equipos con acceso | `dispositivos` | Chips + select | No | Copia de referencia {id, nombre}. Aviso de solapamiento con contraseña protegida del equipo |
| Motivo del cambio | `motivo` | Texto | No | Solo edición |

Barra inferior: **"Guardar secreto"**. Si el autobloqueo cierra la bóveda durante la edición, avisa que hay que desbloquear de nuevo.

### 7.4 Datos protegidos del equipo (`SeguridadDelEquipo` / `EditorCampo`)

Archivo `src/features/dispositivos/SeguridadDelEquipo.tsx`. Vive en la sección "Seguridad" de la ficha del equipo (no en `DispositivoForm`). Solo con permiso de bóveda; guardar exige la bóveda desbloqueada (formulario de desbloqueo inline si está cerrada). Nombre y tipo van SIN cifrar; solo el valor se cifra.

| Campo | Interno | Control | Oblig. | Notas |
|-------|---------|---------|--------|-------|
| Nombre | `nombre` | Texto | **Sí** | "Usuario administrador, PIN de impresión...". No duplicado dentro del equipo |
| Tipo | `tipo` | Lista desplegable | - | usuario / contraseña / PIN / llave / token / texto |
| Valor | `valorCifrado` | `CampoContrasena` + ojo + **"Generar"** (si oculto por defecto) | No | Se cifra al guardar |
| Vencimiento (opcional) | `venceEn` | Fecha | No | Recordatorio de rotación |
| Motivo del cambio | `motivo` | Texto | No | Solo edición |

Botón **"Guardar"**. Cada fila de la lista muestra nombre y tipo; al desplegar (con bóveda abierta) muestra el valor con `CampoSecreto` (mostrar/ocultar y copiar con auditoría), botones Editar/Eliminar, "Usado en" e historial por campo.

### 7.5 Editor de diagnóstico (`DiagnosticoForm`)

Archivo `src/features/diagnostico/DiagnosticoForm.tsx`. Pantalla completa.

| Campo | Interno | Control | Oblig. | Notas |
|-------|---------|---------|--------|-------|
| Problema | `titulo` | Texto | **Sí** | "Como lo diría el técnico: La impresora no imprime". Aviso de similares (artículo o diagnóstico) |
| Categoría | `categoriaId` | Chips | **Sí** | Con color de identidad |
| Descripción (opcional) | `descripcion` | Texto | No | Una línea para reconocer el problema |
| Preguntas | `nodos` | Editor de árbol (`NodosEditor`) | - | Ver abajo |
| Motivo del cambio | `motivo` | Texto | No | Solo edición |

**Editor de preguntas (`NodosEditor`).** Lista de tarjetas; la primera es "Inicio del diagnóstico". Cada tarjeta: menú "···" (Subir/Bajar/Duplicar/Eliminar), campo **Pregunta** ("¿La impresora está encendida?"), campo **descripción** ("Cómo comprobarlo, opcional"), y una lista de **Respuestas** (botón "Respuesta" para agregar). Cada respuesta tiene: **etiqueta** ("Sí, No, otra..."), un **destino** (select: "Termina aquí" o "Sigue en la pregunta N"), un **mensaje final** (si termina) y opcionalmente **"Vincular procedimiento"** (ejecuta un artículo). Botón "Agregar pregunta".

Barra inferior: **"Probar"** (recorrido en memoria sin registrar) y **"Guardar diagnóstico"**. Validaciones al guardar: toda rama termina en algo útil, sin ciclos, sin preguntas inalcanzables; aviso (sin bloquear) de procedimientos vinculados no disponibles.

### 7.6 Alta de conexión (`FormularioConexion`)

Archivo `src/features/red/FormularioConexion.tsx`. Compartido entre la ficha de dispositivo (variante "ficha", con selects) y la topología del equipo (variante "topologia", con chips).

| Campo | Interno | Control | Notas |
|-------|---------|---------|-------|
| Tipo de relación | `modo` | Select / chips | Da servicio a / Recibe de / Instalado en / Contiene / Relacionado |
| Otro equipo | `otro` | Buscador con sugerencias | Prioriza misma ubicación o categoría de red; permite **crear equipo nuevo** inline |
| Puerto en este equipo | `puertoLocal` | Texto | Solo enlaces; sugiere el próximo puerto libre |
| Puerto en el otro | `puertoRemoto` | Texto | Opcional, solo enlaces |
| Medio | `medio` | Texto con datalist / chips | UTP (defecto), fibra óptica, inalámbrico... Solo enlaces |
| Notas | `notas` | Texto | Solo variante ficha |

Botones: **"Guardar conexión"** y (variante ficha) **"Guardar y agregar otra"** (conserva el tipo). Aviso: si este equipo no tiene ubicación y el otro sí, ofrece **"Copiar ubicación"**.

### 7.7 Formularios simples

- **Ubicación (`UbicacionForm`).** Nombre (**obligatorio**, "Taquilla 2, Bodega, Rack principal..."), "Dentro de" (select de ubicación padre; no puede ser ella misma ni una descendiente), Notas, Motivo (edición). Botón "Guardar ubicación".
- **Persona (`PersonaForm`).** Nombre (**obligatorio**, "Juan Pérez"), Notas ("Cargo, área, extensión..."), Motivo (edición). Botón "Guardar persona".
- **Registrar intervención (`RegistrarIntervencion`).** En la ficha del equipo. "Qué se hizo" (área de texto, **obligatorio**, "cambio de ribbon, limpieza de cabezal..."), "Motivo (opcional)". Botón "Guardar intervención"; tras guardar ofrece adjuntar una foto.
- **Dar de baja (`DarDeBajaPage`).** Motivo (opcional, "Fin de vida útil..."). El botón "Confirmar baja" solo se habilita cuando se resolvieron las dependencias (conexiones, credenciales, campos protegidos).
- **Reemplazo (`ReemplazoPage`).** Motivo (opcional). Botón "Migrar todo y dar de baja".
- **Login (`LoginPage`).** Correo (email, obligatorio, `autoComplete="username"`), Contraseña (obligatorio, fuera del gestor). Botón "Ingresar". Ver la sección 6.9.
- **Mi cuenta (`CuentaPage`).** Contraseña actual / Nueva / Confirmar (los tres obligatorios). Botón "Cambiar contraseña".
- **Importar (`ImportarDispositivosPage`).** Carga de archivo (.csv/.xlsx) y, en la revisión, "Categoría para las filas que no traen una" (select). Botón "Importar N equipos".

---

<a id="8-catalogo-de-modales"></a>
## 8. Catálogo de modales, hojas y diálogos

La app usa **modales** (centrados, `src/components/Modal.tsx`, renderizados con `createPortal` a `document.body`), **hojas inferiores** (pegadas al borde inferior, en la Bóveda), y **diálogos/confirmaciones en línea**.

| Modal / hoja | Cómo se abre | Desde dónde | Contenido | Qué hace |
|--------------|--------------|-------------|-----------|----------|
| **Diálogo de eliminación** (`DialogoEliminar`) | Botón "Eliminar" | Fichas de artículo, dispositivo, credencial, campo protegido, diagnóstico, paso | Título, descripción, **advertencia de impacto** (qué vínculos quedarían rotos) y, si es **sensible**, campo "Contraseña maestra" | Elimina (soft-delete). Las sensibles verifican la contraseña maestra contra el verificador; si el equipo no tiene contraseña maestra, cae a confirmación normal; si no se puede comprobar (offline), la niega |
| **Panel de sincronización** (`PanelSync`) | Tocar la pastilla de sincronización | Cabecera de Inicio | Estado (tiempo real / cada 2 min), última sincronización, cambios por subir, conflictos (ediciones sobrescritas), y **cambios rechazados agrupados por causa** con opción "Descartar" por ficha | "Reintentar ahora" fuerza sincronización; "Descartar" restaura la versión del servidor de una ficha atascada |
| **Visor de imagen** (`VisorImagen`) | Tocar una imagen de un adjunto o paso | `Adjuntos`, `ProcedimientoVista` | Imagen a pantalla completa con zoom (pellizco/doble toque) y arrastre | Cierra al salir |
| **Hoja "Guardar en la bóveda"** | Botón "Crear" de la Bóveda | `BovedaPage` | Los cinco tipos de secreto (Cuenta, Red, Llave, Archivo, Nota) | Cada uno abre el editor con `?tipo=` |
| **Hoja de acciones de una fila** | Menú "···" de una fila | `BovedaPage` | Copiar usuario / Copiar contraseña (sin mostrarla, con auditoría) / Abrir la ficha / Editar / Eliminar | Las copias descifran al momento y registran en la auditoría |
| **Menú "···" de la ficha de artículo** | Botón "···" | `ArticuloPage` | Compartir / Duplicar / Reiniciar progreso / Eliminar | Menú flotante (cierra al hacer clic fuera) |
| **Menú "···" de la ficha de dispositivo** | Botón "···" | `DispositivoPage` | Duplicar / Editar / Etiqueta QR / Reemplazar / Dar de baja / Eliminar | Fila de botones bajo la cabecera |
| **Menú "···" de Equipos** | Botón "···" | `DispositivosPage` | Ubicaciones / Personas / Etiquetas QR / Importar | - |
| **Vista previa de artículo** (`VistaPreviaArticulo`) | Botón "Vista previa" | `ArticuloForm` | Render interactivo del artículo antes de guardar | Progreso efímero que se borra al cerrar |
| **Confirmación "Cancelar diagnóstico"** | Botón "Cancelar" | `DiagnosticoRunPage` | "¿Cancelar el diagnóstico? El avance se descarta y queda registrado como abandonado" | "Sí, cancelar" / "Seguir con el diagnóstico" |
| **Hoja "Algo va mal en el paso N"** | Botón **"Falla"**, permanente en la ejecución | `HojaFalla` | Las cuatro salidas cuando el paso falla | Abrir la contingencia vinculada, fotografiar y anotar, saltar el paso, cancelar |
| **Pregunta de error / decisión** | Vista de lectura: siempre que el paso tenga contingencia vinculada y no esté hecho. Decisiones: al llegar a la tarea | `ProcedimientoVista` | "¿Ocurrió algún error?" / pregunta Sí/No | "Sí, ver la contingencia" despliega el vínculo; "No, continuar" **solo si el paso no tiene trabajo pendiente**, porque completa el paso |
| **Desbloqueo de la bóveda** | Al entrar a la Bóveda o a un campo protegido | `BovedaGuard`, `CredencialEnPaso`, `SeguridadDelEquipo` | Campo contraseña maestra + "Desbloquear" | Deriva la clave en el teléfono; sesión compartida con autobloqueo |
| **Pantalla de bloqueo de la app** (`BloqueoAppGuard`) | Al abrir la app / tras inactividad | Envuelve toda la zona autenticada | Patrón (cuadrícula 3x3) o contraseña; "Cerrar sesión y quitar el bloqueo" | Desbloquea la interfaz (no cifra datos) |
| **"Olvidé mi contraseña"** (tarea 184) | Enlace "¿La olvidaste?" | `LoginPage` | Dice el camino real: pedirle al administrador una contraseña nueva desde el panel de Supabase, y cambiarla luego en Mi cuenta. Distingue esta contraseña del bloqueo del teléfono | Solo informa; botón "Entendido" |
| **"Instalar la app en el teléfono"** (tarea 184) | Botón "Cómo instalar", o "Instalar" cuando el navegador rechaza su diálogo | `BotonInstalarApp` (bienvenida de Inicio y Mi cuenta) | Los tres pasos manuales (menú del navegador → "Añadir a pantalla de inicio" → confirmar) | Solo informa; botón "Entendido" |

---

<a id="9-catalogo-de-botones"></a>
## 9. Catálogo de botones y primitivas de interfaz

### 9.1 Variantes de botón (`src/components/nocturne.tsx`)

Regla del sistema Nocturne: los botones van **delineados**, nunca rellenos.

| Constante | Aspecto | Uso |
|-----------|---------|-----|
| `BTN_PRIMARIO` | Delineado en acento | Acción principal (Guardar, Ingresar, Ejecutar) |
| `BTN_SECUNDARIO` | Delineado en el divisor | Acción secundaria (Crear, Editar, Cancelar) |
| `BTN_PRIMARIO_PELIGRO` | Delineado en rojo | La acción que ejecuta una eliminación |
| `BTN_GHOST` | Sin borde, tinte al pasar | Acciones ligeras (Volver, Cancelar) |
| `BTN_GHOST_ACENTO` | Fantasma en acento | "Agregar", "Registrar" |
| `BTN_GHOST_PELIGRO` | Fantasma en rojo | Eliminar ligero |
| `BTN_GHOST_TENUE` | Fantasma atenuado | Descarte junto a una acción principal |
| `BTN_ICONO_SECUNDARIO` | Cuadrado 34x34 delineado | Iconos de cabecera (compartir, escanear, "···") |
| `BTN_ICONO_PELIGRO` | Cuadrado sin borde en rojo | Eliminar de icono |

Otras primitivas: `TituloSeccion` (rótulo 11px en mayúsculas), `TagNeutral` (etiqueta neutra para metadatos), `CampoContrasena` (campo enmascarado por CSS que NO es `type="password"`, para que el gestor del sistema no ofrezca guardarlo), `BotonFavorito` (estrella de fijar), `BotonVolver` (navegación "Up").

### 9.2 Botones por pantalla (resumen)

Los botones concretos de cada pantalla están detallados en las secciones 5, 6, 7 y 8. En síntesis, los patrones recurrentes son:

- **Cabecera de lista**: "Volver" (o marca), "Crear", buscador (con "Borrar"), a veces "···" con acciones extra o iconos (escanear, bloquear).
- **Cabecera de ficha**: "Volver", estrella de favorito, compartir, "Editar", "···" con el resto.
- **Barra inferior de editor**: aviso/completitud + acción principal ("Guardar ...", a veces con "Vista previa" o "Probar").
- **Filas de lista**: enlace a la ficha + a veces acción rápida (estrella, "···", "X" para quitar).
- **Copiar**: en fichas de dispositivo y credencial, cada valor tiene un botón de copiar con confirmación (tilde).

---

<a id="10-menus"></a>
## 10. Menús

| Menú | Opciones | Navegación / acción |
|------|----------|---------------------|
| **Barra de navegación** (`Chasis`), escritorio (tarea 183) | Inicio, Guías, Equipos, Red, (Bóveda con permiso); Herramientas: Diagnóstico, Escanear; Registros: Ubicaciones, Personas | Cambia de sección; incluye el perfil (→ Cuenta) al pie |
| **Barra de navegación** (`Chasis`), móvil (tarea 182) | Inicio, Guías, Equipos, Red, Más | Cambia de sección; siempre las mismas cinco, iguales para todos |
| **"Más"** (tarea 182) | Bóveda (con permiso), Diagnóstico, Escanear, Ubicaciones, Personas, Etiquetas QR, Importar, Mi cuenta, Bloqueo y seguridad | Navega a cada pantalla; ver sección 5.6 |
| **"···" de Equipos** | Ubicaciones, Personas, Etiquetas QR, Importar | Navega a cada pantalla |
| **"···" de la ficha de dispositivo** | Duplicar, Editar, Etiqueta QR, Reemplazar, Dar de baja, Eliminar | Acciones sobre el equipo |
| **"···" de la ficha de artículo** | Compartir, Duplicar, Reiniciar progreso, Eliminar | Acciones sobre el artículo |
| **"···" de la ficha de credencial (lista)** | Copiar usuario, Copiar contraseña, Abrir, Editar, Eliminar | Acciones rápidas sobre el secreto |
| **"···" de un paso** (editor) | Subir, Bajar, Eliminar | Reordena/quita el paso |
| **"···" de una pregunta** (editor diagnóstico) | Subir, Bajar, Duplicar, Eliminar | Reordena/duplica/quita el nodo |
| **Hoja "Crear" de la Bóveda** | 5 tipos de secreto | Abre el editor con el tipo |
| **Enlaces de Diagnóstico** | Sugerencias del equipo, Estadísticas | Navega a esas pantallas |

---

<a id="11-acciones-transversales"></a>
## 11. Acciones transversales

| Acción | Dónde | Qué hace | Tablas afectadas |
|--------|-------|----------|------------------|
| **Crear** | Cada sección | Abre el formulario/editor correspondiente | La entidad + `historial` |
| **Editar** | Fichas | Reabre el editor con los datos cargados | La entidad + `historial` |
| **Duplicar** | Fichas de dispositivo y artículo | `?copiarDe=<id>`: precarga la ficha regenerando ids internos; no copia serial/placa/IP/foto (dispositivo) ni estado/versión (artículo, nace borrador) | La entidad |
| **Eliminar** | Fichas | Borrado suave con confirmación; sensible (contraseña maestra) para artículo, credencial, dispositivo, diagnóstico | La entidad (`eliminado_en`) + `historial` (+ `accesos_boveda` en credenciales) |
| **Dar de baja** | Ficha de dispositivo (→ `/baja`) | Resuelve conexiones/credenciales/campos protegidos y fija estado "De baja" | `dispositivos`, `conexiones`, `credenciales`, `campos_protegidos` |
| **Reemplazar** | Ficha de dispositivo (→ `/reemplazo`) | Crea el equipo entrante (`?reemplazaA`) y migra las dependencias del saliente, que queda "De baja" | Igual que baja + el equipo nuevo |
| **Archivar** | (No existe como tal) | El equivalente es "Obsoleto" (artículos) y "De baja" (equipos) | - |
| **Registrar intervención** | Ficha de dispositivo | Bitácora manual + foto opcional | `historial`, `adjuntos` |
| **Escanear** | Inicio / Equipos → `/escaner` | Lee QR/código de barras y abre la ficha | (solo lectura) |
| **Importar** | Equipos → `/dispositivos/importar` | Carga masiva desde Excel/CSV, con revisión y omisión de duplicados | `dispositivos`, `historial` |
| **Imprimir etiquetas** | Equipos → `/dispositivos/etiquetas` | Genera e imprime etiquetas QR seleccionadas | (solo lectura) |
| **Compartir** | Fichas de dispositivo y artículo | Diálogo nativo o copia el enlace | (solo lectura) |
| **Copiar** | Fichas de dispositivo y credencial | Copia un valor al portapapeles (con auditoría en la bóveda) | `accesos_boveda` (en la bóveda) |
| **Descargar** | Ficha de credencial (archivo seguro) / Inicio ("Descargar todo para offline") | Descifra y descarga un archivo / precachea adjuntos | `accesos_boveda` (archivo); cache local |
| **Sincronizar** | Pastilla de sincronización / automático | Sube la cola y descarga novedades | Todas las sincronizadas |
| **Buscar** | Inicio (global) y cada sección (local) | Filtra por texto, tolera errores y sinónimos | (solo lectura) |
| **Filtrar / Ordenar** | Listas | Por categoría, tipo, etiqueta, estado, ubicación | (solo lectura) |
| **Ejecutar procedimiento** | Ficha de artículo → `/ejecutar` | Modo asistente paso a paso | `progresoPasos` (local) |
| **Ejecutar diagnóstico** | Lista de diagnósticos → `/:id` | Asistente de preguntas; registra la ejecución al cerrar | `progresoDiagnostico` (local), `ejecuciones_diagnostico` |
| **Migrar** | Bóveda / Ubicaciones / Personas | Convierte datos antiguos (secretos que son de un equipo, textos en entidades) | Según el caso |
| **Favorito** | Cabecera de fichas / filas de diagnóstico | Fija/quita de la lista de Favoritos de Inicio | `favoritos` (local) |
| **Reiniciar progreso** | Ficha/menú de artículo | Borra el avance local del procedimiento | `progresoPasos` (local) |

---

<a id="12-relaciones-entre-secciones"></a>
## 12. Relaciones entre secciones

El principio rector del producto es "cada dato existe una sola vez y todo lo demás lo referencia". Las secciones están tejidas entre sí. Los vínculos guardan el id del otro extremo más una **copia de su título** (caché de presentación); la **regla de referencia viva** (`src/lib/referencia.ts`) muestra el dato actual si la fila existe local, y usa la copia solo si falta o fue eliminada. El **grafo de referencias** (`src/lib/grafo.ts`, derivado, no almacenado) permite el inverso universal "¿qué referencia a esto?".

```
Dispositivo
 ├── Categoría (categoria_id; decide si va en Equipos o en Red)
 ├── Ubicación (ubicacion_id → ficha de la ubicación)
 ├── Persona / Responsable (responsable_id → ficha de la persona)
 ├── Conexiones (con otros dispositivos → topología)
 ├── Campos protegidos (Seguridad; misma protección que la Bóveda)
 ├── Credenciales de la bóveda (que le dan acceso)
 ├── Procedimientos y Problemas frecuentes (artículos "donde aplica")
 ├── Diagnósticos (de su categoría)
 ├── Reemplaza a / Reemplazado por (otro dispositivo)
 ├── Adjuntos
 └── Historial (incluye intervenciones y cambios de cableado)

Artículo (Guías)
 ├── Categoría
 ├── Equipos afectados / donde aplica
 ├── Pasos → vínculos: información protegida (credencial o campo), subprocedimiento, solución
 ├── Relacionados (otros artículos) + inverso
 ├── Referenciado por (subprocedimiento/solución/decisión/diagnóstico)
 ├── Ruta de inicio (aparece en Inicio "Para empezar")
 └── Historial (+ ejecuciones de diagnóstico que lo usaron)

Diagnóstico
 ├── Categoría
 ├── Opciones que ejecutan Artículos (con procedimiento)
 ├── Ejecuciones (registro inmutable → Estadísticas, Sugerencias)
 └── Historial

Credencial (Bóveda)
 ├── Categoría (texto libre)
 ├── Equipos con acceso (dispositivos)
 ├── Usada en (pasos de procedimientos)
 ├── Archivo seguro (Storage cifrado)
 └── Actividad (accesos_boveda + historial)

Ubicación ── Equipos que están ahí; jerarquía padre/hijos
Persona   ── Equipos asignados
Categoría ── Artículos + Equipos + Diagnósticos (ficha 360°)
```

Puntos de navegación cruzada destacados:
- Desde la ficha de un **dispositivo** se llega en un toque a sus procedimientos, problemas, credenciales, ubicación, responsable, topología, diagnóstico de su categoría, y a crear una incidencia/procedimiento/secreto ya precargados.
- Desde un **artículo** se navega a sus dispositivos afectados, relacionados, y quién lo referencia.
- El **buscador global**, accesible desde la lupa de la barra superior en las cinco pestañas (y en línea dentro de Inicio), encuentra por igual artículos, equipos (generales y de red), credenciales (con permiso), ubicaciones y personas.
- La **eliminación** de cualquier entidad avisa antes qué vínculos quedarían rotos (impacto derivado del grafo).

---

<a id="13-flujos-completos"></a>
## 13. Flujos funcionales completos

### 13.1 Crear y documentar un equipo nuevo

```
Equipos > Crear
 → Formulario (nombre + categoría obligatorios; foto, serial, IP, ubicación, responsable...)
 → Guardar dispositivo → guardarRegistro('dispositivos') + historial + cola de subida
 → Ficha del equipo con bloque "¿Qué sigue?"
      ├── Agregar foto (→ Editar)
      ├── Seguridad (datos protegidos, con bóveda)
      ├── Conexiones (topología)
      └── Documentar procedimiento / Reportar incidencia
 → Sincronización (Realtime + cola) → el resto del equipo lo ve en segundos
```

### 13.2 Ejecutar un procedimiento (modo asistente)

```
Guías > (categoría) > Artículo
 → Ejecutar (/soluciones/:cat/:art/ejecutar)
 → AsistentePage: un paso a la vez, objetivo, checklist, cronómetro
      ├── Marcar tareas (accion / verificación)
      ├── Responder decisiones Sí/No (No abre un vínculo inline)
      ├── Ejecutar subprocedimiento vinculado (anidado)
      ├── Adjuntar evidencia del paso (→ intervención en el historial del equipo)
      └── "Falla" → hoja "Algo va mal en el paso N" → contingencia / foto / saltar
 → Verificación final → banner "Procedimiento completado"
 (Progreso local en progresoPasos; "Continuar donde quedaste" en Inicio si se sale a medias)
```

**Nada se va con el scroll (tarea 201, los dos hallazgos P0 de la auditoría móvil).** Era la única pantalla de la app sin nada fijo, y es donde el técnico trabaja de verdad:

- **Ancla del paso, pegajosa** (56 px, hallazgo **M-010**, regla **M-R1**): dentro del mismo bloque que la barra de tarea, una banda con el contador **"3/7"**, el título del paso truncado y las tareas marcadas de ese paso (**"2/4"**). Antes, al desplazarse dentro de un paso con seis instrucciones y una credencial, no quedaba en pantalla ni el número de paso ni qué llevaba marcado; al volver de una interrupción había que reconstruirlo de memoria.
- **El contador es un destino, no un rótulo** (tarea 210, tablero `6c`): toda la banda es un botón que abre el **índice de los pasos** (`HojaPasos`), una hoja inferior con los pasos en filas de 60 px que llevan directo a cualquiera de ellos. Antes no había forma de saltar al paso N: volver del 8 al 3 eran cinco toques de "Atrás". Cada fila dice su **estado real**: hecho (check), **aquí**, pendiente, **saltado** (un paso sin hacer que quedó por detrás del actual) y si el paso **lleva un aviso de cuidado**, que es lo que conviene saber antes de saltar ahí. La cabecera resume "2 hechos · 1 saltado · quedan ~14 min" (el tiempo es el estimado del artículo repartido entre los pasos que faltan, por eso lleva "~"; sin tiempo estimado no aparece). **"Saltado" no se guarda en ninguna parte**: se deduce de la posición, así que esto no toca el esquema.
- **Las casillas de tarea miden 28 px en filas de 56, con texto de 16** (tarea 215; venían de 24 en 44 con texto de 15). El estado hecho **no va tachado**: a 16 px, a pleno sol y con el teléfono apoyado en el rack, la línea del tachado no se distingue y solo emborrona el texto. Lo dicen la casilla en acento y el texto atenuado, que además sube de `neutral-600` (4.0:1, por debajo del 4.5 que pide AA) a `neutral-400` (8.9:1).
- **Modo foco, una tarea a la vez** (tarea 211, tablero `6d`): el botón **"Foco"** de la barra de acción (solo si el paso tiene tareas) sustituye el cuerpo del paso por **una sola instrucción a 30 px**, con los avisos del paso pegados a ella y nada más. El botón de marcar mide **76 px** y es el único elemento grande de la pantalla, así que no hay que apuntar. Debajo, flechas de tarea anterior y siguiente (64x56) y **"Falla"**. Los vínculos del paso (la clave, las fotos, los archivos) quedan como chips de 52 px que se despliegan sin salir. Marcar avanza a la siguiente tarea sin marcar; desmarcar no mueve nada. **Es un modo, no un reemplazo:** "Ver todo" vuelve a la vista de paso completo, y el experto se queda en ella. Al completar el paso, el foco pasa solo a la primera tarea del siguiente.
- **La contingencia deja de esconderse (tarea 215, tablero `3d`).** "¿Ocurrió algún error durante este paso?" eran dos botones de **28 px**, el control más pequeño de la pantalla, y solo aparecían **cuando ya estaban marcadas todas las tareas del paso**: si el paso fallaba no se podían marcar, así que la salida no se mostraba nunca. Además reemplazaba la barra de acción, y la pantalla se quedaba sin acción dominante. Ahora hay un botón **"Falla" de 56 px permanente** junto a la acción dominante (etiqueta corta a propósito, para que ninguna de las dos se recorte) que abre la hoja **"Algo va mal en el paso 3"** con las salidas reales, de 56 a 60 px: **abrir la contingencia vinculada** (con su título y sus pasos), **fotografiar y anotar el problema**, **saltar el paso y seguir** y **cancelar**. Arriba, la promesa que hace falta antes de elegir: "Los 2 pasos que llevas hechos no se pierden".
- **Las salidas que no llevan a ninguna parte no se muestran:** sin equipo afectado no hay historial donde registrar la foto, y en el último paso pendiente no hay a dónde saltar.
- **Un solo "Falla".** El del **modo foco** abre exactamente la misma hoja; lo único que añade es la tarea señalada ("En «Etiquetar el patch cord»"). **Cancelar deja al técnico donde estaba**, dentro del foco; elegir una salida sale al paso completo, porque es ahí donde ocurren.
- **Elegir una salida deja un aviso ámbar** sobre el paso ("Marcaste una falla en «...»"), con acceso a la contingencia y un "Quitar el aviso". **No completa nada ni toca el progreso**, y **se retira solo al cambiar de paso**.
- **Resolver la contingencia** completa el paso y sigue el avance **solo si el paso no tenía trabajo pendiente**. Con tareas sin marcar, no: se cierra y el técnico vuelve al paso con su aviso puesto, porque darlo por hecho se saltaría trabajo que nadie hizo.
- **Saltar el paso** lo deja sin marcar y avanza; el índice lo pinta como **"saltado"**.
- **Avance en segmentos, uno por paso**, en vez de la barra continua de porcentaje: dice cuántos pasos hay y cuál es el que sigue (el segmento del paso actual va a media tinta). Con más de 12 pasos vuelve sola a la barra continua, porque los segmentos ya no se leerían.
- **Acción dominante fija al pie** (hallazgo **M-011**, regla **M-R3**): **"Paso hecho · ir al 4"** (o "Ir al paso N" cuando se está revisando un paso ya completo, o "Paso hecho · terminar" en el último). Antes "Atrás / Siguiente" vivían al final del scroll del paso, así que avanzar exigía recorrer el paso entero con una mano, mientras la ficha de artículo sí fijaba su acción abajo desde la tarea 172.
- **La barra tiene dos filas** (tarea 215): arriba, a 44 px, lo que no es trabajo ("Atrás" reducido a icono y "Foco"); abajo, la fila que cae bajo el pulgar, a **56 px**, **"Falla"** y la acción dominante. En una sola fila los cuatro controles dejaban la acción dominante en 88 px sobre una pantalla de 360, recortada a "Paso hecho · i...". **Y esta barra ya no desaparece:** la pregunta de error la reemplazaba, y el layout saltaba.
- **El botón dice por qué no se puede avanzar**, en una línea encima ("Falta 1 tarea de este paso para poder avanzar"), en vez de apagarse en silencio.
- El título del paso deja de repetirse como encabezado del cuerpo (ya lo dice el ancla) y el **cronómetro** baja a una línea discreta bajo el objetivo. Los pasos **anidados** conservan su botón único en línea: su avance lo decide el paso que los contiene, y dos acciones dominantes en la misma pantalla dejarían de ser dominantes.

### 13.3 Diagnóstico inteligente

```
Inicio > Diagnóstico inteligente (o Problemas frecuentes)
 → Lista de problemas por categoría > elegir un problema
 → DiagnosticoRunPage: pregunta a la vez, opciones
      └── una opción puede ejecutar un procedimiento (AsistenteVista inline)
 → Resultado: "¿Quedó resuelto?"
      ├── Sí → registra ejecución (resuelto)
      └── No → motivo (+ "Encontré otra solución" → texto libre)
              → registra ejecución + alimenta Sugerencias del equipo
 → Estadísticas agregan todas las ejecuciones
 → Sugerencias > "Redactar artículo" (?desdeSugerencia) → borrador precargado
```

### 13.4 Guardar y usar un secreto

```
Bóveda > Crear > (tipo)  [o desde la ficha de un equipo: "Guardar secreto"]
 → CredencialForm (cifra en el teléfono) > Guardar secreto
 → Lista de la Bóveda
 → Ficha del secreto: revelar (auditoría), copiar (auditoría), descargar archivo
 → El secreto se puede vincular a un paso de un procedimiento (aparece como "Datos" del paso,
    contraído, pide bóveda abierta) y aparece en "Usada en"
 → Nudge anti duplicidad: si en realidad es de un equipo, migrar a su ficha (/boveda/migrar)
```

### 13.5 Registrar y mapear la red

```
Red > Crear (?red=1, prioriza categorías de red) → equipo de red
 → Ficha > Conexiones > Agregar conexión (tipo, otro equipo, puertos, medio)
 → Topología de red (bosque) o Topología del equipo (depende de / si falla / dependen de él)
 → Cada conexión escribe en el historial de ambos extremos
```

### 13.6 Ciclo de vida: reemplazo y baja

```
Ficha de equipo > "···" > Reemplazar → crea entrante (?reemplazaA) → ReemplazoPage
 → migra conexiones/credenciales/campos protegidos → saliente queda "De baja"

Ficha de equipo > "···" > Dar de baja → resuelve cada dependencia (quitar/desvincular/conservar)
 → Confirmar baja (estado "De baja")
```

---

<a id="14-arbol-de-navegacion"></a>
## 14. Árbol jerárquico de navegación

Desde la tarea 181, la pastilla de sincronización, la lupa y el avatar de Mi cuenta viven en la barra superior de las **cinco** pestañas (Inicio, Guías, Equipos, Red, Más), no solo en Inicio: se omiten del resto de los árboles de abajo para no repetirlos.

```
Login
 ├── ¿La olvidaste? → Modal "Olvidé mi contraseña" (pedirla al administrador)
 └── (autenticado) → Bloqueo de la app (patrón/contraseña, si está activo)

Inicio (/)
 ├── Buscador global (Guías · Equipos · Bóveda · Ubicaciones · Personas)
 ├── Bienvenida del primer día (entraste · instalar · descargar para offline)
 ├── Continuar donde quedaste → Ficha de artículo
 ├── Atajos: Diagnóstico inteligente · Escanear equipo
 ├── Problemas frecuentes → Diagnóstico · Estadísticas
 ├── Pendientes · Favoritos · Recientes · Para empezar · Actividad del equipo
 ├── Descargar todo para offline
 └── Pastilla de sincronización → Panel de sincronización

Guías (/soluciones)
 ├── Buscar · Chips de categoría · Subfiltros por tipo · Filtro por etiqueta
 ├── Crear → Editor de artículo
 │    ├── General (tipo, título, portada, etiquetas, equipos)
 │    ├── Pasos (requisitos, PasosEditor, verificación final)
 │    ├── Detalles (síntomas, causas, tiempo, dificultad, relacionados, notas)
 │    ├── Publicación (estado, ruta de inicio, cambio mayor, motivo)
 │    ├── Vista previa
 │    └── Guardar
 ├── Ficha de categoría (/:cat) → artículos + dispositivos + diagnósticos + historial
 └── Ficha de artículo (/:cat/:art)
      ├── Ejecutar → Asistente (paso a paso)
      ├── Editar · Duplicar · Reiniciar progreso · Compartir · Eliminar · Favorito
      └── Procedimiento · Relacionados · Referenciado por · Historial

Equipos (/dispositivos)
 ├── Buscar · Chips de categoría · Resumen de estados
 ├── Escanear · Crear · "···" (Ubicaciones · Personas · Etiquetas QR · Importar)
 ├── Etiquetas QR (/etiquetas) → seleccionar · imprimir
 ├── Importar (/importar) → elegir · revisar · importar
 └── Ficha de dispositivo (/:id)
      ├── Editar · Duplicar · Etiqueta QR · Reemplazar · Dar de baja · Eliminar
      ├── Compartir · Favorito · Copiar campos
      ├── ¿Qué sigue? · Información · Seguridad (datos protegidos)
      ├── Resolver con este equipo (diagnóstico · procedimientos · problemas · credenciales)
      │    └── Reportar incidencia · Documentar procedimiento · Guardar secreto
      ├── Si este equipo falla (impacto) · Conexiones (→ topología) · Adjuntos
      ├── Intervenciones (registrar) · Historial
      ├── Reemplazo (/:id/reemplazo)
      └── Dar de baja (/:id/baja)

# Ubicaciones y Personas se alcanzan también desde el "···" de aquí, pero
# su padre real es "Más" desde la tarea 182: ver ese árbol más abajo.

Red (/red)  → abre con el NODO (memoria en ?nodo=<id>)
 ├── Estás recorriendo · Depende de · Si este equipo falla · Dependen de este equipo
 │    └── tocar un equipo SUSTITUYE el nodo (/red?nodo=<id>), no salta a la lista
 ├── Todos los equipos de red por ubicación (/red/equipos) → buscar · Crear · agrupado por entidad Ubicación
 ├── Mapa completo (/red/topologia) → bosque expandible · buscador
 └── Topología de un equipo (/red/topologia/:id)
      ├── Depende de · Si este equipo falla · Dependen de este equipo
      └── Conexiones (agregar/quitar) · Abrir la ficha

Bóveda (/boveda) [permiso puede_ver_boveda]
 ├── Desbloqueo (contraseña maestra) · Bloquear ahora · Autobloqueo
 ├── Buscar · Chips de categoría · Aviso de rotación · Aviso de migración
 ├── Crear (hoja: Cuenta · Red · Llave · Archivo · Nota) → Editor de credencial
 ├── Migrar (/boveda/migrar)
 ├── "···" de fila (Copiar usuario · Copiar contraseña · Abrir · Editar · Eliminar)
 └── Ficha de credencial (/:id)
      ├── Editar · Eliminar
      ├── Campos (revelar · copiar · descargar archivo) · Da acceso a · Usada en · Actividad

Más (/mas) — quinta pestaña móvil desde la tarea 182
 ├── Consulta protegida: Bóveda (solo con permiso puede_ver_boveda)
 ├── Herramientas: Diagnóstico · Escanear equipo
 ├── Registros: Ubicaciones (/ubicaciones) · Personas (/personas) · Etiquetas QR · Importar
 └── Mi cuenta: Perfil (/cuenta) · Bloqueo y seguridad (/cuenta/seguridad)

Diagnóstico (desde Inicio y Más, /diagnostico)
 ├── Buscar · Crear · Sugerencias del equipo · Estadísticas
 ├── Diagnóstico en curso (retomar)
 ├── Editor de diagnóstico (/nuevo, /:id/editar) → preguntas · respuestas · Probar · Guardar
 ├── Asistente (/:id) → preguntas · procedimientos inline · resultado (¿resuelto? + motivo)
 ├── Estadísticas (/estadisticas)
 └── Sugerencias (/sugerencias) → Redactar artículo
```

---

<a id="15-verificacion-final"></a>
## 15. Verificación final (auditoría de cobertura)

Repaso de que no quedó nada sin documentar, contra la lista de archivos de `src/`:

- [x] **Ningún menú sin documentar.** Barra de navegación, todos los "···", la hoja "Crear" de la Bóveda y los enlaces de Diagnóstico están en las secciones 5, 6, 8 y 10.
- [x] **Ningún botón sin analizar.** Botones de cabecera, de barra inferior, de fila y de copiar cubiertos por pantalla (secciones 5-8) y por variante (sección 9).
- [x] **Ningún formulario sin documentar.** Los 15 formularios/editores (dispositivo, artículo, pasos, credencial, campo protegido, diagnóstico, conexión, ubicación, persona, intervención, baja, reemplazo, login, cuenta, importación) están en la sección 7.
- [x] **Ningún modal sin documentar.** Diálogo de eliminación, panel de sincronización, visor de imagen, hojas de la Bóveda, menús flotantes, vista previa, confirmaciones y desbloqueos en la sección 8.
- [x] **Ningún campo sin describir.** Cada campo con su tipo de control, obligatoriedad, valor por defecto, placeholder y validaciones en la sección 7.
- [x] **Ningún selector sin listar.** Categoría (chips), tipo de secreto/campo/artículo, estado, dificultad, ubicación padre, medio de conexión, tipo de relación: opciones y dependencias en las secciones 5-7.
- [x] **Ninguna validación sin explicar.** Obligatoriedad, IP válida, anti duplicados (serial/IP/título), no vacío, no duplicado dentro del equipo, ramas del diagnóstico, contraseña maestra: en la sección 7 y en el flujo de eliminación (sección 8).
- [x] **Ninguna relación sin documentar.** Grafo de relaciones entre secciones en la sección 12.
- [x] **Ningún flujo funcional sin mapear.** Seis flujos completos en la sección 13 y el árbol de navegación en la sección 14.

**Nota de método.** El documento se construyó leyendo directamente el código de todas las pantallas, editores, modales y primitivas. Un puñado de componentes compartidos pequeños (visor de imagen, adjuntos, selectores de ubicación/persona, indicadores, migraciones, componentes "de este equipo") se describen a partir de su uso en las pantallas que sí se leyeron por completo y de [ARQUITECTURA.md](ARQUITECTURA.md); su comportamiento observable está cubierto, aunque no se transcribió su interior línea por línea.

---

<a id="16-hallazgos"></a>
## 16. Hallazgos y oportunidades de mejora

Observaciones surgidas del recorrido. La mayoría son mejoras de mantenibilidad, no defectos: la app está muy cuidada y sigue de forma consistente el principio "cada dato una sola vez". Ninguno bloquea el uso diario.

### 16.1 Duplicación de utilidades pequeñas (mantenibilidad)

- **`normalizar` / `normalizarTexto`** (minúsculas sin acentos para buscar) está reimplementado en varios archivos: `BovedaPage.tsx`, `CredencialForm.tsx`, `UbicacionesPage.tsx` y `iconosSoluciones.ts`. Los tres buscadores locales de Dispositivos/Red/conexión ya comparten `incluyeTexto()` (`src/lib/texto.ts`), pero el normalizador de texto sigue disperso. **Oportunidad:** una única función de normalización en `src/lib/texto.ts` reutilizada por todos.
- **`partirTitulo`** (resaltado del término buscado en tres tramos) sigue duplicado casi idéntico entre `InicioPage.tsx` y `src/features/soluciones/coincidencia.ts` (el 2026-07-27 salió de `SolucionesPage.tsx` a ese módulo, pero la copia de Inicio quedó). **Oportunidad:** extraerlo a un helper compartido.
- **`fechaCorta` / `fechaHoraCorta` / `formatearTamano`** están repetidos entre `DispositivoPage`, `ArticuloPage`, `CredencialPage` y `CredencialForm`. El código lo marca como decisión deliberada ("duplicar helpers pequeños de presentación"), pero un módulo `src/lib/formato.ts` reduciría deriva.

### 16.2 Patrones de interfaz repetidos (candidatos a componente compartido)

- **"Aviso con acción"** (recuadro de precaución con un texto y un botón/enlace a la derecha) aparece muchas veces con markup casi idéntico: IP heredada, título que coincide con un equipo, título desactualizado, equipo sugerido por IP, solapamiento de contraseña, herencia de ubicación, migración pendiente. **Oportunidad:** un componente `<AvisoConAccion tono texto accion>` unificaría el aspecto y reduciría el riesgo de deriva visual.
- **"Motivo del cambio (opcional)"** es un campo idéntico repetido en 7 editores (dispositivo, artículo, credencial, campo protegido, diagnóstico, ubicación, persona). **Oportunidad:** un `<CampoMotivo>` compartido.
- **"Buscar o crear inline"** (elegir una entidad existente o crearla sin salir del formulario) está implementado por separado en `SelectorUbicacion`, `SelectorPersona` y la alta rápida de equipo de `FormularioConexion`. **Oportunidad:** una primitiva genérica de "selector con creación inline".

### 16.3 Deuda funcional menor

- **IP heredada de secretos tipo "equipo"** (anteriores a la fase P0): la ficha y el editor de credencial siguen mostrando avisos para quitarla a mano. Es una migración incompleta por diseño (no se fuerza). **Oportunidad:** un paso de migración masiva junto con `/boveda/migrar`, o retirarla automáticamente cuando el equipo ya está vinculado.
- **En la ficha de credencial**, la dirección IP puede mostrarse tanto como fila de la tarjeta de campos como en un aviso al pie (según sea heredada). Es coherente pero puede leerse como redundante.
- **Botón "Crear" de Red** va a `/dispositivos/nuevo?red=1` (alta genérica priorizando categorías de red). Pregunta abierta registrada en TAREAS.md desde la tarea 62: si convendría un flujo dedicado a crear una conexión de red. **Recomendación:** el alta genérica con priorización es razonable; un flujo dedicado solo se justifica si el equipo lo pide.

### 16.4 Automatizaciones que podrían aportar

- **Notificaciones de vencimiento.** Hoy los vencimientos de credenciales y campos protegidos se ven en Inicio ("Pendientes") y en la Bóveda, pero no hay notificación push. Una notificación (o un recordatorio en la "Actividad del equipo") reduciría el olvido de rotaciones.
- **Recordatorios de mantenimiento preventivo por dispositivo** y **reporte mensual desde el historial**: ya propuestos al usuario (TAREAS.md) y sin agendar; encajan bien con la infraestructura de historial e Inicio que ya existe.
- **Respaldo automático** (workflow semanal cifrado) está construido pero bloqueado por pasos del usuario en Supabase/GitHub (TAREAS.md tarea 15).

### 16.5 Consistencia visual (completa)

- La migración al sistema Nocturne está **completa**: una búsqueda de clases del tema claro heredado (`slate-*`/`sky-*`) en todo `src/` no arroja ninguna coincidencia (confirma la tarea 139). **Oportunidad de bajo costo:** agregar una prueba automatizada que rechace `slate-`/`sky-` en `src/`, para que una futura regresión no reintroduzca el tema claro sin que nadie lo note.

### Resumen

La aplicación es funcionalmente muy completa y arquitectónicamente coherente: el grafo derivado, la referencia viva, los avisos anti duplicidad y la creación contextual están bien resueltos. Las oportunidades reales son de **consolidación de código** (helpers y patrones de UI repetidos) más que de funcionalidad faltante, y algunas **automatizaciones** (notificaciones, mantenimiento preventivo) que la base de datos actual ya soportaría sin cambios de esquema.

---

<a id="17-historial-de-cambios"></a>
## 17. Historial de cambios

Registro obligatorio de la evolución del proyecto (REGLAS.md, regla 19). Cada cambio de código que afecte pantallas, formularios, campos, botones, validaciones, flujos, navegación, lógica de negocio, estructura de datos o comportamiento de un módulo se anota aquí en la misma tarea, con: Fecha · Área · Tipo (Agregado/Modificado/Eliminado/Refactorizado/Optimizado) · Descripción · Motivo · Impacto.

| Fecha | Área | Tipo | Descripción | Motivo | Impacto |
|-------|------|------|-------------|--------|---------|
| 2026-07-23 | Documentación | Agregado | Se creó este documento (`DOCUMENTACION_FUNCIONAL.md`), inventario funcional completo de la app | Encargo del usuario: única fuente de verdad funcional | Base de referencia; sin cambio de código |
| 2026-07-23 | Proceso / Documentación | Agregado | Auditoría de rediseño del flujo del técnico ([AUDITORIA_FLUJO_INSTALACION.md](AUDITORIA_FLUJO_INSTALACION.md)) y política obligatoria de mantenimiento (REGLAS.md regla 19). Se creó esta sección de Historial de cambios | Encargo del usuario: rediseñar el flujo bajo "cada dato una sola vez" y documentar todo cambio | Sin cambio de código todavía; las mejoras H1-H9 quedan como tareas 160-166 pendientes de aprobación de fases |
| 2026-07-23 | Dispositivos (ficha) | Agregado | H1: "Procedimientos/Problemas de este equipo" ahora también muestran los publicados de la **categoría** del equipo (sub-rótulo "De la categoría {X}", máx. 5 + "Ver todos"), no solo los vinculados por equipo. Funciones puras `procedimientosDeCategoria`/`problemasDeCategoria` (con pruebas) | Un procedimiento genérico no aparecía en un equipo concreto salvo vínculo manual; el diagnóstico ya se ofrecía por categoría (inconsistencia) | El técnico encuentra el procedimiento desde la ficha; escala sin vínculos manuales. Sin esquema |
| 2026-07-23 | Escáner / Dispositivos (editor) | Agregado | H3: "Registrar equipo" desde el escáner precarga el código leído como serial (`?serial=`, salvo URL de etiqueta); `DispositivoForm` lee `?serial` y `?nombre` en un alta en blanco | Se reescribía un dato ya leído (viola "nunca escribir dos veces") | Un dato menos que teclear; flujo escáner -> alta sin fricción |
| 2026-07-23 | Inicio | Agregado | H9: atajo "Registrar equipo" en la rejilla de atajos y botón "Crear dispositivo" (con el texto buscado como nombre) en el estado "Sin coincidencias" del buscador | El técnico que recibe hardware no tenía arranque directo; el buscador sin resultados no ofrecía crear | Menos clics y menos navegación al empezar un trabajo |
| 2026-07-23 | Soluciones (editor de pasos) | Agregado | H4: botón "Reutilizar" en la fila de bloques del paso, que abre los "Vínculos del paso" (Procedimiento relacionado). La composición por referencia ya existía; se hace descubrible | Riesgo de copiar pasos en vez de referenciarlos por desconocimiento de la función | Fomenta la composición; menos duplicación |
| 2026-07-23 | Soluciones (editor, General) | Modificado | H2: la ayuda de "Equipos donde aplica" aclara que, publicado, el artículo ya aparece por categoría aunque se deje vacío; vincular marca como específico | Evitar que el técnico crea que debe vincular equipo por equipo | Refuerza el principio "cada dato una sola vez"; menos trabajo manual |
| 2026-07-23 | Soluciones (editor) | (Decisión) | H5: se decide MANTENER las 4 pestañas del editor (General/Pasos/Detalles/Publicación); NO pasar a 7. El flujo lineal ya existe dentro de las pestañas y 7 empeorarían móvil | Mobile-first; evitar un retroceso de UX | Sin cambio de código |
| 2026-07-23 | Soluciones + Dispositivos (esquema) | Agregado | H6: columna `articulos.aplica_a` (jsonb nullable, `{marca, modelo}`) para refinar H1 a un modelo concreto dentro de la categoría. Editor: dos campos "Restringir a marca o modelo (opcional)" con sugerencias del inventario, en la pestaña General. Ficha: etiqueta "Marca: X"/"Modelo: Y" cuando restringe. `aplicaAlDispositivo` (nuevo módulo puro `src/features/soluciones/aplicaA.ts`, con pruebas) filtra "Procedimientos/Problemas de este equipo" además de por categoría. Historial: entrada legible "Marca: X · Modelo: Y" en vez de JSON crudo | Cerrar el hallazgo H6, deferido en la auditoría; el usuario pidió proceder | Aplicabilidad fina sin duplicar el dato del dispositivo (solo se referencia por texto para comparar). **Regla 17: columna genuinamente vaciable, por eso NO va en `camposOpcionales`** (mismo criterio que `ubicacion_id`/`responsable_id`) y viaja siempre, incluido null. Consecuencia: hasta que se aplique `supabase/schema.sql`, **todo guardado de CUALQUIER artículo** (no solo los que usan este campo) será rechazado por PostgREST y quedará reintentándose en la cola, mismo síntoma que la tarea 128. Paso del usuario, bloqueante: aplicar `supabase/schema.sql` de inmediato tras este despliegue |

