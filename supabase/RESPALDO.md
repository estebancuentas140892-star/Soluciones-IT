# Respaldo automático de datos

Cada domingo, un workflow de GitHub Actions exporta todas las tablas de Supabase, cifra el resultado y lo guarda por 90 días. Existe porque el plan gratuito de Supabase no incluye copias de seguridad: si algo se borra por error más allá de lo que cubre el historial, este respaldo es la única vuelta atrás.

Qué incluye: las 17 tablas de datos del esquema (`categorias`, `ubicaciones`, `personas`, `perfiles`, `articulos`, `dispositivos`, `mantenimientos` (desde la tarea 320), `conexiones`, `credenciales`, `campos_protegidos`, `boveda_meta`, `adjuntos`, `historial`, `diagnosticos`, `ejecuciones_diagnostico`, `accesos_boveda`, `referencias`) en formato JSON, más un manifiesto con la fecha y el número de filas por tabla. Hasta el 2026-09-24 el script respaldaba solo 11: faltaban las cinco que se crearon después de escribirlo, y ahora una prueba (`src/lib/esquema.test.ts`) falla si vuelve a faltar alguna. Las credenciales y los campos protegidos de la bóveda van tal como viven en el servidor, cifrados: el respaldo nunca contiene contraseñas legibles.

Qué NO incluye: los archivos del bucket de Storage (fotos, manuales en PDF). Solo se respaldan sus referencias en la tabla `adjuntos`. Tampoco las tres tablas del portal de asistencia remota (`asistencia_sesiones`, `asistencia_mensajes`, `asistencia_eventos`, tarea 258), a propósito: están cerradas a la API (ni el usuario de respaldo puede leerlas) y solo guardan sesiones que duran como mucho cuatro horas. La prueba las excluye por nombre.

## Configuración (una sola vez)

### 1. Crear el usuario de respaldo en Supabase

Igual que los usuarios del equipo (Authentication > Users > Add user > Create new user):

- Correo: uno dedicado, por ejemplo `respaldo@soluciones-it.local` (no necesita existir como buzón real).
- Contraseña: larga y generada al azar; guárdala en el gestor de contraseñas.
- Activar **Auto Confirm User**.

Después, en el SQL Editor, darle acceso de lectura a la bóveda para que el respaldo incluya los bloques cifrados de las credenciales:

```sql
update public.perfiles set puede_ver_boveda = true where correo = 'respaldo@soluciones-it.local';
```

Sin esto el respaldo funciona igual, pero la tabla `credenciales` sale vacía (el propio workflow lo avisa en su registro).

Nota: este usuario es una cuenta normal de la app. No compartir su contraseña con el equipo; existe solo para el respaldo.

### 2. Inventar la frase de cifrado

Una frase larga cualquiera (por ejemplo generada por el gestor de contraseñas). Con ella se cifra cada respaldo y sin ella **no hay forma de abrirlos**. Guardarla en el gestor de contraseñas junto a la del usuario de respaldo.

### 3. Cargar los tres secretos en GitHub

En https://github.com/estebancuentas140892-star/Soluciones-IT > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**, crear:

| Nombre | Valor |
|--------|-------|
| `RESPALDO_CORREO` | correo del usuario de respaldo |
| `RESPALDO_CONTRASENA` | contraseña del usuario de respaldo |
| `RESPALDO_CLAVE_CIFRADO` | la frase de cifrado del paso 2 |

### 4. Probar el primer respaldo

En la pestaña **Actions** del repositorio, elegir "Respaldo de Supabase" > **Run workflow**. Debe terminar en verde y dejar un artefacto `respaldo-supabase-N` con el archivo cifrado. Mientras los secretos no existan, las ejecuciones fallan con un mensaje claro y GitHub avisa por correo.

