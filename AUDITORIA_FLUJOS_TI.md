# Auditoría integral de flujos de TI

Fecha: 2026-07-21
Método: recorrido de procesos reales de un departamento de TI (no pantalla por pantalla), aplicando en paralelo las lentes de Product Manager, UX Research/Design, Arquitectura de Software y de Datos, Full Stack, DevOps, Administración de Infraestructura, Soporte N1/N2/N3, Análisis de Procesos, Automatización, Bases de Conocimiento, Calidad, Rendimiento y Optimización de Datos. Cada hallazgo está anclado a `archivo:linea` real y contrastado contra los documentos `PROPUESTA_*.md` y `TAREAS.md` para separar lo NUEVO de lo ya planeado o ya hecho.

## Veredicto ejecutivo

La aplicación cumple su principio rector ("cada dato existe una sola vez y todo lo demás lo referencia") en un grado alto, alrededor del 85%. La reutilización de procedimientos por id, la referencia viva de nombres, el grafo de referencias derivado, la ubicación como entidad, los campos protegidos separados de la bóveda y la creación contextual (que precarga categoría y equipo) son decisiones correctas y ya implementadas. No hay que rehacerlas.

Los huecos reales NO están en la duplicación de datos individuales (eso está casi resuelto), sino en tres zonas que la evolución por fases dejó para el final:

1. **Falta el sujeto del propio ejemplo del usuario: la persona.** El escenario "llega una computadora nueva para un empleado" no tiene dónde vivir. No existe una entidad Persona/Responsable; "usuario asignado" es texto libre. Es la única gran duplicación pendiente del mismo tipo que ya se resolvió para las ubicaciones.
2. **Falta el ciclo de vida del activo.** No hay "dar de baja" con consecuencias, ni "reemplazar equipo", ni fechas de garantía/compra, ni relación de sustitución. El estado "De baja" es solo un color.
3. **La incorporación y el cableado están fragmentados.** Documentar un equipo nuevo completo obliga a recorrer cuatro contextos y crear cada conexión y cada secreto de a uno; no hay asistente que guíe el proceso ni permita crear el otro extremo sobre la marcha.

Se identificaron 30 hallazgos con ID estable. Ninguno bloquea el uso diario; son mejoras de escalabilidad, trazabilidad y ahorro de trabajo manual.

---

## Parte I. Catálogo de hallazgos (con ID estable)

Cada ID es convertible en tarea. Estado: NUEVO = no aparece en las propuestas; PLANEADO = ya está en una propuesta pero sin construir; PARCIAL = mezcla.

### A. Arquitectura de datos (transversal a todos los flujos)

**T1 - Falta la entidad Persona / Responsable / Empleado. [ALTA] [NUEVO]**
El sujeto del escenario estrella no existe en el modelo. Los campos canónicos del dispositivo son exactamente nombre, categoria, marca, modelo, serial, placaInventario, ubicacion, ip, estado, observaciones (`src/features/dispositivos/importar/mapearFilas.ts:11-21`); no hay responsable. El "usuario asignado" solo aparece como clave de texto libre en `dispositivos.detalles` (`src/features/busqueda/useIndiceBusqueda.ts:179`, `src/features/historial/resumenDetalles.test.ts:15-16`).
- Duplicación: el nombre del empleado se re-teclea como texto libre en cada equipo, con variantes ("J. Pérez", "Juan Perez", "jperez"), exactamente el problema que `ubicaciones` (grupo N3) resolvió para los lugares.
- Debería referenciarse: un dispositivo debería apuntar a `responsableId`, y la ficha de la persona respondería "¿qué equipos y credenciales tiene asignados?".
- Arquitectura: promover Persona a entidad propia con el mismo patrón que `ubicaciones` (tabla + selector inline + referencia viva + copia de nombre). Alternativa mínima sin esquema: vocabulario derivado (`valoresUnicos`) como el de marcas, para al menos frenar las variantes de tecleo mientras se decide la entidad.
- Impacto: habilita el inventario "por persona", los flujos de alta/baja de empleado (entregar/recoger equipos) y la trazabilidad de responsabilidad. Es el mayor salto de valor para un inventario de TI.

**T2 - Falta el ciclo de vida del activo (compra, garantía, proveedor, fin de vida). [MEDIA] [NUEVO]**
No hay campos de primera clase para fecha de compra, vencimiento de garantía ni proveedor; solo caben como texto libre en `detalles`. El importador ya reconoce columnas "Garantía hasta" y "Proveedor" en las hojas reales (`src/features/dispositivos/importar/mapearFilas.test.ts:69-75`) pero las degrada a `detalles` porque no son campos fijos.
- Autocompletar/automatizar: con una fecha de garantía de primera clase se podría avisar "garantía por vencer" igual que ya se hace con `Credencial.venceEn` (`src/lib/vencimiento.ts`). Hoy esa asimetría deja el activo físico sin ninguna alerta proactiva.
- BD: columnas opcionales `fechaCompra`, `garantiaHasta`, `proveedor` en `dispositivos` (o un vocabulario derivado de proveedor).
- Impacto: mantenimiento preventivo y renovaciones planificadas en vez de reactivas.

