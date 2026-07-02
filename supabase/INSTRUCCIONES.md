# Configuración de Supabase

Pasos que se hacen una sola vez desde el panel de Supabase: https://supabase.com/dashboard/project/kwwxnmlprdivckqcgjws

## 1. Aplicar el esquema de la base de datos

1. En el menú lateral, abrir **SQL Editor**.
2. Presionar **New query**.
3. Copiar TODO el contenido de [schema.sql](schema.sql) y pegarlo.
4. Presionar **Run**.
5. Debe terminar sin errores. Se puede ejecutar más de una vez sin problema.

Para verificar: en **Table Editor** deben aparecer las tablas `perfiles`, `categorias`, `articulos`, `dispositivos`, `credenciales`, `historial` y `adjuntos`, y la tabla `categorias` debe tener las 9 categorías iniciales.

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

## 5. Reglas sobre las claves

- La app solo usa la URL del proyecto y la clave **publishable**, que van en el archivo `.env` (ese archivo no se sube al repositorio; cada integrante que clone el proyecto debe crearlo copiando `.env.example`).
- Las claves **secret** y **service_role** dan acceso total a la base de datos saltándose la seguridad. Nunca deben ir en el código, en el `.env` de la app ni en el repositorio. Guardarlas solo en un gestor de contraseñas.
