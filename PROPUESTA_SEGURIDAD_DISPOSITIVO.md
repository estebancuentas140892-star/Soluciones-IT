# Propuesta: Seguridad del dispositivo y Bóveda de secretos independientes

Fecha: 2026-07-21
Estado: PRESENTADA, pendiente de confirmación del usuario. Sin código escrito todavía.

Encargo del usuario: corregir la duplicidad entre Dispositivos y Bóveda. Los dispositivos pasan a ser la entidad principal y sus datos sensibles viven dentro de su propia ficha; la Bóveda queda solo para secretos independientes.

---

## 1. Diagnóstico de la arquitectura actual

### 1.1 Qué ya cumple el principio

El vínculo equipo <-> credencial YA existe desde el grupo N3 (tarea 70, 2026-07-17) y funciona bien:

- `credenciales.dispositivos` (jsonb `{id, nombre}[]`, sin cifrar a propósito) guarda a qué equipos da acceso una credencial. Se edita en `src/features/boveda/CredencialForm.tsx:545` (`EquiposVinculadosEditor`).
- El inverso se DERIVA del grafo, no se guarda: `src/lib/grafo.ts:114` produce la relación `credencial_dispositivo` y `src/features/dispositivos/CredencialesDelEquipo.tsx` la pinta en la ficha del equipo.
- La ficha de la credencial muestra "Da acceso a" con nombre vivo (`CredencialPage.tsx:165`, regla de referencia viva de `src/lib/referencia.ts`).

Es decir: **"qué credencial pertenece a qué equipo" ya está modelado y no se duplica**. La grieta es otra.

### 1.2 Dónde está la duplicidad real

La grieta está dentro del bloque cifrado. `DatosCredencial` (`src/features/boveda/sesionBoveda.ts:39`) es:

```ts
{ usuario, contrasena, ip, url, notas, extras }
```

El campo `ip` es la duplicación exacta que describe el usuario: la IP del equipo, re-escrita dentro del secreto, cifrada, invisible para la búsqueda y para cualquier validación. Si la impresora cambia de IP, `dispositivos.ip` se actualiza y la copia dentro de la credencial queda mintiendo, sin que nada lo detecte.

Y hay algo que lo INVITA activamente: el preset "Equipo o servicio" del editor (`CredencialForm.tsx:42`):

```ts
equipo: { usuario: true, contrasena: true, ip: true, url: false, extras: true }
```

La hoja "Crear" de la Bóveda (`BovedaPage.tsx:108`) lo ofrece como primera opción con el texto "Usuario y contraseña de un dispositivo o panel". La app está enseñando al equipo a crear fichas paralelas de equipos dentro de la Bóveda. Eso es lo que hay que eliminar.

Resumen honesto: el problema no es que falte el vínculo, es que **la Bóveda puede representar un equipo entero (título, categoría, IP) en vez de referenciarlo**.

### 1.3 Restricción de seguridad que condiciona todo el diseño

Esta es la conclusión más importante del análisis y determina dónde pueden vivir los datos protegidos de un equipo.

La bóveda tiene dos capas (ARQUITECTURA.md sección 8):

1. **RLS por permiso**: `credenciales_acceso` en `supabase/schema.sql:529` exige `puede_ver_boveda()`. Un técnico sin permiso ni siquiera descarga las filas cifradas.
2. **Cifrado con contraseña maestra** (AES-256-GCM + PBKDF2 600k).

Pero desde la decisión del 2026-07-17, la contraseña maestra **la conoce todo el equipo**: autoriza las eliminaciones sensibles y `boveda_meta_lectura` entrega el verificador a cualquier técnico autenticado (`schema.sql:549`). Por lo tanto:

> Hoy la única barrera real entre un técnico sin permiso de bóveda y un secreto es la RLS, no el cifrado.

Consecuencia directa: **NO se pueden guardar los campos protegidos como una columna cifrada dentro de `dispositivos`**. La política `dispositivos_acceso` (`schema.sql:516`) deja leer esa tabla a cualquier autenticado; un técnico sin permiso de bóveda descargaría el bloque cifrado y, sabiendo la contraseña maestra (que puede saber legítimamente), lo abriría. Sería una regresión de seguridad silenciosa.

