-- ================================================================
-- Soluciones IT: esquema de base de datos y politicas de seguridad
--
-- Como aplicarlo: Supabase Dashboard > SQL Editor > New query,
-- pegar este archivo completo y presionar Run.
-- Se puede ejecutar varias veces sin causar errores.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Tablas
-- ----------------------------------------------------------------

-- Perfil de cada tecnico. Se crea automaticamente al dar de alta
-- un usuario en Authentication. El permiso puede_ver_boveda solo
-- se cambia desde el panel de Supabase o el SQL Editor.
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  correo text not null default '',
  puede_ver_boveda boolean not null default false,
  creado_en timestamptz not null default now()
);

-- es_red marca las categorias de infraestructura de red (racks,
-- puntos de red, switches, access points, camaras): sus dispositivos
-- se muestran en la seccion Red en vez de Dispositivos.
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  icono text not null default '',
  orden integer not null default 0,
  es_red boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- Por si la tabla ya existia de una version anterior del esquema.
alter table public.categorias add column if not exists es_red boolean not null default false;

-- procedimiento guarda el modo "paso a paso" opcional de un articulo:
-- un objeto JSON con requisitos previos y pasos numerados (cada paso
-- con titulo, detalle, captura, nota, advertencia, consejo y decision).
create table if not exists public.articulos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id),
  titulo text not null,
  tipo text not null check (tipo in ('instalacion', 'configuracion', 'conexion', 'problema_frecuente', 'mantenimiento', 'manual')),
  contenido text not null default '',
  etiquetas text[] not null default '{}',
  procedimiento jsonb,
  es_ruta_inicio boolean not null default false,
  -- Estructura de una incidencia (tarea 38): solo tiene sentido con
  -- tipo 'problema_frecuente'. dispositivos_afectados guarda
  -- {id, nombre} por dispositivo (mismo patron de copia de referencia
  -- que origen_nombre/destino_nombre en conexiones).
  sintomas text[] not null default '{}',
  causas text[] not null default '{}',
  dispositivos_afectados jsonb not null default '[]'::jsonb,
  -- Estado del documento (fase de esquema agrupado, 2026-07-09):
  -- 'publicado' por defecto para que todo lo existente quede oficial
  -- sin migracion. Un borrador u obsoleto no se ofrece en el buscador
  -- global, las rutas de inicio, los vinculables ni el Diagnostico
  -- (salvo para quien lo edita). Se decidieron 3 estados (sin "en
  -- revision"): un equipo de 5 no tiene hoy un flujo de aprobacion
  -- real detras de ese paso.
  estado text not null default 'publicado' check (estado in ('borrador', 'publicado', 'obsoleto')),
  -- Version legible ("1.0", "1.1", "2.0"): sube la menor en cada
  -- guardado sobre un articulo ya publicado, o la mayor si el usuario
  -- marca "Cambio mayor". El historial de cada guardado YA conserva el
  -- contenido completo de cada version; esto es solo la etiqueta.
  version text not null default '1.0',
  -- Otros articulos relacionados (punto 11): lista {id, titulo}, mismo
  -- patron de copia de referencia que dispositivos_afectados.
  relacionados jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- Por si la tabla ya existia de una version anterior del esquema.
alter table public.articulos add column if not exists procedimiento jsonb;
-- Destaca el articulo en Inicio como "ruta de inicio" para quien
-- recien llega al equipo (tarea 37). El equipo lo marca a mano desde
-- el editor; no crea una seccion nueva.
alter table public.articulos add column if not exists es_ruta_inicio boolean not null default false;
-- Estructura de una incidencia (tarea 38).
alter table public.articulos add column if not exists sintomas text[] not null default '{}';
alter table public.articulos add column if not exists causas text[] not null default '{}';
alter table public.articulos add column if not exists dispositivos_afectados jsonb not null default '[]'::jsonb;
-- Estado, version y relacionados (grupo de esquema, 2026-07-09).
alter table public.articulos add column if not exists estado text not null default 'publicado';
alter table public.articulos drop constraint if exists articulos_estado_check;
alter table public.articulos add constraint articulos_estado_check
  check (estado in ('borrador', 'publicado', 'obsoleto'));
alter table public.articulos add column if not exists version text not null default '1.0';
alter table public.articulos add column if not exists relacionados jsonb not null default '[]'::jsonb;

create table if not exists public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id),
  nombre text not null,
  marca text not null default '',
  modelo text not null default '',
  serial text not null default '',
  placa_inventario text not null default '',
  ubicacion text not null default '',
  ip text not null default '',
  estado text not null default '',
  observaciones text not null default '',
  detalles jsonb not null default '{}'::jsonb,
  -- Fotografia principal del equipo (fase Dis2, mismo formato que la
  -- portada de un procedimiento: solo referencia de Storage, nombre y
  -- tipo; el contenido viaja por la cola de subida de adjuntos).
  foto jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- Por si la tabla ya existia de una version anterior del esquema.
