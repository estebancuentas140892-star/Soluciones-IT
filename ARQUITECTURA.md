# Arquitectura de Soluciones IT

Estado: aprobada por el usuario el 2026-07-02
Fecha: 2026-07-02

## 1. Resumen

Aplicación web progresiva (PWA) con enfoque "offline primero": toda la información vive en el teléfono y se consulta al instante sin internet. Cuando hay conexión, se sincroniza con un backend gratuito en la nube para que los 5 técnicos compartan siempre la misma información.

Cuatro pilares: base de conocimiento por categorías, inventario de dispositivos, bóveda de credenciales y búsqueda global instantánea.

## 2. Por qué una PWA y no una app nativa

- Se instala desde el navegador con "Agregar a pantalla de inicio": sin Play Store, sin App Store, sin firmar APK ni distribuir instaladores manualmente.
- Funciona igual en Android, iPhone y PC.
- Las actualizaciones llegan solas al publicar una nueva versión, y la app sigue funcionando offline mientras tanto.
- Usa las tecnologías más extendidas y documentadas del mundo, lo que facilita el mantenimiento a largo plazo y conseguir ayuda.
- Una PWA bien construida abre en menos de un segundo desde el ícono, incluso sin señal.

## 3. Stack tecnológico

| Capa | Tecnología | Rol |
|------|------------|-----|
| Interfaz | React + TypeScript + Vite | Base de la aplicación |
| Estilos | Tailwind CSS | Interfaz móvil rápida y consistente |
| Navegación | React Router | Rutas entre secciones |
| Datos locales | Dexie (IndexedDB) | Toda la información disponible offline |
| Búsqueda | MiniSearch | Búsqueda local instantánea con tolerancia a errores de escritura |
| Offline | vite-plugin-pwa (service worker) | App instalable y funcional sin internet |
| Backend | Supabase (plan gratuito) | Base de datos Postgres, autenticación, archivos y sincronización |
| Cifrado de bóveda | WebCrypto (AES-256-GCM + PBKDF2) | Credenciales cifradas en el propio dispositivo |
| Hosting | Vercel (plan gratuito) | Publicación en https://soluciones-it-psi.vercel.app, desplegado automáticamente desde GitHub. `vercel.json` reescribe todas las rutas a `index.html` (necesario para React Router) |

Todo es gratuito para un equipo de 5 personas. Supabase además es código abierto: si algún día su plan gratuito cambia, se puede autoalojar sin reescribir la aplicación.

## 4. Estructura de navegación (pestañas inferiores)

1. **Inicio**: barra de búsqueda global en grande, elementos recientes y accesos rápidos a las categorías más usadas. Abrir la app y buscar toma dos toques.
2. **Soluciones**: rejilla de categorías (POS, Impresoras, Cámaras, Computadores, Redes, Switches, Access Points, CCTV, Servidores, etc.). Dentro de cada categoría, todos los procedimientos agrupados por tipo: instalación, configuración, conexión, problemas frecuentes, mantenimiento y manuales, con imágenes y diagramas.
3. **Dispositivos**: inventario general (equipos que no son de red) con filtros por tipo, ubicación y estado. Ficha completa por dispositivo con campos según su tipo y su historial de cambios.
4. **Red**: infraestructura de red. Reúne los dispositivos de las categorías marcadas como de red (racks, puntos de red, switches, access points, cámaras) y da entrada a la topología: un mapa de conexiones en árbol expandible que responde "¿qué depende de este equipo?". Ver sección 12.
5. **Notas** (antes "Bóveda"): sección bloqueada para direcciones IP, usuarios, contraseñas y configuraciones críticas. Se presenta con nombre e icono neutros y solo aparece en la barra a los usuarios con permiso `puede_ver_boveda`; el resto no ve la pestaña ni sabe que existe. Ver sección 8.

Notas de navegación:

- La búsqueda se combina con Inicio (en lugar de ser una pestaña aparte) porque así la pantalla principal ES el buscador, que es el pilar de la app.
- Las fichas de dispositivos enlazan a los procedimientos de su categoría y viceversa: desde la ficha de una cámara se llega en un toque a "Solución de problemas de cámaras".
- Un dispositivo pertenece a Dispositivos o a Red según la marca `es_red` de su categoría; su ficha vive en una sola ruta (`/dispositivos/:id`) usada por ambas secciones y ajusta su enlace de retorno. La búsqueda global de Inicio encuentra por igual un equipo de red y uno general.

## 5. Modelo de datos

