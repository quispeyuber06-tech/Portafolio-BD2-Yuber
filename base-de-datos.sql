-- Portafolio BD II · esquema 1 · Supabase / PostgreSQL
-- Ejecutar una vez en un proyecto propio. No hace público el portafolio.
begin;

create table if not exists public.bd2_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  role text not null check (role in ('student','admin'))
);
create table if not exists public.bd2_works (
  id uuid primary key,
  portfolio_id uuid not null,
  owner_id uuid not null references auth.users(id),
  unit smallint not null check (unit between 1 and 4),
  week smallint not null check (week between 1 and 4),
  day text not null check (day in ('Miércoles','Jueves')),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '' check (length(description)<=1000),
  object_path text not null,
  size bigint not null check (size between 1 and 20971520),
  type text not null default 'application/octet-stream',
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  revision integer not null default 1,
  grade smallint check (grade between 0 and 20),
  comment text not null default '' check (length(comment)<=2000),
  seen boolean not null default false,
  graded timestamptz,
  featured boolean not null default false,
  cover text check (cover is null or (length(cover)<=2800000 and cover ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
  history jsonb not null default '[]' check (jsonb_typeof(history)='array' and jsonb_array_length(history)<=100),
  origin_id text check (length(origin_id)<=200),
  unique (portfolio_id,origin_id)
);
create index if not exists bd2_works_portfolio on public.bd2_works(portfolio_id,created desc);
alter table public.bd2_members enable row level security;
alter table public.bd2_works enable row level security;
revoke all on public.bd2_members,public.bd2_works from anon,authenticated;
grant select on public.bd2_members,public.bd2_works to authenticated;

drop policy if exists bd2_members_self on public.bd2_members;
create policy bd2_members_self on public.bd2_members for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists bd2_works_read on public.bd2_works;
create policy bd2_works_read on public.bd2_works for select to authenticated
  using (portfolio_id in (select m.portfolio_id from public.bd2_members m where m.user_id=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit)
  values ('bd2-works','bd2-works',false,20971520)
  on conflict (id) do update set public=false,file_size_limit=20971520;

create or replace function public.bd2_member()
returns public.bd2_members language plpgsql stable security definer set search_path='' as $$
declare m public.bd2_members;
begin
  select * into m from public.bd2_members where user_id=auth.uid();
  if not found then raise exception 'Tu cuenta aún no tiene acceso a este portafolio.' using errcode='42501'; end if;
  return m;
end $$;

create or replace function public.bd2_session()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.bd2_members;
begin
  m:=public.bd2_member();
  return jsonb_build_object('schemaVersion',1,'portfolioId',m.portfolio_id,'role',m.role);
end $$;

create or replace function public.bd2_list()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.bd2_members; result jsonb;
begin
  m:=public.bd2_member();
  select coalesce(jsonb_agg(to_jsonb(w)-'portfolio_id'-'owner_id' order by w.created desc),'[]'::jsonb)
    into result from public.bd2_works w where w.portfolio_id=m.portfolio_id;
  return jsonb_build_object('works',result,'admin',m.role='admin','role',m.role,'portfolioId',m.portfolio_id);
end $$;

-- Únicamente objetos ya subidos por el estudiante a la carpeta de esa entrega.
create or replace function public.bd2_assert_file(p_path text,p_size bigint,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare m public.bd2_members; meta jsonb; prefix text;
begin
  m:=public.bd2_member();
  prefix:=m.portfolio_id::text||'/'||m.user_id::text||'/'||p_id::text||'/';
  if p_path is null or left(p_path,length(prefix))<>prefix
    or substring(p_path from length(prefix)+1) !~ '^[0-9a-f-]{36}$'
    or p_size is null or p_size not between 1 and 20971520 then
    raise exception 'Archivo o tamaño no válido.' using errcode='22023';
  end if;
  select o.metadata into meta from storage.objects o
    where o.bucket_id='bd2-works' and o.name=p_path for update;
  if not found or (meta->>'size')::bigint is distinct from p_size then
    raise exception 'El archivo aún no terminó de subirse. Vuelve a intentarlo.' using errcode='22023';
  end if;
end $$;

create or replace function public.bd2_save(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  m public.bd2_members; w public.bd2_works; h jsonb; hist jsonb:='[]';
  ident uuid; paths jsonb; vgrade integer; snap jsonb;
begin
  m:=public.bd2_member();
  if p_action='seen' then
    if m.role<>'student' then raise exception 'Solo el estudiante puede marcar sus notificaciones.' using errcode='42501'; end if;
    update public.bd2_works set seen=true where portfolio_id=m.portfolio_id and grade is not null;
    return jsonb_build_object('ok',true);
  end if;
  if (p_action='grade' and m.role<>'admin') or (p_action<>'grade' and m.role<>'student') then
    raise exception 'Esta acción no está permitida para tu cuenta.' using errcode='42501';
  end if;
  ident:=(p_data->>'id')::uuid;
  if p_action in ('create','import') then
    if p_action='import' then
      if nullif(p_data->>'origin_id','') is null then raise exception 'Falta identificar el trabajo de origen.' using errcode='22023'; end if;
      select * into w from public.bd2_works where portfolio_id=m.portfolio_id and origin_id=p_data->>'origin_id';
      if found then return jsonb_build_object('ok',true,'id',w.id,'already',true); end if;
    end if;
    perform public.bd2_assert_file(p_data->>'object_path',(p_data->>'size')::bigint,ident);
    if p_action='import' then
      if jsonb_typeof(coalesce(p_data->'history','[]'))<>'array' or jsonb_array_length(coalesce(p_data->'history','[]'))>100 then
        raise exception 'El historial supera las 100 versiones admitidas.' using errcode='22023';
      end if;
      for h in select value from jsonb_array_elements(coalesce(p_data->'history','[]')) loop
        perform public.bd2_assert_file(h->>'object_path',(h->>'size')::bigint,ident);
        if length(btrim(coalesce(h->>'name',''))) not between 1 and 200 or length(coalesce(h->>'description',''))>1000 then
          raise exception 'Revisa los nombres y descripciones del historial.' using errcode='22023';
        end if;
        hist:=hist||jsonb_build_array(jsonb_build_object(
          'name',h->>'name','description',coalesce(h->>'description',''),
          'object_path',h->>'object_path','size',(h->>'size')::bigint,'type',coalesce(h->>'type','application/octet-stream'),
          'created',coalesce((h->>'created')::timestamptz,now()),'updated',coalesce((h->>'updated')::timestamptz,now()),
          'grade',null,'comment','','seen',false));
      end loop;
    end if;
    insert into public.bd2_works(id,portfolio_id,owner_id,unit,week,day,name,description,object_path,size,type,created,featured,cover,history,origin_id)
    values (ident,m.portfolio_id,m.user_id,(p_data->>'unit')::smallint,(p_data->>'week')::smallint,p_data->>'day',
      btrim(p_data->>'name'),coalesce(p_data->>'description',''),p_data->>'object_path',(p_data->>'size')::bigint,
      coalesce(p_data->>'type','application/octet-stream'),
      case when p_action='import' then coalesce((p_data->>'created')::timestamptz,now()) else now() end,
      coalesce((p_data->>'featured')::boolean,false),p_data->>'cover',hist,
      case when p_action='import' then p_data->>'origin_id' else null end);
    return jsonb_build_object('ok',true,'id',ident);
  end if;
  select * into w from public.bd2_works where id=ident and portfolio_id=m.portfolio_id for update;
  if not found then raise exception 'Trabajo no encontrado. Actualiza la lista.' using errcode='P0002'; end if;
  if (p_data->>'revision')::integer is distinct from w.revision then
    raise exception 'Este trabajo cambió en otro dispositivo. Actualiza y vuelve a abrirlo antes de guardar.' using errcode='40001';
  end if;
  snap:=to_jsonb(w)-'history'-'portfolio_id'-'owner_id';
  if p_action in ('replace','restore') and jsonb_array_length(w.history)>=100 then
    raise exception 'Esta entrega llegó a 100 versiones. Descarga una copia y crea una nueva entrega.' using errcode='22023';
  end if;
  if p_action='replace' then
    if p_data ? 'object_path' or p_data ? 'size' then
      perform public.bd2_assert_file(coalesce(p_data->>'object_path',w.object_path),coalesce((p_data->>'size')::bigint,w.size),ident);
    end if;
    update public.bd2_works set name=btrim(p_data->>'name'),description=coalesce(p_data->>'description',''),
      object_path=coalesce(p_data->>'object_path',w.object_path),size=coalesce((p_data->>'size')::bigint,w.size),
      type=coalesce(p_data->>'type',w.type),history=w.history||jsonb_build_array(snap),grade=null,comment='',seen=false,graded=null,
      revision=w.revision+1,updated=now() where id=ident;
  elsif p_action='restore' then
    if (p_data->>'version')::integer is null or (p_data->>'version')::integer<0 then raise exception 'Versión no válida.' using errcode='22023'; end if;
    h:=w.history->(p_data->>'version')::integer;
    if h is null then raise exception 'Versión no encontrada.' using errcode='P0002'; end if;
    update public.bd2_works set name=h->>'name',description=coalesce(h->>'description',''),object_path=h->>'object_path',
      size=(h->>'size')::bigint,type=h->>'type',history=w.history||jsonb_build_array(snap),grade=null,comment='',seen=false,graded=null,
      revision=w.revision+1,updated=now() where id=ident;
  elsif p_action='grade' then
    if coalesce(p_data->>'grade','') !~ '^(0|[1-9]|1[0-9]|20)$' then raise exception 'La nota debe ser un entero de 0 a 20.' using errcode='22023'; end if;
    vgrade:=(p_data->>'grade')::integer;
    update public.bd2_works set grade=vgrade,comment=coalesce(p_data->>'comment',''),seen=false,graded=now(),revision=w.revision+1,updated=now() where id=ident;
  elsif p_action='feature' then
    update public.bd2_works set featured=not w.featured,revision=w.revision+1,updated=now() where id=ident;
  elsif p_action='cover' then
    update public.bd2_works set cover=p_data->>'cover',revision=w.revision+1,updated=now() where id=ident;
  elsif p_action='delete' then
    select jsonb_agg(distinct path) into paths from (
      select w.object_path as path union all select value->>'object_path' from jsonb_array_elements(w.history)
    ) p where path is not null;
    delete from public.bd2_works where id=ident;
    return jsonb_build_object('ok',true,'paths',paths);
  else raise exception 'Acción no válida.' using errcode='22023';
  end if;
  return jsonb_build_object('ok',true,'id',ident);
end $$;

-- Las rutas de Storage siempre incluyen el portafolio y la cuenta que subió el archivo.
drop policy if exists bd2_storage_insert on storage.objects;
create policy bd2_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='bd2-works' and split_part(name,'/',2)=(select auth.uid())::text and
  exists(select 1 from public.bd2_members m where m.user_id=(select auth.uid()) and m.role='student' and m.portfolio_id::text=split_part(name,'/',1))
);
drop policy if exists bd2_storage_read on storage.objects;
create policy bd2_storage_read on storage.objects for select to authenticated using (
  bucket_id='bd2-works' and exists(select 1 from public.bd2_members m
    where m.user_id=(select auth.uid()) and m.portfolio_id::text=split_part(name,'/',1))
);
-- No se permite sobrescribir un objeto: cada versión tiene una ruta nueva.
-- No se permite borrar los bytes de una entrega que siga registrada.
drop policy if exists bd2_storage_delete on storage.objects;
create policy bd2_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='bd2-works' and exists(select 1 from public.bd2_members m
    where m.user_id=(select auth.uid()) and m.role='student' and m.portfolio_id::text=split_part(name,'/',1))
  and not exists(select 1 from public.bd2_works w where w.object_path=storage.objects.name
    or exists(select 1 from jsonb_array_elements(w.history) h where h->>'object_path'=storage.objects.name))
);

revoke all on function public.bd2_member(),public.bd2_assert_file(text,bigint,uuid),
  public.bd2_session(),public.bd2_list(),public.bd2_save(text,jsonb) from public,anon,authenticated;
grant execute on function public.bd2_session(),public.bd2_list(),public.bd2_save(text,jsonb) to authenticated;
commit;

-- CUENTAS: crear el estudiante y el docente en Authentication > Users.
-- Después, añadir sus UUID REALES con el MISMO portfolio_id (UUID aleatorio).
-- No insertar contraseñas aquí y no usar ADMIN/ADMIN para el acceso en línea.
-- insert into public.bd2_members(user_id,portfolio_id,role) values
--   ('UUID_ESTUDIANTE','UUID_PORTAFOLIO','student'),
--   ('UUID_DOCENTE','UUID_PORTAFOLIO','admin');