Por eso la propuesta usa una tabla propia con RLS de bóveda, no una columna en `dispositivos`. Esto contradice el borrador del encargo ("Device -> protected_fields" dentro de la ficha), y es deliberado: el dato se PRESENTA dentro de la ficha del equipo, pero se ALMACENA con la protección de la bóveda.

### 1.4 Otros hallazgos del recorrido

- **Vínculo de pasos rígido**: `PasoProcedimiento.credencialId` y `BloquePaso.credencialId` (`src/lib/db.ts:144` y `db.ts:117`) apuntan solo a una credencial. Para "Vincular información protegida" hace falta un vínculo polimórfico.
- **`historial` ya tiene filtro de bóveda**: `historial_lectura` (`schema.sql:560`) usa `entidad_tipo <> 'credencial' or puede_ver_boveda()`. Un tipo nuevo debe entrar en esa condición o filtraría cambios de secretos.
- **`accesos_boveda` está atado a `credencial_id`** (`schema.sql:292`): para auditar campos protegidos necesita generalizarse.
- **Las ubicaciones no están en el buscador**: `useIndiceBusqueda.ts` indexa categorías, artículos, dispositivos, credenciales, diagnósticos y adjuntos, pero no `ubicaciones`, que es entidad desde N3. El punto 4 de validaciones del encargo ("mantener búsqueda por ubicación") es un hueco real y barato de cerrar.
- **Renombrar la tabla `credenciales` es caro**: el nombre está en `tablas.ts`, `schema.sql` (tabla, índices, triggers, 4 políticas RLS, publicación realtime), `grafo.ts`, `useIndiceBusqueda.ts`, `db.ts` (Dexie), `scripts/respaldo-supabase.sh`, y sobre todo dentro del JSON `procedimiento` de CADA artículo (`credencialId`, `credencialTitulo`). No es un rename de tabla, es una migración de datos embebidos.

---

## 2. Modelo de datos propuesto

### 2.1 Entidad nueva: `campos_protegidos`

Una fila por campo protegido de un equipo. Una fila por campo (y no un solo bloque por equipo) porque el encargo pide historial de cambios POR campo y vincular un campo concreto desde un paso ("🔒 Contraseña administrador del dispositivo").

```sql
create table if not exists public.campos_protegidos (
  id uuid primary key,
  dispositivo_id uuid,               -- null permitido: campo protegido sin equipo (futuro)
  nombre text not null,              -- "Usuario administrador", "PIN de impresión"
  tipo text not null default 'texto',-- usuario | contrasena | pin | llave | token | texto
  valor_cifrado text not null,       -- bloque v1.<iter>.<salt>.<iv>.<datos> de crypto.ts
  orden int not null default 0,
  updated_at timestamptz, updated_by uuid, eliminado_en timestamptz
);
```

- RLS idéntica a `credenciales`: `using (public.puede_ver_boveda())`. Es la pieza clave del punto 1.3.
- Sin FK a `dispositivos` (mismo criterio que `accesos_boveda`, `schema.sql:289`): la app es offline primero y las filas pueden llegar desordenadas.
- `nombre` y `tipo` van SIN cifrar, igual que `credenciales.vence_en` y `credenciales.dispositivos`: saber que un equipo tiene un campo "PIN de impresión" no es el secreto, y permite listar, buscar y vincular sin desbloquear la bóveda. Solo `valor_cifrado` es el secreto.
- Se cifra con el mismo `cifrarTexto` de `src/lib/crypto.ts`, con la clave principal de la sesión de bóveda. Cero criptografía nueva.
- Dexie: versión 12, `campos_protegidos: 'id, dispositivoId, updatedAt'`.
- Sincronización: entra al final de `TABLAS_SINCRONIZADAS` (`src/lib/tablas.ts:21`), como se hizo con `ubicaciones`, para que un esquema sin aplicar no rompa la descarga del resto.

### 2.2 Cambios en `credenciales` (la Bóveda)

**Recomendación: NO renombrar la tabla.** Se renombra en la interfaz a "Secretos" y se agrega una columna de tipo:

