-- Migration riêng cho Mutual Like + Soul Connection. Có thể chạy độc lập trong Supabase SQL Editor.
-- ===== Tinh cầu đôi / lượt thích tương hỗ =====
-- Mỗi người chỉ có một lượt thích cho một thành viên; không thể tự thích chính mình.
create table if not exists public.soul_likes (
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user_id, to_user_id),
  constraint soul_likes_no_self check (from_user_id <> to_user_id)
);
create index if not exists soul_likes_to_user_idx on public.soul_likes (to_user_id, created_at desc);
alter table public.soul_likes enable row level security;
drop policy if exists "soul_likes_read_participant" on public.soul_likes;
create policy "soul_likes_read_participant" on public.soul_likes
  for select to authenticated using (from_user_id = auth.uid() or to_user_id = auth.uid());
drop policy if exists "soul_likes_insert_self" on public.soul_likes;
create policy "soul_likes_insert_self" on public.soul_likes
  for insert to authenticated with check (from_user_id = auth.uid() and to_user_id <> auth.uid());
drop policy if exists "soul_likes_delete_self" on public.soul_likes;
create policy "soul_likes_delete_self" on public.soul_likes
  for delete to authenticated using (from_user_id = auth.uid());

-- Bật realtime cho lượt thích đến để hai phía nhận thông báo khi thành kết nối.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'soul_likes'
  ) then
    alter publication supabase_realtime add table public.soul_likes;
  end if;
end $$;
