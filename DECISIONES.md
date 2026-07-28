# Decisiones de arquitectura

Registro de decisiones de arquitectura (ADR) del proyecto: el **porqué** de cómo está construido el sistema. Es la única fuente de verdad de las decisiones de fondo. El historial de cambios está en [CHANGELOG.md](CHANGELOG.md); las reglas de trabajo del equipo en [REGLAS.md](REGLAS.md); el comportamiento que estas decisiones producen en [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md).

Cada decisión indica su estado (Vigente / Revisada / Descartada), su contexto, la decisión tomada y sus consecuencias. Las propuestas de mayor alcance que originaron varias de estas decisiones viven en los archivos `PROPUESTA_*.md` (en su mayoría ya implementadas) y se enlazan desde aquí.

---

## AD-001. Aplicación web progresiva (PWA), no app nativa

- **Estado:** Vigente (2026-07-02).
- **Contexto:** un equipo de 5 técnicos necesita la misma información en Android, iPhone y PC, con funcionamiento offline y sin fricción de distribución.
- **Decisión:** PWA instalable desde el navegador ("Agregar a pantalla de inicio"), sin tiendas ni APK.
- **Consecuencias:** actualizaciones automáticas al publicar; funciona igual en todas las plataformas; usa las tecnologías más extendidas. En iPhone, iOS puede borrar los datos locales tras semanas sin abrir la app (se restauran al sincronizar).

## AD-002. Offline primero con Dexie local y Supabase como backend

- **Estado:** Vigente.
- **Contexto:** el técnico suele trabajar en sitios sin buena señal; la app no puede depender de la red para leer o escribir.
- **Decisión:** toda la información vive en IndexedDB (Dexie) y se consulta al instante sin red; una cola de salida sincroniza con Supabase (Postgres + Auth + Storage) al reconectar. Detalle en [ARQUITECTURA.md](ARQUITECTURA.md), sección 7.
- **Consecuencias:** lecturas y escrituras nunca esperan a la red; se necesita un motor de sincronización y una estrategia de conflictos (AD-005).

## AD-003. Cada dato existe una sola vez; todo lo demás lo referencia

- **Estado:** Vigente. Principio rector del producto ([PROPUESTA_BASE_CONOCIMIENTO.md](PROPUESTA_BASE_CONOCIMIENTO.md)).
- **Contexto:** la duplicación de datos (la misma ubicación escrita de tres formas, un secreto repetido en una credencial y en un equipo) fragmenta la información y genera conflictos.
- **Decisión:** los vínculos se guardan por `id` más una copia de referencia (caché de presentación). La "referencia viva" (`src/lib/referencia.ts`) resuelve el dato actual contra la fila real y solo cae a la copia si la fila falta o fue eliminada.
- **Consecuencias:** renombrar una entidad se refleja al instante sin reescribir filas ajenas (cero conflictos de propagación). Los registros inmutables son la excepción: congelan el texto a propósito.

## AD-004. El grafo de referencias es derivado, no almacenado

- **Estado:** Vigente.
- **Contexto:** hace falta saber "quién usa esto" y avisar el impacto antes de eliminar, sin agregar esquema ni sincronización nueva.
- **Decisión:** `src/lib/grafo.ts` reconstruye el grafo en memoria desde los datos locales, igual que el índice de búsqueda; no se persiste.
- **Consecuencias:** no puede quedar desactualizado; agregar un vínculo nuevo no requiere migración. Ubicación y persona quedaron fuera del grafo (usan avisos ad-hoc); se registró como precisión pendiente.

## AD-005. Conflictos: gana la última escritura por fila, el historial conserva ambos

- **Estado:** Vigente (endurecido en 2026-07-19).
- **Contexto:** dos técnicos pueden editar la misma ficha offline.
- **Decisión:** resolución por última escritura, a nivel de fila completa (no por campo). El conflicto se detecta comparando el `updated_at` base y se avisa en el panel de sincronización, sin bloquear; el historial guarda ambos cambios. Una descarga nunca pisa una fila con un cambio local pendiente.
- **Consecuencias:** simplicidad frente a una fusión por campo; ningún dato se pierde de forma irrecuperable. Ver [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md), sección 9.

## AD-006. Realtime como señal, nunca como fuente de datos

