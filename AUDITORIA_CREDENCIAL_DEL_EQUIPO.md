# Auditoría: la credencial del equipo en una guía (tarea 290, fase 1)

Fecha: 2026-10-03. Alcance: el código de `main` en `7b76df0`. No se leyó ningún dato real de la Bóveda, de los equipos ni de las guías: la auditoría de la información protegida la hizo ChatGPT Work y su resultado llegó en el encargo. Este documento no contiene valores protegidos, direcciones IP ni nombres de credenciales.

## 1. El problema

Una acción de una guía que necesita un acceso protegido hoy solo puede decir **"usa esta credencial"**: el vínculo protegido guarda un identificador fijo. No puede decir **"usa la credencial del equipo con el que estoy trabajando"**. Una misma guía de impresoras sirve para varias impresoras que tienen credenciales distintas, así que fijar una obliga a escribir una guía por credencial o a dejar que el técnico elija y pruebe.

La auditoría de ChatGPT Work confirma que el dato que hace falta **ya existe**: la Bóveda relaciona cada credencial con los equipos a los que da acceso (muchos equipos con una credencial), y las impresoras de la marca más usada ya están relacionadas. Lo que falta es código que aproveche esa relación.

**La complejidad pertenece al sistema, no al técnico.** El técnico identifica el equipo; la aplicación conserva ese contexto y, cuando una acción necesita el acceso, busca qué credencial corresponde a ese equipo.

## 2. La ruta del dato hoy

### 2.1 La credencial y su relación con los equipos

- `Credencial` (`src/lib/db.ts`, tabla `credenciales`): `titulo`, `categoria` (texto libre con sugerencias de lo ya escrito), `tipo` (`cuenta` "Acceso (usuario y contraseña)", `red` "Clave o PIN", `llave` "Token, licencia o certificado", `archivo`, `nota`), `datosCifrados` (AES-256-GCM: usuario, contraseña, IP, URL, notas y extras), `venceEn`, `dispositivos`, `archivo` y `eliminadoEn`.
- **`dispositivos`** es la relación: una lista `{ id, nombre }` **sin cifrar a propósito** (columna `jsonb`): que una credencial pertenezca a un equipo no es el secreto. Ya produce el inverso "credenciales de este equipo" en la ficha del equipo (`CredencialesDelEquipo.tsx`, arista `credencial_dispositivo` del grafo, `src/lib/grafo.ts`).
- **Permisos.** RLS `puede_ver_boveda()` en Supabase: quien no tiene el permiso **no descarga ni una fila** de `credenciales` ni de `campos_protegidos`. En el teléfono de quien sí lo tiene, las filas viven en Dexie con los secretos cifrados; descifrarlos exige la contraseña maestra (`sesionBoveda.ts`: `desbloquear`, autobloqueo por inactividad, sesión global).
- `CampoProtegido` es otra cosa: un dato sensible que **pertenece** a un equipo (`dispositivoId`). No es una relación de la Bóveda y queda fuera de esta tarea.

### 2.2 El vínculo protegido de una guía

- `VinculoProtegido = { tipo: 'credencial' | 'campo', id, titulo }`, en un paso (`PasoProcedimiento.vinculoProtegido`) o en una tarea (`BloquePaso.vinculoProtegido`). `titulo` es copia de referencia: quien no tiene permiso ve el nombre sin descargar nada.
- Vive en el JSON `procedimiento` del artículo (sin columna propia). `normalizarVinculoProtegido` (`src/lib/procedimiento.ts`) acepta solo `credencial` o `campo` con `id`; cualquier otra forma se descarta al leer.
- Lo usan, además de la ejecución: el grafo (aristas `credencial_paso`, `credencial_tarea`, `campo_*`, para el impacto de borrar una credencial), el historial de cambios (`resumenProcedimiento.ts`, compara por `id`), `ModoFoco` (no repite la credencial prestada si es la misma, compara por `id`) y el editor.
- **Editor** (`PasosEditor.tsx`): "Vincular información protegida" abre `HojaVinculo` con dos grupos, "Datos protegidos del equipo" (campos de los equipos afectados) y "Secretos de la bóveda". Sin permiso de Bóveda las listas llegan vacías y el selector no aparece.
- **Asistencia remota** (`contenidoPaso.ts`) no lee el vínculo: el computador atendido jamás recibe una clave.
- **Resolver** no indexa el vínculo: su título no entra en la búsqueda.

### 2.3 La consulta dentro de la guía