- **categorias**: id, nombre, icono, orden, es_red (bandera que decide si los dispositivos de la categoría se muestran en la sección Red o en Dispositivos).
- **articulos**: id, categoria_id, titulo, tipo (instalación, configuración, conexión, problema frecuente, mantenimiento, manual), contenido en Markdown, etiquetas (columna conservada por compatibilidad; desde el rediseño del 2026-07-03 ya no se edita, no se muestra ni se indexa en la búsqueda), procedimiento (JSON opcional de pasos numerados, cada uno solo con título, instrucciones con casilla de verificación, captura, credencial de la bóveda vinculada, subprocedimiento vinculado y solución vinculada; si existe, el artículo se muestra como una lista de pasos expandibles con progreso local por técnico: cada paso indica su estado con color (pendiente gris, en progreso ámbar con contador, completado verde) y al marcar la última instrucción de un paso, o al completarse su subprocedimiento vinculado, el paso se completa solo, se contrae y se expande el siguiente pendiente; al terminar todo se muestra un banner verde), adjuntos, updated_at, updated_by. Los campos por paso detalle, nota, advertencia, consejo y decisión de ramificación se retiraron en el rediseño del 2026-07-03: la normalización los descarta al leer y el guardado los limpia del JSON; los requisitos previos ("Antes de empezar") ya no se editan pero los guardados se conservan y se muestran. Del vínculo con la bóveda el paso guarda solo el id de la credencial y una copia de su título como referencia: los secretos nunca viajan en el artículo. En la vista ese vínculo es el apartado "Datos" del paso, contraído por defecto: los secretos no entran a la pantalla hasta que el técnico lo toca y, si la bóveda está bloqueada, ingresa la contraseña maestra. El subprocedimiento vinculado hace jerárquicos y reutilizables los procedimientos: un paso puede referenciar otro artículo con procedimiento (también solo id y título de referencia), su paso a paso completo se despliega dentro del paso con su propio progreso (compartido con el artículo original, y visible como contador "hechos/total" en la fila del paso), y actualizar el subprocedimiento actualiza automáticamente todos los procedimientos que lo usan. La solución vinculada reemplaza a la antigua decisión de ramificación: un paso puede referenciar otro artículo con procedimiento como su solución de error y, en la vista, el paso pendiente pregunta "¿Ocurrió algún error durante este paso?"; responder "No" completa el paso y el flujo sigue solo, responder "Sí" despliega la solución ahí mismo (con sus propios pasos, capturas y credenciales) y, al completarla, el paso se completa, el flujo principal continúa desde ese punto y el progreso local de la solución se reinicia para el próximo error, aquí o en cualquier otro procedimiento que la reutilice. En ambos vínculos la expansión es de un solo nivel: más profundo se muestra como enlace, lo que además corta cualquier ciclo de vínculos.
- **dispositivos**: id, categoria_id, nombre, marca, modelo, serial, placa_inventario, ubicacion, ip, estado, observaciones, detalles (pares clave/valor libres, por ejemplo puerto y switch en una cámara, o usuario asignado y sistema operativo en un computador), updated_at, updated_by. En vez de una plantilla fija por categoría, el formulario deja agregar y quitar campos libremente ("Campos adicionales"): es más simple de mantener y no se rompe si el equipo agrega una categoría nueva o un campo que no se anticipó.
- **conexiones**: id, tipo ('enlace' o 'instalacion'), origen_id, origen_nombre, origen_puerto, destino_id, destino_nombre, destino_puerto, medio (UTP, fibra, inalámbrico), notas, updated_at, updated_by. Documenta las relaciones entre dos dispositivos (el mapa de la red). En un 'enlace' el origen es el lado que da servicio (switch, router) y el destino el que lo recibe (AP, cámara, punto de red, otro switch); en una 'instalacion' el origen está instalado dentro del destino (un switch dentro de un rack). Los nombres de ambos extremos se guardan como copia de referencia (mismo patrón que los vínculos de los pasos): permiten mostrar la conexión aunque la ficha del otro extremo aún no haya sincronizado. Las conexiones solo se crean o se eliminan (para corregir un puerto se quita y se vuelve a agregar); su historial se registra en las fichas de ambos dispositivos (entidad_tipo 'dispositivo', campo 'conexion'), así al abrir cualquiera de los dos se ve el cambio de cableado. La tabla se sincroniza de última para que, si su esquema aún no se aplicó en el servidor, su fallo no impida descargar el resto.
- **credenciales**: id, titulo, categoria, datos_cifrados (bloque AES-256-GCM), updated_at, updated_by. Nunca hay texto plano.
- **historial**: id, entidad_tipo, entidad_id, usuario, fecha_hora, campo, valor_anterior, valor_nuevo, motivo.
- **adjuntos**: id, entidad_tipo, entidad_id, nombre, tipo, referencia en Supabase Storage.

