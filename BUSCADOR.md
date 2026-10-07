# Buscador de Soluciones IT

Fuente única del subsistema de búsqueda: qué se indexa, cómo se puntúan y ordenan los resultados, la búsqueda difusa, los sinónimos, la normalización, el rendimiento y los buscadores locales que conviven con el global.

Este documento reemplaza y amplía la sección 6 de [ARQUITECTURA.md](ARQUITECTURA.md), que ahora solo enlaza aquí. La experiencia visible del buscador (dónde está la caja, cómo se ven los resultados) vive en [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md); las reglas de negocio que cita este texto (RN) viven en [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md). El código es la fuente de verdad: cuando este documento y el código difieran, gana el código y se corrige este documento.

## 1. Idea general

- Un **único índice [MiniSearch](https://github.com/lucaong/minisearch) en memoria** construido sobre los datos locales (Dexie). No hay búsqueda contra el servidor: al ser 100% local responde en milisegundos y sin internet.
- El índice lo construye y consulta el hook `useIndiceBusqueda` (`src/features/busqueda/useIndiceBusqueda.ts`). Desde el 2026-09-14 el hook solo lee las tablas: **qué entra al índice lo decide la función pura `documentosDeBusqueda`**, en el mismo archivo, que se prueba sin navegador (borradores fuera, bóveda solo abierta). Lo consumen el buscador en línea de **Resolver** (`src/features/inicio/ResolverPage.tsx`; hasta el 2026-09-21 era Inicio, `InicioPage.tsx`) y, desde la tarea 181, la capa global `BuscadorGlobal` (`src/features/busqueda/BuscadorGlobal.tsx`), que se abre con la lupa de la barra superior desde cualquier sección que no traiga su propio campo. Donde este documento dice "el buscador de Inicio", desde el 2026-09-22 es el de Resolver: el motor, el índice, el ranking y el comportamiento no cambiaron.
- **Cómo se presenta (2026-10-02, tarea 288):** encima del campo, la pregunta **"¿Qué necesitas resolver?"**; en el campo, el marcador **"Describe qué necesitas resolver…"**, que invita a contar lo que pasa en vez de pedir una categoría; y, con el campo vacío, una ayuda de una línea debajo, **"Ej.: no imprime, usuario bloqueado, impresora mercadeo"**, que se pliega con el primer carácter igual que la pregunta. La capa de la lupa usa el mismo marcador y la misma ayuda (`MARCADOR_BUSCADOR` y `AYUDA_BUSCADOR`, en `resultados.ts`). La ayuda cabe en una línea a 390 px (334 px de los 350 útiles, con Inter a 12,5 px): la primera versión, "Ej.: no imprime el PDF, …", medía 375 y se partía en dos, y se acortó en la QA de la tarea.
- **Cómo se presentaba:** entre el 2026-10-01 (tarea 287) y la tarea 288, con el marcador **"Problema, equipo o comando"**; desde el 2026-09-22 (tarea 254), **"Buscar problema, equipo, comando…"**. Entre el 2026-09-17 y el 2026-09-21 la pregunta fue "¿Qué necesitas solucionar?" con el marcador "Procedimiento, error, equipo…".
- **Cómo se presentaba (2026-09-15):** el campo preguntaba **"¿Qué necesitas resolver?"** y, como apoyo, **"Busca una guía, equipo, acceso, herramienta, comando o problema"**. La **etiqueta accesible sigue siendo "Buscar en Soluciones IT"**, que es lo que distingue este buscador de los de sección (regla M-R8); lo que cambia es el marcador de posición, mediante `textoAlternativo` de `CampoBusqueda`, que existe justo para el campo que es una pregunta y no un alcance. Antes decía "Buscar en Soluciones IT" con la frase "Guías, equipos, herramientas, glosario y más" (2026-09-14), y antes de eso enumeraba secciones.
- **Desde el 2026-09-15 (tarea 241) el buscador no solo encuentra: RESUELVE.** Sobre lo que `buscar` devuelve hay una segunda lectura, "Mejores resultados" (sección 7.1), y cada uno de esos resultados trae su **acción directa** (empezar o continuar una guía, iniciar un diagnóstico, copiar una credencial o un comando; sección 7.2). El motor no cambió: MiniSearch, los sinónimos y el ranking son los mismos.
- **Desde el 2026-10-02 (tarea 288) entiende qué se pide**, sin IA generativa, sin servicios externos y sin dejar MiniSearch: todo sigue siendo local y funciona sin conexión. El índice guarda cada dato en el campo que dice lo que es (sección 2); la consulta se lee sin tildes y sin las palabras vacías de una frase (secciones 4 y 5); cada resultado sabe en qué campo coincidió cada palabra (sección 3); las intenciones se leen como palabras y con la evidencia de lo encontrado (sección 7.3); el ranking mide cuánto de la consulta explica cada resultado (sección 7.1); y la pantalla solo dice "Mejor coincidencia" cuando una opción es claramente superior (sección 7.9). El benchmark de la sección 14 pasó de 13 a 35 de 35 casos sin tocar uno. Decisión en [DECISIONES.md](DECISIONES.md) AD-062.
- El mismo hook alimenta las sugerencias anti duplicados al crear un artículo o un diagnóstico (`buscarSimilares` / `buscarArticulosSimilares`).
- Además del índice global existen varios **buscadores locales** más simples que filtran en el sitio la lista que una pantalla ya tiene cargada (Dispositivos, Red, Soluciones, Centro de consulta, alta de conexión). No pasan por MiniSearch (sección 10).

## 2. Qué se indexa, por entidad

El índice es único para todos los tipos de documento. Desde la tarea 288 cada documento tiene **siete campos indexables**, cada uno con su significado (`CampoIndice` y `CAMPOS_INDICE`, en `useIndiceBusqueda.ts`):

- `titulo`: el nombre canónico.
- `subtitulo`: el contexto que se ve bajo el nombre (categoría y tipo; marca y lugar de un equipo; la ruta de una ubicación).
- `formasBusqueda`: cómo lo buscaría alguien que no sabe su nombre (el campo editorial de las guías, al final de esta sección).
- `sintomas`: qué ocurre (los síntomas de una guía).
- `cuandoUsar`: cuándo corresponde usarlo (la descripción de un procedimiento o de una guía con preguntas; el "cuándo usar" de un comando, un atajo o una herramienta).
- `identidad`: con qué se identifica, sin ser el nombre. De un equipo: marca, modelo, serial, placa, IP, lugar y responsable. De un comando o un atajo: lo que se teclea. De una ficha del Centro de consulta: sus otros nombres. De una credencial: los equipos a los que da acceso. Nunca un valor protegido.
- `texto`: el contenido general. Sigue encontrando, con menos autoridad.

**Cada dato vive en UN campo**: separarlos no duplica nada, y el nombre ya no se repite dentro de `texto`. Hasta la tarea 288 eran tres campos (`titulo`, `subtitulo` y `texto`) y casi todo iba revuelto en `texto`: el buscador encontraba igual, pero no podía saber por qué coincidía un resultado, y no es lo mismo que "no imprime" esté en los síntomas de una guía que en el paso 7 de otra. El peso no cambia por tipo de entidad, solo por campo (sección 4). Lo que cambia por tipo es qué va en cada campo:

| Tipo | Condición para indexarse | `titulo` | `subtitulo` | Los demás campos (se tokenizan, no se muestran) |
|---|---|---|---|---|
| **articulo** | `estado === 'publicado'` y no eliminado | título | `categoría · tipo` | `formasBusqueda`: sus formas de búsqueda, una frase por línea · `sintomas`: sus síntomas · `cuandoUsar`: la descripción del procedimiento ("¿Cuándo usar este procedimiento?") · `texto`: contenido Markdown + `textoDeProcedimiento` (ya sin la descripción) + etiquetas + causas + nombres de los equipos donde aplica |
| **dispositivo** | no eliminado (sin filtro de estado) | nombre | `marca · modelo · ubicación`, solo lo que el nombre no dice ya y con la ubicación de su ficha si está vinculada (tarea 277, `lineasDeContexto`) | `identidad`: marca, modelo, `serial …`, `placa …` e `ip …` (con su rótulo, porque así los pide el técnico: "serial ABC123" se explica entero con ESE equipo), la ubicación (el texto heredado y, si está vinculada, el nombre de su ficha, sin repetirlos) y el responsable · `texto`: estado, observaciones y **todos los valores** de `detalles` (propiedades personalizadas, texto libre de cualquier clase). Lo que el subtítulo calla sigue en el título o en la identidad, así que se encuentra igual |
| **diagnostico** | no eliminado | título | `categoría · Diagnóstico` | `cuandoUsar`: su descripción · `texto`: `textoDeNodos` (preguntas, descripciones, etiquetas de opción, mensajes finales y títulos de artículos vinculados) |
| **categoria** | no eliminada | nombre | `Categoría` | nada más: el nombre ya es el título |
| **ubicacion** | no eliminada | nombre | ruta de ancestros (`Sede > Área`) o `Ubicación` si es raíz | `texto`: notas |
| **persona** | no eliminada (también las retiradas, tarea 266) | nombre | `Persona`, o `Persona · Retirada` | `texto`: notas |
| **adjunto** (galería de paso) | por cada `paso.adjuntos[]` de un artículo publicado | nombre del archivo | `título del artículo · título del paso` | nada más: el nombre del archivo ya es el título |
| **adjunto** (tabla `adjuntos`) | dueño (artículo publicado o dispositivo) resuelto localmente | nombre del archivo | título del dueño | nada más: el nombre del archivo ya es el título |
| **herramienta** | no eliminada y de un tipo conocido | título, con la abreviatura entre paréntesis si la tiene ("SQL Server Management Studio (SSMS)") | `Herramienta · categoría` | las palabras de `textoBuscable`, repartidas: `identidad`: los alias · `cuandoUsar`: para qué sirve · `texto`: la descripción breve, el proveedor, el uso en Metroparques, las notas y las etiquetas |
| **termino** | ídem | ídem | `Término · categoría` | `identidad`: los alias · `texto`: la definición y las etiquetas |
| **atajo** | ídem | ídem | `Atajo · plataforma · categoría` (sin repetir) | `identidad`: la combinación (lo que se teclea) y los alias · `cuandoUsar`: cuándo sirve · `texto`: la plataforma, el resultado esperado, las notas y las etiquetas |
| **comando** | ídem | ídem | `Comando · plataforma · categoría` (sin repetir) | `identidad`: el comando completo y los alias · `cuandoUsar`: cuándo utilizarlo · `texto`: lo demás, igual que un atajo |
| **credencial** | **solo con la bóveda desbloqueada** | título | `categoría` (texto libre) | `identidad`: los nombres de los equipos a los que da acceso (en claro a propósito: no son el secreto; así "clave impresora mercadeo" encuentra la clave de ESE equipo) · `texto`: el nombre del archivo seguro adjunto (nunca su contenido cifrado) |
| **campo protegido** | **solo con la bóveda desbloqueada** y equipo dueño resuelto | `nombre del campo · nombre del equipo` | `Dato protegido del equipo` | nada más: el nombre del dato y el del equipo ya son el título (nunca el valor cifrado) |

Notas importantes:

- `textoDeProcedimiento` (`src/lib/procedimiento.ts`) aplana el JSON `procedimiento` a texto: descripción, objetivo general, requisitos, verificación final y, por cada paso, su título, objetivo, **lugar** ("Dónde") y **resultado** ("Debes ver"; los dos desde el 2026-09-22, tarea 255: buscar "dispositivos e impresoras" encuentra la guía que se hace ahí), el texto de cada bloque (tareas, avisos, pies de imagen), **las microacciones de "Cómo hacerlo"** de cada acción (su acción, su elemento y su ubicación; desde el 2026-10-07, tarea 303: el nombre de una opción de menú, un acceso directo o un comando escrito ahí encuentra la guía, como cuando vivía en un dato técnico o en la instrucción), el título del subprocedimiento, el de la solución vinculada y el de las decisiones. **Desde la tarea 288 ya no lleva la `descripcion`** ("¿Cuándo usar este procedimiento?"): va en su propio campo, `cuandoUsar`, y se encuentra igual, con más autoridad y sin duplicarse. **Excluye a propósito** el título de un `vinculoProtegido` de paso o tarea: ese texto solo entra al índice como campo protegido independiente y solo con la bóveda desbloqueada.
- El **Centro de consulta** (antes "Referencia") usa **cuatro tipos de resultado** (`herramienta`, `termino`, `atajo`, `comando`) y no uno solo: el resultado tiene que decir de qué clase es, y "Referencia" a secas no distinguía un programa, una palabra del glosario y algo que se teclea. Los cuatro comparten el grupo **Centro de consulta** en la interfaz, con su propio glifo cada uno (llave inglesa, libro, teclado y consola; regla R16: nunca solo el color). Abrir un resultado lleva directo a su ficha, `/referencia/<id>`. Un subtítulo como "Atajo · Windows · Windows" (plataforma y categoría iguales) se escribe una sola vez.
- Una ficha de un tipo que esta versión **no conoce** (escrita por una versión más nueva de la app) no entra al índice, en vez de romperlo.
- Lo indexado de una ficha son exactamente las palabras del mismo `textoBuscable` (`src/features/referencia/referencias.ts`) que usa el buscador de la propia pantalla del Centro de consulta (buscar dos veces lo mismo no puede dar dos resultados distintos), repartidas desde la tarea 288 por lo que significan: el título lleva la abreviatura, lo que se teclea y los otros nombres son su identidad, y el "cuándo usar" es su cuándo usar. **Las guías relacionadas de una herramienta no entran en ese texto**: buscar el título de un borrador no debe devolver la herramienta que lo enlaza.
- El campo protegido se indexa con `tipo: 'dispositivo'` (no existe un tipo propio `campo_protegido` en el buscador); en la interfaz aparece dentro del grupo Dispositivos.
- **Nunca** se indexa `datosCifrados` (credencial) ni `valorCifrado` (campo protegido): solo metadatos en claro. Esto es RN de la bóveda (ver [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md), sección de auditoría y cifrado). Una prueba lo comprueba sobre `documentosDeBusqueda`.
- **Formas de búsqueda de una guía (2026-10-02, tarea 288, RN-059).** En el editor, "¿Cómo buscaría alguien esta guía?" (pestaña General, bajo "Objetivo general"): frases que alguien escribiría sin saber el nombre de la guía, una por línea ("no me deja enviar archivo pesado", "archivo grande por correo"). Se guardan en el JSON `procedimiento` (`formasBusqueda`), sin columna ni migración, recortadas, sin vacías y sin repetir la misma frase; solo alimentan este campo del índice, que pesa como el título: no se ven al ejecutar la guía, no son obligatorias y no cuentan para publicar ni para la completitud. Son distintas del título (el nombre), de "cuándo usar" (cuándo corresponde), de los síntomas (qué ocurre) y de las causas (por qué). **Las guías reales todavía no las tienen**: se rellenan como trabajo editorial posterior, basado en la auditoría de contenido, y solo después de que todos los teléfonos tengan la versión que las conoce, porque una versión anterior que edite y guarde la guía las descarta (regla 24 de [REGLAS.md](REGLAS.md)). No se generan automáticamente.

## 3. Qué devuelve cada resultado

MiniSearch guarda `storeFields: ['tipo', 'titulo', 'subtitulo', 'ruta', 'portadaRef']` y devuelve además el `id`. Los campos largos (`texto` y, desde la tarea 288, `formasBusqueda`, `sintomas`, `cuandoUsar` e `identidad`) no se guardan ni se devuelven: solo sirven para indexar. Cada resultado se mapea a `ResultadoBusqueda { id, tipo, titulo, subtitulo, ruta, portadaRef, soloSinonimo, camposCoincidentes, camposPorPalabra, camposPorSinonimo, puntajeIndice }`.

`soloSinonimo` (2026-09-15) marca el resultado que **no coincide con lo que se escribió**: lo trajo un sinónimo. El orden de `buscar` ya lo decía (los directos van primero), pero "Mejores resultados" reordena por relevancia operativa y necesita el dato explícito para no dejar que un sinónimo adelante a una coincidencia directa (sección 7.1).

**Metadata mínima de la coincidencia (2026-10-02, tarea 288).** MiniSearch ya sabía en qué campos coincidió cada término, y `buscar` lo descartaba. Ahora cada resultado lleva solo lo que el ranking necesita:

- `camposPorPalabra`: para cada palabra que dice algo de la consulta (`palabrasDeContenido`, en su orden), los campos donde coincidió ella misma; `[]` si no coincidió.
- `camposPorSinonimo`: lo mismo, por un sinónimo de esa palabra ("backup" por "respaldo"; `sinonimosPorPalabra` reparte los sinónimos por la palabra escrita que los trae).
- `camposCoincidentes`: la unión de los campos de lo escrito.
- `puntajeIndice`: el puntaje de MiniSearch (BM25 con el peso de cada campo).

MiniSearch devuelve los términos DEL DOCUMENTO que coincidieron, no de qué palabra salió cada uno; se reconstruye con su misma regla (`derivaDe`, en `consultaNatural.ts`): idéntico, por prefijo (si la palabra se busca por prefijo) o con una errata dentro de la tolerancia. **Nunca** se guarda la consulta, ni las palabras, ni los términos del documento: la metadata vive lo que vive la lista, no se guarda en ninguna parte y no se mide (sección 7.6). Un resultado armado a mano sin ella (pruebas antiguas) se puntúa solo por su título.

`portadaRef` es la referencia de Storage de una miniatura: portada del procedimiento (artículo), foto principal (dispositivo) o la propia referencia si el adjunto es una imagen. Es `''` para categoría, ubicación, persona, diagnóstico, fichas del Centro de consulta, credencial y campo protegido (la credencial nunca expone la referencia de su archivo, que apunta al bucket cifrado `archivos_boveda`).

> **Estado real (2026-07-24):** `portadaRef` se calcula y viaja hasta el resultado, pero **ningún componente de la interfaz lo pinta**. La fila de resultado (`FilaResultado`, en `src/features/busqueda/ResultadosBusqueda.tsx` desde la tarea 181) usa un icono genérico por tipo, no la miniatura. La miniatura en resultados está pendiente (ver [TAREAS.md](TAREAS.md)).

## 4. Opciones de búsqueda

Todo se fija una vez al construir el índice (`crearIndiceDesdeDocumentos`), no por consulta:

- **`fuzzy: 0.2`** (`FRACCION_DIFUSA`, en `consultaNatural.ts`; tolerancia a errores de escritura). MiniSearch interpreta un `fuzzy` menor a 1 como fracción de la longitud del término: `maxDistance = round(longitud * 0.2)`. En la práctica: 1-2 letras no toleran error; 3-4 letras toleran 1; 5-9 letras toleran 1-2. Por eso `epsom` encuentra `Epson` (5 letras, distancia 1).
- **`prefix`**: coincide por prefijo además de por término completo (`impre` encuentra `impresora` e `impresión`), **salvo una letra suelta que acompaña a otras palabras** (2026-09-14). En "windows r" la "r" es la tecla del atajo, no el comienzo de "router", "red" y "respaldo": como prefijo traía media base y el atajo buscado quedaba enterrado. Una letra sola ("r") se sigue tratando como prefijo, que es lo esperable al empezar a teclear. La regla vive en `usaPrefijo` (`consultaNatural.ts`), para que la anotación de campos de la sección 3 use exactamente la misma.
- **`combineWith`**: no se fija en el código, así que rige el valor por defecto de la librería, **OR**. Los términos suman, nunca restringen. Esto es coherente con que los sinónimos solo agreguen resultados (sección 6).
- **Solo se busca lo que dice algo (desde el 2026-10-02, tarea 288).** Las palabras vacías de una frase no se buscan (`PALABRAS_VACIAS_CONSULTA` y `palabrasDeContenido`, en `consultaNatural.ts`): artículos, preposiciones, conjunciones, pronombres, verbos de relleno ("deja", "puede", "necesito"), "no", "como"... Con prefijo y OR traían medio índice: "una" encontraba cada título con "una" y "me" traía "Mercadeo" (en el ANTES del benchmark, "llegó una persona nueva" ponía primero "Conectar una impresora de red en Windows"). Se quitan solo para BUSCAR: para leer la intención cuentan ("no" y "sin" son marcas de un problema, sección 7.3). Si la consulta solo tiene palabras vacías ("no"), se buscan todas. La consulta se parte con los mismos separadores que MiniSearch, así que una palabra de la consulta es un término del índice ("10.10.6.8" son 10, 6 y 8 en los dos lados).
- **`processTerm`** = `normalizarTexto` (desde la tarea 288): minúsculas y **sin tildes**, igual al indexar y al buscar (sección 5). Hasta entonces no se sobreescribía y solo bajaba a minúsculas.
- **Boost por campo** (`PESO_EN_INDICE`, desde la tarea 288): lo que nombra o identifica pesa como el título de siempre (`titulo`, `identidad` y `formasBusqueda`, 3); lo que describe la situación, algo menos (`sintomas` y `cuandoUsar`, 2); el contexto, como el subtítulo de siempre (`subtitulo`, 1,5); y el contenido general, lo mínimo (`texto`, 1). Es el orden de `buscar` y el de cada grupo; "Mejores resultados" mide además QUÉ campos coincidieron (sección 7.1). Hasta la tarea 288: `{ titulo: 3, subtitulo: 1.5 }` y `texto` 1. A igualdad de campo, un match exacto pesa más que uno por prefijo, y este más que uno difuso (pesos por defecto de la librería `fuzzy: 0.45`, `prefix: 0.375`).

## 5. Normalización de texto

Hay tres funciones de normalización independientes y **ninguna compartida** entre sí. Es deuda de mantenibilidad conocida (ver [TAREAS.md](TAREAS.md)):

1. `incluyeTexto` / `texto` (`src/lib/texto.ts`): baja a minúsculas, **no quita acentos**. La usan los buscadores locales de Dispositivos, Red y alta de conexión.
2. `normalizar` (`src/features/busqueda/sinonimos.ts`): minúsculas + NFD + quita diacríticos. Solo para resolver claves de sinónimos.
3. `normalizarTexto` (`src/features/soluciones/iconosSoluciones.ts`): minúsculas + NFD + quita diacríticos. Duplica a la anterior con otra implementación. La usan Soluciones, Resolver y el Centro de consulta para el filtro propio y el resaltado y, desde la tarea 288, el índice global (al indexar y al buscar) y la lectura de la consulta (`consultaNatural.ts`, `mejores.ts`).

**El índice global usa la tercera desde el 2026-10-02 (tarea 288)**: su `processTerm` es `normalizarTexto`, en los dos lados, así que "que es dhcp" encuentra "qué es DHCP", "llego" encuentra "llegó" y una ñ escrita como n coincide. Hasta entonces el `processTerm` solo hacía `toLowerCase()` y la tolerancia a acentos era un **efecto secundario del `fuzzy`**: `camara` encontraba `cámara` por su distancia de edición, pero en los términos cortos, donde la tolerancia difusa cae a 0, una diferencia de acento no se encontraba.

La insensibilidad a mayúsculas sí es universal y consistente (las tres funciones y el índice bajan a minúsculas).

## 6. Sinónimos

`src/features/busqueda/sinonimos.ts`. Diccionario curado a mano, con dos clases de grupo desde el 2026-09-14.

**Grupos simétricos (18):** buscar cualquiera de sus entradas agrega las demás.

`backup/respaldo/copia de seguridad` · `internet/red/wifi/ip/conexion` · `impresora/impresion/imprimir` · `contraseña/clave/password` · `computador/computadora/pc/equipo` · `camara/cctv/video` · `pos/datafono/punto de venta` · `correo/email` · `servidor/server` · `pantalla/monitor` · `lento/lentitud/demorado` · `encender/prender` · `tightvnc/vnc` · `icg/icg manager` · `sonicwall/firewall` · `vmware/esxi/virtualización` · `issabel/pbx/telefonía` · `ssms/sql server management studio`

**Grupos de una vía (8):** las claves agregan la herramienta, pero buscar la herramienta **no** trae de vuelta la clave.

`acceso remoto`, `control remoto` → `tightvnc`, `vnc` · `acceso remoto` → `anydesk` · `monitoreo`, `monitorización` → `zabbix` · `ada`, `erp` → `sicof` · `front rest` → `frontrest` · `document`, `gestión documental` → `workflow` · `documentos` → `sharepoint` · `facturación electrónica` → `hka`

**HKA (2026-09-15)** fue un grupo simétrico `hka/factura/facturación` hasta este cambio: buscar "hka" arrastraba cualquier guía que nombrara una factura, y buscar "factura" metía a HKA por sinónimo. Ahora "hka" y "factura" no se expanden, y solo la frase "facturación electrónica" (a lo que HKA se dedica) lleva a HKA.

**Por qué existen los de una vía.** La palabra general lleva a la herramienta; la herramienta no arrastra la palabra general. Con los grupos simétricos de siempre, buscar "anydesk" habría agregado "acceso" y "remoto", que por prefijo traen "Punto de acceso" y cada ficha que diga "remotamente"; "zabbix" habría agregado "monitoreo", que por la tolerancia a erratas encuentra cada "monitor" del inventario; "sicof" habría agregado "ada", que encuentra "cada" y "adaptadores"; y "workflow", "document", que por prefijo encuentra cada "documentado". **Nada se agregó al grupo de "red"**: buscar "red" sigue sin arrastrar Zabbix, SonicWall, servidores ni switches.

Mecánica (`expandirConsulta`):

- Cada entrada, de una palabra o de varias, funciona como clave. **Una clave de varias palabras se detecta escrita entera y seguida** ("acceso remoto", "copia de seguridad"; desde el 2026-09-14): "acceso al servidor remoto" no es la frase.
- Lo que se agrega va en palabras sueltas: una entrada de varias palabras aporta sus palabras, sin las vacías (`de, la, el, a, y, en`); `pos` expande a `datafono, punto, venta`.
- Lo que se agrega nunca repite lo ya escrito (`sinonimosDe`). `expandirConsulta` devuelve la consulta con los sinónimos al final, para quien necesite el texto entero.
- **Los sinónimos se buscan aparte y van detrás** (`buscarConSinonimos`, 2026-09-15; ver la sección 7). Nunca restan resultados y ya no pueden adelantarse a lo escrito.
- Se aplica en toda consulta al índice: la búsqueda de Inicio, la capa global y las sugerencias anti duplicados de artículos y diagnósticos.

El mismo diccionario **no** alimenta el selector de "vincular procedimiento" de un paso (sección 8) ni el buscador local del Centro de consulta.

## 7. Ranking y agrupación

- **Lo escrito manda sobre el sinónimo** (`buscarConSinonimos` en `useIndiceBusqueda.ts`, 2026-09-15). Se hacen dos búsquedas: la de lo que el técnico tecleó (desde la tarea 288, solo sus palabras que dicen algo, sección 4) y la de los sinónimos que eso agrega. **Primero** van todos los documentos que coinciden con lo escrito (exacto, por prefijo o con errata), ordenados por su score más la mitad del score que les dé el sinónimo (`PESO_SINONIMO = 0.5`); **detrás**, los que solo trae un sinónimo, en su propio orden. Antes la expansión viajaba en la misma consulta con el mismo peso, y "Crear copia de seguridad" (dos palabras del sinónimo en el título) adelantaba a "Backup del servidor" al buscar "backup". Lo usan `buscar` y `buscarSimilares`. Desde la tarea 288 cada resultado sale de aquí con su metadata de coincidencia (sección 3).
- **Orden interno**: dentro de cada tramo, score descendente de MiniSearch (BM25 + boost por campo + pesos difuso/prefijo). No hay otro desempate configurado por la app; a score idéntico el orden no está garantizado.
- **Agrupación**: los resultados no se muestran como lista plana. `GRUPOS_BUSQUEDA` (en `src/features/busqueda/resultados.ts` desde la tarea 181; antes vivía dentro de `InicioPage.tsx`) define seis grupos por fuente, en orden fijo: **Guías** (incluye diagnóstico, categoría, artículo y adjunto), **Equipos**, **Bóveda**, **Ubicaciones**, **Personas** y **Centro de consulta** (herramienta, término, atajo y comando). Lo aplican por igual Inicio y la capa global. Dentro de cada grupo se respeta el score; entre grupos el orden es siempre el mismo (Soluciones primero), aunque un resultado de otro grupo tenga mayor score.
- **Sin tope ni paginación**: se pintan todos los resultados de cada grupo. Con el volumen del equipo no es un problema; queda anotado como ausencia de límite si el contenido crece (ver [TAREAS.md](TAREAS.md)).

### 7.1 Mejores resultados: la respuesta antes que el módulo (2026-09-15, tarea 241)

`src/features/busqueda/mejores.ts`. Sobre la lista que devuelve `buscar` (en su orden), se eligen **de 3 a 5 resultados con la mayor relevancia global, sin importar el módulo**, y se pintan arriba, bajo el rótulo **"Mejores resultados"**.

**El problema que cierra.** El agrupado por fuente (sección 7) decidía el orden principal, y el grupo mandaba sobre la relevancia: buscando "impresora caja 4", el equipo exacto aparecía **después de todas las guías**, porque Guías va primero en `GRUPOS_BUSQUEDA`. Eso obliga a preguntarse "¿en qué módulo está lo que necesito?" antes de poder resolver nada.

**Cómo se puntúa cada candidato (desde el 2026-10-02, tarea 288, fases 6 y 7).** `leerResultados` (puro, probado en `mejores.test.ts`, donde cada peso tiene la prueba que lo exige) lee la consulta una vez y devuelve las intenciones, los mejores y la confianza (sección 7.9).

1. **Dos tramos, no uno** (sin cambios). Primero TODOS los que coinciden con lo escrito; detrás, los que solo trae un sinónimo (`soloSinonimo`). **Ningún bono cruza de tramo**: un sinónimo no puede adelantar a una coincidencia directa por mucho que puntúe.
2. **Evidencia** (0 a 100, `PUNTOS_EVIDENCIA`): cuánto de la consulta explica el resultado y con qué autoridad. Cada palabra que dice algo vale lo que vale el campo más fuerte donde coincidió (`PESO_CAMPO`: título, identidad y formas de búsqueda 1; síntomas y cuándo usar 0,75; subtítulo 0,5; texto 0,25); por un sinónimo suyo, la mitad (`PESO_SINONIMO_EVIDENCIA`); y la evidencia es el promedio de las palabras.
3. **Nombre**: el título ES lo buscado, comparado palabra a palabra sin las vacías (+30, `BONO_NOMBRE_EXACTO`: "La impresora no imprime" ES "la impresora no imprime", y "DHCP" ES "qué es DHCP"), o empieza por lo buscado, con la última palabra a medio escribir (+15, `BONO_NOMBRE_PREFIJO`).
4. **Intención** (sección 7.3): el tipo que resuelve la intención que manda (+25) o una de las otras (+10).
5. **Relevancia operacional** (`PESO_OPERATIVO`, sin cambios): guía, diagnóstico, equipo y credencial 6; comando, herramienta y atajo 5; término 4; categoría, ubicación y persona 2; adjunto 1. A igualdad, gana **lo que se resuelve**, no el escalón que lleva a otra cosa.
6. **Puntaje del índice** (0 a 10, `PUNTOS_INDICE`): el BM25 de MiniSearch relativo al mejor de la lista, para desempatar con la rareza de las palabras y el largo de los campos.
7. **Desempate final**: el orden que ya traía el buscador, para que la lista no baile entre pulsaciones.

- **Consulta mixta (fase 7).** Si lo que manda es otra cosa que el equipo, las palabras que nombran ESE equipo dicen dónde pasa, no qué hacer: la solución de "la impresora de mercadeo no imprime" no tiene por qué decir "mercadeo". A lo que no es un equipo se le mide además la evidencia sin esas palabras, y vale la mejor de las dos medidas; el equipo se mide con todo. Así la guía del problema queda primera y el equipo de Mercadeo sigue entre los mejores.
- **Sin ninguna intención, ninguna clase se lleva los cinco puestos** (`MAXIMO_POR_CLASE_SIN_INTENCION` = 3): "impresora" no puede responderse solo con equipos ni solo con guías. La mejor clase se queda con tres y la otra lectura con dos; si no hay otra clase, se completa con la misma. Se presentan en el orden del ranking.
- **Cómo puntuaba hasta la tarea 288** (función `puntuacion`): la coincidencia del título, exacta (+100), por prefijo (+60), contenida (+40), con todas las palabras (+25) o con alguna (+10); la relevancia operacional; y la intención (+18). Solo miraba el título: una guía que respondía la pregunta por sus síntomas o por su "cuándo usar" no tenía cómo subir.

**No se pinta nada dos veces.** Lo que sube arriba se **descuenta de su grupo** (`sinLosMejores`); un grupo que se queda sin filas desaparece. Con **un solo resultado** la sección no se dibuja (`hayQueSepararMejores`): una cabecera "Mejores resultados · 1" sobre una fila única es ruido, y ahí la acción la lleva la propia fila del grupo.

**El tipo se escribe en la fila.** Fuera de los grupos no hay cabecera que lo diga, así que el subtítulo se antepone con el tipo: "Guía · ICG Manager", "Guía con preguntas · Impresoras", "Equipo · Epson · Caja 4", "Bóveda · Acceso" (`subtituloConTipo`, que no repite el tipo si el subtítulo ya empieza por él ni cuando ya es uno de sus tramos: "Impresoras · Guía con preguntas" pasa a "Guía con preguntas · Impresoras"; antes salía "Diagnóstico · Impresoras · Diagnóstico").

**Cómo se pinta la lista (2026-10-01, tarea 287, propuesta final de Claude Design).** Solo presentación, en `src/features/busqueda/presentacionResultados.ts` (lógica pura, con pruebas): ni el motor, ni el ranking, ni los sinónimos, ni el difuso, ni el modo consulta, ni las reglas de la Bóveda cambian, y ningún título se reescribe.

- **Lista homogénea** (`filasConPrefijoComun`, `partirPorPrefijo`): si 3 o más filas de una MISMA sección empiezan por lo buscado como palabra entera, ese comienzo se pinta en gris con subrayado punteado (sigue siendo la coincidencia) y el resto del título en claro. No se aplica a una fila cuyo título es justo lo buscado, ni a medias de palabra ("Impresoras" buscando "impresora"), ni con menos de 3 filas.
- **El tipo sube al encabezado** (`tipoComun`, `cuentaDeTipo`): si TODOS los mejores resultados son del mismo tipo, el rótulo dice "Mejores resultados · 5 equipos" y las filas llevan su subtítulo sin el tipo. Si no, la regla de arriba (el tipo en la fila) sigue, con el tipo más claro que el resto (`partesSubtituloConTipo`).
- **Tinte por tipo** (`VISUAL_POR_TIPO`): guía en acento, guía con preguntas en el azul de la acción, equipo en verde, persona en violeta y ubicación en ámbar; Bóveda y adjuntos, neutros.
- **El título entero** (regla 23 de [REGLAS.md](REGLAS.md), desde el 2026-10-02, tarea 288): a 15 px, en las líneas que necesite, con `min-w-0`, `overflow-wrap:anywhere` y `text-wrap:pretty` (la estrategia de `FilaArticulo`); la fila crece desde un mínimo de 56 px. El tipo y el subtítulo sí se recortan a una línea. Hasta entonces el título iba "hasta en dos líneas" (`line-clamp-2`) y a 390 px "Agregar una impresora al computador mediante su dirección IP" se leía "…mediante su…", justo sin la parte que dice de qué guía se trata. Lo vigila `nombresSinRecorte.test.tsx`.

**Un diagnóstico se llama "Guía con preguntas" (2026-09-22, tarea 263, AD-045).** Para quien resuelve no es otra herramienta: `ETIQUETA_TIPO.diagnostico` y el subtítulo del índice usan `ROTULO_RECORRIDO` (`src/lib/diagnostico.ts`), igual que los recientes y los favoritos. "Diagnóstico" queda para su administración (Más).

### 7.2 Acciones directas en el resultado (2026-09-15, tarea 241)

`src/features/busqueda/AccionesResultado.tsx`. Hasta esta tarea un resultado solo sabía **abrir su ficha**, así que el recorrido real era siempre buscar, abrir, buscar la acción dentro y ejecutarla.

| Tipo | Acción | De dónde sale la regla |
|---|---|---|
| **articulo** (guía) | **ninguna desde el 2026-09-17** (tarea 244) | Tocar la fila abre la guía **en su paso pendiente** (`GuiaPage`): una guía terminada empieza un caso nuevo y una a medias se retoma. El botón `Empezar` / `Continuar · paso N de M` / `Repetir guía` repetía ese enlace y se retiró. `accionDeGuia` (vía `useAccionesDeGuia`) solo decide con qué verbo se mide el recorrido (`empezar_guia` o `continuar_guia`) |
| **diagnostico** (guía con preguntas) | **ninguna desde el 2026-09-22** (tarea 263) | Tocar la fila la arranca en su primera pregunta o la retoma donde iba, igual que una guía. El `Iniciar` repetía ese enlace y navegaba sin el origen, así que salir del recorrido no devolvía a la búsqueda. La fila mide el recorrido con el verbo de siempre, `iniciar_diagnostico` |
| **credencial** | `Ver` (vista rápida, sección 7.7) + `Copiar usuario` + `Copiar contraseña` (acceso) · `Ver` + `Copiar clave` (clave o PIN) · `Ver` + `Copiar` (token o licencia) · `Ver` (nota segura) · `Abrir ficha` (archivo seguro, que no se abre en el buscador; en modo consulta, nada) | `accionesRapidasDeCredencial` y `copiarCampoCredencial` (`src/features/boveda/accionesCredencial.ts`), extraídos de `BovedaPage`: descifrado, permisos y **auditoría** son los de siempre |
| **comando** y **atajo** | `Copiar comando` / `Copiar atajo` | El campo `valor` de la ficha. Esa tabla **nunca guarda secretos**, así que aquí no hay descifrado ni auditoría que hacer |
| todo lo demás | ninguna | Abrir la ficha ES la acción, y la fila entera ya la abre |

**Las acciones viven solo en "Mejores resultados"** (o en la fila única cuando no hay sección). Con la acción en todas las filas, una búsqueda de ocho guías dejaba ocho botones "Empezar" apilados y la pantalla se leía como una botonera: arriba son **cinco como mucho**, que es justo lo que se va a tocar. Cada fila tiene una acción primaria y, como mucho, dos. Desde el 2026-09-17 una guía no lleva ninguna: la fila ya lleva a su paso pendiente.

**Volver al sitio.** Cada fila viaja con `conOrigen(pathname, 'la búsqueda', { consulta, capa })`, así que abrir una ficha desde aquí y volver devuelve **a la búsqueda**, no a la lista raíz de su sección, y **con lo que estaba escrito** (sección 7.8, desde el 2026-09-16). Es el sistema de origen que ya existía (AD-030), no un segundo mecanismo.

**En modo consulta** (encima de una guía en ejecución, sección 7.5) no se ofrece nada que abra otra ejecución: la fila de una guía o de una guía con preguntas no navega (abrirla sería ejecutarla). La guía o el diagnóstico encontrados quedan como referencia. Copiar sí sigue. Lo decide `ofreceAccionDirecta` (`src/features/busqueda/modoConsulta.ts`).

### 7.3 Intención de la consulta, con los datos que ya hay (2026-09-15, tarea 241)

`intencionesDeConsulta(consulta, resultados)`. Sin IA generativa y sin servicios externos: se leen las palabras que el equipo ya usa y, desde la tarea 288, también lo que el índice encontró. Pueden aplicar varias a la vez ("no imprime la caja 4" es problema y equipo).

**Desde el 2026-10-02 (tarea 288, fase 4):**

- **Las marcas se leen como PALABRAS, no como subcadenas.** Antes "no " exigía un espacio detrás, así que "word imprime pero pdf no" (el "no" al final) no era un problema; y una raíz suelta como "roto" se disparaba dentro de "protocolo".
- **Hay una que manda** (`PRIORIDAD_INTENCIONES`: problema, procedimiento, acceso, consola, glosario y equipo; `intencionesDeConsulta` las devuelve en ese orden). Lo que se PIDE va antes que el equipo sobre el que se pide: en "la impresora de mercadeo no imprime" el equipo dice dónde pasa y la solución es lo que hay que hacer; en "clave impresora mercadeo", la clave. El equipo manda solo cuando es lo único que se pide.
- **"Equipo" con evidencia.** Por la forma de lo escrito (una IP, un rótulo con su valor como "serial ABC123" o "placa 456", "ip" sobre algo, o un número suelto entre varias palabras) o porque una palabra coincidió de verdad con un equipo: con su **identidad** (lugar, responsable, marca, modelo, serial, placa o IP: "pc contabilidad", "ricoh mp 501") o con su **nombre**, cuando la consulta nombra además su clase y esa clase coincide con el mismo equipo ("servidor facturación", "impresora caja 2"). Una clase sola ("impresora") nunca basta: es ambigua (un equipo, una guía, una categoría), y sin su clase una palabra corriente que esté en un nombre ("archivo" en "Servidor de archivos") tampoco.
- **El equipo pedido, no cualquier equipo.** Cuando la consulta identifica uno ("impresora mercadeo"), la intención favorece a los equipos que coinciden con eso que lo identifica; las demás impresoras solo comparten la clase, y empujarlas arriba sacaría de los mejores la guía del tóner de ESA impresora.

| Intención | Se detecta por | Favorece |
|---|---|---|
| `problema` | "no", "sin", "bloqueo", "roto", "caído"...; comienzos como "falla", "error", "lento", "bloquead", "congel", "atasc", "intermitente"; frases como "se cae", "se apaga", "se cuelga" o "da error" | guía, guía con preguntas |
| `procedimiento` | un verbo de procedimiento (crear, configurar, instalar, reiniciar, restablecer, conectar, desbloquear, agregar y, desde la tarea 288, poner, asignar, programar, reemplazar, renovar, exportar, importar, respaldar, migrar, mapear, compartir, formatear, vincular, sincronizar) o "dar de alta" / "dar de baja" | guía, guía con preguntas |
| `acceso` | una palabra FUERTE (clave, contraseña, password, PIN, credencial, token, licencia) sin verbo de procedimiento ("cambiar la contraseña" es un procedimiento sobre ella); o una DÉBIL (usuario, cuenta, acceso, administrador) cuando la consulta no pide otra cosa: "usuario" en "crear usuario nuevo" es lo que se crea y en "usuario bloqueado" quien tiene el problema | credencial, dato protegido de un equipo |
| `consola` | comando, consola, terminal, cmd, powershell, atajo, tecla; un comando conocido por su nombre ("ping", "ipconfig", "tracert", "nslookup"...); o una tecla modificadora con otra tecla ("windows r", "ctrl alt supr", "alt tab"; "windows 10" no lo es) | comando, atajo |
| `glosario` | empieza por "qué es", "qué significa", "para qué sirve", "definición"... | término, herramienta |
| `equipo` | la forma de lo escrito o la evidencia de los datos (arriba) | equipo |

**"desbloquear" y "bloqueado" (2026-09-22, tarea 263, ejemplos B y D del encargo).** Sin el verbo, "desbloquear usuario" solo pedía un acceso (por "usuario") y una credencial que se llamara parecido podía ganarle a la guía; ahora es un procedimiento. "usuario bloqueado" o "cuenta bloqueada" es un síntoma: problema.

El bono de intención es **+25** para la que manda y **+10** para las demás (hasta la tarea 288, **+18** para cualquiera). Menos que explicar una palabra de la consulta: **ordena cosas que ya coinciden con lo escrito y nunca inventa un resultado que no se buscó**.

### 7.4 El puente a la Bóveda bloqueada (2026-09-15, tarea 241)

`src/features/busqueda/reglasPuenteBoveda.ts` (la regla) y `PuenteBoveda.tsx` (la pantalla).

Con la bóveda bloqueada sus credenciales **no entran al índice**, y eso no cambia (sección 9). El efecto secundario era que buscar el nombre de un acceso devolvía "sin coincidencias" y había que acordarse solo de que eso vive en la Bóveda, entrar, escribir la contraseña maestra y **volver a escribir lo mismo**.

Ahora, con permiso de bóveda y la bóveda cerrada, los resultados incluyen una fila genérica: **Buscar "{consulta}" en Bóveda**, con su candado y la acción **"Desbloquear y buscar"**.

- **Es genérica y no delata nada.** Aparece igual escribiendo "administrador POS" que escribiendo "xyz": el rótulo es la misma frase para una consulta que existe y para una que no. **Sin permiso de bóveda no se dibuja**: quien no está autorizado no llega a saber que existe una sección protegida con contenido buscable.
- **El desbloqueo es EN LÍNEA**, sobre el propio buscador, y delega entero en `desbloquear()`, la única fuente de verdad de la sesión (la misma de `BovedaGuard` y del bloque protegido de un paso). No se copia ni se recrea criptografía.
- **La consulta no viaja a ninguna parte**: sigue escrita en el campo, así que "conservarla" no necesita estado de navegación, parámetro de URL ni sesión. Al desbloquear, el índice se reconstruye solo (depende de `useBovedaDesbloqueada`) y los accesos aparecen en **la misma búsqueda**, con sus acciones rápidas. Ver [DECISIONES.md](DECISIONES.md), AD-038.
- **Desbloquear aquí NO navega (2026-09-16).** Ni a `/boveda` ni a ninguna otra parte: el técnico sigue en Inicio, en la sección o en la guía desde la que buscaba, con la consulta escrita y las credenciales que coinciden ya en la lista, cada una con `Ver` y sus copias. Las pruebas de flujo lo fijan (`flujoBovedaBuscador.test.tsx`, casos A y B; `modoConsultaGuia.test.tsx`, caso E).
- **Definir la contraseña maestra por primera vez NO se puede hacer desde aquí**: si `estadoInicialBoveda()` no dice `verificar`, el puente enlaza a la sección Bóveda, que es donde esa decisión tiene su confirmación y su aviso. En modo consulta no hay enlace (sacaría al técnico de la guía): se explica y se ofrece "Entendido".
- **Dónde se coloca:** detrás de la **primera** sección de resultados. Lo que ya se encontró resuelve la mayoría de las búsquedas y no puede quedar por debajo de una puerta cerrada; pero tampoco puede enterrarse al final, porque cuando lo que se busca es un acceso ESTE es el resultado. En el estado vacío (sin resultados públicos) es lo único que se ofrece.
- **Cuánto pesa (2026-09-16, `prominenciaPuenteBoveda`).** Si un resultado público coincide con fuerza (título exacto, o que empieza por la consulta entera como palabra, nunca un sinónimo), el puente pasa a una **línea compacta** con un botón pequeño ("Desbloquear"), para no competir con la respuesta: buscar "Zabbix" y tener la herramienta Zabbix arriba no pide una puerta cerrada del mismo tamaño. Sin resultados públicos, o sin ninguno que coincida de verdad, conserva su forma destacada. La regla mira solo lo que ya está en pantalla y **nunca** intenta adivinar si existe una credencial.

### 7.5 Buscar durante la ejecución de una guía (2026-09-15, tarea 241)

La cabecera compacta del modo ejecución (`BarraTarea compacta`) gana una **lupa** cuando el chasis recibe `conBusqueda` (hoy, solo `AsistentePage`). Abre `BuscadorGlobal` **como capa** sobre la ejecución.

La navegación principal sigue fuera: lo que se añade no es navegación, es una consulta. Como la capa es un portal a `<body>`, la ejecución que hay debajo **no se vuelve a montar**: mismo paso activo, mismo progreso y mismo cronómetro al cerrar. Copiar un comando, un atajo o una credencial no navega, así que el recorrido entero (buscar, copiar, cerrar, seguir) ocurre sin salir del procedimiento; y si la bóveda está bloqueada, el puente la abre ahí mismo.

**Modo consulta (2026-09-16).** La primera versión abría el buscador **normal**, y tocar cualquier resultado (o "Empezar" otra guía) sacaba al técnico de la ejecución. Ahora, sobre cualquier pantalla de nivel tarea (la lupa de la ejecución y el atajo "/" de un editor o de la ejecución), `BuscadorGlobal` se abre con `modo="consulta"`, que lo dice en una línea bajo el campo ("Modo consulta: lo que abras aquí no te saca de lo que estás haciendo") y aplica las reglas puras de `src/features/busqueda/modoConsulta.ts`:

| Tipo | En modo consulta |
|---|---|
| credencial | desbloquear en línea, `Ver`, mostrar u ocultar, copiar usuario y clave; un archivo seguro explica que se abre desde su ficha al terminar |
| comando y atajo | la fila despliega la misma tarjeta que dentro de una tarea (`TarjetaComando`): se ve y se copia |
| término y herramienta | la fila despliega la definición; en una herramienta, además, para qué sirve, su uso en Metroparques y su estado de uso (`ContenidoReferencia`, el mismo cuerpo que la hoja de un término en una guía) |
| equipo | la fila despliega nombre, ubicación, marca y modelo, estado e IP, con los datos del teléfono; sus datos protegidos NO |
| guía, diagnóstico, categoría, adjunto, ubicación, persona, dato protegido de un equipo | referencia: se ve la fila, no se puede abrir ni iniciar |

**Ninguna fila navega** (`filaNavega`) y el estado vacío no ofrece "Crear equipo". No existe hoy un mecanismo seguro para "abrir al terminar", así que no se inventó uno: la guía encontrada es solo referencia.

### 7.6 Medición del recorrido (preparada, sin sistema nuevo)

`src/features/busqueda/medicion.ts`. `registrarResolucion` es un punto de enganche único que recibe `{ accion, tipo, desdeMejores, interacciones, longitudConsulta }` cuando el técnico resuelve algo (empezar o continuar una guía, iniciar un diagnóstico, abrir un equipo, copiar una credencial).

**Hoy no guarda nada a propósito.** La app no tiene un canal de analítica y `accesos_boveda` es una auditoría de seguridad, no una métrica de uso: meter ahí eventos de navegación ensuciaría el registro que el equipo revisa. Lo que sí queda fijado (y probado) es la **forma** del evento: **nunca** lleva la consulta, ni el título, ni el id, ni ningún texto libre. De la consulta solo viaja su **longitud**, que es un número. Copiar desde la vista rápida (sección 7.7) cuenta igual que copiar desde la fila.

### 7.7 Vista rápida dentro del buscador (2026-09-16)

`src/features/busqueda/{PanelVistaRapida,VistaRapida,VistaRapidaCredencial}.tsx`. Buscar un acceso, desbloquear y tener que abrir la ficha completa de la Bóveda para leer un usuario era justo el viaje que el buscador venía a ahorrar. La vista rápida se **despliega debajo del resultado**, dentro de la misma lista: no es otra capa, así que cerrarla (`Cerrar`, o Esc, que recoge la vista y nada más) devuelve a los mismos resultados con la consulta escrita y el buscador abierto. Hay una sola abierta a la vez, y se recoge sola si cambia la consulta.

Qué tipo la tiene lo decide `vistaRapidaDe`: la credencial en los dos modos (con su botón `Ver`); el resto solo en modo consulta (sección 7.5), donde la fila entera la despliega.

**La vista de una credencial no implementa nada de seguridad propio.** Descifra con `descifrarCredencial` (la sesión de siempre), enseña exactamente los datos que se pueden copiar desde la fila (`camposVistaRapida`, construida sobre `accionesRapidasDeCredencial`), copia con `copiarCampoCredencial` y audita con `registrarAccesoBoveda` usando **las mismas acciones que la ficha**: desplegar la vista es `consulto` (como abrir la ficha), destapar la clave es `mostro` (como su ojo) y copiar es `copio_usuario` o `copio_contrasena`. Ocultar no registra nada, igual que en la ficha.

| Tipo de acceso | Qué muestra |
|---|---|
| Acceso | Usuario (a la vista) y Contraseña (tapada), con `Mostrar`/`Ocultar`, `Copiar usuario` y `Copiar contraseña` |
| Clave o PIN | Clave o PIN (tapada), con `Mostrar`/`Ocultar` y `Copiar clave` |
| Token, licencia o clave | Valor (tapado), con `Mostrar`/`Ocultar` y `Copiar` |
| Nota segura | el texto, como lo muestra la ficha al abrirla |
| Archivo seguro | no se abre ni se descifra: se dice que se descarga desde su ficha (con `Abrir ficha` fuera de una tarea) |

- **Todo lo secreto arranca tapado**, aunque la bóveda esté abierta. Destapado, el valor sale **entero**: varias líneas, `break-all`, monoespaciado, sin `truncate` ni "..." (la corrección de la tarea 240), con los botones debajo del valor para que a 360 px no lo estrechen.
- **El secreto no sale del componente.** No va a la URL, ni a localStorage, ni al índice, ni a un atributo, ni a la medición. Se borra del estado al cerrar la vista y también si la bóveda se bloquea con la vista abierta; con la bóveda cerrada o sin permiso la vista no existe.

### 7.8 Volver de una ficha con la búsqueda escrita (2026-09-16)

`src/lib/origenNavegacion.ts` (la forma) y `src/features/busqueda/busquedaEnHistorial.ts` (los dos hooks). Abrir una ficha desde un resultado ya devolvía a la pantalla correcta (sección 7.2), pero con el buscador **vacío**.

- **Qué se guarda:** la consulta y si estaba en la capa global o en el buscador de Inicio (`BusquedaEnCurso`). Nada más: ni resultados, ni secretos, ni el scroll exacto (la memoria de scroll por ruta ya repone lo que puede).
- **Dónde:** solo en `location.state`. Viaja en el origen del salto (`conOrigen(..., busqueda)`) y el regreso de la app la entrega a la pantalla de destino (`estadoDeRegreso`, que usan `BotonVolver` y la X de `BarraTarea` en el chasis). Además, en el mismo toque que salta, se anota en la entrada actual del historial (`useAnotarBusqueda`), así que **el botón atrás del teléfono** también la encuentra. Nunca en la URL ni en localStorage, y se pierde con la pestaña.
- **Quién la repone:** Inicio (hoy Resolver), en su campo en línea; Equipos, en el suyo (desde el 2026-09-22, tarea 256); y la capa global, desde `CapaAtajos`, que vive en el chasis de todas las pantallas y por eso sirve venga de la lupa de la barra o de "/". Se relee en cada **llegada** a la entrada (ir o volver), no solo al montar: de un equipo a otro equipo React reutiliza la pantalla y volver al primero tiene que reponer igual.
- **Cuándo se olvida:** al cerrar la capa repuesta o al vaciar el campo de Inicio, que es dar la búsqueda por terminada (`descartar`). Abrir la capa con la lupa sigue empezando limpio, como siempre.

### 7.9 Confianza: "Mejor coincidencia" solo cuando lo es (2026-10-02, tarea 288)

`confianzaDe` en `src/features/busqueda/mejores.ts` (la regla) y `ResultadosBusqueda.tsx` (cómo se dice). Hasta esta tarea la sección de arriba se llamaba siempre "Mejores resultados", también cuando la consulta identificaba una sola cosa ("impresora mercadeo", "10.10.6.8", "qué es DHCP"), así que el técnico no sabía si había una respuesta o varias candidatas.

**La regla.** Hay UNA opción claramente superior cuando:

1. coincide con lo escrito (no solo por un sinónimo) y **explica todas las palabras** de la consulta, cada una en algún campo; y
2. su ventaja sobre la segunda de lo escrito es, como mínimo, **`100 / palabras`**: lo que vale explicar una palabra más de la consulta en un campo muy fuerte.

No es un umbral mágico: es la unidad de la propia escala del ranking (sección 7.1). Una ventaja menor no sale de explicar más la consulta, sale de los desempates (tipo, intención, puntaje del índice), y con eso no se finge certeza. Con una sola palabra hace falta toda una palabra de ventaja: "impresora" o "correo" no tienen un ganador claro aunque uno empiece igual. Si no hay otra de lo escrito (las demás solo las trajo un sinónimo), la primera que lo explica todo es la respuesta.

**Cómo se dice.** Con confianza alta, la sección de arriba se parte en dos:

- **"Mejor coincidencia"**: esa sola fila, con su tipo escrito y sin cuenta ("· 1" sería ruido), con su acción directa si la tiene.
- **"Otras coincidencias"**: el resto de los mejores, con la cuenta por tipo si todos son del mismo ("· 4 guías") o el tipo en cada fila si no.

Si las primeras están cerca, sigue siendo **"Mejores resultados"**, como siempre. Son los mismos resultados, en el mismo orden y con las mismas acciones: **solo cambia lo que se afirma**. Con un solo resultado no hay sección (sección 7.1). El puente a la Bóveda va detrás del bloque ENTERO, nunca entre "Mejor" y "Otras", y en modo consulta rige igual: la mejor coincidencia tampoco navega. El título de cada fila se lee entero (regla 23). Pruebas: `mejores.test.ts` (la regla y su frontera), `resultadosIntencion.test.tsx` (la pantalla) y el benchmark (sección 14), que fija la certeza esperada de cada caso.

### 7.10 El equipo de la consulta llega a la guía (2026-10-03, tarea 290)

"La impresora de mercadeo no imprime" pide una solución sobre UN equipo. Si el técnico abre una guía desde esos resultados, la guía se abre con ese equipo (`?equipo=<id>`), para que una acción que pide "la credencial del equipo actual" sepa de cuál se trata (AD-064).

- **Qué se lee:** `equipoDeLaConsulta` (`mejores.ts`) usa lo mismo que ya usa el ranking: las palabras que identifican un equipo concreto (`objetoDeLaConsulta`) y la clase que nombra la consulta. Devuelve un equipo solo si es **el único** resultado de equipo que coincide, en su nombre o su identidad, con todo lo que lo identifica y con su clase. Dos equipos posibles ("mercadeo" a secas: la impresora y el switch), o nada que identifique uno ("impresora"), devuelven null y la guía se abre sin equipo.
- **Qué NO cambia:** el orden, las intenciones, los pesos, los sinónimos, el índice, `formasBusqueda` y la confianza. Solo cambia a dónde lleva el enlace de una guía (`ResultadosBusqueda`, `rutaGuiaConEquipo`).
- **Pruebas:** `equipoDeLaConsulta.test.ts` (con el índice de verdad y los datos sintéticos del benchmark) y `credencialDelEquipoFlujo.test.tsx` (de Resolver a la guía).

## 8. Sugerencias anti duplicados

`buscarSimilares` / `buscarArticulosSimilares` (`useIndiceBusqueda.ts`) reutilizan el mismo índice y la misma expansión de sinónimos, pero además:

- Exigen que el término haya coincidido en el campo `titulo` (una coincidencia solo en `texto` o `subtitulo` no cuenta como "similar").
- Excluyen el propio id y truncan a un límite (3 por defecto).

Consumidores: el aviso de título parecido al crear un artículo (`ArticuloForm.tsx`) y el equivalente al crear un diagnóstico (`DiagnosticoForm.tsx`), con un debounce manual de 300 ms sobre el título.

Como reutilizan el índice global, estas sugerencias también excluyen borradores y obsoletos: dos borradores parecidos escritos en paralelo no se detectarían entre sí hasta que uno se publique.

El **selector de "vincular procedimiento existente"** de un paso (`VinculoDelPaso` en `PasosEditor.tsx`) es un `<select>` nativo que lista todos los artículos vinculables ordenados alfabéticamente. No usa MiniSearch, ni fuzzy, ni sinónimos.

## 9. Qué queda fuera del índice, y por qué

- **Artículos en `borrador` u `obsoleto`**: no son contenido oficial para sugerir al equipo. (Los borradores propios sí se ven en la pantalla de Soluciones, que tiene su propio filtro, ver sección 10; y una herramienta del Centro de consulta puede enlazar un borrador como guía relacionada, con su pastilla, sin que eso lo haga aparecer en el buscador.)
  - **La coincidencia FUERTE se promueve** (2026-09-20, tarea 249, RN-042): si el borrador coincide **en el título**, sube con los resultados, por delante de referencias como HKA Factura, con "Borrador · contenido por confirmar" bajo el título. Si ya hay una **guía publicada** que también coincide en el título, esa conserva la prioridad y el borrador va detrás. `repartirBorradores` separa fuertes y débiles; `hayGuiaPublicadaEnTitulo` decide el sitio. Promover es un cambio de PRESENTACIÓN: el índice, el estado del artículo y la sincronización no se tocan.
  - **Desde el 2026-09-20 eso NO significa que no se puedan encontrar** (tarea 248). Inicio los muestra **fuera del índice**, en el bloque **"Borradores coincidentes"**: se calculan aparte, sobre la base local, con `borradoresCoincidentes` (`src/features/busqueda/borradoresEnBusqueda.ts`), que filtra `estado === 'borrador'` sin eliminar y los cruza con la MISMA `coincidenciaArticulo` que usa la lista de Guías (título, etiquetas, categoría y tipo). `documentosDeBusqueda` no cambió: un borrador nunca es un resultado oficial.
  - El defecto que lo motivó: ese aviso solo salía en "Sin coincidencias", así que bastaba con que coincidiera **otra clase** de resultado (buscando "DIAN", la ficha de HKA Factura) para que un borrador real pareciera no existir.
- **Cualquier fila con `eliminadoEn`** (borrado suave): excluida en todas las entidades.
- **Credenciales y campos protegidos sin la bóveda desbloqueada**: hay dos barreras distintas. La RLS del servidor decide si esas filas siquiera se sincronizan al dispositivo (sin permiso de bóveda, la tabla local ni las tiene); y `bovedaDesbloqueada` es un flag en memoria de la sesión que exige haber tecleado la contraseña maestra y se resetea por inactividad. Un técnico con permiso pero sin desbloquear no ve ningún resultado de bóveda. Desde el 2026-09-16 el índice exige además el **permiso del perfil** (`puedeVerBoveda`) para contar la bóveda como abierta: la interfaz ya no dejaba desbloquear sin él, y esto cubre las filas que pudieran quedar en el teléfono de antes de retirar el permiso (caso J de `flujoBovedaBuscador.test.tsx`).
- **Adjuntos huérfanos**: un adjunto cuyo dueño ya no resuelve localmente (o es un borrador) se descarta.
- **Fichas del Centro de consulta de un tipo desconocido**: las escribió una versión más nueva de la app.
- **Tablas no listadas** (historial, ejecuciones de diagnóstico, progreso, favoritos, recientes, conexiones, syncMeta): no alimentan el índice.

## 10. Buscadores locales (contraste)

Filtran en el sitio la lista que la pantalla ya cargó. No usan MiniSearch.

**Usan `incluyeTexto`** (subcadena, sensible a acentos, sin resaltado):

- **Alta de conexión** (`candidatosConexion` en `src/lib/conexiones.ts`): filtra por subcadena en `[nombre, ubicacion, ip]`. Sin texto, en vez de mostrar todo, pre-sugiere candidatos por puntaje (+2 si comparte ubicación con el equipo actual, +1 si su categoría es de red) y ordena por ese puntaje.
- **Equipos** (`DispositivosPage.tsx`, reglas en `busquedaEquipos.ts` desde el 2026-09-22, tarea 256): `[nombre, ip, ubicacion, serial, placaInventario, marca, modelo]`. Sin texto, solo el inventario general; **al escribir y sin chip de categoría, también los equipos de red**, aparte en "Equipos de red". Orden natural por nombre. La consulta vuelve al regresar de una ficha, con el mismo mecanismo de la sección 7.8 (`capa: false`), y el chip va en la URL (`?categoria=`).
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
- Medicion del recorrido: `registrarResolucion` esta preparada y probada, pero todavia no guarda en ningun sitio (seccion 7.6).
- Vista rápida de un **dato protegido de un equipo** en modo consulta: hoy queda como referencia (sección 7.5). Tarea 243.
- Chips de filtro por tipo: descritos en la documentación previa pero inexistentes en el código. (El agrupado era inline en `InicioPage.tsx`; la tarea 181 lo extrajo a `busqueda/resultados.ts` y `busqueda/ResultadosBusqueda.tsx`, pero sigue sin haber chips de tipo.)
- Tres normalizaciones de acentos sin unificar (`texto.ts`, `sinonimos.ts`, `iconosSoluciones.ts`).
- Sin tope de resultados en el buscador global.
- **Formas de búsqueda de las guías reales**: el campo existe desde la tarea 288, pero ninguna guía real las tiene todavía. Se rellenan después de actualizar los teléfonos (regla 24 de [REGLAS.md](REGLAS.md)) y como trabajo editorial basado en la auditoría de contenido, sin generarlas en masa. Sin tarea abierta todavía, por decisión del usuario (2026-10-02).
- ~~Acentos en el índice global dependen del `fuzzy`~~: resuelto el 2026-10-02 (tarea 288), el índice normaliza sin tildes al indexar y al buscar (sección 5).

## 13. Referencias

- Experiencia visible (caja de Inicio, capa global, resultados): [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md), secciones Inicio y Centro de consulta.
- Reglas de negocio y objetivos de rendimiento: [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md).
- Stack y decisiones técnicas: [ARQUITECTURA.md](ARQUITECTURA.md) y [DECISIONES.md](DECISIONES.md) (AD-037 para los sinónimos de una vía y la letra suelta).
- Archivos clave: `src/features/busqueda/useIndiceBusqueda.ts`, `consultaNatural.ts`, `mejores.ts`, `sinonimos.ts`, `resultados.ts`, `ResultadosBusqueda.tsx`, `benchmarkResolver.ts`; `src/features/referencia/referencias.ts`; `src/lib/texto.ts`, `procedimiento.ts`, `diagnostico.ts`; `src/features/inicio/ResolverPage.tsx` (hasta el 2026-09-21, `InicioPage.tsx`).
- Decisión del buscador que entiende la intención: [DECISIONES.md](DECISIONES.md) AD-062; las formas de búsqueda y su orden de despliegue: [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md) RN-059 y reglas 23 y 24 de [REGLAS.md](REGLAS.md).

## 14. Benchmark de consultas naturales (tarea 288)

`src/features/busqueda/benchmarkResolver.ts` (los datos, los casos y la vara de medir) y `benchmarkResolver.test.ts` (lo ejecuta). Encargo del 2026-10-02: Resolver tiene que entender **qué intenta conseguir** el técnico y no depender de que conozca el nombre exacto de una guía. Antes de tocar el ranking se fijó con qué medirlo.

- **Las expectativas se escribieron antes de cambiar el algoritmo y no se ajustan para que coincidan con él.** El commit de la fase 1 las ejecutó contra el buscador de entonces y dejó en la prueba la lista de los casos que fallaban (`FALLAN_ANTES`); el resto de la tarea mide con el mismo banco, sin tocar un caso.
- **Datos sintéticos con la estructura de los reales.** Ningún dato sale de la base: 10 equipos (con marca, modelo, serial, placa, IP, ubicación vinculada y responsable), 12 guías (una en borrador) con procedimiento, "cuándo usar", síntomas y causas, 2 guías con preguntas, 7 fichas del Centro de consulta, 4 credenciales y un dato protegido de un equipo, 6 ubicaciones, 4 personas y 7 categorías. Pasan por el mismo camino que en la app: `documentosDeBusqueda`, `crearIndiceDesdeDocumentos`, `buscar` y "Mejores resultados". La Bóveda solo entra abierta, y sus "valores cifrados" son marcas que el banco busca en lo que se pinta.
- **35 casos:** las 20 consultas del encargo y 15 más (equipo por ubicación, por nombre, por marca y modelo, por serial y por placa; procedimiento contra equipo; una errata; un título exacto; un sinónimo; una segunda consulta ambigua; y las variantes con la Bóveda abierta y cerrada). Cada caso dice qué intenciones tienen que detectarse y cuáles no, qué tiene que quedar primero cuando la consulta es clara, qué contexto tiene que seguir dentro de "Mejores resultados", si es deliberadamente ambigua (sin intención forzada y sin certeza) y, cuando corresponde, la certeza esperada y el peso del puente a la Bóveda.
- **Cómo leer el informe completo:** `BENCHMARK_INFORME=1 npx vitest run src/features/busqueda/benchmarkResolver.test.ts --reporter=verbose` imprime una fila por consulta, y con `BENCHMARK_INFORME=detalle`, además, los títulos de "Mejores resultados" en orden.

### 14.1 ANTES (2026-10-02, buscador de `70a7e0e`): 13 de 35 casos cumplen

El buscador de entonces no tenía regla de confianza: la interfaz decía siempre "Mejores resultados".

| Consulta | Intenciones | Primero | Resultado |
|---|---|---|---|
| impresora | ninguna | Impresora Mercadeo (equipo) | Falla: los cinco mejores son equipos y la categoría, ninguna guía |
| impresora mercadeo | ninguna | Impresora Mercadeo | Falla: no detecta equipo; sin "Mejor coincidencia" |
| impresora caja 2 | equipo | Impresora Caja 2 | Falla: sin "Mejor coincidencia" |
| la impresora no imprime | problema | La impresora no imprime (guía con preguntas) | Cumple |
| la impresora de mercadeo no imprime | problema | La impresora no imprime | Falla: no detecta equipo y el equipo de Mercadeo sale de los mejores |
| word imprime pero pdf no | ninguna | Imprimir un PDF que no sale | Falla: no detecta el problema ("no" al final) |
| no imprime el pdf | problema | Imprimir un PDF que no sale | Cumple |
| ip impresora mercadeo | ninguna | Conectar una impresora de red en Windows | Falla: no detecta equipo y una guía tapa al equipo |
| 10.10.6.8 | ninguna | Impresora Mercadeo | Falla: no detecta equipo; sin "Mejor coincidencia" |
| crear usuario nuevo | procedimiento, acceso | Crear usuario en Active Directory | Falla: "usuario" se lee como acceso |
| crear usuario nuevo (Bóveda abierta) | procedimiento, acceso | Crear usuario en Active Directory | Falla: "usuario" se lee como acceso |
| llegó una persona nueva | ninguna | Conectar una impresora de red en Windows | Falla: la palabra "una" del título arrastra guías sin relación |
| usuario bloqueado (cerrada y abierta) | problema, acceso | Desbloquear usuario en Active Directory | Cumple |
| no puede entrar después de varios intentos | problema | El usuario no puede iniciar sesión | Cumple |
| no me deja enviar archivo pesado | problema | Enviar archivos pesados por correo | Cumple |
| archivo grande por correo | ninguna | Enviar archivos pesados por correo | Cumple |
| poner backup del correo | ninguna | Configurar el backup del servidor de archivos | Falla: no ve el procedimiento y gana el backup del servidor |
| qué es DHCP | glosario | DHCP | Falla: sin "Mejor coincidencia" |
| ping | ninguna | Diagnosticar la red con ping y tracert | Falla: no ve el comando y la guía tapa al comando |
| windows r | ninguna | Conectar una impresora de red en Windows | Falla: no ve el atajo, que ni sale primero |
| clave impresora mercadeo (cerrada) | acceso | Impresora Mercadeo | Falla: no detecta equipo |
| clave impresora mercadeo (abierta) | acceso | Clave wifi invitados | Falla: una credencial ajena tapa la clave del equipo |
| usuario administrador servidor (cerrada y abierta) | acceso | una credencial (abierta) | Cumple |
| pc contabilidad | ninguna | PC-CONT-01 | Falla: no detecta equipo |
| servidor facturación | ninguna | Servidor de facturación | Falla: no detecta equipo |
| ricoh mp 501 | equipo | Impresora Mercadeo | Cumple |
| serial ABC123 | ninguna | Lector de huella Taquilla | Falla: no detecta equipo; sin "Mejor coincidencia" |
| placa 456 | equipo | UPS Cuarto de sistemas | Falla: sin "Mejor coincidencia" |
| conectar impresora de red | procedimiento | Conectar una impresora de red en Windows | Cumple |
| impresora mercadep | ninguna | Impresora Mercadeo | Falla: no detecta equipo |
| reiniciar la cola de impresión | procedimiento | Reiniciar la cola de impresión | Falla: sin "Mejor coincidencia" |
| respaldo del servidor | ninguna | Configurar el backup del servidor de archivos | Cumple |
| correo | ninguna | Correo (categoría) | Cumple |

### 14.2 DESPUÉS (2026-10-02, rama `feat/resolver-intencion`): 35 de 35 casos cumplen

El mismo banco, **sin tocar un caso**: los datos, los casos y la vara de medir de `benchmarkResolver.ts` no cambiaron desde la fase 1 (`81b8787`); la prueba solo pasó a medir el buscador nuevo, con sus intenciones con evidencia y su regla de confianza. Los 22 casos que fallaban siguen nombrados en la prueba (`FALLABAN_ANTES`) como registro de dónde se partió, y el ANTES se volvió a comprobar ejecutando la prueba de `81b8787`: 13 de 35.

| Consulta | Intenciones | Primero | Rótulo |
|---|---|---|---|
| impresora | ninguna | La impresora no imprime (guía con preguntas), con tres impresoras y la categoría | Mejores resultados |
| impresora mercadeo | equipo | Impresora Mercadeo | Mejor coincidencia |
| impresora caja 2 | equipo | Impresora Caja 2 | Mejor coincidencia |
| la impresora no imprime | problema | La impresora no imprime (guía con preguntas) | Mejores resultados |
| la impresora de mercadeo no imprime | problema, equipo | La impresora no imprime; Impresora Mercadeo sigue entre los mejores | Mejores resultados |
| word imprime pero pdf no | problema | Imprimir un PDF que no sale en la impresora | Mejor coincidencia |
| no imprime el pdf | problema | Imprimir un PDF que no sale en la impresora | Mejor coincidencia |
| ip impresora mercadeo | equipo | Impresora Mercadeo | Mejor coincidencia |
| 10.10.6.8 | equipo | Impresora Mercadeo | Mejor coincidencia |
| crear usuario nuevo (cerrada y abierta) | procedimiento | Crear usuario en Active Directory | Mejor coincidencia |
| llegó una persona nueva | ninguna | Crear usuario en Active Directory | Mejores resultados |
| usuario bloqueado (cerrada y abierta) | problema | Desbloquear usuario en Active Directory | Mejores resultados |
| no puede entrar después de varios intentos | problema | Desbloquear usuario en Active Directory | Mejores resultados |
| no me deja enviar archivo pesado | problema | Enviar archivos pesados por correo con OneDrive | Mejor coincidencia |
| archivo grande por correo | ninguna | Enviar archivos pesados por correo con OneDrive | Mejor coincidencia |
| poner backup del correo | procedimiento | Exportar el buzón de Outlook a un archivo PST | Mejores resultados |
| qué es DHCP | glosario | DHCP (término) | Mejor coincidencia |
| ping | consola | Comprobar si un equipo responde (comando) | Mejores resultados |
| windows r | consola | Abrir la ventana Ejecutar (atajo) | Mejor coincidencia |
| clave impresora mercadeo (cerrada) | acceso, equipo | Impresora Mercadeo | Mejores resultados |
| clave impresora mercadeo (abierta) | acceso, equipo | Clave de administrador · Impresora Mercadeo (dato protegido) | Mejor coincidencia |
| usuario administrador servidor (abierta) | acceso | Administrador del servidor de facturación (credencial) | Mejores resultados |
| usuario administrador servidor (cerrada) | acceso | Crear usuario en Active Directory | Mejores resultados |
| pc contabilidad | equipo | PC-CONT-01 | Mejor coincidencia |
| servidor facturación | equipo | Servidor de facturación | Mejor coincidencia |
| ricoh mp 501 | equipo | Impresora Mercadeo | Mejor coincidencia |
| serial ABC123 | equipo | Lector de huella Taquilla | Mejor coincidencia |
| placa 456 | equipo | UPS Cuarto de sistemas | Mejor coincidencia |
| conectar impresora de red | procedimiento | Conectar una impresora de red en Windows | Mejor coincidencia |
| impresora mercadep | equipo | Impresora Mercadeo | Mejor coincidencia |
| reiniciar la cola de impresión | procedimiento | Reiniciar la cola de impresión | Mejor coincidencia |
| respaldo del servidor | ninguna | Configurar el backup del servidor de archivos | Mejores resultados |
| correo | ninguna | Correo (categoría) | Mejores resultados |

**Lo que el benchmark no dice.** Es sintético y estable a propósito: mide el algoritmo, no el contenido real, y sigue siendo la prueba estable del buscador. Varios casos se apoyan en formas de búsqueda, síntomas y "cuándo usar" que las guías reales todavía no tienen; cuánto ganan esas guías depende de rellenarlas (sección 2 y sección 12), que es trabajo posterior. Para mirar una consulta concreta: `BENCHMARK_INFORME=detalle` (arriba).