`CredencialEnPaso` (`src/features/boveda/CredencialEnPaso.tsx`) es la consulta contextual de la Bóveda, la única que se reutiliza:

1. Contraída de entrada: los secretos no entran a la pantalla hasta que el técnico la abre.
2. Sin permiso (o sin la fila en el teléfono): "Solo los usuarios autorizados pueden consultar los datos de este paso."
3. Credencial eliminada: "Los datos vinculados fueron eliminados…", sin usarla.
4. Bóveda bloqueada: desbloqueo en línea con la contraseña maestra, sin salir de la guía.
5. Desbloqueada: usuario, contraseña oculta tras el ojo, IP, URL y extras con copiar; enlace "Ver ficha completa en Bóveda".
6. **Auditoría** (`registrarAccesoBoveda`, tabla `accesos_boveda`, local y en cola hacia Supabase): `consulto` al abrir, `mostro` al revelar la contraseña, `copio_usuario` y `copio_contrasena` al copiar.

### 2.4 La ejecución y su avance

- `ProveedorEjecucion` abre una ejecución (`raizId`) para todo lo que cuelga de ella: la guía principal y las guías que reutiliza, que guardan su avance dentro de esa misma fila (`vinculos[guiaId]`).
- `progresoPasos` vive **solo en el teléfono** (no se sincroniza). `guardarProgreso` reescribe la fila con los campos que conoce: **un campo nuevo se perdería en la siguiente marca** si no se añade ahí.
- Tres raíces: la guía (`AsistentePage`), el recorrido de una guía con preguntas (`DiagnosticoRunPage`) y la prueba del editor (`VistaPreviaArticulo`, raíz efímera).

### 2.5 El equipo durante Resolver y la ejecución

- **La ejecución no conoce ningún equipo.** Lo único parecido es `articulo.dispositivosAfectados[0]`, que decide dónde se guarda la foto de evidencia: es el equipo que declara la guía, no el equipo con el que se trabaja.
- **La ficha del equipo** abre sus guías (`ProcedimientosDelEquipo`, `ProblemasDelEquipo`) con un enlace a la guía a secas: el equipo se pierde en el salto.
- **Resolver** sabe qué palabras de la consulta identifican un equipo concreto (`objetoDeLaConsulta` en `mejores.ts`, tarea 288: "mercadeo" en "la impresora de mercadeo no imprime"), pero ese saber solo ordena: abrir una guía desde los resultados no lleva el equipo.
- El escáner de códigos QR abre la ficha del equipo, así que hereda lo mismo.

### 2.6 Sin conexión

Las guías, los equipos y (para quien tiene permiso) las credenciales cifradas están en Dexie: la relación equipo y credencial se puede leer sin red. Descifrar sigue exigiendo la contraseña maestra, también sin red.

## 3. Hallazgos

| # | Hallazgo | Consecuencia para el diseño |
|---|---|---|
| H1 | El vínculo protegido solo conoce un identificador fijo. | Hace falta un vínculo **contextual** que conviva con el fijo, sin convertir los existentes. |
| H2 | La relación equipo y credencial ya existe, sin cifrar, en `credenciales.dispositivos`. | La resolución lee esa relación por **identificador del equipo**: ni nombre, ni modelo, ni IP, ni categorías escritas en el código. |
| H3 | La ejecución no conserva el equipo con el que se trabaja; la ficha del equipo y Resolver no lo pasan. | Hay que conectar el contexto: guardarlo con la ejecución y recibirlo desde la ficha y desde Resolver (solo cuando la consulta identifica un único equipo). |
| H4 | No existe un campo "finalidad". El modelo sí tiene `tipo` (clase de secreto) y `categoria` (texto libre de la Bóveda, con sugerencias). | La clase de acceso sale de `tipo`; la finalidad, cuando una acción la pide, se compara **exacta** (sin mayúsculas, tildes ni espacios sobrantes) con la **categoría** de la credencial. Sin migración y sin campo nuevo en la Bóveda. |
| H5 | `guardarProgreso` reescribe la fila con los campos que conoce. | El equipo de la ejecución se añade a esa lista; si no, la primera marca lo borraría. |
| H6 | Grafo, historial y `ModoFoco` comparan vínculos por `id`. | El vínculo contextual no tiene `id`: tipos discriminados para que el compilador obligue a tratarlo en cada sitio, y una clave propia para comparar. |
| H7 | Una versión anterior de la app descarta un vínculo que no reconoce y, si guarda la guía, lo pierde (el mismo riesgo que `lugar`, `resultado` y `formasBusqueda`). | Orden de despliegue: primero esta versión, después actualizar los teléfonos, y solo entonces añadir vínculos contextuales a las guías reales (regla 24 de [REGLAS.md](REGLAS.md), mismo patrón). |
| H8 | Quien no tiene permiso de Bóveda no tiene filas de credenciales. | La resolución nunca puede insinuarle si un equipo tiene credencial: ve lo mismo que con un vínculo fijo. |