alter table public.dispositivos add column if not exists foto jsonb;

-- Relacion documentada entre dos dispositivos (el mapa de la red).
-- - 'enlace': cable o señal de origen a destino. El origen es el lado
--   que da servicio (switch, router) y el destino el que lo recibe.
-- - 'instalacion': el origen esta instalado dentro del destino (un
--   switch dentro de un rack).
-- origen_nombre y destino_nombre son copias de referencia del nombre
-- del dispositivo para poder mostrar la conexion aunque la ficha del
-- otro extremo aun no haya sincronizado.
create table if not exists public.conexiones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('enlace', 'instalacion')),
  origen_id uuid not null references public.dispositivos (id),
  origen_nombre text not null default '',
  origen_puerto text not null default '',
  destino_id uuid not null references public.dispositivos (id),
  destino_nombre text not null default '',
  destino_puerto text not null default '',
  medio text not null default '',
  notas text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- datos_cifrados llega siempre cifrado con AES-256-GCM desde la app.
-- El servidor nunca ve contrasenas en texto plano.
create table if not exists public.credenciales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null default '',
  datos_cifrados text not null,
  -- Fecha de vencimiento opcional (fase B2): a proposito NO va cifrada,
  -- para poder avisar antes de vencer o alertar al vencer sin
  -- necesidad de desbloquear la boveda.
  vence_en date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- Por si la tabla ya existia de una version anterior del esquema.
alter table public.credenciales add column if not exists vence_en date;

-- Verificador de la contrasena maestra de la boveda. Guarda UN solo
-- registro: un texto fijo cifrado con la clave derivada de la
-- contrasena maestra (AES-256-GCM). La contrasena en si nunca llega
-- al servidor; el verificador solo permite comprobar, en cualquier
-- dispositivo, si la contrasena escrita es la correcta. Mientras esta
-- fila exista, la app jamas ofrece crear una contrasena maestra nueva
-- (borrar cache, cambiar de telefono o vaciar las credenciales no la
-- resetean). Restablecerla exige borrar esta fila desde este panel:
-- ver supabase/INSTRUCCIONES.md.
create table if not exists public.boveda_meta (
  id text primary key check (id = 'principal'),
  verificador text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- Historial inmutable: solo se insertan filas, nunca se editan ni
-- se borran. Para credenciales, valor_anterior y valor_nuevo llegan
-- cifrados desde la app. fecha_hora es el momento real del cambio
-- (puede ser antiguo si se hizo sin internet); recibido_en es el
-- momento en que llego al servidor y es la columna que usa la
-- sincronizacion para saber que hay de nuevo.
create table if not exists public.historial (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null check (entidad_tipo in ('categoria', 'articulo', 'dispositivo', 'credencial')),
  entidad_id uuid not null,
  usuario uuid references auth.users (id),
  usuario_nombre text not null default '',
  fecha_hora timestamptz not null default now(),
  recibido_en timestamptz not null default now(),
  campo text not null,
  valor_anterior text not null default '',
  valor_nuevo text not null default '',
  motivo text not null default ''
);

-- Por si la tabla ya existia de una version anterior del esquema.
alter table public.historial add column if not exists recibido_en timestamptz not null default now();

create table if not exists public.adjuntos (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null check (entidad_tipo in ('articulo', 'dispositivo', 'historial')),
  entidad_id uuid not null,
  nombre text not null,
  tipo text not null default '',
  referencia text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- Por si la tabla ya existia con la restriccion anterior: 'historial'
-- es la foto opcional de una intervencion manual (tarea 36), donde
-- entidad_id apunta al id de la entrada de historial.
alter table public.adjuntos drop constraint if exists adjuntos_entidad_tipo_check;
alter table public.adjuntos add constraint adjuntos_entidad_tipo_check
  check (entidad_tipo in ('articulo', 'dispositivo', 'historial'));

-- Modo Diagnostico Inteligente (tarea 46): arboles de decision que
-- parten del problema ("La impresora no imprime") y guian al tecnico
-- con preguntas simples hasta la solucion, reutilizando los articulos
-- con procedimiento como bloques. `nodos` guarda el arbol como JSON
-- (cada nodo: pregunta, descripcion y opciones; cada opcion puede
-- continuar en otro nodo, ejecutar un articulo por referencia o
-- terminar con un mensaje). El primer nodo de la lista es el inicial.
create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id),
  titulo text not null,
  descripcion text not null default '',
  nodos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

-- Registro inmutable de diagnosticos terminados o abandonados (solo
-- se insertan filas, como el historial): problema, camino de
-- respuestas, procedimientos ejecutados, si quedo resuelto, duracion
-- y quien lo hizo. Base de las estadisticas futuras. Sin FK a
-- diagnosticos a proposito (mismo criterio que historial.entidad_id):
-- el registro nunca debe rechazarse por el estado de otra tabla.
create table if not exists public.ejecuciones_diagnostico (
  id uuid primary key default gen_random_uuid(),
  diagnostico_id uuid not null,
  diagnostico_titulo text not null default '',
  usuario uuid references auth.users (id),
  usuario_nombre text not null default '',
  camino jsonb not null default '[]'::jsonb,
  articulos_ejecutados jsonb not null default '[]'::jsonb,
  resuelto text not null check (resuelto in ('si', 'no', 'abandonado')),
  duracion_segundos integer not null default 0,
  fecha_hora timestamptz not null default now(),
  recibido_en timestamptz not null default now(),
  -- Motivo de la retroalimentacion cuando "no" quedo resuelto (fase
  -- D3): lista corta + libre. solucion_propuesta solo tiene contenido
  -- cuando motivo es 'encontro_otra_solucion': texto libre del tecnico
  -- para que quien mantiene la base lo revise y lo convierta en un
  -- articulo si aplica. Sin FK ni tabla de sugerencias aparte: se
  -- consulta filtrando esta misma tabla.
  motivo text not null default '' check (motivo in ('', 'no_funciono', 'no_encontro_problema', 'faltan_pasos', 'encontro_otra_solucion', 'otro')),
  solucion_propuesta text not null default ''
);

-- Por si la tabla ya existia de una version anterior del esquema.
alter table public.ejecuciones_diagnostico add column if not exists motivo text not null default '';
alter table public.ejecuciones_diagnostico drop constraint if exists ejecuciones_diagnostico_motivo_check;
alter table public.ejecuciones_diagnostico add constraint ejecuciones_diagnostico_motivo_check
  check (motivo in ('', 'no_funciono', 'no_encontro_problema', 'faltan_pasos', 'encontro_otra_solucion', 'otro'));
alter table public.ejecuciones_diagnostico add column if not exists solucion_propuesta text not null default '';

-- El historial ahora tambien registra cambios de diagnosticos.
alter table public.historial drop constraint if exists historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('categoria', 'articulo', 'dispositivo', 'credencial', 'diagnostico', 'ubicacion'));