Un respaldo que nunca se ha restaurado no está comprobado: después del primero en verde, hacer el [simulacro de restauración](#simulacro-de-restauración).

## Cómo recuperar un respaldo

Hace falta una copia del repositorio (para el script), Node, `openssl`, `tar` y `psql` (el cliente de PostgreSQL; en Windows, `openssl` y `tar` vienen con Git Bash, y `psql` con el instalador de PostgreSQL marcando solo "Command Line Tools").

1. En **Actions** > "Respaldo de Supabase", abrir la ejecución deseada y descargar el artefacto (un `.zip` que contiene el `.tar.gz.enc`).
2. Descifrar y desempaquetar en una carpeta propia (pedirá la frase de cifrado):

```bash
mkdir respaldo
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in respaldo-supabase-AAAA-MM-DD.tar.gz.enc -out respaldo.tar.gz
tar -xzf respaldo.tar.gz -C respaldo
```

3. Quedan un JSON por tabla y el `manifiesto.json`. Generar el SQL que los carga, según el caso:

```bash
# Recuperar lo que falte en el proyecto de siempre (una fila borrada por error, una tabla vaciada):
node scripts/restauracion-sql.mjs respaldo > restauracion.sql

# Cargar el respaldo entero en un proyecto recién creado con supabase/schema.sql:
node scripts/restauracion-sql.mjs --proyecto-nuevo respaldo > restauracion.sql
```

4. Ejecutarlo con la cadena de conexión del proyecto de destino (Supabase > **Connect** > "Session pooler", que funciona desde cualquier red):

```bash
psql "postgresql://postgres.<ref>:<contraseña de la base>@<servidor del pooler>:5432/postgres" -v ON_ERROR_STOP=1 -f restauracion.sql
```

   Al final muestra, por tabla, las filas que hay y las que traía el respaldo. Si algo falla, no se aplica nada: todo va en una sola transacción.

5. Borrar `restauracion.sql`, `respaldo.tar.gz` y la carpeta `respaldo`: llevan los datos del equipo (los secretos, cifrados).

Qué hace el SQL y por qué:

- **Nunca pisa lo que existe.** Cada fila entra con `on conflict (id) do nothing`: recuperar en el proyecto de siempre solo repone lo que falta, y lo editado después del respaldo se queda como está. Para volver una fila existente a su valor anterior, se copia a mano desde su JSON.
- **Conserva autor y fechas tal cual.** Carga con `session_replication_role = replica` (el modo que usa la propia guía de restauración de Supabase), así que no corren los triggers: `updated_at`, `updated_by`, y el `usuario` y `recibido_en` del historial, los accesos a la bóveda y las ejecuciones de diagnóstico, quedan como en el respaldo. Con los triggers activos el sello de la tarea 271 reescribiría `recibido_en` con la hora de la restauración, también desde el SQL Editor.
- **`--proyecto-nuevo` vacía antes las tablas que va a cargar.** `schema.sql` siembra categorías (con ids al azar y nombre único) y referencias: sin vaciarlas, las categorías del respaldo chocarían por nombre y la carga fallaría, y una referencia editada por el equipo se quedaría con el texto de la semilla. Si el proyecto ya tiene datos propios (equipos, guías, historial...), se detiene sin tocar nada: no hay forma de borrar producción con este modo por error.
- **`perfiles` no se carga.** Cada perfil nace al crear su cuenta en Authentication. En un proyecto nuevo se crean de nuevo las cuentas y se revisa `puede_ver_boveda` contra `perfiles.json`; las referencias de autoría de las filas cargadas apuntan a las cuentas antiguas, así que en el historial se sigue leyendo el nombre guardado.
- **Un respaldo anterior a una columna nueva** se carga igual: la columna que no trae toma su valor por defecto.

Una ficha borrada desde la app no necesita el respaldo: la app no borra filas del servidor, las marca con `eliminado_en`.

## Simulacro de restauración

Comprueba que un respaldo real se puede abrir y cargar, sin tocar producción. Se hace tras el primer respaldo en verde, y después al cambiar el esquema o cada tres meses.

1. Crear en Supabase un proyecto aparte para el simulacro (el plan gratuito admite dos proyectos activos) y ejecutar `supabase/schema.sql` completo en su SQL Editor.
2. Descargar el último artefacto y seguir los pasos 2 a 4 de arriba con `--proyecto-nuevo` y la cadena de conexión del proyecto del simulacro.
3. Comprobar que la tabla final dice lo mismo en `filas` y `en_respaldo` para cada tabla, y que las cifras coinciden con lo que se ve en la app (equipos, personas, guías).
4. Borrar el proyecto del simulacro y los archivos del paso 5.
5. Anotar la fecha y el resultado en la tarea 15 de [TAREAS.md](../TAREAS.md).

El script ya se probó el 2026-09-29 contra el `schema.sql` real, en un PostgreSQL local con datos ficticios que imitan la exportación del respaldo: proyecto nuevo idéntico fila por fila (semillas editadas, autor, `updated_at` y `recibido_en` incluidos), la guarda que protege una base con datos, la recuperación parcial que no pisa lo editado y la carga repetida sin cambios. Eso prueba el método; solo el simulacro con un artefacto real prueba el respaldo.

## Detalles de seguridad

- El respaldo se guarda como artefacto de un repositorio público: cualquier usuario de GitHub podría descargar el archivo, pero está cifrado con AES-256 y sin la frase no revela nada.
- El workflow nunca usa la clave `service_role` (prohibida en el repositorio, ver [INSTRUCCIONES.md](INSTRUCCIONES.md)); lee los datos como un usuario normal, respetando las políticas RLS.
- Los respaldos expiran a los 90 días. Con la ejecución semanal siempre hay unas 13 copias disponibles.
