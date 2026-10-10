-- Run once in the Supabase SQL Editor. No service-role key is needed by the app.
begin;
create table public.score_rooms (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 invite_token uuid not null default gen_random_uuid(),
 data jsonb not null,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 constraint room_payload_size check(octet_length(data::text)<=1000000)
);
alter table public.score_rooms enable row level security;
-- No table access for guests or authenticated users: all access uses scoped RPCs.
revoke all on public.score_rooms from public, anon, authenticated;

create function public.validate_score_payload(p_data jsonb) returns void
language plpgsql set search_path = '' as $$
begin
 if p_data is null or jsonb_typeof(p_data) is distinct from 'object'
  or p_data->>'version' is distinct from '1'
  or jsonb_typeof(p_data->'settings') is distinct from 'object'
  or jsonb_typeof(p_data->'settings'->'players') is distinct from 'array'
  or jsonb_typeof(p_data->'settings'->'rules') is distinct from 'object'
  or jsonb_typeof(p_data->'rounds') is distinct from 'array'
 then raise exception 'Invalid payload' using errcode='22023'; end if;
 if jsonb_array_length(p_data->'settings'->'players') not between 4 and 100
  or jsonb_array_length(p_data->'rounds')>2000 then raise exception 'Payload limit exceeded' using errcode='22023'; end if;
end $$;
revoke all on function public.validate_score_payload(jsonb) from public,anon,authenticated;

create function public.create_score_room(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.score_rooms;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform public.validate_score_payload(p_data);
 insert into public.score_rooms(owner_id,data) values(auth.uid(),p_data) returning * into r;
 return jsonb_build_object('id',r.id,'revision',r.revision,'owner',true,'token',r.invite_token,'data',r.data);
end $$;

create function public.owned_score_room(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.score_rooms;
begin
 select * into r from public.score_rooms where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'Owner required' using errcode='42501'; end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'owner',true,'token',r.invite_token,'data',r.data);
end $$;

create function public.read_score_room(p_id uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.score_rooms;
begin
 select * into r from public.score_rooms where id=p_id and invite_token=p_token;
 if not found then raise exception 'Invalid invitation' using errcode='P0002'; end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'owner',coalesce(r.owner_id=auth.uid(),false),'token',r.invite_token,'data',r.data);
end $$;

create function public.update_score_room(p_id uuid,p_revision integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform public.validate_score_payload(p_data);
 -- Lock and revision check are atomic. Never silently overwrite another device's update.
 if not exists(select 1 from public.score_rooms where id=p_id and owner_id=auth.uid())
 then raise exception 'Owner required' using errcode='42501'; end if;
 update public.score_rooms set data=p_data,revision=revision+1,updated_at=now()
 where id=p_id and owner_id=auth.uid() and revision=p_revision;
 if not found then raise exception 'Revision conflict' using errcode='40001'; end if;
 return public.owned_score_room(p_id);
end $$;

create function public.rotate_score_invite(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 update public.score_rooms set invite_token=gen_random_uuid(),revision=revision+1,updated_at=now()
 where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'Owner required' using errcode='42501'; end if;
 return public.owned_score_room(p_id);
end $$;

revoke all on function public.create_score_room(jsonb),public.owned_score_room(uuid),public.update_score_room(uuid,integer,jsonb),public.rotate_score_invite(uuid),public.read_score_room(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_score_room(jsonb),public.owned_score_room(uuid),public.update_score_room(uuid,integer,jsonb),public.rotate_score_invite(uuid) to authenticated;
grant execute on function public.read_score_room(uuid,uuid) to anon,authenticated;
commit;
