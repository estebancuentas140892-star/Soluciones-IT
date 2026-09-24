# Configuración de Supabase

Pasos que se hacen una sola vez desde el panel de Supabase: https://supabase.com/dashboard/project/kwwxnmlprdivckqcgjws

## 1. Aplicar el esquema de la base de datos

1. En el menú lateral, abrir **SQL Editor**.
2. Presionar **New query**.
3. Copiar TODO el contenido de [schema.sql](schema.sql) y pegarlo.
4. Presionar **Run**.
5. Debe terminar sin errores. Se puede ejecutar más de una vez sin problema.

Para verificar: en **Table Editor** deben aparecer las tablas `perfiles`, `categorias`, `articulos`, `dispositivos`, `conexiones`, `credenciales`, `boveda_meta`, `historial` y `adjuntos`, y la tabla `categorias` debe tener las categorías iniciales.

### Actualización del 2026-07-21 (grupo de esquema P1: campos protegidos)

Si el esquema ya estaba aplicado de antes, hay que volver a ejecutar `schema.sql` completo (es idempotente) para incorporar el grupo P1. Agrega:

- La tabla nueva **`campos_protegidos`**: los datos sensibles propios de un equipo (usuario administrador, contraseña, PIN), que antes obligaban a crear una credencial aparte en la Bóveda duplicando la identidad del equipo.
- La columna `entidad_tipo` en `accesos_boveda` y la columna `tipo` en `credenciales`.
- La política de lectura de `historial`, ampliada para restringir también las entradas de campos protegidos.

Punto importante de seguridad: `campos_protegidos` lleva **la misma RLS que `credenciales`** (exige `puede_ver_boveda`). Es la razón de que sea una tabla propia y no una columna dentro de `dispositivos`: esa tabla la puede leer cualquier técnico autenticado, así que un bloque cifrado ahí quedaría al alcance de quien no debe verlo.

Para verificar: en **Table Editor** debe aparecer `campos_protegidos`, y en **Authentication > Policies** debe tener la política `campos_protegidos_acceso`.

### Actualización del 2026-07-21 (grupo de esquema P5: archivo seguro cifrado)

Vuelve a ejecutar `schema.sql` completo (idempotente) para incorporar el grupo P5, que agrega:

- La columna `archivo` (jsonb) en `credenciales`: metadatos EN CLARO del archivo adjunto de un secreto tipo "Archivo seguro" (referencia, nombre, tipo, tamaño). El contenido real del archivo va cifrado y vive en Storage, nunca en esta columna.
- El valor `'descargo'` en el CHECK de `accesos_boveda.accion` (auditoría de descargar y descifrar un archivo seguro).
- Un bucket de Storage **nuevo y privado**: `archivos_boveda`, con sus 4 políticas.

Punto importante de seguridad: a diferencia del bucket `adjuntos` (que cualquier técnico autenticado puede leer, sin exigir ningún permiso), las 4 políticas de `archivos_boveda` exigen `puede_ver_boveda()`, igual que las tablas de la bóveda. Es la razón de que sea un bucket propio y no el mismo `adjuntos`: como desde el 2026-07-17 la contraseña maestra la conoce todo el equipo, subir ahí un archivo cifrado sería una regresión de seguridad silenciosa (cualquiera sin permiso de bóveda podría descargarlo y, sabiendo la contraseña compartida, descifrarlo).

Para verificar: en **Table Editor**, la tabla `credenciales` debe tener la columna `archivo`; en **Storage** debe aparecer el bucket `archivos_boveda`; en **Authentication > Policies** deben aparecer las 4 políticas `archivos_boveda_storage_*`.

Nota para quien ejecute `scripts/huerfanos-storage.mjs` de ahora en adelante: como el bucket nuevo exige `puede_ver_boveda()`, la cuenta técnica que use el script para iniciar sesión debe tener ese permiso, o el listado de `archivos_boveda` fallará por RLS (el resto del script sigue funcionando igual).

### Actualización del 2026-07-23 (hallazgo S2: vencimiento de campos protegidos)

Vuelve a ejecutar `schema.sql` completo (idempotente) para agregar la columna `vence_en` (fecha, opcional) a `campos_protegidos`, mismo criterio sin cifrar que `credenciales.vence_en`. Hasta que se aplique, la app funciona igual (Dexie no exige la columna del lado del servidor), pero el vencimiento que se guarde en un campo protegido no viajará entre dispositivos.

Para verificar: en **Table Editor**, la tabla `campos_protegidos` debe tener la columna `vence_en`.

### Actualización del 2026-09-23 (tarea 266: ciclo de vida de las personas)

**Ya aplicada** (comprobado el 2026-09-24 contra la base real: `personas` tiene `estado`, `fecha_ingreso`, `fecha_retiro` y `motivo_retiro`). No hay que volver a ejecutar nada por esta tarea.