**T3 - El importador masivo aplasta la jerarquía de ubicación y no crea entidades. [MEDIA] [NUEVO]**
`ubicacion` mapea Sede, Área, Oficina, Lugar y Sitio a UN solo campo de texto (`src/features/dispositivos/importar/mapearFilas.ts:50`), perdiendo la jerarquía que `ubicaciones.padreId` soporta, y crea texto libre en vez de entidades `ubicacion`.
- Duplicación: una importación de cientos de puntos de red genera cientos de textos de ubicación sueltos que luego hay que migrar a mano con `MigracionUbicaciones`.
- Automatizar: el importador debería resolver/crear la entidad `ubicacion` (fusionando variantes) durante la importación, y aceptar columnas separadas Sede/Área para armar la jerarquía.
- Impacto: la importación masiva (clave para los puntos de red, que son cientos) deja de generar deuda de datos.

### B. Ciclo de vida del equipo

**L1 - No existe "Dar de baja" con cascada; el estado es cosmético y deja huérfanos. [ALTA] [NUEVO]**
"De baja" solo define un color (`src/features/red/topologiaVisual.ts:65-70`). Eliminar hace soft-delete de UNA fila (`src/features/dispositivos/DispositivoPage.tsx:139-142`, `src/lib/repositorio.ts:71-94`) sin tocar `campos_protegidos` (quedan con `dispositivoId` apuntando a un equipo muerto), ni `credenciales.dispositivos`, ni `conexiones`. El aviso de impacto existe (`DispositivoPage.tsx:366`, `resumenImpacto` del grafo) pero avisa sin actuar.
- Automatizar: flujo "Dar de baja" que fije el estado, liste con `referenciasHacia` los secretos, credenciales y conexiones del equipo, y ofrezca por cada uno archivar/mover/eliminar. Reutiliza el patrón de la migración asistida `/boveda/migrar`, que ya sabe mover secretos.
- Riesgo si no se hace: secretos y cableado huérfanos que ensucian la topología y las estadísticas.

**L2 - No existe "Reemplazar dispositivo"; Duplicar pierde lo que importa. [ALTA] [NUEVO]**
Lo más cercano es Duplicar (`?copiarDe`, `src/features/dispositivos/DispositivoForm.tsx:149-172`), que copia categoría, marca, modelo, ubicación, observaciones y detalles, pero NO conexiones, credenciales vinculadas, campos protegidos ni historial.
- El escenario real "se quemó el switch, entró uno nuevo en el mismo rack y puerto" obliga hoy a recablear cada conexión a mano, re-vincular cada credencial editándola en la bóveda, recrear cada campo protegido (reescribiendo el valor cifrado) y deja el historial del saliente separado del entrante.
- Automatizar: acción "Reemplazar" que cree el equipo nuevo heredando ubicación, conexiones, vínculos de credenciales y campos protegidos del saliente (mover un campo protegido es solo reasignar `dispositivoId`, no hay que descifrar), deje el saliente en "De baja" y registre la sustitución (ver L3).
- Impacto: colapsa un proceso de decenas de pasos manuales a uno guiado, sin perder trazabilidad.

**L3 - Falta la relación "reemplaza a" / "reemplazado por". [MEDIA] [NUEVO]**
`TipoRelacion` (`src/lib/grafo.ts:22-35`) no incluye sustitución y `Dispositivo` (`src/lib/db.ts:290-317`) no tiene `reemplazaA`.
- Debería referenciarse: columna opcional `reemplazaA: string | null` + arista derivada, para pintar "Reemplaza a X" / "Reemplazado por Y" en la ficha (mismo patrón que `credencial_dispositivo`).
- Impacto: responde "¿qué equipo estuvo antes en este puerto/rack?" y conecta los historiales.

### C. Incorporación / alta de un dispositivo (flujo estrella)

**O1 - Alta fragmentada: no hay asistente de incorporación. [ALTA] [NUEVO, refuerza tarea 62]**
El editor de dispositivo (`DispositivoForm.tsx`) solo captura identidad, ubicación e IP; guarda y navega a la ficha (`:232`). Todo lo demás (seguridad, conexiones, procedimientos) se hace después, en la ficha, cada elemento de a uno y en secciones distintas. No existe una vista que guíe "identidad, ubicación, red, seguridad, procedimientos" ni que muestre el progreso.
- Clics que se pueden eliminar: documentar un equipo nuevo completo cruza 4 contextos (form, Seguridad, Conexiones, editor de artículo) con re-desplazamientos constantes.
- UX: un asistente por pasos (stepper) o, sin rediseñar, un bloque post-guardado "¿Qué sigue?" que use el motor de completitud que YA existe (`src/features/dispositivos/completitud.ts`) para enlazar directo a cada sub-tarea pendiente (falta foto, falta seguridad, sin conexiones).
- Impacto: convierte una incorporación de "recordar hacer 6 cosas en 4 pantallas" en una lista guiada.

