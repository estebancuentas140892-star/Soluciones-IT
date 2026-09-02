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
- **Consecuencias:** cero regresión en PC, pero durante un tiempo conviven dos criterios en el mismo componente (el eje "Tipo" va plegado en hoja en móvil y desplegado en el rail en escritorio). Queda registrado en [TAREAS.md](TAREAS.md) el rediseño de escritorio de las cinco pantallas como tarea propia. **Superada en parte el 2026-07-28**: el turno 2 del handoff ya trae el diseño de escritorio, así que la tarea 176 dejó de ser un pendiente sin mockup. **Desde el 2026-07-30 ese trabajo es la tarea 199**, que absorbió la 176 al coincidir con el turno 5.

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

## AD-024. Ubicaciones y Personas suben a "Más", no a Equipos; Etiquetas e Importar se quedan en Equipos

- **Estado:** Vigente (2026-07-28, tarea 182).
- **Contexto:** la Bóveda deja de ser pestaña móvil y pasa a encabezar "Más" (decisión aprobada por el usuario en `Decisiones aprobadas.md`), que además da puerta a Diagnóstico, Escanear, Ubicaciones, Personas, Etiquetas QR e Importar, hasta ahora sin ninguna (regla **R15**). Cuatro de esos ocho ya eran alcanzables desde el menú "···" de Equipos (Ubicaciones, Personas, Etiquetas QR, Importar); el problema #3 del turno 3 de la auditoría señaló en concreto que el "Volver" de Ubicaciones y Personas subía a Equipos "aunque nada en la interfaz las presente como parte de esa sección", así que quien llegaba por un enlace profundo aterrizaba en una jerarquía que no había recorrido.
- **Decisión:** con "Más" como puerta nueva, `padreDe` (`src/lib/navegacion.ts`) deja de subir Ubicaciones y Personas a Equipos: su padre pasa a ser "Más". Etiquetas QR e Importar, en cambio, **conservan** a Equipos como padre: son acciones sobre el inventario de equipos (imprimir sus etiquetas, cargarlos en bloque), su camino principal sigue siendo el "···" de esa sección, y "Más" es ahí una puerta secundaria, no la canónica.
- **Consecuencias:** `UbicacionesPage.tsx` y `PersonasPage.tsx` dejan de pasarle un `to`/`children` fijo a `BotonVolver` (que apuntaba a Equipos a mano) y usan el valor por defecto, ahora resuelto por `padreDe`. Un enlace guardado a `/ubicaciones` o `/personas` antes de esta tarea sigue funcionando igual: la ruta no cambió, solo su "Volver".

## AD-025. El login se presenta sin nombrar la organización, y "¿La olvidaste?" dice el camino real

- **Estado:** Vigente (2026-07-28, tarea 184; las dos decisiones las tomó el usuario al empezar la tarea).
- **Contexto:** el turno 3 del handoff pide un login que "se presente": marca, una línea de qué es esto y de quién es, "¿la olvidaste?" y a quién pedir acceso. El mockup lo escribe con datos concretos que **no existen en el repositorio**: nombra una organización ("la base de conocimiento del equipo de soporte de Metroparques") y un correo de ejemplo con su dominio, y deja el enlace de contraseña olvidada dibujado sin decir a dónde lleva. La app, además, no tiene ningún flujo de recuperación: la contraseña inicial la asigna el administrador en el panel de Supabase y cambiarla desde la app exige conocer la actual (`CuentaPage`).
- **Decisión:** (a) **la línea de presentación no nombra a la organización**: dice "La base de conocimiento del equipo de soporte y mantenimiento de TI.". (b) **"¿La olvidaste?" no envía correos de recuperación**: abre un panel que dice el camino real (pedirle al administrador una contraseña nueva desde Supabase, y cambiarla luego en Mi cuenta), y distingue esta contraseña del bloqueo del teléfono, que se resuelve en su propia pantalla. (c) El **correo sí** se autocompleta (`autocomplete="username"`); la contraseña sigue fuera del gestor.
- **Consecuencias:** (a) un rótulo con el nombre de la empresa envejece mal (cambia el nombre, cambia la empresa) y aquí no aporta nada que el técnico no sepa; el texto queda válido sin depender de un dato que el repositorio no tiene. (b) El enlace deja de prometer algo que la app no hace, que es peor que no tenerlo: R3 ("sin controles muertos") aplica igual a un control que sí responde pero a nada. Construir el flujo real (`resetPasswordForEmail` más una pantalla para fijar la contraseña con el enlace recibido) exigiría configurar en Supabase la URL de redirección y un SMTP propio, porque el correo por defecto está muy limitado; el usuario decidió **no** agendarlo por ahora. (c) El `autoComplete="off"` del `<form>` se retiró: puesto ahí anulaba también la pista del correo. Escribir el correo entero cada vez, en un teclado de teléfono, no protegía nada; lo que hay que mantener fuera del gestor es la contraseña, y de eso ya se encarga `CampoContrasena` con texto enmascarado por CSS, que impide que el llavero reconozca el formulario como un login.