```sql
alter table public.credenciales add column if not exists tipo text not null default 'cuenta';
-- cuenta | red | llave | archivo | nota
```

Motivo: el rename real obliga a reescribir el JSON `procedimiento` de todos los artículos y a tocar el script de respaldo, la RLS y la publicación de realtime, sin ganar ni un dato nuevo. El nombre de una tabla interna no es lo que el usuario ve. Si aun así se quiere el rename, es una fase propia con migración y verificación aparte (ver decisión 2 en la sección 6).

Y se elimina `ip` de `DatosCredencial`. Las credenciales viejas que traigan una IP dentro del bloque cifrado se muestran como campo heredado de solo lectura, con la sugerencia de vincular el equipo y quitar el dato. No se puede migrar desde el servidor: está cifrado y solo el cliente puede abrirlo.

### 2.3 Vínculo polimórfico en pasos y tareas

En vez de `credencialId` a secas, un vínculo que sepa a qué apunta:

```ts
interface VinculoProtegido {
  tipo: 'credencial' | 'campo'
  id: string
  titulo: string   // copia de referencia, como todo el resto del sistema
}
```

Se agrega a `PasoProcedimiento` y a `BloquePaso` como `vinculoProtegido: VinculoProtegido | null`. Los campos viejos `credencialId`/`credencialTitulo` se siguen leyendo: `normalizarPaso` (`src/lib/procedimiento.ts:122`) y `normalizarBloque` (`procedimiento.ts:232`) los convierten al vuelo a `{tipo:'credencial', ...}`, exactamente el mismo patrón con el que ya se migraron `instrucciones` a bloques e `imagen` a `adjuntos`. **Cero migración de datos, cero riesgo sobre los artículos existentes.**

`src/features/boveda/CredencialEnPaso.tsx` pasa a aceptar los dos tipos: mismo aspecto, mismo candado, mismo desbloqueo, mismo autobloqueo, misma auditoría.

### 2.4 Historial y auditoría

- `historial.entidad_tipo` suma `'campo_protegido'`, y la política `historial_lectura` (`schema.sql:560`) pasa a `entidad_tipo not in ('credencial','campo_protegido') or public.puede_ver_boveda()`. Sin esto, los cambios de un campo protegido se filtrarían a técnicos sin permiso.
  El valor nunca entra al historial: se registra `(cifrado)`, igual que ya hace `credenciales.datosCifrados` (ver `CredencialPage.tsx:590`).
- `accesos_boveda` suma `entidad_tipo text not null default 'credencial'` y reutiliza `credencial_id`/`credencial_titulo` como id y título del objetivo. Es la opción más barata que no rompe nada (una columna, sin renames, compatible con las filas existentes). El nombre de columna queda un poco impreciso; se documenta y se acepta, o se renombra en un lote futuro.
- El feed "Actividad del equipo" de Inicio (`actividadEquipo.ts`) debe EXCLUIR los campos protegidos, por el mismo motivo por el que ya excluye las credenciales: Inicio no tiene lectura condicional por permiso.

---

## 3. Cambios por pantalla

### 3.1 Dispositivos

**`DispositivoPage.tsx`**: sección nueva "Seguridad" entre "Información" y "Resolver con este equipo". Solo visible con `puedeVerBoveda` (si no, ni siquiera se insinúa que existe, mismo criterio que `CredencialesDelEquipo`). Reutiliza el patrón visual ya existente de `CredencialEnPaso`: borde discontinuo, candado, rótulo "Datos protegidos". Cada campo con mostrar/ocultar y copiar, apoyado en `CampoSecreto`, que ya registra la copia en la auditoría.

**`DispositivoForm.tsx`**: bloque "Seguridad" para agregar, editar y quitar campos protegidos, con `CampoContrasena` (nunca `type="password"`, regla de ARQUITECTURA.md sección 14, para que el llavero del teléfono no capture el secreto). Si la bóveda está bloqueada, el bloque pide la contraseña maestra en línea, igual que `CredencialEnPaso`.

**`completitud.ts`**: NO se toca. Un equipo sin campos protegidos no está incompleto.