**O2 - No se puede cablear durante el alta; cada conexión es un ciclo abrir/cerrar. [ALTA] [NUEVO]**
El formulario de conexión colapsa al guardar (`src/features/red/ConexionesFicha.tsx:234`), obligando a re-abrir (`:120`) y re-elegir el tipo (que vuelve a `enlace`, `:190`) para la siguiente. Medido: crear un punto de red y cablearlo a switch + rack + AP son ~20 clics y 3 aperturas de formulario, todo obligatoriamente después de guardar el equipo.
- Clics: botón "Guardar y agregar otra" que conserve el formulario abierto y recuerde el último tipo y medio.
- Automatizar: bloque opcional "¿A qué se conecta?" dentro del propio alta que cree las conexiones en el mismo guardado.

**O3 - No se puede crear el equipo del otro extremo desde el formulario de conexión. [ALTA] [NUEVO]**
`coincidencias` solo lista dispositivos que ya existen (`ConexionesFicha.tsx:199-205`). Si el switch no está dado de alta, el flujo se corta: hay que abandonar, crearlo como ficha completa y volver.
- Automatizar: opción "Crear equipo nuevo con este nombre" inline que cree la ficha mínima (nombre + categoría de red heredada) y la conecte en el mismo gesto.

### D. Red y topología

**N1 - Trampa de dirección: un enlace creado desde la ficha del punto de red invierte la topología. [ALTA] [NUEVO, riesgo de datos]**
Desde la ficha del punto de red, el modo por defecto `enlace` fija `origenEsteDispositivo = true` (`ConexionesFicha.tsx:217`), y en el árbol el origen de un enlace es el padre (`src/features/red/arbol.ts:68`). Resultado: registrar "el switch alimenta a este punto" desde la ficha del punto lo convierte en padre del switch, es decir la topología queda al revés y "¿qué se cae si apago el switch?" responde mal. No hay un modo "recibe servicio de / uplink".
- Arquitectura: agregar modo "Recibe servicio de (uplink)" que ponga al otro equipo como origen, o invertir automáticamente según categoría (rack/switch siempre es el padre).
- Riesgo: es un error silencioso de modelado que corrompe la utilidad principal de la topología.

**N2 - "Crear" de Red no hereda ningún contexto de red. [MEDIA] [NUEVO, refuerza tarea 62]**
Va a `/dispositivos/nuevo` pelado (`src/features/red/RedPage.tsx:94`), sin priorizar categorías `es_red` ni preseleccionar ubicación, a diferencia de otras creaciones contextuales de la app (`DispositivoPage.tsx:326,334`).
- Autocompletar: `/dispositivos/nuevo?red=1` para ordenar primero las categorías de red y sembrar el flujo dedicado.

**N3 - El punto de red no hereda la ubicación de su rack/switch. [BAJA] [NUEVO]**
La ubicación se teclea a mano en el alta y la conexión posterior conoce el rack/switch (que ya tiene ubicación), pero nada la propaga.
- Automatizar: al conectar a un rack/switch, ofrecer copiar su `ubicacion/ubicacionId` si el equipo no la tenía.

**N4 - Sin sugerencia de puerto consecutivo libre. [BAJA] [NUEVO]**
Al enlazar desde un switch no se ofrece el próximo puerto libre (`ConexionesFicha.tsx:193`), pese a que las conexiones existentes ya se pueden leer (`agruparConexiones` en `src/lib/conexiones.ts`).
- Automatizar: proponer el menor puerto no usado del switch.

**N5 - La búsqueda del otro extremo no sugiere por ubicación ni por tipo. [MEDIA] [NUEVO]**
`coincidencias` exige teclear y filtra solo por nombre/ubicación/IP (`ConexionesFicha.tsx:199-205`); no prioriza equipos de la misma ubicación ni las categorías esperables (rack/switch/AP para un uplink).
- Automatizar: al abrir, pre-sugerir racks/switches de la misma ubicación del equipo; ordenar candidatos `es_red` primero. Habilita "sugerir switch/rack por ubicación".

**N6 - Los puertos son texto libre; no hay vista de "puertos libres" ni entidad puerto. [BAJA] [NUEVO, opción arquitectónica]**
El puerto vive como texto suelto en cada `Conexion` (`origenPuerto`/`destinoPuerto`). No se puede responder "¿qué puertos del switch X están ocupados?".
- Arquitectura (opcional, para más adelante): derivar la ocupación de puertos del grafo de conexiones sin nueva entidad; una entidad Puerto sería sobre-ingeniería para 5 técnicos hoy.

### E. Secretos y bóveda

**S1 - Rotar la contraseña NO resetea el vencimiento; sigue "Vencida" tras rotarla. [ALTA] [NUEVO]**
`venceEn` es un campo de fecha manual e independiente (`src/features/boveda/CredencialForm.tsx:612-620`); al guardar se persiste tal cual (`:319`). El técnico rota la contraseña, genera una nueva y el secreto sigue en rojo "Vencida" porque nadie tocó la fecha. El aviso "X secretos necesitan rotarse" (`src/features/boveda/BovedaPage.tsx:455-464`) y el bloque Pendientes de Inicio (tarea 122) quedan mintiendo hasta corregir la fecha a mano.
- Automatizar: al detectar que la contraseña cifrada cambió, ofrecer o auto-aplicar "renovar vencimiento" (+N meses de política), o guardar `ultimaRotacion` y derivar el próximo vencimiento de ahí en vez de una fecha absoluta suelta.
- Impacto: la política de rotación deja de depender de que el técnico recuerde editar una fecha.