-- Auditoria de la boveda (fase B3): registro inmutable (solo
-- insercion, mismo patron que historial/ejecuciones_diagnostico) de
-- quien consulto, mostro o copio una credencial, y de cuando se
-- modifico o elimino. Es trazabilidad de buena fe del equipo (se
-- registra desde el cliente al momento de la accion; no detiene a
-- quien ya tiene la contrasena maestra), y asi se presenta en la app.
-- Sin FK a credenciales a proposito (mismo criterio que
-- historial.entidad_id): el registro nunca debe rechazarse por el
-- estado de otra tabla.
create table if not exists public.accesos_boveda (
  id uuid primary key default gen_random_uuid(),
  credencial_id uuid not null,
  credencial_titulo text not null default '',
  usuario uuid references auth.users (id),
  usuario_nombre text not null default '',
  accion text not null check (accion in ('consulto', 'mostro', 'copio_usuario', 'copio_contrasena', 'modifico', 'elimino')),
  fecha_hora timestamptz not null default now(),
  recibido_en timestamptz not null default now()
);

-- Indices para la sincronizacion (consultas por updated_at) y las
-- consultas mas frecuentes.
create index if not exists idx_categorias_updated on public.categorias (updated_at);
create index if not exists idx_articulos_updated on public.articulos (updated_at);
create index if not exists idx_articulos_categoria on public.articulos (categoria_id);
create index if not exists idx_dispositivos_updated on public.dispositivos (updated_at);
create index if not exists idx_dispositivos_categoria on public.dispositivos (categoria_id);
create index if not exists idx_conexiones_updated on public.conexiones (updated_at);
create index if not exists idx_conexiones_origen on public.conexiones (origen_id);
create index if not exists idx_conexiones_destino on public.conexiones (destino_id);
create index if not exists idx_credenciales_updated on public.credenciales (updated_at);
create index if not exists idx_historial_entidad on public.historial (entidad_tipo, entidad_id);
create index if not exists idx_historial_fecha on public.historial (fecha_hora);
create index if not exists idx_historial_recibido on public.historial (recibido_en);
create index if not exists idx_adjuntos_updated on public.adjuntos (updated_at);
create index if not exists idx_adjuntos_entidad on public.adjuntos (entidad_tipo, entidad_id);
create index if not exists idx_diagnosticos_updated on public.diagnosticos (updated_at);
create index if not exists idx_diagnosticos_categoria on public.diagnosticos (categoria_id);
create index if not exists idx_ejecuciones_recibido on public.ejecuciones_diagnostico (recibido_en);
create index if not exists idx_ejecuciones_diagnostico on public.ejecuciones_diagnostico (diagnostico_id);
create index if not exists idx_accesos_boveda_recibido on public.accesos_boveda (recibido_en);
create index if not exists idx_accesos_boveda_credencial on public.accesos_boveda (credencial_id);

