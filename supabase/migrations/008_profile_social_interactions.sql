-- Connect Social Interaction 2.0: likes, comments and notifications for profile posts.
-- Run after 007_profile_social_identity.sql in Supabase > SQL Editor.

create table if not exists public.profile_post_likes (
  post_id uuid not null references public.profile_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists profile_post_likes_user_idx
  on public.profile_post_likes (user_id, created_at desc);
alter table public.profile_post_likes enable row level security;

drop policy if exists "profile_post_likes_read_visible" on public.profile_post_likes;
create policy "profile_post_likes_read_visible" on public.profile_post_likes
  for select to anon, authenticated using (
    exists (select 1 from public.profile_posts pp join public.profiles p on p.id = pp.user_id
      where pp.id = profile_post_likes.post_id and (p.is_visible = true or pp.user_id = auth.uid()))
  );
drop policy if exists "profile_post_likes_insert_visible" on public.profile_post_likes;
create policy "profile_post_likes_insert_visible" on public.profile_post_likes
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.profile_posts pp join public.profiles p on p.id = pp.user_id
      where pp.id = profile_post_likes.post_id and p.is_visible = true and pp.user_id <> auth.uid()
    )
  );
drop policy if exists "profile_post_likes_delete_own" on public.profile_post_likes;
create policy "profile_post_likes_delete_own" on public.profile_post_likes
  for delete to authenticated using (user_id = auth.uid());
grant select on public.profile_post_likes to anon, authenticated;
grant insert, delete on public.profile_post_likes to authenticated;

create table if not exists public.profile_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.profile_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists profile_post_comments_post_idx
  on public.profile_post_comments (post_id, created_at asc);
alter table public.profile_post_comments enable row level security;

drop policy if exists "profile_post_comments_read_visible" on public.profile_post_comments;
create policy "profile_post_comments_read_visible" on public.profile_post_comments
  for select to anon, authenticated using (
    exists (select 1 from public.profile_posts pp join public.profiles p on p.id = pp.user_id
      where pp.id = profile_post_comments.post_id and (p.is_visible = true or pp.user_id = auth.uid()))
  );
drop policy if exists "profile_post_comments_insert_visible" on public.profile_post_comments;
create policy "profile_post_comments_insert_visible" on public.profile_post_comments
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.profile_posts pp join public.profiles p on p.id = pp.user_id
      where pp.id = profile_post_comments.post_id and (p.is_visible = true or pp.user_id = auth.uid())
    )
  );
drop policy if exists "profile_post_comments_delete_own" on public.profile_post_comments;
create policy "profile_post_comments_delete_own" on public.profile_post_comments
  for delete to authenticated using (user_id = auth.uid());
grant select on public.profile_post_comments to anon, authenticated;
grant insert, delete on public.profile_post_comments to authenticated;

create table if not exists public.profile_post_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.profile_posts(id) on delete cascade,
  comment_id uuid references public.profile_post_comments(id) on delete cascade,
  notification_type text not null check (notification_type in ('like','comment')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id)
);
create index if not exists profile_post_notifications_inbox_idx
  on public.profile_post_notifications (recipient_id, created_at desc);
alter table public.profile_post_notifications enable row level security;
drop policy if exists "profile_post_notifications_read_own" on public.profile_post_notifications;
create policy "profile_post_notifications_read_own" on public.profile_post_notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "profile_post_notifications_update_own" on public.profile_post_notifications;
create policy "profile_post_notifications_update_own" on public.profile_post_notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke all on public.profile_post_notifications from anon, authenticated;
grant select on public.profile_post_notifications to authenticated;
grant update (read_at) on public.profile_post_notifications to authenticated;

create or replace function public.notify_profile_post_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare post_owner uuid;
begin
  select user_id into post_owner from public.profile_posts where id = new.post_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.profile_post_notifications (recipient_id, actor_id, post_id, notification_type)
    values (post_owner, new.user_id, new.post_id, 'like');
  end if;
  return new;
end;
$$;
drop trigger if exists profile_post_like_notification on public.profile_post_likes;
create trigger profile_post_like_notification after insert on public.profile_post_likes
  for each row execute function public.notify_profile_post_like();

create or replace function public.notify_profile_post_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare post_owner uuid;
begin
  select user_id into post_owner from public.profile_posts where id = new.post_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.profile_post_notifications (recipient_id, actor_id, post_id, comment_id, notification_type)
    values (post_owner, new.user_id, new.post_id, new.id, 'comment');
  end if;
  return new;
end;
$$;
drop trigger if exists profile_post_comment_notification on public.profile_post_comments;
create trigger profile_post_comment_notification after insert on public.profile_post_comments
  for each row execute function public.notify_profile_post_comment();

revoke all on function public.notify_profile_post_like() from public, anon, authenticated;
revoke all on function public.notify_profile_post_comment() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_post_likes') then
      alter publication supabase_realtime add table public.profile_post_likes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_post_comments') then
      alter publication supabase_realtime add table public.profile_post_comments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_post_notifications') then
      alter publication supabase_realtime add table public.profile_post_notifications;
    end if;
  end if;
end $$;