**S2 - Los campos protegidos del equipo no tienen vencimiento ni recordatorio de rotación. [MEDIA] [NUEVO]**
`CampoProtegido` (`src/lib/db.ts:425-437`) no tiene `venceEn`, a diferencia de `Credencial.venceEn`. Justo tras la migración P4, la contraseña de administrador de un equipo vive como campo protegido, que es lo que MÁS conviene rotar y lo único sin ningún aviso.
- BD: añadir `venceEn` opcional (sin cifrar, mismo criterio que en credenciales) y sumar los campos protegidos al aviso de rotación de Inicio/Bóveda.

**S3 - Cambiar un campo protegido no captura "motivo" ni tiene botón "Generar contraseña". [MEDIA] [NUEVO]**
`SeguridadDelEquipo.tsx:402-435` llama a `guardarRegistro('campos_protegidos', ...)` sin `motivo`, frente a `CredencialForm.tsx:311-324` que sí lo pasa y tiene el campo. El historial por campo registra el cambio pero nunca el porqué (rotación, incidente, filtración). Tampoco reutiliza el botón "Generar" de la bóveda (`CredencialForm.tsx:492-502`).
- UX: añadir "Motivo" opcional al editor de campo y reutilizar `generarContrasena`.

**S4 - El título de credencial "Acceso {nombre}" congela el nombre del equipo. [MEDIA] [NUEVO]**
La creación contextual arma `titulo=Acceso ${dispositivo.nombre}` (`DispositivoPage.tsx:334`) y ese texto se guarda congelado (`CredencialForm.tsx:310-311`). Si el equipo se renombra, el título del secreto queda desfasado, mientras el resto del sistema sí usa referencia viva. Existe un nudge cuando el título coincide (`CredencialForm.tsx:208-212`), pero no cuando quedó desfasado.
- Debería referenciarse: no bakear el nombre en el título (dejar título genérico + equipo vía vínculo vivo), o marcar el título como derivado y refrescarlo desde el equipo vinculado.

**S5 - Solapamiento credencial ↔ campo protegido: el mismo secreto puede vivir en los dos lados. [MEDIA] [NUEVO]**
Una credencial 'cuenta' vinculada a un equipo guarda usuario+contraseña, y ese mismo equipo puede tener un `CampoProtegido` 'contrasena'. Nada impide que la contraseña de administrador esté en ambos; al rotar hay que acordarse de cambiarla en los dos y, si no, divergen. Las fases P0-P4 resolvieron "un secreto REPRESENTA un equipo", no "dos lugares guardan la misma contraseña".
- Automatizar: extender el nudge para avisar "este equipo ya guarda una contraseña en Seguridad; evita duplicarla" cuando una credencial 'cuenta' se vincula a un equipo que ya tiene un campo 'contrasena'.

**S6 - Al crear un secreto desde la bóveda, no sugiere equipo por coincidencia de IP/URL. [BAJA] [NUEVO]**
La creación desde la ficha del equipo ya precarga título, categoría y vínculo (bien, planeado/hecho). El hueco es la creación desde la bóveda: solo hay nudge por coincidencia exacta de título.
- Autocompletar: sugerir equipo candidato en "Equipos con acceso" cuando la URL/IP escrita coincida con la `ip` de algún dispositivo.

### F. Base de conocimiento y diagnóstico

**K1 - Pérdida silenciosa de metadata del artículo si no hay pasos. [ALTA] [NUEVO, defecto real]**
`prepararProcedimientoParaGuardar` devuelve `null` cuando no hay pasos (`src/lib/procedimiento.ts:484`), y ese `null` se guarda como `procedimiento` (`src/features/soluciones/ArticuloForm.tsx:383`). Pero la pestaña General muestra SIEMPRE (todos los tipos, incluido `manual`) descripción, objetivo general y portada, y la pestaña Pasos muestra requisitos y verificación final (`ArticuloForm.tsx:589-621`), todos serializados solo dentro de `procedimiento`. Un `manual` (que por diseño no tiene pasos) o cualquier borrador guardado antes del primer paso pierde en silencio descripción, portada, objetivo, requisitos, verificación, tiempo y dificultad.
- Arquitectura: mover descripción/portada/objetivo a nivel de artículo (columnas, o sin esquema persistir la metadata aunque `pasos` esté vacío devolviendo un objeto sin pasos en vez de `null`). Esos datos describen al artículo, no al paso a paso.
- Riesgo: es escritura al vacío, el técnico no recibe ningún aviso de que perdió lo que escribió.

**K2 - Bucle sugerencia → borrador de artículo: capturado pero sin cierre. [ALTA] [PLANEADO]**
`DiagnosticoRunPage.tsx:524-531` captura la solución propuesta cuando el diagnóstico no resolvió; `SugerenciasEquipoPage.tsx:53-68` solo la lista en lectura. El texto + el título del diagnóstico + su categoría son exactamente el borrador de un `problema_frecuente`, pero hay que recrearlo a mano (re-tecleo). Está planeado como "bucle sugerencia -> borrador" en `PROPUESTA_REVISION_ARQUITECTURA.md` (Fase 2) y `PROPUESTA_MODULOS.md`, sin construir.
- Automatizar: botón "Redactar artículo desde esta sugerencia" que abra `ArticuloForm` precargando título, descripción y categoría.

