-- Connect Community Feed: bài đăng và bình luận theo từng hành tinh.
-- Chạy sau 002_community_members.sql trong Supabase > SQL Editor.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id text not null check (community_id in ('tech','art','music','nature','books','sport')),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists community_posts_feed_idx
  on public.community_posts (community_id, created_at desc);
alter table public.community_posts enable row level security;

drop policy if exists "community_posts_read_members" on public.community_posts;
create policy "community_posts_read_members" on public.community_posts
  for select to authenticated using (
    exists (select 1 from public.community_members cm
      where cm.community_id = community_posts.community_id and cm.user_id = auth.uid())
  );
drop policy if exists "community_posts_insert_members" on public.community_posts;
create policy "community_posts_insert_members" on public.community_posts
  for insert to authenticated with check (
    author_id = auth.uid() and exists (select 1 from public.community_members cm
      where cm.community_id = community_posts.community_id and cm.user_id = auth.uid())
  );
drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own" on public.community_posts
  for delete to authenticated using (author_id = auth.uid());

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  community_id text not null check (community_id in ('tech','art','music','nature','books','sport')),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at asc);
alter table public.community_comments enable row level security;

drop policy if exists "community_comments_read_members" on public.community_comments;
create policy "community_comments_read_members" on public.community_comments
  for select to authenticated using (
    exists (select 1 from public.community_members cm
      where cm.community_id = community_comments.community_id and cm.user_id = auth.uid())
  );
drop policy if exists "community_comments_insert_members" on public.community_comments;
create policy "community_comments_insert_members" on public.community_comments
  for insert to authenticated with check (
    author_id = auth.uid() and exists (
      select 1 from public.community_members cm
      where cm.community_id = community_comments.community_id and cm.user_id = auth.uid()
    ) and exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id and p.community_id = community_comments.community_id
    )
  );
drop policy if exists "community_comments_delete_own" on public.community_comments;
create policy "community_comments_delete_own" on public.community_comments
  for delete to authenticated using (author_id = auth.uid());