## AD-026. Tres niveles de chasis, un solo componente, y el nivel "tarea" es el único sin pestañas

- **Estado:** Vigente (2026-07-28, tarea 185).
- **Contexto:** convivían **dos chasis**. Trece pantallas montaban `ShellNocturne` (sidebar y pestañas); las otras veinticinco montaban a mano un `mx-auto max-w-md` con su propia cabecera. El resultado no se notaba en ninguna pantalla suelta sino en el trayecto: pasar de la ficha al editor apagaba la navegación y ponía otra barra fija en su lugar sin decir nada, y tres listas que se recorren durante minutos (Personas, Ubicaciones, Diagnósticos) habían quedado como islas con una sola salida, por aplicarles la regla de "pantalla enfocada" donde no correspondía.
- **Decisión:** un solo componente `Chasis` con `modo = seccion | documento | tarea` (regla **R18**), y cada pantalla declara el suyo. La barra de pestañas **solo** cede ante una tarea con salida (editor, asistente, escáner, importador, migración), y quien la quita pone una `BarraTarea` que orienta: rótulo de lo que se hace, sobre qué, la ruta de vuelta escrita y una X (regla **R19**). El chasis reserva además su propio espacio inferior (regla **R22**), así que desaparece el `pb-[116px]` que once pantallas escribían a mano.
- **Consecuencias:** (a) `ShellNocturne.tsx` se elimina; `BotonVolver`, que llamaban 31 archivos, queda con **dos** consumidores (el chasis y `BarraTarea`). (b) Las cabeceras de nivel documento se unifican en una sola gramática (regreso a la izquierda, acciones a la derecha), así que varias pantallas ganan cabecera pegajosa, que antes no tenían. (c) Personas, Ubicaciones, Diagnósticos, Sugerencias, Estadísticas, Mi cuenta y Seguridad recuperan la barra de pestañas. (d) Tres pantallas conservan su contenedor propio y usan `BarraTarea` suelta, con motivo escrito: el escáner (el video va detrás a pantalla completa), las etiquetas (la hoja de impresión vive fuera de la columna) y, por su shell de 3 pasos, el importador. (e) En escritorio el nivel `tarea` sigue sin sidebar y con la columna de 448 px que ya tenía: darle ancho propio a los editores es la tarea 199 (era la 176, absorbida el 2026-07-30), que trae su mockup.

## AD-027. El espacio que reserva el chasis se mide en el navegador, no se copia de la auditoría

- **Estado:** Vigente (2026-07-28, tarea 185).
- **Contexto:** la auditoría del turno 4 señala que once pantallas escriben `pb-[116px]` a mano "para una barra que mide 53". Al implementar la reserva se midió la barra real en el navegador: **64,6 px** (63,6 de celda más 1 de borde). El dato de la auditoría es anterior a la tarea 182, que subió las celdas a 52 px de mínimo y el rótulo a 12 px; el contenido real de la celda (icono de 22 + rótulo + 19 de relleno) desborda ese mínimo.
- **Decisión:** el chasis reserva `calc(65px + env(safe-area-inset-bottom))`, valor medido, y el comentario del código dice de dónde sale y por qué el 53 del handoff ya no vale.
- **Consecuencias:** haber copiado el 53 habría dejado unos 12 px de contenido bajo la barra en toda pantalla cuyo `pb` propio fuera pequeño, un defecto invisible en revisión de código y visible solo en el teléfono. Cuando la barra cambie de alto habrá que volver a medir: el número vive en una sola constante (`ALTO_PESTANAS`), no en once archivos.