## 4. Diseño técnico mínimo

### 4.1 Dos vínculos que conviven

- **Fijo** (sin cambios): `{ tipo: 'credencial' | 'campo', id, titulo }`. La acción conoce exactamente qué dato necesita.
- **Contextual** (nuevo): `{ tipo: 'equipo', finalidad, titulo }`. La acción necesita la credencial del equipo actual; `finalidad` vacía significa "la única credencial de acceso del equipo".
- `VinculoProtegido` pasa a ser la unión de los dos. El normalizador acepta las dos formas y sigue descartando cualquier otra.

### 4.2 Las reglas de resolución (fase 2, lógica pura)

Entrada: el identificador del equipo en contexto, la finalidad pedida, los equipos y las credenciales del teléfono.

1. Sin equipo en contexto (o un identificador vacío o que no es texto): **sin equipo**.
2. El identificador no corresponde a un equipo vivo: **equipo no disponible**.
3. Candidatas: credenciales **vivas** (sin `eliminadoEn`), de **acceso** (`tipo` `cuenta` o `red`; una licencia, un archivo o una nota no son un acceso) y **relacionadas con ese equipo exacto** en `dispositivos`.
4. Con finalidad: solo las candidatas cuya categoría coincide exactamente con ella. Sin finalidad: todas.
5. **Una**: resuelta (caso A). **Ninguna**: no hay credencial configurada (casos B y D: una eliminada o que no está en el teléfono no cuenta). **Varias**: no se puede saber cuál (caso C); nunca se elige una.
6. Una credencial **vencida** no es una eliminada: se usa y se ve con su aviso de vencimiento, igual que en un vínculo fijo.

### 4.3 El equipo de la ejecución (fase 3)

- `ProgresoPasos.equipoId`: opcional, local como el resto del avance. Lo comparten la guía y las guías que reutiliza (viven en la misma fila).
- `ProveedorEjecucion` lo expone en `ContextoEjecucion`. Llega de tres sitios: `?equipo=` desde la ficha del equipo y desde Resolver (solo si la consulta identifica un único equipo), la fila guardada al retomar, o elegido por el técnico en la propia acción ("Elegir el equipo", `HojaVinculo`), que también permite cambiarlo.
- No se crea una fila de avance solo por el equipo: mientras no hay avance vive en memoria y en la dirección, y entra en la fila cuando la fila existe.

### 4.4 La interfaz (fases 3 y 4)

- Ejecución: la misma fila y el mismo cuerpo de `CredencialEnPaso`. Resuelta, es exactamente la consulta de siempre (permiso, contraída, desbloqueo, ojo, copiar, auditoría) sobre la credencial resuelta, con una segunda línea que dice de qué equipo es. Sin resolver, un estado neutro, sin valores ni títulos de otras credenciales.
- Editor: en la hoja de "Información protegida", una opción "Credencial del equipo actual" además de las credenciales concretas; elegida, un campo "Finalidad (opcional)" con las categorías que ya usa la Bóveda como sugerencia.

## 5. Lo que esta tarea no toca

Datos reales de la Bóveda (`credenciales.dispositivos`, cifrados, campos protegidos, usuarios, contraseñas, PIN), equipos, guías reales (tampoco el borrador de la guía de impresión bloqueada), Supabase, el ranking y la búsqueda de Resolver, `formasBusqueda`, la navegación y el diseño de la Bóveda y de la ejecución.

## 6. Pendiente para otros (preliminar; se cierra en la fase 5)

- **ChatGPT** (contenido de las guías): cuando esta versión esté desplegada y los teléfonos actualizados, cambiar en las guías que sirven para varios equipos el vínculo fijo por "Credencial del equipo actual", con finalidad solo donde el equipo tenga varios accesos.
- **ChatGPT Work** (Bóveda): para los equipos con más de una credencial de acceso, que la categoría de cada una distinga su finalidad; y las impresoras sin credencial demostrada siguen sin relación (la aplicación lo dirá así).