- **Estado:** Vigente (2026-07-17).
- **Contexto:** el sondeo cada 2 minutos deja un retraso perceptible entre dispositivos, pero aplicar el payload de un evento de Realtime podría entregar un dato que el receptor no debe ver (una credencial sin permiso de bóveda).
- **Decisión:** un único canal de Supabase Realtime solo dispara una descarga normal (que respeta la RLS por consulta); el evento nunca aporta datos. El sondeo queda como red de seguridad.
- **Consecuencias:** latencia de 1 a 2 segundos sin filtrar datos por permiso.

## AD-007. Contraseña maestra única para todo el equipo

- **Estado:** Vigente (cambio del 2026-07-17; revisó el modelo anterior por persona).
- **Contexto:** una contraseña maestra por técnico complicaba compartir la bóveda y autorizar eliminaciones sensibles offline.
- **Decisión:** la contraseña maestra es única, anclada al servidor mediante un verificador cifrado en `boveda_meta`. Además de abrir la bóveda, autoriza las eliminaciones sensibles sin exigir `puede_ver_boveda`.
- **Consecuencias:** el cifrado ya no distingue quién puede ver un secreto; la RLS por permiso es la única barrera real (de ahí AD-008). Restablecerla exige el panel de Supabase y arranca la bóveda de cero.

## AD-008. Los datos sensibles viven en tablas con la RLS de bóveda, nunca en columnas de lectura general

- **Estado:** Vigente ([PROPUESTA_SEGURIDAD_DISPOSITIVO.md](PROPUESTA_SEGURIDAD_DISPOSITIVO.md), grupo P1).
- **Contexto:** guardar un dato sensible de un equipo obligaba a crear una credencial suelta que duplicaba su identidad; meterlo como columna de `dispositivos` lo dejaría descargable por cualquier técnico.
- **Decisión:** los datos sensibles de un equipo viven en `campos_protegidos`, una tabla propia con la misma RLS, clave, desbloqueo y auditoría que `credenciales`. Solo el valor se cifra; los metadatos viajan en claro para poder listar y vincular sin desbloquear.
- **Consecuencias:** todo dato secreto nuevo debe seguir esta regla (RN-024). El archivo seguro va a un bucket propio `archivos_boveda` con las mismas políticas.

## AD-009. Sin roles con nombre; el permiso de bóveda se administra fuera de la app

- **Estado:** Vigente.
- **Contexto:** un equipo de 5 personas de confianza no necesita un sistema de roles.
- **Decisión:** solo existe "técnico autenticado" y el booleano `perfiles.puede_ver_boveda`. La creación de cuentas y el cambio de ese permiso se hacen en el panel de Supabase; no hay pantalla de administración de usuarios en la app.
- **Consecuencias:** modelo de permisos simple (ver la matriz en [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md), sección 5). Administrar usuarios no es una funcionalidad pendiente, es infraestructura por diseño.

## AD-010. Borrado lógico universal y auditoría append-only

- **Estado:** Vigente.
- **Contexto:** hace falta recuperar datos, propagar eliminaciones por Realtime y conservar la trazabilidad.
- **Decisión:** todo borrado desde la app es lógico (`eliminado_en`), nunca físico. `historial`, `ejecuciones_diagnostico` y `accesos_boveda` son solo inserción.
- **Consecuencias:** nada se pierde de forma irreversible; las eliminaciones se propagan como UPDATE. Eliminar un dispositivo no cae en cascada (de ahí el flujo asistido "Dar de baja").

## AD-011. Tema oscuro único (sistema Nocturne)

- **Estado:** Vigente (2026-07-17).
- **Contexto:** decisión de diseño del usuario.
- **Decisión:** la app es de tema oscuro únicamente; no hay modo claro ni conmutador. Un handoff de diseño en tema claro se traduce a Nocturne antes de implementarlo.
- **Consecuencias:** un solo sistema de color que mantener; tres lenguajes de color que no se mezclan (estado, tipo de documento, identidad de categoría).

## AD-012. Bloqueo de la app: patrón o contraseña, nunca biometría

- **Estado:** Vigente.
- **Contexto:** proteger el acceso casual con el teléfono en mano, sin exigir un dato biométrico que no todos quieren entregar.
- **Decisión:** cada técnico configura en su dispositivo un patrón o contraseña corta (nunca huella ni rostro). Es una capa de acceso, no de cifrado: los datos generales siguen en IndexedDB en texto legible; lo secreto sigue cifrado con la contraseña maestra.
- **Consecuencias:** tres capas de acceso independientes (sesión, bloqueo de app, contraseña maestra). Detalle en [ARQUITECTURA.md](ARQUITECTURA.md), sección 14.

