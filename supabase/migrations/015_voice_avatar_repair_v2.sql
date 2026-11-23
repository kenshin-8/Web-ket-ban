-- Connect: migration sửa dứt điểm quyền Avatar và tạo phòng thoại.
-- Chạy trong Supabase Dashboard > SQL Editor sau 001_schema.sql và 010_safety_hardening.sql.
-- An toàn khi chạy lại; không xóa dữ liệu hiện có.

alter table public.profiles add column if not exists avatar_data jsonb;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_public_or_own" on public.profiles;
create policy "profiles_read_public_or_own"
  on public.profiles for select to anon, authenticated
  using (id = auth.uid() or (is_visible = true and not public.is_blocked_between(auth.uid(), id)));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant usage on schema public to authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

create table if not exists public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 55),
  topic text not null check (topic in ('music','games','stories','chat')),
  description text not null default '' check (char_length(description) <= 180),
  host_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null default 'Thành viên',
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.voice_rooms enable row level security;
drop policy if exists "voice_rooms_read_open" on public.voice_rooms;
create policy "voice_rooms_read_open"
  on public.voice_rooms for select to authenticated
  using (is_open = true or host_id = auth.uid());
drop policy if exists "voice_rooms_create_own" on public.voice_rooms;
create policy "voice_rooms_create_own"
  on public.voice_rooms for insert to authenticated
  with check (host_id = auth.uid());
drop policy if exists "voice_rooms_update_host" on public.voice_rooms;
create policy "voice_rooms_update_host"
  on public.voice_rooms for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

grant select, insert, update on public.voice_rooms to authenticated;