Agregó a `personas` las columnas `estado` (`activa` o `retirada`, por defecto `activa`), `fecha_ingreso`, `fecha_retiro` y `motivo_retiro`. No hay tabla nueva: el historial de asignaciones se reconstruye de `historial`.

### Actualización del 2026-09-24 (tarea 271: endurecimiento de seguridad)

**Ya aplicada en la base real** (migración `seguridad_minimo_privilegio`); `schema.sql` la contiene para que el archivo siga siendo la fuente de verdad. No hay que ejecutar nada por esta tarea. Qué cambió:

- Ninguna función interna se puede invocar desde la API (`/rest/v1/rpc`): `registrar_modificacion()`, `crear_perfil()` y `sellar_registro_inmutable()` son triggers y ya no conceden `EXECUTE` a los roles de la API; `puede_ver_boveda()` pasó a `SECURITY INVOKER` y solo la ejecuta `authenticated` (la usan las políticas de la bóveda). Todas con `search_path` fijo.
- `crear_perfil()` es la única función `SECURITY DEFINER`, y debe seguir así: la dispara Auth al crear un usuario y ese rol no puede escribir en `perfiles`.
- El historial de credenciales y campos protegidos solo lo escribe quien puede leerlo (`puede_ver_boveda`), y en `historial`, `accesos_boveda` y `ejecuciones_diagnostico` el servidor sella quién escribió la entrada (`usuario`, `usuario_nombre`) y cuándo llegó (`recibido_en`).
- En Storage, reemplazar un archivo solo lo puede su dueño (los dos buckets), y en `adjuntos` también borrarlo. Un archivo que quede huérfano porque lo subió otro técnico lo reporta `scripts/huerfanos-storage.mjs` y se borra desde este panel.

Para verificar: **Advisors > Security Advisor** ya no debe mostrar `function_search_path_mutable`, ni las advertencias de funciones `SECURITY DEFINER` para `crear_perfil` o `puede_ver_boveda`. Desde la tarea 258 esas advertencias SÍ aparecen, pero solo para las siete funciones `asistencia_*` (ver la actualización siguiente), junto con un aviso informativo "RLS Enabled No Policy" para sus tres tablas: las dos cosas son a propósito. Queda además "Leaked Password Protection" (ver la sección 4).

### Actualización del 2026-09-24 (tarea 258: portal de asistencia remota)

**Ya aplicada en la base real** (migración `asistencia_portal`); `schema.sql` la contiene en su sección 7. No hay que ejecutar nada. Agrega:

- Tres tablas **cerradas**: `asistencia_sesiones`, `asistencia_mensajes` y `asistencia_eventos`, con RLS activada, sin ninguna política y sin privilegios para `anon` ni `authenticated`. No aparecen en Realtime. En **Table Editor** se ven con el candado de RLS y sin políticas: es a propósito.
- Siete funciones `SECURITY DEFINER`: `asistencia_crear`, `asistencia_estado` y `asistencia_cerrar_portal` para `anon` (el computador atendido, sin sesión), y `asistencia_conectar`, `asistencia_enviar`, `asistencia_estado_tecnico` y `asistencia_desconectar` para `authenticated`. El **Security Advisor** las marca como "Public/Signed-In Users Can Execute SECURITY DEFINER Function": es la superficie pública prevista, justificada en DECISIONES.md AD-053. Cualquier otra función que aparezca ahí sí sería un problema.
- La auditoría mínima de la asistencia está en `asistencia_eventos` (creada, conectada, código incorrecto, envío, rechazo, cierre, vencimiento), sin contenido ni secretos. Se consulta desde aquí:

```sql
select fecha, tipo, detalle, sesion_id, tecnico from public.asistencia_eventos order by fecha desc limit 50;
```

- Para probar las funciones contra la base sin dejar rastro, ejecutar `supabase/pruebas/asistencia.sql`: termina siempre con un error `RESULTADO_PRUEBA fallos=0 [...]` que revierte todo.

## 2. Crear los 5 usuarios del equipo

1. En el menú lateral, abrir **Authentication**, pestaña **Users**.
2. Presionar **Add user** y elegir **Create new user**.
3. Ingresar el correo y una contraseña para el técnico.
4. Activar la opción **Auto Confirm User** para que no necesite confirmar el correo.
5. Repetir para los 5 integrantes.

El perfil de cada usuario se crea solo. Para ponerles su nombre visible, ejecutar en el SQL Editor (una línea por técnico, cambiando los datos):

```sql
update public.perfiles set nombre = 'Nombre Apellido' where correo = 'tecnico@empresa.com';
```

La contraseña que se asigna aquí es solo la inicial: cada técnico puede
cambiarla después desde la app, en **Más > Ajustes** (la página que antes
se llamaba "Mi cuenta").