## AD-028. Cuatro puntos de quiebre, y el de 1680 px se declara en rem

- **Estado:** Vigente (2026-07-30, tarea 191).
- **Contexto:** el chasis venía con los puntos de quiebre por defecto de Tailwind (640/768/1024/1536) y **solo el de 1024 cambiaba algo estructural**: `sm` y `2xl` movían el ancho máximo de la columna sin recomponer nada. El turno 5 del handoff mide el resultado: entre 768 y 1023 la sidebar aún no aparecía, el contenido ya medía 768 y la barra de pestañas seguía anclada a 448 px centrados, es decir, una isla flotante en cualquier iPad en horizontal o ventana a media pantalla.
- **Decisión:** cuatro puntos y cuatro composiciones completas (regla **R30**), expresados con `md` (768), `xl` (1280) y un `3xl` propio (1680); `sm`, `lg` y `2xl` quedan libres para lo que reflujan las pantallas por dentro. La sidebar tiene dos formas, rail de iconos de 64 px y completa de 240 (232 desde 1680), y la barra de pestañas se retira en el mismo punto en que aparece el rail, así que nunca hay un ancho sin navegación de escritorio ni con la barra anclada por debajo del contenido.
- **El `3xl` se declara en rem (`105rem`), no en px.** No es cosmético: Tailwind ordena las media queries por valor y no compara unidades distintas, así que un punto de quiebre en px se emite ANTES del bloque de los que están en rem. Declarado como `1680px`, la regla quedaba delante de las de `sm`/`md`/`lg`/`xl` y `xl:w-60` pisaba a `3xl:w-[232px]`: la sidebar seguía midiendo 240 a 1680 px **aunque la media query coincidiera**. Se detectó midiendo en el navegador, no leyendo el código.
- **Consecuencias:** el tope de la columna crece y nunca se estrecha (448 → hasta 1040 → hasta 1294 desde 1680). La primera versión dejaba la banda de tableta sin tope y el de 1040 aparecía en `xl`, lo que producía una columna de 1200 px a 1279 y de 1040 a 1280: el contenido se estrechaba al ensanchar la ventana. Cualquier punto de quiebre nuevo se declara en rem y se verifica midiendo, no solo comprobando que la media query coincide.

## AD-029. Las reglas móviles M-R1 a M-R14 acotan a R1-R41, no las sustituyen