**K3 - La completitud es procedimiento-céntrica y no depende del tipo. [MEDIA] [NUEVO]**
`senalesDeArticulo` no recibe `tipo` (`src/features/soluciones/completitudArticulo.ts:57-94`); sus diez señales exigen pasos, requisitos y verificación. Un `manual` mostrará permanentemente "Agregar al menos un paso" y un porcentaje que nunca podrá subir, con sugerencias que llevan a pestañas que no aplican.
- UX: que `senalesDeArticulo` reciba `tipo` y para `manual` puntúe contenido Markdown, objetivo y etiquetas en vez de pasos.

**K4 - El editor de diagnóstico no hereda la categoría del contexto. [MEDIA] [NUEVO]**
"Crear" enlaza a `/diagnostico/nuevo` sin `?categoria` aunque la lista esté filtrada (`src/features/diagnostico/DiagnosticosPage.tsx:94,232`); el formulario nunca lee `useSearchParams` y la categoría arranca vacía y obligatoria (`DiagnosticoForm.tsx:62-84,213`). El técnico que veía "Solo: Impresoras" tiene que volver a elegirla, a diferencia de `ArticuloForm`, que sí deriva la categoría de la ruta.
- Autocompletar: pasar `?categoria=` en el enlace y sembrar el chip activo.

**K5 - Anti-duplicados asimétrico entre artículos y diagnósticos. [MEDIA] [NUEVO]**
Al crear un artículo se avisan similares (`ArticuloForm.tsx:210-213,528-556`); al crear un diagnóstico, el título no tiene ningún aviso (`DiagnosticoForm.tsx:202-209`). Un `problema_frecuente` y un `diagnostico` del mismo problema son dos entradas al mismo conocimiento y nada las cruza (fusionar árboles está descartado a propósito, pero el aviso cruzado no).
- Automatizar: reutilizar el índice de búsqueda en `DiagnosticoForm` para ofrecer el artículo o diagnóstico ya existente.

**K6 - No hay creación contextual de procedimiento desde un equipo (solo de incidencia). [BAJA] [NUEVO]**
`DispositivoPage.tsx:326` solo genera el enlace contextual para `tipo=problema_frecuente`. Para documentar un procedimiento normal "de este equipo" hay que agregar el equipo a mano en "Equipos donde aplica".
- Autocompletar: ofrecer también "Documentar procedimiento para este equipo" que precargue `dispositivosAfectados`.

### G. Deuda técnica, rendimiento y duplicación de código

**D1 - Dos implementaciones casi idénticas de `FormularioConexion`, ya divergidas. [MEDIA] [NUEVO]**
`ConexionesFicha.tsx:177-375` y `TopologiaEquipoPage.tsx:456-645` comparten lógica de guardado y de coincidencias, con distinto chrome, y ya divergieron: el medio por defecto arranca vacío en la ficha (`ConexionesFicha.tsx:195`) y en UTP en la topología (`TopologiaEquipoPage.tsx:468`), cuando `MEDIOS_SUGERIDOS[0]` ya es UTP.
- Arquitectura: extraer un `<FormularioConexion>` compartido (encaja en el tema "piezas compartidas" de la Fase 1 de `PROPUESTA_REVISION_ARQUITECTURA.md`, que menciona `FilaDispositivo`/`esDeRed()` pero no este formulario). Unificar el default de medio en UTP.

**D2 - Búsquedas locales de subcadena coexisten con el índice global MiniSearch. [MEDIA] [PARCIAL]**
`SolucionesPage.tsx`, `DispositivosPage.tsx`, `RedPage.tsx` y el buscador del formulario de conexión filtran por subcadena, sin la tolerancia a errores del índice global, con lógica repetida. Está señalado como remate pendiente de la Fase 1 en `TAREAS.md`.
- Arquitectura: converger a un buscador compartido con la misma semántica del índice global.

**D3 - La ficha del dispositivo dispara varias lecturas full-table redundantes. [BAJA] [NUEVO]**
Abrir una ficha carga `dispositivos`, `conexiones` y `categorias` completos en `ImpactoYDependencias.tsx:17-19`, otra vez `db.dispositivos.toArray()` para nombres vivos en `ConexionesFicha.tsx:51`, más `useGrafo()` en `DispositivoPage.tsx:122`. Para 5 técnicos no rompe nada; es el mayor foco de recomputación.
- Rendimiento: subir esas consultas a `DispositivoPage` y pasarlas por props, o un hook/contexto de red compartido.

**D4 - RedPage/TopologiaPage cargan todo con `toArray()` y reconstruyen el árbol en cada render. [BAJA] [NUEVO]**
`construirBosque` recorre todas las conexiones por nodo (O(nodos x conexiones), `arbol.ts:55-83`) y `contarDescendientes` se recalcula por fila (`TopologiaPage.tsx:265`). Irrelevante a la escala actual; anotado por completitud.

---

## Parte II. Recorridos por flujo (con las 15 dimensiones pedidas)

