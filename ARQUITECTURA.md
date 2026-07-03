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

## 4. Estructura de navegación (4 pestañas inferiores)

1. **Inicio**: barra de búsqueda global en grande, elementos recientes y accesos rápidos a las categorías más usadas. Abrir la app y buscar toma dos toques.
2. **Soluciones**: rejilla de categorías (POS, Impresoras, Cámaras, Computadores, Redes, Switches, Access Points, CCTV, Servidores, etc.). Dentro de cada categoría, todos los procedimientos agrupados por tipo: instalación, configuración, conexión, problemas frecuentes, mantenimiento y manuales, con imágenes y diagramas.
3. **Dispositivos**: inventario con filtros por tipo, ubicación y estado. Ficha completa por dispositivo con campos según su tipo y su historial de cambios.
4. **Bóveda**: sección bloqueada para direcciones IP, usuarios, contraseñas y configuraciones críticas.

Notas de navegación:

- La búsqueda se combina con Inicio (en lugar de ser una pestaña aparte) porque así la pantalla principal ES el buscador, que es el pilar de la app.
- Las fichas de dispositivos enlazan a los procedimientos de su categoría y viceversa: desde la ficha de una cámara se llega en un toque a "Solución de problemas de cámaras".

## 5. Modelo de datos

- **categorias**: id, nombre, icono, orden.
- **articulos**: id, categoria_id, titulo, tipo (instalación, configuración, conexión, problema frecuente, mantenimiento, manual), contenido en Markdown, etiquetas, procedimiento (JSON opcional: requisitos previos y pasos numerados, cada uno con título, detalle, instrucciones con casilla de verificación, captura, nota, advertencia, consejo, decisión de ramificación, credencial de la bóveda vinculada y subprocedimiento vinculado; si existe, el artículo se muestra como una lista de pasos expandibles con progreso local por técnico: cada paso indica su estado con color (pendiente gris, en progreso ámbar con contador, completado verde) y al marcar la última instrucción de un paso, o al completarse su subprocedimiento vinculado, el paso se completa solo, se contrae y se expande el siguiente pendiente, salvo en pasos con decisión de ramificación, donde la decisión elige el destino; al terminar todo se muestra un banner verde), adjuntos, updated_at, updated_by. Del vínculo con la bóveda el paso guarda solo el id de la credencial y una copia de su título como referencia: los secretos nunca viajan en el artículo. El subprocedimiento vinculado hace jerárquicos y reutilizables los procedimientos: un paso puede referenciar otro artículo con procedimiento (también solo id y título de referencia), su paso a paso completo se despliega dentro del paso con su propio progreso (compartido con el artículo original, y visible como contador "hechos/total" en la fila del paso), y actualizar el subprocedimiento actualiza automáticamente todos los procedimientos que lo usan. La expansión es de un solo nivel: más profundo se muestra como enlace, lo que además corta cualquier ciclo de vínculos.
- **dispositivos**: id, categoria_id, nombre, marca, modelo, serial, placa_inventario, ubicacion, ip, estado, observaciones, detalles (pares clave/valor libres, por ejemplo puerto y switch en una cámara, o usuario asignado y sistema operativo en un computador), updated_at, updated_by. En vez de una plantilla fija por categoría, el formulario deja agregar y quitar campos libremente ("Campos adicionales"): es más simple de mantener y no se rompe si el equipo agrega una categoría nueva o un campo que no se anticipó.
- **credenciales**: id, titulo, categoria, datos_cifrados (bloque AES-256-GCM), updated_at, updated_by. Nunca hay texto plano.
- **historial**: id, entidad_tipo, entidad_id, usuario, fecha_hora, campo, valor_anterior, valor_nuevo, motivo.
- **adjuntos**: id, entidad_tipo, entidad_id, nombre, tipo, referencia en Supabase Storage.

## 6. Búsqueda global

- Índice MiniSearch en memoria construido sobre los datos locales: títulos, contenido, etiquetas, marcas, modelos, direcciones IP y ubicaciones.
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

## 8. Seguridad de la bóveda

Doble capa de protección:

1. **Autenticación de usuario** con Supabase Auth (correo y contraseña de cada técnico). Las políticas de seguridad por fila (RLS) hacen que solo los usuarios autorizados puedan siquiera descargar las credenciales cifradas. La contraseña inicial la asigna el administrador al crear la cuenta; cada técnico puede cambiarla desde la app (página "Mi cuenta", previa verificación de la contraseña actual contra el servidor).
2. **Contraseña maestra de la bóveda**: al abrir la sección se pide una contraseña adicional que deriva la clave de cifrado (PBKDF2 + AES-256-GCM) en el propio teléfono. Las credenciales viven siempre cifradas, tanto en Supabase como en el dispositivo. El servidor nunca ve una contraseña en texto plano.

Además:

- Autobloqueo de la bóveda tras unos minutos de inactividad (configurable).
- Si alguien roba un teléfono o accede a la base de datos, solo encuentra bloques cifrados.
- Los pasos de un procedimiento de Soluciones pueden vincular una credencial de la bóveda. Ver los datos desde el paso exige exactamente lo mismo que en la sección Bóveda: permiso puede_ver_boveda y contraseña maestra (con desbloqueo en línea y el mismo autobloqueo). Quien no está autorizado solo ve el título de referencia del vínculo.

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
    dispositivos/ inventario con filtros, ficha con campos dinámicos, formulario, etiquetas QR imprimibles e importación masiva desde Excel/CSV
    escaner/      escaneo de códigos QR y de barras con la cámara para abrir fichas
    boveda/       credenciales cifradas
    historial/    registro y visor de cambios
  lib/
    db.ts           base de datos local (Dexie)
    supabase.ts     cliente del backend
    tablas.ts       mapeo entre la base local y las columnas remotas
    repositorio.ts  punto único de escritura: guarda, registra historial y encola
    sync.ts         motor de sincronización (subida de cola y descarga por cursor)
    crypto.ts       cifrado de la bóveda
  components/     componentes de interfaz compartidos (incluye Adjuntos.tsx, reutilizable en dispositivos)
supabase/
  schema.sql      esquema de tablas y políticas RLS
```

## 12. Fases de desarrollo

El plan de trabajo detallado, con prioridades y ubicaciones, está en [TAREAS.md](TAREAS.md).
