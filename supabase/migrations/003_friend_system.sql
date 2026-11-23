-- Connect Friend System + Direct Messages
-- Chạy sau supabase/migrations/001_schema.sql trong Supabase Dashboard > SQL Editor.
-- Không xóa dữ liệu hiện có.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null constraint friend_requests_requester_id_fkey references public.profiles(id) on delete cascade,
  recipient_id uuid not null constraint friend_requests_recipient_id_fkey references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pair_low uuid generated always as (least(requester_id, recipient_id)) stored,
  pair_high uuid generated always as (greatest(requester_id, recipient_id)) stored,
  constraint friend_requests_not_self check (requester_id <> recipient_id),
  constraint friend_requests_one_pair unique (pair_low, pair_high)
);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_requester_status_idx
  on public.friend_requests (requester_id, status, created_at desc);

alter table public.friend_requests enable row level security;
grant select, insert, update, delete on public.friend_requests to authenticated;
revoke all on public.friend_requests from anon;

drop policy if exists "friend_requests_read_participants" on public.friend_requests;
create policy "friend_requests_read_participants"
  on public.friend_requests for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "friend_requests_send_public_profile" on public.friend_requests;
create policy "friend_requests_send_public_profile"
  on public.friend_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and recipient_id <> auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.is_visible = true
    )
  );

drop policy if exists "friend_requests_recipient_respond" on public.friend_requests;
create policy "friend_requests_recipient_respond"
  on public.friend_requests for update to authenticated
  using (recipient_id = auth.uid() and status = 'pending')
  with check (recipient_id = auth.uid() and status in ('accepted','declined'));

drop policy if exists "friend_requests_delete_own_or_declined" on public.friend_requests;
create policy "friend_requests_delete_own_or_declined"
  on public.friend_requests for delete to authenticated
  using (
    (requester_id = auth.uid() and status = 'pending')
    or (status = 'declined' and (requester_id = auth.uid() or recipient_id = auth.uid()))
    or (status = 'accepted' and (requester_id = auth.uid() or recipient_id = auth.uid()))
  );

create or replace function public.guard_friend_request_update()
returns trigger language plpgsql as $$
begin
  if old.requester_id <> new.requester_id or old.recipient_id <> new.recipient_id then
    raise exception 'Không thể thay đổi người gửi hoặc người nhận lời mời.';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted','declined') then
    raise exception 'Trạng thái lời mời không hợp lệ.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists friend_request_update_guard on public.friend_requests;
create trigger friend_request_update_guard
before update on public.friend_requests
for each row execute function public.guard_friend_request_update();

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null constraint direct_messages_sender_id_fkey references public.profiles(id) on delete cascade,
  recipient_id uuid not null constraint direct_messages_recipient_id_fkey references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id)
);
create index if not exists direct_messages_pair_created_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx
  on public.direct_messages (recipient_id, sender_id, created_at desc);

alter table public.direct_messages enable row level security;
grant select, insert on public.direct_messages to authenticated;
revoke all on public.direct_messages from anon;

drop policy if exists "direct_messages_read_friends" on public.direct_messages;
create policy "direct_messages_read_friends"
  on public.direct_messages for select to authenticated
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.requester_id = direct_messages.sender_id and fr.recipient_id = direct_messages.recipient_id)
          or (fr.requester_id = direct_messages.recipient_id and fr.recipient_id = direct_messages.sender_id))
        and (fr.requester_id = auth.uid() or fr.recipient_id = auth.uid())
    )
  );

drop policy if exists "direct_messages_send_to_friends" on public.direct_messages;
create policy "direct_messages_send_to_friends"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.requester_id = sender_id and fr.recipient_id = recipient_id)
          or (fr.requester_id = recipient_id and fr.recipient_id = sender_id))
    )
  );

-- Bật realtime cho tin nhắn riêng (nếu bảng chưa có trong publication).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
     ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