- **Estado:** Vigente (2026-08-03, tarea 201). Origen: handoff "Auditoría móvil: hallazgos y evidencia" (`Auditoría móvil.dc.html` y `Evidencia móvil.dc.html`), 34 hallazgos y 13 áreas recorridas.
- **Contexto:** las 41 reglas visuales acumuladas (R1 a R41) nacieron de auditorías de sección y de escritorio. La auditoría móvil las revisa con un criterio distinto y más estrecho: si un técnico de pie frente a un rack, con una mano y guantes puestos, sabe **dónde está**, **qué está viendo** y **cuál es la siguiente acción** sin pensar en la interfaz. Su conclusión en una frase: la orientación está resuelta en la entrada de cada pantalla y **se disuelve al desplazarse**.
- **Decisión:** se adoptan las catorce reglas M-R1 a M-R14 como bloque propio, con numeración propia, que **complementa** R1-R41 acotando qué significa cada una en un teléfono. Ninguna deroga una regla vigente.

  | Regla | Qué obliga |
  |---|---|
  | **M-R1** | Anclaje permanente: en documento y tarea, el nombre de lo que se ve permanece en pantalla al desplazarse, a 14 px, junto al regreso. Extiende R14 a los niveles 2 y 3. |
  | **M-R2** | Volver es deshacer el último salto, no subir al padre teórico, y el rótulo nombra el destino real. Matiza R13 y R20. |
  | **M-R3** | Una acción dominante, fija abajo, de 52 px, con su promesa escrita en una línea. Si una pantalla no puede nombrar su acción dominante, le falta jerarquía. |
  | **M-R4** | Cuatro capas de ficha: Ahora · Contexto · Acción · Profundidad. Solo las dos primeras abiertas; plegar exige mostrar el conteo. |
  | **M-R5** | Piso del dato técnico: IP, serial, placa, MAC, puerto y clave se leen a 13 px monoespaciado como mínimo, nunca por debajo de `neutral-300`, tabulares y copiables con 44 px. Endurece R2 para datos. |
  | **M-R6** | Una fila, un significado. Dos bloques con la misma forma tienen la misma naturaleza; si no, cambian de forma. Complementa R1. |
  | **M-R7** | Cinco bloques por pantalla de sección, y el sexto se pliega o se va a su propia puerta. |
  | **M-R8** | Un buscador por pantalla, de 46 px, con el alcance escrito y el mismo vocabulario en toda la app. |
  | **M-R9** | El aviso se resuelve detrás de su puerta: un contador sobre una pestaña obliga a que su pantalla muestre lo contado. Endurece R23. |
  | **M-R10** | La autoría tiene una sola puerta por pantalla, nombrada, al pie. El teléfono consulta y ejecuta; el ordenador documenta. |
  | **M-R11** | Advertencia = un solo canal. Ámbar con icono y borde es advertencia y nada más; la profundidad se dibuja con sangría y línea. |
  | **M-R12** | Lo irreversible no comparte forma con lo reversible, ni comparte fila, ni vive en la zona del pulgar. |
  | **M-R13** | Se diseña a 360 y se verifica a 412: ningún relleno lateral mayor de 16, ninguna etiqueta de ancho fijo mayor de 96, ningún valor truncado que sea el motivo de la visita. |
  | **M-R14** | Toque real de 44, y 48 en la acción dominante, con 8 px de separación entre objetivos vecinos. Aplica también a los controles que parecen decorativos. Endurece R6. |

- **Los tres conflictos declarados, resueltos:**
  - **M-R5 contra R2.** R2 fija el piso de contraste en `neutral-400` para texto bajo 14 px y deja `neutral-600` "para bordes y separadores". La IP de las listas estaba en `neutral-600`, es decir **ya incumplía R2**. Es un conflicto de grado, no de dirección: se adopta M-R5 (13 px, `neutral-300`) como piso para datos técnicos y R2 se mantiene para el resto del texto.
  - **M-R3 contra R11.** R11 dice "sin barras fijas **en escritorio**: la acción principal vive arriba a la derecha". M-R3 exige barra fija abajo **en móvil**. No se contradicen; queda escrito aquí que R11 es una regla de escritorio, para que nadie las lea como una sola.
  - **M-R9 contra la práctica de R23.** R23 pide "un aviso solo si hay un dato detrás" y el aviso de la pestaña "Más" lo cumple al pie de la letra (los pendientes existen), pero viven en Inicio. M-R9 endurece la regla: el dato tiene que estar **detrás de esa puerta**. Es la única M-R que declara mal resuelto algo ya implementado; se corrige en la fase 2 (tarea 203).
- **Consecuencias sobre AD-030:** la regla **M-R2** matiza la navegación "Up" de la regla 13 de [REGLAS.md](REGLAS.md); el cómo queda registrado aparte, en AD-030.
- **Consecuencias:** (a) el criterio visual de la app pasa a ser R1-R41 **más** M-R1 a M-R14, y las M-R mandan cuando la pantalla se está mirando en un teléfono. (b) Tres decisiones ya aprobadas quedaron cumplidas solo a medias en móvil y se corrigen: la cabecera que "se queda en pantalla" solo existía en el nivel sección (M-001), el aviso de "Más" apunta a una pantalla que no contiene lo que anuncia (M-003) y los 44 px de toque se aplicaron en Guías pero no en Inicio ni en Red (M-005). (c) **M-023 (desbloqueo de la Bóveda) queda fuera de fase**: la auditoría lo registra con su alternativa (reutilizar el bloqueo del teléfono para reabrir la sesión, nunca para descifrar sin la maestra) y **no se implementa sin decisión explícita del usuario**.

## AD-030. El origen del salto vive en `location.state`, y el padre declarado sigue siendo el respaldo

