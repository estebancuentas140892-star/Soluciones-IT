# Buscador de Soluciones IT

Fuente única del subsistema de búsqueda: qué se indexa, cómo se puntúan y ordenan los resultados, la búsqueda difusa, los sinónimos, la normalización, el rendimiento y los buscadores locales que conviven con el global.

Este documento reemplaza y amplía la sección 6 de [ARQUITECTURA.md](ARQUITECTURA.md), que ahora solo enlaza aquí. La experiencia visible del buscador (dónde está la caja, cómo se ven los resultados) vive en [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md); las reglas de negocio que cita este texto (RN) viven en [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md). El código es la fuente de verdad: cuando este documento y el código difieran, gana el código y se corrige este documento.

## 1. Idea general

- Un **único índice [MiniSearch](https://github.com/lucaong/minisearch) en memoria** construido sobre los datos locales (Dexie). No hay búsqueda contra el servidor: al ser 100% local responde en milisegundos y sin internet.
- El índice lo construye y consulta el hook `useIndiceBusqueda` (`src/features/busqueda/useIndiceBusqueda.ts`). Desde el 2026-09-14 el hook solo lee las tablas: **qué entra al índice lo decide la función pura `documentosDeBusqueda`**, en el mismo archivo, que se prueba sin navegador (borradores fuera, bóveda solo abierta). Lo consumen el buscador en línea de **Resolver** (`src/features/inicio/ResolverPage.tsx`; hasta el 2026-09-21 era Inicio, `InicioPage.tsx`) y, desde la tarea 181, la capa global `BuscadorGlobal` (`src/features/busqueda/BuscadorGlobal.tsx`), que se abre con la lupa de la barra superior desde cualquier sección que no traiga su propio campo. Donde este documento dice "el buscador de Inicio", desde el 2026-09-22 es el de Resolver: el motor, el índice, el ranking y el comportamiento no cambiaron.
- **Cómo se presenta (2026-09-22, tarea 254):** encima del campo, la pregunta **"¿Qué necesitas resolver?"**; en el campo, el marcador **"Buscar problema, equipo, comando…"**. Entre el 2026-09-17 y el 2026-09-21 la pregunta fue "¿Qué necesitas solucionar?" con el marcador "Procedimiento, error, equipo…".
- **Cómo se presentaba (2026-09-15):** el campo preguntaba **"¿Qué necesitas resolver?"** y, como apoyo, **"Busca una guía, equipo, acceso, herramienta, comando o problema"**. La **etiqueta accesible sigue siendo "Buscar en Soluciones IT"**, que es lo que distingue este buscador de los de sección (regla M-R8); lo que cambia es el marcador de posición, mediante `textoAlternativo` de `CampoBusqueda`, que existe justo para el campo que es una pregunta y no un alcance. Antes decía "Buscar en Soluciones IT" con la frase "Guías, equipos, herramientas, glosario y más" (2026-09-14), y antes de eso enumeraba secciones.
- **Desde el 2026-09-15 (tarea 241) el buscador no solo encuentra: RESUELVE.** Sobre lo que `buscar` devuelve hay una segunda lectura, "Mejores resultados" (sección 7.1), y cada uno de esos resultados trae su **acción directa** (empezar o continuar una guía, iniciar un diagnóstico, copiar una credencial o un comando; sección 7.2). El motor no cambió: MiniSearch, los sinónimos y el ranking son los mismos.
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

MiniSearch guarda `storeFields: ['tipo', 'titulo', 'subtitulo', 'ruta', 'portadaRef']` y devuelve además el `id`. El campo largo `texto` no se guarda ni se devuelve: solo sirve para indexar. Cada resultado se mapea a `ResultadoBusqueda { id, tipo, titulo, subtitulo, ruta, portadaRef, soloSinonimo }`.

`soloSinonimo` (2026-09-15) marca el resultado que **no coincide con lo que se escribió**: lo trajo un sinónimo. El orden de `buscar` ya lo decía (los directos van primero), pero "Mejores resultados" reordena por relevancia operativa y necesita el dato explícito para no dejar que un sinónimo adelante a una coincidencia directa (sección 7.1).

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

- **Lo escrito manda sobre el sinónimo** (`buscarConSinonimos` en `useIndiceBusqueda.ts`, 2026-09-15). Se hacen dos búsquedas: la de lo que el técnico tecleó y la de los sinónimos que eso agrega. **Primero** van todos los documentos que coinciden con lo escrito (exacto, por prefijo o con errata), ordenados por su score más la mitad del score que les dé el sinónimo (`PESO_SINONIMO = 0.5`); **detrás**, los que solo trae un sinónimo, en su propio orden. Antes la expansión viajaba en la misma consulta con el mismo peso, y "Crear copia de seguridad" (dos palabras del sinónimo en el título) adelantaba a "Backup del servidor" al buscar "backup". Lo usan `buscar` y `buscarSimilares`.
- **Orden interno**: dentro de cada tramo, score descendente de MiniSearch (BM25 + boost por campo + pesos difuso/prefijo). No hay otro desempate configurado por la app; a score idéntico el orden no está garantizado.
- **Agrupación**: los resultados no se muestran como lista plana. `GRUPOS_BUSQUEDA` (en `src/features/busqueda/resultados.ts` desde la tarea 181; antes vivía dentro de `InicioPage.tsx`) define seis grupos por fuente, en orden fijo: **Guías** (incluye diagnóstico, categoría, artículo y adjunto), **Equipos**, **Bóveda**, **Ubicaciones**, **Personas** y **Centro de consulta** (herramienta, término, atajo y comando). Lo aplican por igual Inicio y la capa global. Dentro de cada grupo se respeta el score; entre grupos el orden es siempre el mismo (Soluciones primero), aunque un resultado de otro grupo tenga mayor score.
- **Sin tope ni paginación**: se pintan todos los resultados de cada grupo. Con el volumen del equipo no es un problema; queda anotado como ausencia de límite si el contenido crece (ver [TAREAS.md](TAREAS.md)).

### 7.1 Mejores resultados: la respuesta antes que el módulo (2026-09-15, tarea 241)

`src/features/busqueda/mejores.ts`. Sobre la lista que devuelve `buscar` (en su orden), se eligen **de 3 a 5 resultados con la mayor relevancia global, sin importar el módulo**, y se pintan arriba, bajo el rótulo **"Mejores resultados"**.

**El problema que cierra.** El agrupado por fuente (sección 7) decidía el orden principal, y el grupo mandaba sobre la relevancia: buscando "impresora caja 4", el equipo exacto aparecía **después de todas las guías**, porque Guías va primero en `GRUPOS_BUSQUEDA`. Eso obliga a preguntarse "¿en qué módulo está lo que necesito?" antes de poder resolver nada.

Cómo se puntúa cada candidato (función `puntuacion`, pura y probada):

1. **Dos tramos, no uno.** Primero TODOS los que coinciden con lo escrito; detrás, los que solo trae un sinónimo (`soloSinonimo`). **Ningún bono cruza de tramo**: un sinónimo no puede adelantar a una coincidencia directa por mucho que puntúe.
2. **Coincidencia del título**: exacta (+100), por prefijo (+60), contenida (+40), todas las palabras sueltas (+25), alguna palabra (+10).
3. **Relevancia operacional** (`PESO_OPERATIVO`): guía, diagnóstico, equipo y credencial 6; comando, herramienta y atajo 5; término 4; categoría, ubicación y persona 2; adjunto 1. A igualdad de coincidencia gana **lo que se resuelve**, no el escalón que lleva a otra cosa.
4. **Intención** (+18, sección 7.3).
5. **Desempate final**: el orden que ya traía el buscador, para que la lista no baile entre pulsaciones.

**No se pinta nada dos veces.** Lo que sube arriba se **descuenta de su grupo** (`sinLosMejores`); un grupo que se queda sin filas desaparece. Con **un solo resultado** la sección no se dibuja (`hayQueSepararMejores`): una cabecera "Mejores resultados · 1" sobre una fila única es ruido, y ahí la acción la lleva la propia fila del grupo.

**El tipo se escribe en la fila.** Fuera de los grupos no hay cabecera que lo diga, así que el subtítulo se antepone con el tipo: "Guía · ICG Manager", "Equipo · Epson · Caja 4", "Bóveda · Acceso" (`subtituloConTipo`, que no repite el tipo si el subtítulo ya empieza por él).

### 7.2 Acciones directas en el resultado (2026-09-15, tarea 241)

`src/features/busqueda/AccionesResultado.tsx`. Hasta esta tarea un resultado solo sabía **abrir su ficha**, así que el recorrido real era siempre buscar, abrir, buscar la acción dentro y ejecutarla.

| Tipo | Acción | De dónde sale la regla |
|---|---|---|
| **articulo** (guía) | **ninguna desde el 2026-09-17** (tarea 244) | Tocar la fila abre la guía **en su paso pendiente** (`GuiaPage`): una guía terminada empieza un caso nuevo y una a medias se retoma. El botón `Empezar` / `Continuar · paso N de M` / `Repetir guía` repetía ese enlace y se retiró. `accionDeGuia` (vía `useAccionesDeGuia`) solo decide con qué verbo se mide el recorrido (`empezar_guia` o `continuar_guia`) |
| **diagnostico** | `Iniciar` | La ruta del diagnóstico ya arranca la sesión sola |
| **credencial** | `Ver` (vista rápida, sección 7.7) + `Copiar usuario` + `Copiar contraseña` (acceso) · `Ver` + `Copiar clave` (clave o PIN) · `Ver` + `Copiar` (token o licencia) · `Ver` (nota segura) · `Abrir ficha` (archivo seguro, que no se abre en el buscador; en modo consulta, nada) | `accionesRapidasDeCredencial` y `copiarCampoCredencial` (`src/features/boveda/accionesCredencial.ts`), extraídos de `BovedaPage`: descifrado, permisos y **auditoría** son los de siempre |
| **comando** y **atajo** | `Copiar comando` / `Copiar atajo` | El campo `valor` de la ficha. Esa tabla **nunca guarda secretos**, así que aquí no hay descifrado ni auditoría que hacer |
| todo lo demás | ninguna | Abrir la ficha ES la acción, y la fila entera ya la abre |

**Las acciones viven solo en "Mejores resultados"** (o en la fila única cuando no hay sección). Con la acción en todas las filas, una búsqueda de ocho guías dejaba ocho botones "Empezar" apilados y la pantalla se leía como una botonera: arriba son **cinco como mucho**, que es justo lo que se va a tocar. Cada fila tiene una acción primaria y, como mucho, dos. Desde el 2026-09-17 una guía no lleva ninguna: la fila ya lleva a su paso pendiente.

**Volver al sitio.** Cada fila viaja con `conOrigen(pathname, 'la búsqueda', { consulta, capa })`, así que abrir una ficha desde aquí y volver devuelve **a la búsqueda**, no a la lista raíz de su sección, y **con lo que estaba escrito** (sección 7.8, desde el 2026-09-16). Es el sistema de origen que ya existía (AD-030), no un segundo mecanismo.

**En modo consulta** (encima de una guía en ejecución, sección 7.5) no se ofrece nada que abra otra ejecución: la fila de una guía no navega (abrirla sería ejecutarla) y un diagnóstico no ofrece `Iniciar`. La guía o el diagnóstico encontrados quedan como referencia. Copiar sí sigue. Lo decide `ofreceAccionDirecta` (`src/features/busqueda/modoConsulta.ts`).

### 7.3 Intención de la consulta, con los datos que ya hay (2026-09-15, tarea 241)

`intencionesDeConsulta`. Sin IA generativa y sin servicios externos: se leen las palabras que el equipo ya usa y se suma un bono al tipo que suele resolver esa clase de pregunta. Pueden aplicar varias a la vez.

| Intención | Se detecta por | Favorece |
|---|---|---|
| `procedimiento` | un verbo de procedimiento entre las palabras (crear, configurar, instalar, reiniciar, restablecer, conectar...) | guía, diagnóstico |
| `glosario` | empieza por "qué es", "qué significa", "definición"... | término |
| `equipo` | varias palabras y **una de ellas es un número** ("caja 4", "impresora taquilla 2") | equipo |
| `problema` | "no ", "falla", "error", "lento", "se cae", "sin "... | diagnóstico, guía |
| `acceso` | usuario, contraseña, clave, acceso, cuenta, PIN, token, licencia, administrador... | credencial |
| `consola` | comando, consola, terminal, cmd, powershell, atajo, tecla | comando, atajo |

El bono de intención (**+18**) es menor que cualquier coincidencia de título: **desempata entre cosas que ya coinciden, nunca inventa un resultado que no se buscó**. Casos como "ping" o "zabbix" no necesitan intención: los resuelve la coincidencia exacta de título (+100).

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
- **Quién la repone:** Inicio, en su campo en línea; y la capa global, desde `CapaAtajos`, que vive en el chasis de todas las pantallas y por eso sirve venga de la lupa de la barra o de "/". Se relee en cada **llegada** a la entrada (ir o volver), no solo al montar: de un equipo a otro equipo React reutiliza la pantalla y volver al primero tiene que reponer igual.
- **Cuándo se olvida:** al cerrar la capa repuesta o al vaciar el campo de Inicio, que es dar la búsqueda por terminada (`descartar`). Abrir la capa con la lupa sigue empezando limpio, como siempre.

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
- Medicion del recorrido: `registrarResolucion` esta preparada y probada, pero todavia no guarda en ningun sitio (seccion 7.6).
- Vista rápida de un **dato protegido de un equipo** en modo consulta: hoy queda como referencia (sección 7.5). Tarea 243.
- Chips de filtro por tipo: descritos en la documentación previa pero inexistentes en el código. (El agrupado era inline en `InicioPage.tsx`; la tarea 181 lo extrajo a `busqueda/resultados.ts` y `busqueda/ResultadosBusqueda.tsx`, pero sigue sin haber chips de tipo.)
- Tres normalizaciones de acentos sin unificar (`texto.ts`, `sinonimos.ts`, `iconosSoluciones.ts`).
- Sin tope de resultados en el buscador global.
- Acentos en el índice global dependen del `fuzzy`, no de una normalización propia: los términos cortos son el borde débil.

## 13. Referencias

- Experiencia visible (caja de Inicio, capa global, resultados): [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md), secciones Inicio y Centro de consulta.
- Reglas de negocio y objetivos de rendimiento: [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md).
- Stack y decisiones técnicas: [ARQUITECTURA.md](ARQUITECTURA.md) y [DECISIONES.md](DECISIONES.md) (AD-037 para los sinónimos de una vía y la letra suelta).
- Archivos clave: `src/features/busqueda/useIndiceBusqueda.ts`, `sinonimos.ts`, `resultados.ts`; `src/features/referencia/referencias.ts`; `src/lib/texto.ts`, `procedimiento.ts`, `diagnostico.ts`; `src/features/inicio/InicioPage.tsx`.