## AD-013. Sin exportación de datos desde la app

- **Estado:** Vigente.
- **Contexto:** una función de exportación sería un vector de fuga masiva por la interfaz.
- **Decisión:** la app no exporta inventario, bóveda ni historial; la única descarga es la plantilla CSV vacía de importación. Los respaldos se hacen por GitHub Actions, fuera de la app.
- **Consecuencias:** RN-026. Toda extracción de datos pasa por infraestructura, no por la interfaz.

## AD-014. Navegación "Up" por padre lógico declarado, no historial del navegador

- **Estado:** Vigente (2026-07-18).
- **Contexto:** hay flujos hacia adelante (guardar y quedar en la ficha nueva) donde retroceder en el historial caería en el formulario recién enviado.
- **Decisión:** `src/lib/navegacion.ts` (`padreDe`) es la única fuente del padre lógico de cada ruta; `BotonVolver` lo deriva de ahí. Ninguna pantalla cablea su destino a mano.
- **Consecuencias:** un rediseño no puede dejar un "Volver" apuntando a una pantalla obsoleta. Único override en runtime: la ficha de un equipo de red vuelve a Red.

## AD-015. `schema.sql` es el contrato de sincronización, verificado por prueba

- **Estado:** Vigente (2026-07-22, tras un incidente real de producción).
- **Contexto:** una columna sincronizada por la app pero ausente en el servidor hace que PostgREST rechace la fila entera y el cambio se reintente para siempre.
- **Decisión:** toda columna sincronizada debe declararse en `src/lib/tablas.ts` y en `supabase/schema.sql` en el mismo cambio; una columna en `camposOpcionales` no debe tener default. La prueba `src/lib/esquema.test.ts` lo verifica y falla si se olvida.
- **Consecuencias:** el despliegue deja de depender de aplicar el SQL a tiempo para las columnas opcionales. Es la regla 17 de [REGLAS.md](REGLAS.md).

## AD-016. Tres estados de artículo, sin "en revisión"

- **Estado:** Vigente (2026-07-09).
- **Contexto:** un flujo de aprobación formal no tiene sentido en un equipo de 5.
- **Decisión:** `borrador | publicado | obsoleto`, con default `publicado` para que lo existente quedara oficial sin migración.
- **Consecuencias:** un borrador u obsoleto se excluye del buscador, rutas de inicio, vinculables y Diagnóstico, salvo para quien lo edita.

## AD-017. Ubicación y persona como entidades propias

- **Estado:** Vigente (N3, 2026-07-17; T1, 2026-07-22).
- **Contexto:** la ubicación y el responsable eran texto libre, con variantes de escritura que fragmentaban el dato.
- **Decisión:** `ubicaciones` (con jerarquía opcional) y `personas` (sin jerarquía) son entidades; el texto libre queda como copia de referencia. Una migración asistida idempotente convierte los textos históricos.
- **Consecuencias:** cierran una duplicación grande, pero quedaron fuera del grafo derivado (AD-004); sus avisos de impacto se calculan aparte.

## AD-018. La documentación es la única fuente de verdad, en un set de documentos con frontera clara

- **Estado:** Vigente (2026-07-24, tarea 167).
- **Contexto:** la documentación mezclaba lo visible con lo interno, estaba dispersa y no cubría de forma sistemática reglas de negocio, permisos, estados ni eventos.
- **Decisión:** separar la documentación en documentos con responsabilidad única: `ARQUITECTURA.md` (técnico), `ARQUITECTURA_FUNCIONAL.md` (comportamiento interno), `DOCUMENTACION_FUNCIONAL.md` (visible al usuario), `COMPONENTES_UI.md`, `BUSCADOR.md`, `DECISIONES.md` y `CHANGELOG.md`. Cada concepto en un solo lugar; los demás lo referencian.
- **Consecuencias:** menos duplicación y mayor mantenibilidad; obliga a actualizar el documento correcto en la misma tarea que el código (REGLAS.md regla 19).

## AD-019. Un solo lenguaje de color por superficie (reglas R1 a R7 de la sección Soluciones)