-- ----------------------------------------------------------------
-- 1b. Grupo de esquema N3 (2026-07-17): ubicacion como entidad,
--     vinculo credencial<->dispositivo, orden de rutas de inicio,
--     color de categoria y relaciones entre equipos no-red.
--     Decisiones en PROPUESTA_BASE_CONOCIMIENTO.md seccion 12.
-- ----------------------------------------------------------------

-- Ubicacion como entidad (antes era texto libre en dispositivos): con
-- jerarquia opcional por padre_id (Sede > Area > Punto), sin obligacion
-- de usarla. dispositivos.ubicacion (texto) se conserva como copia de
-- referencia, misma regla que el resto de vinculos del sistema.
create table if not exists public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  padre_id uuid references public.ubicaciones (id),
  notas text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

alter table public.dispositivos add column if not exists ubicacion_id uuid references public.ubicaciones (id);

-- Vinculo credencial -> dispositivos a los que da acceso (lista
-- {id, nombre} como copia de referencia). NO cifrado a proposito (como
-- vence_en): que credencial pertenece a que equipo no es el secreto; el
-- contenido sigue cifrado y la tabla credenciales ya esta protegida por
-- la RLS de boveda. Permite el inverso "credenciales de este equipo"
-- sin desbloquear la boveda.
alter table public.credenciales add column if not exists dispositivos jsonb not null default '[]'::jsonb;

-- Orden de las rutas de inicio ("Para empezar"): columna, no JSON,
-- porque es_ruta_inicio aplica a cualquier articulo (incluidos los
-- manuales sin procedimiento).
alter table public.articulos add column if not exists orden_ruta_inicio integer not null default 0;

-- Color de identidad de la categoria (override manual, opcional). Si es
-- null, la app lo deriva del orden (ver PROPUESTA_REVISION_ARQUITECTURA.md).
alter table public.categorias add column if not exists color text;

-- Conexiones: sumar el tipo 'relacionado' (relacionar dos equipos que
-- no son de red, por ejemplo un POS con su impresora). Sin puertos ni
-- medio; aparece en ambas fichas, no en la topologia (no es dependencia
-- de servicio).
alter table public.conexiones drop constraint if exists conexiones_tipo_check;
alter table public.conexiones add constraint conexiones_tipo_check
  check (tipo in ('enlace', 'instalacion', 'relacionado'));

create index if not exists idx_ubicaciones_updated on public.ubicaciones (updated_at);
create index if not exists idx_ubicaciones_padre on public.ubicaciones (padre_id);
create index if not exists idx_dispositivos_ubicacion on public.dispositivos (ubicacion_id);

-- ----------------------------------------------------------------
-- 1c. Grupo de esquema P1 (2026-07-21): campos protegidos del
--     dispositivo. Corrige la duplicidad Dispositivos/Boveda: los
--     datos sensibles PROPIOS de un equipo (usuario administrador,
--     contrasena, PIN) dejan de guardarse como una credencial aparte
--     que replica la identidad del equipo, y pasan a colgar del
--     dispositivo. Decisiones en PROPUESTA_SEGURIDAD_DISPOSITIVO.md
--     seccion 6.
-- ----------------------------------------------------------------

