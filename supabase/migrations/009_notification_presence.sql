-- Connect: Notification Center & Online Presence
-- Chạy sau supabase/migrations/003_friend_system.sql trong Supabase SQL Editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in ('friend_request', 'friend_accepted', 'direct_message')),
  entity_id uuid,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 240),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
drop policy if exists "notifications_mark_own_read" on public.notifications;
create policy "notifications_mark_own_read"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.connect_notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare actor_name text;
begin
  select coalesce(nullif(trim(display_name), ''), 'Một thành viên Connect')
    into actor_name from public.profiles where id = new.requester_id;
  actor_name := coalesce(actor_name, 'Một thành viên Connect');
  insert into public.notifications (recipient_id, actor_id, notification_type, entity_id, title, body)
  values (new.recipient_id, new.requester_id, 'friend_request', new.id,
    'Lời mời kết bạn mới', left(actor_name || ' đã gửi lời mời kết bạn cho bạn.', 240));
  return new;
end;
$$;

drop trigger if exists connect_friend_request_notification on public.friend_requests;
create trigger connect_friend_request_notification
after insert on public.friend_requests
for each row when (new.status = 'pending')
execute function public.connect_notify_friend_request();

create or replace function public.connect_notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare actor_name text;
begin
  if old.status = 'pending' and new.status = 'accepted' then
    select coalesce(nullif(trim(display_name), ''), 'Một thành viên Connect')
      into actor_name from public.profiles where id = new.recipient_id;
    actor_name := coalesce(actor_name, 'Một thành viên Connect');
    insert into public.notifications (recipient_id, actor_id, notification_type, entity_id, title, body)
    values (new.requester_id, new.recipient_id, 'friend_accepted', new.id,
      'Lời mời đã được chấp nhận', left(actor_name || ' đã chấp nhận lời mời kết bạn của bạn.', 240));
  end if;
  return new;
end;
$$;

drop trigger if exists connect_friend_accepted_notification on public.friend_requests;
create trigger connect_friend_accepted_notification
after update of status on public.friend_requests
for each row execute function public.connect_notify_friend_accepted();

create or replace function public.connect_notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare actor_name text;
begin
  select coalesce(nullif(trim(display_name), ''), 'Một người bạn')
    into actor_name from public.profiles where id = new.sender_id;
  actor_name := coalesce(actor_name, 'Một người bạn');
  insert into public.notifications (recipient_id, actor_id, notification_type, entity_id, title, body)
  values (new.recipient_id, new.sender_id, 'direct_message', new.id,
    left('Tin nhắn mới từ ' || actor_name, 120),
    left(new.body, 120));
  return new;
end;
$$;

drop trigger if exists connect_direct_message_notification on public.direct_messages;
create trigger connect_direct_message_notification
after insert on public.direct_messages
for each row execute function public.connect_notify_direct_message();

-- Presence chỉ lưu mốc hoạt động gần nhất. Frontend xem là trực tuyến nếu cập nhật trong 2 phút.
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen timestamptz not null default now()
);
create index if not exists user_presence_last_seen_idx on public.user_presence (last_seen desc);
alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;
grant select, insert, update on public.user_presence to authenticated;

drop policy if exists "presence_read_self_or_friends" on public.user_presence;
create policy "presence_read_self_or_friends"
  on public.user_presence for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.requester_id = auth.uid() and fr.recipient_id = user_presence.user_id)
          or (fr.recipient_id = auth.uid() and fr.requester_id = user_presence.user_id))
    )
  );
drop policy if exists "presence_insert_own" on public.user_presence;
create policy "presence_insert_own"
  on public.user_presence for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "presence_update_own" on public.user_presence;
create policy "presence_update_own"
  on public.user_presence for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime cho badge thông báo và trạng thái bạn bè.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_presence') then
      alter publication supabase_realtime add table public.user_presence;
    end if;
  end if;
end $$;
