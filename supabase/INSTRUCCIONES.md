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
cambiarla después desde la app, tocando su nombre en la parte superior
(página "Mi cuenta").

## 3. Autorizar el acceso a la bóveda

Solo los usuarios autorizados podrán ver la sección de IP y credenciales. Ejecutar en el SQL Editor con los correos de los autorizados:

```sql
update public.perfiles
set puede_ver_boveda = true
where correo in ('tecnico1@empresa.com', 'tecnico2@empresa.com');
```

Para quitar el acceso a alguien, lo mismo con `= false`.

## 4. Desactivar el registro público

Como el equipo es fijo, nadie debe poder crear cuentas por su cuenta:

1. En **Authentication**, abrir la sección de proveedores de inicio de sesión (**Sign In / Providers**).
2. En el proveedor **Email**, desactivar la opción de permitir nuevos registros (**Allow new users to sign up**) y guardar.

Los usuarios creados desde el panel seguirán funcionando con normalidad.

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
