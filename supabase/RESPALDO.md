# Respaldo automático de datos

Cada domingo, un workflow de GitHub Actions exporta todas las tablas de Supabase, cifra el resultado y lo guarda por 90 días. Existe porque el plan gratuito de Supabase no incluye copias de seguridad: si algo se borra por error más allá de lo que cubre el historial, este respaldo es la única vuelta atrás.

Qué incluye: las 11 tablas (`categorias`, `perfiles`, `articulos`, `dispositivos`, `conexiones`, `credenciales`, `historial`, `adjuntos`, `diagnosticos`, `ejecuciones_diagnostico`, `accesos_boveda`) en formato JSON, más un manifiesto con la fecha y el número de filas por tabla. Las credenciales de la bóveda van tal como viven en el servidor: cifradas; el respaldo nunca contiene contraseñas legibles.

Qué NO incluye: los archivos del bucket de Storage (fotos, manuales en PDF). Solo se respaldan sus referencias en la tabla `adjuntos`.

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

## Cómo recuperar un respaldo

1. En **Actions** > "Respaldo de Supabase", abrir la ejecución deseada y descargar el artefacto (un `.zip` que contiene el `.tar.gz.enc`).
2. Descifrar y desempaquetar (pedirá la frase de cifrado):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in respaldo-supabase-AAAA-MM-DD.tar.gz.enc -out respaldo.tar.gz
tar -xzf respaldo.tar.gz
```

3. Quedan los JSON por tabla y el `manifiesto.json`. Para restaurar datos puntuales, lo más simple es copiar los valores del JSON y reinsertarlos desde la app o con `insert`/`update` en el SQL Editor. Una restauración completa se hace tabla por tabla en este orden (por las referencias entre ellas): `categorias`, `articulos`, `dispositivos`, `credenciales`, `adjuntos`, `historial`; `perfiles` no se restaura por SQL porque depende de los usuarios de Authentication.

## Detalles de seguridad

- El respaldo se guarda como artefacto de un repositorio público: cualquier usuario de GitHub podría descargar el archivo, pero está cifrado con AES-256 y sin la frase no revela nada.
- El workflow nunca usa la clave `service_role` (prohibida en el repositorio, ver [INSTRUCCIONES.md](INSTRUCCIONES.md)); lee los datos como un usuario normal, respetando las políticas RLS.
- Los respaldos expiran a los 90 días. Con la ejecución semanal siempre hay unas 13 copias disponibles.