Cada flujo se analiza según el índice pedido. Para no repetir el detalle, se referencian los IDs del catálogo; impacto, prioridad, complejidad y riesgo se resumen en la tabla maestra (Parte III).

### Flujo 1. Llega una computadora nueva para un empleado (flujo estrella)

1. **Flujo analizado:** Inicio > Dispositivos > "Nuevo" > guardar > ficha > Seguridad > Conexiones > procedimientos.
2. **Problemas encontrados:** O1 (alta fragmentada), O2 (cableado de a uno), O3 (no crear el otro extremo), T1 (sin responsable), N1 (dirección de topología), N3 (ubicación no heredada), K6 (procedimiento contextual).
3. **Información duplicada:** el nombre del empleado (T1, texto libre por equipo); la ubicación entre el PC y el punto de red al que se conecta (N3).
4. **Información que debería referenciarse:** responsable (T1) hacia una entidad Persona; ubicación heredada del punto de red / rack (N3).
5. **Automatizaciones posibles:** crear la conexión y el equipo del otro extremo desde el alta (O2, O3); heredar ubicación al cablear (N3); "¿Qué sigue?" derivado de completitud (O1).
6. **Datos que pueden autocompletarse:** estado "Operativo" (ya hecho), propiedades por categoría (ya hecho), ubicación heredada (N3), responsable por vocabulario derivado (T1 mínima), próximo puerto libre (N4).
7. **Clics que pueden eliminarse:** los ~20 clics de cableado post-alta (O2), los re-desplazamientos entre 4 contextos (O1), re-tecleo del otro extremo inexistente (O3).
8. **Cambios de UX:** asistente por pasos o bloque post-guardado guiado (O1); "Guardar y agregar otra" en conexiones (O2).
9. **Cambios de arquitectura:** entidad Persona (T1); modo "uplink" en conexiones (N1).
10. **Cambios de BD:** tabla `personas` + `dispositivos.responsableId` (T1); opcional `garantiaHasta`/`fechaCompra` (T2).
11. **Impacto esperado:** una incorporación completa pasa de "recordar 6 tareas en 4 pantallas y decenas de clics" a un flujo guiado con datos heredados.
12. **Prioridad:** Alta.
13. **Complejidad:** Media-Alta (T1 y O1 son estructurales; O2/O3/N3 son incrementales).
14. **Riesgos:** N1 puede corromper topología si no se corrige antes de escalar el cableado; migrar "usuario asignado" de `detalles` a `responsableId` requiere una migración asistida como la de ubicaciones.
15. **Recomendación final:** priorizar T1 (Persona) y O1 (asistente/checklist post-alta) como base, con N1 como corrección de seguridad de datos previa a cualquier campaña de cableado masivo.

### Flujo 2. Registrar/configurar infraestructura de red (switch, Access Point, punto de red, servidor)

1. **Flujo:** Red > "Crear" > alta genérica > ficha > Conexiones.
2. **Problemas:** N1 (dirección), N2 (sin contexto de red), N5 (búsqueda sin sugerencias), O2/O3, D1 (form duplicado), D4 (rendimiento del árbol).
3. **Duplicada:** ninguna crítica (ubicación/IP no se copian en `conexiones`, solo nombres, y se leen en vivo).
4. **Referenciarse:** switch/rack sugeridos por ubicación (N5).
5. **Automatizaciones:** crear el otro extremo (O3), puerto consecutivo (N4), herencia de ubicación (N3), dirección automática por categoría (N1).
6. **Autocompletar:** categorías `es_red` primero (N2), medio UTP por defecto unificado (D1), candidatos por ubicación (N5).
7. **Clics:** los del cableado (O2), re-elección de categoría de red (N2).
8. **UX:** unificar el formulario de conexión (D1); pre-sugerencias en la búsqueda (N5).
9. **Arquitectura:** modo uplink (N1); `<FormularioConexion>` compartido (D1).
10. **BD:** ninguna nueva imprescindible; puertos derivables sin entidad (N6).
11. **Impacto:** cablear una sala/rack deja de ser el cuello de botella de decenas de clics con riesgo de topología invertida.
12. **Prioridad:** Alta (por N1); Media el resto.
13. **Complejidad:** Media.
14. **Riesgos:** N1 es el riesgo central; el resto es de bajo riesgo.
15. **Recomendación:** tratar la pregunta abierta de la tarea 62 como "alta de red enriquecida con cableado integrado", no como un creador de conexión aparte (una conexión necesita dos equipos existentes; con inventario vacío no habría nada que enlazar).

### Flujo 3. Dar de baja y reemplazar un equipo; cambiar la topología

