-- ================================================================
-- Pruebas del portal de asistencia (tarea 258) CONTRA LA BASE REAL,
-- sin dejar rastro.
--
-- Todo corre dentro de un solo bloque que termina SIEMPRE con una
-- excepcion: Postgres revierte la transaccion entera, incluidos los dos
-- tecnicos ficticios que crea en auth.users (con correos .invalid), las
-- sesiones, los mensajes y los eventos. El resultado viaja en el texto
-- de esa excepcion: "RESULTADO_PRUEBA fallos=0 [...]" es que todo paso.
--
-- Como ejecutarlo: SQL Editor de Supabase (o execute_sql del MCP), pegar
-- el archivo completo y Run. Despues, comprobar que no quedo nada:
--   select count(*) from public.asistencia_sesiones;  -- las que hubiera antes
--
-- Cubre: crear; estado con secreto correcto e incorrecto; codigo con
-- formato invalido, incorrecto, correcto (dictado con espacio), ya usado,
-- vencido y reusado tras desconectar; envio valido; envio con un secreto
-- (texto y bloque cifrado de la app), con una clave desconocida y con una
-- URL que no es http(s); que el portal recibe solo lo valido y que la
-- auditoria no guarda el secreto; que anon y authenticated no leen las
-- tablas ni llaman las funciones del otro rol ni las internas;
-- desconexion; inactividad; reemplazo por otra sesion del mismo tecnico;
-- cierre desde el portal; y el limite de 5 intentos fallidos.
-- ================================================================
do $$
declare
  a uuid := gen_random_uuid();   -- tecnico ficticio A
  b uuid := gen_random_uuid();   -- tecnico ficticio B
  r jsonb; p jsonb; p2 jsonb; c jsonb; x jsonb;
  res text := '';
  fallos int := 0;
  v_id uuid; v_sec text; v_cod text;
  v_id2 uuid; v_sec2 text; v_cod2 text;
  n int;