- **Estado:** Vigente (2026-07-27, auditoría de diseño de la sección Soluciones).
- **Contexto:** la app mantiene a propósito tres lenguajes de color (estado de equipo, tipo de documento y categoría, ver AD-011 y `coloresCategoria.ts`), pero nada decía cómo convivían **en la misma superficie**. En la lista de Soluciones acabaron mezclados: seis recuadros de color relleno por tipo en la misma columna hacían que el color dejara de informar y compitiera con el título, que es lo único que se lee de verdad.
- **Decisión:** siete reglas visuales para toda la sección, extraídas de la auditoría:
  - **R1 · Color con oficio.** Un solo lenguaje de color por superficie. El tipo tiñe el glifo; la categoría, el chip; el estado, la pastilla. Nunca dos a la vez en la misma fila.
  - **R2 · Piso de contraste.** Texto bajo 14 px no baja de `neutral-400`. `neutral-600` queda solo para bordes y separadores (a 11 px daba 4.0:1 sobre el fondo y AA pide 4.5).
  - **R3 · Sin controles muertos.** Ningún botón desactivado cuya única explicación sea un `title`: en un teléfono no hay hover, así que nadie lo lee. O guía, o no está.
  - **R4 · Un eje de filtro visible.** El segundo eje se plega en hoja inferior con su contador.
  - **R5 · Estado vacío = camino.** Todo vacío nombra qué falta y ofrece la acción que lo llena.
  - **R6 · Toque de 44.** Cualquier objetivo táctil mide 44 px reales, aunque el icono mida 18.
  - **R7 · La app dice qué sabe.** Toda pantalla de lista muestra frescura del dato y cambios sin subir.
- **Consecuencias:** no cambian los tokens ni los tres lenguajes de color (AD-011 sigue vigente), solo cómo se combinan. Se aplican primero en `/soluciones` y quedan como criterio para las cuatro pantallas restantes de la sección y para las listas del resto de la app.

## AD-020. `FilaArticulo` unifica las dos filas de artículo, no la fila de artículo con la de dispositivo

- **Estado:** Vigente (2026-07-27). Matiza, sin contradecir, la decisión de la tarea 145.
- **Contexto:** la tarea 145 (2026-07-23) evaluó crear `<FilaArticulo>` y lo **descartó** con motivo escrito: "la fila de Soluciones comparte el contenedor pero nada de su interior... forzar un componente común exigiría más props condicionales que líneas compartidas". Esa comparación era contra `FilaDispositivo` y la fila de Red, y sigue siendo correcta. La auditoría de diseño de 2026-07-27 pide `FilaArticulo` para otra cosa: unificar las **dos filas de artículo** (`SolucionesPage` y `CategoriaPage`), que sí comparten interior.
- **Decisión:** `src/features/soluciones/FilaArticulo.tsx` es la fila de artículo compartida por las dos pantallas de Soluciones. **No** se unifica con `FilaDispositivo`: son dominios distintos y el motivo de la tarea 145 sigue en pie.
- **Consecuencias:** el rediseño hace converger a propósito lo que antes divergía sin razón (mismo recuadro neutro, misma línea de metadatos, misma ranura de estado), así que el componente no necesita las props condicionales que la tarea 145 temía. Vive en `src/features/soluciones/` y no en `src/components/` porque sus dos consumidores están en esa feature (convención de la sección 6 de [COMPONENTES_UI.md](COMPONENTES_UI.md)).

## AD-021. El rediseño de la sección Soluciones se resuelve primero a 448 px; escritorio se conserva

- **Estado:** Vigente (2026-07-27, decisión del usuario al autorizar el handoff).
- **Contexto:** la auditoría resolvió las cinco pantallas de Soluciones solo a 448 px (la columna real del shell móvil) y dejó el rediseño de escritorio como pendiente explícito. Pero `SolucionesPage` ya tenía layout propio de escritorio: rail de categorías a la izquierda y rejilla de 2-3 columnas desde `xl`.
- **Decisión:** aplicar el rediseño a móvil/estrecho y **conservar intacto** el layout de escritorio existente, en vez de retirarlo o de escalar el diseño de 448 px.
- **Consecuencias:** cero regresión en PC, pero durante un tiempo conviven dos criterios en el mismo componente (el eje "Tipo" va plegado en hoja en móvil y desplegado en el rail en escritorio). Queda registrado en [TAREAS.md](TAREAS.md) el rediseño de escritorio de las cinco pantallas como tarea propia. **Superada en parte el 2026-07-28**: el turno 2 del handoff ya trae el diseño de escritorio, así que la tarea 176 dejó de ser un pendiente sin mockup.

