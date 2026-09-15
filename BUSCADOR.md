# Buscador de Soluciones IT

Fuente única del subsistema de búsqueda: qué se indexa, cómo se puntúan y ordenan los resultados, la búsqueda difusa, los sinónimos, la normalización, el rendimiento y los buscadores locales que conviven con el global.

Este documento reemplaza y amplía la sección 6 de [ARQUITECTURA.md](ARQUITECTURA.md), que ahora solo enlaza aquí. La experiencia visible del buscador (dónde está la caja, cómo se ven los resultados) vive en [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md); las reglas de negocio que cita este texto (RN) viven en [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md). El código es la fuente de verdad: cuando este documento y el código difieran, gana el código y se corrige este documento.

## 1. Idea general

- Un **único índice [MiniSearch](https://github.com/lucaong/minisearch) en memoria** construido sobre los datos locales (Dexie). No hay búsqueda contra el servidor: al ser 100% local responde en milisegundos y sin internet.
- El índice lo construye y consulta el hook `useIndiceBusqueda` (`src/features/busqueda/useIndiceBusqueda.ts`). Desde el 2026-09-14 el hook solo lee las tablas: **qué entra al índice lo decide la función pura `documentosDeBusqueda`**, en el mismo archivo, que se prueba sin navegador (borradores fuera, bóveda solo abierta). Lo consumen el buscador en línea de Inicio (`src/features/inicio/InicioPage.tsx`) y, desde la tarea 181, la capa global `BuscadorGlobal` (`src/features/busqueda/BuscadorGlobal.tsx`), que se abre con la lupa de la barra superior desde cualquiera de las cinco pestañas.
- **Cómo se presenta (2026-09-14):** el campo dice **"Buscar en Soluciones IT"** y, como apoyo, **"Guías, equipos, herramientas, glosario y más"**. Antes el alcance escrito era "Guías, Equipos y Bóveda" (Inicio) o una lista de seis secciones (la capa), y los dos callaban o enumeraban de más lo que el índice ya encontraba.
- El mismo hook alimenta las sugerencias anti duplicados al crear un artículo o un diagnóstico (`buscarSimilares` / `buscarArticulosSimilares`).
- Además del índice global existen varios **buscadores locales** más simples que filtran en el sitio la lista que una pantalla ya tiene cargada (Dispositivos, Red, Soluciones, Centro de consulta, alta de conexión). No pasan por MiniSearch (sección 10).

## 2. Qué se indexa, por entidad

El índice es único para todos los tipos de documento. Cada documento tiene tres campos indexables: `titulo`, `subtitulo` y `texto`. El peso no cambia por tipo de entidad, solo por campo (sección 4). Lo que cambia por tipo es qué se concatena en cada campo.

| Tipo | Condición para indexarse | `titulo` | `subtitulo` | `texto` (se tokeniza, no se muestra) |
|---|---|---|---|---|
| **articulo** | `estado === 'publicado'` y no eliminado | título | `categoría · tipo` | título + contenido Markdown + `textoDeProcedimiento` + etiquetas + síntomas + causas + nombres de dispositivos afectados |
| **dispositivo** | no eliminado (sin filtro de estado) | nombre | `marca · modelo · ubicación` | nombre, marca, modelo, serial, placa, ubicación (texto libre), responsable, IP, estado, observaciones y **todos los valores** de `detalles` (propiedades personalizadas) |
| **diagnostico** | no eliminado | título | `categoría · Diagnóstico` | título + descripción + `textoDeNodos` (preguntas, descripciones, etiquetas de opción, mensajes finales y títulos de artículos vinculados) |
| **categoria** | no eliminada | nombre | `Categoría` | solo el nombre |
| **ubicacion** | no eliminada | nombre | ruta de ancestros (`Sede > Área`) o `Ubicación` si es raíz | nombre + notas |
| **persona** | no eliminada | nombre | `Persona` | nombre + notas |
| **adjunto** (galería de paso) | por cada `paso.adjuntos[]` de un artículo publicado | nombre del archivo | `título del artículo · título del paso` | solo el nombre del archivo |
| **adjunto** (tabla `adjuntos`) | dueño (artículo publicado o dispositivo) resuelto localmente | nombre del archivo | título del dueño | solo el nombre del archivo |
| **herramienta** | no eliminada y de un tipo conocido | título, con la abreviatura entre paréntesis si la tiene ("SQL Server Management Studio (SSMS)") | `Herramienta · categoría` | `textoBuscable`: título, abreviatura, alias, descripción, para qué sirve, proveedor, uso en Metroparques, notas y etiquetas |
| **termino** | ídem | ídem | `Término · categoría` | `textoBuscable`: título, abreviatura, alias, definición y etiquetas |
| **atajo** | ídem | ídem | `Atajo · plataforma · categoría` (sin repetir) | `textoBuscable`: título, alias, plataforma, combinación, cuándo sirve, resultado esperado, notas y etiquetas |
| **comando** | ídem | ídem | `Comando · plataforma · categoría` (sin repetir) | ídem, con el comando completo |
| **credencial** | **solo con la bóveda desbloqueada** | título | `categoría` (texto libre) | título + nombre del archivo seguro adjunto (nunca su contenido cifrado) |
| **campo protegido** | **solo con la bóveda desbloqueada** y equipo dueño resuelto | `nombre del campo · nombre del equipo` | `Dato protegido del equipo` | nombre del campo + nombre del equipo (nunca el valor cifrado) |

Notas importantes:

- `textoDeProcedimiento` (`src/lib/procedimiento.ts`) aplana el JSON `procedimiento` a texto: descripción, objetivo general, requisitos, verificación final y, por cada paso, su título, objetivo, el texto de cada bloque (tareas, avisos, pies de imagen), el título del subprocedimiento, el de la solución vinculada y el de las decisiones. **Excluye a propósito** el título de un `vinculoProtegido` de paso o tarea: ese texto solo entra al índice como campo protegido independiente y solo con la bóveda desbloqueada.
- El **Centro de consulta** (antes "Referencia") usa **cuatro tipos de resultado** (`herramienta`, `termino`, `atajo`, `comando`) y no uno solo: el resultado tiene que decir de qué clase es, y "Referencia" a secas no distinguía un programa, una palabra del glosario y algo que se teclea. Los cuatro comparten el grupo **Centro de consulta** en la interfaz, con su propio glifo cada uno (llave inglesa, libro, teclado y consola; regla R16: nunca solo el color). Abrir un resultado lleva directo a su ficha, `/referencia/<id>`. Un subtítulo como "Atajo · Windows · Windows" (plataforma y categoría iguales) se escribe una sola vez.
- Una ficha de un tipo que esta versión **no conoce** (escrita por una versión más nueva de la app) no entra al índice, en vez de romperlo.
- El texto indexado de una ficha es exactamente el mismo `textoBuscable` (`src/features/referencia/referencias.ts`) que usa el buscador de la propia pantalla del Centro de consulta: buscar dos veces lo mismo no puede dar dos resultados distintos. **Las guías relacionadas de una herramienta no entran en ese texto**: buscar el título de un borrador no debe devolver la herramienta que lo enlaza.
- El campo protegido se indexa con `tipo: 'dispositivo'` (no existe un tipo propio `campo_protegido` en el buscador); en la interfaz aparece dentro del grupo Dispositivos.
- **Nunca** se indexa `datosCifrados` (credencial) ni `valorCifrado` (campo protegido): solo metadatos en claro. Esto es RN de la bóveda (ver [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md), sección de auditoría y cifrado). Una prueba lo comprueba sobre `documentosDeBusqueda`.

## 3. Qué devuelve cada resultado

MiniSearch guarda `storeFields: ['tipo', 'titulo', 'subtitulo', 'ruta', 'portadaRef']` y devuelve además el `id`. El campo largo `texto` no se guarda ni se devuelve: solo sirve para indexar. Cada resultado se mapea a `ResultadoBusqueda { id, tipo, titulo, subtitulo, ruta, portadaRef }`.

`portadaRef` es la referencia de Storage de una miniatura: portada del procedimiento (artículo), foto principal (dispositivo) o la propia referencia si el adjunto es una imagen. Es `''` para categoría, ubicación, persona, diagnóstico, fichas del Centro de consulta, credencial y campo protegido (la credencial nunca expone la referencia de su archivo, que apunta al bucket cifrado `archivos_boveda`).

> **Estado real (2026-07-24):** `portadaRef` se calcula y viaja hasta el resultado, pero **ningún componente de la interfaz lo pinta**. La fila de resultado (`FilaResultado`, en `src/features/busqueda/ResultadosBusqueda.tsx` desde la tarea 181) usa un icono genérico por tipo, no la miniatura. La miniatura en resultados está pendiente (ver [TAREAS.md](TAREAS.md)).

## 4. Opciones de búsqueda

Todo se fija una vez al construir el índice (`crearIndiceDesdeDocumentos`), no por consulta:

- **`fuzzy: 0.2`** (tolerancia a errores de escritura). MiniSearch interpreta un `fuzzy` menor a 1 como fracción de la longitud del término: `maxDistance = round(longitud * 0.2)`. En la práctica: 1-2 letras no toleran error; 3-4 letras toleran 1; 5-9 letras toleran 1-2. Por eso `epsom` encuentra `Epson` (5 letras, distancia 1).
- **`prefix`**: coincide por prefijo además de por término completo (`impre` encuentra `impresora` e `impresión`), **salvo una letra suelta que acompaña a otras palabras** (2026-09-14). En "windows r" la "r" es la tecla del atajo, no el comienzo de "router", "red" y "respaldo": como prefijo traía media base y el atajo buscado quedaba enterrado. Una letra sola ("r") se sigue tratando como prefijo, que es lo esperable al empezar a teclear.
- **`combineWith`**: no se fija en el código, así que rige el valor por defecto de la librería, **OR**. Los términos suman, nunca restringen. Esto es coherente con que los sinónimos solo agreguen resultados (sección 6).
- **`processTerm`**: no se sobreescribe. El valor por defecto solo pasa a minúsculas; **no quita acentos** (ver la consecuencia en la sección 5).
- **Boost por campo**: `{ titulo: 3, subtitulo: 1.5 }`; `texto` pesa 1. A igualdad de campo, un match exacto pesa más que uno por prefijo, y este más que uno difuso (pesos por defecto de la librería `fuzzy: 0.45`, `prefix: 0.375`).

## 5. Normalización de texto

Hay tres funciones de normalización independientes y **ninguna compartida** entre sí. Es deuda de mantenibilidad conocida (ver [TAREAS.md](TAREAS.md)):

1. `incluyeTexto` / `texto` (`src/lib/texto.ts`): baja a minúsculas, **no quita acentos**. La usan los buscadores locales de Dispositivos, Red y alta de conexión.
2. `normalizar` (`src/features/busqueda/sinonimos.ts`): minúsculas + NFD + quita diacríticos. Solo para resolver claves de sinónimos.
3. `normalizarTexto` (`src/features/soluciones/iconosSoluciones.ts`): minúsculas + NFD + quita diacríticos. Duplica a la anterior con otra implementación. La usan Soluciones, Inicio y el Centro de consulta para el filtro propio y el resaltado.

**El índice global (MiniSearch) no usa ninguna de las tres.** Como su `processTerm` solo hace `toLowerCase()`, la tolerancia a acentos en el buscador de Inicio es un **efecto secundario del `fuzzy`**, no una normalización deliberada: `camara` encuentra `cámara` porque su distancia de edición es 1 y el término mide 6 letras, pero en términos muy cortos (donde la tolerancia difusa cae a 0) una diferencia de acento podría no encontrarse por el índice global.

La insensibilidad a mayúsculas sí es universal y consistente (las tres funciones y el índice bajan a minúsculas).

## 6. Sinónimos

`src/features/busqueda/sinonimos.ts`. Diccionario curado a mano, con dos clases de grupo desde el 2026-09-14.

**Grupos simétricos (19):** buscar cualquiera de sus entradas agrega las demás.

`backup/respaldo/copia de seguridad` · `internet/red/wifi/ip/conexion` · `impresora/impresion/imprimir` · `contraseña/clave/password` · `computador/computadora/pc/equipo` · `camara/cctv/video` · `pos/datafono/punto de venta` · `correo/email` · `servidor/server` · `pantalla/monitor` · `lento/lentitud/demorado` · `encender/prender` · `tightvnc/vnc` · `icg/icg manager` · `hka/factura/facturación` · `sonicwall/firewall` · `vmware/esxi/virtualización` · `issabel/pbx/telefonía` · `ssms/sql server management studio`

**Grupos de una vía (7):** las claves agregan la herramienta, pero buscar la herramienta **no** trae de vuelta la clave.

`acceso remoto`, `control remoto` → `tightvnc`, `vnc` · `acceso remoto` → `anydesk` · `monitoreo`, `monitorización` → `zabbix` · `ada`, `erp` → `sicof` · `front rest` → `frontrest` · `document`, `gestión documental` → `workflow` · `documentos` → `sharepoint`

**Por qué existen los de una vía.** La palabra general lleva a la herramienta; la herramienta no arrastra la palabra general. Con los grupos simétricos de siempre, buscar "anydesk" habría agregado "acceso" y "remoto", que por prefijo traen "Punto de acceso" y cada ficha que diga "remotamente"; "zabbix" habría agregado "monitoreo", que por la tolerancia a erratas encuentra cada "monitor" del inventario; "sicof" habría agregado "ada", que encuentra "cada" y "adaptadores"; y "workflow", "document", que por prefijo encuentra cada "documentado". **Nada se agregó al grupo de "red"**: buscar "red" sigue sin arrastrar Zabbix, SonicWall, servidores ni switches.

Mecánica (`expandirConsulta`):

- Cada entrada, de una palabra o de varias, funciona como clave. **Una clave de varias palabras se detecta escrita entera y seguida** ("acceso remoto", "copia de seguridad"; desde el 2026-09-14): "acceso al servidor remoto" no es la frase.
- Lo que se agrega va en palabras sueltas: una entrada de varias palabras aporta sus palabras, sin las vacías (`de, la, el, a, y, en`); `pos` expande a `datafono, punto, venta`.
- La consulta expandida mantiene los términos originales primero y agrega los sinónimos al final, sin repetir lo ya escrito. Como el índice combina con OR, la expansión nunca resta resultados.
- Se aplica en toda consulta al índice: la búsqueda de Inicio, la capa global y las sugerencias anti duplicados de artículos y diagnósticos.

El mismo diccionario **no** alimenta el selector de "vincular procedimiento" de un paso (sección 8) ni el buscador local del Centro de consulta.

## 7. Ranking y agrupación

- **Orden interno**: MiniSearch devuelve por score descendente (BM25 + boost por campo + pesos difuso/prefijo). No hay desempate adicional configurado por la app; a score idéntico el orden no está garantizado.
- **Agrupación**: los resultados no se muestran como lista plana. `GRUPOS_BUSQUEDA` (en `src/features/busqueda/resultados.ts` desde la tarea 181; antes vivía dentro de `InicioPage.tsx`) define seis grupos por fuente, en orden fijo: **Guías** (incluye diagnóstico, categoría, artículo y adjunto), **Equipos**, **Bóveda**, **Ubicaciones**, **Personas** y **Centro de consulta** (herramienta, término, atajo y comando). Lo aplican por igual Inicio y la capa global. Dentro de cada grupo se respeta el score; entre grupos el orden es siempre el mismo (Soluciones primero), aunque un resultado de otro grupo tenga mayor score.
- **Sin tope ni paginación**: se pintan todos los resultados de cada grupo. Con el volumen del equipo no es un problema; queda anotado como ausencia de límite si el contenido crece (ver [TAREAS.md](TAREAS.md)).

## 8. Sugerencias anti duplicados

`buscarSimilares` / `buscarArticulosSimilares` (`useIndiceBusqueda.ts`) reutilizan el mismo índice y la misma expansión de sinónimos, pero además:

- Exigen que el término haya coincidido en el campo `titulo` (una coincidencia solo en `texto` o `subtitulo` no cuenta como "similar").
- Excluyen el propio id y truncan a un límite (3 por defecto).

Consumidores: el aviso de título parecido al crear un artículo (`ArticuloForm.tsx`) y el equivalente al crear un diagnóstico (`DiagnosticoForm.tsx`), con un debounce manual de 300 ms sobre el título.

Como reutilizan el índice global, estas sugerencias también excluyen borradores y obsoletos: dos borradores parecidos escritos en paralelo no se detectarían entre sí hasta que uno se publique.

El **selector de "vincular procedimiento existente"** de un paso (`VinculoDelPaso` en `PasosEditor.tsx`) es un `<select>` nativo que lista todos los artículos vinculables ordenados alfabéticamente. No usa MiniSearch, ni fuzzy, ni sinónimos.

## 9. Qué queda fuera del índice, y por qué

- **Artículos en `borrador` u `obsoleto`**: no son contenido oficial para sugerir al equipo. (Los borradores propios sí se ven en la pantalla de Soluciones, que tiene su propio filtro, ver sección 10; y una herramienta del Centro de consulta puede enlazar un borrador como guía relacionada, con su pastilla, sin que eso lo haga aparecer en el buscador.)
- **Cualquier fila con `eliminadoEn`** (borrado suave): excluida en todas las entidades.
- **Credenciales y campos protegidos sin la bóveda desbloqueada**: hay dos barreras distintas. La RLS del servidor decide si esas filas siquiera se sincronizan al dispositivo (sin permiso de bóveda, la tabla local ni las tiene); y `bovedaDesbloqueada` es un flag en memoria de la sesión que exige haber tecleado la contraseña maestra y se resetea por inactividad. Un técnico con permiso pero sin desbloquear no ve ningún resultado de bóveda.
- **Adjuntos huérfanos**: un adjunto cuyo dueño ya no resuelve localmente (o es un borrador) se descarta.
- **Fichas del Centro de consulta de un tipo desconocido**: las escribió una versión más nueva de la app.
- **Tablas no listadas** (historial, ejecuciones de diagnóstico, progreso, favoritos, recientes, conexiones, syncMeta): no alimentan el índice.

## 10. Buscadores locales (contraste)

Filtran en el sitio la lista que la pantalla ya cargó. No usan MiniSearch.

**Usan `incluyeTexto`** (subcadena, sensible a acentos, sin resaltado):

- **Alta de conexión** (`candidatosConexion` en `src/lib/conexiones.ts`): filtra por subcadena en `[nombre, ubicacion, ip]`. Sin texto, en vez de mostrar todo, pre-sugiere candidatos por puntaje (+2 si comparte ubicación con el equipo actual, +1 si su categoría es de red) y ordena por ese puntaje.
- **Dispositivos** (`DispositivosPage.tsx`): `[nombre, ip, ubicacion, serial]`.
- **Red** (`RedPage.tsx`): `[nombre, ubicacion, ip, marca, modelo, categoría]`.

**Centro de consulta** (`ReferenciaPage.tsx`, `coincide` y `filtrarCatalogo` en `src/features/referencia/referencias.ts`): subcadena sin acentos (`normalizarTexto`) sobre el mismo `textoBuscable` del índice global, **dentro de la pestaña abierta** (herramientas, glosario, atajos o comandos) y acotada por su eje (categoría o plataforma). Sin coincidencias en la pestaña, el estado vacío dice en qué otras pestañas sí las hay y lleva a ellas con la búsqueda puesta (`coincidenciasPorTipo`). La pestaña, el texto y el filtro viven en la URL (`?tab=`, `?q=`, `?categoria=` o `?plataforma=`).

**No usa `incluyeTexto`: Soluciones va aparte** (`src/features/soluciones/coincidencia.ts`, función `coincidenciaArticulo`; hasta el 2026-07-27 era una función `coincide` dentro de `SolucionesPage.tsx`). Se bifurcó a propósito porque necesita tres cosas que `incluyeTexto` no da:

1. Insensibilidad a acentos (usa `normalizarTexto` en ambos lados).
2. La posición del match para resaltar el fragmento coincidente en el título (`partirTitulo`, en el mismo módulo).
3. **Por dónde** coincidió, no solo si coincidió (ver abajo).

Además compara contra campos propios del artículo (categoría resuelta por nombre, etiqueta de tipo, array de etiquetas) e incluye borradores y obsoletos con su badge (el técnico necesita encontrar sus propios borradores en su pantalla, aunque el resto del equipo no deba verlos en el buscador global).

### 10.1 Soluciones dice por dónde coincidió (2026-07-27)

`coincidenciaArticulo` devuelve, además del booleano, **dónde** acertó el término. Sale del problema P1-7 de la auditoría de diseño: la lista decía "3 resultados" pero no por qué, y cuando un artículo coincidía por una etiqueta y no por el título, el técnico veía una fila que no menciona lo que buscó.

Orden de prioridad, con el primero que acierta ganando: **título** (no necesita explicación, la fila resalta el término), **etiqueta**, **categoría**, **tipo**. La etiqueta va antes que categoría y tipo porque es la coincidencia más específica y la más sorprendente de las tres: nombra un equipo o una sede concreta, no un cajón. Cuando no fue el título, `FilaArticulo` sustituye la línea de metadatos por "Coincide en la etiqueta *zebra*".

### 10.2 Buscar ya no apaga los filtros en silencio (2026-07-27)

Antes, escribir en el buscador de Soluciones descartaba la categoría y el tipo elegidos **sin avisar**: el chip activo desaparecía y el resultado salía de otra categoría sin explicación (problema P1-6). El comportamiento por defecto sigue siendo el mismo (buscar mira todas las categorías, que es lo que se espera al escribir), pero ahora:

- Una cinta de contexto lo dice: "Busco en todas las categorías. El filtro **Impresoras** queda en pausa."
- Un botón "Solo ahí" acota la búsqueda a esa categoría (estado `soloEnCategoria`), y "En todas" la vuelve a abrir.
- El filtro de tipo se limpia al buscar, como antes.

### 10.3 Corrección ortográfica local del estado vacío (2026-07-27)

Cuando la búsqueda de Soluciones no encuentra nada, el estado vacío ofrece "Quizá quisiste decir *zebra*" (`src/features/soluciones/sugerenciaBusqueda.ts`).

**No reutiliza el `fuzzy` del índice global** aunque MiniSearch ya lo trae, porque ese índice **excluye borradores y obsoletos** a propósito (sección 9) y Soluciones los lista igual: sugerir contra un vocabulario que no incluye lo que la pantalla sí enseña daría "no hay nada parecido" con el artículo delante. Es la misma razón por la que la tarea 145 decidió no unificar este buscador con el global.

Cómo funciona:

- **Vocabulario:** palabras de 4+ letras de los títulos, etiquetas y nombres de categoría de lo que la pantalla lista. Se guarda la forma normalizada como clave y la **original** como valor, para poder sugerir "Cámaras" y no "camaras".
- **Distancia de edición** (Levenshtein) con corte temprano: en cuanto la fila mínima supera la tolerancia se abandona, porque solo importa si entra o no.
- **Tolerancia por longitud:** 0 con menos de 4 letras (con 3, "red" y "web" están a distancia 2 y sugerir una por otra sería adivinar), 1 entre 4 y 6, 2 desde 7. Mismo criterio que el `fuzzy: 0.2` del índice global, pero explícito.
- **Desempate:** gana la más corta y, a igual longitud, la primera alfabéticamente. El resultado tiene que ser estable entre teléfonos, no depender del orden de la base.
- No sugiere nada si la consulta **ya es** una palabra del vocabulario (no coincidió por otra razón, no por una errata).

> `valoresUnicos` (`src/lib/vocabulario.ts`) no es un buscador: deduplica valores para las listas de autocompletar (`datalist`). Se menciona solo para evitar confusión.

## 11. Rendimiento

- El índice se **reconstruye completo** (no incremental) en cada cambio de datos: `useIndiceBusqueda` lee cada entidad con `useLiveQuery` y recalcula toda la lista en un `useMemo` con `documentosDeBusqueda`. Para un equipo de 5 técnicos (cientos de documentos) es instantáneo.
- El riesgo del diseño no es el volumen actual sino la **frecuencia**: cualquier sincronización en tiempo real que toque una de las tablas indexadas mientras Inicio está abierto fuerza una reconstrucción completa, no solo del documento cambiado. Objetivo y volúmenes esperados en [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md), sección de rendimiento.
- Tanto la caja de Inicio como la capa global usan `useDeferredValue` sobre la consulta para que escribir se sienta instantáneo aunque construir o consultar el índice tarde algo más. Los avisos anti duplicados usan un debounce de 300 ms.

## 12. Deuda y mejoras registradas

Todas registradas en [TAREAS.md](TAREAS.md):

- Miniatura de portada en resultados: `portadaRef` viaja pero no se pinta.
- Chips de filtro por tipo: descritos en la documentación previa pero inexistentes en el código. (El agrupado era inline en `InicioPage.tsx`; la tarea 181 lo extrajo a `busqueda/resultados.ts` y `busqueda/ResultadosBusqueda.tsx`, pero sigue sin haber chips de tipo.)
- Tres normalizaciones de acentos sin unificar (`texto.ts`, `sinonimos.ts`, `iconosSoluciones.ts`).
- Sin tope de resultados en el buscador global.
- Acentos en el índice global dependen del `fuzzy`, no de una normalización propia: los términos cortos son el borde débil.

## 13. Referencias

- Experiencia visible (caja de Inicio, capa global, resultados): [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md), secciones Inicio y Centro de consulta.
- Reglas de negocio y objetivos de rendimiento: [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md).
- Stack y decisiones técnicas: [ARQUITECTURA.md](ARQUITECTURA.md) y [DECISIONES.md](DECISIONES.md) (AD-037 para los sinónimos de una vía y la letra suelta).
- Archivos clave: `src/features/busqueda/useIndiceBusqueda.ts`, `sinonimos.ts`, `resultados.ts`; `src/features/referencia/referencias.ts`; `src/lib/texto.ts`, `procedimiento.ts`, `diagnostico.ts`; `src/features/inicio/InicioPage.tsx`.
