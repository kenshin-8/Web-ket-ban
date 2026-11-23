-- Chạy trong Supabase > SQL Editor. An toàn khi chạy lại (không xóa bảng/dữ liệu).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  interests text[] not null default '{}',
  city text not null default '',
  is_visible boolean not null default false,
  avatar_data jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_read_public_or_own" on public.profiles;
create policy "profiles_read_public_or_own" on public.profiles for select using (is_visible = true or id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Biểu mẫu liên hệ: ai cũng gửi được, nhưng không ai đọc được qua khóa công khai (xem trong Dashboard).
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists "contact_insert_any" on public.contact_messages;
create policy "contact_insert_any" on public.contact_messages for insert to anon, authenticated with check (true);

-- Soul Quiz / Soul Match
alter table public.profiles add column if not exists planet text check (planet in ('aurora','terra','nova','luna'));
alter table public.profiles add column if not exists soul_scores jsonb;

-- Vị trí (chỉ tồn tại khi người dùng chủ động bật; tọa độ đã làm tròn ở trình duyệt)
create table if not exists public.user_locations (
  id uuid primary key references auth.users(id) on delete cascade,
  lat numeric(6,2) not null check (lat between -90 and 90),
  lng numeric(6,2) not null check (lng between -180 and 180),
  updated_at timestamptz not null default now()
);
alter table public.user_locations enable row level security;
drop policy if exists "loc_read_auth" on public.user_locations;
drop policy if exists "loc_read_own" on public.user_locations;
-- Tọa độ thô chỉ chủ tài khoản được đọc. Tìm người ở gần phải gọi nearby_users()
-- sau khi chạy 010_safety_hardening.sql; không cấp quyền đọc vị trí của thành viên khác.
create policy "loc_read_own" on public.user_locations for select to authenticated using (id = auth.uid());
drop policy if exists "loc_write_own" on public.user_locations;
create policy "loc_write_own" on public.user_locations for all to authenticated using (id = auth.uid()) with check (id = auth.uid());


-- Voice Community: phòng thoại nhóm. Chỉ tài khoản đăng nhập mới được tạo/tham gia.
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
create policy "voice_rooms_read_open" on public.voice_rooms for select to authenticated using (is_open = true or host_id = auth.uid());
drop policy if exists "voice_rooms_create_own" on public.voice_rooms;
create policy "voice_rooms_create_own" on public.voice_rooms for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "voice_rooms_update_host" on public.voice_rooms;
create policy "voice_rooms_update_host" on public.voice_rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

-- ===== Quảng trường (Square) =====
-- Ẩn danh: bảng gốc chứa author_id chỉ chủ bài đọc được; mọi người xem qua view *_feed không có author_id.
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  alias text not null check (char_length(alias) <= 40),
  body text not null default '' check (char_length(body) <= 500),
  tags text[] not null default '{}',
  media_url text, media_kind text check (media_kind in ('image','video','audio')),
  created_at timestamptz not null default now(),
  check (body <> '' or media_url is not null)
);
create table if not exists public.moment_likes (
  moment_id uuid references public.moments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (moment_id, user_id)
);
create table if not exists public.moment_comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  alias text not null check (char_length(alias) <= 40),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.moment_threads (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (moment_id, guest_id)
);
create table if not exists public.moment_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.moment_threads(id) on delete cascade,
  from_author boolean not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists moments_tags_idx on public.moments using gin (tags);
alter table public.moments enable row level security;
alter table public.moment_likes enable row level security;
alter table public.moment_comments enable row level security;
alter table public.moment_threads enable row level security;
alter table public.moment_messages enable row level security;

drop policy if exists "m_own_select" on public.moments; create policy "m_own_select" on public.moments for select to authenticated using (author_id = auth.uid());
drop policy if exists "m_own_insert" on public.moments; create policy "m_own_insert" on public.moments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "m_own_delete" on public.moments; create policy "m_own_delete" on public.moments for delete to authenticated using (author_id = auth.uid());
drop policy if exists "l_own" on public.moment_likes; create policy "l_own" on public.moment_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "c_own_select" on public.moment_comments; create policy "c_own_select" on public.moment_comments for select to authenticated using (author_id = auth.uid());
drop policy if exists "c_own_insert" on public.moment_comments; create policy "c_own_insert" on public.moment_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "c_own_delete" on public.moment_comments; create policy "c_own_delete" on public.moment_comments for delete to authenticated using (author_id = auth.uid());
drop policy if exists "t_select" on public.moment_threads;
create policy "t_select" on public.moment_threads for select to authenticated using (guest_id = auth.uid() or exists (select 1 from public.moments m where m.id = moment_id and m.author_id = auth.uid()));
drop policy if exists "t_insert" on public.moment_threads;
create policy "t_insert" on public.moment_threads for insert to authenticated with check (guest_id = auth.uid() and not exists (select 1 from public.moments m where m.id = moment_id and m.author_id = auth.uid()));
drop policy if exists "msg_select" on public.moment_messages;
create policy "msg_select" on public.moment_messages for select to authenticated using (exists (select 1 from public.moment_threads t where t.id = thread_id));
drop policy if exists "msg_insert" on public.moment_messages;
create policy "msg_insert" on public.moment_messages for insert to authenticated with check (exists (select 1 from public.moment_threads t where t.id = thread_id and (
  (not from_author and t.guest_id = auth.uid()) or
  (from_author and exists (select 1 from public.moments m where m.id = t.moment_id and m.author_id = auth.uid())))));

-- View chạy với quyền chủ sở hữu (cố ý) để đọc mọi bài nhưng KHÔNG lộ author_id.
create or replace view public.moments_feed as
  select m.id, m.alias, m.body, m.tags, m.media_url, m.media_kind, m.created_at,
    (select count(*) from public.moment_likes l where l.moment_id = m.id) as like_count,
    (select count(*) from public.moment_comments c where c.moment_id = m.id) as comment_count,
    exists (select 1 from public.moment_likes l where l.moment_id = m.id and l.user_id = auth.uid()) as liked_by_me,
    (m.author_id = auth.uid()) as is_mine
  from public.moments m;
create or replace view public.comments_feed as
  select c.id, c.moment_id, c.alias, c.body, c.created_at, (c.author_id = auth.uid()) as is_mine from public.moment_comments c;
revoke all on public.moments_feed, public.comments_feed from anon;
grant select on public.moments_feed, public.comments_feed to authenticated;

-- Kho ảnh/video/ghi âm: tên tệp ngẫu nhiên, không chứa id người dùng. Tối đa 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moments', 'moments', true, 10485760, array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','audio/mpeg'])
on conflict (id) do nothing;
drop policy if exists "moments_upload" on storage.objects;
create policy "moments_upload" on storage.objects for insert to authenticated with check (bucket_id = 'moments');


-- Soul Card: tối đa 6 từ khóa do chủ hồ sơ tự chọn.
alter table public.profiles add column if not exists soul_tags text[] not null default '{}';

-- Cung hoàng đạo (chỉ lưu tên cung, không lưu ngày sinh)
alter table public.profiles add column if not exists zodiac text
  check (zodiac is null or zodiac in ('Bạch Dương','Kim Ngưu','Song Tử','Cự Giải','Sư Tử','Xử Nữ','Thiên Bình','Thiên Yết','Nhân Mã','Ma Kết','Bảo Bình','Song Ngư'));


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
