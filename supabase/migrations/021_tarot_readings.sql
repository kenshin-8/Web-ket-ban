-- Connect Tarot: lịch sử rút bài riêng tư theo tài khoản.
-- Chạy trong Supabase Dashboard > SQL Editor sau các migration hiện có.
-- Chỉ tạo bảng mới; không sửa hoặc xóa dữ liệu/bảng đang dùng.
create table if not exists public.tarot_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spread_type text not null check (spread_type in ('single', 'three')),
  topic text not null default 'general' check (topic in ('general', 'love', 'work', 'self')),
  cards jsonb not null check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) between 1 and 3),
  created_at timestamptz not null default now()
);
create index if not exists tarot_readings_user_created_idx
  on public.tarot_readings (user_id, created_at desc);

alter table public.tarot_readings enable row level security;
revoke all on public.tarot_readings from anon;
grant select, insert, delete on public.tarot_readings to authenticated;

drop policy if exists "tarot_readings_select_own" on public.tarot_readings;
create policy "tarot_readings_select_own" on public.tarot_readings
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "tarot_readings_insert_own" on public.tarot_readings;
create policy "tarot_readings_insert_own" on public.tarot_readings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "tarot_readings_delete_own" on public.tarot_readings;
create policy "tarot_readings_delete_own" on public.tarot_readings
  for delete to authenticated using (user_id = auth.uid());
