-- Connect: đồng bộ Avatar đang di chuyển trên tinh cầu theo thời gian thực.
-- Chạy sau 001_schema.sql, 003_friend_system.sql và 010_safety_hardening.sql.
-- Tọa độ là vị trí ảo trên bề mặt hành tinh (radian), không phải vị trí địa lý.

create table if not exists public.planet_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null default 0.12 check (latitude between -1.12 and 1.12),
  longitude double precision not null default 0.25 check (longitude between -3.141593 and 3.141593),
  updated_at timestamptz not null default now()
);

create index if not exists planet_presence_updated_at_idx
  on public.planet_presence (updated_at desc);

alter table public.planet_presence enable row level security;
revoke all on public.planet_presence from anon, public;
grant select, insert, update on public.planet_presence to authenticated;

drop policy if exists "planet_presence_read_visible" on public.planet_presence;
create policy "planet_presence_read_visible"
  on public.planet_presence for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = planet_presence.user_id
        and p.is_visible = true
        and not public.is_blocked_between(auth.uid(), p.id)
    )
  );

drop policy if exists "planet_presence_insert_own" on public.planet_presence;
create policy "planet_presence_insert_own"
  on public.planet_presence for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "planet_presence_update_own" on public.planet_presence;
create policy "planet_presence_update_own"
  on public.planet_presence for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.planet_presence replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'planet_presence'
     ) then
    alter publication supabase_realtime add table public.planet_presence;
  end if;
end $$;
