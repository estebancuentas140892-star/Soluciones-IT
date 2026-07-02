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
| Hosting | Cloudflare Pages o Vercel (gratis) | Publicación de la aplicación |

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
- **articulos**: id, categoria_id, titulo, tipo (instalación, configuración, conexión, problema frecuente, mantenimiento, manual), contenido en Markdown, etiquetas, adjuntos, updated_at, updated_by.
- **dispositivos**: id, categoria_id, nombre, marca, modelo, serial, placa_inventario, ubicacion, ip, estado, observaciones, detalles (campos JSON según el tipo: una cámara guarda puerto y switch al que se conecta; un computador guarda usuario asignado, área y sistema operativo), updated_at, updated_by. Los formularios se generan dinámicamente con una plantilla de campos por tipo de dispositivo.
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
- Adjuntos: se guardan en caché al verlos por primera vez. Habrá un botón "Descargar todo para offline" para dejar el contenido completo en el teléfono antes de salir a un mantenimiento.

## 8. Seguridad de la bóveda

Doble capa de protección:

1. **Autenticación de usuario** con Supabase Auth (correo y contraseña de cada técnico). Las políticas de seguridad por fila (RLS) hacen que solo los usuarios autorizados puedan siquiera descargar las credenciales cifradas.
2. **Contraseña maestra de la bóveda**: al abrir la sección se pide una contraseña adicional que deriva la clave de cifrado (PBKDF2 + AES-256-GCM) en el propio teléfono. Las credenciales viven siempre cifradas, tanto en Supabase como en el dispositivo. El servidor nunca ve una contraseña en texto plano.

Además:

- Autobloqueo de la bóveda tras unos minutos de inactividad (configurable).
- Si alguien roba un teléfono o accede a la base de datos, solo encuentra bloques cifrados.

## 9. Historial de cambios

- Cada creación, edición o eliminación registra automáticamente: usuario, fecha y hora, entidad afectada, campo modificado, valor anterior, valor nuevo y motivo (campo opcional al guardar).
- Visible en cada ficha con "Ver historial" y sincronizado entre todo el equipo.
- Los cambios hechos offline también generan su registro y se suben al reconectar.

## 10. Limitaciones y riesgos conocidos

- Supabase pausa los proyectos gratuitos tras 7 días sin uso. Con uso diario del equipo no ocurre; como respaldo se puede programar un ping semanal automático.
- El almacenamiento gratuito de archivos es de 1 GB. La app comprimirá las fotos automáticamente al subirlas para aprovecharlo.
- En iPhone, iOS puede borrar los datos locales de una PWA que lleve semanas sin abrirse. La sincronización los restaura al volver a abrir la app.

## 11. Estructura de carpetas prevista

```
src/
  app/            configuración, rutas y layout con barra inferior
  features/
    inicio/       pantalla principal, buscador y recientes
    busqueda/     índice y resultados de búsqueda
    soluciones/   categorías y artículos
    dispositivos/ inventario y fichas técnicas
    boveda/       credenciales cifradas
    historial/    registro y visor de cambios
  lib/
    db.ts           base de datos local (Dexie)
    supabase.ts     cliente del backend
    tablas.ts       mapeo entre la base local y las columnas remotas
    repositorio.ts  punto único de escritura: guarda, registra historial y encola
    sync.ts         motor de sincronización (subida de cola y descarga por cursor)
    crypto.ts       cifrado de la bóveda
  components/     componentes de interfaz compartidos
supabase/
  schema.sql      esquema de tablas y políticas RLS
```

## 12. Fases de desarrollo

El plan de trabajo detallado, con prioridades y ubicaciones, está en [TAREAS.md](TAREAS.md).