- **Estado:** Vigente (2026-08-03, tarea 202). Aplica la regla **M-R2** de AD-029.
- **Contexto:** la regla 13 de [REGLAS.md](REGLAS.md) fijó que el regreso es navegación "Up" a un **padre lógico declarado** (`padreDe`, con pruebas), y no `history.back()`. Esa decisión sigue siendo correcta y no se revisa: es determinista, aguanta enlaces profundos y recargas, y evita que "volver" caiga en un formulario recién enviado. Lo que la auditoría móvil mide es que el padre lógico **no siempre es el sitio del que se vino**, y eso convierte tres recorridos frecuentes en callejones: escanear un equipo y abrir su ficha deja al técnico en Equipos y no en el escáner (M-029, y el escáner además se **borraba** del historial con un `navigate(..., { replace: true })`); abrir un equipo desde la topología lo devuelve a la lista de Red (M-020); y llegar a una Ubicación o a una Persona desde la ficha de un equipo no dice desde cuál (M-002).
- **Decisión:** se añade un **origen efímero** que viaja en `location.state` (`src/lib/origenNavegacion.ts`), lo resuelve el **chasis** para las 44 rutas, y manda sobre el padre declarado cuando existe. El orden de resolución es: origen → override de la pantalla → `padreDe`. El origen lo escribe quien **origina** el salto (el escáner, la topología, la ficha del equipo), nunca el destino: el destino no puede saber de dónde lo abrieron. Además, la línea de contexto de 11 px del ancla permanente (M-R1) pasa a nombrar el origen, que es lo que el mockup `6b` pide para Ubicaciones y Personas.
- **Por qué en `location.state` y no en la URL.** Es por **entrada de historial**, así que expresa exactamente "el último salto" y no sobrevive a saltos que no le corresponden; llega vacío en un enlace compartido y la pantalla cae sola al padre declarado; y no ensucia la URL. La alternativa (`?desde=escaner`) se descartó justo por lo último: el equipo guarda y comparte enlaces profundos, y arrastrarían de dónde venía quien los copió. `leerOrigen()` valida el estado con desconfianza (es un canal sin tipo que sobrevive a recargas y puede venir de otra versión de la app): ante cualquier cosa que no sea un origen usable devuelve `null`, y por tanto **ninguna pantalla puede quedarse sin salida**.
- **El origen va por delante del override de la pantalla, no por detrás.** El override (`volverA`) expresa una regla general ("un equipo de red vuelve a Red") y el origen expresa el hecho concreto de este recorrido ("vengo del escáner"). Cuando los dos hablan, gana el hecho.
- **Consecuencias:** (a) el regreso deja de ser puramente determinista por ruta y pasa a depender del camino, que es lo que pedía M-R2; el determinismo se conserva como respaldo, verificado en navegador con una pestaña nueva (sin historial) sobre `/ubicaciones/:id`: ancla "Ubicaciones" y regreso a `/ubicaciones`. (b) `padreDe` no se toca y sus pruebas siguen valiendo. (c) El hook `useOrigen` recuerda el origen **por pathname**: un ancla `#seccion` o una query nueva no lo borran (React Router trata un cambio de hash como una navegación con `state: null`, el mismo defecto que ya se corrigió en su día con el bloque "¿Qué sigue?"), pero pasar de una ficha a otra del mismo tipo sí lo relee. (d) Queda camino hecho para `MigaDePan` (tarea 188), que necesita el mismo dato.

## AD-031. El conteo de la sesión de escaneo se reinicia a mano, no adivinando

