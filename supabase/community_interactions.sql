-- Connect Social Interaction: likes and in-app notifications.
-- Run after community_members.sql and community_feed.sql in Supabase SQL Editor.

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists community_post_likes_user_idx
  on public.community_post_likes (user_id, created_at desc);
alter table public.community_post_likes enable row level security;

drop policy if exists "community_post_likes_read_members" on public.community_post_likes;
create policy "community_post_likes_read_members" on public.community_post_likes
  for select to authenticated using (
    exists (select 1 from public.community_posts p
      join public.community_members cm on cm.community_id = p.community_id
      where p.id = community_post_likes.post_id and cm.user_id = auth.uid())
  );
drop policy if exists "community_post_likes_insert_self_member" on public.community_post_likes;
create policy "community_post_likes_insert_self_member" on public.community_post_likes
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.community_posts p
      join public.community_members cm on cm.community_id = p.community_id
      where p.id = community_post_likes.post_id and cm.user_id = auth.uid()
    )
  );
drop policy if exists "community_post_likes_delete_self" on public.community_post_likes;
create policy "community_post_likes_delete_self" on public.community_post_likes
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  community_id text not null check (community_id in ('tech','art','music','nature','books','sport')),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  notification_type text not null check (notification_type in ('like','comment')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id)
);
create index if not exists community_notifications_inbox_idx
  on public.community_notifications (recipient_id, created_at desc);
alter table public.community_notifications enable row level security;

drop policy if exists "community_notifications_read_own" on public.community_notifications;
create policy "community_notifications_read_own" on public.community_notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "community_notifications_update_own" on public.community_notifications;
create policy "community_notifications_update_own" on public.community_notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function public.notify_community_post_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare post_author uuid; post_community text;
begin
  select author_id, community_id into post_author, post_community
  from public.community_posts where id = new.post_id;
  if post_author is not null and post_author <> new.user_id then
    insert into public.community_notifications (recipient_id, actor_id, community_id, post_id, notification_type)
    values (post_author, new.user_id, post_community, new.post_id, 'like');
  end if;
  return new;
end;
$$;
drop trigger if exists community_post_like_notification on public.community_post_likes;
create trigger community_post_like_notification after insert on public.community_post_likes
  for each row execute function public.notify_community_post_like();

create or replace function public.notify_community_post_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare post_author uuid;
begin
  select author_id into post_author from public.community_posts where id = new.post_id;
  if post_author is not null and post_author <> new.author_id then
    insert into public.community_notifications (recipient_id, actor_id, community_id, post_id, comment_id, notification_type)
    values (post_author, new.author_id, new.community_id, new.post_id, new.id, 'comment');
  end if;
  return new;
end;
$$;
drop trigger if exists community_post_comment_notification on public.community_comments;
create trigger community_post_comment_notification after insert on public.community_comments
  for each row execute function public.notify_community_post_comment();

-- Notifications are created only by trusted database triggers; no client INSERT policy is granted.

-- Limit client-side updates to the read marker only.
revoke update on public.community_notifications from anon, authenticated;
grant update (read_at) on public.community_notifications to authenticated;
revoke all on function public.notify_community_post_like() from public, anon, authenticated;
revoke all on function public.notify_community_post_comment() from public, anon, authenticated;