1. **Flujo:** ficha > editar estado, o eliminar; recablear a mano.
2. **Problemas:** L1 (sin cascada de baja), L2 (sin reemplazo), L3 (sin lineage), N1 (recablear invierte topología).
3. **Duplicada:** al reemplazar a mano se re-teclea todo lo del equipo saliente.
4. **Referenciarse:** relación `reemplaza a` (L3); secretos/conexiones del equipo vía grafo (L1).
5. **Automatizaciones:** baja con archivado/traspaso guiado (L1); reemplazo con herencia (L2).
6. **Autocompletar:** el equipo entrante hereda ubicación/conexiones/credenciales/campos del saliente (L2).
7. **Clics:** decenas, hoy todos manuales (L1, L2).
8. **UX:** flujo "Dar de baja" y acción "Reemplazar" en el menú de la ficha.
9. **Arquitectura:** aristas de sustitución en el grafo (L3).
10. **BD:** `dispositivos.reemplazaA` opcional (L3).
11. **Impacto:** trazabilidad completa del parque y baja sin huérfanos.
12. **Prioridad:** Alta (L1, L2); Media (L3).
13. **Complejidad:** Media-Alta.
14. **Riesgos:** una cascada mal hecha podría archivar de más; hacerla siempre con confirmación por ítem (patrón de `/boveda/migrar`).
15. **Recomendación:** construir L1 y L2 reutilizando el motor de referencias inversas del grafo y el patrón de migración asistida; L3 como cimiento de trazabilidad.

### Flujo 4. Cambiar una contraseña / registrar una credencial

1. **Flujo:** Bóveda o ficha del equipo > Seguridad.
2. **Problemas:** S1 (rotar no resetea vencimiento), S2 (campos protegidos sin vencimiento), S3 (sin motivo ni "Generar"), S4 (título congelado), S5 (solapamiento).
3. **Duplicada:** misma contraseña en credencial y campo protegido (S5); nombre de equipo en el título (S4).
4. **Referenciarse:** título derivado del equipo vivo (S4).
5. **Automatizaciones:** renovar vencimiento al rotar (S1); nudge anti-solapamiento (S5).
6. **Autocompletar:** botón "Generar contraseña" también en campos protegidos (S3); equipo por IP/URL al crear desde bóveda (S6).
7. **Clics:** editar la fecha de vencimiento a mano tras rotar (S1); pasos extra sin "Generar" en Seguridad (S3).
8. **UX:** campo "Motivo" en campos protegidos (S3); aviso de rotación que incluya campos protegidos (S2).
9. **Arquitectura:** unificar la política de rotación entre credenciales y campos protegidos.
10. **BD:** `campos_protegidos.venceEn` opcional (S2); opcional `ultimaRotacion` (S1).
11. **Impacto:** la rotación deja de depender de memoria humana y la política aplica igual dónde sea que viva el secreto.
12. **Prioridad:** Alta (S1); Media (S2-S5).
13. **Complejidad:** Baja-Media.
14. **Riesgos:** auto-renovar vencimiento debe ser explícito para no ocultar una rotación no hecha; ofrecer, no imponer en silencio.
15. **Recomendación:** empezar por S1 (defecto real que hace mentir los avisos existentes) y S2 (asimetría de la migración P4).

### Flujo 5. Documentar / actualizar un procedimiento y resolver con Diagnóstico Inteligente

1. **Flujo:** Soluciones > Nuevo/Editar artículo; Diagnóstico > ejecutar; Sugerencias del equipo.
2. **Problemas:** K1 (pérdida de metadata), K2 (bucle sugerencia sin cierre), K3 (completitud no por tipo), K4 (categoría no heredada en diagnóstico), K5 (anti-duplicados asimétrico), K6 (procedimiento contextual).
3. **Duplicada:** re-tecleo de la sugerencia para volverla artículo (K2); posible gemelo artículo/diagnóstico (K5).
4. **Referenciarse:** la reutilización por id ya es ejemplar (subprocedimientos, soluciones, decisiones, diagnóstico que ejecuta artículos); no tocar.
5. **Automatizaciones:** sugerencia -> borrador (K2); aviso cruzado de duplicado (K5).
6. **Autocompletar:** categoría del diagnóstico desde el contexto (K4); dispositivos afectados desde el equipo (K6).
7. **Clics:** recrear el borrador a mano (K2); reelegir categoría en diagnóstico (K4).
8. **UX:** completitud consciente del tipo (K3), para que un manual no pida pasos imposibles.
9. **Arquitectura:** subir la metadata del procedimiento a nivel de artículo (K1).
10. **BD:** sin esquema si se persiste la metadata aunque no haya pasos (K1); opcional columnas de descripción/portada.
11. **Impacto:** cero pérdida de datos en manuales/borradores; el conocimiento del equipo se recicla sin re-teclear.
12. **Prioridad:** Alta (K1, K2); Media (K3-K5).
13. **Complejidad:** Baja-Media.
14. **Riesgos:** K1 es corrección de un defecto activo; conviene una prueba que fije que un manual conserva su metadata.
15. **Recomendación:** corregir K1 primero (defecto de pérdida de datos), luego cerrar el bucle K2 que ya está planeado y aporta mucho valor.

---

## Parte III. Tabla maestra priorizada