-- Un campo protegido por fila (decision 1 del usuario): asi cada dato
-- tiene su propio historial de cambios y puede vincularse por separado
-- desde un paso de procedimiento ("Contrasena administrador de este
-- equipo"), cosa que un unico bloque cifrado por equipo no permitiria.
--
-- POR QUE UNA TABLA PROPIA Y NO UNA COLUMNA EN dispositivos:
-- la tabla dispositivos la puede leer cualquier tecnico autenticado
-- (politica dispositivos_acceso). Como desde el 2026-07-17 la
-- contrasena maestra la conoce todo el equipo (autoriza las
-- eliminaciones sensibles y boveda_meta entrega el verificador a
-- cualquier autenticado), la RLS es hoy la UNICA barrera real entre un
-- tecnico sin permiso de boveda y un secreto. Un bloque cifrado dentro
-- de dispositivos seria descargable por quien no debe verlo y abrible
-- con una contrasena que puede conocer legitimamente. Por eso esta
-- tabla lleva la misma RLS que credenciales.
--
-- nombre y tipo van SIN cifrar a proposito (mismo criterio que
-- credenciales.vence_en y credenciales.dispositivos): saber que un
-- equipo tiene un campo "PIN de impresion" no es el secreto, y permite
-- listar, buscar y vincular sin desbloquear la boveda. Solo
-- valor_cifrado es el secreto, y llega siempre cifrado con AES-256-GCM
-- desde la app (mismo formato v1.<iter>.<salt>.<iv>.<datos> que
-- credenciales.datos_cifrados).
--
-- Sin FK a dispositivos a proposito (mismo criterio que
-- historial.entidad_id y accesos_boveda.credencial_id): la app es
-- offline primero y las filas pueden llegar en cualquier orden.
-- dispositivo_id admite null para un campo protegido sin equipo.
create table if not exists public.campos_protegidos (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid,
  nombre text not null,
  tipo text not null default 'texto' check (tipo in ('usuario', 'contrasena', 'pin', 'llave', 'token', 'texto')),
  valor_cifrado text not null,
  orden integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

create index if not exists idx_campos_protegidos_updated on public.campos_protegidos (updated_at);
create index if not exists idx_campos_protegidos_dispositivo on public.campos_protegidos (dispositivo_id);

-- El historial ahora tambien registra cambios de campos protegidos.
-- Su lectura queda restringida a la boveda (ver historial_lectura mas
-- abajo): sin esto, los cambios de un campo protegido se filtrarian a
-- tecnicos sin permiso, que es justo lo que la tabla evita.
alter table public.historial drop constraint if exists historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('categoria', 'articulo', 'dispositivo', 'credencial', 'diagnostico', 'ubicacion', 'campo_protegido'));

-- La auditoria de la boveda pasa a cubrir dos clases de objetivo. Se
-- agrega entidad_tipo y se REUTILIZAN credencial_id/credencial_titulo
-- como id y titulo del objetivo, en vez de sumar dos columnas nuevas:
-- es compatible con las filas ya existentes (default 'credencial') y
-- no exige renombrar nada. El nombre de esas dos columnas queda algo
-- impreciso; se documenta aqui y se acepta a cambio de no migrar un
-- registro inmutable.
alter table public.accesos_boveda add column if not exists entidad_tipo text not null default 'credencial';
alter table public.accesos_boveda drop constraint if exists accesos_boveda_entidad_tipo_check;
alter table public.accesos_boveda add constraint accesos_boveda_entidad_tipo_check
  check (entidad_tipo in ('credencial', 'campo_protegido'));

-- Tipo de secreto de la boveda (fase P3: cuenta de sistema, red, llave
-- digital, archivo seguro, nota segura). La columna se agrega en este
-- mismo grupo para no exigir otra intervencion de esquema; su uso en la
-- interfaz llega en P3. Default 'cuenta' para que lo ya guardado quede
-- clasificado sin migracion. NO existe un tipo "equipo" a proposito:
-- los equipos son dispositivos, no secretos (validacion 2 del encargo).
alter table public.credenciales add column if not exists tipo text not null default 'cuenta';
alter table public.credenciales drop constraint if exists credenciales_tipo_check;
alter table public.credenciales add constraint credenciales_tipo_check
  check (tipo in ('cuenta', 'red', 'llave', 'archivo', 'nota'));

-- Archivo cifrado de un secreto tipo 'archivo' (fase P5, "Archivo
-- seguro"). jsonb EN CLARO (referencia, nombre, tipo MIME, tamaño):
-- mismo criterio que dispositivos.foto o campos_protegidos.nombre/tipo,
-- el contenido real vive cifrado en el bucket privado archivos_boveda
-- de Storage (seccion 4 mas abajo), nunca en esta columna.
alter table public.credenciales add column if not exists archivo jsonb;

-- 'descargo' (fase P5): descifrar y descargar un archivo seguro. Es
-- una accion propia porque ese tipo de secreto no tiene contraseña
-- que "mostrar"; reusar 'mostro' dejaria una etiqueta falsa en la
-- auditoria inmutable.
alter table public.accesos_boveda drop constraint if exists accesos_boveda_accion_check;
alter table public.accesos_boveda add constraint accesos_boveda_accion_check
  check (accion in ('consulto', 'mostro', 'copio_usuario', 'copio_contrasena', 'modifico', 'elimino', 'descargo'));

-- ----------------------------------------------------------------
-- 1d. Grupo de esquema T1 (2026-07-22): entidad Persona/Responsable.
--     El sujeto del escenario "llega una computadora para un empleado"
--     no existia en el modelo; "usuario asignado" era texto libre
--     suelto dentro de dispositivos.detalles, sin ficha propia ni
--     forma de responder "que equipos tiene esta persona". Mismo
--     patron exacto que ubicaciones (grupo N3): entidad + referencia
--     viva + copia de nombre. Decision del usuario (2026-07-22): sin
--     jerarquia (no aplica a personas) y solo nombre + notas.
--     Hallazgo T1 de AUDITORIA_FLUJOS_TI.md.
-- ----------------------------------------------------------------

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  notas text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

alter table public.dispositivos add column if not exists responsable_id uuid references public.personas (id);

create index if not exists idx_personas_updated on public.personas (updated_at);
create index if not exists idx_dispositivos_responsable on public.dispositivos (responsable_id);

-- El historial ahora tambien registra cambios de personas.
alter table public.historial drop constraint if exists historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('categoria', 'articulo', 'dispositivo', 'credencial', 'diagnostico', 'ubicacion', 'campo_protegido', 'persona'));

-- ----------------------------------------------------------------
-- 2. Funciones y triggers
-- ----------------------------------------------------------------

-- Mantiene updated_at y updated_by al dia en cada insercion o
-- edicion. El sello de tiempo lo pone siempre el servidor para que
-- la sincronizacion no dependa del reloj de cada telefono.
create or replace function public.registrar_modificacion()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_categorias_modificacion on public.categorias;
create trigger trg_categorias_modificacion
  before insert or update on public.categorias
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_articulos_modificacion on public.articulos;
create trigger trg_articulos_modificacion
  before insert or update on public.articulos
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_dispositivos_modificacion on public.dispositivos;
create trigger trg_dispositivos_modificacion
  before insert or update on public.dispositivos
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_conexiones_modificacion on public.conexiones;
create trigger trg_conexiones_modificacion
  before insert or update on public.conexiones
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_credenciales_modificacion on public.credenciales;
create trigger trg_credenciales_modificacion
  before insert or update on public.credenciales
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_boveda_meta_modificacion on public.boveda_meta;
create trigger trg_boveda_meta_modificacion
  before insert or update on public.boveda_meta
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_adjuntos_modificacion on public.adjuntos;
create trigger trg_adjuntos_modificacion
  before insert or update on public.adjuntos
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_diagnosticos_modificacion on public.diagnosticos;
create trigger trg_diagnosticos_modificacion
  before insert or update on public.diagnosticos
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_ubicaciones_modificacion on public.ubicaciones;
create trigger trg_ubicaciones_modificacion
  before insert or update on public.ubicaciones
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_campos_protegidos_modificacion on public.campos_protegidos;
create trigger trg_campos_protegidos_modificacion
  before insert or update on public.campos_protegidos
  for each row execute function public.registrar_modificacion();

drop trigger if exists trg_personas_modificacion on public.personas;
create trigger trg_personas_modificacion
  before insert or update on public.personas
  for each row execute function public.registrar_modificacion();

-- Crea el perfil automaticamente cuando se da de alta un usuario
-- en Authentication.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Indica si el usuario autenticado tiene acceso a la boveda.
create or replace function public.puede_ver_boveda()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select p.puede_ver_boveda from public.perfiles p where p.id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------
-- 3. Seguridad por filas (RLS)
-- ----------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.categorias enable row level security;
alter table public.articulos enable row level security;
alter table public.dispositivos enable row level security;
alter table public.conexiones enable row level security;
alter table public.credenciales enable row level security;
alter table public.boveda_meta enable row level security;
alter table public.historial enable row level security;
alter table public.adjuntos enable row level security;
alter table public.diagnosticos enable row level security;
alter table public.ejecuciones_diagnostico enable row level security;
alter table public.accesos_boveda enable row level security;
alter table public.ubicaciones enable row level security;
alter table public.campos_protegidos enable row level security;
alter table public.personas enable row level security;

-- Perfiles: todos los tecnicos autenticados pueden ver los nombres
-- del equipo. Nadie puede editar perfiles desde la app; el permiso
-- de la boveda se administra desde el panel de Supabase.
drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles
  for select to authenticated using (true);

-- Contenido general: acceso completo para cualquier tecnico
-- autenticado. Los usuarios anonimos no ven nada.
drop policy if exists categorias_acceso on public.categorias;
create policy categorias_acceso on public.categorias
  for all to authenticated using (true) with check (true);

drop policy if exists articulos_acceso on public.articulos;
create policy articulos_acceso on public.articulos
  for all to authenticated using (true) with check (true);

drop policy if exists dispositivos_acceso on public.dispositivos;
create policy dispositivos_acceso on public.dispositivos
  for all to authenticated using (true) with check (true);

drop policy if exists conexiones_acceso on public.conexiones;
create policy conexiones_acceso on public.conexiones
  for all to authenticated using (true) with check (true);

drop policy if exists adjuntos_acceso on public.adjuntos;
create policy adjuntos_acceso on public.adjuntos
  for all to authenticated using (true) with check (true);

-- Credenciales: solo los perfiles con puede_ver_boveda pueden
-- siquiera descargar los bloques cifrados.
drop policy if exists credenciales_acceso on public.credenciales;
create policy credenciales_acceso on public.credenciales
  for all to authenticated
  using (public.puede_ver_boveda())
  with check (public.puede_ver_boveda());

-- Campos protegidos de un dispositivo (grupo P1): EXACTAMENTE la misma
-- proteccion que credenciales. Es el motivo de que sean una tabla
-- propia y no una columna de dispositivos: aqui la RLS si puede exigir
-- el permiso de boveda. Un tecnico sin ese permiso no descarga ni
-- siquiera el nombre del campo, asi que la ficha del equipo ni le
-- insinua que existan datos protegidos.
drop policy if exists campos_protegidos_acceso on public.campos_protegidos;
create policy campos_protegidos_acceso on public.campos_protegidos
  for all to authenticated
  using (public.puede_ver_boveda())
  with check (public.puede_ver_boveda());

-- Verificador de la contrasena maestra: lo LEE cualquier tecnico
-- autenticado (decision del 2026-07-17), porque ademas de abrir la
-- boveda autoriza las eliminaciones sensibles en toda la app y esas
-- no exigen permiso de boveda. El verificador no revela ningun
-- secreto: es un texto fijo cifrado que solo permite comprobar si la
-- contrasena escrita es la correcta; las credenciales siguen
-- restringidas por su propia politica. Crear el verificador sigue
-- exigiendo permiso de boveda y solo es posible UNA vez (la clave
-- primaria fija impide una segunda fila). A proposito NO hay
-- politicas de UPDATE ni DELETE: desde la app nadie puede
-- reemplazarlo ni borrarlo, asi que restablecer la contrasena maestra
-- exige entrar a este panel con la cuenta de administrador
-- (validacion de identidad real).
drop policy if exists boveda_meta_lectura on public.boveda_meta;
create policy boveda_meta_lectura on public.boveda_meta
  for select to authenticated using (true);

drop policy if exists boveda_meta_creacion on public.boveda_meta;
create policy boveda_meta_creacion on public.boveda_meta
  for insert to authenticated with check (public.puede_ver_boveda());

-- Historial: se puede leer y agregar, nunca editar ni borrar.
-- Las entradas de credenciales y de campos protegidos solo las ven
-- los usuarios con acceso a la boveda: el historial de un campo
-- protegido nombra el dato ("PIN de impresion") y quien lo cambio, y
-- eso ya es informacion de la boveda aunque el valor nunca se guarde
-- aqui (el repositorio escribe "(cifrado)").
drop policy if exists historial_lectura on public.historial;
create policy historial_lectura on public.historial
  for select to authenticated
  using (entidad_tipo not in ('credencial', 'campo_protegido') or public.puede_ver_boveda());

drop policy if exists historial_insercion on public.historial;
create policy historial_insercion on public.historial
  for insert to authenticated with check (true);

-- Diagnosticos: acceso completo para cualquier tecnico autenticado,
-- como el resto del contenido general.
drop policy if exists diagnosticos_acceso on public.diagnosticos;
create policy diagnosticos_acceso on public.diagnosticos
  for all to authenticated using (true) with check (true);

-- Ubicaciones: acceso completo para cualquier tecnico autenticado, como
-- el resto del contenido general (categorias, dispositivos...).
drop policy if exists ubicaciones_acceso on public.ubicaciones;
create policy ubicaciones_acceso on public.ubicaciones
  for all to authenticated using (true) with check (true);

-- Personas: acceso completo para cualquier tecnico autenticado, mismo
-- criterio que ubicaciones (contenido general, no boveda).
drop policy if exists personas_acceso on public.personas;
create policy personas_acceso on public.personas
  for all to authenticated using (true) with check (true);

-- Ejecuciones de diagnostico: se pueden leer y agregar, nunca editar
-- ni borrar (registro inmutable, como el historial).
drop policy if exists ejecuciones_lectura on public.ejecuciones_diagnostico;
create policy ejecuciones_lectura on public.ejecuciones_diagnostico
  for select to authenticated using (true);

drop policy if exists ejecuciones_insercion on public.ejecuciones_diagnostico;
create policy ejecuciones_insercion on public.ejecuciones_diagnostico
  for insert to authenticated with check (true);

-- Accesos a la boveda: se pueden leer y agregar, nunca editar ni
-- borrar (registro inmutable, como el historial). Solo para quien
-- tiene permiso de boveda: es informacion sobre el uso de las
-- credenciales, tan sensible como ellas.
drop policy if exists accesos_boveda_lectura on public.accesos_boveda;
create policy accesos_boveda_lectura on public.accesos_boveda
  for select to authenticated using (public.puede_ver_boveda());

drop policy if exists accesos_boveda_insercion on public.accesos_boveda;
create policy accesos_boveda_insercion on public.accesos_boveda
  for insert to authenticated with check (public.puede_ver_boveda());

-- ----------------------------------------------------------------
-- 4. Almacenamiento de archivos (fotos, manuales, diagramas)
-- ----------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

drop policy if exists adjuntos_storage_lectura on storage.objects;
create policy adjuntos_storage_lectura on storage.objects
  for select to authenticated using (bucket_id = 'adjuntos');

drop policy if exists adjuntos_storage_subida on storage.objects;
create policy adjuntos_storage_subida on storage.objects
  for insert to authenticated with check (bucket_id = 'adjuntos');

drop policy if exists adjuntos_storage_edicion on storage.objects;
create policy adjuntos_storage_edicion on storage.objects
  for update to authenticated
  using (bucket_id = 'adjuntos') with check (bucket_id = 'adjuntos');

drop policy if exists adjuntos_storage_borrado on storage.objects;
create policy adjuntos_storage_borrado on storage.objects
  for delete to authenticated using (bucket_id = 'adjuntos');

-- Bucket PROPIO y privado para los archivos seguros de la boveda (fase
-- P5), distinto del bucket 'adjuntos' de arriba. adjuntos_storage_lectura
-- deja leer a CUALQUIER autenticado sin exigir ningun permiso; subir ahi
-- un archivo cifrado seria una regresion de seguridad silenciosa, porque
-- desde el 2026-07-17 la contraseña maestra la conoce todo el equipo
-- (autoriza las eliminaciones sensibles), asi que un tecnico sin permiso
-- de boveda podria descargarlo Y descifrarlo. Por eso archivos_boveda
-- exige puede_ver_boveda() en sus 4 politicas, igual que las tablas de
-- la boveda (credenciales, campos_protegidos).
insert into storage.buckets (id, name, public)
values ('archivos_boveda', 'archivos_boveda', false)
on conflict (id) do nothing;

drop policy if exists archivos_boveda_storage_lectura on storage.objects;
create policy archivos_boveda_storage_lectura on storage.objects
  for select to authenticated using (bucket_id = 'archivos_boveda' and public.puede_ver_boveda());

drop policy if exists archivos_boveda_storage_subida on storage.objects;
create policy archivos_boveda_storage_subida on storage.objects
  for insert to authenticated with check (bucket_id = 'archivos_boveda' and public.puede_ver_boveda());

drop policy if exists archivos_boveda_storage_edicion on storage.objects;
create policy archivos_boveda_storage_edicion on storage.objects
  for update to authenticated
  using (bucket_id = 'archivos_boveda' and public.puede_ver_boveda())
  with check (bucket_id = 'archivos_boveda' and public.puede_ver_boveda());

drop policy if exists archivos_boveda_storage_borrado on storage.objects;
create policy archivos_boveda_storage_borrado on storage.objects
  for delete to authenticated using (bucket_id = 'archivos_boveda' and public.puede_ver_boveda());

-- ----------------------------------------------------------------
-- 5. Datos iniciales
-- ----------------------------------------------------------------

insert into public.categorias (nombre, orden, es_red) values
  ('POS', 1, false),
  ('Impresoras', 2, false),
  ('Cámaras', 3, true),
  ('Computadores', 4, false),
  ('Redes', 5, true),
  ('Switches', 6, true),
  ('Access Points', 7, true),
  ('CCTV', 8, true),
  ('Servidores', 9, false),
  ('Racks', 10, true),
  ('Puntos de red', 11, true),
  ('Software', 12, false)
on conflict (nombre) do nothing;

-- Marca como de red las categorias que ya existian antes de agregar
-- es_red (el insert de arriba no las toca por el conflicto de nombre).
update public.categorias set es_red = true
  where nombre in ('Cámaras', 'Redes', 'Switches', 'Access Points', 'CCTV', 'Racks', 'Puntos de red')
    and es_red = false;

-- ----------------------------------------------------------------
-- 6. Tiempo real (Supabase Realtime)
-- ----------------------------------------------------------------

-- Publica los cambios de las tablas sincronizadas para que el resto
-- del equipo los reciba en el momento en vez de esperar al sondeo de
-- 2 minutos. La app usa estos eventos SOLO como señal para descargar
-- (ver src/lib/sync.ts): la descarga sigue respetando RLS, asi que
-- publicar aqui una tabla protegida (credenciales) no expone su
-- contenido a quien no tiene permiso. Idempotente: crea la publicacion
-- si falta y agrega solo las tablas que aun no esten. Las eliminaciones
-- de contenido son borrados suaves (update de eliminado_en), asi que se
-- propagan como UPDATE sin necesitar REPLICA IDENTITY FULL.
do $$
declare
  t text;
  tablas text[] := array[
    'categorias', 'articulos', 'dispositivos', 'credenciales', 'adjuntos',
    'historial', 'conexiones', 'diagnosticos', 'ejecuciones_diagnostico',
    'accesos_boveda', 'perfiles', 'boveda_meta', 'ubicaciones',
    'campos_protegidos', 'personas'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array tablas loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