## AD-022. Un solo nombre visible: "Soluciones IT", con las secciones Guías y Equipos (regla R12)

- **Estado:** Vigente (2026-07-28, decisión del usuario registrada en `Decisiones aprobadas.md` del handoff).
- **Contexto:** la app se presentaba con **dos nombres**. El login y la pantalla de bloqueo decían "Soluciones IT"; Inicio y el sidebar decían "IT Brain". Es lo primero que lee un técnico nuevo, en las tres primeras pantallas que ve. Además Inicio era la única pestaña cuyo encabezado no repetía el rótulo de su pestaña, así que la señal de ubicación se perdía justo en la pantalla de entrada. Por otro lado, "Soluciones" nombraba a la vez la app y una sección, y le quitaba la palabra al bloque "solución" anidado dentro de un paso, que es donde de verdad significa algo.
- **Decisión:** la app se llama **"Soluciones IT"** en toda la interfaz y "IT Brain" se retira de la pantalla (puede seguir siendo el nombre interno del proyecto; el glifo del cerebro se conserva como marca). La sección Soluciones pasa a llamarse **"Guías"** y la sección Dispositivos pasa a llamarse **"Equipos"**, que es como habla el equipo y además acorta el rótulo más largo de la barra de pestañas. El encabezado de Inicio pasa a decir "Inicio".
- **Consecuencias:** las **rutas no cambian**. `/soluciones` y `/dispositivos` se conservan tal cual, porque el handoff solo pide el cambio visible y renombrarlas invalidaría los enlaces profundos que el equipo ya tiene compartidos y guardados en sus teléfonos; el coste es que la URL y el rótulo dejan de coincidir, algo que en una PWA de teléfono casi no se ve. Los identificadores de código (`SolucionesPage`, `DispositivoForm`, la tabla `dispositivos`) siguen en su nombre original por la regla 9 de [REGLAS.md](REGLAS.md). El vocabulario visible del inventario se unifica en "equipo": los textos que decían "dispositivo" refiriéndose a una ficha del inventario pasan a "equipo", **salvo** los que hablan del teléfono del técnico ("quedó guardado en este dispositivo", "bloqueo de este dispositivo"), que conservan la palabra porque ahí significa otra cosa.

## AD-023. La fila superior es solo del chasis; las acciones de la pantalla van debajo

- **Estado:** Vigente (2026-07-28, tarea 181).
- **Contexto:** el handoff se contradice a sí mismo entre turnos, porque cada uno miró la misma pantalla desde otro sitio. El **turno 1** (mockup `1c`, la lista de Guías ya implementada en la tarea 171) dibuja "Crear" arriba, junto al título. El **turno 3** (mockup `3d`) declara que la fila superior tiene exactamente tres ranuras fijas en las cinco pestañas: título · estado del dato · buscar + cuenta. Las dos cosas no caben: en 448 px, "Crear" más la pastilla más la lupa más el avatar dejarían el título sin ancho, y cada pantalla volvería a colocar sus controles donde le cupiera, que es justo el problema que la barra viene a resolver ("los controles no caen nunca en el mismo sitio").
- **Decisión:** manda el turno 3, que es el que legisla el chasis. La fila del título lleva **solo** las tres ranuras globales. Las acciones propias de cada pantalla ("Crear", "Escanear", el menú "···", el subtítulo, la pastilla de frescura) bajan a la banda de controles que `BarraSuperior` dibuja justo debajo, dentro del mismo bloque pegajoso.
- **Consecuencias:** ninguna acción se pierde ni cambia de comportamiento, solo de fila. La cabecera de las cinco pestañas gana una línea y la pierde por otro lado: el título deja de repetirse dentro de la pantalla. Los subtítulos de sección ("Qué se sabe de cada equipo", "Cómo está conectada la infraestructura") suben de `neutral-500` a `neutral-400` al pasar a esa banda, para cumplir la regla **R2** (nada por debajo de 14 px baja de `neutral-400`).