| ID | Hallazgo | Prioridad | Complejidad | Riesgo | Estado |
|----|----------|-----------|-------------|--------|--------|
| T1 | Falta entidad Persona/Responsable | Alta | Alta | Migración de "usuario asignado" | Nuevo |
| L1 | "Dar de baja" sin cascada (huérfanos) | Alta | Media | Archivar de más | Nuevo |
| L2 | "Reemplazar" no existe; Duplicar pierde todo | Alta | Media-Alta | Herencia parcial | Nuevo |
| O1 | Alta fragmentada, sin asistente | Alta | Media-Alta | Rediseño de flujo | Nuevo |
| O2 | Cableado de a uno, sin durante el alta | Alta | Media | Bajo | Nuevo |
| O3 | No crear el otro extremo en conexión | Alta | Media | Bajo | Nuevo |
| N1 | Trampa de dirección invierte topología | Alta | Baja-Media | Datos mal modelados | Nuevo |
| S1 | Rotar no resetea vencimiento | Alta | Baja | Ocultar rotación no hecha | Nuevo |
| K1 | Pérdida silenciosa de metadata sin pasos | Alta | Baja | Corrige defecto activo | Nuevo |
| K2 | Sugerencia -> borrador sin cierre | Alta | Baja-Media | Bajo | Planeado |
| T2 | Sin ciclo de vida del activo (garantía) | Media | Media | Bajo | Nuevo |
| T3 | Importador aplasta jerarquía de ubicación | Media | Media | Bajo | Nuevo |
| L3 | Falta relación "reemplaza a" | Media | Baja | Bajo | Nuevo |
| N2 | "Crear" de Red sin contexto | Media | Baja | Bajo | Nuevo |
| N5 | Búsqueda sin sugerencias por ubicación/tipo | Media | Baja | Bajo | Nuevo |
| S2 | Campos protegidos sin vencimiento | Media | Baja | Bajo | Nuevo |
| S3 | Campo protegido sin motivo ni "Generar" | Media | Baja | Bajo | Nuevo |
| S4 | Título de credencial congela el nombre | Media | Baja | Bajo | Nuevo |
| S5 | Solapamiento credencial/campo protegido | Media | Baja | Bajo | Nuevo |
| K3 | Completitud no depende del tipo | Media | Baja | Bajo | Nuevo |
| K4 | Diagnóstico no hereda categoría | Media | Baja | Bajo | Nuevo |
| K5 | Anti-duplicados asimétrico | Media | Baja | Bajo | Nuevo |
| D1 | `FormularioConexion` duplicado y divergido | Media | Baja | Bajo | Nuevo |
| D2 | Búsquedas de subcadena vs índice global | Media | Media | Bajo | Parcial |
| N3 | Punto de red no hereda ubicación | Baja | Baja | Bajo | Nuevo |
| N4 | Sin puerto consecutivo sugerido | Baja | Baja | Bajo | Nuevo |
| N6 | Puertos sin vista de "libres" | Baja | Media | Bajo | Nuevo |
| S6 | Sin sugerir equipo por IP/URL en bóveda | Baja | Baja | Bajo | Nuevo |
| K6 | Sin procedimiento contextual desde equipo | Baja | Baja | Bajo | Nuevo |
| D3 | Lecturas full-table redundantes en ficha | Baja | Baja | Bajo | Nuevo |
| D4 | Árbol de topología recomputado por render | Baja | Media | Bajo | Nuevo |

---

## Parte IV. Recomendación final y hoja de ruta sugerida

El diseño actual NO es el problema; el problema es que el modelo maduró alrededor de "cosas" (dispositivos, procedimientos, red, secretos, lugares) y todavía no alrededor de "personas" ni de "el tiempo" (ciclo de vida). Las dos grandes piezas que faltan son estructurales y de alto valor, y encajan con el mismo patrón que la app ya domina (entidad + referencia viva + grafo derivado).

Hoja de ruta propuesta por fases (agrupando por afinidad técnica, no solo por prioridad):

- **Fase de corrección (rápida, alto impacto, bajo riesgo):** K1 (pérdida de metadata), S1 (rotar no resetea vencimiento), N1 (dirección de topología). Son defectos que hacen perder datos, mentir avisos o corromper la topología; se corrigen con poco código y conviene hacerlos antes de escalar el uso.
- **Fase persona (estructural, el mayor salto de valor):** T1 (entidad Persona/Responsable) con su migración asistida, reutilizando el patrón exacto de `ubicaciones`. Habilita el inventario por persona y el alta/baja de empleados.
- **Fase ciclo de vida:** L1 (baja con cascada), L2 (reemplazo con herencia), L3 (relación de sustitución) y T2 (garantía/compra), apoyados en el grafo de referencias inversas y el patrón de migración asistida.
- **Fase incorporación y cableado:** O1 (asistente/checklist post-alta apoyado en el motor de completitud existente), O2, O3, N2, N3, N4, N5, más la unificación D1. Colapsa el flujo estrella a un recorrido guiado.
- **Fase conocimiento:** K2 (bucle sugerencia -> borrador, ya planeado), K3, K4, K5, K6. Recicla el conocimiento del equipo sin re-teclear.
- **Fase secretos:** S2, S3, S4, S5, S6, unificando la política de rotación.
- **Fase deuda técnica (oportunista):** D2, D3, D4, cuando se toquen esas pantallas por otra razón.

Ninguno de estos cambios contradice el principio rector; al contrario, T1 lo extiende a las personas, L1/L2/L3 lo extienden al tiempo, y el resto elimina el trabajo manual y los re-tecleos que todavía quedan. Recomendación de arranque: la Fase de corrección (barata y con defectos activos) seguida de la Fase persona (el mayor retorno estructural).