### 3.2 Bóveda

- `BovedaPage.tsx`: la hoja "Crear" pierde "Equipo o servicio" y pasa a los cinco tipos del encargo: Cuenta de sistema, Red, Llave digital, Archivo seguro, Nota segura. Título de la sección y textos: "Secretos".
- `CredencialForm.tsx`: `CAMPOS_POR_TIPO` se rehace para los cinco tipos, sin campo IP. El tipo pasa de parámetro de URL a columna guardada.
- Nudge anti duplicidad: si el título de un secreto coincide con el nombre de un equipo del inventario, se ofrece "¿Esto pertenece a un equipo? Guárdalo en su ficha", con un botón que lleva a crear el campo protegido en ese equipo.
- `CredencialPage.tsx`: sin cambios estructurales; el campo IP heredado se muestra con su aviso.

### 3.3 Soluciones (procedimientos)

- `PasosEditor.tsx`: el selector de credencial pasa a "Vincular información protegida", con dos grupos en la lista: campos protegidos de los equipos vinculados al artículo (`dispositivosAfectados`) primero, y secretos globales después. Es el flujo exacto del ejemplo del encargo.
- `ProcedimientoVista.tsx` y `AsistenteVista.tsx`: sin cambios, porque el render del vínculo está encapsulado en `CredencialEnPaso`.

### 3.4 Grafo, búsqueda y eliminación

- `grafo.ts`: tipo de entidad nuevo `campo_protegido` y relaciones `campo_paso`/`campo_tarea`. Con eso, gratis: `ReferenciadoPor` ("usado en N procedimientos") y `resumenImpacto` en el diálogo de eliminación.
- `useIndiceBusqueda.ts`: se indexan los campos protegidos **solo por nombre y equipo, nunca por valor**, y solo con la bóveda desbloqueada. Se agregan también las `ubicaciones`, que hoy faltan (punto 4 del encargo).

---

## 4. Validaciones del encargo, punto por punto

| Regla pedida | Cómo se cumple |
|---|---|
| 1. No permitir IP duplicada entre dispositivo y bóveda | El campo IP desaparece del editor de secretos: deja de ser posible por construcción. Además, aviso en `DispositivoForm` cuando otra ficha ya usa esa IP, con enlace al equipo. Aviso, no bloqueo: la base local puede no conocer todavía a todos los equipos (offline primero). |
| 2. No permitir secretos de tipo "equipo" | Se elimina el preset y el tipo. El nudge redirige a la ficha del equipo. |
| 3. Mostrar claramente qué está protegido | Se reutiliza el patrón visual ya existente (borde discontinuo + candado + "Datos protegidos"), en vez de inventar uno nuevo. |
| 4. Búsqueda por dispositivo, procedimiento, secreto y ubicación | Los tres primeros ya existen; se suma ubicación y el nombre (nunca el valor) de los campos protegidos. |

---

## 5. Plan por fases

Cada fase es una tarea del tablero, verificable y desplegable por separado. El orden está pensado para que lo que frena la duplicidad llegue primero y lo que toca esquema vaya agrupado.