## 6. Búsqueda global

- Índice MiniSearch en memoria construido sobre los datos locales: títulos, contenido, pasos de los procedimientos, marcas, modelos, direcciones IP y ubicaciones.
- Resultados agrupados por tipo: Soluciones, Dispositivos y Bóveda (esta última solo por título y solo si está desbloqueada).
- Tolera prefijos y errores de escritura: "zebr" encuentra Zebra, "epsom" encuentra Epson.
- Al ser 100 % local responde en milisegundos y sin internet.

## 7. Funcionamiento offline y sincronización

- En la primera sesión la app descarga todos los datos a IndexedDB.
- Lecturas y escrituras van siempre primero a la base local: la app nunca espera a la red.
- Cola de cambios pendientes (outbox): cada edición hecha sin internet se guarda y se envía automáticamente al reconectar.
- Sincronización bidireccional: se envían los cambios pendientes y se descargan las novedades del resto del equipo usando updated_at.
- Conflictos: gana la última escritura, pero el historial conserva ambos cambios para poder recuperar cualquier dato.
- Adjuntos: se guardan en caché al verlos por primera vez, y el botón "Descargar todo para offline" (en Inicio) deja el contenido completo en el teléfono antes de salir a un mantenimiento. Las subidas también funcionan sin conexión: el archivo queda en una cola local (tabla `archivosPendientes`), se muestra al instante desde el caché y el motor de sincronización lo sube solo al recuperar señal, antes de procesar la cola de cambios.

## 8. Seguridad de la bóveda (sección "Notas")

Además de las dos capas técnicas, se aplica **mínima exposición en la interfaz**: la sección se llama "Notas" con un icono neutro (nunca "Bóveda", "Credenciales" ni "Contraseñas"), su pestaña solo aparece a los usuarios con `puede_ver_boveda` y quien llega por una ruta directa sin permiso ve un mensaje genérico de sección restringida, sin pistas de lo que guarda. La ruta interna es `/notas` (la antigua `/boveda` redirige). El cambio es solo de presentación: los mecanismos de protección de abajo no cambian.

Doble capa de protección:

1. **Autenticación de usuario** con Supabase Auth (correo y contraseña de cada técnico). Las políticas de seguridad por fila (RLS) hacen que solo los usuarios autorizados puedan siquiera descargar las credenciales cifradas. La contraseña inicial la asigna el administrador al crear la cuenta; cada técnico puede cambiarla desde la app (página "Mi cuenta", previa verificación de la contraseña actual contra el servidor).
2. **Contraseña maestra de la bóveda**: al abrir la sección se pide una contraseña adicional que deriva la clave de cifrado (PBKDF2 + AES-256-GCM) en el propio teléfono. Las credenciales viven siempre cifradas, tanto en Supabase como en el dispositivo. El servidor nunca ve una contraseña en texto plano.

Además:

- Autobloqueo de la bóveda tras unos minutos de inactividad (configurable).
- Si alguien roba un teléfono o accede a la base de datos, solo encuentra bloques cifrados.
- Los pasos de un procedimiento de Soluciones pueden vincular una credencial, mostrada como el apartado "Datos" del paso. El apartado va contraído por defecto (los secretos no se muestran hasta tocarlo) y verlo exige exactamente lo mismo que en la sección Notas: permiso puede_ver_boveda y contraseña maestra (con desbloqueo en el propio paso y el mismo autobloqueo). Quien no está autorizado solo ve el título de referencia del vínculo. El comportamiento es idéntico en subprocedimientos y soluciones anidados porque reutilizan el mismo componente.

## 9. Historial de cambios

- Cada creación, edición o eliminación registra automáticamente: usuario, fecha y hora, entidad afectada, campo modificado, valor anterior, valor nuevo y motivo (campo opcional al guardar).
- Visible en cada ficha con "Ver historial" y sincronizado entre todo el equipo.
- Los cambios hechos offline también generan su registro y se suben al reconectar.

## 10. Limitaciones y riesgos conocidos