## 3. Autorizar el acceso a la bóveda

Solo los usuarios autorizados podrán ver la sección de IP y credenciales. Ejecutar en el SQL Editor con los correos de los autorizados:

```sql
update public.perfiles
set puede_ver_boveda = true
where correo in ('tecnico1@empresa.com', 'tecnico2@empresa.com');
```

Para quitar el acceso a alguien, lo mismo con `= false`.

## 4. Desactivar el registro público

**PENDIENTE y URGENTE (comprobado el 2026-09-24):** `https://kwwxnmlprdivckqcgjws.supabase.co/auth/v1/settings` responde `"disable_signup": false`, es decir, el registro sigue abierto. Toda la seguridad de la app supone que "autenticado" es un técnico del equipo: con el registro abierto, cualquiera que tenga la URL del proyecto y la clave publicable (las dos viajan en el JavaScript público de la app) puede crearse una cuenta y, si confirma su correo, leer y modificar guías, equipos, personas y adjuntos. La Bóveda sigue a salvo porque exige `puede_ver_boveda`. El portal `/asistencia` (tarea 258) también depende de esto: solo un técnico real debe poder canjear un código.

Como el equipo es fijo, nadie debe poder crear cuentas por su cuenta:

1. En **Authentication**, abrir la sección de proveedores de inicio de sesión (**Sign In / Providers**).
2. Desactivar la opción de permitir nuevos registros (**Allow new users to sign up**) y guardar.

Los usuarios creados desde el panel (**Authentication > Users > Add user**) seguirán funcionando con normalidad.

Para verificar: abrir `https://kwwxnmlprdivckqcgjws.supabase.co/auth/v1/settings?apikey=<clave publicable>` debe mostrar `"disable_signup":true`.

### Contraseñas filtradas (Leaked Password Protection)

El Security Advisor avisa que la protección contra contraseñas filtradas (comprueba cada contraseña nueva contra HaveIBeenPwned) está desactivada. Se activa en **Authentication > Sign In / Providers > Email** (o **Auth > Password security**, según la versión del panel), **pero Supabase la ofrece solo desde el plan Pro**. En el plan gratuito queda como riesgo aceptado; lo que sí se puede subir en ese mismo lugar es el mínimo de la contraseña (**Minimum password length**, recomendado 12) y exigir letras y números (**Password requirements**). Con el registro desactivado, las contraseñas solo las crea este panel y cada técnico al cambiar la suya en **Más > Ajustes**.

## 5. Restablecer la contraseña maestra de la bóveda (si el equipo la olvida)

La contraseña maestra nunca llega al servidor: en la tabla `boveda_meta` solo se guarda un "verificador" (un texto fijo cifrado con ella) que permite comprobarla desde cualquier dispositivo. Mientras esa fila exista, la app jamás ofrece crear una contraseña nueva: ni borrando la caché, ni cambiando de teléfono, ni vaciando las credenciales.

Por el mismo diseño, **si el equipo olvida la contraseña maestra, las credenciales guardadas son irrecuperables**: están cifradas con una clave derivada de esa contraseña y nadie (ni el servidor, ni el administrador, ni esta guía) puede descifrarlas sin ella. Esto es lo que protege los datos si roban un teléfono o la base de datos.

El restablecimiento solo puede hacerlo quien tenga acceso a este panel (esa es la validación de identidad) y consiste en empezar la bóveda de cero:

1. Confirmar con todo el equipo que la contraseña realmente se perdió (probar variantes con calma: el desbloqueo no tiene límite de intentos y es local).
2. En **SQL Editor**, ejecutar:

```sql
-- Borra el verificador y las credenciales (ilegibles sin la contraseña perdida)
delete from public.boveda_meta;
delete from public.credenciales;
```

3. En la app, el primer técnico autorizado que abra la sección Notas (con internet) podrá definir la contraseña maestra nueva; los demás la usarán normalmente.
4. Volver a ingresar las credenciales a mano. Las entradas viejas del historial quedan cifradas con la contraseña perdida y no se pueden leer; no hace falta borrarlas.

Nota: los respaldos semanales (tarea de GitHub Actions) contienen los mismos bloques cifrados, así que tampoco sirven para recuperar credenciales sin la contraseña con la que se cifraron.

## 6. Reglas sobre las claves

- La app solo usa la URL del proyecto y la clave **publishable**, que van en el archivo `.env` (ese archivo no se sube al repositorio; cada integrante que clone el proyecto debe crearlo copiando `.env.example`).
- Las claves **secret** y **service_role** dan acceso total a la base de datos saltándose la seguridad. Nunca deben ir en el código, en el `.env` de la app ni en el repositorio. Guardarlas solo en un gestor de contraseñas.