- **Fase P0 (sin esquema, pequeña). HECHA (tarea 115, 2026-07-21).** Se quitó el preset "Equipo o servicio" y el campo IP editable del editor de la Bóveda (`CredencialForm.tsx`, `BovedaPage.tsx`); las credenciales de equipo ya guardadas conservan su IP como dato heredado (aviso con botón "Quitar" en el editor, nota en la ficha), sin poder crearse de nuevo. Renombre a "Secretos" en todos los textos visibles de la Bóveda (`CredencialForm.tsx`, `CredencialPage.tsx`, `CredencialEnPaso.tsx`, `DispositivoPage.tsx`, `lineaDeTiempo.ts`, `resumenProcedimiento.ts`, `plantillas.ts`, `descripcionCambio.ts`), sin tocar identificadores de código ni el nombre de la tabla. 510 pruebas, typecheck (`tsc -b`) y build en verde. Es el freno inmediato: a partir de aquí no se crean equipos nuevos dentro de la Bóveda.
- **Fase P1 (esquema, la principal). HECHA (tarea 116, 2026-07-21).** Tabla `campos_protegidos` + RLS + sync + Dexie 12 + `historial.entidad_tipo` + `accesos_boveda.entidad_tipo` + `credenciales.tipo`, en un solo grupo de esquema. Sección "Seguridad" en la ficha del dispositivo (`SeguridadDelEquipo.tsx`), con historial y auditoría por campo. Dos desvíos respecto a lo propuesto aquí, ambos deliberados: (1) la edición vive solo en la FICHA, no en `DispositivoForm`, por coherencia con `Adjuntos`/`ConexionesFicha` y porque guardar un campo exige la bóveda abierta, que no debe condicionar el guardado de una ficha normal; (2) el historial de un campo cuelga de `'campo_protegido'` y no del dispositivo, que resultó ser un requisito de seguridad y no una preferencia (las entradas de `'dispositivo'` las lee todo el equipo). Pendiente de que el usuario aplique `schema.sql` en Supabase. Hueco conocido que hereda P2: eliminar un equipo deja sus campos protegidos huérfanos; se cierra al sumarlos al grafo.
- **Fase P2 (sin esquema). HECHA (tarea 117, 2026-07-21).** Vínculo polimórfico `VinculoProtegido` en pasos y tareas, con normalización compatible hacia atrás (cero migración de artículos existentes). "Vincular información protegida" en `PasosEditor.tsx`, con los campos protegidos de los equipos vinculados primero y los secretos globales después. Grafo (`campo_protegido`, `campo_paso`/`campo_tarea`/`campo_dispositivo`) y aviso de impacto antes de eliminar, tanto para un campo protegido como para el dispositivo dueño. Verificado en navegador real que cierra el hueco de P1: eliminar un equipo con datos protegidos ahora avisa "Se usa en N datos protegidos".
- **Fase P3 (sin esquema).** Los cinco tipos de secreto con sus campos, validaciones y nudge anti duplicidad. Ubicaciones y campos protegidos en el buscador.
- **Fase P4 (migración asistida).** Pantalla que detecta las credenciales que en realidad son de un equipo (vinculadas a un solo dispositivo, o con una IP que coincide con la de un equipo) y ofrece moverlas a su ficha. Idempotente y con informe previo, mismo espíritu que `MigracionUbicaciones.tsx` y que el script de huérfanos de Storage.
- **Fase P5 (opcional, la más cara).** Tipo "Archivo seguro". Ver la advertencia de abajo.

### Advertencia sobre "Archivo seguro"

Es el punto más caro del encargo y conviene decidirlo aparte. Hoy el bucket `adjuntos` lo lee cualquier usuario autenticado (`adjuntos_storage_lectura`, `schema.sql:611`). Un archivo verdaderamente seguro exige una de dos cosas:

- Cifrar el binario en el cliente antes de subirlo. `crypto.ts` hoy trabaja sobre texto: haría falta una variante binaria, más el descifrado al abrir, más su encaje con el cache offline y la cola de subida.
- O un bucket aparte con políticas propias de bóveda.

Cualquiera de las dos es una tarea entera por sí sola. Recomendación: dejarla fuera de este lote y decidirla cuando el resto esté en uso.

---

## 6. Decisiones del usuario (RESUELTAS el 2026-07-21)

Las cuatro se resolvieron con la opción recomendada, así que el plan de la sección 5 queda firme tal como está escrito:

1. **Granularidad de los campos protegidos**: una fila por campo. Se construye la tabla `campos_protegidos` de la sección 2.1, con historial y vínculo por campo.
2. **Renombre a "Secretos"**: solo en la interfaz. La tabla sigue llamándose `credenciales` y el JSON `procedimiento` de los artículos no se toca.
3. **"Archivo seguro"**: fuera de este lote. La fase P5 queda anotada pero no se agenda; se decide cuando el resto esté en uso real.
4. **Credenciales de equipo existentes**: pantalla asistida (fase P4), idempotente y con informe previo.

Pendiente: confirmación del usuario para empezar a implementar, y en qué fase arrancar. Nada de esto se escribe hasta entonces.
