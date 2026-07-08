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
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

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
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);

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
  recibido_en timestamptz not null default now()
);

-- El historial ahora tambien registra cambios de diagnosticos.
alter table public.historial drop constraint if exists historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('categoria', 'articulo', 'dispositivo', 'credencial', 'diagnostico'));

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

-- Verificador de la contrasena maestra: se puede leer y crear UNA
-- sola vez (la clave primaria fija impide una segunda fila), siempre
-- con permiso de boveda. A proposito NO hay politicas de UPDATE ni
-- DELETE: desde la app nadie puede reemplazarlo ni borrarlo, asi que
-- restablecer la contrasena maestra exige entrar a este panel con la
-- cuenta de administrador (validacion de identidad real).
drop policy if exists boveda_meta_lectura on public.boveda_meta;
create policy boveda_meta_lectura on public.boveda_meta
  for select to authenticated using (public.puede_ver_boveda());

drop policy if exists boveda_meta_creacion on public.boveda_meta;
create policy boveda_meta_creacion on public.boveda_meta
  for insert to authenticated with check (public.puede_ver_boveda());

-- Historial: se puede leer y agregar, nunca editar ni borrar.
-- Las entradas de credenciales solo las ven los usuarios con
-- acceso a la boveda.
drop policy if exists historial_lectura on public.historial;
create policy historial_lectura on public.historial
  for select to authenticated
  using (entidad_tipo <> 'credencial' or public.puede_ver_boveda());

drop policy if exists historial_insercion on public.historial;
create policy historial_insercion on public.historial
  for insert to authenticated with check (true);

-- Diagnosticos: acceso completo para cualquier tecnico autenticado,
-- como el resto del contenido general.
drop policy if exists diagnosticos_acceso on public.diagnosticos;
create policy diagnosticos_acceso on public.diagnosticos
  for all to authenticated using (true) with check (true);

-- Ejecuciones de diagnostico: se pueden leer y agregar, nunca editar
-- ni borrar (registro inmutable, como el historial).
drop policy if exists ejecuciones_lectura on public.ejecuciones_diagnostico;
create policy ejecuciones_lectura on public.ejecuciones_diagnostico
  for select to authenticated using (true);

drop policy if exists ejecuciones_insercion on public.ejecuciones_diagnostico;
create policy ejecuciones_insercion on public.ejecuciones_diagnostico
  for insert to authenticated with check (true);

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
  ('Puntos de red', 11, true)
on conflict (nombre) do nothing;

-- Marca como de red las categorias que ya existian antes de agregar
-- es_red (el insert de arriba no las toca por el conflicto de nombre).
update public.categorias set es_red = true
  where nombre in ('Cámaras', 'Redes', 'Switches', 'Access Points', 'CCTV', 'Racks', 'Puntos de red')
    and es_red = false;