- **Estado:** Vigente (2026-08-03, tarea 202).
- **Contexto:** con el ciclo del escáner arreglado (AD-030) hacía falta lo que da sentido a quedarse dentro: el contador "3 leídos" del mockup `8b`. La primera versión intentaba adivinar cuándo empieza y termina "una sesión" con un marcador en `sessionStorage`: el escáner lo escribía antes de saltar a una ficha y lo **consumía** al volver, de modo que entrar desde "Más" empezaba de cero y volver de una ficha seguía contando.
- **Decisión:** se descartó ese mecanismo. El conteo vive mientras viva la pestaña (`sessionStorage`) y se reinicia **tocándolo**. Una sola regla, y visible.
- **Por qué:** consumir el marcador al montar **no es idempotente**, y el doble montaje que React hace en desarrollo (StrictMode) lo destapó a los pocos minutos: el contador decía "1 leído" mientras el almacenamiento ya estaba en `[]`, porque el inicializador de `useState` corrió dos veces y la segunda pasada reinició el conteo que la primera había adoptado. Ese doble montaje existe justamente para cazar esto. Se podía haber blindado con una ref, pero eso solo esconde el problema: lo que estaba mal era **leer con efectos**. La versión final expone `codigosLeidos()` como lectura pura, y una prueba lo fija llamándola tres veces seguidas.
- **Consecuencias:** el técnico decide cuándo termina una sesión de escaneo, en vez de depender de una regla invisible sobre por qué puerta entró. Cerrar la aplicación borra el conteo solo, porque `sessionStorage` muere con la pestaña. El contador nunca es motivo para que el escáner deje de escanear: todo acceso al almacenamiento va envuelto, y sin él (modo privado, cuota llena) simplemente no hay contador.

## AD-032. Dentro de un paso, la profundidad se dibuja y el color solo advierte (reglas R56 a R61)

- **Estado:** Vigente (2026-09-02, tarea 206).
- **Contexto:** el hallazgo **M-012** de la auditoría móvil y el turno 12 de la auditoría de Soluciones describen el mismo defecto desde dos encuadres: dentro de un paso en ejecución, el color no distinguía naturaleza. El **ámbar** era a la vez la advertencia, la pregunta de error y la solución vinculada; el **acento**, el subprocedimiento y la credencial protegida. Un paso podía llegar a mostrar **cinco marcos de color anidados**, dos de ellos del mismo tono con significados distintos, y nada decía qué estaba dentro de qué: un aviso del subprocedimiento y un aviso del paso padre se veían idénticos aunque pertenecieran a documentos distintos.
- **Decisión:** se adoptan las seis reglas del turno 12, que quedan como criterio para cualquier contenido anidado de la app:
  - **R56 · La profundidad se dibuja, no se colorea.** Anidar es sangría y línea (2 px neutros, 13 px de margen); el color queda para el tipo y el estado.
  - **R57 · Un indicador de avance por documento**, y dice a qué documento pertenece.
  - **R58 · Un control que sale de la pantalla se ve distinto de uno que despliega en el sitio**, y promete el regreso.
  - **R59 · No se pregunta lo que se puede deducir.** Si "No" equivale a seguir, no hay pregunta: hay una salida opcional.
  - **R60 · Un color significa lo mismo en toda la pantalla.** El verde no puede ser "Sí" en un bloque y "No" en el de al lado.
  - **R61 · Una acción, un peso visual.** El mismo efecto no se dibuja como botón en un sitio y como enlace al pie en otro.
- **Por qué 13 px y no más:** en 448 px cada nivel de sangría cuesta ancho de lectura, y con un solo nivel de anidamiento permitido (que se conserva: es lo que corta los ciclos A → B → A) nunca hay más de una sangría por documento.
- **Por qué el aviso conserva su color aunque esté anidado:** es lo único que advierte de un riesgo real, y atenuarlo por profundidad sería peligroso. Lo que cambia es que ahora **es lo único con color de fondo en el cuerpo del paso**, así que no compite con nada.
- **Consecuencias:** (a) desaparecen los marcos de color de subprocedimiento, contingencia, decisión y dato protegido, que pasan a filas de 44 px con icono neutro (`FilaVinculo`). (b) La pregunta "¿Ocurrió algún error durante este paso?" se retira de la vista de lectura por R59; la salida queda siempre disponible como fila "Si esto falla", que es **más** de lo que había, no menos. (c) El verde deja de usarse para elegir y queda solo para "completado". (d) Se retiran el segundo y el tercer indicador de avance del documento anidado, y con ellos el enlace "Reiniciar progreso" subrayado que duplicaba el botón del panel de completado (R61). (e) **R56 a R61 se suman a R1-R41 y a M-R1 a M-R14** (ver AD-019 y AD-029); ninguna deroga una regla vigente, y R56 es la lectura larga de **M-R11**.