begin
  insert into auth.users (id, aud, role, email) values (a, 'authenticated', 'authenticated', 'prueba258a@ejemplo.invalid');
  insert into auth.users (id, aud, role, email) values (b, 'authenticated', 'authenticated', 'prueba258b@ejemplo.invalid');

  -- 1. portal crea (anon)
  set local role anon;
  p := public.asistencia_crear();
  reset role;
  v_id := (p->>'id')::uuid; v_sec := p->>'secreto'; v_cod := p->>'codigo';
  res := res || format('[1 crear ok=%s cod6=%s sec64=%s] ', p->>'ok', v_cod ~ '^[0-9]{6}$', v_sec ~ '^[0-9a-f]{64}$');
  if not (p->>'ok')::boolean or v_cod !~ '^[0-9]{6}$' then fallos := fallos + 1; end if;

  -- 2. estado portal con secreto correcto / 3. incorrecto
  set local role anon;
  r := public.asistencia_estado(v_id, v_sec, 0);
  x := public.asistencia_estado(v_id, repeat('a', 64), 0);
  reset role;
  res := res || format('[2 esperando=%s codigo_visible=%s] [3 secreto_malo=%s] ', r->>'estado', (r->>'codigo') = v_cod, x->>'estado');
  if r->>'estado' <> 'esperando' or x->>'estado' <> 'no_encontrada' then fallos := fallos + 1; end if;

  -- 4. formato invalido / 5. codigo incorrecto (tecnico A)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  c := public.asistencia_conectar('12ab');
  x := public.asistencia_conectar(case when v_cod = '000000' then '000001' else '000000' end);
  reset role;
  res := res || format('[4 %s] [5 %s] ', c->>'error', x->>'error');
  if c->>'error' <> 'codigo_invalido' or x->>'error' not in ('codigo_incorrecto', 'codigo_usado', 'codigo_vencido') then fallos := fallos + 1; end if;

  -- 6. codigo correcto (con espacios, como se dicta)
  set local role authenticated;
  c := public.asistencia_conectar(substr(v_cod, 1, 3) || ' ' || substr(v_cod, 4));
  reset role;
  set local role anon;
  r := public.asistencia_estado(v_id, v_sec, 0);
  reset role;
  res := res || format('[6 conectar=%s portal=%s codigo_oculto=%s] ', c->>'ok', r->>'estado', r->'codigo' = 'null'::jsonb);
  if not (c->>'ok')::boolean or r->>'estado' <> 'conectada' then fallos := fallos + 1; end if;

  -- 7. sesion ya utilizada (tecnico B con el mismo codigo)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  x := public.asistencia_conectar(v_cod);
  -- 11. B no puede enviar a la sesion de A
  p2 := public.asistencia_enviar(v_id, '{"v":1,"titulo":"x","bloques":[{"tipo":"accion","texto":"y"}]}'::jsonb);
  reset role;
  res := res || format('[7 %s] [11 %s] ', x->>'error', p2->>'error');
  if x->>'error' <> 'codigo_usado' or p2->>'error' <> 'sesion_no_activa' then fallos := fallos + 1; end if;

  -- 8. envio valido (A)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  x := public.asistencia_enviar(v_id, '{"v":1,"titulo":"Paso 2 · Vaciar la caché DNS","subtitulo":"Guía de prueba","bloques":[{"tipo":"donde","texto":"Símbolo del sistema"},{"tipo":"accion","texto":"Ejecuta el comando"},{"tipo":"comando","texto":"ipconfig /flushdns","plataforma":"Windows"},{"tipo":"url","texto":"https://example.com/ayuda"},{"tipo":"debes_ver","texto":"Se vació correctamente"}]}'::jsonb);
  -- 9. secreto
  p2 := public.asistencia_enviar(v_id, '{"v":1,"titulo":"Paso 3","bloques":[{"tipo":"dato","texto":"Contraseña: Admin123"}]}'::jsonb);
  -- 9b. bloque cifrado de la app
  c := public.asistencia_enviar(v_id, '{"v":1,"titulo":"Paso 3","bloques":[{"tipo":"nota","texto":"v1.600000.QUJDREVGR0g=.SUpLTE1OT1A=.cXJzdHV2d3g="}]}'::jsonb);
  -- 10. estructura: clave desconocida y url no http
  r := public.asistencia_enviar(v_id, '{"v":1,"titulo":"Paso 3","bloques":[{"tipo":"accion","texto":"a","valor_cifrado":"x"}]}'::jsonb);
  p := public.asistencia_enviar(v_id, '{"v":1,"titulo":"Paso 3","bloques":[{"tipo":"url","texto":"javascript:alert(1)"}]}'::jsonb);
  reset role;
  res := res || format('[8 %s] [9 %s] [9b %s] [10 %s/%s %s] ', x->>'ok', p2->>'error', c->>'error', r->>'error', p->>'error', p->>'motivo');
  if not (x->>'ok')::boolean or p2->>'error' <> 'contenido_protegido' or c->>'error' <> 'contenido_protegido'
     or r->>'error' <> 'contenido_no_valido' or p->>'motivo' <> 'url' then fallos := fallos + 1; end if;

  -- el portal recibe SOLO el envio valido
  set local role anon;
  r := public.asistencia_estado(v_id, v_sec, 0);
  x := public.asistencia_estado(v_id, v_sec, (r->'mensajes'->0->>'id')::bigint);
  reset role;
  res := res || format('[8b mensajes=%s comando=%s desde_ultimo=%s] ', jsonb_array_length(r->'mensajes'),
    r->'mensajes'->0->'contenido'->'bloques'->2->>'texto', jsonb_array_length(x->'mensajes'));
  if jsonb_array_length(r->'mensajes') <> 1 or jsonb_array_length(x->'mensajes') <> 0 then fallos := fallos + 1; end if;
  select count(*) into n from public.asistencia_eventos where sesion_id = v_id and tipo = 'mensaje_rechazado';
  res := res || format('[9c rechazos_registrados=%s] ', n);
  if n <> 4 then fallos := fallos + 1; end if;
  select count(*) into n from public.asistencia_eventos where sesion_id = v_id and detalle ilike '%admin123%';
  if n <> 0 then fallos := fallos + 1; res := res || '[9d SECRETO EN AUDITORIA] '; end if;

  -- 12/13. acceso directo a las tablas
  begin
    set local role anon;
    perform count(*) from public.asistencia_sesiones;
    res := res || '[12 anon LEE] '; fallos := fallos + 1;
  exception when insufficient_privilege then res := res || '[12 anon denegado] ';
  end;
  reset role;
  begin
    set local role authenticated;
    perform count(*) from public.asistencia_mensajes;
    res := res || '[13 auth LEE] '; fallos := fallos + 1;
  exception when insufficient_privilege then res := res || '[13 auth denegado] ';
  end;
  reset role;
  -- 14. funciones del otro rol y funciones internas
  begin
    set local role anon;
    perform public.asistencia_conectar(v_cod);
    res := res || '[14 anon CONECTA] '; fallos := fallos + 1;
  exception when insufficient_privilege then res := res || '[14 anon no conecta] ';
  end;
  reset role;
  begin
    set local role authenticated;
    perform public.asistencia_crear();
    res := res || '[14b auth CREA] '; fallos := fallos + 1;
  exception when insufficient_privilege then res := res || '[14b auth no crea] ';
  end;
  reset role;
  begin
    set local role anon;
    perform public.asistencia_vencer(null);
    res := res || '[14c anon VENCE] '; fallos := fallos + 1;
  exception when insufficient_privilege then res := res || '[14c internas cerradas] ';
  end;
  reset role;

  -- 15. desconectar (A) y 16. reconectar con el mismo codigo
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  x := public.asistencia_desconectar(v_id);
  c := public.asistencia_conectar(v_cod);
  reset role;
  set local role anon;
  r := public.asistencia_estado(v_id, v_sec, 0);
  reset role;
  select count(*) into n from public.asistencia_mensajes where sesion_id = v_id;
  res := res || format('[15 portal=%s motivo=%s mensajes_borrados=%s] [16 %s] ', r->>'estado', r->>'motivo', n = 0, c->>'error');
  if r->>'estado' <> 'cerrada' or r->>'motivo' <> 'tecnico' or n <> 0 or c->>'error' <> 'codigo_usado' then fallos := fallos + 1; end if;

  -- 17. codigo vencido
  set local role anon;
  p := public.asistencia_crear();
  reset role;
  v_id2 := (p->>'id')::uuid; v_sec2 := p->>'secreto'; v_cod2 := p->>'codigo';
  update public.asistencia_sesiones set codigo_vence_en = now() - interval '1 second' where id = v_id2;
  set local role anon;
  r := public.asistencia_estado(v_id2, v_sec2, 0);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  c := public.asistencia_conectar(v_cod2);
  reset role;
  res := res || format('[17 portal=%s motivo=%s conectar=%s] ', r->>'estado', r->>'motivo', c->>'error');
  if r->>'estado' <> 'expirada' or r->>'motivo' <> 'codigo_vencido' or c->>'error' <> 'codigo_vencido' then fallos := fallos + 1; end if;

  -- 21. reemplazo y 18. inactividad
  set local role anon;
  p := public.asistencia_crear();
  p2 := public.asistencia_crear();
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  c := public.asistencia_conectar(p->>'codigo');
  x := public.asistencia_conectar(p2->>'codigo');
  reset role;
  set local role anon;
  r := public.asistencia_estado((p->>'id')::uuid, p->>'secreto', 0);
  reset role;
  res := res || format('[21 primera=%s motivo=%s segunda=%s] ', r->>'estado', r->>'motivo', x->>'ok');
  if r->>'motivo' <> 'reemplazada' or not (x->>'ok')::boolean then fallos := fallos + 1; end if;
  update public.asistencia_sesiones set ultima_actividad = now() - interval '16 minutes' where id = (p2->>'id')::uuid;
  set local role authenticated;
  c := public.asistencia_enviar((p2->>'id')::uuid, '{"v":1,"titulo":"x","bloques":[{"tipo":"accion","texto":"y"}]}'::jsonb);
  reset role;
  res := res || format('[18 %s estado=%s motivo=%s] ', c->>'error', c->>'estado', c->>'motivo');
  if c->>'error' <> 'sesion_no_activa' or c->>'motivo' <> 'inactividad' then fallos := fallos + 1; end if;

  -- 20. el portal termina
  set local role anon;
  p := public.asistencia_crear();
  x := public.asistencia_cerrar_portal((p->>'id')::uuid, p->>'secreto');
  r := public.asistencia_estado((p->>'id')::uuid, p->>'secreto', 0);
  reset role;
  res := res || format('[20 portal=%s motivo=%s] ', r->>'estado', r->>'motivo');
  if r->>'estado' <> 'cerrada' or r->>'motivo' <> 'portal' then fallos := fallos + 1; end if;

  -- 19. limite de intentos (A ya tiene 2 fallos: el 5 y el 16)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  x := public.asistencia_conectar('999990');
  x := public.asistencia_conectar('999991');
  x := public.asistencia_conectar('999992');
  c := public.asistencia_conectar('999993');
  reset role;
  res := res || format('[19 tras5=%s] ', c->>'error');
  if c->>'error' <> 'demasiados_intentos' then fallos := fallos + 1; end if;

  -- Siempre termina con excepcion: nada de lo anterior queda guardado.
  raise exception 'RESULTADO_PRUEBA fallos=% %', fallos, res;
end $$;
