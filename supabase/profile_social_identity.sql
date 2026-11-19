-- Connect Profile 2.0: ảnh bìa, dòng giới thiệu và bài đăng hồ sơ.
-- Chạy sau schema.sql trong Supabase > SQL Editor. Có thể chạy lại an toàn.

alter table public.profiles
  add column if not exists headline text not null default '' check (char_length(headline) <= 90),
  add column if not exists cover_url text not null default '';

-- Bucket công khai để ảnh bìa hiển thị trên trang hồ sơ; chỉ chủ tài khoản được ghi vào thư mục UUID của mình.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-covers', 'profile-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "profile_covers_insert_own" on storage.objects;
create policy "profile_covers_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile_covers_update_own" on storage.objects;
create policy "profile_covers_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile_covers_delete_own" on storage.objects;
create policy "profile_covers_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.profile_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists profile_posts_user_created_idx
  on public.profile_posts (user_id, created_at desc);
alter table public.profile_posts enable row level security;

drop policy if exists "profile_posts_read_public_or_own" on public.profile_posts;
create policy "profile_posts_read_public_or_own" on public.profile_posts
  for select to anon, authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = user_id and p.is_visible = true
  ));
drop policy if exists "profile_posts_insert_own" on public.profile_posts;
create policy "profile_posts_insert_own" on public.profile_posts
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profile_posts_delete_own" on public.profile_posts;
create policy "profile_posts_delete_own" on public.profile_posts
  for delete to authenticated using (user_id = auth.uid());

grant select on public.profile_posts to anon, authenticated;
grant insert, delete on public.profile_posts to authenticated;