- Supabase pausa los proyectos gratuitos tras 7 días sin uso. Con uso diario del equipo no ocurre; como respaldo, un workflow de GitHub Actions (`.github/workflows/ping-supabase.yml`) consulta la API los lunes y jueves. Aviso: GitHub desactiva los workflows programados de repos públicos tras 60 días sin actividad en el repositorio; avisa por correo y se reactivan con un clic en la pestaña Actions.
- El almacenamiento gratuito de archivos es de 1 GB. La app comprimirá las fotos automáticamente al subirlas para aprovecharlo (pendiente, ver tarea 10).
- El plan gratuito de Supabase no incluye copias de seguridad. Como mitigación, un workflow de GitHub Actions (`.github/workflows/respaldo-supabase.yml`) exporta todas las tablas cada domingo, las cifra con AES-256 y las guarda 90 días como artefacto; configuración y restauración en `supabase/RESPALDO.md`. No cubre los archivos del bucket de Storage, solo sus referencias.
- En iPhone, iOS puede borrar los datos locales de una PWA que lleve semanas sin abrirse. La sincronización los restaura al volver a abrir la app.
- Un adjunto subido sin conexión queda visible de inmediato solo en el teléfono que lo adjuntó; el resto del equipo lo ve cuando ese teléfono recupera señal y la cola de subida lo envía (los archivos suben antes que las filas para que nadie reciba un adjunto sin su archivo).

## 11. Estructura de carpetas prevista

```
src/
  app/            configuración, rutas y layout con barra inferior
  features/
    autenticacion/ sesión, login y protección de rutas
    inicio/       pantalla principal, buscador y recientes
    busqueda/     índice MiniSearch (artículos y dispositivos) y resultados agrupados
    soluciones/   categorías, artículos en Markdown y su formulario
    dispositivos/ inventario general con filtros, ficha con campos dinámicos, formulario, etiquetas QR imprimibles e importación masiva desde Excel/CSV
    red/          sección Red: lista de infraestructura (RedPage), topología en árbol (TopologiaPage + arbol.ts) y bloque de conexiones de la ficha (ConexionesFicha.tsx)
    escaner/      escaneo de códigos QR y de barras con la cámara para abrir fichas
    boveda/       sección "Notas": credenciales cifradas (carpeta interna, nombre neutro en la interfaz)
    historial/    registro y visor de cambios
  lib/
    db.ts           base de datos local (Dexie)
    supabase.ts     cliente del backend
    tablas.ts       mapeo entre la base local y las columnas remotas
    repositorio.ts  punto único de escritura: guarda, registra historial y encola
    conexiones.ts   lógica pura de las conexiones de la ficha (agrupar, resumir, ordenar)
    sync.ts         motor de sincronización (subida de cola y descarga por cursor)
    crypto.ts       cifrado de la bóveda
  components/     componentes de interfaz compartidos (incluye Adjuntos.tsx, reutilizable en dispositivos)
supabase/
  schema.sql      esquema de tablas y políticas RLS
```

## 12. Módulo de Red (infraestructura y topología)

Objetivo: un mapa inteligente de la infraestructura donde cualquier técnico localiza un equipo, entiende cómo se interconecta y navega entre sus relaciones en segundos, sin depender del conocimiento de una sola persona.

- **Sin duplicar el inventario**: los racks, puntos de red, switches, access points y cámaras son dispositivos normales (tabla `dispositivos`); su categoría lleva la bandera `es_red`. Así heredan sin costo la búsqueda global, el historial, las fotos, las etiquetas QR, el escáner y la importación masiva desde Excel/CSV (clave porque los puntos de red suelen ser cientos). Lo único propio del módulo es la tabla `conexiones` (ver sección 5) y sus vistas.
- **Ficha con relaciones navegables**: la sección "Conexiones" de cada ficha agrupa las relaciones en "Instalado en", "Contiene" y "Enlaces", cada una enlazando a la ficha del otro extremo. Recorrer la red es seguir esos enlaces: punto de red D80 → Switch D32 → sus dependientes, y así.
- **Topología en árbol**: `TopologiaPage` dibuja un árbol expandible/contraíble. La relación padre → hijo es: en una instalación, el rack es padre del equipo que contiene; en un enlace, el equipo que da servicio es padre del que lo recibe. Así, expandir un switch responde "¿qué dejaría de funcionar si se apaga?". Sin raíz en la URL muestra el bosque completo (racks y switches de núcleo, calculados como los dispositivos que no dependen de ningún otro); con `/red/topologia/:id` arranca desde un equipo. Los ciclos se cortan marcando el nodo repetido, y solo entran al árbol los dispositivos de red o los que participan en alguna conexión.
- **Lógica pura y probada**: `lib/conexiones.ts` (agrupar, resumir y ordenar por puerto de forma natural) y `features/red/arbol.ts` (construir el árbol y el bosque) no dependen de React ni de la base local; tienen sus propias pruebas.

## 13. Fases de desarrollo

El plan de trabajo detallado, con prioridades y ubicaciones, está en [TAREAS.md](TAREAS.md).
